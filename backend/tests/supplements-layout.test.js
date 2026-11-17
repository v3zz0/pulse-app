const {test}=require('node:test'), a=require('node:assert/strict');
const {validateProduct,applies,overlaps}=require('../src/pulse/supplements');
const {validateLayout}=require('../src/pulse/training-layout');
const {randomUUID}=require('node:crypto');
const slot=()=>({id:randomUUID(),at:'08:30',timezone:'Europe/Rome',weekdays:[1,3,5],mode:'ON',everyDays:1,startDate:null,dose:'',doseConfirmed:false,meal:'',reminderEnabled:true});
const product=()=>({name:'Prodotto sintetico',brand:'',ingredients:'',labelQuantity:'',labelUnit:'',notes:'',instructions:'',active:true,declaredActives:[],schedule:[slot()]});
test('pianificazione validata, conferma dose, nessun dato consigliato o completamento automatico',()=>{
 const p=product(), validated=validateProduct(p);a.deepEqual(validated.schedule[0].dose,'');a(!Object.hasOwn(validated,'takenAt'));
 a.throws(()=>validateProduct({...p,schedule:[null]}),/Orario/);a.throws(()=>validateProduct({...p,declaredActives:[null]}),/Ingrediente/);
 a.throws(()=>validateProduct({...p,schedule:[{...p.schedule[0],at:'25:70'}]}),/Orario/);
 a.throws(()=>validateProduct({...p,schedule:[{...p.schedule[0],dose:'Dose indicata'}]}),/Conferma/);
 a.equal(validateProduct({...p,schedule:[{...p.schedule[0],dose:'Dose indicata',doseConfirmed:true}]}).schedule[0].dose,'Dose indicata');
 a.throws(()=>validateProduct({...p,schedule:[p.schedule[0],{...slot(),at:'08:30',mode:'any'}]}),/sovrapposti/);
 a.throws(()=>validateProduct({...p,declaredActives:[{name:'Test',quantity:3,unit:''}]}),/unità/);
 a.throws(()=>validateProduct({...p,schedule:[{...slot(),everyDays:2,startDate:null}]}),/iniziale/);
});
test('giorni ON/OFF, giorni settimana e frequenza non dipendono da nomi delle schede',()=>{
 const s=slot();a(applies(s,'2026-11-16','ON'));a(!applies(s,'2026-11-16','OFF'));a(!applies(s,'2026-11-17','ON'));a(!applies(s,'2026-11-16',null));
 const every={...s,weekdays:[0,1,2,3,4,5,6],mode:'any',everyDays:2,startDate:'2026-11-16'};
 a(applies(every,'2026-11-16',null));a(!applies(every,'2026-11-17','ON'));a(applies(every,'2026-11-18','OFF'));a(!applies(every,'2026-11-14','ON'));
});
test('sovrapposizioni informative da ingredienti dichiarati, senza sommare quantità',()=>{
 const products=[{id:1,name:'Uno',active:true,ingredients:'Creatina monoidrato, Caffeina, Magnesio',declaredActives:[{name:'Vitamina C',quantity:1,unit:'g'}]},{id:2,name:'Due',active:true,ingredients:'Creatine, caffeine, magnesium',declaredActives:[{name:'vitamin C',quantity:null,unit:''}]}];
 const result=overlaps(products);a.deepEqual(result.map(r=>r.ingredient).sort(),['caffeina','creatina','magnesio','vitamina c']);a(result.every(r=>r.products.length===2 && !Object.hasOwn(r,'total')));
 a.equal(overlaps([products[0],{...products[1],active:false}]).length,0);
});
test('rinomina di sola presentazione: riferimenti e dati originali immutati',()=>{
 const days={A:[{id:'A:press:1',standardKg:60}],B:[],C:[]},copy=structuredClone(days);
 const layout=validateLayout({timezone:'Europe/Rome',days:{A:{name:'Lunedì',weekdays:[3]},B:{name:'Mercoledì',weekdays:[1,5]},C:{name:'Venerdì',weekdays:[]}}},days);
 a.equal(layout.days.A.name,'Lunedì');a.deepEqual(layout.days.A.weekdays,[3]);a.deepEqual(days,copy);
 a.throws(()=>validateLayout({...layout,days:{...layout.days,D:{name:'Extra',weekdays:[]}}},days),/inesistente/);
 a.throws(()=>validateLayout({...layout,days:{...layout.days,A:{name:'',weekdays:[1]}}},days),/Testo/);
});
