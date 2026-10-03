from pathlib import Path
import sys
root=Path(sys.argv[1])
index=root/'index.html'
app=root/'app.js'
hybrid=root/'hybrid-v6.js'
styles=root/'styles.css'

s=index.read_text(encoding='utf-8')
if 'themeTextV8' not in s:
    old='''          <select id="themeSelect">
            <option value="">テーマを選択してください ▼</option>
          </select>'''
    new='''          <select id="themeSelect">
            <option value="">テーマを選択してください ▼</option>
          </select>
          <div class="theme-manual-v8">
            <span>またはテーマ名を直接入力</span>
            <input id="themeTextV8" type="text" placeholder="例：ミミグル / Mimighoul" autocomplete="off" />
          </div>'''
    if old not in s:
        raise SystemExit('themeSelect anchor not found')
    s=s.replace(old,new,1)
index.write_text(s,encoding='utf-8')

a=app.read_text(encoding='utf-8')
old="""    const selectedTheme = String($('themeSelect')?.value || '').trim();
    const rawTheme = selectedThemeLabel();"""
new="""    const typedThemeV8 = String($('themeTextV8')?.value || '').trim();
    const typedMatchV8 = typedThemeV8 ? freeThemeMatches(typedThemeV8)[0] : null;
    const selectedTheme = typedThemeV8 ? String(typedMatchV8?.archetype || typedThemeV8).trim() : String($('themeSelect')?.value || '').trim();
    const rawTheme = typedThemeV8 || selectedThemeLabel();"""
if old in a:
    a=a.replace(old,new,1)
elif 'typedThemeV8' not in a:
    raise SystemExit('buildDeck theme anchor not found')
anchor="""  function selectedThemeLabel() {
    const select = $('themeSelect');
    if (!select || !select.value) return '';
    const opt = select.selectedOptions?.[0];
    return String(opt?.dataset?.displayLabel || opt?.textContent || select.value).trim();
  }"""
extra=anchor+"""

  function bindThemeTextV8() {
    const select = $('themeSelect');
    const input = $('themeTextV8');
    if (!select || !input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    select.addEventListener('change', () => {
      const opt = select.selectedOptions?.[0];
      if (select.value && opt) input.value = String(opt.dataset?.displayLabel || opt.textContent || select.value).trim();
    });
    input.addEventListener('input', () => {
      const q = String(input.value || '').trim();
      if (!q) return;
      const hit = freeThemeMatches(q)[0];
      if (hit) setThemeSelection(hit.archetype, hit.label || q);
    });
  }"""
if 'function bindThemeTextV8()' not in a:
    if anchor not in a:
        raise SystemExit('selectedThemeLabel anchor missing')
    a=a.replace(anchor,extra,1)
call_anchor="""    $('buildBtn').addEventListener('click', buildDeck);"""
if 'bindThemeTextV8();' not in a:
    if call_anchor not in a:
        raise SystemExit('build listener anchor missing')
    a=a.replace(call_anchor,"""    bindThemeTextV8();
    $('buildBtn').addEventListener('click', buildDeck);""",1)
app.write_text(a,encoding='utf-8')

h=hybrid.read_text(encoding='utf-8')
if 'hybridPrimaryTextV8' not in h:
    old="""<div class="hybrid-grid-v6"><label>主軸テーマ<select id="hybridPrimaryV6"></select></label><label>混ぜるテーマ①<select id="hybridSecondV6"></select></label><label>混ぜるテーマ②<select id="hybridThirdV6"></select></label><label>混合比率<select id="hybridRatioV6">"""
    new="""<div class="hybrid-grid-v6"><label>主軸テーマ<select id="hybridPrimaryV6"></select><span class="hybrid-or-v8">または直接入力</span><input id="hybridPrimaryTextV8" type="text" placeholder="例：ミミグル / Mimighoul" autocomplete="off"></label><label>混ぜるテーマ①<select id="hybridSecondV6"></select><span class="hybrid-or-v8">または直接入力</span><input id="hybridSecondTextV8" type="text" placeholder="例：ヘカトンケイル" autocomplete="off"></label><label>混ぜるテーマ②<select id="hybridThirdV6"></select><span class="hybrid-or-v8">または直接入力</span><input id="hybridThirdTextV8" type="text" placeholder="必要な場合だけ入力" autocomplete="off"></label><label>混合比率<select id="hybridRatioV6">"""
    if old not in h:
        raise SystemExit('hybrid UI anchor missing')
    h=h.replace(old,new,1)
old="""  function detectPlanFromUI(text){
    const detected=detectThemes(text), p=$('hybridPrimaryV6')?.value||'',s=$('hybridSecondV6')?.value||'',t=$('hybridThirdV6')?.value||'';
    const themes=[p,s,t,...detected].map(canonicalTheme).filter(Boolean);return [...new Set(themes)].slice(0,3);
  }"""
new="""  function detectPlanFromUI(text){
    const detected=detectThemes(text);
    const p=String($('hybridPrimaryTextV8')?.value||'').trim() || $('hybridPrimaryV6')?.value || '';
    const s=String($('hybridSecondTextV8')?.value||'').trim() || $('hybridSecondV6')?.value || '';
    const t=String($('hybridThirdTextV8')?.value||'').trim() || $('hybridThirdV6')?.value || '';
    const themes=[p,s,t,...detected].map(canonicalTheme).filter(Boolean);return [...new Set(themes)].slice(0,3);
  }"""
if old in h:
    h=h.replace(old,new,1)
elif 'hybridPrimaryTextV8' not in h:
    raise SystemExit('detectPlanFromUI anchor missing')
sync_anchor="""    const opts=optionThemes();selectOptions($('hybridPrimaryV6'),opts,'自動判定');selectOptions($('hybridSecondV6'),opts,'自動判定');selectOptions($('hybridThirdV6'),opts,'なし / 自動');"""
sync_new=sync_anchor+"""
    [['hybridPrimaryV6','hybridPrimaryTextV8'],['hybridSecondV6','hybridSecondTextV8'],['hybridThirdV6','hybridThirdTextV8']].forEach(([sid,iid])=>{const s=$(sid),i=$(iid);if(!s||!i)return;s.addEventListener('change',()=>{const o=s.selectedOptions?.[0];if(s.value&&o)i.value=(o.textContent||s.value).trim();});});"""
if 'hybridThirdTextV8' in h and "hybridPrimaryV6','hybridPrimaryTextV8" not in h:
    if sync_anchor not in h:
        raise SystemExit('hybrid selectOptions anchor missing')
    h=h.replace(sync_anchor,sync_new,1)
hybrid.write_text(h,encoding='utf-8')

c=styles.read_text(encoding='utf-8')
css='''
/* v8: dropdown + direct text entry for themes */
.theme-manual-v8{margin-top:9px;display:grid;gap:5px}.theme-manual-v8 span,.hybrid-or-v8{font-size:12px;color:var(--muted,#aebbd0)}.theme-manual-v8 input,#hybridBuilderV6 input[id$="TextV8"]{width:100%;box-sizing:border-box;min-height:44px;border:1px solid rgba(111,169,236,.45);border-radius:10px;background:rgba(7,17,30,.45);color:inherit;padding:10px 12px}.hybrid-or-v8{display:block;margin-top:6px;margin-bottom:3px}@media(max-width:980px){.theme-manual-v8 input,#hybridBuilderV6 input[id$="TextV8"]{font-size:16px}}
'''
if 'v8: dropdown + direct text entry' not in c:
    c+=css
styles.write_text(c,encoding='utf-8')
print('theme input v8 applied')
