import { defineStore } from "pinia";
import { api, send } from "../api";
import { read, write, exclusive } from "../offline";
import { useAuth } from "./auth";
const copy = (v) => JSON.parse(JSON.stringify(v));
let channel;
export const useWorkout = defineStore("workout", {
  state: () => ({
    program: null,
    standards: {},
    active: null,
    history: [],
    queue: [],
    error: "",
    conflict: false,
    syncing: false,
    ready: false,
    owner: null,
  }),
  actions: {
    async persist() {
      await write(`workout:${this.owner}`, {
        program: this.program,
        standards: this.standards,
        active: this.active,
        history: this.history,
        queue: this.queue,
        conflict: this.conflict,
      });
    },
    restore(v) {
      if (v) Object.assign(this, v);
    },
    async init() {
      const owner = useAuth().user?.id;
      if (!owner) return;
      if (this.owner !== owner) {
        this.$reset();
        this.owner = owner;
      }
      if (!channel) {
        channel = new BroadcastChannel("pulse-workout");
        channel.onmessage = () => this.load();
        window.addEventListener("online", () => this.load());
        const resume = () => {
          if (
            useAuth().user?.id === this.owner &&
            this.queue.length &&
            !this.conflict &&
            !this.syncing &&
            navigator.onLine &&
            document.visibilityState === "visible"
          )
            this.load();
        };
        document.addEventListener("visibilitychange", resume);
        // Browser online events are hints; retry a pending queue while the app is visible.
        setInterval(resume, 3000);
      }
      await this.load();
    },
    async load() {
      return exclusive(async () => {
        this.restore(await read(`workout:${this.owner}`));
        try {
          const me = (await api("/me")).user;
          if (me.id !== this.owner)
            throw new Error(
              "Account cambiato: accedi nuovamente. La coda non è stata inviata.",
            );
          await this.flush();
          const data = await api("/training");
          if (!this.queue.length) {
            Object.assign(this, data);
            this.conflict = false;
          }
          this.error = this.conflict
            ? "Conflitto con un’altra scheda o dispositivo. La bozza locale è conservata."
            : "";
          await this.persist();
        } catch (e) {
          this.error =
            e.status === 401
              ? "Accesso scaduto: accedi prima di sincronizzare."
              : e.message;
        }
        this.ready = true;
      });
    },
    async flush() {
      if (this.conflict) return;
      this.syncing = true;
      try {
        while (this.queue.length) {
          const item = this.queue[0];
          const session = await send(item.path, item.body, item.method);
          this.queue.shift();
          if (!this.queue.length)
            this.active = session.status === "active" ? session : null;
          if (
            session.status === "completed" &&
            !this.history.some((s) => s.clientId === session.clientId)
          )
            this.history.unshift(session);
          await this.persist();
        }
      } catch (e) {
        if (e.status >= 400 && e.status < 500 && e.status !== 401) {
          this.conflict = true;
          await this.persist();
        }
        throw e;
      } finally {
        this.syncing = false;
      }
    },
    async enqueue(item, optimistic) {
      return exclusive(async () => {
        this.restore(await read(`workout:${this.owner}`));
        if (this.conflict)
          throw new Error("Risolvi il conflitto prima di continuare.");
        const before = copy({
          active: this.active,
          queue: this.queue,
          history: this.history,
        });
        if (optimistic) optimistic();
        this.queue.push(item);
        try {
          await this.persist();
        } catch (e) {
          this.restore(before);
          throw new Error(
            "Memoria locale non disponibile: modifica non salvata. " +
              e.message,
          );
        }
        channel?.postMessage("changed");
        try {
          const me = (await api("/me")).user;
          if (me.id !== this.owner)
            throw new Error("Account cambiato: sincronizzazione interrotta.");
          await this.flush();
          this.error = "";
        } catch (e) {
          this.error = this.conflict
            ? "Conflitto: bozza conservata, scegli come procedere."
            : e.status === 401
              ? "Accesso scaduto: bozza conservata."
              : "Bozza salvata sul dispositivo. Sincronizzazione in attesa: " +
                e.message;
        }
        channel?.postMessage("changed");
      });
    },
    async start(day) {
      if (this.active || this.queue.length)
        throw new Error(
          "Riprendi prima la sessione o attendi la sincronizzazione.",
        );
      const body = {
        clientId: crypto.randomUUID(),
        programId: this.program.id,
        day,
      };
      await this.enqueue({ path: "/training/sessions", body, method: "POST" });
    },
    async act(action) {
      // Read inside the cross-tab lock, so revision and changes belong to the same snapshot.
      return exclusive(async () => {
        this.restore(await read(`workout:${this.owner}`));
        if (this.conflict || !this.active || this.active.status !== "active")
          throw new Error(
            "Sessione non disponibile: ricarica o risolvi il conflitto.",
          );
        if (action.action === "set") {
          const validKg = (v) =>
            v === null ||
            (typeof v === "number" &&
              Number.isFinite(v) &&
              v >= 0 &&
              v <= 1500);
          if (
            (action.status === "pending" && !validKg(action.draftKg)) ||
            (action.status === "recorded" &&
              (!validKg(action.actualKg) || action.actualKg === null))
          )
            throw new Error("Carico non valido");
          if (
            action.actualReps != null &&
            (!Number.isInteger(action.actualReps) ||
              action.actualReps < 0 ||
              action.actualReps > 1000)
          )
            throw new Error("Ripetizioni non valide");
        }
        if (
          action.action === "timer" &&
          action.command === "start" &&
          (!Number.isInteger(action.seconds) ||
            action.seconds < 1 ||
            action.seconds > 3600)
        )
          throw new Error("Durata non valida");
        const body = {
          ...action,
          revision: this.active.revision,
          opId: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
        };
        const s = copy(this.active),
          sets = s.snapshot.blocks.flatMap((b) => b.sets),
          now = Date.now();
        if (action.action === "set") {
          const set = sets.find((s) => s.id === action.setId);
          if (set.status !== "pending") return;
          if (action.status === "pending") {
            set.draftKg = action.draftKg;
            set.actualReps = action.actualReps ?? null;
          } else {
            Object.assign(set, {
              status: action.status,
              actualKg: action.status === "recorded" ? action.actualKg : null,
              actualReps:
                action.status === "skipped"
                  ? null
                  : (action.actualReps ?? null),
              completedAt: body.occurredAt,
            });
            const block = s.snapshot.blocks.find((b) =>
              b.sets.some((x) => x.id === set.id),
            );
            if (action.status !== "skipped" && block.restSeconds)
              s.timer = {
                endAt: new Date(now + block.restSeconds * 1000).toISOString(),
                pausedRemaining: null,
              };
          }
        } else if (action.action === "skip-block") {
          for (const set of s.snapshot.blocks.find(
            (b) => b.id === action.blockId,
          ).sets)
            if (set.status === "pending")
              Object.assign(set, {
                status: "skipped",
                actualKg: null,
                actualReps: null,
                completedAt: body.occurredAt,
              });
        } else if (action.action === "timer") {
          if (action.command === "start")
            s.timer = {
              endAt: new Date(now + action.seconds * 1000).toISOString(),
              pausedRemaining: null,
            };
          if (action.command === "pause" && s.timer?.endAt)
            s.timer = {
              endAt: null,
              pausedRemaining: Math.max(
                0,
                Math.ceil((Date.parse(s.timer.endAt) - now) / 1000),
              ),
            };
          if (action.command === "resume" && s.timer?.pausedRemaining != null)
            s.timer = {
              endAt: new Date(
                now + s.timer.pausedRemaining * 1000,
              ).toISOString(),
              pausedRemaining: null,
            };
          if (action.command === "stop") s.timer = null;
        } else if (action.action === "cooldown") s.snapshot.cooldownDone = true;
        else if (action.action === "finish") {
          if (
            sets.some((s) => s.status === "pending") ||
            !s.snapshot.cooldownDone
          )
            throw new Error(
              "Gestisci tutte le serie e conferma il defaticamento.",
            );
          s.status = "completed";
          s.completedAt = body.occurredAt;
          s.timer = null;
        }
        const before = copy({
          active: this.active,
          queue: this.queue,
          history: this.history,
        });
        s.revision++;
        this.active = s;
        this.queue.push({
          path: "/training/sessions/" + s.clientId,
          body,
          method: "PUT",
        });
        try {
          await this.persist();
        } catch (e) {
          this.restore(before);
          throw new Error(
            "Memoria locale non disponibile: modifica non salvata. " +
              e.message,
          );
        }
        channel?.postMessage("changed");
        try {
          const me = (await api("/me")).user;
          if (me.id !== this.owner) throw new Error("Account cambiato");
          await this.flush();
          this.error = "";
        } catch (e) {
          this.error = this.conflict
            ? "Conflitto: bozza locale conservata."
            : "Salvato sul dispositivo, invio in attesa: " + e.message;
        }
        channel?.postMessage("changed");
      });
    },
    async discard() {
      return exclusive(async () => {
        // Explicit conflict resolution; preserve a downloadable copy before dropping the queue.
        const blob = new Blob(
          [JSON.stringify(await read(`workout:${this.owner}`), null, 2)],
          { type: "application/json" },
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "pulse-bozza-allenamento.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this.queue = [];
        this.conflict = false;
        Object.assign(this, await api("/training"));
        await this.persist();
        this.error = "Versione server caricata. Copia della bozza scaricata.";
        channel?.postMessage("changed");
      });
    },
    async standard(setId, value) {
      return exclusive(async () => {
        this.restore(await read(`workout:${this.owner}`));
        const me = (await api("/me")).user;
        if (me.id !== this.owner) throw new Error("Account cambiato");
        const current = this.standards[setId] || { revision: 0 };
        this.standards[setId] = await send("/training/standard", {
          programId: this.program.id,
          setId,
          kg: value,
          revision: current.revision,
          confirm: true,
        });
        await this.persist();
        channel?.postMessage("changed");
      });
    },
  },
});
