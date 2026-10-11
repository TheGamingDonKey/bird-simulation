import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainHeight } from '../advanced/terrain.js';

const module = await import('../advanced/player-bird.js').catch(() => ({}));
const perches = [
  { id: 'tent-1', type: 'tent', x: 40, y: 8, z: 20, radius: 3, label: 'Riverside tent' },
  { id: 'tree-1', type: 'tree', x: -60, y: 26, z: -25, radius: 4, label: 'Tall pine' },
];
function player(sites = perches) {
  assert.equal(typeof module.PlayerBird, 'function', 'PlayerBird must be implemented');
  return new module.PlayerBird(sites);
}
function advance(bird, seconds, input = {}, options = {}) {
  for (let i = 0; i < seconds * 60; i++) bird.step(1 / 60, input, options);
}

test('arcade flight moves forward and signed steering changes heading left and right', () => {
  const straight = player(), left = player(), right = player();
  advance(straight, 1); advance(left, 1, { turn: -1 }); advance(right, 1, { turn: 1 });
  assert.ok(straight.z < 20 && Math.abs(straight.x - 40) < 1e-8);
  assert.ok(left.x < straight.x && right.x > straight.x);
  assert.ok(left.yaw > 0 && right.yaw < 0);
  assert.ok(left.turn < 0 && right.turn > 0);
  assert.ok(straight.speed >= 12 && straight.speed <= 24);
});

test('pitch climbs or dives while gliding rests the wings and loses height gently', () => {
  const climb = player(), dive = player(), glide = player(), flap = player();
  for (const bird of [climb, dive, glide, flap]) bird.y = 60;
  advance(climb, 2, { pitch: 1 }); advance(dive, 2, { pitch: -1 });
  advance(glide, 2, { glide: true }); advance(flap, 2, { flap: true });
  assert.ok(climb.y > 65 && dive.y < 55);
  assert.ok(glide.y < 60 && glide.y > 53);
  assert.equal(glide.flightState, 'glide'); assert.equal(flap.flightState, 'flap');
  assert.ok(flap.y > glide.y && flap.energy < glide.energy);
});

test('landing begins near the tutorial tent, approaches smoothly, then locks to its exact roof', () => {
  const bird = player(), initial = { x: bird.x, y: bird.y, z: bird.z };
  assert.equal(bird.nearestPerch().perch.id, 'tent-1');
  const result = bird.requestLand(); assert.equal(result.ok, true); assert.match(result.message, /land|approach/i);
  assert.deepEqual({ x: bird.x, y: bird.y, z: bird.z }, initial);
  assert.equal(bird.mode, 'landing'); bird.step(1 / 60);
  assert.ok(Math.hypot(bird.x - initial.x, bird.y - initial.y, bird.z - initial.z) < .5);
  advance(bird, 5);
  assert.equal(bird.mode, 'perched'); assert.equal(bird.flightState, 'perch');
  assert.deepEqual({ x: bird.x, y: bird.y, z: bird.z }, { x: 40, y: 8.4, z: 20 });
  assert.equal(bird.speed, 0); assert.equal(bird.landings, 1);
  const resting = { x: bird.x, y: bird.y, z: bird.z };
  advance(bird, 5, {}, { wind: { x: 20, z: -10 } });
  assert.deepEqual({ x: bird.x, y: bird.y, z: bird.z }, resting);
});

test('tree landing uses the supplied crown, distant or high perches are rejected', () => {
  const bird = player(); Object.assign(bird, { x: -58, y: 30, z: -12 });
  assert.equal(bird.requestLand().ok, true); advance(bird, 5);
  assert.equal(bird.perch.id, 'tree-1'); assert.equal(bird.y, 26.4);
  bird.takeOff(); Object.assign(bird, { x: 180, y: 120, z: 170 });
  assert.equal(bird.requestLand().ok, false); assert.equal(bird.mode, 'flying');
  Object.assign(bird, { x: -60, y: 65, z: -25 }); assert.equal(bird.requestLand().ok, false);
  assert.equal(player([]).nearestPerch(), null);
});

test('a low landing approach clears the intervening riverbank instead of flying through it', () => {
  const bird = player([{ id: 'bank-tent', type: 'tent', x: 20, y: 10.4, z: -165, radius: 3 }]);
  Object.assign(bird, { x: 5, z: -180, y: Math.max(terrainHeight(5, -180), -2.5) + 1.2 });
  assert.equal(bird.requestLand().ok, true);
  for (let i = 0; i < 420; i++) {
    bird.step(1 / 60);
    assert.ok(bird.y >= Math.max(terrainHeight(bird.x, bird.z), -2.5) + 1, 'landing must clear terrain');
  }
  assert.equal(bird.mode, 'perched'); assert.equal(bird.y, 10.8);
});

test('takeoff starts upward from a perch, flap also takes off, and steering cancels approach', () => {
  const bird = player(); assert.equal(bird.takeOff(), false);
  bird.requestLand(); advance(bird, 5); const roof = bird.y;
  assert.equal(bird.takeOff(), true); assert.equal(bird.mode, 'flying'); assert.equal(bird.perch, null);
  bird.step(1 / 60); assert.ok(bird.y > roof && bird.vy > 0);
  bird.reset(); bird.requestLand(); advance(bird, 5); bird.step(1 / 60, { flap: true });
  assert.equal(bird.mode, 'flying');
  bird.reset(); bird.requestLand(); bird.step(1 / 60, { turn: 1 }); assert.equal(bird.mode, 'flying');
});

test('chirp has a simulation-time cooldown and a village interaction window', () => {
  const bird = player(); assert.equal(bird.chirp(), true); assert.ok(bird.chirpUntil > bird.time);
  assert.equal(bird.chirp(), false); advance(bird, 3); assert.equal(bird.chirp(), true);
});

test('wind affects local trajectories while terrain, water and bounds stay finite during long flight', () => {
  const calm = player(), windy = player();
  advance(calm, 2); advance(windy, 2, {}, { wind: { x: 8, z: 0 } });
  assert.ok(windy.x > calm.x + 2);
  const bird = player(); Object.assign(bird, { x: 253, y: 189, z: 254 });
  for (let i = 0; i < 1800; i++) {
    bird.step(.05, { turn: Math.sin(i * .013), pitch: Math.sin(i * .007), flap: i % 90 < 20, glide: i % 90 > 50 }, { wind: { x: 15, z: 10 } });
    for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'turn', 'speed', 'energy', 'phase']) assert.ok(Number.isFinite(bird[field]), field);
    assert.ok(Math.abs(bird.x) <= 255 && Math.abs(bird.z) <= 255 && bird.y <= 190);
    assert.ok(bird.y >= Math.max(terrainHeight(bird.x, bird.z), -2.5) + 1);
    assert.ok(bird.energy >= 0 && bird.energy <= 1);
  }
});

test('reset and identical input replay deterministically; invalid or oversized timesteps stay safe', () => {
  const a = player(), b = player(), initial = structuredClone(a);
  for (let i = 0; i < 180; i++) { const input = { turn: Math.sin(i * .02), pitch: .2, glide: i > 120 }; a.step(1 / 60, input); b.step(1 / 60, input); }
  assert.deepEqual(structuredClone(a), structuredClone(b));
  a.reset(); assert.deepEqual(structuredClone(a), initial);
  for (const dt of [0, -1, NaN, Infinity]) a.step(dt, { flap: true });
  assert.deepEqual(structuredClone(a), initial);
  a.step(1000, { pitch: 1 }); b.reset(); b.step(.1, { pitch: 1 });
  assert.deepEqual(structuredClone(a), structuredClone(b));
  a.setPerches([perches[1]]); assert.equal(a.nearestPerch().perch.id, 'tree-1');
});

test('perched birds can look around without leaving their exact landing anchor',()=>{
 const p=new module.PlayerBird([{id:'nest',type:'tent',x:35,y:8,z:20}]);p.mode='perched';p.perch=p.perches[0];p.step(.1,{turn:1,pitch:-1});
 assert.equal(p.mode,'perched');assert.equal(p.x,35);assert.equal(p.z,20);assert.equal(p.y,8.4);assert.ok(p.yaw<0);assert.ok(p.pitch<0);
});
