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
      <section v-if="day.meals.length" class="card ringwrap" aria-label="Progresso della giornata">
        <div class="ring" :style="{ '--p': percent }" role="img" :aria-label="`Pasti completati al ${percent}%`">
          <span>{{ percent }}%</span>
        </div>
        <div>
          <h2>La tua giornata</h2>
          <p class="note">{{ day.count }} di {{ day.meals.length }} pasti{{ train ? " · allenamento " + (workoutDone ? "fatto" : "da fare") : "" }}</p>
        </div>
      </section>
      <section v-if="day.next" class="card next-card" data-testid="next-meal">
        <div class="focus-label">Prossimo pasto · {{ day.next.time }}</div>
        <h2>{{ day.next.name }}</h2>
        <p class="note">{{ day.choice(day.next).desc }}</p>
        <div class="row">
          <button class="btn primary" :disabled="day.busy" @click="toggle(day.next.id)">
            <Icon name="check" :size="16" /> Mangiato
          </button>
          <button class="btn secondary" @click="alternatives(day.next.id)">Sostituisci</button>
        </div>
      </section>
      <section v-else-if="day.meals.length" class="card next-card">
        <h2>Tutti i pasti segnati</h2>
        <p class="note">Giornata alimentare completa. Puoi annullare un pasto dalla lista.</p>
      </section>
      <section v-else-if="!day.busy" class="card empty">
        <h2>Nessun piano attivo</h2>
        <p>Crea o importa un piano alimentare per vedere i pasti di oggi.</p>
        <RouterLink class="btn primary" to="/altro/piani">Vai ai piani</RouterLink>
      </section>
      <section v-if="day.meals.length" class="card">
        <div class="section-head"><h2>Pasti di oggi</h2><span class="tag">Scorri per segnare</span></div>
        <div data-testid="meal-list">
          <div
            v-for="meal in day.meals"
            :key="meal.id"
            class="home-meal-row"
            :class="{ active: !day.isDone(meal.id) }"
            @pointerdown="swipeStart($event, meal.id)"
          >
            <button
              class="meal-check-mini"
              :disabled="day.busy"
              :class="{ done: day.isDone(meal.id) }"
              :aria-label="(day.isDone(meal.id) ? 'Annulla pasto: ' : 'Segna mangiato: ') + meal.name"
              :aria-pressed="day.isDone(meal.id)"
              @click="toggle(meal.id)"
            >
              <Icon :name="day.isDone(meal.id) ? 'check' : 'plus'" :size="17" /></button
            ><button class="meal-row-main" :class="{ done: day.isDone(meal.id) }" @click="alternatives(meal.id)">
              <strong>{{ meal.name }}</strong><small>{{ day.choice(meal).title }}</small></button
            ><button class="meal-row-hour" :aria-label="'Alternative ' + meal.name" @click="alternatives(meal.id)">
              {{ meal.time }} <Icon name="arrow" :size="13" />
            </button>
          </div>
        </div>
        <div class="source-note">
          Alimenti pesati a crudo salvo indicazioni specifiche. Le note originali sono in Dieta.
        </div>
      </section>
    </div>
    <div>
      <TodaySupplements />
      <section class="card">
        <template v-if="w.active?.status === 'active'">
          <h2>Allenamento in corso</h2>
          <p class="note">{{ dayName(w.program, w.active.day) }}</p>
          <RouterLink class="btn primary wide" to="/allenati">Riprendi allenamento</RouterLink>
        </template>
        <template v-else-if="train && workoutDone">
          <h2>Allenamento fatto</h2>
          <p class="note">{{ dayName(w.program, suggested) }} completato oggi.</p>
          <RouterLink class="btn secondary wide" to="/progressi">Vedi progressi</RouterLink>
        </template>
        <template v-else-if="suggested">
          <div class="focus-label">Allenamento di oggi</div>
          <h2>{{ dayName(w.program, suggested) }}</h2>
          <p class="note">{{ w.program.displaySettings?.days?.[suggested]?.description || w.program.days[suggested].length + " esercizi" }}</p>
          <div class="rowbtns">
            <button class="btn primary" :disabled="starting || !!w.queue.length" @click="start(suggested)">
              <Icon name="play" :size="15" /> Inizia
            </button>
            <RouterLink class="btn secondary" to="/allenati">Vedi schede</RouterLink>
          </div>
        </template>
        <template v-else>
          <h2>{{ day.mode === "ON" ? "Allenamento" : "Giorno di riposo" }}</h2>
          <p class="note">Scegli una scheda A/B/C. Puoi saltare singole serie ed esercizi.</p>
          <RouterLink class="btn secondary wide" to="/allenati"><Icon name="bolt" :size="15" /> Scegli scheda</RouterLink>
        </template>
      </section>
      <div class="home-compact-grid">
        <RouterLink to="/altro#peso" class="quick-action">
          <Icon name="weight" /><span><strong>Registra peso</strong><small>Apri registro</small></span>
        </RouterLink>
        <RouterLink to="/altro/promemoria" class="quick-action">
          <Icon name="bell" /><span><strong>Promemoria</strong><small>Gestisci avvisi</small></span>
        </RouterLink>
      </div>
      <section class="card">
        <div class="section-head">
          <div>
            <div class="focus-label">Domani</div>
            <h2>Prepara domani</h2>
          </div>
          <span class="tag" :class="{ ok: tomorrow?.revision > 0 }">{{
            tomorrow?.revision > 0
              ? "Programmato" + (tomorrow.planUsesModes ? " · " + tomorrow.mode : "")
              : "Da preparare" + (tomorrow?.planUsesModes ? " · " + tomorrow.mode : "")
          }}</span>
        </div>
        <p class="note">Controlla ON/OFF e scegli le sostituzioni: ogni modifica viene salvata.</p>
        <button class="btn secondary wide" @click="router.push({ path: '/dieta', query: { day: localDate(1) } })">
          <Icon name="calendar" :size="16" /> Organizza domani
        </button>
      </section>
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
import { api } from "./api";
import { notify } from "./ui.js";
const day = useDay(),
  w = useWorkout(),
  router = useRouter(),
  selected = ref(null),
  starting = ref(false),
  tomorrow = ref(null);
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
const percent = computed(() => Math.round((100 * day.count) / (day.meals.length || 1)));
function alternatives(id) {
  selected.value = day.meals.find((m) => m.id === id);
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
// Swipe: destra segna, sinistra annulla. Da tastiera resta il pulsante cerchio.
let sw = null;
function swipeStart(e, id) {
  if (e.button) return;
  sw = { id, x: e.clientX, y: e.clientY, dx: 0, on: false, el: e.currentTarget };
}
function swipeMove(e) {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return (sw = null);
    if (Math.abs(dx) < 12) return;
    sw.on = true;
    sw.el.classList.add("swiping");
  }
  sw.dx = dx;
  sw.el.style.transform = `translateX(${Math.max(-110, Math.min(110, dx))}px)`;
}
function swipeEnd() {
  if (!sw) return;
  const { id, dx, on, el } = sw;
  sw = null;
  el.classList.remove("swiping");
  el.style.transform = "";
  if (!on) return;
  // Ignora il click generato dal rilascio dello swipe, solo per un istante.
  const stop = (e) => e.stopPropagation();
  addEventListener("click", stop, true);
  setTimeout(() => removeEventListener("click", stop, true), 60);
  const done = day.isDone(id);
  if ((dx > 80 && !done) || (dx < -80 && done)) toggle(id);
}
const dayStarted = localDate();
let interval;
onMounted(async () => {
  addEventListener("pointermove", swipeMove);
  addEventListener("pointerup", swipeEnd);
  addEventListener("pointercancel", swipeEnd);
  await day.load();
  try {
    tomorrow.value = await api("/days/" + localDate(1));
  } catch {}
  interval = setInterval(() => {
    if (localDate() !== dayStarted) location.reload();
  }, 60000);
});
onUnmounted(() => {
  clearInterval(interval);
  removeEventListener("pointermove", swipeMove);
  removeEventListener("pointerup", swipeEnd);
  removeEventListener("pointercancel", swipeEnd);
});
</script>
