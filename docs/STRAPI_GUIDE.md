# Strapi: guida pratica per modificare PULSE

## Come orientarsi

Il backend è JavaScript. Non contiene TypeScript. Il pannello Strapi resta l'unico pannello amministrativo: Vue serve per le azioni quotidiane.

| Cartella/file | Responsabilità |
|---|---|
| `backend/src/api/*/content-types/*/schema.json` | Campi visibili nel Content Manager e schema PostgreSQL |
| `backend/src/api/pulse/routes/pulse.js` | Elenco completo delle API utilizzate dalla Home |
| `backend/src/api/pulse/controllers/pulse.js` | Legge l'utente, valida input e salva giornata, peso e assunzioni |
| `backend/src/pulse/auth.js` | Login con utenti Strapi, cookie HttpOnly, sessioni revocabili e controllo origine |
| `backend/src/pulse/nutrition.js` | Regole pure: scelta alternativa e composizione spesa |
| `backend/src/pulse/import-diet.js` | Estrazione PDF, hash sorgente e costruzione del piano storico |
| `backend/src/pulse/validation.js` | Date, peso, testi e validazioni condivise |
| `backend/scripts/import-nutrition.js` | Import privato esplicito, mai automatico all'avvio |
| `backend/tests` | Test delle regole senza dipendenza dal browser |

## Collezioni nel pannello

- **Piani nutrizionali**: fonte, data, note, proprietario e pasti ON/OFF. Ogni piano importato resta una versione; le giornate conservano una copia dei pasti, quindi modificare il piano non riscrive lo storico.
- **Giornate alimentari**: data, proprietario, modalità, pasti selezionati, spesa e revisione. `uniqueKey` è gestito dal codice: non modificarlo.
- **Preferenze alimentari**: preferito, non gradito o neutro per una specifica opzione.
- **Registro peso**: una pesata per persona e giorno.
- **Integratori**: nome, ingredienti e istruzioni, modificabili dall'admin. Nessuna dose giornaliera consigliata automaticamente.
- **Assunzioni integratori**: dose effettiva dichiarata, ora e fotografia del nome/ingredienti al momento della registrazione.
- **Sessioni private**: infrastruttura login; non inserire o modificare manualmente hash e scadenze.

Il proprietario è un utente **Users & Permissions**, non un amministratore Strapi. Tutte le API personali filtrano il proprietario sul server. I campi `owner` inviati da un client vengono ignorati. Non abilitare rotte generiche Public per queste collezioni.

## Struttura dei pasti

I pasti sono attualmente un campo JSON versionato, per mantenere insieme la fonte e il suo import. Nel Content Manager si modifica un JSON, non ancora un modulo visuale per ogni ingrediente. Per evitare errori, creare una nuova versione di piano e validarla prima di assegnarla. Esempio sintetico:

```json
{
  "ON": [{
    "id": "ON:example",
    "name": "Pasto di esempio",
    "time": "13:00",
    "sourceText": "Testo della fonte",
    "menus": [{
      "title": "Alternativa 1",
      "groups": [{
        "id": "group-example",
        "sourceText": "Riso oppure pasta",
        "options": [
          {"id": "rice-example", "text": "Riso: quantità della fonte", "nutrients": null},
          {"id": "pasta-example", "text": "Pasta: quantità della fonte", "nutrients": null}
        ]
      }]
    }],
    "menuIndex": 0,
    "selections": [0],
    "consumedAt": null
  }],
  "OFF": []
}
```

`menus` sono composizioni alternative del pasto; `groups` sono componenti da combinare; `options` sono scelte alternative all'interno dello stesso gruppo. Non mettere alimenti alternativi in due gruppi distinti: verrebbero consumati insieme. Non modificare gli ID di opzioni già usate senza una nuova versione. `sourceText` consente di confrontare sempre la struttura col PDF.

## Creare il proprio accesso

1. Aprire l'admin locale e creare l'amministratore iniziale se manca.
2. Nel Content Manager, **User** del plugin Users & Permissions, creare l'utente personale: provider `local`, password forte, ruolo Authenticated, Confirmed attivo, Blocked disattivo. La registrazione pubblica resta chiusa.
3. Importare il PDF privato per quell'email usando il comando documentato nel README. Non caricarlo nella Media Library pubblica.
4. Accedere dalla Home con l'email e la password appena configurate. Il logout revoca la sessione nel database, non si limita a chiudere la schermata.

## Modifiche frequenti

- Nuovo campo peso: modificare schema `weight-entry`, validazione e API, poi testare su DB di sviluppo con backup.
- Nuovo integratore: aggiungerlo dalla collezione Integratori indicando proprietario, ingredienti e fonte. Compare automaticamente nell'interfaccia.
- Nuova regola spesa: lavorare su `nutrition.js` e aggiungere un test sintetico. Non aggregare quantità con unità o basi di pesata diverse.
- Nuovo endpoint: aggiungere la rotta e usare sempre il wrapper `guarded`. Non accedere a un record personale soltanto tramite ID.
- Cookie HTTPS: in produzione configurare il proxy e `PUBLIC_ORIGIN` sul dominio reale. Non allentare il controllo origine per far passare un test.

## Verifiche

`npm test` in backend; `npm run build` in entrambi i progetti. Test integrazione: `node tests/phase2-integration.mjs` con fixture isolate, mai credenziali personali. I limiti dell'import e le vulnerabilità residue sono riportati in VALIDATION.md: non considerare un piano storico una prescrizione attuale.

## Schede allenamento — primo incremento fase 3

La collezione **Schede allenamento** contiene owner, hash/versione import, giornate JSON, defaticamento e rapporto. Il parser `backend/src/pulse/import-training.js` legge esclusivamente il PDF verificato: import manuale tramite `backend/scripts/import-training.js`. Non sono esposte rotte REST CRUD generiche.

`days.A/B/C` contiene blocchi ordinati con ID stabili, fase, testo originale, ripetizioni, recupero originale e secondi, note e video candidati. `sets` contiene le singole serie con `standardKg: null`; il circuito conserva tre serie e tre movimenti, non nove serie indipendenti. `cooldown` è comune a ogni giornata, 180 secondi. I video mantengono `reviewRequired: true`: non impostare reviewed senza verificare contenuto e associazione. Le modifiche alle versioni utilizzate dovranno passare da nuove versioni per preservare lo storico; l'esecuzione delle sessioni è ancora da implementare.
