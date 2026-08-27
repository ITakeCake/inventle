// report.js — "See something wrong?" report widget.
// Self-contained: injects its own modal and styles, wires any [data-report] element,
// and posts the report to the stats worker. Loaded on every page, so it assumes
// nothing about the page beyond document.body existing.
(function () {
  'use strict';

  var API = 'https://inventle-stats.blakexb.workers.dev/api/report';
  var built = false;

  var CSS =
    '#rp-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:none;' +
    'align-items:center;justify-content:center;padding:16px}' +
    '#rp-bg.show{display:flex}' +
    '#rp-box{background:var(--surface,#1e2128);border:2px solid var(--border,#374151);border-radius:14px;' +
    'max-width:420px;width:100%;padding:20px;color:var(--text,#f0f2f5);font-family:inherit}' +
    '#rp-box h3{margin:0 0 4px;font-size:1.05rem}' +
    '#rp-box p{margin:0 0 14px;font-size:.82rem;color:var(--text2,#a1aab8)}' +
    '#rp-box label{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:1px;' +
    'color:var(--text2,#a1aab8);margin:10px 0 4px}' +
    '#rp-box input,#rp-box textarea{width:100%;box-sizing:border-box;background:var(--input-bg,#12141a);' +
    'border:2px solid var(--border,#374151);border-radius:8px;color:inherit;padding:9px 10px;' +
    'font-size:.9rem;font-family:inherit}' +
    '#rp-box textarea{min-height:110px;resize:vertical}' +
    '#rp-box input:focus,#rp-box textarea:focus{outline:none;border-color:var(--right,#10b981)}' +
    '#rp-row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
    '#rp-row button{border:none;border-radius:8px;padding:9px 16px;font-size:.85rem;font-weight:700;' +
    'cursor:pointer;font-family:inherit}' +
    '#rp-cancel{background:transparent;border:2px solid var(--border,#374151)!important;color:var(--text2,#a1aab8)}' +
    '#rp-send{background:var(--right,#10b981);color:#04221a}' +
    '#rp-send:disabled{opacity:.5;cursor:default}' +
    '#rp-note{font-size:.8rem;margin-top:10px;min-height:1em}' +
    '#rp-note.err{color:#f87171}#rp-note.ok{color:var(--right,#10b981)}' +
    '#rp-hp{position:absolute;left:-9999px;opacity:0;height:1px;overflow:hidden}' +
    '#rp-page{display:inline-block;background:var(--input-bg,#12141a);border:1px solid var(--border,#374151);' +
    'border-radius:6px;padding:4px 10px;font-size:.75rem;color:var(--text2,#a1aab8);font-family:monospace;' +
    'margin-bottom:4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';

  function build() {
    if (built) return;
    built = true;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var bg = document.createElement('div');
    bg.id = 'rp-bg';
    bg.innerHTML =
      '<div id="rp-box" role="dialog" aria-modal="true" aria-labelledby="rp-title">' +
      '<h3 id="rp-title">See something wrong?</h3>' +
      '<p>Wrong year, typo, broken page — tell us and we’ll fix it.</p>' +
      '<div id="rp-page"></div>' +
      '<label for="rp-email">Your email</label>' +
      '<input id="rp-email" type="email" autocomplete="email" placeholder="you@example.com">' +
      '<label for="rp-msg">What’s wrong?</label>' +
      '<textarea id="rp-msg" maxlength="1000" placeholder="The year for X looks wrong because…"></textarea>' +
      '<div id="rp-hp"><label>Website<input id="rp-web" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="rp-note"></div>' +
      '<div id="rp-row"><button id="rp-cancel">Cancel</button><button id="rp-send">Send report</button></div>' +
      '</div>';
    document.body.appendChild(bg);

    var note = bg.querySelector('#rp-note'), send = bg.querySelector('#rp-send');
    function close() { bg.classList.remove('show'); }
    bg.querySelector('#rp-cancel').onclick = close;
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    send.onclick = function () {
      var email = bg.querySelector('#rp-email').value.trim();
      var msg = bg.querySelector('#rp-msg').value.trim();
      note.className = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { note.textContent = 'A real email address is required.'; note.className = 'err'; return; }
      if (msg.length < 10) { note.textContent = 'Please describe the problem (at least 10 characters).'; note.className = 'err'; return; }
      send.disabled = true;
      note.textContent = 'Sending…';
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email, message: msg,
          page: location.pathname + location.search,
          website: bg.querySelector('#rp-web').value   // honeypot
        })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.ok) {
            note.textContent = 'Thank you — report sent.';
            note.className = 'ok';
            bg.querySelector('#rp-msg').value = '';
            setTimeout(close, 1400);
          } else {
            note.textContent = res.j.error || 'Could not send — try again later.';
            note.className = 'err';
          }
          send.disabled = false;
        })
        .catch(function () {
          note.textContent = 'Network error — try again later.';
          note.className = 'err';
          send.disabled = false;
        });
    };
  }

  function open() {
    build();
    // shows the page path that is submitted with the report
    var pg = document.getElementById('rp-page');
    if (pg) pg.textContent = 'Reporting: ' + location.pathname;
    document.getElementById('rp-bg').classList.add('show');
    var em = document.getElementById('rp-email');
    if (em && !em.value) em.focus();
  }

  // wires every [data-report] trigger present in the page
  function wire() {
    var els = document.querySelectorAll('[data-report]');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function (e) { e.preventDefault(); open(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.INVENTLE_REPORT = { open: open };
})();
