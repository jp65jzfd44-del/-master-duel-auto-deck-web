(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const KEY='md_strategy_builder_v5';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s・･ー―‐\-–—_.,，。!！?？「」『』()（）【】\[\]<>＜＞:：/／\\]/g,'');

  function openDb(){return new Promise((ok,ng)=>{const r=indexedDB.open('MasterDuelAutoDeck',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('cache'))r.result.createObjectStore('cache')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ng(r.error)})}
  async function get(k){try{const d=await openDb();return await new Promise((ok,ng)=>{const r=d.transaction('cache','readonly').objectStore('cache').get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>ng(r.error)})}catch{return null}}
  async function cards(){const [b,j]=await Promise.all([get('master_duel_cards_v1'),get('master_duel_japanese_names_v1')]);const names=j&&j.names||{};return (b&&b.cards||[]).map(c=>Object.assign({},c,{jp_name:(names[String(c.id)]||{}).jp_name||c.jp_name||''}))}
  const label=c=>c&&((c.jp_name||c.name)||'')||'';

  function mentioned(text,cs){
    const t=norm(text),out=[],seen=new Set();
    for(const c of cs){
      const ns=[c.jp_name,c.name].filter(Boolean).map(norm).filter(x=>x.length>=4);
      if(ns.some(x=>t.includes(x))&&!seen.has(String(c.id))){seen.add(String(c.id));out.push(c);if(out.length>=10)break}
    }
    return out;
  }
  function theme(text,cs){
    const t=norm(text),opts=[...($('themeSelect')?.options||[])].filter(o=>o.value);
    const hit=opts.map(o=>({v:o.value,k:norm(o.textContent)})).filter(x=>x.k.length>1&&t.includes(x.k)).sort((a,b)=>b.k.length-a.k.length)[0];
    if(hit)return hit.v;
    if(/ミミグ[ルー]|mimighoul/i.test(text))return 'Mimighoul';
    const m=mentioned(text,cs),m1=new Map();for(const c of m)if(c.archetype)m1.set(c.archetype,(m1.get(c.archetype)||0)+1);
    return [...m1.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  }
  function card(cs,en){const n=norm(en);return cs.find(c=>norm(c.name)===n)||null}
  function analyze(text,cs){
    let th=theme(text,cs), req=mentioned(text,cs), rec=[], notes=[];
    const charm=/ミミグ[ルー].*チャーム|mimighoul\s*charm/i.test(text)||req.some(c=>/mimighoul charm/i.test(c.name||''));
    const extra=/(?:EX|エクストラ).{0,12}(?:奪|パク|盗|抜|除外)|(?:奪|パク|盗).{0,12}(?:EX|エクストラ)/i.test(text);
    if(charm||((th==='Mimighoul')&&extra)){
      th='Mimighoul';
      const main=card(cs,'Mimighoul Charm');if(main&&!req.some(x=>x.id===main.id))req.push(main);
      ['Mimighoul Maker','Mimighoul Fork','Mimighoul Room','Giant Mimighoul','Mimighoul Throne'].forEach(n=>{const c=card(cs,n);if(c)rec.push(c)});
      notes.push('《ミミグル・チャーム》は相手EXデッキの裏側カードをランダムに選ぶため、展開必須カードを狙い撃ちすることはできません。');
      notes.push('狙いは「特定札を確実に盗む」ではなく、1ターン最大2回のランダム奪取/除外で相手EXの選択肢を削って展開を崩すことです。');
    }
    const goals=[];
    if(extra)goals.push('相手EXデッキへの干渉');
    if(/妨害|邪魔|止め|封殺|制圧/i.test(text))goals.push('相手展開の妨害');
    if(/ワンキル|OTK|相手を倒す|削り切/i.test(text))goals.push('フィニッシュ');
    if(/墓地|墓地肥やし/i.test(text))goals.push('墓地利用');
    if(/特殊勝利|エクゾ|ジャックポット/i.test(text))goals.push('特殊勝利');
    let profile='competitive';if(/後攻|まくり|捲り|ワンキル|OTK/i.test(text))profile='second';else if(/先攻|妨害|ロック|封殺|制圧/i.test(text))profile='first';
    return {text,theme:th,required:req,recommended:rec,notes,isCharm:charm||((th==='Mimighoul')&&extra),goal:goals.join(' / ')||'入力した展開・勝ち筋',profile,mainSize:/60枚|芝刈り/i.test(text)?60:40};
  }
  function themeName(v){const o=[...($('themeSelect')?.options||[])].find(x=>x.value===v);return o?o.textContent.trim():(v||'自動判定')}
  function report(a,built){
    const e=$('strategyAnalysisV5');if(!e)return;
    const req=a.required.map(label).join(' / ')||'明示なし',rec=a.recommended.map(label).join(' / ')||'テーマから自動補完';
    const warn=a.notes.length?'<div class="strategy-warn-v5">'+a.notes.map(x=>'・'+esc(x)).join('<br>')+'</div>':'';
    const done=built?'<div class="strategy-built-v5"><strong>構築反映済み</strong><br>'+esc(built.name||'生成デッキ')+'</div>':'';
    e.innerHTML='<strong>読み取った戦術</strong><br>テーマ: '+esc(themeName(a.theme))+'<br>目的: '+esc(a.goal)+'<br>方針: '+(a.profile==='first'?'先攻寄り':a.profile==='second'?'後攻寄り':'実戦重視')+' / '+a.mainSize+'枚<br>主役・必須: '+esc(req)+'<br>推奨サポート: '+esc(rec)+warn+done;
  }
  function guide(a,deck){
    const s=$('mdGuideScreenV4');if(!s)return;let box=$('strategyGuideV5');
    if(!box){box=document.createElement('section');box.id='strategyGuideV5';box.className='analysis-box strategy-guide-v5';const g=s.querySelector('.md-guide-grid-v4');g?s.insertBefore(box,g):s.appendChild(box)}
    const have=new Set([...(deck?.main||[]),...(deck?.extra||[])].map(e=>String(e.card?.id)));
    const req=a.required.map(c=>label(c)+(have.has(String(c.id))?' ✓':'（未採用）')).join(' / ')||'自動選定';
    const steps=a.isCharm?[
      '1. ミミグルを相手フィールドへ裏側で送り、表側になる状況を作る。',
      '2. 《ミミグル・チャーム》を維持し、相手側ミミグルが表側になるたび相手EXデッキへ干渉する。',
      '3. チャームは相手EXの裏側カードをランダム選択し、特殊召喚可能なら自分の場へ出し、できなければ除外する。狙い撃ちではない。',
      '4. 1ターン最大2回のEX干渉＋通常のミミグル妨害＋汎用妨害で相手の展開線を細くする。',
      '5. 相手の展開が止まったら、ミミグル本体・奪ったEXモンスター・自分のEXでライフを詰める。'
    ]:[
      '1. 入力文に書いた主役カードとテーマへアクセスできる初動を優先する。',
      '2. 書いた目的（妨害・奪取・墓地利用・ワンキル等）を成立させる補助札を展開途中に確保する。',
      '3. 最大展開より、入力した勝ち筋を再現できる盤面を優先する。',
      '4. 戦術が不成立になった場合は通常テーマ展開へ戻れるカードを残す。'
    ];
    box.innerHTML='<h3>入力した戦術からの構築</h3><div class="analysis-text"><strong>入力:</strong> '+esc(a.text)+'<br><br><strong>主役・必須:</strong> '+esc(req)+'<br><br>'+steps.map(esc).join('<br>')+'</div>';
  }
  async function waitDeck(before,a){for(let i=0;i<45;i++){await new Promise(r=>setTimeout(r,200));const d=await get('master_duel_last_deck_v1');if(d&&d.generated_at&&d.generated_at!==before){report(a,d);guide(a,d);return d}}}
  function create(){
    if($('strategyBuilderV5')||!$('buildBtn'))return;
    const sec=document.createElement('section');sec.id='strategyBuilderV5';sec.className='strategy-builder-v5';
    sec.innerHTML='<div class="strategy-title-v5"><div><strong>戦術からデッキを組む</strong><p class="hint">やりたい展開・妨害・勝ち筋を文章で書くと、テーマ・主役カード・構築方針を読み取って自動構築します。</p></div><span>NEW</span></div><textarea id="strategyInputV5" rows="5" placeholder="例: ミミグルチャームを使って相手EXデッキから展開必須カードをパクって相手の展開を邪魔して相手を倒す。"></textarea><div class="button-row"><button id="strategyExampleV5" type="button">ミミグル例を入力</button><button id="strategyAnalyzeV5" type="button">戦術を解析</button><button id="strategyBuildV5" class="primary" type="button">この戦術で構築</button></div><div id="strategyAnalysisV5" class="strategy-analysis-v5">文章を入力して「戦術を解析」を押してください。</div>';
    $('buildBtn').parentNode.insertBefore(sec,$('buildBtn'));
    $('strategyExampleV5').onclick=()=>{$('strategyInputV5').value='ミミグルチャームを使って相手EXデッキから展開必須カードをパクって相手の展開を邪魔して相手を倒す。';$('strategyAnalyzeV5').click()};
    $('strategyAnalyzeV5').onclick=async()=>{const t=$('strategyInputV5').value.trim(),cs=await cards();if(!t)return report({text:'',theme:'',required:[],recommended:[],notes:['戦術を入力してください。'],goal:'',profile:'competitive',mainSize:40});if(!cs.length){$('strategyAnalysisV5').textContent='先に「カードDBを同期」を押してください。';return}const a=analyze(t,cs);window.__mdStrategyV5=a;localStorage.setItem(KEY,JSON.stringify(a));report(a)};
    $('strategyBuildV5').onclick=async()=>{const t=$('strategyInputV5').value.trim(),cs=await cards();if(!t||!cs.length){$('strategyAnalyzeV5').click();return}const a=analyze(t,cs);localStorage.setItem(KEY,JSON.stringify(a));report(a);if(a.theme){const o=[...$('themeSelect').options].find(x=>x.value===a.theme);if(o)$('themeSelect').value=a.theme}$('profileSelect').value=a.profile;$('profileSelect').dispatchEvent(new Event('change',{bubbles:true}));$('mainSize').value=String(a.mainSize);$('extraSize').value='15';const old=$('mustInput').value.split(/\n+/).map(x=>x.trim()).filter(Boolean),add=a.required.map(c=>c.name).filter(Boolean);$('mustInput').value=[...new Set(old.concat(add))].join('\n');const d=await get('master_duel_last_deck_v1'),before=d&&d.generated_at||'';$('buildBtn').click();const built=await waitDeck(before,a);if(built&&innerWidth<=980)$('mobileTabResult')?.click()};
    try{const a=JSON.parse(localStorage.getItem(KEY)||'null');if(a&&a.text){$('strategyInputV5').value=a.text;report(a)}}catch{}
  }
  document.addEventListener('click',async e=>{if(e.target?.id!=='mdGuideBtnV4'&&e.target?.id!=='mdGuideTabV4')return;try{const a=JSON.parse(localStorage.getItem(KEY)||'null'),d=await get('master_duel_last_deck_v1');if(a&&d)setTimeout(()=>guide(a,d),80)}catch{}});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',create):create();
})();