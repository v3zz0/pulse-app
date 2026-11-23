# Home integratori e Web Push — 20 novembre 2026

Build Vite, build Strapi e avvio dello stack Docker locale su PostgreSQL riusciti. Unitari superati in 11 file backend e 4 frontend. La configurazione Compose Jenkins risolve le variabili VAPID soltanto per Strapi, con rete in uscita. Nessuna chiave privata nel bundle.

Playwright **7/7**. A 360, 390 e 1440 px sono state verificate le due dosi di creatina in ordine, la scomparsa della singola dose, il messaggio a fine giornata, la coda offline con riapertura e sincronizzazione, la rettifica e l’annullamento nello storico e il rinnovo al cambio di giorno. A tutte le larghezze il job ha generato una consegna cifrata, ricevuta nel service worker con tutte le schede PULSE chiuse. Il test ha verificato la notifica in Chromium e il riscatto una sola volta. Verificati anche test a pagina aperta, supplemento già registrato, rinvio, modifica, disattivazione, eliminazione, iscrizione scaduta e isolamento dopo logout e cambio account. Una prova desktop separata ha verificato la notifica locale e i comandi del promemoria.

Il collaudo chiuso usa il broker di test e CDP per riprodurre la consegna al browser. Il tentativo di registrazione sul servizio esterno dal browser automatizzato non si è concluso entro il tempo di verifica. La consegna tramite provider e la ricezione su Android fisico restano da verificare dopo configurazione e rilascio. [Guida Web Push e prova Android](WEB_PUSH.md)

---

# Percorso persistente Flow in produzione — 18 novembre 2026

Il controllo del container di produzione ha rilevato il bind dal workspace Jenkins verso `/app/flow` e `ENOENT` per il catalogo. Compose usa ora `/srv/pulse/flow` come sorgente predefinita e conserva l’override esplicito. Verificata la configurazione Compose con entrambi i percorsi e il mount in sola lettura.

L’installatore della revisione fissata, eseguito in Docker Node 24 su directory temporanee, ha verificato 1.324 esercizi e 3.771 SHA-256 SVG. Un processo con UID 1000 ha letto entrambe le copie di collaudo, trovato Panca piana 0025, letto le tre definizioni dei fotogrammi e verificato un SVG. Build Vite e suite Node frontend/backend superate. La configurazione risolta è stata verificata localmente. Il collaudo live è un passaggio distinto.

---

# Spaziatura della scheda in Allenati — 18 novembre 2026

La card di anteprima e sessione attiva separa intestazione, conteggi, azione principale e informazioni sul piano. Build Vite e tre file di test frontend superati. Regressione Allenati su Chromium **3/3**. Nella card di anteprima, spazio verticale misurato di 16 px a 360 e 390 px e di 22 px a 1440 px. Il pulsante di avvio misura 51 px in altezza. Nessun overflow orizzontale in queste prove.

---

# Editor visuali e Progressi — 18 novembre 2026

- Fase 1. Editor Allenati e Dieta collegati ai normali percorsi di creazione, modifica, duplicazione, conferma di eliminazione e attivazione. Collaudo API prima di estendere Progressi. Test con due utenti sintetici per sessioni, proprietà del piano e della libreria, modifiche concorrenti, richieste ripetute, Flow per esercizio o movimento, ordine, timer e carichi distinti. L’editing a sessione attiva e l’eliminazione successiva hanno conservato gli snapshot.
- Caso 60 kg standard → 50 kg temporanei → serie senza peso effettivo → nuova sessione ancora a 60 kg verificato via API e browser. Verificati anche proposta di 5 ripetizioni, esecuzione 50 × 4, null/zero, range, CED, salto e annullamento offline.
- Dieta. Verificati i giorni con pasti distinti e i giorni senza pianificazione, quantità, alternative, modifica indipendente della copia, assenza di valori nutrizionali inventati e applicazione esplicita del piano aggiornato alle giornate senza pasti consumati. Copia, modifica ed export di fixture A/B/C e dieta ON/OFF storiche verificati con confronto dell’export originale. Gli strumenti CSV v1 preservano il formato e permettono di esportare un giorno alla volta da un piano settimanale.
- Fase 2. Verificati filtraggio temporale delle pesate e dei grafici, variazione sull’ultima pesata, frequenza, calendario, storico deduplicato ed esclusione delle sessioni non concluse. Carichi calcolati da serie con peso effettivo e ripetizioni della stessa serie. Gli esercizi senza risultati e i periodi senza dati hanno stati vuoti. I conteggi usano il fuso del dispositivo.
- Build Vue/Vite, build dell’admin Strapi, immagini Docker e smoke HTTP locali superati. Test Node superati in 10 file backend e 3 file frontend. Suite API di editor, CSV, Flow e workout superate. Riavvio reale di PostgreSQL e Strapi con confronto di piani, libreria, giorni, carichi, sessioni e storico superato.
- Suite completa Chromium **42/42** tra Android simulato e desktop, incluse installabilità, cache e ripresa PWA offline. Interfaccia controllata a 360, 390 e 1440 px, verifica di assenza di overflow orizzontale, controlli touch da almeno 44 px negli editor e trascinamento touch simulato. Schermate a 390 px ispezionate visivamente. Dopo le rifiniture a selettori, spaziatura e contrasto, ripetuti i 9 scenari dei due editor e di Progressi con esito positivo. I controlli di installabilità usano profili regolari temporanei ripuliti dai test. Collaudo Android effettuato in emulazione, senza dispositivo fisico.

Tabella privata degli esercizi personali e campi editor nullable aggiunti nel PostgreSQL locale. La procedura di aggiornamento online richiede backup con ripristino verificato, autorizzazione all’estensione dello schema e avvio manuale del job Jenkins. La produzione non è stata aggiornata. Account Coach rimane una proposta architetturale. [Guida agli editor](PLAN_EDITORS.md) · [Procedura Jenkins](../DEPLOYMENT.md#rilascio-degli-editor-e-di-progressi)

---

# Rimozione dei video esterni e separazione degli account — 17 novembre 2026

Rimossi i collegamenti video dai dettagli Allenati e dalle anteprime dei piani di allenamento, compreso il defaticamento. Gli URL storici restano disponibili negli export CSV. Build Vite e unitari frontend PASS. Test browser allenamento **3/3 PASS** a 360, 390 e 1440 px per presenza di Flow, stato di assenza e rimozione dei link YouTube, oltre al ciclo di allenamento.

API sullo stack locale con due account sintetici Authenticated: sessioni PULSE distinte, piani e schede di un altro proprietario rifiutati con 404. La sessione PULSE riceve 401 dall’API amministrativa Strapi. Le credenziali dell’account Authenticated vengono rifiutate anche dal login amministrativo.

---

# Associazioni Flow nelle schede esistenti — 17 novembre 2026

Il dataset locale era presente, ma la scheda originale A/B/C conteneva zero flowId. I soli ID preesistenti erano in una fixture. Il player si montava esclusivamente in presenza di quell’identificativo. Il frontend pubblico serviva ancora il bundle precedente, verificato con una richiesta anonima all’HTML e al JavaScript. Il catalogo e le associazioni online non sono stati interrogati.

- Catalogo e licenze installati confrontati con il checkout ufficiale fissato. **3.771 SHA-256** dei fotogrammi confermati. Il container legge la release dal mount in sola lettura e verifica un fotogramma della panca.
- Sulla copia originale locale, **31 blocchi e 33 elementi**, contando separatamente i tre movimenti del circuito. **9** verificati automaticamente, **15** con candidate da confermare, **9** senza animazione equivalente verificata. Tabella generata in reports/FLOW_ABC.md, fuori da Git. Le verifiche confrontano nome, attrezzatura, istruzioni e fotogrammi delle associazioni confermate.
- API con due account sintetici PASS per metadati, ricerca, filtro e hash SVG, override dei movimenti del circuito, rimozione, precedenza della scelta, ereditarietà su nuova versione CSV, revisione, CSRF e ownership. Riavvio reale di Strapi e PostgreSQL PASS. Scelte, carichi, CSV e storico identici dopo restart.
- Build Vite, admin Strapi e Docker PASS. Test backend **10 file** e frontend **2 file** PASS. **33/33 test Chromium** PASS a 360, 390 e 1440 px, comprese anteprima e scelta manuale, pausa/ripresa/ingrandimento, fallback secondario e ripresa PWA offline. Emulazione aggiuntiva Android Pixel 7 PASS: cache di soli **12 fotogrammi** della scheda A, immagine Panca 0025 dopo reload offline, nessun overflow. Nessun Android fisico disponibile per la prova.
- Caso standard 60 → temporaneo 50 → serie senza peso → nuova proposta 60, timer e annullamento offline PASS. Impronte dei JSON di **49 programmi** e **77 sessioni concluse** preesistenti invariate.

Nuovo solo campo JSON nullable flowAssociations, separato da scheda, carichi e risultati. Nessun reimport di schede o deployment in produzione. Installazione, sicurezza degli SVG, licenze e passaggi Jenkins in [FLOW_DATASET.md](FLOW_DATASET.md) e [DEPLOYMENT.md](../DEPLOYMENT.md#rilascio-delle-associazioni-flow).

---

# Restyling quotidiano PULSE — 17 novembre 2026

- Altro: comando Installa PULSE in apertura, dialog con guida Android/desktop, azione nativa quando disponibile e stato già installata. Data, peso, invio e feedback nella stessa card. Richieste simultanee per la stessa pesata serializzate su owner/data.
- I miei integratori: configurazione di prodotti, quantità/unità, frequenza quotidiana e orari facoltativi. Eliminazione confermata dalla pianificazione con conservazione delle registrazioni. Oggi mostra e registra le assunzioni separatamente, con rettifica e coda offline. Il salvataggio della configurazione non crea o aggiorna promemoria.
- Allenati: card verticali per tutte le giornate reali, anteprima completa, avvio diretto, organizzazione e descrizione facoltativa. La vista precedente sostituiva il riepilogo dei carichi con «Carichi per serie» oltre tre valori distinti. L’anteprima mostra ora ogni prescrizione distinta e la sessione usa lo standard della singola serie. Il campo della seduta accetta incrementi a due decimali. L’audit locale ha trovato 42 versioni CSV e 44 serie con valore originale, tutte collegate alla riga standard del programma. Il caso di produzione non è stato riprodotto sul server.
- I miei promemoria: pagina dedicata, wizard in quattro passi, modifica con UUID invariato, frequenza/giorni, attivazione ed eliminazione. Aggiunti i tipi Peso e Personalizzato usando gli stessi record. Le notifiche di sistema sono supportate mentre PULSE è aperta e connessa.

Build Vite, admin Strapi e Docker PASS. Test unitari, 10 file backend e 2 frontend PASS. Suite Chromium **33/33 PASS** a 360, 390 e 1440 px. Verificati CSV con 60, 47,25, 0 e 32,75 kg, precompilazione, ciclo 60 → 50 → senza peso → 60, annullamento e ripresa offline, Flow già associato, installabilità e dialog PWA, coda IndexedDB delle assunzioni, wizard e notifica reale del service worker. Resa mobile ispezionata tramite screenshot.

API con due account sintetici PASS per proprietà dei dati e CSRF, invii duplicati, indipendenza delle assunzioni e rettifica con snapshot conservati, eliminazione dalla pianificazione, promemoria indipendenti e pesata concorrente. Riavvio reale di PostgreSQL e Strapi seguito da confronto di standard, scheda, storico integratori, promemoria e pesate PASS. Impronte delle **69 sessioni concluse preesistenti** identiche dopo i test. Export legacy senza scritture PASS, 186 righe dieta e 82 allenamento. Smoke HTTP locale PASS.

Chromium desktop con profilo temporaneo: installazione della PWA locale e avvio in finestra standalone PASS. Il dialog riconosce l’app installata, si chiude con Escape e la navigazione Allenati funziona. Il collaudo mobile è Chromium con viewport ridotti e ramo Android verificato con user agent simulato. Nessun dispositivo Android fisico disponibile.

Riuso delle tabelle e dei campi JSON esistenti. Nessuna migrazione per questa release. Manifest, service worker e strumenti di importazione restano gli stessi. Rilascio manuale descritto in [DEPLOYMENT.md](../DEPLOYMENT.md).

---

# Allenati, integratori e ordine di Altro — 17 novembre 2026

Main sincronizzato con origin senza sovrascrivere modifiche locali. Restyling compatto di Allenati con serie indipendenti, proposte modificabili, dettagli espandibili, timer e menu di annullamento conservati. Organizzazione personale dei riferimenti A/B/C con nomi, giorni multipli e fuso; nessuna modifica agli ID, alla fonte CSV o agli snapshot conclusi. Anteprima dei carichi corretta usando gli standard effettivi e distinguendo null/0; versione attiva e bozze CSV ora visibili. Nel database locale gli standard dei programmi esaminati erano già presenti: nessuna diagnosi del database di produzione o riparazione automatica dei carichi personali.

Nuova pagina I miei integratori da Home/Altro: prodotti, principi attivi dichiarati, orari multipli, frequenza, ON/OFF, dose personale confermata, promemoria per slot, assunzioni effettive, salti, rettifiche e archiviazione con storico e snapshot. Le registrazioni manuali usano UUID distinti, consentendo più eventi nello stesso minuto senza duplicati sul retry. In Altro, Installa PULSE è la prima card, sopra Piani e importazioni; i due collegamenti di gestione hanno larghezza uguale e occupano l’intera riga.

## Risultati effettivi

- Build Vite, admin Strapi e immagini Docker locali: PASS. Test backend: **10 file PASS**; frontend: **2 file PASS**. Nessun aggiornamento delle dipendenze.
- `tests/restyle-supplements-api.mjs`: PASS per calendario/revisioni/owner, CSV invariato, standard separati, prodotti, pianificazioni, ON/OFF, due orari distinti, dose confermata, rettifiche/snapshot, archiviazione, sovrapposizioni dichiarate, snooze 15/30/60 e CSRF. Verificati due eventi manuali nello stesso minuto, retry senza duplicazione e rifiuto di UUID non appartenenti alla pianificazione senza conferma manuale.
- `tests/workout-drafts-api.mjs`: PASS, incluso standard60/target5 → risultato50×4 → nuova proposta60/5, completamento senza peso actualKg=null, salti, null/0, range/CED/circuiti, annullamento e operazioni obsolete. Verificato anche 60 → 50 temporaneo → senza peso → nuova sessione60.
- **33/33 test browser PASS**, 0 saltati, Chromium a360/390/1440px. Inclusi i sei nuovi scenari Allenati/integratori, nomi/calendario, anteprima e controlli Flow, download verificato e riapertura offline, pause/ingrandimento/reduced-motion, bozze, annullamento offline e sincronizzazione. Regressioni account/logout, Home/dieta, CSV, chip, PWA e notifiche service worker: PASS. I tre scenari CSV controllano anche geometria 50/50 dei pulsanti in Altro e posizione di Installa PULSE prima delle importazioni. Screenshot mobile/desktop generati e resa mobile ispezionata.
- Riavvio reale PostgreSQL e Strapi: confronto di programma/layout, standard, prodotti archiviati, pianificazioni, promemoria, modalità e storico **PASS**, senza riscrivere fixture durante la verifica. Confronto per-record dopo le prove: **55 sessioni concluse preesistenti identiche**, aggiunti soltanto nuovi record sintetici dai test.
- Installatore Flow rieseguito sul commit fissato 961bb2739015da373daa43b960c28ee839fe93e6: **3.771 hash SVG PASS**, 1.324 esercizi/1.257 animati/67 senza animazione. Endpoint autenticati, percorsi chiusi e SVG ricontrollati prima di servirli; test di rifiuto contenuti attivi PASS. La fixture esplicita0025 riguarda solo il programma sintetico.
- API CSV completa eseguita durante lo sviluppo: PASS. Export/parse legacy ripetuto sulla build finale, senza import: **186 righe dieta e82 allenamento PASS**, struttura/fonti/video conservati. Smoke locale con FRONTEND_URL=http://127.0.0.1:8081 PASS; primo tentativo sulla porta predefinita8080 fallito perché non corrisponde allo stack PULSE locale. Healthcheck finali dei tre servizi PASS.

Schema solo additivo: displaySettings/displayRevision del programma; attributi prodotto, pianificazione e revisione; stati e snapshot/rettifiche delle assunzioni; nuova collezione privata supplement-day per override ON/OFF. Nessuna eliminazione di tabelle/colonne o modifica della dieta. Backup locale precedente alle estensioni in backups/pulse-20261117T152729Z.dump, indice pg_restore letto: questa lettura non viene presentata come un ripristino completo.

Limiti: Android simulato tramite Chromium/viewport e offline, non dispositivo fisico. Prodotti e assunzioni richiedono connessione; resta operativa la coda offline degli allenamenti. Nessun push garantito ad app chiusa. Il player Flow usa associazioni esplicite: matching automatico italiano/inglese, selettore catalogo e report dei31blocchi restano attività distinte ancora aperte; nessuna associazione personale viene dichiarata verificata. Nessun deploy, migrazione online o collegamento al database di produzione eseguito. Contratti in [TRAINING_SUPPLEMENTS.md](TRAINING_SUPPLEMENTS.md), [FLOW_DATASET.md](FLOW_DATASET.md); procedura Jenkins/backup/rollback in [DEPLOYMENT.md](../DEPLOYMENT.md).

---

# Esci nella pagina Account — 17 novembre 2026

Pulsante Esci spostato da Altro al fondo della pagina Account, raggiungibile dall’avatar. Mantiene lo stesso servizio di logout e lo stile esistente; nessuna modifica al backend o allo schema. Rimossa la dipendenza auth non più usata da Altro.

Build Vite e Docker frontend PASS; unit test frontend PASS. Scenari browser esistenti aggiornati: **4/4 PASS**, Home a360/390/1440px e concorrenza desktop. Verificati assenza del pulsante in Altro, navigazione Account, ritorno al login, disconnessione dell’altra scheda e pulizia delle bozze IndexedDB. Nessun deploy eseguito.

---

# Semplificazione preferenze personali — 17 novembre 2026

Rimossi dal profilo allergie, intolleranze, alimenti facili da preparare, preferenze colazione/pranzo/cena, numero pasti e vincoli di spesa. Rimangono chip preferiti/non graditi e obiettivi nutrizionali. GET/PUT impostazioni espongono e salvano soltanto questi tre dati; i campi ritirati non vengono inclusi nei prompt AI e non sono più richiesti per salvare. I vecchi JSON non vengono migrati automaticamente: lettura senza modifica, nuovo salvataggio esplicito nel formato ridotto. Nessun cambio di schema o dei piani alimentari.

Build Vite e Docker frontend/backend PASS; unit test backend 8 file e frontend 1 file PASS. Browser del profilo **3/3 PASS** a 360/390/1440 px: assenza degli otto campi, chip Invio/rimozione, salvataggio e reload tramite API reali, risposta limitata ai campi correnti, obiettivi identici a prima del salvataggio, testo AI privato senza i campi rimossi. README e guida CSV aggiornati. Nessun deploy o modifica al database di produzione.

---

# Proposte delle serie e annullamento offline — 17 novembre 2026

Main sincronizzato in fast-forward con origin su 2400fd2; conservati i file Flow già modificati/non tracciati, senza includerli nel commit di questa estensione. Standard e ripetizioni esatte vengono proposti solo nella bozza; intervalli con scelta rapida (pulsanti o selettore per quelli ampi), CED da compilare, circuiti con movimenti separati. Nuovo stato terminale cancelled con cancelledAt, conferma accessibile, stop timer e notifiche pertinenti, esclusione da storico/metriche e protezione dalle operazioni obsolete. Guida: [WORKOUT_SESSIONS.md](WORKOUT_SESSIONS.md).

## Risultati effettivi

- Build Vite, admin Strapi e immagini Docker locali: PASS. Backend **24 test** in 8 file: PASS, inclusi proposte, 0/null, CED/range/circuiti, completamento esplicito, bozza legacy, immutabilità, annullamento confermato e dopo 60 giorni offline. Frontend: 1 test PASS.
- `tests/workout-drafts-api.mjs`, due utenti sintetici: PASS. Standard60/target5 → proposta60/5 → modifica50/4 → risultato50×4 → nuova sessione60/5. Senza peso actualKg=null; salto senza risultati; standard assente vuoto e zero distinto; range8–10 e8–25 senza default; CED senza risultato rifiutato; circuiti senza totale. Annullamento vuoto/con serie, conferma richiesta, timer fermato, revisione obsoleta di altro dispositivo, replay di avvio/operazioni senza riattivazione, owner estraneo404, conclusi immutabili e storico preesistente confrontato integralmente: PASS.
- **27/27 test browser PASS**, 0 saltati, Chromium a360/390/1440px: account, favicon/PWA, Home/nutrizione/integratori, CSV, chip, workout, concorrenza e notifiche reali service worker. Dopo l’ultima aggiunta del selettore8–25, ripetuti i **3 scenari coinvolti: 3/3 PASS** sulla build finale. Nessun errore JS o overflow nel nuovo scenario. Screenshot delle serie e conferma mobile ispezionati.
- Nuovo scenario browser: 60/5 e0/null visibili, modifica50×4, CED obbligatorio, scelta rapida senza auto-completamento, rete deliberatamente bloccata mentre IndexedDB continua a salvare, chiusura e riapertura PWA offline con bozza15kg/7rip conservata, ritorno dalla conferma, annullamento offline con serie già eseguita, reload, revisione server avanzata altrove, sync terminale e nuovo avvio60/5. Annullamento remoto con vecchia bozza locale più una diversa nuova sessione: viene ritirata soltanto la vecchia coda, senza sessioni fantasma. PASS sui tre viewport.
- Riavvio reale PostgreSQL e Strapi, senza reset: `--verify-persistence` PASS per snapshot, sessioni annullate e storico. Impronta aggregata dei conclusi identica dopo restart. Confronto successivo per-record di **48 allenamenti conclusi preesistenti: tutti invariati**, anche dopo le prove browser e i nuovi record sintetici.
- API CSV completa: PASS, inclusi idempotenza concorrente, ownership/CSRF, versioni, trasferimenti standard, snapshot e caso60/50/senza peso/60. Export/parse legacy in sola lettura: PASS, dieta186righe e allenamento82righe; movimenti/video/fonti conservati, nessun reimport dei PDF.

Le prove hanno individuato e risolto una perdita della bozza possibile chiudendo rapidamente la PWA mentre la richiesta precedente teneva il lock: scritture locali e rete ora usano lock distinti, con rilettura della coda prima degli ack. Logout e risoluzione conflitti sono coordinati con lo stesso lock di sincronizzazione per impedire scritture residue dopo la pulizia. Corrette anche le prove preesistenti che dipendevano da serie ancora disponibili: la preparazione completa soltanto sessioni sintetiche esaurite, conserva lo storico e avvia una nuova scheda. Nessun reset di utenti personali.

Schema additivo locale: status resta varchar e ammette cancelled; nuova colonna cancelled_at nullable timestamp. Nessuna cancellazione fisica, migrazione distruttiva o riscrittura dei conclusi. Backup locale prima dell’estensione in backups/pulse-20261117T122104Z.dump, indice pg_restore letto; non viene presentato come un nuovo restore completo.

Limiti: collaudo Android tramite viewport/Chromium e PWA offline simulata, non telefono fisico. I file Flow sono preservati, ma l’integrazione del catalogo/player/cache Flow non è ancora operativa e non viene dichiarata testata da questa estensione. Nessun deploy, collegamento al database online o migrazione di produzione. Per Jenkins: backup con ripristino verificato e autorizzazione allo schema, poi job main/Build Now; istruzioni nella guida collegata.

---

# Schede separate in Strapi e chip preferenze — 17 novembre 2026

Programmi originali preservati, con nuova collezione privata di consultazione `training-day`: una voce Scheda A/B/C per programma, completa di blocchi/serie/defaticamento e riferimenti owner/programma. Lifecycle sincronizzano i nuovi import e le modifiche alla fonte; copie protette da scrittura diretta e metadata editabili=false. Nessuna rotta CRUD pubblica e nessun cambio alla sorgente delle sessioni/carichi. Script di backfill dry-run predefinito, apply con opt-in dopo backup. Solo fixture locali: prima esecuzione17programmi/36schede create; seconda0create/0aggiornate. Verifica PostgreSQL/metadata e blocco modifica diretta PASS.

Card credenziali/preferenze separate con28px di spazio. Preferiti/non graditi diventano chip aggiungibili con Invio e rimovibili con×; compatibilità con i vecchi testi, deduplicazione, limiti e persistenza. Tempo per cucinare rimosso da form, risposta impostazioni e prompt AI; i vecchi valori non sono usati. Nessun piano alimentare modificato.

Build Docker frontend/backend PASS, test backend8file PASS e frontend PASS. Browser: **6PASS** a360/390/1440px per profilo chip/gap/rimozione/reload, assenza tempo cucina e regressione CSV completa. API CSV PASS con60→50temporaneo→senza peso→60 e storico invariato. Backup locale privato prima dell’estensione in backups/before-training-days.dump, indice pg_restore letto. Nessun deploy o modifica al database online.

---

# Gestione CSV spostata in Altro — 17 novembre 2026

Main inizialmente pulito su `2121f66`, sincronizzato con origin prima del lavoro. Tutti gli accessi alla gestione CSV raccolti in **Altro → Piani e importazioni**, con pagine `/altro/piani` e `/altro/schede`. Rimossi i comandi da Dieta e Allenati. Le pagine di gestione tornano ad Altro; voce Altro attiva e aria-current coerente anche nelle sottopagine. I vecchi indirizzi reindirizzano alle nuove pagine. Peso, integratori e relative funzioni restano in Altro, con titolo generale “Il tuo spazio”.

Build Vite nativa e Docker frontend PASS; test frontend PASS. I tre scenari CSV esistenti, aggiornati per attraversare i nuovi accessi, **PASS a 360/390/1440 px**: assenza vecchi comandi, redirect, ritorno, voce selezionata, download esempi, anteprima/validazione, importazione/attivazione, export e scheda completa. Solo account sintetici nei test. Nessuna modifica a backend, schemi o dati personali; nessun deploy. Guide CSV e README aggiornati.

---

# Piani CSV e preferenze personali — 17 novembre 2026

## Implementazione e dati

Checkout inizialmente pulito su main `02e963e`, sincronizzato prima del lavoro. Import/export CSV su collezioni esistenti, anteprima senza scrittura, bozze/versioni/archiviazione/attivazione separata, trasferimenti carichi con confronto esatto e conferma, nutrienti noti/parziali e preferenze/obiettivi personali privati. Una sola nuova collezione personal-setting. Nessuna nuova dieta AI generata o attivata per account personali, nessun import ripetuto dei PDF, nessuna modalità rapida. UI dark/menta e icone ufficiali conservate.

Backup locale privato prima delle estensioni, dump custom e lettura indice con pg_restore --list. Dopo riavvio del PC i file temporanei /tmp sono stati cancellati: recuperate soltanto le password dei quattro account sintetici esatti @example.invalid con script opt-in, senza reset di piani/giornate/allenamenti. Creato un ulteriore dump locale ignorato da Git in backups/csv-before-recovery.dump e verificato l’indice. Questo controllo dell’archivio non viene presentato come un nuovo restore completo. Nessuna connessione o modifica al database di produzione, nessun deploy/DNS modificato.

## Collaudi effettuati

- Build frontend Vite, backend Strapi nativi e immagini Docker: PASS. Backend 7 file di test passati, inclusi import storici e nuovo file CSV; frontend 1 file passato. Otto casi CSV mirati: BOM/separatori/decimali/quote/multilinea, round-trip, duplicati/limiti/URL/identificativi riservati, formule letterali, nutrienti senza somme di alternative, carichi con identità esatta, token firmati e circuiti con ripetizioni per serie.
- tests/csv-api.mjs su due nuovi account sintetici: PASS. Preview senza nuove versioni, conferme richieste, importazioni concorrenti idempotenti, token legati al proprietario, lettura/export/modifica di piani altrui negati, CSRF, target privati e revisioni, versioni attive indipendenti da bozze, giornate/snapshot/storico invariati, blocco sostituzione di giornate con consumi, applicazione esplicita su giornata libera, preferenze sulle giornate storiche e promemoria dei programmi importati. Test attraverso nginx: CSV JSON oltre128KiB accettato solo sui due endpoint previsti; richiesta ordinaria eccessiva rifiutata413 (HTML proxy gestito dal test), niente aumento generale dei limiti.
- Standard60 → temporaneo50 → serie senza carico effettivo → nuova versione/sessione ancora60: PASS API, con anteprima/conferma trasferimento. Snapshot storico confrontato integralmente e immutato. La selezione di un giorno personalizzato D e il mantenimento dello standard dopo il temporaneo sono verificati anche via UI.
- Export/parse delle fonti storiche sintetiche: PASS, dieta186righe/60138byte e allenamento82righe/37563byte. Confrontati pasti/menu/gruppi/opzioni, serie, movimenti, video e defaticamento. Nessun reimport storico eseguito. Le note ripetitive vengono rappresentate una volta per livello, senza perdita del testo originale; i campi assenti non diventano dati inventati. Confermata anche la disponibilità di corrispondenze esatte per trasferire standard da un export legacy reimportabile.
- Suite completa browser: **21 PASS, 0 saltati**, su360/390/1440px. CSV esempi/istruzioni AI, file errato bloccato, anteprima non salvata, bozza persistente al reload, attivazione, export/reimport strutturale, preferenze/target, giorno D e scheda completa; regressione account, Home/nutrizione, workout/timer/storico, concorrenza/conflitti, offline/cache/installabilità/favicon e notifiche reali. Screenshot CSV mobile ispezionato, nessun overflow o pageerror nei nuovi scenari.
- Durante la regressione individuato e corretto un import mancante di activePlan nel controller promemoria (500 sui salvataggi). Corretto anche il test file-upload che impostava programmaticamente il file mentre il campo era ancora disabilitato dalla copia negli appunti: attende il campo abilitato, come farebbe l’utente. La suite finale non maschera errori con retry o skip.
- Persistenza PostgreSQL: baseline privata dei due account CSV catturata, poi restart reale postgres/strapi/frontend, tutti healthy; tests/csv-persistence.mjs PASS. Identici piani/stati/versioni, preferenze/target/revisioni, standard60, sessioni attive e storico dopo il riavvio.

## Limiti e aggiornamento server

Le fonti nutrizionali non sono controllate contro una banca dati remota; “verified” nel CSV non è accettato come certificazione. Fonti confermate dall’utente e stime rimangono distinguibili; dati mancanti restano null e totali parziali espliciti. Video nuovi/reimportati sempre da revisionare: nessun fetch arbitrario del backend o certificazione della tecnica/licenza. Nessuna chiamata automatica a un’AI e nessun cambio degli obiettivi salvati senza conferma.

Test browser eseguiti su Chromium desktop con viewport mobili, non Android fisico o Safari. Nessuna nuova dipendenza/lockfile modificata e nessun nuovo audit presentato come eseguito; i rischi già documentati in SECURITY.md rimangono da gestire. Il server online non è stato aggiornato. Il deploy con nuove colonne/collezione richiede backup verificato, autorizzazione e procedura in DEPLOYMENT.md; una vecchia versione che ignora status non è un rollback sicuro dopo la creazione di bozze CSV. Formati/limiti/AI in CSV_AI_GUIDE.md.

---

# Favicon e icone PWA ufficiali — 16 novembre 2026

- Lavoro separato dal commit account `c549670`, già pubblicato e SHA remoto verificato. Checkout pulito e sincronizzato prima di questo blocco. Nessuna modifica a codice di autenticazione, dieta, allenamenti, backend o database in questo commit; nessun deploy.
- Sorgente originale conservata byte per byte, hash e procedura deterministica in PWA_ICONS.md. Esportati ICO 16/32/48, PNG 16/32, Apple 180, standard e maskable 192/512. Nessun SVG approssimato.
- Controllati dimensioni, tre frame ICO, area sicura centrale maskable e anteprima su fondo bianco/scuro con maschera circolare; anteprima ispezionata. Simbolo e gradienti originali preservati.
- Build Vite, test frontend e build Docker frontend **PASS**. Solo container frontend locale ricostruito; servizi e volumi backend preservati.
- **12 test browser PASS, zero saltati**, a 360/390/1440 px: nuovi controlli favicon/manifest/icone caricati HTTP200, MIME e decodifica dimensioni effettive, quattro purpose corretti, installabilità senza errori Chromium, precache di tutti i file grafici e caricamento offline. Regressione Home/nutrizione, account e PWA offline/sessione esistente PASS. Questi test usano solo utenti sintetici.
- Tutti i nuovi asset sono inclusi nell’hash della shell; mantenuta l’assenza di skipWaiting/reload forzati e cache API/upload. Aggiornamento launcher Android, Edge/Firefox/Safari e dispositivo Android fisico non collaudati; procedura manuale documentata. L’instabilità del test notifiche registrata nel blocco account resta aperta: non è stata corretta o nascosta da questo lavoro grafico.

---

# Account personale e marchio senza versione — 16 novembre 2026

- Main inizialmente pulito sul commit `3ef4672`; sincronizzazione `origin/main` confermata senza aggiornamenti. Nessun deploy remoto.
- Rimossi versione visibile da logo, Home e footer e badge PRIVATO dall’header. Avatar con iniziale del nome utente, link accessibile a `/account`; form nello stile PULSE esistente.
- `PUT /api/pulse/profile`: ownership ricavata dalla sessione, controllo origine e password attuale, limite persistente dei tentativi, username univoco case-insensitive e validazione server. Nuova password facoltativa, hash nativo Strapi, transazione e revoca delle altre sessioni PULSE al cambio password. Nessuna modifica a dieta, scheda o carichi.
- Build frontend/backend native e Docker **PASS**; test backend 6 file e frontend 1 file **PASS**. Build nativa Strapi con XDG_CONFIG_HOME temporaneo per il sandbox; nessuna configurazione personale sovrascritta. Stack locale ricostruito sui volumi esistenti, tre servizi healthy.
- Nuovo test account **PASS a 360/390/1440 px** su immagini locali: cambio username e persistenza al reload, cambio password, accesso con nuovo username/password e rifiuto della vecchia password, revoca degli altri accessi, unicità, password debole/errata e origine ostile rifiutate, secondo utente invariato, nessun errore pagina/overflow. Credenziali dei soli due utenti sintetici ripristinate nel finally. Screenshot mobile ispezionato.
- Prima regressione completa: 14/15 passati, errore intermittente del test già esistente sul rinvio promemoria; prova diagnostica isolata successiva PASS. Nessuna modifica ai promemoria applicata in questa attività. Seconda esecuzione: 14/15, promemoria PASS e timeout workout desktop perché tutte le serie della sessione sintetica erano state consumate dalle ripetizioni (pagina: 0 serie da gestire). Sessione sintetica conclusa via API e nuova A avviata, storico conservato; nessun reset o modifica a utenti personali.

- Ultima regressione: **14/15 PASS** (account su tre viewport, nutrizione, workout, concorrenza e PWA); il test notifiche ha avuto un timeout, dopo il precedente PASS isolato. Instabilità notifiche aperta e non attribuita come risolta dal lavoro account.

---

# Fase4 — sicurezza e preparazione deployment, 16 novembre2026

## Stato e perimetro

Checkout iniziale pulito sul commit17d6f12, main sincronizzato prima del lavoro. Primo blocco sicurezza pubblicato come28d6c2b con SHA remoto verificato. Preparazione produzione e collaudi eseguiti **solo localmente**; nessun deploy remoto, modifica DNS, certificato pubblico ACME o timer installato sul PC. UI PULSE2.1, Vue3 JavaScript, Strapi5, PostgreSQL17, dati personali originali, dieta e video preservati. Fase5 non implementata.

Domini esatti: `https://pulse.vezzo.vp360web.it`, `https://apipulse.vezzo.vp360web.it`, admin sul backend `/admin`. Resolver del PC e Google Public DNS hanno restituito NXDOMAIN per entrambi, Status3 e nessun record A al controllo. Il collaudo ha usato risoluzione dei nomi limitata ai processi di test verso127.0.0.1, non modifiche DNS/hosts di sistema.

## Audit e protezioni

- Audit iniziale34 (23high,9moderate,2low) → audit finale **25 (5high,20moderate,0low,0critical)**. Frontend0. Nessun `audit fix --force`, downgrade Strapi4 o override globale Zod3→4.
- Strapi5.62.0 già ultima stable verificata. Corrette le copie Zod4 a4.6.7 e MCP Node2.1.2/Hono adapter2.1.8 secondo il range ammesso. La riduzione di due low è dovuta al ritiro ufficiale dell'advisory deepmerge recepito dal registro durante l'attività, **non a una patch inventata**. Report integrale in dependency-audit.json e analisi/patch/raggiungibilità in SECURITY.md. Le5 high residue da Zod3 nei parser di opzioni server non sono dichiarate risolte.
- Login protetto da contatori HMAC PostgreSQL per IP/account, Retry-After e persistenza dopo riavvio. Registrazione chiusa e native JWT login/reset/connect/MCP inutilizzati non esposti. Ownership delle API personali preservata.
- Produzione: Origin esatto obbligatorio, CORS ristretto, cookie personale Secure/HttpOnly/Strict host-only con revoca server, proxy a un hop con header client sovrascritti. Admin/backend per IP/VPN, rate limit nativo, CSP e header HTTP, body/array/depth limitati, log senza query/body/cookie/identificatori e rotazione container.
- PostgreSQL produzione: ruolo app separato e verificato **rolsuper=false, rolcreatedb=false, rolcreaterole=false**; superuser bootstrap solo pulse_maintenance, segreto non presente nel container Strapi. Inizializzazione provata su volume nuovo e dati ripristinati come ruolo app. Volumi originali non convertiti o eliminati.

## Build e test effettivi

- npm ci frontend/backend, build Vite e admin Strapi, immagini locali e produzione: **PASS**. Backend11casi in6file, frontend1caso. Compose locale preservato; Compose produzione separato validato senza stampare segreti. Caddyfile verificato dal binario Caddy2.11.9. Node24.22.3/nginx1.28.3/PostgreSQL17/Caddy fissati per digest nelle immagini/configurazioni.
- Regressione API fase2 e smoke: **PASS** (login/logout, dieta ON/OFF, pasti/annullamento/sostituzioni, preferenze, domani, peso, integratori/spesa, conflitti e accesso pubblico negato).
- API fase3: **PASS** (due utenti, CSRF/ownership, avvio/serie/skip, retry e revisioni, snapshot/storico/volume, timer). Caso60standard→50temporanei→completata senza peso→nuova sessione60 **PASS via API e browser**.
- `tests/phase4-security.mjs`: throttle verificato con10fallimenti/429 e Retry-After; dopo restart PostgreSQL/Strapi stesso blocco ancora attivo e login sintetico legittimo consentito. CORS ostile rifiutato, endpoint inutilizzati chiusi, collezione eccessiva413. Persistenza fase3 confrontata su UUID, revisione, endAt esatto, standard60, storico unlogged e promemoria: **PASS**.
- Suite browser finale **12passati,0saltati** a360/390/1440px: nutrizione, allenamento, timer, offline/reload/ritorno rete, PWA installabilità, cache solo shell/asset, due tab, risposta persa/retry idempotente, conflitto esplicito/export, memoria locale non disponibile, ciclo60/50/senza peso/60 e notifiche reali. Notifiche confermate anche in tre ripetizioni consecutive del test mirato, con Chromium completo.
- Nei controlli sono state corrette una sovrapposizione dei refresh promemoria e l'affidamento esclusivo all'evento online: operazioni promemoria serializzate, retry della coda pendente a ritorno visibilità e mentre l'app è visibile. Nessun cambio grafico. Il test notifiche usava accidentalmente il baseURL Vite per ripulire una fixture servita da8081: ora tutte quelle richieste puntano allo stesso server sotto test. Le prove finali non hanno retry di test mascherati o scenari saltati.
- Copia isolata `pulse-rehearsal`, quattro container healthy, porte solo127.0.0.1, DB/app senza porte host. `tests/phase4-https.mjs`: **PASS** per certificato verificato con CA dedicata, domini reali via risoluzione locale, /api same-origin, cookie sicuri, Origin mancante/errato403, logout/revoca e admin nativo. Native admin browser login/reload **PASS**, nessun pageerror.
- Browser HTTPS360/390/1440: **PASS** per cookie persistente, secure context, service worker, serie offline dopo reload, chiusura e riapertura con storage privato, sincronizzazione, assenza pageerror/overflow. Le sole eccezioni SSL nel browser riguardano la CA interna di test: Node/curl ne hanno verificato la catena senza bypass. Non è una prova di certificati pubblici o Android fisico.
- Admin con IP non autorizzato: **403 anche con X-Forwarded-For127.0.0.1 contraffatto**; configurazione di prova poi ripristinata al gateway/32 effettivo. Header di origine/credenziali non sono trattati come autorizzazione IP.
- Aggiornamento PWA **PASS**: versione sintetica del worker installata in attesa mentre la finestra conserva l'allenamento; dopo chiusura nuova versione attiva, vecchia cache rimossa, stessa sessione presente. Ripristinata la configurazione container originale alla fine della prova.

## Backup e ripristino reali

Prima degli schemi aggiuntivi effettuato dump privato originale. Nuovo backup completo cifrato GPG eseguito sia sullo stack locale sia sulla copia di produzione: DB, upload, env/configurazioni, lockfile/SHA/inventario immagini e, per la produzione, dati TLS Caddy. Chiave sintetica temporanea in directory0700; credenziali solo in file privati, nessun segreto nel repository/immagini.

**Due restore completi PASS** in container e volumi nuovi con `--network none`, senza porte:70tabelle ripristinate, pg_restore exit-on-error, conteggi di tutte le tabelle confrontati, checksum manifesto validati e hash del file sentinella upload corrispondente. Il file sentinella sintetico è stato rimosso dall'originale. I container/volumi del test di restore sono stati eliminati, senza toccare gli originali. Un archivio GPG troncato è stato rifiutato senza produrre PASS o ripristinare dati.

Script con lock, permessi, gestione errori, ripartenza app, retention e trasferimento cifrato rsync/SSH strict-host-key predisposti. Sintassi Bash e calendario systemd03:30Europe/Rome verificati. Timer/servizio **non installati o abilitati** sul PC; copia verso server esterno reale non eseguita perché destinatario, chiave e known_hosts devono essere forniti/configurati sul server.

## Gate manuali prima del go-live

1. Rivedere e accettare le mitigazioni specifiche dei25 finding residui; non attestare audit0 o sicurezza OS senza scansione dei layer. Se cambia l'esposizione/admin/plugin, rivalutare la raggiungibilità.
2. Configurare DNS reali, firewall, email ACME, CIDR admin specifici e certificati pubblici dopo autorizzazione. Nessun dominio .com sostituito ai due indirizzi richiesti.
3. Installare una chiave pubblica backup reale, custodire la privata altrove, configurare e verificare destinazione esterna/monitoraggio. Eseguire DR periodico, non solo una copia locale.
4. Collaudare Chrome Android fisico con ANDROID_CHECKLIST.md. Notifiche rimangono foreground/in-app, senza push remoto a pagina chiusa. Le cinque associazioni video restano da revisionare e non sono state sostituite.

DEPLOYMENT.md contiene requisiti, preview privata, comandi per pubblicazione futura, onboarding/import per nuovi utenti, migrazione dei dati esistenti senza reimport, backup/DR, aggiornamenti/rollback e troubleshooting. **Preparazione locale conclusa; nessun via libera automatico alla produzione.**

---

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

## Redesign "Mattino" e ON/OFF automatico — 23 novembre 2026

Modifiche: nuovo tema chiaro/scuro (crema, terracotta, salvia, titoli serif; `frontend/src/theme.css`), navigazione a 5 voci (Oggi, Dieta, Allena, Progressi, Tu) con barra laterale da 900px, Oggi riprogettata (saluto, chip ON/OFF, avanzamento, prossimo pasto, swipe, allenamento del giorno, domani), Dieta con striscia settimanale e schede Pasti/Spesa, Tu come elenco, toast con "Annulla" per i pasti. Backend: `personal-setting.data.trainingDays` (0–6, default vuoto = comportamento precedente tutto OFF); la giornata nasce ON/OFF secondo quei giorni, una giornata mai modificata (revision 0, senza consumi) segue i giorni aggiornati, azione `mode: "auto"` per tornare all'automatico, `autoMode` nella risposta `/days/:date`. Nessuna modifica di schema DB.

Risultati reali:
- `backend`: `npm test` 33/33 passati (incluso nuovo test ON/OFF per i 7 giorni); `npm run build` riuscito.
- `frontend`: `npm run build` riuscito; `npm test` 6/6 passati.
- Stack Docker ricostruito (`docker compose up -d --build --wait`): tutti healthy.
- Verifica browser su stack reale (porta 8081) con un utente sintetico temporaneo (piani dal CSV di esempio dell'app, poi utente e dati eliminati): chip "Giorno ON · automatico" nel giorno di allenamento; ON→OFF manuale e "Torna all'automatico"; settimana successiva automatica; "Mangiato" → toast con Annulla → pasto ripristinato e persistente dopo il reload. 12 schermate × (375×740, 1280×850) × (chiaro, scuro): 0 errori console, 0 overflow orizzontale, 0 aree di tocco sotto 44px dopo le correzioni. Screenshot ispezionati.

Non eseguito: la suite `npm run test:e2e` richiede le fixture di `backend/scripts/test-fixtures.js`, che importano un PDF privato non montato in questo ambiente. I test e2e sono stati aggiornati ai nuovi nomi (voci "Allena"/"Tu", titolo "La tua giornata", scheda "Lista della spesa", layout di Tu) ma non sono stati eseguiti: da lanciare con le fixture prima del rilascio. Swipe e `prefers-reduced-motion` non coperti da test automatici; contrasto AA non misurato con strumento.

### Seconda passata: struttura, non solo colori — 23 novembre 2026

- Sessione di allenamento riscritta (`frontend/src/components/WorkoutSession.vue`): una serie corrente alla volta con campi kg/ripetizioni grandi, "Fatta" a tutta larghezza (se i kg sono vuoti usa lo standard come valore della seduta, senza modificarlo), "Senza peso"/"Salta serie", ripetizioni rapide, timer grande con +15 s/Pausa/Salta, esercizi scorrevoli, defaticamento e conclusione in fondo. Schede in elenco semplice (Vedi/Inizia, badge Oggi); dettagli tecnici rimossi dalla vista in palestra.
- Bug trovato e corretto: dopo aver scritto i kg, il tocco su "Fatta" veniva perso perché il salvataggio della bozza disabilitava il pulsante; ora la bozza non blocca i comandi e "Fatta" legge i valori dei campi.
- Impostazioni: Preferenze, giorni di allenamento e obiettivi in pagina propria (`/altro/preferenze`); Account solo credenziali; "Esci" solo in Tu; versioni salvate in cima a Piani/Schede e import CSV in sezione apribile; rimossi i riferimenti ad "Altro".
- Verifica su stack reale con utente sintetico temporaneo (eliminato): avvio scheda, 42,5 kg registrati con standard invariato via API, timer 1:01 → +15 s 1:16, stesso valore dopo reload, serie 1 di 2, salto esercizio, defaticamento, conclusione. Nessun overflow a 375 e 1280 px su Allena, Tu, Schede, Preferenze, Account, Dieta. Errori console solo attesi (401 prima del login, 409 "nessun piano attivo" prima del setup).
- `frontend` build ok, `npm test` 6/6; `backend` `npm test` 33/33. Test e2e aggiornati ai nuovi nomi ("Vedi", "Annulla", "Fatta", "Pausa", "Defaticamento fatto", "Organizza", `/altro/preferenze`) ma non eseguiti: richiedono le fixture con PDF privato.

### Barra in alto, foto profilo e logo — 23 novembre 2026

- Barra superiore: solo logo (nuovo segno "Mattino", `components/Logo.vue`) a sinistra; a destra Progressi, profilo (foto o iniziale, porta a Tu) ed Esci. Navigazione ridotta a Oggi · Dieta · Allena · Tu. "Esci" rimosso da Tu (non duplicato).
- Foto profilo: caricata da Tu, ritagliata e ridimensionata a 256 px JPEG nel browser, salvata in `personal-setting.data.avatar` (data URL immagine, max ~200 KB, validata dal server; nuovo test backend). Nessuna modifica di schema DB.
- Verifica su stack reale con utente temporaneo (eliminato): caricamento foto → toast, foto visibile in alto e in Tu dopo reload a 375 e 1280 px; 4 voci di navigazione; Esci porta al login; nessun overflow, nessun errore JavaScript. Backend `npm test` 34/34, frontend build ok e `npm test` 6/6. E2E aggiornati, non eseguiti (fixture con PDF privato).
- Icone PWA e favicon usano ancora il vecchio logo.
- Navigazione: "Allena" → "Allenamenti" (icona bilanciere), "Tu" → "Impostazioni" (ingranaggio); su desktop le sottovoci delle impostazioni compaiono sotto la voce solo quando si è in quella sezione. Verificato a 375 e 1280 px con utente temporaneo (eliminato): sottomenu nascosto su Oggi, visibile in Impostazioni, voce attiva corretta su Integratori, etichette non tagliate, nessun errore JavaScript.
