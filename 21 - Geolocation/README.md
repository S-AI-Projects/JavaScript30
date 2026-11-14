# 21 - Geolocation & Compass Walkthrough

This project demonstrates live device geolocation tracking, converting GPS speed and compass heading into interactive UI updates (rotating SVG compass arrow and numeric speedometer display).

## Tested Walkthrough (R57-T017)

### 1. Entry Point
- **Page:** `21 - Geolocation/index-START.html`
- **Main Rendered Region:** `.compass-container` (containing `.arrow` SVG and `.speed` heading).

### 2. Setup & Execution Command
```bash
# Install dependencies from repository root
npm install

# Run the automated walkthrough test
node tests/course/r57-t017.mjs
```

### 3. Step-by-Step Interaction & Expected Observations

1. **Initial Page Load:**
   - **Action:** Open `index-START.html` with granted geolocation permissions.
   - **Observation:** The compass arrow renders at its baseline rotation `rotate(0deg)`, and the speedometer displays `0 KM/H`.
2. **First Position Update (Stationary / Idle):**
   - **Simulation:** Emit geolocation position with `speed: 0`, `heading: 0`.
   - **Observation:** Speed displays `0`, arrow remains at `rotate(0deg)`.
3. **Second Position Update (Eastbound Motion):**
   - **Simulation:** Emit geolocation coordinate update with `speed: 45` km/h and `heading: 90` degrees.
   - **Observation:** `.speed-value` text updates to `45`, and `.arrow` style transforms to `rotate(90deg)`.
4. **Third Position Update (Southbound High Speed):**
   - **Simulation:** Emit coordinate update with `speed: 120` km/h and `heading: 180` degrees.
   - **Observation:** `.speed-value` updates to `120`, and `.arrow` rotates to `rotate(180deg)`.

All updates are executed and asserted via automated Playwright checks with stubbed geolocation coordinates to guarantee reproducible, deterministic test runs without requiring mobile hardware sensors.
