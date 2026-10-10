# AERIE — living skies

Upgrade date: October 10, 2026. Preserve the recovered June 3, 2026 Canvas simulation unchanged in original/. Create an advanced, runnable browser simulation that emphasizes flocks above an early human settlement.

Use a local vendored Three.js renderer, procedural faceted terrain, a winding river, forest, distant mountains, canvas-painted sky, tents, walking people, animated fire/smoke, and geographically distinct rain/snow/fog. No external runtime requests. The palette is warm ivory, forest green, slate blue and sunset amber; the scene occupies almost the entire viewport with restrained observation controls.

Birds use 3D separation/alignment/cohesion, wind, terrain avoidance, food attraction, predator avoidance and three species. Controls expose population, time, weather, camera presets, food placement, predator and pause/reset. Flight animation is stylized; this is an artistic behavior simulation, not a scientifically calibrated flight model.

Interfaces: model.js exports Habitat with birds array (x,y,z,vx,vy,vz,species,phase), time, weather, predator, food; methods step(dt), setCount(n), reset(seed), addFood(x,z), setWeather(mode). terrainHeight(x,z) and riverX(z) are exported separately. world.js exports createWorld(THREE,scene) returning update(dt,time,{weather,wind,daylight}) and terrainHeight; bird-view.js consumes Habitat. main.js owns renderer, cameras, controls and timing.

Verify original hashes, deterministic resets, long-run finite/bounded bird motion, storm/predator/feed influence, and actual browser rendering/control behavior at desktop and narrow sizes. Ship launch scripts, both versions, source documentation, dependency license and a screenshot.
