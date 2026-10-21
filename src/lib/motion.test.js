import { describe, expect, it } from 'vitest'
import { countValue, easeOutCubic } from './motion.js'

describe('count-up timing', () => {
  it('eases from start to end and stops exactly on the target', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(countValue(0, 100, 0, 600)).toBe(0)
    expect(countValue(0, 100, 600, 600)).toBe(100)
    expect(countValue(0, 100, 5000, 600)).toBe(100)
    // Ease-out: well past halfway at the halfway time.
    expect(countValue(0, 100, 300, 600)).toBeGreaterThan(80)
  })

  it('counts down too, and rounds to the requested decimals', () => {
    expect(countValue(2000, 1500, 600, 600)).toBe(1500)
    expect(countValue(10, 12.5, 600, 600, 1)).toBe(12.5)
    expect(Number.isInteger(countValue(0, 7, 200, 600))).toBe(true)
    expect(countValue(3, 9, 0, 0)).toBe(9)
  })
})
