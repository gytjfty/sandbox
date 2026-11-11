import { CONFIG, VERSION } from './config.js';
import { COMMAND, EVENT } from './protocol.js';
import { unit } from './physics.js';
import { Renderer } from './renderer.js';
import { DraftEditor } from './editor.js';
import { EditorUI } from './editor-ui.js';
import { InputController } from './input.js';
const $ = selector => document.querySelector(selector);
const canvas = $('#view');
let state = null, player = null, forward = unit([0, -0.25, -1]), operations = [];
let editorPending = false, noteTimer, lastStats = 0;
function note(text, sticky = false) {
  $('#note').textContent = text; clearTimeout(noteTimer);
  if (!sticky) noteTimer = setTimeout(() => { $('#note').textContent = ''; }, 9000);
}
function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const simulation = new Worker('./simulation-worker.js', { type: 'module' });
const send = (type, payload = {}) => simulation.postMessage({ type, ...payload });
const renderer = new Renderer(canvas, text => note(text, true));
const editor = new DraftEditor();
const context = { send, note, download, editor, toggleEditor,
  state: () => state, player: () => player, forward: () => forward,
  setForward: value => { forward = value; if (player) player.f = value; } };
const editorUI = new EditorUI(editor, context); context.editorUI = editorUI;
const input = new InputController(canvas, context);
function toggleEditor() {
  if (!state || editorPending) return;
  input.stopDigging(); editorPending = true; send(COMMAND.EDITOR, { open: !editor.open });
}
function setEditor(open, authoritativePlayer) {
  editorPending = false; editorUI.drag = null;
  editor.setOpen(open, authoritativePlayer, operations, forward);
  if (open) document.exitPointerLock?.();
  editorUI.render(); editorUI.handles();
}
simulation.onmessage = ({ data }) => {
  switch (data.type) {
    case EVENT.STATE: {
      send(COMMAND.STATE_ACK);
      const first = !player;
      const editorStatusChanged = !state || state.inventory !== data.inventory
        || state.bodies.length !== data.bodies.length || state.busy !== data.busy;
      state = data;
      if (first) forward = data.player.f;
      player = { ...data.player, f: forward };
      if (editor.open !== data.editing && !editorPending) setEditor(data.editing, data.player);
      else if (editor.open && editorStatusChanged) editorUI.render();
      break;
    }
    case EVENT.TERRAIN:
      operations = data.ops; renderer.terrain(data.nodes, data.ops); break;
    case EVENT.NOTE: note(data.text); break;
    case EVENT.FATAL: note(data.text, true); break;
    case EVENT.EDITOR: setEditor(data.open, data.player); break;
    case EVENT.BUILT:
      editor.built(); setEditor(false, player); break;
    case EVENT.BACKUP:
      download(data.world, 'earth-editor-world-backup.json'); break;
  }
};
simulation.onerror = event => note(`Simulation worker failed: ${event.message} Saved records are retained.`, true);
$('#backup').onclick = () => send(COMMAND.BACKUP);
$('#restore').onclick = () => renderer.restore();
$('#report').onclick = () => download({ ...renderer.report(),
  simulation: state ? { version: state.version, time: state.simTime, overloadSeconds: state.overload,
    operations: state.opCount, bodies: state.bodies.length, busy: state.busy,
    paused: state.paused, editing: state.editing } : null,
  userAgent: navigator.userAgent }, 'earth-rendering-report.json');
$('#stats').textContent = `${VERSION} · Starting simulation…`;
function frame(now) {
  requestAnimationFrame(frame);
  input.refresh(now);
  if (player) {
    player.f = forward;
    try {
      const previews = editor.open ? editor.parts.map((part, index) => ({ ...editor.worldPart(part), selected: index === editor.selected })) : [];
      renderer.draw(player, state.bodies, previews, now);
    } catch (error) { renderer.fail(error); }
    editorUI.handles();
  }
  if (state && now - lastStats > 500) {
    lastStats = now;
    $('#stats').textContent = `${VERSION} · ${renderer.fps.toFixed(0)} render FPS / ${CONFIG.targetRenderFPS} target`
      + ` · ${state.inventory} m³ · ${state.bodies.length} parts`
      + (state.busy ? ' · saving/editing' : '')
      + (state.overload > 0.1 ? ` · simulation overload ${state.overload.toFixed(1)}s` : '');
  }
}
renderer.init().catch(error => renderer.fail(error));
requestAnimationFrame(frame);
