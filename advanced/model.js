import { terrainHeight } from './terrain.js';

const WEATHER = new Set(['mixed', 'clear', 'rain', 'snow', 'fog', 'storm']);
const CELL = 30;
const SPEEDS = [13, 16, 20];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const cellKey = (x, y, z) => x + y * 32 + z * 1024;

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

// Artistic boids, with velocities and terrain in the scene's world units.
// Forces are calculated from one snapshot and integrated only afterwards.
export class Habitat {
  constructor(seed = 42, count = 220) {
    this.birds = [];
    this.count = clamp(Math.round(Number(count) || 0), 0, 700);
    this.reset(seed);
  }

  reset(seed = 42) {
    this.seed = seed;
    this.random = randomSource(seed);
    this.time = 0;
    this.weather = 'mixed';
    this.wind = { x: 1.5, z: 0.5 };
    this.food = [];
    this.predator = { x: -60, y: 62, z: -40, active: false };
    this.birds.length = 0;
    this.setCount(this.count);
  }

  setCount(value) {
    if (!Number.isFinite(Number(value))) return;
    this.count = clamp(Math.round(Number(value)), 0, 700);
    if (this.birds.length > this.count) this.birds.length = this.count;
    while (this.birds.length < this.count) {
      const species = this.birds.length % 3;
      const angle = this.random() * Math.PI * 2;
      const x = (species - 1) * 52 + (this.random() - 0.5) * 76;
      const z = (this.random() - 0.5) * 180;
      const y = 25 + species * 10 + this.random() * 18;
      this.birds.push({
        x, y: Math.max(y, terrainHeight(x, z) + 10), z,
        vx: Math.cos(angle) * SPEEDS[species], vy: (this.random() - 0.5) * 2,
        vz: Math.sin(angle) * SPEEDS[species], species, phase: this.random() * Math.PI * 2,
      });
    }
  }

  setWeather(mode) {
    if (!WEATHER.has(mode)) throw new RangeError(`Unknown weather: ${mode}`);
    this.weather = mode;
  }

  addFood(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    this.food.push({ x: clamp(x, -180, 180), z: clamp(z, -180, 180), life: 45 });
    if (this.food.length > 8) this.food.shift();
  }

  togglePredator() {
    this.predator.active = !this.predator.active;
    return this.predator.active;
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Avoid giant catch-up jumps after the browser has been in the background.
    const duration = Math.min(dt, 0.1);
    const steps = Math.ceil(duration / (1 / 60));
    for (let i = 0; i < steps; i++) this.integrate(duration / steps);
  }

  integrate(dt) {
    this.time += dt;
    const t = this.time;
    const storm = this.weather === 'storm';
    const strength = storm ? 8 : this.weather === 'rain' ? 3.5 : 1.5;
    this.wind.x = strength * (1 + 0.35 * Math.sin(t * 0.7));
    this.wind.z = strength * (0.3 + 0.3 * Math.cos(t * 0.53));
    for (const food of this.food) food.life -= dt;
    this.food = this.food.filter(food => food.life > 0);

    const hawk = this.predator;
    if (hawk.active) {
      const target = this.birds[Math.floor(t / 12) % (this.birds.length || 1)];
      const tx = target ? target.x : Math.cos(t * 0.13) * 90;
      const tz = target ? target.z : Math.sin(t * 0.13) * 90;
      const ty = target ? target.y + 8 : 55;
      const distance = Math.hypot(tx - hawk.x, ty - hawk.y, tz - hawk.z) || 1;
      const travel = Math.min(23 * dt, distance);
      hawk.x += (tx - hawk.x) / distance * travel;
      hawk.y += (ty - hawk.y) / distance * travel;
      hawk.z += (tz - hawk.z) / distance * travel;
    }

    const grid = new Map();
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      const key = cellKey(Math.floor(b.x / CELL), Math.floor(b.y / CELL), Math.floor(b.z / CELL));
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, bucket = []);
      bucket.push(i);
    }
    const forces = new Float32Array(this.birds.length * 3);
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      const cx = Math.floor(b.x / CELL), cy = Math.floor(b.y / CELL), cz = Math.floor(b.z / CELL);
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0;
      let px = 0, py = 0, pz = 0, neighbors = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(cellKey(cx + dx, cy + dy, cz + dz));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const other = this.birds[j];
          const rx = b.x - other.x, ry = b.y - other.y, rz = b.z - other.z;
          const d2 = rx * rx + ry * ry + rz * rz;
          if (d2 > CELL * CELL) continue;
          if (d2 < 64) {
            const repulsion = 9 / Math.max(d2, 0.25);
            sx += rx * repulsion; sy += ry * repulsion; sz += rz * repulsion;
            // A pair with identical positions also needs a deterministic escape.
            if (d2 < 0.001) sx += i < j ? -8 : 8;
          }
          if (other.species === b.species) {
            ax += other.vx; ay += other.vy; az += other.vz;
            px += other.x; py += other.y; pz += other.z;
            neighbors++;
          }
        }
      }
      let fx = sx * 2.1, fy = sy * 2.1, fz = sz * 2.1;
      if (neighbors) {
        fx += (ax / neighbors - b.vx) * 0.8 + (px / neighbors - b.x) * 0.035;
        fy += (ay / neighbors - b.vy) * 0.8 + (py / neighbors - b.y) * 0.035;
        fz += (az / neighbors - b.vz) * 0.8 + (pz / neighbors - b.z) * 0.035;
      }
      // Different species share collision avoidance but form separate flocks.
      fx += Math.sin(t * 0.27 + b.phase) * 0.7;
      fz += Math.cos(t * 0.23 + b.phase) * 0.7;
      const localWind = this.weather === 'mixed' ? (b.x < -45 ? 1.9 : b.x > 70 ? 0.45 : 1) : 1;
      fx += this.wind.x * 0.34 * localWind;
      fz += this.wind.z * 0.34 * localWind;
      fy += ((storm ? 24 : 32) + b.species * 10 - b.y) * 0.045 - b.vy * 0.18;
      // Soft turns near the edges, followed by a final collision guard below.
      if (Math.abs(b.x) > 165) fx -= Math.sign(b.x) * (Math.abs(b.x) - 165) * 0.32;
      if (Math.abs(b.z) > 165) fz -= Math.sign(b.z) * (Math.abs(b.z) - 165) * 0.32;
      if (b.y > 80) fy -= (b.y - 80) * 0.6;
      const ground = Math.max(terrainHeight(b.x, b.z), terrainHeight(b.x + b.vx * 1.6, b.z + b.vz * 1.6));
      if (b.y < ground + 17) fy += (ground + 17 - b.y) * 1.4;

      for (const food of this.food) {
        const rx = food.x - b.x, ry = terrainHeight(food.x, food.z) + 10 - b.y, rz = food.z - b.z;
        const distance = Math.hypot(rx, ry, rz);
        if (distance < 110 && distance > 1) {
          const pull = (1 - distance / 110) * 10 / distance;
          fx += rx * pull; fy += ry * pull; fz += rz * pull;
        }
      }
      if (hawk.active) {
        const rx = b.x - hawk.x, ry = b.y - hawk.y, rz = b.z - hawk.z;
        const distance = Math.hypot(rx, ry, rz);
        if (distance < 55) {
          const escape = (1 - distance / 55) * 45 / Math.max(1, distance);
          fx += rx * escape; fy += ry * escape + 5; fz += rz * escape;
        }
      }
      const force = Math.hypot(fx, fy, fz);
      const limit = force > 42 ? 42 / force : 1;
      forces[i * 3] = fx * limit; forces[i * 3 + 1] = fy * limit; forces[i * 3 + 2] = fz * limit;
    }
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.vx += forces[i * 3] * dt; b.vy += forces[i * 3 + 1] * dt; b.vz += forces[i * 3 + 2] * dt;
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      const desired = SPEEDS[b.species] + (hawk.active ? 3 : 0);
      // Cruise control adjusts smoothly; an upper cap keeps escape flight stable.
      const nextSpeed = clamp(speed + (desired - speed) * dt * 0.4, 6, desired + 7);
      const scale = nextSpeed / (speed || 1);
      if (speed < 0.001) b.vz = 6;
      else { b.vx *= scale; b.vy *= scale; b.vz *= scale; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      for (const axis of ['x', 'z']) {
        if (Math.abs(b[axis]) > 210) {
          b[axis] = clamp(b[axis], -210, 210);
          b[`v${axis}`] = -Math.sign(b[axis]) * Math.abs(b[`v${axis}`]);
        }
      }
      const floor = Math.max(7, terrainHeight(b.x, b.z) + 7);
      if (b.y < floor) { b.y = floor; b.vy = Math.max(2, Math.abs(b.vy)); }
      if (b.y > 95) { b.y = 95; b.vy = -Math.abs(b.vy); }
      b.phase = (b.phase + dt * (7 + b.species * 2 + (hawk.active ? 2 : 0))) % (Math.PI * 2);
    }
  }

  stats() {
    let speed = 0;
    for (const b of this.birds) speed += Math.hypot(b.vx, b.vy, b.vz);
    return { count: this.birds.length, speed: this.birds.length ? speed / this.birds.length : 0, food: this.food.length };
  }
}
