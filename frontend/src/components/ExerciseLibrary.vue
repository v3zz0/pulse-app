<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api, send } from "../api";
import FlowPicker from "./FlowPicker.vue";
import FlowPlayer from "./FlowPlayer.vue";
const emit = defineEmits(["select", "close"]);
const dialog = ref(null),
  tab = ref("flow");
const local = ref([]),
  catalog = ref(null),
  selected = ref(null),
  linkFlow = ref(false);
const detail = ref(null);
const query = ref(""),
  muscle = ref(""),
  equipment = ref("");
const busy = ref(false),
  loading = ref(false),
  error = ref("");
const form = ref({
  requestId: crypto.randomUUID(),
  name: "",
  muscle: "",
  equipment: "",
  description: "",
  notes: "",
  flowId: null,
});
let request;
const facets = computed(() =>
  tab.value === "flow"
    ? catalog.value || {}
    : {
        equipment: [
          ...new Set(local.value.map((item) => item.equipment)),
        ].sort(),
        muscles: [...new Set(local.value.map((item) => item.muscle))].sort(),
      },
);
const items = computed(() =>
  tab.value === "flow"
    ? catalog.value?.items || []
    : local.value.filter(
        (x) =>
          (!equipment.value || x.equipment === equipment.value) &&
          (!muscle.value || x.muscle === muscle.value) &&
          x.name.toLowerCase().includes(query.value.trim().toLowerCase()),
      ),
);
async function search(offset = 0) {
  if (tab.value !== "flow") return;
  request?.abort();
  const controller = new AbortController();
  request = controller;
  error.value = "";
  loading.value = true;
  try {
    catalog.value = await api(
      "/flow/search?" +
        new URLSearchParams({
          all: "1",
          q: query.value.trim(),
          equipment: equipment.value,
          muscle: muscle.value,
          offset,
        }),
      { signal: controller.signal },
    );
  } catch (e) {
    if (!controller.signal.aborted) error.value = e.message;
  } finally {
    if (request === controller) loading.value = false;
  }
}
function changeTab(value) {
  tab.value = value;
  selected.value = detail.value = null;
  error.value = "";
  query.value = muscle.value = equipment.value = "";
  if (value === "flow") search();
}
async function inspect(item) {
  selected.value = item;
  detail.value = null;
  if (tab.value !== "flow") return;
  try {
    const response = await api("/flow/exercises/" + item.id);
    if (selected.value === item) detail.value = response;
  } catch (e) {
    if (selected.value === item) error.value = e.message;
  }
}
function add(item = selected.value) {
  if (!item) return;
  const isFlow = tab.value === "flow";
  emit("select", {
    ...(isFlow
      ? { catalogueId: item.id, flowId: item.hasAnimation ? item.id : null }
      : { libraryId: item.id, flowId: item.flowId }),
    name: item.name,
    notes: item.notes || "",
  });
  dialog.value.close();
}
async function create() {
  if (busy.value) return;
  busy.value = true;
  try {
    const item = await send("/exercise-library", form.value, "POST");
    add(item);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  dialog.value.showModal();
  search();
  try {
    local.value = await api("/exercise-library");
  } catch (e) {
    if (tab.value === "private") error.value = e.message;
  }
});
onUnmounted(() => request?.abort());
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="card pulse-dialog editor-library"
      aria-labelledby="exercise-library-title"
      @close="emit('close')"
      @cancel.prevent="!busy && dialog.close()"
    >
      <h2 id="exercise-library-title">Libreria esercizi</h2>
      <div class="editor-actions">
        <button
          v-for="[id, title] in [
            ['flow', 'Catalogo Flow'],
            ['private', 'I miei esercizi'],
            ['new', 'Crea personalizzato'],
          ]"
          :key="id"
          type="button"
          class="btn secondary"
          :class="{ 'is-selected': tab === id }"
          :aria-pressed="tab === id"
          @click="changeTab(id)"
        >
          {{ title }}
        </button>
      </div>
      <form v-if="tab === 'new'" class="editor-fields" @submit.prevent="create">
        <label class="fieldlabel"
          >Nome esercizio<input
            v-model="form.name"
            class="field"
            required
            maxlength="160"
        /></label>
        <div class="editor-grid">
          <label class="fieldlabel"
            >Gruppo muscolare<input
              v-model="form.muscle"
              class="field"
              required
              maxlength="80"
          /></label>
          <label class="fieldlabel"
            >Attrezzatura<input
              v-model="form.equipment"
              class="field"
              required
              maxlength="80"
          /></label>
        </div>
        <label class="fieldlabel"
          >Descrizione<input
            v-model="form.description"
            class="field"
            maxlength="300"
        /></label>
        <label class="fieldlabel"
          >Note<textarea v-model="form.notes" class="field" maxlength="1600" />
        </label>
        <div class="editor-actions">
          <button type="button" class="btn secondary" @click="linkFlow = true">
            {{ form.flowId ? "Cambia animazione" : "Associa animazione Flow" }}
          </button>
          <button class="btn primary" :disabled="busy">Salva e aggiungi</button>
        </div>
        <p v-if="form.flowId" class="note">Animazione Flow {{ form.flowId }}</p>
      </form>
      <template v-else>
        <form class="editor-fields" @submit.prevent="search()">
          <label class="fieldlabel"
            >Cerca esercizio
            <input
              v-model="query"
              type="search"
              class="field"
              maxlength="100"
            />
          </label>
          <div class="editor-grid">
            <label class="fieldlabel"
              >Muscolo
              <select v-model="muscle" class="field" @change="search()">
                <option value="">Tutti</option>
                <option v-for="m in facets.muscles" :key="m">{{ m }}</option>
              </select>
            </label>
            <label class="fieldlabel"
              >Attrezzatura
              <select v-model="equipment" class="field" @change="search()">
                <option value="">Tutte</option>
                <option v-for="e in facets.equipment" :key="e">{{ e }}</option>
              </select>
            </label>
          </div>
          <button
            v-if="tab === 'flow'"
            class="btn secondary"
            :disabled="loading"
          >
            Cerca
          </button>
        </form>
        <div class="editor-results" aria-label="Risultati esercizi">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="editor-result"
            :aria-pressed="selected?.id === item.id"
            @click="inspect(item)"
          >
            <strong>{{ item.name }}</strong
            ><small>{{ item.muscle }} · {{ item.equipment }}</small>
          </button>
        </div>
        <p v-if="!items.length && !loading && !error" class="note">
          Nessun esercizio trovato.
        </p>
        <button
          v-if="tab === 'flow' && catalog?.next != null"
          type="button"
          class="btn secondary"
          :disabled="loading"
          @click="search(catalog.next)"
        >
          Altri risultati
        </button>
        <section
          v-if="selected"
          class="editor-selection"
          aria-label="Dettagli esercizio"
        >
          <h3>{{ selected.name }}</h3>
          <p class="note">{{ selected.muscle }} · {{ selected.equipment }}</p>
          <p v-if="detail?.bodyPart" class="note">
            {{ detail.bodyPart
            }}<template v-if="detail.secondaryMuscles?.length">
              · {{ detail.secondaryMuscles.join(", ") }}</template
            >
          </p>
          <p v-if="selected.description" class="note">
            {{ selected.description }}
          </p>
          <FlowPlayer
            v-if="selected.flowId || selected.hasAnimation"
            :id="selected.flowId || selected.id"
            :key="selected.id"
          />
          <p v-else class="note">Animazione non disponibile</p>
          <button type="button" class="btn primary wide" @click="add()">
            Aggiungi alla scheda
          </button>
        </section>
      </template>
      <p v-if="error" class="warning" role="alert">{{ error }}</p>
      <button
        type="button"
        class="btn ghost"
        :disabled="busy"
        @click="dialog.close()"
      >
        Chiudi libreria
      </button>
      <FlowPicker
        v-if="linkFlow"
        :target="{
          name: form.name || 'Esercizio personalizzato',
          flowId: form.flowId,
        }"
        :save="(id) => (form.flowId = id)"
        @close="linkFlow = false"
      />
    </dialog>
  </Teleport>
</template>
