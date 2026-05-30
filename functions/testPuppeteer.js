const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

(async () => {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    await page.setContent(`
        <html><body><script type="module">
        import { Compiler } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
        window.compiler = new Compiler();
        window.ready = true;
        </script></body></html>
    `);
    
    await page.waitForFunction('window.ready === true');
    console.log("Compiler loaded");
    await browser.close();
})();
