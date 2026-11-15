<script setup>
defineProps({ section: String });
const names = {dieta:'La tua dieta',allenati:'Diventa più forte',progressi:'I tuoi progressi',altro:'Il tuo spazio'};
</script>
<template><div class="pagehead"><div><div class="eyebrow">PULSE · PRIMA FASE</div><h1>{{ names[section] }}<em>.</em></h1></div></div><section class="card"><h2>Le fondamenta sono pronte</h2><p class="note">Questa sezione sarà collegata ai tuoi dati nelle prossime fasi. Non vengono registrati allenamenti, pesi o assunzioni in questa anteprima.</p><RouterLink to="/" class="btn primary">Torna a Oggi</RouterLink></section></template>
