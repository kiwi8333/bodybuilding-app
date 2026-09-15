// Heart-rate zones from your watch/strap data.
// Max HR: your measured max if you have one, otherwise Tanaka's formula
// (208 − 0.7 × age), which is more accurate than 220 − age.
// With a resting HR the zones use heart-rate reserve (Karvonen), which fits
// individuals better; without it, percentages of max HR.

export const ZONES = [
  { zone: 1, name: 'Recovery', lo: 0.5, hi: 0.6, feel: 'Very easy, warm-up and cool-down' },
  { zone: 2, name: 'Aerobic base', lo: 0.6, hi: 0.7, feel: 'Easy, full conversation. Builds endurance' },
  { zone: 3, name: 'Tempo', lo: 0.7, hi: 0.8, feel: 'Steady, short sentences' },
  { zone: 4, name: 'Threshold', lo: 0.8, hi: 0.9, feel: 'Hard, a few words at a time' },
  { zone: 5, name: 'Max effort', lo: 0.9, hi: 1.0, feel: 'Very hard, short bursts only' },
]

export function estimatedMaxHr(age) {
  return Math.round(208 - 0.7 * age)
}

export function effectiveMaxHr(heart, age) {
  if (Number.isInteger(heart?.maxHr)) return { maxHr: heart.maxHr, measured: true }
  if (Number.isInteger(age) && age > 0) return { maxHr: estimatedMaxHr(age), measured: false }
  return null
}

export function heartZones(heart, age) {
  const max = effectiveMaxHr(heart, age)
  if (!max) return null
  const resting = Number.isInteger(heart?.restingHr) ? heart.restingHr : null
  const bpm = (pct) => Math.round(resting !== null ? resting + pct * (max.maxHr - resting) : pct * max.maxHr)
  return {
    maxHr: max.maxHr,
    measured: max.measured,
    method: resting !== null ? 'reserve' : 'max',
    zones: ZONES.map((z) => ({ ...z, loBpm: bpm(z.lo), hiBpm: bpm(z.hi) })),
  }
}

// Which zones each kind of cardio should sit in.
export function targetZonesFor(segmentKind, stageId = '') {
  if (segmentKind === 'walk') return stageId === 'rest-walk' ? [2, 2] : [1, 2]
  if (segmentKind === 'hard') return stageId === 'f-tempo' ? [3, 4] : [4, 5]
  if (stageId.startsWith('f-easy')) return [2, 2]
  return [2, 3]
}

export function zoneRangeText(zoneInfo, [from, to]) {
  if (!zoneInfo) return null
  const a = zoneInfo.zones[from - 1]
  const b = zoneInfo.zones[to - 1]
  return `Zone ${from === to ? from : `${from}–${to}`} · ${a.loBpm}–${b.hiBpm} bpm`
}

export function validateHr(value, { min, max, label }) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number between ${min} and ${max}.`)
  return n
}
