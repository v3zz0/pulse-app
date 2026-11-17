# Animazioni Flow in Allenati

## Catalogo e revisione

PULSE usa la revisione **961bb2739015da373daa43b960c28ee839fe93e6** del [repository Flow Exercise Dataset](https://github.com/ozansozuozgit/flow-exercise-dataset/tree/961bb2739015da373daa43b960c28ee839fe93e6), fissata in `backend/flow.lock.json`. Il catalogo contiene 1.324 esercizi, 1.257 animazioni a tre SVG e 67 voci con sole istruzioni. L’installatore verifica SHA-256 di dati, licenze e 3.771 fotogrammi, sanifica gli SVG e salva il catalogo con gli hash dei file sanificati. Una seconda esecuzione confronta integralmente catalogo, licenze e fotogrammi installati con la sorgente. La release esistente rimane immutabile.

I dati sono MIT. PULSE serve solo gli SVG Flow con dichiarazione CC0-1.0 nei metadati e nel record di provenienza. Il pacchetto conserva LICENSE, ARTWORK-LICENSE e NOTICE.md. La dedica CC0 riguarda i diritti detenuti dagli autori, come specificato dalle fonti. Le illustrazioni risultano generate con AI e vettorializzate. Per 13 delle 1.257 animazioni sono conservati i prompt originali. Questa evidenza documenta la licenza dichiarata e il materiale della revisione fissata. Eventuali diritti di terzi e la correttezza biomeccanica richiedono valutazioni proprie.

## Associazioni

Allenati applica le associazioni alle schede esistenti al momento della lettura. Per gli alias verificati il resolver controlla il nome Flow esatto e l’attrezzatura rispetto alla revisione installata. Il match testuale generico serve alla ricerca e alle proposte. Per esempio, le spinte da 30° non ricevono l’animazione da 45°. Pause, carichi e prescrizioni rimangono nei dati della scheda.

Dai dettagli dell’esercizio scegliere **Cambia animazione**, cercare nel catalogo per nome, ID, attrezzo o muscolo, aprire l’anteprima e confermare. I movimenti di un circuito hanno chiavi separate. L’opzione **Rimuovi animazione** registra una scelta esplicita che prevale sulle associazioni automatiche. Le modifiche vanno nel campo JSON nullable `flowAssociations` di `training-program`. Il server verifica proprietario, programma, chiave di blocco o movimento, revisione della scelta e presenza di fotogrammi con licenza ammessa. Gli aggiornamenti passano per il lock esistente del proprietario.

Le nuove versioni CSV della stessa famiglia copiano le scelte quando riferimento tecnico, blocco, nome, note e movimento coincidono. La scelta è vincolata alla revisione del dataset. Un cambio di revisione richiede la conferma dell’ID nel catalogo aggiornato. Il JSON della scheda, gli export, i carichi e gli snapshot delle sessioni concluse non vengono riscritti.

Se Flow è associato, il player è la prima visualizzazione nei dettagli. Supporta loop, pausa, ripresa, ingrandimento e movimento ridotto. Per i movimenti senza animazione viene indicata l’assenza. Gli URL originali restano nei dati sorgente e negli export CSV, esclusi dalla visualizzazione di Allenati e dalle anteprime dei piani.

## Installazione e persistenza

Dalla directory di PULSE, con Node.js 24 e Git disponibili:

```sh
git clone https://github.com/ozansozuozgit/flow-exercise-dataset.git /tmp/pulse-flow-source
git -C /tmp/pulse-flow-source checkout --detach 961bb2739015da373daa43b960c28ee839fe93e6
node infra/install-flow.mjs --source /tmp/pulse-flow-source --target storage/flow
```

Il Compose locale monta `storage/flow` in `/app/flow`. In produzione il percorso raccomandato è `/srv/pulse/flow`, su storage persistente esterno al workspace Jenkins. Eseguire il comando d’installazione con `--target /srv/pulse/flow` sul nodo Docker oppure copiare la directory della stessa revisione già verificata, inclusi catalogo, asset e licenze. Quindi rieseguire l’installatore sul percorso di destinazione per il controllo d’integrità. Il servizio Strapi usa l’utente `node` e deve poter leggere i file e attraversare le directory. Se necessario, dare accesso di lettura e attraversamento alle directory della release prima dell’avvio. La credenziale Jenkins `pulse-env` deve contenere `FLOW_STORAGE_PATH=/srv/pulse/flow`. Compose monta il percorso in sola lettura come `/app/flow`; `FLOW_DATA_PATH` punta a questo mount. Gli asset restano fuori dalle immagini Docker, dal repository PULSE e dalla Media Library.

Per aggiornare il catalogo, revisionare compatibilità e licenze, aggiornare il lock in codice e preparare una nuova directory di revisione accanto a quella in uso. Verificare con la stessa procedura prima di avviare Strapi aggiornato. Conservare la release precedente per il rollback. Le scelte personali rientrano nel backup PostgreSQL. Conservare anche la directory Flow o una copia verificata della sorgente fissata e dei file di licenza per ricostruirla.

## API e offline

- `GET /api/pulse/flow/search` ricerca le animazioni riutilizzabili.
- `GET /api/pulse/flow/exercises/:id` restituisce metadati, sequenza e hash.
- `GET /api/pulse/flow/assets/:revision/:id/:frame` restituisce gli SVG dopo verifica di percorso, hash e sanificazione, con CSP sandbox e nosniff.
- `PUT /api/pulse/training/flow` salva le scelte con isolamento per utente.

**Scarica animazioni offline** usa solo gli ID della scheda aperta o della sessione corrente. Verifica SHA-256, mostra avanzamento e byte e usa Cache Storage con una cache per revisione. IndexedDB conserva i metadati. Il browser riproduce i fotogrammi già scaricati quando la rete manca. Il normale aggiornamento della PWA usa risorse con hash e una nuova cache della shell, che entra in uso quando si chiudono tutte le finestre di PULSE e si riapre l’app. Prima della chiusura, verificare la sincronizzazione dell’allenamento.

Per Jenkins vedere [DEPLOYMENT.md](../DEPLOYMENT.md#rilascio-delle-associazioni-flow).
