import * as THREE from 'three';
import {
  createInflatedGeometryFromPoints,
  applyDomeDeformation,
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
      const rawPoints = p.points || [];
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
      const rawPoints = p.points || [];
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
      const frontPts = p.frontPoints || p.points || [];
      const topPts = p.topSidePoints || p.topPoints || [];
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
      const rawPoints = p.points || [];
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
          scaleFactor: Number(p.scaleFactor ?? 0.005),
          curveSegments: Number(p.curveSegments ?? 24),
          connectEdges: p.connectEdges !== false
        }, THREE_LIB);
      } catch (inflateErr) {
        console.warn('[geometryHelper] Inflation generation fallback:', inflateErr);
        geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
      }
      break;
    }
    case 'vectorExtrude':
    case 'extrude': {
      const rawPoints = p.points || [];
      if (!Array.isArray(rawPoints) || rawPoints.length < 3) {
        geom = new THREE_LIB.BoxGeometry(1, 1, 0.2);
        break;
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
            scaleFactor: Number(p.scaleFactor ?? 0.005),
            curveSegments: Number(p.curveSegments ?? 24),
            connectEdges: p.connectEdges !== false
          }, THREE_LIB);
        } catch (inflateErr) {
          console.warn('[geometryHelper] Inflation generation fallback in extrude mode:', inflateErr);
        }
      }

      if (!geom) {
        try {
          geom = createAdvancedExtrudeGeometry(rawPoints, p, THREE_LIB);
          if (p.domeWarpEnabled) {
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
      break;
    }
    default:
      geom = new THREE_LIB.BoxGeometry(1, 1, 1);
      break;
  }

  if (geom && typeof geom.center === 'function') {
    geom.center();
    geom.computeVertexNormals();
  }

  // Ensure UV coordinates exist for texture mapping across all geometry types
  if (geom && !geom.attributes.uv && geom.attributes.position) {
    try {
      if (!geom.boundingBox) geom.computeBoundingBox();
      const bb = geom.boundingBox;
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
    } catch (e) {
      console.warn('[geometryHelper] Auto UV generation fallback failed:', e);
    }
  }

  return geom;
}

export function createPrimitiveMaterial(options = {}, THREE_LIB = THREE) {
  const hasTexture = Boolean(options.textureUrl);
  const color = options.color || (hasTexture ? '#ffffff' : '#38bdf8');
  const roughness = options.roughness !== undefined ? Number(options.roughness) : 0.35;
  const metalness = options.metalness !== undefined ? Number(options.metalness) : 0.15;
  const emissive = options.emissive || '#000000';
  const emissiveIntensity = options.emissiveIntensity !== undefined ? Number(options.emissiveIntensity) : 0.0;
  const wireframe = Boolean(options.wireframe);
  const flatShading = Boolean(options.flatShading);
  const opacity = options.opacity !== undefined ? Number(options.opacity) : 1.0;
  const transparent = Boolean(options.transparent) || opacity < 1.0;

  const mat = new THREE_LIB.MeshStandardMaterial({
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
  });

  if (hasTexture && typeof options.textureUrl === 'string') {
    try {
      const loader = new THREE_LIB.TextureLoader();
      const applyTexProps = (tex) => {
        if (!tex) return;
        if (THREE_LIB.SRGBColorSpace !== undefined) {
          tex.colorSpace = THREE_LIB.SRGBColorSpace;
        }
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

      const texture = loader.load(
        options.textureUrl,
        (loadedTex) => {
          applyTexProps(loadedTex);
          mat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('[geometryHelper] Texture failed to load:', options.textureUrl, err);
        }
      );

      applyTexProps(texture);
      mat.map = texture;
    } catch (err) {
      console.warn('[geometryHelper] TextureLoader error:', err);
    }
  }

  return mat;
}

export function createPrimitiveMesh(geomConfig, THREE_LIB = THREE) {
  if (!geomConfig) return null;
  const geom = createPrimitiveThreeGeometry(geomConfig.type, geomConfig.params, THREE_LIB);
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
  mesh.rotation.set(
    ((Number(geomConfig.rotX ?? 0)) * Math.PI) / 180,
    ((Number(geomConfig.rotY ?? 0)) * Math.PI) / 180,
    ((Number(geomConfig.rotZ ?? 0)) * Math.PI) / 180
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

