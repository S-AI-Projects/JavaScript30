# 12 - Key Sequence Detection

This project listens for user keyboard sequences to trigger a celebration upon typing the secret Konami-style code (`"wesbos"`).

## Empty & Error States (R57-T013)

- **Meaningful Empty State:** Displays an initial prompt (`Awaiting input... (Type secret code)`) and visual key slot indicators showing current progress towards the required sequence length.
- **Graceful Asset Failure Fallback:** If `cornify.js` fails to load (due to network or 404), an informative notification banner is displayed (`Celebration script failed to load. Fallback visual effect enabled! ✨`) and visual fallback feedback triggers without uncaught JavaScript exceptions.
- **Input Recovery:** Typing subsequent keys updates the buffer and transitions status back into active tracking or celebration cleanly.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t013.mjs
```

The test verifies:
1. HTTP 200 response on page load.
2. Initial empty state message and key slot buffer display.
3. Successful key tracking and sequence buffer updates.
4. Correct celebration trigger upon typing `"wesbos"`.
5. Asset failure fixture (intercepted/failed `cornify.js`), verifying graceful fallback message and no uncaught exceptions.
6. Recovery behavior after valid input.
