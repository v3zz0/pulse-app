# AGENTS.md

Notes for AI coding agents (and humans) working on this repository.

## Stack
- Vue 3 (JavaScript) + Strapi 5 (JavaScript) + PostgreSQL 17 + Docker Compose.
- No TypeScript in sources or config.

## Commands
- Frontend: `cd frontend && npm ci && npm run build && npm test` (browser tests: `npm run test:e2e`).
- Backend: `cd backend && npm ci && npm run build && npm test` (PostgreSQL required).
- Local stack: `node infra/init-env.js` (only if `.env` is missing), then `docker compose up -d --build --wait`.

## Read first
- `docs/DATA_MODEL.md`, `docs/STRAPI_GUIDE.md`, `docs/SECURITY.md`.

## Rules
- Never commit `.env*`, PDFs, database dumps, keys or any personal/health data. Use synthetic users in tests.
- Every personal operation must check ownership on the server.
- Do not mix the standard load of an exercise with the weight actually lifted.
- Work on `main`, run build and tests before committing, no force push.
- Record real results in `docs/VALIDATION.md`; never present demos or untested code as working features.
