import { defineStore } from "pinia";
import { api, send } from "../api.js";
import { stopLocalPush, withPushDeviceLock } from "../web-push";
import { read, write, clearPrivate, exclusive } from "../offline";
export const useAuth = defineStore("auth", {
  state: () => ({ user: null, checked: false }),
  actions: {
    async check() {
      try {
        this.user = (await api("/me")).user;
        await write("identity", this.user);
      } catch (e) {
        if (!e.status) this.user = (await read("identity")) || null;
        else if (e.status === 401) {
          this.user = null;
          await write("identity", null);
        } else throw e;
      }
      this.checked = true;
    },
    async login(identifier, password) {
      this.user = (await send("/login", { identifier, password }, "POST")).user;
      await write("identity", this.user);
      this.checked = true;
    },
    async updateProfile(values) {
      this.user = (await send("/profile", values)).user;
      await write("identity", this.user);
    },
    async logout() {
      return navigator.locks.request("pulse-workout-sync", () =>
        exclusive(() => withPushDeviceLock(async () => {
          await send("/logout", {}, "POST");
          await clearPrivate();
          try {
            const registration =
              await navigator.serviceWorker?.getRegistration();
            await stopLocalPush(registration);
            for (const n of (await registration?.getNotifications()) || [])
              n.close();
          } catch {}
          new BroadcastChannel("pulse-auth").postMessage("logout");
          this.user = null;
          this.checked = false;
          location.assign("/login");
        })),
      );
    },
  },
});
