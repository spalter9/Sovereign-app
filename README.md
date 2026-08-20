# SSPengine.com

Sovereign Sign Protocol Engine — Vite + React + TypeScript console for
mastering, stems, Polygon settlement, and multi-industry SSP infrastructure.

## Requirements

- Node.js 20+ (developed against Node 22)
- npm

## Getting started

```bash
npm install
npm start          # http://localhost:5173 (strict)
# or
npm run dev
```

Unlock with `8888`, `SPALTER`, or `SSP2026`.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` / `npm run dev` | Dev server on port **5173** (strict). |
| `npm run build` | Type-check + production build → `dist/`. |
| `npm run preview` | Preview production build on **4173**. |
| `npm run lint` | ESLint. |

## Deploy

- **Custom domain (sspengine.com):** default Vite `base` is `/` (see `vercel.json`).
- **GitHub Pages project URL:** build with `VITE_BASE=/Sovereign-app/ npm run build`.
