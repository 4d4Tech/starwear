/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import {
  TRIPO_P_MODELS,
  DEFAULT_TRIPO_KEY,
  generate3DWithTripo,
  checkTripoBalance
} from '../services/tripo3DService';
import { generateVolumetric3DMesh } from '../services/threeDAIStudioService';

export default function ThreeDAIStudioModal({
  isOpen = false,
  onClose,
  data, // { file, segResult }
  appInstance
}) {
  const [activeTab, setActiveTab] = useState('tripo'); // 'tripo' | 'parametric'
  const [selectedModel, setSelectedModel] = useState('P2-20260801'); // Default to Tripo P2
  const [topologyMode, setTopologyMode] = useState('quad'); // 'quad' | 'triangle'
  const [polyQuality, setPolyQuality] = useState('standard');
  const [depthInflation, setDepthInflation] = useState(1.1);
  const [featureRelief, setFeatureRelief] = useState(0.6);
  const [symmetry, setSymmetry] = useState(true);
  const [apiKey, setApiKey] = useState(DEFAULT_TRIPO_KEY);
  const [accountBalance, setAccountBalance] = useState(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load saved API Key or default to tripod3d.md key
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tripo3d_api_key');
      if (saved && saved.trim()) {
        setApiKey(saved.trim());
      } else {
        setApiKey(DEFAULT_TRIPO_KEY);
      }
    } catch {
      setApiKey(DEFAULT_TRIPO_KEY);
    }
  }, []);

  // Check Tripo account balance
  const fetchBalance = useCallback(async (keyToTest) => {
    const key = (keyToTest || apiKey || DEFAULT_TRIPO_KEY).trim();
    if (!key) return;
    setIsCheckingBalance(true);
    try {
      const bal = await checkTripoBalance(key);
      if (bal) {
        setAccountBalance(bal.balance);
      }
    } catch {
      /* ignore balance check failures */
    } finally {
      setIsCheckingBalance(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isOpen) {
      fetchBalance(apiKey);
    }
  }, [isOpen, apiKey, fetchBalance]);

  if (!isOpen || !data) return null;

  const { file, segResult } = data;
  const currentModelDef = TRIPO_P_MODELS.find((m) => m.id === selectedModel) || TRIPO_P_MODELS[0];
  const isCloudModel = currentModelDef.id !== 'studio-neural';

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    try {
      localStorage.setItem('tripo3d_api_key', key.trim());
    } catch {
      /* ignore */
    }
    fetchBalance(key);
  };

  const handleStartGeneration = async () => {
    if (!appInstance) return;
    setIsGenerating(true);
    setErrorMessage('');
    setGenerationStep('Conditioning source image & mask boundaries...');

    try {
      if (isCloudModel) {
        // -------------------------------------------------------------
        // TRIPO 3D P-SERIES AI CLOUD GENERATION (https://api.tripo3d.ai)
        // -------------------------------------------------------------
        const activeKey = (apiKey || DEFAULT_TRIPO_KEY).trim();
        if (!activeKey) {
          throw new Error('Tripo3D API Key is required. Please check tripod3d.md or enter your key.');
        }

        const isPSeries = selectedModel.startsWith('P') || selectedModel.includes('P1') || selectedModel.includes('P2');
        const faceLimit = isPSeries
          ? (polyQuality === 'low' ? 6000 : polyQuality === 'high' ? 20000 : 12000)
          : (polyQuality === 'low' ? 10000 : polyQuality === 'high' ? 50000 : 25000);

        const glbUrl = await generate3DWithTripo({
          apiKey: activeKey,
          file,
          canvas: segResult.extractedCanvas,
          model: selectedModel,
          topology: topologyMode,
          faceLimit,
          onProgress: ({ message }) => {
            setGenerationStep(message);
          }
        });

        const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'tripo_model';
        const modelFileName = `${baseName}.glb`;

        setGenerationStep('Ingesting compiled .GLB into 3D viewport...');
        await appInstance.import3DModelFromUrl(glbUrl, modelFileName, {
          source: 'tripo3d-p-series',
          model: selectedModel,
          topology: topologyMode,
          cleanName: `${baseName} (Tripo 3D)`
        });

        appInstance.updateDiagnostics(`Generated 3D Model with Tripo3D [${currentModelDef.name}] (${topologyMode.toUpperCase()} topology).`);
        onClose();
      } else {
        // -------------------------------------------------------------
        // BUILT-IN LOCAL NEURAL VOLUME PIPELINE (OFFLINE & FREE)
        // -------------------------------------------------------------
        setGenerationStep('Solving Poisson boundary equation for organic volumetric envelope...');
        await new Promise((r) => setTimeout(r, 120));

        setGenerationStep('Extracting internal structural creases & highlight ridges...');
        await new Promise((r) => setTimeout(r, 120));

        setGenerationStep('Integrating tangent normal divergence into physical vertex displacement...');
        await new Promise((r) => setTimeout(r, 120));

        const { mesh, triangleCount } = generateVolumetric3DMesh({
          extractedCanvas: segResult.extractedCanvas,
          maskGrid: segResult.maskGrid,
          segW: segResult.segW,
          segH: segResult.segH,
          origW: segResult.origW,
          origH: segResult.origH,
          fabricMaterialManager: appInstance.fabricMaterialManager,
          depthInflation: parseFloat(depthInflation),
          featureRelief: parseFloat(featureRelief),
          polyQuality,
          symmetry
        });

        mesh.name = (file.name || 'AI_3D_Model').replace(/\.[^/.]+$/, '') + '_TripoLocal';

        setGenerationStep('Applying Laplacian mesh relaxation & baking PBR Cavity AO maps...');
        await new Promise((r) => setTimeout(r, 120));

        appInstance.addSceneObject(mesh);
        appInstance.selectObject(mesh);
        appInstance.updateDiagnostics(`Generated 3D Model with Built-In Neural Pipeline (${triangleCount.toLocaleString()} triangles with tangent PBR & Cavity AO).`);

        onClose();
      }
    } catch (err) {
      console.error('Tripo3D Generation Error:', err);
      let message = err.message || 'Failed to generate 3D model.';
      if (message.includes("don't have enough credit") || message.includes('2010')) {
        message = (
          <span>
            <strong>Tripo3D Credit Notice:</strong> Your Tripo3D API key (from <code>tripod3d.md</code>) is authenticated, but your Tripo account has 0 available credits. You can recharge credits on{' '}
            <a href="https://platform.tripo3d.ai" target="_blank" rel="noreferrer" className="underline font-bold text-amber-300">
              platform.tripo3d.ai
            </a>
            , or select the free built-in <strong>Studio Neural Volume</strong> model below to generate your 3D model instantly for free.
          </span>
        );
      }
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunParametricArchetype = async (archetype) => {
    if (!appInstance) return;
    onClose();
    await appInstance.buildIntelligent3D(segResult, archetype, file.name);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto studio-scroll">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-xl">view_in_ar</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
                Tripo3D — 2D to 3D Generation
                <span className="text-[10px] font-mono text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-500/40">
                  P-Series AI Engine
                </span>
                {accountBalance !== null && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                    Balance: {accountBalance.toFixed(2)} Cr
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Generate production 3D models with Tripo3D P-Series AI (Clean Quad Topology &amp; PBR Textures).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 rounded cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('tripo')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'tripo'
                ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>Tripo3D AI P-Series</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parametric')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'parametric'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-sm">shapes</span>
            <span>Parametric Shape Archetypes</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2.5 leading-relaxed">
            <span className="material-symbols-outlined text-base text-red-400 mt-0.5 flex-shrink-0">warning</span>
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* 1. Side-by-Side Image Conditioning Preview */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">image</span>
              Source Image
            </span>
            <div className="w-full h-32 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
              <img
                src={URL.createObjectURL(file)}
                alt="Original"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Segmented Foreground
            </span>
            <div
              className="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center border border-emerald-500/30"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                backgroundColor: '#0f172a'
              }}
            >
              <img
                src={segResult.extractedDataUrl}
                alt="Extracted Cutout"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* TAB CONTENT: TRIPO3D P-SERIES ENGINES */}
        {activeTab === 'tripo' && (
          <>
            {/* 2. Model Engine Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-rose-400">psychology</span>
                  Select 3D AI Model
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Engine: {currentModelDef.provider}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRIPO_P_MODELS.map((model) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-rose-500 bg-rose-950/40 shadow-md ring-1 ring-rose-500/40'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-base ${isSelected ? 'text-rose-400' : 'text-slate-400'}`}>
                            {model.icon}
                          </span>
                          <span className="text-xs font-bold text-white">{model.name}</span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${model.badgeColor}`}>
                          {model.badge}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {model.description}
                      </p>

                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                        <span>Speed: {model.speed}</span>
                        <span className={isSelected ? 'text-rose-400 font-bold' : ''}>
                          {isSelected ? '● Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Tripo3D API Key Section */}
            {isCloudModel && (
              <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <span className="material-symbols-outlined text-sm">key</span>
                    Tripo3D API Key (Pre-loaded from tripod3d.md)
                  </div>
                  <div className="flex items-center gap-2">
                    {accountBalance !== null && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Balance: <strong className="text-white">${accountBalance.toFixed(2)}</strong>
                      </span>
                    )}
                    <a
                      href="https://platform.tripo3d.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-rose-400 hover:text-rose-300 underline font-mono"
                    >
                      Console ↗
                    </a>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter Tripo3D API Key (tsk_...)"
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => fetchBalance(apiKey)}
                    disabled={isCheckingBalance}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    {isCheckingBalance ? '...' : 'Refresh'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tasks are dispatched to Tripo3D API V3 via secure local proxy. The resulting high-definition .GLB model is ingested directly into Studio44.
                </p>
              </div>
            )}

            {/* 4. Generation Parameters & Quality */}
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Mesh Topology &amp; Parameters
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Topology (Quad vs Triangle) */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Mesh Topology
                  </label>
                  {currentModelDef.supportsQuad ? (
                    <select
                      value={topologyMode}
                      onChange={(e) => setTopologyMode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-rose-500"
                    >
                      <option value="quad">🧊 Clean Quad Mesh (P-Series)</option>
                      <option value="triangle">📐 Triangle Mesh (Standard)</option>
                    </select>
                  ) : (
                    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 font-medium">
                      📐 Standard Mesh
                    </div>
                  )}
                </div>

                {/* Polycount / Density */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Target Polycount
                  </label>
                  <select
                    value={polyQuality}
                    onChange={(e) => setPolyQuality(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-rose-500"
                  >
                    <option value="low">
                      {selectedModel.startsWith('P') ? '📱 Low-Poly (~6k WebAR)' : '📱 Low-Poly (~10k WebAR)'}
                    </option>
                    <option value="standard">
                      {selectedModel.startsWith('P') ? '🎮 Game-Ready (~12k Quad Mesh)' : '🎮 Game-Ready (~25k Balanced)'}
                    </option>
                    <option value="high">
                      {selectedModel.startsWith('P') ? '🎬 Cinematic (~20k Max Quad)' : '🎬 Cinematic (~50k Ultra)'}
                    </option>
                  </select>
                </div>

                {/* Local Inflation Controls (if Studio Neural) */}
                {selectedModel === 'studio-neural' ? (
                  <>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>Volumetric Depth</span>
                        <span className="text-rose-400 font-mono">{depthInflation}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="2.5"
                        step="0.1"
                        value={depthInflation}
                        onChange={(e) => setDepthInflation(e.target.value)}
                        className="w-full accent-rose-500 mt-1"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>Feature Relief</span>
                        <span className="text-purple-400 font-mono">{Math.round(featureRelief * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={featureRelief}
                        onChange={(e) => setFeatureRelief(e.target.value)}
                        className="w-full accent-purple-500 mt-1"
                      />
                    </div>
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400">
                        Surface Symmetry Mode
                      </span>
                      <button
                        type="button"
                        onClick={() => setSymmetry(!symmetry)}
                        className={`py-1 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          symmetry
                            ? 'bg-rose-950 border-rose-500/50 text-rose-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span>{symmetry ? 'Bilateral (360° Full Watertight)' : 'Natural (Single Shell)'}</span>
                        <span className="material-symbols-outlined text-xs">
                          {symmetry ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">
                        PBR Material Maps
                      </span>
                      <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        Embedded PBR
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">
                        Format
                      </span>
                      <div className="text-[11px] text-indigo-300 font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">deployed_code</span>
                        Standard .GLB
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Active Passes */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-mono">Pipeline Features:</span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-rose-300 px-2 py-0.5 rounded-full font-mono">
                  ✓ Tripo P-Series Model
                </span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  ✓ Quad-Dominant Topology
                </span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  ✓ Albedo &amp; PBR Roughness
                </span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  ✓ Normal Bump Alignment
                </span>
                <span className="text-[9px] bg-slate-900 border border-slate-800 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  ✓ Watertight Manifold
                </span>
              </div>
            </div>

            {/* 5. Generation Progress Status */}
            {isGenerating && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">Tripo3D Generation in Progress</div>
                  <div className="text-[11px] text-rose-300 font-mono truncate">{generationStep}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isGenerating}
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={handleStartGeneration}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  {isGenerating ? 'sync' : 'auto_awesome'}
                </span>
                <span>
                  {isGenerating ? 'Synthesizing 3D Model...' : `Generate 3D with ${currentModelDef.name}`}
                </span>
              </button>
            </div>
          </>
        )}

        {/* TAB CONTENT: PARAMETRIC SHAPE ARCHETYPES */}
        {activeTab === 'parametric' && (
          <div className="space-y-4">
            {/* AI Classification Badge */}
            <div className="p-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-indigo-400">
                {segResult.icon}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    ✨ AI Detected Object Type:
                  </span>
                  <span className="text-xs font-extrabold text-white bg-indigo-600/60 px-2 py-0.5 rounded-full border border-indigo-400/40">
                    {segResult.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {segResult.description}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Select Parametric Extrusion Pipeline:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. Recommended Auto */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype(segResult.archetype)}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-left border border-indigo-400/50 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2.5 col-span-1 sm:col-span-2 group cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl text-amber-300 group-hover:scale-110 transition-transform">
                    rocket_launch
                  </span>
                  <div>
                    <div className="font-bold text-xs">🚀 Auto-Reconstruct (Recommended)</div>
                    <div className="text-[11px] text-indigo-200">
                      Builds {segResult.label} with specialized UV mapping.
                    </div>
                  </div>
                </button>

                {/* 2. Garment / Apparel */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype('GARMENT_APPAREL')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-left border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-indigo-400 text-xl">checkroom</span>
                  <div>
                    <div className="font-bold text-xs">👕 Garment / T-Shirt</div>
                    <div className="text-[10px] text-slate-400">Pillowy fabric thickness & cotton PBR</div>
                  </div>
                </button>

                {/* 3. Cylindrical Can */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype('CYLINDRICAL')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-left border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-indigo-400 text-xl">local_drink</span>
                  <div>
                    <div className="font-bold text-xs">🥤 3D Can / Cylinder</div>
                    <div className="text-[10px] text-slate-400">Seamless wrap UVs & metallic rim</div>
                  </div>
                </button>

                {/* 4. Screen / Boxy */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype('SCREEN_BOXY')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-left border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-indigo-400 text-xl">tv</span>
                  <div>
                    <div className="font-bold text-xs">📺 3D Screen / Box</div>
                    <div className="text-[10px] text-slate-400">Beveled housing with display panel</div>
                  </div>
                </button>

                {/* 5. Organic Figure */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype('ORGANIC_FIGURE')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-left border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-indigo-400 text-xl">pets</span>
                  <div>
                    <div className="font-bold text-xs">🐾 Organic Animal / Figure</div>
                    <div className="text-[10px] text-slate-400">Full 3D geodesic balloon inflation</div>
                  </div>
                </button>

                {/* 6. Logo / Graphic */}
                <button
                  type="button"
                  onClick={() => handleRunParametricArchetype('LOGO_GRAPHIC')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-left border border-slate-700 transition-all flex items-center gap-2 col-span-1 sm:col-span-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-indigo-400 text-xl">label</span>
                  <div>
                    <div className="font-bold text-xs">🏷️ 3D Logo / Vector Graphic Extrusion</div>
                    <div className="text-[10px] text-slate-400">Precision beveled edge with flat front/back faces</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
