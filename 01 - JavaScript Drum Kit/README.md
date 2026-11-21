# 01 - JavaScript Drum Kit

Interactive JavaScript drum kit that plays assigned audio samples upon keyboard presses, with animated key transitions.

## Empty and Error States (R57-T032)

- **Empty / Unmapped State**: When an unmapped key or unrecognized interaction occurs, a non-intrusive semantic status indicator (`#status-display`) informs the user with guidance ("Key not mapped...").
- **Asset Failure & Error Boundary**: If an audio sample asset fails to load or cannot be played by the browser, the error is safely caught without uncaught exceptions, the affected key receives `.key-error` styling, and `#status-display` shows clear feedback.
- **Graceful Recovery**: Pressing any valid mapped key immediately clears unmapped/error states and transitions to normal playback.
- **Static Asset Fallback**: `style.css` provides a dark background color fallback (`#121826`) in case `background.jpg` fails to load.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t032.mjs
```
