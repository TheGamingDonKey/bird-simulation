# Verification — October 10, 2026

- Original three source files match the recovered June 3 version byte-for-byte. The archival Git blobs also match those files byte-for-byte.
- `node --test tests/*.test.mjs`: 35 passing tests. Covers seeded reproducibility, count changes, separation/alignment/cohesion, food attraction/expiry, predator avoidance, weather forces, pause, terrain clearance, 700 birds through all weather modes for 60 simulated seconds, bird attitude, and precipitation mode selection.
- Actual local browser preview rendered the valley and village. Checked Valley, Flock and Village cameras, storm and clear weather, 700 population, 3× speed, hawk toggle, pause/resume, terrain food placement, reset, and control collapse. Console inspection returned no errors or warnings during these checks.
- At desktop 1440×900, the local preview reported approximately 60 FPS with 700 birds and 3× speed. This is one machine/browser observation, not a cross-device performance guarantee. FPS now uses wall-clock time rather than clamped simulation time.
- Checked 390×667 portrait and 844×390 landscape: no horizontal page overflow; the portrait panel stayed inside the screen; short landscape uses a scrolling panel.
- Real Three.js scene construction and updates through every weather mode produced no nonfinite geometry values; pause freezes scenery updates. All renderer dependencies are local. Synthesized ambient audio is optional; sound quality was not independently evaluated.
- Review fixes: smaller/higher clouds, correct bird yaw/pitch, hawk orientation from movement, bounded and synchronized food rings, terrain raycast for clicks, actual clear-weather precipitation visibility, truthful relative wind label, village routes kept on the riverbank.

## Publication state

Public repository: https://github.com/TheGamingDonKey/bird-simulation. See publication.md for dated snapshot commits. The original and first advanced snapshots have been uploaded and fetched back from GitHub. Original files match their preserved Git blobs. The living world expansion follows as the current main commit.

## Living world expansion checks

- 35 behavioral/integration tests pass, including moving weather fronts and gradual transitions, storm illumination/night light, local-weather shelter and reset replay, village commands, keyboard movement/terrain grounding/listener cleanup, bird glide and signed bank.
- Read-only specialist review found and fixed map travel being overwritten in the flock preset, walking beyond the old visible ground, front intensity not fading from the map, and sunlight not reacting to clouds/lightning.
- Expanded the rendered ground and river to ±285 while camera movement is bounded at ±260.
- Live browser checks: free flight, walking and keyboard movement; bird viewpoint; cinematic tour; gathering villagers; food/hawk actions; pause; night and storm rendering; Ultra shadows at700 birds/3× speed. No shader errors. Foreground observed 60 FPS; initial unfocused scheduling produced~1000 ms frame gaps with~5ms simulation+5msrender work, so this is not a cross-device guarantee.
- Rendering uses one directional shadow map, optional smaller map/no shadows, instanced birds/forest/meadow/clouds. No hardware ray tracing is implemented.
- Optional sound was retained but not independently evaluated.

- Final responsive checks at390×667 and 844×390: no horizontal overflow; panel bounds remain inside viewport. Mobile starts collapsed; expanding scrolls controls. Hide-interface/Escape restoration works even with button focus. Map travel exits flock-following; free movement verified from actual camera coordinates.

## Playable bird and wildlife expansion checks

- Player flight, energy/gliding, tree and tent approaches, terrain clearance, exact perch lock, takeoff, chirp cooldown, deterministic replay and bounds have behavioral coverage. Input tests cover held keys/buttons, form focus, one-shot actions and blur cleanup; view tests cover chase camera and matching landing guidance.
- All 760 rendered trees and six tent ridges have real geometry anchors; integration coverage checks every tree crown and stable reset references. Eight deer, twelve rabbits and fourteen fish have seeded activity, local reactions, weather priority and bounded movement. NPC watch/wave/duck/flee responses stay local.
- Live desktop browser: landed on a tent and tree, took off by holding Space, climbed with W, paused with P, resumed without changing frozen position, chirped on a roof and observed ten nearby villagers reacting. A held Flap button also took off. No browser errors during these checks; foreground preview reported about60FPS at220birds on Balanced.
- Responsive flight HUD at390x667 and844x390 has no horizontal overflow. At390x667 expanded pilot panel top76/bottom403, HUDtop409/bottom651; header remains reachable. Short landscape hides footer/map while flying to avoid overlap.
- Specialist review fixes: removed a150tree landing-anchor cap, aligned the green landing marker with physics height/reach limits, folded perch wings close to the body, bounded expanded phone controls, and cleared held actions when pausing.
- Player controls advance at real-time speed while the environment time multiplier controls flock/weather/village simulation. Flight freezes while paused. It is assisted arcade flight; arbitrary building collisions and precise aerodynamics are outside this edition.

Final release verification: `node --test tests/*.test.mjs` — 55 passed, zero failures. `node --check advanced/main.js` and `git diff --check` passed.
