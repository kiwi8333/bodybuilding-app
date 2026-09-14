import { describe, expect, it } from 'vitest'
import { TRACKS } from '../data/tracks.js'
import { evaluate, initialTrackState, prescribe } from './progression.js'
import { availableWeights, formatKg, nextWeightDown, nextWeightUp, roundDownToAvailable } from './weights.js'

const EQ = { minWeight: 2.5, increment: 2.5, maxWeight: 15 }
const sets = (values, weight) => values.map((value) => ({ value, weight }))

describe('weights', () => {
  it('lists every loadable weight without float drift', () => {
    expect(availableWeights(EQ)).toEqual([2.5, 5, 7.5, 10, 12.5, 15])
    expect(availableWeights({ minWeight: 1, increment: 1.25, maxWeight: 6 })).toEqual([1, 2.25, 3.5, 4.75, 6])
    expect(availableWeights({ minWeight: 0.5, increment: 0.1, maxWeight: 0.8 })).toEqual([0.5, 0.6, 0.7, 0.8])
  })

  it('adds bodyweight (0) only when allowed', () => {
    expect(availableWeights(EQ, { allowBodyweight: true })).toEqual([0, 2.5, 5, 7.5, 10, 12.5, 15])
  })

  it('rounds down, steps up and steps down within the set', () => {
    const w = availableWeights(EQ)
    expect(roundDownToAvailable(9.9, w)).toBe(7.5)
    expect(roundDownToAvailable(1, w)).toBe(2.5)
    expect(roundDownToAvailable(99, w)).toBe(15)
    expect(nextWeightUp(7.5, w)).toBe(10)
    expect(nextWeightUp(15, w)).toBeNull()
    expect(nextWeightDown(7.5, w)).toBe(5)
    expect(nextWeightDown(2.5, w)).toBe(2.5)
  })

  it('formats kilograms', () => {
    expect(formatKg(7.5)).toBe('7.5 kg')
    expect(formatKg(10)).toBe('10 kg')
    expect(formatKg(1.25)).toBe('1.25 kg')
    expect(formatKg(0)).toBe('Bodyweight')
  })
})

describe('weighted double progression', () => {
  const squat = TRACKS.squat
  const start = () => initialTrackState(squat, EQ)

  it('starts at the level-1 suggested weight', () => {
    expect(start()).toEqual({ levelIndex: 0, weight: 7.5, missStreak: 0, lastPerformedAt: null })
  })

  it('adds weight when every set hits the top of the range', () => {
    const r = evaluate(squat, start(), { levelIndex: 0, sets: sets([12, 12, 12], 7.5) }, EQ, '2026-09-14T10:00:00Z')
    expect(r.outcome).toBe('increase-weight')
    expect(r.state.weight).toBe(10)
    expect(r.state.levelIndex).toBe(0)
    expect(r.state.lastPerformedAt).toBe('2026-09-14T10:00:00Z')
  })

  it('does not add weight when one set falls short of the top', () => {
    const r = evaluate(squat, start(), { levelIndex: 0, sets: sets([12, 12, 11], 7.5) }, EQ)
    expect(r.outcome).toBe('repeat')
    expect(r.state.weight).toBe(7.5)
    expect(r.state.missStreak).toBe(0)
  })

  it('does not progress when fewer sets than prescribed were done', () => {
    const r = evaluate(squat, start(), { levelIndex: 0, sets: sets([12, 12], 7.5) }, EQ)
    expect(r.outcome).toBe('repeat')
    expect(r.state.missStreak).toBe(1)
  })

  it('progresses from the lightest weight used across sets', () => {
    const r = evaluate(squat, start(), { levelIndex: 0, sets: [{ value: 12, weight: 10 }, { value: 12, weight: 7.5 }, { value: 12, weight: 10 }] }, EQ)
    expect(r.state.weight).toBe(10)
  })

  it('moves up a level at the heaviest dumbbell, with a lighter entry weight', () => {
    const state = { ...start(), weight: 15 }
    const r = evaluate(squat, state, { levelIndex: 0, sets: sets([12, 12, 12], 15) }, EQ)
    expect(r.outcome).toBe('next-level')
    expect(r.state.levelIndex).toBe(1)
    // Goblet (one dumbbell) 15 kg -> front squat per dumbbell 15 × 0.6 = 9 -> 7.5
    expect(r.state.weight).toBe(7.5)
  })

  it('reports maxed at the final level with the heaviest dumbbell', () => {
    const last = squat.levels.length - 1
    const state = { ...start(), levelIndex: last, weight: 15 }
    const r = evaluate(squat, state, { levelIndex: last, sets: sets([12, 12, 12], 15) }, EQ)
    expect(r.outcome).toBe('maxed')
    expect(r.state.levelIndex).toBe(last)
    expect(r.state.weight).toBe(15)
  })

  it('resets weight ~10% after two misses in a row at the same prescription', () => {
    const state = { ...start(), weight: 12.5 }
    const first = evaluate(squat, state, { levelIndex: 0, sets: sets([8, 7, 6], 12.5) }, EQ)
    expect(first.outcome).toBe('repeat')
    expect(first.state.missStreak).toBe(1)
    const second = evaluate(squat, first.state, { levelIndex: 0, sets: sets([8, 7, 7], 12.5) }, EQ)
    expect(second.outcome).toBe('reset')
    // 12.5 × 0.9 = 11.25 -> rounds down to 10
    expect(second.state.weight).toBe(10)
    expect(second.state.missStreak).toBe(0)
  })

  it('a good session clears the miss streak', () => {
    const state = { ...start(), missStreak: 1 }
    const r = evaluate(squat, state, { levelIndex: 0, sets: sets([10, 9, 9], 7.5) }, EQ)
    expect(r.state.missStreak).toBe(0)
  })

  it('does not carry a miss streak across a different weight', () => {
    const state = { ...start(), weight: 10, missStreak: 1 }
    const r = evaluate(squat, state, { levelIndex: 0, sets: sets([6, 6, 6], 7.5) }, EQ)
    expect(r.outcome).toBe('repeat')
    expect(r.state.missStreak).toBe(1)
  })

  it('steps back a level when missing at the lightest weight', () => {
    const state = { levelIndex: 1, weight: 2.5, missStreak: 1, lastPerformedAt: null }
    const r = evaluate(squat, state, { levelIndex: 1, sets: sets([5, 5, 5], 2.5) }, EQ)
    expect(r.outcome).toBe('reset')
    expect(r.state.levelIndex).toBe(0)
    expect(r.state.weight).toBe(2.5)
  })

  it('treats a skipped exercise as no change', () => {
    const s = start()
    const r = evaluate(squat, s, { levelIndex: 0, sets: [] }, EQ)
    expect(r.outcome).toBe('skipped')
    expect(r.state).toBe(s)
  })

  it('ignores zero-rep sets', () => {
    const r = evaluate(squat, start(), { levelIndex: 0, sets: sets([0, 0, 0], 7.5) }, EQ)
    expect(r.outcome).toBe('skipped')
  })

  it('evaluates the level actually performed, not the stored one', () => {
    const state = { ...start(), levelIndex: 0, weight: 15 }
    const r = evaluate(squat, state, { levelIndex: 1, sets: sets([12, 12, 12], 7.5) }, EQ)
    expect(r.outcome).toBe('increase-weight')
    expect(r.state.levelIndex).toBe(1)
    expect(r.state.weight).toBe(10)
  })

  it('single-leg bridge can start from bodyweight', () => {
    const bridge = TRACKS.bridge
    const state = { levelIndex: 0, weight: 5, missStreak: 0, lastPerformedAt: null }
    const r = evaluate(bridge, { ...state, weight: 15 }, { levelIndex: 0, sets: sets([20, 20, 20], 15) }, EQ)
    expect(r.outcome).toBe('next-level')
    // 15 × 0.4 = 6 -> 5
    expect(r.state.weight).toBe(5)
    const bw = evaluate(bridge, { levelIndex: 1, weight: 0, missStreak: 0, lastPerformedAt: null }, { levelIndex: 1, sets: sets([15, 15, 15], 0) }, EQ)
    expect(bw.outcome).toBe('increase-weight')
    expect(bw.state.weight).toBe(2.5)
  })
})

describe('bodyweight and hold progression', () => {
  it('moves to the next push-up level when all sets hit the top', () => {
    const r = evaluate(TRACKS.pushup, initialTrackState(TRACKS.pushup, EQ), { levelIndex: 0, sets: sets([15, 15, 15]) }, EQ)
    expect(r.outcome).toBe('next-level')
    expect(r.state.levelIndex).toBe(1)
    expect(r.state.weight).toBeNull()
  })

  it('drops a level after two missed sessions', () => {
    const state = { levelIndex: 2, weight: null, missStreak: 0, lastPerformedAt: null }
    const a = evaluate(TRACKS.pushup, state, { levelIndex: 2, sets: sets([5, 4, 3]) }, EQ)
    expect(a.state.missStreak).toBe(1)
    const b = evaluate(TRACKS.pushup, a.state, { levelIndex: 2, sets: sets([5, 4, 4]) }, EQ)
    expect(b.outcome).toBe('reset')
    expect(b.state.levelIndex).toBe(1)
  })

  it('never drops below level 1 and does not loop the streak forever', () => {
    const state = { levelIndex: 0, weight: null, missStreak: 1, lastPerformedAt: null }
    const r = evaluate(TRACKS.pushup, state, { levelIndex: 0, sets: sets([3, 3, 3]) }, EQ)
    expect(r.state.levelIndex).toBe(0)
    expect(r.state.missStreak).toBe(0)
  })

  it('holds progress by seconds', () => {
    const r = evaluate(TRACKS.plank, initialTrackState(TRACKS.plank, EQ), { levelIndex: 0, sets: sets([45, 45]) }, EQ)
    expect(r.outcome).toBe('next-level')
    expect(r.message).toContain('Long-Lever Plank')
  })

  it('reports maxed at the final bodyweight level', () => {
    const last = TRACKS.pushup.levels.length - 1
    const r = evaluate(TRACKS.pushup, { levelIndex: last, weight: null, missStreak: 0, lastPerformedAt: null }, { levelIndex: last, sets: sets([15, 15, 15]) }, EQ)
    expect(r.outcome).toBe('maxed')
  })
})

describe('prescribe', () => {
  it('gives today’s target', () => {
    const p = prescribe(TRACKS.row, initialTrackState(TRACKS.row, EQ), EQ)
    expect(p).toMatchObject({ sets: 3, low: 8, high: 12, weight: 10, levelIndex: 0, note: null })
  })

  it('eases weight after a two-week layoff', () => {
    const state = { levelIndex: 0, weight: 12.5, missStreak: 0, lastPerformedAt: '2026-08-01T10:00:00Z' }
    const p = prescribe(TRACKS.squat, state, EQ, new Date('2026-09-14T10:00:00Z'))
    expect(p.weight).toBe(10)
    expect(p.note).toMatch(/44 days/)
  })

  it('does not ease weight after a normal gap', () => {
    const state = { levelIndex: 0, weight: 12.5, missStreak: 0, lastPerformedAt: '2026-09-10T10:00:00Z' }
    expect(prescribe(TRACKS.squat, state, EQ, new Date('2026-09-14T10:00:00Z')).weight).toBe(12.5)
  })

  it('snaps a stored weight the equipment no longer has', () => {
    const state = { levelIndex: 0, weight: 20, missStreak: 0, lastPerformedAt: null }
    expect(prescribe(TRACKS.squat, state, EQ).weight).toBe(15)
  })

  it('returns no weight for bodyweight tracks', () => {
    expect(prescribe(TRACKS.plank, initialTrackState(TRACKS.plank, EQ), EQ)).toMatchObject({ low: 20, high: 45, weight: null })
  })
})

describe('track data integrity', () => {
  for (const track of Object.values(TRACKS)) {
    it(`${track.id} is well-formed`, () => {
      expect(['weighted', 'reps', 'hold']).toContain(track.type)
      expect(track.sets).toBeGreaterThan(0)
      expect(track.levels.length).toBeGreaterThan(0)
      const ids = new Set()
      track.levels.forEach((level, i) => {
        expect(ids.has(level.id)).toBe(false)
        ids.add(level.id)
        expect(level.cues.length).toBeGreaterThan(0)
        const [lo, hi] = track.type === 'hold' ? [level.secMin, level.secMax] : [level.repMin, level.repMax]
        expect(lo).toBeGreaterThan(0)
        expect(hi).toBeGreaterThan(lo)
        if (track.type === 'weighted') {
          expect(['one', 'pair']).toContain(level.load)
          if (i === 0) expect(level.startWeight).toBeGreaterThan(0)
          if (i > 0) expect(level.entryFactor).toBeGreaterThan(0)
        }
      })
    })
  }
})
