import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign, webcrypto } from 'node:crypto'
import { addDays, daysBetween, dueNotification, localParts } from './schedule.js'
import { open, randomToken, seal, sha256Hex, toB64u } from './crypto.js'
import { HttpError, MAX_RECORDS, handleSubscribe, handleUnsubscribe, handleWorker } from '../../api/_lib/handlers.js'
import { runSender } from '../../scripts/lib/sender.js'
import { buildPrefs } from './prefs.js'
import { completeOnboarding, createInitialState, finishWorkout, startWorkout, updateReminders } from '../logic/state.js'

const basePrefs = {
  timezone: 'Europe/London',
  days: [1, 3, 5],
  time: '18:00',
  nudgeMissed: true,
  nudgeBackup: true,
  since: '2026-09-01',
  lastWorkoutDate: '2026-09-11',
  lastBackupDate: '2026-09-13',
  nextWorkoutName: 'Workout B',
  nextWorkoutMinutes: 61,
  deloadActive: false,
}

describe('schedule', () => {
  it('reads local time in the subscriber timezone', () => {
    expect(localParts(new Date('2026-09-14T17:30:00Z'), 'Europe/London')).toEqual({ date: '2026-09-14', weekday: 1, minutes: 1110 })
    expect(localParts(new Date('2026-09-14T02:00:00Z'), 'America/New_York')).toEqual({ date: '2026-09-13', weekday: 0, minutes: 1320 })
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-13', '2026-09-20')).toBe(7)
  })

  it('sends the training reminder once, inside the window, on training days', () => {
    const at = (iso) => dueNotification(basePrefs, {}, new Date(iso))
    expect(at('2026-09-14T17:30:00Z')).toMatchObject({ type: 'train', date: '2026-09-14', title: 'Time to train: Workout B' })
    expect(at('2026-09-14T16:59:00Z')).toBeNull() // 17:59 local
    expect(at('2026-09-14T19:59:00Z')).not.toBeNull() // 20:59 local, still in window
    expect(at('2026-09-14T20:00:00Z')).toBeNull() // 21:00 local, window closed
    expect(dueNotification(basePrefs, { train: '2026-09-14' }, new Date('2026-09-14T17:30:00Z'))).toBeNull()
    expect(dueNotification({ ...basePrefs, lastWorkoutDate: '2026-09-14' }, {}, new Date('2026-09-14T17:30:00Z'))).toBeNull()
    expect(at('2026-09-15T17:30:00Z')?.type).not.toBe('train') // Tuesday
  })

  it('respects the timezone', () => {
    const ny = { ...basePrefs, timezone: 'America/New_York' }
    expect(dueNotification(ny, {}, new Date('2026-09-14T17:30:00Z'))).toBeNull() // 13:30 in New York
    expect(dueNotification(ny, {}, new Date('2026-09-14T22:30:00Z'))?.type).toBe('train')
  })

  it('nudges the day after a missed session, once', () => {
    const tue = new Date('2026-09-15T17:30:00Z')
    expect(dueNotification(basePrefs, {}, tue)).toMatchObject({ type: 'missed', title: 'Missed yesterday’s session?' })
    expect(dueNotification(basePrefs, { missed: '2026-09-15' }, tue)).toBeNull()
    expect(dueNotification({ ...basePrefs, lastWorkoutDate: '2026-09-14' }, {}, tue)).toBeNull()
    expect(dueNotification({ ...basePrefs, nudgeMissed: false }, {}, tue)).toBeNull()
    expect(dueNotification({ ...basePrefs, since: '2026-09-15' }, {}, tue)).toBeNull()
  })

  it('reminds to back up on Sundays when a week has passed', () => {
    const sun = new Date('2026-09-20T17:30:00Z')
    expect(dueNotification(basePrefs, {}, sun)).toMatchObject({ type: 'backup', url: '#/settings' })
    expect(dueNotification({ ...basePrefs, lastBackupDate: '2026-09-15' }, {}, sun)).toBeNull()
    expect(dueNotification({ ...basePrefs, lastBackupDate: null, since: '2026-09-18' }, {}, sun)).toBeNull()
    expect(dueNotification({ ...basePrefs, nudgeBackup: false }, {}, sun)).toBeNull()
  })

  it('mentions deload sessions and ignores invalid timezones', () => {
    expect(dueNotification({ ...basePrefs, deloadActive: true }, {}, new Date('2026-09-14T17:30:00Z')).title).toBe('Deload session: Workout B')
    expect(dueNotification({ ...basePrefs, timezone: 'Mars/Olympus' }, {}, new Date('2026-09-14T17:30:00Z'))).toBeNull()
  })
})

describe('prefs built from app state', () => {
  it('summarises only what reminders need', () => {
    let s = completeOnboarding(createInitialState(), { name: 'G', equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 }, walkSpeed: 3, jogSpeed: 4.5 })
    s = updateReminders(s, { enabled: true, days: [1, 3, 5], time: '18:00' })
    s = finishWorkout(startWorkout(s, 'A', new Date('2026-09-14T09:00:00Z')), new Date('2026-09-14T10:00:00Z'))
    const p = buildPrefs(s, { timezone: 'Europe/London', since: '2026-09-01' })
    expect(p).toMatchObject({ timezone: 'Europe/London', days: [1, 3, 5], time: '18:00', lastWorkoutDate: '2026-09-14', nextWorkoutName: 'Workout B', deloadActive: false, since: '2026-09-01' })
    expect(p.nextWorkoutMinutes).toBeGreaterThan(40)
    expect(Object.keys(p)).not.toContain('workouts')
  })
})

describe('sealing', () => {
  async function keypair() {
    const k = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    return {
      pub: toB64u(await webcrypto.subtle.exportKey('raw', k.publicKey)),
      jwk: await webcrypto.subtle.exportKey('jwk', k.privateKey),
    }
  }

  it('round-trips and uses a fresh ephemeral key and IV each time', async () => {
    const { pub, jwk } = await keypair()
    const value = { subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } }, prefs: basePrefs }
    const a = await seal(pub, value)
    const b = await seal(pub, value)
    expect(a.ct).not.toBe(b.ct)
    expect(a.epk).toHaveLength(87)
    expect(a.iv).toHaveLength(16)
    expect(await open(jwk, a)).toEqual(value)
  })

  it('fails with the wrong key or tampered data', async () => {
    const one = await keypair()
    const two = await keypair()
    const sealed = await seal(one.pub, { hello: 'world' })
    await expect(open(two.jwk, sealed)).rejects.toThrow()
    const flipped = sealed.ct[5] === 'A' ? 'B' : 'A'
    await expect(open(one.jwk, { ...sealed, ct: sealed.ct.slice(0, 5) + flipped + sealed.ct.slice(6) })).rejects.toThrow()
  })

  it('hashes and makes tokens of the expected shape', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

function memoryStore(initial = []) {
  let records = initial
  return {
    get records() {
      return records
    },
    async read() {
      return records
    },
    async update(fn) {
      records = fn(records)
      return records
    },
  }
}

async function sealedSample() {
  const k = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const pub = toB64u(await webcrypto.subtle.exportKey('raw', k.publicKey))
  return seal(pub, { any: 'thing' })
}

describe('reminders API', () => {
  const id = 'a'.repeat(64)

  it('subscribes, updates with the same token, and rejects a different token', async () => {
    const store = memoryStore()
    const token = randomToken()
    const sealed = await sealedSample()
    expect((await handleSubscribe(store, { id, token, sealed })).status).toBe(201)
    expect(store.records[0].tokenHash).not.toBe(token)
    expect((await handleSubscribe(store, { id, token, sealed })).status).toBe(200)
    await expect(handleSubscribe(store, { id, token: randomToken(), sealed })).rejects.toMatchObject({ status: 403 })
    expect(store.records).toHaveLength(1)
  })

  it('validates input and caps the number of records', async () => {
    const store = memoryStore()
    const sealed = await sealedSample()
    await expect(handleSubscribe(store, { id: 'nope', token: randomToken(), sealed })).rejects.toBeInstanceOf(HttpError)
    await expect(handleSubscribe(store, { id, token: randomToken(), sealed: { ...sealed, epk: 'short' } })).rejects.toMatchObject({ status: 400 })
    for (let i = 0; i < MAX_RECORDS; i++) {
      await handleSubscribe(store, { id: i.toString(16).padStart(64, '0'), token: randomToken(), sealed })
    }
    await expect(handleSubscribe(store, { id: 'f'.repeat(64), token: randomToken(), sealed })).rejects.toMatchObject({ status: 409 })
  })

  it('unsubscribes only with the right token', async () => {
    const store = memoryStore()
    const token = randomToken()
    await handleSubscribe(store, { id, token, sealed: await sealedSample() })
    await expect(handleUnsubscribe(store, { id, token: randomToken() })).rejects.toMatchObject({ status: 403 })
    await handleUnsubscribe(store, { id, token })
    expect(store.records).toHaveLength(0)
  })

  it('worker requests need a fresh valid signature', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const pem = publicKey.export({ type: 'spki', format: 'pem' })
    const store = memoryStore([{ id, tokenHash: 'x', sealed: { v: 1 }, lastSent: {} }])
    const call = (payload, key = privateKey, now = Date.now()) => {
      const raw = JSON.stringify(payload)
      return handleWorker(store, raw, sign(null, Buffer.from(raw), key).toString('base64'), pem, now)
    }
    const listed = await call({ action: 'list', ts: Date.now() })
    expect(listed.body.records).toEqual([{ id, sealed: { v: 1 }, lastSent: {} }])
    expect(listed.body.records[0].tokenHash).toBeUndefined()

    await expect(call({ action: 'list', ts: Date.now() }, generateKeyPairSync('ed25519').privateKey)).rejects.toMatchObject({ status: 401 })
    await expect(call({ action: 'list', ts: Date.now() - 10 * 60 * 1000 })).rejects.toMatchObject({ status: 401 })
    await expect(handleWorker(store, JSON.stringify({ action: 'list', ts: Date.now() }), '', pem)).rejects.toMatchObject({ status: 401 })

    await call({ action: 'mark', ts: Date.now(), marks: [{ id, type: 'train', date: '2026-09-14' }] })
    expect(store.records[0].lastSent).toEqual({ train: '2026-09-14' })
    await expect(call({ action: 'mark', ts: Date.now(), marks: [{ id, type: 'hack', date: 'x' }] })).rejects.toMatchObject({ status: 400 })
    await call({ action: 'remove', ts: Date.now(), ids: [id] })
    expect(store.records).toHaveLength(0)
  })
})

describe('sender', () => {
  it('sends due reminders, marks them, and removes dead subscriptions', async () => {
    const k = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const pub = toB64u(await webcrypto.subtle.exportKey('raw', k.publicKey))
    const jwk = await webcrypto.subtle.exportKey('jwk', k.privateKey)
    const sub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } })
    const records = [
      { id: '1'.repeat(64), sealed: await seal(pub, { subscription: sub(1), prefs: basePrefs }), lastSent: {} },
      { id: '2'.repeat(64), sealed: await seal(pub, { subscription: sub(2), prefs: basePrefs }), lastSent: { train: '2026-09-14' } },
      { id: '3'.repeat(64), sealed: await seal(pub, { subscription: sub(3), prefs: basePrefs }), lastSent: {} },
      { id: '4'.repeat(64), sealed: { v: 1, epk: 'x', iv: 'y', ct: 'z' }, lastSent: {} },
    ]
    const calls = []
    const pushes = []
    const result = await runSender({
      now: new Date('2026-09-14T17:30:00Z'),
      sealingPrivateJwk: jwk,
      log: { warn: () => {}, error: () => {} },
      callWorker: async (payload) => {
        calls.push(payload)
        return payload.action === 'list' ? { records } : { ok: true }
      },
      sendPush: async (subscription, body) => {
        if (subscription.endpoint.endsWith('/3')) throw Object.assign(new Error('gone'), { statusCode: 410 })
        pushes.push({ endpoint: subscription.endpoint, body: JSON.parse(body) })
      },
    })
    expect(result).toEqual({ checked: 4, sent: 1, removed: 1 })
    expect(pushes).toEqual([{ endpoint: 'https://push.example/1', body: { title: 'Time to train: Workout B', body: expect.any(String), url: '#/', tag: 'forge-train' } }])
    expect(calls.map((c) => c.action)).toEqual(['list', 'mark', 'remove'])
    expect(calls[1].marks).toEqual([{ id: '1'.repeat(64), type: 'train', date: '2026-09-14' }])
    expect(calls[2].ids).toEqual(['3'.repeat(64)])
  })
})
