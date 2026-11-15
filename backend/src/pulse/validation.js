"use strict";
// Validation shared by HTTP controllers and tests. Never trust IDs from the browser.
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T12:00:00Z")) ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail("Data non valida");
  return value;
}
function text(value, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail("Testo non valido");
  return value.trim();
}
function mode(value) {
  if (!["ON", "OFF"].includes(value)) fail("Giorno ON/OFF non valido");
  return value;
}
function kg(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 30 ||
    value > 250
  )
    fail("Peso non valido");
  return value;
}
function notFuture(value) {
  date(value);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (value > today) fail("Non puoi registrare azioni future");
  return value;
}
module.exports = { fail, date, text, mode, kg, notFuture };
