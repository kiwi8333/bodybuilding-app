import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { DEFAULT_EQUIPMENT, completeOnboarding } from '../logic/state.js'
import { TRACKS } from '../data/tracks.js'
import { GYM_TRACKS } from '../data/gymTracks.js'
import { loadLabel } from '../lib/describe.js'

const WHERE = [
  { id: 'home', label: 'Home' },
  { id: 'gym', label: 'Gym' },
  { id: 'both', label: 'Both' },
]

// Gym lifts that take a weight, with their suggested starting load.
const GYM_LIFTS = Object.values(GYM_TRACKS).filter((t) => t.type === 'weighted')

const PUSHUP_OPTIONS = [
  { levelIndex: 0, label: 'Counter', hint: 'Hands on a kitchen counter' },
  { levelIndex: 1, label: 'Chair', hint: 'I can do 8+ on a counter' },
  { levelIndex: 2, label: 'Floor', hint: 'I can do 6+ proper push-ups' },
]

export default function Onboarding() {
  const { apply } = useStore()
  const [name, setName] = useState('')
  const [eq, setEq] = useState({ ...DEFAULT_EQUIPMENT })
  const [walkSpeed, setWalkSpeed] = useState(3.0)
  const [jogSpeed, setJogSpeed] = useState(4.5)
  const [pushupLevel, setPushupLevel] = useState(0)
  const [where, setWhere] = useState('home')
  const [gymWeights, setGymWeights] = useState(() => Object.fromEntries(GYM_LIFTS.map((t) => [t.id, String(t.levels[0].startWeight)])))
  const atHome = where !== 'gym'
  const atGym = where !== 'home'
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState(null)

  function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) =>
        completeOnboarding(s, {
          name,
          equipment: eq,
          walkSpeed: Number(walkSpeed),
          jogSpeed: Number(jogSpeed),
          startLevels: { pushup: pushupLevel },
          startWeights: atGym ? gymWeights : undefined,
          trainAt: where === 'gym' ? 'gym' : 'home',
        }),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const setEqField = (key) => (e) => setEq((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <form className="page" onSubmit={submit}>
      <div className="page-head">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="64" height="64" />
        <span className="eyebrow">Welcome to Forge</span>
        <h1>Build muscle. Get fit.</h1>
        <p className="text-2">
          Three full-body sessions a week, at home with dumbbells or in a full gym, each finished with a treadmill session that
          takes you from walking to running 20 minutes non-stop. The app tells you exactly what to lift and increases the
          challenge automatically. Food tracking and fasting are built in.
        </p>
      </div>

      <section className="card">
        <h2>About you</h2>
        <label className="field">
          First name (optional)
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
        </label>
      </section>

      <section className="card">
        <div className="stack">
          <h2>Where do you train?</h2>
          <p className="hint">Pick Both if you switch between home and a gym. You can change this any time on the Today or Plan screen.</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Where do you train?">
          {WHERE.map((w) => (
            <button type="button" key={w.id} role="radio" aria-checked={where === w.id} className={where === w.id ? 'on' : ''} onClick={() => setWhere(w.id)}>
              {w.label}
            </button>
          ))}
        </div>
      </section>

      {atGym && (
        <section className="card">
          <div className="stack">
            <h2>Gym starting weights</h2>
            <p className="hint">
              Enter a weight you could lift for the top of the rep range with 2 reps to spare. Not sure? Keep the suggestion and adjust it in your first
              session. Your gym’s plate and stack sizes can be set later in Settings → My gym.
            </p>
          </div>
          <ul className="clean gym-start-list">
            {GYM_LIFTS.map((t) => {
              const level = t.levels[0]
              return (
                <li key={t.id}>
                  <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                    <span>{level.name}</span>
                    <span className="hint">
                      {t.sets} × {level.repMin}–{level.repMax} · kg {loadLabel(t, 0)}
                    </span>
                  </span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    aria-label={`${level.name} starting weight in kg`}
                    value={gymWeights[t.id]}
                    onChange={(e) => setGymWeights((g) => ({ ...g, [t.id]: e.target.value }))}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {atHome && (
        <section className="card">
          <div className="stack">
            <h2>Your dumbbells</h2>
            <p className="hint">
              Weight is per dumbbell. With plates, the jump is usually two of your smallest plates (e.g. 2 × 1.25 kg = 2.5 kg).
            </p>
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label className="field">
              Lightest (kg)
              <input className="input" type="number" inputMode="decimal" step="0.25" min="0.5" value={eq.minWeight} onChange={setEqField('minWeight')} required />
            </label>
            <label className="field">
              Jump (kg)
              <input className="input" type="number" inputMode="decimal" step="0.25" min="0.25" value={eq.increment} onChange={setEqField('increment')} required />
            </label>
            <label className="field">
              Heaviest (kg)
              <input className="input" type="number" inputMode="decimal" step="0.25" min="0.5" value={eq.maxWeight} onChange={setEqField('maxWeight')} required />
            </label>
          </div>
        </section>
      )}

      <section className="card">
        <div className="stack">
          <h2>Treadmill speeds</h2>
          <p className="hint">
            Walk: brisk but relaxed. Jog: the slowest jog you can manage while still able to speak in short sentences. Most
            beginners start around 4.0–5.0 mph. You can change these on any cardio session.
          </p>
        </div>
        <div className="grid-2">
          <label className="field">
            Walk (mph)
            <input className="input" type="number" inputMode="decimal" step="0.1" min="1.5" max="4.5" value={walkSpeed} onChange={(e) => setWalkSpeed(e.target.value)} required />
          </label>
          <label className="field">
            Jog (mph)
            <input className="input" type="number" inputMode="decimal" step="0.1" min="3" max="9" value={jogSpeed} onChange={(e) => setJogSpeed(e.target.value)} required />
          </label>
        </div>
      </section>

      {atHome && (
        <section className="card">
          <div className="stack">
            <h2>Push-up starting point</h2>
            <p className="hint">Pick the hardest one you can do for at least 8 clean reps. If unsure, start easier. You will move up quickly.</p>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Push-up starting level">
            {PUSHUP_OPTIONS.map((o) => (
              <button type="button" key={o.levelIndex} role="radio" aria-checked={pushupLevel === o.levelIndex} className={pushupLevel === o.levelIndex ? 'on' : ''} onClick={() => setPushupLevel(o.levelIndex)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="small text-2">{TRACKS.pushup.levels[pushupLevel].name}</p>
          <p className="hint">Other exercises start with light suggested weights. On your first session, adjust them so the last 2 reps of each set are hard but clean.</p>
        </section>
      )}

      <section className="card">
        <h2>Train safely</h2>
        <ul className="cues">
          <li>Stop an exercise if you feel sharp, joint or chest pain, dizziness or unusual breathlessness.</li>
          <li>If you have a heart condition, high blood pressure or any medical concern, get cleared by your GP first.</li>
          <li>Muscle soreness for 1–3 days after early sessions is normal. Pain that is sharp or lingers is not.</li>
          <li>This app gives general fitness guidance, not medical advice.</li>
        </ul>
        <label className="row small">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          I understand and will train within my limits.
        </label>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary big block" type="submit" disabled={!agreed}>
        Start training
      </button>
      <p className="hint" style={{ textAlign: 'center' }}>
        Moving from another device? <Link to="/settings">Restore a backup</Link>
      </p>
    </form>
  )
}
