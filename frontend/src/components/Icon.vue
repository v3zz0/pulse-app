<script setup>
import { icons } from "../icons.js";
defineProps({ name: String, size: { type: Number, default: 20 } });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="icons[name] || icons.info"
  ></svg>
</template>
