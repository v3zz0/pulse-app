<script setup>
import { onMounted, ref, computed } from "vue";
import { api, send } from "./api";
import { localDate } from "./stores/day";
import { useAuth } from "./stores/auth";
const date = ref(localDate()),
  weight = ref(""),
  weights = ref([]),
  products = ref([]),
  intakes = ref([]),
  doses = ref({}),
  times = ref({}),
  message = ref(""),
  error = ref(""),
  busy = ref(false),
  auth = useAuth();
const overlap = computed(
  () => intakes.value.filter((i) => /creatin|powa/i.test(i.name)).length > 1,
);
async function load() {
  try {
    [weights.value, products.value, intakes.value] = await Promise.all([
      api("/weights"),
      api("/supplements"),
      api("/intakes/" + date.value),
    ]);
    for (const p of products.value)
      if (!times.value[p.id])
        times.value[p.id] = new Intl.DateTimeFormat("it-IT", {
          timeZone: "Europe/Rome",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date());
    for (const i of intakes.value) doses.value[i.productId] = i.dose;
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
async function take(product, removeSlot = null) {
  busy.value = true;
  error.value = "";
  try {
    await send("/intakes/" + date.value, {
      productId: product.id,
      taken: removeSlot === null,
      slot: removeSlot || times.value[product.id] || "08:00",
      dose: doses.value[product.id],
    });
    await load();
    message.value = "Assunzione aggiornata";
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
      <h1>Peso e integratori<span style="color: var(--accent)">.</span></h1>
    </div>
  </div>
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
  <section class="card" style="margin-top: 14px">
    <h2>Integratori</h2>
    <p class="warning">
      Registrare soltanto le assunzioni effettive. Non sommare automaticamente
      prodotti e prescrizioni storiche.
    </p>
    <div v-if="overlap" role="alert" class="warning">
      Possibile sovrapposizione di creatina: verifica la dose totale con il
      professionista.
    </div>
    <div v-for="product in products" :key="product.id" class="setting-row">
      <div style="width: 100%">
        <h3>{{ product.name }}</h3>
        <p class="note">{{ product.instructions }}</p>
        <p class="source-note">
          {{ product.ingredients }} ·
          {{
            product.source === "historical-plan"
              ? "Piano storico da rivedere"
              : "Prodotto manuale"
          }}
        </p>
        <label class="fieldlabel" :for="'dose-' + product.id"
          >Dose effettivamente assunta (includi unità)</label
        ><input
          :id="'dose-' + product.id"
          v-model="doses[product.id]"
          class="field"
          placeholder="Dose e unità"
        /><label class="fieldlabel" :for="'time-' + product.id"
          >Orario locale</label
        ><input
          :id="'time-' + product.id"
          v-model="times[product.id]"
          class="field"
          type="time"
        /><button
          class="btn secondary wide"
          :disabled="busy"
          @click="take(product)"
        >
          Segna assunto
        </button>
        <div
          v-for="intake in intakes.filter((i) => i.productId === product.id)"
          :key="intake.slot"
          class="soft-row"
        >
          <span
            >{{ intake.slot === "daily" ? "Registrato" : intake.slot }} ·
            {{ intake.dose }}</span
          ><button
            class="btn ghost sm"
            :disabled="busy"
            @click="take(product, intake.slot)"
          >
            Annulla assunzione
          </button>
        </div>
      </div>
    </div>
  </section>
  <button class="btn ghost wide" style="margin-top: 14px" @click="auth.logout">
    Esci
  </button>
</template>
