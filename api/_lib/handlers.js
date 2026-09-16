// Request handling for the reminders API, independent of Vercel so it can be
// unit-tested with an in-memory store.
//
// The server never sees reminder settings or push endpoints in plain text:
// phones send them sealed (see src/reminders/crypto.js). Each record is
// guarded by a secret token only the phone knows (stored as a hash). The
// scheduled sender authenticates with an Ed25519 signature.

import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto'

export const MAX_RECORDS = 25
// A phone re-syncs its reminder data at least daily, so anything untouched for
// this long is from a device that is gone (or junk) and may be evicted to make
// room for a real one.
export const STALE_DAYS = 45
export const MAX_BODY_BYTES = 8192
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

const ID_RE = /^[0-9a-f]{64}$/
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const B64U_RE = /^[A-Za-z0-9_-]+$/
const TYPES = new Set(['train', 'missed', 'backup'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

function sameHash(a, b) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}

function checkSealed(sealed) {
  const ok =
    sealed &&
    typeof sealed === 'object' &&
    sealed.v === 1 &&
    ['epk', 'iv', 'ct'].every((k) => typeof sealed[k] === 'string' && B64U_RE.test(sealed[k])) &&
    sealed.epk.length === 87 &&
    sealed.iv.length === 16 &&
    sealed.ct.length <= 6000
  if (!ok) throw new HttpError(400, 'Invalid sealed payload')
  return { v: 1, epk: sealed.epk, iv: sealed.iv, ct: sealed.ct }
}

export async function handleSubscribe(store, body, now = new Date()) {
  const { id, token } = body ?? {}
  if (!ID_RE.test(id ?? '') || !TOKEN_RE.test(token ?? '')) throw new HttpError(400, 'Invalid id or token')
  const sealed = checkSealed(body.sealed)
  const tokenHash = sha256(token)
  let status = 201
  await store.update((records) => {
    const existing = records.find((r) => r.id === id)
    if (existing) {
      if (!sameHash(existing.tokenHash, tokenHash)) throw new HttpError(403, 'Not allowed')
      status = 200
      return records.map((r) => (r.id === id ? { ...r, sealed, updatedAt: now.toISOString() } : r))
    }
    // When full, drop devices that stopped syncing long ago so a real phone
    // can always register.
    let kept = records
    if (kept.length >= MAX_RECORDS) {
      const cutoff = now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000
      kept = kept.filter((r) => Date.parse(r.updatedAt ?? 0) >= cutoff)
    }
    if (kept.length >= MAX_RECORDS) throw new HttpError(409, 'Reminder list is full')
    return [...kept, { id, tokenHash, sealed, lastSent: {}, updatedAt: now.toISOString() }]
  })
  return { status, body: { ok: true } }
}

export async function handleUnsubscribe(store, body) {
  const { id, token } = body ?? {}
  if (!ID_RE.test(id ?? '') || !TOKEN_RE.test(token ?? '')) throw new HttpError(400, 'Invalid id or token')
  const tokenHash = sha256(token)
  await store.update((records) => {
    const existing = records.find((r) => r.id === id)
    if (!existing) return records
    if (!sameHash(existing.tokenHash, tokenHash)) throw new HttpError(403, 'Not allowed')
    return records.filter((r) => r.id !== id)
  })
  return { status: 200, body: { ok: true } }
}

/**
 * Sender requests: rawBody is the exact JSON text that was signed.
 * { action: 'list' } | { action: 'mark', marks: [{id,type,date}] } | { action: 'remove', ids: [...] }
 * plus ts (ms since epoch).
 */
export async function handleWorker(store, rawBody, signatureB64, publicKeyPem, now = Date.now()) {
  if (typeof signatureB64 !== 'string' || !signatureB64) throw new HttpError(401, 'Missing signature')
  const ok = verify(null, Buffer.from(rawBody), createPublicKey(publicKeyPem), Buffer.from(signatureB64, 'base64'))
  if (!ok) throw new HttpError(401, 'Bad signature')
  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
  if (!Number.isFinite(body.ts) || Math.abs(now - body.ts) > SIGNATURE_MAX_AGE_MS) throw new HttpError(401, 'Stale request')

  if (body.action === 'list') {
    const records = await store.read()
    return { status: 200, body: { records: records.map(({ id, sealed, lastSent }) => ({ id, sealed, lastSent })) } }
  }
  if (body.action === 'mark') {
    const marks = Array.isArray(body.marks) ? body.marks : []
    if (!marks.every((m) => ID_RE.test(m.id) && TYPES.has(m.type) && DATE_RE.test(m.date))) throw new HttpError(400, 'Invalid marks')
    await store.update((records) =>
      records.map((r) => {
        const mine = marks.filter((m) => m.id === r.id)
        if (!mine.length) return r
        const lastSent = { ...r.lastSent }
        for (const m of mine) lastSent[m.type] = m.date
        return { ...r, lastSent }
      }),
    )
    return { status: 200, body: { ok: true } }
  }
  if (body.action === 'remove') {
    const ids = new Set(Array.isArray(body.ids) ? body.ids.filter((x) => ID_RE.test(x)) : [])
    await store.update((records) => records.filter((r) => !ids.has(r.id)))
    return { status: 200, body: { ok: true } }
  }
  throw new HttpError(400, 'Unknown action')
}

// ---------- HTTP plumbing shared by the Vercel functions ----------

export const ALLOWED_ORIGINS = ['https://kiwi8333.github.io', 'http://localhost:4173', 'http://localhost:5173']

export function applyCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature')
  res.setHeader('Access-Control-Max-Age', '86400')
}

export async function readRawBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500
  if (status === 500) console.error(err)
  res.status(status).json({ error: status === 500 ? 'Server error' : err.message })
}
