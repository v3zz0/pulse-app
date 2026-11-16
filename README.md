# PULSE 2.1

Vue 3 JavaScript, Strapi 5 JavaScript, PostgreSQL 17 e Docker Compose. Il progetto procede su `main`, senza nuove PR. Design e riferimenti originali restano in `PULSE_Starter_Codex_Cloud/`.

## Avvio locale

Node 24 e Docker Compose v2, dalla root:

```sh
node infra/init-env.js # solo se .env manca; non sovrascrive segreti
# Host ordinario:
docker compose up -d --build --wait
# Codex Cloud con CA di sessione, in alternativa:
./infra/build-cloud.sh
docker compose up -d --no-build --wait --wait-timeout 180
```

Frontend su `http://localhost:8080`; amministrazione Strapi su `http://localhost:1337/admin`. Solo loopback; PostgreSQL non pubblica porte. Nessun deploy pubblico. Il file `.env` è ignorato, generato con permessi 0600 e non copiato nelle immagini. `infra/build-cloud.sh` monta la CA come secret temporaneo, mantenendo TLS verificato.

## Primo utilizzo personale

1. Creare l'admin Strapi dal pannello locale.
2. Creare l'utente **Users & Permissions / User** con email, username, password forte, provider `local`, ruolo Authenticated, Confirmed attivo e Blocked disattivo. Admin e utente finale sono separati; registrazione pubblica chiusa.
3. Importare la dieta privata per quell'utente. Il PDF viene montato in sola lettura, non pubblicato né incluso nelle immagini. Dalla root, sostituire l'email di esempio:

```sh
docker compose stop frontend strapi
docker compose run --rm --no-deps \
  -v "$PWD/PULSE_Starter_Codex_Cloud/references:/private:ro" \
  strapi node scripts/import-nutrition.js \
  '/private/Dieta Alessandro Vezzoli modifica 4.pdf' 'utente@example.com'
docker compose up -d --no-build --wait
```

L'import è idempotente per utente, hash PDF e versione parser. Un PDF diverso viene rifiutato finché non viene revisionato l'importatore. Le giornate conservano snapshot del piano: una nuova versione non cambia lo storico. Non caricare PDF clinici nella Media Library pubblica.

4. Accedere dalla Home. Il cookie di sessione è HttpOnly, SameSite Strict, valido sette giorni; logout revoca la sessione PostgreSQL. Nessun token in localStorage.

## Funzioni della fase 2

Home su dati PostgreSQL; ON/OFF; Mangiato/annullamento; composizioni alternative e gruppi di alimenti; preferiti/non graditi; pianificazione di domani; peso; integratori e assunzioni con dose e orario; spesa derivata dalle selezioni e spunte persistenti. L'app non calcola macro senza fonti verificate e segnala il piano storico da rivedere.

Pasti e note del PDF sono conservati, incluse bevande/pre-workout/pre-letto, limiti di frequenza e note generali. Le quantità condivise o ambigue sono marcate da verificare e il testo originale è consultabile: l'importazione tecnica non è una nuova validazione nutrizionale. La spesa elenca quantità testuali per porzione; non converte unità o somma ingredienti alternativi.

Allenamento, grafici settimanali, PWA e notifiche appartengono alla fase 3 e non sono simulati come attivi. L'admin gestisce i cataloghi; per i pasti il formato attuale è JSON strutturato, documentato con un esempio sintetico in [docs/STRAPI_GUIDE.md](docs/STRAPI_GUIDE.md).

## Sviluppo e test

```sh
cd frontend
npm ci
npm run dev # porta 5173, proxy API verso Strapi 1337
npm run build
npm test
cd ../backend
npm ci
npm run build
npm test
```

Nel cloud usare `npm --cache /tmp/pulse-npm ...`; per Strapi nativo `XDG_CONFIG_HOME=/tmp/pulse-config STRAPI_TELEMETRY_DISABLED=true npm run build`. Per il runtime nativo è necessario PostgreSQL raggiungibile e variabili DB/segreti iniettate: nessun fallback SQLite.

Test browser e integrazione richiedono **utenti sintetici**, non credenziali personali. Su un DB di sviluppo, creare una directory locale privata scrivibile dall'utente `node` del container, montarla su `/testout` e avviare `scripts/test-fixtures.js` con `PULSE_TEST_FIXTURES=1` e i PDF montati su `/private`. Lo script crea/resetta esclusivamente gli utenti `pulse-test-1/2@example.invalid`, importa piani privati e scrive credenziali casuali nel file locale, senza stamparle. Non eseguirlo sul server di produzione.

```sh
PULSE_TEST_CREDENTIALS=/percorso/privato/credentials.json node tests/phase2-integration.mjs
cd frontend
PULSE_TEST_CREDENTIALS=/percorso/privato/credentials.json CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Test sorgente PDF: eseguito da `backend/npm test` contro l'originale del repository; nel container impostare `PULSE_TEST_PDF` sul mount privato. Chromium può essere installato con Playwright fuori dal cloud se necessario. Il proxy Vite preserva l'origine per il controllo CSRF.

## Backup e gestione

`./infra/backup.sh` crea un dump PostgreSQL privato in `backups/` (ignorato). Salvare separatamente `.env` e volume upload in backup protetti esterni. Provare sempre `pg_restore` in un database separato prima di sostituire dati reali.

```sh
docker compose ps
docker compose logs --tail=100 strapi
docker compose stop
docker compose up -d --no-build --wait
```

`docker compose down` conserva i volumi; non usare `-v` sui dati da mantenere. Prima di aggiornare Strapi o schemi, fare backup e provare su una copia: il rollback del codice non ripristina automaticamente il database. Non stampare `docker compose config` risolto nei log: usare `--quiet`.

HTTPS, proxy affidabile e cookie Secure dietro proxy, backup completi, migrazioni e deploy sul server saranno collaudati nella fase 4. L'esempio Caddy è soltanto un riferimento da adattare. Audit e limiti reali in [docs/VALIDATION.md](docs/VALIDATION.md); non esporre in produzione prima della revisione sicurezza.

## Fase 3 in corso

Piano operativo e criteri di completamento: [docs/PHASE3.md](docs/PHASE3.md). Il primo incremento aggiunge l'import privato della scheda A/B/C nel Content Manager; la schermata di allenamento resta non operativa finché sessioni e salvataggio non sono implementati.

Con l'utente finale già creato, importare senza pubblicare il PDF:

```sh
docker compose stop frontend strapi
docker compose run --rm --no-deps \
  -v "$PWD/PULSE_Starter_Codex_Cloud/references:/private:ro" \
  strapi node scripts/import-training.js \
  '/private/Scheda-palestra.PDF' 'utente@example.com'
docker compose up -d --no-build --wait
```

Tutte le serie partono con carico `null` (da impostare). I link sono candidati da revisionare; il recupero ambiguo della panca non riceve una durata automatica. L'import ripetuto per lo stesso utente/versione restituisce la scheda esistente.

Se la porta 8080 è occupata, impostare `FRONTEND_PORT=8081` nel `.env` privato e aprire `http://localhost:8081`. Il binding resta soltanto locale. Per i test API usare `PULSE_TEST_URL=http://127.0.0.1:8081/api/pulse`; per smoke usare `FRONTEND_URL=http://127.0.0.1:8081`.
