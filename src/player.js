/**
 * Player — First-person camera and controls.
 * Player positioned relative to planet's surface.
 * Movement follows the planet's curvature.
 * Foundation for planetary gravity and orientation.
 */

import { Vector3 } from 'three';
import { State, world } from './core.js';

export class PlayerSystem {
  constructor() {
    this.camera = null;
    this.domElement = null;
    this.pointerLocked = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.speed = 7.0;
  }

  init(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);
    domElement.addEventListener('click', this._onClick);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    this._resetPlayerPosition();
  }

  _resetPlayerPosition() {
    const pos = world.sphericalToVector(0, 0, world.meanRadius);
    State.player.position = { x: pos.x, y: pos.y, z: pos.z };
    State.player.heightAboveGround = 0;
    if (this.camera) {
      this.camera.position.set(pos.x, pos.y, pos.z + 2);
      this.camera.rotation.set(0, 0, 0);
    }
    State.camera.position = { x: pos.x, y: pos.y, z: pos.z + 2 };
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      case 'ShiftLeft': this.speed = 12; break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': this.speed = 7; break;
    }
  }

  _onMouseMove(event) {
    if (document.pointerLockElement !== this.domElement) return;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    this.camera.rotation.y -= movementX * 0.002;
    this.camera.rotation.x -= movementY * 0.002;
    this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
  }

  _onClick() {
    this.domElement.requestPointerLock();
  }

  update(dt) {
    if (!this.camera || document.pointerLockElement !== this.domElement) return;
    const yaw = this.camera.rotation.y;
    const pitch = this.camera.rotation.x;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const forwardY = 0;
    const rightX = Math.sin(yaw + Math.PI / 2);
    const rightZ = Math.cos(yaw + Math.PI / 2);
    const rightY = 0;
    const pitchForwardX = forwardX * Math.cos(pitch);
    const pitchForwardZ = forwardZ * Math.cos(pitch);
    const pitchForwardY = Math.sin(pitch);
    const pitchRightX = rightX * Math.cos(pitch);
    const pitchRightZ = rightZ * Math.cos(pitch);
    const pitchRightY = Math.sin(pitch);
    let moveX = 0, moveY = 0, moveZ = 0;
    const speed = this.speed;
    if (this.moveForward) {
      moveX += pitchForwardX * speed * dt;
      moveY += pitchForwardY * speed * dt;
      moveZ += pitchForwardZ * speed * dt;
    }
    if (this.moveBackward) {
      moveX -= pitchForwardX * speed * dt;
      moveY -= pitchForwardY * speed * dt;
      moveZ -= pitchForwardZ * speed * dt;
    }
    if (this.moveLeft) {
      moveX += pitchRightX * speed * dt;
      moveY += pitchRightY * speed * dt;
      moveZ += pitchRightZ * speed * dt;
    }
    if (this.moveRight) {
      moveX -= pitchRightX * speed * dt;
      moveY -= pitchRightY * speed * dt;
      moveZ -= pitchRightZ * speed * dt;
    }
    this.camera.position.x += moveX;
    this.camera.position.y += moveY;
    this.camera.position.z += moveZ;
    State.player.position = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
    this._keepOnSurface();
    State.player.rotation = { x: this.camera.rotation.x, y: this.camera.rotation.y, z: 0 };
    State.camera.rotation = { x: this.camera.rotation.x, y: this.camera.rotation.y, z: 0 };
  }

  _keepOnSurface() {
    const pos = new Vector3(State.camera.position.x, State.camera.position.y, State.camera.position.z);
    const currentRadius = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const latitude = world.getLatitudeFromVector(pos);
    const surfaceRadius = world.getRadiusAtLatitude(latitude);
    if (currentRadius < surfaceRadius) {
      const scale = surfaceRadius / currentRadius;
      pos.x *= scale; pos.y *= scale; pos.z *= scale;
      this.camera.position.set(pos.x, pos.y, pos.z);
      State.player.position = { x: pos.x, y: pos.y, z: pos.z };
    }
  }
}

export const player = new PlayerSystem();