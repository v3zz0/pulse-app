<script setup>
import { ref } from "vue";
import Icon from "./components/Icon.vue";
import { installed, installPrompt } from "./pwa-install";
const dialog = ref(null), status = ref("");
const ua = navigator.userAgent;
const appleMobile = /iPhone|iPad|iPod/.test(ua) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
async function start() {
  const prompt = installPrompt.value;
  installPrompt.value = null;
  try {
    await prompt.prompt();
    status.value = (await prompt.userChoice).outcome === "accepted"
      ? "Installazione richiesta." : "Installazione rimandata.";
  } catch {
    status.value = "Usa il menu del browser per installare PULSE.";
  }
}
</script>

<template>
  <section class="card compact-settings">
    <button class="settings-link" @click="status = ''; dialog.showModal()">
      <Icon name="download" /> <strong>Installa PULSE</strong><Icon name="arrow" />
    </button>
    <dialog ref="dialog" class="card pulse-dialog" aria-labelledby="install-title">
      <h2 id="install-title">Installa PULSE</h2>
      <p v-if="installed">PULSE è già installata su questo dispositivo.</p>
      <button v-else-if="installPrompt" class="btn primary wide" @click="start">
        Installa sul dispositivo
      </button>
      <p v-else-if="appleMobile">
        In Safari, apri il menu Condividi e scegli Aggiungi alla schermata Home.
      </p>
      <p v-else-if="/Android/.test(ua)">
        Apri il menu ⋮ di Chrome e scegli Installa app o Aggiungi a schermata Home.
      </p>
      <p v-else>
        Usa l’icona di installazione nella barra degli indirizzi o cerca
        «Installa PULSE» nel menu di Chrome o Edge.
      </p>
      <p v-if="status" role="status">{{ status }}</p>
      <form method="dialog"><button class="btn secondary wide" autofocus>Chiudi</button></form>
    </dialog>
  </section>
</template>
