<script setup>
defineProps({ totals: Object, goals: Object });
const labels = {
  kcal: "kcal",
  protein_g: "Proteine",
  carbs_g: "Carboidrati",
  fat_g: "Grassi",
};
const status = {
  partial: "Dati parziali",
  estimated: "Valori stimati",
  declared: "Dati dichiarati",
  verified: "Fonti confermate dall’utente",
};
</script>
<template>
  <div v-if="totals" class="nutrient-summary">
    <p class="smallmuted">
      {{ status[totals.status]
      }}{{ !totals.complete ? " · somme note, non totali completi" : "" }}
    </p>
    <div class="macro-cols">
      <div v-for="(label, key) in labels" :key="key" class="workout-badge">
        <strong
          >{{
            (totals.complete
              ? totals.values[key]
              : totals.known[key]
            )?.toLocaleString("it-IT", { maximumFractionDigits: 1 }) ?? "—"
          }}{{ key === "kcal" ? "" : " g" }}</strong
        ><span>{{ label }}</span>
        <small v-if="goals?.[key]" class="smallmuted"
          >Obiettivo {{ goals[key] }}{{ key === "kcal" ? " kcal" : " g"
          }}<template v-if="totals.complete">
            ·
            {{ Math.round((100 * totals.values[key]) / goals[key]) }}%</template
          ></small
        >
      </div>
    </div>
  </div>
</template>
