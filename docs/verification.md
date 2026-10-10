# Verification — October 10, 2026

- Original three source files match the recovered June 3 version byte-for-byte. The archival Git blobs also match those files byte-for-byte.
- `node --test tests/*.test.mjs`: 13 passing tests. Covers seeded reproducibility, count changes, separation/alignment/cohesion, food attraction/expiry, predator avoidance, weather forces, pause, terrain clearance, 700 birds through all weather modes for 60 simulated seconds, bird attitude, and precipitation mode selection.
- Actual local browser preview rendered the valley and village. Checked Valley, Flock and Village cameras, storm and clear weather, 700 population, 3× speed, hawk toggle, pause/resume, terrain food placement, reset, and control collapse. Console inspection returned no errors or warnings during these checks.
- At desktop 1440×900, the local preview reported approximately 60 FPS with 700 birds and 3× speed. This is one machine/browser observation, not a cross-device performance guarantee. FPS now uses wall-clock time rather than clamped simulation time.
- Checked 390×667 portrait and 844×390 landscape: no horizontal page overflow; the portrait panel stayed inside the screen; short landscape uses a scrolling panel.
- Real Three.js scene construction and updates through every weather mode produced no nonfinite geometry values; pause freezes scenery updates. All renderer dependencies are local. Synthesized ambient audio is optional; sound quality was not independently evaluated.
- Review fixes: smaller/higher clouds, correct bird yaw/pitch, hawk orientation from movement, bounded and synchronized food rings, terrain raycast for clicks, actual clear-weather precipitation visibility, truthful relative wind label, village routes kept on the riverbank.

## Publication state

An archival commit and an advanced commit are prepared locally. GitHub publication needs the user-created repository `TheGamingDonKey/bird-simulation` and access through the connected GitHub app or Git credentials. No successful remote publication has been observed yet.
