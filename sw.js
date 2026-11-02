// Service Worker：アプリ一式をキャッシュして、オフラインでも動くようにする
// BUILD_ID と PRECACHE はデプロイ時に scripts/build-sw.mjs が埋め込む
const BUILD_ID = 'dev';
const PRECACHE = [];

const APP_CACHE = `ctfportal-app-${BUILD_ID}`;
const FONT_CACHE = 'ctfportal-fonts-v1';
// OCR（onnxruntime-web と PaddleOCR のモデル）の大きなファイル用。アプリを更新しても消さない（中身はバージョン付きで固定のため）
const OCR_CACHE = 'ctfportal-ocr-v2';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // cache: 'reload' で HTTP キャッシュを経由せず最新を取得する
    await cache.addAll(['./', ...PRECACHE].map((u) => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('ctfportal-app-') && k !== APP_CACHE) || k === 'ctfportal-ocr-v1').map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 画面側から「すぐ新しい版に切り替えて」と言われたとき
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts：キャッシュを先に返し、裏で更新する
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // OCR のエンジン・モデル：初回だけダウンロードし、以後は専用キャッシュから返す
  if (/\/vendor\/(onnxruntime|paddleocr)\//.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(OCR_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // ページ本体：ハッシュ（#codec など）付きでも index.html を返す
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const hit = (await cache.match('./')) || (await cache.match('./index.html'));
      if (hit && BUILD_ID !== 'dev') return hit;
      try {
        return await fetch(req);
      } catch {
        return hit || Response.error();
      }
    })());
    return;
  }

  // アプリのファイル：デプロイ版はキャッシュ優先、開発時（dev）はネットワーク優先
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    if (BUILD_ID !== 'dev') {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await update) || Response.error();
}
