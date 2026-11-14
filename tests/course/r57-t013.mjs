import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8767;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/12%20-%20Key%20Sequence%20Detection/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T013');

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

    // ==========================================
    // 1. SCENARIO 1: Normal Fixture & Empty State
    // ==========================================
    const contextNormal = await browser.newContext();
    const pageNormal = await contextNormal.newPage();
    const normalErrors = [];
    pageNormal.on('pageerror', (err) => normalErrors.push(err.message));

    const response = await pageNormal.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Page loads with HTTP 200', 200, response.status(), response.status() === 200);

    // Initial empty state verification
    const initialStatus = await pageNormal.$eval('#status', (el) => el.textContent.trim());
    record('Initial state displays empty prompt', true, initialStatus.includes('Awaiting input'), initialStatus.includes('Awaiting input'));

    const initialSlotCount = await pageNormal.$$eval('.key-slot', (els) => els.length);
    record('Buffer renders 6 placeholder key slots', 6, initialSlotCount, initialSlotCount === 6);

    // Typing keys updates buffer
    await pageNormal.keyboard.type('abc');
    const updatedStatus = await pageNormal.$eval('#status', (el) => el.textContent.trim());
    record('Typing updates status to tracking progress', true, updatedStatus.includes('3/6'), updatedStatus.includes('3/6'));

    // Type the secret code "wesbos"
    await pageNormal.keyboard.type('wesbos');
    const successStatus = await pageNormal.$eval('#status', (el) => el.textContent.trim());
    record('Secret code unlocks celebration status', true, successStatus.includes('DING DING!'), successStatus.includes('DING DING!'));

    const screenshotSuccessPath = path.join(WORK_DIR, 'screenshot-success.png');
    await pageNormal.screenshot({ path: screenshotSuccessPath });
    console.log(`Saved success screenshot: ${screenshotSuccessPath}`);

    // Test input recovery: typing another key resumes tracking without breaking
    await pageNormal.keyboard.type('z');
    const recoveredStatus = await pageNormal.$eval('#status', (el) => el.textContent.trim());
    record('Subsequent input recovers cleanly into tracking mode', true, recoveredStatus.includes('Tracking keys'), recoveredStatus.includes('Tracking keys'));
    record('No unhandled errors during normal flow', 0, normalErrors.length, normalErrors.length === 0);

    await contextNormal.close();

    // ==========================================
    // 2. SCENARIO 2: Failed Asset Fixture
    // ==========================================
    const contextFailure = await browser.newContext();
    // Simulate failed asset request for cornify.js
    await contextFailure.route('**/cornify.js', (route) => route.abort());

    const pageFailure = await contextFailure.newPage();
    const failureErrors = [];
    pageFailure.on('pageerror', (err) => failureErrors.push(err.message));

    await pageFailure.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });

    // Fallback banner should be displayed
    const isBannerVisible = await pageFailure.$eval('#fallback-banner', (el) => el.classList.contains('visible'));
    record('Asset failure triggers fallback notification banner', true, isBannerVisible, isBannerVisible === true);

    // Type secret code under asset failure
    await pageFailure.keyboard.type('wesbos');
    const fallbackStatus = await pageFailure.$eval('#status', (el) => el.textContent.trim());
    record('Fallback celebration triggered gracefully on secret code', true, fallbackStatus.includes('DING DING!'), fallbackStatus.includes('DING DING!'));

    const fallbackSparkleExists = await pageFailure.$eval('.fallback-sparkle', (el) => !!el).catch(() => false);
    record('Fallback visual celebration element rendered', true, fallbackSparkleExists, fallbackSparkleExists === true);

    const screenshotFallbackPath = path.join(WORK_DIR, 'screenshot-fallback.png');
    await pageFailure.screenshot({ path: screenshotFallbackPath });
    console.log(`Saved fallback screenshot: ${screenshotFallbackPath}`);

    record('No uncaught JavaScript errors during asset failure', 0, failureErrors.length, failureErrors.length === 0);

    await contextFailure.close();

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
      task: 'R57-T013',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      scenarios_tested: ['Normal empty state and valid input recovery', 'Failed asset request fixture and graceful fallback'],
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
