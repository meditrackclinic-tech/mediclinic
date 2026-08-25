param(
  [string]$EnvPath = "server/.env"
)

$ErrorActionPreference = "Stop"

function Read-RequiredValue {
  param([string]$Prompt)

  do {
    $value = Read-Host $Prompt
  } while ([string]::IsNullOrWhiteSpace($value))

  return $value.Trim()
}

function ConvertFrom-SecureStringToPlainText {
  param([securestring]$SecureValue)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Set-EnvValue {
  param(
    [string[]]$Lines,
    [string]$Key,
    [string]$Value
  )

  $updated = $false
  $nextLines = foreach ($line in $Lines) {
    if ($line -match "^$([regex]::Escape($Key))=") {
      $updated = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $updated) {
    $nextLines += "$Key=$Value"
  }

  return $nextLines
}

if (-not (Test-Path $EnvPath)) {
  if (Test-Path "server/.env.example") {
    Copy-Item "server/.env.example" $EnvPath
  } else {
    New-Item -ItemType File -Path $EnvPath -Force | Out-Null
  }
}

Write-Host ""
Write-Host "MediTrack NLP SMTP setup" -ForegroundColor Cyan
Write-Host "Use an app password for Gmail/Outlook, not your normal mailbox password." -ForegroundColor Yellow
Write-Host ""
Write-Host "Choose provider:"
Write-Host "  1. Gmail"
Write-Host "  2. Outlook / Microsoft 365"
Write-Host "  3. Custom SMTP"

$provider = Read-RequiredValue "Provider number"

switch ($provider) {
  "1" {
    $smtpHost = "smtp.gmail.com"
    $smtpPort = "465"
  }
  "2" {
    $smtpHost = "smtp.office365.com"
    $smtpPort = "587"
  }
  "3" {
    $smtpHost = Read-RequiredValue "SMTP host"
    $smtpPort = Read-RequiredValue "SMTP port"
  }
  default {
    throw "Unknown provider selection."
  }
}

$smtpUser = Read-RequiredValue "Sender email address"
if ($smtpUser -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
  throw "Enter the complete sender email address, for example clinic@example.com."
}

$securePassword = Read-Host "SMTP app password" -AsSecureString
$smtpPassword = ConvertFrom-SecureStringToPlainText $securePassword

if ([string]::IsNullOrWhiteSpace($smtpPassword)) {
  throw "SMTP app password is required."
}

$fromName = Read-Host "From name (default: MediTrack NLP)"
if ([string]::IsNullOrWhiteSpace($fromName)) {
  $fromName = "MediTrack NLP"
}

Write-Host ""
Write-Host "Verifying SMTP connection and login before saving..." -ForegroundColor Cyan

$smtpKeys = @("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS")
$previousSmtpValues = @{}
foreach ($key in $smtpKeys) {
  $previousSmtpValues[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
}

try {
  $env:SMTP_HOST = $smtpHost
  $env:SMTP_PORT = $smtpPort
  $env:SMTP_USER = $smtpUser
  $env:SMTP_PASS = $smtpPassword

  & node (Join-Path $PSScriptRoot "verify-smtp.mjs")

  if ($LASTEXITCODE -ne 0) {
    throw "SMTP verification failed. Nothing was saved. For Gmail, use a 16-character Google App Password."
  }
} finally {
  foreach ($key in $smtpKeys) {
    [Environment]::SetEnvironmentVariable($key, $previousSmtpValues[$key], "Process")
  }
}

$envLines = Get-Content $EnvPath
$envLines = Set-EnvValue -Lines $envLines -Key "SMTP_HOST" -Value $smtpHost
$envLines = Set-EnvValue -Lines $envLines -Key "SMTP_PORT" -Value $smtpPort
$envLines = Set-EnvValue -Lines $envLines -Key "SMTP_USER" -Value $smtpUser
$envLines = Set-EnvValue -Lines $envLines -Key "SMTP_PASS" -Value $smtpPassword
$envLines = Set-EnvValue -Lines $envLines -Key "SMTP_FROM" -Value "`"$fromName <$smtpUser>`""

Set-Content -Path $EnvPath -Value $envLines

Write-Host ""
Write-Host "SMTP configured in $EnvPath." -ForegroundColor Green
Write-Host "Restart the app with: npm.cmd run dev:reset" -ForegroundColor Green
Write-Host "Then open Admin > Users and click Test email." -ForegroundColor Green
