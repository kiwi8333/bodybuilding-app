import { Link, Navigate, useParams } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WORKOUTS } from '../data/program.js'
import { currentCardioStage, totalSeconds } from '../data/cardio.js'
import { workoutMinutes } from '../logic/history.js'
import { setsText } from '../lib/describe.js'
import { dateKey } from '../logic/state.js'

const OUTCOME_PILL = {
  'increase-weight': ['good', 'Weight up'],
  'next-level': ['good', 'Level up'],
  maxed: ['good', 'Maxed'],
  repeat: ['', 'Repeat'],
  reset: ['warn', 'Reset'],
  skipped: ['', 'Skipped'],
  deload: ['', 'Deload'],
  swapped: ['warn', 'Swap'],
}

export default function WorkoutSummary() {
  const { id } = useParams()
  const { state } = useStore()
  const record = state.workouts.find((w) => w.id === id)
  if (!record) return <Navigate to="/" replace />

  const stage = currentCardioStage(state.cardio)
  const sameDay = dateKey(new Date(record.finishedAt))
  const cardioDone = state.cardioLogs.some((c) => c.kind !== 'rest-walk' && dateKey(new Date(c.date)) === sameDay)
  const setCount = record.exercises.reduce((n, e) => n + e.sets.length, 0)
  const wins = record.exercises.filter((e) => e.outcome === 'increase-weight' || e.outcome === 'next-level').length

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Workout saved</span>
        <h1>{WORKOUTS[record.workoutId].name} done</h1>
      </div>

      <div className="stats three">
        <div className="stat">
          <span className="value">{workoutMinutes(record)}</span>
          <span className="label">Minutes</span>
        </div>
        <div className="stat">
          <span className="value">{setCount}</span>
          <span className="label">Sets logged</span>
        </div>
        <div className="stat">
          <span className="value">{wins}</span>
          <span className="label">Progressions earned</span>
        </div>
      </div>

      {!cardioDone && (
        <section className="card accent">
          <h2>Now: treadmill</h2>
          <p className="text-2">
            {stage.title} · {Math.round(totalSeconds(stage) / 60)} min
          </p>
          <Link className="btn primary big block" to="/cardio/plan">
            Start cardio
          </Link>
        </section>
      )}

      <section className="card">
        <h2>What happens next time</h2>
        <ul className="clean stack" style={{ gap: 14 }}>
          {record.exercises.map((ex) => {
            const [tone, label] = OUTCOME_PILL[ex.outcome] ?? ['', ex.outcome]
            return (
              <li key={ex.trackId} className="stack" style={{ gap: 4 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <h3>{ex.levelName}</h3>
                  <span className={`pill ${tone}`}>{label}</span>
                </div>
                {ex.sets.length > 0 && <p className="small text-2">{setsText(ex)}</p>}
                <p className="small">{ex.message}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <Link className="btn block" to="/">
        Back to Today
      </Link>
    </>
  )
}
