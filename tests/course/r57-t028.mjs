import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const evidenceDir = 'work/R57-T028';
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  async function runCheck(viewport, reducedMotion) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
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
      'http://127.0.0.1:8000/08%20-%20Fun%20with%20HTML5%20Canvas/index-START.html',
      { waitUntil: 'networkidle' }
    );

    const canvas = page.locator('#draw');

    assert.equal(await canvas.count(), 1);
    assert.equal(await canvas.getAttribute('tabindex'), '0');
    assert.equal(
      await canvas.getAttribute('aria-label'),
      'HTML5 Canvas drawing area'
    );

    assert.equal(
      await canvas.evaluate(el => `${el.width}x${el.height}`),
      '800x800'
    );

    await canvas.focus();

    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'draw'
    );

    assert.notEqual(
      await canvas.evaluate(el => getComputedStyle(el).outlineStyle),
      'none'
    );

    assert.equal(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches
      ),
      reducedMotion
    );

    assert.equal(pageErrors.length, 0);

    await page.screenshot({
      path: `${evidenceDir}/${reducedMotion ? 'reduced-motion' : 'normal-motion'}-${viewport.width}.png`,
      fullPage: true
    });

    await context.close();
  }

  await runCheck({ width: 1280, height: 800 }, false);
  await runCheck({ width: 1280, height: 800 }, true);
  await runCheck({ width: 375, height: 800 }, true);

  console.log('Normal preference: PASS — static canvas remains usable.');
  console.log('Reduced motion: PASS — canvas remains usable.');
  console.log('Keyboard focus: PASS — canvas receives focus and has a visible indicator.');
  console.log('Responsive widths: PASS — 1280px and 375px checks passed.');
  console.log('Page errors: PASS — no unexpected errors.');
  console.log('R57-T028 regression checks passed.');
} finally {
  await browser.close();
}
