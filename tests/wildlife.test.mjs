import test from 'node:test';
import assert from 'node:assert/strict';
import {WildlifeSimulation} from '../advanced/wildlife.js';
import {riverX,terrainHeight} from '../advanced/terrain.js';
const run=(v,seconds,options={})=>{for(let i=0;i<seconds*20;i++)v.step(.05,options);};
test('wildlife is deterministic, pauses and resets with live references',()=>{
 const a=new WildlifeSimulation(),b=new WildlifeSimulation(),reference=a.animals,initial=structuredClone(a.animals);
 run(a,30);run(b,30);assert.deepEqual(a.animals,b.animals);
 const before=structuredClone(a.animals);a.step(0,{weather:'storm'});assert.deepEqual(a.animals,before);
 a.reset();assert.equal(a.animals,reference);assert.deepEqual(a.animals,initial);
 run(a,30);assert.deepEqual(a.animals,b.animals);
});
test('nearby low flybys scatter local animals, distant animals keep their activity',()=>{
 const v=new WildlifeSimulation(),p=v.animals.find(a=>a.type==='rabbit'),far=v.animals.find(a=>a.type==='deer');
 const visitor={x:p.x,y:p.y+3,z:p.z,speed:22,time:0,chirpUntil:0};
 v.step(.1,{visitor});assert.equal(p.state,'scatter');assert.notEqual(far.state,'scatter');
 v.step(.1,{weather:'storm',visitor});assert.ok(['shelter','sheltering'].includes(p.state));
 run(v,80,{weather:'storm'});assert.ok(v.animals.filter(a=>a.type!=='fish').every(a=>a.state==='shelter'));
});
test('long wandering stays on terrain and fish stay inside the river',()=>{
 const v=new WildlifeSimulation();run(v,240);
 for(const a of v.animals){
  assert.ok(Number.isFinite(a.x+a.y+a.z));assert.ok(Math.abs(a.z)<=240&&Math.abs(a.x)<=240);
  if(a.type==='fish'){assert.ok(Math.abs(a.x-riverX(a.z))<5);assert.ok(a.y< -2.5);}
  else{assert.ok(a.x>=riverX(a.z)+15.99);assert.equal(a.y,terrainHeight(a.x,a.z));}
 }
});
