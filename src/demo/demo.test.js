import { describe, expect, it } from 'vitest'
import { TRACKS } from '../data/tracks.js'
import { TEMPO, repPhases, repSeconds, tempoText } from '../data/tempo.js'
import { BONES, FLOOR_Y, VIEWBOX, circleIntersectUpper, dist, skeleton, solveTwoBone } from './rig.js'
import { movementFor } from './movements.js'
import { buildTimeline, frameAt, verticalBounds } from './timeline.js'

const ALL_LEVELS = Object.values(TRACKS).flatMap((t) => t.levels.map((l) => ({ track: t, level: l })))

describe('rig geometry', () => {
  it('two-bone IK keeps bone lengths exact and reaches reachable targets', () => {
    const root = [0, 0]
    for (const target of [[10, 30], [-20, 15], [30, 5], [0, 51]]) {
      const { joint, end } = solveTwoBone(root, target, 26, 26, [1, 0])
      expect(dist(root, joint)).toBeCloseTo(26, 6)
      expect(dist(joint, end)).toBeCloseTo(26, 6)
      expect(dist(end, target)).toBeLessThan(0.01)
    }
  })

  it('clamps unreachable targets to a straight limb', () => {
    const { joint, end } = solveTwoBone([0, 0], [0, 100], 26, 26, [1, 0])
    expect(dist([0, 0], end)).toBeCloseTo(52, 2)
    expect(dist([0, 0], joint)).toBeCloseTo(26, 6)
  })

  it('the pole picks the bend direction', () => {
    const forward = solveTwoBone([0, 0], [0, 40], 26, 26, [1, 0])
    const back = solveTwoBone([0, 0], [0, 40], 26, 26, [-1, 0])
    expect(forward.joint[0]).toBeGreaterThan(0)
    expect(back.joint[0]).toBeLessThan(0)
  })

  it('circle intersection returns the upper point', () => {
    const p = circleIntersectUpper([0, 0], 5, [8, 0], 5)
    expect(p[0]).toBeCloseTo(4)
    expect(p[1]).toBeCloseTo(-3)
  })
})

describe('tempo data', () => {
  it('every level has a tempo and readable text', () => {
    for (const { level } of ALL_LEVELS) {
      expect(TEMPO[level.id], level.id).toBeDefined()
      expect(tempoText(level.id).length, level.id).toBeGreaterThan(3)
      expect(repSeconds(level.id), level.id).toBeGreaterThan(0)
    }
  })

  it('has no tempo entries for levels that do not exist', () => {
    const ids = new Set(ALL_LEVELS.map(({ level }) => level.id))
    for (const id of Object.keys(TEMPO)) expect(ids.has(id), id).toBe(true)
  })

  it('tempo matches what the cues promise', () => {
    expect(tempoText('tempo-front-squat')).toBe('3 s down · 1 s pause · 1 s up')
    expect(tempoText('tempo-one-arm-row')).toBe('1 s up · 2 s squeeze · 3 s down')
    expect(tempoText('pause-floor-press')).toBe('2 s down · 2 s pause · 1 s up')
    expect(tempoText('db-glute-bridge')).toBe('1 s up · 1 s squeeze · 2 s down')
    expect(tempoText('forearm-plank')).toMatch(/Hold/)
  })

  it('1½ reps include the extra half', () => {
    expect(repPhases('one-and-half-front-squat').map((p) => p.to)).toEqual(['bottom', 'half', 'bottom', 'top'])
    expect(repPhases('one-and-half-bent-over-row').map((p) => p.to)).toEqual(['top', 'half', 'top', 'bottom'])
  })

  it('zero-length phases are skipped', () => {
    expect(repPhases('goblet-squat').map((p) => p.to)).toEqual(['bottom', 'top'])
  })
})

describe('exercise demos', () => {
  for (const { track, level } of ALL_LEVELS) {
    it(`${level.id}: every pose exists and the figure stays sane through the whole rep`, () => {
      const movement = movementFor(level.id)
      const timeline = buildTimeline(level.id)
      for (const step of timeline.steps) {
        expect(movement.poses[step.from], `${level.id} missing pose ${step.from}`).toBeDefined()
        expect(movement.poses[step.to], `${level.id} missing pose ${step.to}`).toBeDefined()
        expect(step.label.length).toBeGreaterThan(0)
      }
      expect(timeline.total).toBeCloseTo(repSeconds(level.id), 6)

      const samples = 120
      for (let i = 0; i <= samples; i++) {
        const { pose } = frameAt(timeline, (timeline.total * i) / samples)
        if (movement.view === 'front') {
          expect(pose.arm).toBeGreaterThanOrEqual(0)
          expect(pose.arm).toBeLessThanOrEqual(95)
          continue
        }
        const sk = skeleton(pose)
        for (const [name, p] of Object.entries(sk)) {
          expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${level.id} ${name} NaN`).toBe(true)
          expect(p[0], `${level.id} ${name} x`).toBeGreaterThanOrEqual(VIEWBOX.x)
          expect(p[0], `${level.id} ${name} x`).toBeLessThanOrEqual(VIEWBOX.x + VIEWBOX.w)
          expect(p[1], `${level.id} ${name} y`).toBeGreaterThanOrEqual(VIEWBOX.y + 4)
          // Nothing sinks through the floor (feet/toes rest on it).
          expect(p[1], `${level.id} ${name} below floor at sample ${i}`).toBeLessThanOrEqual(FLOOR_Y + 0.5)
        }
        expect(sk.head[1] + BONES.head, `${level.id} head through floor`).toBeLessThanOrEqual(FLOOR_Y + 0.5)
        // Bones keep their length.
        expect(dist(sk.hip, sk.kneeN)).toBeCloseTo(BONES.thigh, 4)
        expect(dist(sk.kneeN, sk.ankleN)).toBeCloseTo(BONES.shin, 4)
        expect(dist(sk.shoulder, sk.elbowN)).toBeCloseTo(BONES.upperArm, 4)
        expect(dist(sk.elbowN, sk.wristN)).toBeCloseTo(BONES.forearm, 4)
        expect(dist(sk.hip, sk.shoulder)).toBeCloseTo(BONES.torso, 4)
      }
      // Hands and feet that should reach their targets at key poses do (within 2.5 px).
      for (const [name, p] of Object.entries(movement.poses)) {
        if (movement.view === 'front') continue
        const sk = skeleton(p)
        expect(dist(sk.wristN, p.handN), `${level.id} ${name} near hand unreachable`).toBeLessThan(2.5)
        expect(dist(sk.ankleN, p.footN), `${level.id} ${name} near foot unreachable`).toBeLessThan(2.5)
        if (p.footF) expect(dist(sk.ankleF, p.footF), `${level.id} ${name} far foot unreachable`).toBeLessThan(2.5)
        if (p.handF) expect(dist(sk.wristF, p.handF), `${level.id} ${name} far hand unreachable`).toBeLessThan(2.5)
      }
      expect(track.id).toBeTruthy()
    })
  }

  it('the loop is seamless: end of the rep equals the start', () => {
    for (const { level } of ALL_LEVELS) {
      const tl = buildTimeline(level.id)
      const a = frameAt(tl, 0).pose
      const b = frameAt(tl, tl.total - 1e-9).pose
      if (tl.movement.view === 'front') {
        expect(a.arm).toBeCloseTo(b.arm, 3)
        continue
      }
      const sa = skeleton(a)
      const sb = skeleton(b)
      for (const k of Object.keys(sa)) expect(dist(sa[k], sb[k]), `${level.id} ${k}`).toBeLessThan(0.05)
    }
  })

  it('planted hands and feet do not slide during push-ups', () => {
    const tl = buildTimeline('floor-pushup')
    const start = skeleton(frameAt(tl, 0).pose)
    for (let i = 1; i < 30; i++) {
      const sk = skeleton(frameAt(tl, (tl.total * i) / 30).pose)
      expect(dist(sk.wristN, start.wristN)).toBeLessThan(0.5)
      expect(dist(sk.ankleN, start.ankleN)).toBeLessThan(1.5)
    }
  })

  it('each demo frame fits everything it draws', () => {
    for (const { level } of ALL_LEVELS) {
      const tl = buildTimeline(level.id)
      const { y, h } = verticalBounds(tl, { skeleton, FLOOR_Y, VIEWBOX, headRadius: BONES.head })
      expect(y, level.id).toBeGreaterThanOrEqual(VIEWBOX.y)
      expect(y + h, level.id).toBeGreaterThanOrEqual(FLOOR_Y)
      expect(h, level.id).toBeGreaterThanOrEqual(VIEWBOX.w / 2)
      if (tl.movement.view === 'front') continue
      for (let i = 0; i < 60; i++) {
        const sk = skeleton(frameAt(tl, (tl.total * i) / 60).pose)
        expect(sk.head[1] - BONES.head, `${level.id} head cropped`).toBeGreaterThanOrEqual(y)
        expect(Math.min(sk.wristN[1], sk.wristF[1]) - 4.5, `${level.id} dumbbell cropped`).toBeGreaterThanOrEqual(y)
      }
      for (const prop of tl.movement.props) {
        const propTop = prop.type === 'chair' ? prop.seatY - 26 : prop.type === 'sofa' ? prop.topY - 18 : prop.topY - 3
        expect(propTop, `${level.id} prop cropped`).toBeGreaterThanOrEqual(y)
      }
    }
  })

  it('front squat depth: hips drop well below the standing height', () => {
    const m = movementFor('goblet-squat')
    expect(m.poses.bottom.hip[1] - m.poses.top.hip[1]).toBeGreaterThan(25)
  })
})
