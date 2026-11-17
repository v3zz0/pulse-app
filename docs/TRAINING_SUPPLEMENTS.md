# Allenati e I miei integratori

## Allenati

Allenati apre con una card per ogni giornata del piano, con nome, giorni, descrizione quando configurata, anteprima e avvio. L’anteprima elenca tutti gli esercizi e rende subito visibili le prescrizioni delle serie eterogenee. Card esercizio compatte con titolo, fase, serie/ripetizioni, carico standard e recupero. La serie corrente resta visibile; le altre serie e le note/video si aprono nei dettagli. Ogni serie mantiene il proprio ID e il proprio risultato: il pulsante Completa non completa tutto il blocco. Il recupero manuale rimane nel pannello espandibile. Le ambiguità della fonte, compreso 1/2′, non diventano tempi inventati per imitare il mockup.

Modifica programma permette un nome e una descrizione facoltativa, più giorni della settimana per ogni riferimento originale, più il fuso del calendario. A/B/C e gli ID restano immutati. Il calendario usa la data nel fuso selezionato e l’elenco dei giorni assegnati, mai il nome personalizzato. L’avvio manuale è sempre consentito quando non c’è già una sessione attiva. La modifica richiede connessione e una revisione valida; non cambia la scheda, il CSV, i carichi o gli snapshot conclusi.

### Carichi CSV: cosa è stato verificato

Il controller di import già crea le righe standard-load con owner, programId e setKey della nuova versione, dopo l’anteprima e la conferma dell’importazione. La bozza non diventa automaticamente attiva. Nel database locale le versioni CSV esaminate avevano le proprie righe di carico collegate; non è stato interrogato il database online.

Correzioni: l’anteprima Allenati ora usa la prescrizione CSV quando manca la riga standard-load, come già faceva l’avvio backend, e rispetta sempre una riga esplicita con kg null o 0. La preview di una versione salvata mostra i carichi effettivi di quella versione, non soltanto il valore originale nel JSON. La pagina espone versione/provenienza attive e l’esistenza di CSV ancora in bozza, per distinguere un import riuscito da un’attivazione non ancora effettuata.

Per usare i carichi del nuovo CSV:

1. Altro → Gestisci scheda allenamento → anteprima e conferma dell’importazione. Controllare standard_kg delle singole serie.
2. Visualizzare la versione salvata e confermare la sua attivazione, dopo aver concluso o annullato e sincronizzato la sessione corrente.
3. Lasciare disattivato il trasferimento se si vogliono mantenere i valori del nuovo CSV. Il trasferimento confermato usa i carichi della vecchia versione sulle corrispondenze esatte mostrate, sostituendo quelli di destinazione elencati.
4. Avviare una nuova sessione: le proposte provengono dagli standard di quel programma. Una sessione già avviata conserva standardAtStart e la propria bozza.

Non viene riparato o sovrascritto automaticamente alcun carico personale. CED e intervalli non ricevono risultati inventati, i circuiti mantengono le ripetizioni dei movimenti, 0 resta diverso da null. Il caso 60 → 50 temporaneo → senza peso → nuova sessione 60 rimane un criterio obbligatorio.

## I miei integratori

Altro → Gestisci i miei integratori apre la configurazione. Per ogni prodotto si impostano nome, quantità e unità per assunzione, da una a otto assunzioni al giorno e orari facoltativi. Ogni posto della pianificazione ha un UUID. Modificare la quantità o l’orario conserva gli identificativi dei posti mantenuti. Eliminare con conferma nasconde il prodotto dalla pianificazione impostando active=false. Le righe e gli snapshot delle assunzioni rimangono nel database. Gli attributi storici del prodotto restano memorizzati.

Oggi → Integratori di oggi è indipendente dalla dieta e mostra uno stato per ogni assunzione. Segna assunto registra il solo posto scelto con data e ora effettive. Annulla registrazione aggiunge una rettifica. Le pianificazioni precedenti vengono lette quotidianamente in Oggi conservando gli orari, le dosi dichiarate e gli UUID. La nuova configurazione salva soltanto ricorrenze quotidiane. I prodotti precedenti senza posti pianificati rimangono configurabili in Altro. Nessuna dose viene dedotta dall’etichetta o impostata d’ufficio.

La coda delle assunzioni usa IndexedDB per account e lo stesso coordinamento di sincronizzazione del logout e degli allenamenti. La UI mostra Da sincronizzare finché il server conferma. La revisione di prodotto evita di registrare una nuova assunzione contro una programmazione modificata altrove. Una risposta persa viene confrontata con lo stato server prima di risolvere la coda. La configurazione dei prodotti richiede connessione.

### Promemoria

Altro → Promemoria gestisce autorizzazione, creazione e modifica guidate, attivazione e cancellazione confermata. Supporta pasti, integratori, allenamenti, pesate e avvisi personalizzati. Gli avvisi delle pesate vengono soppressi dopo il salvataggio di una misura per la data. I promemoria esistenti mantengono i propri orari. Quelli generati dalla versione precedente sono modificabili o eliminabili nello stesso elenco. Un collegamento a un integratore eliminato sospende la consegna di quel promemoria, che resta disponibile per modifica o eliminazione.

Configurare un integratore non crea né riprogramma promemoria. I rinvii 15/30/60 minuti continuano a funzionare. Le notifiche di sistema usano il service worker mentre PULSE è aperta e connessa, con consenso del browser. Il sistema non contiene infrastruttura Web Push a PWA chiusa.

## Schema e API

Il restyling riusa le estensioni già introdotte dalle versioni precedenti:

- training-program: displaySettings JSON e displayRevision. Il JSON dei giorni, la fonte CSV e gli ID non vengono sostituiti per rinominare una scheda.
- supplement-product: brand, labelQuantity, labelUnit, notes, declaredActives JSON, schedule JSON, active, revision e clientKey univoca per owner/UUID di creazione.
- supplement-intake: status taken/skipped/cancelled, revision, productSnapshot, plannedSnapshot, corrections. I record legacy senza status restano assunti; annullare non elimina la riga.
- supplement-day: owner, uniqueKey owner/data, day, mode e revision, soltanto per le scelte specifiche ON/OFF degli integratori.

Tutti gli endpoint personali usano il proprietario della sessione server. Nessuna rotta CRUD generica Public. Scritture serializzate tramite advisory lock, revisioni sui prodotti/assunzioni/calendario e chiavi univoche; body owner ignorato. Il vecchio GET /supplements restituisce solo gli attivi; includeArchived=1 resta limitato all’owner. GET /intakes/:day restituisce solo assunzioni effettive per compatibilità; il nuovo storico espone anche salti e annullamenti.

Nuove rotte: PUT /training/layout; POST /supplements; PUT /supplements/:id; GET/PUT /supplements/day/:day; GET /supplements/history con from/to/offset. Le rotte esistenti /intakes/:day e /reminders restano in uso. GET /supplements/day/:day?daily=1 restituisce le occorrenze quotidiane di Oggi. POST/PUT /supplements con daily=true valida quantità, unità e posti. La scrittura del peso mantiene la chiave owner/data sotto lock PostgreSQL. Nessuna migrazione è necessaria per questo restyling.

## Collaudi e rilascio

Preparazione e collaudo API locale: `node tests/restyle-supplements-api.mjs`, con le credenziali sintetiche CSV in un file privato. Lo script importa o riusa soltanto il piano sintetico restyle-features-test, non reimporta PDF personali. Per la sola prova Flow usare `PULSE_TEST_FIXTURES=1 node scripts/attach-test-flow.js` dentro il backend locale prima di eseguire le prove browser. Dopo un riavvio locale di PostgreSQL/Strapi: `--verify-persistence` confronta programma, standard, prodotti, pesate, promemoria e storico con la fotografia privata in /tmp. `--restore` riattiva il precedente programma sintetico senza trasferimenti. Nessuno di questi script deve essere usato in produzione.

Le nuove prove browser sono features.spec.js, a 360/390 px e desktop. Le prove esistenti continuano a verificare CSV, standard, annullamento, offline, storico, account, notifiche e logout.

Per aggiornare Jenkins vedere la procedura in DEPLOYMENT.md. Prima dello schema sul server occorrono backup completo, ripristino verificato in copia isolata e autorizzazione del proprietario. Nessuna operazione sul server o database online è stata eseguita dallo sviluppo.
