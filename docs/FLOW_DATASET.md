# Flow: installazione e player per associazioni esplicite

Release fissata in backend/flow.lock.json: **961bb2739015da373daa43b960c28ee839fe93e6** del [repository ufficiale](https://github.com/ozansozuozgit/flow-exercise-dataset/tree/961bb2739015da373daa43b960c28ee839fe93e6). L’installatore già presente viene conservato: verifica commit pulito, hash dei metadati/licenze e dei 3.771 SVG, poi scrive una release immutabile con catalogo e checksum degli SVG sanificati. 1.324 esercizi, 1.257 animati, 67 senza animazione. Sono tre SVG con sequenza, non MP4 o GIF.

```sh
git clone https://github.com/ozansozuozgit/flow-exercise-dataset.git /tmp/pulse-flow-source
git -C /tmp/pulse-flow-source checkout 961bb2739015da373daa43b960c28ee839fe93e6
node infra/install-flow.mjs --source /tmp/pulse-flow-source --target storage/flow
```

In locale storage/flow è ignorato da Git e montato in sola lettura nel backend. Per Jenkins impostare **FLOW_STORAGE_PATH** sul percorso assoluto persistente del server, esterno al workspace Jenkins, e installare lì la stessa release prima del deploy. Il container usa FLOW_DATA_PATH=/app/flow. Non copiare migliaia di SVG nell’immagine Docker o nella Media Library Strapi. Se il dataset non è installato, il resto dell’app continua a funzionare e il player segnala media non disponibile.

Il player usa soltanto associazioni esplicite già presenti come flowId stringa di quattro cifre nel blocco o nei movimenti del circuito/serie. Conserva gli zero iniziali. Nessun matching per somiglianza o nuova associazione automatica alle schede personali è stato eseguito da questo intervento. I link YouTube e il loro stato di revisione restano disponibili. Il fixture helper assegna 0025 soltanto a un programma sintetico per testare rendering e cache: non certifica una corrispondenza automatica.

GET autenticato /api/pulse/flow/exercises/:id restituisce metadati e tre URL locali; gli asset sono serviti sotto /flow/assets/revision/id/frame. Percorsi chiusi e hash SHA-256 verificati sul file, sanificazione SVG già applicata e ricontrollata, immagine caricata con img, mai v-html. DTD storico rimosso dall’installatore, nessuna risoluzione XML esterna. Risposte con nosniff e CSP sandbox/default-src none. Il frontend precarica i tre fotogrammi prima del loop, offre pausa/ripresa/ingrandimento e usa il primo fotogramma con prefers-reduced-motion. La sequenza non prescrive il ritmo di esecuzione.

Se una scheda ha flowId espliciti, Scarica animazioni offline scarica soltanto quei media, verifica ogni hash e li mette prima in una cache temporanea. Dopo la verifica copia gli asset immutabili nella cache della release; errore di rete, integrità o quota non produce una falsa conferma di completamento. Mostra avanzamento e byte. Non scarica tutto il dataset, non cancella gli asset della sessione attiva e non forza il refresh. I metadati necessari al player sono conservati in IndexedDB. Il service worker consente nella cache runtime solo il percorso rigoroso dei fotogrammi Flow, mantenendo escluse tutte le altre risposte API, PDF, upload e admin.

Licenze e provenienza: dati/codice MIT, artwork dichiarato CC0 limitatamente ai diritti che i contributori possiedono. Conservare LICENSE, ARTWORK-LICENSE e NOTICE.md installati. La provenienza descrive generazione assistita da AI e vettorializzazione; risultano conservate soltanto 13 prove di prompt delle 1.257 animazioni. Hash e assenza di riferimenti registrati non provano titolarità, correttezza biomeccanica o assenza di diritti di terzi. Nessuna dichiarazione generale di assenza di rischi di copyright.

Questo player non completa il precedente obiettivo di matching italiano/inglese, scelta nel catalogo dalla PWA e report di tutti i 31 blocchi A/B/C: quelle associazioni richiedono un’attività e una revisione dedicate. Nessun esercizio personale viene etichettato come verificato soltanto perché esiste nel catalogo.
