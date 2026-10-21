import { useEffect, useRef, useState } from 'react'

// Motion helpers. Everything animated in the app checks the "reduce motion"
// accessibility setting: with it on, numbers jump straight to their value and
// CSS animations are switched off (see the end of styles.css).

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion() {
  try {
    return window.matchMedia(QUERY).matches
  } catch {
    return false
  }
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    let mq
    try {
      mq = window.matchMedia(QUERY)
    } catch {
      return undefined
    }
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

export const easeOutCubic = (t) => 1 - (1 - t) ** 3

// The value shown `elapsed` ms into a count from `from` to `to`.
export function countValue(from, to, elapsed, duration, decimals = 0) {
  const t = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1
  const f = 10 ** decimals
  return Math.round((from + (to - from) * easeOutCubic(t)) * f) / f
}

/**
 * A number that counts to its new value instead of jumping. `fromZero`
 * counts up from 0 when it first appears.
 */
export function useCountUp(value, { duration = 650, decimals = 0, fromZero = false } = {}) {
  const reduced = useReducedMotion()
  const target = Number.isFinite(value) ? value : 0
  const [shown, setShown] = useState(() => (fromZero && !reduced ? 0 : target))
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    const from = shownRef.current
    if (reduced || from === target) {
      setShown(target)
      return undefined
    }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const v = countValue(from, target, now - start, duration, decimals)
      setShown(v)
      if (now - start < duration) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, duration, decimals])

  return shown
}
