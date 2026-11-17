<script setup>
import { ref, onMounted } from "vue";
import { api, send } from "../api";
import FoodChips from "./FoodChips.vue";
const data = ref(null),
  revision = ref(0),
  busy = ref(false),
  error = ref(""),
  message = ref(""),
  suggested = ref(null),
  hasGoals = ref(false),
  savedGoals = ref(false);
const fields = {
  allergies: "Allergie dichiarate",
  intolerances: "Intolleranze dichiarate",
  easyFoods: "Alimenti facili da preparare",
  breakfast: "Preferenze colazione",
  lunch: "Preferenze pranzo",
  dinner: "Preferenze cena",
  budget: "Vincoli di spesa",
};
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
    data.value = r.data;
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
      ...data.value,
      goals: hasGoals.value ? data.value.goals : null,
    };
    for (const k of ["mealCount"])
      payload[k] = payload[k] === "" ? null : payload[k];
    const r = await send("/personal-settings", {
      data: payload,
      revision: revision.value,
      confirm: true,
    });
    data.value = r.data;
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
      e non sostituiscono il confronto con il professionista. Allergie e
      intolleranze sono dichiarazioni dell’utente, non diagnosi.
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
        <label v-for="(label, key) in fields" :key="key" class="fieldlabel"
          >{{ label
          }}<textarea
            v-model="data[key]"
            class="field"
            rows="2"
            maxlength="2000"
          ></textarea>
        </label>
        <div class="field-row">
          <label class="fieldlabel"
            >Numero di pasti preferito<input
              v-model.number="data.mealCount"
              type="number"
              min="1"
              max="12"
              class="field"
          /></label>
        </div>
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
