import * as THREE from 'three';

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
  switch (type) {
    case 'box':
      return new THREE_LIB.BoxGeometry(
        p.width || 1,
        p.height || 1,
        p.depth || 1,
        p.widthSegments || 1,
        p.heightSegments || 1,
        p.depthSegments || 1
      );
    case 'sphere':
      return new THREE_LIB.SphereGeometry(
        p.radius || 0.6,
        p.widthSegments || 32,
        p.heightSegments || 32
      );
    case 'cylinder':
      return new THREE_LIB.CylinderGeometry(
        p.radiusTop !== undefined ? p.radiusTop : 0.5,
        p.radiusBottom !== undefined ? p.radiusBottom : 0.5,
        p.height || 1.2,
        p.radialSegments || 32
      );
    case 'cone':
      return new THREE_LIB.ConeGeometry(
        p.radius || 0.6,
        p.height || 1.3,
        p.radialSegments || 32
      );
    case 'torus':
      return new THREE_LIB.TorusGeometry(
        p.radius || 0.65,
        p.tube || 0.22,
        p.radialSegments || 24,
        p.tubularSegments || 48
      );
    case 'torusKnot':
      return new THREE_LIB.TorusKnotGeometry(
        p.radius || 0.55,
        p.tube || 0.16,
        p.tubularSegments || 80,
        p.radialSegments || 16,
        p.p || 2,
        p.q || 3
      );
    case 'capsule':
      if (typeof THREE_LIB.CapsuleGeometry === 'function') {
        return new THREE_LIB.CapsuleGeometry(
          p.radius || 0.4,
          p.length || 0.9,
          p.capSegments || 8,
          p.radialSegments || 24
        );
      }
      return new THREE_LIB.CylinderGeometry(
        p.radius || 0.4,
        p.radius || 0.4,
        (p.length || 0.9) + (p.radius || 0.4) * 2,
        24
      );
    case 'plane':
      return new THREE_LIB.PlaneGeometry(
        p.width || 2.5,
        p.height || 2.5,
        p.widthSegments || 1,
        p.heightSegments || 1
      );
    case 'ring':
      return new THREE_LIB.RingGeometry(
        p.innerRadius || 0.35,
        p.outerRadius || 0.85,
        p.thetaSegments || 32
      );
    case 'icosahedron':
      return new THREE_LIB.IcosahedronGeometry(
        p.radius || 0.7,
        p.detail || 0
      );
    case 'dodecahedron':
      return new THREE_LIB.DodecahedronGeometry(
        p.radius || 0.7,
        p.detail || 0
      );
    case 'tetrahedron':
      return new THREE_LIB.TetrahedronGeometry(
        p.radius || 0.75,
        p.detail || 0
      );
    default:
      return new THREE_LIB.BoxGeometry(1, 1, 1);
  }
}

export function createPrimitiveMaterial(options = {}, THREE_LIB = THREE) {
  const color = options.color || '#38bdf8';
  const roughness = options.roughness !== undefined ? Number(options.roughness) : 0.35;
  const metalness = options.metalness !== undefined ? Number(options.metalness) : 0.15;
  const wireframe = Boolean(options.wireframe);
  const flatShading = Boolean(options.flatShading);

  return new THREE_LIB.MeshStandardMaterial({
    color: new THREE_LIB.Color(color),
    roughness,
    metalness,
    wireframe,
    flatShading,
    side: THREE_LIB.DoubleSide
  });
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
