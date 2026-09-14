// Treadmill cardio, done straight after lifting (you are already warm).
//
// Phase 1, Run Builder: walk/jog intervals that build to 20 minutes of
// continuous jogging. You move to the next stage after completing the current
// one TWICE at an effort of 7/10 or lower, never just because a week passed.
//
// Phase 2, Fitness: once you can jog 20 minutes, sessions rotate between easy
// runs, intervals and tempo runs to raise aerobic fitness further.
//
// Every session starts with a 1 min walk (lifting already warmed you up) and
// ends with a 2 min cool-down walk.

const WARM = { kind: 'walk', seconds: 60, label: 'Warm-up walk' }
const COOL = { kind: 'walk', seconds: 120, label: 'Cool-down walk' }

function repeat(times, jogSeconds, walkSeconds) {
  const out = []
  for (let i = 0; i < times; i++) {
    out.push({ kind: 'jog', seconds: jogSeconds, label: `Jog ${i + 1}/${times}` })
    // No walk after the final jog; the cool-down follows directly.
    if (i < times - 1) out.push({ kind: 'walk', seconds: walkSeconds, label: 'Recovery walk' })
  }
  return out
}

function stage(id, title, main) {
  return { id, title, segments: [WARM, ...main, COOL] }
}

export const BUILDER_STAGES = [
  stage('b1', '6 × 1 min jog / 1½ min walk', repeat(6, 60, 90)),
  stage('b2', '5 × 1½ min jog / 1½ min walk', repeat(5, 90, 90)),
  stage('b3', '5 × 2 min jog / 1 min walk', repeat(5, 120, 60)),
  stage('b4', '4 × 3 min jog / 1 min walk', repeat(4, 180, 60)),
  stage('b5', '3 × 4 min jog / 1 min walk', repeat(3, 240, 60)),
  stage('b6', '2 × 6 min jog / 1½ min walk', repeat(2, 360, 90)),
  stage('b7', '2 × 8 min jog / 1 min walk', repeat(2, 480, 60)),
  stage('b8', '10 min jog / 1 min walk / 6 min jog', [
    { kind: 'jog', seconds: 600, label: 'Jog 1/2' },
    { kind: 'walk', seconds: 60, label: 'Recovery walk' },
    { kind: 'jog', seconds: 360, label: 'Jog 2/2' },
  ]),
  stage('b9', '16 min continuous jog', [{ kind: 'jog', seconds: 960, label: 'Continuous jog' }]),
  stage('b10', '20 min continuous jog', [{ kind: 'jog', seconds: 1200, label: 'Continuous jog' }]),
]

function hardIntervals(times) {
  const out = []
  for (let i = 0; i < times; i++) {
    out.push({ kind: 'hard', seconds: 60, label: `Hard ${i + 1}/${times}` })
    out.push({ kind: i < times - 1 ? 'walk' : 'jog', seconds: i < times - 1 ? 90 : 60, label: i < times - 1 ? 'Recovery walk' : 'Easy jog' })
  }
  return out
}

export const FITNESS_ROTATION = [
  stage('f-easy', 'Easy run: 18 min conversational pace', [{ kind: 'jog', seconds: 1080, label: 'Easy jog' }]),
  stage('f-intervals', 'Intervals: 3 min easy + 6 × 1 min hard / 1½ min walk', [
    { kind: 'jog', seconds: 180, label: 'Easy jog' },
    ...hardIntervals(6),
  ]),
  stage('f-easy-2', 'Easy run: 18 min conversational pace', [{ kind: 'jog', seconds: 1080, label: 'Easy jog' }]),
  stage('f-tempo', 'Tempo: 4 min easy + 10 min comfortably hard + 4 min easy', [
    { kind: 'jog', seconds: 240, label: 'Easy jog' },
    { kind: 'hard', seconds: 600, label: 'Tempo (comfortably hard)' },
    { kind: 'jog', seconds: 240, label: 'Easy jog' },
  ]),
]

// Optional, on rest days only. Low intensity, so it helps recovery and fat
// loss without eating into muscle gains.
export const REST_DAY_WALK = {
  id: 'rest-walk',
  title: 'Rest-day incline walk: 30 min, 5–8% incline',
  segments: [{ kind: 'walk', seconds: 1800, label: 'Incline walk (you can still hold a conversation)' }],
}

// "Hard" in intervals/tempo is this much faster than your jog speed.
export const HARD_SPEED_BONUS_MPH = 1.0

export const EFFORT_SCALE = [
  { value: 3, label: '3: Easy, could sing' },
  { value: 5, label: '5: Comfortable, full sentences' },
  { value: 6, label: '6: Steady, short sentences' },
  { value: 7, label: '7: Challenging, a few words at a time' },
  { value: 8, label: '8: Hard, barely talking' },
  { value: 9, label: '9: Very hard' },
  { value: 10, label: '10: Maximal' },
]

export function totalSeconds(stageDef) {
  return stageDef.segments.reduce((sum, seg) => sum + seg.seconds, 0)
}

export function currentCardioStage(cardioState) {
  if (cardioState.phase === 'fitness') {
    return FITNESS_ROTATION[cardioState.rotationIndex % FITNESS_ROTATION.length]
  }
  return BUILDER_STAGES[Math.min(cardioState.stageIndex, BUILDER_STAGES.length - 1)]
}

export function speedFor(kind, cardioState) {
  if (kind === 'walk') return cardioState.walkSpeed
  if (kind === 'hard') return round1(cardioState.jogSpeed + HARD_SPEED_BONUS_MPH)
  return cardioState.jogSpeed
}

export function round1(n) {
  return Math.round(n * 10) / 10
}
