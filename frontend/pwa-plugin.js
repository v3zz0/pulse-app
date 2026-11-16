import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export function pulsePwa() {
  return {
    name: "pulse-pwa",
    apply: "build",
    async closeBundle() {
      const assets = (await readdir("dist/assets")).map((f) => "/assets/" + f);
      const files = [
        "/index.html",
        "/manifest.webmanifest",
        "/icons/pulse-192.png",
        "/icons/pulse-512.png",
        ...assets,
      ];
      const version = createHash("sha256");
      for (const f of files) version.update(await readFile("dist" + f));
      const source = await readFile("service-worker.js", "utf8");
      await writeFile(
        "dist/sw.js",
        `const CACHE='pulse-shell-${version.digest("hex").slice(0, 16)}';\nconst FILES=${JSON.stringify(files)};\n` +
          source,
      );
    },
  };
}
