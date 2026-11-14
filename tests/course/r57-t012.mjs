import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const PORT = 8766;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_PATH = '/28%20-%20Video%20Speed%20Controller/index-START.html';
const WORK_DIR = path.join(rootDir, 'work', 'R57-T012');

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

    // Mock external assets to avoid network flakiness
    const context = await browser.newContext();
    await context.route('**/*.mp4', (route) => {
      route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('') });
    });
    await context.route('**/unsplash.it/**', (route) => {
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('') });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // ==========================================
    // 1. TEST AT 1280 x 800 (Desktop Viewport)
    // ==========================================
    await page.setViewportSize({ width: 1280, height: 800 });
    const response1280 = await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'domcontentloaded' });
    record('Desktop (1280px) page responds with HTTP 200', 200, response1280.status(), response1280.status() === 200);

    const desktopLayout = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const wrapperRect = document.querySelector('.wrapper').getBoundingClientRect();
      const videoRect = document.querySelector('video').getBoundingClientRect();
      const speedRect = document.querySelector('.speed').getBoundingClientRect();

      return {
        docWidth,
        scrollWidth,
        wrapperWidth: Math.round(wrapperRect.width),
        wrapperRight: Math.round(wrapperRect.right),
        videoVisible: videoRect.width > 0 && videoRect.height > 0,
        speedVisible: speedRect.width > 0 && speedRect.height > 0,
        speedRight: Math.round(speedRect.right)
      };
    });

    record('Desktop: No horizontal overflow (scrollWidth <= 1280)', true, desktopLayout.scrollWidth <= 1280, desktopLayout.scrollWidth <= 1280);
    record('Desktop: Video is rendered and visible', true, desktopLayout.videoVisible, desktopLayout.videoVisible === true);
    record('Desktop: Speed bar is rendered and visible', true, desktopLayout.speedVisible, desktopLayout.speedVisible === true);
    record('Desktop: Speed bar not clipped off-screen', true, desktopLayout.speedRight <= 1280, desktopLayout.speedRight <= 1280);

    const screenshotDesktopPath = path.join(WORK_DIR, 'screenshot-1280x800.png');
    await page.screenshot({ path: screenshotDesktopPath });
    console.log(`Saved desktop screenshot: ${screenshotDesktopPath}`);

    // ==========================================
    // 2. TEST AT 360 x 800 (Mobile Viewport)
    // ==========================================
    await page.setViewportSize({ width: 360, height: 800 });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const mobileLayout = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const wrapperRect = document.querySelector('.wrapper').getBoundingClientRect();
      const videoRect = document.querySelector('video').getBoundingClientRect();
      const speedRect = document.querySelector('.speed').getBoundingClientRect();

      return {
        docWidth,
        scrollWidth,
        wrapperWidth: Math.round(wrapperRect.width),
        wrapperRight: Math.round(wrapperRect.right),
        videoWidth: Math.round(videoRect.width),
        videoRight: Math.round(videoRect.right),
        speedWidth: Math.round(speedRect.width),
        speedRight: Math.round(speedRect.right),
        videoVisible: videoRect.width > 0 && videoRect.height > 0,
        speedVisible: speedRect.width > 0 && speedRect.height > 0
      };
    });

    record('Mobile (360px): No horizontal overflow (scrollWidth <= 360)', true, mobileLayout.scrollWidth <= 360, mobileLayout.scrollWidth <= 360);
    record('Mobile (360px): Wrapper fits within viewport (wrapperRight <= 360)', true, mobileLayout.wrapperRight <= 360, mobileLayout.wrapperRight <= 360);
    record('Mobile (360px): Video fits within viewport (videoRight <= 360)', true, mobileLayout.videoRight <= 360, mobileLayout.videoRight <= 360);
    record('Mobile (360px): Speed bar remains visible and on-screen (speedRight <= 360)', true, mobileLayout.speedRight <= 360, mobileLayout.speedRight <= 360);
    record('Mobile (360px): Both controls have non-zero dimensions', true, mobileLayout.videoVisible && mobileLayout.speedVisible, mobileLayout.videoVisible && mobileLayout.speedVisible);

    const screenshotMobilePath = path.join(WORK_DIR, 'screenshot-360x800.png');
    await page.screenshot({ path: screenshotMobilePath });
    console.log(`Saved mobile screenshot: ${screenshotMobilePath}`);

    // 3. Test interaction on mobile/desktop
    const scrubberWorks = await page.evaluate(() => {
      const speed = document.querySelector('.speed');
      const bar = document.querySelector('.speed-bar');
      const rect = speed.getBoundingClientRect();
      const event = new MouseEvent('mousemove', {
        clientY: rect.top + rect.height * 0.5,
        bubbles: true
      });
      speed.dispatchEvent(event);
      return bar.textContent.includes('×');
    });
    record('Speed scrubber updates playback rate text on mousemove', true, scrubberWorks, scrubberWorks === true);

    record('No unhandled page errors', 0, pageErrors.length, pageErrors.length === 0);

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
      task: 'R57-T012',
      page: `${BASE_URL}${TARGET_PATH}`,
      browser: 'Chromium',
      viewports_tested: ['1280x800', '360x800'],
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
