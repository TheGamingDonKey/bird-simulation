import test from 'node:test';
import assert from 'node:assert/strict';
import { VillageSimulation } from '../advanced/villagers.js';
import { riverX } from '../advanced/terrain.js';
import * as THREE from '../advanced/vendor/three.module.min.js';
import {createWorld} from '../advanced/world.js';

const run = (v, seconds, weather = {}) => { for (let i = 0; i < seconds * 20; i++) v.step(.05, weather); };
test('village is deterministic and zero dt preserves all state', () => {
  const a = new VillageSimulation(), b = new VillageSimulation();
  run(a, 25); run(b, 25);
  assert.deepEqual(a.villagers, b.villagers);
  const before = structuredClone(a.villagers); a.step(0, { weather: 'storm' });
  assert.deepEqual(a.villagers, before);
  assert.ok(a.villagers.some(p => Math.hypot(p.x - 35, p.z - 20) > 10));
});
test('reset preserves the live array and replays village state and random choices', () => {
  const v = new VillageSimulation(), reference = v.villagers, initial = structuredClone(v.villagers);
  run(v, 45); const trajectory = structuredClone(v.villagers);
  v.interact(66, 47);run(v, 12, {weather:'rain'});v.reset();
  assert.equal(v.villagers, reference); assert.equal(v.time, 0); assert.deepEqual(v.villagers, initial);
  run(v, 45);assert.deepEqual(v.villagers, trajectory);
});
test('visiting birds provoke local curiosity and brief selective startle with weather priority',()=>{
  const v=new VillageSimulation(),p=v.villagers[0];
  const visitor={x:p.x,y:p.y+7,z:p.z,speed:3,time:0,chirpUntil:3,mode:'flying'};
  v.villagers[9].x=110;v.villagers[9].z=90;
  v.step(.1,{visitor});assert.equal(p.state,'wave');assert.notEqual(v.villagers[9].state,'wave');
  const paused=structuredClone(v.villagers);v.step(0,{visitor});assert.deepEqual(v.villagers,paused);
  v.reset();visitor.speed=24;visitor.y=p.y+3;visitor.chirpUntil=0;
  v.step(.1,{visitor});const startled=v.villagers.filter(p=>['duck','flee'].includes(p.state));
  assert.ok(startled.length>0&&startled.length<v.villagers.length);
  v.step(.1,{visitor,weather:'storm'});assert.ok(v.villagers.every(p=>p.state==='sheltering'||p.state==='shelter'));
  v.reset();visitor.x=200;visitor.z=-200;v.step(.1,{visitor});assert.ok(v.villagers.every(p=>!['wave','watch','duck','flee'].includes(p.state)));
});
test('storm sends every villager into their tent and clear weather releases them', () => {
  const v = new VillageSimulation(); run(v, 80, { weather: 'storm' });
  for (const p of v.villagers) {
    assert.equal(p.state, 'shelter');
    assert.ok(Math.hypot(p.x - v.tents[p.home].x, p.z - v.tents[p.home].z) < 1.8);
  }
  run(v, 25, { weather: 'clear' });
  assert.ok(v.villagers.some(p => p.state !== 'shelter'));
});
test('moving local weather only shelters people inside precipitation', () => {
  const v = new VillageSimulation();
  v.step(.1, { weather: 'storm', weatherSystem: { sample: () => ({rain: 0, snow: 0}) } });
  assert.ok(v.villagers.every(p => p.state !== 'sheltering' && p.state !== 'shelter'));
  run(v, 80, { weatherSystem: { sample: () => ({rain: .9, snow: 0}) } });
  assert.ok(v.villagers.every(p => p.state === 'shelter'));
});
test('gather and startle change goals while navigation stays finite and on land', () => {
  const v = new VillageSimulation();
  v.interact(66, 47); run(v, 40);
  assert.ok(v.villagers.every(p => Math.hypot(p.x - 66, p.z - 47) < 6));
  const before = v.villagers.map(p => ({x: p.x, z: p.z})); v.scare(66, 47); run(v, 4);
  assert.ok(v.villagers.some((p, i) => Math.hypot(p.x - before[i].x, p.z - before[i].z) > 3));
  run(v, 180);
  assert.ok(v.villagers.every(p => Number.isFinite(p.x + p.z) && p.x >= riverX(p.z) + 16));
});

test('world synchronizes villager meshes, freezes pause, and shadows opaque scenery', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {createElement: () => ({getContext: () => ({fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, createRadialGradient(){return {addColorStop(){}};}})})};
  let world;
  try { world = createWorld(THREE, new THREE.Scene()); } finally { globalThis.document = previousDocument; }
  const initial=structuredClone(world.villagers),reference=world.villagers;
  const animals=world.wildlife,initialAnimals=structuredClone(animals),initialPerches=world.perches;
  world.interact(66, 47); world.update(.1, 1, {weather: 'clear'});
  for (const p of world.villagers) {
    const view = world.root.getObjectByName(p.name);
    assert.equal(view.position.x, p.x); assert.equal(view.position.z, p.z);
    assert.equal(view.userData.state, p.state);
  }
  const before = structuredClone(world.villagers); world.update(0, 100, {weather:'storm'});
  assert.deepEqual(world.villagers, before);
  world.root.traverse(o => {if(o.isMesh && !o.material.transparent) {
    const smallDetail=['Meadow grass','Wildflower stems','River reeds','River fish','Fish fins'].includes(o.name);
    assert.equal(o.castShadow,!smallDetail&&o!==world.terrain,o.name);assert.equal(o.receiveShadow,true,o.name);
  }});
  world.terrain.geometry.computeBoundingBox();
  assert.equal(world.terrain.geometry.boundingBox.min.x,-285);assert.equal(world.terrain.geometry.boundingBox.max.x,285);
  assert.equal(world.terrain.geometry.boundingBox.min.z,-285);assert.equal(world.terrain.geometry.boundingBox.max.z,285);
  assert.ok(world.perches.length>100);assert.equal(world.perches.filter(p=>p.type==='tent').length,6);
  const trunks=world.root.getObjectByName('Forest trunks'),needles=world.root.getObjectByName('Wind bent conifers'),leaves=world.root.getObjectByName('Meadow tree crowns');
  const treePerches=world.perches.filter(p=>p.type==='tree'),anchored=new Set(treePerches.map(p=>`${p.source}:${p.instance}`));
  assert.equal(treePerches.length,trunks.count,'Every rendered tree needs its own landing crown');
  for(let i=1;i<needles.count;i+=2)assert.ok(anchored.has(`${needles.name}:${i}`),'Upper conifer crown '+i);
  for(let i=0;i<leaves.count;i++)assert.ok(anchored.has(`${leaves.name}:${i}`),'Broadleaf crown '+i);
  assert.ok(treePerches.every(p=>Math.abs(p.x)<=260&&Math.abs(p.z)<=260&&p.y<190),'All tree anchors should lie within player bounds');
  const ids=new Set(world.perches.map(p=>p.id));assert.equal(ids.size,world.perches.length);
  for(const perch of world.perches){
    const source=world.root.getObjectByName(perch.source);
    if(perch.type==='tent'){assert.equal(perch.x,source.position.x);assert.equal(perch.z,source.position.z);assert.equal(perch.y,source.position.y+4.15);}
    else{
      const matrix=new THREE.Matrix4();source.getMatrixAt(perch.instance,matrix);
      const position=source.geometry.attributes.position,point=new THREE.Vector3(),target=new THREE.Vector3(perch.x,perch.y,perch.z);let closest=Infinity;
      for(let i=0;i<position.count;i++)closest=Math.min(closest,point.fromBufferAttribute(position,i).applyMatrix4(matrix).distanceTo(target));
      assert.ok(closest<.0001,perch.label+' should meet its actual crown mesh');
    }
  }
  const rain = world.root.children.find(o => o.isLineSegments);
  const system = {fronts:[{type:'storm',x:80,z:0,radius:30,intensity:1}],sample:()=>({rain:1,snow:0,fog:0}),lightning:0};
  world.update(.1, 2, {weather:'storm',weatherSystem:system});
  const x = rain.geometry.attributes.position.array[0];
  system.fronts[0].x -= 100;world.update(.1, 2, {weather:'storm',weatherSystem:system});
  assert.ok(Math.abs(rain.geometry.attributes.position.array[0] - x + 100) < .001);
  world.reset();assert.equal(world.villagers,reference);assert.deepEqual(world.villagers,initial);
  assert.equal(world.wildlife,animals);assert.deepEqual(world.wildlife,initialAnimals);assert.equal(world.perches,initialPerches);
  for(const p of world.villagers){const mesh=world.root.getObjectByName(p.name);assert.equal(mesh.position.x,p.x);assert.equal(mesh.position.z,p.z);}
});
