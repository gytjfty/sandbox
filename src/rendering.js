/**
 * Rendering — Three.js setup and render loop.
 * Reads simulation State, renders to canvas.
 * Establishes architecture for terrain, player, lighting, and environment.
 */

import * as THREE from 'three';
import { State } from './core.js';
import { world } from './world.js';
import { terrain } from './terrain.js';
import { player } from './player.js';

let renderer, scene, camera, ocean;
let initialized = false;
let directionalLight, ambientLight;

function log(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log(msg);
}

export function init(canvas) {
  if (initialized) return;

  // Renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    log('WebGL renderer created');
  } catch (e) {
    log('WebGL failed: ' + e.message);
    renderer = null;
  }

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x003366);
  scene.fog = new THREE.Fog(0x003366, 10000, 50000);

  // Camera — first-person, starts on Earth surface
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100000
  );

  // Initial player position
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);

  // Ambient light
  ambientLight = new THREE.AmbientLight(0x4488ff, 0.4);
  scene.add(ambientLight);

  // Directional light - sun
  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  scene.add(directionalLight);

  // Sky - simple gradient for day/night
  const skyGeometry = new THREE.SphereGeometry(100000, 32, 32);
  skyGeometry.scale(-1, 1, 1);
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x003366,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);

  // Ocean - global ocean at mean radius with slight variation
  const oceanRadius = world.meanRadius * 1.01;
  const oceanGeo = new THREE.SphereGeometry(oceanRadius, 64, 64);
  const oceanMat = new THREE.MeshBasicMaterial({ color: 0x1e90ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.name = 'ocean';
  scene.add(ocean);

  // Initialize terrain data
  terrain.init();
  terrain.updateMesh();

  // Add terrain meshes to scene
  const terrainMeshes = terrain.getMeshes();
  terrainMeshes.forEach((m) => {
    scene.add(m);
    m.castShadow = true;
    m.receiveShadow = true;
  });

  initialized = true;
  log('Rendering initialized - full-scale Earth');
}

export function sync(dt) {
  if (!initialized) return;

  // Sync terrain mesh updates if needed
  terrain.updateMesh();

  // Sync camera position from player state
  if (State.camera.position) {
    camera.position.set(
      State.camera.position.x,
      State.camera.position.y,
      State.camera.position.z
    );
  }

  // Sync camera rotation
  if (State.camera.rotation) {
    camera.rotation.set(
      State.camera.rotation.x,
      State.camera.rotation.y,
      State.camera.rotation.z
    );
  }
}

export function resize() {
  if (!initialized) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

export function updateLighting(timeOfDay) {
  if (!initialized) return;

  // timeOfDay: 0.0 = midnight, 0.5 = noon, 1.0 = midnight again
  const sunRadius = 50000;
  const sunAngle = timeOfDay * Math.PI * 2;

  const sunX = Math.cos(sunAngle) * sunRadius;
  const sunY = Math.sin(sunAngle) * sunRadius * 0.3;
  const sunZ = Math.sin(sunAngle) * sunRadius * 0.8;

  directionalLight.position.set(sunX, sunY, sunZ);

  // Adjust directional light intensity based on time of day
  const lightIntensity = timeOfDay > 0.1 && timeOfDay < 0.9 ? 0.8 : 0.2;
  directionalLight.intensity = lightIntensity;

  // Atmospheric scattering color based on time of day
  let skyColor;
  if (timeOfDay < 0.1 || timeOfDay > 0.9) {
    skyColor = 0x000011;
  } else if (timeOfDay < 0.2) {
    const t = (timeOfDay - 0.1) / 0.1;
    skyColor = new THREE.Color().setHSL(0.05 + t * 0.1, 0.5, 0.1 + t * 0.4);
  } else if (timeOfDay < 0.8) {
    const t = (timeOfDay - 0.2) / 0.6;
    skyColor = new THREE.Color().setHSL(0.6 + t * 0.1, 0.5, 0.5 - t * 0.3);
  } else {
    const t = (timeOfDay - 0.8) / 0.2;
    skyColor = new THREE.Color().setHSL(0.15 + t * 0.1, 0.5, 0.1 + t * 0.4);
  }

  scene.background = skyColor;
}

export function getRenderer() { return renderer; }
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getTerrain() { return terrain; }
export function getPlanetRadius() { return world.meanRadius; }