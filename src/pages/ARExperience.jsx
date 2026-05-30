import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 'aframe';
import 'mind-ar/dist/mindar-image-aframe.prod.js';
import BuyNowButton from '../components/BuyNowButton';
import '../utils/aframe-components';

const ARExperience = () => {
  const { batchId } = useParams();
  const [arData, setArData] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mediaPlaying, setMediaPlaying] = useState(true);

  useEffect(() => {
    const fetchARPayload = async () => {
      try {
        const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId}?t=${Date.now()}`);
        if (!response.ok) {
          throw new Error("Batch not found or inactive.");
        }
        const data = await response.json();
        
        if (!data || !data.arExperience) {
          setError('No configuration found for this batch');
          return;
        }

        setArData({
          gltfPath: data.arExperience.modelUrl,
          mindPath: data.trackingConfig.mindUrl,
          config: data.arExperience.config || {}
        });
        
        if (data.arExperience.config && data.arExperience.config.mediaPlaying !== undefined) {
          setMediaPlaying(data.arExperience.config.mediaPlaying);
        }
      } catch (err) {
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
    setMediaPlaying(prev => !prev);
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
    </div>
  );
};

export default ARExperience;
