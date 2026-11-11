import { CONFIG } from './config.js';
import { add, scale, dot, unit, cross } from './physics.js';
import { R, terrainRay } from './terrain.js';
import { sphereUnits } from './material.js';
const clone = value => structuredClone(value);
export class DraftEditor {
  constructor() {
    this.open = false; this.parts = []; this.selected = -1;
    this.undo = []; this.redo = []; this.origin = [0, R, 0];
    this.basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  }
  setOpen(open, player, operations, forward) {
    this.open = open;
    if (!open || this.parts.length) return;
    const distance = terrainRay(player.p, forward, operations);
    this.origin = add(player.p, scale(forward, distance ?? 10));
    const up = unit(this.origin);
    let right = unit(cross(forward, up));
    if (Math.abs(dot(right, up)) > 0.99) right = unit(cross([0, 0, 1], up));
    this.basis = [right, up, unit(cross(right, up))];
    this.parts = [{ p: [0, 2.05, 0], r: 2 }]; this.selected = 0;
    this.undo = []; this.redo = [];
  }
  worldPart(part) {
    let position = this.origin.slice();
    for (let axis = 0; axis < 3; axis++) position = add(position, scale(this.basis[axis], part.p[axis]));
    return { p: position, r: part.r };
  }
  get cost() { return this.parts.reduce((sum, part) => sum + sphereUnits(part.r), 0); }
  remember() {
    this.undo.push({ parts: clone(this.parts), selected: this.selected });
    if (this.undo.length > CONFIG.draftHistoryLimit) this.undo.shift();
    this.redo = [];
  }
  history(redo = false) {
    const source = redo ? this.redo : this.undo, destination = redo ? this.undo : this.redo;
    if (!source.length) return;
    destination.push({ parts: clone(this.parts), selected: this.selected });
    const previous = source.pop(); this.parts = previous.parts; this.selected = previous.selected;
  }
  add() {
    if (!this.open || this.parts.length >= CONFIG.maxDraftParts) return;
    this.remember(); const selected = this.parts[this.selected];
    this.parts.push({ p: selected ? add(selected.p, [selected.r * 2 + 0.1, 0, 0]) : [0, 2.05, 0], r: selected?.r || 2 });
    this.selected = this.parts.length - 1;
  }
  remove() {
    if (!this.open || this.selected < 0) return;
    this.remember(); this.parts.splice(this.selected, 1);
    this.selected = Math.min(this.selected, this.parts.length - 1);
  }
  tower(count) {
    if (!this.open) return;
    this.remember();
    const total = Math.max(2, Math.min(32, Math.floor(Number(count)) || 6));
    const radius = this.parts[this.selected]?.r || 2;
    this.parts = Array.from({ length: total }, (_, i) => ({ p: [i * 0.06, radius + 0.05 + i * radius * 2, 0], r: radius }));
    this.selected = 0;
  }
  coordinate(axis, value, record = true) {
    if (this.selected < 0) return;
    if (!Number.isFinite(value) || Math.abs(value) > CONFIG.maxLocalCoordinate) throw Error('Invalid local coordinate.');
    if (record) this.remember();
    this.parts[this.selected].p[axis] = value;
  }
  radius(value) {
    if (this.selected < 0) return;
    sphereUnits(value); this.remember(); this.parts[this.selected].r = value;
  }
  export() { return { format: 'earth-sphere-design-v1', parts: clone(this.parts) }; }
  import(design) {
    if (design.format !== 'earth-sphere-design-v1' || !Array.isArray(design.parts)
      || design.parts.length > CONFIG.maxDraftParts) throw Error('Invalid design.');
    const parts = design.parts.map(part => {
      if (!Array.isArray(part.p) || part.p.length !== 3
        || part.p.some(value => !Number.isFinite(value) || Math.abs(value) > CONFIG.maxLocalCoordinate)) {
        throw Error('Invalid design coordinate.');
      }
      sphereUnits(part.r); return { p: part.p.slice(), r: part.r };
    });
    this.remember(); this.parts = parts; this.selected = parts.length ? 0 : -1;
  }
  built() { this.parts = []; this.selected = -1; this.undo = []; this.redo = []; this.open = false; }
}
