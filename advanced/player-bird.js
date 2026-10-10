import { terrainHeight } from './terrain.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const floorAt = (x, z) => Math.max(terrainHeight(x, z), -2.5) + 1.2;
const angleDifference = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Player flight uses the same coordinates as scenery and flock birds. Perches
// come from actual generated crowns/roofs, rather than invented landing points.
export class PlayerBird {
  constructor(perches = []) { this.reset(perches); }

  setPerches(perches = []) {
    this.perches = Array.isArray(perches) ? perches.filter(p => p && ['tree', 'tent'].includes(p.type)
      && [p.x, p.y, p.z].every(Number.isFinite) && Math.abs(p.x) <= 255 && Math.abs(p.z) <= 255
      && p.y + .4 <= 190 && p.y + .4 >= floorAt(p.x, p.z)) : [];
    if (this.perch) {
      const current = this.perches.find(p => p.id === this.perch.id);
      if (current) this.perch = current;
      else { this.perch = null; this.mode = 'flying'; this.flightState = 'flap'; this.speed = 14; }
    }
  }

  reset(perches = this.perches) {
    this.perch = null; this.setPerches(perches);
    const near = this.perches.find(p => p.type === 'tent') || this.perches[0];
    this.x = near ? near.x : 35; this.z = clamp(near ? near.z + 10 : 30, -255, 255);
    this.y = clamp(Math.max(near ? near.y + 6 : 18, floorAt(this.x, this.z) + 4), 0, 190);
    this.yaw = 0; this.pitch = 0; this.turn = 0; this.speed = 16;
    this.vx = 0; this.vy = 0; this.vz = -16;
    this.energy = .9; this.phase = 0; this.flightClock = 0;
    this.mode = 'flying'; this.flightState = 'flap'; this.time = 0;
    this.chirpUntil = 0; this._nextChirp = 0; this.landings = 0;
    this.species = 0; this.subgroup = 0;
  }

  nearestPerch() {
    let result = null;
    for (const perch of this.perches) {
      const horizontalDistance = Math.hypot(perch.x - this.x, perch.z - this.z);
      const distance = Math.hypot(horizontalDistance, perch.y + .4 - this.y);
      if (!result || distance < result.distance) result = { perch, distance, horizontalDistance };
    }
    return result;
  }

  requestLand() {
    if (this.mode === 'perched') { this.takeOff(); return { ok: true, message: 'Taking off — flap to climb.' }; }
    if (this.mode === 'landing') { this.cancelLanding(); return { ok: true, message: 'Landing cancelled — back in flight.' }; }
    const nearest = this.nearestPerch();
    if (!nearest) return { ok: false, message: 'No tree crowns or tent roofs nearby.' };
    if (nearest.horizontalDistance > 24 || Math.abs(this.y - nearest.perch.y - .4) > 18) {
      return { ok: false, message: 'Fly closer to a tree crown or tent roof, then land.' };
    }
    this.perch = nearest.perch; this.mode = 'landing'; this.flightState = 'glide';
    return { ok: true, message: `Approaching ${this.perch.label || (this.perch.type === 'tree' ? 'tree crown' : 'tent roof')} to land.` };
  }

  cancelLanding() {
    if (this.mode !== 'landing') return false;
    this.mode = 'flying'; this.perch = null; this.flightState = 'flap'; this.speed = Math.max(12, this.speed);
    return true;
  }

  takeOff() {
    if (this.mode !== 'perched') return false;
    this.mode = 'flying'; this.perch = null; this.flightState = 'flap';
    this.speed = 14; this.pitch = .28; this.vy = 5;
    this.vx = -Math.sin(this.yaw) * 14; this.vz = -Math.cos(this.yaw) * 14;
    this.energy = Math.max(this.energy, .35);
    return true;
  }

  chirp() {
    if (this.time < this._nextChirp) return false;
    this.chirpUntil = this.time + 1.8; this._nextChirp = this.time + 2.8;
    return true;
  }

  step(dt, input = {}, options = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const duration = Math.min(dt, .1), steps = Math.ceil(duration / (1 / 60));
    for (let i = 0; i < steps; i++) this.integrate(duration / steps, input, options);
  }

  integrate(dt, input, options) {
    this.time += dt; this.flightClock += dt;
    const steering = clamp(finite(input.turn), -1, 1), climbing = clamp(finite(input.pitch), -1, 1);
    if (this.mode === 'landing' && (Math.abs(steering) > .25 || Math.abs(climbing) > .25 || input.flap)) this.cancelLanding();
    if (this.mode === 'perched') {
      if (input.flap) this.takeOff();
      else {
        this.x = this.perch.x; this.y = this.perch.y + .4; this.z = this.perch.z;
        this.vx = this.vy = this.vz = this.speed = 0; this.turn *= Math.exp(-dt * 6);
        this.pitch *= Math.exp(-dt * 6); this.energy = clamp(this.energy + dt * .18, 0, 1);
        this.flightState = 'perch'; return;
      }
    }
    if (this.mode === 'landing') {
      const dx = this.perch.x - this.x, dy = this.perch.y + .4 - this.y, dz = this.perch.z - this.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance < .12) {
        this.x = this.perch.x; this.y = this.perch.y + .4; this.z = this.perch.z;
        this.vx = this.vy = this.vz = this.speed = 0; this.pitch = this.turn = 0;
        this.mode = 'perched'; this.flightState = 'perch'; this.landings++; return;
      }
      const travel = Math.min(14 * dt, distance * (1 - Math.exp(-dt * 3)));
      this.vx = dx / distance * travel / dt; this.vy = dy / distance * travel / dt; this.vz = dz / distance * travel / dt;
      const aim = Math.atan2(-dx, -dz), turn = angleDifference(aim, this.yaw);
      this.yaw += turn * (1 - Math.exp(-dt * 6));
      this.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - this.pitch) * (1 - Math.exp(-dt * 5));
      this.turn += (clamp(-turn, -.5, .5) - this.turn) * (1 - Math.exp(-dt * 6));
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      // Riverbanks can rise between the bird and a low roof. Keep the approach
      // above those real surfaces even while its final target is lower.
      const floor = floorAt(this.x, this.z);
      if (this.y < floor) { this.y = floor; this.vy = Math.max(0, this.vy); }
      this.speed = travel / dt; this.energy = clamp(this.energy + dt * .055, 0, 1);
      this.phase = (this.phase + dt * 1.4) % (Math.PI * 2); return;
    }

    const blend = 1 - Math.exp(-dt * 4);
    this.turn += (steering * .55 - this.turn) * blend;
    this.yaw = Math.atan2(Math.sin(this.yaw - this.turn * 2.2 * dt), Math.cos(this.yaw - this.turn * 2.2 * dt));
    this.pitch += (climbing * .64 - this.pitch) * blend;
    const local = options.weatherSystem?.sample(this.x, this.z) || options.weather?.sample?.(this.x, this.z);
    const wind = options.wind || {};
    const wx = finite(local?.windX, finite(wind.x)), wz = finite(local?.windZ, finite(wind.z));
    const rough = clamp(finite(local?.rain) + finite(local?.snow) * .65, 0, 1);
    const glide = Boolean(input.glide) || (!input.flap && this.energy < .04);
    this.flightState = glide ? 'glide' : 'flap';
    const activeFlap = input.flap && !glide;
    const targetSpeed = glide ? 18 + Math.max(0, -this.pitch) * 5 : activeFlap ? 22 : 16;
    this.speed += (clamp(targetSpeed - rough * 2, 12, 24) - this.speed) * (1 - Math.exp(-dt * 2));
    const horizontal = Math.cos(this.pitch) * this.speed;
    const vx = -Math.sin(this.yaw) * horizontal + wx * .3;
    const vz = -Math.cos(this.yaw) * horizontal + wz * .3;
    const vy = Math.sin(this.pitch) * this.speed + (glide ? -1.5 : activeFlap ? 2.4 : 0) - rough * .7;
    this.vx += (vx - this.vx) * blend; this.vy += (vy - this.vy) * blend; this.vz += (vz - this.vz) * blend;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    this.energy = clamp(this.energy + dt * (glide ? .09 : activeFlap ? -.13 : -.028) - Math.max(0, this.pitch) * dt * .035, 0, 1);
    this.phase = (this.phase + dt * (glide ? 1.4 : activeFlap ? 18 : 12)) % (Math.PI * 2);
    let bounced = false;
    for (const axis of ['x', 'z']) {
      if (Math.abs(this[axis]) > 255) {
        this[axis] = clamp(this[axis], -255, 255);
        this[`v${axis}`] = -Math.sign(this[axis]) * Math.max(2, Math.abs(this[`v${axis}`])); bounced = true;
      }
    }
    if (bounced) this.yaw = Math.atan2(-this.vx, -this.vz);
    const floor = floorAt(this.x, this.z);
    if (this.y < floor) { this.y = floor; this.vy = Math.max(3, Math.abs(this.vy) * .25); this.pitch = Math.max(.2, this.pitch); }
    if (this.y > 190) { this.y = 190; this.vy = -Math.max(2, Math.abs(this.vy) * .25); this.pitch = Math.min(-.15, this.pitch); }
  }
}
