import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { addPhoto, deletePhoto, listPhotos, replaceAllPhotos, validatePhoto } from './photos.js'
import { completeOnboarding, createInitialState, parseFullBackup, serializeBackup } from '../logic/state.js'

const jpeg = (n = 1) => `data:image/jpeg;base64,${'QUJD'.repeat(n)}`
const photo = (id, date = '2026-09-14', pose = 'front') => ({ id, date, pose, dataUrl: jpeg() })

describe('progress photos', () => {
  it('adds, lists in date order, and deletes', async () => {
    await replaceAllPhotos([])
    await addPhoto(photo('b', '2026-09-20'))
    await addPhoto(photo('a', '2026-09-01', 'side'))
    expect((await listPhotos()).map((p) => p.id)).toEqual(['a', 'b'])
    await deletePhoto('a')
    expect((await listPhotos()).map((p) => p.id)).toEqual(['b'])
  })

  it('rejects anything that is not a valid JPEG photo record', async () => {
    expect(() => validatePhoto({ ...photo('x'), dataUrl: 'data:image/png;base64,AAAA' })).toThrow()
    expect(() => validatePhoto({ ...photo('x'), pose: 'selfie' })).toThrow()
    expect(() => validatePhoto({ ...photo('x'), dataUrl: 'data:image/jpeg;base64,<script>' })).toThrow()
    await expect(addPhoto({ ...photo('x'), date: 'today' })).rejects.toThrow()
  })

  it('replaceAll validates everything before touching storage', async () => {
    await replaceAllPhotos([photo('keep')])
    await expect(replaceAllPhotos([photo('new'), { bad: true }])).rejects.toThrow()
    expect((await listPhotos()).map((p) => p.id)).toEqual(['keep'])
  })

  it('backups can carry photos and are fully validated', () => {
    const s = completeOnboarding(createInitialState(), { name: 'G', equipment: { minWeight: 2.5, increment: 2.5, maxWeight: 15 }, walkSpeed: 3, jogSpeed: 4.5 })
    const withPhotos = serializeBackup(s, new Date(), [photo('p1')])
    const parsed = parseFullBackup(withPhotos, validatePhoto)
    expect(parsed.photos).toEqual([photo('p1')])
    expect(parsed.state).toEqual(s)
    expect(parseFullBackup(serializeBackup(s), validatePhoto).photos).toBeNull()
    const broken = JSON.parse(withPhotos)
    broken.photos[0].pose = 'nope'
    expect(() => parseFullBackup(JSON.stringify(broken), validatePhoto)).toThrow(/photos\[0\]/)
  })
})
