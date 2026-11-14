# 17 - Sort Without Articles

This project demonstrates sorting an array of band names alphabetically while ignoring grammatical articles (*a*, *an*, *the*) and rendering the resulting list into `<ul id="bands">`.

## Accessibility & Keyboard Navigation (R57-T011)

- **Skip-to-Content Link:** A `.skip-link` element (`<a class="skip-link" href="#bands">Skip to content</a>`) is positioned off-screen by default and slides into view upon receiving keyboard focus via the `Tab` key.
- **Focus Indicators:** Interactive elements feature high-contrast visible focus outlines (`outline: 3px solid #000;`).
- **No Positive Tabindex:** Maintains standard DOM tab order with no positive `tabindex` values. The target region `#bands` has `tabindex="-1"` to allow focus transfer upon activation.

## Running Tests

Automated regression checks use Playwright:

```bash
# Install dependencies (from repository root)
npm install

# Run the task test
node tests/course/r57-t011.mjs
```

The check verifies:
1. HTTP 200 response on page load.
2. Presence and off-screen initial state of the skip link.
3. Keyboard navigation via `Tab` focusing the skip link.
4. Visible focus indicator when focused.
5. `Enter` activation navigating directly to `#bands`.
6. Sorted rendering of all 13 band items.
7. Absence of positive `tabindex` attributes and unhandled JavaScript errors.
