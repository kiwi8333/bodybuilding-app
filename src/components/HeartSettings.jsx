import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { updateBodyProfile, updateHeart } from '../logic/state.js'
import { ageFromBirthYear } from '../logic/nutrition.js'
import { heartZones } from '../logic/heart.js'

export function BodyAndHeartSettings() {
  const { state, apply } = useStore()
  const age = ageFromBirthYear(state.profile.birthYear)
  const [body, setBody] = useState({ sex: state.profile.sex ?? '', age: age ?? '', heightCm: state.profile.heightCm ?? '' })
  const [hr, setHr] = useState({ maxHr: state.heart.maxHr ?? '', restingHr: state.heart.restingHr ?? '' })
  const [bodyStatus, setBodyStatus] = useState(null)
  const [hrStatus, setHrStatus] = useState(null)
  const zones = heartZones(state.heart, age)

  function saveBody(e) {
    e.preventDefault()
    try {
      apply((s) => updateBodyProfile(s, body))
      setBodyStatus({ ok: true, text: 'Saved.' })
    } catch (err) {
      setBodyStatus({ ok: false, text: err.message })
    }
  }

  function saveHr(e) {
    e.preventDefault()
    try {
      apply((s) => updateHeart(s, hr))
      setHrStatus({ ok: true, text: 'Saved.' })
    } catch (err) {
      setHrStatus({ ok: false, text: err.message })
    }
  }

  const status = (s) =>
    s && (
      <p className={s.ok ? 'small' : 'error'} role="status" style={s.ok ? { color: 'var(--good)' } : undefined}>
        {s.text}
      </p>
    )

  return (
    <>
      <form className="card" onSubmit={saveBody}>
        <div className="stack" style={{ gap: 4 }}>
          <h2>About you</h2>
          <p className="hint">Used for calorie targets and heart-rate zones. Stays on this phone.</p>
        </div>
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <label className="field">
            Sex
            <select className="input" value={body.sex} onChange={(e) => setBody((b) => ({ ...b, sex: e.target.value }))} required>
              <option value="" disabled>
                Choose
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field">
            Age
            <input className="input" type="number" inputMode="numeric" value={body.age} onChange={(e) => setBody((b) => ({ ...b, age: e.target.value }))} required />
          </label>
          <label className="field">
            Height (cm)
            <input className="input" type="number" inputMode="decimal" value={body.heightCm} onChange={(e) => setBody((b) => ({ ...b, heightCm: e.target.value }))} required />
          </label>
        </div>
        <button className="btn" type="submit">
          Save
        </button>
        {status(bodyStatus)}
      </form>

      <form className="card" onSubmit={saveHr}>
        <div className="stack" style={{ gap: 4 }}>
          <h2>Heart rate</h2>
          <p className="hint">
            From your watch or strap. Resting HR: check it on waking. Max HR: leave blank to estimate it from your age, or enter the highest value you have seen in an
            all-out effort.
          </p>
        </div>
        <div className="grid-2">
          <label className="field">
            Resting HR (bpm)
            <input className="input" type="number" inputMode="numeric" value={hr.restingHr} onChange={(e) => setHr((h) => ({ ...h, restingHr: e.target.value }))} placeholder="optional" />
          </label>
          <label className="field">
            Max HR (bpm)
            <input className="input" type="number" inputMode="numeric" value={hr.maxHr} onChange={(e) => setHr((h) => ({ ...h, maxHr: e.target.value }))} placeholder={age ? `≈ ${Math.round(208 - 0.7 * age)}` : 'optional'} />
          </label>
        </div>
        <button className="btn" type="submit">
          Save
        </button>
        {status(hrStatus)}
        {zones ? (
          <div className="table-wrap">
            <table className="data">
              <caption className="hint" style={{ textAlign: 'left', paddingBottom: 6 }}>
                Your zones · max {zones.maxHr} bpm {zones.measured ? '(measured)' : '(estimated)'} · {zones.method === 'reserve' ? 'heart-rate reserve method' : '% of max'}
              </caption>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>bpm</th>
                  <th>Feels like</th>
                </tr>
              </thead>
              <tbody>
                {zones.zones.map((z) => (
                  <tr key={z.zone}>
                    <td>
                      {z.zone} · {z.name}
                    </td>
                    <td>
                      {z.loBpm}–{z.hiBpm}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>{z.feel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Add your age above (or a max HR) to see your zones.</p>
        )}
      </form>
    </>
  )
}
