import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// When building for GitHub Pages the site is served from
// https://<user>.github.io/Sovereign-app/, so production assets need the
// "/Sovereign-app/" base path. Local dev (`vite`) keeps serving from "/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Sovereign-app/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
}))
