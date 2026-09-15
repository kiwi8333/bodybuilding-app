import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { updateReminders } from '../logic/state.js'
import { disablePush, enablePush, pushConfigured, pushSupport, showTestNotification, supportMessage, syncPush } from '../reminders/client.js'

const DAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
]

const TIMES = []
for (let m = 5 * 60; m <= 21 * 60; m += 30) TIMES.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)

export default function ReminderSettings() {
  const { state, apply } = useStore()
  const r = state.reminders
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const configured = pushConfigured()
  const support = typeof window !== 'undefined' ? pushSupport() : { ok: false, reason: 'unsupported' }

  function change(patch) {
    setStatus(null)
    try {
      const next = apply((s) => updateReminders(s, { ...s.reminders, ...patch }))
      if (next.reminders.enabled) syncPush(next, { force: true }).catch((err) => setStatus({ ok: false, text: err.message }))
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    }
  }

  async function turnOn() {
    setBusy(true)
    setStatus(null)
    try {
      const next = apply((s) => updateReminders(s, { ...s.reminders, enabled: true }))
      await enablePush(next)
      setStatus({ ok: true, text: 'Reminders are on for this phone. Turn them on separately on your other phone.' })
    } catch (err) {
      apply((s) => updateReminders(s, { ...s.reminders, enabled: false }))
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setStatus(null)
    try {
      await disablePush()
      setStatus({ ok: true, text: 'Reminders are off for this phone.' })
    } catch (err) {
      setStatus({ ok: false, text: `Turned off on this phone, but the server could not be updated: ${err.message}` })
    } finally {
      apply((s) => updateReminders(s, { ...s.reminders, enabled: false }))
      setBusy(false)
    }
  }

  const toggleDay = (d) => {
    const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d]
    if (!days.length) return setStatus({ ok: false, text: 'Keep at least one training day.' })
    change({ days })
  }

  return (
    <section className="card">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Workout reminders</h2>
        <p className="hint">
          A notification on your training days, a nudge the day after a missed session, and a weekly backup reminder. Your plan days are also used for the in-app
          “missed session” note.
        </p>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="coach-label">Training days</span>
        <div className="day-chips" role="group" aria-label="Training days">
          {DAYS.map(([d, label]) => (
            <button key={d} type="button" aria-pressed={r.days.includes(d)} className={r.days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2">
        <label className="field">
          Reminder time
          <select className="input" value={r.time} onChange={(e) => change({ time: e.target.value })}>
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="row small">
        <input type="checkbox" checked={r.nudgeMissed} onChange={(e) => change({ nudgeMissed: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
        Nudge me the day after a missed session
      </label>
      <label className="row small">
        <input type="checkbox" checked={r.nudgeBackup} onChange={(e) => change({ nudgeBackup: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
        Weekly backup reminder (Sundays)
      </label>

      {!configured ? (
        <p className="banner warn small">Push notifications are being connected. Your settings are saved and reminders will be available here shortly.</p>
      ) : !support.ok ? (
        <p className="banner warn small">{supportMessage(support.reason)}</p>
      ) : r.enabled ? (
        <div className="grid-2">
          <button className="btn" onClick={() => showTestNotification().catch((err) => setStatus({ ok: false, text: err.message }))}>
            Test notification
          </button>
          <button className="btn danger" onClick={turnOff} disabled={busy}>
            Turn off
          </button>
        </div>
      ) : (
        <button className="btn primary block" onClick={turnOn} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on reminders for this phone'}
        </button>
      )}
      {configured && <p className="hint">Reminders arrive within about 15–30 minutes after your chosen time (they are sent on a schedule).</p>}
      {status && (
        <p className={status.ok ? 'small' : 'error'} role="status" style={status.ok ? { color: 'var(--good)' } : undefined}>
          {status.text}
        </p>
      )}
    </section>
  )
}
