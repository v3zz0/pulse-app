<script setup>
import Pwa from "./Pwa.vue";
import { onMounted, ref } from "vue";
import { api, send } from "./api";
import { localDate } from "./stores/day";
const date = ref(localDate()),
  weight = ref(""),
  weights = ref([]),
  message = ref(""),
  error = ref(""),
  busy = ref(false);
async function load() {
  try {
    weights.value = await api("/weights");
  } catch (e) {
    error.value = e.message;
  }
}
async function saveWeight() {
  busy.value = true;
  error.value = "";
  try {
    await send("/weights/" + date.value, { kg: Number(weight.value) });
    await load();
    message.value = "Peso salvato";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="focus-label">IL TUO SPAZIO</div>
      <h1>Il tuo spazio<span style="color: var(--accent)">.</span></h1>
    </div>
  </div>
  <Pwa />
  <section class="card plan-imports" aria-labelledby="plan-settings-title">
    <h2 id="plan-settings-title">Piani e importazioni</h2>
    <p class="note">
      Scarica i modelli, importa ed esporta CSV e gestisci le versioni salvate
      della dieta e della scheda di allenamento.
    </p>
    <div class="plan-import-actions">
      <RouterLink class="btn secondary" to="/altro/piani"
        >Gestisci piano alimentare</RouterLink
      >
      <RouterLink class="btn secondary" to="/altro/schede"
        >Gestisci scheda allenamento</RouterLink
      >
    </div>
  </section>
  <p v-if="error" role="alert" class="warning">{{ error }}</p>
  <p role="status">{{ message }}</p>
  <label class="fieldlabel"
    >Data
    <input
      v-model="date"
      class="field"
      type="date"
      :max="localDate()"
      @change="load"
  /></label>
  <form class="card" style="margin-top: 14px" @submit.prevent="saveWeight">
    <h2>Registra peso</h2>
    <label class="fieldlabel" for="weight">Peso in kg</label
    ><input
      id="weight"
      v-model="weight"
      class="field"
      type="number"
      min="30"
      max="250"
      step="0.1"
      required
    /><button class="btn primary wide" :disabled="busy">Salva peso</button>
    <div
      v-for="entry in weights.slice(-14).reverse()"
      :key="entry.day"
      class="weight-line"
    >
      <span>{{ entry.day }}</span
      ><b>{{ entry.kg }} kg</b>
    </div>
    <p class="note">Il peso non misura direttamente la massa muscolare.</p>
  </form>
  <section class="card">
    <h2>Integratori</h2>
    <p class="note">
      Prodotti personali, pianificazione, assunzioni e storico.
    </p>
    <RouterLink to="/integratori" class="btn primary wide"
      >I miei integratori</RouterLink
    >
  </section>
</template>

<style scoped>
.plan-imports {
  margin-top: 14px;
}
.plan-import-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.plan-import-actions .btn {
  width: 100%;
  min-height: 54px;
  white-space: normal;
  text-align: center;
  text-decoration: none;
}
</style>
