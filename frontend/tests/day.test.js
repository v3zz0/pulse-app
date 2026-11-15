import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia,setActivePinia } from 'pinia';
import { useDay } from '../src/stores/day.js';
test('consumo non automatico, separazione ON/OFF e nessun mutamento delle alternative',()=>{
 setActivePinia(createPinia()); const day=useDay();
 assert.equal(day.count,0); day.toggle('breakfast'); assert.equal(day.count,1);
 day.setMode('OFF'); assert.equal(day.count,0); day.setMode('ON'); assert.equal(day.count,1);
 day.toggle('breakfast'); assert.equal(day.count,0);
 day.select('breakfast',999); assert.equal(day.choice(day.meals[0]),day.meals[0].choices[0]);
});
