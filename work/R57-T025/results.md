# R57-T025 Results

## Test command

`node tests/course/r57-t025.mjs`

## Baseline behavior

The START page is a static console-tools example with a paragraph containing `×BREAK×DOWN×`. Clicking the paragraph runs `makeGreen()`, changing its color and font size.

## Deterministic fixtures

- Browser viewport locked to 1280x800.
- External `fav.farm` favicon request replaced with a local Playwright fixture.
- No public API, clock, or randomness dependency was introduced.

## Expected

- Two fresh browser contexts produce the same DOM state.
- Initial paragraph text is `×BREAK×DOWN×`.
- Initial font size is `16px`.
- Clicking the paragraph changes the color to `rgb(186, 218, 85)`.
- Clicking the paragraph changes the font size to `50px`.
- No unexpected page errors occur.

## Actual

- Context 1: PASS.
- Context 2: PASS.
- External favicon fixture: PASS.
- Page errors: PASS.

## Result

R57-T025 regression checks passed.

## Evidence

- `changed.png`
- `tool-versions.txt`