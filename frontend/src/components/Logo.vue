<template>
  <!-- Logo "Mattino": cerchio terracotta con battito in crema; nessuna scritta. -->
  <svg class="pulse-logo" :width="size" :height="size" viewBox="0 0 48 48" role="img" aria-label="PULSE">
    <circle cx="24" cy="24" r="24" fill="var(--accent)" />
    <path d="M9 25h8l3.5-8 6 16 4-9H39" fill="none" stroke="var(--on-accent)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
<script setup>
defineProps({ size: { type: Number, default: 40 } });
</script>
