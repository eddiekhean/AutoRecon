import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-server CSP — only served by `vite dev`. Production headers must be
// configured separately on nginx/caddy (mirror the production-safe subset).
//
// Relaxations required for local development:
//   script-src  'unsafe-inline' — Vite injects the React Fast Refresh preamble
//                                  as an inline <script> that cannot be hashed at
//                                  build time; without this the HMR preamble is
//                                  blocked and you get the "can't detect preamble" error.
//   style-src   fonts.googleapis.com — index.css @imports the Inter font sheet.
//   font-src    fonts.gstatic.com   — actual woff2 files served by Google.
//   connect-src ws://localhost:*    — Vite HMR websocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' ws://localhost:*",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    headers: {
      // NOTE: These headers apply to the Vite dev server only.
      // Mirror all of these on your production web server (nginx / caddy).
      'Content-Security-Policy': CSP,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
})
