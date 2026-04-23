$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

$envPath = Join-Path $RootDir ".env"
$script:lines = Get-Content $envPath

function Set-Or-Append([string]$Key, [string]$Value, [bool]$OnlyIfEmpty = $false) {
  for ($i = 0; $i -lt $script:lines.Count; $i++) {
    if ($script:lines[$i].StartsWith("$Key=")) {
      $current = $script:lines[$i].Split("=", 2)[1].Trim()
      if ($OnlyIfEmpty -and $current) { return }
      $script:lines[$i] = "$Key=$Value"
      return
    }
  }
  $script:lines += "$Key=$Value"
}

$sessionLine = $script:lines | Where-Object { $_ -like "SESSION_SECRET=*" } | Select-Object -First 1
$sessionValue = $null
if ($sessionLine) {
  $sessionValue = $sessionLine.Split("=", 2)[1].Trim()
}
if (-not $sessionValue -or $sessionValue -eq "change-me-in-production") {
  $random = -join ((33..126) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  Set-Or-Append -Key "SESSION_SECRET" -Value $random
}

Set-Or-Append -Key "DATABASE_URL" -Value "file:./data/app.db" -OnlyIfEmpty $true
Set-Or-Append -Key "AUTH_MODE" -Value "session" -OnlyIfEmpty $true

Set-Content -Path $envPath -Value $script:lines

if (-not (Test-Path "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

docker compose up --build -d

Write-Host ""
Write-Host "Job Hunt Dashboard is starting in Docker mode."
Write-Host "Open: http://localhost:8080"
Write-Host "Default login (session mode): jason / jobhunt2026"
Write-Host "Data persists in: .\data\app.db"
