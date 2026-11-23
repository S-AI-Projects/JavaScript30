# R57-T023 Evidence

## Test command

`node tests/course/r57-t023.mjs`

## Baseline behavior

- Input: `index-START.html`
- Expected: the matching comment is displayed.
- Actual: `Found comment: Super good`
- Result: PASS
- Evidence: `baseline-valid.png`

## Empty-result fixture

- Input: `index-START.html?fixture=empty`
- Expected: a meaningful fallback is displayed.
- Actual: `No matching comment found.`
- Result: PASS
- Evidence: `changed-empty.png`

## Recovery behavior

- Expected: the matching comment is displayed again after restoring the normal fixture.
- Actual: `Found comment: Super good`
- Result: PASS

## Error handling

- Unexpected page errors: none.
- Assertion failures cause the Node.js check to exit non-zero.

## Test output

Normal fixture: PASS — matching comment rendered.
Empty fixture: PASS — fallback message rendered.
Page errors: PASS — no unexpected errors.
Recovery: PASS — valid comment rendered after restoring the normal fixture.
R57-T023 regression checks passed.

## Tool versions

See `tool-versions.txt`.
