import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'work/R57-T027';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error);
  });

  await page.route('https://fav.farm/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/x-icon',
      body: Buffer.from([])
    });
  });

  await page.goto(
    'http://127.0.0.1:8000/18%20-%20Adding%20Up%20Times%20with%20Reduce/index-START.html',
    { waitUntil: 'networkidle' }
  );

  const main = page.locator('main');
  const videoRows = page.locator('[data-time]');
  const totalTime = page.locator('#total-time');

  assert.equal(await main.count(), 1);
  assert.equal(await videoRows.count(), 58);

  assert.equal(
    await totalTime.textContent(),
    'Total time: 4 hours, 58 minutes, 58 seconds'
  );

  const box = await totalTime.boundingBox();

  assert.ok(
    box && box.width > 0 && box.height > 0,
    'The total-time result must be visibly rendered.'
  );

  assert.equal(
    await page.locator('body').evaluate(
      element => element.innerText.includes('Total time: 4 hours, 58 minutes, 58 seconds')
    ),
    true
  );

  assert.equal(
    pageErrors.length,
    0,
    'The browser must not report unexpected page errors.'
  );

  await page.screenshot({
    path: `${evidenceDir}/changed.png`,
    fullPage: true
  });

  await context.close();

  console.log('Main region: PASS — rendered content is inside <main>.');
  console.log('Video rows: PASS — 58 data-time entries found.');
  console.log('Total time: PASS — 4 hours, 58 minutes, 58 seconds.');
  console.log('Layout: PASS — total-time result is visibly rendered.');
  console.log('Page errors: PASS — no unexpected errors.');
  console.log('R57-T027 regression checks passed.');
} finally {
  await browser.close();
}
