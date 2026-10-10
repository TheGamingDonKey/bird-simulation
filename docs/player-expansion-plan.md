# Playable bird and wildlife

The requested outcome is direct control of a bird that can land on trees and tents, with more wildlife and local village reactions, followed by a GitHub publication. Existing observation modes, weather, dates and original source remain available.

- A separate player state owns arcade flight, energy, glide, assisted landing and takeoff. W/S or arrows climb/dive; A/D steer; Space flaps; Shift glides; L lands/takes off; F chirps. On-screen controls support pointer/touch input.
- Actual scene geometry supplies tree crown and tent roof landing anchors. A highlighted nearby perch, distance readout and landing progress make landing discoverable. Landing assistance only works near a valid anchor and moves to it before locking the bird in place.
- A chase camera and distinctive bird mesh make the player's role clear. A flight HUD reports mode, energy, nearby perch and successful landings. Leaving pilot mode stops the player; pausing freezes all simulation actors.
- Deer, rabbits and river fish have deterministic activity and local disturbance responses. Villagers watch/wave at calm flight or chirping and duck/flee during fast low passes; weather shelter retains priority.
- Validate flight/perching/replay/terrain clearance and wildlife/village reactions with behavioral tests; inspect the actual browser controls and rendering; publish a new dated commit and refresh the full archive.

Ownership: player model specialist owns player-bird.js and tests; world specialist owns wildlife, perches and village responses; parent owns input, rendering, HUD, main integration, browser verification and publication.
