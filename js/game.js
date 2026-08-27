// ====================================================================
// game.js — Daily mode for Inventle
// Load AFTER data.js AND core.js
// ====================================================================
var INVENTLE_API = 'https://inventle-stats.blakexb.workers.dev';

// ====== DEBUG STATE OVERLAY ======
// Set to false to hide the corner debug box
var DEBUG_STATE_OVERLAY = false;
function _debugStateOverlay(){
  if(!DEBUG_STATE_OVERLAY)return;
  var box=document.getElementById('_dbg-state');
  if(!box){
    box=document.createElement('div');
    box.id='_dbg-state';
    box.style.cssText='position:fixed;bottom:8px;right:8px;z-index:9999;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:8px 10px;border:1px solid #0f0;border-radius:6px;pointer-events:none;white-space:pre;max-width:260px;';
    document.body.appendChild(box);
  }
  try{
    box.textContent=
      'phase: '+(typeof phase!=='undefined'?phase:'?')+'\n'+
      'over: '+(typeof over!=='undefined'?over:'?')+' won: '+(typeof won!=='undefined'?won:'?')+'\n'+
      'b1over: '+(typeof b1over!=='undefined'?b1over:'?')+' b1won: '+(typeof b1won!=='undefined'?b1won:'?')+'\n'+
      'b2over: '+(typeof b2over!=='undefined'?b2over:'?')+' b2won: '+(typeof b2won!=='undefined'?b2won:'?')+'\n'+
      'gHistory.len: '+(typeof gHistory!=='undefined'?gHistory.length:'?')+'\n'+
      'b1guesses: '+(typeof b1guesses!=='undefined'?JSON.stringify(b1guesses):'?')+'\n'+
      'b2guesses: '+(typeof b2guesses!=='undefined'?JSON.stringify(b2guesses):'?')+'\n'+
      'bonusArea.html.len: '+(typeof bonusArea!=='undefined'&&bonusArea?bonusArea.innerHTML.length:'?');
  }catch(e){box.textContent='dbg err: '+e.message;}
}
if(DEBUG_STATE_OVERLAY){setInterval(_debugStateOverlay,500);}
// ====== PUZZLE SETUP ======
var _ds=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
// UTC integer-day math so DST never shifts the boundary by an hour near local midnight.
var _pn=(function(){var p=_ds.split('-');return Math.floor((Date.UTC(+p[0],+p[1]-1,+p[2])-Date.UTC(2025,0,1))/864e5)+1;})();

// Server-side puzzle: year is NEVER available client-side until game over
// _ty, _tb, _ta, _td start as null — set only when server reveals the answer
_e={name:'',description:'',country:{},inventor:'',category:''};
_ty=null;_tb=null;_ta=null;_td=null;
var _serverReady=false;
var _serverError=false;

// Stored server responses for each guess (used for restore)
var _guessColors=[];
var _guessEraOk=[];

// Fetch puzzle info from server (no year included)
(function(){
  var apiUrl=(typeof INVENTLE_API!=='undefined'?INVENTLE_API:'')+'/api/puzzle?date='+_ds;
  try{
    fetch(apiUrl).then(function(r){return r.json();}).then(function(data){
      if(data&&data.name){
        _e=data;
        _pn=data.puzzleNum||_pn;
        _track.puzzle=_pn; // use the server-authoritative number for telemetry, not the client estimate
        _serverReady=true;
        // Map the server puzzle name into the local ordered array so dataT() can index the
        // language overlay (daily never set _ix, so name/desc stayed English).
        _ix=undefined;for(var _mi=0;_mi<_d.length;_mi++){if(_d[_mi].name===_e.name){_ix=_mi;break;}}
        setInvName(typeof dataT==='function'?dataT('name'):_e.name);
        document.getElementById('inv-desc').textContent=(typeof dataT==='function'&&typeof _dataOverlay!=='undefined'&&_dataOverlay?(dataT('desc')||dataT('description')):'')||_e.description||'';
        document.getElementById('puzzle-num').textContent=(window.I18N?I18N.t('game.inventionNum',{num:_pn}):'Invention #'+_pn);
      }else{
        _serverError=true;
      }
    }).catch(function(){_serverError=true;});
  }catch(e){_serverError=true;}
})();

// ====== ANALYTICS TRACKING (anonymous, no PII) ======
var _track={
  puzzle:_pn,
  startTime:Date.now(),
  guessTimes:[],
  firstGuess:null,
  usedBC:false,
  inputMethod:'none',
  keyboardType:'none',
  won:false,
  guesses:0,
  totalTime:0,
  b1:'none',
  b2:'none',
  shared:false,
  mobile:window.matchMedia('(max-width:600px)').matches,
  dark:(function(){try{return(JSON.parse(localStorage.getItem('wi_prefs'))||{}).theme!=='light';}catch(e){return true;}})(),
  scheme:(function(){try{return(JSON.parse(localStorage.getItem('wi_prefs'))||{}).scheme||0;}catch(e){return 0;}})(),
  streak:0,
  hourUTC:new Date().getUTCHours(),
  submitted:false,
  finalized:false,      // true only once the game has truly ended (set by _trackEnd)
  _lastSig:'',          // signature of the last payload sent, so amendments only re-send on real change
  // Per-game id for server-side dedup. Persisted per puzzle so a mid-game reload reuses
  // it, or the same player would count as two games.
  sid:(function(){
    var key='wi_sid_'+_pn;
    try{
      var saved=localStorage.getItem(key);
      if(saved)return saved;
    }catch(e){}
    var s='';for(var i=0;i<16;i++)s+=(Math.floor(Math.random()*16)).toString(16);
    try{
      localStorage.setItem(key,s);
      // keeps only the last few days of ids so this never grows without bound
      for(var k=0;k<localStorage.length;k++){
        var kk=localStorage.key(k);
        if(kk&&kk.indexOf('wi_sid_')===0&&(+kk.slice(7))<_pn-3){localStorage.removeItem(kk);k--;}
      }
    }catch(e){}
    return s;
  })()
};
// Sent once, on the first guess, which is what marks the game "played". Firing on the
// first guess rather than page load also keeps bot traffic out of the counts.
var _startSent=false;
function _trackStart(){
  if(_startSent)return;
  _startSent=true;
  try{
    var url=(typeof INVENTLE_API!=='undefined'?INVENTLE_API:'')+'/api/stats/start';
    var payload=JSON.stringify({p:_track.puzzle,sid:_track.sid,h:_track.hourUTC,mb:_track.mobile?1:0});
    // text/plain is CORS-safelisted, so the beacon needs no preflight
    if(navigator.sendBeacon)navigator.sendBeacon(url,new Blob([payload],{type:'text/plain'}));
    else fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:payload,keepalive:true}).catch(function(){});
  }catch(e){}
}
function _trackGuess(){
  _track.guessTimes.push(Date.now());
  if(_track.guessTimes.length===1){
    var gn=cur[0]*1000+cur[1]*100+cur[2]*10+cur[3];
    _track.firstGuess=isBC?-gn:gn;
  }
  _trackStart();
}
function _trackEnd(){
  _track.won=won;
  _track.guesses=gHistory.length;
  _track.totalTime=Math.round((Date.now()-_track.startTime)/1000);
  _track.usedBC=eras.some(function(e){return e===true;});
  try{var s=JSON.parse(localStorage.getItem('wi_stats'));if(s)_track.streak=s.s||0;}catch(e){}
  var gt=[];
  for(var i=0;i<_track.guessTimes.length;i++){
    var prev=i===0?_track.startTime:_track.guessTimes[i-1];
    gt.push(Math.round((_track.guessTimes[i]-prev)/1000));
  }
  _track.guessIntervals=gt;
  // marks final and submits the main result immediately, so navigating away or closing
  // the tab cannot lose it
  _track.finalized=true;
  _submitStats();
}
// Bonus/share happen after the main result is submitted, so these re-submit as
// amendments. Guarded so nothing is sent until the game has finalized.
function _trackB1(result){_track.b1=result;if(_track.finalized)_submitStats();}
function _trackB2(result){_track.b2=result;if(_track.finalized)_submitStats();}
function _trackShare(){_track.shared=true;if(_track.finalized)_submitStats();}
function _submitStats(){
  if(!_track.finalized)return; // never submit a half-initialised _track
  // only re-sends when something the server records changed
  var sig=[_track.won,_track.guesses,_track.b1,_track.b2,_track.shared].join('|');
  if(_track.submitted&&sig===_track._lastSig)return;
  var amend=_track.submitted?1:0;
  _track.submitted=true;
  _track._lastSig=sig;
  _track.dark=(lp().theme||'dark')==='dark';
  _track.scheme=lp().scheme||0;
  var payload={
    p:_track.puzzle,
    w:_track.won?1:0,
    g:_track.guesses,
    t:_track.totalTime,
    gt:_track.guessIntervals,
    fg:_track.firstGuess,
    bc:_track.usedBC?1:0,
    im:_track.inputMethod,
    kt:_track.keyboardType,
    b1:_track.b1,
    b2:_track.b2,
    sh:_track.shared?1:0,
    mb:_track.mobile?1:0,
    dk:_track.dark?1:0,
    sc:_track.scheme,
    sk:_track.streak,
    h:_track.hourUTC,
    sid:_track.sid,
    amend:amend
  };
  try{localStorage.setItem('wi_last_track',JSON.stringify(payload));}catch(e){}
  var apiUrl=(typeof INVENTLE_API!=='undefined'?INVENTLE_API:'')+'/api/stats';
  // prefers sendBeacon so an in-flight submit survives the page unloading
  try{
    if(navigator.sendBeacon){
      navigator.sendBeacon(apiUrl,new Blob([JSON.stringify(payload)],{type:'text/plain'})); // text/plain is CORS-safelisted, so no preflight
    }else{
      fetch(apiUrl,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),keepalive:true}).catch(function(){});
    }
  }catch(e){}
}

// ====== ANALYTICS CALLBACKS (wired into core.js) ======
onNumpadInput=function(){
  if(_track.inputMethod==='none')_track.inputMethod='numpad';
  else if(_track.inputMethod==='keyboard')_track.inputMethod='both';
};
onKeyboardInput=function(e){
  if(_track.inputMethod==='none')_track.inputMethod='keyboard';
  else if(_track.inputMethod==='numpad')_track.inputMethod='both';
  if(e.code&&e.code.indexOf('Numpad')===0){
    if(_track.keyboardType==='none')_track.keyboardType='numpad';
    else if(_track.keyboardType==='toprow')_track.keyboardType='both';
  }else if(/^(Digit|Key)/.test(e.code||'')){
    if(_track.keyboardType==='none')_track.keyboardType='toprow';
    else if(_track.keyboardType==='numpad')_track.keyboardType='both';
  }
};

// ====== BONUS STATE ======
var b1sel=[],b2sel=[];
var B_MAX=6;

// ====== DAILY STATE (localStorage) ======
var SK='wi_state';
var loadSt=function(){try{var s=JSON.parse(localStorage.getItem(SK));if(s&&s.d===_ds){gHistory=s.g||[];eras=s.e||[];over=s.o||false;won=s.w||false;phase=s.ph||'main';b1guesses=s.b1g||[];b1over=s.b1o||false;b1won=s.b1w||false;b2guesses=s.b2g||[];b2over=s.b2o||false;b2won=s.b2w||false;b1sel=s.b1s||[];b2sel=s.b2s||[];_guessColors=s.gc||[];_guessEraOk=s.ge||[];if(s.ty!=null){_ty=s.ty;_tb=_ty<0;_ta=Math.abs(_ty);_td=String(_ta).padStart(4,'0').split('').map(Number);}return true;}}catch(e){}return false;};
var saveSt=function(){var obj={d:_ds,g:gHistory,e:eras,o:over,w:won,ph:phase,b1g:b1guesses,b1o:b1over,b1w:b1won,b2g:b2guesses,b2o:b2over,b2w:b2won,b1s:b1sel,b2s:b2sel,gc:_guessColors,ge:_guessEraOk};if(_ty!=null)obj.ty=_ty;localStorage.setItem(SK,JSON.stringify(obj));};

// ====== DAILY STATS (localStorage) ======
var STK='wi_stats';
var defS=function(){return{p:0,w:0,s:0,m:0,d:{1:0,2:0,3:0,4:0,5:0,6:0},l:null,b1p:0,b1w:0,b2p:0,b2w:0,ps:0,pm:0,b1l:null,b2l:null};};
// merges onto defaults so a partial stored object cannot make recRes/showStats throw
var loadS=function(){var base=defS();try{var s=JSON.parse(localStorage.getItem(STK));if(s){for(var k in s)base[k]=s[k];if(!base.d)base.d={1:0,2:0,3:0,4:0,5:0,6:0};}}catch(e){}return base;};
var saveS=function(s){localStorage.setItem(STK,JSON.stringify(s));};
var _isYesterday=function(dateStr){if(!dateStr)return false;var p=dateStr.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')===_ds;};
var recRes=function(w,n){var s=loadS();if(s.l===_ds)return;s.p++;if(w){s.w++;s.s++;s.m=Math.max(s.m,s.s);s.d[n]=(s.d[n]||0)+1;}else s.s=0;if(_isYesterday(s.l)){s.ps=(s.ps||0)+1;}else{s.ps=1;}s.pm=Math.max(s.pm||0,s.ps);s.l=_ds;saveS(s);};
// per-puzzle dedup (b1l/b2l) so a lost wi_state cannot double-count a bonus round
var recB1=function(w){var s=loadS();if(s.b1l===_pn)return;s.b1l=_pn;s.b1p=(s.b1p||0)+1;if(w)s.b1w=(s.b1w||0)+1;saveS(s);};
var recB2=function(w){var s=loadS();if(s.b2l===_pn)return;s.b2l=_pn;s.b2p=(s.b2p||0)+1;if(w)s.b2w=(s.b2w||0)+1;saveS(s);};

// ====== DOM INIT ======
// Puzzle name/desc populated by server fetch callback; show placeholder until then
setInvName(_e.name||'Loading…');
document.getElementById('inv-desc').textContent=_e.description||'';
document.getElementById('puzzle-num').textContent=(window.I18N?I18N.t('game.inventionNum',{num:_pn}):'Invention #'+_pn);

// ====== PROGRESS DOTS (daily-only) ======
function renderProgressDots(animate){
  var el=document.getElementById('progress-dots');if(!el)return;
  if(!el.children.length){
    for(var i=0;i<MAX;i++){
      var dot=document.createElement('div');
      dot.className='progress-dot';
      el.appendChild(dot);
    }
  }
  for(var i=0;i<MAX;i++){
    var dot=el.children[i];if(!dot)continue;
    if(i<gHistory.length){
      var cls='dot-used';
      if(!dot.classList.contains(cls)){
        if(animate){
          if(prefGlow()) dot.classList.add('dot-lighting');
          setTimeout((function(d,c){return function(){d.classList.add(c);setTimeout(function(){d.classList.remove('dot-lighting');},550);};})(dot,cls),50);
        }else{
          dot.classList.add(cls);
        }
      }
    }else{
      dot.className='progress-dot';
    }
  }
}

renderRound();renderProgressDots();
buildNumpad();
wireSettings();

// ====== SUBMIT (daily version — server-verified guesses) ======
function submit(){
  if(over||spinning){return;}
  if(!_serverReady){toast(_serverError?_t('game.serverUnavailable','Server unavailable — try refreshing'):_t('game.loadingPuzzle','Loading puzzle…'));return;}
  if(cur.length<3){toast(_t('game.enterDigits','Enter at least 3 digits'));return;}
  var _padCount=4-cur.length;
  while(cur.length<4)cur.unshift(0);
  var gn=cur[0]*1000+cur[1]*100+cur[2]*10+cur[3],gy=isBC?-gn:gn;
  if(gn===0){toast(_t('game.yearZero','Year 0 does not exist!'));return;}
  if(gy>2026){toast(_t('game.afterMax','Cannot be after 2026'));return;}
  if(gy<-9999){toast(_t('game.beforeMin','Cannot be before 9999 BC'));return;}

  var guessStr=String(gn).padStart(4,'0')+(isBC?'BC':'AD');
  for(var i=0;i<gHistory.length;i++){
    var prevStr=String(gHistory[i][0]*1000+gHistory[i][1]*100+gHistory[i][2]*10+gHistory[i][3]).padStart(4,'0')+(eras[i]?'BC':'AD');
    if(guessStr===prevStr){toast(_t('game.alreadyGuessed','Already guessed that year'));return;}
  }

  _trackGuess();
  spinning=true;
  var guessCur=cur.slice();
  var guessEra=isBC;
  var isLastGuess=gHistory.length+1>=MAX;

  // Send guess to server for verification
  var apiUrl=(typeof INVENTLE_API!=='undefined'?INVENTLE_API:'')+'/api/guess';
  fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({puzzleNum:_pn,guess:gy,gameOver:isLastGuess})}).then(function(r){return r.json();}).then(function(data){
    if(data.error){spinning=false;toast(data.error);return;}

    gHistory.push(guessCur);eras.push(guessEra);renderRound();
    var r=gHistory.length-1;
    var cols=data.colors;
    var eraOk=data.eraCorrect;
    _guessColors.push(cols);
    _guessEraOk.push(eraOk);

    // If server revealed the year (correct or game over), store it
    if(data.year!=null){
      _ty=data.year;_tb=_ty<0;_ta=Math.abs(_ty);
      _td=String(_ta).padStart(4,'0').split('').map(Number);
    }

    var skipSpin=[false,false,false,false],skipEra=false;
    if(r>0){
      var prevCols=_guessColors[r-1];
      var prevEraOk=_guessEraOk[r-1];
      for(var i=0;i<4;i++){if(prevCols[i]==='green'&&cols[i]==='green')skipSpin[i]=true;}
      if(prevEraOk&&eraOk)skipEra=true;
    }

    var isWin=data.correct;
    if(isWin){skipSpin=[false,false,false,false];skipEra=false;}

    var doSpin=prefSpin();
    addGuessRow(r,guessCur,guessEra,cols,eraOk,doSpin,skipSpin,skipEra,isWin&&doSpin,_padCount);

    var spinDur;
    if(!doSpin){
      spinDur=200;
    }else if(isWin){
      spinDur=400+5*350+350+1000;
    }else{
      var _ac=(skipEra?0:1);for(var i=0;i<4;i++){if(!skipSpin[i])_ac++;}
      spinDur=_ac===0?200:400+(_ac-1)*350+350;
    }
    spinDur+=200;

    setTimeout(function(){
      spinning=false;renderProgressDots(true);
      if(isWin){
        over=true;won=true;
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
        toast(_t('game.win'+(r+1),['Bruh','Magnificent!','Impressive!','Great!','Nice!','Phew!'][r]));
        recRes(true,r+1);
        _trackEnd();
        saveSt();
        setTimeout(function(){showPostGame(true);},1000);
      }else if(gHistory.length>=MAX){
        over=true;
        inputRow.classList.add('hidden');
        document.getElementById('numpad-wrap').style.display='none';
        var _doSpinAnswer=prefSpin();
        addGuessRow(gHistory.length,_td,_tb,['green','green','green','green'],true,_doSpinAnswer,null,false,false,0);
        recRes(false,0);
        _trackEnd();
        saveSt();
        var _answerSpinDur=_doSpinAnswer?(400+4*350+350+200):200;
        setTimeout(function(){showPostGame(true);},_answerSpinDur+1000);
      }
    },spinDur);

    if(isWin||gHistory.length>=MAX){inputRow.classList.add('hidden');document.getElementById('numpad-wrap').style.display='none';}
    saveSt();
  }).catch(function(err){
    spinning=false;
    toast(_t('game.serverError','Server error — try again'));
  });

  cur=[];renderInput();
}

// Translation helper with an English fallback, so the game works even if a key is missing.
function _t(key,fallback){try{if(typeof t==='function'){var v=t(key);if(v&&v!==key)return v;}}catch(e){}return fallback;}

// ====== AUTOCOMPLETE COMPONENT ======
function createAutocomplete(list, placeholder, onSelect){
  var wrap=document.createElement('div');
  wrap.className='ac-wrap';
  var inp=document.createElement('input');
  inp.className='ac-input';
  inp.type='text';
  inp.placeholder=placeholder;
  inp.autocomplete='off';
  inp.setAttribute('autocorrect','off');
  inp.setAttribute('autocapitalize','off');
  inp.setAttribute('spellcheck','false');
  var dropdown=document.createElement('div');
  dropdown.className='ac-list';
  wrap.appendChild(inp);
  wrap.appendChild(dropdown);

  var selectedName='';
  var activeIdx=-1;
  var matches=[];

  function filter(q){
    var ql=q.toLowerCase();
    if(!ql)return[];
    var nameStarts=[];
    var aliasStarts=[];
    var contains=[];
    for(var i=0;i<list.length;i++){
      var entry=list[i];
      var nl=entry.name.toLowerCase();
      if(nl.indexOf(ql)===0){nameStarts.push(entry);continue;}
      var words=nl.split(/\s+/);
      var wordStart=false;
      for(var w=0;w<words.length;w++){if(words[w].indexOf(ql)===0){wordStart=true;break;}}
      if(wordStart){nameStarts.push(entry);continue;}
      var aStart=false,aCont=false;
      for(var j=0;j<entry.a.length;j++){
        var al=entry.a[j].toLowerCase();
        if(al.indexOf(ql)===0){aStart=true;break;}
        var aw=al.split(/\s+/);
        for(var w=0;w<aw.length;w++){if(aw[w].indexOf(ql)===0){aStart=true;break;}}
        if(aStart)break;
        if(al.indexOf(ql)!==-1){aCont=true;}
      }
      if(aStart)aliasStarts.push(entry);
      else if(aCont)contains.push(entry);
    }
    nameStarts.sort(function(a,b){return a.name.localeCompare(b.name);});
    aliasStarts.sort(function(a,b){return a.name.localeCompare(b.name);});
    contains.sort(function(a,b){return a.name.localeCompare(b.name);});
    return nameStarts.concat(aliasStarts).concat(contains).slice(0,8);
  }

  function renderDropdown(){
    dropdown.innerHTML='';
    if(matches.length===0){dropdown.classList.remove('show');return;}
    dropdown.classList.add('show');
    for(var i=0;i<matches.length;i++){
      var item=document.createElement('div');
      item.className='ac-item'+(i===activeIdx?' active':'');
      item.textContent=matches[i].name;
      (function(idx){
        item.onmousedown=function(e){e.preventDefault();};
        item.onclick=function(){
          selectItem(idx);
        };
      })(i);
      dropdown.appendChild(item);
    }
  }

  function selectItem(idx){
    selectedName=matches[idx].name;
    inp.value=selectedName;
    dropdown.classList.remove('show');
    activeIdx=-1;
    matches=[];
    if(onSelect)onSelect(selectedName);
  }

  function checkExactMatch(){
    var v=inp.value.trim().toLowerCase();
    selectedName='';
    for(var i=0;i<list.length;i++){
      for(var j=0;j<list[i].a.length;j++){
        if(list[i].a[j].toLowerCase()===v){selectedName=list[i].name;return;}
      }
    }
  }

  inp.addEventListener('input',function(){
    activeIdx=-1;
    var q=inp.value.trim();
    matches=filter(q);
    renderDropdown();
    checkExactMatch();
    if(onSelect)onSelect(selectedName);
  });

  inp.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){
      e.preventDefault();
      if(matches.length>0){activeIdx=Math.min(activeIdx+1,matches.length-1);renderDropdown();}
    }else if(e.key==='ArrowUp'){
      e.preventDefault();
      if(matches.length>0){activeIdx=Math.max(activeIdx-1,0);renderDropdown();}
    }else if(e.key==='Enter'){
      e.preventDefault();
      if(activeIdx>=0&&activeIdx<matches.length){
        selectItem(activeIdx);
      }
    }else if(e.key==='Escape'){
      dropdown.classList.remove('show');
      activeIdx=-1;
    }
  });

  inp.addEventListener('blur',function(){
    setTimeout(function(){dropdown.classList.remove('show');},200);
  });

  inp.addEventListener('focus',function(){
    if(matches.length>0)dropdown.classList.add('show');
  });

  return{wrap:wrap,inp:inp,getSelected:function(){return selectedName;},setSelected:function(n){selectedName=n;},clear:function(){inp.value='';selectedName='';dropdown.classList.remove('show');matches=[];}};
}

// ====== POST-GAME UI ======
function restoreButtons(){
  if(!over)return;
  if((phase==='bonus1'&&!b1over)||(phase==='bonus2'&&!b2over))return;
  bonusArea.innerHTML='';

  if(b1over||b2over){
    var brLabel=document.createElement('div');
    brLabel.style.cssText='font-size:0.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:3px;font-weight:900;text-align:center;margin:22px 0 8px;';
    brLabel.textContent='Bonus Rounds';
    bonusArea.appendChild(brLabel);
  }

  // Recap cards are built by _recapStage / _unknownRecapStage so a rebuilt round expands
  // with the same cascade as everywhere else. i18n-patch.js overrides this whole function,
  // so the call shape must stay identical there.
  var _hasRecap=typeof _recapStage==='function';
  if(b1over){
    document.getElementById('col-labels').style.display='none';
    if(_hasRecap) _recapStage('b1');
  }

  if(b2over){
    if(_e.inventor.toLowerCase()==='unknown') _unknownRecapStage();
    else if(_hasRecap) _recapStage('b2');
  }

  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;';
  if(won&&!b1over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var bonusBtn=document.createElement('button');bonusBtn.className='continue-btn';
    bonusBtn.textContent='Bonus \u2192';bonusBtn.style.marginTop='0';
    bonusBtn.onclick=function(){startBonus1();};
    topRow.appendChild(bonusBtn);
    topRow.appendChild(_mkKeepBtn());
    wrap.appendChild(topRow);
  }else if(b1over&&!b2over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var b2Btn=document.createElement('button');b2Btn.className='continue-btn';
    b2Btn.textContent='Bonus 2 \u2192';b2Btn.style.marginTop='0';
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
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent='Done';
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  btnRow.appendChild(doneBtn);
  wrap.appendChild(btnRow);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
}

// Append post-BR1 buttons with smooth slide-in (used after cascade fold completes)
function _appendPostB1Buttons(){
  // Remove any existing post-bonus button wrapper first (no stale)
  var existing=bonusArea.querySelector('.bonus-btnwrap');
  if(existing) existing.remove();
  var wrap=document.createElement('div');
  wrap.className='bonus-btnwrap';
  wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
  if(b1over&&!b2over){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var b2Btn=document.createElement('button');b2Btn.className='continue-btn';
    b2Btn.textContent='Bonus 2 \u2192';b2Btn.style.marginTop='0';
    b2Btn.onclick=function(){startBonus2();};
    topRow.appendChild(b2Btn);
    topRow.appendChild(_mkKeepBtn());
    wrap.appendChild(topRow);
  }
  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent='Done';
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  btnRow.appendChild(doneBtn);
  wrap.appendChild(btnRow);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
  scrollToBottom();
}

// Append post-BR2 buttons with smooth slide-in
function _appendPostB2Buttons(){
  var existing=bonusArea.querySelector('.bonus-btnwrap');
  if(existing) existing.remove();
  var wrap=document.createElement('div');
  wrap.className='bonus-btnwrap';
  wrap.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:nowrap;';
  wrap.appendChild(_mkKeepBtn());
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent='Done';
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=function(){bonusArea.innerHTML='';showStats();};
  wrap.appendChild(doneBtn);
  bonusArea.appendChild(wrap);
  revealBtnWrap(wrap);
  scrollToBottom();
}

function _showPostGameButtons(){
  bonusArea.innerHTML='';
  var _doneAct=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
  var container=document.createElement('div');
  container.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';
  if(won){
    var topRow=document.createElement('div');
    topRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    var bonusBtn=document.createElement('button');bonusBtn.className='continue-btn';
    bonusBtn.textContent='Bonus \u2192';bonusBtn.style.marginTop='0';
    bonusBtn.onclick=function(){startBonus1();};
    topRow.appendChild(bonusBtn);
    var keepBtn1=document.createElement('a');keepBtn1.className='continue-btn';keepBtn1.textContent='Keep Playing';
    keepBtn1.href='infinite.html';keepBtn1.style.cssText='margin-top:0;text-decoration:none;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
    topRow.appendChild(keepBtn1);
    container.appendChild(topRow);
  }
  var btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
  if(!won){
    btnRow.appendChild(_mkKeepBtn());
  }
  var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent='Done';
  doneBtn.style.cssText='margin-top:0;background:var(--surface);color:var(--text2);border:2px solid var(--border);';
  doneBtn.onclick=_doneAct;
  btnRow.appendChild(doneBtn);
  container.appendChild(btnRow);
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
      if(!b1over) btns.push({text:'Bonus \u2192',onclick:function(){startBonus1();}});
      btns.push({text:'Keep Playing',secondary:true,onclick:function(){window.location.href='infinite.html';}});
      btns.push({text:'Done',onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}});
      showAdModal(btns);
    }else{
      _showPostGameButtons();
    }
  }else{
    if(withAd){
      showAdModal([{text:'Keep Playing',secondary:true,onclick:function(){window.location.href='infinite.html';}},{text:'Done',onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}}]);
    }else{
      _showPostGameButtons();
    }
  }
}

// ====== BONUS ROUND 1: Country ======
function startBonus1(){
  phase='bonus1';
  saveSt();
  document.getElementById('col-labels').style.display='none';
  collapseToLastRow();
  renderBonus1();
}

function renderBonus1(){
  bonusArea.innerHTML='';

  // Stage wrapper for cascade fold
  var stage=document.createElement('div');
  stage.className='bonus-stage';

  // Header tab (starts neutral — cascade fold colors it on completion)
  var collapseH=document.createElement('div');
  collapseH.className='bonus-collapse br1-header';
  var collapseInner=document.createElement('div');
  collapseInner.className='bonus-collapse-header';
  collapseInner.innerHTML='<span>Bonus Round 1 \u2014 Country</span><span>0/2 <span class="bc-arrow">\u25BC</span></span>';
  collapseH.appendChild(collapseInner);
  // Active-round toggle; cascadeFold installs the completed-round toggle over this
  // once the round is answered.
  collapseH.style.cursor='pointer';
  collapseH.onclick=function(){
    if(b1over)return;
    activeCascadeToggle(collapseH,drawer);
  };
  stage.appendChild(collapseH);

  // Drawer (contains prompt, options, buttons)
  var drawer=document.createElement('div');
  drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:8px;';

  var prompt=document.createElement('div');
  prompt.className='bonus-prompt';
  prompt.textContent='BONUS: What country was this invented in?';
  drawer.appendChild(prompt);

  var choices=generateB1Choices(_pn*31+7);
  var optDiv=document.createElement('div');
  optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');
    btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    if(b1guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var wasGuessed=b1guesses.indexOf(choice)!==-1;
      var isCorrect=checkCountry(choice);
      if(wasGuessed&&isCorrect){
        theBtn.classList.add('mc-correct');
        theBtn.classList.add('gold-border');
        theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);
      }else if(wasGuessed){
        theBtn.classList.add('mc-wrong');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(choice);
      }else if(b1over&&isCorrect){
        theBtn.classList.add('mc-correct');theBtn.style.animation='none';
        theBtn.innerHTML='<span class="mc-icon">\u2705</span>'+escHtml(choice);
      }else if(b1over){
        theBtn.classList.add('mc-disabled');theBtn.style.animation='none';
        theBtn.textContent=choice;
      }else{
        if(b1guesses.length>0)theBtn.style.animation='none';
        theBtn.textContent=choice;
        theBtn.onclick=function(){handleB1Pick(choice);};
      }
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b1over){
    var info=document.createElement('div');
    info.className='mc-attempt-info';
    info.textContent=b1guesses.length===0?'Attempt 1 of 2':'Final attempt';
    drawer.appendChild(info);

    var b1BtnRow=document.createElement('div');
    b1BtnRow.setAttribute('data-btn-row','1');
    b1BtnRow.style.display='flex';b1BtnRow.style.gap='8px';b1BtnRow.style.justifyContent='center';b1BtnRow.style.marginTop='8px';

    var doneBtn1=document.createElement('button');
    doneBtn1.className='continue-btn';
    doneBtn1.textContent='Done';
    doneBtn1.style.background='var(--surface)';doneBtn1.style.color='var(--text2)';doneBtn1.style.border='2px solid var(--border)';doneBtn1.style.marginTop='0';
    doneBtn1.onclick=function(){
      b1over=true;b1won=false;
      _trackB1('skip');
      phase='done';saveSt();
      _submitStats();
      bonusArea.innerHTML='';showStats();
    };
    b1BtnRow.appendChild(doneBtn1);

    var skipBtn=document.createElement('button');
    skipBtn.className='continue-btn';
    skipBtn.textContent='Skip to Bonus 2 \u2192';
    skipBtn.style.background='var(--surface)';skipBtn.style.color='var(--text2)';skipBtn.style.border='2px solid var(--border)';skipBtn.style.marginTop='0';
    skipBtn.onclick=function(){
      b1over=true;b1won=false;
      _trackB1('skip');
      saveSt();
      showAdModal([
        {text:'Done',secondary:true,onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}},
        {text:'Bonus 2 \u2192',onclick:function(){startBonus2();}}
      ]);
    };
    b1BtnRow.appendChild(skipBtn);
  }else{
    var btnWrap=document.createElement('div');
    btnWrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;';

    if(!b2over){
      var btn2=document.createElement('button');
      btn2.className='continue-btn';
      btn2.textContent='Bonus 2 \u2192';
      btn2.style.marginTop='0';
      btn2.onclick=function(){showAdModal([
        {text:'Bonus 2 \u2192',onclick:function(){startBonus2();}},
        {text:'Keep Playing',secondary:true,onclick:function(){window.location.href='infinite.html';}},
        {text:'Done',onclick:function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();}}
      ]);};
      btnWrap.appendChild(btn2);
    }
    var bottomRow=document.createElement('div');
    bottomRow.style.cssText='display:flex;gap:8px;justify-content:center;';
    bottomRow.appendChild(_mkKeepBtn());
    var doneBtn=document.createElement('button');
    doneBtn.className='continue-btn';
    doneBtn.textContent='Done';
    doneBtn.style.marginTop='0';
    doneBtn.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    bottomRow.appendChild(doneBtn);
    btnWrap.appendChild(bottomRow);
    drawer.appendChild(btnWrap);
    revealBtnWrap(btnWrap);
  }

  stage.appendChild(drawer);
  // Button row in the stage below the drawer, so it stays available while the active
  // question is folded (activeCascadeToggle collapses only the drawer).
  if(typeof b1BtnRow!=='undefined'&&b1BtnRow) stage.appendChild(b1BtnRow);
  bonusArea.appendChild(stage);
  // fresh round: the whole card enters with the shared fade+settle
  if(!b1over) revealBtnWrap(stage);
  // Fresh open — animate drawer drop-down same as expand-from-collapsed
  if(!b1over){ animateDrawerOpen(drawer); }
  scrollToBottom();
}

// ====== BONUS ROUND 2: Inventor ======
function startBonus2(){
  phase='bonus2';
  saveSt();
  renderBonus2();
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
  toFade.forEach(function(el){
    el.style.transition='opacity 0.2s ease, transform 0.2s ease';
    el.style.opacity='0';
    el.style.transform='translateY(-6px)';
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 220);
  });
  var isUnknown=_e.inventor.toLowerCase()==='unknown';

  if(isUnknown&&!b2over){
    b2over=true;b2won=true;
    _trackB2('win-free');saveSt();
  }

  // Unknown inventor — no cascade needed, just show free point
  if(isUnknown){
    var sec=document.createElement('div');
    sec.className='bonus-section';
    var title=document.createElement('div');
    title.className='bonus-title';
    title.textContent='Bonus Round 2';
    sec.appendChild(title);
    var prompt=document.createElement('div');
    prompt.className='bonus-prompt';
    prompt.textContent='BONUS: Who invented this?';
    sec.appendChild(prompt);
    var res=document.createElement('div');
    res.className='bonus-result';
    res.innerHTML='\u2705 Nobody actually knows who invented this! Free point. \ud83e\udd37';
    sec.appendChild(res);
    var unkRow=document.createElement('div');
    unkRow.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    unkRow.appendChild(_mkKeepBtn());
    var btn2=document.createElement('button');btn2.className='continue-btn';btn2.textContent='Done';
    btn2.style.marginTop='0';btn2.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    unkRow.appendChild(btn2);
    sec.appendChild(unkRow);
    bonusArea.appendChild(sec);
    revealBtnWrap(unkRow);
    scrollToBottom();
    return;
  }

  // Stage wrapper for cascade fold
  var stage=document.createElement('div');
  stage.className='bonus-stage';

  var collapseH=document.createElement('div');
  collapseH.className='bonus-collapse br1-header';
  var collapseInner=document.createElement('div');
  collapseInner.className='bonus-collapse-header';
  collapseInner.innerHTML='<span>Bonus Round 2 \u2014 Inventor</span><span>0/2 <span class="bc-arrow">\u25BC</span></span>';
  collapseH.appendChild(collapseInner);
  // Active-round toggle (see renderBonus1) \u2014 cascadeFold takes over once answered.
  collapseH.style.cursor='pointer';
  collapseH.onclick=function(){
    if(b2over)return;
    activeCascadeToggle(collapseH,drawer);
  };
  stage.appendChild(collapseH);

  var drawer=document.createElement('div');
  drawer.className='br1-drawer';
  drawer.style.cssText='padding-top:8px;';

  var prompt=document.createElement('div');
  prompt.className='bonus-prompt';
  prompt.textContent='BONUS: Who invented this?';
  drawer.appendChild(prompt);

  var choices=generateB2Choices(_pn*31+13);
  var optDiv=document.createElement('div');
  optDiv.className='mc-options';
  for(var i=0;i<choices.length;i++){
    var btn=document.createElement('button');
    btn.className='mc-option';
    btn.setAttribute('data-choice',choices[i]);
    btn.setAttribute('data-idx',i);
    if(b2guesses.length===0){btn.style.animationDelay=(i*0.06)+'s';}
    else{btn.style.opacity='1';btn.style.transform='none';}
    (function(choice,theBtn){
      var wasGuessed=b2guesses.indexOf(choice)!==-1;
      var isCorrect=checkInventor(choice);
      if(wasGuessed&&isCorrect){
        theBtn.classList.add('mc-correct');
        theBtn.classList.add('gold-border');
        theBtn.style.animation='none';
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
        if(b2guesses.length>0)theBtn.style.animation='none';
        theBtn.textContent=choice;
        theBtn.onclick=function(){handleB2Pick(choice);};
      }
    })(choices[i],btn);
    optDiv.appendChild(btn);
  }
  drawer.appendChild(optDiv);

  if(!b2over){
    var info=document.createElement('div');
    info.className='mc-attempt-info';
    info.textContent=b2guesses.length===0?'Attempt 1 of 2':'Final attempt';
    drawer.appendChild(info);

    var b2BtnRow=document.createElement('div');
    b2BtnRow.setAttribute('data-btn-row','1');
    b2BtnRow.style.display='flex';b2BtnRow.style.gap='8px';b2BtnRow.style.justifyContent='center';b2BtnRow.style.marginTop='8px';

    var doneBtn2=document.createElement('button');
    doneBtn2.className='continue-btn';
    doneBtn2.textContent='Done';
    doneBtn2.style.background='var(--surface)';doneBtn2.style.color='var(--text2)';doneBtn2.style.border='2px solid var(--border)';doneBtn2.style.marginTop='0';
    doneBtn2.onclick=function(){
      b2over=true;b2won=false;
      _trackB2('skip');
      phase='done';saveSt();
      _submitStats();
      bonusArea.innerHTML='';showStats();
    };
    b2BtnRow.appendChild(doneBtn2);

    var skipBtn2=document.createElement('button');
    skipBtn2.className='continue-btn';
    skipBtn2.textContent='Skip';
    skipBtn2.style.background='var(--surface)';skipBtn2.style.color='var(--text2)';skipBtn2.style.border='2px solid var(--border)';skipBtn2.style.marginTop='0';
    skipBtn2.onclick=function(){
      b2over=true;b2won=false;
      _trackB2('skip');
      phase='done';saveSt();
      _submitStats();
      bonusArea.innerHTML='';showStats();
    };
    b2BtnRow.appendChild(skipBtn2);
  }else{
    var btnRow2=document.createElement('div');
    btnRow2.style.cssText='display:flex;gap:8px;justify-content:center;margin-top:8px;';
    btnRow2.appendChild(_mkKeepBtn());
    var doneBtn=document.createElement('button');doneBtn.className='continue-btn';doneBtn.textContent='Done';
    doneBtn.style.marginTop='0';doneBtn.onclick=function(){phase='done';saveSt();bonusArea.innerHTML='';showStats();};
    btnRow2.appendChild(doneBtn);
    drawer.appendChild(btnRow2);
    revealBtnWrap(btnRow2);
  }

  stage.appendChild(drawer);
  // Button row in the stage below the drawer — stays available while folded
  if(typeof b2BtnRow!=='undefined'&&b2BtnRow) stage.appendChild(b2BtnRow);
  bonusArea.appendChild(stage);
  if(!b2over) revealBtnWrap(stage);   // fresh round enters with the shared fade+settle
  // Fresh open — animate drawer drop-down same as expand-from-collapsed
  if(!b2over){ animateDrawerOpen(drawer); }
  scrollToBottom();
}

// ====== MC CLICK HANDLERS ======
function handleB1Pick(choice){
  if(b1over)return;
  b1guesses.push(choice);
  var isCorrect=checkCountry(choice);
  if(isCorrect){b1over=true;b1won=true;recB1(true);_trackB1('win-'+b1guesses.length);}
  else if(b1guesses.length>=2){b1over=true;b1won=false;recB1(false);_trackB1('loss');}
  saveSt();

  if(b1over){
    // Round over — find tile indices and trigger cascade fold
    var btns=bonusArea.querySelectorAll('.mc-option');
    var clickedIdx=-1,correctIdx=-1;
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice) clickedIdx=i;
      if(checkCountry(btns[i].getAttribute('data-choice'))) correctIdx=i;
    }
    var stage=bonusArea.querySelector('.bonus-stage');
    cascadeFold(stage,{
      targetIdx:clickedIdx,
      tileClass:isCorrect?'mc-correct':'mc-loss',
      headerClass:isCorrect?'won':'lost',
      headerText:isCorrect
        ?'<span>Bonus Round 1 \u2014 Country</span><span>'+b1guesses.length+'/2 \u2705 <span class="bc-arrow">\u25BC</span></span>'
        :'<span>Bonus Round 1 \u2014 Country</span><span>'+b1guesses.length+'/2 \u274C <span class="bc-arrow">\u25BC</span></span>',
      borderColor:isCorrect?'#fbbf24':'#b92d2d',
      goldBorder:isCorrect,
      revealIdx:isCorrect?null:correctIdx,
      onDone:function(){
        if(b1over&&b2over)phase='done';
        saveSt();
        _appendPostB1Buttons();
      }
    });
  }else{
    // First wrong attempt — just mark the tile, no cascade
    var btns=bonusArea.querySelectorAll('.mc-option');
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice){
        btns[i].classList.add('mc-wrong');
        btns[i].innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(choice);
        btns[i].onclick=null;btns[i].style.pointerEvents='none';
        btns[i].style.animation='none';
        btns[i].style.opacity='1';
      }
    }
    var info=bonusArea.querySelector('.mc-attempt-info');
    if(info) info.textContent='Final attempt';
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
    var stages=bonusArea.querySelectorAll('.bonus-stage');
    var stage=stages[stages.length-1];
    var btns=stage.querySelectorAll('.mc-option');
    var clickedIdx=-1,correctIdx=-1;
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice) clickedIdx=i;
      if(checkInventor(btns[i].getAttribute('data-choice'))) correctIdx=i;
    }
    cascadeFold(stage,{
      targetIdx:clickedIdx,
      tileClass:isCorrect?'mc-correct':'mc-loss',
      headerClass:isCorrect?'won':'lost',
      headerText:isCorrect
        ?'<span>Bonus Round 2 \u2014 Inventor</span><span>'+b2guesses.length+'/2 \u2705 <span class="bc-arrow">\u25BC</span></span>'
        :'<span>Bonus Round 2 \u2014 Inventor</span><span>'+b2guesses.length+'/2 \u274C <span class="bc-arrow">\u25BC</span></span>',
      borderColor:isCorrect?'#fbbf24':'#b92d2d',
      goldBorder:isCorrect,
      revealIdx:isCorrect?null:correctIdx,
      onDone:function(){
        phase='done';
        saveSt();
        _appendPostB2Buttons();
      }
    });
  }else{
    var stages2=bonusArea.querySelectorAll('.bonus-stage');
    var stageEl=stages2[stages2.length-1];
    var btns=stageEl.querySelectorAll('.mc-option');
    for(var i=0;i<btns.length;i++){
      if(btns[i].getAttribute('data-choice')===choice){
        btns[i].classList.add('mc-wrong');
        btns[i].innerHTML='<span class="mc-icon">\u274C</span>'+escHtml(choice);
        btns[i].onclick=null;btns[i].style.pointerEvents='none';
        btns[i].style.animation='none';
        btns[i].style.opacity='1';
      }
    }
    var info=stageEl.querySelector('.mc-attempt-info');
    if(info) info.textContent='Final attempt';
  }
}

// ====== STATS ======
function showStats(){
  // Display only — telemetry is submitted automatically at game-over (see _trackEnd).
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
    var html='<div class="bonus-stats-section"><h2>Bonus Stats</h2><div class="stats-grid">';
    html+='<div class="st"><div class="st-n">'+(s.b1p||0)+'</div><div class="st-l">Country Played</div></div>';
    html+='<div class="st"><div class="st-n">'+((s.b1p||0)>0?Math.round((s.b1w||0)/(s.b1p||1)*100):0)+'</div><div class="st-l">Country Win%</div></div>';
    html+='<div class="st"><div class="st-n">'+(s.b2p||0)+'</div><div class="st-l">Inventor Played</div></div>';
    html+='<div class="st"><div class="st-n">'+((s.b2p||0)>0?Math.round((s.b2w||0)/(s.b2p||1)*100):0)+'</div><div class="st-l">Inventor Win%</div></div>';
    html+='</div></div>';
    bsEl.innerHTML=html;
  }

  var rEl=document.getElementById('result-card');
  if(over){
    var ys=_tb?_ta+' BC':_ta+' AD',hn=_e.country.historical!==_e.country.modern?'<br>'+escHtml(_e.country.historical)+' (modern-day '+escHtml(_e.country.modern)+')':'<br>'+escHtml(_e.country.modern);
    var srcHtml=typeof getSourceHtml==='function'?getSourceHtml():'';
    var originHtml=typeof getOriginHtml==='function'?getOriginHtml():'';
    rEl.innerHTML='<div class="ans-yr">'+ys+'</div><div class="ans-info"><strong>'+escHtml(_e.name)+'</strong>'+hn+'<br>Invented by '+escHtml(_e.inventor)+'<br>'+escHtml(_e.category)+srcHtml+originHtml+'</div>';
    document.getElementById('share-btn').style.display='inline-flex';
    document.getElementById('keep-btn').style.display='inline-flex';countdown();
  }else{rEl.innerHTML='';document.getElementById('share-btn').style.display='none';document.getElementById('keep-btn').style.display='none';}
  document.getElementById('m-stats').classList.add('show');
}

function countdown(){
  var n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1),d=t-n;
  document.getElementById('countdown').textContent='Next in '+String(Math.floor(d/36e5)).padStart(2,'0')+':'+String(Math.floor((d%36e5)/6e4)).padStart(2,'0')+':'+String(Math.floor((d%6e4)/1e3)).padStart(2,'0');
  if(over)setTimeout(countdown,1000);
}

// ====== SHARE ======
document.getElementById('share-btn').onclick=function(){
  _trackShare();
  var title='Inventle #'+_pn+' '+(won?gHistory.length:'X')+'/6';
  var lines=[title+'\n'];
  for(var r=0;r<gHistory.length;r++){
    var c=_guessColors[r]||['grey','grey','grey','grey'];
    var eOk=_guessEraOk[r]||false;
    var row=eOk?'\ud83d\udfe6':'\ud83d\udfe5';
    row+=c.map(function(x){return shareSquare(x);}).join('');
    lines.push(row);
  }
  if(b1over||b2over){
    lines.push('');
    if(b1over){
      var b1emoji=b1won?'\ud83c\udf0d\u2705 '+b1guesses.length+'/2':'\ud83c\udf0d\u274c';
      lines.push('Country: '+b1emoji);
    }
    if(b2over){
      var b2emoji=b2won?'\ud83d\udca1\u2705 '+b2guesses.length+'/2':'\ud83d\udca1\u274c';
      lines.push('Inventor: '+b2emoji);
    }
  }
  lines.push('\nPlay: https://inventle.io');
  var btn=this;
  btn.style.animation='none';void btn.offsetWidth;btn.style.animation='goldBrightFade 3s ease-in-out forwards';
  var shareText=lines.join('\n');
  function copyShare(){navigator.clipboard.writeText(shareText).then(function(){toast('Copied!');}).catch(function(){toast('Could not copy');});}
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

// ====== MODAL HANDLERS ======
document.getElementById('btn-stats').onclick=showStats;
document.getElementById('x-stats').onclick=function(){document.getElementById('m-stats').classList.remove('show');restoreButtons();};
document.getElementById('btn-help').onclick=function(){document.getElementById('m-help').classList.add('show');};
document.getElementById('x-help').onclick=function(){document.getElementById('m-help').classList.remove('show');};
document.getElementById('link-privacy').onclick=function(e){e.preventDefault();document.getElementById('m-settings').classList.remove('show');document.getElementById('m-privacy').classList.add('show');};
document.getElementById('x-privacy').onclick=function(){document.getElementById('m-privacy').classList.remove('show');};
document.getElementById('link-contact').onclick=function(e){e.preventDefault();document.getElementById('m-settings').classList.remove('show');document.getElementById('m-contact').classList.add('show');};
document.getElementById('x-contact').onclick=function(){document.getElementById('m-contact').classList.remove('show');};

document.querySelectorAll('.modal-bg').forEach(function(m){m.onclick=function(e){if(e.target===m){m.classList.remove('show');if(m.id==='m-stats')restoreButtons();}};});

// ====== RESTORE ======
function restore(){
  for(var r=0;r<gHistory.length;r++){
    var d=gHistory[r],eBC=eras[r];
    var cols=_guessColors[r]||['grey','grey','grey','grey'];
    var eOk=_guessEraOk[r]||false;
    addGuessRow(r,d,eBC,cols,eOk,false);
  }
  if(over){
    if(!won&&_td){addGuessRow(gHistory.length,_td,_tb,['green','green','green','green'],true,false,null,false,false,0);}
    inputRow.classList.add('hidden');
    document.getElementById('numpad-wrap').style.display='none';
    // Auto-promote phase if BOTH bonuses are done — reload should show collapsed post-game view
    if(b1over&&b2over&&phase!=='done'){
      phase='done';saveSt();
    }
    // Bonus recap needs the server puzzle data (_e.country/_e.inventor/_ix) from the async
    // /api/puzzle fetch; _e is not persisted, so wait for it before rendering or the recap
    // cards come out empty. Completion state is preferred over phase here.
    if(phase==='main'){
      _whenServerReady(function(){showPostGame();});
    }else if(phase==='bonus1'&&!b1over){
      // Still actively answering bonus 1
      document.getElementById('col-labels').style.display='none';
      collapseToLastRow({instant:true});   // reload = snapshot, not replay
      _whenServerReady(function(){renderBonus1();});
    }else if(phase==='bonus2'&&!b2over){
      // Still actively answering bonus 2
      document.getElementById('col-labels').style.display='none';
      collapseToLastRow({instant:true});   // reload = snapshot, not replay
      _whenServerReady(function(){renderBonus2();});
    }else{
      // Either: bonus1 done but bonus2 not started, OR phase==='done' — show collapsed cards
      document.getElementById('col-labels').style.display='none';
      collapseToLastRow({instant:true});   // reload = snapshot, not replay
      // wrapped in a closure so restoreButtons resolves at fire time, after i18n-patch loads
      _whenServerReady(function(){restoreButtons();});
    }
  }
  renderProgressDots();
  // redraws the counter: it was first drawn at startup, before loadSt() filled gHistory
  renderRound();
}

// Runs fn once the server puzzle data (_e) has loaded, so reload renders that read _e
// have real data. Waits ~300ms minimum and caps the wait so an error still renders.
function _whenServerReady(fn){
  var waited=0;
  (function poll(){
    if((_serverReady||_serverError)&&waited>=300){fn();return;}
    if(waited>=6000){fn();return;} // hard cap ~6s
    waited+=100;setTimeout(poll,100);
  })();
}

// ====== INIT ======
if(loadSt())restore();
else if(!localStorage.getItem('wi_seen_help')){localStorage.setItem('wi_seen_help','1');document.getElementById('m-help').classList.add('show');}