const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const { admin, generateSignedUrl } = require("./services/storageService");

// Initialize Firestore
const db = admin.firestore();

// Wrap an Express app to utilize clean REST parameters
const app = express();
// Enable CORS for all routes and origins
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * GET /s/:batchId
 * The core routing endpoint for The Loom. It takes a scanned batch ID, 
 * resolves the active digital asset for that batch's merchant, and returns the payload.
 */
app.get("/s/:batchId", async (req, res) => {
  const { batchId } = req.params;

  try {
    // Step 1: Read the batch document to find the physical tracking config
    const batchRef = db.collection("batches").doc(batchId);
    const batchSnap = await batchRef.get();

    if (!batchSnap.exists) {
      return res.status(404).json({ error: "Batch not found or invalid QR code." });
    }

    const batchData = batchSnap.data();
    const { merchant_id, mind_file_path } = batchData;

    if (!merchant_id || !mind_file_path) {
      return res.status(500).json({ error: "Batch configuration is incomplete." });
    }

    // Step 2: Determine GLTF path
    let gltf_file_path = null;

    // First, check the merchant's master switch setting
    const merchantRef = db.collection("merchants").doc(merchant_id);
    const merchantSnap = await merchantRef.get();

    if (merchantSnap.exists) {
      const merchantData = merchantSnap.data();
      const { is_masterSwitch_active, master_switch_asset_id } = merchantData;

      if (is_masterSwitch_active && master_switch_asset_id) {
        // Master switch overrides individual batch/asset settings
        const masterAssetRef = db.collection("assets").doc(master_switch_asset_id);
        const masterAssetSnap = await masterAssetRef.get();

        if (masterAssetSnap.exists) {
          gltf_file_path = masterAssetSnap.data().gltf_file_path;
        }
      }
    }

    // Second, if master switch is inactive or didn't resolve, try to find an asset with the same ID as the batch
    if (!gltf_file_path) {
      const assetRef = db.collection("assets").doc(batchId);
      const assetSnap = await assetRef.get();
      if (assetSnap.exists && assetSnap.data().gltf_file_path) {
        gltf_file_path = assetSnap.data().gltf_file_path;
      }
    }

    // Third, fallback to the batch document itself (for legacy batches)
    if (!gltf_file_path && batchData.gltf_file_path) {
      gltf_file_path = batchData.gltf_file_path;
    }

    if (!gltf_file_path) {
      return res.status(500).json({ error: "Asset configuration is incomplete (missing model path)." });
    }

    // Step 4: Generate signed URLs in parallel for performance optimization
    const [mindFileUrl, gltfFileUrl] = await Promise.all([
      generateSignedUrl(mind_file_path),
      generateSignedUrl(gltf_file_path)
    ]);

    // Pass the ar_config from batchData if it exists
    const arConfig = batchData.ar_config || {};

    // Step 5: Return structured JSON payload to the client-side shell
    return res.status(200).json({
      trackingConfig: {
        mindUrl: mindFileUrl
      },
      arExperience: {
        modelUrl: gltfFileUrl,
        // Send the full ar_config directly
        config: arConfig
      }
    });

  } catch (error) {
    console.error(`Error routing batch ${batchId}:`, error);
    return res.status(500).json({ error: "Internal server error during AR routing." });
  }
});

// Wrap the Express app using Firebase Functions v2 for deployment
const loomRouter = onRequest({
  // Memory optimization for fast cold starts
  memory: '256MiB',
  // Concurrency controls could be added here if using a higher memory tier
  minInstances: 0,
  maxInstances: 100,
}, app);

module.exports = { loomRouter };
