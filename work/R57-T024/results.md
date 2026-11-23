# R57-T024 Results

## Test command

`node tests/course/r57-t024.mjs`

## Baseline behavior

The START page is a static event-propagation example with three nested divs. Its script section is empty, so clicking the inner div produces no visible event output.

## Regression behavior

The isolated harness tests the intended `once: true` event-listener behavior from the finished example.

Expected:
- First click triggers the three bubbling handlers exactly once.
- Second click does not trigger the handlers again.
- No duplicate DOM nodes are created.
- No unexpected browser page errors occur.

Actual:
- First click: PASS.
- Second click: PASS.
- DOM duplication check: PASS.
- Page error check: PASS.

## Result

R57-T024 regression checks passed.

## Evidence

- `baseline.png`
- `repeated-interaction.png`
- `tool-versions.txt`