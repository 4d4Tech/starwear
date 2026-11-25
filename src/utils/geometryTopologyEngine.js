/**
 * geometryTopologyEngine.js
 * 
 * Interactive Sub-Element Mesh Topology & Geometric Modeling Engine.
 * Provides vertex, edge, and face extraction, manipulation, and topological
 * operations (Poke Face, Vertex Circle Expander, Extrude, Inset, Subdivide, Delete).
 * 
 * Implements features from technical specification and user diagram:
 * - View 1: Quad/polygon face with vertices and boundary edges
 * - View 2: "Add Vertex to Face" (Poke Face / Center Vertex Subdivide)
 * - View 3: Vertex Translation along Normal/Axis (Pyramid Peak Formation)
 * - View 4 (4.a & 4.b): "Expand Vertex into Circle / Face" (Vertex Circle Expander / Bevel)
 */

import * as THREE from 'three';

const EPSILON = 1e-5;

function arePointsEqual(p1, p2, tol = EPSILON) {
  return (
    Math.abs(p1.x - p2.x) <= tol &&
    Math.abs(p1.y - p2.y) <= tol &&
    Math.abs(p1.z - p2.z) <= tol
  );
}

function computeFaceNormal(v0, v1, v2) {
  const e1 = new THREE.Vector3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z);
  const e2 = new THREE.Vector3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z);
  const n = new THREE.Vector3().crossVectors(e1, e2);
  if (n.lengthSq() > 1e-12) {
    n.normalize();
  } else {
    n.set(0, 1, 0);
  }
  return n;
}

/**
 * Extracts a high-level editable topology (unique vertices, unique edges, polygon faces)
 * from any Three.js BufferGeometry.
 */
export function extractMeshTopology(geometry) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) {
    return { vertices: [], edges: [], faces: [] };
  }

  const posAttr = geometry.attributes.position;
  const numRawVertices = posAttr.count;

  // 1. Weld / De-duplicate shared vertices
  const uniqueVertices = [];
  const rawToUniqueMap = new Int32Array(numRawVertices);

  // Simple spatial hash grid for fast vertex welding
  const gridSize = 0.001;
  const grid = new Map();

  for (let i = 0; i < numRawVertices; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const gx = Math.round(x / gridSize);
    const gy = Math.round(y / gridSize);
    const gz = Math.round(z / gridSize);
    const key = `${gx}_${gy}_${gz}`;

    let matchIdx = -1;
    const candidates = grid.get(key) || [];
    for (let c = 0; c < candidates.length; c++) {
      const idx = candidates[c];
      const uv = uniqueVertices[idx];
      if (arePointsEqual({ x, y, z }, uv, 0.0005)) {
        matchIdx = idx;
        break;
      }
    }

    if (matchIdx !== -1) {
      rawToUniqueMap[i] = matchIdx;
    } else {
      const newIdx = uniqueVertices.length;
      uniqueVertices.push({
        id: `v_${newIdx}`,
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
        z: Number(z.toFixed(6))
      });
      rawToUniqueMap[i] = newIdx;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(newIdx);
    }
  }

  // 2. Extract triangles from index or sequential triplets
  const indexAttr = geometry.index;
  const rawTriangles = [];
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const i0 = rawToUniqueMap[indexAttr.getX(i)];
      const i1 = rawToUniqueMap[indexAttr.getX(i + 1)];
      const i2 = rawToUniqueMap[indexAttr.getX(i + 2)];
      if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
        rawTriangles.push([i0, i1, i2]);
      }
    }
  } else {
    for (let i = 0; i < numRawVertices; i += 3) {
      const i0 = rawToUniqueMap[i];
      const i1 = rawToUniqueMap[i + 1];
      const i2 = rawToUniqueMap[i + 2];
      if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
        rawTriangles.push([i0, i1, i2]);
      }
    }
  }

  // 3. Merge coplanar adjacent triangle pairs into quads where applicable
  // This produces clean, intuitive quad faces (e.g. 6 faces on a cube instead of 12 triangles)
  const faces = [];
  const usedTriangles = new Uint8Array(rawTriangles.length);

  // Build edge-to-triangle adjacency map
  const edgeToTriMap = new Map();
  rawTriangles.forEach((tri, tIdx) => {
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const edgeKey = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeToTriMap.has(edgeKey)) edgeToTriMap.set(edgeKey, []);
      edgeToTriMap.get(edgeKey).push({ tIdx, a, b });
    }
  });

  for (let t = 0; t < rawTriangles.length; t++) {
    if (usedTriangles[t]) continue;
    const tri1 = rawTriangles[t];
    const n1 = computeFaceNormal(
      uniqueVertices[tri1[0]],
      uniqueVertices[tri1[1]],
      uniqueVertices[tri1[2]]
    );

    let mergedQuad = null;

    for (let e = 0; e < 3; e++) {
      const a = tri1[e];
      const b = tri1[(e + 1) % 3];
      const edgeKey = a < b ? `${a}_${b}` : `${b}_${a}`;
      const neighbors = edgeToTriMap.get(edgeKey) || [];

      for (let n = 0; n < neighbors.length; n++) {
        const neighbor = neighbors[n];
        const t2 = neighbor.tIdx;
        if (t2 === t || usedTriangles[t2]) continue;

        const tri2 = rawTriangles[t2];
        const n2 = computeFaceNormal(
          uniqueVertices[tri2[0]],
          uniqueVertices[tri2[1]],
          uniqueVertices[tri2[2]]
        );

        // Check if triangles are coplanar and share the opposite-directed edge
        if (n1.dot(n2) > 0.998) {
          // Find vertex in tri1 opposite edge (a, b)
          const opp1 = tri1.find((v) => v !== a && v !== b);
          // Find vertex in tri2 opposite edge (a, b)
          const opp2 = tri2.find((v) => v !== a && v !== b);

          if (opp1 !== undefined && opp2 !== undefined) {
            // Form candidate quad [opp1, a, opp2, b] or [opp1, b, opp2, a]
            const candidateQuad = [opp1, a, opp2, b];
            // Verify quad convexity: diagonal intersection inside
            const pOpp1 = uniqueVertices[opp1];
            const pA = uniqueVertices[a];
            const pOpp2 = uniqueVertices[opp2];
            const pB = uniqueVertices[b];

            const nA = computeFaceNormal(pOpp1, pA, pOpp2);
            const nB = computeFaceNormal(pOpp2, pB, pOpp1);
            if (nA.dot(n1) > 0.99 && nB.dot(n1) > 0.99) {
              mergedQuad = { quad: candidateQuad, t1: t, t2 };
              break;
            }
          }
        }
      }
      if (mergedQuad) break;
    }

    if (mergedQuad) {
      usedTriangles[mergedQuad.t1] = 1;
      usedTriangles[mergedQuad.t2] = 1;
      faces.push({
        id: `f_${faces.length}`,
        indices: mergedQuad.quad,
        normal: { x: n1.x, y: n1.y, z: n1.z }
      });
    } else {
      usedTriangles[t] = 1;
      faces.push({
        id: `f_${faces.length}`,
        indices: [tri1[0], tri1[1], tri1[2]],
        normal: { x: n1.x, y: n1.y, z: n1.z }
      });
    }
  }

  // 4. Extract unique edges from final faces
  const edgesMap = new Map();
  faces.forEach((face, fIdx) => {
    const idxs = face.indices;
    for (let i = 0; i < idxs.length; i++) {
      const a = idxs[i];
      const b = idxs[(i + 1) % idxs.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgesMap.has(key)) {
        edgesMap.set(key, {
          id: `e_${edgesMap.size}`,
          a: Math.min(a, b),
          b: Math.max(a, b),
          faces: [fIdx]
        });
      } else {
        const edge = edgesMap.get(key);
        if (!edge.faces.includes(fIdx)) edge.faces.push(fIdx);
      }
    }
  });

  return {
    vertices: uniqueVertices,
    edges: Array.from(edgesMap.values()),
    faces: faces
  };
}

/**
 * Rebuilds a clean Three.js BufferGeometry from an editable topology representation.
 */
export function buildBufferGeometryFromTopology(topology, THREE_LIB = THREE) {
  if (!topology || !Array.isArray(topology.vertices) || topology.vertices.length === 0) {
    return new THREE_LIB.BoxGeometry(1, 1, 1);
  }

  const { vertices, faces } = topology;

  // Triangulate all faces (quads, triangles, and N-gon circular faces)
  const triangleIndices = [];

  faces.forEach((face) => {
    const idxs = face.indices;
    if (!idxs || idxs.length < 3) return;

    if (idxs.length === 3) {
      triangleIndices.push(idxs[0], idxs[1], idxs[2]);
    } else if (idxs.length === 4) {
      // Quad: 2 triangles
      triangleIndices.push(idxs[0], idxs[1], idxs[2]);
      triangleIndices.push(idxs[0], idxs[2], idxs[3]);
    } else {
      // N-gon (e.g. circle face created by View 4): Triangle fan from center
      for (let i = 1; i < idxs.length - 1; i++) {
        triangleIndices.push(idxs[0], idxs[i], idxs[i + 1]);
      }
    }
  });

  if (triangleIndices.length === 0) {
    return new THREE_LIB.BoxGeometry(1, 1, 1);
  }

  // Flatten vertex positions
  const positions = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    positions[i * 3] = Number(v.x) || 0;
    positions[i * 3 + 1] = Number(v.y) || 0;
    positions[i * 3 + 2] = Number(v.z) || 0;
  }

  const geom = new THREE_LIB.BufferGeometry();
  geom.setAttribute('position', new THREE_LIB.BufferAttribute(positions, 3));

  if (vertices.length > 65535) {
    geom.setIndex(new THREE_LIB.BufferAttribute(new Uint32Array(triangleIndices), 1));
  } else {
    geom.setIndex(new THREE_LIB.BufferAttribute(new Uint16Array(triangleIndices), 1));
  }

  geom.computeVertexNormals();

  // Generate UV coordinates (planar projection mapped to bounding box)
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (bb) {
    const rangeX = Math.max(0.001, bb.max.x - bb.min.x);
    const rangeY = Math.max(0.001, bb.max.y - bb.min.y);
    const uvs = new Float32Array(vertices.length * 2);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      uvs[i * 2] = (v.x - bb.min.x) / rangeX;
      uvs[i * 2 + 1] = (v.y - bb.min.y) / rangeY;
    }
    geom.setAttribute('uv', new THREE_LIB.BufferAttribute(uvs, 2));
  }

  return geom;
}

/**
 * Re-indexes edges from faces and vertices
 */
export function recomputeTopologyEdges(topology) {
  const edgesMap = new Map();
  topology.faces.forEach((face, fIdx) => {
    const idxs = face.indices;
    for (let i = 0; i < idxs.length; i++) {
      const a = idxs[i];
      const b = idxs[(i + 1) % idxs.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgesMap.has(key)) {
        edgesMap.set(key, {
          id: `e_${edgesMap.size}`,
          a: Math.min(a, b),
          b: Math.max(a, b),
          faces: [fIdx]
        });
      } else {
        const edge = edgesMap.get(key);
        if (!edge.faces.includes(fIdx)) edge.faces.push(fIdx);
      }
    }
  });
  topology.edges = Array.from(edgesMap.values());
}

/**
 * FEATURE 1 (View 2): "Add Vertex to Face" (Poke Face)
 * Takes a selected face, adds a vertex at its centroid (or specified point),
 * and replaces the face with triangles connecting each perimeter edge to the center.
 * Returns the index of the newly added vertex so it can be moved/raised (View 3).
 */
export function pokeFace(topology, faceIndex, customCenterPoint = null) {
  if (!topology || !topology.faces || faceIndex < 0 || faceIndex >= topology.faces.length) {
    return null;
  }

  const face = topology.faces[faceIndex];
  const idxs = face.indices;
  if (!idxs || idxs.length < 3) return null;

  // Calculate face center if not custom specified
  let cx = 0, cy = 0, cz = 0;
  if (customCenterPoint) {
    cx = Number(customCenterPoint.x) || 0;
    cy = Number(customCenterPoint.y) || 0;
    cz = Number(customCenterPoint.z) || 0;
  } else {
    for (let i = 0; i < idxs.length; i++) {
      const v = topology.vertices[idxs[i]];
      cx += v.x;
      cy += v.y;
      cz += v.z;
    }
    cx /= idxs.length;
    cy /= idxs.length;
    cz /= idxs.length;
  }

  const newVertexIndex = topology.vertices.length;
  topology.vertices.push({
    id: `v_${newVertexIndex}`,
    x: Number(cx.toFixed(6)),
    y: Number(cy.toFixed(6)),
    z: Number(cz.toFixed(6))
  });

  // Calculate face normal
  const p0 = topology.vertices[idxs[0]];
  const p1 = topology.vertices[idxs[1]];
  const p2 = topology.vertices[idxs[2]];
  const n = computeFaceNormal(p0, p1, p2);

  // Replace original face with triangular fan meeting at the new center vertex
  const newFaces = [];
  for (let i = 0; i < idxs.length; i++) {
    const a = idxs[i];
    const b = idxs[(i + 1) % idxs.length];
    newFaces.push({
      id: `f_${faceIndex}_poke_${i}`,
      indices: [a, b, newVertexIndex],
      normal: { x: n.x, y: n.y, z: n.z }
    });
  }

  // Splice out original face, insert new triangular faces
  topology.faces.splice(faceIndex, 1, ...newFaces);
  // Re-id faces cleanly
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });

  recomputeTopologyEdges(topology);

  return newVertexIndex;
}

/**
 * FEATURE 2 (View 4: 4.a & 4.b): "Expand Vertex into Circle / Face"
 * Takes a vertex (e.g. the vertex added in View 2 and raised in View 3)
 * and expands it into a circular/radius face (with configurable segments & radius),
 * connecting the perimeter vertices of the circle back to the surrounding boundary.
 * 
 * Top View (4.a): Red circle in the center with 4 radiating diagonals to corner vertices.
 * Side View (4.b): Truncated frustum peak with flat circular horizontal cap face.
 */
export function expandVertexToCircle(topology, vertexIndex, options = {}) {
  if (!topology || !topology.vertices || vertexIndex < 0 || vertexIndex >= topology.vertices.length) {
    return null;
  }

  const centerVert = topology.vertices[vertexIndex];
  const radius = Math.max(0.01, Number(options.radius ?? 0.25) || 0.25);
  const segments = Math.max(4, Math.min(64, Number(options.segments ?? 16) || 16));
  const heightOffset = Number(options.heightOffset ?? 0) || 0;

  // 1. Find all faces meeting at vertexIndex
  const incidentFaceIndices = [];
  topology.faces.forEach((f, idx) => {
    if (f.indices.includes(vertexIndex)) {
      incidentFaceIndices.push(idx);
    }
  });

  if (incidentFaceIndices.length < 3) {
    console.warn('[geometryTopologyEngine] expandVertexToCircle requires at least 3 incident faces.');
    return null;
  }

  // 2. Compute average normal of the incident faces to orient the circle plane
  const avgNormal = new THREE.Vector3();
  incidentFaceIndices.forEach((fIdx) => {
    const f = topology.faces[fIdx];
    const v0 = topology.vertices[f.indices[0]];
    const v1 = topology.vertices[f.indices[1]];
    const v2 = topology.vertices[f.indices[2]];
    const fn = computeFaceNormal(v0, v1, v2);
    avgNormal.add(fn);
  });
  if (avgNormal.lengthSq() > 1e-8) {
    avgNormal.normalize();
  } else {
    avgNormal.set(0, 1, 0);
  }

  // 3. Find outer perimeter loop of neighboring vertices surrounding vertexIndex
  // Each incident face has an edge opposite vertexIndex.
  const outerBoundarySegments = [];
  incidentFaceIndices.forEach((fIdx) => {
    const f = topology.faces[fIdx];
    const vIdxs = f.indices;
    const vPos = vIdxs.indexOf(vertexIndex);
    const prev = vIdxs[(vPos - 1 + vIdxs.length) % vIdxs.length];
    const next = vIdxs[(vPos + 1) % vIdxs.length];
    outerBoundarySegments.push({ from: next, to: prev, fIdx });
  });

  // Order outer boundary vertices in a continuous cyclic loop
  const orderedOuterLoop = [];
  if (outerBoundarySegments.length > 0) {
    let curr = outerBoundarySegments[0].from;
    const visited = new Set();
    while (visited.size < outerBoundarySegments.length) {
      orderedOuterLoop.push(curr);
      visited.add(curr);
      const seg = outerBoundarySegments.find((s) => s.from === curr && !visited.has(s.to));
      if (seg) {
        curr = seg.to;
      } else {
        const anySeg = outerBoundarySegments.find((s) => s.from === curr);
        if (anySeg && !orderedOuterLoop.includes(anySeg.to)) {
          curr = anySeg.to;
        } else {
          break;
        }
      }
    }
  }

  if (orderedOuterLoop.length < 3) {
    // Fallback: collect all unique neighbors
    const neighborSet = new Set();
    incidentFaceIndices.forEach((fIdx) => {
      topology.faces[fIdx].indices.forEach((i) => {
        if (i !== vertexIndex) neighborSet.add(i);
      });
    });
    orderedOuterLoop.push(...Array.from(neighborSet));
  }

  // 4. Construct local tangent basis (u, v) perpendicular to avgNormal
  const up = Math.abs(avgNormal.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangentU = new THREE.Vector3().crossVectors(up, avgNormal).normalize();
  const tangentV = new THREE.Vector3().crossVectors(avgNormal, tangentU).normalize();

  // If we have an outer loop, align tangentU to the first outer loop vertex for symmetry
  if (orderedOuterLoop.length > 0) {
    const p0 = topology.vertices[orderedOuterLoop[0]];
    const toP0 = new THREE.Vector3(p0.x - centerVert.x, p0.y - centerVert.y, p0.z - centerVert.z);
    toP0.projectOnPlane(avgNormal);
    if (toP0.lengthSq() > 1e-8) {
      tangentU.copy(toP0.normalize());
      tangentV.crossVectors(avgNormal, tangentU).normalize();
    }
  }

  // 5. Create circle vertices
  const circleCenter = new THREE.Vector3(
    centerVert.x + avgNormal.x * heightOffset,
    centerVert.y + avgNormal.y * heightOffset,
    centerVert.z + avgNormal.z * heightOffset
  );

  const circleVertexIndices = [];
  const baseVertexIdx = topology.vertices.length;

  for (let s = 0; s < segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const px = circleCenter.x + radius * (Math.cos(angle) * tangentU.x + Math.sin(angle) * tangentV.x);
    const py = circleCenter.y + radius * (Math.cos(angle) * tangentU.y + Math.sin(angle) * tangentV.y);
    const pz = circleCenter.z + radius * (Math.cos(angle) * tangentU.z + Math.sin(angle) * tangentV.z);

    const cIdx = baseVertexIdx + s;
    topology.vertices.push({
      id: `v_${cIdx}`,
      x: Number(px.toFixed(6)),
      y: Number(py.toFixed(6)),
      z: Number(pz.toFixed(6))
    });
    circleVertexIndices.push(cIdx);
  }

  // 6. Remove the old incident faces that met at vertexIndex
  // Sort indices descending so splice indices remain valid
  const sortedFaceIndices = [...incidentFaceIndices].sort((a, b) => b - a);
  sortedFaceIndices.forEach((fIdx) => {
    topology.faces.splice(fIdx, 1);
  });

  // 7. Create the top circular cap face (View 4.a circle face)
  topology.faces.push({
    id: `f_circle_cap_${topology.faces.length}`,
    indices: [...circleVertexIndices],
    normal: { x: avgNormal.x, y: avgNormal.y, z: avgNormal.z },
    isCircleCap: true
  });

  // 8. Connect the circle perimeter to the outer boundary ring vertices (View 4.b sloped walls)
  // Map outer loop vertices to their nearest circle angular vertices
  const K = orderedOuterLoop.length;
  for (let k = 0; k < K; k++) {
    const outA = orderedOuterLoop[k];
    const outB = orderedOuterLoop[(k + 1) % K];

    // Angle of outA and outB relative to tangentU/tangentV
    const pA = topology.vertices[outA];
    const pB = topology.vertices[outB];
    const dirA = new THREE.Vector3(pA.x - circleCenter.x, pA.y - circleCenter.y, pA.z - circleCenter.z).projectOnPlane(avgNormal).normalize();
    const dirB = new THREE.Vector3(pB.x - circleCenter.x, pB.y - circleCenter.y, pB.z - circleCenter.z).projectOnPlane(avgNormal).normalize();

    let angA = Math.atan2(dirA.dot(tangentV), dirA.dot(tangentU));
    if (angA < 0) angA += Math.PI * 2;
    let angB = Math.atan2(dirB.dot(tangentV), dirB.dot(tangentU));
    if (angB < 0) angB += Math.PI * 2;

    const segPerOuter = Math.max(1, Math.round(segments / K));
    const startCircIdx = Math.round((angA / (Math.PI * 2)) * segments) % segments;
    const endCircIdx = Math.round((angB / (Math.PI * 2)) * segments) % segments;

    // Build bridging quad or triangles from edge (outA, outB) to circle segment
    const cA = circleVertexIndices[startCircIdx];
    const cB = circleVertexIndices[endCircIdx];

    if (cA === cB) {
      topology.faces.push({
        id: `f_bridge_${topology.faces.length}`,
        indices: [outA, outB, cA]
      });
    } else {
      topology.faces.push({
        id: `f_bridge_${topology.faces.length}`,
        indices: [outA, outB, cB, cA]
      });
    }
  }

  // Clean up unused original vertexIndex
  // Note: we leave vertex position or mark it dissolved
  centerVert.dissolved = true;

  // Re-id faces and recompute edges
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });
  recomputeTopologyEdges(topology);

  return {
    topology,
    circleVertexIndices,
    circleFaceIndex: topology.faces.length - 1 - K
  };
}

/**
 * Move specified vertices by a delta offset vector
 */
export function moveVertices(topology, vertexIndices, delta) {
  if (!topology || !Array.isArray(topology.vertices) || !Array.isArray(vertexIndices)) return topology;
  const dx = Array.isArray(delta) ? (Number(delta[0]) || 0) : (Number(delta?.x) || 0);
  const dy = Array.isArray(delta) ? (Number(delta[1]) || 0) : (Number(delta?.y) || 0);
  const dz = Array.isArray(delta) ? (Number(delta[2]) || 0) : (Number(delta?.z) || 0);

  vertexIndices.forEach((idx) => {
    if (idx >= 0 && idx < topology.vertices.length) {
      const v = topology.vertices[idx];
      v.x = Number((v.x + dx).toFixed(6));
      v.y = Number((v.y + dy).toFixed(6));
      v.z = Number((v.z + dz).toFixed(6));
    }
  });

  recomputeTopologyEdges(topology);
  return topology;
}

/**
 * Extrudes a selected face outward along its normal by distance, with optional inset/taper
 */
export function extrudeFace(topology, faceIndex, distance = 0.25, inset = 0) {
  if (!topology || !topology.faces || faceIndex < 0 || faceIndex >= topology.faces.length) return null;
  const face = topology.faces[faceIndex];
  const idxs = [...face.indices];
  if (idxs.length < 3) return null;

  // Compute face normal
  const p0 = topology.vertices[idxs[0]];
  const p1 = topology.vertices[idxs[1]];
  const p2 = topology.vertices[idxs[2]];
  const normal = computeFaceNormal(p0, p1, p2);

  // Compute centroid for inset
  let cx = 0, cy = 0, cz = 0;
  idxs.forEach((idx) => {
    const v = topology.vertices[idx];
    cx += v.x; cy += v.y; cz += v.z;
  });
  cx /= idxs.length; cy /= idxs.length; cz /= idxs.length;

  const newVertexIndices = [];
  const baseIdx = topology.vertices.length;

  for (let i = 0; i < idxs.length; i++) {
    const v = topology.vertices[idxs[i]];
    // Extrude along normal
    let nx = v.x + normal.x * distance;
    let ny = v.y + normal.y * distance;
    let nz = v.z + normal.z * distance;

    // Inset toward centroid
    if (inset > 0) {
      nx += (cx - nx) * Math.min(0.9, inset);
      ny += (cy - ny) * Math.min(0.9, inset);
      nz += (cz - nz) * Math.min(0.9, inset);
    }

    topology.vertices.push({
      id: `v_${baseIdx + i}`,
      x: Number(nx.toFixed(6)),
      y: Number(ny.toFixed(6)),
      z: Number(nz.toFixed(6))
    });
    newVertexIndices.push(baseIdx + i);
  }

  // Update original face to use new extruded cap vertices
  face.indices = [...newVertexIndices];

  // Add side quad faces bridging old vertices to new extruded vertices
  const sideFaces = [];
  for (let i = 0; i < idxs.length; i++) {
    const a = idxs[i];
    const b = idxs[(i + 1) % idxs.length];
    const newB = newVertexIndices[(i + 1) % idxs.length];
    const newA = newVertexIndices[i];

    sideFaces.push({
      id: `f_side_${topology.faces.length + sideFaces.length}`,
      indices: [a, b, newB, newA]
    });
  }

  topology.faces.push(...sideFaces);
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });
  recomputeTopologyEdges(topology);

  return newVertexIndices;
}

/**
 * Insets a face toward its center
 */
export function insetFace(topology, faceIndex, amount = 0.15) {
  if (!topology || !topology.faces || faceIndex < 0 || faceIndex >= topology.faces.length) return null;
  const face = topology.faces[faceIndex];
  const idxs = [...face.indices];
  if (idxs.length < 3) return null;

  let cx = 0, cy = 0, cz = 0;
  idxs.forEach((idx) => {
    const v = topology.vertices[idx];
    cx += v.x; cy += v.y; cz += v.z;
  });
  cx /= idxs.length; cy /= idxs.length; cz /= idxs.length;

  const baseIdx = topology.vertices.length;
  const newInnerIndices = [];

  for (let i = 0; i < idxs.length; i++) {
    const v = topology.vertices[idxs[i]];
    const nx = v.x + (cx - v.x) * Math.min(0.9, amount);
    const ny = v.y + (cy - v.y) * Math.min(0.9, amount);
    const nz = v.z + (cz - v.z) * Math.min(0.9, amount);

    topology.vertices.push({
      id: `v_${baseIdx + i}`,
      x: Number(nx.toFixed(6)),
      y: Number(ny.toFixed(6)),
      z: Number(nz.toFixed(6))
    });
    newInnerIndices.push(baseIdx + i);
  }

  // Center face becomes the inset face
  face.indices = [...newInnerIndices];

  // Create ring of perimeter quads
  const ringFaces = [];
  for (let i = 0; i < idxs.length; i++) {
    const a = idxs[i];
    const b = idxs[(i + 1) % idxs.length];
    const innerB = newInnerIndices[(i + 1) % idxs.length];
    const innerA = newInnerIndices[i];

    ringFaces.push({
      id: `f_inset_ring_${topology.faces.length + ringFaces.length}`,
      indices: [a, b, innerB, innerA]
    });
  }

  topology.faces.push(...ringFaces);
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });
  recomputeTopologyEdges(topology);

  return newInnerIndices;
}

/**
 * Deletes a face from the topology
 */
export function deleteFace(topology, faceIndex) {
  if (!topology || !topology.faces || faceIndex < 0 || faceIndex >= topology.faces.length) return false;
  topology.faces.splice(faceIndex, 1);
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });
  recomputeTopologyEdges(topology);
  return true;
}

/**
 * Deletes a vertex and removes all faces that reference it
 */
export function deleteVertex(topology, vertexIndex) {
  if (!topology || !topology.vertices || vertexIndex < 0 || vertexIndex >= topology.vertices.length) return false;
  topology.faces = topology.faces.filter((f) => !f.indices.includes(vertexIndex));
  topology.faces.forEach((f, idx) => { f.id = `f_${idx}`; });
  recomputeTopologyEdges(topology);
  return true;
}
