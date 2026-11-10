EARTH — CONTEXT-LOSS RECOVERY / BOUNDED RENDERER
Complete standalone replacement — November 10, 2026

PURPOSE
The previous screenshot showed successful WebGL2 creation followed by context loss. This build addresses that later lifecycle failure, not just the getContext request. It is a recovery/safety revision, not proof that the underlying device/driver problem has been diagnosed or eliminated.
All runtime files are included. Editor, rock accounting, physics and save schema are retained. No saves are deliberately cleared, reset or converted to a different inventory format.

WHAT CHANGED
1. On webglcontextlost: prevent default restoration behaviour from being disabled; cancel the queued animation callback; stop further drawing; stop player/physics stepping; release pointer lock; clear held inputs. World state remains in CPU memory. GPU synchronization handles are discarded as invalid, without trying to delete them through a lost context.
2. On webglcontextrestored: invalidate programs/textures/upload caches and show a Resume renderer button. There is NO automatic expensive retry loop. Press Resume renderer to rebuild resources. Physics remains paused after an actual loss; P resumes it once rendering is working.
3. Every renderer initialization/reinitialization first compiles a minimal shader and submits ONLY a 16x16 solid-colour test frame. It checks nonblocking GPU-fence completion before fetching/compiling the terrain program.
4. The terrain shader is bounded: at most 32 boundary events per ray and 512 shared BVH-node visits across that ray's queries; each traversal has an additional fixed guard. Physical/preview sphere loops stop at 128 objects.
5. Only one unfinished GPU frame is permitted in the normal rendering loop. While its fence is pending, no new frame, texture upload, player step or physics step is issued. This avoids adding rendering backlog; under load the simulation can slow rather than catch up in a burst. Fence checks use timeout 0, not gl.finish or blocking readback.
6. Start at about 57,600 render pixels (roughly 320x180 for 16:9), adapt down toward 32,400 pixels on slow completion and slowly up toward 230,400 pixels after sustained quick completion. Aspect ratio follows the view. These are pixel counts, not guaranteed dimensions on every preview size.
7. Rendering reports record stage, loss history, submitted/completed frames, scene sizes, observed completion delay, initialization results and shader logs. Report completion delay is wall time until the fence was observed signalled, NOT a GPU timestamp-query benchmark.

IMPORTANT VISIBLE SAFETY TRADE-OFF
ORANGE CHECKER PIXELS mean that ray's safety work budget was exhausted. They are an explicit incomplete-render marker, not missing material, successful terrain rendering, or a newly created hole. No terrain or inventory is removed to meet the budget.
Complex layered edits can trigger this even when the previous unrestricted shader would eventually render them. This deliberately trades complete rendering of difficult pixels for a bounded attempt. Do not treat orange regions as trustworthy views for precise mining/building; send a screenshot/report instead. This is not a final large-history rendering solution.
Starting resolution is intentionally low to test stability. It may look soft. This is not a return to coarse terrain chunks; stored geometry and accounting resolution are unchanged.
Work caps reduce the amount of requested work but cannot guarantee a GPU driver will never reset, a shader compiler will never hang, or that any real device can run this shader. Browser/GPU execution remains untested here.

HOW TO RUN / REPORT
Import this complete ZIP as a fresh project, or replace every hosted file. Close older running game previews/tabs first; they may hold the same world writer lock. Reload bypassing cache. Do not mix old renderer/shader/module versions.
Local: python -m http.server 8000, then http://localhost:8000.
Use HTTPS or localhost, not file://. Requirements: WebGL2, Web Workers, IndexedDB, Web Locks, BigInt, structuredClone and crypto.randomUUID. No CDN, library installation or build step. Serve .vert/.frag as accessible text, not HTML fallback responses.
If graphics are lost, the recovery panel should remain usable. Wait for the browser's context-restored event; Resume renderer becomes available after it. Reinitialization reruns the tiny test before terrain. If the browser never restores the context, this build does not force or guarantee restoration; download the report and close/reopen the preview.
Use Download rendering report in the panel, or press K while running. The JSON includes page/browser context information; review before sharing. There is no automatic upload. The runtime report is also exposed as window.__earthRuntimeReport inside the game frame.
Stages distinguish creating-context, compiling/drawing-minimal-probe, compiling-bounded-terrain, uploading terrain/parts, drawing terrain, and waiting-for-GPU. They narrow where failure occurred; a stage is not proof of the GPU driver's underlying cause.
The writer lock stays held while the loaded world is available for in-page recovery. Close this tab before opening another copy. No automatic page reload is performed, because that would discard unsaved in-memory physical motion.

EDITOR / PLAY (RETAINED)
Starts near the surface for testing; flight still allows leaving the planet. Click to capture mouse, Escape releases. WASD moves; mouse looks.
Hold left mouse for repeated TERRAIN digging outside editor; E makes one cut. [ / ] adjusts dig radius (2–1000 m). An already requested cut may finish after releasing the button.
Tab / R opens/closes the sphere editor. Physics pauses while editing. Right-drag looks, WASD moves. Click a preview or its list entry to select. Drag X/Y/Z handle buttons or enter local coordinates. Radius 1–12 m.
Add/Duplicate/Delete, preview Undo/Redo, tower generation, and blueprint export/import are included. Ctrl/Cmd+D duplicates, Delete removes preview, Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z undo/redo preview changes only. Closing preserves draft in memory; export a design before reloading to retain it.
Build & simulate charges stored rock and creates separate dynamic spheres. Default six-sphere tower costs 192 recorded m3 and has a slight lean to demonstrate toppling. Drafts that intersect terrain, player or other parts are rejected; touching is allowed with tolerance. Up to 64 live spheres and 64 previews.
G recovers an aimed real part WHOLE, returning its fixed recorded volume once. Partial physical-part mining, direct live resizing, welding, joints, constraints, fracture, arbitrary meshes and rocket systems are not implemented. Spheres are symmetric; no rotation gizmo is provided.
M shows stored volume and approximate mass. B exports current committed world state; pending transactions are excluded. K exports rendering diagnostics. P pauses/unpauses physics.
J switches observer flight/no gravity and walking/gravity; collision remains enabled. Space ascends in flight or jumps when grounded walking. C / left Ctrl descends in flight. Shift boosts/runs.
Touch controls are basic and incomplete: movement/look dragging, Editor, Hold dig, Recover, Walk/Fly, inspector fields and pointer handles. Desktop remains the intended first test target; mobile interaction is unverified.

CONSERVATION / PHYSICS (RETAINED)
Generic rock only. Terrain uses the accepted global 1 m centre-sampling accounting grid. Parts use a fixed local sphere-grid volume assigned when built, so movement cannot alter material quantity. Approximate density is a game assumption of 2700 kg/m3. There is no exact analytic-volume claim or chemical composition simulation.
Inventory plus live part units equals credited terrain cuts minus charged legacy fills. Drafts/blueprints create designs, not material. Building pays for each separate part; recovering removes it and credits its recorded units once. Terrain changes and their credits, construction and recovery each save atomically before activation.
Physics: limited custom sphere solver, 120 Hz fixed steps, at most 8 steps per displayed frame, radial constant-magnitude 9.81 m/s2 gravity, sphere/terrain and sphere/sphere contact, low restitution, friction, angular velocity/inertia. Five solver iterations, linear speed cap 120 m/s. No continuous collision detection, realistic structural strength or terrain detachment. Fast objects may tunnel; stacked parts may jitter or interpenetrate.
Player is kinematic, not a realistically massive body. Terrain contacts use a conservative CSG field, not exact mesh collision. Complex CSG seams can create awkward contacts. When GPU completion is delayed, this build intentionally delays simulation too; it is not a real-time fidelity guarantee.
Old cut-and-place structures remain LEGACY STATIC TERRAIN, including earlier floating structures. New editor bodies fall; old terrain is not silently converted into rigid bodies. Legacy clipped backfills retain clipToPlanet to avoid creating free aboveground rock.

SAVES / PERFORMANCE LIMITS
Same database/schema: earth-physical-editor-v1, world/current. Existing editor worlds/parts are retained on the same origin and profile. First-time migration still checks earlier building, backfill, rock-conservation and volume-only databases, leaving originals untouched. Once an editor world exists it is not continuously reimported. No old height-crater localStorage migration.
Material transactions save immediately; moving body states normally autosave about every two seconds outside editor and when not busy. Context loss stops frames rather than clearing state; a transaction already in flight may still complete and be applied after rendering resumes. Recent physical motion can roll back if the page is closed before saving. Browser storage may be cleared/evicted; no permanent storage/cloud guarantee.
B exports a world snapshot; world-backup import UI remains absent. Design geometry import/export exists with no inventory effects. Camera/pause/unfinished draft are not persisted automatically.
20,000 terrain operations and 1,500,000 accounting subdivision visits per cut remain experimental limits. Large cuts can be rejected without partial results. BVH rebuilds, whole-record writes, all-pairs physics and history-scanning CPU queries can still stall or exhaust resources. GPU safeguards are not a CPU performance fix. No 15 GB storage / 3 GB memory / 60 FPS promise.
No detailed geography, atmosphere, shadows, liquids, structural collapse or general Blender/Juno editor is added. This remains the first sphere-editor foundation.

VALIDATION ACTUALLY RUN
Node syntax checks passed for main.js, renderer.js, gpu-gate.js, graphics-context.js, material.js, physics.js and world-worker.js.
29 recovery assertions passed with mocked GL/DOM: one-frame gating, no submission while pending, no GL calls through the gate after known loss, loss-stage recording, stopping/cancelling animation, no automatic heavy retry, two fresh program/texture rebuilds after restore, probe-before-terrain initialization, and explicit shader work-cap/marker checks.
61 core regression assertions passed: local sphere volume, duplication/resize/recovery ledger checks, free fall, contact momentum/separation, radial planet support, leaning tower collapse with 192 recorded m3 retained, repeated terrain cuts, legacy clipping and BVH construction.
Total 90 assertions. Run npm test, or node tests/recovery.test.mjs and node tests/core.test.mjs. No dependency installation needed. TEST_RESULTS.json records the actual run.
There was NO real browser/GPU context, shader compilation/execution, IndexedDB runtime, interactive editor, device driver reset or GPU load test available here. Mocked recovery tests do not prove actual driver restoration. Shader work caps are static/code checks, not a certified time bound or measured crash fix. All earlier historical tests were not rerun. ZIP integrity checked.

FILES
index.html — full page/editor UI
main.js — world/editor/CPU loop with context-loss frame guards
renderer.js — staged initialization, resource rebuild, reports, bounded drawing
gpu-gate.js — one-pending-frame fence management
graphics-context.js — context creation retries/status capture
material.js / physics.js — accounting and sphere solver
world-worker.js — terrain accounting/BVH
terrain.vert / terrain.frag — bounded GPU renderer
tests/recovery.test.mjs / tests/core.test.mjs — Node checks
package.json — optional test metadata
TEST_RESULTS.json — actual results
README.txt — this document
