import { useEffect, useMemo, useRef, useState } from 'react'
import { BONES, FLOOR_Y, VIEWBOX, skeleton } from '../demo/rig.js'
import { buildTimeline, frameAt, verticalBounds } from '../demo/timeline.js'
import { hasMovement } from '../demo/movements.js'

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const line = (a, b, props) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...props} />

function Prop({ prop }) {
  const fill = 'var(--demo-prop)'
  const stroke = 'var(--demo-prop-edge)'
  if (prop.type === 'chair') {
    const w = 30
    const backX = prop.facing === 'left' ? prop.x : prop.x + w - 3
    return (
      <g>
        <rect x={prop.x} y={prop.seatY} width={w} height={4} rx={1.5} fill={fill} stroke={stroke} strokeWidth={0.6} />
        <rect x={prop.x + 2} y={prop.seatY + 4} width={2.5} height={FLOOR_Y - prop.seatY - 4} fill={fill} />
        <rect x={prop.x + w - 4.5} y={prop.seatY + 4} width={2.5} height={FLOOR_Y - prop.seatY - 4} fill={fill} />
        <rect x={backX} y={prop.seatY - 26} width={3} height={26} rx={1.5} fill={fill} />
      </g>
    )
  }
  if (prop.type === 'counter') {
    return (
      <g>
        <rect x={prop.x} y={prop.topY} width={70} height={FLOOR_Y - prop.topY} fill={fill} stroke={stroke} strokeWidth={0.6} />
        <rect x={prop.x - 3} y={prop.topY - 3} width={76} height={4} rx={1} fill={stroke} />
      </g>
    )
  }
  if (prop.type === 'sofa') {
    return (
      <g>
        <rect x={prop.x} y={prop.topY} width={prop.w} height={FLOOR_Y - prop.topY} rx={4} fill={fill} stroke={stroke} strokeWidth={0.6} />
        <rect x={prop.back === 'right' ? prop.x + prop.w - 10 : prop.x} y={prop.topY - 18} width={10} height={FLOOR_Y - prop.topY + 18} rx={4} fill={fill} stroke={stroke} strokeWidth={0.6} />
      </g>
    )
  }
  return null
}

function Dumbbell({ at, vertical = false }) {
  if (vertical) {
    return (
      <g>
        <rect x={at[0] - 2.2} y={at[1] - 8} width={4.4} height={16} rx={1.5} fill="var(--demo-db)" />
        <rect x={at[0] - 4} y={at[1] - 9} width={8} height={4} rx={1.2} fill="var(--demo-db)" />
        <rect x={at[0] - 4} y={at[1] + 5} width={8} height={4} rx={1.2} fill="var(--demo-db)" />
      </g>
    )
  }
  return <rect x={at[0] - 4.5} y={at[1] - 4.5} width={9} height={9} rx={2.2} fill="var(--demo-db)" />
}

function SideFigure({ pose }) {
  const s = skeleton(pose)
  const limb = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
  const far = { ...limb, stroke: 'var(--demo-far)', strokeWidth: 5 }
  const near = { ...limb, stroke: 'var(--demo-body)', strokeWidth: 5.5 }
  const mid = [(s.wristN[0] + s.wristF[0]) / 2, (s.wristN[1] + s.wristF[1]) / 2]
  return (
    <g>
      {/* far side */}
      <polyline points={[s.hip, s.kneeF, s.ankleF, s.toeF].map((p) => p.join(',')).join(' ')} {...far} />
      <polyline points={[s.shoulder, s.elbowF, s.wristF].map((p) => p.join(',')).join(' ')} {...far} />
      {pose.db === 'hands' && <Dumbbell at={s.wristF} />}
      {/* torso and head */}
      {line(s.hip, s.shoulder, { stroke: 'var(--demo-body)', strokeWidth: 8, strokeLinecap: 'round' })}
      <circle cx={s.head[0]} cy={s.head[1]} r={BONES.head} fill="var(--demo-body)" />
      {pose.db === 'hip' && <Dumbbell at={[s.hip[0], s.hip[1] - 6]} />}
      {/* near side */}
      <polyline points={[s.hip, s.kneeN, s.ankleN, s.toeN].map((p) => p.join(',')).join(' ')} {...near} />
      <polyline points={[s.shoulder, s.elbowN, s.wristN].map((p) => p.join(',')).join(' ')} {...near} />
      {(pose.db === 'hands' || pose.db === 'handN') && <Dumbbell at={s.wristN} />}
      {pose.db === 'goblet' && <Dumbbell at={mid} vertical />}
    </g>
  )
}

function FrontFigure({ pose }) {
  const cx = 80
  const shoulderY = 25
  const hipY = 57
  const arm = BONES.upperArm + BONES.forearm
  const limb = { stroke: 'var(--demo-body)', strokeWidth: 5.5, strokeLinecap: 'round', fill: 'none' }
  const hand = (side) => {
    const a = (pose.arm * Math.PI) / 180
    return [cx + side * (9 + Math.sin(a) * arm), shoulderY + Math.cos(a) * arm]
  }
  const elbow = (side) => {
    const a = (pose.arm * Math.PI) / 180
    return [cx + side * (9 + Math.sin(a) * BONES.upperArm), shoulderY + Math.cos(a) * BONES.upperArm - 1]
  }
  return (
    <g>
      {line([cx - 6, hipY], [cx - 9, 107], limb)}
      {line([cx + 6, hipY], [cx + 9, 107], limb)}
      <rect x={cx - 10} y={shoulderY - 3} width={20} height={hipY - shoulderY + 4} rx={6} fill="var(--demo-body)" />
      <circle cx={cx} cy={shoulderY - 10.5} r={BONES.head} fill="var(--demo-body)" />
      {[-1, 1].map((side) => (
        <g key={side}>
          <polyline points={[[cx + side * 9, shoulderY], elbow(side), hand(side)].map((p) => p.join(',')).join(' ')} {...limb} />
          <Dumbbell at={hand(side)} />
        </g>
      ))}
    </g>
  )
}

/**
 * Looping animated demo of one exercise level, timed to its real tempo.
 * Only runs while mounted and on screen.
 */
export default function ExerciseDemo({ levelId, name }) {
  const timeline = useMemo(() => (hasMovement(levelId) ? buildTimeline(levelId) : null), [levelId])
  const bounds = useMemo(
    () => (timeline ? verticalBounds(timeline, { skeleton, FLOOR_Y, VIEWBOX, headRadius: BONES.head }) : null),
    [timeline],
  )
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [t, setT] = useState(0)
  const [visible, setVisible] = useState(true)
  const ref = useRef(null)
  const clock = useRef({ last: null, t: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!timeline || !playing || !visible) {
      clock.current.last = null
      return undefined
    }
    let raf
    const tick = (now) => {
      const c = clock.current
      if (c.last !== null) c.t += Math.min(0.1, (now - c.last) / 1000)
      c.last = now
      setT(c.t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [timeline, playing, visible])

  if (!timeline) return null
  const frame = frameAt(timeline, t)
  const repLength = Math.round(timeline.total * 10) / 10
  const isFront = timeline.movement.view === 'front'

  return (
    <figure className="demo" ref={ref}>
      <svg viewBox={`${VIEWBOX.x} ${bounds.y} ${VIEWBOX.w} ${bounds.h}`} role="img" aria-label={`Animated demonstration of ${name}`}>
        {timeline.movement.props.map((p, i) => (
          <Prop key={i} prop={p} />
        ))}
        {line([VIEWBOX.x, FLOOR_Y], [VIEWBOX.x + VIEWBOX.w, FLOOR_Y], { stroke: 'var(--demo-floor)', strokeWidth: 1.5 })}
        {isFront ? <FrontFigure pose={frame.pose} /> : <SideFigure pose={frame.pose} />}
      </svg>
      <figcaption className="demo-caption">
        <span className="demo-phase" aria-live="off">
          {frame.label}
        </span>
        <span className="demo-meta">
          {isFront ? 'Front view' : 'Side view'} · one rep ≈ {repLength} s
        </span>
        <div className="progress demo-progress" aria-hidden>
          <span style={{ width: `${(frame.progress * 100).toFixed(1)}%`, transition: 'none' }} />
        </div>
        <button type="button" className="btn small" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
          {playing ? 'Pause demo' : 'Play demo'}
        </button>
      </figcaption>
    </figure>
  )
}
