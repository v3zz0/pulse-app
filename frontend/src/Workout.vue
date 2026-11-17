<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWorkout } from "./stores/workout";
import { useAuth } from "./stores/auth";
import { useRouter } from "vue-router";
import Icon from "./components/Icon.vue";
import WorkoutExercise from "./components/WorkoutExercise.vue";
import { mediaFor, offlineAnimations } from "./flow-media";
import { dayName, weekdays } from "./workout-display";
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
    || "Giorno non assegnato";
}
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
  <button v-if="day && !isActive" class="textbutton page-back" @click="day = null">
    ‹ Tutte le schede
  </button>
  <div class="feature-heading">
    <Icon name="dumbbell" :size="36" />
    <div>
      <h1>{{ isActive ? 'Allenamento in corso' : day ? dayName(w.program, day) : 'Le mie schede' }}</h1>
      <p v-if="!day && !isActive">Seleziona una scheda o consulta i suoi esercizi.</p>
    </div>
    <button v-if="w.program && !day && !isActive" class="btn secondary" @click="organize">
      <Icon name="edit" :size="17" /> Modifica programma
    </button>
  </div>
  <div v-if="!isActive" class="editor-launch">
    <RouterLink v-if="!day" to="/allenati/editor" class="btn primary">
      <Icon name="plus" :size="18" /> Crea nuova scheda
    </RouterLink>
    <RouterLink v-else-if="w.program" :to="'/allenati/editor/' + w.program.id" class="btn secondary">
      <Icon name="edit" :size="18" /> Modifica scheda
    </RouterLink>
    <RouterLink to="/altro/schede" class="btn secondary">Gestisci schede</RouterLink>
  </div>
  <p v-if="error" role="alert" class="warning">{{ error }}</p>
  <p v-if="w.error" role="status" class="warning">{{ w.error }}</p>
  <button
    v-if="w.error.includes('Accesso')"
    class="btn secondary"
    @click="reauthenticate"
  >
    Accedi per sincronizzare
  </button>
  <p role="status" class="workout-sync" data-testid="workout-sync">
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
  <button
    v-if="w.queue.length && !w.conflict"
    class="btn secondary"
    @click="run(() => w.load())"
  >
    Riprova sincronizzazione
  </button>
  <button v-if="w.conflict" class="btn secondary" @click="resolveConflict">
    Scarica bozza e usa versione server
  </button>
  <p v-if="w.active?.status === 'cancelled'" class="note" role="status">
    Allenamento annullato sul dispositivo. Attendi la sincronizzazione prima di
    iniziarne un altro.
  </p>
  <template v-if="w.program && !day && !isActive">
    <div class="feature-list training-list">
      <article v-for="d in dayKeys" :key="d" class="card feature-card" :data-testid="'training-day-' + d">
        <div class="feature-row">
          <span class="feature-icon"><Icon name="calendar" /></span>
          <div class="feature-content">
            <div class="focus-label">{{ scheduleFor(d) }}</div>
            <h2>{{ dayName(w.program, d) }}</h2>
            <p class="note">
              {{ w.program.displaySettings?.days?.[d]?.description ||
                w.program.days[d].length + ' esercizi · ' +
                  w.program.days[d].reduce((count, block) => count + block.sets.length, 0) + ' serie' }}
            </p>
          </div>
          <Icon name="arrow" :size="17" />
        </div>
        <div class="feature-actions feature-pair">
          <button class="btn secondary" @click="day = d">
            <Icon name="eye" :size="16" /> Visualizza scheda
          </button>
          <button class="btn primary" :aria-label="'Inizia scheda ' + d + ' completa'"
            :disabled="starting || !!w.queue.length" @click="start(d)">
            <Icon name="play" :size="16" /> Inizia allenamento
          </button>
        </div>
      </article>
    </div>
    <p class="note">{{ w.program.title }}<template v-if="w.program.provenance !== 'manual'"> · Versione {{ w.program.version }}</template></p>
    <p v-if="w.pendingImports?.length" class="note">
      {{ w.pendingImports.length }} versioni CSV in bozza.
      <RouterLink to="/altro/schede">Gestisci le versioni</RouterLink>
    </p>
  </template>
  <section v-if="(w.program && day) || isActive" class="card workout-program">
    <div class="program-heading">
      <span class="program-icon"><Icon name="gym" :size="26" /></span>
      <h2>{{ isActive ? w.active.snapshot.title : w.program.title }}</h2>
      <div class="program-menu">
        <button
          class="btn secondary"
          aria-label="Menu allenamento"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <Icon name="more" />
        </button>
        <div v-if="menuOpen" role="menu">
          <button
            v-if="w.active?.status === 'active'"
            role="menuitem"
            class="danger"
            @click="
              cancelOpen = true;
              menuOpen = false;
            "
          >
            Annulla allenamento</button
          ><button v-if="w.program" role="menuitem" @click="organize">
            Modifica programma
          </button>
        </div>
      </div>
    </div>
    <div class="program-summary">
      <span><Icon name="layers" :size="17" />{{ blocks.length }} blocchi</span
      ><span
        ><Icon name="chart" :size="17" />{{
          blocks.reduce((n, b) => n + b.sets.length, 0)
        }}
        serie</span
      ><span
        ><Icon name="clock" :size="17" />{{
          cooldown?.durationSeconds
            ? cooldown.durationSeconds + " s"
            : "Da verificare"
        }}
        defaticamento</span
      >
    </div>
    <button
      v-if="!isActive"
      class="btn primary wide start-workout"
      :aria-label="'Inizia scheda ' + day + ' completa'"
      :disabled="starting || !!w.queue.length"
      @click="start(day)"
    >
      <Icon name="play" :size="20" />Inizia allenamento
    </button>
    <p v-else class="session-progress">
      {{ dayName(w.program, w.active.day) }} ·
      {{
        w.active.status === "completed"
          ? "Conclusa sul dispositivo"
          : "In corso"
      }}
      · {{ completedCount }} serie gestite · {{ pending }} da fare
    </p>
    <p v-if="w.pendingImports?.length" class="source-note">
      Versioni CSV ancora in bozza: {{ w.pendingImports.length }}.
      L’importazione da sola non cambia la scheda attiva: attivala da Altro.
    </p>
    <details v-if="w.program" class="program-version">
      <summary>
        Piano attivo: {{ w.program.provenance }} · versione
        {{ w.program.version || "precedente" }} · riferimento {{ selectedDay }}
      </summary>
      <p>
        Le versioni importate si attivano da Altro → Gestisci scheda
        allenamento. Il trasferimento dei carichi precedenti richiede conferma e
        può sostituire quelli della nuova versione.
      </p>
      <p v-if="w.pendingImports?.length">
        {{ w.pendingImports.length }} versioni CSV recenti sono ancora in bozza:
        {{
          w.pendingImports.map((p) => p.title + " · v" + p.version).join(", ")
        }}.
      </p>
      <p>
        I carichi della sessione sono quelli presenti all’avvio; aggiornare lo
        standard vale per la prossima sessione.
      </p>
    </details>
  </section>
  <p v-else-if="w.ready && !w.program" class="empty">
    Nessuna scheda attiva. Controlla le versioni importate in Altro.
  </p>
  <template v-if="isActive">
    <section
      v-if="w.active.timer"
      class="rest-panel compact-timer"
      role="timer"
      aria-label="Timer recupero"
    >
      <Icon name="clock" /><strong
        >{{ Number.isFinite(remaining) ? remaining : 0 }} s</strong
      ><span>{{
        w.active.timer.pausedRemaining != null ? "In pausa" : "Recupero"
      }}</span
      ><button
        class="btn secondary"
        @click="
          run(() =>
            w.act({
              action: 'timer',
              command: w.active.timer.endAt ? 'pause' : 'resume',
            }),
          )
        "
      >
        {{
          w.active.timer.endAt ? "Pausa recupero" : "Riprendi recupero"
        }}</button
      ><button
        class="btn ghost"
        @click="run(() => w.act({ action: 'timer', command: 'stop' }))"
      >
        Ferma recupero
      </button>
    </section>
    <details class="manual-recovery">
      <summary>Recupero manuale</summary>
      <div class="btnrow">
        <label class="fieldlabel" for="manual-rest"
          >Recupero manuale in secondi<input
            id="manual-rest"
            v-model.number="seconds"
            class="field"
            type="number"
            min="1"
            max="3600" /></label
        ><button
          class="btn secondary"
          @click="
            run(() => w.act({ action: 'timer', command: 'start', seconds }))
          "
        >
          Avvia recupero
        </button>
      </div>
    </details>
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
        {{ registered ? `Hai già completato ${registered} serie. ` : "" }}La
        sessione sarà annullata e non conterà nello storico completato o nelle
        statistiche. I carichi standard restano invariati.
      </p>
      <p class="smallmuted">
        Senza connessione, l’annullamento viene salvato sul dispositivo e
        inviato appena possibile.
      </p>
      <div class="btnrow">
        <button autofocus class="btn secondary" @click="cancelOpen = false">
          Torna all’allenamento</button
        ><button class="btn secondary danger" @click="cancelWorkout">
          Annulla definitivamente
        </button>
      </div>
    </dialog>
  </template>
  <details v-if="(day || isActive) && flowIds.length" class="media-download">
    <summary>Animazioni offline</summary>
    <button
      v-if="flowIds.length"
      class="btn secondary"
      :disabled="flowBusy"
      @click="downloadFlow"
    >
      Scarica animazioni offline
    </button>
    <p v-if="flowProgress" class="note" role="status">
      {{
        flowProgress.complete ? "Animazioni disponibili offline" : "Download"
      }}
      · {{ flowProgress.done }}/{{ flowProgress.total }} ·
      {{ (flowProgress.bytes / 1024).toFixed(1) }} KiB
    </p>
  </details>
  <div v-if="blocks.length" class="section-title workout-exercises-title">
    <h2>Esercizi della scheda</h2>
    <button class="textbutton" @click="expandAll">
      Mostra tutti ({{ blocks.length }}) <Icon name="arrow" :size="16" />
    </button>
  </div>
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
      :active="!!isActive"
      :disabled="w.conflict || (isActive && w.active.status !== 'active')"
      @draft="draft"
      @result="result"
      @standard="standard"
      @skip="(id) => run(() => w.act({ action: 'skip-block', blockId: id }))"
    />
  </div>
  <template v-if="isActive">
    <section class="card workout-block">
      <h2>
        {{ w.active.snapshot.cooldown.name }} ·
        {{
          w.active.snapshot.cooldown.durationSeconds
            ? w.active.snapshot.cooldown.durationSeconds + " s"
            : "durata da verificare"
        }}
      </h2>
      <p>{{ w.active.snapshot.cooldown.sourceText }}</p>
      <div class="btnrow">
        <button
          v-if="w.active.snapshot.cooldown.durationSeconds"
          class="btn secondary"
          @click="
            run(() =>
              w.act({
                action: 'timer',
                command: 'start',
                seconds: w.active.snapshot.cooldown.durationSeconds,
              }),
            )
          "
        >
          Avvia defaticamento</button
        ><button
          class="btn secondary"
          :disabled="w.active.snapshot.cooldownDone"
          @click="run(() => w.act({ action: 'cooldown' }))"
        >
          {{
            w.active.snapshot.cooldownDone
              ? "Defaticamento confermato"
              : "Conferma defaticamento"
          }}
        </button>
      </div>
      <button
        class="btn primary wide"
        :disabled="
          pending > 0 ||
          !w.active.snapshot.cooldownDone ||
          w.conflict ||
          w.active.status !== 'active'
        "
        @click="run(() => w.act({ action: 'finish' }))"
      >
        Concludi allenamento
      </button>
    </section>
  </template>
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
  background: #151e28;
}
.danger {
  color: #ff9292;
  border-color: #925050;
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
