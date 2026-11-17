<script setup>
import { computed, onMounted, ref } from "vue";
import { useIntakes } from "../stores/supplement-intakes";
import { localDate } from "../stores/day";
import Icon from "./Icon.vue";
const intakes = useIntakes(), error = ref("");
const clock = new Intl.DateTimeFormat("it", {
  timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit",
});
const groups = computed(() => {
  if (intakes.data?.day !== localDate()) return [];
  return intakes.data.products.filter((p) => p.active && p.schedule.length).map((product) => ({
    product,
    entries: product.schedule
      .map((slot) => intakes.data.entries.find((entry) =>
        !entry.unscheduled && entry.productId === product.id && entry.slot === slot.id))
      .filter(Boolean),
  }));
});
function pending(entry) {
  return intakes.queue.find((item) => item.day === intakes.data?.day && item.key === entry.key);
}
async function record(entry, status) {
  error.value = "";
  try { await intakes.record(entry, status); }
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
    <p v-if="!intakes.ready || (intakes.busy && !intakes.data)" class="note">Caricamento…</p>
    <p v-else-if="!intakes.data" class="note">Connettiti per caricare la tua pianificazione.</p>
    <div v-else-if="!groups.length" class="empty">
      Nessuna assunzione programmata.
      <RouterLink to="/integratori" class="btn secondary wide">Gestisci i miei integratori</RouterLink>
    </div>
    <article v-for="{ product, entries } in groups" :key="product.id" class="intake-product">
      <div class="feature-row">
        <span class="feature-icon"><Icon name="pill" /></span>
        <div>
          <h3>{{ product.name }}</h3>
          <p class="note">{{ entries.length }} {{ entries.length === 1 ? 'assunzione' : 'assunzioni' }} al giorno</p>
        </div>
      </div>
      <div v-for="(entry, index) in entries" :key="entry.key" class="intake-slot"
        :class="{ 'is-taken': entry.status === 'taken' && !pending(entry) }">
        <div class="feature-row">
          <div class="feature-content">
            <strong>Assunzione {{ index + 1 }} di {{ entries.length }}</strong>
            <p class="note">
              <template v-if="entry.planned.at">{{ entry.planned.at }} · </template>
              {{ entry.planned.dose || 'Quantità da configurare' }}
              <template v-if="entry.status === 'taken' && entry.record.takenAt">
                · registrata alle {{ clock.format(new Date(entry.record.takenAt)) }}
              </template>
            </p>
          </div>
          <span class="intake-state" :class="entry.status">
            {{ pending(entry) ? 'Da sincronizzare' : ({ taken: 'Assunto', skipped: 'Saltato' }[entry.status] || 'Da assumere') }}
          </span>
        </div>
        <button v-if="entry.status === 'pending'" class="btn primary wide"
          :disabled="!!pending(entry)" @click="record(entry, 'taken')">
          <Icon name="check" :size="17" /> Segna assunto
        </button>
        <button v-else class="textbutton" :disabled="!!pending(entry)" @click="record(entry, 'cancelled')">
          Annulla registrazione
        </button>
      </div>
    </article>
  </section>
</template>
