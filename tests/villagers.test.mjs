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
  world.interact(66, 47); world.update(.1, 1, {weather: 'clear'});
  for (const p of world.villagers) {
    const view = world.root.getObjectByName(p.name);
    assert.equal(view.position.x, p.x); assert.equal(view.position.z, p.z);
    assert.equal(view.userData.state, p.state);
  }
  const before = structuredClone(world.villagers); world.update(0, 100, {weather:'storm'});
  assert.deepEqual(world.villagers, before);
  world.root.traverse(o => {if(o.isMesh && !o.material.transparent) {
    const smallDetail=['Meadow grass','Wildflower stems','River reeds'].includes(o.name);
    assert.equal(o.castShadow,!smallDetail&&o!==world.terrain,o.name);assert.equal(o.receiveShadow,true,o.name);
  }});
  world.terrain.geometry.computeBoundingBox();
  assert.equal(world.terrain.geometry.boundingBox.min.x,-285);assert.equal(world.terrain.geometry.boundingBox.max.x,285);
  assert.equal(world.terrain.geometry.boundingBox.min.z,-285);assert.equal(world.terrain.geometry.boundingBox.max.z,285);
  const rain = world.root.children.find(o => o.isLineSegments);
  const system = {fronts:[{type:'storm',x:80,z:0,radius:30,intensity:1}],sample:()=>({rain:1,snow:0,fog:0}),lightning:0};
  world.update(.1, 2, {weather:'storm',weatherSystem:system});
  const x = rain.geometry.attributes.position.array[0];
  system.fronts[0].x -= 100;world.update(.1, 2, {weather:'storm',weatherSystem:system});
  assert.ok(Math.abs(rain.geometry.attributes.position.array[0] - x + 100) < .001);
  world.reset();assert.equal(world.villagers,reference);assert.deepEqual(world.villagers,initial);
  for(const p of world.villagers){const mesh=world.root.getObjectByName(p.name);assert.equal(mesh.position.x,p.x);assert.equal(mesh.position.z,p.z);}
});
