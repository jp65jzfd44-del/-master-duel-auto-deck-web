(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'md_hybrid_builder_v6';
  const INJECT_KEY = 'md_hybrid_injected_v6';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s・･ー―‐\-–—_.,，。!！?？「」『』()（）【】\[\]<>＜＞:：/／\\]/g, '');

  const ALIASES = [
    [/ミミグ[ルー]|mimighoul/i, 'Mimighoul'],
    [/ヘカトンケイル|ヘカトン|hecahands|hecatoncheir/i, 'Hecahands'],
    [/ティアラメンツ|tearlaments/i, 'Tearlaments'],
    [/ライトロード|lightsworn/i, 'Lightsworn'],
    [/ラビュリンス|labrynth/i, 'Labrynth'],
    [/閃刀姫|sky\s*striker/i, 'Sky Striker'],
    [/青眼|ブルーアイズ|blue[-\s]*eyes/i, 'Blue-Eyes'],
    [/白き森|white\s*forest/i, 'White Forest'],
    [/キマイラ|chimera/i, 'Chimera'],
    [/カス[ht]ィラ|クシャトリラ|kashtira/i, 'Kashtira'],
    [/デモンスミス|fiendsmith/i, 'Fiendsmith'],
    [/アザミナ|azamina/i, 'Azamina'],
    [/ユベル|yubel/i, 'Yubel'],
    [/スネークアイ|snake[-\s]*eye/i, 'Snake-Eye'],
    [/K9|Ｋ９/i, 'K9'],
  ];

  function openDb(){return new Promise((ok,ng)=>{const r=indexedDB.open('MasterDuelAutoDeck',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('cache'))r.result.createObjectStore('cache')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ng(r.error)})}
  async function get(k){try{const d=await openDb();return await new Promise((ok,ng)=>{const r=d.transaction('cache','readonly').objectStore('cache').get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>ng(r.error)})}catch{return null}}
  async function cards(){const [b,j]=await Promise.all([get('master_duel_cards_v1'),get('master_duel_japanese_names_v1')]);const names=j&&j.names||{};return (b&&b.cards||[]).map(c=>Object.assign({},c,{jp_name:(names[String(c.id)]||{}).jp_name||c.jp_name||''}))}
  const label = c => c && (c.jp_name || c.name) || '';
  const isExtra = c => /Fusion|Synchro|XYZ|Xyz|Link/i.test(String(c?.type || ''));

  function optionThemes(){
    return [...($('themeSelect')?.options || [])].filter(o=>o.value).map(o=>({value:o.value,label:o.textContent.trim()}));
  }
  function canonicalTheme(name){
    if(!name) return '';
    const n=norm(name), opts=optionThemes();
    let hit=opts.find(o=>norm(o.value)===n || norm(o.label)===n);
    if(hit) return hit.value;
    hit=opts.find(o=>norm(o.value).includes(n) || n.includes(norm(o.value)) || norm(o.label).includes(n) || n.includes(norm(o.label)));
    return hit?.value || name;
  }
  function themeLabel(v){const o=optionThemes().find(x=>x.value===v);return o?.label || v || '自動';}
  function detectThemes(text){
    const t=norm(text), out=[];
    for(const o of optionThemes()){
      const a=norm(o.label),b=norm(o.value);
      if((a.length>1&&t.includes(a))||(b.length>2&&t.includes(b))) out.push(o.value);
    }
    for(const [re,v] of ALIASES) if(re.test(text)) out.push(canonicalTheme(v));
    return [...new Set(out.filter(Boolean))].slice(0,3);
  }

  function mechanicsForCard(c){
    const d=String(c?.desc||'').toLowerCase();
    const n=String(c?.name||'').toLowerCase();
    return {
      search:/add 1 .* from your deck|search your deck|set 1 .* from your deck/i.test(d),
      self:/special summon this card|you can special summon this card/i.test(d),
      extend:/special summon 1 .* from your (?:hand|deck|gy|graveyard)|special summon .* from your deck/i.test(d),
      control:/take control|control of .* opponent|owned by your opponent|your opponent controls/i.test(d),
      extraRip:/opponent's extra deck|face-down cards in your opponent's extra deck/i.test(d),
      flip:/flip|face-down defense|change .* battle position/i.test(d),
      fusion:/fusion summon|fusion monster|fusion material/i.test(d)||/fusion/i.test(String(c?.type||'')),
      xyz:/xyz|x material|rank /i.test(d)||/xyz/i.test(String(c?.type||'')),
      grave:/graveyard|\bgy\b|send .* to the gy/i.test(d),
      banish:/banish|banished/i.test(d),
      negate:/negate/i.test(d),
      draw:/draw [123]|draw .*card/i.test(d),
      hand:/opponent's hand|discard/i.test(d),
      token:/token/i.test(d),
      lock:/you cannot special summon|for the rest of this turn.*cannot|only special summon/i.test(d),
      archetypeLock:/"[^\"]+" (?:monster|card)s?|archetype/i.test(d),
      highBrick:!isExtra(c) && Number(c?.level||0)>=7 && !/special summon this card|you can special summon/i.test(d),
      named:n
    };
  }
  function strategyTags(text){
    return {
      control:/奪|パク|盗|コントロール|steal|take control/i.test(text),
      extraRip:/(?:ex|エクストラ).{0,16}(?:奪|パク|盗|抜|削|除外)|(?:奪|パク|盗).{0,16}(?:ex|エクストラ)/i.test(text),
      flip:/裏側|リバース|表側|表示形式|flip/i.test(text),
      fusion:/融合|fusion/i.test(text),
      xyz:/エクシーズ|xyz/i.test(text),
      grave:/墓地|墓地肥やし|grave|gy/i.test(text),
      banish:/除外|banish/i.test(text),
      negate:/妨害|無効|negate|止め/i.test(text),
      hand:/ハンデス|手札|hand/i.test(text),
      otk:/ワンキル|otk|倒す|削り切/i.test(text),
    };
  }
  function themeCards(theme,cs){return cs.filter(c=>c.archetype===theme || String(c.name||'').toLowerCase().includes(String(theme||'').toLowerCase()));}
  function aggregate(theme,cs){
    const list=themeCards(theme,cs); const tag={}; const races=new Map(), attrs=new Map(); let locks=0,bricks=0;
    for(const c of list){const m=mechanicsForCard(c); for(const [k,v] of Object.entries(m)) if(typeof v==='boolean'&&v) tag[k]=(tag[k]||0)+1; if(c.race)races.set(c.race,(races.get(c.race)||0)+1); if(c.attribute)attrs.set(c.attribute,(attrs.get(c.attribute)||0)+1); if(m.lock)locks++; if(m.highBrick)bricks++;}
    return {theme,list,tag,races,attrs,locks,bricks};
  }
  function overlapKeys(a,b,keys){return keys.filter(k=>(a.tag[k]||0)>0&&(b.tag[k]||0)>0)}
  function synergy(a,b,text){
    const keys=['search','self','extend','control','extraRip','flip','fusion','xyz','grave','banish','negate','hand'];
    const shared=overlapKeys(a,b,keys); const st=strategyTags(text); let score=28 + shared.length*5;
    const sharedRace=[...a.races.keys()].find(r=>b.races.has(r)); if(sharedRace) score+=10;
    const sharedAttr=[...a.attrs.keys()].find(r=>b.attrs.has(r)); if(sharedAttr) score+=4;
    for(const k of Object.keys(st)) if(st[k]&&(a.tag[k]||0)>0&&(b.tag[k]||0)>0) score+=8;
    const pair=new Set([a.theme,b.theme]);
    if(pair.has('Mimighoul')&&pair.has('Hecahands')){score+=st.control||st.extraRip?16:8;score-=8;}
    const lockRate=((a.locks/Math.max(1,a.list.length))+(b.locks/Math.max(1,b.list.length)))/2; score-=Math.round(lockRate*20);
    return {score:Math.max(0,Math.min(100,Math.round(score))),shared,sharedRace,sharedAttr,lockRate};
  }

  function scoreEngineCard(c,theme,text,primaryAgg){
    const m=mechanicsForCard(c), st=strategyTags(text); let s=0;
    if(c.archetype===theme)s+=32; if(m.search)s+=34; if(m.self)s+=27; if(m.extend)s+=23; if(m.negate)s+=16; if(m.draw)s+=10;
    if(st.control&&m.control)s+=34; if(st.extraRip&&m.extraRip)s+=42; if(st.flip&&m.flip)s+=22; if(st.fusion&&m.fusion)s+=18; if(st.xyz&&m.xyz)s+=18; if(st.grave&&m.grave)s+=20; if(st.banish&&m.banish)s+=18; if(st.hand&&m.hand)s+=18;
    const pn=norm(text), names=[c.name,c.jp_name].filter(Boolean).map(norm); if(names.some(n=>n.length>=4&&pn.includes(n)))s+=180;
    if(primaryAgg){const race=c.race&&primaryAgg.races.has(c.race),attr=c.attribute&&primaryAgg.attrs.has(c.attribute);if(race)s+=12;if(attr)s+=4;}
    if(m.lock)s-=20; if(m.highBrick)s-=26; if(isExtra(c))s+=m.control||m.extraRip?18:0;
    return s;
  }
  function copiesFor(c,score,secondary=true){
    const m=mechanicsForCard(c); if(isExtra(c)) return 1;
    if(score>=115 && (m.search||m.self)) return secondary?2:3;
    if(score>=85 && (m.search||m.extend)) return 2;
    if(m.highBrick||m.lock) return 1;
    return score>=70?2:1;
  }

  function findCard(cs,name){const n=norm(name);return cs.find(c=>norm(c.name)===n||norm(c.jp_name)===n)||null}
  function specialHecaGhoul(primary,secondary,text,cs,experimental){
    const set=new Set([primary,secondary]); if(!(set.has('Mimighoul')&&set.has('Hecahands'))) return null;
    if(!/奪|パク|盗|コントロール|ex|エクストラ|steal/i.test(text)) return null;
    const main=[
      ['Hecahands Ibtel',2],['Hecahands Yadel',1],['Hecahands Gaigas',1],['Hecahands Breus',1],['The Hidden Hecahands',1]
    ];
    if(experimental){main.push(['Hecahands Mankibuel',1]);main.push(['Hecahands Godos',1]);}
    const extra=[['Hecahands Jauzah',1],['Hecahands Xeno',1],['Ripple Bird',1]];
    return {main:main.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]),extra:extra.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]),note:'ミミグルを主軸に、ヘカトンケイルは小型の奪取エンジンとして採用。波紋鳥でミミグルの表示形式を動かし、チャームのEX干渉とヘカトンケイルの奪取を重ねる実験型。'};
  }

  function buildEngine(theme,cs,text,budget,primaryAgg){
    const pool=themeCards(theme,cs).map(c=>({c,s:scoreEngineCard(c,theme,text,primaryAgg)})).sort((a,b)=>b.s-a.s);
    const main=[],extra=[]; let used=0;
    for(const x of pool.filter(x=>!isExtra(x.c))){if(used>=budget)break;let q=Math.min(copiesFor(x.c,x.s,true),budget-used);if(q<=0)continue;main.push([x.c,q]);used+=q;}
    for(const x of pool.filter(x=>isExtra(x.c)).slice(0,Math.min(3,Math.max(1,Math.round(budget/4))))){extra.push([x.c,1]);}
    return {main,extra,note:''};
  }
  function expandNames(entries){const out=[];for(const [c,q] of entries)for(let i=0;i<q;i++)out.push(c.name||c.jp_name);return out.filter(Boolean)}
  function removePreviousInjected(lines){
    let prev=[];try{prev=JSON.parse(localStorage.getItem(INJECT_KEY)||'[]')}catch{}
    const counts=new Map();for(const x of prev)counts.set(norm(x),(counts.get(norm(x))||0)+1);
    const out=[];for(const line of lines){const k=norm(line),n=counts.get(k)||0;if(n>0){counts.set(k,n-1);continue}out.push(line)}return out;
  }
  function setMustInjected(names){
    const el=$('mustInput');if(!el)return;const cur=removePreviousInjected(String(el.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean));el.value=cur.concat(names).join('\n');localStorage.setItem(INJECT_KEY,JSON.stringify(names));
  }

  function selectOptions(select,source,placeholder){
    select.innerHTML='';const a=document.createElement('option');a.value='';a.textContent=placeholder;select.appendChild(a);
    for(const o of source){const x=document.createElement('option');x.value=o.value;x.textContent=o.label;select.appendChild(x)}
  }
  function detectPlanFromUI(text){
    const detected=detectThemes(text), p=$('hybridPrimaryV6')?.value||'',s=$('hybridSecondV6')?.value||'',t=$('hybridThirdV6')?.value||'';
    const themes=[p,s,t,...detected].map(canonicalTheme).filter(Boolean);return [...new Set(themes)].slice(0,3);
  }
  function budgetByMode(mode,idx,total){
    const base=mode==='deep'?12:mode==='equal'?10:mode==='compact'?6:8;
    if(total>=3)return idx===1?Math.max(5,base-2):Math.max(4,base-4); return base;
  }

  async function analyzeHybrid(){
    const text=$('strategyInputV5')?.value.trim()||'';const cs=await cards(), themes=detectPlanFromUI(text);const box=$('hybridAnalysisV6');
    if(!cs.length){box.textContent='先に「カードDBを同期」を押してください。';return null}
    if(themes.length<2){box.innerHTML='混合テーマが2つ以上見つかりません。文章に「ミミグルとヘカトンケイル」のように書くか、下のプルダウンで指定してください。';return null}
    const aggs=themes.map(t=>aggregate(t,cs));const pairs=[];for(let i=0;i<aggs.length;i++)for(let j=i+1;j<aggs.length;j++)pairs.push({a:aggs[i],b:aggs[j],...synergy(aggs[i],aggs[j],text)});
    const avg=Math.round(pairs.reduce((s,x)=>s+x.score,0)/Math.max(1,pairs.length));const exp=$('hybridExperimentalV6')?.checked;
    const shared=[...new Set(pairs.flatMap(x=>x.shared))];const labels={control:'コントロール奪取',extraRip:'EX干渉',flip:'表示形式/裏側',fusion:'融合',xyz:'Xyz',grave:'墓地利用',banish:'除外',negate:'妨害',search:'サーチ',self:'自己展開',extend:'展開補助',hand:'手札干渉'};
    const warn=avg<45&&!exp?'相性が低めです。「珍しい組み合わせも許可」をONにすると、成立する小型エンジンを優先して実験構築します。':avg<55?'実験寄りです。主軸を太く、混ぜる側を小型エンジンにして事故率を抑えます。':'混合候補として成立しやすい組み合わせです。';
    box.innerHTML='<strong>'+themes.map(themeLabel).map(esc).join(' ＋ ')+'</strong><br>混合相性（目安）: <b>'+avg+'/100</b><br>共通する動き: '+esc(shared.map(x=>labels[x]||x).join(' / ')||'明確な共通タグなし')+'<br><span class="hybrid-note-v6">'+esc(warn)+'</span>';
    const plan={text,themes,avg,aggs,pairs,experimental:!!exp,mode:$('hybridRatioV6')?.value||'balanced'};localStorage.setItem(KEY,JSON.stringify({text,themes,avg,experimental:plan.experimental,mode:plan.mode}));return {plan,cs};
  }

  async function waitDeck(before,timeout=12000){for(let i=0;i<Math.ceil(timeout/250);i++){await new Promise(r=>setTimeout(r,250));const d=await get('master_duel_last_deck_v1');if(d&&d.generated_at&&d.generated_at!==before)return d}return null}
  function roleCount(entries,re){return (entries||[]).reduce((s,e)=>s+(re.test(String(e.card?.desc||''))?e.qty:0),0)}
  function postScore(deck,plan){
    const main=deck?.main||[];const n=main.reduce((s,e)=>s+e.qty,0)||1;let mixed=0;for(const e of main)if(plan.themes.includes(e.card?.archetype))mixed+=e.qty;
    const starters=roleCount(main,/add 1 .* from your deck|search your deck|special summon this card|set 1 .* from your deck/i);
    const inter=roleCount(main,/negate|take control|banish|destroy|return .* to the hand/i);
    const brick=main.reduce((s,e)=>s+(Number(e.card?.level||0)>=7&&!/special summon this card|you can special summon/i.test(String(e.card?.desc||''))?e.qty:0),0);
    const coverage=Math.min(100,Math.round(starters/9*55+inter/7*45));const cohesion=Math.min(100,Math.round(mixed/n/.65*100));const safety=Math.max(0,100-Math.round(brick/n*220));return Math.round(coverage*.4+cohesion*.32+safety*.18+plan.avg*.1);
  }
  function showBuilt(deck,plan,engineNames){
    const box=$('hybridAnalysisV6');if(!box||!deck)return;const score=postScore(deck,plan);box.innerHTML += '<div class="hybrid-built-v6"><strong>混合構築完了</strong><br>構築完成度（混合診断・目安）: <b>'+score+'/100</b><br>混ぜたエンジン: '+esc(engineNames.join(' / ')||'自動')+'<br>※勝率ではなく、初動・妨害・テーマ比率・事故札・テーマ間相性を見た内部診断です。</div>';
  }

  async function buildHybrid(){
    const res=await analyzeHybrid();if(!res)return;const {plan,cs}=res;if(plan.avg<35&&!plan.experimental){$('hybridAnalysisV6').innerHTML+='<div class="hybrid-warn-v6">相性がかなり低いため自動構築を止めました。「珍しい組み合わせも許可」をONにすると続行できます。</div>';return}
    const primary=plan.themes[0],secondaries=plan.themes.slice(1);const primaryAgg=aggregate(primary,cs),injected=[],engineNames=[];
    for(let i=0;i<secondaries.length;i++){
      const t=secondaries[i],budget=budgetByMode(plan.mode,i+1,plan.themes.length);let engine=null;
      if(i===0)engine=specialHecaGhoul(primary,t,plan.text,cs,plan.experimental);
      if(!engine)engine=buildEngine(t,cs,plan.text,budget,primaryAgg);
      injected.push(...expandNames(engine.main),...expandNames(engine.extra));engineNames.push(themeLabel(t)+' '+engine.main.reduce((s,x)=>s+x[1],0)+'枚＋EX'+engine.extra.length+'枚');
      if(engine.note)$('hybridAnalysisV6').innerHTML+='<div class="hybrid-note-v6">'+esc(engine.note)+'</div>';
    }
    setMustInjected(injected);
    const sel=$('themeSelect');if(sel){const o=[...sel.options].find(x=>x.value===primary);if(o)sel.value=primary}
    if($('themeDensity'))$('themeDensity').value='low';
    if($('profileSelect')){const txt=plan.text;const p=/後攻|ワンキル|OTK|捲り|まくり/i.test(txt)?'second':/先攻|妨害|制圧|ロック/i.test(txt)?'first':'competitive';$('profileSelect').value=p;$('profileSelect').dispatchEvent(new Event('change',{bubbles:true}))}
    if($('mainSize')&&!/60枚|芝刈り/i.test(plan.text))$('mainSize').value='40';if($('extraSize'))$('extraSize').value='15';
    const before=(await get('master_duel_last_deck_v1'))?.generated_at||'';
    $('buildBtn')?.click();const deck=await waitDeck(before);if(deck){showBuilt(deck,plan,engineNames);if(innerWidth<=980)$('mobileTabResult')?.click();}
  }

  function create(){
    const host=$('strategyBuilderV5');if(!host||$('hybridBuilderV6'))return false;
    const sec=document.createElement('div');sec.id='hybridBuilderV6';sec.className='hybrid-builder-v6';sec.innerHTML='<div class="hybrid-head-v6"><strong>混合テーマ / 変則構築</strong><span>v6</span></div><p class="hint">文章から複数テーマを自動検出します。珍しい組み合わせは、小型エンジン化・事故札抑制・共通ギミック優先で組みます。</p><div class="hybrid-grid-v6"><label>主軸テーマ<select id="hybridPrimaryV6"></select></label><label>混ぜるテーマ①<select id="hybridSecondV6"></select></label><label>混ぜるテーマ②<select id="hybridThirdV6"></select></label><label>混合比率<select id="hybridRatioV6"><option value="compact">主軸75 / 混合25</option><option value="balanced" selected>主軸65 / 混合35</option><option value="equal">主軸55 / 混合45</option><option value="deep">ギミック深め</option></select></label></div><label class="hybrid-check-v6"><input id="hybridExperimentalV6" type="checkbox"> 珍しい組み合わせも許可（相性が低くても、成立する最小エンジンを探す）</label><div class="button-row"><button id="hybridAnalyzeV6" type="button">混合相性を解析</button><button id="hybridBuildV6" class="primary" type="button">混合戦術で構築</button></div><div id="hybridAnalysisV6" class="hybrid-analysis-v6">例：「ミミグルとヘカトンケイルで相手のカードを奪うデッキ」のように戦術欄へ書けます。</div>';
    const area=$('strategyInputV5');area.parentNode.insertBefore(sec,area.nextSibling);
    const opts=optionThemes();selectOptions($('hybridPrimaryV6'),opts,'自動判定');selectOptions($('hybridSecondV6'),opts,'自動判定');selectOptions($('hybridThirdV6'),opts,'なし / 自動');
    $('hybridAnalyzeV6').onclick=analyzeHybrid;$('hybridBuildV6').onclick=buildHybrid;
    document.addEventListener('click',e=>{if(e.target?.id!=='strategyBuildV5')return;const text=$('strategyInputV5')?.value||'',themes=detectPlanFromUI(text);if(themes.length>=2){e.preventDefault();e.stopImmediatePropagation();buildHybrid();}},true);
    try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v){$('hybridExperimentalV6').checked=!!v.experimental;$('hybridRatioV6').value=v.mode||'balanced';}}
    catch{}
    return true;
  }
  let tries=0;const timer=setInterval(()=>{if(create()||++tries>60)clearInterval(timer)},100);
})();