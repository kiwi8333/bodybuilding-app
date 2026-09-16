// Imported into the generated service worker (see vite.config.js).
// Shows reminder notifications and opens the app when one is tapped.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Forge', body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'Forge', {
      body: data.body || '',
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/icon-192.png`,
      tag: data.tag || 'forge',
      data: { url: new URL(data.url || '#/', scope).href },
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only ever open this app. Even a forged payload cannot send you to another
  // site (or a javascript: URL) from a notification tap.
  const scope = self.registration.scope
  let target = scope
  try {
    const wanted = new URL(event.notification.data?.url || scope, scope)
    if (wanted.href.startsWith(scope)) target = wanted.href
  } catch {
    target = scope
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(scope)) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
