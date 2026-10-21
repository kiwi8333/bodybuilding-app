// The health report: pulls the data from every part of the app together into
// health markers, each with its value, how it changed over the period, a
// status and what it means for your body. Thresholds follow public guidance:
// WHO (BMI, activity), NICE (waist-to-height ratio), the American Heart
// Association (blood pressure). Pure functions, unit-tested.

import { bestSet } from './history.js'
import { dailyTargets, dayTotals } from './nutrition.js'
import { fastHours, reachedGoal } from './fasting.js'
import { BUILDER_STAGES } from '../data/cardio.js'
import { TRACKS } from '../data/tracks.js'

const DAY = 24 * 60 * 60 * 1000

export const PERIODS = [
  { id: '4w', label: '4 weeks', weeks: 4 },
  { id: '12w', label: '12 weeks', weeks: 12 },
  { id: 'all', label: 'All time', weeks: null },
]

const r1 = (x) => Math.round(x * 10) / 10
const signed = (x, unit = '', digits = 1) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(Number(x.toFixed(digits)))}${unit}`
const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// The period's start, and how many weeks of it you have actually been using
// the app (so a new user is not averaged over weeks before they started).
function windowOf(state, period, now) {
  const dates = [
    ...state.workouts.map((w) => w.finishedAt),
    ...state.cardioLogs.map((c) => c.date),
    ...state.bodyweight.map((b) => `${b.date}T12:00:00`),
    ...Object.keys(state.nutrition.log).map((d) => `${d}T12:00:00`),
  ].map((d) => new Date(d).getTime())
  const first = dates.length ? Math.min(...dates) : now.getTime()
  const sinceFirst = Math.max(1, (now.getTime() - first) / (7 * DAY))
  if (period.weeks) return { start: new Date(now.getTime() - period.weeks * 7 * DAY), weeks: Math.min(period.weeks, sinceFirst) }
  return { start: new Date(first), weeks: sinceFirst }
}

const inWindow = (iso, start, now) => {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= now.getTime()
}

// Readings inside the window, plus the last one before it as the baseline.
function series(list, dateOf, start, now) {
  const sorted = [...list].sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
  const before = sorted.filter((x) => new Date(dateOf(x)).getTime() < start.getTime()).at(-1)
  const within = sorted.filter((x) => inWindow(dateOf(x), start, now))
  return { first: before ?? within[0] ?? null, last: within.at(-1) ?? before ?? null, count: within.length }
}

const marker = (m) => ({ change: null, detail: '', meaning: '', ...m })
const none = (id, title, detail) => marker({ id, title, value: '–', status: 'none', detail })

// ---------- Body ----------

function weightMarker(state, start, now) {
  const s = series(state.bodyweight, (b) => `${b.date}T12:00:00`, start, now)
  if (!s.last) return none('weight', 'Weight', 'Weigh in a couple of times a week to see your trend.')
  const goal = state.nutrition.goal
  if (!s.first || s.first === s.last) return marker({ id: 'weight', title: 'Weight', value: `${s.last.kg} kg`, status: 'none', detail: 'One more weigh-in and your trend appears.' })
  const change = s.last.kg - s.first.kg
  const days = Math.max(1, (new Date(`${s.last.date}T12:00:00`) - new Date(`${s.first.date}T12:00:00`)) / DAY)
  const pctWeek = (change / s.first.kg) * 100 * (7 / days)
  let status = 'ok'
  let detail = `${signed(pctWeek, '%', 2)} of bodyweight a week.`
  if (goal === 'lose') {
    if (pctWeek <= -0.25 && pctWeek >= -1) status = 'good'
    else if (pctWeek < -1) {
      status = 'attention'
      detail += ' Faster than 1% a week risks losing muscle; eat a little more.'
    } else if (pctWeek > 0.1) {
      status = 'attention'
      detail += ' Rising while your goal is to lose; check your calories.'
    } else detail += ' Slower than planned; that is fine if your waist is shrinking.'
  } else if (goal === 'gain') {
    status = pctWeek >= 0 && pctWeek <= 0.5 ? 'good' : pctWeek > 0.5 ? 'attention' : 'ok'
    if (pctWeek > 0.5) detail += ' Faster than needed for lean gains; more of it may be fat.'
  } else status = Math.abs(pctWeek) <= 0.25 ? 'good' : 'ok'
  return marker({
    id: 'weight',
    title: 'Weight',
    value: `${s.last.kg} kg`,
    change: signed(change, ' kg'),
    status,
    detail,
    meaning:
      goal === 'lose'
        ? 'Losing fat steadily while you train keeps your muscle, eases the load on your joints and improves blood sugar and blood pressure.'
        : 'A steady weight trend is the best sign your calories match your goal.',
  })
}

export function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', status: 'attention' }
  if (bmi < 25) return { label: 'Healthy range', status: 'good' }
  if (bmi < 30) return { label: 'Overweight range', status: 'ok' }
  return { label: 'Obesity range', status: 'attention' }
}

function bmiMarker(state, start, now) {
  const h = state.profile.heightCm
  const s = series(state.bodyweight, (b) => `${b.date}T12:00:00`, start, now)
  if (!h || !s.last) return none('bmi', 'BMI', 'Add your height (Food tab) and a weigh-in.')
  const bmi = s.last.kg / (h / 100) ** 2
  const cat = bmiCategory(bmi)
  const firstBmi = s.first ? s.first.kg / (h / 100) ** 2 : bmi
  return marker({
    id: 'bmi',
    title: 'BMI',
    value: r1(bmi).toFixed(1),
    change: s.first && s.first !== s.last ? signed(bmi - firstBmi) : null,
    status: cat.status,
    detail: `${cat.label} (18.5–24.9 is healthy). BMI cannot tell muscle from fat, so muscular people can read high; your waist is the better guide.`,
    meaning: 'A BMI in the healthy range is linked to lower risk of type 2 diabetes, heart disease and some cancers.',
  })
}

export function waistToHeightCategory(ratio) {
  if (ratio < 0.5) return { label: 'Healthy', status: 'good' }
  if (ratio < 0.6) return { label: 'Increased health risk', status: 'ok' }
  return { label: 'High health risk', status: 'attention' }
}

function waistMarker(state, start, now) {
  const withWaist = state.measurements.filter((m) => m.waistCm != null)
  const s = series(withWaist, (m) => `${m.date}T12:00:00`, start, now)
  const h = state.profile.heightCm
  if (!s.last) return none('waist', 'Waist', 'Measure your waist at the navel in Progress every 2–4 weeks.')
  const ratio = h ? s.last.waistCm / h : null
  const cat = ratio ? waistToHeightCategory(ratio) : null
  const change = s.first && s.first !== s.last ? s.last.waistCm - s.first.waistCm : null
  return marker({
    id: 'waist',
    title: 'Waist',
    value: `${s.last.waistCm} cm`,
    change: change !== null ? signed(change, ' cm') : null,
    status: cat ? cat.status : change !== null && change < 0 ? 'good' : 'ok',
    detail: ratio ? `Waist-to-height ratio ${ratio.toFixed(2)}: ${cat.label.toLowerCase()} (aim for under 0.5).` : 'Add your height to get your waist-to-height ratio.',
    meaning: 'Your waist tracks the fat around your organs (visceral fat). A smaller waist is one of the clearest signs of lower risk of type 2 diabetes and heart disease.',
  })
}

// ---------- Heart and fitness ----------

function restingHrMarker(state, start, now) {
  const checks = state.healthChecks.filter((c) => c.restingHr !== null)
  const s = series(checks, (c) => `${c.date}T12:00:00`, start, now)
  const latest = s.last?.restingHr ?? state.heart.restingHr ?? null
  if (latest === null) return none('rhr', 'Resting heart rate', 'Take your pulse for a minute after waking, before getting up, and log it below.')
  const change = s.first && s.first !== s.last ? s.last.restingHr - s.first.restingHr : null
  const status = latest < 70 ? 'good' : latest < 85 ? 'ok' : 'attention'
  return marker({
    id: 'rhr',
    title: 'Resting heart rate',
    value: `${latest} bpm`,
    change: change !== null ? signed(change, ' bpm', 0) : null,
    status,
    detail: `${latest < 60 ? 'Athletic' : latest < 70 ? 'Good' : latest < 85 ? 'Average' : 'High'} (60–100 is normal; lower usually means fitter).${change !== null && change < 0 ? ' Falling, a sign your heart is getting stronger.' : ''}`,
    meaning: 'As your fitness improves, your heart pumps more blood with each beat, so it needs fewer beats at rest. A lower resting rate is linked to a longer, healthier life.',
  })
}

export function bloodPressureCategory(sys, dia) {
  if (sys >= 180 || dia >= 120) return { label: 'Very high: get medical help now if you feel unwell, and see a doctor promptly', status: 'attention' }
  if (sys >= 140 || dia >= 90) return { label: 'High (stage 2): see your doctor', status: 'attention' }
  if (sys >= 130 || dia >= 80) return { label: 'High (stage 1): worth discussing with your doctor', status: 'attention' }
  if (sys >= 120) return { label: 'Elevated', status: 'ok' }
  return { label: 'Normal', status: 'good' }
}

function bloodPressureMarker(state, start, now) {
  const checks = state.healthChecks.filter((c) => c.systolic !== null)
  const s = series(checks, (c) => `${c.date}T12:00:00`, start, now)
  if (!s.last) return none('bp', 'Blood pressure', 'Optional: log a reading from a home monitor or pharmacy, seated and rested for 5 minutes.')
  const cat = bloodPressureCategory(s.last.systolic, s.last.diastolic)
  const change = s.first && s.first !== s.last ? s.last.systolic - s.first.systolic : null
  return marker({
    id: 'bp',
    title: 'Blood pressure',
    value: `${s.last.systolic}/${s.last.diastolic}`,
    change: change !== null ? `${signed(change, '', 0)} top number` : null,
    status: cat.status,
    detail: `${cat.label}. Normal is under 120/80. One reading can be off; look at the trend.`,
    meaning: 'Regular exercise, losing excess weight and eating less salt all lower blood pressure, cutting the strain on your heart, arteries and kidneys.',
  })
}

function activeMinutesMarker(state, start, now, weeks) {
  const cardio = state.cardioLogs.filter((c) => inWindow(c.date, start, now)).reduce((n, c) => n + c.elapsedSeconds / 60, 0)
  const perWeek = Math.round(cardio / weeks)
  const status = perWeek >= 150 ? 'good' : perWeek >= 75 ? 'ok' : 'attention'
  return marker({
    id: 'active',
    title: 'Cardio minutes',
    value: `${perWeek} min/week`,
    status: cardio === 0 && !state.cardioLogs.length ? 'none' : status,
    detail: `Moderate cardio such as your treadmill sessions. WHO guidance is 150–300 minutes a week (or 75–150 of vigorous running).`,
    meaning: 'According to the WHO, inactive people have a 20–30% higher risk of early death than active people. Regular cardio also lowers blood pressure and improves sleep and mood.',
  })
}

function cardioFitnessMarker(state, start, now) {
  const logs = [...state.cardioLogs].filter((c) => c.kind !== 'rest-walk').sort((a, b) => a.date.localeCompare(b.date))
  if (!logs.length) return none('fitness', 'Cardio fitness', 'Finish a treadmill session to start tracking your fitness.')
  const stageIndex = (id) => BUILDER_STAGES.findIndex((s) => s.id === id)
  const before = logs.filter((c) => new Date(c.date) < start).at(-1) ?? logs.find((c) => inWindow(c.date, start, now))
  const fitness = state.cardio.phase === 'fitness'
  const nowStage = fitness ? BUILDER_STAGES.length : state.cardio.stageIndex
  const thenStage = before ? (before.kind === 'fitness' ? BUILDER_STAGES.length : Math.max(0, stageIndex(before.stageId))) : nowStage
  const gained = nowStage - thenStage
  // Same stage, lower heart rate: the clearest sign of a fitter heart.
  const withHr = logs.filter((c) => c.avgHr && inWindow(c.date, start, now))
  let hrNote = ''
  const byStage = new Map()
  for (const c of withHr) byStage.set(c.stageId, [...(byStage.get(c.stageId) ?? []), c])
  for (const [, list] of byStage) {
    if (list.length >= 2 && list[0].avgHr - list.at(-1).avgHr >= 3) {
      hrNote = ` Average heart rate on the same session fell ${list[0].avgHr - list.at(-1).avgHr} bpm.`
      break
    }
  }
  return marker({
    id: 'fitness',
    title: 'Cardio fitness',
    value: fitness ? 'Runs 20 min non-stop' : `Run Builder ${nowStage + 1}/${BUILDER_STAGES.length}`,
    change: gained > 0 ? `${signed(gained, '', 0)} stage${gained === 1 ? '' : 's'}` : null,
    status: gained > 0 || fitness || hrNote ? 'good' : 'ok',
    detail: `${gained > 0 ? `Up ${gained} stage${gained === 1 ? '' : 's'} this period.` : 'Holding your stage; finish it twice at effort 7 or less to move up.'}${hrNote}`,
    meaning: 'Cardiorespiratory fitness is one of the strongest predictors of long-term health: each step up is linked to lower risk of heart disease and early death.',
  })
}

// ---------- Strength ----------

// Strength of one session's best set, comparable within a level.
function setScore(type, set) {
  if (type === 'weighted') return set.weight > 0 ? set.weight * (1 + set.value / 30) : set.value
  return set.value
}

export function strengthChange(workouts, start, now) {
  const firstLast = new Map()
  const sorted = [...workouts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  for (const w of sorted) {
    if (!inWindow(w.finishedAt, start, now) || w.deload) continue
    for (const ex of w.exercises) {
      if (!ex.sets.length || ex.swapId || !TRACKS[ex.trackId]) continue
      const key = `${ex.trackId}:${ex.levelIndex}`
      const score = setScore(ex.type, bestSet(ex))
      const cur = firstLast.get(key)
      firstLast.set(key, cur ? { ...cur, last: score, n: cur.n + 1 } : { first: score, last: score, n: 1 })
    }
  }
  const changes = [...firstLast.values()].filter((v) => v.n >= 2 && v.first > 0).map((v) => (v.last - v.first) / v.first)
  if (!changes.length) return null
  return { pct: (changes.reduce((a, b) => a + b, 0) / changes.length) * 100, exercises: changes.length }
}

function strengthMarker(state, start, now) {
  const c = strengthChange(state.workouts, start, now)
  const levelUps = state.workouts.filter((w) => inWindow(w.finishedAt, start, now)).flatMap((w) => w.exercises).filter((e) => e.outcome === 'next-level').length
  if (!c) return none('strength', 'Strength', 'Train each exercise at least twice to see how much stronger you are getting.')
  return marker({
    id: 'strength',
    title: 'Strength',
    value: `${signed(c.pct, '%', 0)}`,
    change: levelUps ? `${levelUps} harder version${levelUps === 1 ? '' : 's'} unlocked` : null,
    status: c.pct > 1 || levelUps ? 'good' : c.pct >= -2 ? 'ok' : 'attention',
    detail: `Average change in estimated strength across ${c.exercises} exercise${c.exercises === 1 ? '' : 's'} (same version, best set).`,
    meaning: 'More muscle and strength raise the calories you burn at rest, improve blood sugar control, protect your bones and joints, and keep you independent as you age.',
  })
}

function sessionsMarker(state, start, now, weeks) {
  const n = state.workouts.filter((w) => inWindow(w.finishedAt, start, now)).length
  const perWeek = n / weeks
  return marker({
    id: 'sessions',
    title: 'Strength sessions',
    value: `${r1(perWeek)} a week`,
    status: n === 0 && !state.workouts.length ? 'none' : perWeek >= 2 ? 'good' : perWeek >= 1 ? 'ok' : 'attention',
    detail: `${n} workout${n === 1 ? '' : 's'} this period. WHO guidance is muscle-strengthening work on 2 or more days a week; your plan has 3.`,
    meaning: 'Strength training at least twice a week is linked to lower risk of heart disease, diabetes and early death, independent of cardio.',
  })
}

// ---------- Habits ----------

function nutritionMarker(state, start, now) {
  const targets = dailyTargets(state.profile, state.nutrition, state.bodyweight, now)
  // Today is still in progress, so only finished days are judged.
  const today = dayKey(now)
  const days = Object.entries(state.nutrition.log).filter(([d, entries]) => entries.length && d < today && inWindow(`${d}T12:00:00`, start, now))
  if (!days.length) {
    const loggingToday = state.nutrition.log[today]?.length
    return none('nutrition', 'Calories & protein', loggingToday ? 'Your first full day of logging is scored tomorrow.' : 'Log your food on the Food tab to see how well you hit your targets.')
  }
  if (!targets.ready) return marker({ id: 'nutrition', title: 'Calories & protein', value: `${days.length} days logged`, status: 'ok', detail: 'Set your targets on the Food tab to compare.' })
  let onKcal = 0
  let onProtein = 0
  for (const [, entries] of days) {
    const t = dayTotals(entries)
    if (Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1) onKcal++
    if (t.protein >= targets.protein * 0.9) onProtein++
  }
  const share = (onKcal + onProtein) / (2 * days.length)
  return marker({
    id: 'nutrition',
    title: 'Calories & protein',
    value: `${Math.round((onKcal / days.length) * 100)}% / ${Math.round((onProtein / days.length) * 100)}%`,
    status: share >= 0.7 ? 'good' : share >= 0.4 ? 'ok' : 'attention',
    detail: `On ${days.length} logged days: calories within 10% of target on ${onKcal}, protein at target on ${onProtein}.`,
    meaning: 'Hitting your calories steers your weight; enough protein (1.6–2.2 g per kg) is what lets your training build muscle, even while losing fat.',
  })
}

function fastingMarker(state, start, now, weeks) {
  const logs = state.fasting.logs.filter((l) => inWindow(l.endedAt, start, now))
  if (!logs.length) return none('fasting', 'Fasting', 'Optional. Fasts you finish on the Fast tab show up here.')
  const done = logs.filter(reachedGoal).length
  const avg = logs.reduce((n, l) => n + fastHours(l), 0) / logs.length
  return marker({
    id: 'fasting',
    title: 'Fasting',
    value: `${r1(logs.length / weeks)} a week`,
    status: done / logs.length >= 0.7 ? 'good' : 'ok',
    detail: `${done} of ${logs.length} fasts reached their goal; average ${r1(avg)} h.`,
    meaning: 'A shorter eating window can make a calorie deficit easier to keep. Its benefits for weight come mainly from eating less overall.',
  })
}

// ---------- Report ----------

export function buildReport(state, { periodId = '4w', now = new Date() } = {}) {
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[0]
  const { start, weeks } = windowOf(state, period, now)
  const sections = [
    { id: 'body', title: 'Body', markers: [weightMarker(state, start, now), waistMarker(state, start, now), bmiMarker(state, start, now)] },
    {
      id: 'heart',
      title: 'Heart & fitness',
      markers: [restingHrMarker(state, start, now), bloodPressureMarker(state, start, now), cardioFitnessMarker(state, start, now), activeMinutesMarker(state, start, now, weeks)],
    },
    { id: 'strength', title: 'Strength', markers: [strengthMarker(state, start, now), sessionsMarker(state, start, now, weeks)] },
    { id: 'habits', title: 'Habits', markers: [nutritionMarker(state, start, now), fastingMarker(state, start, now, weeks)] },
  ]
  const all = sections.flatMap((s) => s.markers)
  const counts = { good: 0, ok: 0, attention: 0, none: 0 }
  for (const m of all) counts[m.status]++
  return {
    period,
    start: dayKey(start),
    weeks,
    sections,
    counts,
    wins: all.filter((m) => m.status === 'good'),
    focus: all.filter((m) => m.status === 'attention'),
    tracked: all.length - counts.none,
  }
}
