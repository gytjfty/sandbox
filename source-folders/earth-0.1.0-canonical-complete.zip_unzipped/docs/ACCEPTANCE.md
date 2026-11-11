# On-device acceptance — not claimed passed

Keep the earlier working ZIP and a world export. Do not clear IndexedDB to work around a failure. Use the same browser/profile/origin and edited world. Keep a fixed camera pose and resolution when comparing performance.

## Consolidation
- Install this complete package, with no old renderer patch overlaid.
- Confirm `0.1.0-canonical` in HUD, renderer diagnostics and simulation diagnostics.
- Confirm actual expected 1080p+ buffer dimensions. Automatic downscaling must remain false.

## World/material
- Existing edits, cavities, inventory and bodies load without change.
- Legacy clipped fills do not grow above the original planet.
- Mine fresh material, then repeat a previously removed region: no duplicate credit.
- Build away from terrain/player: inventory decreases by exactly the part quantity.
- Unsupported parts fall. Move/collide them: material does not change.
- Recover a part once: quantity returns once. Repeat aim/recovery: no duplicate credit.
- Reload after transaction completion: same material total and constructed parts.
- World backup exports without depending on graphics readiness.

## Editor
- Click selection and list selection agree.
- Numeric XYZ and radius can be typed without snapshot updates resetting the field.
- X/Y/Z handle dragging, add/duplicate/delete, undo/redo, tower work.
- Export/import design preserves geometry but grants no material.
- Close/reopen preserves the in-memory draft. Building clears only the successfully purchased draft.
- Invalid terrain/player/part intersections and insufficient inventory reject safely.

## Rendering/simulation
- Look/walk/fly/dig and recover work with no new controls required.
- Run the actual heavily edited world for at least 30 seconds and export Diagnostics.
- Assess render FPS AND buffer size AND overload, not callback count alone. Target is 60 FPS, not 120.
- Test graphics loss/restore only after a backup; simulation should not be recreated or gated on a GPU fence.
- Confirm renderer failure leaves UI backup requests available when the page itself responds.
- Inspect legacy-filled regions separately: the cut-only optimization does not cover them.

## Release decision

If any check fails, keep the old baseline and report the diagnostic JSON/console error. Passing CPU/mock tests alone does not authorize claiming real GPU/browser acceptance. No new gameplay feature should be layered on this cleanup until these checks are accepted on-device.
