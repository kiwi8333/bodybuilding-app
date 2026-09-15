// Seals reminder data on the phone so the server only ever stores ciphertext.
// ECDH P-256 (ephemeral key per message) + HKDF-SHA-256 + AES-256-GCM, using
// Web Crypto, which is available in browsers and in Node.js alike.
// Only the scheduled sender holds the private key (as a GitHub secret).

const INFO = new TextEncoder().encode('forge-reminders-v1')

export function toB64u(bytes) {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64u(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(privateKey, publicKey, usage) {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export async function seal(recipientPublicKeyB64u, value) {
  const recipient = await crypto.subtle.importKey('raw', fromB64u(recipientPublicKeyB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const key = await deriveKey(ephemeral.privateKey, recipient, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)))
  const epk = await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  return { v: 1, epk: toB64u(epk), iv: toB64u(iv), ct: toB64u(ct) }
}

export async function open(recipientPrivateJwk, sealed) {
  if (!sealed || sealed.v !== 1) throw new Error('Unsupported sealed payload')
  const priv = await crypto.subtle.importKey('jwk', recipientPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const epk = await crypto.subtle.importKey('raw', fromB64u(sealed.epk), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const key = await deriveKey(priv, epk, 'decrypt')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(sealed.iv) }, key, fromB64u(sealed.ct))
  return JSON.parse(new TextDecoder().decode(pt))
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken() {
  return toB64u(crypto.getRandomValues(new Uint8Array(32)))
}
