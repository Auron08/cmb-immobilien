(function () {
  "use strict";
  var form = document.getElementById("suchform");
  var q = document.getElementById("suche");
  var grid = document.getElementById("objekte");
  var tabs = document.querySelectorAll(".tabs button");
  var count = document.getElementById("objekte-anzahl");
  var titel = document.getElementById("obj-titel");
  var liste = document.getElementById("sb-liste");
  var PROFIL = grid ? grid.getAttribute("data-profil") : "";
  var alle = [], art = "alle", geklickt = null, aktiv = -1;
  var ORTE = ["Mettmann", "Wülfrath", "Solingen", "Düsseldorf", "Wuppertal", "Ratingen", "Haan", "Erkrath", "Velbert", "Hilden", "Langenfeld", "Dortmund"];

  function eur(n) { return n.toLocaleString("de-DE") + " €"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function zahl(n) { return String(n).replace(".", ","); }
  function norm(s) { return String(s || "").toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  function card(o) {
    var preis = o.preis == null ? esc(o.preisart) : eur(o.preis) + (o.vermarktung === "miete" ? " <small>kalt</small>" : "") + (o.preisAlt ? "<s>" + eur(o.preisAlt) + "</s>" : "");
    var meta = [];
    if (o.zimmer) { meta.push(zahl(o.zimmer) + " Zi."); }
    if (o.wohnflaeche) { meta.push(zahl(o.wohnflaeche) + " m²"); }
    if (o.gewerbeflaeche) { meta.push(esc(o.gewerbeflaeche)); }
    if (o.grundstueck) { meta.push(zahl(o.grundstueck) + " m² Grundstück"); }
    if (o.geschoss) { meta.push("Etage " + esc(o.geschoss)); }
    var ort = [o.adresse, [o.plz, o.ort].join(" ") + (o.stadtteil ? ", " + o.stadtteil : "")].filter(Boolean).join(" · ");
    return '<a class="objekt" href="' + esc(o.immoweltUrl) + '" target="_blank" rel="noopener">' +
      '<div class="objekt-bild"><span class="platz">CMB Immobilien</span>' +
      '<img src="' + esc(o.bild) + '" data-fallback="' + esc(o.bildQuelle || "") + '" alt="' + esc(o.titel + ", " + o.ort) + '" loading="lazy" referrerpolicy="no-referrer">' +
      (o.status ? '<span class="objekt-badge">' + esc(o.status) + "</span>" : "") +
      '<span class="objekt-badge objekt-badge--art">' + (o.vermarktung === "miete" ? "Miete" : "Kauf") + "</span></div>" +
      '<div class="objekt-text"><div class="objekt-preis">' + preis + "</div>" +
      '<h3 class="objekt-titel">' + esc(o.titel) + (o.zusatz ? " – " + esc(o.zusatz) : "") + "</h3>" +
      '<p class="objekt-ort">' + esc(ort) + "</p>" +
      '<p class="objekt-meta">' + (meta.join(" · ") || "Details bei Immowelt") + "</p></div></a>";
  }

  function setTabs() {
    tabs.forEach(function (x) { x.setAttribute("aria-pressed", x.value === art ? "true" : "false"); });
  }

  function render() {
    if (!grid) { return; }
    var term = norm(q.value).trim();
    var list = alle.filter(function (o) {
      if (art !== "alle" && o.vermarktung !== art) { return false; }
      if (!term) { return true; }
      var hay = norm([o.titel, o.adresse, o.plz, o.ort, o.stadtteil, o.zusatz].join(" "));
      return term.split(/\s+/).every(function (t) { return hay.indexOf(t) > -1; });
    });
    var was = art === "kauf" ? "Kaufangebote" : art === "miete" ? "Mietangebote" : "Aktuelle Angebote";
    if (titel) { titel.textContent = was + (q.value.trim() ? " in " + q.value.trim() : ""); }
    document.title = was + (q.value.trim() ? " in " + q.value.trim() : "") + " | CMB Immobilien Mettmann";
    grid.innerHTML = list.length ? list.map(card).join("") :
      '<p class="objekte-leer">Aktuell haben wir ' + (q.value.trim() ? "für „" + esc(q.value.trim()) + "“ " : "") + 'keine passenden Angebote online. Rufen Sie uns an, wir haben oft Objekte, die noch nicht veröffentlicht sind: <a href="tel:+492104175052">0 21 04 - 17 50 52</a>. Oder <a href="' + esc(PROFIL) + '" target="_blank" rel="noopener">alle Angebote bei Immowelt ansehen</a>.</p>';
    if (count) { count.textContent = list.length + (list.length === 1 ? " Objekt" : " Objekte"); }
    setTabs();
  }

  function syncUrl() {
    if (!window.history || !history.replaceState) { return; }
    var p = [];
    if (art !== "alle") { p.push("art=" + art); }
    if (q.value.trim()) { p.push("ort=" + encodeURIComponent(q.value.trim())); }
    history.replaceState(null, "", location.pathname + (p.length ? "?" + p.join("&") : ""));
  }

  /* ---------- Vorschläge ---------- */
  function kandidaten() {
    var m = {};
    alle.forEach(function (o) {
      [[o.ort, o.ort], [o.stadtteil, o.stadtteil + ", " + o.ort]].forEach(function (x) {
        if (!x[0]) { return; }
        var k = norm(x[0]);
        if (!m[k]) { m[k] = { wert: x[0], label: x[1], n: 0 }; }
        m[k].n++;
      });
    });
    ORTE.forEach(function (n) { var k = norm(n); if (!m[k]) { m[k] = { wert: n, label: n, n: 0 }; } });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  function schliesse() { if (liste) { liste.hidden = true; liste.innerHTML = ""; } q.setAttribute("aria-expanded", "false"); aktiv = -1; }

  function zeige() {
    if (!liste) { return; }
    var t = norm(q.value).trim();
    if (!t) { schliesse(); return; }
    var treffer = kandidaten().filter(function (c) {
      return norm(c.label).split(/[\s,\-]+/).some(function (w) { return w.indexOf(t) === 0; }) && norm(c.wert) !== t;
    }).sort(function (a, b) { return (norm(a.label).indexOf(t) !== 0) - (norm(b.label).indexOf(t) !== 0) || (b.n > 0) - (a.n > 0) || a.label.localeCompare(b.label, "de"); }).slice(0, 6);
    if (!treffer.length) { schliesse(); return; }
    liste.innerHTML = treffer.map(function (c, i) {
      return '<li role="option" id="sb-o' + i + '" data-wert="' + esc(c.wert) + '"><span>' + esc(c.label) + "</span>" + (c.n ? "<small>" + c.n + (c.n === 1 ? " Angebot" : " Angebote") + "</small>" : "") + "</li>";
    }).join("");
    liste.hidden = false; aktiv = -1;
    q.setAttribute("aria-expanded", "true");
  }

  function waehle(wert) { q.value = wert; schliesse(); absenden(); }

  function absenden() {
    if (grid) { render(); syncUrl(); var t = document.getElementById("angebote"); if (t) { t.scrollIntoView({ behavior: "smooth", block: "start" }); } }
    else { form.submit(); }
  }

  if (form && q) {
    q.addEventListener("input", zeige);
    q.addEventListener("blur", function () { setTimeout(schliesse, 150); });
    q.addEventListener("keydown", function (e) {
      if (!liste || liste.hidden) { return; }
      var o = liste.children;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        aktiv = (aktiv + (e.key === "ArrowDown" ? 1 : -1) + o.length) % o.length;
        Array.prototype.forEach.call(o, function (li, i) { li.setAttribute("aria-selected", i === aktiv ? "true" : "false"); });
        q.setAttribute("aria-activedescendant", "sb-o" + aktiv);
      } else if (e.key === "Enter" && aktiv > -1) {
        e.preventDefault(); waehle(o[aktiv].getAttribute("data-wert"));
      } else if (e.key === "Escape") { schliesse(); }
    });
    if (liste) { liste.addEventListener("mousedown", function (e) { var li = e.target.closest("li"); if (li) { e.preventDefault(); waehle(li.getAttribute("data-wert")); } }); }
    tabs.forEach(function (b) { b.addEventListener("click", function () { geklickt = b.value; }); });
    form.addEventListener("submit", function (e) {
      if (!grid) { return; }            /* Startseite: normal zur Angebote-Seite senden */
      e.preventDefault();
      if (geklickt) { art = geklickt; geklickt = null; }
      schliesse(); render(); syncUrl();
    });
  }

  /* Auf der Angebote-Seite: Werte aus der Adresse übernehmen (?art=kauf&ort=Solingen) */
  if (grid) {
    var sp = new URLSearchParams(location.search);
    var a0 = sp.get("art");
    if (a0 === "kauf" || a0 === "miete") { art = a0; }
    var h = { "#angebote-kaufen": "kauf", "#angebote-mieten": "miete" }[location.hash];
    if (h) { art = h; }
    if (sp.get("ort")) { q.value = sp.get("ort"); }
    setTabs();
  }

  if (form || grid) {
    fetch("data/objekte.json").then(function (r) { if (!r.ok) { throw 0; } return r.json(); })
      .then(function (d) { alle = d.objekte || []; render(); })
      .catch(function () {
        if (grid) { grid.innerHTML = '<p class="objekte-fehler">Die Objekte konnten nicht geladen werden. <a href="' + esc(PROFIL) + '" target="_blank" rel="noopener">Alle aktuellen Angebote bei Immowelt ansehen</a>.</p>'; }
      });
  }

  /* Kopfleiste wird nach dem Scrollen fest */
  var head = document.querySelector(".site-header");
  function solid() { if (head) { head.classList.toggle("solid", scrollY > 40); } }
  addEventListener("scroll", solid, { passive: true }); solid();
})();

/* Bild-Fallback: fehlt die lokale Datei, wird das Immowelt-Bild geladen, sonst bleibt der Platzhalter. */
document.addEventListener("error", function (e) {
  var img = e.target;
  if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-fallback")) { return; }
  var fb = img.getAttribute("data-fallback");
  img.removeAttribute("data-fallback");
  if (fb) { img.src = fb; } else { img.remove(); }
}, true);
