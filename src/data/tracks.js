// Exercise "tracks". A track is one movement pattern trained across months.
// Each track has levels ordered from easiest to hardest. You progress within a
// level (more weight or more reps) until the level is beaten, then move up.
//
// type:
//   'weighted' – double progression: hit the top of the rep range on every set,
//                then add weight. At your heaviest dumbbell, move up a level.
//   'reps'     – bodyweight: hit the top of the rep range on every set, then
//                move up a level.
//   'hold'     – timed hold: same as 'reps' but measured in seconds.
//
// load (weighted only): 'one' = a single dumbbell, 'pair' = one in each hand.
// Weight is always logged per dumbbell.
//
// entryFactor: when you move up to this level, the suggested weight is the
// previous weight × entryFactor (rounded down to a weight you own), because
// the harder variation needs a lighter load to keep form.

export const TRACKS = {
  squat: {
    id: 'squat',
    pattern: 'Squat',
    muscles: 'Quads, glutes, core',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'goblet-squat',
        name: 'Goblet Squat',
        load: 'one',
        repMin: 8,
        repMax: 12,
        startWeight: 7.5,
        cues: [
          'Hold one dumbbell vertically against your chest, elbows tucked.',
          'Feet shoulder-width or slightly wider, toes turned out 15–30°.',
          'Sit down between your heels, knees tracking over your toes.',
          'Go as deep as you can with a neutral back, then drive up through the whole foot.',
        ],
      },
      {
        id: 'double-db-front-squat',
        name: 'Double Dumbbell Front Squat',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.6,
        cues: [
          'Rest one end of each dumbbell on the front of your shoulders.',
          'Keep elbows high and chest up so the dumbbells stay put.',
          'Same squat pattern: sit down and back, knees out, full foot pressure.',
        ],
      },
      {
        id: 'tempo-front-squat',
        name: 'Tempo Front Squat (3 s down, 1 s pause)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.8,
        cues: [
          'Count three seconds on the way down.',
          'Pause one second at the bottom without bouncing.',
          'Stand up with intent.',
        ],
      },
      {
        id: 'one-and-half-front-squat',
        name: '1½-Rep Front Squat',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: [
          'Squat to the bottom, rise halfway, sink back to the bottom, then stand fully.',
          'That whole sequence is one rep.',
        ],
      },
    ],
  },

  lunge: {
    id: 'lunge',
    pattern: 'Single-leg',
    muscles: 'Quads, glutes, balance',
    type: 'weighted',
    sets: 3,
    perSide: true,
    restSeconds: 60,
    levels: [
      {
        id: 'split-squat',
        name: 'Dumbbell Split Squat',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 5,
        cues: [
          'Long stride stance, back heel up. Your feet stay planted the whole set.',
          'Drop the back knee straight down until it nearly touches the floor.',
          'Front knee tracks over the middle toes; torso tall.',
          'Do all reps on one leg, then switch. Log the reps of your weaker side.',
        ],
      },
      {
        id: 'reverse-lunge',
        name: 'Dumbbell Reverse Lunge',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: [
          'Step back into the lunge, lower under control, then push through the front heel to return.',
          'Keep most of the weight on the front leg.',
        ],
      },
      {
        id: 'rear-foot-elevated-split-squat',
        name: 'Bulgarian Split Squat (rear foot on chair)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.7,
        cues: [
          'Put the chair against a wall so it cannot slide.',
          'Laces of the back foot on the seat; front foot far enough out that the front heel stays down.',
          'Lower straight down, slight forward lean, then drive up through the front foot.',
        ],
      },
      {
        id: 'tempo-bulgarian-split-squat',
        name: 'Tempo Bulgarian Split Squat (3 s down)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.8,
        cues: ['Three-second lowering on every rep, no bounce at the bottom.'],
      },
    ],
  },

  hinge: {
    id: 'hinge',
    pattern: 'Hip hinge',
    muscles: 'Hamstrings, glutes, lower back',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'db-romanian-deadlift',
        name: 'Dumbbell Romanian Deadlift',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 7.5,
        cues: [
          'Stand tall, dumbbells in front of your thighs, soft knees.',
          'Push your hips back and slide the dumbbells down your legs. Your back stays flat.',
          'Stop when you feel a strong hamstring stretch (usually mid-shin).',
          'Squeeze your glutes to stand up. Do not lean back at the top.',
        ],
      },
      {
        id: 'tempo-romanian-deadlift',
        name: 'Tempo Romanian Deadlift (3 s down)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Three seconds on the way down, one second pause at the stretch.'],
      },
      {
        id: 'b-stance-romanian-deadlift',
        name: 'Kickstand (B-Stance) Romanian Deadlift',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        perSideLevel: true,
        entryFactor: 0.75,
        cues: [
          'Back foot a half-step behind with only the toes down for balance.',
          'About 80% of your weight on the front leg. Hinge exactly as before.',
          'Do all reps on one side, then switch. Log the reps of your weaker side.',
        ],
      },
      {
        id: 'single-leg-romanian-deadlift',
        name: 'Single-Leg Romanian Deadlift',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        perSideLevel: true,
        entryFactor: 0.8,
        cues: [
          'Stand on one leg; the free leg extends straight back as you hinge.',
          'Keep your hips square to the floor. Lightly touch a wall for balance if needed.',
        ],
      },
    ],
  },

  bridge: {
    id: 'bridge',
    pattern: 'Glute bridge',
    muscles: 'Glutes, hamstrings',
    type: 'weighted',
    sets: 3,
    restSeconds: 60,
    levels: [
      {
        id: 'db-glute-bridge',
        name: 'Dumbbell Glute Bridge',
        load: 'one',
        repMin: 12,
        repMax: 20,
        startWeight: 10,
        cues: [
          'Lie on your back, knees bent, feet flat, dumbbell across your hip bones (use a folded towel).',
          'Tuck your ribs down and drive through your heels until your hips are in line with your knees.',
          'Squeeze your glutes for one second at the top.',
        ],
      },
      {
        id: 'single-leg-glute-bridge',
        name: 'Single-Leg Dumbbell Glute Bridge',
        load: 'one',
        repMin: 10,
        repMax: 15,
        perSideLevel: true,
        allowBodyweight: true,
        entryFactor: 0.4,
        cues: [
          'Same setup, one foot planted, the other knee pulled toward your chest.',
          'Keep your hips level as you rise. Log the reps of your weaker side.',
        ],
      },
      {
        id: 'single-leg-hip-thrust',
        name: 'Single-Leg Hip Thrust (shoulders on sofa)',
        load: 'one',
        repMin: 10,
        repMax: 15,
        perSideLevel: true,
        allowBodyweight: true,
        entryFactor: 0.7,
        cues: [
          'Upper back on the edge of a sofa (not a chair, which can tip).',
          'One foot planted, chin tucked, drive the hips up until your torso is flat.',
        ],
      },
    ],
  },

  pushup: {
    id: 'pushup',
    pattern: 'Horizontal push (bodyweight)',
    muscles: 'Chest, front delts, triceps, core',
    type: 'reps',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'counter-incline-pushup',
        name: 'Incline Push-Up (hands on kitchen counter)',
        repMin: 8,
        repMax: 15,
        cues: [
          'Hands just wider than shoulders on a sturdy counter or table.',
          'Body in one straight line from head to heels. Squeeze glutes and brace.',
          'Lower your chest to the edge, elbows about 45° from your body, then press away.',
        ],
      },
      {
        id: 'chair-incline-pushup',
        name: 'Incline Push-Up (hands on chair seat, chair against wall)',
        repMin: 8,
        repMax: 15,
        cues: ['Lower surface = more of your bodyweight. Same straight-body rules.'],
      },
      {
        id: 'floor-pushup',
        name: 'Push-Up',
        repMin: 6,
        repMax: 15,
        cues: [
          'Hands under shoulders, straight body, chest to about a fist from the floor.',
          'Full lockout at the top without sagging hips.',
        ],
      },
      {
        id: 'tempo-pushup',
        name: 'Tempo Push-Up (3 s down, 1 s pause)',
        repMin: 6,
        repMax: 15,
        cues: ['Three seconds down, pause one second just above the floor, press up.'],
      },
      {
        id: 'feet-elevated-pushup',
        name: 'Feet-Elevated Push-Up (feet on chair)',
        repMin: 6,
        repMax: 15,
        cues: [
          'Feet on a chair seat against a wall, hands on the floor.',
          'Keep your hips in line. Do not pike them upward.',
        ],
      },
    ],
  },

  floorPress: {
    id: 'floorPress',
    pattern: 'Horizontal push (dumbbell)',
    muscles: 'Chest, triceps, front delts',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'db-floor-press',
        name: 'Dumbbell Floor Press',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 7.5,
        cues: [
          'Lie on your back, knees bent, dumbbells over your chest.',
          'Lower until your upper arms lightly touch the floor, elbows about 45° from your body.',
          'Do not bounce the elbows. Press straight up to lockout.',
        ],
      },
      {
        id: 'pause-floor-press',
        name: 'Pause Floor Press (2 s on the floor)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Let your triceps rest on the floor for a full two seconds, stay tight, then press.'],
      },
      {
        id: 'one-and-half-floor-press',
        name: '1½-Rep Floor Press',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Lower, press halfway, lower again, then press to lockout. That is one rep.'],
      },
    ],
  },

  row: {
    id: 'row',
    pattern: 'Row (one arm)',
    muscles: 'Lats, upper back, biceps',
    type: 'weighted',
    sets: 3,
    perSide: true,
    restSeconds: 60,
    levels: [
      {
        id: 'one-arm-row',
        name: 'One-Arm Dumbbell Row (hand on chair)',
        load: 'one',
        repMin: 8,
        repMax: 12,
        startWeight: 10,
        cues: [
          'One hand on a sturdy chair seat, back flat and roughly parallel to the floor.',
          'Pull the dumbbell toward your hip, not your armpit. Elbow close to your side.',
          'Pause with the shoulder blade squeezed back, then lower fully to a stretch.',
          'Do all reps on one side, then switch. Log the reps of your weaker side.',
        ],
      },
      {
        id: 'tempo-one-arm-row',
        name: 'Tempo One-Arm Row (2 s squeeze, 3 s down)',
        load: 'one',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Hold the top for two seconds, then take three seconds to lower.'],
      },
      {
        id: 'high-rep-one-arm-row',
        name: 'One-Arm Row, High Reps (15–20)',
        load: 'one',
        repMin: 15,
        repMax: 20,
        entryFactor: 1,
        cues: ['Same crisp form as tempo rows. Stop 1–2 reps before your form breaks.'],
      },
    ],
  },

  bentOverRow: {
    id: 'bentOverRow',
    pattern: 'Row (both arms)',
    muscles: 'Upper back, lats, rear delts',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'db-bent-over-row',
        name: 'Dumbbell Bent-Over Row',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 7.5,
        cues: [
          'Hinge until your torso is about 45°, back flat, knees soft.',
          'Row both dumbbells toward your lower ribs, squeeze your shoulder blades together.',
          'Lower under control. Keep your torso still (no heaving).',
        ],
      },
      {
        id: 'pause-bent-over-row',
        name: 'Pause Bent-Over Row (2 s at the top)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Hold each rep for two seconds with the shoulder blades pinched.'],
      },
      {
        id: 'one-and-half-bent-over-row',
        name: '1½-Rep Bent-Over Row',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.9,
        cues: ['Row up, lower halfway, row up again, then lower fully. That is one rep.'],
      },
    ],
  },

  overheadPress: {
    id: 'overheadPress',
    pattern: 'Vertical push',
    muscles: 'Shoulders, triceps, upper chest',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'standing-db-shoulder-press',
        name: 'Standing Dumbbell Shoulder Press',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 5,
        cues: [
          'Dumbbells at shoulder height, palms slightly turned in, glutes and abs tight.',
          'Press up and slightly back so the weights finish over your ears.',
          'Do not arch your lower back. If you have to lean, the weight is too heavy.',
        ],
      },
      {
        id: 'tempo-shoulder-press',
        name: 'Tempo Shoulder Press (3 s down)',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Three-second lowering to the shoulders on every rep.'],
      },
      {
        id: 'one-and-half-shoulder-press',
        name: '1½-Rep Shoulder Press',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        entryFactor: 0.85,
        cues: ['Press to lockout, lower to forehead height, press again, lower fully.'],
      },
    ],
  },

  lateralRaise: {
    id: 'lateralRaise',
    pattern: 'Side delts',
    muscles: 'Side delts (shoulder width)',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'db-lateral-raise',
        name: 'Dumbbell Lateral Raise',
        load: 'pair',
        repMin: 12,
        repMax: 20,
        startWeight: 2.5,
        cues: [
          'Slight forward lean, soft elbows.',
          'Raise the dumbbells out to the sides to shoulder height, leading with your elbows.',
          'Lower slowly. Light weight and strict form beat heavy swinging.',
        ],
      },
      {
        id: 'tempo-lateral-raise',
        name: 'Tempo Lateral Raise (1 s hold, 3 s down)',
        load: 'pair',
        repMin: 12,
        repMax: 20,
        entryFactor: 0.8,
        cues: ['Pause at shoulder height, three seconds down.'],
      },
    ],
  },

  curl: {
    id: 'curl',
    pattern: 'Biceps',
    muscles: 'Biceps, forearms',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'db-curl',
        name: 'Dumbbell Curl',
        load: 'pair',
        repMin: 10,
        repMax: 15,
        startWeight: 5,
        cues: [
          'Elbows pinned at your sides, palms forward.',
          'Curl up without swinging, squeeze, then lower fully to straight arms.',
        ],
      },
      {
        id: 'tempo-curl',
        name: 'Tempo Curl (3 s down)',
        load: 'pair',
        repMin: 10,
        repMax: 15,
        entryFactor: 0.85,
        cues: ['Three seconds on the way down, full stretch at the bottom.'],
      },
    ],
  },

  triceps: {
    id: 'triceps',
    pattern: 'Triceps',
    muscles: 'Triceps (long head)',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'overhead-triceps-extension',
        name: 'Overhead Dumbbell Triceps Extension',
        load: 'one',
        repMin: 10,
        repMax: 15,
        startWeight: 7.5,
        cues: [
          'Hold one dumbbell overhead with both hands under the top plate.',
          'Keep elbows pointing forward and lower the weight behind your head to a deep stretch.',
          'Extend back up without flaring the elbows. Brace so your ribs do not flare.',
        ],
      },
      {
        id: 'tempo-overhead-triceps-extension',
        name: 'Tempo Overhead Extension (3 s down)',
        load: 'one',
        repMin: 10,
        repMax: 15,
        entryFactor: 0.85,
        cues: ['Three-second lowering into the stretch.'],
      },
    ],
  },

  deadBug: {
    id: 'deadBug',
    pattern: 'Core (anti-extension)',
    muscles: 'Deep abs',
    type: 'reps',
    sets: 2,
    perSide: true,
    restSeconds: 45,
    levels: [
      {
        id: 'dead-bug',
        name: 'Dead Bug',
        repMin: 6,
        repMax: 12,
        cues: [
          'On your back, arms straight up, hips and knees at 90°.',
          'Press your lower back into the floor and keep it there.',
          'Slowly extend the opposite arm and leg, exhale, return. Alternate sides.',
        ],
      },
      {
        id: 'straight-leg-dead-bug',
        name: 'Straight-Leg Dead Bug',
        repMin: 6,
        repMax: 12,
        cues: ['Same pattern, but the moving leg stays straight: a longer lever and harder.'],
      },
      {
        id: 'weighted-dead-bug',
        name: 'Dead Bug Holding a Light Dumbbell',
        repMin: 6,
        repMax: 12,
        cues: ['Hold a light dumbbell with both hands straight over your chest; move only the legs.'],
      },
    ],
  },

  plank: {
    id: 'plank',
    pattern: 'Core (bracing)',
    muscles: 'Abs, obliques, shoulders',
    type: 'hold',
    sets: 2,
    restSeconds: 45,
    levels: [
      {
        id: 'forearm-plank',
        name: 'Forearm Plank',
        secMin: 20,
        secMax: 45,
        cues: [
          'Elbows under shoulders, body straight from head to heels.',
          'Squeeze glutes, pull ribs down, breathe steadily.',
          'End the set when your hips sag, not when you collapse.',
        ],
      },
      {
        id: 'long-lever-plank',
        name: 'Long-Lever Plank (elbows ahead of shoulders)',
        secMin: 20,
        secMax: 45,
        cues: ['Walk your elbows a few centimetres past your head. The harder lever makes the abs work more.'],
      },
      {
        id: 'feet-elevated-plank',
        name: 'Feet-Elevated Plank (feet on chair)',
        secMin: 20,
        secMax: 45,
        cues: ['Chair against a wall. Keep the same straight line.'],
      },
    ],
  },
}

export function getTrack(trackId) {
  const track = TRACKS[trackId]
  if (!track) throw new Error(`Unknown track: ${trackId}`)
  return track
}

export function isPerSide(track, levelIndex) {
  return Boolean(track.perSide || track.levels[levelIndex]?.perSideLevel)
}

export function repRange(track, level) {
  return track.type === 'hold' ? [level.secMin, level.secMax] : [level.repMin, level.repMax]
}
