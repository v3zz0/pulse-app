<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { api, send } from "./api";
import { useAuth } from "./stores/auth";
const route = useRoute(),
  auth = useAuth(),
  rows = ref([]),
  due = ref([]),
  targets = ref([]),
  error = ref(""),
  kind = ref("meal"),
  target = ref(""),
  at = ref("12:00"),
  timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone),
  weekdays = ref([0, 1, 2, 3, 4, 5, 6]),
  notification = ref(
    "Notification" in window ? Notification.permission : "unsupported",
  );
let timer, updates;
const names = {
  meal: "Pasto",
  supplement: "Integratore",
  workout: "Allenamento",
};
async function loadTargets() {
  try {
    if (kind.value === "workout")
      targets.value = Object.keys(
        (await api("/training")).program?.days || {},
      ).map((d) => ({
        id: d,
        name: "Scheda " + d,
      }));
    else if (kind.value === "supplement")
      targets.value = await api("/supplements");
    else {
      const data = await api(
        "/days/" +
          new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone.value,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
      );
      targets.value = data.meals;
    }
    target.value = String(targets.value[0]?.id || "");
  } catch (e) {
    error.value = e.message;
  }
}
watch(kind, loadTargets);
let sequence = Promise.resolve();
function ordered(fn) {
  const result = sequence.then(fn);
  sequence = result.catch(() => {});
  return result;
}
function refresh() {
  return ordered(refreshNow);
}
function change(...args) {
  return ordered(() => changeNow(...args));
}
function save() {
  return ordered(saveNow);
}
function toggle(...args) {
  return ordered(() => toggleNow(...args));
}
async function refreshNow() {
  try {
    rows.value = await api("/reminders");
    due.value = await api("/reminders/due");
    if (
      notification.value === "granted" &&
      navigator.serviceWorker &&
      navigator.locks
    )
      await navigator.locks.request("pulse-reminder-delivery", async () => {
        const items = await api("/reminders/due");
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          for (const n of (await registration?.getNotifications()) || [])
            if (
              n.data?.kind &&
              !items.some((r) => n.tag === `pulse-${r.id}-${r.date}`)
            )
              n.close();
        } catch {}
        for (const r of items.filter((r) => !r.delivered)) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) continue;
          await registration.showNotification(
            "PULSE · " + names[r.settings.kind],
            {
              body: "Hai un promemoria da controllare in PULSE.",
              tag: "pulse-" + r.id + "-" + r.date,
              icon: "/icons/pulse-192.png",
              data: {
                url: "/",
                kind: r.settings.kind,
                target: r.settings.target,
                scheduleId: r.settings.scheduleId,
                at: r.settings.at,
              },
            },
          );
          await send("/reminders/" + r.id, {
            action: "delivered",
            date: r.date,
            revision: r.revision,
          });
          due.value = await api("/reminders/due");
          rows.value = await api("/reminders");
        }
      });
  } catch (e) {
    error.value = e.message;
  }
}
async function changeNow(r, action, minutes) {
  try {
    const body = { action, minutes, date: r.date, revision: r.revision };
    try {
      await send("/reminders/" + r.id, body);
    } catch (e) {
      if (
        e.status !== 409 ||
        !["snooze", "acknowledge", "delete"].includes(action)
      )
        throw e;
      const latest = (await api("/reminders")).find((v) => v.id === r.id);
      if (latest)
        await send("/reminders/" + r.id, {
          ...body,
          revision: latest.revision,
        });
    }
    await refreshNow();
  } catch (e) {
    error.value = e.message;
    await refreshNow();
  }
}
async function saveNow() {
  try {
    await send("/reminders/" + crypto.randomUUID(), {
      action: "settings",
      revision: 0,
      settings: {
        kind: kind.value,
        target: target.value,
        at: at.value,
        timezone: timezone.value,
        enabled: true,
        weekdays: weekdays.value,
      },
    });
    await refreshNow();
  } catch (e) {
    error.value = e.message;
  }
}
async function permission() {
  if (!("Notification" in window)) return;
  notification.value = await Notification.requestPermission();
  await refresh();
}
async function toggleNow(r) {
  try {
    await send("/reminders/" + r.id, {
      action: "settings",
      revision: r.revision,
      settings: { ...r.settings, enabled: !r.settings.enabled },
    });
    await refreshNow();
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(() => {
  window.addEventListener("pulse-reminders-changed", refresh);
  updates = new BroadcastChannel("pulse-reminders");
  updates.onmessage = refresh;
  refresh();
  if (route.path === "/altro") loadTargets();
  timer = setInterval(refresh, 30000);
});
watch(
  () => route.path,
  (p) => {
    if (p === "/altro") {
      refresh();
      loadTargets();
    }
  },
);
onUnmounted(() => {
  clearInterval(timer);
  window.removeEventListener("pulse-reminders-changed", refresh);
  updates?.close();
});
</script>
<template>
  <section
    v-if="due.length"
    class="card workout-block"
    aria-label="Promemoria in scadenza"
  >
    <h2>Da ricordare</h2>
    <div v-for="r in due" :key="r.id" class="reminder-row">
      <p>
        {{ names[r.settings.kind] }} ·
        {{ r.settings.label || r.settings.target }} · {{ r.settings.at }} ·
        {{ r.settings.timezone }}
      </p>
      <div class="btnrow">
        <button
          v-for="m in [15, 30, 60]"
          :key="m"
          class="btn secondary"
          @click="change(r, 'snooze', m)"
        >
          Rinvia {{ m }} min</button
        ><button class="btn secondary" @click="change(r, 'acknowledge')">
          Chiudi per oggi
        </button>
      </div>
    </div>
  </section>
  <section v-if="route.path === '/altro'" class="card workout-block">
    <h2>Promemoria</h2>
    <p class="smallmuted">
      Avvisi in-app e notifiche di sistema mentre PULSE è aperta e connessa. Il
      browser può sospendere le schede: con l’app chiusa non è garantito alcun
      avviso in background. Nessuna notifica push remota è attivata.
    </p>
    <p>
      Notifiche:
      {{
        notification === "granted"
          ? "consentite"
          : notification === "denied"
            ? "negate nelle impostazioni del browser"
            : notification === "unsupported"
              ? "non supportate"
              : "consenso da richiedere"
      }}
    </p>
    <button
      v-if="notification === 'default'"
      class="btn secondary"
      @click="permission"
    >
      Consenti notifiche
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <form @submit.prevent="save" class="reminder-row">
      <label class="fieldlabel"
        >Tipo promemoria<select v-model="kind" class="field">
          <option value="meal">Pasto</option>
          <option value="supplement">Integratore</option>
          <option value="workout">Allenamento</option>
        </select></label
      ><label class="fieldlabel"
        >Attività<select v-model="target" class="field" required>
          <option v-for="t in targets" :key="t.id" :value="String(t.id)">
            {{ t.name }}
          </option>
        </select></label
      >
      <div class="field-row">
        <label class="fieldlabel"
          >Orario promemoria<input
            v-model="at"
            class="field"
            type="time"
            required /></label
        ><label class="fieldlabel"
          >Fuso orario<input v-model="timezone" class="field" required
        /></label>
      </div>
      <fieldset>
        <legend>Giorni</legend>
        <label
          v-for="(d, i) in ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']"
          :key="i"
          style="display: inline-block; margin: 5px"
          ><input v-model="weekdays" type="checkbox" :value="i" />{{ d }}</label
        >
      </fieldset>
      <button class="btn primary" :disabled="!target">
        Aggiungi promemoria
      </button>
    </form>
    <div v-for="r in rows" :key="r.id" class="reminder-row">
      <b
        >{{ names[r.settings.kind] }} ·
        {{ r.settings.label || r.settings.target }} · {{ r.settings.at }}</b
      >
      <p>
        {{ r.settings.timezone }} ·
        {{ r.settings.enabled ? "Attivo" : "Disattivato" }}
      </p>
      <RouterLink
        v-if="r.settings.scheduleId"
        to="/integratori"
        class="btn secondary"
        >Gestisci in I miei integratori</RouterLink
      >
      <div v-else class="btnrow">
        <button class="btn secondary" @click="toggle(r)">
          {{ r.settings.enabled ? "Disattiva" : "Attiva" }}</button
        ><button class="btn secondary" @click="change(r, 'delete')">
          Elimina promemoria
        </button>
      </div>
    </div>
  </section>
</template>
