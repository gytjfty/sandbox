# Earth — canonical physical editor

Version **0.1.0-canonical**, November 11, 2026.

This complete package consolidates the repaired game and its 1080p+ resolution update. It is a cleanup/consolidation release, not another gameplay rewrite. No backup-import UI, assemblies, new shapes, or survival systems have been added.

The preceding repaired version was reported working by the user. This refactored package has passed the automated checks listed in `TEST_RESULTS.json`, but has **not** been tested in the user's browser, on the user's GPU, or against their actual saved world. The earlier user confirmation must not be treated as verification of this new ZIP.

## Install — GitHub / github.dev only

1. Keep the previous working ZIP and export a world backup with **B** if possible. Do not clear browser storage.
2. Replace the deployed application files with **all** runtime files in this ZIP, together. Do not combine the new main/worker/modules with the earlier renderer patch. This ZIP already includes full-resolution rendering.
3. Commit through github.dev's Source Control interface. No terminal, Codespaces, dependency installation or build step is required.
4. Use your existing HTTPS static host, or configure GitHub Pages through repository Settings > Pages. If using branch deployment, place the application in the selected branch root or `/docs` directory, as configured. Creating a Pages site is a user publication decision; generating this ZIP did not publish or modify the repository.
5. Open the served URL and hard-refresh. github.dev is the source editor, not the game host. `file://` is unsupported.
6. Confirm `0.1.0-canonical` appears in the top-left status and exported diagnostics. Keep historical source folders separate from the deployed application.

Use the same browser profile and origin to access existing saves. A different hostname, scheme or port uses different browser storage. An empty world on another origin does not mean the original was erased.

Requirements: modern WebGL2 browser, module workers (including nested workers), IndexedDB, Web Locks, structuredClone, crypto.randomUUID and BigInt. Close other editor tabs before opening the world.

## What was canonicalized

- One complete distribution: no additional resolution patch is required.
- `config.js`: version, rendering policy, simulation rate, accounting assumptions, and named prototype safety limits.
- `protocol.js`: shared worker message names; full payload documentation in `docs/PROTOCOL.md`.
- `persistence.js`: database access, migration, validation and serialized snapshot writes, separate from gameplay orchestration.
- `editor.js`: draft geometry, history, local coordinate basis and design import/export independent of the DOM.
- `editor-ui.js`: inspector, selection and handle interaction.
- `input.js`: keyboard, pointer and touch capture.
- `view-math.js`: projection, picking direction and look math.
- `renderer.js`: graphics resources, nonblocking GPU fence, full-resolution drawing, context recovery and diagnostics only.
- `simulation-worker.js`: authoritative player, terrain, inventory, physical bodies and simulation clock.
- `accounting-worker.js`: terrain accounting and BVH generation outside the drawing thread.
- Readable source files, separate stylesheet, release notes, save documentation, acceptance checklist and reproducible CPU/mock tests.

Prototype limits remain prototype limits, not newly approved design requirements. Moving them into named configuration does not make them permanent. Geometry and material-accounting rules remain unchanged from the repaired build.

## Resolution and performance

1080p+ is incorporated. Drawing uses native device-pixel resolution, with a minimum internal height of 1080 pixels and the viewport aspect ratio preserved. Examples at DPR 1: a 1280x720 viewport renders at 1920x1080; 1920x1080 renders at 1920x1080; 2560x1440 and 3840x2160 retain those dimensions. Higher DPR is respected.

Automatic downscaling is disabled. The target/submission cap remains **60 FPS**, not 120. Higher internal resolution can increase GPU load. 60 FPS is not guaranteed or measured on your device by these tests. If the requested allocation exceeds GPU limits, an explicit error appears rather than secretly lowering resolution.

The cut-only terrain fast path remains. Legacy fills still use ordered boundary-event traversal. There is no fixed 512-visit/32-event recovery cap or orange-checker fallback. Large overlapping histories can still be expensive; no chunk-streaming overhaul is claimed.

## Controls

- Click view: mouse capture. Escape: release. Mouse: look. WASD: move.
- J: walk / observer flight; collision stays enabled.
- Space: ascend in flight or jump when grounded. C / left Ctrl: descend. Shift: boost/run.
- Hold left mouse: dig. E: one cut. [ / ]: dig radius (2–1000 m).
- G: recover a whole aimed visible physical sphere, within 100 m.
- M: rock inventory and approximate mass. B / World backup: export authoritative world JSON.
- Tab / R: draft editor. P: pause/resume body physics.
- Restore graphics: rebuild graphics resources without replacing the simulation or save.
- Diagnostics: export version, actual render counters, requested resolution, context-loss count, simulation time and scheduler-overload seconds. Diagnostics is not a world backup.

Basic touch movement/look and editor/dig/recover/walk-flight/up/down/boost controls remain. Full mobile interaction is unverified.

## Draft editing and physical construction

The editor pauses body physics but allows camera/player movement. Drafts are free until built. Select previews by clicking or their list entries. Right-drag the view to look. Numeric XYZ and projected handles use the draft's fixed local basis; Y is local vertical. Radius is 1–12 m.

Add/Duplicate makes an offset copy. Delete removes a preview. Undo/Redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z) only changes the draft. Ctrl/Cmd+D duplicates. Tower replaces the draft with 2–32 slightly leaning separate spheres; they are not welded assemblies.

Build & simulate validates placement and inventory in the authoritative worker. It atomically saves the inventory transfer and bodies before activation. Parts may touch within the retained tolerance but must not intersect terrain, the player, real parts or one another.

Closing retains drafts in memory, not across reloads. Design export/import contains local geometry only, not inventory. Import is limited to 1 MB / 64 spheres. The current safety limits are 64 physical parts plus 64 previews. No free material is assigned by importing or duplicating drafts.

## Saves and conservation

Database, store, key and format are unchanged: `earth-physical-editor-v1` / `world` / `current` / `earth-editor-v1`. See `docs/SAVE_FORMAT.md`.

Invariant:

    inventoryUnits + sum(live body units)
      = sum(credited terrain cuts) - sum(charged historical fills)

Material uses the retained one-metre accounting grid and assumed density 2700 kg/m3. Part quantities use a local sphere-grid count assigned once; movement/spin cannot change their quantity. This accounting approximation is not an exact analytic volume guarantee and does not imply a coarse visible one-metre terrain mesh.

Material writes serialize and validate whole-world snapshots. Failed writes leave active material state unchanged, pause body physics, and report an error. Autosaves copy consistent state about every two seconds. A crash can roll back recent motion. Browser storage can be cleared/evicted; keep exported backups.

Migration preserves old databases, cuts, inventory and clipped fills. Geometry-only history receives no retroactive material credit. Old static constructions remain static terrain; no material-unsafe automatic conversion to bodies is performed. Invalid records block instead of silently replacing the world.

World export exists; world-backup import is still **not implemented**. Design import is not a world restore. Camera, draft and pause state are not persisted.

## Simulation/render boundary

Input/editor commands go to the simulation worker. It owns physics, collision, material transfers, terrain and time. Rendering consumes snapshots. GPU fence waiting skips drawing only; it never gates worker stepping. Graphics restoration rebuilds GPU resources only.

Physics runs at 60 fixed steps per second, with bounded catch-up. Snapshot acknowledgements bound queued snapshots. Dedicated workers do not guarantee unlimited CPU, perfect real time or unthrottled background execution; diagnostics records overload. Editing/P is an explicit body-physics pause. Atomic material transactions deliberately freeze authoritative stepping during the commit; autosave snapshots do not depend on rendering.

The limited sphere solver is retained: radial constant-magnitude gravity, approximate CSG terrain contacts, five contact iterations, all-pairs sphere contacts, friction/spin, and a 120 m/s speed cap. No continuous collision detection: fast/thin cases can tunnel. CPU collision and picking still scan history. The retained terrain-operation/accounting-work limits are 20,000 operations / 1,500,000 visits.

No welds, joints, arbitrary meshes, fracture/strength, terrain collapse, dynamic-player momentum exchange, partial part mining, real geography, atmosphere, liquids or robot-survival resource system are added.

## Validation and release discipline

`TEST_RESULTS.json` contains the actual run results: **1,005 assertions** across eight suite runs passed, and **22 JavaScript/module files** passed syntax checks. Optional tests use Node without dependencies: `npm test` or `node tests/run.mjs`. These commands are for optional development validation, not installation or play requirements; no terminal is required for the github.dev workflow.

CPU tests cover independent volume/accounting comparisons, repeated cuts, clipping, tree pointers, picking, ledger validation, physical motion and draft history. Mock integration covers worker commands, failed writes, recovery, migration, invalid-save rejection, snapshot behavior, page bootstrap without WebGL, field-focus preservation, and renderer resolution/fence/error policy.

Mocks are not a real DOM/browser, IndexedDB engine or GPU. Shader compilation/execution, rendered output, real context restoration, actual saved-world compatibility, touch/handles and device FPS remain unverified for this cleanup release. Before accepting it as the new working baseline, use `docs/ACCEPTANCE.md` with the same saved world/camera/resolution used for the earlier working version.
