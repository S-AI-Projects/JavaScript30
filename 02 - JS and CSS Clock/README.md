# 02 - JS and CSS Clock

A real-time analog clock implemented using JavaScript Date calculations and CSS 2D transforms.

## Feature-Support Fallback (R57-T035)

- **Feature-Present Path**: If modern CSS 2D transforms (`transform: rotate(...)`) are supported, the analog clock displays rotating hour, minute, and second hands.
- **Feature-Absent Path**: If CSS transforms are unsupported or unavailable, the page explicitly degrades gracefully:
  - `@supports not (transform: rotate(0deg))` and `CSS.supports()` detect absence of transform support.
  - Hides the static, non-functional analog hands.
  - Displays a high-contrast digital clock readout (`#clock-fallback`) showing current local time with explicit guidance.
- **No Uncaught Exceptions**: Functions reliably in both supported and unsupported environments.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t035.mjs
```
