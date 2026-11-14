# 16 - Mouse Move Shadow

## Overview
This exercise tracks pointer coordinates over the `.hero` region and dynamically projects multi-layered RGB text shadows around the `h1` element according to cursor distance from center.

## Accessibility, Motion & Focus Enhancements
- **Reduced Motion Support (`prefers-reduced-motion`)**:
  - Implements CSS `@media (prefers-reduced-motion: reduce)` to override heavy text-shadow effects with a calm, static 2px shadow.
  - Adds runtime check `window.matchMedia('(prefers-reduced-motion: reduce)')` in the `shadow()` event handler to prevent expensive multi-color shadow calculations and flashing for sensitive users.
- **Responsive Typography**:
  - Uses `font-size: clamp(2.5rem, 8vw, 100px)` with `max-width: 90vw` so the header cleanly fits mobile screens (360px) and wide desktop displays (1280px) without horizontal clipping.
- **Visible Keyboard Focus**:
  - Adds high-contrast dashed focus outline (`h1:focus-visible`) ensuring the editable heading is clearly identified by keyboard users at all viewports.

## Running Tests
Run the automated Playwright regression suite:
```bash
node tests/course/r57-t019.mjs
```
