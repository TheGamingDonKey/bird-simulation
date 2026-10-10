const MODES = new Set(['mixed', 'clear', 'rain', 'snow', 'fog', 'storm']);
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const TARGETS = {
  mixed: [.48, .58, .57, .42, 2.5], clear: [.1, 0, 0, .015, 1.4],
  rain: [.88, .9, 0, .2, 4.5], snow: [.82, 0, .88, .17, 2.8],
  fog: [.55, 0, 0, .88, .7], storm: [1, 1, 0, .32, 11],
};

// Geographic weather is shared by birds, precipitation and village decisions.
// Only simulation time advances it, so pause/reset freeze the entire habitat.
export class WeatherSystem {
  constructor(seed = 42) { this.reset(seed); }

  random() {
    this._state = (this._state + 0x6D2B79F5) >>> 0;
    let n = Math.imul(this._state ^ this._state >>> 15, this._state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }

  reset(seed = 42) {
    this.seed = seed; this._state = seed >>> 0; this.time = 0; this.mode = 'mixed';
    this.wind = { x: 2.5, z: 1 }; this.cloudCover = .48;
    this.rain = .58; this.snow = .57; this.fog = .42; this.lightning = 0;
    this._windStrength = 2.5; this._nextFlash = 3 + this.random() * 3;
    this.fronts = this.createFronts('mixed');
  }

  createFronts(mode) {
    const zones = mode === 'mixed'
      ? [[-105, -30, 100, 'rain'], [135, -90, 100, 'snow'], [15, 95, 78, 'fog']]
      : [[-95, -30, 150, mode], [115, 100, 155, mode]];
    return zones.map(([x, z, radius, type]) => ({
      x, z, radius, type, intensity: .72 + this.random() * .2,
      phase: this.random() * Math.PI * 2, drift: .75 + this.random() * .5,
    }));
  }

  setMode(mode) {
    if (!MODES.has(mode)) throw new RangeError(`Unknown weather: ${mode}`);
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== 'clear') this.fronts = this.createFronts(mode);
    if (mode === 'storm') this._nextFlash = this.time + 2 + this.random() * 3;
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1); this.time += dt;
    const target = TARGETS[this.mode], blend = 1 - Math.exp(-dt / 3.3);
    for (const [i, field] of ['cloudCover', 'rain', 'snow', 'fog', '_windStrength'].entries()) {
      this[field] += (target[i] - this[field]) * blend;
    }
    const t = this.time;
    const gust = 1 + .22 * Math.sin(t * .43) + .12 * Math.sin(t * 1.37);
    const heading = .3 + .45 * Math.sin(t * .063);
    this.wind.x = Math.cos(heading) * this._windStrength * gust;
    this.wind.z = Math.sin(heading) * this._windStrength * gust;
    for (const front of this.fronts) {
      front.x += (this.wind.x * .45 + Math.sin(t * .08 + front.phase) * .7) * front.drift * dt;
      front.z += (this.wind.z * .45 + Math.cos(t * .06 + front.phase) * .9) * front.drift * dt;
      if (front.x > 340) front.x = -340; if (front.x < -340) front.x = 340;
      if (front.z > 340) front.z = -340; if (front.z < -340) front.z = 340;
      const intensity = this.mode === 'clear' ? 0 : .78 + .2 * Math.sin(t * .11 + front.phase);
      front.intensity += (intensity - front.intensity) * (1 - Math.exp(-dt / 2));
    }
    this.lightning *= Math.exp(-dt * 17);
    if (this.mode === 'storm' && t >= this._nextFlash) {
      this.lightning = 1;
      this._nextFlash = t + 3.5 + this.random() * 7;
    }
  }

  sample(x, z, out = {}) {
    let rain = 0, snow = 0, fog = 0, gustX = 0, gustZ = 0;
    for (const front of this.fronts) {
      const dx = x - front.x, dz = z - front.z;
      const falloff = Math.max(0, 1 - (dx * dx + dz * dz) / (front.radius * front.radius));
      const amount = falloff * falloff * front.intensity;
      if (front.type === 'rain' || front.type === 'storm') rain = Math.max(rain, amount);
      if (front.type === 'snow') snow = Math.max(snow, amount);
      if (front.type === 'fog') fog = Math.max(fog, amount);
      gustX += amount * Math.sin(front.phase + this.time * .8) * 1.7;
      gustZ += amount * Math.cos(front.phase + this.time * .6) * 1.2;
    }
    const selected = this.mode !== 'mixed' && this.mode !== 'clear';
    out.rain = clamp(this.rain * (selected ? .3 + .9 * rain : rain * 1.5));
    out.snow = clamp(this.snow * (selected ? .3 + .9 * snow : snow * 1.5));
    out.fog = clamp(this.fog * (selected ? .3 + .9 * fog : fog * 1.7));
    out.windX = this.wind.x + gustX + Math.sin(z * .024 + this.time * .32) * .7;
    out.windZ = this.wind.z + gustZ + Math.cos(x * .023 - this.time * .23) * .7;
    out.temperature = 16 - out.snow * 24 - out.rain * 4 - out.fog * 2;
    return out;
  }
}
