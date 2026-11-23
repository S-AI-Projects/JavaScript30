# R57-T047 evidence

The assignment entry point is `03 - CSS Variables/index-START.html`. Baseline inspection confirms it renders the three requested controls but intentionally has no CSS-variable declarations or update handlers. The finished page is the executable reference for the documented walkthrough.

The browser regression records the starter state and finished page's initial state, then changes spacing to 50, blur to 4, and base to `#336699`. It asserts the variables, image padding/filter/background, heading highlight color, and image rendering. `results.json` records inputs, expected and actual values, errors, tool versions, and cleanup status. The screenshots show the starter and the finished page after the interaction.

Run `node tests/course/r57-t047.mjs` from the repository root. The page server is started on an ephemeral local port and browser requests use the checked-in SVG and CSS fixtures.
