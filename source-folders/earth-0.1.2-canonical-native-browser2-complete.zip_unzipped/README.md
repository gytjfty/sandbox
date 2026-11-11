# Earth 0.1.2-browser2 — complete Canonical-derived browser build

This is the complete project with GPU tile traversal integrated, native-resolution
rendering and the Canonical game/editor/simulation behavior retained. It is NOT an
isolated renderer patch or a mesh experiment. This archive reconstructs and retests
the previously unpackaged browser2 implementation from the source/code preserved
in this conversation. Several source modules are compactly formatted; this is not
represented as a byte-identical copy of every original Canonical file.

## Install using GitHub in your browser

1. From the running old game, press B to export a world backup first.
2. Extract this ZIP. Replace the complete published game folder contents using
   GitHub's browser upload interface or github.dev. Keep index.html at the published
   root and preserve the src/, shaders/, tests/ and docs/ folders.
3. Commit/publish through your existing GitHub Pages workflow, wait for publishing,
   then reload the usual HTTPS game address. No npm install, terminal, build step,
   Codespaces or additional software is required.
4. Close other game tabs first. Keep the same host/origin/browser profile for the
   browser-stored save. Reload bypassing cache if needed, but NEVER clear browser
   site data/IndexedDB to install or troubleshoot this build.

Opening index.html as a local file is unsupported. A normal supported HTTPS origin
is required for shader fetching, module workers, IndexedDB and Web Locks. The ZIP
contains all runtime modules/styles/shaders; no CDN libraries or remote source
bootstrap downloads are used. The save database remains earth-physical-editor-v1.

## Folder layout

index.html and styles.css are the entry point/layout. src/ contains game modules,
editor/input, workers, physics, persistence, terrain queries and rendering. shaders/
contains both analytic paths; tests/ contains Node tests and a browser regression
harness. docs/ contains actual test results, source notes and remaining-work status.

## Implemented GPU change

Terrain candidate lists are built for 64-pixel screen tiles, using conservative
projected sphere bounds including numerical padding. The GPU traces only those
candidates instead of walking unrelated BVH nodes for each pixel. Candidate leaves
retain the reference BVH's leaf order and original ordered cut/fill metadata.

Every output pixel still computes an analytic terrain intersection. A tile is NOT
lower-resolution rendering, LOD, a terrain mesh or an approximate collision shape.
No operation is deleted from saves, rendering history or material accounting.

The original reference path is available through the 'Terrain: tiled / reference'
button, without changing the world, camera or resolution. A list budget of
1,048,576 references falls back to the original path instead of truncating history.
Some scenes with large overlapping edits may not benefit; CPU list generation and
uploads also cost time. Compare both paths on your actual hardware.

Lists/textures reuse memory/storage, and stationary views reuse their uploaded
lists. Diagnostics includes active/requested mode, fallback reason, candidate
counts, tile-build CPU time, upload counters and draw timing when supported.

## Retained browser1 changes

- Native canvas pixel dimensions: CSS canvas size multiplied by the browser's DPR,
  rounded to integer pixels. NO 1080p minimum, automatic downscaling or forced
  upscale. For example, DPR 1 with a 1366 x 762 viewport renders 1366 x 762, and
  DPR 2 with a 683 x 381 logical viewport also renders 1366 x 762.
- Reused terrain/object staging buffers, cached capabilities/fill count, persistent
  textures and no object upload when the rendered object data is unchanged.
- Ordered CPU distance-field acceleration for simulation clearance, body contacts,
  normal queries and placement validation. Reference terrain/accounting functions
  remain available separately; leaf formulas and operation order are retained.
- Anchor hysteresis avoids uploads when oscillating across a grid boundary while
  retaining the baseline's 1024-m camera-local coordinate range. High-speed flight
  still requires tree rebasing/uploads; this is not an elimination of that cost.
- One outstanding graphics fence, not the unproven two-frame queue. Independent
  fixed-step simulation remains in its own worker. Editor pause is intentional.
- Safe context recovery: retain restore extension, invalidate lost handles, reject
  stale initialization, rebuild graphics only and continue simulation.
- Optional asynchronous GPU draw timing, CPU submission timing, upload/allocation/
  fence counters, 240 submitted-frame records and 240 callback-gap records.

GPU timings in history are recent smoothed results, not exact per-frame timings.
Completed-fence FPS is not measured monitor presentation FPS. Reports include CSS
and internal pixel dimensions/DPR so browser and OS scaling can be distinguished.

## Preserved gameplay

Spherical volumetric world, persistent cuts/cavities, conserved terrain/inventory/
part material, physical spheres, gravity/contact/friction, whole-part recovery,
selection, XYZ handles, numeric fields, add/duplicate/delete, undo/redo, towers,
design import/export and Build & simulate are included. Drafts survive closing the
editor in memory, not page reload. Moving/duplicating/importing drafts does not
create material; actual construction spends it. Saves use the existing schema and
ledger validation. Invalid saves are not replaced by a blank world.

No welding/joints/arbitrary shapes/fracture/strength or complete touch controls are
added. The existing sphere/contact approximation, five contact iterations, 60-Hz
physics, limits and incomplete touch coverage are retained.

## Browser testing on your machine

- Check Diagnostics: native-device-pixels, minimumRenderHeight 0 and expected pixel
  dimensions. Browser/OS scaling is reflected by the reported CSS dimensions/DPR.
- Hold the same camera/view/world for both traversal modes. P can stop body physics
  for a static comparison. Let each mode run for several seconds before exporting
  Diagnostics. Native sizing itself can save pixels relative to forced 1080p; do
  not attribute that difference solely to GPU traversal.
- With unchanged terrain, camera and static bodies/previews, objectUploads,
  terrainUploads and tileUploads should stop increasing after warmup. Camera
  movement legitimately rebuilds tile lists; body motion changes object data.
- Test digging, movement/flight, editor, construction, recovery, backups, reload
  and Restore graphics. For dips, export a report; do not clear site data.

## Executed tests and limits

See docs/TEST_RESULTS.json and TEST_LOG.txt. This reconstructed archive was tested
again before packaging, rather than relying on the prior response's test claims.

Node tests include 7,601 exact CPU distance comparisons, 150,000 tile-coverage ray
checks, order/cache/fallback checks and accounting/editor/physics regressions.
Real Chromium/WebGL pixel readback compares reference/tiled paths in nine cases:
empty terrain, cuts, mixed ordered/clipped fills, camera-inside cases, altitude,
149 cuts at native 1366 x 762 and forced list-budget fallback, with ten rendered
sphere bodies and an editor preview. These cases had zero differing components.
This is regression evidence, not a proof for every scene or GPU driver.

Real browser checks also cover native DPR 1/2 sizing, digging/build material debit,
editor undo/redo, saved-world reload, unchanged uploads, context restoration while
simulation advances, a synthetic 46-edit/10-body world, and one-time recovery from
a browser worker with no renderer. The synthetic scene is NOT your saved scene.

All automated browser checks use SwiftShader SOFTWARE rendering. Target-hardware
60 FPS and under-16.7-ms GPU draw time remain UNVERIFIED. Candidate-count reductions
and software pixel matches are not claimed as a measured hardware speedup. The
original Canonical 1,005-assertion suite was not rerun as a whole; no such new passing
claim is made. Every legacy migration/touch/device path is not revalidated.

## Remaining work, not silently claimed complete

CPU occupancy/raycast acceleration, physics broad phase, elimination of repeated
high-speed tree uploads and original-user-scene hardware acceptance remain open.
This ZIP is a complete runnable checkpoint, not completion of the entire audit.

## Controls / troubleshooting

Click captures mouse; WASD moves. J walk/flight. Space jump/up. C/left Ctrl down.
Shift boost. Hold click/E dig. [ and ] dig radius. G whole-part recovery. Tab/R
editor. P body pause. B backup. Right-drag looks in editor. Ctrl/Cmd+D duplicates a
draft, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes. Delete removes selected previews.

Use Restore graphics for GPU loss. For module/shader HTTP errors, check all folders
were published together. Never mix only this shader with an older renderer. Keep
browser data/backups if save validation fails. Optional Node tests use built-ins;
Node is not required to play. Synchronous gl.finish/readPixels exist only in the
browser test harness, not in production rendering.
