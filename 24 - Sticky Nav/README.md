# Sticky Nav

## Run

Open `index-START.html` through a local HTTP server.

## Regression test

From the repository root, run:

`node tests/course/r57-t026.mjs`

The regression check uses Playwright with deterministic local fixtures. It verifies both the supported sticky-navigation path and the explicit fallback when `window.scrollY` is unavailable.

Evidence is stored in `work/R57-T026/`.
