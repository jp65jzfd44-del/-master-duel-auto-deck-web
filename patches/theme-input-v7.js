(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const norm = s => String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[\s・･ー―‐\-–—_.,，。!！?？「」『』()（）【】\[\]<>＜＞:：/／\\]/g,'');
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function openDb(){
    return new Promise((ok,ng)=>{
      const r=indexedDB.open('MasterDuelAutoDeck',1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('cache'))r.result.createObjectStore('cache')};
      r.onsuccess=()=>ok(r.result); r.onerror=()=>ng(r.error);
    });
  }
  async function get(k){
    try{
      const d=await openDb();
      return await new Promise((ok,ng)=>{
        const r=d.transaction('cache','readonly').objectStore('cache').get(k);
        r.onsuccess=()=>ok(r.result||null); r.onerror=()=>ng(r.error);
      });
    }catch{return null}
  }
  async function dbArchetypes(){
    const b=await get('master_duel_cards_v1');
    const set=new Set();
    for(const c of (b&&b.cards)||[]) if(c.archetype) set.add(String(c.archetype));
    return [...set].sort((a,b)=>a.localeCompare(b));
  }
  function optionPairs(select){
    return [...(select?.options||[])].filter(o=>o.value).map(o=>({
      value:o.value,label:(o.textContent||'').trim()
    }));
  }
  function ensureOption(select,value,label){
    if(!select||!value)return;
    let o=[...select.options].find(x=>x.value===value);
    if(!o){
      o=document.createElement('option');
      o.value=value; o.textContent=label||value;
      select.appendChild(o);
    }
    select.value=value;
  }
  function resolveFromOptions(raw,select){
    const n=norm(raw); if(!n)return null;
    const opts=optionPairs(select);
    let hit=opts.find(o=>norm(o.value)===n||norm(o.label)===n);
    if(hit)return hit;
    hit=opts.find(o=>norm(o.label).includes(n)||n.includes(norm(o.label))||norm(o.value).includes(n)||n.includes(norm(o.value)));
    return hit||null;
  }
  async function resolveTheme(raw,select){
    const first=resolveFromOptions(raw,select);
    if(first)return first;
    const n=norm(raw); if(!n)return null;
    const arch=await dbArchetypes();
    let exact=arch.find(a=>norm(a)===n);
    if(exact)return {value:exact,label:exact};
    let hits=arch.filter(a=>norm(a).includes(n)||n.includes(norm(a)));
    hits.sort((a,b)=>Math.abs(norm(a).length-n.length)-Math.abs(norm(b).length-n.length));
    if(hits[0])return {value:hits[0],label:hits[0]};
    return null;
  }

  function makeDatalist(id,select){
    let dl=$(id);
    if(!dl){dl=document.createElement('datalist');dl.id=id;document.body.appendChild(dl)}
    dl.innerHTML='';
    for(const o of optionPairs(select)){
      const x=document.createElement('option');x.value=o.label;x.dataset.value=o.value;dl.appendChild(x);
    }
    return dl;
  }
  async function applyTyped(input,select,status){
    const raw=input.value.trim();
    if(!raw){ if(status)status.textContent=''; return false; }
    const hit=await resolveTheme(raw,select);
    if(hit){
      ensureOption(select,hit.value,hit.label);
      input.dataset.resolved=hit.value;
      if(status)status.innerHTML='<span class="theme-ok-v7">認識: '+esc(hit.label)+'</span>';
      return true;
    }
    input.dataset.resolved='';
    if(status)status.innerHTML='<span class="theme-warn-v7">候補が見つかりません。カードDB同期後に再試行するか、プルダウンから選択してください。</span>';
    return false;
  }

  function addNormalThemeInput(){
    const select=$('themeSelect'); if(!select||$('themeTextV7'))return;
    const wrap=document.createElement('div');wrap.className='theme-dual-v7';
    wrap.innerHTML='<label class="theme-dual-label-v7">テーマ名を入力（自由入力）</label>'+
      '<input id="themeTextV7" list="themeListV7" placeholder="例：ミミグル / Mimighoul / 新しいテーマ名">'+
      '<div id="themeTextStatusV7" class="theme-status-v7"></div>';
    select.insertAdjacentElement('afterend',wrap);
    makeDatalist('themeListV7',select);
    const input=$('themeTextV7'),status=$('themeTextStatusV7');
    select.addEventListener('change',()=>{
      const o=select.selectedOptions?.[0];
      if(o&&o.value)input.value=(o.textContent||o.value).trim();
      status.textContent='';
    });
    input.addEventListener('change',()=>applyTyped(input,select,status));
    input.addEventListener('blur',()=>applyTyped(input,select,status));
    document.addEventListener('click',async e=>{
      if(e.target?.id!=='buildBtn'&&e.target?.id!=='strategyBuildV5')return;
      if(input.value.trim()) await applyTyped(input,select,status);
    },true);
  }

  function addHybridInputFor(selectId,inputId,listId,statusId,label){
    const select=$(selectId); if(!select||$(inputId))return;
    const wrap=document.createElement('div');wrap.className='hybrid-text-v7';
    wrap.innerHTML='<span class="hybrid-text-label-v7">'+esc(label)+'を入力</span>'+
      '<input id="'+inputId+'" list="'+listId+'" placeholder="テーマ名を直接入力">'+
      '<div id="'+statusId+'" class="theme-status-v7"></div>';
    select.insertAdjacentElement('afterend',wrap);
    makeDatalist(listId,select);
    const input=$(inputId),status=$(statusId);
    select.addEventListener('change',()=>{
      const o=select.selectedOptions?.[0];
      if(o&&o.value)input.value=(o.textContent||o.value).trim();
      status.textContent='';
    });
    input.addEventListener('change',()=>applyTyped(input,select,status));
    input.addEventListener('blur',()=>applyTyped(input,select,status));
  }

  async function syncHybridTyped(){
    const defs=[
      ['hybridPrimaryV6','hybridPrimaryTextV7','hybridPrimaryStatusV7'],
      ['hybridSecondV6','hybridSecondTextV7','hybridSecondStatusV7'],
      ['hybridThirdV6','hybridThirdTextV7','hybridThirdStatusV7']
    ];
    for(const [sid,iid,stid] of defs){
      const i=$(iid),s=$(sid),st=$(stid);
      if(i&&s&&i.value.trim()) await applyTyped(i,s,st);
    }
  }

  function addHybridInputs(){
    addHybridInputFor('hybridPrimaryV6','hybridPrimaryTextV7','hybridPrimaryListV7','hybridPrimaryStatusV7','主軸テーマ');
    addHybridInputFor('hybridSecondV6','hybridSecondTextV7','hybridSecondListV7','hybridSecondStatusV7','混ぜるテーマ①');
    addHybridInputFor('hybridThirdV6','hybridThirdTextV7','hybridThirdListV7','hybridThirdStatusV7','混ぜるテーマ②');
    document.addEventListener('click',async e=>{
      if(e.target?.id!=='hybridAnalyzeV6'&&e.target?.id!=='hybridBuildV6'&&e.target?.id!=='strategyBuildV5')return;
      await syncHybridTyped();
    },true);
  }

  function addHelp(){
    const s=$('strategyBuilderV5'); if(!s||$('themeDualHelpV7'))return;
    const p=document.createElement('div');p.id='themeDualHelpV7';p.className='theme-dual-help-v7';
    p.innerHTML='<strong>テーマ指定は2通り</strong><br>プルダウンから選択しても、テーマ名を直接入力しても構築できます。混合テーマも同じです。';
    s.insertBefore(p,s.firstChild);
  }

  function init(){
    addNormalThemeInput();
    addHybridInputs();
    addHelp();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  let tries=0;const tm=setInterval(()=>{init();if(++tries>80)clearInterval(tm)},125);
})();