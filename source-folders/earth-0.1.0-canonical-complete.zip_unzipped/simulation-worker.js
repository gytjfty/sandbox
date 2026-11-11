import { CONFIG, SAVE, VERSION } from './config.js';
import { COMMAND, EVENT } from './protocol.js';
import { add, sub, scale, dot, length, unit, cross, stepPhysics } from './physics.js';
import { R, field, terrainRay, sphereRay } from './terrain.js';
import { createWorld, sphereUnits } from './material.js';
import { WorldStore } from './persistence.js';

const clone = value => structuredClone(value);
const player = { p: [0, R + 8, 20], f: unit([0, -0.25, -1]), fly: true, vy: 0 };
let world = createWorld();
let ready = false, busy = false, saving = false, editing = false, paused = false;
let keys = new Set(), radius = CONFIG.initialDigRadius, held = false;
let lastDig = 0, lastSave = 0, revision = 0, simTime = 0, overload = 0;
let accumulator = 0, lastTick = performance.now(), snapshotPending = false;
let accountingJob = null, nextJobId = 0;
const store = new WorldStore(note);
const accounting = new Worker('./accounting-worker.js', { type: 'module' });

function note(text) { postMessage({ type: EVENT.NOTE, text }); }
function reportError(error) { note(error.message || String(error)); }
function snapshot() {
  if (!ready || snapshotPending) return;
  snapshotPending = true;
  postMessage({ type: EVENT.STATE, player: clone(player), bodies: clone(world.bodies),
    inventory: world.inventoryUnits, editing, paused, busy, simTime, overload, revision,
    opCount: world.ops.length, version: VERSION });
}
function publishTerrain(nodes) {
  revision++;
  postMessage({ type: EVENT.TERRAIN, nodes, ops: clone(world.ops), revision }, [nodes.buffer]);
}
async function commit(next, nodes = null) {
  saving = true;
  try {
    await store.write(next);
    world = next;
    if (nodes) publishTerrain(nodes);
    lastSave = performance.now();
  } catch (error) {
    paused = true; held = false;
    throw error;
  } finally { saving = false; }
  snapshot();
}
function clearance(position) {
  const up = unit(position);
  let distance = Infinity;
  for (const height of CONFIG.playerOffsets) {
    const sample = add(position, scale(up, -height));
    let available = field(sample, world.ops);
    for (const body of world.bodies) available = Math.min(available, length(sub(sample, body.p)) - body.r);
    distance = Math.min(distance, available - CONFIG.playerRadius);
  }
  return distance;
}
function move(delta) {
  let remaining = length(delta);
  if (!remaining) return;
  const direction = scale(delta, 1 / remaining);
  for (let i = 0; i < 256 && remaining > 0.00001; i++) {
    const gap = clearance(player.p);
    if (gap < -0.001) return false;
    const step = Math.min(remaining, Math.max(0.001, gap * 0.7));
    const next = add(player.p, scale(direction, step));
    if (clearance(next) < 0) return false;
    player.p = next; remaining -= step;
  }
  return remaining <= 0.00001;
}
function simulatePlayer(dt) {
  const up = unit(player.p), right = unit(cross(player.f, up));
  let motion = [0, 0, 0];
  if (keys.has('KeyW')) motion = add(motion, player.f);
  if (keys.has('KeyS')) motion = sub(motion, player.f);
  if (keys.has('KeyA')) motion = sub(motion, right);
  if (keys.has('KeyD')) motion = add(motion, right);
  if (player.fly) {
    if (keys.has('Space')) motion = add(motion, up);
    if (keys.has('KeyC') || keys.has('ControlLeft')) motion = sub(motion, up);
  } else motion = sub(motion, scale(up, dot(motion, up)));
  let speed = player.fly ? Math.max(8, Math.min(300000, Math.max(0, length(player.p) - R) * 0.6)) : 4;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) speed *= player.fly ? 4 : 1.7;
  if (length(motion)) move(scale(unit(motion), speed * dt));
  if (!player.fly) {
    player.vy -= CONFIG.gravity * dt;
    if (!move(scale(up, player.vy * dt))) player.vy = 0;
  }
}
function aimedBody() {
  let best = null;
  for (const body of world.bodies) {
    const distance = sphereRay(player.p, player.f, body.p, body.r);
    if (distance !== null && distance <= 100 && (!best || distance < best.distance)) best = { body, distance };
  }
  const ground = terrainRay(player.p, player.f, world.ops);
  return best && (ground === null || best.distance < ground) ? best : null;
}
function requestTerrain(edit = null) {
  const id = ++nextJobId;
  return new Promise((resolve, reject) => {
    accountingJob = { id, resolve, reject };
    accounting.postMessage({ id, edit, ops: world.ops });
  });
}
accounting.onmessage = ({ data }) => {
  if (!accountingJob || accountingJob.id !== data.id) return;
  const job = accountingJob; accountingJob = null;
  if (data.error) job.reject(Error(data.error)); else job.resolve(data);
};
accounting.onerror = event => {
  accountingJob?.reject(Error(event.message)); accountingJob = null;
};
async function dig() {
  if (!ready || busy || editing) return;
  const now = performance.now();
  if (now - lastDig < CONFIG.digCooldownMs) return;
  lastDig = now;
  if (aimedBody()) { held = false; note('Use G to recover a whole physical part.'); return; }
  if (world.ops.length >= CONFIG.maxTerrainOperations) {
    held = false; note('Terrain safety limit reached. Export a backup.'); return;
  }
  const distance = terrainRay(player.p, player.f, world.ops);
  if (distance === null) return;
  const centre = add(player.p, scale(player.f, distance + radius * 0.35));
  const edit = { x: centre[0], y: centre[1], z: centre[2], r: radius, kind: 'cut' };
  busy = true;
  try {
    const result = await requestTerrain(edit), next = clone(world);
    next.ops.push({ ...edit, units: result.units });
    next.inventoryUnits += result.units;
    await commit(next, result.nodes);
    note(`Mined ${result.units} m³.`);
  } catch (error) { reportError(error); }
  finally { busy = false; snapshot(); }
}
async function recover() {
  if (!ready || busy) return;
  const hit = aimedBody();
  if (!hit) { note('Aim at a real part within 100 m.'); return; }
  busy = true;
  try {
    const next = clone(world), index = next.bodies.findIndex(body => body.id === hit.body.id);
    if (index < 0) throw Error('Part already recovered.');
    const body = next.bodies.splice(index, 1)[0];
    next.inventoryUnits += body.units;
    await commit(next);
    note(`Recovered ${body.units} m³.`);
  } catch (error) { reportError(error); }
  finally { busy = false; snapshot(); }
}
function validateParts(parts) {
  if (!Array.isArray(parts) || !parts.length || parts.length + world.bodies.length > CONFIG.maxPhysicalParts) {
    throw Error(`Build requires 1–${CONFIG.maxPhysicalParts} total real parts.`);
  }
  let cost = 0;
  const bodies = parts.map(part => {
    if (!Array.isArray(part.p) || part.p.length !== 3 || !part.p.every(Number.isFinite)
      || part.p.some(value => Math.abs(value) > 1e12)) throw Error('Invalid part position.');
    const units = sphereUnits(part.r); cost += units;
    return { id: crypto.randomUUID(), p: part.p.slice(), r: part.r, units, v: [0, 0, 0], w: [0, 0, 0] };
  });
  if (cost > world.inventoryUnits) throw Error(`Need ${cost} m³; stored ${world.inventoryUnits} m³.`);
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (field(body.p, world.ops) < body.r - 0.02) throw Error('Part intersects terrain; raise it.');
    const up = unit(player.p);
    if (CONFIG.playerOffsets.some(height => length(sub(body.p, add(player.p, scale(up, -height))))
      < body.r + CONFIG.playerRadius + 0.05)) throw Error('Part overlaps player; move away.');
    for (const other of [...world.bodies, ...bodies.slice(0, i)]) {
      if (length(sub(body.p, other.p)) < body.r + other.r - 0.015) {
        throw Error('Parts intersect. Touching is allowed.');
      }
    }
  }
  return { bodies, cost };
}
async function build(parts) {
  if (!ready || busy || !editing) return;
  busy = true;
  try {
    const { bodies, cost } = validateParts(parts), next = clone(world);
    next.inventoryUnits -= cost; next.bodies.push(...bodies);
    await commit(next);
    editing = false; paused = false;
    postMessage({ type: EVENT.BUILT });
    note(`Built ${bodies.length} physical parts; spent ${cost} m³.`);
  } catch (error) { reportError(error); }
  finally { busy = false; snapshot(); }
}
async function command(data) {
  if (data.type === COMMAND.STATE_ACK) { snapshotPending = false; return; }
  if (data.type === COMMAND.INPUT) {
    keys = new Set(Array.isArray(data.keys) ? data.keys : []); held = !!data.held;
    if (Array.isArray(data.f) && data.f.length === 3 && data.f.every(Number.isFinite) && length(data.f) > 0.9) {
      player.f = unit(data.f);
    }
    return;
  }
  if (!ready) return;
  switch (data.type) {
    case COMMAND.DIG: return dig();
    case COMMAND.RECOVER: return recover();
    case COMMAND.BUILD: return build(data.parts);
    case COMMAND.RADIUS:
      if (Number.isFinite(data.value)) radius = Math.max(CONFIG.minDigRadius, Math.min(CONFIG.maxDigRadius, data.value));
      return;
    case COMMAND.FLY:
      player.fly = !player.fly; player.vy = 0;
      note(player.fly ? 'Flight; collision on.' : 'Walking; gravity on.'); break;
    case COMMAND.JUMP:
      if (!player.fly && clearance(player.p) < 0.06) player.vy = 5; break;
    case COMMAND.PAUSE:
      paused = !paused; note(paused ? 'Physics paused.' : 'Physics running.'); break;
    case COMMAND.EDITOR:
      if (busy) note('Finish the current material transaction before opening or closing the editor.');
      else { editing = !!data.open; held = false; }
      postMessage({ type: EVENT.EDITOR, open: editing, player: clone(player) }); break;
    case COMMAND.BACKUP:
      postMessage({ type: EVENT.BACKUP, world: clone(world) }); break;
  }
  snapshot();
}
self.onmessage = ({ data }) => { Promise.resolve(command(data)).catch(reportError); };
function tick() {
  const now = performance.now(), elapsed = (now - lastTick) / 1000;
  lastTick = now;
  if (elapsed > CONFIG.maxElapsedSeconds) overload += elapsed - CONFIG.maxElapsedSeconds;
  accumulator += Math.min(elapsed, CONFIG.maxElapsedSeconds);
  const step = 1 / CONFIG.physicsHz;
  let steps = 0;
  while (accumulator >= step && steps++ < CONFIG.maxCatchupSteps) {
    if (!saving) {
      simulatePlayer(step);
      if (!editing && !paused) {
        stepPhysics(world.bodies, position => field(position, world.ops), step, player.p);
        simTime += step;
      }
    }
    accumulator -= step;
  }
  if (accumulator > CONFIG.maxDebtSeconds) {
    overload += accumulator - CONFIG.maxDebtSeconds; accumulator = CONFIG.maxDebtSeconds;
  }
  if (held) dig();
  if (!busy && world.bodies.length && now - lastSave > CONFIG.autosaveMs) {
    lastSave = now;
    store.write(world).catch(error => { paused = true; reportError(error); });
  }
}
async function start() {
  if (!navigator.locks) throw Error('Web Locks requires a supported browser on HTTPS.');
  await navigator.locks.request(SAVE.writerLock, { ifAvailable: true }, async lock => {
    if (!lock) throw Error('World open in another editor tab.');
    world = await store.load();
    const result = await requestTerrain();
    ready = true; publishTerrain(result.nodes); snapshot();
    note('Ready. Tab: editor · hold click: dig · G: recover · B: backup');
    lastTick = performance.now(); lastSave = lastTick;
    setInterval(tick, 1000 / CONFIG.physicsHz);
    setInterval(snapshot, 1000 / CONFIG.snapshotHz);
    await new Promise(() => {});
  });
}
start().catch(error => {
  paused = true;
  postMessage({ type: EVENT.FATAL, text: `${error.message || String(error)} Original saves were not replaced.` });
});
