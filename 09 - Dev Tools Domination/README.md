# Dev Tools Domination

## Run

Open `index-START.html` through a local HTTP server.

## Regression test

From the repository root, run:

`node tests/course/r57-t025.mjs`

The regression check uses Playwright with a fixed viewport and a local fixture for the external favicon request. It verifies the initial DOM state and the `makeGreen()` interaction in two fresh browser contexts.

Evidence is stored in `work/R57-T025/`.