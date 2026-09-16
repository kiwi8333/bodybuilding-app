// Cheap in-process throttle for the public endpoints. Each Vercel invocation
// may run in a fresh instance, so this only catches bursts that happen to land
// on the same warm instance: treat it as a speed bump, not a guarantee. The
// real protections are the durable per-network signup allowance and the record
// cap with stale eviction (handlers.js), which survive across instances.
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
