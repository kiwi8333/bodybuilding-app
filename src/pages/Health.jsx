import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { PERIODS, buildReport } from '../logic/report.js'
import { addHealthCheck, dateKey, deleteHealthCheck } from '../logic/state.js'
import { formatDate } from '../lib/format.js'
import ProgressRing from '../components/ProgressRing.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import { useToast } from '../components/Toasts.jsx'

const STATUS = {
  good: { label: 'Looking good', cls: 'good' },
  ok: { label: 'On the way', cls: 'accent' },
  attention: { label: 'Work on this', cls: 'warn' },
  none: { label: 'Not tracked yet', cls: '' },
}

// Where to go to start tracking a marker.
const TRACK_LINK = {
  weight: ['/progress', 'Log weight'],
  waist: ['/progress', 'Add measurements'],
  bmi: ['/food', 'Add height'],
  rhr: ['#health-check', 'Log below'],
  bp: ['#health-check', 'Log below'],
  fitness: ['/cardio/plan', 'Start cardio'],
  active: ['/cardio/plan', 'Start cardio'],
  strength: ['/', 'Train'],
  sessions: ['/', 'Train'],
  nutrition: ['/food', 'Log food'],
  fasting: ['/fast', 'Open Fast'],
}

function Marker({ m }) {
  const st = STATUS[m.status]
  const link = m.status === 'none' ? TRACK_LINK[m.id] : null
  return (
    <li className={`marker marker-${m.status}`}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="coach-label">{m.title}</span>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong className="marker-value">{m.value}</strong>
        {m.change && <span className="marker-change">{m.change}</span>}
      </div>
      <p className="small text-2">{m.detail}</p>
      {m.meaning && m.status !== 'none' && (
        <details className="marker-why">
          <summary>What this means for your body</summary>
          <p className="small text-2">{m.meaning}</p>
        </details>
      )}
      {link &&
        (link[0].startsWith('#') ? (
          <a className="link-btn" href={link[0]} onClick={(e) => {
            e.preventDefault()
            document.getElementById(link[0].slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}>
            {link[1]}
          </a>
        ) : (
          <Link className="link-btn" to={link[0]}>
            {link[1]}
          </Link>
        ))}
    </li>
  )
}

function HealthCheckForm({ state, apply }) {
  const toast = useToast()
  const [date, setDate] = useState(dateKey())
  const [form, setForm] = useState({ restingHr: '', systolic: '', diastolic: '' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function save(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => addHealthCheck(s, date, form))
      setForm({ restingHr: '', systolic: '', diastolic: '' })
      toast({ message: 'Health check saved' })
    } catch (err) {
      setError(err.message)
    }
  }

  function remove(c) {
    apply((s) => deleteHealthCheck(s, c.date))
    toast({
      message: `Deleted reading from ${formatDate(c.date)}`,
      actionLabel: 'Undo',
      onAction: () => apply((s) => addHealthCheck(s, c.date, c)),
    })
  }

  return (
    <section className="card" id="health-check">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Log a health check</h2>
        <p className="small text-2">
          Resting heart rate: count your pulse for 60 seconds after waking, before you get up. Blood pressure (optional): a home monitor or pharmacy reading, seated
          and rested for 5 minutes. Once a week is plenty.
        </p>
      </div>
      <form className="stack" style={{ gap: 10 }} onSubmit={save}>
        <div className="grid-2">
          <label className="field">
            Date
            <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            Resting heart rate (bpm)
            <input className="input" type="number" inputMode="numeric" value={form.restingHr} onChange={set('restingHr')} />
          </label>
          <label className="field">
            Blood pressure, top
            <input className="input" type="number" inputMode="numeric" placeholder="e.g. 120" value={form.systolic} onChange={set('systolic')} />
          </label>
          <label className="field">
            Blood pressure, bottom
            <input className="input" type="number" inputMode="numeric" placeholder="e.g. 80" value={form.diastolic} onChange={set('diastolic')} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">
          Save reading
        </button>
      </form>
      {state.healthChecks.length > 0 && (
        <ul className="clean seg-list">
          {[...state.healthChecks]
            .reverse()
            .slice(0, 8)
            .map((c) => (
              <SwipeRow key={c.date} className="seg-row" onDelete={() => remove(c)}>
                <span>{formatDate(c.date)}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="text-2">
                    {[c.restingHr !== null ? `${c.restingHr} bpm` : null, c.systolic !== null ? `${c.systolic}/${c.diastolic}` : null].filter(Boolean).join(' · ')}
                  </span>
                  <button className="link-btn" onClick={() => remove(c)} aria-label={`Delete reading from ${formatDate(c.date)}`}>
                    Delete
                  </button>
                </span>
              </SwipeRow>
            ))}
        </ul>
      )}
    </section>
  )
}

export default function Health() {
  const { state, apply } = useStore()
  const [periodId, setPeriodId] = useState('4w')
  const report = buildReport(state, { periodId })
  const { counts, wins, focus, tracked } = report

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Your health report</span>
        <h1>How you’re doing</h1>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Report period">
        {PERIODS.map((p) => (
          <button key={p.id} role="radio" aria-checked={periodId === p.id} className={periodId === p.id ? 'on' : ''} onClick={() => setPeriodId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <section className="card accent">
        <div className="snapshot">
          <ProgressRing value={counts.good} max={Math.max(1, tracked)} size={96} stroke={10} tone={counts.attention ? 'accent' : 'good'} label="Markers looking good">
            <span className="ring-big">{counts.good}</span>
            <span className="ring-small">of {tracked}</span>
          </ProgressRing>
          <div className="stack" style={{ gap: 4 }}>
            <h2>{tracked === 0 ? 'Let’s get a baseline' : counts.attention === 0 ? 'You’re on track' : 'Good progress, a few things to watch'}</h2>
            <p className="small text-2">
              {tracked === 0
                ? 'Log a weigh-in, your waist and a health check, and finish a workout. Your report fills in from there.'
                : `${counts.good} marker${counts.good === 1 ? '' : 's'} looking good, ${counts.ok} on the way, ${counts.attention} to work on${counts.none ? `, ${counts.none} not tracked yet` : ''}.`}
            </p>
          </div>
        </div>
      </section>

      {wins.length > 0 && (
        <section className="card">
          <h2>What it’s doing for your body</h2>
          <ul className="clean benefit-list">
            {wins.map((m) => (
              <li key={m.id}>
                <span className="benefit-dot" aria-hidden />
                <span className="stack" style={{ gap: 2 }}>
                  <strong>
                    {m.title}: {m.value}
                    {m.change ? ` (${m.change})` : ''}
                  </strong>
                  <span className="small text-2">{m.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {focus.length > 0 && (
        <section className="card">
          <h2>Worth working on</h2>
          <ul className="clean benefit-list">
            {focus.map((m) => (
              <li key={m.id}>
                <span className="benefit-dot warn" aria-hidden />
                <span className="stack" style={{ gap: 2 }}>
                  <strong>
                    {m.title}: {m.value}
                  </strong>
                  <span className="small text-2">{m.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.sections.map((sec) => (
        <section className="card" key={sec.id}>
          <h2>{sec.title}</h2>
          <ul className="clean marker-list">
            {sec.markers.map((m) => (
              <Marker key={m.id} m={m} />
            ))}
          </ul>
        </section>
      ))}

      <HealthCheckForm state={state} apply={apply} />

      <p className="hint" style={{ textAlign: 'center' }}>
        Changes compare the start and end of the period. This report gives general guidance from public health thresholds, not a diagnosis. Talk to your doctor about
        any reading that worries you, especially blood pressure.
      </p>
    </>
  )
}
