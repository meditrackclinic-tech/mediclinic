$ErrorActionPreference = "SilentlyContinue"

$ports = @(4000, 5173, 5174, 5175)

function Get-DevPortListeners {
  Get-NetTCPConnection -LocalPort $ports |
    Where-Object { $_.State -eq "Listen" -and $_.OwningProcess -ne 0 }
}

$listeners = Get-DevPortListeners

if ($listeners) {
  Write-Host "Stopping old development server processes on ports: $($ports -join ', ')"
} else {
  Write-Host "No old development server processes found."
}

$attempt = 0

while ($listeners -and $attempt -lt 5) {
  $processIds = $listeners |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force

    if (Get-Process -Id $processId) {
      taskkill.exe /PID $processId /T /F | Out-Null
    }
  }

  Start-Sleep -Seconds 1
  $attempt += 1
  $listeners = Get-DevPortListeners
}

$activeListeners = Get-DevPortListeners

if ($activeListeners) {
  Write-Host "Some ports are still in use:"
  $activeListeners | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table -AutoSize
  exit 1
}

Write-Host "Development ports are free."
