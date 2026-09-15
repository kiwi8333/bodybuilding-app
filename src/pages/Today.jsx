import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WARM_UP_MINUTES, WORKOUTS, estimateLiftMinutes, nextWorkoutId } from '../data/program.js'
import { BUILDER_STAGES, REST_DAY_WALK, currentCardioStage, totalSeconds } from '../data/cardio.js'
import { TRACKS } from '../data/tracks.js'
import { prescribe } from '../logic/progression.js'
import { startWorkout, dateKey } from '../logic/state.js'
import { TARGET_SESSIONS_PER_WEEK, weeklyStreak, workoutsThisWeek } from '../logic/history.js'
import { targetText } from '../lib/describe.js'
import { FoodSummaryCard, MobilityCard, TodayAlerts } from '../components/TodayCards.jsx'

function greeting(now) {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Today() {
  const { state, apply } = useStore()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const now = new Date()

  const workoutId = nextWorkoutId(state.workouts)
  const workout = WORKOUTS[workoutId]
  const cardioStage = currentCardioStage(state.cardio)
  const liftMin = estimateLiftMinutes(workoutId, state.tracks)
  const cardioMin = Math.round(totalSeconds(cardioStage) / 60)
  const thisWeek = workoutsThisWeek(state.workouts, now)
  const streak = weeklyStreak(state.workouts, now)
  const today = dateKey(now)
  const liftedToday = state.workouts.some((w) => dateKey(new Date(w.finishedAt)) === today)
  const cardioToday = state.cardioLogs.some((c) => c.kind !== 'rest-walk' && dateKey(new Date(c.date)) === today)

  function start() {
    setError(null)
    try {
      apply((s) => startWorkout(s, workoutId))
      navigate('/workout')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>
          {greeting(now)}
          {state.profile.name ? `, ${state.profile.name}` : ''}
        </h1>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="value">
            {thisWeek}/{TARGET_SESSIONS_PER_WEEK}
          </span>
          <span className="label">Workouts this week</span>
        </div>
        <div className="stat">
          <span className="value">{streak}</span>
          <span className="label">Week streak</span>
        </div>
      </div>

      <TodayAlerts />

      {state.activeWorkout ? (
        <section className="card accent">
          <span className="pill accent">In progress</span>
          <h2>{WORKOUTS[state.activeWorkout.workoutId].name}</h2>
          <p className="text-2 small">Started {new Date(state.activeWorkout.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
          <Link className="btn primary big block" to="/workout">
            Continue workout
          </Link>
        </section>
      ) : liftedToday && cardioToday ? (
        <section className="card">
          <span className="pill good">Done for today</span>
          <h2>Session complete</h2>
          <p className="text-2">
            Muscle grows while you recover. Eat enough protein, sleep 7–9 hours, and have at least one rest day before your next
            session. Up next: <strong>{workout.name}</strong>.
          </p>
        </section>
      ) : (
        <section className="card accent">
          <div className="row between">
            <span className="pill accent">Next session</span>
            <span className="small muted">~{WARM_UP_MINUTES + liftMin + cardioMin} min</span>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <h2>{workout.name}</h2>
            <p className="small text-2">{workout.focus}</p>
          </div>
          {liftedToday && <p className="banner warn small">You already lifted today. Rest at least a day between lifting sessions so your muscles can recover and grow.</p>}
          <ul className="clean ex-list">
            {workout.trackIds.map((trackId) => {
              const track = TRACKS[trackId]
              const p = prescribe(track, state.tracks[trackId], state.equipment, now)
              return (
                <li key={trackId}>
                  <span>{p.levelName}</span>
                  <span className="target">{targetText(trackId, p.levelIndex, p)}</span>
                </li>
              )
            })}
          </ul>
          <p className="hint">
            Warm-up {WARM_UP_MINUTES} min · Lifting ~{liftMin} min · Cardio {cardioMin} min
          </p>
          {error && <p className="error">{error}</p>}
          <button className="btn primary big block" onClick={start}>
            Start {workout.name}
          </button>
        </section>
      )}

      <section className="card">
        <div className="row between">
          <h2>Cardio</h2>
          <span className="pill">{state.cardio.phase === 'builder' ? `Run Builder ${state.cardio.stageIndex + 1}/${BUILDER_STAGES.length}` : 'Fitness phase'}</span>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h3>{cardioStage.title}</h3>
          <p className="small text-2">
            {cardioMin} min on the treadmill, straight after lifting.
            {state.cardio.phase === 'builder' && ` Completed ${state.cardio.successes}/2 times at effort 7 or less.`}
          </p>
        </div>
        {cardioToday ? (
          <p className="pill good" style={{ alignSelf: 'flex-start' }}>
            Cardio logged today
          </p>
        ) : (
          <Link className={`btn block ${liftedToday && !state.activeWorkout ? 'primary' : ''}`} to="/cardio/plan">
            Start cardio
          </Link>
        )}
        <hr className="divider" />
        <div className="row between wrap">
          <div className="stack" style={{ gap: 2 }}>
            <h3>Rest-day walk (optional)</h3>
            <p className="small muted">{REST_DAY_WALK.title.replace('Rest-day incline walk: ', '')}</p>
          </div>
          <Link className="btn small" to="/cardio/rest-walk">
            Start walk
          </Link>
        </div>
      </section>

      <FoodSummaryCard />
      <MobilityCard />

      <section className="card">
        <h2>Coach’s notes</h2>
        <ul className="cues">
          <li>
            Train 3 days with a rest day between (e.g. Mon, Wed, Fri). Workouts alternate A and B automatically.
          </li>
          <li>End each set with 1–2 good reps left in the tank. Form first, always.</li>
          <li>
            Protein: roughly 1.6–2.2 g per kg of bodyweight a day, spread over 3–4 meals. Sleep 7–9 hours. That’s where the
            muscle is built.
          </li>
        </ul>
      </section>
    </>
  )
}
