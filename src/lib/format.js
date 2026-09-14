export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function formatMinutes(seconds) {
  const m = seconds / 60
  return Number.isInteger(m) ? `${m} min` : `${Math.floor(m)} min ${Math.round(seconds % 60)} s`
}

export function formatDate(isoOrKey, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  // YYYY-MM-DD keys are local dates; parse them as local, not UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey) ? new Date(`${isoOrKey}T00:00:00`) : new Date(isoOrKey)
  return d.toLocaleDateString(undefined, opts)
}
