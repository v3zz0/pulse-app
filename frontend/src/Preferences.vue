<template>
  <RouterLink to="/altro" class="page-back">‹ Impostazioni</RouterLink>
  <div class="pagehead">
    <div><h1>Preferenze<em>.</em></h1></div>
  </div>
  <PersonalSettings />
</template>
<script setup>
import PersonalSettings from "./components/PersonalSettings.vue";
</script>
