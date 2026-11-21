import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T035');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8772) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const decoded = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(REPO_ROOT, decoded);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.mjs': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        server,
        url: `http://127.0.0.1:${port}/02%20-%20JS%20and%20CSS%20Clock/index-START.html`
      });
    });
  });
}

async function runChecks() {
  const checks = [];
  function recordCheck(name, passed, expected, actual) {
    checks.push({ name, passed, expected, actual });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name} (Expected: ${expected}, Actual: ${actual})`);
  }

  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  try {
    // -------------------------------------------------------------
    // Path 1: Feature-Present (CSS 2D Transforms supported)
    // -------------------------------------------------------------
    console.log('\n--- Path 1: Feature-Present (Transforms Supported) ---');
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await context1.newPage();

    let pageErrors1 = [];
    page1.on('pageerror', (err) => pageErrors1.push(err.message));

    const res1 = await page1.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Feature-Present: Page responds with HTTP 200', res1 && res1.status() === 200, 200, res1 ? res1.status() : 0);
    recordCheck('Feature-Present: Zero page errors', pageErrors1.length === 0, 0, pageErrors1.length);

    // Anchor .clock exists
    const clockExists = await page1.locator('.clock').count();
    recordCheck('Feature-Present: Main content anchor (.clock) exists', clockExists === 1, 1, clockExists);

    // Analog clock face is visible
    const faceVisible = await page1.locator('.clock-face').isVisible();
    recordCheck('Feature-Present: Analog clock face is visible', faceVisible, true, faceVisible);

    // Hands have rotate transforms applied
    const handsTransform = await page1.evaluate(() => {
      const s = document.querySelector('.second-hand').style.transform;
      const m = document.querySelector('.min-hand').style.transform;
      const h = document.querySelector('.hour-hand').style.transform;
      return { s, m, h, allRotated: s.includes('rotate') && m.includes('rotate') && h.includes('rotate') };
    });
    recordCheck('Feature-Present: Clock hands have active rotate transforms', handsTransform.allRotated, true, JSON.stringify(handsTransform));

    // Fallback display is hidden
    const fallbackHidden = await page1.locator('#clock-fallback').evaluate((el) => {
      return window.getComputedStyle(el).display === 'none';
    });
    recordCheck('Feature-Present: Digital fallback display is hidden', fallbackHidden, true, fallbackHidden);

    await page1.screenshot({ path: path.join(WORK_DIR, 'screenshot-feature-present.png') });
    await context1.close();

    // -------------------------------------------------------------
    // Path 2: Feature-Absent (Simulated transform unsupported)
    // -------------------------------------------------------------
    console.log('\n--- Path 2: Feature-Absent (Transforms Unsupported) ---');
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await context2.newPage();

    let pageErrors2 = [];
    page2.on('pageerror', (err) => pageErrors2.push(err.message));

    // Simulate unsupported transforms before page load
    await page2.addInitScript(() => {
      if (!window.CSS) window.CSS = {};
      window.CSS.supports = () => false;
    });

    const res2 = await page2.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Feature-Absent: Page responds with HTTP 200', res2 && res2.status() === 200, 200, res2 ? res2.status() : 0);
    recordCheck('Feature-Absent: Zero page errors', pageErrors2.length === 0, 0, pageErrors2.length);

    // Analog clock face is hidden to prevent visual defect
    const faceHidden = await page2.locator('.clock-face').evaluate((el) => {
      return window.getComputedStyle(el).display === 'none';
    });
    recordCheck('Feature-Absent: Analog clock face is hidden gracefully', faceHidden, true, faceHidden);

    // Fallback digital display is visible
    const fallbackVisible = await page2.locator('#clock-fallback').evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
    recordCheck('Feature-Absent: Digital fallback readout is displayed', fallbackVisible, true, fallbackVisible);

    // Fallback contains valid formatted time
    const fallbackTimeText = await page2.locator('#clock-fallback .fallback-time').textContent();
    const hasValidTime = /\d{1,2}:\d{2}/.test(fallbackTimeText);
    recordCheck('Feature-Absent: Fallback displays valid live time string', hasValidTime, true, fallbackTimeText);

    await page2.screenshot({ path: path.join(WORK_DIR, 'screenshot-feature-absent.png') });
    await context2.close();

    allPassed = checks.every((c) => c.passed) && pageErrors1.length === 0 && pageErrors2.length === 0;

    // Write results.json
    const summary = {
      task: 'R57-T035',
      page: '02 - JS and CSS Clock/index-START.html',
      browser: 'Chromium',
      checks,
      summary: {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        status: allPassed ? 'PASS' : 'FAIL'
      }
    };

    fs.writeFileSync(path.join(WORK_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`\nSaved test results to ${path.join(WORK_DIR, 'results.json')}`);
  } catch (err) {
    console.error('Test execution failed:', err);
    allPassed = false;
  } finally {
    await browser.close();
    server.close();
  }

  if (!allPassed) {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${checks.length}/${checks.length} checks passed successfully!`);
    process.exit(0);
  }
}

runChecks();
