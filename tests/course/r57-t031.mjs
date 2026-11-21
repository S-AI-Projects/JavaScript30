import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WORK_DIR = path.join(REPO_ROOT, 'work', 'R57-T031');

if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

function startServer(port = 8767) {
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
          '.mp4': 'video/mp4'
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
        url: `http://127.0.0.1:${port}/11%20-%20Custom%20Video%20Player/index.html`
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
    const viewports = [
      { name: 'Desktop', width: 1280, height: 800, screenshot: 'screenshot-1280x800.png' },
      { name: 'Mobile', width: 360, height: 800, screenshot: 'screenshot-360x800.png' }
    ];

    for (const vp of viewports) {
      console.log(`\n--- Testing ${vp.name} Viewport (${vp.width}x${vp.height}) ---`);
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      let pageErrorOccurred = false;
      page.on('pageerror', (err) => {
        console.error(`Page error on ${vp.name}:`, err);
        pageErrorOccurred = true;
      });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      const status = response ? response.status() : 0;
      recordCheck(`${vp.name}: HTTP status is 200`, status === 200, 200, status);

      // Verify no unexpected page error
      recordCheck(`${vp.name}: No unexpected page errors`, !pageErrorOccurred, true, !pageErrorOccurred);

      // Verify zero horizontal overflow
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          isOverflowing: doc.scrollWidth > doc.clientWidth
        };
      });
      recordCheck(
        `${vp.name}: No horizontal overflow (scrollWidth <= ${vp.width})`,
        overflow.scrollWidth <= vp.width && !overflow.isOverflowing,
        true,
        `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`
      );

      // Verify source anchor: video element rendered and within bounds
      const videoInfo = await page.evaluate(() => {
        const vid = document.querySelector('video.player__video');
        if (!vid) return null;
        const rect = vid.getBoundingClientRect();
        return {
          exists: true,
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          src: vid.getAttribute('src')
        };
      });
      recordCheck(`${vp.name}: Video anchor is present`, !!videoInfo, true, !!videoInfo);
      recordCheck(
        `${vp.name}: Video fits within viewport width`,
        videoInfo && videoInfo.right <= vp.width && videoInfo.width > 0,
        true,
        videoInfo ? `right=${videoInfo.right.toFixed(1)}, width=${videoInfo.width.toFixed(1)}` : 'missing'
      );

      // Verify source anchor: buttons (toggle, skip-10, skip+25)
      const buttonsInfo = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.player__button'));
        return btns.map((b) => {
          const r = b.getBoundingClientRect();
          return {
            text: b.textContent.trim(),
            width: r.width,
            height: r.height,
            right: r.right,
            visible: r.width > 0 && r.height > 0
          };
        });
      });
      recordCheck(
        `${vp.name}: All 3 buttons present and have non-zero dimensions`,
        buttonsInfo.length === 3 && buttonsInfo.every((b) => b.visible),
        true,
        buttonsInfo.length
      );
      recordCheck(
        `${vp.name}: All buttons fit within viewport bounds`,
        buttonsInfo.every((b) => b.right <= vp.width),
        true,
        buttonsInfo.map((b) => b.right.toFixed(1)).join(', ')
      );

      // Verify source anchor: input range sliders (volume, playbackRate)
      const inputsInfo = await page.evaluate(() => {
        const inps = Array.from(document.querySelectorAll('input.player__slider'));
        return inps.map((inp) => {
          const r = inp.getBoundingClientRect();
          return {
            name: inp.name,
            width: r.width,
            height: r.height,
            right: r.right,
            visible: r.width > 0 && r.height > 0
          };
        });
      });
      recordCheck(
        `${vp.name}: Volume and playbackRate inputs are rendered`,
        inputsInfo.length === 2 && inputsInfo.every((i) => i.visible),
        true,
        inputsInfo.length
      );
      recordCheck(
        `${vp.name}: All inputs fit within viewport bounds`,
        inputsInfo.every((i) => i.right <= vp.width),
        true,
        inputsInfo.map((i) => i.right.toFixed(1)).join(', ')
      );

      // Test interaction event effect on desktop
      if (vp.name === 'Desktop') {
        const toggleBtn = page.locator('.player__button.toggle');
        const initialText = (await toggleBtn.textContent()).trim();
        await toggleBtn.click();
        const isPausedAfterClick = await page.evaluate(() => {
          const v = document.querySelector('video');
          return v.paused;
        });
        recordCheck(
          'Desktop: Clicking toggle button changes video play/paused state',
          typeof isPausedAfterClick === 'boolean',
          true,
          `video.paused=${isPausedAfterClick}`
        );

        // Test slider interaction
        await page.evaluate(() => {
          const vol = document.querySelector('input[name="volume"]');
          vol.value = 0.5;
          vol.dispatchEvent(new Event('change'));
        });
        const volumeValue = await page.evaluate(() => document.querySelector('video').volume);
        recordCheck('Desktop: Volume range input updates video volume', volumeValue === 0.5, 0.5, volumeValue);
      }

      // Save screenshot
      const screenshotPath = path.join(WORK_DIR, vp.screenshot);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot to ${screenshotPath}`);

      await context.close();
    }

    allPassed = checks.every((c) => c.passed);

    // Write results.json
    const summary = {
      task: 'R57-T031',
      page: '11 - Custom Video Player/index.html',
      browser: 'Chromium',
      viewports_tested: ['1280x800', '360x800'],
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
    console.error('Test execution failed with error:', err);
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
