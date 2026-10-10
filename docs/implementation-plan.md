# AERIE implementation plan

Goal: preserve and publish the original, then deliver a visually compelling interactive 3D upgrade.
Architecture: independent simulation model and procedural scene, integrated by a small browser controller.
Tech: vendored Three.js, JavaScript modules, Node test runner and static HTTP server.
Spec: design.md.

- [ ] Archive original files and hashes, record evidence-supported original and upgrade dates, publish archival commit first.
- [ ] Simulation specialist: model.js, terrain.js and behavioral tests. Deterministic, bounded flocking and interaction inputs.
- [ ] Environment specialist: world.js with terrain, river, forest, mountain, village, villagers, fire/smoke and weather. Contract from design.md.
- [ ] Integrator: interface, cameras, animated bird models, local server, launchers and documentation.
- [ ] Verify browser interactions, errors, resize, original hashes; independently review and fix significant defects.
- [ ] Publish upgraded source, screenshots and local ZIP; verify remote commit and hand off the runnable result.

Review focus: high bird populations, pause/time consistency, narrow viewport, camera transitions, missing WebGL. Runtime must not depend on CDN availability. No fabricated historical commit dates.
