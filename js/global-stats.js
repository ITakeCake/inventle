// --- Global Stats Page ---
var INVENTLE_API='https://inventle-stats.blakexb.workers.dev';

// ========== RESTORE SAVED PREFS EARLY (before any fetch) ==========
var gpMainMode='G';
var gpMainRange='ALL';
(function(){
  try{
    var saved=JSON.parse(localStorage.getItem('wi_gp_prefs'));
    if(saved){
      if(saved.mode)gpMainMode=saved.mode;
      if(saved.range)gpMainRange=saved.range;
    }
  }catch(e){}
})();

// ========== CURRENT PUZZLE NUM (local timezone, matches what the player sees) ==========
// local-calendar day via Date.UTC (DST-safe), matching the number game.js submits under
var gpPuzzleNum=(function(){var d=new Date();return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2025,0,1))/864e5)+1;})();

// ========== LIVE DATA (populated from API) ==========
// Field names here are the contract gpNormalize() fills and every renderer reads.
// Anything drawn before the first fetch uses these zeroes.
var gpData={
  range:'ALL',country:null,players:0,totalGames:0,totalWins:0,
  worldmap:[],
  guessDist:{1:0,2:0,3:0,4:0,5:0,6:0},
  lossCount:0,
  dailyPlayers:[],dailyDates:[],dailyWinRates:[],
  hardest:[],
  streakBuckets:[],longestStreak:0,avgStreak:0,
  unfinished:{starts:0,finished:0,unfinished:0,rate:0,daily:[]},
  firstGuessBuckets:[],shareByGuessN:[0,0,0,0,0,0],solveTimeByCountry:[],
  bonusCounts:{b1p:0,b1w:0,b2p:0,b2w:0},liveNow:0,
  demoMobile:0,demoDesktop:0,demoDark:0,demoLight:0,
  inputNumpad:0,inputKeyboard:0,inputBoth:0,
  bonusCountryPlay:0,bonusCountryWin:0,bonusInventorPlay:0,bonusInventorWin:0,bonusSkip:0,
  firstGuessPopular:0,firstGuessAvg:0,firstGuessBCPct:0,
  schemeUsage:[0,0,0,0],
  schemeNames:['Green/Yellow','Blue/Orange','Teal/Yellow','Purple/Orange'],
  schemeColors:[
    {right:'#4eca85',near:'#e8c840'},{right:'#4a8cd8',near:'#f6551c'},
    {right:'#42b5c5',near:'#e8c840'},{right:'#8670d8',near:'#e07850'}
  ],
  dailyScheme:[],
  solveTimeByGuess:[0,0,0,0,0,0],dailySolveTime:[],
  solveTimeAvg:0,solveTimeFastest:0,solveTimeSlowest:0,solveTimeMedian:0,
  hourlyPlayers:new Array(24).fill(0),
  peakHour:0,peakCount:0,quietHour:0,quietCount:0,
  weekendAvgHour:0,weekdayAvgHour:0,
  shareRate:0,dailyShareRate:[],shareByGuess:[0,0,0,0,0,0],shareWinRate:0,shareLossRate:0,
  bcUsage:0,bcFirstGuess:0,bcAvgPerGame:0,
  bcByDifficulty:[0,0,0,0,0],dailyBCRate:[],bcWinDelta:0
};

// ========== FETCH FROM API ==========
function _gpFetch(path){return fetch(INVENTLE_API+path).then(function(r){return r.json();}).catch(function(){return null;});}

// Map the range selector to a day count for the trends line.
function gpRangeDays(r){return {'1D':1,'1W':7,'1M':30,'3M':90,'6M':180,'1Y':365,'ALL':365}[r]||7;}

// plain-English name for a range, used wherever a number needs its window stated
function gpRangeLabel(r){
  return {'1D':'today','1W':'last 7 days','1M':'last 30 days','3M':'last 90 days',
          '6M':'last 180 days','1Y':'last year','ALL':'all time'}[r]||String(r);
}

// One request set is one consistent snapshot for a given (range, country). The grid and
// each detail page call this independently, so their selectors are independent too.
function gpFetchSet(range,country){
  var c=country?('&country='+encodeURIComponent(country)):'';
  return Promise.all([
    _gpFetch('/api/stats/today?range='+range+c),
    _gpFetch('/api/stats/live'),                       // live is real-time, never range-scoped
    _gpFetch('/api/stats/countries?range='+range),     // the country list itself is never country-filtered
    _gpFetch('/api/stats/distribution?range='+range+c),
    _gpFetch('/api/stats/hardest?range='+range+c),
    _gpFetch('/api/stats/trends?range='+range+c),
    _gpFetch('/api/stats/breakdown?range='+range+c)
  ]);
}

// Turns the raw API responses into the one shape every renderer reads. Both the grid
// (gpData) and the detail pages (gpDetailData) are built by this.
function gpNormalize(res,range,country){
  var today=res[0]||{},live=res[1]||{},countries=res[2]||[],dist=res[3]||{},
      hardest=res[4]||[],trends=res[5]||[],bd=res[6]||{};
  var d={
    range:range,country:country||null,
    schemeNames:gpData.schemeNames,schemeColors:gpData.schemeColors
  };

  var p=today.players||0;
  d.players=p;

  // --- device / theme split ---
  var m=today.mobile||0,dk=today.desktop||0,mt=(m+dk)||1;
  d.demoMobile=p?Math.round(m/mt*100):0;
  d.demoDesktop=p?Math.round(dk/mt*100):0;
  d.demoDark=p?Math.round((today.dark||0)/p*100):0;
  d.demoLight=p?Math.round((today.light||0)/p*100):0;

  // --- solve time ---
  d.solveTimeAvg=today.avgTime||0;
  d.solveTimeMedian=today.solveTimeMedian||0;
  d.solveTimeFastest=today.solveTimeFastest||0;
  d.solveTimeSlowest=today.solveTimeSlowest||0;
  d.solveTimeByGuess=today.solveTimeByGuess||[0,0,0,0,0,0];

  // --- first guess ---
  d.firstGuessAvg=today.avgFirstGuess||0;
  d.firstGuessPopular=today.firstGuessPopular||0;
  d.firstGuessBCPct=today.firstGuessBCPct||0;

  // --- share ---
  d.shareRate=p?Math.round((today.shared||0)/p*100):0;
  var wins=today.wins||0,losses=Math.max(0,p-wins);
  d.shareWinRate=wins>0?Math.round((today.sharedWin||0)/wins*100):0;
  d.shareLossRate=losses>0?Math.round((today.sharedLoss||0)/losses*100):0;

  // --- BC ---
  d.bcUsage=p?Math.round((today.bcUsed||0)/p*100):0;
  d.bcWinDelta=today.bcWinDelta||0;
  d.bcFirstGuess=bd.bcFirstGuessPct||0;
  d.bcByDifficulty=bd.bcByDifficulty||[];

  // The worker counts "both" players inside keyboard and numpad, so split into
  // mutually-exclusive buckets before taking percentages, or they triple-count.
  var kb=today.keyboard||0,np=today.numpad||0,bo=today.both||0;
  var kbOnly=Math.max(0,kb-bo),npOnly=Math.max(0,np-bo),it=(kbOnly+npOnly+bo)||1;
  d.inputKeyboard=Math.round(kbOnly/it*100);
  d.inputNumpad=Math.round(npOnly/it*100);
  d.inputBoth=Math.round(bo/it*100);

  // --- colour schemes ---
  var su=today.schemeUsage||[0,0,0,0],suT=(su[0]+su[1]+su[2]+su[3])||1;
  d.schemeUsage=[Math.round(su[0]/suT*100),Math.round(su[1]/suT*100),Math.round(su[2]/suT*100),Math.round(su[3]/suT*100)];

  // --- bonus rounds ---
  var b=today.bonus||{};
  var b1p=b.b1Played||0,b1w=b.b1Won||0,b2p=b.b2Played||0,b2w=b.b2Won||0;
  d.bonusCountryPlay=p?Math.round(b1p/p*100):0;
  d.bonusCountryWin=b1p?Math.round(b1w/b1p*100):0;
  d.bonusInventorPlay=p?Math.round(b2p/p*100):0;
  d.bonusInventorWin=b2p?Math.round(b2w/b2p*100):0;
  d.bonusCountryFirstTry=b1p>0?Math.round((today.b1FirstTry||0)/b1p*100):0;
  d.bonusBothWon=p>0?Math.round((today.bothWon||0)/p*100):0;
  d.bonusCounts={b1p:b1p,b1w:b1w,b2p:b2p,b2w:b2w};
  // "Skipped" = played the game but never answered the country round.
  d.bonusSkip=p>0?Math.max(0,Math.round((p-b1p)/p*100)):0;

  // --- live (always today, never range-scoped) ---
  d.liveNow=live.players||0;

  // --- hourly plays across the SELECTED range (live only ever covers today) ---
  d.hourlyPlayers=new Array(24).fill(0);
  var hrs=(bd.hours&&bd.hours.length)?bd.hours:(live.hours||[]);
  var peak=0,peakH=0;
  for(var i=0;i<hrs.length;i++){
    var hh=hrs[i],cnt=hh.count||0;
    if(hh.hour_utc>=0&&hh.hour_utc<24)d.hourlyPlayers[hh.hour_utc]=cnt;
    if(cnt>peak){peak=cnt;peakH=hh.hour_utc;}
  }
  d.peakHour=peakH;d.peakCount=peak;
  var qH=0,qC=Infinity;
  for(var i=0;i<24;i++){var hc=d.hourlyPlayers[i];if(hc>0&&hc<qC){qC=hc;qH=i;}}
  d.quietHour=qH;d.quietCount=isFinite(qC)?qC:0;

  // --- countries ---
  d.worldmap=(countries||[]).map(function(c){
    return{code:c.country,name:c.country,players:c.players,winRate:c.win_rate,
           avgGuesses:c.avg_guesses,avgTime:c.avg_time||0,flag:''};
  });

  // --- guess distribution ---
  d.guessDist={1:dist.d1||0,2:dist.d2||0,3:dist.d3||0,4:dist.d4||0,5:dist.d5||0,6:dist.d6||0};
  d.lossCount=Math.max(0,(dist.total||0)-(dist.wins||0));
  d.totalGames=dist.total||0;
  d.totalWins=dist.wins||0;

  // --- hardest puzzles ---
  d.hardest=(hardest||[]).map(function(h){
    return{name:'Puzzle #'+h.puzzle_num,num:h.puzzle_num,avg:h.avg_guesses,win:h.win_rate,players:h.players};
  });

  // --- per-puzzle series (every daily chart comes from this one response) ---
  d.dailyDates=trends.map(function(t){return '#'+t.puzzle_num;});
  d.dailyPlayers=trends.map(function(t){return t.players||0;});
  d.dailyWinRates=trends.map(function(t){return t.win_rate||0;});
  d.dailyShareRate=trends.map(function(t){return t.share_rate||0;});
  d.dailyBCRate=trends.map(function(t){return t.bc_rate||0;});
  d.dailySolveTime=trends.map(function(t){return t.avg_time||0;});
  d.dailyScheme=trends.map(function(t){
    var tot=(t.scheme_0||0)+(t.scheme_1||0)+(t.scheme_2||0)+(t.scheme_3||0);
    if(!tot)return [0,0,0,0];
    return [Math.round(t.scheme_0/tot*100),Math.round(t.scheme_1/tot*100),
            Math.round(t.scheme_2/tot*100),Math.round(t.scheme_3/tot*100)];
  });

  // --- streaks (real buckets, not a placeholder object) ---
  d.streakBuckets=bd.streaks||[];
  d.avgStreak=bd.streakAvg!==undefined?bd.streakAvg:(today.streakAvg||0);
  d.longestStreak=bd.streakMax!==undefined?bd.streakMax:(today.streakMax||0);

  // --- first-guess eras + share-by-guess (real, from game_results) ---
  d.firstGuessBuckets=bd.firstGuess||[];
  d.shareByGuess=bd.shareByGuess||[0,0,0,0,0,0];
  d.shareByGuessN=bd.shareByGuessN||[0,0,0,0,0,0];
  d.solveTimeByCountry=bd.solveTimeByCountry||[];

  // --- unfinished games (starts with no matching result) ---
  var uf=bd.unfinished||{};
  d.unfinished={
    starts:uf.starts||0,
    finished:uf.finished||0,
    unfinished:uf.unfinished||0,
    rate:uf.unfinishedRate||0,
    daily:uf.daily||[]
  };

  return d;
}

function gpFetchAll(){
  gpFetchSet(gpMainRange,null).then(function(res){
    gpData=gpNormalize(res,gpMainRange,null);
    gpApplyGridDom();
  }).catch(function(){
    // never lets one bad field blank the whole page
    try{gpUpdateCards();}catch(_){}
  });
}

// Push freshly-normalized numbers into the static grid markup.
function gpApplyGridDom(){
  var lc2=document.getElementById('gp-live-count');if(lc2)lc2.textContent=(gpData.liveNow||0).toLocaleString();
  var mn2=document.getElementById('gp-map-live-num');if(mn2)mn2.textContent=(gpData.liveNow||0).toLocaleString();
  var liveSub=document.getElementById('gp-live-sub');
  if(liveSub)liveSub.textContent=gpData.peakCount?'Peak: '+gpData.peakCount.toLocaleString()+' at '+gpData.peakHour+':00 UTC':'';

  // Colour scheme bars
  var schemeBars=document.getElementById('gp-scheme-bars');
  var schemeLabels=document.getElementById('gp-scheme-labels');
  if(schemeBars&&schemeLabels){
    var segs=schemeBars.querySelectorAll('.gp-scheme-bar-seg');
    var spans=schemeLabels.querySelectorAll('span');
    for(var i=0;i<4;i++){
      if(segs[i])segs[i].style.width=gpData.schemeUsage[i]+'%';
      if(spans[i])spans[i].textContent=gpData.schemeUsage[i]+'%';
    }
  }
  var schemeSub=document.getElementById('gp-scheme-sub');
  if(schemeSub){
    var maxSc=0;for(var i=1;i<4;i++){if(gpData.schemeUsage[i]>gpData.schemeUsage[maxSc])maxSc=i;}
    schemeSub.textContent=gpData.players?gpData.schemeNames[maxSc]+' leads globally':'No data yet';
  }

  // Win rate
  var wr=gpData.totalGames?Math.round(gpData.totalWins/gpData.totalGames*100):0;
  var wrEl=document.querySelector('[data-card="winrate"] .gp-big-num');
  if(wrEl)wrEl.textContent=gpData.totalGames?wr+'%':'--';
  var wrLbl=document.querySelector('[data-card="winrate"] .gp-big-label');
  if(wrLbl)wrLbl.textContent='overall win rate';
  var wrSub2=document.getElementById('gp-winrate-sub');
  if(wrSub2)wrSub2.textContent=gpData.totalGames?gpData.totalGames.toLocaleString()+' game'+(gpData.totalGames===1?'':'s')+' ('+gpRangeLabel(gpMainRange)+')':'';

  // Hardest
  var sorted=gpData.hardest.slice().sort(function(a,b){return b.avg-a.avg;});
  var topRow=document.getElementById('gp-hardest-top');
  if(topRow)topRow.innerHTML=sorted[0]
    ?'<span class="gp-mini-label">#1 '+sorted[0].name+'</span><span class="gp-mini-val">'+sorted[0].avg.toFixed(1)+' avg</span>'
    :'<span class="gp-mini-label">Not enough data</span><span class="gp-mini-val">--</span>';
  var hSub=document.getElementById('gp-hardest-sub');
  if(hSub)hSub.textContent=sorted[0]?sorted[0].win+'% win rate':'';

  // Unfinished games
  var uf=gpData.unfinished||{starts:0,unfinished:0,rate:0};
  var ufNum=document.getElementById('gp-unfinished-num');
  var ufSub=document.getElementById('gp-unfinished-sub');
  if(ufNum)ufNum.textContent=uf.starts?uf.unfinished.toLocaleString():'--';
  if(ufSub)ufSub.textContent=uf.starts
    ?uf.rate+'% of '+uf.starts.toLocaleString()+' started game'+(uf.starts===1?'':'s')
    :'No started games recorded yet';

  // Trends
  var totalPlays=gpData.dailyPlayers.reduce(function(a,b){return a+b;},0);
  var ttSub=document.querySelector('[data-card="timetrends"] .gp-big-sub');
  if(ttSub)ttSub.textContent=totalPlays.toLocaleString()+' play'+(totalPlays===1?'':'s')+' ('+gpRangeLabel(gpMainRange)+')';

  gpRenderRankingsCard();
  gpUpdateCards();
  try{if(typeof gpUpdateAllCards==='function')gpUpdateAllCards();}catch(e){} // mode/range-dependent summaries
  // Country data has arrived: color the map and fill the country dropdown, both of
  // which were first built synchronously against empty data at page load.
  try{if(typeof gpApplyMapColors==='function')gpApplyMapColors();}catch(e){}
  try{if(typeof gpUpdateMapHighlight==='function')gpUpdateMapHighlight();}catch(e){}
  try{gpPopulateCountryDropdown();}catch(e){}
}
// Fill the main country <select> from fetched data (called after countries load).
function gpPopulateCountryDropdown(){
  var sel=document.getElementById('gp-country-select');
  if(!sel||!gpData.worldmap||!gpData.worldmap.length)return;
  var cur=sel.value;
  var h='<option value="">All Countries</option>';
  for(var i=0;i<gpData.worldmap.length;i++){
    var c=gpData.worldmap[i];
    h+='<option value="'+c.code+'">'+c.code+' ('+(c.players||0)+')</option>';
  }
  sel.innerHTML=h;
  if(cur)sel.value=cur;
}

function gpUpdateCards(){
  // Guess distribution bars
  var bars=document.querySelectorAll('[data-card="guessdist"] .gp-mini-bar');
  var mx=Math.max(1,gpData.guessDist[1],gpData.guessDist[2],gpData.guessDist[3],gpData.guessDist[4],gpData.guessDist[5],gpData.guessDist[6]);
  for(var i=0;i<bars.length&&i<6;i++){bars[i].style.height=Math.max(2,(gpData.guessDist[i+1]/mx)*100)+'%';}
  var mostCommon=1;for(var i=2;i<=6;i++){if(gpData.guessDist[i]>gpData.guessDist[mostCommon])mostCommon=i;}
  var gdSub=document.querySelector('[data-card="guessdist"] .gp-big-sub');
  if(gdSub){var total=0;for(var i=1;i<=6;i++)total+=gpData.guessDist[i];
    gdSub.textContent=total?'Most common: '+mostCommon+' guesses ('+Math.round(gpData.guessDist[mostCommon]/total*100)+'%)':'No data yet';}

  // Bonus rounds
  var bs=document.getElementById('gp-bonus-stats');
  if(bs){var rows=bs.querySelectorAll('.gp-mini-val');
    if(rows[0])rows[0].textContent=gpData.bonusCountryPlay+'%';
    if(rows[1])rows[1].textContent=gpData.bonusCountryWin+'%';
    if(rows[2])rows[2].textContent=gpData.bonusInventorWin+'%';}

  // Demographics
  var demoSplits=document.querySelectorAll('[data-card="demographics"] .gp-demo-bar-fill');
  var demoPcts=document.querySelectorAll('[data-card="demographics"] .gp-demo-bar-pct');
  if(demoSplits[0])demoSplits[0].style.width=gpData.demoMobile+'%';
  if(demoSplits[1])demoSplits[1].style.width=gpData.demoDesktop+'%';
  if(demoPcts[0])demoPcts[0].textContent=gpData.demoMobile+'%';
  if(demoPcts[1])demoPcts[1].textContent=gpData.demoDesktop+'%';

  // Input methods
  var imSplits=document.querySelectorAll('[data-card="inputmethods"] .gp-demo-bar-fill');
  var imPcts=document.querySelectorAll('[data-card="inputmethods"] .gp-demo-bar-pct');
  if(imSplits[0])imSplits[0].style.width=gpData.inputNumpad+'%';
  if(imSplits[1])imSplits[1].style.width=gpData.inputKeyboard+'%';
  if(imPcts[0])imPcts[0].textContent=gpData.inputNumpad+'%';
  if(imPcts[1])imPcts[1].textContent=gpData.inputKeyboard+'%';

  // Solve time
  var stEl=document.querySelector('[data-card="solvetime"] .gp-big-num');
  if(stEl)stEl.textContent=gpData.solveTimeAvg?gpData.solveTimeAvg+'s':'--';

  // Share rate
  var srEl=document.querySelector('[data-card="sharerate"] .gp-big-num');
  if(srEl)srEl.textContent=gpData.shareRate+'%';

  // BC guesses
  var bcRows=document.querySelectorAll('[data-card="bcguesses"] .gp-mini-val');
  if(bcRows[0])bcRows[0].textContent=gpData.bcUsage+'%';

  // First guess
  var fgEl=document.querySelector('[data-card="firstguess"] .gp-big-num');
  if(fgEl)fgEl.textContent=gpData.firstGuessAvg||'--';
  var fgSub=document.querySelector('[data-card="firstguess"] .gp-big-sub');
  if(fgSub)fgSub.textContent=gpData.firstGuessAvg?'Average: '+gpData.firstGuessAvg+' AD':'No data yet';

  // Streaks
  var skRows=document.querySelectorAll('[data-card="streaks"] .gp-mini-val');
  if(skRows[0])skRows[0].textContent=gpData.avgStreak?gpData.avgStreak+'d':'--';
  if(skRows[1])skRows[1].textContent=gpData.longestStreak?gpData.longestStreak+'d':'--';

  // Playtime bars
  var ptBars=document.querySelectorAll('[data-card="playtimes"] .gp-mini-bar');
  var ptMax=Math.max.apply(null,gpData.hourlyPlayers)||1;
  // Shows 6 bars for 4-hour blocks, normalized against the largest 4-hour block sum,
  // not 4x the single-hour max.
  var ptBlockMax=1;
  for(var b=0;b<6;b++){var bs=0;for(var j=b*4;j<(b+1)*4&&j<24;j++)bs+=gpData.hourlyPlayers[j];if(bs>ptBlockMax)ptBlockMax=bs;}
  for(var i=0;i<ptBars.length&&i<6;i++){
    var sum=0;for(var j=i*4;j<(i+1)*4&&j<24;j++)sum+=gpData.hourlyPlayers[j];
    ptBars[i].style.height=Math.max(2,sum/ptBlockMax*100)+'%';
  }
  var ptSub=document.querySelector('[data-card="playtimes"] .gp-big-sub');
  if(ptSub)ptSub.textContent=gpData.peakCount?'Peak: '+gpData.peakHour+':00 UTC ('+gpData.peakCount.toLocaleString()+' players)':'No data yet';
}

// Fetch on load
gpFetchAll();

// ========== DETAIL PAGE DEFINITIONS ==========
// personal: what localStorage can answer about this player.
//   'dist'  — wi_stats holds a real distribution, so the chart itself goes personal
//   'fact'  — only one current/last-game value exists (wi_last_track), so personal mode
//             shows a fact panel instead of a distribution
//   false   — nothing personal is stored; the P button is hidden
// country: whether narrowing to one country changes the answer. False on the two cards
//   that are themselves the country breakdown.
var gpCards={
  worldmap:{title:'World Heat Map',graphTypes:['tilemap','hbar'],lockable:false,personal:false,country:false},
  liveplayers:{title:'Active Players',graphTypes:['bar','line'],lockable:false,personal:'fact',country:true},
  winrate:{title:'Win Rate',graphTypes:['bar','ring'],lockable:false,personal:'dist',country:true},
  guessdist:{title:'Guess Distribution',graphTypes:['bar','hbar'],lockable:false,personal:'dist',country:true},
  bonus:{title:'Bonus Rounds',graphTypes:['bar','ring'],lockable:false,personal:'dist',country:true},
  topcountries:{title:'Country Rankings',graphTypes:['tilemap','hbar'],lockable:false,personal:false,country:false},
  timetrends:{title:'Time Trends',graphTypes:['line','bar'],lockable:false,personal:false,country:true},
  firstguess:{title:'First Guess',graphTypes:['bar','hbar'],lockable:true,personal:'fact',country:true},
  streaks:{title:'Streaks',graphTypes:['bar','hbar'],lockable:false,personal:'fact',country:true},
  demographics:{title:'Demographics',graphTypes:['ring','bar'],lockable:false,personal:'fact',country:true},
  hardest:{title:'Hardest Puzzles',graphTypes:['hbar','bar'],lockable:true,personal:false,country:true},
  inputmethods:{title:'Input Methods',graphTypes:['ring','bar'],lockable:false,personal:'fact',country:true},
  solvetime:{title:'Solve Time',graphTypes:['bar','line','hbar'],lockable:false,personal:'fact',country:true},
  playtimes:{title:'Play Times',graphTypes:['bar','line','ring'],lockable:false,personal:false,country:true},
  sharerate:{title:'Share Rate',graphTypes:['ring','bar','line'],lockable:false,personal:false,country:true},
  bcguesses:{title:'BC Guesses',graphTypes:['ring','bar','hbar'],lockable:false,personal:false,country:true},
  colorscheme:{title:'Color Schemes',graphTypes:['ring','bar','hbar','line','tilemap'],lockable:false,personal:'fact',country:true},
  // Players who guessed at least once and never reached a result. personal:false because
  // localStorage only records finished games.
  unfinished:{title:'Unfinished Games',graphTypes:['ring','bar','line'],lockable:false,personal:false,country:true}
};

var gpCurrentCard=null;
var gpCurrentGraph=null;
var gpCurrentMode='G'; // 'G' global or 'P' personal
var gpCurrentRange='1W';
var gpCountryFilter=null; // null = world, 'US' = USA, etc.
var gpDetailCountry=null; // per-detail-view country filter

// ========== POPULATE COUNTRY DROPDOWN ALPHABETICALLY ==========
(function(){
  var sel=document.getElementById('gp-country-select');
  if(!sel)return;
  var sorted=gpData.worldmap.slice().sort(function(a,b){return a.name.localeCompare(b.name);});
  for(var i=0;i<sorted.length;i++){
    var opt=document.createElement('option');
    opt.value=sorted[i].code;
    opt.textContent=sorted[i].flag+' '+sorted[i].name;
    sel.appendChild(opt);
  }
})();

// ========== GET COUNTRY RANKINGS (sorted by avg guesses, ascending) ==========
function gpGetRankings(src){
  var ranked=((src||gpData).worldmap||[]).slice().sort(function(a,b){return a.avgGuesses-b.avgGuesses;});
  for(var i=0;i<ranked.length;i++)ranked[i]._rank=i+1;
  return ranked;
}

// ========== RENDER RANKINGS CARD BODY ==========
function gpRenderRankingsCard(){
  var body=document.getElementById('gp-rankings-body');
  if(!body)return;
  var ranked=gpGetRankings();
  var h='';
  if(!ranked.length){
    body.innerHTML='<div class="gp-country-row" style="border:none;padding:4px 0;"><span class="gp-country-name">No country data yet</span></div>';
    return;
  }
  // If a country is selected, pin it at top with separator
  if(gpCountryFilter){
    var sel=ranked.find(function(c){return c.code===gpCountryFilter;});
    if(sel){
      h+='<div class="gp-country-row gp-country-pinned" style="border:none;padding:4px 0;">';
      h+='<span class="gp-country-rank">#'+sel._rank+'</span>';
      h+='<span class="gp-country-flag">'+sel.flag+'</span>';
      h+='<span class="gp-country-name">'+sel.name+'</span>';
      h+='<span class="gp-country-stat">'+sel.avgGuesses+' avg</span>';
      h+='</div>';
      h+='<div class="gp-ranking-separator"></div>';
    }
  }
  // Show top 3 (or 5 in detail)
  var shown=0;
  for(var i=0;i<ranked.length&&shown<3;i++){
    if(gpCountryFilter&&ranked[i].code===gpCountryFilter)continue;
    h+='<div class="gp-country-row" style="border:none;padding:4px 0;">';
    h+='<span class="gp-country-rank">#'+ranked[i]._rank+'</span>';
    h+='<span class="gp-country-flag">'+ranked[i].flag+'</span>';
    h+='<span class="gp-country-name">'+ranked[i].name+'</span>';
    h+='<span class="gp-country-stat">'+ranked[i].avgGuesses+' avg</span>';
    h+='</div>';
    shown++;
  }
  body.innerHTML=h;
}

// ========== WORLD MAP ENLARGED VIEW ==========
var gpModalMapInstance=null;
function gpOpenMapModal(){
  var existing=document.getElementById('gp-map-modal');
  if(existing){
    if(gpModalMapInstance){gpModalMapInstance.destroy();gpModalMapInstance=null;}
    existing.remove();
  }
  if(typeof jsVectorMap==='undefined')return;

  var modal=document.createElement('div');
  modal.id='gp-map-modal';
  modal.className='gp-map-modal-bg show';
  modal.innerHTML='<div class="gp-map-modal-content">'
    +'<button class="gp-map-modal-close" id="gp-map-modal-close">&times;</button>'
    +'<div class="gp-map-modal-body"><div id="jvm-map-modal" style="width:100%;height:500px;"></div></div>'
    +'</div>';
  document.body.appendChild(modal);

  var cs=getComputedStyle(document.body);
  var bgCol=cs.getPropertyValue('--surface2').trim()||'#1a1a1a';
  var borderCol=cs.getPropertyValue('--bg').trim()||'#000';
  var hoverCol=cs.getPropertyValue('--text3').trim()||'#555';

  gpModalMapInstance=new jsVectorMap({
    selector:'#jvm-map-modal',
    map:'world',
    backgroundColor:'transparent',
    draggable:true,
    zoomButtons:true,
    zoomOnScroll:true,
    zoomOnScrollSpeed:3,
    zoomMax:12,
    zoomMin:1,
    zoomAnimate:true,
    showTooltip:true,
    regionStyle:{
      initial:{fill:bgCol,stroke:borderCol,strokeWidth:0.4},
      hover:{fill:hoverCol,cursor:'pointer'}
    },
    onRegionTooltipShow:function(evt,tooltip,code){
      var found=gpData.worldmap.find(function(c){return c.code===code;});
      if(found){
        var ranked=gpGetRankings();
        var r=ranked.find(function(c){return c.code===code;});
        tooltip.css({backgroundColor:'var(--bg)',borderColor:'var(--border)',color:'var(--text)',borderRadius:'10px',padding:'8px 14px',fontFamily:'var(--font-ui)',fontSize:'0.85rem',fontWeight:'600',boxShadow:'0 6px 20px rgba(0,0,0,0.4)'});
        tooltip.text(
          '<strong>'+found.flag+' '+found.name+'</strong><br>'
          +found.players.toLocaleString()+' players<br>'
          +found.avgGuesses+' avg guesses<br>'
          +'Rank #'+(r?r._rank:'--'),
          true
        );
      }
    },
    onRegionClick:function(evt,code){
      if(gpCountryFilter===code){gpCountryFilter=null;}
      else{gpCountryFilter=code;}
      var sel=document.getElementById('gp-country-select');
      if(sel)sel.value=gpCountryFilter||'';
      gpUpdateMapHighlight();
      gpUpdateAllCards();
    }
  });

  // Touch support for modal map
  _gpAddMapTouch(gpModalMapInstance,'#jvm-map-modal');

  // Color the modal map using computed hex values
  gpApplyMapColors(gpModalMapInstance);

  var closeBtn=document.getElementById('gp-map-modal-close');
  closeBtn.onclick=function(e){
    e.stopPropagation();
    if(gpModalMapInstance){gpModalMapInstance.destroy();gpModalMapInstance=null;}
    modal.remove();
  };
  // Also close on Escape key
  var escHandler=function(e){
    if(e.key==='Escape'){
      if(gpModalMapInstance){gpModalMapInstance.destroy();gpModalMapInstance=null;}
      modal.remove();
      document.removeEventListener('keydown',escHandler);
    }
  };
  document.addEventListener('keydown',escHandler);
  modal.onclick=function(e){
    if(e.target===modal){
      if(gpModalMapInstance){gpModalMapInstance.destroy();gpModalMapInstance=null;}
      modal.remove();
      document.removeEventListener('keydown',escHandler);
    }
  };
}

// ========== HELPER: Read personal stats from localStorage ==========
function gpGetPersonal(){
  var stats=null,track=null;
  try{stats=JSON.parse(localStorage.getItem('wi_stats'));}catch(e){}
  try{track=JSON.parse(localStorage.getItem('wi_last_track'));}catch(e){}
  if(!stats)stats={p:0,w:0,s:0,m:0,d:{1:0,2:0,3:0,4:0,5:0,6:0},l:null,b1p:0,b1w:0,b2p:0,b2w:0};
  return{stats:stats,track:track};
}

// ========== HELPER: Build time filter HTML ==========
function gpTimeFilterHTML(active){
  var ranges=['1D','1W','1M','3M','6M','1Y','ALL'];
  var h='<div class="gp-time-filter">';
  for(var i=0;i<ranges.length;i++){
    h+='<button class="gp-time-btn'+(ranges[i]===active?' active':'')+'" data-range="'+ranges[i]+'">'+ranges[i]+'</button>';
  }
  h+='</div>';
  return h;
}

// ========== HELPER: Build graph type buttons ==========
function gpGraphBtnsHTML(types,active){
  var icons={bar:'Bar',hbar:'H-Bar',ring:'Ring',line:'Line',tilemap:'Map'};
  var svgs={
    bar:'<svg viewBox="0 0 14 14"><rect x="1" y="6" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="5.5" y="2" width="3" height="12" rx="0.5" fill="currentColor"/><rect x="10" y="4" width="3" height="10" rx="0.5" fill="currentColor"/></svg>',
    hbar:'<svg viewBox="0 0 14 14"><rect x="0" y="1" width="10" height="3" rx="0.5" fill="currentColor"/><rect x="0" y="5.5" width="14" height="3" rx="0.5" fill="currentColor"/><rect x="0" y="10" width="8" height="3" rx="0.5" fill="currentColor"/></svg>',
    ring:'<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="20 15" stroke-dashoffset="0"/></svg>',
    line:'<svg viewBox="0 0 14 14"><polyline points="1,11 4,6 7,8 10,3 13,5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tilemap:'<svg viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/></svg>'
  };
  var h='<div class="gp-graph-btns">';
  for(var i=0;i<types.length;i++){
    var t=types[i];
    h+='<button class="gp-graph-btn'+(t===active?' active':'')+'" data-graph="'+t+'">'+(svgs[t]||'')+' '+(icons[t]||t)+'</button>';
  }
  h+='</div>';
  return h;
}

// ========== HELPER: Build detail country dropdown ==========
function gpDetailCountryHTML(selected){
  var h='<select class="gp-country-select gp-detail-country" id="gp-detail-country-sel">';
  h+='<option value="">All Countries</option>';
  var sorted=gpData.worldmap.slice().sort(function(a,b){return a.name.localeCompare(b.name);});
  for(var i=0;i<sorted.length;i++){
    h+='<option value="'+sorted[i].code+'"'+(sorted[i].code===selected?' selected':'')+'>'+sorted[i].flag+' '+sorted[i].name+'</option>';
  }
  h+='</select>';
  return h;
}

// ========== RENDER DONUT ==========
function gpRenderDonut(slices,centerVal,centerLabel){
  // slices: [{value:N, color:'#xxx', label:'Lbl'}]
  var total=0;for(var i=0;i<slices.length;i++)total+=slices[i].value;
  var gradParts=[],cum=0;
  if(total>0){
    for(var i=0;i<slices.length;i++){
      var pct=(slices[i].value/total)*100;
      gradParts.push(slices[i].color+' '+cum.toFixed(1)+'% '+(cum+pct).toFixed(1)+'%');
      cum+=pct;
    }
  }else{
    gradParts.push('var(--surface2) 0% 100%'); // no data — flat ring instead of an invalid NaN gradient
  }
  var h='<div class="gp-donut-wrap">';
  h+='<div class="gp-donut" style="background:conic-gradient('+gradParts.join(',')+');">';
  h+='<div class="gp-donut-hole"><span class="gp-donut-center-val">'+centerVal+'</span><span class="gp-donut-center-label">'+centerLabel+'</span></div>';
  h+='</div>';
  h+='<div class="gp-donut-legend">';
  for(var i=0;i<slices.length;i++){
    var pct=total>0?((slices[i].value/total)*100).toFixed(1)+'%':'0%';
    h+='<div class="gp-donut-legend-item"><span class="gp-donut-swatch" style="background:'+slices[i].color+';"></span>'+slices[i].label+' ('+pct+')</div>';
  }
  h+='</div></div>';
  return h;
}

// ========== RENDER BAR CHART ==========
function gpRenderBars(data,labels,maxH){
  maxH=maxH||200;
  var mx=0;for(var i=0;i<data.length;i++)if(data[i]>mx)mx=data[i];
  if(mx===0)mx=1;
  // Columns hold a minimum width (flex-shrink:0 in CSS), so a long series scrolls.
  var h='<div class="gp-chart-scroll"><div class="gp-bars" style="height:'+maxH+'px;">';
  for(var i=0;i<data.length;i++){
    var pct=(data[i]/mx)*100;
    h+='<div class="gp-bar-col">';
    h+='<div class="gp-bar-val">'+data[i]+'</div>';
    h+='<div class="gp-bar" style="height:'+pct+'%;"></div>';
    h+='<div class="gp-bar-label">'+(labels[i]||'')+'</div>';
    h+='</div>';
  }
  h+='</div></div>';
  return h;
}

// ========== RENDER HORIZONTAL BARS ==========
function gpRenderHBars(items){
  // items: [{label:'X',value:N,display:'Y'}]
  var mx=0;for(var i=0;i<items.length;i++)if(items[i].value>mx)mx=items[i].value;
  if(mx===0)mx=1;
  var h='<div class="gp-hbars">';
  for(var i=0;i<items.length;i++){
    var pct=(items[i].value/mx)*100;
    h+='<div class="gp-hbar-row">';
    h+='<span class="gp-hbar-label">'+items[i].label+'</span>';
    h+='<div class="gp-hbar-track"><div class="gp-hbar-fill" style="width:'+pct+'%;"><span>'+(items[i].display||items[i].value)+'</span></div></div>';
    h+='<span class="gp-hbar-val">'+(items[i].display||items[i].value)+'</span>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}

// ========== RENDER LINE CHART ==========
// Shapes live in a 0..100 normalized SVG that stretches to fill; labels and dots are HTML
// on top, because text inside a preserveAspectRatio="none" SVG stretches with the plot.
function gpRenderLine(data,labels,h){
  h=h||200;
  data=data||[];
  labels=labels||[];
  var n=data.length;
  var mx=0,mn=Infinity;
  for(var i=0;i<n;i++){if(data[i]>mx)mx=data[i];if(data[i]<mn)mn=data[i];}
  if(!n||!isFinite(mn)){mn=0;mx=1;} // no data — avoid Infinity/NaN axis labels
  if(mx===mn){mx=mn+1;}

  // Normalized plot coordinates (0..100 in both axes).
  var px=function(i){return n>1?(i/(n-1))*100:50;};
  var py=function(v){return 100-(((v-mn)/(mx-mn))*100);};
  var pts=[];
  for(var i=0;i<n;i++)pts.push(px(i).toFixed(2)+','+py(data[i]).toFixed(2));

  // Long series get a wider plot and scroll, matching the bar charts.
  var minPer=46,contentW=Math.max(0,n*minPer);

  var out='<div class="gp-chart-scroll"><div class="gp-line-wrap" style="height:'+h+'px;'+
          (contentW?'width:'+contentW+'px;':'')+'">';

  // Y axis (HTML, so the numbers keep their proportions)
  out+='<div class="gp-line-yaxis">';
  for(var g=0;g<5;g++){
    var val=mx-((mx-mn)/4)*g;
    out+='<span style="top:'+(g*25)+'%;">'+Math.round(val)+'</span>';
  }
  out+='</div>';

  out+='<div class="gp-line-plot">';
  out+='<svg class="gp-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">';
  for(var g=0;g<5;g++){
    var gy=g*25;
    out+='<line class="gp-line-grid" x1="0" y1="'+gy+'" x2="100" y2="'+gy+'" vector-effect="non-scaling-stroke"/>';
  }
  if(n){
    out+='<polygon class="gp-line-fill" points="'+pts.join(' ')+' 100,100 0,100"/>';
    out+='<polyline class="gp-line" points="'+pts.join(' ')+'" vector-effect="non-scaling-stroke"/>';
  }
  out+='</svg>';
  // Dots as HTML: SVG circles turn into ellipses under a non-uniform stretch.
  if(n<=60){
    for(var i=0;i<n;i++)
      out+='<span class="gp-line-dot-h" style="left:'+px(i).toFixed(2)+'%;top:'+py(data[i]).toFixed(2)+'%;"></span>';
  }
  out+='</div>';

  // X labels, thinned so they never collide (first and last always shown).
  if(labels.length){
    var step=Math.max(1,Math.ceil(n/10));
    out+='<div class="gp-line-xlabels">';
    for(var i=0;i<labels.length;i++){
      if(n>1&&i%step!==0&&i!==n-1)continue;
      out+='<span style="left:'+px(i).toFixed(2)+'%;">'+labels[i]+'</span>';
    }
    out+='</div>';
  }

  out+='</div></div>';
  return out;
}

// ========== RENDER TILE MAP (detail, full) ==========
function gpRenderTileMap(countries){
  countries=countries||[];
  // max over the whole array: the list may be sorted by something other than players
  var mx=1;for(var k=0;k<countries.length;k++){if(countries[k].players>mx)mx=countries[k].players;}
  var h='<div class="gp-tile-map" style="grid-template-columns:repeat(5,1fr);">';
  for(var i=0;i<countries.length;i++){
    var c=countries[i];
    var intensity=Math.max(8,Math.min(90,Math.round((c.players/mx)*90)));
    h+='<div class="gp-tile" style="background:color-mix(in srgb,var(--right) '+intensity+'%,var(--surface));">';
    h+='<span class="gp-tile-flag">'+c.flag+'</span>';
    h+='<span class="gp-tile-name">'+c.code+'</span>';
    h+='<span class="gp-tile-val">'+c.players.toLocaleString()+'</span>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}

// ========== PERSONAL NOTE SECTION ==========
// Only cards flagged `personal` in gpCards reach this. 'dist' cards have a real
// localStorage distribution; 'fact' cards have one current or last-game value.
function gpPersonalHTML(cardName){
  var D=gpVD();
  var p=gpGetPersonal();
  var s=p.stats,t=p.track;
  var cfg=gpCards[cardName]||{};
  var isFact=cfg.personal==='fact';
  var h='<div class="gp-personal-note"><div class="gp-personal-note-title">'+
        (isFact?'You':'Your Stats')+'</div>';
  if(!s||s.p===0){
    h+='<div style="color:var(--text3);font-size:0.85rem;padding:8px 0;">No personal data yet — play a game and this fills in.</div>';
    h+='</div>';
    return h;
  }
  var row=function(label,val){return '<div class="gp-stat-row"><span class="gp-stat-label">'+label+'</span><span class="gp-stat-val">'+val+'</span></div>';};
  var winRate=s.p>0?((s.w/s.p)*100).toFixed(1):0;
  var totalDist=0;for(var k in s.d)totalDist+=s.d[k];
  var avgGuesses=0;if(totalDist>0){for(var k in s.d)avgGuesses+=parseInt(k)*s.d[k];avgGuesses=(avgGuesses/totalDist).toFixed(1);}
  var games=D.totalGames||0;

  if(cardName==='liveplayers'){
    h+=row('Games played',s.p);
    h+=row('Games won',s.w);
    h+=row('Current streak',(s.s||0)+' day'+(s.s===1?'':'s'));
    h+=row('Best streak',(s.m||0)+' day'+(s.m===1?'':'s'));

  }else if(cardName==='winrate'){
    var globalWr=games>0?Math.round((D.totalWins||0)/games*100):0;
    h+=row('Your win rate',winRate+'%');
    h+=row('Global win rate ('+gpRangeLabel(D.range)+')',globalWr+'%');
    var diff=(parseFloat(winRate)-globalWr).toFixed(1);
    if(games>0){
      if(diff>0)h+='<div class="gp-fun-stat">You are <strong>'+diff+'% above</strong> the global average.</div>';
      else if(diff<0)h+='<div class="gp-fun-stat">You are <strong>'+Math.abs(diff)+'% below</strong> the global average.</div>';
      else h+='<div class="gp-fun-stat">You are <strong>exactly at</strong> the global average.</div>';
    }

  }else if(cardName==='guessdist'){
    h+=row('Your avg guesses',avgGuesses);
    for(var g=1;g<=6;g++){
      var cnt=s.d[g]||0;
      h+=row(g+' guess'+(g>1?'es':''),cnt+' ('+(totalDist>0?((cnt/totalDist)*100).toFixed(1):0)+'%)');
    }

  }else if(cardName==='bonus'){
    h+=row('Country round played',s.b1p||0);
    h+=row('Country win rate',s.b1p>0?Math.round(s.b1w/s.b1p*100)+'%':'--');
    h+=row('Inventor round played',s.b2p||0);
    h+=row('Inventor win rate',s.b2p>0?Math.round(s.b2w/s.b2p*100)+'%':'--');

  }else if(cardName==='streaks'){
    h+=row('Current streak',(s.s||0)+' day'+(s.s===1?'':'s'));
    h+=row('Best streak',(s.m||0)+' day'+(s.m===1?'':'s'));
    h+=row('Global average streak',(D.avgStreak||0)+' days');
    h+=row('Global longest streak',(D.longestStreak||0)+' days');
    if((s.m||0)>(D.avgStreak||0))
      h+='<div class="gp-fun-stat">Your best streak is <strong>'+((s.m||0)-(D.avgStreak||0)).toFixed(1)+' days above</strong> the global average.</div>';

  }else if(cardName==='firstguess'){
    // wi_last_track holds one game, so this is stated as one game, not a distribution
    h+=row('Your last first guess',(t&&t.fg!==undefined)?(t.fg<0?Math.abs(t.fg)+' BC':t.fg+' AD'):'--');
    h+=row('Global average',D.firstGuessAvg?D.firstGuessAvg+' AD':'--');
    h+=row('Most common globally',D.firstGuessPopular||'--');
    h+=row('Games played',s.p);

  }else if(cardName==='demographics'){
    var isMob=/Mobi|Android/i.test(navigator.userAgent);
    var isDark=document.body.getAttribute('data-theme')==='dark'; // theme lives on <body>, not <html>
    h+=row('Your device',isMob?'Mobile':'Desktop');
    h+=row('Your theme',isDark?'Dark':'Light');
    h+=row('Players on '+(isMob?'mobile':'desktop'),(isMob?D.demoMobile:D.demoDesktop)+'%');
    h+=row('Players on '+(isDark?'dark':'light'),(isDark?D.demoDark:D.demoLight)+'%');

  }else if(cardName==='inputmethods'){
    var methods={numpad:'Numpad',keyboard:'Keyboard',both:'Both',none:'--'}; // t.im is a string, not an index
    var mine=(t&&t.im!==undefined)?(methods[t.im]||'Unknown'):'--';
    h+=row('Your last game',mine);
    h+=row('Numpad globally',D.inputNumpad+'%');
    h+=row('Keyboard globally',D.inputKeyboard+'%');
    h+=row('Both globally',D.inputBoth+'%');

  }else if(cardName==='solvetime'){
    var fmt=function(x){return x>=60?Math.floor(x/60)+'m '+(x%60)+'s':(x||0)+'s';};
    if(t&&t.t!==undefined){
      h+=row('Your last solve',fmt(t.t));
      h+=row('Global average',fmt(D.solveTimeAvg));
      var dt=t.t-(D.solveTimeAvg||0);
      if(D.solveTimeAvg)
        h+='<div class="gp-fun-stat">That was <strong>'+(dt>0?dt+'s slower':Math.abs(dt)+'s faster')+'</strong> than the global average.</div>';
    }else{
      h+=row('Your last solve','--');
      h+=row('Global average',fmt(D.solveTimeAvg));
    }
    h+=row('Games played',s.p);

  }else if(cardName==='colorscheme'){
    var sc=D.schemeColors,sn=D.schemeNames;
    var mine=0;
    try{var prefs=JSON.parse(localStorage.getItem('wi_prefs'));if(prefs&&prefs.scheme!==undefined)mine=parseInt(prefs.scheme)||0;}catch(e){}
    if(t&&t.sc!==undefined)mine=parseInt(t.sc)||0;
    mine=Math.min(3,Math.max(0,mine));
    h+='<div class="gp-stat-row"><span class="gp-stat-label">Your scheme</span><span class="gp-stat-val" style="color:'+sc[mine].right+';">'+sn[mine]+'</span></div>';
    h+=row('Players using it',D.schemeUsage[mine]+'%');
    var rank=D.schemeUsage.slice().sort(function(a,b){return b-a;}).indexOf(D.schemeUsage[mine])+1;
    var labels=['most','2nd most','3rd most','least'];
    h+='<div class="gp-fun-stat">You use the <strong style="color:'+sc[mine].right+';">'+labels[rank-1]+' popular</strong> colour scheme.</div>';
  }
  h+='</div>';
  return h;
}


// ========== RENDER DETAIL VIZ ==========
function gpRenderViz(cardName,graphType){
  // Detail charts read the detail fetch (gpVD), never the grid's snapshot, so this
  // page's range and country selectors apply.
  var D=gpVD();
  var noData=function(msg){return '<div class="gp-viz-empty">'+(msg||'No data in this range yet')+'</div>';};
  var hasGames=(D.totalGames||0)>0;

  if(cardName==='worldmap'){
    if(!D.worldmap.length)return noData('No country data in this range yet');
    if(graphType==='tilemap')return gpRenderTileMap(D.worldmap);
    var items=D.worldmap.slice().sort(function(a,b){return b.players-a.players;})
      .map(function(c){return{label:c.flag+' '+c.name,value:c.players,display:c.players.toLocaleString()};});
    return gpRenderHBars(items);

  }else if(cardName==='topcountries'){
    var ranked=gpGetRankings(D);
    if(!ranked.length)return noData('No country data in this range yet');
    if(graphType==='tilemap')return gpRenderTileMap(ranked);
    var items=ranked.map(function(c){
      return{label:'#'+c._rank+' '+c.flag+' '+c.name,value:Math.max(0.1,c.avgGuesses)*10,
             display:c.avgGuesses+' avg · '+c.players.toLocaleString()+'p'};
    });
    return gpRenderHBars(items);

  }else if(cardName==='liveplayers'){
    if(!D.dailyPlayers.length)return noData();
    return graphType==='bar'
      ? gpRenderBars(D.dailyPlayers,D.dailyDates)
      : gpRenderLine(D.dailyPlayers,D.dailyDates);

  }else if(cardName==='winrate'){
    if(!hasGames)return noData();
    if(graphType==='bar'){
      if(!D.dailyWinRates.length)return noData();
      return gpRenderBars(D.dailyWinRates,D.dailyDates);
    }
    var wins=D.totalWins||0,losses=D.lossCount||0,games=wins+losses;
    return gpRenderDonut([
      {value:wins,color:'var(--right)',label:'Won'},
      {value:losses,color:'var(--no)',label:'Lost'}
    ],(games>0?Math.round(wins/games*100):0)+'%','Win Rate');

  }else if(cardName==='guessdist'){
    if(!hasGames)return noData();
    if(graphType==='bar'){
      var vals=[],lbls=[];
      for(var g=1;g<=6;g++){vals.push(D.guessDist[g]||0);lbls.push(g+'');}
      return gpRenderBars(vals,lbls);
    }
    var items=[];
    for(var g=1;g<=6;g++){
      var v=D.guessDist[g]||0;
      items.push({label:g+' guess'+(g>1?'es':''),value:v,display:v.toLocaleString()});
    }
    items.push({label:'Loss',value:D.lossCount,display:D.lossCount.toLocaleString()});
    return gpRenderHBars(items);

  }else if(cardName==='bonus'){
    var bc=D.bonusCounts||{b1p:0,b1w:0,b2p:0,b2w:0};
    if(!bc.b1p&&!bc.b2p)return noData('Nobody played a bonus round in this range yet');
    if(graphType==='ring'){
      // Counts, not percentages: a ring built from independent percentages does not
      // sum to a whole.
      return gpRenderDonut([
        {value:bc.b1w,color:'var(--right)',label:'Country won'},
        {value:Math.max(0,bc.b1p-bc.b1w),color:'var(--no)',label:'Country lost'}
      ],(bc.b1p?Math.round(bc.b1w/bc.b1p*100):0)+'%','Country win rate')+
      '<div style="height:20px;"></div>'+
      gpRenderDonut([
        {value:bc.b2w,color:'var(--right)',label:'Inventor won'},
        {value:Math.max(0,bc.b2p-bc.b2w),color:'var(--no)',label:'Inventor lost'}
      ],(bc.b2p?Math.round(bc.b2w/bc.b2p*100):0)+'%','Inventor win rate');
    }
    return gpRenderBars(
      [bc.b1p,bc.b1w,bc.b2p,bc.b2w],
      ['C.played','C.won','I.played','I.won']
    );

  }else if(cardName==='timetrends'){
    if(!D.dailyPlayers.length)return noData();
    return graphType==='line'
      ? gpRenderLine(D.dailyPlayers,D.dailyDates)
      : gpRenderBars(D.dailyPlayers,D.dailyDates);

  }else if(cardName==='firstguess'){
    // era distribution from game_results
    var fg=D.firstGuessBuckets||[];
    var total=fg.reduce(function(a,b){return a+(b.count||0);},0);
    if(!total)return noData('No first guesses recorded in this range yet');
    var labels=fg.map(function(b){return b.bucket;});
    var counts=fg.map(function(b){return b.count||0;});
    if(graphType==='bar')return gpRenderBars(counts,labels);
    var items=fg.map(function(b){
      return{label:b.bucket==='BC'?'BC':b.bucket+'00s',value:b.count||0,
             display:(b.count||0)+' ('+Math.round((b.count||0)/total*100)+'%)'};
    });
    return gpRenderHBars(items);

  }else if(cardName==='streaks'){
    // streak buckets from game_results
    var sb=D.streakBuckets||[];
    var stotal=sb.reduce(function(a,b){return a+(b.count||0);},0);
    if(!stotal)return noData('No streaks recorded in this range yet');
    if(graphType==='bar')
      return gpRenderBars(sb.map(function(b){return b.count;}),sb.map(function(b){return b.bucket;}));
    return gpRenderHBars(sb.map(function(b){
      return{label:b.bucket+' day'+(b.bucket==='1'?'':'s'),value:b.count,
             display:b.count+' ('+Math.round(b.count/stotal*100)+'%)'};
    }));

  }else if(cardName==='demographics'){
    if(!hasGames)return noData();
    if(graphType==='ring'){
      return gpRenderDonut([
        {value:D.demoMobile,color:'var(--right)',label:'Mobile'},
        {value:D.demoDesktop,color:'var(--near)',label:'Desktop'}
      ],D.demoMobile+'%','Mobile')+
      '<div style="height:20px;"></div>'+
      gpRenderDonut([
        {value:D.demoDark,color:'var(--text)',label:'Dark Mode'},
        {value:D.demoLight,color:'var(--text3)',label:'Light Mode'}
      ],D.demoDark+'%','Dark');
    }
    return gpRenderBars(
      [D.demoMobile,D.demoDesktop,D.demoDark,D.demoLight],
      ['Mobile','Desktop','Dark','Light']
    );

  }else if(cardName==='hardest'){
    var hardList=D.hardest.slice();
    if(!hardList.length)
      return noData('Not enough plays per puzzle in this range to rank difficulty yet');
    hardList.sort(function(a,b){return b.avg-a.avg;});
    if(graphType==='bar')
      return gpRenderBars(hardList.map(function(x){return x.avg;}),hardList.map(function(x){return '#'+x.num;}));
    return gpRenderHBars(hardList.map(function(x,i){
      return{label:(i+1)+'. '+x.name,value:x.avg*10,display:x.avg+' avg / '+x.win+'% win'};
    }));

  }else if(cardName==='inputmethods'){
    if(!hasGames)return noData();
    if(graphType==='ring'){
      return gpRenderDonut([
        {value:D.inputNumpad,color:'var(--right)',label:'Numpad'},
        {value:D.inputKeyboard,color:'var(--near)',label:'Keyboard'},
        {value:D.inputBoth,color:'var(--wrong)',label:'Both'}
      ],D.inputNumpad+'%','Numpad');
    }
    return gpRenderBars([D.inputNumpad,D.inputKeyboard,D.inputBoth],['Numpad','Keyboard','Both']);

  }else if(cardName==='solvetime'){
    if(graphType==='bar'){
      var vals=D.solveTimeByGuess.slice();
      if(!vals.some(function(v){return v>0;}))return noData('No solve times recorded in this range yet');
      return gpRenderBars(vals,['1 guess','2','3','4','5','6']);
    }else if(graphType==='line'){
      if(!D.dailySolveTime.length)return noData();
      return gpRenderLine(D.dailySolveTime,D.dailyDates);
    }
    // per-country average solve time
    var byC=(D.solveTimeByCountry||[]).filter(function(c){return c.avgTime>0;})
      .sort(function(a,b){return a.avgTime-b.avgTime;});
    if(!byC.length)return noData('No per-country solve times in this range yet');
    return gpRenderHBars(byC.map(function(c){
      return{label:c.country,value:c.avgTime,display:c.avgTime+'s ('+c.players+'p)'};
    }));

  }else if(cardName==='playtimes'){
    var hourly=D.hourlyPlayers;
    if(!hourly.some(function(v){return v>0;}))return noData();
    if(graphType==='bar'){
      var labels=[];for(var i=0;i<24;i++)labels.push(i%3===0?i+'':'');
      return gpRenderBars(hourly,labels);
    }else if(graphType==='line'){
      var labels=[];for(var i=0;i<24;i++)labels.push(i%4===0?i+'h':'');
      return gpRenderLine(hourly,labels);
    }
    var night=0,morning=0,afternoon=0,evening=0;
    for(var i=0;i<24;i++){
      if(i<6)night+=hourly[i];
      else if(i<12)morning+=hourly[i];
      else if(i<18)afternoon+=hourly[i];
      else evening+=hourly[i];
    }
    var tot=night+morning+afternoon+evening;
    var _pc=function(v){return tot>0?Math.round(v/tot*100):0;};
    return gpRenderDonut([
      {value:morning,color:'var(--right)',label:'Morning (6-12) '+_pc(morning)+'%'},
      {value:afternoon,color:'var(--near)',label:'Afternoon (12-18) '+_pc(afternoon)+'%'},
      {value:evening,color:'var(--wrong)',label:'Evening (18-24) '+_pc(evening)+'%'},
      {value:night,color:'var(--text3)',label:'Night (0-6) '+_pc(night)+'%'}
    ],_pc(afternoon)+'%','Afternoon');

  }else if(cardName==='sharerate'){
    if(!hasGames)return noData();
    if(graphType==='ring'){
      return gpRenderDonut([
        {value:D.shareRate,color:'var(--right)',label:'Shared'},
        {value:100-D.shareRate,color:'var(--surface2)',label:'Didn\'t share'}
      ],D.shareRate+'%','Share');
    }else if(graphType==='bar'){
      if(!D.shareByGuessN.some(function(n){return n>0;}))return noData();
      return gpRenderBars(D.shareByGuess,['1','2','3','4','5','6']);
    }
    if(!D.dailyShareRate.length)return noData();
    return gpRenderLine(D.dailyShareRate,D.dailyDates);

  }else if(cardName==='bcguesses'){
    if(!hasGames)return noData();
    if(graphType==='ring'){
      return gpRenderDonut([
        {value:D.bcUsage,color:'var(--wrong)',label:'Tried BC'},
        {value:100-D.bcUsage,color:'var(--surface2)',label:'No BC'}
      ],D.bcUsage+'%','Tried BC');
    }else if(graphType==='bar'){
      if(!D.dailyBCRate.length)return noData();
      return gpRenderBars(D.dailyBCRate,D.dailyDates);
    }
    // Difficulty quintiles need at least 5 puzzles of data — say so rather than draw zeroes.
    var q=D.bcByDifficulty||[];
    if(!q.length)return noData('Needs at least 5 puzzles in range to split by difficulty');
    var qLabels=['Hardest 20%','Hard','Medium','Easy','Easiest 20%'];
    return gpRenderHBars(q.map(function(x,i){
      return{label:qLabels[i],value:x.pct,display:x.pct+'% of '+x.players+'p'};
    }));

  }else if(cardName==='unfinished'){
    var uf=D.unfinished||{starts:0,daily:[]};
    // An empty result means no starts were recorded in this window, not that nobody
    // abandoned a game.
    if(!uf.starts)return noData('No started games recorded in this range yet');
    if(graphType==='ring'){
      return gpRenderDonut([
        {value:uf.finished,color:'var(--right)',label:'Finished'},
        {value:uf.unfinished,color:'var(--no)',label:'Gave up mid-game'}
      ],uf.rate+'%','Unfinished');
    }
    var days=uf.daily.map(function(x){return '#'+x.puzzle_num;});
    if(graphType==='bar')
      return gpRenderBars(uf.daily.map(function(x){return x.unfinished;}),days);
    return gpRenderLine(uf.daily.map(function(x){return x.rate;}),days);

  }else if(cardName==='colorscheme'){
    var su=D.schemeUsage,sn=D.schemeNames,sc=D.schemeColors;
    if(!hasGames)return noData();
    if(graphType==='ring'){
      var top=0;for(var s=1;s<4;s++)if(su[s]>su[top])top=s;
      return gpRenderDonut([
        {value:su[0],color:sc[0].right,label:sn[0]},
        {value:su[1],color:sc[1].right,label:sn[1]},
        {value:su[2],color:sc[2].right,label:sn[2]},
        {value:su[3],color:sc[3].right,label:sn[3]}
      ],su[top]+'%',sn[top]);
    }else if(graphType==='bar'){
      var daily=D.dailyScheme,days=D.dailyDates;
      if(!daily.length)return noData();
      var h='<div class="gp-chart-scroll"><div class="gp-bars" style="height:200px;">';
      for(var d=0;d<daily.length;d++){
        var total=daily[d].reduce(function(a,b){return a+b;},0);
        h+='<div class="gp-bar-col" style="height:100%;justify-content:flex-end;">';
        for(var s=3;s>=0;s--){
          var pct=total>0?daily[d][s]/total*100:0;
          h+='<div style="width:100%;height:'+pct+'%;background:'+sc[s].right+';'+(pct>0?'min-height:2px;':'')+(s===3?'border-radius:4px 4px 0 0;':'')+'"></div>';
        }
        h+='<div class="gp-bar-label">'+days[d]+'</div>';
        h+='</div>';
      }
      h+='</div></div>';
      h+='<div style="display:flex;gap:16px;justify-content:center;margin-top:12px;flex-wrap:wrap;">';
      for(var s=0;s<4;s++){
        h+='<span style="font-size:0.75rem;font-weight:700;display:flex;align-items:center;gap:4px;">';
        h+='<span style="width:10px;height:10px;border-radius:3px;background:'+sc[s].right+';display:inline-block;"></span>';
        h+='<span style="color:'+sc[s].right+';">'+sn[s]+'</span></span>';
      }
      h+='</div>';
      return h;
    }else if(graphType==='hbar'){
      var h='<div class="gp-hbars">';
      for(var s=0;s<4;s++){
        var pct=su[s];
        h+='<div class="gp-hbar-row">';
        h+='<span class="gp-hbar-label" style="color:'+sc[s].right+';">'+sn[s]+'</span>';
        h+='<div class="gp-hbar-track" style="border:1px solid '+sc[s].near+';">';
        h+='<div class="gp-hbar-fill" style="width:'+pct+'%;background:linear-gradient(90deg,'+sc[s].right+','+sc[s].near+');"><span>'+pct+'%</span></div>';
        h+='</div>';
        h+='<span class="gp-hbar-val" style="color:'+sc[s].right+';">'+pct+'%</span>';
        h+='</div>';
      }
      h+='</div>';
      return h;
    }else if(graphType==='line'){
      var daily=D.dailyScheme,days=D.dailyDates;
      if(daily.length<2)return noData('Needs at least 2 days in range to draw a trend');
      // same structure as gpRenderLine: shapes in a stretched 0..100 SVG, text as HTML
      var nD=daily.length,pxD=function(i){return (i/(nD-1))*100;};
      var h='<div class="gp-chart-scroll"><div class="gp-line-wrap" style="height:200px;width:'+(nD*46)+'px;">';
      h+='<div class="gp-line-yaxis">';
      for(var g=0;g<=4;g++)h+='<span style="top:'+(g*25)+'%;">'+(100-g*25)+'%</span>';
      h+='</div>';
      h+='<div class="gp-line-plot"><svg class="gp-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">';
      for(var g=0;g<=4;g++)
        h+='<line x1="0" y1="'+(g*25)+'" x2="100" y2="'+(g*25)+'" class="gp-line-grid" vector-effect="non-scaling-stroke"/>';
      for(var s=0;s<4;s++){
        var pts=[];
        for(var d=0;d<nD;d++)pts.push(pxD(d).toFixed(2)+','+(100-Math.min(100,daily[d][s])).toFixed(2));
        h+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+sc[s].right+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
      }
      h+='</svg>';
      if(nD<=60){
        for(var s=0;s<4;s++)
          for(var d=0;d<nD;d++)
            h+='<span class="gp-line-dot-h" style="left:'+pxD(d).toFixed(2)+'%;top:'+(100-Math.min(100,daily[d][s]))+'%;background:'+sc[s].right+';"></span>';
      }
      h+='</div>';
      var stepD=Math.max(1,Math.ceil(nD/10));
      h+='<div class="gp-line-xlabels">';
      for(var d=0;d<days.length;d++){
        if(d%stepD!==0&&d!==nD-1)continue;
        h+='<span style="left:'+pxD(d).toFixed(2)+'%;">'+days[d]+'</span>';
      }
      h+='</div></div></div>';
      h+='<div style="display:flex;gap:16px;justify-content:center;margin-top:8px;flex-wrap:wrap;">';
      for(var s=0;s<4;s++){
        h+='<span style="font-size:0.75rem;font-weight:700;display:flex;align-items:center;gap:4px;">';
        h+='<span style="width:10px;height:10px;border-radius:3px;background:'+sc[s].right+';display:inline-block;"></span>';
        h+='<span style="color:'+sc[s].right+';">'+sn[s]+'</span></span>';
      }
      h+='</div>';
      return h;
    }else if(graphType==='tilemap'){
      var h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
      for(var s=0;s<4;s++){
        h+='<div style="background:color-mix(in srgb,'+sc[s].right+' 12%,var(--surface));border:1.5px solid '+sc[s].right+';border-radius:14px;padding:18px;text-align:center;">';
        h+='<div style="font-size:1.8rem;font-weight:900;font-family:var(--font-mono);color:'+sc[s].right+';line-height:1;">'+su[s]+'%</div>';
        h+='<div style="font-size:0.8rem;font-weight:700;color:'+sc[s].right+';margin-top:4px;">'+sn[s]+'</div>';
        h+='<div style="display:flex;gap:6px;justify-content:center;margin-top:10px;">';
        h+='<span style="width:24px;height:8px;border-radius:4px;background:'+sc[s].right+';display:inline-block;" title="Right"></span>';
        h+='<span style="width:24px;height:8px;border-radius:4px;background:'+sc[s].near+';display:inline-block;" title="Near"></span>';
        h+='</div>';
        h+='</div>';
      }
      h+='</div>';
      return h;
    }
  }
  return '<div class="gp-viz-empty">No data available</div>';
}

// ========== DETAIL EXTRA STATS ==========
function gpDetailExtra(cardName){
  var D=gpVD();
  var h='<div class="gp-detail-extra">';
  var row=function(label,val){return '<div class="gp-stat-row"><span class="gp-stat-label">'+label+'</span><span class="gp-stat-val">'+val+'</span></div>';};
  var fmtTime=function(s){return s>=60?Math.floor(s/60)+'m '+(s%60)+'s':(s||0)+'s';};
  var games=D.totalGames||0;

  if(cardName==='liveplayers'){
    h+=row('Playing right now',(D.liveNow||0).toLocaleString());
    h+=row('Games in range',games.toLocaleString());
    h+=row('Puzzles with plays',D.dailyPlayers.length.toLocaleString());
    if(D.dailyPlayers.length){
      var avgDaily=D.dailyPlayers.reduce(function(a,b){return a+b;},0)/D.dailyPlayers.length;
      h+=row('Avg per puzzle',Math.round(avgDaily).toLocaleString());
    }
    if(D.peakCount)h+=row('Busiest hour',D.peakHour+':00 UTC ('+D.peakCount.toLocaleString()+')');

  }else if(cardName==='winrate'){
    var wins=D.totalWins||0;
    h+=row('Win rate',games>0?Math.round(wins/games*100)+'%':'--');
    h+=row('Games won',wins.toLocaleString()+' of '+games.toLocaleString());
    h+=row('Perfect (1 guess)',games>0?(((D.guessDist[1]||0)/games)*100).toFixed(1)+'%':'--');
    h+=row('Failed',games>0?((D.lossCount/games)*100).toFixed(1)+'%':'--');
    if(D.dailyWinRates.length){
      var s=0;for(var i=0;i<D.dailyWinRates.length;i++)s+=D.dailyWinRates[i];
      h+=row('Avg per puzzle',Math.round(s/D.dailyWinRates.length)+'%');
    }

  }else if(cardName==='guessdist'){
    var totalW=0;for(var g=1;g<=6;g++)totalW+=D.guessDist[g]||0;
    for(var g=1;g<=6;g++){
      var v=D.guessDist[g]||0;
      h+=row(g+' guess'+(g>1?'es':''),v.toLocaleString()+' ('+(games>0?((v/games)*100).toFixed(1):0)+'%)');
    }
    h+=row('Loss',D.lossCount.toLocaleString()+' ('+(games>0?((D.lossCount/games)*100).toFixed(1):0)+'%)');
    var cumul=0,medianG='--',avgG='--';
    if(totalW>0){
      var half=totalW/2,weighted=0;
      for(var g=1;g<=6;g++){cumul+=D.guessDist[g];weighted+=g*D.guessDist[g];if(cumul>=half&&medianG==='--')medianG=g;}
      avgG=(weighted/totalW).toFixed(1);
    }
    h+=row('Median guesses (wins)',medianG);
    h+=row('Avg guesses (wins)',avgG);

  }else if(cardName==='bonus'){
    var bc=D.bonusCounts||{b1p:0,b1w:0,b2p:0,b2w:0};
    h+=row('Country round played',bc.b1p.toLocaleString()+' ('+D.bonusCountryPlay+'% of games)');
    h+=row('Country win rate',bc.b1p?D.bonusCountryWin+'%':'--');
    h+=row('Country solved 1st try',bc.b1p?D.bonusCountryFirstTry+'%':'--');
    h+=row('Inventor round played',bc.b2p.toLocaleString()+' ('+D.bonusInventorPlay+'% of games)');
    h+=row('Inventor win rate',bc.b2p?D.bonusInventorWin+'%':'--');
    h+=row('Won both rounds',D.bonusBothWon+'% of games');

  }else if(cardName==='worldmap'||cardName==='topcountries'){
    var wm=D.worldmap;
    if(!wm.length){h+=row('Countries','No data yet');}
    else{
      var totalP=wm.reduce(function(a,c){return a+c.players;},0);
      h+=row('Countries represented',wm.length);
      h+=row('Total players',totalP.toLocaleString());
      var mostP=wm.slice().sort(function(a,b){return b.players-a.players;})[0];
      h+=row('Most players',mostP.name+' ('+mostP.players.toLocaleString()+')');
      var topWin=wm.slice().sort(function(a,b){return b.winRate-a.winRate;})[0];
      h+=row('Best win rate',topWin.name+' ('+topWin.winRate+'%)');
      var ranked=gpGetRankings(D);
      h+=row('Lowest avg guesses',ranked[0].name+' ('+ranked[0].avgGuesses+')');
      h+=row('Global avg guesses',(wm.reduce(function(a,c){return a+c.avgGuesses*c.players;},0)/Math.max(1,totalP)).toFixed(1));
    }

  }else if(cardName==='firstguess'){
    h+=row('Average first guess',D.firstGuessAvg?D.firstGuessAvg+' AD':'--');
    h+=row('Most common first guess',D.firstGuessPopular||'--');
    h+=row('Opened with BC',D.firstGuessBCPct+'%');
    var fg=D.firstGuessBuckets||[],fgTot=fg.reduce(function(a,b){return a+(b.count||0);},0);
    if(fgTot){
      var top=fg.slice().sort(function(a,b){return b.count-a.count;})[0];
      h+=row('Most popular era',(top.bucket==='BC'?'BC':top.bucket+'00s')+' ('+Math.round(top.count/fgTot*100)+'%)');
    }

  }else if(cardName==='streaks'){
    var sb=D.streakBuckets||[],stot=sb.reduce(function(a,b){return a+(b.count||0);},0);
    if(!stot){h+=row('Streaks','No streaks recorded yet');}
    else{
      for(var i=0;i<sb.length;i++)
        h+=row(sb[i].bucket+' day'+(sb[i].bucket==='1'?'':'s'),sb[i].count+' ('+Math.round(sb[i].count/stot*100)+'%)');
      h+=row('Longest streak',D.longestStreak+' days');
      h+=row('Average streak',D.avgStreak+' days');
      h+=row('Games on a streak',stot.toLocaleString()+' of '+games.toLocaleString());
    }

  }else if(cardName==='demographics'){
    h+=row('Mobile',D.demoMobile+'%');
    h+=row('Desktop',D.demoDesktop+'%');
    h+=row('Dark mode',D.demoDark+'%');
    h+=row('Light mode',D.demoLight+'%');

  }else if(cardName==='inputmethods'){
    h+=row('Numpad only',D.inputNumpad+'%');
    h+=row('Keyboard only',D.inputKeyboard+'%');
    h+=row('Both',D.inputBoth+'%');

  }else if(cardName==='hardest'){
    if(!D.hardest.length){h+=row('Ranked puzzles','Not enough plays per puzzle yet');}
    else{
      var sorted=D.hardest.slice().sort(function(a,b){return a.avg-b.avg;});
      var easiest=sorted[0],hardestP=sorted[sorted.length-1];
      h+=row('Hardest puzzle',hardestP.name+' ('+hardestP.avg.toFixed(1)+' avg)');
      h+=row('Easiest puzzle',easiest.name+' ('+easiest.avg.toFixed(1)+' avg)');
      h+=row('Ranked puzzles',D.hardest.length);
      h+=row('Avg across ranked',(sorted.reduce(function(a,c){return a+c.avg;},0)/sorted.length).toFixed(1));
      h+=row('Avg win rate',Math.round(sorted.reduce(function(a,c){return a+c.win;},0)/sorted.length)+'%');
    }

  }else if(cardName==='timetrends'){
    var totalPlays=D.dailyPlayers.reduce(function(a,b){return a+b;},0);
    h+=row('Total plays',totalPlays.toLocaleString());
    if(D.dailyPlayers.length){
      var bestI=0,worstI=0;
      for(var i=1;i<D.dailyPlayers.length;i++){
        if(D.dailyPlayers[i]>D.dailyPlayers[bestI])bestI=i;
        if(D.dailyPlayers[i]<D.dailyPlayers[worstI])worstI=i;
      }
      h+=row('Busiest puzzle',(D.dailyDates[bestI]||'--')+' ('+D.dailyPlayers[bestI].toLocaleString()+')');
      h+=row('Quietest puzzle',(D.dailyDates[worstI]||'--')+' ('+D.dailyPlayers[worstI].toLocaleString()+')');
      h+=row('Avg per puzzle',Math.round(totalPlays/D.dailyPlayers.length).toLocaleString());
      h+=row('Puzzles with plays',D.dailyPlayers.length);
    }

  }else if(cardName==='solvetime'){
    h+=row('Average',fmtTime(D.solveTimeAvg));
    h+=row('Median',fmtTime(D.solveTimeMedian));
    h+=row('Fastest',fmtTime(D.solveTimeFastest));
    h+=row('Slowest',fmtTime(D.solveTimeSlowest));
    h+=row('1-guess average',fmtTime(D.solveTimeByGuess[0]));
    h+=row('6-guess average',fmtTime(D.solveTimeByGuess[5]));

  }else if(cardName==='playtimes'){
    var totalH=D.hourlyPlayers.reduce(function(a,b){return a+b;},0);
    h+=row('Busiest hour',D.peakHour+':00 UTC ('+(D.peakCount||0).toLocaleString()+')');
    h+=row('Quietest hour',D.quietCount?D.quietHour+':00 UTC ('+D.quietCount+')':'--');
    h+=row('Games counted',totalH.toLocaleString());
    h+=row('Busiest hour share',totalH>0?Math.round(D.peakCount/totalH*100)+'% of plays':'--');
    var hoursWith=D.hourlyPlayers.filter(function(v){return v>0;}).length;
    h+=row('Hours with any play',hoursWith+' of 24');

  }else if(cardName==='sharerate'){
    h+=row('Overall share rate',D.shareRate+'%');
    h+=row('Winners who shared',D.shareWinRate+'%');
    h+=row('Losers who shared',D.shareLossRate+'%');
    var n=D.shareByGuessN||[0,0,0,0,0,0];
    if(n[0]>0)h+=row('1-guess share rate',D.shareByGuess[0]+'% of '+n[0]);
    if(n[5]>0)h+=row('6-guess share rate',D.shareByGuess[5]+'% of '+n[5]);
    if(D.shareRate===0)h+='<div class="gp-fun-stat">Nobody has used the share button in this range yet.</div>';

  }else if(cardName==='bcguesses'){
    h+=row('Tried BC at all',D.bcUsage+'%');
    h+=row('Opened with BC',D.bcFirstGuess+'%');
    h+=row('Win rate impact',(D.bcWinDelta>0?'+':'')+D.bcWinDelta+'% vs non-BC');
    var q=D.bcByDifficulty||[];
    if(q.length===5){
      h+=row('Hardest 20% of puzzles',q[0].pct+'% tried BC');
      h+=row('Easiest 20% of puzzles',q[4].pct+'% tried BC');
    }
    if(D.bcUsage>0){
      var bd=D.bcWinDelta||0;
      h+='<div class="gp-fun-stat">Players who reach for BC are <strong>'+Math.abs(bd)+'% '+(bd<0?'less':'more')+' likely</strong> to win.</div>';
    }

  }else if(cardName==='unfinished'){
    var uf=D.unfinished||{starts:0,finished:0,unfinished:0,rate:0,daily:[]};
    if(!uf.starts){
      h+=row('Games started','None recorded in this range');
      h+='<div class="gp-fun-stat">Start tracking began on 17 Aug 2026 — earlier puzzles have no record of who walked away.</div>';
    }else{
      h+=row('Games started',uf.starts.toLocaleString());
      h+=row('Finished',uf.finished.toLocaleString());
      h+=row('Gave up mid-game',uf.unfinished.toLocaleString());
      h+=row('Drop-off rate',uf.rate+'%');
      if(uf.daily.length){
        var worst=uf.daily.slice().sort(function(a,b){return b.rate-a.rate;})[0];
        h+=row('Most abandoned puzzle','#'+worst.puzzle_num+' ('+worst.rate+'%)');
        h+=row('Puzzles with starts',uf.daily.length);
      }
      h+='<div class="gp-fun-stat"><strong>'+uf.rate+'%</strong> of players who made a guess never saw the answer.</div>';
    }

  }else if(cardName==='colorscheme'){
    var sc=D.schemeColors,sn=D.schemeNames,su=D.schemeUsage;
    for(var s=0;s<4;s++)
      h+='<div class="gp-stat-row"><span class="gp-stat-label" style="color:'+sc[s].right+';">'+sn[s]+'</span><span class="gp-stat-val" style="color:'+sc[s].right+';">'+su[s]+'%</span></div>';
    var maxIdx=0;for(var s=1;s<4;s++)if(su[s]>su[maxIdx])maxIdx=s;
    h+=row('Most popular','<span style="color:'+sc[maxIdx].right+';">'+sn[maxIdx]+'</span>');
    h+=row('Non-default schemes',(su[1]+su[2]+su[3])+'% of players');
  }
  h+='</div>';
  return h;
}


// ========== DETAIL DATA (fetched per range + country, independent of the grid) ==========
// The grid keeps gpData for gpMainRange. A detail page owns gpDetailData, refetched
// whenever its own range or country changes.
var gpDetailData=null;
var gpDetailLoading=false;
var gpDetailSeq=0;   // guards against a slow earlier request landing after a newer one

function gpFetchDetail(){
  var seq=++gpDetailSeq;
  var range=gpCurrentRange,country=gpDetailCountry;
  gpDetailLoading=true;
  gpRenderDetail();
  gpFetchSet(range,country).then(function(res){
    if(seq!==gpDetailSeq)return;           // a newer selection already won
    gpDetailData=gpNormalize(res,range,country);
    gpDetailLoading=false;
    gpRenderDetail();
  }).catch(function(){
    if(seq!==gpDetailSeq)return;
    gpDetailLoading=false;
    gpRenderDetail();
  });
}

// Everything a detail renderer reads goes through here, so a chart cannot draw the
// grid's range while the header claims a different one.
function gpVD(){return gpDetailData||gpData;}

// ========== OPEN CARD DETAIL ==========
function gpOpenDetail(cardName,opts){
  var cfg=gpCards[cardName];
  if(!cfg)return;
  // Check lock
  if(cfg.lockable&&!over){
    var devForced=document.getElementById('gp-dev-locked')&&document.getElementById('gp-dev-locked').classList.contains('active');
    if(!devForced)return; // locked, don't open
  }
  opts=opts||{};
  gpCurrentCard=cardName;
  gpCurrentGraph=(opts.graph&&cfg.graphTypes.indexOf(opts.graph)>=0)?opts.graph:cfg.graphTypes[0];
  // personal mode only survives on cards that have personal data
  gpCurrentMode=(opts.mode==='P'&&cfg.personal)?'P':'G';
  // inherits the range the grid is showing, so opening a card keeps the same window
  gpCurrentRange=opts.range||gpMainRange;
  gpDetailCountry=(cfg.country&&opts.country)?opts.country:(cfg.country?gpCountryFilter:null);
  gpDetailData=null;
  document.getElementById('global-page').classList.add('gp-in-detail');
  if(!opts.fromHistory)gpPushDetailState(true);
  gpFetchDetail();
  try{window.scrollTo(0,0);}catch(e){}
}

// ========== CLOSE CARD DETAIL (back to grid) ==========
function gpCloseDetail(opts){
  opts=opts||{};
  gpCurrentCard=null;
  gpDetailData=null;
  gpDetailSeq++;                            // orphan any in-flight detail fetch
  document.getElementById('global-page').classList.remove('gp-in-detail');
  document.getElementById('gp-detail-view').innerHTML='';
  if(opts.reset){
    // leaving the stats page entirely: drop the hash without walking history
    gpHistoryDepth=0;
    gpReplaceState('');
  }else if(!opts.fromHistory){
    // prefers real history so the browser Back button and this button agree
    if(gpHistoryDepth>0){gpHistoryDepth--;history.back();}
    else gpReplaceState('');
  }
}

// ========== HISTORY: detail pages are real navigable states ==========
// Each detail view owns a history entry keyed by its hash, so the browser Back button
// returns to the grid instead of leaving the stats page.
var gpHistoryDepth=0;

function gpDetailHash(){
  if(!gpCurrentCard)return '';
  var parts=['card='+gpCurrentCard,'range='+gpCurrentRange,'graph='+gpCurrentGraph];
  if(gpCurrentMode==='P')parts.push('mode=P');
  if(gpDetailCountry)parts.push('country='+gpDetailCountry);
  return '#'+parts.join('&');
}

function gpParseHash(){
  var h=(location.hash||'').replace(/^#/,'');
  if(!h)return null;
  var out={};
  h.split('&').forEach(function(kv){
    var i=kv.indexOf('=');
    if(i>0)out[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1));
  });
  return out.card?out:null;
}

function gpReplaceState(hash){
  try{history.replaceState({gp:hash||''},'',hash||location.pathname+location.search);}catch(e){}
}

function gpPushDetailState(isNew){
  var hash=gpDetailHash();
  try{
    if(isNew){history.pushState({gp:hash},'',hash);gpHistoryDepth++;}
    else history.replaceState({gp:hash},'',hash);
  }catch(e){}
}

window.addEventListener('popstate',function(){
  var st=gpParseHash();
  if(!st){
    if(gpCurrentCard){gpHistoryDepth=0;gpCloseDetail({fromHistory:true});}
    return;
  }
  if(!gpCards[st.card]){return;}
  gpOpenDetail(st.card,{
    range:st.range,graph:st.graph,mode:st.mode,country:st.country,fromHistory:true
  });
});

// deep link straight into a card (shared URL, or a reload while a card was open)
(function(){
  var st=gpParseHash();
  if(st&&gpCards[st.card]){
    gpHistoryDepth=1;
    setTimeout(function(){
      gpOpenDetail(st.card,{range:st.range,graph:st.graph,mode:st.mode,country:st.country,fromHistory:true});
    },0);
  }
})();

// Escape key closes detail view (or modal)
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&gpCurrentCard){
    gpCloseDetail();
  }
});

// ========== RENDER THE FULL DETAIL PAGE ==========
function gpRenderDetail(){
  if(!gpCurrentCard)return;
  var cfg=gpCards[gpCurrentCard];
  var dv=document.getElementById('gp-detail-view');
  var D=gpVD();
  var h='';

  // Header: back + title + country dropdown + P/G toggle. The dropdown and the toggle
  // only appear where they apply to this card.
  h+='<div class="gp-detail-header">';
  h+='<button class="gp-detail-back" id="gp-detail-back-btn" aria-label="Back to stats">'+
     '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
     '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>';
  h+='<div class="gp-detail-title">'+cfg.title+'</div>';
  if(cfg.country&&gpCurrentMode==='G'){
    h+=gpDetailCountryHTML(gpDetailCountry);
  }
  if(cfg.personal){
    h+='<div class="gp-pg-toggle">';
    h+='<button class="gp-pg-btn'+(gpCurrentMode==='P'?' active':'')+'" data-mode="P" title="Your stats">P</button>';
    h+='<button class="gp-pg-btn'+(gpCurrentMode==='G'?' active':'')+'" data-mode="G" title="Global stats">G</button>';
    h+='</div>';
  }
  h+='</div>';

  // a 'fact' card in personal mode has no chart to switch, so hide the graph buttons
  var factMode=(gpCurrentMode==='P'&&cfg.personal==='fact');

  // controls row: graph type left, time range right; omitted entirely in fact mode
  if(!factMode){
    h+='<div class="gp-detail-controls">';
    h+=gpGraphBtnsHTML(cfg.graphTypes,gpCurrentGraph);
    h+=gpTimeFilterHTML(gpCurrentRange);
    h+='</div>';
  }

  // scope line: states which window and which country these numbers cover
  if(!factMode){
    var scopeTxt=gpRangeLabel(gpCurrentRange)+(gpDetailCountry?' · '+gpDetailCountry:' · worldwide');
    var nGames=D.totalGames||0;
    h+='<div class="gp-scope-note">'+scopeTxt+' · '+nGames.toLocaleString()+' game'+(nGames===1?'':'s')+'</div>';
  }

  // Main visualization
  if(factMode){
    h+=gpPersonalHTML(gpCurrentCard);
  }else if(gpDetailLoading&&!gpDetailData){
    h+='<div class="gp-viz"><div class="gp-viz-empty">Loading…</div></div>';
  }else{
    h+='<div class="gp-viz'+(gpDetailLoading?' gp-viz-stale':'')+'">'+gpRenderViz(gpCurrentCard,gpCurrentGraph)+'</div>';
    if(gpCurrentMode==='P')h+=gpPersonalHTML(gpCurrentCard);
  }

  // Extra stats
  if(!factMode&&!(gpDetailLoading&&!gpDetailData))h+=gpDetailExtra(gpCurrentCard);

  dv.innerHTML=h;

  // Wire up detail event handlers
  document.getElementById('gp-detail-back-btn').onclick=function(){gpCloseDetail();};

  // P/G toggle: a mode flip changes what is drawn, not what is fetched
  dv.querySelectorAll('.gp-pg-btn').forEach(function(btn){
    btn.onclick=function(){
      gpCurrentMode=btn.getAttribute('data-mode');
      if(gpCurrentMode==='P')gpDetailCountry=null;
      gpPushDetailState(false);
      gpRenderDetail();
    };
  });

  // country dropdown: refetch, the API filters server-side
  var countrySel=document.getElementById('gp-detail-country-sel');
  if(countrySel){
    countrySel.onchange=function(){
      gpDetailCountry=this.value||null;
      gpPushDetailState(false);
      gpFetchDetail();
    };
  }

  // time range: refetch for the new window
  dv.querySelectorAll('.gp-time-btn').forEach(function(btn){
    btn.onclick=function(){
      if(btn.getAttribute('data-range')===gpCurrentRange)return;
      gpCurrentRange=btn.getAttribute('data-range');
      gpPushDetailState(false);
      gpFetchDetail();
    };
  });

  // graph type buttons: pure re-render, the data is already here
  dv.querySelectorAll('.gp-graph-btn').forEach(function(btn){
    btn.onclick=function(){
      gpCurrentGraph=btn.getAttribute('data-graph');
      gpPushDetailState(false);
      gpRenderDetail();
    };
  });
}

// ========== LOCK STATE ==========
function gpUpdateLockState(){
  var lockCards=document.querySelectorAll('#global-page [data-lockable]');
  var devForced=document.getElementById('gp-dev-locked')&&document.getElementById('gp-dev-locked').classList.contains('active');
  lockCards.forEach(function(c){
    if(devForced||!over){
      c.classList.add('gp-locked');
    }else{
      c.classList.remove('gp-locked');
    }
  });
}

// ========== BONUS SPOILER ==========
function gpUpdateBonusSpoiler(){
  var bonusStats=document.getElementById('gp-bonus-stats');
  var bonusSpoiler=document.getElementById('gp-bonus-spoiler');
  if(!bonusStats||!bonusSpoiler)return;
  var bonusDone=(phase==='done')||(b1over&&b2over);
  if(over&&!bonusDone){
    bonusStats.style.display='none';
    bonusSpoiler.style.display='block';
  }else{
    bonusStats.style.display='block';
    bonusSpoiler.style.display='none';
  }
}

// ========== SHOW / HIDE GLOBAL PAGE ==========
function showGlobalPage(){
  document.getElementById('m-stats').classList.remove('show');
  document.getElementById('m-global').classList.remove('show');
  document.body.classList.add('global-view');
  if(typeof _e!=='undefined'&&_e) document.getElementById('gp-puzzle-name').textContent=_e.name;
  if(typeof _pn!=='undefined') document.getElementById('gp-puzzle-info').textContent='Puzzle #'+_pn+' \u00b7 '+_ds;
  gpUpdateLockState();
  gpUpdateBonusSpoiler();
  gpInitMap();
  gpApplyMapColors();
  gpRenderRankingsCard();
  gpCloseDetail({reset:true});
}
// Map via jsvectormap
var gpMapInitialized=false;
var gpMapInstance=null;

// Build region values object from country data for jsvectormap coloring
function gpBuildRegionValues(){
  var vals={};
  for(var i=0;i<gpData.worldmap.length;i++){
    vals[gpData.worldmap[i].code]={players:gpData.worldmap[i].players};
  }
  return vals;
}

// Get color for a player count (continuous scale)
function gpPlayerColor(players){
  if(players>0)return 'var(--right)';
  return null;
}

// Resolve a CSS color (variable or otherwise) to a hex string
function gpResolveColor(cssColor){
  var d=document.createElement('div');
  d.style.color=cssColor;
  document.body.appendChild(d);
  var c=getComputedStyle(d).color;
  d.remove();
  var m=c.match(/(\d+)/g);
  if(!m||m.length<3)return cssColor;
  return '#'+((1<<24)+(+m[0]<<16)+(+m[1]<<8)+ +m[2]).toString(16).slice(1);
}
function gpMixHex(hex1,hex2,ratio){
  var r1=parseInt(hex1.substr(1,2),16),g1=parseInt(hex1.substr(3,2),16),b1=parseInt(hex1.substr(5,2),16);
  var r2=parseInt(hex2.substr(1,2),16),g2=parseInt(hex2.substr(3,2),16),b2=parseInt(hex2.substr(5,2),16);
  var r=Math.round(r1*ratio+r2*(1-ratio));
  var g=Math.round(g1*ratio+g2*(1-ratio));
  var b=Math.round(b1*ratio+b2*(1-ratio));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
// Get computed hex map colors for current theme
function gpGetMapColors(){
  var right=gpResolveColor('var(--right)');
  var surface=gpResolveColor('var(--surface2)');
  return {high:right, low:surface};
}

function gpInitMap(){
  if(gpMapInitialized)return;
  gpMapInitialized=true;
  if(typeof jsVectorMap==='undefined')return;

  var mapEl=document.getElementById('jvm-map');
  if(!mapEl)return;

  // Compute theme colors
  var cs=getComputedStyle(document.body);
  var bgCol=cs.getPropertyValue('--surface2').trim()||'#1a1a1a';
  var borderCol=cs.getPropertyValue('--bg').trim()||'#000';
  var hoverCol=cs.getPropertyValue('--text3').trim()||'#555';

  gpMapInstance=new jsVectorMap({
    selector:'#jvm-map',
    map:'world',
    backgroundColor:'transparent',
    draggable:true,
    zoomButtons:true,
    zoomOnScroll:true,
    zoomOnScrollSpeed:3,
    zoomMax:12,
    zoomMin:1,
    zoomAnimate:true,
    showTooltip:true,
    focusOn:{x:0.5,y:0.5,scale:1},
    regionStyle:{
      initial:{fill:bgCol,stroke:borderCol,strokeWidth:0.4},
      hover:{fill:hoverCol,cursor:'pointer'},
      selected:{fill:'var(--right)'}
    },
    regionLabelStyle:{initial:{fontFamily:'var(--font-ui)',fontSize:10,fill:'var(--text3)'}},
    onRegionTooltipShow:function(evt,tooltip,code){
      var found=gpData.worldmap.find(function(c){return c.code===code;});
      if(found){
        var ranked=gpGetRankings();
        var r=ranked.find(function(c){return c.code===code;});
        tooltip.css({backgroundColor:'var(--bg)',borderColor:'var(--border)',color:'var(--text)',borderRadius:'10px',padding:'8px 14px',fontFamily:'var(--font-ui)',fontSize:'0.85rem',fontWeight:'600',boxShadow:'0 6px 20px rgba(0,0,0,0.4)'});
        tooltip.text(
          '<strong>'+found.flag+' '+found.name+'</strong><br>'
          +found.players.toLocaleString()+' players<br>'
          +found.avgGuesses+' avg guesses<br>'
          +'Rank #'+(r?r._rank:'--'),
          true
        );
      }
    },
    onRegionClick:function(evt,code){
      // Toggle: if already selected, deselect
      if(gpCountryFilter===code){
        gpCountryFilter=null;
      }else{
        gpCountryFilter=code;
      }
      var sel=document.getElementById('gp-country-select');
      if(sel)sel.value=gpCountryFilter||'';
      gpUpdateMapHighlight();
      gpUpdateAllCards();
    }
  });

  // Touch support for Windows touch (Pointer Events → pinch zoom & drag)
  _gpAddMapTouch(gpMapInstance,'#jvm-map');

}

function _gpAddMapTouch(mapInst,selector){
  var container=document.querySelector(selector);
  if(!container||!mapInst)return;
  var el=container.querySelector('.jvm-container')||container;
  el.style.touchAction='none';

  var pointers={};
  var lastDist=0;
  var lastCenter=null;
  var isPanning=false;
  var panStartX=0,panStartY=0;
  var startTransX=0,startTransY=0;

  el.addEventListener('pointerdown',function(e){
    if(e.pointerType!=='touch')return;
    el.setPointerCapture(e.pointerId);
    pointers[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pointers);
    if(ids.length===1){
      isPanning=true;
      panStartX=e.clientX;
      panStartY=e.clientY;
      startTransX=mapInst.transX||0;
      startTransY=mapInst.transY||0;
    }
  });

  el.addEventListener('pointermove',function(e){
    if(e.pointerType!=='touch'||!pointers[e.pointerId])return;
    pointers[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pointers);

    if(ids.length===2){
      // Pinch zoom
      isPanning=false;
      e.preventDefault();
      var p1=pointers[ids[0]],p2=pointers[ids[1]];
      var dx=p1.x-p2.x,dy=p1.y-p2.y;
      var dist=Math.sqrt(dx*dx+dy*dy);
      var cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2;
      if(lastDist>0){
        var ratio=dist/lastDist;
        var newScale=mapInst.scale*ratio;
        newScale=Math.max(mapInst.params.zoomMin||1,Math.min(mapInst.params.zoomMax||12,newScale));
        var rect=el.getBoundingClientRect();
        mapInst._setScale(newScale,cx-rect.left,cy-rect.top,false,false);
      }
      lastDist=dist;
    } else if(ids.length===1&&isPanning){
      // Single finger pan
      e.preventDefault();
      var deltaX=e.clientX-panStartX;
      var deltaY=e.clientY-panStartY;
      mapInst.transX=startTransX+deltaX/mapInst.scale;
      mapInst.transY=startTransY+deltaY/mapInst.scale;
      mapInst._applyTransform();
    }
  });

  function onUp(e){
    if(e.pointerType!=='touch')return;
    delete pointers[e.pointerId];
    if(Object.keys(pointers).length<2)lastDist=0;
    if(Object.keys(pointers).length===0)isPanning=false;
  }
  el.addEventListener('pointerup',onUp);
  el.addEventListener('pointercancel',onUp);
}

// Resolves a jsvectormap region to its real DOM node. regions[code].element is a Region,
// .shape is an SVGShapeElement whose <path> is .shape.node. The wrapper's own .style is
// the library's config object, not a CSSStyleDeclaration, so every DOM write must go
// through this helper.
function gpRegionNode(region){
  var el=region&&region.element;
  if(el&&el.shape)el=el.shape;
  if(el&&el.node)el=el.node;
  return (el&&el.style&&el.classList)?el:null;   // only a real DOM element passes
}
function gpApplyMapColors(inst,data){
  inst=inst||gpMapInstance;
  data=data||gpData.worldmap;
  if(!inst)return;
  var colors=gpGetMapColors();
  var lookup={};
  var maxP=0;
  for(var i=0;i<data.length;i++){
    lookup[data[i].code]=data[i].players;
    if(data[i].players>maxP) maxP=data[i].players;
  }
  // Use log scale so small countries are still visible
  var logMax=maxP>0?Math.log(maxP+1):1;
  for(var code in inst.regions){
    var node=gpRegionNode(inst.regions[code]);
    if(!node)continue;
    var p=lookup[code]||0;
    if(p>0){
      // 0.12 base so even 1-player countries are visible, scale up to 1.0
      var ratio=0.12+0.88*(Math.log(p+1)/logMax);
      node.style.fill=gpMixHex(colors.high,colors.low,ratio);
    }else{
      node.style.fill='';
    }
  }
}
function hideGlobalPage(){
  document.body.classList.remove('global-view');
  var gp=document.getElementById('global-page');
  gp.style.maxWidth='';gp.classList.remove('gp-mobile-frame');
  gpCloseDetail({reset:true});
}

// ========== MAP HIGHLIGHT ==========
function gpUpdateMapHighlight(){
  var container=document.getElementById('gp-map-container');
  if(!container)return;

  // Update the live counter on the map
  var liveNum=document.getElementById('gp-map-live-num');
  var liveLabel=container.querySelector('.gp-map-live-label');
  if(liveNum&&liveLabel){
    if(gpCountryFilter){
      var found=gpData.worldmap.find(function(c){return c.code===gpCountryFilter;});
      liveNum.textContent=found?found.players.toLocaleString():'--';
      liveLabel.innerHTML='<span class="gp-live-dot"></span> '+(found?found.name:'selected');
    }else{
      liveNum.textContent=(gpData.liveNow||0).toLocaleString();
      liveLabel.innerHTML='<span class="gp-live-dot"></span> playing now';
    }
  }

  // Update jsvectormap region highlighting
  if(!gpMapInstance)return;
  var regions=gpMapInstance.regions;
  for(var code in regions){
    var el=gpRegionNode(regions[code]);   // same wrapper trap as gpApplyMapColors
    if(!el)continue;
    el.classList.remove('gp-jvm-selected','gp-jvm-dimmed');
    if(!gpCountryFilter)continue;
    if(code===gpCountryFilter){
      el.classList.add('gp-jvm-selected');
    }else{
      el.classList.add('gp-jvm-dimmed');
    }
  }
}

// ========== MAP MODE (Global vs Personal) ==========
function gpUpdateMapMode(){
  if(!gpMapInstance)return;
  var liveNum=document.getElementById('gp-map-live-num');
  var liveLabel=document.querySelector('#gp-map-container .gp-map-live-label');
  var legend=document.getElementById('gp-map-legend');

  if(gpMainMode==='P'){
    // personal mode: show countries the player has played from
    var countries=[];
    try{countries=JSON.parse(localStorage.getItem('wi_countries'))||[];}catch(e){}
    var playedSet={};
    for(var i=0;i<countries.length;i++) playedSet[countries[i]]=true;

    var rightCol=gpResolveColor('var(--right)');
    for(var code in gpMapInstance.regions){
      var el=gpRegionNode(gpMapInstance.regions[code]);   // same wrapper trap
      if(!el)continue;
      el.classList.remove('gp-jvm-selected','gp-jvm-dimmed');
      el.style.fill=playedSet[code]?rightCol:'';
    }

    if(liveNum)liveNum.textContent=countries.length;
    if(liveLabel)liveLabel.innerHTML='<span class="gp-live-dot"></span> '+(countries.length===1?'country played':'countries played');

    if(legend){
      legend.innerHTML='<span><span class="gp-map-legend-dot" style="background:var(--right);"></span> Played from</span>'
        +'<span><span class="gp-map-legend-dot" style="background:var(--surface2);border:1px solid var(--border);"></span> Not visited</span>';
    }
  }else{
    // Global mode: reapply heat map colors
    gpApplyMapColors();
    gpUpdateMapHighlight();
    if(legend){
      legend.innerHTML='<span><span class="gp-map-legend-dot" style="background:var(--right);"></span> Most</span>'
        +'<span><span class="gp-map-legend-dot" style="background:color-mix(in srgb,var(--right) 50%,var(--surface2));"></span> Mid</span>'
        +'<span><span class="gp-map-legend-dot" style="background:color-mix(in srgb,var(--right) 15%,var(--surface2));"></span> Few</span>'
        +'<span><span class="gp-map-legend-dot" style="background:var(--surface2);border:1px solid var(--border);"></span> No data</span>';
    }
  }
}

// ========== COUNTRY DROPDOWN CHANGE ==========
var _gpCountrySel=document.getElementById('gp-country-select');
if(_gpCountrySel)_gpCountrySel.onchange=function(){
  gpCountryFilter=this.value||null;
  gpUpdateMapHighlight();
  gpUpdateAllCards();
};
// These elements only exist when stats is embedded in the game page
var _btnGlobal=document.getElementById('btn-global');
if(_btnGlobal)_btnGlobal.onclick=showGlobalPage;
var _btnGlobalStats=document.getElementById('btn-global-stats');
if(_btnGlobalStats)_btnGlobalStats.onclick=showGlobalPage;
var _xGlobal=document.getElementById('x-global');
if(_xGlobal)_xGlobal.onclick=function(){document.getElementById('m-global').classList.remove('show');};
var _gpBack=document.getElementById('gp-back');
if(_gpBack)_gpBack.onclick=hideGlobalPage;

// ========== CARD CLICK -> OPEN DETAIL ==========
document.querySelectorAll('#global-page .gp-card[data-card]').forEach(function(card){
  card.onclick=function(e){
    // Don't open if clicking the lock overlay button
    if(e.target.classList.contains('gp-lock-btn'))return;
    var cn=card.getAttribute('data-card');
    if(cn==='worldmap')return;
    gpOpenDetail(cn);
  };
});

// ========== BONUS SKIP BUTTON ==========
(function(){
  var skipBtn=document.getElementById('gp-bonus-skip');
  if(skipBtn){
    skipBtn.onclick=function(e){
      e.stopPropagation(); // prevent card click
      b1over=true;b1won=false;b2over=true;b2won=false;
      recB1(false);recB2(false);
      _trackB1('skip');_trackB2('skip');
      phase='done';saveSt();
      gpUpdateBonusSpoiler();
      gpUpdateLockState();
    };
  }
})();

// ========== DEV TOOLBAR (only when elements exist) ==========
(function(){
  var dd=document.getElementById('gp-dev-desktop');
  var dm=document.getElementById('gp-dev-mobile');
  var dl=document.getElementById('gp-dev-locked');
  var dr=document.getElementById('gp-dev-reset');
  var dc=document.getElementById('gp-dev-close');
  if(dd)dd.onclick=function(){
    var gp=document.getElementById('global-page');
    gp.style.maxWidth='';gp.classList.remove('gp-mobile-frame');
    dd.classList.add('active');dm.classList.remove('active');
  };
  if(dm)dm.onclick=function(){
    var gp=document.getElementById('global-page');
    gp.style.maxWidth='390px';gp.classList.add('gp-mobile-frame');
    dm.classList.add('active');dd.classList.remove('active');
  };
  if(dl)dl.onclick=function(){this.classList.toggle('active');gpUpdateLockState();};
  if(dr)dr.onclick=function(){gpCloseDetail({reset:true});};
  if(dc)dc.onclick=function(){document.getElementById('gp-dev-bar').style.display='none';};
  // Font color toggle (dev only)
  var fontBtns=['gp-dev-font1','gp-dev-font2','gp-dev-font3'];
  var gp=document.getElementById('global-page');
  fontBtns.forEach(function(id,idx){
    var el=document.getElementById(id);
    if(!el)return;
    el.onclick=function(){
      fontBtns.forEach(function(b){var e=document.getElementById(b);if(e)e.classList.remove('active');});
      this.classList.add('active');
      gp.classList.remove('gp-font-original','gp-font-white');
      if(idx===0) gp.classList.add('gp-font-original');
      else if(idx===2) gp.classList.add('gp-font-white');
    };
  });
})();

// ========== GLOBAL P/G + TIME RANGE CONTROLS ==========
// (gpMainMode and gpMainRange declared + restored at top of file)

// Apply saved state to buttons now that DOM exists
(function(){
  var pgBtns=document.querySelectorAll('#gp-main-pg .gp-pg-btn');
  pgBtns.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-mode')===gpMainMode);});
  var timeBtns=document.querySelectorAll('#gp-main-time .gp-time-btn');
  timeBtns.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-range')===gpMainRange);});
})();

function gpSavePrefs(){
  try{localStorage.setItem('wi_gp_prefs',JSON.stringify({mode:gpMainMode,range:gpMainRange}));}catch(e){}
}

// P/G toggle
document.querySelectorAll('#gp-main-pg .gp-pg-btn').forEach(function(btn){
  btn.onclick=function(){
    gpMainMode=btn.getAttribute('data-mode');
    document.querySelectorAll('#gp-main-pg .gp-pg-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');

    // Country dropdown: hide in Personal mode, show in Global mode
    var countrySelect=document.getElementById('gp-country-select');
    if(gpMainMode==='P'){
      countrySelect.style.display='none';
      gpCountryFilter=null;
      countrySelect.value='';
    }else{
      countrySelect.style.display='';
    }

    gpSavePrefs();
    gpUpdateMapMode();
    gpUpdateAllCards();
  };
});

// Time range buttons - re-fetch data for selected range
document.querySelectorAll('#gp-main-time .gp-time-btn').forEach(function(btn){
  btn.onclick=function(){
    gpMainRange=btn.getAttribute('data-range');
    document.querySelectorAll('#gp-main-time .gp-time-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    gpSavePrefs();
    // Re-fetches everything for the new range through the one shared path, so every
    // range-aware card updates together.
    gpFetchAll();
  };
});

// Update all summary cards based on current mode/range
function gpUpdateAllCards(){
  var modeLabel=gpMainMode==='P'?'Your':'Global';
  var rangeLabel=gpMainRange;

  // Always update rankings card
  gpRenderRankingsCard();

  // If country is filtered, update stat cards with that country's data
  var countryData=null;
  if(gpCountryFilter){
    countryData=gpData.worldmap.find(function(c){return c.code===gpCountryFilter;});
  }

  // Update live counter label
  var liveLabel=document.querySelector('#gp-live-count + .gp-big-label');
  var liveNum=document.getElementById('gp-live-count');
  if(countryData&&gpMainMode==='G'){
    if(liveNum)liveNum.textContent=countryData.players.toLocaleString();
    if(liveLabel)liveLabel.textContent='players from '+countryData.name;
  }else if(gpMainMode==='P'){
    // personal mode: show the player's play count
    try{
      var s=JSON.parse(localStorage.getItem('wi_stats'));
      if(liveNum)liveNum.textContent=s&&s.p?(s.p).toLocaleString():'0';
      if(liveLabel)liveLabel.textContent='games you played';
    }catch(e){if(liveNum)liveNum.textContent='0';}
  }else{
    if(liveNum)liveNum.textContent=(gpData.liveNow||0).toLocaleString();
    if(liveLabel)liveLabel.textContent='playing now';
  }

  // Update win rate
  var winCard=document.querySelector('[data-card="winrate"] .gp-big-num');
  var winLabel=document.querySelector('[data-card="winrate"] .gp-big-label');
  if(gpMainMode==='P'&&winCard&&winLabel){
    try{
      var s=JSON.parse(localStorage.getItem('wi_stats'));
      if(s&&s.p>0){
        winCard.textContent=Math.round(s.w/s.p*100)+'%';
        winLabel.textContent='your win rate';
      }else{
        winCard.textContent='--';
        winLabel.textContent='no games played yet';
      }
    }catch(e){winCard.textContent='--';}
  }else if(countryData&&winCard&&winLabel){
    winCard.textContent=countryData.winRate+'%';
    winLabel.textContent=countryData.name+"'s win rate";
  }else if(winCard&&winLabel){
    // Use real data from API
    var gamesDist=gpData.totalGames||0;
    var realWr=gamesDist>0?Math.round((gpData.totalWins||0)/gamesDist*100):0;
    winCard.textContent=gamesDist>0?realWr+'%':'--';
    winLabel.textContent="overall win rate";
  }

  // Update guess dist sub-label with country info
  var distSub=document.querySelector('[data-card="guessdist"] .gp-big-sub');
  if(countryData&&gpMainMode==='G'&&distSub){
    distSub.textContent=countryData.name+': '+countryData.avgGuesses+' avg guesses';
  }else if(distSub&&gpMainMode==='P'){
    // Personal mode handled below
  }else if(distSub){
    // Find most common guess from real data
    var maxG=1,maxV=0;
    var totalG=0;
    for(var g=1;g<=6;g++){var gv=gpData.guessDist[g]||0;totalG+=gv;if(gv>maxV){maxV=gv;maxG=g;}}
    var pct=totalG>0?Math.round(maxV/totalG*100):0;
    distSub.textContent='Most common: '+maxG+' guess'+(maxG>1?'es':'')+' ('+pct+'%)';
  }

  // Update guess dist for personal mode
  var distCard=document.querySelector('[data-card="guessdist"] .gp-mini-bars');
  if(gpMainMode==='P'&&distCard){
    try{
      var s=JSON.parse(localStorage.getItem('wi_stats'));
      if(s&&s.d){
        var maxD=Math.max(s.d[1]||0,s.d[2]||0,s.d[3]||0,s.d[4]||0,s.d[5]||0,s.d[6]||0,1);
        var bars=distCard.querySelectorAll('.gp-mini-bar');
        for(var i=0;i<6;i++){
          var v=s.d[i+1]||0;
          if(bars[i])bars[i].style.height=Math.max(3,v/maxD*100)+'%';
        }
        if(distSub){
          var pMaxG=1,pMaxV=0,pTotal=0;
          for(var g=1;g<=6;g++){var gv=s.d[g]||0;pTotal+=gv;if(gv>pMaxV){pMaxV=gv;pMaxG=g;}}
          var pPct=pTotal>0?Math.round(pMaxV/pTotal*100):0;
          distSub.textContent='Your most common: '+pMaxG+' guess'+(pMaxG>1?'es':'')+' ('+pPct+'%)';
        }
      }
    }catch(e){}
  }else if(distCard){
    // Use real API distribution data
    var mx=Math.max(1,gpData.guessDist[1],gpData.guessDist[2],gpData.guessDist[3],gpData.guessDist[4],gpData.guessDist[5],gpData.guessDist[6]);
    var bars=distCard.querySelectorAll('.gp-mini-bar');
    for(var i=0;i<6;i++){if(bars[i])bars[i].style.height=Math.max(2,(gpData.guessDist[i+1]/mx)*100)+'%';}
  }

  // Update streaks for personal mode
  var streakCard=document.querySelector('[data-card="streaks"]');
  if(gpMainMode==='P'&&streakCard){
    try{
      var s=JSON.parse(localStorage.getItem('wi_stats'));
      if(s){
        var vals=streakCard.querySelectorAll('.gp-mini-val');
        if(vals[0])vals[0].textContent=(s.s||0)+'d';
        if(vals[1])vals[1].textContent=(s.m||0)+'d';
        if(vals[2])vals[2].textContent=s.p>0?Math.round(s.w/s.p*100)+'%':'--';
      }
    }catch(e){}
    var labels=streakCard.querySelectorAll('.gp-mini-label');
    if(labels[0])labels[0].textContent='Your Streak';
    if(labels[1])labels[1].textContent='Your Best';
    if(labels[2])labels[2].textContent='Your Win %';
  }else if(streakCard){
    // streak data, scoped to the selected range
    var vals=streakCard.querySelectorAll('.gp-mini-val');
    var onStreak=(gpData.streakBuckets||[]).reduce(function(a,b){return a+(b.count||0);},0);
    if(vals[0])vals[0].textContent=gpData.avgStreak?gpData.avgStreak+'d':'--';
    if(vals[1])vals[1].textContent=gpData.longestStreak?gpData.longestStreak+'d':'--';
    if(vals[2])vals[2].textContent=gpData.totalGames>0?Math.round(onStreak/gpData.totalGames*100)+'%':'--';
    var labels=streakCard.querySelectorAll('.gp-mini-label');
    if(labels[0])labels[0].textContent='Avg Streak';
    if(labels[1])labels[1].textContent='Longest';
    if(labels[2])labels[2].textContent='On a Streak';
  }
}