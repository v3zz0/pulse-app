# PULSE

[English](README.md) · [Licenza: MIT](LICENSE)

**PULSE è un'app self-hosted, attenta alla privacy, per seguire dieta e scheda di allenamento.** Gira sul tuo server, tiene i dati nel tuo PostgreSQL e funziona come PWA installabile sul telefono, con ripresa offline durante l'allenamento.

> L'interfaccia è in italiano. Le traduzioni sono benvenute.

## Funzioni

**Alimentazione**
- Piano giornaliero con giorni ON/OFF (allenamento / riposo), pasti con composizioni alternative e gruppi di alimenti
- «Mangiato» con annullamento, alimenti preferiti e non graditi, pianificazione di domani
- Registro del peso, integratori con dose e orario
- Lista della spesa ricavata dalle tue scelte, con spunte che restano salvate
- Snapshot: modificare il piano non riscrive lo storico

**Allenamento**
- Scheda A/B/C completa, una serie alla volta: peso registrato, «completata senza peso» o saltata
- Timer di recupero con pausa e ripresa che sopravvivono al ricaricamento della pagina
- Offline-first: ogni modifica va prima in IndexedDB e poi al backend
- Progressi: storico, pesi effettivi, ripetizioni, grafici di carichi/peso corporeo e volume
- PWA installabile, promemoria per pasti, integratori e allenamenti (notifiche nell'app o di sistema a pagina aperta; non c'è un servizio push in background)

**Privacy e sicurezza**
- Cookie di sessione `HttpOnly`, `Secure`, `SameSite=Strict`; nessun token in `localStorage`
- Registrazione pubblica chiusa; il pannello admin di Strapi è separato dall'utente finale
- Ogni rotta personale controlla il proprietario sul server; il login ha un limite di tentativi salvato in PostgreSQL
- In produzione il database è su una rete isolata, con un ruolo applicativo senza permessi da superutente

## Stack

Vue 3 + Pinia + Vue Router (Vite) · Strapi 5 · PostgreSQL 17 · Nginx · Docker Compose. Solo JavaScript, niente TypeScript.

## Avvio rapido (locale)

Requisiti: Docker con Compose v2 e Node.js 24.

```sh
git clone https://github.com/v3zz0/pulse-app.git
cd pulse-app
node infra/init-env.js        # crea .env con segreti casuali (non sovrascrive)
docker compose up -d --build --wait
```

- App: <http://localhost:8080> (se la porta è occupata imposta `FRONTEND_PORT=8081` in `.env`)
- Admin Strapi: <http://localhost:1337/admin>

Le porte sono aperte solo su localhost e PostgreSQL non pubblica nessuna porta.

### Primo utilizzo

1. Apri l'admin di Strapi e crea l'amministratore.
2. In **Content Manager → User (Users & Permissions)** crea il tuo utente: provider `local`, ruolo *Authenticated*, *Confirmed* attivo, *Blocked* disattivo.
3. Accedi dalla home dell'app con quell'utente.
4. Inserisci i piani dal pannello admin. Collezioni e campi sono spiegati in [docs/STRAPI_GUIDE.md](docs/STRAPI_GUIDE.md) e [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

> Gli script `backend/scripts/import-nutrition.js` e `import-training.js` importano i PDF personali dell'autore: il parser controlla l'hash del file e rifiuta qualsiasi altro documento. Restano come riferimento e non servono per usare l'app.

## Sviluppo

```sh
cd frontend && npm ci && npm run dev     # http://localhost:5173, API inoltrate a Strapi su 1337
cd backend  && npm ci && npm run build && npm test
```

- `npm test` in `frontend` e `backend` esegue i test unitari (`node --test`).
- Due test del backend leggono i PDF privati dell'autore, che **non** sono nel repository: falliscono se non imposti `PULSE_TEST_PDF` / non fornisci i file.
- I test nel browser (`frontend`: `npm run test:e2e`) richiedono Playwright e **utenti sintetici**, mai account veri. Vedi [docs/VALIDATION.md](docs/VALIDATION.md).
- `node tests/smoke.mjs` è un controllo di 10 secondi su uno stack avviato (`FRONTEND_URL`, `BACKEND_URL`).

## Produzione

`compose.jenkins.yml` è lo stack di produzione: PostgreSQL su rete privata, Strapi, frontend (Nginx), porte pubblicate solo sull'IP che scegli. L'HTTPS **non** è incluso: metti davanti un reverse proxy (Nginx Proxy Manager, Caddy, Traefik…).

Passo per passo, con regole del proxy, Jenkins, backup e aggiornamenti: **[DEPLOYMENT.md](DEPLOYMENT.md)** (in inglese).

> I due domini pubblici (frontend e admin) si impostano con `PULSE_PUBLIC_ORIGIN` e `PULSE_API_URL` nel file env. Devono essere due origini `https://` diverse e senza slash finale, altrimenti in produzione il backend non parte.

## Backup

- `./infra/backup.sh`: dump rapido di PostgreSQL in `backups/` (ignorata da git).
- `infra/backup-full.sh` + `infra/systemd/`: backup completo cifrato con GPG (database, upload, configurazione), con retention e copia opzionale fuori dal server.
- `infra/restore-isolated.sh`: ripristina un backup in volumi nuovi e isolati per verificare che funzioni.

Prova sempre un ripristino prima di fidarti di un backup.

## Documentazione

| File | Contenuto |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Produzione, Jenkins, backup, aggiornamenti |
| [docs/SECURITY.md](docs/SECURITY.md) | Modello di sicurezza e rischi residui |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Collezioni e relazioni |
| [docs/STRAPI_GUIDE.md](docs/STRAPI_GUIDE.md) | Come modificare PULSE dall'admin di Strapi |
| [docs/PHASE3.md](docs/PHASE3.md) | Allenamento, PWA e promemoria |
| [docs/VALIDATION.md](docs/VALIDATION.md) | Risultati reali dei test |
| [docs/ANDROID_CHECKLIST.md](docs/ANDROID_CHECKLIST.md) | Controlli manuali su Chrome / Android |

## Contribuire

Issue e pull request sono benvenute. Prima di aprire una PR esegui build e test di `frontend` e `backend`, non committare mai `.env*`, PDF, dump o dati personali e usa utenti sintetici nei test. Per problemi di sicurezza apri un security advisory privato su GitHub, non una issue pubblica.

## Licenza

[MIT](LICENSE)

## Piani CSV e impostazioni personali

Da **Altro → Gestisci piano alimentare** e **Altro → Gestisci scheda allenamento**: esempi CSV sintetici, istruzioni per AI, anteprima con errori/avvisi, importazione in bozza, attivazione esplicita, archiviazione ed export. Le versioni storiche e gli allenamenti già avviati non vengono riscritti. I carichi si trasferiscono solo dopo confronto esatto e conferma.

Avatar → preferenze alimentari, allergie/intolleranze dichiarate, pasti, budget e target configurabili. Nutrienti mancanti non inventati; stime e dichiarazioni distinti da fonti confermate dall’utente. Nessuna dieta AI viene generata o attivata automaticamente. [Formato e procedura CSV](docs/CSV_AI_GUIDE.md).

Aggiornamento server: leggere la sezione CSV di DEPLOYMENT.md; nessuna modifica al database di produzione senza backup verificato e autorizzazione esplicita.
