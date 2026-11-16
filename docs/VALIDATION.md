# Fase 3 — consegna funzionale e collaudo, 16 novembre 2026

## Implementazione e dati preservati

Main sincronizzato con origin prima delle modifiche; checkout iniziale pulito sul commit a7e8930. Nessun branch/PR o deploy pubblico. Import A/B/C esistente preservato, senza rieseguire l'importazione. Backup PostgreSQL privato creato prima dei nuovi schemi (`backups/pulse-20261116T112635Z.dump`, ignorato da Git). Nessun reset di dati personali: solo fixture allenamento dei due utenti sintetici inizializzate esplicitamente per i test.

Sessioni complete, carichi standard separati, risultati espliciti recorded/unlogged/skipped, salto esercizi, timer automatici/manuali con pausa/ripresa, autosalvataggio IndexedDB + backend, retry idempotenti e gestione visibile dei conflitti. Sessioni concluse immutabili via API. Storico, grafici peso corporeo/carichi registrati/volume e riepilogo sette giorni. Manifest, icone e service worker installabile, cache della sola shell. Promemoria personali e notifiche di sistema con consenso durante l'apertura dell'app. Revisioni video separate e fondate sui metadati ufficiali; cinque associazioni non confermate, dettagli in VIDEO_REVIEW.md.

## Test reali superati

- Build Vite, admin Strapi e immagini Docker riuscite. Stack finale avviato con Compose ordinario, senza mount di sviluppo: postgres/strapi/frontend healthy su rete DB privata e porte loopback 1337/8081.
- Backend: **5 file test passati**, comprese le fonti PDF originali, regole carichi/volume/timer e promemoria/timezone. Frontend: **1 file test passato** per mancato falso salvataggio in caso di errore server.
- API fase 3 con due utenti sintetici: **PASS** per owner/anonimo/CSRF, avvio e retry concorrenti con UUID stabile, rifiuto seconda sessione attiva, serie/esercizi saltati, recorded/unlogged, conclusione, revisioni, replay di operazioni, conflitti e immutabilità. Verificato volume 400 da 50 kg × 8 ripetizioni registrate; nessun volume attribuito alla serie senza peso.
- Caso obbligatorio **60 kg standard → 50 temporanei → completata senza registrare peso → nuova sessione ancora 60 kg: PASS via API e via UI browser**. L'eseguito della prima serie resta null, senza falsi 60/50 kg. Aggiornamento esplicito standard e conferma/revisione verificati; la modifica non altera gli snapshot attivi o storici.
- Timer: avvio automatico quando la fonte indica un recupero numerico, avvio manuale, pausa e ripresa. Recupero ambiguo della panca resta manuale. Confronto esatto di endAt e revisione prima/dopo riavvio Strapi, poi prima/dopo **riavvio reale PostgreSQL + Strapi/frontend**, senza rigenerare fixture: **PASS**. Presenti ancora standard60, sessione attiva, storico unlogged e configurazioni promemoria.
- Browser: **12 scenari passati, 0 saltati**, con worker singolo su 360/390/1440 px. Home/nutrizione, esecuzione, ricarica, perdita rete/ripresa, timer, storico e grafico peso. Screenshot mobile e desktop ispezionati; nessun overflow nei controlli eseguiti e nessun pageerror negli scenari workout/PWA che lo rilevano.
- Browser concorrenza: due tab coordinate, operazione applicata dal server con risposta persa e retry senza doppio incremento, conflitto da altro dispositivo durante offline, download della bozza e scelta versione server, logout con pulizia IndexedDB in entrambe le tab. Simulata memoria locale non disponibile: nessun falso completamento persistente dichiarato, errore visibile e rollback dello stato locale.
- PWA di produzione: `Page.getInstallabilityErrors` Chromium restituisce lista vuota a tutte e tre le dimensioni. Manifest/icone verificati, riapertura completa della pagina offline dopo una serie, coda mantenuta e sincronizzata al ritorno rete. Ispezione CacheStorage: solo shell/asset, nessuna API o PDF.
- Notifiche: **notifica reale tramite service worker in Chromium completo con consenso concesso**, rinvio15 e disattivazione da UI passati. Test regole/API per rinvii15/30/60 validati e soppressione dopo consumo, assunzione o avvio allenamento. La headless shell nega il permesso notifiche: lo scenario usa il browser Chromium completo, senza simulare la chiamata showNotification.
- Regressione API fase 2 e smoke stack sulle immagini finali dopo riavvio: **PASS**. Login/logout revocabile, ownership, dieta8/6, consumi, conflitti, preferenze, peso, assunzioni, domani/spesa, frontend/deep link/admin/health e accesso pubblico negato preservati.

## Limiti espliciti

- Promemoria in-app e notifiche di sistema **mentre la pagina è aperta e connessa**, verifica ogni30 secondi. Browser/OS possono sospendere le schede. Non è implementato un canale Web Push remoto con consegna a pagina chiusa; la UI lo dice esplicitamente. Il consenso negato/non supportato mantiene il fallback in-app. La notifica usa testo generico senza dettagli nutrizionali.
- Installabilità Chromium verificata; installazione su Android fisico o nel menu OS desktop non eseguita da questo ambiente. Android che accede al PC richiede HTTPS privato, da predisporre nella fase server; non è stata aperta alcuna porta pubblica.
- Cinque associazioni video restano da revisionare; conferme limitate a titolo ufficiale e movimento candidato, non alla visione integrale o a una certificazione della tecnica. Le sessioni vecchie conservano le revisioni del proprio snapshot.
- Volume parziale quando mancano peso o ripetizioni; non si deducono kg dallo standard e non si moltiplicano automaticamente circuiti o lavoro per gamba. Nessuna misura di massa muscolare stimata.
- Prima sessione, accesso online e modifica standard richiedono rete. La ripresa offline riguarda una sessione già aperta e memorizzata sul dispositivo. Non cambiare manualmente gli identificatori tecnici in admin. Logout elimina bozze locali: sincronizzare prima di uscire per conservare sul server eventuali modifiche ancora solo locali.
- Audit completo finale: frontend 0; backend 34 (23 high, 9 moderate, 2 low, 0 critical), invariato. Hardening dipendenze/HTTPS, restore finale e collaudo dispositivi restano fase4. Nessun aggiornamento forzato o cambio stack.

---

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
