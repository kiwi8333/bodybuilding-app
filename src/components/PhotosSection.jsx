import { useEffect, useRef, useState } from 'react'
import { POSES, addPhoto, compressImage, deletePhoto, listPhotos } from '../store/photos.js'
import { dateKey, makeId } from '../logic/state.js'
import { formatDate } from '../lib/format.js'

export default function PhotosSection() {
  const [photos, setPhotos] = useState(null)
  const [pose, setPose] = useState('front')
  const [date, setDate] = useState(dateKey())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [comparePose, setComparePose] = useState('front')
  const [viewing, setViewing] = useState(null)
  const fileRef = useRef(null)

  const refresh = () =>
    listPhotos()
      .then(setPhotos)
      .catch((err) => {
        setPhotos([])
        setError(err.message)
      })

  useEffect(() => {
    refresh()
  }, [])

  async function onPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await compressImage(file)
      await addPhoto({ id: makeId(), date, pose, dataUrl })
      await refresh()
    } catch (err) {
      setError(err.name === 'QuotaExceededError' ? 'Your phone storage for this app is full. Delete old photos or back up and remove some.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this photo? It cannot be recovered unless it is in a backup.')) return
    try {
      await deletePhoto(id)
      setViewing(null)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const ofPose = (photos ?? []).filter((p) => p.pose === comparePose)
  const first = ofPose[0]
  const latest = ofPose.at(-1)

  return (
    <section className="card">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Progress photos</h2>
        <p className="hint">
          Private: stored only on this phone, never uploaded. Every 2–4 weeks, same spot, same lighting, same time of day, relaxed. The mirror shows change before
          the scale does.
        </p>
      </div>

      <div className="grid-2">
        <label className="field">
          Pose
          <select className="input" value={pose} onChange={(e) => setPose(e.target.value)}>
            {POSES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? 'Saving…' : 'Take or choose photo'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
      {error && <p className="error">{error}</p>}

      {photos === null ? (
        <p className="hint">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="hint">No photos yet.</p>
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Compare pose">
            {POSES.map((p) => (
              <button key={p.id} role="tab" aria-selected={comparePose === p.id} className={comparePose === p.id ? 'on' : ''} onClick={() => setComparePose(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {first && latest && first.id !== latest.id ? (
            <div className="compare">
              <figure>
                <img src={first.dataUrl} alt={`${comparePose} photo from ${formatDate(first.date)}`} />
                <figcaption>First · {formatDate(first.date)}</figcaption>
              </figure>
              <figure>
                <img src={latest.dataUrl} alt={`${comparePose} photo from ${formatDate(latest.date)}`} />
                <figcaption>Latest · {formatDate(latest.date)}</figcaption>
              </figure>
            </div>
          ) : (
            <p className="hint">Add two or more {comparePose} photos to see a side-by-side comparison.</p>
          )}

          <details className="disclosure">
            <summary>All photos ({photos.length})</summary>
            <div className="photo-grid">
              {[...photos].reverse().map((p) => (
                <figure key={p.id}>
                  <button type="button" onClick={() => setViewing(p)} style={{ padding: 0, border: 0, background: 'none', width: '100%', cursor: 'pointer' }} aria-label={`Open ${p.pose} photo from ${formatDate(p.date)}`}>
                    <img src={p.dataUrl} alt="" loading="lazy" />
                  </button>
                  <figcaption>
                    <span>{POSES.find((x) => x.id === p.pose)?.label}</span>
                    <span>{formatDate(p.date, { day: 'numeric', month: 'short' })}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </details>
        </>
      )}

      {viewing && (
        <div className="stack">
          <img src={viewing.dataUrl} alt={`${viewing.pose} photo from ${formatDate(viewing.date)}`} style={{ borderRadius: 10 }} />
          <div className="row between">
            <button className="btn small" onClick={() => setViewing(null)}>
              Close
            </button>
            <button className="btn small danger" onClick={() => remove(viewing.id)}>
              Delete photo
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
