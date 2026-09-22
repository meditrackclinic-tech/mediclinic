param(
  [string]$EnvPath = "",
  [switch]$CopyOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvPath) {
  $EnvPath = Join-Path $projectRoot "server\.env"
} elseif (-not [IO.Path]::IsPathRooted($EnvPath)) {
  $EnvPath = Join-Path $projectRoot $EnvPath
}
$EnvPath = [IO.Path]::GetFullPath($EnvPath)

function Read-PrivateValue {
  param([string]$Prompt)
  $secureValue = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Set-EnvValue {
  param([string[]]$Lines, [string]$Key, [string]$Value)
  $found = $false
  $nextLines = @(
    foreach ($line in $Lines) {
      if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
        if (-not $found) { "$Key=$Value" }
        $found = $true
      } else { $line }
    }
  )
  if (-not $found) { $nextLines += "$Key=$Value" }
  return $nextLines
}

if (-not (Test-Path -LiteralPath $EnvPath -PathType Leaf)) {
  throw "The application environment file was not found."
}
$envLines = Get-Content -LiteralPath $EnvPath
$appPort = 4000
$connectionTemplate = ""
foreach ($line in $envLines) {
  if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') { $appPort = [int]$Matches[1] }
  if ($line -match '^\s*SUPABASE_CONNECTION_TEMPLATE\s*=\s*(.+)\s*$') {
    $connectionTemplate = $Matches[1].Trim().Trim('"').Trim("'")
  }
}
if (Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue) {
  throw "Stop MediTrack first (Ctrl+C in its running terminal), then retry. Records must not change during the transfer."
}

Write-Host "MediTrack PostgreSQL to Supabase migration" -ForegroundColor Cyan
if ($connectionTemplate) {
  if (-not $connectionTemplate.Contains("[YOUR-PASSWORD]")) {
    throw "SUPABASE_CONNECTION_TEMPLATE must contain the [YOUR-PASSWORD] placeholder, not a saved password."
  }
  $targetUrl = $connectionTemplate
  Write-Host "Using the Supabase connection saved for this project."
} else {
  Write-Host "In Supabase, open Connect > Session pooler and copy its PostgreSQL URI."
  Write-Host "If port 5432 times out, use the Transaction pooler URI on port 6543 instead."
  Write-Host "You can leave [YOUR-PASSWORD] in the URI; the password will be requested separately."
  $targetUrl = Read-PrivateValue "Supabase connection string (input is hidden)"
}
if ($targetUrl.Contains("[YOUR-PASSWORD]")) {
  $targetPassword = Read-PrivateValue "Supabase database password (input is hidden)"
  $targetUrl = $targetUrl.Replace("[YOUR-PASSWORD]", [Uri]::EscapeDataString($targetPassword))
  $targetPassword = $null
}
try { $targetAddress = [Uri]$targetUrl } catch { throw "Invalid connection string." }
if ($targetAddress.Scheme -notin @("postgres", "postgresql") -or
    ($targetAddress.Host -notlike "*.pooler.supabase.com" -and $targetAddress.Host -notlike "*.supabase.co")) {
  throw "Use the PostgreSQL connection string from your Supabase project."
}
if ($targetAddress.Port -eq 6543) {
  Write-Host "Using transaction pooling; the transfer stays inside one verified transaction."
}

$previousTarget = $env:SUPABASE_DATABASE_URL
$previousEnvPath = $env:MIGRATION_ENV_PATH
try {
  $env:SUPABASE_DATABASE_URL = $targetUrl
  $env:MIGRATION_ENV_PATH = $EnvPath

  & node (Join-Path $PSScriptRoot "backup-database.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Backup failed. Migration was not started." }

  & node (Join-Path $PSScriptRoot "migrate-postgres-to-supabase.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Migration failed. The app still uses local PostgreSQL." }

  if ($CopyOnly) {
    Write-Host "The copy was verified. Application settings were not switched (-CopyOnly)." -ForegroundColor Yellow
    return
  }

  $backupDirectory = Join-Path $env:LOCALAPPDATA "MediTrack\backups"
  $null = New-Item -ItemType Directory -Path $backupDirectory -Force
  $backupName = "server-env-before-supabase-" + [Guid]::NewGuid().ToString("N") + ".env"
  Copy-Item -LiteralPath $EnvPath -Destination (Join-Path $backupDirectory $backupName)

  $envLines = Set-EnvValue -Lines $envLines -Key "DATABASE_URL" -Value ('"' + $targetUrl + '"')
  $envLines = Set-EnvValue -Lines $envLines -Key "DATABASE_SSL" -Value "true"
  $envLines = Set-EnvValue -Lines $envLines -Key "DATABASE_SSL_REJECT_UNAUTHORIZED" -Value "true"
  [IO.File]::WriteAllLines($EnvPath, $envLines, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host "Migration verified; the app is configured for Supabase." -ForegroundColor Green
  Write-Host "Start the app with: npm.cmd run dev"
  Write-Host "Verify the connection with: npm.cmd run database:verify"
  Write-Host "All staff keep their passwords and must sign in again."
} finally {
  $env:SUPABASE_DATABASE_URL = $previousTarget
  $env:MIGRATION_ENV_PATH = $previousEnvPath
  $targetUrl = $null
}
