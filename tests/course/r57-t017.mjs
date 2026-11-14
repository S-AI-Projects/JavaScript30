import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8771;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/21%20-%20Geolocation/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T017');

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
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await context.route('**fav.farm**', (route) => route.fulfill({ status: 200, body: '' }));

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Stub native geolocation watchPosition to provide deterministic, hardware-independent tests
    await page.addInitScript(() => {
      let activeCallback = null;
      navigator.geolocation.watchPosition = function (success, error, options) {
        activeCallback = success;
        success({
          coords: {
            latitude: 51.5074,
            longitude: -0.1278,
            speed: 0,
            heading: 0
          }
        });
        return 1;
      };

      window.__emitGeolocationUpdate__ = function (speed, heading) {
        if (activeCallback) {
          activeCallback({
            coords: {
              latitude: 51.5074,
              longitude: -0.1278,
              speed,
              heading
            }
          });
        }
      };
    });

    // 1. Entry point check: Page loads successfully
    const response = await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Walkthrough Step 1: Page responds with HTTP 200', 200, response.status(), response.status() === 200);

    // 2. Main rendered content region verification
    const hasMainRegion = await page.$eval('.compass-container', (el) => !!el).catch(() => false);
    record('Walkthrough Step 2: Main region .compass-container exists', true, hasMainRegion, hasMainRegion === true);

    const hasArrow = await page.$eval('.arrow', (el) => !!el).catch(() => false);
    record('Walkthrough Step 2: Compass arrow SVG exists', true, hasArrow, hasArrow === true);

    const hasSpeedDisplay = await page.$eval('.speed-value', (el) => !!el).catch(() => false);
    record('Walkthrough Step 2: Speedometer value display exists', true, hasSpeedDisplay, hasSpeedDisplay === true);

    // 3. Initial layout observation
    const initialSpeed = await page.$eval('.speed-value', (el) => el.textContent.trim());
    record('Walkthrough Step 3: Initial speed displays 0', '0', initialSpeed, initialSpeed === '0');

    const initialTransform = await page.$eval('.arrow', (el) => el.style.transform);
    record('Walkthrough Step 3: Initial arrow rotation is rotate(0deg)', 'rotate(0deg)', initialTransform, initialTransform === 'rotate(0deg)');

    const screenshot1Path = path.join(WORK_DIR, 'walkthrough-step1-initial.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved walkthrough step 1 screenshot: ${screenshot1Path}`);

    // 4. Interaction Walkthrough: Heading 90° (East) at 45 km/h
    await page.evaluate(() => window.__emitGeolocationUpdate__(45, 90));
    await page.waitForTimeout(250);

    const step2Speed = await page.$eval('.speed-value', (el) => el.textContent.trim());
    record('Walkthrough Step 4: Speed updates to 45', '45', step2Speed, step2Speed === '45');

    const step2Transform = await page.$eval('.arrow', (el) => el.style.transform);
    record('Walkthrough Step 4: Arrow rotates to rotate(90deg)', 'rotate(90deg)', step2Transform, step2Transform === 'rotate(90deg)');

    const screenshot2Path = path.join(WORK_DIR, 'walkthrough-step2-east.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved walkthrough step 2 screenshot: ${screenshot2Path}`);

    // 5. Interaction Walkthrough: Heading 180° (South) at 120 km/h
    await page.evaluate(() => window.__emitGeolocationUpdate__(120, 180));
    await page.waitForTimeout(250);

    const step3Speed = await page.$eval('.speed-value', (el) => el.textContent.trim());
    record('Walkthrough Step 5: Speed updates to 120', '120', step3Speed, step3Speed === '120');

    const step3Transform = await page.$eval('.arrow', (el) => el.style.transform);
    record('Walkthrough Step 5: Arrow rotates to rotate(180deg)', 'rotate(180deg)', step3Transform, step3Transform === 'rotate(180deg)');

    const screenshot3Path = path.join(WORK_DIR, 'walkthrough-step3-south.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`Saved walkthrough step 3 screenshot: ${screenshot3Path}`);

    // 6. Error checks
    record('Walkthrough: Zero unhandled console/page errors', 0, pageErrors.length, pageErrors.length === 0);

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
      task: 'R57-T017',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      walkthrough_steps_executed: 5,
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
