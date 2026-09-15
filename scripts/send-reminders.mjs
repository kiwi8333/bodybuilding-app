// Run by .github/workflows/reminders.yml every ~15 minutes.
import { createPrivateKey, sign } from 'node:crypto'
import webpush from 'web-push'
import { runSender } from './lib/sender.js'

const required = ['PUSH_API_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'SEALING_PRIVATE_JWK', 'WORKER_SIGNING_KEY']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`reminders: missing configuration: ${missing.join(', ')}`)
  process.exit(1)
}

const apiUrl = process.env.PUSH_API_URL.replace(/\/+$/, '')
const signingKey = createPrivateKey(process.env.WORKER_SIGNING_KEY)
webpush.setVapidDetails('https://github.com/kiwi8333/bodybuilding-app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)

async function callWorker(payload) {
  const raw = JSON.stringify({ ...payload, ts: Date.now() })
  const signature = sign(null, Buffer.from(raw), signingKey).toString('base64')
  const res = await fetch(`${apiUrl}/api/worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    body: raw,
  })
  if (!res.ok) throw new Error(`worker ${payload.action} failed: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

const result = await runSender({
  callWorker,
  sendPush: (subscription, body) => webpush.sendNotification(subscription, body, { TTL: 6 * 60 * 60, urgency: 'normal' }),
  sealingPrivateJwk: JSON.parse(process.env.SEALING_PRIVATE_JWK),
})
console.log(`reminders: checked ${result.checked}, sent ${result.sent}, removed ${result.removed}`)
