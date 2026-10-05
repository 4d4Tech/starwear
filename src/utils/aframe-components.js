import 'aframe';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

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

const AFRAME = typeof window !== 'undefined' ? window.AFRAME : undefined;

if (typeof AFRAME !== 'undefined') {
  // =========================================================================
  // 1. SCENE-ENVIRONMENT COMPONENT
  // Sets up procedural Image-Based Lighting (IBL) via PMREMGenerator & RoomEnvironment,
  // ACESFilmic Tone Mapping, and sRGB color management on the WebGL scene.
  // =========================================================================
  if (!AFRAME.components['scene-environment']) {
    AFRAME.registerComponent('scene-environment', {
      schema: {
        exposure: { type: 'number', default: 1.0 },
        hdrIntensity: { type: 'number', default: 1.0 }
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
          renderer.toneMappingExposure = this.data.exposure;
        }
      },
      setupEnvironment: function () {
        const scene = this.el.object3D;
        const renderer = this.el.renderer;
        if (!renderer || !scene) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        // Configure Tone Mapping & Color Space
        if (THREE_LIB.ACESFilmicToneMapping !== undefined) {
          renderer.toneMapping = THREE_LIB.ACESFilmicToneMapping;
        }
        renderer.toneMappingExposure = this.data.exposure;

        if (renderer.outputColorSpace !== undefined && THREE_LIB.SRGBColorSpace !== undefined) {
          renderer.outputColorSpace = THREE_LIB.SRGBColorSpace;
        }

        // Generate procedural studio environment (PMREM RoomEnvironment)
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
    const unlockAllVideos = () => {
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

    const createOrActivateVideoElement = (videoOrUrl) => {
      if (!videoOrUrl) return null;
      if (videoOrUrl.tagName === 'VIDEO' || videoOrUrl instanceof HTMLVideoElement) {
        return videoOrUrl;
      }
      if (typeof videoOrUrl !== 'string' || videoOrUrl.trim() === '') {
        return null;
      }

      const url = videoOrUrl.trim();

      // YouTube Guard: Never load YouTube URLs into HTML5 <video> elements!
      // This eliminates the browser CORS violation completely.
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
      
      // CRITICAL FOR iOS SAFARI: Attributes must be set before assigning video.src
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

      // Ensure video is in active viewport DOM so iOS hardware media decoders remain active
      let container = document.getElementById('aframe-video-hidden-box');
      if (!container) {
        container = document.createElement('div');
        container.id = 'aframe-video-hidden-box';
        container.style.cssText = 'position:fixed;top:0;left:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-999;overflow:hidden;';
        document.body.appendChild(container);
      }
      container.appendChild(video);

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

    AFRAME.registerComponent('play-gltf-video', {
      schema: {
        src: { type: 'string', default: '' },
        playing: { type: 'boolean', default: true },
        muted: { type: 'boolean', default: false },
        targetMesh: { type: 'string', default: 'auto' },
        flipX: { type: 'boolean', default: false },
        videoScale: { type: 'number', default: 1.0 },
        videoOffsetX: { type: 'number', default: 0.0 },
        videoOffsetY: { type: 'number', default: 0.0 },
        videoOffsetZ: { type: 'number', default: 0.0 },
        videoRotation: { type: 'number', default: 0.0 },
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
        const slotIdx = typeof this.cssTargetNode?.userData?.videoTargetMaterialIndex === 'number'
          ? this.cssTargetNode.userData.videoTargetMaterialIndex
          : 0;
        const frame = computeGeometrySurfaceFrame(this.cssTargetNode, slotIdx);
        const targetW = Math.max(frame.size.x, 0.05);
        const baseScale = targetW / iframeW;

        cssObject.scale.set(baseScale, baseScale, baseScale);
        const spawnPos = frame.worldCenter.clone().addScaledVector(frame.worldNormal, 0.005);
        cssObject.position.copy(spawnPos);
        cssObject.quaternion.copy(frame.worldQuat);

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

          const slotIdx = typeof target.userData?.videoTargetMaterialIndex === 'number'
            ? target.userData.videoTargetMaterialIndex
            : 0;
          const frame = computeGeometrySurfaceFrame(target, slotIdx);

          // User adjustment controls
          const uOffsetX = this.data.videoOffsetX !== undefined ? this.data.videoOffsetX : (target.userData?.videoOffsetX || 0);
          const uOffsetY = this.data.videoOffsetY !== undefined ? this.data.videoOffsetY : (target.userData?.videoOffsetY || 0);
          const uOffsetZ = this.data.videoOffsetZ !== undefined ? this.data.videoOffsetZ : (target.userData?.videoOffsetZ || 0);

          // Position in exact 3D space: face center + normal clearance + in-plane offsets (tangent & bitangent)
          const localPos = frame.localCenter.clone().addScaledVector(frame.localNormal, 0.005 + uOffsetZ);
          localPos.addScaledVector(frame.localRight, uOffsetX);
          localPos.addScaledVector(frame.localUp, uOffsetY);
          localPos.applyMatrix4(target.matrixWorld);
          this.cssObject.position.copy(localPos);

          // Exact 3D orientation matching face surface normal and rotation
          let quat = frame.worldQuat.clone();
          const uRot = this.data.videoRotation !== undefined ? this.data.videoRotation : (target.userData?.videoRotation || 0);
          if (uRot !== 0) {
            const rotQuat = new THREE_LIB.Quaternion().setFromAxisAngle(
              frame.worldNormal,
              (uRot * Math.PI) / 180
            );
            quat = rotQuat.multiply(quat);
          }
          this.cssObject.quaternion.copy(quat);

          target.getWorldScale(this._tempWorldScale);

          // User scale multiplier
          const uScale = (this.data.videoScale !== undefined && this.data.videoScale > 0)
            ? this.data.videoScale
            : (target.userData?.videoScale || 1.0);
          const baseScale = (this.baseScale || (Math.max(frame.size.x, 0.05) / 640)) * uScale;

          this.cssObject.scale.set(
            baseScale * Math.abs(this._tempWorldScale.x || 1),
            baseScale * Math.abs(this._tempWorldScale.y || 1),
            baseScale * Math.abs(this._tempWorldScale.z || 1)
          );

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
}
