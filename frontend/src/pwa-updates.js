// No skipWaiting/reload: a new shell must wait for all PULSE windows to close.
export async function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  let registration = null,
    inFlight = null,
    failures = 0;
  const update = () => {
    if (!navigator.onLine || inFlight) return inFlight;
    inFlight = (async () => {
      try {
        if (!registration)
          registration = await navigator.serviceWorker.register("/sw.js", {
            updateViaCache: "none",
          });
        else await registration.update();
        failures = 0;
      } catch {
        // A transient first-load/offline error must not permanently disable installability.
        if (++failures < 3) setTimeout(update, 5000);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
  window.addEventListener("online", update);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") update();
  });
  setInterval(update, 15 * 60000);
  await update();
}
