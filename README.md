# AERIE — living skies

A bird habitat simulation with an early human village, built in two generations.

- **Original: June 3, 2026.** Recovered JavaScript Canvas simulation, preserved byte-for-byte in `original/`. Its three source hashes and verified request/completion timestamps are in `docs/provenance.json`. The old conversation summary says Pygame, but the recovered implementation is a browser simulation.
- **Advanced: October 10, 2026.** A procedural 3D valley with animated birds, three species, flock steering, regional weather, a tent settlement, walking villagers, campfire/smoke, and interactive cameras.

## Run

Install Node.js (no npm packages needed), then double-click `START-SIMULATION.cmd` on Windows. Or run:

```sh
node server.mjs
```

Open http://127.0.0.1:8787/advanced/ for the upgrade, http://127.0.0.1:8787/original/ for the original, or http://127.0.0.1:8787/ for the comparison. The original also opens directly as an HTML file. The advanced edition needs HTTP because it uses JavaScript modules. All runtime dependencies are vendored; internet is not needed.

## Explore

- Drag and scroll to orbit/zoom. Valley and Village frame the landscape; Flock flies alongside one species.
- Change population (60–700), time speed, time of day, and the weather. Living mosaic has simultaneous regional fronts.
- Place food, then click the valley. Birds gather at that location.
- Release a hawk and watch nearby birds flee; recall it with the same button.
- Pause / resume, reset the deterministic habitat, or enable synthesized wind and bird calls.
- Keyboard: Space pauses, H toggles the hawk, R resets, when a form control is not focused.

## Source map

`advanced/model.js` owns deterministic flocking, species, weather forces, food and predator state. `terrain.js` supplies shared ground heights. `world.js` builds and animates the landscape, people, fire and local weather. `bird-view.js` draws wings/body instances; `main.js` owns the renderer, camera and controls. `index.html` and `styles.css` contain the interface. `server.mjs` is a local-only static server.

Run behavioral tests with `node --test tests/*.test.mjs`. These check reproducibility, finite/bounded motion, terrain clearance, and interaction effects. Browser visual checks are documented in `docs/verification.md` when complete.

This is a stylized behavioral simulation, not a scientifically calibrated aerodynamics or ecology model. The original files are intentionally untouched. New publication commits use the actual upload time, while the original creation date is recorded as provenance.

Three.js and OrbitControls retain their upstream MIT license; see `advanced/vendor/LICENSE`. Procedural scenery and synthesized audio need no external asset licenses.
