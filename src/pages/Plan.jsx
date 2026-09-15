import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { WARM_UP, WARM_UP_MINUTES, WORKOUTS, estimateLiftMinutes, nextWorkoutId } from '../data/program.js'
import { TRACKS, isPerSide, repRange } from '../data/tracks.js'
import { BUILDER_STAGES, FITNESS_ROTATION, REST_DAY_WALK, currentCardioStage, totalSeconds } from '../data/cardio.js'
import { CARDIO_COACHING, WEEKLY_GUIDE } from '../data/coaching.js'
import { beginDeload, setTrackLevel, setTrackSwap } from '../logic/state.js'
import { DELOAD_WORKOUTS, WORKOUTS_BETWEEN_DELOADS, workoutsSinceDeload } from '../logic/deload.js'
import { findSwap, swapDemoId, swapsFor } from '../data/swaps.js'
import { prescribe } from '../logic/progression.js'
import { formatKg } from '../logic/weights.js'
import ExerciseDemo from '../components/ExerciseDemo.jsx'
import CoachBox from '../components/CoachBox.jsx'

const TABS = [
  ['lifting', 'Lifting'],
  ['cardio', 'Cardio'],
  ['rules', 'How it works'],
]

function Chevron({ open }) {
  return (
    <svg className={`chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" aria-hidden width="20" height="20">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WeekCard({ first }) {
  const second = first === 'A' ? 'B' : 'A'
  const days = [
    { d: 'Mon', kind: 'lift', w: first },
    { d: 'Tue', kind: 'rest', note: 'Walk?' },
    { d: 'Wed', kind: 'lift', w: second },
    { d: 'Thu', kind: 'rest', note: 'Walk?' },
    { d: 'Fri', kind: 'lift', w: first },
    { d: 'Sat', kind: 'rest', note: 'Walk?' },
    { d: 'Sun', kind: 'off', note: 'Rest' },
  ]
  return (
    <section className="card">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Your week</h2>
        <p className="small text-2">Starting from your next workout. Any 3 days work as long as there is a rest day between.</p>
      </div>
      <ol className="week-grid clean">
        {days.map((day) => (
          <li key={day.d} className={`day day-${day.kind}`}>
            <span className="day-name">{day.d}</span>
            <span className="day-tag">{day.kind === 'lift' ? day.w : day.note}</span>
            <span className="day-sub">{day.kind === 'lift' ? '+ run' : day.kind === 'rest' ? 'optional' : ''}</span>
          </li>
        ))}
      </ol>
      <p className="hint">The following week flips: {second} · {first} · {second}.</p>
    </section>
  )
}

function SessionFlow({ liftMin, cardioMin }) {
  const total = WARM_UP_MINUTES + liftMin + cardioMin
  const blocks = [
    { label: 'Warm-up', min: WARM_UP_MINUTES, cls: 'flow-warm' },
    { label: 'Lifting', min: liftMin, cls: 'flow-lift' },
    { label: 'Treadmill', min: cardioMin, cls: 'flow-cardio' },
  ]
  return (
    <section className="card">
      <div className="row between">
        <h2>Every session</h2>
        <span className="pill">~{total} min</span>
      </div>
      <div className="flow-bar" aria-hidden>
        {blocks.map((b) => (
          <span key={b.label} className={b.cls} style={{ flexGrow: b.min }} />
        ))}
      </div>
      <ol className="flow-legend clean">
        {blocks.map((b, i) => (
          <li key={b.label}>
            <span className={`flow-dot ${b.cls}`} aria-hidden />
            <span>
              <strong>
                {i + 1}. {b.label}
              </strong>
              <span className="muted"> · {b.min} min</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ExerciseRow({ number, trackId, state, open, onToggle, onChooseLevel, onSetSwap }) {
  const track = TRACKS[trackId]
  const ts = state.tracks[trackId]
  const p = prescribe(track, ts, state.equipment)
  const level = track.levels[p.levelIndex]
  const swap = ts.swapId ? findSwap(trackId, ts.swapId) : null
  const shownName = swap ? swap.name : level.name
  const demoId = swap ? swapDemoId(swap) : level.id
  const chips = [`${p.sets} sets`, `${p.low}–${p.high}${track.type === 'hold' ? ' s' : ' reps'}${swap?.perSide || isPerSide(track, p.levelIndex) ? ' / side' : ''}`]
  if (track.type === 'weighted') chips.push(p.weight === 0 ? 'Bodyweight' : formatKg(p.weight))
  chips.push(`Rest ${track.restSeconds} s`)
  if (swap) chips.push('Swap in use')

  return (
    <li className={`ex-row ${open ? 'open' : ''}`}>
      <button type="button" className="ex-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="badge-num" aria-hidden>
          {number}
        </span>
        <span className="ex-row-main">
          <span className="ex-row-name">{shownName}</span>
          <span className="ex-row-muscles">{swap ? `Instead of ${level.name}` : track.muscles}</span>
          <span className="chips">
            {chips.map((c) => (
              <span className="chip" key={c}>
                {c}
              </span>
            ))}
          </span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="ex-row-body">
          <ExerciseDemo key={demoId} levelId={demoId} name={shownName} />
          <CoachBox trackId={trackId} levelIndex={p.levelIndex} target={p} showWhy={!swap} />
          {swap && <p className="small text-2">{swap.why} Progression on {level.name} is paused while this swap is in use.</p>}
          <div className="stack" style={{ gap: 6 }}>
            <h3>Form cues</h3>
            <ol className="cues">
              {(swap ? swap.cues : level.cues).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          </div>
          {swapsFor(trackId).length > 0 && (
            <label className="field">
              Swap this exercise for future sessions
              <select className="input" value={ts.swapId ?? ''} onChange={(e) => onSetSwap(trackId, e.target.value || null)}>
                <option value="">No swap: {level.name}</option>
                {swapsFor(trackId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <h3>Progression path</h3>
            <ol className="clean level-list">
              {track.levels.map((l, i) => {
                const [lo, hi] = repRange(track, l)
                return (
                  <li key={l.id} className={i === ts.levelIndex ? 'current' : ''}>
                    <span className="stack" style={{ gap: 2 }}>
                      <span className="small">
                        {i + 1}. {l.name}
                      </span>
                      <span className="hint">
                        {lo}–{hi}
                        {track.type === 'hold' ? ' s' : ' reps'}
                        {isPerSide(track, i) ? ' each side' : ''}
                      </span>
                    </span>
                    {i === ts.levelIndex ? (
                      <span className="pill accent">Current</span>
                    ) : (
                      <button type="button" className="btn small ghost" onClick={() => onChooseLevel(trackId, i, l.name)}>
                        Use
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </li>
  )
}

function LiftingTab({ state, apply }) {
  const next = nextWorkoutId(state.workouts)
  const [selected, setSelected] = useState(next)
  const [openTrack, setOpenTrack] = useState(null)
  const workout = WORKOUTS[selected]
  const liftMin = estimateLiftMinutes(selected, state.tracks)
  const cardioMin = Math.round(totalSeconds(currentCardioStage(state.cardio)) / 60)
  const totalSets = workout.trackIds.reduce((n, id) => n + TRACKS[id].sets, 0)

  function chooseLevel(trackId, levelIndex, name) {
    if (state.activeWorkout) {
      window.alert('Finish or discard your current workout before changing levels here. You can also change a level inside the workout.')
      return
    }
    if (!window.confirm(`Switch to "${name}"? Your next session will use this level.`)) return
    apply((s) => setTrackLevel(s, trackId, levelIndex))
  }

  function setSwap(trackId, swapId) {
    if (state.activeWorkout) {
      window.alert('Finish or discard your current workout first. You can also swap inside the workout.')
      return
    }
    apply((s) => setTrackSwap(s, trackId, swapId))
  }

  const sinceDeload = workoutsSinceDeload(state.deload, state.workouts.length)

  return (
    <>
      <WeekCard first={next} />
      <SessionFlow liftMin={liftMin} cardioMin={cardioMin} />

      <section className="card">
        <div className="row between">
          <h2>Recovery weeks</h2>
          <span className={`pill ${state.deload.active ? 'accent' : ''}`}>{state.deload.active ? 'Deload now' : `${Math.min(sinceDeload, WORKOUTS_BETWEEN_DELOADS)}/${WORKOUTS_BETWEEN_DELOADS}`}</span>
        </div>
        <p className="small text-2">
          {state.deload.active
            ? `Deload session ${state.deload.workoutsDone + 1} of ${DELOAD_WORKOUTS}: one set fewer, about 10% lighter, progression paused.`
            : `Every ${WORKOUTS_BETWEEN_DELOADS} workouts (about 8 weeks) the app offers a lighter deload week of ${DELOAD_WORKOUTS} sessions. ${sinceDeload} done since the last one.`}
        </p>
        {!state.deload.active && (
          <button
            className="link-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              if (!window.confirm('Start a deload week now? Use this if you feel run down, sore joints or stalled on several exercises.')) return
              try {
                apply((s) => beginDeload(s))
              } catch (err) {
                window.alert(err.message)
              }
            }}
          >
            Start a deload week now
          </button>
        )}
      </section>

      <section className="card">
        <div className="row between wrap">
          <div className="stack" style={{ gap: 2 }}>
            <h2>Rest-day mobility</h2>
            <p className="small text-2">5-minute guided routine for hips, shoulders and hamstrings. 1–3 times a week.</p>
          </div>
          <Link className="btn small" to="/mobility">
            Open
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="segmented" role="tablist" aria-label="Choose workout">
          {Object.values(WORKOUTS).map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={selected === w.id}
              className={selected === w.id ? 'on' : ''}
              onClick={() => {
                setSelected(w.id)
                setOpenTrack(null)
              }}
            >
              {w.name}
              {w.id === next ? ' · next' : ''}
            </button>
          ))}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h2>{workout.name}</h2>
          <p className="small text-2">{workout.focus}</p>
          <p className="hint">
            {workout.trackIds.length} exercises · {totalSets} sets · ~{liftMin} min of lifting. Do them in this order. Tap an exercise for
            the demo and coaching.
          </p>
        </div>
        <ol className="clean ex-rows">
          {workout.trackIds.map((trackId, i) => (
            <ExerciseRow
              key={trackId}
              number={i + 1}
              trackId={trackId}
              state={state}
              open={openTrack === trackId}
              onToggle={() => setOpenTrack((cur) => (cur === trackId ? null : trackId))}
              onChooseLevel={chooseLevel}
              onSetSwap={setSwap}
            />
          ))}
        </ol>
      </section>

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Warm-up</h2>
          <p className="small text-2">{WARM_UP_MINUTES} minutes before every session. It raises your body temperature and grooves the movements.</p>
        </div>
        <ol className="cues">
          {WARM_UP.map((w) => (
            <li key={w.id}>{w.text}</li>
          ))}
        </ol>
      </section>
    </>
  )
}

function CardioTab({ state }) {
  const stage = currentCardioStage(state.cardio)
  const isBuilder = state.cardio.phase === 'builder'
  const jogMin = stage.segments.filter((s) => s.kind !== 'walk').reduce((n, s) => n + s.seconds, 0) / 60

  return (
    <>
      <section className="card accent">
        <span className="pill accent" style={{ alignSelf: 'flex-start' }}>
          {isBuilder ? `Run Builder · stage ${state.cardio.stageIndex + 1} of ${BUILDER_STAGES.length}` : 'Fitness phase'}
        </span>
        <h2>{stage.title}</h2>
        <div className="coach-grid">
          <div className="coach-item">
            <span className="coach-label">How often</span>
            <span className="coach-value">3 × week</span>
            <span className="coach-sub">after lifting</span>
          </div>
          <div className="coach-item">
            <span className="coach-label">Total</span>
            <span className="coach-value">{Math.round(totalSeconds(stage) / 60)} min</span>
            <span className="coach-sub">incl. walks</span>
          </div>
          <div className="coach-item">
            <span className="coach-label">Running</span>
            <span className="coach-value">{Math.round(jogMin * 10) / 10} min</span>
            <span className="coach-sub">{isBuilder ? `at ${state.cardio.jogSpeed.toFixed(1)} mph` : 'jog + hard segments'}</span>
          </div>
          {isBuilder && (
            <div className="coach-item">
              <span className="coach-label">Unlock next</span>
              <span className="coach-value">{state.cardio.successes}/2</span>
              <span className="coach-sub">at effort ≤ 7</span>
            </div>
          )}
        </div>
        <p className="small text-2">{isBuilder ? CARDIO_COACHING.builder : CARDIO_COACHING.fitness}</p>
        <Link className="btn primary block" to="/cardio/plan">
          Open treadmill session
        </Link>
      </section>

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Phase 1: Run Builder</h2>
          <p className="small text-2">Two unfinished sessions in a row step you back one stage. That is normal, not failure.</p>
        </div>
        <ol className="clean stepper">
          {BUILDER_STAGES.map((s, i) => {
            const current = isBuilder && i === state.cardio.stageIndex
            const done = !isBuilder || i < state.cardio.stageIndex
            return (
              <li key={s.id} className={`step ${current ? 'current' : done ? 'done' : ''}`}>
                <span className="step-dot" aria-hidden>
                  {done ? '✓' : i + 1}
                </span>
                <span className="step-main">
                  <span className="small">{s.title}</span>
                  <span className="hint">{Math.round(totalSeconds(s) / 60)} min total</span>
                </span>
                {current && <span className="pill accent">Now</span>}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Phase 2: Fitness</h2>
          <p className="small text-2">
            After you can jog 20 minutes, sessions rotate through these. Effort 5 or less raises your jog speed by 0.2 mph; an unfinished or
            9+ effort session lowers it.
          </p>
        </div>
        <ol className="clean stepper">
          {FITNESS_ROTATION.map((s, i) => {
            const current = !isBuilder && i === state.cardio.rotationIndex
            return (
              <li key={s.id} className={`step ${current ? 'current' : ''}`}>
                <span className="step-dot" aria-hidden>
                  {i + 1}
                </span>
                <span className="step-main">
                  <span className="small">{s.title}</span>
                  <span className="hint">{Math.round(totalSeconds(s) / 60)} min total</span>
                </span>
                {current && <span className="pill accent">Next</span>}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="card">
        <h2>Rest-day walk</h2>
        <p className="small text-2">{CARDIO_COACHING.restWalk}</p>
        <p className="small">
          <strong>{REST_DAY_WALK.title}</strong>, 0–2 times a week.
        </p>
      </section>
    </>
  )
}

function RulesTab() {
  return (
    <>
      <section className="card">
        <h2>How often</h2>
        <div className="coach-grid">
          {WEEKLY_GUIDE.map((g) => (
            <div className="coach-item" key={g.label}>
              <span className="coach-label">{g.label}</span>
              <span className="coach-value">{g.value}</span>
              <span className="coach-sub">{g.detail}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>How weights go up</h2>
        <ul className="cues spaced">
          <li>
            Each exercise has a rep range, e.g. 8–12. Use the same weight until <strong>every set</strong> reaches the top of the range,
            then the app adds one weight jump.
          </li>
          <li>
            When you beat the range with your heaviest dumbbell, you move up to a harder version (slower tempo, pauses, 1½ reps, single-leg).
            That keeps muscles growing with limited equipment.
          </li>
          <li>Falling below the bottom of the range two sessions in a row drops the weight ~10% (or the level) to rebuild.</li>
          <li>After two or more weeks off, your first session back starts ~10% lighter.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Effort and form</h2>
        <ul className="cues spaced">
          <li>Finish each set with 1–2 clean reps left in reserve. If form breaks down, the set is over.</li>
          <li>Follow the tempo shown for each exercise; the demos move at that exact speed.</li>
          <li>Rest the full time shown between sets. Log the reps you actually did.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Recovery and food</h2>
        <ul className="cues spaced">
          <li>Protein: about 1.6–2.2 g per kg of bodyweight daily (a palm-sized portion at each meal plus a snack).</li>
          <li>
            To gain muscle, eat a small surplus: bodyweight rising about 0.5–1% a month (0.4–0.8 kg if you weigh 80 kg) is ideal for a beginner. The Food tab sets
            your targets and adjusts them from your weigh-ins.
          </li>
          <li>Sleep 7–9 hours. Drink water through the day, more on training days.</li>
        </ul>
      </section>
    </>
  )
}

export default function Plan() {
  const { state, apply } = useStore()
  const [tab, setTab] = useState('lifting')

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Your program</span>
        <h1>The plan</h1>
      </div>

      <div className="segmented" role="tablist" aria-label="Plan sections">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lifting' && <LiftingTab state={state} apply={apply} />}
      {tab === 'cardio' && <CardioTab state={state} />}
      {tab === 'rules' && <RulesTab />}
    </>
  )
}
