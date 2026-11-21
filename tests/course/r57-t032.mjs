import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T032');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8768) {
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
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.wav': 'audio/wav'
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
        url: `http://127.0.0.1:${port}/01%20-%20JavaScript%20Drum%20Kit/index-START.html`
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
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  });
  let allPassed = true;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let pageErrors = [];
    page.on('pageerror', (err) => {
      console.error('Page error detected:', err);
      pageErrors.push(err.message);
    });

    // 1. Initial page load
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Page responds with HTTP 200', response && response.status() === 200, 200, response ? response.status() : 0);
    recordCheck('No initial page errors', pageErrors.length === 0, 0, pageErrors.length);

    // 2. Audio source anchors present
    const audioCount = await page.locator('audio').count();
    recordCheck('All 9 audio elements present', audioCount === 9, 9, audioCount);

    const keysCount = await page.locator('.key').count();
    recordCheck('All 9 drum key elements present', keysCount === 9, 9, keysCount);

    // 3. Status display is initialized
    const initialStatus = await page.locator('#status-display').textContent();
    recordCheck(
      'Initial status display contains guide text',
      initialStatus.includes('Press a key'),
      true,
      initialStatus
    );

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-initial.png') });

    // 4. Test unmapped / invalid key interaction ('Z')
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(100);

    const unmappedStatus = await page.locator('#status-display').textContent();
    const isUnmappedErrorClass = await page.locator('#status-display').evaluate((el) => el.classList.contains('error'));
    recordCheck(
      'Unmapped key displays meaningful error guidance',
      unmappedStatus.includes('not mapped'),
      true,
      unmappedStatus
    );
    recordCheck('Status display has .error class on invalid key', isUnmappedErrorClass, true, isUnmappedErrorClass);
    recordCheck('Zero uncaught page errors on unmapped keypress', pageErrors.length === 0, 0, pageErrors.length);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-unmapped.png') });

    // 5. Test recovery from unmapped input: press valid key 'A'
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(50);

    const recoveredFromUnmapped = await page.locator('#status-display').evaluate((el) => !el.classList.contains('error'));
    const keyAIsPlaying = await page.locator('div[data-key="65"]').evaluate((el) => el.classList.contains('playing'));
    recordCheck('Status display recovers (clears error class) on valid keypress', recoveredFromUnmapped, true, recoveredFromUnmapped);
    recordCheck('Valid key receives .playing animation class', keyAIsPlaying, true, keyAIsPlaying);

    // 6. Test failed asset fixture (simulate failed audio asset load via network abort)
    const errContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const errPage = await errContext.newPage();
    errPage.on('pageerror', (err) => pageErrors.push(err.message));

    await errPage.route('**/sounds/clap.wav', (route) => route.abort('failed'));
    await errPage.goto(url, { waitUntil: 'domcontentloaded' });
    await errPage.waitForTimeout(300);

    // Press 'A' whose sound asset failed to load
    await errPage.keyboard.press('KeyA');
    await errPage.waitForTimeout(150);

    const isAssetError = await errPage.evaluate(() => {
      const status = document.getElementById('status-display');
      const key = document.querySelector('div[data-key="65"]');
      return status.classList.contains('error') || key.classList.contains('key-error');
    });

    recordCheck('Asset failure triggers graceful error state without crashing', isAssetError, true, isAssetError);
    recordCheck('Zero uncaught exceptions during failed asset playback', pageErrors.length === 0, 0, pageErrors.length);

    await errPage.screenshot({ path: path.join(WORK_DIR, 'screenshot-asset-error.png') });

    // 7. Test recovery from failed asset: press 'S' (valid asset sounds/hihat.wav)
    await errPage.keyboard.down('KeyS');
    const keySPlaying = await errPage.locator('div[data-key="83"]').evaluate((el) => el.classList.contains('playing'));
    await errPage.keyboard.up('KeyS');
    await errPage.waitForTimeout(100);

    const recoveredStatus = await errPage.locator('#status-display').textContent();
    recordCheck('Subsequent valid key triggers playback after error', keySPlaying, true, keySPlaying);
    recordCheck(
      'Status display recovers to show active playback',
      recoveredStatus.toLowerCase().includes('playing') || !recoveredStatus.includes('failed'),
      true,
      recoveredStatus
    );

    await errPage.screenshot({ path: path.join(WORK_DIR, 'screenshot-recovered.png') });
    await errContext.close();

    // 8. Static fallback check: CSS background fallback color is present
    const hasBgFallback = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.documentElement).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    });
    recordCheck('CSS has fallback background color for missing background asset', hasBgFallback, true, hasBgFallback);

    allPassed = checks.every((c) => c.passed) && pageErrors.length === 0;

    // Write results.json
    const summary = {
      task: 'R57-T032',
      page: '01 - JavaScript Drum Kit/index-START.html',
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

    await context.close();
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
