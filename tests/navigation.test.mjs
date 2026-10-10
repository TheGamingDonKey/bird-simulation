import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
import { terrainHeight, riverX } from '../advanced/terrain.js';

const module = await import('../advanced/navigation.js').catch(() => ({}));
function move(position, input, dt, mode) {
  assert.equal(typeof module.moveCamera, 'function', 'camera movement must be implemented');
  return module.moveCamera(position, input, dt, mode);
}
function surface() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, event) { for (const fn of listeners.get(type) || []) fn(event); },
    count() { return [...listeners.values()].reduce((n, list) => n + list.size, 0); },
  };
}
function setup() {
  assert.equal(typeof module.createNavigation, 'function', 'camera navigation must be implemented');
  const document = surface(), canvas = surface(); canvas.ownerDocument = document;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(50, 40, 50); camera.lookAt(50, 40, 0);
  const controls = { enabled: true, target: new THREE.Vector3(50, 40, 0) };
  return { camera, controls, document, canvas, nav: module.createNavigation(THREE, camera, controls, canvas) };
}

test('free movement follows view yaw and diagonal input does not increase speed', () => {
  const origin = { x: 0, y: 40, z: 0 };
  const forward = move(origin, { forward: 1 }, .1, 'fly');
  assert.ok(forward.z < 0); assert.equal(forward.x, 0);
  const turned = move(origin, { forward: 1, yaw: -Math.PI / 2 }, .1, 'fly');
  assert.ok(turned.x > 0); assert.ok(Math.abs(turned.z) < 1e-8);
  const diagonal = move(origin, { forward: 1, right: 1 }, .1, 'fly');
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.abs(forward.z)) < 1e-8);
  const boost = move(origin, { forward: 1, boost: true }, .1, 'fly');
  assert.ok(Math.abs(boost.z) > Math.abs(forward.z) * 2);
  assert.deepEqual(origin, { x: 0, y: 40, z: 0 });
});

test('fly movement stays in the world and cannot pass through terrain or above its ceiling', () => {
  let p = { x: 259.9, y: 189.9, z: 259.9 };
  p = move(p, { right: 1, up: 1, forward: -1, boost: true }, .1, 'fly');
  assert.ok(p.x <= 260 && p.z <= 260 && p.y <= 190);
  p = move({ x: 190, y: 0, z: 150 }, { up: -1 }, .1, 'fly');
  assert.ok(p.y >= terrainHeight(p.x, p.z) + 2);
});

test('walking follows the terrain and keeps its eye height above river water', () => {
  const p = move({ x: 140, y: 90, z: 60 }, { forward: 1, up: 1 }, .1, 'walk');
  assert.equal(p.y, Math.max(terrainHeight(p.x, p.z), -2.5) + 2);
  const water = move({ x: riverX(0), y: 90, z: 0 }, {}, .1, 'walk');
  assert.equal(water.y, -.5);
  assert.deepEqual(move(p, { forward: 1 }, 0, 'walk'), p);
});

test('switching into fly keeps current viewing direction and orbit restores a coherent target', () => {
  const { camera, controls, nav } = setup(); camera.lookAt(100, 48, -20);
  const before = camera.getWorldDirection(new THREE.Vector3());
  nav.setMode('fly'); nav.update(.016, { birds: [] }, 0);
  assert.equal(nav.mode, 'fly'); assert.equal(controls.enabled, false);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(before) > .9999);
  nav.setMode('orbit'); assert.equal(controls.enabled, true);
  assert.ok(controls.target.clone().sub(camera.position).normalize().dot(before) > .9999);
  assert.throws(() => nav.setMode('teleport'), /navigation/i); nav.dispose();
});

test('active navigation moves on keys, respects forms, prevents arrows and removes listeners', () => {
  const { camera, nav, document, canvas } = setup();
  nav.setMode('fly'); const initial = camera.position.clone();
  let prevented = 0;
  document.dispatch('keydown', { code: 'ArrowUp', target: { tagName: 'INPUT' }, preventDefault() { prevented++; } });
  nav.update(.1, { birds: [] }, 0); assert.equal(camera.position.distanceTo(initial), 0);
  document.dispatch('keydown', { code: 'ArrowUp', target: { tagName: 'BODY' }, preventDefault() { prevented++; } });
  nav.update(.1, { birds: [] }, .1); assert.ok(camera.position.z < initial.z); assert.equal(prevented, 1);
  document.dispatch('keyup', { code: 'ArrowUp' });
  nav.setMode('orbit'); document.dispatch('keydown', { code: 'ArrowUp', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  nav.dispose(); assert.equal(document.count(), 0); assert.equal(canvas.count(), 0);
});

test('dragging changes free view and switching modes releases the captured pointer', () => {
  const { camera, nav, canvas } = setup(); let captured = null;
  canvas.setPointerCapture = id => { captured = id; };
  canvas.hasPointerCapture = id => captured === id;
  canvas.releasePointerCapture = () => { captured = null; };
  nav.setMode('fly');
  canvas.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
  canvas.dispatch('pointermove', { pointerId: 1, clientX: 100, clientY: -40 });
  nav.update(.016, { birds: [] }, 0);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  assert.ok(direction.x > .2 && direction.y > .08);
  assert.equal(captured, 1);
  nav.setMode('orbit'); assert.equal(captured, null);
  nav.dispose();
});

test('bird POV follows velocity and tour moves smoothly while zero dt freezes both', () => {
  const { camera, nav } = setup();
  const habitat = { birds: [{ x: 40, y: 45, z: -30, vx: 15, vy: 3, vz: -8, turn: .4 }] };
  nav.setMode('bird');
  for (let i = 0; i < 120; i++) nav.update(1 / 60, habitat, i / 60);
  const heading = new THREE.Vector3(15, 3, -8).normalize();
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(heading) > .98);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(40, 45, -30)) < 8);
  const initial = camera.position.clone(); nav.update(0, habitat, 200); assert.ok(camera.position.equals(initial));
  nav.setMode('tour'); for (let i = 0; i < 120; i++) nav.update(1 / 60, habitat, i / 60);
  assert.ok(camera.position.distanceTo(initial) > 20);
  assert.ok(camera.position.y >= terrainHeight(camera.position.x, camera.position.z) + 2);
  nav.dispose();
});
