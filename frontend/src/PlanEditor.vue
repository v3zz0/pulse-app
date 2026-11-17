<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from "vue-router";
import { api, send } from "./api";
import { blank, fromServer, payload } from "./editor-model";
import { useWorkout } from "./stores/workout";
import { useDay } from "./stores/day";
import TrainingEditor from "./components/TrainingEditor.vue";
import DietEditor from "./components/DietEditor.vue";
import Icon from "./components/Icon.vue";

const props = defineProps({ kind: String });
const route = useRoute(),
  router = useRouter();
const training = computed(() => props.kind === "training");
const home = computed(() => (training.value ? "/allenati" : "/dieta"));
const manager = computed(() =>
  training.value ? "/altro/schede" : "/altro/piani",
);
const endpoint = computed(() => "/plans/" + props.kind);
const draft = ref(null),
  savedId = ref(null),
  revision = ref(null),
  baseline = ref(""),
  loading = ref(false),
  busy = ref(false),
  error = ref(""),
  message = ref("");
const serialized = computed(() =>
  draft.value ? JSON.stringify(payload(props.kind, draft.value)) : "",
);
const dirty = computed(
  () => !!draft.value && serialized.value !== baseline.value,
);
let pending;
function leave() {
  return !dirty.value || confirm("Uscire senza salvare le modifiche?");
}
function revealInvalid(event) {
  for (
    let details = event.target.closest("details");
    details;
    details = details.parentElement.closest("details")
  )
    details.open = true;
}
function beforeUnload(event) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = true;
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onUnmounted(() => window.removeEventListener("beforeunload", beforeUnload));
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(leave);

function accept(result) {
  savedId.value = result.id;
  revision.value = result.revision;
  draft.value = fromServer(props.kind, result);
  baseline.value = serialized.value;
  pending = null;
}
watch(
  () => [props.kind, route.params.id],
  async ([kind, id], _, cleanup) => {
    if (id && savedId.value === Number(id) && draft.value) return;
    let current = true;
    cleanup(() => (current = false));
    pending = null;
    error.value = "";
    loading.value = !!id;
    draft.value = null;
    savedId.value = null;
    try {
      if (id) {
        const result = await api("/plans/" + kind + "/" + id + "/editor");
        if (current) accept(result);
      } else {
        draft.value = blank(kind);
        baseline.value = serialized.value;
      }
    } catch (e) {
      if (current) error.value = e.message;
    } finally {
      if (current) loading.value = false;
    }
  },
  { immediate: true },
);

async function save(activate = false) {
  if (busy.value || !draft.value) return;
  if (activate && !confirm("Salvare e attivare questo piano?")) return;
  busy.value = true;
  error.value = message.value = "";
  try {
    if (dirty.value || !savedId.value) {
      const current = serialized.value;
      if (!pending || pending.current !== current)
        pending = { current, id: crypto.randomUUID() };
      const path = savedId.value ? "/" + savedId.value + "/editor" : "/editor";
      const result = await send(
        endpoint.value + path,
        {
          requestId: pending.id,
          revision: revision.value,
          data: JSON.parse(current),
        },
        savedId.value ? "PUT" : "POST",
      );
      accept(result);
      if (!route.params.id)
        await router.replace(home.value + "/editor/" + savedId.value);
      message.value = "Salvato.";
    }
    if (activate) {
      const path = endpoint.value + "/" + savedId.value;
      const detail = await api(path);
      if (detail.plan.status !== "active")
        await send(path, {
          action: "activate",
          confirm: true,
          activationToken: detail.activation.token,
        });
      if (training.value) await useWorkout().load();
      else await useDay().load();
      await router.push(home.value);
    } else if (training.value) await useWorkout().load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="editor-shell">
    <div class="editor-breadcrumb">
      <RouterLink :to="home" class="page-back"
        ><Icon name="arrow" :size="18" />
        {{ training ? "Allenati" : "Dieta" }}</RouterLink
      >
      <span aria-hidden="true">›</span
      ><span>{{ route.params.id ? "Modifica" : "Crea" }}</span>
    </div>
    <header class="feature-heading editor-feature-heading">
      <span class="feature-icon"
        ><Icon :name="training ? 'dumbbell' : 'food'" :size="26"
      /></span>
      <h1>
        {{
          route.params.id
            ? training
              ? "Modifica scheda"
              : "Modifica piano alimentare"
            : training
              ? "Crea allenamento"
              : "Crea piano alimentare"
        }}
      </h1>
    </header>
    <p v-if="loading" role="status">Caricamento…</p>
    <p v-if="!draft && error" class="warning" role="alert">{{ error }}</p>
    <form
      v-if="draft"
      class="editor-stack"
      @submit.prevent="save($event.submitter?.value === 'activate')"
      @invalid.capture="revealInvalid"
      :aria-busy="busy"
    >
      <fieldset class="editor-stack editor-form-fields" :disabled="busy">
        <section class="card editor-card editor-fields">
          <label class="fieldlabel"
            >{{ training ? "Nome scheda" : "Nome piano" }}
            <input
              class="field"
              v-model="draft.title"
              required
              maxlength="160"
            />
          </label>
          <label class="fieldlabel"
            >Descrizione
            <input v-model="draft.description" class="field" maxlength="300" />
          </label>
          <label class="fieldlabel"
            >Note generali
            <textarea
              v-model="draft.notes"
              class="field"
              rows="2"
              maxlength="6000"
            />
          </label>
        </section>

        <TrainingEditor
          v-if="training"
          :draft="draft"
          :key="savedId || 'new'"
        />
        <DietEditor v-else :draft="draft" :key="savedId || 'new'" />
        <RouterLink :to="manager" class="btn secondary wide editor-add">
          <Icon name="download" :size="18" /> Importa CSV
        </RouterLink>

        <div class="editor-save">
          <p v-if="error" class="warning" role="alert">{{ error }}</p>
          <p v-if="message" class="inline-note" role="status">{{ message }}</p>
          <div class="editor-actions">
            <button class="btn secondary" type="submit" value="save">
              <Icon name="save" :size="18" />
              {{ training ? "Salva scheda" : "Salva piano" }}
            </button>
            <button class="btn primary" type="submit" value="activate">
              <Icon name="play" :size="18" />
              {{ training ? "Attiva scheda" : "Attiva piano" }}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  </div>
</template>
