import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Content Security Policy, injected into index.html at build time. GitHub
// Pages cannot send headers, so it ships as a meta tag. 'unsafe-inline' is
// needed for style only (React writes inline style attributes); scripts are
// restricted to this origin, so injected script of any kind cannot run.
function cspPlugin() {
  return {
    name: 'forge-csp',
    transformIndexHtml(html) {
      const api = (process.env.VITE_PUSH_API_URL || '').replace(/\/+$/, '')
      let connect = "'self'"
      try {
        if (api) connect += ` ${new URL(api).origin}`
      } catch {
        // An unusable URL simply means no extra connect source.
      }
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'self'",
        "manifest-src 'self'",
        `connect-src ${connect}`,
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ')
      return {
        html,
        tags: [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
      }
    },
  }
}

// Served from https://<user>.github.io/bodybuilding-app/ on GitHub Pages.
const base = '/bodybuilding-app/'

export default defineConfig({
  base,
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        // Push notification + notification-tap handlers (public/push-sw.js).
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'Forge — Muscle & Fitness',
        short_name: 'Forge',
        description: 'Dumbbell and bodyweight muscle-building program with a treadmill walk-to-run plan, set logger and progress tracking.',
        theme_color: '#111315',
        background_color: '#111315',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
