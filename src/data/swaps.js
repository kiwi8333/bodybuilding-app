// Exercise swaps: an equivalent movement for when furniture is unavailable,
// a joint is sore, or you simply need a change. A swap uses the same sets,
// reps, rest and weight as the exercise it replaces. Progression on the
// original exercise is paused while a swap is in use, so nothing breaks and
// nothing is lost when you switch back.

export const SWAPS = {
  squat: [
    {
      id: 'goblet-box-squat',
      name: 'Goblet Box Squat (sit to a chair)',
      why: 'A depth target and less knee travel. Good for sore knees or building confidence.',
      cues: ['Chair behind you, against a wall.', 'Sit back until you lightly touch the seat, pause, then stand.', 'Do not flop onto the chair; stay tight.'],
    },
  ],
  lunge: [
    {
      id: 'split-squat-swap',
      demo: 'split-squat',
      name: 'Dumbbell Split Squat (no chair needed)',
      why: 'Same leg muscles without balancing on a chair.',
      cues: ['Long stride stance, back heel up, feet stay planted.', 'Drop the back knee straight down, then drive up through the front foot.'],
    },
  ],
  hinge: [
    {
      id: 'hinge-single-leg-bridge',
      demo: 'single-leg-glute-bridge',
      name: 'Single-Leg Dumbbell Glute Bridge',
      why: 'Trains glutes and hamstrings lying down, kinder to a tired lower back.',
      cues: ['Dumbbell on your hip, one foot planted.', 'Drive through the heel, squeeze at the top, lower slowly.'],
    },
  ],
  bridge: [
    {
      id: 'floor-glute-bridge',
      demo: 'db-glute-bridge',
      name: 'Dumbbell Glute Bridge (both legs, floor)',
      why: 'No sofa needed and easier to balance.',
      cues: ['Dumbbell across your hips on a folded towel.', 'Drive through both heels and squeeze at the top.'],
    },
  ],
  pushup: [
    {
      id: 'knee-pushup',
      name: 'Knee Push-Up',
      why: 'Lighter on shoulders and wrists and needs no furniture.',
      cues: ['Knees on a folded towel, body straight from knees to head.', 'Lower your chest between your hands, elbows about 45°, press up.'],
    },
  ],
  floorPress: [
    {
      id: 'squeeze-press',
      demo: 'db-floor-press',
      name: 'Dumbbell Squeeze Press (floor)',
      why: 'Dumbbells pressed together keep elbows tucked, friendlier to cranky shoulders.',
      cues: ['Press the dumbbells firmly together the whole set.', 'Lower to your chest with elbows close, press straight up.'],
    },
  ],
  row: [
    {
      id: 'knee-supported-row',
      name: 'One-Arm Row, Hand on Knee',
      why: 'No chair needed. Your front thigh supports you.',
      cues: ['Staggered stance, free hand on your front knee, back flat.', 'Pull the dumbbell to your hip, lower to a full stretch.'],
    },
  ],
  bentOverRow: [
    {
      id: 'chair-supported-row',
      demo: 'one-arm-row',
      perSide: true,
      name: 'One-Arm Row (hand on chair)',
      why: 'Supporting yourself with one hand takes load off the lower back.',
      cues: ['One hand on a sturdy chair, back flat.', 'Row to your hip, pause, lower slowly. Do all reps, then switch sides.'],
    },
  ],
  overheadPress: [
    {
      id: 'neutral-grip-press',
      demo: 'standing-db-shoulder-press',
      name: 'Neutral-Grip Shoulder Press (palms facing)',
      why: 'Palms facing each other is easier on the shoulders.',
      cues: ['Palms face each other throughout.', 'Press up without leaning back; lower to shoulder height.'],
    },
  ],
  lateralRaise: [
    {
      id: 'partial-lateral-raise',
      name: 'Partial Lateral Raise (to 60°)',
      why: 'A shorter range for sore shoulders, still working the side delts.',
      cues: ['Raise the dumbbells out to about 60°, just below shoulder height.', 'Lower slowly, no swinging.'],
    },
  ],
  curl: [
    {
      id: 'hammer-curl',
      demo: 'db-curl',
      name: 'Hammer Curl (palms facing)',
      why: 'Easier on elbows and wrists, and builds the forearms too.',
      cues: ['Palms face each other like holding hammers.', 'Elbows pinned, curl up, lower all the way.'],
    },
  ],
  triceps: [
    {
      id: 'lying-triceps-extension',
      name: 'Lying Dumbbell Triceps Extension (floor)',
      why: 'Lying down takes pressure off shoulders that dislike overhead work.',
      cues: ['On your back, one dumbbell held with both hands above your chest.', 'Bend only at the elbows to lower it beside your head, then extend.'],
    },
  ],
  deadBug: [
    {
      id: 'heel-taps',
      name: 'Dead Bug Heel Taps (arms stay up)',
      why: 'A simpler version when coordination or the lower back is struggling.',
      cues: ['Arms straight up, knees bent at 90°, lower back pressed down.', 'Slowly lower one heel to tap the floor, return, switch legs.'],
    },
  ],
  plank: [
    {
      id: 'incline-plank',
      name: 'Incline Forearm Plank (forearms on sofa)',
      why: 'Less load on shoulders and core, for days when a full plank hurts.',
      cues: ['Forearms on the sofa seat, body in one straight line.', 'Squeeze glutes, breathe steadily.'],
    },
  ],
}

export function swapsFor(trackId) {
  return SWAPS[trackId] ?? []
}

export function findSwap(trackId, swapId) {
  return swapsFor(trackId).find((s) => s.id === swapId) ?? null
}

// The id of the demo/tempo to use for a swap.
export function swapDemoId(swap) {
  return swap.demo ?? swap.id
}
