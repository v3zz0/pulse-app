# Giornata chiusa, export PDF scheda, pulsante "Tutte le schede"

Data: 2026-11-25 · Stato: in approvazione

Tre modifiche indipendenti al frontend (Vue 3). Nessuna modifica al backend.

## 1. Pulsante "Tutte le schede"

**Perché:** in `Workout.vue` il link `‹ Tutte le schede` (classe `textbutton`) si vede poco.

**Cosa:** diventa un pulsante `btn secondary` con icona freccia, in cima alla vista scheda. Stesso comportamento (`day = null`).

## 2. Schermata "giornata chiusa" in Home

**Perché:** quando la giornata è completa, la dashboard non serve più; l'utente vuole una chiusura gratificante.

**Quando compare** (deciso dall'utente):
- ogni pasto del giorno è mangiato **o saltato** (`day.count + day.skipped === day.meals.length`, con almeno un pasto);
- tutti gli integratori previsti oggi risultano presi (da `useIntakes` / `todayIntakes`);
- solo nei giorni ON con scheda prevista (`train`): anche `workoutDone`.
- Giorno OFF: bastano dieta e integratori.
- Senza piano attivo: non compare.

**Cosa mostra:** la dashboard sparisce; al centro, in grande, "Ci vediamo domani." e sotto una frase motivazionale. Riga di riepilogo (✓ Dieta ✓ Integratori ✓ Allenamento se ON). In fondo un link discreto "mostra giornata" che rimette la dashboard normale per la sessione corrente (scelta di Claude: serve a correggere errori; se le condizioni restano vere, al prossimo caricamento ricompare).

**Frasi:** file `frontend/src/quotes.js` con più di 500 frasi motivazionali in italiano, originali o di pubblico dominio, senza attribuzioni dubbie. Una al giorno, deterministica: indice = hash della data locale (`localDate()`) modulo lunghezza, così resta uguale fino a mezzanotte.

**Cambio giorno:** già gestito dal reload esistente in `Home.vue`.

## 3. Export PDF della scheda finita

**Perché:** mandare l'allenamento concluso al coach/preparatore su WhatsApp. Formato scelto dall'utente: PDF.

**Approcci considerati:**
1. `window.print()` su pagina stampabile: zero dipendenze, ma su mobile/PWA richiede troppi passaggi e la stampa non è affidabile.
2. **Scelto:** PDF generato nel client con jsPDF + `navigator.share({ files })`. Un tocco porta al menu di condivisione (WhatsApp). Funziona offline. jsPDF caricato con `import()` dinamico solo al click.
3. PDF server-side in Strapi: richiede browser headless, pesante, non offline. Scartato.

**Dove:** pulsante "Invia al coach" nella schermata "Allenamento concluso" di `Workout.vue` (scelta di Claude: è il momento in cui serve). Se `navigator.canShare({ files })` è falso (desktop), scarica il file.

**Contenuto** (approvato sulla demo, riquadro "Com'è andata" rimosso):
- intestazione scura: "PULSE · REPORT ALLENAMENTO", nome scheda, data, ora inizio–fine;
- 4 KPI: durata, n. esercizi, serie fatte/previste, volume totale (Σ actualKg × actualReps);
- per esercizio: nome, obiettivo (serie×reps · carico `standardAtStart`), tabella serie con ripetizioni, peso sollevato (`actualKg`), "vs ultima volta"; nota dell'esercizio se presente;
- footer "Generato da Pulse".

**Regole:** carico standard e peso sollevato sono sempre colonne distinte (AGENTS.md). "vs ultima volta" confronta con l'ultima sessione `completed` della stessa scheda nello storico, stessa posizione di serie: verde se salito, rosso se sceso, "=" se uguale, vuoto se non c'è precedente.

**Nome file:** `pulse-<scheda>-<YYYY-MM-DD>.pdf`.

## Non-obiettivi
- Nessun invio automatico al coach, nessun contatto salvato.
- Nessun export della dieta.
- Nessuna modifica a backend o modello dati.

## Anti-obiettivi
- La schermata finale non deve comparire se manca anche un solo integratore o pasto non chiuso.
- Il PDF non deve mai confondere carico di scheda e peso sollevato.

## Lasciato al builder
- Layout jsPDF esatto (ispirarsi alla demo), font, paginazione su più pagine.
- Stile della schermata finale coerente con il tema esistente.
- Test: funzione pura per "giornata chiusa" e per il calcolo "vs ultima volta"/volume, nello stile di `frontend/tests/*.test.js`.
- Registrare i risultati reali in `docs/VALIDATION.md`.
