<script setup>
import { computed, onMounted, ref } from "vue";
import { api, send } from "./api";
import { localDate } from "./stores/day";
import { dayName } from "./workout-display";
import { reminderTypes, reminderDays, reminderFrequency, orderedDays } from "./reminder-display";
import Icon from "./components/Icon.vue";

const rows = ref([]), editor = ref(null), dialog = ref(null), step = ref(1);
const targets = ref([]), loading = ref(true), targetsBusy = ref(false);
const busy = ref(false), error = ref(""), editorError = ref("");
const notification = ref(window.Notification?.permission || "unsupported");
const needsTarget = computed(() => reminderTypes[editor.value?.kind]?.target);
const title = computed(() => ["Tipo di promemoria", "Nome e attività", "Orario e frequenza", "Riepilogo"][step.value - 1]);
const message = ref("");
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function load() {
  rows.value = await api("/reminders");
}
onMounted(async () => {
  try { await load(); } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
});
function notify() {
  window.dispatchEvent(new Event("pulse-reminders-changed"));
  const channel = new BroadcastChannel("pulse-reminders");
  channel.postMessage("refresh");
  channel.close();
}
async function permission() {
  try {
    notification.value = await Notification.requestPermission();
    notify();
  } catch (e) { error.value = e.message; }
}
function open(row) {
  editor.value = {
    id: row?.id || crypto.randomUUID(), revision: row?.revision || 0,
    kind: row?.settings.kind || "custom", target: row?.settings.target || "",
    label: row?.settings.label || "", at: row?.settings.at || "",
    timezone: row?.settings.timezone || deviceZone,
    weekdays: [...(row?.settings.weekdays || orderedDays)],
    enabled: row?.settings.enabled ?? true,
  };
  step.value = 1;
  editorError.value = "";
  dialog.value.showModal();
}
function changeType() {
  editor.value.target = "";
  editor.value.label = "";
}
async function loadTargets() {
  if (!needsTarget.value) return;
  const form = editor.value;
  if (form.kind === "workout") {
    const { program } = await api("/training");
    targets.value = Object.keys(program?.days || {}).map((id) => ({ id, name: dayName(program, id) }));
  } else if (form.kind === "supplement") {
    targets.value = await api("/supplements");
  } else {
    targets.value = (await api("/days/" + localDate())).meals || [];
  }
}
async function next() {
  editorError.value = "";
  const form = editor.value;
  if (step.value === 1) {
    targetsBusy.value = true;
    targets.value = [];
    try { await loadTargets(); }
    catch (e) { editorError.value = e.message; return; }
    finally { targetsBusy.value = false; }
    if (form !== editor.value) return;
  }
  if (step.value === 2 && form.kind === "custom" && !form.label.trim()) {
    editorError.value = "Inserisci il nome del promemoria.";
    return;
  }
  if (step.value === 3 && !form.weekdays.length) {
    editorError.value = "Seleziona almeno un giorno.";
    return;
  }
  step.value++;
}
function label(form) {
  return form.label.trim() || targets.value.find((t) => String(t.id) === form.target)?.name ||
    (form.kind === "weight" ? "Pesarsi" : reminderTypes[form.kind].name);
}
async function save() {
  if (busy.value) return;
  const { id, revision, ...settings } = editor.value;
  busy.value = true;
  editorError.value = "";
  try {
    const saved = await send("/reminders/" + id, { action: "settings", revision, settings });
    rows.value = [...rows.value.filter((r) => r.id !== saved.id), saved];
    dialog.value.close();
    error.value = "";
    message.value = "Promemoria salvato.";
    notify();
  } catch (e) { editorError.value = e.message; }
  finally { busy.value = false; }
}
async function change(row, action) {
  if (busy.value || (action === "delete" && !confirm("Eliminare questo promemoria?"))) return;
  busy.value = true;
  message.value = "";
  error.value = "";
  try {
    const saved = await send("/reminders/" + row.id, {
      action, revision: row.revision, enabled: !row.settings.enabled,
    });
    rows.value = rows.value.flatMap((r) => r.id !== row.id ? [r] : saved ? [saved] : []);
    message.value = action === "delete" ? "Promemoria eliminato." : "Stato aggiornato.";
    notify();
  } catch (e) {
    error.value = e.message;
    if (e.status === 409) await load().catch(() => {});
  } finally { busy.value = false; }
}
</script>

<template>
  <RouterLink class="page-back" to="/altro">‹ Altro</RouterLink>
  <div class="feature-heading">
    <Icon name="bell" :size="36" />
    <div><h1>I miei promemoria</h1><p>Gestisci orari e notifiche.</p></div>
  </div>
  <section class="card feature-card">
    <div class="feature-row">
      <span class="feature-icon"><Icon name="bell" /></span>
      <h2>Notifiche</h2>
      <button v-if="notification === 'default'" class="btn primary" @click="permission">
        Consenti notifiche
      </button>
      <span v-else class="intake-state" :class="{ taken: notification === 'granted' }">
        {{ { granted: 'Autorizzate', denied: 'Bloccate', unsupported: 'Non supportate' }[notification] }}
      </span>
    </div>
    <p class="note">Le notifiche di sistema arrivano mentre PULSE è aperta e connessa.</p>
    <p v-if="notification === 'denied'" class="note">Puoi abilitarle nelle impostazioni del sito nel browser.</p>
  </section>
  <p v-if="error" class="warning" role="alert">{{ error }}</p>
  <p v-if="message" role="status">{{ message }}</p>
  <p v-if="loading" role="status">Caricamento…</p>
  <p v-else-if="!rows.length" class="empty">Non hai ancora configurato promemoria.</p>
  <div class="feature-list reminder-list">
    <article v-for="r in rows" :key="r.id" class="card feature-card"
      :class="{ 'reminder-disabled': !r.settings.enabled }">
      <div class="feature-row">
        <span class="feature-icon"><Icon :name="reminderTypes[r.settings.kind]?.icon || 'bell'" /></span>
        <div class="feature-content">
          <h2>{{ r.settings.label || r.settings.target }}</h2>
          <p class="note">
            {{ reminderTypes[r.settings.kind]?.name }} · {{ r.settings.at }}
            · {{ reminderFrequency(r.settings.weekdays) }}
          </p>
        </div>
        <button type="button" role="switch" class="pulse-switch"
          :aria-label="'Promemoria ' + (r.settings.label || r.settings.target)"
          :aria-checked="r.settings.enabled" :disabled="busy" @click="change(r, 'toggle')">
          <span aria-hidden="true"></span>
        </button>
      </div>
      <div class="feature-actions">
        <span class="note">{{ r.settings.enabled ? 'Attivo' : 'Disattivato' }}</span>
        <button class="btn secondary" :disabled="busy" @click="open(r)"><Icon name="edit" :size="16" /> Modifica</button>
        <button class="btn secondary danger" :disabled="busy" @click="change(r, 'delete')"><Icon name="trash" :size="16" /> Elimina</button>
      </div>
    </article>
  </div>
  <button class="btn primary wide feature-add" :disabled="busy || loading" @click="open()">
    <Icon name="plus" /> Nuovo promemoria
  </button>

  <dialog ref="dialog" class="card pulse-dialog" aria-labelledby="reminder-step"
    @cancel.prevent="!busy && dialog.close()" @close="editor = null">
    <form v-if="editor" @submit.prevent="step === 4 ? save() : next()">
      <div class="focus-label">{{ editor.revision ? 'Modifica promemoria' : 'Nuovo promemoria' }} · {{ step }} di 4</div>
      <h2 id="reminder-step">{{ title }}</h2>
      <label v-if="step === 1" class="fieldlabel">Tipo promemoria
        <select v-model="editor.kind" class="field" autofocus @change="changeType">
          <option v-for="(type, id) in reminderTypes" :key="id" :value="id">{{ type.name }}</option>
        </select>
      </label>
      <template v-if="step === 2">
        <label class="fieldlabel">Nome del promemoria
          <input v-model="editor.label" class="field" maxlength="160" :required="editor.kind === 'custom'" />
        </label>
        <label v-if="needsTarget" class="fieldlabel">Attività
          <select v-model="editor.target" class="field" required>
            <option value="">Scegli attività</option>
            <option v-for="target in targets" :key="target.id" :value="String(target.id)">{{ target.name }}</option>
          </select>
        </label>
        <p v-if="needsTarget && !targets.length" class="note">Non ci sono attività da collegare a questo tipo di promemoria.</p>
      </template>
      <template v-if="step === 3">
        <div class="field-row">
          <label class="fieldlabel">Orario promemoria
            <input v-model="editor.at" class="field" type="time" required />
          </label>
          <label class="fieldlabel">Fuso orario
            <input v-model="editor.timezone" class="field" required maxlength="100" />
          </label>
        </div>
        <fieldset class="organize-day">
          <legend>Giorni della settimana</legend>
          <div class="weekday-options">
            <label v-for="day in orderedDays" :key="day">
              <input v-model="editor.weekdays" type="checkbox" :value="day" />
              {{ reminderDays[day] }}
            </label>
          </div>
        </fieldset>
      </template>
      <dl v-if="step === 4" class="feature-facts">
        <div><dt>Nome</dt><dd>{{ label(editor) }}</dd></div>
        <div><dt>Tipologia</dt><dd>{{ reminderTypes[editor.kind].name }}</dd></div>
        <div><dt>Orario</dt><dd>{{ editor.at }} · {{ editor.timezone }}</dd></div>
        <div><dt>Frequenza</dt><dd>{{ reminderFrequency(editor.weekdays) }}</dd></div>
      </dl>
      <p v-if="editorError" class="warning" role="alert">{{ editorError }}</p>
      <div class="feature-actions">
        <button type="button" class="btn secondary" :disabled="busy || targetsBusy"
          @click="step === 1 ? dialog.close() : step--">{{ step === 1 ? 'Annulla' : 'Indietro' }}</button>
        <button class="btn primary" :disabled="busy || targetsBusy">{{ step === 4 ? 'Salva promemoria' : 'Continua' }}</button>
      </div>
    </form>
  </dialog>
</template>
