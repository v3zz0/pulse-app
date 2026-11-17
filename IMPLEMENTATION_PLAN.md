# PULSE 2.1 — piano incrementale

Il prompt originale è `PULSE_Starter_Codex_Cloud/PULSE_PROMPT_CODEX.md`, non nella root. Gli originali restano intatti nella sottocartella; nessun PDF entra nelle immagini o negli asset web.

## Workflow Git

Lavorare direttamente su `main`, sincronizzandolo con `origin/main` prima di iniziare. Non creare branch o Pull Request. Dopo ogni attività completata: build e test pertinenti, commit descrittivo, push senza force su `origin/main` e verifica dello SHA remoto. Se il push è negato, fermarsi e segnalare il blocco. Non pubblicare segreti, `.env` reali o database. Nessun deploy pubblico durante lo sviluppo.

## Macrofasi

1. **FASE 1 — Fondamenta: completata.** Conservare Vue 3 Composition API JavaScript, Router, Pinia, Strapi 5, PostgreSQL e Docker Compose. Non ripetere lo scaffold.
2. **FASE 2 — Login e nutrizione completa: implementata.** Unisce le precedenti fasi 2 e 3. Login/logout Strapi, API protette e ownership; import completo e verificato della dieta PDF, provenienza e revisione delle ambiguità; persistenza PostgreSQL; pasti ON/OFF, Mangiato e Sostituisci, preferenze e alternative; preparazione di domani; peso corporeo; integratori e assunzioni; lista della spesa; Home collegata ai dati reali. Verificare subito le vulnerabilità e correggere quelle risolvibili senza rompere la compatibilità. Organizzare Strapi con nomi comprensibili, responsabilità separate e guida pratica alle modifiche.
3. **FASE 3 — Allenamento e PWA: implementata e collaudata.** Unisce le precedenti fasi 4 e 5. Schede A/B/C originali e video verificati; carichi standard persistenti distinti dalle modifiche temporanee; serie completate, saltate e senza peso registrato; timer su timestamp, salvataggio automatico, ripresa, storico, grafici e riepiloghi settimanali. PWA installabile, notifiche e promemoria dove supportati. Non implementare Allenamento rapido.
4. **FASE 4 — Sicurezza e preparazione deployment: implementata e collaudata localmente.** Correzioni compatibili dipendenze, API/CSRF/CORS/login persistente, Compose separato con TLS e admin per IP, ruoli PostgreSQL distinti, backup cifrati/rotazione/restore, aggiornamenti PWA e guida DEPLOYMENT.md. Nessun deploy remoto/DNS modificato. Go-live non autorizzato: DNS, ACME, sorgenti admin, copia backup esterna, revisione rischi residui e Android fisico sono gate operativi.
5. **FASE 5 — Rinviata.** Libreria video3D uniforme in stile MoveKit con licenze e verifica esercizio per esercizio; nuova dieta secondo gusti e obiettivi configurabili da sottoporre al nutrizionista. Nessuna implementazione in fase4 e nessuna sostituzione di dieta/video.

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

## Consegna fase 3 — 16 novembre 2026

Sessioni complete con standard separati, risultati espliciti, timer persistenti, ripresa IndexedDB e coda idempotente, conflitti visibili, storico/grafici e riepilogo, PWA e promemoria operativi. Criteri e collaudi reali in `docs/PHASE3.md` e `docs/VALIDATION.md`. Caso 60/50/senza peso/60 verificato via API e browser. Import a7e8930 preservato. Video: verifica metadati ufficiali, cinque associazioni restano da revisionare. Notifiche di sistema mentre l'app è aperta, fallback in-app; nessun push remoto garantito a pagina chiusa. Installabilità Chromium verificata; dispositivo Android fisico e HTTPS/server restano collaudi fase 4. Nessun deploy pubblico.

## Consegna preparazione fase4 — 16 novembre2026

Domini esatti: `https://pulse.vezzo.vp360web.it`, `https://apipulse.vezzo.vp360web.it`, admin `/admin`. Audit34→25, high23→5; Strapi5.62 già ultima stable, override compatibili Zod4.6.7 e MCP Node2.1.2/Hono2.1.8. Restano rischi analizzati, non cancellati dal report. Vedere SECURITY.md, VALIDATION.md, DEPLOYMENT.md e ANDROID_CHECKLIST.md.

Ripristino di70tabelle e upload verificato in container/volumi senza rete, inclusa la configurazione di produzione. HTTPS e cookie su domini reali verificati solo con risoluzione locale e CA interna; admin nativo e allowlist IP collaudati. Nessun certificato pubblico richiesto, deploy remoto o timer installato sul PC. Il Compose locale e i dati personali originali restano preservati.

## Estensione richiesta: CSV e personalizzazione dei piani — 17 novembre 2026

Aggiunti import/export dieta e schede completi, template sintetici, istruzioni AI, validazione server e anteprima senza scrittura, bozze e versioni con attivazione/archiviazione esplicita, confronto e trasferimento confermato dei carichi, nutrienti e target, preferenze private e preservazione degli snapshot. Modelli esistenti estesi; una sola nuova collezione per impostazioni per owner. Nessuna importazione ripetuta dei PDF, nessuna modalità rapida, nessuna nuova dieta attivata per utenti personali.

La parte preferenze/target e importazione è implementata da questa estensione. La generazione di una nuova dieta personale e la revisione clinica, oltre alla libreria video 3D e alle licenze, restano fuori da questa attività. Produzione non aggiornata: applicazione delle modifiche di schema subordinata a backup verificato e autorizzazione. Risultati effettivi in docs/VALIDATION.md; contratto operativo in docs/CSV_AI_GUIDE.md.
