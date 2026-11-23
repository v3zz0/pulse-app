<template>
  <div class="session">
    <header class="session-top">
      <div class="session-bar">
        <h1>{{ dayName(w.program, w.active.day) || w.active.snapshot.title }}</h1>
        <button type="button" class="btn ghost danger sm" @click="emit('cancel')">Annulla</button>
      </div>
      <div class="progressbar" role="progressbar" aria-label="Serie gestite" :aria-valuenow="done" aria-valuemin="0" :aria-valuemax="sets.length">
        <i :style="{ width: (100 * done) / (sets.length || 1) + '%' }"></i>
      </div>
      <p class="note" data-testid="session-count">{{ done }} di {{ sets.length }} serie</p>
    </header>

    <section v-if="w.active.timer" class="card rest-card" role="timer" aria-label="Timer recupero">
      <div class="focus-label">{{ w.active.timer.pausedRemaining != null ? "Recupero in pausa" : "Recupero" }}</div>
      <div class="rest-clock">{{ clock }}</div>
      <div class="rest-actions">
        <button type="button" class="btn secondary" @click="addRest">+15 s</button>
        <button type="button" class="btn secondary" @click="act({ action: 'timer', command: w.active.timer.endAt ? 'pause' : 'resume' })">
          {{ w.active.timer.endAt ? "Pausa" : "Riprendi" }}
        </button>
        <button type="button" class="btn primary" @click="act({ action: 'timer', command: 'stop' })">Salta</button>
      </div>
    </section>

    <nav class="exercise-strip" aria-label="Esercizi">
      <button
        v-for="(b, i) in blocks"
        :key="b.id"
        type="button"
        class="btn sm"
        :class="i === index ? 'primary' : 'secondary'"
        :aria-current="i === index ? 'step' : undefined"
        @click="chosen = i"
      >
        {{ i + 1 }}. {{ title(b.name) }}<span v-if="!b.sets.some((s) => s.status === 'pending')" aria-label="completato"> ✓</span>
      </button>
    </nav>

    <section v-if="block" class="card session-block" :data-testid="'session-block-' + block.id">
      <FlowPlayer v-if="media?.flowId" :key="media.flowId" :id="media.flowId" />
      <h2>{{ title(block.name) }}</h2>
      <p class="note">
        {{ phase(block.phase) }} · recupero {{ block.restSeconds ? block.restSeconds + " s" : block.restRaw || "non indicato" }}
      </p>
      <p v-if="block.notes" class="session-notes">{{ block.notes }}</p>

      <div v-for="(s, i) in block.sets" :key="s.id" class="set-card" :class="[s.status, { current: s === current }]" :data-testid="'set-' + s.id">
        <div class="set-head">
          <b>Serie {{ i + 1 }}<template v-if="s.kind && s.kind !== 'work'"> · {{ phase(s.kind) }}</template></b>
          <span class="note">{{ s.reps }}{{ s.toFailure ? " · cedimento" : "" }}{{ s.perLeg ? " · per gamba" : "" }} · standard {{ s.standardAtStart == null ? "da impostare" : s.standardAtStart + " kg" }}</span>
        </div>
        <p v-if="s.status !== 'pending'" class="set-result-line">{{ resultLabel(s) }}</p>
        <template v-else-if="s === current">
          <div class="set-inputs">
            <label>Kg di oggi
              <input
                :id="'kg-' + s.id"
                aria-label="Carico della seduta (kg)"
                class="field big"
                type="number"
                inputmode="decimal"
                min="0"
                max="1500"
                step="0.5"
                :value="s.draftKg ?? ''"
                :placeholder="s.standardAtStart != null ? String(s.standardAtStart) : '—'"
                @change="draft(s, 'draftKg', $event)"
              />
            </label>
            <label v-if="s.repProposal?.kind !== 'compound'">Ripetizioni
              <input
                :id="'reps-' + s.id"
                aria-label="Ripetizioni effettive"
                class="field big"
                type="number"
                inputmode="numeric"
                min="0"
                max="1000"
                :value="repsOf(s) ?? ''"
                @change="draft(s, 'draftReps', $event)"
              />
            </label>
          </div>
          <p class="note">I kg di oggi non cambiano lo standard.</p>
          <div v-if="s.repProposal?.kind === 'range'" class="chips" role="group" aria-label="Ripetizioni rapide">
            <button
              v-for="n in s.repProposal.options"
              :key="n"
              type="button"
              :aria-pressed="repsOf(s) === n"
              :aria-label="n + ' ripetizioni'"
              @click="act({ action: 'set', setId: s.id, status: 'pending', draftReps: n })"
            >{{ n }}</button>
          </div>
          <button type="button" class="btn primary wide big-action" :disabled="busy" @click="complete(s)">
            <Icon name="check" :size="18" /> Fatta
          </button>
          <div class="set-secondary">
            <button type="button" class="btn secondary" :disabled="busy" @click="finishSet(s, 'unlogged')">Senza peso</button>
            <button type="button" class="btn secondary" :disabled="busy" @click="finishSet(s, 'skipped')">Salta serie</button>
          </div>
        </template>
      </div>

      <div class="block-actions">
        <button type="button" class="iconbtn" :disabled="index === 0" aria-label="Esercizio precedente" @click="chosen = index - 1">
          <Icon name="arrow" :size="18" style="transform: rotate(180deg)" />
        </button>
        <button v-if="current" type="button" class="btn secondary sm" @click="act({ action: 'skip-block', blockId: block.id })">Salta esercizio</button>
        <button type="button" class="btn secondary sm" @click="emit('standard', (current || block.sets[0]).id)">Aggiorna standard</button>
        <button type="button" class="iconbtn" :disabled="index === blocks.length - 1" aria-label="Esercizio successivo" @click="chosen = index + 1">
          <Icon name="arrow" :size="18" />
        </button>
      </div>
    </section>

    <section v-if="!pending" class="card next-card">
      <h2>{{ w.active.snapshot.cooldown?.name || "Defaticamento" }}</h2>
      <p class="note">{{ w.active.snapshot.cooldown?.sourceText }}</p>
      <div class="set-secondary">
        <button
          v-if="w.active.snapshot.cooldown?.durationSeconds"
          type="button"
          class="btn secondary"
          @click="act({ action: 'timer', command: 'start', seconds: w.active.snapshot.cooldown.durationSeconds })"
        >Avvia timer</button>
        <button type="button" class="btn secondary" :disabled="w.active.snapshot.cooldownDone" @click="act({ action: 'cooldown' })">
          {{ w.active.snapshot.cooldownDone ? "Fatto ✓" : "Defaticamento fatto" }}
        </button>
      </div>
      <button type="button" class="btn primary wide big-action" :disabled="!w.active.snapshot.cooldownDone || w.conflict" @click="act({ action: 'finish' })">
        Concludi allenamento
      </button>
    </section>

    <details class="card manual-rest">
      <summary>Recupero manuale</summary>
      <form class="set-secondary" @submit.prevent="act({ action: 'timer', command: 'start', seconds: Number(manual) })">
        <label class="sr-only" for="manual-rest">Secondi di recupero</label>
        <input id="manual-rest" v-model="manual" class="field" type="number" min="1" max="3600" inputmode="numeric" placeholder="Secondi" />
        <button class="btn secondary">Avvia</button>
      </form>
    </details>
  </div>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick } from "vue";
import { useWorkout } from "../stores/workout";
import { dayName, phase, title } from "../workout-display";
import { mediaFor } from "../flow-media";
import Icon from "./Icon.vue";
import FlowPlayer from "./FlowPlayer.vue";
import { notify } from "../ui.js";
const props = defineProps({ mediaBlock: Function });
const emit = defineEmits(["cancel", "standard"]);
const w = useWorkout(),
  chosen = ref(null),
  busy = ref(false),
  manual = ref(60),
  now = ref(Date.now());
const blocks = computed(() => w.active.snapshot.blocks);
const sets = computed(() => blocks.value.flatMap((b) => b.sets));
const done = computed(() => sets.value.filter((s) => s.status !== "pending").length);
const pending = computed(() => sets.value.length - done.value);
const firstOpen = computed(() => Math.max(0, blocks.value.findIndex((b) => b.sets.some((s) => s.status === "pending"))));
const index = computed(() => (chosen.value ?? firstOpen.value));
const block = computed(() => blocks.value[index.value]);
const current = computed(() => block.value?.sets.find((s) => s.status === "pending") || null);
const media = computed(() => (block.value ? mediaFor(props.mediaBlock(block.value))[0] : null));
const remaining = computed(() => {
  const t = w.active.timer;
  if (!t) return 0;
  return t.pausedRemaining ?? Math.max(0, Math.ceil((Date.parse(t.endAt) - now.value) / 1000));
});
const clock = computed(() => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, "0")}`);
const repsOf = (s) => (Object.hasOwn(s, "draftReps") && s.draftReps != null ? s.draftReps : s.actualReps);
function resultLabel(s) {
  if (s.status === "skipped") return "Saltata";
  const kg = s.status === "recorded" ? s.actualKg + " kg" : "Senza peso";
  return `${kg} × ${s.actualReps ?? "—"} ripetizioni`;
}
async function act(action) {
  busy.value = true;
  try {
    await w.act(action);
    return true;
  } catch (e) {
    notify(e.message);
    return false;
  } finally {
    busy.value = false;
  }
}
// Salva la bozza senza bloccare i pulsanti: "Fatta" subito dopo deve funzionare.
function draft(s, field, event) {
  const v = event.target.value === "" ? null : Number(event.target.value);
  w.act({ action: "set", setId: s.id, status: "pending", [field]: v }).catch((e) => notify(e.message));
}
/** Valori scritti nei campi della serie corrente (null se vuoti o assenti). */
function typed(s) {
  const read = (id) => { const el = document.getElementById(id); return !el || el.value === "" ? undefined : Number(el.value); };
  return { kg: read("kg-" + s.id), reps: read("reps-" + s.id) };
}
async function finishSet(s, status) {
  const wasBlock = index.value, t = typed(s), patch = {};
  if (t.kg !== undefined && t.kg !== s.draftKg) patch.draftKg = t.kg;
  if (t.reps !== undefined && t.reps !== repsOf(s)) patch.draftReps = t.reps;
  if (Object.keys(patch).length && !(await act({ action: "set", setId: s.id, status: "pending", ...patch }))) return;
  if (await act({ action: "set", setId: s.id, status, useDraft: true })) {
    notify(status === "skipped" ? "Serie saltata" : "Serie registrata");
    if (!blocks.value[wasBlock].sets.some((x) => x.status === "pending")) chosen.value = null;
  }
}
// "Fatta": se non hai scritto i kg usa lo standard come valore di oggi (lo standard resta invariato).
async function complete(s) {
  if (s.draftKg == null && typed(s).kg === undefined) {
    if (s.standardAtStart == null) {
      notify("Scrivi i kg di oggi, oppure usa «Senza peso».");
      await nextTick();
      document.getElementById("kg-" + s.id)?.focus();
      return;
    }
    if (!(await act({ action: "set", setId: s.id, status: "pending", draftKg: s.standardAtStart }))) return;
  }
  await finishSet(s, "recorded");
}
function addRest() {
  act({ action: "timer", command: "start", seconds: Math.min(3600, remaining.value + 15) });
}
let tick;
onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 500)));
onUnmounted(() => clearInterval(tick));
</script>
<style scoped>
.session-top { position: sticky; top: 0; z-index: 6; background: var(--bg); padding: 8px 0 4px; }
.session-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.session-bar h1 { font-size: clamp(24px, 6vw, 32px); margin: 0; }
.progressbar { height: 8px; border-radius: 99px; background: var(--panel2); overflow: hidden; margin-top: 8px; }
.progressbar i { display: block; height: 100%; background: var(--sage); transition: width .4s; }
.rest-card { text-align: center; background: var(--panel2); box-shadow: none; }
.rest-clock { font-family: var(--serif); font-size: 64px; line-height: 1.05; font-variant-numeric: tabular-nums; }
.rest-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.rest-actions .btn, .set-secondary .btn, .block-actions .btn { margin: 0; }
.exercise-strip { display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 4px; scrollbar-width: thin; }
.exercise-strip .btn { flex: none; margin: 0; white-space: nowrap; }
.session-block { margin-top: 10px; }
.session-block h2 { margin: 10px 0 2px; }
.session-notes { background: var(--panel2); border-radius: 14px; padding: 10px 14px; font-size: 15px; }
.set-card { border: 1.5px solid var(--line); border-radius: 18px; padding: 12px 14px; margin-top: 10px; }
.set-card.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--panel)); }
.set-card.recorded, .set-card.unlogged { border-color: var(--sage-soft); background: var(--sage-soft); }
.set-card.skipped { opacity: .6; }
.set-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 10px; align-items: baseline; }
.set-result-line { margin: 4px 0 0; font-weight: 600; }
.set-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.set-inputs label { font-size: 14px; color: var(--muted); font-weight: 600; }
.field.big { font-size: 26px; font-weight: 700; text-align: center; min-height: 60px; margin-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chips button { min-width: 48px; min-height: 48px; border-radius: 14px; border: 1.5px solid var(--line); background: var(--panel); color: var(--ink); font-size: 17px; font-weight: 600; }
.chips button[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.big-action { min-height: 56px; font-size: 18px; margin-top: 12px; }
.set-secondary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.block-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-top: 14px; }
.manual-rest summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 600; }
</style>
