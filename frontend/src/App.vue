<script setup>
import { watch } from "vue";
import { useWorkout } from "./stores/workout";
import Reminders from "./Reminders.vue";
import Icon from "./components/Icon.vue";
import { useAuth } from "./stores/auth";
const auth = useAuth(),
  workout = useWorkout();
watch(
  () => auth.user?.id,
  (id) => {
    if (id) workout.init();
  },
  { immediate: true },
);
const tabs = [
  ["/", "home", "Oggi"],
  ["/dieta", "food", "Dieta"],
  ["/allenati", "gym", "Allenati"],
  ["/progressi", "chart", "Progressi"],
  ["/altro", "more", "Altro"],
];
</script>
<template>
  <header class="topbar">
    <div class="brand">
      <span class="mark" aria-hidden="true"
        ><svg width="25" height="25" viewBox="0 0 32 32" fill="none">
          <path
            d="M7 26V6h11c7 0 11 3 11 9s-4 9-11 9h-7"
            stroke="currentColor"
            stroke-width="3.2"
            stroke-linecap="round"
          />
          <path
            d="M2 16h9l3-6 5 12 4-6h7"
            stroke="currentColor"
            stroke-width="2.3"
          /></svg></span
      >PULSE<small>2.1</small>
    </div>
    <div class="topright">
      <div class="demochip"><span class="demo-dot"></span>PRIVATO</div>
      <div class="avatar">A</div>
    </div>
  </header>
  <main>
    <section
      v-if="auth.user && workout.active && $route.path !== '/allenati'"
      class="card resume-card"
    >
      <h2>Riprendi allenamento · {{ workout.active.day }}</h2>
      <RouterLink class="btn primary" to="/allenati"
        >Riprendi allenamento</RouterLink
      >
    </section>
    <RouterView /><Reminders v-if="auth.user" />
  </main>
  <p class="footer-note">PULSE 2.1 · Il tuo spazio privato</p>
  <nav v-if="auth.user" class="bottom-nav" aria-label="Navigazione principale">
    <RouterLink
      v-for="[path, icon, label] in tabs"
      :key="path"
      :to="path"
      class="navitem"
      exact-active-class="active"
      ><Icon :name="icon" /><span>{{ label }}</span></RouterLink
    >
  </nav>
</template>
