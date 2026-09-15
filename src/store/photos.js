// Progress photos live in IndexedDB on this device (they are too large for
// localStorage). They are never uploaded; they are included in backups only
// if you choose to.

const DB_NAME = 'forge-photos'
const STORE = 'photos'
export const POSES = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
]
export const MAX_PHOTO_CHARS = 3_000_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function openDb(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) return reject(new Error('Photo storage is not available in this browser.'))
    const req = idb.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Photo save was aborted (storage may be full).'))
  })
}

export function validatePhoto(p, path = 'photo') {
  const ok =
    p &&
    typeof p === 'object' &&
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    p.id.length < 80 &&
    DATE_RE.test(p.date) &&
    POSES.some((x) => x.id === p.pose) &&
    typeof p.dataUrl === 'string' &&
    p.dataUrl.startsWith('data:image/jpeg;base64,') &&
    p.dataUrl.length <= MAX_PHOTO_CHARS &&
    /^[A-Za-z0-9+/=]+$/.test(p.dataUrl.slice('data:image/jpeg;base64,'.length))
  if (!ok) throw new Error(`Invalid data at ${path}`)
  return { id: p.id, date: p.date, pose: p.pose, dataUrl: p.dataUrl }
}

export async function listPhotos(idb) {
  const db = await openDb(idb)
  try {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    const rows = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  } finally {
    db.close()
  }
}

export async function addPhoto(photo, idb) {
  const clean = validatePhoto(photo)
  const db = await openDb(idb)
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(clean)
    await txDone(tx)
    return clean
  } finally {
    db.close()
  }
}

export async function deletePhoto(id, idb) {
  const db = await openDb(idb)
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    await txDone(tx)
  } finally {
    db.close()
  }
}

// Replace every photo in one transaction: all or nothing.
export async function replaceAllPhotos(photos, idb) {
  const clean = photos.map((p, i) => validatePhoto(p, `photos[${i}]`))
  const db = await openDb(idb)
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    for (const p of clean) store.put(p)
    await txDone(tx)
  } finally {
    db.close()
  }
}

/**
 * Resize and compress a picked image to a JPEG data URL (longest side
 * 1080 px). Browser-only.
 */
export async function compressImage(file, maxSide = 1080, quality = 0.8) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}
