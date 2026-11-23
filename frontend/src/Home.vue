<template>
  <div class="today-head">
    <div>
      <div class="focus-label">{{ date }}</div>
      <h1>{{ greeting }}.<br /><em>Un passo alla volta.</em></h1>
    </div>
  </div>
  <DayModeSheet v-if="day.plan && day.planUsesModes" />
  <div v-if="day.plan && day.plan.provenance !== 'manual'" class="source-note phase-note">
    {{
      day.plan?.provenance === "csv"
        ? "Piano importato: verifica fonti e revisione con il professionista."
        : "Piano storico del 17/09/2026, validità originale 30–40 giorni: da rivedere con il professionista."
    }}
  </div>
  <p v-if="day.error && day.plan" role="alert" class="warning">{{ day.error }}</p>
  <p v-if="day.busy && !day.meals.length" role="status" class="note">Caricamento…</p>
  <div class="today-grid">
    <div>
      <section v-if="day.plan" class="card training-card" :class="{ today: true }" data-testid="diet-today">
        <div class="section-head">
          <span class="focus-label">Dieta di oggi</span>
          <span class="tag ok">{{ day.planUsesModes ? "Giorno " + day.mode : "Oggi" }}</span>
        </div>
        <div class="progressbar home-progress" role="progressbar" aria-label="Pasti fatti" :aria-valuenow="day.count" aria-valuemin="0" :aria-valuemax="day.meals.length">
          <i :style="{ width: percent + '%' }"></i>
        </div>
        <p class="note">{{ day.count }} di {{ day.meals.length }} pasti<template v-if="day.skipped"> · {{ day.skipped }} saltat{{ day.skipped === 1 ? "o" : "i" }}</template></p>
        <div v-if="day.next" data-testid="next-meal">
          <h2>{{ day.next.name }} · {{ day.next.time }}</h2>
          <p class="note">{{ day.choice(day.next).desc }}</p>
        </div>
        <h2 v-else>Tutti i pasti segnati</h2>
        <div class="training-actions">
          <button v-if="day.next" class="btn secondary" :disabled="day.busy" @click="toggle(day.next.id)">
            <Icon name="check" :size="15" /> Mangiato
          </button>
          <button v-if="day.next" class="btn ghost" style="grid-column: 1 / -1" :disabled="day.busy" @click="skip(day.next)">Salta questo pasto</button>
          <RouterLink class="btn primary" :style="day.next ? '' : 'grid-column: 1 / -1'" :to="{ path: '/dieta', query: { day: localDate() } }">
            <Icon name="play" :size="15" /> Apri giornata
          </RouterLink>
        </div>
      </section>
      <section v-else-if="!day.busy" class="card empty">
        <h2>Nessun piano attivo</h2>
        <p>Crea o importa un piano alimentare per vedere i pasti di oggi.</p>
        <RouterLink class="btn primary" to="/altro/piani">Vai ai piani</RouterLink>
      </section>
      <section class="card training-card" :class="{ today: !!suggested || w.active?.status === 'active' }">
        <template v-if="w.active?.status === 'active'">
          <div class="section-head"><span class="focus-label">Allenamento</span><span class="tag ok">In corso</span></div>
          <h2>{{ dayName(w.program, w.active.day) }}</h2>
          <RouterLink class="btn primary wide" to="/allenati"><Icon name="play" :size="15" /> Riprendi allenamento</RouterLink>
        </template>
        <template v-else-if="train && workoutDone">
          <div class="section-head"><span class="focus-label">Allenamento di oggi</span><span class="tag ok">Fatto</span></div>
          <h2>{{ dayName(w.program, suggested) }}</h2>
          <RouterLink class="btn secondary wide" to="/progressi">Vedi progressi</RouterLink>
        </template>
        <template v-else-if="suggested">
          <div class="section-head"><span class="focus-label">Allenamento di oggi</span><span class="tag ok">Oggi</span></div>
          <h2>{{ dayName(w.program, suggested) }}</h2>
          <p class="note">{{ w.program.displaySettings?.days?.[suggested]?.description || w.program.days[suggested].length + " esercizi" }}</p>
          <div class="training-actions">
            <RouterLink class="btn secondary" to="/allenati">Schede</RouterLink>
            <button class="btn primary" :disabled="starting || !!w.queue.length" @click="start(suggested)"><Icon name="play" :size="15" /> Inizia</button>
          </div>
        </template>
        <template v-else>
          <div class="section-head"><span class="focus-label">Allenamento</span></div>
          <h2>{{ day.mode === "ON" ? "Scegli la scheda" : "Giorno di riposo" }}</h2>
          <RouterLink class="btn secondary wide" to="/allenati">Vedi schede</RouterLink>
        </template>
      </section>
    </div>
    <div>
      <TodaySupplements />
      <RouterLink to="/altro#peso" class="quick-action">
        <Icon name="weight" /><span><strong>Registra peso</strong><small>Apri registro</small></span>
      </RouterLink>
    </div>
  </div>
  <MealDialog :meal="selected" @close="selected = null" />
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useDay, localDate } from "./stores/day.js";
import { useWorkout } from "./stores/workout";
import { dayName } from "./workout-display";
import Icon from "./components/Icon.vue";
import TodaySupplements from "./components/TodaySupplements.vue";
import MealDialog from "./components/MealDialog.vue";
import DayModeSheet from "./components/DayModeSheet.vue";
import { notify } from "./ui.js";
const day = useDay(),
  w = useWorkout(),
  router = useRouter(),
  selected = ref(null),
  starting = ref(false);
const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(new Date());
const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(new Date()));
const greeting = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
const weekday = new Date(localDate() + "T12:00:00").getDay();
const suggested = computed(() => {
  const days = w.program?.days ? Object.keys(w.program.days) : [];
  return days.find((k) => w.program.displaySettings?.days?.[k]?.weekdays?.includes(weekday)) || null;
});
const train = computed(() => day.mode === "ON" && !!suggested.value);
const workoutDone = computed(() =>
  (w.history || []).some((h) => h.completedAt && localDate() === new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(h.completedAt))),
);
const percent = computed(() => Math.round((100 * (day.count + day.skipped)) / (day.meals.length || 1)));
async function skip(meal) {
  const id = meal.id, name = meal.name;
  if (await day.skip(id, true)) notify(`${name} saltato`, async () => { await day.skip(id, false); });
}
async function toggle(id) {
  const meal = day.meals.find((m) => m.id === id), was = day.isDone(id);
  if (await day.toggle(id))
    notify(was ? `${meal.name}: consumo annullato` : `${meal.name} segnato come mangiato`, async () => {
      if (day.isDone(id) !== was) await day.toggle(id);
    });
}
async function start(key) {
  starting.value = true;
  try {
    await w.start(key);
    router.push("/allenati");
  } catch (e) {
    notify(e.message);
  } finally {
    starting.value = false;
  }
}
const dayStarted = localDate();
let interval;
onMounted(async () => {
  await day.load();
  interval = setInterval(() => {
    if (localDate() !== dayStarted) location.reload();
  }, 60000);
});
onUnmounted(() => {
  clearInterval(interval);
});
</script>
