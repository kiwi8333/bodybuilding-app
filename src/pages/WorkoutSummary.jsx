import { useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WORKOUTS } from '../data/program.js'
import { currentCardioStage, totalSeconds } from '../data/cardio.js'
import { newBests, workoutMinutes } from '../logic/history.js'
import { formatKg } from '../logic/weights.js'
import { haptic } from '../lib/alerts.js'
import Confetti from '../components/Confetti.jsx'
import CountUp from '../components/CountUp.jsx'
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
  const bests = record ? newBests(state.workouts, record) : []
  // Celebrate once, when the summary first opens straight after finishing.
  const fresh = useRef(record ? Date.now() - new Date(record.finishedAt).getTime() < 60000 : false)
  useEffect(() => {
    if (fresh.current && bests.length) haptic('complete')
  }, [bests.length])
  if (!record) return <Navigate to="/" replace />

  const stage = currentCardioStage(state.cardio)
  const sameDay = dateKey(new Date(record.finishedAt))
  const cardioDone = state.cardioLogs.some((c) => c.kind !== 'rest-walk' && dateKey(new Date(c.date)) === sameDay)
  const setCount = record.exercises.reduce((n, e) => n + e.sets.length, 0)
  const winners = record.exercises.filter((e) => e.outcome === 'increase-weight' || e.outcome === 'next-level')
  const wins = winners.length
  const bestText = (type, set) => (type === 'weighted' ? `${formatKg(set.weight)} × ${set.value}` : `${set.value}${type === 'hold' ? ' s' : ' reps'}`)

  return (
    <>
      {fresh.current && (bests.length > 0 || wins > 0) && <Confetti pieces={bests.length ? 44 : 24} />}
      <div className="page-head">
        <span className="eyebrow">Workout saved</span>
        <h1>{WORKOUTS[record.workoutId].name} done</h1>
      </div>

      <div className="stats three">
        <div className="stat">
          <span className="value">
            <CountUp value={workoutMinutes(record)} fromZero />
          </span>
          <span className="label">Minutes</span>
        </div>
        <div className="stat">
          <span className="value">
            <CountUp value={setCount} fromZero />
          </span>
          <span className="label">Sets logged</span>
        </div>
        <div className="stat">
          <span className="value">
            <CountUp value={wins} fromZero />
          </span>
          <span className="label">Progressions earned</span>
        </div>
      </div>

      {(bests.length > 0 || wins > 0) && (
        <section className="card celebrate">
          <span className="celebrate-badge" aria-hidden>
            {bests.length ? '🏆' : '💪'}
          </span>
          <h2>{bests.length ? (bests.length === 1 ? 'New personal best!' : `${bests.length} new personal bests!`) : 'Great session!'}</h2>
          {bests.length > 0 && (
            <ul className="clean pb-list">
              {bests.map((b) => (
                <li key={b.trackId}>
                  <span>{b.levelName}</span>
                  <span className="pb-change">
                    <span className="muted">{bestText(b.type, b.prev)}</span> → <strong>{bestText(b.type, b.best)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {wins > 0 && (
            <p className="small text-2">
              {wins === 1 ? 'Progression earned on ' : `${wins} progressions earned: `}
              {winners.map((e) => e.levelName).join(', ')}. Next session asks a little more.
            </p>
          )}
        </section>
      )}

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
