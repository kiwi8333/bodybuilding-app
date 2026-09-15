import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { availableWeights, formatKg } from '../logic/weights.js'
import { createInitialState, dateKey, markBackedUp, parseFullBackup, serializeBackup, updateCardioSpeeds, updateEquipment } from '../logic/state.js'
import { listPhotos, replaceAllPhotos, validatePhoto } from '../store/photos.js'
import { disablePush } from '../reminders/client.js'
import ReminderSettings from '../components/ReminderSettings.jsx'
import { BodyAndHeartSettings } from '../components/HeartSettings.jsx'

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
  const navigate = useNavigate()
  const onboarded = state.profile.onboarded

  const [name, setName] = useState(state.profile.name)
  const [nameStatus, setNameStatus] = useState(null)
  const [eq, setEq] = useState({ ...state.equipment })
  const [eqStatus, setEqStatus] = useState(null)
  const [speeds, setSpeeds] = useState({ walkSpeed: state.cardio.walkSpeed, jogSpeed: state.cardio.jogSpeed })
  const [speedStatus, setSpeedStatus] = useState(null)
  const [backupStatus, setBackupStatus] = useState(null)
  const [includePhotos, setIncludePhotos] = useState(true)
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
    let photos = null
    if (includePhotos) {
      try {
        photos = await listPhotos()
      } catch (err) {
        return setBackupStatus({ ok: false, text: `Could not read photos: ${err.message}` })
      }
    }
    const text = serializeBackup(state, new Date(), photos)
    const filename = `forge-backup-${dateKey()}.json`
    const blob = new Blob([text], { type: 'application/json' })
    const done = (message) => {
      apply((s) => markBackedUp(s))
      setBackupStatus({ ok: true, text: message })
    }
    try {
      const file = new File([blob], filename, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Forge backup' })
        return done('Backup shared. Choose Google Drive, Save to Files (iCloud) or email so it is stored off this phone.')
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
    done(`Downloaded ${filename}. Move it to Google Drive or iCloud to keep it safe.`)
  }

  async function importBackup(e) {
    setBackupStatus(null)
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 150 * 1024 * 1024) return setBackupStatus({ ok: false, text: 'That file is too large to be a Forge backup.' })
    try {
      const { state: restored, photos } = parseFullBackup(await file.text(), validatePhoto)
      const summary = `${restored.workouts.length} workouts, ${restored.cardioLogs.length} cardio sessions, ${restored.bodyweight.length} bodyweight entries${photos ? `, ${photos.length} photos` : ''}`
      if (!window.confirm(`Replace ALL data on this device with this backup (${summary})? This cannot be undone.`)) return
      // Everything is validated above; photos are written first in a single
      // transaction, then the rest of the data.
      if (photos) await replaceAllPhotos(photos)
      replaceAll(restored)
      // Show the confirmation on Today: restoring can switch the whole app layout
      // (e.g. from the welcome screen), which would drop a message shown here.
      navigate('/', { replace: true, state: { flash: `Restored ${summary}.` } })
    } catch (err) {
      setBackupStatus({ ok: false, text: `Nothing was changed. ${err.message}` })
    }
  }

  async function resetAll() {
    const answer = window.prompt('This deletes every workout, cardio log, food entry, measurement and photo on this device. Type DELETE to confirm.')
    if (answer !== 'DELETE') return
    try {
      if (state.reminders.enabled) await disablePush().catch(() => {})
      await replaceAllPhotos([]).catch(() => {})
      replaceAll(createInitialState())
      // Back to the welcome screen rather than a near-empty Settings page.
      navigate('/', { replace: true })
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

          <ReminderSettings />
          <BodyAndHeartSettings />
        </>
      )}

      <section className="card" id="backup">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Backup</h2>
          <p className="hint">
            Your data lives only on this phone. Tap <strong>Back up now</strong> and choose Google Drive, Save to Files (iCloud Drive) or email in the share menu. To move
            phones, open the file on the new phone with Restore.
          </p>
          <p className="small text-2">
            {state.lastBackupAt ? `Last backup: ${new Date(state.lastBackupAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No backup yet.'}
          </p>
        </div>
        {readOnly && <p className="banner warn small">Saving is paused because stored data could not be read. Restore a backup or reset below.</p>}
        <label className="row small">
          <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
          Include progress photos (larger file)
        </label>
        <div className="grid-2">
          <button className="btn primary" onClick={exportBackup} disabled={!onboarded}>
            Back up now
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
