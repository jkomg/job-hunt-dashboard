$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

$defaultUsername = if ($env:DEFAULT_USERNAME) { $env:DEFAULT_USERNAME } else { "jason" }
if (-not [Console]::IsInputRedirected) {
  $inputUsername = Read-Host "Choose app username [$defaultUsername]"
  if (-not [string]::IsNullOrWhiteSpace($inputUsername)) {
    $defaultUsername = $inputUsername
  }
}
$defaultUsername = ($defaultUsername.ToLower() -replace "\s", "")
if ([string]::IsNullOrWhiteSpace($defaultUsername)) {
  $defaultUsername = "jason"
}

$installMode = if ($env:INSTALL_MODE) { $env:INSTALL_MODE.Trim().ToLower() } else { "guided" }
if ($installMode -notin @("guided", "no-google", "with-google")) {
  $installMode = "guided"
}

$enableSheetsSync = $false
if (-not [string]::IsNullOrWhiteSpace($env:ENABLE_SHEETS_SYNC)) {
  $preset = $env:ENABLE_SHEETS_SYNC.Trim().ToLower()
  if ($preset -in @("y", "yes", "true", "1")) {
    $enableSheetsSync = $true
  }
} elseif ($installMode -eq "with-google") {
  $enableSheetsSync = $true
} elseif ($installMode -eq "no-google") {
  $enableSheetsSync = $false
}

if ($installMode -eq "guided" -and -not [Console]::IsInputRedirected) {
  Write-Host ""
  Write-Host "Choose install mode:"
  Write-Host "  1) No Google sync (Recommended for easiest setup)"
  Write-Host "  2) With Google sync (for shared spreadsheet workflows)"
  $modeChoice = Read-Host "Enter 1 or 2 [1]"
  if ($modeChoice.Trim() -eq "2") {
    $enableSheetsSync = $true
    $installMode = "with-google"
  } else {
    $enableSheetsSync = $false
    $installMode = "no-google"
  }
}

$sheetInput = if ($env:SHEET_INPUT) { $env:SHEET_INPUT } elseif ($env:GOOGLE_SHEETS_SOURCE) { $env:GOOGLE_SHEETS_SOURCE } else { "" }
$sheetCredsPath = if ($env:SHEET_CREDS_PATH) { $env:SHEET_CREDS_PATH } elseif ($env:GOOGLE_SHEETS_CREDENTIALS_FILE) { $env:GOOGLE_SHEETS_CREDENTIALS_FILE } else { "" }
if ($enableSheetsSync) {
  Write-Host ""
  Write-Host "Google Sheets setup (one-time):"
  Write-Host "1) Open https://console.cloud.google.com/ and create/select a project."
  Write-Host "2) Enable API: 'Google Sheets API'."
  Write-Host "3) Go to APIs & Services -> Credentials -> Create Credentials -> Service account."
  Write-Host "4) Open that service account -> Keys -> Add key -> Create new key -> JSON."
  Write-Host "5) Save the downloaded JSON file somewhere safe on this computer."
  Write-Host "6) In your Google Sheet, click Share and add the service-account email as Editor."
  Write-Host "   The email usually looks like: name@project-id.iam.gserviceaccount.com"
  Write-Host ""
  if ([string]::IsNullOrWhiteSpace($sheetInput) -and -not [Console]::IsInputRedirected) {
    $sheetInput = (Read-Host "Paste Google Sheet URL (or ID)").Trim()
  }
  if ([string]::IsNullOrWhiteSpace($sheetCredsPath) -and -not [Console]::IsInputRedirected) {
    $sheetCredsPath = (Read-Host "Paste full path to downloaded service-account JSON file").Trim()
  }
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
Set-Or-Append -Key "DEFAULT_USERNAME" -Value $defaultUsername

function Get-SheetId([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $trimmed = $Value.Trim()
  $match = [regex]::Match($trimmed, "/spreadsheets/d/([a-zA-Z0-9\-_]+)")
  if ($match.Success) { return $match.Groups[1].Value }
  if ($trimmed -match "^[a-zA-Z0-9\-_]{20,}$") { return $trimmed }
  return $null
}

if ($enableSheetsSync) {
  $sheetId = Get-SheetId -Value $sheetInput
  if (-not $sheetId) {
    Write-Warning "Google Sheets sync skipped: invalid sheet URL/ID."
  } elseif ([string]::IsNullOrWhiteSpace($sheetCredsPath)) {
    Write-Warning "Google Sheets sync skipped: no service-account JSON path provided."
  } elseif (-not (Test-Path $sheetCredsPath)) {
    Write-Warning "Google Sheets sync skipped: file not found: $sheetCredsPath"
  } else {
    try {
      $rawJson = Get-Content -Raw -Path $sheetCredsPath
      $null = $rawJson | ConvertFrom-Json
      $credB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($rawJson))

      Set-Or-Append -Key "GOOGLE_SHEETS_ID" -Value $sheetId
      Set-Or-Append -Key "GOOGLE_SHEETS_SYNC_TABS" -Value "Jobs & Applications,Found"
      Set-Or-Append -Key "GOOGLE_SHEETS_CONTACTS_SYNC_TABS" -Value "Networking Tracker"
      Set-Or-Append -Key "GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS" -Value "Interview Tracker"
      Set-Or-Append -Key "GOOGLE_SHEETS_EVENTS_SYNC_TABS" -Value "Events"
      Set-Or-Append -Key "GOOGLE_SHEETS_CREDENTIALS_JSON" -Value $credB64

      Write-Host "Google Sheets sync configured for all supported Remote Rebellion tabs."
    } catch {
      Write-Warning "Google Sheets sync skipped: invalid credentials JSON."
    }
  }
}

Set-Content -Path $envPath -Value $script:lines

if (-not (Test-Path "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

docker compose up --build -d

Write-Host ""
Write-Host "Job Hunt Dashboard is starting in Docker mode."
Write-Host "Open: http://localhost:8080"
if ($enableSheetsSync) {
  Write-Host "Install mode: With Google sync"
} else {
  Write-Host "Install mode: No Google sync"
}
Write-Host "Default login (session mode): $defaultUsername / jobhunt2026"
Write-Host "First sign-in will force a password change."
Write-Host "Data persists in: .\data\app.db"
