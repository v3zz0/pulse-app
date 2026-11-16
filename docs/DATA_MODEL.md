# Schema relazionale proposto — fase 2

Questo è un progetto, non una dichiarazione di tabelle già implementate. Usare gli utenti del plugin Users & Permissions; admin Strapi separati. Tutti i record personali appartengono a un utente, ricavato dalla sessione server e mai dal body client. Cataloghi e configurazioni modificabili solo dall'admin. Permessi Public vuoti.

| Entità | Relazioni e campi principali | Invarianti |
|---|---|---|
| Profile / Goal | user 1:1; timezone, height; goal versions, kcal/P/C/F, source, indicative | Obiettivi non prescritti distinguibili |
| SourceDocument / ImportRun | hash SHA256 univoco, kind, date, validity, page; import version e stato | Idempotenza su hash+versione; nessun PDF pubblico |
| NutritionPlanVersion | source, owner, effective dates, review status | Versioni storiche immutabili |
| DayTemplate / MealTemplate | piano→ON/OFF→pasti ordinati; orario opzionale, note fonte | Non dedurre orari prescritti dalla demo |
| AlternativeGroup / MealOption | pasto→gruppi choose-one e componenti cumulativi | “oppure” separato da “+”; revisione ambiguità |
| Ingredient / Food | option, food, min/max quantity, unit, raw/cooked, optional, note | Range e q.b. preservati; macro null senza fonte |
| FoodNutrientSource | food, source URL/revision, unit, kcal/P/C/F | Dati verificabili e non inventati |
| FrequencyRule | option/food, max count, period, original text | Es. settimanale o ogni 10 giorni |
| DailyPlan / PlannedMeal | owner, local date, plan version, ON/OFF, option snapshot | Unique(owner,date); cambio piano non altera consumo storico |
| MealConsumption | planned meal, owner, consumedAt, snapshot, undoneAt | Annullamento esplicito; idempotency key |
| Preference | owner, option, favorite/avoid | Unique(owner,option) |
| TrainingProgramVersion / TrainingDay | source, owner, A/B/C, ordered blocks | Versioni immutabili dopo utilizzo |
| Exercise / Video | nome, note; URL, source page, mapping review | Più video per blocco/circuito, nessun URL indovinato |
| ExerciseBlock / PrescribedSet | day, order, phase, reps/range/CED, rest raw text+seconds, circuit children | Recupero ambiguo seconds=null; defaticamento esplicito |
| StandardLoad | owner, prescribed set, kg nullable, effective version | null = da impostare, 0 non equivale a null |
| WorkoutSession / SessionSet | owner, UUID client, status, program version; snapshot standard, reps, note, rest | Unique(owner,clientId); massimo una attiva per utente via vincolo/transazione |
| SetResult | session set, recorded/unlogged/skipped, actualKg nullable, actualReps, completedAt | actualKg solo recorded; snapshot standard non è peso eseguito |
| RestTimer | session, endAt, pausedRemaining | Timestamp persistito, non reset al reload |
| WeightEntry | owner, local date, kg, measuredAt | Unique(owner,date); validazione numerica |
| SupplementProduct / Ingredient / Plan | prodotto→principi attivi, quantità/unità, source, schedule | Sovrapposizioni informative, nessuna modifica automatica dosi |
| SupplementIntake | owner, product, actual dose, takenAt | Assunzione esplicita |
| Reminder / PushSubscription | owner, kind, timezone, consent, snoozedUntil | Non notificare azioni già completate; 15/30/60 min |
| ShoppingList / ShoppingItem | owner, date range, planned meal versions, food, quantity/unit, checked | Aggregare solo unità compatibili |

## Contratti da implementare

- Controller/service con filtri ownership server-side anche su populate, ID di relazione, aggiornamenti e cancellazioni; test con due utenti, token scaduto e anonimo.
- SessionSet conserva standardAtStart e actualKg distinti. Modifica temporanea non tocca StandardLoad. Endpoint dedicato di conferma aggiornamento standard con versione ottimistica. Risultati conclusi immutabili.
- Sync offline: UUID stabile, revision, transazioni, conflitti espliciti; IndexedDB conserva bozze e coda, backend autorevole. Il client non crea sessioni duplicate a ogni retry.
- Import in staging con hash e chiave deterministica per riga/gruppo; validazione prima della pubblicazione atomica. Note ambigue visibili in admin e test fixture sintetiche; nessun seed automatico dei PDF in produzione.
- Restrict delete per versioni in uso; preferire archiviazione. Indici owner/date e owner/status. Vincoli SQL aggiuntivi tramite migrazioni revisionate, con backup e restore prima degli upgrade.

## Implementazione effettiva fase 2

Le collezioni presenti sono nutrition-plan, daily-plan, food-preference, weight-entry, supplement-product, supplement-intake e pulse-session. I pasti/gruppi/opzioni sono un JSON versionato nel piano e uno snapshot nella giornata, anziché le tabelle separate inizialmente proposte: questo semplifica l'import e conserva la fonte, ma l'editing admin è attualmente JSON. La guida `STRAPI_GUIDE.md` descrive chiavi e responsabilità.

Le chiavi univoche includono l'utente; le giornate hanno revisione per concorrenza ottimistica. Consumi annullabili, nessuna sostituzione su pasto già consumato. Assunzioni distinguibili per prodotto/data/orario; nessuna dose precompilata dal piano storico. I registri utente sono accessibili solo tramite endpoint protetti da sessione, senza REST CRUD generico. Lo schema allenamento resta progettuale per fase 3.

## Primo incremento fase 3 effettivamente presente

`training-program` conserva owner, hash/versione import, stato di revisione, giornate JSON e defaticamento comune. Il JSON contiene blocchi ordinati, fasi, serie identificate in modo deterministico, ripetizioni e note fonte, recupero raw/secondi, movimenti del circuito e annotazioni video candidate. Carichi iniziali null; nessun risultato eseguito viene creato dall'import. Nessun endpoint CRUD generico esposto. Import transazionale con advisory lock per owner/hash/versione, così due import concorrenti non creano due versioni uguali.

Questo era il perimetro del primo incremento; l’implementazione successiva è descritta qui sotto e in PHASE3.md.

## Implementazione effettiva fase 3

- `standard-load`: owner, programId, setKey, kg nullable, revisione e uniqueKey owner/programma/serie. La modifica esplicita ha un endpoint dedicato e non legge automaticamente i risultati.
- `workout-session`: UUID client per owner, activeKey univoca (null alla conclusione), stato/revisione, snapshot JSON del programma e delle serie, timer endAt/pausedRemaining e log degli ID operazione con hash del payload. Lock transazionale per owner e vincoli univoci serializzano avvio e scrittura; replay dello stesso payload non aggiunge un'altra serie o sessione. Ogni serie conserva standardAtStart, draftKg, actualKg, actualReps, stato e completedAt; lo storico concluso è immutabile tramite API. Un indice univoco nullable su activeKey impedisce due sessioni attive per owner nell'API.
- `reminder`: configurazione JSON per kind/target/ora/timezone/giorni, stato dell'occorrenza locale, revisione e chiave per owner/UUID. Lettura delle azioni già completate prima della proposta. Nessuna PushSubscription: il canale attuale è in-app/notifica di sistema con pagina aperta.
- `video-review`: owner, programId, URL, titolo, base della verifica, nota e data. Overlay per le nuove sessioni e per l'anteprima; non modifica il programma originale né snapshot storici.

La coda IndexedDB è separata per owner, verificato nuovamente tramite /me prima di inviare dati. Web Locks e BroadcastChannel coordinano le schede dello stesso browser; altre installazioni usano revisioni server e conflitti espliciti. I risultati delle serie sono uno snapshot JSON transazionale, anziché righe SetResult separate; questo conserva insieme schema e fonte senza introdurre aggiornamenti parziali non atomici. Non modificare manualmente activeKey, uniqueKey, revisioni o log operazioni in admin.
