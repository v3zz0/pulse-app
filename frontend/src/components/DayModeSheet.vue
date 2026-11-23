<template>
  <button type="button" class="mode-chip" :aria-label="`Giorno ${day.mode}, ${day.isAuto ? 'automatico' : 'scelto a mano'}: cambia`" @click="dialog.showModal()">
    Giorno <b :class="day.mode">{{ day.mode }}</b> · {{ day.isAuto ? "automatico" : "manuale" }}
  </button>
  <dialog ref="dialog" class="card pulse-dialog" aria-labelledby="mode-title">
    <div class="sheet-head">
      <h2 id="mode-title">Giorno di {{ label }}</h2>
      <button type="button" class="sheet-close" aria-label="Chiudi" @click="dialog.close()">×</button>
    </div>
    <p>
      In automatico il giorno è <b>ON</b> nei tuoi giorni di allenamento e <b>OFF</b> negli altri.
      <template v-if="day.autoMode">Per questa data in automatico: <b>{{ day.autoMode }}</b>.</template>
    </p>
    <p v-if="blocked" class="warning">Ci sono pasti già consumati: annullali prima di cambiare ON/OFF.</p>
    <div class="seg" role="group" aria-label="Tipo di giorno">
      <button v-for="m in ['ON', 'OFF']" :key="m" type="button" :aria-pressed="day.mode === m" :disabled="blocked || day.busy" @click="choose(m)">Giorno {{ m }}</button>
    </div>
    <div class="rowbtns" style="margin-top: 14px">
      <button v-if="!day.isAuto" type="button" class="btn secondary" :disabled="blocked || day.busy" @click="choose('auto')">Torna all'automatico</button>
      <RouterLink class="btn ghost" to="/account#giorni-allenamento" @click="dialog.close()">Giorni di allenamento</RouterLink>
    </div>
    <p v-if="day.error" class="warning" role="alert">{{ day.error }}</p>
  </dialog>
</template>
<script setup>
import { ref, computed } from "vue";
import { useDay } from "../stores/day.js";
import { notify } from "../ui.js";
const day = useDay(), dialog = ref(null);
const blocked = computed(() => day.meals.some((m) => m.consumedAt));
const label = computed(() => new Date(day.date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
async function choose(mode) {
  if (await day.setMode(mode)) {
    dialog.value.close();
    notify(mode === "auto" ? "Tornato all'automatico" : `Giorno ${mode} solo per questa data`);
  }
}
</script>
