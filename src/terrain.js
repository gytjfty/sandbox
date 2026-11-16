/**
 * Terrain — Cube-sphere heightfield terrain system with LOD and geographic features.
 * Maps height data onto a 6-face cube-sphere covering the full planet.
 * Separates terrain data from Three.js visual meshes.
 * Supports multi-resolution loading and distance-based detail.
 */

import * as THREE from 'three';
import { world } from './world.js';

/** Elevation categories (meters above sea level, seaLevel = 0) */
export const ElevationCategory = {
  DEEP_OCEAN: -1000,
  OCEAN_BASE: 0,
  SHELF_TOP: 100,
  BEACH: 200,
  PLAIN: 500,
  HILL: 1500,
  MOUNTAIN: 3000,
  PLATEAU: 4000,
  ALPINE: 5000
};

/** Geological layer thresholds (simplified) */
export const GeologicalLayer = {
  SOIL_MAX: 2,
  SEDIMENT_MAX: 10,
  ROCK_CUTOFF: 500,
  BEDROCK_DEPTH: 200
};

const SEA_LEVEL = 0; // meters, relative to planet mean radius
const PLANET_MEAN_RADIUS = world.meanRadius;

/**
 * TerrainSystem — Cube-sphere heightfield terrain system with LOD and geographic features.
 * Maps height data onto a 6-face cube-sphere covering the full planet.
 * Separates terrain data from Three.js visual meshes.
 * Supports multi-resolution loading and distance-based detail.
 */
export class TerrainSystem {
  constructor({ resolution = 33 } = {}) {
    this.resolution = resolution;
    this.faceCount = 6;
    this.heightfields = [];
    this.continentMask = [];
    this.detailMasks = [];
    this._dirty = true;
    this.lodDirty = true;
    this.planetRadius = PLANET_MEAN_RADIUS;
    this.seaLevel = SEA_LEVEL;
    const size = resolution * resolution;
    for (let i = 0; i < 6; i++) {
      this.heightfields.push(new Float32Array(size));
      this.continentMask.push(new Uint8Array(size));
      this.detailMasks.push(new Uint8Array(size));
      for (let j = 0; j < size; j++) {
        this.heightfields[i][j] = SEA_LEVEL;
        this.continentMask[i][j] = 0;
        this.detailMasks[i][j] = 0;
      }
    }
  }

  init(options = {}) {
    this._initializeBaseGeography(options);
    this._dirty = true;
    this.lodDirty = true;
    this._initialState = {
      heightfields: this.heightfields.map(f => new Float32Array(f)),
      continentMask: this.continentMask.map(f => new Uint8Array(f))
    };
    console.log('Terrain initialized with base geography');
  }

  _initializeBaseGeography(options) {
    const continentCount = options.continentCount || 6;
    const oceanDepth = -50;

    for (let face = 0; face < 6; face++) {
      this._generateFaceGeography(face, continentCount, oceanDepth);
    }
    this._computeCoastlines();
  }

  _generateFaceGeography(face, continentCount, oceanDepth) {
    const res = this.resolution;
    const size = res * res;
    const hf = this.heightfields[face];
    const mask = this.continentMask[face];

    const targetLandCells = Math.floor(size * 0.29);
    const landPerContinent = Math.floor(targetLandCells / continentCount);
    const remainder = targetLandCells - landPerContinent * continentCount;

    for (let c = 0; c < continentCount; c++) {
      const target = landPerContinent + (c < remainder ? 1 : 0);
      if (target <= 0) continue;
      this._growContinent(face, hf, mask, target, oceanDepth);
    }

    this._addMountainRanges(face, hf, mask);
    this._addInteriorFeatures(face, hf, mask);
  }
  _growContinent(face, hf, mask, targetCells, oceanDepth) {
    const res = this.resolution;
    let added = 0;
    const seedI = Math.floor(res / 2) + (Math.random() - 0.5) * 5;
    const seedJ = Math.floor(res / 2) + (Math.random() - 0.5) * 5;
    const maxRadius = Math.sqrt(targetCells / Math.PI) + 2;

    for (let r = 1; r <= Math.ceil(maxRadius) && added < targetCells; r++) {
      const cellsInRing = Math.floor(2 * Math.PI * r);
      const cellsToAdd = Math.min(cellsInRing, targetCells - added);

      for (let k = 0; k < cellsToAdd; k++) {
        const angle = (k / Math.max(1, cellsToAdd)) * 2 * Math.PI;
        const i = seedI + Math.round(r * Math.cos(angle));
        const j = seedJ + Math.round(r * Math.sin(angle));

        if (i >= 0 && i < res && j >= 0 && j < res) {
          const idx = j * res + i;
          if (mask[idx] === 0) {
            mask[idx] = 1;
            const distance = Math.sqrt(Math.pow(i - seedI, 2) + Math.pow(j - seedJ, 2));
            const baseHeight = 600 + Math.random() * 400 + SEA_LEVEL;
            hf[idx] = Math.max(SEA_LEVEL + 100, baseHeight - r * 30 - distance * 5);
            added++;
          }
        }
      }
    }
  }

  _addMountainRanges(face, hf, mask) {
    const res = this.resolution;
    const numRanges = 2 + Math.floor(Math.random() * 3);

    for (let r = 0; r < numRanges; r++) {
      const orientation = Math.random() * Math.PI * 2;
      const length = res * 0.5;
      const heightBoost = 500 + Math.random() * 1000;

      for (let pos = 0; pos < length; pos++) {
        const i = Math.floor(res / 2 + pos * Math.cos(orientation));
        const j = Math.floor(res / 2 + pos * Math.sin(orientation));

        if (i >= 0 && i < res && j >= 0 && j < res && mask[j * res + i] === 1) {
          const idx = j * res + i;
          hf[idx] += heightBoost * Math.exp(-Math.abs(pos - length / 2) / (length / 4));
          if (hf[idx] < SEA_LEVEL + 500) hf[idx] = SEA_LEVEL + 500;
        }
      }
    }
  }

  _addInteriorFeatures(face, hf, mask) {
    const res = this.resolution;

    const numBasins = 1 + Math.floor(Math.random() * 3);
    for (let b = 0; b < numBasins; b++) {
      const landCells = [];
      for (let idx = 0; idx < res * res; idx++) {
        if (mask[idx] === 1 && hf[idx] > SEA_LEVEL + 100) {
          landCells.push(idx);
        }
      }
      if (landCells.length === 0) continue;
      const idx = landCells[Math.floor(Math.random() * landCells.length)];
      const j = Math.floor(idx / res);
      const i = idx % res;
      const basinRadius = Math.floor(res * 0.15);
      const basinDepth = -200;

      for (let di = -basinRadius; di <= basinRadius; di++) {
        for (let dj = -basinRadius; dj <= basinRadius; dj++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && ni < res && nj >= 0 && nj < res) {
            const nidx = nj * res + ni;
            const dist = Math.sqrt(di * di + dj * dj);
            if (dist <= basinRadius) {
              const falloff = 1 - dist / basinRadius;
              hf[nidx] = SEA_LEVEL + 50 + falloff * basinDepth;
              mask[nidx] = 1;
            }
          }
        }
      }
    }

    const numPlateaus = Math.floor(Math.random() * 2);
    for (let p = 0; p < numPlateaus; p++) {
      const pi = Math.floor(res * (0.3 + Math.random() * 0.4));
      const pj = Math.floor(res * (0.3 + Math.random() * 0.4));
      const pradius = Math.floor(res * 0.1);
      const plateauElev = 2000 + Math.random() * 1000;

      for (let di = -pradius; di <= pradius; di++) {
        for (let dj = -pradius; dj <= pradius; dj++) {
          const ni = pi + di;
          const nj = pj + dj;
          if (ni >= 0 && ni < res && nj >= 0 && nj < res) {
            const nidx = nj * res + ni;
            const dist = Math.abs(di) + Math.abs(dj);
            if (dist <= pradius) {
              const falloff = 1 - dist / pradius;
              hf[nidx] = SEA_LEVEL + plateauElev * falloff;
              mask[nidx] = 1;
            }
          }
        }
      }
    }
  }
  _computeCoastlines() {
    for (let face = 0; face < 6; face++) {
      this._computeFaceCoastline(face);
    }
  }

  _computeFaceCoastline(face) {
    const res = this.resolution;
    const hf = this.heightfields[face];
    const mask = this.continentMask[face];

    for (let idx = 0; idx < res * res; idx++) {
      if (hf[idx] > SEA_LEVEL + 5) {
        mask[idx] = 1;
      } else {
        mask[idx] = 0;
      }
    }

    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const idx = j * res + i;
        if (mask[idx] !== 1) continue;

        let isCoastline = false;
        for (const [di, dj] of directions) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && ni < res && nj >= 0 && nj < res) {
            const nidx = nj * res + ni;
            if (mask[nidx] === 0) {
              isCoastline = true;
              break;
            }
          } else {
            isCoastline = true;
            break;
          }
        }

        if (isCoastline) {
          mask[idx] = 2;
        }
      }
    }
  }
  static getCategory(height) {
    if (height <= -500) return 'deep-ocean';
    if (height <= 0) return 'ocean-basin';
    if (height <= 100) return 'shelf';
    if (height <= 200) return 'beach';
    if (height <= 500) return 'plain';
    if (height <= 1500) return 'hill';
    if (height <= 3000) return 'mountain';
    if (height <= 4000) return 'plateau';
    return 'alpine';
  }

  static getColor(category) {
    const colors = {
      'deep-ocean': 0x001f3f,
      'ocean-basin': 0x003366,
      'shelf': 0x005f87,
      'beach': 0xcd853f,
      'plain': 0x9acd32,
      'hill': 0x7C9E35,
      'mountain': 0x8B4513,
      'plateau': 0xD2B48C,
      'alpine': 0x8FBC8F
    };
    return colors[category] || 0x888888;
  }
  getHeightAtWorld(x, y, z) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    if (faceIndex === null) return null;
    const h = this.getHeight(faceIndex, u, v);
    return h;
  }

  getHeight(faceIndex, u, v) {
    const res = this.resolution;
    const iu = Math.round(((u + 1) / 2) * (res - 1));
    const iv = Math.round(((v + 1) / 2) * (res - 1));
    const ci = Math.max(0, Math.min(res - 1, iu));
    const ci2 = Math.max(0, Math.min(res - 1, iv));
    return this.heightfields[faceIndex][ci2 * res + ci];
  }

  setHeight(faceIndex, u, v, value) {
    const res = this.resolution;
    const iu = Math.round(((u + 1) / 2) * (res - 1));
    const iv = Math.round(((v + 1) / 2) * (res - 1));
    const ci = Math.max(0, Math.min(res - 1, iu));
    const ci2 = Math.max(0, Math.min(res - 1, iv));
    this.heightfields[faceIndex][ci2 * res + ci] = value;
    this._dirty = true;
    this.lodDirty = true;
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

    return {
      faceIndex: faceIndex,
      u: Math.max(-1, Math.min(1, u)),
      v: Math.max(-1, Math.min(1, v))
    };
  }
  getHeightAt(x, y, z, cameraDistance) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    if (faceIndex === null) return SEA_LEVEL;

    const effectiveRes = this._getEffectiveResolution(cameraDistance);
    const res = this.resolution;

    if (effectiveRes >= res) {
      return this.getHeight(faceIndex, u, v);
    }

    const scale = res / effectiveRes;
    const baseIu = Math.floor(((u + 1) / 2) * effectiveRes);
    const baseIv = Math.floor(((v + 1) / 2) * effectiveRes);

    const iu0 = Math.max(0, Math.min(effectiveRes - 1, baseIu));
    const iv0 = Math.max(0, Math.min(effectiveRes - 1, baseIv));
    const iu1 = Math.min(effectiveRes - 1, iu0 + 1);
    const iv1 = Math.min(effectiveRes - 1, iv0 + 1);

    const h00 = this.heightfields[faceIndex][iv0 * effectiveRes + iu0];
    const h01 = this.heightfields[faceIndex][iv0 * effectiveRes + iu1];
    const h10 = this.heightfields[faceIndex][iv1 * effectiveRes + iu0];
    const h11 = this.heightfields[faceIndex][iv1 * effectiveRes + iu1];

    const dx = ((u + 1) / 2 * effectiveRes) - iu0;
    const dy = ((v + 1) / 2 * effectiveRes) - iv0;
    const dx1 = 1 - dx;
    const dy1 = 1 - dy;

    return (
      h00 * dx1 * dy1 +
      h01 * dx * dy1 +
      h10 * dx1 * dy +
      h11 * dx * dy
    );
  }

  _getEffectiveResolution(cameraDistance) {
    if (cameraDistance === undefined) return this.resolution;

    const pr = this.planetRadius;

    if (cameraDistance > 3 * pr) {
      return Math.max(9, Math.floor(this.resolution / 3));
    } else if (cameraDistance > 1.5 * pr) {
      return Math.max(17, Math.floor(this.resolution / 2));
    } else {
      return this.resolution;
    }
  }
  modifyTerrain(x, y, z, radius, strength, type = 'raise', cameraDistance) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    if (faceIndex === null) return;

    const res = this.resolution;
    const offset = type === 'raise' ? strength : -strength;

    for (let iy = 0; iy < res; iy++) {
      const vv = (iy / (res - 1)) * 2 - 1;
      for (let ix = 0; ix < res; ix++) {
        const vu = (ix / (res - 1)) * 2 - 1;
        const du = vu - u;
        const dv = vv - v;
        const dist = Math.sqrt(du * du + dv * dv);
        const falloff = Math.exp(-(dist * dist) / (radius * 2));
        const idx = iy * res + ix;

        const newHeight = this.heightfields[faceIndex][idx] + offset * falloff * 10;
        this.heightfields[faceIndex][idx] = Math.max(-1000, Math.min(10000, newHeight));
      }
    }

    this._dirty = true;
    this.lodDirty = true;
  }

  carveTerrain(x, y, z, radius) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    if (faceIndex === null) return;

    const res = this.resolution;

    for (let iy = 0; iy < res; iy++) {
      for (let ix = 0; ix < res; ix++) {
        const vu = (ix / (res - 1)) * 2 - 1;
        const vv = (iy / (res - 1)) * 2 - 1;
        const du = vu - u;
        const dv = vv - v;
        const dist = Math.sqrt(du * du + dv * dv);
        const falloff = Math.exp(-(dist * dist) / (radius * 2));

        const carveDepth = -falloff * radius * 0.1;
        this.heightfields[faceIndex][iy * res + ix] = Math.max(-1000, this.heightfields[faceIndex][iy * res + ix] + carveDepth);
      }
    }

    this._dirty = true;
    this.lodDirty = true;
  }

  addVolume(x, y, z, radius) {
    const { faceIndex, u, v } = this.worldToFace(x, y, z);
    if (faceIndex === null) return;

    const res = this.resolution;

    for (let iy = 0; iy < res; iy++) {
      for (let ix = 0; ix < res; ix++) {
        const vu = (ix / (res - 1)) * 2 - 1;
        const vv = (iy / (res - 1)) * 2 - 1;
        const du = vu - u;
        const dv = vv - v;
        const dist = Math.sqrt(du * du + dv * dv);
        const falloff = Math.exp(-(dist * dist) / (radius * 2));

        const addHeight = falloff * radius * 0.5;
        this.heightfields[faceIndex][iy * res + ix] = Math.min(10000, this.heightfields[faceIndex][iy * res + ix] + addHeight);
      }
    }

    this._dirty = true;
    this.lodDirty = true;
  }
  getGeologicalInfo(elevation) {
    let soilThickness = GeologicalLayer.SOIL_MAX;
    let rockExposure = false;
    let bedrockDepth = GeologicalLayer.BEDROCK_DEPTH;

    if (elevation >= GeologicalLayer.ROCK_CUTOFF) {
      const relElevation = elevation - GeologicalLayer.ROCK_CUTOFF;
      soilThickness = Math.max(0, GeologicalLayer.SOIL_MAX - Math.floor(relElevation / 200));
      soilThickness = Math.min(soilThickness, GeologicalLayer.SOIL_MAX - Math.floor(Math.max(0, elevation - 500) / 500) * 2);
    } else {
      rockExposure = true;
      bedrockDepth = Math.max(0, GeologicalLayer.BEDROCK_DEPTH - elevation);
    }

    if (elevation <= 0) {
      soilThickness = 0;
      rockExposure = true;
      bedrockDepth = 0;
    }

    return { soilThickness, rockExposure, bedrockDepth };
  }

  updateMesh() {
    if (!this._dirty && !this.lodDirty) return;

    if (this.lodDirty) {
      this._rebuildMeshes();
      this.lodDirty = false;
    } else if (this._dirty) {
      this._rebuildMeshes();
      this._dirty = false;
    }
  }

  getMeshes() {
    return this.meshes.filter(m => m.userData.visibleAlways);
  }

  getAllMeshes() {
    return this.meshes;
  }

  dispose() {
    this.meshes.forEach((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
  }
  _rebuildMeshes() {
    this.meshes = [];
    this.geometries = [];

    const lodLevels = this._computeLodLevels();
    const planetRadius = this.planetRadius;

    for (let face = 0; face < 6; face++) {
      const faceMeshes = [];

      for (let lod = 0; lod < lodLevels.length; lod++) {
        const { resolution, startResolution } = lodLevels[lod];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(resolution * resolution * 3);
        const colors = new Float32Array(resolution * resolution * 3);

        for (let iy = 0; iy < resolution; iy++) {
          for (let ix = 0; ix < resolution; ix++) {
            const u = ix * 2 / (resolution - 1) - 1;
            const v = iy * 2 / (resolution - 1) - 1;

            const h = this.getHeight(face, u, v);

            const baseVec = this._getBaseVector(face, u, v);
            const finalRadius = planetRadius + h;
            const idx = (iy * resolution + ix) * 3;

            positions[idx] = baseVec.x * finalRadius;
            positions[idx + 1] = baseVec.y * finalRadius;
            positions[idx + 2] = baseVec.z * finalRadius;

            const category = TerrainSystem.getCategory(h);
            const color = TerrainSystem.getColor(category);
            colors[idx] = ((color >> 16) & 0xff) / 255;
            colors[idx + 1] = ((color >> 8) & 0xff) / 255;
            colors[idx + 2] = (color & 0xff) / 255;
          }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          metalness: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `terrain-face-${face}-lod${lod}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.lodLevel = lod;
        mesh.userData.visibleAlways = lod === 0;

        faceMeshes.push(mesh);
      }

      this.geometries.push(...faceMeshes);
      this.meshes.push(...faceMeshes);
    }
  }

  _computeLodLevels() {
    const pr = this.planetRadius;
    const resolutions = [this.resolution];

    if (this.resolution >= 33) {
      resolutions.push(17);
      resolutions.push(9);
    } else if (this.resolution >= 17) {
      resolutions.push(9);
    }

    return resolutions.map((res, idx) => ({
      resolution: res,
      startResolution: resolutions[Math.max(0, idx - 1)]
    }));
  }

  _getBaseVector(face, u, v) {
    const baseX = u;
    const baseY = v;
    const baseZ = Math.sqrt(Math.max(0, 1 - u * u - v * v));

    switch (face) {
      case 0: return new THREE.Vector3(1, u, -v);
      case 1: return new THREE.Vector3(-1, u, v);
      case 2: return new THREE.Vector3(u, 1, v);
      case 3: return new THREE.Vector3(u, -1, -v);
      case 4: return new THREE.Vector3(u, v, 1);
      case 5: return new THREE.Vector3(-u, v, -1);
      default: return new THREE.Vector3(1, 0, 0);
    }
  }

  getCategoryForHeight(height) {
    return TerrainSystem.getCategory(height);
  }

  getColorForHeight(height) {
    return TerrainSystem.getColor(TerrainSystem.getCategory(height));
  }
}
export const terrain = new TerrainSystem();
