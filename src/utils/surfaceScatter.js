// src/utils/surfaceScatter.js
/**
 * Isolated, modular Surface Scattering & Foliage Distribution System.
 * Distributes procedural instances (leaves, grass, petals, pebbles, shapes)
 * across 3D surfaces in Three.js and A-Frame using hardware instancing (THREE.InstancedMesh).
 */

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

// Absolute safety cap on instance counts to protect mobile GPU thermal and frame budgets in WebGL/MindAR
export const MAX_SCATTER_INSTANCES = 5000;
export const DEFAULT_SCATTER_COUNT = 200;

// =========================================================================
// PSEUDO-RANDOM NUMBER GENERATOR (SEEDABLE MULBERRY32)
// Ensures reproducible, deterministic scattering based on seed integer
// =========================================================================
export function createSeededRandom(seed = 1) {
  let s = Math.floor(Math.abs(seed)) || 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =========================================================================
// PROCEDURAL PROTOTYPE GEOMETRY FACTORIES
// Generates lightweight, beautiful foliage & nature assets for InstancedMesh
// =========================================================================

/**
 * Creates a curved, tapered foliage leaf geometry with stem at (0, 0, 0)
 */
export function createLeafGeometry(THREE_LIB = THREE) {
  const shape = new THREE_LIB.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.035, 0.04, 0.025, 0.09);
  shape.quadraticCurveTo(0.015, 0.13, 0, 0.15);
  shape.quadraticCurveTo(-0.015, 0.13, -0.025, 0.09);
  shape.quadraticCurveTo(-0.035, 0.04, 0, 0);

  const geom = new THREE_LIB.ShapeGeometry(shape, 6);
  // Curve leaf slightly in Z to give natural 3D volume
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    // Displace z based on distance from center midrib and tip
    const zCurve = Math.sin((y / 0.15) * Math.PI) * 0.015 - Math.abs(x) * 0.15;
    pos.setZ(i, zCurve);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a clustered 3-blade grass tuft geometry
 */
export function createGrassGeometry(THREE_LIB = THREE) {
  const geom = new THREE_LIB.BufferGeometry();
  // 3 tapering blades: center, left-angled, right-angled
  const vertices = [
    // Center blade (triangle strip)
    -0.008, 0.0, 0.0,
    0.008, 0.0, 0.0,
    -0.005, 0.07, 0.005,
    0.005, 0.07, 0.005,
    0.0, 0.14, 0.01,

    // Left blade (curving -X, +Z)
    -0.006, 0.0, -0.003,
    0.004, 0.0, -0.003,
    -0.02, 0.05, 0.006,
    -0.012, 0.05, 0.006,
    -0.03, 0.1, 0.012,

    // Right blade (curving +X, -Z)
    -0.004, 0.0, 0.003,
    0.006, 0.0, 0.003,
    0.012, 0.05, -0.006,
    0.02, 0.05, -0.006,
    0.028, 0.11, -0.01
  ];

  const indices = [
    // Center blade faces
    0, 1, 2,  1, 3, 2,  2, 3, 4,
    // Left blade faces
    5, 6, 7,  6, 8, 7,  7, 8, 9,
    // Right blade faces
    10, 11, 12,  11, 13, 12,  12, 13, 14
  ];

  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a 5-petal flower blossom geometry
 */
export function createFlowerGeometry(THREE_LIB = THREE) {
  const shape = new THREE_LIB.Shape();
  const numPetals = 5;
  const outerR = 0.045;
  const innerR = 0.015;

  for (let i = 0; i <= numPetals * 2; i++) {
    const angle = (i * Math.PI) / numPetals;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geom = new THREE_LIB.ShapeGeometry(shape, 4);
  // Orient face upwards (along Y normal)
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a 3-leaf clover geometry
 */
export function createCloverGeometry(THREE_LIB = THREE) {
  const shape = new THREE_LIB.Shape();
  const petals = 3;
  const rMax = 0.04;
  for (let i = 0; i <= 60; i++) {
    const theta = (i / 60) * Math.PI * 2;
    const r = rMax * (0.4 + 0.6 * Math.abs(Math.sin(petals * theta * 0.5)));
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();

  const geom = new THREE_LIB.ShapeGeometry(shape, 6);
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a 5-needle pine cluster geometry
 */
export function createPineGeometry(THREE_LIB = THREE) {
  const geom = new THREE_LIB.BufferGeometry();
  const verts = [];
  const indices = [];

  const needleCount = 5;
  for (let i = 0; i < needleCount; i++) {
    const angle = (i / needleCount) * Math.PI * 2;
    const outward = 0.035;
    const height = 0.07;
    const bx = 0;
    const by = 0;
    const bz = 0;
    const tx = Math.cos(angle) * outward;
    const ty = height;
    const tz = Math.sin(angle) * outward;

    const baseIdx = i * 3;
    verts.push(bx - 0.003, by, bz);
    verts.push(bx + 0.003, by, bz);
    verts.push(tx, ty, tz);
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
  }

  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a low-poly pebble / river stone geometry
 */
export function createPebbleGeometry(THREE_LIB = THREE) {
  const geom = new THREE_LIB.DodecahedronGeometry(0.025, 0);
  geom.scale(1.2, 0.6, 1.4);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a faceted crystal shard geometry
 */
export function createCrystalGeometry(THREE_LIB = THREE) {
  const geom = new THREE_LIB.ConeGeometry(0.02, 0.08, 6);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Resolves or constructs a prototype geometry by name or preset string
 */
export function getPrototypeGeometry(protoKey = 'leaf', THREE_LIB = THREE) {
  const key = String(protoKey || 'leaf').toLowerCase().trim();
  switch (key) {
    case 'leaf':
    case 'foliage':
      return createLeafGeometry(THREE_LIB);
    case 'grass':
    case 'blade':
    case 'tuft':
      return createGrassGeometry(THREE_LIB);
    case 'flower':
    case 'blossom':
    case 'petal':
      return createFlowerGeometry(THREE_LIB);
    case 'clover':
      return createCloverGeometry(THREE_LIB);
    case 'pine':
    case 'needle':
      return createPineGeometry(THREE_LIB);
    case 'pebble':
    case 'stone':
    case 'rock':
      return createPebbleGeometry(THREE_LIB);
    case 'crystal':
    case 'gem':
      return createCrystalGeometry(THREE_LIB);
    case 'box':
    case 'cube':
      return new THREE_LIB.BoxGeometry(0.04, 0.04, 0.04);
    case 'sphere':
      return new THREE_LIB.SphereGeometry(0.03, 8, 8);
    case 'cone':
      return new THREE_LIB.ConeGeometry(0.03, 0.07, 8);
    case 'cylinder':
      return new THREE_LIB.CylinderGeometry(0.02, 0.02, 0.06, 8);
    default:
      return createLeafGeometry(THREE_LIB);
  }
}

// Available built-in prototype options
export const PROTOTYPE_OPTIONS = [
  { id: 'leaf', label: 'Broad Leaf', category: 'foliage', icon: 'park' },
  { id: 'grass', label: 'Grass Blades', category: 'foliage', icon: 'grass' },
  { id: 'flower', label: 'Flower Blossom', category: 'foliage', icon: 'local_florist' },
  { id: 'clover', label: 'Clover Leaf', category: 'foliage', icon: 'spa' },
  { id: 'pine', label: 'Pine Needles', category: 'foliage', icon: 'forest' },
  { id: 'pebble', label: 'River Pebble', category: 'nature', icon: 'grain' },
  { id: 'crystal', label: 'Crystal Shard', category: 'nature', icon: 'diamond' },
  { id: 'box', label: 'Cube / Box', category: 'shape', icon: 'square' },
  { id: 'sphere', label: 'Sphere', category: 'shape', icon: 'circle' },
  { id: 'cone', label: 'Cone', category: 'shape', icon: 'change_history' },
  { id: 'cylinder', label: 'Cylinder', category: 'shape', icon: 'database' }
];

// Presets for one-click styling in AR Test
export const SCATTER_PRESETS = [
  {
    id: 'lush_foliage',
    name: 'Lush Green Foliage',
    icon: 'park',
    prototype: 'leaf',
    count: 250,
    minScale: 0.8,
    maxScale: 1.4,
    randomRotation: 40,
    normalAlign: true,
    normalOffset: 0.005,
    color: '#4ade80',
    colorVariation: 0.25,
    roughness: 0.6,
    metalness: 0.05
  },
  {
    id: 'wild_grass',
    name: 'Wild Grass & Sprouts',
    icon: 'grass',
    prototype: 'grass',
    count: 350,
    minScale: 0.6,
    maxScale: 1.2,
    randomRotation: 25,
    normalAlign: true,
    normalOffset: 0.003,
    color: '#22c55e',
    colorVariation: 0.3,
    roughness: 0.8,
    metalness: 0.0
  },
  {
    id: 'blossom_meadow',
    name: 'Flower Blossom Meadow',
    icon: 'local_florist',
    prototype: 'flower',
    count: 180,
    minScale: 0.7,
    maxScale: 1.3,
    randomRotation: 50,
    normalAlign: true,
    normalOffset: 0.006,
    color: '#f472b6',
    colorVariation: 0.4,
    roughness: 0.5,
    metalness: 0.1
  },
  {
    id: 'lucky_clover',
    name: 'Lucky Clover Patches',
    icon: 'spa',
    prototype: 'clover',
    count: 220,
    minScale: 0.5,
    maxScale: 1.0,
    randomRotation: 35,
    normalAlign: true,
    normalOffset: 0.004,
    color: '#10b981',
    colorVariation: 0.2,
    roughness: 0.7,
    metalness: 0.05
  },
  {
    id: 'alpine_pine',
    name: 'Alpine Pine Needles',
    icon: 'forest',
    prototype: 'pine',
    count: 300,
    minScale: 0.5,
    maxScale: 1.1,
    randomRotation: 30,
    normalAlign: true,
    normalOffset: 0.004,
    color: '#15803d',
    colorVariation: 0.2,
    roughness: 0.75,
    metalness: 0.0
  },
  {
    id: 'riverbed_pebbles',
    name: 'Riverbed Stones & Pebbles',
    icon: 'grain',
    prototype: 'pebble',
    count: 150,
    minScale: 0.6,
    maxScale: 1.5,
    randomRotation: 60,
    normalAlign: true,
    normalOffset: 0.008,
    color: '#94a3b8',
    colorVariation: 0.35,
    roughness: 0.9,
    metalness: 0.15
  },
  {
    id: 'cyber_crystals',
    name: 'Cyber Crystal Shards',
    icon: 'diamond',
    prototype: 'crystal',
    count: 120,
    minScale: 0.7,
    maxScale: 1.6,
    randomRotation: 45,
    normalAlign: true,
    normalOffset: 0.01,
    color: '#38bdf8',
    colorVariation: 0.3,
    roughness: 0.2,
    metalness: 0.8
  }
];

// =========================================================================
// MULTI-MESH SURFACE SAMPLER UTILITY
// Area-weighted distribution across one or many submeshes in a 3D model
// =========================================================================

export class MultiMeshSurfaceSampler {
  /**
   * @param {THREE.Object3D|Array<THREE.Mesh>} target - Single mesh, array of meshes, or group
   * @param {Function} [randomFunc=Math.random] - RNG function
   */
  constructor(target, randomFunc = Math.random) {
    this.randomFunc = randomFunc;
    this.entries = []; // Array of { mesh, sampler, area }
    this.totalArea = 0;

    if (!target) return;

    const meshes = [];
    if (Array.isArray(target)) {
      target.forEach((m) => {
        if (m && m.isMesh && m.geometry && m.visible !== false) meshes.push(m);
      });
    } else if (target.isMesh && target.geometry) {
      if (target.visible !== false) meshes.push(target);
    } else if (target.traverse) {
      target.traverse((child) => {
        if (child.isMesh && child.geometry && child.visible !== false) {
          // Exclude helpers, gizmos, and pickers
          if (!child.name || !/helper|picker|gizmo|__starwear/i.test(child.name)) {
            meshes.push(child);
          }
        }
      });
    }

    // Build samplers and compute surface areas
    meshes.forEach((mesh) => {
      try {
        const geom = mesh.geometry;
        if (!geom.attributes.position || geom.attributes.position.count === 0) return;

        // Ensure normals exist
        if (!geom.attributes.normal) {
          geom.computeVertexNormals();
        }

        const sampler = new MeshSurfaceSampler(mesh);
        sampler.randomFunction = this.randomFunc;
        sampler.build();

        // Total surface area is the last value in the cumulative distribution array
        const area = (sampler.distribution && sampler.distribution.length > 0)
          ? sampler.distribution[sampler.distribution.length - 1]
          : 1.0;

        if (area > 0.000001) {
          mesh.updateWorldMatrix(true, false);
          this.entries.push({ mesh, sampler, area });
          this.totalArea += area;
        }
      } catch (err) {
        console.warn('[MultiMeshSurfaceSampler] Could not build sampler for mesh:', mesh.name || mesh.uuid, err);
      }
    });
  }

  get isReady() {
    return this.entries.length > 0 && this.totalArea > 0;
  }

  /**
   * Samples a random point and normal in world space from the target surface
   * @param {THREE.Vector3} targetPosition
   * @param {THREE.Vector3} targetNormal
   * @return {boolean} true if sampled successfully
   */
  sample(targetPosition, targetNormal) {
    if (!this.isReady) return false;

    // Pick entry weighted by relative surface area
    let entry = this.entries[0];
    if (this.entries.length > 1) {
      const pick = this.randomFunc() * this.totalArea;
      let accum = 0;
      for (let i = 0; i < this.entries.length; i++) {
        accum += this.entries[i].area;
        if (pick <= accum || i === this.entries.length - 1) {
          entry = this.entries[i];
          break;
        }
      }
    }

    // Sample local position and normal from the chosen mesh
    entry.sampler.sample(targetPosition, targetNormal);

    // Transform local coordinates into world space using mesh matrixWorld
    targetPosition.applyMatrix4(entry.mesh.matrixWorld);
    targetNormal.transformDirection(entry.mesh.matrixWorld).normalize();

    return true;
  }
}

// =========================================================================
// HARDWARE INSTANCING GENERATOR (THREE.InstancedMesh)
// =========================================================================

/**
 * Procedurally generates a THREE.InstancedMesh distributed across a target surface
 * @param {Object} options
 * @return {THREE.InstancedMesh|null}
 */
export function generateSurfaceScatterMesh(options = {}) {
  const {
    target, // THREE.Object3D, Mesh, or array
    prototype = 'leaf', // string key, THREE.Geometry, or THREE.Mesh
    count = DEFAULT_SCATTER_COUNT,
    minScale = 0.8,
    maxScale = 1.2,
    randomRotation = 45, // degrees jitter
    normalAlign = true,
    normalOffset = 0.005, // elevation above surface
    color = '#4ade80',
    colorVariation = 0.2, // 0 to 1 HSL jitter
    roughness = 0.7,
    metalness = 0.1,
    seed = 1,
    anchorObject = null, // Anchor Object3D whose local coordinate space will contain the InstancedMesh
    THREE_LIB = THREE
  } = options;

  if (!target) return null;

  // Clamped instance count (safety capped for mobile AR thermal / draw-call budgets)
  const safeCount = Math.max(1, Math.min(Math.floor(count) || DEFAULT_SCATTER_COUNT, MAX_SCATTER_INSTANCES));

  // Build RNG
  const rng = createSeededRandom(seed);

  // Build MultiMesh Surface Sampler
  const sampler = new MultiMeshSurfaceSampler(target, rng);
  if (!sampler.isReady) {
    return null;
  }

  // Resolve Prototype Geometry and Material
  let protoGeom = null;
  let protoMat = null;

  if (typeof prototype === 'string') {
    protoGeom = getPrototypeGeometry(prototype, THREE_LIB);
  } else if (prototype?.isBufferGeometry) {
    protoGeom = prototype.clone();
  } else if (prototype?.isMesh && prototype.geometry) {
    protoGeom = prototype.geometry.clone();
    if (prototype.material) {
      protoMat = Array.isArray(prototype.material) ? prototype.material[0].clone() : prototype.material.clone();
    }
  } else {
    protoGeom = createLeafGeometry(THREE_LIB);
  }

  if (!protoMat) {
    protoMat = new THREE_LIB.MeshStandardMaterial({
      color: new THREE_LIB.Color(color || '#4ade80'),
      roughness: Number(roughness ?? 0.7),
      metalness: Number(metalness ?? 0.1),
      side: THREE_LIB.DoubleSide,
      shadowSide: THREE_LIB.DoubleSide
    });
  }

  // Construct hardware InstancedMesh
  const instancedMesh = new THREE_LIB.InstancedMesh(protoGeom, protoMat, safeCount);
  instancedMesh.name = `surface_scatter_${prototype}_${safeCount}`;
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;
  // Ensure pivot is strictly null for GLTFExporter parity
  instancedMesh.pivot = null;

  // Temporary transform variables
  const tempPos = new THREE_LIB.Vector3();
  const tempNorm = new THREE_LIB.Vector3();
  const tempQuat = new THREE_LIB.Quaternion();
  const tempScale = new THREE_LIB.Vector3();
  const tempMat4 = new THREE_LIB.Matrix4();
  const defaultUp = new THREE_LIB.Vector3(0, 1, 0);

  // Prepare anchor world inversion matrix if instancedMesh is parented inside an anchor
  const invAnchor = new THREE_LIB.Matrix4();
  if (anchorObject && anchorObject.matrixWorld) {
    anchorObject.updateWorldMatrix(true, false);
    invAnchor.copy(anchorObject.matrixWorld).invert();
  }

  // Color variation base
  const baseColor = new THREE_LIB.Color(color || '#4ade80');
  const baseHSL = {};
  baseColor.getHSL(baseHSL);

  const rotRad = THREE_LIB.MathUtils.degToRad(Number(randomRotation) || 0);

  for (let i = 0; i < safeCount; i++) {
    // 1. Sample position and normal in world space
    sampler.sample(tempPos, tempNorm);

    // 2. Transform into anchor's local space if anchor was provided
    if (anchorObject) {
      tempPos.applyMatrix4(invAnchor);
      tempNorm.transformDirection(invAnchor).normalize();
    }

    // 3. Normal Offset (elevate instance slightly along normal to prevent clipping into host surface)
    if (normalOffset) {
      tempPos.addScaledVector(tempNorm, Number(normalOffset));
    }

    // 4. Orientation & Normal Alignment
    if (normalAlign) {
      // Align Y axis to underlying surface normal
      tempQuat.setFromUnitVectors(defaultUp, tempNorm);

      // Random 360-degree spin around surface normal
      const spinAngle = (rng() * 2 - 1) * Math.PI;
      const spinQuat = new THREE_LIB.Quaternion().setFromAxisAngle(tempNorm, spinAngle);
      tempQuat.premultiply(spinQuat);

      // Pitch / Yaw Jitter
      if (rotRad > 0.0001) {
        const jitterAxis = new THREE_LIB.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
        const jitterAngle = (rng() * 2 - 1) * rotRad;
        const jitterQuat = new THREE_LIB.Quaternion().setFromAxisAngle(jitterAxis, jitterAngle);
        tempQuat.multiply(jitterQuat);
      }
    } else {
      // Free random 3D rotation
      const euler = new THREE_LIB.Euler(
        (rng() * 2 - 1) * rotRad,
        rng() * Math.PI * 2,
        (rng() * 2 - 1) * rotRad
      );
      tempQuat.setFromEuler(euler);
    }

    // 5. Random Scale variation within [minScale, maxScale]
    const s = Number(minScale) + rng() * Math.max(0.001, Number(maxScale) - Number(minScale));
    tempScale.set(s, s, s);

    // 6. Pack into transform matrix
    tempMat4.compose(tempPos, tempQuat, tempScale);
    instancedMesh.setMatrixAt(i, tempMat4);

    // 7. Per-instance color variation
    if (colorVariation > 0) {
      const h = (baseHSL.h + (rng() * 2 - 1) * colorVariation * 0.08 + 1) % 1;
      const sat = THREE_LIB.MathUtils.clamp(baseHSL.s + (rng() * 2 - 1) * colorVariation * 0.15, 0, 1);
      const l = THREE_LIB.MathUtils.clamp(baseHSL.l + (rng() * 2 - 1) * colorVariation * 0.15, 0.1, 0.9);
      const instColor = new THREE_LIB.Color().setHSL(h, sat, l);
      instancedMesh.setColorAt(i, instColor);
    } else {
      instancedMesh.setColorAt(i, baseColor);
    }
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }

  return instancedMesh;
}

// =========================================================================
// A-FRAME COMPONENT REGISTRATION: `surface-scatter` & `ar-surface-scatter`
// =========================================================================

export function registerSurfaceScatterComponent() {
  const AFRAME = typeof window !== 'undefined' ? window.AFRAME : null;
  if (!AFRAME || AFRAME.components['surface-scatter']) return;

  const componentDefinition = {
    schema: {
      enabled: { type: 'boolean', default: true },
      target: { type: 'string', default: '#ar-model' }, // Selector for host mesh entity
      prototype: { type: 'string', default: 'leaf' }, // Prototype preset or selector
      count: { type: 'number', default: DEFAULT_SCATTER_COUNT },
      minScale: { type: 'number', default: 0.8 },
      maxScale: { type: 'number', default: 1.2 },
      randomRotation: { type: 'number', default: 45 },
      normalAlign: { type: 'boolean', default: true },
      normalOffset: { type: 'number', default: 0.005 },
      color: { type: 'color', default: '#4ade80' },
      colorVariation: { type: 'number', default: 0.2 },
      roughness: { type: 'number', default: 0.7 },
      metalness: { type: 'number', default: 0.1 },
      seed: { type: 'number', default: 1 }
    },

    init: function () {
      const THREE_LIB = window.AFRAME?.THREE || THREE;
      this.scatterRoot = new THREE_LIB.Group();
      this.scatterRoot.name = 'ar_surface_scatter_root';
      this.scatterRoot.pivot = null;
      this.el.setObject3D('scatterRoot', this.scatterRoot);

      this.instancedMesh = null;
      this.targetEl = null;
      this._updateTimer = null;

      // Re-generate listener bound to target model loading
      this.onTargetModelLoaded = () => {
        this.scheduleGenerate();
      };
    },

    update: function (oldData) {
      if (!this.data.enabled) {
        this.cleanupMesh();
        return;
      }

      // If target selector changed, re-bind listeners
      if (!oldData || oldData.target !== this.data.target) {
        this.unbindTarget();
        this.bindTarget();
      }

      this.scheduleGenerate();
    },

    bindTarget: function () {
      if (!this.data.target) return;
      try {
        this.targetEl = document.querySelector(this.data.target);
        if (this.targetEl) {
          this.targetEl.addEventListener('model-loaded', this.onTargetModelLoaded);
        }
      } catch (err) {
        console.warn('[surface-scatter] Could not bind to target:', this.data.target, err);
      }
    },

    unbindTarget: function () {
      if (this.targetEl) {
        this.targetEl.removeEventListener('model-loaded', this.onTargetModelLoaded);
        this.targetEl = null;
      }
    },

    scheduleGenerate: function () {
      if (this._updateTimer) clearTimeout(this._updateTimer);
      // Small debounce (40ms) to consolidate rapid slider/state updates
      this._updateTimer = setTimeout(() => {
        this.generateScatter();
      }, 40);
    },

    resolveTargetObject: function () {
      if (!this.data.target) return null;

      // 1. Check direct querySelector
      let el = null;
      try {
        el = document.querySelector(this.data.target);
      } catch {}

      if (el) {
        return el.getObject3D('mesh') || el.object3D || null;
      }

      // 2. Check scene graph by name, uuid, or userData IDs
      const sceneEl = this.el.sceneEl;
      if (sceneEl?.object3D) {
        let found = null;
        sceneEl.object3D.traverse((child) => {
          if (!found && (
            child.name === this.data.target ||
            child.uuid === this.data.target ||
            child.userData?.geometryId === this.data.target ||
            child.userData?.customModelId === this.data.target ||
            child.userData?.id === this.data.target
          )) {
            found = child;
          }
        });
        if (found) return found;
      }

      return null;
    },

    resolvePrototype: function () {
      const proto = this.data.prototype;
      if (!proto) return 'leaf';

      // Check if it's a CSS selector for an entity
      if (proto.startsWith('#') || proto.startsWith('.')) {
        try {
          const el = document.querySelector(proto);
          const mesh = el?.getObject3D('mesh');
          if (mesh) return mesh;
        } catch {}
      }

      return proto;
    },

    generateScatter: function () {
      if (!this.data.enabled) {
        this.cleanupMesh();
        return;
      }

      const THREE_LIB = window.AFRAME?.THREE || THREE;
      const targetObj = this.resolveTargetObject();

      if (!targetObj) {
        // Target mesh might still be downloading/loading
        return;
      }

      // Cleanup existing mesh before generating new one
      this.cleanupMesh();

      const proto = this.resolvePrototype();

      this.instancedMesh = generateSurfaceScatterMesh({
        target: targetObj,
        prototype: proto,
        count: this.data.count,
        minScale: this.data.minScale,
        maxScale: this.data.maxScale,
        randomRotation: this.data.randomRotation,
        normalAlign: this.data.normalAlign,
        normalOffset: this.data.normalOffset,
        color: this.data.color,
        colorVariation: this.data.colorVariation,
        roughness: this.data.roughness,
        metalness: this.data.metalness,
        seed: this.data.seed,
        anchorObject: this.el.object3D,
        THREE_LIB
      });

      if (this.instancedMesh && this.scatterRoot) {
        this.scatterRoot.add(this.instancedMesh);
        this.scatterRoot.updateMatrixWorld(true);
        this.el.emit('surface-scatter-generated', { count: this.data.count, target: this.data.target });
      }
    },

    cleanupMesh: function () {
      if (this.instancedMesh) {
        if (this.instancedMesh.parent) {
          this.instancedMesh.parent.remove(this.instancedMesh);
        }
        if (this.instancedMesh.geometry) {
          try { this.instancedMesh.geometry.dispose(); } catch {}
        }
        if (this.instancedMesh.material) {
          const mats = Array.isArray(this.instancedMesh.material) ? this.instancedMesh.material : [this.instancedMesh.material];
          mats.forEach((m) => {
            try { m.dispose(); } catch {}
          });
        }
        this.instancedMesh = null;
      }
    },

    remove: function () {
      if (this._updateTimer) clearTimeout(this._updateTimer);
      this.unbindTarget();
      this.cleanupMesh();
      if (this.scatterRoot) {
        this.el.removeObject3D('scatterRoot');
        this.scatterRoot = null;
      }
    }
  };

  AFRAME.registerComponent('surface-scatter', componentDefinition);
  AFRAME.registerComponent('ar-surface-scatter', componentDefinition);
}

// Auto-register immediately if AFRAME is already on window
if (typeof window !== 'undefined' && window.AFRAME) {
  registerSurfaceScatterComponent();
}
