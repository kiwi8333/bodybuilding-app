import { TRACKS } from '../data/tracks.js'
import { purposeOf } from '../data/purpose.js'

// "What it does": the muscles an exercise works and what it builds, plus
// what the current harder version adds. A swap does the same job as the
// exercise it replaces, so it shows that exercise's purpose.
export default function ExercisePurpose({ trackId, levelIndex, swapped = false, showMuscles = true }) {
  const track = TRACKS[trackId]
  const level = track.levels[levelIndex]
  const { does, adds } = purposeOf(trackId, level.id)
  if (!does) return null
  return (
    <div className="purpose">
      <div className="row between wrap" style={{ gap: 6 }}>
        <span className="purpose-label">What it does</span>
        {showMuscles && <span className="purpose-muscles">{track.muscles}</span>}
      </div>
      <p>{does}</p>
      {adds && !swapped && (
        <p className="purpose-adds">
          <strong>This version:</strong> {adds}
        </p>
      )}
    </div>
  )
}
