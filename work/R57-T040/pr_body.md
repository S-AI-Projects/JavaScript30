## Description

This PR implements and verifies keyboard accessibility for '25 - Event Capture, Propagation, Bubbling and Once' (Issue #40). It provides an accessible skip-to-content link, logical Tab traversal across all interactive controls without introducing positive `tabindex` values, high-contrast visible focus indicators, and keyboard event activation (`Enter` / `Space`) honoring event propagation and once listeners.

## Related Issue

Fixes: #40

## Type of Change

- [x] Bug Fix
- [ ] New Feature
- [x] UI/UX Improvement
- [ ] Performance Improvement
- [x] Tests
- [x] Documentation
- [ ] Refactoring / Maintenance
- [ ] CI/CD

## Changes Made

- **25 - Event Capture, Propagation, Bubbling and Once/index-START.html**:
  - Added an accessible off-screen skip link (`.skip-link`) that slides into view and focuses when navigating via Tab.
  - Added standard `tabindex="0"` on nested interactive event layers (`.one`, `.two`, `.three`) and a dedicated `#once-btn` control without introducing positive `tabindex`.
  - Added high-contrast visible focus outlines (`outline: 4px solid #000000; outline-offset: -4px;`) on `:focus` and `:focus-visible` without altering the demonstrated CSS layout.
  - Implemented keyboard event handlers on interactive layers and buttons supporting `Enter` and `Space` activation, correctly logging capturing, bubbling, and `{ once: true }` behaviors.
- **25 - Event Capture, Propagation, Bubbling and Once/README.md**:
  - Documented keyboard navigation, visible focus styling, skip-link integration, and automated regression testing.
- **tests/course/r57-t040.mjs**:
  - Implemented automated Playwright test suite validating HTTP 200, initial off-screen skip-link styling, Tab focus visibility, `#main-content` jump, logical nested layer traversal, outline styles, keyboard event bubbling, button activation, zero positive `tabindex`, and zero runtime page errors.
- **work/R57-T040/**:
  - Recorded baseline observations, execution metrics, tool versions, and focus screenshots.

## Screenshots / Recordings

- Skip Link Focused: `work/R57-T040/skip-link-focused.png`
- Interactive Controls Keyboard Focused: `work/R57-T040/controls-keyboard-focused.png`

## Testing

- **What was tested**:
  - HTTP 200 page response.
  - Skip link initial off-screen top offset (-100px).
  - Tab navigation into skip link and visible focus outline display.
  - Skip link activation jumps focus to `#main-content` (`.one`).
  - Sequential Tab traversal: `.two` -> `.three` -> `#once-btn`.
  - Visible focus outlines confirmed on `.three` and `#once-btn`.
  - Keyboard activation of `.three` via `Enter` triggers proper bubbling (`['three', 'two', 'one']`).
  - Keyboard activation of `#once-btn` via `Space` triggers click once (`['button-clicked']`).
  - Zero positive `tabindex` attributes in DOM.
  - Zero uncaught page/console errors throughout execution.
- **How it was tested**: Automated Playwright test suite run on headless Chromium.
- **Test commands executed**:
  ```bash
  node tests/course/r57-t040.mjs
  ```
- **Actual results**: 14/14 checks passed.
- **Limitations**: None.

## Checklist

- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes

Process and browser contexts are cleanly initialized and terminated upon test completion.
