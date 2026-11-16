<script setup>
import { ref, onMounted, onUnmounted } from "vue";
const install = ref(null),
  installed = ref(matchMedia("(display-mode: standalone)").matches),
  status = ref("");
function offer(e) {
  e.preventDefault();
  install.value = e;
}
function done() {
  installed.value = true;
  install.value = null;
}
async function start() {
  await install.value.prompt();
  const choice = await install.value.userChoice;
  status.value =
    choice.outcome === "accepted"
      ? "Installazione richiesta."
      : "Installazione rimandata.";
  install.value = null;
}
onMounted(() => {
  window.addEventListener("beforeinstallprompt", offer);
  window.addEventListener("appinstalled", done);
});
onUnmounted(() => {
  window.removeEventListener("beforeinstallprompt", offer);
  window.removeEventListener("appinstalled", done);
});
</script>
<template>
  <section class="card workout-block">
    <h2>Installa PULSE</h2>
    <p v-if="installed">PULSE è aperta come app installata.</p>
    <template v-else
      ><button v-if="install" class="btn primary" @click="start">
        Installa PULSE
      </button>
      <p v-else class="smallmuted">
        Su Chrome Android: menu ⋮ → Aggiungi a schermata Home → Installa. Su
        desktop: icona Installa nella barra degli indirizzi o menu del browser.
        L’opzione appare quando il browser supporta l’installazione e l’app è
        servita da HTTPS o localhost.
      </p></template
    >
    <p v-if="status" role="status">{{ status }}</p>
    <p class="source-note">
      La scheda di allenamento già aperta si riprende offline su questo
      dispositivo. Primo accesso, avvio della sessione e cambi ai carichi
      standard richiedono connessione. Su un telefono localhost indica il
      telefono stesso: l’accesso a questo PC richiederà un’origine HTTPS
      privata, da configurare nella fase server.
    </p>
  </section>
</template>
