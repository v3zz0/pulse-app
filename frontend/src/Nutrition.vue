<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useDay, localDate } from "./stores/day";
import Icon from "./components/Icon.vue";
import MealDialog from "./components/MealDialog.vue";
import NutrientSummary from "./components/NutrientSummary.vue";
import { api } from "./api";
const goals = ref(null);
onMounted(async () => {
  try {
    goals.value = (await api("/personal-settings")).data.goals;
  } catch {}
});
const day = useDay(),
  selected = ref(null),
  route = useRoute();
onMounted(() =>
  day.load(typeof route.query.day === "string" ? route.query.day : localDate()),
);
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
      <h1>La tua dieta<span style="color: var(--accent)">.</span></h1>
    </div>
  </div>
  <div class="editor-launch">
    <RouterLink to="/dieta/editor" class="btn primary"><Icon name="plus" :size="18" /> Crea nuova dieta</RouterLink>
    <RouterLink to="/altro/piani" class="btn secondary">Gestisci piani</RouterLink>
  </div>
  <section class="card workout-block">
    <div class="todayline">
      <label
        >Giornata
        <input
          :value="day.date"
          type="date"
          class="field"
          @change="day.load($event.target.value)"
      /></label>
      <div v-if="day.planUsesModes && day.plan" class="switch-seg">
        <button
          v-for="mode in ['ON', 'OFF']"
          :key="mode"
          :class="{ active: day.mode === mode }"
          :disabled="day.busy"
          @click="day.setMode(mode)"
        >
          {{ mode }}
        </button>
      </div>
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
  <div class="section-title"><h2>I tuoi pasti</h2></div>
  <p v-if="!day.busy && !day.meals.length" class="note">Nessun pasto programmato per questa giornata.</p>
  <div class="meal-list">
    <section v-for="meal in day.meals" :key="meal.id" class="card meal-card">
      <button
        class="check-dot"
        :class="{ done: meal.consumedAt }"
        :disabled="day.busy || day.date > localDate()"
        :aria-label="(meal.consumedAt ? 'Annulla ' : 'Mangiato ') + meal.name"
        @click="day.toggle(meal.id)"
      >
        {{ meal.consumedAt ? "✓" : "+" }}</button
      ><button class="meal-row-main" @click="selected = meal">
        <strong>{{ meal.name }}</strong
        ><small>{{ day.choice(meal).title }}</small>
      </button>
    </section>
  </div>
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
  <details v-if="day.plan?.notes" class="card" style="margin-top: 14px">
    <summary>Note del piano</summary>
    <p class="note" style="white-space: pre-line">{{ day.plan?.notes }}</p>
  </details>
  <MealDialog :meal="selected" @close="selected = null" />
</template>
