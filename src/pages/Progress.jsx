import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { TRACKS } from '../data/tracks.js'
import { WORKOUTS } from '../data/program.js'
import { BUILDER_STAGES } from '../data/cardio.js'
import {
  MEASUREMENT_FIELDS,
  addBodyweight,
  addMeasurement,
  dateKey,
  deleteBodyweight,
  deleteCardioLog,
  deleteMeasurement,
  deleteWorkoutRecord,
} from '../logic/state.js'
import { exerciseSeries, levelsWithData, personalBests, weeklyStreak, workoutMinutes } from '../logic/history.js'
import { formatKg } from '../logic/weights.js'
import { setsText } from '../lib/describe.js'
import { formatDate } from '../lib/format.js'
import LineChart from '../components/LineChart.jsx'

function round1(n) {
  return Math.round(n * 10) / 10
}

function Delta({ value, unit }) {
  if (value === 0) return <span className="muted"> (no change)</span>
  return (
    <span className="muted">
      {' '}
      ({value > 0 ? '+' : '−'}
      {Math.abs(round1(value))}
      {unit} since first)
    </span>
  )
}

function BodyweightSection() {
  const { state, apply } = useStore()
  const [date, setDate] = useState(dateKey())
  const [kg, setKg] = useState('')
  const [error, setError] = useState(null)
  const entries = state.bodyweight

  function add(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => addBodyweight(s, date, kg))
      setKg('')
    } catch (err) {
      setError(err.message)
    }
  }

  const latest = entries.at(-1)
  return (
    <section className="card">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Bodyweight</h2>
        {latest ? (
          <p className="small text-2">
            Latest {latest.kg} kg
            {entries.length > 1 && <Delta value={latest.kg - entries[0].kg} unit=" kg" />}
          </p>
        ) : (
          <p className="hint">Weigh yourself first thing in the morning, after the bathroom, 1–2 times a week.</p>
        )}
      </div>
      {entries.length > 0 && <LineChart title="Bodyweight" unit=" kg" points={entries.map((e) => ({ date: e.date, y: e.kg }))} />}
      <form className="row wrap" onSubmit={add} style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 140px' }}>
          Date
          <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field" style={{ flex: '1 1 100px' }}>
          kg
          <input className="input" type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} required />
        </label>
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {entries.length > 0 && (
        <details className="disclosure">
          <summary>Edit entries ({entries.length})</summary>
          <ul className="clean seg-list">
            {[...entries].reverse().map((e) => (
              <li key={e.date}>
                <span>
                  {formatDate(e.date)} · {e.kg} kg
                </span>
                <button className="link-btn" onClick={() => window.confirm('Delete this entry?') && apply((s) => deleteBodyweight(s, e.date))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function MeasurementsSection() {
  const { state, apply } = useStore()
  const [date, setDate] = useState(dateKey())
  const [values, setValues] = useState({})
  const [error, setError] = useState(null)
  const entries = state.measurements

  function add(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => addMeasurement(s, date, values))
      setValues({})
    } catch (err) {
      setError(err.message)
    }
  }

  const firstOf = (key) => entries.find((m) => m[key] !== undefined)?.[key]
  const lastOf = (key) => [...entries].reverse().find((m) => m[key] !== undefined)?.[key]

  return (
    <section className="card">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Measurements</h2>
        <p className="hint">Every 2–4 weeks, relaxed, same time of day. Arms growing while waist holds steady means you’re building muscle, not fat.</p>
      </div>
      {entries.length > 0 && (
        <div className="grid-2">
          {MEASUREMENT_FIELDS.map(({ key, label }) => {
            const last = lastOf(key)
            if (last === undefined) return null
            const first = firstOf(key)
            return (
              <div className="stat" key={key}>
                <span className="value" style={{ fontSize: '1.2rem' }}>
                  {last} cm
                </span>
                <span className="label">
                  {label}
                  {first !== last && ` · ${last - first > 0 ? '+' : '−'}${Math.abs(round1(last - first))}`}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <form className="stack" onSubmit={add}>
        <label className="field">
          Date
          <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="grid-2">
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <label className="field" key={key}>
              {label} (cm)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={values[key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">
          Save measurements
        </button>
      </form>
      {entries.length > 0 && (
        <details className="disclosure">
          <summary>History ({entries.length})</summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  {MEASUREMENT_FIELDS.map((f) => (
                    <th key={f.key}>{f.label.split(' ')[0]}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((m) => (
                  <tr key={m.date}>
                    <td>{formatDate(m.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    {MEASUREMENT_FIELDS.map((f) => (
                      <td key={f.key}>{m[f.key] ?? '–'}</td>
                    ))}
                    <td>
                      <button className="link-btn" onClick={() => window.confirm('Delete this entry?') && apply((s) => deleteMeasurement(s, m.date))}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

function ExerciseSection() {
  const { state } = useStore()
  const trackIds = Object.keys(TRACKS).filter((id) => levelsWithData(state.workouts, id).length)
  const [trackId, setTrackId] = useState(trackIds[0] ?? null)
  const [levelChoice, setLevelChoice] = useState(null)

  if (!trackIds.length) {
    return (
      <section className="card">
        <h2>Strength</h2>
        <p className="hint">Finish your first workout to see strength charts here.</p>
      </section>
    )
  }

  const selected = trackIds.includes(trackId) ? trackId : trackIds[0]
  const track = TRACKS[selected]
  const levels = levelsWithData(state.workouts, selected)
  const levelIndex = levels.includes(levelChoice) ? levelChoice : levels.at(-1)
  const series = exerciseSeries(state.workouts, selected, levelIndex)
  const isWeighted = track.type === 'weighted'
  const pbs = personalBests(state.workouts)

  return (
    <section className="card">
      <h2>Strength</h2>
      <div className="grid-2">
        <label className="field">
          Exercise
          <select
            className="input"
            value={selected}
            onChange={(e) => {
              setTrackId(e.target.value)
              setLevelChoice(null)
            }}
          >
            {trackIds.map((id) => (
              <option key={id} value={id}>
                {TRACKS[id].pattern}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Version
          <select className="input" value={levelIndex} onChange={(e) => setLevelChoice(Number(e.target.value))}>
            {levels.map((i) => (
              <option key={i} value={i}>
                {i + 1}. {track.levels[i].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LineChart
        title={isWeighted ? 'Heaviest weight' : track.type === 'hold' ? 'Longest hold' : 'Best set reps'}
        unit={isWeighted ? ' kg' : track.type === 'hold' ? ' s' : ' reps'}
        formatY={isWeighted ? formatKg : undefined}
        points={series}
        detail={(p) => setsText({ type: track.type, sets: p.sets })}
      />

      <details className="disclosure">
        <summary>Personal bests ({pbs.length})</summary>
        <ul className="clean seg-list">
          {pbs.map((pb) => (
            <li key={`${pb.trackId}-${pb.levelIndex}`}>
              <span>{pb.name}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {pb.type === 'weighted' ? `${formatKg(pb.best.weight)} × ${pb.best.value}` : `${pb.best.value}${pb.type === 'hold' ? ' s' : ' reps'}`}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function HistorySection() {
  const { state, apply } = useStore()
  const items = [
    ...state.workouts.map((w) => ({ type: 'workout', at: w.finishedAt, w })),
    ...state.cardioLogs.map((c) => ({ type: 'cardio', at: c.date, c })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const [limit, setLimit] = useState(10)

  if (!items.length) return null

  return (
    <section className="card">
      <h2>History</h2>
      <p className="hint">Deleting a session removes it from history and charts but does not undo progression. Adjust levels in Plan if needed.</p>
      <ul className="clean stack" style={{ gap: 10 }}>
        {items.slice(0, limit).map((item) =>
          item.type === 'workout' ? (
            <li key={item.w.id}>
              <details className="disclosure">
                <summary>
                  <span className="row between" style={{ color: 'var(--text)' }}>
                    <span>{WORKOUTS[item.w.workoutId].name}</span>
                    <span className="small muted" style={{ fontWeight: 400 }}>
                      {formatDate(item.at)} · {workoutMinutes(item.w)} min
                    </span>
                  </span>
                </summary>
                <ul className="clean seg-list">
                  {item.w.exercises.map((ex) => (
                    <li key={ex.trackId}>
                      <span>{ex.levelName}</span>
                      <span className="text-2">{ex.sets.length ? setsText(ex) : 'Skipped'}</span>
                    </li>
                  ))}
                </ul>
                <button className="link-btn" style={{ color: 'var(--bad)', marginTop: 6 }} onClick={() => window.confirm('Delete this workout from history?') && apply((s) => deleteWorkoutRecord(s, item.w.id))}>
                  Delete workout
                </button>
              </details>
            </li>
          ) : (
            <li key={item.c.id}>
              <details className="disclosure">
                <summary>
                  <span className="row between" style={{ color: 'var(--text)' }}>
                    <span>{item.c.kind === 'rest-walk' ? 'Rest-day walk' : 'Cardio'}</span>
                    <span className="small muted" style={{ fontWeight: 400 }}>
                      {formatDate(item.at)} · {Math.max(1, Math.round(item.c.elapsedSeconds / 60))} min
                    </span>
                  </span>
                </summary>
                <p className="small text-2">
                  {item.c.title} · {item.c.completed ? 'Completed' : 'Stopped early'} · Effort {item.c.effort}/10
                  {item.c.distanceMiles !== null && ` · ${item.c.distanceMiles} mi`}
                </p>
                {item.c.notes && <p className="small muted">{item.c.notes}</p>}
                <button className="link-btn" style={{ color: 'var(--bad)', marginTop: 6 }} onClick={() => window.confirm('Delete this cardio session from history?') && apply((s) => deleteCardioLog(s, item.c.id))}>
                  Delete session
                </button>
              </details>
            </li>
          ),
        )}
      </ul>
      {items.length > limit && (
        <button className="btn small" onClick={() => setLimit((l) => l + 20)}>
          Show more
        </button>
      )}
    </section>
  )
}

export default function Progress() {
  const { state } = useStore()
  const cardioDone = state.cardioLogs.filter((c) => c.kind !== 'rest-walk' && c.completed).length
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Your results</span>
        <h1>Progress</h1>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="value">{state.workouts.length}</span>
          <span className="label">Workouts</span>
        </div>
        <div className="stat">
          <span className="value">{weeklyStreak(state.workouts)}</span>
          <span className="label">Week streak</span>
        </div>
        <div className="stat">
          <span className="value">{cardioDone}</span>
          <span className="label">Cardio sessions</span>
        </div>
        <div className="stat">
          <span className="value">{state.cardio.phase === 'builder' ? `${state.cardio.stageIndex + 1}/${BUILDER_STAGES.length}` : '✓'}</span>
          <span className="label">{state.cardio.phase === 'builder' ? 'Run Builder stage' : 'Can run 20 min'}</span>
        </div>
      </div>
      <ExerciseSection />
      <BodyweightSection />
      <MeasurementsSection />
      <HistorySection />
    </>
  )
}
