# R57-T049 evidence

## Baseline

`15 - LocalStorage/index-START.html` is a static exercise starter with an item-name field and submit control. It contains no animation or transition. Its stylesheet sets `outline: 0` on both form inputs, so keyboard focus is not visible. The test captures the baseline at 1280x800 and 320x700 while emulating reduced motion.

## Changed behavior

The page remains static and all information and controls remain available with reduced motion enabled. A `:focus-visible` rule adds a 3px dark outline and yellow outer ring to the focused form control. The browser test tabs through the item field and submit button at both widths and checks focus styles, visibility, enabled state, layout bounds, and horizontal overflow.

## Run and evidence

Run `node tests/course/r57-t049.mjs` from the repository root. `results.json` records inputs, expected and actual values, browser errors, tool versions, and cleanup status. `baseline.png`, `desktop-reduced-motion-focus.png`, and `narrow-reduced-motion-focus.png` are review screenshots supporting the DOM and computed-style assertions.
