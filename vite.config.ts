import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Custom domain (sspengine.com) and local preview both serve from "/".
// Override with VITE_BASE=/Sovereign-app/ only for GitHub Pages project URLs.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
    // The examiner worker lazily imports the speech-recognition runtime, which
    // makes it a code-splitting build. Vite's default worker format (iife)
    // cannot emit those, so the worker is built as an ES module.
    worker: {
      format: 'es' as const,
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
    },
  }
})
