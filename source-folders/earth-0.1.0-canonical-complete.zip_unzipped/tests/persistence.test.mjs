import assert from 'node:assert/strict';
import { WorldStore } from '../persistence.js';
import { createWorld } from '../material.js';
let assertions = 0;
const eq = (a, b) => { assert.deepEqual(a, b); assertions++; };
const ok = value => { assert.ok(value); assertions++; };
const transactions = [], written = [];
const store = new WorldStore();
store.database = {
  transaction() {
    const transaction = { objectStore() { return { put(value) { transaction.value = structuredClone(value); } }; } };
    transactions.push(transaction); return transaction;
  },
};
const initial = createWorld(), second = createWorld();
const firstWrite = store.write(initial); initial.extra = 'not in queued snapshot';
const secondWrite = store.write(second);
await Promise.resolve(); eq(transactions.length, 1); ok(!('extra' in transactions[0].value));
transactions[0].oncomplete(); await firstWrite; await Promise.resolve(); eq(transactions.length, 2);
transactions[1].oncomplete(); await secondWrite;
for (const corrupt of [null, false, 0, '']) {
  const test = new WorldStore();
  test.open = async () => ({}); test.read = async () => corrupt; test.write = async value => written.push(value);
  await assert.rejects(() => test.load()); assertions++;
}
eq(written.length, 0);
const test = new WorldStore();
test.open = async name => name === 'earth-physical-editor-v1' ? {} : null;
test.read = async () => undefined; test.write = async value => written.push(value);
const fresh = await test.load(); eq(fresh.inventoryUnits, 0); eq(written.length, 1);
console.log(JSON.stringify({ suite: 'persistence-serialization-and-invalid-records', assertions, passed: true }));
