// Exact aliases reviewed against the pinned catalogue and the illustrated movement.
// A suggestion is never persisted or displayed as the selected animation.
const reviewed = [
  [["panca piana bb", "panca piana bilanciere", "barbell bench press"], "0025", "barbell bench press", "barbell"],
  [["croci coi manubri", "croci con manubri", "croci manubri", "dumbbell fly"], "0308", "dumbbell fly", "dumbbell"],
  [["push up presa stretta", "close grip push up"], "0259", "close-grip push-up", "body weight"],
  [["v ups", "v up", "jackknife sit up"], "0507", "jackknife sit-up", "body weight"],
  [["rematore multipower presa supina", "smith reverse grip bent over row"], "1361", "smith reverse grip bent over row", "smith machine"],
  [["curl bb ez", "curl bilanciere ez", "ez barbell curl"], "0447", "ez barbell curl", "ez barbell"],
  [["rdl bb", "stacco rumeno bilanciere", "barbell romanian deadlift"], "0085", "barbell romanian deadlift", "barbell"],
];

const uncertain = {
  "spinte manubri panca 30": { reason: "Il catalogo propone 45°, la scheda indica 30°." },
  dip: { ids: ["0251", "0814"], reason: "Verifica l'enfasi su petto o tricipiti." },
  "dip zavorrati": { reason: "Le varianti zavorrate corrispondenti hanno solo istruzioni." },
  "estensione tricipite bb ez": { reason: "La scheda richiede un dead stop a terra con barra EZ; le varianti EZ illustrate usano una panca." },
  "in and outs": { reason: "Nessuna animazione equivalente verificata nel catalogo." },
  trazioni: { ids: ["0652", "0651", "0674"], reason: "La presa non è specificata." },
  "trazioni zavorrate": { reason: "La variante zavorrata ha solo istruzioni." },
  stacco: { ids: ["0032", "0117"], reason: "La posizione dei piedi non è specificata." },
  srugs: { ids: ["0095", "0406", "0767"], reason: "L'attrezzo non è specificato." },
  "spider curl": { reason: "La scheda indica i manubri; le varianti Spider con manubri illustrate hanno presa inversa." },
  "wirst curl": { ids: ["1412", "0401"], reason: "Attrezzo e appoggio dell'avambraccio da verificare." },
  "reverse wirst curl": { ids: ["1411", "0385"], reason: "Attrezzo e appoggio dell'avambraccio da verificare." },
  "around the world": { reason: "Nessuna animazione verificata per la variante addominale." },
  "russian twist": { reason: "La scheda richiede un peso; le varianti zavorrate hanno solo istruzioni." },
  squat: { ids: ["0043", "0770"], reason: "Verifica se usi bilanciere libero o Multipower." },
  "bulgarian squat al multipower": { ids: ["0768"], reason: "Verifica l'uso del bilanciere guidato: la candidata indica anche l'uso della barra come appoggio." },
  "polpacci al multipower": { reason: "La variante illustrata in piedi non documenta lo step richiesto dalla scheda." },
  "military press": { ids: ["1456", "1457", "0774"], reason: "Verifica l'attrezzo e la larghezza della presa." },
  "alzate frontali": { ids: ["0310", "0041", "0162"], reason: "L'attrezzo del movimento non è specificato." },
  "alzate laterali": { ids: ["0334", "0178", "0584"], reason: "L'attrezzo del movimento non è specificato." },
  "lento avanti": { ids: ["0426", "0091", "0774"], reason: "Verifica attrezzo e posizione, in piedi o seduta." },
};
module.exports = { reviewed, uncertain };
