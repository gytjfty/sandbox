EARTH — UNRESTRICTED ROCK BUILDING
Complete standalone replacement — November 10, 2026

INSTALL / RUN
Extract all files into a fresh folder, or replace ALL application files on your static host. Reload bypassing browser cache. Never mix main.js, worker or shaders from different packages.
Local: python -m http.server 8000, then http://localhost:8000.
Use HTTPS or localhost, not file://. Requires WebGL2, Web Workers, IndexedDB, BigInt and Web Locks. No third-party libraries, CDN, package install or build step is required. Shader files terrain.vert and terrain.frag must be served as accessible text, not HTML fallback pages.
A Web Lock allows one tab of this version to write the world. Close the other tab and reload if the writer lock is unavailable. Browsers without Web Locks cannot start safely.

WHAT IS NEW
Rock can now be placed above the surface and in open air, not only in existing holes. The original planet restriction is removed from NEW placement geometry, accounting, collision and picking. Rays that miss Earth can still hit a placed rock object. Later cuts can re-mine that rock. Overlap with existing rock does not cost material twice.
Placed rock is static. There is NO falling debris, structural-support requirement, collapse simulation or gravity acting on structures. Floating rock stays where you place it. This is a building tool, not a loose-rubble simulator.
Construction still uses smooth spheres. It is not a block/cube editor or arbitrary blueprint system. Overlapping spheres can build crude walls, mounds, bridges or platforms; those objects are all solid rock, not separate rigid bodies.

NEW PLACEMENT CONTROLS
R toggles Dig / Build. In Build, click ONCE or press E to request placement; holding does not repeatedly spend rock.
Surface mode is the default: aim at solid terrain within 100 m. The sphere centre sits toward the camera from the hit surface, with a small overlap so it can attach to existing geometry. This works on placed rock as well as Earth.
F toggles Surface / Free placement. Free mode centres the sphere at an adjustable distance along your view direction, whether or not you are aiming at a surface. Surface mode also falls back to that free distance when no surface is hit.
Mouse wheel or - / = changes the requested free distance (2–100 m). Distance changes only affect free/fallback placement, not a valid surface attachment. Large radii automatically enforce a larger effective free distance to clear the body; the displayed distance is the requested value.
[ / ] halve/double the current tool radius (2–1000 m). Dig and build radii are separate: defaults 6 m and 2 m.
Amber translucent sphere is the TOOL preview, with cost still unchecked. Red means the proposed sphere overlaps the player approximation. Amber does NOT guarantee affordability. Actual newly filled volume is computed in the worker on request; an unaffordable placement is rejected entirely, with required and stored m3 shown. Zero-accounted-volume fills are rejected.
Because the preview shows the whole tool sphere, portions already inside rock are still visible as a tool volume, but are not newly added or charged. The preview is not a detailed mesh of only the new material.

ALL CONTROLS
Click captures mouse. Escape releases. Mouse looks. WASD moves.
Hold LEFT mouse in DIG mode to excavate repeatedly. Release, loss of pointer lock or focus loss stops NEW requests. An already pending operation may still finish.
R: Dig / Build. F: Surface / Free placement. Wheel or - / =: free distance.
E: one use of the selected tool. [ / ]: radius of selected tool.
M: stored rock volume and approximate mass. B: JSON backup of committed terrain/inventory; pending operation excluded.
J: walking/gravity or observer jetpack/no gravity. Collision remains on in both.
Space: fly up, or grounded walking jump. C / left Ctrl: fly down. Shift: boost/run.
Starts at 200 km above the north pole looking toward Earth. Hold W to descend; flight speed reduces near the surface. Position/orientation are not saved.
Touch: left drag moves, right drag looks. Use tool holds to dig, or places ONCE in build mode. Dig/Build and Surface/Free toggle modes; Nearer/Farther adjust distance. Walk/Fly, Rock, Up and Down are also included. Touch radius/jump/backup UI remains unfinished.

ACCOUNTING — THE ACCEPTED APPROXIMATION IS UNCHANGED
One generic material: rock. Fixed global 1 m lattice samples at integer coordinates +0.5 m. One newly changed occupied sample represents one m3. Smooth terrain/collision are NOT voxelized on that grid.
New cuts count previously solid samples, including added rock outside Earth. New fills count previously empty samples, including open sky. The last applicable operation determines material state. No special planet boundary clips new fills.
Inventory = credited cut units minus debited fill units. The integer ledger is validated, including nonnegative intermediate balances. Repeated/overlapping operations do not duplicate already transferred sampled material. Estimated mass uses an assumed game density of 2700 kg/m3 and integer multiplication. Volume is primary; real rock composition and density variation are not modelled.
There is still boundary/sub-cell mismatch between smooth geometry and 1 m accounting. This conserves the discrete recorded material, not exact analytic volume. No claim of exact physical-volume conservation is made, per the decision to keep this approximation for now.
Storage is abstract and unlimited; it is not a located container and does not change player movement, gravity or planetary mass parameters. No ore chemistry, processing, loose debris or mass-dependent physics is added.

SAVE TRANSACTIONS / PLAYER SAFETY
Accounting and geometry preparation run in a worker. A successful operation writes terrain history and inventory in ONE record/transaction before both activate together. Accounting/save rejection leaves the previous active world/inventory unchanged. If graphics fail after a successful save, reload to show that saved state.
Placement checks player overlap before preparing and again before saving. Translation/gravity pause during the placement SAVE transaction to prevent entering new rock between the final check and activation. Long history writes can make this pause noticeable; there is no zero-stutter guarantee. Turning the camera is still allowed.
The body is four overlapping spheres of radius 0.28 m extending 1.30 m below the eye. A small extra placement margin is used. This is conservative, not exact capsule collision. It may reject some harmless placements, and does not check whether a structure seals your route out of a cave. You can still build walls while standing clear.

MIGRATION / STORAGE
New database: earth-rock-building-v1, world store, current record.
When no building world exists, migration chooses the first available world in this order:
1. earth-rock-placement-v1: previous backfill history AND inventory.
2. earth-rock-conservation-v1: previous single-rock excavation history AND inventory.
3. earth-volume-v1: old excavation geometry only, as historical voids with ZERO retroactive rock credit.
Earlier databases are left untouched. Once a building save exists, older databases are not reimported or continuously synchronized. Older builds cannot display this new world's changes. Same origin/browser profile is required. Very old localStorage height-crater saves are not imported.
IMPORTANT: historical fills imported from the backfill-only build retain an explicit clipToPlanet flag. Their geometry remains clipped as it was, preventing old fill spheres from suddenly creating uncharged aboveground material. NEW fills have no such restriction. The renderer, worker and collision all honour this legacy distinction.
B exports a committed JSON record with estimatedMassKg as a decimal string. Backup import UI is not included. Browser storage can be cleared/evicted; this is not permanent storage or cloud sync. Failed saves reject operations; failed loads do not silently create an unsaved replacement world.
20,000-operation experimental limit remains. No validated 15 GB storage / 3 GB memory target or large-world save engine is provided.

RENDERING / PERFORMANCE
Original planet plus chronological smooth cut/fill spheres. The renderer searches boundaries of BOTH Earth and added spheres; it no longer restricts visible hits to the Earth intersection interval once fills exist. A spatial BVH accelerates sphere queries. Legacy clipped fills are ignored outside Earth, while new fills apply in open space.
Cut-only worlds retain the earlier faster subtractive path. Worlds with fills use event traversal and operation-order queries, which can cost more GPU work. GPU float precision differs from CPU double precision; millimetre-scale or distant edge disagreement remains possible. Very thin/distant features are not guaranteed perfect rendering.
No terrain chunks stream/unload and no blue atmospheric background is introduced. Adaptive image resolution (0.65–1.25 pixels per CSS pixel) can affect sharpness, not stored terrain detail. No shadows, structural collapse, detailed geography, liquids, rockets or editor are added. Surface colours are cosmetic, not separate materials.
Worker accounting is capped at 1,500,000 subdivision visits per operation; exceeding the budget rejects the WHOLE action. Large radii can therefore fail even though the control permits them. One request runs at a time, so hold-to-dig waits for accounting/saving, with a 160 ms minimum interval rather than a promised fixed rate.
The entire BVH and world record are rebuilt/rewritten per action. Full history loads at startup. Collision/picking/preview scan ordered operations and may become expensive. Large histories or overlapping construction can stall/exhaust resources. No FPS, memory or pause-elimination guarantee.

TESTING ACTUALLY PERFORMED
Node syntax checks passed for main.js and world-worker.js.
364 accounting checks: random indoor/outdoor ordered cuts/fills against independent brute-force lattice counting, repeated operations, exterior material, legacy clipping, work-budget rejection and insufficient inventory.
1,200 CPU ray-picking checks against independently partitioned ray intervals.
1,200 point-state checks against independent material-state evaluation.
1,200 BVH event-traversal checks: CPU DOUBLE-PRECISION emulation of the general renderer algorithm, not execution of the GLSL shader.
4 explicit exterior/legacy checks, 4 ledger checks, 2 body-overlap checks and 2 placement-target checks.
Total: 3,976 checks. Actual summary: TEST_RESULTS.json. Run node tests/volume.test.cjs without package installation.
No browser, WebGL shader compiler/execution, GPU, IndexedDB transaction runtime, interactive placement/holding, mobile controls, migration against an actual browser database, or performance testing was available. Passing CPU tests does not establish browser visual correctness. Shader startup errors appear on screen/in console. ZIP integrity was checked.

FILES
index.html — complete page/minimal touch controls
main.js — state, persistence, migration, collision, input, renderer
world-worker.js — unbounded material accounting and spatial tree
terrain.vert / terrain.frag — native WebGL2 renderer and placement preview
tests/volume.test.cjs — runnable CPU checks
TEST_RESULTS.json — actual check summary
README.txt — this document
