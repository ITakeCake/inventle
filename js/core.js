// ====================================================================
// core.js — Shared module for Inventle (daily + infinite)
// Load AFTER data.js, BEFORE game.js or infinite.js
// ====================================================================

// ====== SHARED GAME VARIABLES ======
var MAX = 6;
var cur = [], gHistory = [], eras = [], isBC = false, over = false, won = false;
var phase = 'main'; // main, bonus1, bonus2, done
var b1guesses = [], b1over = false, b1won = false;
var b2guesses = [], b2over = false, b2won = false;
var spinning = false;
var SPIN_DURATION = 400 + 4 * 350 + 350;
var _collapsed = false;

// Puzzle state (set by each mode)
var _ix, _e, _ty, _tb, _ta, _td;

// ====== PREFERENCES ======
var PK = 'wi_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PK)) || {}; } catch (e) { return {}; }
}

function savePrefs(p) {
  localStorage.setItem(PK, JSON.stringify(p));
}

var setTheme = function(t) { document.body.setAttribute('data-theme', t); };
var setScheme = function(s) { document.body.setAttribute('data-scheme', s); };

// Exact --right colors per scheme and theme, matching main.css
var _schemeColors = {
  dark:  ['#4eca85','#4a8cd8','#42b5c5','#8670d8'],
  light: ['#3ab872','#3a78c8','#35a5b5','#7058c8']
};

function _hexToRgb(h) {
  return [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
}

// Apply the exact CSS hue-rotate color matrix to an RGB triplet
function _hueRotate(rgb, deg) {
  var r=deg*Math.PI/180, c=Math.cos(r), s=Math.sin(r), v=rgb;
  return [
    Math.min(1,Math.max(0, v[0]*(0.213+0.787*c-0.213*s) + v[1]*(0.715-0.715*c-0.715*s) + v[2]*(0.072-0.072*c+0.928*s))),
    Math.min(1,Math.max(0, v[0]*(0.213-0.213*c+0.143*s) + v[1]*(0.715+0.285*c+0.140*s) + v[2]*(0.072-0.072*c-0.283*s))),
    Math.min(1,Math.max(0, v[0]*(0.213-0.213*c-0.787*s) + v[1]*(0.715-0.715*c+0.715*s) + v[2]*(0.072+0.928*c+0.072*s)))
  ];
}

function _colorDist(a, b) {
  var dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2]; return dr*dr+dg*dg+db*db;
}

// Find the long-way rotation angle that makes hue-rotate(from) land exactly on (to)
function _findRotation(fromScheme, toScheme) {
  var theme = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var fromRgb = _hexToRgb(_schemeColors[theme][fromScheme]);
  var toRgb   = _hexToRgb(_schemeColors[theme][toScheme]);
  // Coarse search over both long-way directions (-360→-180 and +180→+360)
  var best = -270, bestDist = Infinity;
  for (var d = -360; d <= 360; d += 1) {
    if (d > -180 && d < 180) continue; // skip short way
    var dist = _colorDist(_hueRotate(fromRgb, d), toRgb);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  // Fine-tune around the best coarse result
  for (var d = best - 1; d <= best + 1; d += 0.05) {
    var dist = _colorDist(_hueRotate(fromRgb, d), toRgb);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

var _schemeAnimating = false;

function animatedSetScheme(from, to) {
  if (from === to) return;
  if (_schemeAnimating) { setScheme(to); return; }
  _schemeAnimating = true;
  document.body.classList.add('scheme-animating');
  setScheme(to);
  setTimeout(function() {
    document.body.classList.remove('scheme-animating');
    _schemeAnimating = false;
  }, 2000);
}
var prefSpin = function() { return loadPrefs().spin !== false; };
var prefGlow = function() { return loadPrefs().glow !== false; };
var prefSound = function() { return loadPrefs().sound !== false; };

// Header sound button icons (Feather volume-2 / volume-x). Drawn from the pref rather
// than toggled in markup, so the icon and the setting cannot disagree.
var SND_ICON_ON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>';
var SND_ICON_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

function syncSoundBtn() {
  var b = document.getElementById('btn-sound');
  if (!b) return;
  var on = prefSound();
  b.innerHTML = on ? SND_ICON_ON : SND_ICON_OFF;
  b.title = on ? 'Mute sound' : 'Unmute sound';
  b.setAttribute('aria-label', b.title);
  b.setAttribute('aria-pressed', on ? 'false' : 'true');
  b.classList.toggle('muted', !on);
  var t = document.getElementById('set-sound');
  if (t) t.checked = on;            // keep the settings modal in step
}

function toggleSoundPref() {
  var p = loadPrefs();
  p.sound = !prefSound();
  savePrefs(p);
  syncSoundBtn();
}

// Keep short aliases for backward compatibility (game.js / infinite.js use lp/sp)
var lp = loadPrefs;
var sp = savePrefs;

// Apply saved preferences on load
(function() {
  var p = loadPrefs();
  setTheme(p.theme || 'dark');
  setScheme(p.scheme != null ? p.scheme : 0);
  if (p.bgTheme) document.body.setAttribute('data-bg-theme', p.bgTheme);
  else document.body.removeAttribute('data-bg-theme');
  if (p.spin == null) p.spin = true;
  if (p.glow == null) p.glow = true;
  if (p.schemeBtn == null) p.schemeBtn = false;
  if (!p.uid) p.uid = Math.floor(Math.random() * 1000000);
  savePrefs(p);
  var sb = document.getElementById('btn-scheme');
  if (sb) sb.style.display = p.schemeBtn ? '' : 'none';
  syncSoundBtn();
  // Remove no-color-transition after initial render so scheme transitions work
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      document.body.classList.remove('no-color-transition');
    });
  });
})();

// ====== UI UTILITIES ======

function toast(m, dur) {
  if (dur === undefined) dur = 2200;
  var b = document.getElementById('toast-box'), t = document.createElement('div');
  t.className = 'toast'; t.textContent = m; b.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transition = 'opacity 0.3s';
    setTimeout(function() { t.remove(); }, 300);
  }, dur);
}

// Share emoji per color scheme
var _shareEmoji = [
  {r:'\ud83d\udfe9', n:'\ud83d\udfe8'}, // 0: green/yellow
  {r:'\ud83d\udfe6', n:'\ud83d\udfe7'}, // 1: blue/orange
  {r:'\ud83d\udfe6', n:'\ud83d\udfe8'}, // 2: teal→blue/yellow
  {r:'\ud83d\udfea', n:'\ud83d\udfe7'}  // 3: purple/orange
];
function shareSquare(color) {
  var s = loadPrefs().scheme || 0;
  var e = _shareEmoji[s] || _shareEmoji[0];
  return color === 'green' ? e.r : color === 'yellow' ? e.n : '\u2b1b';
}

function setInvName(name) {
  var el = document.getElementById('inv-name');
  el.innerHTML = '';
  // Split parenthetical into subtitle
  var main = name, sub = '';
  var m = name.match(/^(.+?)\s*\((.+)\)$/);
  if (m) { main = m[1]; sub = m[2]; }
  var a = document.createElement('a');
  a.href = 'https://www.google.com/search?tbm=isch&safe=active&q=' + encodeURIComponent(name + ' invention');
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = main;
  a.style.cssText = 'color:inherit;text-decoration:none;';
  el.appendChild(a);
  if (sub) {
    var s = document.createElement('div');
    s.className = 'inv-name-sub';
    s.textContent = '(' + sub + ')';
    el.appendChild(s);
  }
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getSourceHtml() {
  // Check main data first, then fall back to _sources
  var src = null;
  if (_d[_ix] && _d[_ix].source) {
    src = _d[_ix].source;
  } else if (typeof _sources !== 'undefined' && _sources[_ix]) {
    src = _sources[_ix];
  }
  if (!src) return '';
  return '<br><a href="' + escHtml(src.url) + '" target="_blank" rel="noopener" style="color:var(--text3);font-size:0.8rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:4px;transition:color 0.2s;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' + escHtml(src.label) + '</a>';
}

function getOriginHtml() {
  if (typeof _inventorOrigin === 'undefined' || !_inventorOrigin[_ix]) return '';
  var o = _inventorOrigin[_ix];
  return '<div style="margin-top:8px;padding:8px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);font-size:0.78rem;color:var(--text2);line-height:1.4;"><span style="margin-right:4px;">&#x1f30d;</span>' + escHtml(o.note) + '</div>';
}

function showOriginToast() {
  if (typeof _inventorOrigin === 'undefined' || !_inventorOrigin[_ix]) return;
  var o = _inventorOrigin[_ix];
  if (o.born !== o.inventedIn) {
    toast(o.note, 4000);
  }
}

function scrollToBottom() {
  setTimeout(function() { gameScroll.scrollTo({ top: gameScroll.scrollHeight, behavior: 'smooth' }); }, 50);
}

function flashKey(keyVal) {
  var btns = document.querySelectorAll('#numpad .np-key');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].textContent === keyVal || (keyVal === 'ENTER' && btns[i].classList.contains('enter')) || (keyVal === 'DEL' && btns[i].classList.contains('del'))) {
      btns[i].style.transform = 'scale(0.9)';
      btns[i].style.filter = 'brightness(1.3)';
      (function(b) { setTimeout(function() { b.style.transform = ''; b.style.filter = ''; }, 120); })(btns[i]);
      break;
    }
  }
}

function renderInput() {
  for (var i = 0; i < 4; i++) {
    var c = document.getElementById('ic-' + i);
    c.textContent = i < cur.length ? cur[i] : '';
    c.classList.toggle('has-digit', i < cur.length);
  }
}

function renderRound() {
  var el = document.getElementById('round-display'); if (!el) return;
  el.textContent = (gHistory ? gHistory.length : 0) + '/' + MAX;
}

// ====== INPUT SYSTEM ======

function toggleEra() {
  isBC = !isBC;
  var _t = window.I18N ? I18N.t : function(k){ return k === 'era.bc' ? 'BC' : 'AD'; };
  inputEra.textContent = isBC ? _t('era.bc') : _t('era.ad');
  inputEra.className = 'input-era ' + (isBC ? 'bc' : 'ad');
  var adB = document.getElementById('np-ad');
  var bcB = document.getElementById('np-bc');
  if (adB) { adB.className = 'np-key era-ad' + (isBC ? ' dim' : ' sel'); }
  if (bcB) { bcB.className = 'np-key era-bc' + (isBC ? ' sel' : ' dim'); }
}

// Optional analytics callback for numpad input — set by game.js
var onNumpadInput = null;

function buildNumpad() {
  var _t = window.I18N ? I18N.t : function(k){ return {
    'numpad.enter':'ENTER','numpad.del':'DEL','era.ad':'AD','era.bc':'BC'
  }[k] || k; };
  var layout = [
    { k: '7' }, { k: '8' }, { k: '9' }, { k: 'AD' },
    { k: '4' }, { k: '5' }, { k: '6' }, { k: 'BC' },
    { k: '1' }, { k: '2' }, { k: '3' }, { k: 'ENTER', cls: 'fn enter', label: _t('numpad.enter') },
    { k: '0', cls: 'wide' }, { k: 'DEL', cls: 'fn del', label: _t('numpad.del') }
  ];
  layout.forEach(function(item) {
    var b = document.createElement('button'); b.className = 'np-key';
    if (item.cls) b.className += ' ' + item.cls;
    if (item.k === 'AD') {
      b.className += ' era-ad sel'; b.textContent = _t('era.ad'); b.id = 'np-ad';
      b.onclick = function() { if (isBC) toggleEra(); };
    } else if (item.k === 'BC') {
      b.className += ' era-bc dim'; b.textContent = _t('era.bc'); b.id = 'np-bc';
      b.onclick = function() { if (!isBC) toggleEra(); };
    } else {
      b.textContent = item.label || item.k;
      b.onclick = function() {
        if (onNumpadInput) onNumpadInput(item.k);
        handleKey(item.k);
      };
    }
    numpadEl.appendChild(b);
  });
}

// handleKey — calls global submit() which each mode defines
function handleKey(k) {
  if (over) return;
  if (k === 'ENTER') submit();
  else if (k === 'DEL') { if (cur.length > 0) { cur.pop(); renderInput(); } }
  else if (k === 'ERA') toggleEra();
  else if (cur.length < 4) {
    cur.push(+k); renderInput();
    var c = document.getElementById('ic-' + (cur.length - 1));
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  }
}

// ====== KEYBOARD LISTENER ======

// Optional analytics callback for keyboard input — set by game.js
var onKeyboardInput = null;

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Close modals on Escape/Backspace
  if (e.key === 'Escape' || (e.key === 'Backspace' && document.querySelector('.modal-bg.show,.ad-modal-bg.show'))) {
    var closed = false;
    document.querySelectorAll('.modal-bg.show').forEach(function(m) {
      m.classList.remove('show'); closed = true;
      if (m.id === 'm-stats') restoreButtons();
    });
    var ad = document.getElementById('m-ad');
    if (ad && ad.classList.contains('show')) { ad.classList.remove('show'); closed = true; }
    if (closed) { e.preventDefault(); return; }
  }
  // Block game input when any modal is open
  if (document.querySelector('.modal-bg.show,.ad-modal-bg.show')) return;
  if (phase === 'bonus1' || phase === 'bonus2') return;
  // Analytics callback (game.js sets this to track input method & keyboard type)
  if (onKeyboardInput) onKeyboardInput(e);
  if (e.key === 'Enter') { flashKey('ENTER'); handleKey('ENTER'); }
  else if (e.key === 'Backspace') { flashKey('DEL'); handleKey('DEL'); }
  else if (e.key === 'b' || e.key === 'B') { handleKey('ERA'); }
  else if (e.key === 'c' || e.key === 'C') {
    document.body.classList.remove('no-color-transition');
    var p = loadPrefs(); var from = p.scheme != null ? p.scheme : 0; var s = (from + 1) % 4; p.scheme = s; savePrefs(p);
    animatedSetScheme(from, s);
    document.querySelectorAll('.scheme-btn').forEach(function(x) { x.classList.toggle('active', parseInt(x.getAttribute('data-scheme')) === s); });
  }
  else if (e.key === ' ') { e.preventDefault(); flashKey('0'); handleKey('0'); }
  else if (/^[0-9]$/.test(e.key)) { flashKey(e.key); handleKey(e.key); }
});

// ====== YEAR RANGE SUPPORT ======

// Check if a guessed year falls within an accepted range
function isYearInRange(guessedYear) {
  if (guessedYear === _ty) return true;
  if (typeof _yearRanges === 'undefined' || !_yearRanges[_ix]) return false;
  var range = _yearRanges[_ix];
  return guessedYear >= range[0] && guessedYear <= range[1];
}

// ====== GUESS RENDERING ======

function getColors(d, bc) {
  if (bc !== _tb) return ['grey', 'grey', 'grey', 'grey'];
  var gd = String(d[0] * 1000 + d[1] * 100 + d[2] * 10 + d[3]).padStart(4, '0').split('').map(Number);
  return gd.map(function(v, i) {
    var df = Math.abs(v - _td[i]);
    return df === 0 ? 'green' : df === 1 ? 'yellow' : 'grey';
  });
}

// Get all-green colors for a range win (guess is correct but digits differ from primary year)
function getRangeWinColors() {
  return ['green', 'green', 'green', 'green'];
}

function addGuessRow(r, digits, eraBC, cols, eraOk, animate, skipSpin, skipEra, finale, padCount) {
  if (!skipSpin) skipSpin = [false, false, false, false];
  if (!skipEra) skipEra = false;
  if (!padCount) padCount = 0;
  var row = document.createElement('div');
  row.className = 'guess-row';
  if (!animate) { row.style.animation = 'none'; row.style.opacity = '1'; row.style.transform = 'none'; }

  var allCorrect = cols.every(function(c) { return c === 'green'; }) && eraOk;
  var _glow = prefGlow();

  var chip = document.createElement('div');
  chip.className = 'guess-era-chip';
  chip.style.overflow = 'hidden';

  // ===== FINALE MODE: cascade spin like first guess, gold varies =====
  if (animate && finale) {
    var fDelays = [400, 750, 1100, 1450, 1800];
    var lastD = fDelays[4];

    var eraSpinner = document.createElement('div');
    eraSpinner.className = 'era-spin';
    eraSpinner.textContent = 'AD\nBC\nAD\nBC\nAD\nBC\nAD\nBC';
    chip.appendChild(eraSpinner);
    row.appendChild(chip);

    var cells = document.createElement('div');
    cells.className = 'guess-cells';
    var cellRefs = [], stripRefs = [];
    for (var c = 0; c < 4; c++) {
      var cell = document.createElement('div'); cell.className = 'guess-cell';
      cell.style.background = 'var(--surface)'; cell.style.color = 'var(--text)';
      cell.style.overflow = 'hidden';
      var strip = document.createElement('div');
      strip.className = 'spin-strip';
      for (var s = 0; s < 20; s++) { strip.textContent += Math.floor(Math.random() * 10) + '\n'; }
      strip.style.whiteSpace = 'pre';
      cell.appendChild(strip);
      stripRefs.push(strip);
      cellRefs.push(cell);
      cells.appendChild(cell);
    }
    row.appendChild(cells);
    guessesEl.appendChild(row);
    scrollToBottom();

    (function(theChip, theSpinner, theCells, theStrips) {
      // Era reveal
      setTimeout(function() {
        theChip.removeChild(theSpinner);
        theChip.style.overflow = '';
        theChip.textContent = eraBC ? 'BC' : 'AD';
        theChip.classList.add('era-ok');
        if (_glow) setTimeout(function() { theChip.classList.add('era-gold-hold'); }, 100);
      }, fDelays[0]);

      // Digit reveals — cascade
      for (var i = 0; i < 4; i++) {
        (function(idx, delay) {
          setTimeout(function() {
            theCells[idx].removeChild(theStrips[idx]);
            theCells[idx].style.overflow = '';
            theCells[idx].textContent = digits[idx];
            theCells[idx].style.background = 'var(--right)';
            theCells[idx].style.color = '#000';
            var mask = document.createElement('div');
            mask.style.cssText = 'position:absolute;inset:0;background:var(--surface);opacity:1;transition:opacity 0.35s ease;pointer-events:none;border-radius:inherit;';
            theCells[idx].style.position = 'relative';
            theCells[idx].appendChild(mask);
            mask.offsetHeight;
            mask.style.opacity = '0';
            setTimeout(function() { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 400);
            if (_glow) setTimeout(function() { theCells[idx].classList.add('gold-hold'); }, 100);
          }, delay);
        })(i, fDelays[i + 1]);
      }

      // Supernova burst
      setTimeout(function() {
        theChip.classList.remove('era-gold-hold');
        for (var i = 0; i < 4; i++) theCells[i].classList.remove('gold-hold');
        void theChip.offsetWidth;
        if (_glow) {
          theChip.classList.add('era-gold-supernova');
          for (var i = 0; i < 4; i++) theCells[i].classList.add('gold-supernova');
          // settle into a permanent gold border once the supernova fades
          setTimeout(function() {
            theChip.classList.remove('era-gold-supernova');
            theChip.classList.add('gold-border');
            for (var i = 0; i < 4; i++) {
              theCells[i].classList.remove('gold-supernova');
              theCells[i].classList.add('gold-border');
            }
          }, 4000);
        }
      }, lastD + 400);

    })(chip, eraSpinner, cellRefs, stripRefs);
    return;
  }

  // ===== NORMAL MODE: chain-based cascade =====
  var _aidx = 0, _eraDelay = 400, _digDelays = [0, 0, 0, 0];
  if (!skipEra) { _eraDelay = 400 + _aidx * 350; _aidx++; }
  for (var d = 0; d < 4; d++) {
    if (!skipSpin[d]) { _digDelays[d] = 400 + _aidx * 350; _aidx++; }
  }

  if (animate && !skipEra) {
    chip.style.overflow = 'hidden';
    var eraSpinner = document.createElement('div');
    eraSpinner.className = 'era-spin';
    eraSpinner.textContent = 'AD\nBC\nAD\nBC\nAD\nBC\nAD\nBC';
    chip.appendChild(eraSpinner);
    setTimeout(function() {
      chip.removeChild(eraSpinner);
      chip.style.overflow = '';
      chip.textContent = eraBC ? 'BC' : 'AD';
      chip.classList.add(eraOk ? 'era-ok' : 'era-no');
      if (eraOk && allCorrect) {
        if (_glow) setTimeout(function() { chip.classList.add('era-gold-bright'); }, 100);
        setTimeout(function() { chip.classList.add('gold-border'); }, 100);
        setTimeout(function() { chip.classList.remove('era-gold-bright'); }, 4100);
      } else if (eraOk && _glow) {
        setTimeout(function() { chip.classList.add('era-gold'); }, 100);
      }
    }, _eraDelay);
  } else {
    chip.textContent = eraBC ? 'BC' : 'AD';
    chip.classList.add(eraOk ? 'era-ok' : 'era-no');
    if (eraOk && allCorrect) chip.classList.add('gold-border');
  }
  row.appendChild(chip);

  var cells = document.createElement('div');
  cells.className = 'guess-cells';
  for (var c = 0; c < 4; c++) {
    var cell = document.createElement('div'); cell.className = 'guess-cell';
    var bg = cols[c] === 'green' ? 'var(--right)' : cols[c] === 'yellow' ? 'var(--near)' : 'var(--wrong)';
    var isCorrect = cols[c] === 'green';

    if (animate && !skipSpin[c]) {
      cell.style.background = 'var(--surface)'; cell.style.color = 'var(--text)';
      cell.style.overflow = 'hidden';
      var strip = document.createElement('div');
      strip.className = 'spin-strip';
      for (var s = 0; s < 20; s++) { strip.textContent += Math.floor(Math.random() * 10) + '\n'; }
      strip.style.whiteSpace = 'pre';
      cell.appendChild(strip);

      (function(theCell, theStrip, theBg, theDig, correct, delay) {
        setTimeout(function() {
          theCell.removeChild(theStrip);
          theCell.style.overflow = '';
          theCell.textContent = theDig;
          // Set final color instantly, fade out a surface-colored mask to reveal it
          theCell.style.background = theBg;
          theCell.style.color = '#000';
          var mask = document.createElement('div');
          mask.style.cssText = 'position:absolute;inset:0;background:var(--surface);opacity:1;transition:opacity 0.35s ease;pointer-events:none;border-radius:inherit;';
          theCell.style.position = 'relative';
          theCell.appendChild(mask);
          // Force layout so the browser sees opacity:1 before we transition
          mask.offsetHeight;
          mask.style.opacity = '0';
          setTimeout(function() { if (mask.parentNode) mask.parentNode.removeChild(mask); }, 400);
          if (correct) {
            if (allCorrect) {
              if (_glow) setTimeout(function() { theCell.classList.add('gold-bright'); }, 100);
              setTimeout(function() { theCell.classList.add('gold-border'); }, 100);
              setTimeout(function() { theCell.classList.remove('gold-bright'); }, 4100);
            } else if (_glow) {
              setTimeout(function() { theCell.classList.add('gold-glow'); }, 100);
            }
          }
        }, delay);
      })(cell, strip, bg, digits[c], isCorrect, _digDelays[c]);

    } else {
      cell.textContent = digits[c];
      cell.style.background = bg;
      if (isCorrect && allCorrect) cell.classList.add('gold-border');
    }
    cells.appendChild(cell);
  }
  row.appendChild(cells);
  guessesEl.appendChild(row);
  scrollToBottom();
}

// ====== SHARED DRAWER OPEN/CLOSE ANIMATIONS ======
// Height, padding and margin animate together so the drawer collapses fully to 0.

var DRAWER_OPEN_MS = 520;
var DRAWER_CLOSE_MS = 380;
var DRAWER_EASE = 'cubic-bezier(0.4,0,0.2,1)';

// Natural (unconstrained) height of a collapsed drawer: releases the fold constraints,
// measures, and puts them back within one frame, so nothing is painted mid-measurement.
function _naturalDrawerHeight(drawer){
  var t=drawer.style.transition, h=drawer.style.height, o=drawer.style.overflow;
  var pt=drawer.style.paddingTop, pb=drawer.style.paddingBottom;
  var mt=drawer.style.marginTop, mb=drawer.style.marginBottom;
  drawer.style.transition='none';
  drawer.style.height='';drawer.style.overflow='';
  drawer.style.paddingTop='';drawer.style.paddingBottom='';
  drawer.style.marginTop='';drawer.style.marginBottom='';
  var H=drawer.offsetHeight;
  drawer.style.height=h;drawer.style.overflow=o;
  drawer.style.paddingTop=pt;drawer.style.paddingBottom=pb;
  drawer.style.marginTop=mt;drawer.style.marginBottom=mb;
  void drawer.offsetHeight;
  drawer.style.transition=t;
  return H;
}

// ====== ONE CASCADE TIMING FOR THE WHOLE GAME ======
// Every bonus-round fold and unfold runs at this speed. Values are milliseconds.
// For the usual 5 options: fold = 4*(150+10) + 80 + 280 = 1000ms, unfold = 920ms.
var CAS = { step: 150, hold: 10, slide: 280, bDelay: 80, fade: 160 };

function animateDrawerOpen(drawer, durationMs){
  var ms = durationMs || DRAWER_OPEN_MS;
  // Temporarily release any explicit constraints to measure natural size
  var savedTransition = drawer.style.transition;
  drawer.style.transition = 'none';
  var savedHeight = drawer.style.height;
  var savedOverflow = drawer.style.overflow;
  var savedPt = drawer.style.paddingTop;
  var savedPb = drawer.style.paddingBottom;
  var savedMt = drawer.style.marginTop;
  var savedMb = drawer.style.marginBottom;
  drawer.style.height = '';
  drawer.style.overflow = '';
  drawer.style.paddingTop = '';
  drawer.style.paddingBottom = '';
  drawer.style.marginTop = '';
  drawer.style.marginBottom = '';
  // Measure natural height and computed padding/margin
  var targetH = drawer.offsetHeight;
  var cs = getComputedStyle(drawer);
  var pt = cs.paddingTop, pb = cs.paddingBottom, mt = cs.marginTop, mb = cs.marginBottom;
  // Collapse to 0 instantly for animation start
  drawer.style.overflow = 'hidden';
  drawer.style.height = '0px';
  drawer.style.paddingTop = '0px';
  drawer.style.paddingBottom = '0px';
  drawer.style.marginTop = '0px';
  drawer.style.marginBottom = '0px';
  // Force reflow so the collapsed state is committed before the transition
  void drawer.offsetHeight;
  // Kick off transition to target
  drawer.style.transition = 'height '+ms+'ms '+DRAWER_EASE+', padding '+ms+'ms '+DRAWER_EASE+', margin '+ms+'ms '+DRAWER_EASE;
  drawer.style.height = targetH + 'px';
  drawer.style.paddingTop = pt;
  drawer.style.paddingBottom = pb;
  drawer.style.marginTop = mt;
  drawer.style.marginBottom = mb;
  // After transition completes, release explicit dimensions so content can reflow
  setTimeout(function(){
    drawer.style.height = '';
    drawer.style.overflow = '';
    drawer.style.transition = '';
    drawer.style.paddingTop = '';
    drawer.style.paddingBottom = '';
    drawer.style.marginTop = '';
    drawer.style.marginBottom = '';
  }, ms + 20);
}

function animateDrawerClose(drawer, durationMs){
  var ms = durationMs || DRAWER_CLOSE_MS;
  var currentH = drawer.offsetHeight;
  drawer.style.height = currentH + 'px';
  drawer.style.overflow = 'hidden';
  drawer.style.transition = 'height '+ms+'ms '+DRAWER_EASE+', padding '+ms+'ms '+DRAWER_EASE+', margin '+ms+'ms '+DRAWER_EASE;
  void drawer.offsetHeight;
  drawer.style.height = '0px';
  drawer.style.paddingTop = '0px';
  drawer.style.paddingBottom = '0px';
  drawer.style.marginTop = '0px';
  drawer.style.marginBottom = '0px';
}

// ====== BOTTOM BUTTON ROW ENTRANCE ======
// Fades in while settling down from -8px. Call right after appending the row to the DOM.
function revealBtnWrap(el){
  el.style.opacity='0';
  el.style.transform='translateY(-8px)';
  el.style.transition='opacity 0.35s ease, transform 0.4s cubic-bezier(0.4,0,0.2,1)';
  void el.offsetHeight;
  requestAnimationFrame(function(){ el.style.opacity='1'; el.style.transform='translateY(0)'; });
}

// Unknown-inventor free-win recap card. Nothing was picked, so there are no cards to
// cascade, but the drawer still folds via activeCascadeToggle like every other bonus fold.
function _unknownRecapStage(){
  var _t = window.I18N ? I18N.t : function(k){ return {
    'bonus.round2Inventor':'Bonus Round 2 — Inventor',
    'bonus.unknownInventor':'Nobody actually knows who invented this! Free point. 🤷'
  }[k] || k; };
  var stage=document.createElement('div');stage.className='bonus-stage';
  // same fade as _recapStage: these arrive after the async puzzle fetch on reload
  stage.style.opacity='0';
  requestAnimationFrame(function(){ stage.style.transition='opacity 0.25s ease'; stage.style.opacity='1'; });
  var header=document.createElement('div');header.className='bonus-collapse br1-header won';
  if(prefGlow()) header.style.borderColor='#fbbf24';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML='<span>'+_t('bonus.round2Inventor')+'</span><span>Free ✅ <span class="bc-arrow">▼</span></span>';
  header.appendChild(headerInner);
  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';
  var res=document.createElement('div');res.className='bonus-result';
  res.innerHTML='✅ '+_t('bonus.unknownInventor');
  drawer.appendChild(res);
  // starts folded, like every other completed-round recap stage
  drawer.style.overflow='hidden';drawer.style.height='0px';
  drawer.style.paddingTop='0px';drawer.style.paddingBottom='0px';
  drawer.style.marginTop='0px';drawer.style.marginBottom='0px';
  drawer.dataset.closed='1';
  header.style.cursor='pointer';
  header.onclick=function(){ activeCascadeToggle(header,drawer); };
  stage.appendChild(header);stage.appendChild(drawer);
  bonusArea.appendChild(stage);
  return stage;
}

// ====== ACTIVE-ROUND CASCADE TOGGLE ======
// Folds/unfolds a bonus round that is still being answered, using the same card-cascade
// choreography completed rounds use for review. No result styling: tiles stay clickable
// once unfolded. The skip/done [data-btn-row] lives in the stage, outside the drawer, so
// those buttons stay available while the question is folded away.
function activeCascadeToggle(header, drawer){
  if(header.dataset.anim==='1') return;
  header.dataset.anim='1';
  var step=CAS.step,hold=CAS.hold,slide=CAS.slide,bDelay=CAS.bDelay;
  var ease='cubic-bezier(0.4,0,0.2,1)';
  var arrow=header.querySelector('.bc-arrow');
  var tiles=drawer.querySelectorAll('.mc-option');
  var fadeEls=[drawer.querySelector('.bonus-prompt'),drawer.querySelector('.mc-attempt-info'),drawer.querySelector('.bonus-result')];
  var n=tiles.length;
  drawer.style.pointerEvents='none';               // no picks while cards are in flight
  header.style.position='relative';header.style.zIndex='20';header.style.backgroundColor='var(--surface)';
  for(var i=0;i<n;i++){
    tiles[i].style.animation='none';               // a fill:forwards entry animation outranks inline transforms
    tiles[i].style.opacity='1';
    tiles[i].style.position='relative';
    tiles[i].style.willChange='transform';
    tiles[i].style.zIndex=String(Math.max(1,10-i));
  }
  var cum=[]; for(var i=0;i<n;i++) cum[i]=0;
  var done=function(closedFlag,ms){ setTimeout(function(){
    drawer.dataset.closed=closedFlag; drawer.style.pointerEvents=''; header.dataset.anim='';
  },ms); };

  if(drawer.dataset.closed!=='1'){
    // FOLD — lower cards fold up onto the top card one at a time, then the whole stack
    // slides under the header while the drawer closes as one motion.
    // Zero the transforms BEFORE measuring the card slot: getBoundingClientRect includes
    // transforms, so measuring while the cards are stacked reads 0. The slot is stashed
    // for the unfold, which cannot measure it (the cards are stacked by then).
    for(var i=0;i<n;i++){ tiles[i].style.transition='none'; tiles[i].style.transform='translateY(0px)'; }
    void drawer.offsetHeight;
    var slot=n>=2?(tiles[1].getBoundingClientRect().top-tiles[0].getBoundingClientRect().top):56;
    if(!(slot>1)) slot=56;
    drawer.dataset.slot=slot;
    // Pin the height so it shrinks one slot per step, in lockstep with the cards, so
    // everything below travels with the fold instead of snapping at the end.
    var H=drawer.getBoundingClientRect().height;
    drawer.dataset.openh=H;
    drawer.style.overflow='hidden';
    drawer.style.height=H+'px';
    if(arrow) arrow.style.transform='';
    var a1=Math.max(0,(n-1)*(step+hold));
    for(var s=0;s<n-1;s++){
      (function(si){
        setTimeout(function(){
          for(var g=n-1-si;g<n;g++){
            cum[g]-=slot;
            tiles[g].style.transition='transform '+step+'ms '+ease;
            tiles[g].style.transform='translateY('+cum[g]+'px)';
          }
          drawer.style.transition='height '+step+'ms '+ease;
          drawer.style.height=Math.max(0,H-slot*(si+1))+'px';
        },si*(step+hold));
      })(s);
    }
    setTimeout(function(){
      var hy=header.getBoundingClientRect().top;
      for(var i=0;i<n;i++){
        cum[i]+=hy-tiles[i].getBoundingClientRect().top;
        tiles[i].style.transition='transform '+slide+'ms '+ease;
        tiles[i].style.transform='translateY('+cum[i]+'px)';
      }
      // last of the height rides the same slide as the pile tucking under the header
      drawer.style.transition='height '+slide+'ms '+ease+', padding '+slide+'ms '+ease+', margin '+slide+'ms '+ease;
      drawer.style.height='0px';
      drawer.style.paddingTop='0px';drawer.style.paddingBottom='0px';
      drawer.style.marginTop='0px';drawer.style.marginBottom='0px';
      for(var f=0;f<fadeEls.length;f++){
        if(!fadeEls[f]) continue;
        fadeEls[f].style.transition='opacity '+Math.round(slide*0.9)+'ms ease';
        fadeEls[f].style.opacity='0';
      }
    },a1+bDelay);
    done('1', a1+bDelay+slide+40);
  }else{
    // UNFOLD — the drawer drops open while the stack slides down from the header, then
    // the cards peel back off the top card one at a time.
    // The slot MUST come from the stash: the cards are stacked now, so measuring them
    // reads 0. Fallback is offsetTop, which is layout-based and ignores transforms.
    var slot=parseFloat(drawer.dataset.slot);
    if(!(slot>1)) slot=n>=2?(tiles[1].offsetTop-tiles[0].offsetTop):56;
    if(!(slot>1)) slot=56;
    // Measure the natural height now (contents can change between fold and unfold).
    var H=_naturalDrawerHeight(drawer);
    if(!(H>1)) H=parseFloat(drawer.dataset.openh)||0;
    var spread=Math.max(0,n-1)*slot;
    var base=Math.max(0,H-spread);        // height once the pile has landed, pre-peel
    drawer.style.transition='none';
    drawer.style.overflow='hidden';
    drawer.style.height='0px';
    void drawer.offsetHeight;
    if(arrow) arrow.style.transform='rotate(180deg)';
    // The drawer grows one slot per peeled card, so the page is pushed down with them.
    drawer.style.transition='height '+slide+'ms '+ease+', padding '+slide+'ms '+ease+', margin '+slide+'ms '+ease;
    drawer.style.height=base+'px';
    drawer.style.paddingTop='';drawer.style.paddingBottom='';
    drawer.style.marginTop='';drawer.style.marginBottom='';
    for(var i=0;i<n;i++){
      cum[i]=-i*slot;
      tiles[i].style.transition='transform '+slide+'ms '+ease;
      tiles[i].style.transform='translateY('+cum[i]+'px)';
    }
    for(var f=0;f<fadeEls.length;f++){
      if(!fadeEls[f]) continue;
      fadeEls[f].style.transition='opacity '+slide+'ms ease';
      fadeEls[f].style.opacity='1';
    }
    for(var s=0;s<n-1;s++){
      (function(si){
        var count=n-1-si;
        setTimeout(function(){
          for(var g=0;g<count;g++){
            var idx=n-1-g;
            cum[idx]+=slot;
            tiles[idx].style.transition='transform '+step+'ms '+ease;
            tiles[idx].style.transform='translateY('+cum[idx]+'px)';
          }
          drawer.style.transition='height '+step+'ms '+ease;
          drawer.style.height=(base+slot*(si+1))+'px';
        },slide+si*(step+hold));
      })(s);
    }
    var revTotal=slide+Math.max(0,(n-1)*(step+hold));
    setTimeout(function(){
      // release the pin — the animated height already equals the natural one
      drawer.style.transition='none';drawer.style.height='';drawer.style.overflow='';
    },revTotal+40);
    done('', revTotal+60);
  }
}

// ====== CASCADE FOLD ANIMATION ======
// Single animation — cfg sets colors/classes. No win/loss branching.
// cfg: targetIdx, tileClass, headerClass, headerText, borderColor, goldBorder, revealIdx, onDone
// cfg.instant: jump straight to the folded end-state with no animation (used when
// rebuilding completed-round recaps after a reload or stats-close), while still
// installing the same header click toggle, so expanding a recap plays the full
// reverse cascade.
function cascadeFold(stage, cfg){
  var header=stage.querySelector('.bonus-collapse.br1-header');
  var drawer=stage.querySelector('.br1-drawer');
  var tiles=drawer.querySelectorAll('.mc-option');
  var prompt=drawer.querySelector('.bonus-prompt');
  // [data-btn-row] lives in the stage, outside the drawer, so it stays visible when an
  // active round is folded; querying the stage finds it in either position.
  var ui=[drawer.querySelector('.mc-attempt-info'),stage.querySelector('[data-btn-row]')];
  var n=tiles.length, tgt=cfg.targetIdx;
  var ease='cubic-bezier(0.4,0,0.2,1)';

  for(var i=0;i<n;i++) tiles[i].classList.add('locked');
  tiles[tgt].classList.add(cfg.tileClass);
  tiles[tgt].style.animation='none';
  tiles[tgt].style.opacity='1';
  for(var i=0;i<n;i++){
    if(i===tgt) continue;
    tiles[i].classList.add('mc-disabled');
    tiles[i].style.borderColor='transparent';
    tiles[i].style.animation='none';
    tiles[i].style.opacity='1';
  }
  if(cfg.revealIdx!=null&&cfg.revealIdx!==tgt){
    tiles[cfg.revealIdx].style.borderColor='var(--right)';
    tiles[cfg.revealIdx].style.opacity='1';
  }
  var inner=header.querySelector('.bonus-collapse-header');
  if(inner) inner.innerHTML=cfg.headerText;

  header.style.position='relative';header.style.zIndex='20';header.style.backgroundColor='var(--surface)';
  for(var i=0;i<n;i++){
    tiles[i].style.position='relative';
    tiles[i].style.willChange='transform, opacity';
    tiles[i].style.transform='translateY(0px)';
    tiles[i].style.zIndex=String(i===tgt?10:Math.max(1,10-Math.abs(i-tgt)));
  }

  var slot=56,below=[],cum={};
  // One timing for every bonus fold in the game (CAS, ~1s): the fold after an answer,
  // the review toggle, and the active-round toggle all run at this speed.
  var step=CAS.step,hold=CAS.hold,slide=CAS.slide,fade=CAS.fade,bDelay=CAS.bDelay;
  var total=0, expanded=false;   // hoisted so the header toggle reads the CURRENT run's values
  var openH=0;                   // drawer's natural height — drives lockstep height tracking
  var _doneFired=false;

  // A correct answer bursts the round's title card with the same gold supernova the
  // winning year row uses: the header is what survives the fold. Fired from the merge
  // block below. Skipped for cfg.instant, which rebuilds a past round.
  var _nova = cfg.goldBorder && !cfg.instant && prefGlow();

  if(cfg.instant){run(true);}else{setTimeout(run,600);}

  function run(inst){
    // inst=true executes every phase synchronously with transitions disabled,
    // landing on the exact same end-state + closures the animated path produces.
    function later(fn,ms){ if(inst){fn();} else {setTimeout(fn,ms);} }
    var hRect=header.getBoundingClientRect();
    var h=Math.round(hRect.height);
    for(var i=0;i<n;i++) tiles[i].style.height=h+'px';
    // Zero transforms before measuring: getBoundingClientRect INCLUDES transforms, so a
    // re-fold (cards left stacked by a previous pass) would otherwise measure slot as 0.
    for(var i=0;i<n;i++){ tiles[i].style.transition='none'; tiles[i].style.transform='translateY(0px)'; }
    void drawer.offsetHeight;
    for(var i=0;i<n;i++) tiles[i].dataset.ot=tiles[i].getBoundingClientRect().top;
    if(n>=2) slot=tiles[1].getBoundingClientRect().top-tiles[0].getBoundingClientRect().top;
    if(!(slot>1)) slot=56;
    // Pin the drawer so its height can be driven in lockstep with the cards below.
    openH=drawer.getBoundingClientRect().height;
    drawer.dataset.openh=openH;
    drawer.dataset.slot=slot;
    if(!inst){ drawer.style.overflow='hidden'; drawer.style.height=openH+'px'; }

    below=[];
    for(var i=n-1;i>tgt;i--) below.push(tiles[i]);
    for(var i=0;i<n;i++) cum[i]=0;

    // Phase A1: cards below fold up into target
    var group=[];
    below.forEach(function(card,si){
      group.push(card);var snap=group.slice();
      later(function(){
        for(var g=0;g<snap.length;g++){
          var idx=+snap[g].getAttribute('data-idx');
          cum[idx]-=slot;
          snap[g].style.transition=inst?'none':'transform '+step+'ms '+ease;
          snap[g].style.transform='translateY('+cum[idx]+'px)';
        }
        // The drawer loses exactly one card slot per step, so the rest of the page
        // travels with the cards instead of snapping to its final size.
        drawer.style.transition=inst?'none':'height '+step+'ms '+ease;
        drawer.style.height=Math.max(0,openH-slot*(si+1))+'px';
      },si*(step+hold));
    });
    var a1=below.length*(step+hold);

    // Phase A2: stack passes over cards above target
    var stack=[tiles[tgt]].concat(below);
    for(var s=0;s<tgt;s++){
      (function(si){
        var pi=tgt-1-si;
        later(function(){
          for(var g=0;g<stack.length;g++){
            var idx=+stack[g].getAttribute('data-idx');
            cum[idx]-=slot;
            stack[g].style.transition=inst?'none':'transform '+step+'ms '+ease;
            stack[g].style.transform='translateY('+cum[idx]+'px)';
          }
          tiles[pi].style.transition=inst?'none':'opacity '+fade+'ms ease '+Math.round(step*0.3)+'ms';
          tiles[pi].style.opacity='0';
          // keep the height in lockstep across phase A2 as well
          drawer.style.transition=inst?'none':'height '+step+'ms '+ease;
          drawer.style.height=Math.max(0,openH-slot*(below.length+si+1))+'px';
        },a1+si*(step+hold));
      })(s);
    }
    var aTotal=a1+tgt*(step+hold);

    // Phase B: slide stack to header. Positions are re-measured here rather than
    // reused from run() start — a layout shift during the cascade (drawer padding
    // release, font/image reflow) would otherwise land the stack above the header.
    later(function(){
      // Final collapse rides the same slide as the stack tucking under the header.
      if(!inst){
        drawer.style.transition='height '+slide+'ms '+ease+', padding '+slide+'ms '+ease+', margin '+slide+'ms '+ease;
        drawer.style.height='0px';
        drawer.style.paddingTop='0px';drawer.style.paddingBottom='0px';
        drawer.style.marginTop='0px';drawer.style.marginBottom='0px';
      }
      var hy=header.getBoundingClientRect().top;
      for(var i=tgt;i<n;i++){
        cum[i]+=hy-tiles[i].getBoundingClientRect().top;
        tiles[i].style.transition=inst?'none':'transform '+slide+'ms '+ease;
        tiles[i].style.transform='translateY('+cum[i]+'px)';
      }
      // Settle pass: if layout moved mid-slide, snap the stack flush to the header
      // (no-op in instant mode: transforms apply synchronously, so the delta is ~0)
      later(function(){
        var hy2=header.getBoundingClientRect().top;
        for(var i=tgt;i<n;i++){
          var d=hy2-tiles[i].getBoundingClientRect().top;
          if(d>0.5||d<-0.5){
            cum[i]+=d;
            tiles[i].style.transition=inst?'none':'transform 150ms '+ease;
            tiles[i].style.transform='translateY('+cum[i]+'px)';
          }
        }
      },slide+30);
    },aTotal+bDelay);

    // Fade UI
    later(function(){
      for(var i=0;i<ui.length;i++){
        if(!ui[i]) continue;
        ui[i].style.transition=inst?'none':'opacity 350ms ease';
        ui[i].style.opacity='0';
      }
    },100);

    // Prompt: position-based hide (skipped in instant mode — the prompt is removed
    // synchronously at completion below, so the rAF watcher would race a null)
    if(prompt&&!inst){
      var promptTop=prompt.getBoundingClientRect().top;
      setTimeout(function(){
        (function check(){
          if(!prompt)return;
          if(tiles[tgt].getBoundingClientRect().top<=promptTop){
            prompt.style.transition='none';prompt.style.opacity='0';
          } else { requestAnimationFrame(check); }
        })();
      },aTotal+bDelay);
    }

    // Merge: header color
    later(function(){
      header.style.borderColor=cfg.borderColor;
      header.classList.add(cfg.headerClass);
      if(cfg.goldBorder) tiles[tgt].classList.add('gold-border');
      if(_nova){
        // The stage is overflow:hidden so the folding cards stay clipped — but that would
        // also clip the burst's outer glow, so open it for the 4s and close it after.
        stage.style.overflow='visible';
        // Set inline: tiles/headers carry inline animation values that a stylesheet rule
        // cannot beat. Same keyframes, duration and easing as the winning year row.
        header.style.animation='goldSupernovaFade 4s ease-in-out forwards';
        header.classList.add('gold-supernova');   // drives the ::after shimmer sweep
        setTimeout(function(){
          header.classList.remove('gold-supernova');
          header.style.animation='none';
          header.style.borderColor=cfg.borderColor;   // keep the permanent gold outline
          stage.style.overflow='';
        },4000);
      }
      // Merge lands just as the slide finishes; derived from `slide` so the timing scales.
    },aTotal+bDelay+Math.max(0,slide-20));

    // Complete — makes the header clickable to toggle.
    // slide + 300 covers the settle pass (fires at slide+30, runs 150ms).
    total=aTotal+bDelay+slide+300;

    later(function(){
      // Remove stale pre-answer UI (attempt counter + pre-answer button row + prompt)
      // before measuring so drawer height reflects post-round content only
      for(var u=0;u<ui.length;u++){ if(ui[u]&&ui[u].parentNode) ui[u].parentNode.removeChild(ui[u]); ui[u]=null; }
      if(prompt&&prompt.parentNode){ prompt.parentNode.removeChild(prompt); prompt=null; }

      // Drawer was already collapsed at Phase B (concurrent with the slide).
      // Instant mode has no Phase B animation, so set the end-state directly here.
      if(inst){
        drawer.style.transition='none';
        drawer.style.overflow='hidden';
        drawer.style.height='0px';
        drawer.style.paddingTop='0px';
        drawer.style.paddingBottom='0px';
        drawer.style.marginTop='0px';
        drawer.style.marginBottom='0px';
      }

      header.style.cursor='pointer';
      var _arrow=header.querySelector('.bc-arrow');
      if(_arrow) _arrow.style.transform='';        // folded
      header.onclick=function(){
        if(header.dataset.anim==='1')return;
        header.dataset.anim='1';
        stage.style.overflow='';   // re-clip if the burst left it open
        var ar=header.querySelector('.bc-arrow');
        if(ar) ar.style.transform=expanded?'':'rotate(180deg)';
        if(expanded){
          // Re-fold: run() collapses the drawer itself at Phase B, so only reset state
          // when the cascade finishes. run() reassigns `total`.
          run();
          setTimeout(function(){
            expanded=false;header.dataset.anim='';
          },total);
        }else{
          // Expand: reverse() drives the drawer height in lockstep with the cards, so
          // there is no separate drop-down call to race it.
          reverse();
        }
      };
      if(!_doneFired){_doneFired=true;if(cfg.onDone) cfg.onDone();}
    },total);

    // ====== REVERSE CASCADE ======
    function reverse(){
      // The drawer grows one card slot per step alongside the cards peeling off, so the
      // page is pushed down with them.
      // Measure the natural height now, not from the stashed open height: completing a
      // round removes the prompt and the attempt/button row, so a stale value would
      // overshoot and snap back when the pin is released.
      var H=_naturalDrawerHeight(drawer);
      var spread=Math.max(0,n-1)*slot;
      var base=Math.max(0,H-spread);        // height once the pile has landed, pre-peel
      drawer.style.transition='none';
      drawer.style.overflow='hidden';
      drawer.style.height='0px';
      void drawer.offsetHeight;
      drawer.style.transition='height '+slide+'ms '+ease+', padding '+slide+'ms '+ease+', margin '+slide+'ms '+ease;
      drawer.style.height=base+'px';
      drawer.style.paddingTop='';drawer.style.paddingBottom='';
      drawer.style.marginTop='';drawer.style.marginBottom='';
      // Rev B: slide back to stacked position
      cum[tgt]=-tgt*slot;
      tiles[tgt].style.transition='transform '+slide+'ms '+ease;
      tiles[tgt].style.transform='translateY('+cum[tgt]+'px)';
      for(var i=tgt+1;i<n;i++){
        cum[i]=-i*slot;
        tiles[i].style.transition='transform '+slide+'ms '+ease;
        tiles[i].style.transform='translateY('+cum[i]+'px)';
      }

      // Un-fade UI
      for(var i=0;i<ui.length;i++){
        if(!ui[i])continue;
        ui[i].style.transition='opacity '+slide+'ms ease';
        ui[i].style.opacity='1';
      }
      // Prompt reappears when card uncovers it
      if(prompt){
        (function checkUncover(){
          if(tiles[tgt].getBoundingClientRect().top>prompt.getBoundingClientRect().top){
            prompt.style.transition='none';prompt.style.opacity='1';
          }else{requestAnimationFrame(checkUncover);}
        })();
      }

      // Rev A2: stack moves down, un-fading cards above
      for(var s=0;s<tgt;s++){
        (function(si){
          setTimeout(function(){
            cum[tgt]+=slot;
            tiles[tgt].style.transition='transform '+step+'ms '+ease;
            tiles[tgt].style.transform='translateY('+cum[tgt]+'px)';
            for(var i=tgt+1;i<n;i++){
              cum[i]+=slot;
              tiles[i].style.transition='transform '+step+'ms '+ease;
              tiles[i].style.transform='translateY('+cum[i]+'px)';
            }
            tiles[si].style.transition='opacity '+fade+'ms ease';
            tiles[si].style.opacity='1';
            drawer.style.transition='height '+step+'ms '+ease;
            drawer.style.height=(base+slot*(si+1))+'px';
          },slide+si*(step+hold));
        })(s);
      }
      var a2r=tgt*(step+hold);

      // Rev A1: cards below peel off one at a time
      for(var s=0;s<below.length;s++){
        (function(si){
          var count=below.length-si;
          setTimeout(function(){
            for(var g=0;g<count;g++){
              var card=below[g];
              var idx=+card.getAttribute('data-idx');
              cum[idx]+=slot;
              card.style.transition='transform '+step+'ms '+ease;
              card.style.transform='translateY('+cum[idx]+'px)';
            }
            drawer.style.transition='height '+step+'ms '+ease;
            drawer.style.height=(base+slot*(tgt+si+1))+'px';
          },slide+a2r+si*(step+hold));
        })(s);
      }

      var revTotal=slide+a2r+below.length*(step+hold);
      setTimeout(function(){
        // release the pin — the animated height already equals the natural one
        drawer.style.transition='none';drawer.style.height='';drawer.style.overflow='';
        expanded=true;header.dataset.anim='';
      },revTotal+40);
    }
  }
}

// ====== COLLAPSE / EXPAND ROWS ======

function collapseToLastRow(opts) {
  // opts.instant: land on the collapsed end-state with no transitions. Used by the
  // reload/restore paths, which must not replay the fold.
  var instant = opts && opts.instant;
  var rows = guessesEl.querySelectorAll('.guess-row');
  if (rows.length < 2) { _collapsed = false; return; }
  if (_histBusy) return;                                   // a fold is already in flight
  _collapsed = true;
  var els = [document.getElementById('inv-img'), document.getElementById('inv-desc'), document.getElementById('col-labels')];
  for (var i = 0; i < els.length; i++) {
    if (!els[i]) continue;
    els[i].style.overflow = 'hidden';
    if (instant) {
      els[i].style.transition = 'none';
    } else {
      els[i].style.maxHeight = els[i].scrollHeight + 'px';
      els[i].offsetHeight;
      els[i].style.transition = 'max-height 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease, margin 0.5s cubic-bezier(0.16,1,0.3,1)';
    }
    els[i].style.maxHeight = '0';
    els[i].style.opacity = '0';
    els[i].style.marginTop = '0';
    els[i].style.marginBottom = '0';
  }
  // Keeps the last row (the winning guess, or the answer row on a loss) visible on the
  // completed/bonus screen; earlier rows fold away with the same cascade the history
  // toggle uses, with the answer row riding up over them.
  _ensureGuessToggle();                                    // freeze rows + install hint first
  if (instant || rows[0].getBoundingClientRect().height < 1) {
    // Rows are already collapsed (restore re-entry) — just pin the end-state.
    for (var i = 0; i < rows.length - 1; i++) {
      rows[i].style.transition = 'none'; rows[i].style.overflow = 'hidden';
      rows[i].style.maxHeight = '0px'; rows[i].style.opacity = '0';
      rows[i].style.marginTop = '0'; rows[i].style.marginBottom = '0';
    }
    guessesEl.style.transition = 'none';
    guessesEl.style.gap = '0px';
    // same end-state _guessFoldIn's cleanup leaves: answer pinned at 0 (clearing the
    // inline value falls back to the row-slide-in start and drops it 12px)
    var ans = rows[rows.length - 1];
    ans.style.transition = 'none'; ans.style.transform = 'translateY(0px)';
    var h = document.getElementById('guess-toggle');
    if (h) { h.style.transition = 'none'; h.style.transform = 'translateY(0px)'; h.style.opacity = '1'; }
    _histOpen = false;
    return;
  }
  var hint = document.getElementById('guess-toggle');
  if (hint) hint.style.opacity = '0';                      // fades in as it rides up
  _guessFoldIn();
}

// ====== GUESS HISTORY TOGGLE ======
// The answer row stays visible after collapse; clicking it (or the hint below it) unfolds
// the earlier guess rows above it, and folds them back up again.
// The ride is one continuous transform/height transition for the whole travel. Each hidden
// row's fade is delayed to the moment the answer row crosses its slot, solved from the
// ease curve, so the cascade look survives while the motion reads as a single glide.
var _histOpen = false, _histBusy = false;

function _histLabel() {
  try { if (window.I18N) { var v = I18N.t('game.yourGuesses'); if (v && v !== 'game.yourGuesses') return v; } } catch (e) {}
  return 'Your guesses';
}

function _ensureGuessToggle() {
  _histOpen = false;
  var hint = document.getElementById('guess-toggle');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'guess-toggle';
    hint.style.cssText = 'text-align:center;font-size:0.7rem;letter-spacing:2px;text-transform:uppercase;color:var(--text3);font-weight:700;cursor:pointer;user-select:none;padding:4px 0 2px;';
    hint.onclick = _toggleGuessHistory;
  }
  hint.innerHTML = _histLabel() + ' <span id="guess-toggle-arrow" style="display:inline-block;transition:transform .38s cubic-bezier(0.4,0,0.2,1);">▼</span>';
  guessesEl.appendChild(hint); // (re)position after the answer row
  var rows = guessesEl.querySelectorAll('.guess-row');
  // Freeze each row's settled state inline BEFORE killing the entry animation.
  // rowSlideIn (fill:forwards) holds live-play rows at opacity:1/translateY(0); killing it
  // without freezing drops them to the CSS base state (opacity:0, translateY(12px)).
  for (var i = 0; i < rows.length; i++) {
    rows[i].style.opacity = '1';
    rows[i].style.transform = 'translateY(0px)';
    rows[i].style.animation = 'none';
  }
  var last = rows[rows.length - 1];
  if (last) { last.style.cursor = 'pointer'; last.onclick = _toggleGuessHistory; }
}

// Time-fraction at which cubic-bezier(0.4,0,0.2,1) reaches progress y — used to fire
// each row's fade exactly when the continuously-gliding answer row crosses its slot.
function _bezXatY(y) {
  if (y <= 0) return 0;
  if (y >= 1) return 1;
  var lo = 0, hi = 1, t = 0.5;
  for (var k = 0; k < 24; k++) {
    t = (lo + hi) / 2;
    var py = 3 * (1 - t) * t * t + t * t * t;            // y1=0, y2=1
    if (py < y) lo = t; else hi = t;
  }
  return 3 * (1 - t) * (1 - t) * t * 0.4 + 3 * (1 - t) * t * t * 0.2 + t * t * t; // x1=.4, x2=.2
}

// FOLD IN — the fold choreography for the guess history, used by both the post-answer
// collapse (collapseToLastRow) and the history toggle: the answer row and the hint under
// it glide up over the guesses in one transition, each row fading out as it is passed.
// The container height rides the same transition so everything below is pulled up too.
function _guessFoldIn() {
  var rows = guessesEl.querySelectorAll('.guess-row');
  if (rows.length < 2) return;
  _histBusy = true;
  var answer = rows[rows.length - 1];                     // the winning / answer row
  var above = Array.prototype.slice.call(rows, 0, rows.length - 1);
  var N = above.length;
  var hint = document.getElementById('guess-toggle');
  var arrow = document.getElementById('guess-toggle-arrow');
  var ez = 'cubic-bezier(0.4,0,0.2,1)', fade = 220;
  var D = Math.min(1100, 380 + N * 100);                  // one glide for the whole travel
  var H0 = guessesEl.getBoundingClientRect().height;
  var slot = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
  var gapPx = parseFloat(getComputedStyle(guessesEl).gap) || 0;
  var travel = N * slot;
  guessesEl.style.transition = 'none';
  guessesEl.style.overflow = 'hidden';
  guessesEl.style.height = H0 + 'px';                      // pin the expanded height
  guessesEl.offsetHeight;
  answer.style.transition = 'transform ' + D + 'ms ' + ez;
  answer.style.transform = 'translateY(' + (-travel) + 'px)';
  // The hint also rides over the answer-to-hint gap, which cleanup zeroes, so its animated
  // end spot equals its post-cleanup natural spot. Opacity rides the same transition: the
  // collapse path pre-sets it to 0 so the hint fades in en route.
  if (hint) {
    hint.style.transition = 'transform ' + D + 'ms ' + ez + ', opacity 400ms ease';
    hint.style.transform = 'translateY(' + (-(travel + gapPx)) + 'px)';
    hint.style.opacity = '1';
  }
  guessesEl.style.transition = 'height ' + D + 'ms ' + ez;
  guessesEl.style.height = (H0 - travel - gapPx) + 'px';   // exact collapsed height
  above.slice().reverse().forEach(function(row, si) {
    // fade out once the answer is ~30% of the way across this row's slot
    row.style.transition = 'opacity ' + fade + 'ms ease ' + Math.round(D * _bezXatY((si + 0.3) / N)) + 'ms';
    row.style.opacity = '0';
  });
  setTimeout(function() {
    // Seamless swap: drop the faded rows out of layout and zero the gap — the
    // animated height already equals the collapsed height, so nothing jumps.
    above.forEach(function(r) {
      r.style.transition = 'none'; r.style.overflow = 'hidden'; r.style.maxHeight = '0px';
      r.style.marginTop = '0'; r.style.marginBottom = '0';
    });
    guessesEl.style.gap = '0px';
    // translateY(0), not '': clearing the inline value falls back to .guess-row's CSS
    // base state (translateY(12px), the row-slide-in start), dropping the row 12px.
    answer.style.transition = 'none'; answer.style.transform = 'translateY(0px)';
    if (hint) { hint.style.transition = 'none'; hint.style.transform = 'translateY(0px)'; }
    guessesEl.style.transition = 'none';
    guessesEl.style.height = ''; guessesEl.style.overflow = '';
    _histBusy = false;
  }, D + 40);
  if (arrow) arrow.style.transform = '';
  _histOpen = false;
}

function _toggleGuessHistory() {
  if (_histBusy || !_collapsed) return;
  var rows = guessesEl.querySelectorAll('.guess-row');
  if (rows.length < 2) return;
  if (_histOpen) { _guessFoldIn(); return; }
  _histBusy = true;
  var answer = rows[rows.length - 1];                     // the winning / answer row
  var above = Array.prototype.slice.call(rows, 0, rows.length - 1);
  var N = above.length;
  var hint = document.getElementById('guess-toggle');
  var arrow = document.getElementById('guess-toggle-arrow');
  var ez = 'cubic-bezier(0.4,0,0.2,1)', fade = 220;
  var D = Math.min(1100, 380 + N * 100);                  // one glide for the whole travel
  // The container's height rides the SAME single transition as the answer row, so
  // everything below (the bonus rounds) is pushed in one smooth motion.
  var H0 = guessesEl.getBoundingClientRect().height;

  // FOLD OUT — the answer row and the hint under it glide down to their natural spot in
  // one transition; each guess row fades in as the answer crosses its slot. End heights
  // are measured, so releasing the pin cannot jump.
  var a0 = answer.getBoundingClientRect().top;
  var h0 = hint ? hint.getBoundingClientRect().top : 0;
  guessesEl.style.transition = 'none';
  guessesEl.style.overflow = 'hidden';
  guessesEl.style.height = H0 + 'px';                      // pin so restoring rows can't jump
  above.forEach(function(r) {
    r.style.transition = 'none'; r.style.maxHeight = ''; r.style.overflow = '';
    r.style.marginTop = ''; r.style.marginBottom = ''; r.style.opacity = '0';
  });
  guessesEl.style.gap = '';
  guessesEl.offsetHeight;                                  // commit layout before measuring
  var HN = guessesEl.scrollHeight;                         // true natural expanded height
  var shiftA = answer.getBoundingClientRect().top - a0;    // how far layout pushed each down
  var shiftH = hint ? hint.getBoundingClientRect().top - h0 : 0;
  answer.style.transition = 'none';
  answer.style.transform = 'translateY(' + (-shiftA) + 'px)';
  if (hint) { hint.style.transition = 'none'; hint.style.transform = 'translateY(' + (-shiftH) + 'px)'; }
  guessesEl.offsetHeight;
  answer.style.transition = 'transform ' + D + 'ms ' + ez;
  answer.style.transform = 'translateY(0px)';
  if (hint) { hint.style.transition = 'transform ' + D + 'ms ' + ez; hint.style.transform = 'translateY(0px)'; }
  guessesEl.style.transition = 'height ' + D + 'ms ' + ez;
  guessesEl.style.height = HN + 'px';
  above.forEach(function(row, i) {                         // top row first
    row.style.transition = 'opacity ' + fade + 'ms ease ' + Math.round(D * _bezXatY(i / N)) + 'ms';
    row.style.opacity = '1';
  });
  // If the answer row's landing spot falls below the visible area, ride the scroll down
  // with it, or the bottom rows end up half-hidden past the viewport.
  if (gameScroll) {
    var scB = gameScroll.getBoundingClientRect().bottom;
    var endB = answer.getBoundingClientRect().bottom + shiftA + (hint ? hint.getBoundingClientRect().height + 14 : 14);
    if (endB > scB) gameScroll.scrollTo({ top: gameScroll.scrollTop + (endB - scB), behavior: 'smooth' });
  }
  setTimeout(function() {
    answer.style.transition = 'none'; answer.style.transform = 'translateY(0px)';
    if (hint) { hint.style.transition = 'none'; hint.style.transform = 'translateY(0px)'; }
    guessesEl.style.transition = 'none';
    guessesEl.style.height = ''; guessesEl.style.overflow = '';   // natural === HN, no jump
    _histBusy = false;
  }, D + 40);
  if (arrow) arrow.style.transform = 'rotate(180deg)';
  _histOpen = true;
}

// ====== BONUS ROUND HELPERS ======

function getContinent(country) {
  var c = country.toLowerCase();
  var europe = ['germany', 'france', 'italy', 'spain', 'portugal', 'netherlands', 'belgium', 'switzerland', 'austria', 'sweden', 'norway', 'denmark', 'finland', 'iceland', 'ireland', 'poland', 'czech republic', 'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'england', 'scotland', 'wales', 'croatia', 'serbia', 'bosnia', 'montenegro', 'north macedonia', 'albania', 'slovenia', 'moldova', 'georgia', 'armenia', 'azerbaijan', 'luxembourg', 'malta', 'monaco', 'liechtenstein', 'andorra', 'san marino', 'vatican city', 'kosovo', 'estonia', 'latvia', 'lithuania', 'ukraine', 'belarus', 'russia'];
  var asia = ['china', 'japan', 'south korea', 'north korea', 'taiwan', 'mongolia', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'bhutan', 'myanmar', 'thailand', 'vietnam', 'cambodia', 'laos', 'malaysia', 'singapore', 'indonesia', 'philippines', 'brunei', 'east timor', 'afghanistan', 'iran', 'iraq', 'syria', 'lebanon', 'israel', 'palestine', 'jordan', 'saudi arabia', 'yemen', 'oman', 'united arab emirates', 'qatar', 'bahrain', 'kuwait', 'turkey', 'cyprus', 'kazakhstan', 'uzbekistan', 'turkmenistan', 'kyrgyzstan', 'tajikistan'];
  var africa = ['egypt', 'libya', 'tunisia', 'algeria', 'morocco', 'sudan', 'south sudan', 'ethiopia', 'eritrea', 'somalia', 'djibouti', 'kenya', 'uganda', 'tanzania', 'rwanda', 'burundi', 'democratic republic of the congo', 'cameroon', 'nigeria', 'ghana', 'senegal', 'mali', 'niger', 'chad', 'south africa', 'zimbabwe', 'mozambique', 'madagascar', 'namibia', 'botswana'];
  var namerica = ['usa', 'united states', 'canada', 'mexico', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua', 'costa rica', 'panama', 'cuba', 'jamaica', 'haiti', 'dominican republic', 'trinidad and tobago', 'barbados', 'greenland'];
  var samerica = ['colombia', 'venezuela', 'ecuador', 'peru', 'bolivia', 'brazil', 'paraguay', 'uruguay', 'argentina', 'chile', 'guyana', 'suriname'];
  var oceania = ['australia', 'new zealand', 'papua new guinea', 'fiji', 'samoa', 'tonga'];
  if (europe.indexOf(c) !== -1) return 'Located in Europe';
  if (asia.indexOf(c) !== -1) return 'Located in Asia';
  if (africa.indexOf(c) !== -1) return 'Located in Africa';
  if (namerica.indexOf(c) !== -1) return 'Located in North America';
  if (samerica.indexOf(c) !== -1) return 'Located in South America';
  if (oceania.indexOf(c) !== -1) return 'Located in Oceania';
  // Fallback for historical entities
  var hist = { 'mesopotamia': 'Asia', 'sumer': 'Asia', 'babylon': 'Asia', 'assyria': 'Asia', 'persia': 'Asia', 'phoenicia': 'Asia', 'ottoman empire': 'Asia/Europe', 'byzantine empire': 'Asia/Europe', 'roman empire': 'Europe', 'ancient greece': 'Europe', 'holy roman empire': 'Europe', 'prussia': 'Europe', 'kingdom of france': 'Europe' };
  var h = hist[c]; if (h) return 'Located in ' + h;
  return 'Location hint unavailable';
}

function checkCountry(g) {
  var t = g.trim().toLowerCase();
  var targets = [_e.country.modern, _e.country.endonym, _e.country.historical];
  var mod = _e.country.modern.toLowerCase();
  if (mod === 'england' || mod === 'scotland' || mod === 'wales') {
    targets.push('United Kingdom');
    targets.push('UK');
  }
  return targets.some(function(c) { return c.toLowerCase() === t; });
}

function checkInventor(g) {
  var t = g.trim().toLowerCase();
  var inv = _e.inventor.toLowerCase();
  if (t === inv) return true;
  var parts = _e.inventor.split(/\s+/);
  if (parts.length > 1 && t === parts[parts.length - 1].toLowerCase()) return true;
  var entry = findInventorEntry(_e.inventor);
  if (entry) {
    for (var j = 0; j < entry.entry.a.length; j++) {
      if (entry.entry.a[j].toLowerCase() === t) return true;
    }
  }
  // Check alt inventors (from data-overlay.js)
  if (typeof _altInventors !== 'undefined' && _altInventors[_ix]) {
    var alts = _altInventors[_ix];
    for (var i = 0; i < alts.length; i++) {
      if (alts[i].toLowerCase() === t) return true;
      var altParts = alts[i].split(/\s+/);
      if (altParts.length > 1 && t === altParts[altParts.length - 1].toLowerCase()) return true;
      var altEntry = findInventorEntry(alts[i]);
      if (altEntry) {
        for (var j = 0; j < altEntry.entry.a.length; j++) {
          if (altEntry.entry.a[j].toLowerCase() === t) return true;
        }
      }
    }
  }
  return false;
}

function isGroupInventor(name) {
  var lname = name.toLowerCase();
  for (var i = 0; i < _ig.length; i++) {
    for (var j = 0; j < _ig[i].a.length; j++) {
      if (_ig[i].a[j].toLowerCase() === lname) return true;
    }
  }
  var kw = ['Ancient', 'Sumerians', 'Romans', 'Egyptians', 'Chinese', 'Dynasty', 'People', 'Celts', 'Greeks', 'Babylonians', 'Persians', 'Phoenicians', 'Mayans', 'Aztecs', 'Incas', 'Mesopotamian', 'Medieval', 'Civilization', 'Empire', 'Kingdom', 'Tribe', 'Society', 'Culture', 'Ottoman', 'Viking', 'Norse', 'Arab', 'Islamic', 'Indian', 'Hindu', 'Buddhist', 'Mongol', 'Byzantine', 'Aboriginal', 'Indigenous', 'Polynesian', 'African', 'European', 'Asian'];
  return kw.some(function(w) { return lname.indexOf(w.toLowerCase()) !== -1; });
}

function findInventorEntry(inventor) {
  var lname = inventor.toLowerCase();
  for (var i = 0; i < _ip.length; i++) {
    for (var j = 0; j < _ip[i].a.length; j++) {
      if (_ip[i].a[j].toLowerCase() === lname) return { entry: _ip[i], list: 'people' };
    }
  }
  for (var i = 0; i < _ig.length; i++) {
    for (var j = 0; j < _ig[i].a.length; j++) {
      if (_ig[i].a[j].toLowerCase() === lname) return { entry: _ig[i], list: 'group' };
    }
  }
  return null;
}

// Seeded RNG and shuffle (deterministic for reproducible MC choices)
function seededRng(seed) {
  var s = Math.abs(seed | 0) || 1;
  return function() { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}

function seededShuffle(arr, rng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Keep short aliases for backward compatibility
var _srng = seededRng;
var _sshuffle = seededShuffle;

function _getContOf(c) {
  var r = getContinent(c);
  if (r === 'Location hint unavailable') return null;
  return r.replace('Located in ', '');
}

function _clName(country) {
  var c = country.toLowerCase();
  for (var i = 0; i < _cl.length; i++) {
    for (var j = 0; j < _cl[i].a.length; j++) {
      if (_cl[i].a[j].toLowerCase() === c) return _cl[i].name;
    }
  }
  return country;
}

function _isOrgName(name) {
  return /^[A-Z]{2,}$/.test(name) || /\b(Labs?|Inc|Corp|Company|Army|Navy|Department|Institute|University|Foundation)\b/i.test(name) || /^(IBM|NASA|ARPA|AEG|NCR|Apple|Amazon|Google|Sony|Philips|Xerox|iRobot|Ansell|Pebble|Calgene|Samsung)\b/i.test(name.split(/\s/)[0]);
}

// generateB1Choices — takes a seed parameter
function generateB1Choices(seed) {
  var rng = seededRng(seed);
  var correctName = _clName(_e.country.modern);
  var correctCont = _getContOf(_e.country.modern);
  var sameCont = [], others = [];
  for (var i = 0; i < _cl.length; i++) {
    var n = _cl[i].name;
    if (n.toLowerCase() === correctName.toLowerCase() || checkCountry(n)) continue;
    var cont = _getContOf(n);
    if (correctCont && cont === correctCont) sameCont.push(n);
    else others.push(n);
  }
  sameCont = seededShuffle(sameCont, rng);
  others = seededShuffle(others, rng);
  var choices = [correctName];
  choices.push(sameCont.length > 0 ? sameCont[0] : others.shift());
  for (var i = 0; i < 3 && others.length > 0; i++) choices.push(others[i]);
  while (choices.length < 5 && sameCont.length > choices.length - 1) choices.push(sameCont[choices.length - 1]);
  return seededShuffle(choices, rng);
}

// generateB2Choices — takes a seed parameter
function generateB2Choices(seed) {
  var rng = seededRng(seed);
  var inventor = _e.inventor;
  if (inventor.toLowerCase() === 'unknown') return [];

  // Spoiler troll choices: hardcoded funny wrong answers for name-in-invention entries
  if (typeof _spoilerChoices !== 'undefined' && _spoilerChoices[_ix]) {
    var trollWrong = _spoilerChoices[_ix];
    var choices = [inventor];
    for (var i = 0; i < trollWrong.length; i++) choices.push(trollWrong[i]);
    return seededShuffle(choices, rng);
  }

  // Multi-inventor: pick 2 random correct + 3 random wrong
  if (typeof _altInventors !== 'undefined' && _altInventors[_ix] && _altInventors[_ix].length > 0) {
    var alts = _altInventors[_ix];
    var allCorrect = [inventor].concat(alts);
    // Per-user salt so different users see different correct pair
    var userSalt = 0;
    try { var p = loadPrefs(); if (p.uid) userSalt = p.uid; } catch(e) {}
    var rng2 = seededRng(seed + userSalt);
    var shuffledCorrect = seededShuffle(allCorrect, rng2);
    var correctPair = shuffledCorrect.slice(0, 2);
    // Build wrong pool excluding ALL correct inventors
    var correctSet = {};
    for (var i = 0; i < allCorrect.length; i++) correctSet[allCorrect[i].toLowerCase()] = true;
    var wrongPool = [];
    for (var i = 0; i < _ip.length; i++) {
      if (!correctSet[_ip[i].name.toLowerCase()]) wrongPool.push(_ip[i].name);
    }
    wrongPool = seededShuffle(wrongPool, rng);
    var choices = correctPair.slice();
    while (choices.length < 5 && wrongPool.length > 0) choices.push(wrongPool.shift());
    return seededShuffle(choices, rng);
  }

  var isGroup = isGroupInventor(inventor);

  if (isGroup) {
    var others = [];
    for (var i = 0; i < _ig.length; i++) {
      if (_ig[i].name.toLowerCase() !== inventor.toLowerCase()) others.push(_ig[i].name);
    }
    others = seededShuffle(others, rng);
    var choices = [inventor];
    for (var i = 0; i < 4 && i < others.length; i++) choices.push(others[i]);
    return seededShuffle(choices, rng);
  }

  var isOrg = _isOrgName(inventor);
  if (isOrg) {
    var otherOrgs = [], rest = [];
    for (var i = 0; i < _ip.length; i++) {
      if (_ip[i].name.toLowerCase() === inventor.toLowerCase()) continue;
      if (_isOrgName(_ip[i].name)) otherOrgs.push(_ip[i].name);
      else rest.push(_ip[i].name);
    }
    otherOrgs = seededShuffle(otherOrgs, rng);
    rest = seededShuffle(rest, rng);
    var pool = seededShuffle(rest.concat(otherOrgs.slice(1)), rng);
    var choices = [inventor];
    choices.push(otherOrgs.length > 0 ? otherOrgs[0] : pool.shift());
    for (var i = 0; i < 3 && pool.length > 0; i++) choices.push(pool[i]);
    return seededShuffle(choices, rng);
  }

  // Person: correct + 1 from same country + 3 random
  var sameCountryPeople = [];
  var cc = _e.country.modern.toLowerCase();
  for (var i = 0; i < _d.length; i++) {
    if (i === _ix) continue;
    var inv = _d[i].inventor;
    if (_d[i].country.modern.toLowerCase() === cc && inv.toLowerCase() !== 'unknown' && !isGroupInventor(inv) && inv.toLowerCase() !== inventor.toLowerCase()) {
      if (sameCountryPeople.indexOf(inv) === -1) sameCountryPeople.push(inv);
    }
  }
  sameCountryPeople = seededShuffle(sameCountryPeople, rng);
  var choices = [inventor];
  if (sameCountryPeople.length > 0) choices.push(sameCountryPeople[0]);
  var used = {};
  for (var i = 0; i < choices.length; i++) used[choices[i].toLowerCase()] = true;
  var pool = [];
  for (var i = 0; i < _ip.length; i++) {
    if (!used[_ip[i].name.toLowerCase()]) pool.push(_ip[i].name);
  }
  pool = seededShuffle(pool, rng);
  while (choices.length < 5 && pool.length > 0) choices.push(pool.shift());
  return seededShuffle(choices, rng);
}

// ====== AD MODAL ======

function showAdModal(buttons) {
  var modal = document.getElementById('m-ad');
  var btnsEl = document.getElementById('ad-btns');
  btnsEl.innerHTML = '';
  btnsEl.style.flexDirection = 'column'; btnsEl.style.alignItems = 'center';
  function _ab(b) {
    var btn = document.createElement('button');
    btn.className = 'continue-btn'; btn.textContent = b.text;
    btn.style.opacity = '1'; btn.style.transform = 'none'; btn.style.animation = 'none'; btn.style.marginTop = '0';
    if (b.secondary) { btn.style.background = 'var(--surface)'; btn.style.color = 'var(--text2)'; btn.style.border = '2px solid var(--border)'; }
    (function(cb) { btn.onclick = function() { modal.classList.remove('show'); cb(); }; })(b.onclick);
    return btn;
  }
  if (buttons.length > 2) {
    btnsEl.style.flexDirection = 'column'; btnsEl.style.alignItems = 'center';
    var topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';
    for (var i = 0; i < buttons.length - 1; i++) topRow.appendChild(_ab(buttons[i]));
    btnsEl.appendChild(topRow);
    btnsEl.appendChild(_ab(buttons[buttons.length - 1]));
  } else if (buttons.length === 2) {
    btnsEl.style.flexDirection = 'row'; btnsEl.style.alignItems = 'center'; btnsEl.style.justifyContent = 'center'; btnsEl.style.gap = '8px';
    for (var i = 0; i < buttons.length; i++) btnsEl.appendChild(_ab(buttons[i]));
  } else {
    for (var i = 0; i < buttons.length; i++) btnsEl.appendChild(_ab(buttons[i]));
  }
  var dismiss = document.getElementById('support-dismiss');
  if (dismiss) dismiss.onclick = function(e) { e.preventDefault(); modal.classList.remove('show'); };
  modal.classList.add('show');
}

// ====== GENERAL HELPERS ======

function _mkKeepBtn() {
  var b = document.createElement('a'); b.className = 'continue-btn'; b.textContent = 'Keep Playing';
  b.href = 'infinite.html'; b.style.cssText = 'margin-top:0;text-decoration:none;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  return b;
}

// ====== SETTINGS WIRING ======

function openSettings() {
  var p = loadPrefs();
  document.getElementById('set-dark').checked = (p.theme || 'dark') === 'dark';
  document.getElementById('set-spin').checked = p.spin !== false;
  document.getElementById('set-glow').checked = p.glow !== false;
  var sf = document.getElementById('set-sound'); if (sf) sf.checked = p.sound !== false;
  document.getElementById('set-scheme-btn').checked = p.schemeBtn === true;
  var rb = document.getElementById('set-rainbow'); if (rb) rb.checked = p.rainbow === true;
  var btns = document.querySelectorAll('.scheme-btn');
  btns.forEach(function(b) { b.classList.toggle('active', parseInt(b.getAttribute('data-scheme')) === (p.scheme || 0)); });
  document.getElementById('m-settings').classList.add('show');
}

function wireSettings() {
  // Settings button
  document.getElementById('btn-settings').onclick = openSettings;

  // Header sound button: same pref as the Sound Effects switch in settings
  var soundBtn = document.getElementById('btn-sound');
  if (soundBtn) soundBtn.onclick = toggleSoundPref;
  document.getElementById('x-settings').onclick = function() { document.getElementById('m-settings').classList.remove('show'); };

  // Dark mode toggle
  document.getElementById('set-dark').onchange = function() {
    var p = loadPrefs(); p.theme = this.checked ? 'dark' : 'light'; savePrefs(p); setTheme(p.theme);
  };

  // Color scheme cycle button (header)
  (function() {
    var btn = document.getElementById('btn-scheme'); if (!btn) return;
    btn.onclick = function() {
      document.body.classList.remove('no-color-transition');
      var p = loadPrefs(); var from = p.scheme != null ? p.scheme : 0; var s = (from + 1) % 4; p.scheme = s; savePrefs(p);
      animatedSetScheme(from, s);
      document.querySelectorAll('.scheme-btn').forEach(function(x) { x.classList.toggle('active', parseInt(x.getAttribute('data-scheme')) === s); });
    };
  })();

  // Color scheme buttons (settings) — only target buttons with data-scheme attribute
  document.querySelectorAll('.scheme-btn[data-scheme]').forEach(function(b) {
    b.onclick = function() {
      document.body.classList.remove('no-color-transition');
      var s = parseInt(this.getAttribute('data-scheme'));
      var p = loadPrefs(); var from = p.scheme != null ? p.scheme : 0; p.scheme = s; savePrefs(p);
      animatedSetScheme(from, s);
      document.querySelectorAll('.scheme-btn[data-scheme]').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
    };
  });

  // Spin toggle
  document.getElementById('set-spin').onchange = function() { var p = loadPrefs(); p.spin = this.checked; savePrefs(p); };

  // Glow toggle
  document.getElementById('set-glow').onchange = function() { var p = loadPrefs(); p.glow = this.checked; savePrefs(p); };

  // Sound toggle (sound.js reads wi_prefs.sound on every play, so this takes effect instantly)
  var sndToggle = document.getElementById('set-sound');
  if (sndToggle) sndToggle.onchange = function() {
    var p = loadPrefs(); p.sound = this.checked; savePrefs(p);
    syncSoundBtn();                 // the header icon follows the switch
  };

  // Rainbow toggle
  var rbToggle = document.getElementById('set-rainbow');
  if (rbToggle) {
    rbToggle.onchange = function() { var p = loadPrefs(); p.rainbow = this.checked; savePrefs(p); var el = document.querySelector('.logo-stats-text'); if (el) el.classList.toggle('no-rainbow', !this.checked); };
  }

  // Color blind button toggle
  document.getElementById('set-scheme-btn').onchange = function() {
    var p = loadPrefs(); p.schemeBtn = this.checked; savePrefs(p);
    var sb = document.getElementById('btn-scheme');
    if (sb) sb.style.display = this.checked ? '' : 'none';
  };

  // Background theme buttons
  var bgBtns = document.getElementById('bg-theme-btns');
  if (bgBtns) {
    var btns = bgBtns.querySelectorAll('.scheme-btn');
    var p = loadPrefs();
    btns.forEach(function(b) {
      var t = b.getAttribute('data-bg-theme');
      if (t === (p.bgTheme || '')) b.classList.add('active');
      b.onclick = function() {
        var theme = this.getAttribute('data-bg-theme');
        var pr = loadPrefs();
        pr.bgTheme = theme || '';
        savePrefs(pr);
        if (theme) document.body.setAttribute('data-bg-theme', theme);
        else document.body.removeAttribute('data-bg-theme');
        btns.forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
      };
    });
  }
}

// ====== DOM REFERENCES ======
// These are set up after DOMContentLoaded is guaranteed (scripts at bottom of body)
var guessesEl = document.getElementById('guesses');
var inputRow = document.getElementById('input-row');
var inputEra = document.getElementById('input-era');
var numpadEl = document.getElementById('numpad');
var bonusArea = document.getElementById('bonus-area');
var gameScroll = document.getElementById('game-scroll');

// Wire era toggle click
inputEra.onclick = function() { if (!over) toggleEra(); };

// ====== SERVICE WORKER ======
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function() {});
}
