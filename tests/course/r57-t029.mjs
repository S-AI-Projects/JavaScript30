import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:8000/14%20-%20JavaScript%20References%20VS%20Copying/index-START.html';

const testString =
  '[image](https://github.com/S-AI-Projects/JavaScript30/issues/x) <img src=x onerror="window.__r57t029HandlerRan=true">';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 }
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.__r57t029HandlerRan = false;
  });

  await page.locator('#text-input').fill(testString);
  await page.locator('#render-text').click();

  const output = page.locator('#text-output');

  assert.equal(await output.textContent(), testString);
  assert.equal(await output.locator('*').count(), 0);
  assert.equal(await page.locator('#text-output img').count(), 0);
  assert.equal(await page.locator('#text-output a').count(), 0);
  assert.equal(
    await page.evaluate(() => window.__r57t029HandlerRan),
    false
  );

  const box = await output.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0);

  assert.equal(
    errors.length,
    0,
    `Unexpected page errors: ${errors.join('; ')}`
  );

  await page.screenshot({
    path: 'work/R57-T029-rendered-text.png',
    fullPage: true
  });

  console.log('Safe text rendering: PASS');
  console.log('Required [image](...) string preserved as text: PASS');
  console.log('No injected elements: PASS');
  console.log('No handler execution: PASS');
  console.log('Rendered layout: PASS');
  console.log('Page errors: PASS');
  console.log('R57-T029 regression checks passed.');
} finally {
  await context.close();
  await browser.close();
}
