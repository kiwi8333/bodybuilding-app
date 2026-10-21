import { useCountUp } from '../lib/motion.js'

// A number that animates to its value. The final value is what screen readers get.
export default function CountUp({ value, decimals = 0, fromZero = false, format = (n) => n.toLocaleString() }) {
  const shown = useCountUp(value, { decimals, fromZero })
  return (
    <span className="count-up">
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
