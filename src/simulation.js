/**
 * Simulation — System registry and game loop.
 * Modular system architecture with shared world state.
 * Distinction between simulation state and rendered objects.
 * Systems update at appropriate intervals independent of render frame rate.
 */

import { Clock, State, clock } from './core.js';
import { world } from './world.js';
import { player } from './player.js';
import { terrain } from './terrain.js';
import { updateLighting } from './rendering.js';

// Shared clock — same instance used by main.js, so we never tick twice.

/** Shared system instances — modular systems that share world state. */

export const systems = {
  world: world,
  time: {
    currentEra: 'modern',
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeScale: 1.0,
    dayLengthMinutes: 24 * 60,
    setTimeScale(scale) {
      this.timeScale = scale;
    },
    getTimeOfDay() {
      const h = this.hour + this.minute / 60 + this.second / 3600;
      return h / 24;
    },
    isDay() {
      const tod = this.getTimeOfDay();
      return tod > 0.25 && tod < 0.75;
    },
    isNight() {
      return !this.isDay();
    },
    getTimeString() {
      const h = String(this.hour).padStart(2, '0');
      const m = String(Math.floor(this.minute)).padStart(2, '0');
      return `${h}:${m}`;
    }
  },
  entities: {
    entities: [],
    add: (entity) => { this.entities.push(entity); }
  },
  biology: { init() {}, tick(dt, clock) {} },
  sensory: { init() {}, tick(dt, clock) {} },
  weather: { init() {}, tick(dt, clock) {} },
  chemistry: { init() {}, tick(dt, clock) {} },
  construction: { init() {}, tick(dt, clock) {} },
  civilization: { init() {}, tick(dt, clock) {} },
  economics: { init() {}, tick(dt, clock) {} },
  technology: { init() {}, tick(dt, clock) {} },
  communication: { init() {}, tick(dt, clock) {} },
  infrastructure: { init() {}, tick(dt, clock) {} },
  health: { init() {}, tick(dt, clock) {} },
  disasters: { init() {}, tick(dt, clock) {} }
};

/** Core simulation object — manages the game loop and system ticks. */

export const simulation = {
  init() {
    terrain.init();
    State.entities = [];
    Object.values(systems).forEach((sys) => {
      if (typeof sys.init === 'function') sys.init();
    });
    console.log('Simulation initialized');
  },
  tick(dt, clock) {
    // clock is already ticked by main.js — never tick twice.
    State.time.simulationTime = clock.simulationTime;

    // Advance the wall-clock time of day from simulation seconds.
    const simSecondsPerDay = 24 * 60 * 60;
    const daySeconds = clock.simulationTime % simSecondsPerDay;
    const totalMinutes = Math.floor(daySeconds / 60);
    systems.time.hour = Math.floor(totalMinutes / 60);
    systems.time.minute = totalMinutes % 60;
    systems.time.second = Math.floor(daySeconds % 60);

    const simDayFraction = daySeconds / simSecondsPerDay;
    updateLighting(simDayFraction);
    State.isDay = systems.time.isDay();

    // Tick every registered subsystem (stubs conserved for future systems).
    Object.values(systems).forEach((sys) => {
      if (typeof sys.tick === 'function') sys.tick(dt, clock);
    });
  }
};

/** Initialize the simulation (called from main.js) */
export function init() {
  simulation.init();
}

/** Game loop step (called from main.js) */
export function gameLoop(dt) {
  simulation.tick(dt, clock);
}