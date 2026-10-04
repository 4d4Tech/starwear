import * as THREE from 'three';

// ============================================================================
// HUMANOID ARMATURE & CHARACTER ANIMATION ENGINE FOR STUDIO 4D*4
// Standard 19-Bone Biped Rig, Precision Linear Blend Skinning, and
// Expressive Procedural Character Animation Cycles.
// ============================================================================

export const HUMANOID_BONE_NAMES = [
  'Root',
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot'
];

/**
 * Distance from a 3D point P to a line segment defined by endpoints A and B.
 */
function pointToSegmentDistance(P, A, B) {
  const ab = new THREE.Vector3().subVectors(B, A);
  const ap = new THREE.Vector3().subVectors(P, A);
  const abLenSq = ab.lengthSq();
  if (abLenSq < 1e-7) return P.distanceTo(A);
  let t = ap.dot(ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const proj = new THREE.Vector3().copy(A).addScaledVector(ab, t);
  return P.distanceTo(proj);
}

/**
 * Inspect 3D object to determine dimensions and approximate resting pose.
 */
export function analyzeHumanoidGeometry(object) {
  object.updateWorldMatrix(true, true);
  const invWorld = object.matrixWorld.clone().invert();

  const bbox = new THREE.Box3();
  const v = new THREE.Vector3();

  object.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const posAttr = node.geometry.attributes.position;
      if (!posAttr) return;
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(node.matrixWorld).applyMatrix4(invWorld);
        bbox.expandByPoint(v);
      }
    }
  });

  if (bbox.isEmpty()) {
    bbox.min.set(-0.5, 0, -0.25);
    bbox.max.set(0.5, 2.0, 0.25);
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  const H = Math.max(0.01, size.y || 2.0);
  const W = Math.max(0.01, size.x || 1.0);
  const D = Math.max(0.01, size.z || 0.6);

  // Sample vertex positions in local space to detect arm orientation (T-pose vs A-pose vs arms-at-sides)
  let maxArmSpread = 0;
  let midBodyWidth = 0;
  let sampleCount = 0;

  object.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const posAttr = node.geometry.attributes.position;
      if (!posAttr) return;
      const count = Math.min(posAttr.count, 600);
      const step = Math.max(1, Math.floor(posAttr.count / count));

      for (let i = 0; i < posAttr.count; i += step) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(node.matrixWorld).applyMatrix4(invWorld);

        const relY = (v.y - bbox.min.y) / H;
        const distFromCenter = Math.abs(v.x - center.x);

        // Shoulder / Upper torso band
        if (relY >= 0.65 && relY <= 0.85) {
          if (distFromCenter > maxArmSpread) maxArmSpread = distFromCenter;
        }
        // Mid body band
        if (relY >= 0.45 && relY <= 0.60) {
          if (distFromCenter > midBodyWidth) midBodyWidth = distFromCenter;
        }
        sampleCount++;
      }
    }
  });

  let poseType = 'A_POSE';
  const armSpreadRatio = maxArmSpread / (W * 0.5 || 1);
  if (armSpreadRatio > 0.85) {
    poseType = 'T_POSE';
  } else if (armSpreadRatio < 0.55) {
    poseType = 'ARMS_DOWN';
  }

  const isLikelyHumanoid = H > 0.2 && H / Math.max(0.01, Math.min(W, D)) >= 1.0;

  return {
    bbox,
    size,
    center,
    height: H,
    width: W,
    depth: D,
    poseType,
    isLikelyHumanoid
  };
}

/**
 * Constructs standard humanoid Bone hierarchy fitted to the object's proportions.
 */
export function buildHumanoidSkeleton(analysis) {
  const { height: H, width: W, depth: D, center, bbox, poseType } = analysis;

  const bones = [];
  const boneMap = {};

  const createBone = (name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bones.push(bone);
    boneMap[name] = bone;
    return bone;
  };

  // 1. Root & Spine Core
  const root = createBone('Root');
  root.position.set(center.x, bbox.min.y, center.z);

  const hips = createBone('Hips');
  hips.position.set(0, 0.52 * H, 0);
  root.add(hips);

  const spine = createBone('Spine');
  spine.position.set(0, 0.11 * H, 0);
  hips.add(spine);

  const chest = createBone('Chest');
  chest.position.set(0, 0.13 * H, 0);
  spine.add(chest);

  const neck = createBone('Neck');
  neck.position.set(0, 0.10 * H, 0);
  chest.add(neck);

  const head = createBone('Head');
  head.position.set(0, 0.08 * H, 0);
  neck.add(head);

  // 2. Arms (Configured per detected resting pose)
  const leftShoulder = createBone('LeftShoulder');
  const rightShoulder = createBone('RightShoulder');
  chest.add(leftShoulder);
  chest.add(rightShoulder);

  const leftArm = createBone('LeftArm');
  const leftForeArm = createBone('LeftForeArm');
  const leftHand = createBone('LeftHand');
  leftShoulder.add(leftArm);
  leftArm.add(leftForeArm);
  leftForeArm.add(leftHand);

  const rightArm = createBone('RightArm');
  const rightForeArm = createBone('RightForeArm');
  const rightHand = createBone('RightHand');
  rightShoulder.add(rightArm);
  rightArm.add(rightForeArm);
  rightForeArm.add(rightHand);

  if (poseType === 'T_POSE') {
    // T-Pose: Horizontal arms
    leftShoulder.position.set(0.09 * W, 0.02 * H, 0);
    leftArm.position.set(0.11 * W, 0, 0);
    leftForeArm.position.set(0.15 * W, 0, 0);
    leftHand.position.set(0.12 * W, 0, 0);

    rightShoulder.position.set(-0.09 * W, 0.02 * H, 0);
    rightArm.position.set(-0.11 * W, 0, 0);
    rightForeArm.position.set(-0.15 * W, 0, 0);
    rightHand.position.set(-0.12 * W, 0, 0);
  } else if (poseType === 'ARMS_DOWN') {
    // Arms Down: Vertical along torso
    leftShoulder.position.set(0.08 * W, 0.01 * H, 0);
    leftArm.position.set(0.06 * W, -0.05 * H, 0);
    leftForeArm.position.set(0.02 * W, -0.15 * H, 0);
    leftHand.position.set(0.01 * W, -0.14 * H, 0);

    rightShoulder.position.set(-0.08 * W, 0.01 * H, 0);
    rightArm.position.set(-0.06 * W, -0.05 * H, 0);
    rightForeArm.position.set(-0.02 * W, -0.15 * H, 0);
    rightHand.position.set(-0.01 * W, -0.14 * H, 0);
  } else {
    // A-Pose (Default standard): Diagonal downward arms (~35°-45°)
    leftShoulder.position.set(0.09 * W, 0.02 * H, 0);
    leftArm.position.set(0.09 * W, -0.04 * H, 0);
    leftForeArm.position.set(0.11 * W, -0.12 * H, 0);
    leftHand.position.set(0.09 * W, -0.12 * H, 0);

    rightShoulder.position.set(-0.09 * W, 0.02 * H, 0);
    rightArm.position.set(-0.09 * W, -0.04 * H, 0);
    rightForeArm.position.set(-0.11 * W, -0.12 * H, 0);
    rightHand.position.set(-0.09 * W, -0.12 * H, 0);
  }

  // 3. Lower Limbs (Legs and Feet)
  const leftUpLeg = createBone('LeftUpLeg');
  const leftLeg = createBone('LeftLeg');
  const leftFoot = createBone('LeftFoot');
  hips.add(leftUpLeg);
  leftUpLeg.add(leftLeg);
  leftLeg.add(leftFoot);

  leftUpLeg.position.set(0.12 * W, -0.02 * H, 0);
  leftLeg.position.set(0, -0.24 * H, 0);
  leftFoot.position.set(0, -0.23 * H, 0.05 * D);

  const rightUpLeg = createBone('RightUpLeg');
  const rightLeg = createBone('RightLeg');
  const rightFoot = createBone('RightFoot');
  hips.add(rightUpLeg);
  rightUpLeg.add(rightLeg);
  rightLeg.add(rightFoot);

  rightUpLeg.position.set(-0.12 * W, -0.02 * H, 0);
  rightLeg.position.set(0, -0.24 * H, 0);
  rightFoot.position.set(0, -0.23 * H, 0.05 * D);

  // Update world matrices for accurate inverse calculations
  root.updateWorldMatrix(true, true);

  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();

  return { root, bones, boneMap, skeleton };
}

/**
 * Computes linear blend skinning weights for a mesh against the humanoid skeleton.
 * Transforms a static THREE.Mesh into a deforming THREE.SkinnedMesh.
 */
export function skinMeshToHumanoid(mesh, skeleton, bones, analysis) {
  const { center, height: H, width: W } = analysis;
  const geometry = mesh.geometry.clone();
  geometry.computeVertexNormals();

  const posAttr = geometry.attributes.position;
  const vertexCount = posAttr.count;

  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  // Compute world positions for each bone's joint endpoints to form segments
  const boneWorldPos = {};
  bones.forEach((b) => {
    const wp = new THREE.Vector3();
    b.getWorldPosition(wp);
    // Convert to mesh local coordinate space
    mesh.worldToLocal(wp);
    boneWorldPos[b.name] = wp;
  });

  // Define bone line segments for distance calculations
  const headTop = boneWorldPos['Head'].clone().add(new THREE.Vector3(0, 0.12 * H, 0));
  const segments = [
    { name: 'Hips', a: boneWorldPos['Hips'], b: boneWorldPos['Spine'], idx: bones.indexOf(bones.find((b) => b.name === 'Hips')) },
    { name: 'Spine', a: boneWorldPos['Spine'], b: boneWorldPos['Chest'], idx: bones.indexOf(bones.find((b) => b.name === 'Spine')) },
    { name: 'Chest', a: boneWorldPos['Chest'], b: boneWorldPos['Neck'], idx: bones.indexOf(bones.find((b) => b.name === 'Chest')) },
    { name: 'Neck', a: boneWorldPos['Neck'], b: boneWorldPos['Head'], idx: bones.indexOf(bones.find((b) => b.name === 'Neck')) },
    { name: 'Head', a: boneWorldPos['Head'], b: headTop, idx: bones.indexOf(bones.find((b) => b.name === 'Head')) },

    { name: 'LeftShoulder', a: boneWorldPos['Chest'], b: boneWorldPos['LeftShoulder'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftShoulder')) },
    { name: 'LeftArm', a: boneWorldPos['LeftShoulder'], b: boneWorldPos['LeftArm'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftArm')) },
    { name: 'LeftForeArm', a: boneWorldPos['LeftArm'], b: boneWorldPos['LeftForeArm'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftForeArm')) },
    { name: 'LeftHand', a: boneWorldPos['LeftForeArm'], b: boneWorldPos['LeftHand'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftHand')) },

    { name: 'RightShoulder', a: boneWorldPos['Chest'], b: boneWorldPos['RightShoulder'], idx: bones.indexOf(bones.find((b) => b.name === 'RightShoulder')) },
    { name: 'RightArm', a: boneWorldPos['RightShoulder'], b: boneWorldPos['RightArm'], idx: bones.indexOf(bones.find((b) => b.name === 'RightArm')) },
    { name: 'RightForeArm', a: boneWorldPos['RightArm'], b: boneWorldPos['RightForeArm'], idx: bones.indexOf(bones.find((b) => b.name === 'RightForeArm')) },
    { name: 'RightHand', a: boneWorldPos['RightForeArm'], b: boneWorldPos['RightHand'], idx: bones.indexOf(bones.find((b) => b.name === 'RightHand')) },

    { name: 'LeftUpLeg', a: boneWorldPos['Hips'], b: boneWorldPos['LeftUpLeg'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftUpLeg')) },
    { name: 'LeftLeg', a: boneWorldPos['LeftUpLeg'], b: boneWorldPos['LeftLeg'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftLeg')) },
    { name: 'LeftFoot', a: boneWorldPos['LeftLeg'], b: boneWorldPos['LeftFoot'], idx: bones.indexOf(bones.find((b) => b.name === 'LeftFoot')) },

    { name: 'RightUpLeg', a: boneWorldPos['Hips'], b: boneWorldPos['RightUpLeg'], idx: bones.indexOf(bones.find((b) => b.name === 'RightUpLeg')) },
    { name: 'RightLeg', a: boneWorldPos['RightUpLeg'], b: boneWorldPos['RightLeg'], idx: bones.indexOf(bones.find((b) => b.name === 'RightLeg')) },
    { name: 'RightFoot', a: boneWorldPos['RightLeg'], b: boneWorldPos['RightFoot'], idx: bones.indexOf(bones.find((b) => b.name === 'RightFoot')) }
  ];

  const P = new THREE.Vector3();
  const hipsY = boneWorldPos['Hips'].y;
  const chestY = boneWorldPos['Chest'].y;
  const neckY = boneWorldPos['Neck'].y;
  const localCenterX = mesh.worldToLocal(center.clone()).x;

  for (let i = 0; i < vertexCount; i++) {
    P.fromBufferAttribute(posAttr, i);

    const candidates = [];

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      let dist = pointToSegmentDistance(P, seg.a, seg.b);

      // Anatomical isolation rules:
      // Left limb isolation: if vertex is on right, heavily penalize left limb bones
      if (seg.name.startsWith('Left') && P.x < localCenterX - 0.02 * W) {
        dist *= 20.0;
      }
      // Right limb isolation: if vertex is on left, heavily penalize right limb bones
      if (seg.name.startsWith('Right') && P.x > localCenterX + 0.02 * W) {
        dist *= 20.0;
      }
      // Lower body isolation: vertices below hips should not be influenced by arms/head
      if (P.y < hipsY - 0.05 * H) {
        if (seg.name.includes('Arm') || seg.name.includes('Hand') || seg.name.includes('Shoulder') || seg.name.includes('Head') || seg.name.includes('Neck')) {
          dist *= 25.0;
        }
      }
      // Upper body isolation: vertices above chest should not be influenced by legs
      if (P.y > chestY + 0.05 * H) {
        if (seg.name.includes('Leg') || seg.name.includes('Foot')) {
          dist *= 25.0;
        }
      }
      // Head region: vertices above neck strongly favor Head & Neck
      if (P.y > neckY) {
        if (seg.name === 'Head') dist *= 0.5;
        if (seg.name === 'Neck') dist *= 0.7;
        if (seg.name.includes('Leg') || seg.name.includes('Arm')) dist *= 30.0;
      }

      // Smooth inverse-distance falloff
      const weight = 1.0 / (Math.pow(dist, 2.8) + 0.0001);
      candidates.push({ idx: seg.idx, weight });
    }

    // Sort to keep the 4 strongest influencing bones
    candidates.sort((a, b) => b.weight - a.weight);
    const top4 = candidates.slice(0, 4);

    let sumWeight = 0;
    for (let k = 0; k < 4; k++) {
      sumWeight += top4[k] ? top4[k].weight : 0;
    }
    if (sumWeight === 0) sumWeight = 1;

    for (let k = 0; k < 4; k++) {
      const idxPos = i * 4 + k;
      if (top4[k] && top4[k].weight > 0) {
        skinIndices[idxPos] = top4[k].idx;
        skinWeights[idxPos] = top4[k].weight / sumWeight;
      } else {
        skinIndices[idxPos] = 0;
        skinWeights[idxPos] = 0.0;
      }
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // Clone material to avoid modifying originals
  let material = mesh.material;
  if (Array.isArray(material)) {
    material = material.map((m) => m.clone());
  } else if (material) {
    material = material.clone();
  } else {
    material = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.5, metalness: 0.1 });
  }

  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  skinnedMesh.name = mesh.name || 'Skinned_Mesh';
  skinnedMesh.position.copy(mesh.position);
  skinnedMesh.quaternion.copy(mesh.quaternion);
  skinnedMesh.scale.copy(mesh.scale);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.userData = { ...mesh.userData, isSkinned: true };

  return skinnedMesh;
}

// ============================================================================
// CHARACTER ANIMATION CLIP GENERATOR
// Produces 8 authentic humanoid animations:
// 1. Idle (Breathing, subtle hip sway, gentle head glance)
// 2. Walk Cycle (Natural biped stride, hip bob, knee flexion, arm counter-swing)
// 3. Run Cycle (Dynamic sprint, forward lean, high knees, bent arm pump)
// 4. Hip-Hop Dance (Rhythmic bounce, torso wave, arm pop & lock)
// 5. Friendly Wave (Right arm elevation, forearm & hand waving)
// 6. Jump (Crouch, upward explosion, airborne tuck, landing cushion)
// 7. Victory Cheer (Double arms pump V-shape, proud arch, bounce)
// 8. T-Pose (Rest reference stance)
// ============================================================================

function createQuatTrack(boneName, times, eulerKeyframes) {
  const values = [];
  const q = new THREE.Quaternion();
  eulerKeyframes.forEach(([x, y, z]) => {
    q.setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
    values.push(q.x, q.y, q.z, q.w);
  });
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function createPosTrack(boneName, times, basePos, deltaKeyframes) {
  const values = [];
  deltaKeyframes.forEach(([dx, dy, dz]) => {
    values.push(basePos.x + dx, basePos.y + dy, basePos.z + dz);
  });
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values);
}

export function generateHumanoidAnimationClips(boneMap, analysis) {
  const { height: H, width: W, depth: D = 0.5 } = analysis;
  const clips = [];
  const hipsBasePos = boneMap['Hips'].position.clone();

  // --------------------------------------------------------------------------
  // 1. IDLE (3.0s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.75, 1.5, 2.25, 3.0];
    const tracks = [];

    // Hips: subtle breathing bob & weight shift
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, 0, 0],
      [0.008 * W, 0.006 * H, 0],
      [0, 0.012 * H, 0],
      [-0.008 * W, 0.006 * H, 0],
      [0, 0, 0]
    ]));

    // Hips rotation
    tracks.push(createQuatTrack('Hips', times, [
      [0, 0, 0],
      [0.01, 0, -0.02],
      [0, 0, 0],
      [-0.01, 0, 0.02],
      [0, 0, 0]
    ]));

    // Spine & Chest: natural breathing expansion
    tracks.push(createQuatTrack('Spine', times, [
      [0, 0, 0],
      [0.02, 0, 0],
      [0.035, 0, 0],
      [0.015, 0, 0],
      [0, 0, 0]
    ]));
    tracks.push(createQuatTrack('Chest', times, [
      [0, 0, 0],
      [0.03, 0, 0.01],
      [0.05, 0, 0],
      [0.02, 0, -0.01],
      [0, 0, 0]
    ]));

    // Head: subtle glance
    tracks.push(createQuatTrack('Head', times, [
      [0, 0, 0],
      [-0.02, 0.04, 0.015],
      [-0.01, 0.02, 0],
      [-0.02, -0.03, -0.015],
      [0, 0, 0]
    ]));

    // Arms: relaxed idle sway
    tracks.push(createQuatTrack('LeftArm', times, [
      [0, 0, 0],
      [0.02, 0, 0.02],
      [0.03, 0, 0.01],
      [0.01, 0, 0],
      [0, 0, 0]
    ]));
    tracks.push(createQuatTrack('RightArm', times, [
      [0, 0, 0],
      [-0.02, 0, -0.02],
      [-0.03, 0, -0.01],
      [-0.01, 0, 0],
      [0, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Idle', 3.0, tracks));
  }

  // --------------------------------------------------------------------------
  // 2. WALK CYCLE (1.2s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.3, 0.6, 0.9, 1.2];
    const tracks = [];

    // Hips bounce and sway
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, -0.025 * H, 0],
      [0.018 * W, 0.015 * H, 0],
      [0, -0.025 * H, 0],
      [-0.018 * W, 0.015 * H, 0],
      [0, -0.025 * H, 0]
    ]));

    // Hips pelvic twist
    tracks.push(createQuatTrack('Hips', times, [
      [0.03, 0.12, -0.04],
      [0.01, 0.0, 0.03],
      [0.03, -0.12, 0.04],
      [0.01, 0.0, -0.03],
      [0.03, 0.12, -0.04]
    ]));

    // Spine & Chest: counter-rotation
    tracks.push(createQuatTrack('Spine', times, [
      [0.04, -0.05, 0.02],
      [0.03, 0.0, -0.01],
      [0.04, 0.05, -0.02],
      [0.03, 0.0, 0.01],
      [0.04, -0.05, 0.02]
    ]));
    tracks.push(createQuatTrack('Chest', times, [
      [0.02, -0.07, 0.01],
      [0.01, 0.0, 0.0],
      [0.02, 0.07, -0.01],
      [0.01, 0.0, 0.0],
      [0.02, -0.07, 0.01]
    ]));

    // Legs
    // LeftUpLeg: Swing forward at t=0, sweep back at t=0.6
    tracks.push(createQuatTrack('LeftUpLeg', times, [
      [0.48, 0, 0.03],
      [0.15, 0, 0.01],
      [-0.38, 0, -0.02],
      [-0.10, 0, 0],
      [0.48, 0, 0.03]
    ]));
    // LeftLeg: Flex during recovery swing
    tracks.push(createQuatTrack('LeftLeg', times, [
      [-0.08, 0, 0],
      [-0.15, 0, 0],
      [-0.05, 0, 0],
      [-0.65, 0, 0],
      [-0.08, 0, 0]
    ]));
    // LeftFoot: Heel strike / push off
    tracks.push(createQuatTrack('LeftFoot', times, [
      [0.22, 0, 0],
      [-0.05, 0, 0],
      [-0.25, 0, 0],
      [0.10, 0, 0],
      [0.22, 0, 0]
    ]));

    // RightUpLeg: Opposite phase
    tracks.push(createQuatTrack('RightUpLeg', times, [
      [-0.38, 0, -0.02],
      [-0.10, 0, 0],
      [0.48, 0, 0.03],
      [0.15, 0, 0.01],
      [-0.38, 0, -0.02]
    ]));
    tracks.push(createQuatTrack('RightLeg', times, [
      [-0.05, 0, 0],
      [-0.65, 0, 0],
      [-0.08, 0, 0],
      [-0.15, 0, 0],
      [-0.05, 0, 0]
    ]));
    tracks.push(createQuatTrack('RightFoot', times, [
      [-0.25, 0, 0],
      [0.10, 0, 0],
      [0.22, 0, 0],
      [-0.05, 0, 0],
      [-0.25, 0, 0]
    ]));

    // Arms: Counter-swinging
    tracks.push(createQuatTrack('LeftArm', times, [
      [-0.36, 0, 0.04],
      [-0.15, 0, 0.02],
      [0.28, 0, -0.02],
      [0.05, 0, 0.0],
      [-0.36, 0, 0.04]
    ]));
    tracks.push(createQuatTrack('LeftForeArm', times, [
      [-0.30, 0, 0],
      [-0.15, 0, 0],
      [-0.20, 0, 0],
      [-0.35, 0, 0],
      [-0.30, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightArm', times, [
      [0.28, 0, -0.02],
      [0.05, 0, 0.0],
      [-0.36, 0, 0.04],
      [-0.15, 0, 0.02],
      [0.28, 0, -0.02]
    ]));
    tracks.push(createQuatTrack('RightForeArm', times, [
      [-0.20, 0, 0],
      [-0.35, 0, 0],
      [-0.30, 0, 0],
      [-0.15, 0, 0],
      [-0.20, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Walk', 1.2, tracks));
  }

  // --------------------------------------------------------------------------
  // 3. RUN CYCLE (0.75s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.1875, 0.375, 0.5625, 0.75];
    const tracks = [];

    // Forward lean and high athletic bounce
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, -0.04 * H, 0.02 * D],
      [0.015 * W, 0.04 * H, 0.03 * D],
      [0, -0.04 * H, 0.02 * D],
      [-0.015 * W, 0.04 * H, 0.03 * D],
      [0, -0.04 * H, 0.02 * D]
    ]));

    tracks.push(createQuatTrack('Spine', times, [
      [0.18, 0, 0],
      [0.16, -0.06, 0.02],
      [0.18, 0, 0],
      [0.16, 0.06, -0.02],
      [0.18, 0, 0]
    ]));
    tracks.push(createQuatTrack('Chest', times, [
      [0.08, -0.08, 0.02],
      [0.06, 0, 0],
      [0.08, 0.08, -0.02],
      [0.06, 0, 0],
      [0.08, -0.08, 0.02]
    ]));

    // High knee flexion stride
    tracks.push(createQuatTrack('LeftUpLeg', times, [
      [0.85, 0, 0.04],
      [0.35, 0, 0],
      [-0.60, 0, -0.03],
      [-0.15, 0, 0],
      [0.85, 0, 0.04]
    ]));
    tracks.push(createQuatTrack('LeftLeg', times, [
      [-0.15, 0, 0],
      [-0.30, 0, 0],
      [-0.10, 0, 0],
      [-1.25, 0, 0],
      [-0.15, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightUpLeg', times, [
      [-0.60, 0, -0.03],
      [-0.15, 0, 0],
      [0.85, 0, 0.04],
      [0.35, 0, 0],
      [-0.60, 0, -0.03]
    ]));
    tracks.push(createQuatTrack('RightLeg', times, [
      [-0.10, 0, 0],
      [-1.25, 0, 0],
      [-0.15, 0, 0],
      [-0.30, 0, 0],
      [-0.10, 0, 0]
    ]));

    // Sharp bent-elbow arm drive
    tracks.push(createQuatTrack('LeftArm', times, [
      [-0.75, 0, 0.05],
      [-0.30, 0, 0],
      [0.65, 0, -0.05],
      [0.10, 0, 0],
      [-0.75, 0, 0.05]
    ]));
    tracks.push(createQuatTrack('LeftForeArm', times, [
      [-1.45, 0, 0],
      [-1.30, 0, 0],
      [-1.35, 0, 0],
      [-1.50, 0, 0],
      [-1.45, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightArm', times, [
      [0.65, 0, -0.05],
      [0.10, 0, 0],
      [-0.75, 0, 0.05],
      [-0.30, 0, 0],
      [0.65, 0, -0.05]
    ]));
    tracks.push(createQuatTrack('RightForeArm', times, [
      [-1.35, 0, 0],
      [-1.50, 0, 0],
      [-1.45, 0, 0],
      [-1.30, 0, 0],
      [-1.35, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Run', 0.75, tracks));
  }

  // --------------------------------------------------------------------------
  // 4. HIP-HOP DANCE (2.4s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.6, 1.2, 1.8, 2.4];
    const tracks = [];

    // Hip rhythmic bounce and groovy sway
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, -0.04 * H, 0],
      [0.035 * W, 0.02 * H, 0],
      [0, -0.04 * H, 0],
      [-0.035 * W, 0.02 * H, 0],
      [0, -0.04 * H, 0]
    ]));

    tracks.push(createQuatTrack('Hips', times, [
      [0.08, 0, 0],
      [0.02, 0.15, 0.12],
      [0.08, 0, 0],
      [0.02, -0.15, -0.12],
      [0.08, 0, 0]
    ]));

    // Spine & Chest body wave
    tracks.push(createQuatTrack('Spine', times, [
      [-0.10, 0, 0],
      [0.08, -0.08, -0.08],
      [-0.10, 0, 0],
      [0.08, 0.08, 0.08],
      [-0.10, 0, 0]
    ]));
    tracks.push(createQuatTrack('Chest', times, [
      [0.12, 0, 0],
      [-0.08, 0.12, 0.08],
      [0.12, 0, 0],
      [-0.08, -0.12, -0.08],
      [0.12, 0, 0]
    ]));

    // Head nods
    tracks.push(createQuatTrack('Head', times, [
      [0.22, 0, 0],
      [-0.05, 0.10, 0.05],
      [0.22, 0, 0],
      [-0.05, -0.10, -0.05],
      [0.22, 0, 0]
    ]));

    // Arms: rhythmic wave gestures
    tracks.push(createQuatTrack('LeftArm', times, [
      [-0.45, 0, 0.65],
      [-0.20, 0.35, 0.25],
      [-0.60, -0.20, 0.85],
      [-0.15, 0.10, 0.30],
      [-0.45, 0, 0.65]
    ]));
    tracks.push(createQuatTrack('LeftForeArm', times, [
      [-0.95, 0, 0],
      [-0.45, 0, 0],
      [-1.15, 0, 0],
      [-0.35, 0, 0],
      [-0.95, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightArm', times, [
      [-0.60, -0.20, -0.85],
      [-0.15, 0.10, -0.30],
      [-0.45, 0, -0.65],
      [-0.20, 0.35, -0.25],
      [-0.60, -0.20, -0.85]
    ]));
    tracks.push(createQuatTrack('RightForeArm', times, [
      [-1.15, 0, 0],
      [-0.35, 0, 0],
      [-0.95, 0, 0],
      [-0.45, 0, 0],
      [-1.15, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Dance', 2.4, tracks));
  }

  // --------------------------------------------------------------------------
  // 5. FRIENDLY WAVE (2.0s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.35, 0.7, 1.05, 1.4, 1.7, 2.0];
    const tracks = [];

    // Right arm elevates and waves side to side
    tracks.push(createQuatTrack('RightShoulder', times, [
      [0, 0, 0],
      [0.05, 0, -0.15],
      [0.05, 0, -0.15],
      [0.05, 0, -0.15],
      [0.05, 0, -0.15],
      [0.05, 0, -0.15],
      [0, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightArm', times, [
      [0, 0, 0],
      [-0.45, 0.25, -1.35],
      [-0.45, 0.25, -1.35],
      [-0.45, 0.25, -1.35],
      [-0.45, 0.25, -1.35],
      [-0.45, 0.25, -1.35],
      [0, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightForeArm', times, [
      [-0.10, 0, 0],
      [-1.15, 0, -0.35],
      [-1.15, 0, 0.35],
      [-1.15, 0, -0.35],
      [-1.15, 0, 0.35],
      [-1.15, 0, -0.10],
      [-0.10, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightHand', times, [
      [0, 0, 0],
      [0, 0, -0.30],
      [0, 0, 0.30],
      [0, 0, -0.30],
      [0, 0, 0.30],
      [0, 0, 0],
      [0, 0, 0]
    ]));

    // Head tilt towards wave
    tracks.push(createQuatTrack('Head', times, [
      [0, 0, 0],
      [-0.05, -0.08, -0.06],
      [-0.05, -0.08, -0.06],
      [-0.05, -0.08, -0.06],
      [-0.05, -0.08, -0.06],
      [-0.02, -0.04, -0.02],
      [0, 0, 0]
    ]));

    // Spine subtle shift
    tracks.push(createQuatTrack('Spine', times, [
      [0, 0, 0],
      [0.02, 0, -0.04],
      [0.02, 0, -0.04],
      [0.02, 0, -0.04],
      [0.02, 0, -0.04],
      [0.01, 0, -0.01],
      [0, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Wave', 2.0, tracks));
  }

  // --------------------------------------------------------------------------
  // 6. JUMP (1.6s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.35, 0.75, 1.15, 1.45, 1.6];
    const tracks = [];

    // Vertical trajectory: Crouch -> Jump Launch -> Apex -> Landing Impact -> Stand
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, 0, 0],
      [0, -0.08 * H, 0],
      [0, 0.16 * H, 0],
      [0, 0.08 * H, 0],
      [0, -0.06 * H, 0],
      [0, 0, 0]
    ]));

    // Crouch knees, extend in air, cushion on ground
    tracks.push(createQuatTrack('LeftUpLeg', times, [
      [0, 0, 0],
      [0.65, 0, 0.05],
      [-0.10, 0, 0],
      [0.25, 0, 0],
      [0.55, 0, 0.05],
      [0, 0, 0]
    ]));
    tracks.push(createQuatTrack('LeftLeg', times, [
      [0, 0, 0],
      [-0.95, 0, 0],
      [0, 0, 0],
      [-0.35, 0, 0],
      [-0.85, 0, 0],
      [0, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightUpLeg', times, [
      [0, 0, 0],
      [0.65, 0, -0.05],
      [-0.10, 0, 0],
      [0.25, 0, 0],
      [0.55, 0, -0.05],
      [0, 0, 0]
    ]));
    tracks.push(createQuatTrack('RightLeg', times, [
      [0, 0, 0],
      [-0.95, 0, 0],
      [0, 0, 0],
      [-0.35, 0, 0],
      [-0.85, 0, 0],
      [0, 0, 0]
    ]));

    // Arms: swing back during crouch, reach high in air
    tracks.push(createQuatTrack('LeftArm', times, [
      [0, 0, 0],
      [0.45, 0, 0.10],
      [-1.35, 0, 0.45],
      [-0.85, 0, 0.25],
      [0.20, 0, 0.10],
      [0, 0, 0]
    ]));
    tracks.push(createQuatTrack('RightArm', times, [
      [0, 0, 0],
      [0.45, 0, -0.10],
      [-1.35, 0, -0.45],
      [-0.85, 0, -0.25],
      [0.20, 0, -0.10],
      [0, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Jump', 1.6, tracks));
  }

  // --------------------------------------------------------------------------
  // 7. VICTORY CHEER (1.8s Looped)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 0.45, 0.9, 1.35, 1.8];
    const tracks = [];

    // Victory bounce
    tracks.push(createPosTrack('Hips', times, hipsBasePos, [
      [0, 0, 0],
      [0, 0.03 * H, 0],
      [0, -0.01 * H, 0],
      [0, 0.03 * H, 0],
      [0, 0, 0]
    ]));

    // Spine & Chest proud arch
    tracks.push(createQuatTrack('Spine', times, [
      [-0.08, 0, 0],
      [-0.14, 0, 0],
      [-0.08, 0, 0],
      [-0.14, 0, 0],
      [-0.08, 0, 0]
    ]));
    tracks.push(createQuatTrack('Chest', times, [
      [-0.10, 0, 0],
      [-0.18, 0, 0],
      [-0.10, 0, 0],
      [-0.18, 0, 0],
      [-0.10, 0, 0]
    ]));

    // Both arms raised high in triumphant V-pose
    tracks.push(createQuatTrack('LeftArm', times, [
      [-0.60, 0, 1.35],
      [-0.75, 0, 1.45],
      [-0.60, 0, 1.35],
      [-0.75, 0, 1.45],
      [-0.60, 0, 1.35]
    ]));
    tracks.push(createQuatTrack('LeftForeArm', times, [
      [-0.85, 0, 0],
      [-1.15, 0, 0],
      [-0.85, 0, 0],
      [-1.15, 0, 0],
      [-0.85, 0, 0]
    ]));

    tracks.push(createQuatTrack('RightArm', times, [
      [-0.60, 0, -1.35],
      [-0.75, 0, -1.45],
      [-0.60, 0, -1.35],
      [-0.75, 0, -1.45],
      [-0.60, 0, -1.35]
    ]));
    tracks.push(createQuatTrack('RightForeArm', times, [
      [-0.85, 0, 0],
      [-1.15, 0, 0],
      [-0.85, 0, 0],
      [-1.15, 0, 0],
      [-0.85, 0, 0]
    ]));

    // Head looks up proud
    tracks.push(createQuatTrack('Head', times, [
      [-0.18, 0, 0],
      [-0.26, 0, 0],
      [-0.18, 0, 0],
      [-0.26, 0, 0],
      [-0.18, 0, 0]
    ]));

    clips.push(new THREE.AnimationClip('Victory', 1.8, tracks));
  }

  // --------------------------------------------------------------------------
  // 8. T-POSE (1.0s Static Reference)
  // --------------------------------------------------------------------------
  {
    const times = [0.0, 1.0];
    const tracks = [];
    tracks.push(createQuatTrack('Root', times, [[0, 0, 0], [0, 0, 0]]));
    tracks.push(createQuatTrack('Hips', times, [[0, 0, 0], [0, 0, 0]]));
    tracks.push(createQuatTrack('LeftArm', times, [[0, 0, 0], [0, 0, 0]]));
    tracks.push(createQuatTrack('RightArm', times, [[0, 0, 0], [0, 0, 0]]));
    clips.push(new THREE.AnimationClip('T-Pose', 1.0, tracks));
  }

  return clips;
}

/**
 * High-level function: Automatically attaches a standard 19-bone biped armature,
 * skins the mesh geometry, and attaches our 8 character animations.
 */
export function rigHumanoidObject(object3D) {
  if (!object3D) throw new Error('No 3D object provided for rigging.');

  // 1. Analyze geometry bounds and proportions
  const analysis = analyzeHumanoidGeometry(object3D);

  // 2. Build bone hierarchy and Skeleton
  const { root, bones, boneMap, skeleton } = buildHumanoidSkeleton(analysis);

  // 3. Find and skin all meshes in the object hierarchy
  const skinnedMeshes = [];
  const meshesToReplace = [];

  object3D.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshesToReplace.push(child);
    }
  });

  if (meshesToReplace.length === 0) {
    throw new Error('Selected 3D object does not contain any mesh geometry to rig.');
  }

  // If object is a single mesh, we wrap it into a clean Character Group
  let characterGroup = object3D.isGroup ? object3D : new THREE.Group();
  if (!object3D.isGroup) {
    characterGroup.name = `${object3D.name || 'Character'}_Rigged`;
    characterGroup.position.copy(object3D.position);
    characterGroup.quaternion.copy(object3D.quaternion);
    characterGroup.scale.copy(object3D.scale);
    characterGroup.userData = { ...object3D.userData };
  }

  // Add root bone to the character group
  characterGroup.add(root);

  meshesToReplace.forEach((mesh) => {
    const skinnedMesh = skinMeshToHumanoid(mesh, skeleton, bones, analysis);
    skinnedMeshes.push(skinnedMesh);

    if (object3D.isGroup && mesh.parent) {
      mesh.parent.add(skinnedMesh);
      mesh.parent.remove(mesh);
    } else {
      skinnedMesh.position.set(0, 0, 0);
      skinnedMesh.quaternion.set(0, 0, 0, 1);
      skinnedMesh.scale.set(1, 1, 1);
      characterGroup.add(skinnedMesh);
    }
  });

  // Calculate world matrices across entire hierarchy before computing inverses and binding
  characterGroup.updateWorldMatrix(true, true);
  skeleton.calculateInverses();
  skinnedMeshes.forEach((sm) => {
    sm.bind(skeleton);
  });

  // 4. Generate the 8 animation clips
  const clips = generateHumanoidAnimationClips(boneMap, analysis);

  // 5. Create visual Skeleton Helper with styled joint bones
  const skeletonHelper = new THREE.SkeletonHelper(characterGroup);
  skeletonHelper.name = `${characterGroup.name}_ArmatureHelper`;
  if (skeletonHelper.material) {
    skeletonHelper.material.linewidth = 2;
    skeletonHelper.material.depthTest = false;
    skeletonHelper.material.transparent = true;
    skeletonHelper.material.opacity = 0.85;
    skeletonHelper.material.color.set(0x818cf8); // Neon Indigo
  }
  skeletonHelper.renderOrder = 999;
  skeletonHelper.visible = false; // Hidden by default, toggleable in UI

  // 6. Attach metadata for studio management
  characterGroup.userData = {
    ...characterGroup.userData,
    isGenerated: true,
    isHumanoidRigged: true,
    boneCount: bones.length,
    bones,
    boneMap,
    skeleton,
    skinnedMeshes,
    animations: clips,
    skeletonHelper,
    armatureAnalysis: analysis
  };

  return {
    characterGroup,
    skeleton,
    bones,
    boneMap,
    skinnedMeshes,
    clips,
    skeletonHelper
  };
}
