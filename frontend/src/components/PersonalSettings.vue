<script setup>
import { ref, onMounted } from "vue";
import { api, send } from "../api";
import FoodChips from "./FoodChips.vue";
import { weekdays } from "../workout-display";
const data = ref(null),
  revision = ref(0),
  busy = ref(false),
  error = ref(""),
  message = ref(""),
  suggested = ref(null),
  hasGoals = ref(false),
  savedGoals = ref(false);
const labels = {
  kcal: "Calorie (kcal)",
  protein_g: "Proteine (g)",
  carbs_g: "Carboidrati (g)",
  fat_g: "Grassi (g)",
};
async function load() {
  busy.value = true;
  error.value = "";
  try {
    const r = await api("/personal-settings");
    data.value = { ...r.data, trainingDays: r.data.trainingDays || [] };
    revision.value = r.revision;
    suggested.value = r.suggestedGoals;
    hasGoals.value = !!r.data.goals;
    savedGoals.value = !!r.data.goals;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
function defaults() {
  if (savedGoals.value) return;
  data.value.goals = { ...suggested.value };
  hasGoals.value = true;
  message.value =
    "Valori indicativi proposti: salvali solo se appropriati per te. Non sono una prescrizione clinica.";
}
function toggle() {
  if (hasGoals.value && !data.value.goals)
    data.value.goals = {
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    };
}
async function save() {
  if (
    !confirm(
      "Salvare queste preferenze e gli obiettivi per il tuo account? Non verrà modificato alcun piano alimentare.",
    )
  )
    return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const payload = {
      favoriteFoods: data.value.favoriteFoods,
      avoidedFoods: data.value.avoidedFoods,
      goals: hasGoals.value ? data.value.goals : null,
    };
    const r = await send("/personal-settings", {
      data: payload,
      revision: revision.value,
      confirm: true,
    });
    data.value = { ...r.data, trainingDays: r.data.trainingDays || [] };
    revision.value = r.revision;
    savedGoals.value = !!r.data.goals;
    message.value = "Preferenze personali salvate";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section
    class="card account-form workout-block"
    aria-label="Preferenze e obiettivi personali"
  >
    <h2>Preferenze alimentari e obiettivi</h2>
    <p class="note">
      Informazioni private e modificabili. Non cambiano automaticamente la dieta
      e non sostituiscono il confronto con il professionista.
    </p>
    <p v-if="error" role="alert" class="warning">{{ error }}</p>
    <p v-if="message" role="status" class="inline-note">{{ message }}</p>
    <form v-if="data" @submit.prevent="save">
      <fieldset :disabled="busy" class="plain-fieldset">
        <FoodChips
          v-model="data.favoriteFoods"
          id="favorite-foods"
          label="Alimenti preferiti"
        />
        <FoodChips
          v-model="data.avoidedFoods"
          id="avoided-foods"
          label="Alimenti non graditi"
        />
        <div class="divider"></div>
        <fieldset id="giorni-allenamento" class="checks" tabindex="-1">
          <legend>Giorni di allenamento</legend>
          <label v-for="d in [1, 2, 3, 4, 5, 6, 0]" :key="d"
            ><input v-model="data.trainingDays" type="checkbox" :value="d" />{{ weekdays[d] }}</label
          >
        </fieldset>
        <p class="note">
          Decidono in automatico se un giorno è ON o OFF. Puoi sempre cambiarlo a
          mano per una singola data e tornare all'automatico.
        </p>
        <div class="divider"></div>
        <h3>Obiettivi indicativi</h3>
        <label class="grocery-item"
          ><input v-model="hasGoals" type="checkbox" @change="toggle" /><span
            >Configura i miei obiettivi nutrizionali</span
          ></label
        >
        <button
          v-if="!savedGoals"
          type="button"
          class="btn secondary"
          @click="defaults"
        >
          Proponi 2.900 kcal · P 140 / C 405 / G 80
        </button>
        <div v-if="hasGoals && data.goals" class="field-row">
          <label v-for="(label, key) in labels" :key="key" class="fieldlabel"
            >{{ label
            }}<input
              v-model.number="data.goals[key]"
              type="number"
              min="0.1"
              :max="key === 'kcal' ? 10000 : key === 'carbs_g' ? 2000 : 1000"
              step="0.1"
              required
              class="field"
          /></label>
        </div>
        <p class="source-note">
          I valori già salvati vengono caricati e non sono sovrascritti
          automaticamente. Disattivando gli obiettivi e salvando, li rimuovi
          esplicitamente.
        </p>
        <button class="btn primary wide" :disabled="busy">
          {{ busy ? "Salvataggio…" : "Salva preferenze e obiettivi" }}
        </button>
      </fieldset>
    </form>
    <button type="button" class="btn ghost" :disabled="busy" @click="load">
      Ricarica impostazioni salvate
    </button>
  </section>
</template>
