import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 'aframe';
import 'mind-ar/dist/mindar-image-aframe.prod.js';
import BuyNowButton from '../components/BuyNowButton';
import '../utils/aframe-components';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ARExperience = () => {
  const { batchId } = useParams();
  const [arData, setArData] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mediaPlaying, setMediaPlaying] = useState(true);

  // NEW DIAGNOSTIC STATE
  const [diagnosticLog, setDiagnosticLog] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const logToScreen = (tag, data) => {
    const payload = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    setDiagnosticLog(prev => prev + `[${tag}]\n${payload}\n\n`);
  };

  useEffect(() => {
    const fetchARPayload = async () => {
      try {
        logToScreen("ROUTER_FETCH", "Fetching batch...");
        const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Batch not found or inactive.");
        
        const data = await response.json();
        logToScreen("ROUTER_PAYLOAD", data);
        
        if (!data || !data.arExperience) {
          setError('No configuration found for this batch');
          return;
        }

        let firestoreConfig = null;
        try {
          const batchRef = doc(db, 'batches', batchId);
          const batchSnap = await getDoc(batchRef);
          if (batchSnap.exists() && batchSnap.data().ar_config) {
            firestoreConfig = batchSnap.data().ar_config;
            logToScreen("FIRESTORE_SUCCESS", "Retrieved ar_config directly.");
          } else {
            logToScreen("FIRESTORE_WARN", "Document exists but no ar_config found.");
          }
        } catch (fsError) {
          logToScreen("FIRESTORE_ERROR", fsError.message);
        }

        const savedConfig = firestoreConfig || data.ar_config || data.arExperience.config || {};
        logToScreen("FINAL_CONFIG", savedConfig);

        setArData({
          gltfPath: data.arExperience.modelUrl,
          mindPath: data.trackingConfig.mindUrl,
          config: savedConfig
        });
        
        if (savedConfig.mediaPlaying !== undefined) {
          setMediaPlaying(savedConfig.mediaPlaying);
        }
      } catch (err) {
        logToScreen("FATAL_ERROR", err.message);
        setError(err.message);
      }
    };
    fetchARPayload();

    // Make sure body and #root are transparent so the AR camera video feed (z-index -2) is visible
    document.body.style.backgroundColor = 'transparent';
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.style.backgroundColor = 'transparent';

    return () => {
      document.body.style.backgroundColor = '';
      if (rootEl) rootEl.style.backgroundColor = '';
    };
  }, [batchId]);

  useEffect(() => {
    const modelEl = document.getElementById('ar-model');
    if (!modelEl) return;

    const onModelLoad = () => {
      logToScreen("GLTF_LOAD", "Model geometry loaded successfully.");
      const mesh = modelEl.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh) {
            const hasMap = node.material.map ? "YES" : "NO";
            logToScreen(`MATERIAL_INSPECT [${node.name}]`, `Has Texture Map: ${hasMap}`);
          }
        });
      }
    };

    const onModelError = (e) => logToScreen("GLTF_ERROR", e.detail);

    modelEl.addEventListener('model-loaded', onModelLoad);
    modelEl.addEventListener('model-error', onModelError);

    return () => {
      modelEl.removeEventListener('model-loaded', onModelLoad);
      modelEl.removeEventListener('model-error', onModelError);
    };
  }, [arData]);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      const { httpsCallable } = await import('firebase/functions');
      const { functions, analytics } = await import('../firebase');
      const { logEvent } = await import('firebase/analytics');

      logEvent(analytics, 'checkout_started', {
        items: [{ item_name: 'AR Garment', price: 99.00 }],
        batch_id: batchId
      });

      // Load Stripe with public key from env
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

  const toggleMedia = () => {
    const nextState = !mediaPlaying;
    setMediaPlaying(nextState);
    
    const aframeVideos = document.querySelectorAll('a-assets video');
    logToScreen("MEDIA_TOGGLE", `Found ${aframeVideos.length} videos. State: ${nextState}`);
    
    aframeVideos.forEach(vid => {
      if (nextState) {
        vid.play()
          .then(() => logToScreen("VIDEO_SUCCESS", vid.src))
          .catch(e => logToScreen("VIDEO_ERROR", `${e.name}: ${e.message}`));
      } else {
        vid.pause();
      }
    });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-black text-white font-sans">
        <div className="p-8 border border-red-500 rounded-lg bg-red-950/30">
          <h2 className="text-2xl mb-4 text-red-500">Error Loading AR</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!arData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-black text-white font-sans space-y-4">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl tracking-widest uppercase font-light text-neutral-400">Initializing The Loom...</p>
      </div>
    );
  }

  // Extract config with defaults
  const cfg = arData.config || {};
  const ambientColor = cfg.ambientColor || '#ffffff';
  const ambientIntensity = cfg.ambientIntensity ?? 1.5;
  const dir1Color = cfg.dir1Color || '#ffffff';
  const dir1Intensity = cfg.dir1Intensity ?? 2.5;
  const dir1Position = cfg.dir1Position || '1 2 1';
  const dir2Color = cfg.dir2Color || '#ffffff';
  const dir2Intensity = cfg.dir2Intensity ?? 1.0;
  const dir2Position = cfg.dir2Position || '-1 -2 -1';
  
  const showBuyButton = cfg.showBuyButton !== undefined ? cfg.showBuyButton : true;
  const buyButtonColor = cfg.buyButtonColor || '#000000';

  const fogColor = cfg.fogColor || '#000000';
  const fogDensity = cfg.fogDensity ?? 0.0;

  // Transform Configs
  const modelScale = cfg.modelScale ?? 0.4;
  const modelRotSpeed = cfg.modelRotSpeed ?? 10000;
  const modelRotX = cfg.modelRotX ?? 90;
  const modelRotY = cfg.modelRotY ?? 0;
  const modelRotZ = cfg.modelRotZ ?? 0;

  // Material Configs
  const matMetalness = cfg.matMetalness ?? 0.0;
  const matRoughness = cfg.matRoughness ?? 1.0;
  const matEmissive = cfg.matEmissive || '#000000';
  const matEmissiveIntensity = cfg.matEmissiveIntensity ?? 0.0;
  const matWireframe = cfg.matWireframe || false;
  const matOpacity = cfg.matOpacity ?? 1.0;

  return (
    <div className="w-screen h-[100dvh] overflow-hidden relative bg-transparent">

      {/* AR Scene */}
      <a-scene
        mindar-image={`imageTargetSrc: ${arData.mindPath}; filterMinCF: 0.0001; filterBeta: 0.001; missTolerance: 5;`}
        color-space="sRGB"
        renderer="colorManagement: true; physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
      >
        <a-assets>
          <a-asset-item id="metaModel" src={arData.gltfPath} crossOrigin="anonymous"></a-asset-item>
        </a-assets>

        {/* Dynamic Lighting */}
        <a-light key={`amb-${ambientColor}-${ambientIntensity}`} type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
        <a-light key={`dir1-${dir1Color}-${dir1Intensity}-${dir1Position}`} type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
        <a-light key={`dir2-${dir2Color}-${dir2Intensity}-${dir2Position}`} type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <a-entity mindar-image-target="targetIndex: 0">
          <a-gltf-model
            id="ar-model"
            src="#metaModel"
            position="0 0 0"
            scale={`${modelScale} ${modelScale} ${modelScale}`}
            rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
            {...(modelRotSpeed > 0 ? { animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${modelRotY + 360} ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;` } : {})}
            dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
            play-gltf-video={`playing: ${mediaPlaying}`}
            play-gltf-animation={`playing: ${mediaPlaying}`}
          ></a-gltf-model>
        </a-entity>
      </a-scene>

      {/* Scanning Overlay (optional aesthetic) */}
      <div className="absolute inset-0 pointer-events-none border-[16px] border-black/20 mix-blend-overlay z-40"></div>

      {/* Media Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
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

      {/* Buy Button Overlay */}
      {showBuyButton && (
        <BuyNowButton 
          color={buyButtonColor} 
          onClick={handleCheckout} 
        />
      )}

      {/* Diagnostic Overlay */}
      {showDiagnostics && (
        <div className="absolute top-0 left-0 w-full h-[50dvh] bg-black/95 z-[9999] p-4 flex flex-col font-mono text-xs shadow-2xl border-b-2 border-red-500">
          <div className="flex justify-between items-center mb-3">
            <span className="text-red-500 font-bold text-sm tracking-widest">SYSTEM DIAGNOSTICS</span>
            <div className="space-x-4">
              <button 
                onClick={() => navigator.clipboard.writeText(diagnosticLog)} 
                className="bg-white text-black px-4 py-2 font-bold rounded"
              >
                COPY
              </button>
              <button 
                onClick={() => setShowDiagnostics(false)} 
                className="text-neutral-400 underline p-2"
              >
                CLOSE
              </button>
            </div>
          </div>
          <textarea 
            readOnly 
            value={diagnosticLog} 
            className="flex-1 w-full bg-neutral-900 text-green-400 border border-neutral-700 p-3 rounded outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
};

export default ARExperience;
