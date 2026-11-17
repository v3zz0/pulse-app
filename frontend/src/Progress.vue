<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useWorkout } from "./stores/workout";
import { api } from "./api";
import { localDate } from "./stores/day";
import { phase } from "./workout-display";
import {
  dayOf,
  periodStart,
  completedSessions,
  sessionCounts,
  frequency,
  calendar,
  moveMonth,
  exerciseProgress,
} from "./progress-model";
import LineChart from "./components/LineChart.vue";
import Icon from "./components/Icon.vue";
import "./progress.css";

const w = useWorkout();
const weights = ref([]),
  week = ref(null),
  requestError = ref(""),
  loading = ref(true);
const selection = ref(""),
  period = ref("90");
const today = dayOf(new Date()),
  currentMonth = today.slice(0, 7),
  month = ref(currentMonth);
const periods = [
  ["30", "30 giorni"],
  ["90", "90 giorni"],
  ["year", "Un anno"],
  ["all", "Tutto"],
];
const calendarLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const civil = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const namedMonth = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const numeric = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const dayLabel = (day) => civil.format(new Date(day + "T12:00:00Z"));
const timeLabel = (value) => new Date(value).toLocaleString("it-IT");
const monthLabel = computed(() =>
  namedMonth.format(new Date(month.value + "-01T12:00:00Z")),
);

const sessions = computed(() => completedSessions(w.history));
const byDay = computed(() => sessionCounts(sessions.value));
const weeks = computed(() => frequency(byDay.value, today));
const maxWeek = computed(() =>
  Math.max(1, ...weeks.value.map((entry) => entry.count)),
);
const thisMonth = computed(
  () =>
    sessions.value.filter((s) => s.localDay.startsWith(currentMonth)).length,
);
const monthDays = computed(() => calendar(month.value, byDay.value));
const firstMonth = computed(
  () => sessions.value[0]?.localDay.slice(0, 7) || currentMonth,
);
const startingDay = computed(() => periodStart(today, period.value));
const inPeriod = (day) => day >= startingDay.value && day <= today;
const weightPoints = computed(() =>
  weights.value
    .filter((p) => inPeriod(p.day))
    .map((p) => ({
      date: p.day,
      label: fullDate.format(new Date(p.day + "T12:00:00Z")),
      axisLabel: dayLabel(p.day),
      value: p.kg,
    })),
);
const lastWeight = computed(() => weights.value.at(-1));
const weightChange = computed(() =>
  weights.value.length >= 2
    ? Math.round((lastWeight.value.kg - weights.value.at(-2).kg) * 100) / 100
    : null,
);
const exercises = computed(() => exerciseProgress(sessions.value));
watch(
  exercises,
  (list) => {
    if (!list.some(({ id }) => id === selection.value))
      selection.value = list[0]?.id || "";
  },
  { immediate: true },
);
const loadPoints = computed(() =>
  (exercises.value.find((b) => b.id === selection.value)?.points || [])
    .filter((p) => inPeriod(p.day))
    .map((p) => ({
      ...p,
      label: timeLabel(p.date),
      axisLabel: dayLabel(p.day),
    })),
);
const best = computed(() =>
  loadPoints.value.length
    ? Math.max(...loadPoints.value.map((p) => p.value))
    : null,
);
const measuredVolume = (s) =>
  Number.isFinite(s.metrics?.volume) &&
  s.snapshot?.blocks.some((b) =>
    b.sets.some(
      (set) =>
        set.status === "recorded" &&
        Number.isFinite(set.actualKg) &&
        Number.isFinite(set.actualReps),
    ),
  );
const volumePoints = computed(() =>
  sessions.value
    .filter((s) => inPeriod(s.localDay) && measuredVolume(s))
    .map((s) => ({
      date: s.completedAt,
      label: timeLabel(s.completedAt),
      axisLabel: dayLabel(s.localDay),
      value: s.metrics.volume,
    })),
);
const history = computed(() => [...sessions.value].reverse());
onMounted(async () => {
  const [weightResult, weekResult] = await Promise.allSettled([
    api("/weights"),
    api("/weekly/" + localDate()),
    w.init(),
  ]);
  if (weightResult.status === "fulfilled")
    weights.value = weightResult.value
      .filter((p) => p.day <= today && Number.isFinite(p.kg))
      .sort((a, b) => a.day.localeCompare(b.day));
  else
    requestError.value =
      "Misurazioni del peso temporaneamente non disponibili.";
  if (weekResult.status === "fulfilled") week.value = weekResult.value;
  loading.value = false;
});
</script>

<template>
  <header class="feature-heading progress-heading">
    <span class="feature-icon"><Icon name="chart" :size="27" /></span>
    <h1>I tuoi progressi<span class="mint">.</span></h1>
  </header>
  <div class="progress-stack">
    <p v-if="loading" class="note" role="status">Caricamento progressi…</p>
    <p v-if="requestError" class="warning" role="alert">{{ requestError }}</p>
    <div
      class="progress-period"
      role="group"
      aria-label="Intervallo dei grafici"
    >
      <button
        v-for="[value, label] in periods"
        :key="value"
        type="button"
        class="btn secondary"
        :class="{ 'is-selected': period === value }"
        :aria-pressed="period === value"
        @click="period = value"
      >
        {{ label }}
      </button>
    </div>
    <div class="progress-grid">
      <section class="card progress-card" aria-labelledby="progress-weight">
        <h2 id="progress-weight">Peso corporeo</h2>
        <div v-if="lastWeight" class="progress-headline">
          <div>
            <span>Ultima misurazione</span
            ><strong>{{ numeric.format(lastWeight.kg) }} kg</strong>
          </div>
          <div v-if="weightChange !== null">
            <span>Rispetto alla precedente</span>
            <strong
              >{{ weightChange > 0 ? "+" : ""
              }}{{ numeric.format(weightChange) }} kg</strong
            >
          </div>
          <time :datetime="lastWeight.day">{{ dayLabel(lastWeight.day) }}</time>
        </div>
        <LineChart
          v-if="!loading && !requestError"
          :points="weightPoints"
          label="Andamento peso corporeo"
          unit="kg"
          empty="Nessuna misurazione in questo periodo."
        />
      </section>

      <section class="card progress-card" aria-labelledby="progress-frequency">
        <h2 id="progress-frequency">Frequenza allenamenti</h2>
        <div class="progress-headline">
          <div>
            <span>Questa settimana</span
            ><strong data-testid="progress-week">{{
              weeks.at(-1).count
            }}</strong>
          </div>
          <div>
            <span>Questo mese</span
            ><strong data-testid="progress-month">{{ thisMonth }}</strong>
          </div>
        </div>
        <p v-if="!sessions.length" class="note">
          Completa un allenamento per iniziare a vedere la frequenza.
        </p>
        <div
          v-else
          class="progress-frequency"
          aria-label="Allenamenti nelle ultime sei settimane"
        >
          <div v-for="entry in weeks" :key="entry.start">
            <span>{{ dayLabel(entry.start) }}</span>
            <meter
              :max="maxWeek"
              :value="entry.count"
              :aria-label="'Settimana dal ' + dayLabel(entry.start)"
            />
            <strong>{{ entry.count }}</strong>
          </div>
        </div>
      </section>

      <section class="card progress-card" aria-labelledby="progress-loads">
        <h2 id="progress-loads">Carichi registrati</h2>
        <label v-if="exercises.length" class="fieldlabel"
          >Esercizio
          <select v-model="selection" class="field">
            <option
              v-for="exercise in exercises"
              :key="exercise.id"
              :value="exercise.id"
            >
              {{ exercise.name }}
            </option>
          </select>
        </label>
        <div v-if="best !== null" class="progress-headline">
          <div>
            <span>Miglior carico del periodo</span
            ><strong>{{ numeric.format(best) }} kg</strong>
          </div>
        </div>
        <LineChart
          :points="loadPoints"
          label="Carico massimo registrato per seduta"
          unit="kg"
          :empty="
            exercises.length
              ? 'Nessun carico per questo esercizio nel periodo scelto.'
              : 'Nessuna serie con peso effettivo registrato.'
          "
        />
        <p v-if="loadPoints.length" class="note">
          Il grafico mostra il carico effettivo più alto di ogni seduta e le
          ripetizioni della serie corrispondente.
        </p>
      </section>

      <section class="card progress-card" aria-labelledby="progress-calendar">
        <h2 id="progress-calendar">Calendario allenamenti</h2>
        <div class="progress-month-nav">
          <button
            type="button"
            class="btn secondary icon-button progress-prev"
            aria-label="Mese precedente"
            :disabled="month <= firstMonth"
            @click="month = moveMonth(month, -1)"
          >
            <Icon name="arrow" :size="17" />
          </button>
          <strong aria-live="polite">{{ monthLabel }}</strong>
          <button
            type="button"
            class="btn secondary icon-button"
            aria-label="Mese successivo"
            :disabled="month >= currentMonth"
            @click="month = moveMonth(month, 1)"
          >
            <Icon name="arrow" :size="17" />
          </button>
        </div>
        <div class="progress-calendar" :aria-label="monthLabel">
          <span
            v-for="label in calendarLabels"
            :key="label"
            class="progress-weekday"
            >{{ label }}</span
          >
          <span
            v-for="(entry, i) in monthDays"
            :key="entry?.day || i"
            :class="{
              'is-completed': entry?.count,
              'is-today': entry?.day === today,
            }"
            :aria-label="
              entry?.count
                ? dayLabel(entry.day) +
                  ', ' +
                  entry.count +
                  ' allenamenti completati'
                : undefined
            "
          >
            {{ entry?.number
            }}<small v-if="entry?.count > 1" aria-hidden="true">
              · {{ entry.count }}</small
            >
          </span>
        </div>
      </section>

      <section class="card progress-card" aria-labelledby="progress-volume">
        <h2 id="progress-volume">Volume registrato</h2>
        <LineChart
          :points="volumePoints"
          label="Volume registrato per seduta"
          unit="kg × rip."
          empty="Nessun volume registrato in questo periodo."
        />
        <p v-if="volumePoints.length" class="note">
          Somma di carico e ripetizioni della stessa serie, moltiplicati tra
          loro. Le serie con dati mancanti possono rendere il totale parziale.
        </p>
      </section>
      <section
        v-if="week"
        class="card progress-card"
        aria-labelledby="progress-nutrition"
      >
        <h2 id="progress-nutrition">Ultimi 7 giorni</h2>
        <p>
          {{ week.consumed }} pasti consumati su {{ week.planned }} nelle
          giornate pianificate.
        </p>
      </section>
    </div>

    <section class="progress-stack" aria-labelledby="progress-history">
      <h2 id="progress-history">Storico allenamenti</h2>
      <p v-if="!history.length && !loading" class="empty">
        Nessun allenamento concluso.
      </p>
      <details
        v-for="h in history"
        :key="h.clientId"
        class="card progress-card"
      >
        <summary>
          {{ h.snapshot?.title || "Scheda" }} · {{ timeLabel(h.completedAt) }} ·
          <template v-if="measuredVolume(h)"
            >{{ numeric.format(h.metrics.volume) }} kg × rip.{{
              h.metrics.volumeIncomplete ? " (parziale)" : ""
            }}</template
          >
          <template v-else>Volume non registrato</template>
        </summary>
        <p class="note">
          {{ h.metrics.recorded }} serie con peso ·
          {{ h.metrics.unlogged }} senza peso · {{ h.metrics.skipped }} saltate
        </p>
        <div
          v-for="b in h.snapshot.blocks"
          :key="b.id"
          class="progress-history-block"
        >
          <h3>{{ b.name }} · {{ phase(b.phase) }}</h3>
          <p v-for="(s, i) in b.sets" :key="s.id">
            Serie {{ i + 1 }} ·
            {{
              s.status === "skipped"
                ? "Saltata"
                : s.status === "unlogged"
                  ? "Completata senza peso"
                  : numeric.format(s.actualKg) + " kg"
            }}
            · {{ s.actualReps ?? "—" }} rip. · Standard all’avvio
            {{
              s.standardAtStart == null
                ? "—"
                : numeric.format(s.standardAtStart) + " kg"
            }}
          </p>
        </div>
      </details>
    </section>
  </div>
</template>
