// Food search and barcode lookup using Open Food Facts, a free, open
// database of packaged foods (https://world.openfoodfacts.org). Only the
// search words or the barcode are sent; nothing about you or your log.
//
// Everything that comes back is checked before it is shown: products without
// usable calories are dropped and numbers are kept to sane ranges.

export const OFF_ORIGIN = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,nutriments,serving_size,serving_quantity'
const TIMEOUT_MS = 12000

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const toNum = (v) => (isNum(v) ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
const clean = (s, max) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/**
 * One product from the API → { code, name, brand, kcal100, protein100,
 * servingG, servingLabel } per 100 g, or null when it has no usable calories.
 */
export function parseProduct(p) {
  if (!p || typeof p !== 'object') return null
  const n = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {}
  let kcal = toNum(n['energy-kcal_100g'])
  if (!Number.isFinite(kcal)) {
    const kj = toNum(n.energy_100g)
    if (Number.isFinite(kj)) kcal = kj / 4.184
  }
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 950) return null
  let protein = toNum(n.proteins_100g)
  if (!Number.isFinite(protein) || protein < 0 || protein > 100) protein = 0
  const name = clean(p.product_name, 80) || clean(p.product_name_en, 80) || clean(p.generic_name, 80)
  if (!name) return null
  const serving = toNum(p.serving_quantity)
  const hasServing = Number.isFinite(serving) && serving > 0 && serving <= 2000
  return {
    code: clean(String(p.code ?? ''), 20),
    name,
    brand: clean(String(p.brands ?? '').split(',')[0], 40),
    kcal100: Math.round(kcal),
    protein100: Math.round(protein * 10) / 10,
    servingG: hasServing ? Math.round(serving * 10) / 10 : null,
    servingLabel: hasServing ? clean(p.serving_size, 30) || `${Math.round(serving)} g` : null,
  }
}

/**
 * Calories and protein for an amount in grams, as a log entry
 * ({ name, kcal, protein }) the food log accepts.
 */
export function portionOf(food, grams) {
  const g = Number(grams)
  if (!Number.isFinite(g) || g <= 0 || g > 3000) throw new Error('Enter an amount between 1 and 3000 g.')
  const amount = `${Math.round(g * 10) / 10} g`
  const label = food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.brand} ${food.name}` : food.name
  // The log keeps names to 60 characters; shorten the product, keep the amount.
  const room = 60 - amount.length - 3
  const shortLabel = label.length > room ? `${label.slice(0, room - 1).trimEnd()}…` : label
  return {
    name: `${shortLabel} (${amount})`,
    kcal: Math.round((food.kcal100 * g) / 100),
    protein: Math.round(((food.protein100 * g) / 100) * 10) / 10,
  }
}

// Barcodes on food are EAN-8, UPC-A (12), EAN-13 or GTIN-14.
export function normalizeBarcode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return [8, 12, 13, 14].includes(digits.length) ? digits : null
}

const RETRY_DELAYS_MS = [1200, 2500, 4000]
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchOnce(url, fetchImpl) {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null
  try {
    return await fetchImpl(url, { signal: controller?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function getJson(url, fetchImpl, retryDelays = RETRY_DELAYS_MS) {
  // A search the database has not served recently first gets a "temporarily
  // unavailable" page without the headers a browser needs, which looks like a
  // network failure. The real answer follows within a few seconds, so retry.
  let res
  for (let attempt = 0; !res; attempt++) {
    try {
      res = await fetchOnce(url, fetchImpl)
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (offline) throw new Error('You are offline. Food search needs an internet connection.')
      if (attempt >= retryDelays.length) throw new Error('Could not reach the food database. Try again in a moment.')
      await wait(retryDelays[attempt])
    }
  }
  if (res.status === 404) return null
  if (res.status === 429) throw new Error('The food database is busy. Wait a minute and search again.')
  if (!res.ok) throw new Error('The food database had a problem. Try again in a moment.')
  try {
    return await res.json()
  } catch {
    throw new Error('The food database sent an unreadable answer. Try again.')
  }
}

export async function searchFoods(query, { fetchImpl = fetch, retryDelays } = {}) {
  const q = clean(query, 80)
  if (q.length < 2) throw new Error('Type at least 2 letters to search.')
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '24', fields: FIELDS })
  const data = await getJson(`${OFF_ORIGIN}/cgi/search.pl?${params}`, fetchImpl, retryDelays)
  const products = Array.isArray(data?.products) ? data.products : []
  const seen = new Set()
  const out = []
  for (const p of products) {
    const food = parseProduct(p)
    if (!food) continue
    const key = `${food.brand}|${food.name}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(food)
  }
  return out
}

// Returns the product, or null when the barcode is not in the database.
export async function lookupBarcode(raw, { fetchImpl = fetch, retryDelays } = {}) {
  const code = normalizeBarcode(raw)
  if (!code) throw new Error('That does not look like a food barcode (8, 12, 13 or 14 digits).')
  const data = await getJson(`${OFF_ORIGIN}/api/v2/product/${code}.json?fields=${FIELDS}`, fetchImpl, retryDelays)
  if (!data || data.status === 0 || !data.product) return null
  return parseProduct({ code, ...data.product })
}
