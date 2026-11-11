import assert from 'node:assert/strict';
import { DraftEditor } from '../editor.js';
import { EditorUI } from '../editor-ui.js';
import { sphereUnits } from '../material.js';
import { unit } from '../physics.js';
import { R } from '../terrain.js';
let assertions = 0;
const eq = (a, b) => { assert.deepEqual(a, b); assertions++; };
const ok = condition => { assert.ok(condition); assertions++; };
const throws = fn => { assert.throws(fn); assertions++; };
const model = new DraftEditor(), player = { p: [0, R + 8, 20] }, forward = unit([0, -0.25, -1]);
model.setOpen(true, player, [], forward); eq(model.parts.length, 1); eq(model.selected, 0); eq(model.cost, sphereUnits(2));
const initial = model.export(); model.add(); eq(model.parts.length, 2); eq(model.cost, 2 * sphereUnits(2));
model.history(); eq(model.export(), initial); model.history(true); eq(model.parts.length, 2);
model.coordinate(0, 8); eq(model.parts[1].p[0], 8); model.history(); eq(model.parts[1].p[0], 4.1);
model.radius(3); eq(model.parts[1].r, 3); model.history(); eq(model.parts[1].r, 2);
const beforeInvalid = model.export(); throws(() => model.radius(13)); eq(model.export(), beforeInvalid);
throws(() => model.coordinate(0, Infinity)); eq(model.export(), beforeInvalid);
model.remove(); eq(model.parts.length, 1); model.history(); eq(model.parts.length, 2);
model.tower(6); eq(model.parts.length, 6); eq(model.cost, 6 * sphereUnits(2));
const exported = model.export(), origin = model.origin.slice();
model.setOpen(false, player, [], forward); model.setOpen(true, player, [], forward);
eq(model.export(), exported); eq(model.origin, origin);
model.import(exported); eq(model.export(), exported);
throws(() => model.import({ format: 'earth-sphere-design-v1', parts: [{ p: [NaN, 0, 0], r: 2 }] }));
throws(() => model.import({ format: 'earth-sphere-design-v1', parts: [{ p: [0, 0, 0], r: 13 }] }));
eq(model.export(), exported);
const copy = model.export(); copy.parts[0].p[0] = 123; ok(model.parts[0].p[0] !== 123);
ok(!('inventoryUnits' in exported));
const elements = new Map();
function element() { return { style: {}, value: '', disabled: false, children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } }; }
globalThis.document = {
  activeElement: null,
  querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
  querySelectorAll() { return []; }, createElement: element,
};
const context = { state: () => ({ inventory: 1000, bodies: [], busy: false }), note() {}, send() {},
  toggleEditor() {}, download() {}, player: () => player, forward: () => forward };
const ui = new EditorUI(model, context); ui.render();
const x = elements.get('#x'); x.value = '12.'; document.activeElement = x; ui.render(); eq(x.value, '12.');
const radius = elements.get('#radius'); radius.value = '2.'; document.activeElement = radius; ui.render(); eq(radius.value, '2.');
document.activeElement = null; ui.render(); eq(radius.value, model.parts[model.selected].r);
model.built(); eq(model.parts.length, 0); eq(model.open, false); eq(model.undo.length, 0);
console.log(JSON.stringify({ suite: 'draft-model-and-mocked-ui', assertions, passed: true, focusedFieldPreserved: true }));
