import { describe, expect, it } from 'vitest'
import { OFF_ORIGIN, lookupBarcode, normalizeBarcode, parseProduct, portionOf, searchFoods } from './openFoodFacts.js'

const oats = {
  code: '5000000000001',
  product_name: 'Rolled Oats',
  brands: 'Quaker, PepsiCo',
  serving_size: '40 g',
  serving_quantity: 40,
  nutriments: { 'energy-kcal_100g': 375, proteins_100g: 11, carbohydrates_100g: 60, fat_100g: 8 },
}

const fakeFetch = (body, status = 200, seen = []) => async (url) => {
  seen.push(url)
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('Open Food Facts parsing', () => {
  it('reads calories, protein, brand and serving per 100 g', () => {
    expect(parseProduct(oats)).toEqual({
      code: '5000000000001',
      name: 'Rolled Oats',
      brand: 'Quaker',
      kcal100: 375,
      protein100: 11,
      carbs100: 60,
      fat100: 8,
      servingG: 40,
      servingLabel: '40 g',
    })
  })

  it('falls back to kJ and drops products without usable calories or a name', () => {
    expect(parseProduct({ product_name: 'Bread', nutriments: { energy_100g: 1046 } }).kcal100).toBe(250)
    expect(parseProduct({ product_name: 'Mystery', nutriments: {} })).toBeNull()
    expect(parseProduct({ product_name: 'Broken', nutriments: { 'energy-kcal_100g': 5000 } })).toBeNull()
    expect(parseProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
    expect(parseProduct({ product_name: 'Odd protein', nutriments: { 'energy-kcal_100g': 100, proteins_100g: -3 } }).protein100).toBe(0)
  })

  it('works out a portion and keeps the name within the log limit', () => {
    const food = parseProduct(oats)
    expect(portionOf(food, 40)).toEqual({ name: 'Quaker Rolled Oats (40 g)', kcal: 150, protein: 4.4, carbs: 24, fat: 3.2 })
    // Unknown carbs or fat stay unknown rather than becoming zero.
    expect(portionOf({ ...food, carbs100: null, fat100: null }, 40)).toMatchObject({ carbs: null, fat: null })
    const long = { ...food, brand: '', name: 'A'.repeat(80) }
    expect(portionOf(long, 150).name.length).toBeLessThanOrEqual(60)
    expect(portionOf(long, 150).name.endsWith('(150 g)')).toBe(true)
    expect(() => portionOf(food, 0)).toThrow()
    expect(() => portionOf(food, 'abc')).toThrow()
  })

  it('accepts food barcode lengths only', () => {
    expect(normalizeBarcode(' 5000 0000 00001 ')).toBe('5000000000001')
    expect(normalizeBarcode('12345678')).toBe('12345678')
    expect(normalizeBarcode('12345')).toBeNull()
  })
})

describe('Open Food Facts requests', () => {
  it('searches by name and skips duplicates and unusable products', async () => {
    const seen = []
    const body = { products: [oats, { ...oats, code: '2' }, { product_name: 'No calories', nutriments: {} }] }
    const out = await searchFoods('oats', { fetchImpl: fakeFetch(body, 200, seen) })
    expect(out).toHaveLength(1)
    expect(seen[0].startsWith(`${OFF_ORIGIN}/cgi/search.pl?`)).toBe(true)
    expect(seen[0]).toContain('search_terms=oats')
    await expect(searchFoods('o', { fetchImpl: fakeFetch(body) })).rejects.toThrow(/2 letters/)
  })

  it('looks up a barcode, and reports unknown ones as null', async () => {
    const seen = []
    const food = await lookupBarcode('5000000000001', { fetchImpl: fakeFetch({ status: 1, product: oats }, 200, seen) })
    expect(food.name).toBe('Rolled Oats')
    expect(seen[0]).toContain('/api/v2/product/5000000000001.json')
    expect(await lookupBarcode('5000000000001', { fetchImpl: fakeFetch({ status: 0 }, 404) })).toBeNull()
    await expect(lookupBarcode('123', { fetchImpl: fakeFetch({}) })).rejects.toThrow(/barcode/)
  })

  it('retries a failed request before giving up', async () => {
    let calls = 0
    const flaky = async () => {
      calls++
      if (calls < 3) throw new TypeError('Failed to fetch')
      return { ok: true, status: 200, json: async () => ({ products: [oats] }) }
    }
    expect(await searchFoods('oats', { fetchImpl: flaky, retryDelays: [0, 0] })).toHaveLength(1)
    expect(calls).toBe(3)
  })

  it('turns network and server trouble into readable messages', async () => {
    const offline = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(searchFoods('oats', { fetchImpl: offline, retryDelays: [0, 0] })).rejects.toThrow(/reach|offline/)
    await expect(searchFoods('oats', { fetchImpl: fakeFetch({}, 429) })).rejects.toThrow(/busy/)
    await expect(searchFoods('oats', { fetchImpl: fakeFetch({}, 500) })).rejects.toThrow(/problem/)
  })
})
