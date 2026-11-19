(function () {
  "use strict";
  /* Filter */
  var fb = document.querySelectorAll(".ref-btn"), karten = document.querySelectorAll(".ref");
  fb.forEach(function (x) {
    x.addEventListener("click", function () {
      fb.forEach(function (y) { y.setAttribute("aria-pressed", y === x ? "true" : "false"); });
      karten.forEach(function (c) { c.hidden = x.dataset.f !== "alle" && c.dataset.art !== x.dataset.f; });
    });
  });

  /* Galerie im Fenster */
  document.querySelectorAll(".ref-dlg").forEach(function (dlg) {
    var bilder = JSON.parse(dlg.dataset.bilder || "[]"), i = 0;
    var img = dlg.querySelector(".dlg-bild"), zaehler = dlg.querySelector(".dlg-zaehler"), streifen = dlg.querySelector(".dlg-streifen");
    var thumbs = bilder.map(function (src, n) {
      var b = document.createElement("button"); b.type = "button"; b.className = "dlg-thumb"; b.setAttribute("aria-label", "Foto " + (n + 1) + " anzeigen");
      var t = document.createElement("img"); t.alt = ""; t.loading = "lazy"; t.src = src; b.appendChild(t);
      b.addEventListener("click", function () { zeige(n); }); streifen.appendChild(b); return b;
    });
    function zeige(n) {
      i = (n + bilder.length) % bilder.length;
      img.src = bilder[i];
      zaehler.textContent = (i + 1) + " / " + bilder.length;
      thumbs.forEach(function (t, k) { t.classList.toggle("aktiv", k === i); if (k === i) { t.setAttribute("aria-current", "true"); try { streifen.scrollTo({ left: t.offsetLeft - streifen.clientWidth / 2 + t.clientWidth / 2, behavior: "smooth" }); } catch (e) {} } else { t.removeAttribute("aria-current"); } });
      var nx = new Image(); nx.src = bilder[(i + 1) % bilder.length];
    }
    dlg.querySelector(".dlg-vor").addEventListener("click", function () { zeige(i + 1); });
    dlg.querySelector(".dlg-zurueck").addEventListener("click", function () { zeige(i - 1); });
    dlg.querySelector(".dlg-x").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) { dlg.close(); } });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { zeige(i + 1); } else if (e.key === "ArrowLeft") { zeige(i - 1); }
    });
    dlg.addEventListener("close", function () { document.documentElement.classList.remove("dlg-offen"); });
    var x0 = null, bx = dlg.querySelector(".dlg-bildbox");
    bx.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    bx.addEventListener("touchend", function (e) { if (x0 === null) { return; } var d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) { zeige(d < 0 ? i + 1 : i - 1); } x0 = null; }, { passive: true });
    dlg._zeige = zeige;
  });
  document.querySelectorAll(".ref-karte").forEach(function (k) {
    k.addEventListener("click", function () {
      var d = document.getElementById(k.dataset.dlg); if (!d) { return; }
      document.documentElement.classList.add("dlg-offen");
      if (d.showModal) { d.showModal(); } else { d.setAttribute("open", ""); }
      d._zeige(0); var x = d.querySelector(".dlg-info"); if (x) { x.scrollTop = 0; }
    });
  });
})();
