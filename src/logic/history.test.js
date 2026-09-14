import { describe, expect, it } from 'vitest'
import { bestSet, exerciseSeries, lastPerformance, levelsWithData, personalBests, startOfWeek, weeklyStreak, workoutMinutes, workoutsThisWeek } from './history.js'

const at = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

const squat = (levelIndex, sets) => ({ trackId: 'squat', levelIndex, type: 'weighted', sets })
const pushup = (sets) => ({ trackId: 'pushup', levelIndex: 0, type: 'reps', sets })

const workouts = [
  { id: '2', workoutId: 'B', startedAt: at(2026, 9, 9, 9), finishedAt: at(2026, 9, 9, 10), exercises: [squat(0, [])] },
  { id: '1', workoutId: 'A', startedAt: at(2026, 9, 7, 9), finishedAt: at(2026, 9, 7, 10), exercises: [squat(0, [{ weight: 7.5, value: 12 }, { weight: 10, value: 8 }]), pushup([{ value: 10, weight: null }])] },
  { id: '3', workoutId: 'A', startedAt: at(2026, 9, 11, 9), finishedAt: at(2026, 9, 11, 9, 50), exercises: [squat(0, [{ weight: 10, value: 10 }, { weight: 10, value: 11 }]), pushup([{ value: 14, weight: null }])] },
]

describe('history', () => {
  it('weeks start on Monday', () => {
    // 13 Sep 2026 is a Sunday.
    expect(startOfWeek(new Date(2026, 8, 13, 22)).getDate()).toBe(7)
    expect(startOfWeek(new Date(2026, 8, 14, 1)).getDate()).toBe(14)
  })

  it('counts workouts this week', () => {
    expect(workoutsThisWeek(workouts, new Date(2026, 8, 13))).toBe(3)
    expect(workoutsThisWeek(workouts, new Date(2026, 8, 14))).toBe(0)
  })

  it('computes the weekly streak', () => {
    expect(weeklyStreak(workouts, new Date(2026, 8, 13))).toBe(1)
    expect(weeklyStreak(workouts, new Date(2026, 8, 16))).toBe(1)
    expect(weeklyStreak(workouts, new Date(2026, 8, 30))).toBe(0)
  })

  it('finds the last performance with sets, regardless of array order', () => {
    const last = lastPerformance(workouts, 'squat')
    expect(last.sets[0].value).toBe(10)
    expect(lastPerformance(workouts, 'plank')).toBeNull()
  })

  it('picks the best set', () => {
    expect(bestSet(squat(0, [{ weight: 7.5, value: 12 }, { weight: 10, value: 8 }, { weight: 10, value: 9 }]))).toEqual({ weight: 10, value: 9 })
    expect(bestSet(pushup([{ value: 10 }, { value: 12 }]))).toEqual({ value: 12 })
  })

  it('builds chronological series per level', () => {
    const s = exerciseSeries(workouts, 'squat', 0)
    expect(s.map((p) => [p.date, p.y])).toEqual([
      ['2026-09-07', 10],
      ['2026-09-11', 10],
    ])
    expect(exerciseSeries(workouts, 'squat', 1)).toEqual([])
    expect(levelsWithData(workouts, 'squat')).toEqual([0])
  })

  it('computes personal bests', () => {
    const pbs = personalBests(workouts)
    expect(pbs.find((p) => p.trackId === 'squat')).toMatchObject({ best: { weight: 10, value: 11 }, date: '2026-09-11' })
    expect(pbs.find((p) => p.trackId === 'pushup')).toMatchObject({ best: { value: 14 } })
  })

  it('workout duration in minutes', () => {
    expect(workoutMinutes(workouts[2])).toBe(50)
  })
})
