import 'aframe';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPrimitiveMesh } from './geometryHelper.js';


// =========================================================================
// YOUTUBE PARSING & DETECTION HELPERS (CORS SAFE)
// Prevents HTML5 <video> elements from ever touching YouTube URLs,
// completely eliminating browser CORS policy violations.
// =========================================================================
export const isYouTubeUrl = (urlOrId) => {
  if (!urlOrId || typeof urlOrId !== 'string') return false;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return true;
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+/i.test(trimmed);
};

export const isYouTubeShortUrl = (urlOrId) => {
  if (!urlOrId || typeof urlOrId !== 'string') return false;
  const trimmed = urlOrId.trim();
  return /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i.test(trimmed) || /youtu\.be\/shorts\/([a-zA-Z0-9_-]+)/i.test(trimmed);
};

export const extractYouTubeId = (urlOrId) => {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/|shorts\/)([^#&?]*).*/i;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : (trimmed.length === 11 ? trimmed : '');
};

// =========================================================================
// 3D GEOMETRY & SURFACE FRAME COMPUTATION HELPER
// Computes exact surface position, orientation (normal/tangent frame),
// and dimensions for any mesh or specific material/face group in 3D space.
// =========================================================================
export function computeGeometrySurfaceFrame(mesh, slotIndex = 0) {
  const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE) ? window.AFRAME.THREE : THREE;

  if (!mesh) {
    return {
      localCenter: new THREE_LIB.Vector3(0, 0, 0),
      localNormal: new THREE_LIB.Vector3(0, 0, 1),
      localRight: new THREE_LIB.Vector3(1, 0, 0),
      localUp: new THREE_LIB.Vector3(0, 1, 0),
      localQuat: new THREE_LIB.Quaternion(),
      worldCenter: new THREE_LIB.Vector3(0, 0, 0),
      worldNormal: new THREE_LIB.Vector3(0, 0, 1),
      worldQuat: new THREE_LIB.Quaternion(),
      size: new THREE_LIB.Vector3(0.5, 0.5, 0.1)
    };
  }

  let calcMesh = mesh;
  if (!calcMesh.isMesh && calcMesh.traverse) {
    calcMesh.traverse((child) => {
      if (!calcMesh.isMesh && child.isMesh && child.geometry) {
        calcMesh = child;
      }
    });
  }

  if (!calcMesh.geometry) {
    const worldCenter = new THREE_LIB.Vector3();
    const worldQuat = new THREE_LIB.Quaternion();
    calcMesh.getWorldPosition(worldCenter);
    calcMesh.getWorldQuaternion(worldQuat);
    return {
      localCenter: new THREE_LIB.Vector3(0, 0, 0),
      localNormal: new THREE_LIB.Vector3(0, 0, 1),
      localRight: new THREE_LIB.Vector3(1, 0, 0),
      localUp: new THREE_LIB.Vector3(0, 1, 0),
      localQuat: new THREE_LIB.Quaternion(),
      worldCenter,
      worldNormal: new THREE_LIB.Vector3(0, 0, 1).transformDirection(calcMesh.matrixWorld).normalize(),
      worldQuat,
      size: new THREE_LIB.Vector3(0.5, 0.5, 0.1)
    };
  }

  const geom = calcMesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bBox = geom.boundingBox || new THREE_LIB.Box3();
  const bSize = new THREE_LIB.Vector3();
  const bCenter = new THREE_LIB.Vector3();
  bBox.getSize(bSize);
  bBox.getCenter(bCenter);

  const posAttr = geom.attributes.position;
  const normAttr = geom.attributes.normal;
  const indexAttr = geom.index;

  let start = 0;
  let count = posAttr ? posAttr.count : 0;

  if (geom.groups && geom.groups.length > 0 && typeof slotIndex === 'number' && slotIndex >= 0) {
    const matchedGroup = geom.groups.find((g) => g.materialIndex === slotIndex);
    if (matchedGroup) {
      start = matchedGroup.start;
      count = matchedGroup.count;
    }
  }

  const faceCenter = new THREE_LIB.Vector3(0, 0, 0);
  const avgNormal = new THREE_LIB.Vector3(0, 0, 0);
  let vertexCount = 0;

  if (posAttr && normAttr && count > 0) {
    if (indexAttr) {
      const end = Math.min(start + count, indexAttr.count);
      for (let i = start; i < end; i++) {
        const idx = indexAttr.getX(i);
        faceCenter.x += posAttr.getX(idx);
        faceCenter.y += posAttr.getY(idx);
        faceCenter.z += posAttr.getZ(idx);
        avgNormal.x += normAttr.getX(idx);
        avgNormal.y += normAttr.getY(idx);
        avgNormal.z += normAttr.getZ(idx);
        vertexCount++;
      }
    } else {
      const end = Math.min(start + count, posAttr.count);
      for (let idx = start; idx < end; idx++) {
        faceCenter.x += posAttr.getX(idx);
        faceCenter.y += posAttr.getY(idx);
        faceCenter.z += posAttr.getZ(idx);
        avgNormal.x += normAttr.getX(idx);
        avgNormal.y += normAttr.getY(idx);
        avgNormal.z += normAttr.getZ(idx);
        vertexCount++;
      }
    }
  }

  if (vertexCount > 0) {
    faceCenter.divideScalar(vertexCount);
  } else {
    faceCenter.copy(bCenter);
  }

  if (avgNormal.lengthSq() > 0.0001) {
    avgNormal.normalize();
  } else {
    avgNormal.set(0, 0, 1);
  }

  const localQuat = new THREE_LIB.Quaternion();
  if (avgNormal.z < -0.9999) {
    localQuat.setFromAxisAngle(new THREE_LIB.Vector3(0, 1, 0), Math.PI);
  } else {
    localQuat.setFromUnitVectors(new THREE_LIB.Vector3(0, 0, 1), avgNormal);
  }

  const localRight = new THREE_LIB.Vector3(1, 0, 0).applyQuaternion(localQuat);
  const localUp = new THREE_LIB.Vector3(0, 1, 0).applyQuaternion(localQuat);

  const worldCenter = faceCenter.clone().applyMatrix4(calcMesh.matrixWorld);
  const worldQuat = calcMesh.getWorldQuaternion(new THREE_LIB.Quaternion()).multiply(localQuat);
  const worldNormal = avgNormal.clone().transformDirection(calcMesh.matrixWorld).normalize();

  return {
    localCenter: faceCenter,
    localNormal: avgNormal,
    localRight,
    localUp,
    localQuat,
    worldCenter,
    worldQuat,
    worldNormal,
    size: bSize
  };
}

// =========================================================================
// SCENE VIDEO LAYER CACHE & COMPREHENSIVE PURGE HELPER (MODULE LEVEL)
// =========================================================================
export const videoElementCache = new Map();

export function purgeAllSceneVideoLayers(sceneEl) {
  // 1. Clear videoElementCache
  videoElementCache.forEach((vid) => {
    try {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
      vid.remove();
    } catch {}
  });
  videoElementCache.clear();

  // 2. Remove hidden box and active video elements from DOM
  if (typeof document !== 'undefined') {
    const box = document.getElementById('aframe-video-hidden-box');
    if (box) {
      box.querySelectorAll('video').forEach((v) => {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch {}
      });
      box.remove();
    }

    const artestVid = document.getElementById('artest-active-video-element');
    if (artestVid) {
      try {
        artestVid.pause();
        artestVid.removeAttribute('src');
        artestVid.load();
      } catch {}
      artestVid.remove();
    }

    // Any other video elements in the DOM created for WebGL textures
    document.querySelectorAll('video').forEach((v) => {
      if (v.id.includes('video') || v.parentElement?.id === 'aframe-video-hidden-box' || v.classList.contains('video-player') || v.classList.contains('video-texture-source')) {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
          v.remove();
        } catch {}
      }
    });
  }

  // 3. Remove all CSS3D YouTube overlays
  const scene = sceneEl || (typeof document !== 'undefined' ? document.querySelector('a-scene') : null);
  if (scene) {
    if (scene._css3dScene) {
      const toRemove = [];
      scene._css3dScene.traverse((child) => {
        if (child.isCSS3DObject) toRemove.push(child);
      });
      toRemove.forEach((c) => {
        try {
          if (c.element && c.element.parentElement) {
            c.element.parentElement.remove();
          }
          scene._css3dScene.remove(c);
        } catch {}
      });
    }
    if (typeof document !== 'undefined') {
      const cssOverlay = document.getElementById('aframe-css3d-canvas-overlay');
      if (cssOverlay) {
        cssOverlay.querySelectorAll('iframe').forEach((ifr) => ifr.remove());
        cssOverlay.querySelectorAll('.aframe-youtube-sound-toggle').forEach((btn) => btn.remove());
      }
    }

    // 4. Strip all video textures and video metadata from all objects in scene.object3D
    if (scene.object3D) {
      scene.object3D.traverse((node) => {
        if (node.userData) {
          delete node.userData.videoUrl;
          delete node.userData.videoSrc;
          delete node.userData.video;
          delete node.userData.videoId;
          delete node.userData.youtubeId;
          delete node.userData.hasVideo;
          delete node.userData.isVideoLayer;
        }
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            if (mat.userData) {
              delete mat.userData.videoUrl;
              delete mat.userData.videoSrc;
              delete mat.userData.video;
              delete mat.userData.videoId;
              delete mat.userData.youtubeId;
              delete mat.userData.hasVideo;
              delete mat.userData.isVideoLayer;
            }
            const maps = ['map', 'emissiveMap', 'alphaMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'normalMap', 'displacementMap', 'lightMap'];
            maps.forEach((mapName) => {
              if (mat[mapName]) {
                const tex = mat[mapName];
                if (tex.isVideoTexture || (tex.image && (tex.image.tagName === 'VIDEO' || tex.image instanceof HTMLVideoElement)) || (tex.source?.data && (tex.source.data.tagName === 'VIDEO' || tex.source.data instanceof HTMLVideoElement))) {
                  try { tex.dispose(); } catch {}
                  mat[mapName] = null;
                  mat.needsUpdate = true;
                }
              }
            });
          });
        }
      });
    }

    // 5. Clean play-gltf-video component on any entity in scene
    const entities = scene.querySelectorAll('[play-gltf-video]');
    entities.forEach((el) => {
      const comp = el.components?.['play-gltf-video'];
      if (comp) {
        if (comp.videos) {
          comp.videos.forEach((v) => {
            try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch {}
          });
          comp.videos = [];
        }
        if (comp.videoTextures) {
          comp.videoTextures.forEach((t) => {
            try { t.dispose(); } catch {}
          });
          comp.videoTextures = [];
        }
        if (comp.cssObject && scene._css3dScene) {
          try { scene._css3dScene.remove(comp.cssObject); } catch {}
          comp.cssObject = null;
        }
        if (comp.youtubeIframe && comp.youtubeIframe.parentElement) {
          try { comp.youtubeIframe.parentElement.remove(); } catch {}
          comp.youtubeIframe = null;
        }
        comp.data.src = '';
      }
      el.setAttribute('play-gltf-video', 'src: ;');
    });
  }
}

// Global user-interaction listener to unlock mobile/Safari video autoplay
export const unlockAllVideos = () => {
  videoElementCache.forEach((video) => {
    if (video) {
      video.muted = true;
      video.playsInline = true;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
  });
};

if (typeof window !== 'undefined') {
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach((evt) => {
    window.addEventListener(evt, unlockAllVideos, { passive: true });
    document.addEventListener(evt, unlockAllVideos, { passive: true });
  });
}

// Module-level Video Element Resolver for WebGL VideoTextures (CORS & Safari Safe)
export const createOrActivateVideoElement = (videoOrUrl) => {
  if (!videoOrUrl) return null;
  if (videoOrUrl.tagName === 'VIDEO' || videoOrUrl instanceof HTMLVideoElement) {
    return videoOrUrl;
  }
  if (typeof videoOrUrl !== 'string' || videoOrUrl.trim() === '') {
    return null;
  }

  const url = videoOrUrl.trim();

  // YouTube Guard: Never load YouTube URLs into HTML5 <video> elements!
  if (isYouTubeUrl(url)) {
    return null;
  }

  if (videoElementCache.has(url)) {
    const cached = videoElementCache.get(url);
    if (cached && cached.isConnected) {
      cached.muted = true;
      if (cached.paused) cached.play().catch(() => {});
      return cached;
    }
  }

  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.loop = true;
  video.volume = 0;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('x5-playsinline', '');
  video.setAttribute('x5-video-player-type', 'h5-page');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.setAttribute('preload', 'auto');

  if (/^https?:\/\//i.test(url)) {
    video.crossOrigin = 'anonymous';
  }
  video.src = url;

  let container = document.getElementById('aframe-video-hidden-box');
  if (!container && typeof document !== 'undefined') {
    container = document.createElement('div');
    container.id = 'aframe-video-hidden-box';
    container.style.cssText = 'position:fixed;top:0;left:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-999;overflow:hidden;';
    document.body.appendChild(container);
  }
  if (container) {
    container.appendChild(video);
  }

  try {
    video.load();
  } catch {}

  const tryPlay = () => {
    video.muted = true;
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {});
    }
  };

  video.addEventListener('canplay', tryPlay);
  video.addEventListener('canplaythrough', tryPlay);
  video.addEventListener('loadeddata', tryPlay);
  video.addEventListener('loadedmetadata', tryPlay);
  tryPlay();

  videoElementCache.set(url, video);
  return video;
};

const AFRAME = typeof window !== 'undefined' ? window.AFRAME : undefined;

if (typeof AFRAME !== 'undefined') {
  // =========================================================================
  // ORBIT CAMERA CONTROLS COMPONENT (ROTATION, PAN, ZOOM, DAMPING)
  // Replicates the exact Three.js OrbitControls experience from ProductViewer
  // =========================================================================
  if (!AFRAME.components['orbit-camera-controls']) {
    AFRAME.registerComponent('orbit-camera-controls', {
      schema: {
        enabled: { type: 'boolean', default: true },
        enableDamping: { type: 'boolean', default: true },
        dampingFactor: { type: 'number', default: 0.08 },
        screenSpacePanning: { type: 'boolean', default: true },
        minDistance: { type: 'number', default: 0.2 },
        maxDistance: { type: 'number', default: 100 },
        autoRotate: { type: 'boolean', default: false },
        autoRotateSpeed: { type: 'number', default: 1.2 },
        enableRotate: { type: 'boolean', default: true },
        enablePan: { type: 'boolean', default: true },
        enableZoom: { type: 'boolean', default: true },
        rotateSpeed: { type: 'number', default: 1.0 },
        zoomSpeed: { type: 'number', default: 1.0 },
        panSpeed: { type: 'number', default: 1.0 }
      },

      init: function () {
        this.controls = null;

        const setup = () => {
          if (this.controls) return;
          const sceneEl = this.el.sceneEl;
          if (!sceneEl) return;

          const canvas = sceneEl.canvas;
          const camera = this.el.getObject3D('camera') || sceneEl.camera;
          if (!canvas || !camera) {
            setTimeout(setup, 50);
            return;
          }

          // Ensure entity root stays at origin (0,0,0) so camera is purely in world space (matching Studio4D4)
          if (this.el.object3D) {
            this.el.object3D.position.set(0, 0, 0);
            this.el.object3D.rotation.set(0, 0, 0);
            this.el.object3D.scale.set(1, 1, 1);
          }

          // Studio4D4: Prevent native gesture interference
          canvas.style.touchAction = 'none';

          const isEnabled = this.data.enabled !== undefined ? this.data.enabled : true;
          if (isEnabled && camera.position.lengthSq() < 0.001) {
            camera.position.set(0, 1.2, 3.5);
          }

          const controls = new OrbitControls(camera, canvas);
          controls.enabled = isEnabled;
          controls.enableDamping = this.data.enableDamping;
          controls.dampingFactor = this.data.dampingFactor;
          controls.screenSpacePanning = this.data.screenSpacePanning;
          controls.autoRotate = this.data.autoRotate;
          controls.autoRotateSpeed = this.data.autoRotateSpeed;
          controls.minDistance = this.data.minDistance;
          controls.maxDistance = this.data.maxDistance;
          controls.enableRotate = this.data.enableRotate;
          controls.enablePan = this.data.enablePan;
          controls.enableZoom = this.data.enableZoom;
          controls.rotateSpeed = this.data.rotateSpeed;
          controls.zoomSpeed = this.data.zoomSpeed;
          controls.panSpeed = this.data.panSpeed;
          controls.target.set(0, 0, 0);
          if (isEnabled) {
            controls.update();
          }

          this.controls = controls;
          this.el.orbitControls = controls;

          if (typeof window !== 'undefined') {
            window.__arOrbitControls = controls;
            window.__arOrbitCamera = camera;
          }
        };

        const sceneEl = this.el.sceneEl;
        if (sceneEl.hasLoaded && sceneEl.canvas) {
          setup();
        } else {
          sceneEl.addEventListener('loaded', setup);
          sceneEl.addEventListener('render-target-loaded', setup);
          sceneEl.addEventListener('camera-set-active', setup);
        }
      },

      update: function () {
        if (!this.controls) return;
        if (this.data.enabled !== undefined) {
          const wasEnabled = this.controls.enabled;
          this.controls.enabled = this.data.enabled;
          if (!wasEnabled && this.data.enabled) {
            const camera = this.el.getObject3D('camera') || this.el.sceneEl?.camera;
            if (camera && camera.position.lengthSq() < 0.001) {
              camera.position.set(0, 1.2, 3.5);
              camera.lookAt(0, 0, 0);
            }
            this.controls.target.set(0, 0, 0);
            this.controls.update();
          }
        }
        if (this.data.autoRotate !== undefined) {
          this.controls.autoRotate = this.data.autoRotate;
        }
        if (this.data.autoRotateSpeed !== undefined) {
          this.controls.autoRotateSpeed = this.data.autoRotateSpeed;
        }
        if (this.data.enableDamping !== undefined) {
          this.controls.enableDamping = this.data.enableDamping;
        }
        if (this.data.dampingFactor !== undefined) {
          this.controls.dampingFactor = this.data.dampingFactor;
        }
        if (this.data.screenSpacePanning !== undefined) {
          this.controls.screenSpacePanning = this.data.screenSpacePanning;
        }
        if (this.data.minDistance !== undefined) {
          this.controls.minDistance = this.data.minDistance;
        }
        if (this.data.maxDistance !== undefined) {
          this.controls.maxDistance = this.data.maxDistance;
        }
        if (this.data.enableRotate !== undefined) {
          this.controls.enableRotate = this.data.enableRotate;
        }
        if (this.data.enablePan !== undefined) {
          this.controls.enablePan = this.data.enablePan;
        }
        if (this.data.enableZoom !== undefined) {
          this.controls.enableZoom = this.data.enableZoom;
        }
        if (this.data.rotateSpeed !== undefined) {
          this.controls.rotateSpeed = this.data.rotateSpeed;
        }
        if (this.data.zoomSpeed !== undefined) {
          this.controls.zoomSpeed = this.data.zoomSpeed;
        }
        if (this.data.panSpeed !== undefined) {
          this.controls.panSpeed = this.data.panSpeed;
        }
      },

      tick: function () {
        if (this.controls && this.controls.enabled) {
          if (this.el.object3D && this.el.object3D.position.lengthSq() > 0.0001) {
            this.el.object3D.position.set(0, 0, 0);
          }
          this.controls.update();
        }
      },

      remove: function () {
        if (this.controls) {
          this.controls.dispose();
          this.controls = null;
        }
        this.el.orbitControls = null;
        if (typeof window !== 'undefined' && window.__arOrbitControls === this.controls) {
          window.__arOrbitControls = null;
          window.__arOrbitCamera = null;
        }
      }
    });
  }

  // =========================================================================
  // 1. SCENE-ENVIRONMENT COMPONENT
  // Sets up procedural Image-Based Lighting (IBL) via PMREMGenerator & RoomEnvironment,
  // ACESFilmic Tone Mapping, and sRGB color management on the WebGL scene.
  // =========================================================================
  if (!AFRAME.components['scene-environment']) {
    AFRAME.registerComponent('scene-environment', {
      schema: {
        exposure: { type: 'number', default: 1.1 },
        hdrIntensity: { type: 'number', default: 0.0 },
        enabled: { type: 'boolean', default: false }
      },
      init: function () {
        this.setupEnvironment = this.setupEnvironment.bind(this);
        const sceneEl = this.el;

        if (sceneEl.hasLoaded) {
          this.setupEnvironment();
        } else {
          sceneEl.addEventListener('loaded', this.setupEnvironment);
          sceneEl.addEventListener('render-target-loaded', this.setupEnvironment);
        }
      },
      update: function () {
        const renderer = this.el.renderer;
        if (renderer) {
          renderer.toneMappingExposure = this.data.exposure !== undefined ? this.data.exposure : 1.1;
        }
        if (this.el.object3D) {
          if (!this.data.enabled || this.data.hdrIntensity <= 0) {
            this.el.object3D.environment = null;
          }
        }
      },
      setupEnvironment: function () {
        const scene = this.el.object3D;
        const renderer = this.el.renderer;
        if (!renderer || !scene) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        // Configure Tone Mapping & Color Space (matching ProductViewer)
        if (THREE_LIB.ACESFilmicToneMapping !== undefined) {
          renderer.toneMapping = THREE_LIB.ACESFilmicToneMapping;
        }
        renderer.toneMappingExposure = this.data.exposure !== undefined ? this.data.exposure : 1.1;

        if (renderer.outputColorSpace !== undefined && THREE_LIB.SRGBColorSpace !== undefined) {
          renderer.outputColorSpace = THREE_LIB.SRGBColorSpace;
        }

        // Only attach procedural RoomEnvironment if explicitly enabled with hdrIntensity > 0
        if (this.data.enabled && this.data.hdrIntensity > 0) {
          try {
            const pmremGenerator = new THREE_LIB.PMREMGenerator(renderer);
            pmremGenerator.compileEquirectangularShader();
            const roomEnv = new RoomEnvironment();
            const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
            scene.environment = envTexture;
            this.envTexture = envTexture;
            this.pmremGenerator = pmremGenerator;
          } catch (err) {
            console.warn('[scene-environment] Could not initialize RoomEnvironment:', err);
          }
        } else {
          scene.environment = null;
        }
      },
      remove: function () {
        if (this.envTexture) {
          this.envTexture.dispose();
        }
        if (this.pmremGenerator) {
          this.pmremGenerator.dispose();
        }
      }
    });
  }

  // =========================================================================
  // 2. DYNAMIC-MATERIALS COMPONENT
  // Traverses the 3D model hierarchy, safely preserving all embedded GLTF/GLB
  // texture maps (diffuse, normal, roughness, metalness, emissive, ao, alpha)
  // while applying PBR lighting parameters and DoubleSide rendering.
  // =========================================================================
  if (!AFRAME.components['dynamic-materials']) {
    AFRAME.registerComponent('dynamic-materials', {
      schema: {
        metalness: { type: 'number', default: -1 },
        roughness: { type: 'number', default: -1 },
        emissive: { type: 'color', default: '' },
        emissiveIntensity: { type: 'number', default: -1 },
        wireframe: { type: 'boolean', default: false },
        opacity: { type: 'number', default: 1.0 }
      },
      init: function () {
        this.applyMaterials = this.applyMaterials.bind(this);
        this.el.addEventListener('model-loaded', this.applyMaterials);

        if (this.el.getObject3D('mesh')) {
          this.applyMaterials();
        }
      },
      update: function () {
        this.applyMaterials();
      },
      applyMaterials: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const data = this.data;

        obj.traverse((node) => {
          if (node.isMesh) {
            // Ensure smooth normals for realistic surface specular highlights
            if (node.geometry && !node.geometry.attributes.normal) {
              node.geometry.computeVertexNormals();
            }

            if (node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];

              materials.forEach((mat) => {
                // Ensure double-sided rendering to prevent backface culling darkness
                mat.side = THREE_LIB.DoubleSide;

                // Configure color spaces on texture maps
                if (mat.map) {
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    mat.map.colorSpace = THREE_LIB.SRGBColorSpace;
                  } else if (THREE_LIB.sRGBEncoding !== undefined) {
                    mat.map.encoding = THREE_LIB.sRGBEncoding;
                  }
                  mat.map.needsUpdate = true;
                }

                if (mat.emissiveMap) {
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    mat.emissiveMap.colorSpace = THREE_LIB.SRGBColorSpace;
                  } else if (THREE_LIB.sRGBEncoding !== undefined) {
                    mat.emissiveMap.encoding = THREE_LIB.sRGBEncoding;
                  }
                  mat.emissiveMap.needsUpdate = true;
                }

                if (mat.normalMap) mat.normalMap.needsUpdate = true;
                if (mat.roughnessMap) mat.roughnessMap.needsUpdate = true;
                if (mat.metalnessMap) mat.metalnessMap.needsUpdate = true;
                if (mat.aoMap) mat.aoMap.needsUpdate = true;
                if (mat.alphaMap) mat.alphaMap.needsUpdate = true;

                // Apply explicit user overrides only if configured (>= 0 or non-empty)
                if (data.metalness >= 0 && mat.metalness !== undefined) {
                  mat.metalness = data.metalness;
                }
                if (data.roughness >= 0 && mat.roughness !== undefined) {
                  mat.roughness = data.roughness;
                }

                if (data.emissive && data.emissive.trim() !== '' && mat.emissive && typeof mat.emissive.set === 'function') {
                  mat.emissive.set(data.emissive);
                }
                if (data.emissiveIntensity >= 0 && mat.emissiveIntensity !== undefined) {
                  mat.emissiveIntensity = data.emissiveIntensity;
                }

                mat.wireframe = !!data.wireframe;

                if (data.opacity !== undefined && data.opacity < 1.0) {
                  mat.opacity = data.opacity;
                  mat.transparent = true;
                }

                mat.needsUpdate = true;
              });
            }
          }
        });
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyMaterials);
      }
    });
  }

  // =========================================================================
  // 3. MODEL-AUTO-CENTER COMPONENT
  // Centers the 3D model bounding box to the target anchor coordinate frame
  // and normalizes any abnormal coordinate dimensions.
  // =========================================================================
  if (!AFRAME.components['model-auto-center']) {
    AFRAME.registerComponent('model-auto-center', {
      schema: {
        enabled: { type: 'boolean', default: true },
        targetSize: { type: 'number', default: 1.0 }
      },
      init: function () {
        this.centerModel = this.centerModel.bind(this);
        this.el.addEventListener('model-loaded', this.centerModel);
        if (this.el.getObject3D('mesh')) {
          this.centerModel();
        }
      },
      centerModel: function () {
        if (!this.data.enabled) return;
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const box = new THREE_LIB.Box3();
        let hasMeshes = false;
        mesh.traverse((child) => {
          if (child.isMesh && child.geometry) {
            const name = (child.name || '').toLowerCase();
            const isScreen = /screen|video|display|cinema|tv|bezel/i.test(name) || child.userData?.archetype === 'VIDEO_SCREEN' || child.userData?.archetype === 'CSS3D_YOUTUBE';
            if (!isScreen) {
              box.expandByObject(child);
              hasMeshes = true;
            }
          }
        });
        if (!hasMeshes || box.isEmpty()) {
          box.setFromObject(mesh);
        }
        if (box.isEmpty()) return;

        const size = new THREE_LIB.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        if (isFinite(maxDim) && maxDim > 0) {
          // Normalize models authored in millimeters (>10 units) or sub-millimeter (<0.05 units)
          if (maxDim > 10 || maxDim < 0.05) {
            const autoScale = this.data.targetSize / maxDim;
            if (isFinite(autoScale) && autoScale > 0) {
              mesh.scale.set(autoScale, autoScale, autoScale);
            }
          }
        }

        // Recompute center after scale normalization and align pivot (ignoring screens)
        const newBox = new THREE_LIB.Box3();
        let hasNewMeshes = false;
        mesh.traverse((child) => {
          if (child.isMesh && child.geometry) {
            const name = (child.name || '').toLowerCase();
            const isScreen = /screen|video|display|cinema|tv|bezel/i.test(name) || child.userData?.archetype === 'VIDEO_SCREEN' || child.userData?.archetype === 'CSS3D_YOUTUBE';
            if (!isScreen) {
              newBox.expandByObject(child);
              hasNewMeshes = true;
            }
          }
        });
        if (!hasNewMeshes || newBox.isEmpty()) {
          newBox.setFromObject(mesh);
        }

        const center = new THREE_LIB.Vector3();
        newBox.getCenter(center);

        if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
          mesh.position.x -= center.x;
          mesh.position.y -= center.y;
          mesh.position.z -= center.z;
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.centerModel);
      }
    });
  }

  // =========================================================================
  // 4. PLAY-GLTF-VIDEO COMPONENT
  // Finds and decodes video textures embedded in GLTF materials or supplied via src,
  // ensures iOS Safari WebKit mobile compatibility (playsinline before src, muted,
  // DOM attached, user gesture unlocking), and forces WebGL texture memory sync on every render frame.
  // =========================================================================
  if (!AFRAME.components['play-gltf-video']) {
    AFRAME.registerComponent('play-gltf-video', {
      schema: {
        src: { type: 'string', default: '' },
        playing: { type: 'boolean', default: true },
        muted: { type: 'boolean', default: false },
        targetMesh: { type: 'string', default: 'auto' },
        flipX: { type: 'boolean', default: false },
        videoScale: { type: 'number', default: 1.0 },
        videoOrientationMode: { type: 'string', default: 'OBJECT_LOCK' },
        videoOffsetX: { type: 'number', default: 0.0 },
        videoOffsetY: { type: 'number', default: 0.0 },
        videoOffsetZ: { type: 'number', default: 0.0 },
        videoRotation: { type: 'number', default: 0.0 },
        videoRotationX: { type: 'number', default: 0.0 },
        videoRotationY: { type: 'number', default: 0.0 },
        videoRotationZ: { type: 'number', default: 0.0 },
        videoOcclusionEnabled: { type: 'boolean', default: true },
        videoTextureRepeatX: { type: 'number', default: 1.0 },
        videoTextureRepeatY: { type: 'number', default: 1.0 },
        videoTextureOffsetX: { type: 'number', default: 0.0 },
        videoTextureOffsetY: { type: 'number', default: 0.0 },
        aspectRatio: { type: 'string', default: '16:9' }
      },
      init: function () {
        this.videos = [];
        this.videoTextures = [];
        this.cssObject = null;
        this.cssTargetNode = null;
        this.youtubeIframe = null;
        this.containerDiv = null;
        this.iframeW = 640;
        this.iframeH = 360;
        this.baseScale = 0.003125;
        this.isMuted = this.data.muted !== undefined ? this.data.muted : false;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this._vWorld = new THREE_LIB.Vector3();
        this._qWorld = new THREE_LIB.Quaternion();
        this._sWorld = new THREE_LIB.Vector3();
        this._vForward = new THREE_LIB.Vector3();

        this.applyVideo = this.applyVideo.bind(this);
        this.unlockVideos = this.unlockVideos.bind(this);
        this.setMuted = this.setMuted.bind(this);
        this.applyCSS3DYouTube = this.applyCSS3DYouTube.bind(this);

        this.onSetMute = (e) => {
          const nextMuted = (e && e.detail && e.detail.muted !== undefined) ? e.detail.muted : !this.isMuted;
          this.setMuted(nextMuted);
        };
        this.el.addEventListener('set-video-mute', this.onSetMute);
        window.addEventListener('starwear-set-video-mute', this.onSetMute);

        this.el.addEventListener('model-loaded', this.applyVideo);
        if (this.el.getObject3D('mesh')) {
          this.applyVideo();
        }

        // Global interaction listeners to unlock mobile autoplay restrictions and sound if unmuted
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
          window.addEventListener(evt, this.unlockVideos, { passive: true });
        });

        // Listen for targetFound and arReady on parent scene
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('targetFound', this.applyVideo);
          sceneEl.addEventListener('arReady', this.applyVideo);
          sceneEl.addEventListener('set-video-mute', this.onSetMute);
        }
      },
      setMuted: function (muted) {
        this.isMuted = !!muted;
        if (this.youtubeIframe && this.youtubeIframe.contentWindow) {
          try {
            const func = this.isMuted ? 'mute' : 'unMute';
            this.youtubeIframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: func, args: [] }),
              '*'
            );
            if (!this.isMuted) {
              this.youtubeIframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                '*'
              );
            }
          } catch (e) {}
        }
        if (this.videos && this.videos.length > 0) {
          this.videos.forEach((v) => {
            if (v) {
              v.muted = this.isMuted;
              if (!this.isMuted) {
                v.volume = 1.0;
                if (this.data.playing && v.paused) {
                  v.play().catch(() => {});
                }
              }
            }
          });
        }
        if (typeof this._updateMuteBadge === 'function') {
          this._updateMuteBadge();
        }
        window.dispatchEvent(
          new CustomEvent('starwear-video-mute-status', { detail: { muted: this.isMuted } })
        );
      },
      unlockVideos: function () {
        if (!this.data.playing) return;
        if (this.videos && this.videos.length > 0) {
          this.videos.forEach((v) => {
            if (v && v.paused) {
              v.play().catch(() => {});
            }
            if (!this.isMuted) {
              v.muted = false;
              v.volume = 1.0;
            }
          });
        }
        if (this.youtubeIframe && this.youtubeIframe.contentWindow) {
          try {
            this.youtubeIframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
            if (!this.isMuted) {
              this.youtubeIframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                '*'
              );
              this.youtubeIframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                '*'
              );
            }
          } catch {}
        }
      },
      update: function (oldData) {
        if (!oldData || oldData.src !== this.data.src || oldData.targetMesh !== this.data.targetMesh || oldData.flipX !== this.data.flipX || oldData.aspectRatio !== this.data.aspectRatio) {
          this.applyVideo();
        } else if (
          oldData && (
            oldData.videoTextureRepeatX !== this.data.videoTextureRepeatX ||
            oldData.videoTextureRepeatY !== this.data.videoTextureRepeatY ||
            oldData.videoTextureOffsetX !== this.data.videoTextureOffsetX ||
            oldData.videoTextureOffsetY !== this.data.videoTextureOffsetY ||
            oldData.videoRotation !== this.data.videoRotation
          )
        ) {
          if (this.videoTextures) {
            this.videoTextures.forEach((tex) => this.applyTextureFlip(tex, this.data.flipX));
          }
        }
        if (oldData && oldData.muted !== this.data.muted) {
          this.setMuted(this.data.muted);
        }
        if (!oldData || oldData.playing !== this.data.playing) {
          if (this.youtubeIframe && this.youtubeIframe.contentWindow) {
            const cmd = this.data.playing ? 'playVideo' : 'pauseVideo';
            try {
              this.youtubeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
            } catch {}
          }
          if (this.data.playing) {
            if (this.videos) {
              this.videos.forEach((v) => {
                if (v && v.paused) v.play().catch(() => {});
              });
            }
          } else {
            if (this.videos) {
              this.videos.forEach((v) => {
                if (v && !v.paused) v.pause();
              });
            }
          }
        }
      },
      applyTextureFlip: function (tex, isFlipX) {
        if (!tex) return;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const flip = isFlipX !== undefined ? isFlipX : this.data.flipX;
        const repX = (this.data.videoTextureRepeatX || 1.0) * (flip ? -1 : 1);
        const repY = this.data.videoTextureRepeatY || 1.0;
        const offX = (this.data.videoTextureOffsetX || 0.0) + (flip ? 1.0 : 0.0);
        const offY = this.data.videoTextureOffsetY || 0.0;
        const rot = ((this.data.videoRotation || 0.0) * Math.PI) / 180;

        tex.wrapS = THREE_LIB.RepeatWrapping;
        tex.wrapT = THREE_LIB.RepeatWrapping;
        tex.repeat.set(repX, repY);
        tex.offset.set(offX, offY);
        tex.center.set(0.5, 0.5);
        tex.rotation = rot;
        tex.matrixAutoUpdate = true;
        if (tex.updateMatrix) tex.updateMatrix();
        tex.needsUpdate = true;
      },
      applyCSS3DYouTube: function (youtubeId, targetNode, aspectRatio = '16:9') {
        if (!youtubeId) return;
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this.youtubeId = youtubeId;
        this.cssTargetNode = targetNode || this.el.getObject3D('mesh');

        // 1. Ensure scene-wide CSS3DRenderer overlay exists
        let cssRenderer = sceneEl._css3dRenderer;
        let cssScene = sceneEl._css3dScene;

        if (!cssRenderer) {
          cssRenderer = new CSS3DRenderer();
          const container = sceneEl.canvas?.parentElement || sceneEl;
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || window.innerHeight;
          cssRenderer.setSize(w, h);

          const dom = cssRenderer.domElement;
          dom.id = 'aframe-css3d-canvas-overlay';
          dom.style.position = 'absolute';
          dom.style.top = '0';
          dom.style.left = '0';
          dom.style.width = '100%';
          dom.style.height = '100%';
          dom.style.pointerEvents = 'none';
          dom.style.zIndex = '10';

          container.appendChild(dom);

          cssScene = new THREE_LIB.Scene();
          sceneEl._css3dRenderer = cssRenderer;
          sceneEl._css3dScene = cssScene;

          const handleResize = () => {
            if (sceneEl.canvas && cssRenderer) {
              const rw = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientWidth : window.innerWidth;
              const rh = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientHeight : window.innerHeight;
              cssRenderer.setSize(rw, rh);
            }
          };
          window.addEventListener('resize', handleResize);
          sceneEl._css3dResizeHandler = handleResize;
        }

        // 2. Remove existing CSS3DObject if present on this component
        if (this.cssObject && cssScene) {
          cssScene.remove(this.cssObject);
          this.cssObject = null;
        }

        // 3. Aspect ratio sizing
        let iframeW = 640;
        let iframeH = 360;
        if (aspectRatio === '9:16') {
          iframeW = 360;
          iframeH = 640;
        } else if (aspectRatio === '21:9') {
          iframeW = 840;
          iframeH = 360;
        }

        // 4. Create HTML iframe wrapper
        const containerDiv = document.createElement('div');
        containerDiv.style.width = `${iframeW}px`;
        containerDiv.style.height = `${iframeH}px`;
        containerDiv.style.background = '#090d16';
        containerDiv.style.borderRadius = '12px';
        containerDiv.style.overflow = 'hidden';
        containerDiv.style.position = 'relative';
        containerDiv.style.pointerEvents = 'auto'; // allow user interaction with YouTube player
        containerDiv.style.boxShadow = '0 20px 50px rgba(0,0,0,0.85)';
        containerDiv.style.border = '2px solid rgba(99, 102, 241, 0.5)';
        containerDiv.style.backfaceVisibility = 'hidden';
        containerDiv.style.webkitBackfaceVisibility = 'hidden';
        containerDiv.style.transition = 'opacity 0.12s ease-out';

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0px';
        const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
        iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&mute=1&controls=1&loop=1&playlist=${youtubeId}${originParam}`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;

        iframe.addEventListener('load', () => {
          if (!this.isMuted) {
            setTimeout(() => {
              try {
                iframe.contentWindow?.postMessage(
                  JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                  '*'
                );
                iframe.contentWindow?.postMessage(
                  JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                  '*'
                );
              } catch (e) {}
            }, 600);
          }
        });

        containerDiv.appendChild(iframe);
        this.youtubeIframe = iframe;
        this.containerDiv = containerDiv;
        this.iframeW = iframeW;
        this.iframeH = iframeH;

        // Floating Sound Badge on the 3D screen overlay
        const muteBadge = document.createElement('button');
        muteBadge.type = 'button';
        muteBadge.className = 'aframe-youtube-sound-toggle';
        muteBadge.style.cssText = 'position:absolute;top:12px;right:12px;z-index:99;background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:9999px;padding:6px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 15px rgba(0,0,0,0.7);pointer-events:auto;user-select:none;transition:transform 0.15s ease;';

        const updateMuteBadgeUI = () => {
          if (this.isMuted) {
            muteBadge.innerHTML = '<span style="font-size:14px;">🔇</span><span>Sound Off (Tap to Unmute)</span>';
            muteBadge.style.background = 'rgba(225, 29, 72, 0.9)';
            muteBadge.style.borderColor = 'rgba(253, 164, 175, 0.5)';
          } else {
            muteBadge.innerHTML = '<span style="font-size:14px;">🔊</span><span>Sound On (Tap to Mute)</span>';
            muteBadge.style.background = 'rgba(16, 185, 129, 0.9)';
            muteBadge.style.borderColor = 'rgba(110, 231, 183, 0.5)';
          }
        };
        this._updateMuteBadge = updateMuteBadgeUI;
        updateMuteBadgeUI();

        const handleBadgeToggle = (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.setMuted(!this.isMuted);
        };
        muteBadge.addEventListener('click', handleBadgeToggle);
        muteBadge.addEventListener('touchend', handleBadgeToggle);
        containerDiv.appendChild(muteBadge);

        // 5. Create CSS3DObject
        const cssObject = new CSS3DObject(containerDiv);
        let calcMesh = this.cssTargetNode;
        if (calcMesh && !calcMesh.isMesh && calcMesh.traverse) {
          calcMesh.traverse((c) => {
            if (!calcMesh.isMesh && c.isMesh && c.geometry) calcMesh = c;
          });
        }

        let targetW = 0.5;
        let spawnPos = new THREE_LIB.Vector3(0, 1.2, 0);
        if (calcMesh && calcMesh.geometry) {
          if (!calcMesh.geometry.boundingBox) calcMesh.geometry.computeBoundingBox();
          if (calcMesh.geometry.boundingBox) {
            const bBox = calcMesh.geometry.boundingBox;
            const bSize = new THREE_LIB.Vector3();
            const bCenter = new THREE_LIB.Vector3();
            bBox.getSize(bSize);
            bBox.getCenter(bCenter);
            targetW = Math.max(bSize.x, 0.05);
            const localCenter = bCenter.clone();
            localCenter.applyMatrix4(calcMesh.matrixWorld);
            spawnPos.copy(localCenter);
          }
        }
        const baseScale = targetW / iframeW;

        cssObject.scale.set(baseScale, baseScale, baseScale);
        cssObject.position.copy(spawnPos);
        if (calcMesh) {
          calcMesh.getWorldQuaternion(cssObject.quaternion);
        }

        cssScene.add(cssObject);
        this.cssObject = cssObject;
        this.baseScale = baseScale;

        // Wire targetFound and targetLost tracking sync listeners
        if (!this._onTargetFound) {
          this._onTargetFound = () => {
            this.isTargetLost = false;
            if (this.cssObject) {
              this.cssObject.visible = true;
              if (this.cssObject.element) this.cssObject.element.style.display = 'block';
            }
          };
          this._onTargetLost = () => {
            this.isTargetLost = true;
            if (this.cssObject) {
              this.cssObject.visible = false;
              if (this.cssObject.element) this.cssObject.element.style.display = 'none';
            }
          };
          sceneEl.addEventListener('targetFound', this._onTargetFound);
          sceneEl.addEventListener('targetLost', this._onTargetLost);
          this.el.addEventListener('targetFound', this._onTargetFound);
          this.el.addEventListener('targetLost', this._onTargetLost);
          if (this.el.parentElement) {
            this.el.parentElement.addEventListener('targetFound', this._onTargetFound);
            this.el.parentElement.addEventListener('targetLost', this._onTargetLost);
          }
        }

        // 6. Style backing WebGL screen mesh so it acts as bezel
        if (this.cssTargetNode && this.cssTargetNode.material) {
          const materials = Array.isArray(this.cssTargetNode.material) ? this.cssTargetNode.material : [this.cssTargetNode.material];
          const targetSlot = typeof this.cssTargetNode.userData?.videoTargetMaterialIndex === 'number'
            ? this.cssTargetNode.userData.videoTargetMaterialIndex
            : null;

          materials.forEach((mat, idx) => {
            const isTarget = targetSlot !== null
              ? idx === targetSlot
              : (mat?.userData?.hasVideo || mat?.userData?.isVideoLayer || materials.length === 1);

            if (isTarget) {
              if (mat.color) mat.color.setHex(0x0e1322);
              mat.roughness = 0.3;
              mat.metalness = 0.8;
              if (mat.emissive) mat.emissive.setHex(0x1e1b4b);
              mat.emissiveIntensity = 0.2;
              mat.needsUpdate = true;
            }
          });
        }
      },
      applyVideo: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        // Clean up previously active videos and textures on this component
        if (this.videos && this.videos.length > 0) {
          this.videos.forEach((v) => {
            try {
              v.pause();
              v.removeAttribute('src');
              v.load();
              v.remove();
            } catch {}
          });
        }
        if (this.videoTextures && this.videoTextures.length > 0) {
          this.videoTextures.forEach((t) => {
            try { t.dispose(); } catch {}
          });
        }
        this.videos = [];
        this.videoTextures = [];

        // If src is explicitly empty, tear down any video overlays / textures completely
        if (!this.data.src || this.data.src.trim() === '') {
          if (this.cssObject && this.el.sceneEl?._css3dScene) {
            try { this.el.sceneEl._css3dScene.remove(this.cssObject); } catch {}
            this.cssObject = null;
          }
          if (this.youtubeIframe && this.youtubeIframe.parentElement) {
            try { this.youtubeIframe.parentElement.remove(); } catch {}
            this.youtubeIframe = null;
          }
          obj.traverse((node) => {
            if (node.isMesh && node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((mat) => {
                if (mat.map && (mat.map.isVideoTexture || mat.map.image instanceof HTMLVideoElement)) {
                  try { mat.map.dispose(); } catch {}
                  mat.map = null;
                  mat.needsUpdate = true;
                }
                if (mat.emissiveMap && (mat.emissiveMap.isVideoTexture || mat.emissiveMap.image instanceof HTMLVideoElement)) {
                  try { mat.emissiveMap.dispose(); } catch {}
                  mat.emissiveMap = null;
                  mat.needsUpdate = true;
                }
              });
            }
          });
          return;
        }

        const targetParam = (this.data.targetMesh || 'auto').trim().toLowerCase();
        const screenKeywords = ['video', 'screen', 'display', 'cinema', 'videomat', 'screenmat'];

        const matchedMeshes = [];
        const allMeshes = [];
        const autoScreenMeshes = [];

        obj.traverse((node) => {
          if (node.isMesh) {
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
                node.userData?.videoId ||
                (Array.isArray(node.material)
                  ? node.material.some((m) => m?.userData?.hasVideo || m?.userData?.isVideoLayer || m?.userData?.videoId)
                  : (node.material?.userData?.hasVideo || node.material?.userData?.isVideoLayer || node.material?.userData?.videoId))
              );
              if (hasVideo || screenKeywords.some((kw) => nodeName.includes(kw))) {
                autoScreenMeshes.push(node);
              }
            }
          }
        });

        let finalTargetMeshes = matchedMeshes;
        if (finalTargetMeshes.length === 0 && targetParam === 'auto') {
          finalTargetMeshes = autoScreenMeshes.length > 0 ? [autoScreenMeshes[0]] : [];
        }

        // Check for YouTube video source (via component src, or embedded model userData)
        let ytId = '';
        let ytTargetNode = finalTargetMeshes[0] || (targetParam === 'all' ? obj : null);
        let ytAspect = this.data.aspectRatio || '16:9';

        if (this.data.src && isYouTubeUrl(this.data.src)) {
          ytId = extractYouTubeId(this.data.src);
          if (isYouTubeShortUrl(this.data.src) && (!this.data.aspectRatio || this.data.aspectRatio === '16:9')) {
            ytAspect = '9:16';
          }
        }

        // 1. Check root group/model obj.userData
        if (!ytId && obj.userData) {
          const rootData = obj.userData;
          if (rootData.videoId || rootData.youtubeId) {
            ytId = rootData.videoId || rootData.youtubeId;
            if (rootData.aspectRatio) ytAspect = rootData.aspectRatio;
          } else if (rootData.videoUrl && isYouTubeUrl(rootData.videoUrl)) {
            ytId = extractYouTubeId(rootData.videoUrl);
            if (rootData.aspectRatio) ytAspect = rootData.aspectRatio;
            else if (isYouTubeShortUrl(rootData.videoUrl)) ytAspect = '9:16';
          } else if (rootData.videoSrc && isYouTubeUrl(rootData.videoSrc)) {
            ytId = extractYouTubeId(rootData.videoSrc);
            if (rootData.aspectRatio) ytAspect = rootData.aspectRatio;
            else if (isYouTubeShortUrl(rootData.videoSrc)) ytAspect = '9:16';
          }

          if (ytId && (rootData.videoTargetMeshName || rootData.videoTargetMeshUuid)) {
            const targetName = (rootData.videoTargetMeshName || '').toLowerCase();
            const targetUuid = (rootData.videoTargetMeshUuid || '').toLowerCase();
            obj.traverse((node) => {
              if (node.isMesh && ((node.name && node.name.toLowerCase() === targetName) || (node.uuid && node.uuid.toLowerCase() === targetUuid))) {
                ytTargetNode = node;
              }
            });
          }
        }

        // 2. Check child meshes, groups, and material slots
        if (!ytId) {
          obj.traverse((node) => {
            if (ytId) return;
            const uData = node.userData || {};
            if (uData.videoId || uData.youtubeId) {
              ytId = uData.videoId || uData.youtubeId;
              ytTargetNode = node.isMesh ? node : (node.children?.find((c) => c.isMesh) || node);
              if (uData.aspectRatio) ytAspect = uData.aspectRatio;
            } else if (uData.videoUrl && isYouTubeUrl(uData.videoUrl)) {
              ytId = extractYouTubeId(uData.videoUrl);
              ytTargetNode = node.isMesh ? node : (node.children?.find((c) => c.isMesh) || node);
              if (uData.aspectRatio) ytAspect = uData.aspectRatio;
              else if (isYouTubeShortUrl(uData.videoUrl)) ytAspect = '9:16';
            } else if (uData.videoSrc && isYouTubeUrl(uData.videoSrc)) {
              ytId = extractYouTubeId(uData.videoSrc);
              ytTargetNode = node.isMesh ? node : (node.children?.find((c) => c.isMesh) || node);
              if (uData.aspectRatio) ytAspect = uData.aspectRatio;
              else if (isYouTubeShortUrl(uData.videoSrc)) ytAspect = '9:16';
            } else if (node.isMesh && node.material) {
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              for (const m of mats) {
                const mData = m?.userData || {};
                if (mData.videoId || mData.youtubeId) {
                  ytId = mData.videoId || mData.youtubeId;
                  ytTargetNode = node;
                  if (mData.aspectRatio) ytAspect = mData.aspectRatio;
                  break;
                } else if (mData.videoUrl && isYouTubeUrl(mData.videoUrl)) {
                  ytId = extractYouTubeId(mData.videoUrl);
                  ytTargetNode = node;
                  if (mData.aspectRatio) ytAspect = mData.aspectRatio;
                  else if (isYouTubeShortUrl(mData.videoUrl)) ytAspect = '9:16';
                  break;
                } else if (mData.videoSrc && isYouTubeUrl(mData.videoSrc)) {
                  ytId = extractYouTubeId(mData.videoSrc);
                  ytTargetNode = node;
                  if (mData.aspectRatio) ytAspect = mData.aspectRatio;
                  else if (isYouTubeShortUrl(mData.videoSrc)) ytAspect = '9:16';
                  break;
                }
              }
            }
          });
        }

        if (ytId && !ytTargetNode && finalTargetMeshes.length > 0) {
          ytTargetNode = finalTargetMeshes[0];
        }

        if (ytId && ytTargetNode) {
          this.applyCSS3DYouTube(ytId, ytTargetNode, ytAspect);
          return;
        } else if (this.cssObject && this.el.sceneEl?._css3dScene) {
          this.el.sceneEl._css3dScene.remove(this.cssObject);
          this.cssObject = null;
        }

        const isFlip = !!this.data.flipX;

        // 1. If explicit video src is provided on component, create VideoTexture and map to mesh
        if (this.data.src && this.data.src.trim() !== '') {
          const video = createOrActivateVideoElement(this.data.src);
          if (video) {
            const videoTexture = new THREE_LIB.VideoTexture(video);
            if (THREE_LIB.SRGBColorSpace !== undefined) {
              videoTexture.colorSpace = THREE_LIB.SRGBColorSpace;
            }
            videoTexture.minFilter = THREE_LIB.LinearFilter;
            videoTexture.magFilter = THREE_LIB.LinearFilter;
            videoTexture.generateMipmaps = false;
            videoTexture.flipY = false;
            this.applyTextureFlip(videoTexture, isFlip);

            this.videos.push(video);
            this.videoTextures.push(videoTexture);

            // Ensure non-target meshes have any video texture stripped
            allMeshes.forEach((node) => {
              if (!finalTargetMeshes.includes(node)) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach((mat) => {
                  if (mat.map && (mat.map.isVideoTexture || mat.map.image instanceof HTMLVideoElement)) {
                    mat.map = null;
                    mat.needsUpdate = true;
                  }
                  if (mat.emissiveMap && (mat.emissiveMap.isVideoTexture || mat.emissiveMap.image instanceof HTMLVideoElement)) {
                    mat.emissiveMap = null;
                    mat.needsUpdate = true;
                  }
                });
              }
            });

            finalTargetMeshes.forEach((node) => {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              const targetSlot = typeof node.userData?.videoTargetMaterialIndex === 'number'
                ? node.userData.videoTargetMaterialIndex
                : null;

              materials.forEach((mat, idx) => {
                const isTarget = targetSlot !== null
                  ? idx === targetSlot
                  : (mat?.userData?.hasVideo || mat?.userData?.isVideoLayer || materials.length === 1 || (node.userData?.archetype === 'VIDEO_SCREEN' && idx === 4));

                if (isTarget) {
                  mat.map = videoTexture;
                  mat.emissiveMap = videoTexture;
                  if (mat.color && typeof mat.color.set === 'function') {
                    mat.color.set(0xffffff);
                  }
                  if (mat.emissive && typeof mat.emissive.set === 'function') {
                    mat.emissive.set(0xffffff);
                  }
                  mat.emissiveIntensity = 0.5;
                  mat.needsUpdate = true;
                }
              });
            });
          }
        }

        // 2. Discover embedded video textures, node.userData video URLs, and texture video URIs (only if no explicit src)
        if (!this.data.src || this.data.src.trim() === '') {
          obj.traverse((node) => {
            if (node.isMesh && node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              
              // Check if node or material has a videoUrl in userData (e.g. from Studio 4D*4 export)
              const nodeVideoUrl = node.userData?.videoUrl || node.userData?.videoSrc || node.userData?.video ||
                materials.find((m) => m?.userData?.videoUrl)?.userData?.videoUrl || '';

              if (nodeVideoUrl) {
                const video = createOrActivateVideoElement(nodeVideoUrl);
                if (video) {
                  const vTex = new THREE_LIB.VideoTexture(video);
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    vTex.colorSpace = THREE_LIB.SRGBColorSpace;
                  }
                  vTex.minFilter = THREE_LIB.LinearFilter;
                  vTex.magFilter = THREE_LIB.LinearFilter;
                  vTex.generateMipmaps = false;
                  vTex.flipY = false;
                  this.applyTextureFlip(vTex, isFlip);

                  const targetSlot = typeof node.userData?.videoTargetMaterialIndex === 'number'
                    ? node.userData.videoTargetMaterialIndex
                    : null;

                  materials.forEach((mat, idx) => {
                    const isTarget = targetSlot !== null
                      ? idx === targetSlot
                      : (mat?.userData?.hasVideo || mat?.userData?.isVideoLayer || materials.length === 1 || (node.userData?.archetype === 'VIDEO_SCREEN' && idx === 4));

                    if (isTarget) {
                      mat.map = vTex;
                      mat.emissiveMap = vTex;
                      if (mat.color && typeof mat.color.set === 'function') {
                        mat.color.set(0xffffff);
                      }
                      if (mat.emissive && typeof mat.emissive.set === 'function') {
                        mat.emissive.set(0xffffff);
                      }
                      mat.emissiveIntensity = 0.4;
                      mat.needsUpdate = true;
                    }
                  });

                  if (!this.videos.includes(video)) this.videos.push(video);
                  if (!this.videoTextures.includes(vTex)) this.videoTextures.push(vTex);
                }
              }

              materials.forEach((mat) => {
                const maps = [
                  'map',
                  'emissiveMap',
                  'alphaMap',
                  'roughnessMap',
                  'metalnessMap',
                  'aoMap',
                  'bumpMap',
                  'normalMap',
                  'displacementMap'
                ];
                maps.forEach((mapName) => {
                  if (mat[mapName]) {
                    const tex = mat[mapName];
                    let video = null;
                    let vTex = null;

                    // Case A: Texture is already a VideoTexture or image is a video tag
                    if (tex.image && (tex.image.tagName === 'VIDEO' || tex.image instanceof HTMLVideoElement)) {
                      video = createOrActivateVideoElement(tex.image);
                      vTex = tex;
                    } else if (tex.source && tex.source.data && (tex.source.data.tagName === 'VIDEO' || tex.source.data instanceof HTMLVideoElement)) {
                      video = createOrActivateVideoElement(tex.source.data);
                      vTex = tex;
                    } else if (mat.userData && mat.userData.video) {
                      video = createOrActivateVideoElement(mat.userData.video);
                      vTex = tex;
                    } else if (tex.isVideoTexture && tex.image) {
                      video = createOrActivateVideoElement(tex.image);
                      vTex = tex;
                    }
                    // Case B: Texture image URL is a video file (.mp4, .webm, .mov, etc.)
                    else if (tex.image && typeof tex.image.src === 'string' && /\.(mp4|webm|mov|ogg)($|\?)/i.test(tex.image.src)) {
                      video = createOrActivateVideoElement(tex.image.src);
                      vTex = new THREE_LIB.VideoTexture(video);
                      if (THREE_LIB.SRGBColorSpace !== undefined) {
                        vTex.colorSpace = THREE_LIB.SRGBColorSpace;
                      }
                      vTex.minFilter = THREE_LIB.LinearFilter;
                      vTex.magFilter = THREE_LIB.LinearFilter;
                      vTex.generateMipmaps = false;
                      vTex.flipY = false;
                      mat[mapName] = vTex;
                      mat.needsUpdate = true;
                    }

                    if (video && vTex) {
                      this.applyTextureFlip(vTex, isFlip);
                      if (!this.videos.includes(video)) {
                        this.videos.push(video);
                      }
                      if (!this.videoTextures.includes(vTex)) {
                        this.videoTextures.push(vTex);
                      }
                      if (this.data.playing) {
                        video.play().catch(() => {});
                      }
                    }
                  }
                });
              });
            }
          });
        }
      },
      tick: function () {
        // 1. Synchronize CSS3D YouTube overlay with target 3D screen mesh
        if (this.cssObject && this.cssTargetNode) {
          const sceneEl = this.el.sceneEl;
          const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

          if (!this._tempWorldPos) {
            this._tempWorldPos = new THREE_LIB.Vector3();
            this._tempWorldQuat = new THREE_LIB.Quaternion();
            this._tempWorldScale = new THREE_LIB.Vector3();
          }

          let target = this.cssTargetNode;
          if (!target.isMesh) {
            target.traverse?.((c) => {
              if (!target.isMesh && c.isMesh && c.geometry) target = c;
            });
          }

          target.getWorldPosition(this._tempWorldPos);
          target.getWorldQuaternion(this._tempWorldQuat);
          target.getWorldScale(this._tempWorldScale);

          // Base orientation locked 1:1 to target object's world quaternion
          const orientMode = this.data.videoOrientationMode || target.userData?.videoOrientationMode || 'OBJECT_LOCK';
          let baseQuat = this._tempWorldQuat.clone();

          if (orientMode === 'BACK_FACE') {
            baseQuat.multiply(new THREE_LIB.Quaternion().setFromAxisAngle(new THREE_LIB.Vector3(0, 1, 0), Math.PI));
          } else if (orientMode === 'TOP_FACE') {
            baseQuat.multiply(new THREE_LIB.Quaternion().setFromAxisAngle(new THREE_LIB.Vector3(1, 0, 0), -Math.PI / 2));
          } else if (orientMode === 'BOTTOM_FACE') {
            baseQuat.multiply(new THREE_LIB.Quaternion().setFromAxisAngle(new THREE_LIB.Vector3(1, 0, 0), Math.PI / 2));
          } else if (orientMode === 'RIGHT_FACE') {
            baseQuat.multiply(new THREE_LIB.Quaternion().setFromAxisAngle(new THREE_LIB.Vector3(0, 1, 0), Math.PI / 2));
          } else if (orientMode === 'LEFT_FACE') {
            baseQuat.multiply(new THREE_LIB.Quaternion().setFromAxisAngle(new THREE_LIB.Vector3(0, 1, 0), -Math.PI / 2));
          } else if (orientMode === 'SURFACE_NORMAL' && target && target.geometry) {
            const slotIdx = typeof target.userData?.videoTargetMaterialIndex === 'number'
              ? target.userData.videoTargetMaterialIndex
              : 0;
            const frame = computeGeometrySurfaceFrame(target, slotIdx);
            baseQuat.copy(frame.worldQuat);
          }

          // 3-Axis Euler Rotation in Object Space (Pitch X, Yaw Y, Roll Z)
          const rotXDeg = this.data.videoRotationX !== undefined && this.data.videoRotationX !== 0
            ? this.data.videoRotationX
            : Number(target.userData?.videoRotationX || 0);
          const rotYDeg = this.data.videoRotationY !== undefined && this.data.videoRotationY !== 0
            ? this.data.videoRotationY
            : Number(target.userData?.videoRotationY || 0);
          const rotZDeg = this.data.videoRotationZ !== undefined && this.data.videoRotationZ !== 0
            ? this.data.videoRotationZ
            : Number(target.userData?.videoRotationZ ?? (target.userData?.videoRotation ?? (this.data.videoRotation || 0)));

          const rotX = THREE_LIB.MathUtils.degToRad(rotXDeg);
          const rotY = THREE_LIB.MathUtils.degToRad(rotYDeg);
          const rotZ = THREE_LIB.MathUtils.degToRad(rotZDeg);

          if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
            const userRotQuat = new THREE_LIB.Quaternion().setFromEuler(new THREE_LIB.Euler(rotX, rotY, rotZ, 'YXZ'));
            baseQuat.multiply(userRotQuat);
          }
          this.cssObject.quaternion.copy(baseQuat);

          // Local center calculation from geometry bounding box
          let localCenter = new THREE_LIB.Vector3(0, 0, 0);
          let localNormal = new THREE_LIB.Vector3(0, 0, 1);
          let localRight = new THREE_LIB.Vector3(1, 0, 0);
          let localUp = new THREE_LIB.Vector3(0, 1, 0);

          if (target && target.geometry) {
            if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
            const bBox = target.geometry.boundingBox;
            if (bBox) {
              bBox.getCenter(localCenter);
              if (orientMode === 'FRONT_FACE') {
                localCenter.z = bBox.max.z;
              } else if (orientMode === 'BACK_FACE') {
                localCenter.z = bBox.min.z;
              } else if (orientMode === 'TOP_FACE') {
                localCenter.y = bBox.max.y;
              } else if (orientMode === 'BOTTOM_FACE') {
                localCenter.y = bBox.min.y;
              } else if (orientMode === 'RIGHT_FACE') {
                localCenter.x = bBox.max.x;
              } else if (orientMode === 'LEFT_FACE') {
                localCenter.x = bBox.min.x;
              } else if (orientMode === 'SURFACE_NORMAL') {
                const slotIdx = typeof target.userData?.videoTargetMaterialIndex === 'number'
                  ? target.userData.videoTargetMaterialIndex
                  : 0;
                const frame = computeGeometrySurfaceFrame(target, slotIdx);
                localCenter.copy(frame.localCenter);
                localNormal.copy(frame.localNormal);
                localRight.copy(frame.localRight);
                localUp.copy(frame.localUp);
              }
            }
          }

          // User spatial offsets in meters
          const uOffsetX = this.data.videoOffsetX !== undefined && this.data.videoOffsetX !== 0
            ? this.data.videoOffsetX
            : Number(target.userData?.videoOffsetX || 0);
          const uOffsetY = this.data.videoOffsetY !== undefined && this.data.videoOffsetY !== 0
            ? this.data.videoOffsetY
            : Number(target.userData?.videoOffsetY || 0);
          const uOffsetZ = this.data.videoOffsetZ !== undefined && this.data.videoOffsetZ !== 0
            ? this.data.videoOffsetZ
            : Number(target.userData?.videoOffsetZ || 0);

          const localFinal = localCenter.clone();
          if (orientMode === 'SURFACE_NORMAL') {
            localFinal.addScaledVector(localNormal, uOffsetZ);
            localFinal.addScaledVector(localRight, uOffsetX);
            localFinal.addScaledVector(localUp, uOffsetY);
          } else {
            localFinal.add(new THREE_LIB.Vector3(uOffsetX, uOffsetY, uOffsetZ));
          }
          localFinal.applyMatrix4(target.matrixWorld);
          this.cssObject.position.copy(localFinal);

          // User scale multiplier
          const uScale = (this.data.videoScale !== undefined && this.data.videoScale > 0)
            ? this.data.videoScale
            : (target.userData?.videoScale || 1.0);
          const baseScale = (this.baseScale || 0.0006) * uScale;

          this.cssObject.scale.set(
            baseScale * Math.abs(this._tempWorldScale.x || 1),
            baseScale * Math.abs(this._tempWorldScale.y || 1),
            baseScale * Math.abs(this._tempWorldScale.z || 1)
          );

          // Backface Culling & Depth Occlusion check for AR camera
          const camera = sceneEl.camera;
          const occlusionEnabled = (this.data.videoOcclusionEnabled !== false) && (target.userData?.videoOcclusionEnabled !== false);
          if (this.containerDiv && !this.isTargetLost) {
            if (!occlusionEnabled) {
              this.containerDiv.style.opacity = '1';
              this.containerDiv.style.pointerEvents = 'auto';
              this.containerDiv.style.visibility = 'visible';
            } else if (camera) {
              if (!this._screenNormal) {
                this._screenNormal = new THREE_LIB.Vector3();
                this._camToScreen = new THREE_LIB.Vector3();
              }
              this._screenNormal.set(0, 0, 1).applyQuaternion(this.cssObject.quaternion).normalize();
              this._camToScreen.copy(this.cssObject.position).sub(camera.position).normalize();
              const facingDot = this._screenNormal.dot(this._camToScreen);

              if (facingDot >= -0.02) {
                // Facing away or glancing angle: cull backface
                this.containerDiv.style.opacity = '0';
                this.containerDiv.style.pointerEvents = 'none';
                this.containerDiv.style.visibility = 'hidden';
              } else {
                this.containerDiv.style.opacity = '1';
                this.containerDiv.style.pointerEvents = 'auto';
                this.containerDiv.style.visibility = 'visible';
              }
            }
          }

          if (sceneEl && sceneEl._css3dRenderer && sceneEl._css3dScene && sceneEl.camera) {
            // Force world matrix and inverse updates on A-Frame camera so CSS3DRenderer projections match WebGL identically
            sceneEl.camera.updateWorldMatrix(true, false);
            if (sceneEl.camera.matrixWorldInverse) {
              sceneEl.camera.matrixWorldInverse.copy(sceneEl.camera.matrixWorld).invert();
            }
            sceneEl._css3dRenderer.render(sceneEl._css3dScene, sceneEl.camera);
          }
        }

        // 2. Synchronize WebGL VideoTextures
        if (this.data.playing && this.videoTextures.length > 0) {
          for (let i = 0; i < this.videoTextures.length; i++) {
            const tex = this.videoTextures[i];
            const vid = this.videos[i];
            if (vid) {
              if (vid.paused && vid.readyState >= 2) {
                vid.play().catch(() => {});
              }
              if (!vid.paused) {
                tex.needsUpdate = true;
              }
            }
          }
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyVideo);
        if (this.onSetMute) {
          this.el.removeEventListener('set-video-mute', this.onSetMute);
          window.removeEventListener('starwear-set-video-mute', this.onSetMute);
        }
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.removeEventListener('targetFound', this.applyVideo);
          sceneEl.removeEventListener('arReady', this.applyVideo);
          if (this.onSetMute) {
            sceneEl.removeEventListener('set-video-mute', this.onSetMute);
          }
          if (this._onTargetFound && this._onTargetLost) {
            sceneEl.removeEventListener('targetFound', this._onTargetFound);
            sceneEl.removeEventListener('targetLost', this._onTargetLost);
          }
          if (this.cssObject && sceneEl._css3dScene) {
            sceneEl._css3dScene.remove(this.cssObject);
            this.cssObject = null;
          }
        }
        if (this._onTargetFound && this._onTargetLost) {
          this.el.removeEventListener('targetFound', this._onTargetFound);
          this.el.removeEventListener('targetLost', this._onTargetLost);
          if (this.el.parentElement) {
            this.el.parentElement.removeEventListener('targetFound', this._onTargetFound);
            this.el.parentElement.removeEventListener('targetLost', this._onTargetLost);
          }
        }
        if (this.youtubeIframe && this.youtubeIframe.parentElement) {
          this.youtubeIframe.parentElement.remove();
          this.youtubeIframe = null;
        }
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
          window.removeEventListener(evt, this.unlockVideos);
        });
        this.videos.forEach((v) => v.pause());
      }
    });
  }

  // =========================================================================
  // 5. PLAY-GLTF-ANIMATION COMPONENT
  // Drives skeletal and morph target animation clips embedded inside GLTF/GLB models.
  // =========================================================================
  if (!AFRAME.components['play-gltf-animation']) {
    AFRAME.registerComponent('play-gltf-animation', {
      schema: { playing: { type: 'boolean', default: true } },
      init: function () {
        this.mixer = null;
        this.applyAnimation = this.applyAnimation.bind(this);
        this.el.addEventListener('model-loaded', this.applyAnimation);
        if (this.el.getObject3D('mesh')) {
          this.applyAnimation();
        }
      },
      applyAnimation: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj || !obj.animations || obj.animations.length === 0) return;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this.mixer = new THREE_LIB.AnimationMixer(obj);
        obj.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
        if (!this.data.playing) {
          this.mixer.timeScale = 0;
        }
      },
      update: function () {
        if (this.mixer) {
          this.mixer.timeScale = this.data.playing ? 1 : 0;
        }
      },
      tick: function (time, timeDelta) {
        if (this.mixer && this.data.playing) {
          this.mixer.update(timeDelta / 1000);
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyAnimation);
        if (this.mixer) {
          this.mixer.stopAllAction();
        }
      }
    });
  }

  // =========================================================================
  // 6. PROCEDURAL TEXTURE GENERATORS FOR AR PORTAL
  // =========================================================================
  const getPortalThree = () => ((typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE) ? window.AFRAME.THREE : THREE);

  function generateProceduralNebulaTexture() {
    if (typeof document === 'undefined') return null;
    const THREE_LIB = getPortalThree();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark cosmic gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#02030a');
    bgGrad.addColorStop(0.5, '#070b1e');
    bgGrad.addColorStop(1, '#02030a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Luminous cosmic dust clouds
    const drawCloud = (cx, cy, r, c1, c2) => {
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, c1);
      g.addColorStop(0.5, c2);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    drawCloud(280, 200, 240, 'rgba(168, 85, 247, 0.45)', 'rgba(59, 130, 246, 0.15)');
    drawCloud(720, 310, 260, 'rgba(6, 182, 212, 0.4)', 'rgba(99, 102, 241, 0.15)');
    drawCloud(460, 280, 190, 'rgba(236, 72, 153, 0.35)', 'rgba(147, 51, 234, 0.1)');
    drawCloud(860, 180, 210, 'rgba(56, 189, 248, 0.35)', 'rgba(30, 58, 138, 0.1)');

    // Star specks
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 1.5 + 0.3;
      const alpha = Math.random() * 0.85 + 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE_LIB.CanvasTexture(canvas);
    tex.wrapS = THREE_LIB.RepeatWrapping;
    tex.wrapT = THREE_LIB.ClampToEdgeWrapping;
    return tex;
  }

  function generateProceduralGridTexture(gridColor = '#38bdf8', bgColor = '#020617') {
    if (typeof document === 'undefined') return null;
    const THREE_LIB = getPortalThree();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(128, 0); ctx.lineTo(128, 256);
    ctx.moveTo(0, 128); ctx.lineTo(256, 128);
    ctx.stroke();

    const tex = new THREE_LIB.CanvasTexture(canvas);
    tex.wrapS = THREE_LIB.RepeatWrapping;
    tex.wrapT = THREE_LIB.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  function generateHolographicTextTexture(text = 'STAR weAR', color = '#38bdf8') {
    if (typeof document === 'undefined') return null;
    const THREE_LIB = getPortalThree();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 128);

    // Glowing capsule frame
    ctx.fillStyle = 'rgba(8, 14, 29, 0.8)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(16, 16, 480, 96, 24);
    } else {
      ctx.rect(16, 16, 480, 96);
    }
    ctx.fill();
    ctx.stroke();

    // Text with soft glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const tex = new THREE_LIB.CanvasTexture(canvas);
    return tex;
  }

  // =========================================================================
  // 7. AR-PORTAL COMPONENT (VIRTUAL WINDOW & DIMENSIONAL GATEWAY)
  // Optical illusion portal using hardware WebGL Stencil Buffer.
  // Interior objects are strictly rendered where aperture stencil = 1.
  // Features camera pass-through immersion & customizable interior world.
  // =========================================================================
  if (!AFRAME.components['ar-portal']) {
    AFRAME.registerComponent('ar-portal', {
      schema: {
        enabled: { type: 'boolean', default: false },
        shape: { type: 'string', default: 'arch' }, // 'arch' | 'rectangle' | 'circle' | 'hexagon'
        width: { type: 'number', default: 1.1 },
        height: { type: 'number', default: 1.8 },
        radius: { type: 'number', default: 0.7 },
        depth: { type: 'number', default: 3.2 },
        frameColor: { type: 'color', default: '#38bdf8' },
        frameWidth: { type: 'number', default: 0.08 },
        frameDepth: { type: 'number', default: 0.08 },
        frameEmissive: { type: 'color', default: '#0284c7' },
        frameEmissiveIntensity: { type: 'number', default: 1.5 },
        frameGlow: { type: 'boolean', default: true },
        glassTint: { type: 'color', default: '#38bdf8' },
        glassOpacity: { type: 'number', default: 0.05 },
        interiorType: { type: 'string', default: 'nebula' }, // 'nebula' | 'starfield' | 'grid-room' | 'matrix' | 'skybox' | 'void'
        skyboxUrl: { type: 'string', default: '' },
        skyboxScale: { type: 'number', default: 1.0 },
        skyboxPosX: { type: 'number', default: 0.0 },
        skyboxPosY: { type: 'number', default: 0.0 },
        skyboxPosZ: { type: 'number', default: 0.0 },
        skyboxRotX: { type: 'number', default: 0 },
        skyboxRotY: { type: 'number', default: 0 },
        skyboxRotZ: { type: 'number', default: 0 },
        skyboxBlur: { type: 'number', default: 0.0 },
        interiorColor: { type: 'color', default: '#050714' },
        wallColor: { type: 'color', default: '#0f172a' },
        floorColor: { type: 'color', default: '#020617' },
        gridColor: { type: 'color', default: '#38bdf8' },
        interiorLightColor: { type: 'color', default: '#e0f2fe' },
        interiorLightIntensity: { type: 'number', default: 2.0 },
        interiorModelType: { type: 'string', default: 'artifact' }, // 'none' | 'artifact' | 'current-product' | 'custom-glb'
        customModelUrl: { type: 'string', default: '' },
        currentModelUrl: { type: 'string', default: '' },
        modelScale: { type: 'number', default: 0.4 },
        modelPosX: { type: 'number', default: 0.0 },
        modelPosY: { type: 'number', default: 0.0 },
        modelPosZ: { type: 'number', default: -1.3 },
        modelRotSpeed: { type: 'number', default: 6000 },
        modelRotX: { type: 'number', default: 0 },
        modelRotY: { type: 'number', default: 0 },
        modelRotZ: { type: 'number', default: 0 },
        showVideo: { type: 'boolean', default: false },
        videoUrl: { type: 'string', default: '' },
        videoScale: { type: 'number', default: 1.0 },
        videoPosY: { type: 'number', default: 0.0 },
        videoPosZ: { type: 'number', default: -1.8 },
        particles: { type: 'string', default: 'stars' }, // 'stars' | 'embers' | 'cyber' | 'none'
        particleCount: { type: 'number', default: 160 },
        particleColor: { type: 'color', default: '#38bdf8' },
        particleSpeed: { type: 'number', default: 1.0 },
        floatingText: { type: 'string', default: 'STAR weAR' },
        textColor: { type: 'color', default: '#38bdf8' },
        textScale: { type: 'number', default: 1.0 },
        textPosY: { type: 'number', default: 0.65 },
        textPosZ: { type: 'number', default: -1.2 },
        posX: { type: 'number', default: 0.0 },
        posY: { type: 'number', default: 0.0 },
        posZ: { type: 'number', default: 0.0 },
        rotX: { type: 'number', default: 0 },
        rotY: { type: 'number', default: 0 },
        rotZ: { type: 'number', default: 0 }
      },

      init: function () {
        const THREE_LIB = getPortalThree();
        this.rootGroup = new THREE_LIB.Group();
        this.portalFrameGroup = new THREE_LIB.Group();
        this.interiorGroup = new THREE_LIB.Group();

        this.rootGroup.add(this.portalFrameGroup);
        this.rootGroup.add(this.interiorGroup);
        this.el.setObject3D('portalRoot', this.rootGroup);

        this.tempCamWorld = new THREE_LIB.Vector3();
        this.tempCamLocal = new THREE_LIB.Vector3();
        this.isCameraInside = false;
        this.activeArtifact = null;
        this.cyberCoreRings = [];
        this.particlesObj = null;
        this.particleVelocities = [];
        this.loadedCustomModel = null;
        this.skyboxMesh = null;

        // Video Screen properties & CSS3D state
        this.portalVideo = null;
        this.portalVideoTexture = null;
        this.portalCssObject = null;
        this.portalYoutubeIframe = null;
        this.portalContainerDiv = null;
        this.portalVideoMesh = null;
        this.portalBaseScale = 0.0025;
        this._portalQuat = new THREE_LIB.Quaternion();
        this._portalScale = new THREE_LIB.Vector3();
        this._portalForward = new THREE_LIB.Vector3();
        this._portalPos = new THREE_LIB.Vector3();
        this._portalCamToScreen = new THREE_LIB.Vector3();
        this.isTargetLost = false;

        const LoaderClass = (THREE_LIB && THREE_LIB.GLTFLoader) ? THREE_LIB.GLTFLoader : GLTFLoader;
        this.gltfLoader = new LoaderClass();

        this.buildPortal();

        this.onTargetFound = () => {
          this.isTargetLost = false;
          if (this.rootGroup && this.data.enabled) {
            this.rootGroup.visible = true;
            this.rootGroup.updateMatrixWorld(true);
            if (this.portalCssObject) {
              this.portalCssObject.visible = true;
              if (this.portalContainerDiv) this.portalContainerDiv.style.opacity = '1';
            }
          }
        };

        this.onTargetLost = () => {
          this.isTargetLost = true;
          if (this.portalCssObject) {
            this.portalCssObject.visible = false;
            if (this.portalContainerDiv) this.portalContainerDiv.style.opacity = '0';
          }
        };

        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('targetFound', this.onTargetFound);
          sceneEl.addEventListener('targetLost', this.onTargetLost);
        }
        if (this.el.parentEl) {
          this.el.parentEl.addEventListener('targetFound', this.onTargetFound);
          this.el.parentEl.addEventListener('targetLost', this.onTargetLost);
        }
      },

      cleanupPortalVideo: function () {
        if (this.portalCssObject) {
          const sceneEl = this.el.sceneEl;
          if (sceneEl && sceneEl._css3dScene) {
            try { sceneEl._css3dScene.remove(this.portalCssObject); } catch {}
          }
          this.portalCssObject = null;
        }
        if (this.portalYoutubeIframe && this.portalYoutubeIframe.parentElement) {
          try { this.portalYoutubeIframe.parentElement.remove(); } catch {}
          this.portalYoutubeIframe = null;
        }
        if (this.portalContainerDiv) {
          try { this.portalContainerDiv.remove(); } catch {}
          this.portalContainerDiv = null;
        }
        if (this.portalVideo) {
          try {
            this.portalVideo.pause();
            this.portalVideo.removeAttribute('src');
            this.portalVideo.load();
            this.portalVideo.remove();
          } catch {}
          this.portalVideo = null;
        }
        if (this.portalVideoTexture) {
          try { this.portalVideoTexture.dispose(); } catch {}
          this.portalVideoTexture = null;
        }
        this.portalVideoMesh = null;
      },

      setupPortalCSS3DYouTube: function (youtubeId, targetMesh, screenW, screenH) {
        if (!youtubeId || !targetMesh) return;
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) return;
        const THREE_LIB = getPortalThree();

        // 1. Ensure scene-wide CSS3DRenderer overlay exists
        let cssRenderer = sceneEl._css3dRenderer;
        let cssScene = sceneEl._css3dScene;

        if (!cssRenderer) {
          cssRenderer = new CSS3DRenderer();
          const container = sceneEl.canvas?.parentElement || sceneEl;
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || window.innerHeight;
          cssRenderer.setSize(w, h);

          const dom = cssRenderer.domElement;
          dom.id = 'aframe-css3d-canvas-overlay';
          dom.style.position = 'absolute';
          dom.style.top = '0';
          dom.style.left = '0';
          dom.style.width = '100%';
          dom.style.height = '100%';
          dom.style.pointerEvents = 'none';
          dom.style.zIndex = '10';

          container.appendChild(dom);

          cssScene = new THREE_LIB.Scene();
          sceneEl._css3dRenderer = cssRenderer;
          sceneEl._css3dScene = cssScene;

          const handleResize = () => {
            if (sceneEl.canvas && cssRenderer) {
              const rw = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientWidth : window.innerWidth;
              const rh = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientHeight : window.innerHeight;
              cssRenderer.setSize(rw, rh);
            }
          };
          window.addEventListener('resize', handleResize);
          sceneEl._css3dResizeHandler = handleResize;
        }

        const iframeW = 640;
        const iframeH = 360;

        const containerDiv = document.createElement('div');
        containerDiv.style.width = `${iframeW}px`;
        containerDiv.style.height = `${iframeH}px`;
        containerDiv.style.background = '#090d16';
        containerDiv.style.borderRadius = '10px';
        containerDiv.style.overflow = 'hidden';
        containerDiv.style.position = 'relative';
        containerDiv.style.pointerEvents = 'auto';
        containerDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.85)';
        containerDiv.style.border = `2px solid ${this.data.frameColor || '#38bdf8'}`;
        containerDiv.style.backfaceVisibility = 'hidden';
        containerDiv.style.webkitBackfaceVisibility = 'hidden';
        containerDiv.style.transition = 'opacity 0.15s ease-out';

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0px';
        const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
        iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&mute=1&controls=1&loop=1&playlist=${youtubeId}${originParam}`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;

        containerDiv.appendChild(iframe);

        // Floating sound unmute toggle
        const muteBadge = document.createElement('button');
        muteBadge.type = 'button';
        muteBadge.style.cssText = 'position:absolute;top:10px;right:10px;z-index:99;background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:9999px;padding:4px 10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;box-shadow:0 4px 15px rgba(0,0,0,0.7);pointer-events:auto;user-select:none;';
        muteBadge.innerHTML = '<span>🔊</span><span>Tap for Sound</span>';

        let isSoundOn = false;
        muteBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          isSoundOn = !isSoundOn;
          const func = isSoundOn ? 'unMute' : 'mute';
          try {
            iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
            if (isSoundOn) {
              iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
            }
          } catch {}
          muteBadge.innerHTML = isSoundOn ? '<span>🔊</span><span>Sound On</span>' : '<span>🔇</span><span>Sound Off</span>';
          muteBadge.style.background = isSoundOn ? 'rgba(16, 185, 129, 0.9)' : 'rgba(225, 29, 72, 0.9)';
        });
        containerDiv.appendChild(muteBadge);

        const cssObject = new CSS3DObject(containerDiv);
        const baseScale = screenW / iframeW;
        cssObject.scale.set(baseScale, baseScale, baseScale);

        if (targetMesh) {
          try {
            targetMesh.updateMatrixWorld(true);
            targetMesh.getWorldPosition(this._portalPos);
            targetMesh.getWorldQuaternion(this._portalQuat);
            cssObject.position.copy(this._portalPos);
            cssObject.quaternion.copy(this._portalQuat);
          } catch {}
        }

        cssScene.add(cssObject);
        this.portalCssObject = cssObject;
        this.portalYoutubeIframe = iframe;
        this.portalContainerDiv = containerDiv;
        this.portalBaseScale = baseScale;
      },

      update: function (oldData) {
        if (!this.data.enabled) {
          this.rootGroup.visible = false;
          if (this.portalCssObject) {
            this.portalCssObject.visible = false;
            if (this.portalContainerDiv) this.portalContainerDiv.style.opacity = '0';
          }
          return;
        }
        this.rootGroup.visible = true;

        // Apply portal root placement & rotation
        this.rootGroup.position.set(this.data.posX, this.data.posY, this.data.posZ);
        this.rootGroup.rotation.set(
          (this.data.rotX * Math.PI) / 180,
          (this.data.rotY * Math.PI) / 180,
          (this.data.rotZ * Math.PI) / 180
        );

        const needRebuild = !oldData ||
          oldData.shape !== this.data.shape ||
          oldData.width !== this.data.width ||
          oldData.height !== this.data.height ||
          oldData.radius !== this.data.radius ||
          oldData.depth !== this.data.depth ||
          oldData.frameColor !== this.data.frameColor ||
          oldData.frameWidth !== this.data.frameWidth ||
          oldData.frameDepth !== this.data.frameDepth ||
          oldData.frameEmissive !== this.data.frameEmissive ||
          oldData.frameEmissiveIntensity !== this.data.frameEmissiveIntensity ||
          oldData.interiorType !== this.data.interiorType ||
          oldData.skyboxUrl !== this.data.skyboxUrl ||
          oldData.interiorColor !== this.data.interiorColor ||
          oldData.wallColor !== this.data.wallColor ||
          oldData.floorColor !== this.data.floorColor ||
          oldData.gridColor !== this.data.gridColor ||
          oldData.interiorModelType !== this.data.interiorModelType ||
          oldData.artifactType !== this.data.artifactType ||
          oldData.customModelUrl !== this.data.customModelUrl ||
          oldData.currentModelUrl !== this.data.currentModelUrl ||
          oldData.particles !== this.data.particles ||
          oldData.particleCount !== this.data.particleCount ||
          oldData.floatingText !== this.data.floatingText ||
          oldData.showVideo !== this.data.showVideo ||
          oldData.videoUrl !== this.data.videoUrl ||
          oldData.videoScale !== this.data.videoScale ||
          oldData.videoPosY !== this.data.videoPosY ||
          oldData.videoPosZ !== this.data.videoPosZ;

        if (needRebuild) {
          this.buildPortal();
        } else {
          // Quick updates for transforms / materials without full geometry rebuild
          if (this.activeArtifact) {
            this.activeArtifact.scale.setScalar(this.data.modelScale);
            this.activeArtifact.position.set(this.data.modelPosX, this.data.modelPosY, this.data.modelPosZ);
          }
          if (this.loadedCustomModel) {
            this.loadedCustomModel.scale.setScalar(this.data.modelScale);
            this.loadedCustomModel.position.set(this.data.modelPosX, this.data.modelPosY, this.data.modelPosZ);
          }
          if (this.skyboxMesh) {
            const s = Math.max(0.05, this.data.skyboxScale || 1.0);
            this.skyboxMesh.scale.set(s, s, s);
            const depth = Math.max(1.0, this.data.depth);
            this.skyboxMesh.position.set(
              this.data.skyboxPosX || 0,
              this.data.skyboxPosY || 0,
              (-depth / 2) + (this.data.skyboxPosZ || 0)
            );
            this.skyboxMesh.rotation.set(
              (this.data.skyboxRotX * Math.PI) / 180,
              (this.data.skyboxRotY * Math.PI) / 180,
              (this.data.skyboxRotZ * Math.PI) / 180
            );
            if (this.skyboxMesh.material && this.skyboxMesh.material.userData && this.skyboxMesh.material.userData.uSkyboxBlur) {
              this.skyboxMesh.material.userData.uSkyboxBlur.value = Math.max(0, Number(this.data.skyboxBlur) || 0);
            }
          }
        }
      },

      applyStencilToMesh: function (mesh, stencilFunc) {
        if (!mesh) return;
        const THREE_LIB = getPortalThree();
        const func = stencilFunc !== undefined ? stencilFunc : THREE_LIB.EqualStencilFunc;
        mesh.renderOrder = 3;
        mesh.traverse((node) => {
          if ((node.isMesh || node.isPoints || node.isLine) && node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m) => {
              m.stencilWrite = true;
              m.stencilRef = 1;
              m.stencilFunc = func;
              m.stencilZPass = THREE_LIB.KeepStencilOp;
              m.stencilFail = THREE_LIB.KeepStencilOp;
              m.stencilZFail = THREE_LIB.KeepStencilOp;
            });
          }
        });
      },

      setStencilPassMode: function (isInside) {
        const THREE_LIB = getPortalThree();
        const func = isInside ? THREE_LIB.AlwaysStencilFunc : THREE_LIB.EqualStencilFunc;
        this.interiorGroup.traverse((node) => {
          if ((node.isMesh || node.isPoints || node.isLine) && node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m) => {
              m.stencilFunc = func;
              m.needsUpdate = true;
            });
          }
        });
      },

      clearGroup: function (group) {
        while (group.children.length > 0) {
          const child = group.children[0];
          group.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        }
      },

      buildPortal: function () {
        const THREE_LIB = getPortalThree();
        this.clearGroup(this.portalFrameGroup);
        this.clearGroup(this.interiorGroup);
        this.cyberCoreRings = [];
        this.activeArtifact = null;
        this.loadedCustomModel = null;
        this.skyboxMesh = null;

        const data = this.data;
        const width = Math.max(0.2, data.width);
        const height = Math.max(0.2, data.height);
        const radius = Math.max(0.15, data.radius);
        const frameW = Math.max(0.02, data.frameWidth);
        const frameD = Math.max(0.02, data.frameDepth);

        // ---------------------------------------------------------------------
        // 1. APERTURE & 3D FRAME GEOMETRIES ACCORDING TO SHAPE
        // ---------------------------------------------------------------------
        let apertureGeom = null;
        let frameGeom = null;

        if (data.shape === 'arch') {
          const r = width / 2;
          const straightH = Math.max(0.1, height - r);
          const yBottom = -height / 2;
          const yArchCenter = yBottom + straightH;

          // Aperture Shape
          const archShape = new THREE_LIB.Shape();
          archShape.moveTo(-r, yBottom);
          archShape.lineTo(r, yBottom);
          archShape.lineTo(r, yArchCenter);
          archShape.absarc(0, yArchCenter, r, 0, Math.PI, false);
          archShape.lineTo(-r, yBottom);
          apertureGeom = new THREE_LIB.ShapeGeometry(archShape, 32);

          // Outer Arch Frame with Inner Cutout
          const outerR = r + frameW;
          const outerShape = new THREE_LIB.Shape();
          outerShape.moveTo(-outerR, yBottom - frameW);
          outerShape.lineTo(outerR, yBottom - frameW);
          outerShape.lineTo(outerR, yArchCenter);
          outerShape.absarc(0, yArchCenter, outerR, 0, Math.PI, false);
          outerShape.lineTo(-outerR, yBottom - frameW);

          const innerHole = new THREE_LIB.Path();
          innerHole.moveTo(-r, yBottom);
          innerHole.lineTo(r, yBottom);
          innerHole.lineTo(r, yArchCenter);
          innerHole.absarc(0, yArchCenter, r, 0, Math.PI, false);
          innerHole.lineTo(-r, yBottom);
          outerShape.holes.push(innerHole);

          frameGeom = new THREE_LIB.ExtrudeGeometry(outerShape, {
            depth: frameD,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.012,
            curveSegments: 32
          });
          frameGeom.translate(0, 0, -frameD / 2);

        } else if (data.shape === 'rectangle') {
          apertureGeom = new THREE_LIB.PlaneGeometry(width, height);

          const hw = width / 2 + frameW;
          const hh = height / 2 + frameW;
          const outerRect = new THREE_LIB.Shape();
          outerRect.moveTo(-hw, -hh);
          outerRect.lineTo(hw, -hh);
          outerRect.lineTo(hw, hh);
          outerRect.lineTo(-hw, hh);
          outerRect.closePath();

          const innerRect = new THREE_LIB.Path();
          const ihw = width / 2;
          const ihh = height / 2;
          innerRect.moveTo(-ihw, -ihh);
          innerRect.lineTo(ihw, -ihh);
          innerRect.lineTo(ihw, ihh);
          innerRect.lineTo(-ihw, ihh);
          innerRect.closePath();
          outerRect.holes.push(innerRect);

          frameGeom = new THREE_LIB.ExtrudeGeometry(outerRect, {
            depth: frameD,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.012
          });
          frameGeom.translate(0, 0, -frameD / 2);

        } else if (data.shape === 'circle') {
          apertureGeom = new THREE_LIB.CircleGeometry(radius, 48);
          frameGeom = new THREE_LIB.TorusGeometry(radius, frameW / 2, 16, 48);

        } else if (data.shape === 'hexagon') {
          const r = radius;
          apertureGeom = new THREE_LIB.CircleGeometry(r, 6);

          const outerHex = new THREE_LIB.Shape();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = (r + frameW) * Math.cos(angle);
            const y = (r + frameW) * Math.sin(angle);
            if (i === 0) outerHex.moveTo(x, y);
            else outerHex.lineTo(x, y);
          }
          outerHex.closePath();

          const innerHex = new THREE_LIB.Path();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) innerHex.moveTo(x, y);
            else innerHex.lineTo(x, y);
          }
          innerHex.closePath();
          outerHex.holes.push(innerHex);

          frameGeom = new THREE_LIB.ExtrudeGeometry(outerHex, {
            depth: frameD,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.012
          });
          frameGeom.translate(0, 0, -frameD / 2);
        }

        // ---------------------------------------------------------------------
        // 2. APERTURE MASK MESH (WRITES TO STENCIL BUFFER AT RENDERORDER 1)
        // ---------------------------------------------------------------------
        if (apertureGeom) {
          const maskMat = new THREE_LIB.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE_LIB.AlwaysStencilFunc,
            stencilZPass: THREE_LIB.ReplaceStencilOp,
            side: THREE_LIB.DoubleSide
          });
          const maskMesh = new THREE_LIB.Mesh(apertureGeom, maskMat);
          maskMesh.renderOrder = 1;
          this.portalFrameGroup.add(maskMesh);

          // Subtle glass pane tint layer
          if (data.glassOpacity > 0.001) {
            const glassMat = new THREE_LIB.MeshBasicMaterial({
              color: new THREE_LIB.Color(data.glassTint),
              transparent: true,
              opacity: data.glassOpacity,
              side: THREE_LIB.DoubleSide,
              blending: THREE_LIB.AdditiveBlending,
              depthWrite: false
            });
            const glassMesh = new THREE_LIB.Mesh(apertureGeom.clone(), glassMat);
            glassMesh.renderOrder = 12;
            this.portalFrameGroup.add(glassMesh);
          }
        }

        // ---------------------------------------------------------------------
        // 3. 3D PORTAL FRAME WITH METALLIC PBR & EMISSIVE GLOW (RENDERORDER 15)
        // ---------------------------------------------------------------------
        if (frameGeom) {
          const frameMat = new THREE_LIB.MeshStandardMaterial({
            color: new THREE_LIB.Color(data.frameColor),
            metalness: 0.85,
            roughness: 0.22,
            emissive: new THREE_LIB.Color(data.frameEmissive),
            emissiveIntensity: data.frameEmissiveIntensity,
            side: THREE_LIB.DoubleSide
          });
          const frameMesh = new THREE_LIB.Mesh(frameGeom, frameMat);
          frameMesh.renderOrder = 15;
          this.portalFrameGroup.add(frameMesh);

          // Outer glowing rim highlight
          if (data.frameGlow) {
            const glowMat = new THREE_LIB.MeshBasicMaterial({
              color: new THREE_LIB.Color(data.frameEmissive),
              transparent: true,
              opacity: 0.25,
              blending: THREE_LIB.AdditiveBlending,
              wireframe: true,
              depthWrite: false,
              side: THREE_LIB.DoubleSide
            });
            const glowMesh = new THREE_LIB.Mesh(frameGeom.clone(), glowMat);
            glowMesh.scale.multiplyScalar(1.02);
            glowMesh.renderOrder = 16;
            this.portalFrameGroup.add(glowMesh);
          }
        }

        // ---------------------------------------------------------------------
        // 4. INTERIOR ENVIRONMENT & CHAMBER (RENDERORDER 3, STENCIL = 1)
        // ---------------------------------------------------------------------
        const depth = Math.max(1.0, data.depth);
        const chamberWidth = Math.max(width * 2.2, 3.0);
        const chamberHeight = Math.max(height * 2.2, 3.0);

        if (data.interiorType === 'nebula' || data.interiorType === 'starfield') {
          const sphereGeom = new THREE_LIB.SphereGeometry(14, 32, 32);
          let envTexture = null;
          if (data.skyboxUrl) {
            const loader = new THREE_LIB.TextureLoader();
            envTexture = loader.load(data.skyboxUrl);
            envTexture.colorSpace = THREE_LIB.SRGBColorSpace;
          } else {
            envTexture = generateProceduralNebulaTexture();
          }

          const sphereMat = new THREE_LIB.MeshBasicMaterial({
            map: envTexture,
            color: new THREE_LIB.Color(data.interiorColor),
            side: THREE_LIB.DoubleSide
          });
          const sphereMesh = new THREE_LIB.Mesh(sphereGeom, sphereMat);
          sphereMesh.position.set(0, 0, -depth / 2);
          this.applyStencilToMesh(sphereMesh);
          this.interiorGroup.add(sphereMesh);

        } else if (data.interiorType === 'grid-room' || data.interiorType === 'matrix') {
          const boxGeom = new THREE_LIB.BoxGeometry(chamberWidth, chamberHeight, depth);
          const gridColor = data.interiorType === 'matrix' ? '#10b981' : data.gridColor;
          const wallColor = data.interiorType === 'matrix' ? '#021810' : data.wallColor;
          const gridTexture = generateProceduralGridTexture(gridColor, data.floorColor);

          // Multi-material box with cyber grid on floor
          const wallMat = new THREE_LIB.MeshStandardMaterial({
            color: new THREE_LIB.Color(wallColor),
            roughness: 0.8,
            metalness: 0.2,
            side: THREE_LIB.DoubleSide
          });
          const floorMat = new THREE_LIB.MeshStandardMaterial({
            color: new THREE_LIB.Color(data.floorColor),
            map: gridTexture,
            roughness: 0.3,
            metalness: 0.6,
            emissive: new THREE_LIB.Color(gridColor),
            emissiveIntensity: 0.35,
            side: THREE_LIB.DoubleSide
          });

          // Box faces: [Right, Left, Top, Bottom, Front, Back]
          const roomMaterials = [wallMat, wallMat, wallMat, floorMat, wallMat, wallMat];
          const roomMesh = new THREE_LIB.Mesh(boxGeom, roomMaterials);
          roomMesh.position.set(0, 0, -depth / 2);
          this.applyStencilToMesh(roomMesh);
          this.interiorGroup.add(roomMesh);

          // Add glowing horizontal accent lines on chamber walls
          const lineGeom = new THREE_LIB.BufferGeometry();
          const lineY = [-height * 0.3, 0, height * 0.3];
          const linePoints = [];
          lineY.forEach((y) => {
            linePoints.push(-chamberWidth / 2 + 0.05, y, 0);
            linePoints.push(-chamberWidth / 2 + 0.05, y, -depth);
            linePoints.push(chamberWidth / 2 - 0.05, y, 0);
            linePoints.push(chamberWidth / 2 - 0.05, y, -depth);
          });
          lineGeom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(linePoints, 3));
          const lineMat = new THREE_LIB.LineBasicMaterial({
            color: new THREE_LIB.Color(gridColor),
            linewidth: 2,
            transparent: true,
            opacity: 0.8
          });
          const lines = new THREE_LIB.LineSegments(lineGeom, lineMat);
          this.applyStencilToMesh(lines);
          this.interiorGroup.add(lines);

        } else if (data.interiorType === 'skybox') {
          const sphereGeom = new THREE_LIB.SphereGeometry(15, 32, 32);
          let skyTex = null;
          if (data.skyboxUrl) {
            const loader = new THREE_LIB.TextureLoader();
            skyTex = loader.load(data.skyboxUrl);
            skyTex.colorSpace = THREE_LIB.SRGBColorSpace;
          } else {
            skyTex = generateProceduralNebulaTexture();
          }
          const sphereMat = new THREE_LIB.MeshBasicMaterial({
            map: skyTex,
            side: THREE_LIB.DoubleSide
          });
          if (skyTex) {
            skyTex.minFilter = THREE_LIB.LinearMipmapLinearFilter;
            skyTex.generateMipmaps = true;
          }

          // Gaussian blur shader integration
          const blurUniform = { value: Math.max(0, Number(data.skyboxBlur) || 0) };
          sphereMat.userData.uSkyboxBlur = blurUniform;
          sphereMat.customProgramCacheKey = () => 'ar-portal-skybox-blur';
          sphereMat.onBeforeCompile = (shader) => {
            shader.uniforms.uSkyboxBlur = blurUniform;
            shader.fragmentShader = `
              uniform float uSkyboxBlur;
              vec2 sampleEquirectBlur(vec2 uv, vec2 offset) {
                return vec2(fract(uv.x + offset.x), clamp(uv.y + offset.y, 0.001, 0.999));
              }
            ` + shader.fragmentShader;

            const blurCode = `
              vec4 sampledDiffuseColor;
              if (uSkyboxBlur <= 0.001) {
                sampledDiffuseColor = texture2D( map, vMapUv );
              } else {
                float blurFactor = uSkyboxBlur;
                float lod = min(4.5, blurFactor * 0.22);
                vec2 bStep = vec2(blurFactor * 0.0006, blurFactor * 0.0012);

                sampledDiffuseColor = texture2D( map, vMapUv, lod ) * 0.1636;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(bStep.x, 0.0)), lod ) * 0.1091;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(-bStep.x, 0.0)), lod ) * 0.1091;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(0.0, bStep.y)), lod ) * 0.1091;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(0.0, -bStep.y)), lod ) * 0.1091;

                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(bStep.x * 0.707, bStep.y * 0.707)), lod ) * 0.0636;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(-bStep.x * 0.707, bStep.y * 0.707)), lod ) * 0.0636;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(bStep.x * 0.707, -bStep.y * 0.707)), lod ) * 0.0636;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(-bStep.x * 0.707, -bStep.y * 0.707)), lod ) * 0.0636;

                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(bStep.x * 1.6, 0.0)), lod ) * 0.0364;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(-bStep.x * 1.6, 0.0)), lod ) * 0.0364;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(0.0, bStep.y * 1.6)), lod ) * 0.0364;
                sampledDiffuseColor += texture2D( map, sampleEquirectBlur(vMapUv, vec2(0.0, -bStep.y * 1.6)), lod ) * 0.0364;
              }
            `;

            if (shader.fragmentShader.includes('vec4 sampledDiffuseColor = texture2D( map, vMapUv );')) {
              shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
                blurCode
              );
            } else if (shader.fragmentShader.includes('vec4 sampledDiffuseColor = texture2D(map, vMapUv);')) {
              shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 sampledDiffuseColor = texture2D(map, vMapUv);',
                blurCode
              );
            } else {
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#ifdef USE_MAP
                  ${blurCode}
                  #ifdef DECODE_VIDEO_TEXTURE
                    sampledDiffuseColor = colorToOutput( sampledDiffuseColor );
                  #endif
                  diffuseColor *= sampledDiffuseColor;
                #endif`
              );
            }
          };
          const skyMesh = new THREE_LIB.Mesh(sphereGeom, sphereMat);
          const s = Math.max(0.05, data.skyboxScale || 1.0);
          skyMesh.scale.set(s, s, s);
          skyMesh.position.set(
            data.skyboxPosX || 0,
            data.skyboxPosY || 0,
            (-depth / 2) + (data.skyboxPosZ || 0)
          );
          skyMesh.rotation.set(
            (data.skyboxRotX * Math.PI) / 180,
            (data.skyboxRotY * Math.PI) / 180,
            (data.skyboxRotZ * Math.PI) / 180
          );
          this.applyStencilToMesh(skyMesh);
          this.interiorGroup.add(skyMesh);
          this.skyboxMesh = skyMesh;

        } else {
          // Minimalist Smooth Void
          const sphereGeom = new THREE_LIB.SphereGeometry(12, 32, 32);
          const sphereMat = new THREE_LIB.MeshStandardMaterial({
            color: new THREE_LIB.Color(data.interiorColor),
            roughness: 0.9,
            metalness: 0.1,
            side: THREE_LIB.DoubleSide
          });
          const voidMesh = new THREE_LIB.Mesh(sphereGeom, sphereMat);
          voidMesh.position.set(0, 0, -depth / 2);
          this.applyStencilToMesh(voidMesh);
          this.interiorGroup.add(voidMesh);
        }

        // Interior Lighting
        const pointLight = new THREE_LIB.PointLight(
          new THREE_LIB.Color(data.interiorLightColor),
          data.interiorLightIntensity,
          depth * 2
        );
        pointLight.position.set(0, 0.4, -depth * 0.4);
        this.interiorGroup.add(pointLight);

        // ---------------------------------------------------------------------
        // 5. INTERIOR 3D CONTENT & OBJECTS (RENDERORDER 3, STENCIL = 1)
        // ---------------------------------------------------------------------
        if (data.interiorModelType === 'artifact') {
          const artifactGroup = new THREE_LIB.Group();
          artifactGroup.position.set(data.modelPosX, data.modelPosY, data.modelPosZ);
          artifactGroup.scale.setScalar(data.modelScale);
          artifactGroup.rotation.set(
            (data.modelRotX * Math.PI) / 180,
            (data.modelRotY * Math.PI) / 180,
            (data.modelRotZ * Math.PI) / 180
          );

          if (data.artifactType === 'crystal') {
            const crystalGeom = new THREE_LIB.IcosahedronGeometry(0.42, 0);
            const crystalMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color(data.frameColor),
              metalness: 0.9,
              roughness: 0.12,
              emissive: new THREE_LIB.Color(data.frameEmissive),
              emissiveIntensity: 0.6,
              flatShading: true
            });
            const crystalMesh = new THREE_LIB.Mesh(crystalGeom, crystalMat);
            artifactGroup.add(crystalMesh);
            this.activeArtifact = artifactGroup;

          } else if (data.artifactType === 'cyber-core') {
            const coreGeom = new THREE_LIB.SphereGeometry(0.2, 24, 24);
            const coreMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color(data.gridColor || data.frameColor),
              emissive: new THREE_LIB.Color(data.gridColor || data.frameColor),
              emissiveIntensity: 2.0,
              roughness: 0.2
            });
            const coreMesh = new THREE_LIB.Mesh(coreGeom, coreMat);
            artifactGroup.add(coreMesh);

            const ring1Geom = new THREE_LIB.TorusGeometry(0.36, 0.018, 12, 36);
            const ring2Geom = new THREE_LIB.TorusGeometry(0.46, 0.018, 12, 36);
            const ringMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color(data.frameColor),
              metalness: 0.9,
              roughness: 0.2,
              wireframe: true
            });
            const ring1 = new THREE_LIB.Mesh(ring1Geom, ringMat);
            const ring2 = new THREE_LIB.Mesh(ring2Geom, ringMat);
            artifactGroup.add(ring1);
            artifactGroup.add(ring2);
            this.cyberCoreRings = [ring1, ring2];
            this.activeArtifact = artifactGroup;

          } else if (data.artifactType === 'star-emblem') {
            const starShape = new THREE_LIB.Shape();
            const points = 5;
            const outerR = 0.42;
            const innerR = 0.2;
            for (let i = 0; i < points * 2; i++) {
              const r = i % 2 === 0 ? outerR : innerR;
              const a = (i * Math.PI) / points - Math.PI / 2;
              const x = r * Math.cos(a);
              const y = r * Math.sin(a);
              if (i === 0) starShape.moveTo(x, y);
              else starShape.lineTo(x, y);
            }
            starShape.closePath();
            const starGeom = new THREE_LIB.ExtrudeGeometry(starShape, {
              depth: 0.08,
              bevelEnabled: true,
              bevelThickness: 0.02,
              bevelSize: 0.02
            });
            starGeom.center();
            const starMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color(data.frameColor),
              metalness: 0.92,
              roughness: 0.18,
              emissive: new THREE_LIB.Color(data.frameEmissive),
              emissiveIntensity: 0.7
            });
            const starMesh = new THREE_LIB.Mesh(starGeom, starMat);
            artifactGroup.add(starMesh);
            this.activeArtifact = artifactGroup;

          } else if (data.artifactType === 'pedestal') {
            // Hexagonal podium dais
            const daisGeom = new THREE_LIB.CylinderGeometry(0.5, 0.6, 0.35, 6);
            const daisMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color('#1e293b'),
              metalness: 0.7,
              roughness: 0.3,
              emissive: new THREE_LIB.Color(data.frameColor),
              emissiveIntensity: 0.3
            });
            const dais = new THREE_LIB.Mesh(daisGeom, daisMat);
            dais.position.y = -0.3;
            artifactGroup.add(dais);

            // Floating octahedron relic above pedestal
            const relicGeom = new THREE_LIB.OctahedronGeometry(0.24, 0);
            const relicMat = new THREE_LIB.MeshStandardMaterial({
              color: new THREE_LIB.Color(data.frameColor),
              metalness: 0.9,
              roughness: 0.1,
              emissive: new THREE_LIB.Color(data.frameEmissive),
              emissiveIntensity: 0.8
            });
            const relic = new THREE_LIB.Mesh(relicGeom, relicMat);
            relic.position.y = 0.2;
            artifactGroup.add(relic);
            this.activeArtifact = artifactGroup;
          }

          this.applyStencilToMesh(artifactGroup);
          this.interiorGroup.add(artifactGroup);

        } else if ((data.interiorModelType === 'custom-glb' && data.customModelUrl) ||
                   (data.interiorModelType === 'current-product' && data.currentModelUrl)) {
          const modelUrl = data.interiorModelType === 'current-product' ? data.currentModelUrl : data.customModelUrl;
          this.gltfLoader.load(
            modelUrl,
            (gltf) => {
              const model = gltf.scene;
              model.position.set(data.modelPosX, data.modelPosY, data.modelPosZ);
              model.scale.setScalar(data.modelScale);
              model.rotation.set(
                (data.modelRotX * Math.PI) / 180,
                (data.modelRotY * Math.PI) / 180,
                (data.modelRotZ * Math.PI) / 180
              );
              this.applyStencilToMesh(model);
              this.interiorGroup.add(model);
              this.loadedCustomModel = model;
            },
            undefined,
            (err) => {
              console.warn('Could not load portal GLB model:', err);
            }
          );
        }

        // ---------------------------------------------------------------------
        // 6. INTERIOR PARTICLES SYSTEM (RENDERORDER 3, STENCIL = 1)
        // ---------------------------------------------------------------------
        if (data.particles !== 'none' && data.particleCount > 0) {
          const count = Math.max(10, Math.min(400, data.particleCount));
          const pGeom = new THREE_LIB.BufferGeometry();
          const posArray = new Float32Array(count * 3);
          this.particleVelocities = [];

          for (let i = 0; i < count; i++) {
            posArray[i * 3 + 0] = (Math.random() - 0.5) * (chamberWidth * 0.9);
            posArray[i * 3 + 1] = (Math.random() - 0.5) * (chamberHeight * 0.9);
            posArray[i * 3 + 2] = -Math.random() * depth;
            this.particleVelocities.push({
              vx: (Math.random() - 0.5) * 0.005 * data.particleSpeed,
              vy: (Math.random() - 0.5) * 0.005 * data.particleSpeed,
              vz: (Math.random() * 0.008 + 0.002) * data.particleSpeed
            });
          }
          pGeom.setAttribute('position', new THREE_LIB.BufferAttribute(posArray, 3));
          const spriteTex = generateParticleSprite('sparkle', THREE_LIB);
          const pMat = new THREE_LIB.PointsMaterial({
            color: new THREE_LIB.Color(data.particleColor),
            map: spriteTex,
            size: data.particles === 'cyber' ? 0.045 : 0.035,
            transparent: true,
            opacity: 0.85,
            blending: THREE_LIB.AdditiveBlending,
            depthWrite: false
          });
          this.particlesObj = new THREE_LIB.Points(pGeom, pMat);
          this.particlesObj.frustumCulled = false;
          this.applyStencilToMesh(this.particlesObj);
          this.interiorGroup.add(this.particlesObj);
        }

        // ---------------------------------------------------------------------
        // 7. FLOATING 3D HOLOGRAPHIC BANNER (RENDERORDER 3, STENCIL = 1)
        // ---------------------------------------------------------------------
        if (data.floatingText && data.floatingText.trim().length > 0) {
          const textTex = generateHolographicTextTexture(data.floatingText.trim(), data.textColor);
          if (textTex) {
            const textGeom = new THREE_LIB.PlaneGeometry(1.2 * data.textScale, 0.3 * data.textScale);
            const textMat = new THREE_LIB.MeshBasicMaterial({
              map: textTex,
              transparent: true,
              side: THREE_LIB.DoubleSide,
              depthWrite: false
            });
            const textMesh = new THREE_LIB.Mesh(textGeom, textMat);
            textMesh.position.set(0, data.textPosY, data.textPosZ);
            this.applyStencilToMesh(textMesh);
            this.interiorGroup.add(textMesh);
          }
        }

        // ---------------------------------------------------------------------
        // 8. INTERIOR VIDEO SCREEN (RENDERORDER 3, STENCIL = 1)
        // ---------------------------------------------------------------------
        this.cleanupPortalVideo();

        if (data.showVideo && data.videoUrl && data.videoUrl.trim() !== '') {
          const cleanUrl = data.videoUrl.trim();
          const screenScale = Math.max(0.1, data.videoScale || 1.0);
          const screenW = 1.6 * screenScale;
          const screenH = 0.9 * screenScale;

          // 1. Sleek dark metallic bezel mesh with stencil clipping
          const bezelGeom = new THREE_LIB.BoxGeometry(screenW + 0.06, screenH + 0.06, 0.02);
          const bezelMat = new THREE_LIB.MeshStandardMaterial({
            color: new THREE_LIB.Color('#0a0e1a'),
            metalness: 0.85,
            roughness: 0.25,
            emissive: new THREE_LIB.Color(data.frameColor || '#38bdf8'),
            emissiveIntensity: 0.15
          });
          const bezelMesh = new THREE_LIB.Mesh(bezelGeom, bezelMat);
          bezelMesh.position.set(0, data.videoPosY, data.videoPosZ - 0.01);
          this.applyStencilToMesh(bezelMesh);
          this.interiorGroup.add(bezelMesh);

          // 2. Interior video screen mesh
          const vidGeom = new THREE_LIB.PlaneGeometry(screenW, screenH);

          if (isYouTubeUrl(cleanUrl)) {
            const ytId = extractYouTubeId(cleanUrl);
            const vidMat = new THREE_LIB.MeshBasicMaterial({
              color: new THREE_LIB.Color(0xffffff),
              side: THREE_LIB.DoubleSide
            });

            if (ytId) {
              const texLoader = new THREE_LIB.TextureLoader();
              texLoader.load(
                `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
                (tex) => {
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    tex.colorSpace = THREE_LIB.SRGBColorSpace;
                  }
                  vidMat.map = tex;
                  vidMat.needsUpdate = true;
                },
                undefined,
                () => {
                  texLoader.load(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, (fallbackTex) => {
                    if (THREE_LIB.SRGBColorSpace !== undefined) {
                      fallbackTex.colorSpace = THREE_LIB.SRGBColorSpace;
                    }
                    vidMat.map = fallbackTex;
                    vidMat.needsUpdate = true;
                  });
                }
              );
            }

            const vidMesh = new THREE_LIB.Mesh(vidGeom, vidMat);
            vidMesh.position.set(0, data.videoPosY, data.videoPosZ);
            this.applyStencilToMesh(vidMesh);
            this.interiorGroup.add(vidMesh);
            this.portalVideoMesh = vidMesh;

            if (ytId) {
              this.setupPortalCSS3DYouTube(ytId, vidMesh, screenW, screenH);
            }
          } else {
            // Direct video file (mp4, webm, mov, Firebase Storage URL)
            const videoEl = createOrActivateVideoElement(cleanUrl);
            if (videoEl) {
              this.portalVideo = videoEl;
              const vTex = new THREE_LIB.VideoTexture(videoEl);
              if (THREE_LIB.SRGBColorSpace !== undefined) {
                vTex.colorSpace = THREE_LIB.SRGBColorSpace;
              }
              vTex.minFilter = THREE_LIB.LinearFilter;
              vTex.magFilter = THREE_LIB.LinearFilter;
              vTex.generateMipmaps = false;
              this.portalVideoTexture = vTex;

              const vidMat = new THREE_LIB.MeshBasicMaterial({
                map: vTex,
                side: THREE_LIB.DoubleSide
              });
              const vidMesh = new THREE_LIB.Mesh(vidGeom, vidMat);
              vidMesh.position.set(0, data.videoPosY, data.videoPosZ);
              this.applyStencilToMesh(vidMesh);
              this.interiorGroup.add(vidMesh);
              this.portalVideoMesh = vidMesh;
            } else {
              const fallbackMat = new THREE_LIB.MeshStandardMaterial({
                color: new THREE_LIB.Color('#1e293b'),
                metalness: 0.3,
                roughness: 0.5,
                side: THREE_LIB.DoubleSide
              });
              const vidMesh = new THREE_LIB.Mesh(vidGeom, fallbackMat);
              vidMesh.position.set(0, data.videoPosY, data.videoPosZ);
              this.applyStencilToMesh(vidMesh);
              this.interiorGroup.add(vidMesh);
              this.portalVideoMesh = vidMesh;
            }
          }
        }
      },

      tick: function (time, timeDelta) {
        if (!this.data.enabled) return;
        const dt = (timeDelta || 16) / 1000;

        // 1. Rotate active 3D Artifact
        if (this.activeArtifact && this.data.modelRotSpeed > 0) {
          const radPerSec = (Math.PI * 2) / (this.data.modelRotSpeed / 1000);
          this.activeArtifact.rotation.y += radPerSec * dt;
          // Gentle vertical floating bobbing
          const bobOffset = Math.sin(time / 800) * 0.04;
          this.activeArtifact.position.y = this.data.modelPosY + bobOffset;
        }

        // 2. Spin nested gyroscopic Cyber Core rings on alternating axes
        if (this.cyberCoreRings.length >= 2) {
          this.cyberCoreRings[0].rotation.x += dt * 1.8;
          this.cyberCoreRings[1].rotation.y += dt * 2.2;
        }

        // 3. Rotate loaded custom model if present
        if (this.loadedCustomModel && this.data.modelRotSpeed > 0) {
          const radPerSec = (Math.PI * 2) / (this.data.modelRotSpeed / 1000);
          this.loadedCustomModel.rotation.y += radPerSec * dt;
        }

        // 4. Drift and wrap interior particles
        if (this.particlesObj && this.particlesObj.geometry) {
          const posAttr = this.particlesObj.geometry.attributes.position;
          const posArr = posAttr.array;
          const depth = Math.max(1.0, this.data.depth);
          for (let i = 0; i < this.particleVelocities.length; i++) {
            const v = this.particleVelocities[i];
            posArr[i * 3 + 0] += v.vx;
            posArr[i * 3 + 1] += v.vy;
            posArr[i * 3 + 2] += v.vz;

            // Wrap particles when they reach front aperture or go too far
            if (posArr[i * 3 + 2] > -0.05) {
              posArr[i * 3 + 2] = -depth + 0.1;
            } else if (posArr[i * 3 + 2] < -depth) {
              posArr[i * 3 + 2] = -0.1;
            }
          }
          posAttr.needsUpdate = true;
        }

        // 5. Camera Walk-Through & Step-Through Detection
        const scene = this.el.sceneEl;
        const cam = scene ? scene.camera : null;
        if (cam && this.rootGroup && this.interiorGroup && this.el.object3D && this.el.object3D.visible !== false) {
          try {
            this.rootGroup.updateMatrixWorld(true);
            cam.getWorldPosition(this.tempCamWorld);
            this.rootGroup.worldToLocal(this.tempCamLocal.copy(this.tempCamWorld));

            if (!Number.isNaN(this.tempCamLocal.z)) {
              // When camera enters chamber behind portal plane (local z < -0.05 and within chamber volume):
              const isInside = this.tempCamLocal.z < -0.05 &&
                this.tempCamLocal.z > -this.data.depth - 1.5 &&
                Math.abs(this.tempCamLocal.x) < (this.data.width * 1.5 + 1.2) &&
                Math.abs(this.tempCamLocal.y) < (this.data.height * 1.5 + 1.2);

              if (isInside !== this.isCameraInside) {
                this.isCameraInside = isInside;
                this.setStencilPassMode(isInside);
              }
            }
          } catch {}
        }

        // 6. Update Interior Video Stream & CSS3D YouTube Overlay Synchronization
        if (this.portalVideo && this.portalVideoTexture) {
          if (this.portalVideo.paused && this.portalVideo.readyState >= 2) {
            this.portalVideo.play().catch(() => {});
          }
          if (!this.portalVideo.paused) {
            this.portalVideoTexture.needsUpdate = true;
          }
        }

        if (this.portalCssObject && this.portalVideoMesh) {
          const sceneEl = this.el.sceneEl;
          const cam = sceneEl ? sceneEl.camera : null;

          this.portalVideoMesh.getWorldPosition(this._portalPos);
          this.portalVideoMesh.getWorldQuaternion(this._portalQuat);
          this.portalVideoMesh.getWorldScale(this._portalScale);

          this.portalCssObject.position.copy(this._portalPos);
          this.portalCssObject.quaternion.copy(this._portalQuat);
          const s = this.portalBaseScale * (this._portalScale.x || 1.0);
          this.portalCssObject.scale.set(s, s, s);

          // Culling check based on marker tracking, real-world card occlusion, & facing angle
          if (cam && this.portalContainerDiv) {
            if (this.isTargetLost || !this.data.enabled || (this.el.object3D && this.el.object3D.visible === false)) {
              this.portalContainerDiv.style.opacity = '0';
              this.portalContainerDiv.style.pointerEvents = 'none';
            } else {
              const isBehindPortalBack = !this.isCameraInside && this.tempCamLocal.z < -0.05;
              this._portalForward.set(0, 0, 1).applyQuaternion(this._portalQuat).normalize();
              this._portalCamToScreen.copy(this._portalPos).sub(cam.position).normalize();
              const facingDot = this._portalForward.dot(this._portalCamToScreen);

              if (isBehindPortalBack || facingDot >= -0.02) {
                this.portalContainerDiv.style.opacity = '0';
                this.portalContainerDiv.style.pointerEvents = 'none';
              } else {
                this.portalContainerDiv.style.opacity = '1';
                this.portalContainerDiv.style.pointerEvents = 'auto';
              }
            }
          }

          if (sceneEl && sceneEl._css3dRenderer && sceneEl._css3dScene && cam) {
            cam.updateWorldMatrix(true, false);
            if (cam.matrixWorldInverse) {
              cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
            }
            sceneEl._css3dRenderer.render(sceneEl._css3dScene, cam);
          }
        }
      },

      remove: function () {
        this.cleanupPortalVideo();
        if (this.onTargetFound) {
          const sceneEl = this.el.sceneEl;
          if (sceneEl) {
            sceneEl.removeEventListener('targetFound', this.onTargetFound);
            sceneEl.removeEventListener('targetLost', this.onTargetLost);
          }
          if (this.el.parentEl) {
            this.el.parentEl.removeEventListener('targetFound', this.onTargetFound);
            this.el.parentEl.removeEventListener('targetLost', this.onTargetLost);
          }
        }
        if (this.rootGroup) {
          this.clearGroup(this.portalFrameGroup);
          this.clearGroup(this.interiorGroup);
          this.el.removeObject3D('portalRoot');
        }
      }
    });
  }

  // =========================================================================
  // 8. AR-PARTICLE-SYSTEM COMPONENT (STANDALONE SCENE PARTICLE FX)
  // Renders rich procedural particle FX (stardust, embers, snow, rain,
  // fireflies, vortex, hearts) in 3D AR space with dual-color gradients,
  // procedural sprite texturing, physics velocities, and boundary wrapping.
  // =========================================================================
  function generateParticleSprite(shape = 'sparkle') {
    if (typeof document === 'undefined') return null;
    const THREE_LIB = getPortalThree();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 64, 64);

    if (shape === 'circle') {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate(Math.PI / 4);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-18, -18, 36, 36);
      ctx.restore();
    } else if (shape === 'heart') {
      ctx.save();
      ctx.translate(32, 34);
      ctx.beginPath();
      const d = 1.3;
      ctx.moveTo(0, 5 * d);
      ctx.bezierCurveTo(0, 0, -16 * d, -8 * d, -16 * d, -18 * d);
      ctx.bezierCurveTo(-16 * d, -26 * d, -6 * d, -28 * d, 0, -20 * d);
      ctx.bezierCurveTo(6 * d, -28 * d, 16 * d, -26 * d, 16 * d, -18 * d);
      ctx.bezierCurveTo(16 * d, -8 * d, 0, 0, 0, 5 * d);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    } else {
      // 'sparkle' | 'star' (4-point flare + core)
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(32, 2);
      ctx.quadraticCurveTo(32, 32, 62, 32);
      ctx.quadraticCurveTo(32, 32, 32, 62);
      ctx.quadraticCurveTo(32, 32, 2, 32);
      ctx.quadraticCurveTo(32, 32, 32, 2);
      ctx.closePath();
      ctx.fill();

      // Central core
      ctx.beginPath();
      ctx.arc(32, 32, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
    }

    const texture = new THREE_LIB.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  if (!AFRAME.components['ar-particle-system']) {
    AFRAME.registerComponent('ar-particle-system', {
      schema: {
        enabled: { type: 'boolean', default: false },
        preset: { type: 'string', default: 'cosmic-stardust' },
        count: { type: 'number', default: 300 },
        size: { type: 'number', default: 0.04 },
        color: { type: 'color', default: '#38bdf8' },
        colorSecondary: { type: 'color', default: '#c084fc' },
        opacity: { type: 'number', default: 0.85 },
        blending: { type: 'string', default: 'additive' },
        speed: { type: 'number', default: 1.0 },
        spreadX: { type: 'number', default: 3.0 },
        spreadY: { type: 'number', default: 3.0 },
        spreadZ: { type: 'number', default: 3.0 },
        direction: { type: 'string', default: 'float' },
        shape: { type: 'string', default: 'sparkle' },
        posX: { type: 'number', default: 0.0 },
        posY: { type: 'number', default: 0.0 },
        posZ: { type: 'number', default: 0.0 },
        rotX: { type: 'number', default: 0.0 },
        rotY: { type: 'number', default: 0.0 },
        rotZ: { type: 'number', default: 0.0 },
        rotationSpeed: { type: 'number', default: 0.2 },
        twinkle: { type: 'boolean', default: true }
      },

      init: function () {
        const THREE_LIB = getPortalThree();
        this.particleGroup = new THREE_LIB.Group();
        this.particleGroup.name = 'ar_particle_group';
        this.el.setObject3D('particleSystemRoot', this.particleGroup);
        this.particlesObj = null;
        this.velocities = [];

        this.onTargetFound = () => {
          if (this.particleGroup && this.data.enabled) {
            this.el.object3D.visible = true;
            this.particleGroup.visible = true;
            if (this.particlesObj) {
              this.particlesObj.visible = true;
            }
            this.particleGroup.updateMatrixWorld(true);
          }
        };

        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('targetFound', this.onTargetFound);
        }
        if (this.el.parentEl) {
          this.el.parentEl.addEventListener('targetFound', this.onTargetFound);
        }
        const targetEl = document.getElementById('target-entity');
        if (targetEl && targetEl !== this.el.parentEl) {
          targetEl.addEventListener('targetFound', this.onTargetFound);
        }

        this.buildParticles();
      },

      update: function (oldData) {
        if (!this.data.enabled) {
          this.particleGroup.visible = false;
          return;
        }
        this.el.object3D.visible = true;
        this.particleGroup.visible = true;
        if (this.particlesObj) {
          this.particlesObj.visible = true;
        }
        this.particleGroup.position.set(this.data.posX, this.data.posY, this.data.posZ);
        this.particleGroup.rotation.set(
          (this.data.rotX * Math.PI) / 180,
          (this.data.rotY * Math.PI) / 180,
          (this.data.rotZ * Math.PI) / 180
        );

        const needRebuild = !oldData ||
          oldData.count !== this.data.count ||
          oldData.shape !== this.data.shape ||
          oldData.color !== this.data.color ||
          oldData.colorSecondary !== this.data.colorSecondary ||
          oldData.blending !== this.data.blending ||
          oldData.spreadX !== this.data.spreadX ||
          oldData.spreadY !== this.data.spreadY ||
          oldData.spreadZ !== this.data.spreadZ ||
          oldData.direction !== this.data.direction;

        if (needRebuild) {
          this.buildParticles();
        } else {
          if (this.particlesObj && this.particlesObj.material) {
            this.particlesObj.material.size = Math.max(0.01, Number(this.data.size) || 0.04);
            this.particlesObj.material.opacity = Math.max(0.05, Number(this.data.opacity) || 0.85);
          }
        }
      },

      buildParticles: function () {
        const THREE_LIB = getPortalThree();
        while (this.particleGroup.children.length > 0) {
          const child = this.particleGroup.children[0];
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
          this.particleGroup.remove(child);
        }
        this.particlesObj = null;
        this.velocities = [];

        if (!this.data.enabled) return;

        const count = Math.max(10, Math.min(2500, Number(this.data.count) || 300));
        const geom = new THREE_LIB.BufferGeometry();
        const posArr = new Float32Array(count * 3);
        const colArr = new Float32Array(count * 3);

        const colA = new THREE_LIB.Color(this.data.color || '#38bdf8');
        const colB = new THREE_LIB.Color(this.data.colorSecondary || this.data.color || '#c084fc');
        const tempCol = new THREE_LIB.Color();

        const spreadX = Math.max(0.2, Number(this.data.spreadX) || 3.0);
        const spreadY = Math.max(0.2, Number(this.data.spreadY) || 3.0);
        const spreadZ = Math.max(0.2, Number(this.data.spreadZ) || 3.0);
        const speed = Math.max(0.05, Number(this.data.speed) || 1.0);

        for (let i = 0; i < count; i++) {
          posArr[i * 3 + 0] = (Math.random() - 0.5) * spreadX;
          posArr[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
          posArr[i * 3 + 2] = (Math.random() - 0.5) * spreadZ;

          const t = Math.random();
          tempCol.copy(colA).lerp(colB, t);
          colArr[i * 3 + 0] = tempCol.r;
          colArr[i * 3 + 1] = tempCol.g;
          colArr[i * 3 + 2] = tempCol.b;

          let vx = (Math.random() - 0.5) * 0.008 * speed;
          let vy = (Math.random() - 0.5) * 0.008 * speed;
          let vz = (Math.random() - 0.5) * 0.008 * speed;

          if (this.data.direction === 'up') vy = (Math.random() * 0.015 + 0.005) * speed;
          else if (this.data.direction === 'down') vy = -(Math.random() * 0.015 + 0.005) * speed;
          else if (this.data.direction === 'vortex') {
            vx = (Math.random() - 0.5) * 0.01 * speed;
            vy = (Math.random() * 0.006 + 0.002) * speed;
          } else if (this.data.direction === 'explode') {
            vx = (Math.random() - 0.5) * 0.02 * speed;
            vy = (Math.random() - 0.5) * 0.02 * speed;
            vz = (Math.random() - 0.5) * 0.02 * speed;
          }

          this.velocities.push({
            vx,
            vy,
            vz,
            phase: Math.random() * Math.PI * 2
          });
        }

        geom.setAttribute('position', new THREE_LIB.BufferAttribute(posArr, 3));
        geom.setAttribute('color', new THREE_LIB.BufferAttribute(colArr, 3));

        const spriteTex = generateParticleSprite(this.data.shape, THREE_LIB);
        const pMat = new THREE_LIB.PointsMaterial({
          size: Math.max(0.01, Number(this.data.size) || 0.04),
          map: spriteTex,
          vertexColors: true,
          transparent: true,
          opacity: Math.max(0.05, Number(this.data.opacity) || 0.85),
          blending: this.data.blending === 'normal' ? THREE_LIB.NormalBlending : THREE_LIB.AdditiveBlending,
          depthWrite: false,
          depthTest: true
        });

        const pointsMesh = new THREE_LIB.Points(geom, pMat);
        pointsMesh.frustumCulled = false;
        pointsMesh.renderOrder = 999;
        this.particlesObj = pointsMesh;
        this.particleGroup.add(pointsMesh);
      },

      tick: function (time, timeDelta) {
        if (!this.data.enabled || !this.particlesObj || !this.particlesObj.geometry) return;
        if (!this.particleGroup.visible) {
          this.particleGroup.visible = true;
        }
        if (!this.particlesObj.visible) {
          this.particlesObj.visible = true;
        }

        const posAttr = this.particlesObj.geometry.attributes.position;
        if (!posAttr) return;
        const pos = posAttr.array;

        const count = this.velocities.length;
        const spreadX = Math.max(0.2, Number(this.data.spreadX) || 3.0);
        const spreadY = Math.max(0.2, Number(this.data.spreadY) || 3.0);
        const spreadZ = Math.max(0.2, Number(this.data.spreadZ) || 3.0);
        const halfX = spreadX / 2;
        const halfY = spreadY / 2;
        const halfZ = spreadZ / 2;
        const speed = Math.max(0.05, Number(this.data.speed) || 1.0);
        const rotSpeed = Number(this.data.rotationSpeed ?? 0.2);

        for (let i = 0; i < count; i++) {
          const v = this.velocities[i];
          if (this.data.direction === 'vortex') {
            const x = pos[i * 3 + 0];
            const z = pos[i * 3 + 2];
            const angle = 0.02 * rotSpeed;
            pos[i * 3 + 0] = x * Math.cos(angle) - z * Math.sin(angle);
            pos[i * 3 + 2] = x * Math.sin(angle) + z * Math.cos(angle);
            pos[i * 3 + 1] += v.vy;
          } else {
            pos[i * 3 + 0] += v.vx;
            pos[i * 3 + 1] += v.vy;
            pos[i * 3 + 2] += v.vz;
          }

          // Boundary wrap
          if (pos[i * 3 + 0] > halfX) pos[i * 3 + 0] = -halfX;
          else if (pos[i * 3 + 0] < -halfX) pos[i * 3 + 0] = halfX;

          if (pos[i * 3 + 1] > halfY) pos[i * 3 + 1] = -halfY;
          else if (pos[i * 3 + 1] < -halfY) pos[i * 3 + 1] = halfY;

          if (pos[i * 3 + 2] > halfZ) pos[i * 3 + 2] = -halfZ;
          else if (pos[i * 3 + 2] < -halfZ) pos[i * 3 + 2] = halfZ;
        }
        posAttr.needsUpdate = true;

        if (rotSpeed > 0) {
          this.particleGroup.rotation.y += 0.005 * rotSpeed;
        }

        // Subtle shimmering twinkle
        if (this.data.twinkle && this.particlesObj.material) {
          const shimmer = 0.85 + Math.sin(time * 0.005) * 0.15;
          this.particlesObj.material.opacity = (Number(this.data.opacity) || 0.85) * shimmer;
        } else if (!this.data.twinkle && this.particlesObj.material) {
          this.particlesObj.material.opacity = Number(this.data.opacity) || 0.85;
        }
      },

      remove: function () {
        if (this.onTargetFound) {
          const sceneEl = this.el.sceneEl;
          if (sceneEl) {
            sceneEl.removeEventListener('targetFound', this.onTargetFound);
          }
          if (this.el.parentEl) {
            this.el.parentEl.removeEventListener('targetFound', this.onTargetFound);
          }
          const targetEl = document.getElementById('target-entity');
          if (targetEl && targetEl !== this.el.parentEl) {
            targetEl.removeEventListener('targetFound', this.onTargetFound);
          }
        }
        if (this.particleGroup) {
          while (this.particleGroup.children.length > 0) {
            const child = this.particleGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
            this.particleGroup.remove(child);
          }
          this.el.removeObject3D('particleSystemRoot');
        }
      }
    });
  }
}

// =========================================================================
// 8. EXPORTED AR PORTAL CONFIGURATION PRESETS
// =========================================================================
export const PORTAL_PRESETS = {
  'cosmic-nebula': {
    name: 'Cosmic Nebula',
    shape: 'arch',
    width: 1.1,
    height: 1.8,
    radius: 0.7,
    depth: 3.5,
    frameColor: '#38bdf8',
    frameWidth: 0.08,
    frameEmissive: '#0284c7',
    frameEmissiveIntensity: 1.5,
    frameGlow: true,
    interiorType: 'nebula',
    skyboxUrl: '',
    interiorColor: '#050714',
    wallColor: '#0f172a',
    floorColor: '#020617',
    gridColor: '#38bdf8',
    interiorLightColor: '#e0f2fe',
    interiorLightIntensity: 2.0,
    interiorModelType: 'artifact',
    artifactType: 'crystal',
    modelScale: 0.4,
    modelPosX: 0.0,
    modelPosY: 0.0,
    modelPosZ: -1.3,
    modelRotSpeed: 6000,
    showVideo: false,
    particles: 'stars',
    particleCount: 180,
    particleColor: '#38bdf8',
    particleSpeed: 1.0,
    floatingText: 'STAR weAR',
    textColor: '#38bdf8'
  },
  'cyber-matrix': {
    name: 'Cyberpunk Matrix',
    shape: 'hexagon',
    width: 1.2,
    height: 1.4,
    radius: 0.8,
    depth: 4.0,
    frameColor: '#10b981',
    frameWidth: 0.08,
    frameEmissive: '#059669',
    frameEmissiveIntensity: 1.8,
    frameGlow: true,
    interiorType: 'grid-room',
    skyboxUrl: '',
    interiorColor: '#021810',
    wallColor: '#022c22',
    floorColor: '#020617',
    gridColor: '#10b981',
    interiorLightColor: '#6ee7b7',
    interiorLightIntensity: 2.5,
    interiorModelType: 'artifact',
    artifactType: 'cyber-core',
    modelScale: 0.45,
    modelPosX: 0.0,
    modelPosY: 0.0,
    modelPosZ: -1.4,
    modelRotSpeed: 4500,
    showVideo: false,
    particles: 'cyber',
    particleCount: 180,
    particleColor: '#34d399',
    particleSpeed: 1.2,
    floatingText: 'CYBER DIMENSION',
    textColor: '#10b981'
  },
  'virtual-window': {
    name: 'Virtual Window',
    shape: 'rectangle',
    width: 1.4,
    height: 1.0,
    radius: 0.7,
    depth: 3.0,
    frameColor: '#cbd5e1',
    frameWidth: 0.06,
    frameEmissive: '#475569',
    frameEmissiveIntensity: 0.6,
    frameGlow: false,
    interiorType: 'nebula',
    skyboxUrl: '',
    interiorColor: '#0a0f1d',
    wallColor: '#0f172a',
    floorColor: '#020617',
    gridColor: '#38bdf8',
    interiorLightColor: '#ffffff',
    interiorLightIntensity: 1.8,
    interiorModelType: 'none',
    artifactType: 'crystal',
    modelScale: 0.35,
    modelPosX: 0.0,
    modelPosY: 0.0,
    modelPosZ: -1.2,
    modelRotSpeed: 0,
    showVideo: false,
    particles: 'none',
    particleCount: 50,
    particleColor: '#ffffff',
    particleSpeed: 0.5,
    floatingText: 'VIRTUAL WINDOW',
    textColor: '#e2e8f0'
  },
  'luxury-gallery': {
    name: 'Luxury Gallery',
    shape: 'arch',
    width: 1.2,
    height: 1.9,
    radius: 0.7,
    depth: 3.5,
    frameColor: '#f59e0b',
    frameWidth: 0.09,
    frameEmissive: '#b45309',
    frameEmissiveIntensity: 1.4,
    frameGlow: true,
    interiorType: 'void',
    skyboxUrl: '',
    interiorColor: '#0c0a09',
    wallColor: '#1c1917',
    floorColor: '#0c0a09',
    gridColor: '#f59e0b',
    interiorLightColor: '#fef3c7',
    interiorLightIntensity: 2.2,
    interiorModelType: 'artifact',
    artifactType: 'pedestal',
    modelScale: 0.4,
    modelPosX: 0.0,
    modelPosY: -0.15,
    modelPosZ: -1.4,
    modelRotSpeed: 7000,
    showVideo: false,
    particles: 'embers',
    particleCount: 120,
    particleColor: '#fbbf24',
    particleSpeed: 0.8,
    floatingText: 'VIP SHOWROOM',
    textColor: '#f59e0b'
  },
  'stargate-ring': {
    name: 'Sci-Fi Stargate',
    shape: 'circle',
    width: 1.5,
    height: 1.5,
    radius: 0.85,
    depth: 4.5,
    frameColor: '#a855f7',
    frameWidth: 0.08,
    frameEmissive: '#7e22ce',
    frameEmissiveIntensity: 2.0,
    frameGlow: true,
    interiorType: 'starfield',
    skyboxUrl: '',
    interiorColor: '#05021a',
    wallColor: '#1e1035',
    floorColor: '#090314',
    gridColor: '#a855f7',
    interiorLightColor: '#f3e8ff',
    interiorLightIntensity: 2.5,
    interiorModelType: 'artifact',
    artifactType: 'star-emblem',
    modelScale: 0.42,
    modelPosX: 0.0,
    modelPosY: 0.0,
    modelPosZ: -1.5,
    modelRotSpeed: 5000,
    showVideo: false,
    particles: 'stars',
    particleCount: 220,
    particleColor: '#c084fc',
    particleSpeed: 1.4,
    floatingText: 'STARGATE DIMENSION',
    textColor: '#c084fc'
  }
};

// =========================================================================
// 9. EXPORTED AR SCENE PARTICLE CONFIGURATION PRESETS
// =========================================================================
export const PARTICLE_PRESETS = {
  'cosmic-stardust': {
    name: 'Cosmic Stardust',
    icon: 'auto_awesome',
    preset: 'cosmic-stardust',
    count: 320,
    size: 0.045,
    color: '#38bdf8',
    colorSecondary: '#c084fc',
    opacity: 0.85,
    blending: 'additive',
    speed: 1.0,
    spreadX: 3.2,
    spreadY: 2.8,
    spreadZ: 3.2,
    direction: 'float',
    shape: 'sparkle',
    rotationSpeed: 0.25,
    twinkle: true
  },
  'golden-embers': {
    name: 'Golden Embers',
    icon: 'local_fire_department',
    preset: 'golden-embers',
    count: 240,
    size: 0.04,
    color: '#f59e0b',
    colorSecondary: '#ef4444',
    opacity: 0.9,
    blending: 'additive',
    speed: 1.4,
    spreadX: 2.2,
    spreadY: 3.5,
    spreadZ: 2.2,
    direction: 'up',
    shape: 'circle',
    rotationSpeed: 0.1,
    twinkle: true
  },
  'winter-snow': {
    name: 'Winter Snow',
    icon: 'ac_unit',
    preset: 'winter-snow',
    count: 380,
    size: 0.035,
    color: '#ffffff',
    colorSecondary: '#e0f2fe',
    opacity: 0.8,
    blending: 'normal',
    speed: 0.7,
    spreadX: 3.5,
    spreadY: 3.5,
    spreadZ: 3.5,
    direction: 'down',
    shape: 'circle',
    rotationSpeed: 0.05,
    twinkle: false
  },
  'cyber-rain': {
    name: 'Cyber Rain',
    icon: 'terminal',
    preset: 'cyber-rain',
    count: 300,
    size: 0.05,
    color: '#10b981',
    colorSecondary: '#06b6d4',
    opacity: 0.9,
    blending: 'additive',
    speed: 2.2,
    spreadX: 2.8,
    spreadY: 4.0,
    spreadZ: 2.8,
    direction: 'down',
    shape: 'diamond',
    rotationSpeed: 0.0,
    twinkle: true
  },
  'magic-fireflies': {
    name: 'Magic Fireflies',
    icon: 'brightness_5',
    preset: 'magic-fireflies',
    count: 160,
    size: 0.065,
    color: '#a3e635',
    colorSecondary: '#fbbf24',
    opacity: 0.95,
    blending: 'additive',
    speed: 0.5,
    spreadX: 3.0,
    spreadY: 2.5,
    spreadZ: 3.0,
    direction: 'float',
    shape: 'sparkle',
    rotationSpeed: 0.15,
    twinkle: true
  },
  'galaxy-vortex': {
    name: 'Galaxy Vortex',
    icon: 'cyclone',
    preset: 'galaxy-vortex',
    count: 420,
    size: 0.04,
    color: '#ec4899',
    colorSecondary: '#8b5cf6',
    opacity: 0.9,
    blending: 'additive',
    speed: 1.5,
    spreadX: 3.6,
    spreadY: 2.0,
    spreadZ: 3.6,
    direction: 'vortex',
    shape: 'star',
    rotationSpeed: 0.8,
    twinkle: true
  },
  'romantic-hearts': {
    name: 'Romantic Hearts',
    icon: 'favorite',
    preset: 'romantic-hearts',
    count: 140,
    size: 0.07,
    color: '#f43f5e',
    colorSecondary: '#fda4af',
    opacity: 0.9,
    blending: 'normal',
    speed: 0.8,
    spreadX: 2.5,
    spreadY: 3.2,
    spreadZ: 2.5,
    direction: 'up',
    shape: 'heart',
    rotationSpeed: 0.2,
    twinkle: true
  }
};

// =========================================================================
// AR STUDIO LIGHTING COMPONENT
// Multi-source studio lighting rig (Ambient + Key Directional + Fill Directional)
// that anchors directly to the model's parent entity (e.g. #target-entity in WebAR
// or #preview-anchor in 3D). Directional light targets are explicitly parented to
// the rig's Three.js group so their world-space positions track the model 1:1,
// eliminating unanchored Three.js directional target bugs and camera headlight washout.
// =========================================================================
if (typeof AFRAME !== 'undefined' && !AFRAME.components['ar-studio-lighting']) {
  AFRAME.registerComponent('ar-studio-lighting', {
    schema: {
      enabled: { type: 'boolean', default: true },
      ambientColor: { type: 'string', default: '#ffffff' },
      ambientIntensity: { type: 'number', default: 1.4 },
      dir1Color: { type: 'string', default: '#ffffff' },
      dir1Intensity: { type: 'number', default: 2.2 },
      dir1Position: { type: 'string', default: '2 4 3' },
      dir2Color: { type: 'string', default: '#ffffff' },
      dir2Intensity: { type: 'number', default: 1.2 },
      dir2Position: { type: 'string', default: '-2 -1 -2' },
      rimColor: { type: 'string', default: '#818cf8' },
      rimIntensity: { type: 'number', default: 1.0 },
      rimPosition: { type: 'string', default: '0 3 -3' }
    },

    init: function () {
      const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
        ? window.AFRAME.THREE
        : THREE;

      this.lightingGroup = new THREE_LIB.Group();
      this.lightingGroup.name = 'ar_studio_lighting_group';

      // 1. Ambient Light
      this.ambientLight = new THREE_LIB.AmbientLight(this.data.ambientColor || '#ffffff', Number(this.data.ambientIntensity ?? 1.4));
      this.ambientLight.name = 'studio_ambient_light';
      this.lightingGroup.add(this.ambientLight);

      // 2. Key Light (Directional 1)
      this.dir1Light = new THREE_LIB.DirectionalLight(this.data.dir1Color || '#ffffff', Number(this.data.dir1Intensity ?? 2.2));
      this.dir1Light.name = 'studio_dir1_light';
      this.dir1Target = new THREE_LIB.Object3D();
      this.dir1Target.name = 'studio_dir1_target';
      this.dir1Target.position.set(0, 0, 0);
      this.dir1Light.target = this.dir1Target;
      this.lightingGroup.add(this.dir1Light);
      this.lightingGroup.add(this.dir1Target);

      // 3. Fill Light (Directional 2)
      this.dir2Light = new THREE_LIB.DirectionalLight(this.data.dir2Color || '#ffffff', Number(this.data.dir2Intensity ?? 1.2));
      this.dir2Light.name = 'studio_dir2_light';
      this.dir2Target = new THREE_LIB.Object3D();
      this.dir2Target.name = 'studio_dir2_target';
      this.dir2Target.position.set(0, 0, 0);
      this.dir2Light.target = this.dir2Target;
      this.lightingGroup.add(this.dir2Light);
      this.lightingGroup.add(this.dir2Target);

      // 4. Rim / Specular Backlight (Directional 3 - matches ProductViewer signature edge sheen)
      this.rimLight = new THREE_LIB.DirectionalLight(this.data.rimColor || '#818cf8', Number(this.data.rimIntensity ?? 1.0));
      this.rimLight.name = 'studio_rim_light';
      this.rimTarget = new THREE_LIB.Object3D();
      this.rimTarget.name = 'studio_rim_target';
      this.rimTarget.position.set(0, 0, 0);
      this.rimLight.target = this.rimTarget;
      this.lightingGroup.add(this.rimLight);
      this.lightingGroup.add(this.rimTarget);

      if (this.el) {
        if (typeof this.el.setObject3D === 'function') {
          this.el.setObject3D('lightingGroup', this.lightingGroup);
        } else if (this.el.object3D) {
          this.el.object3D.add(this.lightingGroup);
        }
      }

      // Purge any default A-Frame ambient / directional lights so user lighting is 100% pure
      this.removeDefaultLights = () => {
        try {
          if (this.el && this.el.sceneEl && this.el.sceneEl.systems && this.el.sceneEl.systems.light) {
            this.el.sceneEl.systems.light.removeDefaultLights();
            this.el.sceneEl.systems.light.userDefinedLights = true;
          }
          const defLights = document.querySelectorAll('[data-aframe-default-light]');
          defLights.forEach((l) => {
            if (l && l.parentNode) l.parentNode.removeChild(l);
          });
        } catch {}
      };

      this.removeDefaultLights();
      if (this.el && this.el.sceneEl) {
        this.el.sceneEl.addEventListener('loaded', this.removeDefaultLights);
        this.el.sceneEl.addEventListener('render-target-loaded', this.removeDefaultLights);
      }

      this.updateLights();
    },

    update: function () {
      if (this.removeDefaultLights) this.removeDefaultLights();
      this.updateLights();
    },

    updateLights: function () {
      if (!this.lightingGroup) return;
      const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
        ? window.AFRAME.THREE
        : THREE;

      this.lightingGroup.visible = this.data.enabled !== false;

      // 1. Ambient Light
      if (this.ambientLight) {
        this.ambientLight.color.set(this.data.ambientColor || '#ffffff');
        this.ambientLight.intensity = Math.max(0, Number(this.data.ambientIntensity ?? 1.4));
      }

      const parsePos = (posStr, fallback) => {
        if (!posStr) return fallback;
        if (typeof posStr === 'object' && posStr !== null && typeof posStr.x === 'number') {
          return new THREE_LIB.Vector3(posStr.x, posStr.y, posStr.z);
        }
        if (Array.isArray(posStr) && posStr.length === 3) {
          return new THREE_LIB.Vector3(Number(posStr[0]), Number(posStr[1]), Number(posStr[2]));
        }
        const parts = String(posStr).replace(/,/g, ' ').trim().split(/\s+/).map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          return new THREE_LIB.Vector3(parts[0], parts[1], parts[2]);
        }
        return fallback;
      };

      this.p1 = parsePos(this.data.dir1Position, new THREE_LIB.Vector3(2, 4, 3));
      this.p2 = parsePos(this.data.dir2Position, new THREE_LIB.Vector3(-2, -1, -2));
      this.rimP = parsePos(this.data.rimPosition, new THREE_LIB.Vector3(0, 3, -3));

      // 2. Key Light
      if (this.dir1Light) {
        this.dir1Light.color.set(this.data.dir1Color || '#ffffff');
        this.dir1Light.intensity = Math.max(0, Number(this.data.dir1Intensity ?? 2.2));
        this.dir1Light.position.copy(this.p1);
        if (this.dir1Target) {
          this.dir1Target.position.set(0, 0, 0);
          this.dir1Target.updateMatrixWorld(true);
        }
        this.dir1Light.updateMatrixWorld(true);
      }

      // 3. Fill Light
      if (this.dir2Light) {
        this.dir2Light.color.set(this.data.dir2Color || '#ffffff');
        this.dir2Light.intensity = Math.max(0, Number(this.data.dir2Intensity ?? 1.2));
        this.dir2Light.position.copy(this.p2);
        if (this.dir2Target) {
          this.dir2Target.position.set(0, 0, 0);
          this.dir2Target.updateMatrixWorld(true);
        }
        this.dir2Light.updateMatrixWorld(true);
      }

      // 4. Rim Light
      if (this.rimLight) {
        this.rimLight.color.set(this.data.rimColor || '#818cf8');
        this.rimLight.intensity = Math.max(0, Number(this.data.rimIntensity ?? 1.0));
        this.rimLight.position.copy(this.rimP);
        if (this.rimTarget) {
          this.rimTarget.position.set(0, 0, 0);
          this.rimTarget.updateMatrixWorld(true);
        }
        this.rimLight.updateMatrixWorld(true);
      }
    },

    tick: function () {
      if (!this.lightingGroup || this.data.enabled === false) return;
      const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
        ? window.AFRAME.THREE
        : THREE;

      if (!this.tempTargetPos) this.tempTargetPos = new THREE_LIB.Vector3();

      // Find the active 3D model entity in the scene
      let targetObj = null;
      const candidates = ['ar-model', 'preview-model', 'ar-model-forced', 'target-entity', 'preview-anchor'];
      for (let i = 0; i < candidates.length; i++) {
        const candidateEl = document.getElementById(candidates[i]);
        if (candidateEl && candidateEl.object3D && candidateEl.object3D.visible !== false) {
          targetObj = candidateEl.object3D;
          break;
        }
      }

      if (targetObj) {
        targetObj.getWorldPosition(this.tempTargetPos);
      } else {
        this.tempTargetPos.set(0, 0, 0);
      }

      const p1 = this.p1 || new THREE_LIB.Vector3(2, 4, 3);
      const p2 = this.p2 || new THREE_LIB.Vector3(-2, -1, -2);
      const rimP = this.rimP || new THREE_LIB.Vector3(0, 3, -3);

      const tX = this.tempTargetPos.x;
      const tY = this.tempTargetPos.y;
      const tZ = this.tempTargetPos.z;

      if (this.dir1Light && this.dir1Target) {
        this.dir1Target.position.set(tX, tY, tZ);
        this.dir1Light.position.set(tX + p1.x, tY + p1.y, tZ + p1.z);
        this.dir1Target.updateMatrixWorld(true);
        this.dir1Light.updateMatrixWorld(true);
      }

      if (this.dir2Light && this.dir2Target) {
        this.dir2Target.position.set(tX, tY, tZ);
        this.dir2Light.position.set(tX + p2.x, tY + p2.y, tZ + p2.z);
        this.dir2Target.updateMatrixWorld(true);
        this.dir2Light.updateMatrixWorld(true);
      }

      if (this.rimLight && this.rimTarget) {
        this.rimTarget.position.set(tX, tY, tZ);
        this.rimLight.position.set(tX + rimP.x, tY + rimP.y, tZ + rimP.z);
        this.rimTarget.updateMatrixWorld(true);
        this.rimLight.updateMatrixWorld(true);
      }
    },

    remove: function () {
      if (this.lightingGroup && this.el) {
        if (typeof this.el.removeObject3D === 'function') {
          this.el.removeObject3D('lightingGroup');
        } else if (this.el.object3D) {
          this.el.object3D.remove(this.lightingGroup);
        }
        if (this.ambientLight && typeof this.ambientLight.dispose === 'function') this.ambientLight.dispose();
        if (this.dir1Light && typeof this.dir1Light.dispose === 'function') this.dir1Light.dispose();
        if (this.dir2Light && typeof this.dir2Light.dispose === 'function') this.dir2Light.dispose();
        if (this.rimLight && typeof this.rimLight.dispose === 'function') this.rimLight.dispose();
      }
      if (this.el && this.el.sceneEl && this.removeDefaultLights) {
        this.el.sceneEl.removeEventListener('loaded', this.removeDefaultLights);
        this.el.sceneEl.removeEventListener('render-target-loaded', this.removeDefaultLights);
      }
    }
  });
}

// =========================================================================
// AR ADDITIONAL 3D GEOMETRIES RIG
// Renders user-defined primitive 3D geometries (Cube, Sphere, Cylinder, Cone,
// Torus, Torus Knot, Capsule, Plane, Ring, Polyhedra) locked into the AR/3D scene.
// Works seamlessly in ARTest, marker-scanned WebAR, and 3D preview.
// =========================================================================
if (typeof AFRAME !== 'undefined' && !AFRAME.components['ar-additional-geometries']) {
  AFRAME.registerComponent('ar-additional-geometries', {
    schema: {
      geometries: { type: 'string', default: '[]' }
    },

    init: function () {
      const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
        ? window.AFRAME.THREE
        : THREE;

      this.rootGroup = new THREE_LIB.Group();
      this.rootGroup.name = 'ar_additional_geometries_group';
      this.el.setObject3D('additionalGeometriesRoot', this.rootGroup);

      this.onTargetFound = () => {
        if (this.rootGroup && this.el && this.el.object3D) {
          this.el.object3D.visible = true;
          this.rootGroup.visible = true;
          this.rootGroup.children.forEach((mesh) => {
            mesh.visible = mesh.userData?.visible !== false;
          });
          this.rootGroup.updateMatrixWorld(true);
        }
      };

      const sceneEl = this.el.sceneEl;
      if (sceneEl) {
        sceneEl.addEventListener('targetFound', this.onTargetFound);
      }
      if (this.el.parentEl) {
        this.el.parentEl.addEventListener('targetFound', this.onTargetFound);
      }
      const targetEl = document.getElementById('target-entity');
      if (targetEl && targetEl !== this.el.parentEl) {
        targetEl.addEventListener('targetFound', this.onTargetFound);
      }

      this.rebuildGeometries();
    },

    rebuildGeometries: function () {
      const THREE_LIB = (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
        ? window.AFRAME.THREE
        : THREE;

      if (!this.rootGroup) return;

      // Clean up previous meshes
      while (this.rootGroup.children.length > 0) {
        const child = this.rootGroup.children[0];
        this.rootGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }

      let items = [];
      try {
        let raw = this.data.geometries;
        if (typeof raw === 'string') {
          if (raw.startsWith('%5B') || raw.startsWith('%7B') || raw.includes('%22')) {
            raw = decodeURIComponent(raw);
          }
          items = JSON.parse(raw);
        } else if (Array.isArray(raw)) {
          items = raw;
        }
      } catch (err) {
        console.warn('[ar-additional-geometries] Failed to parse geometries JSON:', err);
        items = [];
      }

      if (!Array.isArray(items)) items = [];

      items.forEach((item) => {
        if (!item) return;
        const mesh = createPrimitiveMesh(item, THREE_LIB);
        if (mesh) {
          mesh.visible = item.visible !== false;
          mesh.userData = {
            ...(item || {}),
            isAdditionalGeometry: true,
            geometryId: item.id
          };
          this.rootGroup.add(mesh);
        }
      });

      this.rootGroup.updateMatrixWorld(true);
    },

    update: function (oldData) {
      if (oldData && oldData.geometries !== this.data.geometries) {
        this.rebuildGeometries();
      }
    },

    tick: function (time, timeDelta) {
      if (!this.rootGroup || !this.rootGroup.visible) return;
      const deltaSec = (timeDelta || 16) / 1000;

      for (let i = 0; i < this.rootGroup.children.length; i++) {
        const mesh = this.rootGroup.children[i];
        if (mesh && mesh.userData && Number(mesh.userData.rotationSpeed)) {
          mesh.rotation.y += Number(mesh.userData.rotationSpeed) * deltaSec;
        }
      }
    },

    remove: function () {
      if (this.rootGroup) {
        while (this.rootGroup.children.length > 0) {
          const child = this.rootGroup.children[0];
          this.rootGroup.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        }
        if (this.el) {
          if (typeof this.el.removeObject3D === 'function') {
            this.el.removeObject3D('additionalGeometriesRoot');
          } else if (this.el.object3D) {
            this.el.object3D.remove(this.rootGroup);
          }
        }
      }
      const sceneEl = this.el && this.el.sceneEl;
      if (sceneEl && this.onTargetFound) {
        sceneEl.removeEventListener('targetFound', this.onTargetFound);
      }
    }
  });

  // =========================================================================
  // 11. AR-MARKER-REFERENCE COMPONENT
  // Renders a 3D visual reference plane of the physical MindAR target marker
  // positioned at (0, 0, 0) in the XY plane. Allows users in ARTest to visually
  // calibrate and position 3D models, portals, particles, and geometries
  // relative to where they will physically appear when the real marker is scanned.
  // =========================================================================
  if (!AFRAME.components['ar-marker-reference']) {
    AFRAME.registerComponent('ar-marker-reference', {
      schema: {
        enabled: { type: 'boolean', default: true },
        imageUrl: { type: 'string', default: '' },
        src: { type: 'string', default: '' },
        width: { type: 'number', default: 1.0 },
        height: { type: 'number', default: 0 },
        aspectRatio: { type: 'number', default: 0.5926 },
        opacity: { type: 'number', default: 0.85 },
        showFrame: { type: 'boolean', default: true },
        showBorder: { type: 'boolean', default: true },
        showAxes: { type: 'boolean', default: true },
        showTriad: { type: 'boolean', default: true },
        frameColor: { type: 'color', default: '#10b981' }
      },

      init: function () {
        this.rootGroup = null;
        this.planeMesh = null;
        this.frameGroup = null;
        this.axesGroup = null;
        this.texture = null;
        this.buildMarker();
      },

      buildMarker: function () {
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this.cleanUp();

        if (!this.data.enabled) {
          if (this.rootGroup) this.rootGroup.visible = false;
          return;
        }

        this.rootGroup = new THREE_LIB.Group();
        this.rootGroup.name = 'ar-marker-reference-root';

        const width = Math.max(0.1, Number(this.data.width) || 1.0);
        const ar = Number(this.data.aspectRatio) > 0 ? Number(this.data.aspectRatio) : 0.5926;
        const height = Number(this.data.height) > 0 ? Number(this.data.height) : (width * ar);
        const opacity = Math.min(1.0, Math.max(0.05, Number(this.data.opacity) || 0.85));
        const frameColor = new THREE_LIB.Color(this.data.frameColor || '#10b981');
        const imgUrl = this.data.imageUrl || this.data.src || '';

        // 1. Target Marker Image Plane (in XY plane, matching MindAR anchor orientation)
        const planeGeo = new THREE_LIB.PlaneGeometry(width, height);
        let planeMat;

        if (imgUrl) {
          const loader = new THREE_LIB.TextureLoader();
          this.texture = loader.load(
            imgUrl,
            (tex) => {
              if (tex) {
                tex.colorSpace = THREE_LIB.SRGBColorSpace || THREE_LIB.sRGBEncoding;
                tex.needsUpdate = true;
              }
            },
            undefined,
            (err) => console.warn('[ar-marker-reference] Texture load error:', err)
          );

          planeMat = new THREE_LIB.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: opacity,
            side: THREE_LIB.DoubleSide,
            depthWrite: false
          });
        } else {
          // Subtle dark blueprint plane if texture is not yet loaded
          planeMat = new THREE_LIB.MeshBasicMaterial({
            color: new THREE_LIB.Color('#060913'),
            transparent: true,
            opacity: opacity,
            side: THREE_LIB.DoubleSide,
            depthWrite: false
          });
        }

        this.planeMesh = new THREE_LIB.Mesh(planeGeo, planeMat);
        this.planeMesh.name = 'ar-marker-plane';
        this.rootGroup.add(this.planeMesh);

        // 2. High-Tech Calibration Frame (Border & Corner Brackets)
        const showFrame = this.data.showFrame !== false && this.data.showBorder !== false;
        if (showFrame) {
          this.frameGroup = new THREE_LIB.Group();
          this.frameGroup.name = 'ar-marker-frame';

          const halfW = width / 2;
          const halfH = height / 2;
          const bracketLen = Math.min(halfW, halfH) * 0.25;

          const lineMat = new THREE_LIB.LineBasicMaterial({
            color: frameColor,
            transparent: true,
            opacity: Math.min(1.0, opacity + 0.15),
            linewidth: 2,
            depthWrite: false
          });

          // Outer border rectangle
          const borderPoints = [
            new THREE_LIB.Vector3(-halfW, -halfH, 0.001),
            new THREE_LIB.Vector3(halfW, -halfH, 0.001),
            new THREE_LIB.Vector3(halfW, halfH, 0.001),
            new THREE_LIB.Vector3(-halfW, halfH, 0.001),
            new THREE_LIB.Vector3(-halfW, -halfH, 0.001)
          ];
          const borderGeo = new THREE_LIB.BufferGeometry().setFromPoints(borderPoints);
          const borderLine = new THREE_LIB.Line(borderGeo, lineMat);
          this.frameGroup.add(borderLine);

          // 4 Corner Brackets (L-shapes standing out for visual recognition)
          const bracketPoints = [];
          // Top-Left
          bracketPoints.push(new THREE_LIB.Vector3(-halfW, halfH - bracketLen, 0.002), new THREE_LIB.Vector3(-halfW, halfH, 0.002));
          bracketPoints.push(new THREE_LIB.Vector3(-halfW, halfH, 0.002), new THREE_LIB.Vector3(-halfW + bracketLen, halfH, 0.002));
          // Top-Right
          bracketPoints.push(new THREE_LIB.Vector3(halfW - bracketLen, halfH, 0.002), new THREE_LIB.Vector3(halfW, halfH, 0.002));
          bracketPoints.push(new THREE_LIB.Vector3(halfW, halfH, 0.002), new THREE_LIB.Vector3(halfW, halfH - bracketLen, 0.002));
          // Bottom-Right
          bracketPoints.push(new THREE_LIB.Vector3(halfW, -halfH + bracketLen, 0.002), new THREE_LIB.Vector3(halfW, -halfH, 0.002));
          bracketPoints.push(new THREE_LIB.Vector3(halfW, -halfH, 0.002), new THREE_LIB.Vector3(halfW - bracketLen, -halfH, 0.002));
          // Bottom-Left
          bracketPoints.push(new THREE_LIB.Vector3(-halfW + bracketLen, -halfH, 0.002), new THREE_LIB.Vector3(-halfW, -halfH, 0.002));
          bracketPoints.push(new THREE_LIB.Vector3(-halfW, -halfH, 0.002), new THREE_LIB.Vector3(-halfW, -halfH + bracketLen, 0.002));

          // Center Crosshair Reticle (+)
          const crossSize = Math.min(width, height) * 0.08;
          bracketPoints.push(new THREE_LIB.Vector3(-crossSize, 0, 0.002), new THREE_LIB.Vector3(crossSize, 0, 0.002));
          bracketPoints.push(new THREE_LIB.Vector3(0, -crossSize, 0.002), new THREE_LIB.Vector3(0, crossSize, 0.002));

          const bracketsGeo = new THREE_LIB.BufferGeometry().setFromPoints(bracketPoints);
          const bracketsSegments = new THREE_LIB.LineSegments(bracketsGeo, lineMat);
          this.frameGroup.add(bracketsSegments);

          // Center origin ring
          const ringGeo = new THREE_LIB.RingGeometry(crossSize * 0.2, crossSize * 0.28, 24);
          const ringMat = new THREE_LIB.MeshBasicMaterial({ color: frameColor, side: THREE_LIB.DoubleSide, depthWrite: false });
          const ringMesh = new THREE_LIB.Mesh(ringGeo, ringMat);
          ringMesh.position.z = 0.002;
          this.frameGroup.add(ringMesh);

          this.rootGroup.add(this.frameGroup);
        }

        // 3. Coordinate Triad Indicator (+X Red, +Y Green, +Z Blue)
        const showAxes = this.data.showAxes !== false && this.data.showTriad !== false;
        if (showAxes) {
          this.axesGroup = new THREE_LIB.Group();
          this.axesGroup.name = 'ar-marker-axes';

          const axisLen = Math.min(width, height) * 0.18;
          const axisWidth = 2;

          // +X Axis (Right) - Red
          const xPoints = [new THREE_LIB.Vector3(0, 0, 0.003), new THREE_LIB.Vector3(axisLen, 0, 0.003)];
          const xGeo = new THREE_LIB.BufferGeometry().setFromPoints(xPoints);
          const xMat = new THREE_LIB.LineBasicMaterial({ color: 0xef4444, linewidth: axisWidth, depthWrite: false });
          this.axesGroup.add(new THREE_LIB.Line(xGeo, xMat));

          // +Y Axis (Up) - Green
          const yPoints = [new THREE_LIB.Vector3(0, 0, 0.003), new THREE_LIB.Vector3(0, axisLen, 0.003)];
          const yGeo = new THREE_LIB.BufferGeometry().setFromPoints(yPoints);
          const yMat = new THREE_LIB.LineBasicMaterial({ color: 0x10b981, linewidth: axisWidth, depthWrite: false });
          this.axesGroup.add(new THREE_LIB.Line(yGeo, yMat));

          // +Z Axis (Forward / Out of Marker toward Camera) - Blue
          const zPoints = [new THREE_LIB.Vector3(0, 0, 0.003), new THREE_LIB.Vector3(0, 0, axisLen + 0.003)];
          const zGeo = new THREE_LIB.BufferGeometry().setFromPoints(zPoints);
          const zMat = new THREE_LIB.LineBasicMaterial({ color: 0x38bdf8, linewidth: axisWidth, depthWrite: false });
          this.axesGroup.add(new THREE_LIB.Line(zGeo, zMat));

          this.rootGroup.add(this.axesGroup);
        }

        if (this.el) {
          this.el.setObject3D('markerReferenceRoot', this.rootGroup);
        }
      },

      update: function (oldData) {
        if (!oldData) return;
        if (
          oldData.enabled !== this.data.enabled ||
          oldData.imageUrl !== this.data.imageUrl ||
          oldData.src !== this.data.src ||
          oldData.width !== this.data.width ||
          oldData.height !== this.data.height ||
          oldData.aspectRatio !== this.data.aspectRatio ||
          oldData.opacity !== this.data.opacity ||
          oldData.showFrame !== this.data.showFrame ||
          oldData.showBorder !== this.data.showBorder ||
          oldData.showAxes !== this.data.showAxes ||
          oldData.showTriad !== this.data.showTriad ||
          oldData.frameColor !== this.data.frameColor
        ) {
          this.buildMarker();
        }
      },

      cleanUp: function () {
        if (this.texture) {
          this.texture.dispose();
          this.texture = null;
        }
        if (this.rootGroup) {
          while (this.rootGroup.children.length > 0) {
            const child = this.rootGroup.children[0];
            this.rootGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material.dispose();
            }
          }
          if (this.el && typeof this.el.removeObject3D === 'function') {
            this.el.removeObject3D('markerReferenceRoot');
          }
          this.rootGroup = null;
        }
      },

      remove: function () {
        this.cleanUp();
      }
    });
  }

  // =========================================================================
  // 12. AR-WEBSITE-LAYER COMPONENT
  // Renders a live, interactive 3D website layer (virtual browser viewport)
  // in AR/3D scenes using CSS3DObject + CSS3DRenderer with customizable
  // physical 3D enclosures, address bar navigation, pointer-events interactivity,
  // responsive aspect ratio sizing, and world matrix synchronization.
  // =========================================================================
  if (!AFRAME.components['ar-website-layer']) {
    AFRAME.registerComponent('ar-website-layer', {
      schema: {
        enabled: { type: 'boolean', default: true },
        url: { type: 'string', default: 'https://starwear.app' },
        width: { type: 'number', default: 1.2 },
        height: { type: 'number', default: 0.675 },
        aspectRatio: { type: 'string', default: '16:9' },
        resolution: { type: 'string', default: '1280x720' },
        interactive: { type: 'boolean', default: true },
        opacity: { type: 'number', default: 1.0 },
        frameStyle: { type: 'string', default: 'cyber_bezel' }, // cyber_bezel | obsidian | minimal_glass | frameless
        frameColor: { type: 'color', default: '#6366f1' },
        frameGlow: { type: 'boolean', default: true },
        curved: { type: 'boolean', default: false },
        curveRadius: { type: 'number', default: 3.0 },
        billboard: { type: 'boolean', default: false },
        posX: { type: 'number', default: 0 },
        posY: { type: 'number', default: 0.8 },
        posZ: { type: 'number', default: 0.05 },
        rotX: { type: 'number', default: 0 },
        rotY: { type: 'number', default: 0 },
        rotZ: { type: 'number', default: 0 },
        scale: { type: 'number', default: 1.0 },
        showAddressBar: { type: 'boolean', default: true }
      },

      init: function () {
        this.rootMesh = null;
        this.cssObject = null;
        this.containerDiv = null;
        this.iframe = null;
        this._tempWorldPos = new THREE.Vector3();
        this._tempWorldQuat = new THREE.Quaternion();
        this._tempWorldScale = new THREE.Vector3();
        this.buildLayer();
      },

      ensureCSS3D: function () {
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) return null;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        let cssRenderer = sceneEl._css3dRenderer;
        let cssScene = sceneEl._css3dScene;

        if (!cssRenderer) {
          cssRenderer = new CSS3DRenderer();
          const container = sceneEl.canvas?.parentElement || sceneEl;
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || window.innerHeight;
          cssRenderer.setSize(w, h);

          const dom = cssRenderer.domElement;
          dom.id = 'aframe-css3d-canvas-overlay';
          dom.style.position = 'absolute';
          dom.style.top = '0';
          dom.style.left = '0';
          dom.style.width = '100%';
          dom.style.height = '100%';
          dom.style.pointerEvents = 'none';
          dom.style.zIndex = '10';

          container.appendChild(dom);

          cssScene = new THREE_LIB.Scene();
          sceneEl._css3dRenderer = cssRenderer;
          sceneEl._css3dScene = cssScene;

          const handleResize = () => {
            if (sceneEl.canvas && cssRenderer) {
              const rw = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientWidth : window.innerWidth;
              const rh = sceneEl.canvas.parentElement ? sceneEl.canvas.parentElement.clientHeight : window.innerHeight;
              cssRenderer.setSize(rw, rh);
            }
          };
          window.addEventListener('resize', handleResize);
          sceneEl._css3dResizeHandler = handleResize;
        }

        return { cssRenderer, cssScene };
      },

      buildLayer: function () {
        this.cleanUp();
        if (!this.data.enabled) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) return;

        const cssSetup = this.ensureCSS3D();
        if (!cssSetup) return;
        const { cssScene } = cssSetup;

        // 1. Resolve URL
        let rawUrl = (this.data.url || '').trim();
        if (rawUrl.startsWith('http%3A') || rawUrl.startsWith('https%3A') || rawUrl.includes('%2F')) {
          try { rawUrl = decodeURIComponent(rawUrl); } catch {}
        }
        if (rawUrl && !/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith('about:')) {
          rawUrl = 'https://' + rawUrl;
        }
        if (!rawUrl) rawUrl = 'https://starwear.app';

        // 2. Resolve virtual pixel resolution
        let resW = 1280;
        let resH = 720;
        if (this.data.resolution && this.data.resolution.includes('x')) {
          const parts = this.data.resolution.split('x').map(Number);
          if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            resW = parts[0];
            resH = parts[1];
          }
        } else {
          switch (this.data.aspectRatio) {
            case '9:16': resW = 720; resH = 1280; break;
            case '4:3': resW = 1024; resH = 768; break;
            case '1:1': resW = 800; resH = 800; break;
            case '21:9': resW = 1680; resH = 720; break;
            case '16:9':
            default: resW = 1280; resH = 720; break;
          }
        }

        // 3. Resolve physical dimensions in 3D scene (meters)
        const physicalW = Math.max(0.1, Number(this.data.width) || 1.2);
        let physicalH = Number(this.data.height);
        if (!physicalH || physicalH <= 0) {
          physicalH = physicalW * (resH / resW);
        }

        const baseScale = physicalW / resW;
        this.baseScale = baseScale;
        this.resW = resW;
        this.resH = resH;
        this.physicalW = physicalW;
        this.physicalH = physicalH;

        // 4. Build 3D Physical Enclosure Frame in Three.js
        this.rootMesh = new THREE_LIB.Group();
        this.rootMesh.name = 'ar-website-layer-root';

        const frameStyle = this.data.frameStyle || 'cyber_bezel';
        const frameColor = new THREE_LIB.Color(this.data.frameColor || '#6366f1');
        const showBar = this.data.showAddressBar !== false;
        const barHeightOffset = showBar ? 0.08 : 0.0;
        const totalFrameH = physicalH + barHeightOffset + 0.04;
        const totalFrameW = physicalW + 0.04;
        const frameDepth = frameStyle === 'frameless' ? 0.005 : 0.035;

        let frameMat;
        if (frameStyle === 'obsidian') {
          frameMat = new THREE_LIB.MeshStandardMaterial({
            color: 0x09090b,
            metalness: 0.9,
            roughness: 0.15,
            side: THREE_LIB.DoubleSide
          });
        } else if (frameStyle === 'minimal_glass') {
          frameMat = new THREE_LIB.MeshPhysicalMaterial({
            color: 0x1e293b,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.7,
            transparent: true,
            opacity: 0.85,
            side: THREE_LIB.DoubleSide
          });
        } else if (frameStyle === 'frameless') {
          frameMat = new THREE_LIB.MeshBasicMaterial({
            color: 0x020617,
            transparent: true,
            opacity: 0.4,
            side: THREE_LIB.DoubleSide
          });
        } else {
          // cyber_bezel default
          frameMat = new THREE_LIB.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.8,
            roughness: 0.25,
            side: THREE_LIB.DoubleSide
          });
        }

        const boxGeo = new THREE_LIB.BoxGeometry(totalFrameW, totalFrameH, frameDepth);
        const backingMesh = new THREE_LIB.Mesh(boxGeo, frameMat);
        backingMesh.position.set(0, barHeightOffset / 2, -frameDepth / 2);
        this.rootMesh.add(backingMesh);

        // Glowing perimeter frame border
        if (frameStyle !== 'frameless' && this.data.frameGlow !== false) {
          const borderPoints = [
            new THREE_LIB.Vector3(-totalFrameW / 2, -totalFrameH / 2 + barHeightOffset / 2, 0.002),
            new THREE_LIB.Vector3(totalFrameW / 2, -totalFrameH / 2 + barHeightOffset / 2, 0.002),
            new THREE_LIB.Vector3(totalFrameW / 2, totalFrameH / 2 + barHeightOffset / 2, 0.002),
            new THREE_LIB.Vector3(-totalFrameW / 2, totalFrameH / 2 + barHeightOffset / 2, 0.002),
            new THREE_LIB.Vector3(-totalFrameW / 2, -totalFrameH / 2 + barHeightOffset / 2, 0.002)
          ];
          const borderGeo = new THREE_LIB.BufferGeometry().setFromPoints(borderPoints);
          const borderLineMat = new THREE_LIB.LineBasicMaterial({
            color: frameColor,
            linewidth: 2,
            transparent: true,
            opacity: 0.9
          });
          const borderLine = new THREE_LIB.Line(borderGeo, borderLineMat);
          this.rootMesh.add(borderLine);
        }

        // Apply initial local transforms to rootMesh
        this.rootMesh.position.set(
          Number(this.data.posX) || 0,
          Number(this.data.posY) || 0.8,
          Number(this.data.posZ) || 0.05
        );
        const rotXRad = (Number(this.data.rotX) || 0) * (Math.PI / 180);
        const rotYRad = (Number(this.data.rotY) || 0) * (Math.PI / 180);
        const rotZRad = (Number(this.data.rotZ) || 0) * (Math.PI / 180);
        this.rootMesh.rotation.set(rotXRad, rotYRad, rotZRad);
        const s = Math.max(0.01, Number(this.data.scale) || 1.0);
        this.rootMesh.scale.set(s, s, s);
        this.rootMesh.updateMatrixWorld(true);

        this.el.setObject3D('websiteLayerRoot', this.rootMesh);

        // 5. Build HTML DOM Container for CSS3D
        const containerDiv = document.createElement('div');
        containerDiv.style.width = `${resW}px`;
        containerDiv.style.height = `${resH}px`;
        containerDiv.style.background = '#0a0e17';
        containerDiv.style.borderRadius = frameStyle === 'frameless' ? '6px' : '14px';
        containerDiv.style.overflow = 'hidden';
        containerDiv.style.position = 'relative';
        containerDiv.style.display = 'flex';
        containerDiv.style.flexDirection = 'column';
        containerDiv.style.boxShadow = '0 25px 60px rgba(0,0,0,0.85)';
        containerDiv.style.border = `2px solid ${this.data.frameColor || '#6366f1'}`;
        containerDiv.style.pointerEvents = this.data.interactive ? 'auto' : 'none';
        containerDiv.style.backfaceVisibility = 'hidden';
        containerDiv.style.webkitBackfaceVisibility = 'hidden';
        containerDiv.style.transition = 'opacity 0.15s ease-out';
        containerDiv.style.opacity = String(this.data.opacity ?? 1.0);

        // Optional Top Cyber Address / Controls Bar
        if (showBar) {
          const header = document.createElement('div');
          header.style.cssText = 'height:46px;background:rgba(15,23,42,0.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(255,255,255,0.1);user-select:none;gap:12px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;shrink:0;';

          // macOS style window control dots
          const dots = document.createElement('div');
          dots.style.cssText = 'display:flex;align-items:center;gap:6px;';
          dots.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;"></span><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block;"></span><span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;"></span>';
          header.appendChild(dots);

          // URL Pill
          const urlPill = document.createElement('div');
          urlPill.style.cssText = 'flex:1;background:rgba(2,6,23,0.7);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:4px 12px;font-size:12px;font-family:monospace;color:#93c5fd;display:flex;align-items:center;gap:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          urlPill.innerHTML = `<span style="font-size:11px;">🔒</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${rawUrl}</span>`;
          header.appendChild(urlPill);

          // Action Buttons: Reload, Popout, Interactivity Lock
          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;align-items:center;gap:6px;';

          // Interactive lock toggle
          const lockBtn = document.createElement('button');
          lockBtn.type = 'button';
          lockBtn.style.cssText = `padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid ${this.data.interactive ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'};background:${this.data.interactive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${this.data.interactive ? '#34d399' : '#f87171'};cursor:pointer;`;
          lockBtn.textContent = this.data.interactive ? '🖱️ Touch On' : '🔒 Orbit Locked';
          lockBtn.onclick = (e) => {
            e.stopPropagation();
            const next = !this.data.interactive;
            this.data.interactive = next;
            containerDiv.style.pointerEvents = next ? 'auto' : 'none';
            if (this.iframe) this.iframe.style.pointerEvents = next ? 'auto' : 'none';
            lockBtn.textContent = next ? '🖱️ Touch On' : '🔒 Orbit Locked';
            lockBtn.style.borderColor = next ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)';
            lockBtn.style.background = next ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
            lockBtn.style.color = next ? '#34d399' : '#f87171';
          };
          actions.appendChild(lockBtn);

          // Reload button
          const reloadBtn = document.createElement('button');
          reloadBtn.type = 'button';
          reloadBtn.style.cssText = 'padding:4px 8px;border-radius:6px;font-size:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;';
          reloadBtn.textContent = '🔄';
          reloadBtn.title = 'Reload page';
          reloadBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.iframe) this.iframe.src = rawUrl;
          };
          actions.appendChild(reloadBtn);

          // Popout external button
          const popoutBtn = document.createElement('button');
          popoutBtn.type = 'button';
          popoutBtn.style.cssText = 'padding:4px 8px;border-radius:6px;font-size:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;';
          popoutBtn.textContent = '↗';
          popoutBtn.title = 'Open URL in new tab';
          popoutBtn.onclick = (e) => {
            e.stopPropagation();
            window.open(rawUrl, '_blank', 'noopener,noreferrer');
          };
          actions.appendChild(popoutBtn);

          header.appendChild(actions);
          containerDiv.appendChild(header);
        }

        // Live IFrame
        const iframe = document.createElement('iframe');
        iframe.style.flex = '1';
        iframe.style.width = '100%';
        iframe.style.height = showBar ? `calc(100% - 46px)` : '100%';
        iframe.style.border = '0px';
        iframe.style.background = '#ffffff';
        iframe.style.pointerEvents = this.data.interactive ? 'auto' : 'none';
        iframe.src = rawUrl;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation';
        containerDiv.appendChild(iframe);

        this.iframe = iframe;
        this.containerDiv = containerDiv;

        // 6. Create CSS3DObject and add to cssScene
        this.cssObject = new CSS3DObject(containerDiv);
        this.cssObject.scale.set(baseScale, baseScale, baseScale);
        cssScene.add(this.cssObject);
      },

      tick: function () {
        if (!this.rootMesh || !this.cssObject || !this.data.enabled) return;
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) return;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        // Update local transform of 3D frame
        this.rootMesh.position.set(
          Number(this.data.posX) || 0,
          Number(this.data.posY) || 0.8,
          Number(this.data.posZ) || 0.05
        );
        const rotXRad = (Number(this.data.rotX) || 0) * (Math.PI / 180);
        const rotYRad = (Number(this.data.rotY) || 0) * (Math.PI / 180);
        const rotZRad = (Number(this.data.rotZ) || 0) * (Math.PI / 180);
        this.rootMesh.rotation.set(rotXRad, rotYRad, rotZRad);
        const s = Math.max(0.01, Number(this.data.scale) || 1.0);
        this.rootMesh.scale.set(s, s, s);

        // Billboard mode (face camera)
        if (this.data.billboard && sceneEl.camera) {
          const camWorldPos = new THREE_LIB.Vector3();
          sceneEl.camera.getWorldPosition(camWorldPos);
          this.rootMesh.lookAt(camWorldPos.x, this.rootMesh.position.y, camWorldPos.z);
        }

        this.rootMesh.updateMatrixWorld(true);

        // Compute world position & quaternion
        this.rootMesh.getWorldPosition(this._tempWorldPos);
        this.rootMesh.getWorldQuaternion(this._tempWorldQuat);
        this.rootMesh.getWorldScale(this._tempWorldScale);

        // Position CSS3DObject slightly forward (+Z * 0.02) to sit on the front surface of the bezel
        const forward = new THREE_LIB.Vector3(0, 0, 0.02).applyQuaternion(this._tempWorldQuat);
        const targetPos = this._tempWorldPos.clone().add(forward);

        this.cssObject.position.copy(targetPos);
        this.cssObject.quaternion.copy(this._tempWorldQuat);
        const finalScale = (this.baseScale || 0.001) * this._tempWorldScale.x;
        this.cssObject.scale.set(finalScale, finalScale, finalScale);

        // Backface Culling (prevent reversed backwards text when behind the frame)
        if (sceneEl.camera && this.containerDiv) {
          const camPos = new THREE_LIB.Vector3();
          sceneEl.camera.getWorldPosition(camPos);
          const viewDir = camPos.sub(targetPos).normalize();
          const normal = new THREE_LIB.Vector3(0, 0, 1).applyQuaternion(this._tempWorldQuat);
          const dot = normal.dot(viewDir);

          if (dot < -0.05) {
            this.containerDiv.style.opacity = '0';
            this.containerDiv.style.pointerEvents = 'none';
          } else {
            this.containerDiv.style.opacity = String(this.data.opacity ?? 1.0);
            this.containerDiv.style.pointerEvents = this.data.interactive ? 'auto' : 'none';
          }
        }

        // Render CSS3D scene
        if (sceneEl._css3dRenderer && sceneEl._css3dScene && sceneEl.camera) {
          sceneEl.camera.updateMatrixWorld(true);
          sceneEl.camera.matrixWorldInverse.copy(sceneEl.camera.matrixWorld).invert();
          sceneEl._css3dRenderer.render(sceneEl._css3dScene, sceneEl.camera);
        }
      },

      update: function (oldData) {
        if (!oldData) return;
        if (
          oldData.enabled !== this.data.enabled ||
          oldData.url !== this.data.url ||
          oldData.width !== this.data.width ||
          oldData.height !== this.data.height ||
          oldData.aspectRatio !== this.data.aspectRatio ||
          oldData.resolution !== this.data.resolution ||
          oldData.frameStyle !== this.data.frameStyle ||
          oldData.frameColor !== this.data.frameColor ||
          oldData.frameGlow !== this.data.frameGlow ||
          oldData.showAddressBar !== this.data.showAddressBar
        ) {
          this.buildLayer();
        } else {
          if (this.containerDiv) {
            this.containerDiv.style.pointerEvents = this.data.interactive ? 'auto' : 'none';
            this.containerDiv.style.opacity = String(this.data.opacity ?? 1.0);
          }
          if (this.iframe) {
            this.iframe.style.pointerEvents = this.data.interactive ? 'auto' : 'none';
          }
        }
      },

      cleanUp: function () {
        const sceneEl = this.el && this.el.sceneEl;
        if (this.cssObject && sceneEl && sceneEl._css3dScene) {
          try {
            sceneEl._css3dScene.remove(this.cssObject);
          } catch {}
          this.cssObject = null;
        }
        if (this.rootMesh) {
          while (this.rootMesh.children.length > 0) {
            const child = this.rootMesh.children[0];
            this.rootMesh.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material.dispose();
            }
          }
          if (this.el && typeof this.el.removeObject3D === 'function') {
            this.el.removeObject3D('websiteLayerRoot');
          }
          this.rootMesh = null;
        }
      },

      remove: function () {
        this.cleanUp();
      }
    });
  }
}
