# Fun with HTML5 Canvas

## Entry point

`08 - Fun with HTML5 Canvas/index-START.html`

## Run

From the repository root:

`python3 -m http.server 8000`

Open:

`http://127.0.0.1:8000/08%20-%20Fun%20with%20HTML5%20Canvas/index-START.html`

## Accessibility behavior

The demo is a static canvas with no animation. The canvas is keyboard-focusable and provides a visible focus indicator. Reduced-motion preference is supported without removing any information or controls.

## Regression test

From the repository root:

`node tests/course/r57-t028.mjs`

The check verifies the static canvas, reduced-motion preference, keyboard focus visibility, both tested viewport widths, and unexpected browser errors.

Evidence is stored in `work/R57-T028/`.
