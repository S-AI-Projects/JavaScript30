# 21 - Geolocation

Compass and speedometer driven by GPS orientation and speed coordinates.

## Motion and Focus Preferences (R57-T038)

- **Prefers-Reduced-Motion Support**: Under `@media (prefers-reduced-motion: reduce)`, CSS transitions and dynamic transform animations on `.arrow` and interactive controls are disabled (`transition: none !important`), preventing motion sickness while retaining immediate directional updates.
- **Visible Keyboard Focus**: The interactive control (`#calibrate-btn`) features a high-contrast visible focus outline (`outline: 3px solid #ffffff; outline-offset: 3px;`) conforming to WCAG 2.1 AA focus-visible guidelines.
- **Responsive Geometry**: Responsive layout constrained via `clamp()` ensuring zero horizontal overflow across narrow mobile (360px) and wide desktop (1280px) viewports.
- **Geolocation Simulation & Fallback**: Handles null speed/heading values gracefully and provides manual calibration capabilities.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Suite
```bash
node tests/course/r57-t038.mjs
```

