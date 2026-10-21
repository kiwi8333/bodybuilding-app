// What each exercise is for: the muscles it works, what it builds, and how
// that shows up outside the gym. TRACK_PURPOSE covers the movement; LEVEL_ADDS
// says what each harder version changes. Swaps do the same job as the
// exercise they replace (their own `why` says why you might pick one).

export const TRACK_PURPOSE = {
  squat:
    'Builds the muscles on the front of your thighs (quads) and your glutes, with your core bracing to keep you upright. It is the base for strong legs and makes standing up, climbing stairs and lifting things off the floor easier.',
  lunge:
    'Trains one leg at a time: quads and glutes do the work while smaller hip muscles keep your knee and pelvis steady. It evens out a stronger and weaker side and improves balance for walking, running and stairs.',
  hinge:
    'Strengthens the back of your body: hamstrings, glutes and the muscles along your spine. It teaches you to bend from the hips with a flat back, the safe way to pick things up, and builds the muscles behind good posture.',
  bridge:
    'Isolates your glutes, the biggest muscles in your body, with help from the hamstrings. Strong glutes power walking and running, take load off your lower back and give the hips their shape.',
  pushup:
    'Builds your chest, the front of your shoulders and your triceps, while your abs and glutes hold your body in a straight line. It is the classic upper-body pushing strength move and makes pushing anything easier.',
  floorPress:
    'Builds chest and triceps strength with the dumbbells. The floor stops your elbows at a shoulder-friendly depth, so you can press hard and add weight safely.',
  row:
    'Works your lats (the wide muscles that give your back its V shape), upper back and biceps. Rowing balances all the pushing, pulls your shoulders back for better posture and builds the strength to pull and carry.',
  bentOverRow:
    'Builds thickness across your upper back and the rear of your shoulders, while your hips and lower back hold the bent-over position. It strengthens posture and the muscles that keep your shoulders healthy.',
  overheadPress:
    'Builds your shoulders and triceps by pressing weight overhead, with your core and glutes keeping you tall. It gives rounded, strong shoulders and makes putting things up on high shelves easy.',
  lateralRaise:
    'Targets the side of your shoulders (side delts), the muscle that makes your shoulders look wider. It is a small muscle few other exercises hit directly, so it gets its own exercise.',
  curl: 'Works your biceps and forearms, the muscles that bend your elbow and grip. It builds arm size and helps with carrying shopping, lifting kids and pulling.',
  triceps:
    'Works the triceps on the back of your arm, which make up about two thirds of its size. Going overhead stretches the long head, the part other pressing moves barely reach.',
  deadBug:
    'Trains your deep abs to keep your lower back still while your arms and legs move. That control protects your spine in every other exercise and in everyday lifting and twisting.',
  plank:
    'Builds bracing strength in your abs, obliques and shoulders by holding your body rigid. A strong brace keeps your back safe under load and helps you stand and move with better posture.',

  gymSquat:
    'The king of leg exercises: builds quads, glutes and inner thighs, while your back and core hold the bar steady. It lets you load your legs far more heavily than dumbbells, building overall strength and muscle.',
  gymBench:
    'Builds the chest, front of the shoulders and triceps with the heaviest weights of any upper-body press. It is the main measure of upper-body pushing strength.',
  gymPulldown:
    'Works your lats, upper back and biceps by pulling your elbows down to your sides, like a pull-up you can set the weight for. It widens your back and builds towards your first pull-ups.',
  gymHinge:
    'Strengthens your hamstrings, glutes and the muscles along your spine with a heavy barbell. It builds a strong back of the body and the hip-hinge pattern for safe lifting.',
  gymLateral:
    'Targets the side of your shoulders (side delts), the muscle that makes your shoulders look wider. Gym dumbbells let it keep progressing past home weights.',
  gymPushdown:
    'Isolates your triceps with constant tension from the cable, building the back of your arms and the lockout strength for every press.',
  gymKneeRaise:
    'Works your lower abs by curling your pelvis up towards your ribs, with your hip flexors and (when hanging) your grip helping. It builds core strength and control without loading your spine.',
  gymLegPress:
    'Builds quads and glutes with heavy weight while the machine supports your back. It adds leg volume without the balance or lower-back demand of a squat.',
  gymInclinePress:
    'Targets the upper chest and the front of the shoulders. The incline fills in the top of the chest, and dumbbells let each arm work on its own and move through a longer range.',
  gymCableRow:
    'Builds the middle of your back, lats and rear shoulders, pulling your shoulder blades together. It improves posture and balances all the pressing.',
  gymLegCurl:
    'Isolates your hamstrings by bending the knee, the job squats and leg presses barely train. Strong hamstrings protect your knees and help with sprinting and jumping.',
  gymShoulderPress:
    'Builds your shoulders and triceps. Sitting with back support lets you press heavier than standing, focusing the work on the shoulders.',
  gymCurl:
    'Works your biceps and forearms, the muscles that bend your elbow and grip. Gym dumbbells let it keep progressing past home weights.',
  gymCableCrunch:
    'Trains your abs with weight by curling your spine down against the cable. Like any muscle, abs grow from loaded work, which makes them stronger and more visible.',
}

export const LEVEL_ADDS = {
  'double-db-front-squat': 'Two dumbbells at your shoulders double the load you can use once a single dumbbell is too light.',
  'tempo-front-squat': 'The slow lowering and pause keep your legs under tension for longer, so the same weight builds more muscle.',
  'one-and-half-front-squat': 'The extra half rep doubles the time in the hardest, deepest part of the squat.',
  'reverse-lunge': 'Stepping back adds balance and control on every rep, while staying kinder to the knees than forward lunges.',
  'rear-foot-elevated-split-squat': 'Raising the back foot puts almost all your weight on the front leg, so light dumbbells feel much heavier.',
  'tempo-bulgarian-split-squat': 'A slow lowering adds time under tension when the dumbbells can no longer go heavier.',
  'tempo-romanian-deadlift': 'The slow lowering and pause in the stretch make your hamstrings work harder with the same weight.',
  'b-stance-romanian-deadlift': 'Shifting most of your weight to one leg nearly doubles the load on it, with the back foot only for balance.',
  'single-leg-romanian-deadlift': 'One leg carries everything, adding hip stability and balance work on top of the hamstring stretch.',
  'single-leg-glute-bridge': 'One leg at a time doubles the load on each glute and shows up any side-to-side difference.',
  'single-leg-hip-thrust': 'Shoulders on the sofa let your hips travel further, so the glute works through its full range.',
  'chair-incline-pushup': 'A lower surface puts more of your bodyweight on your arms, a step closer to a floor push-up.',
  'floor-pushup': 'The full push-up: your arms move most of your bodyweight, with a long plank for your core.',
  'tempo-pushup': 'A slow lowering and a pause at the bottom remove the bounce, so your chest does more work per rep.',
  'feet-elevated-pushup': 'Raising your feet shifts more weight onto your arms and moves the work towards the upper chest and shoulders.',
  'pause-floor-press': 'Resting on the floor for a moment removes momentum, so you press from a dead stop.',
  'one-and-half-floor-press': 'The extra half rep doubles the time in the bottom half, where the chest works hardest.',
  'tempo-one-arm-row': 'Squeezing at the top and lowering slowly makes your back work harder with the same dumbbell.',
  'high-rep-one-arm-row': 'More reps with your heaviest dumbbell keep your back growing when the weight cannot go up.',
  'pause-bent-over-row': 'Holding the top position makes your upper back squeeze instead of letting momentum do the work.',
  'one-and-half-bent-over-row': 'The extra half rep doubles the time in the top half, where the shoulder blades squeeze together.',
  'tempo-shoulder-press': 'A slow lowering keeps your shoulders loaded for longer when heavier dumbbells are not an option.',
  'one-and-half-shoulder-press': 'The extra half rep doubles the work in the bottom range, where pressing is hardest.',
  'tempo-lateral-raise': 'A pause at the top and slow lowering keep tension on the side delts the whole rep.',
  'tempo-curl': 'A slow lowering works the biceps harder on the way down, where most of the muscle-building happens.',
  'tempo-overhead-triceps-extension': 'A slow lowering into the deep stretch makes the long head of the triceps work harder.',
  'straight-leg-dead-bug': 'A straight leg is a longer lever, so your abs have to work harder to keep your back flat.',
  'weighted-dead-bug': 'Holding a dumbbell adds load your abs must resist, the hardest version of the pattern.',
  'long-lever-plank': 'Moving your elbows forward lengthens the lever, so your abs work much harder for the same hold.',
  'feet-elevated-plank': 'Raising your feet puts more weight through your shoulders and core.',
  'pause-back-squat': 'Holding the bottom removes the bounce, so you build strength exactly where squats are hardest.',
  'pause-bench-press': 'A pause on the chest removes the bounce and builds strength off the chest.',
  'hanging-knee-raise': 'Hanging from a bar removes the back support, adding grip work and more core control.',
  'hanging-leg-raise': 'Straight legs are a longer lever, so your abs lift far more of your weight.',
}

// The purpose shown for an exercise, plus what its level adds (if any).
export function purposeOf(trackId, levelId) {
  return { does: TRACK_PURPOSE[trackId] ?? null, adds: LEVEL_ADDS[levelId] ?? null }
}
