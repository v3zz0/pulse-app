<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useWorkout } from "./stores/workout";
import { useAuth } from "./stores/auth";
import { useRouter } from "vue-router";
const router = useRouter();
function reauthenticate() {
  useAuth().user = null;
  router.push("/login");
}
const w = useWorkout(),
  day = ref("A"),
  error = ref(""),
  seconds = ref(60),
  now = ref(Date.now());
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
      draftKg: field === "kg" ? value : s.draftKg,
      actualReps: field === "reps" ? value : s.actualReps,
    }),
  );
}
function result(s, status) {
  run(() =>
    w.act({
      action: "set",
      setId: s.id,
      status,
      actualKg: status === "recorded" ? s.draftKg : null,
      actualReps: s.actualReps,
    }),
  );
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
  <RouterLink class="btn secondary" to="/allenati/schede"
    >Gestisci scheda</RouterLink
  >
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
      w.queue.length
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
  <template v-if="!w.active">
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
    <section class="card">
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
            >Serie {{ i + 1 }} · {{ s.reps
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
            s.standardAtStart === null
              ? "da impostare"
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
                @change="draft(s, 'kg', $event)" /></label
            ><label class="fieldlabel"
              >Ripetizioni effettive<input
                class="field"
                type="number"
                min="0"
                max="1000"
                :value="s.actualReps"
                @change="draft(s, 'reps', $event)"
            /></label>
          </div>
          <div class="set-buttons">
            <button
              class="btn primary"
              :disabled="s.draftKg === null || w.conflict"
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
