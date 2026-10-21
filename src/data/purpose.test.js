import { describe, expect, it } from 'vitest'
import { TRACKS } from './tracks.js'
import { LEVEL_ADDS, TRACK_PURPOSE } from './purpose.js'

describe('what each exercise does', () => {
  it('every exercise has a purpose, and every harder version says what it adds', () => {
    for (const track of Object.values(TRACKS)) {
      expect(TRACK_PURPOSE[track.id]?.length, track.id).toBeGreaterThan(60)
      track.levels.slice(1).forEach((level) => expect(LEVEL_ADDS[level.id]?.length, level.id).toBeGreaterThan(30))
    }
  })

  it('has no entries for exercises that do not exist', () => {
    const levelIds = new Set(Object.values(TRACKS).flatMap((t) => t.levels.map((l) => l.id)))
    for (const id of Object.keys(TRACK_PURPOSE)) expect(TRACKS[id], id).toBeDefined()
    for (const id of Object.keys(LEVEL_ADDS)) expect(levelIds.has(id), id).toBe(true)
  })
})
