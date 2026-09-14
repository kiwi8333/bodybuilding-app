// A 2D side-view figure driven by inverse kinematics. Poses name where the
// hips are, the torso angle, and where hands and feet should be; knees and
// elbows are solved so bone lengths never change. Everything here is pure so
// the geometry is unit-tested.

export const BONES = { thigh: 26, shin: 26, torso: 32, upperArm: 17, forearm: 16, neck: 4, head: 6.5, foot: 7 }
export const LEG = BONES.thigh + BONES.shin
export const ARM = BONES.upperArm + BONES.forearm
export const FLOOR_Y = 110
export const VIEWBOX = { x: 0, y: -20, w: 160, h: 134 }

const DEG = Math.PI / 180
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Direction for an angle in degrees: 0 = up, 90 = right (+x), 180 = down, -90 = left.
export function dir(deg) {
  return [Math.sin(deg * DEG), -Math.cos(deg * DEG)]
}

export function angleOf(dx, dy) {
  return Math.atan2(dx, -dy) / DEG
}

export const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k]
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

/**
 * Two-bone IK. Returns { joint, end } where joint is the knee/elbow and end
 * is where the hand/foot actually lands (the target, pulled in if it is out of
 * reach). `pole` picks which way the joint bends.
 */
export function solveTwoBone(root, target, l1, l2, pole) {
  const dx = target[0] - root[0]
  const dy = target[1] - root[1]
  const raw = Math.hypot(dx, dy)
  const d = clamp(raw, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
  const ux = raw > 1e-9 ? dx / raw : 0
  const uy = raw > 1e-9 ? dy / raw : 1
  const base = Math.atan2(uy, ux)
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
  const c1 = [root[0] + l1 * Math.cos(base + a), root[1] + l1 * Math.sin(base + a)]
  const c2 = [root[0] + l1 * Math.cos(base - a), root[1] + l1 * Math.sin(base - a)]
  const score = (c) => (c[0] - root[0]) * pole[0] + (c[1] - root[1]) * pole[1]
  const joint = score(c1) >= score(c2) ? c1 : c2
  return { joint, end: [root[0] + ux * d, root[1] + uy * d] }
}

// Intersection of two circles; returns the point with the smaller y (higher on screen).
export function circleIntersectUpper(c1, r1, c2, r2) {
  const d = dist(c1, c2)
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) throw new Error('circles do not intersect')
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a))
  const mx = c1[0] + (a * (c2[0] - c1[0])) / d
  const my = c1[1] + (a * (c2[1] - c1[1])) / d
  const p1 = [mx + (h * (c2[1] - c1[1])) / d, my - (h * (c2[0] - c1[0])) / d]
  const p2 = [mx - (h * (c2[1] - c1[1])) / d, my + (h * (c2[0] - c1[0])) / d]
  return p1[1] <= p2[1] ? p1 : p2
}

// A straight body from ankle to shoulder (planks, push-ups): hip and torso angle.
export function straightBody(ankle, shoulder) {
  const len = dist(ankle, shoulder)
  const u = [(shoulder[0] - ankle[0]) / len, (shoulder[1] - ankle[1]) / len]
  return { hip: add(shoulder, u, -BONES.torso), torso: angleOf(u[0], u[1]) }
}

export function shoulderOf(pose) {
  return add(pose.hip, dir(pose.torso), BONES.torso)
}

const LIMB_ROOT = { handN: 'shoulder', handF: 'shoulder', footN: 'hip', footF: 'hip' }
const DEFAULT_SPACE = { handN: 'shoulder', handF: 'shoulder', footN: 'world', footF: 'world' }

function rootFor(pose, limb) {
  return LIMB_ROOT[limb] === 'shoulder' ? shoulderOf(pose) : pose.hip
}

const lerp = (a, b, t) => a + (b - a) * t

function lerpAngle(a, b, t) {
  let delta = ((b - a + 540) % 360) - 180
  if (delta === -180 && b - a > 0) delta = 180
  return a + delta * t
}

/**
 * Blend two poses. Limbs in 'world' space move in straight lines (planted feet
 * and hands stay put); limbs in 'shoulder'/'hip' space swing in arcs around
 * their joint, so a straight arm stays straight while it moves.
 */
export function blendPoses(a, b, t) {
  const out = {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const va = a[k] ?? b[k]
    const vb = b[k] ?? a[k]
    if (typeof va === 'number') out[k] = lerp(va, vb, t)
    else if (Array.isArray(va) && typeof va[0] === 'number') out[k] = [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)]
    else out[k] = t < 0.5 ? va : vb
  }
  const space = { ...DEFAULT_SPACE, ...a.space, ...b.space }
  for (const limb of Object.keys(LIMB_ROOT)) {
    if (!a[limb] || !b[limb] || space[limb] === 'world') continue
    const ra = rootFor(a, limb)
    const rb = rootFor(b, limb)
    const angA = angleOf(a[limb][0] - ra[0], a[limb][1] - ra[1])
    const angB = angleOf(b[limb][0] - rb[0], b[limb][1] - rb[1])
    const rad = lerp(dist(ra, a[limb]), dist(rb, b[limb]), t)
    out[limb] = add(rootFor(out, limb), dir(lerpAngle(angA, angB, t)), rad)
  }
  return out
}

/**
 * Compute every drawable point of a pose.
 * pose = { hip, torso, head?, footN, footF, handN, handF,
 *          kneeN?, kneeF?, elbowN?, elbowF?  (pole vectors),
 *          toeN?, toeF? (foot angle, default 90 = pointing right) }
 */
export function skeleton(pose) {
  const hip = pose.hip
  const shoulder = shoulderOf(pose)
  const headDir = dir(pose.head ?? pose.torso)
  const head = add(shoulder, headDir, BONES.neck + BONES.head)
  const knee = pose.knee ?? [1, 0]
  const elbow = pose.elbow ?? [0, 1]
  const legN = solveTwoBone(hip, pose.footN, BONES.thigh, BONES.shin, pose.kneeN ?? knee)
  const legF = solveTwoBone(hip, pose.footF ?? pose.footN, BONES.thigh, BONES.shin, pose.kneeF ?? knee)
  const armN = solveTwoBone(shoulder, pose.handN, BONES.upperArm, BONES.forearm, pose.elbowN ?? elbow)
  const armF = solveTwoBone(shoulder, pose.handF ?? pose.handN, BONES.upperArm, BONES.forearm, pose.elbowF ?? elbow)
  const toe = (ankle, deg) => add(ankle, dir(deg ?? 90), BONES.foot)
  return {
    hip,
    shoulder,
    head,
    kneeN: legN.joint,
    ankleN: legN.end,
    toeN: toe(legN.end, pose.toeN ?? pose.toe),
    kneeF: legF.joint,
    ankleF: legF.end,
    toeF: toe(legF.end, pose.toeF ?? pose.toe),
    elbowN: armN.joint,
    wristN: armN.end,
    elbowF: armF.joint,
    wristF: armF.end,
  }
}
