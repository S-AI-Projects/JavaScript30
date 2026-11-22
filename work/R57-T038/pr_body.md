## Description

This PR implements accessibility enhancements for '21 - Geolocation' (Issue #38), respecting user preferences for reduced motion (`prefers-reduced-motion: reduce`) and visible keyboard focus navigation at both mobile (360px) and desktop (1280px) viewports.

## Related Issue

Fixes: #38

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

- **21 - Geolocation/index-START.html**:
  - Implemented responsive semantic container `<main class="compass-app" role="main">` with fluid typography (`clamp()`).
  - Added `@media (prefers-reduced-motion: reduce)` rules disabling CSS transitions and dynamic transform animations on `.arrow` and interactive controls.
  - Added visible, high-contrast `:focus-visible` styling (`outline: 3px solid #ffffff; outline-offset: 3px;`) on interactive controls for keyboard accessibility.
  - Implemented geolocation watcher with fallback handling and manual calibration control (`#calibrate-btn`) to allow testing and keyboard interaction without requiring physical device movement.
- **21 - Geolocation/README.md**:
  - Added documentation covering motion and focus preferences, keyboard usage, and automated test execution steps.
- **tests/course/r57-t038.mjs**:
  - Added automated Playwright test suite validating HTTP 200, normal motion dynamics (`transitionDuration > 0s`), reduced-motion emulation (`transitionDuration === 0s`), usable controls under reduced motion, zero horizontal overflow at 360px and 1280px viewports, visible focus outlines at both widths, and zero uncaught page errors.
- **work/R57-T038/**:
  - Recorded baseline observations, execution results, version manifests, and focus/motion screenshots.

## Screenshots / Recordings

- Before: Unstyled baseline with no focus outlines, no reduced-motion query, and empty script.
- After:
  - Reduced Motion State: `work/R57-T038/reduced-motion.png`
  - Visible Keyboard Focus at 360px Viewport: `work/R57-T038/focus-360px.png`
  - Visible Keyboard Focus at 1280px Viewport: `work/R57-T038/focus-1280px.png`

## Testing

- **What was tested**:
  - HTTP 200 page load.
  - Normal motion allows transition duration (0.2s).
  - Geolocation watchPosition updates compass rotation and speedometer readout.
  - Under `prefers-reduced-motion: reduce`, transition duration drops to 0s and interactive controls remain fully usable.
  - Zero horizontal overflow at 360px viewport.
  - Visible keyboard focus indicator verified on `#calibrate-btn` at 360px.
  - Zero horizontal overflow at 1280px viewport.
  - Visible keyboard focus indicator verified on `#calibrate-btn` at 1280px.
  - Zero uncaught page/console errors across all browser contexts.
- **How it was tested**: Automated Playwright test run on headless Chromium.
- **Test commands executed**:
  ```bash
  node tests/course/r57-t038.mjs
  ```
- **Actual results**: 13/13 checks passed successfully.
- **Limitations**: None.

## Checklist

- [x] I have tested my changes locally.
- [x] I have added or updated tests, if needed.
- [x] I have updated documentation, if needed.
- [x] I have followed the project's coding guidelines.
- [x] I have run the relevant tests and checks.
- [x] I have addressed previous review feedback, if applicable.

## Additional Notes

Browser contexts and local HTTP server processes are isolated per test scenario and safely terminated upon completion.

