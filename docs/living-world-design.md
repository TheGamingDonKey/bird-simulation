# AERIE living-world expansion — October 10, 2026

Preserve original June 3 files and the first advanced release in Git history. Publish both before this expansion. Continue the same procedural browser habitat with no external runtime assets.

The target is a more compelling observable world: clear focal hierarchy (birds, then village, then distant terrain), warm direct light against cool shadows, atmospheric depth, readable silhouettes, and immediate visible responses to actions. These principles guide changes rather than a claim of scientific realism.

Add navigation modes: free flight with WASD/arrows, mouse drag look, Q/E altitude, Shift acceleration; ground walking with terrain clearance; bird POV; cinematic tour; retain Valley, Flock, Village and Orbit and a reset/home view. Show concise mode-specific control guidance and minimap. Avoid mandatory pointer lock so the browser controls stay usable.

An active seeded weather field owns drifting regional fronts, smooth intensity transitions, wind sampling and lightning. It drives precipitation, clouds, light, bird flight and villagers consistently. Pause freezes world time; user camera motion remains available.

Villagers forage, carry supplies, gather near the fire, and shelter from storms. Gather/startle clicks change behavior and readouts. Birds have species-specific heights, gliding phases, wider horizontal and vertical exploration, and local weather response.

Rendering: enable one directional shadow map, selective casters, physically based opaque materials, improved wings/body detail, procedural sky gradient with sun/moon/stars, atmospheric distance/fog, moving cloud shadows or weather dimming, and animated water highlights. Retain a quality control so heavy shadows/resolution can be reduced. Do not claim hardware ray tracing; renderer remains WebGL.

Verify deterministic weather/villagers, paused state, free camera terrain limits, bird attitude and bounds, actual browser controls, shadow rendering, console errors and responsive layout. Preserve offline startup and source dates.

## Design references reviewed

- GDC's [Invisible Intuition workshop](https://www.gdcvault.com/play/1025360/Level-) discusses using layout, environment, lighting and FX to guide players and establish mood. Applied here through the river's visual route, a warm settlement focal point, distinct foreground/midground/mountain layers, and dedicated close cameras.
- Three.js [shadow documentation](https://threejs.org/manual/pages/shadows.html) describes the cost of additional shadow rendering. Applied with one shadowed directional light, selective casters and selectable shadow resolution.
- Three.js [color management](https://threejs.org/manual/pages/color-management.html) informs the sRGB output and linear material color pipeline with ACES tone mapping.

Other decisions: clear action feedback, progressive camera choices, reversible experiments, visible weather geography, and deterministic replay. These are implementation judgments, not claims of scientifically measured realism.
