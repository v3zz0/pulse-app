<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { flowExercise } from "../flow-media";
const p = defineProps({ id: String }),
  data = ref(null),
  error = ref(""),
  paused = ref(true),
  ready = ref(false),
  frame = ref(0),
  large = ref(null);
const preference = matchMedia("(prefers-reduced-motion: reduce)");
let timer,
  index = 0;
const current = computed(() => data.value?.animation?.frames[frame.value]?.url);
function animate() {
  clearInterval(timer);
  frame.value = 0;
  index = 0;
  if (!paused.value && ready.value) {
    timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      index = (index + 1) % data.value.animation.sequence.length;
      frame.value = data.value.animation.sequence[index];
    }, data.value.animation.frameDurationMs);
  }
}
function reduced() {
  if (preference.matches) paused.value = true;
  animate();
}
onMounted(async () => {
  preference.addEventListener("change", reduced);
  try {
    data.value = await flowExercise(p.id);
    if (!data.value.animation) return;
    await Promise.all(
      data.value.animation.frames.map(
        (f) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = f.url;
          }),
      ),
    );
    ready.value = true;
    paused.value = preference.matches;
    animate();
  } catch {
    error.value = "Animazione non disponibile su questo dispositivo.";
  }
});
watch(paused, animate);
onUnmounted(() => {
  clearInterval(timer);
  preference.removeEventListener("change", reduced);
});
</script>
<template>
  <div class="flow-player">
    <p v-if="error" class="note">{{ error }}</p>
    <template v-else-if="ready"
      ><img
        :src="current"
        :alt="data.name + ' · animazione dimostrativa'"
        width="260"
        height="260"
      />
      <div class="btnrow">
        <button class="btn secondary" @click="paused = !paused">
          {{ paused ? "Riprendi animazione" : "Pausa animazione" }}</button
        ><button class="btn ghost" @click="large.showModal()">
          Ingrandisci
        </button>
      </div>
      <p class="source-note">
        Flow · {{ data.animation.license }} · sequenza illustrativa, non
        prescrive il ritmo.
      </p>
      <dialog ref="large" class="card">
        <img :src="current" :alt="data.name" /><button
          class="btn secondary"
          @click="large.close()"
        >
          Chiudi animazione
        </button>
      </dialog></template
    >
    <p v-else class="note">
      {{
        data && !data.animation
          ? "Nessuna animazione disponibile per questo esercizio."
          : "Caricamento animazione…"
      }}
    </p>
  </div>
</template>
<style scoped>
.flow-player img {
  display: block;
  object-fit: contain;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  margin: 10px auto;
}
.flow-player dialog {
  color: var(--ink);
  margin: auto;
  max-width: 90vw;
  max-height: 90dvh;
}
.flow-player dialog img {
  width: min(650px, 80vw);
  height: min(650px, 65dvh);
}
.flow-player dialog::backdrop {
  background: #000c;
}
</style>
