/**
 * Graphics — All Three.js rendering code in one editable module.
 * Reads simulation State, renders to canvas.
 */

import * as THREE from 'three';
import { State } from './core.js';

let renderer, scene, camera, terrainMesh;
let initialized = false;

/** ---- Setup ---- */

export function init(canvas) {
  if (initialized) return;

  // Renderer — simplest config, no antialiasing
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky blue

  // Camera — first-person view
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 5);

  // Lighting — ambient + directional only
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 20, 10);
  scene.add(directional);

  // Materials — simple MeshBasicMaterial
  const materials = {
    default: new THREE.MeshBasicMaterial({ color: 0x228b22 }),
    wireframe: new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }),
    entity: new THREE.MeshBasicMaterial({ color: 0xff6b6b }),
    water: new THREE.MeshBasicMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.6 }),
  };

  // Terrain — simple sphere placeholder
  terrainMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), materials.default);
  terrainMesh.name = 'planet';
  scene.add(terrainMesh);

  initialized = true;
}

/** ---- Sync (called each frame) ---- */

export function sync(deltaTime) {
  if (!initialized) return;

  // State is synced from camera (Controls writes directly to camera object)
  State.cameraPosition.x = camera.position.x;
  State.cameraPosition.y = camera.position.y;
  State.cameraPosition.z = camera.position.z;
  State.cameraRotation.x = camera.rotation.x;
  State.cameraRotation.y = camera.rotation.y;
  State.cameraRotation.z = camera.rotation.z;
}

/** ---- Render ---- */

export function render() {
  if (!initialized) return;
  renderer.render(scene, camera);
}

/** ---- Resize ---- */

export function resize() {
  if (!initialized) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/** ---- Getters ---- */

export function getRenderer() { return renderer; }
export function getScene() { return scene; }
export function getCamera() { return camera; }