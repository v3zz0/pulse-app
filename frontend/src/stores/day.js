import { defineStore } from 'pinia';
import { demoMeals } from '../demo-meals.js';
export const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const key = 'pulse-phase1-demo';
function load() { try { const data = JSON.parse(localStorage.getItem(key)); if(data?.date === localDate() && ['ON','OFF'].includes(data.mode)) return { mode:data.mode, done:data.done || {}, choices:data.choices || {} }; } catch {} return {mode:'ON',done:{},choices:{}}; }
export const useDay = defineStore('day', {
 state: load,
 getters: { meals: s => demoMeals[s.mode], next() { return this.meals.find(m => !this.isDone(m.id)); }, count() { return this.meals.filter(m => this.isDone(m.id)).length; } },
 actions: {
  isDone(id) { return this.done[this.mode+':'+id] === true; },
  choice(m) { return m.choices[this.choices[this.mode+':'+m.id] || 0] || m.choices[0]; },
  save() { try { localStorage.setItem(key,JSON.stringify({date:localDate(),...this.$state})); } catch { return false; } return true; },
  toggle(id) { this.done[this.mode+':'+id] = !this.isDone(id); return this.save(); },
  setMode(mode) { this.mode=mode; return this.save(); },
  select(id,index) { this.choices[this.mode+':'+id]=index; return this.save(); }
 }
});
