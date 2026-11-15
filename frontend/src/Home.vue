<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useDay, localDate } from "./stores/day.js";
import Icon from "./components/Icon.vue";
import MealDialog from "./components/MealDialog.vue";
import { api } from "./api";
const day = useDay(),
  router = useRouter(),
  selected = ref(null),
  message = ref(""),
  tomorrow = ref(null),
  intakes = ref([]);
const date = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());
function alternatives(id) {
  selected.value = day.meals.find((m) => m.id === id);
}
async function toggle(id) {
  if (await day.toggle(id)) message.value = "Pasto aggiornato";
}
const dayStarted = localDate();
let interval;
onMounted(async () => {
  await day.load();
  try {
    [tomorrow.value, intakes.value] = await Promise.all([
      api("/days/" + localDate(1)),
      api("/intakes/" + localDate()),
    ]);
  } catch {}
  interval = setInterval(() => {
    if (localDate() !== dayStarted) location.reload();
  }, 60000);
});
onUnmounted(() => clearInterval(interval));
</script>
<template>
  <div class="welcome-bar">
    <div>
      <div class="focus-label">IL TUO OGGI · {{ date.toUpperCase() }}</div>
      <h1>La tua giornata<span style="color: var(--accent)">.</span></h1>
      <p>Prima mangia e allenati, poi pensa alle statistiche.</p>
    </div>
    <span class="pill">PULSE 2.1</span>
  </div>
  <div class="source-note phase-note">
    Piano storico del 17/09/2026, validità originale 30–40 giorni: da rivedere
    con il professionista.
  </div>
  <p v-if="day.error" role="alert" class="warning">{{ day.error }}</p>
  <p v-if="day.busy" role="status">Caricamento…</p>
  <div v-if="day.meals.length" class="dashboard v2">
    <div class="v2-columns">
      <div>
        <section class="card">
          <div class="home-control-head">
            <div>
              <div class="focus-label">01 · COSA MANGIO</div>
              <h2>I pasti di oggi</h2>
            </div>
            <div class="switch-seg" role="group" aria-label="Seleziona giorno">
              <button
                v-for="mode in ['ON', 'OFF']"
                :key="mode"
                :class="{ active: day.mode === mode }"
                :aria-pressed="day.mode === mode"
                @click="day.setMode(mode)"
              >
                {{ mode }}
              </button>
            </div>
          </div>
          <div class="today-sub">
            {{ day.count }}/{{ day.meals.length }} completati · Tocca un pasto
            per cambiarlo
          </div>
          <div class="mini-progress">
            <span
              :style="{
                width: (100 * day.count) / (day.meals.length || 1) + '%',
              }"
            ></span>
          </div>
          <div
            v-if="day.next"
            class="meal-next"
            style="margin-top: 16px"
            data-testid="next-meal"
          >
            <div class="focus-label">PROSSIMO PASTO · {{ day.next.time }}</div>
            <div class="txt">
              {{ day.next.name }} — {{ day.choice(day.next).title }}
            </div>
            <div class="desc">{{ day.choice(day.next).desc }}</div>
            <div class="home-cta">
              <button
                class="btn primary"
                :disabled="day.busy"
                @click="toggle(day.next.id)"
              >
                <Icon name="check" :size="15" /> Mangiato</button
              ><button class="btn secondary" @click="alternatives(day.next.id)">
                Sostituisci
              </button>
            </div>
          </div>
          <div v-else class="inline-note">
            Tutti i pasti sono segnati come consumati!
          </div>
          <div class="home-list-heading">TUTTI I PASTI DI OGGI</div>
          <div data-testid="meal-list">
            <div
              v-for="meal in day.meals"
              :key="meal.id"
              class="home-meal-row"
              :class="{ active: !day.isDone(meal.id) }"
            >
              <button
                class="meal-check-mini"
                :disabled="day.busy"
                :class="{ done: day.isDone(meal.id) }"
                :aria-label="
                  (day.isDone(meal.id)
                    ? 'Annulla pasto: '
                    : 'Segna mangiato: ') + meal.name
                "
                :aria-pressed="day.isDone(meal.id)"
                @click="toggle(meal.id)"
              >
                <Icon
                  :name="day.isDone(meal.id) ? 'check' : 'plus'"
                  :size="17"
                /></button
              ><button
                class="meal-row-main"
                :class="{ done: day.isDone(meal.id) }"
                @click="alternatives(meal.id)"
              >
                <strong>{{ meal.name }}</strong
                ><small>{{ day.choice(meal).title }}</small></button
              ><button
                class="meal-row-hour"
                :aria-label="'Alternative ' + meal.name"
                @click="alternatives(meal.id)"
              >
                {{ meal.time }} <Icon name="arrow" :size="13" />
              </button>
            </div>
          </div>
          <div class="source-note">
            Alimenti pesati a crudo salvo indicazioni specifiche. Valori
            nutrizionali non disponibili. Le note originali sono consultabili in
            Dieta.
          </div>
        </section>
      </div>
      <div class="dashboard v2">
        <section class="card">
          <div class="home-control-head">
            <div>
              <div class="focus-label">02 · ALLENAMENTO</div>
              <h2>Allenamento</h2>
            </div>
            <span class="pill grey">SCHEDA A</span>
          </div>
          <div class="meal-preview">
            <div class="action-icon"><Icon name="gym" :size="24" /></div>
            <div class="mealinfo">
              <h3>Petto · Tricipiti · Addome</h3>
              <p>Carichi da impostare, recuperi e note del trainer</p>
            </div>
          </div>
          <button class="btn primary wide" disabled>
            <Icon name="bolt" :size="15" /> Inizia allenamento
          </button>
          <div class="source-note">
            Disponibile nella fase allenamento. La scheda resterà completa, con
            salto di singole serie ed esercizi.
          </div>
        </section>
        <div class="home-compact-grid">
          <button class="quick-action" @click="router.push('/altro')">
            <Icon name="weight" /><span
              ><strong>Registra peso</strong><small>Apri registro</small></span
            ></button
          ><button class="quick-action" @click="router.push('/altro')">
            <Icon name="plus" /><span
              ><strong>Integratori</strong><small>Apri registro</small></span
            >
          </button>
        </div>
        <section class="card">
          <div class="home-control-head">
            <div>
              <div class="focus-label">03 · ORGANIZZATI</div>
              <h2>Prepara domani</h2>
            </div>
            <span class="pill grey">{{
              tomorrow?.revision > 0
                ? "PROGRAMMATO · " + tomorrow.mode
                : "DA PREPARARE"
            }}</span>
          </div>
          <p class="note">
            Imposta giorno ON/OFF e scegli le sostituzioni prima di domani.
          </p>
          <button
            class="btn secondary wide"
            @click="
              router.push({ path: '/dieta', query: { day: localDate(1) } })
            "
          >
            <Icon name="calendar" :size="16" /> Organizza domani
          </button>
          <div class="source-note">
            Scegli la data di domani nella pagina Dieta: ogni modifica viene
            salvata.
          </div>
        </section>
        <section class="card">
          <div class="home-control-head">
            <div>
              <div class="focus-label">04 · PROMEMORIA</div>
              <h2>Non dimenticarti</h2>
            </div>
            <span class="pill grey">NON ATTIVI</span>
          </div>
          <div class="soft-row">
            <div>
              <b>Prossimo pasto</b>
              <div class="meta">
                {{
                  day.next
                    ? day.next.name + " · " + day.next.time
                    : "Pasti completati"
                }}
              </div>
            </div>
            <button class="btn secondary sm" disabled>Rimanda</button>
          </div>
          <div class="soft-row">
            <div>
              <b>Integratori</b>
              <div class="meta">{{ intakes.length }} assunzioni registrate</div>
            </div>
            <button class="btn secondary sm" disabled>Gestisci</button>
          </div>
          <div class="source-note">Notifiche previste nella fase 3.</div>
        </section>
      </div>
    </div>
    <div class="home-compact-grid">
      <RouterLink to="/progressi" class="quick-action"
        ><Icon name="chart" /><span
          ><strong>Settimana</strong><small>Riepilogo e progressi</small></span
        ></RouterLink
      ><RouterLink to="/dieta" class="quick-action"
        ><Icon name="food" /><span
          ><strong>Tutta la dieta</strong
          ><small>Pasti, alternative, spesa</small></span
        ></RouterLink
      >
    </div>
  </div>
  <p role="status" class="source-note">{{ message }}</p>
  <MealDialog :meal="selected" @close="selected = null" />
</template>
