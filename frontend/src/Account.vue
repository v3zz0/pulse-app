<script setup>
import { ref } from "vue";
import { useAuth } from "./stores/auth";
const auth = useAuth();
const username = ref(auth.user?.username || "");
const currentPassword = ref("");
const newPassword = ref("");
const confirmation = ref("");
const busy = ref(false),
  error = ref(""),
  saved = ref(false);
async function save() {
  error.value = "";
  saved.value = false;
  if (newPassword.value !== confirmation.value) {
    error.value = "Le nuove password non coincidono";
    return;
  }
  if (
    newPassword.value &&
    new TextEncoder().encode(newPassword.value).length > 72
  ) {
    error.value = "La nuova password non deve superare 72 byte";
    return;
  }
  busy.value = true;
  try {
    await auth.updateProfile({
      username: username.value.trim(),
      currentPassword: currentPassword.value,
      ...(newPassword.value ? { newPassword: newPassword.value } : {}),
    });
    saved.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    currentPassword.value = "";
    newPassword.value = "";
    confirmation.value = "";
    busy.value = false;
  }
}
</script>
<template>
  <div class="pagehead">
    <div>
      <RouterLink to="/altro" class="page-back">‹ Impostazioni</RouterLink>
      <h1>Il tuo account<span style="color: var(--accent)">.</span></h1>
    </div>
  </div>
  <form class="card account-form" @submit.prevent="save">
    <h2>Le tue credenziali</h2>
    <fieldset
      :disabled="busy"
      style="border: 0; padding: 0; margin: 0; min-width: 0"
    >
      <label class="fieldlabel" for="account-username">Nome utente</label>
      <input
        id="account-username"
        v-model="username"
        class="field"
        autocomplete="username"
        required
        minlength="3"
        maxlength="64"
        pattern="[a-zA-Z0-9_.\-]{3,64}"
      />
      <p class="source-note">
        Da 3 a 64 lettere, numeri, punti, trattini o underscore. Puoi accedere
        anche con la tua email.
      </p>
      <label class="fieldlabel" for="account-current">Password attuale</label>
      <input
        id="account-current"
        v-model="currentPassword"
        class="field"
        type="password"
        autocomplete="current-password"
        required
        maxlength="512"
      />
      <div class="divider"></div>
      <h2>Cambia password</h2>
      <p class="smallmuted">
        Lascia vuoti questi due campi per mantenere la password attuale. Se la
        cambi, gli altri accessi a PULSE verranno disconnessi.
      </p>
      <label class="fieldlabel" for="account-new">Nuova password</label>
      <input
        id="account-new"
        v-model="newPassword"
        class="field"
        type="password"
        autocomplete="new-password"
        minlength="12"
        maxlength="72"
      />
      <label class="fieldlabel" for="account-confirm"
        >Conferma nuova password</label
      >
      <input
        id="account-confirm"
        v-model="confirmation"
        class="field"
        type="password"
        autocomplete="new-password"
        :required="!!newPassword"
        maxlength="72"
      />
      <p class="source-note">Almeno 12 caratteri, massimo 72 byte.</p>
      <button class="btn primary wide" :disabled="busy">
        {{ busy ? "Salvataggio…" : "Salva modifiche" }}
      </button>
    </fieldset>
    <p v-if="error" class="warning" role="alert">{{ error }}</p>
    <p v-if="saved" class="inline-note" role="status">Credenziali aggiornate</p>
  </form>
</template>
