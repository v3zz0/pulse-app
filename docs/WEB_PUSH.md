# Notifiche Web Push in PULSE

## Configurazione in Jenkins

Genera una coppia VAPID con la libreria Web Push inclusa nel backend. Da una macchina con Node.js e le dipendenze di PULSE installate puoi creare un file privato di configurazione.

```sh
umask 077
node -e '
  const k = require("./backend/node_modules/web-push").generateVAPIDKeys();
  process.stdout.write("PULSE_WEB_PUSH_PUBLIC_KEY=" + k.publicKey + "\n");
  process.stdout.write("PULSE_WEB_PUSH_PRIVATE_KEY=" + k.privateKey + "\n");
' > /tmp/pulse-vapid.env
```

Aggiungi entrambi i valori e `PULSE_WEB_PUSH_SUBJECT=mailto:indirizzo-del-gestore@example.com` alla credenziale file Jenkins `pulse-env`, insieme alla configurazione esistente. Usa un contatto reale per il mittente. Il file di esempio elenca soltanto i nomi. La chiave privata è letta da Strapi e rimane nel suo ambiente. Il frontend recupera solo la chiave pubblica tramite una sessione PULSE.

Il job Jenkins già presente passa le variabili al backend con Compose. Il nodo e il container devono avere accesso HTTPS in uscita al servizio push del browser. Il primo deploy aggiunge le tabelle `pulse_push_devices` e `pulse_push_deliveries`. I promemoria esistenti conservano configurazione e storico. Segui la procedura di backup e rilascio in [DEPLOYMENT.md](../DEPLOYMENT.md). Conserva la stessa coppia VAPID ai deploy successivi. Per ruotarla, disattiva le iscrizioni precedenti e invita gli utenti ad attivarle nuovamente.

Con variabili assenti o non valide, la pagina Promemoria offre la modalità locale con PULSE aperta. Con almeno un dispositivo push attivo per l’account, il job server gestisce le notifiche di sistema e la pagina continua a mostrare la lista delle scadenze.

## Prova su Android

1. Dopo l’aggiornamento, chiudi e riapri PULSE da Chrome su HTTPS per attivare il nuovo service worker.
2. Vai in **Altro → Promemoria**, tocca **Attiva notifiche push** e consenti le notifiche.
3. Tocca **Invia notifica di prova**. Verifica che nel pannello notifiche compaia «La notifica di prova è arrivata».
4. Crea un promemoria **Personalizzato** per due minuti più tardi. Chiudi la PWA e tutte le schede PULSE, poi blocca lo schermo. Tocca l’avviso quando arriva per aprire Oggi.
5. Ripeti con una dose di prova e segnala l’assunzione prima dell’orario. Se il promemoria è già in scadenza, prova anche **Rinvia 15 min** e **Chiudi per oggi**.

La consegna dipende dalle autorizzazioni di Chrome e Android, dalla connettività e dalle impostazioni di risparmio energetico. La sessione PULSE dura sette giorni. La riattivazione è necessaria dopo la sua scadenza o dopo un logout. Le push in viaggio hanno una durata massima di due minuti. Su iOS la disponibilità dipende da Web Push per le app aggiunte alla schermata Home. [Documentazione WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Comportamento applicativo

- Strapi controlla le scadenze ogni 30 secondi. Le scadenze rispettano il fuso salvato. I nuovi promemoria partono da `Europe/Rome`. Nell’ora primaverile saltata, un orario inesistente diventa esigibile al primo minuto valido. Nell’ora autunnale ripetuta c’è una sola occorrenza per dispositivo e giorno. I rinvii oltre mezzanotte conservano il giorno di origine fino alla scadenza successiva.
- Il job consulta lo stato di completamento prima dell’invio. Per i pasti usa il piano del giorno salvato, o il piano attivo per un giorno ancora privo di snapshot. Le modifiche a promemoria e registrazioni sono ricontrollate al momento della visualizzazione.
- Una prenotazione in PostgreSQL coordina i worker per dispositivo e scadenza. La ricevuta casuale è l’unico contenuto del payload. Il service worker la riscatta una volta e solo con la stessa sessione, dopo il controllo di validità. Titolo e messaggio sono generici. La notifica apre Oggi.
- Un errore del servizio con stato 404 o 410 rimuove l’iscrizione. Per problemi temporanei si fanno al massimo tre tentativi, mantenendo la stessa ricevuta. L’app mostra i promemoria in scadenza quando viene riaperta. Il servizio di push può accettare un messaggio che il dispositivo riceverà in seguito.
- La Home filtra le singole dosi, incluse quelle accodate offline. Le rettifiche e gli annullamenti sono disponibili nello **Storico assunzioni** in **Altro → I miei integratori**. Le registrazioni rimangono nello storico.

## Collaudo integrato locale

`frontend/tests/browser/background-push.spec.js` usa due account sintetici e un broker locale. Il broker intercetta soltanto gli endpoint di collaudo e conserva il messaggio VAPID cifrato per decifrarlo con la chiave effimera del browser di prova. Il test lo consegna a Chromium tramite CDP mentre le schede PULSE sono chiuse, attende una risposta autenticata del service worker e legge la notifica registrata da Chromium. Questo esercita il job PostgreSQL, il trasporto cifrato e il service worker, con il servizio push esterno sostituito dal broker di collaudo.

Per ripetere, usa lo stack Docker locale su porta 8081 e una coppia VAPID di prova. Monta una directory privata su `/push-test` con `tests/fixtures/web-push-transport.cjs` disponibile come `transport.cjs`. Solo nel container di test imposta `NODE_OPTIONS=--require /push-test/transport.cjs` e `PULSE_TEST_PUSH_OUT=/push-test/deliveries.jsonl`. Crea gli utenti con `docker compose exec -T strapi node < tests/fixtures/web-push-users.cjs`. Passa il percorso host della directory a Playwright come `PULSE_WEB_PUSH_FIXTURE` ed esegui `npm run test:e2e -- background-push.spec.js` dalla directory frontend.

## File della modifica

- Frontend PWA: `frontend/service-worker.js`, `frontend/pwa-plugin.js`, `frontend/src/web-push.js`, `frontend/src/Reminders.vue`, `frontend/src/ReminderSettings.vue`, `frontend/src/stores/auth.js`.
- Home e integratori: `frontend/src/components/TodaySupplements.vue`, `frontend/src/components/SupplementHistory.vue`, `frontend/src/Supplements.vue`, `frontend/src/today-intakes.js`, `frontend/src/stores/supplement-intakes.js`.
- Backend: `backend/src/api/push/controllers/push.js`, `backend/src/api/push/routes/push.js`, i due `schema.json` sotto `backend/src/api/push-device` e `backend/src/api/push-delivery`, `backend/src/api/reminders/controllers/reminders.js`, `backend/src/pulse/push.js`, `backend/src/pulse/reminder-due.js`, `backend/src/pulse/reminders.js`, `backend/src/pulse/supplements.js`, `backend/src/pulse/auth.js`, `backend/config/server.js`, `backend/package.json`, `backend/package-lock.json`.
- Configurazione e guide: `.env.example`, `infra/production.env.example`, `docker-compose.yml`, `compose.jenkins.yml`, `DEPLOYMENT.md`, `docs/VALIDATION.md` e questa guida.
- Test: `backend/tests/push.test.js`, `backend/tests/reminders.test.js`, `frontend/tests/today-intakes.test.js`, `frontend/tests/browser/background-push.spec.js`, `frontend/tests/browser/features.spec.js`, `frontend/tests/browser/notifications.spec.js`, `tests/fixtures/web-push-transport.cjs`, `tests/fixtures/web-push-users.cjs`.
