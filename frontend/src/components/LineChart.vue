<script setup>
import { computed } from "vue";
const props = defineProps({
  points: { type: Array, default: () => [] },
  label: String,
  unit: String,
  empty: { type: String, default: "Nessun valore registrato." },
});
const chart = computed(() => {
  if (!props.points.length) return { marks: [], ticks: [] };
  const values = props.points.map((p) => p.value);
  const min = Math.min(...values),
    max = Math.max(...values);
  const first = Date.parse(props.points[0].date),
    last = Date.parse(props.points.at(-1).date);
  const y = (value) =>
    max === min ? 75 : 124 - ((value - min) / (max - min)) * 106;
  return {
    marks: props.points.map((point) => ({
      ...point,
      x:
        first === last
          ? 226
          : 51 + ((Date.parse(point.date) - first) / (last - first)) * 350,
      y: y(point.value),
    })),
    ticks: (min === max ? [min] : [max, min]).map((value) => ({
      value,
      y: y(value),
    })),
  };
});
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const labelDate = (point) => point.axisLabel || point.label;
</script>

<template>
  <div v-if="points.length" class="progress-chart">
    <svg viewBox="0 0 420 154" role="img" :aria-label="label">
      <path d="M51 10V126H401" class="chartgrid" fill="none" />
      <g v-for="tick in chart.ticks" :key="tick.value">
        <line x1="51" x2="401" :y1="tick.y" :y2="tick.y" class="chartgrid" />
        <text x="44" :y="tick.y + 4" text-anchor="end">
          {{ number.format(tick.value) }}
        </text>
      </g>
      <polyline
        :points="chart.marks.map((p) => p.x + ',' + p.y).join(' ')"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.5"
      />
      <circle
        v-for="(p, i) in chart.marks"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        r="3.6"
        fill="var(--accent)"
      >
        <title>{{ p.label }} · {{ number.format(p.value) }} {{ unit }}</title>
      </circle>
      <text x="51" y="146">{{ labelDate(points[0]) }}</text>
      <text
        v-if="labelDate(points.at(-1)) !== labelDate(points[0])"
        x="401"
        y="146"
        text-anchor="end"
      >
        {{ labelDate(points.at(-1)) }}
      </text>
    </svg>
    <details>
      <summary>Dati del grafico</summary>
      <dl>
        <div v-for="(p, i) in points" :key="p.session || i">
          <dt>{{ p.label }}</dt>
          <dd>
            {{ number.format(p.value) }} {{ unit
            }}<template v-if="p.reps != null"> · {{ p.reps }} rip.</template>
          </dd>
        </div>
      </dl>
    </details>
  </div>
  <p v-else class="empty">{{ empty }}</p>
</template>
