import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  createInflatedGeometryFromPoints,
  applyDomeDeformation,
  normalizeVectorPoint,
  normalizeVectorPointsList,
  hasNaNPositions,
  INFLATION_PROFILES,
  INFLATION_PROFILE_MAP
} from './inflationEngine.js';
import {
  createRevolvedGeometryFromPoints,
  createSweptGeometryFromPath,
  createOrthogonalCarveGeometry,
  createAdvancedExtrudeGeometry,
  VECTOR_GENERATION_MODES,
  REVOLVE_PRESETS,
  SWEEP_SPINE_PRESETS,
  CARVE_PRESETS
} from './vectorMeshEngine.js';

export {
  INFLATION_PROFILES,
  INFLATION_PROFILE_MAP,
  normalizeVectorPoint,
  normalizeVectorPointsList,
  hasNaNPositions,
  createRevolvedGeometryFromPoints,
  createSweptGeometryFromPath,
  createOrthogonalCarveGeometry,
  createAdvancedExtrudeGeometry,
  VECTOR_GENERATION_MODES,
  REVOLVE_PRESETS,
  SWEEP_SPINE_PRESETS,
  CARVE_PRESETS
};

export const GEOMETRY_DEFINITIONS = [
  {
    id: 'box',
    name: 'Cube / Box',
    category: 'Basics',
    icon: 'view_in_ar',
    description: 'Six-sided rectangular prism with adjustable dimensions and subdivision faces.',
    defaultParams: { width: 1, height: 1, depth: 1, widthSegments: 1, heightSegments: 1, depthSegments: 1 },
    paramConfigs: [
      { key: 'width', label: 'Width (X)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'height', label: 'Height (Y)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'depth', label: 'Depth (Z)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'widthSegments', label: 'Segments (Subdivisions)', min: 1, max: 16, step: 1 }
    ]
  },
  {
    id: 'sphere',
    name: 'UV Sphere',
    category: 'Curved',
    icon: 'sports_volleyball',
    description: 'Smooth 3D sphere with latitude and longitude subdivision density.',
    defaultParams: { radius: 0.6, widthSegments: 32, heightSegments: 32 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 5, step: 0.05, unit: 'm' },
      { key: 'widthSegments', label: 'Radial Segments', min: 8, max: 64, step: 2 },
      { key: 'heightSegments', label: 'Height Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'cylinder',
    name: 'Cylinder / Column',
    category: 'Basics',
    icon: 'database',
    description: 'Cylindrical column or disc with independent top and bottom radii.',
    defaultParams: { radiusTop: 0.5, radiusBottom: 0.5, height: 1.2, radialSegments: 32 },
    paramConfigs: [
      { key: 'radiusTop', label: 'Top Radius', min: 0.0, max: 4, step: 0.05, unit: 'm' },
      { key: 'radiusBottom', label: 'Bottom Radius', min: 0.05, max: 4, step: 0.05, unit: 'm' },
      { key: 'height', label: 'Height', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'cone',
    name: 'Cone / Pyramid',
    category: 'Basics',
    icon: 'change_history',
    description: 'Tapered circular or faceted cone with sharp apex point.',
    defaultParams: { radius: 0.6, height: 1.3, radialSegments: 32 },
    paramConfigs: [
      { key: 'radius', label: 'Base Radius', min: 0.1, max: 5, step: 0.05, unit: 'm' },
      { key: 'height', label: 'Height', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 3, max: 64, step: 1 }
    ]
  },
  {
    id: 'torus',
    name: 'Torus (Donut)',
    category: 'Curved',
    icon: 'album',
    description: 'Ring torus donut shaped geometry with cross-sectional tube thickness.',
    defaultParams: { radius: 0.65, tube: 0.22, radialSegments: 24, tubularSegments: 48 },
    paramConfigs: [
      { key: 'radius', label: 'Ring Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'tube', label: 'Tube Thickness', min: 0.02, max: 1.5, step: 0.02, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 48, step: 2 },
      { key: 'tubularSegments', label: 'Tubular Segments', min: 16, max: 96, step: 4 }
    ]
  },
  {
    id: 'torusKnot',
    name: 'Torus Knot',
    category: 'Curved',
    icon: 'all_inclusive',
    description: 'Complex topological knot wound around a mathematical torus.',
    defaultParams: { radius: 0.55, tube: 0.16, tubularSegments: 80, radialSegments: 16, p: 2, q: 3 },
    paramConfigs: [
      { key: 'radius', label: 'Overall Radius', min: 0.1, max: 3, step: 0.05, unit: 'm' },
      { key: 'tube', label: 'Tube Thickness', min: 0.02, max: 0.8, step: 0.02, unit: 'm' },
      { key: 'p', label: 'P Factor (Rotational Loops)', min: 1, max: 8, step: 1 },
      { key: 'q', label: 'Q Factor (Internal Loops)', min: 1, max: 8, step: 1 }
    ]
  },
  {
    id: 'capsule',
    name: 'Capsule (Pill)',
    category: 'Curved',
    icon: 'reorder',
    description: 'Cylindrical shaft capped with hemispherical domes at both ends.',
    defaultParams: { radius: 0.4, length: 0.9, capSegments: 8, radialSegments: 24 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 3, step: 0.05, unit: 'm' },
      { key: 'length', label: 'Cylinder Length', min: 0.1, max: 6, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 48, step: 2 }
    ]
  },
  {
    id: 'plane',
    name: 'Plane / Backdrop',
    category: 'Surfaces',
    icon: 'crop_portrait',
    description: 'Flat planar surface, suitable for ground backdrops, walls, and screens.',
    defaultParams: { width: 2.5, height: 2.5, widthSegments: 1, heightSegments: 1 },
    paramConfigs: [
      { key: 'width', label: 'Width (X)', min: 0.1, max: 15, step: 0.2, unit: 'm' },
      { key: 'height', label: 'Height (Y)', min: 0.1, max: 15, step: 0.2, unit: 'm' },
      { key: 'widthSegments', label: 'Grid Divisions', min: 1, max: 20, step: 1 }
    ]
  },
  {
    id: 'ring',
    name: 'Ring / Flat Disc',
    category: 'Surfaces',
    icon: 'adjust',
    description: 'Two-dimensional annular ring or flat disc with inner cutout hole.',
    defaultParams: { innerRadius: 0.35, outerRadius: 0.85, thetaSegments: 32 },
    paramConfigs: [
      { key: 'innerRadius', label: 'Inner Radius (Hole)', min: 0.05, max: 3, step: 0.05, unit: 'm' },
      { key: 'outerRadius', label: 'Outer Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'thetaSegments', label: 'Circumference Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'icosahedron',
    name: 'Icosahedron (Crystal)',
    category: 'Polyhedra',
    icon: 'diamond',
    description: 'Regular 20-sided polyhedron, perfect for gemstones and low-poly art.',
    defaultParams: { radius: 0.7, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'dodecahedron',
    name: 'Dodecahedron',
    category: 'Polyhedra',
    icon: 'token',
    description: 'Symmetric 12-sided regular polyhedron with pentagonal faces.',
    defaultParams: { radius: 0.7, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'tetrahedron',
    name: 'Tetrahedron',
    category: 'Polyhedra',
    icon: 'details',
    description: 'Four-faced triangular pyramid polyhedron with sharp geometric lines.',
    defaultParams: { radius: 0.75, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'vectorExtrude',
    name: 'Vector Pen Tool (Extrude & Shell)',
    category: 'Vector / Pen',
    icon: 'straighten',
    description: 'Extrude custom 2D vector path with directional taper, edge beveling, and hollow shell / solidify modifier.',
    defaultParams: {
      depth: 0.25,
      taper: 1.0,
      twist: 0,
      shellEnabled: false,
      shellThickness: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
      curveSegments: 24,
      scaleFactor: 0.005,
      points: [
        { x: 0, y: -110 },
        { x: 30, y: -35 },
        { x: 110, y: -35 },
        { x: 45, y: 15 },
        { x: 70, y: 95 },
        { x: 0, y: 45 },
        { x: -70, y: 95 },
        { x: -45, y: 15 },
        { x: -110, y: -35 },
        { x: -30, y: -35 }
      ]
    },
    paramConfigs: [
      { key: 'depth', label: 'Extrude Depth', min: 0.02, max: 2.0, step: 0.02, unit: 'm' },
      { key: 'taper', label: 'Directional Taper', min: 0.1, max: 2.5, step: 0.05 },
      { key: 'twist', label: 'Extrusion Twist', min: -360, max: 360, step: 5, unit: '°' },
      { key: 'bevelThickness', label: 'Bevel Thickness', min: 0.0, max: 0.2, step: 0.01, unit: 'm' },
      { key: 'bevelSize', label: 'Bevel Size', min: 0.0, max: 0.2, step: 0.01, unit: 'm' },
      { key: 'bevelSegments', label: 'Bevel Segments', min: 1, max: 8, step: 1 },
      { key: 'curveSegments', label: 'Curve Smoothness', min: 6, max: 48, step: 2 }
    ]
  },
  {
    id: 'vectorInflate',
    name: 'Inflated Vector Volume',
    category: 'Vector / Pen',
    icon: 'bubble_chart',
    description: 'Volumetric curved 3D mesh inflated from 2D vector silhouette using Distance-Field Poisson equations.',
    defaultParams: {
      depth: 0.35,
      depthFront: 0.35,
      depthBack: 0.35,
      curvatureProfile: 'elliptic',
      symmetric: true,
      smoothPasses: 2,
      resolution: 24,
      rimDepth: 0.0,
      scaleFactor: 0.005,
      connectEdges: true,
      points: [
        { x: 0, y: -110 },
        { x: 30, y: -35 },
        { x: 110, y: -35 },
        { x: 45, y: 15 },
        { x: 70, y: 95 },
        { x: 0, y: 45 },
        { x: -70, y: 95 },
        { x: -45, y: 15 },
        { x: -110, y: -35 },
        { x: -30, y: -35 }
      ]
    },
    paramConfigs: [
      { key: 'depth', label: 'Inflation Depth', min: 0.02, max: 2.0, step: 0.02, unit: 'm' },
      { key: 'smoothPasses', label: 'Smoothing Passes', min: 0, max: 6, step: 1 },
      { key: 'resolution', label: 'Mesh Resolution', min: 12, max: 48, step: 2 },
      { key: 'rimDepth', label: 'Rim Wall Depth', min: 0.0, max: 0.5, step: 0.02, unit: 'm' }
    ]
  },
  {
    id: 'vectorRevolve',
    name: 'Revolved Vector Lathe',
    category: 'Vector / Pen',
    icon: 'rotate_right',
    description: 'Axis-symmetric 360° or partial rotational surface generated from 2D profile curve around Y or X axis.',
    defaultParams: {
      revolveAngle: 360,
      revolveAxis: 'Y',
      revolveSegments: 32,
      axisOffset: 0.0,
      capEnds: true,
      curveSegments: 32,
      scaleFactor: 0.005,
      points: [
        { x: 15, y: -130 },
        { x: 55, y: -120 },
        { x: 25, y: -80 },
        { x: 85, y: -10 },
        { x: 30, y: 70 },
        { x: 45, y: 130 },
        { x: 38, y: 130 },
        { x: 22, y: 75 },
        { x: 75, y: -10 },
        { x: 18, y: -75 },
        { x: 15, y: -120 }
      ]
    },
    paramConfigs: [
      { key: 'revolveAngle', label: 'Revolution Angle', min: 15, max: 360, step: 15, unit: '°' },
      { key: 'revolveSegments', label: 'Radial Segments', min: 12, max: 64, step: 2 },
      { key: 'axisOffset', label: 'Axis Radial Offset', min: -0.5, max: 1.0, step: 0.02, unit: 'm' }
    ]
  },
  {
    id: 'vectorSweep',
    name: 'Swept Vector Rail & Loft',
    category: 'Vector / Pen',
    icon: 'timeline',
    description: 'Cross-sectional vector profile swept along a 3D guide curve with Bishop parallel transport and taper falloff.',
    defaultParams: {
      spineType: 'arc',
      spineLength: 1.2,
      spineCurvature: 0.5,
      spineTwist: 0,
      spineSteps: 36,
      scaleStart: 1.0,
      scaleEnd: 0.5,
      scaleProfile: 'linear',
      capEnds: true,
      curveSegments: 24,
      scaleFactor: 0.005,
      points: [
        { x: 0, y: -60 },
        { x: 40, y: 0 },
        { x: 0, y: 60 },
        { x: -40, y: 0 }
      ]
    },
    paramConfigs: [
      { key: 'spineLength', label: 'Path Length', min: 0.2, max: 4.0, step: 0.1, unit: 'm' },
      { key: 'spineCurvature', label: 'Spine Curvature', min: 0.0, max: 1.5, step: 0.05 },
      { key: 'spineTwist', label: 'Spine Twist', min: 0, max: 720, step: 15, unit: '°' },
      { key: 'scaleStart', label: 'Start Scale', min: 0.1, max: 2.5, step: 0.05 },
      { key: 'scaleEnd', label: 'End Scale', min: 0.05, max: 2.5, step: 0.05 }
    ]
  },
  {
    id: 'vectorCarve',
    name: 'Orthogonal Silhouette Carve',
    category: 'Vector / Pen',
    icon: 'view_in_ar',
    description: 'Dual-orthogonal vector carving: intersects Front and Top silhouettes into a solid 3D visual hull.',
    defaultParams: {
      carveView: 'top',
      carveResolution: 32,
      carveSmooth: 2,
      scaleFactor: 0.005,
      curveSegments: 24,
      frontPoints: [
        { x: -140, y: 20 },
        { x: -60, y: -20 },
        { x: 10, y: -45 },
        { x: 80, y: -30 },
        { x: 140, y: 15 },
        { x: 140, y: 40 },
        { x: -140, y: 40 }
      ],
      topSidePoints: [
        { x: -140, y: 0 },
        { x: -90, y: -45 },
        { x: 20, y: -55 },
        { x: 120, y: -40 },
        { x: 140, y: 0 },
        { x: 120, y: 40 },
        { x: 20, y: 55 },
        { x: -90, y: 45 }
      ]
    },
    paramConfigs: [
      { key: 'carveResolution', label: 'Voxel Density', min: 20, max: 44, step: 2 },
      { key: 'carveSmooth', label: 'Laplacian Smoothing', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'svg',
    name: 'SVG Code / Extruded Vector',
    category: 'Vector / Pen',
    icon: 'code_blocks',
    description: 'Extrude custom 2D SVG vector code or path snippet into a 3D physical mesh with beveling and depth.',
    defaultParams: {
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="#fbbf24"/></svg>',
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 3,
      curveSegments: 24,
      targetSize: 1.0,
      invertY: true
    },
    paramConfigs: [
      { key: 'depth', label: 'Extrude Depth', min: 0.01, max: 2.0, step: 0.01, unit: 'm' },
      { key: 'targetSize', label: 'Object Scale', min: 0.1, max: 4.0, step: 0.1, unit: 'm' },
      { key: 'bevelThickness', label: 'Bevel Thickness', min: 0.0, max: 0.2, step: 0.005, unit: 'm' },
      { key: 'bevelSize', label: 'Bevel Size', min: 0.0, max: 0.2, step: 0.005, unit: 'm' },
      { key: 'curveSegments', label: 'Curve Smoothness', min: 6, max: 48, step: 2 }
    ]
  }
];

export const MATERIAL_PRESETS = [
  { id: 'standard', name: 'Standard PBR', roughness: 0.35, metalness: 0.15, clearcoat: 0.0 },
  { id: 'chrome', name: 'Chrome Metallic', roughness: 0.12, metalness: 0.95, clearcoat: 0.3 },
  { id: 'satin', name: 'Frosted Satin', roughness: 0.22, metalness: 0.05, clearcoat: 0.8 },
  { id: 'clay', name: 'Matte Clay', roughness: 0.92, metalness: 0.0, clearcoat: 0.0 },
  { id: 'gloss', name: 'Gloss Lacquer', roughness: 0.08, metalness: 0.05, clearcoat: 0.6 }
];

export const COLOR_SWATCHES = [
  { name: 'Slate Blue', hex: '#526373' },
  { name: 'Cyber Cyan', hex: '#38bdf8' },
  { name: 'Neon Emerald', hex: '#10b981' },
  { name: 'Obsidian Noir', hex: '#18181b' },
  { name: 'Electric Violet', hex: '#8b5cf6' },
  { name: 'Titanium White', hex: '#f8fafc' },
  { name: 'Sunset Gold', hex: '#f59e0b' },
  { name: 'Crimson Rose', hex: '#f43f5e' }
];

/**
 * Ensures a BufferGeometry is fully compatible with the destination THREE_LIB instance.
 * If THREE_LIB is a separate bundle (e.g. AFRAME.THREE super-three), attributes, indices,
 * groups, and bounding volumes are cloned into an instance of THREE_LIB.BufferGeometry
 * so that instanceof checks and buffer uploads succeed across Three.js versions.
 */
export function ensureCompatibleBufferGeometry(geom, THREE_LIB = THREE) {
  if (!geom) return null;
  if (!THREE_LIB || THREE_LIB === THREE || typeof THREE_LIB.BufferGeometry !== 'function') {
    return geom;
  }
  if (geom instanceof THREE_LIB.BufferGeometry) {
    return geom;
  }
  try {
    const target = new THREE_LIB.BufferGeometry();
    for (const name in geom.attributes) {
      const attr = geom.attributes[name];
      if (attr && attr.array) {
        target.setAttribute(name, new THREE_LIB.BufferAttribute(attr.array, attr.itemSize, attr.normalized));
      }
    }
    if (geom.index && geom.index.array) {
      target.setIndex(new THREE_LIB.BufferAttribute(geom.index.array, 1));
    }
    if (Array.isArray(geom.groups)) {
      geom.groups.forEach((g) => target.addGroup(g.start, g.count, g.materialIndex));
    }
    if (geom.boundingBox) {
      target.boundingBox = new THREE_LIB.Box3(
        new THREE_LIB.Vector3(geom.boundingBox.min.x, geom.boundingBox.min.y, geom.boundingBox.min.z),
        new THREE_LIB.Vector3(geom.boundingBox.max.x, geom.boundingBox.max.y, geom.boundingBox.max.z)
      );
    }
    if (geom.boundingSphere) {
      target.boundingSphere = new THREE_LIB.Sphere(
        new THREE_LIB.Vector3(geom.boundingSphere.center.x, geom.boundingSphere.center.y, geom.boundingSphere.center.z),
        geom.boundingSphere.radius
      );
    }
    geom.dispose();
    return target;
  } catch (err) {
    console.warn('[geometryHelper] BufferGeometry conversion fallback:', err);
    return geom;
  }
}

/**
 * Creates a volumetric extruded Three.js BufferGeometry directly from an SVG path string or SVG XML snippet.
 * Uses SVGLoader from three/examples to parse standard SVG paths, Polygons, and Shapes.
 */
export function createGeometryFromSvgPath(svgPathStr, options = {}, THREE_LIB = THREE) {
  if (!svgPathStr || typeof svgPathStr !== 'string') return null;

  try {
    const rawStr = svgPathStr.trim();
    if (!rawStr) return null;

    let cleanStr = rawStr;
    const svgTagIdx = cleanStr.toLowerCase().indexOf('<svg');
    if (svgTagIdx !== -1) {
      cleanStr = cleanStr.slice(svgTagIdx);
      const closeIdx = cleanStr.toLowerCase().lastIndexOf('</svg>');
      if (closeIdx !== -1) {
        cleanStr = cleanStr.slice(0, closeIdx + 6);
      }
    }

    let xml = cleanStr;
    if (!cleanStr.toLowerCase().startsWith('<svg')) {
      if (cleanStr.startsWith('<')) {
        xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${cleanStr}</svg>`;
      } else {
        xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="${cleanStr}" /></svg>`;
      }
    }

    const loader = new SVGLoader();
    const svgData = loader.parse(xml);
    if (!svgData || !svgData.paths || svgData.paths.length === 0) {
      console.warn('[geometryHelper] SVGLoader found no paths in svgPath string.');
      return null;
    }

    // Extract all Shapes generated by SVGLoader
    const shapes = [];
    svgData.paths.forEach((p) => {
      const shList = SVGLoader.createShapes(p);
      if (Array.isArray(shList)) {
        shapes.push(...shList);
      }
    });

    // Fallback: If createShapes returned 0 shapes (e.g. stroke-only or open paths), convert subpaths
    if (shapes.length === 0 && svgData.paths.length > 0) {
      svgData.paths.forEach((p) => {
        if (p.subPaths && p.subPaths.length > 0) {
          p.subPaths.forEach((sp) => {
            const pts = sp.getPoints();
            if (pts.length >= 3) {
              const sh = new THREE.Shape();
              sh.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) {
                sh.lineTo(pts[i].x, pts[i].y);
              }
              sh.closePath();
              shapes.push(sh);
            }
          });
        }
      });
    }

    if (shapes.length === 0) {
      console.warn('[geometryHelper] SVGLoader produced 0 shapes from path.');
      return null;
    }

    const preserveOrigin = Boolean(options.preserveOrigin ?? options.keepOrigin);
    // Standard SVG coordinates: +Y is downward, while in Three.js +Y is upward.
    // Default invertY to true so the extruded shape renders right side up.
    const invertY = options.invertY !== undefined ? Boolean(options.invertY) : true;
    const ySign = invertY ? -1 : 1;
    const scale = Number(options.scaleFactor ?? 1.0) || 1.0;

    // Support interior cutouts (params.holes)
    const holes = options.holes || options.cutouts || [];
    if (Array.isArray(holes) && holes.length > 0 && shapes.length > 0) {
      const primaryShape = shapes[0];
      holes.forEach((holePts) => {
        if (!Array.isArray(holePts) || holePts.length < 3) return;
        const normHole = normalizeVectorPointsList(holePts);
        if (normHole.length < 3) return;
        const holePath = new THREE.Path();
        const hp0 = normHole[0];
        holePath.moveTo(hp0.x * scale, hp0.y * ySign * scale);
        for (let j = 0; j < normHole.length; j++) {
          const hCurr = normHole[j];
          const hNext = normHole[(j + 1) % normHole.length];
          const hCp1 = hCurr.handleOut
            ? { x: (hCurr.x + hCurr.handleOut.x) * scale, y: (hCurr.y + hCurr.handleOut.y) * ySign * scale }
            : null;
          const hCp2 = hNext.handleIn
            ? { x: (hNext.x + hNext.handleIn.x) * scale, y: (hNext.y + hNext.handleIn.y) * ySign * scale }
            : null;

          if (hCp1 || hCp2) {
            const hc1 = hCp1 || { x: hCurr.x * scale, y: hCurr.y * ySign * scale };
            const hc2 = hCp2 || { x: hNext.x * scale, y: hNext.y * ySign * scale };
            holePath.bezierCurveTo(hc1.x, hc1.y, hc2.x, hc2.y, hNext.x * scale, hNext.y * ySign * scale);
          } else {
            holePath.lineTo(hNext.x * scale, hNext.y * ySign * scale);
          }
        }
        holePath.closePath();
        primaryShape.holes.push(holePath);
      });
    }

    const depth = Math.max(0.005, Number(options.depth ?? 0.25) || 0.25);
    const reqBevelEnabled = options.bevelEnabled !== false;
    let bevelThickness = Number(options.bevelThickness ?? 0.02);
    let bevelSize = Number(options.bevelSize ?? 0.015);
    const bevelOffset = Number(options.bevelOffset ?? 0) || 0;
    const bevelSegments = Math.max(1, Math.min(8, Number(options.bevelSegments ?? 2) || 2));
    const curveSegments = Math.max(6, Number(options.curveSegments ?? 24) || 24);

    if (isNaN(bevelThickness)) bevelThickness = 0.02;
    if (isNaN(bevelSize)) bevelSize = 0.015;
    const bevelEnabled = reqBevelEnabled && bevelSize >= 0.001;

    // IMPORTANT: Always build the geometry using THREE.ExtrudeGeometry from 'three'
    // (100% compatible with SVGLoader & Shape from 'three')
    let geom = null;
    try {
      geom = new THREE.ExtrudeGeometry(shapes, {
        depth,
        bevelEnabled,
        bevelThickness,
        bevelSize,
        bevelOffset,
        bevelSegments,
        curveSegments,
        steps: 1
      });
      if (hasNaNPositions(geom)) {
        if (geom) geom.dispose();
        geom = new THREE.ExtrudeGeometry(shapes, {
          depth,
          bevelEnabled: false,
          curveSegments,
          steps: 1
        });
      }
    } catch (extrErr) {
      console.warn('[geometryHelper] SVGLoader ExtrudeGeometry fallback:', extrErr);
      geom = new THREE.ExtrudeGeometry(shapes, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
        steps: 1
      });
    }

    if (!geom || hasNaNPositions(geom)) {
      if (geom) geom.dispose();
      return null;
    }

    if (invertY) {
      geom.scale(1, -1, 1);
      // Invert winding to correct face normal orientation after reflection across XZ
      if (geom.index) {
        const idx = geom.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const tmp = idx[i + 1];
          idx[i + 1] = idx[i + 2];
          idx[i + 2] = tmp;
        }
        geom.index.needsUpdate = true;
      }
    }

    // Auto-fit scale or user requested targetSize
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb) {
      const sizeX = Math.abs(bb.max.x - bb.min.x);
      const sizeY = Math.abs(bb.max.y - bb.min.y);
      const maxDim = Math.max(sizeX, sizeY);

      if (options.targetSize && maxDim > 1e-4) {
        const factor = Number(options.targetSize) / maxDim;
        geom.scale(factor, factor, 1.0);
      } else if (options.autoScale !== false && maxDim > 4.0) {
        // Standardize pixel coordinates (e.g. 100-1024px) down to unit scale (~1m)
        const factor = 1.0 / maxDim;
        geom.scale(factor, factor, 1.0);
      } else if (scale !== 1.0) {
        geom.scale(scale, scale, 1.0);
      }
    }

    if (!preserveOrigin && typeof geom.center === 'function') {
      geom.center();
    }
    geom.computeVertexNormals();

    // Ensure the resulting BufferGeometry is compatible with THREE_LIB
    return ensureCompatibleBufferGeometry(geom, THREE_LIB);
  } catch (err) {
    console.error('[geometryHelper] createGeometryFromSvgPath error:', err);
    return null;
  }
}

/**
 * Samples discrete 2D { x, y } contour vertices from an SVG path string or XML element.
 * Enables vectorRevolve, vectorSweep, vectorInflate, and vectorCarve to be driven by SVG curves.
 */
export function samplePointsFromSvgPath(svgPathStr, segments = 32, THREE_LIB = THREE) {
  if (!svgPathStr || typeof svgPathStr !== 'string') return [];
  try {
    const rawStr = svgPathStr.trim();
    if (!rawStr) return [];
    let cleanStr = rawStr;
    const svgTagIdx = cleanStr.toLowerCase().indexOf('<svg');
    if (svgTagIdx !== -1) {
      cleanStr = cleanStr.slice(svgTagIdx);
      const closeIdx = cleanStr.toLowerCase().lastIndexOf('</svg>');
      if (closeIdx !== -1) {
        cleanStr = cleanStr.slice(0, closeIdx + 6);
      }
    }

    let xml = cleanStr;
    if (!cleanStr.toLowerCase().startsWith('<svg')) {
      if (cleanStr.startsWith('<')) {
        xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${cleanStr}</svg>`;
      } else {
        xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="${cleanStr}" /></svg>`;
      }
    }

    const loader = new SVGLoader();
    const svgData = loader.parse(xml);
    if (!svgData || !svgData.paths || svgData.paths.length === 0) return [];
    const shapes = SVGLoader.createShapes(svgData.paths[0]);
    if (!shapes || shapes.length === 0) return [];

    const pts = shapes[0].getPoints(Math.max(8, Number(segments) || 32));
    if (pts.length > 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
        pts.pop();
      }
    }
    return pts.map((p) => ({ x: p.x, y: p.y, type: 'smooth' }));
  } catch (err) {
    console.warn('[geometryHelper] samplePointsFromSvgPath error:', err);
    return [];
  }
}

const patternTextureCache = new Map();

/**
 * Procedurally generates a seamless CanvasTexture for surface patterns:
 * honeycomb, carbon-fiber, brushed-metal, grid, dots, camo
 */
export function createProceduralPatternTexture(patternType, options = {}, THREE_LIB = THREE) {
  if (!patternType || patternType === 'none') return null;

  const type = String(patternType).toLowerCase().trim();
  const scale = typeof options.patternScale === 'number' && !isNaN(options.patternScale) ? options.patternScale : 8.0;
  const color = options.patternColor || '#0f172a';
  const secondaryColor = options.patternSecondaryColor || options.secondaryColor || '#b91c1c';
  const opacity = typeof options.patternOpacity === 'number' && !isNaN(options.patternOpacity) ? Math.min(Math.max(options.patternOpacity, 0), 1) : 0.65;

  const cacheKey = `${type}_${scale}_${color}_${secondaryColor}_${opacity}`;
  if (patternTextureCache.has(cacheKey)) {
    return patternTextureCache.get(cacheKey);
  }

  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fill base background (pure white so material.color multiplies cleanly)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (type) {
    case 'gingham': {
      // Authentic woven gingham check pattern with twill crosshatch texture
      const tileSize = 64;
      const halfTile = tileSize / 2;
      for (let y = 0; y < size; y += tileSize) {
        for (let x = 0; x < size; x += tileSize) {
          // Top-right & Bottom-left: single color stripes (semi-transparent blend)
          ctx.globalAlpha = opacity * 0.65;
          ctx.fillStyle = color;
          ctx.fillRect(x + halfTile, y, halfTile, halfTile);
          ctx.fillRect(x, y + halfTile, halfTile, halfTile);

          // Bottom-right: crossing intersection (richer secondary weave color)
          ctx.globalAlpha = opacity * 0.95;
          ctx.fillStyle = secondaryColor;
          ctx.fillRect(x + halfTile, y + halfTile, halfTile, halfTile);

          // Top-left remains pure white background (x, y, halfTile, halfTile)
        }
      }

      // Micro twill weave hatch texture across the fabric
      ctx.globalAlpha = opacity * 0.18;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      for (let d = -size; d < size * 2; d += 6) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + size, size);
        ctx.stroke();
      }
      break;
    }

    case 'checkerboard': {
      // High-contrast alternating checkerboard grid
      const tileSize = 64;
      const halfTile = tileSize / 2;
      for (let y = 0; y < size; y += tileSize) {
        for (let x = 0; x < size; x += tileSize) {
          ctx.globalAlpha = opacity;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, halfTile, halfTile);
          ctx.fillRect(x + halfTile, y + halfTile, halfTile, halfTile);

          ctx.fillStyle = secondaryColor;
          ctx.fillRect(x + halfTile, y, halfTile, halfTile);
          ctx.fillRect(x, y + halfTile, halfTile, halfTile);
        }
      }
      break;
    }

    case 'twill-crosshatch':
    case 'twill': {
      // 2x2 Diagonal twill weave crosshatch (denim / canvas structure)
      const step = 16;
      ctx.lineWidth = 2.5;
      for (let d = -size; d < size * 2; d += step) {
        ctx.globalAlpha = opacity * 0.75;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + size, size);
        ctx.stroke();

        ctx.globalAlpha = opacity * 0.45;
        ctx.strokeStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(d + step / 2, size);
        ctx.lineTo(d + step / 2 + size, 0);
        ctx.stroke();
      }
      break;
    }
    case 'honeycomb': {
      // Hexagonal tiling grid
      const r = 24;
      const h = r * Math.sqrt(3);
      ctx.lineWidth = 3;
      for (let y = -r; y < size + r * 2; y += h) {
        let rowIdx = Math.round(y / h);
        const xOffset = (rowIdx % 2) * (r * 1.5);
        for (let x = -r * 2; x < size + r * 2; x += r * 3) {
          const cx = x + xOffset;
          const cy = y;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = cx + r * Math.cos(angle);
            const hy = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }

    case 'carbon-fiber': {
      // 2x2 Twill weave carbon fiber pattern
      const blockSize = 32;
      for (let y = 0; y < size; y += blockSize) {
        for (let x = 0; x < size; x += blockSize) {
          const isEven = ((x / blockSize) + (y / blockSize)) % 2 === 0;
          if (isEven) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, blockSize, blockSize);
            // Draw diagonal hatch sheen
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + blockSize, y + blockSize);
            ctx.moveTo(x + blockSize / 2, y);
            ctx.lineTo(x + blockSize, y + blockSize / 2);
            ctx.moveTo(x, y + blockSize / 2);
            ctx.lineTo(x + blockSize / 2, y + blockSize);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(x, y, blockSize, blockSize);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + blockSize, y);
            ctx.lineTo(x, y + blockSize);
            ctx.stroke();
          }
        }
      }
      break;
    }

    case 'brushed-metal': {
      // Horizontal anisotropic micro-grooves
      ctx.lineWidth = 1;
      for (let y = 0; y < size; y += 2) {
        const streakAlpha = 0.2 + ((y * 13) % 17) / 25;
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity * streakAlpha;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      for (let i = 0; i < 3000; i++) {
        const gx = ((i * 37) % size);
        const gy = ((i * 59) % size);
        const glen = 10 + (i % 40);
        ctx.globalAlpha = opacity * 0.4;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(Math.min(size, gx + glen), gy);
        ctx.stroke();
      }
      break;
    }

    case 'grid': {
      // Technical engineering grid
      const gridStep = 32;
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= size; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let y = 0; y <= size; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      // Major grid lines
      ctx.lineWidth = 3;
      for (let x = 0; x <= size; x += gridStep * 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let y = 0; y <= size; y += gridStep * 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      break;
    }

    case 'dots': {
      // Halftone / perforated dots array
      const dotSpacing = 32;
      const dotRadius = 6;
      for (let y = dotSpacing / 2; y < size; y += dotSpacing) {
        const row = Math.round(y / dotSpacing);
        const xOffset = (row % 2) * (dotSpacing / 2);
        for (let x = dotSpacing / 2; x < size + dotSpacing; x += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x + xOffset, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'camo': {
      // Organic camouflage blobs
      const patches = 28;
      for (let i = 0; i < patches; i++) {
        const px = ((i * 73) % (size - 60)) + 30;
        const py = ((i * 97) % (size - 60)) + 30;
        const rad = 25 + (i % 4) * 12;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.arc(px + rad * 0.6, py + rad * 0.4, rad * 0.8, 0, Math.PI * 2);
        ctx.arc(px - rad * 0.5, py + rad * 0.5, rad * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    default:
      break;
  }
  ctx.restore();

  const texture = new THREE_LIB.CanvasTexture(canvas);
  texture.wrapS = THREE_LIB.RepeatWrapping;
  texture.wrapT = THREE_LIB.RepeatWrapping;
  texture.repeat.set(scale, scale);
  if (THREE_LIB.SRGBColorSpace !== undefined) {
    texture.colorSpace = THREE_LIB.SRGBColorSpace;
  }
  texture.needsUpdate = true;

  patternTextureCache.set(cacheKey, texture);
  return texture;
}

export function createPrimitiveThreeGeometry(type, params, THREE_LIB = THREE) {
  const p = params || {};
  let geom;
  switch (type) {
    case 'box':
      geom = new THREE_LIB.BoxGeometry(
        p.width || 1,
        p.height || 1,
        p.depth || 1,
        p.widthSegments || 1,
        p.heightSegments || 1,
        p.depthSegments || 1
      );
      break;
    case 'sphere':
      geom = new THREE_LIB.SphereGeometry(
        p.radius || 0.6,
        p.widthSegments || 32,
        p.heightSegments || 32
      );
      break;
    case 'cylinder':
      geom = new THREE_LIB.CylinderGeometry(
        p.radiusTop !== undefined ? p.radiusTop : 0.5,
        p.radiusBottom !== undefined ? p.radiusBottom : 0.5,
        p.height || 1.2,
        p.radialSegments || 32
      );
      break;
    case 'cone':
      geom = new THREE_LIB.ConeGeometry(
        p.radius || 0.6,
        p.height || 1.3,
        p.radialSegments || 32
      );
      break;
    case 'torus':
      geom = new THREE_LIB.TorusGeometry(
        p.radius || 0.65,
        p.tube || 0.22,
        p.radialSegments || 24,
        p.tubularSegments || 48
      );
      break;
    case 'torusKnot':
      geom = new THREE_LIB.TorusKnotGeometry(
        p.radius || 0.55,
        p.tube || 0.16,
        p.tubularSegments || 80,
        p.radialSegments || 16,
        p.p || 2,
        p.q || 3
      );
      break;
    case 'capsule':
      if (typeof THREE_LIB.CapsuleGeometry === 'function') {
        geom = new THREE_LIB.CapsuleGeometry(
          p.radius || 0.4,
          p.length || 0.9,
          p.capSegments || 8,
          p.radialSegments || 24
        );
      } else {
        geom = new THREE_LIB.CylinderGeometry(
          p.radius || 0.4,
          p.radius || 0.4,
          (p.length || 0.9) + (p.radius || 0.4) * 2,
          24
        );
      }
      break;
    case 'plane':
      geom = new THREE_LIB.PlaneGeometry(
        p.width || 2.5,
        p.height || 2.5,
        p.widthSegments || 1,
        p.heightSegments || 1
      );
      break;
    case 'ring':
      geom = new THREE_LIB.RingGeometry(
        p.innerRadius || 0.35,
        p.outerRadius || 0.85,
        p.thetaSegments || 32
      );
      break;
    case 'icosahedron':
      geom = new THREE_LIB.IcosahedronGeometry(
        p.radius || 0.7,
        p.detail || 0
      );
      break;
    case 'dodecahedron':
      geom = new THREE_LIB.DodecahedronGeometry(
        p.radius || 0.7,
        p.detail || 0
      );
      break;
    case 'tetrahedron':
      geom = new THREE_LIB.TetrahedronGeometry(
        p.radius || 0.75,
        p.detail || 0
      );
      break;
    case 'vectorRevolve': {
      let rawPoints = p.points || [];
      if ((!Array.isArray(rawPoints) || rawPoints.length < 2) && (p.svgPath || p.svg)) {
        rawPoints = samplePointsFromSvgPath(p.svgPath || p.svg, p.curveSegments || 32, THREE_LIB);
      }
      if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
        geom = new THREE_LIB.CylinderGeometry(0.5, 0.5, 1, 32);
        break;
      }
      try {
        geom = createRevolvedGeometryFromPoints(rawPoints, p, THREE_LIB);
      } catch (err) {
        console.warn('[geometryHelper] Revolve generation fallback:', err);
        geom = new THREE_LIB.CylinderGeometry(0.5, 0.5, 1, 32);
      }
      break;
    }
    case 'vectorSweep': {
      let rawPoints = p.points || [];
      if ((!Array.isArray(rawPoints) || rawPoints.length < 3) && (p.svgPath || p.svg)) {
        rawPoints = samplePointsFromSvgPath(p.svgPath || p.svg, p.curveSegments || 24, THREE_LIB);
      }
      if (!Array.isArray(rawPoints) || rawPoints.length < 3) {
        geom = new THREE_LIB.TorusGeometry(0.5, 0.15, 16, 32);
        break;
      }
      try {
        geom = createSweptGeometryFromPath(rawPoints, p, THREE_LIB);
      } catch (err) {
        console.warn('[geometryHelper] Sweep generation fallback:', err);
        geom = new THREE_LIB.TorusGeometry(0.5, 0.15, 16, 32);
      }
      break;
    }
    case 'vectorCarve': {
      let frontPts = p.frontPoints || p.points || [];
      let topPts = p.topSidePoints || p.topPoints || [];
      if ((!Array.isArray(frontPts) || frontPts.length < 3) && (p.frontSvgPath || p.frontSvg || p.svgPath || p.svg)) {
        frontPts = samplePointsFromSvgPath(p.frontSvgPath || p.frontSvg || p.svgPath || p.svg, p.curveSegments || 24, THREE_LIB);
      }
      if ((!Array.isArray(topPts) || topPts.length < 3) && (p.topSvgPath || p.topSvg || p.topSideSvgPath)) {
        topPts = samplePointsFromSvgPath(p.topSvgPath || p.topSvg || p.topSideSvgPath, p.curveSegments || 24, THREE_LIB);
      }
      if (!Array.isArray(frontPts) || frontPts.length < 3 || !Array.isArray(topPts) || topPts.length < 3) {
        geom = new THREE_LIB.BoxGeometry(1, 0.6, 1);
        break;
      }
      try {
        geom = createOrthogonalCarveGeometry(frontPts, topPts, p, THREE_LIB);
      } catch (err) {
        console.warn('[geometryHelper] Carve generation fallback:', err);
        geom = new THREE_LIB.BoxGeometry(1, 0.6, 1);
      }
      break;
    }
    case 'vectorInflate': {
      let rawPoints = p.points || [];
      if ((!Array.isArray(rawPoints) || rawPoints.length < 3) && (p.svgPath || p.svg)) {
        rawPoints = samplePointsFromSvgPath(p.svgPath || p.svg, p.curveSegments || 24, THREE_LIB);
      }
      if (!Array.isArray(rawPoints) || rawPoints.length < 3) {
        geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
        break;
      }
      try {
        geom = createInflatedGeometryFromPoints(rawPoints, {
          depth: Number(p.depth ?? p.inflationAmount ?? 0.35),
          depthFront: p.depthFront !== undefined ? Number(p.depthFront) : Number(p.depth ?? 0.35),
          depthBack: p.depthBack !== undefined ? Number(p.depthBack) : (p.symmetric !== false ? Number(p.depth ?? 0.35) : 0),
          curvatureProfile: p.curvatureProfile || p.profile || 'elliptic',
          symmetric: p.symmetric !== false,
          smoothPasses: p.smoothPasses !== undefined ? Number(p.smoothPasses) : 2,
          resolution: p.resolution !== undefined ? Number(p.resolution) : 24,
          rimDepth: Number(p.rimDepth ?? 0),
          scaleFactor: p.scaleFactor !== undefined ? Number(p.scaleFactor) : null,
          curveSegments: Number(p.curveSegments ?? 24),
          connectEdges: p.connectEdges !== false
        }, THREE_LIB);
      } catch (inflateErr) {
        console.warn('[geometryHelper] Inflation generation fallback:', inflateErr);
        geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
      }
      break;
    }
    case 'svg':
    case 'svgExtrude':
    case 'svgPath': {
      const svgCode = p.svg || p.svgCode || p.svgPath || p.params?.svg || p.params?.svgCode || p.params?.svgPath;
      if (svgCode && typeof svgCode === 'string') {
        geom = createGeometryFromSvgPath(svgCode, p, THREE_LIB);
      }
      if (!geom && svgCode && typeof svgCode === 'string') {
        console.warn('[geometryHelper] createGeometryFromSvgPath returned null. Attempting samplePoints fallback.');
        const samplePts = samplePointsFromSvgPath(svgCode, p.curveSegments || 32, THREE);
        if (Array.isArray(samplePts) && samplePts.length >= 3) {
          try {
            geom = createAdvancedExtrudeGeometry(samplePts, p, THREE_LIB);
          } catch (sampleErr) {
            console.warn('[geometryHelper] samplePoints extrusion fallback failed:', sampleErr);
          }
        }
      }
      if (!geom) {
        console.error('[geometryHelper] SVG geometry creation failed for type:', type, p);
        geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
      }
      break;
    }
    case 'vectorExtrude':
    case 'extrude': {
      if (p.svgPath || p.svg || p.svgCode) {
        geom = createGeometryFromSvgPath(p.svgPath || p.svg || p.svgCode, p, THREE_LIB);
      }

      if (!geom) {
        const inputPoints = p.points || p.rawPoints || [];
        let rawPoints = normalizeVectorPointsList(inputPoints);
        if (rawPoints.length < 3) {
          // Safe default shield contour if points are missing or malformed
          rawPoints = [
            { x: 0, y: -110 },
            { x: 75, y: -40 },
            { x: 70, y: 70 },
            { x: 0, y: 110 },
            { x: -70, y: 70 },
            { x: -75, y: -40 }
          ];
        }

        const isInflateMode = Boolean(p.inflateEnabled);

        if (isInflateMode) {
          try {
            geom = createInflatedGeometryFromPoints(rawPoints, {
              depth: Number(p.depth ?? p.inflationAmount ?? 0.35),
              depthFront: p.depthFront !== undefined ? Number(p.depthFront) : Number(p.depth ?? 0.35),
              depthBack: p.depthBack !== undefined ? Number(p.depthBack) : (p.symmetric !== false ? Number(p.depth ?? 0.35) : 0),
              curvatureProfile: p.curvatureProfile || p.profile || 'elliptic',
              symmetric: p.symmetric !== false,
              smoothPasses: p.smoothPasses !== undefined ? Number(p.smoothPasses) : 2,
              resolution: p.resolution !== undefined ? Number(p.resolution) : 24,
              rimDepth: Number(p.rimDepth ?? 0),
              scaleFactor: p.scaleFactor !== undefined ? Number(p.scaleFactor) : null,
              curveSegments: Number(p.curveSegments ?? 24),
              connectEdges: p.connectEdges !== false
            }, THREE_LIB);
          } catch (inflateErr) {
            console.warn('[geometryHelper] Inflation generation fallback in extrude mode:', inflateErr);
          }
        }

        if (!geom || hasNaNPositions(geom)) {
          try {
            geom = createAdvancedExtrudeGeometry(rawPoints, p, THREE_LIB);
            if (p.domeWarpEnabled && geom && !hasNaNPositions(geom)) {
              applyDomeDeformation(geom, {
                depth: Number(p.domeCurvature ?? p.domeWarpDepth ?? 0.2),
                curvature: Number(p.domeCurvature ?? p.domeWarpDepth ?? 0.2),
                falloff: p.domeFalloff || 'smoothstep',
                curvatureProfile: p.curvatureProfile || 'spherical',
                symmetric: p.symmetric !== false
              });
            }
          } catch (err) {
            console.warn('[geometryHelper] ExtrudeGeometry creation fallback:', err);
            geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
          }
        }
      }
      break;
    }
    default:
      geom = new THREE_LIB.BoxGeometry(1, 1, 1);
      break;
  }

  // Sanity check: Ensure geometry exists and has no NaN coordinates
  if (geom) {
    if (hasNaNPositions(geom)) {
      console.warn(`[geometryHelper] Geometry of type '${type}' contains NaN vertices. Replacing with safe BoxGeometry.`);
      geom.dispose();
      geom = new THREE_LIB.BoxGeometry(1, 1, 1);
    }
    if (!p.preserveOrigin && !p.keepOrigin && typeof geom.center === 'function') {
      geom.center();
    }
    geom.computeVertexNormals();
  }

  // Ensure UV coordinates exist for texture mapping across all geometry types
  if (geom && !geom.attributes.uv && geom.attributes.position && !hasNaNPositions(geom)) {
    try {
      if (!geom.boundingBox) geom.computeBoundingBox();
      const bb = geom.boundingBox;
      if (bb && isFinite(bb.min.x) && isFinite(bb.max.x) && isFinite(bb.min.y) && isFinite(bb.max.y)) {
        const rangeX = (bb.max.x - bb.min.x) || 1;
        const rangeY = (bb.max.y - bb.min.y) || 1;
        const pos = geom.attributes.position;
        const uvs = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          uvs[i * 2] = (x - bb.min.x) / rangeX;
          uvs[i * 2 + 1] = (y - bb.min.y) / rangeY;
        }
        geom.setAttribute('uv', new THREE_LIB.BufferAttribute(uvs, 2));
      }
    } catch (e) {
      console.warn('[geometryHelper] Auto UV generation fallback failed:', e);
    }
  }

  return geom;
}

export function createPrimitiveMaterial(options = {}, THREE_LIB = THREE) {
  // Dual-Material Cap/Bevel Shading (Enamel Badges, Dual-Tone Metallic Logos)
  // Three.js ExtrudeGeometry assigns index 0 to front/back caps and index 1 to sides/bevels
  const hasBevelMaterial = Boolean(
    options.bevelColor ||
    options.params?.bevelColor ||
    options.bevelMetalness !== undefined ||
    options.params?.bevelMetalness !== undefined ||
    options.bevelRoughness !== undefined ||
    options.params?.bevelRoughness !== undefined
  );

  if (hasBevelMaterial && !options._isSideMaterial && !options._forceSingle) {
    const capMat = createPrimitiveMaterial({ ...options, _isSideMaterial: true }, THREE_LIB);
    const sideColor = options.bevelColor || options.params?.bevelColor || '#e2e8f0';
    const sideMetalness = options.bevelMetalness !== undefined
      ? Number(options.bevelMetalness)
      : (options.params?.bevelMetalness !== undefined ? Number(options.params.bevelMetalness) : 0.95);
    const sideRoughness = options.bevelRoughness !== undefined
      ? Number(options.bevelRoughness)
      : (options.params?.bevelRoughness !== undefined ? Number(options.params.bevelRoughness) : 0.1);

    const sideMat = createPrimitiveMaterial({
      ...options,
      _isSideMaterial: true,
      color: sideColor,
      metalness: sideMetalness,
      roughness: sideRoughness,
      pattern: 'none',
      textureUrl: null
    }, THREE_LIB);

    return [capMat, sideMat];
  }

  const hasTexture = Boolean(options.textureUrl);
  const color = options.color || (hasTexture ? '#ffffff' : '#38bdf8');
  const roughness = options.roughness !== undefined ? Number(options.roughness) : 0.35;
  const metalness = options.metalness !== undefined ? Number(options.metalness) : 0.15;
  const emissive = options.emissive || '#000000';
  const emissiveIntensity = options.emissiveIntensity !== undefined ? Number(options.emissiveIntensity) : 0.0;
  const wireframe = Boolean(options.wireframe);
  const flatShading = Boolean(options.flatShading);
  const opacity = options.opacity !== undefined ? Number(options.opacity) : 1.0;
  const transmission = options.transmission !== undefined ? Number(options.transmission) : 0.0;
  const transparent = Boolean(options.transparent) || opacity < 1.0 || transmission > 0;

  const clearcoat = options.clearcoat !== undefined ? Number(options.clearcoat) : 0.0;
  const clearcoatRoughness = options.clearcoatRoughness !== undefined ? Number(options.clearcoatRoughness) : 0.1;
  const sheen = options.sheen !== undefined ? Number(options.sheen) : 0.0;
  const sheenRoughness = options.sheenRoughness !== undefined ? Number(options.sheenRoughness) : 0.5;
  const sheenColor = options.sheenColor || '#ffffff';
  const ior = options.ior !== undefined ? Number(options.ior) : 1.5;
  const thickness = options.thickness !== undefined ? Number(options.thickness) : 0.5;
  const normalScale = options.normalScale !== undefined ? Number(options.normalScale) : 1.0;
  const displacementScale = options.displacementScale !== undefined ? Number(options.displacementScale) : 0.0;
  const displacementBias = options.displacementBias !== undefined ? Number(options.displacementBias) : 0.0;

  const isPhysical = transmission > 0 || clearcoat > 0 || sheen > 0;
  const MaterialClass = isPhysical ? THREE_LIB.MeshPhysicalMaterial : THREE_LIB.MeshStandardMaterial;

  const matConfig = {
    color: new THREE_LIB.Color(color),
    roughness,
    metalness,
    emissive: new THREE_LIB.Color(emissive),
    emissiveIntensity,
    wireframe,
    flatShading,
    opacity,
    transparent,
    side: THREE_LIB.DoubleSide
  };

  if (isPhysical) {
    if (transmission > 0) {
      matConfig.transmission = transmission;
      matConfig.ior = ior;
      matConfig.thickness = thickness;
    }
    if (clearcoat > 0) {
      matConfig.clearcoat = clearcoat;
      matConfig.clearcoatRoughness = clearcoatRoughness;
    }
    if (sheen > 0) {
      matConfig.sheen = sheen;
      matConfig.sheenRoughness = sheenRoughness;
      matConfig.sheenColor = new THREE_LIB.Color(sheenColor);
    }
  }

  if (options.envMapIntensity !== undefined && Number(options.envMapIntensity) >= 0) {
    matConfig.envMapIntensity = Number(options.envMapIntensity);
  }

  const mat = new MaterialClass(matConfig);

  const applyTexProps = (tex) => {
    if (!tex) return;
    tex.wrapS = THREE_LIB.RepeatWrapping;
    tex.wrapT = THREE_LIB.RepeatWrapping;
    if (tex.center) tex.center.set(0.5, 0.5);

    const repX = options.textureRepeatX !== undefined && options.textureRepeatX !== null ? Number(options.textureRepeatX) : 1.0;
    const repY = options.textureRepeatY !== undefined && options.textureRepeatY !== null ? Number(options.textureRepeatY) : 1.0;
    const flipX = Boolean(options.textureFlipX);
    const flipY = Boolean(options.textureFlipY);
    const offX = options.textureOffsetX !== undefined && options.textureOffsetX !== null ? Number(options.textureOffsetX) : 0.0;
    const offY = options.textureOffsetY !== undefined && options.textureOffsetY !== null ? Number(options.textureOffsetY) : 0.0;
    const rotDeg = options.textureRotation !== undefined && options.textureRotation !== null ? Number(options.textureRotation) : 0.0;

    if (tex.repeat) tex.repeat.set(flipX ? -repX : repX, flipY ? -repY : repY);
    if (tex.offset) tex.offset.set(offX, offY);
    tex.rotation = (rotDeg * Math.PI) / 180;
    tex.needsUpdate = true;
  };

  if (hasTexture && typeof options.textureUrl === 'string') {
    try {
      const loader = new THREE_LIB.TextureLoader();
      const texture = loader.load(
        options.textureUrl,
        (loadedTex) => {
          if (THREE_LIB.SRGBColorSpace !== undefined) {
            loadedTex.colorSpace = THREE_LIB.SRGBColorSpace;
          }
          applyTexProps(loadedTex);
          mat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('[geometryHelper] Texture failed to load:', options.textureUrl, err);
        }
      );
      if (THREE_LIB.SRGBColorSpace !== undefined) {
        texture.colorSpace = THREE_LIB.SRGBColorSpace;
      }
      applyTexProps(texture);
      mat.map = texture;
    } catch (err) {
      console.warn('[geometryHelper] TextureLoader error:', err);
    }
  }

  // Normal Map channel
  const normalMapUrl = options.normalMapUrl || options.normalMap;
  if (normalMapUrl && typeof normalMapUrl === 'string') {
    try {
      const loader = new THREE_LIB.TextureLoader();
      const nTex = loader.load(normalMapUrl, (loadedTex) => {
        applyTexProps(loadedTex);
        mat.needsUpdate = true;
      });
      applyTexProps(nTex);
      mat.normalMap = nTex;
      if (mat.normalScale) {
        mat.normalScale.set(normalScale, normalScale);
      }
    } catch (err) {
      console.warn('[geometryHelper] NormalMap load error:', err);
    }
  }

  // Displacement Map channel
  const dispMapUrl = options.displacementMapUrl || options.displacementMap;
  if (dispMapUrl && typeof dispMapUrl === 'string') {
    try {
      const loader = new THREE_LIB.TextureLoader();
      const dTex = loader.load(dispMapUrl, (loadedTex) => {
        applyTexProps(loadedTex);
        mat.needsUpdate = true;
      });
      applyTexProps(dTex);
      mat.displacementMap = dTex;
      mat.displacementScale = displacementScale;
      mat.displacementBias = displacementBias;
    } catch (err) {
      console.warn('[geometryHelper] DisplacementMap load error:', err);
    }
  }

  // Emissive Map channel
  const emissiveMapUrl = options.emissiveMapUrl || options.emissiveMap;
  if (emissiveMapUrl && typeof emissiveMapUrl === 'string') {
    try {
      const loader = new THREE_LIB.TextureLoader();
      const eTex = loader.load(emissiveMapUrl, (loadedTex) => {
        if (THREE_LIB.SRGBColorSpace !== undefined) {
          loadedTex.colorSpace = THREE_LIB.SRGBColorSpace;
        }
        applyTexProps(loadedTex);
        mat.needsUpdate = true;
      });
      if (THREE_LIB.SRGBColorSpace !== undefined) {
        eTex.colorSpace = THREE_LIB.SRGBColorSpace;
      }
      applyTexProps(eTex);
      mat.emissiveMap = eTex;
    } catch (err) {
      console.warn('[geometryHelper] EmissiveMap load error:', err);
    }
  }

  // Procedural Surface Pattern Generator (gingham, checkerboard, twill-crosshatch, honeycomb, carbon-fiber, brushed-metal, grid, dots, camo)
  const patternType = options.pattern || options.params?.pattern || 'none';
  if (!mat.map && patternType && patternType !== 'none') {
    const patternTex = createProceduralPatternTexture(patternType, {
      patternScale: options.patternScale ?? options.params?.patternScale,
      patternColor: options.patternColor || options.params?.patternColor,
      patternSecondaryColor: options.patternSecondaryColor || options.params?.patternSecondaryColor,
      patternOpacity: options.patternOpacity ?? options.params?.patternOpacity
    }, THREE_LIB);

    if (patternTex) {
      mat.map = patternTex;
      mat.bumpMap = patternTex;
      mat.bumpScale = 0.015;
      mat.needsUpdate = true;
    }
  }

  return mat;
}

export function createPrimitiveMesh(geomConfig, THREE_LIB = THREE) {
  if (!geomConfig) return null;
  const svgContent = geomConfig.svg || geomConfig.params?.svg || geomConfig.svgPath || geomConfig.params?.svgPath || geomConfig.svgCode || geomConfig.params?.svgCode;
  const mergedParams = {
    ...(geomConfig.params || {}),
    ...(svgContent ? { svg: svgContent, svgPath: svgContent, svgCode: svgContent } : {}),
    ...(geomConfig.preserveOrigin !== undefined ? { preserveOrigin: geomConfig.preserveOrigin } : {}),
    ...(geomConfig.points ? { points: geomConfig.points } : {}),
    ...(geomConfig.depth !== undefined ? { depth: geomConfig.depth } : {})
  };
  const geom = createPrimitiveThreeGeometry(geomConfig.type, mergedParams, THREE_LIB);
  const mat = createPrimitiveMaterial(geomConfig, THREE_LIB);
  const mesh = new THREE_LIB.Mesh(geom, mat);
  mesh.name = geomConfig.name || `${geomConfig.type || 'geometry'}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(
    Number(geomConfig.posX ?? 0),
    Number(geomConfig.posY ?? 0),
    Number(geomConfig.posZ ?? 0)
  );
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(
    ((Number(geomConfig.rotX ?? 0)) * Math.PI) / 180,
    ((Number(geomConfig.rotY ?? 0)) * Math.PI) / 180,
    ((Number(geomConfig.rotZ ?? 0)) * Math.PI) / 180,
    'YXZ'
  );

  const scale = Number(geomConfig.scale ?? 1);
  const sx = Number(geomConfig.scaleX ?? scale);
  const sy = Number(geomConfig.scaleY ?? scale);
  const sz = Number(geomConfig.scaleZ ?? scale);
  mesh.scale.set(sx, sy, sz);

  mesh.userData = {
    ...(geomConfig || {}),
    isAdditionalGeometry: true,
    geometryId: geomConfig.id
  };

  return mesh;
}

export function createGeometriesGroup(geometriesList, THREE_LIB = THREE) {
  if (!Array.isArray(geometriesList) || geometriesList.length === 0) return null;
  const group = new THREE_LIB.Group();
  group.name = 'additional_geometries_group';

  geometriesList.forEach((item) => {
    if (!item || item.visible === false) return;
    const mesh = createPrimitiveMesh(item, THREE_LIB);
    if (mesh) group.add(mesh);
  });

  return group;
}

/**
 * Asynchronously loads external GLB/GLTF models and builds a Three.js Group
 * matching ar-custom-models in A-Frame (ARExperience & ARTest).
 */
export async function createCustomModelsGroup(modelsList = [], THREE_LIB = THREE) {
  const group = new THREE_LIB.Group();
  group.name = 'ar_custom_models_group';
  if (!Array.isArray(modelsList) || modelsList.length === 0) return group;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  for (const item of modelsList) {
    if (!item || item.visible === false || !item.url) continue;
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(item.url, resolve, undefined, reject);
      });
      const modelScene = gltf.scene || gltf.scenes?.[0];
      if (!modelScene) continue;

      const wrapper = new THREE_LIB.Group();
      wrapper.name = `custom_model_${item.name || item.id}`;
      wrapper.userData = {
        ...(item || {}),
        isCustomModel: true,
        modelId: item.id,
        initialY: Number(item.posY ?? 0)
      };

      // Auto-center geometry inside wrapper so pivot matches ar-custom-models in aframe
      const box = new THREE_LIB.Box3().setFromObject(modelScene);
      if (!box.isEmpty()) {
        const center = new THREE_LIB.Vector3();
        box.getCenter(center);
        modelScene.position.sub(center);
      }

      modelScene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.userData.modelId = item.id;
          node.userData.isCustomModel = true;
        }
      });

      wrapper.add(modelScene);

      wrapper.position.set(
        Number(item.posX ?? 0),
        Number(item.posY ?? 0),
        Number(item.posZ ?? 0)
      );
      wrapper.rotation.order = 'YXZ';
      wrapper.rotation.set(
        ((Number(item.rotX ?? 0)) * Math.PI) / 180,
        ((Number(item.rotY ?? 0)) * Math.PI) / 180,
        ((Number(item.rotZ ?? 0)) * Math.PI) / 180,
        'YXZ'
      );
      const scale = Number(item.scale ?? 1);
      wrapper.scale.set(
        Number(item.scaleX ?? scale),
        Number(item.scaleY ?? scale),
        Number(item.scaleZ ?? scale)
      );
      wrapper.visible = item.visible !== false;

      group.add(wrapper);
    } catch (err) {
      console.warn('[geometryHelper] Could not load custom model:', item.url, err);
    }
  }

  dracoLoader.dispose();
  return group;
}

/**
 * Computes exact surface position, orientation (normal/tangent frame),
 * and dimensions for any mesh or specific material/face group in 3D space.
 * Pure Three.js implementation with zero A-Frame coupling.
 */
export function computeGeometrySurfaceFrame(mesh, slotIndex = 0, THREE_LIB = THREE) {
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

// Polyfill Object3D prototype with pivot = null.
// Three.js GLTFExporter expects (object.pivot !== null) to imply that pivot is a Vector3.
// Cloned A-Frame entities and older Three instances have pivot === undefined,
// which causes GLTFExporter to execute _processNodeWithPivotAsync and crash with "Cannot read properties of undefined (reading 'x')".
if (typeof THREE !== 'undefined' && THREE.Object3D?.prototype) {
  if (THREE.Object3D.prototype.pivot === undefined) {
    THREE.Object3D.prototype.pivot = null;
  }
}
if (typeof window !== 'undefined' && window.AFRAME?.THREE?.Object3D?.prototype) {
  if (window.AFRAME.THREE.Object3D.prototype.pivot === undefined) {
    window.AFRAME.THREE.Object3D.prototype.pivot = null;
  }
}

/**
 * Deeply sanitizes a Three.js Object3D hierarchy prior to passing it to GLTFExporter.
 * Prevents runtime exceptions in Three.js GLTFExporter caused by:
 * 1. node.pivot === undefined (checked via `node.pivot !== null` in GLTFExporter)
 * 2. textures missing standard Vector2 transforms (offset, repeat, center)
 */
export function sanitizeHierarchyForGLTFExport(rootNode, THREE_LIB = THREE) {
  if (!rootNode) return;
  const cleanPlainUserData = (ud) => {
    if (!ud || typeof ud !== 'object') return {};
    const out = {};
    Object.entries(ud).forEach(([k, v]) => {
      if (k.startsWith('__')) return;
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (Array.isArray(v) || (typeof v === 'object' && !v.isObject3D && !v.isMaterial && !v.isTexture && !(typeof Element !== 'undefined' && v instanceof Element))) {
        try {
          out[k] = JSON.parse(JSON.stringify(v));
        } catch {
          // Ignore non-serializable nested userData entries
        }
      }
    });
    return out;
  };

  rootNode.traverse((node) => {
    // Ensure pivot is strictly null unless it is a valid Vector-like object with numeric coordinates
    if (!node.pivot || typeof node.pivot.x !== 'number' || typeof node.pivot.y !== 'number' || typeof node.pivot.z !== 'number') {
      node.pivot = null;
    }
    node.userData = cleanPlainUserData(node.userData);

    // Ensure materials restore any pre-video PBR materials and have well-formed Vector2 texture transforms
    if (node.isMesh && node.material) {
      const unwrapMat = (mat) => {
        if (!mat) return mat;
        if (mat.userData?.__originalPreVideoMaterial && typeof mat.userData.__originalPreVideoMaterial.clone === 'function') {
          return mat.userData.__originalPreVideoMaterial.clone();
        }
        return typeof mat.clone === 'function' ? mat.clone() : mat;
      };

      if (Array.isArray(node.material)) {
        node.material = node.material.map(unwrapMat);
      } else {
        node.material = unwrapMat(node.material);
      }

      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.userData = cleanPlainUserData(mat.userData);
        const textureProps = [
          'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
          'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
          'normalMap', 'roughnessMap', 'specularMap'
        ];
        textureProps.forEach((prop) => {
          const tex = mat[prop];
          if (tex && typeof tex === 'object') {
            if (tex.isVideoTexture || (typeof HTMLVideoElement !== 'undefined' && tex.image instanceof HTMLVideoElement)) {
              mat[prop] = null;
              mat.needsUpdate = true;
              return;
            }
            if (!tex.offset || typeof tex.offset.x !== 'number') tex.offset = new THREE_LIB.Vector2(0, 0);
            if (!tex.repeat || typeof tex.repeat.x !== 'number') tex.repeat = new THREE_LIB.Vector2(1, 1);
            if (!tex.center || typeof tex.center.x !== 'number') tex.center = new THREE_LIB.Vector2(0, 0);
          }
        });
      });
    }
  });
}


