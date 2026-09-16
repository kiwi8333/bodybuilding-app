// Pure state transitions. No React, no localStorage, so every rule here is
// unit-tested directly.

import { TRACKS, getTrack } from '../data/tracks.js'
import { WORKOUTS } from '../data/program.js'
import { BUILDER_STAGES, FITNESS_ROTATION, REST_DAY_WALK, currentCardioStage } from '../data/cardio.js'
import { evaluate, initialTrackState, prescribe } from './progression.js'
import { evaluateCardio, initialCardioState } from './cardioProgression.js'
import { ACTIVITY_LEVELS, GOALS, initialNutrition, validateFood } from './nutrition.js'
import { validateHr } from './heart.js'
import { afterWorkout, cancelDeload, deloadTarget, initialDeload, snoozeDeload, startDeload } from './deload.js'
import { findSwap } from '../data/swaps.js'

export const SCHEMA_VERSION = 2

export const DEFAULT_EQUIPMENT = { minWeight: 2.5, increment: 2.5, maxWeight: 15 }

export const DEFAULT_REMINDERS = { enabled: false, days: [1, 3, 5], time: '18:00', nudgeMissed: true, nudgeBackup: true }

export function createInitialState() {
  const equipment = { ...DEFAULT_EQUIPMENT }
  return {
    version: SCHEMA_VERSION,
    profile: { onboarded: false, name: '', sex: null, birthYear: null, heightCm: null },
    equipment,
    tracks: Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, initialTrackState(t, equipment)])),
    cardio: initialCardioState(),
    activeWorkout: null,
    workouts: [],
    cardioLogs: [],
    bodyweight: [],
    measurements: [],
    nutrition: initialNutrition(),
    heart: { maxHr: null, restingHr: null },
    reminders: { ...DEFAULT_REMINDERS, days: [...DEFAULT_REMINDERS.days] },
    deload: initialDeload(),
    mobilityLogs: [],
    lastBackupAt: null,
    ui: { dumbbellAlertDismissedCount: 0 },
  }
}

let idCounter = 0
export function makeId(now = new Date()) {
  idCounter = (idCounter + 1) % 1e6
  return `${now.getTime().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Local calendar date as YYYY-MM-DD (not UTC, so a 11pm workout counts today).
export function dateKey(date = new Date()) {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// ---------- Onboarding & settings ----------

export function completeOnboarding(state, { name, equipment, jogSpeed, walkSpeed, startLevels, startWeights }) {
  const eq = validateEquipment(equipment)
  const tracks = {}
  for (const track of Object.values(TRACKS)) {
    const base = initialTrackState(track, eq)
    const levelIndex = startLevels?.[track.id] ?? base.levelIndex
    tracks[track.id] = { ...base, levelIndex }
    if (track.type === 'weighted') {
      const w = startWeights?.[track.id]
      tracks[track.id].weight = prescribe(track, { ...base, levelIndex, weight: w ?? base.weight }, eq).weight
    }
  }
  const withSpeeds = updateCardioSpeeds(state, {
    walkSpeed: walkSpeed ?? state.cardio.walkSpeed,
    jogSpeed: jogSpeed ?? state.cardio.jogSpeed,
  })
  return {
    ...withSpeeds,
    profile: { ...state.profile, onboarded: true, name: String(name ?? '').trim().slice(0, 40) },
    equipment: eq,
    tracks,
  }
}

export function validateEquipment(equipment) {
  const minWeight = Number(equipment?.minWeight)
  const increment = Number(equipment?.increment)
  const maxWeight = Number(equipment?.maxWeight)
  if (!Number.isFinite(minWeight) || minWeight < 0.5 || minWeight > 100) {
    throw new Error('Lightest weight must be between 0.5 and 100 kg.')
  }
  if (!Number.isFinite(increment) || increment < 0.25 || increment > 20) {
    throw new Error('Weight jump must be between 0.25 and 20 kg.')
  }
  if (!Number.isFinite(maxWeight) || maxWeight < minWeight || maxWeight > 100) {
    throw new Error('Heaviest weight must be at least the lightest weight and at most 100 kg.')
  }
  if (Math.round((maxWeight - minWeight) * 100) % Math.round(increment * 100) !== 0) {
    throw new Error('Heaviest minus lightest must be a whole number of weight jumps (e.g. 2.5 → 15 in 2.5 kg jumps).')
  }
  return { minWeight, increment, maxWeight }
}

export function updateEquipment(state, equipment) {
  const eq = validateEquipment(equipment)
  // Re-snap every stored weight to something the new set actually has.
  const tracks = { ...state.tracks }
  for (const track of Object.values(TRACKS)) {
    if (track.type !== 'weighted') continue
    const s = tracks[track.id]
    tracks[track.id] = { ...s, weight: prescribe(track, { ...s, lastPerformedAt: null }, eq).weight }
  }
  return { ...state, equipment: eq, tracks }
}

export function updateCardioSpeeds(state, { walkSpeed, jogSpeed }) {
  const walk = clampSpeed(walkSpeed, 1.5, 4.5)
  const jog = clampSpeed(jogSpeed, 3, 9)
  if (jog < walk + 0.5) throw new Error('Jog speed should be at least 0.5 mph faster than walk speed.')
  return { ...state, cardio: { ...state.cardio, walkSpeed: walk, jogSpeed: jog } }
}

function clampSpeed(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('Speed must be a number.')
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10
}

export function setTrackLevel(state, trackId, levelIndex) {
  const track = getTrack(trackId)
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= track.levels.length) {
    throw new Error('Invalid level.')
  }
  const current = state.tracks[trackId]
  const next = { ...current, levelIndex, missStreak: 0 }
  if (track.type === 'weighted') next.weight = prescribe(track, next, state.equipment).weight
  return { ...state, tracks: { ...state.tracks, [trackId]: next } }
}

// ---------- Workouts ----------

export function startWorkout(state, workoutId, now = new Date()) {
  const workout = WORKOUTS[workoutId]
  if (!workout) throw new Error(`Unknown workout ${workoutId}`)
  if (state.activeWorkout) throw new Error('A workout is already in progress.')
  const deload = state.deload.active
  const exercises = workout.trackIds.map((trackId) => buildExercise(state, trackId, state.tracks[trackId].levelIndex, now, deload))
  return {
    ...state,
    activeWorkout: {
      id: makeId(now),
      workoutId,
      startedAt: now.toISOString(),
      warmUpDone: [],
      deload,
      exercises,
    },
  }
}

function buildExercise(state, trackId, levelIndex, now, deload = false, swapId = state.tracks[trackId].swapId ?? null) {
  const track = getTrack(trackId)
  const p = prescribe(track, { ...state.tracks[trackId], levelIndex }, state.equipment, now)
  let target = { sets: p.sets, low: p.low, high: p.high, weight: p.weight, note: p.note }
  if (deload) {
    target = deloadTarget(track, track.levels[p.levelIndex], target, state.equipment)
    target.note = 'Deload week: one set fewer and about 10% lighter. Keep 3 reps in reserve.'
  }
  return {
    trackId,
    levelIndex: p.levelIndex,
    swapId: findSwap(trackId, swapId) ? swapId : null,
    target,
    sets: Array.from({ length: target.sets }, () => ({ weight: target.weight, value: null, done: false, rir: null })),
  }
}

/**
 * Use an equivalent exercise instead. `remember` keeps the swap for future
 * sessions too (e.g. a sore joint). swapId null switches back.
 */
export function setExerciseSwap(state, exerciseIndex, swapId, { remember = false } = {}) {
  const ex = state.activeWorkout?.exercises[exerciseIndex]
  if (!ex) return state
  if (swapId !== null && !findSwap(ex.trackId, swapId)) throw new Error('Unknown swap.')
  if (ex.sets.some((s) => s.done)) throw new Error('Finish or clear logged sets before swapping the exercise.')
  const next = withExercise(state, exerciseIndex, (e) => ({ ...e, swapId }))
  if (!remember && swapId !== null) return next
  return { ...next, tracks: { ...next.tracks, [ex.trackId]: { ...next.tracks[ex.trackId], swapId } } }
}

// Change a remembered swap outside a workout (Plan page).
export function setTrackSwap(state, trackId, swapId) {
  getTrack(trackId)
  if (swapId !== null && !findSwap(trackId, swapId)) throw new Error('Unknown swap.')
  return { ...state, tracks: { ...state.tracks, [trackId]: { ...state.tracks[trackId], swapId } } }
}

function withExercise(state, index, fn) {
  const aw = state.activeWorkout
  if (!aw || !aw.exercises[index]) return state
  const exercises = aw.exercises.map((ex, i) => (i === index ? fn(ex) : ex))
  return { ...state, activeWorkout: { ...aw, exercises } }
}

export function toggleWarmUp(state, itemId) {
  const aw = state.activeWorkout
  if (!aw) return state
  const done = aw.warmUpDone.includes(itemId) ? aw.warmUpDone.filter((x) => x !== itemId) : [...aw.warmUpDone, itemId]
  return { ...state, activeWorkout: { ...aw, warmUpDone: done } }
}

export function updateSet(state, exerciseIndex, setIndex, patch) {
  return withExercise(state, exerciseIndex, (ex) => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
  }))
}

// Change the weight of one set and carry it forward to later sets that
// aren't done yet, the way you'd keep the same dumbbells for the next set.
export function setWeightFrom(state, exerciseIndex, setIndex, weight) {
  return withExercise(state, exerciseIndex, (ex) => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === setIndex || (i > setIndex && !s.done) ? { ...s, weight } : s)),
  }))
}

export function addSet(state, exerciseIndex) {
  return withExercise(state, exerciseIndex, (ex) => {
    const last = ex.sets.at(-1)
    return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? ex.target.weight, value: null, done: false }] }
  })
}

export function removeSet(state, exerciseIndex) {
  return withExercise(state, exerciseIndex, (ex) => (ex.sets.length > 1 ? { ...ex, sets: ex.sets.slice(0, -1) } : ex))
}

// Switch the level for this session only. The finished workout decides
// whether that level sticks (progression evaluates what you actually did).
export function changeExerciseLevel(state, exerciseIndex, levelIndex, now = new Date()) {
  const aw = state.activeWorkout
  const ex = aw?.exercises[exerciseIndex]
  if (!ex) return state
  const track = getTrack(ex.trackId)
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= track.levels.length) return state
  if (ex.sets.some((s) => s.done)) throw new Error('Finish or clear logged sets before changing the exercise level.')
  let trackState = { ...state.tracks[ex.trackId], levelIndex }
  if (track.type === 'weighted' && levelIndex !== state.tracks[ex.trackId].levelIndex) {
    // A different variation: start from the lightest-but-sensible weight.
    const level = track.levels[levelIndex]
    const factor = levelIndex > state.tracks[ex.trackId].levelIndex ? level.entryFactor ?? 0.8 : 1
    trackState = { ...trackState, weight: (state.tracks[ex.trackId].weight ?? 0) * factor }
  }
  const rebuilt = buildExercise({ ...state, tracks: { ...state.tracks, [ex.trackId]: trackState } }, ex.trackId, levelIndex, now, aw.deload, ex.swapId)
  return withExercise(state, exerciseIndex, () => rebuilt)
}

export function discardWorkout(state) {
  return { ...state, activeWorkout: null }
}

export function finishWorkout(state, now = new Date()) {
  const aw = state.activeWorkout
  if (!aw) throw new Error('No workout in progress.')
  const performedAt = now.toISOString()
  const tracks = { ...state.tracks }
  const exercises = aw.exercises.map((ex) => {
    const track = getTrack(ex.trackId)
    const swap = ex.swapId ? findSwap(ex.trackId, ex.swapId) : null
    const completedSets = ex.sets
      .filter((s) => s.done && Number.isFinite(s.value) && s.value > 0)
      .map((s) => ({ value: s.value, weight: track.type === 'weighted' ? s.weight : null, rir: Number.isInteger(s.rir) ? s.rir : null }))

    let result
    if (completedSets.length && (aw.deload || swap)) {
      // Deloads and swaps never move progression; they only mark the date so
      // the two-week layoff rule still knows you trained.
      result = {
        state: { ...tracks[ex.trackId], lastPerformedAt: performedAt },
        outcome: aw.deload ? 'deload' : 'swapped',
        message: aw.deload
          ? 'Deload set logged. Targets stay where they were for after the deload.'
          : `Logged as ${swap.name}. Progression on ${track.levels[ex.levelIndex].name} is paused until you switch back.`,
      }
    } else {
      result = evaluate(track, tracks[ex.trackId], { levelIndex: ex.levelIndex, sets: completedSets }, state.equipment, performedAt)
    }
    tracks[ex.trackId] = result.state
    return {
      trackId: ex.trackId,
      levelIndex: ex.levelIndex,
      levelName: swap ? swap.name : track.levels[ex.levelIndex].name,
      swapId: swap ? swap.id : null,
      type: track.type,
      target: ex.target,
      sets: completedSets,
      outcome: result.outcome,
      message: result.message,
    }
  })
  const record = {
    id: aw.id,
    workoutId: aw.workoutId,
    startedAt: aw.startedAt,
    finishedAt: performedAt,
    deload: Boolean(aw.deload),
    exercises,
  }
  const workouts = [...state.workouts, record]
  const deload = aw.deload ? afterWorkout(state.deload, workouts.length) : state.deload
  return { ...state, tracks, activeWorkout: null, workouts, deload }
}

// ---------- Deload ----------

export function beginDeload(state) {
  if (state.activeWorkout) throw new Error('Finish your current workout first.')
  return { ...state, deload: startDeload(state.deload) }
}

export function postponeDeload(state) {
  return { ...state, deload: snoozeDeload(state.deload, state.workouts.length) }
}

export function endDeloadEarly(state) {
  return { ...state, deload: cancelDeload(state.deload, state.workouts.length) }
}

export function deleteWorkoutRecord(state, id) {
  return { ...state, workouts: state.workouts.filter((w) => w.id !== id) }
}

// ---------- Cardio ----------

export function cardioSessionFor(state, kind) {
  if (kind === 'rest-walk') return REST_DAY_WALK
  return currentCardioStage(state.cardio)
}

/**
 * log = { kind: 'plan' | 'rest-walk', completed, effort, walkSpeed, jogSpeed,
 *         elapsedSeconds, distanceMiles?, notes? }
 */
export function logCardio(state, log, now = new Date()) {
  const effort = Number(log.effort)
  if (!Number.isInteger(effort) || effort < 1 || effort > 10) throw new Error('Choose an effort from 1 to 10.')
  const distance = log.distanceMiles === '' || log.distanceMiles == null ? null : Number(log.distanceMiles)
  if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 30)) {
    throw new Error('Distance must be between 0 and 30 miles.')
  }

  // Speeds validated the same way either way; only plan sessions save them as
  // your new defaults (a slow incline walk must not overwrite plan speeds).
  const withSpeeds = updateCardioSpeeds(state, {
    walkSpeed: log.walkSpeed ?? state.cardio.walkSpeed,
    jogSpeed: log.jogSpeed ?? state.cardio.jogSpeed,
  })
  const session = cardioSessionFor(withSpeeds, log.kind)
  const base = {
    id: makeId(now),
    date: now.toISOString(),
    kind: log.kind === 'rest-walk' ? 'rest-walk' : withSpeeds.cardio.phase,
    stageId: session.id,
    title: session.title,
    completed: Boolean(log.completed),
    effort,
    walkSpeed: withSpeeds.cardio.walkSpeed,
    jogSpeed: withSpeeds.cardio.jogSpeed,
    elapsedSeconds: Math.max(0, Math.round(Number(log.elapsedSeconds) || 0)),
    distanceMiles: distance,
    avgHr: validateHr(log.avgHr, { min: 40, max: 230, label: 'Average heart rate' }),
    maxHr: validateHr(log.maxHr, { min: 40, max: 230, label: 'Max heart rate' }),
    notes: String(log.notes ?? '').slice(0, 500),
  }
  if (base.avgHr !== null && base.maxHr !== null && base.maxHr < base.avgHr) {
    throw new Error('Max heart rate cannot be lower than the average.')
  }

  if (log.kind === 'rest-walk') {
    const record = { ...base, outcome: 'logged', message: 'Rest-day walk logged. Great for recovery.' }
    return { state: { ...state, cardioLogs: [...state.cardioLogs, record] }, record }
  }

  const result = evaluateCardio(withSpeeds.cardio, { completed: base.completed, effort })
  const record = { ...base, outcome: result.outcome, message: result.message }
  return {
    state: { ...withSpeeds, cardio: result.state, cardioLogs: [...state.cardioLogs, record] },
    record,
  }
}

export function deleteCardioLog(state, id) {
  return { ...state, cardioLogs: state.cardioLogs.filter((c) => c.id !== id) }
}

// ---------- Body tracking ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function addBodyweight(state, date, kg) {
  const value = Number(kg)
  if (!DATE_RE.test(date)) throw new Error('Pick a valid date.')
  if (!Number.isFinite(value) || value < 25 || value > 300) throw new Error('Bodyweight must be between 25 and 300 kg.')
  const rest = state.bodyweight.filter((e) => e.date !== date)
  const bodyweight = [...rest, { date, kg: Math.round(value * 10) / 10 }].sort((a, b) => a.date.localeCompare(b.date))
  return { ...state, bodyweight }
}

export function deleteBodyweight(state, date) {
  return { ...state, bodyweight: state.bodyweight.filter((e) => e.date !== date) }
}

export const MEASUREMENT_FIELDS = [
  { key: 'waistCm', label: 'Waist (at navel)' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'armCm', label: 'Arm (flexed)' },
  { key: 'thighCm', label: 'Thigh' },
]

export function addMeasurement(state, date, values) {
  if (!DATE_RE.test(date)) throw new Error('Pick a valid date.')
  const entry = { date }
  let any = false
  for (const { key, label } of MEASUREMENT_FIELDS) {
    const raw = values[key]
    if (raw === '' || raw == null) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 10 || n > 250) throw new Error(`${label} must be between 10 and 250 cm.`)
    entry[key] = Math.round(n * 10) / 10
    any = true
  }
  if (!any) throw new Error('Enter at least one measurement.')
  const rest = state.measurements.filter((e) => e.date !== date)
  return { ...state, measurements: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)) }
}

export function deleteMeasurement(state, date) {
  return { ...state, measurements: state.measurements.filter((e) => e.date !== date) }
}

// ---------- Body profile, nutrition, heart ----------

export function updateBodyProfile(state, { sex, age, heightCm }, now = new Date()) {
  if (sex !== 'male' && sex !== 'female') throw new Error('Choose male or female (used only for the calorie formula).')
  const a = Number(age)
  if (!Number.isInteger(a) || a < 14 || a > 90) throw new Error('Age must be a whole number between 14 and 90.')
  const h = Number(heightCm)
  if (!Number.isFinite(h) || h < 120 || h > 230) throw new Error('Height must be between 120 and 230 cm.')
  return { ...state, profile: { ...state.profile, sex, birthYear: now.getFullYear() - a, heightCm: Math.round(h) } }
}

export function updateNutritionSettings(state, { activity, goal }) {
  if (!ACTIVITY_LEVELS.some((x) => x.id === activity)) throw new Error('Choose an activity level.')
  if (!GOALS.some((x) => x.id === goal)) throw new Error('Choose a goal.')
  const goalChanged = goal !== state.nutrition.goal
  // A new goal starts from fresh numbers; old weekly adjustments no longer apply.
  return { ...state, nutrition: { ...state.nutrition, activity, goal, calorieAdjust: goalChanged ? 0 : state.nutrition.calorieAdjust } }
}

export function applyCalorieAdjust(state, delta, now = new Date()) {
  const d = Number(delta)
  if (![-150, 150].includes(d)) throw new Error('Invalid adjustment.')
  const next = Math.max(-600, Math.min(600, state.nutrition.calorieAdjust + d))
  return { ...state, nutrition: { ...state.nutrition, calorieAdjust: next, lastAdjustDate: dateKey(now) } }
}

export function addFoodEntry(state, date, food, now = new Date()) {
  if (!DATE_RE.test(date)) throw new Error('Pick a valid date.')
  const clean = validateFood(food)
  const servings = food.servings === undefined ? 1 : Number(food.servings)
  if (!Number.isFinite(servings) || servings < 0.25 || servings > 20) throw new Error('Servings must be between 0.25 and 20.')
  const entry = {
    id: makeId(now),
    name: servings === 1 ? clean.name : `${clean.name} × ${servings}`,
    kcal: Math.round(clean.kcal * servings),
    protein: Math.round(clean.protein * servings * 10) / 10,
  }
  const day = state.nutrition.log[date] ?? []
  if (day.length >= 60) throw new Error('That day already has 60 entries.')
  return { ...state, nutrition: { ...state.nutrition, log: { ...state.nutrition.log, [date]: [...day, entry] } } }
}

export function deleteFoodEntry(state, date, id) {
  const day = (state.nutrition.log[date] ?? []).filter((e) => e.id !== id)
  const log = { ...state.nutrition.log }
  if (day.length) log[date] = day
  else delete log[date]
  return { ...state, nutrition: { ...state.nutrition, log } }
}

export function saveCustomFood(state, food, now = new Date()) {
  const clean = validateFood(food)
  if (state.nutrition.customFoods.length >= 100) throw new Error('You can save up to 100 foods.')
  if (state.nutrition.customFoods.some((f) => f.name.toLowerCase() === clean.name.toLowerCase())) {
    throw new Error('A saved food already has that name.')
  }
  return { ...state, nutrition: { ...state.nutrition, customFoods: [...state.nutrition.customFoods, { id: makeId(now), ...clean }] } }
}

export function deleteCustomFood(state, id) {
  return { ...state, nutrition: { ...state.nutrition, customFoods: state.nutrition.customFoods.filter((f) => f.id !== id) } }
}

export function updateHeart(state, { maxHr, restingHr }) {
  const max = validateHr(maxHr, { min: 120, max: 230, label: 'Max heart rate' })
  const rest = validateHr(restingHr, { min: 30, max: 110, label: 'Resting heart rate' })
  if (max !== null && rest !== null && rest >= max - 40) throw new Error('Resting heart rate must be well below max heart rate.')
  return { ...state, heart: { maxHr: max, restingHr: rest } }
}

// ---------- Reminders, mobility, backup, UI ----------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateReminders(r) {
  if (!isObj(r)) throw new Error('Invalid reminder settings.')
  const days = [...new Set(r.days)].sort((a, b) => a - b)
  if (!days.length || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('Pick at least one training day.')
  if (!TIME_RE.test(r.time)) throw new Error('Pick a reminder time.')
  // Reminders get a 3-hour delivery window; keeping times between 05:00 and
  // 21:00 means that window never runs past midnight.
  const mins = Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3))
  if (mins < 300 || mins > 1260) throw new Error('Pick a reminder time between 05:00 and 21:00.')
  return {
    enabled: r.enabled === true,
    days,
    time: r.time,
    nudgeMissed: r.nudgeMissed !== false,
    nudgeBackup: r.nudgeBackup !== false,
  }
}

export function updateReminders(state, reminders) {
  return { ...state, reminders: validateReminders(reminders) }
}

export function logMobility(state, now = new Date()) {
  const logs = [...state.mobilityLogs, now.toISOString()].slice(-500)
  return { ...state, mobilityLogs: logs }
}

export function markBackedUp(state, now = new Date()) {
  return { ...state, lastBackupAt: now.toISOString() }
}

export function dismissDumbbellAlert(state, count) {
  return { ...state, ui: { ...state.ui, dumbbellAlertDismissedCount: count } }
}

// ---------- Validation (used on load and on backup restore) ----------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isStr = (v) => typeof v === 'string'
const isIso = (v) => isStr(v) && !Number.isNaN(Date.parse(v))

function fail(path, why) {
  throw new Error(`Invalid data at ${path}: ${why}`)
}

/**
 * Checks a stored or restored state thoroughly and returns a clean copy.
 * Throws with a readable message on anything malformed, so bad data is
 * rejected as a whole instead of half-loading and crashing a page later.
 */
export function normalizeState(raw) {
  if (!isObj(raw)) fail('root', 'not an object')
  // Version 1 data (before nutrition, heart rate, reminders, deloads, swaps
  // and mobility) is upgraded: its sections are validated as before and the
  // new sections start from their defaults.
  if (raw.version !== 1 && raw.version !== SCHEMA_VERSION) fail('version', `expected 1 or ${SCHEMA_VERSION}, got ${JSON.stringify(raw.version)}`)
  const v2 = raw.version === 2

  const fresh = createInitialState()

  if (!isObj(raw.profile)) fail('profile', 'missing')
  const profile = { onboarded: raw.profile.onboarded === true, name: isStr(raw.profile.name) ? raw.profile.name.slice(0, 40) : '', sex: null, birthYear: null, heightCm: null }
  if (v2) {
    const pr = raw.profile
    if (pr.sex !== null && pr.sex !== 'male' && pr.sex !== 'female') fail('profile.sex', 'invalid')
    if (pr.birthYear !== null && (!Number.isInteger(pr.birthYear) || pr.birthYear < 1900 || pr.birthYear > 2100)) fail('profile.birthYear', 'invalid')
    if (pr.heightCm !== null && (!isNum(pr.heightCm) || pr.heightCm < 100 || pr.heightCm > 250)) fail('profile.heightCm', 'invalid')
    Object.assign(profile, { sex: pr.sex, birthYear: pr.birthYear, heightCm: pr.heightCm })
  }

  let equipment
  try {
    equipment = validateEquipment(raw.equipment)
  } catch (e) {
    fail('equipment', e.message)
  }

  if (!isObj(raw.tracks)) fail('tracks', 'missing')
  const tracks = {}
  for (const track of Object.values(TRACKS)) {
    const s = raw.tracks[track.id]
    if (s === undefined) {
      // A track added in a newer app version: start it fresh.
      tracks[track.id] = initialTrackState(track, equipment)
      continue
    }
    const p = `tracks.${track.id}`
    if (!isObj(s)) fail(p, 'not an object')
    if (!Number.isInteger(s.levelIndex) || s.levelIndex < 0 || s.levelIndex >= track.levels.length) fail(`${p}.levelIndex`, 'out of range')
    if (track.type === 'weighted' ? !isNum(s.weight) || s.weight < 0 : s.weight !== null && s.weight !== undefined) fail(`${p}.weight`, 'invalid')
    if (!Number.isInteger(s.missStreak) || s.missStreak < 0) fail(`${p}.missStreak`, 'invalid')
    const last = s.lastPerformedAt ?? null
    if (last !== null && !isIso(last)) fail(`${p}.lastPerformedAt`, 'invalid date')
    const swapId = s.swapId ?? null
    if (swapId !== null && !findSwap(track.id, swapId)) fail(`${p}.swapId`, 'unknown swap')
    tracks[track.id] = {
      levelIndex: s.levelIndex,
      weight: track.type === 'weighted' ? s.weight : null,
      missStreak: s.missStreak,
      lastPerformedAt: last,
      swapId,
    }
  }

  const c = raw.cardio
  if (!isObj(c)) fail('cardio', 'missing')
  if (c.phase !== 'builder' && c.phase !== 'fitness') fail('cardio.phase', 'invalid')
  if (!Number.isInteger(c.stageIndex) || c.stageIndex < 0 || c.stageIndex >= BUILDER_STAGES.length) fail('cardio.stageIndex', 'out of range')
  for (const k of ['successes', 'failures', 'rotationIndex']) {
    if (!Number.isInteger(c[k]) || c[k] < 0) fail(`cardio.${k}`, 'invalid')
  }
  if (!isNum(c.walkSpeed) || c.walkSpeed < 1 || c.walkSpeed > 5) fail('cardio.walkSpeed', 'out of range')
  if (!isNum(c.jogSpeed) || c.jogSpeed < 2 || c.jogSpeed > 12) fail('cardio.jogSpeed', 'out of range')
  const cardio = {
    phase: c.phase,
    stageIndex: c.stageIndex,
    successes: c.successes,
    failures: c.failures,
    rotationIndex: c.rotationIndex % FITNESS_ROTATION.length,
    walkSpeed: c.walkSpeed,
    jogSpeed: c.jogSpeed,
  }

  const activeWorkout = raw.activeWorkout === null || raw.activeWorkout === undefined ? null : checkActiveWorkout(raw.activeWorkout)

  if (!Array.isArray(raw.workouts)) fail('workouts', 'not a list')
  const workouts = raw.workouts.map((w, i) => checkWorkoutRecord(w, `workouts[${i}]`))

  if (!Array.isArray(raw.cardioLogs)) fail('cardioLogs', 'not a list')
  const cardioLogs = raw.cardioLogs.map((l, i) => {
    const p = `cardioLogs[${i}]`
    if (!isObj(l)) fail(p, 'not an object')
    if (!isStr(l.id) || !isIso(l.date) || !isStr(l.title)) fail(p, 'missing id, date or title')
    if (!['builder', 'fitness', 'rest-walk'].includes(l.kind)) fail(`${p}.kind`, 'invalid')
    if (typeof l.completed !== 'boolean') fail(`${p}.completed`, 'invalid')
    if (!Number.isInteger(l.effort) || l.effort < 1 || l.effort > 10) fail(`${p}.effort`, 'invalid')
    if (!isNum(l.walkSpeed) || !isNum(l.jogSpeed)) fail(p, 'invalid speeds')
    if (!isNum(l.elapsedSeconds) || l.elapsedSeconds < 0) fail(`${p}.elapsedSeconds`, 'invalid')
    if (l.distanceMiles !== null && (!isNum(l.distanceMiles) || l.distanceMiles < 0)) fail(`${p}.distanceMiles`, 'invalid')
    for (const k of ['avgHr', 'maxHr']) {
      const v = l[k] ?? null
      if (v !== null && (!Number.isInteger(v) || v < 30 || v > 250)) fail(`${p}.${k}`, 'invalid')
    }
    return {
      avgHr: l.avgHr ?? null,
      maxHr: l.maxHr ?? null,
      id: l.id,
      date: l.date,
      kind: l.kind,
      stageId: isStr(l.stageId) ? l.stageId : '',
      title: l.title,
      completed: l.completed,
      effort: l.effort,
      walkSpeed: l.walkSpeed,
      jogSpeed: l.jogSpeed,
      elapsedSeconds: l.elapsedSeconds,
      distanceMiles: l.distanceMiles,
      notes: isStr(l.notes) ? l.notes : '',
      outcome: isStr(l.outcome) ? l.outcome : '',
      message: isStr(l.message) ? l.message : '',
    }
  })

  if (!Array.isArray(raw.bodyweight)) fail('bodyweight', 'not a list')
  const bodyweight = raw.bodyweight.map((e, i) => {
    if (!isObj(e) || !DATE_RE.test(e.date) || !isNum(e.kg) || e.kg <= 0) fail(`bodyweight[${i}]`, 'invalid entry')
    return { date: e.date, kg: e.kg }
  })

  if (!Array.isArray(raw.measurements)) fail('measurements', 'not a list')
  const measurements = raw.measurements.map((e, i) => {
    if (!isObj(e) || !DATE_RE.test(e.date)) fail(`measurements[${i}]`, 'invalid entry')
    const out = { date: e.date }
    for (const { key } of MEASUREMENT_FIELDS) {
      if (e[key] === undefined) continue
      if (!isNum(e[key]) || e[key] <= 0) fail(`measurements[${i}].${key}`, 'invalid')
      out[key] = e[key]
    }
    return out
  })

  const extras = v2 ? checkV2Sections(raw, workouts.length) : {}

  return {
    ...fresh,
    version: SCHEMA_VERSION,
    profile,
    equipment,
    tracks,
    cardio,
    activeWorkout,
    workouts,
    cardioLogs,
    bodyweight,
    measurements,
    ...extras,
  }
}

function checkV2Sections(raw, workoutCount) {
  const n = raw.nutrition
  if (!isObj(n)) fail('nutrition', 'missing')
  if (!ACTIVITY_LEVELS.some((a) => a.id === n.activity)) fail('nutrition.activity', 'invalid')
  if (!GOALS.some((g) => g.id === n.goal)) fail('nutrition.goal', 'invalid')
  if (!isNum(n.calorieAdjust) || Math.abs(n.calorieAdjust) > 600) fail('nutrition.calorieAdjust', 'invalid')
  if (n.lastAdjustDate !== null && !DATE_RE.test(n.lastAdjustDate)) fail('nutrition.lastAdjustDate', 'invalid')
  if (!isObj(n.log)) fail('nutrition.log', 'invalid')
  const log = {}
  for (const [date, entries] of Object.entries(n.log)) {
    if (!DATE_RE.test(date) || !Array.isArray(entries)) fail(`nutrition.log.${date}`, 'invalid')
    log[date] = entries.map((e, i) => {
      const p = `nutrition.log.${date}[${i}]`
      if (!isObj(e) || !isStr(e.id) || !isStr(e.name)) fail(p, 'invalid entry')
      if (!isNum(e.kcal) || e.kcal < 0 || e.kcal > 100000) fail(`${p}.kcal`, 'invalid')
      if (!isNum(e.protein) || e.protein < 0 || e.protein > 6000) fail(`${p}.protein`, 'invalid')
      return { id: e.id, name: e.name.slice(0, 80), kcal: e.kcal, protein: e.protein }
    })
  }
  if (!Array.isArray(n.customFoods)) fail('nutrition.customFoods', 'invalid')
  const customFoods = n.customFoods.map((f, i) => {
    if (!isObj(f) || !isStr(f.id)) fail(`nutrition.customFoods[${i}]`, 'invalid')
    try {
      return { id: f.id, ...validateFood(f) }
    } catch (e) {
      return fail(`nutrition.customFoods[${i}]`, e.message)
    }
  })

  const h = raw.heart
  if (!isObj(h)) fail('heart', 'missing')
  let heart
  try {
    heart = updateHeart({}, { maxHr: h.maxHr, restingHr: h.restingHr }).heart
  } catch (e) {
    fail('heart', e.message)
  }

  let reminders
  try {
    reminders = validateReminders(raw.reminders)
  } catch (e) {
    fail('reminders', e.message)
  }

  const d = raw.deload
  if (!isObj(d) || typeof d.active !== 'boolean') fail('deload', 'invalid')
  for (const k of ['workoutsDone', 'lastEndedAtCount', 'completedCount']) {
    if (!Number.isInteger(d[k]) || d[k] < 0) fail(`deload.${k}`, 'invalid')
  }
  if (d.snoozedAtCount !== null && (!Number.isInteger(d.snoozedAtCount) || d.snoozedAtCount < 0)) fail('deload.snoozedAtCount', 'invalid')
  const deload = {
    active: d.active,
    workoutsDone: d.workoutsDone,
    // Deleting history can leave the marker past the end; clamp it.
    lastEndedAtCount: Math.min(d.lastEndedAtCount, workoutCount),
    snoozedAtCount: d.snoozedAtCount === null ? null : Math.min(d.snoozedAtCount, workoutCount),
    completedCount: d.completedCount,
  }

  if (!Array.isArray(raw.mobilityLogs) || !raw.mobilityLogs.every(isIso)) fail('mobilityLogs', 'invalid')
  if (raw.lastBackupAt !== null && !isIso(raw.lastBackupAt)) fail('lastBackupAt', 'invalid')
  if (!isObj(raw.ui) || !Number.isInteger(raw.ui.dumbbellAlertDismissedCount) || raw.ui.dumbbellAlertDismissedCount < 0) fail('ui', 'invalid')

  return {
    nutrition: { activity: n.activity, goal: n.goal, calorieAdjust: n.calorieAdjust, lastAdjustDate: n.lastAdjustDate, log, customFoods },
    heart,
    reminders,
    deload,
    mobilityLogs: [...raw.mobilityLogs],
    lastBackupAt: raw.lastBackupAt,
    ui: { dumbbellAlertDismissedCount: raw.ui.dumbbellAlertDismissedCount },
  }
}

function checkSet(s, p, { requireDone }) {
  if (!isObj(s)) fail(p, 'not an object')
  if (s.weight !== null && (!isNum(s.weight) || s.weight < 0)) fail(`${p}.weight`, 'invalid')
  if (s.value !== null && (!isNum(s.value) || s.value < 0)) fail(`${p}.value`, 'invalid')
  const rir = s.rir ?? null
  if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 3)) fail(`${p}.rir`, 'invalid')
  if (requireDone) return { weight: s.weight, value: s.value, rir }
  if (typeof s.done !== 'boolean') fail(`${p}.done`, 'invalid')
  return { weight: s.weight, value: s.value, done: s.done, rir }
}

function checkSwapId(ex, p) {
  const swapId = ex.swapId ?? null
  if (swapId !== null && !findSwap(ex.trackId, swapId)) fail(`${p}.swapId`, 'unknown swap')
  return swapId
}

function checkExerciseCommon(ex, p) {
  if (!isObj(ex)) fail(p, 'not an object')
  const track = TRACKS[ex.trackId]
  if (!track) fail(`${p}.trackId`, 'unknown exercise')
  if (!Number.isInteger(ex.levelIndex) || ex.levelIndex < 0 || ex.levelIndex >= track.levels.length) fail(`${p}.levelIndex`, 'out of range')
  if (!isObj(ex.target)) fail(`${p}.target`, 'missing')
  if (!Array.isArray(ex.sets)) fail(`${p}.sets`, 'not a list')
  return track
}

// The target is shown on screen and drives the set rows, so restrict it to
// plain numbers (and an optional note) rather than trusting the file.
function checkTarget(target, p) {
  const out = {}
  for (const [key, max] of [['sets', 20], ['low', 600], ['high', 600]]) {
    const v = target[key]
    if (!Number.isInteger(v) || v < 0 || v > max) fail(`${p}.target.${key}`, 'invalid')
    out[key] = v
  }
  if (target.weight !== null && target.weight !== undefined && (!isNum(target.weight) || target.weight < 0 || target.weight > 500)) {
    fail(`${p}.target.weight`, 'invalid')
  }
  out.weight = target.weight ?? null
  out.note = isStr(target.note) ? target.note.slice(0, 300) : null
  return out
}

function checkActiveWorkout(aw) {
  const p = 'activeWorkout'
  if (!isObj(aw)) fail(p, 'not an object')
  if (!isStr(aw.id) || !WORKOUTS[aw.workoutId] || !isIso(aw.startedAt)) fail(p, 'missing id, workout or start time')
  if (!Array.isArray(aw.warmUpDone) || !aw.warmUpDone.every(isStr)) fail(`${p}.warmUpDone`, 'invalid')
  if (!Array.isArray(aw.exercises)) fail(`${p}.exercises`, 'not a list')
  return {
    id: aw.id,
    workoutId: aw.workoutId,
    startedAt: aw.startedAt,
    warmUpDone: [...aw.warmUpDone],
    deload: aw.deload === true,
    exercises: aw.exercises.map((ex, i) => {
      const ep = `${p}.exercises[${i}]`
      checkExerciseCommon(ex, ep)
      return {
        trackId: ex.trackId,
        levelIndex: ex.levelIndex,
        swapId: checkSwapId(ex, ep),
        target: checkTarget(ex.target, ep),
        sets: ex.sets.map((s, j) => checkSet(s, `${ep}.sets[${j}]`, { requireDone: false })),
      }
    }),
  }
}

function checkWorkoutRecord(w, p) {
  if (!isObj(w)) fail(p, 'not an object')
  if (!isStr(w.id) || !WORKOUTS[w.workoutId] || !isIso(w.startedAt) || !isIso(w.finishedAt)) fail(p, 'missing id, workout or times')
  if (!Array.isArray(w.exercises)) fail(`${p}.exercises`, 'not a list')
  return {
    id: w.id,
    workoutId: w.workoutId,
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    deload: w.deload === true,
    exercises: w.exercises.map((ex, i) => {
      const ep = `${p}.exercises[${i}]`
      const track = checkExerciseCommon(ex, ep)
      return {
        trackId: ex.trackId,
        levelIndex: ex.levelIndex,
        levelName: isStr(ex.levelName) ? ex.levelName : track.levels[ex.levelIndex].name,
        swapId: checkSwapId(ex, ep),
        type: track.type,
        target: checkTarget(ex.target, ep),
        sets: ex.sets.map((s, j) => checkSet(s, `${ep}.sets[${j}]`, { requireDone: true })),
        outcome: isStr(ex.outcome) ? ex.outcome : '',
        message: isStr(ex.message) ? ex.message : '',
      }
    }),
  }
}

// ---------- Backup ----------

export const BACKUP_APP_ID = 'forge-bodybuilding'

// photos: optional array of progress photos to include (see store/photos.js).
export function serializeBackup(state, now = new Date(), photos = null) {
  const file = { app: BACKUP_APP_ID, exportedAt: now.toISOString(), data: state }
  if (photos) file.photos = photos
  return JSON.stringify(file, photos ? undefined : null, photos ? undefined : 2)
}

function parseBackupFile(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP_ID) throw new Error('This is not a Forge backup file.')
  return parsed
}

export function parseBackup(text) {
  return normalizeState(parseBackupFile(text).data)
}

/**
 * Validates the whole backup, including photos, before anything is written.
 * Returns { state, photos } where photos is null when the backup has none
 * (so existing photos on the device are left alone).
 */
export function parseFullBackup(text, validatePhoto) {
  const file = parseBackupFile(text)
  const state = normalizeState(file.data)
  let photos = null
  if (file.photos !== undefined) {
    if (!Array.isArray(file.photos)) fail('photos', 'not a list')
    photos = file.photos.map((p, i) => validatePhoto(p, `photos[${i}]`))
  }
  return { state, photos }
}
