import { useEffect, useState } from 'react'

// A circular progress meter. The arc eases to its new length (CSS), filling
// from empty when it first appears, and `tone` switches the colour: 'accent',
// 'good' or 'warn'. `linear` is for countdowns that update every tick.
export default function ProgressRing({ value, max, size = 44, stroke = 5, tone = 'accent', color, label, linear = false, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const [shown, setShown] = useState(linear)
  useEffect(() => {
    if (shown) return undefined
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [shown])
  const drawn = shown ? pct : 0
  return (
    <span
      className={`ring ring-${tone} ${linear ? 'ring-linear' : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
      aria-valuenow={label ? value : undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - drawn)}
          style={{ opacity: drawn > 0 ? 1 : 0, stroke: color }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <span className="ring-center">{children}</span>}
    </span>
  )
}
