/**
 * Core — Simulation clock and global state.
 * Single source of truth for the current frame.
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

/** ---- State ---- */

export const State = {
  world: {},
  time: {},
  entities: [],
  biology: {},
  sensory: {},
  weather: {},
  chemistry: {},
  construction: {},
  civilization: {},
  economics: {},
  technology: {},
  communication: {},
  infrastructure: {},
  health: {},
  disasters: {},
  cameraPosition: { x: 0, y: 2, z: 5 },
  cameraRotation: { x: 0, y: 0, z: 0 },
};