// Best-effort per-IP rate limit for the public endpoints. Vercel functions are
// short-lived, so this only remembers recent requests within one instance;
// it stops casual spam and scripted floods without any storage writes. The
// real protection against filling the list is the record cap plus stale
// eviction in handlers.js.

export const WINDOW_MS = 60_000
export const MAX_PER_WINDOW = 20
const MAX_TRACKED_IPS = 5000

const hits = new Map()

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ''
  return first || req.socket?.remoteAddress || 'unknown'
}

/** Returns true when this request is allowed. */
export function allowRequest(ip, now = Date.now(), store = hits) {
  const seen = (store.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (seen.length >= MAX_PER_WINDOW) {
    store.set(ip, seen)
    return false
  }
  seen.push(now)
  store.set(ip, seen)
  if (store.size > MAX_TRACKED_IPS) {
    for (const [key, times] of store) {
      if (!times.length || now - times.at(-1) >= WINDOW_MS) store.delete(key)
      if (store.size <= MAX_TRACKED_IPS) break
    }
  }
  return true
}
