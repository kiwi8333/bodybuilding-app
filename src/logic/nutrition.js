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

// Weight-loss pace, in kg per week. null = the standard goal deficit above.
export const LOSS_RATES = [
  { kg: 0.25, label: 'Slow: 0.25 kg a week' },
  { kg: 0.5, label: 'Steady: 0.5 kg a week (recommended)' },
  { kg: 0.75, label: 'Fast: 0.75 kg a week' },
  { kg: 1, label: 'Very fast: 1 kg a week' },
]
// About 7,700 kcal of deficit per kg of body fat.
const KCAL_PER_KG = 7700
const STANDARD_LOSS_KG = (400 * 7) / KCAL_PER_KG

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
]

// The meal you are most likely logging at this time of day.
export function mealForTime(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 17 && h < 21.5) return 'dinner'
  return 'snacks'
}

// Fat about 28% of calories; carbs fill the rest after protein.
const FAT_SHARE = 0.28

export const PROTEIN_G_PER_KG = 1.8
export const PROTEIN_RANGE = [1.6, 2.2]
const MIN_KCAL = 1400

// Approximate values for common foods (USDA FoodData Central). Always check
// your packaging for exact numbers.
export const COMMON_FOODS = [
  { id: 'egg', name: 'Egg, large', portion: '1 egg (50 g)', kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: 'chicken', name: 'Chicken breast, cooked', portion: '100 g', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'tuna', name: 'Tuna in water, drained', portion: '100 g', kcal: 116, protein: 25.5, carbs: 0, fat: 0.8 },
  { id: 'salmon', name: 'Salmon, cooked', portion: '100 g', kcal: 206, protein: 22, carbs: 0, fat: 12.4 },
  { id: 'greek-yogurt', name: 'Greek yogurt, plain non-fat', portion: '170 g pot', kcal: 100, protein: 17, carbs: 6.1, fat: 0.7 },
  { id: 'milk', name: 'Milk, 2% / semi-skimmed', portion: '1 cup (244 ml)', kcal: 122, protein: 8.1, carbs: 11.7, fat: 4.8 },
  { id: 'cheddar', name: 'Cheddar cheese', portion: '30 g', kcal: 121, protein: 7.5, carbs: 0.4, fat: 9.9 },
  { id: 'lentils', name: 'Lentils, cooked', portion: '1 cup (198 g)', kcal: 230, protein: 17.9, carbs: 39.9, fat: 0.8 },
  { id: 'rice', name: 'White rice, cooked', portion: '1 cup (158 g)', kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4 },
  { id: 'pasta', name: 'Pasta, cooked', portion: '1 cup (140 g)', kcal: 220, protein: 8.1, carbs: 43.2, fat: 1.3 },
  { id: 'oats', name: 'Oats, dry', portion: '40 g', kcal: 156, protein: 6.8, carbs: 26.5, fat: 2.8 },
  { id: 'bread', name: 'Wholemeal bread', portion: '1 slice (32 g)', kcal: 81, protein: 3.9, carbs: 13.8, fat: 1.1 },
  { id: 'potato', name: 'Potato, baked', portion: '1 medium (173 g)', kcal: 161, protein: 4.3, carbs: 36.6, fat: 0.2 },
  { id: 'banana', name: 'Banana', portion: '1 medium (118 g)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: 'apple', name: 'Apple', portion: '1 medium (182 g)', kcal: 95, protein: 0.5, carbs: 25.1, fat: 0.3 },
  { id: 'peanut-butter', name: 'Peanut butter', portion: '1 tbsp (16 g)', kcal: 96, protein: 3.6, carbs: 3.6, fat: 8.2 },
  { id: 'almonds', name: 'Almonds', portion: '28 g handful', kcal: 164, protein: 6, carbs: 6.1, fat: 14.2 },
]

export function initialNutrition() {
  return { activity: 'moderate', goal: 'gain', calorieAdjust: 0, lastAdjustDate: null, log: {}, customFoods: [], goalWeight: null, weeklyRate: null }
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
  // A chosen weight-loss pace replaces the standard deficit.
  const goalKcal = goal.id === 'lose' && nutrition.weeklyRate ? -(nutrition.weeklyRate * KCAL_PER_KG) / 7 : goal.kcal
  const kcal = Math.max(MIN_KCAL, Math.round((maintenance + goalKcal + nutrition.calorieAdjust) / 10) * 10)
  const protein = proteinFor(weightKg)
  const fat = Math.round((kcal * FAT_SHARE) / 9)
  const carbs = Math.max(50, Math.round((kcal - protein.protein * 4 - fat * 9) / 4))
  return { ready: true, bmr: Math.round(rest), maintenance: Math.round(maintenance), kcal, weightKg, fat, carbs, floored: kcal === MIN_KCAL, ...protein }
}

const r1 = (x) => Math.round(x * 10) / 10

// Totals for a day. Entries logged before carbs and fat were tracked count as
// zero for those, and `macrosComplete` says whether every entry had them.
export function dayTotals(entries = []) {
  const t = entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein, carbs: acc.carbs + (e.carbs ?? 0), fat: acc.fat + (e.fat ?? 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return { kcal: t.kcal, protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), macrosComplete: entries.every((e) => e.carbs != null && e.fat != null) }
}

// Optional grams (carbs, fat): blank means unknown (null).
function optionalGrams(value, label) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 500) throw new Error(`${label} must be between 0 and 500 g.`)
  return r1(n)
}

export function validateFood({ name, kcal, protein, carbs, fat }) {
  const n = String(name ?? '').trim().slice(0, 60)
  const k = Number(kcal)
  const p = Number(protein)
  if (!n) throw new Error('Give the food a name.')
  if (!Number.isFinite(k) || k < 0 || k > 5000) throw new Error('Calories must be between 0 and 5000.')
  if (!Number.isFinite(p) || p < 0 || p > 300) throw new Error('Protein must be between 0 and 300 g.')
  return { name: n, kcal: Math.round(k), protein: r1(p), carbs: optionalGrams(carbs, 'Carbs'), fat: optionalGrams(fat, 'Fat') }
}

/**
 * Time to reach a goal weight at the current pace. Returns null when there
 * is no goal, or { kgToGo, weeks, date, reached }.
 */
export function goalProjection(nutrition, currentKg, now = new Date()) {
  const goalKg = nutrition.goalWeight
  if (!goalKg || !currentKg) return null
  const kgToGo = r1(currentKg - goalKg)
  if (nutrition.goal === 'lose') {
    if (kgToGo <= 0) return { kgToGo: 0, weeks: 0, date: null, reached: true }
    const perWeek = nutrition.weeklyRate ?? STANDARD_LOSS_KG
    const weeks = kgToGo / perWeek
    return { kgToGo, weeks: Math.ceil(weeks), date: new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000), reached: false }
  }
  if (nutrition.goal === 'gain') {
    if (kgToGo >= 0) return { kgToGo: 0, weeks: 0, date: null, reached: true }
    return { kgToGo: Math.abs(kgToGo), weeks: null, date: null, reached: false }
  }
  return { kgToGo: Math.abs(kgToGo), weeks: null, date: null, reached: Math.abs(kgToGo) < 1 }
}

/** Days in a row (ending today, or yesterday if nothing logged yet today) with food logged. */
export function loggingStreak(log, today) {
  let streak = 0
  const d = new Date(`${today}T12:00:00`)
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (!log[key(d)]?.length) d.setDate(d.getDate() - 1)
  while (log[key(d)]?.length) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/**
 * Compare the average of the last 7 days of weigh-ins with the 7 days before
 * (needs 2+ weigh-ins in each window) against the goal's healthy rate.
 * Returns null when there is not enough data, otherwise a suggestion.
 */
export function weeklyCheckIn(bodyweight, goalId, now = new Date(), weeklyRate = null) {
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
  // With a chosen loss pace, aim within about ±40% of it each week.
  const paced = goal.id === 'lose' && weeklyRate
  const lo = paced ? -weeklyRate * 1.4 : (goal.monthlyRate[0] * a) / 4.345
  const hi = paced ? -weeklyRate * 0.6 : (goal.monthlyRate[1] * a) / 4.345
  const round = (x) => Math.round(x * 100) / 100
  let adjust = 0
  if (weeklyChange < lo) adjust = 150
  else if (weeklyChange > hi) adjust = -150
  return { priorAvg: round(a), recentAvg: round(b), weeklyChange: round(weeklyChange), range: [round(lo), round(hi)], adjust }
}
