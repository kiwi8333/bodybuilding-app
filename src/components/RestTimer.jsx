import { useEffect, useRef } from 'react'
import { useNow } from './useNow.js'
import { alertDone } from '../lib/alerts.js'
import { formatClock } from '../lib/format.js'
import ProgressRing from './ProgressRing.jsx'

export default function RestTimer({ timer, onAdjust, onClose }) {
  const now = useNow(Boolean(timer))
  const alerted = useRef(null)
  const remaining = timer ? Math.ceil((timer.endAt - now) / 1000) : 0
  const finished = Boolean(timer) && remaining <= 0

  useEffect(() => {
    if (finished && alerted.current !== timer.endAt) {
      alerted.current = timer.endAt
      alertDone()
    }
  }, [finished, timer])

  if (!timer) return null
  const pct = Math.min(100, Math.max(0, (1 - (timer.endAt - now) / (timer.total * 1000)) * 100))

  return (
    <div className="rest-bar" role="timer" aria-live="polite">
      <div className={`rest-inner ${finished ? 'done' : ''}`}>
        <ProgressRing value={finished ? 100 : 100 - pct} max={100} size={44} stroke={5} tone={finished ? 'good' : 'accent'} linear />
        <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
          <span className="time">{finished ? 'Go!' : formatClock(remaining)}</span>
          <span className="small muted">{finished ? 'Next set' : 'Rest'}</span>
        </div>
        {!finished && (
          <button className="btn small" onClick={() => onAdjust(15)} aria-label="Add 15 seconds">
            +15s
          </button>
        )}
        <button className="btn small" onClick={onClose}>
          {finished ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
