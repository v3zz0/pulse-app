# Fase 3 — Allenamento completo e PWA

## Stato

Avviata il 16 novembre 2026, non conclusa. Primo incremento: importatore privato A/B/C e collezione Strapi, senza attivare nell'interfaccia funzioni ancora mancanti. Vue 3 JavaScript, Strapi 5, PostgreSQL, Docker e design PULSE 2.1 restano vincolanti. Allenamento rapido escluso.

## Sequenza e criteri di accettazione

1. **Import fonte**: hash verificato, due pagine, A/B/C con 11/12/8 blocchi e 23/27/25 serie; warm-up, top set, back-off, CED, note integrali, esercizi per gamba. Circuito unico di tre giri con tre movimenti 5+5+5; defaticamento comune di 180 secondi. Recupero `1/2'` con secondi null e revisione richiesta. 29 video candidati da verificare, nessuna associazione inventata. Import esplicito per utente, transazione e idempotenza. **Implementato**, risultati effettivi in VALIDATION.md.
2. **Carichi e sessioni**: collezioni distinte standard-load e workout-session; standard inizialmente null, zero distinto da null. API protette con `guarded`, owner ricavato dalla sessione. Snapshot immutabile del programma e dei carichi all'avvio. Endpoint dedicato per modifica standard con conferma e revisione ottimistica; nessun aggiornamento automatico dalla seduta. Massimo una sessione attiva per owner, UUID stabile e vincolo univoco per retry. Verifica obbligatoria: standard 60, temporaneo 50, serie senza peso, nuova sessione ancora 60.
3. **Esecuzione completa**: stati pending/recorded/unlogged/skipped per ogni serie; kg effettivi ammessi solo per recorded. Ripetizioni effettive opzionali anche a CED. Salto singolo o intero blocco; conclusione esplicita solo dopo gestione delle serie pendenti. Peso precedente solo da risultati recorded. Sessioni concluse immutabili.
4. **Timer e ripresa**: endAt server persistito, pausa con remaining, ripartenza esplicita; recuperi ambigui manuali senza durata inventata. Salvataggio per modifica, bozza e coda IndexedDB per owner e UUID. Backend autorevole con revisioni; conflitti visibili, nessuna sovrascrittura silenziosa. Retry idempotenti anche se una risposta si perde. Banner Riprendi prima del prossimo pasto. Logout elimina dati locali della sessione e impedisce sync verso un altro account. Test reload, chiusura, offline, riconnessione, due tab e doppio retry.
5. **Storico e grafici**: sessioni concluse con snapshot, serie saltate/senza peso distinte; grafici solo su kg effettivamente registrati. Riepilogo settimanale da consumi, peso e sessioni reali; nessuna stima automatica di massa muscolare o volume per serie senza kg.
6. **PWA e promemoria**: manifest, icone, service worker per shell e asset; API personali e PDF mai nella cache pubblica. Bozze private in IndexedDB. Installazione verificata in contesto sicuro; UI distingue supporto, consenso e modalità in-app. Reminder persistenti per owner/timezone con rinvio 15/30/60, soppressione dopo azione completata. Push reale solo con sottoscrizione, chiavi private server e scheduler collaudato; in assenza di supporto non dichiarare notifiche in background disponibili.

## Collaudo finale ancora necessario

Due utenti sintetici: anonimo, ownership su lettura/scrittura/relazioni, CSRF, revisioni, sessione revocata, retry, unicità sessione attiva. Browser 360/390/1440 px con avvio completo, salto, CED, timer e refresh/offline. Riavvio reale PostgreSQL/Strapi senza rigenerare fixture: sessione e timestamp conservati. Build e test frontend/backend, audit compatibile. Backup prima di migrazioni; nessun deploy pubblico. Aggiornare VALIDATION.md con esiti reali per ogni incremento e commit su main.
