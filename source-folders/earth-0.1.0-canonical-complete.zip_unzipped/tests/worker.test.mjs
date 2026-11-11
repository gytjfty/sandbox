import assert from 'node:assert/strict';
import { measureChange, buildTree, R } from '../terrain.js';
import { sphereUnits } from '../material.js';
let assertions = 0;
const eq = (a, b) => { assert.deepEqual(a, b); assertions++; };
const ok = value => { assert.ok(value); assertions++; };
const seed = { format: 'earth-editor-v1', cellSize: 1, density: 2700, baselineCount: 0,
  inventoryUnits: 1000, ops: [{ x: 100, y: R - 10, z: 0, r: 8, kind: 'cut', units: 1000 }], bodies: [] };
const data = new Map([['earth-physical-editor-v1', structuredClone(seed)]]), messages = [], intervals = [];
let clock = 1000, failNext = false;
globalThis.performance = { now: () => clock }; globalThis.self = globalThis;
globalThis.postMessage = message => {
  messages.push(structuredClone(message));
  if (message.type === 'state') queueMicrotask(() => self.onmessage({ data: { type: 'stateAck' } }));
};
Object.defineProperty(globalThis, 'navigator', { value: { locks: { request: async (name, options, fn) => fn({ name }) } }, configurable: true });
globalThis.Worker = class {
  postMessage(request) {
    queueMicrotask(() => {
      try {
        const units = request.edit ? measureChange(request.edit, request.ops) : 0;
        const nodes = buildTree(request.edit ? [...request.ops, { ...request.edit, units }] : request.ops);
        this.onmessage?.({ data: { id: request.id, units, nodes } });
      } catch (error) { this.onmessage?.({ data: { id: request.id, error: error.message } }); }
    });
  }
};
globalThis.indexedDB = {
  open(name) {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {},
        transaction() {
          const transaction = {
            objectStore() {
              return {
                get() {
                  const get = {};
                  queueMicrotask(() => { get.result = structuredClone(data.get(name)); get.onsuccess?.(); });
                  return get;
                },
                put(value) {
                  const snapshot = structuredClone(value);
                  queueMicrotask(() => {
                    if (failNext) { failNext = false; transaction.error = Error('injected storage failure'); transaction.onabort?.(); }
                    else { data.set(name, snapshot); transaction.oncomplete?.(); }
                  });
                },
              };
            },
          };
          return transaction;
        },
      };
      request.onsuccess?.();
    });
    return request;
  },
};
globalThis.setInterval = (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; };
const wait = () => new Promise(resolve => setTimeout(resolve, 5));
await import('../simulation-worker.js'); await wait();
const send = async (type, payload = {}) => { self.onmessage({ data: { type, ...payload } }); await wait(); };
const latest = () => messages.filter(message => message.type === 'state').at(-1);
ok(latest()); eq(latest().inventory, 1000); eq(latest().bodies.length, 0);
eq(messages.filter(message => message.type === 'terrain').length, 1);
await send('editor', { open: true }); eq(latest().editing, true);
await send('build', { parts: [{ p: [0, R + 12, 0], r: 2 }] });
eq(latest().bodies.length, 1); eq(latest().inventory, 1000 - sphereUnits(2)); eq(latest().editing, false);
eq(data.get('earth-physical-editor-v1').bodies.length, 1);
const before = latest().simTime;
for (let i = 0; i < 60; i++) { clock += 1000 / 60; intervals[0].fn(); }
intervals[1].fn(); ok(latest().simTime > before + 0.9); ok(latest().bodies[0].p[1] < R + 8);
eq(latest().inventory, 1000 - sphereUnits(2));
const p = latest().player.p, body = latest().bodies[0].p, direction = body.map((value, i) => value - p[i]);
const magnitude = Math.hypot(...direction);
await send('input', { keys: [], held: false, f: direction.map(value => value / magnitude) });
await send('recover'); eq(latest().bodies.length, 0); eq(latest().inventory, 1000);
await send('recover'); eq(latest().inventory, 1000);
await send('editor', { open: true });
await send('build', { parts: [{ p: [0, R + 12, 0], r: 12 }] });
eq(latest().bodies.length, 0); eq(latest().inventory, 1000); eq(latest().editing, true);
failNext = true; await send('build', { parts: [{ p: [0, R + 12, 0], r: 2 }] });
eq(latest().bodies.length, 0); eq(latest().inventory, 1000); eq(latest().paused, true);
eq(data.get('earth-physical-editor-v1').inventoryUnits, 1000); eq(data.get('earth-physical-editor-v1').bodies.length, 0);
await send('build', { parts: [{ p: [0, R + 12, 0], r: 2 }] });
eq(latest().bodies.length, 1); eq(latest().inventory, 1000 - sphereUnits(2));
await send('backup');
const backup = messages.filter(message => message.type === 'backup').at(-1).world;
eq(backup.bodies.length, 1); eq(backup.inventoryUnits, latest().inventory);
ok(latest().version.includes('canonical'));
console.log(JSON.stringify({ suite: 'worker-mocked-integration', assertions, passed: true,
  simulatedSeconds: latest().simTime, injectedStorageFailure: true, gpuCalls: 0 }));
