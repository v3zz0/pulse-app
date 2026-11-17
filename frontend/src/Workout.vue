<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWorkout } from "./stores/workout";
import { useAuth } from "./stores/auth";
import { useRouter } from "vue-router";
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
  day = ref("A"),
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
    if (w.program && !w.program.days[day.value])
      day.value = Object.keys(w.program.days)[0];
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
const label = {
  pending: "Da fare",
  recorded: "Completata con peso registrato",
  unlogged: "Completata · peso non registrato",
  skipped: "Saltata",
};
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
const draftReps = (s) =>
  Object.hasOwn(s, "draftReps") ? s.draftReps : s.actualReps;
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
onMounted(() => {
  w.init();
  interval = setInterval(() => (now.value = Date.now()), 500);
});
onUnmounted(() => clearInterval(interval));
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="eyebrow">LA TUA SCHEDA COMPLETA</div>
      <h1>Allenati<span class="mint">.</span></h1>
      <p class="text-muted">Standard e carico della seduta restano distinti.</p>
    </div>
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
  <p role="status" data-testid="workout-sync">
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
  <template v-if="!w.active || w.active.status === 'cancelled'">
    <section v-if="w.program" class="card">
      <h2>{{ w.program.title }}</h2>
      <p class="source-note">
        Note e video provengono dalla scheda privata. I video non confermati
        sono esplicitamente da revisionare.
      </p>
      <div class="switch-seg">
        <button
          v-for="d in Object.keys(w.program.days)"
          :key="d"
          :class="{ active: day === d }"
          @click="day = d"
        >
          Scheda {{ d }}
        </button>
      </div>
      <p>
        {{ (w.program.days[day] || []).length }} blocchi ·
        {{ (w.program.days[day] || []).reduce((n, b) => n + b.sets.length, 0) }}
        serie · defaticamento
        {{
          w.program.cooldown.durationSeconds
            ? w.program.cooldown.durationSeconds + " s"
            : "da verificare"
        }}
      </p>
      <button
        class="btn primary wide"
        :disabled="!!w.queue.length"
        @click="run(() => w.start(day))"
      >
        Inizia scheda {{ day }} completa
      </button>
      <details
        v-for="b in w.program.days[day]"
        :key="b.id"
        class="training-preview"
      >
        <summary>{{ b.name }} · {{ b.prescriptionRaw }}</summary>
        <p>{{ b.notes }}</p>
        <p>
          Recupero: {{ b.restRaw }}
          {{ b.reviewRequired ? "· da verificare" : "" }}
        </p>
        <div v-for="s in b.sets" :key="s.id" class="setting-row">
          <span
            >Serie {{ s.id.split(":").at(-1) }} · Standard:
            {{ w.standards[s.id]?.kg ?? "da impostare" }}
            {{ w.standards[s.id]?.kg != null ? "kg" : "" }}</span
          ><button
            class="textbutton"
            :aria-label="'Aggiorna standard ' + s.id"
            @click="standard(s.id)"
          >
            Aggiorna carico standard
          </button>
        </div>
      </details>
    </section>
    <p v-else-if="w.ready" class="empty">
      Nessuna scheda assegnata. Importala privatamente da Strapi.
    </p>
  </template>
  <template v-else>
    <section class="card active-workout-head">
      <div v-if="w.active.status === 'active'" class="workout-menu">
        <button
          class="btn secondary workout-menu-trigger"
          aria-label="Menu allenamento"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          ⋮
        </button>
        <div v-if="menuOpen" role="menu" class="workout-menu-items">
          <button
            class="btn secondary danger"
            role="menuitem"
            @click="
              cancelOpen = true;
              menuOpen = false;
            "
          >
            Annulla allenamento
          </button>
        </div>
      </div>
      <h2>
        Scheda {{ w.active.day }} ·
        {{
          w.active.status === "completed"
            ? "Conclusa sul dispositivo"
            : "In corso"
        }}
      </h2>
      <p>
        {{ pending }} serie da gestire · Avvio
        {{ new Date(w.active.startedAt).toLocaleString("it-IT") }}
      </p>
      <div
        v-if="w.active.timer"
        class="rest-panel"
        role="timer"
        aria-label="Timer recupero"
      >
        <b>{{ Number.isFinite(remaining) ? remaining : 0 }} s</b> ·
        {{ w.active.timer.pausedRemaining != null ? "In pausa" : "Recupero" }}
        <div class="btnrow">
          <button
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
            class="btn secondary"
            @click="run(() => w.act({ action: 'timer', command: 'stop' }))"
          >
            Ferma recupero
          </button>
        </div>
      </div>
      <label class="fieldlabel" for="manual-rest"
        >Recupero manuale in secondi</label
      >
      <div class="btnrow">
        <input
          id="manual-rest"
          v-model.number="seconds"
          class="field"
          type="number"
          min="1"
          max="3600"
        /><button
          class="btn secondary"
          @click="
            run(() => w.act({ action: 'timer', command: 'start', seconds }))
          "
        >
          Avvia recupero
        </button>
      </div>
    </section>
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
    <section
      v-for="b in w.active.snapshot.blocks"
      :key="b.id"
      class="card workout-block"
      :data-testid="'block-' + b.id"
    >
      <div class="card-head">
        <div>
          <span class="eyebrow">{{ b.phase }}</span>
          <h2>{{ b.name }}</h2>
        </div>
        <button
          class="textbutton"
          :disabled="w.conflict || w.active.status !== 'active'"
          @click="run(() => w.act({ action: 'skip-block', blockId: b.id }))"
        >
          Salta esercizio
        </button>
      </div>
      <p>
        {{ b.prescriptionRaw }} · Recupero
        {{ b.restSeconds == null ? b.restRaw : b.restSeconds + " s" }}
        <span v-if="b.reviewRequired" class="pill yellow"
          >Da verificare · timer manuale</span
        >
      </p>
      <p class="smallmuted">{{ b.notes }}</p>
      <p v-if="b.movements.length">
        {{ b.movements.map((m) => m.name + " × " + m.reps).join(" → ") }}
      </p>
      <div class="video-list">
        <a
          v-for="(v, i) in b.videos"
          :key="i"
          class="video"
          :href="v.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="v.reviewNote"
          >Video {{ v.candidateMovement || i + 1 }} ·
          {{
            v.reviewRequired
              ? "da revisionare"
              : "associazione confermata dal titolo ufficiale"
          }}</a
        ><span v-if="!b.videos.length" class="smallmuted"
          >Nessun video associato nella fonte.</span
        >
      </div>
      <div
        v-for="(s, i) in b.sets"
        :key="s.id"
        class="session-set"
        :data-testid="'set-' + s.id"
      >
        <div class="set-foot">
          <b
            >Serie {{ i + 1 }} · {{ s.kind || b.phase }} · Obiettivo: {{ s.reps
            }}{{ s.toFailure ? " · cedimento" : ""
            }}{{ s.perLeg ? " · per gamba" : "" }}</b
          ><span class="pill grey">{{ label[s.status] }}</span>
        </div>
        <p v-if="s.movements?.length" class="note">
          {{ s.movements.map((m) => m.name + " × " + m.reps).join(" → ") }}
        </p>
        <p class="smallmuted">
          Standard all’avvio:
          {{
            s.standardAtStart == null
              ? "Imposta carico standard"
              : s.standardAtStart + " kg"
          }}
          <span v-if="s.previous">
            · Precedente registrata: {{ s.previous.kg }} kg ×
            {{ s.previous.reps ?? "rip. non registrate" }}</span
          >
        </p>
        <template v-if="s.status === 'pending' && w.active.status === 'active'">
          <div class="field-row">
            <label class="fieldlabel"
              >Carico della seduta (kg)<input
                class="field"
                type="number"
                min="0"
                max="1500"
                step="0.5"
                :value="s.draftKg"
                @input="draft(s, 'kg', $event)" /></label
            ><label v-if="s.repProposal?.kind !== 'compound'" class="fieldlabel"
              >Ripetizioni effettive<input
                class="field"
                type="number"
                min="0"
                max="1000"
                :value="draftReps(s)"
                @input="draft(s, 'reps', $event)"
            /></label>
          </div>
          <p v-if="s.repProposal?.kind === 'compound'" class="smallmuted">
            Ripetizioni dei singoli movimenti conservate come sopra. Nessun
            totale viene registrato.
          </p>
          <div
            v-if="s.repProposal?.kind === 'range'"
            class="btnrow"
            aria-label="Scelta rapida ripetizioni"
          >
            <span
              >Previste {{ s.repProposal.min }}–{{ s.repProposal.max }}:</span
            >
            <label v-if="!s.repProposal.options.length" class="fieldlabel">
              Scelta rapida ripetizioni previste
              <select
                class="field"
                :value="draftReps(s) ?? ''"
                @change="draft(s, 'reps', $event)"
              >
                <option value="">Scegli un valore</option>
                <option
                  v-for="n in s.repProposal.max - s.repProposal.min + 1"
                  :key="n"
                  :value="s.repProposal.min + n - 1"
                >
                  {{ s.repProposal.min + n - 1 }}
                </option>
              </select>
            </label>
            <button
              v-for="n in s.repProposal.options"
              :key="n"
              class="btn secondary rep-choice"
              :aria-label="`Proponi ${n} ripetizioni`"
              @click="draft(s, 'reps', { target: { value: String(n) } })"
            >
              {{ n }}
            </button>
          </div>
          <p v-if="s.repProposal?.kind === 'open'" class="smallmuted">
            {{ s.reps }}: inserisci le ripetizioni effettivamente eseguite.
          </p>
          <p class="smallmuted">
            I valori proposti restano una bozza fino al completamento.
          </p>
          <div class="set-buttons">
            <button
              class="btn primary"
              :disabled="s.draftKg == null || w.conflict"
              @click="result(s, 'recorded')"
            >
              Completa e registra peso</button
            ><button
              class="btn secondary"
              :disabled="w.conflict"
              @click="result(s, 'unlogged')"
            >
              Completa senza peso</button
            ><button
              class="btn secondary"
              :disabled="w.conflict"
              @click="result(s, 'skipped')"
            >
              Salta serie
            </button>
          </div>
        </template>
        <p v-else>
          {{ s.actualKg === null ? "Peso non registrato" : s.actualKg + " kg" }}
          ·
          {{
            s.actualReps === null
              ? "Ripetizioni non registrate"
              : s.actualReps + " ripetizioni"
          }}
        </p>
        <button
          class="textbutton"
          :aria-label="'Aggiorna standard ' + s.id"
          @click="standard(s.id)"
        >
          Aggiorna carico standard
        </button>
      </div>
    </section>
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
