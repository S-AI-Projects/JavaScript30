import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T036');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8773) {
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
        url: `http://127.0.0.1:${port}/12%20-%20Key%20Sequence%20Detection/index-START.html`
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

  // 1. Verify WALKTHROUGH.md documentation exists and covers required sections
  const walkthroughPath = path.join(REPO_ROOT, '12 - Key Sequence Detection', 'WALKTHROUGH.md');
  const walkthroughExists = fs.existsSync(walkthroughPath);
  recordCheck('WALKTHROUGH.md documentation file exists', walkthroughExists, true, walkthroughExists);

  if (walkthroughExists) {
    const content = fs.readFileSync(walkthroughPath, 'utf8');
    const hasPrereqs = content.includes('Prerequisites');
    const hasSteps = content.includes('Step 1') && content.includes('Step 2') && content.includes('Step 3');
    const hasExpected = content.includes('Expected Observation');
    recordCheck('WALKTHROUGH.md contains prerequisites, steps, and expected observations', hasPrereqs && hasSteps && hasExpected, true, true);
  }

  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  let allPassed = true;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Step 1: Initial Page Entry Point
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    recordCheck('Step 1: Page entry point responds with HTTP 200', response && response.status() === 200, 200, response ? response.status() : 0);
    recordCheck('Step 1: No page errors on load', pageErrors.length === 0, 0, pageErrors.length);

    const containerExists = await page.locator('.key-sequence-container').isVisible();
    recordCheck('Step 1: Main content region (.key-sequence-container) is visible', containerExists, true, containerExists);

    const initialBuffer = await page.locator('#key-buffer').textContent();
    recordCheck('Step 1: Initial buffer shows awaiting text', initialBuffer.includes('awaiting'), true, initialBuffer);

    const initialStatus = await page.locator('#key-status').textContent();
    recordCheck('Step 1: Initial status shows waiting text', initialStatus.includes('Waiting'), true, initialStatus);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-step1-initial.png') });

    // Step 2: Keystroke Buffer Tracking ('hello')
    await page.keyboard.type('hello');
    await page.waitForTimeout(100);

    const bufferAfterHello = await page.locator('#key-buffer').textContent();
    recordCheck('Step 2: Key buffer tracks typed keys accurately', bufferAfterHello === 'hello', 'hello', bufferAfterHello);

    const statusAfterHello = await page.locator('#key-status').textContent();
    recordCheck('Step 2: Status updates to tracking state', statusAfterHello.includes('Tracking'), true, statusAfterHello);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-step2-typing.png') });

    // Step 3: Secret Code Detection ('wesbos')
    await page.keyboard.type('wesbos');
    await page.waitForTimeout(150);

    const bufferAfterSecret = await page.locator('#key-buffer').textContent();
    recordCheck('Step 3: Buffer contains secret code', bufferAfterSecret.includes('wesbos'), true, bufferAfterSecret);

    const statusAfterSecret = await page.locator('#key-status').textContent();
    const hasCelebrationClass = await page.locator('#key-status').evaluate((el) => el.classList.contains('celebration-active'));
    recordCheck('Step 3: Secret code detected and triggers DING DING status', statusAfterSecret.includes('DING DING!'), true, statusAfterSecret);
    recordCheck('Step 3: Status receives celebration-active styling', hasCelebrationClass, true, hasCelebrationClass);

    await page.screenshot({ path: path.join(WORK_DIR, 'screenshot-step3-celebration.png') });

    // Step 4: Continued Input Handling
    await page.keyboard.type('xyz');
    await page.waitForTimeout(100);

    const bufferAfterMore = await page.locator('#key-buffer').textContent();
    recordCheck('Step 4: Buffer safely slides window on continued typing', bufferAfterMore.length <= 6, true, bufferAfterMore);
    recordCheck('Zero uncaught exceptions throughout walkthrough execution', pageErrors.length === 0, 0, pageErrors.length);

    allPassed = checks.every((c) => c.passed) && pageErrors.length === 0;

    // Write results.json
    const summary = {
      task: 'R57-T036',
      page: '12 - Key Sequence Detection/index-START.html',
      walkthrough_file: '12 - Key Sequence Detection/WALKTHROUGH.md',
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
