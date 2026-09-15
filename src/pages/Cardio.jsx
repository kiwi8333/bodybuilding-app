import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { BUILDER_STAGES, EFFORT_SCALE, HARD_SPEED_BONUS_MPH, round1, totalSeconds } from '../data/cardio.js'
import { CARDIO_COACHING } from '../data/coaching.js'
import { cardioSessionFor, logCardio } from '../logic/state.js'
import { useNow } from '../components/useNow.js'
import { alertChange, alertDone, keepScreenOn, releaseScreen, unlockAudio } from '../lib/alerts.js'
import { formatClock, formatMinutes } from '../lib/format.js'
import { heartZones, targetZonesFor, zoneRangeText } from '../logic/heart.js'
import { ageFromBirthYear } from '../logic/nutrition.js'

const TIMER_KEY = 'forge:cardio-timer'
const KIND_LABEL = { walk: 'Walk', jog: 'Jog', hard: 'Hard' }

function readTimer() {
  try {
    const t = JSON.parse(localStorage.getItem(TIMER_KEY))
    if (t && typeof t.startedAt === 'number' && typeof t.pausedMs === 'number') return t
  } catch {
    // ignore
  }
  return null
}

function writeTimer(t) {
  try {
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t))
    else localStorage.removeItem(TIMER_KEY)
  } catch {
    // Timer persistence is a convenience only.
  }
}

function segmentAt(segments, elapsed) {
  let acc = 0
  for (let i = 0; i < segments.length; i++) {
    if (elapsed < acc + segments[i].seconds) return { index: i, into: elapsed - acc, remaining: acc + segments[i].seconds - elapsed }
    acc += segments[i].seconds
  }
  return { index: segments.length, into: 0, remaining: 0 }
}

// Display speed with one decimal, matching treadmill readouts ("3.0", not "3").
function speedOf(kind, walk, jog) {
  const mph = kind === 'walk' ? walk : kind === 'hard' ? jog + HARD_SPEED_BONUS_MPH : jog
  return round1(mph).toFixed(1)
}

export default function Cardio() {
  const { kind } = useParams()
  const { state, apply } = useStore()
  const valid = kind === 'plan' || kind === 'rest-walk'
  const session = cardioSessionFor(state, kind === 'rest-walk' ? 'rest-walk' : 'plan')
  const total = totalSeconds(session)

  // Resume a timer left running (app closed, phone locked, navigated away).
  const [resumable] = useState(() => {
    const saved = readTimer()
    return saved && saved.kind === kind && saved.stageId === session.id ? saved : null
  })

  const [timer, setTimer] = useState(resumable)
  const [phase, setPhase] = useState(resumable ? 'running' : 'setup')
  const [walkSpeed, setWalkSpeed] = useState(resumable?.walkSpeed ?? state.cardio.walkSpeed)
  const [jogSpeed, setJogSpeed] = useState(resumable?.jogSpeed ?? state.cardio.jogSpeed)
  const [completed, setCompleted] = useState(true)
  const [effort, setEffort] = useState(null)
  const [distance, setDistance] = useState('')
  const [notes, setNotes] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const zones = heartZones(state.heart, ageFromBirthYear(state.profile.birthYear))
  const zoneText = (segKind) => zoneRangeText(zones, targetZonesFor(segKind, session.id))
  const [elapsedAtStop, setElapsedAtStop] = useState(0)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const now = useNow(phase === 'running' && timer && timer.pausedAt == null, 250)
  const elapsed = timer ? Math.max(0, ((timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs) / 1000) : 0
  const pos = segmentAt(session.segments, elapsed)
  const lastIndex = useRef(pos.index)

  useEffect(() => {
    if (phase !== 'running' || !timer) return
    if (pos.index >= session.segments.length) {
      // Also covers reopening the app after the session already ran out.
      if (lastIndex.current < session.segments.length) alertDone()
      lastIndex.current = pos.index
      stop(true, total)
      return
    }
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index
      alertChange()
    }
  }, [pos.index, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => releaseScreen(), [])

  if (!valid) return <Navigate to="/" replace />

  function start() {
    setError(null)
    const w = Number(walkSpeed)
    const j = Number(jogSpeed)
    if (!(w >= 1.5 && w <= 4.5)) return setError('Walk speed must be between 1.5 and 4.5 mph.')
    if (kind === 'plan' && !(j >= 3 && j <= 9)) return setError('Jog speed must be between 3 and 9 mph.')
    if (kind === 'plan' && j < w + 0.5) return setError('Jog speed should be at least 0.5 mph faster than walk speed.')
    unlockAudio()
    keepScreenOn()
    const t = { kind, stageId: session.id, startedAt: Date.now(), pausedAt: null, pausedMs: 0, walkSpeed: w, jogSpeed: j }
    lastIndex.current = 0
    writeTimer(t)
    setTimer(t)
    setPhase('running')
  }

  function togglePause() {
    unlockAudio()
    setTimer((t) => {
      const next = t.pausedAt == null ? { ...t, pausedAt: Date.now() } : { ...t, pausedMs: t.pausedMs + (Date.now() - t.pausedAt), pausedAt: null }
      writeTimer(next)
      return next
    })
    if (timer.pausedAt == null) releaseScreen()
    else keepScreenOn()
  }

  function stop(finished, elapsedSeconds) {
    releaseScreen()
    writeTimer(null)
    setElapsedAtStop(Math.round(elapsedSeconds))
    setCompleted(finished)
    setPhase('log')
  }

  function logWithoutTimer() {
    setElapsedAtStop(total)
    setCompleted(true)
    setPhase('log')
  }

  function save() {
    setError(null)
    if (effort === null) return setError('Pick how hard it felt (1–10).')
    try {
      let rec
      apply((s) => {
        const r = logCardio(s, {
          kind,
          completed,
          effort,
          walkSpeed: Number(walkSpeed),
          jogSpeed: kind === 'plan' ? Number(jogSpeed) : s.cardio.jogSpeed,
          elapsedSeconds: elapsedAtStop,
          distanceMiles: distance,
          avgHr,
          maxHr,
          notes,
        })
        rec = r.record
        return r.state
      })
      setResult(rec)
      setPhase('result')
    } catch (e) {
      setError(e.message)
    }
  }

  const isPlan = kind === 'plan'

  if (phase === 'result' && result) {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Cardio saved</span>
          <h1>{result.completed ? 'Nice work' : 'Logged'}</h1>
        </div>
        <section className="card accent">
          <h2>{result.title}</h2>
          <p>{result.message}</p>
        </section>
        <Link className="btn primary big block" to="/">
          Back to Today
        </Link>
      </>
    )
  }

  if (phase === 'log') {
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">Log cardio</span>
          <h1>{session.title}</h1>
          <p className="text-2 small">Time: {formatClock(elapsedAtStop)}</p>
        </div>

        <section className="card">
          <h2>Did you finish every segment?</h2>
          <div className="segmented" role="radiogroup">
            <button type="button" role="radio" aria-checked={completed} className={completed ? 'on' : ''} onClick={() => setCompleted(true)}>
              Yes, all of it
            </button>
            <button type="button" role="radio" aria-checked={!completed} className={!completed ? 'on' : ''} onClick={() => setCompleted(false)}>
              Stopped early
            </button>
          </div>
          {isPlan && <p className="hint">Walking during a jog segment counts as not finished. Be honest: the plan only works if the stages match you.</p>}
        </section>

        <section className="card">
          <h2>How hard did it feel?</h2>
          <div className="effort-grid" role="radiogroup" aria-label="Effort from 1 to 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} role="radio" aria-checked={effort === n} className={`btn ${effort === n ? 'selected' : ''}`} onClick={() => setEffort(n)}>
                {n}
              </button>
            ))}
          </div>
          <p className="small text-2">{effort ? EFFORT_SCALE.find((e) => e.value >= effort)?.label.replace(/^\d+: /, `${effort}: `) : 'Talk test: at 7 you can only say a few words at a time.'}</p>
        </section>

        <section className="card">
          <div className="grid-2">
            <label className="field">
              Walk speed (mph)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={walkSpeed} onChange={(e) => setWalkSpeed(e.target.value)} />
            </label>
            {isPlan && (
              <label className="field">
                Jog speed (mph)
                <input className="input" type="number" inputMode="decimal" step="0.1" value={jogSpeed} onChange={(e) => setJogSpeed(e.target.value)} />
              </label>
            )}
            <label className="field">
              Distance (miles, optional)
              <input className="input" type="number" inputMode="decimal" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </label>
            <label className="field">
              Avg heart rate (bpm)
              <input className="input" type="number" inputMode="numeric" min="40" max="230" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="from watch" />
            </label>
            <label className="field">
              Max heart rate (bpm)
              <input className="input" type="number" inputMode="numeric" min="40" max="230" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} placeholder="from watch" />
            </label>
          </div>
          {zones && avgHr && Number(avgHr) > 0 && (
            <p className="hint">
              Average {avgHr} bpm is Zone {zones.zones.findLast((z) => Number(avgHr) >= z.loBpm)?.zone ?? 'below 1'} for you.
            </p>
          )}
          <label className="field">
            Notes (optional)
            <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </section>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary big block" onClick={save}>
          Save
        </button>
      </>
    )
  }

  if (phase === 'running' && timer) {
    const seg = session.segments[Math.min(pos.index, session.segments.length - 1)]
    const next = session.segments[pos.index + 1]
    const paused = timer.pausedAt != null
    return (
      <>
        <div className="page-head">
          <span className="eyebrow">{isPlan ? 'Treadmill session' : 'Rest-day walk'}</span>
          <h2>{session.title}</h2>
        </div>

        <section className="card timer-hero" aria-live="polite">
          <span className={`phase seg-kind-${seg.kind}`}>
            {KIND_LABEL[seg.kind]} · {seg.label}
          </span>
          <span className="clock">{formatClock(pos.remaining)}</span>
          <span className="speed">
            Set treadmill to {speedOf(seg.kind, timer.walkSpeed, timer.jogSpeed)} mph
            {!isPlan ? ' · 5–8% incline' : ' · 1% incline'}
          </span>
          {zoneText(seg.kind) && <span className="small text-2">Heart rate target: {zoneText(seg.kind)}</span>}
          <div className="progress" style={{ marginTop: 8 }} aria-label="Session progress">
            <span style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
          </div>
          <span className="small muted">
            {formatClock(elapsed)} of {formatClock(total)}
            {next ? ` · Next: ${KIND_LABEL[next.kind]} ${formatMinutes(next.seconds)} at ${speedOf(next.kind, timer.walkSpeed, timer.jogSpeed)} mph` : ' · Last segment'}
          </span>
        </section>

        <div className="grid-2">
          <button className="btn big" onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            className="btn big danger"
            onClick={() => {
              if (window.confirm('End the session now? You can still log it.')) stop(false, elapsed)
            }}
          >
            End
          </button>
        </div>
        {paused && <p className="banner warn small">Paused. Remember to slow or stop the treadmill.</p>}
        <p className="hint">Keep this screen open for sound and vibration cues at every change. If the phone locks, the timer keeps correct time when you come back.</p>

        <section className="card">
          <ul className="clean seg-list">
            {session.segments.map((s, i) => (
              <li key={i} className={i < pos.index ? 'past' : i === pos.index ? 'current' : ''}>
                <span className={`seg-kind-${s.kind}`}>{s.label}</span>
                <span>
                  {formatMinutes(s.seconds)} · {speedOf(s.kind, timer.walkSpeed, timer.jogSpeed)} mph
                </span>
              </li>
            ))}
          </ul>
        </section>
      </>
    )
  }

  // Setup
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">
          {isPlan ? (state.cardio.phase === 'builder' ? `Run Builder · Stage ${state.cardio.stageIndex + 1} of ${BUILDER_STAGES.length}` : 'Fitness phase') : 'Optional rest-day cardio'}
        </span>
        <h1>{session.title}</h1>
        <p className="text-2 small">{formatMinutes(total)} total</p>
      </div>

      <section className="card">
        <h2>Coach says</h2>
        <p className="small text-2">
          {!isPlan ? CARDIO_COACHING.restWalk : state.cardio.phase === 'builder' ? CARDIO_COACHING.builder : CARDIO_COACHING.fitness}
        </p>
      </section>

      <section className="card">
        <h2>Speeds</h2>
        <div className="grid-2">
          <label className="field">
            Walk (mph)
            <input className="input" type="number" inputMode="decimal" step="0.1" min="1.5" max="4.5" value={walkSpeed} onChange={(e) => setWalkSpeed(e.target.value)} />
          </label>
          {isPlan && (
            <label className="field">
              Jog (mph)
              <input className="input" type="number" inputMode="decimal" step="0.1" min="3" max="9" value={jogSpeed} onChange={(e) => setJogSpeed(e.target.value)} />
            </label>
          )}
        </div>
        {isPlan ? (
          <p className="hint">
            Set the incline to 1% (it matches outdoor effort). Jog slowly enough to finish. Stages are beaten by completing them, not by speed.
            {session.segments.some((s) => s.kind === 'hard') && ` "Hard" segments are jog speed + ${HARD_SPEED_BONUS_MPH} mph.`}
          </p>
        ) : (
          <p className="hint">Incline 5–8%, brisk pace, no holding the handrails. You should be able to hold a conversation.</p>
        )}
      </section>

      <section className="card">
        <ul className="clean seg-list">
          {session.segments.map((s, i) => (
            <li key={i}>
              <span className={`seg-kind-${s.kind}`}>{s.label}</span>
              <span>
                {formatMinutes(s.seconds)} · {speedOf(s.kind, Number(walkSpeed) || 0, Number(jogSpeed) || 0)} mph
              </span>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary big block" onClick={start}>
        Start timer
      </button>
      <button className="btn block" onClick={logWithoutTimer}>
        Log without timer
      </button>
    </>
  )
}
