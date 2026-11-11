EARTH — PHYSICAL EDITOR REBUILD
Complete source package. November 11, 2026.

STATUS — READ THIS FIRST
This is a rewritten, CPU-tested repair candidate, not a claim of verified gameplay on your GPU. It restores the working version's cut-only terrain shader path and moves authoritative simulation to a dedicated worker. Real browser interaction, real IndexedDB behavior, shader compilation/execution, your edited world, graphics-driver recovery, and measured 60 FPS were NOT tested here. No browser or graphics runtime was available in the build environment. The exact original graphics-context-loss trigger remains unproven. Do not delete your old files or clear browser storage.

INSTALL USING GITHUB / GITHUB.DEV — NO TERMINAL, NO CODESPACES
1. Keep a copy of the existing game files. If the old game opens, use B to export its world first.
2. Put ALL application files from this ZIP in one served folder. index.html, main.js, renderer.js, simulation-worker.js, accounting-worker.js, physics.js, material.js, terrain.js, terrain.vert and terrain.frag must stay together. Do not mix these with old scripts.
3. Commit using github.dev's Source Control UI. Serve through GitHub Pages (repository Settings > Pages > deploy from the appropriate branch/folder), or your existing HTTPS static host. Enable GitHub Pages only if you want that publication; this package makes no repository changes itself.
4. Open the deployed HTTPS address and hard-refresh. github.dev is the editor, not the game host. file:// is unsupported. No build step, npm installation, CDN, terminal, or Codespaces is needed.
5. Same browser profile and exact origin are needed to access prior IndexedDB worlds. Moving between different Pages subpaths on the SAME host retains the origin; another hostname, scheme or port does not. A blank world on a different origin is not evidence that your old data was deleted.
Requires a modern browser with WebGL2, module workers (including a nested module worker), IndexedDB, Web Locks, structuredClone, crypto.randomUUID and BigInt. Close other editor tabs first.

CONTROLS
Click the view: mouse capture. Escape releases. Mouse: look. WASD: move.
J: walk / observer flight (collision stays enabled).
Space: ascend in flight, jump while grounded walking. C or left Ctrl: descend. Shift: boost/run.
Hold left mouse: dig terrain. E: one cut. [ / ]: dig radius (2–1000 m).
G: recover an aimed visible physical part, whole, within 100 m.
M: rock inventory and approximate mass. B or World backup: export authoritative world JSON.
Tab / R: open/close draft editor. P: pause/resume physical bodies.
Top-left Restore graphics: retry the renderer, without recreating simulation or world state.
Diagnostics: export actual runtime rendering counters, resolution, context losses, simulation time and overload seconds. This report is not a world backup.
Basic touch movement/look, digging, editor, recovery, up/jump, down, and boost are included. Full mobile UX is still unverified.

EDITOR
Opening pauses body physics, but allows player/camera movement. Drafts cost no material.
Click a preview or its list entry to select. Right-drag the view to look around.
Numeric XYZ uses a fixed local basis at the draft origin; Y is local vertical.
Drag the projected X/Y/Z buttons for axis movement. Radius: 1–12 m.
Add/Duplicate makes an offset copy. Delete removes a preview only.
Undo/Redo and Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z affect draft geometry only. Ctrl/Cmd+D duplicates.
Tower replaces the draft with 2–32 slightly leaning separate spheres. These are not welded assemblies.
Build & simulate validates terrain, player, real parts, pair overlap, inventory and schema IN THE SIMULATION WORKER. It saves the transfer before activating the bodies, then closes the editor. Touching is allowed within small tolerances; intersection is rejected.
Closing retains the draft in memory, but not across reloads. Export/import design stores local geometry only, never inventory. Import is limited to 1 MB / 64 spheres. Commit always recalculates material.
There are still at most 64 physical bodies plus 64 previews. This is a retained prototype safety limit, not a desired permanent architecture.

ARCHITECTURE
main.js: input capture and draft UI only; consumes snapshots. It does not step physics or write the world database.
simulation-worker.js: authoritative player, bodies, terrain history, collision queries, commands, material transactions, save migration and simulation clock.
accounting-worker.js: asynchronous cut accounting and BVH rebuild. Expensive accounting does not run in the drawing callback. The authoritative worker validates and commits its result.
renderer.js: GPU resources and snapshots only. One outstanding GPU frame, nonblocking fence polls. Waiting for a fence skips only drawing. Context loss changes only renderer state.
terrain.js: shared CPU terrain/picking/accounting/tree logic.
physics.js: retained limited sphere solver, now driven at 60 fixed simulation steps per second in the worker, independently of render callbacks.
material.js: material quantities and ledger validation.
Snapshots are acknowledged: at most one state snapshot is outstanding, preventing an unresponsive main thread from accumulating an unbounded snapshot queue.
A render callback schedules its successor before drawing; a drawing exception cannot terminate the simulation worker. Backup requests remain available if graphics fail but the page responds.
Editor/P pause is intentional policy. Atomic material saves briefly freeze authoritative stepping while a transaction commits; that is explicit and independent of GPU readiness. Autosaves copy a consistent snapshot without freezing simulation. Simulation can still slow under excessive CPU workload or browser background throttling; independent does not mean unlimited CPU or guaranteed background execution. Diagnostics records scheduler overload rather than claiming perfect real time.

RENDER REPAIRS
- Restored fillCount == 0 optimized cut-only path from the last working shader.
- Kept ordered legacy cut/fill rendering, including clipToPlanet; did not discard old edits or turn static terrain into physical bodies.
- Physical sphere rendering remains separate from terrain edits.
- Conservative initial image scale 0.5; adaptive 0.25–1.0 and a 60 FPS submission cap. Quality responds to submitted-render cadence, not just the browser callback rate. Low scale is a fallback, not proof of acceptable visual quality or a 60 FPS pass.
- Nonblocking GPU fence avoids building an unrestricted GPU queue; simulation never checks the fence.
- Context restoration rebuilds textures/shaders from retained render data, not saves or simulation state.
- Removed fixed 512-node/32-event recovery budgets and orange checker output. General legacy-fill rays still use a finite boundary count derived from the edit history. Cut-only traversal terminates by advancing through cuts.
- GPU error messages are explicit and leave world/simulation intact.
These changes do NOT prove the original context-loss bug is fixed on your device. The general legacy-fill path and large overlapping cut histories can still be expensive; this is not a chunked terrain/streaming overhaul. No history is dropped to hide that problem.

MATERIAL / SAVES
Invariant: inventoryUnits + sum(live body units) == sum(credited cuts) - sum(charged legacy fills).
One-metre material accounting is retained; visible terrain is not a one-metre mesh. Parts use local sphere-grid counts, assigned once, invariant under movement/spin. Density is the prototype assumption 2700 kg/m3.
Construction debits inventory and inserts bodies in the same IndexedDB record. Recovery removes a body and credits its units once. Failed material writes leave the active world and prior saved record unchanged, pause body physics, and show the error. Save writes are serialized so an older autosave cannot overwrite a later material transaction.
Database: earth-physical-editor-v1; store: world; key: current; format: earth-editor-v1.
If absent, migration checks earth-rock-building-v1, earth-rock-placement-v1, earth-rock-conservation-v1, then geometry-only earth-volume-v1. Original databases remain untouched. Legacy clipped fills retain clipping. Invalid records block startup instead of replacing the record with a new world. Opening a new current database can create an EMPTY database before discovering an invalid legacy record; it does not write a replacement current record on that validation failure.
Old static constructions remain static terrain. Automatic terrain-to-body conversion is not implemented and would require material-safe decomposition. This build does not add new static-fill placement: new construction uses physical parts, matching the editor version.
Moving bodies autosave about every two seconds. A crash can roll back recent motion. Browser storage can be cleared or evicted. Keep external world exports.
World JSON export is present; world-backup import UI is still NOT implemented. Design import is different and does not restore worlds. Camera, pause state and unfinished drafts are not persisted.

LIMITATIONS — NOT SILENTLY REDEFINED AS REQUIREMENTS
Earth radius 6,371,000 m and spherical Earth-like appearance are retained; no real geography, atmosphere, weather, liquids, biomes or survival-resource systems are added.
Custom sphere solver: approximate CSG terrain contacts, five contact iterations, all-pairs body contacts, radial 9.81 m/s2 gravity, friction/spin, 120 m/s speed cap. No continuous collision detection; thin/high-speed cases can tunnel. No welds, joints, arbitrary meshes, fracture, strength, terrain collapse, dynamic-player momentum exchange or partial part mining.
Terrain fields and picking still scan history on the CPU; GPU tree uses ordered operations. 20,000-op and 1,500,000-accounting-visit safety limits remain explicit. Large worlds/complex seams can still be slow or collide approximately.
60 FPS is the goal, not a measured guarantee. The old 120 Hz solver setting is not retained as a requirement. There is no 120 FPS requirement.

VALIDATION
TEST_RESULTS.json records checks actually executed for this package: 911 assertions passed across four suite runs, and 11 JavaScript/module files passed syntax checks. Tests run with Node, no dependencies; optional npm test, but NOT required to install/play.
CPU tests independently brute-force sphere volumes and randomized terrain accounting; verify repeated edits, clipped fills, BVH escape pointers, field signs, picking, ledger conservation, duplicate IDs, motion invariance, invalid resizing, recovery, free fall, ground support, and symmetric pair response.
Worker tests execute the real simulation-worker module with mocked storage, timers, locks and accounting-worker transport. They test independent simulation without any GPU, material construction/recovery, repeat recovery, insufficient material, injected transaction failure and backup. Migration test preserves old database content and clipped fills. These are NOT real browser/IndexedDB integration tests.
All JavaScript files are syntax-checked. ZIP CRC is checked. No GPU shader compilation, rendered output, pointer interaction, touch interaction, actual driver loss/restoration, or device FPS verification was possible here.

ON-DEVICE ACCEPTANCE CHECKLIST (NOT CLAIMED PASSED)
1. Export world backup before replacing old files. Launch on the same origin; confirm terrain edits/inventory survive.
2. Dig; confirm only newly removed accounted material is credited. Repeat same location; no duplicate credit.
3. Editor: select, handles, fields, duplicate/delete, undo/redo, tower, design export/import, close/reopen.
4. Build above ground away from player; inventory falls by cost; unsupported spheres fall.
5. Recover once; inventory returns; repeat aimed recovery does not duplicate material.
6. Reload; confirm bodies/inventory/legacy clipping. Do NOT clear the database to work around a validation error.
7. Use your heavily edited world, not just empty terrain. Export Diagnostics after at least 30 seconds; inspect actual render FPS, resolution, losses, overload.
8. Test graphics loss/restoration only after a backup, with developer tools if desired; confirm simulation remains alive and no replacement world appears. Manual Restore graphics may be needed.
9. Inspect legacy-filled regions separately; the restored cut-only optimization does not apply there.
10. A failure should be reported with Diagnostics and console messages, not hidden by deleting terrain history.
