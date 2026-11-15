<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "./stores/auth";
const identifier = ref(""),
  password = ref(""),
  error = ref(""),
  busy = ref(false),
  router = useRouter(),
  auth = useAuth();
async function login() {
  busy.value = true;
  error.value = "";
  try {
    await auth.login(identifier.value, password.value);
    password.value = "";
    await router.replace("/");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="pagehead">
    <div>
      <div class="focus-label">IL TUO SPAZIO PRIVATO</div>
      <h1>Bentornato<span style="color: var(--accent)">.</span></h1>
    </div>
  </div>
  <form class="card" @submit.prevent="login">
    <h2>Accedi a PULSE</h2>
    <label class="fieldlabel" for="identifier">Email o nome utente</label
    ><input
      id="identifier"
      v-model="identifier"
      class="field"
      autocomplete="username"
      required
    /><label class="fieldlabel" for="password">Password</label
    ><input
      id="password"
      v-model="password"
      type="password"
      class="field"
      autocomplete="current-password"
      required
    /><button class="btn primary wide" :disabled="busy">
      {{ busy ? "Accesso in corso…" : "Accedi" }}
    </button>
    <p v-if="error" role="alert" class="warning">{{ error }}</p>
    <p class="source-note">
      Accesso riservato. Gli account sono gestiti dall’amministratore.
    </p>
  </form>
</template>
