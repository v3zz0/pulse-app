import { defineStore } from "pinia";
import { api, send } from "../api";
import { exclusive, read, write } from "../offline";
import { localDate } from "./day";
import { useAuth } from "./auth";

const key = (owner) => `supplement-intakes:${owner}`;
const empty = () => ({ data: null, queue: [], error: "" });
const dashboard = (day) => api(`/supplements/day/${day}?daily=1`);
let channel;

export const useIntakes = defineStore("supplement-intakes", {
  state: () => ({ ...empty(), busy: false, ready: false, owner: null }),
  actions: {
    async load() {
      const owner = useAuth().user?.id;
      if (!owner) return;
      if (this.owner !== owner) {
        this.$reset();
        this.owner = owner;
      }
      await this.local(owner);
      await this.sync();
    },
    async local(owner, change) {
      return exclusive(async () => {
        if (useAuth().user?.id !== owner) throw new Error("Account cambiato");
        const saved = (await read(key(owner))) || empty();
        if (change) {
          change(saved);
          await write(key(owner), saved);
        }
        Object.assign(this, saved);
        this.ready = true;
        return saved;
      });
    },
    async record(entry, status) {
      const owner = this.owner, day = this.data?.day;
      if (day !== localDate()) throw new Error("La giornata è cambiata. Riapri Oggi.");
      const product = this.data.products.find((p) => p.id === entry.productId);
      await this.local(owner, (saved) => {
        if (saved.queue.some((item) => item.day === day && item.key === entry.key)) return;
        saved.queue.push({
          key: entry.key, day,
          body: {
            productId: entry.productId, slot: entry.slot, confirm: true,
            revision: entry.record?.revision || 0, productRevision: product.revision,
            status, timezone: "Europe/Rome",
            ...(status === "taken"
              ? { dose: entry.planned.dose || null, takenAt: new Date().toISOString() }
              : {}),
          },
        });
        saved.error = "";
      });
      channel?.postMessage("refresh");
      await this.sync();
    },
    async sync() {
      const owner = this.owner;
      if (!owner || this.busy || !navigator.onLine) return;
      this.busy = true;
      try {
        // Use the same network lock as logout and the existing workout queue.
        await navigator.locks.request("pulse-workout-sync", async () => {
          if (useAuth().user?.id !== owner) return;
          if ((await api("/me")).user.id !== owner) return;
          let changed = false;
          for (;;) {
            const [item] = (await this.local(owner)).queue;
            if (!item) break;
            let rejected = "";
            try {
              await send("/intakes/" + item.day, item.body);
            } catch (e) {
              if (!e.status || e.status === 401 || e.status >= 500) throw e;
              const data = await dashboard(item.day);
              const record = data.entries.find((entry) => entry.key === item.key)?.record;
              const same = record?.status === item.body.status &&
                record.revision === item.body.revision + 1 &&
                (record.status !== "taken" || record.takenAt === item.body.takenAt);
              // Cancelled entries may no longer be visible after a product removal.
              if (!same) rejected = e.message;
            }
            const latest = await dashboard(item.day);
            await this.local(owner, (saved) => {
              if (saved.queue[0]?.key === item.key && saved.queue[0]?.day === item.day)
                saved.queue.shift();
              if (item.day === localDate()) saved.data = latest;
              if (rejected) saved.error = rejected;
            });
            changed = true;
          }
          const day = localDate();
          if (!changed || this.data?.day !== day) {
            const latest = await dashboard(day);
            await this.local(owner, (saved) => { saved.data = latest; });
          }
          if (changed) {
            channel?.postMessage("refresh");
            window.dispatchEvent(new Event("pulse-reminders-changed"));
          }
        });
      } catch (e) {
        if (useAuth().user?.id === owner && e.status && e.status < 500)
          this.error = e.message;
      } finally { this.busy = false; }
    },
    init() {
      if (channel) return;
      channel = new BroadcastChannel("pulse-intakes");
      channel.onmessage = () => this.load().catch(() => {});
      const resume = () => {
        if (useAuth().user?.id && this.owner && navigator.onLine &&
            (this.queue.length || this.data?.day !== localDate()))
          this.sync();
      };
      window.addEventListener("online", resume);
      document.addEventListener("visibilitychange", resume);
      window.addEventListener("pulse-supplements-changed", () => {
        if (this.owner) this.load().catch(() => {});
        channel.postMessage("refresh");
      });
      setInterval(resume, 5000);
    },
  },
});
