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
    pendingImports: [],
    active: null,
    history: [],
    queue: [],
    error: "",
    conflict: false,
    syncing: false,
    saving: 0,
    ready: false,
    owner: null,
  }),
  actions: {
    async persist() {
      await write(`workout:${this.owner}`, {
        program: this.program,
        standards: this.standards,
        pendingImports: this.pendingImports,
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
      await exclusive(async () => {
        this.restore(await read(`workout:${this.owner}`));
        this.ready = true;
      });
      await this.sync();
    },
    async sync() {
      if (this.syncing) return;
      const owner = this.owner;
      if (!owner) return;
      this.syncing = true;
      try {
        // Network requests have a different lock: slow/offline requests must
        // never prevent a new input from being committed to IndexedDB.
        await navigator.locks.request("pulse-workout-sync", async () => {
          const me = (await api("/me")).user;
          if (
            me.id !== owner ||
            this.owner !== owner ||
            useAuth().user?.id !== owner
          )
            throw new Error("Account cambiato: sincronizzazione interrotta.");
          await this.flush(owner);
          const data = await api("/training");
          await exclusive(async () => {
            if (this.owner !== owner) return;
            this.restore(await read(`workout:${owner}`));
            if (!this.queue.length) {
              Object.assign(this, data);
              this.conflict = false;
            }
            this.error = this.conflict
              ? "Conflitto con un’altra scheda o dispositivo. La bozza locale è conservata."
              : "";
            await this.persist();
          });
        });
      } catch (e) {
        if (this.owner === owner)
          this.error =
            e.status === 401
              ? "Accesso scaduto: accedi prima di sincronizzare."
              : this.conflict
                ? "Conflitto: bozza conservata, scegli come procedere."
                : "Salvato sul dispositivo, invio in attesa: " + e.message;
      } finally {
        this.syncing = false;
      }
    },
    async flush(owner) {
      const retire = (session) => {
        const path = "/training/sessions/" + session.clientId;
        this.queue = this.queue.filter(
          (i) => i.path !== path && i.body.clientId !== session.clientId,
        );
        if (this.active?.clientId === session.clientId) this.active = null;
        this.conflict = false;
      };
      for (;;) {
        const item = await exclusive(async () => {
          if (this.owner !== owner) throw new Error("Account cambiato");
          this.restore(await read(`workout:${owner}`));
          const cancellation = this.queue.find(
            (i) => i.body.action === "cancel",
          );
          return cancellation || (!this.conflict ? this.queue[0] : null);
        });
        if (!item) return;
        let session;
        try {
          // A cancellation supersedes this session's unacknowledged changes;
          // keep every operation durable until the server acknowledges it.
          session = await send(item.path, item.body, item.method);
        } catch (e) {
          if (e.status === 409 && item.method === "PUT") {
            const current = await api(item.path);
            if (current.status === "cancelled") session = current;
          }
          if (!session) {
            await exclusive(async () => {
              if (this.owner !== owner) return;
              this.restore(await read(`workout:${owner}`));
              // A cancellation enqueued during the failed request can still win.
              if (
                (item.body.action === "cancel" ||
                  !this.queue.some(
                    (i) => i.path === item.path && i.body.action === "cancel",
                  )) &&
                e.status >= 400 &&
                e.status < 500 &&
                e.status !== 401
              )
                this.conflict = true;
              await this.persist();
            });
            if (
              item.body.action !== "cancel" &&
              e.status === 409 &&
              this.queue.some(
                (i) => i.path === item.path && i.body.action === "cancel",
              )
            )
              continue;
            throw e;
          }
        }
        await exclusive(async () => {
          if (this.owner !== owner) throw new Error("Account cambiato");
          this.restore(await read(`workout:${owner}`));
          if (session.status === "cancelled") retire(session);
          else {
            const index = this.queue.findIndex((i) =>
              i.body.opId
                ? i.body.opId === item.body.opId
                : i.body.clientId === item.body.clientId,
            );
            if (index >= 0) this.queue.splice(index, 1);
            if (!this.queue.length)
              this.active = session.status === "active" ? session : null;
            if (
              session.status === "completed" &&
              !this.history.some((s) => s.clientId === session.clientId)
            )
              this.history.unshift(session);
          }
          await this.persist();
        });
      }
    },
    async enqueue(item, optimistic) {
      const owner = this.owner;
      await exclusive(async () => {
        if (this.owner !== owner || useAuth().user?.id !== owner)
          throw new Error("Account cambiato");
        this.restore(await read(`workout:${this.owner}`));
        if (item.method === "POST" && (this.active || this.queue.length))
          throw new Error(
            "Riprendi prima la sessione o attendi la sincronizzazione.",
          );
        if (this.conflict)
          throw new Error("Risolvi il conflitto prima di continuare.");
        const before = copy({
          active: this.active,
          queue: this.queue,
          history: this.history,
          conflict: this.conflict,
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
      });
      await this.sync();
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
      const owner = this.owner,
        clientId = this.active?.clientId;
      this.saving++;
      try {
        await exclusive(async () => {
          if (this.owner !== owner || useAuth().user?.id !== owner)
            throw new Error("Account cambiato");
          this.restore(await read(`workout:${this.owner}`));
          if (this.active?.clientId !== clientId)
            throw new Error("Sessione cambiata: ricarica prima di modificare.");
          if (
            (this.conflict && action.action !== "cancel") ||
            !this.active ||
            this.active.status !== "active"
          )
            throw new Error(
              "Sessione non disponibile: ricarica o risolvi il conflitto.",
            );
          action = { ...action };
          if (action.action === "cancel" && action.confirm !== true)
            throw new Error("Conferma esplicita richiesta");
          if (action.action === "set") {
            const set = this.active.snapshot.blocks
              .flatMap((b) => b.sets)
              .find((s) => s.id === action.setId);
            if (!set) throw new Error("Serie inesistente");
            if (action.useDraft) {
              action.actualKg =
                action.status === "recorded" ? set.draftKg : null;
              action.actualReps =
                action.status === "skipped" ||
                set.repProposal?.kind === "compound"
                  ? null
                  : Object.hasOwn(set, "draftReps")
                    ? set.draftReps
                    : set.actualReps;
              delete action.useDraft;
            }
            if (
              action.status !== "pending" &&
              action.status !== "skipped" &&
              set.repProposal?.kind !== "compound" &&
              set.repProposal &&
              action.actualReps == null
            )
              throw new Error(
                "Inserisci le ripetizioni effettivamente eseguite",
              );
            const validKg = (v) =>
              v === null ||
              (typeof v === "number" &&
                Number.isFinite(v) &&
                v >= 0 &&
                v <= 1500);
            if (
              (action.status === "pending" &&
                Object.hasOwn(action, "draftKg") &&
                !validKg(action.draftKg)) ||
              (action.status === "recorded" &&
                (!validKg(action.actualKg) || action.actualKg === null))
            )
              throw new Error("Carico non valido");
            const repValue =
              action.status === "pending"
                ? (action.draftReps ?? action.actualReps)
                : action.actualReps;
            if (
              repValue != null &&
              (!Number.isInteger(repValue) || repValue < 0 || repValue > 1000)
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
              if (Object.hasOwn(action, "draftKg"))
                set.draftKg = action.draftKg;
              if (!Object.hasOwn(set, "draftReps"))
                set.draftReps = set.actualReps ?? null;
              if (Object.hasOwn(action, "draftReps"))
                set.draftReps = action.draftReps;
              else if (Object.hasOwn(action, "actualReps"))
                set.draftReps = action.actualReps;
              set.actualReps = null;
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
          } else if (action.action === "cancel") {
            s.status = "cancelled";
            s.cancelledAt = body.occurredAt;
            s.completedAt = null;
            s.timer = null;
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
          } else if (action.action === "cooldown")
            s.snapshot.cooldownDone = true;
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
            conflict: this.conflict,
          });
          s.revision++;
          if (action.action === "cancel") this.conflict = false;
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
        });
      } finally {
        this.saving--;
      }
      void this.sync();
    },
    async discard() {
      const owner = this.owner;
      return navigator.locks.request("pulse-workout-sync", () =>
        exclusive(async () => {
          if (this.owner !== owner || useAuth().user?.id !== owner)
            throw new Error("Account cambiato");
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
        }),
      );
    },
    async layout(data) {
      const owner = this.owner,
        programId = this.program.id;
      return navigator.locks.request("pulse-workout-sync", () =>
        exclusive(async () => {
          if (this.owner !== owner || useAuth().user?.id !== owner)
            throw new Error("Account cambiato");
          this.restore(await read(`workout:${owner}`));
          if (this.program.id !== programId)
            throw new Error("Programma cambiato: ricarica");
          const r = await send("/training/layout", {
            programId,
            revision: this.program.displayRevision || 0,
            data,
            confirm: true,
          });
          Object.assign(this.program, r);
          await this.persist();
          channel?.postMessage("changed");
        }),
      );
    },
    async chooseFlow(choice) {
      const owner = this.owner;
      const programId = this.program.id;
      const revision = this.program.flowRevision || 0;
      return navigator.locks.request("pulse-workout-sync", async () => {
        if (this.owner !== owner || useAuth().user?.id !== owner ||
            (await api("/me")).user.id !== owner)
          throw new Error("Account cambiato");
        const changed = await send("/training/flow", {
          ...choice, programId, revision, confirm: true,
        });
        await exclusive(async () => {
          if (this.owner !== owner || useAuth().user?.id !== owner) return;
          this.restore(await read(`workout:${owner}`));
          if (this.program?.id !== programId) return;
          Object.assign(this.program, changed);
          await this.persist();
        });
        channel?.postMessage("changed");
      });
    },
    async standard(setId, value) {
      const owner = this.owner,
        programId = this.program?.id;
      return navigator.locks.request("pulse-workout-sync", () =>
        exclusive(async () => {
          if (this.owner !== owner || useAuth().user?.id !== owner)
            throw new Error("Account cambiato");
          this.restore(await read(`workout:${this.owner}`));
          if (this.program?.id !== programId)
            throw new Error("Programma cambiato: ricarica.");
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
        }),
      );
    },
  },
});
