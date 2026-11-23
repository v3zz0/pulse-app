# PULSE · prototipo di redesign

Prototipo in HTML, CSS e JavaScript puri (nessun framework, build o CDN) per validare il nuovo design prima del porting in Vue. Direzione visiva scelta: **B "Mattino"** (crema, terracotta, salvia, titoli serif). Dati **solo sintetici** (`data.js`), salvati in `localStorage`.

## Avvio
- Apri `prototype/index.html` nel browser, oppure `npx serve prototype`.
- Accesso demo: `atleta.demo` / `demo-pulse-2026`.
- "Azzera dati demo" è in **Tu**.

## Struttura
| File | Contenuto |
|---|---|
| `index.html` | Guscio, skeleton iniziale, foglio (`<dialog>`), toast |
| `styles.css` | Tema chiaro/scuro, layout mobile e colonne da 900px |
| `app.js` | Stato, logica, schermate, azioni, promemoria |
| `data.js` | Dati sintetici con la forma delle API reali |
| `INVENTARIO.md` | Funzioni dell'app attuale e dove si trovano ora |
| `direzioni/` | Le due anteprime proposte (A e B) |
| `tests/` | Playwright: specifiche, config, screenshot |

Navigazione a 5 voci: **Oggi · Dieta · Allena · Progressi · Tu**.

## Test
```
frontend/node_modules/.bin/playwright test -c prototype/tests/playwright.config.cjs
```
Usa il Playwright già presente in `frontend/node_modules` (1.65.1). Orologio fissato a lunedì 23/11/2026 alle 13:30, fuso Europe/Rome.

**Risultato reale (ultima esecuzione): 48 test superati su 48**, cioè 12 scenari in 4 configurazioni: 375×740 e 1280×850, ognuna in tema chiaro e scuro.

Ogni scenario verifica che non ci siano errori in console. Ogni schermata fotografata verifica anche che non ci sia overflow orizzontale e che le aree di tocco siano almeno di 44px. Gli scenari:
1. **Oggi**: prossimo pasto, "Mangiato", "Annulla" nel toast, integratori, persistenza dopo il reload, annullamento di un pasto, "Prepara domani".
2. **ON/OFF automatico** per tutti e 7 i giorni (orologio simulato), modifica a mano per una data, ritorno all'automatico, cambio dei giorni di allenamento.
3. **Dieta**: alternative salvate, sostituzione bloccata se il pasto è consumato, preferiti, nutrienti sconosciuti mostrati come somme parziali (mai zero), spunte della spesa che restano dopo il reload, navigazione per settimana.
4. **Allenamento**: 62,5 kg registrati con standard a 30 kg; lo standard resta 30 anche a sessione conclusa. Timer di recupero con +15 s che sopravvive al reload, serie ed esercizio saltati, validazione del recupero manuale, barra "Riprendi", aggiornamento dello standard solo con conferma, conclusione.
5. **Annullamento della sessione** con conferma: non entra nello storico.
6. **Progressi**: intervallo, esercizio, calendario, dettaglio dello storico.
7. **Promemoria**: con il pranzo già segnato non parte nessuna notifica per il pranzo, mentre quella della creatina sì. Poi rinvio di 30 minuti, notifica di prova, procedura guidata con validazione, attiva/disattiva.
8. **Integratori**: validazione, creazione, modifica, eliminazione, rettifica e annullamento di un'assunzione.
9. **Piani**: testo per l'AI con e senza preferenze; CSV non valido bloccato con errori per riga; CSV di esempio con anteprima e consenso; import come bozza (i valori nutrizionali mancanti restano `null`); export; attivazione con conferma; editor della dieta in modalità semplice e avanzata.
10. **Schede**: salva e attiva una nuova versione, con trasferimento dei carichi a corrispondenza esatta; Organizza.
11. **Tu**: peso validato (25 rifiutato, 80,4 accettato), password sotto i 12 caratteri rifiutata, cambio password, installazione, tema, azzeramento, logout, login errato.
12. **Tastiera**: skip link, segnare pasti con Invio e Spazio, foglio aperto e chiuso con Esc.

Gli screenshot sono in `tests/screenshots/<configurazione>/` (21 schermate per configurazione) e li ho guardati. Nelle catture a pagina intera la barra di navigazione e il toast compaiono a metà pagina: è l'effetto della cattura sugli elementi fissi, non un difetto della pagina.

## Bug trovati e corretti
- **Valori persi dopo un errore di validazione**: il form veniva ridisegnato e cancellava quello che avevi scritto (standard digitato, password attuale). Ora l'errore compare dentro il form e i valori restano.
- Giorni della striscia settimanale larghi 32px a 375px: frecce spostate sopra la striscia.
- Link "indietro" e tab dell'editor sotto i 44px.
- Il foglio ON/OFF restava aperto dopo la scelta e copriva la pagina: ora si chiude.
- Il foglio chiuso conservava nel DOM il contenuto precedente.
- Il foglio "Attiva" aperto dopo il salvataggio dall'editor veniva chiuso dal cambio di pagina.
- Sessione su mobile: elenco degli esercizi su 3 righe (ora scorre in orizzontale), pulsanti "Senza peso" e "Salta" spezzati, segnaposto del recupero manuale tagliato.
- Titolo e testo della notifica del peso ripetitivi; "30 giorni" e i valori dei nutrienti che andavano a capo; storico su mobile troppo lungo (ora 10 voci e "Mostra tutti").

## Cosa resta aperto (non testato o non incluso)
- **Notifiche**: funzionano solo a pagina aperta (Notification API, oppure toast se non autorizzate). Il web push è indicato in un commento in `notify()` dentro `app.js`. Nei test le notifiche passano dal toast, perché non concedo il permesso del browser.
- **Swipe** sulle righe dei pasti: è implementato con gli eventi pointer ma **non è coperto dai test**. L'alternativa da tastiera e con un tocco è il cerchio.
- **Contrasto AA**: palette scelta per l'AA, ma **non misurata** con uno strumento automatico.
- **`prefers-reduced-motion`**: la regola CSS c'è, ma non è testata.
- Non inclusi: libreria esercizi e animazioni Flow vere (sostituite da un'animazione SVG dimostrativa), circuiti nell'editor della scheda, download delle animazioni per l'offline, coda offline e sincronizzazione, avviso di aggiornamento PWA, installazione vera (manca il service worker). Il selettore file mostra i testi nella lingua del browser.
- Per i dati della sessione il carico standard (`standardAtStart`) e il peso sollevato (`draftKg`/`actualKg`) usano la stessa separazione del backend. Gli altri dati sono semplificati: per esempio `days` è salvato in modo diverso dallo snapshot del server.
