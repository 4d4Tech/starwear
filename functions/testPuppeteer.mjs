import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

(async () => {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    try {
        await page.goto('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/');
        
        const type = await page.evaluate(async () => {
            const { Compiler } = await import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/src/image-target/compiler.js');
            return typeof Compiler;
        });
        console.log("Compiler type:", type);
    } catch(e) {
        console.error(e);
    }
    await browser.close();
})();
