import { BUILDER_STAGES, FITNESS_ROTATION, round1 } from '../data/cardio.js'

export const SUCCESSES_TO_ADVANCE = 2
export const FAILURES_TO_STEP_BACK = 2
export const MAX_EFFORT_TO_COUNT = 7
const SPEED_STEP = 0.2
const MAX_JOG_MPH = 9
const MIN_GAP_ABOVE_WALK = 0.5

export function initialCardioState() {
  return {
    phase: 'builder',
    stageIndex: 0,
    successes: 0,
    failures: 0,
    rotationIndex: 0,
    walkSpeed: 3.0,
    jogSpeed: 4.5,
  }
}

/**
 * log = { completed: boolean, effort: 1..10 }
 * Returns { state, outcome, message }.
 */
export function evaluateCardio(state, log) {
  const effort = Number(log.effort)

  if (state.phase === 'fitness') {
    const next = { ...state, rotationIndex: (state.rotationIndex + 1) % FITNESS_ROTATION.length }
    if (log.completed && effort <= 5) {
      next.jogSpeed = round1(Math.min(MAX_JOG_MPH, state.jogSpeed + SPEED_STEP))
      return { state: next, outcome: 'faster', message: `Felt easy. Jog speed goes up to ${next.jogSpeed} mph.` }
    }
    if (!log.completed || effort >= 9) {
      next.jogSpeed = round1(Math.max(state.walkSpeed + MIN_GAP_ABOVE_WALK, state.jogSpeed - SPEED_STEP))
      return {
        state: next,
        outcome: 'slower',
        message: `Too hard today. Jog speed eases to ${next.jogSpeed} mph. Build back up.`,
      }
    }
    return { state: next, outcome: 'repeat', message: 'Solid session. Same speeds next time.' }
  }

  const stage = BUILDER_STAGES[state.stageIndex]

  if (log.completed && effort <= MAX_EFFORT_TO_COUNT) {
    const successes = state.successes + 1
    if (successes < SUCCESSES_TO_ADVANCE) {
      return {
        state: { ...state, successes, failures: 0 },
        outcome: 'repeat',
        message: `Stage complete (${successes}/${SUCCESSES_TO_ADVANCE}). Do "${stage.title}" once more to lock it in.`,
      }
    }
    const nextIndex = state.stageIndex + 1
    if (nextIndex >= BUILDER_STAGES.length) {
      return {
        state: { ...state, phase: 'fitness', successes: 0, failures: 0, rotationIndex: 0 },
        outcome: 'graduated',
        message: 'You can run 20 minutes non-stop! You now move to the Fitness phase: easy runs, intervals and tempo runs.',
      }
    }
    return {
      state: { ...state, stageIndex: nextIndex, successes: 0, failures: 0 },
      outcome: 'advance',
      message: `Stage beaten! Next: ${BUILDER_STAGES[nextIndex].title}.`,
    }
  }

  if (log.completed) {
    return {
      state: { ...state, failures: 0 },
      outcome: 'repeat',
      message: `Completed, but effort was ${effort}/10. Repeat this stage until it feels 7/10 or easier.`,
    }
  }

  const failures = state.failures + 1
  if (failures >= FAILURES_TO_STEP_BACK && state.stageIndex > 0) {
    const prevIndex = state.stageIndex - 1
    return {
      state: { ...state, stageIndex: prevIndex, successes: 0, failures: 0 },
      outcome: 'step-back',
      message: `Two unfinished sessions in a row. Stepping back to "${BUILDER_STAGES[prevIndex].title}". That is normal and builds a stronger base.`,
    }
  }
  return {
    state: { ...state, failures: failures >= FAILURES_TO_STEP_BACK ? 0 : failures, successes: 0 },
    outcome: 'repeat',
    message: 'Not finished this time. Repeat the stage. Slowing the jog speed by 0.2–0.3 mph is completely fine.',
  }
}
