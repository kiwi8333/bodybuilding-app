import { useState } from 'react'
import { TRACKS, isPerSide } from '../data/tracks.js'
import { findSwap, swapDemoId, swapsFor } from '../data/swaps.js'
import { availableWeights, formatKg } from '../logic/weights.js'
import { lastPerformance } from '../logic/history.js'
import { loadLabel, setsText, targetText } from '../lib/describe.js'
import { formatDate } from '../lib/format.js'
import { CheckIcon } from './icons.jsx'
import ExerciseDemo from './ExerciseDemo.jsx'
import CoachBox from './CoachBox.jsx'

const MAX_VALUE = { weighted: 100, reps: 100, hold: 600 }
const RIR_OPTIONS = [
  { value: 0, label: '0', hint: 'nothing left' },
  { value: 1, label: '1', hint: '1 more rep' },
  { value: 2, label: '2', hint: '2 more reps' },
  { value: 3, label: '3+', hint: 'easy' },
]

export default function ExerciseCard({
  index,
  exercise,
  equipment,
  workouts,
  deload,
  onSetValue,
  onToggleDone,
  onWeight,
  onAddSet,
  onRemoveSet,
  onChangeLevel,
  onSetRir,
  onSwap,
}) {
  const track = TRACKS[exercise.trackId]
  const level = track.levels[exercise.levelIndex]
  const swap = exercise.swapId ? findSwap(exercise.trackId, exercise.swapId) : null
  const swaps = swapsFor(exercise.trackId)
  const name = swap ? swap.name : level.name
  const demoId = swap ? swapDemoId(swap) : level.id
  const cues = swap ? swap.cues : level.cues
  const perSide = swap?.perSide || isPerSide(track, exercise.levelIndex)
  const weights = availableWeights(equipment, { allowBodyweight: level.allowBodyweight })
  const last = swap ? null : lastPerformance(workouts, exercise.trackId)
  const doneCount = exercise.sets.filter((s) => s.done).length
  const anyDone = doneCount > 0
  const [error, setError] = useState(null)
  const [showDemo, setShowDemo] = useState(false)
  const [remember, setRemember] = useState(false)
  const valueLabel = track.type === 'hold' ? 'Secs' : 'Reps'

  function toggle(setIndex) {
    const set = exercise.sets[setIndex]
    setError(null)
    if (!set.done) {
      const v = set.value
      if (!Number.isInteger(v) || v <= 0) {
        setError(`Enter the ${track.type === 'hold' ? 'seconds held' : 'reps you did'} for set ${setIndex + 1} first.`)
        return
      }
      if (v > MAX_VALUE[track.type]) {
        setError(`That looks too high. Check set ${setIndex + 1}.`)
        return
      }
    }
    onToggleDone(index, setIndex, !set.done, track.restSeconds)
  }

  const guard = (fn) => (...args) => {
    setError(null)
    try {
      fn(...args)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card" aria-labelledby={`ex-${index}`}>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="eyebrow">
            {track.pattern} · {swap ? 'Swap' : `Level ${exercise.levelIndex + 1}/${track.levels.length}`}
            {deload ? ' · Deload' : ''}
          </span>
          <span className={`pill ${doneCount >= exercise.target.sets ? 'good' : ''}`}>
            {doneCount}/{exercise.sets.length}
          </span>
        </div>
        <h2 id={`ex-${index}`}>{name}</h2>
        <p className="small text-2">
          Do: <strong>{targetText(exercise.trackId, exercise.levelIndex, exercise.target)}</strong>
          {swap?.perSide && !isPerSide(track, exercise.levelIndex) ? ' · each side' : ''} · rest {track.restSeconds} s
        </p>
        {perSide && <p className="hint">Do every set on both sides. Log the reps of your weaker side.</p>}
        {swap && <p className="banner warn small">Swapped for {level.name}. Progression on it is paused while you use this swap.</p>}
        {exercise.target.note && <p className="banner warn small">{exercise.target.note}</p>}
        {last && (
          <p className="hint">
            Last time ({formatDate(last.finishedAt)}
            {last.levelIndex !== exercise.levelIndex ? `, ${last.levelName}` : ''}): {setsText(last)}
          </p>
        )}
      </div>

      <details className="disclosure" onToggle={(e) => setShowDemo(e.currentTarget.open)}>
        <summary>{showDemo ? 'Hide demo & coaching' : 'Watch demo & coaching'}</summary>
        {showDemo && (
          <div className="stack" style={{ gap: 12 }}>
            <ExerciseDemo key={demoId} levelId={demoId} name={name} />
            <CoachBox trackId={exercise.trackId} levelIndex={exercise.levelIndex} target={exercise.target} showWhy={!swap} />
            {swap && <p className="small text-2">{swap.why}</p>}
            <div className="stack" style={{ gap: 6 }}>
              <h3>Form cues</h3>
              <ol className="cues">
                {cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </details>

      <div className="set-table">
        <div className="set-row head" aria-hidden>
          <span>Set</span>
          <span>{track.type === 'weighted' ? `kg (${loadLabel(track, exercise.levelIndex)})` : ''}</span>
          <span>{valueLabel}</span>
          <span />
        </div>
        {exercise.sets.map((set, j) => (
          <div key={j} className="set-block">
            <div className={`set-row ${set.done ? 'done' : ''}`}>
              <span className="num">{j + 1}</span>
              {track.type === 'weighted' ? (
                <select
                  className="input"
                  aria-label={`Set ${j + 1} weight`}
                  value={String(set.weight)}
                  disabled={set.done}
                  onChange={(e) => onWeight(index, j, Number(e.target.value))}
                >
                  {weights.map((w) => (
                    <option key={w} value={String(w)}>
                      {formatKg(w)}
                    </option>
                  ))}
                  {!weights.some((w) => w === set.weight) && set.weight !== null && <option value={String(set.weight)}>{formatKg(set.weight)}</option>}
                </select>
              ) : (
                <span className="small muted" style={{ textAlign: 'center' }}>
                  {track.type === 'hold' ? `${exercise.target.low}–${exercise.target.high}s` : `${exercise.target.low}–${exercise.target.high}`}
                </span>
              )}
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_VALUE[track.type]}
                step="1"
                aria-label={`Set ${j + 1} ${valueLabel.toLowerCase()}`}
                placeholder={String(exercise.target.high)}
                value={set.value ?? ''}
                disabled={set.done}
                onChange={(e) => {
                  const raw = e.target.value
                  onSetValue(index, j, raw === '' ? null : Math.max(0, Math.floor(Number(raw))))
                }}
              />
              <button className={`check ${set.done ? 'on' : ''}`} onClick={() => toggle(j)} aria-pressed={set.done} aria-label={set.done ? `Undo set ${j + 1}` : `Complete set ${j + 1}`}>
                <CheckIcon />
              </button>
            </div>
            {set.done && track.type !== 'hold' && (
              <div className="rir-row" role="radiogroup" aria-label={`Set ${j + 1}: reps left in the tank`}>
                <span className="hint">Reps left?</span>
                {RIR_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={set.rir === o.value}
                    title={o.hint}
                    className={`rir-chip ${set.rir === o.value ? 'on' : ''}`}
                    onClick={() => onSetRir(index, j, set.rir === o.value ? null : o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {track.type !== 'hold' && anyDone && (
        <p className="hint">Optional: tap how many more good reps you could have done. Easy sets earn bigger jumps; sets to failure repeat the weight.</p>
      )}

      <div className="row between wrap">
        <div className="row">
          <button className="btn small ghost" onClick={() => onAddSet(index)}>
            + Set
          </button>
          <button className="btn small ghost" onClick={() => onRemoveSet(index)} disabled={exercise.sets.length <= 1 || exercise.sets.at(-1).done}>
            − Set
          </button>
        </div>
        {!swap && (
          <label className="row small muted" style={{ gap: 6 }}>
            Level
            <select
              className="input"
              style={{ minHeight: 36, padding: '4px 8px', width: 'auto', maxWidth: 190 }}
              value={exercise.levelIndex}
              onChange={(e) => guard(onChangeLevel)(index, Number(e.target.value))}
              disabled={anyDone}
              aria-label="Exercise level for this session"
            >
              {track.levels.map((l, i) => (
                <option key={l.id} value={i}>
                  {i + 1}. {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {swaps.length > 0 && (
        <details className="disclosure">
          <summary>{swap ? 'Change or undo swap' : 'Swap exercise (no chair, sore joint…)'}</summary>
          <div className="stack">
            <label className="field">
              Exercise
              <select className="input" value={exercise.swapId ?? ''} disabled={anyDone} onChange={(e) => guard(onSwap)(index, e.target.value || null, remember)}>
                <option value="">{level.name} (planned)</option>
                {swaps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {!swap && (
              <label className="row small">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                Keep using the swap in future sessions
              </label>
            )}
            {!swap && swaps.map((s) => (
              <p key={s.id} className="hint">
                <strong>{s.name}:</strong> {s.why}
              </p>
            ))}
            {anyDone && <p className="hint">Clear logged sets to swap.</p>}
          </div>
        </details>
      )}
      {!anyDone && !swap && <p className="hint">Too hard or too easy? Change the level before logging sets. Progress rules use what you actually did.</p>}
    </section>
  )
}
