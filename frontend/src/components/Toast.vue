<template>
  <div class="toast" :class="{ show: toast.show, 'has-undo': !!toast.undo }" role="status" aria-live="polite">
    <span>{{ toast.message }}</span>
    <button v-if="toast.undo" type="button" class="toast-undo" @click="runUndo">Annulla</button>
  </div>
</template>
<script setup>
import { toast, runUndo } from "../ui.js";
</script>
