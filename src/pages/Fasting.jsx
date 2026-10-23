import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import {
  FAST_PLANS,
  FAST_STAGES,
  MAX_CUSTOM_HOURS,
  MIN_CUSTOM_HOURS,
  fastHours,
  fastStats,
  formatClockHours,
  formatDuration,
  hoursBetween,
  lastSevenDays,
  planHours,
  reachedGoal,
  stageAt,
  stageTimes,
} from '../logic/fasting.js'
import { abandonFast, addBodyweight, beginFast, changeFastStart, dateKey, finishFast, putBackFastLog, removeFastLog, setFastPlan } from '../logic/state.js'
import { useNow } from '../components/useNow.js'
import FastOrbit from '../components/FastOrbit.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { FastIcon } from '../components/icons.jsx'
import { useDialogs } from '../components/Dialogs.jsx'
import { useToast } from '../components/Toasts.jsx'
import { haptic } from '../lib/alerts.js'

// For <input type="datetime-local">: local time as YYYY-MM-DDTHH:mm.
function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const dayOf = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function PlanPicker({ fasting, onPick }) {
  const [custom, setCustom] = useState(String(fasting.customHours))
  const [error, setError] = useState(null)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="plan-grid" role="radiogroup" aria-label="Fasting plan">
        {FAST_PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={fasting.planId === p.id}
            className={`plan-chip ${fasting.planId === p.id ? 'on' : ''}`}
            onClick={() => {
              setError(null)
              try {
                onPick(p.id, p.id === 'custom' ? Number(custom) : undefined)
              } catch (err) {
                setError(err.message)
              }
            }}
          >
            <strong>{p.id === 'custom' ? `${fasting.customHours}h` : p.id === 'open' ? '∞' : p.id}</strong>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <p className="hint">{FAST_PLANS.find((p) => p.id === fasting.planId)?.note}</p>
      {fasting.planId === 'custom' && (
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            try {
              onPick('custom', Number(custom))
            } catch (err) {
              setError(err.message)
            }
          }}
        >
          <label className="field" style={{ flex: 1 }}>
            Goal (hours)
            <input className="input" type="number" inputMode="decimal" min={MIN_CUSTOM_HOURS} max={MAX_CUSTOM_HOURS} step="0.5" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </label>
          <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
            Set
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

// The stages as a strip: where you are now, and how far through.
function StageStrip({ hours }) {
  const current = stageAt(hours)
  return (
    <ol className="stage-strip clean" aria-label="Fasting stages">
      {FAST_STAGES.map((s, i) => {
        const next = FAST_STAGES[i + 1]
        const span = next ? next.from - s.from : 12
        const fill = Math.min(1, Math.max(0, (hours - s.from) / span))
        return (
          <li key={s.id} className={`stage-seg ${s.id === current.id ? 'now' : hours >= s.from ? 'past' : ''}`} title={s.name}>
            <span className="stage-bar">
              <span style={{ width: `${fill * 100}%`, background: s.color }} />
            </span>
            <span className="stage-hour">{s.from}h</span>
          </li>
        )
      })}
    </ol>
  )
}

function WeekChart({ logs, goal }) {
  const days = lastSevenDays(logs)
  const top = Math.max(24, goal ?? 0, ...days.map((d) => d.hours))
  const H = 120
  return (
    <figure className="week-chart" aria-label="Fasting hours, last 7 days">
      <svg viewBox={`0 0 280 ${H + 22}`} role="img">
        {goal && (
          <>
            <line x1="0" x2="280" y1={H - (goal / top) * H} y2={H - (goal / top) * H} className="week-goal" />
            <text x="2" y={H - (goal / top) * H - 4} className="week-goal-label">
              {goal}h goal
            </text>
          </>
        )}
        {days.map((d, i) => {
          const h = (d.hours / top) * H
          const x = 8 + i * 39
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={H - Math.max(h, 3)}
                width="26"
                height={Math.max(h, 3)}
                rx="6"
                className={d.hours === 0 ? 'week-bar empty' : 'week-bar'}
                style={d.hours ? { fill: stageAt(d.hours).color, opacity: d.reached ? 1 : 0.55 } : undefined}
              />
              <text x={x + 13} y={H + 16} textAnchor="middle" className="week-day">
                {d.weekday}
              </text>
              <title>{d.hours ? `${d.date}: ${formatDuration(d.hours)}, reached ${stageAt(d.hours).name}` : `${d.date}: no fast`}</title>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export default function Fasting() {
  const { state, apply } = useStore()
  const { confirm, notify } = useDialogs()
  const toast = useToast()
  const f = state.fasting
  const active = f.active
  const now = useNow(true, 1000)
  const [editing, setEditing] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [weight, setWeight] = useState('')
  const [showStages, setShowStages] = useState(false)
  const [burstKey, setBurstKey] = useState(0)

  const elapsed = active ? hoursBetween(active.startedAt, now) : 0
  const goal = active ? active.targetHours : planHours(f)
  const stage = stageAt(elapsed)
  const nextStage = FAST_STAGES.find((s) => s.from > elapsed)
  const reached = active && goal !== null && elapsed >= goal
  const last = f.logs.at(-1)
  const stats = fastStats(f.logs, new Date(now))

  // A short celebration the moment the goal is reached with the app open.
  const celebrated = useRef(reached)
  useEffect(() => {
    if (reached && !celebrated.current) {
      haptic('complete')
      toast({ message: `Goal reached: ${goal}h fast! End it whenever you are ready.` })
    }
    celebrated.current = reached
  }, [reached, goal, toast])

  // Crossing into a new stage with the app open: a burst on the ring, a buzz
  // and a message. Opening the page mid-fast does not celebrate.
  const lastStage = useRef(active ? stage.id : null)
  useEffect(() => {
    if (!active) {
      lastStage.current = null
      return
    }
    if (lastStage.current && lastStage.current !== stage.id && stage.from > (FAST_STAGES.find((s) => s.id === lastStage.current)?.from ?? 0)) {
      haptic('success')
      setBurstKey(Date.now())
      toast({ message: `New stage: ${stage.name}` })
    }
    lastStage.current = stage.id
  }, [active, stage, toast])

  const act = (fn) => {
    try {
      apply(fn)
      return true
    } catch (err) {
      notify({ title: 'That didn’t work', message: err.message })
      return false
    }
  }

  async function end() {
    const short = goal !== null && elapsed < goal
    const ok = await confirm({
      title: short ? `End at ${formatDuration(elapsed)}?` : 'End your fast?',
      message: short ? `You are ${formatDuration(goal - elapsed)} short of your ${goal}h goal. It is saved either way.` : `${formatDuration(elapsed)} fasted. Nice work. Break it with a protein-rich meal.`,
      confirmLabel: 'End fast',
      cancelLabel: 'Keep fasting',
    })
    if (ok && act((s) => finishFast(s))) haptic(short ? 'tap' : 'success')
  }

  async function cancel() {
    const ok = await confirm({ title: 'Cancel this fast?', message: 'It will not be saved to your history.', confirmLabel: 'Cancel fast', cancelLabel: 'Keep fasting', tone: 'danger' })
    if (ok) act(abandonFast)
  }

  function saveStart(e) {
    e.preventDefault()
    if (act((s) => changeFastStart(s, new Date(startInput).toISOString()))) setEditing(false)
  }

  function remove(log) {
    act((s) => removeFastLog(s, log.id))
    toast({ message: `Deleted ${formatDuration(fastHours(log))} fast`, actionLabel: 'Undo', onAction: () => act((s) => putBackFastLog(s, log)) })
  }

  function logWeight(e) {
    e.preventDefault()
    if (act((s) => addBodyweight(s, dateKey(), weight))) {
      toast({ message: `Logged ${Number(weight)} kg for today` })
      setWeight('')
    }
  }

  const pct = goal ? Math.min(100, Math.round((elapsed / goal) * 100)) : null
  const goalAt = active && goal ? new Date(new Date(active.startedAt).getTime() + goal * 3600000).toISOString() : null

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Intermittent fasting</span>
        <h1>Fast</h1>
      </div>

      <section className={`card fast-hero ${active ? 'running' : ''}`}>
        <div className="fast-ring-wrap">
          <FastOrbit hours={elapsed} active={Boolean(active)} goal={goal} burstKey={burstKey} onShowStages={() => setShowStages((v) => !v)}>
            {active ? (
              <>
                <span className="fast-label stage-text" style={{ '--c': reached ? 'var(--good)' : stage.color }}>
                  {reached ? 'Goal reached' : stage.name}
                </span>
                <span className="fast-clock">{formatClockHours(elapsed)}</span>
                <span className="fast-sub">
                  {goal ? (reached ? `+${formatDuration(elapsed - goal)} past ${goal}h` : `${formatDuration(goal - elapsed)} to go · ${pct}%`) : 'Open fast'}
                </span>
              </>
            ) : (
              <>
                <span className="fast-label">Ready to fast</span>
                <span className="fast-clock">{goal ? `${goal}h` : '∞'}</span>
                <span className="fast-sub">{last ? `Last fast ended ${formatDuration(hoursBetween(last.endedAt, now))} ago` : 'Pick a plan and start'}</span>
              </>
            )}
          </FastOrbit>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Tap or hold the ring for {active ? 'when you reach each stage' : 'the fasting stages'}.
        </p>
        {showStages && (
          <ol className="clean stage-times" aria-label="Fasting stages">
            {(active ? stageTimes(active.startedAt, new Date(now)) : FAST_STAGES).map((s) => (
              <li key={s.id} className={active && s.reached ? 'reached' : ''} style={{ '--c': s.color }}>
                <span className="stage-times-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d={s.icon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="stack" style={{ gap: 1, flex: 1, minWidth: 0 }}>
                  <strong>{s.name}</strong>
                  <span className="hint">
                    From {s.from}h
                    {active && (s.reached ? ` · reached ${timeOf(s.at.toISOString())}` : ` · ${timeOf(s.at.toISOString())} ${dayOf(s.at.toISOString())}, in ${formatDuration((s.at - now) / 3600000)}`)}
                  </span>
                </span>
                {active && s.id === stage.id && (
                  <span className="pill stage-text" style={{ background: `${s.color}26` }}>
                    Now
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {active ? (
          <>
            <div className="fast-times">
              <div>
                <span className="coach-label">Started</span>
                <strong>{timeOf(active.startedAt)}</strong>
                <span className="hint">{dayOf(active.startedAt)}</span>
              </div>
              <div>
                <span className="coach-label">Goal</span>
                <strong>{goalAt ? timeOf(goalAt) : 'None'}</strong>
                <span className="hint">{goalAt ? `${dayOf(goalAt)} · ${goal}h` : 'Open fast'}</span>
              </div>
            </div>
            <button className="btn primary big block" onClick={end}>
              End fast
            </button>
            {editing ? (
              <form className="stack" style={{ gap: 8 }} onSubmit={saveStart}>
                <label className="field">
                  When did you start?
                  <input className="input" type="datetime-local" value={startInput} max={toLocalInput(new Date(now).toISOString())} onChange={(e) => setStartInput(e.target.value)} required />
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn primary" type="submit">
                    Save start time
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="row between">
                <button
                  className="link-btn"
                  onClick={() => {
                    setStartInput(toLocalInput(active.startedAt))
                    setEditing(true)
                  }}
                >
                  Edit start time
                </button>
                <button className="link-btn" style={{ color: 'var(--bad)' }} onClick={cancel}>
                  Cancel fast
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <PlanPicker fasting={f} onPick={(id, hours) => apply((s) => setFastPlan(s, id, hours))} />
            <button className="btn primary big block" onClick={() => act((s) => beginFast(s)) && haptic('success')}>
              Start {goal ? `${goal}h` : 'open'} fast
            </button>
            <p className="hint" style={{ textAlign: 'center' }}>
              Forgot to start it? Start now, then use “Edit start time”.
            </p>
          </>
        )}
      </section>

      {active && (
        <section className="card">
          <div className="row between">
            <h2>{stage.name}</h2>
            <span className="pill accent">{formatDuration(elapsed)}</span>
          </div>
          <p className="small text-2">{stage.text}</p>
          <StageStrip hours={elapsed} />
          {nextStage && (
            <p className="hint">
              Next: <strong>{nextStage.name}</strong> in {formatDuration(nextStage.from - elapsed)}
            </p>
          )}
        </section>
      )}

      {active && (
        <section className="card">
          <h2>Change plan</h2>
          <PlanPicker fasting={f} onPick={(id, hours) => apply((s) => setFastPlan(s, id, hours))} />
        </section>
      )}

      <div className="stats">
        <div className="stat">
          <span className="value">{stats.streak}</span>
          <span className="label">Day streak</span>
        </div>
        <div className="stat">
          <span className="value">{stats.completed}</span>
          <span className="label">Goals reached</span>
        </div>
        <div className="stat">
          <span className="value">{stats.total ? formatDuration(stats.longest) : '–'}</span>
          <span className="label">Longest fast</span>
        </div>
        <div className="stat">
          <span className="value">{stats.total ? formatDuration(stats.average) : '–'}</span>
          <span className="label">Average fast</span>
        </div>
      </div>

      <section className="card">
        <h2>Last 7 days</h2>
        <WeekChart logs={f.logs} goal={goal} />
      </section>

      <section className="card">
        <h2>History</h2>
        {f.logs.length === 0 ? (
          <EmptyState icon={<FastIcon />} title="No fasts yet">
            Your finished fasts show up here with their length. Swipe one left to delete it.
          </EmptyState>
        ) : (
          <ul className="clean seg-list">
            {[...f.logs]
              .reverse()
              .slice(0, 20)
              .map((l) => (
                <SwipeRow key={l.id} className="seg-row" onDelete={() => remove(l)}>
                  <span className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className="fast-stage-dot" style={{ '--c': stageAt(fastHours(l)).color }} title={`Reached ${stageAt(fastHours(l)).name}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d={stageAt(fastHours(l)).icon} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="stack" style={{ gap: 1 }}>
                      <span>
                        {dayOf(l.endedAt)} · <strong>{formatDuration(fastHours(l))}</strong>
                      </span>
                      <span className="hint">
                        {timeOf(l.startedAt)} → {timeOf(l.endedAt)}
                        {l.targetHours ? ` · goal ${l.targetHours}h` : ' · open'}
                      </span>
                      <span className="hint stage-text" style={{ '--c': stageAt(fastHours(l)).color }}>
                        Reached {stageAt(fastHours(l)).name.toLowerCase()}
                      </span>
                    </span>
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className={`pill ${reachedGoal(l) ? 'good' : ''}`}>{reachedGoal(l) ? 'Goal ✓' : 'Short'}</span>
                    <button className="link-btn" onClick={() => remove(l)} aria-label={`Delete fast from ${dayOf(l.endedAt)}`}>
                      Delete
                    </button>
                  </span>
                </SwipeRow>
              ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Log your weight</h2>
        <p className="small text-2">Weigh in at the same time each day, ideally in the morning before eating. It shows up in Progress and steers your calorie target.</p>
        <form className="row" style={{ gap: 8 }} onSubmit={logWeight}>
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="Weight (kg)" aria-label="Weight in kg" value={weight} onChange={(e) => setWeight(e.target.value)} required style={{ flex: 1 }} />
          <button className="btn primary" type="submit">
            Save
          </button>
        </form>
        {state.bodyweight.length > 0 && <p className="hint">Last: {state.bodyweight.at(-1).kg} kg on {state.bodyweight.at(-1).date}</p>}
      </section>

      <section className="card">
        <h2>Fasting safely</h2>
        <ul className="cues">
          <li>Water, black coffee and plain tea are fine while fasting. Drink plenty.</li>
          <li>On training days, eat your protein-rich meals inside your eating window so you can still build muscle.</li>
          <li>Stop if you feel dizzy, faint or unwell.</li>
          <li>Do not fast if you are pregnant or breastfeeding, under 18, have had an eating disorder, or take medicine for diabetes or blood pressure without your doctor’s OK.</li>
        </ul>
        <p className="hint">Stage timings are typical averages and vary from person to person.</p>
      </section>
    </>
  )
}
