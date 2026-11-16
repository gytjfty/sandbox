/**
 * Terrain — Cube-sphere heightfield terrain system.
 * Maps height data onto a 6-face cube-sphere covering the full planet.
 * Separates terrain data from Three.js visual meshes.
 */

import { Vector3 } from 'three';
import { State } from './core.js';

export class TerrainSystem {
  constructor({ resolution = 33 } = {}) {
    this.resolution = resolution;
    this.faceCount = 6;
    this.heightfields = [];
    for (let i = 0; i < 6; i++) {
      this.heightfields.push(new Float32Array(resolution * resolution));
    }
    this._dirty = true;
    this.planetRadius = world.meanRadius;
  }

  init() {
    this._initializeHeightfields();
    this._dirty = true;
  }

  _initializeHeightfields() {
    const size = this.resolution * this.resolution;
    for (let i = 0; i < 6; i++) {
      const arr = this.heightfields[i];
      for (let j = 0; j < size; j++) {
        arr[j] = 0;
      }
    }
  }

  worldToFace(x, y, z) {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);
    let faceIndex, u, v;
    if (absX >= absY && absX >= absZ) {
      faceIndex = x > 0 ? 0 : 1;
      const s = absX;
      u = x > 0 ? -z / s : z / s;
      v = y / s;
    } else if (absY >= absX && absY >= absZ) {
      faceIndex = y > 0 ? 2 : 3;
      const s = absY;
      u = x / s;
      v = y > 0 ? z / s : -z / s;
    } else {
      faceIndex = z > 0 ? 4 : 5;
      const s = absZ;
      u = x > 0 ? x / s : -x / s;
      v = y / s;
    }
    return { faceIndex, u: Math.max(-1, Math.min(1, u)), v: Math.max(-1, Math.min(1, v)) };
  }

  getHeight(faceIndex, u, v) {
    const res = this.resolution;
    const iu = Math.round(((u + 1) / 2) * (res - 1));
    const iv = Math.round(((v + 1) / 2) * (res - 1));
    return this.heightfields[faceIndex][iv * res + iu];
  }

  setHeight(faceIndex, u, v, value) {
    const res = this.resolution;
    const iu = Math.round(((u + 1) / 2) * (res - 1));
    const iv = Math.round(((v + 1) / 2) * (res - 1));
    this.heightfields[faceIndex][iv * res + iu] = value;
    this._dirty = true;
  }

  modifyTerrain(x, y, z, radius, strength, type) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    const res = this.resolution;
    const centerIu = Math.round(((u + 1) / 2) * (res - 1));
    const centerIv = Math.round(((v + 1) / 2) * (res - 1));
    for (let iy = 0; iy < res; iy++) {
      for (let ix = 0; ix < res; ix++) {
        const vu = (ix / (res - 1)) * 2 - 1;
        const vv = (iy / (res - 1)) * 2 - 1;
        const du = vu - u;
        const dv = vv - v;
        const dist = Math.sqrt(du * du + dv * dv);
        const falloff = Math.exp(-(dist * dist) / (radius * 2));
        const offset = type === 'raise' ? strength : type === 'lower' ? -strength : 0;
        const newHeight = this.heightfields[faceIndex][iy * res + ix] + offset * falloff * 10;
        this.heightfields[faceIndex][iy * res + ix] = Math.max(-1000, newHeight);
      }
    }
  }

  _rebuildMeshes() {
    this.meshes.forEach((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.meshes = [];
    this.geometries = [];
    const res = this.resolution;
    const planetRadius = this.planetRadius;
    for (let face = 0; face < 6; face++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(res * res * 3);
      for (let iy = 0; iy < res; iy++) {
        for (let ix = 0; ix < res; ix++) {
          const u = ix * 2 / (res - 1) - 1;
          const v = iy * 2 / (res - 1) - 1;
          let baseX, baseY, baseZ;
          switch (face) {
            case 0: baseX = 1; baseY = u; baseZ = -v; break;
            case 1: baseX = -1; baseY = u; baseZ = v; break;
            case 2: baseX = u; baseY = 1; baseZ = v; break;
            case 3: baseX = u; baseY = -1; baseZ = -v; break;
            case 4: baseX = u; baseY = v; baseZ = 1; break;
            case 5: baseX = -u; baseY = v; baseZ = -1; break;
          }
          const baseVec = new THREE.Vector3(baseX, baseY, baseZ).normalize();
          const h = this.heightfields[face][iy * res + ix];
          const finalRadius = planetRadius + h;
          const idx = (iy * res + ix) * 3;
          positions[idx] = baseVec.x * finalRadius;
          positions[idx + 1] = baseVec.y * finalRadius;
          positions[idx + 2] = baseVec.z * finalRadius;
        }
      }
      for (let iy = 0; iy < res - 1; iy++) {
        for (let ix = 0; ix < res - 1; ix++) {
          const a = iy * res + ix;
          const b = iy * res + (ix + 1);
          const c = (iy + 1) * res + ix;
          const d = (iy + 1) * res + (ix + 1);
          indices.push(a, b, c, b, d, c);
        }
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.MeshStandardMaterial({
        color: 0x228b22,
        roughness: 0.8,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `terrain-face-${face}`;
      this.geometries.push(geometry);
      this.meshes.push(mesh);
    }
  }

  updateMesh() {
    if (!this._dirty) return;
    this._rebuildMeshes();
    this._dirty = false;
  }

  getMeshes() {
    return this.meshes;
  }

  dispose() {
    this.meshes.forEach((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
  }
}

export const terrain = new TerrainSystem();