# Save compatibility contract

Shared names are in `config.js`: database `earth-physical-editor-v1`, store `world`, key `current`, format `earth-editor-v1`. Application version `0.1.0-canonical` does NOT change this save schema and is not added to the material ledger.

## Current record

- format: `earth-editor-v1`
- cellSize: `1`
- density: `2700`
- baselineCount: count of initial geometry-only uncredited cuts
- inventoryUnits: nonnegative safe integer
- ops: ordered operations `{x, y, z, r, kind, units, clipToPlanet?}`
- bodies: `{id, p, r, units, v, w}`

Coordinates/radii are finite; radii positive. Operation kind is cut/fill. A clipping flag belongs only to a fill. Baseline operations are cuts with zero units. Each historical terrain balance is nonnegative and safely representable. Body IDs are unique; vectors are finite triples; quantities must match the sphere-grid count for their radius.

`inventoryUnits + bodyUnits` must equal the complete signed terrain ledger. Duplicate/malformed bodies and unexplained material changes reject the record. This is consistency validation, not anti-cheat protection.

## Atomic writes

The entire validated record is cloned and queued. Queue order prevents an earlier autosave from overtaking a later transaction. A material change becomes active only after its record transaction completes. An aborted write leaves the previous record and authoritative material state unchanged. Autosaves copy moving-body state without awaiting a GPU fence.

## Migration order when the current record is absent

1. earth-rock-building-v1 / earth-building-v1
2. earth-rock-placement-v1 / earth-backfill-v1 — imported fills retain clipToPlanet
3. earth-rock-conservation-v1 / earth-rock-v1 — removedUnits mapped to credited cuts
4. earth-volume-v1 / edits — geometry-only cuts mapped to zero-credit baseline

Original databases are read, not rewritten or deleted. Old static filled geometry stays static; it is not also credited as dynamic parts. If a current record exists but is invalid, startup blocks instead of falling back to older worlds. A corrupt falsy record is invalid, not absent. Opening a missing current database may create an empty store before a later migration error, but no replacement current record is written on that error.

## Exports

World backup is the full record. A design is `earth-sphere-design-v1` with local `{p, r}` parts only; it cannot credit inventory. No world-backup import UI is included in this release. Camera, pause flags and unfinished drafts are not part of the persisted record. Exports must be retained outside browser storage for protection against eviction/clearing.
