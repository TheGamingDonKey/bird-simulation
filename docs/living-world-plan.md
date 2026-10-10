# Implementation plan

Goal: publish the two dated editions, then expand their interactive living world.
Architecture: independent weather, villagers, navigation and atmosphere modules integrated by main.js.
Spec: living-world-design.md.

- [ ] Publish archived original and first advanced version; verify source hashes and repository paths.
- [ ] Weather/flight specialist implements WeatherSystem and freer species movement with behavioral tests.
- [ ] Village/world specialist implements villagers reacting to weather/actions, dry-bank navigation and shadow-ready scenery.
- [ ] Integrator implements navigation.js, atmosphere.js, quality/shadows, minimap, UI and improved birds.
- [ ] Run full suite and real browser QA, review significant defects, preserve reproducible dates, publish expansion.

Review focus: camera underground/in water, reset/pause consistency, weather-light alignment, moving homes/shelters, narrow panel overflow, heavy shadow cost.
