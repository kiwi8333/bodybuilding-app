import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { MOBILITY_ROUTINE, mobilitySegments, mobilityTotalSeconds } from '../data/mobility.js'
import { logMobility } from '../logic/state.js'
import ExerciseDemo from '../components/ExerciseDemo.jsx'
import { useNow } from '../components/useNow.js'
import { alertChange, alertDone, keepScreenOn, releaseScreen, unlockAudio } from '../lib/alerts.js'
import { formatClock, formatMinutes } from '../lib/format.js'

const SEGMENTS = mobilitySegments()
const TOTAL = mobilityTotalSeconds()

function positionAt(elapsed) {
  let acc = 0
  for (let i = 0; i < SEGMENTS.length; i++) {
    if (elapsed < acc + SEGMENTS[i].seconds) return { index: i, remaining: acc + SEGMENTS[i].seconds - elapsed }
    acc += SEGMENTS[i].seconds
  }
  return { index: SEGMENTS.length, remaining: 0 }
}

export default function Mobility() {
  const { apply } = useStore()
  const [timer, setTimer] = useState(null) // { startedAt, pausedAt, pausedMs }
  const [finished, setFinished] = useState(false)
  const now = useNow(Boolean(timer) && timer.pausedAt == null && !finished, 250)
  const elapsed = timer ? Math.max(0, ((timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs) / 1000) : 0
  const pos = positionAt(elapsed)
  const lastIndex = useRef(0)

  useEffect(() => {
    if (!timer || finished) return
    if (pos.index >= SEGMENTS.length) {
      alertDone()
      releaseScreen()
      setFinished(true)
      apply((s) => logMobility(s))
      return
    }
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index
      alertChange()
    }
  }, [pos.index, timer, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => releaseScreen(), [])

  function start() {
    unlockAudio()
    keepScreenOn()
    lastIndex.current = 0
    setFinished(false)
    setTimer({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 })
  }

  function togglePause() {
    setTimer((t) => (t.pausedAt == null ? { ...t, pausedAt: Date.now() } : { ...t, pausedMs: t.pausedMs + (Date.now() - t.pausedAt), pausedAt: null }))
  }

  if (finished) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Mobility</span>
          <h1>Routine complete</h1>
        </div>
        <section className="card accent">
          <p>Nice. Regular mobility keeps squats deep, presses comfortable and backs happy. Logged in your history.</p>
          <Link className="btn primary block" to="/">
            Back to Today
          </Link>
        </section>
      </>
    )
  }

  if (timer) {
    const seg = SEGMENTS[Math.min(pos.index, SEGMENTS.length - 1)]
    const item = seg.item
    const transition = seg.kind === 'transition'
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">{transition ? 'Get ready' : 'Mobility'}</span>
          <h1>{item.name}</h1>
        </div>
        <section className="card timer-hero" aria-live="polite">
          <span className="phase">{transition ? 'Next up, get into position' : 'Hold and breathe'}</span>
          <span className="clock">{formatClock(pos.remaining)}</span>
          <div className="progress" style={{ marginTop: 8 }}>
            <span style={{ width: `${Math.min(100, (elapsed / TOTAL) * 100)}%` }} />
          </div>
          <span className="small muted">
            {formatClock(elapsed)} of {formatClock(TOTAL)}
          </span>
        </section>
        <ExerciseDemo key={`${item.id}-${item.side ?? ''}`} levelId={item.id} name={item.name} />
        <section className="card">
          <ol className="cues">
            {item.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </section>
        <div className="grid-2">
          <button className="btn big" onClick={togglePause}>
            {timer.pausedAt == null ? 'Pause' : 'Resume'}
          </button>
          <button
            className="btn big danger"
            onClick={() => {
              if (!window.confirm('Stop the routine?')) return
              releaseScreen()
              setTimer(null)
            }}
          >
            Stop
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Rest-day mobility</span>
        <h1>5-minute routine</h1>
        <p className="small text-2">
          {formatMinutes(TOTAL)} · no equipment. Do it on rest days or after a walk. Stretch gently: never into pain.
        </p>
      </div>
      <section className="card">
        <ol className="clean stepper">
          {MOBILITY_ROUTINE.map((m, i) => (
            <li key={`${m.id}-${m.side ?? i}`} className="step">
              <span className="step-dot" aria-hidden>
                {i + 1}
              </span>
              <span className="step-main">
                <span className="small">{m.name}</span>
                <span className="hint">{m.seconds} s</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <button className="btn primary big block" onClick={start}>
        Start routine
      </button>
    </>
  )
}
