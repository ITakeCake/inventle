// ====================================================================
// dev.js — Dev tools overlay for Inventle
// Load AFTER game.js or infinite.js
// Activate with ?dev=1 in the URL
// ====================================================================
(function() {
  if (!/[?&]dev=1/.test(window.location.search)) return;

  var isInfinite = typeof startNewRun === 'function';
  var isDaily = typeof _pn !== 'undefined' && !isInfinite;

  // ====== PANEL STYLES ======
  var style = document.createElement('style');
  style.textContent = [
    '#dev-panel {',
    '  position:fixed; bottom:0; left:0; right:0; z-index:9999;',
    '  background:rgba(0,0,0,0.92); border-top:2px solid #3b82f6;',
    '  padding:10px 12px; font-family:system-ui,sans-serif; font-size:12px;',
    '  color:#e0e0e0; backdrop-filter:blur(8px);',
    '  transition:transform 0.3s ease;',
    '}',
    '#dev-panel.collapsed { transform:translateY(calc(100% - 28px)); }',
    '#dev-toggle {',
    '  position:absolute; top:-28px; right:12px;',
    '  background:#3b82f6; color:#fff; border:none; border-radius:6px 6px 0 0;',
    '  padding:4px 12px; font-size:11px; font-weight:700; cursor:pointer;',
    '  font-family:system-ui,sans-serif; letter-spacing:0.5px;',
    '}',
    '#dev-panel .dev-section { margin-bottom:8px; }',
    '#dev-panel .dev-label {',
    '  font-size:10px; text-transform:uppercase; letter-spacing:1px;',
    '  color:#3b82f6; font-weight:700; margin-bottom:4px;',
    '}',
    '#dev-panel .dev-row { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:4px; }',
    '#dev-panel button.dev-btn {',
    '  background:#1e2128; border:1px solid #374151; color:#e0e0e0;',
    '  padding:5px 10px; border-radius:6px; font-size:11px; cursor:pointer;',
    '  font-family:system-ui,sans-serif; font-weight:600; white-space:nowrap;',
    '  transition:background 0.15s, border-color 0.15s;',
    '}',
    '#dev-panel button.dev-btn:hover { background:#2a2e37; border-color:#3b82f6; }',
    '#dev-panel button.dev-btn.danger { border-color:#ef4444; color:#f87171; }',
    '#dev-panel button.dev-btn.danger:hover { background:#371520; }',
    '#dev-info {',
    '  font-family:monospace; font-size:11px; color:#6b7280;',
    '  padding:4px 0; border-top:1px solid #374151; margin-top:6px;',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // ====== BUILD PANEL ======
  var panel = document.createElement('div');
  panel.id = 'dev-panel';

  var toggle = document.createElement('button');
  toggle.id = 'dev-toggle';
  toggle.textContent = 'DEV';
  toggle.onclick = function() { panel.classList.toggle('collapsed'); };
  panel.appendChild(toggle);

  function mkSection(label) {
    var s = document.createElement('div');
    s.className = 'dev-section';
    var l = document.createElement('div');
    l.className = 'dev-label';
    l.textContent = label;
    s.appendChild(l);
    var r = document.createElement('div');
    r.className = 'dev-row';
    s.appendChild(r);
    panel.appendChild(s);
    return r;
  }

  function mkBtn(row, label, onclick, danger) {
    var b = document.createElement('button');
    b.className = 'dev-btn' + (danger ? ' danger' : '');
    b.textContent = label;
    b.onclick = onclick;
    row.appendChild(b);
    return b;
  }

  // ====== ANSWER INFO ======
  var infoDiv = document.createElement('div');
  infoDiv.id = 'dev-info';
  function updateInfo() {
    var yr = _tb ? _ta + ' BC' : _ta + ' AD';
    var parts = ['Answer: ' + yr];
    if (_e.country) parts.push('Country: ' + (_e.country.modern || _e.country));
    if (_e.inventor) parts.push('Inventor: ' + _e.inventor);
    if (isDaily) parts.push('Puzzle #' + _pn);
    if (isInfinite && run) parts.push('Streak: ' + run.streak + ' | Strikes: ' + run.strikes + '/' + MAX_STRIKES + ' | Shields: ' + run.shields);
    parts.push('Phase: ' + phase + ' | Over: ' + over + ' | Won: ' + won);
    infoDiv.textContent = parts.join('  |  ');
  }

  // ====== GAME CONTROLS ======
  var gameRow = mkSection('Game');

  mkBtn(gameRow, 'Show Answer', function() {
    var yr = _tb ? _ta + ' BC' : _ta + ' AD';
    toast('Answer: ' + yr);
  });

  mkBtn(gameRow, 'Auto-Win', function() {
    if (over) { toast('Already over'); return; }
    cur = _td.slice();
    isBC = _tb;
    inputEra.textContent = _tb ? 'BC' : 'AD';
    inputEra.className = 'input-era ' + (_tb ? 'bc' : 'ad');
    renderInput();
    submit();
  });

  mkBtn(gameRow, 'Force Loss', function() {
    if (over) { toast('Already over'); return; }
    if (spinning) { toast('Wait for spin'); return; }
    // Submit wrong guesses one at a time, waiting for each spin to finish
    var wrongYear = _ta > 5000 ? 1 : 9999;
    var wrongDigits = String(wrongYear).padStart(4, '0').split('').map(Number);
    var wrongBC = !_tb;
    function nextGuess() {
      if (gHistory.length >= MAX || over) return;
      cur = wrongDigits.slice();
      isBC = wrongBC;
      renderInput();
      submit();
      // Poll until spinning is done, then submit next
      var check = setInterval(function() {
        if (!spinning) { clearInterval(check); nextGuess(); }
      }, 100);
    }
    nextGuess();
  });

  mkBtn(gameRow, 'Skip to Bonus 1', function() {
    if (phase !== 'main') { toast('Not in main phase'); return; }
    // Auto-win then start bonus
    if (!over) {
      cur = _td.slice(); isBC = _tb;
      inputEra.textContent = _tb ? 'BC' : 'AD';
      inputEra.className = 'input-era ' + (_tb ? 'bc' : 'ad');
      renderInput(); submit();
    }
    setTimeout(function() {
      if (typeof startBonus1 === 'function') startBonus1();
    }, 3000);
  });

  mkBtn(gameRow, 'Skip to Bonus 2', function() {
    if (typeof startBonus2 === 'function') {
      if (!over) {
        cur = _td.slice(); isBC = _tb;
        inputEra.textContent = _tb ? 'BC' : 'AD';
        inputEra.className = 'input-era ' + (_tb ? 'bc' : 'ad');
        renderInput(); submit();
      }
      setTimeout(function() { startBonus2(); }, 3000);
    } else {
      toast('startBonus2 not available');
    }
  });

  // ====== PHASE / STATE ======
  var stateRow = mkSection('State');

  mkBtn(stateRow, 'Show Stats Modal', function() {
    if (typeof showStats === 'function') showStats();
  });

  mkBtn(stateRow, 'Show Support Modal', function() {
    if (typeof showAdModal === 'function') {
      showAdModal([
        { text: 'Test Btn 1', onclick: function() {} },
        { text: 'Test Btn 2', secondary: true, onclick: function() {} }
      ]);
    }
  });

  if (isDaily) {
    mkBtn(stateRow, 'Reset Today', function() {
      localStorage.removeItem('wi_state');
      location.reload();
    }, true);
  }

  if (isInfinite) {
    mkBtn(stateRow, 'New Run', function() {
      startNewRun();
    });

    // ---- Streak controls ----
    function _setStreak(n) {
      if (!run) return;
      run.streak = Math.max(0, n);
      saveRun();
      if (typeof renderStreak === 'function') renderStreak();
      updateInfo();
      toast('Streak: ' + run.streak);
    }

    mkBtn(stateRow, '+1 Streak', function() { _setStreak((run ? run.streak : 0) + 1); });
    mkBtn(stateRow, '+25 Streak', function() { _setStreak((run ? run.streak : 0) + 25); });
    mkBtn(stateRow, '+100 Streak', function() { _setStreak((run ? run.streak : 0) + 100); });
    mkBtn(stateRow, 'Reset Streak', function() { _setStreak(0); }, true);

    // ---- Shield controls ----
    mkBtn(stateRow, '+Shield', function() {
      if (run) {
        run.shields = Math.min(run.shields + 1, MAX_SHIELDS);
        saveRun();
        if (typeof renderLives === 'function') renderLives();
        updateInfo();
        toast('Shields: ' + run.shields);
      }
    });

    mkBtn(stateRow, '-Shield', function() {
      if (run) {
        run.shields = Math.max(run.shields - 1, 0);
        saveRun();
        if (typeof renderLives === 'function') renderLives();
        updateInfo();
        toast('Shields: ' + run.shields);
      }
    });

    // ---- Strike controls ----
    mkBtn(stateRow, '+Strike', function() {
      if (run) {
        run.strikes = Math.min(run.strikes + 1, MAX_STRIKES);
        saveRun();
        if (typeof renderLives === 'function') renderLives();
        updateInfo();
        toast('Strikes: ' + run.strikes);
      }
    });

    mkBtn(stateRow, '-Strike', function() {
      if (run) {
        run.strikes = Math.max(run.strikes - 1, 0);
        saveRun();
        if (typeof renderLives === 'function') renderLives();
        updateInfo();
        toast('Strikes: ' + run.strikes);
      }
    });

    // ---- Reset shields & strikes ----
    mkBtn(stateRow, 'Reset Shields/Strikes', function() {
      if (run) {
        run.shields = 0;
        run.strikes = 0;
        saveRun();
        if (typeof renderLives === 'function') renderLives();
        updateInfo();
        toast('Shields & Strikes reset');
      }
    }, true);
  }

  // ====== THEME / SCHEME ======
  var themeRow = mkSection('Theme');

  mkBtn(themeRow, 'Toggle Dark/Light', function() {
    var p = loadPrefs();
    var newTheme = (p.theme || 'dark') === 'dark' ? 'light' : 'dark';
    p.theme = newTheme;
    savePrefs(p);
    setTheme(newTheme);
    var cb = document.getElementById('set-dark');
    if (cb) cb.checked = newTheme === 'dark';
  });

  for (var i = 0; i < 4; i++) {
    (function(scheme) {
      mkBtn(themeRow, 'Scheme ' + scheme, function() {
        var p = loadPrefs();
        var old = p.scheme || 0;
        p.scheme = scheme;
        savePrefs(p);
        if (typeof animatedSetScheme === 'function') animatedSetScheme(old, scheme);
        else setScheme(scheme);
      });
    })(i);
  }

  // ====== DANGER ZONE ======
  var dangerRow = mkSection('Danger');

  mkBtn(dangerRow, 'Clear All Storage', function() {
    if (confirm('Clear ALL Inventle localStorage?')) {
      var keys = [];
      for (var j = 0; j < localStorage.length; j++) {
        var k = localStorage.key(j);
        if (k && k.indexOf('wi_') === 0) keys.push(k);
      }
      keys.forEach(function(k) { localStorage.removeItem(k); });
      toast('Cleared ' + keys.length + ' keys');
      setTimeout(function() { location.reload(); }, 500);
    }
  }, true);

  mkBtn(dangerRow, 'Clear Daily Stats', function() {
    if (confirm('Reset daily stats?')) {
      localStorage.removeItem('wi_stats');
      toast('Daily stats cleared');
    }
  }, true);

  if (isInfinite) {
    mkBtn(dangerRow, 'Clear Inf Stats', function() {
      if (confirm('Reset infinite stats?')) {
        localStorage.removeItem('wi_inf_stats');
        localStorage.removeItem('wi_inf_run');
        localStorage.removeItem('wi_inf_done');
        toast('Infinite stats cleared');
        setTimeout(function() { location.reload(); }, 500);
      }
    }, true);
  }

  // ====== ASSEMBLE ======
  panel.appendChild(infoDiv);
  document.body.appendChild(panel);
  updateInfo();

  // Auto-refresh info
  setInterval(updateInfo, 1000);

  // Badge on body
  document.title = '[DEV] ' + document.title;
})();
