import { api, send } from "./api";

export const pushSupported = () =>
  window.isSecureContext && "serviceWorker" in navigator &&
  "PushManager" in window && "Notification" in window;

export const withPushDeviceLock = (fn) => navigator.locks
  ? navigator.locks.request("pulse-push-device", fn)
  : fn();

async function registration() {
  const worker = await navigator.serviceWorker.getRegistration();
  if (!worker?.active) throw new Error("Riapri PULSE quando il service worker è pronto.");
  return worker;
}

async function closeReminderNotifications(worker) {
  for (const notice of (await worker?.getNotifications()) || [])
    if (notice.data?.pulseReminder || notice.data?.kind) notice.close();
}

export async function stopLocalPush(worker) {
  try { await (await worker?.pushManager?.getSubscription())?.unsubscribe(); }
  finally { await closeReminderNotifications(worker); }
}

export async function enablePush(status) {
  // The permission prompt must run inside the button gesture on mobile Safari.
  if (await Notification.requestPermission() !== "granted")
    throw new Error("Abilita le notifiche nelle impostazioni del browser.");
  return withPushDeviceLock(async () => {
    const worker = await registration();
    let subscription = await worker.pushManager.getSubscription();
    if (subscription && !status.registered) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ||= await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: status.publicKey,
    });
    try { await send("/push/device", subscription.toJSON()); }
    catch (error) {
      try { await subscription.unsubscribe(); } catch {}
      throw error;
    }
  });
}

export async function disablePush() {
  return withPushDeviceLock(async () => {
    await api("/push/device", { method: "DELETE" });
    await stopLocalPush(await navigator.serviceWorker.getRegistration());
  });
}

export async function pushStatus() {
  const state = await api("/push/status");
  if (!state.registered || !pushSupported()) return state;
  const worker = await navigator.serviceWorker.getRegistration();
  return { ...state, needsRenewal: !(await worker?.pushManager.getSubscription()) };
}
