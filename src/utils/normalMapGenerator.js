/**
 * Client-Side Normal Map Generator & Converter
 * 
 * Converts any 2D image (photos, patterns, heightmaps, drawings, diffuse textures)
 * into a tangent-space PBR normal map using Sobel gradient analysis.
 */

/**
 * Loads an image from a URL, Blob, File, or existing element.
 * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
    return Promise.resolve(source);
  }

  return new Promise((resolve, reject) => {
    let url = '';
    let shouldRevoke = false;

    if (typeof source === 'string') {
      url = source;
    } else if (source instanceof Blob || source instanceof File) {
      url = URL.createObjectURL(source);
      shouldRevoke = true;
    } else if (source instanceof HTMLCanvasElement) {
      url = source.toDataURL('image/png');
    } else {
      return reject(new Error('Unsupported image source type'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (shouldRevoke) {
        URL.revokeObjectURL(url);
      }
      resolve(img);
    };

    img.onerror = (err) => {
      if (shouldRevoke) {
        URL.revokeObjectURL(url);
      }
      reject(new Error('Failed to load image for normal map generation: ' + (err?.message || 'Network / format error')));
    };

    img.src = url;
  });
}

/**
 * Fast 1D box blur pass on a 1D Float32Array
 */
function boxBlur1D(src, dst, w, h, radius) {
  if (radius <= 0) {
    dst.set(src);
    return;
  }

  // Horizontal blur
  const temp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const nx = Math.max(0, Math.min(w - 1, x + k));
        sum += src[rowOffset + nx];
        count++;
      }
      temp[rowOffset + x] = sum / count;
    }
  }

  // Vertical blur
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const ny = Math.max(0, Math.min(h - 1, y + k));
        sum += temp[ny * w + x];
        count++;
      }
      dst[y * w + x] = sum / count;
    }
  }
}

/**
 * Generates a tangent-space normal map canvas from an image source.
 * 
 * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} source 
 * @param {Object} options
 * @param {number} [options.strength=3.0] - Depth multiplier (0.5 to 10.0)
 * @param {boolean} [options.invertY=false] - Invert Green (Y) channel (OpenGL vs DirectX)
 * @param {boolean} [options.invertX=false] - Invert Red (X) channel
 * @param {number} [options.blurRadius=0] - Smoothing radius (0 to 4 px)
 * @param {number} [options.contrast=1.0] - Contrast curve on luminance (0.5 to 2.0)
 * @param {number} [options.maxDimension=2048] - Max width/height to constrain memory
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number, blob: Blob, file: File, dataUrl: string}>}
 */
export async function generateNormalMap(source, options = {}) {
  const {
    strength = 3.0,
    invertY = false,
    invertX = false,
    blurRadius = 0,
    contrast = 1.0,
    maxDimension = 2048,
    fileName = 'converted_normal.png'
  } = options;

  const img = await loadImage(source);

  let w = img.naturalWidth || img.width || 512;
  let h = img.naturalHeight || img.height || 512;

  // Scale down if exceeds maxDimension
  if (w > maxDimension || h > maxDimension) {
    if (w >= h) {
      h = Math.round((h * maxDimension) / w);
      w = maxDimension;
    } else {
      w = Math.round((w * maxDimension) / h);
      h = maxDimension;
    }
  }

  // 1. Draw source image to offscreen canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0, w, h);

  const srcImgData = srcCtx.getImageData(0, 0, w, h);
  const srcData = srcImgData.data;

  // 2. Extract Luminance array
  const rawLum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const a = srcData[idx + 3];
    if (a < 10) {
      rawLum[i] = 0.5;
    } else {
      // Standard ITU-R BT.601 luminance
      let l = (0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2]) / 255;
      if (contrast !== 1.0) {
        l = Math.max(0, Math.min(1, ((l - 0.5) * contrast) + 0.5));
      }
      rawLum[i] = l;
    }
  }

  // 3. Optional Smoothing/Blur
  const lum = new Float32Array(w * h);
  if (blurRadius > 0) {
    boxBlur1D(rawLum, lum, w, h, Math.min(4, Math.floor(blurRadius)));
  } else {
    lum.set(rawLum);
  }

  // Luminance sample helper with clamped borders
  const getL = (x, y) => {
    const cx = x < 0 ? 0 : (x >= w ? w - 1 : x);
    const cy = y < 0 ? 0 : (y >= h ? h - 1 : y);
    return lum[cy * w + cx];
  };

  // 4. Create Normal Map Canvas & ImageData
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const normCtx = normalCanvas.getContext('2d');
  const normImgData = normCtx.createImageData(w, h);
  const normData = normImgData.data;

  // 5. Sobel Filter & Tangent Normal Calculation
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = (rowOffset + x) * 4;
      const alpha = srcData[idx + 3];

      if (alpha < 10) {
        // Flat normal: (0, 0, 1) -> (128, 128, 255)
        normData[idx] = 128;
        normData[idx + 1] = 128;
        normData[idx + 2] = 255;
        normData[idx + 3] = alpha;
        continue;
      }

      // 3x3 Sobel Kernel
      const tl = getL(x - 1, y - 1);
      const t  = getL(x,     y - 1);
      const tr = getL(x + 1, y - 1);
      const l  = getL(x - 1, y);
      const r  = getL(x + 1, y);
      const bl = getL(x - 1, y + 1);
      const b  = getL(x,     y + 1);
      const br = getL(x + 1, y + 1);

      // Horizontal & vertical gradients
      const dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
      const dy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

      // Tangent space normal vector
      let nx = -dx * strength * (invertX ? -1.0 : 1.0);
      let ny = -dy * strength * (invertY ? -1.0 : 1.0);
      let nz = 1.0;

      // Normalize vector
      const len = Math.hypot(nx, ny, nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      // Pack [-1, 1] vector into [0, 255] RGB color
      normData[idx]     = Math.floor(((nx + 1.0) / 2.0) * 255);
      normData[idx + 1] = Math.floor(((ny + 1.0) / 2.0) * 255);
      normData[idx + 2] = Math.floor(((nz + 1.0) / 2.0) * 255);
      normData[idx + 3] = 255;
    }
  }

  normCtx.putImageData(normImgData, 0, 0);

  // Generate output Blob and File
  const blob = await new Promise((resolve) => normalCanvas.toBlob(resolve, 'image/png'));
  const cleanFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  const file = new File([blob], cleanFileName, { type: 'image/png' });
  const dataUrl = normalCanvas.toDataURL('image/png');

  return {
    canvas: normalCanvas,
    width: w,
    height: h,
    blob,
    file,
    dataUrl
  };
}

/**
 * High-level helper that converts an uploaded image File into a normal map File
 * @param {File} file 
 * @param {Object} [options]
 * @returns {Promise<File>}
 */
export async function convertImageFileToNormalMap(file, options = {}) {
  const baseName = (file.name || 'image').replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}_normal.png`;
  const result = await generateNormalMap(file, {
    ...options,
    fileName: outFileName
  });
  return result.file;
}

/**
 * Inspects an image source to check whether it appears to already be a normal map.
 * In tangent-space normal maps, blue is dominant (> 128) and red/green hover near 128.
 * @param {string|Blob|File|HTMLImageElement} source
 * @returns {Promise<boolean>}
 */
export async function isLikelyNormalMap(source) {
  try {
    const img = await loadImage(source);
    const canvas = document.createElement('canvas');
    const sampleSize = 64;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    let normalPixels = 0;
    const totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < totalPixels * 4; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];

      if (a > 30) {
        // Tangent space normal map signature:
        // Blue is dominant (z component >= 0, mapped to [128, 255])
        // Red and green are centered around 128 (x, y components [-1, 1])
        if (b > 120 && b >= r && b >= g && r >= 50 && r <= 205 && g >= 50 && g <= 205) {
          normalPixels++;
        }
      }
    }

    return (normalPixels / totalPixels) > 0.65;
  } catch {
    return false;
  }
}

export const NORMAL_MAP_PRESETS = [
  { id: 'subtle', name: 'Subtle', desc: 'Fabrics, paper, satin', strength: 1.5, blurRadius: 1, invertY: false },
  { id: 'standard', name: 'Standard', desc: 'Wood, drywall, metal', strength: 3.0, blurRadius: 0, invertY: false },
  { id: 'sharp', name: 'Sharp Detail', desc: 'Tiles, carvings, tech patterns', strength: 5.0, blurRadius: 0, invertY: false },
  { id: 'deep', name: 'Deep Relief', desc: 'Brick, cobblestone, rough leather', strength: 7.5, blurRadius: 0, invertY: false },
  { id: 'directx', name: 'Inverted Y', desc: 'DirectX format (inverted green)', strength: 3.0, blurRadius: 0, invertY: true }
];
