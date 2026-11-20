<script setup>
import { computed, onMounted, ref } from "vue";
import { useIntakes } from "../stores/supplement-intakes";
import { todayIntakes } from "../today-intakes";
import Icon from "./Icon.vue";

const intakes = useIntakes(), error = ref("");
const today = computed(() => todayIntakes(intakes.data, intakes.queue, intakes.today));
async function record(entry) {
  error.value = "";
  try { await intakes.record(entry, "taken"); }
  catch (e) { error.value = e.message; }
}
onMounted(() => intakes.load().catch((e) => { error.value = e.message; }));
</script>

<template>
  <section class="card feature-card intakes-today" aria-labelledby="today-intakes">
    <div class="feature-row">
      <span class="feature-icon"><Icon name="pill" /></span>
      <h2 id="today-intakes">Integratori di oggi</h2>
    </div>
    <p v-if="error || intakes.error" role="alert" class="warning">{{ error || intakes.error }}</p>
    <p v-if="!intakes.ready || (intakes.busy && !today.available)" class="note">Caricamento…</p>
    <p v-else-if="!today.available" class="note">Connettiti per caricare la pianificazione di oggi.</p>
    <p v-else-if="!today.hasSchedule" class="note">Nessuna assunzione programmata.</p>
    <p v-else-if="!today.remaining.length && !today.queued" class="note">
      Tutti gli integratori assunti per oggi
    </p>
    <article v-for="entry in today.remaining" :key="entry.key" class="intake-slot remaining-intake">
      <div class="feature-content">
        <h3>{{ entry.name }}</h3>
        <p class="note">{{ entry.planned?.at || "Senza orario" }} · {{ entry.planned?.dose || "Quantità da configurare" }}</p>
      </div>
      <button class="btn primary" :aria-label="'Segna assunto ' + entry.name" @click="record(entry)">
        <Icon name="check" :size="16" /> Segna assunto
      </button>
    </article>
    <p v-if="today.queued" class="note" role="status">{{ today.queued }} in attesa di sincronizzazione</p>
    <RouterLink to="/integratori#storico" class="page-back">Storico assunzioni</RouterLink>
  </section>
</template>

<style scoped>
.remaining-intake {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
}
.remaining-intake h3, .remaining-intake .note { margin: 0; }
.remaining-intake .note { margin-top: 4px; }
.remaining-intake .btn { min-height: 44px; }
</style>
