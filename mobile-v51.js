/* Binomo Multi-Asset Mobile Monitor V5.1. Free offline-first visual demo journal.
   No Binomo APIs, trading orders or remote screenshot uploads. */
(() => {
  'use strict';
  const $m = id => document.getElementById(id);
  const storeKey='binomoMultiAssetSnapshotsV5';
  let snapshots=[];
  let lastStatus='';
  try { snapshots=JSON.parse(localStorage.getItem(storeKey)||'[]'); if(!Array.isArray(snapshots))snapshots=[]; }catch{snapshots=[];}
  const time=t=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
  const stamp=t=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'medium'}).format(new Date(t));
  function renderPastCandles(){
    const items=s.candles?.slice(0,-1)||[]; // exclude rightmost inferred running candle
    const ok=s.mode!=='off' && items.length>=1;
    const quality=($m('quality').textContent.match(/(\d+)\/100/)||[])[1];
    const credible=ok && (quality===undefined || Number(quality)>=60);
    const last=items.at(-1), previous=items.at(-2);
    let one='NO DATA',two='NO DATA',note1='Need visible completed candles',note2='Last two 1m bars are not 2m-clock aligned';
    if(!credible && ok){one='UNCLEAR';two='UNCLEAR';note1='Weak screenshot detection';note2='Crop chart area more closely';}
    else if(credible){
      one=last.color==='G'?'UP':'DOWN';
      note1='Past closed candle · color estimate';
      if(previous){
        const delta=last.close-previous.open;
        two=Math.abs(delta)<2?'FLAT':delta>0?'UP':'DOWN';
        note2='Net of two inferred closed bars · not aligned';
      }else{note2='At least 2 closed bars needed';}
    }
    for (const [id,val] of [['pastOne',one],['pastTwo',two]]){
      $m(id).textContent=val;
      $m(id).className=val==='UP'?'up':val==='DOWN'?'down':'flat';
    }
    $m('pastOneNote').textContent=note1;
    $m('pastTwoNote').textContent=note2;
  }
  function render() {
    const past=$m('observedDir').textContent;
    $m('quickObserved').textContent=past;
    $m('quickObserved').className=past==='UP'?'up':past==='DOWN'?'down':'';
    $m('quickObservedNote').textContent=['UP','DOWN','MIXED'].includes(past)?'Historical chart pixels only; not a future prediction.':'Need 24 inferred completed candles.';
    const live=s.mode==='live';
    const frameAge=live ? Date.now()-s.lastFrame : Infinity;
    const fresh=live && !document.hidden && frameAge<=5500 && s.video?.readyState >= 2;
    const motionOK=fresh && (!s.lastMotion || Date.now()-s.lastMotion<=25000);
    const image=s.mode==='image' && !!s.image;
    let ready='NO LIVE DATA'; let status='Import a matching 1m chart screenshot to study visible candle history.'; let color='warn';
    if(live && motionOK){
      ready='LIVE FRAME · TEST';color='good';
      status='Screen capture currently active. Crop and clock must be verified before any directional hypothesis. Switching away from this page can suspend monitoring.';
    }else if(live){
      ready='WAIT · STALE';color='bad';
      status='Screen video is stale, frozen or backgrounded. No live decision should be used.';
    }else if(image){
      ready='SCREENSHOT ONLY';
      status='Screenshot loaded for '+getAsset()+'. Observed historical trend below; live next-candle decisions and auto WIN/LOSS require continuous, verified chart capture.';
    }
    $m('mobileReady').className='badge '+color;
    $m('mobileReady').textContent=ready;
    if(status!==lastStatus){$m('mobileConnection').textContent=status;lastStatus=status;}
    $m('quickOneTime').textContent=$m('oneWindow').textContent.replace(' IST','');
    $m('quickFourTime').textContent=$m('fourWindow').textContent.replace(' IST','');
    for(const [tag,source] of [['quickOne','oneDir'],['quickFour','fourDir']]){
      const direction=(live&&motionOK) ? $m(source).textContent.trim() : 'NO LIVE';
      const value=['UP','DOWN'].includes(direction)?direction:(live?'WAIT':'NO LIVE');
      $m(tag).textContent=value;
      $m(tag).className=value==='NO LIVE'?'nolive':value.toLowerCase();
    }
    renderPastCandles();
    $m('signalExplanation').textContent=live&&motionOK
      ? 'LIVE SCREEN TEST: if next-candle direction is still WAIT, open WAIT diagnostics below. Do not assume a correct broker price feed.'
      : image
      ? 'SCREENSHOT ONLY: directions shown in green/red below are historical pixel estimates, NOT the NEXT 1m/2m candle. For live future signals, continuous screen capture is required and may not work on iPhone.'
      : 'NO LIVE FEED: open Binomo Demo 1m chart, take a screenshot, then tap Choose Screenshot for PAST 1m and last-two-bar direction. Next-candle prediction is unavailable without verified live data.';
    $m('saveSnapshot').disabled = !image || !s.candles?.length;
    $m('snapshotCount').textContent=snapshots.length+' saved notes';
    if(image && s.candles?.length){
      const bars=s.candles;
      const closed=bars.slice(0,-1);
      const green=closed.slice(-8).filter(x=>x.color==='G').length;
      const red=closed.slice(-8).filter(x=>x.color==='R').length;
      const votes=s.lastAnalysis?.v;
      const data=`Selected ${getAsset()} (not image-verified). Historical screenshot — ${bars.length} candle-like bars detected, ${closed.length} inferred closed. Last 8 closed: ${green} green / ${red} red. `+
        (votes?`Visual votes ${votes.up} UP / ${votes.down} DOWN / ${votes.flat} neutral. `:'More clear candles needed. ')+
        `No price feed, exact OHLC, current-candle identity or next-candle outcome verified.`;
      $m('mobileSnapshot').textContent=data;
    }
  }
  function saveSnapshot(){
    if(s.mode!=='image'||!s.candles?.length)return;
    const closed=s.candles.slice(0,-1);const v=s.lastAnalysis?.v;
    const note={id:Date.now().toString(),importedAt:Date.now(),asset:getAsset()+' — user-uploaded visual',timeframe:'1m assumed (not verified)',
      closedCount:closed.length,last8Colors:closed.slice(-8).map(x=>x.color).join(''),
      pixelVoteUp:v?.up??null,pixelVoteDown:v?.down??null,source:'Manual image import',
      observedLast1m:$m('pastOne').textContent,observedTwoBarsNet:$m('pastTwo').textContent,signal:'UNAVAILABLE',outcome:'UNVERIFIED',caution:'Historical pixels, no authenticated candle times; not an automatic result'};
    snapshots.unshift(note);snapshots=snapshots.slice(0,400);
    try{localStorage.setItem(storeKey,JSON.stringify(snapshots))}catch(e){$m('mobileConnection').textContent='Cannot save in browser storage. Export your notes.'}
    $m('mobileSnapshot').textContent='Saved historical visual observation at '+stamp(note.importedAt)+'. No live trade result claimed.';
    render();
  }
  function exportSnapshots(){
    const blob=new Blob([JSON.stringify({app:'Binomo Multi-Asset Mobile Monitor V5.1',exportedAt:new Date().toISOString(),snapshots},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='binomo-v51-mobile-notes.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  async function acceptImage(file){
    if(!file){$m('mobileConnection').textContent='No image found. Choose Screenshot instead.';return;}
    if(!file.type.startsWith('image/')){$m('mobileConnection').textContent='Only image files are supported.';return;}
    await uploadImage({target:{files:[file]}});
    render();
  }
  async function pasteImage(){
    if(!navigator.clipboard?.read){$m('mobileConnection').textContent='Image paste unavailable in this browser. Use Choose Screenshot.';return;}
    try{
      const items=await navigator.clipboard.read();
      for(const item of items){
        const kind=item.types.find(t=>t.startsWith('image/'));
        if(kind){const blob=await item.getType(kind);await acceptImage(new File([blob],'pasted-binomo-chart-'+Date.now()+'.png',{type:kind}));return;}
      }
      $m('mobileConnection').textContent='Clipboard has no image. Take a screenshot, then Choose Screenshot.';
    }catch(e){$m('mobileConnection').textContent='Paste permission not available ('+(e.name||'error')+'). Use Choose Screenshot.';}
  }
  $m('mobileStartLive').addEventListener('click',()=>{
    // Use direct user interaction for browser's required transient activation.
    if(!navigator.mediaDevices?.getDisplayMedia){
      $m('mobileConnection').textContent='Screen capture is unavailable in this browser. Choose Screenshot for past trend; automatic background monitoring is not possible here.';
      return;
    }
    begin();
  });
  $m('pasteImage').addEventListener('click',pasteImage);
  $m('saveSnapshot').addEventListener('click',saveSnapshot);
  $m('exportSnapshots').addEventListener('click',exportSnapshots);
  $m('upload').addEventListener('change',()=>{setTimeout(render,300);setTimeout(render,1200);});
  document.addEventListener('paste',async e=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length)await acceptImage(files[0]);});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && s.mode==='live'){
      resetSignals();s.lastAnalysis=null;s.stableCount=0;s.priorDir='';
    }
    if(!document.hidden){
      // No automatic claim that an old prediction survived a background interval.
      if(s.mode==='live' && Date.now()-s.lastFrame>3500){resetSignals();s.lastAnalysis=null;s.stableCount=0;}
      render();
    }
  });
  document.addEventListener('binomo-asset-switched',render);
  window.addEventListener('pageshow',render);
  setInterval(render,1200);
  render();
})();
