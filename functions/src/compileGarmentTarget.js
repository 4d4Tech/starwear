const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./services/storageService");
const chromium = require("@sparticuz/chromium");

const storage = admin.storage();

exports.compileGarmentTarget = onCall({ memory: "2GiB", timeoutSeconds: 300 }, async (request) => {
    const { merchantId, productLine, tempImageStoragePath } = request.data;

    // Dynamically import ES Module
    const puppeteer = (await import("puppeteer-core")).default;

    if (!merchantId || !productLine || !tempImageStoragePath) {
        throw new HttpsError('invalid-argument', "Missing required compilation parameters.");
    }

    let browser = null;

    try {
        // 1. Get a temporary public read URL for the uploaded merchant asset image
        const bucket = storage.bucket();
        const [imageUrl] = await bucket.file(tempImageStoragePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000 // 15 minutes
        });

        // 2. Launch headless Chromium within the serverless instance
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        
        // Listen to console and errors from the headless browser
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.error('BROWSER ERROR:', err.message || err));

        // 3. Inject an isolated HTML container running the MindAR compiler code
        await page.setContent(`
      <html>
        <head>
          <script type="module">
            import { Compiler } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
            
            window.runCompilation = async (imgUrl) => {
              const compiler = new Compiler();
              
              // Load image programmatically inside the virtual browser window
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = imgUrl;
              await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = () => reject(new Error("Failed to load image in browser context"));
              });
              
              // Run MindAR's compiler engine with a progress callback
              await compiler.compileImageTargets([img], (progress) => {
                  console.log("Compilation progress:", progress);
              });
              const buffer = await compiler.exportData();
              
              // Convert the Uint8Array array buffer back to a standard array for Puppeteer transfer
              return Array.from(new Uint8Array(buffer));
            };
            window.scriptLoaded = true;
          </script>
        </head>
        <body></body>
      </html>
    `);

        // Wait for the script to attach
        await page.waitForFunction('window.scriptLoaded === true', { timeout: 10000 });

        // 4. Execute the compilation logic inside the virtual browser scope
        console.log(`Compiling fabric typography tracking coordinates for ${productLine}...`);
        const compiledArrayBuffer = await page.evaluate(async (url) => {
            return await window.runCompilation(url);
        }, imageUrl);

        // Convert the returned array back to a Node.js binary Buffer object
        const finalMindBuffer = Buffer.from(compiledArrayBuffer);

        // 5. Stream the compiled .mind file straight to its permanent home in Storage
        const destinationPath = `anchors/${merchantId}/${productLine}.mind`;
        const mindFileRef = bucket.file(destinationPath);

        await mindFileRef.save(finalMindBuffer, {
            contentType: "application/octet-stream",
            metadata: { cacheControl: "public, max-age=31536000" }
        });

        console.log(`✅ Compilation successful! Saved target to: ${destinationPath}`);

        // Clean up the temporary uploaded flat image file to keep storage tidy
        await bucket.file(tempImageStoragePath).delete().catch(() => null);

        return {
            success: true,
            mindFilePath: destinationPath
        };

    } catch (error) {
        console.error("Compilation Failure:", error);
        throw new HttpsError('internal', "Failed to compile image target on server.");
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
});
