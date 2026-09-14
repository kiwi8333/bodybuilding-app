import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WARM_UP, WORKOUTS } from '../data/program.js'
import {
  addSet,
  changeExerciseLevel,
  discardWorkout,
  finishWorkout,
  removeSet,
  setWeightFrom,
  toggleWarmUp,
  updateSet,
} from '../logic/state.js'
import ExerciseCard from '../components/ExerciseCard.jsx'
import RestTimer from '../components/RestTimer.jsx'
import { useNow } from '../components/useNow.js'
import { formatClock } from '../lib/format.js'
import { unlockAudio } from '../lib/alerts.js'

export default function Workout() {
  const { state, apply } = useStore()
  const navigate = useNavigate()
  const [timer, setTimer] = useState(null)
  const [error, setError] = useState(null)
  const now = useNow(Boolean(state.activeWorkout), 1000)
  // Set while finishing/discarding: the store clears activeWorkout before the
  // router applies our navigation, and the "no workout → go home" redirect
  // below must not override the navigation we asked for.
  const leaving = useRef(false)
  const aw = state.activeWorkout

  if (!aw) return leaving.current ? null : <Navigate to="/" replace />

  const workout = WORKOUTS[aw.workoutId]
  const elapsed = (now - new Date(aw.startedAt).getTime()) / 1000
  const totalSets = aw.exercises.reduce((n, ex) => n + ex.sets.length, 0)
  const doneSets = aw.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)

  function handleToggleDone(exIndex, setIndex, done, restSeconds) {
    unlockAudio()
    apply((s) => updateSet(s, exIndex, setIndex, { done }))
    if (done) setTimer({ endAt: Date.now() + restSeconds * 1000, total: restSeconds })
  }

  function finish() {
    setError(null)
    const unfinished = totalSets - doneSets
    const pending = aw.exercises.some((ex) => ex.sets.some((s) => !s.done && s.value !== null))
    let message = 'Finish this workout and save it?'
    if (pending) message = 'Some sets have numbers entered but are not ticked, so they will NOT be saved. Finish anyway?'
    else if (unfinished > 0) message = `${unfinished} set${unfinished === 1 ? '' : 's'} not completed. Unticked sets are not saved. Finish anyway?`
    if (!window.confirm(message)) return
    try {
      const id = aw.id
      leaving.current = true
      apply((s) => finishWorkout(s))
      setTimer(null)
      navigate(`/summary/${id}`, { replace: true })
    } catch (e) {
      leaving.current = false
      setError(e.message)
    }
  }

  function discard() {
    if (!window.confirm('Discard this workout? Nothing from it will be saved and your progression will not change.')) return
    leaving.current = true
    apply(discardWorkout)
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="session-bar">
        <div className="row between">
          <div className="stack" style={{ gap: 0 }}>
            <span className="eyebrow">{workout.name}</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(elapsed)}</strong>
          </div>
          <div className="row">
            <span className="small muted">
              {doneSets}/{totalSets} sets
            </span>
            <button className="btn primary small" onClick={finish}>
              Finish
            </button>
          </div>
        </div>
      </div>

      <section className="card">
        <details className="disclosure" open={aw.warmUpDone.length < WARM_UP.length && doneSets === 0}>
          <summary>
            Warm-up ({aw.warmUpDone.length}/{WARM_UP.length})
          </summary>
          <ul className="clean check-list">
            {WARM_UP.map((item) => (
              <li key={item.id}>
                <input type="checkbox" id={`wu-${item.id}`} checked={aw.warmUpDone.includes(item.id)} onChange={() => apply((s) => toggleWarmUp(s, item.id))} />
                <label htmlFor={`wu-${item.id}`}>{item.text}</label>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {aw.exercises.map((ex, i) => (
        <ExerciseCard
          key={`${ex.trackId}-${ex.levelIndex}`}
          index={i}
          exercise={ex}
          equipment={state.equipment}
          workouts={state.workouts}
          onSetValue={(ei, si, value) => apply((s) => updateSet(s, ei, si, { value }))}
          onToggleDone={handleToggleDone}
          onWeight={(ei, si, w) => apply((s) => setWeightFrom(s, ei, si, w))}
          onAddSet={(ei) => apply((s) => addSet(s, ei))}
          onRemoveSet={(ei) => apply((s) => removeSet(s, ei))}
          onChangeLevel={(ei, level) => apply((s) => changeExerciseLevel(s, ei, level))}
        />
      ))}

      {error && <p className="error">{error}</p>}
      <button className="btn primary big block" onClick={finish}>
        Finish workout
      </button>
      <button className="btn danger block" onClick={discard}>
        Discard workout
      </button>
      {timer && <div style={{ height: 72 }} aria-hidden />}

      <RestTimer
        timer={timer}
        onAdjust={(sec) => setTimer((t) => (t ? { endAt: Math.max(Date.now(), t.endAt) + sec * 1000, total: t.total + sec } : t))}
        onClose={() => setTimer(null)}
      />
    </>
  )
}
