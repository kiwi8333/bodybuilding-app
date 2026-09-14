import { TRACKS, isPerSide } from './tracks.js'

// Three full-body sessions per week, alternating A and B:
//   week 1: A B A, week 2: B A B, ...
// Full-body training three times a week hits every muscle roughly 1.5 times
// per week with 7–10 hard sets, the proven sweet spot for beginners.

export const WARM_UP = [
  { id: 'walk', text: 'Treadmill brisk walk: 3 min at 3.0 mph, 3% incline' },
  { id: 'squats', text: '10 bodyweight squats, slow and deep' },
  { id: 'hinges', text: '10 hip hinges (hands on hips, push hips back)' },
  { id: 'arms', text: '10 arm circles forwards + 10 backwards' },
  { id: 'pushups', text: '8 incline push-ups on the kitchen counter' },
  { id: 'rampup', text: 'First exercise: 1 light set of 8 at about half your working weight' },
]

export const WORKOUTS = {
  A: {
    id: 'A',
    name: 'Workout A',
    focus: 'Squat · Push-up · One-arm row · Hinge · Shoulders & arms',
    trackIds: ['squat', 'pushup', 'row', 'hinge', 'lateralRaise', 'curl', 'deadBug'],
  },
  B: {
    id: 'B',
    name: 'Workout B',
    focus: 'Split squat · Floor press · Bent-over row · Press · Glutes & arms',
    trackIds: ['lunge', 'floorPress', 'bentOverRow', 'overheadPress', 'bridge', 'triceps', 'plank'],
  },
}

export function nextWorkoutId(workoutHistory) {
  const last = [...workoutHistory].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).at(-1)
  if (!last) return 'A'
  return last.workoutId === 'A' ? 'B' : 'A'
}

// Rough duration of the lifting part, in minutes. Assumes ~40 s per rep-based
// set, or the top of the hold range for holds (doubled for per-side
// exercises), plus the prescribed rest.
export function estimateLiftMinutes(workoutId, trackState = {}) {
  const workout = WORKOUTS[workoutId]
  let seconds = 0
  for (const trackId of workout.trackIds) {
    const track = TRACKS[trackId]
    const levelIndex = Math.min(trackState[trackId]?.levelIndex ?? 0, track.levels.length - 1)
    const work = track.type === 'hold' ? track.levels[levelIndex].secMax : 40
    const perSet = work * (isPerSide(track, levelIndex) ? 2 : 1) + track.restSeconds
    seconds += perSet * track.sets
  }
  return Math.round(seconds / 60)
}

export const WARM_UP_MINUTES = 6
