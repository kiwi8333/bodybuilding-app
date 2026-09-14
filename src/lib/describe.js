import { TRACKS, isPerSide } from '../data/tracks.js'
import { formatKg } from '../logic/weights.js'

export function loadLabel(track, levelIndex) {
  if (track.type !== 'weighted') return ''
  return track.levels[levelIndex].load === 'one' ? 'one dumbbell' : 'per dumbbell'
}

// e.g. "3 × 8–12 · 7.5 kg per dumbbell · each side"
export function targetText(trackId, levelIndex, target) {
  const track = TRACKS[trackId]
  const unit = track.type === 'hold' ? ' s' : ''
  const parts = [`${target.sets} × ${target.low}–${target.high}${unit}`]
  if (track.type === 'weighted' && target.weight !== null) {
    parts.push(target.weight === 0 ? 'bodyweight' : `${formatKg(target.weight)} ${loadLabel(track, levelIndex)}`)
  }
  if (isPerSide(track, levelIndex)) parts.push('each side')
  return parts.join(' · ')
}

export function setsText(exercise) {
  const unit = exercise.type === 'hold' ? 's' : ''
  if (exercise.type === 'weighted') {
    const weights = new Set(exercise.sets.map((s) => s.weight))
    if (weights.size === 1) return `${formatKg(exercise.sets[0].weight)} × ${exercise.sets.map((s) => s.value).join(', ')}`
    return exercise.sets.map((s) => `${formatKg(s.weight)}×${s.value}`).join(', ')
  }
  return exercise.sets.map((s) => `${s.value}${unit}`).join(', ')
}
