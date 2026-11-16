#!/usr/bin/env python3
"""Liest objekte.xlsx und schreibt data/objekte.json.  Aufruf: python excel-zu-json.py
Voraussetzung: pip install openpyxl. Bilder: Datei in assets/img/objekte/<ID>.jpg ablegen."""
import json, os, datetime
from openpyxl import load_workbook

HIER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HIER)
SPALTEN = ["id","vermarktung","titel","zusatz","status","preis","preisAlt","preisart","zimmer","wohnflaeche",
           "grundstueck","gewerbeflaeche","geschoss","verfuegbar","adresse","stadtteil","plz","ort","immoweltUrl"]
ZAHLEN = {"preis","preisAlt","zimmer","wohnflaeche","grundstueck"}

ws = load_workbook(os.path.join(ROOT, "objekte.xlsx"), data_only=True)["Objekte"]
kopf = [str(c.value).strip() if c.value else "" for c in ws[1]]
objekte = []
for row in ws.iter_rows(min_row=2, values_only=True):
    d = dict(zip(kopf, row))
    if not d.get("titel"):
        continue
    if str(d.get("aktiv", "ja")).strip().lower() in ("nein", "n", "0"):
        continue
    o = {}
    for k in SPALTEN:
        v = d.get(k)
        if v is None or str(v).strip() == "":
            continue
        if k in ZAHLEN:
            v = float(str(v).replace(",", ".")); v = int(v) if v == int(v) else v
        else:
            v = str(v).strip()
        o[k] = v
    if "id" not in o and "immoweltUrl" in o:
        o["id"] = o["immoweltUrl"].rstrip("/").split("/")[-1]
    o["bild"] = f"assets/img/objekte/{o['id']}.jpg"
    objekte.append(o)

out = {"stand": datetime.date.today().isoformat(), "quelle": "objekte.xlsx", "objekte": objekte}
with open(os.path.join(ROOT, "data", "objekte.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"{len(objekte)} Objekte nach data/objekte.json geschrieben.")
