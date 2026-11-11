# Worker protocol

Names are defined in `protocol.js`. Payloads remain flat objects. The authoritative worker validates build geometry, inventory and saved state; the UI is not trusted to commit material.

## Main thread → simulation

| Type | Payload | Meaning |
|---|---|---|
| input | keys: string[], held: boolean, f: number[3] | Replace current key/held/look state; no world mutation. |
| stateAck | none | Permit the next state snapshot; at most one outstanding. |
| dig | none | Attempt one terrain cut at authoritative aim. |
| recover | none | Recover one visible aimed whole body. |
| build | parts: {p: number[3], r: number}[] | Validate and purchase world-space physical spheres. Requires editor open. |
| radius | value: number | Set dig radius within configured bounds. |
| fly | none | Toggle walking / observer flight. |
| jump | none | Jump only when grounded walking. |
| pause | none | Toggle body-physics pause; not renderer readiness. |
| editor | open: boolean | Request editor/body pause state; receives editor acknowledgement even if busy prevents the requested change. |
| backup | none | Export a clone of authoritative world state. |

## Simulation → main thread

| Type | Payload | Meaning |
|---|---|---|
| state | player, bodies, inventory, editing, paused, busy, simTime, overload, revision, opCount, version | Bounded display snapshot. Main immediately acknowledges. |
| terrain | nodes: Float64Array, ops: array, revision | Updated render representation and matching operations. Nodes buffer is transferred. |
| note | text | Recoverable user-facing status/error. |
| fatal | text | Startup/storage/lock failure; no silent replacement world. |
| editor | open, player | Editor request result and authoritative position. |
| built | none | Successful material commit; clear free draft and close editor. |
| backup | world | Complete authoritative record for download, not a design. |

Player: `{p, f, fly, vy}`. Physical body: `{id, p, r, units, v, w}`. Vectors are three finite numbers.

## Simulation ↔ accounting

Request: `{id, edit: object|null, ops: array}`. Reply: `{id, units, nodes}` or `{id, error}`. One accounting job is outstanding. A version/id mismatch is ignored. Terrain changes are activated only after authoritative validation and a successful atomic material save. Bodies can continue simulating while cut accounting runs in the other worker.

## Responsibility rules

Renderer never sends readiness/completion as permission to advance simulation. It has no database access. Draft actions change free geometry only; actual build/recovery/cut material transfers occur in the simulation worker. Request failures do not create inventory or replace saved worlds.
