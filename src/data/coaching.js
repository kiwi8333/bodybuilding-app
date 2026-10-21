// Trainer guidance: why each exercise is prescribed the way it is.

export const TRACK_COACHING = {
  squat: 'Three hard sets of 8–12 is the sweet spot for building leg muscle as a beginner. The long 90 s rest lets your legs and breathing recover so every set is quality.',
  lunge: 'Single-leg work fixes left/right imbalances and gets far more out of light dumbbells. Do all reps on your weaker leg first, then match them on the other.',
  hinge: 'Hamstrings and glutes respond best to a slow, controlled stretch. Keep 1–2 reps in reserve because form on hinges breaks down suddenly.',
  bridge: 'Glutes tolerate higher reps well. 12–20 reps with a hard squeeze at the top builds them without loading your lower back.',
  pushup: 'Push-ups build chest, shoulders and triceps. Moving to a harder angle only once you own 15 clean reps keeps progress steady and your shoulders happy.',
  floorPress: 'The floor stops your elbows at a shoulder-safe depth, so you can push hard. Lower with control and never bounce off the floor.',
  row: 'Rowing balances all the pushing. One arm at a time lets you pull further and feel your back working instead of your arms.',
  bentOverRow: 'Two-arm rows build upper-back thickness and posture. If your lower back tires before your upper back, the weight is too heavy.',
  overheadPress: 'Pressing overhead builds round shoulders and a strong core. Stay tall: leaning back to finish a rep means the set is over.',
  lateralRaise: 'Side delts make shoulders look wider and recover fast, so 2 sets of higher reps with strict form work best. Light weight is normal here.',
  curl: 'Arms already work during rows. Two focused sets are enough extra to grow biceps without eating into recovery.',
  triceps: 'Overhead extensions stretch the long head of the triceps, the biggest part of your arm. Two sets with a deep, controlled stretch is plenty.',
  deadBug: 'Core control, not endurance. Slow reps with your lower back pressed flat teach your abs to protect your spine during every other lift.',
  plank: 'Short, tight holds beat long saggy ones. End each hold the moment your hips drop, then rest and repeat.',

  gymSquat: 'Heavy compound lifts build the most strength in the 6–10 range. The full 2 minutes of rest lets your legs and breathing recover, so every set is heavy and clean rather than rushed.',
  gymBench: 'Pressing heavy for 6–10 reps builds strength and size together. Rest the full 2 minutes, set the safety arms, and stop each set with a rep or two left so the bar always goes up.',
  gymPulldown: '8–12 controlled reps suit the back: heavy enough to grow, light enough to feel your lats instead of yanking with your arms. Pull to the chest and let the bar rise all the way every rep.',
  gymHinge: 'Hinges load your lower back as well as your hamstrings, so 8–12 reps with strict form beat heavy singles. Two minutes of rest keeps your back fresh enough to stay flat on every rep.',
  gymLateral: 'Side delts are small and recover fast, so 2 sets of 12–20 with strict form work best. If you have to swing the dumbbells up, the weight is too heavy.',
  gymPushdown: 'Your triceps already work hard on bench and shoulder press, so 2 focused sets are enough extra. The cable keeps tension on them the whole rep, which suits 10–15 controlled reps.',
  gymKneeRaise: 'Core control, not momentum: 2 sets of 8–15 slow reps where you curl your pelvis up. Once you can do 15 without swinging, the harder hanging versions keep it challenging.',
  gymLegPress: 'The machine takes balance and back strain out of the picture, so 10–15 reps push your legs close to failure safely. It adds leg work after squats without competing with them for recovery.',
  gymInclinePress: 'After heavy bench, 8–12 reps with dumbbells add upper-chest work through a longer range. Each arm works on its own, which keeps a stronger side from taking over.',
  gymCableRow: 'Rows balance all the pressing. 8–12 reps with a squeeze at the stomach make your mid back do the work, and 90 seconds of rest is enough for a muscle group this size.',
  gymLegCurl: 'Hamstrings respond well to 10–15 reps with a slow lowering. Squats and leg presses barely train knee bending, so this fills the gap and helps protect your knees.',
  gymShoulderPress: 'Your shoulders already worked on bench, so 8–12 reps with dumbbells is the right dose. Sitting with back support keeps the focus on the shoulders instead of your lower back.',
  gymCurl: 'Arms already work during pulldowns and rows. Two sets of 10–15 strict reps add biceps growth without eating into your recovery.',
  gymCableCrunch: 'Abs are a muscle like any other and grow from loaded work. 2 sets of 10–15 with a hard squeeze, keeping your hips still so your abs, not your hip flexors, do the work.',
}

export function effortText(type) {
  if (type === 'hold') return 'End the hold when your form slips, not when you collapse.'
  return 'Stop each set with 1–2 good reps left in the tank. The last 2 reps should be hard but clean.'
}

// How often each piece of the plan happens, from a trainer's point of view.
export const WEEKLY_GUIDE = [
  { label: 'Lifting', value: '3 × week', detail: 'Mon, Wed, Fri or any 3 days with a rest day between' },
  { label: 'Treadmill', value: '3 × week', detail: 'Straight after each lifting session' },
  { label: 'Rest-day walk', value: '0–2 × week', detail: 'Optional 30 min incline walk' },
  { label: 'Full rest', value: '≥ 1 day', detail: 'Muscle is built while you recover' },
]

export const CARDIO_COACHING = {
  builder:
    'Do the current stage after every lifting session (3 times a week). Jog slowly enough to talk in short sentences. Finish it twice at effort 7/10 or lower and the next stage unlocks.',
  fitness:
    'Keep 2 of every 4 sessions easy (you can talk). Intervals and tempo runs are the hard days that raise your fitness; easy days keep your legs fresh for lifting.',
  restWalk: 'Optional on rest days. Brisk incline walking burns extra calories and speeds recovery without hurting muscle gain.',
}
