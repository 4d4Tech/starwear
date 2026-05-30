import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';

const AdminInventory = () => {
  const [search, setSearch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [glbFile, setGlbFile] = useState(null);
  const [targetImageFile, setTargetImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      // Fetching assets instead of products
      const assetsRef = collection(db, 'assets');
      const q = query(assetsRef);
      const snapshot = await getDocs(q);
      const fetchedAssets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventory(fetchedAssets);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!assetId || !assetName || !glbFile || !targetImageFile) {
      alert("Please fill in all required fields and upload both files.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload Target Image to Temp Storage
      setUploadStep('Uploading Target Image...');
      const tempImagePath = `temp_anchors/${assetId}_temp_${targetImageFile.name}`;
      const tempImageRef = ref(storage, tempImagePath);
      await uploadBytes(tempImageRef, targetImageFile);

      // 2. Call compileGarmentTarget function to build the .mind file
      setUploadStep('Compiling AR Target (This may take a minute)...');
      const compileGarmentTarget = httpsCallable(functions, 'compileGarmentTarget');
      const result = await compileGarmentTarget({
        merchantId: merchantId || 'default',
        productLine: assetId,
        tempImageStoragePath: tempImagePath
      });
      
      const mindPath = result.data.mindFilePath;

      // 3. Upload GLB File
      setUploadStep('Uploading 3D Model...');
      const glbPath = `assets/${assetId}/${glbFile.name}`;
      const glbRef = ref(storage, glbPath);
      await uploadBytes(glbRef, glbFile);

      // 4. Save to Firestore
      setUploadStep('Saving Asset Details...');
      await setDoc(doc(db, 'assets', assetId), {
        name: assetName,
        description: assetDescription,
        merchant_id: merchantId || 'default',
        gltf_file_path: glbPath,
        mind_file_path: mindPath,
        revenue_tier: "STANDARD",
        createdAt: new Date().toISOString()
      });

      // 5. Create associated Batch document
      setUploadStep('Creating Batch Document...');
      await setDoc(doc(db, 'batches', assetId), {
        merchant_id: merchantId || 'default',
        mind_file_path: mindPath,
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

      // Refresh inventory and close modal
      await fetchInventory();
      closeModal();
    } catch (error) {
      console.error("Error adding asset:", error);
      alert(`Failed to add asset: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setAssetId('');
    setAssetName('');
    setAssetDescription('');
    setMerchantId('');
    setGlbFile(null);
    setTargetImageFile(null);
    setUploadStep('');
  };

  const filteredInventory = inventory.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    item.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
        <div>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Asset Inventory</h2>
          <p className="text-secondary mt-2">Manage your AR assets and models.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto items-center">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-outline">search</span>
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-outline-variant focus:border-primary py-2 pl-10 pr-4 text-sm focus:outline-none transition-colors" 
              placeholder="Search assets..." 
              type="text" 
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-on-primary px-6 py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity font-label-caps text-label-caps whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            ADD ASSET
          </button>
        </div>
      </header>
      
      <section className="glass-panel rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-secondary font-label-caps text-xs">
                <th className="p-6 font-normal">ASSET NAME</th>
                <th className="p-6 font-normal">DOCUMENT ID</th>
                <th className="p-6 font-normal">MERCHANT ID</th>
                <th className="p-6 font-normal">MODEL PATH</th>
                <th className="p-6 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-secondary">
                    Loading assets...
                  </td>
                </tr>
              ) : filteredInventory.map((item) => (
                <tr key={item.id} className="border-b border-outline-variant/10 hover:bg-surface-variant/20 transition-colors">
                  <td className="p-6 font-bold">{item.name || 'Unnamed Asset'}</td>
                  <td className="p-6 text-secondary">{item.id}</td>
                  <td className="p-6 text-secondary">{item.merchant_id || 'N/A'}</td>
                  <td className="p-6 text-secondary text-xs truncate max-w-[200px]">{item.gltf_file_path || 'N/A'}</td>
                  <td className="p-6 text-right space-x-2">
                    <button className="text-secondary hover:text-primary transition-colors" title="Edit">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button className="text-secondary hover:text-error transition-colors" title="Delete">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-secondary">
                    No assets found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-outline-variant rounded-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 text-secondary hover:text-on-background transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h3 className="text-2xl font-light mb-6 text-on-background">Add New Asset</h3>
            
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Document ID (Asset ID) *</label>
                <input 
                  type="text" 
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="e.g., asset_hologram_1"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Asset Name *</label>
                <input 
                  type="text" 
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g., Standard Hologram"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Merchant ID</label>
                <input 
                  type="text" 
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="e.g., merch_4d4 (optional)"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Description</label>
                <textarea 
                  value={assetDescription}
                  onChange={(e) => setAssetDescription(e.target.value)}
                  placeholder="Describe the AR asset..."
                  rows="3"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">3D Model File (.glb, .gltf) *</label>
                <input 
                  type="file" 
                  accept=".glb,.gltf"
                  onChange={(e) => setGlbFile(e.target.files[0])}
                  className="w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Target Image (.jpg, .png) *</label>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png"
                  onChange={(e) => setTargetImageFile(e.target.files[0])}
                  className="w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 rounded text-secondary hover:bg-surface-variant transition-colors"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className="bg-primary text-on-primary px-6 py-2 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      {uploadStep || 'Uploading...'}
                    </>
                  ) : (
                    'Upload Asset'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminInventory;

