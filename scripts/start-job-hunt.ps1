$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

docker compose up -d
Write-Host "Job Hunt Dashboard started."
Write-Host "Open: http://localhost:8080"
