#!/usr/bin/env python3
"""Gleicht data/objekte.json mit dem öffentlichen Immowelt-Profil von CMB Immobilien ab.

Neue Angebote kommen dazu, verkaufte oder gelöschte verschwinden, Preise und Bilder werden aktualisiert.
Nur Python-Standardbibliothek. Aufruf: python tools/immowelt-sync.py
Die Bilder landen in assets/img/objekte/<ID>.jpg, nicht mehr vorhandene Bilder werden gelöscht.
Schlägt der Abruf fehl oder kommt eine leere Liste zurück, bleibt die bisherige Datei unverändert.
"""
import json, os, re, sys, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATEI = os.path.join(ROOT, "data", "objekte.json")
BILDER = os.path.join(ROOT, "assets", "img", "objekte")
PROFIL_ID = "24071"  # interne Profil-Nummer von CMB Immobilien bei Immowelt
PROFIL_URL = "https://www.immowelt.de/profil/c4f2d0039cef4754a39873e509d7870f"
LISTE = ("https://www.immowelt.de/intermediary-profile/bff/v1/api/properties/%s"
         "?acceptLanguage=de&brand=immowelt&propertyStatus=%s&pageSize=3000")
DETAIL = "https://www.immowelt.de/classifiedList/%s"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def hole(url, binaer=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,*/*", "Accept-Language": "de-DE,de;q=0.9"})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read()
    return data if binaer else json.loads(data.decode("utf-8"))


def zahl(text):
    """'1.700 €' -> 1700, '74,2 m²' -> 74.2, 'Mietkosten auf Anfrage' -> None"""
    m = re.search(r"\d[\d.]*(?:,\d+)?", text or "")
    if not m:
        return None
    z = float(m.group(0).replace(".", "").replace(",", "."))
    return int(z) if z == int(z) else z


def abbilden(c, art, alt):
    hf = c.get("hardFacts") or {}
    preis = hf.get("price") or {}
    adr = (c.get("location") or {}).get("address") or {}
    publik = (c.get("location") or {}).get("isAddressPublished", True)
    legacy = (c.get("metadata") or {}).get("legacyId") or c.get("id")
    o = {"id": legacy, "vermarktung": art, "titel": hf.get("title") or ("Angebot zum Kauf" if art == "kauf" else "Angebot zur Miete")}
    if alt.get("zusatz"):
        o["zusatz"] = alt["zusatz"]                      # von Hand ergänzte Zusätze bleiben erhalten
    if (c.get("tags") or {}).get("isNew"):
        o["status"] = "Neu"
    wert = zahl(preis.get("value"))
    o["preis"] = wert
    if preis.get("previousPrice") and zahl(preis["previousPrice"]):
        o["preisAlt"] = zahl(preis["previousPrice"])
    if wert is None:
        o["preisart"] = preis.get("value") or "Preis auf Anfrage"
    else:
        o["preisart"] = "Kaltmiete" if art == "miete" else "Kaufpreis"
    for f in hf.get("facts") or []:
        t, v = f.get("type"), f.get("value") or ""
        if t == "numberOfRooms":
            o["zimmer"] = zahl(v)
        elif t in ("livingSpace", "overallSpace"):
            o["wohnflaeche"] = zahl(v)
        elif t == "plotSpace":
            o["grundstueck"] = zahl(v)
        elif t == "numberOfFloors":
            o["geschoss"] = f.get("label") or v
        elif t == "availability":
            o["verfuegbar"] = v
        elif t in ("officeSpace", "divisible"):
            o["gewerbeflaeche"] = (o.get("gewerbeflaeche", "") + (", " if o.get("gewerbeflaeche") else "") + v.replace(" Bürofläche", "")).strip()
    if publik and adr.get("street"):
        o["adresse"] = adr["street"]
    if adr.get("district") and adr.get("district") != adr.get("city"):
        o["stadtteil"] = adr["district"]
    o["plz"] = adr.get("zipCode", "")
    o["ort"] = adr.get("city", "")
    o["bild"] = "assets/img/objekte/%s.jpg" % legacy
    o["immoweltUrl"] = c.get("url") or "https://www.immowelt.de/expose/%s" % legacy
    bilder = (c.get("gallery") or {}).get("images") if isinstance(c.get("gallery"), dict) else c.get("gallery")
    if bilder:
        o["bildQuelle"] = bilder[0].get("url")
    return {k: v for k, v in o.items() if v not in (None, "") or k == "preis"}


def main():
    alt = {}
    if os.path.exists(DATEI):
        for o in json.load(open(DATEI, encoding="utf-8")).get("objekte", []):
            alt[o["id"]] = o
    neu, fehler = [], False
    for status, art in (("for_sale", "kauf"), ("for_rent", "miete")):
        try:
            ids = [p["id"] for p in hole(LISTE % (PROFIL_ID, status)).get("properties", [])]
            for i in range(0, len(ids), 10):
                for c in hole(DETAIL % ",".join(ids[i:i + 10])):
                    if c.get("status", "Published") == "Published":
                        legacy = (c.get("metadata") or {}).get("legacyId") or c.get("id")
                        neu.append(abbilden(c, art, alt.get(legacy, {})))
        except Exception as e:                          # Netz, Sperre oder geändertes Format
            print("FEHLER beim Abruf (%s): %s" % (status, e), file=sys.stderr)
            fehler = True
    if fehler or not neu:
        print("Abbruch: bestehende Daten bleiben unverändert.", file=sys.stderr)
        return 1
    os.makedirs(BILDER, exist_ok=True)
    behalten = set()
    for o in neu:
        ziel = os.path.join(ROOT, o["bild"])
        behalten.add(os.path.basename(ziel))
        quelle = o.get("bildQuelle")
        if quelle and not os.path.exists(ziel):
            try:
                os.makedirs(os.path.dirname(ziel), exist_ok=True)
                open(ziel, "wb").write(hole(quelle, binaer=True))
            except Exception as e:
                print("Bild nicht geladen (%s): %s" % (o["id"], e), file=sys.stderr)
    for f in os.listdir(BILDER):
        if f.endswith(".jpg") and f not in behalten:
            os.remove(os.path.join(BILDER, f))          # Bilder verkaufter Objekte entfernen
    neu.sort(key=lambda o: (o["vermarktung"] != "kauf",))
    alter_stand = {}
    if os.path.exists(DATEI):
        alter_stand = json.load(open(DATEI, encoding="utf-8"))
    ausgabe = {"stand": datetime.date.today().isoformat(), "quelle": PROFIL_URL,
               "hinweis": "Wird automatisch mit dem Immowelt-Profil von CMB Immobilien abgeglichen (tools/immowelt-sync.py, GitHub Actions). Nicht von Hand bearbeiten, ausser dem Feld 'zusatz'.",
               "objekte": neu}
    # Datum nur ändern, wenn sich Objekte geändert haben (vermeidet unnötige Commits)
    if alter_stand.get("objekte") == neu:
        ausgabe["stand"] = alter_stand.get("stand", ausgabe["stand"])
    json.dump(ausgabe, open(DATEI, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(DATEI, "a").write("\n")
    gone = set(alt) - {o["id"] for o in neu}
    new = {o["id"] for o in neu} - set(alt)
    print("%d Angebote, neu: %d, entfernt: %d" % (len(neu), len(new), len(gone)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
