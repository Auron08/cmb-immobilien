(function () {
  "use strict";
  var form = document.getElementById("anfrage");
  if (!form) { return; }
  var steps = [].slice.call(form.querySelectorAll(".step"));
  var bars = [].slice.call(document.querySelectorAll(".progress li"));
  var next = document.getElementById("weiter");
  var back = document.getElementById("zurueck");
  var errBox = document.getElementById("form-err");
  var cur = 0;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function anliegen() { var c = form.querySelector('input[name="anliegen"]:checked, input[type="hidden"][name="anliegen"]'); return c ? c.value : ""; }

  function groups() {
    var a = anliegen();
    form.querySelectorAll(".grp").forEach(function (g) {
      var on = (g.getAttribute("data-for") || "").split(" ").indexOf(a) > -1;
      g.hidden = !on;
      g.querySelectorAll("input,textarea").forEach(function (i) { i.disabled = !on; });
    });
    var b = document.getElementById("budget-label"), bi = document.getElementById("budget");
    if (b && bi) {
      b.textContent = a === "Miete" ? "Kaltmiete bis ca." : "Budget ca.";
      bi.placeholder = " ";
    }
    var hint = document.getElementById("step2-title");
    if (hint) { hint.textContent = { Verkauf: "Erzählen Sie uns kurz von Ihrer Immobilie", Bewertung: "Welche Immobilie sollen wir bewerten?", Vermietung: "Was möchten Sie vermieten?", Verwaltung: "Welche Immobilie sollen wir verwalten?", Kauf: "Was suchen Sie?", Miete: "Was suchen Sie?", Sonstiges: "Wie können wir helfen?" }[a] || "Details"; }
  }

  function show(n, dir) {
    cur = n;
    steps.forEach(function (s, i) {
      s.hidden = i !== n;
      if (i === n) { s.classList.toggle("back", dir < 0); }
    });
    bars.forEach(function (b, i) { b.classList.toggle("on", i === n); b.classList.toggle("done", i < n); });
    back.hidden = n === 0;
    next.textContent = n === steps.length - 1 ? "Anfrage senden" : "Weiter";
    next.hidden = n === 0 && !anliegen();
    var t = steps[n].querySelector(".step-title");
    if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
    var top = form.getBoundingClientRect().top + scrollY - 110;
    if (top < scrollY) { scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" }); }
  }

  function fieldMsg(el, text) {
    var f = el.closest(".f"); if (!f) { return; }
    f.classList.toggle("bad", !!text);
    var m = f.querySelector(".msg"); if (m) { m.textContent = text || ""; }
    el.setAttribute("aria-invalid", text ? "true" : "false");
  }
  function check(el) {
    if (el.disabled || !el.willValidate) { return true; }
    if (el.checkValidity()) { fieldMsg(el, ""); return true; }
    var v = el.validity, t = "Bitte prüfen Sie diese Angabe.";
    if (v.valueMissing) { t = "Bitte ausfüllen."; }
    else if (v.typeMismatch && el.type === "email") { t = "Bitte geben Sie eine gültige E-Mail-Adresse an."; }
    else if (v.patternMismatch) { t = el.type === "tel" ? "Bitte geben Sie eine gültige Telefonnummer an." : el.name === "plz" ? "Bitte eine 5-stellige PLZ eingeben." : "Bitte nur Zahlen eingeben."; }
    fieldMsg(el, t);
    return false;
  }
  function validStep(n) {
    var ok = true, first = null;
    if (n === 0 && !anliegen()) { errBox.textContent = "Bitte wählen Sie ein Anliegen."; return false; }
    steps[n].querySelectorAll("input,textarea").forEach(function (el) {
      if (el.closest(".grp") && el.closest(".grp").hidden) { return; }
      if (el.type === "radio") {
        if (el.required && !form.querySelector('input[name="' + el.name + '"]:checked')) { ok = false; errBox.textContent = el.getAttribute("data-msg") || "Bitte wählen Sie eine Option."; first = first || el; }
        return;
      }
      if (el.type === "checkbox" && el.name === "datenschutz") {
        if (!el.checked) { ok = false; errBox.textContent = "Bitte stimmen Sie der Datenschutzerklärung zu."; first = first || el; }
        return;
      }
      if (!check(el)) { ok = false; first = first || el; }
    });
    if (ok) { errBox.textContent = ""; } else if (first) { first.focus(); }
    return ok;
  }

  form.addEventListener("input", function (e) { var t = e.target; if (t.closest && t.closest(".f.bad")) { check(t); } });
  form.addEventListener("focusout", function (e) { var t = e.target; if (t.closest && t.closest(".f") && t.value) { check(t); } });

  /* Anliegen-Karten: Klick springt direkt weiter */
  form.querySelectorAll('input[name="anliegen"]').forEach(function (r) {
    r.addEventListener("change", function () { groups(); errBox.textContent = ""; next.hidden = false; });
    r.parentNode.addEventListener("click", function (e) {
      if (e.pointerType) { setTimeout(function () { if (cur === 0 && anliegen()) { go(1); } }, 260); }
    });
  });

  function go(d) {
    if (d > 0 && !validStep(cur)) { return; }
    var n = Math.max(0, Math.min(steps.length - 1, cur + d));
    if (n !== cur) { groups(); show(n, d); }
  }
  next.addEventListener("click", function () { if (cur === steps.length - 1) { form.requestSubmit(); } else { go(1); } });
  back.addEventListener("click", function () { go(-1); });
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") {
      e.preventDefault();
      if (cur === steps.length - 1) { form.requestSubmit(); } else { go(1); }
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validStep(cur)) { return; }
    var key = form.querySelector('input[name="access_key"]').value;
    if (!key || key.indexOf("HIER") === 0) {
      errBox.textContent = "Das Formular ist noch nicht freigeschaltet. Bitte rufen Sie uns an: 0 21 04 - 17 50 52.";
      return;
    }
    var raw = {};
    new FormData(form).forEach(function (v, k) { if (v !== "") { raw[k] = v; } });
    var L = { stand: "Aktueller Stand", frei_ab: "Frei ab / Kündigung zum", tempo: "Gewünschter Vermietungsbeginn", wunschmiete: "Wunschmiete kalt (€)", anliegen: "Anliegen", objektart: "Art der Immobilie", gesucht: "Gesuchte Art", strasse: "Straße", plz: "PLZ", ort: "Ort", wunschort: "Wunschort", wohnflaeche: "Wohn-/Nutzfläche (m²)", grundstueck: "Grundstücksfläche (m²)", zimmer: "Zimmer", wunschpreis: "Wunschpreis (€)", budget: "Budget / Kaltmiete", zeitrahmen: "Zeitrahmen", erreichbar: "Am besten erreichbar", rueckmeldung: "Bevorzugter Kontakt", nachricht: "Nachricht", telefon: "Telefon", datenschutz: "Datenschutz" };
    var data = { access_key: raw.access_key, from_name: raw.from_name };
    data.name = raw.name || [raw.vorname, raw.nachname].filter(Boolean).join(" ");
    data.email = raw.email;
    ["telefon", "erreichbar", "rueckmeldung", "anliegen", "objektart", "gesucht", "strasse", "plz", "ort", "wunschort", "wohnflaeche", "grundstueck", "zimmer", "wunschpreis", "wunschmiete", "budget", "stand", "frei_ab", "tempo", "zeitrahmen", "nachricht", "datenschutz"].forEach(function (k) { if (raw[k]) { data[L[k]] = raw[k]; } });
    if (raw.botcheck) { data.botcheck = raw.botcheck; }
    var pre = form.getAttribute("data-subject");
    data.subject = pre
      ? pre + ": " + [raw.objektart, raw.ort].filter(Boolean).join(" in ") + (data.name ? " (" + data.name + ")" : "")
      : "Neue Anfrage über die Website: " + (raw.anliegen || "Kontakt") + (data.name ? " (" + data.name + ")" : "");
    next.disabled = true; var label = next.textContent; next.textContent = "Wird gesendet …"; errBox.textContent = "";
    fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return r.ok && j.success; }); })
      .then(function (ok) {
        if (!ok) { throw new Error("x"); }
        form.hidden = true; document.getElementById("progress").hidden = true;
        var o = document.getElementById("ok"); o.hidden = false; o.querySelector("h3").focus();
      })
      .catch(function () {
        errBox.textContent = "Das Senden hat leider nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie an info@cmb-immobilien.com.";
        next.disabled = false; next.textContent = label;
      });
  });

  /* Bedingte Felder: data-when="name=wert1|wert2" */
  function whens() {
    form.querySelectorAll("[data-when]").forEach(function (el) {
      var p = el.getAttribute("data-when").split("="), c = form.querySelector('input[name="' + p[0] + '"]:checked');
      var on = !!c && p[1].split("|").indexOf(c.value) > -1;
      el.hidden = !on;
      el.querySelectorAll("input").forEach(function (i) { i.disabled = !on; });
    });
  }
  form.addEventListener("change", whens); whens();

  var wf = document.getElementById("wohnflaeche");
  if (wf) {
    form.querySelectorAll('input[name="objektart"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var grund = r.hasAttribute("data-nowf");
        wf.required = !grund;
        document.getElementById("wf-label").textContent = grund ? "Wohnfläche in m² (entfällt)" : "Wohn- / Nutzfläche in m² *";
        wf.disabled = grund; if (grund) { wf.value = ""; fieldMsg(wf, ""); }
      });
    });
  }

  /* Vorauswahl über ?anliegen= (Buttons der Seite) */
  var want = new URLSearchParams(location.search).get("anliegen");
  if (want) {
    var r = form.querySelector('input[name="anliegen"][value="' + want.replace(/"/g, "") + '"]');
    if (r) { r.checked = true; groups(); show(1, 1); return; }
  }
  groups(); show(0, 1);
})();
