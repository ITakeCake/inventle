// ============================================================================
// sound.js — sound effects. Load AFTER core.js + game.js/infinite.js.
//
// Two sound sources: mp3 files in sounds/, decoded once and played through the TRIM
// table below, and sounds synthesised at runtime from oscillators and noise.
// Slots set to null in FX are wired but have no sound assigned.
//
// Respects the "Sound Effects" setting (wi_prefs.sound); off means silence.
// ============================================================================
(function () {
  'use strict';

  function soundOn() {
    // reads wi_prefs from localStorage directly: only core.js defines a global
    // loadPrefs(), and the aux pages keep their pref helpers private
    try {
      var p = JSON.parse(localStorage.getItem('wi_prefs')) || {};
      return p.sound !== false;
    } catch (e) { return true; }
  }

  var ctx = null, master = null, armed = false;
  // Building the graph and resuming it are separate steps: a context can be created and
  // decoded into before any user gesture, only playback needs the gesture.
  function buildCtx() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 6;
      master.gain.value = 0.55;
      master.connect(comp); comp.connect(ctx.destination);
    }
    return ctx;
  }
  function AC() {
    if (!buildCtx()) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Generators connect to out(), not master, so a sound can be wrapped in its own gain
  // node for level-matching. Requires every effect to schedule its layers synchronously.
  var dest = null;
  function out() { return dest || master; }
  function withGain(v, fn) {
    var c = AC(); if (!c) return fn();
    var g = c.createGain(); g.gain.value = v; g.connect(master);
    var prev = dest; dest = g;
    try { fn(); } finally { dest = prev; }
  }

  // ------------------------------------------------------------- primitives
  var _nb = null;
  function noiseBuf() {
    var c = AC();
    if (!_nb || _nb.sampleRate !== c.sampleRate) {
      var len = Math.ceil(c.sampleRate * 2);
      _nb = c.createBuffer(1, len, c.sampleRate);
      var d = _nb.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return _nb;
  }

  function tone(o) {
    var c = AC(); if (!c) return;
    var t = c.currentTime + (o.at || 0), d = o.dur || 0.12;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.wave || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.f), t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + d);
    var peak = o.g == null ? 0.22 : o.g;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    var tail = g;
    if (o.filter) {
      var f = c.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.ff || 1200; f.Q.value = o.q || 1;
      g.connect(f); tail = f;
    }
    osc.connect(g); tail.connect(out());
    osc.start(t); osc.stop(t + d + 0.04);
  }

  function noise(o) {
    var c = AC(); if (!c) return;
    var t = c.currentTime + (o.at || 0), d = o.dur || 0.1;
    var src = c.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
    var f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(Math.max(20, o.f || 1200), t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + d);
    f.Q.value = o.q || 1;
    var g = c.createGain();
    var peak = o.g == null ? 0.18 : o.g;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(out());
    src.start(t); src.stop(t + d + 0.04);
  }

  // inharmonic struck-metal partials — what makes bells ring instead of beep
  function bell(f0, o) {
    o = o || {};
    var r = [1, 2.76, 5.40, 8.93, 13.34], a = [1, 0.5, 0.3, 0.17, 0.09];
    for (var i = 0; i < r.length; i++) {
      tone({ f: f0 * r[i], dur: (o.dur || 2.4) * (1 - i * 0.12), g: (o.g == null ? 0.12 : o.g) * a[i],
             wave: 'sine', atk: 0.006, at: (o.at || 0) + i * 0.012 });
    }
  }

  // slow swelling chord opening through a filter
  function pad(freqs, o) {
    o = o || {};
    var c = AC(); if (!c) return;
    var t = c.currentTime, d = o.dur || 1.8;
    var g = c.createGain(), peak = o.g == null ? 0.13 : o.g;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || 0.4));
    g.gain.setValueAtTime(peak, t + d * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    var f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(360, t);
    f.frequency.linearRampToValueAtTime(o.cut || 2600, t + d * 0.55);
    g.connect(f); f.connect(out());
    freqs.forEach(function (fr, i) {
      var osc = c.createOscillator();
      osc.type = o.wave || 'sine';
      osc.frequency.value = fr;
      osc.detune.value = i % 2 ? 7 : -7;
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 4.2 + i * 0.35; lg.gain.value = 4;
      lfo.connect(lg); lg.connect(osc.detune);
      osc.connect(g);
      osc.start(t); osc.stop(t + d + 0.06);
      lfo.start(t); lfo.stop(t + d + 0.06);
    });
  }

  // ----------------------------------------------------------- audio files
  // Absolute paths: pages are served at extensionless URLs (/infinite), so a
  // relative path would resolve differently depending on the route.
  var SND = {
    keyPress:   '/sounds/key-press.mp3',
    backspace:  '/sounds/backspace.mp3',
    enter:      '/sounds/enter-button-press.mp3',
    win:        '/sounds/win-success.mp3',
    lose:       '/sounds/lose-wrong-answer.mp3',
    bonusOk:    '/sounds/bonus-correct.mp3',
    bonusErr:   '/sounds/bonus-error.mp3',
    strike:     '/sounds/strike-hit.mp3',
    shieldGain: '/sounds/shield-gain.mp3',
    shieldLose: '/sounds/shield-lose.mp3'
  };

  // Playback trim per file, in seconds.
  //   off      skip the encoder's leading silence
  //   len      stop early; omitted where the full tail is wanted
  //   fade     ramp the last few ms so the cut is not itself an audible click
  //   trebleCut fraction of amplitude removed above trebleHz (0.10 = 10% quieter)
  // key-press and backspace each contain two events (key down, key up) and are cut
  // before the second.
  var TRIM = {
    '/sounds/key-press.mp3':          { off: 0.038, len: 0.087, fade: 0.025, trebleCut: 0.10, trebleHz: 2600 },
    '/sounds/backspace.mp3':          { off: 0.066, len: 0.066, fade: 0.022 },
    '/sounds/win-success.mp3':        { off: 0.640 },
    '/sounds/lose-wrong-answer.mp3':  { off: 0.040 },
    '/sounds/bonus-correct.mp3':      { off: 0.014 },
    '/sounds/bonus-error.mp3':        { off: 0.060 },
    '/sounds/strike-hit.mp3':         { off: 0.055, len: 1.740, fade: 0.500 },
    '/sounds/shield-gain.mp3':        { off: 0.018, len: 2.050, fade: 0.500 },
    '/sounds/shield-lose.mp3':        { off: 0.050, len: 1.900, fade: 0.500 }
  };

  var _buf = {}, _pending = {};
  function loadSample(url) {
    if (_buf[url] || _pending[url] || !buildCtx()) return;
    _pending[url] = 1;
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return buildCtx().decodeAudioData(ab); })
      .then(function (b) { _buf[url] = b; delete _pending[url]; })
      .catch(function () { delete _pending[url]; });   // a missing file must never break the game
  }

  function sample(url, o) {
    o = o || {};
    var b = _buf[url];
    if (!b) {
      loadSample(url);
      // a click that beats its own download still ticks instead of going dead
      if (o.fb) { try { o.fb(); } catch (e) {} }
      return;
    }
    var c = AC(); if (!c) return;
    var src = c.createBufferSource(), g = c.createGain();
    src.buffer = b;
    src.connect(g);

    var tr = TRIM[url] || {}, chain = g;
    if (tr.trebleCut) {
      var sh = c.createBiquadFilter();
      sh.type = 'highshelf';
      sh.frequency.value = tr.trebleHz || 3500;
      sh.gain.value = 20 * Math.log(1 - tr.trebleCut) / Math.LN10;
      g.connect(sh); chain = sh;
    }
    chain.connect(out());

    var off = o.off != null ? o.off : (tr.off || 0);
    var len = o.len != null ? o.len : tr.len;
    var fade = o.fade != null ? o.fade : tr.fade;
    // clamp to the buffer, or the fade would be scheduled past the end and never apply
    var avail = b.duration - off;
    if (len == null || len > avail) len = avail;
    if (fade > len) fade = len * 0.5;

    var vol = o.g == null ? 1 : o.g, t = c.currentTime;
    g.gain.setValueAtTime(vol, t);
    if (len && fade) {
      g.gain.setValueAtTime(vol, t + Math.max(0.001, len - fade));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    }
    src.start(t, off, len);
  }

  // ------------------------------------------------------------- the sounds
  // null = the hook is live but no sound is assigned to that slot
  // stand-in tick while a key sound's file is still downloading
  function fbTick() {
    noise({ f: 1800, dur: 0.02, g: 0.25, q: 8, atk: 0.001 });
    tone({ f: 180, f2: 120, dur: 0.03, g: 0.18, wave: 'triangle', atk: 0.001 });
  }

  var FX = {
    click:      function () { sample(SND.keyPress,   { g: 0.50, fb: fbTick }); },
    keyDelete:  function () { sample(SND.backspace,  { g: 0.9,  fb: fbTick }); },
    keyEnter:   function () { sample(SND.enter,      { g: 0.85, fb: fbTick }); },
    win:        function () { sample(SND.win,        { g: 0.85 }); },
    lose:       function () { sample(SND.lose,       { g: 0.85 }); },
    bonusCorrect: function () { sample(SND.bonusOk,  { g: 0.9 }); },
    bonusWrong: function () { sample(SND.bonusErr,   { g: 0.9 }); },
    strike:     function () { sample(SND.strike,     { g: 0.9 }); },
    shieldGain: function () { sample(SND.shieldGain, { g: 0.9 }); },
    shieldLose: function () { sample(SND.shieldLose, { g: 0.9 }); },

    // Metal stop — a digit landing
    digitStop: function () {
      tone({ f: 1180, dur: 0.16, g: 0.12, wave: 'triangle' });
      tone({ f: 1790, dur: 0.10, g: 0.07, wave: 'triangle', at: 0.004 });
      noise({ f: 3000, dur: 0.02, g: 0.10, filter: 'highpass' });
    },
    // Orchestra hit — the year boxes bursting gold
    glow: function () {
      [65, 131, 196, 262, 392].forEach(function (f, i) {
        tone({ f: f, dur: 1.9 - i * 0.18, g: 0.17 - i * 0.018, wave: 'sawtooth', filter: 'lowpass', ff: 1800 + i * 300, atk: 0.012 });
      });
      noise({ f: 4000, f2: 700, dur: 0.5, g: 0.14, q: 0.9, atk: 0.002 });
      tone({ f: 49, f2: 33, dur: 2.2, g: 0.24, wave: 'sine', atk: 0.015 });
    },
    // Sub bloom — the bonus round's title card bursting gold
    glowBonus: function () {
      tone({ f: 90, f2: 34, dur: 2.4, g: 0.30, wave: 'sine', atk: 0.010 });
      noise({ f: 3000, dur: 0.04, g: 0.14, filter: 'highpass', atk: 0.001 });
      [2093, 2637, 3136, 3520].forEach(function (f, i) { bell(f, { dur: 1.6 - i * 0.2, g: 0.05, at: 0.12 + i * 0.14 }); });
      pad([262, 392], { dur: 2.0, atk: 0.35, g: 0.06, cut: 2600 });
    },
    // Split-flap — three beats in 90ms: card released, falling, slapping into the stack
    eraToggle: function () {
      noise({ f: 2600, dur: 0.006, g: 0.13, filter: 'highpass', atk: 0.0005 });
      noise({ f: 1400, f2: 520, dur: 0.045, g: 0.10, q: 1.4, atk: 0.004, at: 0.006 });
      noise({ f: 1100, dur: 0.016, g: 0.26, q: 7, atk: 0.0006, at: 0.050 });
      tone({ f: 176, f2: 104, dur: 0.055, g: 0.25, wave: 'triangle', atk: 0.0009, at: 0.050 });
      noise({ f: 1900, dur: 0.010, g: 0.09, q: 9, atk: 0.0006, at: 0.078 });
    },

    fold: null,
    unfold: null,
    modalOpen: null,
    modalClose: null
  };

  // Per-sound output trim. The mp3 files are mastered near full scale and are several
  // times hotter than the synthesised sounds, so they are pulled down to match.
  var LEVEL = {
    win: 0.355,
    lose: 0.313,
    bonusWrong: 0.458,
    bonusCorrect: 0.29,
    strike: 0.41,
    shieldLose: 0.71,
    glow: 0.66,
    glowBonus: 0.66
  };

  function play(id) {
    if (!armed || !soundOn()) return;
    var fn = FX[id];
    if (typeof fn !== 'function') return;
    var lv = LEVEL[id];
    var run = function () { try { lv ? withGain(lv, fn) : fn(); } catch (e) {} };
    var c = AC();
    // On the first gesture the context is still suspended, and audio scheduled
    // before the output hardware starts is dropped. Defer until the clock is live,
    // with a timeout fallback so a stuck promise cannot mute the sound.
    if (c && c.state !== 'running') {
      var done = false;
      var kick = function () {
        if (done) return; done = true;
        try { c.removeEventListener('statechange', onSt); } catch (e) {}
        run();
      };
      var onSt = function () { if (c.state === 'running') kick(); };
      try { c.addEventListener('statechange', onSt); } catch (e) {}
      try { c.resume().then(kick, kick); } catch (e) {}
      setTimeout(kick, 700);
      return;
    }
    run();
  }

  var lastAt = {};
  function playOnce(id, ms) {
    var n = Date.now();
    if (lastAt[id] && n - lastAt[id] < (ms || 250)) return;
    lastAt[id] = n; play(id);
  }

  // ------------------------------------------------- spinning digits (loop)
  // Ratchet crank: a slow, chunky mechanical ratchet — one click per tooth.
  var spinOpen = 0, spinOn = false, spinIv = null, spinGuard = null;
  function spinStart() {
    if (spinOn || !armed || !soundOn()) return;
    spinOn = true;
    var i = 0;
    spinIv = setInterval(function () {
      i++;
      noise({ f: 1100 + (i % 2) * 220, dur: 0.035, g: 0.21, q: 5 });
      tone({ f: 152 + (i % 3) * 22, f2: 82, dur: 0.05, g: 0.14, wave: 'triangle' });
    }, 62);
    clearTimeout(spinGuard);
    spinGuard = setTimeout(spinStop, 8000);   // never leave a loop running
  }
  function spinStop() {
    if (!spinOn) return;
    spinOn = false; clearTimeout(spinGuard); clearInterval(spinIv); spinIv = null;
  }

  // ------------------------------------------------------------- DOM hooks
  // Everything clickable site-wide, not just game controls. closest() matches the
  // innermost element, so nested cases like <a><button></button></a> fire once.
  var CLICKABLE = 'button,a,[role="button"],summary,select,label.toggle,' +
                  '.np-key,.continue-btn,.mc-option,.bonus-collapse,.modal-x,' +
                  '.input-era,.nav-item,#guess-toggle,.guess-row,.scheme-btn,.lang-item,' +
                  '.gp-card,.gp-detail-back,.gp-range-btn,.gp-graph-btn,.gp-mode-btn';

  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || t.nodeType !== 1 || !t.closest) return;
    armed = true; AC();
    var el = t.closest(CLICKABLE);
    if (!el) return;
    // ENTER and DEL are matched on the classes buildNumpad() assigns, not on label
    // text, which is translated into 14 languages.
    if (el.classList.contains('np-key') && el.classList.contains('enter')) { play('keyEnter'); return; }
    if (el.classList.contains('np-key') && el.classList.contains('del')) { play('keyDelete'); return; }
    play('click');
  }, true);

  // physical keyboard mirrors the numpad (a different input source, so no double-fire)
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (document.querySelector('.modal-bg.show,.ad-modal-bg.show')) return;
    var k = e.key;
    if (k !== 'Enter' && k !== 'Backspace' && k !== 'Delete' && !/^[0-9]$/.test(k)) return;
    armed = true; AC();
    if (k === 'Enter') play('keyEnter');
    else if (k === 'Backspace' || k === 'Delete') play('keyDelete');
    else play('click');
  }, true);

  function has(node, sel) {
    if (node.classList && node.classList.contains(sel)) return true;
    return node.querySelector ? !!node.querySelector('.' + sel) : false;
  }

  // spinner elements appearing/vanishing drive the reel loop and each digit landing
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      for (var i = 0; i < m.addedNodes.length; i++) {
        var a = m.addedNodes[i];
        if (a.nodeType !== 1) continue;
        var n = 0;
        if (a.classList && (a.classList.contains('spin-strip') || a.classList.contains('era-spin'))) n = 1;
        else if (a.querySelectorAll) n = a.querySelectorAll('.spin-strip,.era-spin').length;
        if (n) { spinOpen += n; spinStart(); }
        // life boxes get their class BEFORE insertion, so the attribute observer
        // below never sees them — catch those here instead.
        if (has(a, 'strike-hit')) playOnce('strike');
        if (has(a, 'shield-glow')) playOnce('shieldGain');
      }
      for (var j = 0; j < m.removedNodes.length; j++) {
        var r = m.removedNodes[j];
        if (r.nodeType !== 1 || !r.classList) continue;
        if (r.classList.contains('spin-strip') || r.classList.contains('era-spin')) {
          spinOpen = Math.max(0, spinOpen - 1);
          play('digitStop');
          if (spinOpen === 0) spinStop();
        }
      }
    });
  }).observe(document.body, { childList: true, subtree: true });

  // class-driven moments
  var GLOW_RE = /(^|\s)(gold-supernova|era-gold-supernova|gold-bright|era-gold-bright|gold-border)(\s|$)/;
  function isGlow(cl) {
    return cl.contains('gold-supernova') || cl.contains('era-gold-supernova') ||
           cl.contains('gold-bright') || cl.contains('era-gold-bright') || cl.contains('gold-border');
  }
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      var t = m.target, was = m.oldValue || '';
      if (!t || t.nodeType !== 1 || !t.classList) return;
      if (t.classList.contains('modal-bg') || t.classList.contains('ad-modal-bg')) {
        var isShow = t.classList.contains('show'), wasShow = /(^|\s)show(\s|$)/.test(was);
        if (isShow && !wasShow) play('modalOpen');
        else if (!isShow && wasShow) play('modalClose');
        return;
      }
      if (t.classList.contains('strike-hit') && !/strike-hit/.test(was)) playOnce('strike');
      if (t.classList.contains('shield-glow') && !/shield-glow/.test(was)) playOnce('shieldGain');
      // The all-boxes burst is the supernova class, not the gold-border settle that
      // follows. Anything inside .bonus-stage is the bonus glow, not the main one.
      if (isGlow(t.classList) && !GLOW_RE.test(was)) {
        var inBonus = t.classList.contains('bonus-collapse') ||
                      (t.closest && !!t.closest('.bonus-stage'));
        playOnce(inBonus ? 'glowBonus' : 'glow', 5000);
      }
    });
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'], attributeOldValue: true });

  // ------------------------------------------------------ fold, step by step
  // cascadeFold folds the option cards one at a time (a step every 160ms), so this
  // watches the cards and plays one fold per step.
  //
  // Two guards: several cards move together in one step, so hits inside a 70ms window
  // collapse into one sound; and core.js zeroes the transforms with `transition:none`
  // before measuring, so only a card with a live transform transition counts as animating.
  var _foldY = new WeakMap(), _foldPend = null, _foldDir = 0;
  function transY(el) {
    var m = /translateY\(\s*(-?[\d.]+)px/.exec(el.style.transform || '');
    return m ? parseFloat(m[1]) : 0;
  }
  function animatingCard(el) {
    var tr = el.style.transition || '';
    return tr && tr !== 'none' && tr.indexOf('transform') !== -1;
  }
  new MutationObserver(function (muts) {
    var dir = 0;
    for (var i = 0; i < muts.length; i++) {
      var el = muts[i].target;
      if (!el || el.nodeType !== 1 || !el.classList || !el.classList.contains('mc-option')) continue;
      var y = transY(el), prev = _foldY.has(el) ? _foldY.get(el) : 0;
      if (y === prev) continue;
      _foldY.set(el, y);
      if (!animatingCard(el)) continue;          // a measurement reset, not a fold
      if (y < prev) dir = -1;
      else if (dir === 0) dir = 1;
    }
    if (!dir) return;
    _foldDir = dir;
    if (_foldPend) return;
    _foldPend = setTimeout(function () {
      _foldPend = null;
      play(_foldDir < 0 ? 'fold' : 'unfold');
    }, 70);
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });

  // ------------------------------------------------------- function hooks
  function before(name, fn) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { try { fn.apply(this, arguments); } catch (e) {} return orig.apply(this, arguments); };
  }
  before('toggleEra', function () { play('eraToggle'); });
  before('_toggleGuessHistory', function () { play(window._histOpen ? 'fold' : 'unfold'); });
  before('handleB1Pick', function (c) { play(window.checkCountry && checkCountry(c) ? 'bonusCorrect' : 'bonusWrong'); });
  before('handleB2Pick', function (c) { play(window.checkInventor && checkInventor(c) ? 'bonusCorrect' : 'bonusWrong'); });
  before('showPostGame', function () { var w = window.won; setTimeout(function () { play(w ? 'win' : 'lose'); }, 120); });
  (function () {
    var orig = window.applyStrike;
    if (typeof orig !== 'function') return;
    window.applyStrike = function () {
      var before = (window.run && run.shields) || 0;
      var r = orig.apply(this, arguments);
      try { if (window.run && run.shields < before) play('shieldLose'); } catch (e) {}
      return r;
    };
  })();

  // Decodes every file at page load, not on the first gesture: the click listener above
  // runs first, so a gesture-primed decode would miss the first sound of the page. The
  // context stays suspended until a real gesture, which is all the autoplay policy needs.
  function primeSamples() {
    if (!buildCtx()) return;
    for (var k in SND) if (SND.hasOwnProperty(k)) loadSample(SND[k]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', primeSamples);
  else primeSamples();
  // retries once the context is running, in case the browser refused to decode while suspended
  document.addEventListener('pointerdown', function once() {
    document.removeEventListener('pointerdown', once, true);
    setTimeout(primeSamples, 0);
  }, true);

  window.INVENTLE_SFX = { play: play, spinStart: spinStart, spinStop: spinStop, FX: FX, SND: SND, TRIM: TRIM };
})();
