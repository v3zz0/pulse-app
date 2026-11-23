<script setup>
defineProps({ section: String });
const names = {
  dieta: "La tua dieta",
  allenati: "Diventa più forte",
  progressi: "I tuoi progressi",
  altro: "Il tuo spazio",
};
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="eyebrow">PULSE · PROSSIMAMENTE</div>
      <h1>{{ names[section] }}<em>.</em></h1>
    </div>
  </div>
  <section class="card">
    <h2>In arrivo nella fase 3</h2>
    <p class="note">
      Allenamento e riepiloghi saranno disponibili nella prossima fase.
      Pasti, peso e assunzioni sono già gestibili dalle sezioni Oggi, Dieta e Tu.
    </p>
    <RouterLink to="/" class="btn primary">Torna a Oggi</RouterLink>
  </section>
</template>
