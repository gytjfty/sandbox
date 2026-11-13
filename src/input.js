/**
 * Input — First-person controls (pointer lock + WASD).
 * Writes directly to the Three.js camera and syncs to State.
 */

import * as THREE from 'three';
import { State } from './core.js';

export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);

    domElement.addEventListener('click', this._onClick);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
  }

  _onClick() {
    this.domElement.requestPointerLock();
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
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

  update(deltaTime) {
    const pointerLocked = document.pointerLockElement === this.domElement;
    if (!pointerLocked) return;

    const speed = 10 * deltaTime;
    const move = new THREE.Vector3();
    if (this.moveForward) move.z -= speed;
    if (this.moveBackward) move.z += speed;
    if (this.moveLeft) move.x -= speed;
    if (this.moveRight) move.x += speed;

    move.applyQuaternion(this.camera.quaternion);
    move.y = 0;
    this.camera.position.add(move);

    State.cameraPosition.x = this.camera.position.x;
    State.cameraPosition.y = this.camera.position.y;
    State.cameraPosition.z = this.camera.position.z;
    State.cameraRotation.x = this.camera.rotation.x;
    State.cameraRotation.y = this.camera.rotation.y;
    State.cameraRotation.z = this.camera.rotation.z;
  }

  get isPointerLocked() {
    return document.pointerLockElement === this.domElement;
  }
}