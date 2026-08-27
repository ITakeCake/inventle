// ====================================================================
// i18n-patch.js — Override game functions to use i18n t() for all
// dynamically generated text.
// Load AFTER core.js and game.js. Requires i18n.js (loaded before core.js).
// ====================================================================

// ====== 0. Data translation overlay (invention names, descriptions) ======
var _dataOverlay = null;

// Look up a translated data field for the current (or specified) puzzle entry
function dataT(field, idx) {
  if (idx === undefined) idx = _ix;
  if (_dataOverlay && _dataOverlay[idx]) {
    var val = _dataOverlay[idx][field];
    if (val) return val;
  }
  if (idx != null && _d && _d[idx]) return _d[idx][field];
  if (typeof _e !== 'undefined' && _e && _e[field]) return _e[field];
  return '';
}

// Global callback for locale data script loading
var _dataLocaleScript = null;
window._onDataLocaleLoaded = function(data) {
  _dataOverlay = data;
  _refreshPuzzleDisplay();
};

// Load a language overlay via script injection (works on file:// and http://)
function loadDataOverlay(lang) {
  // Remove previous locale script if any
  if (_dataLocaleScript && _dataLocaleScript.parentNode) {
    _dataLocaleScript.parentNode.removeChild(_dataLocaleScript);
    _dataLocaleScript = null;
  }
  if (lang === 'en') {
    _dataOverlay = null;
    _refreshPuzzleDisplay();
    return;
  }
  var s = document.createElement('script');
  s.src = 'locales/data-' + lang + '.js';
  s.onerror = function() {
    _dataOverlay = null;
    _refreshPuzzleDisplay();
  };
  _dataLocaleScript = s;
  document.head.appendChild(s);
}

// Re-render the puzzle name, description, and any visible results
function _refreshPuzzleDisplay() {
  setInvName(dataT('name'));
  var descEl = document.getElementById('inv-desc');
  if (descEl) descEl.textContent = dataT('desc') || dataT('description') || '';
  // If game is over, re-render bonus area and stats if visible
  if (over) restoreButtons();
}

// ====== 1. Override buildNumpad() — translate ENTER/DEL/AD/BC labels ======
function buildNumpad() {
  var layout = [
    { k: '7' }, { k: '8' }, { k: '9' }, { k: 'AD' },
    { k: '4' }, { k: '5' }, { k: '6' }, { k: 'BC' },
    { k: '1' }, { k: '2' }, { k: '3' }, { k: 'ENTER', cls: 'fn enter', label: 'ENTER' },
    { k: '0', cls: 'wide' }, { k: 'DEL', cls: 'fn del', label: 'DEL' }
  ];
  layout.forEach(function(item) {
    var b = document.createElement('button'); b.className = 'np-key';
    if (item.cls) b.className += ' ' + item.cls;
    if (item.k === 'AD') {
      b.className += ' era-ad sel'; b.textContent = t('era.ad'); b.id = 'np-ad';
      b.onclick = function() { if (isBC) toggleEra(); };
    } else if (item.k === 'BC') {
      b.className += ' era-bc dim'; b.textContent = t('era.bc'); b.id = 'np-bc';
      b.onclick = function() { if (!isBC) toggleEra(); };
    } else {
      b.textContent = item.k === 'ENTER' ? t('numpad.enter') : item.k === 'DEL' ? t('numpad.del') : item.k;
      b.onclick = function() {
        if (onNumpadInput) onNumpadInput(item.k);
        handleKey(item.k);
      };
    }
    numpadEl.appendChild(b);
  });
}

// ====== 2. Override toggleEra() — use translated era labels ======
function toggleEra() {
  isBC = !isBC;
  inputEra.textContent = isBC ? t('era.bc') : t('era.ad');
  inputEra.className = 'input-era ' + (isBC ? 'bc' : 'ad');
  var adB = document.getElementById('np-ad');
  var bcB = document.getElementById('np-bc');
  if (adB) { adB.className = 'np-key era-ad' + (isBC ? ' dim' : ' sel'); adB.textContent = t('era.ad'); }
  if (bcB) { bcB.className = 'np-key era-bc' + (isBC ? ' sel' : ' dim'); bcB.textContent = t('era.bc'); }
}

// ====== 3. submit() is NOT overridden here ======
// The server-authoritative submit() in game.js is the source of truth: it POSTs to
// /api/guess and only reveals the year on win/game-over. It already uses translated
// toasts via _t(), so no override is needed here. Do not add one.

// ====== 4. Override _mkKeepBtn() — translate "Keep Playing" ======
function _mkKeepBtn(){
  var a=document.createElement('a');a.href='infinite.html';a.className='continue-btn';
  a.style.cssText='text-decoration:none;margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  a.textContent=t('btn.keepPlaying');
  return a;
}

// ====== 5. Override _appendPostB1Buttons / _appendPostB2Buttons with translated strings ======
// Called from the cascade onDone callbacks: preserves the animated stage and slides in
// the post-bonus action buttons below it.
function _appendPostB1Buttons(){
  var existing=bonusArea.querySelector('.bonus-btnwrap');
  if(existing) existing.remove();
  var wrap=document.createElement('div');
  wrap.className='bonus-btnwrap';
  wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
  if(b1over&&!b2over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var b2Btn=document.createElement('button');b2Btn.className='continue-btn';
    b2Btn.textContent=t('btn.bonus2');b2Btn.style.marginTop='0';
    b2Btn.onclick=function(){startBonus2();};
    topRow.appendChild(b2Btn);
    topRow.appendChild(_mkKeepBtn());
    wrap.appendChild(topRow);
  }
  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  btnRow.appendChild(doneBtn);
  wrap.appendChild(btnRow);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
  scrollToBottom();
}

function _appendPostB2Buttons(){
  var existing=bonusArea.querySelector('.bonus-btnwrap');
  if(existing) existing.remove();
  var wrap=document.createElement('div');
  wrap.className='bonus-btnwrap';
  wrap.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:nowrap;';
  wrap.appendChild(_mkKeepBtn());
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  wrap.appendChild(doneBtn);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
  scrollToBottom();
}

// Rebuilds a completed bonus round as an instant-folded cascade stage, so expanding a
// recap plays the same reverse cascade the live between-rounds toggle uses.
function _recapStage(kind){
  var isB1=kind==='b1';
  var wonR=isB1?b1won:b2won;
  var guesses=isB1?b1guesses:b2guesses;
  var choices=isB1?generateB1Choices(_pn*31+7):generateB2Choices(_pn*31+13);
  var check=isB1?checkCountry:checkInventor;
  var title=isB1?t('bonus.round1Country'):t('bonus.round2Inventor');
  var headerHtml='<span>'+title+'</span><span>'+guesses.length+'/2 '+(wonR?'✅':'❌')+' <span class="bc-arrow">▼</span></span>';

  var stage=document.createElement('div');stage.className='bonus-stage';
  // The recap can only render once the async puzzle fetch lands (_e is not persisted),
  // so it arrives a beat after the page and fades in.
  stage.style.opacity='0';
  requestAnimationFrame(function(){
    stage.style.transition='opacity 0.25s ease';
    stage.style.opacity='1';
  });
  var header=document.createElement('div');header.className='bonus-collapse br1-header';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML=headerHtml;
  header.appendChild(headerInner);
  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';
  var optDiv=document.createElement('div');optDiv.className='mc-options';
  var clickedIdx=-1,correctIdx=-1,lastGuess=guesses[guesses.length-1];
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    btn.style.animation='none';btn.style.opacity='1';btn.style.transform='none';
    var disp=isB1?tCountry(choices[i]):choices[i];
    var wasGuessed=guesses.indexOf(choices[i])!==-1;
    var isC=check(choices[i]);
    if(isC)correctIdx=i;
    if(choices[i]===lastGuess)clickedIdx=i;
    if(wasGuessed&&isC){btn.classList.add('mc-correct');btn.innerHTML='<span class="mc-icon">✅</span>'+escHtml(disp);}
    else if(wasGuessed){btn.classList.add('mc-wrong');btn.innerHTML='<span class="mc-icon">❌</span>'+escHtml(disp);}
    else{btn.textContent=disp;}
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);
  stage.appendChild(header);stage.appendChild(drawer);
  bonusArea.appendChild(stage);
  if(clickedIdx<0)clickedIdx=correctIdx>=0?correctIdx:0;
  cascadeFold(stage,{
    instant:true,
    targetIdx:clickedIdx,
    tileClass:wonR?'mc-correct':'mc-loss',
    headerClass:wonR?'won':'lost',
    headerText:headerHtml,
    borderColor:wonR?'#fbbf24':'#b92d2d',
    goldBorder:wonR,
    revealIdx:(!wonR&&correctIdx!==clickedIdx)?correctIdx:null
  });
  return stage;
}

// Override restoreButtons() — translate all bonus round text (for reload/state restore)
function restoreButtons(){
  if(!over)return;
  if((phase==='bonus1'&&!b1over)||(phase==='bonus2'&&!b2over))return;
  bonusArea.innerHTML='';

  if(b1over||b2over){
    var brLabel=document.createElement('div');
    brLabel.style.cssText='font-size:0.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:3px;font-weight:900;text-align:center;margin:22px 0 8px;';
    brLabel.textContent=t('bonus.rounds');
    bonusArea.appendChild(brLabel);
  }

  if(b1over){
    document.getElementById('col-labels').style.display='none';
    _recapStage('b1');
  }

  if(b2over){
    var isUnk=_e.inventor.toLowerCase()==='unknown';
    if(isUnk){
      // free win: no picks to cascade, but the drawer folds like every other bonus fold
      _unknownRecapStage();
    }else{
      _recapStage('b2');
    }
  }

  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;';
  if(won&&!b1over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var bonusBtn=document.createElement('button');bonusBtn.className='continue-btn';
    bonusBtn.textContent=t('btn.bonus');bonusBtn.style.marginTop='0';
    bonusBtn.onclick=function(){startBonus1();};
    topRow.appendChild(bonusBtn);
    topRow.appendChild(_mkKeepBtn());
    wrap.appendChild(topRow);
  }else if(b1over&&!b2over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var b2Btn=document.createElement('button');b2Btn.className='continue-btn';
    b2Btn.textContent=t('btn.bonus2');b2Btn.style.marginTop='0';
    b2Btn.onclick=function(){startBonus2();};
    topRow.appendChild(b2Btn);
    topRow.appendChild(_mkKeepBtn());
    wrap.appendChild(topRow);
  }
  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
  if(b1over&&b2over){
    btnRow.appendChild(_mkKeepBtn());
  }
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  btnRow.appendChild(doneBtn);
  wrap.appendChild(btnRow);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
}

// ====== 6. Override renderBonus1() — translate bonus round 1 text ======
function renderBonus1(){
  bonusArea.innerHTML='';
  var stage=document.createElement('div');stage.className='bonus-stage';

  // Header (collapsed bar)
  var header=document.createElement('div');header.className='bonus-collapse br1-header';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML='<span>'+t('bonus.round1Country')+'</span><span>'+b1guesses.length+'/2 <span class="bc-arrow">\u25BC</span></span>';
  header.appendChild(headerInner);
  // Active-round toggle; cascadeFold installs the completed-round toggle over this
  // once the round is answered.
  header.style.cursor='pointer';
  header.onclick=function(){
    if(b1over)return;
    activeCascadeToggle(header,drawer);
  };

  // Drawer
  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';

  var prompt=document.createElement('div');prompt.className='bonus-prompt';
  prompt.textContent=t('bonus.countryQ');
  drawer.appendChild(prompt);

  var choices=generateB1Choices(_pn*31+7);
  var optDiv=document.createElement('div');optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    if(b1guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var wasGuessed=b1guesses.indexOf(choice)!==-1;
      var isCorrect=checkCountry(choice);
      var display=tCountry(choice);
      if(wasGuessed&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.classList.add('gold-border');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(display);
      }else if(wasGuessed){
        theBtn.classList.add('mc-wrong');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(display);
      }else if(b1over&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(display);
      }else if(b1over){
        theBtn.classList.add('mc-disabled');theBtn.style.animation='none';
        theBtn.textContent=display;
      }else{
        if(b1guesses.length>0)theBtn.style.animation='none';
        theBtn.textContent=display;
        theBtn.onclick=function(){handleB1Pick(choice);};
      }
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b1over){
    var info=document.createElement('div');info.className='mc-attempt-info';
    info.textContent=b1guesses.length===0?t('bonus.attempt1'):t('bonus.finalAttempt');
    drawer.appendChild(info);

    var b1BtnRow=document.createElement('div');
    b1BtnRow.setAttribute('data-btn-row','1');
    b1BtnRow.style.display='flex';b1BtnRow.style.gap='8px';b1BtnRow.style.justifyContent='center';b1BtnRow.style.marginTop='8px';

    var doneBtn1=document.createElement('button');doneBtn1.className='continue-btn';
    doneBtn1.textContent=t('btn.done');
    doneBtn1.style.background='var(--surface)';doneBtn1.style.color='var(--text2)';doneBtn1.style.border='2px solid var(--border)';doneBtn1.style.marginTop='0';
    doneBtn1.onclick=function(){b1over=true;b1won=false;_trackB1('skip');phase='done';saveSt();_submitStats();bonusArea.innerHTML='';showStats();};
    b1BtnRow.appendChild(doneBtn1);

    var skipBtn=document.createElement('button');skipBtn.className='continue-btn';
    skipBtn.textContent=t('btn.skipToBonus2');
    skipBtn.style.background='var(--surface)';skipBtn.style.color='var(--text2)';skipBtn.style.border='2px solid var(--border)';skipBtn.style.marginTop='0';
    skipBtn.onclick=function(){b1over=true;b1won=false;_trackB1('skip');saveSt();showAdModal([
      {text:t('btn.done'),secondary:true,onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}},
      {text:t('btn.bonus2'),onclick:function(){startBonus2();}}
    ]);};
    b1BtnRow.appendChild(skipBtn);
  }

  stage.appendChild(header);stage.appendChild(drawer);
  // Button row in the stage below the drawer, so it stays available while the active
  // question is folded (activeCascadeToggle collapses only the drawer).
  if(typeof b1BtnRow!=='undefined'&&b1BtnRow) stage.appendChild(b1BtnRow);
  bonusArea.appendChild(stage);
  // fresh round: the whole card enters with the shared fade+settle
  if(!b1over) revealBtnWrap(stage);
  // Fresh open — animate drawer drop-down same as expand-from-collapsed
  if(!b1over){ animateDrawerOpen(drawer); }

  if(b1over){
    // already answered (reload): show buttons below the stage
    var btnWrap=document.createElement('div');
    btnWrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
    if(!b2over){
      var btn2=document.createElement('button');btn2.className='continue-btn';btn2.textContent=t('btn.bonus2');btn2.style.marginTop='0';
      btn2.onclick=function(){showAdModal([
        {text:t('btn.bonus2'),onclick:function(){startBonus2();}},
        {text:t('btn.keepPlaying'),secondary:true,onclick:function(){window.location.href='infinite.html';}},
        {text:t('btn.done'),onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}}
      ]);};
      btnWrap.appendChild(btn2);
    }
    var bottomRow=document.createElement('div');bottomRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    bottomRow.appendChild(_mkKeepBtn());
    var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');doneBtn.style.marginTop='0';
    doneBtn.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    bottomRow.appendChild(doneBtn);
    btnWrap.appendChild(bottomRow);
    bonusArea.appendChild(btnWrap);
    revealBtnWrap(btnWrap);
  }
  scrollToBottom();
}

// ====== 7. Override renderBonus2() — translate bonus round 2 text ======
function renderBonus2(){
  // Fades out post-BR1 buttons then removes them, keeping the BR1 collapsed
  // header/stage so it persists above BR2.
  var toFade=[];
  for(var ci=bonusArea.children.length-1;ci>=0;ci--){
    var c=bonusArea.children[ci];
    if(c.nodeType===1&&(c.classList.contains('bonus-collapse')||c.classList.contains('bonus-stage')))break;
    toFade.push(c);
  }
  toFade.forEach(function(el){
    el.style.transition='opacity 0.2s ease, transform 0.2s ease';
    el.style.opacity='0';
    el.style.transform='translateY(-6px)';
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 220);
  });
  // reload mid-BR2: BR1's collapsed stage is not in the DOM, so rebuild it as a recap
  if(b1over&&!bonusArea.querySelector('.bonus-stage')){_recapStage('b1');}
  var isUnknown=_e.inventor.toLowerCase()==='unknown';
  if(isUnknown&&!b2over){b2over=true;b2won=true;_trackB2('win-free');saveSt();}

  var stage=document.createElement('div');stage.className='bonus-stage';
  var header=document.createElement('div');header.className='bonus-collapse br1-header';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML='<span>'+t('bonus.round2Inventor')+'</span><span>'+b2guesses.length+'/2 <span class="bc-arrow">\u25BC</span></span>';
  header.appendChild(headerInner);
  // Active-round toggle (see renderBonus1) \u2014 cascadeFold takes over once answered.
  header.style.cursor='pointer';
  header.onclick=function(){
    if(b2over)return;
    activeCascadeToggle(header,drawer);
  };

  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';
  var prompt=document.createElement('div');prompt.className='bonus-prompt';
  prompt.textContent=t('bonus.inventorQ');drawer.appendChild(prompt);

  if(isUnknown){
    var res=document.createElement('div');res.className='bonus-result';
    res.innerHTML='\u2705 '+t('bonus.unknownInventor');
    drawer.appendChild(res);stage.appendChild(header);stage.appendChild(drawer);bonusArea.appendChild(stage);
    // b2over is already true here, so give the free-win card its own working toggle
    header.onclick=function(){activeCascadeToggle(header,drawer);};
    var unkRow=document.createElement('div');unkRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    unkRow.appendChild(_mkKeepBtn());
    var btn2=document.createElement('button');btn2.className='continue-btn';btn2.textContent=t('btn.done');
    btn2.style.marginTop='0';btn2.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    unkRow.appendChild(btn2);bonusArea.appendChild(unkRow);revealBtnWrap(unkRow);scrollToBottom();return;
  }

  var choices=generateB2Choices(_pn*31+13);
  var optDiv=document.createElement('div');optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);btn.setAttribute('data-idx',i);
    if(b2guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var wasGuessed=b2guesses.indexOf(choice)!==-1;
      var isCorrect=checkInventor(choice);
      if(wasGuessed&&isCorrect){theBtn.classList.add('mc-correct');theBtn.classList.add('gold-border');theBtn.style.animation='none';theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);}
      else if(wasGuessed){theBtn.classList.add('mc-wrong');theBtn.style.animation='none';theBtn.innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(choice);}
      else if(b2over&&isCorrect){theBtn.classList.add('mc-correct');theBtn.style.animation='none';theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);}
      else if(b2over){theBtn.classList.add('mc-disabled');theBtn.style.animation='none';theBtn.textContent=choice;}
      else{if(b2guesses.length>0)theBtn.style.animation='none';theBtn.textContent=choice;theBtn.onclick=function(){handleB2Pick(choice);};}
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b2over){
    var info=document.createElement('div');info.className='mc-attempt-info';
    info.textContent=b2guesses.length===0?t('bonus.attempt1'):t('bonus.finalAttempt');
    drawer.appendChild(info);
    var b2BtnRow=document.createElement('div');b2BtnRow.setAttribute('data-btn-row','1');
    b2BtnRow.style.display='flex';b2BtnRow.style.gap='8px';b2BtnRow.style.justifyContent='center';b2BtnRow.style.marginTop='8px';
    var doneBtn2=document.createElement('button');doneBtn2.className='continue-btn';doneBtn2.textContent=t('btn.done');
    doneBtn2.style.background='var(--surface)';doneBtn2.style.color='var(--text2)';doneBtn2.style.border='2px solid var(--border)';doneBtn2.style.marginTop='0';
    doneBtn2.onclick=function(){b2over=true;b2won=false;_trackB2('skip');phase='done';saveSt();_submitStats();bonusArea.innerHTML='';showStats();};
    b2BtnRow.appendChild(doneBtn2);
    var skipBtn2=document.createElement('button');skipBtn2.className='continue-btn';skipBtn2.textContent=t('btn.skip');
    skipBtn2.style.background='var(--surface)';skipBtn2.style.color='var(--text2)';skipBtn2.style.border='2px solid var(--border)';skipBtn2.style.marginTop='0';
    skipBtn2.onclick=function(){b2over=true;b2won=false;_trackB2('skip');phase='done';saveSt();_submitStats();bonusArea.innerHTML='';showStats();};
    b2BtnRow.appendChild(skipBtn2);
  }

  stage.appendChild(header);stage.appendChild(drawer);
  // Button row in the stage below the drawer, so it stays available while folded
  if(typeof b2BtnRow!=='undefined'&&b2BtnRow) stage.appendChild(b2BtnRow);
  bonusArea.appendChild(stage);
  if(!b2over) revealBtnWrap(stage);   // fresh round enters with the shared fade+settle
  // Fresh open — animate drawer drop-down same as expand-from-collapsed
  if(!b2over){ animateDrawerOpen(drawer); }

  if(b2over){
    var btnRow2=document.createElement('div');btnRow2.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:nowrap;';
    var keepBtn=document.createElement('a');keepBtn.className='continue-btn';keepBtn.textContent=t('btn.keepPlaying');
    keepBtn.href='infinite.html';keepBtn.style.cssText='margin-top:0;text-decoration:none;flex:1;max-width:150px;';
    btnRow2.appendChild(keepBtn);
    var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');
    doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);flex:1;max-width:150px;';
    doneBtn.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    btnRow2.appendChild(doneBtn);
    bonusArea.appendChild(btnRow2);
    revealBtnWrap(btnRow2);
  }
  scrollToBottom();
}

// ====== 8. Override showPostGame() and _showPostGameButtons() — translate button text ======
function _showPostGameButtons(){
  bonusArea.innerHTML='';
  var _doneAct=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
  var container=document.createElement('div');
  container.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
  if(won){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var bonusBtn=document.createElement('button');bonusBtn.className='continue-btn';
    bonusBtn.textContent=t('btn.bonus');bonusBtn.style.marginTop='0';
    bonusBtn.onclick=function(){startBonus1();};
    topRow.appendChild(bonusBtn);
    var keepBtn1=document.createElement('a');keepBtn1.className='continue-btn';keepBtn1.textContent=t('btn.keepPlaying');
    keepBtn1.href='infinite.html';keepBtn1.style.cssText='margin-top:0;text-decoration:none;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
    topRow.appendChild(keepBtn1);
    container.appendChild(topRow);
  }
  var bottomRow=document.createElement('div');
  bottomRow.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
  if(!won){
    var keepBtn2=document.createElement('a');keepBtn2.className='continue-btn';keepBtn2.textContent=t('btn.keepPlaying');
    keepBtn2.href='infinite.html';keepBtn2.style.cssText='margin-top:0;text-decoration:none;';
    bottomRow.appendChild(keepBtn2);
  }
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent=t('btn.done');
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=_doneAct;
  bottomRow.appendChild(doneBtn);
  container.appendChild(bottomRow);
  bonusArea.appendChild(container);
  revealBtnWrap(container);
  scrollToBottom();
}

function showPostGame(withAd){
  if(phase!=='main')return;
  bonusArea.innerHTML='';

  if(won){
    if(withAd){
      var btns=[];
      if(!b1over) btns.push({text:t('btn.bonus'),onclick:function(){startBonus1();}});
      btns.push({text:t('btn.keepPlaying'),secondary:true,onclick:function(){window.location.href='infinite.html';}});
      btns.push({text:t('btn.done'),onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}});
      showAdModal(btns);
    }else{
      _showPostGameButtons();
    }
  }else{
    if(withAd){
      showAdModal([{text:t('btn.keepPlaying'),secondary:true,onclick:function(){window.location.href='infinite.html';}},{text:t('btn.done'),onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}}]);
    }else{
      _showPostGameButtons();
    }
  }
}

// ====== 9. Override showStats() — translate bonus stats labels and result card ======
function showStats(){
  // display only: telemetry is submitted automatically at game-over (see _trackEnd)
  var s=loadS();
  document.getElementById('s-played').textContent=s.p;
  document.getElementById('s-win').textContent=s.p>0?Math.round(s.w/s.p*100):0;
  document.getElementById('s-streak').textContent=s.s;
  document.getElementById('s-max').textContent=s.m;
  document.getElementById('s-pstreak').textContent=s.ps||0;
  document.getElementById('s-pmax').textContent=s.pm||0;
  var dEl=document.getElementById('dist');dEl.innerHTML='';
  var mx=Math.max(1,s.d[1]||0,s.d[2]||0,s.d[3]||0,s.d[4]||0,s.d[5]||0,s.d[6]||0);
  for(var i=1;i<=6;i++){var ct=s.d[i]||0,pct=Math.max(8,(ct/mx)*100),hl=won&&gHistory.length===i;
    dEl.innerHTML+='<div class="d-row"><div class="d-l">'+i+'</div><div class="d-b'+(hl?' hl':'')+'" style="width:'+pct+'%">'+ct+'</div></div>';}

  var bsEl=document.getElementById('bonus-stats-area');
  bsEl.innerHTML='';
  if((s.b1p||0)>0||(s.b2p||0)>0){
    var html='<div class="bonus-stats-section"><h2>'+t('stats.bonusStats')+'</h2><div class="stats-grid">';
    html+='<div class="st"><div class="st-n">'+(s.b1p||0)+'</div><div class="st-l">'+t('stats.countryPlayed')+'</div></div>';
    html+='<div class="st"><div class="st-n">'+((s.b1p||0)>0?Math.round((s.b1w||0)/(s.b1p||1)*100):0)+'</div><div class="st-l">'+t('stats.countryWin')+'</div></div>';
    html+='<div class="st"><div class="st-n">'+(s.b2p||0)+'</div><div class="st-l">'+t('stats.inventorPlayed')+'</div></div>';
    html+='<div class="st"><div class="st-n">'+((s.b2p||0)>0?Math.round((s.b2w||0)/(s.b2p||1)*100):0)+'</div><div class="st-l">'+t('stats.inventorWin')+'</div></div>';
    html+='</div></div>';
    bsEl.innerHTML=html;
  }

  var rEl=document.getElementById('result-card');
  if(over){
    var ys=_tb?_ta+' '+t('era.bc'):_ta+' '+t('era.ad');
    var hn=_e.country.historical!==_e.country.modern?'<br>'+escHtml(tCountry(_e.country.historical))+' ('+escHtml(tCountry(_e.country.modern))+')':'<br>'+escHtml(tCountry(_e.country.modern));
    var srcHtml=typeof getSourceHtml==='function'?getSourceHtml():'';
    var originHtml=typeof getOriginHtml==='function'?getOriginHtml():'';
    rEl.innerHTML='<div class="ans-yr">'+ys+'</div><div class="ans-info"><strong>'+escHtml(dataT('name'))+'</strong>'+hn+'<br>'+t('result.inventedBy',{name:escHtml(_e.inventor)})+'<br>'+escHtml(tCat(_e.category))+srcHtml+originHtml+'</div>';
    document.getElementById('share-btn').style.display='inline-flex';
    document.getElementById('keep-btn').style.display='inline-flex';countdown();
  }else{rEl.innerHTML='';document.getElementById('share-btn').style.display='none';document.getElementById('keep-btn').style.display='none';}
  document.getElementById('m-stats').classList.add('show');
}

// ====== 10. Override countdown() — translate "Next in" ======
function countdown(){
  var n=new Date(),tt=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1),d=tt-n;
  var timeStr=String(Math.floor(d/36e5)).padStart(2,'0')+':'+String(Math.floor((d%36e5)/6e4)).padStart(2,'0')+':'+String(Math.floor((d%6e4)/1e3)).padStart(2,'0');
  document.getElementById('countdown').textContent=t('game.nextIn',{time:timeStr});
  if(over)setTimeout(countdown,1000);
}

// ====== 11. Override getContinent() — translate continent hints ======
function getContinent(country) {
  var c = country.toLowerCase();
  var europe = ['germany', 'france', 'italy', 'spain', 'portugal', 'netherlands', 'belgium', 'switzerland', 'austria', 'sweden', 'norway', 'denmark', 'finland', 'iceland', 'ireland', 'poland', 'czech republic', 'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'england', 'scotland', 'wales', 'croatia', 'serbia', 'bosnia', 'montenegro', 'north macedonia', 'albania', 'slovenia', 'moldova', 'georgia', 'armenia', 'azerbaijan', 'luxembourg', 'malta', 'monaco', 'liechtenstein', 'andorra', 'san marino', 'vatican city', 'kosovo', 'estonia', 'latvia', 'lithuania', 'ukraine', 'belarus', 'russia'];
  var asia = ['china', 'japan', 'south korea', 'north korea', 'taiwan', 'mongolia', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'bhutan', 'myanmar', 'thailand', 'vietnam', 'cambodia', 'laos', 'malaysia', 'singapore', 'indonesia', 'philippines', 'brunei', 'east timor', 'afghanistan', 'iran', 'iraq', 'syria', 'lebanon', 'israel', 'palestine', 'jordan', 'saudi arabia', 'yemen', 'oman', 'united arab emirates', 'qatar', 'bahrain', 'kuwait', 'turkey', 'cyprus', 'kazakhstan', 'uzbekistan', 'turkmenistan', 'kyrgyzstan', 'tajikistan'];
  var africa = ['egypt', 'libya', 'tunisia', 'algeria', 'morocco', 'sudan', 'south sudan', 'ethiopia', 'eritrea', 'somalia', 'djibouti', 'kenya', 'uganda', 'tanzania', 'rwanda', 'burundi', 'democratic republic of the congo', 'cameroon', 'nigeria', 'ghana', 'senegal', 'mali', 'niger', 'chad', 'south africa', 'zimbabwe', 'mozambique', 'madagascar', 'namibia', 'botswana'];
  var namerica = ['usa', 'united states', 'canada', 'mexico', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua', 'costa rica', 'panama', 'cuba', 'jamaica', 'haiti', 'dominican republic', 'trinidad and tobago', 'barbados', 'greenland'];
  var samerica = ['colombia', 'venezuela', 'ecuador', 'peru', 'bolivia', 'brazil', 'paraguay', 'uruguay', 'argentina', 'chile', 'guyana', 'suriname'];
  var oceania = ['australia', 'new zealand', 'papua new guinea', 'fiji', 'samoa', 'tonga'];
  if (europe.indexOf(c) !== -1) return t('continent.europe');
  if (asia.indexOf(c) !== -1) return t('continent.asia');
  if (africa.indexOf(c) !== -1) return t('continent.africa');
  if (namerica.indexOf(c) !== -1) return t('continent.northAmerica');
  if (samerica.indexOf(c) !== -1) return t('continent.southAmerica');
  if (oceania.indexOf(c) !== -1) return t('continent.oceania');
  // Fallback for historical entities
  var hist = { 'mesopotamia': 'Asia', 'sumer': 'Asia', 'babylon': 'Asia', 'assyria': 'Asia', 'persia': 'Asia', 'phoenicia': 'Asia', 'ottoman empire': 'Asia/Europe', 'byzantine empire': 'Asia/Europe', 'roman empire': 'Europe', 'ancient greece': 'Europe', 'holy roman empire': 'Europe', 'prussia': 'Europe', 'kingdom of france': 'Europe' };
  var h = hist[c]; if (h) return 'Located in ' + h;
  return t('continent.unavailable');
}

// ====== 12. Override share button handler ======
document.getElementById('share-btn').onclick=function(){
  _trackShare();
  var title='Inventle #'+_pn+' '+(won?gHistory.length:'X')+'/6';
  var lines=[title+'\n'];
  for(var r=0;r<gHistory.length;r++){
    var c=getColors(gHistory[r],eras[r]),eOk=eras[r]===_tb;
    var row=eOk?'\ud83d\udfe6':'\ud83d\udfe5';
    row+=c.map(function(x){return shareSquare(x);}).join('');
    lines.push(row);
  }
  if(b1over||b2over){
    lines.push('');
    if(b1over){
      var b1emoji=b1won?'\ud83c\udf0d\u2705 '+b1guesses.length+'/2':'\ud83c\udf0d\u274c';
      lines.push(t('share.country')+' '+b1emoji);
    }
    if(b2over){
      var b2emoji=b2won?'\ud83d\udca1\u2705 '+b2guesses.length+'/2':'\ud83d\udca1\u274c';
      lines.push(t('share.inventor')+' '+b2emoji);
    }
  }
  lines.push('\nPlay: https://inventle.io');
  var btn=this;
  btn.style.animation='none';void btn.offsetWidth;btn.style.animation='goldBrightFade 3s ease-in-out forwards';
  var shareText=lines.join('\n');
  function copyShare(){navigator.clipboard.writeText(shareText).then(function(){toast(t('game.copied'));}).catch(function(){toast(t('game.copyFailed'));});}
  if(navigator.share){
    try{
      navigator.share({text:shareText}).catch(function(err){
        if(err&&err.name==='AbortError')return; // user cancelled the share sheet — not an error
        copyShare();
      });
    }catch(e){copyShare();}
  }else{
    copyShare();
  }
};

// ====== 13. Override handleB1Pick and handleB2Pick — translate attempt info and result text ======
function handleB1Pick(choice){
  if(b1over)return;
  b1guesses.push(choice);
  var isCorrect=checkCountry(choice);
  if(isCorrect){b1over=true;b1won=true;recB1(true);_trackB1('win-'+b1guesses.length);}
  else if(b1guesses.length>=2){b1over=true;b1won=false;recB1(false);_trackB1('loss');}
  saveSt();

  if(b1over){
    // Round complete — trigger cascade fold animation
    var btns=bonusArea.querySelectorAll('.mc-option');
    var clickedIdx=-1, correctIdx=-1;
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice) clickedIdx=i;
      if(checkCountry(btns[i].getAttribute('data-choice'))) correctIdx=i;
    }
    var stage=bonusArea.querySelector('.bonus-stage');
    cascadeFold(stage,{
      targetIdx: clickedIdx,
      tileClass: isCorrect?'mc-correct':'mc-loss',
      headerClass: isCorrect?'won':'lost',
      headerText: isCorrect
        ?'<span>'+t('bonus.round1Country')+'</span><span>'+b1guesses.length+'/2 \u2705 <span class="bc-arrow">\u25BC</span></span>'
        :'<span>'+t('bonus.round1Country')+'</span><span>'+b1guesses.length+'/2 \u274C <span class="bc-arrow">\u25BC</span></span>',
      borderColor: isCorrect?'#fbbf24':'#b92d2d',
      goldBorder: isCorrect,
      revealIdx: isCorrect?null:correctIdx,
      onDone: function(){
        if(b1over&&b2over)phase='done';
        saveSt();
        _appendPostB1Buttons();
      }
    });
  }else{
    // First wrong attempt — mark tile, update text
    var btns=bonusArea.querySelectorAll('.mc-option');
    for(var i=0;i<btns.length;i++){
      var bText=btns[i].getAttribute('data-choice');
      if(bText===choice){
        btns[i].classList.add('mc-wrong');
        btns[i].innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(tCountry(bText));
        btns[i].onclick=null;btns[i].style.pointerEvents='none';
        btns[i].style.animation='none';
        btns[i].style.opacity='1';
      }
    }
    var info=bonusArea.querySelector('.mc-attempt-info');
    if(info)info.textContent=t('bonus.finalAttempt');
  }
}

function handleB2Pick(choice){
  if(b2over)return;
  b2guesses.push(choice);
  var isCorrect=checkInventor(choice);
  if(isCorrect){b2over=true;b2won=true;recB2(true);_trackB2('win-'+b2guesses.length);}
  else if(b2guesses.length>=2){b2over=true;b2won=false;recB2(false);_trackB2('loss');}
  saveSt();

  if(b2over){
    // Round complete: trigger the cascade fold, scoped to the last bonus-stage (BR2),
    // since the BR1 stage may still be in the DOM.
    var stages=bonusArea.querySelectorAll('.bonus-stage');
    var stage=stages[stages.length-1];
    var btns=stage.querySelectorAll('.mc-option');
    var clickedIdx=-1, correctIdx=-1;
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice) clickedIdx=i;
      if(checkInventor(btns[i].getAttribute('data-choice'))) correctIdx=i;
    }
    cascadeFold(stage,{
      targetIdx: clickedIdx,
      tileClass: isCorrect?'mc-correct':'mc-loss',
      headerClass: isCorrect?'won':'lost',
      headerText: isCorrect
        ?'<span>'+t('bonus.round2Inventor')+'</span><span>'+b2guesses.length+'/2 \u2705 <span class="bc-arrow">\u25BC</span></span>'
        :'<span>'+t('bonus.round2Inventor')+'</span><span>'+b2guesses.length+'/2 \u274C <span class="bc-arrow">\u25BC</span></span>',
      borderColor: isCorrect?'#fbbf24':'#b92d2d',
      goldBorder: isCorrect,
      revealIdx: isCorrect?null:correctIdx,
      onDone: function(){
        phase='done';
        saveSt();
        _appendPostB2Buttons();
      }
    });
  }else{
    // First wrong attempt: mark the tile and update the text, scoped to the last
    // bonus-stage (BR2) so BR1 tiles are not touched.
    var stages=bonusArea.querySelectorAll('.bonus-stage');
    var stageEl=stages[stages.length-1];
    var btns=stageEl.querySelectorAll('.mc-option');
    for(var i=0;i<btns.length;i++){
      var bText=btns[i].getAttribute('data-choice');
      if(bText===choice){
        btns[i].classList.add('mc-wrong');
        btns[i].innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(bText);
        btns[i].onclick=null;btns[i].style.pointerEvents='none';
        btns[i].style.animation='none';
        btns[i].style.opacity='1';
      }
    }
    var info=stageEl.querySelector('.mc-attempt-info');
    if(info)info.textContent=t('bonus.finalAttempt');
  }
}

// ====== 14. Initialize dynamic text on load ======

// Re-initialize translated dynamic content
document.getElementById('puzzle-num').textContent=t('game.inventionNum',{num:_pn});

// Load data overlay for initial language (if not English)
if(I18N.getLang()!=='en') loadDataOverlay(I18N.getLang());

// Re-render puzzle display with translated name/desc
setInvName(dataT('name'));
var _descEl=document.getElementById('inv-desc');
if(_descEl) _descEl.textContent=dataT('desc')||dataT('description')||'';

// Rebuild numpad with translated labels
numpadEl.innerHTML='';
buildNumpad();

// Update era display
var ie=document.getElementById('input-era');
if(ie)ie.textContent=isBC?t('era.bc'):t('era.ad');

// Populate language selector
(function(){
  var sel=document.getElementById('lang-select');
  if(!sel||!window.I18N)return;
  var langs=I18N.languages;
  sel.innerHTML='';
  for(var i=0;i<langs.length;i++){
    var opt=document.createElement('option');
    opt.value=langs[i].code;
    opt.textContent=langs[i].name;
    if(langs[i].code===I18N.getLang())opt.selected=true;
    sel.appendChild(opt);
  }
  sel.onchange=function(){
    I18N.setLang(this.value);
  };
})();

// Re-translate dynamic content when language changes
document.addEventListener('langchange',function(e){
  document.getElementById('puzzle-num').textContent=t('game.inventionNum',{num:_pn});
  var ie=document.getElementById('input-era');
  if(ie)ie.textContent=isBC?t('era.bc'):t('era.ad');
  // Rebuild numpad
  numpadEl.innerHTML='';
  buildNumpad();
  // Load translated invention data overlay
  loadDataOverlay(e.detail ? e.detail.lang : I18N.getLang());
  // Update lang selector
  var sel=document.getElementById('lang-select');
  if(sel)sel.value=I18N.getLang();
});
