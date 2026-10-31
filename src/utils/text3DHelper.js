import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hasNaNPositions } from './inflationEngine.js';

export const AVAILABLE_FONTS = [
  { id: 'helvetiker_bold', name: 'Helvetiker Bold (Modern)', file: '/fonts/helvetiker_bold.typeface.json' },
  { id: 'helvetiker_regular', name: 'Helvetiker Regular', file: '/fonts/helvetiker_regular.typeface.json' },
  { id: 'optimer_bold', name: 'Optimer Bold (Geometric)', file: '/fonts/optimer_bold.typeface.json' },
  { id: 'optimer_regular', name: 'Optimer Regular', file: '/fonts/optimer_regular.typeface.json' },
  { id: 'gentilis_bold', name: 'Gentilis Bold (Chunky Display)', file: '/fonts/gentilis_bold.typeface.json' },
  { id: 'gentilis_regular', name: 'Gentilis Regular', file: '/fonts/gentilis_regular.typeface.json' }
];

export const TEXT_MATERIAL_PRESETS = [
  { id: 'neon_cyan', name: 'Neon Cyber Cyan', color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 },
  { id: 'gold_metallic', name: '24K Polished Gold', color: '#f59e0b', emissive: '#78350f', emissiveIntensity: 0.2, metalness: 0.95, roughness: 0.15 },
  { id: 'obsidian_chrome', name: 'Obsidian Chrome', color: '#18181b', emissive: '#000000', emissiveIntensity: 0.0, metalness: 0.9, roughness: 0.1 },
  { id: 'crimson_glow', name: 'Crimson Glow', color: '#f43f5e', emissive: '#9f1239', emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 },
  { id: 'emerald_matrix', name: 'Emerald Matrix', color: '#10b981', emissive: '#065f46', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.25 },
  { id: 'titanium_white', name: 'Titanium White', color: '#f8fafc', emissive: '#000000', emissiveIntensity: 0.0, metalness: 0.3, roughness: 0.3 }
];

const fontCache = new Map();
const fontLoader = new FontLoader();

/**
 * Loads a typeface JSON font and caches it.
 * @param {string} fontId
 * @returns {Promise<THREE.Font>}
 */
export async function loadTypefaceFont(fontId = 'helvetiker_bold') {
  if (fontCache.has(fontId)) {
    return fontCache.get(fontId);
  }

  const def = AVAILABLE_FONTS.find((f) => f.id === fontId) || AVAILABLE_FONTS[0];
  const url = def.file;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching font ${url}`);
    const json = await res.json();
    const parsedFont = fontLoader.parse(json);
    fontCache.set(fontId, parsedFont);
    return parsedFont;
  } catch (err) {
    console.warn(`[text3DHelper] Failed to load font "${fontId}" from ${url}:`, err);
    // If specific font failed, attempt default helvetiker_bold
    if (fontId !== 'helvetiker_bold' && fontCache.has('helvetiker_bold')) {
      return fontCache.get('helvetiker_bold');
    }
    throw err;
  }
}

/**
 * Creates an extruded 3D Text Geometry, with native support for:
 * 1. Straight text layouts (left/center/right alignment)
 * 2. Curved & Arched path typography (curveRadius, startAngle, endAngle, letterSpacing)
 */
export function create3DTextGeometry(text, options = {}, font, THREE_LIB = THREE) {
  const size = Math.max(0.01, Number(options.size) || 0.35);
  const depth = Math.max(0.005, Number(options.depth) || 0.08);
  const curveSegments = Math.max(1, Number(options.curveSegments) || 12);
  const bevelEnabled = options.bevelEnabled !== false;
  const bevelThickness = Math.max(0, Number(options.bevelThickness) || 0.015);
  const bevelSize = Math.max(0, Math.min(Number(options.bevelSize) || 0.01, size * 0.25));
  const bevelSegments = Math.max(1, Number(options.bevelSegments) || 4);

  const curveRadius = options.curveRadius !== undefined && options.curveRadius !== null ? Number(options.curveRadius) : 0;
  const str = String(text || 'STAR weAR');

  // If curveRadius is specified and non-zero: Generate arched/curved path typography
  if (curveRadius !== 0 && !isNaN(curveRadius) && str.length > 0) {
    const chars = Array.from(str);
    const n = chars.length;
    const R = Math.abs(curveRadius);
    const letterSpacing = Number(options.letterSpacing) || 0;

    let startRad, endRad;
    const hasAngleSpan = options.startAngle !== undefined && options.endAngle !== undefined &&
      (Number(options.startAngle) !== 0 || Number(options.endAngle) !== 0);

    if (hasAngleSpan) {
      startRad = (Number(options.startAngle) * Math.PI) / 180;
      endRad = (Number(options.endAngle) * Math.PI) / 180;
    } else {
      // Calculate angular span based on font size and character count
      const approxCharWidth = size * 0.65 + letterSpacing;
      const totalSpan = Math.min(Math.PI * 1.8, Math.max(0.1, (n - 1) * (approxCharWidth / R)));
      startRad = -totalSpan / 2;
      endRad = totalSpan / 2;
    }

    const charGeoms = [];
    for (let i = 0; i < n; i++) {
      const char = chars[i];
      const theta = n === 1 ? (startRad + endRad) / 2 : startRad + (i / (n - 1)) * (endRad - startRad);

      if (char.trim() === '') {
        continue;
      }

      let charGeom = null;
      try {
        charGeom = new TextGeometry(char, {
          font: font,
          size: size,
          depth: depth,
          curveSegments: curveSegments,
          bevelEnabled: bevelEnabled,
          bevelThickness: bevelThickness,
          bevelSize: bevelSize,
          bevelOffset: 0,
          bevelSegments: bevelSegments
        });
        if (hasNaNPositions(charGeom)) {
          charGeom.dispose();
          charGeom = new TextGeometry(char, {
            font: font,
            size: size,
            depth: depth,
            curveSegments: curveSegments,
            bevelEnabled: false
          });
        }
      } catch (err) {
        console.warn(`[text3DHelper] Failed to generate character "${char}":`, err);
      }

      if (!charGeom || hasNaNPositions(charGeom)) {
        if (charGeom) charGeom.dispose();
        continue;
      }

      charGeom.center();

      let x, y, rotZ;
      if (curveRadius > 0) {
        // Positive curveRadius: Header rainbow arch (apex at y = 0)
        x = R * Math.sin(theta);
        y = R * (Math.cos(theta) - 1);
        rotZ = -theta;
      } else {
        // Negative curveRadius: Footer smile ribbon arch (trough at y = 0)
        x = R * Math.sin(theta);
        y = R * (1 - Math.cos(theta));
        rotZ = theta;
      }

      charGeom.rotateZ(rotZ);
      charGeom.translate(x, y, 0);
      charGeoms.push(charGeom);
    }

    if (charGeoms.length > 0) {
      try {
        const merged = mergeGeometries(charGeoms, false);
        charGeoms.forEach((g) => g.dispose());
        if (merged && !hasNaNPositions(merged)) {
          merged.computeBoundingBox();
          merged.computeVertexNormals();
          normalizeTextGeometryUVs(merged, THREE_LIB);
          return merged;
        }
      } catch (mergeErr) {
        console.warn('[text3DHelper] mergeGeometries fallback for curved text:', mergeErr);
      }
    }
  }

  // Standard straight line 3D TextGeometry
  let geom = null;
  try {
    geom = new TextGeometry(str, {
      font: font,
      size: size,
      depth: depth,
      curveSegments: curveSegments,
      bevelEnabled: bevelEnabled,
      bevelThickness: bevelThickness,
      bevelSize: bevelSize,
      bevelOffset: 0,
      bevelSegments: bevelSegments
    });
    if (hasNaNPositions(geom)) {
      if (geom) geom.dispose();
      geom = new TextGeometry(str, {
        font: font,
        size: size,
        depth: depth,
        curveSegments: curveSegments,
        bevelEnabled: false
      });
    }
  } catch (err) {
    console.warn('[text3DHelper] TextGeometry generation warning:', err);
  }

  if (!geom || hasNaNPositions(geom)) {
    if (geom) geom.dispose();
    geom = new THREE_LIB.BoxGeometry(size * 2, size, depth);
  }

  geom.computeBoundingBox();

  const align = options.align || 'center';
  if (align === 'center') {
    geom.center();
  } else if (align === 'right' && geom.boundingBox && isFinite(geom.boundingBox.min.x) && isFinite(geom.boundingBox.max.x)) {
    const width = geom.boundingBox.max.x - geom.boundingBox.min.x;
    geom.translate(-width, 0, 0);
  }

  normalizeTextGeometryUVs(geom, THREE_LIB);
  return geom;
}

function normalizeTextGeometryUVs(geom, THREE_LIB = THREE) {
  if (!geom || !geom.attributes?.position) return;
  try {
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb && isFinite(bb.min.x) && isFinite(bb.max.x) && isFinite(bb.min.y) && isFinite(bb.max.y)) {
      const rangeX = (bb.max.x - bb.min.x) || 1;
      const rangeY = (bb.max.y - bb.min.y) || 1;
      const pos = geom.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = (pos.getX(i) - bb.min.x) / rangeX;
        uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / rangeY;
      }
      geom.setAttribute('uv', new THREE_LIB.BufferAttribute(uvs, 2));
    }
  } catch { }
}

/**
 * Creates a complete 3D Text Mesh with standard PBR material.
 */
export function create3DTextMesh(config = {}, THREE_LIB = THREE, font) {
  if (!font) return null;

  const geom = create3DTextGeometry(config.text, config, font, THREE_LIB);

  const color = config.color || '#38bdf8';
  const roughness = config.roughness !== undefined ? Number(config.roughness) : 0.25;
  const metalness = config.metalness !== undefined ? Number(config.metalness) : 0.75;
  const emissive = config.emissive || '#000000';
  const emissiveIntensity = config.emissiveIntensity !== undefined ? Number(config.emissiveIntensity) : 0.0;
  const wireframe = Boolean(config.wireframe);

  const mat = new THREE_LIB.MeshStandardMaterial({
    color: new THREE_LIB.Color(color),
    roughness: roughness,
    metalness: metalness,
    emissive: new THREE_LIB.Color(emissive),
    emissiveIntensity: emissiveIntensity,
    wireframe: wireframe,
    side: THREE_LIB.DoubleSide
  });

  const mesh = new THREE_LIB.Mesh(geom, mat);
  mesh.name = config.name || `3D Text - ${config.text || 'STAR weAR'}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(
    Number(config.posX ?? 0),
    Number(config.posY ?? 0.6),
    Number(config.posZ ?? 0)
  );
  mesh.rotation.set(
    ((Number(config.rotX ?? 0)) * Math.PI) / 180,
    ((Number(config.rotY ?? 0)) * Math.PI) / 180,
    ((Number(config.rotZ ?? 0)) * Math.PI) / 180
  );

  const scale = Number(config.scale ?? 1);
  const sx = Number(config.scaleX ?? scale);
  const sy = Number(config.scaleY ?? scale);
  const sz = Number(config.scaleZ ?? scale);
  mesh.scale.set(sx, sy, sz);

  mesh.userData = {
    ...(config || {}),
    is3DText: true,
    textId: config.id,
    initialY: Number(config.posY ?? 0.6)
  };

  return mesh;
}

/**
 * Asynchronously loads fonts and builds a Three.js Group with all extruded 3D typography meshes.
 */
export async function create3DTextsGroup(texts = [], THREE_LIB = THREE) {
  const group = new THREE_LIB.Group();
  group.name = 'custom_3d_texts_group';
  if (!Array.isArray(texts) || texts.length === 0) return group;

  for (const item of texts) {
    if (!item || item.visible === false) continue;
    try {
      const font = await loadTypefaceFont(item.fontFamily || 'helvetiker_bold');
      const mesh = create3DTextMesh(item, THREE_LIB, font);
      if (mesh) {
        mesh.visible = item.visible !== false;
        group.add(mesh);
      }
    } catch (err) {
      console.warn('[text3DHelper] Failed to create 3D text mesh for item:', item, err);
    }
  }

  return group;
}

