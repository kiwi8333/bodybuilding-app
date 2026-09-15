import { TRACKS } from '../data/tracks.js'
import { dateKey } from './state.js'

export const TARGET_SESSIONS_PER_WEEK = 3

// Monday 00:00 local time of the week containing `date`.
export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const offset = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - offset)
  return d
}

export function workoutsThisWeek(workouts, now = new Date()) {
  const start = startOfWeek(now).getTime()
  return workouts.filter((w) => new Date(w.finishedAt).getTime() >= start).length
}

// Consecutive weeks (ending with last week, plus this week if already hit)
// in which you completed the target number of workouts.
export function weeklyStreak(workouts, now = new Date()) {
  const counts = new Map()
  for (const w of workouts) {
    const key = startOfWeek(new Date(w.finishedAt)).getTime()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let streak = 0
  const cursor = startOfWeek(now)
  if ((counts.get(cursor.getTime()) ?? 0) >= TARGET_SESSIONS_PER_WEEK) streak++
  for (;;) {
    cursor.setDate(cursor.getDate() - 7)
    if ((counts.get(cursor.getTime()) ?? 0) >= TARGET_SESSIONS_PER_WEEK) streak++
    else break
  }
  return streak
}

function byFinished(workouts) {
  return [...workouts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
}

// Most recent logged performance of a track (with at least one set).
export function lastPerformance(workouts, trackId) {
  const sorted = byFinished(workouts)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const ex = sorted[i].exercises.find((e) => e.trackId === trackId && e.sets.length > 0 && !e.swapId)
    if (ex) return { ...ex, finishedAt: sorted[i].finishedAt }
  }
  return null
}

// Best set of an exercise record. Weighted: heaviest weight, then most reps.
export function bestSet(exercise) {
  let best = null
  for (const s of exercise.sets) {
    if (!best) best = s
    else if (exercise.type === 'weighted') {
      if (s.weight > best.weight || (s.weight === best.weight && s.value > best.value)) best = s
    } else if (s.value > best.value) best = s
  }
  return best
}

// One chart point per session for a track at a given level.
// Weighted: y = heaviest weight used; bodyweight: y = best reps/seconds.
export function exerciseSeries(workouts, trackId, levelIndex) {
  const points = []
  for (const w of byFinished(workouts)) {
    for (const ex of w.exercises) {
      if (ex.trackId !== trackId || ex.levelIndex !== levelIndex || ex.sets.length === 0 || ex.swapId) continue
      const best = bestSet(ex)
      points.push({
        date: dateKey(new Date(w.finishedAt)),
        y: ex.type === 'weighted' ? best.weight : best.value,
        best,
        sets: ex.sets,
      })
    }
  }
  return points
}

export function levelsWithData(workouts, trackId) {
  const set = new Set()
  for (const w of workouts) for (const ex of w.exercises) if (ex.trackId === trackId && ex.sets.length && !ex.swapId) set.add(ex.levelIndex)
  return [...set].sort((a, b) => a - b)
}

// Personal best per (track, level).
export function personalBests(workouts) {
  const out = []
  for (const track of Object.values(TRACKS)) {
    track.levels.forEach((level, levelIndex) => {
      const series = exerciseSeries(workouts, track.id, levelIndex)
      if (!series.length) return
      let best = null
      let date = null
      for (const p of series) {
        const b = p.best
        const better =
          !best ||
          (track.type === 'weighted' ? b.weight > best.weight || (b.weight === best.weight && b.value > best.value) : b.value > best.value)
        if (better) {
          best = b
          date = p.date
        }
      }
      out.push({ trackId: track.id, levelIndex, name: level.name, type: track.type, best, date })
    })
  }
  return out
}

export function workoutMinutes(record) {
  return Math.max(1, Math.round((new Date(record.finishedAt) - new Date(record.startedAt)) / 60000))
}

// Swapped exercises are excluded above: their numbers belong to a different
// movement and would distort charts, personal bests and "last time".

/**
 * Weighted exercises that have outgrown the dumbbells: at the heaviest weight,
 * or already moved to harder versions because of that ceiling.
 */
export function outgrownDumbbells(state) {
  const out = []
  for (const track of Object.values(TRACKS)) {
    if (track.type !== 'weighted') continue
    const s = state.tracks[track.id]
    const atMax = s.weight !== null && Math.round(s.weight * 100) >= Math.round(state.equipment.maxWeight * 100)
    if (atMax || s.levelIndex > 0) out.push({ trackId: track.id, name: track.levels[s.levelIndex].name, atMax, levelIndex: s.levelIndex })
  }
  return out
}

export const OUTGROWN_ALERT_THRESHOLD = 3
