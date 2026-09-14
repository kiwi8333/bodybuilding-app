// Regenerates the committed PNG icons from icon.svg. Run with `npm run icons`,
// which installs sharp temporarily so it is not a dependency of every build.
import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const svgPath = 'scripts/icon.svg'

for (const size of [192, 512]) {
  await sharp(svgPath).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}

// Maskable icon: artwork inside the 80% safe zone on a full-bleed background.
await sharp(svgPath)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#111315' })
  .png()
  .toFile('public/icons/maskable-512.png')

await sharp(svgPath).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(svgPath).resize(32, 32).png().toFile('public/favicon-32.png')

console.log('Icons generated.')
