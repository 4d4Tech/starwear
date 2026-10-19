/**
 * inflationEngine.js
 * 
 * 2D Silhouette to 3D Curvature & Volumetric Inflation Engine
 * Based on Pipeline A (Distance-Field Heightfield Inflation / Monster Mash Style)
 * and Pipeline D (Extrusion + Bevel + Procedural Dome/Lattice Curvature Deformation)
 * from technical specification: pipeline_specific_techniques.md.
 * 
 * Features:
 * - Densely sampled boundary extraction from 2D bezier paths & anchor points
 * - Interior Steiner point grid generation with containment filtering
 * - Robust 2D Delaunay triangulation for smooth interior surface topology
 * - Euclidean distance-to-boundary field computation
 * - Configurable curvature profiles (Elliptic, Harmonic Pillow, Spherical Dome, Linear Ridge, Deep Cushion)
 * - Dual-sided symmetric volumetric manifold welding (watertight closed 3D hull)
 * - Single-sided dome with flat base option
 * - Laplacian smoothing passes for organic, wrinkle-free curvature
 * - Seamless integration with Vector Pen Tool, ARTest, and WebAR renderers
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Curvature Profile Definitions with UI metadata and mathematical evaluation
 */
export const INFLATION_PROFILES = [
  {
    id: 'elliptic',
    name: 'Elliptic Balloon',
    icon: 'bubble_chart',
    description: 'Classic organic puff with vertical boundary tangents and soft central dome (Monster Mash standard)',
    eval: (u) => Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  },
  {
    id: 'harmonic',
    name: 'Harmonic Pillow',
    icon: 'weekend',
    description: 'Sinusoidal S-curve with soft, continuous transitions and relaxed crown',
    eval: (u) => Math.sin(u * Math.PI * 0.5)
  },
  {
    id: 'spherical',
    name: 'Spherical Dome',
    icon: 'circle',
    description: 'True circular arc curvature profile for hemispherical bubbles and caps',
    eval: (u) => Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  },
  {
    id: 'cushion',
    name: 'Deep Cushion',
    icon: 'hotel',
    description: 'High-volume puffy profile with steep walls and expansive top fullness',
    eval: (u) => Math.sqrt(Math.max(0, 1 - Math.pow(1 - u, 3)))
  },
  {
    id: 'linear',
    name: 'Linear Ridge (Tent)',
    icon: 'change_history',
    description: 'Faceted straight slope tapering to sharp internal ridges (origami / gemstone bevel)',
    eval: (u) => u
  }
];

// Keyed lookup map for instant O(1) property access by id (e.g. INFLATION_PROFILES['elliptic'] or INFLATION_PROFILES.elliptic)
INFLATION_PROFILES.forEach((prof) => {
  INFLATION_PROFILES[prof.id] = prof;
});

export const INFLATION_PROFILE_MAP = Object.fromEntries(INFLATION_PROFILES.map((p) => [p.id, p]));

/**
 * Check if a 2D point (px, py) is strictly inside a closed 2D polygon
 */
export function isPointInsidePolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Minimum Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2)
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Minimum Euclidean distance from point (px, py) to the polygon boundary edges
 */
export function distanceToPolygonBoundary(px, py, polygon) {
  let minDist = Infinity;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    const d = pointToSegmentDistance(px, py, p1.x, p1.y, p2.x, p2.y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Samples a dense, uniform 2D boundary polygon from Photoshop-style anchor points & bezier handles
 */
export function samplePolygonFromVectorPoints(rawPoints, scaleFactor = 0.005, curveSegments = 24, THREE_LIB = THREE) {
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) return [];

  const shape = new THREE_LIB.Shape();
  const scale = Number(scaleFactor ?? 0.005);
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

  // Extract sampled contour
  const sampled = shape.getPoints(Math.max(8, Number(curveSegments ?? 24)));
  
  // Clean duplicate end point if returned
  if (sampled.length > 2) {
    const first = sampled[0];
    const last = sampled[sampled.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
      sampled.pop();
    }
  }

  return sampled.map((pt) => ({ x: pt.x, y: pt.y }));
}

/**
 * Bowyer-Watson 2D Delaunay Triangulation
 */
export function triangulate2D(vertices) {
  if (vertices.length < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const dx = (maxX - minX) * 10 || 10;
  const dy = (maxY - minY) * 10 || 10;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Super-triangle enclosing all points
  const st0 = { x: midX - dx, y: midY - dy };
  const st1 = { x: midX, y: midY + dy * 2 };
  const st2 = { x: midX + dx * 2, y: midY - dy };
  const allVerts = [...vertices, st0, st1, st2];
  const s0 = vertices.length, s1 = vertices.length + 1, s2 = vertices.length + 2;

  let triangles = [{ a: s0, b: s1, c: s2 }];

  function circumcircle(v0, v1, v2) {
    const det = 2 * (v0.x * (v1.y - v2.y) + v1.x * (v2.y - v0.y) + v2.x * (v0.y - v1.y));
    if (Math.abs(det) < 1e-9) return { x: 0, y: 0, r2: Infinity };
    const ux = ((v0.x * v0.x + v0.y * v0.y) * (v1.y - v2.y) + (v1.x * v1.x + v1.y * v1.y) * (v2.y - v0.y) + (v2.x * v2.x + v2.y * v2.y) * (v0.y - v1.y)) / det;
    const uy = ((v0.x * v0.x + v0.y * v0.y) * (v2.x - v1.x) + (v1.x * v1.x + v1.y * v1.y) * (v0.x - v2.x) + (v2.x * v2.x + v2.y * v2.y) * (v1.x - v0.x)) / det;
    const r2 = (v0.x - ux) * (v0.x - ux) + (v0.y - uy) * (v0.y - uy);
    return { x: ux, y: uy, r2 };
  }

  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i];
    const badTriangles = [];

    for (const tri of triangles) {
      const cc = circumcircle(allVerts[tri.a], allVerts[tri.b], allVerts[tri.c]);
      if ((p.x - cc.x) * (p.x - cc.x) + (p.y - cc.y) * (p.y - cc.y) <= cc.r2 + 1e-8) {
        badTriangles.push(tri);
      }
    }

    const edges = [];
    for (const tri of badTriangles) {
      edges.push({ a: tri.a, b: tri.b }, { a: tri.b, b: tri.c }, { a: tri.c, b: tri.a });
    }

    triangles = triangles.filter((t) => !badTriangles.includes(t));

    // Keep only boundary edges of the cavity
    for (let e1 = 0; e1 < edges.length; e1++) {
      let isShared = false;
      for (let e2 = 0; e2 < edges.length; e2++) {
        if (e1 !== e2 && (
          (edges[e1].a === edges[e2].a && edges[e1].b === edges[e2].b) ||
          (edges[e1].a === edges[e2].b && edges[e1].b === edges[e2].a)
        )) {
          isShared = true;
          break;
        }
      }
      if (!isShared) {
        triangles.push({ a: edges[e1].a, b: edges[e1].b, c: i });
      }
    }
  }

  // Filter out any triangles referencing super-triangle vertices
  return triangles.filter((t) => t.a < vertices.length && t.b < vertices.length && t.c < vertices.length);
}

/**
 * Builds a 3D volumetric inflated geometry from a 2D boundary polygon using
 * Distance-Field Heightfield Inflation (Pipeline A) with guaranteed watertight edge connectivity.
 */
export function buildDistanceFieldInflatedGeometry(boundaryPts, options = {}, THREE_LIB = THREE) {
  if (!Array.isArray(boundaryPts) || boundaryPts.length < 3) {
    return new THREE_LIB.BoxGeometry(1, 1, 0.2);
  }

  const depthFront = Math.max(0.01, Number(options.depthFront ?? options.depth ?? options.inflationAmount ?? 0.35));
  const symmetric = options.symmetric !== false;
  const depthBack = options.depthBack !== undefined ? Math.max(0, Number(options.depthBack)) : (symmetric ? depthFront : 0);
  const profileKey = (options.curvatureProfile || options.profile || 'elliptic').toLowerCase();
  const smoothPasses = Math.max(0, Math.min(8, parseInt(options.smoothPasses ?? 2, 10)));
  const gridRes = Math.max(8, Math.min(64, parseInt(options.resolution ?? 24, 10)));
  const rimDepth = Math.max(0, Number(options.rimDepth ?? 0));
  const connectEdges = options.connectEdges !== false;

  // Find profile function
  const profileObj = INFLATION_PROFILES.find((p) => p.id === profileKey) || INFLATION_PROFILES[0];
  const profileEval = profileObj.eval;

  // 1. Calculate 2D Bounding Box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of boundaryPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const maxDim = Math.max(width, height) || 1.0;
  if (width <= 0 || height <= 0) return new THREE_LIB.BoxGeometry(1, 1, 0.2);

  function eKey(a, b) { return a < b ? `${a}_${b}` : `${b}_${a}`; }

  // 2. Base Triangulation: Primary via ShapeUtils.triangulateShape (Earcut) to preserve exact boundary contours
  let verts = boundaryPts.map((p) => ({ x: p.x, y: p.y }));
  let tris = [];

  try {
    if (THREE_LIB.ShapeUtils && typeof THREE_LIB.ShapeUtils.triangulateShape === 'function') {
      const v2Array = boundaryPts.map((p) => new THREE_LIB.Vector2(p.x, p.y));
      const rawTris = THREE_LIB.ShapeUtils.triangulateShape(v2Array, []);
      if (Array.isArray(rawTris) && rawTris.length > 0) {
        tris = rawTris.map((t) => ({ a: t[0], b: t[1], c: t[2] }));
      }
    }
  } catch (earcutErr) {
    console.warn('[inflationEngine] ShapeUtils.triangulateShape fallback:', earcutErr);
  }

  // 3. Fallback: Bowyer-Watson Delaunay if Earcut did not generate triangles
  if (tris.length === 0) {
    const stepX = width / gridRes;
    const stepY = height / gridRes;
    const margin = Math.min(stepX, stepY) * 0.42;

    for (let ix = 1; ix < gridRes; ix++) {
      const gx = minX + ix * stepX;
      for (let iy = 1; iy < gridRes; iy++) {
        const gy = minY + iy * stepY;
        const jx = gx + (Math.sin(ix * 13.7 + iy * 29.3) * stepX * 0.15);
        const jy = gy + (Math.cos(ix * 23.1 + iy * 17.5) * stepY * 0.15);

        if (isPointInsidePolygon(jx, jy, boundaryPts)) {
          const d = distanceToPolygonBoundary(jx, jy, boundaryPts);
          if (d > margin) {
            verts.push({ x: jx, y: jy });
          }
        }
      }
    }

    const allTris = triangulate2D(verts);
    tris = allTris.filter((t) => {
      const cx = (verts[t.a].x + verts[t.b].x + verts[t.c].x) / 3;
      const cy = (verts[t.a].y + verts[t.b].y + verts[t.c].y) / 3;
      return isPointInsidePolygon(cx, cy, boundaryPts);
    });
  } else {
    // Adaptive Midpoint Triangle Subdivision to inject smooth internal Steiner grid vertices
    const targetEdgeLen = maxDim / gridRes;
    const maxSubdivIters = 4;
    for (let it = 0; it < maxSubdivIters; it++) {
      const nextTris = [];
      const midMap = new Map();
      function getMid(i1, i2) {
        const k = eKey(i1, i2);
        if (midMap.has(k)) return midMap.get(k);
        const v1 = verts[i1], v2 = verts[i2];
        const mid = { x: (v1.x + v2.x) * 0.5, y: (v1.y + v2.y) * 0.5 };
        const newIdx = verts.length;
        verts.push(mid);
        midMap.set(k, newIdx);
        return newIdx;
      }

      let splitAny = false;
      for (const t of tris) {
        const v0 = verts[t.a], v1 = verts[t.b], v2 = verts[t.c];
        const maxLen = Math.max(
          Math.hypot(v0.x - v1.x, v0.y - v1.y),
          Math.hypot(v1.x - v2.x, v1.y - v2.y),
          Math.hypot(v2.x - v0.x, v2.y - v0.y)
        );

        if (maxLen > targetEdgeLen) {
          splitAny = true;
          const m01 = getMid(t.a, t.b);
          const m12 = getMid(t.b, t.c);
          const m20 = getMid(t.c, t.a);
          nextTris.push({ a: t.a, b: m01, c: m20 });
          nextTris.push({ a: t.b, b: m12, c: m01 });
          nextTris.push({ a: t.c, b: m20, c: m12 });
          nextTris.push({ a: m01, b: m12, c: m20 });
        } else {
          nextTris.push(t);
        }
      }
      tris = nextTris;
      if (!splitAny) break;
    }
  }

  if (tris.length === 0) {
    return new THREE_LIB.BoxGeometry(width, height, depth);
  }

  // 4. Exact 2D Boundary Edges Extraction (edges with count === 1 in 2D mesh)
  const edgeCounts2D = new Map();
  for (const t of tris) {
    edgeCounts2D.set(eKey(t.a, t.b), (edgeCounts2D.get(eKey(t.a, t.b)) || 0) + 1);
    edgeCounts2D.set(eKey(t.b, t.c), (edgeCounts2D.get(eKey(t.b, t.c)) || 0) + 1);
    edgeCounts2D.set(eKey(t.c, t.a), (edgeCounts2D.get(eKey(t.c, t.a)) || 0) + 1);
  }

  const boundaryEdges = [];
  const isBoundaryVert = new Uint8Array(verts.length);
  for (const t of tris) {
    const edges = [[t.a, t.b], [t.b, t.c], [t.c, t.a]];
    for (const [u, v] of edges) {
      if (edgeCounts2D.get(eKey(u, v)) === 1) {
        boundaryEdges.push([u, v]);
        isBoundaryVert[u] = 1;
        isBoundaryVert[v] = 1;
      }
    }
  }

  // 5. Euclidean Distance Field and Poisson/Harmonic Elevations
  let maxD = 0;
  const distances = verts.map((v, i) => {
    if (isBoundaryVert[i]) return 0;
    const d = distanceToPolygonBoundary(v.x, v.y, boundaryPts);
    if (d > maxD) maxD = d;
    return d;
  });
  if (maxD <= 0) maxD = 0.001;

  const heightsFront = distances.map((d, i) => {
    if (isBoundaryVert[i] || d < 1e-6) return 0;
    const u = Math.min(1.0, Math.max(0.0, d / maxD));
    return depthFront * profileEval(u);
  });

  const heightsBack = distances.map((d, i) => {
    if (isBoundaryVert[i] || d < 1e-6) return 0;
    const u = Math.min(1.0, Math.max(0.0, d / maxD));
    return depthBack * profileEval(u);
  });

  // Laplacian smoothing on interior heights to relax creases while locking boundary coordinates
  if (smoothPasses > 0) {
    const neighbors = Array.from({ length: verts.length }, () => new Set());
    for (const t of tris) {
      neighbors[t.a].add(t.b); neighbors[t.a].add(t.c);
      neighbors[t.b].add(t.a); neighbors[t.b].add(t.c);
      neighbors[t.c].add(t.a); neighbors[t.c].add(t.b);
    }
    for (let pass = 0; pass < smoothPasses; pass++) {
      const nextHF = [...heightsFront];
      const nextHB = [...heightsBack];
      for (let i = 0; i < verts.length; i++) {
        if (isBoundaryVert[i]) continue;
        const nbs = Array.from(neighbors[i]);
        if (nbs.length > 0) {
          const avgF = nbs.reduce((sum, idx) => sum + heightsFront[idx], 0) / nbs.length;
          const avgB = nbs.reduce((sum, idx) => sum + heightsBack[idx], 0) / nbs.length;
          nextHF[i] = heightsFront[i] * 0.4 + avgF * 0.6;
          nextHB[i] = heightsBack[i] * 0.4 + avgB * 0.6;
        }
      }
      for (let i = 0; i < verts.length; i++) {
        heightsFront[i] = nextHF[i];
        heightsBack[i] = nextHB[i];
      }
    }
  }

  // 6. Assemble 3D Watertight Solid Mesh with Connected Perimeter Seam Walls
  const V = verts.length;
  // Effective rim guarantees vertical seam separation so quad walls connect boundary edges without zero-area degeneracy
  const effectiveRim = connectEdges ? Math.max(rimDepth, 0.004) : rimDepth;
  const halfRim = effectiveRim * 0.5;
  const posArray = [];
  const indexArray = [];

  // Front Hull Vertices [0 ... V-1]
  for (let i = 0; i < V; i++) {
    posArray.push(verts[i].x, verts[i].y, heightsFront[i] + halfRim);
  }

  // Back Hull Vertices [V ... 2V-1]
  for (let i = 0; i < V; i++) {
    const backZ = depthBack > 0 ? -(heightsBack[i] + halfRim) : -halfRim;
    posArray.push(verts[i].x, verts[i].y, backZ);
  }

  // Front faces (oriented +Z outward)
  for (const t of tris) {
    const cross = (verts[t.b].x - verts[t.a].x) * (verts[t.c].y - verts[t.a].y) - (verts[t.b].y - verts[t.a].y) * (verts[t.c].x - verts[t.a].x);
    if (cross > 0) {
      indexArray.push(t.a, t.b, t.c);
    } else {
      indexArray.push(t.a, t.c, t.b);
    }
  }

  // Back faces (inverted winding order so normals point outward (-Z))
  for (const t of tris) {
    const cross = (verts[t.b].x - verts[t.a].x) * (verts[t.c].y - verts[t.a].y) - (verts[t.b].y - verts[t.a].y) * (verts[t.c].x - verts[t.a].x);
    if (cross > 0) {
      indexArray.push(t.a + V, t.c + V, t.b + V);
    } else {
      indexArray.push(t.a + V, t.b + V, t.c + V);
    }
  }

  // Connect All Perimeter Edges: stitch every boundary edge with quad walls
  if (connectEdges || rimDepth > 0) {
    for (const [u, v] of boundaryEdges) {
      // Connect front boundary edge [u, v] to back boundary edge [u+V, v+V]
      indexArray.push(u, v, v + V);
      indexArray.push(u, v + V, u + V);
    }
  }

  const rawGeom = new THREE_LIB.BufferGeometry();
  rawGeom.setAttribute('position', new THREE_LIB.Float32BufferAttribute(posArray, 3));
  rawGeom.setIndex(indexArray);

  // Weld coincident vertices for watertight manifold topology and smooth boundary seam normals
  let finalGeom = rawGeom;
  try {
    if (typeof mergeVertices === 'function') {
      finalGeom = mergeVertices(rawGeom, 1e-4);
    }
  } catch (mergeErr) {
    console.warn('[inflationEngine] mergeVertices fallback:', mergeErr);
  }

  finalGeom.computeVertexNormals();
  return finalGeom;
}

/**
 * Procedural Dome / Spherical Curvature Modifier for Three.js Geometries (Pipeline D)
 */
export function applyDomeDeformation(geometry, options = {}) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return geometry;

  const pos = geometry.attributes.position;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return geometry;

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const maxRadius = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) * 0.5 || 1.0;
  const factor = Number(options.depth ?? options.factor ?? 0.3);
  const symmetric = options.symmetric !== false;
  const profileKey = (options.curvatureProfile || options.profile || 'elliptic').toLowerCase();
  const profileObj = INFLATION_PROFILES.find((p) => p.id === profileKey) || INFLATION_PROFILES[0];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - center.x;
    const y = pos.getY(i) - center.y;
    const z = pos.getZ(i);

    const distFromCenter = Math.hypot(x, y);
    const normalizedDist = Math.max(0, Math.min(1.0, 1.0 - (distFromCenter / maxRadius)));
    const domeOffset = factor * profileObj.eval(normalizedDist);

    if (symmetric) {
      const sign = z >= 0 ? 1 : -1;
      pos.setZ(i, z + sign * domeOffset);
    } else {
      if (z > 0) {
        pos.setZ(i, z + domeOffset);
      }
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * High-level creation helper: builds inflated 3D geometry directly from raw vector points
 */
export function createInflatedGeometryFromPoints(rawPoints, options = {}, THREE_LIB = THREE) {
  const scaleFactor = Number(options.scaleFactor ?? 0.005);
  const curveSegments = Math.max(8, Number(options.curveSegments ?? 24));
  const boundary = samplePolygonFromVectorPoints(rawPoints, scaleFactor, curveSegments, THREE_LIB);

  if (boundary.length < 3) {
    return new THREE_LIB.BoxGeometry(1, 1, 0.2);
  }

  const geom = buildDistanceFieldInflatedGeometry(boundary, options, THREE_LIB);
  if (geom && typeof geom.center === 'function') {
    geom.center();
  }
  return geom;
}
