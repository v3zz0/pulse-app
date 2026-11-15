import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPinia,setActivePinia} from 'pinia';
import {useDay} from '../src/stores/day.js';
test('errore server non produce falsi consumi locali',async()=>{
 setActivePinia(createPinia());const day=useDay();day.meals=[{id:'test',consumedAt:null}];
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:500,json:async()=>({error:{message:'Errore test'}})});
 try{assert.equal(await day.toggle('test'),false);assert.equal(day.count,0);assert.equal(day.error,'Errore test');}finally{globalThis.fetch=original;}
});
