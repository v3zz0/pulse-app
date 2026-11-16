# Verifica sul nuovo PC e avvio fase 3 — 16 novembre 2026

## Configurazione e fase 2 riconfermata

Checkout iniziale pulito su main, fetch origin riuscito e HEAD allineato a origin/main prima delle modifiche. Repository effettivo nella sottocartella pulse-app. Node 24.15.0, npm 11.12.1, Docker Compose 2.40.3. File .env inizialmente assente: generato con infra/init-env.js, permessi 0600, ignorato da Git. Dipendenze installate con npm ci; le installazioni incomplete dopo l'interruzione sono state ripetute prima dei test validi.

Porta 8080 occupata da un altro servizio: frontend configurabile tramite FRONTEND_PORT, impostato a 8081 soltanto nel .env locale. PostgreSQL privato e frontend/Strapi su loopback. Nessun deploy pubblico.

- Build frontend e admin Strapi riuscite. Frontend: 1 file test passato; backend: 3 file test passati, inclusi import dieta e palestra originali.
- Fixture con due utenti sintetici, credenziali casuali solo in /tmp/pulse-phase3-test/credentials.json con permessi 0600; nessun account personale usato.
- API fase 2: PASS per login/logout revocabile, isolamento owner, CSRF, conflitti, dieta, consumi, preferenze, peso, assunzioni, domani e spesa. Smoke frontend/deep link/admin/health/registrazione chiusa/anonimo: PASS.
- Chromium Playwright: 3 scenari passati, zero saltati, a 360/390/1440 px. Screenshot mobile 390 ispezionato; nessun pageerror rilevato nei flussi testati e controllo overflow dieta passato.
- Arresto e riavvio Strapi/frontend senza rigenerare fixture, poi phase2-persistence.mjs: PASS per peso, consumi, domani/spesa e assunzioni PostgreSQL. Tre container healthy alla verifica finale.
- npm ci frontend: 0 vulnerabilità. Backend: ancora 34 (23 high, 9 moderate, 2 low). Nessun aggiornamento forzato o cambio stack applicato.

La fase 2 è confermata conclusa nel perimetro già documentato; rimangono i limiti della fonte, dell'editing JSON e dell'audit descritti sotto.

## Primo incremento fase 3

Import privato esplicito della scheda A/B/C e collezione nativa Strapi Schede allenamento. Parser limitato allo SHA256 verificato: nessun programma personale incluso in public o nelle immagini. Le immagini contengono il parser, non il PDF o i suoi dati importati.

Test sorgente PASS: 11/12/8 blocchi, 23/27/25 serie; carichi iniziali null, warm-up/top set/back-off/CED, note, ripetizioni per gamba, circuito unico con tre movimenti 5+5+5 per tre giri e defaticamento comune 180 secondi. Recupero panca 1/2' conservato con seconds=null e revisione richiesta. Tutte le 29 annotazioni video sono candidate da verificare; contenuto video non visitato né certificato. Nessun link assegnato ai blocchi senza LINK.

Import PostgreSQL con due utenti sintetici: PASS per record distinti, conteggio, idempotenza. Dopo arresto/riavvio, schede ancora presenti e retry concorrenti sul codice finale montato in sola lettura: PASS. Gli import serializzano per owner/hash/versione tramite advisory lock nella transazione. Il test non espone endpoint pubblici per le schede.

Fase 3 ancora aperta: allenamento operativo, carichi standard separati, serie eseguite/saltate/senza peso, timer, IndexedDB, storico/grafici, installazione PWA e promemoria. Sequenza e criteri in PHASE3.md. Allenamento rapido escluso. Nessuna funzionalità futura dichiarata operativa.

---

# Validazione fase 2 — 16 novembre 2026

## Funzioni implementate

Login/logout su utenti Strapi con cookie HttpOnly SameSite Strict e sessioni PostgreSQL revocabili. API personali con ownership server-side, controllo origine, validazione input e revisione ottimistica delle giornate. Home su dati reali, ON/OFF, consumo/annullamento, alternative e preferenze, pianificazione domani, registro peso, assunzioni integratori con dose/orario e lista spesa persistente. Nessun JWT in web storage.

Import privato esplicito dal PDF originale verificato tramite SHA256: 7 pagine, 6 momenti OFF e 8 ON, tre indicazioni integratori, note generali e contesto storico. Tariffario e recapiti esclusi. Il testo originale dei pasti resta consultabile; gruppi alternativi separati dai complementari, nota piselli cotti separata dagli ingredienti e olio condizionale per pesce grasso. Import versionato e idempotente per utente/hash/versione. I dati personali importati non sono inclusi in asset o immagini.

## Test della consegna

- Build frontend Vite e admin Strapi riuscite; immagini Docker ricostruite; postgres, strapi e frontend healthy.
- Backend: 4 test passati, inclusa lettura del PDF reale e regole alternative/condimento. Frontend: 1 test passato che verifica l'assenza di falsi salvataggi quando il server fallisce.
- Integrazione API con due utenti sintetici: login, logout revocabile, isolamento owner, controllo origine CSRF, conflitto di revisione, ON/OFF, sostituzioni, preferenze, peso, assunzioni multiple per orario, domani e spesa: PASS.
- Browser Chromium: 3 scenari passati a 360, 390 e 1440 px, nessuno saltato. Login, ordine prossimo pasto/lista, consumo dopo ricarica, dialog, dieta/domani, salvataggio peso e assunzione, logout. Nessun pageerror e nessun overflow orizzontale nella pagina dieta; screenshot Home mobile ispezionato.
- Riavvio reale di Strapi e frontend, attesa healthcheck e lettura successiva senza riscrivere fixture: peso, consumi, domani/spesa e assunzioni ancora presenti in PostgreSQL (PASS).
- Smoke stack: PASS per frontend, deep link, admin, health, registrazione pubblica disabilitata e accesso anonimo negato.
- Test browser inizialmente falliti sul proxy Vite che riscriveva Host e su ingredienti lunghi a mobile: corretti preservando controllo origine e design.
- Audit frontend completo (incluse dipendenze sviluppo): 0 segnalazioni. Audit backend e tentativo di correzione prudente descritti sotto.

## Limiti dichiarati

- Quantità condivise, slash e ambiguità della fonte restano marcati da verificare. L'importazione tecnica completa non costituisce validazione clinica o una prescrizione attuale. Non sono calcolati macro senza fonti.
- I pasti si modificano nel Content Manager tramite JSON strutturato, non tramite un modulo visuale per ogni ingrediente. Formato e file da modificare sono spiegati in STRAPI_GUIDE.md.
- La spesa conserva quantità testuali per porzione e non converte unità. Le note di frequenza sono visibili nel testo fonte; non sostituiscono il controllo del professionista.
- Account personale da creare privatamente nel pannello Strapi e import da assegnare a quell'utente: i test usano account sintetici distinti, non credenziali personali.
- Allenamento, carichi, timer, IndexedDB, grafici/riepiloghi, PWA e notifiche restano fase 3. HTTPS pubblico, hardening e deploy restano fase 4. Nessun deploy pubblico eseguito.
- Audit dopo `npm audit fix` non forzato: backend ancora 34 segnalazioni (23 high, 9 moderate, 2 low, 0 critical). Nessuna correzione compatibile eliminava tali segnalazioni; non sono stati applicati downgrade Strapi 4 o major forzate. Componenti coinvolti: Hono, deepmerge, glob/minimatch, React Router e Zod, incluse dipendenze transitive. Richiede revisione prima della produzione.

---

# Validazione fase 1 — 15 novembre 2026

## Verifiche completate

- Letto prompt originale e analizzati HTML e due PDF (7+2 pagine), incluse 29 annotazioni URL. Fonti invariate; inventario hash e associazioni candidate conservati, contenuto video non verificato.
- Installazione con lockfile npm separati. Node host 24.22.1; Strapi 5.62.0; Vite 7.3.8. Build frontend e admin Strapi riuscite; build Docker dei due componenti riuscite con trust CA tramite secret BuildKit.
- `cd frontend && npm test`: 1 test passato (consumo esplicito, annullamento, separazione ON/OFF e fallback alternativa).
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: 6 test passati, 0 saltati. Due scenari a 360×800, 390×844, 1440×1000: ordine prossimo pasto/lista, consumo/annullamento, ricarica, sostituzione, ON/OFF, dialog Escape, routing e deep link. Nessun errore JavaScript rilevato nello scenario Home; nessun overflow orizzontale. Screenshot mobile ispezionato. Non è un confronto pixel automatico con la demo.
- Dump PostgreSQL ripristinato in database temporaneo separato: 43 tabelle public, nessun errore pg_restore; database temporaneo eliminato. Questo verifica lo schema iniziale Strapi, non dati personali o backup upload.

- `docker compose up -d --no-build --wait`: postgres, strapi e frontend healthy; porte soltanto loopback.
- `node tests/smoke.mjs`: PASS per frontend, deep link, health Strapi 204, admin 200, registrazione disabilitata (400 e messaggio esatto), accesso anonimo `/api/users/me` 403 anche attraverso proxy. Il test iniziale attendeva 403 per registrazione: corretto a 400 dopo verifica della risposta ApplicationError di Strapi.
- Ricreazione dei container frontend/Strapi con volume PostgreSQL mantenuto: avvio e smoke test riusciti. Nessun utente sintetico creato dal test della registrazione chiusa.

## Problemi risolti durante i controlli

- npm e Strapi non potevano scrivere nella home cloud: cache sotto /tmp e XDG_CONFIG_HOME=/tmp/pulse-config.
- Download Playwright Chromium negato con HTTP 403: usato Chromium già installato, senza alterare i controlli.
- Build Docker con trust predefinito non completava npm: `infra/build-cloud.sh` monta la CA di sessione esclusivamente durante npm ci con strict SSL. Nessuna disattivazione TLS o certificato copiato nell'immagine.
- La rete esclusivamente interna impediva il publishing delle porte: frontend/Strapi ora hanno rete edge, PostgreSQL resta soltanto nella rete privata. Healthcheck wget forza accesso locale senza proxy.

## Limiti e verifiche successive

- Home dimostrativa locale; nessuna persistenza utente tramite API, login utente finale o import completo ancora implementati. Registrazione admin iniziale manuale; login admin interattivo non testato.
- Allenamenti, carichi standard/temporanei, ripresa IndexedDB, preferenze, domani, integratori, peso, lista spesa, notifiche e PWA sono successive fasi, non test dichiarati superati.
- HTTPS su dominio pubblico, deploy remoto, restore upload e migrazioni applicative non eseguiti.
- `npm audit --omit=dev`: frontend 0; backend 34 segnalazioni (23 high, 9 moderate, 2 low, 0 critical), incluse dipendenze transitive Strapi. I suggerimenti automatici includono downgrade a Strapi 4, incompatibili col requisito: non applicati. Serve revisione degli advisory e aggiornamento compatibile prima di produzione. Conteggi in `dependency-audit.json`.
