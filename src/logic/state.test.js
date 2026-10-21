import { describe, expect, it } from 'vitest'
import { nextWorkoutId, estimateLiftMinutes, WORKOUTS } from '../data/program.js'
import {
  addFoodEntry,
  deleteFoodEntry,
  insertSetAt,
  removeSetAt,
  restoreFoodEntry,
  addBodyweight,
  addMeasurement,
  addSet,
  changeExerciseLevel,
  completeOnboarding,
  createInitialState,
  dateKey,
  finishWorkout,
  logCardio,
  normalizeState,
  parseBackup,
  serializeBackup,
  setTrainAt,
  updateGymGear,
  updateWeightGoal,
  setWeightFrom,
  startWorkout,
  updateEquipment,
  updateSet,
  validateEquipment,
} from './state.js'

const onboarded = () =>
  completeOnboarding(createInitialState(), {
    name: 'Graham',
    equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 },
    walkSpeed: 3,
    jogSpeed: 4.5,
  })

function logAll(state, value) {
  let s = state
  s.activeWorkout.exercises.forEach((ex, i) => {
    ex.sets.forEach((_, j) => {
      s = updateSet(s, i, j, { value, done: true })
    })
  })
  return s
}

describe('workout flow', () => {
  it('alternates A and B', () => {
    expect(nextWorkoutId([])).toBe('A')
    expect(nextWorkoutId([{ workoutId: 'A', finishedAt: '2026-09-01T10:00:00Z' }])).toBe('B')
    expect(
      nextWorkoutId([
        { workoutId: 'B', finishedAt: '2026-09-03T10:00:00Z' },
        { workoutId: 'A', finishedAt: '2026-09-01T10:00:00Z' },
      ]),
    ).toBe('A')
  })

  it('lifting fits the one-hour session with warm-up and cardio', () => {
    for (const id of Object.keys(WORKOUTS)) {
      expect(estimateLiftMinutes(id)).toBeGreaterThan(25)
      expect(estimateLiftMinutes(id)).toBeLessThanOrEqual(42)
    }
  })

  it('starts, logs and finishes a workout with progression applied', () => {
    const now = new Date('2026-09-14T09:00:00Z')
    let s = startWorkout(onboarded(), 'A', now)
    expect(s.activeWorkout.exercises).toHaveLength(WORKOUTS.A.trackIds.length)
    expect(() => startWorkout(s, 'B')).toThrow(/already in progress/)

    s = logAll(s, 99) // every set well above the top of every range
    s = finishWorkout(s, new Date('2026-09-14T10:00:00Z'))

    expect(s.activeWorkout).toBeNull()
    expect(s.workouts).toHaveLength(1)
    expect(s.tracks.squat.weight).toBe(10)
    expect(s.tracks.pushup.levelIndex).toBe(1)
    expect(s.tracks.lunge.lastPerformedAt).toBeNull() // Workout B exercise untouched
    expect(nextWorkoutId(s.workouts)).toBe('B')
  })

  it('only counts sets marked done', () => {
    let s = startWorkout(onboarded(), 'A')
    s = updateSet(s, 0, 0, { value: 12, done: true })
    s = updateSet(s, 0, 1, { value: 12, done: false })
    s = finishWorkout(s)
    const squat = s.workouts[0].exercises[0]
    expect(squat.sets).toHaveLength(1)
    expect(squat.outcome).toBe('repeat')
    expect(s.tracks.squat.weight).toBe(7.5)
  })

  it('carries a weight change forward to unfinished sets only', () => {
    let s = startWorkout(onboarded(), 'A')
    s = updateSet(s, 0, 0, { value: 10, done: true })
    s = setWeightFrom(s, 0, 1, 10)
    expect(s.activeWorkout.exercises[0].sets.map((x) => x.weight)).toEqual([7.5, 10, 10])
    s = addSet(s, 0)
    expect(s.activeWorkout.exercises[0].sets.at(-1).weight).toBe(10)
  })

  it('changing level rebuilds the exercise and refuses once sets are logged', () => {
    let s = startWorkout(onboarded(), 'A')
    s = changeExerciseLevel(s, 1, 2) // push-up track to floor push-up
    expect(s.activeWorkout.exercises[1].levelIndex).toBe(2)
    expect(s.activeWorkout.exercises[1].target.low).toBe(6)
    s = updateSet(s, 1, 0, { value: 6, done: true })
    expect(() => changeExerciseLevel(s, 1, 0)).toThrow()
  })
})

describe('equipment', () => {
  it('validates the dumbbell set', () => {
    expect(() => validateEquipment({ minWeight: 2.5, increment: 2.5, maxWeight: 14 })).toThrow(/whole number/)
    expect(() => validateEquipment({ minWeight: 5, increment: 2.5, maxWeight: 2.5 })).toThrow()
    expect(() => validateEquipment({ minWeight: 0, increment: 2.5, maxWeight: 15 })).toThrow()
    expect(validateEquipment({ minWeight: '2', increment: '1', maxWeight: '12' })).toMatchObject({ minWeight: 2, increment: 1, maxWeight: 12 })
  })

  it('re-snaps stored weights when equipment changes', () => {
    let s = onboarded()
    s = { ...s, tracks: { ...s.tracks, squat: { ...s.tracks.squat, weight: 15 } } }
    s = updateEquipment(s, { minWeight: 2, increment: 2, maxWeight: 12 })
    expect(s.tracks.squat.weight).toBe(12)
    expect(s.tracks.hinge.weight).toBe(6) // 7.5 -> 6 in 2 kg jumps
  })
})

describe('cardio logging', () => {
  it('logs a plan session and saves speeds used', () => {
    const { state, record } = logCardio(onboarded(), { kind: 'plan', completed: true, effort: 6, walkSpeed: 3.2, jogSpeed: 4.8, elapsedSeconds: 1000 })
    expect(record.kind).toBe('builder')
    expect(record.title).toContain('6 × 1 min jog')
    expect(state.cardio.successes).toBe(1)
    expect(state.cardio.jogSpeed).toBe(4.8)
    expect(state.cardioLogs).toHaveLength(1)
  })

  it('a rest-day walk never changes plan progress or speeds', () => {
    const before = onboarded()
    const { state } = logCardio(before, { kind: 'rest-walk', completed: true, effort: 4, walkSpeed: 2.5, jogSpeed: 4.5, elapsedSeconds: 1800 })
    expect(state.cardio).toEqual(before.cardio)
    expect(state.cardioLogs[0].walkSpeed).toBe(2.5)
  })

  it('rejects bad input', () => {
    expect(() => logCardio(onboarded(), { kind: 'plan', completed: true, effort: 0 })).toThrow()
    expect(() => logCardio(onboarded(), { kind: 'plan', completed: true, effort: 5, distanceMiles: -1 })).toThrow()
    expect(() => logCardio(onboarded(), { kind: 'plan', completed: true, effort: 5, walkSpeed: 4, jogSpeed: 4.2 })).toThrow()
  })
})

describe('body tracking', () => {
  it('keeps one bodyweight entry per date, sorted', () => {
    let s = onboarded()
    s = addBodyweight(s, '2026-09-10', 80)
    s = addBodyweight(s, '2026-09-01', 81.24)
    s = addBodyweight(s, '2026-09-10', 79.5)
    expect(s.bodyweight).toEqual([
      { date: '2026-09-01', kg: 81.2 },
      { date: '2026-09-10', kg: 79.5 },
    ])
    expect(() => addBodyweight(s, '2026-09-11', 5)).toThrow()
  })

  it('stores only the measurements entered', () => {
    const s = addMeasurement(onboarded(), '2026-09-14', { waistCm: '84', chestCm: '', armCm: 35.25 })
    expect(s.measurements).toEqual([{ date: '2026-09-14', waistCm: 84, armCm: 35.3 }])
    expect(() => addMeasurement(onboarded(), '2026-09-14', {})).toThrow()
  })

  it('dateKey uses the local calendar date', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('validation and backup', () => {
  function fullState() {
    let s = startWorkout(onboarded(), 'A')
    s = finishWorkout(logAll(s, 10))
    s = startWorkout(s, 'B')
    s = updateSet(s, 0, 0, { value: 9, done: true })
    s = logCardio(s, { kind: 'plan', completed: true, effort: 6, elapsedSeconds: 900, distanceMiles: '1.1' }).state
    s = addBodyweight(s, '2026-09-14', 78)
    s = addMeasurement(s, '2026-09-14', { waistCm: 82 })
    return s
  }

  it('round-trips a full state through a backup unchanged', () => {
    const s = fullState()
    const restored = parseBackup(serializeBackup(s))
    expect(restored).toEqual(s)
  })

  it('survives JSON round-trip on load', () => {
    const s = fullState()
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('adds tracks introduced after the data was saved', () => {
    const s = JSON.parse(JSON.stringify(onboarded()))
    delete s.tracks.plank
    expect(normalizeState(s).tracks.plank.levelIndex).toBe(0)
  })

  it('rejects malformed data with a readable path', () => {
    const bad = (mutate) => {
      const s = JSON.parse(JSON.stringify(fullState()))
      mutate(s)
      return () => normalizeState(s)
    }
    expect(bad((s) => (s.version = 99))).toThrow(/version/)
    expect(bad((s) => (s.tracks.squat.levelIndex = 99))).toThrow(/tracks.squat.levelIndex/)
    expect(bad((s) => (s.tracks.squat.weight = 'heavy'))).toThrow(/tracks.squat.weight/)
    expect(bad((s) => (s.equipment.maxWeight = -1))).toThrow(/equipment/)
    expect(bad((s) => (s.cardio.stageIndex = 50))).toThrow(/cardio.stageIndex/)
    expect(bad((s) => (s.workouts[0].exercises[0].trackId = 'nope'))).toThrow(/workouts\[0\]/)
    expect(bad((s) => (s.workouts[0].exercises[0].sets[0].value = 'x'))).toThrow(/sets\[0\].value/)
    expect(bad((s) => (s.activeWorkout.exercises[0].sets[0].done = 'yes'))).toThrow(/activeWorkout/)
    expect(bad((s) => (s.cardioLogs[0].effort = 11))).toThrow(/cardioLogs\[0\].effort/)
    expect(bad((s) => (s.bodyweight[0].date = '14/09/2026'))).toThrow(/bodyweight\[0\]/)
    expect(bad((s) => (s.measurements = {}))).toThrow(/measurements/)
  })

  it('rejects non-backup files', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/)
    expect(() => parseBackup(JSON.stringify({ app: 'other', data: {} }))).toThrow(/not a Forge backup/)
  })
})

describe('gym workouts', () => {
  it('home and gym keep separate A/B rotations', () => {
    const history = [
      { workoutId: 'A', finishedAt: '2026-09-01T10:00:00Z' },
      { workoutId: 'GA', finishedAt: '2026-09-03T10:00:00Z' },
    ]
    expect(nextWorkoutId([], 'gym')).toBe('GA')
    expect(nextWorkoutId(history, 'gym')).toBe('GB')
    expect(nextWorkoutId(history, 'home')).toBe('B')
    expect(nextWorkoutId(history)).toBe('B')
  })

  it('suggests weights on the gear each exercise uses, not the home dumbbells', () => {
    let s = startWorkout(setTrainAt(onboarded(), 'gym'), 'GA', new Date('2026-09-14T09:00:00Z'))
    const target = (trackId) => s.activeWorkout.exercises.find((e) => e.trackId === trackId).target
    expect(target('gymSquat').weight).toBe(40) // barbell, above the 15 kg home max
    expect(target('gymPulldown').weight).toBe(30)

    s = finishWorkout(logAll(s, 99), new Date('2026-09-14T10:00:00Z'))
    expect(s.tracks.gymSquat.weight).toBe(42.5) // smallest barbell jump
    expect(s.tracks.gymLateral.weight).toBe(7.5) // gym dumbbells, 2.5 kg steps
    expect(s.tracks.gymKneeRaise.levelIndex).toBe(1)
    expect(s.tracks.squat.lastPerformedAt).toBeNull() // home progress untouched
    expect(nextWorkoutId(s.workouts, 'gym')).toBe('GB')
    expect(nextWorkoutId(s.workouts, 'home')).toBe('A')
  })

  it('keeps gym weights when the home dumbbells change', () => {
    const s = updateEquipment(onboarded(), { minWeight: 2, increment: 2, maxWeight: 12 })
    expect(s.tracks.gymSquat.weight).toBe(40)
    expect(s.tracks.gymLegPress.weight).toBe(40)
  })

  it('remembers where you train, and loads data saved before the choice existed', () => {
    const s = setTrainAt(onboarded(), 'gym')
    expect(normalizeState(JSON.parse(serializeBackup(s)).data).trainAt).toBe('gym')
    const old = JSON.parse(JSON.stringify(onboarded()))
    delete old.trainAt
    for (const id of ['gymSquat', 'gymBench']) delete old.tracks[id]
    const loaded = normalizeState(old)
    expect(loaded.trainAt).toBe('home')
    expect(loaded.tracks.gymSquat.weight).toBe(40)
    expect(() => setTrainAt(s, 'beach')).toThrow()
    expect(() => normalizeState({ ...old, trainAt: 'beach' })).toThrow(/trainAt/)
  })
})

describe('undoable deletes', () => {
  it('removes a particular set and puts it back in place', () => {
    let s = startWorkout(onboarded(), 'A')
    s = updateSet(s, 0, 1, { value: 9, done: true })
    const removed = s.activeWorkout.exercises[0].sets[1]
    const after = removeSetAt(s, 0, 1)
    expect(after.activeWorkout.exercises[0].sets).toHaveLength(2)
    const back = insertSetAt(after, 0, 1, removed, 'squat')
    expect(back.activeWorkout.exercises[0].sets).toEqual(s.activeWorkout.exercises[0].sets)
    // Wrong exercise (e.g. the workout changed meanwhile): nothing happens.
    expect(insertSetAt(after, 0, 1, removed, 'lunge')).toBe(after)
  })

  it('never removes the last set of an exercise', () => {
    let s = startWorkout(onboarded(), 'A')
    s = removeSetAt(removeSetAt(s, 0, 0), 0, 0)
    expect(removeSetAt(s, 0, 0).activeWorkout.exercises[0].sets).toHaveLength(1)
  })

  it('restores a deleted food entry with its id and position', () => {
    let s = onboarded()
    for (const name of ['Oats', 'Eggs', 'Rice']) s = addFoodEntry(s, '2026-10-21', { name, kcal: 100, protein: 5 })
    const day = s.nutrition.log['2026-10-21']
    const gone = deleteFoodEntry(s, '2026-10-21', day[1].id)
    const back = restoreFoodEntry(gone, '2026-10-21', day[1], 1)
    expect(back.nutrition.log['2026-10-21']).toEqual(day)
    expect(restoreFoodEntry(back, '2026-10-21', day[1], 1)).toBe(back) // already there
    const lastGone = deleteFoodEntry(onboarded(), '2026-10-22', 'x')
    expect(restoreFoodEntry(lastGone, '2026-10-22', day[0], 3).nutrition.log['2026-10-22']).toEqual([day[0]])
  })
})

describe('gym equipment settings', () => {
  it('snaps gym weights to the gym’s own steps and keeps them through a reload', () => {
    let s = onboarded()
    s = updateGymGear(s, { ...s.equipment.gym, barbell: { minWeight: 20, increment: 5, maxWeight: 200 }, dumbbell: { minWeight: 2, increment: 2, maxWeight: 40 } })
    const target = (id) => startWorkout(setTrainAt(s, 'gym'), 'GA').activeWorkout.exercises.find((e) => e.trackId === id).target.weight
    expect(target('gymSquat')).toBe(40)
    expect(target('gymLateral')).toBe(4) // 5 kg default snaps down to the 2 kg steps
    let done = finishWorkout(logAll(startWorkout(setTrainAt(s, 'gym'), 'GA'), 99))
    expect(done.tracks.gymSquat.weight).toBe(45) // one 5 kg jump
    expect(normalizeState(JSON.parse(JSON.stringify(s))).equipment.gym.barbell.increment).toBe(5)
    expect(() => updateGymGear(s, { ...s.equipment.gym, machine: { minWeight: 5, increment: 3, maxWeight: 100 } })).toThrow(/Machines/)
  })

  it('changing home dumbbells leaves the gym steps alone', () => {
    let s = updateGymGear(onboarded(), { ...onboarded().equipment.gym, cable: { minWeight: 5, increment: 5, maxWeight: 90 } })
    s = updateEquipment(s, { minWeight: 2, increment: 2, maxWeight: 20, gym: s.equipment.gym })
    expect(s.equipment.gym.cable.increment).toBe(5)
  })
})

describe('onboarding for the gym', () => {
  it('sets where you train and uses entered gym weights, falling back for blanks', () => {
    const s = completeOnboarding(createInitialState(), {
      name: 'G',
      equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 },
      walkSpeed: 3,
      jogSpeed: 4.5,
      trainAt: 'gym',
      startWeights: { gymSquat: '61', gymBench: '', gymLegPress: 'abc' },
    })
    expect(s.trainAt).toBe('gym')
    expect(s.tracks.gymSquat.weight).toBe(60) // snapped down to the 2.5 kg bar steps
    expect(s.tracks.gymBench.weight).toBe(30) // blank: the suggestion
    expect(s.tracks.gymLegPress.weight).toBe(40)
    expect(completeOnboarding(createInitialState(), { name: '', equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 }, trainAt: 'moon' }).trainAt).toBe('home')
  })
})

describe('weight goal and meals', () => {
  it('saves a goal weight and pace, rejecting nonsense', () => {
    let s = updateWeightGoal(onboarded(), { goalWeight: '74.95', weeklyRate: '0.5' })
    expect(s.nutrition).toMatchObject({ goalWeight: 75, weeklyRate: 0.5 })
    expect(updateWeightGoal(s, { goalWeight: '', weeklyRate: '' }).nutrition).toMatchObject({ goalWeight: null, weeklyRate: null })
    expect(() => updateWeightGoal(s, { goalWeight: 10, weeklyRate: null })).toThrow(/Goal weight/)
    expect(() => updateWeightGoal(s, { goalWeight: 70, weeklyRate: 2 })).toThrow(/pace/)
    expect(normalizeState(JSON.parse(JSON.stringify(s))).nutrition.goalWeight).toBe(75)
  })

  it('logs carbs, fat and the meal, scaled by servings', () => {
    let s = addFoodEntry(onboarded(), '2026-10-21', { name: 'Oats', kcal: 150, protein: 5, carbs: 27, fat: 3, servings: 2, meal: 'breakfast' })
    expect(s.nutrition.log['2026-10-21'][0]).toMatchObject({ kcal: 300, carbs: 54, fat: 6, meal: 'breakfast' })
    s = addFoodEntry(s, '2026-10-21', { name: 'Mystery', kcal: 100, protein: 1 })
    expect(s.nutrition.log['2026-10-21'][1]).toMatchObject({ carbs: null, fat: null, meal: null })
    expect(() => addFoodEntry(s, '2026-10-21', { name: 'X', kcal: 1, protein: 1, meal: 'brunch' })).toThrow(/meal/)
    expect(normalizeState(JSON.parse(JSON.stringify(s))).nutrition.log).toEqual(s.nutrition.log)
  })
})
