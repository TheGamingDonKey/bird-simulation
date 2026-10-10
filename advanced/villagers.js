import { riverX, terrainHeight } from './terrain.js';

export function villageTents() {
  return Array.from({ length: 6 }, (_, i) => {
    const a = i / 6 * Math.PI * 2 + .2;
    const z = 20 + Math.sin(a) * (13 + i % 2 * 4);
    return { x: Math.max(35 + Math.cos(a) * (13 + i % 2 * 4), riverX(z) + 21), z, rotation: -a + Math.PI / 2 };
  });
}

// Plain state, deliberately independent of rendering, keeps pause and seeded runs exact.
export class VillageSimulation {
  constructor({ seed = 71341, count = 10, tents = villageTents() } = {}) {
    this.seed = seed >>> 0; this.time = 0; this.tents = tents;
    this.villagers = Array.from({ length: count }, (_, i) => ({
      id: i, name: `Villager ${i + 1}`, home: i % tents.length,
      x: 36 + (i % 4) * 2, z: 11 + Math.floor(i / 4) * 3,
      y: 0, heading: 0, speed: 0, state: 'walk', phase: i * .73,
      goal: {x: 44 + i % 3 * 4, z: 35 - i % 4 * 3}, intent: 'forage',
      until: 0, commandUntil: 0, scaredUntil: 0, walkPhase: i * .73,
    }));
    for (const p of this.villagers) p.y = terrainHeight(p.x, p.z);
    this.initialSeed = this.seed;
    this.initialVillagers = this.villagers.map(p => ({...p, goal: {...p.goal}}));
  }
  reset() {
    this.seed = this.initialSeed; this.time = 0;
    this.villagers.length = this.initialVillagers.length;
    for (let i = 0; i < this.initialVillagers.length; i++) {
      const original = this.initialVillagers[i];
      this.villagers[i] ??= {};
      Object.assign(this.villagers[i], original, {goal: {...original.goal}});
    }
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  dryPoint(x, z) {
    z = Math.max(-110, Math.min(115, z));
    x = Math.max(riverX(z) + 18, Math.min(125, x));
    for (let pass = 0; pass < 3; pass++) for (const t of this.tents) {
      const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
      if (d < 5.1) { x = t.x + (d ? dx / d : 1) * 5.1; z = t.z + (d ? dz / d : 0) * 5.1; }
    }
    return {x: Math.max(riverX(z) + 18, x), z};
  }
  interact(x, z, kind = 'gather') {
    if (!Number.isFinite(x + z)) return false;
    if (kind === 'scare' || kind === 'startle') return this.scare(x, z);
    const center = this.dryPoint(x, z);
    for (const p of this.villagers) {
      const a = p.id / this.villagers.length * Math.PI * 2;
      p.goal = this.dryPoint(center.x + Math.cos(a) * 3, center.z + Math.sin(a) * 3);
      p.commandUntil = this.time + 90; p.intent = 'gather'; p.state = 'rally';
    }
    return true;
  }
  scare(x, z) {
    if (!Number.isFinite(x + z)) return false;
    for (const p of this.villagers) {
      if (Math.hypot(p.x - x, p.z - z) > 45) continue;
      const a = Math.atan2(p.z - z, p.x - x) + (p.id % 2 ? .3 : -.3);
      p.goal = this.dryPoint(p.x + Math.cos(a) * 17, p.z + Math.sin(a) * 17);
      p.scaredUntil = this.time + 8; p.commandUntil = 0; p.intent = 'flee'; p.state = 'flee';
    }
    return true;
  }
  chooseActivity(p, daylight) {
    const byFire = daylight < .35 || this.random() < .36;
    const a = this.random() * Math.PI * 2;
    const radius = byFire ? 4.3 + this.random() * 2 : 15 + this.random() * 19;
    p.goal = this.dryPoint(35 + Math.cos(a) * radius + (byFire ? 0 : 10), 20 + Math.sin(a) * radius);
    p.intent = byFire ? 'campfire' : 'forage'; p.state = 'walk';
  }
  step(dt, options = {}) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    let remaining = Math.min(dt, 1);
    while (remaining > 1e-8) { const h = Math.min(.05, remaining); this.tick(h, options); remaining -= h; }
  }
  tick(dt, options) {
    this.time += dt;
    for (const p of this.villagers) {
      const local = options.weatherSystem?.sample(p.x, p.z);
      const badWeather = local ? (local.rain > .28 || local.snow > .35)
        : ['storm', 'rain', 'snow'].includes(options.weather);
      if (badWeather && p.scaredUntil <= this.time) {
        const t = this.tents[p.home], a = p.id * 2.4;
        p.goal = {x: t.x + Math.cos(a) * .65, z: t.z + Math.sin(a) * .65};
        p.intent = 'shelter';
        if (p.state !== 'shelter') p.state = 'sheltering';
      } else if (p.intent === 'shelter' || (p.intent === 'flee' && p.scaredUntil <= this.time)) {
        p.commandUntil = 0; this.chooseActivity(p, options.daylight ?? 1);
      } else if ((p.state === 'forage' || p.state === 'campfire') && this.time > p.until) {
        this.chooseActivity(p, options.daylight ?? 1);
      } else if (p.intent === 'gather' && this.time > p.commandUntil) this.chooseActivity(p, options.daylight ?? 1);

      let dx = p.goal.x - p.x, dz = p.goal.z - p.z, distance = Math.hypot(dx, dz);
      if (distance < .45) {
        p.speed = 0; p.state = p.intent === 'gather' ? 'gather' : p.intent;
        if (!p.until || p.until < this.time) p.until = this.time + 5 + this.random() * 8;
      } else {
        p.state = p.intent === 'shelter' ? 'sheltering' : p.intent === 'gather' ? 'rally' : p.intent === 'flee' ? 'flee' : 'walk';
        dx /= distance; dz /= distance;
        // Route around tent footprints; each home admits its residents during rain.
        for (let i = 0; i < this.tents.length; i++) {
          if (p.intent === 'shelter' && i === p.home) continue;
          const t = this.tents[i], tx = t.x - p.x, tz = t.z - p.z;
          const along = tx * dx + tz * dz, side = tx * dz - tz * dx;
          if (along > -.5 && along < 7 && Math.abs(side) < 4.7) {
            const sign = side === 0 ? (p.id % 2 ? 1 : -1) : -Math.sign(side);
            const strength = (1 - Math.abs(side) / 4.7) * 1.8;
            const ox = dz * sign, oz = -dx * sign;
            dx += ox * strength; dz += oz * strength;
          }
        }
        const len = Math.hypot(dx, dz) || 1;
        p.speed = p.intent === 'flee' ? 4.2 : p.intent === 'shelter' ? 2.8 : 1.65 + p.id % 3 * .15;
        const travel = Math.min(distance, p.speed * dt);
        p.x += dx / len * travel; p.z += dz / len * travel;
        p.x = Math.max(riverX(p.z) + 16, p.x);
        // A projected footprint prevents corner cutting while steering turns.
        for (let i = 0; i < this.tents.length; i++) {
          if (p.intent === 'shelter' && i === p.home) continue;
          const t = this.tents[i], ox = p.x - t.x, oz = p.z - t.z, d = Math.hypot(ox, oz);
          if (d < 4.2) { p.x = t.x + ox / (d || 1) * 4.2; p.z = t.z + oz / (d || 1) * 4.2; }
        }
        p.heading = Math.atan2(dx, dz); p.walkPhase += p.speed * dt * 3.7;
      }
      p.y = terrainHeight(p.x, p.z);
    }
  }
}
