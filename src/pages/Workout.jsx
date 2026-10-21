import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WORKOUTS, warmUpFor } from '../data/program.js'
import {
  addSet,
  changeExerciseLevel,
  discardWorkout,
  finishWorkout,
  removeSet,
  removeSetAt,
  insertSetAt,
  setExerciseSwap,
  setWeightFrom,
  toggleWarmUp,
  updateSet,
} from '../logic/state.js'
import ExerciseCard from '../components/ExerciseCard.jsx'
import RestTimer from '../components/RestTimer.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import CountUp from '../components/CountUp.jsx'
import { useNow } from '../components/useNow.js'
import { formatClock } from '../lib/format.js'
import { unlockAudio } from '../lib/alerts.js'
import { useDialogs } from '../components/Dialogs.jsx'
import { useToast } from '../components/Toasts.jsx'

export default function Workout() {
  const { confirm } = useDialogs()
  const toast = useToast()
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
  const warmUp = warmUpFor(aw.workoutId)
  const elapsed = (now - new Date(aw.startedAt).getTime()) / 1000
  const totalSets = aw.exercises.reduce((n, ex) => n + ex.sets.length, 0)
  const doneSets = aw.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)

  function handleToggleDone(exIndex, setIndex, done, restSeconds) {
    unlockAudio()
    apply((s) => updateSet(s, exIndex, setIndex, { done }))
    if (done) setTimer({ endAt: Date.now() + restSeconds * 1000, total: restSeconds })
  }

  async function finish() {
    setError(null)
    const unfinished = totalSets - doneSets
    const pending = aw.exercises.some((ex) => ex.sets.some((s) => !s.done && s.value !== null))
    let title = 'Finish and save this workout?'
    let message = 'Your progression updates from what you logged.'
    if (pending) {
      title = 'Some sets are not ticked'
      message = 'They have numbers entered but are not ticked, so they will NOT be saved. Finish anyway?'
    } else if (unfinished > 0) {
      title = `${unfinished} set${unfinished === 1 ? '' : 's'} not completed`
      message = 'Unticked sets are not saved. Finish anyway?'
    }
    if (!(await confirm({ title, message, confirmLabel: 'Finish workout', cancelLabel: 'Keep training' }))) return
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

  async function discard() {
    if (!(await confirm({ title: 'Discard this workout?', message: 'Nothing from it will be saved and your progression will not change.', confirmLabel: 'Discard workout', cancelLabel: 'Keep training', tone: 'danger' }))) return
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
            <ProgressRing value={doneSets} max={totalSets} size={38} stroke={4} tone={doneSets >= totalSets && totalSets > 0 ? 'good' : 'accent'} label="Sets completed">
              <span className="ring-num">{Math.round((doneSets / Math.max(1, totalSets)) * 100)}%</span>
            </ProgressRing>
            <span className="small muted">
              <CountUp value={doneSets} />/{totalSets} sets
            </span>
            <button className="btn primary small" onClick={finish}>
              Finish
            </button>
          </div>
        </div>
      </div>

      {aw.deload && (
        <p className="banner warn small">
          Deload week: every exercise has one set fewer and about 10% less weight. Stop each set with 3 reps in reserve. Progression resumes after the
          deload.
        </p>
      )}

      <section className="card">
        <details className="disclosure" open={aw.warmUpDone.length < warmUp.length && doneSets === 0}>
          <summary>
            Warm-up ({aw.warmUpDone.length}/{warmUp.length})
          </summary>
          <ul className="clean check-list">
            {warmUp.map((item) => (
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
          onDeleteSet={(ei, si) => {
            const { trackId, sets } = aw.exercises[ei]
            const set = sets[si]
            apply((s) => removeSetAt(s, ei, si))
            toast({ message: `Set ${si + 1} removed`, actionLabel: 'Undo', onAction: () => apply((s) => insertSetAt(s, ei, si, set, trackId)) })
          }}
          onChangeLevel={(ei, level) => apply((s) => changeExerciseLevel(s, ei, level))}
          onSetRir={(ei, si, rir) => apply((s) => updateSet(s, ei, si, { rir }))}
          onSwap={(ei, swapId, remember) => apply((s) => setExerciseSwap(s, ei, swapId, { remember }))}
          deload={aw.deload}
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
