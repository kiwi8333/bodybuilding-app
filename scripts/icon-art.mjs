// The Forge mark: an "F" forged from barbells (each arm ends in weight
// plates), glowing orange over a dark forge, with sparks flying off.
//
// One drawing, three framings:
//   iconSvg({ shape: 'rounded' })  – favicon and in-browser icons
//   iconSvg({ shape: 'square' })   – full-bleed for iOS and Android, which
//                                    cut their own rounded corners
//   iconSvg({ shape: 'square', scale: 0.85 }) – maskable: the whole mark
//                                    inside Android's safe-zone circle
// Everything is drawn on a 512 × 512 grid.

const MARK = `
  <g fill="url(#metal)">
    <!-- stem -->
    <rect x="150" y="112" width="70" height="288" rx="18"/>
    <!-- top arm: bar, plate, collar -->
    <rect x="205" y="128" width="110" height="34" rx="10"/>
    <rect x="308" y="86" width="42" height="118" rx="12"/>
    <rect x="356" y="108" width="22" height="74" rx="8"/>
    <!-- middle arm: bar, plate, collar -->
    <rect x="205" y="238" width="84" height="32" rx="10"/>
    <rect x="284" y="206" width="36" height="96" rx="11"/>
    <rect x="326" y="224" width="18" height="60" rx="7"/>
  </g>
  <!-- sparks -->
  <g fill="url(#spark)">
    <path d="M392 302 L401 331 L430 340 L401 349 L392 378 L383 349 L354 340 L383 331 Z"/>
    <circle cx="428" cy="282" r="9"/>
    <circle cx="352" cy="404" r="7"/>
  </g>`

export function iconSvg({ shape = 'rounded', scale = 1.04 } = {}) {
  const radius = shape === 'rounded' ? 112 : 0
  // Centre the mark (stem to sparks spans x 150–430, y 86–411).
  const t = `translate(256 256) scale(${scale}) translate(-290 -248)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="forge" cx="0.5" cy="0.92" r="0.85">
      <stop offset="0" stop-color="#5a2208"/>
      <stop offset="0.45" stop-color="#26140c"/>
      <stop offset="1" stop-color="#111315"/>
    </radialGradient>
    <!-- One gradient across the whole mark, so overlapping parts join without seams. -->
    <linearGradient id="metal" gradientUnits="userSpaceOnUse" x1="0" y1="86" x2="0" y2="400">
      <stop offset="0" stop-color="#ffc178"/>
      <stop offset="0.45" stop-color="#ff7a1a"/>
      <stop offset="1" stop-color="#e2470b"/>
    </linearGradient>
    <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1d6"/>
      <stop offset="1" stop-color="#ffb047"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#forge)"/>
  <g transform="${t}">${MARK}
  </g>
</svg>
`
}
