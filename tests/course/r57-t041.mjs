import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pageDirectory = join(root, '29 - Countdown Timer');
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
    if (relative.startsWith('..')) throw new Error('Invalid path');
    const body = await readFile(join(pageDirectory, relative));
    response.writeHead(200, { 'content-type': `${mimeTypes[extname(relative)] ?? 'application/octet-stream'}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await page.addInitScript(() => {
    window.keyboardActivations = [];
    document.addEventListener('click', event => {
      if (event.isTrusted && event.target.matches('.timer__button')) {
        window.keyboardActivations.push(`button:${event.target.dataset.time}`);
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'custom') {
        event.preventDefault();
        window.keyboardActivations.push('custom-form');
      }
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to countdown timer' });
  assert.equal(await skip.evaluate(element => element === document.activeElement), true, 'Skip link is first in Tab order');
  const skipStyle = await skip.evaluate(element => ({
    focusVisible: getComputedStyle(element).transform === 'matrix(1, 0, 0, 1, 0, 0)',
    positiveTabindex: element.tabIndex > 0,
  }));
  assert.equal(skipStyle.focusVisible, true, 'Skip link becomes visible when focused');
  assert.equal(skipStyle.positiveTabindex, false, 'Skip link has no positive tabindex');
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#main', 'Enter activates skip link');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main', 'Skip link moves focus to main content');

  // Restart at the document start so the subsequent assertions measure natural Tab order.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const buttons = page.locator('.timer__button');
  assert.equal(await buttons.count(), 5, 'All five preset buttons render');
  for (let index = 0; index < 5; index += 1) {
    const button = buttons.nth(index);
    assert.equal(await button.evaluate(element => element === document.activeElement), true, `Preset ${index + 1} is reachable in order`);
    const focus = await button.evaluate(element => ({
      outline: getComputedStyle(element).outlineStyle,
      background: getComputedStyle(element).backgroundColor,
      positiveTabindex: element.tabIndex > 0,
    }));
    assert.equal(focus.outline !== 'none' || focus.background !== 'rgba(0, 0, 0, 0.1)', true, `Preset ${index + 1} has visible focus`);
    assert.equal(focus.positiveTabindex, false, `Preset ${index + 1} has no positive tabindex`);
    if (index === 0) {
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => window.keyboardActivations), ['button:20'], 'Enter activates the first preset button');
    }
    await page.keyboard.press('Tab');
  }

  const input = page.locator('#custom input[name="minutes"]');
  assert.equal(await input.evaluate(element => element === document.activeElement), true, 'Custom minutes field follows preset buttons in Tab order');
  const inputFocus = await input.evaluate(element => ({
    outline: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
    positiveTabindex: element.tabIndex > 0,
  }));
  assert.equal(inputFocus.outline !== 'none' && inputFocus.outlineWidth !== '0px', true, 'Custom minutes field has visible focus');
  assert.equal(inputFocus.positiveTabindex, false, 'Custom minutes field has no positive tabindex');
  await input.fill('2');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.keyboardActivations), ['button:20', 'custom-form'], 'Enter submits the custom form');
  assert.deepEqual(pageErrors, [], 'No unexpected page errors');
  await context.close();
  console.log('PASS: skip link, Tab order, visible focus, preset activation, custom submission, and page errors');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
