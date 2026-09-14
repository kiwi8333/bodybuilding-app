import { repRange } from '../data/tracks.js'
import { availableWeights, nextWeightDown, nextWeightUp, roundDownToAvailable, sameWeight } from './weights.js'

// A missed session is one where any set fell below the bottom of the rep
// range, or fewer sets than prescribed were completed. Two misses in a row at
// the same prescription trigger a reset (lighter weight or easier level).
export const MISSES_BEFORE_RESET = 2
// Coming back after this many days off: start ~10% lighter for one session.
export const LAYOFF_DAYS = 14
const DELOAD_FACTOR = 0.9
const DEFAULT_ENTRY_FACTOR = 0.8

const DAY_MS = 24 * 60 * 60 * 1000

export function initialTrackState(track, equipment) {
  const level = track.levels[0]
  return {
    levelIndex: 0,
    weight: track.type === 'weighted' ? startWeightFor(level, equipment) : null,
    missStreak: 0,
    lastPerformedAt: null,
  }
}

function startWeightFor(level, equipment) {
  const weights = availableWeights(equipment, { allowBodyweight: level.allowBodyweight })
  return roundDownToAvailable(level.startWeight ?? weights[0], weights)
}

function weightsForLevel(level, equipment) {
  return availableWeights(equipment, { allowBodyweight: level.allowBodyweight })
}

// What to do today for a track.
export function prescribe(track, state, equipment, now = new Date()) {
  const levelIndex = clampLevel(track, state.levelIndex)
  const level = track.levels[levelIndex]
  const [low, high] = repRange(track, level)
  const result = {
    trackId: track.id,
    levelIndex,
    levelName: level.name,
    sets: track.sets,
    low,
    high,
    weight: null,
    note: null,
  }
  if (track.type !== 'weighted') return result

  const weights = weightsForLevel(level, equipment)
  let weight = roundDownToAvailable(state.weight ?? startWeightFor(level, equipment), weights)
  if (state.lastPerformedAt) {
    const daysOff = Math.floor((now.getTime() - new Date(state.lastPerformedAt).getTime()) / DAY_MS)
    if (daysOff >= LAYOFF_DAYS) {
      const eased = roundDownToAvailable(weight * DELOAD_FACTOR, weights)
      if (!sameWeight(eased, weight)) {
        weight = eased
        result.note = `${daysOff} days since you last did this. Starting ~10% lighter to ease back in.`
      }
    }
  }
  result.weight = weight
  return result
}

function clampLevel(track, levelIndex) {
  const n = Number.isInteger(levelIndex) ? levelIndex : 0
  return Math.max(0, Math.min(n, track.levels.length - 1))
}

/**
 * Decide the next state for a track after a session.
 *
 * performance = {
 *   levelIndex,               // level actually performed
 *   sets: [{ value, weight }] // value = reps (or seconds for holds); only completed sets
 * }
 *
 * Returns { state, outcome, message }. outcome is one of:
 *   'skipped' | 'increase-weight' | 'next-level' | 'maxed' | 'repeat' | 'reset'
 */
export function evaluate(track, state, performance, equipment, performedAt = new Date().toISOString()) {
  const sets = (performance.sets ?? []).filter((s) => Number.isFinite(s.value) && s.value > 0)
  if (sets.length === 0) {
    return { state, outcome: 'skipped', message: 'Not performed. Same target next time.' }
  }

  const levelIndex = clampLevel(track, performance.levelIndex)
  const level = track.levels[levelIndex]
  const [low, high] = repRange(track, level)
  const unit = track.type === 'hold' ? 's' : ' reps'

  const allSetsDone = sets.length >= track.sets
  const hitTop = allSetsDone && sets.every((s) => s.value >= high)
  const missed = !allSetsDone || sets.some((s) => s.value < low)

  const base = { ...state, levelIndex, lastPerformedAt: performedAt }

  if (track.type === 'weighted') {
    const weights = weightsForLevel(level, equipment)
    // Progress from the lightest weight used, so one heavy set never
    // pushes the next prescription above what you proved on every set.
    const used = roundDownToAvailable(Math.min(...sets.map((s) => s.weight ?? 0)), weights)

    if (hitTop) {
      const up = nextWeightUp(used, weights)
      if (up !== null) {
        return {
          state: { ...base, weight: up, missStreak: 0 },
          outcome: 'increase-weight',
          message: `All sets hit ${high}${unit}. Next time: ${up} kg.`,
        }
      }
      return advanceLevel(track, base, levelIndex, used, equipment)
    }

    if (missed) {
      const streak = (state.levelIndex === levelIndex && sameWeight(state.weight ?? used, used) ? state.missStreak ?? 0 : 0) + 1
      if (streak >= MISSES_BEFORE_RESET) {
        let lighter = roundDownToAvailable(used * DELOAD_FACTOR, weights)
        if (sameWeight(lighter, used)) lighter = nextWeightDown(used, weights)
        if (!sameWeight(lighter, used)) {
          return {
            state: { ...base, weight: lighter, missStreak: 0 },
            outcome: 'reset',
            message: `Below ${low}${unit} twice in a row. Dropping to ${lighter} kg to rebuild with clean reps.`,
          }
        }
        if (levelIndex > 0) return dropLevel(track, base, levelIndex, used, equipment, low, unit)
        return {
          state: { ...base, weight: used, missStreak: 0 },
          outcome: 'repeat',
          message: `Already at your lightest weight. Keep at ${used} kg and focus on form; strength will come.`,
        }
      }
      return {
        state: { ...base, weight: used, missStreak: streak },
        outcome: 'repeat',
        message: `Some sets were under ${low}${unit}. Repeat ${used} kg next time.`,
      }
    }

    return {
      state: { ...base, weight: used, missStreak: 0 },
      outcome: 'repeat',
      message: `Good work. Stay at ${used} kg and add a rep or two until every set reaches ${high}.`,
    }
  }

  // Bodyweight reps and holds.
  if (hitTop) return advanceLevel(track, base, levelIndex, null, equipment)

  if (missed) {
    const streak = (state.levelIndex === levelIndex ? state.missStreak ?? 0 : 0) + 1
    if (streak >= MISSES_BEFORE_RESET && levelIndex > 0) {
      return dropLevel(track, base, levelIndex, null, equipment, low, unit)
    }
    return {
      state: { ...base, missStreak: streak >= MISSES_BEFORE_RESET ? 0 : streak },
      outcome: 'repeat',
      message: `Some sets were under ${low}${unit}. Same level next time. Rest fully between sets.`,
    }
  }

  return {
    state: { ...base, missStreak: 0 },
    outcome: 'repeat',
    message: `Good work. Beat your numbers next time until every set reaches ${high}${unit}.`,
  }
}

function advanceLevel(track, base, levelIndex, usedWeight, equipment) {
  const nextIndex = levelIndex + 1
  if (nextIndex >= track.levels.length) {
    return {
      state: { ...base, weight: usedWeight, missStreak: 0 },
      outcome: 'maxed',
      message:
        track.type === 'weighted'
          ? 'You have beaten the hardest version with your heaviest dumbbells. Keep every rep slow and strict, or get heavier dumbbells and raise the max in Settings.'
          : 'You have beaten the hardest version. Slow each rep down (4 s lowering) to keep it challenging.',
    }
  }
  const next = track.levels[nextIndex]
  let weight = null
  if (track.type === 'weighted') {
    const weights = weightsForLevel(next, equipment)
    weight = roundDownToAvailable(usedWeight * (next.entryFactor ?? DEFAULT_ENTRY_FACTOR), weights)
  }
  return {
    state: { ...base, levelIndex: nextIndex, weight, missStreak: 0 },
    outcome: 'next-level',
    message: `Level beaten! Next time: ${next.name}${weight !== null ? ` at ${weight} kg` : ''}.`,
  }
}

function dropLevel(track, base, levelIndex, usedWeight, equipment, low, unit) {
  const prevIndex = levelIndex - 1
  const prev = track.levels[prevIndex]
  let weight = null
  if (track.type === 'weighted') {
    // Only reached when already at the lightest weight, so the easier level
    // starts light as well.
    const weights = weightsForLevel(prev, equipment)
    weight = roundDownToAvailable(Math.max(usedWeight ?? 0, weights[0]), weights)
  }
  return {
    state: { ...base, levelIndex: prevIndex, weight, missStreak: 0 },
    outcome: 'reset',
    message: `Below ${low}${unit} twice in a row. Stepping back to ${prev.name} to build up again.`,
  }
}
