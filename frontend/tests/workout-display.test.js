import {test} from 'node:test';
import assert from 'node:assert/strict';
import {standard,dayName} from '../src/workout-display.js';
test('anteprima usa il carico CSV se manca la riga, rispettando null e zero espliciti',()=>{
 const set={id:'A:press:1',standardKg:60};
 assert.equal(standard(set,{}),60);
 assert.equal(standard(set,{[set.id]:{kg:null}}),null);
 assert.equal(standard(set,{[set.id]:{kg:0}}),0);
 assert.equal(standard({id:'missing',standardKg:null},{}),null);
 assert.equal(dayName({displaySettings:{days:{A:{name:'Lunedì',weekdays:[3]}}}},'A'),'Lunedì');
 assert.equal(dayName(null,'C'),'Scheda C');
});
