$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$Desktop = [Environment]::GetFolderPath("Desktop")
$StartBat = Join-Path $Desktop "Start Job Hunt.bat"
$StopBat = Join-Path $Desktop "Stop Job Hunt.bat"

$startContent = @"
@echo off
cd /d "$RootDir"
powershell -ExecutionPolicy Bypass -File ".\scripts\start-job-hunt.ps1"
"@

$stopContent = @"
@echo off
cd /d "$RootDir"
powershell -ExecutionPolicy Bypass -File ".\scripts\stop-job-hunt.ps1"
"@

Set-Content -Path $StartBat -Value $startContent -Encoding ASCII
Set-Content -Path $StopBat -Value $stopContent -Encoding ASCII

Write-Host "Created launchers:"
Write-Host "  $StartBat"
Write-Host "  $StopBat"
