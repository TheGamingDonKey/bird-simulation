import { terrainHeight } from './terrain.js';
import { WeatherSystem } from './weather.js';

const WEATHER = new Set(['mixed', 'clear', 'rain', 'snow', 'fog', 'storm']);
const CELL = 30;
const SPEEDS = [17, 15, 22];
const ALTITUDES = [32, 51, 99];
const FLAP_SECONDS = [4.6, 3.2, 1.8];
const FLIGHT_SECONDS = [6.2, 7.4, 11.5];
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
    this.weatherSystem = new WeatherSystem(seed);
    this.wind = this.weatherSystem.wind;
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
      const x = (species - 1) * 62 + (this.random() - 0.5) * 150;
      const z = (this.random() - 0.5) * 250;
      const y = ALTITUDES[species] + (this.random() - .5) * 25;
      this.birds.push({
        x, y: Math.max(y, terrainHeight(x, z) + 10), z,
        vx: Math.cos(angle) * SPEEDS[species], vy: (this.random() - 0.5) * 2,
        vz: Math.sin(angle) * SPEEDS[species], species, phase: this.random() * Math.PI * 2,
        subgroup: Math.floor(this.birds.length / 3) % 5, flightState: 'flap',
        flightClock: this.random() * FLIGHT_SECONDS[species], energy: .65 + this.random() * .3,
        turn: 0,
      });
    }
  }

  setWeather(mode) {
    if (!WEATHER.has(mode)) throw new RangeError(`Unknown weather: ${mode}`);
    this.weather = mode;
    this.weatherSystem.setMode(mode);
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
    this.weatherSystem.step(dt);
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
    if (!this._forces || this._forces.length < this.birds.length * 3) this._forces = new Float32Array(this.birds.length * 3);
    const forces = this._forces, local = {};
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
            const related = other.subgroup === b.subgroup ? 1 : .35;
            ax += other.vx * related; ay += other.vy * related; az += other.vz * related;
            px += other.x * related; py += other.y * related; pz += other.z * related;
            neighbors += related;
          }
        }
      }
      let fx = sx * 2.1, fy = sy * 2.1, fz = sz * 2.1;
      if (neighbors) {
        const alignment = b.species === 1 ? .75 : .55;
        const cohesion = b.species === 1 ? .028 : .02;
        fx += (ax / neighbors - b.vx) * alignment + (px / neighbors - b.x) * cohesion;
        fy += (ay / neighbors - b.vy) * alignment + (py / neighbors - b.y) * cohesion;
        fz += (az / neighbors - b.vz) * alignment + (pz / neighbors - b.z) * cohesion;
      }
      // Different species share collision avoidance but form separate flocks.
      this.weatherSystem.sample(b.x, b.z, local);
      const rough = local.rain + local.snow * .65;
      b.flightClock = (b.flightClock + dt) % FLIGHT_SECONDS[b.species];
      b.flightState = hawk.active || rough > .65 || b.flightClock < FLAP_SECONDS[b.species] ? 'flap' : 'glide';
      b.energy = clamp(b.energy + dt * (b.flightState === 'glide' ? .065 : -.025), 0, 1);
      const wander = b.species === 0 ? 2.1 : b.species === 1 ? 1.3 : .85;
      const heading = t * (b.species === 0 ? .52 : .19) + b.subgroup * 1.6;
      fx += Math.sin(heading + b.x * .022 + b.z * .009) * wander;
      fz += Math.cos(heading * .81 + b.z * .023) * wander;
      fx += local.windX * .34; fz += local.windZ * .34;
      const thermal = b.species === 2 ? Math.max(0, Math.sin(b.x * .023 + t * .07) * Math.cos(b.z * .018)) * 3.5 : 0;
      const height = ALTITUDES[b.species] + Math.sin(t * .12 + b.subgroup * 1.5) * (b.species === 2 ? 17 : 9) - rough * 22;
      fy += (height - b.y) * .065 - b.vy * .24 + thermal;
      if (b.flightState === 'glide') fy -= .7;
      else if (b.species === 0) fy += Math.sin(b.phase) * .8;
      // Soft turns near the edges, followed by a final collision guard below.
      if (Math.abs(b.x) > 225) fx -= Math.sign(b.x) * (Math.abs(b.x) - 225) * .35;
      if (Math.abs(b.z) > 225) fz -= Math.sign(b.z) * (Math.abs(b.z) - 225) * .35;
      if (b.y > 132) fy -= (b.y - 132) * .6;
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
      const previousHeading = Math.atan2(b.vx, b.vz);
      b.vx += forces[i * 3] * dt; b.vy += forces[i * 3 + 1] * dt; b.vz += forces[i * 3 + 2] * dt;
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      const desired = SPEEDS[b.species] + (hawk.active ? 3 : 0);
      // Cruise control adjusts smoothly; an upper cap keeps escape flight stable.
      const nextSpeed = clamp(speed + (desired - speed) * dt * 0.4, 6, desired + 7);
      const scale = nextSpeed / (speed || 1);
      if (speed < 0.001) b.vz = 6;
      else { b.vx *= scale; b.vy *= scale; b.vz *= scale; }
      const headingDelta = Math.atan2(Math.sin(Math.atan2(b.vx, b.vz) - previousHeading), Math.cos(Math.atan2(b.vx, b.vz) - previousHeading));
      b.turn += (clamp(-headingDelta / dt * .8, -.7, .7) - b.turn) * Math.min(1, dt * 6);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      for (const axis of ['x', 'z']) {
        if (Math.abs(b[axis]) > 260) {
          b[axis] = clamp(b[axis], -260, 260);
          b[`v${axis}`] = -Math.sign(b[axis]) * Math.abs(b[`v${axis}`]);
        }
      }
      const floor = Math.max(7, terrainHeight(b.x, b.z) + 7);
      if (b.y < floor) { b.y = floor; b.vy = Math.max(2, Math.abs(b.vy)); }
      if (b.y > 145) { b.y = 145; b.vy = -Math.abs(b.vy); }
      b.phase = (b.phase + dt * (b.flightState === 'glide' ? 1.2 : [15, 11, 6][b.species]) * (hawk.active ? 1.3 : 1)) % (Math.PI * 2);
    }
  }

  stats() {
    let speed = 0;
    for (const b of this.birds) speed += Math.hypot(b.vx, b.vy, b.vz);
    return { count: this.birds.length, speed: this.birds.length ? speed / this.birds.length : 0, food: this.food.length };
  }
}
