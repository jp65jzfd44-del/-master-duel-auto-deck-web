from pathlib import Path
import sys,re
root=Path(sys.argv[1])

# Version visible asset URLs so even an old cache-first service worker must go to network.
p=root/'index.html'
s=p.read_text(encoding='utf-8')
assets=['styles.css','app.js','guide-v4.css','guide-v4.js','strategy-v5.css','strategy-v5.js','strategy-v5-score.js','hybrid-v6.css','hybrid-v6.js']
for name in assets:
    s=re.sub(r'(["\'])'+re.escape(name)+r'(?:\?v=\d+)?\1', lambda m: m.group(1)+name+'?v=10'+m.group(1), s)
p.write_text(s,encoding='utf-8')

# Move same-origin requests to network-first, with cache fallback.
p=root/'sw.js'
s=p.read_text(encoding='utf-8')
s=re.sub(r"md-auto-deck-pwa-v\d+","md-auto-deck-pwa-v10",s)
old="""if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html'))));
  }"""
new="""if (url.origin === self.location.origin) {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html'))));
  }"""
if old in s:
    s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('cache v10 applied')
