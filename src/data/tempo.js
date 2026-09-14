// Rep tempo for every exercise level, in seconds. This single source drives
// the tempo text shown to you AND the timing of the demo animation, so what
// you read and what you see can never disagree.
//
// pattern:
//   'lower-first' – the rep starts at the top/extended position
//                   (squat, push-up, RDL, floor press, overhead extension):
//                   lower → [pause at bottom] → lift → [hold at top]
//   'lift-first'  – the rep starts at the bottom/hanging position
//                   (rows, curls, raises, shoulder press, glute bridge):
//                   lift → [hold at top] → lower → [pause at bottom]
//   'alternate'   – dead bugs: reach one side, hold, return, then the other
//   'hold'        – planks
// oneAndHalf: true adds the extra half rep described in the level's cues.

const lowerFirst = (lower, bottom, lift, top = 0) => ({ pattern: 'lower-first', lower, bottom, lift, top })
const liftFirst = (lift, top, lower, bottom = 0) => ({ pattern: 'lift-first', lower, bottom, lift, top })

export const TEMPO = {
  // Squat
  'goblet-squat': lowerFirst(2, 0, 1),
  'double-db-front-squat': lowerFirst(2, 0, 1),
  'tempo-front-squat': lowerFirst(3, 1, 1),
  'one-and-half-front-squat': { ...lowerFirst(2, 0, 1), oneAndHalf: true },
  // Single-leg
  'split-squat': lowerFirst(2, 0, 1),
  'reverse-lunge': lowerFirst(2, 0, 1),
  'rear-foot-elevated-split-squat': lowerFirst(2, 0, 1),
  'tempo-bulgarian-split-squat': lowerFirst(3, 0, 1),
  // Hinge
  'db-romanian-deadlift': lowerFirst(2, 0, 1),
  'tempo-romanian-deadlift': lowerFirst(3, 1, 1),
  'b-stance-romanian-deadlift': lowerFirst(2, 0, 1),
  'single-leg-romanian-deadlift': lowerFirst(2, 0, 1),
  // Glute bridge
  'db-glute-bridge': liftFirst(1, 1, 2),
  'single-leg-glute-bridge': liftFirst(1, 1, 2),
  'single-leg-hip-thrust': liftFirst(1, 1, 2),
  // Push-up
  'counter-incline-pushup': lowerFirst(2, 0, 1),
  'chair-incline-pushup': lowerFirst(2, 0, 1),
  'floor-pushup': lowerFirst(2, 0, 1),
  'tempo-pushup': lowerFirst(3, 1, 1),
  'feet-elevated-pushup': lowerFirst(2, 0, 1),
  // Floor press
  'db-floor-press': lowerFirst(2, 0.5, 1),
  'pause-floor-press': lowerFirst(2, 2, 1),
  'one-and-half-floor-press': { ...lowerFirst(2, 0, 1), oneAndHalf: true },
  // One-arm row
  'one-arm-row': liftFirst(1, 1, 2),
  'tempo-one-arm-row': liftFirst(1, 2, 3),
  'high-rep-one-arm-row': liftFirst(1, 1, 2),
  // Bent-over row
  'db-bent-over-row': liftFirst(1, 1, 2),
  'pause-bent-over-row': liftFirst(1, 2, 2),
  'one-and-half-bent-over-row': { ...liftFirst(1, 0, 2), oneAndHalf: true },
  // Shoulder press
  'standing-db-shoulder-press': liftFirst(1, 0, 2),
  'tempo-shoulder-press': liftFirst(1, 0, 3),
  'one-and-half-shoulder-press': { ...liftFirst(1, 0, 2), oneAndHalf: true },
  // Lateral raise
  'db-lateral-raise': liftFirst(1, 0, 2),
  'tempo-lateral-raise': liftFirst(1, 1, 3),
  // Curl
  'db-curl': liftFirst(1, 0, 2),
  'tempo-curl': liftFirst(1, 0, 3),
  // Triceps
  'overhead-triceps-extension': lowerFirst(2, 0, 1),
  'tempo-overhead-triceps-extension': lowerFirst(3, 0, 1),
  // Dead bug: reach 2 s, hold 1 s, return 2 s (lower = reach, top = hold, lift = return)
  'dead-bug': { pattern: 'alternate', lower: 2, top: 1, lift: 2, bottom: 0 },
  'straight-leg-dead-bug': { pattern: 'alternate', lower: 2, top: 1, lift: 2, bottom: 0 },
  'weighted-dead-bug': { pattern: 'alternate', lower: 2, top: 1, lift: 2, bottom: 0 },
  // Plank
  'forearm-plank': { pattern: 'hold' },
  'long-lever-plank': { pattern: 'hold' },
  'feet-elevated-plank': { pattern: 'hold' },
}

const s = (n) => `${n} s`

// Human-readable tempo, e.g. "2 s down · 1 s up" or "1 s up · 2 s squeeze · 3 s down".
export function tempoText(levelId) {
  const t = TEMPO[levelId]
  if (!t) return ''
  if (t.pattern === 'hold') return 'Hold still, breathe steadily'
  if (t.pattern === 'alternate') return `${s(t.lower)} reach · ${s(t.top)} hold · ${s(t.lift)} return, then switch sides`
  const parts = []
  if (t.pattern === 'lower-first') {
    parts.push(`${s(t.lower)} down`)
    if (t.bottom) parts.push(`${s(t.bottom)} pause`)
    parts.push(`${s(t.lift)} up`)
    if (t.top) parts.push(`${s(t.top)} hold`)
  } else {
    parts.push(`${s(t.lift)} up`)
    if (t.top) parts.push(`${s(t.top)} squeeze`)
    parts.push(`${s(t.lower)} down`)
    if (t.bottom) parts.push(`${s(t.bottom)} pause`)
  }
  return parts.join(' · ') + (t.oneAndHalf ? ' (with the extra half rep)' : '')
}

/**
 * One rep broken into animation phases: [{ to, seconds, label }].
 * `to` is a pose name the demo defines: 'top' | 'half' | 'bottom' |
 * 'start' | 'reachA' | 'reachB' | 'holdA' | 'holdB'.
 * The cycle starts from the pose of the final phase, so it loops seamlessly.
 */
export function repPhases(levelId, labels = {}) {
  const t = TEMPO[levelId]
  if (!t) throw new Error(`No tempo for ${levelId}`)
  const L = { lower: 'Lower', lift: 'Lift', pause: 'Pause', hold: 'Squeeze', ...labels }
  const out = []
  const add = (to, seconds, label) => {
    if (seconds > 0) out.push({ to, seconds, label })
  }

  if (t.pattern === 'hold') {
    add('holdA', 2, 'Brace: glutes and abs tight')
    add('holdB', 2, 'Breathe steadily')
    return out
  }

  if (t.pattern === 'alternate') {
    add('reachA', t.lower, 'Reach opposite arm and leg')
    add('reachA', t.top, 'Hold, lower back flat')
    add('start', t.lift, 'Return')
    add('reachB', t.lower, 'Other side: reach')
    add('reachB', t.top, 'Hold, lower back flat')
    add('start', t.lift, 'Return')
    return out
  }

  if (t.pattern === 'lower-first') {
    if (t.oneAndHalf) {
      add('bottom', t.lower, L.lower)
      add('half', t.lift, 'Halfway up')
      add('bottom', t.lower / 2, 'Back down')
      add('top', t.lift, 'All the way up')
      return out
    }
    add('bottom', t.lower, L.lower)
    add('bottom', t.bottom, L.pause)
    add('top', t.lift, L.lift)
    add('top', t.top, L.hold)
    return out
  }

  // lift-first
  if (t.oneAndHalf) {
    add('top', t.lift, L.lift)
    add('half', t.lower / 2, 'Halfway down')
    add('top', t.lift, 'Back up')
    add('bottom', t.lower, 'All the way down')
    return out
  }
  add('top', t.lift, L.lift)
  add('top', t.top, L.hold)
  add('bottom', t.lower, L.lower)
  add('bottom', t.bottom, L.pause)
  return out
}

export function repSeconds(levelId) {
  return repPhases(levelId).reduce((sum, p) => sum + p.seconds, 0)
}
