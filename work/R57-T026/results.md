# R57-T026 Results

## Test command

`node tests/course/r57-t026.mjs`

## Baseline behavior

The START page contains the `#main` navigation in normal document flow. The sticky-navigation script was initially empty.

## Feature behavior

- Supported path: scrolling activates fixed navigation and adds the `fixed-nav` body state.
- Unsupported path: when `window.scrollY` is unavailable, sticky navigation is not activated and an explicit fallback is provided.
- Remote image and favicon requests are replaced with deterministic local Playwright fixtures.

## Expected vs actual

- Supported scrolling: PASS.
- Unsupported feature fallback: PASS.
- External fixtures: PASS.
- Unexpected page errors: none.
- Overall: `R57-T026 regression checks passed.`

## Evidence

- `baseline.png`
- `supported-fixed.png`
- `unsupported-fallback.png`
- `tool-versions.txt`
