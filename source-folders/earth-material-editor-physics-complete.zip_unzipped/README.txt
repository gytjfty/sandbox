EARTH — MATERIAL-CONSERVING SPHERE EDITOR + PHYSICS
Complete standalone replacement — November 10, 2026

WHAT THIS RELEASE IS
A first working-code foundation for the main editor idea: sphere-part design, selection, movement, scaling, duplication, preview undo/redo, blueprint export/import, material-funded committing, and separate dynamic sphere bodies.
It is NOT a Blender/Juno replacement, general-purpose modeller, rocket designer or finished physics sandbox. No welded assemblies, constraints, joints, part attachment rules, fused-solid editing, fracture, arbitrary meshes, propulsion or scripting are implemented. The sphere tower is a STACK OF SEPARATE PARTS. It can fall apart by losing contact, not by breaking welded connections.
All new construction goes through the editor into physics bodies. There is no new permanent static sphere-placement tool. You may temporarily position draft previews in the air; releasing/building them creates gravity-affected objects. Editor mode and the explicit P pause control pause simulation rather than giving material permanent support.

INSTALL / REQUIREMENTS
Extract ALL files into a fresh folder or replace all hosted application files. Reload bypassing browser cache. Do not mix older main.js/worker/shaders with this package.
Local: python -m http.server 8000, then http://localhost:8000.
Use HTTPS or localhost, not file://. Requires WebGL2, Web Workers, IndexedDB, BigInt, structuredClone, crypto.randomUUID and Web Locks in a modern browser. No CDN, third-party library, dependency install or build step is required.
terrain.vert and terrain.frag must be accessible text files rather than HTML fallback responses. The package.json is only for optional Node tests; it is not a runtime server requirement.
One tab of this editor version may write the world; close the other tab if a writer-lock error appears. Browser/GPU interaction has NOT been exercised here.

QUICK START
This build starts NEAR THE SURFACE rather than 200 km up, so the editor/physics are easier to try. Planet-scale flight remains available; Space ascends in observer flight and speed rises with altitude.
1. Click the view to capture mouse, aim at ground and hold left mouse to mine rock. M shows stored volume. This editor does not create free material.
2. Tab or R opens the editor and releases mouse capture. Physics pauses while editing. The initial draft is a 2 m-radius sphere near the aimed terrain surface. Right-drag on the view looks around; WASD still moves the camera/player.
3. Use Add sphere, Duplicate, radius/XYZ fields, or Replace draft with tower. A default six-sphere tower costs 192 accounted m3, so mine enough first.
4. Move away if the proposed parts overlap your player. Commit also rejects terrain or part intersections; touching is allowed.
5. Build & simulate SAVES the material transfer, removes the draft, closes the editor, and releases the physical parts. Unsupported pieces fall. The generated tower has a slight lean to expose toppling rather than relying on a perfectly symmetric balance.
6. Aim at a real part and press G to recover it whole. Its recorded volume returns to storage exactly once. It disappears only after the recovery transaction saves.

EDITOR FEATURES / CONTROLS
Tab / R: open or close editor. Closing preserves the current draft IN MEMORY; it does not spend material. The draft is not automatically saved across reloads: export a design to retain it.
Click a preview sphere, or its entry in the part list, to select it. Selected previews are amber; other previews are cyan. Solid physical rock is brown.
Drag projected X/Y/Z handle buttons to move the selected sphere on the corresponding local axis. Numeric X/Y/Z fields offer precise positioning. Y is local vertical at the editor origin; the basis is fixed for the current design, not recomputed as you move parts.
Radius field resizes a PREVIEW sphere, 1–12 m radius. Spheres are rotationally symmetric, so no rotation gizmo is provided. Physical spin exists but a plain sphere does not visually show its orientation.
Add sphere / Duplicate adds an offset copy of the selected sphere. Ctrl/Cmd+D duplicates. Delete removes the selected PREVIEW.
Undo/Redo buttons and Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z affect preview geometry only. A committed build is a real material transaction; preview undo does not create refunds or undo physical history.
Tower replaces the current draft with 2–32 separate spheres, using the selected radius. It has a slight lateral lean. There is no automatic welding or structural-strength model.
Export design writes local sphere positions/radii only. Import design loads those shapes at the current editor origin and recomputes requirements. Blueprint files contain no credited inventory. Design file limit is 1 MB and 64 spheres. Intersections are checked on commit.
64 live physical parts maximum, plus up to 64 previews. This is an explicit first-version limit, not a scalable arbitrary-complexity editor.

MATERIAL RULES
One material, rock. The accepted 1 m approximation remains.
Terrain excavation uses the existing global 1 m centre-sampling grid. Physical part volume is counted on a fixed 1 m grid in the SPHERE'S OWN LOCAL SHAPE COORDINATES. This quantity is assigned at construction and stays with the part as it moves, spins or falls. It is NOT recomputed against the world grid, so crossing cell boundaries cannot mint or erase inventory.
Each sphere's recorded units are computed from its radius, not trusted from a blueprint. Resizing or duplicating a draft changes its requirement but grants no resources.
Building transfers the sum of part units from storage into the parts. Preview spheres that intersect each other cannot be committed; separate overlapping solids are not silently charged as a fused union. Touching is allowed with a small numerical tolerance.
Moving/colliding does not change a part's units. G or Recover aimed real part removes that WHOLE part and credits its units once. There is no partial physical-part mining or in-place resizing of committed parts in this release; recover and rebuild instead. Digging at an aimed physical sphere tells you to use G, rather than crediting it as terrain.
The saved invariant is:
  inventory units + sum(live part units) = historical credited terrain cuts - charged historical terrain fills.
The whole history's intermediate terrain balances and all live part radii/units/unique IDs are validated on load/save. Material accounting is single-player consistency, not anti-cheat protection against edited files.
Approximate mass is recorded volume times the assumed game density 2700 kg/m3; the physics uses that mass and solid-sphere moment of inertia. Density is not a claim about all real rocks. Sampling boundary error remains; there is no exact analytic volume guarantee.
Terrain edits, construction and recovery save world state and inventory in ONE IndexedDB transaction before activating. Failed transactions pause simulation and reject the transfer. Do not count visual previews as already purchased parts.

PHYSICS ACTUALLY IMPLEMENTED
Custom, limited sphere-body solver in physics.js. It uses 120 Hz fixed steps, radial constant-magnitude 9.81 m/s2 gravity, sphere/sphere and sphere/implicit-terrain contacts, impulse response, low restitution, tangential friction, angular velocity and solid-sphere rotational inertia. It is NOT a mature general rigid-body physics engine.
Physics performs at most eight steps per displayed frame. Under load it may run slower than real time, rather than catching up without limit. Linear speed is capped at 120 m/s. There is no continuous collision detection; thin geometry/high-speed impacts can tunnel. Pairs use an all-pairs loop with five contact iterations; large towers or near-singular contacts can jitter or penetrate.
Terrain contacts use the conservative CSG field and a numerical gradient, not exact mesh/capsule collision. Complex cut/fill seams may cause early/awkward contacts. No angular geometry is tracked beyond spheres; spin does not change a spherical silhouette. Friction/damping dissipate energy. This is not a certified mechanically accurate simulation.
The player is kinematic and approximately four overlapping 0.28 m spheres, not a physical human with mass. Bodies react to that kinematic collider; crushing, injury, momentum exchange with a dynamic player and realistic carrying are not modelled.
Constant gravity is radial relative to the planet centre, not a depth-dependent Earth gravity model. No collapse of the original terrain is simulated. Only NEW editor bodies are dynamic.
Physics pauses in the editor, when explicitly paused with P, and while a world transaction saves. Save pauses may be noticeable with a long history. Player translation also pauses during saving so committed geometry/state is not activated around a moving player. Camera look remains available.

IMPORTANT LEGACY LIMITATION
Your older cut-and-place constructions are stored as static terrain CSG, not as physical objects. Migration PRESERVES them as static terrain, including any floating structures made in the older builds. It does NOT magically turn old fused/overlapping terrain into correctly measured independent bodies.
Old unsupported terrain can therefore remain floating. NEW editor-built parts always use the physical-body system. There is no automatic legacy terrain-to-rigid-body conversion or terrain detachment in this release. This limitation is explicit to avoid losing geometry or duplicating material during migration.
Previously clipped backfill operations preserve clipToPlanet when imported. They do not create uncharged aboveground rock on migration.

SAVES / MIGRATION
New database: earth-physical-editor-v1, world store, current record.
When absent, migration checks, in order: earth-rock-building-v1; earth-rock-placement-v1; earth-rock-conservation-v1; then geometry-only earth-volume-v1. Existing recorded inventory is retained where present. Geometry-only history becomes the baseline with no retroactive credit. Original databases are untouched.
After this editor save exists, previous databases are not reimported/synchronized. Same origin/profile is required. Very old localStorage height-crater format is not imported. Invalid saves block rather than silently reset the world.
Material transactions save immediately. Moving-body positions/velocities auto-save approximately every two seconds when outside the editor and not busy; recent physical motion can roll back after closing/crashing, but material transfers remain in complete atomic records. There is no crash-proof permanent persistence guarantee; browser storage may be evicted/cleared.
B exports the currently committed world (including current physical positions). World-backup import UI is NOT included. Design blueprint import/export IS included and has no inventory side effects. No named worlds, cloud sync or cross-device storage.
Camera, physics pause flag and unfinished draft are not automatically restored. Stored bodies and their velocities are restored and resume when simulation runs.
20,000 terrain-operation limit and 1,500,000 accounting-node work limit remain. A large cut can be rejected without partial effects. No validated 15 GB storage or 3 GB RAM target.

GENERAL PLAY CONTROLS
Click captures mouse, Escape releases. Mouse looks; WASD moves.
Hold left mouse: repeated TERRAIN digging outside editor. E: one terrain cut. [ / ]: dig radius, 2–1000 m. An already pending cut may finish after release.
G: recover aimed visible real sphere part within 100 m. M: inventory. B: world backup.
Tab / R: editor. P: toggle physics pause. J: walk/gravity or observer flight/no gravity. Collision stays on.
Space flies up or jumps when grounded walking. C / left Ctrl flies down. Shift boosts/runs.
Touch has basic movement/look dragging and Editor, Hold dig, Recover, Walk/Fly buttons. Editor form fields and handle buttons support pointer events. Mobile selection/layout/vertical-flight/keyboard-equivalent controls are incomplete and untested; desktop is the intended first target.

RENDERING / PERFORMANCE
Native WebGL2 terrain ray-boundary renderer plus physical/preview sphere intersections. Terrain still uses ordered CSG and a spatial tree. No streaming terrain chunks are introduced. GPU coordinates use a near-camera origin, but float precision and thin/distant edges remain limitations.
Physical and preview spheres are ray-intersected per pixel (up to 128 objects), so many parts can be expensive. The terrain history is still rebuilt/re-saved on cuts; collision and picking scan history. The editor/physics additions are not a performance/scalability overhaul.
Adaptive image resolution is 0.6–1.0 pixels per CSS pixel. No FPS, memory, iPhone performance or stutter guarantee. No shadows, real geography, atmosphere, liquids or rock fracture. World structures can be sealed around routes; collision checks do not prove an exit remains open.

VALIDATION ACTUALLY PERFORMED
Syntax checks: main.js, material.js, physics.js and world-worker.js passed Node parsing.
1,263 CPU assertions passed. Includes:
- 45 local sphere-volume comparisons against independent brute-force grid counting.
- Construction, movement invariance, invalid duplication/resize and recovery ledger checks.
- Free fall, flat-ground support, radial planet contact, pair momentum/separation and leaning tower collapse.
- 100 random terrain operations compared to independent accounting and repeated-operation zero checks.
- 400 terrain-picking comparisons, 300 terrain-state comparisons and 300 field-sign comparisons.
- Legacy clipping, BVH build and physical sphere-ray checks.
Physics tests executed 5,461 fixed steps across test scenes. In the 20-second flat-ground six-sphere tower test, the top sphere moved from [0.3,22.05,0] to approximately [34.108,2.0002,0], with all 192 recorded m3 retained in the parts.
Run node tests/core.test.mjs or npm test (no dependency installation). TEST_RESULTS.json contains the actual result.
Browser interaction, WebGL shader compilation/execution, rendering, IndexedDB transactions, live migration, touch input, handles and save/launch integration have NOT been tested in a browser. Passing isolated CPU tests is not proof of a working browser build or robust physics in arbitrary worlds. Startup shader errors appear on screen and in console. ZIP integrity was checked.

FILES
index.html — page/editor inspector/handles
main.js — world transactions, editor, controls, simulation loop and renderer
material.js — local part-volume accounting and world ledger validation
physics.js — limited sphere dynamics/contact solver
world-worker.js — terrain accounting and spatial tree
terrain.vert / terrain.frag — native WebGL2 renderer
tests/core.test.mjs — CPU checks
package.json — optional Node test metadata
TEST_RESULTS.json — actual test summary
README.txt — this document
