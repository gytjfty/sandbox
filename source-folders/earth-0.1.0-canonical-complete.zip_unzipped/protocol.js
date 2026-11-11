// Flat payloads are retained from the repaired build. Names are centralized.
export const COMMAND = Object.freeze({
  INPUT: 'input', STATE_ACK: 'stateAck', DIG: 'dig', RECOVER: 'recover',
  BUILD: 'build', RADIUS: 'radius', FLY: 'fly', JUMP: 'jump', PAUSE: 'pause',
  EDITOR: 'editor', BACKUP: 'backup',
});
export const EVENT = Object.freeze({
  STATE: 'state', TERRAIN: 'terrain', NOTE: 'note', FATAL: 'fatal',
  EDITOR: 'editor', BUILT: 'built', BACKUP: 'backup',
});
// Accounting requests: { id, edit: object|null, ops: array }.
// Replies: { id, units, nodes: Float64Array } OR { id, error: string }.
// State: { player, bodies, inventory, editing, paused, busy, simTime,
//          overload, revision, opCount, version }. ACK bounds the queue.
