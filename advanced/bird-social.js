import { terrainHeight } from './terrain.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const validPosition = p => p && [p.x, p.y, p.z].every(Number.isFinite);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Object identity matters: trimming/recreating a flock must not turn a new bird
// at the same array index into the player's old companion.
export class BirdSocial {
  constructor() { this.reset(); }
  reset() {
    this.time = 0; this.companionId = null; this.companionUntil = 0;
    this._companion = null; this._ids = new WeakMap(); this._nextId = 1;
    this._friends = new Map(); this._calls = new Map();
  }
  get friends() { return this._friends.size; }
  get companionBird() { return this._companion; }
  get activeCalls() { return this._calls.size; }
  get friendInfo() {
    return [...this._friends.values()].map(f => ({ id: f.id, species: f.bird.species, metAt: f.metAt, feeds: f.feeds }));
  }
  idFor(bird) {
    if (!this._ids.has(bird)) this._ids.set(bird, this._nextId++);
    return this._ids.get(bird);
  }
  prune(habitat) {
    const present = new Set(habitat?.birds || []);
    for (const [bird, until] of this._calls) if (!present.has(bird) || until <= this.time) this._calls.delete(bird);
    for (const [id, friend] of this._friends) if (!present.has(friend.bird)) this._friends.delete(id);
    if (this._companion && (!present.has(this._companion) || this.companionUntil <= this.time)) this.clearCompanion();
  }
  clearCompanion() { this._companion = null; this.companionId = null; this.companionUntil = 0; }
  nearest(player, habitat, radius = 16) {
    if (!validPosition(player)) return null;
    let result = null, best = radius;
    for (const bird of habitat?.birds || []) {
      if (!validPosition(bird)) continue;
      const d = distance(player, bird);
      if (d <= best) { result = bird; best = d; }
    }
    return result;
  }
  befriend(bird, duration = 22) {
    const id = this.idFor(bird);
    if (!this._friends.has(id)) this._friends.set(id, { id, bird, metAt: this.time, feeds: 0 });
    this._companion = bird; this.companionId = id; this.companionUntil = this.time + duration;
    return this._friends.get(id);
  }
  call(player, habitat) {
    if (!validPosition(player)) return { ok: false, message: 'Enter bird flight to call nearby birds.' };
    this.prune(habitat); let count = 0;
    for (const bird of habitat?.birds || []) {
      if (validPosition(bird) && distance(player, bird) <= 50) {
        this.idFor(bird); this._calls.set(bird, this.time + 8); count++;
      }
    }
    return count ? { ok: true, message: `${count} nearby bird${count === 1 ? ' is' : 's are'} answering your call.` }
      : { ok: false, message: 'No birds close enough to hear your call. Fly nearer a flock.' };
  }
  greet(player, habitat) {
    this.prune(habitat); const bird = this.nearest(player, habitat);
    if (!bird) return { ok: false, message: 'Fly within 16 of another bird to greet it.' };
    const friend = this.befriend(bird);
    return { ok: true, message: `Bird ${friend.id} greeted you and will fly alongside for a while.` };
  }
  feed(player, habitat, inventory) {
    const food = typeof inventory === 'number' ? inventory : inventory?.food;
    if (!Number.isFinite(food) || food < 1) return { ok: false, consumed: 0, message: 'Gather some food before sharing it with another bird.' };
    this.prune(habitat);
    const companionNear = this._companion && validPosition(player) && distance(player, this._companion) <= 16;
    const bird = companionNear ? this._companion : this.nearest(player, habitat);
    if (!bird) return { ok: false, consumed: 0, message: 'No bird within reach. Food was kept.' };
    const remaining = bird === this._companion ? Math.max(0, this.companionUntil - this.time) : 0;
    const friend = this.befriend(bird, Math.max(22, remaining + 18)); friend.feeds++;
    bird.energy = clamp(finite(bird.energy, .6) + .25, 0, 1);
    // Inventory belongs to the nesting system; the caller applies this receipt.
    return { ok: true, consumed: 1, message: `Shared one food with Bird ${friend.id}. It will stay alongside longer.` };
  }
  step(dt, player, habitat) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.time += dt;
    if (!this._calls.size && !this._friends.size && !this._companion) return;
    this.prune(habitat);
    if (!validPosition(player)) { this._calls.clear(); this.clearCompanion(); return; }
    const steeringDt = Math.min(dt, .1);
    for (const [bird, until] of this._calls) {
      if (bird === this._companion || !validPosition(bird) || distance(player, bird) > 85) continue;
      const id = this.idFor(bird);
      const target = { x: player.x + Math.sin(id * 1.7) * 12, y: player.y + 8 + finite(bird.species) * 4, z: player.z + Math.cos(id * 1.7) * 12 };
      this.steer(bird, player, target, steeringDt, Math.min(1, (until - this.time) / 2), false);
    }
    if (this._companion) {
      const yaw = finite(player.yaw), side = this.companionId % 2 ? 6 : -6;
      const target = { x: player.x + Math.cos(yaw) * side, y: player.y + 2, z: player.z - Math.sin(yaw) * side };
      this.steer(this._companion, player, target, steeringDt, Math.min(1, (this.companionUntil - this.time) / 3), true);
    }
  }
  steer(bird, player, target, dt, weight, companion) {
    target.x = clamp(target.x, -252, 252); target.z = clamp(target.z, -252, 252);
    target.y = clamp(target.y, Math.max(7, terrainHeight(target.x, target.z) + 9), 140);
    const gain = companion ? .8 : .42;
    const follow = companion ? 1 : .35;
    let ax = (target.x - bird.x) * gain + finite(player.vx) * follow - finite(bird.vx);
    let ay = (target.y - bird.y) * gain + finite(player.vy) * follow - finite(bird.vy);
    let az = (target.z - bird.z) * gain + finite(player.vz) * follow - finite(bird.vz);
    const force = Math.hypot(ax, ay, az), limit = companion ? 8 : 4;
    const scale = Math.min(1, limit / (force || 1)) * Math.max(0, weight) * dt;
    let vx = finite(bird.vx) + ax * scale, vy = finite(bird.vy) + ay * scale, vz = finite(bird.vz) + az * scale;
    const speed = Math.hypot(vx, vy, vz), speedScale = speed > 32 ? 32 / speed : 1;
    vx *= speedScale; vy *= speedScale; vz *= speedScale;
    // Guard only the next movement; Habitat remains the sole position integrator.
    vx = clamp(vx, (-260 - bird.x) / dt, (260 - bird.x) / dt);
    vz = clamp(vz, (-260 - bird.z) / dt, (260 - bird.z) / dt);
    const ground = Math.max(7, terrainHeight(bird.x + vx * dt, bird.z + vz * dt) + 7);
    vy = clamp(vy, (ground - bird.y) / dt, (145 - bird.y) / dt);
    bird.vx = vx; bird.vy = vy; bird.vz = vz;
  }
}
