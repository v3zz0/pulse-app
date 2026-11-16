import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { pulsePwa } from "./pwa-plugin.js";
export default defineConfig({
  plugins: [vue(), pulsePwa()],
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:1337", changeOrigin: false } },
  },
});
