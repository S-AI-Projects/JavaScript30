import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';

(async () => {
    const server = spawn('npx', ['http-server', '.', '-p', '8080', '-a', '127.0.0.1', '-s'], { detached: true });

    // Poll for server readiness
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch('http://127.0.0.1:8080');
            if (res.ok) break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('pageerror', err => {
        console.error('Unexpected Page Error:', err);
        process.exit(1);
    });

    try {
        // Force deterministic testing: block ALL external network requests
        await page.route('**/*', route => {
            const url = route.request().url();
            if (url.startsWith('http://127.0.0.1:8080') || url.startsWith('http://localhost:8080') || url.startsWith('data:')) {
                route.continue();
            } else {
                route.abort(); // Block external requests
            }
        });

        await page.goto('http://127.0.0.1:8080/13%20-%20Slide%20in%20on%20Scroll/index-START.html');

        // Scroll to trigger slide-in logic
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500); // Wait for scroll debounce

        // Assert all images loaded locally without external dependencies
        const imagesLoaded = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('.slide-in'));
            return images.every(img => img.complete && img.naturalHeight !== 0);
        });

        assert.strictEqual(imagesLoaded, true, 'All images should load successfully from local deterministic fixtures');

        console.log('Success: All R57-T005 deterministic browser test assertions passed.');
        process.exit(0);
    } catch (error) {
        console.error('Assertion failure:', error);
        process.exit(1);
    } finally {
        await browser.close();
        try {
            process.kill(-server.pid);
        } catch (e) {}
    }
})();
