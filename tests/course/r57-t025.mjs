import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'work/R57-T025';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const expectedText = '×BREAK×DOWN×';

  async function runCheck(contextNumber) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 }
    });

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
      'http://127.0.0.1:8000/09%20-%20Dev%20Tools%20Domination/index-START.html',
      { waitUntil: 'networkidle' }
    );

    const paragraph = page.locator('p');

    assert.equal(await paragraph.textContent(), expectedText);
    assert.equal(
      await paragraph.evaluate(el => getComputedStyle(el).fontSize),
      '16px'
    );

    if (contextNumber === 1) {
      await page.screenshot({
        path: `${evidenceDir}/baseline.png`,
        fullPage: true
      });
    }

    await paragraph.click();

    assert.equal(
      await paragraph.evaluate(el => getComputedStyle(el).color),
      'rgb(186, 218, 85)'
    );

    assert.equal(
      await paragraph.evaluate(el => getComputedStyle(el).fontSize),
      '50px'
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

    await page.close();
  }

  await runCheck(1);
  await runCheck(2);

  console.log('Context 1: PASS — expected DOM and click behavior verified.');
  console.log('Context 2: PASS — same DOM and click behavior verified.');
  console.log('External favicon: PASS — replaced with local fixture.');
  console.log('Page errors: PASS — no unexpected errors.');
  console.log('R57-T025 regression checks passed.');
} finally {
  await browser.close();
}