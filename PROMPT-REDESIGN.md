# Prompt: redesign UX/UI di PULSE

> Prima di incollare il prompt, installa le skill (vedi in fondo). Poi apri Claude Code nella cartella `pulse-app` e incolla tutto il blocco qui sotto.

---

Usa la skill **frontend-design** per la direzione visiva e la skill **webapp-testing** per i test nel browser.

## Obiettivo

Riprogetta l'interfaccia di PULSE, la mia web app personale per dieta, allenamento e progressi. L'app attuale (Vue 3 in `frontend/src`) funziona, ma è confusionaria: le funzioni sono sparse in 13 schermate e i percorsi sono lunghi. Voglio un prototipo **molto più bello, curato e interattivo**, in **HTML, CSS e JavaScript puri** (niente framework, niente build, niente dipendenze esterne né CDN), con **tutte** le funzioni dell'app attuale.

Il prototipo serve a validare il design prima di portarlo nell'app Vue. **Non modificare `frontend/` né `backend/`.**

## Prima di scrivere codice

1. Leggi `AGENTS.md`, `docs/DATA_MODEL.md`, `frontend/src/main.js` (rotte), `frontend/src/App.vue` e tutti i `.vue` in `frontend/src` e `frontend/src/components`.
2. Scrivi in `prototype/INVENTARIO.md` l'elenco completo delle funzioni trovate, schermata per schermata. Usalo come checklist: alla fine ogni voce deve essere raggiungibile nel prototipo. Indica per ogni voce dove si trova nel nuovo design.
3. Proponimi 2 direzioni visive (palette, tipografia, stile di interazione) con una mini anteprima HTML per ciascuna in `prototype/direzioni/`. Poi **fermati e aspetta che io scelga**.

## Funzioni da mantenere (minimo, completa con l'inventario)

- **Oggi**: pasti del giorno, prossimo pasto con "Mangiato" e "Sostituisci", annullamento di un pasto consumato, progresso della giornata, integratori da assumere oggi, ripresa di un allenamento in corso, preparazione del giorno dopo, promemoria in scadenza.
- **Giorno ON/OFF**: oggi è una scelta manuale. Nel nuovo design deve essere **automatico in base al giorno della settimana** (l'utente sceglie i propri giorni di allenamento), con la possibilità di cambiarlo a mano per una singola data e tornare all'automatico.
- **Dieta**: navigazione per data, pasti con alternative e gruppi (sostituzione salvata, bloccata se il pasto è già consumato), preferiti, nutrienti della giornata (valori sconosciuti restano vuoti, non a zero), lista della spesa con spunte, note del piano, gestione piani.
- **Allenamento**: schede A/B/C con esercizi, serie, ripetizioni, recuperi, video/animazioni degli esercizi, sessione guidata (kg e ripetizioni per serie, salta serie/esercizio, timer di recupero con +tempo/salta, recupero manuale), conclusione o annullamento con conferma, ripresa dopo il reload. **Il carico standard e il peso effettivamente sollevato sono due cose distinte**: inserire i kg di oggi non deve mai cambiare lo standard. Lo standard si aggiorna solo con un'azione esplicita e una conferma.
- **Progressi**: intervallo di tempo, calendario allenamenti, frequenza, storico, carichi, volume, peso corporeo, riepilogo nutrizione degli ultimi 7 giorni.
- **Promemoria**: pasti (orario per pasto, contenuto del pasto nella notifica), integratori, allenamento, peso, promemoria personalizzati. Non notificare un'azione già fatta. Notifica di prova, consenso alle notifiche, anticipo e posticipo (15/30/60 min). Nel prototipo le notifiche funzionano a pagina aperta tramite la Notification API, con fallback a toast. Lascia in un commento l'aggancio al web push dell'app vera.
- **Integratori**: crea, modifica ed elimina un integratore (quantità, unità, frequenza, giorni, orari, ON/OFF/sempre), assunzioni di oggi, storico.
- **Piani e schede**: versioni salvate, attivazione, import CSV con anteprima e controllo, export, testo per l'AI con opzione per includere le preferenze, editor visuale della dieta e della scheda (anche con un'interfaccia semplificata), preferenze alimentari e obiettivi.
- **Account**: credenziali, cambio password (minimo 12 caratteri), installazione PWA, logout. Schermata di login.

## Requisiti di UX/UI

- Mobile-first (375px), ottimo anche su desktop (layout a colonne da 900px in su). Navigazione a 4-5 voci al massimo, con le azioni del momento in primo piano. Massimo 2 tocchi per le azioni quotidiane (segnare un pasto, un integratore o una serie).
- Interattività vera: transizioni e micro-animazioni (rispettando `prefers-reduced-motion`), bottom sheet, swipe per segnare o annullare dove ha senso, feedback immediato con annullamento ("Annulla" nel toast), stati vuoti curati, skeleton di caricamento, tema chiaro e scuro.
- Accessibilità: aree di tocco di almeno 44px, contrasto AA, focus visibile, etichette ARIA, uso completo da tastiera.
- Testi in italiano. Validazione degli input (peso 30–300 kg, kg e ripetizioni non negativi, campi obbligatori).

## Dati

- Solo **dati sintetici** in `prototype/data.js`. Usa la stessa forma dei dati delle API reali (leggi `frontend/src/api.js` e gli store) così il porting sarà semplice. Mai dati personali o sanitari reali.
- Lo stato si conserva in `localStorage`, con un pulsante "Azzera dati demo".

## Struttura

`prototype/index.html`, `prototype/styles.css`, `prototype/app.js` (eventualmente pochi moduli ES), `prototype/data.js`. Il prototipo deve funzionare aprendo direttamente `index.html` oppure con `npx serve prototype`.

## Test (obbligatori, con webapp-testing / Playwright)

Crea `prototype/tests/` con Playwright (puoi usare quello già presente in `frontend/node_modules`). I test devono:
- percorrere ogni voce di `INVENTARIO.md`;
- girare a 375×740 e a 1280×850, in tema chiaro e scuro;
- verificare: assenza di errori in console, nessun overflow orizzontale, aree di tocco ≥ 44px, ON/OFF automatico corretto per ogni giorno della settimana (con l'orologio simulato), standard ≠ peso sollevato, persistenza dopo il reload, promemoria non inviato per un'azione già fatta;
- salvare uno screenshot per ogni schermata, che devi **guardare** per cercare bug grafici (testo tagliato, sovrapposizioni, elementi disallineati, contrasto) e correggerli.

Ripeti test e correzioni finché tutto è verde. Alla fine scrivi in `prototype/README.md` i risultati reali dei test, i bug trovati e corretti e quello che resta aperto. Non dichiarare funzionante niente che non hai testato.

---

## Skill da installare prima (in Claude Code)

Dal repo ufficiale Anthropic `anthropics/skills`:

```
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
```

Il pacchetto include, tra le altre:
- **frontend-design**: evita le interfacce "generiche da AI" e porta a scelte decise su tipografia, colore, layout e animazioni;
- **webapp-testing**: testa le web app locali con Playwright, con screenshot e log della console.

Se i nomi non corrispondono, controlla con `/plugin` → Discover.
