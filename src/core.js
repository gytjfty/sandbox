/**
 * Core — Simulation clock and global state.
 * Single source of truth for simulation data independent of Three.js.
 */

/** ---- Clock ---- */

export class Clock {
  constructor() {
    this.startTime = performance.now();
    this.previousTime = this.startTime;
    this.timeScale = 1.0;
    this.simulationTime = 0;
    this.frameCount = 0;
    this.deltaTime = 0;
    this.rawDeltaTime = 0;
  }

  tick() {
    const now = performance.now();
    this.rawDeltaTime = (now - this.previousTime) / 1000;
    this.deltaTime = this.rawDeltaTime * this.timeScale;
    this.simulationTime += this.deltaTime;
    this.previousTime = now;
    this.frameCount++;
    return this.deltaTime;
  }

  setTimeScale(scale) {
    this.timeScale = scale;
  }

  get fps() {
    return this.rawDeltaTime > 0 ? 1 / this.rawDeltaTime : 0;
  }
}

/** ---- Global State ---- */

export const State = {
  // Planetary data
  planet: {
    radius: 6371000,      // Mean radius in meters
    equatorialRadius: 6378137,  // WGS84 equatorial radius
    polarRadius: 6356752,       // WGS84 polar radius
    flattening: 1 / 298.257223563,
    type: 'oblate spheroid'
  },
  // Time
  time: {
    simulationTime: 0,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeScale: 1.0
  },
  // Player
  player: {
    // Position in world coordinates (meters, on or above surface)
    position: { x: 0, y: 0, z: 0 },
    // Orientation (radians)
    rotation: { x: 0, y: 0, z: 0 },
    // Height above terrain (meters)
    heightAboveGround: 0
  },
  // Camera (Three.js specific, kept separate from player core data)
  camera: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  },
  // World modifications
  modifications: [],
  // Entities
  entities: [],
  // Current system flags
  isDay: true,
  isPaused: false
};

// Initialize with default player position on Earth surface at prime meridian, equator
State.player.position = {
  x: 0,
  y: 0,
  z: 6371000  // On surface at mean radius
};

/** Shared clock singleton — one source of time for the whole application. */
export const clock = new Clock();

export default Clock;