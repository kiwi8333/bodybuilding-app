import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WORKOUTS, nextWorkoutId } from '../data/program.js'
import { DELOAD_WORKOUTS, WORKOUTS_BETWEEN_DELOADS, deloadDue, workoutsSinceDeload } from '../logic/deload.js'
import { OUTGROWN_ALERT_THRESHOLD, outgrownDumbbells } from '../logic/history.js'
import { dailyTargets, dayTotals } from '../logic/nutrition.js'
import { beginDeload, dateKey, dismissDumbbellAlert, endDeloadEarly, postponeDeload } from '../logic/state.js'
import { addDays, daysBetween } from '../reminders/schedule.js'
import { MOBILITY_ROUTINE, mobilityTotalSeconds } from '../data/mobility.js'
import { formatMinutes } from '../lib/format.js'
import { useDialogs } from './Dialogs.jsx'
import ProgressRing from './ProgressRing.jsx'
import { useNow } from './useNow.js'
import { formatDuration, hoursBetween, planHours, stageAt } from '../logic/fasting.js'
import { buildReport } from '../logic/report.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Coaching nudges shown at the top of Today.
export function TodayAlerts() {
  const { confirm, notify } = useDialogs()
  const { state, apply } = useStore()
  const now = new Date()
  const today = dateKey(now)
  const total = state.workouts.length
  const cards = []

  const act = (fn) => {
    try {
      apply(fn)
    } catch (err) {
      notify({ title: 'That didn’t work', message: err.message })
    }
  }

  if (state.deload.active) {
    cards.push(
      <section className="card accent" key="deload-on">
        <span className="pill accent" style={{ alignSelf: 'flex-start' }}>
          Deload week
        </span>
        <p className="small">
          Session {state.deload.workoutsDone + 1} of {DELOAD_WORKOUTS}: one set fewer and about 10% lighter. Progression is paused so your body can recover and come
          back stronger.
        </p>
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={async () => (await confirm({ title: 'End the deload now?', message: 'You go back to normal training and progression from your next workout.', confirmLabel: 'End deload' })) && act(endDeloadEarly)}>
          End deload early
        </button>
      </section>,
    )
  } else if (deloadDue(state.deload, total) && !state.activeWorkout) {
    cards.push(
      <section className="card accent" key="deload-offer">
        <h2>Time for a deload week</h2>
        <p className="small text-2">
          You have trained {workoutsSinceDeload(state.deload, total)} sessions since your last break (the plan suggests one every {WORKOUTS_BETWEEN_DELOADS}). A lighter week
          lets joints and muscles fully recover, and strength usually jumps afterwards.
        </p>
        <div className="grid-2">
          <button className="btn primary" onClick={() => act(beginDeload)}>
            Start deload
          </button>
          <button className="btn" onClick={() => act(postponeDeload)}>
            Remind me later
          </button>
        </div>
      </section>,
    )
  }

  // Missed a planned training day?
  const latest = [...state.workouts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).at(-1)
  const lastDate = latest ? dateKey(new Date(latest.finishedAt)) : null
  const yesterday = addDays(today, -1)
  const yesterdayPlanned = state.reminders.days.includes((now.getDay() + 6) % 7)
  if (lastDate && yesterdayPlanned && lastDate < yesterday && !state.activeWorkout) {
    cards.push(
      <p className="banner warn small" key="missed">
        Missed {DAY_NAMES[(now.getDay() + 6) % 7]}’s session? No problem: do {WORKOUTS[nextWorkoutId(state.workouts, state.trainAt)].name} today and keep a rest day before the next one.
      </p>,
    )
  }

  // Backup reminder
  const lastBackup = state.lastBackupAt ? dateKey(new Date(state.lastBackupAt)) : null
  if (total >= 3 && (!lastBackup || daysBetween(lastBackup, today) >= 7)) {
    cards.push(
      <div className="banner warn small" key="backup">
        <span>{lastBackup ? `Last backup ${daysBetween(lastBackup, today)} days ago.` : 'You have not backed up yet.'} Your data only lives on this phone.</span>
        <Link className="link-btn" to="/settings">
          Back up
        </Link>
      </div>,
    )
  }

  // Heavier dumbbells?
  const outgrown = outgrownDumbbells(state)
  if (outgrown.length >= OUTGROWN_ALERT_THRESHOLD && outgrown.length > state.ui.dumbbellAlertDismissedCount) {
    cards.push(
      <section className="card" key="dumbbells">
        <h2>Time for heavier dumbbells?</h2>
        <p className="small text-2">
          {outgrown.length} exercises have reached your {state.equipment.maxWeight} kg dumbbells or moved to harder versions because of them. Harder versions work,
          but adjustable dumbbells going to about 24 kg would let squats, deadlifts, rows and presses keep progressing with real load.
        </p>
        <ul className="cues">
          {outgrown.map((o) => (
            <li key={o.trackId}>{o.name}</li>
          ))}
        </ul>
        <div className="row wrap">
          <Link className="btn small" to="/settings">
            I got new dumbbells
          </Link>
          <button className="btn small ghost" onClick={() => act((s) => dismissDumbbellAlert(s, outgrown.length))}>
            Not now
          </button>
        </div>
      </section>,
    )
  }

  return cards.length ? <>{cards}</> : null
}

export function FoodSummaryCard() {
  const { state } = useStore()
  const today = dateKey()
  const targets = dailyTargets(state.profile, state.nutrition, state.bodyweight)
  const totals = dayTotals(state.nutrition.log[today])
  return (
    <section className="card">
      <div className="row between">
        <h2>Food today</h2>
        <Link className="btn small" to="/food">
          Log food
        </Link>
      </div>
      {targets.ready ? (
        <div className="grid-2">
          <div className="coach-item">
            <span className="coach-label">Calories</span>
            <span className="coach-value">{totals.kcal.toLocaleString()}</span>
            <span className="coach-sub">of {targets.kcal.toLocaleString()} kcal</span>
          </div>
          <div className="coach-item">
            <span className="coach-label">Protein</span>
            <span className="coach-value">{totals.protein} g</span>
            <span className="coach-sub">of {targets.protein} g</span>
          </div>
        </div>
      ) : (
        <p className="small text-2">Set your calorie and protein targets on the Food tab. Muscle is built from what you eat as much as how you train.</p>
      )}
    </section>
  )
}

// Fasting at a glance: a running fast's progress, or the plan ready to start.
export function FastingCard() {
  const { state } = useStore()
  const f = state.fasting
  const now = useNow(Boolean(f.active), 30000)
  const elapsed = f.active ? hoursBetween(f.active.startedAt, now) : 0
  const goal = f.active ? f.active.targetHours : planHours(f)
  return (
    <section className="card">
      <div className="row between">
        <div className="row" style={{ gap: 12 }}>
          <ProgressRing value={f.active ? (goal ? elapsed : elapsed % 24) : 0} max={goal ?? 24} size={48} stroke={5} tone={f.active && goal && elapsed >= goal ? 'good' : 'accent'} />
          <div className="stack" style={{ gap: 2 }}>
            <h2>{f.active ? `Fasting · ${formatDuration(elapsed)}` : 'Fasting'}</h2>
            <span className="small text-2">
              {f.active
                ? goal
                  ? elapsed >= goal
                    ? `${goal}h goal reached · ${stageAt(elapsed).name}`
                    : `${formatDuration(goal - elapsed)} to your ${goal}h goal · ${stageAt(elapsed).name}`
                  : `Open fast · ${stageAt(elapsed).name}`
                : `${goal ? `${goal}h` : 'Open'} plan ready`}
            </span>
          </div>
        </div>
        <Link className="btn small" to="/fast">
          {f.active ? 'View' : 'Start'}
        </Link>
      </div>
    </section>
  )
}

// The health report at a glance.
export function HealthReportCard() {
  const { state } = useStore()
  const { counts, tracked } = buildReport(state)
  return (
    <Link to="/health" className="card health-link">
      <ProgressRing value={counts.good} max={Math.max(1, tracked)} size={48} stroke={5} tone={counts.attention ? 'accent' : 'good'} />
      <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <h2>Health report</h2>
        <span className="small text-2">
          {tracked === 0 ? 'See what your training does for your body' : `${counts.good} of ${tracked} markers looking good${counts.attention ? ` · ${counts.attention} to work on` : ''}`}
        </span>
      </span>
      <span className="health-chevron" aria-hidden>
        ›
      </span>
    </Link>
  )
}

export function MobilityCard() {
  const { state } = useStore()
  const today = dateKey()
  const doneToday = state.mobilityLogs.some((iso) => dateKey(new Date(iso)) === today)
  return (
    <section className="card">
      <div className="row between wrap">
        <div className="stack" style={{ gap: 2 }}>
          <h3>Rest-day mobility</h3>
          <p className="small muted">
            {formatMinutes(mobilityTotalSeconds())} · {MOBILITY_ROUTINE.length} gentle stretches for hips, shoulders and hamstrings
          </p>
        </div>
        {doneToday ? (
          <span className="pill good">Done today</span>
        ) : (
          <Link className="btn small" to="/mobility">
            Start
          </Link>
        )}
      </div>
    </section>
  )
}
