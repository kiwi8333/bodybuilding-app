import { describe, expect, it } from 'vitest'
import { TRACKS } from '../data/tracks.js'
import { SWAPS, findSwap } from '../data/swaps.js'
import { MOBILITY_ROUTINE, mobilityTotalSeconds } from '../data/mobility.js'
import { bmr, dailyTargets, dayTotals, weeklyCheckIn } from './nutrition.js'
import { estimatedMaxHr, heartZones, targetZonesFor, zoneRangeText } from './heart.js'
import { DELOAD_WORKOUTS, WORKOUTS_BETWEEN_DELOADS, afterWorkout, deloadDue, initialDeload, snoozeDeload, startDeload } from './deload.js'
import { evaluate, initialTrackState } from './progression.js'
import {
  addBodyweight,
  addFoodEntry,
  applyCalorieAdjust,
  beginDeload,
  completeOnboarding,
  createInitialState,
  deleteFoodEntry,
  finishWorkout,
  logCardio,
  normalizeState,
  parseBackup,
  serializeBackup,
  setExerciseSwap,
  startWorkout,
  updateBodyProfile,
  updateHeart,
  updateNutritionSettings,
  updateReminders,
  updateSet,
} from './state.js'

const EQ = { minWeight: 2.5, increment: 2.5, maxWeight: 15 }

const onboarded = () =>
  completeOnboarding(createInitialState(), { name: 'G', equipment: EQ, walkSpeed: 3, jogSpeed: 4.5 })

function logAll(state, value, rir = null) {
  let s = state
  s.activeWorkout.exercises.forEach((ex, i) => {
    ex.sets.forEach((_, j) => {
      s = updateSet(s, i, j, { value, done: true, rir })
    })
  })
  return s
}

describe('nutrition', () => {
  const profile = { sex: 'male', birthYear: 1996, heightCm: 180 }
  const now = new Date('2026-09-14T12:00:00')

  it('uses Mifflin–St Jeor', () => {
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780)
    expect(bmr({ sex: 'female', age: 30, heightCm: 180, weightKg: 80 })).toBe(1614)
  })

  it('computes targets once the profile and a weigh-in exist', () => {
    const n = { activity: 'moderate', goal: 'gain', calorieAdjust: 0 }
    const t = dailyTargets(profile, n, [{ date: '2026-09-14', kg: 80 }], now)
    expect(t).toMatchObject({ ready: true, bmr: 1780, maintenance: 2759, kcal: 3010, protein: 144, proteinRange: [128, 176] })
    expect(dailyTargets(profile, { ...n, goal: 'lose' }, [{ date: '2026-09-14', kg: 80 }], now).kcal).toBe(2360)
    expect(dailyTargets(profile, { ...n, calorieAdjust: 150 }, [{ date: '2026-09-14', kg: 80 }], now).kcal).toBe(3160)
  })

  it('reports what is missing and still gives protein from bodyweight', () => {
    const t = dailyTargets({ sex: null, birthYear: null, heightCm: null }, { activity: 'moderate', goal: 'gain', calorieAdjust: 0 }, [{ date: '2026-09-14', kg: 70 }], now)
    expect(t.ready).toBe(false)
    expect(t.missing).toEqual(['sex', 'age', 'height'])
    expect(t.protein).toBe(126)
  })

  it('never goes below a safe calorie floor', () => {
    const tiny = dailyTargets({ sex: 'female', birthYear: 1946, heightCm: 150 }, { activity: 'sedentary', goal: 'lose', calorieAdjust: -600 }, [{ date: '2026-09-14', kg: 45 }], now)
    expect(tiny.kcal).toBe(1400)
  })

  it('totals a day', () => {
    expect(dayTotals([{ kcal: 72, protein: 6.3 }, { kcal: 165, protein: 31 }])).toEqual({ kcal: 237, protein: 37.3 })
  })

  it('weekly check-in suggests +150 kcal when not gaining on a gain goal', () => {
    const bw = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-09', '2026-09-11', '2026-09-13'].map((date) => ({ date, kg: 80 }))
    const r = weeklyCheckIn(bw, 'gain', now)
    expect(r.adjust).toBe(150)
    expect(r.weeklyChange).toBe(0)
  })

  it('weekly check-in suggests eating more when losing too fast', () => {
    const bw = [
      { date: '2026-09-02', kg: 80 },
      { date: '2026-09-05', kg: 80 },
      { date: '2026-09-09', kg: 79 },
      { date: '2026-09-12', kg: 79 },
    ]
    expect(weeklyCheckIn(bw, 'lose', now).adjust).toBe(150)
  })

  it('weekly check-in stays quiet on track or without enough data', () => {
    const onTrack = [
      { date: '2026-09-02', kg: 80 },
      { date: '2026-09-05', kg: 80 },
      { date: '2026-09-09', kg: 80.15 },
      { date: '2026-09-12', kg: 80.15 },
    ]
    expect(weeklyCheckIn(onTrack, 'gain', now).adjust).toBe(0)
    expect(weeklyCheckIn([{ date: '2026-09-12', kg: 80 }], 'gain', now)).toBeNull()
  })

  it('food log entries scale by servings and delete cleanly', () => {
    let s = onboarded()
    s = addFoodEntry(s, '2026-09-14', { name: 'Egg', kcal: 72, protein: 6.3, servings: 2 })
    expect(s.nutrition.log['2026-09-14'][0]).toMatchObject({ name: 'Egg × 2', kcal: 144, protein: 12.6 })
    const id = s.nutrition.log['2026-09-14'][0].id
    s = deleteFoodEntry(s, '2026-09-14', id)
    expect(s.nutrition.log['2026-09-14']).toBeUndefined()
    expect(() => addFoodEntry(s, '2026-09-14', { name: '', kcal: 1, protein: 1 })).toThrow()
    expect(() => addFoodEntry(s, '2026-09-14', { name: 'x', kcal: 1, protein: 1, servings: 0 })).toThrow()
  })

  it('changing goal resets weekly calorie adjustments', () => {
    let s = applyCalorieAdjust(onboarded(), 150)
    expect(s.nutrition.calorieAdjust).toBe(150)
    s = updateNutritionSettings(s, { activity: 'light', goal: 'lose' })
    expect(s.nutrition.calorieAdjust).toBe(0)
    expect(() => applyCalorieAdjust(s, 999)).toThrow()
  })

  it('validates the body profile', () => {
    const s = updateBodyProfile(onboarded(), { sex: 'male', age: '30', heightCm: '180' }, new Date('2026-01-01'))
    expect(s.profile).toMatchObject({ sex: 'male', birthYear: 1996, heightCm: 180 })
    expect(() => updateBodyProfile(s, { sex: 'x', age: 30, heightCm: 180 })).toThrow()
    expect(() => updateBodyProfile(s, { sex: 'male', age: 8, heightCm: 180 })).toThrow()
  })
})

describe('heart rate', () => {
  it('estimates max HR with Tanaka', () => {
    expect(estimatedMaxHr(30)).toBe(187)
  })

  it('zones by % of max, or by reserve when resting HR is known', () => {
    const byMax = heartZones({ maxHr: null, restingHr: null }, 30)
    expect(byMax.method).toBe('max')
    expect(byMax.zones[1]).toMatchObject({ loBpm: 112, hiBpm: 131 })
    const byReserve = heartZones({ maxHr: null, restingHr: 60 }, 30)
    expect(byReserve.method).toBe('reserve')
    expect(byReserve.zones[1]).toMatchObject({ loBpm: 136, hiBpm: 149 })
    const measured = heartZones({ maxHr: 195, restingHr: null }, null)
    expect(measured).toMatchObject({ maxHr: 195, measured: true })
    expect(heartZones({ maxHr: null, restingHr: null }, null)).toBeNull()
  })

  it('target zones per segment', () => {
    expect(targetZonesFor('walk', 'b1')).toEqual([1, 2])
    expect(targetZonesFor('jog', 'f-easy')).toEqual([2, 2])
    expect(targetZonesFor('hard', 'f-intervals')).toEqual([4, 5])
    expect(targetZonesFor('hard', 'f-tempo')).toEqual([3, 4])
    const z = heartZones({ maxHr: 190, restingHr: null }, null)
    expect(zoneRangeText(z, [2, 3])).toBe('Zone 2–3 · 114–152 bpm')
  })

  it('validates heart settings and cardio HR', () => {
    expect(updateHeart(onboarded(), { maxHr: '190', restingHr: '58' }).heart).toEqual({ maxHr: 190, restingHr: 58 })
    expect(() => updateHeart(onboarded(), { maxHr: 190, restingHr: 170 })).toThrow()
    expect(() => logCardio(onboarded(), { kind: 'plan', completed: true, effort: 5, avgHr: 150, maxHr: 140 })).toThrow(/lower than the average/)
    const { record } = logCardio(onboarded(), { kind: 'plan', completed: true, effort: 5, avgHr: '138', maxHr: '161' })
    expect(record).toMatchObject({ avgHr: 138, maxHr: 161 })
  })
})

describe('deload', () => {
  it('becomes due after 24 workouts, can be snoozed, and ends after 3', () => {
    let d = initialDeload()
    expect(deloadDue(d, WORKOUTS_BETWEEN_DELOADS - 1)).toBe(false)
    expect(deloadDue(d, WORKOUTS_BETWEEN_DELOADS)).toBe(true)
    d = snoozeDeload(d, 24)
    expect(deloadDue(d, 26)).toBe(false)
    expect(deloadDue(d, 27)).toBe(true)
    d = startDeload(d)
    for (let i = 1; i < DELOAD_WORKOUTS; i++) d = afterWorkout(d, 27 + i)
    expect(d.active).toBe(true)
    d = afterWorkout(d, 30)
    expect(d).toMatchObject({ active: false, lastEndedAtCount: 30, completedCount: 1 })
    expect(deloadDue(d, 53)).toBe(false)
    expect(deloadDue(d, 54)).toBe(true)
  })

  it('deload workouts are lighter and never move progression', () => {
    let s = beginDeload(onboarded())
    s = startWorkout(s, 'A')
    const squat = s.activeWorkout.exercises[0]
    expect(squat.target.sets).toBe(2)
    expect(squat.target.weight).toBe(5) // 7.5 × 0.9 = 6.75 → 5
    expect(s.activeWorkout.exercises.find((e) => e.trackId === 'lateralRaise').target.sets).toBe(1)
    s = finishWorkout(logAll(s, 99))
    expect(s.tracks.squat.weight).toBe(7.5)
    expect(s.tracks.pushup.levelIndex).toBe(0)
    expect(s.workouts[0].deload).toBe(true)
    expect(s.workouts[0].exercises[0].outcome).toBe('deload')
    for (let i = 0; i < 2; i++) s = finishWorkout(logAll(startWorkout(s, i % 2 ? 'A' : 'B'), 99))
    expect(s.deload.active).toBe(false)
    // Normal training resumes with progression.
    s = finishWorkout(logAll(startWorkout(s, 'A'), 99))
    expect(s.tracks.squat.weight).toBe(10)
  })
})

describe('swaps', () => {
  it('every swap exists for a real track with a unique id', () => {
    const ids = new Set()
    for (const [trackId, swaps] of Object.entries(SWAPS)) {
      expect(TRACKS[trackId]).toBeDefined()
      for (const s of swaps) {
        expect(ids.has(s.id)).toBe(false)
        ids.add(s.id)
        expect(s.cues.length).toBeGreaterThan(0)
        expect(s.why.length).toBeGreaterThan(10)
      }
    }
    expect(findSwap('squat', 'nope')).toBeNull()
  })

  it('a remembered swap pauses progression and persists until switched back', () => {
    let s = startWorkout(onboarded(), 'A')
    s = setExerciseSwap(s, 0, 'goblet-box-squat', { remember: true })
    s = finishWorkout(logAll(s, 99))
    expect(s.tracks.squat.weight).toBe(7.5)
    expect(s.tracks.squat.swapId).toBe('goblet-box-squat')
    expect(s.workouts[0].exercises[0]).toMatchObject({ outcome: 'swapped', swapId: 'goblet-box-squat', levelName: 'Goblet Box Squat (sit to a chair)' })
    expect(s.tracks.squat.lastPerformedAt).not.toBeNull()

    s = startWorkout(s, 'B')
    s = finishWorkout(s)
    s = startWorkout(s, 'A')
    expect(s.activeWorkout.exercises[0].swapId).toBe('goblet-box-squat')
    s = setExerciseSwap(s, 0, null)
    expect(s.tracks.squat.swapId).toBeNull()
    s = finishWorkout(logAll(s, 99))
    expect(s.tracks.squat.weight).toBe(10)
  })

  it('a one-off swap does not persist', () => {
    let s = startWorkout(onboarded(), 'A')
    s = setExerciseSwap(s, 1, 'knee-pushup')
    expect(s.tracks.pushup.swapId).toBeNull()
    expect(() => setExerciseSwap(s, 1, 'goblet-box-squat')).toThrow(/Unknown swap/)
  })
})

describe('effort ratings (reps in reserve)', () => {
  const squat = TRACKS.squat
  const sets = (value, weight, rirs) => rirs.map((rir) => ({ value, weight, rir }))
  const s0 = () => initialTrackState(squat, EQ)

  it('all sets easy at the top jumps two weight steps', () => {
    const r = evaluate(squat, s0(), { levelIndex: 0, sets: sets(12, 7.5, [3, 3, 3]) }, EQ)
    expect(r.state.weight).toBe(12.5)
  })

  it('two or more sets to failure repeats the weight', () => {
    const r = evaluate(squat, s0(), { levelIndex: 0, sets: sets(12, 7.5, [1, 0, 0]) }, EQ)
    expect(r.outcome).toBe('repeat')
    expect(r.state.weight).toBe(7.5)
  })

  it('unrated or mixed effort uses the normal one-step jump', () => {
    expect(evaluate(squat, s0(), { levelIndex: 0, sets: sets(12, 7.5, [null, null, null]) }, EQ).state.weight).toBe(10)
    expect(evaluate(squat, s0(), { levelIndex: 0, sets: sets(12, 7.5, [3, 2, 3]) }, EQ).state.weight).toBe(10)
  })

  it('two easy steps are capped at the heaviest dumbbell', () => {
    const r = evaluate(squat, { ...s0(), weight: 12.5 }, { levelIndex: 0, sets: sets(12, 12.5, [3, 3, 3]) }, EQ)
    expect(r.state.weight).toBe(15)
  })

  it('bodyweight: failure at the top consolidates the level', () => {
    const r = evaluate(TRACKS.pushup, initialTrackState(TRACKS.pushup, EQ), { levelIndex: 0, sets: [15, 15, 15].map((value, i) => ({ value, rir: i ? 0 : 1 })) }, EQ)
    expect(r.outcome).toBe('repeat')
    expect(r.state.levelIndex).toBe(0)
  })
})

describe('mobility routine', () => {
  it('is about five minutes', () => {
    expect(mobilityTotalSeconds()).toBeGreaterThanOrEqual(240)
    expect(mobilityTotalSeconds()).toBeLessThanOrEqual(330)
    expect(MOBILITY_ROUTINE.every((m) => m.cues.length > 0)).toBe(true)
  })
})

describe('reminders settings', () => {
  it('validates days and time', () => {
    const s = updateReminders(onboarded(), { enabled: true, days: [5, 1, 3, 3], time: '07:30', nudgeMissed: false })
    expect(s.reminders).toEqual({ enabled: true, days: [1, 3, 5], time: '07:30', nudgeMissed: false, nudgeBackup: true })
    expect(() => updateReminders(onboarded(), { days: [], time: '07:30' })).toThrow()
    expect(() => updateReminders(onboarded(), { days: [1], time: '25:00' })).toThrow()
    expect(() => updateReminders(onboarded(), { days: [7], time: '07:30' })).toThrow()
  })
})

describe('schema upgrade and validation', () => {
  function v1Data() {
    const s = JSON.parse(JSON.stringify(finishWorkout(logAll(startWorkout(onboarded(), 'A'), 10))))
    for (const k of ['nutrition', 'heart', 'reminders', 'deload', 'mobilityLogs', 'lastBackupAt', 'ui']) delete s[k]
    s.version = 1
    s.profile = { onboarded: true, name: 'G' }
    for (const t of Object.values(s.tracks)) delete t.swapId
    for (const w of s.workouts) {
      delete w.deload
      for (const e of w.exercises) {
        delete e.swapId
        for (const set of e.sets) delete set.rir
      }
    }
    return s
  }

  it('upgrades version 1 data without losing history', () => {
    const upgraded = normalizeState(v1Data())
    expect(upgraded.version).toBe(2)
    expect(upgraded.workouts).toHaveLength(1)
    expect(upgraded.nutrition.goal).toBe('gain')
    expect(upgraded.reminders.enabled).toBe(false)
    expect(upgraded.deload.active).toBe(false)
    expect(upgraded.tracks.squat.swapId).toBeNull()
    expect(upgraded.workouts[0].exercises[0].sets[0].rir).toBeNull()
    // Upgraded data round-trips as version 2.
    expect(normalizeState(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded)
  })

  it('restores a version 1 backup file', () => {
    const text = JSON.stringify({ app: 'forge-bodybuilding', exportedAt: '2026-09-01T00:00:00Z', data: v1Data() })
    expect(parseBackup(text).version).toBe(2)
  })

  it('round-trips a full version 2 state', () => {
    let s = onboarded()
    s = addBodyweight(s, '2026-09-10', 80)
    s = updateBodyProfile(s, { sex: 'female', age: 28, heightCm: 168 })
    s = addFoodEntry(s, '2026-09-10', { name: 'Oats', kcal: 156, protein: 6.8 })
    s = updateHeart(s, { maxHr: 188, restingHr: 55 })
    s = updateReminders(s, { enabled: true, days: [2, 4, 6], time: '06:45' })
    s = beginDeload(s)
    s = startWorkout(s, 'A')
    s = setExerciseSwap(s, 1, 'knee-pushup', { remember: true })
    s = updateSet(s, 0, 0, { value: 8, done: true, rir: 2 })
    s = logCardio(s, { kind: 'plan', completed: true, effort: 6, avgHr: 140, maxHr: 165 }).state
    expect(parseBackup(serializeBackup(s))).toEqual(s)
  })

  it('rejects malformed new sections', () => {
    const bad = (mutate) => {
      const s = JSON.parse(JSON.stringify(onboarded()))
      mutate(s)
      return () => normalizeState(s)
    }
    expect(bad((s) => (s.nutrition.goal = 'bulk'))).toThrow(/nutrition.goal/)
    expect(bad((s) => (s.nutrition.log = { 'not-a-date': [] }))).toThrow(/nutrition.log/)
    expect(bad((s) => (s.heart.maxHr = 500))).toThrow(/heart/)
    expect(bad((s) => (s.reminders.days = []))).toThrow(/reminders/)
    expect(bad((s) => (s.deload.workoutsDone = -1))).toThrow(/deload/)
    expect(bad((s) => (s.tracks.squat.swapId = 'nope'))).toThrow(/swapId/)
    expect(bad((s) => (s.profile.sex = 'other'))).toThrow(/profile.sex/)
    expect(bad((s) => (s.ui = null))).toThrow(/ui/)
  })
})
