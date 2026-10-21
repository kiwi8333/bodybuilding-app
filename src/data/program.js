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

export const GYM_WARM_UP = [
  { id: 'gym-cardio', text: 'Treadmill, bike or rower: 3–5 min, easy pace' },
  { id: 'gym-squats', text: '10 bodyweight squats, slow and deep' },
  { id: 'gym-hinges', text: '10 hip hinges (hands on hips, push hips back)' },
  { id: 'gym-arms', text: '10 arm circles forwards + 10 backwards, 10 band pull-aparts if there is a band' },
  { id: 'gym-rampup', text: 'First exercise: 1 light set of 10 at about half your working weight, then 5 reps at about three quarters' },
]

export const LOCATIONS = [
  { id: 'home', label: 'Home' },
  { id: 'gym', label: 'Gym' },
]

export const WORKOUTS = {
  A: {
    id: 'A',
    location: 'home',
    name: 'Workout A',
    focus: 'Squat · Push-up · One-arm row · Hinge · Shoulders & arms',
    trackIds: ['squat', 'pushup', 'row', 'hinge', 'lateralRaise', 'curl', 'deadBug'],
  },
  B: {
    id: 'B',
    location: 'home',
    name: 'Workout B',
    focus: 'Split squat · Floor press · Bent-over row · Press · Glutes & arms',
    trackIds: ['lunge', 'floorPress', 'bentOverRow', 'overheadPress', 'bridge', 'triceps', 'plank'],
  },
  // Full gym: the same full-body A/B structure, with barbells, machines and
  // cables doing the heavy lifting.
  GA: {
    id: 'GA',
    location: 'gym',
    name: 'Gym A',
    focus: 'Back squat · Bench press · Pulldown · Romanian deadlift · Shoulders & arms',
    trackIds: ['gymSquat', 'gymBench', 'gymPulldown', 'gymHinge', 'gymLateral', 'gymPushdown', 'gymKneeRaise'],
  },
  GB: {
    id: 'GB',
    location: 'gym',
    name: 'Gym B',
    focus: 'Leg press · Incline press · Cable row · Leg curl · Press · Arms & abs',
    trackIds: ['gymLegPress', 'gymInclinePress', 'gymCableRow', 'gymLegCurl', 'gymShoulderPress', 'gymCurl', 'gymCableCrunch'],
  },
}

export function workoutsAt(location) {
  return Object.values(WORKOUTS).filter((w) => w.location === location)
}

export function warmUpFor(workoutId) {
  return WORKOUTS[workoutId]?.location === 'gym' ? GYM_WARM_UP : WARM_UP
}

// Home and gym each alternate their own A and B, so a gym session in between
// does not knock your home rotation out of order (or the other way round).
export function nextWorkoutId(workoutHistory, location = 'home') {
  const [first, second] = workoutsAt(location).map((w) => w.id)
  const last = workoutHistory
    .filter((w) => WORKOUTS[w.workoutId]?.location === location)
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
    .at(-1)
  if (!last) return first
  return last.workoutId === first ? second : first
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
