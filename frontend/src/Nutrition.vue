<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useDay, localDate } from "./stores/day";
import Icon from "./components/Icon.vue";
import MealDialog from "./components/MealDialog.vue";
import NutrientSummary from "./components/NutrientSummary.vue";
import DayModeSheet from "./components/DayModeSheet.vue";
import { computed } from "vue";
import { notify } from "./ui.js";
import { api } from "./api";
const goals = ref(null);
onMounted(async () => {
  try {
    goals.value = (await api("/personal-settings")).data.goals;
  } catch {}
});
const day = useDay(),
  tab = ref("pasti"),
  selected = ref(null),
  route = useRoute();
onMounted(() =>
  day.load(typeof route.query.day === "string" ? route.query.day : localDate()),
);
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const weekStart = computed(() => shift(day.date, -((new Date(day.date + "T12:00:00").getDay() + 6) % 7)));
const week = computed(() => [0, 1, 2, 3, 4, 5, 6].map((i) => shift(weekStart.value, i)));
const short = (d) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short" });
const longLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
const monthLabel = computed(() => { const s = new Date(day.date + "T12:00:00").toLocaleDateString("it-IT", { month: "long", year: "numeric" }); return s[0].toUpperCase() + s.slice(1); });
async function toggle(meal) {
  const was = !!meal.consumedAt, id = meal.id, name = meal.name;
  if (await day.toggle(id))
    notify(was ? `${name}: consumo annullato` : `${name} segnato come mangiato`, async () => {
      if (day.isDone(id) !== was) await day.toggle(id);
    });
}
function applyPlan() {
  if (
    confirm(
      "Usare il piano attivo per questa giornata senza pasti consumati? Le scelte e la spesa della giornata verranno rigenerate; lo storico degli altri giorni resterà invariato.",
    )
  )
    day.change({ action: "apply-plan", confirm: true });
}
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="focus-label">ALIMENTAZIONE</div>
      <h1>La tua dieta<em>.</em></h1>
    </div>
    <RouterLink to="/altro/piani" class="btn secondary sm">Gestisci piani</RouterLink>
  </div>
  <section class="card workout-block">
    <div class="week-nav">
      <button type="button" class="iconbtn" aria-label="Settimana precedente" @click="day.load(shift(weekStart, -7))"><Icon name="arrow" :size="18" style="transform: rotate(180deg)" /></button>
      <strong>{{ monthLabel }}</strong>
      <button type="button" class="iconbtn" aria-label="Settimana successiva" @click="day.load(shift(weekStart, 7))"><Icon name="arrow" :size="18" /></button>
    </div>
    <div class="week-strip" role="group" aria-label="Settimana">
      <button
        v-for="d in week"
        :key="d"
        type="button"
        class="daybtn"
        :class="{ today: d === localDate() }"
        :aria-pressed="d === day.date"
        :aria-label="longLabel(d)"
        @click="day.load(d)"
      >
        <span>{{ short(d) }}</span><b>{{ Number(d.slice(8)) }}</b>
      </button>
    </div>
    <div class="todayline" style="margin-top: 12px">
      <DayModeSheet v-if="day.planUsesModes && day.plan" />
      <label class="sr-only" for="diet-date">Vai alla data</label>
      <input id="diet-date" :value="day.date" type="date" class="field" style="width: auto" @change="$event.target.value && day.load($event.target.value)" />
    </div>
    <button class="btn secondary wide" @click="day.load(localDate(1))">
      Prepara domani
    </button>
    <p v-if="day.plan?.provenance === 'manual'" class="note">{{ day.plan.title }}</p>
    <p v-else-if="day.plan" class="warning">
      {{ day.plan.title }} ·
      {{
        day.plan?.provenance === "csv"
          ? "Piano importato: verifica fonti e revisione professionale."
          : "Validità originale 30–40 giorni. Da rivedere con il professionista."
      }}
    </p>
    <p v-if="day.planId && (day.planOutdated || day.plan?.id !== day.planId)" class="warning">
      Questa giornata conserva il piano con cui è stata preparata. Il nuovo
      piano attivo non modifica i pasti già registrati.
    </p>
    <button
      v-if="
        day.planId &&
        day.plan && (day.planOutdated || day.plan.id !== day.planId) &&
        !day.meals.some((m) => m.consumedAt)
      "
      class="btn secondary"
      :disabled="day.busy"
      @click="applyPlan"
    >
      Usa piano attivo in questa giornata
    </button>
    <p v-if="day.error" role="alert">{{ day.error }}</p>
    <p v-if="day.busy" role="status">Caricamento…</p>
  </section>
  <section class="card workout-block">
    <h2>Nutrienti della giornata</h2>
    <NutrientSummary :totals="day.nutrientTotals" :goals="goals" />
  </section>
  <div class="seg" role="group" aria-label="Sezione" style="margin-top: 14px">
    <button type="button" :aria-pressed="tab === 'pasti'" @click="tab = 'pasti'">Pasti</button>
    <button type="button" :aria-pressed="tab === 'spesa'" @click="tab = 'spesa'">Lista della spesa</button>
  </div>
  <template v-if="tab === 'pasti'">
  <div class="section-title"><h2>I tuoi pasti</h2></div>
  <p v-if="!day.busy && !day.meals.length" class="note">Nessun pasto programmato per questa giornata.</p>
  <div class="meal-list">
    <section v-for="meal in day.meals" :key="meal.id" class="card meal-card">
      <button
        class="check-dot"
        :class="{ done: meal.consumedAt }"
        :disabled="day.busy || day.date > localDate()"
        :aria-label="(meal.consumedAt ? 'Annulla ' : 'Mangiato ') + meal.name"
        @click="toggle(meal)"
      >
        {{ meal.consumedAt ? "✓" : "+" }}</button
      ><button class="meal-row-main" @click="selected = meal">
        <strong>{{ meal.name }}</strong
        ><small>{{ day.choice(meal).title }}</small>
      </button>
    </section>
  </div>
  </template>
  <template v-else>
  <div class="section-title"><h2>Lista della spesa</h2></div>
  <section class="card">
    <p class="note">
      Generata dalle alternative selezionate per {{ day.date }}. Le quantità per
      porzione restano quelle della fonte: non vengono sommati alimenti
      alternativi o unità diverse.
    </p>
    <label v-for="item in day.shopping" :key="item.id" class="grocery-item"
      ><input
        type="checkbox"
        :checked="item.checked"
        :disabled="day.busy"
        @change="day.checkShopping(item.id, $event.target.checked)"
      /><span
        >{{ item.label
        }}<small v-if="item.servings > 1">
          · {{ item.servings }} porzioni</small
        ></span
      ></label
    >
  </section>
  </template>
  <details v-if="day.plan?.notes" class="card" style="margin-top: 14px">
    <summary>Note del piano</summary>
    <p class="note" style="white-space: pre-line">{{ day.plan?.notes }}</p>
  </details>
  <MealDialog :meal="selected" @close="selected = null" />
</template>
