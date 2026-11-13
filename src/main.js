/**
 * main.js — Bootstrap.
 * Wires core, simulation, graphics, input, and UI into one game loop.
 */

import { Clock } from './core.js';
import { State } from './core.js';
import { init as initSim, tick as tickSim, entityList } from './simulation.js';
import {
  init as initGfx,
  sync as syncGfx,
  resize as resizeGfx,
  getRenderer,
  getScene,
  getCamera,
} from './graphics.js';
import { Controls } from './input.js';
import { HUD } from './ui.js';
import { Menu } from './ui.js';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const clock = new Clock();
const hud = new HUD('hud');
const menu = new Menu('menu', startApp);

let gameLoop = null;
let controls = null;

function startApp() {
  if (gameLoop) return;

  // Simulation
  initSim();
  State.entities = entityList;

  // Graphics (Three.js)
  initGfx(canvas);

  // Resize
  window.addEventListener('resize', () => resizeGfx());

  // First-person controls (needs camera from graphics)
  controls = new Controls(getCamera(), canvas);

  // Game loop
  gameLoop = {
    running: true,
    lastStatsTime: performance.now(),
    frameCount: 0,
    animationFrameId: null,

    loop() {
      if (!this.running) return;

      const dt = clock.tick();

      controls.update(dt);
      tickSim(dt, clock);
      syncGfx(dt);

      getRenderer().render(getScene(), getCamera());

      this.frameCount++;
      const now = performance.now();
      if (now - this.lastStatsTime > 1000) {
        hud.updateStats({
          fps: clock.fps,
          simTime: clock.simulationTime,
          timeScale: clock.timeScale,
          entityCount: entityList.length,
        });
        this.lastStatsTime = now;
        this.frameCount = 0;
      }

      this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    stop() {
      this.running = false;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    },
  };

  gameLoop.loop();
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && gameLoop) {
    gameLoop.stop();
    menu.show();
  }
});