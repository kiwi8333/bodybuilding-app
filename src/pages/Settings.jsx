import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { availableWeights, formatKg } from '../logic/weights.js'
import { createInitialState, dateKey, parseBackup, serializeBackup, updateCardioSpeeds, updateEquipment } from '../logic/state.js'

function Status({ status }) {
  if (!status) return null
  return (
    <p className={status.ok ? 'small' : 'error'} role="status" style={status.ok ? { color: 'var(--good)' } : undefined}>
      {status.text}
    </p>
  )
}

export default function Settings() {
  const { state, apply, replaceAll, readOnly } = useStore()
  const onboarded = state.profile.onboarded

  const [name, setName] = useState(state.profile.name)
  const [nameStatus, setNameStatus] = useState(null)
  const [eq, setEq] = useState({ ...state.equipment })
  const [eqStatus, setEqStatus] = useState(null)
  const [speeds, setSpeeds] = useState({ walkSpeed: state.cardio.walkSpeed, jogSpeed: state.cardio.jogSpeed })
  const [speedStatus, setSpeedStatus] = useState(null)
  const [backupStatus, setBackupStatus] = useState(null)
  const fileRef = useRef(null)

  let preview = null
  try {
    preview = availableWeights({ minWeight: Number(eq.minWeight), increment: Number(eq.increment), maxWeight: Number(eq.maxWeight) })
  } catch {
    preview = null
  }

  function saveName(e) {
    e.preventDefault()
    apply((s) => ({ ...s, profile: { ...s.profile, name: name.trim().slice(0, 40) } }))
    setNameStatus({ ok: true, text: 'Saved.' })
  }

  function saveEquipment(e) {
    e.preventDefault()
    if (state.activeWorkout) return setEqStatus({ ok: false, text: 'Finish or discard your current workout first.' })
    try {
      apply((s) => updateEquipment(s, eq))
      setEqStatus({ ok: true, text: 'Saved. Suggested weights now use this dumbbell set.' })
    } catch (err) {
      setEqStatus({ ok: false, text: err.message })
    }
  }

  function saveSpeeds(e) {
    e.preventDefault()
    try {
      apply((s) => updateCardioSpeeds(s, speeds))
      setSpeedStatus({ ok: true, text: 'Saved.' })
    } catch (err) {
      setSpeedStatus({ ok: false, text: err.message })
    }
  }

  async function exportBackup() {
    setBackupStatus(null)
    const text = serializeBackup(state)
    const filename = `forge-backup-${dateKey()}.json`
    const blob = new Blob([text], { type: 'application/json' })
    try {
      const file = new File([blob], filename, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Forge backup' })
        setBackupStatus({ ok: true, text: 'Backup shared. Save it to Files, Google Drive or email it to yourself.' })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      // Fall through to a normal download.
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    setBackupStatus({ ok: true, text: `Downloaded ${filename}.` })
  }

  async function importBackup(e) {
    setBackupStatus(null)
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) return setBackupStatus({ ok: false, text: 'That file is too large to be a Forge backup.' })
    try {
      const restored = parseBackup(await file.text())
      const summary = `${restored.workouts.length} workouts, ${restored.cardioLogs.length} cardio sessions, ${restored.bodyweight.length} bodyweight entries`
      if (!window.confirm(`Replace ALL data on this device with this backup (${summary})? This cannot be undone.`)) return
      replaceAll(restored)
      setBackupStatus({ ok: true, text: `Restored ${summary}.` })
      setName(restored.profile.name)
      setEq({ ...restored.equipment })
      setSpeeds({ walkSpeed: restored.cardio.walkSpeed, jogSpeed: restored.cardio.jogSpeed })
    } catch (err) {
      setBackupStatus({ ok: false, text: `Nothing was changed. ${err.message}` })
    }
  }

  function resetAll() {
    const answer = window.prompt('This deletes every workout, cardio log and measurement on this device. Type DELETE to confirm.')
    if (answer !== 'DELETE') return
    try {
      replaceAll(createInitialState())
    } catch (err) {
      setBackupStatus({ ok: false, text: err.message })
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Settings</span>
        <h1>Settings</h1>
      </div>

      {onboarded && (
        <>
          <form className="card" onSubmit={saveName}>
            <h2>Name</h2>
            <div className="row">
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="First name" />
              <button className="btn" type="submit">
                Save
              </button>
            </div>
            <Status status={nameStatus} />
          </form>

          <form className="card" onSubmit={saveEquipment}>
            <div className="stack" style={{ gap: 4 }}>
              <h2>Dumbbells</h2>
              <p className="hint">Bought heavier dumbbells or more plates? Update this and progression continues from where you are.</p>
            </div>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {[
                ['minWeight', 'Lightest'],
                ['increment', 'Jump'],
                ['maxWeight', 'Heaviest'],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  {label} (kg)
                  <input className="input" type="number" inputMode="decimal" step="0.25" value={eq[key]} onChange={(e) => setEq((p) => ({ ...p, [key]: e.target.value }))} required />
                </label>
              ))}
            </div>
            {preview && preview.length > 0 && preview.length <= 60 && <p className="hint">Weights: {preview.map(formatKg).join(', ')}</p>}
            <button className="btn" type="submit">
              Save dumbbells
            </button>
            <Status status={eqStatus} />
          </form>

          <form className="card" onSubmit={saveSpeeds}>
            <h2>Treadmill speeds</h2>
            <div className="grid-2">
              <label className="field">
                Walk (mph)
                <input className="input" type="number" inputMode="decimal" step="0.1" value={speeds.walkSpeed} onChange={(e) => setSpeeds((p) => ({ ...p, walkSpeed: e.target.value }))} required />
              </label>
              <label className="field">
                Jog (mph)
                <input className="input" type="number" inputMode="decimal" step="0.1" value={speeds.jogSpeed} onChange={(e) => setSpeeds((p) => ({ ...p, jogSpeed: e.target.value }))} required />
              </label>
            </div>
            <button className="btn" type="submit">
              Save speeds
            </button>
            <Status status={speedStatus} />
          </form>
        </>
      )}

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Backup</h2>
          <p className="hint">
            Your data lives only on this phone, in this browser. Nothing is uploaded. Export a backup every couple of weeks, and before
            changing phones or clearing browser data.
          </p>
        </div>
        {readOnly && <p className="banner warn small">Saving is paused because stored data could not be read. Restore a backup or reset below.</p>}
        <div className="grid-2">
          <button className="btn" onClick={exportBackup} disabled={!onboarded}>
            Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} hidden />
        <Status status={backupStatus} />
      </section>

      <section className="card">
        <h2>Danger zone</h2>
        <button className="btn danger" onClick={resetAll}>
          Delete all data
        </button>
      </section>

      <p className="hint" style={{ textAlign: 'center' }}>
        Forge v1.0 · General fitness guidance, not medical advice.
      </p>
    </>
  )
}
