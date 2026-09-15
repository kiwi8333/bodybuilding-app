// Vercel only hosts the reminders API (api/*.js). The app itself is served
// by GitHub Pages, so the Vercel "site" is a single status page.
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('vercel-static', { recursive: true })
writeFileSync(
  'vercel-static/index.html',
  '<!doctype html><meta charset="utf-8"><title>Forge reminders API</title><p>Forge reminders API is running. The app lives at <a href="https://kiwi8333.github.io/bodybuilding-app/">kiwi8333.github.io/bodybuilding-app</a>.</p>',
)
console.log('vercel-static written')
