/**
 * World — Planetary representation.
 * Oblate spheroid Earth with cube-sphere terrain mapping.
 * Separates planetary data from Three.js visual representation.
 */

import { Vector3 } from 'three';

/**
 * WorldSystem — Core planetary data and operations.
 * Design: Oblate spheroid model, cube-sphere terrain mapping,
 * separation of data from visuals.
 */

export class WorldSystem {
  constructor() {
    // WGS-84 ellipsoid parameters
    this.equatorialRadius = 6378137;
    this.polarRadius = 6356752;
    this.inverseFlattening = 298.257223563;

    // Derived mean radius
    this.meanRadius = (2 * this.equatorialRadius + this.polarRadius) / 3;

    // Cube-sphere terrain system
    this.terrain = null;
    this.modifications = [];
  }

  /**
   * Get the effective radius at a given latitude.
   * Uses the WGS-84 ellipsoid formula.
   * latitude: radians, 0 = equator, +/-PI/2 = poles
   */
  getRadiusAtLatitude(latitude) {
    const sinLat = Math.sin(latitude);
    const cosLat = Math.cos(latitude);
    const num = this.equatorialRadius * this.equatorialRadius * cosLat;
    const den = Math.sqrt(this.equatorialRadius * this.equatorialRadius * cosLat * cosLat + this.polarRadius * this.polarRadius * sinLat * sinLat);
    return num / den;
  }

  /**
   * Get latitude from a 3D position vector on the surface.
   * Returns latitude in radians.
   */
  getLatitudeFromVector(vector) {
    const len = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    const zOverLen = vector.z / len;
    return Math.asin(zOverLen);
  }

  /**
   * Get the up direction (toward planet center) at a given position.
   * Essential for gravity and orientation.
   */
  getUpVector(position) {
    const len = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    return new Vector3(position.x / len, position.y / len, position.z / len);
  }

  /**
   * Get the "horizontal" direction (tangent to surface, southward reference).
   * Used for orientation.
   */
  getSouthVector(position) {
    const up = this.getUpVector(position);
    const worldUp = new Vector3(0, 1, 0);
    let right = worldUp.cross(position.clone().normalize());
    if (right.lengthSq() < 0.001) {
      worldUp.set(1, 0, 0);
      right = worldUp.cross(position.clone().normalize());
    }
    right.normalize();
    const south = position.clone().normalize().cross(right);
    return south;
  }

  /**
   * Convert spherical-ish coordinates (longitude, latitude) to 3D vector on surface.
   * Longitude: radians, 0 = prime meridian, positive east
   * Latitude: radians, 0 = equator, positive north
   * radius: optional, uses mean radius if not provided
   */
  sphericalToVector(longitude, latitude, radius = this.meanRadius) {
    const x = radius * Math.cos(latitude) * Math.cos(longitude);
    const y = radius * Math.cos(latitude) * Math.sin(longitude);
    const z = radius * Math.sin(latitude);
    return new Vector3(x, y, z);
  }

  /**
   * Convert 3D vector to spherical coordinates (longitude, latitude, radius).
   * Returns: { longitude, latitude, radius } with longitude in [0, 2PI], latitude in [-PI/2, PI/2]
   */
  vectorToSpherical(vector) {
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;
    const radius = Math.sqrt(x * x + y * y + z * z);
    let latitude = Math.asin(z / radius);
    let longitude = Math.atan2(y, x);
    if (longitude < 0) longitude += Math.PI * 2;
    return { longitude, latitude, radius };
  }

  /**
   * Map a 3D world position to cube-face coordinates for terrain operations.
   * Returns { faceIndex, u, v } where u,v are in [-1, 1]
   */
  worldToFaceCoords(x, y, z) {
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
      faceIndex,
      u: Math.max(-1, Math.min(1, u)),
      v: Math.max(-1, Math.min(1, v))
    };
  }

  /**
   * Modify terrain at a world position.
   */
  modifyTerrain(x, y, z, radius, strength, type = 'raise') {
    this.modifications.push({ x, y, z, radius, strength, type, time: Date.now() });
  }

  /**
   * Carve a subtractive volume at world position.
   */
  carveTerrain(x, y, z, radius) {
    this.modifications.push({ x, y, z, radius, type: 'carve', time: Date.now() });
  }

  /**
   * Add an additive volumetric blob.
   */
  addVolume(x, y, z, radius) {
    this.modifications.push({ x, y, z, radius, type: 'add', time: Date.now() });
  }

  /**
   * Get the gravity direction at a position (toward planet center).
   */
  getGravityDirection(position) {
    const len = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    return { x: position.x / len, y: position.y / len, z: position.z / len };
  }

  /**
   * Check if a position is inside the planet (below surface).
   */
  isBelowSurface(position) {
    const radius = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    return radius < this.getRadiusAtLatitude(this.getLatitudeFromVector(position));
  }
}

export const world = new WorldSystem();
