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

        try {
          let assetSnap = null;
          try {
            assetSnap = await getDocFromServer(doc(db, 'assets', batchId));
          } catch {
            assetSnap = await getDoc(doc(db, 'assets', batchId));
          }
          if (assetSnap && assetSnap.exists()) {
            assetDocData = assetSnap.data();
          }
        } catch (fsErr) {
          logToScreen('FIRESTORE_ASSET_WARN', fsErr.message);
        }

        const mergedFsConfig = {
          ...(assetDocData?.ar_config || {}),
          ...(assetDocData?.portalConfig ? { portalConfig: assetDocData.portalConfig } : {}),
          ...(batchDocData?.ar_config || {}),
          ...(batchDocData?.portalConfig ? { portalConfig: batchDocData.portalConfig } : {})
        };
        if (Object.keys(mergedFsConfig).length > 0) {
          liveConfig = mergedFsConfig;
          logToScreen('FIRESTORE_CONFIG', 'Using live Firestore configuration merged from batches and assets.');
        }

        // Check local preview calibration config (for instant preview from AR Test editor)
        let localPreviewConfig = null;
        try {
          const stored = localStorage.getItem(`starwear_live_preview_config_${batchId}`) || localStorage.getItem('starwear_live_preview_config_last');
          if (stored) {
            localPreviewConfig = JSON.parse(stored);
            logToScreen('LOCAL_PREVIEW_CONFIG', 'Loaded active calibration config from AR Test session.');
          }
        } catch {}

        // Check URL search params for preview overrides (e.g. ?portal=1)
        let urlPortalOverride = null;
        try {
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get('portal') === '1' || searchParams.get('portal') === 'true') {
            urlPortalOverride = { enabled: true };
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

        const mergedConfig = {
          ...(data.arExperience?.config || {}),
          ...(data.ar_config || {}),
          ...(data.portalConfig ? { portalConfig: data.portalConfig } : {}),
          ...(assetDocData?.portalConfig ? { portalConfig: assetDocData.portalConfig } : {}),
          ...(batchDocData?.portalConfig ? { portalConfig: batchDocData.portalConfig } : {}),
          ...(liveConfig || {}),
          ...(localPreviewConfig || {}),
          ...(urlPortalOverride ? { portalConfig: { ...(liveConfig?.portalConfig || {}), ...(localPreviewConfig?.portalConfig || {}), ...urlPortalOverride } } : {}),
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
      document.body.style.backgroundColor = '';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = '';
    };
  }, [batchId]);

  // 2. Manage Viewport Background, Camera Feed Video & OrbitControls
  useEffect(() => {
    const sceneEl = sceneRef.current;

    if (cameraEnabled) {
      document.body.style.backgroundColor = 'transparent';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = 'transparent';
      if (sceneEl) sceneEl.style.backgroundColor = 'transparent';

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
  }, [cameraEnabled, getOrbitControls, getThreeCamera]);

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
  const ambientIntensity = cfg.ambientIntensity ?? 1.2;

  const dir1Color = cfg.dir1Color || '#ffffff';
  const dir1Intensity = cfg.dir1Intensity ?? 2.5;
  const dir1Position = cfg.dir1Position || '2 4 3';

  const dir2Color = cfg.dir2Color || '#ffffff';
  const dir2Intensity = cfg.dir2Intensity ?? 1.0;
  const dir2Position = cfg.dir2Position || '-2 -1 -2';

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
  const portalEnabled = !!(portalCfg && (portalCfg.enabled === true || portalCfg.enabled === 'true' || portalCfg.enabled === 1 || portalCfg.enabled === '1'));
  const portalHideOutsideModel = portalEnabled && !!portalCfg?.hideOutsideModel;
  const portalAttr = portalEnabled
    ? `enabled: true; shape: ${portalCfg.shape || 'arch'}; width: ${portalCfg.width ?? 1.1}; height: ${portalCfg.height ?? 1.8}; radius: ${portalCfg.radius ?? 0.7}; depth: ${portalCfg.depth ?? 3.5}; frameColor: ${portalCfg.frameColor || '#38bdf8'}; frameWidth: ${portalCfg.frameWidth ?? 0.08}; frameDepth: 0.08; frameEmissive: ${portalCfg.frameEmissive || '#0284c7'}; frameEmissiveIntensity: ${portalCfg.frameEmissiveIntensity ?? 1.5}; frameGlow: ${portalCfg.frameGlow ?? true}; glassTint: ${portalCfg.glassTint || '#38bdf8'}; glassOpacity: ${portalCfg.glassOpacity ?? 0.05}; interiorType: ${portalCfg.interiorType || 'nebula'}; skyboxUrl: ${portalCfg.skyboxUrl || ''}; interiorColor: ${portalCfg.interiorColor || '#050714'}; wallColor: ${portalCfg.wallColor || '#0f172a'}; floorColor: ${portalCfg.floorColor || '#020617'}; gridColor: ${portalCfg.gridColor || '#38bdf8'}; interiorLightColor: ${portalCfg.interiorLightColor || '#e0f2fe'}; interiorLightIntensity: ${portalCfg.interiorLightIntensity ?? 2.0}; interiorModelType: ${portalCfg.interiorModelType || 'artifact'}; artifactType: ${portalCfg.artifactType || 'crystal'}; customModelUrl: ${portalCfg.customModelUrl || ''}; currentModelUrl: ${arData?.gltfPath || ''}; modelScale: ${portalCfg.modelScale ?? 0.4}; modelPosX: ${portalCfg.modelPosX ?? 0}; modelPosY: ${portalCfg.modelPosY ?? 0}; modelPosZ: ${portalCfg.modelPosZ ?? -1.3}; modelRotSpeed: ${portalCfg.modelRotSpeed ?? 6000}; modelRotX: ${portalCfg.modelRotX ?? 0}; modelRotY: ${portalCfg.modelRotY ?? 0}; modelRotZ: ${portalCfg.modelRotZ ?? 0}; showVideo: ${portalCfg.showVideo ?? false}; videoUrl: ${portalCfg.videoUrl || arData?.videoUrl || ''}; videoScale: ${portalCfg.videoScale ?? 1.0}; videoPosY: ${portalCfg.videoPosY ?? 0}; videoPosZ: ${portalCfg.videoPosZ ?? -1.8}; particles: ${portalCfg.particles || 'stars'}; particleCount: ${portalCfg.particleCount ?? 180}; particleColor: ${portalCfg.particleColor || '#38bdf8'}; particleSpeed: ${portalCfg.particleSpeed ?? 1.0}; floatingText: ${portalCfg.floatingText || 'STAR weAR'}; textColor: ${portalCfg.textColor || '#38bdf8'}; textScale: ${portalCfg.textScale ?? 1.0}; textPosY: ${portalCfg.textPosY ?? 0.65}; textPosZ: ${portalCfg.textPosZ ?? -1.2}; posX: ${portalCfg.posX ?? 0}; posY: ${portalCfg.posY ?? 0}; posZ: ${portalCfg.posZ ?? 0}; rotX: ${portalCfg.rotX ?? 0}; rotY: ${portalCfg.rotY ?? 0}; rotZ: ${portalCfg.rotZ ?? 0};`
    : '';

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden select-none bg-transparent">
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
        renderer="colorManagement: true; physicallyCorrectLights: true; alpha: true; antialias: true; stencil: true;"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        loading-screen="enabled: false"
        scene-environment="exposure: 1.0"
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
          <a-light type="directional" color="#ffffff" intensity="1.2" position="0 0 1"></a-light>
        </a-camera>

        {/* Multi-Source Studio Lighting Rig */}
        <a-light type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
        <a-light type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
        <a-light type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

        {/* MindAR Target Anchor: Active in Live AR Camera Mode */}
        <a-entity id="target-entity" mindar-image-target={`targetIndex: ${targetIndex}`}>
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
        </a-entity>

        {/* Center 3D Model Anchor: Active in 3D Preview Mode (Studio4D4 OrbitControls) */}
        {!cameraEnabled && (
          <a-entity id="preview-anchor" position="0 0 0">
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
          </a-entity>
        )}

        {/* Force Test Render Anchor (Bypasses marker requirement for testing) */}
        {forceShowModel && cameraEnabled && (
          <a-entity position="0 0 -2">
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
