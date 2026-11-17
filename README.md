# CMB Immobilien – Website

Statische Website (HTML, CSS, JavaScript). Kein Build nötig.

## Vor dem Livegang
1. Kontaktformular: Kostenlosen Access-Key auf https://web3forms.com holen (mit info@cmb-immobilien.com anmelden)
   und in `kontakt.html` bei `name="access_key"` statt `HIER-WEB3FORMS-ACCESS-KEY-EINTRAGEN` eintragen.
2. Impressum und Datenschutz: gelb markierte Stellen `[…]` ergänzen/prüfen, danach die Markierungen entfernen.
3. Logo: aktuell ein Platzhalter (Haus mit Herz + Schriftzug). Echtes Logo als SVG/PNG in `assets/img/` legen und im Header ersetzen.
4. Teamfotos: als `ilona.jpg`, `renata.jpg`, `fatlinda.jpg`, `hugo.jpg` in `assets/img/team/` ablegen (Format 4:5 hochkant).

## Veröffentlichen mit GitHub Pages
Repository anlegen, alle Dateien hochladen, unter Settings > Pages den Branch `main` und `/ (root)` wählen.
Eigene Domain: bei Strato die A-Records auf 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
setzen und `www` als CNAME auf `<benutzername>.github.io`.

## Bilder laden
Die Bilder der alten Seite (Büro, Team, Logo) und die Objektbilder von Immowelt lassen sich mit einem Befehl in den Projektordner laden:
- Mac/Linux: `bash bilder-holen.sh`
- Windows (PowerShell): `powershell -ExecutionPolicy Bypass -File .\bilder-holen.ps1`

Die Objektdaten liegen in `data/objekte.json` (Stand 16.11.2026, jedes Objekt mit eigenem Immowelt-Link).

## 3D-Startseite (Haus mit Herz)

- Quelltext: `src/hero3d.js` (three.js). Gebündelt nach `assets/js/hero3d.js` mit
  `npm i three esbuild` und `npx esbuild src/hero3d.js --bundle --minify --format=iife --outfile=assets/js/hero3d.js`.
- Das Haus ist komplett aus Code gebaut, es werden keine Modelle oder Bilder nachgeladen.
- Verhalten: Scroll steuert Kamera und Explosionsansicht (Verwaltung, Vermietung, Verkauf & Kauf, Bewertung). Das Herz pulsiert.
- Fallbacks: `prefers-reduced-motion` zeigt ein Standbild, ohne WebGL erscheint die gezeichnete Haus-Grafik.
- **Bitte auf einem echten Handy testen** (Flüssigkeit lässt sich im Sandbox-Test nicht messen). Die Qualität regelt sich bei niedrigen fps selbst herunter.
- Objekte kommen aus `data/objekte.json` (Seite muss über http laufen, z. B. GitHub Pages; beim lokalen Test `python3 -m http.server`).

## Objekte mit Excel pflegen

`objekte.xlsx` enthält alle Objekte (Blatt „Anleitung“ erklärt die Schritte). Nach dem Speichern `python tools/excel-zu-json.py` ausführen (einmalig `pip install openpyxl`), das schreibt `data/objekte.json`. Bilder als `<id>.jpg` nach `assets/img/objekte/`.

## Hintergrundvideos

Vier komprimierte Drohnenvideos (ohne Ton, je 0,7 bis 2,5 MB) liegen in `assets/video/` (Poster als .jpg daneben). Sie laden erst, wenn sie sichtbar werden, und pausieren außerhalb des Bildschirms. Bei „reduzierter Bewegung“ oder Datensparmodus zeigt die Seite nur das Poster. Videoquellen: Stockmaterial des Kunden-Ordners; Lizenz (z. B. Pexels/Pixabay) bitte vor Veröffentlichung prüfen.

## Anfrageformular (Kontaktseite)

Dreistufiges Formular (`assets/css/form.css`, `assets/js/form.js`), Versand über Web3Forms an **info@cmb-immobilien.com**.
1. Auf web3forms.com mit dieser E-Mail-Adresse einen Access-Key erstellen (der Key kommt per E-Mail an dieses Postfach, es braucht also Zugriff darauf).
2. Den Key in `kontakt.html` statt `HIER-WEB3FORMS-ACCESS-KEY-EINTRAGEN` eintragen (steht im Feld `access_key`). Bei Änderungen am Generator in `build.py`.
3. Testanfrage senden. Bis der Key eingetragen ist, zeigt das Formular einen Hinweis mit der Telefonnummer.
Die Buttons „Bewertung anfragen“ öffnen das Formular direkt bei Schritt 2 (`kontakt.html?anliegen=Bewertung`).

## Design

Nach dem Vorbild The Fridman Group: weiße Kopfzeile und weiße Suchleiste, Hero-Video, schwarzes Band mit dem 3D-Haus, Foto-Kacheln, helle Objektkarten. Schriften Tenor Sans (Überschriften) und Montserrat (Text), lokal eingebunden. Alle Farben und Schriften stehen in `assets/css/theme-light.css`.

## Verkaufsanfrage (verkaufen.html)

Eigene Seite für Verkäufer: Art der Immobilie, Straße/PLZ/Ort, Wohn- und Grundstücksfläche, Zimmer, Wunschpreis, Zeitrahmen, Vorname, Nachname, Telefon, E-Mail. Die Angaben gehen über Web3Forms als E-Mail an info@cmb-immobilien.com (Betreff „Neue Verkaufsanfrage: Haus in Ort (Name)“, Telefon und Name stehen oben). Verlinkt von der Verkauf-Kachel, der Fußzeile und der Leistungsseite. Gleicher Access-Key wie die Kontaktseite (Feld `access_key` in `verkaufen.html`).


## Angebote automatisch von Immowelt (kein Excel mehr nötig)

Immowelt sperrt die Server von GitHub (HTTP 403), deshalb läuft der Abgleich auf einem normalen Windows-PC (z. B. im Büro):

1. Auf dem PC `einrichten-windows.ps1` per Rechtsklick → "Mit PowerShell ausführen" starten. Das installiert Git und Python (falls nötig), holt den Ordner nach `C:\CMB-Website`, testet den Abruf und richtet eine stündliche Aufgabe ein.
2. Beim ersten Hochladen öffnet sich ein GitHub-Anmeldefenster.
3. Danach startet `sync-windows.ps1` stündlich (solange der PC an und angemeldet ist). `tools/immowelt-sync.py` liest das öffentliche Immowelt-Profil, schreibt `data/objekte.json` neu und lädt die Bilder nach `assets/img/objekte/`. Neue Angebote erscheinen, verkaufte verschwinden mit ihrem Bild. Geändert wird nur bei Unterschieden, danach baut GitHub Pages die Seite neu.
4. Ergebnis jedes Laufs: `C:\CMB-Website\sync-log.txt`.

- Schlägt der Abruf fehl, bleiben die alten Daten unverändert.
- Das Feld `zusatz` (z. B. "als Kapitalanlage geeignet") bleibt erhalten, wenn du es in `data/objekte.json` von Hand einträgst.
- Manuell: `python tools/immowelt-sync.py`, dann mit Git hochladen.
