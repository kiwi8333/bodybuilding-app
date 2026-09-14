import { repPhases } from '../data/tempo.js'
import { blendPoses } from './rig.js'
import { movementFor } from './movements.js'

const easeInOut = (t) => 0.5 - Math.cos(Math.PI * t) / 2

function blendFront(a, b, t) {
  return { arm: a.arm + (b.arm - a.arm) * t }
}

/**
 * The full animation script for one exercise level.
 * Moves between poses that have a `via` pose (e.g. the reverse-lunge step)
 * are split in two so the body travels through it.
 */
export function buildTimeline(levelId) {
  const movement = movementFor(levelId)
  const phases = repPhases(levelId, movement.labels)
  const steps = []
  let from = phases.at(-1).to
  for (const phase of phases) {
    const via = movement.via?.[`${from}>${phase.to}`]
    if (via && from !== phase.to) {
      steps.push({ from, to: via, seconds: phase.seconds * 0.4, label: phase.label })
      steps.push({ from: via, to: phase.to, seconds: phase.seconds * 0.6, label: phase.label })
    } else {
      steps.push({ from, to: phase.to, seconds: phase.seconds, label: phase.label })
    }
    from = phase.to
  }
  const total = steps.reduce((sum, s) => sum + s.seconds, 0)
  return { movement, steps, total }
}

/**
 * Vertical window that fits everything the demo ever draws (figure through
 * the whole rep, dumbbells and props), so floor exercises are not a thin strip
 * at the bottom of a tall empty frame. Returns { y, h } in rig units.
 */
export function verticalBounds(timeline, { skeleton, FLOOR_Y, VIEWBOX, headRadius }) {
  let top = FLOOR_Y
  const samples = 48
  for (let i = 0; i < samples; i++) {
    const { pose } = frameAt(timeline, (timeline.total * i) / samples)
    if (timeline.movement.view === 'front') {
      top = Math.min(top, 4)
      continue
    }
    const sk = skeleton(pose)
    for (const [name, p] of Object.entries(sk)) {
      const reach = name === 'head' ? headRadius : name.startsWith('wrist') ? 9 : 3
      top = Math.min(top, p[1] - reach)
    }
  }
  for (const prop of timeline.movement.props) {
    if (prop.type === 'chair') top = Math.min(top, prop.seatY - 26)
    if (prop.type === 'sofa') top = Math.min(top, prop.topY - 18)
    if (prop.type === 'counter') top = Math.min(top, prop.topY - 3)
  }
  const bottom = FLOOR_Y + 4
  const y = Math.max(VIEWBOX.y, Math.floor(top - 8))
  // Keep at least a 2:1 frame so wide floor exercises don't become slivers.
  const h = Math.max(bottom - y, VIEWBOX.w / 2)
  return { y: Math.min(y, bottom - h), h }
}

// Pose and caption at time t (seconds, any value; loops).
export function frameAt(timeline, t) {
  const { movement, steps, total } = timeline
  let local = ((t % total) + total) % total
  for (const step of steps) {
    if (local <= step.seconds || step === steps.at(-1)) {
      const p = step.seconds > 0 ? Math.min(1, local / step.seconds) : 1
      const a = movement.poses[step.from]
      const b = movement.poses[step.to]
      const eased = easeInOut(p)
      const pose = movement.view === 'front' ? blendFront(a, b, eased) : blendPoses(a, b, eased)
      return { pose, label: step.label, stepSeconds: step.seconds, progress: p }
    }
    local -= step.seconds
  }
  throw new Error('unreachable')
}
