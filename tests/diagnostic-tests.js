import { AtlasMaterialFoundationTests } from './material-tests.js';
import RK from '../src/players/robot-kernel.js';
import { createPopulationWorker } from '../src/universe/worker-client.js';
const target = document.getElementById('results');
const lines = [];
const record = (name, pass, detail = '') => {
  lines.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
  target.textContent = lines.join('\n');
};
try {
  const material = AtlasMaterialFoundationTests();
  for (const test of material.results) record(test.name, test.pass, test.error || '');
  let state = RK.spawn();
  for (let i = 0; i < 240; i++) state = RK.step(state, 1/120, i/120, {forward: 1, yaw: 0});
  record('Robot finite walking state', state.positionM.every(Number.isFinite) && state.velocityMps.every(Number.isFinite));
  record('Robot ground contact', state.grounded && Math.abs(RK.distance(state.positionM) - .9) < .02);
  const worker = createPopulationWorker();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {worker.terminate(); reject(Error('Worker timeout'));}, 30000);
    worker.onerror = event => {clearTimeout(timer); worker.terminate(); reject(Error(event.message));};
    worker.onmessage = event => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data.error) {reject(Error(event.data.error)); return;}
      for (const [name, pass] of Object.entries(event.data.result)) record(name, pass);
      resolve();
    };
    worker.postMessage({id: 1, type: 'test'});
  });
} catch (error) { record('Diagnostic execution', false, error.message); }
lines.push('\nThese checks do not certify WebGL, pointer lock, saved-game restoration, or IndexedDB concurrency.');
target.textContent = lines.join('\n');
