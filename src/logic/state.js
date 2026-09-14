// Pure state transitions. No React, no localStorage, so every rule here is
// unit-tested directly.

import { TRACKS, getTrack } from '../data/tracks.js'
import { WORKOUTS } from '../data/program.js'
import { BUILDER_STAGES, FITNESS_ROTATION, REST_DAY_WALK, currentCardioStage } from '../data/cardio.js'
import { evaluate, initialTrackState, prescribe } from './progression.js'
import { evaluateCardio, initialCardioState } from './cardioProgression.js'

export const SCHEMA_VERSION = 1

export const DEFAULT_EQUIPMENT = { minWeight: 2.5, increment: 2.5, maxWeight: 15 }

export function createInitialState() {
  const equipment = { ...DEFAULT_EQUIPMENT }
  return {
    version: SCHEMA_VERSION,
    profile: { onboarded: false, name: '' },
    equipment,
    tracks: Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, initialTrackState(t, equipment)])),
    cardio: initialCardioState(),
    activeWorkout: null,
    workouts: [],
    cardioLogs: [],
    bodyweight: [],
    measurements: [],
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
  const exercises = workout.trackIds.map((trackId) => buildExercise(state, trackId, state.tracks[trackId].levelIndex, now))
  return {
    ...state,
    activeWorkout: {
      id: makeId(now),
      workoutId,
      startedAt: now.toISOString(),
      warmUpDone: [],
      exercises,
    },
  }
}

function buildExercise(state, trackId, levelIndex, now) {
  const track = getTrack(trackId)
  const p = prescribe(track, { ...state.tracks[trackId], levelIndex }, state.equipment, now)
  return {
    trackId,
    levelIndex: p.levelIndex,
    target: { sets: p.sets, low: p.low, high: p.high, weight: p.weight, note: p.note },
    sets: Array.from({ length: p.sets }, () => ({ weight: p.weight, value: null, done: false })),
  }
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
  const rebuilt = buildExercise({ ...state, tracks: { ...state.tracks, [ex.trackId]: trackState } }, ex.trackId, levelIndex, now)
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
    const completedSets = ex.sets
      .filter((s) => s.done && Number.isFinite(s.value) && s.value > 0)
      .map((s) => ({ value: s.value, weight: track.type === 'weighted' ? s.weight : null }))
    const result = evaluate(track, tracks[ex.trackId], { levelIndex: ex.levelIndex, sets: completedSets }, state.equipment, performedAt)
    tracks[ex.trackId] = result.state
    return {
      trackId: ex.trackId,
      levelIndex: ex.levelIndex,
      levelName: track.levels[ex.levelIndex].name,
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
    exercises,
  }
  return { ...state, tracks, activeWorkout: null, workouts: [...state.workouts, record] }
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
    notes: String(log.notes ?? '').slice(0, 500),
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
  if (raw.version !== SCHEMA_VERSION) fail('version', `expected ${SCHEMA_VERSION}, got ${JSON.stringify(raw.version)}`)

  const fresh = createInitialState()

  if (!isObj(raw.profile)) fail('profile', 'missing')
  const profile = { onboarded: raw.profile.onboarded === true, name: isStr(raw.profile.name) ? raw.profile.name.slice(0, 40) : '' }

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
    tracks[track.id] = {
      levelIndex: s.levelIndex,
      weight: track.type === 'weighted' ? s.weight : null,
      missStreak: s.missStreak,
      lastPerformedAt: last,
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
    return {
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
  }
}

function checkSet(s, p, { requireDone }) {
  if (!isObj(s)) fail(p, 'not an object')
  if (s.weight !== null && (!isNum(s.weight) || s.weight < 0)) fail(`${p}.weight`, 'invalid')
  if (s.value !== null && (!isNum(s.value) || s.value < 0)) fail(`${p}.value`, 'invalid')
  if (requireDone) return { weight: s.weight, value: s.value }
  if (typeof s.done !== 'boolean') fail(`${p}.done`, 'invalid')
  return { weight: s.weight, value: s.value, done: s.done }
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
    exercises: aw.exercises.map((ex, i) => {
      const ep = `${p}.exercises[${i}]`
      checkExerciseCommon(ex, ep)
      return { trackId: ex.trackId, levelIndex: ex.levelIndex, target: { ...ex.target }, sets: ex.sets.map((s, j) => checkSet(s, `${ep}.sets[${j}]`, { requireDone: false })) }
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
    exercises: w.exercises.map((ex, i) => {
      const ep = `${p}.exercises[${i}]`
      const track = checkExerciseCommon(ex, ep)
      return {
        trackId: ex.trackId,
        levelIndex: ex.levelIndex,
        levelName: isStr(ex.levelName) ? ex.levelName : track.levels[ex.levelIndex].name,
        type: track.type,
        target: { ...ex.target },
        sets: ex.sets.map((s, j) => checkSet(s, `${ep}.sets[${j}]`, { requireDone: true })),
        outcome: isStr(ex.outcome) ? ex.outcome : '',
        message: isStr(ex.message) ? ex.message : '',
      }
    }),
  }
}

// ---------- Backup ----------

export const BACKUP_APP_ID = 'forge-bodybuilding'

export function serializeBackup(state, now = new Date()) {
  return JSON.stringify({ app: BACKUP_APP_ID, exportedAt: now.toISOString(), data: state }, null, 2)
}

export function parseBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP_ID) throw new Error('This is not a Forge backup file.')
  return normalizeState(parsed.data)
}
