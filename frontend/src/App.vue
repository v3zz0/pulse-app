<script setup>
import Icon from './components/Icon.vue';
const tabs = [['/','home','Oggi'],['/dieta','food','Dieta'],['/allenati','gym','Allenati'],['/progressi','chart','Progressi'],['/altro','more','Altro']];
</script>
<template>
<header class="topbar"><div class="brand"><span class="mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 32 32" fill="none"><path d="M7 26V6h11c7 0 11 3 11 9s-4 9-11 9h-7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M2 16h9l3-6 5 12 4-6h7" stroke="currentColor" stroke-width="2.3"/></svg></span>PULSE<small>2.1</small></div><div class="topright"><div class="demochip"><span class="demo-dot"></span>ANTEPRIMA</div><div class="avatar">A</div></div></header>
<main><RouterView /></main>
<p class="footer-note">PULSE 2.1 · Prima fase · Dati dimostrativi locali</p>
<nav class="bottom-nav" aria-label="Navigazione principale"><RouterLink v-for="[path,icon,label] in tabs" :key="path" :to="path" class="navitem" exact-active-class="active"><Icon :name="icon"/><span>{{ label }}</span></RouterLink></nav>
</template>
