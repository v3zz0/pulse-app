<script setup>
import { watch } from "vue";
import { useRoute } from "vue-router";
import { useIntakes } from "./stores/supplement-intakes";
import { useWorkout } from "./stores/workout";
import Reminders from "./Reminders.vue";
import { dayName } from "./workout-display";
import Icon from "./components/Icon.vue";
import Toast from "./components/Toast.vue";
import Logo from "./components/Logo.vue";
import { profile, loadProfile } from "./profile.js";
import { useAuth } from "./stores/auth";
const auth = useAuth(),
  workout = useWorkout(), intakes = useIntakes();
watch(
  () => auth.user?.id,
  (id) => {
    if (id) { loadProfile(); workout.init(); intakes.init(); intakes.load().catch(() => {}); }
  },
  { immediate: true },
);
const settingsPaths = ["/integratori", "/account"];
const settingsLinks = [
  ["/altro", "Panoramica"],
  ["/integratori", "Integratori"],
  ["/altro/promemoria", "Promemoria"],
  ["/altro/piani", "Piani alimentari"],
  ["/altro/schede", "Schede di allenamento"],
  ["/altro/preferenze", "Preferenze"],
  ["/account", "Account"],
];
const route = useRoute();
const isCurrent = (path) =>
  path === "/" ? route.path === "/" : route.path === path || route.path.startsWith(path + "/") || (path === "/altro" && settingsPaths.includes(route.path));
const tabs = [
  ["/", "home", "Oggi"],
  ["/dieta", "food", "Dieta"],
  ["/allenati", "barbell", "Allenamenti"],
  ["/altro", "gear", "Impostazioni"],
];
</script>
<template>
  <header class="topbar">
    <RouterLink to="/" class="brand" aria-label="PULSE, vai a Oggi"><Logo /></RouterLink>
    <div v-if="auth.user" class="topright">
      <RouterLink to="/progressi" class="top-icon" aria-label="Progressi" :aria-current="$route.path === '/progressi' ? 'page' : undefined"><Icon name="chart" :size="20" /></RouterLink>
      <RouterLink to="/altro" class="avatar" aria-label="Il tuo account" :title="auth.user.username">
        <img v-if="profile.avatar" :src="profile.avatar" alt="" />
        <template v-else>{{ auth.user.username?.slice(0, 1).toUpperCase() }}</template>
      </RouterLink>
      <button type="button" class="top-icon" aria-label="Esci" title="Esci" @click="auth.logout"><Icon name="logout" :size="20" /></button>
    </div>
  </header>
  <main>
    <section
      v-if="
        auth.user &&
        workout.active?.status === 'active' &&
        $route.path !== '/allenati' &&
        !$route.path.startsWith('/allenati/editor')
      "
      class="card resume-card"
    >
      <h2>
        Riprendi allenamento ·
        {{ dayName(workout.program, workout.active.day) }}
      </h2>
      <RouterLink class="btn primary" to="/allenati"
        >Riprendi allenamento</RouterLink
      >
    </section>
    <RouterView /><Reminders v-if="auth.user" />
  </main>
  <Toast />
  <p class="footer-note">PULSE · Il tuo spazio privato</p>
  <nav v-if="auth.user" class="bottom-nav" aria-label="Navigazione principale">
    <template v-for="[path, icon, label] in tabs" :key="path">
      <RouterLink
        :to="path"
        class="navitem"
        :class="{ active: isCurrent(path) }"
        :aria-current="isCurrent(path) ? 'page' : undefined"
        ><Icon :name="icon" /><span>{{ label }}</span></RouterLink
      >
      <!-- Sottovoci delle impostazioni: solo nella barra laterale e solo quando sei in Impostazioni -->
      <div v-if="path === '/altro' && isCurrent('/altro')" class="nav-sub" aria-label="Impostazioni">
        <RouterLink v-for="[to, l] in settingsLinks" :key="to" :to="to" class="nav-subitem" :aria-current="$route.path === to ? 'page' : undefined">{{ l }}</RouterLink>
      </div>
    </template>
  </nav>
</template>
