<script setup>
import { onMounted, ref, computed } from "vue";
import SupplementHistory from "./components/SupplementHistory.vue";
import Icon from "./components/Icon.vue";
import { api, send } from "./api";

const products = ref([]), editor = ref(null), editorDialog = ref(null);
const loading = ref(true), busy = ref(false), error = ref(""), message = ref("");
const units = ["g", "mg", "µg", "ml", "capsule", "compresse", "misurini", "porzioni"];
const options = computed(() => [...new Set([...units, editor.value?.unit].filter(Boolean))]);

function doseLabel(product) {
  const doses = [...new Set(product.schedule.map((slot) => slot.dose).filter(Boolean))];
  return doses.join(" / ") || "Da configurare";
}
function open(product) {
  const first = product?.schedule[0];
  const dose = product && product.schedule.every((s) => s.dose === first?.dose)
    ? first?.dose?.match(/^([\d.,]+)\s+(.+)$/) : null;
  editor.value = {
    id: product?.id, revision: product?.revision ?? 0, clientId: crypto.randomUUID(),
    name: product?.name || "", quantity: first?.quantity ?? dose?.[1]?.replace(",", ".") ?? "",
    unit: first?.unit ?? dose?.[2] ?? "", frequency: product?.schedule.length || 1,
    timezone: first?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    slots: product?.schedule.map(({ id, at }) => ({ id, at: at || "" })) || [],
  };
  setFrequency();
  error.value = "";
  editorDialog.value.showModal();
}
function setFrequency() {
  while (editor.value.slots.length < editor.value.frequency)
    editor.value.slots.push({ id: crypto.randomUUID(), at: "" });
}
async function load() {
  products.value = await api("/supplements");
}
onMounted(async () => {
  try { await load(); } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
});
function changed() {
  window.dispatchEvent(new Event("pulse-supplements-changed"));
  window.dispatchEvent(new Event("pulse-reminders-changed"));
}
async function save() {
  if (busy.value) return;
  const e = editor.value;
  busy.value = true;
  error.value = "";
  try {
    const saved = await send(e.id ? "/supplements/" + e.id : "/supplements", {
      confirm: true, daily: true, revision: e.revision, clientId: e.clientId,
      data: {
        name: e.name, quantity: Number(e.quantity), unit: e.unit, timezone: e.timezone,
        slots: e.slots.slice(0, e.frequency),
      },
    }, e.id ? "PUT" : "POST");
    products.value = [...products.value.filter((p) => p.id !== saved.id), saved]
      .sort((a, b) => a.name.localeCompare(b.name));
    editorDialog.value.close();
    message.value = "Integratore salvato.";
    changed();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function remove(product) {
  if (busy.value || !confirm(`Eliminare «${product.name}» dalla pianificazione? Le assunzioni registrate saranno conservate.`))
    return;
  busy.value = true;
  error.value = "";
  try {
    await send("/supplements/" + product.id, {
      action: "delete", confirm: true, revision: product.revision,
    });
    products.value = products.value.filter((p) => p.id !== product.id);
    message.value = "Integratore eliminato dalla pianificazione.";
    changed();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <RouterLink class="page-back" to="/altro">‹ Impostazioni</RouterLink>
  <div class="feature-heading">
    <Icon name="pill" :size="36" />
    <div><h1>I miei integratori</h1><p>Configura quantità, frequenza e orari.</p></div>
  </div>
  <p v-if="error && !editorDialog?.open" role="alert" class="warning">{{ error }}</p>
  <p v-if="message" role="status">{{ message }}</p>
  <p v-if="loading" role="status">Caricamento…</p>
  <p v-else-if="!products.length" class="empty">Aggiungi il tuo primo integratore.</p>
  <div class="feature-list">
    <article v-for="product in products" :key="product.id" class="card feature-card">
      <div class="feature-row">
        <span class="feature-icon"><Icon name="pill" /></span>
        <h2>{{ product.name }}</h2>
        <button class="btn secondary icon-button" :aria-label="'Modifica ' + product.name"
          :disabled="busy" @click="open(product)"><Icon name="edit" /></button>
        <button class="btn secondary danger icon-button" :aria-label="'Elimina ' + product.name"
          :disabled="busy" @click="remove(product)"><Icon name="trash" /></button>
      </div>
      <dl class="feature-facts">
        <div><dt>Quantità per assunzione</dt><dd>{{ doseLabel(product) }}</dd></div>
        <div><dt>Frequenza</dt><dd>{{ product.schedule.length ? product.schedule.length + ' al giorno' : 'Da configurare' }}</dd></div>
        <div v-if="product.schedule.length"><dt>Giorni</dt><dd>Da lunedì a domenica</dd></div>
        <div v-if="product.schedule.some((s) => s.at)">
          <dt>Orari</dt><dd>{{ product.schedule.map((s) => s.at || '—').join(' · ') }}</dd>
        </div>
      </dl>
    </article>
  </div>
  <button class="btn primary wide feature-add" :disabled="busy || loading" @click="open()">
    <Icon name="plus" /> Aggiungi integratore
  </button>
  <SupplementHistory />
  <dialog ref="editorDialog" class="card pulse-dialog" aria-labelledby="supplement-title"
    @cancel.prevent="!busy && editorDialog.close()" @close="editor = null">
    <form v-if="editor" @submit.prevent="save">
      <h2 id="supplement-title">{{ editor.id ? 'Modifica integratore' : 'Aggiungi integratore' }}</h2>
      <label class="fieldlabel">Nome integratore
        <input v-model="editor.name" autofocus class="field" maxlength="160" required />
      </label>
      <div class="field-row">
        <label class="fieldlabel">Quantità per assunzione
          <input v-model="editor.quantity" class="field" type="number" min="0.000001" max="1000000" step="any" inputmode="decimal" required />
        </label>
        <label class="fieldlabel">Unità
          <select v-model="editor.unit" class="field" required>
            <option value="">Scegli unità</option>
            <option v-for="unit in options" :key="unit">{{ unit }}</option>
          </select>
        </label>
      </div>
      <label class="fieldlabel">Assunzioni al giorno
        <select v-model.number="editor.frequency" class="field" @change="setFrequency">
          <option v-for="n in 8" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <p class="note">Ogni giorno, da lunedì a domenica. Gli orari sono facoltativi.</p>
      <div class="field-row feature-times">
        <label v-for="(slot, i) in editor.slots.slice(0, editor.frequency)" :key="slot.id" class="fieldlabel">
          Orario assunzione {{ i + 1 }}<input v-model="slot.at" class="field" type="time" />
        </label>
      </div>
      <p v-if="error" role="alert" class="warning">{{ error }}</p>
      <div class="feature-actions">
        <button type="button" class="btn secondary" :disabled="busy" @click="editorDialog.close()">Annulla</button>
        <button class="btn primary" :disabled="busy">Salva integratore</button>
      </div>
    </form>
  </dialog>
</template>
