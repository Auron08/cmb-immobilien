# Wird stuendlich von der Windows-Aufgabenplanung gestartet (eingerichtet durch einrichten-windows.ps1).
# Holt die Angebote von Immowelt und laedt Aenderungen zu GitHub hoch. Ergebnis steht in sync-log.txt.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo
$log = Join-Path $repo "sync-log.txt"
function Log($text) { ("{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm"), $text) | Add-Content -Path $log -Encoding UTF8 }

# Python finden (python oder py)
$py = "python"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $py = "py" }

git pull --rebase --autostash 2>&1 | Out-Null
$out = & $py tools\immowelt-sync.py 2>&1 | Out-String
Log ($out.Trim() -replace "\r?\n", " | ")

git add data/objekte.json assets/img/objekte 2>&1 | Out-Null
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "Angebote von Immowelt aktualisiert" 2>&1 | Out-Null
    $push = git push 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) { Log "Aenderungen zu GitHub hochgeladen." } else { Log ("PUSH FEHLGESCHLAGEN: " + ($push.Trim() -replace "\r?\n", " | ")) }
} else {
    Log "Keine Aenderungen."
}
if ((Get-Item $log).Length -gt 200000) { Get-Content $log -Tail 200 | Set-Content $log -Encoding UTF8 }
