import { terrainHeight } from './terrain.js';

const MODES = new Set(['orbit', 'fly', 'walk', 'bird', 'tour']);
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const ground = (x, z) => Math.max(terrainHeight(x, z), -2.5) + 2;

// World-space movement without a renderer or DOM. Forward at yaw=0 is -Z.
export function moveCamera(position, input = {}, dt, mode = 'fly') {
  const next = { x: position.x, y: position.y, z: position.z };
  if (!Number.isFinite(dt) || dt <= 0 || (mode !== 'fly' && mode !== 'walk')) return next;
  const forward = clamp(input.forward || 0, -1, 1), right = clamp(input.right || 0, -1, 1);
  const up = mode === 'fly' ? clamp(input.up || 0, -1, 1) : 0;
  const yaw = Number.isFinite(input.yaw) ? input.yaw : 0;
  const normalization = Math.max(1, Math.hypot(forward, right, up));
  const travel = Math.min(dt, .1) * (mode === 'walk' ? 10 : 24) * (input.boost ? 3 : 1) / normalization;
  next.x = clamp(next.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * travel, -260, 260);
  next.z = clamp(next.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * travel, -260, 260);
  next.y = mode === 'walk' ? ground(next.x, next.z) : clamp(next.y + up * travel, ground(next.x, next.z), 190);
  return next;
}

export function createNavigation(THREE, camera, controls, canvas) {
  const document = canvas.ownerDocument || globalThis.document;
  const window = document.defaultView;
  const pressed = new Set(), listeners = [];
  const direction = new THREE.Vector3(), target = new THREE.Vector3(), destination = new THREE.Vector3();
  let mode = 'orbit', yaw = 0, pitch = 0, dragging = false, pointerId = null, pointerX = 0, pointerY = 0;
  let bank = 0, disposed = false;

  function listen(surface, event, handler) {
    if (!surface?.addEventListener) return;
    surface.addEventListener(event, handler); listeners.push([surface, event, handler]);
  }
  const free = () => mode === 'fly' || mode === 'walk';
  const formFocused = target => target?.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target?.tagName || '') || target?.closest?.('[contenteditable="true"]');
  function syncTarget() {
    camera.getWorldDirection(direction);
    controls.target.copy(camera.position).addScaledVector(direction, 30);
  }
  function clearInput() { pressed.clear(); releasePointer(); }
  function setMode(next) {
    if (!MODES.has(next)) throw new RangeError(`Unknown navigation mode: ${next}`);
    if (disposed) return;
    clearInput(); camera.getWorldDirection(direction);
    yaw = Math.atan2(-direction.x, -direction.z); pitch = Math.asin(clamp(direction.y, -.999, .999));
    syncTarget(); camera.up.set(0, 1, 0); camera.lookAt(controls.target); bank = 0;
    mode = next; controls.enabled = mode === 'orbit';
    if (mode === 'walk') { camera.position.y = ground(camera.position.x, camera.position.z); syncTarget(); }
  }
  listen(document, 'keydown', event => {
    if (!free() || formFocused(event.target) || !MOVEMENT_KEYS.has(event.code)) return;
    pressed.add(event.code);
    if (event.code.startsWith('Arrow')) event.preventDefault();
  });
  listen(document, 'keyup', event => pressed.delete(event.code));
  listen(window, 'blur', clearInput);
  listen(document, 'focusin', event => { if (formFocused(event.target)) clearInput(); });
  listen(canvas, 'pointerdown', event => {
    if (!free() || (event.button !== undefined && event.button !== 0)) return;
    dragging = true; pointerId = event.pointerId; pointerX = event.clientX; pointerY = event.clientY;
    canvas.setPointerCapture?.(pointerId);
  });
  listen(canvas, 'pointermove', event => {
    if (!dragging || !free() || event.pointerId !== pointerId) return;
    yaw -= (event.clientX - pointerX) * .003;
    pitch = clamp(pitch - (event.clientY - pointerY) * .003, -1.35, 1.35);
    pointerX = event.clientX; pointerY = event.clientY;
  });
  function releasePointer() {
    if (pointerId !== null && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture?.(pointerId);
    dragging = false; pointerId = null;
  }
  listen(canvas, 'pointerup', releasePointer); listen(canvas, 'pointercancel', releasePointer);
  listen(canvas, 'lostpointercapture', () => { dragging = false; pointerId = null; });

  function update(dt, habitat, time = habitat?.time || 0) {
    if (disposed || mode === 'orbit' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1);
    const has = (...keys) => keys.some(key => pressed.has(key));
    if (free()) {
      const next = moveCamera(camera.position, {
        forward: Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown')),
        right: Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft')),
        up: Number(has('KeyE')) - Number(has('KeyQ')), yaw, boost: has('ShiftLeft', 'ShiftRight'),
      }, dt, mode);
      camera.position.set(next.x, next.y, next.z);
      direction.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      target.copy(camera.position).addScaledVector(direction, 30);
      camera.lookAt(target); controls.target.copy(target);
    } else if (mode === 'bird') {
      const bird = habitat?.birds?.[0]; if (!bird) return;
      direction.set(bird.vx, bird.vy, bird.vz);
      if (direction.lengthSq() < .0001) camera.getWorldDirection(direction); else direction.normalize();
      destination.set(bird.x, bird.y + 1.2, bird.z).addScaledVector(direction, -3.5);
      camera.position.lerp(destination, 1 - Math.exp(-dt * 5));
      camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z));
      target.copy(camera.position).addScaledVector(direction, 35);
      camera.lookAt(target);
      bank += (clamp(bird.turn || 0, -.7, .7) * .32 - bank) * (1 - Math.exp(-dt * 3));
      camera.rotateZ(bank); controls.target.copy(target);
    } else if (mode === 'tour') {
      const angle = time * .045;
      destination.set(Math.cos(angle) * 165, 75 + Math.sin(time * .075) * 27, Math.sin(angle) * 175);
      destination.y = Math.max(destination.y, ground(destination.x, destination.z) + 8);
      camera.position.lerp(destination, 1 - Math.exp(-dt * 1.4));
      camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z));
      target.set(Math.sin(time * .035) * 30, 22, Math.cos(time * .027) * 25);
      camera.lookAt(target); controls.target.copy(target);
    }
  }

  function dispose() {
    if (disposed) return;
    releasePointer(); clearInput(); syncTarget(); controls.enabled = true; disposed = true;
    for (const [surface, event, handler] of listeners) surface.removeEventListener(event, handler);
    listeners.length = 0;
  }
  return { setMode, update, get mode() { return mode; }, dispose };
}
