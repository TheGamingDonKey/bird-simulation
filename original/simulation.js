(function () {
  "use strict";

  const canvas = document.getElementById("simulationCanvas");
  const ctx = canvas.getContext("2d");

  const controls = {
    toggleRun: document.getElementById("toggleRun"),
    resetSim: document.getElementById("resetSim"),
    spawnStorm: document.getElementById("spawnStorm"),
    birdCount: document.getElementById("birdCount"),
    weatherPower: document.getElementById("weatherPower"),
    timeScale: document.getElementById("timeScale"),
    cameraMode: document.getElementById("cameraMode"),
    showWeather: document.getElementById("showWeather"),
    showTrails: document.getElementById("showTrails"),
    slowVillage: document.getElementById("slowVillage"),
    statusLine: document.getElementById("statusLine"),
    flockReadout: document.getElementById("flockReadout"),
    weatherReadout: document.getElementById("weatherReadout"),
    fpsReadout: document.getElementById("fpsReadout"),
  };

  const WORLD = { w: 1920, h: 1080, groundY: 640 };
  const TAU = Math.PI * 2;
  const DPR_LIMIT = 2;

  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let running = true;
  let lastNow = performance.now();
  let simTime = 0;
  let fps = 60;
  let fpsTimer = 0;
  let fpsFrames = 0;
  let weatherSummaryTimer = 0;
  let dominantWeather = "Mixed";

  const camera = {
    x: WORLD.w / 2,
    y: WORLD.h / 2,
    scale: 1,
    targetX: WORLD.w / 2,
    targetY: WORLD.h / 2,
    targetScale: 1,
  };

  const state = {
    birds: [],
    people: [],
    fireParticles: [],
    smokeParticles: [],
    weatherParticles: [],
    extraStorms: [],
    terrainPatches: [],
    trees: [],
    tents: [],
    paths: [],
    pointer: { active: false, x: 0, y: 0, pressure: 0 },
    flockAnchors: [],
  };

  const settings = {
    birds: Number(controls.birdCount.value),
    weather: Number(controls.weatherPower.value) / 100,
    timeScale: Number(controls.timeScale.value) / 100,
  };

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seeded = mulberry32(728393);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function seededRand(min, max) {
    return min + seeded() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function len(x, y) {
    return Math.sqrt(x * x + y * y) || 1;
  }

  function limit2D(vector, max) {
    const length = len(vector.x, vector.y);
    if (length > max) {
      vector.x = (vector.x / length) * max;
      vector.y = (vector.y / length) * max;
    }
  }

  function polygon(points, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  function line(points, stroke, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  function fillCircle(x, y, radius, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  const weatherZones = [
    {
      type: "Clear",
      x: 250,
      y: 300,
      r: 430,
      color: "rgba(242, 191, 101, 0.16)",
      windX: 0.08,
      windY: -0.02,
      lift: 0.08,
      drag: 0.99,
      phase: 0.2,
    },
    {
      type: "Rain",
      x: 780,
      y: 350,
      r: 390,
      color: "rgba(92, 133, 158, 0.2)",
      windX: -0.36,
      windY: 0.08,
      lift: -0.05,
      drag: 0.96,
      phase: 1.7,
    },
    {
      type: "Fog",
      x: 1310,
      y: 555,
      r: 420,
      color: "rgba(190, 200, 185, 0.2)",
      windX: 0.04,
      windY: 0.01,
      lift: -0.02,
      drag: 0.94,
      phase: 2.8,
    },
    {
      type: "Snow",
      x: 1560,
      y: 275,
      r: 360,
      color: "rgba(220, 231, 232, 0.18)",
      windX: -0.18,
      windY: 0.12,
      lift: -0.07,
      drag: 0.95,
      phase: 3.9,
    },
    {
      type: "Wind",
      x: 1040,
      y: 155,
      r: 330,
      color: "rgba(118, 198, 187, 0.17)",
      windX: 0.65,
      windY: -0.03,
      lift: 0.04,
      drag: 0.98,
      phase: 4.6,
    },
  ];

  const birdPalettes = [
    { body: "#20282a", wing: "#151b1d", tip: "#f0ede1", accent: "#c65a43" },
    { body: "#4a4237", wing: "#2f2923", tip: "#d9c49a", accent: "#7fc5be" },
    { body: "#d9d4c6", wing: "#878f8d", tip: "#313736", accent: "#e1a64a" },
    { body: "#292f46", wing: "#181c2c", tip: "#b8d7d2", accent: "#d76b4d" },
  ];

  class Bird {
    constructor(index) {
      this.index = index;
      this.flock = index % 6;
      this.palette = birdPalettes[this.flock % birdPalettes.length];
      this.x = rand(120, WORLD.w - 180);
      this.y = rand(125, 570);
      this.z = rand(45, 195);
      const angle = rand(0, TAU);
      this.vx = Math.cos(angle) * rand(1.1, 2.6);
      this.vy = Math.sin(angle) * rand(0.6, 1.7);
      this.vz = rand(-0.22, 0.22);
      this.speedBias = rand(0.92, 1.22);
      this.turnBias = rand(0.85, 1.18);
      this.wingPhase = rand(0, TAU);
      this.trail = [];
      this.alert = 0;
    }

    update(dt, birds) {
      const neighborRadius = 128;
      const separateRadius = 28;
      const n2 = neighborRadius * neighborRadius;
      const s2 = separateRadius * separateRadius;
      let count = 0;
      let alignX = 0;
      let alignY = 0;
      let cohesionX = 0;
      let cohesionY = 0;
      let separateX = 0;
      let separateY = 0;

      for (let i = 0; i < birds.length; i += 1) {
        const other = birds[i];
        if (other === this) continue;
        const d2 = distSq(this.x, this.y, other.x, other.y);
        if (d2 < n2) {
          const sameFlock = other.flock === this.flock ? 1.25 : 0.66;
          count += sameFlock;
          alignX += other.vx * sameFlock;
          alignY += other.vy * sameFlock;
          cohesionX += other.x * sameFlock;
          cohesionY += other.y * sameFlock;
          if (d2 < s2) {
            const push = (1 - d2 / s2) * sameFlock;
            separateX += (this.x - other.x) * push;
            separateY += (this.y - other.y) * push;
          }
        }
      }

      const accel = { x: 0, y: 0 };
      if (count > 0) {
        alignX /= count;
        alignY /= count;
        cohesionX = cohesionX / count - this.x;
        cohesionY = cohesionY / count - this.y;

        const alignLength = len(alignX, alignY);
        accel.x += (alignX / alignLength - this.vx * 0.16) * 0.03;
        accel.y += (alignY / alignLength - this.vy * 0.16) * 0.03;

        const cohesionLength = len(cohesionX, cohesionY);
        accel.x += (cohesionX / cohesionLength) * 0.034;
        accel.y += (cohesionY / cohesionLength) * 0.034;

        const separateLength = len(separateX, separateY);
        if (separateLength > 1) {
          accel.x += (separateX / separateLength) * 0.15;
          accel.y += (separateY / separateLength) * 0.15;
        }
      }

      const anchor = state.flockAnchors[this.flock];
      const orbit = simTime * (0.08 + this.flock * 0.008) + this.flock * 1.7;
      const targetX = anchor.x + Math.cos(orbit) * anchor.rx;
      const targetY = anchor.y + Math.sin(orbit * 0.83) * anchor.ry;
      const homeX = targetX - this.x;
      const homeY = targetY - this.y;
      const homeLength = len(homeX, homeY);
      accel.x += (homeX / homeLength) * 0.032;
      accel.y += (homeY / homeLength) * 0.032;

      const weather = sampleWeather(this.x, this.y);
      accel.x += weather.windX * 0.035 * settings.weather;
      accel.y += weather.windY * 0.02 * settings.weather;
      this.vz += weather.lift * 0.006 * settings.weather;

      for (let i = state.extraStorms.length - 1; i >= 0; i -= 1) {
        const storm = state.extraStorms[i];
        const d2 = distSq(this.x, this.y, storm.x, storm.y);
        if (d2 < storm.r * storm.r) {
          const d = Math.sqrt(d2) || 1;
          const pull = (1 - d / storm.r) * 0.12;
          accel.x += ((this.x - storm.x) / d) * pull + storm.windX * 0.022;
          accel.y += ((this.y - storm.y) / d) * pull + storm.windY * 0.016;
          this.alert = Math.max(this.alert, pull * 8);
        }
      }

      if (state.pointer.active) {
        const d2 = distSq(this.x, this.y, state.pointer.x, state.pointer.y);
        if (d2 < 180 * 180) {
          const d = Math.sqrt(d2) || 1;
          const push = (1 - d / 180) * state.pointer.pressure * 0.22;
          accel.x += ((this.x - state.pointer.x) / d) * push;
          accel.y += ((this.y - state.pointer.y) / d) * push;
          this.alert = Math.max(this.alert, push * 5);
        }
      }

      if (this.x < 80) accel.x += 0.09;
      if (this.x > WORLD.w - 80) accel.x -= 0.09;
      if (this.y < 80) accel.y += 0.08;
      if (this.y > WORLD.groundY - 70) accel.y -= 0.12;

      this.vx = (this.vx + accel.x * dt * 60) * lerp(1, weather.drag, settings.weather);
      this.vy = (this.vy + accel.y * dt * 60) * lerp(1, weather.drag, settings.weather);
      this.vz += (Math.sin(simTime * 0.7 + this.index) * 0.004 - (this.z - 110) * 0.00018) * dt * 60;

      const maxSpeed = 4.2 * this.speedBias + this.alert * 0.18;
      const minSpeed = 1.25 * this.speedBias;
      const speed = len(this.vx, this.vy);
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      } else if (speed < minSpeed) {
        this.vx = (this.vx / speed) * minSpeed;
        this.vy = (this.vy / speed) * minSpeed;
      }

      this.x += this.vx * dt * 60;
      this.y += this.vy * dt * 60;
      this.z = clamp(this.z + this.vz * dt * 60, 24, 230);
      this.alert = Math.max(0, this.alert - dt * 1.8);
      this.wingPhase += (9.5 + speed * 1.7 + this.alert) * dt * this.turnBias;

      this.trail.push({ x: this.x, y: this.y - this.z * 0.34, z: this.z });
      if (this.trail.length > 12) this.trail.shift();
    }

    drawTrail() {
      if (this.trail.length < 3 || !controls.showTrails.checked) return;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 1; i < this.trail.length; i += 1) {
        const a = this.trail[i - 1];
        const b = this.trail[i];
        ctx.globalAlpha = (i / this.trail.length) * 0.18;
        ctx.strokeStyle = this.palette.tip;
        ctx.lineWidth = 0.7 + (a.z / 220) * 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    draw() {
      const px = this.x;
      const py = this.y - this.z * 0.34;
      const angle = Math.atan2(this.vy, this.vx);
      const speed = len(this.vx, this.vy);
      const scale = 0.52 + this.z / 210 + clamp(speed - 2, 0, 3) * 0.06;
      const flap = Math.sin(this.wingPhase);
      const wingLift = (5 + flap * 5) * scale;
      const wingSpan = (13 + Math.abs(flap) * 8) * scale;
      const body = 6.8 * scale;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);

      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#07100e";
      ctx.beginPath();
      ctx.ellipse(0, this.z * 0.34 + 18, body * 2, body * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      polygon(
        [
          [-body * 0.5, 0],
          [-wingSpan, -wingLift],
          [body * 0.5, -1],
          [-wingSpan * 0.35, wingLift * 0.2],
        ],
        this.alert > 0.2 ? this.palette.accent : this.palette.wing
      );
      polygon(
        [
          [-body * 0.5, 0],
          [-wingSpan, wingLift],
          [body * 0.5, 1],
          [-wingSpan * 0.35, -wingLift * 0.2],
        ],
        this.palette.wing
      );
      polygon(
        [
          [-body, -body * 0.48],
          [body * 1.45, 0],
          [-body, body * 0.48],
          [-body * 0.2, 0],
        ],
        this.palette.body
      );
      polygon(
        [
          [body * 1.3, 0],
          [body * 1.95, -body * 0.24],
          [body * 1.95, body * 0.24],
        ],
        this.palette.tip
      );
      polygon(
        [
          [-body * 0.85, -body * 0.35],
          [-body * 1.75, 0],
          [-body * 0.85, body * 0.35],
        ],
        this.palette.accent
      );
      ctx.restore();
    }
  }

  class Person {
    constructor(route, offset) {
      this.route = route;
      this.index = Math.floor(offset % route.length);
      this.x = route[this.index].x;
      this.y = route[this.index].y;
      this.speed = rand(10, 20);
      this.phase = rand(0, TAU);
      this.pause = rand(0, 2);
      this.color = ["#49372d", "#604432", "#7e5438", "#2e332d", "#8c6f4d"][
        Math.floor(rand(0, 5))
      ];
      this.wrap = rand(0, 1) > 0.5;
    }

    update(dt) {
      const speedScale = controls.slowVillage.checked ? 0.38 : 1;
      if (this.pause > 0) {
        this.pause -= dt * speedScale;
        return;
      }
      const next = this.route[(this.index + 1) % this.route.length];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const distance = len(dx, dy);
      const step = this.speed * speedScale * dt;
      if (distance <= step) {
        this.x = next.x;
        this.y = next.y;
        this.index = (this.index + 1) % this.route.length;
        this.pause = rand(0.2, 1.6);
      } else {
        this.x += (dx / distance) * step;
        this.y += (dy / distance) * step;
      }
      this.phase += dt * 7 * speedScale;
    }

    draw() {
      const s = 0.92;
      const bob = Math.sin(this.phase) * 1.2;
      const leg = Math.sin(this.phase) * 3.5;
      ctx.save();
      ctx.translate(this.x, this.y + bob);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#201912";
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(0, 13, 8, 3, 0, 0, TAU);
      ctx.fillStyle = "#0c0a07";
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, 2 * s);
      ctx.lineTo(0, 13 * s);
      ctx.stroke();
      ctx.strokeStyle = "#251b14";
      ctx.beginPath();
      ctx.moveTo(0, 7 * s);
      ctx.lineTo(-5 * s, 10 * s + leg * 0.2);
      ctx.moveTo(0, 7 * s);
      ctx.lineTo(5 * s, 10 * s - leg * 0.2);
      ctx.moveTo(0, 13 * s);
      ctx.lineTo(-3 * s, 19 * s + leg);
      ctx.moveTo(0, 13 * s);
      ctx.lineTo(4 * s, 19 * s - leg);
      ctx.stroke();
      fillCircle(0, -2 * s, 3.5 * s, "#7a5139");
      ctx.restore();
    }
  }

  function createWorld() {
    state.terrainPatches.length = 0;
    state.trees.length = 0;
    state.tents.length = 0;
    state.paths.length = 0;

    for (let i = 0; i < 88; i += 1) {
      const x = seededRand(0, WORLD.w);
      const y = seededRand(WORLD.groundY + 16, WORLD.h);
      const size = seededRand(38, 132);
      const hue = seededRand(0, 1);
      state.terrainPatches.push({
        points: [
          [x, y],
          [x + seededRand(size * 0.45, size), y + seededRand(-28, 24)],
          [x + seededRand(size * 0.4, size * 1.25), y + seededRand(28, 86)],
          [x - seededRand(20, size * 0.5), y + seededRand(22, 90)],
        ],
        color:
          hue < 0.32
            ? `rgba(${72 + seededRand(0, 18)}, ${111 + seededRand(0, 34)}, ${73 + seededRand(0, 18)}, 0.38)`
            : hue < 0.58
              ? `rgba(${126 + seededRand(0, 26)}, ${122 + seededRand(0, 24)}, ${76 + seededRand(0, 15)}, 0.3)`
              : `rgba(${73 + seededRand(0, 20)}, ${93 + seededRand(0, 18)}, ${72 + seededRand(0, 16)}, 0.27)`,
      });
    }

    for (let i = 0; i < 160; i += 1) {
      const x = seededRand(20, WORLD.w - 20);
      const y = seededRand(WORLD.groundY + 20, WORLD.h - 30);
      const nearVillage = x > 1240 && x < 1760 && y > 720 && y < 975;
      if (nearVillage && seeded() > 0.3) continue;
      state.trees.push({
        x,
        y,
        s: seededRand(0.65, 1.7),
        c1: seeded() > 0.6 ? "#385b40" : "#2f4d38",
        c2: seeded() > 0.5 ? "#4d7046" : "#516c37",
      });
    }

    const tentBase = [
      { x: 1410, y: 803, s: 1.16, color: "#ad7f55" },
      { x: 1548, y: 818, s: 0.92, color: "#c99d6a" },
      { x: 1312, y: 858, s: 0.82, color: "#8b684b" },
      { x: 1645, y: 882, s: 1.06, color: "#b58b5f" },
      { x: 1485, y: 923, s: 0.78, color: "#6f5c42" },
    ];
    state.tents.push(...tentBase);

    state.paths.push(
      [
        { x: 1230, y: 905 },
        { x: 1345, y: 866 },
        { x: 1468, y: 868 },
        { x: 1570, y: 900 },
        { x: 1718, y: 855 },
      ],
      [
        { x: 1455, y: 790 },
        { x: 1490, y: 858 },
        { x: 1486, y: 920 },
        { x: 1430, y: 974 },
        { x: 1340, y: 942 },
      ],
      [
        { x: 1610, y: 783 },
        { x: 1562, y: 854 },
        { x: 1488, y: 868 },
        { x: 1397, y: 834 },
        { x: 1310, y: 858 },
      ]
    );
  }

  function createFlockAnchors() {
    state.flockAnchors = [
      { x: 340, y: 310, rx: 170, ry: 110 },
      { x: 720, y: 245, rx: 220, ry: 105 },
      { x: 1060, y: 340, rx: 190, ry: 135 },
      { x: 1375, y: 260, rx: 240, ry: 130 },
      { x: 1590, y: 420, rx: 155, ry: 95 },
      { x: 965, y: 510, rx: 280, ry: 70 },
    ];
  }

  function createBirds(count) {
    state.birds.length = 0;
    for (let i = 0; i < count; i += 1) {
      state.birds.push(new Bird(i));
    }
  }

  function resizeBirds(targetCount) {
    const current = state.birds.length;
    if (targetCount > current) {
      for (let i = current; i < targetCount; i += 1) {
        state.birds.push(new Bird(i));
      }
    } else {
      state.birds.length = targetCount;
    }
  }

  function createPeople() {
    state.people.length = 0;
    const routes = state.paths.map((path) => path.map((p) => ({ x: p.x, y: p.y })));
    for (let i = 0; i < 16; i += 1) {
      state.people.push(new Person(routes[i % routes.length], i * 0.7));
    }
  }

  function createWeatherParticles() {
    state.weatherParticles.length = 0;
    for (let i = 0; i < 520; i += 1) {
      const zoneIndex = Math.floor(rand(1, weatherZones.length));
      const zone = weatherZones[zoneIndex];
      const angle = rand(0, TAU);
      const radius = Math.sqrt(rand(0, 1)) * zone.r;
      state.weatherParticles.push({
        zoneIndex,
        x: zone.x + Math.cos(angle) * radius,
        y: zone.y + Math.sin(angle) * radius,
        speed: rand(80, 240),
        drift: rand(-20, 35),
        size: rand(0.6, 2.2),
        seed: rand(0, TAU),
      });
    }
  }

  function resetSimulation() {
    simTime = 0;
    createWorld();
    createFlockAnchors();
    createBirds(settings.birds);
    createPeople();
    createWeatherParticles();
    state.fireParticles.length = 0;
    state.smokeParticles.length = 0;
    state.extraStorms.length = 0;
    camera.x = WORLD.w / 2;
    camera.y = WORLD.h / 2;
    controls.statusLine.textContent = "Habitat reset";
  }

  function sampleWeather(x, y) {
    let total = 0;
    let windX = 0;
    let windY = 0;
    let lift = 0;
    let drag = 1;
    let topType = "Clear";
    let topWeight = 0;

    for (const zone of weatherZones) {
      const wobbleX = Math.sin(simTime * 0.035 + zone.phase) * 34;
      const wobbleY = Math.cos(simTime * 0.027 + zone.phase) * 20;
      const dx = x - (zone.x + wobbleX);
      const dy = y - (zone.y + wobbleY);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const weight = clamp(1 - distance / zone.r, 0, 1);
      if (weight <= 0) continue;
      const shaped = weight * weight;
      total += shaped;
      windX += zone.windX * shaped;
      windY += zone.windY * shaped;
      lift += zone.lift * shaped;
      drag *= lerp(1, zone.drag, shaped);
      if (shaped > topWeight) {
        topWeight = shaped;
        topType = zone.type;
      }
    }

    for (const storm of state.extraStorms) {
      const distance = Math.sqrt(distSq(x, y, storm.x, storm.y));
      const weight = clamp(1 - distance / storm.r, 0, 1) * storm.strength;
      if (weight > 0) {
        windX += storm.windX * weight;
        windY += storm.windY * weight;
        lift -= 0.1 * weight;
        drag *= lerp(1, 0.92, weight);
        if (weight > topWeight) {
          topWeight = weight;
          topType = "Storm";
        }
      }
    }

    if (total > 0) {
      windX /= Math.max(1, total);
      windY /= Math.max(1, total);
      lift /= Math.max(1, total);
    }

    return { windX, windY, lift, drag, type: topType, weight: topWeight };
  }

  function updateWorld(dt) {
    if (!running) return;
    const scaledDt = dt * settings.timeScale;
    simTime += scaledDt;

    for (const bird of state.birds) {
      bird.update(scaledDt, state.birds);
    }

    for (const person of state.people) {
      person.update(scaledDt);
    }

    updateVillageParticles(scaledDt);
    updateWeatherParticles(scaledDt);
    updateStorms(scaledDt);
    updateCamera(scaledDt);
    updateReadouts(scaledDt);
  }

  function updateStorms(dt) {
    for (let i = state.extraStorms.length - 1; i >= 0; i -= 1) {
      const storm = state.extraStorms[i];
      storm.ttl -= dt;
      storm.x += storm.windX * dt * 22;
      storm.y += Math.sin(simTime * 0.7 + storm.phase) * dt * 8;
      storm.strength = clamp(storm.ttl / storm.life, 0, 1);
      if (storm.ttl <= 0) state.extraStorms.splice(i, 1);
    }
  }

  function updateVillageParticles(dt) {
    const fireX = 1504;
    const fireY = 868;
    const fireRate = controls.slowVillage.checked ? 4 : 8;
    for (let i = 0; i < fireRate; i += 1) {
      if (Math.random() < 0.8) {
        state.fireParticles.push({
          x: fireX + rand(-6, 6),
          y: fireY + rand(-4, 3),
          vx: rand(-8, 8),
          vy: rand(-34, -12),
          life: rand(0.32, 0.78),
          maxLife: 1,
          size: rand(2, 6),
          color: Math.random() > 0.46 ? "#f4b44a" : "#dc5f3c",
        });
      }
    }
    if (Math.random() < 0.55) {
      state.smokeParticles.push({
        x: fireX + rand(-4, 4),
        y: fireY - 14 + rand(-2, 2),
        vx: rand(-10, 11),
        vy: rand(-18, -7),
        life: rand(2.2, 4.2),
        maxLife: 4.2,
        size: rand(8, 18),
        drift: rand(-0.3, 0.3),
      });
    }

    for (let i = state.fireParticles.length - 1; i >= 0; i -= 1) {
      const p = state.fireParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
      p.size *= 0.985;
      if (p.life <= 0) state.fireParticles.splice(i, 1);
    }

    for (let i = state.smokeParticles.length - 1; i >= 0; i -= 1) {
      const p = state.smokeParticles[i];
      p.life -= dt;
      p.x += (p.vx + Math.sin(simTime + p.drift) * 12) * dt;
      p.y += p.vy * dt;
      p.size += 6 * dt;
      if (p.life <= 0) state.smokeParticles.splice(i, 1);
    }
  }

  function updateWeatherParticles(dt) {
    const power = settings.weather;
    for (const p of state.weatherParticles) {
      const zone = weatherZones[p.zoneIndex];
      const wobbleX = Math.sin(simTime * 0.035 + zone.phase) * 34;
      const wobbleY = Math.cos(simTime * 0.027 + zone.phase) * 20;
      const cx = zone.x + wobbleX;
      const cy = zone.y + wobbleY;

      if (zone.type === "Rain") {
        p.x += (zone.windX * 80 + p.drift) * dt * power;
        p.y += p.speed * dt * power;
      } else if (zone.type === "Snow") {
        p.x += (Math.sin(simTime + p.seed) * 34 + zone.windX * 45) * dt * power;
        p.y += p.speed * 0.28 * dt * power;
      } else if (zone.type === "Fog") {
        p.x += (zone.windX * 18 + Math.sin(simTime * 0.2 + p.seed) * 5) * dt * power;
        p.y += Math.cos(simTime * 0.3 + p.seed) * 3 * dt;
      } else if (zone.type === "Wind") {
        p.x += zone.windX * 110 * dt * power;
        p.y += Math.sin(simTime * 1.6 + p.seed) * 20 * dt;
      }

      if (distSq(p.x, p.y, cx, cy) > zone.r * zone.r || p.y > WORLD.groundY + 80) {
        const angle = rand(0, TAU);
        const radius = Math.sqrt(rand(0, 1)) * zone.r * 0.88;
        p.x = cx + Math.cos(angle) * radius;
        p.y = cy - zone.r * 0.55 + Math.sin(angle) * radius * 0.3;
      }
    }
  }

  function updateCamera(dt) {
    const base = Math.max(cssW / WORLD.w, cssH / WORLD.h);
    let targetX = WORLD.w / 2;
    let targetY = WORLD.h / 2;
    let targetScale = base;

    if (controls.cameraMode.value === "follow" && state.birds.length) {
      let x = 0;
      let y = 0;
      for (const bird of state.birds) {
        x += bird.x;
        y += bird.y - bird.z * 0.2;
      }
      targetX = x / state.birds.length;
      targetY = y / state.birds.length;
      targetScale = base * 1.42;
    } else if (controls.cameraMode.value === "village") {
      targetX = 1495;
      targetY = 835;
      targetScale = base * 1.55;
    }

    camera.targetScale = targetScale;
    camera.scale = lerp(camera.scale || base, camera.targetScale, clamp(dt * 2.5, 0, 1));
    const halfW = cssW / camera.scale / 2;
    const halfH = cssH / camera.scale / 2;
    camera.targetX = clamp(targetX, halfW, WORLD.w - halfW);
    camera.targetY = clamp(targetY, halfH, WORLD.h - halfH);
    if (halfW > WORLD.w / 2) camera.targetX = WORLD.w / 2;
    if (halfH > WORLD.h / 2) camera.targetY = WORLD.h / 2;
    camera.x = lerp(camera.x, camera.targetX, clamp(dt * 2.8, 0, 1));
    camera.y = lerp(camera.y, camera.targetY, clamp(dt * 2.8, 0, 1));
  }

  function updateReadouts(dt) {
    fpsTimer += dt;
    fpsFrames += 1;
    if (fpsTimer >= 0.35) {
      fps = Math.round(fpsFrames / fpsTimer);
      controls.fpsReadout.textContent = String(fps);
      fpsTimer = 0;
      fpsFrames = 0;
    }

    weatherSummaryTimer += dt;
    if (weatherSummaryTimer >= 0.8) {
      const counts = {};
      for (const bird of state.birds) {
        const type = sampleWeather(bird.x, bird.y).type;
        counts[type] = (counts[type] || 0) + 1;
      }
      dominantWeather = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed";
      controls.weatherReadout.textContent = dominantWeather;
      controls.flockReadout.textContent = String(new Set(state.birds.map((bird) => bird.flock)).size);
      controls.statusLine.textContent = `${state.birds.length} birds | ${dominantWeather.toLowerCase()} flight`;
      weatherSummaryTimer = 0;
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawSky();

    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    drawFarMountains();
    if (controls.showWeather.checked) drawWeatherFields();
    drawWeatherAtmosphere();
    drawTerrain();
    drawVillageBack();
    drawWeatherParticles();
    for (const bird of state.birds) bird.drawTrail();
    const sortedBirds = state.birds.slice().sort((a, b) => a.z - b.z);
    for (const bird of sortedBirds) bird.draw();
    drawVillageFront();

    ctx.restore();
    drawVignette();
  }

  function drawSky() {
    const dayPhase = (Math.sin(simTime * 0.025 - 0.7) + 1) / 2;
    const topDay = [105, 169, 194];
    const midDay = [185, 204, 177];
    const topDusk = [49, 70, 90];
    const midDusk = [188, 126, 92];
    const top = topDay.map((v, i) => Math.round(lerp(topDusk[i], v, dayPhase)));
    const mid = midDay.map((v, i) => Math.round(lerp(midDusk[i], v, dayPhase)));
    const gradient = ctx.createLinearGradient(0, 0, 0, cssH);
    gradient.addColorStop(0, `rgb(${top[0]}, ${top[1]}, ${top[2]})`);
    gradient.addColorStop(0.55, `rgb(${mid[0]}, ${mid[1]}, ${mid[2]})`);
    gradient.addColorStop(1, "#6e845e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.globalAlpha = 0.14 + dayPhase * 0.14;
    for (let i = 0; i < 42; i += 1) {
      const x = ((i * 173 + simTime * 2.5) % (cssW + 120)) - 60;
      const y = 40 + ((i * 47) % Math.max(160, cssH * 0.46));
      ctx.fillStyle = i % 2 ? "#f8f3db" : "#b9d5d5";
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.restore();
  }

  function drawFarMountains() {
    polygon(
      [
        [0, 510],
        [120, 385],
        [260, 470],
        [420, 320],
        [630, 506],
        [790, 350],
        [980, 496],
        [1160, 330],
        [1390, 505],
        [1650, 340],
        [1920, 515],
        [1920, 710],
        [0, 710],
      ],
      "#62766c"
    );
    polygon(
      [
        [0, 550],
        [175, 430],
        [330, 520],
        [520, 390],
        [720, 542],
        [910, 420],
        [1110, 555],
        [1330, 420],
        [1510, 548],
        [1740, 435],
        [1920, 548],
        [1920, 715],
        [0, 715],
      ],
      "#495e58"
    );

    ctx.save();
    ctx.globalAlpha = 0.5;
    polygon(
      [
        [355, 350],
        [420, 320],
        [489, 382],
        [437, 365],
        [405, 386],
      ],
      "#dfe4d8"
    );
    polygon(
      [
        [1100, 382],
        [1160, 330],
        [1248, 396],
        [1182, 382],
        [1148, 410],
      ],
      "#dfe4d8"
    );
    polygon(
      [
        [1588, 388],
        [1650, 340],
        [1730, 392],
        [1668, 385],
        [1634, 410],
      ],
      "#dfe4d8"
    );
    ctx.restore();
  }

  function drawTerrain() {
    polygon(
      [
        [0, WORLD.groundY - 15],
        [300, WORLD.groundY - 42],
        [650, WORLD.groundY + 5],
        [940, WORLD.groundY - 28],
        [1220, WORLD.groundY + 7],
        [1540, WORLD.groundY - 40],
        [1920, WORLD.groundY - 6],
        [1920, WORLD.h],
        [0, WORLD.h],
      ],
      "#566f45"
    );

    polygon(
      [
        [0, 774],
        [210, 760],
        [430, 785],
        [720, 748],
        [1015, 796],
        [1280, 766],
        [1640, 786],
        [1920, 750],
        [1920, WORLD.h],
        [0, WORLD.h],
      ],
      "#6f8a51"
    );

    const river = [
      [0, 922],
      [200, 887],
      [380, 916],
      [565, 970],
      [830, 950],
      [1010, 998],
      [1275, 1015],
      [1500, 978],
      [1920, 1018],
      [1920, WORLD.h],
      [0, WORLD.h],
    ];
    polygon(river, "#527b86");
    polygon(
      [
        [0, 958],
        [225, 916],
        [370, 948],
        [565, 1007],
        [825, 982],
        [1015, 1034],
        [1280, 1047],
        [1508, 1012],
        [1920, 1048],
        [1920, WORLD.h],
        [0, WORLD.h],
      ],
      "rgba(156, 196, 187, 0.28)"
    );

    for (const patch of state.terrainPatches) polygon(patch.points, patch.color);

    drawPaths();
    for (const tree of state.trees) drawTree(tree);
  }

  function drawPaths() {
    for (const path of state.paths) {
      line(
        path.map((p) => [p.x, p.y]),
        "rgba(128, 104, 72, 0.48)",
        18,
        1
      );
      line(
        path.map((p) => [p.x, p.y]),
        "rgba(207, 182, 129, 0.34)",
        8,
        1
      );
    }
  }

  function drawTree(tree) {
    const { x, y, s } = tree;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    polygon(
      [
        [-3, 5],
        [3, 5],
        [5, 28],
        [-5, 28],
      ],
      "#4a3124"
    );
    polygon(
      [
        [0, -28],
        [24, 14],
        [5, 8],
        [18, 32],
        [0, 23],
        [-18, 32],
        [-5, 8],
        [-24, 14],
      ],
      tree.c1
    );
    polygon(
      [
        [0, -20],
        [12, 11],
        [0, 5],
        [-14, 12],
      ],
      tree.c2
    );
    ctx.restore();
  }

  function drawVillageBack() {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#4c3e2c";
    ctx.beginPath();
    ctx.ellipse(1500, 890, 330, 126, -0.04, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#1f170f";
    ctx.beginPath();
    ctx.ellipse(1505, 902, 230, 82, -0.03, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (const tent of state.tents) {
      drawTent(tent);
    }
    drawWoodRack(1574, 840);
    drawWoodRack(1382, 894);
  }

  function drawVillageFront() {
    drawSmoke();
    drawFirePit();
    for (const person of state.people) person.draw();
    drawFence();
  }

  function drawTent(tent) {
    const x = tent.x;
    const y = tent.y;
    const s = tent.s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#0b0805";
    ctx.beginPath();
    ctx.ellipse(0, 46, 62, 14, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    polygon(
      [
        [-62, 42],
        [0, -70],
        [65, 42],
      ],
      tent.color,
      "rgba(36, 25, 17, 0.48)",
      2
    );
    polygon(
      [
        [-62, 42],
        [0, -70],
        [-6, 42],
      ],
      "rgba(62, 44, 31, 0.36)"
    );
    polygon(
      [
        [-6, 42],
        [0, -70],
        [65, 42],
      ],
      "rgba(237, 196, 127, 0.18)"
    );
    polygon(
      [
        [-18, 42],
        [0, -6],
        [18, 42],
      ],
      "#2c2119"
    );
    ctx.strokeStyle = "#3c2c20";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -75);
    ctx.lineTo(0, 46);
    ctx.moveTo(-60, 43);
    ctx.lineTo(65, 43);
    ctx.stroke();
    ctx.restore();
  }

  function drawWoodRack(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#4c3424";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-20 + i * 8, 12);
      ctx.lineTo(18 - i * 3, -10 + i * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFirePit() {
    const x = 1504;
    const y = 868;
    ctx.save();
    polygon(
      [
        [x - 27, y + 10],
        [x - 8, y - 2],
        [x + 18, y - 4],
        [x + 34, y + 10],
        [x + 13, y + 22],
        [x - 20, y + 20],
      ],
      "#4e4134"
    );
    for (const p of state.fireParticles) {
      const alpha = clamp(p.life / 0.75, 0, 1);
      ctx.globalAlpha = alpha;
      polygon(
        [
          [p.x, p.y - p.size * 1.9],
          [p.x + p.size, p.y],
          [p.x, p.y + p.size],
          [p.x - p.size, p.y],
        ],
        p.color
      );
    }
    ctx.globalAlpha = 0.72;
    polygon(
      [
        [x, y - 32],
        [x + 12, y - 4],
        [x + 2, y + 9],
        [x - 13, y + 1],
      ],
      "#ffe08d"
    );
    ctx.restore();
  }

  function drawSmoke() {
    ctx.save();
    for (const p of state.smokeParticles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1) * 0.28;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#d1d2c8";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.78, p.size, Math.sin(p.drift) * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFence() {
    ctx.save();
    ctx.strokeStyle = "rgba(65, 43, 28, 0.72)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const posts = [
      [1265, 925],
      [1298, 915],
      [1338, 910],
      [1695, 902],
      [1730, 892],
      [1764, 880],
    ];
    for (const [x, y] of posts) {
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y + 12);
      ctx.stroke();
    }
    line(
      [
        [1265, 912],
        [1338, 898],
      ],
      "rgba(65, 43, 28, 0.72)",
      3,
      1
    );
    line(
      [
        [1695, 889],
        [1764, 868],
      ],
      "rgba(65, 43, 28, 0.72)",
      3,
      1
    );
    ctx.restore();
  }

  function drawWeatherFields() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const zone of weatherZones) {
      const wobbleX = Math.sin(simTime * 0.035 + zone.phase) * 34;
      const wobbleY = Math.cos(simTime * 0.027 + zone.phase) * 20;
      ctx.globalAlpha = settings.weather;
      ctx.fillStyle = zone.color;
      ctx.beginPath();
      ctx.ellipse(zone.x + wobbleX, zone.y + wobbleY, zone.r * 1.1, zone.r * 0.72, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = settings.weather * 0.55;
      ctx.strokeStyle = zone.color.replace("0.", "0.");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(zone.x + wobbleX, zone.y + wobbleY, zone.r * 1.1, zone.r * 0.72, 0, 0, TAU);
      ctx.stroke();
    }
    for (const storm of state.extraStorms) {
      ctx.globalAlpha = storm.strength * 0.42;
      ctx.fillStyle = "rgba(58, 62, 72, 0.7)";
      ctx.beginPath();
      ctx.ellipse(storm.x, storm.y, storm.r * 1.15, storm.r * 0.68, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWeatherAtmosphere() {
    ctx.save();
    ctx.globalAlpha = settings.weather * 0.36;

    for (const zone of weatherZones) {
      const wobbleX = Math.sin(simTime * 0.035 + zone.phase) * 34;
      const wobbleY = Math.cos(simTime * 0.027 + zone.phase) * 20;
      const x = zone.x + wobbleX;
      const y = zone.y + wobbleY;
      if (zone.type === "Fog") {
        for (let i = 0; i < 9; i += 1) {
          const bandY = y - 130 + i * 36 + Math.sin(simTime * 0.25 + i) * 10;
          line(
            [
              [x - zone.r * 0.9, bandY],
              [x - zone.r * 0.2, bandY - 12],
              [x + zone.r * 0.8, bandY + 8],
            ],
            "rgba(223, 226, 215, 0.4)",
            24,
            1
          );
        }
      } else if (zone.type === "Wind") {
        for (let i = 0; i < 8; i += 1) {
          const bandY = y - 160 + i * 46;
          const offset = (simTime * 60 + i * 65) % 420;
          line(
            [
              [x - 250 + offset, bandY],
              [x - 170 + offset, bandY - 12],
              [x - 80 + offset, bandY + 2],
            ],
            "rgba(201, 238, 226, 0.36)",
            3,
            1
          );
        }
      } else if (zone.type === "Rain" || zone.type === "Snow") {
        ctx.fillStyle = zone.type === "Rain" ? "rgba(55, 72, 84, 0.22)" : "rgba(225, 235, 237, 0.2)";
        for (let i = 0; i < 7; i += 1) {
          ctx.beginPath();
          ctx.ellipse(x - 180 + i * 58, y - 180 + Math.sin(i + simTime) * 12, 90, 38, 0, 0, TAU);
          ctx.fill();
        }
      }
    }

    for (const storm of state.extraStorms) {
      ctx.globalAlpha = storm.strength * settings.weather * 0.5;
      ctx.fillStyle = "rgba(31, 34, 40, 0.78)";
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.ellipse(
          storm.x - 230 + i * 70 + Math.sin(simTime + i) * 8,
          storm.y - 130 + Math.cos(simTime * 0.7 + i) * 18,
          100,
          42,
          0,
          0,
          TAU
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawWeatherParticles() {
    if (settings.weather <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = settings.weather;
    for (const p of state.weatherParticles) {
      const zone = weatherZones[p.zoneIndex];
      if (zone.type === "Rain") {
        ctx.strokeStyle = "rgba(168, 201, 214, 0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 10, p.y + 22);
        ctx.stroke();
      } else if (zone.type === "Snow") {
        fillCircle(p.x, p.y, p.size, "rgba(239, 245, 243, 0.78)", 1);
      } else if (zone.type === "Fog") {
        ctx.strokeStyle = "rgba(224, 226, 218, 0.16)";
        ctx.lineWidth = p.size * 6;
        ctx.beginPath();
        ctx.moveTo(p.x - 26, p.y);
        ctx.lineTo(p.x + 26, p.y + Math.sin(simTime + p.seed) * 3);
        ctx.stroke();
      } else if (zone.type === "Wind") {
        ctx.strokeStyle = "rgba(209, 245, 232, 0.28)";
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - 20, p.y);
        ctx.lineTo(p.x + 35, p.y + Math.sin(p.seed + simTime) * 3);
        ctx.stroke();
      }
    }

    for (const storm of state.extraStorms) {
      ctx.globalAlpha = storm.strength * settings.weather;
      for (let i = 0; i < 90; i += 1) {
        const offset = (i * 43 + simTime * 220) % (storm.r * 1.8);
        const x = storm.x - storm.r * 0.9 + offset;
        const y = storm.y - storm.r * 0.4 + ((i * 67) % storm.r);
        ctx.strokeStyle = "rgba(155, 184, 197, 0.5)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 18, y + 34);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(cssW / 2, cssH * 0.52, cssH * 0.1, cssW / 2, cssH / 2, cssH * 0.9);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.24)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function spawnStorm() {
    state.extraStorms.push({
      x: rand(500, 1550),
      y: rand(160, 460),
      r: rand(210, 330),
      windX: rand(-0.95, 0.95),
      windY: rand(0.1, 0.55),
      life: rand(18, 28),
      ttl: rand(18, 28),
      strength: 1,
      phase: rand(0, TAU),
    });
    controls.statusLine.textContent = "Storm cell formed";
  }

  function screenToWorld(screenX, screenY) {
    return {
      x: camera.x + (screenX - cssW / 2) / camera.scale,
      y: camera.y + (screenY - cssH / 2) / camera.scale,
    };
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    state.pointer.pressure = event.buttons ? 1.5 : 0.55;
    state.pointer.active = true;
  }

  function onPointerLeave() {
    state.pointer.active = false;
  }

  function resize() {
    dpr = Math.min(DPR_LIMIT, window.devicePixelRatio || 1);
    cssW = Math.max(1, window.innerWidth);
    cssH = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const base = Math.max(cssW / WORLD.w, cssH / WORLD.h);
    camera.scale = camera.scale || base;
    updateCamera(1);
  }

  function tick(now) {
    const rawDt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
    lastNow = now;
    settings.weather = Number(controls.weatherPower.value) / 100;
    settings.timeScale = Number(controls.timeScale.value) / 100;
    updateWorld(rawDt);
    render();
    requestAnimationFrame(tick);
  }

  controls.toggleRun.addEventListener("click", () => {
    running = !running;
    controls.toggleRun.textContent = running ? "Pause" : "Resume";
    controls.statusLine.textContent = running ? "Simulation running" : "Simulation paused";
  });

  controls.resetSim.addEventListener("click", () => {
    settings.birds = Number(controls.birdCount.value);
    resetSimulation();
  });

  controls.spawnStorm.addEventListener("click", spawnStorm);

  controls.birdCount.addEventListener("input", () => {
    settings.birds = Number(controls.birdCount.value);
    resizeBirds(settings.birds);
    controls.statusLine.textContent = `${settings.birds} birds active`;
  });

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerup", () => {
    state.pointer.pressure = 0.55;
  });

  resize();
  resetSimulation();
  requestAnimationFrame(tick);
})();
