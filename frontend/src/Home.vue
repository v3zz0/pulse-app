<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDay, localDate } from './stores/day.js';
import Icon from './components/Icon.vue';
const day = useDay();
const dialog = ref(null);
const selected = ref(null);
const message = ref('');
const date = new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',weekday:'long',day:'numeric',month:'long'}).format(new Date());
const selectedMeal = computed(() => day.meals.find(m => m.id === selected.value));
function alternatives(id) { selected.value=id; dialog.value.showModal(); }
function toggle(id) { const ok=day.toggle(id); message.value=ok?'Anteprima aggiornata sul dispositivo.':'Modifica temporanea: salvataggio locale non disponibile.'; }
function choose(index) { day.select(selected.value,index); dialog.value.close(); }
const dayStarted = localDate();
let interval;
onMounted(() => { interval=setInterval(() => { if(localDate() !== dayStarted) location.reload(); },60000); });
onUnmounted(() => clearInterval(interval));
</script>
<template>
<div class="welcome-bar"><div><div class="focus-label">IL TUO OGGI · {{ date.toUpperCase() }}</div><h1>La tua giornata<span style="color:var(--accent)">.</span></h1><p>Prima mangia e allenati, poi pensa alle statistiche.</p></div><span class="pill">DEMO 2.1</span></div>
<div class="source-note phase-note">Anteprima interattiva: esempi del piano storico del 17/09/2026, validità 30–40 giorni, da rivedere con il professionista. Nessun dato personale è inviato al backend.</div>
<div class="dashboard v2"><div class="v2-columns"><div>
<section class="card"><div class="home-control-head"><div><div class="focus-label">01 · COSA MANGIO</div><h2>I pasti di oggi</h2></div><div class="switch-seg" role="group" aria-label="Seleziona giorno"><button v-for="mode in ['ON','OFF']" :key="mode" :class="{active:day.mode===mode}" :aria-pressed="day.mode===mode" @click="day.setMode(mode)">{{ mode }}</button></div></div>
<div class="today-sub">{{ day.count }}/{{ day.meals.length }} completati · Tocca un pasto per cambiarlo</div><div class="mini-progress"><span :style="{width:100*day.count/day.meals.length+'%'}"></span></div>
<div v-if="day.next" class="meal-next" style="margin-top:16px" data-testid="next-meal"><div class="focus-label">PROSSIMO PASTO · {{ day.next.time }}</div><div class="txt">{{ day.next.name }} — {{ day.choice(day.next).title }}</div><div class="desc">{{ day.choice(day.next).desc }}</div><div class="home-cta"><button class="btn primary" @click="toggle(day.next.id)"><Icon name="check" :size="15"/> Mangiato</button><button class="btn secondary" @click="alternatives(day.next.id)">Sostituisci</button></div></div>
<div v-else class="inline-note">Tutti i pasti sono segnati come consumati!</div>
<div class="home-list-heading">TUTTI I PASTI DI OGGI</div><div data-testid="meal-list"><div v-for="meal in day.meals" :key="meal.id" class="home-meal-row" :class="{active:!day.isDone(meal.id)}"><button class="meal-check-mini" :class="{done:day.isDone(meal.id)}" :aria-label="(day.isDone(meal.id)?'Annulla pasto: ':'Segna mangiato: ')+meal.name" :aria-pressed="day.isDone(meal.id)" @click="toggle(meal.id)"><Icon :name="day.isDone(meal.id)?'check':'plus'" :size="17"/></button><button class="meal-row-main" :class="{done:day.isDone(meal.id)}" @click="alternatives(meal.id)"><strong>{{ meal.name }}</strong><small>{{ day.choice(meal).title }}</small></button><button class="meal-row-hour" :aria-label="'Alternative '+meal.name" @click="alternatives(meal.id)">{{ meal.time }} <Icon name="arrow" :size="13"/></button></div></div>
<div class="source-note">Alimenti pesati a crudo salvo indicazioni specifiche. Valori nutrizionali non disponibili. L'import completo del PDF arriverà nella fase 2.</div>
</section></div><div class="dashboard v2">
<section class="card"><div class="home-control-head"><div><div class="focus-label">02 · ALLENAMENTO</div><h2>Allenamento</h2></div><span class="pill grey">SCHEDA A</span></div><div class="meal-preview"><div class="action-icon"><Icon name="gym" :size="24"/></div><div class="mealinfo"><h3>Petto · Tricipiti · Addome</h3><p>Carichi da impostare, recuperi e note del trainer</p></div></div><button class="btn primary wide" disabled><Icon name="bolt" :size="15"/> Inizia allenamento</button><div class="source-note">Disponibile nella fase allenamento. La scheda resterà completa, con salto di singole serie ed esercizi.</div></section>
<div class="home-compact-grid"><button class="quick-action" disabled><Icon name="weight"/><span><strong>Registra peso</strong><small>Prossima fase</small></span></button><button class="quick-action" disabled><Icon name="plus"/><span><strong>Integratori</strong><small>Prossima fase</small></span></button></div>
<section class="card"><div class="home-control-head"><div><div class="focus-label">03 · ORGANIZZATI</div><h2>Prepara domani</h2></div><span class="pill grey">DA PREPARARE</span></div><p class="note">Imposta giorno ON/OFF e scegli le sostituzioni prima di domani.</p><button class="btn secondary wide" disabled><Icon name="calendar" :size="16"/> Organizza domani</button><div class="source-note">Pianificazione persistente prevista nella fase 3.</div></section>
<section class="card"><div class="home-control-head"><div><div class="focus-label">04 · PROMEMORIA</div><h2>Non dimenticarti</h2></div><span class="pill grey">NON ATTIVI</span></div><div class="soft-row"><div><b>Prossimo pasto</b><div class="meta">{{ day.next ? day.next.name+' · '+day.next.time : 'Pasti completati' }}</div></div><button class="btn secondary sm" disabled>Rimanda</button></div><div class="soft-row"><div><b>Integratori</b><div class="meta">Nessuna assunzione registrata</div></div><button class="btn secondary sm" disabled>Gestisci</button></div><div class="source-note">Questa anteprima non invia notifiche.</div></section>
</div></div><div class="home-compact-grid"><RouterLink to="/progressi" class="quick-action"><Icon name="chart"/><span><strong>Settimana</strong><small>Riepilogo e progressi</small></span></RouterLink><RouterLink to="/dieta" class="quick-action"><Icon name="food"/><span><strong>Tutta la dieta</strong><small>Pasti, alternative, spesa</small></span></RouterLink></div></div>
<p role="status" class="source-note">{{ message }}</p>
<dialog ref="dialog" class="sheet sheet-dialog" aria-labelledby="meal-dialog-title" @click="event => { if(event.target===dialog) dialog.close(); }"><template v-if="selectedMeal"><div class="sheet-head"><div><div class="eyebrow">{{ selectedMeal.time }} · GIORNO {{ day.mode }}</div><h2 id="meal-dialog-title">{{ selectedMeal.name }}</h2><p>Alternative dimostrative del piano storico.</p></div><button class="sheet-close" aria-label="Chiudi" @click="dialog.close()">×</button></div><button v-for="(choice,index) in selectedMeal.choices" :key="index" class="choice-card choice-main" style="width:100%" @click="choose(index)"><b>{{ choice.title }}</b><small>{{ choice.desc }}</small></button><div class="warning">Non equivalgono a una nuova prescrizione. Preferenze e import completo saranno disponibili nelle prossime fasi.</div><button class="btn ghost wide" @click="dialog.close()">Annulla</button></template></dialog>
</template>
