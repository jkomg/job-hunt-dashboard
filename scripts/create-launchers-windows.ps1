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

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($StartBat, $startContent, $utf8NoBom)
[System.IO.File]::WriteAllText($StopBat, $stopContent, $utf8NoBom)

Write-Host "Created launchers:"
Write-Host "  $StartBat"
Write-Host "  $StopBat"
