<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { api } from "../api";
import FlowPlayer from "./FlowPlayer.vue";

const props = defineProps({ target: { type: Object, required: true }, save: { type: Function, required: true } });
const emit = defineEmits(["close"]);
const dialog = ref(null), results = ref(null), selected = ref(props.target.animation || null);
const query = ref(""), equipment = ref(""), muscle = ref("");
const loading = ref(false), busy = ref(false), error = ref("");
let request;

async function search(offset = 0) {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  error.value = "";
  loading.value = true;
  try {
    const params = new URLSearchParams({
      q: query.value.trim(), equipment: equipment.value, muscle: muscle.value, offset: String(offset),
    });
    const found = await api("/flow/search?" + params, { signal: controller.signal });
    if (request === controller) results.value = found;
  } catch (e) {
    if (!controller.signal.aborted) error.value = e.message;
  } finally {
    if (request === controller) loading.value = false;
  }
}
async function confirm(id) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await props.save(id);
    dialog.value.close();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  dialog.value.showModal();
  search();
});
onUnmounted(() => request?.abort());
</script>

<template>
  <Teleport to="body">
  <dialog ref="dialog" class="card pulse-dialog flow-picker"
    aria-labelledby="flow-picker-title"
    @close="emit('close')" @cancel.prevent="!busy && dialog.close()">
    <h2 id="flow-picker-title">Cambia animazione</h2>
    <p class="note">{{ target.name }}<template v-if="target.reason"> · {{ target.reason }}</template></p>
    <form @submit.prevent="search()">
      <label class="fieldlabel">Cerca nel catalogo
        <input v-model="query" class="field" type="search" maxlength="100"
          placeholder="Nome o ID Flow" autofocus />
      </label>
      <div v-if="results" class="field-row">
        <label class="fieldlabel">Attrezzo
          <select v-model="equipment" class="field">
            <option value="">Tutti</option>
            <option v-for="value in results.equipment" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
        <label class="fieldlabel">Muscolo
          <select v-model="muscle" class="field">
            <option value="">Tutti</option>
            <option v-for="value in results.muscles" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
      </div>
      <button class="btn secondary" :disabled="loading || busy">Cerca</button>
    </form>
    <section v-if="target.candidates?.length" aria-label="Candidate da confermare">
      <p class="note">Candidate da verificare</p>
      <div class="btnrow">
        <button v-for="item in target.candidates" :key="item.id" class="btn secondary"
          :disabled="busy" :aria-pressed="selected?.id === item.id" @click="selected = item">
          {{ item.name }}
        </button>
      </div>
    </section>
    <p v-if="loading" role="status" class="note">Ricerca nel catalogo…</p>
    <p v-if="results && !results.items.length && !loading" class="note">Nessun risultato.</p>
    <ul v-if="results?.items.length" class="flow-results" aria-label="Risultati Flow">
      <li v-for="item in results.items" :key="item.id">
        <button class="flow-result" :aria-pressed="selected?.id === item.id"
          :disabled="busy" @click="selected = item">
          <strong>{{ item.name }}</strong>
          <span>{{ item.id }} · {{ item.equipment }} · {{ item.muscle }}</span>
        </button>
      </li>
    </ul>
    <button v-if="results?.next != null" class="btn secondary"
      :disabled="loading || busy" @click="search(results.next)">
      Prossimi risultati
    </button>
    <section v-if="selected" aria-label="Anteprima animazione">
      <h3>{{ selected.name }}</h3>
      <FlowPlayer :key="selected.id" :id="selected.id" />
    </section>
    <p v-if="error" class="warning" role="alert">{{ error }}</p>
    <div class="feature-actions">
      <button class="btn secondary" :disabled="busy" @click="dialog.close()">Chiudi</button>
      <button v-if="target.flowId" class="btn secondary danger" :disabled="busy"
        @click="confirm(null)">Rimuovi animazione</button>
      <button class="btn primary" :disabled="busy || !selected" @click="confirm(selected.id)">
        Conferma animazione
      </button>
    </div>
  </dialog>
  </Teleport>
</template>

<style scoped>
.flow-results { list-style: none; max-height: 235px; overflow: auto; padding: 0; margin: 12px 0; }
.flow-result {
  width: 100%;
  padding: 10px;
  min-height: 44px;
  text-align: left;
  color: var(--ink);
  background: var(--panel2);
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-bottom: 6px;
  overflow-wrap: anywhere;
}
.flow-result span { display: block; color: var(--muted); font-size: 11px; }
.flow-result[aria-pressed="true"] { border-color: var(--accent); }
</style>
