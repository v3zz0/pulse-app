<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api, send } from "../api";

const route = useRoute();
const panel = ref(null), rows = ref([]), date = ref("");
const busy = ref(false), error = ref(""), loaded = ref(false);
const edit = ref(null), dose = ref("");
const states = { taken: "Assunta", skipped: "Saltata", cancelled: "Annullata" };
async function load() {
  const range = date.value ? "?from=" + date.value + "&to=" + date.value : "";
  rows.value = await api("/supplements/history" + range);
  loaded.value = true;
}
async function run(fn) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try { await fn(); } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
function save(row, status) {
  if (status === "cancelled" && !confirm("Annullare questa registrazione?")) return;
  return run(async () => {
    await send("/intakes/" + row.day, {
      productId: row.productId, slot: row.slot, revision: row.revision, confirm: true, status,
      ...(status === "taken" ? { dose: dose.value || null, takenAt: row.takenAt } : {}),
    });
    edit.value = null;
    await load();
    window.dispatchEvent(new Event("pulse-supplements-changed"));
    window.dispatchEvent(new Event("pulse-reminders-changed"));
  });
}
onMounted(() => {
  if (route.hash === "#storico") panel.value.open = true;
});
</script>

<template>
  <details id="storico" ref="panel" class="card workout-block" @toggle="panel?.open && run(load)">
    <summary>Storico assunzioni</summary>
    <label class="fieldlabel">Filtra per giorno
      <input v-model="date" class="field" type="date" @change="run(load)" />
    </label>
    <p v-if="error" class="warning" role="alert">{{ error }}</p>
    <p v-if="busy" class="note">Caricamento…</p>
    <p v-else-if="loaded && !rows.length" class="note">Nessuna assunzione registrata.</p>
    <article v-for="row in rows" :key="row.id" class="intake-slot">
      <strong>{{ row.name }}</strong>
      <p class="note">{{ row.day }} · {{ row.plannedSnapshot?.at || "Senza orario" }} · {{ states[row.status] }}
        <template v-if="row.dose"> · {{ row.dose }}</template>
      </p>
      <form v-if="edit === row.id" @submit.prevent="save(row, 'taken')">
        <label class="fieldlabel">Quantità assunta <input v-model="dose" class="field" maxlength="100" /></label>
        <div class="btnrow">
          <button class="btn primary" :disabled="busy">Salva rettifica</button>
          <button class="btn secondary" type="button" @click="edit = null">Torna indietro</button>
        </div>
      </form>
      <div v-else-if="row.status !== 'cancelled'" class="btnrow">
        <button v-if="row.status === 'taken'" class="btn secondary" :disabled="busy"
          @click="edit = row.id; dose = row.dose || ''">Rettifica quantità</button>
        <button class="btn secondary" :disabled="busy" @click="save(row, 'cancelled')">Annulla registrazione</button>
      </div>
    </article>
  </details>
</template>
