# PULSE

[Italiano](README.it.md) · [License: MIT](LICENSE)

**PULSE is a self-hosted, privacy-first app to follow your diet and your gym program.** It runs on your own server, keeps your data in your own PostgreSQL database and works as an installable PWA on your phone, with offline recovery during workouts.

> The interface is in Italian. Contributions to translate it are welcome.

## Features

**Nutrition**
- Daily plan with ON/OFF days (training / rest), meals with alternative compositions and food groups
- "Eaten" / undo, favourite and disliked foods, planning for tomorrow
- Body weight log, supplements with dose and time
- Shopping list derived from your selections, with persistent check marks
- Snapshots: changing the plan never rewrites your history

**Training**
- Full A/B/C program, one set at a time: registered weight, "completed without weight" or skipped
- Rest timer with pause/resume that survives page reloads
- Offline-first: every change is saved in IndexedDB first, then synced to the backend
- Progress: history, effective weights, reps, load / body-weight charts and volume
- Installable PWA, reminders for meals, supplements and workouts (in-app / system notifications while the app is open; there is no background push service)

**Privacy and security**
- Session cookie `HttpOnly`, `Secure`, `SameSite=Strict`; no token in `localStorage`
- Public registration is closed; the Strapi admin panel is separated from the end user
- Every personal route checks ownership on the server; login is rate-limited in PostgreSQL
- Production database on an isolated network, with a non-superuser application role

## Stack

Vue 3 + Pinia + Vue Router (Vite) · Strapi 5 · PostgreSQL 17 · Nginx · Docker Compose. JavaScript only, no TypeScript.

## Quick start (local)

Requirements: Docker with Compose v2 and Node.js 24.

```sh
git clone https://github.com/v3zz0/pulse-app.git
cd pulse-app
node infra/init-env.js        # creates .env with random secrets (never overwrites)
docker compose up -d --build --wait
```

- App: <http://localhost:8080> (if the port is busy set `FRONTEND_PORT=8081` in `.env`)
- Strapi admin: <http://localhost:1337/admin>

Ports are bound to localhost only and PostgreSQL publishes no port.

### First use

1. Open the Strapi admin and create the administrator.
2. In **Content Manager → User (Users & Permissions)** create your personal user: provider `local`, role *Authenticated*, *Confirmed* on, *Blocked* off.
3. Sign in from the app home page with that user.
4. Fill in your plans from the admin panel. Collections and fields are explained in [docs/STRAPI_GUIDE.md](docs/STRAPI_GUIDE.md) and [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

> The scripts `backend/scripts/import-nutrition.js` and `import-training.js` import the author's own PDFs: the parser checks the file hash and rejects any other document. They are kept as a reference and are not needed to use the app.

## Development

```sh
cd frontend && npm ci && npm run dev     # http://localhost:5173, API proxied to Strapi on 1337
cd backend  && npm ci && npm run build && npm test
```

- `npm test` in `frontend` and `backend` runs the unit tests (`node --test`).
- Two backend tests read the author's private PDFs, which are **not** in this repository: they fail unless you set `PULSE_TEST_PDF` / provide the files.
- Browser tests (`frontend`: `npm run test:e2e`) need Playwright and **synthetic users**, never real accounts. See [docs/VALIDATION.md](docs/VALIDATION.md).
- `node tests/smoke.mjs` is a 10-second check against a running stack (`FRONTEND_URL`, `BACKEND_URL`).

## Production

`compose.jenkins.yml` is the production stack: PostgreSQL on a private network, Strapi, the frontend (Nginx), ports published only on the IP you choose. TLS is **not** included: put a reverse proxy in front (Nginx Proxy Manager, Caddy, Traefik…).

Step by step, including the reverse proxy rules, Jenkins, backups and updates: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

> Your two public domains (frontend and admin) are set with `PULSE_PUBLIC_ORIGIN` and `PULSE_API_URL` in the env file. They must be distinct `https://` origins without a trailing slash, otherwise the backend refuses to start in production.

## Backups

- `./infra/backup.sh`: quick PostgreSQL dump into `backups/` (git-ignored).
- `infra/backup-full.sh` + `infra/systemd/`: GPG-encrypted full backup (database, uploads, configuration) with retention and optional off-server copy.
- `infra/restore-isolated.sh`: restores a backup into brand-new isolated volumes to prove it works.

Always test a restore before you trust a backup.

## Documentation

| File | Content |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment, Jenkins, backups, updates |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and known residual risks |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Collections and relations |
| [docs/STRAPI_GUIDE.md](docs/STRAPI_GUIDE.md) | How to edit PULSE from the Strapi admin |
| [docs/PHASE3.md](docs/PHASE3.md) | Training, PWA and reminders |
| [docs/VALIDATION.md](docs/VALIDATION.md) | Real test results |
| [docs/ANDROID_CHECKLIST.md](docs/ANDROID_CHECKLIST.md) | Manual checks on Chrome / Android |

## Contributing

Issues and pull requests are welcome. Before opening a PR run the build and tests of both `frontend` and `backend`, never commit `.env*`, PDFs, dumps or personal data, and use synthetic users in tests. Security problems: please open a private security advisory on GitHub instead of a public issue.

## License

[MIT](LICENSE)

**CSV plans and personal settings**

Plan imports, exports and version management are available in **Altro → Piani e importazioni**.
- Download synthetic diet/workout templates, copy AI instructions, preview and validate files before saving a draft
- Activate/archive versions explicitly; export and reimport without rewriting past meals or workout sessions
- Compare known nutrients with configurable goals; missing/estimated/declared values remain explicit
- Private favorite/avoided foods and nutritional goals in Account
- Confirm exact standard-load transfers between workout versions; no fuzzy exercise matching

See [CSV_AI_GUIDE.md](docs/CSV_AI_GUIDE.md) for formats, limits and safe imports. Server upgrade requires a verified backup and explicit authorization before production schema changes.

Workout draft proposals, offline cancellation and the Jenkins update procedure: [WORKOUT_SESSIONS.md](docs/WORKOUT_SESSIONS.md).
