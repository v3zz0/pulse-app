<script setup>
import { computed, ref } from "vue";
import { food, group, italianDays, meal, menu, move } from "../editor-model";
import EditorOrder from "./EditorOrder.vue";
import EditorWeek from "./EditorWeek.vue";
import Icon from "./Icon.vue";
const props = defineProps({ draft: Object });
const selected = ref(null),
  lastAdded = ref(null);
const legacy = computed(() => props.draft.schedule.mode === "legacy");
const keys = computed(() =>
  legacy.value
    ? ["OFF", "ON"]
    : props.draft.schedule.mode === "daily"
      ? ["daily"]
      : italianDays
          .filter((d) => props.draft.schedule.weekdays.includes(d.id))
          .map((d) => String(d.id)),
);
const day = computed(() =>
  keys.value.includes(selected.value) ? selected.value : keys.value[0],
);
const meals = computed(() => props.draft.meals[day.value] || []);
const label = (key) =>
  italianDays.find((d) => String(d.id) === key)?.name || key;
function addMeal() {
  if (!day.value) return;
  const next = meal();
  (props.draft.meals[day.value] ||= []).push(next);
  lastAdded.value = next.id;
}
const units = { g: "g", ml: "ml", piece: "pezzi", portion: "porzioni" };
</script>

<template>
  <section
    class="card editor-card editor-fields"
    aria-labelledby="diet-calendar"
  >
    <h2 id="diet-calendar">Calendario del piano</h2>
    <label v-if="!legacy" class="fieldlabel"
      >Tipo di piano
      <select class="field" v-model="draft.schedule.mode">
        <option value="daily">Giornaliero</option>
        <option value="weekly">Settimanale</option>
      </select>
    </label>
    <p v-if="!legacy" class="note">
      {{
        draft.schedule.mode === "daily"
          ? "Stessi pasti nei giorni selezionati."
          : "Pasti diversi per ogni giorno selezionato."
      }}
    </p>
    <EditorWeek v-if="!legacy" v-model="draft.schedule.weekdays" />
    <div
      v-if="keys.length > 1"
      class="editor-actions"
      role="group"
      aria-label="Giorno da modificare"
    >
      <button
        type="button"
        v-for="key in keys"
        :key="key"
        class="btn secondary"
        :class="{ 'is-selected': key === day }"
        :aria-pressed="key === day"
        @click="selected = key"
      >
        {{ label(key) }}
      </button>
    </div>
  </section>

  <section
    v-if="day"
    class="editor-stack"
    :aria-label="
      day === 'daily' ? 'Pasti della giornata tipo' : 'Pasti · ' + label(day)
    "
  >
    <article v-for="(m, mi) in meals" :key="m.id" class="card editor-card">
      <details
        class="editor-disclosure"
        :open="m.id === lastAdded || (!lastAdded && mi === 0)"
      >
        <summary class="editor-meal-title">
          <span class="feature-icon"><Icon name="food" /></span>
          <strong>{{ m.name || "Nuovo pasto" }}</strong>
          <small>{{ m.menus[0]?.groups.length || 0 }} alimenti</small>
        </summary>
        <div class="editor-fields">
          <div class="editor-grid">
            <label class="fieldlabel"
              >Nome pasto
              <input v-model="m.name" required class="field" maxlength="160" />
            </label>
            <label class="fieldlabel"
              >Orario
              <input v-model="m.time" class="field" type="time" />
            </label>
          </div>
          <label class="fieldlabel"
            >Note pasto<textarea
              v-model="m.sourceText"
              class="field"
              maxlength="1600"
              rows="2"
            />
          </label>
          <fieldset
            v-for="(item, j) in m.menus"
            :key="item.id"
            class="editor-inset"
          >
            <legend>
              {{ j === 0 ? "Pasto principale" : "Alternativa al pasto " + j }}
            </legend>
            <label v-if="j > 0" class="fieldlabel"
              >Nome alternativa
              <input
                v-model="item.title"
                class="field"
                maxlength="160"
                required
              />
            </label>
            <label v-if="item.notes || j > 0" class="fieldlabel"
              >Note menu<textarea
                v-model="item.notes"
                class="field"
                maxlength="1600"
                rows="2"
              />
            </label>
            <section
              v-for="(g, i) in item.groups"
              :key="g.id"
              class="editor-food"
            >
              <div class="editor-heading-row">
                <h4>Alimento {{ i + 1 }}</h4>
                <EditorOrder
                  :index="i"
                  :count="item.groups.length"
                  :label="'alimento ' + (i + 1)"
                  @move="(offset) => move(item.groups, i, offset)"
                />
              </div>
              <div
                v-for="(o, k) in g.options"
                :key="o.id"
                class="editor-fields"
              >
                <label class="fieldlabel"
                  >{{ k ? "Sostituzione " + k : "Nome alimento" }}
                  <input
                    v-model="o.foodName"
                    class="field"
                    maxlength="300"
                    required
                  />
                </label>
                <div class="editor-grid">
                  <label class="fieldlabel"
                    >Quantità
                    <input
                      v-model.number="o.quantity"
                      :type="typeof o.quantity === 'string' ? 'text' : 'number'"
                      class="field"
                      min="0.01"
                      max="10000"
                      step="any"
                      inputmode="decimal"
                    />
                  </label>
                  <label class="fieldlabel"
                    >Unità di misura
                    <select v-model="o.unit" class="field">
                      <option v-if="!units[o.unit]" :value="o.unit">
                        {{ o.unit || "Come da fonte" }}
                      </option>
                      <option
                        v-for="(name, value) in units"
                        :key="value"
                        :value="value"
                      >
                        {{ name }}
                      </option>
                    </select>
                  </label>
                </div>
                <label class="fieldlabel"
                  >Note alimento<textarea
                    v-model="o.notes"
                    class="field"
                    maxlength="1600"
                    rows="2"
                  />
                </label>
                <button
                  v-if="k > 0"
                  type="button"
                  class="btn ghost danger"
                  @click="g.options.splice(k, 1)"
                >
                  Rimuovi sostituzione
                </button>
              </div>
              <div class="editor-actions">
                <button
                  type="button"
                  class="btn secondary"
                  @click="g.options.push(food())"
                >
                  Aggiungi sostituzione
                </button>
                <button
                  type="button"
                  class="btn ghost danger"
                  @click="item.groups.splice(i, 1)"
                >
                  Rimuovi alimento
                </button>
              </div>
            </section>
            <div class="editor-actions">
              <button
                type="button"
                class="btn secondary editor-add"
                @click="item.groups.push(group())"
              >
                <Icon name="plus" :size="17" /> Aggiungi alimento
              </button>
              <button
                v-if="j"
                type="button"
                class="btn ghost danger"
                @click="m.menus.splice(j, 1)"
              >
                Rimuovi alternativa
              </button>
            </div>
          </fieldset>
          <div class="editor-actions editor-between">
            <button
              type="button"
              class="btn secondary"
              @click="m.menus.push(menu('Alternativa ' + m.menus.length))"
            >
              Aggiungi alternativa al pasto
            </button>
            <button
              type="button"
              class="btn ghost danger"
              @click="meals.splice(mi, 1)"
            >
              Rimuovi pasto
            </button>
          </div>
        </div>
      </details>
    </article>
    <button
      type="button"
      class="btn secondary wide editor-add"
      @click="addMeal"
    >
      <Icon name="plus" /> Aggiungi pasto
    </button>
  </section>
  <p v-else class="editor-empty">Seleziona i giorni da configurare.</p>
</template>
