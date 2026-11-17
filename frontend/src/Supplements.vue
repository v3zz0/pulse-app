<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { api, send } from "./api";
import { localDate } from "./stores/day";
import Icon from "./components/Icon.vue";
import { weekdays } from "./workout-display";
const day = ref(localDate()),
  data = ref(null),
  history = ref([]),
  error = ref(""),
  message = ref(""),
  busy = ref(false),
  archived = ref(false),
  productDialog = ref(null),
  recordDialog = ref(null),
  editor = ref(null),
  editRecord = ref(null),
  doses = ref({}),
  reminders = ref([]);
const updates = new BroadcastChannel("pulse-reminders");
onUnmounted(() => updates.close());
const historyFrom = ref(""),
  historyTo = ref(""),
  historyMore = ref(false);
async function loadHistory(append = false) {
  const query = new URLSearchParams({
    offset: String(append ? history.value.length : 0),
  });
  if (historyFrom.value) query.set("from", historyFrom.value);
  if (historyTo.value) query.set("to", historyTo.value);
  const rows = await api("/supplements/history?" + query);
  historyMore.value = rows.length === 200;
  history.value = append ? [...history.value, ...rows] : rows;
}
const unplannedOpen = ref(false);
const plannedEntries = computed(
  () => data.value?.entries.filter((e) => !e.unscheduled) || [],
);
const unplannedEntries = computed(
  () => data.value?.entries.filter((e) => e.unscheduled) || [],
);
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const visibleProducts = computed(
  () => data.value?.products.filter((p) => archived.value || p.active) || [],
);
const activeProducts = computed(
  () => data.value?.products.filter((p) => p.active) || [],
);
async function load() {
  const result = await api("/supplements/day/" + day.value);
  data.value = result;
  await loadHistory();
  reminders.value = await api("/reminders/due");
  doses.value = Object.fromEntries(
    result.entries.map((e) => [
      e.key,
      e.record?.status === "taken"
        ? e.record.dose || ""
        : e.planned?.dose || "",
    ]),
  );
  window.dispatchEvent(new Event("pulse-reminders-changed"));
  updates.postMessage("changed");
}
async function run(fn) {
  error.value = "";
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(() => run(load));
function editProduct(p) {
  editor.value = p
    ? JSON.parse(JSON.stringify(p))
    : {
        clientId: crypto.randomUUID(),
        revision: 0,
        name: "",
        brand: "",
        ingredients: "",
        labelQuantity: "",
        labelUnit: "",
        notes: "",
        instructions: "",
        active: true,
        declaredActives: [],
        schedule: [],
      };
  productDialog.value.showModal();
}
function addSchedule() {
  editor.value.schedule.push({
    id: crypto.randomUUID(),
    at: "",
    timezone,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    mode: "any",
    everyDays: 1,
    startDate: null,
    dose: "",
    doseConfirmed: false,
    meal: "",
    reminderEnabled: false,
  });
}
async function saveProduct() {
  await run(async () => {
    const p = editor.value;
    await send(
      "/supplements" + (p.id ? "/" + p.id : ""),
      { data: p, clientId: p.clientId, revision: p.revision, confirm: true },
      p.id ? "PUT" : "POST",
    );
    await load();
    productDialog.value.close();
    message.value = "Integratore e programmazione salvati";
  });
}
async function archive(p) {
  if (
    !confirm(
      "Archiviare " +
        p.name +
        "? Lo storico resta conservato e i promemoria vengono disattivati.",
    )
  )
    return;
  await run(async () => {
    await send("/supplements/" + p.id, {
      action: "archive",
      revision: p.revision,
      confirm: true,
    });
    await load();
    message.value = "Integratore archiviato";
  });
}
async function setMode(mode) {
  await run(async () => {
    await send("/supplements/day/" + day.value, {
      mode,
      revision: data.value.modeRevision,
    });
    await load();
  });
}
async function result(entry, status) {
  if (status === "taken" && day.value !== localDate()) {
    correct(entry);
    return;
  }
  if (
    status === "cancelled" &&
    !confirm(
      "Annullare questa registrazione? La rettifica resta nello storico.",
    )
  )
    return;
  await run(async () => {
    await send("/intakes/" + day.value, {
      productId: entry.productId,
      slot: entry.slot,
      status,
      dose: status === "taken" ? doses.value[entry.key] || null : null,
      takenAt: status === "taken" ? new Date().toISOString() : undefined,
      timezone,
      revision: entry.record?.revision || 0,
      confirm: true,
    });
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      for (const n of (await reg?.getNotifications()) || [])
        if (
          n.data?.kind === "supplement" &&
          n.data.target === String(entry.productId) &&
          (n.data.scheduleId === entry.slot ||
            (!n.data.scheduleId &&
              (entry.slot === "daily" || n.data.at === entry.slot)))
        )
          n.close();
    } catch {}
    await load();
    message.value =
      status === "taken"
        ? "Assunzione registrata"
        : status === "skipped"
          ? "Assunzione saltata"
          : "Registrazione annullata";
  });
}
function correct(entry) {
  const r = entry?.record || entry;
  editRecord.value = {
    productId: entry?.productId || activeProducts.value[0]?.id || "",
    slot: entry?.slot || crypto.randomUUID(),
    manual: !entry,
    unscheduled: entry?.unscheduled || false,
    revision: r?.revision || 0,
    day: r?.day || day.value,
    dose: r?.dose || "",
    time: r?.takenAt
      ? new Date(r.takenAt).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    existing: !!r?.id,
  };
  recordDialog.value.showModal();
}
async function saveRecord() {
  await run(async () => {
    const r = editRecord.value;
    if (!r.time) throw new Error("Inserisci l’orario effettivo");
    await send("/intakes/" + r.day, {
      productId: Number(r.productId),
      slot: r.slot,
      manual: r.manual,
      revision: r.revision,
      status: "taken",
      dose: r.dose || null,
      takenAt: new Date(`${r.day}T${r.time}:00`).toISOString(),
      timezone,
      confirm: true,
    });
    await load();
    recordDialog.value.close();
    if (r.manual || r.unscheduled) unplannedOpen.value = true;
    message.value = "Assunzione aggiornata";
  });
}
async function snooze(entry, minutes) {
  await run(async () => {
    const r = reminders.value.find((r) => r.settings.scheduleId === entry.slot);
    if (!r) return;
    await send("/reminders/" + r.id, {
      action: "snooze",
      minutes,
      date: r.date,
      revision: r.revision,
    });
    await load();
    message.value = `Promemoria rinviato di ${minutes} minuti`;
  });
}
const dueFor = (entry) =>
  reminders.value.some((r) => r.settings.scheduleId === entry.slot);
async function permission() {
  if ("Notification" in window) await Notification.requestPermission();
}
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="focus-label">IL TUO SPAZIO</div>
      <h1>I miei integratori<span class="mint">.</span></h1>
      <p class="text-muted">
        La tua pianificazione, le assunzioni effettive e lo storico.
      </p>
    </div>
  </div>
  <p v-if="error" role="alert" class="warning">{{ error }}</p>
  <p v-if="message" role="status" class="inline-note">{{ message }}</p>
  <div class="btnrow">
    <button class="btn primary" @click="editProduct(null)">
      <Icon name="plus" :size="17" />Aggiungi integratore</button
    ><RouterLink to="/altro" class="btn ghost">Torna ad Altro</RouterLink>
  </div>
  <section
    v-if="data"
    class="card supplement-section"
    aria-labelledby="today-supplements"
  >
    <h2 id="today-supplements">
      {{
        day === localDate()
          ? "Programmati per oggi"
          : "Programmati per la data selezionata"
      }}
    </h2>
    <div class="field-row">
      <label class="fieldlabel"
        >Data integratori<input
          class="field"
          type="date"
          v-model="day"
          @change="run(load)"
      /></label>
      <div>
        <span class="fieldlabel"
          >Giorno per gli integratori
          {{ data.modeSource === "dieta" ? "· dalla Dieta" : "" }}</span
        >
        <div class="switch-seg">
          <button
            v-for="mode in ['ON', 'OFF']"
            :key="mode"
            :class="{ active: data.mode === mode }"
            :disabled="busy"
            @click="setMode(mode)"
          >
            {{ mode }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="data.modeRequired" class="warning">
      Scegli ON o OFF per visualizzare gli orari limitati a quel tipo di
      giornata. Non viene dedotto dal nome della scheda.
    </p>
    <p v-if="!plannedEntries.length" class="note">
      Nessuna assunzione programmata per questa data. Aggiungi una
      pianificazione ai tuoi prodotti o registra un’assunzione effettiva.
    </p>
    <article
      v-for="entry in plannedEntries"
      :key="entry.key"
      class="supplement-today"
      :data-testid="'supplement-slot-' + entry.slot"
    >
      <div class="card-head">
        <h3>{{ entry.name }}</h3>
        <span :class="['pill', entry.status === 'taken' ? '' : 'grey']">{{
          { pending: "Da assumere", taken: "Assunto", skipped: "Saltato" }[
            entry.status
          ]
        }}</span>
      </div>
      <p class="smallmuted">
        {{
          entry.planned?.at ||
          (entry.slot === "daily" ? "Senza orario pianificato" : entry.slot)
        }}
        {{ entry.planned?.timezone || "" }} · Dose prevista:
        {{ entry.planned?.dose || "non configurata"
        }}<span v-if="entry.planned?.meal"> · {{ entry.planned.meal }}</span
        ><span v-if="entry.unscheduled"> · fuori programmazione attuale</span>
      </p>
      <template v-if="entry.status === 'pending'"
        ><label class="fieldlabel"
          >Dose effettiva (facoltativa)<input
            class="field"
            v-model="doses[entry.key]"
            maxlength="100"
            placeholder="Puoi confermare o modificare la dose prevista"
        /></label>
        <div class="btnrow">
          <button
            class="btn primary"
            :disabled="busy"
            @click="result(entry, 'taken')"
          >
            Segna assunto</button
          ><button
            class="btn ghost"
            :disabled="busy"
            @click="result(entry, 'skipped')"
          >
            Salta
          </button>
        </div></template
      >
      <template v-else
        ><p class="note">
          {{ entry.record?.dose || "Dose non registrata"
          }}<span v-if="entry.record?.takenAt">
            · {{ new Date(entry.record.takenAt).toLocaleString("it-IT") }}</span
          >
        </p>
        <div class="btnrow">
          <button
            class="btn secondary"
            :disabled="busy"
            @click="correct(entry)"
          >
            Correggi registrazione</button
          ><button
            class="btn ghost"
            :disabled="busy"
            @click="result(entry, 'cancelled')"
          >
            Annulla registrazione
          </button>
        </div></template
      >
      <div v-if="dueFor(entry) && entry.status === 'pending'" class="btnrow">
        <button
          v-for="m in [15, 30, 60]"
          :key="m"
          class="btn ghost sm"
          :disabled="busy"
          @click="snooze(entry, m)"
        >
          Rinvia {{ m }} min
        </button>
      </div>
    </article>
    <details
      v-if="unplannedEntries.length"
      class="supplement-history"
      :open="unplannedOpen"
    >
      <summary>
        Altre assunzioni registrate ({{ unplannedEntries.length }})
      </summary>
      <article
        v-for="entry in unplannedEntries"
        :key="entry.key"
        class="supplement-today"
      >
        <b>{{ entry.name }}</b>
        <p class="note">
          {{ entry.status === "taken" ? "Assunto" : "Saltato" }} ·
          {{ entry.record?.dose || "Dose non registrata" }} ·
          {{
            entry.record?.takenAt
              ? new Date(entry.record.takenAt).toLocaleString("it-IT")
              : day
          }}
        </p>
        <div class="btnrow">
          <button
            class="btn secondary"
            :disabled="busy"
            @click="correct(entry)"
          >
            Correggi registrazione</button
          ><button
            class="btn ghost"
            :disabled="busy"
            @click="result(entry, 'cancelled')"
          >
            Annulla registrazione
          </button>
        </div>
      </article>
    </details>
    <button
      class="btn secondary"
      :disabled="!activeProducts.length"
      @click="correct(null)"
    >
      Registra assunzione
    </button>
  </section>
  <section
    v-if="data?.overlaps.length"
    class="card supplement-section"
    aria-labelledby="overlaps-title"
  >
    <h2 id="overlaps-title">Possibili sovrapposizioni</h2>
    <p class="note">
      Confronto informativo degli ingredienti dichiarati, da verificare sulle
      etichette. Non sommiamo quantità né deduciamo dosi mancanti.
    </p>
    <p v-for="o in data.overlaps" :key="o.ingredient" class="warning">
      <b>{{ o.ingredient }}</b
      >: {{ o.products.map((p) => p.name).join(" · ") }}
    </p>
  </section>
  <section class="card supplement-section">
    <div class="card-head">
      <h2>I tuoi prodotti</h2>
      <label class="grocery-item"
        ><input type="checkbox" v-model="archived" />Mostra archiviati</label
      >
    </div>
    <p v-if="!visibleProducts.length" class="note">
      Nessun prodotto: aggiungi soltanto quelli che vuoi gestire.
    </p>
    <article
      v-for="p in visibleProducts"
      :key="p.id"
      class="supplement-product"
      :data-testid="'supplement-product-' + p.id"
    >
      <h3>
        {{ p.name }} <span v-if="!p.active" class="pill grey">Archiviato</span>
      </h3>
      <p class="note">
        {{ p.brand }}
        {{
          p.labelQuantity
            ? `· ${p.labelQuantity} ${p.labelUnit} per porzione`
            : ""
        }}
      </p>
      <p class="note">{{ p.ingredients || "Ingredienti non specificati" }}</p>
      <p v-if="p.declaredActives.length" class="note">
        {{
          p.declaredActives
            .map(
              (a) =>
                a.name +
                (a.quantity == null
                  ? " · quantità non indicata"
                  : ` ${a.quantity} ${a.unit}`),
            )
            .join(" · ")
        }}
      </p>
      <p v-if="p.instructions" class="note">{{ p.instructions }}</p>
      <p v-if="p.notes" class="note">{{ p.notes }}</p>
      <p class="smallmuted">
        {{ p.schedule.length }} orari personali configurati
      </p>
      <div class="btnrow">
        <button class="btn secondary" @click="editProduct(p)">
          Modifica {{ p.name }}</button
        ><button v-if="p.active" class="btn ghost" @click="archive(p)">
          Archivia {{ p.name }}
        </button>
      </div>
    </article>
  </section>
  <section class="card supplement-section">
    <h2>Storico assunzioni</h2>
    <p class="note">
      Registrazioni in pagine di 200, comprese le rettifiche. Modificare o
      archiviare un prodotto conserva il nome e l’etichetta registrati.
    </p>
    <div class="field-row">
      <label class="fieldlabel"
        >Storico dal<input
          class="field"
          type="date"
          v-model="historyFrom"
          @change="run(() => loadHistory())" /></label
      ><label class="fieldlabel"
        >Storico al<input
          class="field"
          type="date"
          v-model="historyTo"
          @change="run(() => loadHistory())"
      /></label>
    </div>
    <p v-if="!history.length" class="note">Nessuna registrazione.</p>
    <details v-for="r in history" :key="r.id" class="supplement-history">
      <summary>
        {{ r.day }} · {{ r.name }} ·
        {{
          { taken: "Assunto", skipped: "Saltato", cancelled: "Annullato" }[
            r.status
          ]
        }}
        · {{ r.dose || "Dose non registrata" }}
      </summary>
      <p class="note">
        {{ r.productSnapshot?.ingredients }} ·
        {{
          r.takenAt
            ? new Date(r.takenAt).toLocaleString("it-IT")
            : "Nessuna assunzione effettiva"
        }}
      </p>
      <p class="note">Rettifiche esplicite: {{ r.corrections.length }}</p>
      <button class="btn ghost" @click="correct(r)">
        Rettifica registrazione
      </button>
    </details>
    <button
      v-if="historyMore"
      class="btn secondary"
      :disabled="busy"
      @click="run(() => loadHistory(true))"
    >
      Carica altre registrazioni
    </button>
  </section>
  <dialog
    ref="productDialog"
    class="card supplement-dialog"
    aria-labelledby="product-title"
  >
    <form v-if="editor" @submit.prevent="saveProduct">
      <h2 id="product-title">
        {{ editor.id ? "Modifica integratore" : "Aggiungi integratore" }}
      </h2>
      <p v-if="error" role="alert" class="warning">{{ error }}</p>
      <label class="fieldlabel"
        >Nome commerciale<input
          v-model="editor.name"
          class="field"
          required
          maxlength="160" /></label
      ><label class="fieldlabel"
        >Marca (facoltativa)<input
          v-model="editor.brand"
          class="field"
          maxlength="100" /></label
      ><label class="fieldlabel"
        >Ingredienti dichiarati<textarea
          v-model="editor.ingredients"
          class="field"
          rows="2"
          maxlength="4000"
        ></textarea>
      </label>
      <div class="field-row">
        <label class="fieldlabel"
          >Quantità per porzione sull’etichetta<input
            v-model="editor.labelQuantity"
            class="field"
            maxlength="100" /></label
        ><label class="fieldlabel"
          >Unità della porzione<input
            v-model="editor.labelUnit"
            class="field"
            maxlength="40"
        /></label>
      </div>
      <fieldset class="supplement-fieldset">
        <legend>Principi attivi dichiarati</legend>
        <div
          v-for="(a, i) in editor.declaredActives"
          :key="i"
          class="active-ingredient"
        >
          <label class="fieldlabel"
            >Principio attivo {{ i + 1
            }}<input class="field" v-model="a.name" maxlength="100" required
          /></label>
          <div class="field-row">
            <label class="fieldlabel"
              >Quantità dichiarata {{ i + 1
              }}<input
                class="field"
                type="number"
                min="0.0001"
                step="any"
                max="1000000"
                v-model.number="a.quantity" /></label
            ><label class="fieldlabel"
              >Unità ingrediente {{ i + 1
              }}<input
                class="field"
                v-model="a.unit"
                maxlength="40"
                :required="a.quantity !== '' && a.quantity != null"
            /></label>
          </div>
          <button
            type="button"
            class="textbutton"
            @click="editor.declaredActives.splice(i, 1)"
          >
            Rimuovi ingrediente {{ i + 1 }}
          </button>
        </div>
        <button
          type="button"
          class="btn ghost"
          :disabled="editor.declaredActives.length >= 30"
          @click="
            editor.declaredActives.push({ name: '', quantity: null, unit: '' })
          "
        >
          Aggiungi principio attivo
        </button>
      </fieldset>
      <label class="fieldlabel"
        >Istruzioni dell’etichetta o del professionista<textarea
          class="field"
          v-model="editor.instructions"
          maxlength="4000"
          rows="2"
        ></textarea></label
      ><label class="fieldlabel"
        >Note integratore<textarea
          class="field"
          v-model="editor.notes"
          maxlength="2000"
          rows="2"
        ></textarea></label
      ><label class="grocery-item"
        ><input type="checkbox" v-model="editor.active" />Prodotto attivo</label
      >
      <h3>Pianificazione personale</h3>
      <p class="note">
        Orari e dosi sono scelti da te. Nessuna assunzione viene registrata
        automaticamente.
      </p>
      <fieldset
        v-for="(s, i) in editor.schedule"
        :key="s.id"
        class="supplement-fieldset"
        :data-testid="'schedule-editor-' + i"
      >
        <legend>Orario {{ i + 1 }}</legend>
        <div class="field-row">
          <label class="fieldlabel"
            >Ora prevista {{ i + 1
            }}<input type="time" class="field" v-model="s.at" required /></label
          ><label class="fieldlabel"
            >Fuso orario {{ i + 1
            }}<input class="field" v-model="s.timezone" required
          /></label>
        </div>
        <label class="fieldlabel"
          >Dose pianificata {{ i + 1 }} (facoltativa)<input
            class="field"
            v-model="s.dose"
            maxlength="100" /></label
        ><label v-if="s.dose" class="grocery-item"
          ><input type="checkbox" v-model="s.doseConfirmed" required />Confermo
          personalmente questa dose {{ i + 1 }}</label
        >
        <div class="field-row">
          <label class="fieldlabel"
            >Tipo di giornata {{ i + 1
            }}<select class="field" v-model="s.mode">
              <option value="any">ON e OFF</option>
              <option value="ON">Solo allenamento ON</option>
              <option value="OFF">Solo riposo OFF</option>
            </select></label
          ><label class="fieldlabel"
            >Ogni quanti giorni {{ i + 1
            }}<input
              class="field"
              type="number"
              min="1"
              max="365"
              v-model.number="s.everyDays"
              required
          /></label>
        </div>
        <label class="fieldlabel"
          >Data iniziale {{ i + 1
          }}<input
            class="field"
            type="date"
            v-model="s.startDate"
            :required="s.everyDays > 1"
        /></label>
        <div class="weekday-options">
          <label v-for="(name, n) in weekdays" :key="n"
            ><input
              type="checkbox"
              :value="n"
              v-model="s.weekdays"
              :aria-label="`Orario ${i + 1}: ${name}`"
            />{{ name }}</label
          >
        </div>
        <label class="fieldlabel"
          >Relazione con il pasto {{ i + 1
          }}<input
            class="field"
            v-model="s.meal"
            maxlength="100"
            placeholder="Indicazione personale, facoltativa" /></label
        ><label class="grocery-item"
          ><input type="checkbox" v-model="s.reminderEnabled" />Promemoria per
          orario {{ i + 1 }}</label
        ><button
          type="button"
          class="textbutton"
          @click="editor.schedule.splice(i, 1)"
        >
          Rimuovi orario {{ i + 1 }}
        </button>
      </fieldset>
      <button
        type="button"
        class="btn secondary"
        :disabled="editor.schedule.length >= 8"
        @click="addSchedule"
      >
        Aggiungi orario</button
      ><button type="button" class="btn ghost" @click="permission">
        Consenti notifiche
      </button>
      <p class="note">
        Avvisi mentre PULSE è aperta e connessa. Nessun push garantito ad app
        chiusa.
      </p>
      <div class="btnrow">
        <button type="button" class="btn ghost" @click="productDialog.close()">
          Indietro</button
        ><button class="btn primary" :disabled="busy">Salva integratore</button>
      </div>
    </form>
  </dialog>
  <dialog
    ref="recordDialog"
    class="card supplement-dialog"
    aria-labelledby="record-title"
  >
    <form v-if="editRecord" @submit.prevent="saveRecord">
      <h2 id="record-title">
        {{
          editRecord.existing ? "Rettifica assunzione" : "Registra assunzione"
        }}
      </h2>
      <p v-if="error" role="alert" class="warning">{{ error }}</p>
      <label class="fieldlabel"
        >Prodotto assunto<select
          class="field"
          v-model="editRecord.productId"
          :disabled="editRecord.existing"
          required
        >
          <option value="">Scegli un prodotto</option>
          <option
            v-for="p in data.products.filter(
              (p) => p.active || p.id === editRecord.productId,
            )"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }}
          </option>
        </select></label
      >
      <p class="note">Data: {{ editRecord.day }} · {{ timezone }}</p>
      <label class="fieldlabel"
        >Dose effettivamente assunta (includi unità)<input
          class="field"
          v-model="editRecord.dose"
          maxlength="100" /></label
      ><label class="fieldlabel"
        >Orario locale<input
          class="field"
          type="time"
          v-model="editRecord.time"
          required
      /></label>
      <div class="btnrow">
        <button type="button" class="btn ghost" @click="recordDialog.close()">
          Indietro</button
        ><button class="btn primary" :disabled="busy">Segna assunto</button>
      </div>
    </form>
  </dialog>
</template>
<style scoped>
.supplement-section {
  margin-top: 16px;
}
.supplement-section h2 {
  font-size: 20px;
}
.supplement-today,
.supplement-product {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.supplement-today h3,
.supplement-product h3 {
  margin: 0;
  font-size: 17px;
}
.supplement-today .card-head {
  margin: 0;
}
.supplement-history {
  padding: 12px 0;
  border-top: 1px solid var(--line);
  font-size: 13px;
}
.supplement-history summary {
  cursor: pointer;
  line-height: 1.6;
}
.supplement-dialog {
  color: var(--ink);
  margin: auto;
  width: min(calc(100% - 24px), 650px);
  max-height: 90dvh;
  overflow: auto;
}
.supplement-dialog::backdrop {
  background: #000b;
}
.supplement-dialog .fieldlabel {
  margin: 10px 0;
}
.supplement-fieldset {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  margin: 14px 0;
}
.active-ingredient {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.supplement-section .card-head {
  flex-wrap: wrap;
}
.supplement-section .btnrow {
  flex-wrap: wrap;
}
.supplement-dialog .btnrow {
  position: sticky;
  bottom: -21px;
  background: var(--panel);
  padding: 12px 0;
}
</style>
