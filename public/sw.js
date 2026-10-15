/* sw.js：Service Worker，让网站可以"安装"到主屏幕，没网时也能打开上次看过的页面
   规则：
   - 网页、脚本、样式：先上网拿最新的，拿不到才用缓存（network-first），所以改了代码不用担心顾客看到旧版
   - 字体：先用缓存（cache-first），字体不会变
   - /api、/ws、店员后台：永远不缓存（订单和菜单必须是实时的） */
const VERSION = 'hitea-v10';
const CORE = ['./', 'index.html', 'style.css', 'script.js', 'api.js', 'i18n.js', 'pricing.js', 'cup.js', 'photocup.js', 'story.js', 'film.js', 'sound.js', 'media/cup/base.jpg',
  'shop.config.json', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  if (url.origin !== location.origin) return;
  if (/\/(api|ws)(\/|$)/.test(url.pathname) || /admin\.(html|js|css)$/.test(url.pathname)) return;

  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
