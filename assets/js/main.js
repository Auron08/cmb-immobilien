(function () {
  "use strict";

  /* Mobile-Menü */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("hauptmenue");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* Jahr im Footer */
  var year = document.getElementById("jahr");
  if (year) { year.textContent = new Date().getFullYear(); }

  /* Anker auf Orte: passendes <details> öffnen */
  function openTownFromHash() {
    if (!location.hash) { return; }
    var el = document.querySelector(location.hash);
    if (el && el.tagName === "DETAILS") { el.open = true; }
  }
  openTownFromHash();
  window.addEventListener("hashchange", openTownFromHash);

  /* Kontaktformular (Web3Forms) */
  var form = document.getElementById("kontaktformular");
  if (!form) { return; }

  var select = form.querySelector("#anliegen");
  var params = new URLSearchParams(location.search);
  var wanted = params.get("anliegen");
  if (select && wanted) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value.toLowerCase() === wanted.toLowerCase()) {
        select.selectedIndex = i;
        break;
      }
    }
  }

  var status = document.getElementById("form-status");
  var button = form.querySelector('button[type="submit"]');

  function show(type, text) {
    status.className = "form-status " + type;
    status.textContent = text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var key = form.querySelector('input[name="access_key"]').value;
    if (!key || key.indexOf("HIER") === 0) {
      show("err", "Das Formular ist noch nicht freigeschaltet. Bitte rufen Sie uns an: 0173 - 5420100.");
      return;
    }
    if (!form.reportValidity()) { return; }

    var data = {};
    new FormData(form).forEach(function (value, name) { data[name] = value; });
    data.subject = "Neue Anfrage über die Website: " + (data.anliegen || "Kontakt");

    button.disabled = true;
    var label = button.textContent;
    button.textContent = "Wird gesendet …";
    show("", "");

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) { return res.json().then(function (json) { return { ok: res.ok && json.success, json: json }; }); })
      .then(function (result) {
        if (result.ok) {
          form.reset();
          show("ok", "Vielen Dank, Ihre Nachricht ist bei uns angekommen. Wir melden uns schnellstmöglich bei Ihnen.");
        } else {
          throw new Error("send failed");
        }
      })
      .catch(function () {
        show("err", "Das Senden hat leider nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie an info@cmb-immobilien.com.");
      })
      .then(function () {
        button.disabled = false;
        button.textContent = label;
      });
  });
})();
