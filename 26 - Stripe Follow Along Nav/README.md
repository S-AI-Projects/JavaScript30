# 26 - Stripe Follow Along Nav

## Overview
This exercise creates an animated dropdown navigation bar reminiscent of Stripe's header, where a single white background pill dynamically resizes and slides between navigation items upon hover or keyboard focus.

## Implementation Details
- **Dynamic Coordinate Tracking**: Computes `getBoundingClientRect()` of the active dropdown relative to the `.top` nav container, updating `width`, `height`, and `transform: translate(x, y)` on `.dropdownBackground`.
- **Phased Animation Timing**: Two-phase CSS classes (`trigger-enter` and `trigger-enter-active`) ensure the element is first displayed and then smoothly transitioned in opacity.
- **Accessible Focus Support**: Navigation triggers listen to both pointer events (`mouseenter`, `mouseleave`) and focus events (`focusin`, `focusout`) to allow seamless keyboard traversal.
- **Plausible Regression Testing**: Test suite exercises the correct implementation and contrasts it against a deliberate fixture mutation (omitted leave/close event handling) to verify that UI regressions are accurately flagged and rejected.

## Running Tests
Run the Playwright test suite:
```bash
node tests/course/r57-t020.mjs
```
