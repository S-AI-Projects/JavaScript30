import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../../29 - Countdown Timer/', import.meta.url)));
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidenceDir = resolve(repoRoot, 'work/R57-T041');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const browserErrors = [];
const observed = {};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    assert.ok(file.startsWith(root + sep) || file === root, 'request must stay inside the example directory');
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

let browser;
let outcome = 'failed';
try {
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.route(/^https:\/\//, route => {
    const isIcon = new URL(route.request().url()).hostname === 'fav.farm';
    return route.fulfill({
      status: 200,
      contentType: isIcon ? 'image/png' : 'text/css',
      body: isIcon ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64') : ''
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  await mkdir(evidenceDir, { recursive: true });

  const layout = await page.evaluate(() => {
    const timer = document.querySelector('.timer');
    const display = document.querySelector('.display');
    const timerStyle = getComputedStyle(timer);
    const displayStyle = getComputedStyle(display);
    return {
      timerDisplay: timerStyle.display,
      timerFlexDirection: timerStyle.flexDirection,
      timerMinHeight: timerStyle.minHeight,
      displayDisplay: displayStyle.display,
      displayFlexGrow: displayStyle.flexGrow,
      displayBounds: display.getBoundingClientRect().toJSON()
    };
  });
  assert.equal(layout.timerDisplay, 'flex', 'timer keeps its flex layout');
  assert.equal(layout.timerFlexDirection, 'column', 'timer keeps its column layout');
  assert.equal(layout.timerMinHeight, '720px', 'timer keeps its full-viewport minimum height');
  assert.equal(layout.displayDisplay, 'flex', 'timer display keeps its flex layout');
  assert.equal(layout.displayFlexGrow, '1', 'timer display keeps filling remaining space');
  assert.deepEqual(layout.displayBounds, { x: 0, y: 55, width: 1280, height: 665, top: 55, right: 1280, bottom: 720, left: 0 }, 'timer display retains baseline geometry');

  const buttons = page.getByRole('button');
  assert.equal(await buttons.count(), 5, 'all five preset buttons are rendered');
  assert.equal(await page.locator('#custom').evaluate(el => el.tagName), 'FORM', '#custom is the custom minutes form');
  assert.equal(await page.getByRole('form', { name: 'Custom countdown' }).count(), 1, '#custom form has an accessible name');
  assert.equal(await page.getByRole('main').count(), 1, 'timer display is exposed as the main landmark');
  assert.equal(await page.getByRole('textbox', { name: 'Minutes for custom countdown' }).count(), 1, 'custom minutes field has an accessible name');
  assert.equal(await page.getByRole('textbox', { name: 'Minutes for custom countdown' }).evaluate(el => el.form?.id), 'custom', 'named minutes field belongs to #custom');
  observed.customFormAccessibleName = await page.locator('#custom').getAttribute('aria-label');
  observed.customInputAccessibleName = await page.locator('#custom input').getAttribute('aria-label');

  const skip = page.getByRole('link', { name: 'Skip to countdown timer' });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link', 'first Tab reaches the skip link');
  const skipFocus = await skip.evaluate(element => ({
    transform: getComputedStyle(element).transform,
    bounds: element.getBoundingClientRect().toJSON()
  }));
  assert.equal(skipFocus.transform, 'matrix(1, 0, 0, 1, 0, 0)', 'skip link moves into view on focus');
  assert.ok(skipFocus.bounds.top >= 0 && skipFocus.bounds.bottom > 0, 'focused skip link intersects the viewport');
  await page.screenshot({ path: resolve(evidenceDir, 'changed-skip-link.png') });
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main', 'Enter activates skip link and focuses main content');

  await page.reload({ waitUntil: 'load' });
  const expectedNames = ['Skip to countdown timer', '20 Secs', 'Work 5', 'Quick 15', 'Snack 20', 'Lunch Break', 'Minutes for custom countdown'];
  const actualNames = [];
  const visibleFocus = [];
  for (const expectedName of expectedNames) {
    await page.keyboard.press('Tab');
    const active = page.locator(':focus');
    const actualName = await active.evaluate(element => element.getAttribute('aria-label') || element.textContent.trim());
    actualNames.push(actualName);
    assert.equal(actualName, expectedName, `Tab order reaches ${expectedName}`);
    visibleFocus.push(await active.evaluate(element => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return { tag: element.tagName, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, background: style.backgroundColor, inViewport: bounds.width > 0 && bounds.height > 0 };
    }));
    const focus = visibleFocus.at(-1);
    if (expectedName.startsWith('Skip')) assert.ok(focus.inViewport, 'skip link is visible in keyboard tab order');
    else if (expectedName.startsWith('Minutes')) {
      assert.notEqual(focus.outlineStyle, 'none', 'custom input retains a visible native focus indicator');
      assert.notEqual(focus.outlineWidth, '0px', 'custom input focus indicator has nonzero width');
    } else {
      assert.equal(focus.background, 'rgba(0, 0, 0, 0.2)', `focused ${expectedName} uses the demonstrated focus background`);
    }
  }
  assert.equal(await page.locator('[tabindex]').evaluateAll(elements => elements.some(element => element.tabIndex > 0)), false, 'no positive tabindex is present');

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => {
    window.__keyboardEffects = [];
    document.querySelectorAll('.timer__button').forEach((button, index) => button.addEventListener('click', () => window.__keyboardEffects.push(`button:${index}`)));
    document.querySelector('#custom').addEventListener('submit', event => { event.preventDefault(); window.__keyboardEffects.push('custom:submit'); });
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '20 Secs', 'activation begins at the first preset button');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Work 5', 'Tab reaches the second preset button');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Minutes for custom countdown', 'Tab reaches custom minutes before form activation');
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  observed.keyboardEffects = await page.evaluate(() => window.__keyboardEffects);
  assert.deepEqual(observed.keyboardEffects, ['button:0', 'button:1', 'custom:submit'], 'Enter and Space activate preset buttons and Enter submits custom minutes');
  assert.deepEqual(browserErrors, [], 'no unexpected page errors or console errors');

  observed.tabOrder = actualNames;
  observed.visibleFocus = visibleFocus;
  observed.skipTarget = '#main';
  observed.layout = layout;
  observed.browserErrors = browserErrors;
  outcome = 'passed';
  console.log('PASS: skip link, Tab order, visible focus, keyboard activation, and clean page errors');
} catch (error) {
  observed.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
  await mkdir(evidenceDir, { recursive: true });
  const playwrightPackage = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  const chromiumVersion = browser ? browser.version() : 'not launched';
  await writeFile(resolve(evidenceDir, 'changed.json'), JSON.stringify({
    outcome,
    node: process.version,
    playwright: playwrightPackage.devDependencies.playwright,
    chromium: chromiumVersion,
    assertionsExpected: [
      'skip link is first in Tab order, becomes visible, and Enter focuses main content',
      'custom form and input have accessible names; all preset buttons and the input are reachable in DOM order',
      'button and input focus are visible; no positive tabindex exists',
      'Enter and Space dispatch button click events and Enter dispatches form submit',
      'no unexpected page or console errors'
    ],
    actual: observed
  }, null, 2) + '\n');
}
