import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setTimeout as actualTimeout } from 'node:timers';
import { R } from '../terrain.js';
let assertions = 0;
const ok = value => { assert.ok(value); assertions++; };
const eq = (a, b) => { assert.deepEqual(a, b); assertions++; };
const ids = [...fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').matchAll(/id="([^"]+)"/g)].map(match => match[1]);
const elements = new Map(), events = {}, frames = [], commands = [];
function element() {
  return { style: {}, dataset: {}, value: '', textContent: '', children: [], addEventListener() {},
    setPointerCapture() {}, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
    getContext() { return null; }, click() { this.onclick?.(); } };
}
for (const id of ids) elements.set('#' + id, element());
const axes = [0, 1, 2].map(axis => ({ ...element(), dataset: { axis: String(axis) } }));
const touches = ['Space', 'KeyC', 'ShiftLeft'].map(key => ({ ...element(), dataset: { key } }));
elements.get('#towerCount').value = '6';
globalThis.document = { activeElement: null, hidden: false,
  querySelector(selector) { if (!elements.has(selector)) throw Error('Missing element ' + selector); return elements.get(selector); },
  querySelectorAll(selector) { return selector === '#handles button' ? axes : selector === '[data-key]' ? touches : []; },
  createElement: element, addEventListener(name, fn) { events['document:' + name] = fn; }, exitPointerLock() {},
};
globalThis.addEventListener = (name, fn) => { events[name] = fn; };
globalThis.HTMLInputElement = class {};
globalThis.innerWidth = 1920; globalThis.innerHeight = 1080; globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = fn => frames.push(fn);
globalThis.setTimeout = (fn, ms) => ms > 1000 ? 0 : actualTimeout(fn, ms);
let worker;
globalThis.Worker = class {
  constructor() { worker = this; }
  postMessage(message) { commands.push(message); }
};
await import('../main.js'); await new Promise(resolve => actualTimeout(resolve, 5));
ok(elements.get('#stats').textContent.includes('canonical'));
ok(elements.get('#note').textContent.includes('WebGL 2 unavailable'));
ok(frames.length === 1);
const state = { type: 'state', player: { p: [0, R + 8, 20], f: [0, -0.25, -1], fly: true, vy: 0 },
  inventory: 1000, bodies: [], editing: false, paused: false, busy: false, simTime: 0, overload: 0, opCount: 0 };
worker.onmessage({ data: state }); eq(commands.at(-1).type, 'stateAck');
frames.shift()(1000); eq(frames.length, 1);
ok(commands.some(message => message.type === 'input'));
elements.get('#backup').onclick(); eq(commands.at(-1).type, 'backup');
events.keydown({ target: {}, code: 'Tab', preventDefault() {}, repeat: false });
eq(commands.at(-1).type, 'editor'); eq(commands.at(-1).open, true);
worker.onmessage({ data: { type: 'editor', open: true, player: state.player } });
eq(elements.get('#panel').style.display, 'block');
elements.get('#add').onclick(); eq(elements.get('#parts').children.length, 2);
elements.get('#build').onclick(); eq(commands.at(-1).type, 'build'); eq(commands.at(-1).parts.length, 2);
worker.onmessage({ data: { type: 'built' } }); eq(elements.get('#panel').style.display, 'none');
console.log(JSON.stringify({ suite: 'page-bootstrap-mocked-dom-no-webgl', assertions, passed: true,
  browser: false, renderingUnavailableButInputAndCommandsAlive: true }));
