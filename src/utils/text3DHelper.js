import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

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
 * Creates an extruded 3D Text Geometry.
 */
export function create3DTextGeometry(text, options = {}, font, THREE_LIB = THREE) {
  const size = Number(options.size) > 0 ? Number(options.size) : 0.35;
  const depth = Number(options.depth) > 0 ? Number(options.depth) : 0.08;
  const curveSegments = Number(options.curveSegments) || 12;
  const bevelEnabled = options.bevelEnabled !== false;
  const bevelThickness = options.bevelThickness !== undefined ? Number(options.bevelThickness) : 0.015;
  const bevelSize = options.bevelSize !== undefined ? Number(options.bevelSize) : 0.01;
  const bevelSegments = Number(options.bevelSegments) || 4;

  const geom = new TextGeometry(String(text || 'STAR weAR'), {
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

  geom.computeBoundingBox();

  const align = options.align || 'center';
  if (align === 'center') {
    geom.center();
  } else if (align === 'right' && geom.boundingBox) {
    const width = geom.boundingBox.max.x - geom.boundingBox.min.x;
    geom.translate(-width, 0, 0);
  }

  return geom;
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
