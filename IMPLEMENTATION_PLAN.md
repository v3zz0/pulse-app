# PULSE 2.1 — piano incrementale

Il prompt originale è `PULSE_Starter_Codex_Cloud/PULSE_PROMPT_CODEX.md`, non nella root. Gli originali restano intatti nella sottocartella; nessun PDF entra nelle immagini o negli asset web.

## Workflow Git

Lavorare direttamente su `main`, sincronizzandolo con `origin/main` prima di iniziare. Non creare branch o Pull Request. Dopo ogni attività completata: build e test pertinenti, commit descrittivo, push senza force su `origin/main` e verifica dello SHA remoto. Se il push è negato, fermarsi e segnalare il blocco. Non pubblicare segreti, `.env` reali o database. Nessun deploy pubblico durante lo sviluppo.

## Quattro macrofasi

1. **FASE 1 — Fondamenta: completata.** Conservare Vue 3 Composition API JavaScript, Router, Pinia, Strapi 5, PostgreSQL e Docker Compose. Non ripetere lo scaffold.
2. **FASE 2 — Login e nutrizione completa: implementata.** Unisce le precedenti fasi 2 e 3. Login/logout Strapi, API protette e ownership; import completo e verificato della dieta PDF, provenienza e revisione delle ambiguità; persistenza PostgreSQL; pasti ON/OFF, Mangiato e Sostituisci, preferenze e alternative; preparazione di domani; peso corporeo; integratori e assunzioni; lista della spesa; Home collegata ai dati reali. Verificare subito le vulnerabilità e correggere quelle risolvibili senza rompere la compatibilità. Organizzare Strapi con nomi comprensibili, responsabilità separate e guida pratica alle modifiche.
3. **FASE 3 — Allenamento e PWA completa.** Unisce le precedenti fasi 4 e 5. Schede A/B/C originali e video verificati; carichi standard persistenti distinti dalle modifiche temporanee; serie completate, saltate e senza peso registrato; timer su timestamp, salvataggio automatico, ripresa, storico, grafici e riepiloghi settimanali. PWA installabile, notifiche e promemoria dove supportati. Non implementare Allenamento rapido.
4. **FASE 4 — Produzione.** Test finali, sicurezza, backup e restore, HTTPS, configurazione e documentazione per il server privato. Nessun deploy senza autorizzazione esplicita.

Verifiche e limiti della fase 2: `docs/VALIDATION.md`. Guida per modificare Strapi: `docs/STRAPI_GUIDE.md`. Le ambiguità della fonte sono marcate da rivedere; non costituiscono una nuova prescrizione.

## Regole invarianti

JavaScript senza TypeScript; Strapi 5, PostgreSQL e Docker Compose. Preservare design PULSE 2.1, verde menta e logo, stessa interfaccia adattiva telefono/desktop, Mangiato prima dell'elenco dei pasti. Nessuna modifica del design senza richiesta. Dati del piano storico distinti da nuove prescrizioni; macro non inventati. Ogni completamento va dimostrato con test reali, inclusa persistenza PostgreSQL.

## Criteri della fase 1

Build frontend/backend; PostgreSQL e Strapi avviabili; pannello nativo disponibile; registrazione pubblica rifiutata; Compose con persistenza, salute e rete DB privata. Home con prossimo pasto e due azioni prima della lista, look della demo a 360/390 px e desktop. Funzioni successive visibilmente non operative, senza falsi salvataggi. Nessun TypeScript nel codice/configurazioni scritti per il progetto.

## Analisi dei riferimenti

- HTML 2.1: palette #0B1018 / #151C27 / #38D9B0 / #4DA3FF, logo P/battito, max-width 970 px, breakpoint 720 px, due colonne 1.15/.85 su desktop, una colonna mobile e bottom navigation. Priorità: sessione da riprendere, prossimo pasto, lista, allenamento, azioni, statistiche secondarie. CSS originale riutilizzato; rendering riscritto in Vue, non HTML in iframe.
- La demo è un sottoinsieme, non un import autorevole: pesi palestra e storico fittizi, video non associati, preferenze locali, notifiche simulate. Il suo timer al reload ricostruisce endAt dai secondi residui: la versione persistente dovrà mantenere il timestamp originale. Non trasportare questi limiti nel prodotto definitivo.
- Dieta: 7 pagine, data 17/09/2026 e validità 30–40 giorni. ON/OFF con gruppi alternativi e ingredienti complementari, bevande, pre-workout, pre-letto, note e frequenze. Pesi generalmente a crudo ma eccezioni esplicite (piselli cotti, patate lesse); non appiattire tutto a “crudo”. Conservare testo fonte senza trasformarlo in nuove raccomandazioni. Tariffario e condizioni dello studio non sono dati del piano alimentare.
- Integratori del documento e prodotti citati nel prompt sono distinti: evitare somme automatiche di creatina, caffeina e multiminerali. I target 2.900 kcal e 140/405/80 g sono indicativi, non prescritti.
- Palestra: 2 pagine, giorni A/B/C, warm-up/top set/back-off, CED, esercizi addome, circuito finale 5+5+5, defaticamento 3 minuti. Nessun carico numerico reale da importare. `1/2′` della panca è ambiguo: conservare il testo, richiedere revisione; non adottare automaticamente i 120 s della demo. Circuito C contiene tre movimenti e tre link, non tre esercizi indipendenti da triplicare.
- Estratte 29 annotazioni URL con pagina e testo riga in `docs/reference-inventory.json`. I rettangoli delle annotazioni sono fuori dai limiti della pagina: le associazioni candidate seguono l'ordine delle righe LINK e sono da verificare manualmente, non una certificazione del contenuto video; URL non visitati. Dip e dip zavorrati, trazioni, reverse wrist curl e altri casi senza link esplicito non devono ricevere link inventati.

Gli originali contengono dati personali: repository privato, nessuna copia in public, immagini o seed di produzione. Le quantità demo derivano dall'HTML e restano segnalate come esempi parziali.

## Avvio fase 3 — 16 novembre 2026

Piano dettagliato in `docs/PHASE3.md`. Primo incremento implementato: import privato A/B/C, collezione nativa Strapi, nessun carico inventato, circuito esplicito e annotazioni video da verificare. Sessioni, standard persistenti separati, timer, IndexedDB, storico/grafici, installazione PWA e promemoria restano aperti: fase 3 non conclusa.
