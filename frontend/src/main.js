import { registerPwa } from "./pwa-updates.js";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./Home.vue";
import Login from "./Login.vue";
import Nutrition from "./Nutrition.vue";
import Personal from "./Personal.vue";
import Account from "./Account.vue";
import ManagePlans from "./ManagePlans.vue";
import Workout from "./Workout.vue";
import Progress from "./Progress.vue";
import { useAuth } from "./stores/auth";
import "./style.css";
const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/login", component: Login },
    { path: "/dieta", component: Nutrition },
    {
      path: "/dieta/piani",
      component: ManagePlans,
      props: { kind: "nutrition" },
    },
    {
      path: "/allenati/schede",
      component: ManagePlans,
      props: { kind: "training" },
    },
    { path: "/altro", component: Personal },
    { path: "/account", component: Account },
    { path: "/allenati", component: Workout },
    { path: "/progressi", component: Progress },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const auth = useAuth(pinia);
  if (!auth.checked) await auth.check();
  if (!auth.user && to.path !== "/login") return "/login";
  if (auth.user && to.path === "/login") return "/";
});
createApp(App).use(pinia).use(router).mount("#app");

new BroadcastChannel("pulse-auth").onmessage = () => location.assign("/login");

if (import.meta.env.PROD) registerPwa();
