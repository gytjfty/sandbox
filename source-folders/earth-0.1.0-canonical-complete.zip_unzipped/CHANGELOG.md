# Changelog

## 0.1.0-canonical — 2026-11-11

Scope: consolidate the previously repaired full build plus the 1080p+ renderer into one complete release; improve organization without new gameplay systems.

### Consolidated
- Full-resolution renderer is included, not distributed as a separate required patch.
- Native device-pixel scale, minimum 1080-high buffer, no automatic downscaling; 60 FPS target/cap.
- Version shown in HUD and diagnostics; worker state includes the same version.

### Refactored
- Named shared configuration and command/event constants.
- Persistence/migration/transaction serialization extracted from simulation orchestration.
- Draft model separated from DOM controls; input and view math separated from application orchestration.
- Styles moved out of the page; JS/GLSL broken into readable blocks.
- Planet radius supplied to the shader from shared config with the same numeric value. Traversal/shading algorithms were not intentionally changed.
- Existing physics and material calculations preserved; limits explicitly labelled prototype settings.

### Defensive cleanup
- State-only HUD updates no longer rebuild editor fields on every worker snapshot. Focused numeric fields are not overwritten while typing.
- Falsy corrupted save records (null/false/zero/empty string) now fail validation rather than being mistaken for absent records. They are not replaced by a new world.

### Not added / not claimed
- No backup import, joints/assemblies, new geometry, survival systems, terrain chunking or streaming.
- No claim of real-browser acceptance, driver-context-loss recovery, shader execution or measured 60 FPS for this release.
- No repository commits, tags, deployments or database writes were performed by packaging the ZIP.
