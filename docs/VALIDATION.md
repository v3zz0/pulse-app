# Validazione fase 1 — 15 novembre 2026

## Verifiche completate

- Letto prompt originale e analizzati HTML e due PDF (7+2 pagine), incluse 29 annotazioni URL. Fonti invariate; inventario hash e associazioni candidate conservati, contenuto video non verificato.
- Installazione con lockfile npm separati. Node host 24.22.1; Strapi 5.62.0; Vite 7.3.8. Build frontend e admin Strapi riuscite; build Docker dei due componenti riuscite con trust CA tramite secret BuildKit.
- `cd frontend && npm test`: 1 test passato (consumo esplicito, annullamento, separazione ON/OFF e fallback alternativa).
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: 6 test passati, 0 saltati. Due scenari a 360×800, 390×844, 1440×1000: ordine prossimo pasto/lista, consumo/annullamento, ricarica, sostituzione, ON/OFF, dialog Escape, routing e deep link. Nessun errore JavaScript rilevato nello scenario Home; nessun overflow orizzontale. Screenshot mobile ispezionato. Non è un confronto pixel automatico con la demo.
- Dump PostgreSQL ripristinato in database temporaneo separato: 43 tabelle public, nessun errore pg_restore; database temporaneo eliminato. Questo verifica lo schema iniziale Strapi, non dati personali o backup upload.

- `docker compose up -d --no-build --wait`: postgres, strapi e frontend healthy; porte soltanto loopback.
- `node tests/smoke.mjs`: PASS per frontend, deep link, health Strapi 204, admin 200, registrazione disabilitata (400 e messaggio esatto), accesso anonimo `/api/users/me` 403 anche attraverso proxy. Il test iniziale attendeva 403 per registrazione: corretto a 400 dopo verifica della risposta ApplicationError di Strapi.
- Ricreazione dei container frontend/Strapi con volume PostgreSQL mantenuto: avvio e smoke test riusciti. Nessun utente sintetico creato dal test della registrazione chiusa.

## Problemi risolti durante i controlli

- npm e Strapi non potevano scrivere nella home cloud: cache sotto /tmp e XDG_CONFIG_HOME=/tmp/pulse-config.
- Download Playwright Chromium negato con HTTP 403: usato Chromium già installato, senza alterare i controlli.
- Build Docker con trust predefinito non completava npm: `infra/build-cloud.sh` monta la CA di sessione esclusivamente durante npm ci con strict SSL. Nessuna disattivazione TLS o certificato copiato nell'immagine.
- La rete esclusivamente interna impediva il publishing delle porte: frontend/Strapi ora hanno rete edge, PostgreSQL resta soltanto nella rete privata. Healthcheck wget forza accesso locale senza proxy.

## Limiti e verifiche successive

- Home dimostrativa locale; nessuna persistenza utente tramite API, login utente finale o import completo ancora implementati. Registrazione admin iniziale manuale; login admin interattivo non testato.
- Allenamenti, carichi standard/temporanei, ripresa IndexedDB, preferenze, domani, integratori, peso, lista spesa, notifiche e PWA sono successive fasi, non test dichiarati superati.
- HTTPS su dominio pubblico, deploy remoto, restore upload e migrazioni applicative non eseguiti.
- `npm audit --omit=dev`: frontend 0; backend 34 segnalazioni (23 high, 9 moderate, 2 low, 0 critical), incluse dipendenze transitive Strapi. I suggerimenti automatici includono downgrade a Strapi 4, incompatibili col requisito: non applicati. Serve revisione degli advisory e aggiornamento compatibile prima di produzione. Conteggi in `dependency-audit.json`.
