import assert from 'node:assert/strict';
import { Renderer } from '../renderer.js';
import { CONFIG, VERSION } from '../config.js';
import { R } from '../terrain.js';
let assertions = 0;
const eq = (a, b) => { assert.deepEqual(a, b); assertions++; };
const ok = condition => { assert.ok(condition); assertions++; };
const throws = fn => { assert.throws(fn); assertions++; };
let resolutionCases = 0;
for (const [width, height, dpr, expected] of [
  [1920, 1080, 1, [1920, 1080]], [1280, 720, 1, [1920, 1080]],
  [2560, 1440, 1, [2560, 1440]], [3840, 2160, 1, [3840, 2160]],
  [1920, 1080, 2, [3840, 2160]], [960, 540, 1, [1920, 1080]],
]) {
  globalThis.innerWidth = width; globalThis.innerHeight = height; globalThis.devicePixelRatio = dpr;
  const renderer = new Renderer({ addEventListener() {} }, () => {});
  eq([Math.round(width * renderer.quality), Math.round(height * renderer.quality)], expected);
  eq(renderer.report().automaticDownscaling, false); resolutionCases++;
}
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
const events = {}, notices = [], canvas = { width: 0, height: 0, addEventListener(name, fn) { events[name] = fn; } };
let waitStatus = 1, drawCalls = 0, maxBuffer = 16384;
const gl = {
  MAX_TEXTURE_SIZE: 'texture', MAX_VIEWPORT_DIMS: 'viewport', MAX_RENDERBUFFER_SIZE: 'buffer',
  WAIT_FAILED: -1, TIMEOUT_EXPIRED: 0, NO_ERROR: 0,
  getParameter(name) { return name === 'viewport' ? [maxBuffer, maxBuffer] : name === 'texture' ? 16384 : maxBuffer; },
  get drawingBufferWidth() { return canvas.width; }, get drawingBufferHeight() { return canvas.height; },
  clientWaitSync() { return waitStatus; }, isContextLost() { return false; }, getError() { return 0; },
  fenceSync() { return {}; }, drawArrays() { drawCalls++; },
};
for (const name of ['activeTexture', 'bindTexture', 'texImage2D', 'uniform1i', 'uniform1f', 'uniform3fv',
  'viewport', 'useProgram', 'deleteSync', 'flush']) gl[name] = () => {};
const renderer = new Renderer(canvas, message => notices.push(message));
renderer.gl = gl; renderer.ready = true; renderer.uniforms = {};
const player = { p: [0, R + 8, 20], f: [0, -1, 0] };
eq(renderer.draw(player, [], [], 100), true); eq([canvas.width, canvas.height], [1920, 1080]); eq(drawCalls, 1);
waitStatus = 0; const quality = renderer.quality;
eq(renderer.draw(player, [], [], 200), false); eq(drawCalls, 1); eq(renderer.quality, quality);
waitStatus = 1; eq(renderer.draw(player, [], [], 201), true); eq(drawCalls, 2);
eq(renderer.draw(player, [], [], 202), false); eq(drawCalls, 2);
eq(renderer.report().version, VERSION); eq(renderer.report().targetFPS, CONFIG.targetRenderFPS);
maxBuffer = 1024; throws(() => renderer.resize()); eq(renderer.quality, quality);
let prevented = false; events.webglcontextlost({ preventDefault() { prevented = true; } });
ok(prevented); eq(renderer.ready, false); eq(renderer.losses, 1); ok(notices[0].includes('Simulation continues'));
eq(renderer.draw(player, [], [], 300), false);
console.log(JSON.stringify({ suite: 'renderer-policy-mocked-webgl', assertions, passed: true,
  resolutionCases, realGPU: false, downscalingRemoved: true }));
