<script setup>
import { ref } from "vue";
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: String,
  id: String,
});
const emit = defineEmits(["update:modelValue"]);
const draft = ref(""),
  note = ref("");
function add(event) {
  if (event?.isComposing) return;
  const value = draft.value.trim();
  if (!value) return;
  if (
    props.modelValue.some(
      (v) => v.toLocaleLowerCase("it-IT") === value.toLocaleLowerCase("it-IT"),
    )
  ) {
    note.value = "Questo alimento è già presente";
    draft.value = "";
    return;
  }
  if (
    props.modelValue.length >= 100 ||
    [...props.modelValue, value].join("\n").length > 2000
  ) {
    note.value = "Elenco troppo lungo: massimo 100 alimenti e 2.000 caratteri";
    return;
  }
  emit("update:modelValue", [...props.modelValue, value]);
  draft.value = "";
  note.value = "";
}
function remove(index) {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== index),
  );
  note.value = "";
}
</script>
<template>
  <div class="food-chip-field">
    <label class="fieldlabel" :for="id">{{ label }}</label>
    <div
      class="food-chips"
      v-if="modelValue.length"
      :aria-label="label + ' inseriti'"
    >
      <span v-for="(food, i) in modelValue" :key="i" class="food-chip"
        ><span>{{ food }}</span
        ><button
          type="button"
          :aria-label="'Rimuovi ' + food + ' da ' + label"
          @click="remove(i)"
        >
          ×
        </button></span
      >
    </div>
    <input
      :id="id"
      v-model="draft"
      class="field"
      maxlength="100"
      placeholder="Es. Riso — premi Invio"
      :aria-describedby="id + '-help'"
      @keydown.enter.prevent="add"
      @blur="add"
    />
    <p :id="id + '-help'" class="source-note">
      Scrivi un alimento e premi Invio. Usa × per rimuoverlo. Esempio: Riso, poi
      Invio; Pollo, poi Invio.
    </p>
    <p v-if="note" class="source-note" aria-live="polite">{{ note }}</p>
  </div>
</template>
