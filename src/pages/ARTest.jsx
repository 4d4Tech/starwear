import React, { useState } from 'react';
import 'aframe';
import BuyNowButton from '../components/BuyNowButton';
import { db, functions, analytics } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logEvent } from 'firebase/analytics';
import { loadStripe } from '@stripe/stripe-js';
import '../utils/aframe-components';

const ARTest = () => {
  const [batchId, setBatchId] = useState('');
  const [arData, setArData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Scene Properties State
  const [ambientColor, setAmbientColor] = useState('#ffffff');
  const [ambientIntensity, setAmbientIntensity] = useState(1.5);

  const [dir1Color, setDir1Color] = useState('#ffffff');
  const [dir1Intensity, setDir1Intensity] = useState(2.5);
  const [dir1Position, setDir1Position] = useState('1 2 1');

  const [dir2Color, setDir2Color] = useState('#ffffff');
  const [dir2Intensity, setDir2Intensity] = useState(1.0);
  const [dir2Position, setDir2Position] = useState('-1 -2 -1');

  // Model & Transform
  const [modelScale, setModelScale] = useState(0.4);
  const [modelRotSpeed, setModelRotSpeed] = useState(10000);
  const [modelRotX, setModelRotX] = useState(90);
  const [modelRotY, setModelRotY] = useState(0);
  const [modelRotZ, setModelRotZ] = useState(0);

  // Material Properties (-1 means preserve GLTF asset PBR settings)
  const [useNativePBR, setUseNativePBR] = useState(true);
  const [matMetalness, setMatMetalness] = useState(-1);
  const [matRoughness, setMatRoughness] = useState(-1);
  const [matEmissive, setMatEmissive] = useState('#000000');
  const [matEmissiveIntensity, setMatEmissiveIntensity] = useState(0.0);
  const [matWireframe, setMatWireframe] = useState(false);
  const [matOpacity, setMatOpacity] = useState(1.0);

  // Environment / Effects
  const [fogColor, setFogColor] = useState('#000000');
  const [fogDensity, setFogDensity] = useState(0.0);

  // UI Elements
  const [showBuyButton, setShowBuyButton] = useState(true);
  const [buyButtonColor, setBuyButtonColor] = useState('#000000');
  const [mediaPlaying, setMediaPlaying] = useState(true);

  // Video Layer & Local Asset Testing States
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [localGlbUrl, setLocalGlbUrl] = useState('');
  const [localGlbName, setLocalGlbName] = useState('');
  const [localVideoName, setLocalVideoName] = useState('');

  const [savingConfig, setSavingConfig] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const pickLocalModel = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setLocalGlbUrl(url);
      setLocalGlbName(file.name);
      setArData((prev) => ({
        ...(prev || {}),
        arExperience: {
          ...(prev?.arExperience || {}),
          modelUrl: url,
          scale: '0.4 0.4 0.4',
          position: '0 0 0',
          rotation: '90 0 0'
        },
        videoUrl: activeVideoUrl || prev?.videoUrl || ''
      }));
    }
  };

  const pickLocalVideo = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setActiveVideoUrl(url);
      setCustomVideoUrl('');
      setLocalVideoName(file.name);
      setMediaPlaying(true);
    }
  };

  const applyCustomVideoUrl = (url) => {
    setCustomVideoUrl(url);
    setActiveVideoUrl(url);
    setLocalVideoName('');
    setMediaPlaying(true);
  };

  const handleLoad = async (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;

    setLoading(true);
    setError(null);
    setLocalGlbUrl('');
    setLocalGlbName('');

    try {
      const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId.trim()}`);
      if (!response.ok) {
        throw new Error("Batch not found or inactive.");
      }
      const data = await response.json();
      let videoUrl = data.arExperience?.videoUrl || data.arExperience?.video || data.videoUrl || '';

      const batchRef = doc(db, 'batches', batchId.trim());
      const batchSnap = await getDoc(batchRef);
      if (batchSnap.exists()) {
        const batchData = batchSnap.data();
        if (batchData.video_url || batchData.videoUrl) {
          videoUrl = batchData.video_url || batchData.videoUrl;
        }
        if (batchData.ar_config) {
          const cfg = batchData.ar_config;
          if (cfg.videoUrl) videoUrl = cfg.videoUrl;
          if (cfg.ambientColor !== undefined) setAmbientColor(cfg.ambientColor);
          if (cfg.ambientIntensity !== undefined) setAmbientIntensity(cfg.ambientIntensity);
          if (cfg.dir1Color !== undefined) setDir1Color(cfg.dir1Color);
          if (cfg.dir1Intensity !== undefined) setDir1Intensity(cfg.dir1Intensity);
          if (cfg.dir1Position !== undefined) setDir1Position(cfg.dir1Position);
          if (cfg.dir2Color !== undefined) setDir2Color(cfg.dir2Color);
          if (cfg.dir2Intensity !== undefined) setDir2Intensity(cfg.dir2Intensity);
          if (cfg.dir2Position !== undefined) setDir2Position(cfg.dir2Position);
          if (cfg.modelScale !== undefined) setModelScale(cfg.modelScale);
          if (cfg.modelRotSpeed !== undefined) setModelRotSpeed(cfg.modelRotSpeed);
          if (cfg.modelRotX !== undefined) setModelRotX(cfg.modelRotX);
          if (cfg.modelRotY !== undefined) setModelRotY(cfg.modelRotY);
          if (cfg.modelRotZ !== undefined) setModelRotZ(cfg.modelRotZ);

          if (cfg.matMetalness !== undefined && cfg.matMetalness >= 0) {
            setMatMetalness(cfg.matMetalness);
            setUseNativePBR(false);
          } else {
            setMatMetalness(-1);
            setUseNativePBR(true);
          }
          if (cfg.matRoughness !== undefined && cfg.matRoughness >= 0) {
            setMatRoughness(cfg.matRoughness);
          } else {
            setMatRoughness(-1);
          }

          if (cfg.matEmissive !== undefined) setMatEmissive(cfg.matEmissive);
          if (cfg.matEmissiveIntensity !== undefined) setMatEmissiveIntensity(cfg.matEmissiveIntensity);
          if (cfg.matWireframe !== undefined) setMatWireframe(cfg.matWireframe);
          if (cfg.matOpacity !== undefined) setMatOpacity(cfg.matOpacity);
          if (cfg.fogColor !== undefined) setFogColor(cfg.fogColor);
          if (cfg.fogDensity !== undefined) setFogDensity(cfg.fogDensity);
          if (cfg.showBuyButton !== undefined) setShowBuyButton(cfg.showBuyButton);
          if (cfg.buyButtonColor !== undefined) setBuyButtonColor(cfg.buyButtonColor);
          if (cfg.mediaPlaying !== undefined) setMediaPlaying(cfg.mediaPlaying);
        }
      }

      if (!videoUrl) {
        try {
          const assetSnap = await getDoc(doc(db, 'assets', batchId.trim()));
          if (assetSnap.exists()) {
            const aData = assetSnap.data();
            if (aData.video_url || aData.videoUrl) {
              videoUrl = aData.video_url || aData.videoUrl;
            }
          }
        } catch { }
      }

      setActiveVideoUrl(videoUrl);
      setArData({
        ...data,
        videoUrl
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!batchId.trim()) return;
    setSavingConfig(true);
    try {
      const batchRef = doc(db, 'batches', batchId.trim());
      await updateDoc(batchRef, {
        video_url: activeVideoUrl || customVideoUrl || arData?.videoUrl || '',
        videoUrl: activeVideoUrl || customVideoUrl || arData?.videoUrl || '',
        ar_config: {
          videoUrl: activeVideoUrl || customVideoUrl || arData?.videoUrl || '',
          ambientColor, ambientIntensity,
          dir1Color, dir1Intensity, dir1Position,
          dir2Color, dir2Intensity, dir2Position,
          modelScale, modelRotSpeed, modelRotX, modelRotY, modelRotZ,
          matMetalness: useNativePBR ? -1 : (matMetalness < 0 ? 0.0 : matMetalness),
          matRoughness: useNativePBR ? -1 : (matRoughness < 0 ? 1.0 : matRoughness),
          matEmissive, matEmissiveIntensity, matWireframe, matOpacity,
          fogColor, fogDensity,
          showBuyButton, buyButtonColor,
          mediaPlaying
        }
      });
      alert('Configuration saved to batch successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving configuration: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleMedia = () => {
    setMediaPlaying(prev => !prev);
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      logEvent(analytics, 'checkout_started', {
        items: [{ item_name: 'AR Garment', price: 99.00 }],
        batch_id: batchId
      });

      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx');
      const createCheckoutSession = httpsCallable(functions, 'createStripeCheckoutSession');

      const response = await createCheckoutSession({
        items: [{
          name: 'AR Garment Purchase',
          price: 99.00,
          quantity: 1
        }],
        successUrl: window.location.origin + '/success',
        cancelUrl: window.location.origin + '/cancel'
      });

      const sessionId = response.data.id;
      if (stripe && sessionId) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Checkout failed. See console for details.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="w-screen min-h-[100dvh] bg-neutral-900 text-white font-sans flex flex-col md:flex-row">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-black border-r border-neutral-800 z-50 flex flex-col shadow-xl flex-shrink-0 h-[100dvh] overflow-y-auto">
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold tracking-wider text-white mb-3">3D SCENE TESTER</h1>
          <form onSubmit={handleLoad} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Enter Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-800 text-white border border-neutral-700 rounded focus:outline-none focus:border-white transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !batchId.trim()}
              className="w-full px-6 py-2 bg-white text-black font-bold uppercase tracking-widest hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs"
            >
              {loading ? 'Loading...' : 'Load from Batch'}
            </button>
          </form>

          {/* Quick Local GLB Loader */}
          <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Or Test Local 3D Model (.glb):</label>
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 rounded text-xs font-medium cursor-pointer transition-colors text-neutral-200 truncate">
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              {localGlbName ? `3D: ${localGlbName}` : 'Choose Local GLB Model'}
              <input type="file" accept=".glb,.gltf" onChange={pickLocalModel} className="hidden" />
            </label>
          </div>

          {arData && (
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full mt-3 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs"
            >
              {savingConfig ? 'Saving...' : 'Save Config & Video to Batch'}
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 mx-4 mt-4 bg-red-950/50 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 space-y-6">
          {/* ============================================================= */}
          {/* VIDEO LAYER CONTROLS                                         */}
          {/* ============================================================= */}
          <div className="p-3 bg-neutral-800/80 border border-indigo-500/40 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">movie</span> Video Layer Inspector
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${activeVideoUrl ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-neutral-700 text-neutral-400'}`}>
                {activeVideoUrl ? 'ACTIVE' : 'NONE'}
              </span>
            </div>

            {/* Video File Picker */}
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 hover:border-indigo-400 rounded text-xs font-medium cursor-pointer transition-colors text-indigo-200">
              <span className="material-symbols-outlined text-[16px]">video_file</span>
              {localVideoName ? `Video: ${localVideoName}` : 'Choose Local Video (.mp4, .webm)'}
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={pickLocalVideo} className="hidden" />
            </label>

            {/* Video URL Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-400">Or Paste Video URL:</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="https://.../video.mp4"
                  value={customVideoUrl || (activeVideoUrl.startsWith('http') ? activeVideoUrl : '')}
                  onChange={(e) => applyCustomVideoUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-indigo-400 font-mono"
                />
                {activeVideoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVideoUrl('');
                      setCustomVideoUrl('');
                      setLocalVideoName('');
                    }}
                    className="px-2 bg-neutral-700 hover:bg-red-900/50 text-neutral-300 hover:text-red-300 rounded text-xs transition-colors"
                    title="Clear Video"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Live Video Preview Box */}
            {activeVideoUrl && (
              <div className="relative rounded overflow-hidden bg-black border border-indigo-500/50 mt-1 shadow-inner">
                <video
                  key={activeVideoUrl}
                  src={activeVideoUrl}
                  autoPlay={mediaPlaying}
                  loop
                  muted
                  playsInline
                  className="object-contain bg-black video-player"
                />
                <div className="absolute top-1 left-1 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  PREVIEW MONITOR
                </div>
              </div>
            )}

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-700/60 text-xs">
              <span className="text-neutral-300">Playback State</span>
              <button
                type="button"
                onClick={toggleMedia}
                className={`px-3 py-1 rounded font-medium text-xs transition-colors ${mediaPlaying ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'}`}
              >
                {mediaPlaying ? '▶ Playing' : '⏸ Paused'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Ambient Light</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Color</span>
                <input type="color" value={ambientColor} onChange={e => setAmbientColor(e.target.value)} className="w-16 h-8 bg-transparent cursor-pointer rounded" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Intensity ({ambientIntensity.toFixed(1)})</span>
                <input type="range" min="0" max="5" step="0.1" value={ambientIntensity} onChange={e => setAmbientIntensity(parseFloat(e.target.value))} className="w-full" />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Directional Light 1</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Color</span>
                <input type="color" value={dir1Color} onChange={e => setDir1Color(e.target.value)} className="w-16 h-8 bg-transparent cursor-pointer rounded" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Intensity ({dir1Intensity.toFixed(1)})</span>
                <input type="range" min="0" max="10" step="0.1" value={dir1Intensity} onChange={e => setDir1Intensity(parseFloat(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Position</span>
                <input type="text" value={dir1Position} onChange={e => setDir1Position(e.target.value)} className="px-2 py-1 bg-neutral-800 text-white border border-neutral-700 rounded focus:outline-none focus:border-neutral-500" />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Directional Light 2</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Color</span>
                <input type="color" value={dir2Color} onChange={e => setDir2Color(e.target.value)} className="w-16 h-8 bg-transparent cursor-pointer rounded" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Intensity ({dir2Intensity.toFixed(1)})</span>
                <input type="range" min="0" max="10" step="0.1" value={dir2Intensity} onChange={e => setDir2Intensity(parseFloat(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Position</span>
                <input type="text" value={dir2Position} onChange={e => setDir2Position(e.target.value)} className="px-2 py-1 bg-neutral-800 text-white border border-neutral-700 rounded focus:outline-none focus:border-neutral-500" />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Transform</h2>
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Scale ({modelScale.toFixed(2)})</span>
                <input type="range" min="0.1" max="2.0" step="0.1" value={modelScale} onChange={e => setModelScale(parseFloat(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Rotation X ({modelRotX}°)</span>
                <input type="range" min="-180" max="180" step="1" value={modelRotX} onChange={e => setModelRotX(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Rotation Y ({modelRotY}°)</span>
                <input type="range" min="-180" max="180" step="1" value={modelRotY} onChange={e => setModelRotY(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Rotation Z ({modelRotZ}°)</span>
                <input type="range" min="-180" max="180" step="1" value={modelRotZ} onChange={e => setModelRotZ(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Rotation Speed (ms)</span>
                <input type="range" min="0" max="20000" step="1000" value={modelRotSpeed} onChange={e => setModelRotSpeed(parseInt(e.target.value))} className="w-full" />
                <span className="text-xs text-neutral-500">0 = Paused</span>
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Materials</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span className="text-emerald-400 font-semibold">Preserve GLTF PBR Materials</span>
                <input
                  type="checkbox"
                  checked={useNativePBR}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUseNativePBR(checked);
                    if (checked) {
                      setMatMetalness(-1);
                      setMatRoughness(-1);
                    } else {
                      setMatMetalness(0.0);
                      setMatRoughness(1.0);
                    }
                  }}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </label>

              {useNativePBR ? (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded text-xs text-emerald-300">
                  ✨ Preserving embedded GLTF textures, metalness & roughness maps.
                </div>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Metalness ({matMetalness >= 0 ? matMetalness.toFixed(2) : 'Default'})</span>
                    <input type="range" min="0" max="1" step="0.05" value={matMetalness >= 0 ? matMetalness : 0.0} onChange={e => setMatMetalness(parseFloat(e.target.value))} className="w-full" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Roughness ({matRoughness >= 0 ? matRoughness.toFixed(2) : 'Default'})</span>
                    <input type="range" min="0" max="1" step="0.05" value={matRoughness >= 0 ? matRoughness : 1.0} onChange={e => setMatRoughness(parseFloat(e.target.value))} className="w-full" />
                  </label>
                </>
              )}
              <label className="flex items-center justify-between text-sm">
                <span>Emissive Color</span>
                <input type="color" value={matEmissive} onChange={e => setMatEmissive(e.target.value)} className="w-16 h-8 bg-transparent cursor-pointer rounded" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Emissive Intensity ({matEmissiveIntensity.toFixed(1)})</span>
                <input type="range" min="0" max="5" step="0.1" value={matEmissiveIntensity} onChange={e => setMatEmissiveIntensity(parseFloat(e.target.value))} className="w-full" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Opacity ({matOpacity.toFixed(2)})</span>
                <input type="range" min="0" max="1" step="0.05" value={matOpacity} onChange={e => setMatOpacity(parseFloat(e.target.value))} className="w-full" />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Wireframe</span>
                <input type="checkbox" checked={matWireframe} onChange={e => setMatWireframe(e.target.checked)} className="w-5 h-5 accent-white cursor-pointer" />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">Environment</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Fog Color</span>
                <input type="color" value={fogColor} onChange={e => setFogColor(e.target.value)} className="w-16 h-8 bg-transparent cursor-pointer rounded" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Fog Density ({fogDensity.toFixed(3)})</span>
                <input type="range" min="0" max="0.5" step="0.01" value={fogDensity} onChange={e => setFogDensity(parseFloat(e.target.value))} className="w-full" />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-3 border-b border-neutral-800 pb-1">UI Overlays</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Show "Buy Now" Button</span>
                <input type="checkbox" checked={showBuyButton} onChange={e => setShowBuyButton(e.target.checked)} className="w-5 h-5 accent-white cursor-pointer" />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Button Color</span>
                <input type="color" value={buyButtonColor} onChange={e => setBuyButtonColor(e.target.value)} disabled={!showBuyButton} className="w-16 h-8 bg-transparent cursor-pointer rounded disabled:opacity-50" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 relative bg-neutral-900 overflow-hidden">
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) ? (
          <a-scene
            key={localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath}
            embedded
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false"
            scene-environment="exposure: 1.0"
            fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <a-camera position="0 0 2.5" look-controls="enabled: true" wasd-controls="enabled: false">
              {/* Front Headlight attached to camera ensures model is always lit */}
              <a-light type="directional" color="#ffffff" intensity="1.2" position="0 0 1"></a-light>
            </a-camera>

            {/* Dynamic Lighting Rig */}
            <a-light type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
            <a-light type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
            <a-light type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

            <a-entity position="0 0 0">
              <a-gltf-model
                id="ar-model"
                src={localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath}
                position="0 0 0"
                scale={`${modelScale} ${modelScale} ${modelScale}`}
                rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
                {...(modelRotSpeed > 0 ? { animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${modelRotY + 360} ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;` } : {})}
                model-auto-center="enabled: true"
                dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
                play-gltf-video={`src: ${activeVideoUrl || customVideoUrl || arData?.videoUrl || ''}; playing: ${mediaPlaying}`}
                play-gltf-animation={`playing: ${mediaPlaying}`}
              >
              </a-gltf-model>
            </a-entity>
          </a-scene>
        ) : (
          !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 space-y-4 p-8 text-center">
              <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              <p className="text-lg max-w-md">Enter a Batch ID and adjust real-time lighting settings to preview your AR models accurately.</p>
            </div>
          )
        )}

        {/* Media Controls */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000
        }}>
          <button
            onClick={toggleMedia}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              border: '1px solid white',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <span className="material-symbols-outlined">
              {mediaPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>

        {/* Extracted BuyNowButton component */}
        {showBuyButton && (
          <BuyNowButton
            color={buyButtonColor}
            onClick={handleCheckout}
          />
        )}
      </div>
    </div>
  );
};

export default ARTest;
