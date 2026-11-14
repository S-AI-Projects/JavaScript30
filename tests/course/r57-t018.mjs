import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function startStaticServer(baseDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(baseDir, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

async function runTests() {
  const port = 3018;
  let server;
  let browser;
  const pageErrors = [];

  try {
    server = await startStaticServer(projectRoot, port);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Stub external favicon
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('fav.farm')) {
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg></svg>' });
      }
      return route.continue();
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const targetUrl = `http://localhost:${port}/18%20-%20Adding%20Up%20Times%20with%20Reduce/index-START.html`;
    const response = await page.goto(targetUrl, { waitUntil: 'load' });

    console.log(`[PASS] Server returned status ${response.status()}`);
    if (response.status() !== 200) {
      throw new Error(`Expected HTTP 200, got ${response.status()}`);
    }

    // 1. Verify initial total duration calculation
    const totalDisplay = await page.$('#total-time-display');
    if (!totalDisplay) {
      throw new Error('Total time display element (#total-time-display) not found');
    }
    const initialDisplayText = await totalDisplay.textContent();
    console.log(`[PASS] Initial display rendered: "${initialDisplayText.trim()}"`);
    if (!initialDisplayText.includes('Total Duration: 4:58:58')) {
      throw new Error(`Expected Initial Total Duration: 4:58:58, got "${initialDisplayText}"`);
    }

    // 2. Safe text rendering check: Attempt XSS injection
    const maliciousPayload = '<script>window.__xss_flag = "pwned";</script><img src="nonexistent.png" onerror="window.__xss_flag = \'img_error\';" /><b id="injected-tag">Dangerous Tag</b>';
    const customTime = '04:15';

    await page.fill('#video-title-input', maliciousPayload);
    await page.fill('#video-time-input', customTime);
    await page.click('#add-video-btn');

    // Wait a brief moment to allow any errant script/error handlers to attempt execution
    await page.waitForTimeout(100);

    // 3. Verify that no script executed
    const xssFlag = await page.evaluate(() => window.__xss_flag);
    if (xssFlag !== undefined) {
      throw new Error(`VULNERABILITY DETECTED: Script payload executed, window.__xss_flag = ${xssFlag}`);
    }
    console.log('[PASS] Script payload did not execute (window.__xss_flag is undefined)');

    // 4. Verify that no HTML element was injected into DOM
    const injectedTag = await page.$('#injected-tag');
    if (injectedTag !== null) {
      throw new Error('VULNERABILITY DETECTED: Injected HTML tag (#injected-tag) was parsed and added to DOM');
    }
    console.log('[PASS] Injected HTML tags were not parsed into the DOM');

    const scriptCount = await page.$$eval('.videos li script', els => els.length);
    if (scriptCount !== 0) {
      throw new Error(`Expected 0 script tags in playlist, found ${scriptCount}`);
    }
    console.log('[PASS] Zero <script> tags present in playlist items');

    const imgCount = await page.$$eval('.videos li img', els => els.length);
    if (imgCount !== 0) {
      throw new Error(`Expected 0 img tags in playlist, found ${imgCount}`);
    }
    console.log('[PASS] Zero <img> tags present in playlist items');

    // 5. Verify that the raw string is rendered purely as literal text
    const customItem = await page.$('.videos li[data-custom="true"]');
    if (!customItem) {
      throw new Error('Custom video item with data-custom="true" not found');
    }
    const itemText = await customItem.textContent();
    if (!itemText.includes(maliciousPayload)) {
      throw new Error(`Custom item text does not contain raw payload: "${itemText}"`);
    }
    console.log('[PASS] Payload strictly rendered as literal text content');

    // 6. Verify that total time was re-calculated safely and accurately
    // Previous: 4:58:58 (17938s) + 4:15 (255s) = 18193s = 5:03:13
    const updatedDisplayText = await totalDisplay.textContent();
    console.log(`[PASS] Updated display rendered: "${updatedDisplayText.trim()}"`);
    if (!updatedDisplayText.includes('Total Duration: 5:03:13')) {
      throw new Error(`Expected Updated Total Duration: 5:03:13, got "${updatedDisplayText}"`);
    }

    // 7. Verify zero uncaught page errors
    if (pageErrors.length > 0) {
      throw new Error(`Unexpected page errors logged: ${pageErrors.join(', ')}`);
    }
    console.log('[PASS] Zero uncaught page errors');

    // 8. Capture evidence screenshot
    const evidenceDir = path.join(projectRoot, 'work/R57-T018');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    const screenshotPath = path.join(evidenceDir, 'safe-text-rendering.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[PASS] Screenshot saved to ${screenshotPath}`);

    // 9. Save test results JSON
    const results = {
      task: 'R57-T018',
      status: 'PASSED',
      timestamp: new Date().toISOString(),
      tests_executed: [
        'Server returns HTTP 200',
        'Initial playlist sum correctly computed to 4:58:58 via reduce',
        'Payload containing <script> does not execute handlers',
        'Payload containing HTML tags does not inject DOM elements',
        'Playlist item safely stores and displays literal string via textContent',
        'Dynamic total calculation updates accurately to 5:03:13 upon item insertion',
        'Zero uncaught page/console errors'
      ],
      assertions_passed: 7,
      assertions_failed: 0
    };
    fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));

    console.log('\n--- ALL CHECKS PASSED SUCCESSFULLY (7/7) ---');
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

runTests().catch((err) => {
  console.error('\n[FAIL] Test suite failed:', err);
  process.exit(1);
});
