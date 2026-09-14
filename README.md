# Forge: Muscle & Fitness

An installable phone app (PWA) for building muscle and aerobic fitness with
**adjustable dumbbells (up to 15 kg), no bench, and a treadmill**, three
~60-minute sessions a week.

**Open it:** https://kiwi8333.github.io/bodybuilding-app/
On your phone, open the link, then choose **Add to Home Screen** (iPhone: Share → Add to
Home Screen; Android/Chrome: ⋮ → Install app). It works offline in the gym.

## The program

**Lifting: full body, alternating A / B** (week 1: A B A, week 2: B A B)

| Workout A | Workout B |
|---|---|
| Goblet Squat 3×8–12 | Dumbbell Split Squat 3×8–12 / side |
| Push-up progression 3×8–15 | Dumbbell Floor Press 3×8–12 |
| One-Arm Row 3×8–12 / side | Dumbbell Bent-Over Row 3×8–12 |
| Dumbbell Romanian Deadlift 3×8–12 | Standing Shoulder Press 3×8–12 |
| Lateral Raise 2×12–20 | Dumbbell Glute Bridge 3×12–20 |
| Dumbbell Curl 2×10–15 | Overhead Triceps Extension 2×10–15 |
| Dead Bug 2×6–12 / side | Plank 2×20–45 s |

**Progression (automatic)**

- *Double progression:* same weight until every set hits the top of the rep range, then
  +1 weight jump.
- *Equipment ceiling:* at your heaviest dumbbell, you move to a harder version of the
  exercise (e.g. Goblet Squat → Double DB Front Squat → Tempo → 1½-rep), with a lighter
  starting weight.
- Below the bottom of the range two sessions in a row → ~10% lighter (or one level
  easier).
- 14+ days off → first session back ~10% lighter.

**Cardio: treadmill, straight after lifting**

- *Run Builder* (10 stages): 6×1 min jog → 20 min continuous. A stage is beaten by
  completing it twice at effort ≤ 7/10; two unfinished sessions step back one stage.
- *Fitness phase*: rotating easy runs, intervals and tempo runs; jog speed auto-adjusts
  from your effort ratings.
- Optional 30-minute incline walk on rest days.

## Features

- Animated demo for every exercise version (45 in total), timed to that exercise's real tempo, with
  captions for each phase of the rep
- Trainer box per exercise: sets, reps, rest, weight, tempo, effort, how it progresses, and why
- Plan page with a week-at-a-glance calendar, session timeline, and expandable exercise rows
- Today screen with the exact weights/reps for the next session and time estimate
- Set logger with weight carry-forward, rest timer (sound + vibration), form cues, and
  "last time" numbers
- Guided treadmill interval timer (speed per segment, survives screen lock/reload)
- Progress: strength charts per exercise, personal bests, bodyweight chart,
  measurements, full history
- Backup export/restore (data stays on your device; nothing is uploaded)

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (progression, cardio, storage, validation)
npm run lint
npm run build
```

Pushing to `main` runs lint + tests + build and deploys to GitHub Pages
(`.github/workflows/deploy.yml`).

Structure:

- `src/data/`: exercise tracks and levels, workouts, cardio stages, tempo, coaching
- `src/demo/`: inverse-kinematics figure rig and per-exercise choreography (tests check that
  bones keep their length, nothing goes through the floor, and loops are seamless)
- `src/logic/`: pure, unit-tested rules (progression, cardio, state, history)
- `src/store/`: localStorage persistence with validation and corrupt-data recovery
- `src/pages/`, `src/components/`: React UI

*General fitness guidance, not medical advice.*
