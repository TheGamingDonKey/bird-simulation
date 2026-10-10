import test from 'node:test';
import assert from 'node:assert/strict';

import * as module from '../advanced/model.js';
import * as terrain from '../advanced/terrain.js';
function habitat(seed = 42, count = 220) {
  assert.equal(typeof module?.Habitat, 'function', 'Habitat model must be implemented');
  return new module.Habitat(seed, count);
}
function place(b, x = 0, y = 35, z = 0) {
  Object.assign(b, { x, y, z, vx: 0, vy: 0, vz: 12, species: 0, phase: 0 });
}

test('seeded reset reproduces initial flock and subsequent trajectory', () => {
  const a = habitat(42), b = habitat(42);
  assert.equal(a.birds.length, 220);
  assert.equal(new Set(a.birds.map(bird => bird.species)).size, 3);
  assert.deepEqual(a.birds, b.birds);
  for (let i = 0; i < 180; i++) { a.step(1 / 60); b.step(1 / 60); }
  assert.deepEqual(a.birds, b.birds);
  const initial = habitat(42).birds;
  a.reset(42);
  assert.deepEqual(a.birds, initial);
  assert.equal(a.time, 0);
  assert.notDeepEqual(habitat(43).birds, initial);
});

test('population adjustments preserve existing birds and cap at 700', () => {
  const h = habitat(4, 20), first = h.birds[0];
  h.setCount(700);
  assert.equal(h.birds.length, 700);
  assert.equal(h.birds[0], first);
  h.setCount(10000);
  assert.equal(h.birds.length, 700);
  h.setCount(0);
  assert.equal(h.birds.length, 0);
  h.step(0.1);
  h.setCount(30);
  assert.equal(h.birds.length, 30);
});

test('three-dimensional separation pushes close birds apart', () => {
  const h = habitat(5, 2);
  h.setWeather('clear');
  place(h.birds[0], -1); place(h.birds[1], 1);
  h.step(1 / 60);
  assert.ok(h.birds[0].vx < h.birds[1].vx);
  assert.ok(h.birds[0].x < -1 && h.birds[1].x > 1);
});

test('same-species neighbors align their headings', () => {
  const same = habitat(5, 2), other = habitat(5, 2);
  for (const h of [same, other]) {
    place(h.birds[0]); place(h.birds[1], 20);
    h.birds[1].vx = 12; h.birds[1].vz = 0;
  }
  other.birds[1].species = 1;
  same.step(1 / 60); other.step(1 / 60);
  assert.ok(same.birds[0].vx > other.birds[0].vx + 0.1);
  assert.ok(same.birds[0].vz < other.birds[0].vz);
});

test('same-species neighbors cohere even when already flying in parallel', () => {
  const same = habitat(5, 2), other = habitat(5, 2);
  for (const h of [same, other]) { place(h.birds[0]); place(h.birds[1], 20); }
  other.birds[1].species = 1;
  same.step(1 / 60); other.step(1 / 60);
  assert.ok(same.birds[0].vx > other.birds[0].vx + 0.005);
});

test('food attracts birds and expires with simulation time', () => {
  const clear = habitat(6, 1), fed = habitat(6, 1);
  place(clear.birds[0]); place(fed.birds[0]);
  fed.addFood(35, 0);
  clear.step(0.1); fed.step(0.1);
  assert.ok(fed.birds[0].vx > clear.birds[0].vx);
  assert.ok(fed.birds[0].vy < clear.birds[0].vy);
  assert.equal(fed.food.length, 1);
  for (let i = 0; i < 600; i++) fed.step(0.1);
  assert.equal(fed.food.length, 0);
});

test('nearby hawk changes flight away from its position', () => {
  const calm = habitat(7, 1), threatened = habitat(7, 1);
  place(calm.birds[0]); place(threatened.birds[0]);
  threatened.togglePredator();
  Object.assign(threatened.predator, { x: 12, y: 35, z: 0 });
  calm.step(0.05); threatened.step(0.05);
  assert.ok(threatened.birds[0].vx < calm.birds[0].vx - 0.5);
  threatened.togglePredator();
  assert.equal(threatened.predator.active, false);
});

test('storm wind changes trajectories and invalid weather is rejected', () => {
  const calm = habitat(8, 30), storm = habitat(8, 30);
  calm.setWeather('clear'); storm.setWeather('storm');
  for (let i = 0; i < 300; i++) { calm.step(1 / 60); storm.step(1 / 60); }
  assert.ok(Math.hypot(storm.wind.x, storm.wind.z) > Math.hypot(calm.wind.x, calm.wind.z));
  assert.ok(Math.hypot(calm.birds[0].x - storm.birds[0].x, calm.birds[0].z - storm.birds[0].z) > 1);
  assert.throws(() => storm.setWeather('unknown'), /weather/i);
});

test('zero or invalid timestep leaves all simulation state unchanged', () => {
  const h = habitat();
  const initial = structuredClone({ birds: h.birds, time: h.time, weather: h.weatherSystem });
  for (const dt of [0, -1, NaN, Infinity]) h.step(dt);
  assert.deepEqual(structuredClone({ birds: h.birds, time: h.time, weather: h.weatherSystem }), initial);
});

test('birds explore a wider sky and soaring species spend longer gliding at higher altitude', () => {
  const h = habitat(11, 180); h.setWeather('clear');
  const altitude = [0, 0, 0], gliding = [0, 0, 0];
  let wide = false, observations = 0;
  for (let i = 0; i < 1200; i++) {
    h.step(.05);
    if (i > 400 && i % 20 === 0) {
      observations++;
      for (const b of h.birds) {
        altitude[b.species] += b.y;
        if (b.flightState === 'glide') gliding[b.species]++;
        if (Math.abs(b.x) > 212 || Math.abs(b.z) > 212) wide = true;
        assert.ok(b.energy >= 0 && b.energy <= 1);
      }
    }
  }
  assert.ok(wide, 'birds should actually travel beyond the old bounds');
  assert.ok(altitude[2] / (60 * observations) > altitude[0] / (60 * observations) + 22);
  assert.ok(gliding[2] > gliding[0] * 1.5);
  assert.ok(gliding[0] > 0 && gliding[2] < 60 * observations);
});

test('a passing local rain front lowers flight compared with identical birds outside the front', () => {
  const wet = habitat(13, 1), dry = habitat(13, 1);
  assert.ok(wet.weatherSystem && dry.weatherSystem, 'Habitat must own local weather');
  const front = wet.weatherSystem.fronts.find(f => f.type === 'rain');
  const dryFront = dry.weatherSystem.fronts.find(f => f.type === 'rain');
  Object.assign(dryFront, { x: 250, z: 240 });
  place(wet.birds[0], front.x, 45, front.z);
  place(dry.birds[0], front.x, 45, front.z);
  wet.step(.1); dry.step(.1);
  assert.ok(wet.birds[0].vy < dry.birds[0].vy);
  assert.equal(wet.weatherSystem.time, wet.time);
});

test('river is submerged while valley and edge mountains remain finite', () => {
  assert.equal(typeof terrain?.terrainHeight, 'function', 'terrain must be implemented');
  for (let z = -210; z <= 210; z += 10) {
    assert.ok(terrain.terrainHeight(terrain.riverX(z), z) < -2.5);
    assert.ok(Number.isFinite(terrain.terrainHeight(200, z)));
  }
  assert.ok(terrain.terrainHeight(205, 0) > terrain.terrainHeight(55, 0) + 15);
});

test('700 birds stay finite, inside habitat, and above terrain through mixed weather and hawk', () => {
  const h = habitat(9, 700);
  h.togglePredator(); h.addFood(-80, 40);
  for (let i = 0; i < 1800; i++) {
    if (i % 300 === 0) h.setWeather(['storm', 'snow', 'rain', 'fog', 'mixed', 'clear'][i / 300]);
    h.step(1 / 30);
    if (i % 60 === 0) for (const b of h.birds) {
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'phase']) assert.ok(Number.isFinite(b[key]), key);
      assert.ok(Math.abs(b.x) <= 260 && Math.abs(b.z) <= 260);
      assert.ok(b.y >= 7 && b.y <= 145);
      assert.ok(b.y >= terrain.terrainHeight(b.x, b.z) + 5);
      assert.ok(Math.hypot(b.vx, b.vy, b.vz) <= 35);
    }
  }
  assert.ok(h.time > 59);
});
