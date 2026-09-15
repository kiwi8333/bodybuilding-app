// Choreography for every exercise level. Each movement defines named poses
// ('top', 'bottom', optional 'half', plus special ones for dead bugs and
// planks), the props it needs, and the words shown during each phase.
// Timing comes from data/tempo.js.

import { LEG, BONES, blendPoses, circleIntersectUpper, straightBody } from './rig.js'

// ---------- Shared building blocks ----------

const STAND = { hip: [80, 57], torso: 0, footN: [82, 107], footF: [79, 107], knee: [1, -0.2] }
const HANG = { handN: [81, 57], handF: [79, 57], elbow: [0, 1] }
// Lying on the back, head to the left, knees bent, feet flat.
const SUPINE = { hip: [72, 103], torso: -90, head: -90, footN: [98, 107], footF: [95, 107], knee: [0, -1] }

const BODY_TO_SHOULDER = LEG + BONES.torso - 0.5 // straight body, tiny knee softness

function withHalf(poses) {
  return poses.half ? poses : { ...poses, half: blendPoses(poses.top, poses.bottom, 0.5) }
}

// Push-up family: ankle and hands stay planted; arms straight at the top,
// chest close to the hands at the bottom.
function pushupPoses(ankle, hands, toe = 180) {
  const base = {
    footN: ankle,
    footF: [ankle[0] - 1.5, ankle[1]],
    toe,
    knee: [0, -1],
    handN: hands,
    handF: [hands[0] - 2, hands[1]],
    elbow: [-1, -0.4],
    space: { handN: 'world', handF: 'world' },
  }
  const topShoulder = circleIntersectUpper(ankle, BODY_TO_SHOULDER, hands, BONES.upperArm + BONES.forearm - 0.5)
  const bottomShoulder = circleIntersectUpper(ankle, BODY_TO_SHOULDER, hands, 12)
  return withHalf({
    top: { ...base, ...straightBody(ankle, topShoulder) },
    bottom: { ...base, ...straightBody(ankle, bottomShoulder) },
  })
}

// Plank family: forearms on the floor (or hands, for the lever variation),
// a gentle breathing movement between two nearly identical poses.
function plankPoses(ankle, shoulder, hand, toe = 180) {
  const base = {
    footN: ankle,
    footF: [ankle[0] - 1.5, ankle[1]],
    toe,
    knee: [0, -1],
    handN: hand,
    handF: [hand[0] - 2, hand[1]],
    elbow: [-0.3, 1],
    space: { handN: 'world', handF: 'world' },
  }
  return {
    holdA: { ...base, ...straightBody(ankle, shoulder) },
    holdB: { ...base, ...straightBody(ankle, [shoulder[0], shoulder[1] - 0.8]) },
  }
}

function ankleForShoulder(shoulder, ankleY) {
  return [shoulder[0] - Math.sqrt(BODY_TO_SHOULDER ** 2 - (ankleY - shoulder[1]) ** 2), ankleY]
}

// ---------- Movements ----------

function squat({ front }) {
  // Elbows point down under the weight, in front of the body.
  const hands = front
    ? { top: [[87, 27], [85, 27]], bottom: [[88, 61], [86, 61]], db: 'hands', elbowTop: [1, 1], elbowBottom: [1, 1] }
    : { top: [[88, 36], [87, 36]], bottom: [[90, 69], [89, 69]], db: 'goblet', elbowTop: [0.2, 1], elbowBottom: [0.6, 1] }
  return {
    props: [],
    labels: { lower: 'Sit down between your heels', pause: 'Pause at the bottom, no bounce', lift: 'Stand up, push the floor away' },
    poses: withHalf({
      top: { ...STAND, hip: [78, 57], torso: 4, handN: hands.top[0], handF: hands.top[1], elbow: hands.elbowTop, db: hands.db },
      bottom: { ...STAND, hip: [64, 86], torso: 32, knee: [1, -0.4], handN: hands.bottom[0], handF: hands.bottom[1], elbow: hands.elbowBottom, db: hands.db },
    }),
  }
}

function splitSquat() {
  // Back foot on its ball (heel up, ankle raised) so the back knee hovers just
  // above the floor at the bottom instead of the shin lying flat.
  const common = { footN: [96, 107], footF: [58, 100], toeF: 150, kneeN: [1, -0.3], kneeF: [1, 0.3], elbow: [0, 1], db: 'hands' }
  return {
    props: [],
    labels: { lower: 'Drop the back knee straight down', lift: 'Drive up through the front foot' },
    poses: withHalf({
      top: { ...common, hip: [78, 60], torso: 0, handN: [79, 60], handF: [77, 60] },
      bottom: { ...common, hip: [78, 80], torso: 0, handN: [79, 80], handF: [77, 80] },
    }),
  }
}

function reverseLunge() {
  const arms = { elbow: [0, 1], db: 'hands' }
  return {
    props: [],
    labels: { lower: 'Step back and lower', lift: 'Push through the front heel to return' },
    via: { 'top>bottom': 'step', 'bottom>top': 'step' },
    poses: withHalf({
      top: { ...STAND, ...arms, handN: [81, 57], handF: [79, 57], kneeN: [1, -0.2], kneeF: [1, -0.2] },
      step: { ...STAND, ...arms, hip: [74, 62], footF: [60, 97], toeF: 120, handN: [75, 62], handF: [73, 62], kneeN: [1, -0.2], kneeF: [1, 0.3] },
      bottom: { ...STAND, ...arms, hip: [66, 80], footF: [46, 100], toeF: 150, handN: [67, 80], handF: [65, 80], kneeN: [1, -0.3], kneeF: [1, 0.3] },
    }),
  }
}

function bulgarian() {
  const common = { footN: [100, 107], footF: [50, 82], toeF: -90, kneeN: [1, -0.3], kneeF: [1, 0.5], elbow: [0, 1], db: 'hands' }
  return {
    props: [{ type: 'chair', x: 28, seatY: 84, facing: 'left' }],
    labels: { lower: 'Lower straight down, slight forward lean', lift: 'Drive up through the front foot' },
    poses: withHalf({
      top: { ...common, hip: [82, 60], torso: 6, handN: [86, 60], handF: [84, 60] },
      bottom: { ...common, hip: [80, 82], torso: 14, handN: [89, 83], handF: [87, 83] },
    }),
  }
}

function rdl({ stance }) {
  const feet =
    stance === 'single'
      ? null
      : stance === 'kickstand'
        ? { footN: [82, 107], footF: [70, 106], toeF: 125 }
        : { footN: [82, 107], footF: [79, 107] }
  if (feet) {
    return {
      props: [],
      labels: { lower: 'Push hips back, slide the weights down', pause: 'Feel the hamstring stretch', lift: 'Squeeze glutes, stand tall' },
      poses: withHalf({
        top: { ...feet, hip: [80, 57], torso: 0, knee: [1, 0], handN: [83, 58], handF: [81, 58], elbow: [0, 1], db: 'hands' },
        bottom: { ...feet, hip: [62, 60], torso: 75, knee: [1, 0], handN: [92, 83], handF: [90, 83], elbow: [0, 1], db: 'hands' },
      }),
    }
  }
  return {
    props: [],
    labels: { lower: 'Hinge on one leg, free leg reaches back', lift: 'Squeeze the standing glute to rise' },
    poses: withHalf({
      top: { hip: [80, 57], torso: 0, footN: [82, 107], footF: [74, 99], toeF: 120, knee: [1, 0], kneeF: [1, 0.5], handN: [83, 58], handF: [81, 58], elbow: [0, 1], db: 'hands', space: { footF: 'hip' } },
      bottom: { hip: [66, 60], torso: 78, footN: [82, 107], footF: [20, 68], toeF: 180, knee: [1, 0], kneeF: [0, 1], handN: [97, 85], handF: [95, 85], elbow: [0, 1], db: 'hands', space: { footF: 'hip' } },
    }),
  }
}

function gluteBridge({ singleLeg, sofa }) {
  const labels = { lift: 'Drive through the heel, hips up', hold: 'Squeeze glutes at the top', lower: 'Lower under control' }
  if (sofa) {
    return {
      props: [{ type: 'sofa', x: 2, w: 42, topY: 78 }],
      labels,
      poses: withHalf({
        bottom: { hip: [62, 100], torso: -47.8, footN: [96, 107], footF: [74, 67], knee: [0, -1], kneeF: [-1, -1], handN: [50, 88], handF: [48, 88], elbow: [0, 1], db: 'hip', space: { footF: 'hip' } },
        top: { hip: [72, 80], torso: -90, footN: [96, 107], footF: [84, 47], knee: [0, -1], kneeF: [-1, -1], handN: [52, 90], handF: [50, 90], elbow: [0, 1], db: 'hip', space: { footF: 'hip' } },
      }),
    }
  }
  const far = singleLeg ? { footF: [84, 70], kneeF: [-1, -1], space: { handN: 'world', handF: 'world', footF: 'hip' } } : { space: { handN: 'world', handF: 'world' } }
  return {
    props: [],
    labels,
    poses: withHalf({
      // Arms lie flat along the floor, palms down, steadying the dumbbell.
      bottom: { ...SUPINE, ...far, handN: [72, 106], handF: [70, 106], elbow: [0, -1], db: 'hip' },
      top: { ...SUPINE, ...far, hip: [70, 86], torso: -119.6, footF: singleLeg ? [82, 53] : SUPINE.footF, handN: [72, 106], handF: [70, 106], elbow: [0, -1], db: 'hip' },
    }),
  }
}

function pushup(variant) {
  const labels = { lower: 'Lower your chest, body in one line', pause: 'Pause just above the surface', lift: 'Press away to straight arms' }
  if (variant === 'counter') return { props: [{ type: 'counter', x: 90, topY: 62 }], labels, poses: pushupPoses([24, 103], [96, 62]) }
  if (variant === 'chair') return { props: [{ type: 'chair', x: 88, seatY: 86, facing: 'right' }], labels, poses: pushupPoses([10, 103], [98, 86]) }
  if (variant === 'feet-elevated') return { props: [{ type: 'chair', x: 6, seatY: 86, facing: 'left' }], labels, poses: pushupPoses([22, 79], [100, 107]) }
  return { props: [], labels, poses: pushupPoses([17, 103], [95, 107]) }
}

function plank(variant) {
  const labels = {}
  if (variant === 'long-lever') {
    const shoulder = [93, 91.6]
    return { props: [], labels, poses: plankPoses(ankleForShoulder(shoulder, 103), shoulder, [118, 106]) }
  }
  if (variant === 'feet-elevated') {
    const shoulder = [99, 89]
    return { props: [{ type: 'chair', x: 2, seatY: 86, facing: 'left' }], labels, poses: plankPoses(ankleForShoulder(shoulder, 79), shoulder, [116, 106]) }
  }
  const shoulder = [91, 89]
  return { props: [], labels, poses: plankPoses(ankleForShoulder(shoulder, 103), shoulder, [108, 106]) }
}

function floorPress() {
  const base = { ...SUPINE, db: 'hands' }
  return {
    props: [],
    labels: { lower: 'Lower until upper arms touch the floor', pause: 'Rest arms on the floor, stay tight', lift: 'Press straight up' },
    poses: withHalf({
      top: { ...base, handN: [46, 71], handF: [44, 71], elbow: [1, 0.5] },
      bottom: { ...base, handN: [57, 88], handF: [55, 88], elbow: [1, 1] },
    }),
  }
}

function oneArmRow() {
  const base = { hip: [60, 57], torso: 80, footN: [64, 107], footF: [50, 107], knee: [1, 0], handF: [106, 80], elbowF: [1, 1], db: 'handN', space: { handF: 'world' } }
  return {
    props: [{ type: 'chair', x: 98, seatY: 80, facing: 'right' }],
    labels: { lift: 'Pull the dumbbell to your hip', hold: 'Squeeze the shoulder blade back', lower: 'Lower to a full stretch' },
    poses: withHalf({
      bottom: { ...base, handN: [93, 83], elbowN: [-0.3, 1] },
      top: { ...base, handN: [74, 62], elbowN: [-0.4, -1] },
    }),
  }
}

function bentOverRow() {
  const base = { hip: [66, 57], torso: 45, footN: [80, 107], footF: [77, 107], knee: [1, 0], db: 'hands' }
  return {
    props: [],
    labels: { lift: 'Row both dumbbells to your lower ribs', hold: 'Pinch shoulder blades together', lower: 'Lower under control, torso still' },
    poses: withHalf({
      bottom: { ...base, handN: [90, 66], handF: [88, 66], elbow: [-0.3, 1] },
      top: { ...base, handN: [76, 50], handF: [74, 50], elbow: [-1, -0.6] },
    }),
  }
}

function shoulderPress() {
  return {
    props: [],
    labels: { lift: 'Press up until arms are straight', lower: 'Lower back to your shoulders' },
    poses: withHalf({
      bottom: { ...STAND, handN: [87, 27], handF: [85, 27], elbow: [0.2, 1], db: 'hands' },
      top: { ...STAND, handN: [82, -7], handF: [80, -7], elbow: [0.2, 1], db: 'hands' },
    }),
  }
}

function curl() {
  return {
    props: [],
    labels: { lift: 'Curl up, elbows pinned to your sides', lower: 'Lower all the way to straight arms' },
    poses: withHalf({
      bottom: { ...STAND, ...HANG, handN: [82, 57], handF: [80, 57], elbow: [-0.4, 1], db: 'hands' },
      top: { ...STAND, handN: [90, 30], handF: [88, 30], elbow: [-0.4, 1], db: 'hands' },
    }),
  }
}

function tricepsExtension() {
  return {
    props: [],
    labels: { lower: 'Lower behind your head, elbows forward', lift: 'Extend back up' },
    poses: withHalf({
      top: { ...STAND, handN: [81, -8], handF: [80, -8], elbow: [0.3, -1], db: 'goblet' },
      bottom: { ...STAND, handN: [70, 12], handF: [69, 12], elbow: [0.4, -1], db: 'goblet' },
    }),
  }
}

function deadBug(variant) {
  const legsSpace = { footN: 'hip', footF: 'hip' }
  const bent = { footN: [98, 77], footF: [96, 77] }
  const straightUp = { footN: [74, 51], footF: [72, 51] }
  const legsStart = variant === 'straight' ? straightUp : bent
  const weighted = variant === 'weighted'
  const start = {
    ...SUPINE,
    ...legsStart,
    handN: [42, 70],
    handF: weighted ? [42, 70] : [44, 70],
    elbow: [0, -1],
    db: weighted ? 'goblet' : undefined,
    space: legsSpace,
  }
  return {
    props: [],
    labels: {},
    poses: {
      start,
      reachA: { ...start, handN: weighted ? start.handN : [8, 98], footF: [123, 98] },
      reachB: { ...start, handF: weighted ? start.handF : [8, 98], footN: [123, 98] },
    },
  }
}

function lateralRaise() {
  return {
    view: 'front',
    props: [],
    labels: { lift: 'Raise out to shoulder height, lead with elbows', hold: 'Pause at shoulder height', lower: 'Lower slowly' },
    poses: withHalfFront({ bottom: { arm: 12 }, top: { arm: 86 } }),
  }
}

function withHalfFront(poses) {
  return { ...poses, half: { arm: (poses.top.arm + poses.bottom.arm) / 2 } }
}

// ---------- Swap movements ----------

function boxSquat() {
  const feet = { footN: [86, 107], footF: [83, 107], knee: [1, -0.4] }
  return {
    props: [{ type: 'chair', x: 34, seatY: 84, facing: 'left' }],
    labels: { lower: 'Sit back to the chair', pause: 'Touch lightly, stay tight', lift: 'Stand up tall' },
    poses: withHalf({
      top: { ...feet, hip: [82, 57], torso: 4, handN: [92, 36], handF: [91, 36], elbow: [0.2, 1], db: 'goblet' },
      bottom: { ...feet, hip: [62, 80], torso: 30, handN: [87, 62], handF: [86, 62], elbow: [0.6, 1], db: 'goblet' },
    }),
  }
}

function kneePushup() {
  const kneeOnFloor = [40, 107]
  const hands = [95, 107]
  const thighPlusTorso = BONES.thigh + BONES.torso - 0.5
  const base = {
    footN: [16, 97],
    footF: [15, 97],
    toe: -110,
    knee: [0, 1],
    handN: hands,
    handF: [hands[0] - 2, hands[1]],
    elbow: [-1, -0.4],
    space: { handN: 'world', handF: 'world' },
  }
  const top = circleIntersectUpper(kneeOnFloor, thighPlusTorso, hands, BONES.upperArm + BONES.forearm - 0.5)
  const bottom = circleIntersectUpper(kneeOnFloor, thighPlusTorso, hands, 12)
  return {
    props: [],
    labels: { lower: 'Lower your chest, knees down, body straight', lift: 'Press away to straight arms' },
    poses: withHalf({
      top: { ...base, ...straightBody(kneeOnFloor, top) },
      bottom: { ...base, ...straightBody(kneeOnFloor, bottom) },
    }),
  }
}

function kneeSupportedRow() {
  const base = {
    hip: [66, 64],
    torso: 75,
    footN: [48, 107],
    footF: [86, 107],
    kneeN: [1, 0],
    kneeF: [1, 0],
    handF: [88, 80],
    elbowF: [1, 0.5],
    db: 'handN',
    space: { handF: 'world' },
  }
  return {
    props: [],
    labels: { lift: 'Pull the dumbbell to your hip', hold: 'Squeeze the shoulder blade back', lower: 'Lower to a full stretch' },
    poses: withHalf({
      bottom: { ...base, handN: [97, 87], elbowN: [-0.3, 1] },
      top: { ...base, handN: [80, 68], elbowN: [-0.4, -1] },
    }),
  }
}

function lyingTricepsExtension() {
  const base = { ...SUPINE, db: 'goblet' }
  return {
    props: [],
    labels: { lower: 'Bend at the elbows, lower beside your head', lift: 'Extend straight up' },
    poses: withHalf({
      top: { ...base, handN: [42, 70], handF: [42, 70], elbow: [0.3, -1] },
      // Upper arm stays vertical (elbow ≈ above the shoulder); only the forearm drops back.
      bottom: { ...base, handN: [26, 90], handF: [26, 90], elbow: [0.3, -1] },
    }),
  }
}

function heelTaps() {
  const start = {
    ...SUPINE,
    footN: [98, 77],
    footF: [96, 77],
    handN: [42, 70],
    handF: [44, 70],
    elbow: [0, -1],
    space: { footN: 'hip', footF: 'hip' },
  }
  return {
    props: [],
    labels: { reachA: 'Lower one heel to tap the floor', reachB: 'Other heel' },
    poses: {
      start,
      reachA: { ...start, footF: [94, 107] },
      reachB: { ...start, footN: [96, 107] },
    },
  }
}

function inclinePlank() {
  const shoulder = [111, 62]
  return {
    props: [{ type: 'sofa', x: 104, w: 46, topY: 80, back: 'right' }],
    labels: {},
    poses: plankPoses(ankleForShoulder(shoulder, 103), shoulder, [128, 79]),
  }
}

function partialLateralRaise() {
  return {
    view: 'front',
    props: [],
    labels: { lift: 'Raise out to about 60°', lower: 'Lower slowly' },
    poses: withHalfFront({ bottom: { arm: 12 }, top: { arm: 60 } }),
  }
}

// ---------- Mobility movements ----------

const breathe = { holdA: 'Relax into the stretch', holdB: 'Breathe out slowly' }

function armReach() {
  return {
    props: [],
    labels: { lift: 'Reach straight arms overhead', lower: 'Lower slowly' },
    poses: withHalf({
      // Both hands start just in front of the thighs so both arms sweep forward
      // and up together (a hand behind the vertical would swing backwards).
      bottom: { ...STAND, handN: [84, 57], handF: [83, 57], elbow: [0, 1] },
      top: { ...STAND, handN: [82, -7], handF: [80, -7], elbow: [0, 1] },
    }),
  }
}

function deepSquatHold() {
  const base = { footN: [84, 107], footF: [81, 107], knee: [1, -0.4], torso: 28, handN: [86, 71], handF: [85, 71], elbow: [1, 1] }
  return {
    props: [],
    labels: breathe,
    poses: { holdA: { ...base, hip: [64, 90] }, holdB: { ...base, hip: [64, 89] } },
  }
}

function hipFlexorStretch() {
  const base = {
    torso: 0,
    footN: [100, 107],
    kneeN: [1, -0.3],
    footF: [52, 107],
    toeF: -90,
    kneeF: [1, 0.3],
    elbow: [-1, 0],
  }
  return {
    props: [],
    labels: { holdA: 'Squeeze the back glute', holdB: 'Shift hips forward, breathe' },
    poses: {
      holdA: { ...base, hip: [80, 84], handN: [84, 80], handF: [82, 80] },
      holdB: { ...base, hip: [82, 84], handN: [86, 80], handF: [84, 80] },
    },
  }
}

function hamstringStretch() {
  const base = { footN: [82, 107], footF: [79, 107], knee: [1, 0], hip: [62, 60], elbow: [0, 1] }
  return {
    props: [],
    labels: breathe,
    poses: {
      holdA: { ...base, torso: 75, handN: [92, 85], handF: [90, 85] },
      holdB: { ...base, torso: 78, handN: [95, 86], handF: [93, 86] },
    },
  }
}

function bridgeHold() {
  const top = gluteBridge({}).poses.top
  const clean = { ...top, db: undefined }
  return {
    props: [],
    labels: { holdA: 'Hips up, glutes squeezed', holdB: 'Breathe, keep squeezing' },
    poses: { holdA: clean, holdB: { ...clean, hip: [70, 85] } },
  }
}

// ---------- Level → movement ----------

const BY_LEVEL = {
  'goblet-squat': () => squat({ front: false }),
  'double-db-front-squat': () => squat({ front: true }),
  'tempo-front-squat': () => squat({ front: true }),
  'one-and-half-front-squat': () => squat({ front: true }),
  'split-squat': splitSquat,
  'reverse-lunge': reverseLunge,
  'rear-foot-elevated-split-squat': bulgarian,
  'tempo-bulgarian-split-squat': bulgarian,
  'db-romanian-deadlift': () => rdl({ stance: 'both' }),
  'tempo-romanian-deadlift': () => rdl({ stance: 'both' }),
  'b-stance-romanian-deadlift': () => rdl({ stance: 'kickstand' }),
  'single-leg-romanian-deadlift': () => rdl({ stance: 'single' }),
  'db-glute-bridge': () => gluteBridge({}),
  'single-leg-glute-bridge': () => gluteBridge({ singleLeg: true }),
  'single-leg-hip-thrust': () => gluteBridge({ sofa: true }),
  'counter-incline-pushup': () => pushup('counter'),
  'chair-incline-pushup': () => pushup('chair'),
  'floor-pushup': () => pushup('floor'),
  'tempo-pushup': () => pushup('floor'),
  'feet-elevated-pushup': () => pushup('feet-elevated'),
  'db-floor-press': floorPress,
  'pause-floor-press': floorPress,
  'one-and-half-floor-press': floorPress,
  'one-arm-row': oneArmRow,
  'tempo-one-arm-row': oneArmRow,
  'high-rep-one-arm-row': oneArmRow,
  'db-bent-over-row': bentOverRow,
  'pause-bent-over-row': bentOverRow,
  'one-and-half-bent-over-row': bentOverRow,
  'standing-db-shoulder-press': shoulderPress,
  'tempo-shoulder-press': shoulderPress,
  'one-and-half-shoulder-press': shoulderPress,
  'db-lateral-raise': lateralRaise,
  'tempo-lateral-raise': lateralRaise,
  'db-curl': curl,
  'tempo-curl': curl,
  'overhead-triceps-extension': tricepsExtension,
  'tempo-overhead-triceps-extension': tricepsExtension,
  'dead-bug': () => deadBug('bent'),
  'straight-leg-dead-bug': () => deadBug('straight'),
  'weighted-dead-bug': () => deadBug('weighted'),
  'forearm-plank': () => plank('forearm'),
  'long-lever-plank': () => plank('long-lever'),
  'feet-elevated-plank': () => plank('feet-elevated'),
  // swaps
  'goblet-box-squat': boxSquat,
  'knee-pushup': kneePushup,
  'knee-supported-row': kneeSupportedRow,
  'partial-lateral-raise': partialLateralRaise,
  'lying-triceps-extension': lyingTricepsExtension,
  'heel-taps': heelTaps,
  'incline-plank': inclinePlank,
  // mobility
  'mob-arm-reach': armReach,
  'mob-deep-squat': deepSquatHold,
  'mob-hip-flexor': hipFlexorStretch,
  'mob-hamstring': hamstringStretch,
  'mob-bridge-hold': bridgeHold,
}

const cache = new Map()

export function movementFor(levelId) {
  if (!cache.has(levelId)) {
    const build = BY_LEVEL[levelId]
    if (!build) throw new Error(`No demo for ${levelId}`)
    cache.set(levelId, { view: 'side', ...build() })
  }
  return cache.get(levelId)
}

export function hasMovement(levelId) {
  return Boolean(BY_LEVEL[levelId])
}
