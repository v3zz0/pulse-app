# Verifica associazioni video — 16 novembre 2026

Consultati i metadati ufficiali YouTube oEmbed dei **24 video unici**, tutti con risposta HTTP 200 al momento del controllo. Sono le 29 annotazioni già importate, senza link nuovi. Il confronto riguarda il titolo e l'esercizio candidato della riga fonte; non costituisce visione integrale dei filmati né certificazione della tecnica, dell'inclinazione o delle istruzioni del trainer.

**19 video unici / 24 annotazioni** hanno un titolo coerente con il movimento candidato: panca piana, croci manubri, dip, V-up, in and outs, stacco, rematore Smith supino, spider curl, around the world, Russian twist, squat, RDL, bulgaro Multipower, polpacci Multipower, overhead press e i tre movimenti del circuito, defaticamento. L'app indica «associazione confermata dal titolo ufficiale», con base e nota di revisione consultabili nel record Strapi. L'import originale non è stato ripetuto o modificato; le sessioni già avviate conservano i video e gli stati di revisione dello snapshot iniziale.

## Restano da revisionare

| Associazione candidata | Motivo |
|---|---|
| Spinte manubri panca 30 | Titolo generico sulle spinte, inclinazione non confermata |
| Estensione tricipite BB EZ | Titolo «BB Incline Tricep Extension», nota fonte a terra/deadstop: possibile discrepanza |
| Shrugs | Titolo generico sui trapezi, variante non confermata |
| Curl BB EZ | Titolo sul confronto tra bilancieri, tutorial specifico non confermato |
| Wrist curl | Titolo «Dumbbell Wrist Extension Curl», possibile variante opposta |

Le cinque associazioni conservano `reviewRequired=true`. Nessun video è stato assegnato a dip zavorrati, trazioni, push-up presa stretta o reverse wrist curl in assenza di una riga LINK. La riga DIP del PDF ha invece un LINK, già presente nell'import originale: l'annotazione è conservata.

Il rapporto dettagliato privato contiene ID, titolo, esito HTTP e motivo. `backend/scripts/review-training-videos.js /private/video-review.json` registra tale verifica nella collezione **Revisioni video**, separata dal programma, usando i proprietari già assegnati. Non inserire il rapporto personale negli asset frontend o nei seed delle immagini. Per i nuovi utenti importati successivamente, eseguire la revisione esplicita oppure confermare nel pannello Strapi; senza record di revisione i link restano da verificare.
