<script setup>
import { computed } from "vue";
const props = defineProps({
  points: { type: Array, default: () => [] },
  label: String,
  unit: String,
});
const coords = computed(() => {
  const vals = props.points.map((p) => p.value),
    min = Math.min(...vals),
    max = Math.max(...vals),
    range = max - min || 1;
  return props.points.map((p, i) => ({
    x:
      30 +
      (props.points.length === 1 ? 220 : (i * 440) / (props.points.length - 1)),
    y: 145 - ((p.value - min) / range) * 110,
    ...p,
  }));
});
</script>
<template>
  <div v-if="points.length">
    <svg class="chart" viewBox="0 0 500 190" role="img" :aria-label="label">
      <path d="M30 20V150H480" class="chartgrid" fill="none" />
      <polyline
        :points="coords.map((p) => p.x + ',' + p.y).join(' ')"
        fill="none"
        stroke="#4DA3FF"
        stroke-width="3"
      />
      <g v-for="(p, i) in coords" :key="i">
        <circle :cx="p.x" :cy="p.y" r="4" fill="#38D9B0">
          <title>{{ p.label }}: {{ p.value }} {{ unit }}</title>
        </circle>
        <text
          v-if="i === 0 || i === coords.length - 1"
          :x="p.x"
          y="175"
          :text-anchor="i ? 'end' : 'start'"
        >
          {{ p.label }}
        </text>
      </g>
    </svg>
    <details>
      <summary>Dati del grafico</summary>
      <p v-for="(p, i) in points" :key="i">
        {{ p.label }}: {{ p.value }} {{ unit }}
      </p>
    </details>
  </div>
  <p v-else class="empty">Nessun valore registrato.</p>
</template>
