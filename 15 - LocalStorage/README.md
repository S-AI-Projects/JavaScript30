# 15 - LocalStorage

This project implements a tapas ordering menu with client-side item persistence and completion tracking powered by the `localStorage` API.

## Deterministic Browser Fixtures (R57-T015)

- **Deterministic Context Testing:** Tests inject explicit local storage fixtures (`[{"text":"Fish Tacos","done":true},{"text":"Quesadilla","done":false}]`) into separate fresh browser contexts, ensuring identical DOM structure and state without dependency on preexisting storage or external public services.
- **Offline Self-Sufficiency:** Intercepts external favicon/remote requests with deterministic offline stubs to guarantee tests run reliably and identically in any network condition.
- **Persistence & Form Action:** Verifies that form submissions reliably persist new items, toggle item completion states, and re-populate the rendered list accurately.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t015.mjs
```

The test verifies:
1. HTTP 200 response on page load.
2. Identical rendered list across two independent fresh browser contexts with injected local storage fixtures.
3. Form submission successfully appends items and persists to `localStorage`.
4. Checkbox clicks toggle completion state and persist.
5. Deterministic visual rendering recorded in screenshots.
6. Zero unhandled console/page errors.
