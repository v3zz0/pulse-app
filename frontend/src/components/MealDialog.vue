<script setup>
import { computed, ref, watch } from "vue";
import { useDay } from "../stores/day";
const props = defineProps({ meal: Object });
const emit = defineEmits(["close"]);
const day = useDay();
const dialog = ref(null),
  menuIndex = ref(0),
  selections = ref([]);
const menu = computed(() => props.meal?.menus[menuIndex.value]);
watch(
  () => props.meal,
  (meal) => {
    if (meal) {
      menuIndex.value = meal.menuIndex || 0;
      selections.value = [...meal.selections];
      dialog.value.showModal();
    } else dialog.value?.close();
  },
  { flush: "post" },
);
function changeMenu() {
  selections.value = menu.value.groups.map(() => 0);
}
function ordered(group) {
  return group.options
    .map((o, index) => ({ ...o, index }))
    .sort((a, b) => rank(a) - rank(b));
}
function rank(option) {
  return day.preferences[option.id] === "favorite"
    ? 0
    : day.preferences[option.id] === "avoid"
      ? 2
      : 1;
}
async function save() {
  if (await day.select(props.meal.id, menuIndex.value, selections.value))
    emit("close");
}
</script>
<template>
  <dialog
    ref="dialog"
    class="sheet sheet-dialog"
    aria-labelledby="meal-dialog-title"
    @close="emit('close')"
  >
    <template v-if="meal"
      ><div class="sheet-head">
        <div>
          <div class="eyebrow">{{ meal.time }} · GIORNO {{ day.mode }}</div>
          <h2 id="meal-dialog-title">{{ meal.name }}</h2>
          <p>Alternative del piano storico</p>
        </div>
        <button class="sheet-close" aria-label="Chiudi" @click="emit('close')">
          ×
        </button>
      </div>
      <div v-if="meal.consumedAt" class="warning">
        Annulla il consumo prima di sostituire questo pasto.
      </div>
      <label class="fieldlabel" for="menu">Composizione del pasto</label
      ><select
        id="menu"
        v-model.number="menuIndex"
        class="v2-select"
        @change="changeMenu"
      >
        <option v-for="(m, index) in meal.menus" :key="index" :value="index">
          {{ m.title }}
        </option>
      </select>
      <div v-for="(group, i) in menu.groups" :key="group.id">
        <p class="modal-subhead">Gruppo {{ i + 1 }} · scegli un’opzione</p>
        <div
          v-for="option in ordered(group)"
          :key="option.id"
          class="choice-card v2"
          :class="{ selected: selections[i] === option.index }"
        >
          <label class="choice-layout"
            ><input
              v-model="selections[i]"
              type="radio"
              :name="'group-' + i"
              :value="option.index"
            /><span class="choice-main"
              ><b>{{ option.text }}</b
              ><small v-if="option.reviewRequired"
                >Da verificare nel piano originale</small
              ></span
            ></label
          >
          <div class="choice-actions">
            <button
              class="choice-action"
              :class="{ fav: day.preferences[option.id] === 'favorite' }"
              @click="
                day.prefer(
                  option.id,
                  day.preferences[option.id] === 'favorite'
                    ? 'neutral'
                    : 'favorite',
                )
              "
            >
              ♡ Preferito</button
            ><button
              class="choice-action"
              :class="{ avoid: day.preferences[option.id] === 'avoid' }"
              @click="
                day.prefer(
                  option.id,
                  day.preferences[option.id] === 'avoid' ? 'neutral' : 'avoid',
                )
              "
            >
              Non mi piace
            </button>
          </div>
        </div>
      </div>
      <details>
        <summary>Testo originale del pasto</summary>
        <p class="note" style="white-space: pre-line">{{ meal.sourceText }}</p>
      </details>
      <p v-if="menu.notes" class="warning">{{ menu.notes }}</p>
      <p class="warning">
        Piano storico da rivedere con il professionista. Le alternative non
        implicano equivalenze nutrizionali verificate.
      </p>
      <p v-if="day.error" role="alert">{{ day.error }}</p>
      <button
        class="btn primary wide"
        :disabled="day.busy || !!meal.consumedAt"
        @click="save"
      >
        Salva sostituzione</button
      ><button class="btn ghost wide" @click="emit('close')">
        Annulla
      </button></template
    >
  </dialog>
</template>
