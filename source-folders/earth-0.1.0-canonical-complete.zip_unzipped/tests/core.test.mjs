import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG, SAVE, VERSION } from '../config.js';
import { sphereUnits, validateWorld, createWorld } from '../material.js';
import { R, solidAt, field, measureChange, buildTree, terrainRay, sphereRay } from '../terrain.js';
import { stepPhysics } from '../physics.js';
let assertions = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const ok = condition => { assert.ok(condition); assertions++; };
const throws = callback => { assert.throws(callback); assertions++; };
function bruteSphere(radius) {
  let units = 0;
  for (let x = Math.floor(-radius); x < Math.ceil(radius); x++)
    for (let y = Math.floor(-radius); y < Math.ceil(radius); y++)
      for (let z = Math.floor(-radius); z < Math.ceil(radius); z++)
        if ((x + 0.5) ** 2 + (y + 0.5) ** 2 + (z + 0.5) ** 2 <= radius * radius) units++;
  return units;
}
for (let radius = 1; radius <= 12; radius += 0.25) eq(sphereUnits(radius), bruteSphere(radius));
for (const radius of [NaN, 0, 13, Infinity, -1]) throws(() => sphereUnits(radius));
let seed = 12345;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
function bruteChange(edit, operations) {
  let units = 0;
  for (let x = Math.floor(edit.x - edit.r); x < Math.ceil(edit.x + edit.r); x++)
    for (let y = Math.floor(edit.y - edit.r); y < Math.ceil(edit.y + edit.r); y++)
      for (let z = Math.floor(edit.z - edit.r); z < Math.ceil(edit.z + edit.r); z++) {
        const p = [x + 0.5, y + 0.5, z + 0.5];
        if ((!edit.clipToPlanet || p.reduce((sum, value) => sum + value * value, 0) <= R * R)
          && (p[0] - edit.x) ** 2 + (p[1] - edit.y) ** 2 + (p[2] - edit.z) ** 2 <= edit.r * edit.r
          && solidAt(p, operations) === (edit.kind === 'cut')) units++;
      }
  return units;
}
const operations = [];
let inventory = 0;
for (let i = 0; i < 120; i++) {
  const edit = { x: random() * 12 - 6, y: R + random() * 10 - 6, z: random() * 12 - 6,
    r: 1 + random() * 3, kind: i % 4 ? 'cut' : 'fill', ...(i % 8 === 0 ? { clipToPlanet: true } : {}) };
  const units = bruteChange(edit, operations);
  if (edit.kind === 'fill' && units > inventory) continue;
  eq(measureChange(edit, operations), units);
  inventory += edit.kind === 'cut' ? units : -units;
  operations.push({ ...edit, units }); eq(measureChange(edit, operations), 0);
}
const tree = buildTree(operations);
eq(tree.length / 12, operations.length * 2 - 1);
for (let node = 0; node < tree.length / 12; node++) {
  ok(tree[node * 12 + 3] > node && tree[node * 12 + 3] <= tree.length / 12);
  if (tree[node * 12 + 7] > 0.5) {
    const index = Math.round(tree[node * 12 + 7]) - 1;
    eq(Math.abs(tree[node * 12 + 11]), operations[index].r);
  }
}
for (let i = 0; i < 200; i++) {
  const p = [random() * 14 - 7, R + random() * 12 - 6, random() * 14 - 7];
  eq(field(p, operations) <= 0, solidAt(p, operations));
}
const clipped = [{ x: 0, y: R, z: 0, r: 5, kind: 'fill', clipToPlanet: true, units: 0 }];
eq(solidAt([0, R + 2, 0], clipped), false); eq(solidAt([0, R - 2, 0], clipped), true);
const cut = { x: 0, y: R, z: 0, r: 3, kind: 'cut' };
ok(Math.abs(terrainRay([0, R + 10, 0], [0, -1, 0], [cut]) - 13) < 0.00001);
eq(terrainRay([0, R + 10, 0], [0, 1, 0], [cut]), null);
eq(sphereRay([0, 0, 0], [1, 0, 0], [5, 0, 0], 2), 3);
const world = { ...createWorld(), inventoryUnits: inventory, ops: operations };
validateWorld(world); assertions++;
const units = sphereUnits(2);
const rich = { ...createWorld(), inventoryUnits: 1000 - units,
  ops: [{ x: 0, y: R, z: 0, r: 10, kind: 'cut', units: 1000 }],
  bodies: [{ id: 'a', p: [0, R + 10, 0], r: 2, units, v: [0, 0, 0], w: [0, 0, 0] }] };
validateWorld(rich); assertions++;
rich.bodies[0].p[0] += 100; validateWorld(rich); assertions++;
throws(() => validateWorld({ ...rich, bodies: [rich.bodies[0], rich.bodies[0]] }));
throws(() => validateWorld({ ...rich, inventoryUnits: rich.inventoryUnits + 1 }));
const invalid = structuredClone(rich); invalid.bodies[0].r = 3; throws(() => validateWorld(invalid));
const recovered = structuredClone(rich); recovered.inventoryUnits += recovered.bodies.pop().units;
validateWorld(recovered); eq(recovered.inventoryUnits, 1000);
const falling = { id: 'f', p: [0, 10, 0], r: 1, units: sphereUnits(1), v: [0, 0, 0], w: [0, 0, 0] };
for (let i = 0; i < 60; i++) stepPhysics([falling], p => p[1], 1 / 60, null, () => [0, -9.81, 0]);
ok(falling.p[1] < 5.2 && falling.p[1] > 4.8);
for (let i = 0; i < 600; i++) stepPhysics([falling], p => p[1], 1 / 60, null, () => [0, -9.81, 0]);
ok(Math.abs(falling.p[1] - 1) < 0.01); eq(falling.units, sphereUnits(1));
const pair = [
  { id: 'p', p: [-1.01, 10, 0], r: 1, units: 8, v: [1, 0, 0], w: [0, 0, 0] },
  { id: 'q', p: [1.01, 10, 0], r: 1, units: 8, v: [-1, 0, 0], w: [0, 0, 0] },
];
for (let i = 0; i < 60; i++) stepPhysics(pair, () => 100, 1 / 60, null, () => [0, 0, 0]);
ok(Math.abs(pair[0].v[0] + pair[1].v[0]) < 1e-9); ok(pair[1].p[0] - pair[0].p[0] >= 1.999);
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
ok(!read('main.js').includes('stepPhysics(')); ok(read('simulation-worker.js').includes('stepPhysics(world.bodies'));
ok(!read('simulation-worker.js').includes('requestAnimationFrame')); ok(!read('renderer.js').includes('COMMAND.PAUSE'));
ok(read('terrain.frag').includes('if(fillCount==0)')); ok(!read('terrain.frag').includes('512'));
ok(!read('terrain.frag').includes('checker')); ok(read('main.js').includes('requestAnimationFrame(frame);'));
eq(SAVE.database, 'earth-physical-editor-v1'); eq(SAVE.format, 'earth-editor-v1');
eq(CONFIG.minimumRenderHeight, 1080); eq(CONFIG.targetRenderFPS, 60); eq(CONFIG.physicsHz, 60);
ok(Object.isFrozen(CONFIG)); ok(VERSION.includes('canonical'));
console.log(JSON.stringify({ suite: 'core', assertions, passed: true, randomTerrainOperations: operations.length, physicsSteps: 720 }));
