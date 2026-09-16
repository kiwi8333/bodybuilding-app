import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MAX_PER_NETWORK, MAX_RECORDS, STALE_DAYS, handleSubscribe, handleUnsubscribe } from '../../api/_lib/handlers.js'
import { MAX_PER_WINDOW, WINDOW_MS, allowRequest, clientIp } from '../../api/_lib/rateLimit.js'
import { randomToken, seal, toB64u } from './crypto.js'
import { completeOnboarding, createInitialState, finishWorkout, normalizeState, startWorkout, updateSet } from '../logic/state.js'

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

async function sample() {
  const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  return seal(toB64u(await crypto.subtle.exportKey('raw', k.publicKey)), { any: 'thing' })
}

const idAt = (i) => i.toString(16).padStart(64, '0')

describe('rate limiting', () => {
  it('allows a burst then blocks, and forgets after the window', () => {
    const store = new Map()
    const t0 = 1_000_000
    for (let i = 0; i < MAX_PER_WINDOW; i++) expect(allowRequest('1.2.3.4', t0 + i, store)).toBe(true)
    expect(allowRequest('1.2.3.4', t0 + MAX_PER_WINDOW, store)).toBe(false)
    // A different caller is unaffected.
    expect(allowRequest('5.6.7.8', t0, store)).toBe(true)
    expect(allowRequest('1.2.3.4', t0 + WINDOW_MS + 1, store)).toBe(true)
  })

  it('reads the caller address from the proxy header', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })).toBe('9.9.9.9')
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1')
    expect(clientIp({ headers: {} })).toBe('unknown')
  })
})

describe('reminder list cannot be squatted', () => {
  it('evicts devices that stopped syncing, but keeps recent ones', async () => {
    const sealed = await sample()
    const now = new Date('2026-09-16T12:00:00Z')
    const old = new Date(now.getTime() - (STALE_DAYS + 1) * 86400000).toISOString()
    const fresh = new Date(now.getTime() - 86400000).toISOString()
    const store = memoryStore(
      Array.from({ length: MAX_RECORDS }, (_, i) => ({ id: idAt(i), tokenHash: 'x', sealed, lastSent: {}, updatedAt: i === 0 ? fresh : old })),
    )
    await handleSubscribe(store, { id: idAt(99), token: randomToken(), sealed }, now)
    expect(store.records.some((r) => r.id === idAt(99))).toBe(true)
    expect(store.records.some((r) => r.id === idAt(0))).toBe(true)
    expect(store.records).toHaveLength(2)
  })

  it('still refuses when every record is in active use', async () => {
    const sealed = await sample()
    const now = new Date('2026-09-16T12:00:00Z')
    const store = memoryStore(
      Array.from({ length: MAX_RECORDS }, (_, i) => ({ id: idAt(i), tokenHash: 'x', sealed, lastSent: {}, updatedAt: now.toISOString() })),
    )
    await expect(handleSubscribe(store, { id: idAt(99), token: randomToken(), sealed }, now)).rejects.toMatchObject({ status: 409 })
    expect(store.records).toHaveLength(MAX_RECORDS)
  })
})

describe('restored files cannot inject odd values', () => {
  function stateWithWorkout() {
    let s = completeOnboarding(createInitialState(), { name: 'G', equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 }, walkSpeed: 3, jogSpeed: 4.5 })
    s = startWorkout(s, 'A')
    s = updateSet(s, 0, 0, { value: 10, done: true })
    return JSON.parse(JSON.stringify(finishWorkout(s)))
  }

  it('rejects non-numeric or absurd targets and trims notes', () => {
    const bad = (mutate) => {
      const s = stateWithWorkout()
      mutate(s)
      return () => normalizeState(s)
    }
    expect(bad((s) => (s.workouts[0].exercises[0].target.sets = '3'))).toThrow(/target.sets/)
    expect(bad((s) => (s.workouts[0].exercises[0].target.high = 9999))).toThrow(/target.high/)
    expect(bad((s) => (s.workouts[0].exercises[0].target.weight = 'heavy'))).toThrow(/target.weight/)
    const s = stateWithWorkout()
    s.workouts[0].exercises[0].target.note = 'x'.repeat(5000)
    s.workouts[0].exercises[0].target.injected = { evil: true }
    const clean = normalizeState(s).workouts[0].exercises[0].target
    expect(clean.note).toHaveLength(300)
    expect(clean.injected).toBeUndefined()
  })
})

describe('shipped policies', () => {
  it('the service worker only ever opens this app', () => {
    const sw = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8')
    expect(sw).toMatch(/wanted\.href\.startsWith\(scope\)/)
    expect(sw).not.toMatch(/const target = event\.notification\.data\?\.url/)
  })

  it('the build injects a content security policy that blocks foreign scripts', async () => {
    const { default: config } = await import('../../vite.config.js')
    const plugin = config.plugins.flat().find((p) => p?.name === 'forge-csp')
    process.env.VITE_PUSH_API_URL = 'https://bodybuilding-app-pied.vercel.app/'
    const { tags } = plugin.transformIndexHtml('<html></html>')
    const csp = tags[0].attrs.content
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("connect-src 'self' https://bodybuilding-app-pied.vercel.app")
    expect(csp).toContain("base-uri 'self'")
  })
})

describe('one network cannot fill the list', () => {
  it('holds at most a few entries at once, and frees a slot when one is removed', async () => {
    const sealed = await sample()
    const store = memoryStore()
    const now = new Date('2026-09-16T09:00:00Z')
    const ip = '203.0.113.9'
    const tokens = []
    for (let i = 0; i < MAX_PER_NETWORK; i++) {
      const token = randomToken()
      tokens.push(token)
      await handleSubscribe(store, { id: idAt(i), token, sealed }, now, { ip })
    }
    await expect(handleSubscribe(store, { id: idAt(50), token: randomToken(), sealed }, now, { ip })).rejects.toMatchObject({ status: 429 })
    // Another network is unaffected.
    await handleSubscribe(store, { id: idAt(51), token: randomToken(), sealed }, now, { ip: '198.51.100.4' })
    // Removing one frees the slot straight away.
    await handleUnsubscribe(store, { id: idAt(0), token: tokens[0] })
    await handleSubscribe(store, { id: idAt(52), token: randomToken(), sealed }, now, { ip })
    expect(store.records.filter((r) => r.id === idAt(52))).toHaveLength(1)
  })

  it('never limits a phone updating its own entry, and stores no raw address', async () => {
    const sealed = await sample()
    const store = memoryStore()
    const now = new Date('2026-09-16T09:00:00Z')
    const token = randomToken()
    const ip = '203.0.113.9'
    await handleSubscribe(store, { id: idAt(1), token, sealed }, now, { ip })
    for (let i = 0; i < MAX_PER_NETWORK + 3; i++) {
      expect((await handleSubscribe(store, { id: idAt(1), token, sealed }, now, { ip })).status).toBe(200)
    }
    expect(JSON.stringify(store.records)).not.toContain(ip)
    expect(store.records[0].ipHash).toMatch(/^[0-9a-f]{16}$/)
  })
})
