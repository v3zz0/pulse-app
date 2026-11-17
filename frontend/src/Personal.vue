<script setup>
import Pwa from "./Pwa.vue";
import Icon from "./components/Icon.vue";
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
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const entry = await send("/weights/" + date.value, { kg: Number(weight.value) });
    weights.value = [...weights.value.filter((row) => row.day !== entry.day), entry]
      .sort((a, b) => a.day.localeCompare(b.day));
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
  <form class="card settings-space" @submit.prevent="saveWeight">
    <h2>Registra peso</h2>
    <div class="field-row">
      <label class="fieldlabel">Peso in kg
        <input v-model="weight" class="field" type="number" inputmode="decimal"
          min="30" max="250" step="0.1" required />
      </label>
      <label class="fieldlabel">Data della misurazione
        <input v-model="date" class="field" type="date" :max="localDate()" required />
      </label>
    </div>
    <button class="btn primary wide" :disabled="busy">Salva peso</button>
    <p v-if="error" role="alert" class="warning">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
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
  <section class="card compact-settings settings-space">
    <RouterLink class="settings-link" to="/integratori">
      <Icon name="pill" /> <strong>Gestisci i miei integratori</strong><Icon name="arrow" />
    </RouterLink>
  </section>
  <section class="card compact-settings settings-space">
    <RouterLink class="settings-link" to="/altro/promemoria">
      <Icon name="bell" /> <strong>Promemoria</strong><Icon name="arrow" />
    </RouterLink>
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
