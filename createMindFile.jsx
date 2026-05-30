import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const storage = admin.storage();
const db = admin.firestore();

export const compileGarmentTarget = onRequest({ memory: "2GiB", timeoutSeconds: 300 }, async (req, res) => {
    // Ensure we are processing a POST request with the required IDs
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const { merchantId, productLine, tempImageStoragePath } = req.body;

    if (!merchantId || !productLine || !tempImageStoragePath) {
        res.status(400).json({ error: "Missing required compilation parameters." });
        return;
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

        // 3. Inject an isolated HTML container running the MindAR compiler code
        // We pass the signed image URL straight to a client-side virtual browser script
        await page.setContent(`
      <html>
        <head>
          <script type="module">
            import { Compiler } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/src/image-target/compiler.js';
            
            window.runCompilation = async (imgUrl) => {
              const compiler = new Compiler();
              
              // Load image programmatically inside the virtual browser window
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = imgUrl;
              await new Promise((resolve) => img.onload = resolve);
              
              // Run MindAR's compiler engine 
              await compiler.compileImageTargets([img]);
              const buffer = await compiler.exportData();
              
              // Convert the Uint8Array array buffer back to a standard array for Puppeteer transfer
              return Array.from(new Uint8Array(buffer));
            };
          </script>
        </head>
        <body></body>
      </html>
    `);

        // 4. Execute the compilation logic inside the virtual browser scope
        console.log(`Compiling fabric typography tracking coordinates for ${productLine}...`);
        const compiledArrayBuffer = await page.evaluate(async (url) => {
            return await (window as any).runCompilation(url);
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

        res.status(200).json({
            success: true,
            mindFilePath: destinationPath
        });

    } catch (error) {
        console.error("Compilation Failure:", error);
        res.status(500).json({ error: "Failed to compile image target on server." });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
});