# PULSE su Chrome Android — collaudo manuale prima del go-live

**Non eseguito su dispositivo fisico in questa attività.** Test automatici Chromium a360/390px non equivalgono a una prova Android. Compilare dispositivo, versione Android/Chrome, data, esito e note mantenendo privati screenshot e dati personali.

## Origine e installazione

- [ ] I due DNS `.it` risolvono al server corretto. Chrome apre `https://pulse.vezzo.vp360web.it` senza avvisi di certificato, redirect inattesi o porte alternative.
- [ ] Frontend sul dominio PULSE, admin separato su `https://apipulse.vezzo.vp360web.it/admin`, protetto per IP/VPN. Non installare l'admin come app personale.
- [ ] Menu Chrome → Aggiungi a schermata Home → Installa; nome **PULSE**, icona P/battito, splash scuro, nessuna copia di PDF negli asset. In alternativa usare l'icona di installazione proposta dal browser.
- [ ] Aprendo dalla Home Android appare come finestra standalone, corretta safe area, tastiera e navigazione inferiore; nessun overflow con caratteri grandi/rotazione.

## Accesso e nutrizione

- [ ] Login personale, chiusura e riapertura ancora autenticata; logout rimuove accesso e bozze locali. Nessun account admin usato nel frontend.
- [ ] Prossimo pasto prima della lista, Mangiato/annullamento, sostituzioni e preferenze.
- [ ] ON/OFF, domani, spesa e spunte, peso, dose/orario integratori persistono dopo ricarica.
- [ ] Dieta storica e quantità ambigue mantengono le note; non è stata sostituita da una nuova prescrizione.

## Allenamento e offline

- [ ] Avvio scheda completa A/B/C, nessuna modalità rapida; note, circuito, CED, recupero panca ambiguo e defaticamento visibili.
- [ ] Impostare esplicitamente uno standard sintetico/proprio appropriato; verifica60 → temporaneo50 → completamento senza peso → sessione successiva ancora60. L'eseguito della serie senza peso rimane non registrato e non incrementa falsamente volume/carico.
- [ ] Completamento con peso/ripetizioni, salto serie/esercizio, timer automatico; pausa/ripresa, cambio schermata e schermo bloccato: al ritorno il tempo è calcolato dal timestamp.
- [ ] Con una sessione avviata online, modalità aereo: modifica serie, messaggio bozza sul dispositivo/invio in attesa. Chiudere completamente la finestra PWA e riaprirla offline: sessione/serie ancora presenti.
- [ ] Riattivare rete: la coda si svuota e resta una sola sessione, senza registrazioni duplicate. Conflitto da altro dispositivo: nessuna sovrascrittura silenziosa, esportazione bozza e scelta esplicita della versione server.
- [ ] Conclusione, storico, grafici peso/carichi, volume parziale per pesi/ripetizioni mancanti corretti.

## Aggiornamenti e notifiche

- [ ] Nuova release disponibile con allenamento aperto: nessun reload forzato; sincronizzare, chiudere **tutte** le finestre/schede PULSE, riaprire e controllare versione e sessione conservata.
- [ ] Promemoria pasto/integratore/allenamento con timezone e giorni corretti; rinvia15/30/60, chiusura giornaliera e disattivazione.
- [ ] Consenso notifiche negato: fallback in-app e spiegazione chiara; consenso concesso: notifica di sistema reale, tap apre PULSE. Nessun dettaglio alimentare/sanitario nel testo della notifica.
- [ ] Dopo consumo/assunzione/avvio allenamento niente promemoria ridondante. Verificare anche dopo cambio giorno/ora legale se rilevante.
- [ ] Comprendere e comunicare il limite: avvisi mentre app aperta e connessa; Android può sospenderla. Nessuna consegna garantita a pagina chiusa o push remoto attivo.

Prima del test con un account personale, completare le prove con un utente sintetico nel server di collaudo privato. Non condividere cookie, password o screenshot con dati sanitari nei report pubblici.
