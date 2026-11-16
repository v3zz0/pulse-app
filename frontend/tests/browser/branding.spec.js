import { test, expect } from "@playwright/test";
const base = "http://127.0.0.1:8081";
test("logo ufficiale: favicon, manifest, dimensioni, cache e installabilità", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await expect(
    page.locator('link[rel="icon"][href="/favicon.ico"]'),
  ).toHaveAttribute("sizes", "16x16 32x32 48x48");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
  const response = await page.request.get(base + "/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toBe("PULSE");
  expect(manifest.short_name).toBe("PULSE");
  expect(manifest.theme_color).toBe("#0B1018");
  expect(manifest.background_color).toBe("#0B1018");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(4);
  const images = [
    ["/favicon-16x16.png", 16],
    ["/favicon-32x32.png", 32],
    ["/apple-touch-icon.png", 180],
  ];
  for (const purpose of ["any", "maskable"]) {
    for (const size of [192, 512]) {
      const icon = manifest.icons.find(
        (i) => i.purpose === purpose && i.sizes === `${size}x${size}`,
      );
      expect(icon).toBeTruthy();
      images.push([icon.src, size]);
    }
  }
  for (const [url, size] of images) {
    const r = await page.request.get(base + url);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
    expect(
      await page.evaluate(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, url),
    ).toEqual([size, size]);
  }
  const ico = await page.request.get(base + "/favicon.ico");
  expect(ico.status()).toBe(200);
  const bytes = await ico.body();
  expect(bytes.readUInt16LE(2)).toBe(1);
  expect(bytes.readUInt16LE(4)).toBe(3);
  expect([0, 1, 2].map((i) => [bytes[6 + 16 * i], bytes[7 + 16 * i]])).toEqual([
    [16, 16],
    [32, 32],
    [48, 48],
  ]);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  expect(
    (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
  ).toEqual([]);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((k) =>
      k.startsWith("pulse-shell-"),
    );
    return (
      await Promise.all(
        names.map(async (n) =>
          (await (await caches.open(n)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  for (const [url] of images) expect(cached).toContain(url);
  expect(cached).toContain("/favicon.ico");
  expect(cached.some((url) => /^(\/api\/|\/uploads\/)/.test(url))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Accedi a PULSE" }),
  ).toBeVisible();
  for (const [url, size] of images) {
    expect(
      await page.evaluate(async (url) => {
        const i = new Image();
        i.src = url;
        await i.decode();
        return i.naturalWidth;
      }, url),
    ).toBe(size);
  }
  expect(errors).toEqual([]);
});
