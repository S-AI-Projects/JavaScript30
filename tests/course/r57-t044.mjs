import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const exampleDir = path.join(repoRoot, '11 - Custom Video Player');
const pagePath = '11 - Custom Video Player/index.html';
const sourceHtml = await readFile(path.join(exampleDir, 'index.html'), 'utf8');
const sourceScript = await readFile(path.join(exampleDir, 'scripts.js'), 'utf8');
const sourceCss = await readFile(path.join(exampleDir, 'style.css'), 'utf8');
const baselineHtml = execFileSync('git', ['show', `HEAD:${pagePath}`], { cwd: repoRoot, encoding: 'utf8' });
const baselineScript = execFileSync('git', ['show', 'HEAD:11 - Custom Video Player/scripts.js'], { cwd: repoRoot, encoding: 'utf8' });
const checks = {
  inputs: { page: pagePath, media: 'stubbed HTMLMediaElement API', repeatedInitialization: 'load scripts.js twice', repeatedInteractions: 'play button twice; video twice; skip twice; each slider twice; progress scrub' },
  expected: { baselinePlayCalls: 0, baselineSkipWrites: 0, initializedAfterDuplicateLoad: true, listenerCountUnchangedAfterDuplicateLoad: true, playerActionListeners: 15, playCalls: 2, pauseCalls: 2, skipWrites: 2, volumeWrites: 2, playbackRateWrites: 2, progressFlexBasis: '75%', generatedNodeCountUnchanged: true, activeTimers: 0, pageErrors: [] },
  baseline: {}, actual: {}, tools: { node: process.version, playwright: JSON.parse(await readFile(path.join(repoRoot, 'node_modules/playwright/package.json'), 'utf8')).version }
};

const mediaStub = `
  window.__mediaStats = { playCalls: 0, pauseCalls: 0, seekWrites: 0, volumeWrites: 0, playbackRateWrites: 0 };
  window.__registeredPlayerListeners = [];
  window.__activePlayerTimers = new Set();
  const targetSelector = '.viewer, .progress, .toggle, [data-skip], .player__slider';
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const isPlayerWindowHandler = this === window && type === 'mouseup' && typeof listener === 'function' && listener.toString().includes('isScrubbing = false');
    if ((this instanceof Element && this.matches(targetSelector)) || isPlayerWindowHandler) {
      const target = this === window ? 'window' : this.matches('.viewer') ? 'video' : this.matches('.progress') ? 'progress' : this.matches('.toggle') ? 'toggle' : this.matches('[data-skip]') ? 'skip-' + [...document.querySelectorAll('[data-skip]')].indexOf(this) : 'slider-' + [...document.querySelectorAll('.player__slider')].indexOf(this);
      window.__registeredPlayerListeners.push({ target, type });
    }
    return add.call(this, type, listener, options);
  };
  const originalTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);
  window.setTimeout = (callback, wait, ...args) => {
    let timer;
    timer = originalTimeout(() => { window.__activePlayerTimers.delete(timer); callback(...args); }, wait);
    window.__activePlayerTimers.add(timer);
    return timer;
  };
  window.clearTimeout = timer => { window.__activePlayerTimers.delete(timer); return originalClearTimeout(timer); };
  const originalInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  window.setInterval = (callback, wait, ...args) => {
    const timer = originalInterval(callback, wait, ...args);
    window.__activePlayerTimers.add(timer);
    return timer;
  };
  window.clearInterval = timer => { window.__activePlayerTimers.delete(timer); return originalClearInterval(timer); };
  Object.defineProperties(HTMLMediaElement.prototype, {
    paused: { configurable: true, get() { return this.__mockPaused ?? true; } },
    duration: { configurable: true, get() { return 120; } },
    currentTime: { configurable: true, get() { return this.__mockTime ?? 0; }, set(value) { this.__mockTime = Number(value); window.__mediaStats.seekWrites++; } },
    volume: { configurable: true, get() { return this.__mockVolume ?? 1; }, set(value) { this.__mockVolume = Number(value); window.__mediaStats.volumeWrites++; } },
    playbackRate: { configurable: true, get() { return this.__mockRate ?? 1; }, set(value) { this.__mockRate = Number(value); window.__mediaStats.playbackRateWrites++; } }
  });
  HTMLMediaElement.prototype.play = function() {
    window.__mediaStats.playCalls++;
    this.__mockPaused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function() {
    window.__mediaStats.pauseCalls++;
    this.__mockPaused = true;
    this.dispatchEvent(new Event('pause'));
  };
`;

let server;
let browser;
let baselineContext;
let changedContext;
let changedPage;
try {
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const prefix = '/11 - Custom Video Player/';
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const name = pathname.slice(prefix.length);
    if (name === '652333414.mp4') {
      response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Media is stubbed in this regression'); return;
    }
    if (name === 'scripts-baseline.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); response.end(baselineScript); return;
    }
    const contents = name === 'index.html' ? sourceHtml : name === 'scripts.js' ? sourceScript : name === 'style.css' ? sourceCss : null;
    if (contents === null) { response.writeHead(404); response.end('Not found'); return; }
    const type = name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'text/html';
    response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
    response.end(contents);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const exampleURL = `${baseURL}/11%20-%20Custom%20Video%20Player/`;

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  checks.tools.chromium = browser.version();

  baselineContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await baselineContext.addInitScript(mediaStub);
  const baselinePage = await baselineContext.newPage();
  const baselineErrors = [];
  baselinePage.on('pageerror', error => baselineErrors.push(error.message));
  const baselineDocument = baselineHtml
    .replace('<head>', `<head><base href="${exampleURL}">`)
    .replace('src="scripts.js"', 'src="scripts-baseline.js"');
  await baselinePage.setContent(baselineDocument, { waitUntil: 'load' });
  await baselinePage.locator('.toggle').click();
  await baselinePage.locator('[data-skip="-10"]').click();
  checks.baseline = await baselinePage.evaluate(() => ({
    paused: document.querySelector('.viewer').paused,
    playCalls: window.__mediaStats.playCalls,
    skipWrites: window.__mediaStats.seekWrites,
    eventHandlers: window.__registeredPlayerListeners.length,
    controlNodes: document.querySelectorAll('.player__controls > *').length,
    pageErrors: []
  }));
  checks.baseline.pageErrors = baselineErrors;
  assert.deepEqual(baselineErrors, [], 'baseline must not emit uncaught errors');
  assert.equal(checks.baseline.playCalls, 0, 'baseline confirms the starter has no play handler');
  assert.equal(checks.baseline.skipWrites, 0, 'baseline confirms the starter has no skip handler');
  assert.equal(checks.baseline.eventHandlers, 0, 'baseline scripts.js is empty');
  await baselineContext.close();
  baselineContext = null;

  changedContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await changedContext.addInitScript(mediaStub);
  changedPage = await changedContext.newPage();
  const pageErrors = [];
  changedPage.on('pageerror', error => pageErrors.push(error.message));
  await changedPage.goto(`${exampleURL}index.html`, { waitUntil: 'load' });
  const player = changedPage.locator('.player');
  const video = changedPage.locator('.viewer');
  const initialNodes = await player.locator('*').count();
  const registrationsBefore = await changedPage.evaluate(() => window.__registeredPlayerListeners);
  await player.hover();
  await video.evaluate(element => { element.style.height = '360px'; });
  assert.equal(await player.getAttribute('data-player-initialized'), 'true', 'player initializes once on page load');
  assert.equal(registrationsBefore.length, 15, 'one intended registration per control action');
  assert.equal(new Set(registrationsBefore.map(entry => `${entry.target}:${entry.type}`)).size, registrationsBefore.length, 'no player event is registered more than once');

  await changedPage.addScriptTag({ path: path.join(exampleDir, 'scripts.js') });
  const registrationsAfter = await changedPage.evaluate(() => window.__registeredPlayerListeners);
  assert.deepEqual(registrationsAfter, registrationsBefore, 'a second initialization adds no event handlers');
  assert.equal(await player.locator('*').count(), initialNodes, 'a second initialization creates no duplicate DOM nodes');
  assert.equal(await changedPage.evaluate(() => window.__activePlayerTimers.size), 0, 'initialization starts no timer');

  const toggle = changedPage.locator('.toggle');
  await toggle.click();
  assert.equal(await video.evaluate(element => element.paused), false, 'first click starts playback');
  assert.equal(await toggle.textContent(), '❚ ❚', 'play event updates the rendered button');
  await toggle.click();
  assert.equal(await video.evaluate(element => element.paused), true, 'second click pauses playback');
  assert.equal(await toggle.textContent(), '►', 'pause event restores the rendered button');
  await video.click({ position: { x: 200, y: 120 } });
  assert.equal(await video.evaluate(element => element.paused), false, 'video click starts playback');
  await video.click({ position: { x: 200, y: 120 } });
  assert.equal(await video.evaluate(element => element.paused), true, 'second video click pauses playback');
  assert.deepEqual(await changedPage.evaluate(() => ({ playCalls: window.__mediaStats.playCalls, pauseCalls: window.__mediaStats.pauseCalls })), { playCalls: 2, pauseCalls: 2 }, 'button and video clicks each produce one play or pause');

  await video.evaluate(element => { element.currentTime = 30; window.__mediaStats.seekWrites = 0; });
  const skipBack = changedPage.locator('[data-skip="-10"]');
  await skipBack.click();
  await skipBack.click();
  assert.equal(await video.evaluate(element => element.currentTime), 10, 'two skip interactions subtract exactly 20 seconds');
  assert.equal(await changedPage.evaluate(() => window.__mediaStats.seekWrites), 2, 'each skip interaction writes currentTime once');

  const volume = changedPage.locator('[name="volume"]');
  await volume.evaluate(element => { element.value = '0.35'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await volume.evaluate(element => { element.value = '0.55'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await video.evaluate(element => element.volume), 0.55, 'volume slider updates the media element');
  assert.equal(await changedPage.evaluate(() => window.__mediaStats.volumeWrites), 2, 'two slider interactions cause exactly two volume writes');

  const rate = changedPage.locator('[name="playbackRate"]');
  await rate.evaluate(element => { element.value = '1.3'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await rate.evaluate(element => { element.value = '1.6'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await video.evaluate(element => element.playbackRate), 1.6, 'playback rate slider updates the media element');
  assert.equal(await changedPage.evaluate(() => window.__mediaStats.playbackRateWrites), 2, 'two slider interactions cause exactly two rate writes');

  await video.evaluate(element => { element.currentTime = 60; element.dispatchEvent(new Event('timeupdate')); });
  const progressBar = changedPage.locator('.progress__filled');
  assert.equal(await progressBar.evaluate(element => element.style.flexBasis), '50%', 'timeupdate renders the correct progress');
  const progress = changedPage.locator('.progress');
  const progressBounds = await progress.boundingBox();
  await progress.click({ position: { x: progressBounds.width * 0.75, y: progressBounds.height / 2 } });
  assert.equal(await video.evaluate(element => element.currentTime), 90, 'progress click scrubs to the clicked time');
  await video.evaluate(element => element.dispatchEvent(new Event('timeupdate')));
  assert.equal(await progressBar.evaluate(element => element.style.flexBasis), '75%', 'scrubbed time updates the rendered progress');
  assert.ok((await changedPage.locator('.player').boundingBox()).width > 0, 'player has a rendered layout');
  assert.equal(await progressBar.evaluate(element => element.getBoundingClientRect().width > 0), true, 'progress fill occupies visible layout width');
  assert.equal(await player.locator('*').count(), initialNodes, 'interactions do not generate duplicate controls');
  assert.equal(await changedPage.evaluate(() => window.__activePlayerTimers.size), 0, 'no player timer remains active');
  assert.deepEqual(pageErrors, [], 'changed page must not emit uncaught errors');

  checks.actual = {
    initialized: await player.getAttribute('data-player-initialized'),
    listenerRegistrationsBeforeAndAfterDuplicateLoad: { before: registrationsBefore.length, after: registrationsAfter.length },
    mediaEffects: await changedPage.evaluate(() => ({ ...window.__mediaStats })),
    generatedControlNodesBeforeAndAfter: { before: initialNodes, after: await player.locator('*').count() },
    progressFlexBasis: await progressBar.evaluate(element => element.style.flexBasis),
    progressFillWidth: await progressBar.evaluate(element => element.getBoundingClientRect().width),
    activeTimers: await changedPage.evaluate(() => window.__activePlayerTimers.size),
    pageErrors
  };
  const workDir = path.join(repoRoot, 'work/R57-T044');
  await mkdir(workDir, { recursive: true });
  await changedPage.screenshot({ path: path.join(workDir, 'changed-player.png'), fullPage: true });
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  checks.error = error?.stack ?? String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanup = {};
  if (baselineContext) await baselineContext.close();
  cleanup.baselineContextClosed = !baselineContext || baselineContext.pages().every(page => page.isClosed());
  if (changedContext) await changedContext.close();
  cleanup.changedContextClosed = !changedContext || changedContext.pages().every(page => page.isClosed());
  if (browser) await browser.close();
  cleanup.browserClosed = !browser || !browser.isConnected();
  if (server) await new Promise(resolve => server.close(resolve));
  cleanup.localServerClosed = !server || !server.listening;
  checks.cleanup = cleanup;
  const workDir = path.join(repoRoot, 'work/R57-T044');
  await mkdir(workDir, { recursive: true });
  await writeFile(path.join(workDir, 'results.json'), `${JSON.stringify(checks, null, 2)}\n`);
}
