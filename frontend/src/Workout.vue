<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWorkout } from "./stores/workout";
import { useAuth } from "./stores/auth";
import { useRouter } from "vue-router";
import Icon from "./components/Icon.vue";
import WorkoutExercise from "./components/WorkoutExercise.vue";
import WorkoutSession from "./components/WorkoutSession.vue";
import { mediaFor, offlineAnimations } from "./flow-media";
import { dayName, weekdays } from "./workout-display";
import { shareReport } from "./workout-report.js";
import { notify } from "./ui.js";
const sharing = ref(false);
async function share() {
  sharing.value = true;
  try { await shareReport(w.active, dayName(w.program, w.active.day) || w.active.snapshot.title || "Allenamento"); }
  catch (e) { notify("Export non riuscito: " + e.message); }
  finally { sharing.value = false; }
}
const router = useRouter();
const menuOpen = ref(false),
  cancelOpen = ref(false),
  cancelDialog = ref(null);
watch(
  cancelOpen,
  (open) => {
    if (open) cancelDialog.value?.showModal();
    else cancelDialog.value?.close();
  },
  { flush: "post" },
);
function reauthenticate() {
  useAuth().user = null;
  router.push("/login");
}
const w = useWorkout(),
  day = ref(null),
  starting = ref(false),
  error = ref(""),
  seconds = ref(60),
  now = ref(Date.now());
watch(
  () => `${w.active?.clientId}:${w.active?.status}`,
  () => {
    menuOpen.value = false;
    cancelOpen.value = false;
  },
);
let interval;
watch(
  () => w.program?.id,
  () => {
    day.value = null;
  },
  { immediate: true },
);
const pending = computed(
  () =>
    w.active?.snapshot.blocks
      .flatMap((b) => b.sets)
      .filter((s) => s.status === "pending").length || 0,
);
const remaining = computed(
  () =>
    w.active?.timer?.pausedRemaining ??
    Math.max(
      0,
      Math.ceil((Date.parse(w.active?.timer?.endAt) - now.value) / 1000),
    ),
);
async function run(fn) {
  error.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  }
}
function draft(s, field, event) {
  const value = event.target.value === "" ? null : Number(event.target.value);
  run(() =>
    w.act({
      action: "set",
      setId: s.id,
      status: "pending",
      [field === "kg" ? "draftKg" : "draftReps"]: value,
    }),
  );
}
function result(s, status) {
  run(() =>
    w.act({
      action: "set",
      setId: s.id,
      status,
      useDraft: true,
    }),
  );
}
const registered = computed(
  () =>
    w.active?.snapshot.blocks
      .flatMap((b) => b.sets)
      .filter((s) => ["recorded", "unlogged"].includes(s.status)).length || 0,
);
async function cancelWorkout() {
  await run(async () => {
    const cancelledDay = w.active.day;
    await w.act({ action: "cancel", confirm: true });
    day.value = null;
    cancelOpen.value = false;
    menuOpen.value = false;
    const registration = await navigator.serviceWorker?.getRegistration();
    const notifications = await registration?.getNotifications();
    for (const n of notifications || [])
      if (
        (n.data?.kind === "workout" && n.data?.target === cancelledDay) ||
        (n.title === "PULSE · Allenamento" && !n.data?.kind)
      )
        n.close();
  });
}
function resolveConflict() {
  if (
    window.confirm(
      "Scaricare una copia della bozza e usare la versione server?",
    )
  )
    run(() => w.discard());
}
function standard(id) {
  const text = prompt(
    "Nuovo carico standard in kg (vuoto = da impostare). Non modifica lo storico.",
  );
  if (text === null) return;
  const value = text.trim() === "" ? null : Number(text);
  if (
    value !== null &&
    (!Number.isFinite(value) || value < 0 || value > 1500)
  ) {
    error.value = "Carico non valido";
    return;
  }
  if (
    confirm(
      `Confermi il carico standard ${value === null ? "da impostare" : value + " kg"}? Sarà usato nelle prossime sessioni.`,
    )
  )
    run(() => w.standard(id, value));
}
const organizeDialog = ref(null),
  organization = ref(null),
  organizationBusy = ref(false);
const isActive = computed(() => w.active && w.active.status !== "cancelled");
const selectedDay = computed(() => (isActive.value ? w.active.day : day.value));
const dayKeys = computed(() => Object.keys(w.program?.days || {}));
const fullWeek = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
function scheduleFor(key) {
  const days = w.program.displaySettings?.days?.[key]?.weekdays || [];
  return [1, 2, 3, 4, 5, 6, 0].filter((n) => days.includes(n)).map((n) => fullWeek[n]).join(" · ")
    || "Nessun giorno fisso";
}
const todayWeekday = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()) + "T12:00:00").getDay();
const isToday = (key) => !!w.program?.displaySettings?.days?.[key]?.weekdays?.includes(todayWeekday);
async function start(key) {
  if (starting.value) return;
  starting.value = true;
  await run(() => w.start(key));
  starting.value = false;
}
const blocks = computed(() =>
  isActive.value ? w.active.snapshot.blocks : w.program?.days[day.value] || [],
);
const cooldown = computed(() =>
  isActive.value ? w.active.snapshot.cooldown : w.program?.cooldown,
);
const completedCount = computed(
  () =>
    blocks.value
      .flatMap((b) => b.sets)
      .filter((s) => s.status && s.status !== "pending").length,
);
const flowProgress = ref(null),
  flowBusy = ref(false);
function mediaBlock(block) {
  if (!isActive.value) return block;
  if (w.active.programId !== w.program?.id) return block;
  const current = w.program.days[selectedDay.value]?.find((b) => b.id === block.id);
  return current?.name === block.name && current.notes === block.notes ? current : block;
}
const flowIds = computed(() => [...new Set(blocks.value
  .flatMap((block) => mediaFor(mediaBlock(block)).map((item) => item.flowId))
  .filter(Boolean))]);
watch(
  () => JSON.stringify([w.program?.id, selectedDay.value, flowIds.value]),
  () => (flowProgress.value = null),
);
async function downloadFlow() {
  flowProgress.value = null;
  flowBusy.value = true;
  const ids = flowIds.value;
  const selection = selectedDay.value;
  const programId = w.program?.id;
  const sameSheet = () => selection === selectedDay.value && programId === w.program?.id &&
    ids.join(",") === flowIds.value.join(",");
  await run(async () => {
    const result = await offlineAnimations(
      ids,
      (p) => { if (sameSheet()) flowProgress.value = p; },
    );
    if (sameSheet()) flowProgress.value = {
      ...flowProgress.value,
      complete: true,
      bytes: result.bytes,
    };
  });
  flowBusy.value = false;
}
function organize() {
  organization.value = {
    timezone:
      w.program.displaySettings?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: Object.fromEntries(
      Object.keys(w.program.days).map((d) => [
        d,
        {
          name: dayName(w.program, d),
          description: w.program.displaySettings?.days?.[d]?.description || "",
          weekdays: [...(w.program.displaySettings?.days?.[d]?.weekdays || [])],
        },
      ]),
    ),
  };
  menuOpen.value = false;
  organizeDialog.value.showModal();
}
async function saveOrganization() {
  organizationBusy.value = true;
  await run(async () => {
    await w.layout(organization.value);
    organizeDialog.value.close();
  });
  organizationBusy.value = false;
}
function expandAll() {
  document
    .querySelectorAll(".compact-exercise > details:first-child")
    .forEach((d) => (d.open = true));
}
onMounted(() => {
  w.init();
  interval = setInterval(() => (now.value = Date.now()), 500);
});
onUnmounted(() => clearInterval(interval));
</script>
<template>
  <div v-if="error || w.error || (w.queue.length && !w.syncing) || w.conflict || w.active?.status === 'cancelled'" class="sync-alerts">
    <p v-if="error" role="alert" class="warning">{{ error }}</p>
    <p v-if="w.error" role="status" class="warning">{{ w.error }}</p>
    <button v-if="w.error.includes('Accesso')" class="btn secondary" @click="reauthenticate">Accedi per sincronizzare</button>
    <button v-if="w.queue.length && !w.conflict && !w.syncing" class="btn secondary" @click="run(() => w.load())">Riprova sincronizzazione</button>
    <button v-if="w.conflict" class="btn secondary" @click="resolveConflict">Scarica bozza e usa versione server</button>
    <p v-if="w.active?.status === 'cancelled'" class="note" role="status">
      Allenamento annullato sul dispositivo. Attendi la sincronizzazione prima di iniziarne un altro.
    </p>
  </div>
  <p role="status" class="workout-sync" :class="{ 'sr-only': !w.queue.length || w.syncing }" data-testid="workout-sync">
    {{
      w.saving
        ? "Salvataggio sul dispositivo…"
        : w.syncing
          ? "Sincronizzazione…"
          : w.queue.length
            ? `${w.queue.length} modifiche salvate sul dispositivo · invio in attesa`
            : w.ready
              ? "Tutte le modifiche sincronizzate"
              : "Caricamento…"
    }}
  </p>

  <WorkoutSession
    v-if="isActive && w.active.status === 'active'"
    :media-block="mediaBlock"
    @cancel="cancelOpen = true"
    @standard="standard"
  />
  <section v-else-if="isActive" class="card">
    <h2>Allenamento concluso</h2>
    <p class="note">Salvato sul dispositivo: verrà inviato appena possibile.</p>
    <button class="btn primary wide" :disabled="sharing" @click="share"><Icon name="download" :size="15" /> Invia al coach (PDF)</button>
  </section>

  <template v-else-if="day && w.program">
    <button class="btn secondary" style="margin-bottom: 12px" @click="day = null"><Icon name="list" :size="15" /> Tutte le schede</button>
    <div class="session-bar">
      <h1>{{ dayName(w.program, day) }}<em>.</em></h1>
    </div>
    <p class="note">
      {{ w.program.displaySettings?.days?.[day]?.description || "" }}
      {{ blocks.length }} esercizi · {{ blocks.reduce((n, b) => n + b.sets.length, 0) }} serie
    </p>
    <button
      class="btn primary wide start-workout"
      :aria-label="'Inizia scheda ' + day + ' completa'"
      :disabled="starting || !!w.queue.length"
      @click="start(day)"
    >
      <Icon name="play" :size="20" />Inizia allenamento
    </button>
    <div class="workout-exercises">
      <WorkoutExercise
        v-for="b in blocks"
        :key="b.id"
        :block="b"
        :loads="w.standards"
        :media-block="mediaBlock(b)"
        :save-media="w.program?.flowAvailable && mediaBlock(b).media
          ? (item, id) => w.chooseFlow({ day: selectedDay, blockId: b.id, key: item.key, flowId: id })
          : undefined"
        :active="false"
        :disabled="w.conflict"
        @standard="standard"
      />
    </div>
    <details v-if="flowIds.length" class="card media-download">
      <summary>Scarica le animazioni per usarle offline</summary>
      <button class="btn secondary" :disabled="flowBusy" @click="downloadFlow">Scarica animazioni</button>
      <p v-if="flowProgress" class="note" role="status">
        {{ flowProgress.complete ? "Animazioni disponibili offline" : "Download" }}
        · {{ flowProgress.done }}/{{ flowProgress.total }} · {{ (flowProgress.bytes / 1024).toFixed(1) }} KiB
      </p>
    </details>
  </template>

  <template v-else>
    <div class="pagehead">
      <div>
        <div class="focus-label">{{ w.program?.title || "Allenamento" }}</div>
        <h1>Allenati<em>.</em></h1>
      </div>
      <button v-if="w.program" class="btn secondary sm" @click="organize">
        <Icon name="calendar" :size="16" /> Organizza
      </button>
    </div>
    <div v-if="w.program" class="training-cards">
      <article
        v-for="d in dayKeys"
        :key="d"
        class="card training-card"
        :class="{ today: isToday(d) }"
        :data-testid="'training-day-' + d"
      >
        <div class="section-head">
          <span class="focus-label">{{ scheduleFor(d) }}</span>
          <span v-if="isToday(d)" class="tag ok">Oggi</span>
        </div>
        <h2>{{ dayName(w.program, d) }}</h2>
        <p class="note">
          <template v-if="w.program.displaySettings?.days?.[d]?.description">{{ w.program.displaySettings.days[d].description }} · </template>
          {{ w.program.days[d].length }} esercizi · {{ w.program.days[d].reduce((n, b) => n + b.sets.length, 0) }} serie
        </p>
        <div class="training-actions">
          <button class="btn secondary" @click="day = d">Vedi</button>
          <button
            class="btn primary"
            :aria-label="'Inizia scheda ' + d + ' completa'"
            :disabled="starting || !!w.queue.length"
            @click="start(d)"
          >
            <Icon name="play" :size="15" /> Inizia
          </button>
        </div>
      </article>
    </div>
    <p v-else-if="w.ready" class="empty">
      Nessuna scheda attiva. <RouterLink to="/altro/schede">Crea o importa una scheda</RouterLink>.
    </p>
    <p v-if="w.pendingImports?.length" class="note">
      {{ w.pendingImports.length }} versioni in bozza.
      <RouterLink to="/altro/schede">Gestisci le schede</RouterLink>
    </p>
  </template>

  <dialog
    ref="cancelDialog"
    class="card workout-modal"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="cancel-title"
    aria-describedby="cancel-description"
    @cancel.prevent="cancelOpen = false"
  >
    <h2 id="cancel-title">Annullare questo allenamento?</h2>
    <p id="cancel-description">
      {{ registered ? `Hai già completato ${registered} serie. ` : "" }}La sessione non conterà nello
      storico né nelle statistiche. I carichi standard restano invariati.
    </p>
    <div class="btnrow">
      <button autofocus class="btn secondary" @click="cancelOpen = false">Torna all’allenamento</button
      ><button class="btn secondary danger" @click="cancelWorkout">Annulla definitivamente</button>
    </div>
  </dialog>
  <dialog
    ref="organizeDialog"
    class="card workout-modal"
    aria-labelledby="organize-title"
  >
    <form v-if="organization" @submit.prevent="saveOrganization">
      <h2 id="organize-title">Organizza schede</h2>
      <p class="note">
        Nomi e calendario sono personali. I riferimenti originali e i carichi
        restano invariati; puoi avviare qualsiasi scheda.
      </p>
      <fieldset
        v-for="d in Object.keys(organization.days)"
        :key="d"
        class="organize-day"
      >
        <legend>Riferimento {{ d }}</legend>
        <label class="fieldlabel"
          >Nome scheda {{ d
          }}<input
            class="field"
            v-model="organization.days[d].name"
            required
            maxlength="60"
        /></label>
        <label class="fieldlabel">Descrizione scheda {{ d }}
          <input class="field" v-model="organization.days[d].description" maxlength="160" />
        </label>
        <div class="weekday-options">
          <label v-for="(name, n) in weekdays" :key="n"
            ><input
              type="checkbox"
              :value="n"
              v-model="organization.days[d].weekdays"
              :aria-label="`Scheda ${d}: ${name}`"
            />{{ name }}</label
          >
        </div>
      </fieldset>
      <label class="fieldlabel"
        >Fuso calendario<input
          class="field"
          v-model="organization.timezone"
          required
      /></label>
      <p v-if="error" role="alert" class="warning">{{ error }}</p>
      <div class="btnrow">
        <button type="button" class="btn ghost" @click="organizeDialog.close()">
          Indietro</button
        ><button class="btn primary" :disabled="organizationBusy">
          Salva organizzazione
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.active-workout-head {
  position: relative;
}
.active-workout-head > h2 {
  padding-right: 44px;
}
.workout-menu {
  position: absolute;
  right: 18px;
  top: 18px;
  z-index: 2;
}
.workout-menu-trigger {
  min-width: 44px;
  min-height: 44px;
  padding: 4px 12px;
  font-size: 26px;
}
.workout-menu-items {
  position: absolute;
  right: 0;
  top: 50px;
  width: max-content;
  max-width: 280px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel2);
}
.danger {
  color: var(--red);
  border-color: var(--red);
}
.workout-modal::backdrop {
  background: #000b;
}
.workout-modal {
  color: inherit;
  margin: auto;
  width: min(calc(100% - 36px), 540px);
  max-height: 90dvh;
  overflow: auto;
}
.rep-choice {
  min-width: 44px;
  min-height: 44px;
}
</style>
