<script setup>
import { italianDays } from "../editor-model";
const props = defineProps({
  modelValue: Array,
  label: { type: String, default: "Giorni di applicazione" },
});
const emit = defineEmits(["update:modelValue"]);
function toggle(day) {
  emit(
    "update:modelValue",
    props.modelValue.includes(day)
      ? props.modelValue.filter((value) => value !== day)
      : [...props.modelValue, day],
  );
}
</script>
<template>
  <fieldset class="editor-week-field">
    <legend>{{ label }}</legend>
    <div class="editor-week">
      <button
        v-for="day in italianDays"
        :key="day.id"
        type="button"
        class="btn secondary"
        :class="{ 'is-selected': modelValue.includes(day.id) }"
        :aria-pressed="modelValue.includes(day.id)"
        :aria-label="day.name"
        @click="toggle(day.id)"
      >
        {{ day.short }}
      </button>
    </div>
  </fieldset>
</template>
