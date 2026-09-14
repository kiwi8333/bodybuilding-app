import { useState } from 'react'
import { TRACKS, isPerSide } from '../data/tracks.js'
import { availableWeights, formatKg } from '../logic/weights.js'
import { lastPerformance } from '../logic/history.js'
import { loadLabel, setsText, targetText } from '../lib/describe.js'
import { formatDate } from '../lib/format.js'
import { CheckIcon } from './icons.jsx'
import ExerciseDemo from './ExerciseDemo.jsx'
import CoachBox from './CoachBox.jsx'

const MAX_VALUE = { weighted: 100, reps: 100, hold: 600 }

export default function ExerciseCard({ index, exercise, equipment, workouts, onSetValue, onToggleDone, onWeight, onAddSet, onRemoveSet, onChangeLevel }) {
  const track = TRACKS[exercise.trackId]
  const level = track.levels[exercise.levelIndex]
  const weights = availableWeights(equipment, { allowBodyweight: level.allowBodyweight })
  const last = lastPerformance(workouts, exercise.trackId)
  const doneCount = exercise.sets.filter((s) => s.done).length
  const anyDone = doneCount > 0
  const [error, setError] = useState(null)
  const [showDemo, setShowDemo] = useState(false)
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

  function changeLevel(e) {
    setError(null)
    try {
      onChangeLevel(index, Number(e.target.value))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card" aria-labelledby={`ex-${index}`}>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="eyebrow">
            {track.pattern} · Level {exercise.levelIndex + 1}/{track.levels.length}
          </span>
          <span className={`pill ${doneCount >= exercise.target.sets ? 'good' : ''}`}>
            {doneCount}/{exercise.sets.length}
          </span>
        </div>
        <h2 id={`ex-${index}`}>{level.name}</h2>
        <p className="small text-2">
          Do: <strong>{targetText(exercise.trackId, exercise.levelIndex, exercise.target)}</strong> · rest {track.restSeconds} s
        </p>
        {isPerSide(track, exercise.levelIndex) && <p className="hint">Do every set on both sides. Log the reps of your weaker side.</p>}
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
            <ExerciseDemo levelId={level.id} name={level.name} />
            <CoachBox trackId={exercise.trackId} levelIndex={exercise.levelIndex} target={exercise.target} />
            <div className="stack" style={{ gap: 6 }}>
              <h3>Form cues</h3>
              <ol className="cues">
                {level.cues.map((c) => (
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
          <div className={`set-row ${set.done ? 'done' : ''}`} key={j}>
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
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
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
        <label className="row small muted" style={{ gap: 6 }}>
          Level
          <select className="input" style={{ minHeight: 36, padding: '4px 8px', width: 'auto' }} value={exercise.levelIndex} onChange={changeLevel} disabled={anyDone} aria-label="Exercise level for this session">
            {track.levels.map((l, i) => (
              <option key={l.id} value={i}>
                {i + 1}. {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {anyDone ? null : <p className="hint">Too hard or too easy? Change the level before logging sets. Progress rules use what you actually did.</p>}
    </section>
  )
}
