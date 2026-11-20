self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("pulse-shell-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only checksum-verified generic Flow assets explicitly downloaded by the app.
  if (
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    /^\/api\/pulse\/flow\/assets\/[a-f0-9]{40}\/\d{4}\/frame-0[012]\.svg$/.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      (async () => {
        const revision = url.pathname.split("/")[5],
          cache = await caches.open("pulse-flow-" + revision);
        return (await cache.match(event.request)) || fetch(event.request);
      })(),
    );
    return;
  }
  // Never store API responses, private PDFs, uploads, admin or arbitrary runtime requests.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/uploads")
  )
    return;
  if (event.request.mode === "navigate") {
    if (
      ![
        "/",
        "/login",
        "/allenati",
        "/dieta",
        "/progressi",
        "/altro",
        "/integratori",
      ].includes(url.pathname)
    )
      return;
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
    return;
  }
  if (FILES.includes(url.pathname))
    event.respondWith(
      caches.match(url.pathname).then((hit) => hit || fetch(event.request)),
    );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      if (windows.length) {
        await windows[0].focus();
        await windows[0].navigate(self.location.origin + "/");
      } else await self.clients.openWindow("/");
    })(),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    const receipt = payload?.receipt;
    if (typeof receipt !== "string" || !/^[a-f0-9-]{36}$/.test(receipt)) return;
    const show = async () => {
      const response = await fetch("/api/pulse/push/messages/" + receipt, {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
      if (response.status !== 200) return;
      const delivery = await response.json();
      if (!/^pulse-/.test(delivery?.tag)) return;
      await self.registration.showNotification("PULSE", {
        body: delivery.test ? "La notifica di prova è arrivata." : "Hai un promemoria da controllare in PULSE.",
        tag: delivery.tag,
        icon: "/icons/pulse-192.png",
        data: { pulseReminder: true },
      });
    };
    try {
      if (self.navigator.locks) await self.navigator.locks.request("pulse-push-device", show);
      else await show();
    } catch {
      // The receipt expires and the app keeps showing due items when reopened.
    }
  })());
});
