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
      !["/", "/login", "/allenati", "/dieta", "/progressi", "/altro"].includes(
        url.pathname,
      )
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
