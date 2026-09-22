$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot ".venv-nlp\Scripts\python.exe"
$servicePath = Join-Path $projectRoot "nlp-service"

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "The local NLP service is not installed. Run 'npm run nlp:setup' first."
}

Write-Host "Starting the local Hugging Face clinical NLP service on http://127.0.0.1:8001" -ForegroundColor Cyan
& $pythonPath -m uvicorn app:app --app-dir $servicePath --host 127.0.0.1 --port 8001
