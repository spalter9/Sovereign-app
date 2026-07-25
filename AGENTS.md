# AGENTS.md

## Cursor Cloud specific instructions

`Sovereign-app` is a Vite + React + TypeScript single-page web app. There is no backend or database — it is frontend-only.

- Dependencies are installed automatically on VM startup via `npm install` (the configured update script). No extra setup is required.
- Run the dev server with `npm run dev`; it listens on `http://localhost:5173` (Vite is configured with `host: true` so it is reachable in the VM).
- Other standard scripts live in `package.json`: `npm run lint` (ESLint), `npm run build` (type-check via `tsc -b` + production build), `npm run preview`.
- Node 20+ is required. The VM's default `node` on `PATH` may differ from the `npm` shipped via nvm; if you hit a node/npm version mismatch, prepend the nvm bin to `PATH` (e.g. `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`).
