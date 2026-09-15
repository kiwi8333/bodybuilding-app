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
- Backup to Google Drive, iCloud Files or email via the share menu (optionally with photos),
  weekly backup reminders, and full validated restore
- **Food:** calorie and protein targets (Mifflin–St Jeor + goal), a quick-add list of common
  foods, saved custom foods, and a weekly check-in that adjusts calories from your weigh-ins
- **Workout reminders:** push notifications on training days, a nudge after a missed session,
  and a Sunday backup reminder (see "Reminders setup" below)
- **Deload weeks:** offered every 24 workouts; one set fewer and ~10% lighter for 3 sessions,
  with progression paused
- **Exercise swaps:** an equivalent movement per exercise (no chair, sore joint…), one-off or
  remembered, with its own demo; progression on the original is paused while swapped
- **Progress photos:** stored privately on the phone (IndexedDB) with first-vs-latest comparison
- **Effort per set:** optional reps-in-reserve; easy sets earn a double weight jump, sets to
  failure repeat the weight
- **Heavier-dumbbell alert** when several exercises have outgrown the dumbbells
- **5-minute rest-day mobility routine** with guided timer and demos
- **Heart rate:** avg/max HR per cardio session, personal zones (Tanaka max HR, Karvonen when
  resting HR is known), target zone per treadmill segment and a heart-rate trend chart

## Reminders setup

Reminders need a tiny server because GitHub Pages is static:

- **Sender:** `.github/workflows/reminders.yml` runs every 15 minutes and sends due pushes.
- **Receiver:** `api/*.js` on Vercel stores each phone's *sealed* reminder settings in a private
  Vercel Blob. Phones encrypt with a public key; only the sender (GitHub secret) can decrypt.
- **Secrets** (already set): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SEALING_PRIVATE_JWK`,
  `WORKER_SIGNING_KEY`.

To connect: import this repository at vercel.com (framework "Other"), add a Blob store to the
project (Storage → Create → Blob, connect to the project), redeploy, then set the repository
variable `PUSH_API_URL` to the Vercel URL (e.g. `https://bodybuilding-app.vercel.app`) and
re-run the "Test and deploy" workflow.

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
- `src/logic/`: pure, unit-tested rules (progression, cardio, state, history, nutrition, heart, deload)
- `src/reminders/`: schedule rules, sealing (Web Crypto) and the phone-side push client
- `api/`: Vercel functions for reminders; `scripts/send-reminders.mjs`: the scheduled sender
- `src/store/`: localStorage persistence with validation and corrupt-data recovery
- `src/pages/`, `src/components/`: React UI

*General fitness guidance, not medical advice.*
