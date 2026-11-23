// Dati SINTETICI del prototipo PULSE. Nessun dato personale o sanitario reale.
// Forma allineata alle API reali (/days, /nutrition, /training, /supplements, /reminders, /weights)
// per semplificare il porting nell'app Vue. Le date sono relative al primo avvio.
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shift = (base, days) => { const d = new Date(base); d.setDate(d.getDate() + days); return d; };
  const N = (kcal, protein_g, carbs_g, fat_g) => ({ kcal, protein_g, carbs_g, fat_g });
  const opt = (id, text, quantity, unit, nutrition = null) => ({ id, text, quantity, unit, nutrition });

  const colazione = {
    key: "colazione", name: "Colazione", time: "07:30", sourceText: "Yogurt oppure latte + avena oppure fette biscottate",
    menus: [{ title: "Pasto principale", notes: "", groups: [
      { options: [opt("o-yog", "Yogurt greco 0%", 170, "g", N(100, 17, 6, 0)), opt("o-latte", "Latte parzialmente scremato", 200, "ml", N(92, 6.6, 9.8, 3.2))] },
      { options: [opt("o-avena", "Fiocchi d'avena", 40, "g", N(150, 5.4, 24, 2.8)), opt("o-fette", "Fette biscottate integrali", 4, "pz")] },
    ] }],
  };
  const spuntino = {
    key: "spuntino", name: "Spuntino", time: "10:30", sourceText: "Frutta di stagione",
    menus: [{ title: "Pasto principale", notes: "", groups: [
      { options: [opt("o-mela", "Mela", 150, "g", N(78, 0.4, 21, 0.3)), opt("o-banana", "Banana", 100, "g", N(89, 1.1, 23, 0.3))] },
    ] }],
  };
  const pranzoOn = {
    key: "pranzo", name: "Pranzo", time: "13:00", sourceText: "Cereale + proteina + verdura, oppure piatto unico",
    menus: [
      { title: "Pasto principale", notes: "Peso a crudo.", groups: [
        { options: [opt("o-riso", "Riso basmati", 80, "g", N(285, 6, 63, 0.7)), opt("o-pasta", "Pasta integrale", 80, "g", N(270, 10.5, 52, 2))] },
        { options: [opt("o-pollo", "Petto di pollo", 150, "g", N(165, 35, 0, 2)), opt("o-tonno", "Tonno al naturale", 120, "g", N(124, 28, 0, 1.2))] },
        { options: [opt("o-verd", "Verdure di stagione", 200, "g"), opt("o-insal", "Insalata mista", 150, "g")] },
      ] },
      { title: "Piatto unico", notes: "", groups: [
        { options: [opt("o-farro", "Insalata di farro e legumi", 250, "g")] },
      ] },
    ],
  };
  const pranzoOff = JSON.parse(JSON.stringify(pranzoOn));
  pranzoOff.menus[0].groups[0] = { options: [opt("o-pane", "Pane integrale", 40, "g", N(98, 3.5, 17, 1.3)), opt("o-gallette", "Gallette di riso", 3, "pz")] };
  const merenda = {
    key: "merenda", name: "Merenda", time: "16:30", sourceText: "Frutta secca",
    menus: [{ title: "Pasto principale", notes: "", groups: [
      { options: [opt("o-mand", "Mandorle", 20, "g", N(116, 4.2, 4, 10)), opt("o-noci", "Noci", 20, "g", N(131, 3, 2.8, 13))] },
    ] }],
  };
  const cenaOn = {
    key: "cena", name: "Cena", time: "20:00", sourceText: "Pesce + patate oppure pane + verdure",
    menus: [{ title: "Pasto principale", notes: "", groups: [
      { options: [opt("o-salm", "Salmone", 150, "g", N(312, 30, 0, 21)), opt("o-merl", "Merluzzo", 200, "g", N(164, 36, 0, 1.4))] },
      { options: [opt("o-pat", "Patate", 200, "g", N(154, 4, 34, 0.2)), opt("o-pane2", "Pane integrale", 60, "g", N(147, 5.3, 25, 2))] },
      { options: [opt("o-verd2", "Verdure grigliate", 200, "g")] },
    ] }],
  };
  const cenaOff = JSON.parse(JSON.stringify(cenaOn));
  cenaOff.menus[0].groups.splice(1, 1);

  const nutritionPlan = {
    id: "np-1", title: "Piano demo autunno", description: "Piano sintetico per il prototipo", status: "active",
    provenance: "csv", version: 2, versionLabel: "v2", createdAt: iso(shift(new Date(), -20)),
    notes: "Alimenti pesati a crudo salvo indicazioni.\nBere almeno 1,5 l di acqua al giorno.\nPiano sintetico: verificare con il professionista.",
    days: { ON: [colazione, spuntino, pranzoOn, merenda, cenaOn], OFF: [colazione, spuntino, pranzoOff, cenaOff] },
  };
  const oldPlan = JSON.parse(JSON.stringify(nutritionPlan));
  Object.assign(oldPlan, { id: "np-0", title: "Piano demo estate", status: "archived", version: 1, versionLabel: "v1", createdAt: iso(shift(new Date(), -80)) });

  const S = (id, reps, extra = {}) => ({ id, reps, kind: "work", perLeg: false, ...extra });
  const B = (id, name, anim, restSeconds, sets, extra = {}) => ({ id, name, anim, phase: "main", restSeconds, restRaw: restSeconds + " s", notes: "", sets, ...extra });
  const program = {
    id: "tp-1", title: "Scheda demo A/B/C", status: "active", provenance: "manual", version: 1, createdAt: iso(shift(new Date(), -40)),
    displaySettings: { days: {
      A: { name: "A · Spinta", description: "Petto, spalle, tricipiti", weekdays: [1] },
      B: { name: "B · Tirata", description: "Dorso e bicipiti", weekdays: [3] },
      C: { name: "C · Gambe", description: "Quadricipiti, femorali, glutei", weekdays: [5] },
    } },
    days: {
      A: [
        B("A1", "Panca piana", "press", 90, [S("A1-1", "12", { kind: "warmup" }), S("A1-2", "8"), S("A1-3", "8"), S("A1-4", "8")], { notes: "Scapole addotte, discesa controllata." }),
        B("A2", "Lento avanti manubri", "press", 75, [S("A2-1", "10"), S("A2-2", "10"), S("A2-3", "10")]),
        B("A3", "Push-down al cavo", "curl", 60, [S("A3-1", "10-12", { repMin: 10, repMax: 12 }), S("A3-2", "10-12", { repMin: 10, repMax: 12 }), S("A3-3", "10-12", { repMin: 10, repMax: 12 })]),
      ],
      B: [
        B("B1", "Rematore bilanciere", "row", 90, [S("B1-1", "10"), S("B1-2", "10"), S("B1-3", "10"), S("B1-4", "10")]),
        B("B2", "Lat machine", "row", 75, [S("B2-1", "10-12", { repMin: 10, repMax: 12 }), S("B2-2", "10-12", { repMin: 10, repMax: 12 }), S("B2-3", "10-12", { repMin: 10, repMax: 12 })]),
        B("B3", "Curl manubri", "curl", 60, [S("B3-1", "12"), S("B3-2", "12"), S("B3-3", "12")]),
      ],
      C: [
        B("C1", "Squat", "squat", 120, [S("C1-1", "10", { kind: "warmup" }), S("C1-2", "8"), S("C1-3", "8"), S("C1-4", "8")], { notes: "Profondità fino al parallelo." }),
        B("C2", "Affondi manubri", "squat", 75, [S("C2-1", "10", { perLeg: true }), S("C2-2", "10", { perLeg: true }), S("C2-3", "10", { perLeg: true })]),
        B("C3", "Leg curl", "curl", 60, [S("C3-1", "12"), S("C3-2", "12"), S("C3-3", "12")]),
      ],
    },
    cooldown: { name: "Defaticamento", seconds: 300, sourceText: "5 minuti di cyclette leggera e allungamento." },
  };
  const standard = { "A1-1": 30, "A1-2": 50, "A1-3": 50, "A1-4": 50, "A2-1": 14, "A2-2": 14, "A2-3": 14, "A3-1": 20, "A3-2": 20, "A3-3": 20,
    "B1-1": 40, "B1-2": 40, "B1-3": 40, "B1-4": 40, "B2-1": 45, "B2-2": 45, "B2-3": 45, "B3-1": 10, "B3-2": 10, "B3-3": 10,
    "C1-1": 40, "C1-2": 70, "C1-3": 70, "C1-4": 70, "C2-1": 12, "C2-2": 12, "C2-3": 12, "C3-1": null, "C3-2": null, "C3-3": null };

  window.PULSE_SEED = function seed(now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const standardLoads = {};
    for (const [k, v] of Object.entries(standard)) standardLoads["tp-1:" + k] = v;
    // Storico sintetico: sedute concluse negli ultimi 60 giorni nei giorni di allenamento.
    const history = [];
    for (let i = 60; i >= 1; i--) {
      const d = shift(today, -i), wd = d.getDay();
      const key = { 1: "A", 3: "B", 5: "C" }[wd];
      if (!key || i % 11 === 0) continue;
      const progress = Math.floor((60 - i) / 14) * 2.5;
      const blocks = program.days[key].map((b) => ({ id: b.id, name: b.name, phase: b.phase, sets: b.sets.map((s) => {
        const std = standard[s.id];
        const kg = std == null ? null : Math.max(0, std - 5 + progress);
        return { id: s.id, reps: s.reps, standardAtStart: std, actualKg: kg, actualReps: parseInt(s.reps, 10), status: kg == null ? "unlogged" : "recorded" };
      }) }));
      const completedAt = new Date(d); completedAt.setHours(18, 45);
      history.push({ clientId: "h-" + i, status: "completed", day: key, completedAt: completedAt.toISOString(), snapshot: { title: program.displaySettings.days[key].name, blocks } });
    }
    const weights = [];
    for (let i = 63; i >= 1; i -= 3) weights.push({ day: iso(shift(today, -i)), kg: Math.round((79.6 - (63 - i) * 0.035 + ((i * 7) % 5) * 0.08) * 10) / 10 });
    const days = {};
    for (let i = 7; i >= 1; i--) {
      const d = iso(shift(today, -i));
      days[d] = { planId: "np-1", revision: 1, override: null, meals: { colazione: { consumedAt: d + "T07:40:00" }, spuntino: { consumedAt: i % 3 ? d + "T10:40:00" : null }, pranzo: { consumedAt: d + "T13:10:00" }, merenda: { consumedAt: null }, cena: { consumedAt: i % 2 ? d + "T20:10:00" : null } }, shopping: {} };
    }
    return {
      v: 1,
      auth: { loggedIn: false, username: "atleta.demo", email: "atleta@example.test", password: "demo-pulse-2026" },
      settings: { theme: "auto", trainingDays: [1, 3, 5], preferences: { liked: ["salmone", "riso"], disliked: ["fegato"] }, goals: { kcal: 2200, protein_g: 140, carbs_g: 250, fat_g: 70 } },
      nutritionPlans: [nutritionPlan, oldPlan],
      trainingPrograms: [program],
      standardLoads,
      days,
      favorites: { "o-salm": true },
      session: null,
      history,
      weights,
      supplements: [
        { id: "s-d3", name: "Vitamina D3", quantity: 1, unit: "capsula", mode: "always", weekdays: [0, 1, 2, 3, 4, 5, 6], active: true, schedule: [{ id: "sl-d3", at: "08:00" }] },
        { id: "s-crea", name: "Creatina", quantity: 3, unit: "g", mode: "ON", weekdays: [0, 1, 2, 3, 4, 5, 6], active: true, schedule: [{ id: "sl-crea", at: "13:00" }] },
        { id: "s-mg", name: "Magnesio", quantity: 300, unit: "mg", mode: "always", weekdays: [1, 2, 3, 4, 5], active: true, schedule: [{ id: "sl-mg", at: "22:00" }] },
      ],
      intakes: [1, 2, 3].map((i) => ({ id: "in-" + i, productId: "s-d3", slotId: "sl-d3", day: iso(shift(today, -i)), dose: 1, unit: "capsula", status: "taken", takenAt: iso(shift(today, -i)) + "T08:05:00" })),
      reminders: [
        { id: "r-pranzo", settings: { kind: "meal", target: "pranzo", label: "", at: "12:50", weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true, timezone: "Europe/Rome" } },
        { id: "r-crea", settings: { kind: "supplement", target: "s-crea:sl-crea", label: "", at: "13:00", weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true, timezone: "Europe/Rome" } },
        { id: "r-gym", settings: { kind: "workout", target: "", label: "", at: "18:00", weekdays: [1, 3, 5], enabled: true, timezone: "Europe/Rome" } },
        { id: "r-peso", settings: { kind: "weight", target: "", label: "", at: "07:00", weekdays: [1], enabled: true, timezone: "Europe/Rome" } },
        { id: "r-borsa", settings: { kind: "custom", target: "", label: "Prepara la borsa", at: "21:00", weekdays: [0, 2, 4], enabled: false, timezone: "Europe/Rome" } },
      ],
      reminderState: {},
    };
  };
})();
