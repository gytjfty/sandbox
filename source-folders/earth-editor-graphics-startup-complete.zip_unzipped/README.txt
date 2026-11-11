EARTH — EDITOR GRAPHICS-STARTUP DIAGNOSTICS
Complete replacement ZIP — November 10, 2026

THIS REVISION
The editor/physics game remains the same. Graphics initialization no longer makes only a high-performance WebGL2 request and then claims that WebGL2 is unsupported.
New graphics-context.js:
- Installs a webglcontextcreationerror listener BEFORE requesting a context.
- Tries default GPU preference with depth/stencil/antialias disabled; then low-power; then browser-selected attributes.
- Records requested settings, null returns, exceptions, browser statusMessage events, already-lost context, browser environment and successful context attributes/version.
- Yields between failed attempts so queued creation-error events can arrive.
- On failure, shows a full diagnostic overlay with Copy report, Download report, Retry/reload and Open outside preview frame controls.
- If context creation succeeds but a later startup step fails, labels that separately and includes its message/stack.
- Does not create probe canvases, clear databases, downgrade to an incompatible WebGL1 renderer, or claim a root cause not supplied by the browser.
- Releases the world's writer lock after startup failure so the failed page does not keep blocking a new attempt.
The report is available as window.__earthGraphicsReport in the game's frame; on failure the complete downloaded overlay report is the preferred diagnostic. No report is automatically uploaded anywhere.
This may get graphics working under a different configuration. It does NOT guarantee that context creation will succeed, nor does the diagnostic report guarantee the browser will disclose the underlying driver reason. Empty status messages are explicitly recorded as empty, not invented.

INSTALL / RUN
Extract ALL files or replace every file in the existing hosted project. Import this complete ZIP into your preview runner; no manual code patch is required. Ensure graphics-context.js is included. Reload bypassing cache, or create a fresh preview snapshot.
Close OTHER running game previews/tabs first, especially older failed builds that may still hold the same world writer lock. If a lock message appears before graphics initialization, close those older tabs and reload.
Local: python -m http.server 8000, then http://localhost:8000. Use HTTPS or localhost, not file://.
Requirements remain WebGL2, Web Workers, IndexedDB, BigInt, structuredClone, crypto.randomUUID and Web Locks. No external runtime libraries/CDNs, package installation or build step. Shader .vert/.frag files must be accessible text, not HTML fallback responses.
If graphics still fail, download the on-screen JSON report. It includes browser/user-agent and page URL; review it before sharing. The failure happens before game-save loading in the normal startup sequence. This revision does not reset or replace your existing save to work around a graphics problem.

QUICK PLAY
Starts near the surface, not 200 km up, for easier physics/editor testing. Mine rock first: click to capture mouse, aim at ground, hold left mouse. M shows stored rock.
Tab or R opens the sphere editor and pauses physical bodies. Right-drag looks; WASD moves. Click preview spheres/part-list entries to select. Drag projected X/Y/Z handles or use numeric fields. Radius is 1–12 m. Add/Duplicate/Delete, preview Undo/Redo, tower generation and design export/import are provided.
Build & simulate spends rock, saves the transaction and releases separate spheres into gravity. Default six-sphere tower costs 192 recorded m3 and has a slight lean so it can topple. G recovers an aimed WHOLE physical sphere and its recorded material exactly once.
There is no permanent new static placement mode. Drafts may be positioned in the air while editing; built bodies fall unless supported. P explicitly pauses/unpauses simulation. This is not structural-support, welding or collapse of the original terrain.

CONTROLS
Mouse look after click capture; Escape releases. WASD moves.
Hold left mouse: repeated terrain digging outside editor. E: one terrain cut. [ / ]: dig radius 2–1000 m. Pending requests may finish after release.
Tab / R: editor. P: physics pause. G: recover aimed real part (100 m range). M: inventory. B: committed world JSON backup.
J: observer flight/no gravity or walking/gravity. Collision remains on.
Space: ascend in flight or jump when grounded walking. C / left Ctrl: descend in flight. Shift: boost/run.
Editor: Ctrl/Cmd+D duplicates; Delete removes preview; Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z undo/redo PREVIEW edits only. Committed objects are recovered with G, not preview undo.
Design export/import transfers local geometry only, not material credits. A draft costs nothing until built. Maximum 64 draft spheres and 64 live physical spheres. Intersecting draft/terrain/player/real-part placements are rejected; touching is allowed with tolerance. No rotation gizmo for symmetric spheres. Existing live spheres cannot be resized in place: recover and rebuild.
Touch has basic movement/look, Editor, Hold dig, Recover, Walk/Fly and editor form/handle pointer support. Full mobile controls/layout remain incomplete and untested.

MATERIAL / PHYSICS SCOPE (UNCHANGED)
One material: rock, assumed density 2700 kg/m3. The accepted 1 m accounting approximation remains.
Terrain cuts count newly solid-to-empty global lattice samples. Each physical part receives a fixed local sphere-lattice volume on construction. Its recorded units do not change when it crosses world grid boundaries, falls or spins. Moving parts cannot create inventory. Blueprints recompute cost from radius and cannot carry free material.
Invariant: inventory units + sum(live physical part units) equals credited terrain cuts minus charged legacy terrain fills. Transfer records are validated and saved atomically with terrain/body state.
No exact analytic-volume claim: smooth geometry and the accounting lattice still differ near boundaries. No ore separation, chemical composition, finite inventory capacity or physical storage containers.
Custom sphere solver: 120 Hz fixed steps, at most 8 steps/frame, constant-magnitude radial 9.81 m/s2 gravity, sphere/terrain and sphere/sphere contacts, low restitution, friction, angular velocity and solid-sphere inertia. 120 m/s speed cap. Five contact iterations. It is not a mature general rigid-body engine and has no continuous collision detection. Large/fast/complex scenes can jitter, penetrate, tunnel or slow down.
Separate parts may fall apart as a stack, but no bonds, welds, joints, fused assemblies, fracture, arbitrary meshes, rockets or general modelling are implemented. Player contact is kinematic, not a dynamic human mass or crushing simulation. Physics pauses in editor, explicit pause and save transactions; save stutters remain possible.
Old sphere-built terrain structures remain LEGACY STATIC CSG, including older floating constructions. New editor bodies are physical; no automatic, material-safe legacy terrain-to-body conversion is implemented. Historical clipped backfills preserve clipToPlanet rather than creating free aboveground material.

SAVES / MIGRATION (UNCHANGED)
Same database/schema as the previous editor ZIP: earth-physical-editor-v1, world store, current record. Existing editor world and physical parts are retained on the same origin/profile.
When no editor save exists, migration checks earth-rock-building-v1, earth-rock-placement-v1, earth-rock-conservation-v1, then geometry-only earth-volume-v1. Recorded inventories are preserved; geometry-only history has no retroactive credit. Original databases remain untouched. Older saves are not continuously synchronized after migration. Old localStorage height-crater format is not imported.
Material transactions save immediately. Moving body positions/velocities autosave about every two seconds when outside editor/not busy. Recent motion can roll back after a crash, without creating partial inventory transactions. Browser storage can be cleared or evicted. No cloud sync, guaranteed permanence, named worlds or world-backup import UI.
B exports world state. Editor design import/export is included, but unfinished draft/camera/pause state is not autosaved across reloads.
20,000 terrain operations and 1,500,000 accounting-node work limit remain; expensive cuts are rejected rather than partly committed. No validated 15 GB storage/3 GB memory target.

RENDERING / PERFORMANCE LIMITS
Original ordered CSG terrain ray renderer and per-pixel sphere rendering are unchanged. No terrain chunk streaming. Near-camera GPU origin improves local precision but does not eliminate float/double differences or thin/distant edge artefacts. No shadows, liquids, real Earth geography or atmosphere.
At most 128 rendered physical/preview spheres. All-pairs sphere contacts, history-scanning collision/picking, full spatial-tree rebuilds and full-record saves can be expensive. Adaptive image resolution remains 0.6–1.0 pixels per CSS pixel. No FPS, iPhone, memory or zero-stutter guarantee.

VALIDATION IN THIS RESPONSE
Syntax parsing passed for main.js, graphics-context.js, material.js, physics.js and world-worker.js.
24 startup assertions passed using MOCKED canvas/context events and a minimal mocked DOM: first/second/third-attempt success; option selection; exceptions; queued browser status messages; all-attempt failure; listener cleanup; already-lost contexts; diagnostic report content/buttons; and separate later-stage failure wording.
61 core regression assertions passed: local sphere volume against brute force, ledger duplication/resize/recovery checks, free fall, contacts, radial planet support, tower collapse, repeated terrain accounting, legacy clipping and spatial tree construction. The six-sphere flat-ground tower again retained 192 recorded m3 while toppling.
Run npm test or the two Node scripts in tests/; no dependency install needed. TEST_RESULTS.json contains this run's actual summary. This revision did NOT rerun every historical prototype test.
NO REAL browser/GPU context was created here. Browser DOM, WebGL shader compilation/rendering, driver failure reason, IndexedDB runtime, live editor controls, mobile interaction and performance remain unverified. Mock context tests establish fallback/control-flow behaviour only, not that a real GPU will accept the request. ZIP integrity checked.

FILES
index.html — complete editor page
main.js — unchanged game/editor behaviour plus startup integration and lock release
physics.js — sphere solver
material.js — local volume and ledger validation
graphics-context.js — NEW fallback/diagnostic module
world-worker.js — terrain accounting/spatial tree
terrain.vert / terrain.frag — renderer
tests/startup.test.mjs — mocked graphics startup checks
tests/core.test.mjs — core regressions
package.json — optional Node test metadata
TEST_RESULTS.json — actual run summary
README.txt — this document
