from pathlib import Path
import sys,re
root=Path(sys.argv[1])
app=root/'app.js'
hybrid=root/'hybrid-v6.js'

a=app.read_text(encoding='utf-8')

# Japanese alias/display name for Hecahands
if "'ヘカトンケイル': 'Hecahands'" not in a:
    anchor="    'ミミグール': 'Mimighoul',"
    if anchor not in a: raise SystemExit('alias anchor missing')
    a=a.replace(anchor, anchor+"\n    'ヘカトンケイル': 'Hecahands',\n    'ヘカトン': 'Hecahands',",1)
if "'Hecahands': 'ヘカトンケイル'" not in a:
    anchor="    'Mimighoul': 'ミミグル',"
    if anchor not in a: raise SystemExit('name anchor missing')
    a=a.replace(anchor, anchor+"\n    'Hecahands': 'ヘカトンケイル',",1)

# Generic on-demand supplement for newly-added / missing Master Duel themes
if 'async function ensureThemeCardsExternalV10' not in a:
    anchor='''  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }'''
    extra=anchor+'''

  function isMasterDuelCardV10(card) {
    const misc = Array.isArray(card?.misc_info) ? card.misc_info : [];
    return misc.some(info => {
      if (info?.md_rarity) return true;
      const f = info?.formats;
      if (Array.isArray(f)) return f.some(x => /master\\s*duel/i.test(String(x || '')));
      return /master\\s*duel/i.test(String(f || ''));
    });
  }

  async function ensureThemeCardsExternalV10(theme) {
    let t = String(theme || '').trim();
    if (!t) return [];
    const rawNorm = normalizeText(t);
    for (const [jp,en] of Object.entries(JP_ARCHETYPE_ALIASES)) {
      if (normalizeText(jp) === rawNorm) { t = en; break; }
    }
    const local = state.cards.filter(c => c?.archetype === t || String(c?.name || '').toLowerCase().includes(t.toLowerCase()));
    if (local.length) return local;
    try {
      const url = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(t) + '&misc=yes';
      const json = await fetchJsonWithTimeout(url, {}, 15000);
      const all = Array.isArray(json?.data) ? json.data : [];
      let incoming = all.filter(isMasterDuelCardV10);
      if (!incoming.length && t === 'Hecahands') incoming = all;
      if (!incoming.length) return [];
      const merged = new Map(state.cards.map(c => [String(c.id), c]));
      for (const c of incoming) if (c?.id) merged.set(String(c.id), c);
      const list = [...merged.values()];
      indexCards(list);
      await cacheSet(CACHE_KEY, { timestamp: Date.now(), cards: list });
      return state.cards.filter(c => c?.archetype === t || String(c?.name || '').toLowerCase().includes(t.toLowerCase()));
    } catch (e) {
      console.warn('theme supplement failed', t, e);
      return [];
    }
  }

  window.MDDeckBridgeV10 = {
    ensureTheme: ensureThemeCardsExternalV10,
    getCards: () => state.cards.slice(),
    resolveTheme: resolveThemeAsync
  };'''
    if anchor not in a: raise SystemExit('fetchJsonWithTimeout anchor missing')
    a=a.replace(anchor,extra,1)

# Ensure primary typed themes can also load dynamically
needle="      let theme = selectedTheme;"
if "ensureThemeCardsExternalV10(theme)" not in a:
    repl=needle+"""
      if (theme) {
        const resolvedThemeV10 = await resolveThemeAsync(theme);
        if (resolvedThemeV10) theme = resolvedThemeV10;
        await ensureThemeCardsExternalV10(theme);
      }"""
    if needle not in a: raise SystemExit('theme assignment anchor missing')
    a=a.replace(needle,repl,1)

app.write_text(a,encoding='utf-8')

h=hybrid.read_text(encoding='utf-8')

# Force visible version marker
h=h.replace("<strong>混合テーマ / 変則構築</strong><span>v6</span>","<strong>混合テーマ / 変則構築</strong><span>v10</span>")
h=h.replace("<strong>混合テーマ / 変則構築</strong><span>v9</span>","<strong>混合テーマ / 変則構築</strong><span>v10</span>")

# Hecahands pair always uses a real stealing engine; no strategy sentence required
old="""  function specialHecaGhoul(primary,secondary,text,cs,experimental){
    const set=new Set([primary,secondary]); if(!(set.has('Mimighoul')&&set.has('Hecahands'))) return null;
    if(!/奪|パク|盗|コントロール|ex|エクストラ|steal/i.test(text)) return null;
    const main=[
      ['Hecahands Ibtel',2],['Hecahands Yadel',1],['Hecahands Gaigas',1],['Hecahands Breus',1],['The Hidden Hecahands',1]
    ];
    if(experimental){main.push(['Hecahands Mankibuel',1]);main.push(['Hecahands Godos',1]);}
    const extra=[['Hecahands Jauzah',1],['Hecahands Xeno',1],['Ripple Bird',1]];
    return {main:main.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]),extra:extra.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]),note:'ミミグルを主軸に、ヘカトンケイルは小型の奪取エンジンとして採用。波紋鳥でミミグルの表示形式を動かし、チャームのEX干渉とヘカトンケイルの奪取を重ねる実験型。'};
  }"""
new="""  function specialHecaGhoul(primary,secondary,text,cs,experimental){
    const set=new Set([primary,secondary]); if(!(set.has('Mimighoul')&&set.has('Hecahands'))) return null;
    const main=[
      ['Hecahands Ibtel',2],['Hecahands Yadel',1],['Hecahands Gaigas',1],
      ['Hecahands Breus',1],['Hecahands Tartaros',1],['The Hidden Hecahands',1]
    ];
    if(experimental){main.push(['Hecahands Mankibuel',1]);main.push(['Hecahands Godos',1]);}
    const extra=[['Hecahands Dandalos',1],['Hecahands Jauzah',1],['Hecahands Xeno',1],['Ripple Bird',1]];
    const mm=main.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]);
    const xx=extra.map(([n,q])=>[findCard(cs,n),q]).filter(x=>x[0]);
    return {main:mm,extra:xx,note:'ミミグルを主軸に、ヘカトンケイルを奪取エンジンとして採用。ダンダロスのコントロール奪取、ゼノの相手EXデッキ利用、ミミグル・チャームのEX干渉を重ねる構築。'};
  }"""
if old in h:
    h=h.replace(old,new,1)
elif "Hecahands Dandalos" not in h:
    raise SystemExit('specialHecaGhoul anchor missing')

# Load missing secondary themes before evaluating engine
old="""  async function analyzeHybrid(){
    const text=$('strategyInputV5')?.value.trim()||'';const cs=await cards(), themes=detectPlanFromUI(text);const box=$('hybridAnalysisV6');"""
new="""  async function analyzeHybrid(){
    const text=$('strategyInputV5')?.value.trim()||'';
    const themes=detectPlanFromUI(text);
    if(window.MDDeckBridgeV10?.ensureTheme){
      for(const t of themes) await window.MDDeckBridgeV10.ensureTheme(t);
    }
    const cs=window.MDDeckBridgeV10?.getCards ? window.MDDeckBridgeV10.getCards() : await cards();
    const box=$('hybridAnalysisV6');"""
if old in h:
    h=h.replace(old,new,1)
elif "MDDeckBridgeV10?.ensureTheme" not in h:
    raise SystemExit('analyzeHybrid anchor missing')

# Make zero-card engine explicit and never silently report success
old="""      injected.push(...expandNames(engine.main),...expandNames(engine.extra));engineNames.push(themeLabel(t)+' '+engine.main.reduce((s,x)=>s+x[1],0)+'枚＋EX'+engine.extra.length+'枚');"""
new="""      const mainCount=engine.main.reduce((s,x)=>s+x[1],0), extraCount=engine.extra.length;
      if(mainCount===0 && extraCount===0){
        $('hybridAnalysisV6').innerHTML+='<div class="hybrid-warn-v6">「'+esc(themeLabel(t))+'」のカードをカードDBから取得できませんでした。混合構築を中止します。カードDB同期または再読み込み後に再試行してください。</div>';
        return;
      }
      injected.push(...expandNames(engine.main),...expandNames(engine.extra));engineNames.push(themeLabel(t)+' '+mainCount+'枚＋EX'+extraCount+'枚');"""
if old in h:
    h=h.replace(old,new,1)
elif "mainCount===0 && extraCount===0" not in h:
    raise SystemExit('engineNames anchor missing')

hybrid.write_text(h,encoding='utf-8')
print('mixed theme v10 applied')
