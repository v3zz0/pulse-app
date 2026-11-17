"use strict";
const { fail, text } = require("./validation");
function validateLayout(data, days) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Organizzazione non valida");
  try {
    new Intl.DateTimeFormat("it", { timeZone: data.timezone }).format();
  } catch {
    fail("Fuso orario non valido");
  }
  if (typeof data.timezone !== "string" || data.timezone.length > 100)
    fail("Fuso orario non valido");
  if (!data.days || typeof data.days !== "object" || Array.isArray(data.days))
    fail("Schede non valide");
  if (Object.keys(data.days).some((d) => !Object.hasOwn(days, d)))
    fail("Riferimento scheda inesistente");
  const result = { timezone: data.timezone, days: {} };
  for (const day of Object.keys(days)) {
    const s = data.days[day];
    if (
      !s ||
      !Array.isArray(s.weekdays) ||
      s.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)
    )
      fail("Giorni non validi");
    result.days[day] = {
      name: text(s.name, 60),
      weekdays: [...new Set(s.weekdays)].sort(),
    };
  }
  return result;
}
module.exports = { validateLayout };
