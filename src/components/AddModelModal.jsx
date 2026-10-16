/* eslint-disable react/prop-types */
import React, { useState, useRef } from 'react';

// Curated 3D Models with public CORS-friendly GLB endpoints
export const SAMPLE_3D_MODELS = [
  {
    id: 'damaged_helmet',
    name: 'Sci-Fi Battle Helmet',
    category: 'Sci-Fi / Props',
    icon: 'military_tech',
    description: 'PBR showcase damaged battle helmet with detailed metal & roughness maps',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    defaultScale: 0.8
  },
  {
    id: 'boombox',
    name: 'Vintage BoomBox',
    category: 'Electronics',
    icon: 'speaker',
    description: 'Retro 80s boombox stereo player with detailed speaker cones and knobs',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb',
    defaultScale: 15.0
  },
  {
    id: 'lantern',
    name: 'Antique Brass Lantern',
    category: 'Props',
    icon: 'emoji_objects',
    description: 'Detailed brass & glass lantern with metallic antique sheen',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb',
    defaultScale: 0.12
  },
  {
    id: 'water_bottle',
    name: 'Hydration Flask',
    category: 'Apparel & Gear',
    icon: 'water_drop',
    description: 'Sport hydration flask with metallic body and silicone grip',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
    defaultScale: 3.5
  },
  {
    id: 'avocado',
    name: 'Fresh Avocado',
    category: 'Organic / Props',
    icon: 'eco',
    description: 'Organic high-detail avocado fruit for lifestyle scene staging',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb',
    defaultScale: 15.0
  },
  {
    id: 'rubber_duck',
    name: 'Yellow Mascot Duck',
    category: 'Characters',
    icon: 'cruelty_free',
    description: 'Iconic yellow mascot rubber duck with glossy finish',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    defaultScale: 0.8
  }
];

export default function AddModelModal({
  isOpen = false,
  onClose,
  onAddModel,
  onSetRootModel
}) {
  const [activeSource, setActiveSource] = useState('upload'); // 'upload' | 'url' | 'samples'
  const [selectedFile, setSelectedFile] = useState(null);
  const [modelUrlInput, setModelUrlInput] = useState('');
  const [selectedSample, setSelectedSample] = useState(SAMPLE_3D_MODELS[0]);
  
  // Customization Settings
  const [modelName, setModelName] = useState('');
  const [modelScale, setModelScale] = useState(1.0);
  const [placementPreset, setPlacementPreset] = useState('center'); // 'center' | 'left' | 'right' | 'elevated' | 'front' | 'behind'
  const [isPrimaryModel, setIsPrimaryModel] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(25);
  
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
      alert('Please upload a valid 3D model file (.glb or .gltf)');
      return;
    }
    setSelectedFile(file);
    const cleanName = file.name.replace(/\.(glb|gltf)$/i, '');
    if (!modelName) {
      setModelName(cleanName);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const calculatePlacementCoordinates = () => {
    switch (placementPreset) {
      case 'left':
        return { posX: -0.85, posY: 0.0, posZ: 0.0 };
      case 'right':
        return { posX: 0.85, posY: 0.0, posZ: 0.0 };
      case 'elevated':
        return { posX: 0.0, posY: 0.65, posZ: 0.0 };
      case 'front':
        return { posX: 0.0, posY: 0.0, posZ: 0.65 };
      case 'behind':
        return { posX: 0.0, posY: 0.0, posZ: -0.75 };
      case 'center':
      default:
        return { posX: 0.0, posY: 0.0, posZ: 0.0 };
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setUrlError('');

    let finalUrl = '';
    let finalFileName = '';
    let finalFileSize = null;

    if (activeSource === 'upload') {
      if (!selectedFile) {
        alert('Please select or drop a 3D model file (.glb or .gltf)');
        return;
      }
      finalUrl = URL.createObjectURL(selectedFile);
      finalFileName = selectedFile.name;
      finalFileSize = selectedFile.size;
    } else if (activeSource === 'url') {
      const trimmed = modelUrlInput.trim();
      if (!trimmed) {
        setUrlError('Please enter a valid 3D model URL');
        return;
      }
      finalUrl = trimmed;
      finalFileName = trimmed.split('/').pop().split('?')[0] || 'remote_model.glb';
    } else if (activeSource === 'samples') {
      if (!selectedSample) {
        alert('Please select a sample 3D model from the library');
        return;
      }
      finalUrl = selectedSample.url;
      finalFileName = `${selectedSample.id}.glb`;
    }

    const { posX, posY, posZ } = calculatePlacementCoordinates();
    const finalName = modelName.trim() || finalFileName.replace(/\.(glb|gltf)$/i, '') || 'External 3D Model';

    // If user chose to replace the primary scene root model
    if (isPrimaryModel && typeof onSetRootModel === 'function') {
      onSetRootModel({
        url: finalUrl,
        file: selectedFile,
        name: finalName,
        scale: Number(modelScale) || 1.0,
        posX,
        posY,
        posZ
      });
      onClose();
      return;
    }

    // Otherwise add as an independent custom model element in the scene
    const payload = {
      id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: finalName,
      url: finalUrl,
      file: selectedFile || null,
      fileName: finalFileName,
      fileSize: finalFileSize,
      scale: Number(modelScale) || 1.0,
      scaleX: Number(modelScale) || 1.0,
      scaleY: Number(modelScale) || 1.0,
      scaleZ: Number(modelScale) || 1.0,
      posX,
      posY,
      posZ,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      visible: true,
      autoRotate,
      rotationSpeed: Number(rotationSpeed) || 25
    };

    if (typeof onAddModel === 'function') {
      onAddModel(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold">
              <span className="material-symbols-outlined text-2xl">view_in_ar</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white">
                  Add External 3D Model
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono px-2 py-0.5 rounded-full font-bold">
                  GLB / GLTF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Load external 3D models into your AR scene from local files, remote URLs, or pre-configured assets.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Source Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSource('upload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSource === 'upload'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            <span>Upload File (.GLB)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSource('url')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSource === 'url'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">link</span>
            <span>External Web URL</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSource('samples')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSource === 'samples'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">category</span>
            <span>Sample 3D Library ({SAMPLE_3D_MODELS.length})</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* SOURCE 1: UPLOAD LOCAL FILE */}
          {activeSource === 'upload' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Select or Drop 3D Model File
              </label>
              
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'border-purple-400 bg-purple-950/40 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-slate-700 bg-slate-950/60 hover:border-purple-500/60 hover:bg-slate-900/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                  selectedFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  <span className="material-symbols-outlined text-2xl">
                    {selectedFile ? 'check_circle' : 'file_upload'}
                  </span>
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-300 truncate max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to add
                    </p>
                    <p className="text-[10px] text-purple-400 underline pt-1">
                      Click to choose a different file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">
                      Drag & Drop your <span className="text-purple-400">.GLB</span> or <span className="text-purple-400">.GLTF</span> file here
                    </p>
                    <p className="text-[11px] text-slate-400">
                      or click to browse local files on your computer
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SOURCE 2: REMOTE URL */}
          {activeSource === 'url' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Direct 3D Model URL (.glb / .gltf)
              </label>
              
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="url"
                    value={modelUrlInput}
                    onChange={(e) => {
                      setModelUrlInput(e.target.value);
                      setUrlError('');
                    }}
                    placeholder="https://example.com/assets/model.glb"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono pr-24"
                  />
                  {modelUrlInput && (
                    <button
                      type="button"
                      onClick={() => setModelUrlInput('')}
                      className="absolute right-2 top-2 px-2 py-1 text-[10px] text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {urlError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {urlError}
                  </p>
                )}

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-sky-400">info</span>
                    CORS Requirement:
                  </span>
                  <p>
                    External model URLs must allow cross-origin requests (CORS headers <code className="text-purple-300 font-mono">Access-Control-Allow-Origin: *</code>) to load inside the WebGL canvas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SOURCE 3: SAMPLE 3D ASSETS LIBRARY */}
          {activeSource === 'samples' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Choose Sample 3D Model Preset
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {SAMPLE_3D_MODELS.map((item) => {
                  const isSelected = selectedSample?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedSample(item);
                        if (!modelName) setModelName(item.name);
                        setModelScale(item.defaultScale || 1.0);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between h-28 group relative ${
                        isSelected
                          ? 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500 shadow-md shadow-purple-500/10'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`material-symbols-outlined text-2xl transition-transform duration-200 group-hover:scale-110 ${
                          isSelected ? 'text-purple-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}>
                          {item.icon}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/20">
                          {item.category}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-xs text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{item.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Configuration Settings */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Model Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Model Display Name</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. Cyber Sneaker"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Model Scale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Initial Scale Multiplier</span>
                <span className="text-purple-400 font-mono font-bold">{modelScale}x</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.05"
                  max="10.0"
                  step="0.05"
                  value={modelScale}
                  onChange={(e) => setModelScale(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0.01"
                  max="50"
                  value={modelScale}
                  onChange={(e) => setModelScale(parseFloat(e.target.value) || 1.0)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-center font-mono text-purple-300"
                />
              </div>
            </div>

            {/* Placement Preset */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Spawn Placement Location</span>
                <span className="text-[10px] text-slate-500">Can be repositioned with Gizmo</span>
              </label>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { id: 'center', label: 'Center (0,0,0)' },
                  { id: 'left', label: 'Left Side' },
                  { id: 'right', label: 'Right Side' },
                  { id: 'elevated', label: 'Elevated (Top)' },
                  { id: 'front', label: 'Front Closer' },
                  { id: 'behind', label: 'Back Backdrop' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlacementPreset(p.id)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer truncate ${
                      placementPreset === p.id
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Options */}
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-purple-500 focus:ring-purple-400"
                />
                <span>Auto-rotate in 3D scene</span>
              </label>

              {autoRotate && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px]">Speed:</span>
                  <input
                    type="number"
                    value={rotationSpeed}
                    onChange={(e) => setRotationSpeed(Number(e.target.value) || 25)}
                    className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-center text-xs font-mono text-purple-300"
                  />
                  <span className="text-slate-500 text-[10px]">deg/s</span>
                </div>
              )}

              {typeof onSetRootModel === 'function' && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-300 select-none ml-auto">
                  <input
                    type="checkbox"
                    checked={isPrimaryModel}
                    onChange={(e) => setIsPrimaryModel(e.target.checked)}
                    className="rounded bg-slate-950 border-amber-700 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Replace Primary Model (Scene Root)</span>
                </label>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>{isPrimaryModel ? 'Set as Primary 3D Model' : 'Add External Model to Scene'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
