import { ref } from "vue";

const standalone = matchMedia("(display-mode: standalone)");
export const installed = ref(standalone.matches || navigator.standalone === true);
export const installPrompt = ref(null);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt.value = event;
});
window.addEventListener("appinstalled", () => {
  installed.value = true;
  installPrompt.value = null;
});
standalone.addEventListener("change", (event) => {
  if (event.matches) installed.value = true;
});
