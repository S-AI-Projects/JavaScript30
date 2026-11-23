# Expected vs Actual — R57-T021

## Expected

- The keyboard can reach the skip-to-content link and all relevant navigation controls.
- Focus is visibly indicated.
- No positive tabindex values are introduced.
- The skip-to-content link points to the main content target.
- Activating the skip link with Enter navigates to the main content target.
- The browser check fails when an assertion fails.
- Unexpected page errors cause the check to fail.

## Actual

- Tab traversal reaches the controls in this order:
  1. Skip to content
  2. About Me
  3. Courses
  4. Other Links
- Focus has a visible outline on each tested control.
- No positive tabindex values are present.
- The skip-to-content link points to `#main-content`.
- `#main-content` exists with `tabindex="-1"`.
- Pressing Enter on the skip link navigates to `#main-content`.
- No unexpected JavaScript page errors were detected.
- The Playwright check completed successfully.

## Test command

`node tests/course/r57-t021.mjs`

## Result

`Task R57-T021 keyboard accessibility checks passed.`

## Server

The page was tested through the local HTTP server at:

`http://127.0.0.1:8000/`

## Tool versions

- Node.js: v26.13.1
- Playwright: 1.65.1
- Python: 3.15.2