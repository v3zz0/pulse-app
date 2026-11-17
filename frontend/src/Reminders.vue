<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { api, send } from "./api";
import { reminderTypes } from "./reminder-display";
const due = ref([]), error = ref("");
let timer, updates;
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
async function refreshNow() {
  try {
    due.value = await api("/reminders/due");
    error.value = "";
    if (
      window.Notification?.permission === "granted" &&
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
            "PULSE · " + reminderTypes[r.settings.kind]?.name,
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
        }
        due.value = await api("/reminders/due");
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
        !["snooze", "acknowledge"].includes(action)
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
    await refreshNow();
    error.value = e.message;
  }
}
onMounted(() => {
  window.addEventListener("pulse-reminders-changed", refresh);
  updates = new BroadcastChannel("pulse-reminders");
  updates.onmessage = refresh;
  refresh();
  timer = setInterval(refresh, 30000);
});
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
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-for="r in due" :key="r.id" class="reminder-row">
      <p>
        {{ reminderTypes[r.settings.kind]?.name }} ·
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
</template>
