<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDay, localDate } from "./stores/day";
import Icon from "./components/Icon.vue";
import MealDialog from "./components/MealDialog.vue";
import NutrientSummary from "./components/NutrientSummary.vue";
import DayModeSheet from "./components/DayModeSheet.vue";
import { notify } from "./ui.js";
import { api } from "./api";
const day = useDay(),
  route = useRoute(),
  router = useRouter(),
  selected = ref(null),
  goals = ref(null),
  trainingDays = ref([]),
  today = localDate();
// Giornata aperta (?day=YYYY-MM-DD) oppure panoramica.
const openDate = computed(() => (typeof route.query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(route.query.day) ? route.query.day : null));
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const weekday = (d) => new Date(d + "T12:00:00").getDay();
const label = (d) => (d === today ? "Oggi" : d === shift(today, 1) ? "Domani" : new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
const autoMode = (d) => (trainingDays.value.includes(weekday(d)) ? "ON" : "OFF");
/** Prima data da oggi in poi con quella modalità (oggi usa la modalità reale, anche se scelta a mano). */
function nextDateFor(mode) {
  if (day.date === today && day.mode === mode) return today;
  for (let i = 1; i <= 7; i++) if (autoMode(shift(today, i)) === mode) return shift(today, i);
  return null;
}
const modeCards = computed(() =>
  [
    ["ON", "Giorni di allenamento"],
    ["OFF", "Giorni di riposo"],
  ].map(([mode, kind]) => ({ mode, kind, date: nextDateFor(mode) })),
);
const progress = computed(() => Math.round((100 * (day.count + day.skipped)) / (day.meals.length || 1)));
async function load() {
  await day.load(openDate.value || today);
}
watch(openDate, load);
onMounted(async () => {
  load();
  try {
    const s = (await api("/personal-settings")).data;
    goals.value = s.goals;
    trainingDays.value = s.trainingDays || [];
  } catch {}
});
const open = (date) => router.push({ path: "/dieta", query: { day: date } });
async function toggle(meal) {
  const was = !!meal.consumedAt, id = meal.id, name = meal.name;
  if (await day.toggle(id))
    notify(was ? `${name}: consumo annullato` : `${name} segnato come mangiato`, async () => {
      if (day.isDone(id) !== was) await day.toggle(id);
    });
}
async function skip(meal, skipped = true) {
  const id = meal.id, name = meal.name;
  if (await day.skip(id, skipped))
    notify(skipped ? `${name} saltato` : `${name}: salto annullato`, skipped ? async () => { await day.skip(id, false); } : null);
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
  <!-- Panoramica: come Allenamenti, una card per tipo di giorno -->
  <template v-if="!openDate">
    <div class="pagehead">
      <div>
        <div class="focus-label">{{ day.plan?.title || "Alimentazione" }}</div>
        <h1>Dieta<em>.</em></h1>
      </div>
      <RouterLink to="/altro/piani" class="btn secondary sm">Piani</RouterLink>
    </div>
    <p v-if="day.error && day.plan" role="alert" class="warning">{{ day.error }}</p>
    <div v-if="day.plan && day.planUsesModes" class="training-cards">
      <article
        v-for="c in modeCards"
        :key="c.mode"
        class="card training-card"
        :class="{ today: c.date === today }"
        :data-testid="'diet-mode-' + c.mode"
      >
        <div class="section-head">
          <span class="focus-label">{{ c.kind }}</span>
          <span v-if="c.date === today" class="tag ok">Oggi</span>
        </div>
        <h2>Giorno {{ c.mode }}</h2>
        <p v-if="c.date === today" class="note">
          {{ day.meals.length }} pasti · {{ day.count }} fatti<template v-if="day.next"> · prossimo {{ day.next.name }} {{ day.next.time }}</template>
        </p>
        <p v-else-if="c.date" class="note">Prossimo: {{ label(c.date) }}</p>
        <p v-else class="note">
          Nessun giorno {{ c.mode }} in programma.
          <RouterLink to="/altro/preferenze#giorni-allenamento">Scegli i giorni di allenamento</RouterLink>
        </p>
        <div class="training-actions">
          <button v-if="c.date" class="btn primary" style="grid-column: 1 / -1" @click="open(c.date)">
            <Icon name="play" :size="15" /> {{ c.date === today ? "Apri giornata" : "Apri " + label(c.date).toLowerCase() }}
          </button>
        </div>
      </article>
    </div>
    <div v-else-if="day.plan" class="training-cards">
      <article v-for="d in [today, shift(today, 1)]" :key="d" class="card training-card" :class="{ today: d === today }">
        <h2>{{ label(d) }}</h2>
        <button class="btn primary wide" @click="open(d)"><Icon name="play" :size="15" /> Apri giornata</button>
      </article>
    </div>
    <section v-else-if="!day.busy" class="card empty">
      <h2>Nessun piano attivo</h2>
      <p>Crea o importa un piano alimentare.</p>
      <RouterLink class="btn primary" to="/altro/piani">Vai ai piani</RouterLink>
    </section>
    <p v-if="day.plan && day.plan.provenance !== 'manual'" class="source-note">
      {{ day.plan.provenance === "csv" ? "Piano importato: verifica fonti e revisione con il professionista." : "Piano storico: da rivedere con il professionista." }}
    </p>
  </template>

  <!-- Giornata aperta: solo l'essenziale, il resto a richiesta -->
  <template v-else>
    <RouterLink to="/dieta" class="page-back">‹ Dieta</RouterLink>
    <div class="session-bar">
      <h1>{{ label(openDate) }}<em>.</em></h1>
      <div class="rowbtns">
        <button type="button" class="iconbtn" aria-label="Giorno precedente" @click="open(shift(openDate, -1))"><Icon name="arrow" :size="18" style="transform: rotate(180deg)" /></button>
        <button type="button" class="iconbtn" aria-label="Giorno successivo" @click="open(shift(openDate, 1))"><Icon name="arrow" :size="18" /></button>
      </div>
    </div>
    <DayModeSheet v-if="day.planUsesModes && day.plan" />
    <p v-if="day.error" role="alert" class="warning">{{ day.error }}</p>
    <p v-if="day.planId && day.plan && (day.planOutdated || day.plan.id !== day.planId)" class="warning">
      Questa giornata conserva il piano con cui è stata preparata.
      <button v-if="!day.meals.some((m) => m.consumedAt || m.skippedAt)" class="btn secondary sm" :disabled="day.busy" @click="applyPlan">Usa il piano attivo</button>
    </p>
    <template v-if="day.meals.length">
      <div class="progressbar diet-progress" role="progressbar" aria-label="Pasti fatti" :aria-valuenow="day.count" aria-valuemin="0" :aria-valuemax="day.meals.length">
        <i :style="{ width: progress + '%' }"></i>
      </div>
      <p class="note">{{ day.count }} di {{ day.meals.length }} pasti<template v-if="day.skipped"> · {{ day.skipped }} saltat{{ day.skipped === 1 ? "o" : "i" }}</template></p>
      <section v-if="day.next && openDate <= today" class="card next-card" data-testid="next-meal">
        <div class="focus-label">Prossimo pasto · {{ day.next.time }}</div>
        <h2>{{ day.next.name }}</h2>
        <p class="note">{{ day.choice(day.next).desc }}</p>
        <div class="row">
          <button class="btn primary" :disabled="day.busy" @click="toggle(day.next)"><Icon name="check" :size="16" /> Mangiato</button>
          <button class="btn secondary" @click="selected = day.next">Sostituisci</button>
          <button class="btn ghost" :disabled="day.busy" @click="skip(day.next)">Salta</button>
        </div>
      </section>
      <section class="card">
        <div class="section-head"><h2>Pasti</h2><span v-if="openDate > today" class="tag">Scegli le sostituzioni</span></div>
        <div data-testid="meal-list">
          <div v-for="meal in day.meals" :key="meal.id" class="home-meal-row">
            <button
              v-if="meal.skippedAt"
              class="meal-check-mini skipped"
              :disabled="day.busy"
              :aria-label="'Annulla salto: ' + meal.name"
              @click="skip(meal, false)"
            ><Icon name="skip" :size="16" /></button
            ><button
              v-else
              class="meal-check-mini"
              :class="{ done: meal.consumedAt }"
              :disabled="day.busy || openDate > today"
              :aria-label="(meal.consumedAt ? 'Annulla ' : 'Mangiato ') + meal.name"
              :aria-pressed="!!meal.consumedAt"
              @click="toggle(meal)"
            ><Icon :name="meal.consumedAt ? 'check' : 'plus'" :size="17" /></button
            ><button class="meal-row-main" :class="{ done: meal.consumedAt, skipped: meal.skippedAt }" @click="selected = meal">
              <strong>{{ meal.name }}</strong><small>{{ meal.skippedAt ? "Saltato" : day.choice(meal).title }}</small></button
            ><button class="meal-row-hour" :aria-label="'Alternative ' + meal.name" @click="selected = meal">{{ meal.time }} <Icon name="arrow" :size="13" /></button>
          </div>
        </div>
      </section>
    </template>
    <p v-else-if="!day.busy" class="empty">Nessun pasto programmato per questa giornata.</p>
    <details class="card fold">
      <summary><h2>Nutrienti</h2></summary>
      <NutrientSummary :totals="day.nutrientTotals" :goals="goals" />
    </details>
    <details class="card fold">
      <summary><h2>Lista della spesa</h2></summary>
      <p class="note">Dalle alternative scelte per questa giornata. Alimenti alternativi e unità diverse non vengono sommati.</p>
      <label v-for="item in day.shopping" :key="item.id" class="grocery-item"
        ><input type="checkbox" :checked="item.checked" :disabled="day.busy" @change="day.checkShopping(item.id, $event.target.checked)" /><span
          >{{ item.label }}<small v-if="item.servings > 1"> · {{ item.servings }} porzioni</small></span
        ></label
      >
    </details>
    <details v-if="day.plan?.notes" class="card fold">
      <summary><h2>Note del piano</h2></summary>
      <p class="note" style="white-space: pre-line">{{ day.plan.notes }}</p>
    </details>
  </template>
  <MealDialog :meal="selected" @close="selected = null" />
</template>
<style scoped>
.diet-progress { height: 8px; border-radius: 99px; background: var(--panel2); overflow: hidden; margin-top: 14px; }
.diet-progress i { display: block; height: 100%; background: var(--sage); transition: width .4s; }
.fold > summary { list-style: none; display: flex; align-items: center; min-height: 44px; cursor: pointer; }
.fold > summary::-webkit-details-marker { display: none; }
.fold > summary h2 { margin: 0; font-size: 20px; }
.fold > summary::after { content: "+"; margin-left: auto; font-size: 22px; color: var(--muted); }
.fold[open] > summary::after { content: "–"; }
.session-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.session-bar h1 { margin: 0; }
</style>
