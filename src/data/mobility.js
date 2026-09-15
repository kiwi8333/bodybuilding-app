// A 5-minute rest-day mobility routine aimed at what this program needs:
// shoulders for pressing, hips and ankles for squat depth, hamstrings for
// hinges. Gentle stretches only: never force a position into pain.

export const MOBILITY_ROUTINE = [
  {
    id: 'mob-arm-reach',
    name: 'Overhead Arm Reaches',
    seconds: 60,
    cues: ['Stand tall, ribs down.', 'Slowly raise straight arms overhead, reach high, then lower.', 'Opens the shoulders for pressing.'],
  },
  {
    id: 'mob-deep-squat',
    name: 'Deep Squat Hold',
    seconds: 45,
    cues: ['Sit into your deepest comfortable squat, heels down.', 'Hands together at your chest, elbows gently pushing the knees out.', 'Hold a chair for balance if you need to.'],
  },
  {
    id: 'mob-hip-flexor',
    side: 'left',
    name: 'Half-Kneeling Hip Flexor Stretch (left knee down)',
    seconds: 40,
    cues: ['Left knee on a folded towel, right foot forward.', 'Squeeze the left glute and shift your hips slightly forward.', 'Feel the stretch at the front of the left hip.'],
  },
  {
    id: 'mob-hip-flexor',
    side: 'right',
    name: 'Half-Kneeling Hip Flexor Stretch (right knee down)',
    seconds: 40,
    cues: ['Swap legs: right knee down, left foot forward.', 'Glute tight, hips forward, torso tall.'],
  },
  {
    id: 'mob-hamstring',
    name: 'Standing Hamstring Hinge Stretch',
    seconds: 45,
    cues: ['Soft knees, push your hips back, back flat.', 'Let your arms hang and breathe into the back of the legs.'],
  },
  {
    id: 'mob-bridge-hold',
    name: 'Glute Bridge Hold',
    seconds: 30,
    cues: ['Lift your hips and hold, glutes squeezed.', 'Wakes up the glutes after sitting.'],
  },
]

export const TRANSITION_SECONDS = 5

export function mobilitySegments() {
  const out = []
  MOBILITY_ROUTINE.forEach((item, i) => {
    if (i > 0) out.push({ kind: 'transition', seconds: TRANSITION_SECONDS, item })
    out.push({ kind: 'move', seconds: item.seconds, item })
  })
  return out
}

export function mobilityTotalSeconds() {
  return mobilitySegments().reduce((s, seg) => s + seg.seconds, 0)
}
