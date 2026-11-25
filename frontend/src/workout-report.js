const fmt = (n) => String(n).replace(".", ",");

// Dati puri del report: carico di scheda (standardAtStart) e peso sollevato (actualKg) restano distinti.
export function reportModel(session, title) {
  const blocks = session.snapshot.blocks;
  const sets = blocks.flatMap((b) => b.sets);
  const done = sets.filter((s) => s.status === "recorded");
  // Sessione chiusa offline: ricava gli orari dalle serie se mancano.
  const times = sets.map((s) => s.completedAt).filter(Boolean).sort();
  const started = session.startedAt || session.createdAt || times[0] || new Date().toISOString();
  const completed = session.completedAt || times.at(-1) || started;
  const min = Math.round((new Date(completed) - new Date(started)) / 60000);
  return {
    title,
    started,
    completed,
    kpis: [
      [min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}'` : `${min}'`, "Durata"],
      [String(blocks.length), "Esercizi"],
      [`${done.length}/${sets.length}`, "Serie fatte"],
      [`${done.reduce((n, s) => n + s.actualKg * s.actualReps, 0).toLocaleString("it-IT")} kg`, "Volume"],
    ],
    exercises: blocks.map((b) => {
      const std = b.sets[0]?.standardAtStart;
      return {
        name: b.name,
        target: `Obiettivo ${b.sets.length}×${b.sets[0]?.reps ?? "?"}${std != null ? ` · carico ${fmt(std)} kg` : ""}`,
        note: b.sets.map((s) => s.note).filter(Boolean).join(" · "),
        rows: b.sets.map((s, i) => [String(i + 1), s.actualReps == null ? "–" : String(s.actualReps), s.actualKg == null ? "–" : `${fmt(s.actualKg)} kg`, ...delta(s)]),
      };
    }),
  };
}

// [testo, tono]: tono "up" | "down" | ""
export function delta(s) {
  const p = s.previous;
  if (!p || s.actualKg == null || s.actualReps == null) return ["", ""];
  if (s.actualKg !== p.kg) { const d = s.actualKg - p.kg; return [`${d > 0 ? "+" : "-"}${fmt(Math.abs(d))} kg`, d > 0 ? "up" : "down"]; }
  if (s.actualReps !== p.reps) { const d = s.actualReps - p.reps; return [`${d > 0 ? "+" : "-"}${Math.abs(d)} rip`, d > 0 ? "up" : "down"]; }
  return ["=", ""];
}

export async function shareReport(session, title) {
  const { jsPDF } = await import("jspdf");
  const m = reportModel(session, title), doc = new jsPDF({ unit: "mm", format: "a4" });
  const day = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(m.started));
  const time = (d) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  // Intestazione scura
  doc.setFillColor(22, 22, 26).rect(0, 0, 210, 62, "F");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(198, 255, 61).text("PULSE · REPORT ALLENAMENTO", 14, 14);
  doc.setFontSize(20).setTextColor(255).text(m.title, 14, 25);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(180).text(`${day} · ${time(m.started)} – ${time(m.completed)}`, 14, 32);
  m.kpis.forEach(([v, l], i) => {
    const x = 14 + i * 46;
    doc.setFillColor(44, 44, 50).roundedRect(x, 38, 42, 17, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(198, 255, 61).text(v, x + 4, 46);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(170).text(l.toUpperCase(), x + 4, 52);
  });
  let y = 72;
  const cols = [18, 50, 95, 145], heads = ["Serie", "Ripetizioni", "Peso sollevato", "vs ultima volta"];
  for (const ex of m.exercises) {
    const h = 18 + ex.rows.length * 6 + (ex.note ? 8 : 0);
    if (y + h > 282) { doc.addPage(); y = 16; } // ponytail: niente spezzatura di un esercizio tra pagine
    doc.setDrawColor(228, 228, 234).roundedRect(12, y, 186, h, 2, 2, "S");
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(22).text(ex.name || "Esercizio", 16, y + 7);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110).text(ex.target, 194, y + 7, { align: "right" });
    doc.setFontSize(7).setTextColor(140);
    heads.forEach((t, i) => doc.text(t.toUpperCase(), cols[i], y + 13));
    ex.rows.forEach((r, j) => {
      const ry = y + 19 + j * 6;
      doc.setFontSize(9).setTextColor(22);
      r.slice(0, 3).forEach((t, i) => doc.text(t, cols[i], ry));
      doc.setTextColor(...(r[4] === "up" ? [19, 138, 54] : r[4] === "down" ? [192, 57, 43] : [22, 22, 26])).text(r[3], cols[3], ry);
    });
    if (ex.note) doc.setFontSize(8).setTextColor(90).text(`Nota: ${ex.note}`, 16, y + h - 4, { maxWidth: 178 });
    y += h + 5;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) doc.setPage(i).setFontSize(7).setTextColor(150).text("Generato da Pulse", 14, 290);
  const name = `pulse-${m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${m.started.slice(0, 10)}.pdf`;
  const file = new File([doc.output("blob")], name, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: m.title }); } catch (e) { if (e.name !== "AbortError") throw e; }
  } else doc.save(name);
}
