import test from 'node:test';
import assert from 'node:assert/strict';
import { Habitat } from '../advanced/model.js';
import { terrainHeight } from '../advanced/terrain.js';

const module = await import('../advanced/bird-social.js').catch(() => ({}));
function social() { assert.equal(typeof module.BirdSocial, 'function', 'BirdSocial must be implemented'); return new module.BirdSocial(); }
const player = () => ({ x: 40, y: 45, z: 0, vx: 0, vy: 0, vz: -16, yaw: 0, time: 0 });
function bird(x, y = 45, z = 0) { return { x, y, z, vx: 0, vy: 0, vz: 12, species: 0, energy: .4 }; }

test('calling attracts local birds for eight seconds without moving or affecting distant birds', () => {
  const s = social(), p = player(), nearby = bird(75), distant = bird(130), h = { birds: [nearby, distant] };
  const before = structuredClone(h.birds);
  assert.equal(s.call(p, h).ok, true); assert.equal(s.activeCalls, 1);
  s.step(.1, p, h);
  assert.ok(nearby.vx < before[0].vx);
  assert.deepEqual({ x: nearby.x, y: nearby.y, z: nearby.z }, { x: 75, y: 45, z: 0 });
  assert.deepEqual(distant, before[1]);
  s.step(8.1, p, h); assert.equal(s.activeCalls, 0);
  assert.equal(s.call({ ...p, x: -200 }, h).ok, false);
});

test('greeting is limited in three dimensions and counts each individual friend once', () => {
  const s = social(), p = player(), near = bird(50), overhead = bird(40, 68), h = { birds: [near, overhead] };
  assert.equal(s.greet(p, h).ok, true); assert.equal(s.friends, 1);
  const id = s.companionId; assert.ok(id !== null); assert.equal(s.companionBird, near);
  assert.ok(s.companionUntil >= 15 && s.companionUntil <= 30);
  assert.equal(s.greet(p, h).ok, true); assert.equal(s.friends, 1); assert.equal(s.companionId, id);
  assert.equal(s.greet(p, { birds: [overhead] }).ok, false);
  assert.equal(s.greet(p, { birds: [] }).ok, false);
});

test('feeding consumes one item only on success, restores bird energy and extends companionship', () => {
  const s = social(), p = player(), near = bird(49), h = { birds: [near] }, inventory = { food: 2 };
  s.greet(p, h); const initialUntil = s.companionUntil;
  const result = s.feed(p, h, inventory);
  assert.equal(result.ok, true); assert.equal(result.consumed, 1); assert.equal(inventory.food, 2);
  assert.ok(near.energy > .4 && near.energy <= 1); assert.ok(s.companionUntil > initialUntil);
  assert.equal(s.friends, 1); assert.equal(s.friendInfo[0].feeds, 1);
  assert.equal(s.feed(p, h, { food: 0 }).consumed, 0);
  assert.equal(s.feed(p, { birds: [bird(100)] }, inventory).consumed, 0);
  assert.equal(s.feed(p, h, -1).ok, false);
});

test('companion steering approaches a side formation without teleporting and times out', () => {
  const s = social(), p = player(), friend = bird(55), distant = bird(-100), h = { birds: [friend, distant] };
  s.greet(p, h); const original = structuredClone(friend), far = structuredClone(distant);
  for (let i = 0; i < 30; i++) {
    s.step(1 / 60, p, h); friend.x += friend.vx / 60; friend.y += friend.vy / 60; friend.z += friend.vz / 60;
  }
  assert.ok(friend.x < original.x && friend.vz < original.vz);
  assert.deepEqual(distant, far);
  s.step(30, p, h); assert.equal(s.companionId, null); assert.equal(s.friends, 1);
});

test('pause, inactive visitors and reset preserve or clear interactions without altering bird positions', () => {
  const s = social(), p = player(), h = { birds: [bird(50)] }; s.call(p, h); s.greet(p, h);
  const before = structuredClone({ time: s.time, id: s.companionId, calls: s.activeCalls, info: s.friendInfo, birds: h.birds });
  for (const dt of [0, -1, Infinity, NaN]) s.step(dt, null, h);
  assert.deepEqual({ time: s.time, id: s.companionId, calls: s.activeCalls, info: s.friendInfo, birds: h.birds }, before);
  const birds = structuredClone(h.birds); s.step(.1, null, h);
  assert.equal(s.companionId, null); assert.equal(s.activeCalls, 0); assert.deepEqual(h.birds, birds);
  s.reset(); assert.equal(s.time, 0); assert.equal(s.friends, 0); assert.deepEqual(s.friendInfo, []);
});

test('population removal and seeded habitat resets never transfer a friendship to replacement birds', () => {
  const s = social(), p = player(), h = new Habitat(42, 2);
  Object.assign(h.birds[1], bird(48)); s.greet(p, h); const firstId = s.companionId;
  h.setCount(1); s.step(.1, p, h); assert.equal(s.companionId, null); assert.equal(s.friends, 0);
  h.setCount(2); Object.assign(h.birds[1], bird(48)); s.greet(p, h);
  assert.notEqual(s.companionId, firstId);
  h.reset(); s.step(.1, p, h); assert.equal(s.companionId, null); assert.equal(s.friends, 0);
});

test('edge and ground formations keep velocities finite and safe for the next habitat movement', () => {
  const s = social(), p = { ...player(), x: 260, z: 250, y: 180 };
  const friend = bird(260, 143, 250); friend.vx = 28; friend.vy = 5;
  const h = { birds: [friend] };
  const near = { ...p, y: 143 }; s.greet(near, h); s.step(.1, p, h);
  for (const key of ['vx', 'vy', 'vz']) assert.ok(Number.isFinite(friend[key]));
  assert.ok(friend.x + friend.vx * .1 <= 260 && friend.z + friend.vz * .1 <= 260);
  assert.ok(friend.y + friend.vy * .1 <= 145);
  const low = bird(40, terrainHeight(40, 0) + 7, 0); low.vy = -15;
  const groundSocial = social(); groundSocial.greet({ ...player(), y: low.y }, { birds: [low] });
  groundSocial.step(.1, { ...player(), y: 0 }, { birds: [low] });
  assert.ok(low.y + low.vy * .1 >= terrainHeight(low.x + low.vx * .1, low.z + low.vz * .1) + 5);
});
