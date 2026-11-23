<script setup>
import Pwa from "./Pwa.vue";
import Icon from "./components/Icon.vue";
import { onMounted, ref } from "vue";
import { api, send } from "./api";
import { localDate } from "./stores/day";
import { useAuth } from "./stores/auth";
import { theme, setTheme, notify } from "./ui.js";
import { profile, saveAvatar } from "./profile.js";
const photoBusy = ref(false);
async function setPhoto(file) {
  photoBusy.value = true;
  try {
    await saveAvatar(file);
    notify(file ? "Foto profilo aggiornata" : "Foto profilo rimossa");
  } catch (e) {
    notify(e.message);
  } finally {
    photoBusy.value = false;
  }
}
const pickPhoto = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(f); };
const auth = useAuth(), weightInput = ref(null);
const themes = [["auto", "Automatico"], ["light", "Chiaro"], ["dark", "Scuro"]];
function focusWeight() {
  document.getElementById("peso")?.scrollIntoView({ behavior: "smooth", block: "start" });
  weightInput.value?.focus({ preventScroll: true });
}
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
onMounted(async () => {
  await load();
  if (location.hash === "#peso") focusWeight();
});
</script>
<template>
  <section class="profile-head">
    <div class="profile-photo" aria-hidden="true">
      <img v-if="profile.avatar" :src="profile.avatar" alt="" />
      <span v-else>{{ auth.user?.username?.slice(0, 1).toUpperCase() }}</span>
    </div>
    <div>
      <h1>Ciao{{ auth.user ? ", " + auth.user.username : "" }}<em>.</em></h1>
      <div class="rowbtns">
        <label class="btn secondary sm photo-pick">
          {{ profile.avatar ? "Cambia foto" : "Aggiungi foto" }}
          <input type="file" accept="image/*" class="sr-only" :disabled="photoBusy" @change="pickPhoto" />
        </label>
        <button v-if="profile.avatar" type="button" class="btn ghost sm" :disabled="photoBusy" @click="setPhoto(null)">Rimuovi</button>
      </div>
    </div>
  </section>
  <div class="today-grid">
    <div>
      <section class="card menu-list" aria-label="Ogni giorno">
        <a href="#peso" @click.prevent="focusWeight"><span class="ic"><Icon name="weight" /></span><span class="grow">Peso<small>{{ weights.at(-1) ? weights.at(-1).kg + " kg" : "Nessuna misurazione" }}</small></span><Icon name="arrow" /></a>
        <RouterLink to="/integratori"><span class="ic"><Icon name="pill" /></span><span class="grow">Integratori<small>Quantità, orari e storico</small></span><Icon name="arrow" /></RouterLink>
        <RouterLink to="/altro/promemoria"><span class="ic"><Icon name="bell" /></span><span class="grow">Promemoria e notifiche</span><Icon name="arrow" /></RouterLink>
      </section>
      <section class="card menu-list" aria-labelledby="plan-settings-title">
        <h2 id="plan-settings-title" class="sr-only">Piani e importazioni</h2>
        <RouterLink to="/altro/piani" aria-label="Gestisci piano alimentare"><span class="ic"><Icon name="food" /></span><span class="grow">Gestisci piano alimentare<small>Versioni, CSV, editor</small></span><Icon name="arrow" /></RouterLink>
        <RouterLink to="/altro/schede" aria-label="Gestisci scheda allenamento"><span class="ic"><Icon name="barbell" /></span><span class="grow">Gestisci scheda allenamento<small>Versioni, CSV, editor</small></span><Icon name="arrow" /></RouterLink>
        <RouterLink to="/altro/preferenze#giorni-allenamento"><span class="ic"><Icon name="calendar" /></span><span class="grow">Giorni di allenamento, preferenze e obiettivi</span><Icon name="arrow" /></RouterLink>
        <RouterLink to="/account"><span class="ic"><Icon name="user" /></span><span class="grow">Account e password</span><Icon name="arrow" /></RouterLink>
      </section>
      <Pwa />
    </div>
    <div>
      <form id="peso" class="card settings-space" @submit.prevent="saveWeight">
        <h2>Registra peso</h2>
        <div class="field-row">
          <label class="fieldlabel">Peso in kg
            <input ref="weightInput" v-model="weight" class="field" type="number" inputmode="decimal"
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
      <section class="card">
        <h2>Aspetto</h2>
        <div class="seg" role="group" aria-label="Tema" style="margin-top: 10px">
          <button v-for="[v, l] in themes" :key="v" type="button" :aria-pressed="theme.value === v" @click="setTheme(v)">{{ l }}</button>
        </div>
      </section>
    </div>
  </div>
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
