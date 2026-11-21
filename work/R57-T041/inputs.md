# R57-T041 evidence

## Inputs and versions

- Repository page: `29 - Countdown Timer/index.html`, linked `style.css` and `scripts-START.js` from the S-AI-Projects/JavaScript30 base commit `c36f2ed261eacb3e9ad83c05eb2fd3a4f72cc82f`.
- The custom anchor `#custom` identifies a native custom-minutes `<form>` containing a text field.
- Baseline was measured from the unchanged base commit in a fresh Chromium browser context before editing.
- Node.js: `v26.13.0`; npm: `11.20.0`; Playwright: `1.65.1`; Chromium: `159.0.8154.6`.
- The page's remote font and favicon requests were served with local stub responses. No permissions, hardware, or device features are involved.

## Expected checks and results

The regression must verify that the skip link is first and becomes visible, Enter moves focus to the main landmark, Tab reaches all five preset buttons and the named custom input in order, every focused control has a visible indicator, no positive `tabindex` exists, Enter and Space activate buttons, Enter submits the custom form, and there are no unexpected browser errors.

| Behavior | Baseline actual | Changed actual |
| --- | --- | --- |
| Skip link / main landmark | Missing; initial Tab went to “20 Secs” | First Tab reaches visible skip link; Enter focuses `main#main` |
| `#custom` form and minutes input names | Both missing | Form is “Custom countdown”; input is “Minutes for custom countdown” |
| Tab traversal | Reached all five buttons and input in DOM order | Skip link, all five buttons, then named input |
| Visible focus | Button background changed from `rgba(0,0,0,0.1)` to `rgba(0,0,0,0.2)`; text field showed native `auto` outline | Same existing button background and native input outline; focused skip link visible in viewport |
| CSS layout | `.timer` was `flex` / `column`; `.display` was `flex`, grew by `1`, and occupied `(0,55)–(1280,720)` | Same computed values and geometry asserted by the browser check |
| Keyboard activation | Enter/Space dispatched button clicks; Enter dispatched form submit | Same effects observed: `button:0`, `button:1`, `custom:submit` |
| Browser errors | None | None |

Full browser observations are in `baseline.json` and `changed.json`. The checked-in demo's `scripts-START.js` is empty; this regression checks native keyboard actions, not countdown timing.
