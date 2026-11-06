/** World units are fish body lengths; times are seconds, angles are degrees. */
export const config = {
  simulation: { hz: 30, maxFrame: 0.1, maxSteps: 3, seed: 417 },
  school: {
    count: 1500, minCount: 100, maxCount: 3000,
    repulsion: 1, alignment: 5, attraction: 10, fieldOfView: 300,
    cruiseSpeed: 4, maxSpeed: 12, turnRate: 200, noise: 5,
    spawnRadius: 19, spawnHeight: 9, spawnDepth: 22, spawnHeadingSpread: 0.18,
    depthTurnWeight: 2, attractionWeight: 0.22,
  },
  informed: { radius: 6, angle: 35, seconds: 2, weight: 0.6, memory: 2, coolRadius: 25, coolSeconds: 10 },
  player: {
    yawSpeed: 85, pitchSpeed: 65, maxPitch: 65, mouseDeadzone: 0.12,
    acceleration: 4, staminaDrain: 0.23, staminaRecovery: 0.13, restartStamina: 0.18,
  },
  world: {
    surfaceY: 0, minY: -100, maxY: -2, depthMargin: 9,
    fog: '#064253', fogDensity: 0.014, background: '#042c3e',
    waterSize: 700, surfaceSegments: 70, surfaceWave: 0.3,
    particles: 850, particleRadius: 75, particleSize: 0.11,
    beamCount: 12, beamLength: 72, beamRadius: 58, beamOpacity: 0.05,
    ambientLight: 2.3, sunLight: 3.3,
  },
  render: {
    maxPixelRatio: 1.5, mobilePixelRatio: 1.25, fishLength: 1,
    fishRings: 12, fishSides: 8, fishWidth: 0.105, fishHeight: 0.15,
    tailAmplitude: 0.075, swimFrequency: 8, swimSpeedFactor: 1.4,
    fishColor: '#b6cfd1', informedColor: '#ffe1a0', playerColor: '#fff0b3',
    roughness: 0.4, metalness: 0.18, nearFadeStart: 2, nearFadeEnd: 4,
  },
  camera: {
    fov: 62, near: 0.1, far: 850, followDistance: 9, followHeight: 2.8,
    lookAhead: 5, smoothness: 4, overviewHeight: 56, overviewBack: 24,
  },
  goal: { x: 64, y: -22, z: 48, radius: 15, buoySize: 0.8 },
  predators: {
    graceSeconds: 6, fleeRadius: 15, fleeWeight: 3, forwardWeight: 0.8,
    speedRecovery: 2, regroupSeconds: 5, regroupRadius: 22, regroupWeight: 0.55,
    bonitoSpeed: 18, bonitoDistance: 38, bonitoWarning: 2.5, bonitoAttack: 4.5, bonitoRest: 5, bonitoBite: 1.1,
    dolphinCount: 3, dolphinOrbit: 24, dolphinMinOrbit: 17, dolphinTightenSeconds: 18,
    dolphinSpeed: 8, dolphinAttackSpeed: 16, dolphinPeriod: 9, dolphinAttack: 3, dolphinBite: 1.3,
    birdStartDepth: 13, birdSchoolHalfHeight: 1.5, birdMaxDepth: 16, birdHeight: 10, birdPeriod: 10, birdGraceSeconds: 3,
    birdWarning: 2.5, birdSpeed: 24, birdClimbSpeed: 15, birdBite: 0.75,
    trailPoints: 72, trailLife: 2.5, trailInterval: 0.06,
  },
  ui: { refreshSeconds: 0.1, radarRange: 100, radarSize: 160 },
};

export function normalizeRadii(): void {
  config.school.alignment = Math.max(config.school.repulsion, config.school.alignment);
  config.school.attraction = Math.max(config.school.alignment, config.school.attraction);
}
