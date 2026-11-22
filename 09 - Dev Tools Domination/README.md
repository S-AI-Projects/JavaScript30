# 09 - Dev Tools Domination

Interactive console methods and DOM manipulation demonstration.

## UI Regression Detection (R57-T039)

- **Target Behavior**: The main visible interactive element `<p onClick="makeGreen()">×BREAK×DOWN×</p>` transforms when clicked, applying `#BADA55` color and `50px` font size.
- **Plausible UI Regression Trap**: `tests/course/r57-t039.mjs` executes an automated regression suite verifying that:
  1. The legitimate application correctly responds to user click events and transforms visually to `rgb(186, 218, 85)` and `50px`.
  2. A simulated regression (deliberately broken click binding/mutation in a fixture) fails to transform and is caught by the test assertion.
  3. The production application code on disk remains completely untouched and unmutated.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Suite
```bash
node tests/course/r57-t039.mjs
```
