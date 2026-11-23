# R57-T022 — Responsive Layout Regression

## Baseline

- 360×800: 517px scroll width vs 360px viewport — unintended horizontal overflow.
- 1280×800: 1280px scroll width vs 1280px viewport — no horizontal overflow.

## Changed behavior

- 360×800: 360px scroll width vs 360px viewport — PASS.
- 1280×800: 1280px scroll width vs 1280px viewport — PASS.

## Automated check

node tests/course/r57-t022.mjs

The check verifies 9 drum keys, preserved key order, 9 audio elements, local audio sources, viewport bounds, and unexpected page errors.
