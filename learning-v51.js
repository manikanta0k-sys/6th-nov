/* Crypto IDX Learning Monitor V3 · free, local, demo research only.
 * All automatic WIN/LOSS rows are visual pattern comparisons from the
 * user-shared chart, NEVER broker settlement records or real-money results.
 * Predictions are frozen before the target candle starts. No network calls.
 */
(() => {
  'use strict';
  const VERSION = 'v5.1-multiasset-1m2m';
  const MS = 60000;
  const id = name => document.getElementById(name);
  const v3 = {
    db: null, ready: false, persistent: false, signals: new Map(), candles: new Map(),
    session: 'session-' + Date.now(), lastCandleSlot: 0, lastPaint: 0,
    cooldownUntil: 0, lastSavedAt: 0, learningNote: '', lastCrop: '',
    stats: {won:0,lost:0,open:0,verified:0}, updatedAt:0
  };

  function status(msg, severity='warn') {
    id('v3Sync').textContent = msg;
    id('v3Sync').className = 'badge '+severity;
  }
  function fmt(t) {
    return new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', day:'2-digit', month:'short', hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
  }
  function time(t) {
    return new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
  }
  function compactCrop() {
    const c = s.crop;
    return [c.x,c.y,c.w,c.h].map(x=>Math.round(x*1000)).join('-');
  }
  function signature(v, h, direction) {
    // A bounded, inspectable regime key, rather than a claim of "self-learning AI".
    const majority = Math.max(v.up,v.down) >= 8 ? '8' : '7';
    const state = v.overExtended ? 'stretched' : v.absMove < .15 ? 'flat' : 'normal';
    return [getAsset(),h+'m',direction,majority,state,v.lastColor].join('|');
  }
  function historical(key, now=Date.now()) {
    const rows=[...v3.signals.values()].filter(r=>r.signature===key && (r.asset||'Crypto IDX')===getAsset() && r.resultAt && r.resultAt<now && r.resultAt>now-60*86400000);
    const recent=rows.sort((a,b)=>b.resultAt-a.resultAt).slice(0,80);
    const usable=recent.filter(r=>['WIN','LOSS'].includes(r.brokerOutcome||r.visualOutcome));
    const wins=usable.filter(r=>(r.brokerOutcome||r.visualOutcome)==='WIN').length;
    return {wins,losses:usable.length-wins,total:usable.length,ratio:usable.length?wins/usable.length:null,
      latestLoss:usable.find(r=>(r.brokerOutcome||r.visualOutcome)==='LOSS')||null};
  }
  function filterDirectional(sig, horizon, v) {
    if(sig.dir==='WAIT') return sig;
    if(s.mode!=='live') return {dir:'WAIT',why:'Live chart share required; screenshots never create demo signals.'};
    if(!id('clockSynced').checked) return {dir:'WAIT',why:'Confirm chart 1m clock alignment before analysis.'};
    if(!v3.ready) return {dir:'WAIT',why:'Loading prior demo observations.'};
    const now=Date.now();
    if(now<v3.cooldownUntil) return {dir:'WAIT',why:'Post-loss pause: '+Math.ceil((v3.cooldownUntil-now)/60000)+' min remaining.'};
    const key=signature(v,horizon,sig.dir);
    const p=historical(key,now);
    if(p.latestLoss && now-p.latestLoss.resultAt < 10*MS)
      return {dir:'WAIT',why:'Mistake filter: same visual pattern recently lost; temporarily blocked.'};
    if(p.total>=12 && p.ratio<.45)
      return {dir:'WAIT',why:'History filter: '+p.wins+'/'+p.total+' matches for this pattern; blocked due to poor observed result.'};
    return {...sig,why:sig.why+' · Historical visual checks for this pattern: '+p.total};
  }

  // Wrap the existing V2 signal gates, preserving its conservative WAIT rules.
  const baseSignal = selectSignal;
  selectSignal = (v,gate,h) => filterDirectional(baseSignal(v,gate,h),h,v);
  const baseSwitch = switchMode;
  switchMode = function(mode) {
    baseSwitch(mode);
    v3.session='session-'+Date.now();
    v3.lastCandleSlot=0;
    v3.lastCrop=compactCrop();
    if(mode!=='live') status(mode==='image'?'One-time image — no automatic result':'Monitor stopped · no broker sync');
  };

  function openDb() {
    if(!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('crypto-idx-chart-research-v3',1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('signals'))db.createObjectStore('signals',{keyPath:'id'});
        if(!db.objectStoreNames.contains('candles'))db.createObjectStore('candles',{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  function allRecords(store) {
    if(!v3.db)return Promise.resolve([]);
    return new Promise((resolve,reject)=>{
      const tx=v3.db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }
  function put(store,row) {
    if(!v3.db)return Promise.resolve(false);
    return new Promise(resolve=>{
      try {
        const tx=v3.db.transaction(store,'readwrite');
        tx.objectStore(store).put(row);
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>{status('History write failed: browser storage may be full. Export JSON.','bad');resolve(false)};
      }catch(e){status('Unable to save history: '+e.message,'bad');resolve(false)}
    });
  }
  function removeAll(store) {
    if(!v3.db)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const tx=v3.db.transaction(store,'readwrite');tx.objectStore(store).clear();
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }
  async function initialize() {
    try {
      v3.db=await openDb();
      const [signals,candles]=await Promise.all([allRecords('signals'),allRecords('candles')]);
      signals.forEach(r=>{if(r&&typeof r.id==='string'){r.asset=r.asset||'Crypto IDX';v3.signals.set(r.id,r)}});
      candles.forEach(r=>{if(r&&typeof r.id==='string'){r.asset=r.asset||'Crypto IDX';v3.candles.set(r.id,r)}});
      v3.persistent=!!v3.db;
      id('v3Db').textContent = v3.persistent?'Saved locally · IndexedDB':'Memory only · export before closing';
      id('v3Db').className='badge '+(v3.persistent?'good':'bad');
      const now=Date.now();
      for(const r of v3.signals.values()){
        if(r.stage==='PENDING' && (r.expiry+35000<now || r.session!==v3.session)){
          r.stage='UNVERIFIED';r.visualOutcome='UNVERIFIED';r.note='Monitor session interrupted; chart outcome not verified';r.resultAt=now;
          await put('signals',r);
        }
      }
      const losses=[...v3.signals.values()].filter(r=>(r.asset||'Crypto IDX')===getAsset()&&(r.brokerOutcome||r.visualOutcome)==='LOSS'&&r.resultAt>now-4*MS);
      if(losses.length) v3.cooldownUntil=Math.max(...losses.map(x=>x.resultAt))+4*MS;
    }catch(e){v3.persistent=false;id('v3Db').textContent='Storage unavailable · memory only';status('Browser local database unavailable: '+e.message,'warn')}
    v3.ready=true;
    paint(true);
  }

  function sameSource(parsed,r,now) {
    if(!id('clockSynced').checked)return 'Clock confirmation disabled';
    if(s.mode!=='live'||r.session!==v3.session)return 'Live session changed or screen share stopped';
    if(r.crop!==compactCrop())return 'Chart crop changed after prediction';
    if((r.asset||'Crypto IDX')!==getAsset())return 'Chart asset changed after prediction';
    if(now-s.lastFrame>4000)return 'Video frames are stale';
    if(s.lastMotion && now-s.lastMotion>45000)return 'Shared chart appears paused';
    if(parsed.bars.length<25 || parsed.quality<78)return 'Candle recognition quality too low';
    if(s.stableCount<3)return 'Not enough consecutive stable frames';
    if(now<r.expiry+8500)return 'Awaiting fully closed candle';
    if(now>r.expiry+35000)return 'Observation arrived too late; would risk candle misalignment';
    // Before prediction the immediately-running candle has not closed yet.
    // By expiry, h predicted candles PLUS that initial candle should have
    // closed. Require their visible-color sequence to roll forward h+1 bars.
    const before=r.features?.last24Colors||'';
    const after=parsed.bars.slice(-25,-1).map(c=>c.color).join('');
    const shift=r.horizon+1;
    if(before.length!==24||after.length!==24)
      return 'Cannot verify 24-bar sequence alignment';
    let aligned=0;
    for(let k=0;k<24-shift;k++)if(before[k+shift]===after[k])aligned++;
    // A visual chart is not a timestamped price feed. This is only a
    // consistency check; same-color streaks can match by chance.
    if(aligned/(24-shift)<.85)
      return 'Observed candles do not align with expected time shift';
    return null;
  }
  function visualCheck(parsed,h) {
    const a=parsed.bars.slice(0,-1);
    if(a.length<24 || parsed.quality<78)return {result:'UNVERIFIED',note:'Insufficient completed bar detection'};
    const last=a.at(-1);
    if(h===1){
      if(last.body<4)return {result:'TIE',note:'Near-doji: visible candle body too small to decide'};
      return {direction:last.color==='G'?'UP':'DOWN',note:'Last inferred completed 1m candle body color (chart pixels only)'};
    }
    const first=a.at(-h);
    if(!first)return {result:'UNVERIFIED',note:'Need '+h+' completed candles'};
    const delta=last.close-first.open;
    if(Math.abs(delta)<4)return {result:'TIE',note:h+'m visible open-close displacement too small'};
    return {direction:delta>0?'UP':'DOWN',note:h+' completed 1m candle bodies: first visual open → last visual close'};
  }
  function possibleMistake(r) {
    const f=r.features||{};
    const notes=[];
    if(f.overExtended)notes.push('extended trend / reversal exposure');
    if(f.lastColor && ((f.lastColor==='G')!==(r.direction==='UP')))notes.push('last closed candle opposed signal');
    if(f.absMove!=null && f.absMove<.2)notes.push('weak last-candle movement / sideways chop');
    if(f.quality<85)notes.push('low chart pixel-detection margin');
    if(f.up>=7&&f.down===0||f.down>=7&&f.up===0)notes.push('strong consensus still failed: indicator correlation');
    return notes.length?notes.join('; '):'unexplained 1m/2m change; no reliable cause from pixels';
  }
  async function settle(parsed,now) {
    for(const r of v3.signals.values()) {
      if(r.stage!=='PENDING'||now<r.expiry+8500)continue;
      const reason=sameSource(parsed,r,now);
      if(reason){
        if(now<=r.expiry+35000 && !/session changed|crop changed|clock confirmation disabled/i.test(reason))continue;
        r.stage='UNVERIFIED';r.visualOutcome='UNVERIFIED';r.resultAt=now;r.note=reason;
      }else{
        const o=visualCheck(parsed,r.horizon);
        r.resultAt=now;
        r.visualDirection=o.direction||null;
        r.visualOutcome=o.result||((o.direction===r.direction)?'WIN':'LOSS');
        r.stage=r.visualOutcome;
        r.note=o.note;
        if(r.visualOutcome==='LOSS'){
          r.mistakeHypothesis=possibleMistake(r);
          v3.cooldownUntil=Math.max(v3.cooldownUntil,now+4*MS);
        }
      }
      await put('signals',r);
      const final=r.visualOutcome;
      id('v3Last').textContent=fmt(r.start)+' · '+r.horizon+'m · '+r.direction+' → '+final+
        (r.visualDirection?' ('+r.visualDirection+' candle)':'')+' · '+r.note;
      v3.updatedAt=now;
    }
  }
  async function logClosedCandle(parsed,now) {
    const m=Math.floor(now/MS)*MS;
    if(v3.lastCandleSlot===m)return;
    const sec=Math.floor((now-m)/1000);
    if(sec<10||sec>30)return;
    v3.lastCandleSlot=m;
    if(parsed.quality<70||parsed.bars.length<25 || !id('autoJournal').checked) return;
    const a=parsed.bars.slice(0,-1);
    const recent=a.slice(-24).map(c=>({color:c.color,open:Math.round(c.open),close:Math.round(c.close),body:Math.round(c.body)}));
    const r={id:getAsset()+'|'+String(m-MS),asset:getAsset(),observedAt:now,assumedMinuteStart:m-MS,mode:'chart pixels',
      quality:parsed.quality,barCount:parsed.bars.length,crop:compactCrop(),
      visibleColor:a.at(-1)?.color||'?',body:a.at(-1)?.body||0,
      recentBars:recent,source:'user-shared Binomo '+getAsset()+' 1m chart (unverified visual pixels)',
      note:'Minute and bar identity inferred from user clock confirmation; not an OHLC feed'};
    v3.candles.set(r.id,r);
    await put('candles',r);
  }
  function reportFeatures(a,parsed,v) {
    return {quality:parsed.quality,visibleBars:parsed.bars.length,up:v.up,down:v.down,flat:v.flat,
      overExtended:!!v.overExtended,absMove:Math.round(v.absMove*1000)/1000,
      lastColor:v.lastColor,green:v.green,red:v.red,
      slope:Math.round(v.slope),rsiProxy:Math.round(v.r),
      last24Colors:parsed.bars.slice(-25,-1).map(c=>c.color).join(''),
      votes:v.out.map(x=>({name:x.name,dir:x.dir}))};
  }
  async function lockNewSignals(parsed,now) {
    if(!id('autoJournal').checked||s.mode!=='live'||!id('clockSynced').checked) return;
    const sec=new Date(now).getSeconds();
    if(sec<44||sec>56)return;
    const a=s.lastAnalysis;
    if(!a||now-a.at>4000||parsed.quality<70||parsed.bars.length<25)return;
    const start=Math.floor(now/MS)*MS+MS;
    const twoStart=Math.floor(now/(2*MS))*(2*MS)+2*MS;
    // Always save the first admissible decision before the target starts;
    // never replace it with a later, more accurate-looking decision.
    for(const [h,dir] of [[1,a.one],[2,a.four]]) {
      const targetStart=h===1?start:twoStart;
      if(h===2 && targetStart-now>MS+7000)continue; // save 2m hypotheses only just before an even-minute 2m boundary
      const key=getAsset()+'|'+String(targetStart)+'-'+h+'m';
      if(v3.signals.has(key))continue;
      const isSignal=['UP','DOWN'].includes(dir)&&!a.gate;
      const row={id:key,version:VERSION,createdAt:now,asset:getAsset(),source:'Binomo '+getAsset()+' user-shared chart pixels',
        session:v3.session,crop:compactCrop(),start:targetStart,expiry:targetStart+h*MS,horizon:h,direction:dir,
        stage:isSignal?'PENDING':'SKIPPED',visualOutcome:null,brokerOutcome:null,visualDirection:null,
        features:reportFeatures(a,parsed,a.v),signature:isSignal?signature(a.v,h,dir):null,
        reason:isSignal?'Pre-candle decision locked; awaiting subsequent chart':a.gate||'Uncertain or filtered directional vote',
        note:isSignal?'No real-money trade has been placed':'Skipped · WAIT',resultAt:null};
      v3.signals.set(key,row);
      await put('signals',row);
    }
  }
  let working=false;
  async function onFrame(parsed) {
    if(!v3.ready||working)return;
    working=true;
    try {
      const now=Date.now();
      v3.lastCrop=compactCrop();
      id('v3Refresh').textContent='↻ Frame '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(now))+' · ~2s scan';
      id('v3Refresh').className='badge '+(s.mode==='live'?'good':'warn');
      if(s.mode!=='live') {status('Static image · auto check off');return;}
      if(!id('clockSynced').checked) {status('WAIT · confirm clock match');return;}
      if(parsed.quality<70||parsed.bars.length<25) {status('WAIT · low chart quality');return;}
      if(s.lastMotion&&now-s.lastMotion>45000) {status('WAIT · chart stopped changing');return;}
      status('LIVE · chart visual proxy only','good');
      await settle(parsed,now);
      await logClosedCandle(parsed,now);
      await lockNewSignals(parsed,now);
      paint();
    }catch(e){status('Auto-research error: '+e.message,'bad')}
    finally{working=false}
  }
  const originalRender = renderAnalysis;
  renderAnalysis = function(parsed) {
    originalRender(parsed);
    onFrame(parsed);
  };

  function cell(tr,t,cls='') {
    const td=document.createElement('td');td.textContent=String(t??'—');if(cls)td.className=cls;tr.append(td);return td;
  }
  function badgeClass(o){return o==='WIN'?'pill win':o==='LOSS'?'pill loss':'pill wait'}
  function drawTable() {
    const body=id('v3Table');body.replaceChildren();
    const rows=[...v3.signals.values()].filter(r=>(r.asset||'Crypto IDX')===getAsset()).sort((a,b)=>b.start-a.start||a.horizon-b.horizon).slice(0,75);
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No verified live chart predictions saved for this asset. Screenshot mode stores observations, not WIN/LOSS.';tr.append(td);body.append(tr);return}
    for(const r of rows){
      const tr=document.createElement('tr');
      cell(tr,fmt(r.start));cell(tr,r.horizon+'m');cell(tr,r.direction);
      cell(tr,r.visualOutcome||r.stage,badgeClass(r.visualOutcome||r.stage));
      const td=document.createElement('td');const sel=document.createElement('select');
      sel.setAttribute('aria-label','Manual broker demo result for '+fmt(r.start)+' '+r.horizon+' minutes');
      [['','Not reviewed'],['WIN','Confirm WIN'],['LOSS','Confirm LOSS'],['TIE','Confirm TIE'],['VOID','Void / unsure']].forEach(([k,v])=>{
        const o=document.createElement('option');o.value=k;o.textContent=v;if(r.brokerOutcome===k)o.selected=true;sel.append(o)
      });
      sel.addEventListener('change',async()=>{
        r.brokerOutcome=sel.value||null;r.brokerReviewedAt=Date.now();
        await put('signals',r);paint(true);
      });td.append(sel);tr.append(td);
      cell(tr,r.stage==='SKIPPED'?r.reason:(r.mistakeHypothesis?'Possible mistake: '+r.mistakeHypothesis:(r.note||r.reason)));
      body.append(tr);
    }
  }
  function paint(force=false) {
    const now=Date.now();
    if(!force&&now-v3.lastPaint<2900)return;
    v3.lastPaint=now;
    const rows=[...v3.signals.values()].filter(r=>(r.asset||'Crypto IDX')===getAsset());
    const wins=rows.filter(r=>r.visualOutcome==='WIN').length;
    const losses=rows.filter(r=>r.visualOutcome==='LOSS').length;
    const open=rows.filter(r=>r.stage==='PENDING'||r.stage==='UNVERIFIED').length;
    const confirmed=rows.filter(r=>['WIN','LOSS','TIE'].includes(r.brokerOutcome)).length;
    id('v3Wins').textContent=wins;id('v3Losses').textContent=losses;
    id('v3Pending').textContent=open;id('v3Verified').textContent=confirmed;
    id('v3Rate').textContent=(wins+losses)?(wins/(wins+losses)*100).toFixed(1)+'%':'—';
    id('v3Candles').textContent=v3.candles.size.toLocaleString('en-IN');
    if(v3.cooldownUntil>now){
      id('v3Cooldown').textContent='After loss · WAIT '+Math.ceil((v3.cooldownUntil-now)/1000)+'s';
      id('v3Cooldown').className='badge bad';
    } else {
      const lastLoss=rows.filter(r=>r.visualOutcome==='LOSS').sort((a,b)=>b.resultAt-a.resultAt)[0];
      id('v3Cooldown').textContent='Mistake filter active'+(lastLoss?' · most recent loss logged':' · waiting for cases');
      id('v3Cooldown').className='badge';
    }
    const candidates=rows.filter(r=>r.signature&&(r.visualOutcome==='WIN'||r.visualOutcome==='LOSS')).sort((a,b)=>b.resultAt-a.resultAt);
    const unique=[...new Set(candidates.map(r=>r.signature))];
    const poor=unique.map(k=>({k,p:historical(k,now)})).filter(x=>x.p.total>=12&&x.p.ratio<.45);
    const lastLoss=rows.filter(r=>r.visualOutcome==='LOSS').sort((a,b)=>b.resultAt-a.resultAt)[0];
    id('v3Learning').textContent=poor.length?
      'Learned WAIT filters: '+poor.length+' underperforming chart-pattern buckets ('+poor.slice(0,2).map(x=>x.k+' '+x.p.wins+'/'+x.p.total).join(', ')+'). This does not prevent all mistakes.':
      lastLoss?'Recent mismatch recorded · possible cause: '+(lastLoss.mistakeHypothesis||'unknown')+'. The same bucket is paused for 10m; new patterns need 12 samples for an extended filter.':
      'Learning: no verified visual LOSS yet. At least 12 eligible outcomes per pattern are required before a long-term pattern block is used.';
    drawTable();
  }
  function download(filename,txt,type) {
    const url=URL.createObjectURL(new Blob([txt],{type}));
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function csvSafe(x) {
    const text=String(x??'');
    const value=/^\s*[=+@\-]/.test(text)?"'"+text:text;
    return '"'+value.replace(/"/g,'""')+'"';
  }
  id('v3Csv').addEventListener('click',()=>{
    const head=['ID','Asset','Target IST','Target ISO','Horizon min','Frozen at ISO','Bias','Visual outcome','Broker reviewed','Visual direction','Possible mistake','Source','Rules','Up votes','Down votes','Quality','Last 24 colors','Note'];
    const records=[...v3.signals.values()].sort((a,b)=>a.start-b.start).map(r=>[
      r.id,r.asset||'Crypto IDX',fmt(r.start),new Date(r.start).toISOString(),r.horizon,new Date(r.createdAt).toISOString(),r.direction,
      r.visualOutcome||r.stage,r.brokerOutcome||'',r.visualDirection||'',r.mistakeHypothesis||'',r.source,r.version,
      r.features?.up,r.features?.down,r.features?.quality,r.features?.last24Colors,r.note||r.reason]);
    download('binomo-v5-demo-signals.csv',[head,...records].map(a=>a.map(csvSafe).join(',')).join('\r\n'),'text/csv');
  });
  id('v3Backup').addEventListener('click',()=>{
    const backup={format:'crypto-idx-visual-research',version:3,createdAt:new Date().toISOString(),
      warning:'Visual proxy only; not genuine Binomo OHLC or trade settlements',
      signals:[...v3.signals.values()],candles:[...v3.candles.values()]};
    download('binomo-v5-research-backup.json',JSON.stringify(backup,null,2),'application/json');
  });
  id('v3Restore').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try {
      const d=JSON.parse(await f.text());
      if(d.format!=='crypto-idx-visual-research'||d.version!==3||!Array.isArray(d.signals)||!Array.isArray(d.candles)||d.signals.length>100000||d.candles.length>100000)
        throw new Error('Not a compatible V3 backup or file too large');
      for(const r of d.signals){if(typeof r.id!=='string'||!/(?:^\d+-[14]m$|^[^|]{1,32}\|\d+-[12]m$)/.test(r.id)||typeof r.start!=='number')continue;v3.signals.set(r.id,r);await put('signals',r)}
      for(const r of d.candles){if(typeof r.id!=='string'||!/(?:^\d+$|^[^|]{1,32}\|\d+$)/.test(r.id)||typeof r.observedAt!=='number')continue;v3.candles.set(r.id,r);await put('candles',r)}
      status('Imported research records · locally saved','good');paint(true);
    }catch(err){status('Restore failed: '+err.message,'bad')}
    e.target.value='';
  });
  id('v3Clear').addEventListener('click',async()=>{
    if(!confirm('Permanently delete all V3 signals and candle samples saved in this browser? Export a JSON backup first.'))return;
    await Promise.all([removeAll('signals'),removeAll('candles')]);
    v3.signals.clear();v3.candles.clear();v3.cooldownUntil=0;id('v3Last').textContent='No eligible signal has been completed.';
    paint(true);
  });
  id('v3RefreshNow').addEventListener('click',()=>{
    if(s.mode==='off'){status('Start Live Tab Monitor or choose a screenshot first','warn');return}
    tick(true); // Re-read latest already-shared frame, not a broker/network refresh.
  });
  id('clockSynced').addEventListener('change',()=>{
    if(!id('clockSynced').checked){status('WAIT · clock alignment confirmation removed');}
    tick(true);
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&s.mode==='live')status('WAIT · background tab may be throttled; monitoring not guaranteed','warn');
  });
  setInterval(()=>{
    if(s.mode!=='live' || document.hidden){
      if(s.mode==='off')status('Not connected · auto checks paused');
      else if(document.hidden)status('WAIT · keep dashboard visible in separate window');
    }
    paint();
  },1000);
  document.addEventListener('binomo-asset-switched',()=>{
    v3.session='session-'+Date.now();v3.lastCandleSlot=0;
    const now=Date.now();
    const recent=[...v3.signals.values()].filter(r=>(r.asset||'Crypto IDX')===getAsset() && r.visualOutcome==='LOSS'&&r.resultAt>now-4*MS);
    v3.cooldownUntil=recent.length?Math.max(...recent.map(r=>r.resultAt))+4*MS:0;
    status('Asset changed · chart/source must be confirmed again');paint(true);
  });
  initialize();
})();
