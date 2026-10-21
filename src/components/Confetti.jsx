import { useEffect, useMemo, useState } from 'react'

const COLORS = ['var(--accent)', 'var(--good)', '#ffd166', '#ff9a4d', '#f4f4f2']

// A one-off burst of confetti falling over the screen. Purely decorative:
// hidden from screen readers, ignores taps, and switched off by the
// reduce-motion setting (see styles.css).
export default function Confetti({ pieces = 36 }) {
  const [on, setOn] = useState(true)
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 400),
        drift: Math.round((Math.random() - 0.5) * 160),
        spin: Math.round(360 + Math.random() * 540),
        color: COLORS[i % COLORS.length],
        w: 6 + Math.round(Math.random() * 5),
      })),
    [pieces],
  )
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 2800)
    return () => clearTimeout(t)
  }, [])
  if (!on) return null
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.w * 1.6,
            background: b.color,
            animationDelay: `${b.delay}ms`,
            '--drift': `${b.drift}px`,
            '--spin': `${b.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
