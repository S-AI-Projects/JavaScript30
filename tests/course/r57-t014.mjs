import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8768;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/03%20-%20CSS%20Variables/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T014');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    try {
      const decodedPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(rootDir, decodedPath === '/' ? 'index.html' : decodedPath);

      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      });
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
}

async function runCheck() {
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const checks = [];
  function record(name, expected, actual, passed) {
    checks.push({ name, expected, actual, passed });
    const mark = passed ? '✓' : '✗';
    console.log(`[${mark}] ${name}`);
    if (!passed) {
      console.error(`    Expected: ${JSON.stringify(expected)}`);
      console.error(`    Actual:   ${JSON.stringify(actual)}`);
    }
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Test server running at ${BASE_URL}`);

  let browser;
  let allPassed = true;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Stub external image to prevent external network flakiness
    await context.route('**/unsplash.it/**', (route) => {
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('') });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Load target page
    const response = await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Page responds with HTTP 200', 200, response.status(), response.status() === 200);

    // 2. Verify controls exist
    const hasControls = await page.evaluate(() => {
      return !!(document.getElementById('spacing') && document.getElementById('blur') && document.getElementById('base'));
    });
    record('Controls #spacing, #blur, #base exist in DOM', true, hasControls, hasControls === true);

    // 3. Initial interaction updates CSS variables
    await page.evaluate(() => {
      const spacingInput = document.getElementById('spacing');
      spacingInput.value = '25';
      spacingInput.dispatchEvent(new Event('change'));
    });
    const updatedSpacing = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--spacing');
    });
    record('Changing #spacing sets --spacing: 25px', '25px', updatedSpacing, updatedSpacing === '25px');

    await page.evaluate(() => {
      const blurInput = document.getElementById('blur');
      blurInput.value = '5';
      blurInput.dispatchEvent(new Event('change'));
    });
    const updatedBlur = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--blur');
    });
    record('Changing #blur sets --blur: 5px', '5px', updatedBlur, updatedBlur === '5px');

    await page.evaluate(() => {
      const baseInput = document.getElementById('base');
      baseInput.value = '#ff0000';
      baseInput.dispatchEvent(new Event('change'));
    });
    const updatedBase = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--base');
    });
    record('Changing #base sets --base: #ff0000', '#ff0000', updatedBase, updatedBase === '#ff0000');

    const screenshotInitialPath = path.join(WORK_DIR, 'screenshot-initial.png');
    await page.screenshot({ path: screenshotInitialPath });
    console.log(`Saved initial screenshot: ${screenshotInitialPath}`);

    // 4. Test repeated initialization: Re-initialize multiple times
    const reinitResult = await page.evaluate(() => {
      let callCount = 0;
      const originalSetProperty = document.documentElement.style.setProperty;
      document.documentElement.style.setProperty = function (prop, val) {
        if (prop === '--spacing') callCount++;
        return originalSetProperty.apply(this, arguments);
      };

      // Re-initialize 3 times consecutively
      window.initCSSVariables();
      window.initCSSVariables();
      window.initCSSVariables();

      // Trigger a single change
      const spacingInput = document.getElementById('spacing');
      spacingInput.value = '35';
      spacingInput.dispatchEvent(new Event('change'));

      document.documentElement.style.setProperty = originalSetProperty;
      return {
        callCount,
        finalValue: document.documentElement.style.getPropertyValue('--spacing')
      };
    });

    record('Repeated initialization produces exactly 1 update per event', 1, reinitResult.callCount, reinitResult.callCount === 1);
    record('Final value reflects update after re-initialization', '35px', reinitResult.finalValue, reinitResult.finalValue === '35px');

    const screenshotReinitPath = path.join(WORK_DIR, 'screenshot-reinit.png');
    await page.screenshot({ path: screenshotReinitPath });
    console.log(`Saved reinit screenshot: ${screenshotReinitPath}`);

    // 5. Test cleanup: verify no active listeners remain after cleanup
    const cleanupResult = await page.evaluate(() => {
      window.cleanupCSSVariables();

      const spacingInput = document.getElementById('spacing');
      spacingInput.value = '80';
      spacingInput.dispatchEvent(new Event('change'));

      return document.documentElement.style.getPropertyValue('--spacing');
    });
    record('Cleanup deactivates listeners (value remains unchanged after event)', '35px', cleanupResult, cleanupResult === '35px');

    // 6. Test no generated DOM node duplication
    const inputCount = await page.$$eval('.controls input', (els) => els.length);
    record('Control DOM nodes are not duplicated', 3, inputCount, inputCount === 3);

    // 7. Check for unhandled errors
    record('No unhandled console/page errors', 0, pageErrors.length, pageErrors.length === 0);

    allPassed = checks.every((c) => c.passed);
  } catch (err) {
    console.error('Test execution failure:', err);
    record('Test execution without unhandled exception', 'Success', err.message, false);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    console.log('Server and browser cleaned up.');

    const summary = {
      task: 'R57-T014',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      checks,
      summary: {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length
      }
    };
    fs.writeFileSync(path.join(WORK_DIR, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(`Saved results to ${path.join(WORK_DIR, 'results.json')}`);
  }

  if (!allPassed) {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed successfully!');
    process.exit(0);
  }
}

runCheck();
