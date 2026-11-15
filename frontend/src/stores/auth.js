import { defineStore } from "pinia";
import { api, send } from "../api.js";
export const useAuth = defineStore("auth", {
  state: () => ({ user: null, checked: false }),
  actions: {
    async check() {
      try {
        this.user = (await api("/me")).user;
      } catch (e) {
        if (e.status !== 401) throw e;
        this.user = null;
      }
      this.checked = true;
    },
    async login(identifier, password) {
      this.user = (await send("/login", { identifier, password }, "POST")).user;
      this.checked = true;
    },
    async logout() {
      await send("/logout", {}, "POST");
      this.user = null;
      this.checked = false;
      location.assign("/login");
    },
  },
});
