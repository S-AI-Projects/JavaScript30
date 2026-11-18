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

    // Launch context with reduced-motion emulated
    const context = await browser.newContext({
        colorScheme: 'light',
        reducedMotion: 'reduce'
    });
    const page = await context.newPage();

    page.on('pageerror', err => {
        console.error('Unexpected Page Error:', err);
        process.exit(1);
    });

    try {
        await page.goto('http://127.0.0.1:8080/23%20-%20Speech%20Synthesis/index-START.html');

        // Test 1: Verify keyboard focus visibility
        const firstButton = page.locator('button').first();
        await firstButton.focus();

        const outlineStyle = await firstButton.evaluate(el => window.getComputedStyle(el).outlineStyle);
        assert.notStrictEqual(outlineStyle, 'none', 'Focused controls must have a visible outline style for accessibility');

        // Test 2: Verify reduced motion disables CSS transitions
        const transitionDuration = await firstButton.evaluate(el => window.getComputedStyle(el).transitionDuration);
        assert.strictEqual(transitionDuration, '0s', 'Transitions must be disabled (0s) when prefers-reduced-motion is active');

        console.log('Success: All R57-T009 Accessibility (Motion/Focus) assertions passed.');
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
