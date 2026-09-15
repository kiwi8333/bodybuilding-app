// Browser side of push reminders: permission, subscription, and keeping the
// sealed reminder data on the server up to date.
import { PUSH_API_URL, SEALING_PUBLIC_KEY, VAPID_PUBLIC_KEY } from '../config/push.js'
import { fromB64u, randomToken, seal, sha256Hex } from './crypto.js'
import { buildPrefs } from './prefs.js'
import { dateKey } from '../logic/state.js'

const LOCAL_KEY = 'forge:push'
const RESYNC_MS = 24 * 60 * 60 * 1000

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? null
  } catch {
    return null
  }
}

function writeLocal(value) {
  try {
    if (value) localStorage.setItem(LOCAL_KEY, JSON.stringify(value))
    else localStorage.removeItem(LOCAL_KEY)
  } catch {
    // Without storage we simply re-sync more often.
  }
}

export function pushConfigured() {
  return Boolean(PUSH_API_URL)
}

export function pushSupport() {
  const hasApis = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true)
  if (isIos && !standalone) return { ok: false, reason: 'ios-install' }
  if (!hasApis) return { ok: false, reason: 'unsupported' }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }
  return { ok: true, permission: Notification.permission }
}

async function post(path, body) {
  const res = await fetch(`${PUSH_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      message = (await res.json()).error ?? message
    } catch {
      // keep status text
    }
    throw new Error(`Reminder server: ${message}`)
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Must be called from a tap (browsers require a user gesture). */
export async function enablePush(state) {
  if (!pushConfigured()) throw new Error('Reminders are not connected to a server yet.')
  const support = pushSupport()
  if (!support.ok) throw new Error(supportMessage(support.reason))
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can allow them in your phone settings.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(VAPID_PUBLIC_KEY) })
  }
  await syncPush(state, { force: true })
}

/**
 * Send the latest sealed prefs if something changed (or once a day).
 * Safe to call often; silently does nothing when push is off.
 */
export async function syncPush(state, { force = false } = {}) {
  if (!pushConfigured() || !state.reminders.enabled) return false
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const sub = await currentSubscription()
  if (!sub) return false

  const local = readLocal() ?? {}
  const token = local.token ?? randomToken()
  const since = local.since ?? dateKey()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const json = sub.toJSON()
  const prefs = buildPrefs(state, { timezone, since })
  const fingerprint = await sha256Hex(JSON.stringify({ endpoint: json.endpoint, prefs }))
  if (!force && local.fingerprint === fingerprint && Date.now() - (local.syncedAt ?? 0) < RESYNC_MS) return false

  const id = await sha256Hex(json.endpoint)
  const sealed = await seal(SEALING_PUBLIC_KEY, { subscription: { endpoint: json.endpoint, keys: json.keys }, prefs })
  await post('/api/subscribe', { id, token, sealed })
  writeLocal({ token, since, fingerprint, syncedAt: Date.now(), id })
  return true
}

export async function disablePush() {
  const local = readLocal()
  let sub = null
  try {
    sub = await currentSubscription()
  } catch {
    sub = null
  }
  if (local?.token && pushConfigured()) {
    const id = local.id ?? (sub ? await sha256Hex(sub.toJSON().endpoint) : null)
    if (id) await post('/api/unsubscribe', { id, token: local.token })
  }
  if (sub) await sub.unsubscribe()
  writeLocal(null)
}

export async function showTestNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Forge reminders are on', {
    body: 'This is how your training reminders will look.',
    icon: `${reg.scope}icons/icon-192.png`,
    tag: 'forge-test',
  })
}

export function supportMessage(reason) {
  if (reason === 'ios-install') return 'On iPhone, first add Forge to your Home Screen (Share → Add to Home Screen), then open it from there to turn on reminders.'
  if (reason === 'denied') return 'Notifications are blocked for this app. Allow them in your phone or browser settings, then try again.'
  return 'This browser does not support notifications. Try Chrome on Android or the Home Screen app on iPhone (iOS 16.4+).'
}
