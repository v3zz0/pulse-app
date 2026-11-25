// Giornata chiusa: pasti tutti mangiati o saltati, integratori presi, allenamento fatto se giorno ON.
export function isDayClosed({ meals, count, skipped, intakes, train, workoutDone }) {
  if (!meals) return false;
  const supplementsDone = intakes.available && !intakes.remaining.length;
  return count + skipped >= meals && supplementsDone && (!train || workoutDone);
}

// ponytail: 25 × 25 frasi autonome combinate = 625 varianti; aggiungere righe allarga la scelta.
const A = [
  "Oggi hai mantenuto la parola data a te stesso.",
  "La costanza di oggi è la forza di domani.",
  "Un giorno fatto bene vale più di cento promesse.",
  "Hai scelto la disciplina anche quando era più facile mollare.",
  "Ogni pasto, ogni serie, ogni scelta: tutto conta.",
  "Non serve essere perfetti, serve esserci. E oggi c'eri.",
  "Hai fatto quello che andava fatto.",
  "Oggi hai votato per la persona che vuoi diventare.",
  "La motivazione va e viene, l'abitudine resta.",
  "Un altro mattone è stato messo al suo posto.",
  "I risultati arrivano a chi non salta i giorni normali.",
  "Hai trasformato un piano in fatti.",
  "Il corpo ascolta quello che fai, non quello che dici.",
  "Oggi la scusa ha perso e tu hai vinto.",
  "Piccoli passi fatti ogni giorno diventano grandi distanze.",
  "La versione migliore di te si costruisce così.",
  "Hai rispettato il piano: questo è allenamento anche per la testa.",
  "Nessuno ti ha obbligato. L'hai scelto tu.",
  "La fatica di oggi è già diventata progresso.",
  "Le giornate come questa fanno la differenza.",
  "Hai dimostrato che la costanza batte il talento.",
  "Il traguardo si avvicina un giorno alla volta.",
  "Oggi hai messo da parte un po' di futuro.",
  "Quello che hai fatto oggi nessuno può togliertelo.",
  "La disciplina è scegliere ciò che vuoi di più, non ciò che vuoi ora.",
];
const B = [
  "Adesso riposa, te lo sei guadagnato.",
  "Domani si riparte, ancora più forti.",
  "Dormi bene: il recupero è parte del lavoro.",
  "Goditi la serata, il lavoro è fatto.",
  "Domani un altro passo, uguale a questo.",
  "Ricarica le batterie, ci aspetta un'altra giornata.",
  "Sii orgoglioso: non è da tutti.",
  "Ora lascia che il corpo faccia la sua parte.",
  "Il resto lo fa il riposo.",
  "Continua così e lo specchio ti darà ragione.",
  "Domattina ripartiamo da qui.",
  "Spegni tutto e recupera.",
  "La strada è giusta, continua a percorrerla.",
  "Domani ripeti, e poi ripeti ancora.",
  "Una giornata alla volta, fino alla meta.",
  "Hai acceso la miccia, domani la teniamo viva.",
  "Il successo è solo questo, ripetuto.",
  "Ora rilassati: oggi hai già vinto.",
  "Respira, sorridi, domani si torna in pista.",
  "Il progresso è silenzioso, ma c'è.",
  "Questa è la strada: non lasciarla.",
  "Domani sarà più facile, perché oggi l'hai fatto.",
  "Tieni il ritmo, il resto verrà.",
  "Un giorno guarderai indietro e ringrazierai questo momento.",
  "Riposa: i muscoli crescono adesso.",
];

export function quoteOfDay(date) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${A[h % A.length]} ${B[Math.floor(h / A.length) % B.length]}`;
}
