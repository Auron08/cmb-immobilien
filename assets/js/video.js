(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saver = navigator.connection && navigator.connection.saveData;

  /* Poster als Hintergrund bei reduzierter Bewegung / Datensparmodus */
  document.querySelectorAll(".vbg video").forEach(function (v) {
    if (reduced || saver) { v.parentNode.style.backgroundImage = "url(" + v.getAttribute("poster") + ")"; v.remove(); }
  });

  /* Videos erst laden und abspielen, wenn sichtbar; außerhalb pausieren (Akku, Daten) */
  var vids = document.querySelectorAll(".vbg video");
  if (vids.length && "IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.src) { v.src = v.getAttribute("data-src"); }
          var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
        } else if (v.src) { v.pause(); }
      });
    }, { rootMargin: "150px 0px" });
    vids.forEach(function (v) { vo.observe(v); });
  }

  /* Einblenden beim Scrollen (Objektkarten gestaffelt) */
  function watch() {
    if (!("IntersectionObserver" in window) || reduced) {
      document.querySelectorAll(".reveal,.objekt").forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    function scan() {
      document.querySelectorAll(".reveal:not(.in), .objekt:not(.in):not([data-w])").forEach(function (e, i) {
        if (e.classList.contains("objekt")) { e.style.setProperty("--d", (i % 3) * 0.08 + "s"); }
        e.setAttribute("data-w", "1"); io.observe(e);
      });
    }
    scan();
    var g = document.getElementById("objekte");
    if (g) { new MutationObserver(scan).observe(g, { childList: true }); }
  }
  watch();
})();
