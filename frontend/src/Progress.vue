<script setup>
import { ref, computed, onMounted } from "vue";
import { useWorkout } from "./stores/workout";
import { api } from "./api";
import { localDate } from "./stores/day";
import LineChart from "./components/LineChart.vue";
const w = useWorkout(),
  weights = ref([]),
  error = ref(""),
  selection = ref(""),
  week = ref(null);
const exercises = computed(() => [
  ...new Map(
    w.history.flatMap((h) =>
      h.snapshot.blocks
        .filter((b) => b.sets.some((s) => s.status === "recorded"))
        .map((b) => [
          `${h.programId}:${b.id}`,
          {
            id: `${h.programId}:${b.id}`,
            name: b.name + " · " + b.phase + " · programma " + h.programId,
          },
        ]),
    ),
  ).values(),
]);
const loadPoints = computed(() =>
  [...w.history].reverse().flatMap((h) => {
    const sets = h.snapshot.blocks
      .filter((b) => `${h.programId}:${b.id}` === selection.value)
      .flatMap((b) => b.sets)
      .filter((s) => s.status === "recorded");
    return sets.length
      ? [
          {
            label: new Date(h.completedAt).toLocaleDateString("it-IT"),
            value: Math.max(...sets.map((s) => s.actualKg)),
          },
        ]
      : [];
  }),
);
const volumePoints = computed(() =>
  [...w.history].reverse().map((h) => ({
    label: new Date(h.completedAt).toLocaleDateString("it-IT"),
    value: h.metrics.volume,
  })),
);
onMounted(async () => {
  await w.init();
  try {
    [weights.value, week.value] = await Promise.all([
      api("/weights"),
      api("/weekly/" + localDate()),
    ]);
    selection.value = exercises.value[0]?.id || "";
  } catch (e) {
    error.value = e.message;
  }
});
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="eyebrow">DATI REGISTRATI</div>
      <h1>I tuoi progressi<span class="mint">.</span></h1>
    </div>
  </div>
  <p v-if="error" role="alert">{{ error }}</p>
  <section v-if="week" class="card">
    <h2>Ultimi 7 giorni</h2>
    <p>
      {{ week.consumed }} pasti consumati su {{ week.planned }} pianificati
      nelle giornate salvate · {{ week.workouts }} allenamenti conclusi.
    </p>
    <p class="source-note">
      Il riepilogo considera solo dati salvati. Le giornate mai pianificate non
      sono conteggiate.
    </p>
  </section>
  <div class="griddash">
    <section class="card">
      <h2>Peso corporeo</h2>
      <LineChart
        :points="weights.map((p) => ({ label: p.day, value: p.kg }))"
        label="Andamento peso corporeo"
        unit="kg"
      />
    </section>
    <section class="card">
      <h2>Carichi registrati</h2>
      <label class="fieldlabel"
        >Esercizio<select v-model="selection" class="field">
          <option v-for="b in exercises" :key="b.id" :value="b.id">
            {{ b.name }}
          </option>
        </select></label
      ><LineChart
        :points="loadPoints"
        label="Carico massimo registrato per seduta"
        unit="kg"
      />
      <p class="source-note">
        Massimo dei pesi effettivi registrati nella seduta. Nessun peso dedotto
        dallo standard.
      </p>
    </section>
    <section class="card">
      <h2>Volume registrato</h2>
      <LineChart
        :points="volumePoints"
        label="Volume registrato per seduta"
        unit="kg × rip."
      />
      <p class="source-note">
        Somma peso × ripetizioni registrati. Serie senza peso o senza
        ripetizioni escluse: il totale può essere parziale. Per circuiti e
        lavoro per gamba indica solo ripetizioni effettive totali che vuoi
        conteggiare; non vengono moltiplicate automaticamente.
      </p>
    </section>
  </div>
  <h2>Storico allenamenti</h2>
  <p v-if="!w.history.length" class="empty">Nessun allenamento concluso.</p>
  <details v-for="h in w.history" :key="h.clientId" class="card workout-block">
    <summary>
      Scheda {{ h.day }} ·
      {{ new Date(h.completedAt).toLocaleString("it-IT") }} ·
      {{ h.metrics.volume }} kg × rip.
      {{ h.metrics.volumeIncomplete ? "(parziale)" : "" }}
    </summary>
    <p>
      {{ h.metrics.recorded }} serie con peso · {{ h.metrics.unlogged }} senza
      peso · {{ h.metrics.skipped }} saltate
    </p>
    <div v-for="b in h.snapshot.blocks" :key="b.id">
      <h3>{{ b.name }} · {{ b.phase }}</h3>
      <p v-for="s in b.sets" :key="s.id">
        {{ s.id }} ·
        {{
          s.status === "skipped"
            ? "Saltata"
            : s.status === "unlogged"
              ? "Completata senza peso"
              : s.actualKg + " kg"
        }}
        · {{ s.actualReps ?? "—" }} rip. · Standard all’avvio
        {{ s.standardAtStart ?? "—" }} kg
      </p>
    </div>
  </details>
</template>
