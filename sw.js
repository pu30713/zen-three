// sw.js (GitHub Pages / 靜態網站)
// 目的：離線/快取加速 + 仍能拿到最新題庫
// 策略：
// - index.html / questions.json：network-first（優先連線，失敗才用快取）
// - 其他靜態資源：cache-first（優先快取）

const CACHE_NAME = "quiz-app-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./questions.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 只處理同網域
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.toLowerCase();

  // 重要：題庫與首頁都要盡量拿最新
  if (path.endsWith("/index.html") || path.endsWith("/questions.json") || path === "/" ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 其他：快取優先
  event.respondWith(cacheFirst(event.request));
});
