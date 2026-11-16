# Logo ufficiale, favicon e icone PWA

La sorgente fornita dall’utente è conservata senza modifiche in `frontend/branding/pulse-official.png` (1254×1254, SHA256 `b4b21f68cae12edf70d374b2360ac7fddcbbc06cc2e89ee875d19154e9cdc6a0`). Non viene pubblicata integralmente nel bundle: vengono distribuite le esportazioni in `frontend/public`.

## Esportazioni

- `/favicon.ico`: tre immagini interne 16×16, 32×32 e 48×48.
- `/favicon-16x16.png`, `/favicon-32x32.png`.
- `/apple-touch-icon.png`: 180×180.
- `/icons/pulse-192.png`, `/icons/pulse-512.png`: icone standard, purpose `any`.
- `/icons/pulse-maskable-192.png`, `/icons/pulse-maskable-512.png`: purpose `maskable`.

Le versioni standard ritagliano solo parte dello sfondo esterno per rendere il simbolo leggibile alle piccole dimensioni, senza deformarlo o ricolorarlo. Le maskable conservano l’intera immagine originale con ulteriore margine scuro #0B1018: il simbolo rimane nel cerchio sicuro centrale di raggio 40% della dimensione. Verifica sui pixel del simbolo: raggio massimo 67,94/76,8 px per 192, e 183,25/204,8 px per 512. ICO e PNG conservano lo sfondo scuro anche sulle schede di browser con tema chiaro.

Non viene fornito un SVG: la sorgente è raster, e un tracciamento automatico altererebbe curve, sfumature o bordi. Nessuna icona generica o generazione AI sostituisce la sorgente.

Per rigenerare, con Python 3 e Pillow disponibili:

```sh
python3 frontend/scripts/generate-icons.py
cd frontend
npm run build
npm test
```

## Manifest e aggiornamento sicuro

Name/short_name PULSE, theme/background #0B1018. Id, scope, start_url, display, lingua e descrizione preservati. Le quattro icone distinguono purpose `any` e `maskable`.

Il plugin Vite include favicon e icone nella shell precache e nel suo hash di versione: cambiando le immagini cambia il nome della cache. Il service worker mantiene il normale ciclo di attesa, senza skipWaiting o refresh forzati. Prima di chiudere l’app sincronizzare l’allenamento; chiudere tutte le schede/finestre PULSE e riaprire. API, dati personali e upload restano esclusi da CacheStorage.

## Aggiornare il sito online

Questo lavoro non ha effettuato alcun deployment. Eseguire la pipeline Jenkins già configurata perché acquisisca `main` e ricostruisca il frontend. Se il deploy è manuale, nel checkout sul server usare **lo stesso progetto Compose e lo stesso file env già in uso**, senza creare un secondo stack:

```sh
git pull --ff-only origin main
# Esempio soltanto per uno stack che usa già questi file:
docker compose --env-file /etc/pulse/production.env -f compose.production.yml \
  up -d --no-deps --build --wait frontend
```

Non occorre cambiare DNS, backend, database, volumi o proxy per aggiornare queste risorse. Non usare down -v. Verificare sul frontend effettivo `https://pulse.vezzo.vp360web.com`:

```sh
curl --fail --show-error https://pulse.vezzo.vp360web.com/favicon.ico -o /tmp/pulse-favicon.ico
curl --fail --show-error https://pulse.vezzo.vp360web.com/manifest.webmanifest
curl --fail --show-error https://pulse.vezzo.vp360web.com/icons/pulse-maskable-512.png -o /tmp/pulse-maskable.png
```

Aprire una nuova scheda e controllare l’icona; una vecchia scheda può conservare la favicon in memoria. In DevTools → Application → Manifest verificare quattro icone e assenza di errori; in Service Workers verificare il worker aggiornato dopo chiusura delle finestre. Non cancellare dati del sito per aggiornare un’icona quando esistono bozze offline.

## Android già installato

1. Prima sincronizzare tutte le modifiche degli allenamenti.
2. Dopo il deploy, aprire PULSE connessa alla rete; chiudere tutte le finestre PULSE e riaprirla per usare la nuova shell.
3. L’icona del launcher viene aggiornata dal browser/Android separatamente dalla cache dell’app e può richiedere tempo. Per una WebAPK Chrome può applicare l’aggiornamento dopo la chiusura delle finestre, con dispositivo collegato all’alimentazione e al Wi-Fi. Non promettere aggiornamento immediato. [Comportamento ufficiale Chrome](https://web.dev/articles/manifest-updates).
4. Controllare icona nella Home e nell’elenco app, nome PULSE e assenza di tagli con maschera circolare/arrotondata. Aprire una sessione già memorizzata offline, poi tornare online e verificare la sincronizzazione.
5. Se resta un vecchio semplice collegamento Home, potrebbe non ricevere aggiornamenti dei metadati come una WebAPK. Solo dopo aver verificato la sincronizzazione completa, rimuovere il collegamento/reinstallare da Chrome → Installa app. Disinstallazione o cancellazione dei dati possono rimuovere bozze locali: non usarle come primo tentativo.

Il test automatico è su Chromium desktop a 360/390/1440 px. Non sono stati certificati Chrome Android fisico, Edge, Firefox o Safari; verificarli manualmente sul sito aggiornato. PNG/ICO e apple-touch-icon sono predisposti, ma la compatibilità prevista non viene presentata come un collaudo eseguito.
