<script setup>
import { computed, ref } from "vue";
import Icon from "./Icon.vue";
import WorkoutSetRow from "./WorkoutSetRow.vue";
import FlowPlayer from "./FlowPlayer.vue";
import FlowPicker from "./FlowPicker.vue";
import { mediaFor } from "../flow-media";
import { standard, phase, title } from "../workout-display";
const p = defineProps({
  block: Object,
  mediaBlock: Object,
  saveMedia: Function,
  loads: Object,
  active: Boolean,
  disabled: Boolean,
});
const detailsOpen = ref(false);
const emit = defineEmits(["draft", "result", "standard", "skip"]);
const editing = ref(null);
const media = computed(() => mediaFor(p.mediaBlock || p.block));
const featured = computed(
  () => p.block.sets.find((s) => s.status === "pending") || p.block.sets.at(-1),
);
const others = computed(() =>
  p.block.sets.filter((s) => s.id !== featured.value?.id),
);
const loads = computed(() =>
  p.block.sets.map((s) =>
    p.active ? s.standardAtStart : standard(s, p.loads),
  ),
);
const loadLabel = computed(() => {
  if (p.active && featured.value)
    return featured.value.standardAtStart == null
      ? "Da impostare"
      : featured.value.standardAtStart + " kg";
  const values = [...new Set(loads.value)];
  return values.length === 1
    ? values[0] == null
      ? "Da impostare"
      : values[0] + " kg"
    : values.length <= 3
      ? values.map((v) => (v == null ? "—" : v + " kg")).join(" / ")
      : "Carichi per serie";
});
const target = computed(() =>
  new Set(p.block.sets.map((s) => s.reps)).size === 1
    ? p.block.sets.length + " × " + p.block.sets[0].reps
    : p.block.sets.length + " serie · obiettivi distinti",
);
</script>
<template>
  <section class="card compact-exercise" :data-testid="'block-' + block.id">
    <details :class="active ? 'exercise-details' : 'training-preview'" @toggle="detailsOpen = $event.target.open">
      <summary class="compact-ex-head">
        <span class="expand-ex"><Icon name="down" :size="19" /></span>
        <span class="compact-ex-info"
          ><span class="compact-ex-title"
            ><strong>{{ title(block.name) }}</strong
            ><span
              :class="['phase-tag', block.phase === 'top-set' ? 'top' : '']"
              >{{ phase(block.phase) }}</span
            ></span
          ><span class="compact-meta"
            ><span><Icon name="layers" :size="16" />{{ target }}</span
            ><span
              class="standard-highlight"
              title="Carico standard"
              :aria-label="'Carico standard: ' + loadLabel"
              ><Icon name="dumbbell" :size="16" />{{ loadLabel }}</span
            ><span
              ><Icon name="clock" :size="16" />{{
                block.restSeconds == null
                  ? "Rest: da verificare"
                  : `Rest: ${Math.floor(block.restSeconds / 60)}’${String(block.restSeconds % 60).padStart(2, "0")}`
              }}</span
            ></span
          ></span
        >
      </summary>
      <div class="exercise-extra">
        <div v-if="detailsOpen" class="flow-exercise-media">
          <section v-for="item in media" :key="item.key" class="flow-exercise-target">
            <h4 v-if="media.length > 1 || item.name !== block.name">{{ item.name }}</h4>
            <FlowPlayer v-if="item.flowId" :key="item.flowId" :id="item.flowId" />
            <p v-else class="note">
              <strong>Animazione non disponibile</strong>
              <span v-if="item.reason"> · {{ item.reason }}</span>
            </p>
            <button v-if="saveMedia" class="btn secondary"
              :aria-label="media.length > 1 ? 'Cambia animazione · ' + item.name : 'Cambia animazione'"
              @click="editing = item">
              Cambia animazione
            </button>
          </section>
        </div>
        <p v-if="block.notes" class="note">{{ block.notes }}</p>
        <p class="note">
          Fonte: {{ block.prescriptionRaw || target }} · Recupero:
          {{ block.restRaw || "non indicato" }}
        </p>
        <p v-if="block.movements?.length" class="note">
          {{ block.movements.map((m) => m.name + " × " + m.reps).join(" → ") }}
        </p>
        <div v-for="(s, i) in block.sets" :key="s.id" class="standard-setting">
          <span
            >Serie {{ i + 1 }} · {{ phase(s.kind || block.phase) }} · {{ s.reps }} rip. · Standard:
            <b>{{ loads[i] == null ? "da impostare" : loads[i] + " kg" }}</b
            ><small v-if="s.previous">
              · Precedente: {{ s.previous.kg }} kg ×
              {{ s.previous.reps ?? "rip. non registrate" }}</small
            ></span
          ><button
            class="textbutton"
            :aria-label="'Aggiorna standard ' + s.id"
            @click="emit('standard', s.id)"
          >
            Aggiorna carico standard
          </button>
        </div>
        <button
          v-if="active"
          class="textbutton"
          :disabled="disabled"
          @click="emit('skip', block.id)"
        >
          Salta esercizio
        </button>
      </div>
    </details>
    <FlowPicker v-if="editing" :target="editing"
      :save="(id) => saveMedia(editing, id)" @close="editing = null" />
    <ul v-if="!active && !detailsOpen && new Set(block.sets.map((s, i) => JSON.stringify([s.kind, s.reps, loads[i]]))).size > 1"
      class="prescribed-sets" aria-label="Prescrizioni per serie">
      <li v-for="(s, i) in block.sets" :key="s.id">
        {{ phase(s.kind || block.phase) }} · {{ s.reps }} rip. · {{ loads[i] == null ? 'Da impostare' : loads[i] + ' kg' }}
      </li>
    </ul>
    <template v-if="active && featured">
      <WorkoutSetRow
        :set="featured"
        :index="block.sets.indexOf(featured)"
        :disabled="disabled"
        @draft="(...args) => emit('draft', ...args)"
        @result="(...args) => emit('result', ...args)"
      />
      <details v-if="others.length" class="other-sets">
        <summary>
          Altre serie ({{ others.length }}) ·
          {{ block.sets.filter((s) => s.status !== "pending").length }}/{{
            block.sets.length
          }}
          gestite
        </summary>
        <WorkoutSetRow
          v-for="s in others"
          :key="s.id"
          :set="s"
          :index="block.sets.indexOf(s)"
          :disabled="disabled"
          @draft="(...args) => emit('draft', ...args)"
          @result="(...args) => emit('result', ...args)"
        />
      </details>
    </template>
  </section>
</template>

<style scoped>
.flow-exercise-target + .flow-exercise-target { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
</style>
