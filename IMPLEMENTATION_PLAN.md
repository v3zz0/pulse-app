# PULSE 2.1 — piano incrementale

Il prompt originale è `PULSE_Starter_Codex_Cloud/PULSE_PROMPT_CODEX.md`, non nella root. Gli originali restano intatti nella sottocartella; nessun PDF entra nelle immagini o negli asset web.

1. **Fondamenta (questa consegna)**: Vue 3 Composition API JavaScript, Router, Pinia, CSS della demo approvata; Home responsive con interazioni locali dichiaratamente dimostrative; Strapi 5 JavaScript con Users & Permissions, PostgreSQL, Compose, segreti locali, healthcheck e documentazione. Registrazione pubblica disabilitata. Piano e schema dati progettuale. Nessun CRUD personale esposto.
2. **Dati e accesso**: login utente finale distinto dall'admin; ownership obbligatoria per ogni lettura/scrittura, registrazione chiusa, test accesso anonimo e cross-user. Modelli versionati e import idempotente completo dei PDF con provenienza, revisione delle ambiguità, video associati alle righe e seed sintetici separati.
3. **Giornata persistente**: sostituire lo store demo con API autenticate; consumo/annullamento, ON/OFF, preferenze e domani, peso, integratori, spesa derivata da ingredienti. Nessun calcolo macro senza fonte verificata.
4. **Allenamento**: schede integrali, snapshot serie e carichi, stato eseguito/saltato/non registrato, aggiornamento standard solo con conferma, IndexedDB, UUID idempotenti, timer su timestamp, test 60→50→non registrato→60.
5. **Progressi e PWA**: medie del peso senza attribuire massa muscolare, storico, manifest/icona/service worker, cache senza dati privati indiscriminati, Web Push consensuale HTTPS con fallback in-app.
6. **Produzione**: test ownership e restore, proxy TLS, backup cifrati/esterni, aggiornamenti e migrazioni provate, audit dipendenze e sicurezza prima di esporre il servizio.

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
