<script setup>
import { computed, ref, watchEffect } from "vue";
import { move, series, exercise, sessionDay } from "../editor-model";
import EditorWeek from "./EditorWeek.vue";
import EditorOrder from "./EditorOrder.vue";
import ExerciseLibrary from "./ExerciseLibrary.vue";
import FlowPicker from "./FlowPicker.vue";
import Icon from "./Icon.vue";

const props = defineProps({ draft: Object });
const selected = ref(null),
  library = ref(false),
  animation = ref(null),
  lastAdded = ref(null);
const day = computed(
  () =>
    props.draft.days.find((d) => d.id === selected.value) ||
    props.draft.days[0],
);
watchEffect(() => {
  if (!selected.value && props.draft.days[0])
    selected.value = props.draft.days[0].id;
});
const kinds = {
  work: "Serie",
  warmup: "Riscaldamento",
  "top-set": "Top set",
  "back-off": "Back-off",
  circuit: "Circuito",
  superset: "Superset",
};
const isCompound = (kind) => ["circuit", "superset"].includes(kind);
function addDay() {
  const next = sessionDay(props.draft.days.length + 1);
  props.draft.days.push(next);
  selected.value = next.id;
}
function removeDay() {
  if (!confirm("Eliminare questa giornata dalla scheda?")) return;
  props.draft.days.splice(props.draft.days.indexOf(day.value), 1);
  selected.value = props.draft.days[0].id;
}
function add(selection) {
  const row = exercise(selection);
  day.value.blocks.push(row);
  lastAdded.value = row.id;
}
function addSeries(block) {
  const last = block.sets.at(-1);
  const next = series(last?.kind);
  if (isCompound(next.kind))
    next.movements = (last?.movements || []).map(({ name, reps }) => ({
      name,
      reps,
    }));
  block.sets.push(next);
}
function setAnimation(id) {
  const { item, set, index } = animation.value;
  const targets = set
    ? item.sets
        .map((series) => series.movements[index])
        .filter((move) => move?.name === set.movements[index].name)
    : [item];
  for (const target of targets) {
    target.flowId = id;
    target.flowCleared = id === null;
    target.flowChanged = true;
  }
}
function changeKind(set) {
  if (isCompound(set.kind) && !set.movements.length)
    set.movements = [
      { name: "", reps: "" },
      { name: "", reps: "" },
    ];
}
</script>

<template>
  <section class="card editor-card" aria-labelledby="training-days">
    <div class="editor-heading-row">
      <h2 id="training-days">Giornate della scheda</h2>
      <button type="button" class="btn secondary" @click="addDay">
        <Icon name="plus" :size="18" /> Aggiungi giornata
      </button>
    </div>
    <div
      class="editor-actions"
      v-if="draft.days.length > 1"
      role="group"
      aria-label="Seleziona giornata"
    >
      <button
        v-for="item in draft.days"
        :key="item.id"
        type="button"
        class="btn secondary"
        :class="{ 'is-selected': item.id === day.id }"
        :aria-pressed="item.id === day.id"
        @click="selected = item.id"
      >
        {{ item.name || "Giornata senza nome" }}
      </button>
    </div>
    <div class="editor-fields" v-if="day">
      <label class="fieldlabel"
        >Nome giornata
        <input v-model="day.name" class="field" maxlength="60" required />
      </label>
      <label class="fieldlabel"
        >Descrizione giornata
        <input v-model="day.description" class="field" maxlength="160" />
      </label>
      <EditorWeek v-model="day.weekdays" />
      <button
        v-if="draft.days.length > 1"
        type="button"
        class="btn secondary danger"
        @click="removeDay"
      >
        Elimina giornata
      </button>
    </div>
  </section>

  <section
    class="editor-stack"
    aria-label="Esercizi della giornata"
    data-order-list
  >
    <article
      v-for="(block, i) in day.blocks"
      :key="block.id"
      data-order-item
      class="card editor-card"
    >
      <div class="editor-heading-row">
        <div class="editor-heading-row">
          <span class="feature-icon"><Icon name="dumbbell" :size="21" /></span>
          <h3>{{ block.name || "Nuovo esercizio" }}</h3>
        </div>
        <EditorOrder
          :index="i"
          :count="day.blocks.length"
          :label="block.name || 'esercizio ' + (i + 1)"
          drag
          @move="(offset) => move(day.blocks, i, offset)"
        />
      </div>
      <details
        class="editor-disclosure"
        :open="block.id === lastAdded || (i === 0 && !lastAdded)"
      >
        <summary>Configura esercizio · {{ block.sets.length }} serie</summary>
        <div class="editor-fields">
          <label class="fieldlabel"
            >Nome esercizio
            <input
              v-model="block.name"
              class="field"
              maxlength="160"
              required
            />
          </label>
          <div class="editor-grid">
            <label class="fieldlabel"
              >Recupero (secondi)
              <input
                v-model.number="block.restSeconds"
                class="field"
                type="number"
                min="1"
                max="3600"
                inputmode="numeric"
              />
            </label>
            <div
              v-if="!block.sets.some((set) => isCompound(set.kind))"
              class="editor-fields"
            >
              <span class="fieldlabel"
                >Animazione Flow
                {{ block.flowId ? "· " + block.flowId : "" }}</span
              >
              <button
                type="button"
                class="btn secondary"
                @click="
                  animation = {
                    item: block,
                    name: block.name,
                    flowId: block.flowId,
                  }
                "
              >
                <Icon name="play" :size="17" />
                {{ block.flowId ? "Cambia animazione" : "Associa animazione" }}
              </button>
            </div>
          </div>
          <label class="fieldlabel"
            >Note esercizio
            <textarea
              v-model="block.notes"
              class="field"
              maxlength="1600"
              rows="2"
            />
          </label>

          <fieldset
            v-for="(set, j) in block.sets"
            :key="set.id"
            class="editor-inset"
          >
            <legend>Serie {{ j + 1 }} · {{ kinds[set.kind] }}</legend>
            <div class="editor-grid">
              <label class="fieldlabel"
                >Tipo di serie
                <select
                  v-model="set.kind"
                  class="field"
                  @change="changeKind(set)"
                >
                  <option v-for="(label, key) in kinds" :key="key" :value="key">
                    {{ label }}
                  </option>
                </select>
              </label>
              <label v-if="!isCompound(set.kind)" class="fieldlabel"
                >Ripetizioni previste
                <input
                  v-model="set.reps"
                  class="field"
                  maxlength="80"
                  placeholder="Numero, intervallo o CED"
                  required
                />
              </label>
              <label class="fieldlabel"
                >Peso standard (kg)
                <input
                  v-model.number="set.standardKg"
                  type="number"
                  class="field"
                  min="0"
                  max="1500"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="Facoltativo"
                />
              </label>
            </div>
            <template v-if="isCompound(set.kind)">
              <div
                v-for="(part, k) in set.movements"
                :key="k"
                class="editor-grid editor-movement"
              >
                <label class="fieldlabel"
                  >Movimento {{ k + 1 }}
                  <input
                    v-model="part.name"
                    class="field"
                    required
                    maxlength="160"
                  />
                </label>
                <label class="fieldlabel"
                  >Ripetizioni movimento {{ k + 1 }}
                  <input
                    v-model="part.reps"
                    class="field"
                    required
                    maxlength="40"
                  />
                </label>
                <button
                  type="button"
                  class="btn secondary"
                  @click="
                    animation = {
                      item: block,
                      set,
                      index: k,
                      name: part.name || 'Movimento ' + (k + 1),
                      flowId: part.flowId,
                    }
                  "
                >
                  <Icon name="play" :size="17" />
                  {{ part.flowId ? "Cambia animazione" : "Associa animazione" }}
                </button>
                <button
                  v-if="set.movements.length > 2"
                  type="button"
                  class="btn secondary danger"
                  @click="set.movements.splice(k, 1)"
                >
                  Rimuovi movimento
                </button>
              </div>
              <button
                type="button"
                class="btn secondary"
                @click="set.movements.push({ name: '', reps: '' })"
              >
                Aggiungi movimento
              </button>
            </template>
            <div class="editor-actions">
              <label class="editor-check"
                ><input v-model="set.toFailure" type="checkbox" /> A
                cedimento</label
              >
              <label class="editor-check"
                ><input v-model="set.perLeg" type="checkbox" /> Per gamba</label
              >
              <button
                v-if="block.sets.length > 1"
                type="button"
                class="btn ghost danger"
                @click="block.sets.splice(j, 1)"
              >
                Rimuovi serie {{ j + 1 }}
              </button>
            </div>
          </fieldset>
          <div class="editor-actions editor-between">
            <button
              type="button"
              class="btn secondary"
              @click="addSeries(block)"
            >
              Aggiungi serie
            </button>
            <button
              type="button"
              class="btn ghost danger"
              @click="day.blocks.splice(i, 1)"
            >
              Rimuovi esercizio
            </button>
          </div>
        </div>
      </details>
    </article>
    <p v-if="!day.blocks.length" class="editor-empty">
      Aggiungi il primo esercizio della giornata.
    </p>
  </section>

  <button
    type="button"
    class="btn secondary wide editor-add"
    @click="library = true"
  >
    <Icon name="plus" /> Aggiungi esercizio
  </button>
  <details class="card editor-card editor-disclosure">
    <summary>Defaticamento</summary>
    <div class="editor-fields">
      <label class="fieldlabel"
        >Nome defaticamento<input
          v-model="draft.cooldown.name"
          class="field"
          maxlength="160"
      /></label>
      <label class="fieldlabel"
        >Durata (secondi)<input
          v-model.number="draft.cooldown.durationSeconds"
          class="field"
          min="1"
          max="3600"
          type="number"
          inputmode="numeric"
      /></label>
      <label class="fieldlabel"
        >Note defaticamento<textarea
          v-model="draft.cooldown.sourceText"
          class="field"
          maxlength="1600"
          rows="2"
        />
      </label>
    </div>
  </details>
  <ExerciseLibrary v-if="library" @select="add" @close="library = false" />
  <FlowPicker
    v-if="animation"
    :target="{ name: animation.name, flowId: animation.flowId }"
    :save="setAnimation"
    @close="animation = null"
  />
</template>
