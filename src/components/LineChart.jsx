import { useId, useMemo, useRef, useState } from 'react'
import { formatDate } from '../lib/format.js'

// Single-series line chart: 2px line, 8px markers, hairline grid,
// crosshair + tooltip snapping to the nearest point (pointer and keyboard),
// and a table view so no value is hover-only.
const W = 340
const H = 180
const PAD = { top: 16, right: 14, bottom: 26, left: 40 }

function niceTicks(min, max, count = 4) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05)
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

export default function LineChart({ points, title, unit, formatY = (v) => `${v}${unit}`, detail }) {
  const [active, setActive] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const svgRef = useRef(null)
  const titleId = useId()

  const geo = useMemo(() => {
    if (!points.length) return null
    const times = points.map((p) => new Date(`${p.date}T00:00:00`).getTime())
    const ys = points.map((p) => p.y)
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
    const yMin = ticks[0]
    const yMax = ticks.at(-1)
    const tMin = Math.min(...times)
    const tMax = Math.max(...times)
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (t) => (tMax === tMin ? PAD.left + innerW / 2 : PAD.left + ((t - tMin) / (tMax - tMin)) * innerW)
    const y = (v) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH
    const coords = points.map((p, i) => ({ x: x(times[i]), y: y(p.y) }))
    return { coords, ticks, y, innerH }
  }, [points])

  if (!points.length) return <p className="hint">No data yet.</p>

  const { coords, ticks, y } = geo
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const firstLabel = formatDate(points[0].date, { day: 'numeric', month: 'short' })
  const lastLabel = formatDate(points.at(-1).date, { day: 'numeric', month: 'short' })

  function nearest(clientX) {
    const rect = svgRef.current.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * W
    let best = 0
    coords.forEach((c, i) => {
      if (Math.abs(c.x - vx) < Math.abs(coords[best].x - vx)) best = i
    })
    return best
  }

  function onKey(e) {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const a = active !== null ? coords[active] : null
  const tipLeft = a ? `${Math.min(Math.max((a.x / W) * 100, 18), 82)}%` : 0

  return (
    <div className="stack">
      <div className="chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerDown={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          <title id={titleId}>{`${title}: ${points.length} ${points.length === 1 ? 'entry' : 'entries'}, latest ${formatY(points.at(-1).y)}`}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--chart-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--chart-axis)" strokeWidth="1" />
          <text x={PAD.left} y={H - 8} fontSize="10" fill="var(--chart-muted)">
            {firstLabel}
          </text>
          {points.length > 1 && (
            <text x={W - PAD.right} y={H - 8} fontSize="10" textAnchor="end" fill="var(--chart-muted)">
              {lastLabel}
            </text>
          )}
          {a && <line x1={a.x} x2={a.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--chart-axis)" strokeWidth="1" />}
          <path d={path} fill="none" stroke="var(--chart-series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={i === active ? 5 : 4} fill="var(--chart-series)" stroke="var(--chart-surface)" strokeWidth="2" />
          ))}
        </svg>
        {a && (
          <div className="chart-tip" style={{ left: tipLeft, transform: 'translateX(-50%)' }}>
            <strong>{formatY(points[active].y)}</strong>
            <span className="muted">{formatDate(points[active].date)}</span>
            {detail && <div className="muted">{detail(points[active])}</div>}
          </div>
        )}
      </div>
      <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? 'Hide table' : 'Show as table'}
      </button>
      {showTable && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>{title}</th>
                {detail && <th>Detail</th>}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p, i) => (
                <tr key={`${p.date}-${i}`}>
                  <td>{formatDate(p.date)}</td>
                  <td>{formatY(p.y)}</td>
                  {detail && <td>{detail(p)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
