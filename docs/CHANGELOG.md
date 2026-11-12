# 0.1.3-sun-foundation

- Pinned and hash-checked browser2 runtime before modifications.
- Added fixed-world solar geometry, direction-based illumination, stellar exclusion sweep, explicit fictional cruise, navigation display and face-target camera controls.
- Added validated optional navigation saves and empty-body autosaves, without changing material density, ledger schema, terrain field, operation ordering, or original physical solver.
- Fixed degeneracy when camera/editor looks exactly radially toward/away from Earth and allowed small mouse pitch inputs to escape that exact direction.
- Resolved prior camera test's signed-zero mismatch using vector-distance comparison; no geometry tolerance was weakened.
- Resolved prior repeated-approach safety-margin failure by including the numerical guard in the swept collision radius. The previous endpoint-only subtraction allowed minimum-speed steps to erode the guard before intersecting the actual exclusion sphere. New regression checks include 10,000 repeated approaches.
- Added +/-1e12 m coordinate-domain clipping so exploration cannot write a position outside the validated save domain.

Not added: procedural Earth-like geography, water, atmosphere, vegetation, new materials, orbital/stellar physics. This is the Earth-Sun foundation checkpoint, not completion of that broader world project.
