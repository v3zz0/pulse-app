import { reactive } from "vue";
// Toast globale con azione "Annulla" opzionale.
export const toast = reactive({ message: "", undo: null, show: false });
let timer;
export function notify(message, undo = null) {
  Object.assign(toast, { message, undo, show: true });
  clearTimeout(timer);
  timer = setTimeout(() => (toast.show = false), undo ? 5000 : 3500);
}
export async function runUndo() {
  const undo = toast.undo;
  Object.assign(toast, { undo: null, show: false });
  if (undo) await undo();
}
// Tema: preferenza del dispositivo, non dell'account.
const THEME_KEY = "pulse-theme";
export const theme = reactive({ value: localStorage.getItem(THEME_KEY) || "auto" });
const media = matchMedia("(prefers-color-scheme: dark)");
export function applyTheme() {
  const t = theme.value === "auto" ? (media.matches ? "dark" : "light") : theme.value;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#1b1715" : "#f6f1e8");
}
export function setTheme(value) {
  theme.value = value;
  localStorage.setItem(THEME_KEY, value);
  applyTheme();
}
media.addEventListener?.("change", applyTheme);
