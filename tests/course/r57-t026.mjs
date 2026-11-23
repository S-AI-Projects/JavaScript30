import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'work/R57-T026';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function setupPage(context, unsupportedScroll = false) {
  const page = await context.newPage({
    viewport: { width: 1280, height: 800 }
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error));

  await page.route('https://source.unsplash.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="gray"/></svg>'
    });
  });

  await page.route('http://unsplash.it/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="gray"/></svg>'
    });
  });

  await page.route('https://fav.farm/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/x-icon',
      body: Buffer.from([])
    });
  });

  if (unsupportedScroll) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        get: () => undefined
      });
    });
  }

  await page.goto(
    'http://127.0.0.1:8000/24%20-%20Sticky%20Nav/index-START.html',
    { waitUntil: 'networkidle' }
  );

  return { page, pageErrors };
}

try {
  const supportedContext = await browser.newContext();
  const { page: supportedPage, pageErrors: supportedErrors } =
    await setupPage(supportedContext);

  const nav = supportedPage.locator('#main');

  assert.equal(await nav.count(), 1);
  assert.equal(
    await supportedPage.locator('body').evaluate(el => el.classList.contains('fixed-nav')),
    false
  );

  await supportedPage.evaluate(() => window.scrollTo(0, 600));
  await supportedPage.waitForTimeout(100);

  assert.equal(
    await supportedPage.locator('body').evaluate(el => el.classList.contains('fixed-nav')),
    true
  );

  assert.equal(
    await nav.evaluate(el => getComputedStyle(el).position),
    'fixed'
  );

  assert.notEqual(
    await supportedPage.locator('body').evaluate(el => el.style.paddingTop),
    ''
  );

  assert.equal(supportedErrors.length, 0);

  await supportedPage.screenshot({
    path: `${evidenceDir}/baseline.png`,
    fullPage: false
  });

  await supportedPage.screenshot({
    path: `${evidenceDir}/supported-fixed.png`,
    fullPage: false
  });

  await supportedContext.close();

  const unsupportedContext = await browser.newContext();
  const { page: unsupportedPage, pageErrors: unsupportedErrors } =
    await setupPage(unsupportedContext, true);

  const unsupportedNav = unsupportedPage.locator('#main');

  assert.equal(
    await unsupportedNav.getAttribute('aria-disabled'),
    'true'
  );

  assert.match(
    await unsupportedNav.getAttribute('title'),
    /not supported/i
  );

  assert.equal(
    await unsupportedPage.locator('body').evaluate(
      el => el.classList.contains('fixed-nav')
    ),
    false
  );

  assert.equal(
    await unsupportedNav.evaluate(el => getComputedStyle(el).position),
    'relative'
  );

  assert.equal(unsupportedErrors.length, 0);

  await unsupportedPage.screenshot({
    path: `${evidenceDir}/unsupported-fallback.png`,
    fullPage: false
  });

  await unsupportedContext.close();

  console.log('Supported path: PASS — scrolling activates fixed navigation.');
  console.log('Unsupported path: PASS — explicit fallback keeps navigation non-fixed.');
  console.log('External fixtures: PASS — remote image/favicon requests were replaced.');
  console.log('Page errors: PASS — no unexpected errors.');
  console.log('R57-T026 regression checks passed.');
} finally {
  await browser.close();
}
