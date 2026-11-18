# Countdown Timer User Walkthrough

## Prerequisites
- A modern web browser supporting ES6 and standard DOM events (Google Chrome, Firefox, Safari, or Microsoft Edge).
- A local HTTP server (e.g. `npx http-server . -p 8080`).

## Step-by-Step Reproduction
1. Start the local HTTP server in the repository root:
   ```bash
   npx http-server . -p 8080
   ```
2. Navigate to `http://127.0.0.1:8080/29%20-%20Countdown%20Timer/index.html`.
3. Locate the preset timer controls located in the top bar:
   - "20 Secs" (`data-time="20"`)
   - "Work 5" (`data-time="300"`)
   - "Quick 15" (`data-time="900"`)
   - "Snack 20" (`data-time="1200"`)
   - "Lunch 20" (`data-time="1200"`)
4. Click on any of the preset timer buttons (for instance, "20 Secs").
5. Alternatively, locate the custom minutes form input (`<form name="customForm">`), enter a numeric value (e.g. `10`), and press Enter.

## Expected Results
- **Remaining Time Display**: The central `.display__time-left` text updates immediately with the formatted time remaining (`MM:SS`) and decrements second by second.
- **Document Title**: The browser page title is updated with the active remaining countdown time.
- **End Time Notice**: The bottom `.display__end-time` element displays "Be Back At <time>" indicating the wall-clock time at which the timer will expire.
- **Reset on New Input**: Clicking a different preset button or entering a new minute value immediately clears any previous timer interval and starts the new countdown cleanly.
