/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  createDefaultMarkerDataUrl,
  getImageDimensions,
  loadMarkerForBatch,
  resolveMarkerToFile
} from '../utils/markerHelper';

/**
 * Generates high-contrast, feature-rich procedural calibration marker presets
 * optimized for MindAR natural feature tracking.
 */
function buildProceduralPresetMarkers() {
  if (typeof document === 'undefined') return [];

  const presets = [];

  // Preset 1: Classic STAR weAR Calibration Marker
  const classic = createDefaultMarkerDataUrl('STAR weAR');
  if (classic?.dataUrl) {
    presets.push({
      id: 'preset_classic',
      name: 'STAR weAR Classic Grid',
      subtitle: `${classic.width}×${classic.height}px • Calibration`,
      imageUrl: classic.dataUrl,
      source: 'preset'
    });
  }

  // Preset 2: Asymmetric Cyber Geometric Crest (high corner density for MindAR)
  try {
    const c2 = document.createElement('canvas');
    c2.width = 640;
    c2.height = 640;
    const ctx = c2.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 640, 640);

      // Outer asymmetric fiducial border
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.strokeRect(24, 24, 592, 592);

      // Unique corner fiducials (each corner distinct so orientation is unambiguous)
      const drawCornerBox = (x, y, color, rings) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        for (let r = 0; r < rings; r++) {
          const inset = r * 16;
          ctx.strokeRect(x + inset, y + inset, 96 - inset * 2, 96 - inset * 2);
        }
        ctx.fillStyle = color;
        ctx.fillRect(x + 38, y + 38, 20, 20);
      };
      drawCornerBox(48, 48, '#10b981', 3);
      drawCornerBox(496, 48, '#f59e0b', 2);
      drawCornerBox(48, 496, '#ec4899', 2);

      // Bottom-right triangular fiducial for 100% rotational asymmetry
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(544, 496);
      ctx.lineTo(592, 592);
      ctx.lineTo(496, 592);
      ctx.closePath();
      ctx.fill();

      // Deterministic pseudo-random high-contrast geometric scatter inside center
      let seed = 42197;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const palette = ['#ffffff', '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#818cf8'];
      for (let i = 0; i < 65; i++) {
        const cx = 155 + rand() * 330;
        const cy = 155 + rand() * 330;
        const sz = 10 + rand() * 28;
        ctx.fillStyle = palette[i % palette.length];
        if (i % 3 === 0) {
          ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz * (0.5 + rand()));
        } else if (i % 3 === 1) {
          ctx.beginPath();
          ctx.moveTo(cx, cy - sz / 2);
          ctx.lineTo(cx + sz / 2, cy + sz / 2);
          ctx.lineTo(cx - sz / 2, cy + sz / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeStyle = palette[(i + 2) % palette.length];
          ctx.lineWidth = 4;
          ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
        }
      }

      // Center emblem banner
      ctx.fillStyle = '#090d16';
      ctx.fillRect(170, 276, 300, 88);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(170, 276, 300, 88);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STAR weAR', 320, 312);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CREST ANCHOR V2', 320, 344);

      presets.push({
        id: 'preset_cyber_crest',
        name: 'Cyber Geometric Crest',
        subtitle: '640×640px • Square 1:1',
        imageUrl: c2.toDataURL('image/png'),
        source: 'preset'
      });
    }
  } catch (err) {
    console.warn('[MarkerPresets] Could not build Cyber Crest preset:', err);
  }

  // Preset 3: Portrait Poster / Garment Tag Target (3:4 aspect)
  try {
    const c3 = document.createElement('canvas');
    c3.width = 540;
    c3.height = 720;
    const ctx = c3.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 540, 720);

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, 500, 680);

      // Stepped architectural bars for dense multi-scale FAST/ORB keypoints
      let s = 9001;
      const nextR = () => {
        s = (s * 48271) % 2147483647;
        return (s - 1) / 2147483646;
      };
      for (let row = 0; row < 11; row++) {
        for (let col = 0; col < 8; col++) {
          if (row >= 4 && row <= 6 && col >= 1 && col <= 6) continue;
          const x = 44 + col * 58;
          const y = 44 + row * 58;
          const v = nextR();
          ctx.fillStyle = v > 0.65 ? '#f8fafc' : v > 0.35 ? '#2dd4bf' : '#6366f1';
          if (v > 0.2) {
            const w = 16 + Math.floor(nextR() * 32);
            const h = 16 + Math.floor(nextR() * 32);
            ctx.fillRect(x, y, w, h);
          }
        }
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(85, 290, 370, 140);
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 5;
      ctx.strokeRect(85, 290, 370, 140);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AR STUDIO', 270, 344);
      ctx.fillStyle = '#2dd4bf';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('PORTRAIT ANCHOR • 3:4', 270, 392);

      presets.push({
        id: 'preset_portrait_matrix',
        name: 'Portrait Feature Matrix',
        subtitle: '540×720px • Portrait 3:4',
        imageUrl: c3.toDataURL('image/png'),
        source: 'preset'
      });
    }
  } catch (err) {
    console.warn('[MarkerPresets] Could not build Portrait Matrix preset:', err);
  }

  return presets;
}

/**
 * Reusable Marker Library Selector allowing users in either the Tracking tab
 * or the Save As modal to pick an existing Inventory marker image or a high-contrast preset.
 */
export const MarkerLibrarySelector = ({ onSelectMarker, onClose, compact = false }) => {
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [selectingId, setSelectingId] = useState(null);
  const [inventoryMarkers, setInventoryMarkers] = useState([]);
  const [presets] = useState(() => buildProceduralPresetMarkers());

  useEffect(() => {
    let cancelled = false;
    const loadInventoryMarkers = async () => {
      setLoadingLibrary(true);
      try {
        const snap = await getDocs(collection(db, 'assets'));
        const candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const resolved = [];
        // Resolve up to 16 inventory items in parallel batches
        const slice = candidates.slice(0, 16);
        await Promise.all(
          slice.map(async (item) => {
            try {
              const directUrl =
                item.markerImageUrl ||
                item.marker_image_url ||
                item.ar_config?.markerConfig?.imageUrl ||
                '';

              if (directUrl && (directUrl.startsWith('http') || directUrl.startsWith('data:'))) {
                resolved.push({
                  id: item.id,
                  name: item.name || item.id,
                  subtitle: `Batch: ${item.id}`,
                  imageUrl: directUrl,
                  storagePath: item.marker_file_path || '',
                  source: 'inventory'
                });
                return;
              }

              if (item.marker_file_path && !item.marker_file_path.startsWith('http')) {
                const dl = await getDownloadURL(ref(storage, item.marker_file_path));
                if (dl) {
                  resolved.push({
                    id: item.id,
                    name: item.name || item.id,
                    subtitle: `Batch: ${item.id}`,
                    imageUrl: dl,
                    storagePath: item.marker_file_path,
                    source: 'inventory'
                  });
                  return;
                }
              }

              if (item.mind_file_path) {
                const extracted = await loadMarkerForBatch({
                  batchId: item.id,
                  assetData: item,
                  mindFilePath: item.mind_file_path
                });
                if (extracted?.dataUrl && extracted.source !== 'default') {
                  resolved.push({
                    id: item.id,
                    name: item.name || item.id,
                    subtitle: `Extracted • ${item.id}`,
                    imageUrl: extracted.dataUrl,
                    storagePath: extracted.storagePath || '',
                    source: 'inventory_mind'
                  });
                }
              }
            } catch {
              // Skip individual item errors quietly
            }
          })
        );

        if (!cancelled) {
          setInventoryMarkers(resolved);
        }
      } catch (err) {
        console.warn('[MarkerLibrarySelector] Could not list inventory markers:', err);
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    };

    loadInventoryMarkers();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickItem = async (entry) => {
    if (!entry?.imageUrl || selectingId) return;
    setSelectingId(entry.id);
    try {
      const safeName = (entry.name || entry.id || 'marker').replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = await resolveMarkerToFile(
        null,
        entry.imageUrl,
        { storagePath: entry.storagePath, name: `${safeName}.png` },
        safeName
      );
      const dims = await getImageDimensions(entry.imageUrl).catch(() => ({ width: 512, height: 512, aspectRatio: 1 }));
      await onSelectMarker(file, {
        imageUrl: entry.imageUrl,
        width: dims.width,
        height: dims.height,
        aspectRatio: dims.aspectRatio || (dims.height / dims.width) || 1,
        name: file.name,
        source: 'custom'
      });
      if (onClose) onClose();
    } catch (err) {
      console.error('[MarkerLibrarySelector] Selection failed:', err);
      alert(err.message || 'Could not load chosen marker image.');
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="p-2.5 rounded-lg bg-neutral-950/95 border border-emerald-500/40 space-y-2.5 shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">photo_library</span>
          Choose Target Marker Artwork
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      {/* High-Contrast Built-in Calibration Targets */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 block">
          MindAR Calibration Targets
        </span>
        <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-3'} gap-1.5`}>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={Boolean(selectingId)}
              onClick={() => handlePickItem(p)}
              className="group p-1.5 rounded-lg bg-neutral-900 hover:bg-emerald-950/50 border border-neutral-800 hover:border-emerald-500/60 transition-all text-left flex flex-col gap-1 cursor-pointer disabled:opacity-50"
            >
              <div className="w-full aspect-square rounded bg-black overflow-hidden flex items-center justify-center border border-neutral-800">
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-200 group-hover:text-emerald-200 truncate w-full">
                {selectingId === p.id ? 'Loading...' : p.name}
              </span>
              <span className="text-[8px] font-mono text-neutral-500 truncate w-full">{p.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Existing Inventory Marker Images */}
      <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400">
            Existing Inventory Markers ({inventoryMarkers.length})
          </span>
          {loadingLibrary && (
            <span className="text-[9px] font-mono text-neutral-400 animate-pulse">Scanning inventory...</span>
          )}
        </div>
        {!loadingLibrary && inventoryMarkers.length === 0 ? (
          <p className="text-[10px] text-neutral-500 italic py-1">
            No existing marker images found in inventory yet. Upload an image or pick a calibration target above.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
            {inventoryMarkers.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={Boolean(selectingId)}
                onClick={() => handlePickItem(m)}
                className="group p-1.5 rounded-lg bg-neutral-900 hover:bg-cyan-950/50 border border-neutral-800 hover:border-cyan-500/60 transition-all text-left flex flex-col gap-1 cursor-pointer disabled:opacity-50"
              >
                <div className="w-full aspect-square rounded bg-black overflow-hidden flex items-center justify-center border border-neutral-800">
                  <img src={m.imageUrl} alt={m.name} className="w-full h-full object-contain" />
                </div>
                <span className="text-[10px] font-semibold text-neutral-200 group-hover:text-cyan-200 truncate w-full">
                  {selectingId === m.id ? 'Loading...' : m.name}
                </span>
                <span className="text-[8px] font-mono text-neutral-500 truncate w-full">{m.subtitle}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function slugifyAssetId(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const SaveAsInventoryModal = ({
  isOpen,
  onClose,
  onConfirmSaveAs,
  isSaving,
  progressStep,
  progressMessage,
  defaultName = '',
  defaultMerchantId = 'default',
  defaultPrice = '99.00',
  defaultDescription = '',
  markerImageUrl,
  markerInfo,
  markerWidth,
  markerAspectRatio,
  onUploadMarkerFile,
  onSelectLibraryMarker,
  sceneSummary = {}
}) => {
  const dialogRef = useRef(null);
  const modalMarkerInputRef = useRef(null);

  const [assetName, setAssetName] = useState(defaultName || 'Custom AR Scene');
  const [assetId, setAssetId] = useState(() => {
    const base = slugifyAssetId(defaultName);
    return base || `scene-${Date.now().toString(36)}`;
  });
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [price, setPrice] = useState(String(defaultPrice ?? '99.00'));
  const [merchantId, setMerchantId] = useState(defaultMerchantId || 'default');
  const [description, setDescription] = useState(defaultDescription || '');
  const [showMarkerPicker, setShowMarkerPicker] = useState(false);
  const [idExistsWarning, setIdExistsWarning] = useState(false);
  const [checkingId, setCheckingId] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Check if assetId already exists in Firestore assets or batches
  useEffect(() => {
    if (!isOpen) return undefined;
    const clean = assetId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!clean) {
      setIdExistsWarning(false);
      return undefined;
    }

    let cancelled = false;
    setCheckingId(true);
    const timer = setTimeout(async () => {
      try {
        const [aSnap, bSnap] = await Promise.all([
          getDoc(doc(db, 'assets', clean)),
          getDoc(doc(db, 'batches', clean))
        ]);
        if (!cancelled) {
          setIdExistsWarning(Boolean(aSnap.exists() || bSnap.exists()));
        }
      } catch {
        if (!cancelled) setIdExistsWarning(false);
      } finally {
        if (!cancelled) setCheckingId(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [assetId, isOpen]);

  const handleNameChange = (val) => {
    setAssetName(val);
    if (!idManuallyEdited) {
      const slug = slugifyAssetId(val);
      setAssetId(slug || `scene-${Date.now().toString(36)}`);
    }
  };

  const handleGenerateUniqueId = () => {
    const prefix = slugifyAssetId(assetName) || 'ar-scene';
    const suffix = Math.random().toString(36).slice(2, 6);
    setAssetId(`${prefix}-${suffix}`);
    setIdManuallyEdited(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError('');

    const cleanId = assetId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!cleanId) {
      setFormError('Please provide a valid Asset / Batch ID.');
      return;
    }
    if (!assetName.trim()) {
      setFormError('Please provide an Asset Name.');
      return;
    }
    if (!markerImageUrl) {
      setFormError('Please upload or choose a target marker image.');
      return;
    }

    await onConfirmSaveAs({
      assetId: cleanId,
      name: assetName.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      merchantId: (merchantId || 'default').trim() || 'default'
    });
  };

  if (!isOpen) return null;

  const steps = [
    { num: 1, label: 'Exporting 3D Scene to binary .glb & uploading to assets bucket' },
    { num: 2, label: 'Uploading target marker artwork to temp_anchors & assets buckets' },
    { num: 3, label: 'Running MindAR marker generator (.mind tracking compilation)' },
    { num: 4, label: 'Uploading video & scene media layers to Storage' },
    { num: 5, label: 'Capturing & uploading 3D showroom thumbnail' },
    { num: 6, label: 'Registering Asset & Batch in Admin Inventory' }
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="save-as-inventory-title"
      onCancel={(e) => {
        if (isSaving) {
          e.preventDefault();
        } else {
          onClose();
        }
      }}
      onClick={(e) => {
        if (!isSaving && e.target === dialogRef.current) {
          onClose();
        }
      }}
      style={{ overscrollBehavior: 'contain' }}
      className="m-auto w-full max-w-2xl rounded-2xl bg-neutral-950 text-white border border-emerald-500/40 shadow-2xl shadow-black/80 p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-gradient-to-r from-emerald-950/60 via-neutral-950 to-indigo-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
            <div>
              <h2 id="save-as-inventory-title" className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                Save Scene As New Inventory Asset & Batch
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  MindAR + .GLB
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Compiles your marker with MindAR, bakes the 3D scene as the batch .glb model, and adds everything to Admin Inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-rose-400">error</span>
              <span>{formError}</span>
            </div>
          )}

          {/* Inventory Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                Asset Name *
              </label>
              <input
                type="text"
                required
                disabled={isSaving}
                value={assetName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Cyber Portal Hoodie"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-emerald-400 focus:outline-none text-xs text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                  Batch / Asset ID *
                </label>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleGenerateUniqueId}
                  className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                >
                  Generate Unique ID
                </button>
              </div>
              <input
                type="text"
                required
                disabled={isSaving}
                value={assetId}
                onChange={(e) => {
                  setAssetId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '-'));
                  setIdManuallyEdited(true);
                }}
                placeholder="e.g., cyber-portal-hoodie"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-emerald-400 focus:outline-none text-xs font-mono text-emerald-300"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                {checkingId ? (
                  <span className="text-neutral-500">Checking inventory ID...</span>
                ) : idExistsWarning ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">warning</span>
                    ID exists in inventory (saving will overwrite it)
                  </span>
                ) : (
                  <span className="text-emerald-400/90 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Available new inventory ID
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isSaving}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-emerald-400 focus:outline-none text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                Merchant ID
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="default"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-emerald-400 focus:outline-none text-xs font-mono text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                Description
              </label>
              <input
                type="text"
                disabled={isSaving}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional storefront & inventory description..."
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 focus:border-emerald-400 focus:outline-none text-xs text-white"
              />
            </div>
          </div>

          {/* Target Marker Image Card (Synced with Tracking Section) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-base">qr_code_scanner</span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Target Marker Image (MindAR Anchor)
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Synced from the Tracking tab • Will be compiled into <code className="text-emerald-300">anchors/{(merchantId || 'default').trim() || 'default'}/{assetId || 'batch'}.mind</code>
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {markerInfo?.source === 'custom'
                  ? 'Custom Marker Ready'
                  : markerInfo?.source === 'default' || !markerInfo?.source
                    ? 'Default Calibration'
                    : 'Active Marker'}
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/60 border border-neutral-800">
              <div className="w-20 h-20 rounded-lg bg-neutral-950 border border-emerald-500/40 overflow-hidden shrink-0 flex items-center justify-center">
                {markerImageUrl ? (
                  <img src={markerImageUrl} alt="Active Target Marker" className="w-full h-full object-contain" />
                ) : (
                  <span className="material-symbols-outlined text-neutral-600">image_not_supported</span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1 text-[11px]">
                <p className="font-semibold text-neutral-200 truncate">
                  {markerInfo?.name || (markerInfo?.source === 'default' ? 'STAR weAR Calibration Target' : 'Active Viewport Marker')}
                </p>
                <p className="text-[10px] font-mono text-neutral-400">
                  Resolution: {markerInfo?.width ? `${markerInfo.width} × ${markerInfo.height} px` : 'Auto'} • Physical Width: {(markerWidth || 1).toFixed(2)}m (AR Ratio {(markerAspectRatio || 1).toFixed(3)})
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    ref={modalMarkerInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && onUploadMarkerFile) {
                        onUploadMarkerFile(f);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => modalMarkerInputRef.current?.click()}
                    className="px-2.5 py-1 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-xs">file_upload</span>
                    Upload Marker Image
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowMarkerPicker((v) => !v)}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-xs">photo_library</span>
                    {showMarkerPicker ? 'Hide Marker Library' : 'Choose Marker'}
                  </button>
                </div>
              </div>
            </div>

            {markerInfo?.source === 'default' && !showMarkerPicker && (
              <p className="text-[10px] text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-400">info</span>
                <span>
                  Tip: Using the default calibration marker. Upload or choose your garment/poster artwork above if you want MindAR to track custom artwork.
                </span>
              </p>
            )}

            {showMarkerPicker && (
              <MarkerLibrarySelector
                compact
                onSelectMarker={onSelectLibraryMarker}
                onClose={() => setShowMarkerPicker(false)}
              />
            )}
          </div>

          {/* 3D Scene -> Batch .GLB Export Summary */}
          <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">view_in_ar</span>
                3D Scene Package (.GLB Model + AR Config)
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                assets/{assetId || 'batch'}/{assetId || 'batch'}_scene.glb
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">Base 3D Model</span>
                <span className="font-semibold text-neutral-200 truncate block">
                  {sceneSummary.hasRootModel ? (sceneSummary.rootModelName || 'Loaded .GLB') : 'Procedural Studio Scene'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">Shapes & Planes</span>
                <span className="font-semibold text-cyan-300">{sceneSummary.shapesCount || 0} active</span>
              </div>
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">3D Text & Ext. Models</span>
                <span className="font-semibold text-pink-300">
                  {(sceneSummary.textsCount || 0)} text • {(sceneSummary.customModelsCount || 0)} models
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">Video Layer</span>
                <span className="font-semibold text-purple-300 truncate block">
                  {sceneSummary.hasVideo ? `Mapped (${sceneSummary.videoTargetLabel || 'Active'})` : 'None'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">Scatter & Lighting</span>
                <span className="font-semibold text-amber-300">
                  {(sceneSummary.scatterCount || 0)} scatter • {(sceneSummary.lightsCount || 0) + 4} lights
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/50 border border-neutral-800">
                <span className="text-neutral-500 block text-[9px] uppercase font-mono">FX Layers</span>
                <span className="font-semibold text-emerald-300 truncate block">
                  {[
                    sceneSummary.portalEnabled && 'Portal',
                    sceneSummary.particlesEnabled && 'Particles',
                    sceneSummary.websiteEnabled && 'Web'
                  ].filter(Boolean).join(', ') || 'Standard AR'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Pipeline Progress */}
          {isSaving && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-200 flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                  {progressMessage || 'Building Inventory Asset & MindAR Target...'}
                </span>
                <span className="font-mono text-[10px] text-emerald-300">
                  Step {Math.max(1, progressStep || 1)} / 6
                </span>
              </div>
              <div className="space-y-1">
                {steps.map((s) => {
                  const done = (progressStep || 0) > s.num;
                  const active = (progressStep || 1) === s.num;
                  return (
                    <div
                      key={s.num}
                      className={`flex items-center gap-2 text-[10px] font-mono ${
                        done ? 'text-emerald-400' : active ? 'text-white font-bold' : 'text-neutral-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {done ? 'check_circle' : active ? 'autorenew' : 'radio_button_unchecked'}
                      </span>
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving || !assetName.trim() || !assetId.trim()}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {isSaving ? 'hourglass_top' : 'rocket_launch'}
            </span>
            <span>
              {isSaving ? 'Compiling & Saving to Inventory...' : 'Compile Marker & Add to Inventory'}
            </span>
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default SaveAsInventoryModal;
