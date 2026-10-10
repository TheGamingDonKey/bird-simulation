import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../advanced/weather.js').catch(() => ({}));
function weather(seed = 42) {
  assert.equal(typeof module.WeatherSystem, 'function', 'WeatherSystem must be implemented');
  return new module.WeatherSystem(seed);
}
function advance(w, seconds) { for (let i = 0; i < seconds * 60; i++) w.step(1 / 60); }

test('mixed fronts move and local rain follows the rain front', () => {
  const w = weather();
  const front = w.fronts.find(f => f.type === 'rain');
  const initial = { x: front.x, z: front.z, intensity: front.intensity };
  assert.ok(w.sample(front.x, front.z).rain > w.sample(250, 240).rain + .25);
  advance(w, 12);
  assert.ok(Math.hypot(front.x - initial.x, front.z - initial.z) > 5);
  assert.notEqual(front.intensity, initial.intensity);
  assert.ok(w.sample(front.x, front.z).rain > w.sample(250, 240).rain + .2);
});

test('mode changes build weather gradually then clear precipitation and clouds', () => {
  const w = weather(); w.setMode('clear'); advance(w, 20);
  const before = w.rain;
  w.setMode('rain');
  assert.equal(w.rain, before);
  w.step(1 / 60);
  assert.ok(w.rain > before && w.rain < .1);
  advance(w, 20);
  assert.ok(w.rain > .7 && w.cloudCover > .75);
  w.setMode('clear'); advance(w, 25);
  assert.ok(w.rain < .02 && w.snow < .02 && w.fog < .05 && w.cloudCover < .2);
  assert.throws(() => w.setMode('volcano'), /weather/i);
});

test('snow and fog modes produce distinct local fields', () => {
  const w = weather(); w.setMode('snow'); advance(w, 20);
  const snow = w.sample(w.fronts[0].x, w.fronts[0].z);
  assert.ok(snow.snow > .6 && snow.rain < .05 && snow.temperature < 2);
  w.setMode('fog'); advance(w, 25);
  assert.ok(w.fog > .7 && w.snow < .02 && w.rain < .02);
});

test('storm flashes pulse and recover reproducibly with stronger changing wind', () => {
  const a = weather(17), b = weather(17);
  a.setMode('storm'); b.setMode('storm');
  let flashed = false, recovered = false;
  const wind = { ...a.wind };
  for (let i = 0; i < 1800; i++) {
    a.step(1 / 60); b.step(1 / 60);
    if (a.lightning > .7) flashed = true;
    if (flashed && a.lightning < .01) recovered = true;
    assert.equal(a.lightning, b.lightning);
  }
  assert.ok(flashed && recovered);
  assert.ok(Math.hypot(a.wind.x, a.wind.z) > 5);
  assert.notDeepEqual(a.wind, wind);
  assert.deepEqual(a.fronts, b.fronts);
});

test('invalid timesteps freeze weather and resetting replays fronts and storm pulses', () => {
  const w = weather();
  const initial = structuredClone(w);
  for (const dt of [0, -1, Infinity, NaN]) w.step(dt);
  assert.deepEqual(structuredClone(w), initial);
  w.setMode('storm'); advance(w, 10); w.reset(42);
  assert.deepEqual(w.fronts, initial.fronts);
  assert.equal(w.time, 0); assert.equal(w.mode, 'mixed');
});
