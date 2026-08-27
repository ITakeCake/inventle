// settings-page.js — Standalone settings for auxiliary pages (about, privacy, etc.)
// Provides theme/scheme/language switching without requiring core.js or game.js
;(function() {
  'use strict';

  var PK = 'wi_prefs';

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch(e) { return {}; }
  }

  function savePrefs(p) {
    localStorage.setItem(PK, JSON.stringify(p));
  }

  // Header sound button. Aux pages do not load core.js or sound.js, but the sound
  // pref is global, so the control is reimplemented here.
  var SND_ICON_ON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>';
  var SND_ICON_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

  function syncSoundBtn() {
    var b = document.getElementById('btn-sound');
    if (!b) return;
    var on = loadPrefs().sound !== false;
    b.innerHTML = on ? SND_ICON_ON : SND_ICON_OFF;
    b.title = on ? 'Mute sound' : 'Unmute sound';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', on ? 'false' : 'true');
    b.classList.toggle('muted', !on);
    var t = document.getElementById('set-sound');
    if (t) t.checked = on;
  }

  function setTheme(t) { document.body.setAttribute('data-theme', t); }
  function setScheme(s) { document.body.setAttribute('data-scheme', s); }

  function openSettings() {
    var p = loadPrefs();
    document.getElementById('set-dark').checked = (p.theme || 'dark') === 'dark';
    // syncs spin/glow toggles so the prefs persist from aux pages
    var spin = document.getElementById('set-spin');
    var glow = document.getElementById('set-glow');
    if (spin) spin.checked = p.spin !== false;
    if (glow) glow.checked = p.glow !== false;
    var schemeBtnToggle = document.getElementById('set-scheme-btn');
    if (schemeBtnToggle) schemeBtnToggle.checked = p.schemeBtn === true;
    var sndToggle = document.getElementById('set-sound');
    if (sndToggle) sndToggle.checked = p.sound !== false;
    var rainbowToggle = document.getElementById('set-rainbow');
    if (rainbowToggle) rainbowToggle.checked = p.rainbow === true;
    var btns = document.querySelectorAll('.scheme-btn[data-scheme]');
    btns.forEach(function(b) { b.classList.toggle('active', parseInt(b.getAttribute('data-scheme')) === (p.scheme || 0)); });
    // Background theme buttons
    var bgBtns = document.getElementById('bg-theme-btns');
    if (bgBtns) {
      bgBtns.querySelectorAll('.scheme-btn').forEach(function(b) {
        b.classList.toggle('active', (b.getAttribute('data-bg-theme') || '') === (p.bgTheme || ''));
      });
    }
    document.getElementById('m-settings').classList.add('show');
  }

  function wireSettings() {
    var btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.onclick = openSettings;

    var xSettings = document.getElementById('x-settings');
    if (xSettings) xSettings.onclick = function() { document.getElementById('m-settings').classList.remove('show'); };

    // Close modal on overlay click
    var modalBg = document.getElementById('m-settings');
    if (modalBg) {
      modalBg.onclick = function(e) {
        if (e.target === modalBg) modalBg.classList.remove('show');
      };
    }

    // Dark mode toggle
    var darkToggle = document.getElementById('set-dark');
    if (darkToggle) {
      darkToggle.onchange = function() {
        var p = loadPrefs();
        p.theme = this.checked ? 'dark' : 'light';
        savePrefs(p);
        setTheme(p.theme);
      };
    }

    // Color scheme buttons
    document.querySelectorAll('.scheme-btn[data-scheme]').forEach(function(b) {
      b.onclick = function() {
        var s = parseInt(this.getAttribute('data-scheme'));
        var p = loadPrefs();
        p.scheme = s;
        savePrefs(p);
        setScheme(s);
        document.querySelectorAll('.scheme-btn[data-scheme]').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
      };
    });

    // Header sound button + the Sound Effects switch: one pref, two faces
    var soundBtn = document.getElementById('btn-sound');
    if (soundBtn) soundBtn.onclick = function() {
      var p = loadPrefs(); p.sound = (p.sound === false); savePrefs(p); syncSoundBtn();
    };
    var sndSwitch = document.getElementById('set-sound');
    if (sndSwitch) sndSwitch.onchange = function() {
      var p = loadPrefs(); p.sound = this.checked; savePrefs(p); syncSoundBtn();
    };
    syncSoundBtn();

    // Spin toggle
    var spinToggle = document.getElementById('set-spin');
    if (spinToggle) {
      spinToggle.onchange = function() { var p = loadPrefs(); p.spin = this.checked; savePrefs(p); };
    }

    // Glow toggle
    var glowToggle = document.getElementById('set-glow');
    if (glowToggle) {
      glowToggle.onchange = function() { var p = loadPrefs(); p.glow = this.checked; savePrefs(p); };
    }

    // Rainbow toggle
    var rainbowToggle = document.getElementById('set-rainbow');
    if (rainbowToggle) {
      rainbowToggle.onchange = function() {
        var p = loadPrefs();
        p.rainbow = this.checked;
        savePrefs(p);
        var el = document.querySelector('.logo-stats-text');
        if (el) el.classList.toggle('no-rainbow', !this.checked);
      };
    }

    // Color blind header button (cycle through schemes)
    var btnScheme = document.getElementById('btn-scheme');
    if (btnScheme) {
      btnScheme.onclick = function() {
        var p = loadPrefs();
        var s = ((p.scheme || 0) + 1) % 4;
        p.scheme = s;
        savePrefs(p);
        setScheme(s);
        document.querySelectorAll('.scheme-btn[data-scheme]').forEach(function(x) {
          x.classList.toggle('active', parseInt(x.getAttribute('data-scheme')) === s);
        });
      };
    }

    // Color blind button toggle (in settings modal)
    var schemeBtnToggle = document.getElementById('set-scheme-btn');
    if (schemeBtnToggle) {
      schemeBtnToggle.onchange = function() {
        var p = loadPrefs();
        p.schemeBtn = this.checked;
        savePrefs(p);
        var sb = document.getElementById('btn-scheme');
        if (sb) sb.style.display = this.checked ? '' : 'none';
      };
    }

    // Background theme buttons
    var bgBtns = document.getElementById('bg-theme-btns');
    if (bgBtns) {
      bgBtns.querySelectorAll('.scheme-btn').forEach(function(b) {
        b.onclick = function() {
          var theme = this.getAttribute('data-bg-theme');
          var p = loadPrefs();
          p.bgTheme = theme || '';
          savePrefs(p);
          if (theme) document.body.setAttribute('data-bg-theme', theme);
          else document.body.removeAttribute('data-bg-theme');
          bgBtns.querySelectorAll('.scheme-btn').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
        };
      });
    }

    // Language selector
    var sel = document.getElementById('lang-select');
    if (sel && window.I18N) {
      var langs = I18N.languages;
      sel.innerHTML = '';
      for (var i = 0; i < langs.length; i++) {
        var opt = document.createElement('option');
        opt.value = langs[i].code;
        opt.textContent = langs[i].name;
        if (langs[i].code === I18N.getLang()) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = function() {
        I18N.setLang(this.value);
      };
    }

    // Re-update lang selector on language change
    document.addEventListener('langchange', function() {
      var sel = document.getElementById('lang-select');
      if (sel && window.I18N) sel.value = I18N.getLang();
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSettings);
  } else {
    wireSettings();
  }
})();
