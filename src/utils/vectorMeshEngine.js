/**
 * vectorMeshEngine.js
 * 
 * Modular Procedural Vector-to-3D Geometry Synthesizer
 * Implements the architecture from vector_to_mesh_feature_architecture.md:
 * 1. Extrude & Solidify/Shell Modifier (with directional taper, twist, and rim walls)
 * 2. Organic Inflation (SDF-based distance field Poisson ballooning with asymmetric front/back depth)
 * 3. Revolve / Lathe Surface Synthesizer (rotational surface generation around Y or X axis with caps)
 * 4. Cross-Sectional Loft & Sweep (parallel transport Bishop frames, guide rails, scale falloff)
 * 5. Multi-View Silhouette Carving (constructive visual hull intersection from orthogonal curves)
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  samplePolygonFromVectorPoints,
  isPointInsidePolygon,
  distanceToPolygonBoundary,
  triangulate2D,
  createInflatedGeometryFromPoints,
  INFLATION_PROFILES,
  INFLATION_PROFILE_MAP
} from './inflationEngine.js';
import { extractIsosurface } from './marchingCubesHelper.js';

export { INFLATION_PROFILES, INFLATION_PROFILE_MAP };

// Mode definitions for Vector Pen Studio UI
export const VECTOR_GENERATION_MODES = [
  {
    id: 'extrude',
    name: 'Extrude & Shell',
    icon: 'straighten',
    badge: 'SOLID / SHELL',
    description: 'Extrude vector face with directional taper, edge beveling, and hollow solidify modifier.'
  },
  {
    id: 'inflate',
    name: 'Organic Inflation',
    icon: 'bubble_chart',
    badge: 'POISSON 3D',
    description: 'Distance-field SDF ballooning with asymmetric front/back depth and continuous curvature.'
  },
  {
    id: 'revolve',
    name: 'Revolve (Lathe)',
    icon: 'rotate_right',
    badge: '360° LATHE',
    description: 'Rotational 360° or partial surface of revolution around vertical or horizontal axis.'
  },
  {
    id: 'sweep',
    name: 'Sweep & Loft',
    icon: 'timeline',
    badge: 'RAIL GUIDE',
    description: 'Sweep 2D cross-section along 3D guide curves with twist control and scale falloffs.'
  },
  {
    id: 'carve',
    name: 'Silhouette Carve',
    icon: 'view_in_ar',
    badge: 'VISUAL HULL',
    description: 'Dual-orthogonal vector carving intersecting Front and Top silhouettes into a 3D manifold.'
  }
];

// Revolve Presets
export const REVOLVE_PRESETS = [
  {
    id: 'wine_glass',
    name: 'Goblet / Wine Glass',
    icon: 'local_bar',
    axis: 'Y',
    angle: 360,
    offset: 0,
    createPoints: () => [
      { x: 3, y: -130, handleIn: null, handleOut: { x: 25, y: 0 }, type: 'smooth' },
      { x: 65, y: -125, handleIn: { x: -20, y: 0 }, handleOut: { x: 5, y: 15 }, type: 'smooth' },
      { x: 12, y: -90, handleIn: { x: 15, y: -15 }, handleOut: { x: 0, y: 40 }, type: 'smooth' },
      { x: 10, y: 10, handleIn: { x: 0, y: -40 }, handleOut: { x: 5, y: 20 }, type: 'smooth' },
      { x: 80, y: 60, handleIn: { x: -30, y: -10 }, handleOut: { x: 10, y: 45 }, type: 'smooth' },
      { x: 65, y: 130, handleIn: { x: 5, y: -30 }, handleOut: null, type: 'corner' },
      { x: 58, y: 130, handleIn: null, handleOut: { x: 0, y: -25 }, type: 'smooth' },
      { x: 70, y: 65, handleIn: { x: 10, y: 35 }, handleOut: { x: -25, y: -10 }, type: 'smooth' },
      { x: 5, y: 25, handleIn: { x: 20, y: 10 }, handleOut: { x: 0, y: -40 }, type: 'smooth' },
      { x: 3, y: -120, handleIn: { x: 0, y: 30 }, handleOut: null, type: 'corner' }
    ]
  },
  {
    id: 'greek_vase',
    name: 'Amphora / Vase',
    icon: 'liquor',
    axis: 'Y',
    angle: 360,
    offset: 0,
    createPoints: () => [
      { x: 15, y: -130, handleIn: null, handleOut: { x: 30, y: 0 }, type: 'smooth' },
      { x: 55, y: -120, handleIn: { x: -15, y: -5 }, handleOut: { x: 0, y: 25 }, type: 'smooth' },
      { x: 25, y: -80, handleIn: { x: 10, y: -20 }, handleOut: { x: 0, y: 20 }, type: 'smooth' },
      { x: 85, y: -10, handleIn: { x: -20, y: -45 }, handleOut: { x: 0, y: 45 }, type: 'smooth' },
      { x: 30, y: 70, handleIn: { x: 25, y: -20 }, handleOut: { x: 0, y: 25 }, type: 'smooth' },
      { x: 45, y: 130, handleIn: { x: -10, y: -20 }, handleOut: null, type: 'corner' },
      { x: 38, y: 130, handleIn: null, handleOut: { x: -5, y: -15 }, type: 'smooth' },
      { x: 22, y: 75, handleIn: { x: 0, y: 20 }, handleOut: { x: 20, y: -15 }, type: 'smooth' },
      { x: 75, y: -10, handleIn: { x: 0, y: 40 }, handleOut: { x: -15, y: -40 }, type: 'smooth' },
      { x: 18, y: -75, handleIn: { x: 0, y: 15 }, handleOut: { x: 8, y: -15 }, type: 'smooth' },
      { x: 15, y: -120, handleIn: { x: 0, y: 20 }, handleOut: null, type: 'corner' }
    ]
  },
  {
    id: 'column_pedestal',
    name: 'Architectural Pedestal',
    icon: 'temple_hindu',
    axis: 'Y',
    angle: 360,
    offset: 0,
    createPoints: () => [
      { x: 10, y: -130, handleIn: null, handleOut: null, type: 'corner' },
      { x: 85, y: -130, handleIn: null, handleOut: null, type: 'corner' },
      { x: 85, y: -100, handleIn: null, handleOut: { x: -25, y: 10 }, type: 'smooth' },
      { x: 45, y: -70, handleIn: { x: 15, y: -10 }, handleOut: { x: 0, y: 50 }, type: 'smooth' },
      { x: 45, y: 70, handleIn: { x: 0, y: -50 }, handleOut: { x: 15, y: 10 }, type: 'smooth' },
      { x: 85, y: 100, handleIn: { x: -25, y: -10 }, handleOut: null, type: 'corner' },
      { x: 85, y: 130, handleIn: null, handleOut: null, type: 'corner' },
      { x: 10, y: 130, handleIn: null, handleOut: null, type: 'corner' }
    ]
  }
];

// Sweep Guide Spine Presets
export const SWEEP_SPINE_PRESETS = [
  { id: 'arc', name: 'Curved Arch (180°)', icon: 'circle' },
  { id: 's_curve', name: 'Organic S-Curve', icon: 'timeline' },
  { id: 'helix', name: '3D Spiral Coil', icon: 'all_inclusive' },
  { id: 'wave', name: 'Sinusoidal Wave', icon: 'waves' },
  { id: 'linear', name: 'Directional Rail', icon: 'straighten' }
];

// Carve Dual Silhouette Presets
export const CARVE_PRESETS = [
  {
    id: 'sports_car',
    name: 'Aerodynamic Sports Car',
    icon: 'directions_car',
    frontPoints: [
      { x: -140, y: 20, handleIn: null, handleOut: { x: 25, y: -30 }, type: 'smooth' },
      { x: -60, y: -20, handleIn: { x: -30, y: 10 }, handleOut: { x: 35, y: -25 }, type: 'smooth' },
      { x: 10, y: -45, handleIn: { x: -35, y: 10 }, handleOut: { x: 40, y: 5 }, type: 'smooth' },
      { x: 80, y: -30, handleIn: { x: -25, y: -10 }, handleOut: { x: 35, y: 15 }, type: 'smooth' },
      { x: 140, y: 15, handleIn: { x: -20, y: -20 }, handleOut: null, type: 'corner' },
      { x: 140, y: 40, handleIn: null, handleOut: null, type: 'corner' },
      { x: -140, y: 40, handleIn: null, handleOut: null, type: 'corner' }
    ],
    topPoints: [
      { x: -140, y: 0, handleIn: { x: 0, y: 20 }, handleOut: { x: 0, y: -20 }, type: 'smooth' },
      { x: -90, y: -45, handleIn: { x: -25, y: 0 }, handleOut: { x: 45, y: 0 }, type: 'smooth' },
      { x: 20, y: -55, handleIn: { x: -45, y: 0 }, handleOut: { x: 45, y: 0 }, type: 'smooth' },
      { x: 120, y: -40, handleIn: { x: -35, y: 0 }, handleOut: { x: 15, y: 0 }, type: 'smooth' },
      { x: 140, y: 0, handleIn: { x: 0, y: -20 }, handleOut: { x: 0, y: 20 }, type: 'smooth' },
      { x: 120, y: 40, handleIn: { x: 15, y: 0 }, handleOut: { x: -35, y: 0 }, type: 'smooth' },
      { x: 20, y: 55, handleIn: { x: 45, y: 0 }, handleOut: { x: -45, y: 0 }, type: 'smooth' },
      { x: -90, y: 45, handleIn: { x: 45, y: 0 }, handleOut: { x: -25, y: 0 }, type: 'smooth' }
    ]
  },
  {
    id: 'supersonic_jet',
    name: 'Futuristic Delta Jet',
    icon: 'flight',
    frontPoints: [
      { x: -150, y: 0, handleIn: null, handleOut: { x: 40, y: -10 }, type: 'smooth' },
      { x: -20, y: -25, handleIn: { x: -40, y: 10 }, handleOut: { x: 60, y: -10 }, type: 'smooth' },
      { x: 90, y: -45, handleIn: { x: -30, y: 15 }, handleOut: { x: 25, y: 0 }, type: 'smooth' },
      { x: 140, y: -45, handleIn: null, handleOut: null, type: 'corner' },
      { x: 140, y: 15, handleIn: null, handleOut: null, type: 'corner' },
      { x: 30, y: 15, handleIn: { x: 40, y: 0 }, handleOut: { x: -60, y: 0 }, type: 'smooth' },
      { x: -150, y: 0, handleIn: null, handleOut: null, type: 'corner' }
    ],
    topPoints: [
      { x: -150, y: 0, handleIn: { x: 0, y: 15 }, handleOut: { x: 0, y: -15 }, type: 'smooth' },
      { x: -60, y: -20, handleIn: { x: -35, y: 5 }, handleOut: { x: 30, y: -10 }, type: 'smooth' },
      { x: 40, y: -110, handleIn: { x: -40, y: 30 }, handleOut: { x: 30, y: 0 }, type: 'corner' },
      { x: 140, y: -65, handleIn: null, handleOut: null, type: 'corner' },
      { x: 135, y: 0, handleIn: { x: 0, y: -15 }, handleOut: { x: 0, y: 15 }, type: 'smooth' },
      { x: 140, y: 65, handleIn: null, handleOut: null, type: 'corner' },
      { x: 40, y: 110, handleIn: { x: 30, y: 0 }, handleOut: { x: -40, y: -30 }, type: 'corner' },
      { x: -60, y: 20, handleIn: { x: 30, y: 10 }, handleOut: { x: -35, y: -5 }, type: 'smooth' }
    ]
  },
  {
    id: 'sneaker_chassis',
    name: 'Wedge Sneaker Profile',
    icon: 'skateboarding',
    frontPoints: [
      { x: -130, y: 40, handleIn: null, handleOut: { x: 30, y: -20 }, type: 'smooth' },
      { x: -70, y: -10, handleIn: { x: -20, y: 10 }, handleOut: { x: 40, y: -30 }, type: 'smooth' },
      { x: 10, y: -50, handleIn: { x: -20, y: 10 }, handleOut: { x: 25, y: 10 }, type: 'smooth' },
      { x: 70, y: -20, handleIn: { x: -20, y: -15 }, handleOut: { x: 30, y: 15 }, type: 'smooth' },
      { x: 130, y: 15, handleIn: { x: -20, y: -20 }, handleOut: null, type: 'corner' },
      { x: 130, y: 55, handleIn: null, handleOut: null, type: 'corner' },
      { x: -130, y: 55, handleIn: null, handleOut: null, type: 'corner' }
    ],
    topPoints: [
      { x: -130, y: 0, handleIn: { x: 0, y: 20 }, handleOut: { x: 0, y: -20 }, type: 'smooth' },
      { x: -80, y: -45, handleIn: { x: -20, y: 0 }, handleOut: { x: 40, y: 0 }, type: 'smooth' },
      { x: 10, y: -35, handleIn: { x: -30, y: 0 }, handleOut: { x: 40, y: 0 }, type: 'smooth' },
      { x: 90, y: -50, handleIn: { x: -30, y: 0 }, handleOut: { x: 20, y: 0 }, type: 'smooth' },
      { x: 130, y: 0, handleIn: { x: 0, y: -25 }, handleOut: { x: 0, y: 25 }, type: 'smooth' },
      { x: 90, y: 50, handleIn: { x: 20, y: 0 }, handleOut: { x: -30, y: 0 }, type: 'smooth' },
      { x: 10, y: 35, handleIn: { x: 40, y: 0 }, handleOut: { x: -30, y: 0 }, type: 'smooth' },
      { x: -80, y: 45, handleIn: { x: 40, y: 0 }, handleOut: { x: -20, y: 0 }, type: 'smooth' }
    ]
  }
];

// Helper: Earcut Triangulation on Flat 2D Points Array
function triangulatePolygonEarcut(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return [];
  // Use Bowyer-Watson Delaunay on boundary
  return triangulate2D(pts).filter((t) => {
    const cx = (pts[t.a].x + pts[t.b].x + pts[t.c].x) / 3;
    const cy = (pts[t.a].y + pts[t.b].y + pts[t.c].y) / 3;
    return isPointInsidePolygon(cx, cy, pts);
  });
}

// =============================================================================
// 1. REVOLVE / LATHE SURFACE SYNTHESIZER
// =============================================================================

/**
 * Creates 3D Lathe Geometry by revolving a 2D vector curve around an axis (Y or X).
 */
export function createRevolvedGeometryFromPoints(rawPoints, options = {}, THREE_LIB = THREE) {
  const scaleFactor = Number(options.scaleFactor ?? 0.005);
  const curveSegments = Math.max(12, Number(options.curveSegments ?? 32));
  const revolveAngleDeg = Math.min(360, Math.max(10, Number(options.revolveAngle ?? 360)));
  const revolveAngleRad = (revolveAngleDeg * Math.PI) / 180;
  const revolveSegments = Math.max(12, Math.min(64, Number(options.revolveSegments ?? 32)));
  const revolveAxis = (options.revolveAxis || 'Y').toUpperCase(); // 'Y' | 'X'
  const axisOffset = Number(options.axisOffset ?? 0);
  const capEnds = options.capEnds !== false;

  const boundaryPts = samplePolygonFromVectorPoints(rawPoints, scaleFactor, curveSegments, THREE_LIB);
  if (boundaryPts.length < 2) {
    return new THREE_LIB.CylinderGeometry(0.5, 0.5, 1, 32);
  }

  // Profile curve coordinates (U along axis, V radius from axis)
  // For 'Y' axis: U = y, V = |x - axisOffset|
  // For 'X' axis: U = x, V = |y - axisOffset|
  const profile = boundaryPts.map((p) => {
    if (revolveAxis === 'X') {
      return { u: p.x, v: Math.max(0.001, Math.abs(p.y - axisOffset)), raw: p };
    }
    return { u: p.y, v: Math.max(0.001, Math.abs(p.x - axisOffset)), raw: p };
  });

  const N = profile.length;
  const S = revolveSegments;
  const isFull360 = Math.abs(revolveAngleDeg - 360) < 0.1;

  const posArray = [];
  const uvsArray = [];
  const indexArray = [];

  // Generate vertices along revolution rings
  for (let s = 0; s <= S; s++) {
    const phi = (s / S) * revolveAngleRad;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const uCoord = s / S;

    for (let i = 0; i < N; i++) {
      const pt = profile[i];
      let x, y, z;
      if (revolveAxis === 'X') {
        x = pt.u;
        y = pt.v * cosPhi;
        z = pt.v * sinPhi;
      } else {
        x = pt.v * cosPhi;
        y = pt.u;
        z = pt.v * sinPhi;
      }

      posArray.push(x, y, z);
      uvsArray.push(uCoord, i / (N - 1));
    }
  }

  // Connect adjacent rings with quad faces (2 triangles per quad)
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < N - 1; i++) {
      const row1 = s * N;
      const row2 = (s + 1) * N;

      const p00 = row1 + i;
      const p01 = row1 + i + 1;
      const p10 = row2 + i;
      const p11 = row2 + i + 1;

      // Orient outward
      indexArray.push(p00, p10, p01);
      indexArray.push(p01, p10, p11);
    }
  }

  // If partial revolution and capEnds is enabled: cap the opening and closing slices
  if (!isFull360 && capEnds) {
    const tris = triangulatePolygonEarcut(boundaryPts);
    if (tris.length > 0) {
      // Start Cap (s = 0)
      const startBase = 0;
      for (const t of tris) {
        indexArray.push(startBase + t.a, startBase + t.c, startBase + t.b);
      }
      // End Cap (s = S)
      const endBase = S * N;
      for (const t of tris) {
        indexArray.push(endBase + t.a, endBase + t.b, endBase + t.c);
      }
    }
  }

  const geom = new THREE_LIB.BufferGeometry();
  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(posArray, 3));
  geom.setAttribute('uv', new THREE_LIB.Float32BufferAttribute(uvsArray, 2));
  geom.setIndex(indexArray);

  let merged = geom;
  if (isFull360) {
    try {
      merged = mergeVertices(geom, 1e-4);
    } catch {
      merged = geom;
    }
  }

  merged.computeVertexNormals();
  merged.center();
  return merged;
}

// =============================================================================
// 2. CROSS-SECTIONAL LOFT & SWEEP ENGINE (PARALLEL TRANSPORT FRAMES)
// =============================================================================

/**
 * Generates 3D guide curve points based on spine preset
 */
function evaluateSpinePath(type, length, curvature, twistDeg, steps) {
  const points = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps; // 0 to 1
    let x = 0, y = 0, z = 0;

    switch (type) {
      case 'arc': {
        const theta = t * Math.PI;
        const r = length / Math.PI;
        x = -r * Math.cos(theta) + r;
        y = r * Math.sin(theta) * (curvature ? curvature * 2.5 : 1.0);
        z = (t - 0.5) * 0.15;
        break;
      }
      case 's_curve': {
        x = (t - 0.5) * length;
        y = Math.sin(t * Math.PI * 2) * (length * 0.25 * (curvature || 1.0));
        z = Math.cos(t * Math.PI) * (length * 0.15 * (curvature || 1.0));
        break;
      }
      case 'helix': {
        const coils = 2.0;
        const theta = t * Math.PI * 2 * coils;
        const r = length * 0.22 * (curvature || 1.0);
        x = r * Math.cos(theta);
        y = (t - 0.5) * length;
        z = r * Math.sin(theta);
        break;
      }
      case 'wave': {
        x = (t - 0.5) * length;
        y = Math.sin(t * Math.PI * 4) * (length * 0.15 * (curvature || 1.0));
        z = Math.cos(t * Math.PI * 4) * (length * 0.15 * (curvature || 1.0));
        break;
      }
      case 'linear':
      default: {
        x = 0;
        y = (t - 0.5) * length;
        z = 0;
        break;
      }
    }

    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

/**
 * Sweeps a 2D closed vector cross-section along a 3D guide rail using Bishop Parallel Transport frames
 */
export function createSweptGeometryFromPath(rawPoints, options = {}, THREE_LIB = THREE) {
  const scaleFactor = Number(options.scaleFactor ?? 0.005);
  const curveSegments = Math.max(12, Number(options.curveSegments ?? 24));
  const spineType = options.spineType || 'arc';
  const spineLength = Math.max(0.2, Number(options.spineLength ?? 1.2));
  const spineCurvature = Number(options.spineCurvature ?? 0.5);
  const spineTwist = Number(options.spineTwist ?? 0); // degrees
  const spineSteps = Math.max(12, Math.min(80, Number(options.spineSteps ?? 36)));
  const scaleStart = Math.max(0.1, Number(options.scaleStart ?? 1.0));
  const scaleEnd = Math.max(0.05, Number(options.scaleEnd ?? 0.5));
  const scaleProfile = options.scaleProfile || 'linear';
  const capEnds = options.capEnds !== false;

  const profilePts = samplePolygonFromVectorPoints(rawPoints, scaleFactor, curveSegments, THREE_LIB);
  if (profilePts.length < 3) {
    return new THREE_LIB.TorusGeometry(0.5, 0.15, 16, 32);
  }

  // 1. Generate Spine Curve & Tangents
  const spinePoints = evaluateSpinePath(spineType, spineLength, spineCurvature, spineTwist, spineSteps);
  const numSteps = spinePoints.length;

  const tangents = [];
  for (let i = 0; i < numSteps; i++) {
    const prev = spinePoints[Math.max(0, i - 1)];
    const next = spinePoints[Math.min(numSteps - 1, i + 1)];
    const T = new THREE.Vector3().subVectors(next, prev).normalize();
    if (T.lengthSq() < 1e-6) T.set(0, 1, 0);
    tangents.push(T);
  }

  // 2. Parallel Transport (Bishop) Frames to prevent flipping/twisting
  const normals = [new THREE.Vector3()];
  const binormals = [new THREE.Vector3()];

  // Initial normal: pick perpendicular vector to T[0]
  const initialT = tangents[0];
  const upRef = Math.abs(initialT.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  normals[0].crossVectors(initialT, upRef).normalize();
  binormals[0].crossVectors(initialT, normals[0]).normalize();

  for (let i = 1; i < numSteps; i++) {
    const t0 = tangents[i - 1];
    const t1 = tangents[i];
    const rotAxis = new THREE.Vector3().crossVectors(t0, t1);
    const rotLen = rotAxis.length();

    let nextN = normals[i - 1].clone();
    if (rotLen > 1e-5) {
      rotAxis.normalize();
      const dotVal = Math.max(-1, Math.min(1, t0.dot(t1)));
      const rotAngle = Math.acos(dotVal);
      nextN.applyAxisAngle(rotAxis, rotAngle);
    }
    // Re-orthogonalize
    nextN.sub(t1.clone().multiplyScalar(nextN.dot(t1))).normalize();
    normals.push(nextN);
    binormals.push(new THREE.Vector3().crossVectors(t1, nextN).normalize());
  }

  // 3. Synthesize Swept Mesh Vertices
  const M = profilePts.length;
  const posArray = [];
  const uvsArray = [];
  const indexArray = [];

  for (let s = 0; s < numSteps; s++) {
    const tVal = s / (numSteps - 1);
    const origin = spinePoints[s];
    const T = tangents[s];
    const N = normals[s];
    const B = binormals[s];

    // Compute Scale Falloff S(t)
    let sFactor = (1 - tVal) * scaleStart + tVal * scaleEnd;
    if (scaleProfile === 'bell') {
      sFactor *= (1 + 0.5 * Math.sin(tVal * Math.PI));
    } else if (scaleProfile === 'pinch') {
      sFactor *= (0.4 + 0.6 * Math.pow(Math.cos(tVal * Math.PI), 2));
    } else if (scaleProfile === 'flare') {
      sFactor *= (0.6 + 0.8 * Math.pow(tVal, 2));
    }

    // Twist rotation around tangent axis
    const twistRad = ((tVal * spineTwist) * Math.PI) / 180;
    const cosTwist = Math.cos(twistRad);
    const sinTwist = Math.sin(twistRad);

    const rotN = new THREE.Vector3().addScaledVector(N, cosTwist).addScaledVector(B, sinTwist);
    const rotB = new THREE.Vector3().addScaledVector(N, -sinTwist).addScaledVector(B, cosTwist);

    for (let j = 0; j < M; j++) {
      const p = profilePts[j];
      const scaledX = p.x * sFactor;
      const scaledY = p.y * sFactor;

      const vertPos = new THREE.Vector3()
        .copy(origin)
        .addScaledVector(rotN, scaledX)
        .addScaledVector(rotB, scaledY);

      posArray.push(vertPos.x, vertPos.y, vertPos.z);
      uvsArray.push(tVal, j / (M - 1));
    }
  }

  // Connect adjacent rings with quads
  for (let s = 0; s < numSteps - 1; s++) {
    const row1 = s * M;
    const row2 = (s + 1) * M;
    for (let j = 0; j < M; j++) {
      const nextJ = (j + 1) % M;
      const p00 = row1 + j;
      const p01 = row1 + nextJ;
      const p10 = row2 + j;
      const p11 = row2 + nextJ;

      indexArray.push(p00, p10, p01);
      indexArray.push(p01, p10, p11);
    }
  }

  // Add Start and End Caps for watertight manifold geometry
  if (capEnds) {
    const tris = triangulatePolygonEarcut(profilePts);
    if (tris.length > 0) {
      // Start Cap (s = 0) facing -T[0]
      const startBase = 0;
      for (const t of tris) {
        indexArray.push(startBase + t.a, startBase + t.c, startBase + t.b);
      }
      // End Cap (s = numSteps - 1) facing +T[end]
      const endBase = (numSteps - 1) * M;
      for (const t of tris) {
        indexArray.push(endBase + t.a, endBase + t.b, endBase + t.c);
      }
    }
  }

  const geom = new THREE_LIB.BufferGeometry();
  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(posArray, 3));
  geom.setAttribute('uv', new THREE_LIB.Float32BufferAttribute(uvsArray, 2));
  geom.setIndex(indexArray);

  const merged = mergeVertices(geom, 1e-4);
  merged.computeVertexNormals();
  merged.center();
  return merged;
}

// =============================================================================
// 3. MULTI-VIEW SILHOUETTE CARVING (CONSTRUCTIVE VISUAL HULL INTERSECTION)
// =============================================================================

/**
 * Computes signed distance to 2D polygon (negative inside, positive outside)
 */
function signedDistanceToPolygon(x, y, polygon) {
  const d = distanceToPolygonBoundary(x, y, polygon);
  const inside = isPointInsidePolygon(x, y, polygon);
  return inside ? -d : d;
}

/**
 * Computes bounding box of 2D polygon
 */
function getPolygonBounds(pts) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Real-time Visual Hull synthesizer from two orthogonal silhouettes
 * Front view curve (XY) + Top view curve (XZ) or Side view curve (YZ)
 */
export function createOrthogonalCarveGeometry(frontPoints, topSidePoints, options = {}, THREE_LIB = THREE) {
  const scaleFactor = Number(options.scaleFactor ?? 0.005);
  const curveSegments = Math.max(12, Number(options.curveSegments ?? 24));
  const carveResolution = Math.max(20, Math.min(48, Number(options.carveResolution ?? 32)));
  const carveView = options.carveView || 'top'; // 'top' (XZ) or 'side' (YZ)
  const carveSmooth = Math.max(0, Math.min(4, Number(options.carveSmooth ?? 2)));

  const polyFront = samplePolygonFromVectorPoints(frontPoints, scaleFactor, curveSegments, THREE_LIB);
  const polyTop = samplePolygonFromVectorPoints(topSidePoints, scaleFactor, curveSegments, THREE_LIB);

  if (polyFront.length < 3 || polyTop.length < 3) {
    return new THREE_LIB.BoxGeometry(1, 0.6, 1);
  }

  const bFront = getPolygonBounds(polyFront);
  const bTop = getPolygonBounds(polyTop);

  // Unified 3D Bounding Box with padding
  const padding = 0.05;
  const minX = Math.min(bFront.minX, bTop.minX) - padding;
  const maxX = Math.max(bFront.maxX, bTop.maxX) + padding;
  const minY = bFront.minY - padding;
  const maxY = bFront.maxY + padding;
  const minZ = bTop.minY - padding;
  const maxZ = bTop.maxY + padding;

  const N = carveResolution;
  const scalarField = new Float32Array(N * N * N);

  const dx = (maxX - minX) / (N - 1);
  const dy = (maxY - minY) / (N - 1);
  const dz = (maxZ - minZ) / (N - 1);

  // Populate SDF grid: point is inside visual hull if inside BOTH orthogonal projections
  for (let iz = 0; iz < N; iz++) {
    const z = minZ + iz * dz;
    for (let iy = 0; iy < N; iy++) {
      const y = minY + iy * dy;
      for (let ix = 0; ix < N; ix++) {
        const x = minX + ix * dx;
        const idx = ix + iy * N + iz * N * N;

        const dFront = signedDistanceToPolygon(x, y, polyFront);
        let dSecond;
        if (carveView === 'side') {
          // Side view maps Y to height, Z to length
          dSecond = signedDistanceToPolygon(z, y, polyTop);
        } else {
          // Top view maps X to width, Z to depth
          dSecond = signedDistanceToPolygon(x, z, polyTop);
        }

        // Constructive Solid Intersection: SDF = max(A, B)
        scalarField[idx] = Math.max(dFront, dSecond);
      }
    }
  }

  // Extract watertight isosurface at zero boundary
  const meshData = extractIsosurface(
    scalarField,
    N,
    N,
    N,
    { minX, maxX, minY, maxY, minZ, maxZ },
    0.0
  );

  if (meshData.positions.length === 0) {
    return new THREE_LIB.BoxGeometry(1, 0.6, 1);
  }

  const geom = new THREE_LIB.BufferGeometry();
  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(meshData.positions, 3));
  geom.setIndex(new THREE_LIB.BufferAttribute(meshData.indices, 1));

  let merged = mergeVertices(geom, 1e-4);

  // Optional Laplacian vertex smoothing
  if (carveSmooth > 0) {
    const pos = merged.attributes.position;
    const pArr = pos.array;
    const numVerts = pos.count;
    const indices = merged.index ? merged.index.array : null;

    if (indices) {
      const neighbors = Array.from({ length: numVerts }, () => new Set());
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i], b = indices[i + 1], c = indices[i + 2];
        neighbors[a].add(b); neighbors[a].add(c);
        neighbors[b].add(a); neighbors[b].add(c);
        neighbors[c].add(a); neighbors[c].add(b);
      }

      for (let s = 0; s < carveSmooth; s++) {
        const nextArr = new Float32Array(pArr);
        for (let i = 0; i < numVerts; i++) {
          const nbs = Array.from(neighbors[i]);
          if (nbs.length > 0) {
            let avgX = 0, avgY = 0, avgZ = 0;
            for (const n of nbs) {
              avgX += pArr[n * 3];
              avgY += pArr[n * 3 + 1];
              avgZ += pArr[n * 3 + 2];
            }
            avgX /= nbs.length;
            avgY /= nbs.length;
            avgZ /= nbs.length;

            nextArr[i * 3] = pArr[i * 3] * 0.5 + avgX * 0.5;
            nextArr[i * 3 + 1] = pArr[i * 3 + 1] * 0.5 + avgY * 0.5;
            nextArr[i * 3 + 2] = pArr[i * 3 + 2] * 0.5 + avgZ * 0.5;
          }
        }
        for (let i = 0; i < pArr.length; i++) pArr[i] = nextArr[i];
      }
      pos.needsUpdate = true;
    }
  }

  merged.computeVertexNormals();
  merged.center();
  return merged;
}

// =============================================================================
// 4. ADVANCED EXTRUSION WITH TAPER, TWIST & SOLIDIFY / SHELL MODIFIER
// =============================================================================

/**
 * Creates advanced beveled extrusion with directional taper and hollow solidify/shell modifier
 */
export function createAdvancedExtrudeGeometry(rawPoints, options = {}, THREE_LIB = THREE) {
  const scaleFactor = Number(options.scaleFactor ?? 0.005);
  const depth = Math.max(0.02, Number(options.depth ?? 0.25));
  const taper = Math.max(0.1, Number(options.taper ?? 1.0)); // scaling factor at back face
  const twistDeg = Number(options.twist ?? 0); // twist along extrusion
  const curveSegments = Math.max(8, Number(options.curveSegments ?? 24));
  const shellEnabled = Boolean(options.shellEnabled);
  const shellThickness = Math.max(0.01, Number(options.shellThickness ?? 0.04));
  const bevelEnabled = options.bevelEnabled !== false && !shellEnabled;
  const bevelThickness = Number(options.bevelThickness ?? 0.03);
  const bevelSize = Number(options.bevelSize ?? 0.02);
  const bevelSegments = Math.max(1, Number(options.bevelSegments ?? 3));

  // If no taper, no twist, and no shell, use standard Three.js ExtrudeGeometry with bevel
  if (taper === 1.0 && twistDeg === 0 && !shellEnabled) {
    const shape = new THREE_LIB.Shape();
    const scale = scaleFactor;
    const p0 = rawPoints[0];
    shape.moveTo(p0.x * scale, -p0.y * scale);

    for (let i = 0; i < rawPoints.length; i++) {
      const curr = rawPoints[i];
      const next = rawPoints[(i + 1) % rawPoints.length];
      const cp1 = curr.handleOut
        ? { x: (curr.x + curr.handleOut.x) * scale, y: -(curr.y + curr.handleOut.y) * scale }
        : null;
      const cp2 = next.handleIn
        ? { x: (next.x + next.handleIn.x) * scale, y: -(next.y + next.handleIn.y) * scale }
        : null;

      if (cp1 || cp2) {
        const c1 = cp1 || { x: curr.x * scale, y: -curr.y * scale };
        const c2 = cp2 || { x: next.x * scale, y: -next.y * scale };
        shape.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, next.x * scale, -next.y * scale);
      } else {
        shape.lineTo(next.x * scale, -next.y * scale);
      }
    }
    shape.closePath();

    const geom = new THREE_LIB.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      bevelSegments,
      curveSegments,
      steps: 1
    });
    geom.center();
    geom.computeVertexNormals();
    return geom;
  }

  // Sample 2D boundary contour
  const boundaryPts = samplePolygonFromVectorPoints(rawPoints, scaleFactor, curveSegments, THREE_LIB);
  if (boundaryPts.length < 3) {
    return new THREE_LIB.BoxGeometry(1, 1, depth);
  }

  const M = boundaryPts.length;
  const twistRad = (twistDeg * Math.PI) / 180;
  const posArray = [];
  const indexArray = [];

  // If Shell/Solidify modifier is enabled: generate hollow manifold solid with wall thickness
  if (shellEnabled) {
    // Generate inner boundary offset
    const innerPts = [];
    for (let i = 0; i < M; i++) {
      const prev = boundaryPts[(i - 1 + M) % M];
      const curr = boundaryPts[i];
      const next = boundaryPts[(i + 1) % M];

      const d1 = new THREE.Vector2(curr.x - prev.x, curr.y - prev.y).normalize();
      const d2 = new THREE.Vector2(next.x - curr.x, next.y - curr.y).normalize();
      const n1 = new THREE.Vector2(-d1.y, d1.x);
      const n2 = new THREE.Vector2(-d2.y, d2.x);
      const normal = new THREE.Vector2().addVectors(n1, n2).normalize();

      innerPts.push({
        x: curr.x - normal.x * shellThickness,
        y: curr.y - normal.y * shellThickness
      });
    }

    // Outer Front [0 ... M-1], Outer Back [M ... 2M-1]
    // Inner Front [2M ... 3M-1], Inner Back [3M ... 4M-1]
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // 0: Outer Front (Z = depth / 2)
    for (let i = 0; i < M; i++) posArray.push(boundaryPts[i].x, boundaryPts[i].y, depth * 0.5);

    // 1: Outer Back (Z = -depth / 2, scaled by taper, twisted)
    for (let i = 0; i < M; i++) {
      const bx = boundaryPts[i].x * taper;
      const by = boundaryPts[i].y * taper;
      posArray.push(bx * cosT - by * sinT, bx * sinT + by * cosT, -depth * 0.5);
    }

    // 2: Inner Front (Z = depth / 2)
    for (let i = 0; i < M; i++) posArray.push(innerPts[i].x, innerPts[i].y, depth * 0.5);

    // 3: Inner Back (Z = -depth / 2, scaled by taper, twisted)
    for (let i = 0; i < M; i++) {
      const bx = innerPts[i].x * taper;
      const by = innerPts[i].y * taper;
      posArray.push(bx * cosT - by * sinT, bx * sinT + by * cosT, -depth * 0.5);
    }

    // Connect Outer Walls
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      indexArray.push(i, next, M + i);
      indexArray.push(next, M + next, M + i);
    }

    // Connect Inner Walls (inverted orientation)
    const oIn = 2 * M;
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      indexArray.push(oIn + i, oIn + M + i, oIn + next);
      indexArray.push(oIn + next, oIn + M + i, oIn + M + next);
    }

    // Connect Front Rim Wall (between Outer Front and Inner Front)
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      indexArray.push(i, oIn + i, next);
      indexArray.push(next, oIn + i, oIn + next);
    }

    // Connect Back Rim Wall (between Outer Back and Inner Back)
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      indexArray.push(M + i, M + next, oIn + M + i);
      indexArray.push(M + next, oIn + M + next, oIn + M + i);
    }
  } else {
    // Solid Extrusion with Taper and Twist
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // Front Vertices [0 ... M-1] (Z = depth / 2)
    for (let i = 0; i < M; i++) posArray.push(boundaryPts[i].x, boundaryPts[i].y, depth * 0.5);

    // Back Vertices [M ... 2M-1] (Z = -depth / 2, scaled by taper, rotated by twist)
    for (let i = 0; i < M; i++) {
      const bx = boundaryPts[i].x * taper;
      const by = boundaryPts[i].y * taper;
      posArray.push(bx * cosT - by * sinT, bx * sinT + by * cosT, -depth * 0.5);
    }

    // Side Walls connecting Front and Back
    for (let i = 0; i < M; i++) {
      const next = (i + 1) % M;
      indexArray.push(i, next, M + i);
      indexArray.push(next, M + next, M + i);
    }

    // Front Cap (Z = depth / 2)
    const tris = triangulatePolygonEarcut(boundaryPts);
    for (const t of tris) {
      indexArray.push(t.a, t.b, t.c);
    }

    // Back Cap (Z = -depth / 2)
    for (const t of tris) {
      indexArray.push(M + t.a, M + t.c, M + t.b);
    }
  }

  const geom = new THREE_LIB.BufferGeometry();
  geom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(posArray, 3));
  geom.setIndex(indexArray);

  const merged = mergeVertices(geom, 1e-4);
  merged.computeVertexNormals();
  merged.center();
  return merged;
}
