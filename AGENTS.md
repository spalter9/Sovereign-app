# AGENTS.md

## Cursor Cloud specific instructions

`Sovereign-app` is a Vite + React + TypeScript single-page web app. There is no backend or database — it is frontend-only.

- Dependencies are installed automatically on VM startup via `npm install` (see `.cursor/environment.json`).
- The Vite dev server is started automatically in the **vite** terminal on port **5173**.
- Manual start: `npm start` (same as `npm run dev`) → `http://localhost:5173`
- Other scripts: `npm run lint`, `npm run build`, `npm run preview` (preview uses port 4173).
- Node 20+ is required. If you hit a node/npm version mismatch, prepend nvm to `PATH`:
  `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`

### If the browser says it cannot connect

1. Confirm the dev server is running: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/` should return `200`.
2. If not running: `npm install && npm start`
3. In Cursor, open the **Ports** panel and use the forwarded link for port **5173** (do not guess a URL).
4. Access codes for the portal gateway: `SSP2026` or `SPALTER`.
