import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  const unexpectedErrors = [];

  page.on('pageerror', (error) => {
    unexpectedErrors.push(error);
  });

  await page.goto(
  'http://127.0.0.1:8000/26%20-%20Stripe%20Follow%20Along%20Nav/index-START.html'
);

  await page.waitForLoadState('domcontentloaded');

  // The three main navigation links must exist.
  const links = page.locator('nav.top > ul.cool > li > a');

  assert.equal(
    await links.count(),
    3,
    'Expected exactly 3 main navigation links'
  );

  // Every main navigation link must be keyboard focusable
  // and have a visible focus outline.
 // Test actual Tab traversal.
// The skip link should be the first keyboard stop,
// followed by the three main navigation links.
const expectedTabStops = [
  'Skip to content',
  'About Me',
  'Courses',
  'Other Links',
];

for (const expectedText of expectedTabStops) {
  await page.keyboard.press('Tab');

  const focused = await page.evaluate(() => {
    const element = document.activeElement;

    return {
      tag: element?.tagName,
      text: element?.textContent?.trim(),
      outlineStyle: getComputedStyle(element).outlineStyle,
      outlineWidth: getComputedStyle(element).outlineWidth,
    };
  });

  assert.equal(
    focused.tag,
    'A',
    'Tab should move focus to a link'
  );

  assert.equal(
    focused.text,
    expectedText,
    'Tab should reach the expected control in order'
  );

  assert.notEqual(
    focused.outlineStyle,
    'none',
    'Focused link should have a visible outline'
  );

  assert.notEqual(
    focused.outlineWidth,
    '0px',
    'Focused link should have a visible outline'
  );
}

  // No positive tabindex values should be present.
  const positiveTabindex = await page.locator('[tabindex]').evaluateAll(
    (elements) =>
      elements
        .map((element) => Number(element.getAttribute('tabindex')))
        .filter((value) => value > 0)
  );

  assert.deepEqual(
    positiveTabindex,
    [],
    'No positive tabindex values should be present'
  );

  // The skip-to-content link must exist.
  const skipLink = page.locator('.skip-link');

  assert.equal(
    await skipLink.count(),
    1,
    'Expected exactly one skip-to-content link'
  );

  // The skip link must point to the main content target.
  assert.equal(
    await skipLink.getAttribute('href'),
    '#main-content',
    'Skip link should point to #main-content'
  );

  // The target must exist and be programmatically focusable.
  const mainContent = page.locator('#main-content');

  assert.equal(
    await mainContent.count(),
    1,
    'Expected exactly one #main-content target'
  );

  assert.equal(
    await mainContent.getAttribute('tabindex'),
    '-1',
    '#main-content should use tabindex="-1"'
  );

  // The skip link must be reachable by keyboard.
  await skipLink.focus();

  assert.equal(
    await page.evaluate(() => document.activeElement?.className),
    'skip-link',
    'Skip link should receive keyboard focus'
  );

  // Keyboard activation must update the URL fragment to the target.
  await page.keyboard.press('Enter');

  assert.equal(
    new URL(page.url()).hash,
    '#main-content',
    'Activating the skip link should navigate to #main-content'
  );

  assert.equal(
    unexpectedErrors.length,
    0,
    'The page must not produce unexpected JavaScript errors'
  );

  console.log('Task R57-T021 keyboard accessibility checks passed.');
} finally {
  await browser.close();
}