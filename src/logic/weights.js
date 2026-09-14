// Dumbbell weights are handled in hundredths of a kg internally so that
// 1.25 kg steps never produce floating-point drift (0.1 + 0.2 problems).

const toCenti = (kg) => Math.round(kg * 100)
const fromCenti = (c) => c / 100

// Every weight you can load on one dumbbell, ascending.
// allowBodyweight adds 0 (no dumbbell) for levels where that makes sense.
export function availableWeights(equipment, { allowBodyweight = false } = {}) {
  const min = toCenti(equipment.minWeight)
  const step = toCenti(equipment.increment)
  const max = toCenti(equipment.maxWeight)
  const out = allowBodyweight ? [0] : []
  if (step <= 0 || max < min) return out.length ? out : [fromCenti(min)]
  for (let c = min; c <= max; c += step) {
    if (c > 0 || !allowBodyweight) out.push(fromCenti(c))
  }
  return out
}

// Heaviest available weight that is <= kg. If kg is below everything,
// the lightest available weight.
export function roundDownToAvailable(kg, weights) {
  const target = toCenti(kg)
  let best = weights[0]
  for (const w of weights) {
    if (toCenti(w) <= target) best = w
  }
  return best
}

// Next heavier available weight, or null when already at the heaviest.
export function nextWeightUp(kg, weights) {
  const current = toCenti(kg)
  return weights.find((w) => toCenti(w) > current) ?? null
}

// Next lighter available weight, or the lightest when already there.
export function nextWeightDown(kg, weights) {
  const current = toCenti(kg)
  const lighter = weights.filter((w) => toCenti(w) < current)
  return lighter.length ? lighter.at(-1) : weights[0]
}

export function sameWeight(a, b) {
  return toCenti(a) === toCenti(b)
}

export function formatKg(kg) {
  if (kg === 0) return 'Bodyweight'
  return `${Number(kg.toFixed(2))} kg`
}
