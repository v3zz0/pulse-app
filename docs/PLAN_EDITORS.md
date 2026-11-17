# Editor dei piani e dashboard Progressi

## Allenati

Apri **Allenati → Crea nuova scheda**. Una scheda contiene una o più giornate, ognuna con il proprio nome, i giorni associati e gli esercizi ordinati. Il catalogo Flow permette di cercare per nome, muscolo e attrezzatura. Seleziona il risultato per vedere i dettagli e la sua animazione quando disponibile. Gli esercizi personali hanno una libreria separata per utente e possono essere riutilizzati in più schede.

Ogni serie ha il proprio obiettivo, tipo e carico. Un campo carico vuoto indica uno standard da impostare. Lo zero è un valore esplicito. Per circuiti e superset, configura separatamente le ripetizioni dei movimenti. Le serie dello stesso blocco condividono l’ordine e l’identità dei movimenti. Il blocco può avere un recupero e la scheda può avere un defaticamento. Usa la maniglia per riordinare gli esercizi per trascinamento oppure le frecce **Sposta su** e **Sposta giù**.

**Salva scheda** salva il programma. **Attiva scheda** lo rende disponibile per nuove sedute. Per vedere, modificare, duplicare, eliminare o esportare un piano, usa **Gestisci schede**. Una copia ha propri identificativi per blocchi e serie, copia i carichi standard correnti e può riutilizzare gli stessi esercizi di libreria. L’eliminazione richiede conferma. Una scheda con sessione in corso si può modificare e si può eliminare dopo aver concluso o annullato la sessione. Le sedute già avviate o concluse conservano lo snapshot usato all’avvio.

Gli URL esterni importati restano riferimenti negli export delle schede quando presenti nei dati sorgente. L’interfaccia continua a mostrare le animazioni Flow e le relative alternative di catalogo.

## Dieta

Apri **Dieta → Crea nuova dieta**. La modalità giornaliera applica la stessa giornata tipo a tutti i giorni selezionati. La modalità settimanale offre pasti distinti per ciascun giorno selezionato. Gli altri giorni restano senza pasti programmati. I piani importati con ON/OFF mantengono quella modalità.

Un pasto può avere un orario, note, un menu principale e menu alternativi. Ogni alimento ha una quantità e un’unità e può avere sostituzioni nello stesso gruppo. L’app mostra la scelta attuale e usa le alternative scelte per la spesa. I dati nutrizionali importati vengono conservati quando compatibili con l’alimento modificato. Le voci manuali senza valori restano prive di dati nutrizionali.

Le giornate già preparate conservano i propri pasti. Per una giornata senza pasti consumati si può applicare esplicitamente il piano attivo aggiornato. Usa **Gestisci piani** per modificare, duplicare, eliminare e attivare i programmi salvati. L’esportazione di un piano settimanale in CSV v1 richiede una giornata, con il primo giorno configurato come proposta iniziale. Il file contiene quella giornata come template ON/OFF. Il calendario completo resta salvato in PULSE.

## Progressi

Il filtro 30 giorni, 90 giorni, un anno o tutto lo storico si applica ai grafici. L’ultima pesata e la variazione si riferiscono alle due misurazioni più recenti. La frequenza settimanale parte dal lunedì e il calendario e i conteggi usano la data locale del dispositivo. Le sessioni completate sono deduplicate per identificativo. La progressione mostra il carico effettivo massimo per esercizio e seduta e le ripetizioni della serie che l’ha prodotto. Gli esercizi di catalogo e personali usano le rispettive identità. Le sessioni storiche prive di quell’identità sono raggruppate per il nome salvato, mantenendo le varianti con nomi diversi.

## API e PostgreSQL

Tutte le rotte sotto `/api/pulse` usano la sessione PULSE e i controlli di proprietà applicativi.

| Metodo e percorso | Uso |
| --- | --- |
| `POST /plans/:kind/editor` | Crea con `requestId` e dati completi |
| `GET /plans/:kind/:id/editor` | Recupera editor e revisione corrente |
| `PUT /plans/:kind/:id/editor` | Salva con `requestId` e revisione attesa |
| `POST /plans/:kind/:id/duplicate` | Crea una copia privata con lo stesso `requestId` sui retry |
| `POST /plans/:kind/:id/remove` | Rimozione logica con conferma esplicita |
| `GET, POST /exercise-library` | Elenca e crea esercizi personali |
| `GET /flow/search?all=1` | Include nel catalogo gli esercizi senza animazione |
| `GET /plans/nutrition/:id/export?day=1` | Esporta il lunedì di un piano settimanale in CSV v1 |

`kind` è `training` o `nutrition`. Attivazione, lavoro in corso, storico, peso e operazioni CSV usano le API esistenti. Le modifiche ai piani usano i lock PostgreSQL già adottati per utente e tipo. Un aggiornamento con revisione obsoleta viene respinto con 409. Il browser mantiene le modifiche dell’editor in memoria fino al comando di salvataggio. Gli strumenti offline esistenti delle sedute continuano a usare IndexedDB.

Al primo avvio Strapi estende lo schema aggiungendo il campo JSON nullable `editor` ai piani di dieta e allenamento, il campo nullable `planEditRevision` alle giornate alimentari, lo stato `deleted` ai piani e la collezione privata `pulse_exercise_library`. I carichi e gli snapshot rimangono nelle tabelle esistenti. Vedi i prerequisiti per Jenkins e PostgreSQL. [Rilascio degli editor e di Progressi](../DEPLOYMENT.md#rilascio-degli-editor-e-di-progressi)

## Ipotesi per il futuro Account Coach

Mantenere un proprietario per ciascun piano, esercizio, sessione e misurazione. Un futuro collegamento Coach–utente dovrebbe rappresentare un invito accettato con permessi espliciti e revocabili, distinti per assegnazione e lettura dei dati personali. Le operazioni delegate dovrebbero registrare autore e destinatario e riusare gli stessi servizi di dominio. L’assegnazione di una scheda dovrebbe creare una copia controllata per il destinatario con provenienza registrata. La revoca del collegamento deve conservare i dati dell’utente. Per la dieta vanno confermati i requisiti professionali, la base giuridica, le autorizzazioni e le modalità di audit prima di definire l’accesso.
