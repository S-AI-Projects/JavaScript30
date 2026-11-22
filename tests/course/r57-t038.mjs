import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const workDir = path.resolve(repoRoot, 'work/R57-T038');

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const PORT = 8738;
let server;
let browser;

const results = {
  task: 'R57-T038',
  timestamp: new Date().toISOString(),
  checks: [],
  passed: 0,
  failed: 0
};

function recordCheck(name, pass, details) {
  results.checks.push({ name, pass, details });
  if (pass) {
    results.passed++;
    console.log(`✅ PASS: ${name} (${JSON.stringify(details)})`);
  } else {
    results.failed++;
    console.error(`❌ FAIL: ${name} (${JSON.stringify(details)})`);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/21 - Geolocation/index-START.html';
      const filePath = path.join(repoRoot, decodeURIComponent(reqPath));

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.json': 'application/json'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, (err) => {
      if (err) reject(err);
      else resolve(`http://localhost:${PORT}`);
    });
  });
}

async function run() {
  try {
    const baseUrl = await startServer();
    browser = await chromium.launch({ headless: true });

    // Track errors across contexts
    let totalErrors = 0;

    // ----------------------------------------------------
    // Scenario 1: Normal motion preferences & Geolocation stub
    // ----------------------------------------------------
    const normalContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'no-preference'
    });

    const pageErrorsNormal = [];
    const normalPage = await normalContext.newPage();
    normalPage.on('pageerror', (err) => {
      pageErrorsNormal.push(err.message);
      totalErrors++;
    });

    // Stub geolocation watchPosition
    await normalPage.addInitScript(() => {
      navigator.geolocation.watchPosition = (successCallback) => {
        setTimeout(() => {
          successCallback({
            coords: {
              speed: 35.4,
              heading: 180,
              latitude: 37.7749,
              longitude: -122.4194,
              altitude: null,
              accuracy: 10,
              altitudeAccuracy: null
            },
            timestamp: Date.now()
          });
        }, 50);
        return 1;
      };
    });

    const resp = await normalPage.goto(`${baseUrl}/21%20-%20Geolocation/index-START.html`);
    recordCheck('Page responds with HTTP 200', resp.status() === 200, { status: resp.status() });

    // Check main container
    const mainVisible = await normalPage.isVisible('.compass-app');
    recordCheck('Main rendered content region (.compass-app) is visible', mainVisible, { visible: mainVisible });

    // Wait for stubbed geolocation update
    await normalPage.waitForFunction(() => {
      const sp = document.querySelector('.speed-value');
      return sp && sp.textContent === '35';
    }, { timeout: 3000 });

    const updatedHeading = await normalPage.$eval('.arrow', (el) => el.style.transform);
    recordCheck('Geolocation heading updates arrow rotation transform', updatedHeading.includes('180deg'), { transform: updatedHeading });

    // Check normal motion transition duration on .arrow
    const normalTransitionDuration = await normalPage.$eval('.arrow', (el) => {
      return window.getComputedStyle(el).transitionDuration;
    });
    recordCheck('Normal motion allows transition duration (> 0s)', normalTransitionDuration !== '0s', { duration: normalTransitionDuration });

    recordCheck('Zero errors in normal motion scenario', pageErrorsNormal.length === 0, { errors: pageErrorsNormal });
    await normalContext.close();

    // ----------------------------------------------------
    // Scenario 2: Reduced-motion emulation
    // ----------------------------------------------------
    const reducedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce'
    });

    const pageErrorsReduced = [];
    const reducedPage = await reducedContext.newPage();
    reducedPage.on('pageerror', (err) => {
      pageErrorsReduced.push(err.message);
      totalErrors++;
    });

    await reducedPage.addInitScript(() => {
      navigator.geolocation.watchPosition = (successCallback) => {
        setTimeout(() => {
          successCallback({
            coords: { speed: 20, heading: 90 },
            timestamp: Date.now()
          });
        }, 50);
        return 1;
      };
    });

    await reducedPage.goto(`${baseUrl}/21%20-%20Geolocation/index-START.html`);

    await reducedPage.waitForFunction(() => {
      const sp = document.querySelector('.speed-value');
      return sp && sp.textContent === '20';
    }, { timeout: 3000 });

    // Check that transition duration drops to 0s under prefers-reduced-motion: reduce
    const reducedTransitionDuration = await reducedPage.$eval('.arrow', (el) => {
      return window.getComputedStyle(el).transitionDuration;
    });
    recordCheck('Reduced-motion disables transition duration (0s)', reducedTransitionDuration === '0s', { duration: reducedTransitionDuration });

    // Verify information and interactive controls remain fully usable
    await reducedPage.click('#calibrate-btn');
    const calibratedHeading = await reducedPage.$eval('.arrow', (el) => el.style.transform);
    const calibratedSpeed = await reducedPage.$eval('.speed-value', (el) => el.textContent);
    recordCheck('Interactive control updates heading under reduced motion', calibratedHeading.includes('135deg') && calibratedSpeed === '12', {
      transform: calibratedHeading,
      speed: calibratedSpeed
    });

    await reducedPage.screenshot({ path: path.join(workDir, 'reduced-motion.png') });
    recordCheck('Zero errors in reduced motion scenario', pageErrorsReduced.length === 0, { errors: pageErrorsReduced });
    await reducedContext.close();

    // ----------------------------------------------------
    // Scenario 3: Visible keyboard focus & layout at 360px viewport
    // ----------------------------------------------------
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 740 }
    });
    const pageErrorsMobile = [];
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('pageerror', (err) => {
      pageErrorsMobile.push(err.message);
      totalErrors++;
    });

    await mobilePage.goto(`${baseUrl}/21%20-%20Geolocation/index-START.html`);

    // Check no horizontal scrollbar/overflow
    const mobileOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    recordCheck('Zero horizontal overflow at 360px viewport', !mobileOverflow, { overflow: mobileOverflow });

    // Tab to focus interactive control
    await mobilePage.keyboard.press('Tab');
    const focusedTagMobile = await mobilePage.evaluate(() => document.activeElement ? document.activeElement.id : null);
    const outlineInfoMobile = await mobilePage.$eval('#calibrate-btn', (el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor
      };
    });

    const mobileFocusVisible = focusedTagMobile === 'calibrate-btn' && outlineInfoMobile.outlineStyle !== 'none' && parseFloat(outlineInfoMobile.outlineWidth) > 0;
    recordCheck('Visible keyboard focus indicator at 360px', mobileFocusVisible, {
      activeElementId: focusedTagMobile,
      outline: outlineInfoMobile
    });

    await mobilePage.screenshot({ path: path.join(workDir, 'focus-360px.png') });
    await mobileContext.close();

    // ----------------------------------------------------
    // Scenario 4: Visible keyboard focus & layout at 1280px viewport
    // ----------------------------------------------------
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const pageErrorsDesktop = [];
    const desktopPage = await desktopContext.newPage();
    desktopPage.on('pageerror', (err) => {
      pageErrorsDesktop.push(err.message);
      totalErrors++;
    });

    await desktopPage.goto(`${baseUrl}/21%20-%20Geolocation/index-START.html`);

    const desktopOverflow = await desktopPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    recordCheck('Zero horizontal overflow at 1280px viewport', !desktopOverflow, { overflow: desktopOverflow });

    // Tab to focus interactive control
    await desktopPage.keyboard.press('Tab');
    const focusedTagDesktop = await desktopPage.evaluate(() => document.activeElement ? document.activeElement.id : null);
    const outlineInfoDesktop = await desktopPage.$eval('#calibrate-btn', (el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor
      };
    });

    const desktopFocusVisible = focusedTagDesktop === 'calibrate-btn' && outlineInfoDesktop.outlineStyle !== 'none' && parseFloat(outlineInfoDesktop.outlineWidth) > 0;
    recordCheck('Visible keyboard focus indicator at 1280px', desktopFocusVisible, {
      activeElementId: focusedTagDesktop,
      outline: outlineInfoDesktop
    });

    await desktopPage.screenshot({ path: path.join(workDir, 'focus-1280px.png') });
    await desktopContext.close();

    // ----------------------------------------------------
    // Overall error check
    // ----------------------------------------------------
    recordCheck('Zero uncaught page errors across all test scenarios', totalErrors === 0, { totalErrors });

    // Save test results & versions
    fs.writeFileSync(path.join(workDir, 'results.json'), JSON.stringify(results, null, 2), 'utf-8');

    const versions = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      playwright: '^1.65.1'
    };
    fs.writeFileSync(path.join(workDir, 'versions.json'), JSON.stringify(versions, null, 2), 'utf-8');

    console.log(`\n🎉 Test completed: ${results.passed}/${results.checks.length} passed.`);
    if (results.failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

run();

