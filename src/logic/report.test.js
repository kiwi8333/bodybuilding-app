import { describe, expect, it } from 'vitest'
import { bloodPressureCategory, bmiCategory, buildReport, strengthChange, waistToHeightCategory } from './report.js'
import { addHealthCheck, completeOnboarding, createInitialState, deleteHealthCheck, normalizeState } from './state.js'

const now = new Date('2026-10-21T12:00:00')
const base = () => {
  const s = completeOnboarding(createInitialState(), { name: 'G', equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 }, walkSpeed: 3, jogSpeed: 4.5 })
  return { ...s, profile: { ...s.profile, sex: 'male', birthYear: 1996, heightCm: 180 } }
}
const find = (report, id) => report.sections.flatMap((s) => s.markers).find((m) => m.id === id)

describe('health marker thresholds', () => {
  it('BMI, waist-to-height and blood pressure categories', () => {
    expect(bmiCategory(17).status).toBe('attention')
    expect(bmiCategory(22).status).toBe('good')
    expect(bmiCategory(27).status).toBe('ok')
    expect(bmiCategory(31).status).toBe('attention')
    expect(waistToHeightCategory(0.45).status).toBe('good')
    expect(waistToHeightCategory(0.55).status).toBe('ok')
    expect(waistToHeightCategory(0.62).status).toBe('attention')
    expect(bloodPressureCategory(115, 75).label).toBe('Normal')
    expect(bloodPressureCategory(125, 78).label).toBe('Elevated')
    expect(bloodPressureCategory(132, 70).label).toMatch(/stage 1/)
    expect(bloodPressureCategory(118, 92).label).toMatch(/stage 2/)
    expect(bloodPressureCategory(185, 100).label).toMatch(/Very high/)
  })
})

describe('health report', () => {
  it('shows every marker as no data for a brand-new user', () => {
    const r = buildReport(base(), { now })
    expect(r.tracked).toBe(0)
    expect(r.sections.map((s) => s.id)).toEqual(['body', 'heart', 'strength', 'habits'])
  })

  it('judges weight loss against the goal and a healthy pace', () => {
    let s = base()
    s = { ...s, nutrition: { ...s.nutrition, goal: 'lose' } }
    s.bodyweight = [
      { date: '2026-09-23', kg: 90 },
      { date: '2026-10-21', kg: 88 },
    ]
    const w = find(buildReport(s, { now }), 'weight')
    expect(w).toMatchObject({ value: '88 kg', change: '−2 kg', status: 'good' })
    s.bodyweight = [
      { date: '2026-09-23', kg: 90 },
      { date: '2026-10-21', kg: 84 },
    ]
    expect(find(buildReport(s, { now }), 'weight').status).toBe('attention') // over 1% a week
  })

  it('works out BMI and waist-to-height from height, weight and waist', () => {
    const s = { ...base(), bodyweight: [{ date: '2026-10-20', kg: 81 }], measurements: [{ date: '2026-09-25', waistCm: 94 }, { date: '2026-10-20', waistCm: 88 }] }
    const r = buildReport(s, { now })
    expect(find(r, 'bmi')).toMatchObject({ value: '25.0', status: 'ok' })
    expect(find(r, 'waist')).toMatchObject({ value: '88 cm', change: '−6 cm', status: 'good' })
  })

  it('uses health checks for resting heart rate and blood pressure', () => {
    let s = base()
    s = addHealthCheck(s, '2026-09-25', { restingHr: 74, systolic: 132, diastolic: 84 })
    s = addHealthCheck(s, '2026-10-20', { restingHr: 66, systolic: 118, diastolic: 76 })
    const r = buildReport(s, { now })
    expect(find(r, 'rhr')).toMatchObject({ value: '66 bpm', change: '−8 bpm', status: 'good' })
    expect(find(r, 'bp')).toMatchObject({ value: '118/76', status: 'good' })
    expect(s.heart.restingHr).toBe(66) // keeps heart-rate zones current
  })

  it('measures strength change on the same exercise version', () => {
    const ex = (weight, value, levelIndex = 0) => ({ trackId: 'squat', levelIndex, type: 'weighted', sets: [{ weight, value }] })
    const w = (day, e) => ({ id: day, workoutId: 'A', startedAt: `2026-10-${day}T09:00:00`, finishedAt: `2026-10-${day}T10:00:00`, exercises: [e] })
    const workouts = [w('01', ex(10, 10)), w('08', ex(12.5, 10)), w('15', ex(10, 8, 1))]
    const c = strengthChange(workouts, new Date('2026-09-23'), now)
    expect(c.exercises).toBe(1)
    expect(Math.round(c.pct)).toBe(25)
  })

  it('counts sessions and cardio minutes per week against the guidelines', () => {
    const s = base()
    s.workouts = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, workoutId: 'A', startedAt: new Date(now - (i * 2 + 1) * 86400e3).toISOString(), finishedAt: new Date(now - (i * 2 + 1) * 86400e3).toISOString(), exercises: [] }))
    s.cardioLogs = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, date: new Date(now - (i * 2 + 1) * 86400e3).toISOString(), kind: 'builder', stageId: 'b1', title: '', completed: true, effort: 6, walkSpeed: 3, jogSpeed: 4.5, elapsedSeconds: 1200, distanceMiles: null, avgHr: null, maxHr: null }))
    const r = buildReport(s, { now })
    // 12 sessions over the 23 days since the first one (3.3 weeks), not 4 weeks.
    expect(find(r, 'sessions')).toMatchObject({ value: '3.7 a week', status: 'good' })
    expect(find(r, 'active')).toMatchObject({ value: '73 min/week', status: 'attention' })
  })
})

describe('health checks', () => {
  it('validates readings, replaces a same-day entry and survives a reload', () => {
    let s = addHealthCheck(base(), '2026-10-20', { restingHr: '64', systolic: '', diastolic: '' })
    s = addHealthCheck(s, '2026-10-20', { restingHr: 62, systolic: 120, diastolic: 80 })
    expect(s.healthChecks).toEqual([{ date: '2026-10-20', restingHr: 62, systolic: 120, diastolic: 80 }])
    expect(() => addHealthCheck(s, '2026-10-21', {})).toThrow(/Enter a resting/)
    expect(() => addHealthCheck(s, '2026-10-21', { systolic: 120 })).toThrow(/both/)
    expect(() => addHealthCheck(s, '2026-10-21', { systolic: 80, diastolic: 90 })).toThrow(/higher/)
    expect(() => addHealthCheck(s, '2026-10-21', { restingHr: 10 })).toThrow(/between/)
    expect(normalizeState(JSON.parse(JSON.stringify(s))).healthChecks).toEqual(s.healthChecks)
    expect(deleteHealthCheck(s, '2026-10-20').healthChecks).toEqual([])
  })
})

describe('fair scoring for new users', () => {
  it('averages per-week figures only over the weeks since you started', () => {
    const s = base()
    s.workouts = [1, 2, 3].map((i) => ({ id: `w${i}`, workoutId: 'A', startedAt: new Date(now - i * 3600e3).toISOString(), finishedAt: new Date(now - i * 3600e3).toISOString(), exercises: [] }))
    expect(find(buildReport(s, { now }), 'sessions')).toMatchObject({ value: '3 a week', status: 'good' })
  })

  it('does not score today’s unfinished food log', () => {
    const s = base()
    s.bodyweight = [{ date: '2026-10-21', kg: 80 }]
    s.nutrition = { ...s.nutrition, log: { '2026-10-21': [{ id: 'a', name: 'Oats', kcal: 150, protein: 5, carbs: null, fat: null, meal: null }] } }
    expect(find(buildReport(s, { now }), 'nutrition')).toMatchObject({ status: 'none', detail: expect.stringMatching(/tomorrow/) })
    s.nutrition.log['2026-10-20'] = [{ id: 'b', name: 'Day', kcal: 2400, protein: 150, carbs: null, fat: null, meal: null }]
    expect(find(buildReport(s, { now }), 'nutrition').status).not.toBe('none')
  })
})
