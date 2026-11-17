# Allenati e I miei integratori

## Allenati

Card compatte con titolo, fase, serie/ripetizioni, carico standard e recupero. La serie corrente resta visibile; le altre serie e le note/video si aprono nei dettagli. Ogni serie mantiene il proprio ID e il proprio risultato: il pulsante Completa non completa tutto il blocco. Il recupero manuale rimane nel pannello espandibile. Le ambiguità della fonte, compreso 1/2′, non diventano tempi inventati per imitare il mockup.

Organizza schede permette un nome di presentazione e più giorni della settimana per ogni riferimento originale, più il fuso del calendario. A/B/C e gli ID restano immutati. Il calendario usa la data nel fuso selezionato e l’elenco dei giorni assegnati, mai il nome personalizzato. L’avvio manuale è sempre consentito quando non c’è già una sessione attiva. La modifica richiede connessione e una revisione valida; non cambia la scheda, il CSV, i carichi o gli snapshot conclusi.

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

Accesso da Home e Altro. Prodotti con nome, marca facoltativa, ingredienti testuali e principi attivi strutturati, quantità/unità per porzione, note, istruzioni e stato attivo/archiviato. I dati sono dichiarazioni dell’utente sull’etichetta, non valori certificati. Nessun prodotto o dose viene aggiunto automaticamente.

Ogni prodotto può avere fino a otto orari personali con UUID stabile. Per ciascuno: ora e fuso, giorni della settimana, frequenza ogni N giorni con data iniziale, ON/OFF/entrambi, dose facoltativa confermata dall’utente, indicazione testuale del pasto e promemoria. Frequenza e giorni della settimana sono filtri congiunti. La relazione col pasto è una nota personale: non consuma un pasto e non ne deduce una dose.

Il giorno ON/OFF usa, in assenza di una scelta specifica per gli integratori, la giornata già salvata in Dieta. Se non esiste, rimane sconosciuto: i soli slot limitati a ON/OFF attendono una scelta. Il selettore per gli integratori salva un override per quella data, senza modificare Dieta. Non si deduce ON/OFF dal nome della scheda né dall’orario previsto.

La dashboard distingue da assumere, assunto e saltato. La dose pianificata è una proposta modificabile; Segna assunto registra un’azione esplicita e l’istante effettivo. Se manca una dose, non viene inventata. Per date precedenti occorre inserire l’orario effettivo. Più slot nello stesso giorno restano distinti. Le registrazioni manuali hanno un UUID per evento: due assunzioni esplicite nello stesso minuto non collidono, mentre un retry dello stesso evento non crea un duplicato. Correggi registra una nuova revisione e conserva la precedente nei dati di rettifica; Annulla rende la registrazione cancelled senza cancellare la riga. Le correzioni sono esplicite e soggette a controllo revisione.

Lo storico ha filtro per date e pagine da 200. Uno snapshot conserva nome, ingredienti, etichetta e pianificazione al momento della prima registrazione; modificare o archiviare un prodotto non lo riscrive. Le vecchie registrazioni senza etichetta completa conservano ciò che era noto: non vengono riempite con i dati attuali. Archiviare disabilita i promemoria e non crea nuove assunzioni; una rettifica di una registrazione esistente resta possibile.

Il controllo sovrapposizioni confronta nomi espliciti dei principi attivi e alcuni sinonimi noti negli ingredienti testuali, con un avviso da verificare sulle etichette. Non è un controllo farmacologico: può non riconoscere tutti i sinonimi. Non somma quantità, non converte unità e non prescrive dosi o orari.

### Promemoria

Ogni slot abilitato ha un promemoria con lo stesso UUID: modificare l’orario aggiorna quel record, non ne crea un altro. Archiviare o disabilitare uno slot rimuove soltanto il promemoria generato, liberando il limite di configurazioni: la pianificazione resta nel prodotto e può rigenerarlo con lo stesso UUID. Il primo slot assunto o saltato non sopprime gli altri slot della giornata. Annullare una registrazione può riaprire soltanto quel promemoria/data. I rinvii 15/30/60 minuti usano il servizio già esistente. I promemoria degli slot si modificano dal prodotto; i promemoria legacy restano compatibili. Limite complessivo esistente: 30 promemoria per account. I prodotti sono limitati a 100 per account.

Notifiche in-app e di sistema mentre PULSE è aperta e connessa, con consenso del browser. Nessuna consegna push garantita ad app chiusa. Creazione/modifica prodotti e assunzioni richiedono connessione; non vengono messi nella coda offline delle serie. La ripresa offline degli allenamenti resta invariata.

## Schema e API

Estensioni additive, senza rimozione di tabelle o colonne:

- training-program: displaySettings JSON e displayRevision. Il JSON dei giorni, la fonte CSV e gli ID non vengono sostituiti per rinominare una scheda.
- supplement-product: brand, labelQuantity, labelUnit, notes, declaredActives JSON, schedule JSON, active, revision e clientKey univoca per owner/UUID di creazione.
- supplement-intake: status taken/skipped/cancelled, revision, productSnapshot, plannedSnapshot, corrections. I record legacy senza status restano assunti; annullare non elimina la riga.
- supplement-day: owner, uniqueKey owner/data, day, mode e revision, soltanto per le scelte specifiche ON/OFF degli integratori.

Tutti gli endpoint personali usano il proprietario della sessione server. Nessuna rotta CRUD generica Public. Scritture serializzate tramite advisory lock, revisioni sui prodotti/assunzioni/calendario e chiavi univoche; body owner ignorato. Il vecchio GET /supplements restituisce solo gli attivi; includeArchived=1 resta limitato all’owner. GET /intakes/:day restituisce solo assunzioni effettive per compatibilità; il nuovo storico espone anche salti e annullamenti.

Nuove rotte: PUT /training/layout; POST /supplements; PUT /supplements/:id; GET/PUT /supplements/day/:day; GET /supplements/history con from/to/offset. Le rotte esistenti /intakes/:day e /reminders restano in uso.

## Collaudi e rilascio

Preparazione e collaudo API locale: `node tests/restyle-supplements-api.mjs`, con le credenziali sintetiche CSV in un file privato. Lo script importa o riusa soltanto il piano sintetico restyle-features-test, non reimporta PDF personali. Per la sola prova Flow usare `PULSE_TEST_FIXTURES=1 node scripts/attach-test-flow.js` dentro il backend locale e poi `node tests/restyle-supplements-api.mjs --capture-flow`. Dopo un riavvio locale di PostgreSQL/Strapi: `--verify-persistence` confronta programma, standard, prodotti, promemoria e storico con la fotografia privata in /tmp. `--restore` riattiva il precedente programma sintetico senza trasferimenti. Nessuno di questi script deve essere usato in produzione.

Le nuove prove browser sono features.spec.js, a 360/390 px e desktop. Le prove esistenti continuano a verificare CSV, standard, annullamento, offline, storico, account, notifiche e logout.

Per aggiornare Jenkins vedere la procedura in DEPLOYMENT.md. Prima dello schema sul server occorrono backup completo, ripristino verificato in copia isolata e autorizzazione del proprietario. Nessuna operazione sul server o database online è stata eseguita dallo sviluppo.
