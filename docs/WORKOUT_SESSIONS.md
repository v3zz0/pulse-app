# Bozze delle serie e annullamento dell’allenamento

## Uso

Nella sessione attiva il carico proposto è lo **standard all’avvio**, compreso 0 kg. Uno standard null lascia il campo vuoto e mostra «Imposta carico standard». Il risultato precedente resta un’informazione separata, mai una fonte per aggiornare lo standard. «Aggiorna carico standard» mantiene il suo flusso esplicito di conferma e ha effetto sulle sessioni successive.

Una prescrizione esatta, per esempio 5 ripetizioni, propone 5 nel campo modificabile. Un intervallo 8–10 resta visibile e offre i pulsanti 8, 9 e 10 senza sceglierne uno. Gli intervalli più ampi usano un menu di selezione con tutti i valori previsti. Si può comunque registrare un risultato fuori intervallo, per esempio 4 ripetizioni effettivamente riuscite. CED, cedimento, AMRAP e testi ambigui richiedono l’inserimento del risultato. Per circuiti e 5+5+5 vengono conservate le prescrizioni dei singoli movimenti: non viene inventato un numero totale di ripetizioni o un volume aggregato.

- **Completa e registra peso** conferma il carico e le ripetizioni della bozza come risultati effettivi.
- **Completa senza peso** salva actualKg null anche se il campo propone 60 kg.
- **Salta serie** salva actualKg e actualReps null.
- Modificare un campo o scegliere un numero rapido mantiene la serie pending. Non completa la serie.

Ogni input viene scritto nella bozza IndexedDB prima della sincronizzazione. L’indicatore distingue salvataggio locale, sincronizzazione e invio in attesa. Attendere la conclusione di «Salvataggio sul dispositivo…» prima di chiudere l’app. Le richieste di rete usano un lock distinto e non bloccano le scritture locali. Al rientro prevalgono i campi già presenti nella bozza, inclusi i valori azzerati o svuotati esplicitamente. Nessun default viene riassegnato a ogni render. Gli snapshot attivi precedenti ricevono proposte solo per i campi di bozza mancanti; i risultati storici restano intatti.

## Annullamento

Menu **⋮ → Annulla allenamento**. La finestra di conferma segnala quante serie sono già state completate; «Torna all’allenamento» lascia tutto invariato. «Annulla definitivamente» registra l’intenzione terminale sul dispositivo, ferma il timer e chiude le notifiche di allenamento pertinenti ancora mostrate. La configurazione dei promemoria dei giorni successivi rimane disponibile; un avvio, anche successivamente annullato, sopprime il promemoria di quella scheda per la giornata corrente.

L’annullamento funziona offline. Finché non è confermato dal server, il programma è visibile ma un nuovo avvio è disabilitato. Alla riconnessione l’app invia l’annullamento prima delle operazioni pendenti della stessa sessione. Solo dopo la risposta rimuove quelle operazioni dalla coda; non elimina code di altre sessioni. Se un altro dispositivo ha già annullato la sessione, le vecchie operazioni locali vengono ritirate dopo la lettura del suo stato terminale. Una diversa sessione avviata altrove viene quindi caricata normalmente.

Il backend serializza per proprietario, richiede conferma e conserva lo snapshot più recente sul server. L’intenzione di annullare può superare una revisione obsoleta; non può annullare una sessione già completed. Replay di avvio o operazioni già ricevute restituiscono lo stato attuale, senza riattivare una sessione cancelled. Un nuovo opId di modifica su sessione annullata viene rifiutato. Le sessioni annullate non compaiono nello storico completato, nel volume o nei riepiloghi. Lo snapshot resta conservato nel database, senza cancellazione fisica e senza modificare i carichi standard.

## Schema e API

Estensione additiva di workout-session: stato **cancelled** e campo nullable **cancelledAt**. Nessuna nuova collezione, cancellazione o migrazione dei risultati conclusi. Nei JSON delle serie si aggiungono draftReps e repProposal, separati da actualReps.

- GET `/api/pulse/training/sessions/:clientId`: stato della sola sessione appartenente all’utente autenticato, incluso cancelled.
- PUT sul medesimo percorso: nuova action `cancel`, confirm true, opId UUID, revision intera, occurredAt. Le altre action restano compatibili; le modifiche pending supportano campi parziali draftKg/draftReps e il precedente actualReps come alias di bozza.
- Gli annullamenti usano cancelledAt del server e possono sincronizzarsi anche dopo oltre 30 giorni offline. Le normali operazioni mantengono il limite temporale preesistente.

Le schermate, il programma originale A/B/C, i CSV, i video, la dieta e gli integratori mantengono il loro modello. I file dell’integrazione Flow in corso sono conservati separatamente: questa modifica non completa né certifica il player o la cache Flow.

## Collaudo riproducibile

Solo stack locale e utenti sintetici. Il test API prepara un piccolo piano CSV versionato e riutilizzabile per pulse-csv-test-1@example.invalid; non usare account personali. Conserva lo storico esistente e annulla soltanto eventuali sessioni attive di quell’account di test.

```sh
npm test --prefix backend
npm run build --prefix frontend
npm test --prefix frontend
node tests/workout-drafts-api.mjs
cd frontend
npx playwright test tests/browser/workout-drafts.spec.js
```

Dopo il test API e senza ulteriori allenamenti completati sullo stesso utente sintetico, riavviare PostgreSQL/Strapi locali e lanciare `node tests/workout-drafts-api.mjs --verify-persistence`. Lo stato di confronto viene scritto fuori dal repository in /tmp/pulse-csv-test. La suite browser prova viewport 360, 390 e 1440 px, riapertura della shell PWA offline, rete bloccata, annullamento offline e conflitti con un altro dispositivo. Non sostituisce una prova su telefono Android fisico.

## Aggiornamento online tramite Jenkins

Nessun deploy o aggiornamento del database online viene eseguito dallo sviluppo. Prima del rilascio sul server: backup completo con ripristino verificato e autorizzazione all’estensione di schema. Verificare che il job Jenkins punti a main e al commit desiderato, poi avviare **Build Now**: la pipeline esistente ricostruisce frontend e Strapi e attende gli healthcheck. Strapi applica l’estensione additiva di schema al proprio avvio; non eseguire comandi di reset/import delle fixture in produzione.

Controllare /health, /api/pulse/me, avvio/annullamento di una sessione di prova e conservazione dello storico. La PWA installa la nuova shell con la normale politica di attesa: nessun refresh forzato o skipWaiting durante un allenamento. Per usare la nuova UI terminare o sincronizzare la sessione attuale e chiudere tutte le finestre PULSE, quindi riaprire. Non cancellare i dati del sito con modifiche ancora in attesa.
