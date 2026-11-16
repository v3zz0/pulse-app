# PULSE — preparazione e deployment privato

## Stato e indirizzi definitivi

Fase4: configurazione e collaudi **locali** predisposti. Nessun deploy remoto, cambio DNS o pubblicazione eseguito. Non considerare questa guida un'autorizzazione al go-live. Leggere prima [SECURITY.md](docs/SECURITY.md) e [VALIDATION.md](docs/VALIDATION.md), inclusi i25 finding npm residui e le mitigazioni specifiche.

- Frontend/PWA: **https://pulse.vezzo.vp360web.it**
- Backend: **https://apipulse.vezzo.vp360web.it**
- Admin: **https://apipulse.vezzo.vp360web.it/admin**

L'app usa richieste relative `/api/pulse/*` sul dominio frontend. Caddy le inoltra direttamente a Strapi: cookie personale host-only, HttpOnly, Secure, SameSite Strict, niente token nel web storage e niente cookie condivisi tra sottodomini. Il dominio backend e il pannello nativo sono raggiungibili soltanto da CIDR amministrativi/VPN autorizzati. CORS contiene solo i due indirizzi definitivi; le mutazioni personali richiedono Origin frontend esatto.

## Server e prerequisiti

Server Linux privato con Docker Engine e Compose v2 (`up --wait`), Git, Bash, Node24 per generatori/preflight, curl, OpenSSL, Python3, GnuPG, rsync/OpenSSH e util-linux/flock. Provati container Linux amd64. Prevedere spazio per PostgreSQL, upload, immagini e backup: dimensionare in base ai dati. Per build Strapi sul server,4GiB RAM sono una base da verificare;8GiB riducono la pressione durante gli aggiornamenti. Non eseguire build concorrenti alle attività critiche su un host piccolo.

Immagini bloccate tramite digest: Node24.22.3, nginx1.28.3, PostgreSQL17 e Caddy2.11.9 nel collaudo. Aggiornare i digest con un'attività dedicata e nuovo audit/test; non cambiare tag in produzione alla cieca. Docker daemon/socket accessibile solo agli amministratori; l'app Strapi usa l'utente node. Il DB non pubblica alcuna porta. Su un volume nuovo viene creato un ruolo applicativo non superuser, distinto da pulse_maintenance; l’init script non si applica retroattivamente ai volumi esistenti. Solo il proxy possiede porte host; frontend e Strapi restano su rete applicativa interna, DB su rete dedicata.

Installare Docker seguendo la [documentazione ufficiale Linux](https://docs.docker.com/engine/install/). Non abilitare connessioni Docker TCP pubbliche. Configurare accesso SSH tramite chiavi, aggiornamenti OS e firewall; se si abilitano80/443, controllare anche il firewall del provider e le regole Docker (non affidarsi alla sola configurazione UFW).

## Configurazione privata iniziale

Il repository lavora direttamente su main. Sul server autorizzato:

```sh
sudo install -d -m 755 -o "$(id -u)" -g "$(id -g)" /srv/pulse-app
git clone git@github.com:v3zz0/pulse-app.git /srv/pulse-app
cd /srv/pulse-app
git switch main
git pull --ff-only origin main
sudo install -d -m 700 /etc/pulse
# Eseguire in una directory privata VUOTA: il generatore non sovrascrive file.
sudo sh -c 'cd /etc/pulse && node /srv/pulse-app/infra/init-env.js && mv .env production.env && chmod 600 production.env'
sudoedit /etc/pulse/production.env
```

Integrare nel file privato le voci di `infra/production.env.example`, conservando i valori casuali generati. Non copiare la `.env` reale nel repository né incollare configurazioni risolte nei log/chat. Non ruotare APP_KEYS o encryptionKey durante un aggiornamento ordinario: influenzano sessioni e dati cifrati Strapi. Conservare segreti e chiavi di ripristino in un archivio protetto esterno.

| Variabile | Uso |
|---|---|
| DATABASE_NAME / DATABASE_USERNAME | DB applicativo e ruolo PostgreSQL, default generatore pulse |
| DATABASE_PASSWORD | Password del ruolo applicativo, casuale, almeno32 caratteri |
| PG_MAINTENANCE_PASSWORD | Password diversa per il superuser pulse_maintenance, mai passata a Strapi |
| APP_KEYS | Quattro chiavi casuali separate da virgole |
| ADMIN_JWT_SECRET / JWT_SECRET | Segreti distinti admin/plugin |
| API_TOKEN_SALT / TRANSFER_TOKEN_SALT / ENCRYPTION_KEY | Segreti distinti Strapi |
| PULSE_IMAGE_TAG | Tag della release, preferibilmente SHA Git completo |
| PULSE_BIND_IP | **127.0.0.1 di default**,0.0.0.0 solo dopo autorizzazione pubblicazione |
| PULSE_HTTP_PORT / PULSE_HTTPS_PORT | Default80/443; solo per prove locali HTTP può essere18080 |
| TLS_CONFIG | Default `./infra/caddy/tls-internal.caddy`, ACME pubblico solo dopo autorizzazione |
| ACME_EMAIL | Email operativa reale, necessaria quando si sceglie tls-public.caddy |
| ADMIN_ALLOW_CIDRS | Sorgenti effettive amministrative/VPN; no 0/0, no intere reti Docker in produzione |
| PULSE_EXPECTED_IPS | IP del server separati da virgola per il controllo DNS read-only |
| LOG_LEVEL | info in produzione; http locale. Non abilitare log di body/token |

PUBLIC_ORIGIN, PUBLIC_API_URL, CORS_ORIGINS e TRUST_PROXY sono fissati correttamente in `compose.production.yml`; il backend rifiuta all'avvio una configurazione di produzione incoerente. L'admin viene compilato con l'URL backend definitivo. [Configurazione Strapi server/proxy](https://docs.strapi.io/cms/configurations/server).

Verifica senza stampare segreti:

```sh
cd /srv/pulse-app
sudo node infra/preflight.js /etc/pulse/production.env
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml config --quiet
```

Il preflight controlla permessi, segreti, CIDR e, con `--public`, DNS. Non autorizza la pubblicazione e non certifica da solo la sicurezza. `infra/backup.conf` è invece un file di assegnazioni Bash riservato, non una dotenv.

## DNS, HTTPS e prova privata

Il16 novembre2026 entrambi i nomi risultavano **NXDOMAIN** anche tramite Google Public DNS (Status3, nessuna risposta A). Non è stata modificata alcuna zona. Prima del deployment, l'amministratore DNS dovrà creare i record A dei due nomi verso l'IPv4 del server. Non creare AAAA finché IPv6, firewall e bind non sono configurati e collaudati; un AAAA errato può impedire ACME e accesso Android. Usare inizialmente DNS diretto, senza CDN/proxy intermedio: una catena proxy diversa richiede nuova revisione degli header fidati e dell'allowlist admin.

```sh
# Da una rete esterna, dopo aver predisposto manualmente i DNS:
dig +short A pulse.vezzo.vp360web.it
dig +short A apipulse.vezzo.vp360web.it
dig +short AAAA pulse.vezzo.vp360web.it
dig +short AAAA apipulse.vezzo.vp360web.it
```

La prova privata predefinita usa CA interna, binding loopback e nessun contatto con ACME pubblico:

```sh
cd /srv/pulse-app
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml up -d --build --wait
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml ps
# Estrarre SOLO il certificato pubblico della CA per le prove, mai root.key.
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml cp \
  proxy:/data/caddy/pki/authorities/local/root.crt /etc/pulse/test-root.crt
curl --cacert /etc/pulse/test-root.crt --resolve pulse.vezzo.vp360web.it:443:127.0.0.1 \
  https://pulse.vezzo.vp360web.it/
```

La CA interna non è automaticamente fidata da Android/browser. Nel collaudo automatizzato browser è stata usata un'eccezione per la sola CA di test, mentre Node/curl hanno verificato esplicitamente la catena con quel certificato. Non usare `-k`, ignore-certificate-errors o eccezioni equivalenti come soluzione sul server reale.

Per una prova privata via VPN usare risoluzione privata dei due nomi, bind all'IP VPN e CA fidata solo dai dispositivi di test. L'Origin frontend deve rimanere esattamente quello indicato, senza porta alternativa: una visita a un IP o a un hostname diverso non è equivalente. Se si usa un tunnel SSH, preservare nome e porta443 e considerare il CIDR sorgente che Caddy osserva effettivamente; non allargare indiscriminatamente l'allowlist per far passare un test.

## Comandi di pubblicazione — NON eseguiti, solo dopo autorizzazione

Prima completare DNS, firewall, backup esterno, revisione dei rischi residui e sorgenti IP admin. Nel file privato impostare:

```dotenv
PULSE_BIND_IP=0.0.0.0
PULSE_HTTP_PORT=80
PULSE_HTTPS_PORT=443
TLS_CONFIG=./infra/caddy/tls-public.caddy
```

Inserire anche ACME_EMAIL, PULSE_EXPECTED_IPS e ADMIN_ALLOW_CIDRS reali. Poi:

```sh
cd /srv/pulse-app
git pull --ff-only origin main
sudo node infra/preflight.js /etc/pulse/production.env --public
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml config --quiet
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml up -d --build --wait
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml ps
curl --fail --show-error https://pulse.vezzo.vp360web.it/
curl --fail --show-error https://pulse.vezzo.vp360web.it/manifest.webmanifest
```

Caddy ottiene e rinnova i certificati dei due domini usando ACME;80/443 devono essere raggiungibili dal relativo challenge. Non esporre1337,8080 o5432. Il backend/admin deve dare403 da una sorgente non autorizzata,200/login da quella autorizzata. Il test non richiede accesso pubblico al pannello: l'allowlist protegge le risposte applicative senza impedire i challenge TLS del proxy. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Amministratore, utente e import privati

Da una sorgente IP/VPN autorizzata aprire `https://apipulse.vezzo.vp360web.it/admin` e creare l'amministratore iniziale dal pannello nativo. Impostare password lunga e unica e custodirla in password manager. Il login admin ha rate limit nativo; non usare le credenziali admin nell'app Vue.

Nel Content Manager creare l'utente **Users & Permissions**: provider local, ruolo Authenticated, Confirmed attivo, Blocked disattivo. Registrazione pubblica chiusa. Non abilitare CRUD generici Public sulle collezioni personali né usare utenti sintetici in produzione. L'admin è protetto anche per IP: niente credenziali personali nei test automatici.

Montare i PDF da una directory privata sul server; non devono stare negli asset, nelle immagini o nella Media Library. I seguenti import si usano **solo per un utente nuovo**, non a ogni riavvio/deploy. Il parser rifiuta PDF diversi dagli hash revisionati.

```sh
cd /srv/pulse-app
read -r -p 'Email utente personale già creato: ' PULSE_OWNER_EMAIL
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml stop frontend strapi
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml run --rm --no-deps \
  -v /srv/pulse-private/references:/private:ro \
  strapi node scripts/import-nutrition.js \
  '/private/Dieta Alessandro Vezzoli modifica 4.pdf' "$PULSE_OWNER_EMAIL"
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml run --rm --no-deps \
  -v /srv/pulse-private/references:/private:ro \
  strapi node scripts/import-training.js '/private/Scheda-palestra.PDF' "$PULSE_OWNER_EMAIL"
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml up -d --no-build --wait
unset PULSE_OWNER_EMAIL
```

Consultare STRAPI_GUIDE.md e VIDEO_REVIEW.md. Carichi null = da impostare; modificare lo standard solo con conferma. Piano nutrizionale storico da rivedere con il nutrizionista; fase5 non implementata. I video esistenti non sono stati sostituiti.

## Backup automatici completi e copie cifrate

`infra/backup-full.sh` ferma brevemente frontend/Strapi per una copia consistente DB/upload, riparte anche in caso di errore e produce un archivio GPG cifrato con:

- dump PostgreSQL custom e conteggi delle tabelle;
- upload completi;
- env, Compose, configurazione proxy/backup, lockfile, SHA Git/stato checkout e inventario immagini;
- volume Caddy `/data`, inclusi account ACME/certificati: anch'esso resta cifrato.

Il server deve contenere **solo la chiave pubblica** del destinatario; conservare la chiave privata e la sua passphrase su un supporto protetto distinto, provandone l'utilizzo in DR. Un archivio cifrato senza chiave recuperabile non è un backup utile. Il collaudo locale ha usato una chiave sintetica temporanea, non chiavi personali.

```sh
sudo install -d -m 700 /etc/pulse/backup-gnupg /var/backups/pulse
sudo GNUPGHOME=/etc/pulse/backup-gnupg gpg --import /percorso/protetto/backup-public.asc
sudo GNUPGHOME=/etc/pulse/backup-gnupg gpg --fingerprint
sudo install -m 600 infra/backup-config.example /etc/pulse/backup.conf
sudoedit /etc/pulse/backup.conf
# Impostare il fingerprint completo verificato, la destinazione SSH e la chiave dedicata.
sudo PULSE_CONFIG=/etc/pulse/backup.conf /srv/pulse-app/infra/backup-full.sh
```

BACKUP_REMOTE può essere `utente@host:/directory/privata/` e BACKUP_SSH_KEY una chiave dedicata. Preparare prima known_hosts con fingerprint del server remoto verificato fuori banda; lo script usa StrictHostKeyChecking=yes e non invia mai il tar in chiaro. Non usare un bucket/file server pubblico. Il trasferimento esterno non è stato provato su un server reale senza credenziali: resta da configurare e verificare prima del go-live.

Retention locale default30giorni, rotazione solo dopo backup/trasferimento riusciti. Configurare anche retention/quote lato remoto: lo script **non cancella** copie remote e non usa rsync --delete. File locali0700/0600, lock per evitare sovrapposizioni; dump non cifrati intermedi rimossi dal trap al termine. Il backup può interrompere per pochi secondi le richieste: programmare fuori orario. Un SIGKILL o guasto disco non consente trap: controllare directory `.pending-*` protette e usare cifratura del disco server.

```sh
sudo install -m 644 infra/systemd/pulse-backup.service /etc/systemd/system/
sudo install -m 644 infra/systemd/pulse-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pulse-backup.timer
systemctl list-timers pulse-backup.timer
sudo journalctl -u pulse-backup.service --since today
```

Timer alle03:30 **Europe/Rome**, ritardo casuale fino10minuti e recupero esecuzioni perse. Gli errori terminano con exit nonzero e sono registrati nel journal: predisporre il proprio monitoraggio/avviso del servizio, spazio e ultima copia riuscita. Lo scheduling non è stato abilitato sul PC di sviluppo.

## Disaster recovery e prova isolata

Verificare un backup con la chiave privata sul computer di ripristino:

```sh
export GNUPGHOME=/percorso/privato/keyring-ripristino
./infra/restore-isolated.sh /percorso/backup/pulse-YYYYMMDDTHHMMSSZ-PID.tar.gpg \
  /percorso/privato/report-ripristino
```

Questo comando crea container e volume nuovi **senza rete né porte**, verifica GPG e SHA256, esegue pg_restore con exit-on-error, confronta conteggi e verifica gli upload. Li elimina a fine prova e non conosce i volumi originali. Il report contiene schema/conteggi/hash, non env o contenuti dei dati. Deve terminare PASS; un archivio corrotto è rifiutato. Eseguire la prova periodicamente, non soltanto al primo deploy.

Per recuperare un server perso:

1. Preparare host Docker isolato e recuperare repository/SHA e immagini della release indicata nel backup. Non partire subito con proxy pubblico.
2. Decifrare l'archivio in directory0700, verificare SHA256SUMS. Ripristinare env/chiavi di configurazione con permessi0600 e confrontare gli hash/versioni. Non stampare il contenuto dell'env.
3. Usare un progetto Compose **nuovo** (`-p pulse-recovery`), nuovi volumi e binding127.0.0.1/TLS interno. Avviare solo PostgreSQL; creare il DB previsto dall'env e ripristinare con `pg_restore --no-owner --no-privileges --exit-on-error --role "$PULSE_APP_DB_USER"` dal dump, connessi come POSTGRES_USER=pulse_maintenance. PULSE_APP_DB_USER è configurato nel container PostgreSQL dal valore DATABASE_USERNAME; non usare il ruolo di manutenzione nell’app. Non ripristinare sopra un DB originale vivo.
4. Ripristinare uploads.tar nel nuovo volume tramite `compose run --no-deps -T --entrypoint tar strapi -C /app/public/uploads -xf -`. Per Caddy, volume nuovo e caddy-data.tar, oppure nuova emissione dei certificati soltanto dopo autorizzazione/DNS; non distribuire le chiavi CA di prova ai dispositivi reali.
5. Avviare Strapi/frontend con le stesse versioni del backup. Verificare login, ownership, nutrizione, standard/storico, sessione attiva, timer, upload e configurazioni. Confrontare conteggi con database-counts.tsv e ispezionare i dati campione in modo privato.
6. Eseguire preflight/smoke/Android e solo dopo autorizzazione spostare DNS/binding verso il progetto ripristinato. Conservare l'ambiente precedente isolato finché la verifica non è conclusa.

## Migrare un'installazione locale già usata

Per conservare dati già presenti, **non ricreare gli utenti e non rieseguire gli import**: usare il backup completo dell'installazione locale e il percorso di ripristino in un progetto nuovo. Conservare APP_KEYS, ENCRYPTION_KEY e gli altri segreti applicativi originari in modo privato; aggiungere una PG_MAINTENANCE_PASSWORD nuova e distinta, senza rigenerare tutto l'env. Il ruolo DB applicativo può avere una nuova password nel server, purché il backend usi la configurazione corrispondente. Ripristinare con --no-owner e --role del nuovo ruolo applicativo, così i superpoteri del DB di sviluppo non vengono trasferiti al DB di produzione.

Prima confrontare conteggi e campioni in una copia isolata; al cutover fare un ultimo backup consistente e sospendere le scritture sull'istanza locale fino alla verifica del server. Evitare che due installazioni accumulino dati divergenti. Gli account finali e le versioni di piano/schede restano quelli del dump; il cambio dominio richiede un nuovo login ma non un nuovo import. Non eseguire i reset fixture sul server reale.

## Aggiornamenti e rollback

Lavorare su main con fetch/pull --ff-only, senza force push o PR. Prima dell'aggiornamento: checkout pulito, audit delle dipendenze e immagini, backup completo riuscito **e copia esterna verificata**, prova su una copia del DB. Annotare SHA e tag immagine precedente; non eliminare vecchie immagini necessarie al rollback.

```sh
cd /srv/pulse-app
git status --short --branch
git fetch origin main
sudo PULSE_CONFIG=/etc/pulse/backup.conf ./infra/backup-full.sh
git pull --ff-only origin main
# Aggiornare PULSE_IMAGE_TAG nel file privato alla release scelta.
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml build
sudo docker compose --env-file /etc/pulse/production.env -f compose.production.yml up -d --no-build --wait
```

Rollback codice/immagini non annulla migrazioni SQL o modifiche dati. Se lo schema è compatibile e provato, riutilizzare il tag immagine precedente; per rollback di schema usare un progetto/DB nuovo dal backup pre-upgrade e la versione esatta corrispondente. Non riscrivere main per tornare indietro: eventuale fix/revert è un nuovo commit ordinario. Mai `docker compose down -v` su dati da conservare.

Service worker: controlla gli aggiornamenti su ritorno rete/visibilità e ogni15minuti. Un nuovo worker resta **in attesa** mentre esistono finestre PULSE: non forza reload o skipWaiting durante un allenamento. Sincronizzare, chiudere tutte le schede e finestre PWA, riaprire; la nuova shell si attiva e rimuove solo le vecchie cache PULSE, lasciando IndexedDB/sessioni. Gestione aggiornamenti provata con una nuova versione sintetica del worker nella copia locale.

## Verifiche dopo installazione e troubleshooting

- Controllare `compose ps`, healthcheck, rete DB senza porte pubblicate e volumi persistenti; usare `compose config --quiet`, mai config risolto nei log.
- Da una rete non autorizzata, admin/backend403 anche con X-Forwarded-For falsificato. Dal CIDR corretto, login admin e reload funzionanti. Nessun admin sul dominio frontend.
- Login personale: cookie Secure/HttpOnly/Strict host-only; reload ancora autenticato, logout invalida cookie server. Nessun JWT in localStorage. Native JWT login/API non usate chiuse.
- Origin errato o mancante:403 in produzione. Non disabilitare CSRF per risolvere un403: usare il dominio frontend esatto e verificare gli header proxy.
- Login429: rispettare Retry-After e controllare la sorgente IP reale. Non azzerare i contatori per aggirare un attacco; dopo la finestra si rinnovano. Riavviare non rimuove il blocco.
- ACME fallisce: controllare A/AAAA,80/443, firewall provider, email, ora del server e limiti CA; non tentare emissioni ripetute. Proxy502: verificare health Strapi e DNS interno Docker, senza esporre1337.
- Admin vuoto/CSP: verificare immagini compilate con PUBLIC_API_URL corretto, `/admin` accessibile dall'IP e log riservati. Non aggiungere unsafe-eval/wildcard indiscriminatamente.
- Spazio/backup fallito: controllare journal, spazio, recipient/keyring e SSH known_hosts. Lo script riparte dall'app dopo errori; non eliminare l'ultima copia buona. Una copia soltanto locale non protegge dalla perdita del server.
- Test automatici usano soltanto utenti `example.invalid` in DB isolati. Non eseguire script reset fixture sul server personale reale.

Per il collaudo Android seguire [docs/ANDROID_CHECKLIST.md](docs/ANDROID_CHECKLIST.md). I promemoria restano quelli della fase3: in-app/notifiche di sistema mentre PULSE è aperta e connessa, nessuna promessa di push in background a pagina chiusa. Fase5 (video3D e nuova dieta personale) rinviata integralmente.
