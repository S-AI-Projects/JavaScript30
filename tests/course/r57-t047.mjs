import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const example = '03 - CSS Variables';
const startPath = `${example}/index-START.html`;
const finishedPath = `${example}/index-FINISHED.html`;
const fromHead = file => execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
const makeFixtureHtml = html => html
  .replace('https://unsplash.it/800/500?image', '/fixtures/css-variables-image.svg')
  .replace(/https:\/\/fav\.farm\/[^"']+/, '/fixtures/css-variables-image.svg');
const baselineStart = makeFixtureHtml(fromHead(startPath));
const baselineFinished = makeFixtureHtml(fromHead(finishedPath));
const fixtureImage = await readFile(path.join(root, 'tests/course/fixtures/css-variables-image.svg'));
const fixtureCss = await readFile(path.join(root, 'tests/course/fixtures/deterministic.css'), 'utf8');
const results = {
  inputs: {
    starterEntry: startPath,
    completedReference: finishedPath,
    viewport: '1280x1000',
    deviceScaleFactor: 1,
    imageFixture: 'tests/course/fixtures/css-variables-image.svg',
    fontFixture: 'tests/course/fixtures/deterministic.css'
  },
  expected: {
    controls: ['spacing', 'blur', 'base'],
    starterHasNoVariableUpdates: true,
    interaction: { spacing: '50px', blur: '4px', base: '#336699', imagePadding: '50px', imageFilter: 'blur(4px)', headingHighlight: 'rgb(51, 102, 153)' },
    pageErrors: [],
    consoleErrors: []
  },
  baseline: {},
  actual: {},
  tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(root, 'node_modules/playwright/package.json'), 'utf8')).version }
};
await mkdir(path.join(root, 'work/R57-T047'), { recursive: true });
let server;
let browser;
let context;
let page;

const errors = { page: [], console: [] };
function watch(pageToWatch) {
  pageToWatch.on('pageerror', error => errors.page.push(error.message));
  pageToWatch.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
}

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const pages = {
      '/index-START.html': baselineStart,
      '/index-FINISHED.html': baselineFinished
    };
    if (pathname in pages) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(pages[pathname]);
    } else if (pathname === '/fixtures/css-variables-image.svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' });
      response.end(fixtureImage);
    } else {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  results.tools.chromium = browser.version();
  context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });

  page = await context.newPage();
  watch(page);
  const starterResponse = await page.goto(`${origin}/index-START.html`, { waitUntil: 'load' });
  assert.equal(starterResponse.status(), 200, 'starter page loads from the local server');
  await page.addStyleTag({ content: fixtureCss });
  await page.locator('img').evaluate(image => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth) return resolve();
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', reject, { once: true });
  }));
  const starterControls = page.locator('.controls input');
  assert.equal(await starterControls.count(), 3, 'starter has all three labeled controls');
  const controls = await starterControls.evaluateAll(inputs => inputs.map(input => ({ id: input.id, value: input.value, type: input.type })));
  assert.deepEqual(controls.map(control => control.id), results.expected.controls);
  results.baseline.starter = await page.evaluate(() => ({
    controls: [...document.querySelectorAll('.controls input')].map(input => ({ id: input.id, value: input.value })),
    variables: Object.fromEntries(['--spacing', '--blur', '--base'].map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])),
    image: { loaded: document.querySelector('img').naturalWidth > 0, padding: getComputedStyle(document.querySelector('img')).padding, filter: getComputedStyle(document.querySelector('img')).filter },
    highlightText: getComputedStyle(document.querySelector('.hl')).color
  }));
  assert.deepEqual(results.baseline.starter.variables, { '--spacing': '', '--blur': '', '--base': '' }, 'starter intentionally has no CSS-variable implementation');
  await page.locator('#spacing').evaluate(input => { input.value = '50'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  results.actual.starterAfterSpacingChange = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spacing').trim());
  assert.equal(results.actual.starterAfterSpacingChange, '', 'starter controls are an exercise and do not update variables yet');
  await page.screenshot({ path: path.join(root, 'work/R57-T047/starter.png'), fullPage: true });

  await page.goto(`${origin}/index-FINISHED.html`, { waitUntil: 'load' });
  await page.addStyleTag({ content: fixtureCss });
  await page.locator('img').evaluate(image => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth) return resolve();
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', reject, { once: true });
  }));
  const finishedInitial = await page.evaluate(() => ({
    controls: [...document.querySelectorAll('.controls input')].map(input => ({ id: input.id, value: input.value })),
    variables: Object.fromEntries(['--spacing', '--blur', '--base'].map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])),
    image: { loaded: document.querySelector('img').naturalWidth > 0, padding: getComputedStyle(document.querySelector('img')).padding, background: getComputedStyle(document.querySelector('img')).backgroundColor, filter: getComputedStyle(document.querySelector('img')).filter },
    highlightText: getComputedStyle(document.querySelector('.hl')).color,
    viewport: { width: innerWidth, height: innerHeight },
    fontFamily: getComputedStyle(document.body).fontFamily
  }));
  results.baseline.finished = finishedInitial;
  await page.locator('#spacing').evaluate(input => { input.value = '50'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#blur').evaluate(input => { input.value = '4'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#base').evaluate(input => { input.value = '#336699'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  results.actual.finished = await page.evaluate(() => ({
    variables: Object.fromEntries(['--spacing', '--blur', '--base'].map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])),
    image: { padding: getComputedStyle(document.querySelector('img')).padding, background: getComputedStyle(document.querySelector('img')).backgroundColor, filter: getComputedStyle(document.querySelector('img')).filter },
    highlightText: getComputedStyle(document.querySelector('.hl')).color,
    imageLoaded: document.querySelector('img').naturalWidth > 0
  }));
  assert.deepEqual(results.actual.finished.variables, { '--spacing': '50px', '--blur': '4px', '--base': '#336699' });
  assert.equal(results.actual.finished.image.padding, results.expected.interaction.imagePadding, 'spacing control updates image padding');
  assert.equal(results.actual.finished.image.filter, results.expected.interaction.imageFilter, 'blur control updates image filter');
  assert.equal(results.actual.finished.image.background, 'rgb(51, 102, 153)', 'base color control updates image background');
  assert.equal(results.actual.finished.highlightText, results.expected.interaction.headingHighlight, 'base color also updates the heading highlight');
  assert.equal(results.actual.finished.imageLoaded, true, 'local image fixture is rendered');
  await page.screenshot({ path: path.join(root, 'work/R57-T047/finished-after-interaction.png'), fullPage: true });
  assert.deepEqual(errors.page, [], 'no uncaught page errors');
  assert.deepEqual(errors.console, [], 'no browser console errors');
  results.actual.errors = errors;
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.error = error?.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {};
  if (context) await context.close();
  cleanup.contextClosed = !context || context.pages().every(openPage => openPage.isClosed());
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  results.cleanup = cleanup;
  const evidenceDir = path.join(root, 'work/R57-T047');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
}
