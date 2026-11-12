# Earth 0.1.3 — reachable Sun foundation

Complete static browser project derived from the working 0.1.2-browser2 runtime at commit a3ed906451bbf7098fab9e79821a1c323c44bb4f in gytjfty/sandbox. All 20 original runtime files were reconstructed from source already retrieved through GitHub and matched against Git blob SHA-1 before changes were applied. See docs/BASELINE_VERIFICATION.json.

## Scope of this delivery

This completes the previously unfinished Sun/travel checkpoint, NOT the whole Earth-like geography project. Earth retains its existing spherical volumetric terrain and appearance. Procedural continents, ocean basins, mountains, valleys, oceans, atmosphere, soil/sand/snow/vegetation systems and new physical resources are NOT implemented in this checkpoint. No existing saved rock is relabelled, regenerated, or replaced.

## Install entirely through your browser

1. In your working browser2 game, press B / World backup and keep that backup.
2. Extract this ZIP and replace the complete published game folder through GitHub's browser upload or github.dev. Keep index.html at the published root with src/, shaders/, styles.css, tests/ and docs/ beside it. Do not upload this ZIP as though GitHub Pages will unpack it automatically.
3. Commit/publish using your existing GitHub Pages workflow. No terminal, Codespaces, npm install, build command, or additional installation is required to play.
4. Close other game tabs, then open your usual HTTPS game address after publishing completes. If old assets remain cached, reload bypassing cache. Keep the same host/origin/browser profile to retain the browser save.

Do NOT clear site data or IndexedDB. Opening index.html as file:// is unsupported. Modules, shader requests, module workers, IndexedDB and Web Locks require a supported browser and appropriate HTTPS origin. All runtime code and shaders are bundled; there are no CDN libraries, external source loaders, or runtime GitHub downloads.

## Reach the Sun and return

- U or the Cruise button toggles an explicit fictional high-speed flight mode. Enabling it selects flight. J switches walking/flight and turns cruise off.
- Click the viewport to capture the mouse. WASD moves, Space moves radially up, C / left Ctrl down. Shift boosts.
- Use Face Sun to aim at the actual stellar centre, then hold W to approach. If near terrain, Space + Shift first gains clearance. Sun size changes continuously with your location.
- Release movement keys to stop. Face Earth turns toward the actual Earth centre; hold W to return, then use normal flight/walking for local play. These buttons rotate the camera only; they do not teleport or regenerate anything.
- Cruise speed scales with the smaller Earth-surface / solar-boundary distance, slows near either destination, and caps at 1,000,000,000 m/s. This is deliberately faster-than-light game navigation, not a relativity model. Existing ordinary flight speed behavior is retained when cruise is off.
- The navigation bar reports Earth altitude, distance to the solar centre and remaining clearance to the stellar boundary. The working coordinate domain is limited to +/-1,000,000,000,000 m per axis; movement clips at its boundary rather than creating an unsaveable location.

The Earth centre stays at [0,0,0]. The Sun is fixed one astronomical unit (149,597,870,700 m) from that centre in direction normalize([1,.6,1]). This is a static, real-distance arrangement, not an orbital ephemeris. The rendered stellar radius is 695,700,000 m. The non-landable interaction boundary is 1,000,000 m above that radius, with about a 1 m numerical guard. An analytic swept-segment check prevents passing through the entire stellar boundary at high speed. The Sun is luminous geometry, not a sky texture, a camera-following sprite, or a walkable rock sphere. Lighting uses its world direction. Existing ambient light and local view-aligned lamp remain.

No heat/damage, stellar gravity, orbital dynamics, solar wind, fluid physics, buoyancy, atmospheric entry or realistic stellar simulation is added. Body physics still uses the existing Earth-radial gravity/contact model. Star shading is a simple luminous disc with limb variation, not a detailed photosphere model.

## Saves, construction and performance

Terrain history, physical bodies, materials and ledger validation retain the browser2 systems. The save database remains earth-physical-editor-v1 and the format remains earth-editor-v1. The additive optional navigation field stores position, direction, walking/flight, cruise and vertical velocity. Legacy records without it start at the original spawn. Valid saved navigation resumes after reload. Invalid navigation is rejected without silently replacing the world. Autosave includes navigation even when no bodies exist, approximately every two seconds of active simulation. B exports the current navigation immediately along with the world.

Inventory + material in bodies must still equal the terrain ledger. Navigation does not debit, credit or recreate material. Existing caves, operations, physical spheres, recovery, design import/export, placement checks, numeric editing, selection/handles, duplicate/delete, undo/redo, towers, intentional editor physics pause, walking, jumping, flight and incomplete touch controls remain in the integrated source. Drafts are memory-only and do not become persisted designs.

Browser2's analytic terrain paths, conservative screen tiles, reference fallback, native viewport/DPR rendering, staging reuse, anchor hysteresis and graphics-only recovery remain. No mesh terrain, LOD, resolution downscaling or terrain-history truncation is added. Long-distance planet-ray discriminants use a more stable expression to keep Earth visible from space. Sun-relative vectors are scaled by the solar radius before GPU upload. Camera/editor basis handling now supports exact radial look directions.

No new 60 FPS guarantee is made. High-speed rebasing still uploads the terrain tree and may cost CPU/GPU time. Large saves, graphics driver behavior and target hardware remain acceptance work. Graphics recovery is inherited, not newly browser-validated in this environment.

## Executed tests and limitations

See docs/TEST_RESULTS.json and docs/TEST_LOG.txt for the actual run from this bundle. The final Node suite passes 20/20 tests, including 7,601 exact ordered terrain-field comparisons, 150,000 tile-coverage ray samples, material/recovery/editor/physics checks, stellar sweep checks, 10,000 repeated minimum-speed stellar approaches, navigation validation and a full Earth-Sun-Earth synthetic simulation round trip.

Simulation-module tests execute the real command/movement code with mocked worker transport, Web Locks, timers and in-memory WorldStore load/write. They do NOT constitute real IndexedDB, browser worker scheduling, browser rendering, graphics recovery or hardware FPS tests. The final run is new evidence; prior browser2 results are not counted as rerun.

No Chromium/WebGL runtime or shader compiler was available here. Thus GLSL compile/link, visible output, reference/tiled pixel equivalence with this lighting change, touch, fullscreen, native browser DPR, actual storage failures and real browser save migration/reload were NOT executed. A browser graphics harness is supplied at tests/render.html; open its hosted URL to run shader compilation, synthetic scenes, solar visibility and reference/tiled readback comparison on your device. It never opens the save database. Its synchronous GPU reads exist only in the harness, not production. Shipping that harness does not mean it was executed here.

## Other controls / debugging

Tab/R editor. Hold click/E dig. [ and ] dig radius. G recover aimed whole physical part within 100 m. P body pause. B world backup. Right-drag looks in editor. Ctrl/Cmd+D duplicates a draft. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Delete removes previews, not real constructed material. Existing touch support remains incomplete; the cruise and face buttons are available in the toolbar.

If startup fails, check all modules and shaders were published together and inspect the on-screen error. Restore graphics rebuilds graphics only. Diagnostics exports render/navigation state. Do not mix this shader with older JavaScript. Do not delete browser storage to troubleshoot. Preserve your backup and browser2 deployment as rollback. The browser2 source can still read the material world with the additive navigation field, but it will not resume the new navigation feature.

Optional developer tests use Node built-ins only: node --test tests/*.test.mjs. Node is not required to play.
