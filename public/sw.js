// Las navegaciones siempre intentan la red primero: asi un nuevo deploy no se
// queda oculto tras una copia antigua de index.html. Los bundles de Vite llevan
// hash en su URL y si son seguros para cache-first cuando el usuario no tiene
// conexion.
const ASSET_CACHE = 'palaxis-assets-v3'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== ASSET_CACHE).map((key) => caches.delete(key)),
  )))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
      try {
        const response = await fetch(event.request)
        if (response.ok) await cache.put('/', response.clone())
        return response
      } catch {
        return (await cache.match('/')) ?? Response.error()
      }
    }))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    }))
  }
})
