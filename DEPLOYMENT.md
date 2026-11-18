# Deploying PULSE

This guide covers a production install with Docker Compose, optionally driven by Jenkins, behind a reverse proxy that terminates HTTPS. For local development see the [README](README.md).

## Architecture

```
Internet ── reverse proxy (HTTPS) ──┬── pulse.<your-domain>     → frontend  (Nginx, port PULSE_FRONTEND_PORT)
                                    └── apipulse.<your-domain>  → Strapi    (port PULSE_API_PORT, admin only, IP-restricted)

frontend ──/api/pulse/*──▶ strapi ──▶ postgres
```

- `postgres` is on an internal network and publishes nothing; the application connects with a non-superuser role (`pulse_maintenance` is only used to initialise the database).
- `frontend` serves the PWA and forwards **only** `/api/pulse/*` to Strapi. Every other `/api/*`, `/admin` and `/uploads` answer 404.
- `strapi` publishes one port, used for the admin panel. Both published ports are bound to `PULSE_BIND_IP`, never `0.0.0.0`.
- All services use `no-new-privileges`, resource limits and rotated logs; images are pinned by digest.

## Requirements

- A Linux host with Docker Engine and Compose v2. About 4 GiB of RAM for the Strapi build (8 GiB is more comfortable); do not build while the host is under load.
- Node.js 24 on the machine where you generate secrets.
- A reverse proxy with HTTPS and two DNS names (frontend and admin).
- Never expose Docker over TCP, and never publish ports 5432 or the internal ones.

## 1. Secrets and configuration

Generate random secrets and add the deployment settings. The result is a private file that must never be committed (`.env*` is git-ignored):

```sh
node infra/init-env.js && mv .env .env.production && chmod 600 .env.production
```

Then append the settings from [`infra/production.env.example`](infra/production.env.example):

| Variable | Meaning |
|---|---|
| `DATABASE_NAME`, `DATABASE_USERNAME` | Application database and role |
| `DATABASE_PASSWORD` | Password of the application role (≥ 32 chars) |
| `PG_MAINTENANCE_PASSWORD` | Different password for the `pulse_maintenance` superuser; never given to Strapi |
| `APP_KEYS` | Four random keys separated by commas |
| `ADMIN_JWT_SECRET`, `JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` | Distinct random secrets |
| `PULSE_BIND_IP` | IP of the host where the two ports are published (a LAN IP, not `0.0.0.0`) |
| `PULSE_FRONTEND_PORT`, `PULSE_API_PORT` | Host ports for the frontend and the admin panel |
| `PULSE_PUBLIC_ORIGIN`, `PULSE_API_URL` | Public `https://` origins of the frontend and of the admin panel |
| `LOG_LEVEL` | `info` in production |

Keep `APP_KEYS`, `ENCRYPTION_KEY` and the other secrets safe and **stable**: if you lose them, sessions and encrypted fields are lost; if you change them on an existing database, they stop working.

> **Domains.** Set `PULSE_PUBLIC_ORIGIN` (frontend) and `PULSE_API_URL` (admin) in the env file, e.g. `https://pulse.example.com` and `https://apipulse.example.com`. They must be distinct `https://` origins with no path or trailing slash, and `TRUST_PROXY` is forced to `true`: otherwise the backend refuses to start in production. If you change them after a first build, rebuild the images (the admin panel bakes in `PULSE_API_URL`).

## 2. Start the stack

By hand:

```sh
docker compose --env-file .env.production -f compose.jenkins.yml config --quiet   # validates, prints nothing
docker compose --env-file .env.production -f compose.jenkins.yml up -d --build --wait
docker compose --env-file .env.production -f compose.jenkins.yml ps
```

Never paste the output of `docker compose config` anywhere: it contains the resolved secrets.

### With Jenkins

The [`Jenkinsfile`](Jenkinsfile) validates the configuration, builds, starts the stack with `--wait`, runs a few HTTP checks and prunes dangling images.

1. In Jenkins add a **Secret file** credential with id `pulse-env` containing your `.env.production`. This keeps secrets out of git, the job configuration and the logs.
2. Create a *Pipeline script from SCM* job on this repository (`main`, script path `Jenkinsfile`).
3. Change `agent { label '...' }` in the `Jenkinsfile` to the label of the Docker host that will run PULSE.
4. The Jenkins agent user needs access to Docker on that host. Docker access is equivalent to root: keep that agent offline when you are not building, and do not run builds on the Jenkins controller.

The first build creates an empty database. To keep existing data see *Migrating existing data* below.

## 3. Reverse proxy

Create two hosts with HTTPS, using any proxy. With Nginx Proxy Manager:

| Host | Forward to | Notes |
|---|---|---|
| `pulse.<domain>` | `PULSE_BIND_IP`:`PULSE_FRONTEND_PORT` (http) | Enable *Force SSL*, *HTTP/2* and *HSTS*. Do not enable *Websockets* or caching. |
| `apipulse.<domain>` | `PULSE_BIND_IP`:`PULSE_API_PORT` (http) | **Restrict to your own IPs / VPN** with an Access List. Never leave the admin panel open to the world. |

On **both** hosts, in the *Advanced* tab, overwrite the client address and tell Strapi the connection is HTTPS:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto https;
```

Why this matters:
- The login rate limit is per IP. If the proxy only *appends* to `X-Forwarded-For`, a client can send a fake value and dodge the limit.
- Session cookies are `Secure`: without `X-Forwarded-Proto: https` Strapi refuses to set them and logins fail.
- Do not put another CDN or proxy in front without rethinking this trust chain: Strapi trusts exactly one hop.

The frontend already sends its own security headers (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`); the proxy adds HSTS.

## 4. First start

1. Open `https://apipulse.<domain>/admin` from an allowed IP and create the administrator (long unique password, in a password manager). Admin login is rate-limited.
2. In **Content Manager → User (Users & Permissions)** create your personal user: provider `local`, role *Authenticated*, *Confirmed* on, *Blocked* off. Public registration stays closed. Do not enable generic public CRUD on personal collections.
3. Sign in at `https://pulse.<domain>`.

Quick checks (replace the values):

```sh
curl -s http://$PULSE_BIND_IP:$PULSE_FRONTEND_PORT/health          # ok
curl -s -o /dev/null -w '%{http_code}\n' http://$PULSE_BIND_IP:$PULSE_API_PORT/_health   # 204
node tests/smoke.mjs                                                # with FRONTEND_URL / BACKEND_URL set
```

From an IP that is not allowed, the admin host must answer 403.

## Backups

- `infra/backup.sh` — quick PostgreSQL dump in `backups/`.
- `infra/backup-full.sh` — briefly stops frontend and Strapi for a consistent copy, then writes a **GPG-encrypted** archive with the database dump, row counts, uploads, configuration, Git commit and image inventory. The server only needs the recipient's *public* key; keep the private key and its passphrase elsewhere and test that you can use it.
- `infra/restore-isolated.sh` — restores an archive into new volumes with no network or published ports, checks hashes and counts and removes everything afterwards.

```sh
sudo install -d -m 700 /etc/pulse/backup-gnupg /var/backups/pulse
sudo GNUPGHOME=/etc/pulse/backup-gnupg gpg --import /path/to/backup-public.asc
sudo install -m 600 infra/backup-config.example /etc/pulse/backup.conf   # edit it
sudo PULSE_CONFIG=/etc/pulse/backup.conf ./infra/backup-full.sh
```

`infra/systemd/pulse-backup.{service,timer}` run it daily at 03:30. Configure an off-server copy (`BACKUP_REMOTE`, a dedicated SSH key, `known_hosts` verified out of band): a backup that lives only on the same server does not protect you from losing it. The scripts do not delete remote copies; set retention on the remote side.

> The backup scripts were written for the earlier Compose layout: run `restore-isolated.sh` on your first real backup before relying on them.

Disaster recovery in short: new Docker host → same release (Git commit) → decrypt and check `SHA256SUMS` → new Compose project and volumes → start only PostgreSQL → `pg_restore --no-owner --no-privileges --exit-on-error` → restore `uploads.tar` into the uploads volume → start Strapi and frontend → verify login and data → only then point the proxy to it.

## Migrating existing data

To keep data from a local install, do **not** recreate users or rerun imports. Take a full backup of the local stack, restore it into the new project as above, and keep the original `APP_KEYS`, `ENCRYPTION_KEY` and other app secrets. Stop writing to the old instance during the cut-over, otherwise two installations accumulate diverging data.

## Updates and rollback

```sh
git pull --ff-only origin main
PULSE_CONFIG=/etc/pulse/backup.conf ./infra/backup-full.sh        # before every update
# then re-run the Jenkins job, or:
docker compose --env-file .env.production -f compose.jenkins.yml up -d --build --wait
```

- Images are tagged with the Git commit (`PULSE_IMAGE_TAG`), so the previous one stays available for a code rollback. Rolling back code does **not** undo database migrations: for a schema rollback restore the pre-update backup into a new project.
- The service worker updates in the background and waits while PULSE windows are open, so it never reloads in the middle of a workout. Close every tab/PWA window and reopen to activate the new version.

## Troubleshooting

- **502 from the proxy** — check `docker compose ps`; Strapi must be healthy (`/_health` → 204). Do not expose port 1337 to fix it.
- **Login fails or loops** — the proxy is not sending `X-Forwarded-Proto: https`, or you are using plain HTTP. Cookies are `Secure`.
- **403 on a write** — the `Origin` must be exactly the frontend domain. Never disable CSRF protection; fix the domain or the proxy headers.
- **429 on login** — respect `Retry-After` and check that the real client IP reaches Strapi. Restarting does not clear the limit.
- **Empty admin / CSP errors** — the image was built with a wrong `PUBLIC_API_URL`: fix it and rebuild.
- **Port already in use** — change `PULSE_FRONTEND_PORT` / `PULSE_API_PORT` in the env file.
- Automated tests only use synthetic `example.invalid` users on isolated databases: never run the fixture-reset scripts on a real instance.

## Aggiornamento che introduce piani CSV e impostazioni personali

**Non eseguito sulla produzione da questa attività.** Questo aggiornamento riguarda frontend e backend e aggiunge colonne nullable ai piani e una collezione personal-setting: prima di avviare Strapi aggiornato sul server occorrono **backup verificato e autorizzazione esplicita del proprietario**. Non avviare automaticamente la pipeline di deploy con sincronizzazione schema senza questi prerequisiti.

1. Utilizzare il Compose/progetto/env realmente in uso (domini configurabili), senza creare un secondo stack o cambiare DNS.
2. Eseguire il backup completo cifrato configurato e `infra/restore-isolated.sh` per verificarlo in copia isolata. Controllare che DB/upload/configurazioni siano coerenti e che la chiave di recupero sia disponibile.
3. Dopo autorizzazione, aggiornare main, ricostruire frontend e Strapi e attendere gli healthcheck secondo i comandi della sezione aggiornamenti. La sincronizzazione schema è additiva: nessun backfill di status su piani personali, nessuna importazione automatica o cancellazione dei dati originali.
4. Collaudare prima con un account sintetico privato: download template, anteprima (nessuna nuova versione), conferma bozza, attivazione, export/reimport, ownership e caso60/50/senza peso/60. I file CSV non vanno inseriti nella Media Library.
5. Verificare che le giornate già preparate restino sul loro piano e che gli allenamenti mantengano snapshot e standard. Nessun target salvato viene sovrascritto da valori predefiniti.

Rollback: una versione precedente a questa estensione sceglieva il piano più recente ignorando lo stato. Dopo aver creato bozze/archivi CSV non basta tornare alla vecchia immagine: potrebbe scegliere una versione non attiva. Preferire correzione in avanti; un rollback completo richiede una finestra di manutenzione e un ripristino coordinato di backup verificato, valutando esplicitamente come preservare i nuovi dati successivi al backup. Non eliminare le nuove tabelle/colonne o i volumi come scorciatoia.

Per il collaudo locale: creare una sola volta le fixture con `backend/scripts/csv-test-fixtures.js`, opt-in PULSE_TEST_FIXTURES=1 e output privato /testout; non usarlo in produzione. Riusare il file credenziali, senza resettare altri utenti. Eseguire tests/csv-api.mjs, tests/csv-legacy.mjs (sola lettura dei piani storici sintetici), tests/csv-persistence.mjs --capture prima del restart e senza --capture dopo; browser con PULSE_CSV_CREDENTIALS e PULSE_TEST_CREDENTIALS nei rispettivi file privati.

## Aggiornamento Allenati e gestione integratori

La procedura resta manuale. **Non avviare il job Jenkins prima di backup con ripristino verificato e autorizzazione all’estensione dello schema.** Usare il progetto Compose, i volumi e la credenziale pulse-env già in uso; non inizializzare un altro PostgreSQL e non eseguire fixture o import personali.

1. Sincronizzare il codice su main senza avviare nuovi container, conservando la release precedente. Configurare il backup con PULSE_COMPOSE_FILE puntato al vero compose.jenkins.yml, PULSE_ENV_FILE al file privato di produzione e PULSE_PROJECT al progetto reale, usando infra/compose-command.sh e la configurazione 0600. Eseguire backup-full.sh e restore-isolated.sh, controllando hash/conteggi e dati in copia. La sola lettura di pg_restore --list non è una verifica completa di ripristino.
2. Per il player Flow si usa la cartella persistente `/srv/pulse/flow`. Per scegliere un’altra cartella, impostare `FLOW_STORAGE_PATH` nella credenziale env su un percorso assoluto esterno al workspace. Installare la release fissata con infra/install-flow.mjs e verificare gli hash; non entra nell’immagine Docker. Vedere docs/FLOW_DATASET.md. Senza associazioni flowId o dataset installato non vengono inventate animazioni.
3. Dopo autorizzazione eseguire **Build Now** sul job main del commit scelto. La pipeline esistente ricostruisce frontend e backend; Strapi sincronizza le sole estensioni additive descritte in docs/TRAINING_SUPPLEMENTS.md all’avvio. Nessun reset o backfill delle prescrizioni personali è previsto.
4. Verificare healthcheck, login, identità del piano attivo e degli standard, organizzazione schede e avvio/annullamento di una sessione sintetica. Verificare un prodotto sintetico, due orari, assunzione/annullamento, storico e owner. Controllare i dati personali preesistenti senza importarli nuovamente. Archiviare le sole prove create appositamente.
5. Terminare/sincronizzare le sessioni prima di chiudere tutte le finestre PWA e riaprirle per la nuova shell. Non cancellare i dati del sito con una coda ancora in attesa. Nessun aggiornamento forzato mentre ci si allena.

Per il rollback preferire una correzione in avanti: il vecchio backend eliminava fisicamente le assunzioni annullate e non interpretava gli stati skipped/cancelled. Tornare al vecchio codice sul database aggiornato può mostrare questi record come assunti. Un rollback completo richiede manutenzione e ripristino coordinato del backup, preservando esplicitamente le nuove registrazioni successive; non eliminare colonne o volumi.


## Aggiornamento interfaccia PULSE

1. Verificare che il job Jenkins esistente usi il repository `v3zz0/pulse-app`, branch `main`, script `Jenkinsfile`, nodo `docker-vezzo` e credenziale file `pulse-env`. Conservare progetto Compose, bind e volumi della release in uso.
2. Prima dell’aggiornamento, eseguire il backup con `sudo PULSE_CONFIG=/etc/pulse/backup.conf ./infra/backup-full.sh` sul server. In un ambiente isolato con accesso alla chiave di recupero, verificare l’archivio appena prodotto con `./infra/restore-isolated.sh /percorso/backup.tar.gpg`. Se l’istanza parte da una release precedente a `3f1d0da`, seguire anche le istruzioni sopra per l’estensione dello schema. Il restyling qui descritto non richiede nuove colonne o migrazioni.
3. Nel job main scegliere **Build Now** e controllare che il checkout includa il commit del restyling. Verificare gli stage **Verifica configurazione**, **Deploy** e **Verifica**. La pipeline ricostruisce entrambe le immagini e attende gli healthcheck. Se Flow è installato, mantenere `FLOW_STORAGE_PATH` e la stessa release del dataset.
4. A sessione sincronizzata, chiudere e riaprire tutte le finestre PULSE per attivare la nuova versione della PWA. Verificare le card Allenati, una pesata sintetica, le assunzioni in Oggi e un promemoria di prova. Controllare che Configura integratori non aggiunga promemoria.

## Rilascio delle associazioni Flow

1. Sul nodo Docker verificare se esiste già la directory `/srv/pulse/flow/961bb2739015da373daa43b960c28ee839fe93e6` con catalogo, asset e licenze. Se manca, usare il checkout fissato e l’installatore di [FLOW_DATASET.md](docs/FLOW_DATASET.md) con `--target /srv/pulse/flow`, oppure copiare una release già verificata e ripetere il controllo. Jenkins monta il percorso predefinito quando la credenziale `pulse-env` lascia `FLOW_STORAGE_PATH` vuoto. Un valore esplicito prevale e deve puntare alla cartella persistente.
2. Eseguire il backup di pre-rilascio e verificarne il ripristino in copia isolata secondo la sezione Backups. Il nuovo campo nullable `flowAssociations` viene aggiunto da Strapi all’avvio dell’immagine aggiornata. I programmi e le sessioni esistenti non richiedono reimportazione. Procedere solo dopo autorizzazione all’aggiornamento dello schema online.
3. Sul job PULSE `main`, avviare **Build Now**. Verificare il checkout del commit Flow e gli stage **Deploy** e **Verifica**. Le immagini ricostruite usano il mount esterno in sola lettura e i volumi esistenti.
4. Sul nodo Docker, verificare il mount e un fotogramma dal container Strapi di produzione:

   ```sh
   docker ps --filter label=com.docker.compose.project=pulse-production \
     --filter label=com.docker.compose.service=strapi --format '{{.Names}}'
   docker exec <container-strapi> node -e '
     const f = require("./src/pulse/flow/runtime");
     const lock = require("./flow.lock.json");
     Promise.all([f.catalog(), f.asset(lock.revision, "0025", "frame-00.svg")])
       .then(([catalog]) => console.log(catalog.revision, catalog.animated.length))
       .catch(error => { console.error(error.message); process.exitCode = 1; });
   '
   ```

   L’output atteso contiene la revisione del lock e `1257`.
5. Dopo aver sincronizzato l’allenamento, chiudere tutte le finestre e schede PULSE e riaprire l’app. In Allenati, aprire una panca piana BB e controllare Flow e il comando **Cambia animazione**. Scaricare le animazioni della scheda aperta prima della prova senza connessione.

## Rilascio degli editor e di Progressi

1. Identificare la nuova revisione su `main` e annotare il commit e i tag delle immagini già in esecuzione. Usare il job PULSE, il progetto Compose, i volumi PostgreSQL e la credenziale `pulse-env` esistenti.
2. Eseguire `infra/backup-full.sh` con la configurazione del server e verificare il nuovo archivio con `infra/restore-isolated.sh` in un ambiente isolato. Ottenere l’autorizzazione esplicita per l’avvio di Strapi con lo schema aggiornato.
3. Avviare manualmente **Build Now** nel job Jenkins di PULSE associato a `main`. Il job valida Compose, ricostruisce frontend e backend, avvia i servizi con i volumi esistenti e verifica la loro salute. Strapi aggiunge la collezione degli esercizi personali e i campi nullable degli editor. Non servono reimport dei piani né cambiamenti ai file di configurazione di Flow.
4. Una volta completato il job, verificare con un account dedicato che si aprano Allenati, Dieta e Progressi e che i programmi e lo storico esistenti siano disponibili. Provare salvataggio e riapertura di una scheda di test. Per la PWA, terminare l’eventuale allenamento e riaprire PULSE per adottare il nuovo bundle.
5. In caso di problemi, usare l’inventario del backup per il recupero. Un rollback del solo codice non ripristina lo schema e può interpretare in modo diverso le nuove pianificazioni settimanali. Testare il ripristino in copia isolata e valutare le scritture successive al backup prima di intervenire sui volumi online.

[Dettagli sugli editor e sullo schema](docs/PLAN_EDITORS.md)
