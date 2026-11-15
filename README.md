# PULSE 2.1

Prima fase eseguibile: Home Vue 3 fedele alla demo, Strapi 5 nativo e PostgreSQL 17. JavaScript, nessun sorgente TypeScript. Il prompt e i riferimenti originali sono in `PULSE_Starter_Codex_Cloud/`.

La Home usa dati **dimostrativi locali**, separati da Strapi: consumo/annullamento, ON/OFF e sostituzioni sono provabili; login utente finale, import completo, allenamenti, peso, integratori, PWA e notifiche sono fasi successive. Le funzioni non implementate sono disabilitate o presentano una pagina esplicativa. Nessuna falsa persistenza backend. Piano storico da rivedere, non prescrizione attuale.

## Avvio con Docker

Richiede Docker Engine e Compose v2. Dalla root:

```sh
node infra/init-env.js # solo la prima volta; non sovrascrive .env
# In alternativa cp .env.example .env e compilare TUTTI i segreti casuali.
docker compose up -d --build --wait
```

Frontend: `http://localhost:8080`. Admin Strapi: `http://localhost:1337/admin` (creare il primo amministratore tramite pannello nativo). Credenziali amministratore diverse dall'utente finale, che sarà configurato nella fase 2. Le porte sono bindate solo al loopback; il database non è pubblicato. Non esporre il pannello iniziale prima di aver creato l'admin.

```sh
docker compose ps
curl -f http://localhost:8080/health
curl -f http://localhost:1337/_health
docker compose logs --tail=100 strapi
docker compose stop             # conserva volumi
docker compose up -d --wait     # riavvio
docker compose down            # conserva volumi; NON aggiungere -v per dati reali
```

I segreti sono generati in `.env` (ignorato, permessi 0600) e non inclusi nelle immagini. Custodirli anche nei backup sicuri: ruotarli cambia sessioni/token/dati cifrati. Non usare `docker compose config` senza `--quiet` nei log condivisi perché mostra valori risolti.

## Sviluppo

Node 24 LTS, npm e lockfile separati. Per la UI:

```sh
cd frontend
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Il dev server gira sulla porta 5173; `/api` è inoltrato a Strapi locale. Per Chromium già installato: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Nei cloud con home non scrivibile, usare `npm --cache /tmp/pulse-npm ...` e `XDG_CONFIG_HOME=/tmp/pulse-config` per Strapi. Il download browser può richiedere autorizzazione di rete per `cdn.playwright.dev` e destinazioni di redirect.

Per sviluppare Strapi, installare `backend` con `npm ci`, quindi `npm run build`. Il flusso Docker sopra è quello completo testato. Per `npm run develop` nativo occorre un PostgreSQL raggiungibile sul loopback e le variabili di `.env` iniettate nel processo; aggiungere `DATABASE_HOST=127.0.0.1`, `DATABASE_PORT` del proprio DB. Non esiste fallback SQLite. Non pubblicare la porta DB su tutte le interfacce. Non avviare due istanze Strapi concorrenti durante modifiche schema.

## Struttura

- `frontend/src`: shell Vue, icone e CSS derivati dalla demo, store Pinia isolato per l'anteprima.
- `backend/config`, `backend/src`: Strapi JavaScript/PostgreSQL; bootstrap disabilita la registrazione pubblica a ogni avvio. Nessun modello personale ancora esposto.
- `infra`: generazione segreti, backup DB, esempio reverse proxy.
- `docs/DATA_MODEL.md`: schema versionato proposto; `docs/reference-inventory.json`: hash, pagine e 29 link PDF con righe candidate da verificare.
- `docs/VALIDATION.md`: risultati e limiti reali, non una lista di funzionalità completate.

## Produzione Linux, TLS e aggiornamenti

Non distribuire questa prima fase come prodotto completo. Per preparare un host, usare Compose e Caddy sull'host con `infra/Caddyfile.example`, sostituire i domini, configurare DNS e porte 80/443 per TLS automatico. Il proxy punta alle porte loopback. Configurare URL pubblico Strapi, proxy headers e CORS per il dominio scelto prima di abilitare login frontend. Nessun deploy remoto è stato eseguito. HTTPS/PWA/Web Push non sono verificati in questa fase.

Backup DB dalla root: `./infra/backup.sh`. Salvare separatamente `.env` e volume `uploads` in archivio privato cifrato; i PDF non appartengono agli upload pubblici. Conservare copie esterne alla macchina. Per provare un restore, creare un database temporaneo e usare `pg_restore --no-owner --no-privileges` con un dump, controllare dati e applicazione prima di qualsiasi sostituzione del DB reale. Mai ripristinare sopra produzione senza backup e finestra di manutenzione.

Aggiornamenti: backup, annotare versioni immagini/lockfile, verificare migrazioni su copia DB, aggiornare dipendenze in un cambiamento revisionabile, `npm ci`, build/test e `docker compose up -d --build --wait`. Strapi può sincronizzare lo schema all'avvio: l'immagine precedente da sola non è un rollback del database; servono backup compatibili. Le future migrazioni custom devono essere versionate e testate. PostgreSQL resta solo sulla rete interna; frontend e Strapi hanno anche una rete di accesso per le porte loopback. Configurare esplicitamente destinazioni e credenziali per mail/Web Push futuri.

### Build nell'ambiente cloud con CA di sessione

In Codex Cloud la build normale può fallire sulla verifica del certificato proxy. Usare `./infra/build-cloud.sh`, poi `docker compose up -d --no-build --wait`. Lo script prepara Dockerfile temporanei e monta `CODEX_PROXY_CERT` come secret BuildKit per `npm ci`, senza disabilitare TLS né copiare il certificato nei layer. Su host ordinari usare la build Compose normale. Smoke test dello stack avviato: `node tests/smoke.mjs`.
