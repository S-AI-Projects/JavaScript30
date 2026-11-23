# R57-T029 — Safe Text Rendering

## Baseline
The original page was console-only:
- Body text length: 0
- Rendered body children: 1
- Page errors: 0

## Changed behavior
Added a small isolated text-rendering companion example.

The example renders input using `textContent`, so the supplied string is displayed literally as text. Rich HTML is not supported by this example.

## Test
Run:

```bash
node tests/course/r57-t029.mjs
