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

`days.A/B/C` contiene blocchi ordinati con ID stabili, fase, testo originale, ripetizioni, recupero originale e secondi, note e video candidati. `sets` contiene le singole serie con `standardKg: null`; il circuito conserva tre serie e tre movimenti, non nove serie indipendenti. `cooldown` è comune a ogni giornata, 180 secondi. I video mantengono `reviewRequired: true`: non impostare reviewed senza verificare contenuto e associazione. Le modifiche alle versioni utilizzate dovranno passare da nuove versioni per preservare lo storico; le sessioni operative conservano snapshot e sono ora implementate.

## Allenamento, storico e promemoria operativi

Le collezioni aggiunte sono **Carichi standard**, **Allenamenti**, **Promemoria**, **Revisioni video**. Nessuna rotta CRUD generica è esposta. Nei carichi standard, mantenere programId/setKey coerenti e usare preferibilmente il comando confermato nell'app per aggiornare anche la revisione. Non cambiare il JSON di sessioni già concluse o i campi tecnici uniqueKey/activeKey/operations. Per cambiare esercizi di un programma usato, creare una nuova versione: le sessioni hanno una copia immutabile della fonte all'avvio.

`backend/src/api/training` contiene API per programma, avvio, operazioni e carichi; `backend/src/pulse/workout.js` applica le invarianti. `backend/src/api/reminders` gestisce configurazione, rinvii, soppressione dopo completamento e riepilogo settimanale; `pulse/reminders.js` gestisce date locali e validazione timezone. Le notifiche sono di sistema tramite service worker mentre la pagina è aperta: non è configurato un servizio push remoto.

Le revisioni video separate dal programma riportano il titolo ufficiale verificato e la base del giudizio: una conferma da metadati non certifica la tecnica del filmato. Le cinque varianti non confermate restano da revisionare; leggere VIDEO_REVIEW.md. Per programmi importati successivamente eseguire la verifica esplicita, non attribuire automaticamente conferme senza controllo.

## Credenziali personali dall’app

L’avatar in alto apre `/account`: l’utente autenticato può cambiare il proprio username e, facoltativamente, la password. `PUT /api/pulse/profile` richiede cookie, origine consentita e password attuale; non accetta un proprietario dal client. Username univoco senza distinzione maiuscole/minuscole (3–64 lettere ASCII, numeri, punti, trattini o underscore). La nuova password richiede almeno 12 caratteri e massimo 72 byte UTF-8 per evitare troncamenti bcrypt. Hash tramite il servizio nativo Strapi, aggiornamento e revoca degli altri accessi PULSE nella stessa transazione. Il cambio del solo username mantiene le sessioni esistenti e l’accesso via email. La modifica richiede connessione; nessuna credenziale viene salvata nella coda offline. Le verifiche della password sono soggette al limite persistente per IP/account.

## Import/export CSV e piani personali

L’utente accede da **Altro → Piani e importazioni**, nelle pagine `/altro/piani` e `/altro/schede`; non occorre modificare manualmente PostgreSQL. Avatar `/account` contiene le preferenze alimentari e gli obiettivi. Guida completa: [CSV_AI_GUIDE.md](CSV_AI_GUIDE.md).

- `backend/src/pulse/csv.js`: parsing UTF-8/BOM/separatori/quote, validazione e serializzazione sicura per fogli elettronici.
- `plan-formats.js`: template sintetici, prompt AI ed export delle strutture correnti/legacy.
- `plans.js` e `active-plan.js`: anteprime firmate, bozze, versioni, attivazione/archiviazione, idempotenza, ownership e trasferimenti carichi.
- `nutrient-totals.js`: totali noti/parziali e provenienza; nessun valore inventato.
- `plan-settings.js`: preferenze private, target e revisioni ottimistiche.
- `api/plans`: soli endpoint custom sotto `/api/pulse/plans/:kind` e `/api/pulse/personal-settings`, con guardia cookie/CSRF/owner. kind = nutrition/training.

GET template/list/detail/export; POST preview/import; PUT sul piano con action activate/archive/review. La preview non scrive; l’import salva solo una bozza e rivalida il file; l’attivazione richiede una conferma separata. Non modificare manualmente identificativi, status o carichi tramite Content Manager durante le sessioni.

`csv-body.js` estende il parser nativo di Strapi soltanto per POST preview/import, autenticando prima del body. Tutte le altre rotte conservano i limiti ordinari; nginx segue lo stesso perimetro. Ricollaudare l’estensione al prossimo upgrade Strapi.

## Schede giornaliere separate in Strapi

**Programmi allenamento** conserva la versione completa originale, unica fonte per carichi, sessioni e CSV. **Schede allenamento** mostra invece una voce per giornata: Scheda A, Scheda B, Scheda C (o gli altri giorni importati), con programma/utente collegati ed esercizi, serie e defaticamento di quella sola giornata. Queste voci sono copie di consultazione protette da modifica diretta, non tre programmi da attivare alternativamente: per correggere una scheda si modifica il programma/CSV; i lifecycle aggiornano automaticamente le copie. In questo modo non vengono scollegati carichi o storico.

I nuovi import creano le voci separate nella stessa transazione. Per i programmi già presenti: `node scripts/split-training-days.js` produce solo un conteggio; dopo backup verificato e autorizzazione usare PULSE_SPLIT_TRAINING_DAYS=1 con `--apply`. La procedura è idempotente e non reimporta PDF o CSV. Non è stata eseguita sulla produzione. In locale il collaudo usa `--synthetic-only`.

Preferiti/non graditi nell’account sono elenchi di chip: scrivere Riso e premere Invio, poi Pollo e Invio; la × rimuove il singolo alimento. I vecchi testi separati da virgole/a-capo vengono letti senza perdita e convertiti in elenchi. Nessun campo tempo per cucinare viene mostrato o incluso nei prompt AI.

## Gestione dalla PWA: schede e integratori

Allenati → Organizza schede modifica solo displaySettings/displayRevision del programma del proprietario. Non rinominare gli ID tecnici A/B/C per cambiare una scritta. Le preview dei piani mostrano i carichi effettivi della versione; importazione e attivazione restano due conferme distinte.

Home/Altro → I miei integratori permette creazione, modifica, archiviazione, pianificazione e registrazioni con rettifiche. I modelli esistenti sono estesi e supplement-day conserva solo gli override ON/OFF specifici. Non cancellare manualmente record per annullare un’assunzione: usare la rettifica, che conserva snapshot e audit. I promemoria associati agli slot si modificano dal prodotto, senza duplicarne gli UUID. Guida completa: TRAINING_SUPPLEMENTS.md; player opzionale con flowId esplicito: FLOW_DATASET.md.
