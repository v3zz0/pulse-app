<script setup>
import { ref } from "vue";
import Icon from "./Icon.vue";
const props = defineProps({
  index: Number,
  count: Number,
  label: String,
  drag: Boolean,
});
const emit = defineEmits(["move"]);
const holding = ref(false);
function start(event) {
  if (!event.isPrimary || event.button !== 0) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  holding.value = true;
}
function end(event) {
  if (!holding.value) return;
  holding.value = false;
  const list = event.currentTarget.closest("[data-order-list]");
  if (!list) return;
  const cards = [...list.children].filter((node) =>
    node.hasAttribute("data-order-item"),
  );
  const to = cards.findIndex((row) => {
    const box = row.getBoundingClientRect();
    return event.clientY >= box.top && event.clientY <= box.bottom;
  });
  if (to >= 0) emit("move", to - props.index);
}
</script>
<template>
  <div class="editor-order">
    <span
      v-if="drag"
      class="editor-grip"
      :class="{ 'is-dragging': holding }"
      title="Trascina per ordinare"
      aria-hidden="true"
      @pointerdown="start"
      @pointerup="end"
      @pointercancel="holding = false"
      >⠿</span
    >
    <button
      type="button"
      class="btn secondary icon-button editor-up"
      :aria-label="'Sposta su ' + label"
      :disabled="!index"
      @click="emit('move', -1)"
    >
      <Icon name="down" :size="16" />
    </button>
    <button
      type="button"
      class="btn secondary icon-button"
      :aria-label="'Sposta giù ' + label"
      :disabled="index >= count - 1"
      @click="emit('move', 1)"
    >
      <Icon name="down" :size="16" />
    </button>
  </div>
</template>
