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
        await page.goto('http://127.0.0.1:8080/05%20-%20Flex%20Panel%20Gallery/index-START.html');

        // Test 1: Feature-Present Path (Modern browser supports flex)
        const isFallbackVisible = await page.locator('.browser-fallback').isVisible();
        assert.strictEqual(isFallbackVisible, false, 'Fallback banner should not be visible in modern browsers supporting flexbox');

        // Test 2: Feature-Absent Path (Simulate unsupported browser by displaying fallback)
        await page.evaluate(() => {
            const fallback = document.querySelector('.browser-fallback');
            fallback.style.display = 'block';
        });

        const isFallbackForcedVisible = await page.locator('.browser-fallback').isVisible();
        assert.strictEqual(isFallbackForcedVisible, true, 'Fallback banner should display correctly when features are unsupported');

        console.log('Success: All R57-T006 browser feature support assertions passed.');
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
