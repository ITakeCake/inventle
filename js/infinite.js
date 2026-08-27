// ====== INFINITE MODE — STRIKE SYSTEM ======
// Load AFTER core.js, which provides the shared variables, UI utilities, guess
// rendering, bonus helpers, settings wiring and DOM refs.
var t = window.I18N ? I18N.t : function(k){ return k; };

// ====== DEBUG STATE OVERLAY ======
// Set to false to hide the corner debug box
var DEBUG_STATE_OVERLAY = false;
function _debugStateOverlay(){
  if(!DEBUG_STATE_OVERLAY)return;
  var box=document.getElementById('_dbg-state');
  if(!box){
    box=document.createElement('div');
    box.id='_dbg-state';
    box.style.cssText='position:fixed;bottom:8px;right:8px;z-index:9999;background:rgba(0,0,0,0.85);color:#0ff;font:11px/1.4 monospace;padding:8px 10px;border:1px solid #0ff;border-radius:6px;pointer-events:none;white-space:pre;max-width:260px;';
    document.body.appendChild(box);
  }
  try{
    box.textContent=
      '[INFINITE]\n'+
      'phase: '+(typeof phase!=='undefined'?phase:'?')+'\n'+
      'over: '+(typeof over!=='undefined'?over:'?')+' won: '+(typeof won!=='undefined'?won:'?')+'\n'+
      'gameOver: '+(typeof gameOver!=='undefined'?gameOver:'?')+'\n'+
      'b1over: '+(typeof b1over!=='undefined'?b1over:'?')+' b1won: '+(typeof b1won!=='undefined'?b1won:'?')+'\n'+
      'b2over: '+(typeof b2over!=='undefined'?b2over:'?')+' b2won: '+(typeof b2won!=='undefined'?b2won:'?')+'\n'+
      'gHistory.len: '+(typeof gHistory!=='undefined'?gHistory.length:'?')+'\n'+
      'b1guesses: '+(typeof b1guesses!=='undefined'?JSON.stringify(b1guesses):'?')+'\n'+
      'b2guesses: '+(typeof b2guesses!=='undefined'?JSON.stringify(b2guesses):'?')+'\n'+
      'bonusArea.html.len: '+(typeof bonusArea!=='undefined'&&bonusArea?bonusArea.innerHTML.length:'?');
  }catch(e){box.textContent='dbg err: '+e.message;}
}
if(DEBUG_STATE_OVERLAY){setInterval(_debugStateOverlay,500);}

var MAX_STRIKES=3;
var MAX_SHIELDS=3;
var gameOver=false; // true when MAX_STRIKES strikes, blocks everything

// ====== PUZZLE STATE ======
function setPuzzle(idx){
  _ix=idx;_e=_d[_ix];
  _ty=_e.year;_tb=_ty<0;_ta=Math.abs(_ty);
  _td=String(_ta).padStart(4,'0').split('').map(Number);
}

// ====== RUN STATE (persisted in localStorage) ======
var RK='wi_inf_run';
var DK='wi_inf_done';
var run=null; // current run object

function loadRun(){try{return JSON.parse(localStorage.getItem(RK));}catch(e){return null;}}
function saveRun(){localStorage.setItem(RK,JSON.stringify(run));}
function clearRun(){localStorage.removeItem(RK);run=null;}
function loadDone(){try{return JSON.parse(localStorage.getItem(DK))||[];}catch(e){return[];}}
function saveDone(arr){localStorage.setItem(DK,JSON.stringify(arr));}

function generateOrder(){
  var done=loadDone();
  var pool=[];
  for(var i=0;i<_d.length;i++){if(done.indexOf(i)===-1)pool.push(i);}
  if(pool.length===0){saveDone([]);pool=[];for(var i=0;i<_d.length;i++)pool.push(i);}
  // Fisher-Yates shuffle
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t;}
  return pool;
}

function newRun(){
  run={strikes:0,shields:0,streak:0,maxStreak:0,shieldsThisRun:0,pos:0,order:generateOrder(),cur:null};
  saveRun();
  var s=loadS();s.runs=(s.runs||0)+1;s.runPuzzles=0;saveS(s);
}

function loadPuzzleFromRun(){
  if(!run||run.pos>=run.order.length){
    var done=loadDone();
    if(done.length>=_d.length)saveDone([]);
    run.order=generateOrder();run.pos=0;saveRun();
  }
  var idx=run.order[run.pos];
  setPuzzle(idx);
  run.cur={ix:idx,g:[],e:[],o:false,w:false,ph:'main',bc:false,b1g:[],b1o:false,b1w:false,b2g:[],b2o:false,b2w:false};
  saveRun();
}

function saveGameState(){
  if(!run||!run.cur)return;
  run.cur.g=gHistory;run.cur.e=eras;run.cur.o=over;run.cur.w=won;
  run.cur.ph=phase;run.cur.bc=isBC;
  run.cur.b1g=b1guesses;run.cur.b1o=b1over;run.cur.b1w=b1won;
  run.cur.b2g=b2guesses;run.cur.b2o=b2over;run.cur.b2w=b2won;
  saveRun();
}

function restoreGameState(){
  if(!run||!run.cur)return false;
  var c=run.cur;
  setPuzzle(c.ix);
  gHistory=c.g||[];eras=c.e||[];over=c.o||false;won=c.w||false;
  phase=c.ph||'main';isBC=c.bc||false;
  b1guesses=c.b1g||[];b1over=c.b1o||false;b1won=c.b1w||false;
  b2guesses=c.b2g||[];b2over=c.b2o||false;b2won=c.b2w||false;
  return true;
}

// ====== STATS (separate key, v2 with strike/shield tracking) ======
var STK='wi_inf_stats';
var loadS=function(){var s;try{s=JSON.parse(localStorage.getItem(STK))||defS();}catch(e){s=defS();}return migrateStats(s);};
var defS=function(){return{v:2,p:0,w:0,s:0,m:0,d:{1:0,2:0,3:0,4:0,5:0,6:0},b1p:0,b1w:0,b2p:0,b2w:0,runs:0,bestRun:0,runPuzzles:0,shieldsEarned:0,strikesAbsorbed:0,perfectBonuses:0,b1l:null,b2l:null};};
// merges onto defaults so a partial stored object cannot make recRes/showStats throw
var saveS=function(s){localStorage.setItem(STK,JSON.stringify(s));};
function migrateStats(s){var base=defS();for(var k in s)base[k]=s[k];if(!base.d)base.d={1:0,2:0,3:0,4:0,5:0,6:0};if(base.v!==2){base.v=2;saveS(base);}return base;}
var recRes=function(w,n){var s=loadS();s.p++;if(w){s.w++;s.d[n]=(s.d[n]||0)+1;}saveS(s);};
// per-puzzle dedup (b1l/b2l via _ix) so a lost run state cannot double-count a bonus round
var recB1=function(w){var s=loadS();if(s.b1l===_ix)return;s.b1l=_ix;s.b1p=(s.b1p||0)+1;if(w)s.b1w=(s.b1w||0)+1;saveS(s);};
var recB2=function(w){var s=loadS();if(s.b2l===_ix)return;s.b2l=_ix;s.b2p=(s.b2p||0)+1;if(w)s.b2w=(s.b2w||0)+1;saveS(s);};

// ====== STRIKE / SHIELD / STREAK ======
var _notifiedRecord=false; // only notify once per session when beating record

function applyStrike(){
  if(run.shields>0){
    run.shields--;
    var s=loadS();s.strikesAbsorbed=(s.strikesAbsorbed||0)+1;saveS(s);
    saveRun();
    renderStrikes();renderShields();
    toast(t('infinite.shieldAbsorbed'));
    return false; // not a real strike
  }
  run.strikes++;
  saveRun();
  renderStrikes(true);
  if(run.strikes>=MAX_STRIKES){
    var s=loadS();
    s.bestRun=Math.max(s.bestRun||0,s.runPuzzles||0);
    s.s=0;
    saveS(s);
    gameOver=true;
    setTimeout(function(){showGameOver();},800);
    return true; // game ended
  }
  toast(t('infinite.strike',{current:run.strikes,max:MAX_STRIKES}));
  return false;
}

function updateStreak(yearWon){
  if(yearWon){
    run.streak++;
    if(run.streak>(run.maxStreak||0))run.maxStreak=run.streak;
    var s=loadS();
    s.s=run.streak;
    s.runPuzzles=(s.runPuzzles||0)+1;
    if(run.streak>s.m){
      s.m=run.streak;
      if(!_notifiedRecord){_notifiedRecord=true;setTimeout(function(){toast(t('infinite.newBestStreak',{streak:run.streak}),3000);},1500);}
      else{setTimeout(function(){toast(t('infinite.newBestStreak',{streak:run.streak}),3000);},1500);}
    }
    saveS(s);
  }else{
    run.streak=0;
    var s=loadS();s.s=0;s.runPuzzles=(s.runPuzzles||0)+1;saveS(s);
  }
  saveRun();
  renderStreak();
}

function evaluatePerfectBonus(){
  if(!run||!run.cur)return;
  if(run.cur.pb)return;
  if(!run.cur.w)return;
  if(!run.cur.b1w||!run.cur.b2w)return;
  if((run.cur.b1g||[]).length!==1)return;
  if((run.cur.b2g||[]).length!==1)return;
  run.cur.pb=true;saveRun();
  var s=loadS();s.perfectBonuses=(s.perfectBonuses||0)+1;saveS(s);
  if(run.strikes>0){
    run.strikes--;saveRun();renderStrikes();
    toast(t('infinite.perfectStrike'),3000);
  }else{
    if(run.shields<MAX_SHIELDS){run.shields++;run.shieldsThisRun=(run.shieldsThisRun||0)+1;saveRun();renderShields(true);
    var s2=loadS();s2.shieldsEarned=(s2.shieldsEarned||0)+1;saveS(s2);
    toast(t('infinite.perfectShield'),3000);}else{toast(t('infinite.perfectFull'),3000);}
  }
}

var _shieldSvg='<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
var _xSvg='<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function renderLives(animateType){
  var el=document.getElementById('lives-display');if(!el||!run)return;
  el.innerHTML='';
  for(var i=0;i<MAX_STRIKES;i++){
    var box=document.createElement('div');
    if(i<run.strikes){
      box.className='life-box strike';box.innerHTML=_xSvg;
      if(animateType==='strike'&&i===run.strikes-1){
        box.classList.add('strike-hit');
      }
    }else if(i<run.shields){
      box.className='life-box shield';box.innerHTML=_shieldSvg;
      if(animateType==='shield'&&i===run.shields-1){
        box.classList.add('shield-glow');
      }
    }else{
      box.className='life-box';
    }
    el.appendChild(box);
  }
}

function renderStrikes(animate){renderLives(animate?'strike':null);}
function renderShields(animate){renderLives(animate?'shield':null);}

function renderStreak(){
  var el=document.getElementById('streak-count');if(!el)return;
  var streak=run?run.streak:0;
  el.textContent=streak;
  var fill=document.getElementById('streak-fill');
  if(fill){fill.style.width=Math.min(100,streak/_d.length*100)+'%';}
}

// ====== INIT RUN ======
(function(){
  run=loadRun();
  if(!run){newRun();loadPuzzleFromRun();}
  else if(run.strikes>=MAX_STRIKES){gameOver=true;setPuzzle(run.cur?run.cur.ix:run.order[run.pos]||0);}
  else if(run.cur){restoreGameState();}
  else{loadPuzzleFromRun();}
})();

// ====== DOM ======
function initDOM(){
  setInvName(_e.name);
  document.getElementById('inv-desc').textContent=_e.description||'';
  document.getElementById('puzzle-num').textContent=(window.I18N?I18N.t('infinite.invention'):'Infinite Invention')+' #'+(run?run.pos+1:1);
  var imgEl=document.getElementById('inv-img');
  imgEl.innerHTML='';
  if(_e.image&&_e.image.src){var img=document.createElement('img');img.src=_e.image.src;img.alt=_e.name;imgEl.appendChild(img);}
  renderStrikes();renderShields();renderStreak();renderRound();
}
initDOM();

// Override handleKey to also check gameOver
handleKey=function(k){
  if(over||gameOver)return;
  if(k==='ENTER')submit();
  else if(k==='DEL'){if(cur.length>0){cur.pop();renderInput();}}
  else if(k==='ERA')toggleEra();
  else if(cur.length<4){cur.push(+k);renderInput();var c=document.getElementById('ic-'+(cur.length-1));c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop');}
};

// Override inputEra click to also check gameOver
inputEra.onclick=function(){if(!over&&!gameOver)toggleEra();};

// Build numpad and wire settings from core.js
buildNumpad();
wireSettings();

// ====== GUESS LOGIC ======
function submit(){
  if(over||spinning||gameOver)return;
  if(cur.length<3){toast(t('game.enterDigits'));return;}
  var _padCount=4-cur.length;
  while(cur.length<4)cur.unshift(0);
  var gn=cur[0]*1000+cur[1]*100+cur[2]*10+cur[3],gy=isBC?-gn:gn;
  if(gn===0){toast(t('game.yearZero'));return;}
  if(gy>2026){toast(t('game.afterMax'));return;}
  if(gy<-9999){toast(t('game.beforeMin'));return;}

  var guessStr=String(gn).padStart(4,'0')+(isBC?'BC':'AD');
  for(var i=0;i<gHistory.length;i++){
    var prevStr=String(gHistory[i][0]*1000+gHistory[i][1]*100+gHistory[i][2]*10+gHistory[i][3]).padStart(4,'0')+(eras[i]?'BC':'AD');
    if(guessStr===prevStr){toast(t('game.alreadyGuessed'));return;}
  }

  spinning=true;
  gHistory.push(cur.slice());eras.push(isBC);renderRound();
  var r=gHistory.length-1;
  var cols=getColors(cur,isBC),eraOk=isBC===_tb;

  var skipSpin=[false,false,false,false],skipEra=false;
  if(r>0){
    var prevCols=getColors(gHistory[r-1],eras[r-1]);
    var prevEraOk=eras[r-1]===_tb;
    for(var i=0;i<4;i++){if(prevCols[i]==='green'&&cols[i]==='green')skipSpin[i]=true;}
    if(prevEraOk&&eraOk)skipEra=true;
  }

  var isExact=gy===_ty;
  var isRange=!isExact&&(typeof isYearInRange==='function')&&isYearInRange(gy);
  var isWin=isExact||isRange;
  if(isRange){cols=['green','green','green','green'];eraOk=true;}
  if(isWin){skipSpin=[false,false,false,false];skipEra=false;}

  var doSpin=prefSpin();
  addGuessRow(r,cur,isBC,cols,eraOk,doSpin,skipSpin,skipEra,isWin&&doSpin,_padCount);

  var spinDur;
  if(!doSpin){spinDur=200;}
  else if(isWin){spinDur=400+5*350+350+1000;}
  else{var _ac=(skipEra?0:1);for(var i=0;i<4;i++){if(!skipSpin[i])_ac++;}spinDur=_ac===0?200:400+(_ac-1)*350+350;}
  spinDur+=200;

  // Resolves and persists the outcome synchronously; the animation below is cosmetic, so
  // a reload mid-animation cannot drop a win, void a strike, or double-count the result.
  if(isWin){over=true;won=true;recRes(true,r+1);updateStreak(true);}
  else if(gHistory.length>=MAX){over=true;won=false;recRes(false,0);updateStreak(false);if(run&&run.cur)run.cur.pendingStrike=true;}
  if(over)saveGameState();

  setTimeout(function(){
    spinning=false;
    if(won){
      inputRow.classList.add('hidden');
      document.getElementById('numpad-wrap').style.display='none';
      setTimeout(function(){
        var rows=guessesEl.querySelectorAll('.guess-row');
        if(!rows.length)return;
        var winRow=rows[rows.length-1];
        var cells=winRow.querySelectorAll('.guess-cell, .guess-era-chip');
        for(var c=0;c<cells.length;c++){
          cells[c].style.animation='none';
          cells[c].style.borderColor='#fbbf24';
        }
      },3500);
      toast([t('game.win1'),t('game.win2'),t('game.win3'),t('game.win4'),t('game.win5'),t('game.win6')][r]);
      setTimeout(function(){showPostGame();},1000);
    }else if(over){
      inputRow.classList.add('hidden');
      document.getElementById('numpad-wrap').style.display='none';
      var _doSpinAnswer=prefSpin();
      addGuessRow(gHistory.length,_td,_tb,['green','green','green','green'],true,_doSpinAnswer,null,false,false,0);
      // Wait for answer row spin to finish, then show popup
      var _answerSpinDur=_doSpinAnswer?(400+4*350+350+200):200;
      setTimeout(function(){showPostGame(true);},_answerSpinDur+1000);
    }
  },spinDur);

  cur=[];renderInput();
  if(isWin||gHistory.length>=MAX){inputRow.classList.add('hidden');document.getElementById('numpad-wrap').style.display='none';}
  saveGameState();
}

// ====== BUTTON HELPERS ======
function _mkBtn(text,onclick,secondary){
  var b=document.createElement('button');b.className='continue-btn';b.textContent=text;
  if(secondary){b.style.background='var(--surface)';b.style.color='var(--text2)';b.style.border='2px solid var(--border)';}
  b.style.marginTop='0';
  b.onclick=onclick;
  return b;
}
function _mkBtnRow(){
  var d=document.createElement('div');
  d.style.display='flex';d.style.gap='8px';d.style.justifyContent='center';d.style.flexWrap='wrap';d.style.marginTop='8px';
  return d;
}
function _doneAction(){phase='done';evaluatePerfectBonus();saveGameState();bonusArea.innerHTML='';showStats();}
function _nextAction(){advanceToNext();}

// ====== POST GAME ======
function showPostGame(pendingStrike){
  if(phase!=='main')return;
  bonusArea.innerHTML='';

  // Consumes a persisted pending strike (set at loss time) so it applies exactly once,
  // even across a reload during the answer animation.
  var doStrike=pendingStrike;
  if(run&&run.cur&&run.cur.pendingStrike){doStrike=true;run.cur.pendingStrike=false;saveRun();}

  if(won){
    _showPostGameButtons();
  }else{
    if(doStrike){
      var ended=applyStrike();
      saveGameState();
      if(ended)return;
    }
    setTimeout(function(){
      _showPostGameButtons();
    },doStrike?700:0);
  }
}

function _showPostGameButtons(){
  bonusArea.innerHTML='';
  var g=document.createElement('div');
  g.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
  var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;justify-content:center;';
  row.appendChild(_mkBtn(t('btn.bonus'),function(){startBonus1();}));
  row.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
  g.appendChild(row);
  g.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
  bonusArea.appendChild(g);
  revealBtnWrap(g);
  scrollToBottom();
}

// ====== BONUS ROUND 1: Country ======
function startBonus1(){
  phase='bonus1';
  saveGameState();   // persist entering the round so a reload restores mid-BR1
  document.getElementById('col-labels').style.display='none';
  collapseToLastRow();
  renderBonus1();
}

function handleB1Pick(choice){
  if(b1over)return;
  b1guesses.push(choice);
  var isCorrect=checkCountry(choice);
  b1over=true;b1won=isCorrect;recB1(isCorrect);
  saveGameState(); // persist immediately so a reload during the fold can't re-open this round

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
      ?'<span>'+t('bonus.round1Country')+'</span><span>\u2705 <span class="bc-arrow">\u25BC</span></span>'
      :'<span>'+t('bonus.round1Country')+'</span><span>\u274C <span class="bc-arrow">\u25BC</span></span>',
    borderColor: isCorrect?'#fbbf24':'#b92d2d',
    goldBorder: isCorrect,
    revealIdx: isCorrect?null:correctIdx,
    onDone: function(){
      saveGameState();
      // Show next-step buttons with a smooth slide-in
      var btnWrap=document.createElement('div');
      btnWrap.className='bonus-btnwrap';
      btnWrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
      var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;justify-content:center;';
      row.appendChild(_mkBtn(t('btn.bonus2'),function(){
        showAdModal([
          {text:t('btn.bonus2'),onclick:function(){startBonus2();}},
          {text:t('infinite.nextDate'),onclick:_nextAction},
          {text:t('btn.done'),secondary:true,onclick:_doneAction}
        ]);
      }));
      row.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
      btnWrap.appendChild(row);
      btnWrap.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
      bonusArea.appendChild(btnWrap);
      revealBtnWrap(btnWrap);
      scrollToBottom();
    }
  });
}

function renderBonus1(){
  bonusArea.innerHTML='';
  var stage=document.createElement('div');stage.className='bonus-stage';

  // Header (collapsed bar)
  var header=document.createElement('div');header.className='bonus-collapse br1-header';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML='<span>'+t('bonus.round1Country')+'</span><span><span class="bc-arrow">\u25BC</span></span>';
  header.appendChild(headerInner);
  // Active-round toggle; cascadeFold installs the completed-round toggle over this
  // once the round is answered.
  header.style.cursor='pointer';
  header.onclick=function(){
    if(b1over)return;
    activeCascadeToggle(header,drawer);
  };

  // Drawer (options area)
  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';

  var prompt=document.createElement('div');prompt.className='bonus-prompt';
  prompt.textContent=t('bonus.countryQ');
  drawer.appendChild(prompt);

  var choices=generateB1Choices(_ix*31+7);
  var optDiv=document.createElement('div');optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    if(b1guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var disp=window.tCountry?tCountry(choice):choice;
      var wasGuessed=b1guesses.indexOf(choice)!==-1;
      var isCorrect=checkCountry(choice);
      if(wasGuessed&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.classList.add('gold-border');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(disp);
      }else if(wasGuessed){
        theBtn.classList.add('mc-wrong');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(disp);
      }else if(b1over&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(disp);
      }else if(b1over){
        theBtn.classList.add('mc-disabled');theBtn.style.animation='none';
        theBtn.textContent=disp;
      }else{
        theBtn.textContent=disp;
        theBtn.onclick=function(){handleB1Pick(choice);};
      }
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b1over){
    var b1BtnRow=document.createElement('div');
    b1BtnRow.setAttribute('data-btn-row','1');
    b1BtnRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    b1BtnRow.appendChild(_mkBtn(t('infinite.nextDate'),function(){b1over=true;b1won=false;recB1(false);saveGameState();_nextAction();}));
    b1BtnRow.appendChild(_mkBtn(t('btn.done'),function(){b1over=true;b1won=false;recB1(false);saveGameState();_doneAction();},true));
  }

  stage.appendChild(header);
  stage.appendChild(drawer);
  // Button row sits in the stage below the drawer, so skip/done stay available while
  // the active question is folded away (activeCascadeToggle collapses only the drawer).
  if(typeof b1BtnRow!=='undefined'&&b1BtnRow) stage.appendChild(b1BtnRow);
  bonusArea.appendChild(stage);
  // fresh round: the whole card enters with the shared fade+settle
  if(!b1over) revealBtnWrap(stage);

  // fresh open: animate the drawer drop-down, same motion as expand-from-collapsed
  if(!b1over){
    animateDrawerOpen(drawer);
  }

  if(b1over){
    // already answered (reload): show next-step buttons below
    var doneRow=document.createElement('div');
    doneRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    if(!b2over) doneRow.appendChild(_mkBtn(t('btn.bonus2'),function(){startBonus2();}));
    doneRow.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    doneRow.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
    bonusArea.appendChild(doneRow);
    revealBtnWrap(doneRow);
  }
  scrollToBottom();
}

// ====== BONUS ROUND 2: Inventor ======
function startBonus2(){
  phase='bonus2';
  saveGameState();   // persist entering the round so a reload restores mid-BR2
  renderBonus2();
}

function handleB2Pick(choice){
  if(b2over)return;
  b2guesses.push(choice);
  var isCorrect=checkInventor(choice);
  b2over=true;b2won=isCorrect;recB2(isCorrect);
  saveGameState(); // persist immediately so a reload during the fold can't re-open this round

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
      ?'<span>'+t('bonus.round2Inventor')+'</span><span>\u2705 <span class="bc-arrow">\u25BC</span></span>'
      :'<span>'+t('bonus.round2Inventor')+'</span><span>\u274C <span class="bc-arrow">\u25BC</span></span>',
    borderColor: isCorrect?'#fbbf24':'#b92d2d',
    goldBorder: isCorrect,
    revealIdx: isCorrect?null:correctIdx,
    onDone: function(){
      saveGameState();
      evaluatePerfectBonus();
      var btnWrap=document.createElement('div');
      btnWrap.className='bonus-btnwrap';
      btnWrap.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
      btnWrap.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
      btnWrap.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
      bonusArea.appendChild(btnWrap);
      revealBtnWrap(btnWrap);
      scrollToBottom();
    }
  });
}

function renderBonus2(){
  // Fades out post-BR1 buttons then removes them, keeping the BR1 collapsed
  // header/stage so it persists above BR2.
  var toFade=[];
  for(var ci=bonusArea.children.length-1;ci>=0;ci--){
    var c=bonusArea.children[ci];
    if(c.nodeType===1&&(c.classList.contains('bonus-collapse')||c.classList.contains('bonus-stage')))break;
    toFade.push(c);
  }
  // reload mid-BR2: BR1's collapsed stage is not in the DOM, so rebuild it as a recap
  if(b1over&&!bonusArea.querySelector('.bonus-stage')){_recapStage('b1');}
  toFade.forEach(function(el){
    el.style.transition='opacity 0.2s ease, transform 0.2s ease';
    el.style.opacity='0';
    el.style.transform='translateY(-6px)';
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 220);
  });
  var isUnknown=_e.inventor.toLowerCase()==='unknown';

  if(isUnknown&&!b2over){b2over=true;b2won=true;saveGameState();evaluatePerfectBonus();} // free win: not counted in bonus stats

  var stage=document.createElement('div');stage.className='bonus-stage';

  // Header
  var header=document.createElement('div');header.className='bonus-collapse br1-header';
  var headerInner=document.createElement('div');headerInner.className='bonus-collapse-header';
  headerInner.innerHTML='<span>'+t('bonus.round2Inventor')+'</span><span><span class="bc-arrow">\u25BC</span></span>';
  header.appendChild(headerInner);
  // Active-round toggle (see renderBonus1) \u2014 cascadeFold takes over once answered.
  header.style.cursor='pointer';
  header.onclick=function(){
    if(b2over)return;
    activeCascadeToggle(header,drawer);
  };

  // Drawer
  var drawer=document.createElement('div');drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:12px;display:flex;flex-direction:column;align-items:stretch;';

  var prompt=document.createElement('div');prompt.className='bonus-prompt';
  prompt.textContent=t('bonus.inventorQ');
  drawer.appendChild(prompt);

  if(isUnknown){
    var res=document.createElement('div');res.className='bonus-result';
    res.innerHTML='\u2705 '+t('bonus.unknownInventor');
    drawer.appendChild(res);
    stage.appendChild(header);stage.appendChild(drawer);bonusArea.appendChild(stage);
    // b2over is already true here, so give the free-win card its own working toggle
    header.onclick=function(){activeCascadeToggle(header,drawer);};
    var unkWrap=document.createElement('div');
    unkWrap.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    unkWrap.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    unkWrap.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
    bonusArea.appendChild(unkWrap);
    revealBtnWrap(unkWrap);
    scrollToBottom();
    return;
  }

  var choices=generateB2Choices(_ix*31+13);
  var optDiv=document.createElement('div');optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    if(b2guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var wasGuessed=b2guesses.indexOf(choice)!==-1;
      var isCorrect=checkInventor(choice);
      if(wasGuessed&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.classList.add('gold-border');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);
      }else if(wasGuessed){
        theBtn.classList.add('mc-wrong');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(choice);
      }else if(b2over&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);
      }else if(b2over){
        theBtn.classList.add('mc-disabled');theBtn.style.animation='none';
        theBtn.textContent=choice;
      }else{
        theBtn.textContent=choice;
        theBtn.onclick=function(){handleB2Pick(choice);};
      }
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b2over){
    var b2BtnRow=document.createElement('div');
    b2BtnRow.setAttribute('data-btn-row','1');
    b2BtnRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    b2BtnRow.appendChild(_mkBtn(t('infinite.nextDate'),function(){b2over=true;b2won=false;recB2(false);saveGameState();_nextAction();}));
    b2BtnRow.appendChild(_mkBtn(t('btn.done'),function(){b2over=true;b2won=false;recB2(false);saveGameState();_doneAction();},true));
  }

  stage.appendChild(header);stage.appendChild(drawer);
  // Button row in the stage below the drawer, so it stays available while folded
  if(typeof b2BtnRow!=='undefined'&&b2BtnRow) stage.appendChild(b2BtnRow);
  bonusArea.appendChild(stage);
  if(!b2over) revealBtnWrap(stage);   // fresh round enters with the shared fade+settle

  // Fresh open — animate drawer drop-down same as expand-from-collapsed
  if(!b2over){
    animateDrawerOpen(drawer);
  }

  if(b2over){
    var doneRow=document.createElement('div');
    doneRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    doneRow.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    doneRow.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
    bonusArea.appendChild(doneRow);
    revealBtnWrap(doneRow);
  }
  scrollToBottom();
}

// ====== RESTORE BUTTONS (after closing stats while game is done) ======
// Rebuilds a completed bonus round as an instant-folded cascade stage, so expanding a
// recap plays the same reverse cascade the live between-rounds toggle uses.
// Infinite variant: 1-attempt rounds (plain header, no counter) and _ix-based seeds.
function _recapStage(kind){
  var isB1=kind==='b1';
  var wonR=isB1?b1won:b2won;
  var guesses=isB1?b1guesses:b2guesses;
  var choices=isB1?generateB1Choices(_ix*31+7):generateB2Choices(_ix*31+13);
  var check=isB1?checkCountry:checkInventor;
  var title=isB1?t('bonus.round1Country'):t('bonus.round2Inventor');
  var _tc=window.tCountry||function(x){return x;};
  var headerHtml='<span>'+title+'</span><span>'+(wonR?'✅':'❌')+' <span class="bc-arrow">▼</span></span>';

  var stage=document.createElement('div');stage.className='bonus-stage';
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
    var disp=isB1?_tc(choices[i]):choices[i];
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

// Rebuilds collapsed bonus-round recap cards + context buttons, mirroring the daily page.
function restoreButtons(){
  if(!over)return;
  if((phase==='bonus1'&&!b1over)||(phase==='bonus2'&&!b2over))return;
  bonusArea.innerHTML='';
  var _tc=window.tCountry||function(x){return x;};

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
  if(!b1over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    topRow.appendChild(_mkBtn(t('btn.bonus'),function(){startBonus1();}));
    topRow.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    wrap.appendChild(topRow);
    wrap.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
  }else if(!b2over){
    var topRow2=document.createElement('div');
    topRow2.style.cssText='display:flex;gap:8px;justify-content:center;';
    topRow2.appendChild(_mkBtn(t('btn.bonus2'),function(){
      showAdModal([
        {text:t('btn.bonus2'),onclick:function(){startBonus2();}},
        {text:t('infinite.nextDate'),onclick:_nextAction},
        {text:t('btn.done'),secondary:true,onclick:_doneAction}
      ]);
    }));
    topRow2.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    wrap.appendChild(topRow2);
    wrap.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
  }else{
    var doneRow=document.createElement('div');
    doneRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    doneRow.appendChild(_mkBtn(t('infinite.nextDate'),_nextAction));
    doneRow.appendChild(_mkBtn(t('btn.done'),_doneAction,true));
    wrap.appendChild(doneRow);
  }
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
}

// ====== STATS ======
function showStats(){
  var s=loadS();
  document.getElementById('s-played').textContent=s.p;
  document.getElementById('s-win').textContent=s.p>0?Math.round(s.w/s.p*100):0;
  document.getElementById('s-streak').textContent=run?run.streak:s.s;
  document.getElementById('s-max').textContent=s.m;
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
    var _tc=window.tCountry||function(x){return x;};
    var hn=_e.country.historical!==_e.country.modern?'<br>'+escHtml(_tc(_e.country.historical))+' ('+escHtml(_tc(_e.country.modern))+')':'<br>'+escHtml(_tc(_e.country.modern));
    var srcHtml=typeof getSourceHtml==='function'?getSourceHtml():'';
    var originHtml=typeof getOriginHtml==='function'?getOriginHtml():'';
    rEl.innerHTML='<div class="ans-yr">'+ys+'</div><div class="ans-info"><strong>'+escHtml(typeof dataT==='function'?dataT('name'):_e.name)+'</strong>'+hn+'<br>'+t('result.inventedBy',{name:escHtml(_e.inventor)})+'<br>'+escHtml(window.tCat?tCat(_e.category):_e.category)+srcHtml+originHtml+'</div>';
    document.getElementById('next-btn').style.display='inline-flex';
    document.getElementById('share-btn').style.display='inline-flex';
  }else{rEl.innerHTML='';document.getElementById('next-btn').style.display='none';document.getElementById('share-btn').style.display='none';}
  document.getElementById('m-stats').classList.add('show');
}

// ====== SHARE ======
document.getElementById('share-btn').onclick=function(){
  var title='Inventle \u221E #'+(_ix+1)+' '+(won?gHistory.length:'X')+'/6';
  var lines=[title+'\n'];
  for(var r=0;r<gHistory.length;r++){
    var c=getColors(gHistory[r],eras[r]),eOk=eras[r]===_tb;
    var row=eOk?'\ud83d\udfe6':'\ud83d\udfe5';
    row+=c.map(function(x){return shareSquare(x);}).join('');
    lines.push(row);
  }
  if(b1over||b2over){
    lines.push('');
    if(b1over){lines.push(t('share.country')+' '+(b1won?'\ud83c\udf0d\u2705':'\ud83c\udf0d\u274c'));}
    if(b2over){lines.push(t('share.inventor')+' '+(b2won?'\ud83d\udca1\u2705':'\ud83d\udca1\u274c'));}
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

// ====== NEXT PUZZLE (reset everything) ======
function advanceToNext(){
  document.getElementById('m-stats').classList.remove('show');
  evaluatePerfectBonus();
  if(won){var done=loadDone();if(done.indexOf(_ix)===-1){done.push(_ix);saveDone(done);}}
  run.pos++;run.cur=null;saveRun();
  if(gameOver)return;
  cur=[];gHistory=[];eras=[];isBC=false;over=false;won=false;
  phase='main';
  b1guesses=[];b1over=false;b1won=false;
  b2guesses=[];b2over=false;b2won=false;
  spinning=false;
  loadPuzzleFromRun();
  initDOM();
  guessesEl.innerHTML='';
  bonusArea.innerHTML='';
  inputRow.classList.remove('hidden');
  document.getElementById('numpad-wrap').style.display='';
  document.getElementById('col-labels').style.display='';
  var _restore=['inv-img','inv-desc','guesses','col-labels'];
  for(var i=0;i<_restore.length;i++){var el=document.getElementById(_restore[i]);if(el)el.style.cssText='';}
  guessesEl.style.cssText='';_collapsed=false;
  inputEra.textContent=t('era.ad');
  inputEra.className='input-era ad';
  var adB=document.getElementById('np-ad');
  var bcB=document.getElementById('np-bc');
  if(adB){adB.className='np-key era-ad sel';}
  if(bcB){bcB.className='np-key era-bc dim';}
  renderInput();
  gameScroll.scrollTo({top:0});
}

// ====== GAME OVER ======
function showGameOver(){
  var s=loadS();
  bonusArea.innerHTML='';
  inputRow.classList.add('hidden');
  document.getElementById('numpad-wrap').style.display='none';
  var m=document.getElementById('m-gameover');
  // Per-run figures: the modal summarises the run that just ended, not lifetime totals.
  // runPuzzles is reset to 0 in newRun(); maxStreak/shieldsThisRun live on the run object.
  document.getElementById('go-puzzles').textContent=s.runPuzzles||0;
  document.getElementById('go-streak').textContent=(run&&run.maxStreak)||0;
  document.getElementById('go-shields').textContent=(run&&run.shieldsThisRun)||0;
  m.classList.add('show');
}
function startNewRun(){
  document.getElementById('m-gameover').classList.remove('show');
  gameOver=false;_notifiedRecord=false;
  cur=[];gHistory=[];eras=[];isBC=false;over=false;won=false;
  phase='main';b1guesses=[];b1over=false;b1won=false;
  b2guesses=[];b2over=false;b2won=false;spinning=false;
  newRun();loadPuzzleFromRun();initDOM();
  guessesEl.innerHTML='';bonusArea.innerHTML='';
  inputRow.classList.remove('hidden');
  document.getElementById('numpad-wrap').style.display='';
  var _restore=['inv-img','inv-desc','guesses','col-labels'];
  for(var i=0;i<_restore.length;i++){var el=document.getElementById(_restore[i]);if(el)el.style.cssText='';}
  guessesEl.style.cssText='';_collapsed=false;
  document.getElementById('col-labels').style.display='';
  inputEra.textContent=t('era.ad');inputEra.className='input-era ad';
  var adB=document.getElementById('np-ad');var bcB=document.getElementById('np-bc');
  if(adB){adB.className='np-key era-ad sel';}if(bcB){bcB.className='np-key era-bc dim';}
  renderInput();gameScroll.scrollTo({top:0});
}

document.getElementById('next-btn').onclick=advanceToNext;

// ====== MODAL CONTROLS ======
document.getElementById('btn-stats').onclick=showStats;
document.getElementById('x-stats').onclick=function(){document.getElementById('m-stats').classList.remove('show');restoreButtons();};
document.getElementById('btn-help').onclick=function(){document.getElementById('m-help').classList.add('show');};
document.getElementById('x-help').onclick=function(){document.getElementById('m-help').classList.remove('show');};
document.querySelectorAll('.modal-bg').forEach(function(m){m.onclick=function(e){if(e.target===m){m.classList.remove('show');if(m.id==='m-stats')restoreButtons();}};});

// ====== RESTORE ON LOAD ======
(function(){
  if(gameOver){
    initDOM();
    inputRow.classList.add('hidden');
    document.getElementById('numpad-wrap').style.display='none';
    setTimeout(showGameOver,300);
    return;
  }
  if(gHistory.length>0){
    for(var r=0;r<gHistory.length;r++){
      var d=gHistory[r],eBC=eras[r],cols=getColors(d,eBC),eOk=eBC===_tb;
      addGuessRow(r,d,eBC,cols,eOk,false);
    }
    if(over){
      if(!won){addGuessRow(gHistory.length,_td,_tb,['green','green','green','green'],true,false,null,false,false,0);}
      inputRow.classList.add('hidden');
      document.getElementById('numpad-wrap').style.display='none';
      // both bonuses complete: auto-promote to done so reload shows the post-game view
      if((phase==='bonus1'||phase==='bonus2')&&b1over&&b2over){
        phase='done';saveGameState();
      }
      if(phase==='main'){
        setTimeout(function(){showPostGame();},300);
      }else if(phase==='bonus1'&&!b1over){
        // Still actively answering bonus 1
        document.getElementById('col-labels').style.display='none';
        collapseToLastRow({instant:true});   // reload = snapshot, not replay
        setTimeout(function(){renderBonus1();},300);
      }else if(phase==='bonus2'&&!b2over){
        // Still actively answering bonus 2
        document.getElementById('col-labels').style.display='none';
        collapseToLastRow({instant:true});   // reload = snapshot, not replay
        setTimeout(function(){renderBonus2();},300);
      }else{
        // answered-but-not-advanced or fully done: collapsed recap view
        document.getElementById('col-labels').style.display='none';
        collapseToLastRow({instant:true});   // reload = snapshot, not replay
        setTimeout(restoreButtons,300);
      }
    }
    if(isBC){
      inputEra.textContent=t('era.bc');inputEra.className='input-era bc';
      var adB=document.getElementById('np-ad');var bcB=document.getElementById('np-bc');
      if(adB){adB.className='np-key era-ad dim';}if(bcB){bcB.className='np-key era-bc sel';}
    }
  }
})();

// First-visit help. Uses its own storage key so the daily page's intro does not
// suppress this one, or vice versa.
if(!localStorage.getItem('wi_seen_help_inf')){localStorage.setItem('wi_seen_help_inf','1');document.getElementById('m-help').classList.add('show');}

// ====== LANGUAGE CHANGE LISTENER ======
document.addEventListener('langchange',function(){
  t=I18N.t; // refresh alias in case of hot-swap
  numpadEl.innerHTML='';buildNumpad();
  inputEra.textContent=isBC?t('era.bc'):t('era.ad');
});

