<script setup>
import { computed } from "vue";
import Icon from "./Icon.vue";
import { phase } from "../workout-display";
const props = defineProps({ set: Object, index: Number, disabled: Boolean });
const emit = defineEmits(["draft", "result"]);
const reps = computed(() =>
  Object.hasOwn(props.set, "draftReps")
    ? props.set.draftReps
    : props.set.actualReps,
);
const labels = {
  pending: "Da fare",
  recorded: "Completata con peso registrato",
  unlogged: "Completata · peso non registrato",
  skipped: "Saltata",
};
const change = (field, event) => emit("draft", props.set, field, event);
</script>
<template>
  <div class="session-set compact-set" :data-testid="'set-' + set.id">
    <div class="compact-set-caption">
      <span
        >Serie {{ index + 1 }} · {{ phase(set.kind) }} · {{ set.reps
        }}{{ set.toFailure ? " · cedimento" : ""
        }}{{ set.perLeg ? " · per gamba" : "" }} · Standard
        {{
          set.standardAtStart == null ? "—" : set.standardAtStart + " kg"
        }}</span
      ><span :class="['set-result', set.status]">{{ labels[set.status] }}</span>
    </div>
    <template v-if="set.status === 'pending'">
      <div class="compact-set-controls">
        <div class="compact-fields">
          <label
            ><Icon name="weight" :size="17" /><span
              >Kg seduta<input
                aria-label="Carico della seduta (kg)"
                type="number"
                min="0"
                max="1500"
                step="0.01"
                :value="set.draftKg"
                :disabled="disabled"
                @input="change('kg', $event)" /></span
          ></label>
          <label v-if="set.repProposal?.kind !== 'compound'"
            ><Icon name="reps" :size="17" /><span
              >Rep effettive<input
                aria-label="Ripetizioni effettive"
                type="number"
                min="0"
                max="1000"
                :value="reps"
                :disabled="disabled"
                @input="change('reps', $event)" /></span
          ></label>
          <span v-else class="smallmuted"
            >Movimenti separati · {{ set.reps }}</span
          >
        </div>
        <div class="compact-actions">
          <button
            class="btn primary"
            aria-label="Completa e registra peso"
            :disabled="disabled || set.draftKg == null"
            @click="emit('result', set, 'recorded')"
          >
            <Icon name="check" :size="16" />Completa
          </button>
          <button
            class="btn secondary"
            aria-label="Completa senza peso"
            :disabled="disabled"
            @click="emit('result', set, 'unlogged')"
          >
            <Icon name="no-weight" :size="16" />Senza peso
          </button>
          <button
            class="btn secondary"
            aria-label="Salta serie"
            :disabled="disabled"
            @click="emit('result', set, 'skipped')"
          >
            <Icon name="skip" :size="16" />Salta
          </button>
        </div>
      </div>
      <div v-if="set.repProposal?.kind === 'range'" class="rep-options">
        <small
          >Previste {{ set.repProposal.min }}–{{ set.repProposal.max }}:</small
        ><button
          v-for="n in set.repProposal.options"
          :key="n"
          class="btn secondary"
          :aria-label="`Proponi ${n} ripetizioni`"
          :disabled="disabled"
          @click="change('reps', { target: { value: String(n) } })"
        >
          {{ n }}</button
        ><label v-if="!set.repProposal.options.length"
          >Scelta rapida ripetizioni previste<select
            class="field"
            :value="reps ?? ''"
            :disabled="disabled"
            @change="change('reps', $event)"
          >
            <option value="">Scegli un valore</option>
            <option
              v-for="n in set.repProposal.max - set.repProposal.min + 1"
              :key="n"
              :value="set.repProposal.min + n - 1"
            >
              {{ set.repProposal.min + n - 1 }}
            </option>
          </select></label
        >
      </div>
      <p v-if="set.repProposal?.kind === 'open'" class="smallmuted">
        {{ set.reps }}: inserisci le ripetizioni effettive.
      </p>
      <p v-if="set.movements?.length" class="smallmuted">
        {{ set.movements.map((m) => m.name + " × " + m.reps).join(" → ") }} ·
        nessun totale inventato
      </p>
    </template>
    <p v-else class="compact-result">
      {{ set.actualKg == null ? "Peso non registrato" : set.actualKg + " kg" }}
      ·
      {{
        set.actualReps == null
          ? "Ripetizioni non registrate"
          : set.actualReps + " ripetizioni"
      }}
    </p>
  </div>
</template>
