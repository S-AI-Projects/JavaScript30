# 10 - Hold Shift and Check Checkboxes

An interactive inbox checklist demonstrating Shift + click multi-checkbox selection in vanilla JavaScript.

## Deterministic Browser Fixtures (R57-T034)

- **Deterministic Multi-Selection**: Clicking any checkbox, holding `Shift`, and clicking another checkbox selects all checkboxes in between deterministically in both forward and reverse directions.
- **Offline / Local Fixtures**: External network requests (e.g. `fav.farm` icon) are intercepted and mocked with local static fixtures in automated tests, removing any dependency on external services.
- **Cross-Context Determinism**: Two fresh, independent browser contexts executing the identical sequence produce identical DOM checked states.

## Running and Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Regression Test
```bash
node tests/course/r57-t034.mjs
```
