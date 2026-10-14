import { decode } from '@msgpack/msgpack';
import { storage } from '../firebase';
import { ref, getDownloadURL, getBytes } from 'firebase/storage';

// In-memory cache for extracted marker textures to prevent redundant network fetches
const markerCache = new Map();

/**
 * Creates a procedural fallback target marker texture on a 512x512 canvas.
 * Designed with high-contrast computer vision fiducial patterns, corner brackets,
 * metric grid lines, and central crosshair reticle.
 *
 * @param {string} title
 * @returns {{ dataUrl: string, width: number, height: number, aspectRatio: number, hasExtractedImage: boolean }}
 */
export const createDefaultMarkerDataUrl = (title = 'STAR weAR') => {
  if (typeof document === 'undefined') {
    return { dataUrl: '', width: 512, height: 512, aspectRatio: 1.0, hasExtractedImage: false };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Dark blueprint background
  ctx.fillStyle = '#060913';
  ctx.fillRect(0, 0, 512, 512);

  // 2. High-contrast border
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 488, 488);

  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 472, 472);

  // 3. Grid lines (16px spacing)
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 32; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, 488);
    ctx.stroke();
  }
  for (let y = 32; y < 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(488, y);
    ctx.stroke();
  }

  // 4. Heavy Computer Vision Corner Registration Blocks
  const cornerSize = 48;
  ctx.fillStyle = '#10b981';
  ctx.fillRect(24, 24, cornerSize, cornerSize);
  ctx.fillRect(512 - 24 - cornerSize, 24, cornerSize, cornerSize);
  ctx.fillRect(24, 512 - 24 - cornerSize, cornerSize, cornerSize);
  ctx.fillRect(512 - 24 - cornerSize, 512 - 24 - cornerSize, cornerSize, cornerSize);

  // Inner punch-outs on corner blocks
  ctx.fillStyle = '#060913';
  ctx.fillRect(36, 36, cornerSize - 24, cornerSize - 24);
  ctx.fillRect(512 - 36 - (cornerSize - 24), 36, cornerSize - 24, cornerSize - 24);
  ctx.fillRect(36, 512 - 36 - (cornerSize - 24), cornerSize - 24, cornerSize - 24);
  ctx.fillRect(512 - 36 - (cornerSize - 24), 512 - 36 - (cornerSize - 24), cornerSize - 24, cornerSize - 24);

  // 5. Concentric Target Reticles
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(256, 256, 70, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 24, 0, Math.PI * 2);
  ctx.stroke();

  // 6. Center Crosshair (+X and +Y axes)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256, 100);
  ctx.lineTo(256, 412);
  ctx.moveTo(100, 256);
  ctx.lineTo(412, 256);
  ctx.stroke();

  // Center Origin Dot
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(256, 256, 5, 0, Math.PI * 2);
  ctx.fill();

  // 7. Typography & Metric Indicators
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), 256, 195);

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.fillText('MINDAR AR ANCHOR [0, 0, 0]', 256, 215);
  ctx.fillText('NORMALIZED TARGET PLANE (1.0 x 1.0)', 256, 310);

  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.fillText('+Y (TOP)', 256, 40);
  ctx.fillText('-Y (BOTTOM)', 256, 475);
  ctx.textAlign = 'left';
  ctx.fillText('-X (LEFT)', 32, 256);
  ctx.textAlign = 'right';
  ctx.fillText('+X (RIGHT)', 480, 256);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: 512,
    height: 512,
    aspectRatio: 1.0,
    hasExtractedImage: false
  };
};

/**
 * Extracts the real compiled target marker image directly from MindAR's binary .mind file.
 * MindAR stores the original target image dimensions in targetImage { width, height },
 * and a multi-level tracking pyramid in trackingData[0] containing raw 8-bit grayscale pixels.
 *
 * @param {ArrayBuffer} arrayBuffer - The raw binary buffer of the .mind file
 * @returns {{ dataUrl: string, width: number, height: number, aspectRatio: number, hasExtractedImage: boolean } | null}
 */
export const extractMarkerFromMindBuffer = (arrayBuffer) => {
  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer || arrayBuffer.buffer instanceof ArrayBuffer)) {
    return null;
  }

  try {
    const rawBytes = arrayBuffer instanceof ArrayBuffer ? new Uint8Array(arrayBuffer) : new Uint8Array(arrayBuffer.buffer);
    const decoded = decode(rawBytes);

    if (!decoded || !Array.isArray(decoded.dataList) || decoded.dataList.length === 0) {
      return null;
    }

    const item = decoded.dataList[0];
    const targetImage = item.targetImage || {};
    const t0 = item.trackingData?.[0];

    if (!t0 || !t0.data || !t0.width || !t0.height) {
      return null;
    }

    const previewW = t0.width;
    const previewH = t0.height;
    const targetW = targetImage.width || previewW;
    const targetH = targetImage.height || previewH;
    const aspectRatio = targetH / targetW;

    if (typeof document === 'undefined') {
      return { dataUrl: '', width: targetW, height: targetH, aspectRatio, hasExtractedImage: true };
    }

    // Render the raw grayscale bytes into an HTML5 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = previewW;
    canvas.height = previewH;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(previewW, previewH);

    const pixelBytes = t0.data;
    for (let i = 0; i < pixelBytes.length; i++) {
      const gray = pixelBytes[i];
      const idx = i * 4;
      imgData.data[idx] = gray;     // R
      imgData.data[idx + 1] = gray; // G
      imgData.data[idx + 2] = gray; // B
      imgData.data[idx + 3] = 255;  // A
    }

    ctx.putImageData(imgData, 0, 0);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: targetW,
      height: targetH,
      previewWidth: previewW,
      previewHeight: previewH,
      aspectRatio,
      hasExtractedImage: true
    };
  } catch (err) {
    console.warn('[MarkerHelper] Failed to decode .mind buffer:', err);
    return null;
  }
};

/**
 * Loads and resolves the visual marker texture for a given batch or asset.
 * Tries direct batch marker image URLs first (with natural dimensions),
 * then checks Firebase Storage image paths, then downloads and decodes the .mind target file,
 * and falls back to a procedural target canvas.
 *
 * @param {Object} options
 * @returns {Promise<{ dataUrl: string, width: number, height: number, aspectRatio: number, hasExtractedImage: boolean, source: string }>}
 */
export const loadMarkerForBatch = async (options = {}) => {
  if (!options || typeof options !== 'object') {
    return createDefaultMarkerDataUrl('STAR weAR');
  }

  const batchId = options.batchId || options.id || options.batchData?.id || '';

  // 1. Resolve Candidate Direct Marker Image URL
  const candidateImageUrl =
    options.customMarkerUrl ||
    options.markerImageUrl ||
    options.marker_image_url ||
    options.markerImage ||
    options.targetImageUrl ||
    options.target_image_url ||
    options.targetImage ||
    options.patternImageUrl ||
    options.pattern_image_url ||
    options.anchorImageUrl ||
    options.anchor_image_url ||
    options.cfg?.markerConfig?.imageUrl ||
    options.batchData?.markerImageUrl ||
    options.batchData?.marker_image_url ||
    options.batchData?.targetImageUrl ||
    options.batchData?.target_image_url ||
    options.batchData?.patternImageUrl ||
    options.batchData?.anchorImageUrl ||
    options.assetData?.markerImageUrl ||
    options.assetData?.marker_image_url ||
    options.assetData?.targetImageUrl ||
    options.assetData?.target_image_url ||
    options.assetData?.patternImageUrl ||
    options.assetData?.anchorImageUrl ||
    options.data?.arExperience?.markerImageUrl ||
    options.data?.trackingConfig?.markerImageUrl ||
    '';

  const cacheKey = candidateImageUrl || options.mindUrl || options.mindFilePath || options.mind_file_path || batchId;
  if (cacheKey && markerCache.has(cacheKey)) {
    return markerCache.get(cacheKey);
  }

  // If candidate image URL is valid and accessible
  if (candidateImageUrl && typeof candidateImageUrl === 'string' && (candidateImageUrl.startsWith('http') || candidateImageUrl.startsWith('data:'))) {
    try {
      const dimensions = await getImageDimensions(candidateImageUrl);
      const res = {
        dataUrl: candidateImageUrl,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.height / dimensions.width,
        hasExtractedImage: true,
        source: 'batch_marker_image'
      };
      if (cacheKey) markerCache.set(cacheKey, res);
      return res;
    } catch (e) {
      console.warn('[MarkerHelper] Failed to measure dimensions of marker image URL:', e);
    }
  }

  // 2. Check Candidate Firebase Storage Image Paths
  const candidateImagePath =
    options.markerFilePath ||
    options.marker_file_path ||
    options.targetImageStoragePath ||
    options.target_image_path ||
    options.tempImageStoragePath ||
    options.batchData?.marker_file_path ||
    options.assetData?.marker_file_path ||
    options.assetData?.target_image_path ||
    '';

  if (candidateImagePath && typeof candidateImagePath === 'string' && !candidateImagePath.startsWith('http')) {
    try {
      const imgStorageRef = ref(storage, candidateImagePath);
      const dlUrl = await getDownloadURL(imgStorageRef);
      if (dlUrl) {
        const dimensions = await getImageDimensions(dlUrl);
        const res = {
          dataUrl: dlUrl,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: dimensions.height / dimensions.width,
          hasExtractedImage: true,
          source: 'storage_marker_image'
        };
        if (cacheKey) markerCache.set(cacheKey, res);
        return res;
      }
    } catch (e) {
      console.warn('[MarkerHelper] Failed to load candidate image from Firebase Storage:', e);
    }
  }

  // 3. Resolve Candidate .mind File URL
  const candidateMindUrl =
    options.mindUrl ||
    options.mind_url ||
    options.trackingConfig?.mindUrl ||
    options.data?.trackingConfig?.mindUrl ||
    options.data?.arExperience?.mindUrl ||
    '';

  if (candidateMindUrl && typeof candidateMindUrl === 'string' && candidateMindUrl.startsWith('http')) {
    try {
      const resp = await fetch(candidateMindUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const extracted = extractMarkerFromMindBuffer(buf);
        if (extracted) {
          const res = { ...extracted, source: 'mind_url' };
          if (cacheKey) markerCache.set(cacheKey, res);
          return res;
        }
      }
    } catch (err) {
      console.warn('[MarkerHelper] Could not fetch candidateMindUrl:', err.message);
    }
  }

  // 4. Resolve Candidate Firebase Storage .mind File Path
  const candidateMindFilePath =
    options.mindFilePath ||
    options.mind_file_path ||
    options.batchData?.mind_file_path ||
    options.assetData?.mind_file_path ||
    options.data?.mind_file_path ||
    '';

  if (candidateMindFilePath && typeof candidateMindFilePath === 'string') {
    try {
      const fileRef = ref(storage, candidateMindFilePath);
      const bytes = await getBytes(fileRef);
      const extracted = extractMarkerFromMindBuffer(bytes);
      if (extracted) {
        const res = { ...extracted, source: 'storage_mind_file' };
        if (cacheKey) markerCache.set(cacheKey, res);
        return res;
      }
    } catch (err) {
      // Fallback: try getting download URL first
      try {
        const fileRef = ref(storage, candidateMindFilePath);
        const downloadUrl = await getDownloadURL(fileRef);
        const resp = await fetch(downloadUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const extracted = extractMarkerFromMindBuffer(buf);
          if (extracted) {
            const res = { ...extracted, source: 'storage_download_url' };
            if (cacheKey) markerCache.set(cacheKey, res);
            return res;
          }
        }
      } catch {}
    }
  }

  // 5. Fallback to procedural target marker graphic
  const fallback = {
    ...createDefaultMarkerDataUrl(batchId || 'STAR weAR'),
    source: 'procedural_default'
  };
  if (cacheKey) markerCache.set(cacheKey, fallback);
  return fallback;
};

/**
 * Loads an image by URL to measure natural dimensions and aspect ratio.
 * @param {string} url
 * @returns {Promise<{ width: number, height: number }>}
 */
export const getImageDimensions = (url) => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      return resolve({ width: 512, height: 512 });
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth || 512, height: img.naturalHeight || 512 });
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};
