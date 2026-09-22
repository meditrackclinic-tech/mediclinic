$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $projectRoot ".venv-nlp"
$requirementsPath = Join-Path $projectRoot "nlp-service\requirements.txt"
$pythonPath = Join-Path $venvPath "Scripts\python.exe"

Write-Host "Setting up the local clinical NLP service..." -ForegroundColor Cyan

$pythonLauncher = $null
$pythonArguments = @()

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -3 --version *> $null
  if ($LASTEXITCODE -eq 0) {
    $pythonLauncher = "py"
    $pythonArguments = @("-3")
  }
}

if (-not $pythonLauncher -and (Get-Command python -ErrorAction SilentlyContinue)) {
  & python --version *> $null
  if ($LASTEXITCODE -eq 0) {
    $pythonLauncher = "python"
  }
}

if (-not $pythonLauncher) {
  throw "Python 3.10 or newer is required. Install Python, then run this command again."
}

if (-not (Test-Path -LiteralPath $pythonPath)) {
  & $pythonLauncher @pythonArguments -m venv $venvPath
  if ($LASTEXITCODE -ne 0) {
    throw "Python could not create the local NLP environment. Reinstall Python with pip and venv enabled."
  }
}

& $pythonPath -m pip install --timeout 120 --retries 8 --upgrade pip
if ($LASTEXITCODE -ne 0) {
  throw "The pip upgrade failed. Check the internet connection and run this command again."
}

& $pythonPath -m pip install --timeout 120 --retries 8 -r $requirementsPath
if ($LASTEXITCODE -ne 0) {
  throw "The clinical NLP packages could not be installed. Check the messages above, then run this command again."
}

Write-Host "Local clinical NLP setup is complete." -ForegroundColor Green
Write-Host "Start it with: npm run nlp:start"
