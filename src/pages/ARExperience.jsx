import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import 'aframe';
import 'mind-ar/dist/mindar-image-aframe.prod.js';
import * as THREE from 'three';
import BuyNowButton from '../components/BuyNowButton';
import { isYouTubeShortUrl } from '../utils/aframe-components';
import { db, storage } from '../firebase';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';

// Disable Three.js internal caching to guarantee latest GLTF/GLB models are always fetched
if (typeof THREE !== 'undefined' && THREE.Cache) {
  THREE.Cache.enabled = false;
  THREE.Cache.clear();
}

const ARExperience = ({ propBatchId, onBack, isTestMode }) => {
  const { batchId: routeBatchId } = useParams();
  const batchId = (propBatchId || routeBatchId || '').trim();

  const [arData, setArData] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [mediaPlaying, setMediaPlaying] = useState(true);
  const [mediaMuted, setMediaMuted] = useState(false);

  useEffect(() => {
    const handleMuteStatus = (e) => {
      if (e && e.detail && typeof e.detail.muted === 'boolean') {
        setMediaMuted(e.detail.muted);
      }
    };
    window.addEventListener('starwear-video-mute-status', handleMuteStatus);
    return () => window.removeEventListener('starwear-video-mute-status', handleMuteStatus);
  }, []);

  useEffect(() => {
    document.documentElement.style.backgroundColor = '#0b0f19';
    return () => {
      document.documentElement.style.backgroundColor = '';
    };
  }, []);
  const [cameraEnabled, setCameraEnabled] = useState(!isTestMode);
  const [trackingStatus, setTrackingStatus] = useState('INITIALIZING'); // INITIALIZING | SCANNING | DETECTED | ERROR
  const [forceShowModel, setForceShowModel] = useState(false);

  // Diagnostics State
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const sceneRef = useRef(null);

  // Studio4D4 Style OrbitControls & Camera References
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const defaultCamPosRef = useRef(new THREE.Vector3(0, 0.4, 2.5));
  const defaultTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const [cameraAutoRotate, setCameraAutoRotate] = useState(false);
  const cameraTransitionIdRef = useRef(null);

  const getOrbitControls = useCallback(() => {
    if (controlsRef.current) return controlsRef.current;
    if (typeof window !== 'undefined' && window.__arOrbitControls) {
      controlsRef.current = window.__arOrbitControls;
      return window.__arOrbitControls;
    }
    const cameraEl = document.getElementById('experience-camera');
    if (cameraEl && cameraEl.orbitControls) {
      controlsRef.current = cameraEl.orbitControls;
      return cameraEl.orbitControls;
    }
    if (cameraEl && cameraEl.components && cameraEl.components['orbit-camera-controls']?.controls) {
      controlsRef.current = cameraEl.components['orbit-camera-controls'].controls;
      return controlsRef.current;
    }
    return null;
  }, []);

  const getThreeCamera = useCallback(() => {
    if (cameraRef.current) return cameraRef.current;
    if (typeof window !== 'undefined' && window.__arOrbitCamera) {
      cameraRef.current = window.__arOrbitCamera;
      return window.__arOrbitCamera;
    }
    const sceneEl = sceneRef.current || document.querySelector('a-scene');
    const cam = sceneEl?.camera || document.getElementById('experience-camera')?.getObject3D('camera');
    if (cam) cameraRef.current = cam;
    return cam;
  }, []);

  const toggleCameraAutoRotate = () => {
    setCameraAutoRotate((prev) => {
      const next = !prev;
      const controls = getOrbitControls();
      if (controls) {
        controls.autoRotate = next;
      }
      return next;
    });
  };

  const transitionCamera = useCallback((toPos, toTarget, duration = 350) => {
    if (cameraTransitionIdRef.current) {
      cancelAnimationFrame(cameraTransitionIdRef.current);
      cameraTransitionIdRef.current = null;
    }

    const camera = getThreeCamera();
    const controls = getOrbitControls();
    if (!camera) return;

    if (!controls) {
      camera.position.copy(toPos);
      if (toTarget) camera.lookAt(toTarget);
      camera.updateMatrixWorld();
      return;
    }

    const startPos = camera.position.clone();
    const startTarget = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const targetEnd = toTarget ? toTarget.clone() : startTarget.clone();
    const startTime = performance.now();

    const animateTransition = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, toPos, ease);
      controls.target.lerpVectors(startTarget, targetEnd, ease);
      camera.lookAt(controls.target);
      controls.update();

      if (progress < 1.0) {
        cameraTransitionIdRef.current = requestAnimationFrame(animateTransition);
      } else {
        cameraTransitionIdRef.current = null;
      }
    };

    cameraTransitionIdRef.current = requestAnimationFrame(animateTransition);
  }, [getThreeCamera, getOrbitControls]);

  const setCameraView = useCallback((viewName) => {
    const camera = getThreeCamera();
    const controls = getOrbitControls();
    if (!camera || !controls) return;

    const target = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const currentDist = camera.position.distanceTo(target);
    const dist = Math.max(0.5, currentDist > 0.1 ? currentDist : defaultCamPosRef.current.length());

    const newPos = new THREE.Vector3();

    switch (viewName) {
      case 'perspective':
      case 'reset':
        target.copy(defaultTargetRef.current);
        newPos.copy(defaultCamPosRef.current);
        break;
      case 'front':
        newPos.set(target.x, target.y, target.z + dist);
        break;
      case 'back':
        newPos.set(target.x, target.y, target.z - dist);
        break;
      case 'left':
        newPos.set(target.x - dist, target.y, target.z);
        break;
      case 'right':
        newPos.set(target.x + dist, target.y, target.z);
        break;
      case 'top':
        newPos.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case 'bottom':
        newPos.set(target.x, target.y - dist, target.z + 0.0001);
        break;
      default:
        target.copy(defaultTargetRef.current);
        newPos.copy(defaultCamPosRef.current);
        break;
    }

    transitionCamera(newPos, target, 350);
  }, [getThreeCamera, getOrbitControls, transitionCamera]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'f' || e.key === 'F') {
        if (!cameraEnabled) {
          e.preventDefault();
          setCameraView('reset');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraEnabled, setCameraView]);

  const logToScreen = (tag, data) => {
    const payload = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    const timestamp = new Date().toLocaleTimeString();
    setDiagnosticLogs((prev) => [
      { id: Date.now() + Math.random(), time: timestamp, tag, text: payload },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  // Helper to add timestamp-based cache buster to URLs
  const addCacheBuster = (url, cacheKey) => {
    if (!url) return '';
    const sep = url.includes('?') ? '&' : '?';
    const cb = cacheKey || Date.now();
    return `${url}${sep}_cb=${cb}`;
  };

  // 1. Fetch AR Data & Config with strict cache bypassing
  useEffect(() => {
    let isMounted = true;

    // Clear Three.js memory cache on mount
    if (typeof THREE !== 'undefined' && THREE.Cache) {
      THREE.Cache.clear();
    }

    const fetchPayload = async () => {
      try {
        logToScreen('ROUTER_FETCH', `Loading configuration for batch: ${batchId}...`);
        const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        if (!response.ok) throw new Error(`Batch router error: HTTP ${response.status}`);

        const data = await response.json();
        logToScreen('ROUTER_PAYLOAD', data);

        if (!data || !data.arExperience) {
          throw new Error('No 3D experience configuration found for this batch.');
        }

        // Fetch live ar_config directly from Firestore server (bypassing local client cache)
        let liveConfig = null;
        let batchDocData = null;
        let assetDocData = null;

        try {
          let batchSnap = null;
          try {
            batchSnap = await getDocFromServer(doc(db, 'batches', batchId));
          } catch {
            batchSnap = await getDoc(doc(db, 'batches', batchId));
          }

          if (batchSnap && batchSnap.exists()) {
            batchDocData = batchSnap.data();
          }
        } catch (fsErr) {
          logToScreen('FIRESTORE_BATCH_WARN', fsErr.message);
        }

        const targetAssetId = batchDocData?.asset_id || batchDocData?.assetId || data?.asset_id || data?.assetId || batchId;

        try {
          let assetSnap = null;
          try {
            assetSnap = await getDocFromServer(doc(db, 'assets', targetAssetId));
          } catch {
            assetSnap = await getDoc(doc(db, 'assets', targetAssetId));
          }
          if (assetSnap && assetSnap.exists()) {
            assetDocData = assetSnap.data();
          }
        } catch (fsErr) {
          logToScreen('FIRESTORE_ASSET_WARN', fsErr.message);
        }

        const extractConfigFields = (docData) => {
          if (!docData || typeof docData !== 'object') return {};
          const cfg = {};
          if (docData.config && typeof docData.config === 'object') Object.assign(cfg, docData.config);
          if (docData.arExperience?.config && typeof docData.arExperience.config === 'object') Object.assign(cfg, docData.arExperience.config);
          if (docData.ar_config && typeof docData.ar_config === 'object') Object.assign(cfg, docData.ar_config);
          if (docData.lighting && typeof docData.lighting === 'object') Object.assign(cfg, docData.lighting);
          if (docData.lightingConfig && typeof docData.lightingConfig === 'object') Object.assign(cfg, docData.lightingConfig);
          if (docData.portalConfig && typeof docData.portalConfig === 'object') cfg.portalConfig = docData.portalConfig;
          if (docData.particleConfig && typeof docData.particleConfig === 'object') cfg.particleConfig = docData.particleConfig;
          if (Array.isArray(docData.additionalGeometries)) cfg.additionalGeometries = docData.additionalGeometries;
          if (Array.isArray(docData.custom3DTexts)) cfg.custom3DTexts = docData.custom3DTexts;
          if (Array.isArray(docData.customLights)) cfg.customLights = docData.customLights;
          if (Array.isArray(docData.ar_config?.additionalGeometries)) cfg.additionalGeometries = docData.ar_config.additionalGeometries;
          if (Array.isArray(docData.ar_config?.custom3DTexts)) cfg.custom3DTexts = docData.ar_config.custom3DTexts;
          if (Array.isArray(docData.ar_config?.customLights)) cfg.customLights = docData.ar_config.customLights;
          if (Array.isArray(docData.config?.custom3DTexts)) cfg.custom3DTexts = docData.config.custom3DTexts;
          if (Array.isArray(docData.config?.customLights)) cfg.customLights = docData.config.customLights;

          const directLightingKeys = [
            'ambientColor', 'ambientIntensity',
            'dir1Color', 'dir1Intensity', 'dir1Position',
            'dir2Color', 'dir2Intensity', 'dir2Position',
            'rimColor', 'rimIntensity', 'rimPosition'
          ];
          directLightingKeys.forEach((key) => {
            if (docData[key] !== undefined && docData[key] !== null) {
              cfg[key] = docData[key];
            }
          });
          return cfg;
        };

        const assetCfg = extractConfigFields(assetDocData);
        const batchCfg = extractConfigFields(batchDocData);

        const mergedFsConfig = {
          ...assetCfg,
          ...batchCfg,
          ...(assetDocData?.portalConfig ? { portalConfig: assetDocData.portalConfig } : {}),
          ...(assetDocData?.particleConfig ? { particleConfig: assetDocData.particleConfig } : {}),
          ...(batchDocData?.portalConfig ? { portalConfig: batchDocData.portalConfig } : {}),
          ...(batchDocData?.particleConfig ? { particleConfig: batchDocData.particleConfig } : {}),
          ...(Array.isArray(assetDocData?.additionalGeometries) ? { additionalGeometries: assetDocData.additionalGeometries } : {}),
          ...(Array.isArray(batchDocData?.additionalGeometries) ? { additionalGeometries: batchDocData.additionalGeometries } : {}),
          ...(Array.isArray(assetDocData?.custom3DTexts) ? { custom3DTexts: assetDocData.custom3DTexts } : {}),
          ...(Array.isArray(assetDocData?.ar_config?.custom3DTexts) ? { custom3DTexts: assetDocData.ar_config.custom3DTexts } : {}),
          ...(Array.isArray(batchDocData?.custom3DTexts) ? { custom3DTexts: batchDocData.custom3DTexts } : {}),
          ...(Array.isArray(batchDocData?.ar_config?.custom3DTexts) ? { custom3DTexts: batchDocData.ar_config.custom3DTexts } : {}),
          ...(Array.isArray(assetDocData?.customLights) ? { customLights: assetDocData.customLights } : {}),
          ...(Array.isArray(assetDocData?.ar_config?.customLights) ? { customLights: assetDocData.ar_config.customLights } : {}),
          ...(Array.isArray(batchDocData?.customLights) ? { customLights: batchDocData.customLights } : {}),
          ...(Array.isArray(batchDocData?.ar_config?.customLights) ? { customLights: batchDocData.ar_config.customLights } : {})
        };
        const hasFsConfig = Object.keys(mergedFsConfig).length > 0;
        if (hasFsConfig) {
          liveConfig = mergedFsConfig;
          logToScreen('FIRESTORE_CONFIG', 'Using live Firestore configuration merged from batches and assets.');
        }

        // Check local preview calibration config (for instant preview from AR Test editor)
        let localPreviewConfig = null;
        try {
          const batchSpecificStored = localStorage.getItem(`starwear_live_preview_config_${batchId}`);
          if (batchSpecificStored) {
            localPreviewConfig = JSON.parse(batchSpecificStored);
            logToScreen('LOCAL_PREVIEW_CONFIG', `Loaded active calibration config for ${batchId} from AR Test session.`);
          } else if (!hasFsConfig) {
            const lastStored = localStorage.getItem('starwear_live_preview_config_last');
            if (lastStored) {
              localPreviewConfig = JSON.parse(lastStored);
              logToScreen('LOCAL_PREVIEW_CONFIG', 'Loaded fallback calibration config from AR Test session.');
            }
          }
        } catch {}

        // Check URL search params for preview overrides (e.g. ?portal=1, ?particles=1, ?particle=1)
        let urlPortalOverride = null;
        let urlParticlesOverride = null;
        try {
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get('portal') === '1' || searchParams.get('portal') === 'true') {
            urlPortalOverride = { enabled: true };
          }
          if (
            searchParams.get('particles') === '1' ||
            searchParams.get('particles') === 'true' ||
            searchParams.get('particle') === '1' ||
            searchParams.get('particle') === 'true'
          ) {
            urlParticlesOverride = { enabled: true };
          }
        } catch {}

        const isFlipX = !!(
          liveConfig?.videoFlipX ??
          liveConfig?.video_flip_x ??
          data?.arExperience?.config?.videoFlipX ??
          data?.ar_config?.videoFlipX ??
          data?.videoFlipX ??
          false
        );

        // Fetch Global Tracking defaults from settings/tracking in Firestore
        let globalTracking = null;
        try {
          const globalTrackingSnap = await getDoc(doc(db, 'settings', 'tracking'));
          if (globalTrackingSnap.exists()) {
            globalTracking = globalTrackingSnap.data();
          }
        } catch {}

        const activeTracking = liveConfig?.trackingConfig || liveConfig?.tracking ||
                               localPreviewConfig?.trackingConfig ||
                               data?.arExperience?.config?.trackingConfig || data?.ar_config?.trackingConfig ||
                               data?.trackingConfig || {};

        const mergedTracking = {
          filterMinCF: 0.0005,
          filterBeta: 0.01,
          missTolerance: 6,
          warmupTolerance: 2,
          maxTrack: 1,
          targetIndex: 0,
          showStats: false,
          uiLoading: 'no',
          uiScanning: 'no',
          uiError: 'yes',
          ...(globalTracking || {}),
          ...activeTracking
        };

        const getNonEmptyArray = (...candidates) => {
          for (const cand of candidates) {
            if (Array.isArray(cand) && cand.length > 0) return cand;
          }
          for (const cand of candidates) {
            if (Array.isArray(cand)) return cand;
          }
          return [];
        };

        const resolvedGeometries = getNonEmptyArray(
          localPreviewConfig?.additionalGeometries,
          batchDocData?.additionalGeometries,
          batchDocData?.ar_config?.additionalGeometries,
          assetDocData?.additionalGeometries,
          assetDocData?.ar_config?.additionalGeometries,
          data?.additionalGeometries,
          data?.ar_config?.additionalGeometries
        );

        const resolved3DTexts = getNonEmptyArray(
          localPreviewConfig?.custom3DTexts,
          localPreviewConfig?.ar_config?.custom3DTexts,
          batchDocData?.custom3DTexts,
          batchDocData?.ar_config?.custom3DTexts,
          assetDocData?.custom3DTexts,
          assetDocData?.ar_config?.custom3DTexts,
          data?.custom3DTexts,
          data?.ar_config?.custom3DTexts
        );

        const resolvedLights = getNonEmptyArray(
          localPreviewConfig?.customLights,
          localPreviewConfig?.ar_config?.customLights,
          batchDocData?.customLights,
          batchDocData?.ar_config?.customLights,
          assetDocData?.customLights,
          assetDocData?.ar_config?.customLights,
          data?.customLights,
          data?.ar_config?.customLights
        );

        const mergedConfig = {
          ...(data.arExperience?.config || {}),
          ...(data.ar_config || {}),
          ...(data.portalConfig ? { portalConfig: data.portalConfig } : {}),
          ...(data.particleConfig ? { particleConfig: data.particleConfig } : {}),
          ...(assetDocData?.ar_config?.portalConfig ? { portalConfig: assetDocData.ar_config.portalConfig } : {}),
          ...(assetDocData?.ar_config?.particleConfig ? { particleConfig: assetDocData.ar_config.particleConfig } : {}),
          ...(assetDocData?.portalConfig ? { portalConfig: assetDocData.portalConfig } : {}),
          ...(assetDocData?.particleConfig ? { particleConfig: assetDocData.particleConfig } : {}),
          ...(batchDocData?.ar_config?.portalConfig ? { portalConfig: batchDocData.ar_config.portalConfig } : {}),
          ...(batchDocData?.ar_config?.particleConfig ? { particleConfig: batchDocData.ar_config.particleConfig } : {}),
          ...(batchDocData?.portalConfig ? { portalConfig: batchDocData.portalConfig } : {}),
          ...(batchDocData?.particleConfig ? { particleConfig: batchDocData.particleConfig } : {}),
          ...(liveConfig || {}),
          ...(localPreviewConfig || {}),
          ...(localPreviewConfig?.ar_config?.portalConfig ? { portalConfig: localPreviewConfig.ar_config.portalConfig } : {}),
          ...(localPreviewConfig?.portalConfig ? { portalConfig: localPreviewConfig.portalConfig } : {}),
          ...(localPreviewConfig?.ar_config?.particleConfig ? { particleConfig: localPreviewConfig.ar_config.particleConfig } : {}),
          ...(localPreviewConfig?.particleConfig ? { particleConfig: localPreviewConfig.particleConfig } : {}),
          additionalGeometries: resolvedGeometries,
          custom3DTexts: resolved3DTexts,
          customLights: resolvedLights,
          ...(urlPortalOverride ? { portalConfig: { ...(liveConfig?.portalConfig || {}), ...(localPreviewConfig?.portalConfig || {}), ...urlPortalOverride } } : {}),
          ...(urlParticlesOverride ? { particleConfig: { ...(liveConfig?.particleConfig || {}), ...(localPreviewConfig?.particleConfig || {}), ...urlParticlesOverride } } : {}),
          videoFlipX: isFlipX,
          trackingConfig: mergedTracking
        };
        const mindUrl = data.trackingConfig?.mindUrl || '';
        const gltfUrl = data.arExperience?.modelUrl || '';

        if (!isMounted) return;

        let videoUrl = mergedConfig.videoUrl || mergedConfig.video_url || data.arExperience?.videoUrl || data.arExperience?.video || data.videoUrl || data.video_url || '';
        let videoFilePath = mergedConfig.video_file_path || data.video_file_path || '';

        if (!videoUrl) {
          try {
            const assetSnap = await getDoc(doc(db, 'assets', batchId));
            if (assetSnap.exists()) {
              const aData = assetSnap.data();
              videoUrl = aData.ar_config?.videoUrl || aData.ar_config?.video_url || aData.video_url || aData.videoUrl || '';
              if (!videoFilePath) {
                videoFilePath = aData.ar_config?.video_file_path || aData.video_file_path || '';
              }
            }
          } catch {}
        }

        // If we have a storage path but no direct http URL, resolve download URL from Firebase Storage
        if ((!videoUrl || !videoUrl.startsWith('http')) && videoFilePath) {
          try {
            const storageRef = ref(storage, videoFilePath);
            videoUrl = await getDownloadURL(storageRef);
          } catch (err) {
            logToScreen('STORAGE_VIDEO_WARN', `Could not resolve video from storage path ${videoFilePath}: ${err.message}`);
          }
        }

        setArData({
          gltfPath: gltfUrl,
          mindPath: mindUrl,
          config: mergedConfig,
          videoUrl: videoUrl
        });

        if (mergedConfig.mediaPlaying !== undefined) {
          setMediaPlaying(mergedConfig.mediaPlaying);
        }

        logToScreen('CONFIG_READY', { gltfUrl, mindUrl, videoUrl, config: mergedConfig });

        // Pre-validate target file size in the background
        if (mindUrl) {
          fetch(mindUrl)
            .then((res) => res.arrayBuffer())
            .then((buf) => {
              if (isMounted) {
                logToScreen('MIND_FILE', `Target file size: ${(buf.byteLength / 1024).toFixed(1)} KB`);
                if (buf.byteLength < 500) {
                  logToScreen('MIND_FILE_WARN', 'Warning: .mind file is unusually small (< 500 B). Marker features may be low.');
                }
              }
            })
            .catch((e) => logToScreen('MIND_FILE_ERR', e.message));
        }
      } catch (err) {
        if (isMounted) {
          logToScreen('FATAL_ERROR', err.message);
          setError(err.message);
        }
      }
    };

    fetchPayload();

    return () => {
      isMounted = false;
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = '';
    };
  }, [batchId]);

  // 2. Manage Viewport Background, Camera Feed Video & OrbitControls
  useEffect(() => {
    const sceneEl = sceneRef.current;

    if (cameraEnabled) {
      if (trackingStatus !== 'INITIALIZING' && trackingStatus !== 'ERROR') {
        document.body.style.backgroundColor = 'transparent';
        const root = document.getElementById('root');
        if (root) root.style.backgroundColor = 'transparent';
        if (sceneEl) sceneEl.style.backgroundColor = 'transparent';
      } else {
        document.body.style.backgroundColor = '#0b0f19';
        const root = document.getElementById('root');
        if (root) root.style.backgroundColor = '#0b0f19';
        if (sceneEl) sceneEl.style.backgroundColor = 'transparent';
      }

      // 1. Unhide camera feed video and re-enable video stream tracks
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
          v.style.display = 'block';
          v.srcObject.getTracks().forEach((track) => {
            track.enabled = true;
          });
          v.play().catch(() => {});
        }
      });

      // 2. Resume MindAR tracking loop
      if (sceneEl?.systems && sceneEl.systems['mindar-image-system']) {
        const mindarSystem = sceneEl.systems['mindar-image-system'];
        if (mindarSystem.video && mindarSystem.controller) {
          mindarSystem.unpause();
        } else if (typeof mindarSystem.start === 'function') {
          mindarSystem.start();
        }
      }

      // 3. Disable OrbitControls and reset camera to origin looking forward
      const controls = getOrbitControls();
      if (controls) {
        controls.enabled = false;
      }
      const camera = getThreeCamera();
      if (camera) {
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        camera.updateMatrixWorld();
      }
    } else {
      document.body.style.backgroundColor = '#0b0f19';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = '#0b0f19';
      if (sceneEl) sceneEl.style.backgroundColor = '#0b0f19';

      // 1. Hide camera feed video and disable media tracks without stopping/destroying them
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
          v.style.display = 'none';
          v.srcObject.getTracks().forEach((track) => {
            track.enabled = false;
          });
          v.pause();
        }
      });

      // 2. Pause MindAR tracking loop
      if (sceneEl?.systems && sceneEl.systems['mindar-image-system']) {
        const mindarSystem = sceneEl.systems['mindar-image-system'];
        if (mindarSystem.video && mindarSystem.controller) {
          mindarSystem.pause(false);
        }
      }

      // 3. Enable OrbitControls and frame camera to Studio4D4 perspective
      const controls = getOrbitControls();
      const camera = getThreeCamera();
      if (controls) {
        controls.enabled = true;
        controls.target.set(0, 0, 0);
      }
      if (camera) {
        camera.position.copy(defaultCamPosRef.current);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
      }
      if (controls) {
        controls.update();
      }
    }
  }, [cameraEnabled, trackingStatus, getOrbitControls, getThreeCamera]);

  // Clean up media streams and animations only on total component unmount
  useEffect(() => {
    return () => {
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
          v.srcObject.getTracks().forEach((track) => track.stop());
          v.srcObject = null;
          v.remove();
        }
      });
      if (cameraTransitionIdRef.current) {
        cancelAnimationFrame(cameraTransitionIdRef.current);
      }
    };
  }, []);

  // Live Mirror Video Layer / Mesh Texture Inversion (Flip X) for WebAR
  const applyFlipXToMesh = (model3D, isFlipped, targetParam = 'auto') => {
    if (!model3D) return;
    const THREE_LIB = (typeof AFRAME !== 'undefined' && AFRAME.THREE) ? AFRAME.THREE : THREE;

    const screenKeywords = ['video', 'screen', 'display', 'cinema', 'videomat', 'screenmat'];

    const matchedMeshes = [];
    const allMeshes = [];
    const autoScreenMeshes = [];

    model3D.traverse((node) => {
      if (node.isMesh && node.material) {
        allMeshes.push(node);
        const nodeName = (node.name || '').toLowerCase();
        const nodeUuid = (node.uuid || '').toLowerCase();

        if (targetParam === 'all') {
          matchedMeshes.push(node);
        } else if (targetParam !== 'auto' && (nodeName === targetParam || nodeUuid === targetParam)) {
          matchedMeshes.push(node);
        } else {
          const hasVideo = !!(
            node.userData?.hasVideo ||
            node.userData?.videoUrl ||
            (Array.isArray(node.material)
              ? node.material.some((m) => m?.userData?.hasVideo || m?.userData?.isVideoLayer)
              : (node.material?.userData?.hasVideo || node.material?.userData?.isVideoLayer))
          );
          if (hasVideo || screenKeywords.some((kw) => nodeName.includes(kw))) {
            autoScreenMeshes.push(node);
          }
        }
      }
    });

    let finalTargetMeshes = matchedMeshes;
    if (finalTargetMeshes.length === 0) {
      finalTargetMeshes = autoScreenMeshes;
    }

    finalTargetMeshes.forEach((node) => {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const targetSlot = typeof node.userData?.videoTargetMaterialIndex === 'number'
        ? node.userData.videoTargetMaterialIndex
        : null;

      materials.forEach((mat, idx) => {
        const isTarget = targetSlot !== null
          ? idx === targetSlot
          : (mat?.userData?.hasVideo || mat?.userData?.isVideoLayer || materials.length === 1 || (node.userData?.archetype === 'VIDEO_SCREEN' && idx === 4));

        if (!isTarget) return;

        ['map', 'emissiveMap'].forEach((mapName) => {
          if (mat[mapName]) {
            const tex = mat[mapName];
            if (isFlipped) {
              tex.wrapS = THREE_LIB.RepeatWrapping;
              tex.repeat.set(-1, 1);
              tex.offset.set(1, 0);
            } else {
              tex.wrapS = THREE_LIB.ClampToEdgeWrapping;
              tex.repeat.set(1, 1);
              tex.offset.set(0, 0);
            }
            tex.matrixAutoUpdate = true;
            if (tex.updateMatrix) tex.updateMatrix();
            tex.needsUpdate = true;
          }
        });
        mat.needsUpdate = true;
      });
    });
  };

  // 3. Attach MindAR & Model Event Listeners
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;

    const onArReady = () => {
      logToScreen('MINDAR_READY', 'MindAR computer vision tracker started.');
      setTrackingStatus('SCANNING');
      if (!cameraEnabled) {
        const videos = document.querySelectorAll('video');
        videos.forEach((v) => {
          if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
            v.style.display = 'none';
            v.srcObject.getTracks().forEach((track) => {
              track.enabled = false;
            });
            v.pause();
          }
        });
        if (sceneEl?.systems && sceneEl.systems['mindar-image-system']) {
          const mindarSystem = sceneEl.systems['mindar-image-system'];
          if (mindarSystem.video && mindarSystem.controller) {
            mindarSystem.pause(false);
          }
        }
      }
    };

    const onArError = (e) => {
      logToScreen('MINDAR_ERROR', e.detail || 'Camera tracking error.');
      setTrackingStatus('ERROR');
    };

    const onTargetFound = (e) => {
      logToScreen('TARGET_FOUND', `Marker locked! Target index: ${e.detail?.targetIndex ?? 0}`);
      setTrackingStatus('DETECTED');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // Ignore vibration failures if unsupported by device permissions
        }
      }
      // Ensure all 3D video layers start playing immediately upon target acquisition
      document.querySelectorAll('video').forEach((v) => {
        if (v && v.paused && !v.srcObject) {
          v.play().catch(() => {});
        }
      });

      // Ensure all particle systems refresh matrix & visibility on marker lock
      document.querySelectorAll('[ar-particle-system]').forEach((el) => {
        if (el && el.object3D) {
          el.object3D.visible = true;
        }
        if (el && el.components && el.components['ar-particle-system']) {
          const comp = el.components['ar-particle-system'];
          if (comp.particleGroup) {
            comp.particleGroup.visible = true;
            comp.particleGroup.updateMatrixWorld(true);
          }
          if (comp.particlesObj) {
            comp.particlesObj.visible = true;
          }
        }
      });

      // Ensure all additional 3D geometries refresh matrix & visibility on marker lock
      document.querySelectorAll('[ar-additional-geometries]').forEach((el) => {
        if (el && el.object3D) {
          el.object3D.visible = true;
        }
        if (el && el.components && el.components['ar-additional-geometries']) {
          const comp = el.components['ar-additional-geometries'];
          if (comp.rootGroup) {
            comp.rootGroup.visible = true;
            comp.rootGroup.children.forEach((c) => {
              c.visible = c.userData?.visible !== false;
            });
            comp.rootGroup.updateMatrixWorld(true);
          }
          if (typeof comp.onTargetFound === 'function') {
            comp.onTargetFound();
          }
        }
      });

      // Ensure all portal systems refresh matrix & visibility on marker lock
      document.querySelectorAll('[ar-portal]').forEach((el) => {
        if (el && el.object3D) {
          el.object3D.visible = true;
        }
        if (el && el.components && el.components['ar-portal']) {
          const comp = el.components['ar-portal'];
          if (comp.rootGroup) {
            comp.rootGroup.visible = true;
            comp.rootGroup.updateMatrixWorld(true);
          }
          if (typeof comp.onTargetFound === 'function') {
            comp.onTargetFound();
          }
        }
      });

      // Ensure all studio lighting rigs refresh matrix & lights on marker lock
      document.querySelectorAll('[ar-studio-lighting]').forEach((el) => {
        if (el && el.components && el.components['ar-studio-lighting']) {
          const comp = el.components['ar-studio-lighting'];
          if (comp.lightingGroup) {
            comp.lightingGroup.visible = true;
            comp.lightingGroup.updateMatrixWorld(true);
          }
          if (typeof comp.updateLights === 'function') {
            comp.updateLights();
          }
        }
      });

      const isFlipX = !!(arData?.config?.videoFlipX);
      const targetMesh = arData?.config?.videoTargetMesh || 'auto';

      ['ar-model', 'preview-model', 'ar-model-forced'].forEach((id) => {
        const modelEl = document.getElementById(id);
        if (modelEl) {
          const mesh = modelEl.getObject3D('mesh');
          if (mesh) {
            applyFlipXToMesh(mesh, isFlipX, targetMesh);
          }
        }
      });
    };

    const onTargetLost = (e) => {
      logToScreen('TARGET_LOST', `Marker lost. Searching...`);
      setTrackingStatus('SCANNING');
      document.querySelectorAll('[ar-portal]').forEach((el) => {
        if (el && el.components && el.components['ar-portal']) {
          const comp = el.components['ar-portal'];
          if (typeof comp.onTargetLost === 'function') {
            comp.onTargetLost();
          }
        }
      });
    };

    const onModelLoad = () => {
      logToScreen('GLTF_LOAD', '3D model loaded and materials initialized.');
      // Auto-play all video textures embedded in the 3D model
      document.querySelectorAll('video').forEach((v) => {
        if (v && v.paused && !v.srcObject) {
          v.play().catch(() => {});
        }
      });

      const isFlipX = !!(arData?.config?.videoFlipX);
      const targetMesh = arData?.config?.videoTargetMesh || 'auto';
      ['ar-model', 'preview-model', 'ar-model-forced'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const mesh = el.getObject3D('mesh');
          if (mesh) applyFlipXToMesh(mesh, isFlipX, targetMesh);
        }
      });

      ['ar-model', 'preview-model', 'ar-model-forced'].forEach((id) => {
        const modelEl = document.getElementById(id);
        if (modelEl) {
          const mesh = modelEl.getObject3D('mesh');
          if (mesh) {
            const overrides = arData?.config?.meshOverrides;
          mesh.traverse((node) => {
            if (node.isMesh) {
              if (overrides) {
                const ovr = overrides[node.name] || overrides[node.uuid];
                if (ovr) {
                  if (ovr.deleted || ovr.visible === false) {
                    node.visible = false;
                    if (ovr.deleted && node.parent) {
                      node.parent.remove(node);
                    }
                    return;
                  }
                  if (ovr.position) node.position.set(ovr.position.x, ovr.position.y, ovr.position.z);
                  if (ovr.rotation) {
                    node.rotation.set(
                      ((ovr.rotation.x || 0) * Math.PI) / 180,
                      ((ovr.rotation.y || 0) * Math.PI) / 180,
                      ((ovr.rotation.z || 0) * Math.PI) / 180
                    );
                  }
                  if (ovr.scale) {
                    const sx = typeof ovr.scale === 'number' ? ovr.scale : (ovr.scale.x || 1);
                    node.scale.set(sx, sx, sx);
                  }
                  if (ovr.visible !== undefined) node.visible = !!ovr.visible;
                  if (ovr.material && node.material) {
                    const mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach((m) => {
                      if (ovr.material.color && m.color) m.color.set(ovr.material.color);
                      if (ovr.material.metalness !== undefined && m.metalness !== undefined) m.metalness = ovr.material.metalness;
                      if (ovr.material.roughness !== undefined && m.roughness !== undefined) m.roughness = ovr.material.roughness;
                      if (ovr.material.emissive && m.emissive) m.emissive.set(ovr.material.emissive);
                      if (ovr.material.opacity !== undefined) {
                        m.opacity = ovr.material.opacity;
                        if (m.opacity < 1.0) m.transparent = true;
                      }
                      if (ovr.material.wireframe !== undefined) m.wireframe = !!ovr.material.wireframe;
                      m.needsUpdate = true;
                    });
                    const THREE_LIB = (typeof AFRAME !== 'undefined' && AFRAME.THREE) ? AFRAME.THREE : THREE;
                    const applyTexTransform = (tex) => {
                      if (!tex) return;
                      tex.wrapS = THREE_LIB.RepeatWrapping;
                      tex.wrapT = THREE_LIB.RepeatWrapping;
                      if (tex.center) tex.center.set(0.5, 0.5);
                      const repX = ovr.material.textureRepeatX !== undefined && ovr.material.textureRepeatX !== null ? Number(ovr.material.textureRepeatX) : 1.0;
                      const repY = ovr.material.textureRepeatY !== undefined && ovr.material.textureRepeatY !== null ? Number(ovr.material.textureRepeatY) : 1.0;
                      const flipX = Boolean(ovr.material.textureFlipX);
                      const flipY = Boolean(ovr.material.textureFlipY);
                      const offX = ovr.material.textureOffsetX !== undefined && ovr.material.textureOffsetX !== null ? Number(ovr.material.textureOffsetX) : 0.0;
                      const offY = ovr.material.textureOffsetY !== undefined && ovr.material.textureOffsetY !== null ? Number(ovr.material.textureOffsetY) : 0.0;
                      const rotDeg = ovr.material.textureRotation !== undefined && ovr.material.textureRotation !== null ? Number(ovr.material.textureRotation) : 0.0;

                      if (tex.repeat) tex.repeat.set(flipX ? -repX : repX, flipY ? -repY : repY);
                      if (tex.offset) tex.offset.set(offX, offY);
                      tex.rotation = (rotDeg * Math.PI) / 180;
                      tex.matrixAutoUpdate = true;
                      if (typeof tex.updateMatrix === 'function') tex.updateMatrix();
                      tex.needsUpdate = true;
                    };

                    if (ovr.material.textureUrl) {
                      const loader = new THREE_LIB.TextureLoader();
                      loader.load(ovr.material.textureUrl, (tex) => {
                        if (THREE_LIB.SRGBColorSpace !== undefined) {
                          tex.colorSpace = THREE_LIB.SRGBColorSpace;
                        }
                        tex.flipY = false;
                        applyTexTransform(tex);
                        mats.forEach((m) => {
                          m.map = tex;
                          m.needsUpdate = true;
                        });
                      });
                    } else {
                      mats.forEach((m) => {
                        ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap'].forEach((slot) => {
                          if (m[slot]) applyTexTransform(m[slot]);
                        });
                        m.needsUpdate = true;
                      });
                    }
                  }
                }
              }
              if (node.material) {
                const mat = node.material;
                const hasMap = mat.map ? 'YES' : 'NO';
                const matType = mat.type || 'Standard';
                logToScreen(`MESH_AUDIT [${node.name || 'mesh'}]`, `Material: ${matType} | Texture: ${hasMap} | Roughness: ${mat.roughness ?? 'N/A'} | Metalness: ${mat.metalness ?? 'N/A'}`);
              }
            }
          });
        }
      }
    });

    // Compute bounding box and auto-frame camera distance (matching Studio4D4 studio angle)
    ['preview-model', 'ar-model'].forEach((id) => {
      const el = document.getElementById(id);
      const model3D = el?.getObject3D('mesh');
      if (model3D && defaultCamPosRef.current.length() <= 2.6) {
        const box = new THREE.Box3().setFromObject(model3D);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const fov = 45 * (Math.PI / 180);
          let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
          cameraDistance = Math.max(cameraDistance, 1.5);

          // Studio4D4 camera perspective: elevated at ~18-20° above horizon
          const initialCamPos = new THREE.Vector3(0, maxDim * 0.35, cameraDistance);
          defaultCamPosRef.current.copy(initialCamPos);
          defaultTargetRef.current.set(0, 0, 0);

          if (!cameraEnabled) {
            const controls = getOrbitControls();
            const camera = getThreeCamera();
            if (camera) {
              camera.position.copy(initialCamPos);
              camera.lookAt(0, 0, 0);
              camera.updateMatrixWorld();
            }
            if (controls) {
              controls.target.set(0, 0, 0);
              controls.update();
            }
          }
        }
      }
    });
  };

  const onModelError = (e) => {
    logToScreen('GLTF_ERROR', e.detail || 'Error loading 3D asset.');
  };

  sceneEl.addEventListener('arReady', onArReady);
  sceneEl.addEventListener('arError', onArError);
  sceneEl.addEventListener('targetFound', onTargetFound);
  sceneEl.addEventListener('targetLost', onTargetLost);

  // If MindAR is already initialized, trigger ready handler immediately
  if (sceneEl.systems && sceneEl.systems['mindar-image-system']?.controller) {
    onArReady();
  }

  const modelIds = ['ar-model', 'preview-model', 'ar-model-forced'];
  modelIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('model-loaded', onModelLoad);
      el.addEventListener('model-error', onModelError);
      if (el.getObject3D('mesh')) {
        onModelLoad();
      }
    }
  });

  const targetEl = document.getElementById('target-entity');
  if (targetEl) {
    targetEl.addEventListener('targetFound', onTargetFound);
    targetEl.addEventListener('targetLost', onTargetLost);
  }

  return () => {
    if (sceneEl) {
      sceneEl.removeEventListener('arReady', onArReady);
      sceneEl.removeEventListener('arError', onArError);
      sceneEl.removeEventListener('targetFound', onTargetFound);
      sceneEl.removeEventListener('targetLost', onTargetLost);
    }
    modelIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.removeEventListener('model-loaded', onModelLoad);
        el.removeEventListener('model-error', onModelError);
      }
    });
    if (targetEl) {
      targetEl.removeEventListener('targetFound', onTargetFound);
      targetEl.removeEventListener('targetLost', onTargetLost);
    }
  };
}, [arData, cameraEnabled, getOrbitControls, getThreeCamera]);

// Reactive Effect to ensure flipX is applied if arData config loads after model is in memory
useEffect(() => {
  if (!arData?.config) return;
  const isFlipX = !!(arData.config.videoFlipX);
  const targetMesh = arData.config.videoTargetMesh || 'auto';
  ['ar-model', 'preview-model', 'ar-model-forced'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const mesh = el.getObject3D('mesh');
      if (mesh) applyFlipXToMesh(mesh, isFlipX, targetMesh);
    }
  });
}, [arData]);

  // Media Toggle Helper
  const toggleMedia = () => {
    const nextState = !mediaPlaying;
    setMediaPlaying(nextState);
    logToScreen('MEDIA_TOGGLE', `Playback state changed: ${nextState ? 'PLAY' : 'PAUSE'}`);
  };

  const toggleMediaMute = () => {
    const nextMuted = !mediaMuted;
    setMediaMuted(nextMuted);
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.dispatchEvent(new CustomEvent('set-video-mute', { detail: { muted: nextMuted } }));
    }
    window.dispatchEvent(new CustomEvent('starwear-set-video-mute', { detail: { muted: nextMuted } }));
    document.querySelectorAll('iframe').forEach((ifr) => {
      try {
        ifr.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: nextMuted ? 'mute' : 'unMute', args: [] }),
          '*'
        );
        if (!nextMuted) {
          ifr.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
            '*'
          );
        }
      } catch (e) {}
    });
    logToScreen('MEDIA_MUTE_TOGGLE', `Audio state changed: ${nextMuted ? 'MUTED' : 'UNMUTED'}`);
  };

  // PayPal Checkout Handler
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { analytics } = await import('../firebase');
      const { logEvent } = await import('firebase/analytics');
      const { startDirectPayPalCheckout } = await import('../services/paypalService');

      try {
        logEvent(analytics, 'checkout_started', {
          items: [{ item_name: 'AR Garment', price: 99.0 }],
          batch_id: batchId
        });
      } catch {
        // Analytics failure non-fatal
      }

      const itemPrice = arData?.price !== undefined ? Number(arData.price) : 99.00;

      await startDirectPayPalCheckout({
        items: [{
          id: batchId || '',
          name: arData?.name || `AR Garment (${batchId || 'Exclusive'})`,
          price: itemPrice,
          quantity: 1,
          image: arData?.gltfPath || ''
        }],
        total: itemPrice,
        metadata: {
          batchId: batchId || '',
          source: 'ar_experience'
        }
      });
    } catch (err) {
      console.error('PayPal Checkout error:', err);
      alert(`Checkout failed: ${err.message}`);
      setCheckoutLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-950 text-white px-6 text-center">
        <div className="max-w-md w-full p-8 border border-red-500/30 rounded-2xl bg-red-950/20 backdrop-blur-md shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Experience Error</h2>
          <p className="text-sm text-neutral-300 mb-6">{error}</p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!arData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-950 text-white space-y-4">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs tracking-widest uppercase font-mono text-indigo-300">Initializing AR Pipeline...</p>
      </div>
    );
  }

  // Extract Scene & Lighting Properties
  const cfg = arData.config || {};
  const ambientColor = cfg.ambientColor || '#ffffff';
  const ambientIntensity = cfg.ambientIntensity ?? 1.4;

  const dir1Color = cfg.dir1Color || '#ffffff';
  const dir1Intensity = cfg.dir1Intensity ?? 2.2;
  const dir1Position = cfg.dir1Position || '2 4 3';

  const dir2Color = cfg.dir2Color || '#ffffff';
  const dir2Intensity = cfg.dir2Intensity ?? 1.2;
  const dir2Position = cfg.dir2Position || '-2 -1 -2';

  const rimColor = cfg.rimColor || '#818cf8';
  const rimIntensity = cfg.rimIntensity ?? 1.0;
  const rimPosition = cfg.rimPosition || '0 3 -3';

  const studioLightingAttr = `enabled: true; ambientColor: ${ambientColor}; ambientIntensity: ${ambientIntensity}; dir1Color: ${dir1Color}; dir1Intensity: ${dir1Intensity}; dir1Position: ${dir1Position}; dir2Color: ${dir2Color}; dir2Intensity: ${dir2Intensity}; dir2Position: ${dir2Position}; rimColor: ${rimColor}; rimIntensity: ${rimIntensity}; rimPosition: ${rimPosition};`;

  const modelScale = cfg.modelScale ?? 0.4;
  const modelRotSpeed = cfg.modelRotSpeed ?? 10000;
  const modelRotX = cfg.modelRotX !== undefined ? cfg.modelRotX : (cfg.modelRotation ? Number(cfg.modelRotation.split(' ')[0]) || 0 : 90);
  const modelRotY = cfg.modelRotY !== undefined ? cfg.modelRotY : (cfg.modelRotation ? Number(cfg.modelRotation.split(' ')[1]) || 0 : 0);
  const modelRotZ = cfg.modelRotZ !== undefined ? cfg.modelRotZ : (cfg.modelRotation ? Number(cfg.modelRotation.split(' ')[2]) || 0 : 0);
  const modelPosX = cfg.modelPosX !== undefined ? cfg.modelPosX : (cfg.modelPosition ? Number(cfg.modelPosition.split(' ')[0]) || 0 : 0);
  const modelPosY = cfg.modelPosY !== undefined ? cfg.modelPosY : (cfg.modelPosition ? Number(cfg.modelPosition.split(' ')[1]) || 0 : 0);
  const modelPosZ = cfg.modelPosZ !== undefined ? cfg.modelPosZ : (cfg.modelPosition ? Number(cfg.modelPosition.split(' ')[2]) || 0 : 0);

  // Material Configs (-1 means preserve embedded PBR textures from GLTF)
  const matMetalness = cfg.matMetalness !== undefined ? cfg.matMetalness : -1;
  const matRoughness = cfg.matRoughness !== undefined ? cfg.matRoughness : -1;
  const matEmissive = cfg.matEmissive || '';
  const matEmissiveIntensity = cfg.matEmissiveIntensity !== undefined ? cfg.matEmissiveIntensity : -1;
  const matWireframe = !!cfg.matWireframe;
  const matOpacity = cfg.matOpacity ?? 1.0;

  const showBuyButton = cfg.showBuyButton !== undefined ? cfg.showBuyButton : true;
  const buyButtonColor = cfg.buyButtonColor || '#e11d48';

  // Camera Tracking & Stability Config
  const trackingCfg = cfg.trackingConfig || {};
  const filterMinCF = trackingCfg.filterMinCF ?? 0.0005;
  const filterBeta = trackingCfg.filterBeta ?? 0.01;
  const missTolerance = trackingCfg.missTolerance ?? 6;
  const warmupTolerance = trackingCfg.warmupTolerance ?? 2;
  const maxTrack = trackingCfg.maxTrack ?? 1;
  const targetIndex = trackingCfg.targetIndex ?? 0;
  const showStats = trackingCfg.showStats ? 'true' : 'false';
  const uiLoading = trackingCfg.uiLoading || 'no';
  const uiScanning = trackingCfg.uiScanning || 'no';
  const uiError = trackingCfg.uiError || 'yes';

  const videoCfg = arData?.config || {};
  const videoAspect = videoCfg.aspectRatio || videoCfg.videoAspectRatio || (isYouTubeShortUrl(videoCfg.videoUrl || arData?.videoUrl) ? '9:16' : '16:9');
  const playGltfVideoAttr = `src: ${videoCfg.videoUrl || arData?.videoUrl || ''}; playing: ${mediaPlaying}; muted: ${mediaMuted}; targetMesh: ${videoCfg.videoTargetMesh || 'auto'}; flipX: ${videoCfg.videoFlipX || false}; videoScale: ${videoCfg.videoScale ?? 1.0}; videoOffsetX: ${videoCfg.videoOffsetX ?? 0.0}; videoOffsetY: ${videoCfg.videoOffsetY ?? 0.0}; videoOffsetZ: ${videoCfg.videoOffsetZ ?? 0.0}; videoRotation: ${videoCfg.videoRotation ?? 0.0}; videoTextureRepeatX: ${videoCfg.videoTextureRepeatX ?? 1.0}; videoTextureRepeatY: ${videoCfg.videoTextureRepeatY ?? 1.0}; videoTextureOffsetX: ${videoCfg.videoTextureOffsetX ?? 0.0}; videoTextureOffsetY: ${videoCfg.videoTextureOffsetY ?? 0.0}; aspectRatio: ${videoAspect}`;

  const portalCfg =
    arData?.config?.portalConfig ||
    arData?.config?.portal ||
    arData?.portalConfig ||
    arData?.portal ||
    arData?.arExperience?.config?.portalConfig ||
    arData?.arExperience?.config?.portal ||
    null;
  let urlPortalFlag = null;
  if (typeof window !== 'undefined') {
    const sp = new URLSearchParams(window.location.search);
    const pVal = sp.get('portal');
    if (pVal === '1' || pVal === 'true') urlPortalFlag = true;
    else if (pVal === '0' || pVal === 'false') urlPortalFlag = false;
  }
  const portalEnabled = urlPortalFlag !== null
    ? urlPortalFlag
    : !!(
        portalCfg &&
        (portalCfg.enabled === true ||
          portalCfg.enabled === 'true' ||
          portalCfg.enabled === 1 ||
          portalCfg.enabled === '1' ||
          (portalCfg.enabled !== false &&
            portalCfg.enabled !== 'false' &&
            portalCfg.enabled !== 0 &&
            (Boolean(portalCfg.shape) || Boolean(portalCfg.interiorType) || Boolean(portalCfg.preset))))
      );
  const portalHideOutsideModel = portalEnabled && !!portalCfg?.hideOutsideModel;
  const portalAttr = portalEnabled
    ? `enabled: true; shape: ${portalCfg.shape || 'arch'}; width: ${portalCfg.width ?? 1.1}; height: ${portalCfg.height ?? 1.8}; radius: ${portalCfg.radius ?? 0.7}; depth: ${portalCfg.depth ?? 3.5}; frameColor: ${portalCfg.frameColor || '#38bdf8'}; frameWidth: ${portalCfg.frameWidth ?? 0.08}; frameDepth: 0.08; frameEmissive: ${portalCfg.frameEmissive || '#0284c7'}; frameEmissiveIntensity: ${portalCfg.frameEmissiveIntensity ?? 1.5}; frameGlow: ${portalCfg.frameGlow ?? true}; glassTint: ${portalCfg.glassTint || '#38bdf8'}; glassOpacity: ${portalCfg.glassOpacity ?? 0.05}; interiorType: ${portalCfg.interiorType || 'nebula'}; skyboxUrl: ${portalCfg.skyboxUrl || ''}; skyboxScale: ${portalCfg.skyboxScale ?? 1.0}; skyboxPosX: ${portalCfg.skyboxPosX ?? 0}; skyboxPosY: ${portalCfg.skyboxPosY ?? 0}; skyboxPosZ: ${portalCfg.skyboxPosZ ?? 0}; skyboxRotX: ${portalCfg.skyboxRotX ?? 0}; skyboxRotY: ${portalCfg.skyboxRotY ?? 0}; skyboxRotZ: ${portalCfg.skyboxRotZ ?? 0}; skyboxBlur: ${portalCfg.skyboxBlur ?? 0}; interiorColor: ${portalCfg.interiorColor || '#050714'}; wallColor: ${portalCfg.wallColor || '#0f172a'}; floorColor: ${portalCfg.floorColor || '#020617'}; gridColor: ${portalCfg.gridColor || '#38bdf8'}; interiorLightColor: ${portalCfg.interiorLightColor || '#e0f2fe'}; interiorLightIntensity: ${portalCfg.interiorLightIntensity ?? 2.0}; interiorModelType: ${portalCfg.interiorModelType || 'artifact'}; artifactType: ${portalCfg.artifactType || 'crystal'}; customModelUrl: ${portalCfg.customModelUrl || ''}; currentModelUrl: ${arData?.gltfPath || ''}; modelScale: ${portalCfg.modelScale ?? 0.4}; modelPosX: ${portalCfg.modelPosX ?? 0}; modelPosY: ${portalCfg.modelPosY ?? 0}; modelPosZ: ${portalCfg.modelPosZ ?? -1.3}; modelRotSpeed: ${portalCfg.modelRotSpeed ?? 6000}; modelRotX: ${portalCfg.modelRotX ?? 0}; modelRotY: ${portalCfg.modelRotY ?? 0}; modelRotZ: ${portalCfg.modelRotZ ?? 0}; showVideo: ${portalCfg.showVideo ?? false}; videoUrl: ${portalCfg.videoUrl || arData?.videoUrl || ''}; videoScale: ${portalCfg.videoScale ?? 1.0}; videoPosY: ${portalCfg.videoPosY ?? 0}; videoPosZ: ${portalCfg.videoPosZ ?? -1.8}; particles: ${portalCfg.particles || 'stars'}; particleCount: ${portalCfg.particleCount ?? 180}; particleColor: ${portalCfg.particleColor || '#38bdf8'}; particleSpeed: ${portalCfg.particleSpeed ?? 1.0}; floatingText: ${portalCfg.floatingText || 'STAR weAR'}; textColor: ${portalCfg.textColor || '#38bdf8'}; textScale: ${portalCfg.textScale ?? 1.0}; textPosY: ${portalCfg.textPosY ?? 0.65}; textPosZ: ${portalCfg.textPosZ ?? -1.2}; posX: ${portalCfg.posX ?? 0}; posY: ${portalCfg.posY ?? 0}; posZ: ${portalCfg.posZ ?? 0}; rotX: ${portalCfg.rotX ?? 0}; rotY: ${portalCfg.rotY ?? 0}; rotZ: ${portalCfg.rotZ ?? 0};`
    : '';

  const getValidParticleObj = (val) => (val && typeof val === 'object' && !Array.isArray(val) ? val : null);

  const particleCfg =
    getValidParticleObj(arData?.config?.particleConfig) ||
    getValidParticleObj(arData?.config?.particle_config) ||
    getValidParticleObj(arData?.config?.ar_config?.particleConfig) ||
    getValidParticleObj(arData?.particleConfig) ||
    getValidParticleObj(arData?.particle_config) ||
    getValidParticleObj(arData?.arExperience?.config?.particleConfig) ||
    getValidParticleObj(arData?.arExperience?.particleConfig) ||
    getValidParticleObj(arData?.config?.particles) ||
    getValidParticleObj(arData?.particles) ||
    null;

  let urlParticlesFlag = null;
  if (typeof window !== 'undefined') {
    const sp = new URLSearchParams(window.location.search);
    const pVal = sp.get('particles') || sp.get('particle');
    if (pVal === '1' || pVal === 'true') urlParticlesFlag = true;
    else if (pVal === '0' || pVal === 'false') urlParticlesFlag = false;
  }

  const particleEnabled = urlParticlesFlag !== null
    ? urlParticlesFlag
    : !!(
        particleCfg &&
        (particleCfg.enabled === true ||
          particleCfg.enabled === 'true' ||
          particleCfg.enabled === 1 ||
          particleCfg.enabled === '1' ||
          (particleCfg.enabled !== false &&
            particleCfg.enabled !== 'false' &&
            particleCfg.enabled !== 0 &&
            (Boolean(particleCfg.preset) || (Number(particleCfg.count) > 0))))
      );

  const particleRotX = particleCfg?.rotX !== undefined ? Number(particleCfg.rotX) : 0;
  const particleRotY = particleCfg?.rotY !== undefined ? Number(particleCfg.rotY) : 0;
  const particleRotZ = particleCfg?.rotZ !== undefined ? Number(particleCfg.rotZ) : 0;
  const particleAttr = particleEnabled
    ? `enabled: true; preset: ${particleCfg?.preset || 'cosmic-stardust'}; count: ${particleCfg?.count ?? 300}; size: ${particleCfg?.size ?? 0.04}; color: ${particleCfg?.color || particleCfg?.colorA || '#38bdf8'}; colorSecondary: ${particleCfg?.colorSecondary || particleCfg?.colorB || '#c084fc'}; opacity: ${particleCfg?.opacity ?? 0.85}; shape: ${particleCfg?.shape || 'sparkle'}; blending: ${particleCfg?.blending || 'additive'}; direction: ${particleCfg?.direction || particleCfg?.motionType || 'float'}; speed: ${particleCfg?.speed ?? 1.0}; rotationSpeed: ${particleCfg?.rotationSpeed ?? 0.2}; spreadX: ${particleCfg?.spreadX ?? 3.0}; spreadY: ${particleCfg?.spreadY ?? 3.0}; spreadZ: ${particleCfg?.spreadZ ?? 3.0}; posX: ${particleCfg?.posX ?? 0}; posY: ${particleCfg?.posY ?? 0}; posZ: ${particleCfg?.posZ ?? 0}; rotX: ${particleRotX}; rotY: ${particleRotY}; rotZ: ${particleRotZ}; twinkle: ${particleCfg?.twinkle ?? true};`
    : '';

  const additionalGeometries = Array.isArray(cfg?.additionalGeometries)
    ? cfg.additionalGeometries
    : Array.isArray(arData?.additionalGeometries)
    ? arData.additionalGeometries
    : [];
  const additionalGeometriesAttr = additionalGeometries && additionalGeometries.length > 0
    ? `geometries: ${encodeURIComponent(JSON.stringify(additionalGeometries))};`
    : '';

  const custom3DTexts = (Array.isArray(cfg?.custom3DTexts) && cfg.custom3DTexts.length > 0)
    ? cfg.custom3DTexts
    : (Array.isArray(cfg?.ar_config?.custom3DTexts) && cfg.ar_config.custom3DTexts.length > 0)
    ? cfg.ar_config.custom3DTexts
    : (Array.isArray(arData?.custom3DTexts) && arData.custom3DTexts.length > 0)
    ? arData.custom3DTexts
    : (Array.isArray(arData?.config?.custom3DTexts) && arData.config.custom3DTexts.length > 0)
    ? arData.config.custom3DTexts
    : (Array.isArray(arData?.ar_config?.custom3DTexts) && arData.ar_config.custom3DTexts.length > 0)
    ? arData.ar_config.custom3DTexts
    : (Array.isArray(cfg?.custom3DTexts) ? cfg.custom3DTexts : []);
  const custom3DTextsAttr = custom3DTexts && custom3DTexts.length > 0
    ? `texts: ${encodeURIComponent(JSON.stringify(custom3DTexts))};`
    : '';

  const customLights = (Array.isArray(cfg?.customLights) && cfg.customLights.length > 0)
    ? cfg.customLights
    : (Array.isArray(cfg?.ar_config?.customLights) && cfg.ar_config.customLights.length > 0)
    ? cfg.ar_config.customLights
    : (Array.isArray(arData?.customLights) && arData.customLights.length > 0)
    ? arData.customLights
    : (Array.isArray(arData?.config?.customLights) && arData.config.customLights.length > 0)
    ? arData.config.customLights
    : (Array.isArray(arData?.ar_config?.customLights) && arData.ar_config.customLights.length > 0)
    ? arData.ar_config.customLights
    : (Array.isArray(cfg?.customLights) ? cfg.customLights : []);
  const customLightsAttr = customLights && customLights.length > 0
    ? `lights: ${encodeURIComponent(JSON.stringify(customLights))}; showHelpers: false;`
    : '';

  const webCfg = cfg?.websiteLayer || cfg?.webLayer || arData?.websiteLayer || null;
  const websiteLayerEnabled = Boolean(webCfg && (webCfg.enabled !== false) && webCfg.url);
  const websiteLayerAttr = websiteLayerEnabled
    ? `enabled: true; url: ${encodeURIComponent(webCfg.url)}; width: ${webCfg.width ?? 1.2}; height: ${webCfg.height ?? 0.675}; aspectRatio: ${webCfg.aspectRatio || '16:9'}; resolution: ${webCfg.resolution || '1280x720'}; interactive: ${webCfg.interactive !== false}; opacity: ${webCfg.opacity ?? 1.0}; frameStyle: ${webCfg.frameStyle || 'cyber_bezel'}; frameColor: ${webCfg.frameColor || '#6366f1'}; frameGlow: ${webCfg.frameGlow !== false}; curved: ${webCfg.curved || false}; curveRadius: ${webCfg.curveRadius ?? 3.0}; billboard: ${webCfg.billboard || false}; posX: ${webCfg.posX ?? 0}; posY: ${webCfg.posY ?? 0.8}; posZ: ${webCfg.posZ ?? 0.05}; rotX: ${webCfg.rotX ?? 0}; rotY: ${webCfg.rotY ?? 0}; rotZ: ${webCfg.rotZ ?? 0}; scale: ${webCfg.scale ?? 1.0}; showAddressBar: ${webCfg.showAddressBar !== false};`
    : '';

  return (
    <div
      className={`fixed inset-0 w-full h-[100dvh] overflow-hidden select-none transition-colors duration-300 ${
        cameraEnabled && trackingStatus !== 'INITIALIZING' && trackingStatus !== 'ERROR'
          ? 'bg-transparent'
          : 'bg-slate-950'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
        {/* Left: Exit Test Button */}
        {onBack ? (
          <button
            onClick={onBack}
            className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/10 shadow-lg active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Exit</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-bold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            STAR WEAR
          </div>
        )}

        {/* Center: Live Tracking Status Pill */}
        {cameraEnabled && (
          <div className="pointer-events-none">
            {trackingStatus === 'DETECTED' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-xl backdrop-blur-md border border-emerald-300 animate-fade-in">
                <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                Marker Locked
              </div>
            ) : trackingStatus === 'ERROR' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-red-600 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-xl backdrop-blur-md border border-red-300 animate-fade-in">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                Camera Error
              </div>
            ) : trackingStatus === 'INITIALIZING' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 text-indigo-300 text-xs font-black uppercase tracking-wider rounded-full shadow-xl backdrop-blur-md border border-indigo-500/40">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></span>
                Starting Camera...
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-black text-amber-300 text-xs font-black uppercase tracking-wider rounded-full shadow-xl backdrop-blur-md border-2 border-amber-400 animate-pulse">
                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                Scanning Marker...
              </div>
            )}
          </div>
        )}

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Camera / 3D Preview Toggle */}
          <button
            onClick={() => setCameraEnabled(!cameraEnabled)}
            className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-lg backdrop-blur-md active:scale-95 transition-all ${
              cameraEnabled
                ? 'bg-black/60 text-white border-white/10 hover:bg-black/80'
                : 'bg-indigo-600 text-white border-indigo-400/40 hover:bg-indigo-500'
            }`}
            title={cameraEnabled ? 'Switch to 3D Preview Mode' : 'Switch to AR Camera Mode'}
          >
            <span className="material-symbols-outlined text-lg">
              {cameraEnabled ? 'videocam' : '3d_rotation'}
            </span>
          </button>

          {/* Media Play/Pause Button */}
          <button
            onClick={toggleMedia}
            className="w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/10 shadow-lg backdrop-blur-md active:scale-95 transition-all"
            title={mediaPlaying ? 'Pause Video/Animations' : 'Play Video/Animations'}
          >
            <span className="material-symbols-outlined text-lg">
              {mediaPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Media Audio Mute/Unmute Button */}
          <button
            onClick={toggleMediaMute}
            className={`w-10 h-10 flex items-center justify-center text-white rounded-full border shadow-lg backdrop-blur-md active:scale-95 transition-all ${
              mediaMuted
                ? 'bg-rose-600/80 hover:bg-rose-600 border-rose-400/30'
                : 'bg-emerald-600/80 hover:bg-emerald-600 border-emerald-400/30'
            }`}
            title={mediaMuted ? 'Unmute Video Audio (Sound Off)' : 'Mute Video Audio (Sound On)'}
          >
            <span className="material-symbols-outlined text-lg">
              {mediaMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-lg backdrop-blur-md active:scale-95 transition-all ${
              showDiagnostics
                ? 'bg-amber-500 text-black border-amber-300'
                : 'bg-black/60 text-white border-white/10 hover:bg-black/80'
            }`}
            title="System Diagnostics HUD"
          >
            <span className="material-symbols-outlined text-lg">terminal</span>
          </button>
        </div>
      </div>

      {/* Primary Rendering Engine (Single Unified Persistent Scene) */}
      <a-scene
        ref={sceneRef}
        mindar-image={`imageTargetSrc: ${arData.mindPath}; autoStart: true; uiLoading: ${uiLoading}; uiScanning: ${uiScanning}; uiError: ${uiError}; filterMinCF: ${filterMinCF}; filterBeta: ${filterBeta}; missTolerance: ${missTolerance}; warmupTolerance: ${warmupTolerance}; maxTrack: ${maxTrack}; showStats: ${showStats};`}
        color-space="sRGB"
        renderer="colorManagement: true; alpha: true; antialias: true; stencil: true;"
        light="defaultLightsEnabled: false"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        loading-screen="enabled: false"
        scene-environment="exposure: 1.1; hdrIntensity: 0.0; enabled: false"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: cameraEnabled ? 'transparent' : '#0b0f19'
        }}
      >
        <a-assets timeout="10000">
          <a-asset-item id="metaModel" src={arData.gltfPath} crossOrigin="anonymous"></a-asset-item>
        </a-assets>

        {/* Camera with Studio4D4 OrbitControls in 3D Mode & MindAR Forward Anchor in AR Mode */}
        <a-camera
          id="experience-camera"
          position="0 0 0"
          look-controls="enabled: false"
          wasd-controls="enabled: false"
          orbit-camera-controls={`enabled: ${!cameraEnabled}; enableDamping: true; dampingFactor: 0.08; screenSpacePanning: true; autoRotate: ${cameraAutoRotate && !cameraEnabled}; autoRotateSpeed: 1.2; minDistance: 0.2; maxDistance: 100; enableRotate: ${!cameraEnabled}; enablePan: ${!cameraEnabled}; enableZoom: ${!cameraEnabled}; rotateSpeed: 1.0; zoomSpeed: 1.0; panSpeed: 1.0`}
        >
        </a-camera>

        {/* Dynamic Multi-Source Studio Lighting Rig: Illuminates models across all viewing and tracking modes */}
        <a-entity
          id="experience-lighting-rig"
          ar-studio-lighting={studioLightingAttr}
        ></a-entity>
        <a-entity
          id="experience-ambient-light"
          light={`type: ambient; color: ${ambientColor}; intensity: ${ambientIntensity};`}
        ></a-entity>

        {/* MindAR Target Anchor: Active in Live AR Camera Mode */}
        <a-entity
          id="target-entity"
          mindar-image-target={`targetIndex: ${targetIndex}`}
        >
          {cameraEnabled && (
            <>
              <a-entity
                id="target-dir1-light"
                light={`type: directional; color: ${dir1Color}; intensity: ${dir1Intensity}; castShadow: false;`}
                position={dir1Position}
              ></a-entity>
              <a-entity
                id="target-dir2-light"
                light={`type: directional; color: ${dir2Color}; intensity: ${dir2Intensity}; castShadow: false;`}
                position={dir2Position}
              ></a-entity>
              <a-entity
                id="target-rim-light"
                light={`type: directional; color: ${rimColor}; intensity: ${rimIntensity}; castShadow: false;`}
                position={rimPosition}
              ></a-entity>
            </>
          )}

          {cameraEnabled && !portalHideOutsideModel && (
            <a-gltf-model
              id="ar-model"
              src={arData.gltfPath}
              position={`${modelPosX} ${modelPosY} ${modelPosZ}`}
              scale={`${modelScale} ${modelScale} ${modelScale}`}
              rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
              {...(modelRotSpeed > 0
                ? {
                    animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${
                      modelRotY + 360
                    } ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;`
                  }
                : {})}
              model-auto-center="enabled: true"
              dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
              play-gltf-video={playGltfVideoAttr}
              play-gltf-animation={`playing: ${mediaPlaying}`}
            ></a-gltf-model>
          )}

          {cameraEnabled && portalEnabled && (
            <a-entity
              id="ar-portal-anchor"
              ar-portal={portalAttr}
            ></a-entity>
          )}

          {cameraEnabled && particleEnabled && (
            <a-entity
              id="ar-particle-system-anchor"
              ar-particle-system={particleAttr}
            ></a-entity>
          )}

          {cameraEnabled && additionalGeometries && additionalGeometries.length > 0 && (
            <a-entity
              id="ar-additional-geometries-anchor"
              ar-additional-geometries={additionalGeometriesAttr}
            ></a-entity>
          )}

          {cameraEnabled && custom3DTexts && custom3DTexts.length > 0 && (
            <a-entity
              id="ar-3d-texts-anchor"
              ar-3d-texts={custom3DTextsAttr}
            ></a-entity>
          )}

          {cameraEnabled && customLights && customLights.length > 0 && (
            <a-entity
              id="ar-custom-lights-anchor"
              ar-custom-lights={customLightsAttr}
            ></a-entity>
          )}

          {cameraEnabled && websiteLayerEnabled && (
            <a-entity
              id="ar-website-layer-anchor"
              ar-website-layer={websiteLayerAttr}
            ></a-entity>
          )}
        </a-entity>

        {/* Center 3D Model Anchor: Active in 3D Preview Mode (Studio4D4 OrbitControls) */}
        {!cameraEnabled && (
          <a-entity
            id="preview-anchor"
            position="0 0 0"
          >
            <a-entity
              id="preview-dir1-light"
              light={`type: directional; color: ${dir1Color}; intensity: ${dir1Intensity}; castShadow: false;`}
              position={dir1Position}
            ></a-entity>
            <a-entity
              id="preview-dir2-light"
              light={`type: directional; color: ${dir2Color}; intensity: ${dir2Intensity}; castShadow: false;`}
              position={dir2Position}
            ></a-entity>
            <a-entity
              id="preview-rim-light"
              light={`type: directional; color: ${rimColor}; intensity: ${rimIntensity}; castShadow: false;`}
              position={rimPosition}
            ></a-entity>

            {!portalHideOutsideModel && (
              <a-gltf-model
                id="preview-model"
                src={arData.gltfPath}
                position={`${modelPosX} ${modelPosY} ${modelPosZ}`}
                scale={`${modelScale} ${modelScale} ${modelScale}`}
                rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
                {...(modelRotSpeed > 0
                  ? {
                      animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${
                        modelRotY + 360
                      } ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;`
                    }
                  : {})}
                model-auto-center="enabled: true"
                dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
                play-gltf-video={playGltfVideoAttr}
                play-gltf-animation={`playing: ${mediaPlaying}`}
              ></a-gltf-model>
            )}

            {portalEnabled && (
              <a-entity
                id="ar-portal-anchor-preview"
                ar-portal={portalAttr}
              ></a-entity>
            )}

            {particleEnabled && (
              <a-entity
                id="ar-particle-system-anchor-preview"
                ar-particle-system={particleAttr}
              ></a-entity>
            )}

            {additionalGeometries && additionalGeometries.length > 0 && (
              <a-entity
                id="ar-additional-geometries-anchor-preview"
                ar-additional-geometries={additionalGeometriesAttr}
              ></a-entity>
            )}

            {custom3DTexts && custom3DTexts.length > 0 && (
              <a-entity
                id="ar-3d-texts-anchor-preview"
                ar-3d-texts={custom3DTextsAttr}
              ></a-entity>
            )}

            {customLights && customLights.length > 0 && (
              <a-entity
                id="ar-custom-lights-anchor-preview"
                ar-custom-lights={customLightsAttr}
              ></a-entity>
            )}

            {websiteLayerEnabled && (
              <a-entity
                id="ar-website-layer-anchor-preview"
                ar-website-layer={websiteLayerAttr}
              ></a-entity>
            )}
          </a-entity>
        )}

        {/* Force Test Render Anchor (Bypasses marker requirement for testing) */}
        {forceShowModel && cameraEnabled && (
          <a-entity
            position="0 0 -2"
          >
            <a-entity
              id="force-dir1-light"
              light={`type: directional; color: ${dir1Color}; intensity: ${dir1Intensity}; castShadow: false;`}
              position={dir1Position}
            ></a-entity>
            <a-entity
              id="force-dir2-light"
              light={`type: directional; color: ${dir2Color}; intensity: ${dir2Intensity}; castShadow: false;`}
              position={dir2Position}
            ></a-entity>
            <a-entity
              id="force-rim-light"
              light={`type: directional; color: ${rimColor}; intensity: ${rimIntensity}; castShadow: false;`}
              position={rimPosition}
            ></a-entity>
            {!portalHideOutsideModel && (
              <a-gltf-model
                id="ar-model-forced"
                src={arData.gltfPath}
                position={`${modelPosX} ${modelPosY} ${modelPosZ}`}
                scale={`${modelScale} ${modelScale} ${modelScale}`}
                rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
                {...(modelRotSpeed > 0
                  ? {
                      animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${
                        modelRotY + 360
                      } ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;`
                    }
                  : {})}
                model-auto-center="enabled: true"
                dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
                play-gltf-video={playGltfVideoAttr}
                play-gltf-animation={`playing: ${mediaPlaying}`}
              ></a-gltf-model>
            )}

            {portalEnabled && (
              <a-entity
                id="ar-portal-anchor-forced"
                ar-portal={portalAttr}
              ></a-entity>
            )}

            {particleEnabled && (
              <a-entity
                id="ar-particle-system-anchor-forced"
                ar-particle-system={particleAttr}
              ></a-entity>
            )}

            {additionalGeometries && additionalGeometries.length > 0 && (
              <a-entity
                id="ar-additional-geometries-anchor-forced"
                ar-additional-geometries={additionalGeometriesAttr}
              ></a-entity>
            )}

            {custom3DTexts && custom3DTexts.length > 0 && (
              <a-entity
                id="ar-3d-texts-anchor-forced"
                ar-3d-texts={custom3DTextsAttr}
              ></a-entity>
            )}

            {customLights && customLights.length > 0 && (
              <a-entity
                id="ar-custom-lights-anchor-forced"
                ar-custom-lights={customLightsAttr}
              ></a-entity>
            )}

            {websiteLayerEnabled && (
              <a-entity
                id="ar-website-layer-anchor-forced"
                ar-website-layer={websiteLayerAttr}
              ></a-entity>
            )}
          </a-entity>
        )}
      </a-scene>

      {/* Interactive Camera View Angle Presets Toolbar (Studio4D4 Style - Active in 3D Mode) */}
      {!cameraEnabled && (
        <div className="absolute top-20 sm:top-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-2xl max-w-[95vw] overflow-x-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1 font-mono shrink-0">
            <span className="material-symbols-outlined text-sm text-indigo-400">videocam</span> Views
          </span>
          <button
            type="button"
            onClick={() => setCameraView('perspective')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Studio 3/4 Perspective View"
          >
            Perspective
          </button>
          <button
            type="button"
            onClick={() => setCameraView('front')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Direct Front-Facing View"
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setCameraView('back')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Back View"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setCameraView('left')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Left View"
          >
            Left
          </button>
          <button
            type="button"
            onClick={() => setCameraView('right')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Right View"
          >
            Right
          </button>
          <button
            type="button"
            onClick={() => setCameraView('top')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Top-Down View"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => setCameraView('bottom')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
            title="Bottom-Up View"
          >
            Bottom
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0"></div>
          <button
            type="button"
            onClick={() => setCameraView('reset')}
            className="px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all flex items-center gap-1 shrink-0"
            title="Reset View to Studio Perspective (F)"
          >
            <span className="material-symbols-outlined text-xs">restart_alt</span>
          </button>
        </div>
      )}

      {/* Target Marker Viewfinder HUD (Active when camera is scanning) */}
      {cameraEnabled && trackingStatus === 'SCANNING' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
          <div className="relative w-64 h-64 border border-emerald-400/20 rounded-3xl backdrop-blur-[1px] shadow-[0_0_60px_rgba(16,185,129,0.12)] flex items-center justify-center overflow-hidden">
            {/* Corner Alignment Brackets */}
            <div className="absolute top-2 left-2 w-7 h-7 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl"></div>
            <div className="absolute top-2 right-2 w-7 h-7 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl"></div>
            <div className="absolute bottom-2 left-2 w-7 h-7 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl"></div>
            <div className="absolute bottom-2 right-2 w-7 h-7 border-b-3 border-r-3 border-emerald-400 rounded-br-xl"></div>

            {/* Scanning Laser Beam */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-pulse"></div>

            {/* Center Target Indicator */}
            <div className="w-6 h-6 border border-emerald-400/60 rounded-full animate-ping"></div>
          </div>
          <p className="mt-5 text-emerald-300 text-xs font-mono font-black tracking-widest uppercase bg-black/95 px-4 py-2 rounded-full border-2 border-emerald-400 backdrop-blur-md shadow-2xl">
            Point Camera at Marker
          </p>
        </div>
      )}

      {/* AR Camera Initializing HUD (Active before camera feed streams) */}
      {cameraEnabled && trackingStatus === 'INITIALIZING' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-white px-6 text-center select-none animate-fade-in pointer-events-auto">
          {/* Animated Aperture / Radar Ring */}
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping opacity-30"></div>
            <div
              className="absolute inset-2 rounded-full border border-dashed border-indigo-400/60 animate-spin"
              style={{ animationDuration: '8s' }}
            ></div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-900/80 to-purple-900/60 border border-indigo-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              <span className="material-symbols-outlined text-3xl text-indigo-300 animate-pulse">
                photo_camera
              </span>
            </div>
          </div>

          <h2 className="text-lg font-bold tracking-tight text-white mb-2">
            Starting AR Camera Feed...
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs mb-6 leading-relaxed">
            Initializing computer vision tracking pipeline. Please allow camera permissions when prompted.
          </p>

          <button
            type="button"
            onClick={() => setCameraEnabled(false)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-full text-xs font-semibold text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-indigo-400">3d_rotation</span>
            <span>Or switch to 3D Preview Mode</span>
          </button>
        </div>
      )}

      {/* AR Camera Error Fallback (Active if camera permissions denied or device error) */}
      {cameraEnabled && trackingStatus === 'ERROR' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-white px-6 text-center select-none animate-fade-in pointer-events-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <span className="material-symbols-outlined text-3xl">no_photography</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Camera Access Required</h2>
          <p className="text-xs text-neutral-400 max-w-xs mb-6 leading-relaxed">
            Unable to access the camera feed. Please check camera permissions in your browser settings, or explore the model in 3D Preview Mode.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Try Again</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraEnabled(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-neutral-200 rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-indigo-400">3d_rotation</span>
              <span>3D Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* 3D Preview Mode Quick Action Pill (Studio4D4 Style: Auto-Rotate & Reset Framing) */}
      {!cameraEnabled && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700/80 shadow-2xl flex items-center gap-2">
            <button
              type="button"
              onClick={toggleCameraAutoRotate}
              className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                cameraAutoRotate
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-300 hover:text-white hover:bg-white/10'
              }`}
              title="Toggle 360 Auto-Rotation"
            >
              <span className={`material-symbols-outlined text-sm ${cameraAutoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                sync
              </span>
              <span>{cameraAutoRotate ? 'Rotating' : 'Auto Rotate'}</span>
            </button>

            <div className="w-px h-4 bg-white/20"></div>

            <button
              type="button"
              onClick={() => setCameraView('reset')}
              className="px-2.5 py-1 rounded-full text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reset to Studio Perspective (F)"
            >
              <span className="material-symbols-outlined text-sm">center_focus_strong</span>
              <span>Reset (F)</span>
            </button>
          </div>
        </div>
      )}

      {/* Buy Button Overlay */}
      {showBuyButton && (
        <BuyNowButton
          color={buyButtonColor}
          onClick={handleCheckout}
          disabled={checkoutLoading}
          price={arData?.price !== undefined ? Number(arData.price) : 99.00}
        />
      )}

      {/* System Diagnostics Drawer */}
      {showDiagnostics && (
        <div className="absolute inset-x-0 bottom-0 max-h-[50dvh] bg-black/95 z-50 p-4 flex flex-col font-mono text-xs shadow-2xl border-t border-indigo-500/30 backdrop-blur-xl">
          <div className="flex justify-between items-center pb-2 mb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-white tracking-wider">AR RUNTIME DIAGNOSTICS</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForceShowModel(!forceShowModel)}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-colors ${
                  forceShowModel ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {forceShowModel ? 'FORCE: ACTIVE' : 'FORCE RENDER'}
              </button>
              <button
                onClick={() => {
                  const text = diagnosticLogs.map((l) => `[${l.time}] [${l.tag}]\n${l.text}`).join('\n\n');
                  navigator.clipboard?.writeText(text);
                }}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold rounded"
              >
                COPY LOGS
              </button>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
            {diagnosticLogs.map((log) => (
              <div key={log.id} className="p-2 rounded bg-neutral-900/80 border border-neutral-800 leading-tight">
                <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-1">
                  <span className="font-bold text-indigo-400">[{log.tag}]</span>
                  <span>{log.time}</span>
                </div>
                <pre className="text-neutral-300 whitespace-pre-wrap break-all text-[11px] font-mono">{log.text}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ARExperience;
