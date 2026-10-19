import { decode } from '@msgpack/msgpack';
import { storage } from '../firebase';
import { ref, getDownloadURL, getBytes, list } from 'firebase/storage';

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

    const dataUrl = canvas.toDataURL('image/png');
    return {
      dataUrl,
      blobUrl: dataUrl,
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
 * @returns {Promise<{ dataUrl: string, blobUrl?: string, width: number, height: number, aspectRatio: number, hasExtractedImage: boolean, source: string, mindFilePath?: string }>}
 */
export const loadMarkerForBatch = async (options = {}) => {
  if (!options || typeof options !== 'object') {
    return createDefaultMarkerDataUrl('STAR weAR');
  }

  const batchId = options.batchId || options.id || options.batchData?.id || '';

  // 1. Resolve Candidate Direct Marker Image URL
  const rawCandidate =
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

  const candidateImageUrl = (typeof rawCandidate === 'string' && !rawCandidate.startsWith('blob:')) ? rawCandidate : '';

  const cacheKey = candidateImageUrl || options.mindUrl || options.mindFilePath || options.mind_file_path || batchId;
  if (cacheKey && markerCache.has(cacheKey)) {
    const cached = markerCache.get(cacheKey);
    if (cached && cached.hasExtractedImage) {
      return cached;
    }
  }

  // If candidate image URL is valid and accessible (http/https or persistent data URI)
  if (candidateImageUrl && typeof candidateImageUrl === 'string' && (candidateImageUrl.startsWith('http') || candidateImageUrl.startsWith('data:'))) {
    try {
      const dimensions = await getImageDimensions(candidateImageUrl);
      const res = {
        dataUrl: candidateImageUrl,
        blobUrl: candidateImageUrl,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.aspectRatio || (dimensions.height / dimensions.width),
        hasExtractedImage: true,
        source: 'batch_marker_image'
      };
      if (cacheKey) markerCache.set(cacheKey, res);
      return res;
    } catch {
      // Candidate image URL unreachable, silently fall back
    }
  }

  // 2. Check Candidate Firebase Storage Image Paths
  // First, check explicit file paths configured in batch/asset documents
  const explicitImagePaths = [];
  if (options.markerFilePath) explicitImagePaths.push(options.markerFilePath);
  if (options.marker_file_path) explicitImagePaths.push(options.marker_file_path);
  if (options.targetImageStoragePath) explicitImagePaths.push(options.targetImageStoragePath);
  if (options.target_image_path) explicitImagePaths.push(options.target_image_path);
  if (options.tempImageStoragePath) explicitImagePaths.push(options.tempImageStoragePath);
  if (options.batchData?.marker_file_path) explicitImagePaths.push(options.batchData.marker_file_path);
  if (options.assetData?.marker_file_path) explicitImagePaths.push(options.assetData.marker_file_path);
  if (options.assetData?.target_image_path) explicitImagePaths.push(options.assetData.target_image_path);

  for (const imgPath of explicitImagePaths) {
    if (!imgPath || typeof imgPath !== 'string' || imgPath.startsWith('http')) continue;
    try {
      const imgStorageRef = ref(storage, imgPath);
      const dlUrl = await getDownloadURL(imgStorageRef);
      if (dlUrl) {
        const dimensions = await getImageDimensions(dlUrl);
        const res = {
          dataUrl: dlUrl,
          blobUrl: dlUrl,
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: dimensions.aspectRatio || (dimensions.height / dimensions.width),
          hasExtractedImage: true,
          source: 'storage_marker_image',
          storagePath: imgPath
        };
        if (cacheKey) markerCache.set(cacheKey, res);
        return res;
      }
    } catch {
      // Explicit path not found, proceed
    }
  }

  // Next, if batchId is provided, inspect assets/${batchId} folder without speculative 404s
  let batchFolderItems = null;
  if (batchId) {
    try {
      const folderRef = ref(storage, `assets/${batchId}`);
      const listRes = await list(folderRef, { maxResults: 30 });
      batchFolderItems = listRes.items || [];
      const imageItem = batchFolderItems.find((item) => {
        const n = item.name.toLowerCase();
        return (n.startsWith('marker') || n.startsWith('target')) && (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp'));
      });
      if (imageItem) {
        const dlUrl = await getDownloadURL(imageItem);
        if (dlUrl) {
          const dimensions = await getImageDimensions(dlUrl);
          const res = {
            dataUrl: dlUrl,
            blobUrl: dlUrl,
            width: dimensions.width,
            height: dimensions.height,
            aspectRatio: dimensions.aspectRatio || (dimensions.height / dimensions.width),
            hasExtractedImage: true,
            source: 'storage_marker_image',
            storagePath: imageItem.fullPath
          };
          if (cacheKey) markerCache.set(cacheKey, res);
          return res;
        }
      }
    } catch {
      // Folder doesn't exist or list failed, proceed to mind checks
    }
  }

  // 3. Resolve Candidate .mind File URL
  const candidateMindUrls = [];
  if (options.mindUrl) candidateMindUrls.push(options.mindUrl);
  if (options.mind_url) candidateMindUrls.push(options.mind_url);
  if (options.trackingConfig?.mindUrl) candidateMindUrls.push(options.trackingConfig.mindUrl);
  if (options.data?.trackingConfig?.mindUrl) candidateMindUrls.push(options.data.trackingConfig.mindUrl);
  if (options.data?.arExperience?.mindUrl) candidateMindUrls.push(options.data.arExperience.mindUrl);

  for (const mindUrl of candidateMindUrls) {
    if (!mindUrl || typeof mindUrl !== 'string' || !mindUrl.startsWith('http')) continue;
    try {
      const resp = await fetch(mindUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const extracted = extractMarkerFromMindBuffer(buf);
        if (extracted) {
          const res = { ...extracted, source: 'mind_url' };
          if (cacheKey) markerCache.set(cacheKey, res);
          return res;
        }
      }
    } catch {}
  }

  // 4. Resolve Candidate Firebase Storage .mind File from batch folder or explicit paths
  if (batchFolderItems && batchFolderItems.length > 0) {
    const mindItem = batchFolderItems.find((it) => it.name.toLowerCase().endsWith('.mind'));
    if (mindItem) {
      try {
        const bytes = await getBytes(mindItem);
        if (bytes) {
          const extracted = extractMarkerFromMindBuffer(bytes);
          if (extracted) {
            const res = { ...extracted, source: 'storage_mind_file', mindFilePath: mindItem.fullPath };
            if (cacheKey) markerCache.set(cacheKey, res);
            return res;
          }
        }
      } catch {}
    }
  }

  const explicitMindPaths = [];
  if (options.mindFilePath) explicitMindPaths.push(options.mindFilePath);
  if (options.mind_file_path) explicitMindPaths.push(options.mind_file_path);
  if (options.batchData?.mind_file_path) explicitMindPaths.push(options.batchData.mind_file_path);
  if (options.assetData?.mind_file_path) explicitMindPaths.push(options.assetData.mind_file_path);
  if (options.data?.mind_file_path) explicitMindPaths.push(options.data.mind_file_path);

  for (const mindFilePath of explicitMindPaths) {
    if (!mindFilePath || typeof mindFilePath !== 'string') continue;
    try {
      const fileRef = ref(storage, mindFilePath);
      let buf = null;
      try {
        const bytes = await getBytes(fileRef);
        buf = bytes;
      } catch {
        try {
          const downloadUrl = await getDownloadURL(fileRef);
          const resp = await fetch(downloadUrl);
          if (resp.ok) {
            buf = await resp.arrayBuffer();
          }
        } catch {}
      }

      if (buf) {
        const extracted = extractMarkerFromMindBuffer(buf);
        if (extracted) {
          const res = { ...extracted, source: 'storage_mind_file', mindFilePath };
          if (cacheKey) markerCache.set(cacheKey, res);
          return res;
        }
      }
    } catch {}
  }

  // 5. Fallback to procedural target marker graphic
  const fallback = {
    ...createDefaultMarkerDataUrl(batchId || 'STAR weAR'),
    source: 'procedural_default'
  };
  return fallback;
};

/**
 * Loads an image by URL to measure natural dimensions and aspect ratio.
 * @param {string} url
 * @returns {Promise<{ width: number, height: number, aspectRatio: number }>}
 */
export const getImageDimensions = (url) => {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string' || url.startsWith('blob:') || typeof Image === 'undefined') {
      return resolve({ width: 512, height: 512, aspectRatio: 1.0 });
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || 512;
      const height = img.naturalHeight || 512;
      const aspectRatio = height / width;
      resolve({ width, height, aspectRatio });
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};
