// Exercise tracks for training in a full gym. They follow the same rules as
// the home tracks in tracks.js (double progression, levels, per-side), with
// two differences:
//
// gear (weighted levels): which kind of equipment the weight is set on. Each
// gear has its own weight steps (GYM_GEAR), so the app suggests weights the
// gym actually has instead of using your home dumbbell set.
//
// load: as in tracks.js ('one' / 'pair' dumbbells), plus
//   'bar'   – total barbell weight, bar included (a 20 kg bar + 10 kg a side = 40 kg)
//   'stack' – the pin setting on a machine or cable stack
//
// demo: an existing animated demo with the same movement and equipment. Gym
// levels without one have no animation; their tempo text still comes from
// data/tempo.js.

export const GYM_GEAR = {
  barbell: { minWeight: 20, increment: 2.5, maxWeight: 200 },
  dumbbell: { minWeight: 2.5, increment: 2.5, maxWeight: 50 },
  machine: { minWeight: 5, increment: 5, maxWeight: 150 },
  cable: { minWeight: 2.5, increment: 2.5, maxWeight: 100 },
}

export const GYM_TRACKS = {
  gymSquat: {
    id: 'gymSquat',
    location: 'gym',
    pattern: 'Squat (gym)',
    muscles: 'Quads, glutes, core',
    type: 'weighted',
    sets: 3,
    restSeconds: 120,
    levels: [
      {
        id: 'barbell-back-squat',
        name: 'Barbell Back Squat',
        gear: 'barbell',
        load: 'bar',
        repMin: 6,
        repMax: 10,
        startWeight: 40,
        cues: [
          'Set the safety bars just below the depth you squat to, then step under the bar.',
          'Bar on your upper back (not your neck), hands just outside shoulders, elbows down.',
          'Big breath, brace, and sit down between your heels with knees tracking over your toes.',
          'Go as deep as you can with a neutral back, then drive up through the whole foot.',
        ],
      },
      {
        id: 'pause-back-squat',
        name: 'Pause Back Squat (2 s at the bottom)',
        gear: 'barbell',
        load: 'bar',
        repMin: 6,
        repMax: 10,
        entryFactor: 0.85,
        cues: ['Same squat, but hold the bottom for two seconds without relaxing, then stand up hard.'],
      },
    ],
  },

  gymBench: {
    id: 'gymBench',
    location: 'gym',
    pattern: 'Horizontal push (gym)',
    muscles: 'Chest, front delts, triceps',
    type: 'weighted',
    sets: 3,
    restSeconds: 120,
    levels: [
      {
        id: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        gear: 'barbell',
        load: 'bar',
        repMin: 6,
        repMax: 10,
        startWeight: 30,
        cues: [
          'Use the safety arms, or ask someone to spot you.',
          'Eyes under the bar, shoulder blades pinched together, feet flat on the floor.',
          'Lower the bar to your lower chest with elbows about 45° from your body.',
          'Touch lightly (no bounce) and press back up over your shoulders.',
        ],
      },
      {
        id: 'pause-bench-press',
        name: 'Pause Bench Press (1 s on the chest)',
        gear: 'barbell',
        load: 'bar',
        repMin: 6,
        repMax: 10,
        entryFactor: 0.9,
        cues: ['Let the bar sink onto your chest and stay tight for one second, then press.'],
      },
    ],
  },

  gymPulldown: {
    id: 'gymPulldown',
    location: 'gym',
    pattern: 'Vertical pull (gym)',
    muscles: 'Lats, upper back, biceps',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        gear: 'cable',
        load: 'stack',
        repMin: 8,
        repMax: 12,
        startWeight: 30,
        cues: [
          'Thigh pad snug, hands a little wider than shoulders.',
          'Lean back slightly and pull the bar to your upper chest, driving your elbows down.',
          'Let the bar rise all the way until your arms are straight and your lats stretch.',
        ],
      },
    ],
  },

  gymHinge: {
    id: 'gymHinge',
    location: 'gym',
    pattern: 'Hinge (gym)',
    muscles: 'Hamstrings, glutes, lower back',
    type: 'weighted',
    sets: 3,
    restSeconds: 120,
    levels: [
      {
        id: 'barbell-romanian-deadlift',
        name: 'Barbell Romanian Deadlift',
        gear: 'barbell',
        load: 'bar',
        repMin: 8,
        repMax: 12,
        startWeight: 40,
        cues: [
          'Start standing with the bar at your hips, hands just outside your thighs.',
          'Soft knees, push your hips back and slide the bar down your legs.',
          'Stop when your hamstrings are fully stretched (usually mid-shin), back flat.',
          'Squeeze your glutes to stand up. The bar never drifts away from your legs.',
        ],
      },
    ],
  },

  gymLateral: {
    id: 'gymLateral',
    location: 'gym',
    pattern: 'Side delts (gym)',
    muscles: 'Side delts (shoulder width)',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'gym-lateral-raise',
        name: 'Dumbbell Lateral Raise',
        demo: 'db-lateral-raise',
        gear: 'dumbbell',
        load: 'pair',
        repMin: 12,
        repMax: 20,
        startWeight: 5,
        cues: [
          'Slight forward lean, soft elbows.',
          'Raise the dumbbells out to the sides to shoulder height, leading with your elbows.',
          'Lower slowly. Light weight and strict form beat heavy swinging.',
        ],
      },
    ],
  },

  gymPushdown: {
    id: 'gymPushdown',
    location: 'gym',
    pattern: 'Triceps (gym)',
    muscles: 'Triceps',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'cable-triceps-pushdown',
        name: 'Cable Triceps Pushdown',
        gear: 'cable',
        load: 'stack',
        repMin: 10,
        repMax: 15,
        startWeight: 15,
        cues: [
          'Rope or straight bar at the top pulley, elbows pinned to your sides.',
          'Push down until your arms are straight and squeeze the triceps.',
          'Let your forearms rise back up to just above 90° without your elbows moving forward.',
        ],
      },
    ],
  },

  gymKneeRaise: {
    id: 'gymKneeRaise',
    location: 'gym',
    pattern: 'Core (gym)',
    muscles: 'Abs, hip flexors, grip',
    type: 'reps',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'captains-chair-knee-raise',
        name: "Captain's Chair Knee Raise",
        repMin: 8,
        repMax: 15,
        cues: [
          'Forearms on the pads, back against the backrest.',
          'Curl your knees up towards your chest by tilting your pelvis, not just lifting your legs.',
          'Lower slowly without swinging.',
        ],
      },
      {
        id: 'hanging-knee-raise',
        name: 'Hanging Knee Raise',
        repMin: 8,
        repMax: 15,
        cues: ['Hang from a pull-up bar, shoulders active. Same pelvis curl, no swinging.'],
      },
      {
        id: 'hanging-leg-raise',
        name: 'Hanging Straight-Leg Raise',
        repMin: 8,
        repMax: 15,
        cues: ['Legs straight, raise them to at least hip height, lower under control.'],
      },
    ],
  },

  gymLegPress: {
    id: 'gymLegPress',
    location: 'gym',
    pattern: 'Leg press (gym)',
    muscles: 'Quads, glutes',
    type: 'weighted',
    sets: 3,
    restSeconds: 120,
    levels: [
      {
        id: 'leg-press',
        name: 'Leg Press',
        gear: 'machine',
        load: 'stack',
        repMin: 10,
        repMax: 15,
        startWeight: 40,
        cues: [
          'Feet shoulder-width in the middle of the platform, lower back flat on the pad.',
          'Lower until your knees are close to your chest without your hips rolling up.',
          'Press through your whole foot. Do not lock your knees out hard at the top.',
        ],
      },
    ],
  },

  gymInclinePress: {
    id: 'gymInclinePress',
    location: 'gym',
    pattern: 'Incline push (gym)',
    muscles: 'Upper chest, front delts, triceps',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'incline-db-press',
        name: 'Incline Dumbbell Press',
        gear: 'dumbbell',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 10,
        cues: [
          'Bench at about 30°. Kick the dumbbells up off your knees as you lie back.',
          'Shoulder blades back and down, dumbbells over your upper chest.',
          'Lower until you feel a stretch across your chest, then press up and slightly in.',
        ],
      },
    ],
  },

  gymCableRow: {
    id: 'gymCableRow',
    location: 'gym',
    pattern: 'Horizontal pull (gym)',
    muscles: 'Mid back, lats, rear delts',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'seated-cable-row',
        name: 'Seated Cable Row',
        gear: 'cable',
        load: 'stack',
        repMin: 8,
        repMax: 12,
        startWeight: 30,
        cues: [
          'Sit tall with a slight knee bend, close-grip handle.',
          'Pull the handle to your stomach, squeezing your shoulder blades together.',
          'Reach forward until your arms are straight, keeping your back neutral.',
        ],
      },
    ],
  },

  gymLegCurl: {
    id: 'gymLegCurl',
    location: 'gym',
    pattern: 'Hamstrings (gym)',
    muscles: 'Hamstrings',
    type: 'weighted',
    sets: 3,
    restSeconds: 75,
    levels: [
      {
        id: 'machine-leg-curl',
        name: 'Leg Curl Machine (seated or lying)',
        gear: 'machine',
        load: 'stack',
        repMin: 10,
        repMax: 15,
        startWeight: 20,
        cues: [
          'Line your knees up with the machine’s pivot point; pad just above your heels.',
          'Curl as far as you can and squeeze, then lower slowly to a full stretch.',
          'Keep your hips pressed into the seat or bench.',
        ],
      },
    ],
  },

  gymShoulderPress: {
    id: 'gymShoulderPress',
    location: 'gym',
    pattern: 'Vertical push (gym)',
    muscles: 'Shoulders, triceps',
    type: 'weighted',
    sets: 3,
    restSeconds: 90,
    levels: [
      {
        id: 'seated-db-shoulder-press',
        name: 'Seated Dumbbell Shoulder Press',
        gear: 'dumbbell',
        load: 'pair',
        repMin: 8,
        repMax: 12,
        startWeight: 8,
        cues: [
          'Bench upright (or one notch back), dumbbells at shoulder height, palms forward.',
          'Press up until your arms are straight without arching your lower back.',
          'Lower until the dumbbells are level with your ears or a little lower.',
        ],
      },
    ],
  },

  gymCurl: {
    id: 'gymCurl',
    location: 'gym',
    pattern: 'Biceps (gym)',
    muscles: 'Biceps, forearms',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'gym-db-curl',
        name: 'Dumbbell Curl',
        demo: 'db-curl',
        gear: 'dumbbell',
        load: 'pair',
        repMin: 10,
        repMax: 15,
        startWeight: 7.5,
        cues: [
          'Elbows pinned at your sides, palms forward.',
          'Curl up without swinging, squeeze, then lower fully to straight arms.',
        ],
      },
    ],
  },

  gymCableCrunch: {
    id: 'gymCableCrunch',
    location: 'gym',
    pattern: 'Core flexion (gym)',
    muscles: 'Abs',
    type: 'weighted',
    sets: 2,
    restSeconds: 60,
    levels: [
      {
        id: 'kneeling-cable-crunch',
        name: 'Kneeling Cable Crunch',
        gear: 'cable',
        load: 'stack',
        repMin: 10,
        repMax: 15,
        startWeight: 20,
        cues: [
          'Kneel facing a high pulley, rope held beside your head.',
          'Keep your hips still and curl your ribs down towards your hips.',
          'Return slowly until your abs are stretched. The movement comes from your spine, not your hips.',
        ],
      },
    ],
  },
}
