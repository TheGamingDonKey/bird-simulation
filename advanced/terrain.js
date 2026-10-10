// Shared by the scene mesh, villagers and flock collision avoidance.
export function riverX(z) {
  return Math.sin(z * 0.018) * 16 + Math.sin(z * 0.043) * 5;
}

export function terrainHeight(x, z) {
  const valley = 2 + Math.sin(x * 0.033) * Math.cos(z * 0.027) * 2.4
    + Math.sin(z * 0.051 + x * 0.012) * 1.3;
  const edge = Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 135) / 80);
  const mountain = edge * edge * (36 + 10 * Math.sin(x * 0.035 + z * 0.027));
  const riverDistance = Math.abs(x - riverX(z));
  // Smooth low banks, with a channel below the water surface at -2.5.
  const bank = Math.min(1, Math.max(0, (riverDistance - 5) / 13));
  const blend = bank * bank * (3 - 2 * bank);
  return -3.5 * (1 - blend) + (valley + mountain) * blend;
}
