(function () {
  "use strict";
  var form = document.getElementById("schaden");
  if (!form) { return; }
  var err = document.getElementById("sd-err");
  var btn = document.getElementById("sd-senden");
  var fotos = document.getElementById("fotos");
  var liste = document.getElementById("foto-liste");
  var MAX = 5, MAXMB = 15;
  var gewaehlt = [];

  function msg(el, t) {
    var f = el.closest(".f"); if (!f) { return; }
    f.classList.toggle("bad", !!t);
    var m = f.querySelector(".msg"); if (m) { m.textContent = t || ""; }
    el.setAttribute("aria-invalid", t ? "true" : "false");
  }
  function check(el) {
    if (el.checkValidity()) { msg(el, ""); return true; }
    var v = el.validity, t = "Bitte prüfen Sie diese Angabe.";
    if (v.valueMissing) { t = el.tagName === "SELECT" ? "Bitte wählen Sie eine Option." : "Bitte ausfüllen."; }
    else if (v.typeMismatch) { t = "Bitte geben Sie eine gültige E-Mail-Adresse an."; }
    else if (v.patternMismatch) { t = "Bitte geben Sie eine gültige Telefonnummer an."; }
    msg(el, t); return false;
  }
  form.addEventListener("input", function (e) { var t = e.target; if (t.closest && t.closest(".f.bad")) { check(t); } });
  form.addEventListener("change", function (e) {
    if (e.target.name === "schadensart") { document.getElementById("schadensart-msg").textContent = ""; }
  });

  fotos.addEventListener("change", function () {
    gewaehlt = [].slice.call(fotos.files);
    liste.innerHTML = "";
    if (gewaehlt.length > MAX) { gewaehlt = gewaehlt.slice(0, MAX); li("Es werden die ersten " + MAX + " Bilder verwendet.", true); }
    gewaehlt.forEach(function (f) { li(f.name + " (" + (f.size / 1048576).toFixed(1).replace(".", ",") + " MB)", false); });
  });
  function li(t, bad) { var l = document.createElement("li"); l.textContent = t; if (bad) { l.className = "bad"; } liste.appendChild(l); }

  /* Bild verkleinern (max. 1800 px, JPEG), damit der Versand schnell und klein bleibt */
  function verkleinern(file) {
    return new Promise(function (res) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { res(file); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1800 / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  function fertig(text) {
    form.hidden = true;
    var o = document.getElementById("sd-ok"); o.hidden = false;
    if (text) { document.getElementById("sd-ok-text").innerHTML = text; }
    o.querySelector("h3").focus();
    var top = o.getBoundingClientRect().top + scrollY - 120; scrollTo({ top: top });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true, first = null;
    form.querySelectorAll("input[required],select[required],textarea[required]").forEach(function (el) {
      if (!check(el)) { ok = false; first = first || el; }
    });
    var tel = document.getElementById("sd-tel"); if (tel.value && !check(tel)) { ok = false; first = first || tel; }
    var arten = [].slice.call(form.querySelectorAll('input[name="schadensart"]:checked')).map(function (i) { return i.value; });
    if (!arten.length) { document.getElementById("schadensart-msg").textContent = "Bitte wählen Sie mindestens eine Schadensart."; ok = false; first = first || form.querySelector('input[name="schadensart"]'); }
    if (!form.datenschutz.checked) { err.textContent = "Bitte stimmen Sie der Datenschutzerklärung zu."; ok = false; first = first || form.datenschutz; } else if (ok) { err.textContent = ""; }
    if (!ok) { if (first) { first.focus(); } return; }

    var key = form.access_key.value;
    if (!key || key.indexOf("HIER") === 0) { err.textContent = "Das Formular ist noch nicht freigeschaltet. Bitte rufen Sie uns an: 0 21 04 - 17 50 52."; return; }

    var data = {
      access_key: key, from_name: form.from_name.value, name: form.name.value, email: form.email.value,
      subject: "Neue Anfrage Schadenbeurteilung: " + form.immobilienart.value + " in " + form.standort.value + " (" + form.name.value + ")",
      "Immobilienart": form.immobilienart.value, "Standort / PLZ": form.standort.value,
      "Schadensart": arten.join(", "), "Anlass der Beurteilung": form.anlass.value,
      "Schadensbeschreibung": form.beschreibung.value, "Telefon": tel.value, "Datenschutz": "akzeptiert"
    };
    if (form.erreichbar.value) { data["Beste Erreichbarkeit"] = form.erreichbar.value; }
    if (form.botcheck.checked) { data.botcheck = "1"; }
    if (gewaehlt.length) { data["Fotos"] = gewaehlt.length + " Bild(er) angehängt"; }

    btn.disabled = true; var label = btn.textContent; btn.textContent = "Wird gesendet …"; err.textContent = "";

    function json(d) {
      return fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(d) })
        .then(function (r) { return r.json().then(function (j) { return r.ok && j.success; }); });
    }
    function mitFotos() {
      return Promise.all(gewaehlt.map(verkleinern)).then(function (dateien) {
        var fd = new FormData();
        Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
        dateien.forEach(function (f, i) { fd.append("attachment", f, f.name || ("foto-" + (i + 1) + ".jpg")); });
        return fetch("https://api.web3forms.com/submit", { method: "POST", headers: { Accept: "application/json" }, body: fd })
          .then(function (r) { return r.json().then(function (j) { return r.ok && j.success; }); });
      });
    }

    var weg = gewaehlt.length ? mitFotos().catch(function () { return false; }) : Promise.resolve(false);
    weg.then(function (ok1) {
      if (ok1) { fertig(); return; }
      var d2 = {}; Object.keys(data).forEach(function (k) { d2[k] = data[k]; });
      var ohneFotos = gewaehlt.length > 0;
      if (ohneFotos) { d2["Fotos"] = "Der Kunde wollte " + gewaehlt.length + " Foto(s) senden, sie konnten nicht übertragen werden. Bitte per E-Mail nachfordern."; }
      return json(d2).then(function (ok2) {
        if (!ok2) { throw new Error("x"); }
        fertig(ohneFotos ? "Ihre Angaben sind angekommen, nur die Fotos konnten nicht übertragen werden. Bitte senden Sie die Bilder kurz per E-Mail an <a href=\"mailto:info@cmb-immobilien.com\">info@cmb-immobilien.com</a>. Wir melden uns schnellstmöglich bei Ihnen." : "");
      });
    }).catch(function () {
      err.textContent = "Das Senden hat leider nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie an info@cmb-immobilien.com.";
      btn.disabled = false; btn.textContent = label;
    });
  });
})();
