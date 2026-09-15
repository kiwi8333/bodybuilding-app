// Calorie and protein targets, a simple daily food log, and weekly coaching
// that adjusts calories from your real bodyweight trend.

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', factor: 1.2, label: 'Mostly sitting, little walking' },
  { id: 'light', factor: 1.375, label: 'Light: training 1–3 days, desk job' },
  { id: 'moderate', factor: 1.55, label: 'Moderate: training 3–5 days or on your feet a lot' },
  { id: 'very', factor: 1.725, label: 'Very active: physical job plus training' },
]

export const GOALS = [
  { id: 'gain', kcal: 250, label: 'Build muscle (lean gain)', monthlyRate: [0.005, 0.01] },
  { id: 'maintain', kcal: 0, label: 'Recomposition (stay the same weight)', monthlyRate: [-0.0025, 0.0025] },
  { id: 'lose', kcal: -400, label: 'Lose fat, keep muscle', monthlyRate: [-0.03, -0.01] },
]

export const PROTEIN_G_PER_KG = 1.8
export const PROTEIN_RANGE = [1.6, 2.2]
const MIN_KCAL = 1400

// Approximate values for common foods (USDA FoodData Central). Always check
// your packaging for exact numbers.
export const COMMON_FOODS = [
  { id: 'egg', name: 'Egg, large', portion: '1 egg (50 g)', kcal: 72, protein: 6.3 },
  { id: 'chicken', name: 'Chicken breast, cooked', portion: '100 g', kcal: 165, protein: 31 },
  { id: 'tuna', name: 'Tuna in water, drained', portion: '100 g', kcal: 116, protein: 25.5 },
  { id: 'salmon', name: 'Salmon, cooked', portion: '100 g', kcal: 206, protein: 22 },
  { id: 'greek-yogurt', name: 'Greek yogurt, plain non-fat', portion: '170 g pot', kcal: 100, protein: 17 },
  { id: 'milk', name: 'Milk, 2% / semi-skimmed', portion: '1 cup (244 ml)', kcal: 122, protein: 8.1 },
  { id: 'cheddar', name: 'Cheddar cheese', portion: '30 g', kcal: 121, protein: 7.5 },
  { id: 'lentils', name: 'Lentils, cooked', portion: '1 cup (198 g)', kcal: 230, protein: 17.9 },
  { id: 'rice', name: 'White rice, cooked', portion: '1 cup (158 g)', kcal: 205, protein: 4.3 },
  { id: 'pasta', name: 'Pasta, cooked', portion: '1 cup (140 g)', kcal: 220, protein: 8.1 },
  { id: 'oats', name: 'Oats, dry', portion: '40 g', kcal: 156, protein: 6.8 },
  { id: 'bread', name: 'Wholemeal bread', portion: '1 slice (32 g)', kcal: 81, protein: 3.9 },
  { id: 'potato', name: 'Potato, baked', portion: '1 medium (173 g)', kcal: 161, protein: 4.3 },
  { id: 'banana', name: 'Banana', portion: '1 medium (118 g)', kcal: 105, protein: 1.3 },
  { id: 'apple', name: 'Apple', portion: '1 medium (182 g)', kcal: 95, protein: 0.5 },
  { id: 'peanut-butter', name: 'Peanut butter', portion: '1 tbsp (16 g)', kcal: 96, protein: 3.6 },
  { id: 'almonds', name: 'Almonds', portion: '28 g handful', kcal: 164, protein: 6 },
]

export function initialNutrition() {
  return { activity: 'moderate', goal: 'gain', calorieAdjust: 0, lastAdjustDate: null, log: {}, customFoods: [] }
}

// Mifflin–St Jeor resting energy expenditure.
export function bmr({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

export function ageFromBirthYear(birthYear, now = new Date()) {
  return Number.isInteger(birthYear) ? now.getFullYear() - birthYear : null
}

/**
 * Daily targets. Returns { ready: false, missing: [...] } until sex, age,
 * height and at least one bodyweight entry exist.
 */
export function dailyTargets(profile, nutrition, bodyweight, now = new Date()) {
  const weightKg = bodyweight.at(-1)?.kg
  const age = ageFromBirthYear(profile.birthYear, now)
  const missing = []
  if (profile.sex !== 'male' && profile.sex !== 'female') missing.push('sex')
  if (!age) missing.push('age')
  if (!profile.heightCm) missing.push('height')
  if (!weightKg) missing.push('bodyweight')
  const proteinFor = (kg) => ({
    protein: Math.round(kg * PROTEIN_G_PER_KG),
    proteinRange: [Math.round(kg * PROTEIN_RANGE[0]), Math.round(kg * PROTEIN_RANGE[1])],
  })
  if (missing.length) return { ready: false, missing, ...(weightKg ? proteinFor(weightKg) : {}) }

  const activity = ACTIVITY_LEVELS.find((a) => a.id === nutrition.activity) ?? ACTIVITY_LEVELS[2]
  const goal = GOALS.find((g) => g.id === nutrition.goal) ?? GOALS[0]
  const rest = bmr({ sex: profile.sex, age, heightCm: profile.heightCm, weightKg })
  const maintenance = rest * activity.factor
  const kcal = Math.max(MIN_KCAL, Math.round((maintenance + goal.kcal + nutrition.calorieAdjust) / 10) * 10)
  return { ready: true, bmr: Math.round(rest), maintenance: Math.round(maintenance), kcal, weightKg, ...proteinFor(weightKg) }
}

export function dayTotals(entries = []) {
  return entries.reduce(
    (t, e) => ({ kcal: t.kcal + e.kcal, protein: Math.round((t.protein + e.protein) * 10) / 10 }),
    { kcal: 0, protein: 0 },
  )
}

export function validateFood({ name, kcal, protein }) {
  const n = String(name ?? '').trim().slice(0, 60)
  const k = Number(kcal)
  const p = Number(protein)
  if (!n) throw new Error('Give the food a name.')
  if (!Number.isFinite(k) || k < 0 || k > 5000) throw new Error('Calories must be between 0 and 5000.')
  if (!Number.isFinite(p) || p < 0 || p > 300) throw new Error('Protein must be between 0 and 300 g.')
  return { name: n, kcal: Math.round(k), protein: Math.round(p * 10) / 10 }
}

/**
 * Compare the average of the last 7 days of weigh-ins with the 7 days before
 * (needs 2+ weigh-ins in each window) against the goal's healthy rate.
 * Returns null when there is not enough data, otherwise a suggestion.
 */
export function weeklyCheckIn(bodyweight, goalId, now = new Date()) {
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]
  const day = 24 * 60 * 60 * 1000
  const t = (d) => new Date(`${d}T12:00:00`).getTime()
  const end = now.getTime()
  const recent = bodyweight.filter((e) => t(e.date) > end - 7 * day && t(e.date) <= end)
  const prior = bodyweight.filter((e) => t(e.date) > end - 14 * day && t(e.date) <= end - 7 * day)
  if (recent.length < 2 || prior.length < 2) return null
  const avg = (list) => list.reduce((s, e) => s + e.kg, 0) / list.length
  const a = avg(prior)
  const b = avg(recent)
  const weeklyChange = b - a
  // Healthy weekly change range for this goal, from the monthly rate.
  const lo = (goal.monthlyRate[0] * a) / 4.345
  const hi = (goal.monthlyRate[1] * a) / 4.345
  const round = (x) => Math.round(x * 100) / 100
  let adjust = 0
  if (weeklyChange < lo) adjust = 150
  else if (weeklyChange > hi) adjust = -150
  return { priorAvg: round(a), recentAvg: round(b), weeklyChange: round(weeklyChange), range: [round(lo), round(hi)], adjust }
}
