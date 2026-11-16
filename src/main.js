/**
 * main.js — Bootstrap.
 * Wires core, simulation, graphics, input, and UI into one game loop.
 * All Three.js object creation happens inside functions, never at module scope.
 */

import * as THREE from 'three';
import { State, clock } from './core.js';
import { init as initSim, gameLoop as simGameLoop, systems } from './simulation.js';
import {
  init as initGfx,
  sync as syncGfx,
  resize as resizeGfx,
  getRenderer,
  getScene,
  getCamera,
  getTerrain,
  getPlanetRadius,
} from './rendering.js';
import { player } from './player.js';
import { HUD } from './ui.js';

const canvas = document.getElementById('canvas') || document.createElement('canvas');
if (!document.getElementById('canvas')) document.body.appendChild(canvas);

const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');

function log(msg) {
  if (statusEl) statusEl.textContent = msg;
  console.log(msg);
}
function err(msg) {
  if (errorEl) errorEl.textContent = msg;
  console.error(msg);
}

const hud = new HUD();
let gameLoop;

/** Start the application */
function startApp() {
  try {
    if (gameLoop) return;

    // Hide overlay
    if (overlay) overlay.classList.add('hidden');

    // Initialize simulation
    initSim();
    State.entities = systems.entities || [];

    // Initialize graphics
    initGfx(canvas);

    // Initialize player with camera and DOM element
    const camera = getCamera();
    player.init(camera, canvas);

    // Request pointer lock (user gesture from the click that started the app)
    try {
      canvas.requestPointerLock();
    } catch (e) {
      // Pointer lock may be denied by the browser; not fatal.
    }

    // Resize handler
    window.addEventListener('resize', () => resizeGfx());

    // Raycaster and mouse for terrain modification
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Click-to-modify-terrain
    canvas.addEventListener('mousedown', (event) => {
      if (!player.isPointerLocked) return;

      const camera = getCamera();
      raycaster.setFromCamera(mouse, camera);

      // Get terrain and check intersection
      const terrain = getTerrain();
      const planetRadius = getPlanetRadius();
      const camPos = camera.position;

      // Simple ray-sphere intersection for terrain modification
      const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), camPos);
      const distance = camPos.length();
      const underSurface = distance < planetRadius;

      if (event.shiftKey) {
        // Carve cave/tunnel
        systems.world.carveTerrain(camPos.x, camPos.y, camPos.z, 50);
        terrain.carveTerrain(camPos.x, camPos.y, camPos.z, 50);
      } else if (event.ctrlKey) {
        // Lower terrain
        systems.world.modifyTerrain(camPos.x, camPos.y, camPos.z, 50, 10, 'lower');
        terrain.modifyTerrain(camPos.x, camPos.y, camPos.z, 50, 10, 'lower');
      } else {
        // Raise terrain
        systems.world.modifyTerrain(camPos.x, camPos.y, camPos.z, 50, 10, 'raise');
        terrain.modifyTerrain(camPos.x, camPos.y, camPos.z, 50, 10, 'raise');
      }
    });

    // Key controls for time acceleration
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        const newScale = Math.min(clock.timeScale * 2, 100);
        clock.setTimeScale(newScale);
        systems.time.setTimeScale(newScale);
        log('Time scale: ' + newScale + 'x');
      } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        const newScale = Math.max(clock.timeScale / 2, 0.1);
        clock.setTimeScale(newScale);
        systems.time.setTimeScale(newScale);
        log('Time scale: ' + newScale + 'x');
      } else if (event.code === 'Digit0' || event.code === 'Numpad0') {
        clock.setTimeScale(1.0);
        systems.time.setTimeScale(1.0);
        log('Time scale: 1x (real-time)');
      }
    });

    // Game loop
    gameLoop = {
      running: true,
      lastTime: performance.now(),
      frameCount: 0,
      animationFrameId: null,

      loop() {
        if (!this.running) return;

        const now = performance.now();
        const dt = clock.tick();

        // Player movement (first-person controls)
        player.update(dt);

        // Update HUD
        hud.updateStats({
          fps: clock.fps,
          timeScale: clock.timeScale,
          entityCount: systems.entities && systems.entities.entities
            ? systems.entities.entities.length
            : 0,
          timeString: systems.time.getTimeString(),
          dateString: `${systems.time.year}-${systems.time.month}`,
          weather: 'Clear'
        });

        // Simulation step
        simGameLoop(dt);

        // Sync graphics state
        syncGfx(dt);

        // Render frame
        const renderer = getRenderer();
        const scene = getScene();
        const camera = getCamera();

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }

        // Request next frame
        this.animationFrameId = requestAnimationFrame(() => this.loop());
      }
    };

    // Start the game loop
    gameLoop.loop();

    log('Game loop started - first-person planetary simulation');
  } catch (e) {
    err('Startup error: ' + e.message);
    console.error(e);
  }
}

/** Start prompt - click to begin */
canvas.addEventListener('click', () => {
  startApp();
});