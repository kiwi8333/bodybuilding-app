// Planned deload: after about 8 weeks of training (24 workouts at 3 a week),
// one lighter week lets joints and nerves recover so progress keeps coming.
// During a deload: one set fewer per exercise and ~10% less weight, and
// progression is paused (nothing goes up, nothing counts as a miss).

import { availableWeights, roundDownToAvailable } from './weights.js'

export const WORKOUTS_BETWEEN_DELOADS = 24
export const DELOAD_WORKOUTS = 3
export const SNOOZE_WORKOUTS = 3
const DELOAD_LOAD = 0.9

export function initialDeload() {
  return { active: false, workoutsDone: 0, lastEndedAtCount: 0, snoozedAtCount: null, completedCount: 0 }
}

export function workoutsSinceDeload(deload, totalWorkouts) {
  return Math.max(0, totalWorkouts - deload.lastEndedAtCount)
}

export function deloadDue(deload, totalWorkouts) {
  if (deload.active) return false
  if (workoutsSinceDeload(deload, totalWorkouts) < WORKOUTS_BETWEEN_DELOADS) return false
  if (deload.snoozedAtCount !== null && totalWorkouts < deload.snoozedAtCount + SNOOZE_WORKOUTS) return false
  return true
}

export function startDeload(deload) {
  return { ...deload, active: true, workoutsDone: 0, snoozedAtCount: null }
}

export function snoozeDeload(deload, totalWorkouts) {
  return { ...deload, snoozedAtCount: totalWorkouts }
}

// Called after each finished workout (totalWorkouts includes the new one).
export function afterWorkout(deload, totalWorkouts) {
  if (!deload.active) return deload
  const done = deload.workoutsDone + 1
  if (done >= DELOAD_WORKOUTS) {
    return { active: false, workoutsDone: 0, lastEndedAtCount: totalWorkouts, snoozedAtCount: null, completedCount: deload.completedCount + 1 }
  }
  return { ...deload, workoutsDone: done }
}

export function cancelDeload(deload, totalWorkouts) {
  return { ...deload, active: false, workoutsDone: 0, lastEndedAtCount: totalWorkouts, snoozedAtCount: null }
}

// Lighter prescription for a deload session.
export function deloadTarget(track, level, target, equipment) {
  const sets = Math.max(1, target.sets - 1)
  if (track.type !== 'weighted' || target.weight === null) return { ...target, sets }
  const weights = availableWeights(equipment, { allowBodyweight: level.allowBodyweight })
  return { ...target, sets, weight: roundDownToAvailable(target.weight * DELOAD_LOAD, weights) }
}
