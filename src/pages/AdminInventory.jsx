import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';

const AdminInventory = () => {
  const [search, setSearch] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const [assetId, setAssetId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [assetPrice, setAssetPrice] = useState(99.00);
  const [merchantId, setMerchantId] = useState('');
  const [glbFile, setGlbFile] = useState(null);
  const [targetImageFile, setTargetImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pick3DModel = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: '3D Model (.glb, .gltf)',
            accept: {
              'model/gltf-binary': ['.glb'],
              'model/gltf+json': ['.gltf']
            }
          }],
          multiple: false
        });
        const file = await handle.getFile();
        if (file) setGlbFile(file);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn("showOpenFilePicker error, falling back to input:", err);
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        setGlbFile(e.target.files[0]);
      }
    };
    input.click();
  };

  const pickTargetImage = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Target Image',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.webp']
            }
          }],
          multiple: false
        });
        const file = await handle.getFile();
        if (file) setTargetImageFile(file);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn("showOpenFilePicker error, falling back to input:", err);
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        setTargetImageFile(e.target.files[0]);
      }
    };
    input.click();
  };

  const pickVideoFile = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Video Layer (.mp4, .webm, .mov)',
            accept: {
              'video/mp4': ['.mp4'],
              'video/webm': ['.webm'],
              'video/quicktime': ['.mov']
            }
          }],
          multiple: false
        });
        const file = await handle.getFile();
        if (file) setVideoFile(file);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn("showOpenFilePicker error, falling back to input:", err);
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';
    input.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        setVideoFile(e.target.files[0]);
      }
    };
    input.click();
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
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

  const openAddModal = () => {
    setEditingAsset(null);
    setAssetId('');
    setAssetName('');
    setAssetDescription('');
    setAssetPrice(99.00);
    setMerchantId('');
    setGlbFile(null);
    setTargetImageFile(null);
    setVideoFile(null);
    setUploadStep('');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingAsset(item);
    setAssetId(item.id);
    setAssetName(item.name || '');
    setAssetDescription(item.description || '');
    setAssetPrice(item.price !== undefined ? item.price : 99.00);
    setMerchantId(item.merchant_id || '');
    setGlbFile(null);
    setTargetImageFile(null);
    setVideoFile(null);
    setUploadStep('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAsset(null);
    setAssetId('');
    setAssetName('');
    setAssetDescription('');
    setAssetPrice(99.00);
    setMerchantId('');
    setGlbFile(null);
    setTargetImageFile(null);
    setVideoFile(null);
    setUploadStep('');
  };

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

      // 4. Upload Video Layer (Optional)
      let videoPath = '';
      let videoUrl = '';
      if (videoFile) {
        setUploadStep('Uploading Video Layer...');
        videoPath = `assets/${assetId}/${videoFile.name}`;
        const videoRef = ref(storage, videoPath);
        await uploadBytes(videoRef, videoFile);
        try {
          videoUrl = await getDownloadURL(videoRef);
        } catch {}
      }

      // 5. Save to Firestore assets collection
      setUploadStep('Saving Asset Details...');
      await setDoc(doc(db, 'assets', assetId), {
        name: assetName,
        description: assetDescription,
        price: Number(assetPrice) || 99.00,
        merchant_id: merchantId || 'default',
        gltf_file_path: glbPath,
        mind_file_path: mindPath,
        video_file_path: videoPath,
        video_url: videoUrl,
        videoUrl: videoUrl,
        revenue_tier: "STANDARD",
        createdAt: new Date().toISOString()
      });

      // 6. Create associated Batch document
      setUploadStep('Creating Batch Document...');
      await setDoc(doc(db, 'batches', assetId), {
        merchant_id: merchantId || 'default',
        mind_file_path: mindPath,
        video_file_path: videoPath,
        video_url: videoUrl,
        videoUrl: videoUrl,
        ar_config: {
          videoUrl: videoUrl,
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
          matMetalness: -1,
          matRoughness: -1,
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

  const handleEditAsset = async (e) => {
    e.preventDefault();
    if (!editingAsset) return;

    setUploading(true);
    try {
      let mindPath = editingAsset.mind_file_path || '';
      let glbPath = editingAsset.gltf_file_path || '';
      let videoPath = editingAsset.video_file_path || '';
      let videoUrl = editingAsset.video_url || editingAsset.videoUrl || '';

      // 1. Recompile Target Image if a new file is uploaded
      if (targetImageFile) {
        setUploadStep('Uploading New Target Image...');
        const tempImagePath = `temp_anchors/${editingAsset.id}_temp_${Date.now()}_${targetImageFile.name}`;
        const tempImageRef = ref(storage, tempImagePath);
        await uploadBytes(tempImageRef, targetImageFile);

        setUploadStep('Recompiling AR Target (This may take a minute)...');
        const compileGarmentTarget = httpsCallable(functions, 'compileGarmentTarget');
        const result = await compileGarmentTarget({
          merchantId: merchantId || 'default',
          productLine: editingAsset.id,
          tempImageStoragePath: tempImagePath
        });

        if (editingAsset.mind_file_path && editingAsset.mind_file_path !== result.data.mindFilePath) {
          try {
            await deleteObject(ref(storage, editingAsset.mind_file_path));
          } catch (err) {
            console.warn("Notice cleaning old mind file:", err.message);
          }
        }
        mindPath = result.data.mindFilePath;
      }

      // 2. Upload new GLB Model if a new file is provided
      if (glbFile) {
        setUploadStep('Uploading New 3D Model...');
        const newGlbPath = `assets/${editingAsset.id}/${glbFile.name}`;
        const glbRef = ref(storage, newGlbPath);
        await uploadBytes(glbRef, glbFile);

        if (editingAsset.gltf_file_path && editingAsset.gltf_file_path !== newGlbPath) {
          try {
            await deleteObject(ref(storage, editingAsset.gltf_file_path));
          } catch (err) {
            console.warn("Notice cleaning old GLB file:", err.message);
          }
        }
        glbPath = newGlbPath;
      }

      // 3. Upload new Video Layer if a new file is provided
      if (videoFile) {
        setUploadStep('Uploading New Video Layer...');
        const newVideoPath = `assets/${editingAsset.id}/${videoFile.name}`;
        const videoRef = ref(storage, newVideoPath);
        await uploadBytes(videoRef, videoFile);
        try {
          videoUrl = await getDownloadURL(videoRef);
        } catch {}

        if (editingAsset.video_file_path && editingAsset.video_file_path !== newVideoPath) {
          try {
            await deleteObject(ref(storage, editingAsset.video_file_path));
          } catch (err) {
            console.warn("Notice cleaning old video file:", err.message);
          }
        }
        videoPath = newVideoPath;
      }

      // 4. Update 'assets' Firestore Document
      setUploadStep('Updating Asset Details...');
      await updateDoc(doc(db, 'assets', editingAsset.id), {
        name: assetName,
        description: assetDescription,
        price: Number(assetPrice) || 99.00,
        merchant_id: merchantId || 'default',
        gltf_file_path: glbPath,
        mind_file_path: mindPath,
        video_file_path: videoPath,
        video_url: videoUrl,
        videoUrl: videoUrl,
        updatedAt: new Date().toISOString()
      });

      // 5. Update associated 'batches' Firestore Document
      setUploadStep('Updating Batch Details...');
      await setDoc(doc(db, 'batches', editingAsset.id), {
        merchant_id: merchantId || 'default',
        mind_file_path: mindPath,
        video_file_path: videoPath,
        video_url: videoUrl,
        videoUrl: videoUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await fetchInventory();
      closeModal();
    } catch (error) {
      console.error("Error updating asset:", error);
      alert(`Failed to update asset: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleSubmit = (e) => {
    if (editingAsset) {
      handleEditAsset(e);
    } else {
      handleAddAsset(e);
    }
  };

  const handleDeleteAsset = async (item) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete asset "${item.name || item.id}" (${item.id})?\n\nThis will permanently delete the database records and clear all associated files from Firebase Storage.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      // 1. Delete GLB Model file from Firebase Storage
      if (item.gltf_file_path) {
        try {
          const glbRef = ref(storage, item.gltf_file_path);
          await deleteObject(glbRef);
        } catch (storageErr) {
          console.warn("Storage GLB file deletion notice:", storageErr.message);
        }
      }

      // 2. Delete Compiled .mind file from Firebase Storage
      if (item.mind_file_path) {
        try {
          const mindRef = ref(storage, item.mind_file_path);
          await deleteObject(mindRef);
        } catch (storageErr) {
          console.warn("Storage MIND file deletion notice:", storageErr.message);
        }
      }

      // 3. Delete asset document from Firestore
      await deleteDoc(doc(db, 'assets', item.id));

      // 4. Delete associated batch document from Firestore
      try {
        await deleteDoc(doc(db, 'batches', item.id));
      } catch (batchErr) {
        console.warn("Batch document deletion notice:", batchErr.message);
      }

      await fetchInventory();
    } catch (error) {
      console.error("Error deleting asset:", error);
      alert(`Failed to delete asset: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
          <p className="text-secondary mt-2">Manage your AR assets, models, and target trackers.</p>
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
            onClick={openAddModal}
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
                <th className="p-6 font-normal">PRICE</th>
                <th className="p-6 font-normal">MERCHANT ID</th>
                <th className="p-6 font-normal">MODEL PATH</th>
                <th className="p-6 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-on-background">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-secondary">
                    Loading assets...
                  </td>
                </tr>
              ) : filteredInventory.map((item) => (
                <tr key={item.id} className="border-b border-outline-variant/10 hover:bg-surface-variant/20 transition-colors">
                  <td className="p-6 font-bold">{item.name || 'Unnamed Asset'}</td>
                  <td className="p-6 text-secondary font-mono text-xs">{item.id}</td>
                  <td className="p-6 font-semibold text-primary font-mono">
                    ${item.price !== undefined ? Number(item.price).toFixed(2) : '99.00'}
                  </td>
                  <td className="p-6 text-secondary">{item.merchant_id || 'N/A'}</td>
                  <td className="p-6 text-secondary text-xs truncate max-w-[200px] font-mono">{item.gltf_file_path || 'N/A'}</td>
                  <td className="p-6 text-right space-x-2">
                    <a
                      href={`/product/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-secondary hover:text-primary transition-colors p-1"
                      title="View in Storefront & 3D Canvas"
                    >
                      <span className="material-symbols-outlined text-[20px]">storefront</span>
                    </a>
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-secondary hover:text-primary transition-colors p-1 edit-asset"
                      title="Edit Asset"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(item)}
                      className="text-secondary hover:text-error transition-colors p-1 delete-asset"
                      title="Delete Asset"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-secondary">
                    No assets found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-outline-variant rounded-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-secondary hover:text-on-background transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-2xl font-light mb-6 text-on-background">
              {editingAsset ? 'Edit Asset' : 'Add New Asset'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="asset-id-input" className="block text-sm font-medium text-secondary mb-1">
                  Document ID (Asset ID) *
                </label>
                <input
                  id="asset-id-input"
                  name="assetId"
                  type="text"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="e.g., asset_hologram_1"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors disabled:opacity-50 font-mono text-sm"
                  disabled={!!editingAsset}
                  required
                />
                {editingAsset && (
                  <p className="text-xs text-secondary mt-1">Asset Document ID cannot be altered once created.</p>
                )}
              </div>

              <div>
                <label htmlFor="asset-name-input" className="block text-sm font-medium text-secondary mb-1">
                  Asset Name *
                </label>
                <input
                  id="asset-name-input"
                  name="assetName"
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g., Standard Hologram"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="asset-price-input" className="block text-sm font-medium text-secondary mb-1">
                  Retail Price ($ USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary font-mono">$</span>
                  <input
                    id="asset-price-input"
                    name="assetPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={assetPrice}
                    onChange={(e) => setAssetPrice(e.target.value)}
                    placeholder="99.00"
                    className="w-full bg-surface-variant border border-outline-variant rounded pl-8 pr-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="asset-merchant-id-input" className="block text-sm font-medium text-secondary mb-1">
                  Merchant ID
                </label>
                <input
                  id="asset-merchant-id-input"
                  name="merchantId"
                  type="text"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="e.g., merch_4d4 (optional)"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="asset-desc-input" className="block text-sm font-medium text-secondary mb-1">
                  Description
                </label>
                <textarea
                  id="asset-desc-input"
                  name="assetDescription"
                  value={assetDescription}
                  onChange={(e) => setAssetDescription(e.target.value)}
                  placeholder="Describe the AR asset..."
                  rows="3"
                  className="w-full bg-surface-variant border border-outline-variant rounded px-4 py-2 text-on-background focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* 3D Model File Input */}
              <div>
                <span className="block text-sm font-medium text-secondary mb-1.5">
                  3D Model File (.glb, .gltf) {!editingAsset && <span className="text-red-500">*</span>}
                </span>

                {glbFile ? (
                  <div className="flex items-center justify-between p-3.5 bg-surface-variant/50 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="material-symbols-outlined text-primary text-2xl">view_in_ar</span>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-on-background truncate">{glbFile.name}</p>
                        <p className="text-xs text-secondary">{formatFileSize(glbFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={pick3DModel}
                        className="text-xs font-medium text-primary hover:underline px-2 py-1 cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGlbFile(null);
                        }}
                        className="text-secondary hover:text-red-500 transition-colors p-1 cursor-pointer"
                        title="Remove file"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={pick3DModel}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        setGlbFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-outline-variant hover:border-primary rounded-lg p-5 text-center bg-surface-variant/20 hover:bg-surface-variant/40 transition-all cursor-pointer group flex flex-col items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-3xl text-secondary group-hover:text-primary transition-colors mb-1">
                      view_in_ar
                    </span>
                    <p className="text-sm font-medium text-on-background">Click to choose or drop 3D Model</p>
                    <p className="text-xs text-secondary mt-0.5 mb-2.5">Supports .glb, .gltf files</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pick3DModel();
                      }}
                      className="bg-surface-variant hover:bg-surface-variant/80 text-primary border border-outline-variant/60 font-medium text-xs px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">folder_open</span>
                      Browse 3D Model
                    </button>
                    {editingAsset && (
                      <p className="text-xs text-secondary mt-2 border-t border-outline-variant/30 pt-1.5 font-mono truncate w-full text-center">
                        Current: {editingAsset.gltf_file_path || 'None'} (Click to replace)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Target Image File Input */}
              <div>
                <span className="block text-sm font-medium text-secondary mb-1.5">
                  Target Image (.jpg, .png) {!editingAsset && <span className="text-red-500">*</span>}
                </span>

                {targetImageFile ? (
                  <div className="flex items-center justify-between p-3.5 bg-surface-variant/50 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="material-symbols-outlined text-primary text-2xl">image</span>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-on-background truncate">{targetImageFile.name}</p>
                        <p className="text-xs text-secondary">{formatFileSize(targetImageFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={pickTargetImage}
                        className="text-xs font-medium text-primary hover:underline px-2 py-1 cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetImageFile(null);
                        }}
                        className="text-secondary hover:text-red-500 transition-colors p-1 cursor-pointer"
                        title="Remove file"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={pickTargetImage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        setTargetImageFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-outline-variant hover:border-primary rounded-lg p-5 text-center bg-surface-variant/20 hover:bg-surface-variant/40 transition-all cursor-pointer group flex flex-col items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-3xl text-secondary group-hover:text-primary transition-colors mb-1">
                      add_photo_alternate
                    </span>
                    <p className="text-sm font-medium text-on-background">Click to choose or drop Target Image</p>
                    <p className="text-xs text-secondary mt-0.5 mb-2.5">Supports high-contrast .png, .jpg, .jpeg</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickTargetImage();
                      }}
                      className="bg-surface-variant hover:bg-surface-variant/80 text-primary border border-outline-variant/60 font-medium text-xs px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">folder_open</span>
                      Browse Image
                    </button>
                    {editingAsset && (
                      <p className="text-xs text-secondary mt-2 border-t border-outline-variant/30 pt-1.5 font-mono truncate w-full text-center">
                        Current Target: {editingAsset.mind_file_path || 'None'} (Click to replace)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Video Layer File Input (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-medium text-secondary">
                    Video Layer (.mp4, .webm, .mov) <span className="text-xs text-secondary/70 font-normal">(Optional)</span>
                  </span>
                  {editingAsset?.video_url && (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">videocam</span> Active Video Layer
                    </span>
                  )}
                </div>

                {videoFile ? (
                  <div className="flex items-center justify-between p-3.5 bg-surface-variant/50 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="material-symbols-outlined text-primary text-2xl">movie</span>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-on-background truncate">{videoFile.name}</p>
                        <p className="text-xs text-secondary">{formatFileSize(videoFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={pickVideoFile}
                        className="text-xs font-medium text-primary hover:underline px-2 py-1 cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoFile(null);
                        }}
                        className="text-secondary hover:text-red-500 transition-colors p-1 cursor-pointer"
                        title="Remove file"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={pickVideoFile}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        setVideoFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-outline-variant hover:border-primary rounded-lg p-5 text-center bg-surface-variant/20 hover:bg-surface-variant/40 transition-all cursor-pointer group flex flex-col items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-3xl text-secondary group-hover:text-primary transition-colors mb-1">
                      video_file
                    </span>
                    <p className="text-sm font-medium text-on-background">Click to choose or drop Video Layer</p>
                    <p className="text-xs text-secondary mt-0.5 mb-2.5">Supports high-res .mp4, .webm, .mov (auto-loops on 3D meshes)</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickVideoFile();
                      }}
                      className="bg-surface-variant hover:bg-surface-variant/80 text-primary border border-outline-variant/60 font-medium text-xs px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">folder_open</span>
                      Browse Video
                    </button>
                    {editingAsset && (
                      <p className="text-xs text-secondary mt-2 border-t border-outline-variant/30 pt-1.5 font-mono truncate w-full text-center">
                        Current Video: {editingAsset.video_file_path || editingAsset.video_url || 'None'} (Click to replace)
                      </p>
                    )}
                  </div>
                )}
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
                      {uploadStep || (editingAsset ? 'Saving...' : 'Uploading...')}
                    </>
                  ) : (
                    editingAsset ? 'Save Changes' : 'Upload Asset'
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
