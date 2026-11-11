import assert from 'node:assert/strict';
import { buildTree, R } from '../terrain.js';
const legacy = { format: 'earth-backfill-v1', cellSize: 1, density: 2700, baselineCount: 0, inventoryUnits: 90,
  ops: [{ x: 0, y: R, z: 0, r: 5, kind: 'cut', units: 100 }, { x: 0, y: R, z: 0, r: 2, kind: 'fill', units: 10 }] };
const invalid = process.env.INVALID_SAVE === '1'; if (invalid) legacy.inventoryUnits++;
const original = JSON.stringify(legacy), data = new Map([['earth-rock-placement-v1', structuredClone(legacy)]]), output = [];
globalThis.self = globalThis; globalThis.postMessage = message => output.push(structuredClone(message));
Object.defineProperty(globalThis, 'navigator', { value: { locks: { request: async (name, options, fn) => fn({}) } }, configurable: true });
globalThis.setInterval = () => 0;
globalThis.Worker = class {
  postMessage(request) { queueMicrotask(() => this.onmessage({ data: { id: request.id, units: 0, nodes: buildTree(request.ops) } })); }
};
globalThis.indexedDB = {
  open(name) {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {},
        transaction() {
          const transaction = { objectStore() { return {
            get() {
              const get = {};
              queueMicrotask(() => { get.result = structuredClone(data.get(name)); get.onsuccess(); }); return get;
            },
            put(value) { const saved = structuredClone(value); queueMicrotask(() => { data.set(name, saved); transaction.oncomplete(); }); },
          }; } };
          return transaction;
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
await import('../simulation-worker.js'); await new Promise(resolve => setTimeout(resolve, 10));
if (invalid) {
  assert.ok(output.some(message => message.type === 'fatal'));
  assert.equal(data.has('earth-physical-editor-v1'), false);
  assert.equal(JSON.stringify(data.get('earth-rock-placement-v1')), original);
  console.log(JSON.stringify({ suite: 'invalid-legacy-rejection', assertions: 3, passed: true, noReplacementRecord: true }));
  process.exit(0);
}
assert.ok(!output.some(message => message.type === 'fatal'));
const migrated = data.get('earth-physical-editor-v1');
assert.ok(migrated); assert.equal(migrated.format, 'earth-editor-v1'); assert.equal(migrated.inventoryUnits, 90);
assert.equal(migrated.ops.length, 2); assert.equal(migrated.ops[1].clipToPlanet, true);
assert.equal(JSON.stringify(data.get('earth-rock-placement-v1')), original);
assert.deepEqual(migrated.bodies, []); assert.equal(output.filter(message => message.type === 'terrain').length, 1);
console.log(JSON.stringify({ suite: 'legacy-migration', assertions: 9, passed: true, originalDatabaseUnmodified: true }));
