// Offline start: network first (fresh app after a deploy), cache when the network
// is down or too slow. Only same-origin GETs; Apps Script calls pass through.
const CACHE = 'casomira'
const NETWORK_TIMEOUT_MS = 3000

self.addEventListener('install', event => {
  // precache the page and the hashed bundles it references
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const html = await (await fetch('./', { cache: 'reload' })).text()
    const assets = [...html.matchAll(/(?:src|href)="\.?\/?((?:assets\/)[^"]+)"/g)].map(m => './' + m[1])
    await cache.addAll(['./', './favicon.svg', ...assets])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  event.respondWith((async () => {
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
      ])
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put(req, copy))
      return res
    } catch {
      return (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match('./')) ?? Response.error()
    }
  })())
})
