# R57-T030 Test Results

## Baseline

Before the source fix:

- Start button text: `Start!`
- Initial score: `0`
- Moles visible before Start: `0`
- Moles visible after Start: `0`
- Page error: `startGame is not defined`

The baseline showed that the Start button was present but its intended interaction was missing.

## Corrected behavior

After restoring the intended game interaction:

- Moles visible after Start: `1`
- Initial score: `0`
- Page errors: `0`

Result: **PASS**

## Deliberate temporary fixture mutation

The test temporarily removed the button's `onClick="startGame()"` binding without modifying the actual source file.

Expected broken behavior:

- Moles visible after Start: `0`
- Page errors: `0`

Result: **PASS**

The regression check therefore distinguishes the correct event binding from the deliberately broken binding.

## Automated command

```text
node tests/course/r57-t030.mjs
