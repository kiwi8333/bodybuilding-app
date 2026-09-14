import { describe, expect, it } from 'vitest'
import { BUILDER_STAGES, FITNESS_ROTATION, REST_DAY_WALK, currentCardioStage, speedFor, totalSeconds } from '../data/cardio.js'
import { evaluateCardio, initialCardioState } from './cardioProgression.js'

describe('cardio plan data', () => {
  it('every session fits a sensible post-lifting window', () => {
    for (const s of [...BUILDER_STAGES, ...FITNESS_ROTATION]) {
      const min = totalSeconds(s) / 60
      expect(min).toBeGreaterThanOrEqual(15)
      expect(min).toBeLessThanOrEqual(23)
    }
  })

  it('every builder stage is harder: never less jogging, never a shorter longest bout, and more of one', () => {
    const jogs = (s) => s.segments.filter((x) => x.kind === 'jog').map((x) => x.seconds)
    const total = (s) => jogs(s).reduce((a, b) => a + b, 0)
    const longest = (s) => Math.max(...jogs(s))
    for (let i = 1; i < BUILDER_STAGES.length; i++) {
      const [prev, cur] = [BUILDER_STAGES[i - 1], BUILDER_STAGES[i]]
      expect(total(cur)).toBeGreaterThanOrEqual(total(prev))
      expect(longest(cur)).toBeGreaterThanOrEqual(longest(prev))
      expect(total(cur) > total(prev) || longest(cur) > longest(prev)).toBe(true)
    }
  })

  it('builder stage titles match their segments', () => {
    const jogs = (s) => s.segments.filter((x) => x.kind === 'jog').map((x) => x.seconds)
    expect(jogs(BUILDER_STAGES[0])).toEqual([60, 60, 60, 60, 60, 60])
    expect(jogs(BUILDER_STAGES[3])).toEqual([180, 180, 180, 180])
    expect(jogs(BUILDER_STAGES.at(-1))).toEqual([1200])
  })

  it('every session starts and ends with a walk', () => {
    for (const s of [...BUILDER_STAGES, ...FITNESS_ROTATION]) {
      expect(s.segments[0].kind).toBe('walk')
      expect(s.segments.at(-1).kind).toBe('walk')
    }
    expect(totalSeconds(REST_DAY_WALK)).toBe(1800)
  })

  it('interval sessions have 6 hard efforts', () => {
    const intervals = FITNESS_ROTATION.find((s) => s.id === 'f-intervals')
    expect(intervals.segments.filter((x) => x.kind === 'hard')).toHaveLength(6)
  })

  it('speeds per segment kind', () => {
    const s = initialCardioState()
    expect(speedFor('walk', s)).toBe(3)
    expect(speedFor('jog', s)).toBe(4.5)
    expect(speedFor('hard', s)).toBe(5.5)
  })
})

describe('run builder progression', () => {
  it('needs two comfortable completions to advance', () => {
    const s0 = initialCardioState()
    const a = evaluateCardio(s0, { completed: true, effort: 6 })
    expect(a.outcome).toBe('repeat')
    expect(a.state.stageIndex).toBe(0)
    expect(a.state.successes).toBe(1)
    const b = evaluateCardio(a.state, { completed: true, effort: 7 })
    expect(b.outcome).toBe('advance')
    expect(b.state.stageIndex).toBe(1)
    expect(b.state.successes).toBe(0)
  })

  it('a completed but too-hard session does not count', () => {
    const r = evaluateCardio({ ...initialCardioState(), successes: 1 }, { completed: true, effort: 8 })
    expect(r.state.successes).toBe(1)
    expect(r.state.stageIndex).toBe(0)
  })

  it('steps back after two unfinished sessions', () => {
    const s = { ...initialCardioState(), stageIndex: 3 }
    const a = evaluateCardio(s, { completed: false, effort: 9 })
    expect(a.outcome).toBe('repeat')
    const b = evaluateCardio(a.state, { completed: false, effort: 9 })
    expect(b.outcome).toBe('step-back')
    expect(b.state.stageIndex).toBe(2)
  })

  it('never steps back below stage 1', () => {
    const a = evaluateCardio({ ...initialCardioState(), failures: 1 }, { completed: false, effort: 9 })
    expect(a.state.stageIndex).toBe(0)
    expect(a.state.failures).toBe(0)
  })

  it('graduates to the fitness phase after the last stage', () => {
    const s = { ...initialCardioState(), stageIndex: BUILDER_STAGES.length - 1, successes: 1 }
    const r = evaluateCardio(s, { completed: true, effort: 7 })
    expect(r.outcome).toBe('graduated')
    expect(r.state.phase).toBe('fitness')
    expect(currentCardioStage(r.state).id).toBe('f-easy')
  })
})

describe('fitness phase', () => {
  const fit = () => ({ ...initialCardioState(), phase: 'fitness', stageIndex: BUILDER_STAGES.length - 1 })

  it('rotates sessions and wraps around', () => {
    let s = fit()
    const seen = []
    for (let i = 0; i < FITNESS_ROTATION.length + 1; i++) {
      seen.push(currentCardioStage(s).id)
      s = evaluateCardio(s, { completed: true, effort: 7 }).state
    }
    expect(seen).toEqual(['f-easy', 'f-intervals', 'f-easy-2', 'f-tempo', 'f-easy'])
  })

  it('speeds up when easy and slows when too hard, within limits', () => {
    const up = evaluateCardio(fit(), { completed: true, effort: 5 })
    expect(up.state.jogSpeed).toBe(4.7)
    const down = evaluateCardio(fit(), { completed: false, effort: 9 })
    expect(down.state.jogSpeed).toBe(4.3)
    const floor = evaluateCardio({ ...fit(), jogSpeed: 3.5, walkSpeed: 3 }, { completed: false, effort: 10 })
    expect(floor.state.jogSpeed).toBe(3.5)
  })
})
