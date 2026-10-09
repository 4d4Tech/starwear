import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

// Static mapping of pre-rendered 3D model snapshots
const PRE_RENDERED_THUMBNAILS = {
  // Direct filenames and relative paths
  'clothes/jackets/hoodie.glb': '/thumbnails/clothes-jackets-hoodie.png',
  'clothes/jackets/hoodie_v2.glb': '/thumbnails/clothes-jackets-hoodie_v2.png',
  'clothes/jackets/hoodie (1).glb': '/thumbnails/clothes-jackets-hoodie-1.png',
  'clothes/shirts/casual_shirt.glb': '/thumbnails/clothes-shirts-casual_shirt.png',
  'clothes/shirts/standard_t-shirt.glb': '/thumbnails/clothes-shirts-standard_t-shirt.png',
  'clothes/shirts/white_t-shirt_with_print.glb': '/thumbnails/clothes-shirts-white_t-shirt_with_print.png',
  'clothes/misc/tiny_isometric_room.glb': '/thumbnails/clothes-misc-tiny_isometric_room.png',

  // Filenames alone
  'hoodie.glb': '/thumbnails/clothes-jackets-hoodie.png',
  'hoodie_v2.glb': '/thumbnails/clothes-jackets-hoodie_v2.png',
  'hoodie (1).glb': '/thumbnails/clothes-jackets-hoodie-1.png',
  'casual_shirt.glb': '/thumbnails/clothes-shirts-casual_shirt.png',
  'standard_t-shirt.glb': '/thumbnails/clothes-shirts-standard_t-shirt.png',
  'white_t-shirt_with_print.glb': '/thumbnails/clothes-shirts-white_t-shirt_with_print.png',
  'tiny_isometric_room.glb': '/thumbnails/clothes-misc-tiny_isometric_room.png',

  // Curated shop collection IDs mapped to matching 3D models
  'aether-chrono-trench': '/thumbnails/clothes-jackets-hoodie_v2.png',
  'obsidian-vortex-hoodie': '/thumbnails/clothes-jackets-hoodie.png',
  'kinetic-cyber-kimono': '/thumbnails/clothes-shirts-casual_shirt.png',
  'quantum-shift-bomber': '/thumbnails/clothes-jackets-hoodie-1.png',
  'synth-drape-gown': '/thumbnails/clothes-shirts-white_t-shirt_with_print.png',
  'prism-matrix-vest': '/thumbnails/clothes-shirts-standard_t-shirt.png'
};

// Global in-memory cache for dynamic thumbnail DataURLs
const inMemoryCache = new Map();

// Active rendering queue & promises to prevent redundant work
const pendingRenders = new Map();

// Helper to look up static pre-rendered thumbnail
export function getPreRenderedThumbnail(keyOrUrl) {
  if (!keyOrUrl) return null;
  const str = String(keyOrUrl).trim();

  // Direct match
  if (PRE_RENDERED_THUMBNAILS[str]) return PRE_RENDERED_THUMBNAILS[str];

  // Match against normalized URL segments
  const decoded = decodeURIComponent(str);
  for (const [key, thumbPath] of Object.entries(PRE_RENDERED_THUMBNAILS)) {
    if (decoded.includes(key) || str.includes(encodeURIComponent(key))) {
      return thumbPath;
    }
  }

  // Check by base filename
  const filename = decoded.split('/').pop()?.split('?')[0];
  if (filename && PRE_RENDERED_THUMBNAILS[filename]) {
    return PRE_RENDERED_THUMBNAILS[filename];
  }

  return null;
}

// Check session storage cache safely
function getSessionCache(key) {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(`starwear_thumb_${key}`);
  } catch {
    return null;
  }
}

function setSessionCache(key, dataUrl) {
  if (typeof window === 'undefined' || !dataUrl) return;
  try {
    // Only store webp / png data under 500KB to stay within quota
    if (dataUrl.length < 500000) {
      sessionStorage.setItem(`starwear_thumb_${key}`, dataUrl);
    }
  } catch {
    // Quota reached or private mode, silently ignore
  }
}

// Singleton Offscreen Three.js Renderer
let offscreenRenderer = null;
let offscreenScene = null;
let offscreenCamera = null;
let gltfLoaderInstance = null;

function getOffscreenRenderer() {
  if (typeof window === 'undefined') return null;

  if (!offscreenRenderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;

    offscreenRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
    offscreenRenderer.setSize(384, 384, false);
    offscreenRenderer.setPixelRatio(1);
    offscreenRenderer.outputColorSpace = THREE.SRGBColorSpace;
    offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    offscreenRenderer.toneMappingExposure = 1.35;

    offscreenScene = new THREE.Scene();
    offscreenCamera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    offscreenScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(2.5, 3.5, 3.0);
    offscreenScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.3);
    fillLight.position.set(-3, 1, -2);
    offscreenScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(0, -1, -3);
    offscreenScene.add(rimLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.2);
    topLight.position.set(0, 5, 0);
    offscreenScene.add(topLight);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    gltfLoaderInstance = new GLTFLoader();
    gltfLoaderInstance.setDRACOLoader(dracoLoader);
  }

  return {
    renderer: offscreenRenderer,
    scene: offscreenScene,
    camera: offscreenCamera,
    loader: gltfLoaderInstance
  };
}

/**
 * Resolves a model download URL from Firebase storage path or direct URL
 */
export async function resolveModelUrl(rawPathOrUrl) {
  if (!rawPathOrUrl) return '';
  const str = String(rawPathOrUrl).trim();
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('blob:') || str.startsWith('data:')) {
    return str;
  }
  try {
    const fileRef = ref(storage, str);
    return await getDownloadURL(fileRef);
  } catch (err) {
    console.warn(`Could not resolve storage path "${str}":`, err);
    return '';
  }
}

/**
 * Dynamically captures a 3D model snapshot client-side using offscreen Three.js WebGLRenderer.
 * Returns a data URL (image/png or image/webp).
 */
export async function captureModelThumbnail(modelUrlOrFile) {
  if (!modelUrlOrFile) return null;

  let url = '';
  let cacheKey = '';

  if (typeof modelUrlOrFile === 'string') {
    url = await resolveModelUrl(modelUrlOrFile);
    cacheKey = url.split('?')[0] || url;
  } else if (modelUrlOrFile instanceof File || modelUrlOrFile instanceof Blob) {
    url = URL.createObjectURL(modelUrlOrFile);
    cacheKey = `${modelUrlOrFile.name || 'blob'}_${modelUrlOrFile.size}_${modelUrlOrFile.lastModified || 0}`;
  }

  if (!url) return null;

  // 1. Check pre-rendered static catalog
  const preRendered = getPreRenderedThumbnail(cacheKey || url);
  if (preRendered) return preRendered;

  // 2. Check in-memory cache
  if (inMemoryCache.has(cacheKey)) {
    return inMemoryCache.get(cacheKey);
  }

  // 3. Check sessionStorage
  const sessionCached = getSessionCache(cacheKey);
  if (sessionCached) {
    inMemoryCache.set(cacheKey, sessionCached);
    return sessionCached;
  }

  // 4. Return in-flight promise if currently generating
  if (pendingRenders.has(cacheKey)) {
    return pendingRenders.get(cacheKey);
  }

  // 5. Execute generation with queue
  const renderPromise = (async () => {
    try {
      const gl = getOffscreenRenderer();
      if (!gl) return null;

      const gltf = await new Promise((resolve, reject) => {
        gl.loader.load(url, resolve, undefined, reject);
      });

      const model = gltf.scene;

      // Calculate Bounding Box and scale normalization
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const normScale = 1.0 / maxDim;

      model.scale.set(normScale, normScale, normScale);
      model.position.set(-center.x * normScale, -center.y * normScale, -center.z * normScale);

      gl.scene.add(model);

      // Three-quarter dynamic showroom perspective angle
      gl.camera.position.set(0.55, 0.22, 1.55);
      gl.camera.lookAt(0, 0, 0);

      gl.renderer.render(gl.scene, gl.camera);

      let dataUrl = gl.renderer.domElement.toDataURL('image/webp', 0.88);
      if (!dataUrl || dataUrl.length < 500) {
        dataUrl = gl.renderer.domElement.toDataURL('image/png');
      }

      // Cleanup scene
      gl.scene.remove(model);
      model.traverse((node) => {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        }
      });

      // Cache result
      inMemoryCache.set(cacheKey, dataUrl);
      setSessionCache(cacheKey, dataUrl);

      return dataUrl;
    } catch (err) {
      console.warn('Offscreen 3D thumbnail capture fallback:', err);
      return null;
    } finally {
      pendingRenders.delete(cacheKey);
      if (modelUrlOrFile instanceof File || modelUrlOrFile instanceof Blob) {
        URL.revokeObjectURL(url);
      }
    }
  })();

  pendingRenders.set(cacheKey, renderPromise);
  return renderPromise;
}

/**
 * Returns procedural 3D SVG icon/silhouette based on product or template category
 */
export function getCategoryProcedural3D(category = 'Apparel', subcategory = '') {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();

  if (cat.includes('cloth') || cat.includes('wear') || cat.includes('apparel') || sub.includes('jacket') || sub.includes('hoodie')) {
    return {
      type: 'hoodie',
      color: '#38bdf8',
      accent: '#0284c7',
      label: '3D HOODIE / JACKET',
      icon: 'checkroom'
    };
  }
  if (sub.includes('shirt') || sub.includes('top') || sub.includes('tee')) {
    return {
      type: 'shirt',
      color: '#818cf8',
      accent: '#4f46e5',
      label: '3D T-SHIRT / TOP',
      icon: 'apparel'
    };
  }
  if (cat.includes('shoe') || sub.includes('shoe') || sub.includes('sneaker') || cat.includes('footwear')) {
    return {
      type: 'shoe',
      color: '#f43f5e',
      accent: '#e11d48',
      label: '3D FOOTWEAR',
      icon: 'roller_skating'
    };
  }
  if (cat.includes('hat') || sub.includes('hat') || sub.includes('cap') || cat.includes('headwear')) {
    return {
      type: 'headwear',
      color: '#eab308',
      accent: '#ca8a04',
      label: '3D HEADWEAR',
      icon: 'sports_martial_arts'
    };
  }
  if (cat.includes('character') || cat.includes('avatar') || sub.includes('humanoid') || sub.includes('mannequin')) {
    return {
      type: 'character',
      color: '#c084fc',
      accent: '#9333ea',
      label: '3D HUMANOID RIG',
      icon: 'accessibility_new'
    };
  }

  return {
    type: 'prop',
    color: '#06b6d4',
    accent: '#0891b2',
    label: '3D MESH ASSET',
    icon: 'deployed_code'
  };
}
