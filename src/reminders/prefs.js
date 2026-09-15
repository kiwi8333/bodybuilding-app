import { WARM_UP_MINUTES, WORKOUTS, estimateLiftMinutes, nextWorkoutId } from '../data/program.js'
import { currentCardioStage, totalSeconds } from '../data/cardio.js'
import { dateKey } from '../logic/state.js'

// The minimum the scheduled sender needs to know. Nothing else (workouts,
// weights, food, body data) ever leaves the phone, and even this is sealed.
export function buildPrefs(state, { timezone, since }) {
  const latest = [...state.workouts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).at(-1)
  const next = nextWorkoutId(state.workouts)
  return {
    timezone,
    days: state.reminders.days,
    time: state.reminders.time,
    nudgeMissed: state.reminders.nudgeMissed,
    nudgeBackup: state.reminders.nudgeBackup,
    since,
    lastWorkoutDate: latest ? dateKey(new Date(latest.finishedAt)) : null,
    lastBackupDate: state.lastBackupAt ? dateKey(new Date(state.lastBackupAt)) : null,
    nextWorkoutName: WORKOUTS[next].name,
    nextWorkoutMinutes: WARM_UP_MINUTES + estimateLiftMinutes(next, state.tracks) + Math.round(totalSeconds(currentCardioStage(state.cardio)) / 60),
    deloadActive: state.deload.active,
  }
}
