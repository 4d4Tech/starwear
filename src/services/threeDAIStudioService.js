import * as THREE from 'three';

// ============================================================================
// 3DAI STUDIO (https://www.3daistudio.com/) MODEL DEFINITIONS & ARCHITECTURE
// ============================================================================
export const THREE_DAI_MODELS = [
  {
    id: 'studio-neural',
    name: 'Studio Neural Volume (Built-In)',
    badge: 'Instant / No Key Needed',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
    description: 'Client-side Monster Mash Poisson membrane inflation with internal crease carving, normal displacement, and cavity AO baking.',
    speed: 'Instant (< 2s)',
    provider: 'Star weAR + 3DAI Pipeline',
    endpoint: 'local',
    icon: 'auto_awesome',
    recommended: true
  },
  {
    id: 'trellis-2',
    name: 'Microsoft TRELLIS.2',
    badge: 'Sharp Geometry & PBR',
    badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
    description: '3D AI Studio flagship Structured Latent 3D engine with 1024-voxel resolution, crisp contours, and embedded PBR materials.',
    speed: '25-35s',
    provider: '3D AI Studio / Microsoft Trellis',
    endpoint: 'v1/3d-models/trellis2/generate/',
    icon: 'polyline',
    cloudRecommended: true
  },
  {
    id: 'hunyuan-3d',
    name: 'Tencent Hunyuan 3.1 Pro',
    badge: 'Production 8K PBR',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-500/40',
    description: 'Two-stage multi-view diffusion model generating production-ready .GLB models with embedded high-res PBR material maps.',
    speed: '2-4 mins',
    provider: '3D AI Studio / Tencent Hunyuan',
    endpoint: 'v1/3d-models/tencent/generate/pro/',
    icon: 'palette'
  },
  {
    id: 'tripo-p1',
    name: 'Tripo P1 Game-Ready',
    badge: 'Clean Quad Topology',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-500/40',
    description: 'Premium clean quad-dominant topology with viewpoint orientation alignment, ideal for WebAR and interactive gaming.',
    speed: '30-50s',
    provider: '3D AI Studio / Tripo P1',
    endpoint: 'v1/3d-models/tripo/image-to-3d/p1/',
    icon: 'sports_esports'
  },
  {
    id: 'tripo-standard',
    name: 'Tripo 3.1 Standard',
    badge: 'Fast Remeshing',
    badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
    description: 'Rapid turnaround 3D generation with optional quad remeshing and intelligent low-poly mesh reduction.',
    speed: '20-40s',
    provider: '3D AI Studio / Tripo',
    endpoint: 'v1/3d-models/tripo/image-to-3d/',
    icon: 'bolt'
  },
  {
    id: 'hunyuan-rapid',
    name: 'Tencent Hunyuan Rapid',
    badge: 'Rapid Prototyping',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-500/40',
    description: 'Streamlined rapid edition for fast concept exploration and immediate asset prototyping.',
    speed: '40-60s',
    provider: '3D AI Studio / Tencent Hunyuan',
    endpoint: 'v1/3d-models/tencent/generate/rapid/',
    icon: 'speed'
  }
];

// ============================================================================
// 1. TANGENT-SPACE PBR NORMAL, ROUGHNESS, & CAVITY AO MAP SYNTHESIS
// ============================================================================
export function generatePBRMaps(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const ctx = sourceCanvas.getContext('2d');
  const srcImgData = ctx.getImageData(0, 0, w, h);
  const srcData = srcImgData.data;

  // 1. Normal Map Canvas
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const normCtx = normalCanvas.getContext('2d');
  const normImgData = normCtx.createImageData(w, h);
  const normData = normImgData.data;

  // 2. Roughness & Metalness Canvas
  const pbrCanvas = document.createElement('canvas');
  pbrCanvas.width = w;
  pbrCanvas.height = h;
  const pbrCtx = pbrCanvas.getContext('2d');
  const pbrImgData = pbrCtx.createImageData(w, h);
  const pbrData = pbrImgData.data;

  // 3. Ambient Occlusion / Cavity Canvas
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = w;
  aoCanvas.height = h;
  const aoCtx = aoCanvas.getContext('2d');
  const aoImgData = aoCtx.createImageData(w, h);
  const aoData = aoImgData.data;

  // Luminance helper
  const getLum = (x, y) => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    const idx = (cy * w + cx) * 4;
    const a = srcData[idx + 3];
    if (a < 20) return 0;
    return (0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2]) / 255;
  };

  const strength = 3.0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = srcData[idx + 3];

      if (alpha < 20) {
        // Flat normal pointing straight out (0.5, 0.5, 1.0) -> RGB(128, 128, 255)
        normData[idx] = 128;
        normData[idx + 1] = 128;
        normData[idx + 2] = 255;
        normData[idx + 3] = 0;

        pbrData[idx] = 200;
        pbrData[idx + 1] = 0;
        pbrData[idx + 2] = 0;
        pbrData[idx + 3] = 0;

        aoData[idx] = 255;
        aoData[idx + 1] = 255;
        aoData[idx + 2] = 255;
        aoData[idx + 3] = 0;
        continue;
      }

      // Sobel kernel filter for gradient (dX, dY)
      const tl = getLum(x - 1, y - 1);
      const t  = getLum(x, y - 1);
      const tr = getLum(x + 1, y - 1);
      const l  = getLum(x - 1, y);
      const r  = getLum(x + 1, y);
      const bl = getLum(x - 1, y + 1);
      const b  = getLum(x, y + 1);
      const br = getLum(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      // Normal vector in tangent space: (-dx * strength, -dy * strength, 1.0) normalized
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      // Map [-1, 1] to [0, 255]
      normData[idx]     = Math.floor(((nx + 1) / 2) * 255);
      normData[idx + 1] = Math.floor(((ny + 1) / 2) * 255);
      normData[idx + 2] = Math.floor(((nz + 1) / 2) * 255);
      normData[idx + 3] = 255;

      // PBR Roughness & Metallic Estimation:
      const lum = getLum(x, y);
      const roughnessVal = Math.min(255, Math.max(40, Math.floor((1.0 - lum * 0.45) * 210)));
      const rCol = srcData[idx];
      const gCol = srcData[idx + 1];
      const bCol = srcData[idx + 2];
      const maxCol = Math.max(rCol, gCol, bCol);
      const minCol = Math.min(rCol, gCol, bCol);
      const sat = maxCol > 0 ? (maxCol - minCol) / maxCol : 0;
      const metalnessVal = (lum > 0.72 && sat < 0.22) ? 190 : 20;

      // Cavity & Contact Shadow estimation from surface curvature
      const gradMag = Math.sqrt(dx * dx + dy * dy);
      const aoVal = Math.max(70, Math.min(255, Math.floor(255 - gradMag * 140 * (1.1 - lum))));

      pbrData[idx]     = roughnessVal;
      pbrData[idx + 1] = metalnessVal;
      pbrData[idx + 2] = aoVal;
      pbrData[idx + 3] = 255;

      aoData[idx]     = aoVal;
      aoData[idx + 1] = aoVal;
      aoData[idx + 2] = aoVal;
      aoData[idx + 3] = 255;
    }
  }

  normCtx.putImageData(normImgData, 0, 0);
  pbrCtx.putImageData(pbrImgData, 0, 0);
  aoCtx.putImageData(aoImgData, 0, 0);

  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.needsUpdate = true;

  const roughnessTexture = new THREE.CanvasTexture(pbrCanvas);
  roughnessTexture.needsUpdate = true;

  const aoTexture = new THREE.CanvasTexture(aoCanvas);
  aoTexture.needsUpdate = true;

  return {
    normalCanvas,
    normalTexture,
    normData,
    pbrCanvas,
    roughnessTexture,
    aoCanvas,
    aoTexture
  };
}

// ============================================================================
// 2. POISSON INFLATION PDE SOLVER (Monster Mash Harmonic Boundary Value Problem)
// ============================================================================
export function solvePoissonInflation(mask, resX, resY, iterations = 35) {
  const size = resX * resY;
  const Z = new Float32Array(size);
  const omega = 1.68; // Successive Over-Relaxation (SOR) parameter

  for (let it = 0; it < iterations; it++) {
    for (let y = 1; y < resY - 1; y++) {
      const yOffset = y * resX;
      for (let x = 1; x < resX - 1; x++) {
        const idx = yOffset + x;
        if (mask[idx] !== 1) continue;

        // Dirichlet boundary condition: Z = 0 if any 4-neighbor is outside mask
        if (
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - resX] === 0 ||
          mask[idx + resX] === 0
        ) {
          Z[idx] = 0;
          continue;
        }

        // Discrete Poisson: ∇²Z = -1 => Z[x,y] = 0.25 * (Z_neighbors + 1.0)
        const target = 0.25 * (Z[idx + 1] + Z[idx - 1] + Z[idx + resX] + Z[idx - resX] + 1.0);
        Z[idx] += omega * (target - Z[idx]);
      }
    }
  }

  // Normalize Z to [0, 1]
  let maxZ = 0.0001;
  for (let i = 0; i < size; i++) {
    if (mask[i] === 1 && Z[i] > maxZ) maxZ = Z[i];
  }
  for (let i = 0; i < size; i++) {
    if (mask[i] === 1) {
      Z[i] = Z[i] / maxZ;
      // Elliptic spherical curvature transformation
      Z[i] = Math.sqrt(Math.max(0, 1.0 - Math.pow(1.0 - Z[i], 2)));
    } else {
      Z[i] = 0;
    }
  }

  return Z;
}

// ============================================================================
// 3. MESO-SCALE INTERNAL CREASE, RIDGE & VALLEYS EXTRACTION
// ============================================================================
export function extractInternalCreases(srcData, srcW, srcH, resX, resY) {
  const size = resX * resY;
  const valleys = new Float32Array(size);
  const highlights = new Float32Array(size);

  const getLumAt = (gx, gy) => {
    const sx = Math.max(0, Math.min(srcW - 1, Math.floor((gx / (resX - 1)) * (srcW - 1))));
    const sy = Math.max(0, Math.min(srcH - 1, Math.floor((gy / (resY - 1)) * (srcH - 1))));
    const idx = (sy * srcW + sx) * 4;
    return (0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2]) / 255;
  };

  for (let y = 1; y < resY - 1; y++) {
    for (let x = 1; x < resX - 1; x++) {
      const idx = y * resX + x;
      const c = getLumAt(x, y);

      // Central differences
      const dx = (getLumAt(x + 1, y) - getLumAt(x - 1, y)) * 0.5;
      const dy = (getLumAt(x, y + 1) - getLumAt(x, y - 1)) * 0.5;
      const mag = Math.sqrt(dx * dx + dy * dy);

      // Dark creases (seams, clothing folds, eyelid contours, panel gaps)
      valleys[idx] = Math.min(1.0, mag * 2.8 * (1.15 - c));

      // Specular / structural highlights = ridge elevation
      highlights[idx] = Math.max(0, (c - 0.45) / 0.55);
    }
  }

  return { valleys, highlights };
}

// ============================================================================
// 4. MICRO-SCALE TANGENT NORMAL TO HEIGHT INTEGRATION (Poisson Normal Integration)
// ============================================================================
export function integrateNormalsToHeight(normData, normW, normH, mask, resX, resY, iterations = 25) {
  const size = resX * resY;
  const relief = new Float32Array(size);
  const div = new Float32Array(size);

  const getNormalAt = (gx, gy) => {
    const sx = Math.max(0, Math.min(normW - 1, Math.floor((gx / (resX - 1)) * (normW - 1))));
    const sy = Math.max(0, Math.min(normH - 1, Math.floor((gy / (resY - 1)) * (normH - 1))));
    const idx = (sy * normW + sx) * 4;
    const nx = (normData[idx] / 255) * 2.0 - 1.0;
    const ny = (normData[idx + 1] / 255) * 2.0 - 1.0;
    const nz = Math.max(0.1, (normData[idx + 2] / 255) * 2.0 - 1.0);
    return { p: -nx / nz, q: -ny / nz };
  };

  // Compute divergence of normal vector gradients: div = dp/dx + dq/dy
  for (let y = 1; y < resY - 1; y++) {
    for (let x = 1; x < resX - 1; x++) {
      const idx = y * resX + x;
      if (mask[idx] !== 1) continue;

      const pRight = getNormalAt(x + 1, y).p;
      const pLeft  = getNormalAt(x - 1, y).p;
      const qDown  = getNormalAt(x, y + 1).q;
      const qUp    = getNormalAt(x, y - 1).q;

      div[idx] = (pRight - pLeft) * 0.5 + (qDown - qUp) * 0.5;
    }
  }

  // Solve ∇²Z_relief = div with SOR relaxation
  const omega = 1.6;
  for (let it = 0; it < iterations; it++) {
    for (let y = 1; y < resY - 1; y++) {
      const yOffset = y * resX;
      for (let x = 1; x < resX - 1; x++) {
        const idx = yOffset + x;
        if (mask[idx] !== 1) continue;
        if (
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - resX] === 0 ||
          mask[idx + resX] === 0
        ) {
          relief[idx] = 0;
          continue;
        }

        const target = 0.25 * (relief[idx + 1] + relief[idx - 1] + relief[idx + resX] + relief[idx - resX] - div[idx] * 0.4);
        relief[idx] += omega * (target - relief[idx]);
      }
    }
  }

  // High-pass clamp relief to [-1, 1] range to avoid runaway global tilt
  let maxRelief = 0.001;
  for (let i = 0; i < size; i++) {
    if (mask[i] === 1) {
      const r = Math.abs(relief[i]);
      if (r > maxRelief) maxRelief = r;
    }
  }
  for (let i = 0; i < size; i++) {
    if (mask[i] === 1) {
      relief[i] = Math.max(-1.0, Math.min(1.0, relief[i] / maxRelief));
    } else {
      relief[i] = 0;
    }
  }

  return relief;
}

// ============================================================================
// 5. 3DAI STUDIO REFINED VOLUMETRIC 3D MESH GENERATOR (Client-Side)
// ============================================================================
export function generateVolumetric3DMesh({
  extractedCanvas,
  maskGrid,
  segW,
  segH,
  origW,
  origH,
  fabricMaterialManager,
  depthInflation = 1.0,
  featureRelief = 0.6, // Internal creases and micro-detail relief intensity
  polyQuality = 'standard', // 'low' | 'standard' | 'high'
  symmetry = true
}) {
  // 1. Determine Grid Resolution
  let resX = 72;
  let resY = 72;
  if (polyQuality === 'low') {
    resX = 48;
    resY = 48;
  } else if (polyQuality === 'high') {
    resX = 100;
    resY = 100;
  }

  // 2. Resample Mask & Compute Boundary Distance Field
  const mask = new Uint8Array(resX * resY);
  const distMap = new Float32Array(resX * resY);

  for (let gy = 0; gy < resY; gy++) {
    const sy = Math.floor((gy / (resY - 1)) * (segH - 1));
    for (let gx = 0; gx < resX; gx++) {
      const sx = Math.floor((gx / (resX - 1)) * (segW - 1));
      const sIdx = sy * segW + sx;
      mask[gy * resX + gx] = maskGrid[sIdx] === 1 ? 1 : 0;
    }
  }

  for (let gy = 0; gy < resY; gy++) {
    for (let gx = 0; gx < resX; gx++) {
      const gIdx = gy * resX + gx;
      if (mask[gIdx] === 1) {
        let dMin = 999;
        const r = 10;
        for (let dy = -r; dy <= r; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= resY) { dMin = Math.min(dMin, Math.abs(dy)); continue; }
          for (let dx = -r; dx <= r; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= resX || mask[ny * resX + nx] === 0) {
              const d = Math.hypot(dx, dy);
              if (d < dMin) dMin = d;
            }
          }
        }
        distMap[gIdx] = dMin;
      } else {
        distMap[gIdx] = 0;
      }
    }
  }

  // 3. Multi-Scale Depth Synthesis:
  // (a) Macro Volumetric Envelope via Monster Mash Poisson Solver
  const Z_macro = solvePoissonInflation(mask, resX, resY, 35);

  // (b) Meso-Scale Internal Crease & Highlight Analysis
  const srcCtx = extractedCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, origW, origH).data;
  const { valleys, highlights } = extractInternalCreases(srcData, origW, origH, resX, resY);

  // (c) Tangent PBR Normal, Roughness, and Cavity AO Maps
  const { normalTexture, roughnessTexture, aoTexture, normData } = generatePBRMaps(extractedCanvas);

  // (d) Micro-Scale Normal-to-Depth Integration
  const Z_relief = integrateNormalsToHeight(normData, origW, origH, mask, resX, resY, 25);

  // 4. Fuse Multi-Scale Depth Field
  const worldScale = 4.2 / Math.max(origW, origH);
  const worldW = origW * worldScale;
  const worldH = origH * worldScale;
  const maxZ = (worldW * 0.28) * depthInflation;

  const frontDepth = new Float32Array(resX * resY);
  const backDepth = new Float32Array(resX * resY);

  for (let i = 0; i < resX * resY; i++) {
    if (mask[i] === 1) {
      const edgeTaper = Math.min(1.0, distMap[i] / 2.2);

      // Front depth combines:
      // - Macro Poisson organic volume
      // - Internal crease depressions (seams, folds, contours)
      // - Highlight peaks
      // - High-frequency normal integrated relief
      const featureModulation = 1.0 - (0.35 * valleys[i] * featureRelief) + (0.20 * highlights[i] * featureRelief);
      const reliefModulation = 0.22 * Z_relief[i] * featureRelief;

      const zF = Math.max(0.01, Z_macro[i] * featureModulation + reliefModulation);
      frontDepth[i] = zF * edgeTaper * maxZ;

      // Back shell: smooth anatomical support hull
      const backScale = symmetry ? 0.95 : 0.65;
      backDepth[i] = -Z_macro[i] * edgeTaper * maxZ * backScale;
    } else {
      frontDepth[i] = 0;
      backDepth[i] = 0;
    }
  }

  // 5. Feature-Preserving Laplacian Mesh Smoothing on Front Shell Interior
  const smoothFront = new Float32Array(frontDepth);
  for (let pass = 0; pass < 2; pass++) {
    for (let gy = 1; gy < resY - 1; gy++) {
      for (let gx = 1; gx < resX - 1; gx++) {
        const idx = gy * resX + gx;
        if (mask[idx] !== 1 || distMap[idx] <= 1.2) continue; // Keep boundary pinned!

        const avg = 0.25 * (smoothFront[idx - 1] + smoothFront[idx + 1] + smoothFront[idx - resX] + smoothFront[idx + resX]);
        smoothFront[idx] = smoothFront[idx] + 0.22 * (avg - smoothFront[idx]);
      }
    }
  }

  // 6. Assemble Closed Watertight 360° Geometry
  const vertices = [];
  const uvs = [];
  const indices = [];

  const frontIndices = new Int32Array(resX * resY).fill(-1);
  const backIndices = new Int32Array(resX * resY).fill(-1);

  // Front vertices
  for (let gy = 0; gy < resY; gy++) {
    for (let gx = 0; gx < resX; gx++) {
      const gIdx = gy * resX + gx;
      if (mask[gIdx] === 1) {
        const u = gx / (resX - 1);
        const v = 1.0 - (gy / (resY - 1));
        const x = (u - 0.5) * worldW;
        const y = (v - 0.5) * worldH;
        const z = smoothFront[gIdx];

        frontIndices[gIdx] = vertices.length / 3;
        vertices.push(x, y, z);
        uvs.push(u, v);
      }
    }
  }

  // Back vertices
  for (let gy = 0; gy < resY; gy++) {
    for (let gx = 0; gx < resX; gx++) {
      const gIdx = gy * resX + gx;
      if (mask[gIdx] === 1) {
        const u = gx / (resX - 1);
        const v = 1.0 - (gy / (resY - 1));
        const x = (u - 0.5) * worldW;
        const y = (v - 0.5) * worldH;
        const z = backDepth[gIdx];

        backIndices[gIdx] = vertices.length / 3;
        vertices.push(x, y, z);
        // Mirrored UV X for back so textures don't reverse
        uvs.push(1.0 - u, v);
      }
    }
  }

  // Triangulate Front and Back Shells
  for (let gy = 0; gy < resY - 1; gy++) {
    for (let gx = 0; gx < resX - 1; gx++) {
      const i00 = frontIndices[gy * resX + gx];
      const i10 = frontIndices[gy * resX + (gx + 1)];
      const i01 = frontIndices[(gy + 1) * resX + gx];
      const i11 = frontIndices[(gy + 1) * resX + (gx + 1)];

      // Front Face Triangles (CCW)
      if (i00 !== -1 && i10 !== -1 && i01 !== -1 && i11 !== -1) {
        indices.push(i00, i01, i10);
        indices.push(i10, i01, i11);
      }

      // Back Face Triangles (CW when viewed from front, CCW when viewed from back)
      const b00 = backIndices[gy * resX + gx];
      const b10 = backIndices[gy * resX + (gx + 1)];
      const b01 = backIndices[(gy + 1) * resX + gx];
      const b11 = backIndices[(gy + 1) * resX + (gx + 1)];

      if (b00 !== -1 && b10 !== -1 && b01 !== -1 && b11 !== -1) {
        indices.push(b00, b10, b01);
        indices.push(b10, b11, b01);
      }
    }
  }

  // 7. Sew Edge / Perimeter Rim to make the manifold completely watertight
  for (let gy = 0; gy < resY; gy++) {
    for (let gx = 0; gx < resX; gx++) {
      const gIdx = gy * resX + gx;
      if (frontIndices[gIdx] === -1) continue;

      const neighbors = [
        { gx: gx + 1, gy: gy },
        { gx: gx, gy: gy + 1 },
        { gx: gx - 1, gy: gy },
        { gx: gx, gy: gy - 1 }
      ];

      neighbors.forEach((n) => {
        if (n.gx < 0 || n.gx >= resX || n.gy < 0 || n.gy >= resY || frontIndices[n.gy * resX + n.gx] === -1) {
          const f0 = frontIndices[gIdx];
          const b0 = backIndices[gIdx];

          const nextGX = (n.gy !== gy) ? gx + (n.gy > gy ? 1 : -1) : gx;
          const nextGY = (n.gx !== gx) ? gy + (n.gx > gx ? -1 : 1) : gy;
          if (nextGX >= 0 && nextGX < resX && nextGY >= 0 && nextGY < resY) {
            const nextIdx = nextGY * resX + nextGX;
            const f1 = frontIndices[nextIdx];
            const b1 = backIndices[nextIdx];
            if (f1 !== -1 && b1 !== -1) {
              indices.push(f0, b0, f1);
              indices.push(f1, b0, b1);
            }
          }
        }
      });
    }
  }

  // 8. Assemble Three.js BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // 9. Create Physical PBR Material with Cavity AO
  const albedoTexture = new THREE.CanvasTexture(extractedCanvas);
  albedoTexture.colorSpace = THREE.SRGBColorSpace;
  albedoTexture.needsUpdate = true;

  let material;
  if (fabricMaterialManager && typeof fabricMaterialManager.createFabricMaterial === 'function') {
    material = fabricMaterialManager.createFabricMaterial({
      map: albedoTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: roughnessTexture,
      aoMap: aoTexture,
      aoMapIntensity: 1.0,
      roughness: 0.65,
      metalness: 0.1,
      sheen: 0.5,
      sheenRoughness: 0.6,
      clearcoat: 0.1,
      side: THREE.DoubleSide
    });
  } else {
    material = new THREE.MeshPhysicalMaterial({
      map: albedoTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: roughnessTexture,
      aoMap: aoTexture,
      aoMapIntensity: 1.0,
      roughness: 0.65,
      metalness: 0.1,
      clearcoat: 0.1,
      side: THREE.DoubleSide
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Center on ground
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  mesh.position.x -= center.x;
  mesh.position.y -= bbox.min.y;
  mesh.position.z -= center.z;

  mesh.userData = {
    isGenerated: true,
    is3DAIStudioVolumetric: true,
    engine: 'Studio Neural Volume',
    depthInflation,
    featureRelief,
    polyQuality,
    materials: { lit: [material] },
    animate: false,
    rotationSpeed: 0.01,
    fabricProfile: 'cotton'
  };

  return {
    mesh,
    albedoTexture,
    normalTexture,
    roughnessTexture,
    aoTexture,
    triangleCount: indices.length / 3,
    vertexCount: vertices.length / 3
  };
}

// ============================================================================
// 3. 3DAI STUDIO CLOUD REST API CLIENT (https://api.3daistudio.com)
// ============================================================================
export function resolve3DAIEndpoint(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    // In local development or with proxy rewrite, route via /api-3daistudio to bypass browser CORS
    return `/api-3daistudio${cleanPath}`;
  }
  return `https://api.3daistudio.com${cleanPath}`;
}

const MODEL_ALIASES = {
  'prism-turbo': 'trellis-2',
  'prism-3': 'hunyuan-3d',
  'prism-3.1': 'hunyuan-3d',
  'tripo-p2': 'tripo-p1',
  'hunyuan-pro': 'hunyuan-3d',
  'tencent-pro': 'hunyuan-3d'
};

export async function generate3DWithCloudAPI({
  apiKey,
  imageFile,
  imageBase64,
  model = 'trellis-2',
  topology = 'standard',
  quality = 'high',
  onProgress = () => {}
}) {
  if (!apiKey) {
    throw new Error('3D AI Studio API Key is required for cloud model generation.');
  }

  onProgress({ status: 'PREPARING', message: 'Encoding image and conditioning inputs...' });

  // Prepare Base64 Data URL if file provided
  let b64 = imageBase64;
  if (!b64 && imageFile) {
    b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  const resolvedModelId = MODEL_ALIASES[model] || model;
  const modelDef = THREE_DAI_MODELS.find((m) => m.id === resolvedModelId) ||
                   THREE_DAI_MODELS.find((m) => m.id === 'trellis-2') ||
                   THREE_DAI_MODELS[1];
  const relativeEndpoint = modelDef.endpoint || 'v1/3d-models/trellis2/generate/';
  const endpoint = resolve3DAIEndpoint(relativeEndpoint);

  onProgress({ status: 'SUBMITTING', message: `Dispatching task to 3DAI Studio [${modelDef.name}]...` });

  // Adapt payload schema to specific 3D AI Studio engine requirements
  let payload = {};
  if (relativeEndpoint.includes('trellis2')) {
    payload = {
      image: b64,
      resolution: quality === 'ultra' ? '1536' : '1024',
      steps: 12,
      textures: true,
      texture_size: quality === 'ultra' ? 4096 : 2048,
      decimation_target: topology === 'low' ? 100000 : 800000,
      generate_thumbnail: false
    };
  } else if (relativeEndpoint.includes('tencent/generate/pro')) {
    payload = {
      model: '3.1',
      image: b64,
      enable_pbr: true,
      face_count: topology === 'low' ? 80000 : 500000,
      generate_type: topology === 'low' ? 'LowPoly' : 'Normal',
      polygon_type: topology === 'quad' ? 'quadrilateral' : 'triangle'
    };
  } else if (relativeEndpoint.includes('tencent/generate/rapid')) {
    payload = {
      image: b64,
      enable_pbr: true,
      enable_geometry: true
    };
  } else if (relativeEndpoint.includes('tripo/image-to-3d/p1')) {
    payload = {
      image: b64,
      texture: true,
      pbr: true,
      orientation: 'align_image'
    };
  } else if (relativeEndpoint.includes('tripo/image-to-3d')) {
    payload = {
      image: b64,
      texture: true,
      pbr: true,
      quad: topology === 'quad',
      texture_quality: quality === 'ultra' ? 'detailed' : 'standard',
      geometry_quality: 'detailed'
    };
  } else {
    payload = {
      image: b64,
      texture: true,
      pbr: true
    };
  }

  const safeFetch = async (url, options) => {
    try {
      return await fetch(url, options);
    } catch (fetchErr) {
      if (url.startsWith('/api-3daistudio/')) {
        const directUrl = url.replace('/api-3daistudio', 'https://api.3daistudio.com');
        return await fetch(directUrl, options);
      }
      throw fetchErr;
    }
  };

  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error || errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      if (errorJson.error_code) {
        errorDetail += ` [${errorJson.error_code}]`;
      }
    } catch {
      const errorText = await response.text();
      errorDetail = errorText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    }
    throw new Error(`3DAI Studio API Error (${response.status}): ${errorDetail || response.statusText}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.id || data.requestId;
  if (!taskId) {
    if (Array.isArray(data.results) && data.results[0]?.asset) {
      return data.results[0].asset;
    }
    if (data.glb_url || data.model_url) {
      return data.glb_url || data.model_url;
    }
    throw new Error(data.error || 'No task ID received from 3DAI Studio API.');
  }

  onProgress({ status: 'PROCESSING', message: `Task ${taskId} queued. Synthesizing 3D geometry...` });

  // Poll status endpoint
  const statusEndpoint = resolve3DAIEndpoint(`v1/generation-request/${taskId}/status/`);
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 3000));
    attempts++;

    try {
      const statusRes = await safeFetch(statusEndpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Accept': 'application/json'
        }
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const currentStatus = (statusData.status || '').toUpperCase();

        if (currentStatus === 'FINISHED' || currentStatus === 'SUCCESS' || currentStatus === 'COMPLETED') {
          let downloadUrl = null;
          if (Array.isArray(statusData.results) && statusData.results.length > 0) {
            const modelResult = statusData.results.find((r) => r.asset_type === '3D_MODEL' || (r.asset && r.asset.includes('.glb'))) || statusData.results[0];
            downloadUrl = modelResult?.asset;
          }
          if (!downloadUrl) {
            downloadUrl = statusData.glb_url || statusData.model_url || statusData.output?.glb || statusData.result?.url || statusData.asset;
          }

          if (!downloadUrl) {
            throw new Error('3D AI Studio generation completed, but no model asset URL was returned in results.');
          }

          onProgress({ status: 'DOWNLOADING', message: 'Downloading compiled .GLB asset...' });

          // Try downloading as Blob to avoid third-party CDN CORS restrictions
          try {
            const glbRes = await fetch(downloadUrl);
            if (glbRes.ok) {
              const blob = await glbRes.blob();
              return URL.createObjectURL(blob);
            }
          } catch {
            // Fallback to direct URL if fetch fails
          }

          return downloadUrl;
        } else if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
          const failReason = statusData.failure_reason || statusData.error || statusData.message || '3D AI Studio generation failed.';
          throw new Error(`3DAI Studio Generation Failed: ${failReason}`);
        } else {
          onProgress({
            status: 'PROCESSING',
            message: `Synthesizing 3D Mesh (${statusData.progress || Math.min(95, attempts * 2)}%)...`
          });
        }
      }
    } catch (pollErr) {
      console.warn('Polling notice:', pollErr);
    }
  }

  throw new Error('3D AI Studio generation timed out. Please check your dashboard on 3daistudio.com.');
}
