import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 'aframe';
import 'mind-ar/dist/mindar-image-aframe.prod.js';
import BuyNowButton from '../components/BuyNowButton';
import '../utils/aframe-components';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ARExperience = ({ propBatchId, onBack, isTestMode }) => {
  const { batchId: routeBatchId } = useParams();
  const batchId = propBatchId || routeBatchId;
  const [arData, setArData] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mediaPlaying, setMediaPlaying] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(!isTestMode);
  const [trackingStatus, setTrackingStatus] = useState('SEARCHING');

  // DIAGNOSTIC STATE
  const [diagnosticLog, setDiagnosticLog] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const logToScreen = (tag, data) => {
    const payload = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    setDiagnosticLog(prev => prev + `[${tag}]\n${payload}\n\n`);
  };

  useEffect(() => {
    const handleError = (event) => {
      logToScreen("WINDOW_ERROR", event.message || event.error || String(event));
    };
    const handleRejection = (event) => {
      logToScreen("PROMISE_REJECTION", String(event.reason));
    };
    
    const originalConsoleError = console.error;
    console.error = (...args) => {
      logToScreen("CONSOLE_ERROR", args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch(e) {
          return String(arg);
        }
      }).join(' '));
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

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

        if (data.trackingConfig && data.trackingConfig.mindUrl) {
          try {
            logToScreen("MIND_FILE_TEST", `Fetching .mind binary data...`);
            const mindRes = await fetch(data.trackingConfig.mindUrl);
            if (!mindRes.ok) {
              logToScreen("MIND_FILE_STATUS", `HTTP Status: ${mindRes.status} ${mindRes.statusText}`);
            } else {
              const mindBuf = await mindRes.arrayBuffer();
              logToScreen("MIND_FILE_STATUS", `HTTP 200 OK | File Size: ${mindBuf.byteLength} bytes`);
              if (mindBuf.byteLength < 500) {
                logToScreen("MIND_FILE_WARN", `WARNING: .mind file is under 500 bytes (${mindBuf.byteLength} B). It may contain zero compiled features!`);
              }
            }
          } catch (mErr) {
            logToScreen("MIND_FILE_WARN", `Fetch check error: ${mErr.message}`);
          }
        }

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

    return () => {
      document.body.style.backgroundColor = '';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.backgroundColor = '';
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
    };
  }, [batchId]);

  useEffect(() => {
    if (cameraEnabled) {
      document.body.style.backgroundColor = 'transparent';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.backgroundColor = 'transparent';
    } else {
      document.body.style.backgroundColor = '#0f172a';
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.backgroundColor = '#0f172a';

      // Clean up webcam stream and video elements
      const timer = setTimeout(() => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
            video.srcObject.getTracks().forEach(track => track.stop());
          }
          video.srcObject = null;
          video.remove();
        });
        
        // Remove mindar UI overlay
        const mindarUI = document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-scanning, .mindar-ui-loading');
        mindarUI.forEach(el => el.remove());
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [cameraEnabled]);

  useEffect(() => {
    const sceneEl = document.querySelector('a-scene');
    const modelEl = document.getElementById('ar-model');
    const targetEl = document.getElementById('target-entity');

    const updateMeshMaterials = () => {
      if (!modelEl) return;
      
      // Trigger custom components if attached
      if (modelEl.components && modelEl.components['dynamic-materials']) {
        modelEl.components['dynamic-materials'].applyMaterials();
      }
      if (modelEl.components && modelEl.components['play-gltf-video']) {
        modelEl.components['play-gltf-video'].applyVideo();
      }

      const mesh = modelEl.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh && node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((mat) => {
              mat.side = (window.AFRAME && window.AFRAME.THREE) ? window.AFRAME.THREE.DoubleSide : 2;
              const maps = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'alphaMap'];
              maps.forEach(mapName => {
                if (mat[mapName]) {
                  mat[mapName].needsUpdate = true;
                }
              });
              mat.needsUpdate = true;
            });
          }
        });
      }
    };

    const onModelLoad = () => {
      logToScreen("GLTF_LOAD", "Model geometry loaded successfully.");
      updateMeshMaterials();
      const mesh = modelEl ? modelEl.getObject3D('mesh') : null;
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh) {
            const mat = node.material;
            if (mat) {
              const hasMap = mat.map ? "YES" : "NO";
              const colorHex = mat.color ? `#${mat.color.getHexString()}` : 'N/A';
              const emissiveHex = mat.emissive ? `#${mat.emissive.getHexString()}` : 'N/A';
              const details = `Type: ${mat.type} | Color: ${colorHex} | Emissive: ${emissiveHex} | Roughness: ${mat.roughness ?? 'N/A'} | Metalness: ${mat.metalness ?? 'N/A'} | Has Texture: ${hasMap}`;
              logToScreen(`MATERIAL_INSPECT [${node.name}]`, details);
            }
          }
        });
      }
    };

    const onModelError = (e) => logToScreen("GLTF_ERROR", e.detail);

    const onTargetFound = () => {
      logToScreen("TARGET_FOUND", "Image target detected!");
      setTrackingStatus('DETECTED');
      updateMeshMaterials();
    };

    const onTargetLost = () => {
      logToScreen("TARGET_LOST", "Image target lost from camera view.");
      setTrackingStatus('SCANNING');
    };

    const onArReady = () => {
      logToScreen("MINDAR_READY", "MindAR tracking engine initialized and active!");
      setTrackingStatus('SCANNING');
      
      // Inspect HTML video element feed state
      const videos = document.querySelectorAll('video');
      if (videos.length === 0) {
        logToScreen("CAMERA_WARN", "No HTML video element found in DOM.");
      } else {
        videos.forEach((v, idx) => {
          logToScreen(`CAMERA_FEED [${idx}]`, `Width: ${v.videoWidth}px | Height: ${v.videoHeight}px | Paused: ${v.paused} | ReadyState: ${v.readyState}`);
          if (v.paused) {
            v.play().catch(e => logToScreen("CAMERA_PLAY_ERR", e.message));
          }
        });
      }
    };

    const onArError = (e) => {
      logToScreen("MINDAR_ERROR", e.detail || "MindAR tracking error occurred.");
      setTrackingStatus('ERROR');
    };

    if (sceneEl) {
      sceneEl.addEventListener('arReady', onArReady);
      sceneEl.addEventListener('arError', onArError);
    }
    if (modelEl) {
      modelEl.addEventListener('model-loaded', onModelLoad);
      modelEl.addEventListener('model-error', onModelError);
      if (modelEl.getObject3D('mesh')) {
        updateMeshMaterials();
      }
    }
    let observer = null;
    if (targetEl) {
      targetEl.addEventListener('targetFound', onTargetFound);
      targetEl.addEventListener('targetLost', onTargetLost);

      // Observe attribute changes on target entity (e.g. visible, position)
      try {
        observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
              const val = targetEl.getAttribute(mutation.attributeName);
              logToScreen(`TARGET_MUTATION [${mutation.attributeName}]`, typeof val === 'object' ? JSON.stringify(val) : String(val));
              if (mutation.attributeName === 'visible' && (val === true || val === 'true')) {
                setTrackingStatus('DETECTED');
                updateMeshMaterials();
              }
            }
          });
        });
        observer.observe(targetEl, { attributes: true });
      } catch (obsErr) {
        logToScreen("OBSERVER_ERR", obsErr.message);
      }
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (sceneEl) {
        sceneEl.removeEventListener('arReady', onArReady);
        sceneEl.removeEventListener('arError', onArError);
      }
      if (modelEl) {
        modelEl.removeEventListener('model-loaded', onModelLoad);
        modelEl.removeEventListener('model-error', onModelError);
      }
      if (targetEl) {
        targetEl.removeEventListener('targetFound', onTargetFound);
        targetEl.removeEventListener('targetLost', onTargetLost);
      }
    };
  }, [arData, cameraEnabled]);

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

  // Extract config with default lighting & material overrides
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

  // Material Configs (default to -1 to preserve GLTF embedded PBR maps)
  const matMetalness = (cfg.matMetalness !== undefined && cfg.matMetalness >= 0) ? cfg.matMetalness : -1;
  const matRoughness = (cfg.matRoughness !== undefined && cfg.matRoughness >= 0) ? cfg.matRoughness : -1;
  const matEmissive = cfg.matEmissive || '#000000';
  const matEmissiveIntensity = cfg.matEmissiveIntensity !== undefined ? cfg.matEmissiveIntensity : 0.0;
  const matWireframe = cfg.matWireframe || false;
  const matOpacity = cfg.matOpacity ?? 1.0;

  return (
    <div className="w-screen h-[100dvh] overflow-hidden relative bg-transparent">
      {onBack && (
        <button 
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Exit Test
        </button>
      )}

      {/* AR Scene */}
      {!cameraEnabled ? (
        <a-scene
          embedded
          color-space="sRGB"
          renderer="colorManagement: true; physicallyCorrectLights: false;"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          loading-screen="enabled: false"
          fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#0f172a' }}
        >
          <a-assets>
            <a-asset-item id="metaModel" src={arData.gltfPath} crossOrigin="anonymous"></a-asset-item>
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled: true" wasd-controls="enabled: false">
            {/* Front Headlight attached to camera */}
            <a-light type="directional" color="#ffffff" intensity="1.5" position="0 0 1"></a-light>
          </a-camera>

          {/* Dynamic Lighting MUST be at root to avoid matrix scale crushing */}
          <a-light type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
          <a-light type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
          <a-light type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

          {/* Tracking/Test Target */}
          <a-entity id="target-entity" position="0 0 -2.5">
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
      ) : (
        <a-scene
          mindar-image={`imageTargetSrc: ${arData.mindPath}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no;`}
          color-space="sRGB"
          renderer="colorManagement: true; physicallyCorrectLights: false;"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          loading-screen="enabled: false"
          fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
        >
          <a-assets>
            <a-asset-item id="metaModel" src={arData.gltfPath} crossOrigin="anonymous"></a-asset-item>
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false">
            {/* Front Headlight attached to camera ensures phone camera facing side is always lit */}
            <a-light type="directional" color="#ffffff" intensity="1.5" position="0 0 1"></a-light>
          </a-camera>

          {/* Dynamic Lighting MUST be at root to avoid matrix scale crushing */}
          <a-light type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
          <a-light type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
          <a-light type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

          {/* Tracking/Test Target */}
          <a-entity id="target-entity" mindar-image-target="targetIndex: 0">
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
      )}

      {/* Scanning Overlay (optional aesthetic) */}
      <div className="absolute inset-0 pointer-events-none border-[16px] border-black/20 mix-blend-overlay z-40"></div>

      {/* Live Marker Tracking Status Badge */}
      {cameraEnabled && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {trackingStatus === 'DETECTED' ? (
            <div className="px-4 py-2 bg-emerald-600/90 text-white font-bold text-xs uppercase tracking-widest rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 border border-emerald-400/30">
              <span className="w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping"></span>
              Target Recognized
            </div>
          ) : trackingStatus === 'ERROR' ? (
            <div className="px-4 py-2 bg-red-600/90 text-white font-bold text-xs uppercase tracking-widest rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 border border-red-400/30">
              <span className="w-2.5 h-2.5 bg-red-300 rounded-full"></span>
              Tracking Error
            </div>
          ) : (
            <div className="px-4 py-2 bg-slate-900/80 text-amber-300 font-bold text-xs uppercase tracking-widest rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 border border-amber-500/30">
              <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
              Point Camera at Marker...
            </div>
          )}
        </div>
      )}

      {/* Controls Container */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        gap: '12px'
      }}>
        {/* Camera/Tracking Toggle Button */}
        <button 
          onClick={() => setCameraEnabled(!cameraEnabled)}
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
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
        >
          <span className="material-symbols-outlined">
            {cameraEnabled ? 'videocam_off' : 'videocam'}
          </span>
        </button>

        {/* Media Toggle Button */}
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
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          title={mediaPlaying ? "Pause Video/Animation" : "Play Video/Animation"}
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
            <div className="space-x-2 flex items-center">
              <button 
                onClick={() => {
                  const targetEl = document.getElementById('target-entity');
                  if (targetEl) {
                    targetEl.setAttribute('visible', 'true');
                    logToScreen("SIMULATION", "Forced target-entity visible = true");
                    setTrackingStatus('DETECTED');
                  }
                }} 
                className="bg-amber-500 text-black px-3 py-1 font-bold text-xs rounded hover:bg-amber-400"
              >
                TEST DETECT
              </button>
              <button 
                onClick={() => navigator.clipboard.writeText(diagnosticLog)} 
                className="bg-white text-black px-3 py-1 font-bold text-xs rounded"
              >
                COPY
              </button>
              <button 
                onClick={() => setShowDiagnostics(false)} 
                className="text-neutral-400 underline p-1 text-xs"
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
