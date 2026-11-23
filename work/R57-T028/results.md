# R57-T028 Results

## Test command

node tests/course/r57-t028.mjs

## Baseline

- #draw exists as an 800x800 canvas.
- The START page has no visible text and no page errors.
- The page has no animation.

## Changed behavior

- #draw is keyboard-focusable with tabindex="0".
- #draw has an accessible label.
- A visible focus indicator is provided with :focus-visible.
- Reduced-motion preference is explicitly supported.

## Expected

- Reduced-motion emulation keeps the canvas usable.
- Keyboard focus remains visible at 1280px and 375px widths.
- No unexpected browser page errors occur.

## Actual

- Normal preference: PASS.
- Reduced motion: PASS.
- Keyboard focus: PASS.
- Responsive widths: PASS — 1280px and 375px.
- Page errors: PASS — 0.

## Result

R57-T028 regression checks passed.
