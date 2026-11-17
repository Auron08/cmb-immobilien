# Einmalige Einrichtung des automatischen Angebote-Abgleichs auf einem Windows-PC (Windows 10/11).
# Start: Rechtsklick auf die Datei -> "Mit PowerShell ausfuehren".
$ErrorActionPreference = "Stop"
$ziel = "C:\CMB-Website"
$repoUrl = "https://github.com/Auron08/cmb-immobilien.git"

function PfadNeuLaden { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }

Write-Host "1/5 Git und Python pruefen ..." -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements; PfadNeuLaden }
if (-not ((Get-Command python -ErrorAction SilentlyContinue) -or (Get-Command py -ErrorAction SilentlyContinue))) { winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements; PfadNeuLaden }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "Git wurde nicht gefunden. Bitte dieses Fenster schliessen und das Skript noch einmal starten." -ForegroundColor Yellow; Read-Host "Enter zum Beenden"; exit }
$py = "python"; if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $py = "py" }

Write-Host "2/5 Website-Ordner holen ($ziel) ..." -ForegroundColor Cyan
if (-not (Test-Path "$ziel\.git")) { git clone $repoUrl $ziel }
Set-Location $ziel
git config user.name "CMB Website Bot"
git config user.email "actions@users.noreply.github.com"
git pull --rebase --autostash

Write-Host "3/5 Testlauf: Angebote bei Immowelt abrufen ..." -ForegroundColor Cyan
& $py tools\immowelt-sync.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Der Abruf hat nicht funktioniert (siehe oben). Bitte den Text dem Webentwickler schicken." -ForegroundColor Red
    Read-Host "Enter zum Beenden"; exit
}

Write-Host "4/5 Aenderungen zu GitHub hochladen (beim ersten Mal oeffnet sich ein Anmeldefenster) ..." -ForegroundColor Cyan
git add data/objekte.json assets/img/objekte
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Angebote von Immowelt aktualisiert"; git push }
else { git push --dry-run 2>&1 | Out-Null; Write-Host "Keine Aenderungen, Anmeldung wird beim ersten echten Upload abgefragt." }

Write-Host "5/5 Stuendliche Aufgabe einrichten ..." -ForegroundColor Cyan
$sync = Join-Path $ziel "sync-windows.ps1"
$aktion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $sync + "`"")
$ausloeser = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1)
$einst = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "CMB Angebote abgleichen" -Action $aktion -Trigger $ausloeser -Settings $einst -Force | Out-Null

Write-Host ""
Write-Host "Fertig. Die Angebote werden ab jetzt jede Stunde abgeglichen, solange der PC an und angemeldet ist." -ForegroundColor Green
Write-Host "Protokoll: $ziel\sync-log.txt"
Read-Host "Enter zum Beenden"
