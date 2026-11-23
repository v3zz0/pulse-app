import { registerPwa } from "./pwa-updates.js";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./Home.vue";
import Login from "./Login.vue";
import Nutrition from "./Nutrition.vue";
import Personal from "./Personal.vue";
import ReminderSettings from "./ReminderSettings.vue";
import Account from "./Account.vue";
import PlanEditor from "./PlanEditor.vue";
import ManagePlans from "./ManagePlans.vue";
import Workout from "./Workout.vue";
import Supplements from "./Supplements.vue";
import Progress from "./Progress.vue";
import { useAuth } from "./stores/auth";
import "./style.css";
import "./editor.css";
import "./progress.css";
import "./theme.css";
import { applyTheme } from "./ui.js";
applyTheme();
const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/login", component: Login },
    { path: "/dieta", component: Nutrition },
    {
      path: "/altro/piani",
      component: ManagePlans,
      props: { kind: "nutrition" },
    },
    {
      path: "/altro/schede",
      component: ManagePlans,
      props: { kind: "training" },
    },
    { path: "/dieta/editor/:id?", component: PlanEditor, props: { kind: "nutrition" } },
    { path: "/allenati/editor/:id?", component: PlanEditor, props: { kind: "training" } },
    { path: "/dieta/piani", redirect: "/altro/piani" },
    { path: "/allenati/schede", redirect: "/altro/schede" },
    { path: "/altro", component: Personal },
    { path: "/altro/promemoria", component: ReminderSettings },
    { path: "/account", component: Account },
    { path: "/integratori", component: Supplements },
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
