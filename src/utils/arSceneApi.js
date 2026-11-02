// src/utils/arSceneApi.js
/**
 * AR-Test Scene Constructor API Engine
 * Standardized specification, parser, validator, and applier for procedural
 * and multi-modal 3D AR scene generation via Google Gemini and LLMs.
 */

import { normalizeVectorPointsList } from './inflationEngine.js';

// =========================================================================
// 1. API SCHEMA SPECIFICATION CONSTANTS
// =========================================================================

export const AR_SCENE_API_VERSION = '1.1.0';

export const VALID_PRIMITIVE_TYPES = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'torusKnot',
  'capsule',
  'plane',
  'ring',
  'icosahedron',
  'dodecahedron',
  'tetrahedron',
  'vectorExtrude',
  'vectorInflate',
  'vectorRevolve',
  'vectorSweep',
  'vectorCarve'
];

export const VALID_SCENE_ENV_PRESETS = [
  'studio-chrome',
  'city',
  'sunset',
  'forest',
  'night',
  'cyber',
  'neutral',
  'none'
];

export const VALID_PROCEDURAL_PATTERNS = [
  'honeycomb',
  'carbon-fiber',
  'brushed-metal',
  'grid',
  'dots',
  'camo',
  'gingham',
  'checkerboard',
  'twill-crosshatch'
];

export const VALID_SCATTER_DISTRIBUTIONS = [
  'random',
  'grid',
  'hex-grid'
];

export const VALID_SCATTER_PROTOTYPES = [
  'leaf',
  'grass',
  'flower',
  'clover',
  'pine',
  'pebble',
  'crystal',
  'box',
  'sphere',
  'cone',
  'cylinder'
];

export const VALID_LIGHT_TYPES = [
  'point',
  'spot',
  'directional',
  'hemisphere'
];

export const VALID_FONT_FAMILIES = [
  'helvetiker_bold',
  'helvetiker_regular',
  'optimer_bold',
  'optimer_regular',
  'gentilis_bold',
  'gentilis_regular',
  'droid_sans_bold',
  'droid_sans_regular',
  'droid_serif_bold',
  'droid_serif_regular'
];

export const VALID_PARTICLE_PRESETS = [
  'cosmic-stardust',
  'mystic-fireflies',
  'amber-embers',
  'cyber-matrix',
  'cherry-blossom',
  'winter-snowfall',
  'golden-sparkles',
  'toxic-spores',
  'deep-ocean',
  'electric-storm'
];

export const VALID_PORTAL_PRESETS = [
  'cosmic-nebula',
  'cyber-grid',
  'emerald-forest',
  'sunset-horizon',
  'deep-ocean',
  'quantum-void'
];

// =========================================================================
// 2. RESILIENT JSON & LLM OUTPUT PARSER
// =========================================================================

/**
 * Extracts and parses JSON from raw input string, tolerating markdown code fences,
 * conversational prefix/suffix text, trailing commas, and single-quote anomalies.
 */
export function parseArSceneInput(rawInput) {
  if (!rawInput) {
    throw new Error('Input is empty. Please provide a JSON payload or Gemini output.');
  }

  let text = String(rawInput).trim();

  // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ...)
  const codeBlockMatch = text.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  } else {
    // If no code block, try finding the outermost curly braces { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  // Sanitize common LLM syntax slip-ups (trailing commas before } or ])
  const sanitized = text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1'); // Strip single and multiline comments

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // Secondary fallback: Try lenient evaluation of JavaScript object notation
    try {
      const fn = new Function(`return (${sanitized});`);
      const evaluated = fn();
      if (evaluated && typeof evaluated === 'object') {
        return evaluated;
      }
    } catch {
      // Throw original error with helpful hint
      throw new Error(`Invalid JSON format: ${err.message}. Please verify the payload syntax.`);
    }
    throw new Error(`Failed to parse scene JSON: ${err.message}`);
  }
}

// =========================================================================
// 3. VALIDATOR & NORMALIZER
// =========================================================================

/**
 * Validates the parsed payload against the AR-Test engine schema,
 * supplies defaults for missing fields, and returns statistics.
 */
export function validateArSceneInput(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Root payload must be a JSON object.'],
      warnings: [],
      normalizedData: null,
      stats: null
    };
  }

  // Look for nested payload inside "ar_scene", "arScene", or "ar_config"
  const root = data.ar_scene || data.arScene || data.ar_config || data.arConfig || data;

  const normalized = {
    metadata: {
      name: root.metadata?.name || root.name || 'AI Generated AR Scene',
      description: root.metadata?.description || root.description || 'Generated via Google Gemini AR-Test API',
      version: root.metadata?.version || AR_SCENE_API_VERSION,
      author: root.metadata?.author || 'Gemini Vision AI',
      createdAt: root.metadata?.createdAt || new Date().toISOString()
    },
    scene: {},
    transform: {},
    materials: {},
    shapes: [],
    scatterLayers: [],
    text3d: [],
    lighting: {},
    particles: null,
    portal: null,
    website: null,
    tracking: {},
    models: []
  };

  // 1. Scene Environment & Fog
  if (root.scene) {
    normalized.scene = {
      ambientColor: root.scene.ambientColor || root.ambientColor || '#ffffff',
      ambientIntensity: typeof root.scene.ambientIntensity === 'number' ? root.scene.ambientIntensity : 1.4,
      fogColor: root.scene.fogColor || root.fogColor || '#000000',
      fogDensity: typeof root.scene.fogDensity === 'number' ? root.scene.fogDensity : 0.0,
      cameraAutoRotate: Boolean(root.scene.cameraAutoRotate ?? root.cameraAutoRotate),
      envPreset: root.scene.envPreset || root.envPreset || 'none',
      envIntensity: typeof root.scene.envIntensity === 'number' ? root.scene.envIntensity : (typeof root.scene.hdrIntensity === 'number' ? root.scene.hdrIntensity : 1.0),
      exposure: typeof root.scene.exposure === 'number' ? root.scene.exposure : 1.1
    };
  }

  // 2. Root 3D Model Transform
  const t = root.transform || root.modelTransform || root;
  normalized.transform = {
    scale: typeof t.scale === 'number' ? t.scale : (typeof root.modelScale === 'number' ? root.modelScale : 0.4),
    posX: typeof t.posX === 'number' ? t.posX : (typeof root.modelPosX === 'number' ? root.modelPosX : 0),
    posY: typeof t.posY === 'number' ? t.posY : (typeof root.modelPosY === 'number' ? root.modelPosY : 0),
    posZ: typeof t.posZ === 'number' ? t.posZ : (typeof root.modelPosZ === 'number' ? root.modelPosZ : 0),
    rotX: typeof t.rotX === 'number' ? t.rotX : (typeof root.modelRotX === 'number' ? root.modelRotX : 90),
    rotY: typeof t.rotY === 'number' ? t.rotY : (typeof root.modelRotY === 'number' ? root.modelRotY : 0),
    rotZ: typeof t.rotZ === 'number' ? t.rotZ : (typeof root.modelRotZ === 'number' ? root.modelRotZ : 0)
  };

  // 3. Shapes & Procedural Geometries
  const incomingShapes = root.shapes || root.geometries || root.additionalGeometries || [];
  if (Array.isArray(incomingShapes)) {
    incomingShapes.forEach((s, idx) => {
      if (!s || typeof s !== 'object') return;
      const type = s.type || 'box';
      if (!VALID_PRIMITIVE_TYPES.includes(type)) {
        warnings.push(`Shape #${idx + 1} (${s.name || 'unnamed'}) specifies unrecognized type '${type}'. Defaulting to 'box'.`);
      }

      const shapeId = s.id || `geom_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;

      // Merge root-level shape attributes into params if placed directly on the shape
      const shapeParams = {
        ...(s.params && typeof s.params === 'object' ? s.params : {}),
        preserveOrigin: Boolean(s.preserveOrigin ?? s.params?.preserveOrigin),
        invertY: s.invertY !== undefined ? s.invertY : s.params?.invertY,
        svgPath: s.svgPath || s.params?.svgPath || s.svg || s.params?.svg,
        holes: s.holes || s.params?.holes || [],
        ...(s.points ? { points: s.points } : {}),
        ...(s.rawPoints ? { points: s.rawPoints } : {}),
        ...(s.frontPoints ? { frontPoints: s.frontPoints } : {}),
        ...(s.topSidePoints ? { topSidePoints: s.topSidePoints } : {}),
        ...(s.depth !== undefined ? { depth: s.depth } : {}),
        ...(s.radius !== undefined ? { radius: s.radius } : {}),
        ...(s.radiusTop !== undefined ? { radiusTop: s.radiusTop } : {}),
        ...(s.radiusBottom !== undefined ? { radiusBottom: s.radiusBottom } : {}),
        ...(s.width !== undefined ? { width: s.width } : {}),
        ...(s.height !== undefined ? { height: s.height } : {}),
        ...(s.taper !== undefined ? { taper: s.taper } : {}),
        ...(s.twist !== undefined ? { twist: s.twist } : {}),
        ...(s.bevelEnabled !== undefined ? { bevelEnabled: s.bevelEnabled } : {}),
        ...(s.bevelThickness !== undefined ? { bevelThickness: s.bevelThickness } : {}),
        ...(s.bevelSize !== undefined ? { bevelSize: s.bevelSize } : {}),
        ...(s.bevelOffset !== undefined ? { bevelOffset: s.bevelOffset } : {}),
        ...(s.bevelSegments !== undefined ? { bevelSegments: s.bevelSegments } : {}),
        ...(s.scaleFactor !== undefined ? { scaleFactor: s.scaleFactor } : {}),
        curveSegments: typeof (s.curveSegments ?? s.params?.curveSegments) === 'number' ? (s.curveSegments ?? s.params?.curveSegments) : 24,

        // Volumetric Inflation
        depthFront: s.depthFront !== undefined ? Number(s.depthFront) : (s.params?.depthFront !== undefined ? Number(s.params.depthFront) : undefined),
        depthBack: s.depthBack !== undefined ? Number(s.depthBack) : (s.params?.depthBack !== undefined ? Number(s.params.depthBack) : undefined),
        curvatureProfile: s.curvatureProfile || s.params?.curvatureProfile || s.profile || s.params?.profile || 'elliptic',
        symmetric: (s.symmetric ?? s.params?.symmetric) !== false,
        smoothPasses: typeof (s.smoothPasses ?? s.params?.smoothPasses) === 'number' ? (s.smoothPasses ?? s.params?.smoothPasses) : 2,
        resolution: typeof (s.resolution ?? s.params?.resolution) === 'number' ? (s.resolution ?? s.params?.resolution) : 24,
        rimDepth: typeof (s.rimDepth ?? s.params?.rimDepth) === 'number' ? (s.rimDepth ?? s.params?.rimDepth) : 0,
        connectEdges: (s.connectEdges ?? s.params?.connectEdges) !== false,

        // Revolve (Lathe)
        revolveAngle: typeof (s.revolveAngle ?? s.params?.revolveAngle) === 'number' ? (s.revolveAngle ?? s.params?.revolveAngle) : 360,
        revolveAxis: s.revolveAxis || s.params?.revolveAxis || 'Y',
        axisOffset: typeof (s.axisOffset ?? s.params?.axisOffset) === 'number' ? (s.axisOffset ?? s.params?.axisOffset) : 0,
        revolveSegments: typeof (s.revolveSegments ?? s.params?.revolveSegments) === 'number' ? (s.revolveSegments ?? s.params?.revolveSegments) : 32,
        capEnds: (s.capEnds ?? s.params?.capEnds) !== false,

        // Sweep (Loft along Rail)
        spineType: s.spineType || s.params?.spineType || 'arc',
        spineLength: typeof (s.spineLength ?? s.params?.spineLength) === 'number' ? (s.spineLength ?? s.params?.spineLength) : 1.2,
        spineCurvature: typeof (s.spineCurvature ?? s.params?.spineCurvature) === 'number' ? (s.spineCurvature ?? s.params?.spineCurvature) : 0.5,
        spineTwist: typeof (s.spineTwist ?? s.params?.spineTwist) === 'number' ? (s.spineTwist ?? s.params?.spineTwist) : 0,
        scaleStart: typeof (s.scaleStart ?? s.params?.scaleStart) === 'number' ? (s.scaleStart ?? s.params?.scaleStart) : 1.0,
        scaleEnd: typeof (s.scaleEnd ?? s.params?.scaleEnd) === 'number' ? (s.scaleEnd ?? s.params?.scaleEnd) : 0.5,
        scaleProfile: s.scaleProfile || s.params?.scaleProfile || 'linear',
        spineSteps: typeof (s.spineSteps ?? s.params?.spineSteps) === 'number' ? (s.spineSteps ?? s.params?.spineSteps) : 36,

        // Carve (Visual Hull)
        carveView: s.carveView || s.params?.carveView || 'top',
        carveResolution: typeof (s.carveResolution ?? s.params?.carveResolution) === 'number' ? (s.carveResolution ?? s.params?.carveResolution) : 32,
        carveSmooth: typeof (s.carveSmooth ?? s.params?.carveSmooth) === 'number' ? (s.carveSmooth ?? s.params?.carveSmooth) : 2,
        frontSvgPath: s.frontSvgPath || s.params?.frontSvgPath || s.frontSvg || s.params?.frontSvg,
        topSvgPath: s.topSvgPath || s.params?.topSvgPath || s.topSvg || s.params?.topSvg || s.topSideSvgPath || s.params?.topSideSvgPath,

        // Extrude & Deformation
        shellEnabled: Boolean(s.shellEnabled ?? s.params?.shellEnabled),
        shellThickness: typeof (s.shellThickness ?? s.params?.shellThickness) === 'number' ? (s.shellThickness ?? s.params?.shellThickness) : 0.04,
        domeWarpEnabled: Boolean(s.domeWarpEnabled ?? s.params?.domeWarpEnabled),
        domeCurvature: typeof (s.domeCurvature ?? s.params?.domeCurvature ?? s.domeWarpDepth ?? s.params?.domeWarpDepth) === 'number' ? (s.domeCurvature ?? s.params?.domeCurvature ?? s.domeWarpDepth ?? s.params?.domeWarpDepth) : 0.2,
        domeFalloff: s.domeFalloff || s.params?.domeFalloff || 'smoothstep',

        // Dual-Material Cap/Bevel Shading (Enamel Badges & Dual-Tone Logos)
        bevelColor: s.bevelColor || s.params?.bevelColor,
        bevelMetalness: typeof (s.bevelMetalness ?? s.params?.bevelMetalness) === 'number' ? (s.bevelMetalness ?? s.params?.bevelMetalness) : undefined,
        bevelRoughness: typeof (s.bevelRoughness ?? s.params?.bevelRoughness) === 'number' ? (s.bevelRoughness ?? s.params?.bevelRoughness) : undefined,

        // Procedural Patterns
        pattern: s.pattern || s.params?.pattern || 'none',
        patternScale: typeof (s.patternScale ?? s.params?.patternScale) === 'number' ? (s.patternScale ?? s.params?.patternScale) : 8.0,
        patternColor: s.patternColor || s.params?.patternColor || '#0f172a',
        patternSecondaryColor: s.patternSecondaryColor || s.params?.patternSecondaryColor || '#b91c1c',
        patternOpacity: typeof (s.patternOpacity ?? s.params?.patternOpacity) === 'number' ? (s.patternOpacity ?? s.params?.patternOpacity) : 0.65
      };

      // Sanitize vector contour points if points are used
      if (['vectorExtrude', 'vectorInflate', 'vectorRevolve', 'vectorSweep', 'extrude'].includes(type) && !shapeParams.svgPath) {
        if (shapeParams.points) {
          shapeParams.points = normalizeVectorPointsList(shapeParams.points);
        }
        if (!shapeParams.points || shapeParams.points.length < (type === 'vectorRevolve' ? 2 : 3)) {
          shapeParams.points = [
            { x: 0, y: 110 },
            { x: 75, y: 40 },
            { x: 70, y: -70 },
            { x: 0, y: -110 },
            { x: -70, y: -70 },
            { x: -75, y: 40 }
          ];
        }
      }

      if (type === 'vectorCarve') {
        if (shapeParams.frontPoints) {
          shapeParams.frontPoints = normalizeVectorPointsList(shapeParams.frontPoints);
        }
        if (shapeParams.topSidePoints) {
          shapeParams.topSidePoints = normalizeVectorPointsList(shapeParams.topSidePoints);
        }
      }

      normalized.shapes.push({
        id: shapeId,
        name: s.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${idx + 1}`,
        type: VALID_PRIMITIVE_TYPES.includes(type) ? type : 'box',
        preserveOrigin: shapeParams.preserveOrigin,
        params: shapeParams,
        color: s.color || '#38bdf8',
        roughness: typeof s.roughness === 'number' ? s.roughness : 0.35,
        metalness: typeof s.metalness === 'number' ? s.metalness : 0.15,
        emissive: s.emissive || '#000000',
        emissiveIntensity: typeof s.emissiveIntensity === 'number' ? s.emissiveIntensity : 0,
        bevelColor: shapeParams.bevelColor,
        bevelMetalness: shapeParams.bevelMetalness,
        bevelRoughness: shapeParams.bevelRoughness,
        pattern: shapeParams.pattern,
        patternScale: shapeParams.patternScale,
        patternColor: shapeParams.patternColor,
        patternSecondaryColor: shapeParams.patternSecondaryColor,
        patternOpacity: shapeParams.patternOpacity,
        wireframe: Boolean(s.wireframe),
        flatShading: Boolean(s.flatShading),
        posX: typeof s.posX === 'number' ? s.posX : (typeof s.x === 'number' ? s.x : 0),
        posY: typeof s.posY === 'number' ? s.posY : (typeof s.y === 'number' ? s.y : (shapeParams.preserveOrigin ? 0 : 0.35)),
        posZ: typeof s.posZ === 'number' ? s.posZ : (typeof s.z === 'number' ? s.z : 0),
        rotX: typeof s.rotX === 'number' ? s.rotX : 0,
        rotY: typeof s.rotY === 'number' ? s.rotY : 0,
        rotZ: typeof s.rotZ === 'number' ? s.rotZ : 0,
        scale: typeof s.scale === 'number' ? s.scale : 1,
        scaleX: typeof s.scaleX === 'number' ? s.scaleX : (typeof s.scale === 'number' ? s.scale : 1),
        scaleY: typeof s.scaleY === 'number' ? s.scaleY : (typeof s.scale === 'number' ? s.scale : 1),
        scaleZ: typeof s.scaleZ === 'number' ? s.scaleZ : (typeof s.scale === 'number' ? s.scale : 1),
        visible: s.visible !== false
      });
    });
  }

  // 4. Scatter Layers (Multi-Layer Foliage & Organic Surface Instances)
  const incomingScatter = root.scatterLayers || root.scatter || root.surfaceScatter || [];
  const scatterArray = Array.isArray(incomingScatter)
    ? incomingScatter
    : (typeof incomingScatter === 'object' && incomingScatter.enabled ? [incomingScatter] : []);

  scatterArray.forEach((sl, idx) => {
    if (!sl || typeof sl !== 'object') return;
    const proto = sl.prototype || 'leaf';
    if (!VALID_SCATTER_PROTOTYPES.includes(proto)) {
      warnings.push(`Scatter layer #${idx + 1} specifies unrecognized prototype '${proto}'. Defaulting to 'leaf'.`);
    }

    const layerId = sl.id || `layer_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
    normalized.scatterLayers.push({
      id: layerId,
      name: sl.name || `Scatter Layer ${idx + 1} (${proto})`,
      enabled: sl.enabled !== false,
      visible: sl.visible !== false,
      target: sl.target || '#ar-model',
      prototype: VALID_SCATTER_PROTOTYPES.includes(proto) ? proto : 'leaf',
      distribution: VALID_SCATTER_DISTRIBUTIONS.includes(sl.distribution) ? sl.distribution : 'random',
      count: Math.min(Math.max(typeof sl.count === 'number' ? Math.round(sl.count) : 200, 10), 3000),
      minScale: typeof sl.minScale === 'number' ? sl.minScale : 0.8,
      maxScale: typeof sl.maxScale === 'number' ? sl.maxScale : 1.2,
      randomRotation: typeof sl.randomRotation === 'number' ? sl.randomRotation : 45,
      normalAlign: sl.normalAlign !== false,
      normalOffset: typeof sl.normalOffset === 'number' ? sl.normalOffset : 0.005,
      color: sl.color || '#4ade80',
      colorVariation: typeof sl.colorVariation === 'number' ? sl.colorVariation : 0.2,
      roughness: typeof sl.roughness === 'number' ? sl.roughness : 0.7,
      metalness: typeof sl.metalness === 'number' ? sl.metalness : 0.1,
      seed: typeof sl.seed === 'number' ? Math.round(sl.seed) : (idx + 1) * 77,
      preset: sl.preset || 'custom',
      posX: typeof sl.posX === 'number' ? sl.posX : 0,
      posY: typeof sl.posY === 'number' ? sl.posY : 0,
      posZ: typeof sl.posZ === 'number' ? sl.posZ : 0,
      rotX: typeof sl.rotX === 'number' ? sl.rotX : 0,
      rotY: typeof sl.rotY === 'number' ? sl.rotY : 0,
      rotZ: typeof sl.rotZ === 'number' ? sl.rotZ : 0,
      scale: typeof sl.scale === 'number' ? sl.scale : 1,
      scaleX: typeof sl.scaleX === 'number' ? sl.scaleX : (typeof sl.scale === 'number' ? sl.scale : 1),
      scaleY: typeof sl.scaleY === 'number' ? sl.scaleY : (typeof sl.scale === 'number' ? sl.scale : 1),
      scaleZ: typeof sl.scaleZ === 'number' ? sl.scaleZ : (typeof sl.scale === 'number' ? sl.scale : 1)
    });
  });

  // 5. 3D Extruded Typography Text
  const incomingTexts = root.text3d || root.custom3DTexts || root.texts || [];
  if (Array.isArray(incomingTexts)) {
    incomingTexts.forEach((txt, idx) => {
      if (!txt || typeof txt !== 'object') return;
      const textId = txt.id || `text_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const rawFont = String(txt.fontFamily || '').trim();
      const isGoogleFontSpec =
        rawFont.startsWith('gf:') ||
        rawFont.startsWith('google:') ||
        rawFont.startsWith('gfont:') ||
        Boolean(txt.googleFontFamily) ||
        (rawFont.length > 0 && !rawFont.includes('_'));
      const resolvedFontFamily = VALID_FONT_FAMILIES.includes(rawFont)
        ? rawFont
        : (isGoogleFontSpec ? (rawFont || `gf:${txt.googleFontFamily}:700`) : 'helvetiker_bold');
      normalized.text3d.push({
        id: textId,
        name: txt.name || txt.text || `3D Text ${idx + 1}`,
        text: String(txt.text || 'STAR weAR'),
        fontFamily: resolvedFontFamily,
        ...(txt.fontUrl ? { fontUrl: txt.fontUrl } : {}),
        ...(txt.googleFontFamily ? { googleFontFamily: txt.googleFontFamily } : {}),
        ...(txt.googleFontVariant ? { googleFontVariant: txt.googleFontVariant } : {}),
        size: typeof txt.size === 'number' ? txt.size : 0.35,
        depth: typeof txt.depth === 'number' ? txt.depth : 0.08,
        curveSegments: typeof txt.curveSegments === 'number' ? txt.curveSegments : 12,
        bevelEnabled: txt.bevelEnabled !== false,
        bevelThickness: typeof txt.bevelThickness === 'number' ? txt.bevelThickness : 0.015,
        bevelSize: typeof txt.bevelSize === 'number' ? txt.bevelSize : 0.01,
        // Curved / Arched Typography
        curveRadius: typeof txt.curveRadius === 'number' ? txt.curveRadius : undefined,
        startAngle: typeof txt.startAngle === 'number' ? txt.startAngle : undefined,
        endAngle: typeof txt.endAngle === 'number' ? txt.endAngle : undefined,
        letterSpacing: typeof txt.letterSpacing === 'number' ? txt.letterSpacing : undefined,
        align: txt.align || 'center',
        color: txt.color || '#38bdf8',
        emissive: txt.emissive || '#0284c7',
        emissiveIntensity: typeof txt.emissiveIntensity === 'number' ? txt.emissiveIntensity : 0.4,
        metalness: typeof txt.metalness === 'number' ? txt.metalness : 0.75,
        roughness: typeof txt.roughness === 'number' ? txt.roughness : 0.25,
        wireframe: Boolean(txt.wireframe),
        posX: typeof txt.posX === 'number' ? txt.posX : 0,
        posY: typeof txt.posY === 'number' ? txt.posY : 0.6,
        posZ: typeof txt.posZ === 'number' ? txt.posZ : 0.05,
        rotX: typeof txt.rotX === 'number' ? txt.rotX : 0,
        rotY: typeof txt.rotY === 'number' ? txt.rotY : 0,
        rotZ: typeof txt.rotZ === 'number' ? txt.rotZ : 0,
        scale: typeof txt.scale === 'number' ? txt.scale : 1,
        scaleX: typeof txt.scaleX === 'number' ? txt.scaleX : 1,
        scaleY: typeof txt.scaleY === 'number' ? txt.scaleY : 1,
        scaleZ: typeof txt.scaleZ === 'number' ? txt.scaleZ : 1,
        rotationSpeed: typeof txt.rotationSpeed === 'number' ? txt.rotationSpeed : 0,
        bobbingSpeed: typeof txt.bobbingSpeed === 'number' ? txt.bobbingSpeed : 0,
        bobbingHeight: typeof txt.bobbingHeight === 'number' ? txt.bobbingHeight : 0,
        visible: txt.visible !== false
      });
    });
  }

  // 6. Lighting (Custom Lights & Studio Presets)
  const incomingLighting = root.lighting || root.customLights || {};
  const customLightsList = Array.isArray(incomingLighting)
    ? incomingLighting
    : (Array.isArray(incomingLighting.customLights) ? incomingLighting.customLights : []);

  normalized.lighting = {
    ambientColor: incomingLighting.ambientColor || root.ambientColor || '#ffffff',
    ambientIntensity: typeof incomingLighting.ambientIntensity === 'number' ? incomingLighting.ambientIntensity : 1.4,
    dir1Color: incomingLighting.dir1Color || root.dir1Color || '#ffffff',
    dir1Intensity: typeof incomingLighting.dir1Intensity === 'number' ? incomingLighting.dir1Intensity : 2.2,
    dir1Position: incomingLighting.dir1Position || root.dir1Position || '2 4 3',
    dir2Color: incomingLighting.dir2Color || root.dir2Color || '#ffffff',
    dir2Intensity: typeof incomingLighting.dir2Intensity === 'number' ? incomingLighting.dir2Intensity : 1.2,
    dir2Position: incomingLighting.dir2Position || root.dir2Position || '-2 -1 -2',
    rimColor: incomingLighting.rimColor || root.rimColor || '#818cf8',
    rimIntensity: typeof incomingLighting.rimIntensity === 'number' ? incomingLighting.rimIntensity : 1.0,
    rimPosition: incomingLighting.rimPosition || root.rimPosition || '0 3 -3',
    customLights: []
  };

  customLightsList.forEach((cl, idx) => {
    if (!cl || typeof cl !== 'object') return;
    const lType = cl.type || 'point';
    const lightId = cl.id || `light_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
    normalized.lighting.customLights.push({
      id: lightId,
      name: cl.name || `${lType.charAt(0).toUpperCase() + lType.slice(1)} Light ${idx + 1}`,
      type: VALID_LIGHT_TYPES.includes(lType) ? lType : 'point',
      color: cl.color || '#ffffff',
      groundColor: cl.groundColor || '#1e293b',
      intensity: typeof cl.intensity === 'number' ? cl.intensity : 2.5,
      distance: typeof cl.distance === 'number' ? cl.distance : 25,
      decay: typeof cl.decay === 'number' ? cl.decay : 2,
      angle: typeof cl.angle === 'number' ? cl.angle : 45,
      penumbra: typeof cl.penumbra === 'number' ? cl.penumbra : 0.35,
      posX: typeof cl.posX === 'number' ? cl.posX : 1.5,
      posY: typeof cl.posY === 'number' ? cl.posY : 2.2,
      posZ: typeof cl.posZ === 'number' ? cl.posZ : 1.8,
      targetX: typeof cl.targetX === 'number' ? cl.targetX : 0,
      targetY: typeof cl.targetY === 'number' ? cl.targetY : 0,
      targetZ: typeof cl.targetZ === 'number' ? cl.targetZ : 0,
      visible: cl.visible !== false,
      castShadow: Boolean(cl.castShadow),
      showHelper: cl.showHelper !== false
    });
  });

  // 7. Particle System
  const p = root.particles || root.particleConfig || root.particleSystem;
  if (p && typeof p === 'object' && p.enabled !== false) {
    const preset = p.preset || 'cosmic-stardust';
    normalized.particles = {
      enabled: true,
      preset: VALID_PARTICLE_PRESETS.includes(preset) ? preset : 'cosmic-stardust',
      count: Math.min(Math.max(typeof p.count === 'number' ? Math.round(p.count) : 300, 20), 2000),
      size: typeof p.size === 'number' ? p.size : 0.04,
      color: p.color || '#38bdf8',
      colorSecondary: p.colorSecondary || '#c084fc',
      opacity: typeof p.opacity === 'number' ? p.opacity : 0.85,
      blending: p.blending || 'additive',
      speed: typeof p.speed === 'number' ? p.speed : 1.0,
      spreadX: typeof p.spreadX === 'number' ? p.spreadX : 3.0,
      spreadY: typeof p.spreadY === 'number' ? p.spreadY : 3.0,
      spreadZ: typeof p.spreadZ === 'number' ? p.spreadZ : 3.0,
      direction: p.direction || 'float',
      shape: p.shape || 'sparkle',
      posX: typeof p.posX === 'number' ? p.posX : 0,
      posY: typeof p.posY === 'number' ? p.posY : 0,
      posZ: typeof p.posZ === 'number' ? p.posZ : 0,
      rotationSpeed: typeof p.rotationSpeed === 'number' ? p.rotationSpeed : 0.2,
      twinkle: p.twinkle !== false
    };
  }

  // 8. AR Portal Gateway
  const portal = root.portal || root.portalConfig;
  if (portal && typeof portal === 'object' && portal.enabled !== false) {
    normalized.portal = {
      enabled: true,
      preset: portal.preset || 'cosmic-nebula',
      shape: portal.shape || 'arch',
      width: typeof portal.width === 'number' ? portal.width : 1.1,
      height: typeof portal.height === 'number' ? portal.height : 1.8,
      depth: typeof portal.depth === 'number' ? portal.depth : 3.5,
      frameColor: portal.frameColor || '#38bdf8',
      frameEmissive: portal.frameEmissive || '#0284c7',
      frameEmissiveIntensity: typeof portal.frameEmissiveIntensity === 'number' ? portal.frameEmissiveIntensity : 1.5,
      frameGlow: portal.frameGlow !== false,
      videoUrl: portal.videoUrl || '',
      particles: portal.particles || 'stars',
      particleCount: typeof portal.particleCount === 'number' ? portal.particleCount : 180,
      particleColor: portal.particleColor || '#38bdf8',
      floatingText: portal.floatingText || 'STAR weAR',
      textColor: portal.textColor || '#38bdf8',
      posX: typeof portal.posX === 'number' ? portal.posX : 0,
      posY: typeof portal.posY === 'number' ? portal.posY : 0,
      posZ: typeof portal.posZ === 'number' ? portal.posZ : 0,
      rotX: typeof portal.rotX === 'number' ? portal.rotX : 0,
      rotY: typeof portal.rotY === 'number' ? portal.rotY : 0,
      rotZ: typeof portal.rotZ === 'number' ? portal.rotZ : 0,
      scale: typeof portal.scale === 'number' ? portal.scale : 1.0,
      hideOutsideModel: Boolean(portal.hideOutsideModel)
    };
  }

  // 9. Live 3D Website Viewport
  const web = root.website || root.websiteLayer;
  if (web && typeof web === 'object' && web.enabled !== false && web.url) {
    normalized.website = {
      enabled: true,
      url: String(web.url),
      width: typeof web.width === 'number' ? web.width : 1.2,
      height: typeof web.height === 'number' ? web.height : 0.675,
      aspectRatio: web.aspectRatio || '16:9',
      resolution: web.resolution || '1280x720',
      interactive: web.interactive !== false,
      opacity: typeof web.opacity === 'number' ? web.opacity : 1.0,
      frameStyle: web.frameStyle || 'cyber_bezel',
      frameColor: web.frameColor || '#6366f1',
      frameGlow: web.frameGlow !== false,
      curved: Boolean(web.curved),
      curveRadius: typeof web.curveRadius === 'number' ? web.curveRadius : 3.0,
      billboard: Boolean(web.billboard),
      posX: typeof web.posX === 'number' ? web.posX : 0,
      posY: typeof web.posY === 'number' ? web.posY : 0.8,
      posZ: typeof web.posZ === 'number' ? web.posZ : 0.05,
      rotX: typeof web.rotX === 'number' ? web.rotX : 0,
      rotY: typeof web.rotY === 'number' ? web.rotY : 0,
      rotZ: typeof web.rotZ === 'number' ? web.rotZ : 0,
      scale: typeof web.scale === 'number' ? web.scale : 1.0,
      showAddressBar: web.showAddressBar !== false
    };
  }

  // 10. External 3D Models
  const incomingModels = root.models || root.customModels || [];
  if (Array.isArray(incomingModels)) {
    incomingModels.forEach((m, idx) => {
      if (!m || typeof m !== 'object' || !m.url) return;
      normalized.models.push({
        id: m.id || `model_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: m.name || `Model ${idx + 1}`,
        url: m.url,
        posX: typeof m.posX === 'number' ? m.posX : 0,
        posY: typeof m.posY === 'number' ? m.posY : 0,
        posZ: typeof m.posZ === 'number' ? m.posZ : 0,
        rotX: typeof m.rotX === 'number' ? m.rotX : 0,
        rotY: typeof m.rotY === 'number' ? m.rotY : 0,
        rotZ: typeof m.rotZ === 'number' ? m.rotZ : 0,
        scale: typeof m.scale === 'number' ? m.scale : 1.0,
        scaleX: typeof m.scaleX === 'number' ? m.scaleX : 1.0,
        scaleY: typeof m.scaleY === 'number' ? m.scaleY : 1.0,
        scaleZ: typeof m.scaleZ === 'number' ? m.scaleZ : 1.0,
        visible: m.visible !== false
      });
    });
  }

  // 11. Target Tracking Marker
  const marker = root.tracking || root.markerConfig;
  if (marker && typeof marker === 'object') {
    normalized.tracking = {
      visible: marker.visible !== false,
      opacity: typeof marker.opacity === 'number' ? marker.opacity : 0.85,
      width: typeof marker.width === 'number' ? marker.width : 1.0,
      aspectRatio: typeof marker.aspectRatio === 'number' ? marker.aspectRatio : 1.0
    };
  }

  const stats = {
    shapesCount: normalized.shapes.length,
    scatterLayersCount: normalized.scatterLayers.length,
    totalScatterInstances: normalized.scatterLayers.reduce((acc, l) => acc + (l.count || 0), 0),
    textsCount: normalized.text3d.length,
    customLightsCount: normalized.lighting.customLights.length,
    hasParticles: Boolean(normalized.particles),
    hasPortal: Boolean(normalized.portal),
    hasWebsite: Boolean(normalized.website),
    modelsCount: normalized.models.length
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalizedData: normalized,
    stats
  };
}

// =========================================================================
// 4. SCENE EXPORTER (AR-Test State -> API JSON)
// =========================================================================

/**
 * Serializes the live state of ARTest into the standardized AR-Test API schema,
 * allowing instant export or few-shot training prompts for Google Gemini.
 */
export function exportCurrentSceneToArApi(state) {
  if (!state) return null;

  return {
    ar_scene: {
      metadata: {
        name: state.sceneName || 'Exported AR-Test Scene',
        version: AR_SCENE_API_VERSION,
        exportedAt: new Date().toISOString(),
        engine: 'Star weAR AR-Test Engine'
      },
      scene: {
        ambientColor: state.ambientColor || '#ffffff',
        ambientIntensity: state.ambientIntensity ?? 1.4,
        fogColor: state.fogColor || '#000000',
        fogDensity: state.fogDensity ?? 0.0,
        cameraAutoRotate: Boolean(state.cameraAutoRotate),
        envPreset: state.envPreset || 'none',
        envIntensity: state.envIntensity ?? 1.0,
        exposure: state.exposure ?? 1.1
      },
      transform: {
        scale: state.modelScale ?? 0.4,
        posX: state.modelPosX ?? 0,
        posY: state.modelPosY ?? 0,
        posZ: state.modelPosZ ?? 0,
        rotX: state.modelRotX ?? 90,
        rotY: state.modelRotY ?? 0,
        rotZ: state.modelRotZ ?? 0
      },
      lighting: {
        ambientColor: state.ambientColor || '#ffffff',
        ambientIntensity: state.ambientIntensity ?? 1.4,
        dir1Color: state.dir1Color || '#ffffff',
        dir1Intensity: state.dir1Intensity ?? 2.2,
        dir1Position: state.dir1Position || '2 4 3',
        dir2Color: state.dir2Color || '#ffffff',
        dir2Intensity: state.dir2Intensity ?? 1.2,
        dir2Position: state.dir2Position || '-2 -1 -2',
        rimColor: state.rimColor || '#818cf8',
        rimIntensity: state.rimIntensity ?? 1.0,
        rimPosition: state.rimPosition || '0 3 -3',
        customLights: (state.customLights || []).map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          color: l.color,
          intensity: l.intensity,
          distance: l.distance,
          decay: l.decay,
          angle: l.angle,
          penumbra: l.penumbra,
          posX: l.posX,
          posY: l.posY,
          posZ: l.posZ,
          visible: l.visible !== false,
          castShadow: Boolean(l.castShadow)
        }))
      },
      shapes: (state.additionalGeometries || []).map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        preserveOrigin: Boolean(g.preserveOrigin ?? g.params?.preserveOrigin),
        params: g.params || {},
        color: g.color || '#38bdf8',
        roughness: g.roughness ?? 0.35,
        metalness: g.metalness ?? 0.15,
        emissive: g.emissive || '#000000',
        emissiveIntensity: g.emissiveIntensity ?? 0,
        bevelColor: g.bevelColor || g.params?.bevelColor,
        bevelMetalness: g.bevelMetalness ?? g.params?.bevelMetalness,
        bevelRoughness: g.bevelRoughness ?? g.params?.bevelRoughness,
        pattern: g.pattern || g.params?.pattern || 'none',
        patternScale: g.patternScale ?? g.params?.patternScale ?? 8.0,
        patternColor: g.patternColor || g.params?.patternColor || '#0f172a',
        patternSecondaryColor: g.patternSecondaryColor || g.params?.patternSecondaryColor,
        patternOpacity: g.patternOpacity ?? g.params?.patternOpacity ?? 0.65,
        wireframe: Boolean(g.wireframe),
        flatShading: Boolean(g.flatShading),
        posX: g.posX ?? 0,
        posY: g.posY ?? 0,
        posZ: g.posZ ?? 0,
        rotX: g.rotX ?? 0,
        rotY: g.rotY ?? 0,
        rotZ: g.rotZ ?? 0,
        scale: g.scale ?? 1,
        scaleX: g.scaleX ?? 1,
        scaleY: g.scaleY ?? 1,
        scaleZ: g.scaleZ ?? 1,
        visible: g.visible !== false
      })),
      scatterLayers: (state.scatterLayers || []).map((sl) => ({
        id: sl.id,
        name: sl.name,
        enabled: sl.enabled !== false,
        visible: sl.visible !== false,
        target: sl.target || '#ar-model',
        prototype: sl.prototype || 'leaf',
        distribution: sl.distribution || 'random',
        count: sl.count || 200,
        minScale: sl.minScale ?? 0.8,
        maxScale: sl.maxScale ?? 1.2,
        randomRotation: sl.randomRotation ?? 45,
        normalAlign: sl.normalAlign !== false,
        normalOffset: sl.normalOffset ?? 0.005,
        color: sl.color || '#4ade80',
        colorVariation: sl.colorVariation ?? 0.2,
        roughness: sl.roughness ?? 0.7,
        metalness: sl.metalness ?? 0.1,
        seed: sl.seed || 1,
        preset: sl.preset || 'custom',
        posX: sl.posX ?? 0,
        posY: sl.posY ?? 0,
        posZ: sl.posZ ?? 0,
        rotX: sl.rotX ?? 0,
        rotY: sl.rotY ?? 0,
        rotZ: sl.rotZ ?? 0,
        scale: sl.scale ?? 1
      })),
      text3d: (state.custom3DTexts || []).map((t) => ({
        id: t.id,
        name: t.name,
        text: t.text,
        fontFamily: t.fontFamily,
        ...(t.fontUrl ? { fontUrl: t.fontUrl } : {}),
        ...(t.googleFontFamily ? { googleFontFamily: t.googleFontFamily } : {}),
        ...(t.googleFontVariant ? { googleFontVariant: t.googleFontVariant } : {}),
        size: t.size ?? 0.35,
        depth: t.depth ?? 0.08,
        bevelEnabled: t.bevelEnabled !== false,
        curveRadius: t.curveRadius,
        startAngle: t.startAngle,
        endAngle: t.endAngle,
        letterSpacing: t.letterSpacing,
        color: t.color || '#38bdf8',
        emissive: t.emissive || '#0284c7',
        emissiveIntensity: t.emissiveIntensity ?? 0.4,
        metalness: t.metalness ?? 0.75,
        roughness: t.roughness ?? 0.25,
        posX: t.posX ?? 0,
        posY: t.posY ?? 0.6,
        posZ: t.posZ ?? 0.05,
        rotX: t.rotX ?? 0,
        rotY: t.rotY ?? 0,
        rotZ: t.rotZ ?? 0,
        visible: t.visible !== false
      })),
      particles: state.particleSystemEnabled ? {
        enabled: true,
        preset: state.particlePreset || 'cosmic-stardust',
        count: state.particleCount ?? 300,
        size: state.particleSize ?? 0.04,
        color: state.particleColor || '#38bdf8',
        colorSecondary: state.particleColorSecondary || '#c084fc',
        opacity: state.particleOpacity ?? 0.85,
        speed: state.particleSpeed ?? 1.0,
        direction: state.particleDirection || 'float',
        shape: state.particleShape || 'sparkle'
      } : null,
      portal: state.portalEnabled ? {
        enabled: true,
        preset: state.portalPreset || 'cosmic-nebula',
        shape: state.portalShape || 'arch',
        width: state.portalWidth ?? 1.1,
        height: state.portalHeight ?? 1.8,
        frameColor: state.portalFrameColor || '#38bdf8',
        frameEmissive: state.portalFrameEmissive || '#0284c7',
        floatingText: state.portalFloatingText || 'STAR weAR'
      } : null,
      website: state.websiteEnabled && state.websiteUrl ? {
        enabled: true,
        url: state.websiteUrl,
        width: state.websiteWidth ?? 1.2,
        height: state.websiteHeight ?? 0.675,
        frameStyle: state.websiteFrameStyle || 'cyber_bezel',
        curved: Boolean(state.websiteCurved),
        interactive: state.websiteInteractive !== false
      } : null,
      tracking: {
        visible: state.markerVisible !== false,
        opacity: state.markerOpacity ?? 0.85,
        width: state.markerWidth ?? 1.0,
        aspectRatio: state.markerAspectRatio ?? 1.0
      }
    }
  };
}

// =========================================================================
// 5. READY-TO-USE PRESETS FOR TESTING & DEMONSTRATION
// =========================================================================

export const BUILTIN_API_PRESETS = [
  {
    id: 'ancient_tree_biome',
    name: '🌳 Procedural Ancient Tree & Biome',
    description: '3D tree trunk using tapered cylinders, multi-layer foliage scatter, river pebbles, sunlight, and pollen particles.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Procedural Ancient Oak Tree',
          description: 'Recreated from a 2D image of an ancient forest tree using shapes, multi-layer scatter, and sunlight.'
        },
        scene: {
          ambientColor: '#fef3c7',
          ambientIntensity: 1.2,
          fogColor: '#064e3b',
          fogDensity: 0.02
        },
        transform: {
          scale: 0.45,
          posX: 0,
          posY: -0.2,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ecfdf5',
          ambientIntensity: 1.3,
          dir1Color: '#fef08a',
          dir1Intensity: 3.0,
          dir1Position: '3 5 2',
          dir2Color: '#38bdf8',
          dir2Intensity: 1.0,
          dir2Position: '-2 1 -2',
          customLights: [
            {
              name: 'Sunlight Shaft',
              type: 'spot',
              color: '#fef08a',
              intensity: 4.5,
              posX: 2.0,
              posY: 3.5,
              posZ: 1.5,
              targetX: 0,
              targetY: 0.5,
              targetZ: 0,
              angle: 35,
              penumbra: 0.5
            }
          ]
        },
        shapes: [
          {
            name: 'Tree Base Mound',
            type: 'cylinder',
            params: { radiusTop: 1.2, radiusBottom: 1.4, height: 0.12, radialSegments: 32 },
            color: '#15803d',
            roughness: 0.9,
            metalness: 0.05,
            posX: 0,
            posY: -0.06,
            posZ: 0
          },
          {
            name: 'Tree Trunk Lower',
            type: 'cylinder',
            params: { radiusTop: 0.22, radiusBottom: 0.38, height: 0.8, radialSegments: 24 },
            color: '#5c3a21',
            roughness: 0.95,
            metalness: 0.0,
            posX: 0,
            posY: 0.35,
            posZ: 0
          },
          {
            name: 'Tree Trunk Upper & Canopy Core',
            type: 'sphere',
            params: { radius: 0.65, widthSegments: 24, heightSegments: 24 },
            color: '#276738',
            roughness: 0.8,
            metalness: 0.0,
            posX: 0,
            posY: 0.95,
            posZ: 0
          },
          {
            name: 'Branch Left',
            type: 'cone',
            params: { radius: 0.18, height: 0.55, radialSegments: 16 },
            color: '#4a2e1b',
            roughness: 0.9,
            posX: -0.28,
            posY: 0.65,
            posZ: 0.05,
            rotZ: 45
          },
          {
            name: 'Branch Right',
            type: 'cone',
            params: { radius: 0.16, height: 0.5, radialSegments: 16 },
            color: '#4a2e1b',
            roughness: 0.9,
            posX: 0.28,
            posY: 0.7,
            posZ: -0.05,
            rotZ: -40
          }
        ],
        scatterLayers: [
          {
            name: 'Canopy Foliage Leaves',
            prototype: 'leaf',
            target: 'Tree Trunk Upper & Canopy Core',
            count: 450,
            minScale: 0.8,
            maxScale: 1.5,
            color: '#4ade80',
            colorVariation: 0.3,
            roughness: 0.6,
            normalAlign: true,
            normalOffset: 0.008,
            randomRotation: 60,
            seed: 142
          },
          {
            name: 'Ground Wild Sprouts',
            prototype: 'grass',
            target: 'Tree Base Mound',
            count: 320,
            minScale: 0.6,
            maxScale: 1.2,
            color: '#22c55e',
            colorVariation: 0.25,
            roughness: 0.85,
            normalAlign: true,
            normalOffset: 0.004,
            randomRotation: 30,
            seed: 88
          },
          {
            name: 'Forest Pebbles',
            prototype: 'pebble',
            target: 'Tree Base Mound',
            count: 80,
            minScale: 0.5,
            maxScale: 1.1,
            color: '#94a3b8',
            colorVariation: 0.4,
            roughness: 0.9,
            normalAlign: true,
            normalOffset: 0.006,
            seed: 314
          }
        ],
        particles: {
          enabled: true,
          preset: 'mystic-fireflies',
          count: 150,
          size: 0.035,
          color: '#fef08a',
          colorSecondary: '#86efac',
          speed: 0.6,
          direction: 'float'
        }
      }
    }
  },
  {
    id: 'cyberpunk_shrine',
    name: '🏙️ Cyberpunk Hologram & Neon Shrine',
    description: 'Futuristic pedestal, crystal scatter shards, 3D neon typography, cyber grid particles, and dual-tone neon lighting.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Cyberpunk Holographic Shrine',
          description: 'High-tech display with metallic pedestal, glowing 3D text, crystal shards, and dual neon lighting.'
        },
        scene: {
          ambientColor: '#0f172a',
          ambientIntensity: 0.8
        },
        transform: {
          scale: 0.4,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#1e1b4b',
          ambientIntensity: 0.9,
          dir1Color: '#06b6d4',
          dir1Intensity: 3.5,
          dir1Position: '2 3 2',
          dir2Color: '#ec4899',
          dir2Intensity: 3.0,
          dir2Position: '-2 2 -1',
          customLights: [
            {
              name: 'Cyan Neon Spot',
              type: 'spot',
              color: '#06b6d4',
              intensity: 5.0,
              posX: 1.5,
              posY: 2.0,
              posZ: 1.0,
              targetX: 0,
              targetY: 0.3,
              targetZ: 0,
              angle: 40
            },
            {
              name: 'Magenta Rim Light',
              type: 'point',
              color: '#f43f5e',
              intensity: 4.0,
              posX: -1.2,
              posY: 1.2,
              posZ: -0.8
            }
          ]
        },
        shapes: [
          {
            name: 'Cyber Base Octagon',
            type: 'cylinder',
            params: { radiusTop: 1.1, radiusBottom: 1.25, height: 0.15, radialSegments: 8 },
            color: '#0f172a',
            roughness: 0.2,
            metalness: 0.95,
            emissive: '#06b6d4',
            emissiveIntensity: 0.25,
            posX: 0,
            posY: -0.08,
            posZ: 0
          },
          {
            name: 'Levitating Core Ring',
            type: 'torus',
            params: { radius: 0.75, tube: 0.08, radialSegments: 16, tubularSegments: 48 },
            color: '#38bdf8',
            roughness: 0.1,
            metalness: 0.9,
            emissive: '#0284c7',
            emissiveIntensity: 1.2,
            posX: 0,
            posY: 0.45,
            posZ: 0,
            rotX: 90
          }
        ],
        scatterLayers: [
          {
            name: 'Cyber Crystal Shards',
            prototype: 'crystal',
            target: 'Cyber Base Octagon',
            count: 90,
            minScale: 0.7,
            maxScale: 1.6,
            color: '#38bdf8',
            colorVariation: 0.3,
            roughness: 0.15,
            metalness: 0.85,
            normalAlign: true,
            normalOffset: 0.01,
            seed: 777
          }
        ],
        text3d: [
          {
            name: 'Title Text',
            text: 'STAR weAR',
            fontFamily: 'helvetiker_bold',
            size: 0.28,
            depth: 0.06,
            color: '#38bdf8',
            emissive: '#0284c7',
            emissiveIntensity: 1.5,
            metalness: 0.8,
            roughness: 0.15,
            posX: 0,
            posY: 0.85,
            posZ: 0
          },
          {
            name: 'Subtitle Subtext',
            text: 'FUTURE REALITY',
            fontFamily: 'optimer_bold',
            size: 0.12,
            depth: 0.03,
            color: '#f43f5e',
            emissive: '#be123c',
            emissiveIntensity: 1.2,
            posX: 0,
            posY: 0.62,
            posZ: 0.02
          }
        ],
        particles: {
          enabled: true,
          preset: 'cyber-matrix',
          count: 280,
          size: 0.04,
          color: '#38bdf8',
          colorSecondary: '#ec4899',
          speed: 1.2,
          direction: 'up'
        }
      }
    }
  },
  {
    id: 'ethereal_portal',
    name: '🌀 Ethereal AR Portal Gateway',
    description: '3D AR doorway into a cosmic nebula with floating runes, crystal scatter, and cosmic stardust.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Ethereal Cosmic Portal Gateway',
          description: 'A glowing AR portal doorway into another dimension with atmospheric effects.'
        },
        scene: {
          ambientColor: '#09090b',
          ambientIntensity: 0.7
        },
        transform: {
          scale: 0.45,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        portal: {
          enabled: true,
          preset: 'cosmic-nebula',
          shape: 'arch',
          width: 1.2,
          height: 2.0,
          depth: 4.0,
          frameColor: '#c084fc',
          frameEmissive: '#9333ea',
          frameEmissiveIntensity: 2.0,
          frameGlow: true,
          floatingText: 'ENTER VOID',
          textColor: '#e9d5ff',
          particles: 'stars',
          particleCount: 220,
          particleColor: '#c084fc'
        },
        shapes: [
          {
            name: 'Portal Dais',
            type: 'cylinder',
            params: { radiusTop: 1.3, radiusBottom: 1.45, height: 0.1, radialSegments: 32 },
            color: '#18181b',
            roughness: 0.4,
            metalness: 0.8,
            posX: 0,
            posY: -0.05,
            posZ: 0
          }
        ],
        scatterLayers: [
          {
            name: 'Void Crystals',
            prototype: 'crystal',
            target: 'Portal Dais',
            count: 70,
            minScale: 0.8,
            maxScale: 1.8,
            color: '#c084fc',
            colorVariation: 0.35,
            roughness: 0.2,
            metalness: 0.8,
            normalAlign: true,
            normalOffset: 0.01,
            seed: 99
          }
        ],
        particles: {
          enabled: true,
          preset: 'cosmic-stardust',
          count: 240,
          size: 0.045,
          color: '#c084fc',
          colorSecondary: '#38bdf8',
          speed: 0.8,
          direction: 'float'
        }
      }
    }
  },
  {
    id: 'unified_40_emblem',
    name: '🛡️ Unified 40 Cross-Sword Emblem (v1.1 Advanced)',
    description: 'Single-mesh solid vectorExtrude emblem with SVG bezier curves, interior cutouts (holes), sharp chamfer bevels, honeycomb pattern, and studio-chrome environment reflections.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Unified 40 Cross-Sword Emblem',
          version: '1.1.0',
          description: 'Single-piece emblem using vectorExtrude, svgPath, interior cutouts (holes), preserveOrigin: true, bevelSegments: 2, and studio-chrome reflection environment.'
        },
        scene: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.4,
          envPreset: 'studio-chrome',
          envIntensity: 1.2,
          exposure: 1.15
        },
        transform: {
          scale: 0.5,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.2,
          dir1Color: '#ffffff',
          dir1Intensity: 2.8,
          dir1Position: '2 4 3',
          dir2Color: '#93c5fd',
          dir2Intensity: 1.5,
          dir2Position: '-2 1 -2',
          rimColor: '#60a5fa',
          rimIntensity: 1.2,
          rimPosition: '0 3 -3'
        },
        shapes: [
          {
            id: 'emblem_40_unified',
            name: 'Unified 40 Cross-Sword Emblem',
            type: 'vectorExtrude',
            preserveOrigin: true,
            params: {
              preserveOrigin: true,
              svgPath: 'M -0.70 0.95 L -0.02 1.00 L 0.68 0.96 C 0.92 0.55 0.85 -0.35 0.18 -0.82 L -0.04 -0.92 L -0.15 -2.18 L -0.26 -0.05 L -0.81 -0.16 C -0.94 0.25 -0.88 0.68 -0.70 0.95 Z',
              holes: [
                [[-0.28, 0.82], [-0.28, 0.04], [-0.62, -0.02], [-0.52, 0.48]],
                [[0.18, 0.68], [0.55, 0.52], [0.58, -0.15], [0.18, -0.52]]
              ],
              depth: 0.12,
              bevelEnabled: true,
              bevelThickness: 0.02,
              bevelSize: 0.015,
              bevelSegments: 2,
              pattern: 'honeycomb',
              patternScale: 12.0,
              patternColor: '#1e293b',
              patternOpacity: 0.5
            },
            color: '#ffffff',
            metalness: 0.95,
            roughness: 0.08,
            posX: 0,
            posY: 0,
            posZ: 0
          }
        ]
      }
    }
  },
  {
    id: 'revolved_greek_vase',
    name: '🏺 Classical Amphora Vase (vectorRevolve)',
    description: 'Rotational 360-degree lathe solid around Y-axis using smooth Bezier contour points, polished terracotta finish, and studio lighting.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Classical Greek Amphora Vase',
          version: '1.1.0',
          description: 'Recreated with vectorRevolve around Y-axis using a smooth 2D silhouette contour.'
        },
        scene: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.2,
          envPreset: 'studio-chrome',
          envIntensity: 0.8
        },
        transform: {
          scale: 0.5,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.2,
          dir1Color: '#fff7ed',
          dir1Intensity: 2.5,
          dir1Position: '2 4 3',
          dir2Color: '#93c5fd',
          dir2Intensity: 1.0,
          dir2Position: '-2 1 -2'
        },
        shapes: [
          {
            id: 'greek_amphora_body',
            name: 'Amphora Vase Body',
            type: 'vectorRevolve',
            params: {
              revolveAxis: 'Y',
              revolveAngle: 360,
              revolveSegments: 48,
              axisOffset: 0.0,
              capEnds: true,
              preserveOrigin: true,
              points: [
                { x: 0.08, y: -0.65 },
                { x: 0.32, y: -0.58, handleIn: { x: -0.08, y: -0.02 }, handleOut: { x: 0, y: 0.15 } },
                { x: 0.12, y: -0.38, handleIn: { x: 0.08, y: -0.08 }, handleOut: { x: 0, y: 0.18 } },
                { x: 0.45, y: -0.05, handleIn: { x: -0.1, y: -0.22 }, handleOut: { x: 0, y: 0.22 } },
                { x: 0.15, y: 0.35, handleIn: { x: 0.12, y: -0.1 }, handleOut: { x: 0, y: 0.12 } },
                { x: 0.22, y: 0.65, handleIn: { x: -0.05, y: -0.1 }, handleOut: null },
                { x: 0.18, y: 0.65 },
                { x: 0.10, y: 0.38, handleIn: { x: 0, y: 0.1 }, handleOut: { x: 0.08, y: -0.08 } },
                { x: 0.38, y: -0.05, handleIn: { x: 0, y: 0.2 }, handleOut: { x: -0.08, y: -0.18 } },
                { x: 0.08, y: -0.35, handleIn: { x: 0, y: 0.1 }, handleOut: { x: 0.05, y: -0.08 } },
                { x: 0.08, y: -0.60 }
              ]
            },
            color: '#c2410c',
            roughness: 0.25,
            metalness: 0.1,
            posX: 0,
            posY: 0,
            posZ: 0
          }
        ]
      }
    }
  },
  {
    id: 'inflated_plush_badge',
    name: '🎈 Volumetric Inflated Heart Badge (vectorInflate)',
    description: 'Dual-sided volumetric organic puff with pillowed curvature profile, Laplacian mesh smoothing, and satin sheen.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Volumetric Inflated Heart Badge',
          version: '1.1.0',
          description: 'Recreated using vectorInflate with pillowed curvature profile and Laplacian mesh smoothing.'
        },
        scene: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.4,
          envPreset: 'sunset',
          envIntensity: 1.2
        },
        transform: {
          scale: 0.5,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.3,
          dir1Color: '#fef08a',
          dir1Intensity: 2.8,
          dir1Position: '2 3 2'
        },
        shapes: [
          {
            id: 'heart_inflated_cushion',
            name: 'Inflated Heart Cushion',
            type: 'vectorInflate',
            params: {
              preserveOrigin: true,
              depth: 0.35,
              curvatureProfile: 'pillowed',
              symmetric: true,
              smoothPasses: 3,
              resolution: 32,
              rimDepth: 0.04,
              connectEdges: true,
              points: [
                { x: 0.0, y: 0.35 },
                { x: 0.32, y: 0.65, handleIn: { x: -0.15, y: -0.05 }, handleOut: { x: 0.15, y: 0.05 } },
                { x: 0.65, y: 0.38, handleIn: { x: 0.05, y: 0.15 }, handleOut: { x: -0.05, y: -0.15 } },
                { x: 0.48, y: -0.15, handleIn: { x: 0.12, y: 0.15 }, handleOut: { x: -0.12, y: -0.15 } },
                { x: 0.0, y: -0.65, handleIn: { x: 0.15, y: 0.18 }, handleOut: { x: -0.15, y: 0.18 } },
                { x: -0.48, y: -0.15, handleIn: { x: 0.12, y: -0.15 }, handleOut: { x: -0.12, y: 0.15 } },
                { x: -0.65, y: 0.38, handleIn: { x: 0.05, y: -0.15 }, handleOut: { x: -0.05, y: 0.15 } },
                { x: -0.32, y: 0.65, handleIn: { x: -0.15, y: 0.05 }, handleOut: { x: 0.15, y: -0.05 } }
              ]
            },
            color: '#f43f5e',
            roughness: 0.35,
            metalness: 0.15,
            posX: 0,
            posY: 0,
            posZ: 0
          }
        ]
      }
    }
  },
  {
    id: 'swept_nautilus_horn',
    name: '🎷 Coiled Spiral Horn (vectorSweep)',
    description: 'Bishop parallel transport loft along a 3D helical spiral spine with continuous rotational twist and tapering cross-section.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Coiled Spiral Horn',
          version: '1.1.0',
          description: 'Recreated using vectorSweep along a 3D helix guide spine with taper and twist.'
        },
        scene: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.3,
          envPreset: 'studio-chrome',
          envIntensity: 1.5
        },
        transform: {
          scale: 0.45,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.2,
          dir1Color: '#ffffff',
          dir1Intensity: 3.0,
          dir1Position: '2 4 3'
        },
        shapes: [
          {
            id: 'spiral_horn_mesh',
            name: 'Spiral Nautilus Horn',
            type: 'vectorSweep',
            params: {
              preserveOrigin: true,
              spineType: 'helix',
              spineLength: 2.2,
              spineCurvature: 0.8,
              spineTwist: 540,
              spineSteps: 48,
              scaleStart: 1.2,
              scaleEnd: 0.15,
              scaleProfile: 'ease_out',
              capEnds: true,
              points: [
                { x: 0.0, y: 0.22 },
                { x: 0.22, y: 0.0 },
                { x: 0.0, y: -0.22 },
                { x: -0.22, y: 0.0 }
              ]
            },
            color: '#fbbf24',
            roughness: 0.12,
            metalness: 0.92,
            posX: 0,
            posY: 0,
            posZ: 0
          }
        ]
      }
    }
  },
  {
    id: 'v12_designer_badge',
    name: '🎖️ Designer Enamel Seal (v1.2 Feature Showcase)',
    description: 'Showcases Dual-Material Cap/Bevel Shading (chrome-rimmed black enamel), Arched 3D Typography (curveRadius + angular span), and Gingham fabric plaque with patternSecondaryColor.',
    payload: {
      ar_scene: {
        metadata: {
          name: 'Designer Enamel Seal & Arched Typography',
          version: '1.2.0',
          description: 'Demonstrating dual-material bevel shading, arched text typography, and gingham woven pattern.'
        },
        scene: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.4,
          envPreset: 'studio-chrome',
          envIntensity: 1.5,
          exposure: 1.15
        },
        transform: {
          scale: 0.5,
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: 90,
          rotY: 0,
          rotZ: 0
        },
        lighting: {
          ambientColor: '#ffffff',
          ambientIntensity: 1.2,
          dir1Color: '#ffffff',
          dir1Intensity: 2.8,
          dir1Position: '2 4 3',
          dir2Color: '#93c5fd',
          dir2Intensity: 1.2,
          dir2Position: '-2 1 -2',
          rimColor: '#cbd5e1',
          rimIntensity: 1.5,
          rimPosition: '0 3 -3'
        },
        shapes: [
          {
            id: 'gingham_backing_plaque',
            name: 'Gingham Fabric Plaque',
            type: 'cylinder',
            params: {
              radiusTop: 0.95,
              radiusBottom: 0.95,
              height: 0.04,
              radialSegments: 48,
              pattern: 'gingham',
              patternScale: 18.0,
              patternColor: '#f43f5e',
              patternSecondaryColor: '#9f1239',
              patternOpacity: 0.85
            },
            color: '#ffffff',
            roughness: 0.85,
            metalness: 0.05,
            posX: 0,
            posY: -0.04,
            posZ: 0
          },
          {
            id: 'custom_enamel_bezel',
            name: 'Custom Enamel Bezel',
            type: 'vectorExtrude',
            preserveOrigin: true,
            params: {
              preserveOrigin: true,
              svgPath: 'M 0 0.85 C 0.47 0.85 0.85 0.47 0.85 0 C 0.85 -0.47 0.47 -0.85 0 -0.85 C -0.47 -0.85 -0.85 -0.47 -0.85 0 C -0.85 0.47 -0.47 0.85 0 0.85 Z',
              holes: [
                [[0, 0.42], [0.42, 0], [0, -0.42], [-0.42, 0]]
              ],
              depth: 0.08,
              curveSegments: 48,
              bevelEnabled: true,
              bevelThickness: 0.015,
              bevelSize: 0.012,
              bevelSegments: 3,
              bevelColor: '#e2e8f0',
              bevelMetalness: 0.95,
              bevelRoughness: 0.1
            },
            color: '#09090b',
            metalness: 0.35,
            roughness: 0.12,
            bevelColor: '#e2e8f0',
            bevelMetalness: 0.95,
            bevelRoughness: 0.1,
            posX: 0,
            posY: 0,
            posZ: 0
          }
        ],
        text3d: [
          {
            id: 'arched_header_text',
            name: 'Arched Header',
            text: 'WHERE EVERYDAY IS',
            fontFamily: 'helvetiker_bold',
            size: 0.095,
            depth: 0.03,
            curveRadius: 0.62,
            startAngle: -55,
            endAngle: 55,
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.006,
            color: '#18181b',
            metalness: 0.9,
            roughness: 0.12,
            posX: 0,
            posY: 0.06,
            posZ: 0
          },
          {
            id: 'center_badge_title',
            name: 'Center Badge Title',
            text: 'STAR weAR',
            fontFamily: 'optimer_bold',
            size: 0.09,
            depth: 0.035,
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.006,
            color: '#f59e0b',
            metalness: 0.95,
            roughness: 0.15,
            emissive: '#78350f',
            emissiveIntensity: 0.3,
            posX: 0,
            posY: -0.02,
            posZ: 0
          }
        ]
      }
    }
  }
];
