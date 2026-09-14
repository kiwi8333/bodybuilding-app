import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { WORKOUTS } from '../data/program.js'
import { TRACKS, isPerSide, repRange } from '../data/tracks.js'
import { BUILDER_STAGES, FITNESS_ROTATION, totalSeconds } from '../data/cardio.js'
import { setTrackLevel } from '../logic/state.js'
import { prescribe } from '../logic/progression.js'
import { targetText } from '../lib/describe.js'

export default function Plan() {
  const { state, apply } = useStore()
  const [tab, setTab] = useState('lifting')

  function chooseLevel(trackId, levelIndex, name) {
    if (state.activeWorkout) {
      window.alert('Finish or discard your current workout before changing levels here. You can also change a level inside the workout.')
      return
    }
    if (!window.confirm(`Switch to "${name}"? Your next session will use this level.`)) return
    apply((s) => setTrackLevel(s, trackId, levelIndex))
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Your program</span>
        <h1>The plan</h1>
      </div>

      <div className="segmented" role="tablist">
        {[
          ['lifting', 'Lifting'],
          ['cardio', 'Cardio'],
          ['rules', 'How it works'],
        ].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lifting' &&
        Object.values(WORKOUTS).map((w) => (
          <section className="card" key={w.id}>
            <div className="stack" style={{ gap: 4 }}>
              <h2>{w.name}</h2>
              <p className="small text-2">{w.focus}</p>
            </div>
            {w.trackIds.map((trackId) => {
              const track = TRACKS[trackId]
              const ts = state.tracks[trackId]
              const p = prescribe(track, ts, state.equipment)
              return (
                <details className="disclosure" key={trackId}>
                  <summary>
                    <span className="stack" style={{ gap: 2, color: 'var(--text)' }}>
                      <span>{p.levelName}</span>
                      <span className="small text-2" style={{ fontWeight: 500 }}>
                        {targetText(trackId, p.levelIndex, p)}
                      </span>
                      <span className="small muted" style={{ fontWeight: 400 }}>
                        {track.muscles} · Rest {track.restSeconds}s · {track.levels.length} levels
                      </span>
                    </span>
                  </summary>
                  <ul className="clean level-list">
                    {track.levels.map((level, i) => {
                      const [lo, hi] = repRange(track, level)
                      return (
                        <li key={level.id} className={i === ts.levelIndex ? 'current' : ''}>
                          <span className="stack" style={{ gap: 2 }}>
                            <span className="small">
                              {i + 1}. {level.name}
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
                            <button className="btn small ghost" onClick={() => chooseLevel(trackId, i, level.name)}>
                              Use
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )
            })}
          </section>
        ))}

      {tab === 'cardio' && (
        <>
          <section className="card">
            <div className="stack" style={{ gap: 4 }}>
              <h2>Phase 1: Run Builder</h2>
              <p className="small text-2">
                Beat a stage by completing it twice at effort 7/10 or lower. Two unfinished sessions in a row step you back one
                stage. That’s normal, not failure.
              </p>
            </div>
            <ul className="clean level-list">
              {BUILDER_STAGES.map((s, i) => {
                const current = state.cardio.phase === 'builder' && i === state.cardio.stageIndex
                const done = state.cardio.phase === 'fitness' || i < state.cardio.stageIndex
                return (
                  <li key={s.id} className={current ? 'current' : ''}>
                    <span className="small">
                      {i + 1}. {s.title}
                    </span>
                    <span className={`pill ${current ? 'accent' : done ? 'good' : ''}`}>{current ? `${state.cardio.successes}/2` : done ? 'Done' : `${Math.round(totalSeconds(s) / 60)} min`}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className="card">
            <div className="stack" style={{ gap: 4 }}>
              <h2>Phase 2: Fitness</h2>
              <p className="small text-2">
                After you can jog 20 minutes, sessions rotate through these. An effort of 5 or less raises your jog speed by 0.2
                mph; an unfinished or 9+ effort session lowers it.
              </p>
            </div>
            <ul className="clean level-list">
              {FITNESS_ROTATION.map((s, i) => (
                <li key={s.id} className={state.cardio.phase === 'fitness' && i === state.cardio.rotationIndex ? 'current' : ''}>
                  <span className="small">{s.title}</span>
                  <span className="pill">{Math.round(totalSeconds(s) / 60)} min</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'rules' && (
        <>
          <section className="card">
            <h2>Weekly schedule</h2>
            <ul className="cues">
              <li>3 sessions a week on non-consecutive days, e.g. Monday, Wednesday, Friday.</li>
              <li>Each session: 6 min warm-up → ~35–40 min lifting → 15–23 min treadmill.</li>
              <li>Workouts alternate A, B, A then B, A, B, so every muscle is trained 1–2 times a week.</li>
              <li>Optional: a 30 min incline walk on 1–2 rest days. It helps fitness and recovery without hurting muscle gain.</li>
            </ul>
          </section>
          <section className="card">
            <h2>How weights go up</h2>
            <ul className="cues">
              <li>
                Each exercise has a rep range, e.g. 8–12. Use the same weight until <strong>every set</strong> reaches the top of
                the range, then the app adds one weight jump.
              </li>
              <li>
                When you beat the range with your heaviest dumbbell, you move up to a harder version (slower tempo, pauses, 1½
                reps, single-leg). That keeps muscles growing with limited equipment.
              </li>
              <li>Falling below the bottom of the range two sessions in a row drops the weight ~10% (or the level) to rebuild.</li>
              <li>After two or more weeks off, your first session back starts ~10% lighter.</li>
            </ul>
          </section>
          <section className="card">
            <h2>Effort and form</h2>
            <ul className="cues">
              <li>Finish each set with 1–2 clean reps left in reserve. If form breaks down, the set is over.</li>
              <li>Control the lowering (2–3 s) on every rep. Rest the full time shown between sets.</li>
              <li>Log the reps you actually did. Honest numbers give accurate progression.</li>
            </ul>
          </section>
          <section className="card">
            <h2>Recovery and food</h2>
            <ul className="cues">
              <li>Protein: about 1.6–2.2 g per kg of bodyweight daily (a palm-sized portion at each meal plus a snack).</li>
              <li>To gain muscle, eat a small surplus: bodyweight rising about 0.25–0.5 kg a month is ideal for a beginner.</li>
              <li>Sleep 7–9 hours. Drink water through the day, more on training days.</li>
            </ul>
          </section>
        </>
      )}
    </>
  )
}
