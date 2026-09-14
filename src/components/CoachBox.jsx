import { TRACKS, isPerSide } from '../data/tracks.js'
import { tempoText } from '../data/tempo.js'
import { TRACK_COACHING, effortText } from '../data/coaching.js'
import { formatKg } from '../logic/weights.js'
import { loadLabel } from '../lib/describe.js'

// A trainer's prescription for one exercise: how many, how heavy, how fast,
// how long to rest, how hard, and why.
export default function CoachBox({ trackId, levelIndex, target, showWhy = true }) {
  const track = TRACKS[trackId]
  const level = track.levels[levelIndex]
  const perSide = isPerSide(track, levelIndex)
  const unit = track.type === 'hold' ? 'seconds' : 'reps'

  const items = [
    { label: 'Sets', value: String(target.sets) },
    { label: track.type === 'hold' ? 'Hold' : 'Reps', value: `${target.low}–${target.high}${track.type === 'hold' ? ' s' : ''}`, sub: perSide ? 'each side' : null },
    { label: 'Rest', value: `${track.restSeconds} s`, sub: 'between sets' },
  ]
  if (track.type === 'weighted') {
    items.push({ label: 'Weight', value: target.weight === 0 ? 'Body' : formatKg(target.weight), sub: target.weight === 0 ? 'no dumbbell' : loadLabel(track, levelIndex) })
  }

  return (
    <div className="coach">
      <div className="coach-grid" role="list">
        {items.map((item) => (
          <div className="coach-item" role="listitem" key={item.label}>
            <span className="coach-label">{item.label}</span>
            <span className="coach-value">{item.value}</span>
            {item.sub && <span className="coach-sub">{item.sub}</span>}
          </div>
        ))}
      </div>
      <dl className="coach-lines">
        <div>
          <dt>Tempo</dt>
          <dd>{tempoText(level.id)}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>{effortText(track.type)}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {track.type === 'weighted'
              ? `When every set reaches ${target.high} ${unit}, the app adds weight for next time, or moves you to a harder version once you are at your heaviest dumbbell.`
              : `When every set reaches ${target.high} ${unit}, you move to the next, harder version.`}
          </dd>
        </div>
        {showWhy && TRACK_COACHING[trackId] && (
          <div>
            <dt>Why</dt>
            <dd>{TRACK_COACHING[trackId]}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
