// ============================================================================
// TRIPO 3D (https://www.tripo3d.ai/) API V3 SERVICE & P-SERIES PIPELINE
// ============================================================================

export const DEFAULT_TRIPO_KEY = 'tsk_QShUC3TpszkUUooFcHu2WoJaPS7e4pn6YEZAmvjwwCx';

export const TRIPO_P_MODELS = [
  {
    id: 'P2-20260801',
    name: 'Tripo P2 Smart Mesh',
    badge: 'Flagship Quad Topology',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-500/40',
    description: "Tripo's premier high-performance generative AI with clean quad-dominant topology, crisp UV unwrapping, and game-engine ready PBR materials.",
    speed: '25-45s',
    provider: 'Tripo3D (Official P-Series)',
    version: 'P2-20260801',
    supportsQuad: true,
    recommended: true,
    icon: 'sports_esports'
  },
  {
    id: 'P1-20260311',
    name: 'Tripo P1 Smart Mesh',
    badge: 'Fast Low-Poly',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-500/40',
    description: 'Low-poly topology optimized for mobile WebAR, rapid previews, and interactive real-time 3D garments.',
    speed: '20-35s',
    provider: 'Tripo3D (Official P-Series)',
    version: 'P1-20260311',
    supportsQuad: false,
    recommended: false,
    icon: 'bolt'
  },
  {
    id: 'v3.1-20260211',
    name: 'Tripo v3.1 Pro',
    badge: 'Ultra Fidelity',
    badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
    description: 'High-density organic geometric fidelity with multi-angle diffusion refinement and complex surface textures.',
    speed: '40-60s',
    provider: 'Tripo3D Foundation',
    version: 'v3.1-20260211',
    supportsQuad: false,
    recommended: false,
    icon: 'diamond'
  },
  {
    id: 'studio-neural',
    name: 'Studio Neural Volume (Built-In)',
    badge: 'Instant / Offline (0 Credits)',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    description: 'Client-side Monster Mash Poisson membrane inflation with internal crease carving, normal displacement, and cavity AO baking.',
    speed: 'Instant (< 2s)',
    provider: 'Star weAR Local Pipeline',
    version: 'local',
    supportsQuad: false,
    recommended: false,
    icon: 'auto_awesome'
  }
];

export function resolveTripoEndpoint(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    // In browser, route via /api-tripo proxy to eliminate CORS preflight blocks
    return `/api-tripo${cleanPath}`;
  }
  return `https://openapi.tripo3d.ai${cleanPath}`;
}

/**
 * Check credit balance with Tripo3D API
 */
export async function checkTripoBalance(apiKey = DEFAULT_TRIPO_KEY) {
  try {
    const key = (apiKey || DEFAULT_TRIPO_KEY).trim();
    const endpoint = resolveTripoEndpoint('/v3/account/balance');
    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.code === 0 && json.data) {
      return {
        balance: json.data.balance ?? 0,
        frozen: json.data.frozen ?? 0,
        success: true
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not query Tripo3D balance:', err);
    return null;
  }
}

/**
 * Upload an image file or canvas to Tripo3D /v3/files
 */
export async function uploadFileToTripo({
  apiKey = DEFAULT_TRIPO_KEY,
  file,
  canvas,
  onProgress = () => {}
}) {
  const key = (apiKey || DEFAULT_TRIPO_KEY).trim();
  onProgress({ status: 'UPLOADING', message: 'Uploading source image to Tripo3D cluster...' });

  let blob = file;
  let filename = file?.name || 'source_image.png';

  if (!blob && canvas) {
    blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    filename = 'segmented_foreground.png';
  }

  if (!blob) {
    throw new Error('No image file or canvas provided for Tripo3D upload.');
  }

  const formData = new FormData();
  formData.append('file', blob, filename);

  const uploadEndpoint = resolveTripoEndpoint('/v3/files');
  const res = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`
      // Note: Do NOT set Content-Type manually for FormData so browser sets correct boundary
    },
    body: formData
  });

  if (!res.ok) {
    let errDetail = '';
    try {
      const errJson = await res.json();
      errDetail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      const errText = await res.text();
      errDetail = errText.replace(/<[^>]+>/g, ' ').trim().slice(0, 200);
    }
    throw new Error(`Tripo3D Upload Error (${res.status}): ${errDetail || res.statusText}`);
  }

  const result = await res.json();
  if (result.code !== 0 || !result.data?.file_token) {
    throw new Error(result.message || result.suggestion || 'Failed to obtain file_token from Tripo3D.');
  }

  return {
    fileToken: result.data.file_token,
    fileExt: filename.split('.').pop().toLowerCase() || 'png'
  };
}

/**
 * Generate 3D model using Tripo3D API V3 and the P-series model
 */
export async function generate3DWithTripo({
  apiKey = DEFAULT_TRIPO_KEY,
  file,
  canvas,
  model = 'P2-20260801',
  topology = 'quad', // 'quad' | 'triangle'
  faceLimit = 50000,
  onProgress = () => {}
}) {
  const key = (apiKey || DEFAULT_TRIPO_KEY).trim();
  if (!key) {
    throw new Error('Tripo3D API Key is required. Please check tripod3d.md or enter your key.');
  }

  // 1. Upload file to obtain file_token
  const { fileToken, fileExt } = await uploadFileToTripo({
    apiKey: key,
    file,
    canvas,
    onProgress
  });

  // 2. Dispatch generation task
  const isP2 = model.includes('P2');
  onProgress({
    status: 'SUBMITTING',
    message: `Dispatching generation task to Tripo3D [${model}]${isP2 && topology === 'quad' ? ' with Quad Topology' : ''}...`
  });

  const taskPayload = {
    type: 'image_to_model',
    file: {
      type: fileExt === 'jpg' ? 'jpg' : fileExt === 'jpeg' ? 'jpeg' : fileExt === 'webp' ? 'webp' : 'png',
      file_token: fileToken
    },
    model_version: model
  };

  // Model-specific parameter adaptation
  const isPSeries = model.startsWith('P') || model.includes('P1') || model.includes('P2');
  if (isPSeries) {
    if (isP2 && topology === 'quad') {
      taskPayload.quad = true;
    }
    // Tripo P-series strictly requires face_limit to be between 50 and 20000
    if (faceLimit) {
      taskPayload.face_limit = Math.min(20000, Math.max(50, faceLimit));
    }
  } else if (faceLimit) {
    taskPayload.face_limit = Math.min(50000, Math.max(50, faceLimit));
  }

  const taskEndpoint = resolveTripoEndpoint('/v3/generation/image-to-model');
  const taskRes = await fetch(taskEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(taskPayload)
  });

  if (!taskRes.ok) {
    let errDetail = '';
    try {
      const errJson = await taskRes.json();
      errDetail = errJson.message || errJson.error || JSON.stringify(errJson);
      if (errJson.suggestion) errDetail += ` (${errJson.suggestion})`;
    } catch {
      const errText = await taskRes.text();
      errDetail = errText.replace(/<[^>]+>/g, ' ').trim().slice(0, 200);
    }
    throw new Error(`Tripo3D Generation Error (${taskRes.status}): ${errDetail || taskRes.statusText}`);
  }

  const taskData = await taskRes.json();
  const taskId = taskData.data?.task_id || taskData.task_id;
  if (!taskId) {
    throw new Error(taskData.message || taskData.suggestion || 'No task_id returned from Tripo3D API.');
  }

  onProgress({
    status: 'PROCESSING',
    message: `Task ${taskId} registered. Tripo3D P-Series AI synthesizing geometry & PBR maps...`
  });

  // 3. Poll task status until success or timeout
  const statusEndpoint = resolveTripoEndpoint(`/v3/tasks/${taskId}`);
  let attempts = 0;
  const maxAttempts = 120; // 120 * 2.5s = ~5 minutes maximum

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2500));
    attempts++;

    try {
      const pollRes = await fetch(statusEndpoint, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });

      if (pollRes.ok) {
        const pollData = await pollRes.json();
        const data = pollData.data || pollData;
        const currentStatus = (data.status || '').toLowerCase();

        if (currentStatus === 'success') {
          const output = data.output || {};
          const downloadUrl = output.model_url || output.model || output.pbr_model || output.glb;

          if (!downloadUrl) {
            throw new Error('Tripo3D task completed, but no model_url was provided in output.');
          }

          onProgress({ status: 'DOWNLOADING', message: 'Downloading compiled .GLB asset into scene...' });

          const proxyDownloadUrl = `/api-asset-proxy?url=${encodeURIComponent(downloadUrl)}`;

          // Ingest model into local browser Blob URL to avoid 5-minute CDN link expiration and bypass browser CORS
          try {
            const proxyRes = await fetch(proxyDownloadUrl);
            if (proxyRes.ok) {
              const blobData = await proxyRes.blob();
              return URL.createObjectURL(blobData);
            }
          } catch (proxyErr) {
            console.warn('Asset proxy fetch failed, attempting direct fetch:', proxyErr);
          }

          try {
            const glbRes = await fetch(downloadUrl);
            if (glbRes.ok) {
              const blobData = await glbRes.blob();
              return URL.createObjectURL(blobData);
            }
          } catch {
            // Both blob fetches failed, fallback to proxyDownloadUrl
          }

          return proxyDownloadUrl;
        } else if (currentStatus === 'failed') {
          const failMsg = data.message || data.error || 'Tripo3D model generation failed.';
          throw new Error(`Tripo3D Generation Failed: ${failMsg}`);
        } else {
          const progress = data.progress !== undefined ? data.progress : Math.min(95, attempts * 2);
          onProgress({
            status: 'PROCESSING',
            message: `Tripo3D P-Series AI Synthesizing 3D Mesh (${progress}%)...`
          });
        }
      }
    } catch (pollErr) {
      if (pollErr.message && pollErr.message.includes('Tripo3D Generation Failed')) {
        throw pollErr;
      }
      console.warn('Tripo3D polling retry notice:', pollErr);
    }
  }

  throw new Error('Tripo3D generation timed out after 5 minutes. Please check your dashboard on tripo3d.ai.');
}
