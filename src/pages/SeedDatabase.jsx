import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

const SeedDatabase = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs((prev) => [...prev, message]);
  };

  const seedDatabase = async () => {
    setLoading(true);
    setLogs([]);
    addLog("Starting Star weAR Database Seed...");

    try {
      // 1. Seed the Merchant Document
      const merchantId = "merch_4d4";
      await setDoc(doc(db, 'merchants', merchantId), {
        name: "4D4 Technologies",
        is_masterSwitch_active: false,
        master_switch_asset_id: "asset_hologram_1" // Currently active AR skin
      });
      addLog(`✅ Seeded Merchant: ${merchantId}`);

      // 2. Seed the Asset Document
      const assetId = "asset_hologram_1";
      await setDoc(doc(db, 'assets', assetId), {
        merchant_id: merchantId,
        gltf_file_path: `assets/${assetId}/model.glb`,
        revenue_tier: "STANDARD" // Used for Stripe splits in The Vault
      });
      addLog(`✅ Seeded Asset: ${assetId}`);

      // 3. Seed the Batch Document
      const batchId = "TEST_BATCH_001";
      await setDoc(doc(db, 'batches', batchId), {
        merchant_id: merchantId,
        mind_file_path: `anchors/${merchantId}/test_jacket.mind`,
        ar_config: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.5,
          dir1Color: '#ffffff',
          dir1Intensity: 2.5,
          dir1Position: '1 2 1',
          dir2Color: '#ffffff',
          dir2Intensity: 1.0,
          dir2Position: '-1 -2 -1',
          modelScale: 0.4,
          modelRotSpeed: 10000,
          modelRotX: 90,
          modelRotY: 0,
          modelRotZ: 0,
          matMetalness: 0.0,
          matRoughness: 1.0,
          matEmissive: '#000000',
          matEmissiveIntensity: 0.0,
          matWireframe: false,
          matOpacity: 1.0,
          fogColor: '#000000',
          fogDensity: 0.0,
          showBuyButton: false,
          buyButtonColor: '#e11d48'
        }
      });
      addLog(`✅ Seeded Batch: ${batchId}`);

      addLog("🎉 Seeding Complete! The Loom is ready to route.");
      addLog(`Try hitting your endpoint: GET /s/${batchId}`);
    } catch (error) {
      console.error("❌ Error seeding database:", error);
      addLog(`❌ Error seeding database: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-light tracking-wide mb-6">Database Seeder</h1>
        <p className="text-neutral-400 mb-8">
          Run this script to populate your Firestore with the required test documents for The Loom routing engine (Phase 1 Bulk Logic).
        </p>

        <button
          onClick={seedDatabase}
          disabled={loading}
          className="bg-white text-black px-6 py-3 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Seeding...' : 'Seed Database'}
        </button>

        {logs.length > 0 && (
          <div className="mt-8 bg-neutral-900 p-6 border border-neutral-800 font-mono text-sm">
            <h2 className="text-neutral-500 mb-4 uppercase tracking-widest text-xs">Execution Logs</h2>
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-neutral-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeedDatabase;
