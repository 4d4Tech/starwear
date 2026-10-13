import * as THREE from 'three';

// =========================================================================
// PROCEDURAL TEXTURE GENERATORS
// =========================================================================

export function generateProceduralNebulaTexture(THREE_LIB = THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#030514');
  bgGrad.addColorStop(0.5, '#070b1e');
  bgGrad.addColorStop(1, '#02030a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawCloud = (cx, cy, r, c1, c2) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, c1);
    g.addColorStop(0.5, c2);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCloud(280, 200, 240, 'rgba(168, 85, 247, 0.45)', 'rgba(59, 130, 246, 0.15)');
  drawCloud(720, 310, 260, 'rgba(6, 182, 212, 0.4)', 'rgba(99, 102, 241, 0.15)');
  drawCloud(460, 280, 190, 'rgba(236, 72, 153, 0.35)', 'rgba(147, 51, 234, 0.1)');
  drawCloud(860, 180, 210, 'rgba(56, 189, 248, 0.35)', 'rgba(30, 58, 138, 0.1)');

  for (let i = 0; i < 450; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 1.5 + 0.3;
    const alpha = Math.random() * 0.85 + 0.15;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE_LIB.CanvasTexture(canvas);
  tex.wrapS = THREE_LIB.RepeatWrapping;
  tex.wrapT = THREE_LIB.ClampToEdgeWrapping;
  return tex;
}

export function generateProceduralGridTexture(gridColor = '#38bdf8', bgColor = '#020617', THREE_LIB = THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 256, 256);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(128, 0); ctx.lineTo(128, 256);
  ctx.moveTo(0, 128); ctx.lineTo(256, 128);
  ctx.stroke();

  const tex = new THREE_LIB.CanvasTexture(canvas);
  tex.wrapS = THREE_LIB.RepeatWrapping;
  tex.wrapT = THREE_LIB.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export function generateHolographicTextTexture(text = 'STAR weAR', color = '#38bdf8', THREE_LIB = THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 512, 128);

  ctx.fillStyle = 'rgba(8, 14, 29, 0.8)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(16, 16, 480, 96, 24);
  } else {
    ctx.rect(16, 16, 480, 96);
  }
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE_LIB.CanvasTexture(canvas);
  return tex;
}

export function generateParticleSprite(shape = 'sparkle', THREE_LIB = THREE) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 64, 64);

  if (shape === 'circle') {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'diamond') {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(Math.PI / 4);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-18, -18, 36, 36);
    ctx.restore();
  } else if (shape === 'heart') {
    ctx.save();
    ctx.translate(32, 34);
    ctx.beginPath();
    const d = 1.3;
    ctx.moveTo(0, 5 * d);
    ctx.bezierCurveTo(0, 0, -16 * d, -8 * d, -16 * d, -18 * d);
    ctx.bezierCurveTo(-16 * d, -26 * d, -6 * d, -28 * d, 0, -20 * d);
    ctx.bezierCurveTo(6 * d, -28 * d, 16 * d, -26 * d, 16 * d, -18 * d);
    ctx.bezierCurveTo(16 * d, -8 * d, 0, 0, 0, 5 * d);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  } else {
    // 'sparkle' | 'star'
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(32, 2);
    ctx.quadraticCurveTo(32, 32, 62, 32);
    ctx.quadraticCurveTo(32, 32, 32, 62);
    ctx.quadraticCurveTo(32, 32, 2, 32);
    ctx.quadraticCurveTo(32, 32, 32, 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(32, 32, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
  }

  const texture = new THREE_LIB.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// =========================================================================
// 3D PORTAL OBJECT BUILDER
// =========================================================================

export function createPortalObject3D(portalConfig, THREE_LIB = THREE, currentModelGroup = null) {
  if (!portalConfig) return null;

  const data = {
    shape: portalConfig.shape || 'arch',
    width: Number(portalConfig.width ?? 1.1),
    height: Number(portalConfig.height ?? 1.8),
    radius: Number(portalConfig.radius ?? 0.7),
    depth: Number(portalConfig.depth ?? 3.5),
    frameColor: portalConfig.frameColor || '#38bdf8',
    frameWidth: Number(portalConfig.frameWidth ?? 0.08),
    frameDepth: Number(portalConfig.frameDepth ?? 0.08),
    frameEmissive: portalConfig.frameEmissive || '#0284c7',
    frameEmissiveIntensity: Number(portalConfig.frameEmissiveIntensity ?? 1.5),
    frameGlow: portalConfig.frameGlow !== false,
    glassTint: portalConfig.glassTint || '#38bdf8',
    glassOpacity: Number(portalConfig.glassOpacity ?? 0.05),
    interiorType: portalConfig.interiorType || 'nebula',
    skyboxUrl: portalConfig.skyboxUrl || '',
    interiorColor: portalConfig.interiorColor || '#050714',
    wallColor: portalConfig.wallColor || '#0f172a',
    floorColor: portalConfig.floorColor || '#020617',
    gridColor: portalConfig.gridColor || '#38bdf8',
    interiorLightColor: portalConfig.interiorLightColor || '#e0f2fe',
    interiorLightIntensity: Number(portalConfig.interiorLightIntensity ?? 2.0),
    interiorModelType: portalConfig.interiorModelType || 'artifact',
    artifactType: portalConfig.artifactType || 'crystal',
    modelScale: Number(portalConfig.modelScale ?? 0.4),
    modelPosX: Number(portalConfig.modelPosX ?? 0.0),
    modelPosY: Number(portalConfig.modelPosY ?? 0.0),
    modelPosZ: Number(portalConfig.modelPosZ ?? -1.3),
    modelRotSpeed: Number(portalConfig.modelRotSpeed ?? 6000),
    modelRotX: Number(portalConfig.modelRotX ?? 0),
    modelRotY: Number(portalConfig.modelRotY ?? 0),
    modelRotZ: Number(portalConfig.modelRotZ ?? 0),
    particles: portalConfig.particles || 'stars',
    particleCount: Number(portalConfig.particleCount ?? 180),
    particleColor: portalConfig.particleColor || '#38bdf8',
    particleSpeed: Number(portalConfig.particleSpeed ?? 1.0),
    floatingText: portalConfig.floatingText || 'STAR weAR',
    textColor: portalConfig.textColor || '#38bdf8',
    textScale: Number(portalConfig.textScale ?? 1.0),
    textPosY: Number(portalConfig.textPosY ?? 0.65),
    textPosZ: Number(portalConfig.textPosZ ?? -1.2),
    posX: Number(portalConfig.posX ?? 0.0),
    posY: Number(portalConfig.posY ?? 0.0),
    posZ: Number(portalConfig.posZ ?? 0.0),
    rotX: Number(portalConfig.rotX ?? 0),
    rotY: Number(portalConfig.rotY ?? 0),
    rotZ: Number(portalConfig.rotZ ?? 0)
  };

  const rootGroup = new THREE_LIB.Group();
  rootGroup.name = 'portal_3d_root';
  const portalFrameGroup = new THREE_LIB.Group();
  const interiorGroup = new THREE_LIB.Group();

  rootGroup.add(portalFrameGroup);
  rootGroup.add(interiorGroup);

  rootGroup.position.set(data.posX, data.posY, data.posZ);
  rootGroup.rotation.set(
    (data.rotX * Math.PI) / 180,
    (data.rotY * Math.PI) / 180,
    (data.rotZ * Math.PI) / 180
  );

  const width = Math.max(0.2, data.width);
  const height = Math.max(0.2, data.height);
  const radius = Math.max(0.15, data.radius);
  const frameW = Math.max(0.02, data.frameWidth);
  const frameD = Math.max(0.02, data.frameDepth);

  // 1. APERTURE & FRAME GEOMETRY
  let apertureGeom = null;
  let frameGeom = null;

  if (data.shape === 'arch') {
    const r = width / 2;
    const straightH = Math.max(0.1, height - r);
    const yBottom = -height / 2;
    const yArchCenter = yBottom + straightH;

    const archShape = new THREE_LIB.Shape();
    archShape.moveTo(-r, yBottom);
    archShape.lineTo(r, yBottom);
    archShape.lineTo(r, yArchCenter);
    archShape.absarc(0, yArchCenter, r, 0, Math.PI, false);
    archShape.lineTo(-r, yBottom);
    apertureGeom = new THREE_LIB.ShapeGeometry(archShape, 32);

    const outerR = r + frameW;
    const outerShape = new THREE_LIB.Shape();
    outerShape.moveTo(-outerR, yBottom - frameW);
    outerShape.lineTo(outerR, yBottom - frameW);
    outerShape.lineTo(outerR, yArchCenter);
    outerShape.absarc(0, yArchCenter, outerR, 0, Math.PI, false);
    outerShape.lineTo(-outerR, yBottom - frameW);

    const innerHole = new THREE_LIB.Path();
    innerHole.moveTo(-r, yBottom);
    innerHole.lineTo(r, yBottom);
    innerHole.lineTo(r, yArchCenter);
    innerHole.absarc(0, yArchCenter, r, 0, Math.PI, false);
    innerHole.lineTo(-r, yBottom);
    outerShape.holes.push(innerHole);

    frameGeom = new THREE_LIB.ExtrudeGeometry(outerShape, {
      depth: frameD,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      curveSegments: 32
    });
    frameGeom.translate(0, 0, -frameD / 2);
  } else if (data.shape === 'rectangle') {
    apertureGeom = new THREE_LIB.PlaneGeometry(width, height);

    const hw = width / 2 + frameW;
    const hh = height / 2 + frameW;
    const outerRect = new THREE_LIB.Shape();
    outerRect.moveTo(-hw, -hh);
    outerRect.lineTo(hw, -hh);
    outerRect.lineTo(hw, hh);
    outerRect.lineTo(-hw, hh);
    outerRect.closePath();

    const innerRect = new THREE_LIB.Path();
    const ihw = width / 2;
    const ihh = height / 2;
    innerRect.moveTo(-ihw, -ihh);
    innerRect.lineTo(ihw, -ihh);
    innerRect.lineTo(ihw, ihh);
    innerRect.lineTo(-ihw, ihh);
    innerRect.closePath();
    outerRect.holes.push(innerRect);

    frameGeom = new THREE_LIB.ExtrudeGeometry(outerRect, {
      depth: frameD,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012
    });
    frameGeom.translate(0, 0, -frameD / 2);
  } else if (data.shape === 'circle') {
    apertureGeom = new THREE_LIB.CircleGeometry(radius, 48);
    frameGeom = new THREE_LIB.TorusGeometry(radius, frameW / 2, 16, 48);
  } else if (data.shape === 'hexagon') {
    const r = radius;
    apertureGeom = new THREE_LIB.CircleGeometry(r, 6);

    const outerHex = new THREE_LIB.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = (r + frameW) * Math.cos(angle);
      const y = (r + frameW) * Math.sin(angle);
      if (i === 0) outerHex.moveTo(x, y);
      else outerHex.lineTo(x, y);
    }
    outerHex.closePath();

    const innerHex = new THREE_LIB.Path();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      if (i === 0) innerHex.moveTo(x, y);
      else innerHex.lineTo(x, y);
    }
    innerHex.closePath();
    outerHex.holes.push(innerHex);

    frameGeom = new THREE_LIB.ExtrudeGeometry(outerHex, {
      depth: frameD,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012
    });
    frameGeom.translate(0, 0, -frameD / 2);
  }

  // 2. APERTURE MASK MESH (STENCIL WRITE AT RENDERORDER 1)
  if (apertureGeom) {
    const maskMat = new THREE_LIB.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE_LIB.AlwaysStencilFunc,
      stencilZPass: THREE_LIB.ReplaceStencilOp,
      side: THREE_LIB.DoubleSide
    });
    const maskMesh = new THREE_LIB.Mesh(apertureGeom, maskMat);
    maskMesh.renderOrder = 1;
    portalFrameGroup.add(maskMesh);

    if (data.glassOpacity > 0.001) {
      const glassMat = new THREE_LIB.MeshBasicMaterial({
        color: new THREE_LIB.Color(data.glassTint),
        transparent: true,
        opacity: data.glassOpacity,
        side: THREE_LIB.DoubleSide,
        blending: THREE_LIB.AdditiveBlending,
        depthWrite: false
      });
      const glassMesh = new THREE_LIB.Mesh(apertureGeom.clone(), glassMat);
      glassMesh.renderOrder = 12;
      portalFrameGroup.add(glassMesh);
    }
  }

  // 3. FRAME MESH WITH METALLIC PBR & GLOW (RENDERORDER 15)
  if (frameGeom) {
    const frameMat = new THREE_LIB.MeshStandardMaterial({
      color: new THREE_LIB.Color(data.frameColor),
      metalness: 0.85,
      roughness: 0.22,
      emissive: new THREE_LIB.Color(data.frameEmissive),
      emissiveIntensity: data.frameEmissiveIntensity,
      side: THREE_LIB.DoubleSide
    });
    const frameMesh = new THREE_LIB.Mesh(frameGeom, frameMat);
    frameMesh.renderOrder = 15;
    portalFrameGroup.add(frameMesh);

    if (data.frameGlow) {
      const glowMat = new THREE_LIB.MeshBasicMaterial({
        color: new THREE_LIB.Color(data.frameEmissive),
        transparent: true,
        opacity: 0.25,
        blending: THREE_LIB.AdditiveBlending,
        wireframe: true,
        depthWrite: false,
        side: THREE_LIB.DoubleSide
      });
      const glowMesh = new THREE_LIB.Mesh(frameGeom.clone(), glowMat);
      glowMesh.scale.multiplyScalar(1.02);
      glowMesh.renderOrder = 16;
      portalFrameGroup.add(glowMesh);
    }
  }

  // Helper to apply stencil pass mode to interior meshes
  const applyStencil = (mesh, stencilFunc = THREE_LIB.EqualStencilFunc) => {
    if (!mesh) return;
    mesh.renderOrder = 3;
    mesh.traverse((node) => {
      if ((node.isMesh || node.isPoints || node.isLine) && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          m.stencilWrite = true;
          m.stencilRef = 1;
          m.stencilFunc = stencilFunc;
          m.stencilZPass = THREE_LIB.KeepStencilOp;
          m.stencilFail = THREE_LIB.KeepStencilOp;
          m.stencilZFail = THREE_LIB.KeepStencilOp;
        });
      }
    });
  };

  // 4. INTERIOR CHAMBER
  const depth = Math.max(1.0, data.depth);
  const chamberWidth = Math.max(width * 2.2, 3.0);
  const chamberHeight = Math.max(height * 2.2, 3.0);

  if (data.interiorType === 'grid-room' || data.interiorType === 'matrix') {
    const boxGeom = new THREE_LIB.BoxGeometry(chamberWidth, chamberHeight, depth);
    const gColor = data.interiorType === 'matrix' ? '#10b981' : data.gridColor;
    const wColor = data.interiorType === 'matrix' ? '#021810' : data.wallColor;
    const gridTexture = generateProceduralGridTexture(gColor, data.floorColor, THREE_LIB);

    const wallMat = new THREE_LIB.MeshStandardMaterial({
      color: new THREE_LIB.Color(wColor),
      roughness: 0.8,
      metalness: 0.2,
      side: THREE_LIB.DoubleSide
    });
    const floorMat = new THREE_LIB.MeshStandardMaterial({
      color: new THREE_LIB.Color(data.floorColor),
      map: gridTexture,
      roughness: 0.3,
      metalness: 0.6,
      side: THREE_LIB.DoubleSide
    });

    const boxMaterials = [
      wallMat, wallMat, wallMat, floorMat, wallMat, wallMat
    ];
    const roomMesh = new THREE_LIB.Mesh(boxGeom, boxMaterials);
    roomMesh.position.set(0, 0, -depth / 2);
    applyStencil(roomMesh);
    interiorGroup.add(roomMesh);
  } else {
    // 'nebula' | 'starfield' | 'void'
    const sphereGeom = new THREE_LIB.SphereGeometry(14, 32, 32);
    let envTexture = null;
    if (data.skyboxUrl) {
      const loader = new THREE_LIB.TextureLoader();
      envTexture = loader.load(data.skyboxUrl);
      if (THREE_LIB.SRGBColorSpace) envTexture.colorSpace = THREE_LIB.SRGBColorSpace;
    } else if (data.interiorType !== 'void') {
      envTexture = generateProceduralNebulaTexture(THREE_LIB);
    }

    const sphereMat = new THREE_LIB.MeshBasicMaterial({
      map: envTexture,
      color: new THREE_LIB.Color(data.interiorColor),
      side: THREE_LIB.DoubleSide
    });
    const sphereMesh = new THREE_LIB.Mesh(sphereGeom, sphereMat);
    sphereMesh.position.set(0, 0, -depth / 2);
    applyStencil(sphereMesh);
    interiorGroup.add(sphereMesh);
  }

  // Interior PointLight
  const pointLight = new THREE_LIB.PointLight(
    new THREE_LIB.Color(data.interiorLightColor),
    data.interiorLightIntensity,
    depth * 2
  );
  pointLight.position.set(0, 0.4, -depth * 0.4);
  interiorGroup.add(pointLight);

  // 5. INTERIOR ARTIFACT / MODEL
  let activeArtifact = null;
  const cyberCoreRings = [];

  if (data.interiorModelType === 'current-product' && currentModelGroup) {
    const clone = currentModelGroup.clone(true);
    clone.position.set(data.modelPosX, data.modelPosY, data.modelPosZ);
    clone.scale.setScalar(data.modelScale);
    clone.rotation.set(
      (data.modelRotX * Math.PI) / 180,
      (data.modelRotY * Math.PI) / 180,
      (data.modelRotZ * Math.PI) / 180
    );
    applyStencil(clone);
    interiorGroup.add(clone);
    activeArtifact = clone;
  } else if (data.interiorModelType === 'artifact') {
    const artifactGroup = new THREE_LIB.Group();
    artifactGroup.position.set(data.modelPosX, data.modelPosY, data.modelPosZ);
    artifactGroup.scale.setScalar(data.modelScale);
    artifactGroup.rotation.set(
      (data.modelRotX * Math.PI) / 180,
      (data.modelRotY * Math.PI) / 180,
      (data.modelRotZ * Math.PI) / 180
    );

    if (data.artifactType === 'crystal') {
      const crystalGeom = new THREE_LIB.IcosahedronGeometry(0.42, 0);
      const crystalMat = new THREE_LIB.MeshStandardMaterial({
        color: new THREE_LIB.Color(data.frameColor),
        metalness: 0.9,
        roughness: 0.12,
        emissive: new THREE_LIB.Color(data.frameEmissive),
        emissiveIntensity: 0.6,
        flatShading: true
      });
      const crystalMesh = new THREE_LIB.Mesh(crystalGeom, crystalMat);
      artifactGroup.add(crystalMesh);
      activeArtifact = artifactGroup;
    } else if (data.artifactType === 'cyber-core') {
      const coreGeom = new THREE_LIB.SphereGeometry(0.2, 24, 24);
      const coreMat = new THREE_LIB.MeshStandardMaterial({
        color: new THREE_LIB.Color(data.gridColor || data.frameColor),
        emissive: new THREE_LIB.Color(data.gridColor || data.frameColor),
        emissiveIntensity: 2.0,
        roughness: 0.2
      });
      const coreMesh = new THREE_LIB.Mesh(coreGeom, coreMat);
      artifactGroup.add(coreMesh);

      const ring1Geom = new THREE_LIB.TorusGeometry(0.36, 0.018, 12, 36);
      const ring2Geom = new THREE_LIB.TorusGeometry(0.46, 0.018, 12, 36);
      const ringMat = new THREE_LIB.MeshStandardMaterial({
        color: new THREE_LIB.Color(data.frameColor),
        emissive: new THREE_LIB.Color(data.frameEmissive),
        emissiveIntensity: 0.8,
        metalness: 0.9
      });
      const r1 = new THREE_LIB.Mesh(ring1Geom, ringMat);
      const r2 = new THREE_LIB.Mesh(ring2Geom, ringMat);
      artifactGroup.add(r1);
      artifactGroup.add(r2);
      cyberCoreRings.push(r1, r2);
      activeArtifact = artifactGroup;
    } else {
      // Octahedron relic on pedestal
      const relicGeom = new THREE_LIB.OctahedronGeometry(0.32, 0);
      const relicMat = new THREE_LIB.MeshStandardMaterial({
        color: new THREE_LIB.Color(data.frameColor),
        metalness: 0.9,
        roughness: 0.1,
        emissive: new THREE_LIB.Color(data.frameEmissive),
        emissiveIntensity: 0.8
      });
      const relic = new THREE_LIB.Mesh(relicGeom, relicMat);
      artifactGroup.add(relic);
      activeArtifact = artifactGroup;
    }

    applyStencil(artifactGroup);
    interiorGroup.add(artifactGroup);
  }

  // 6. INTERIOR PARTICLES
  let particlesObj = null;
  const particleVelocities = [];

  if (data.particles !== 'none') {
    const pCount = Math.max(20, Math.min(300, data.particleCount));
    const pGeom = new THREE_LIB.BufferGeometry();
    const posArr = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      posArr[i * 3 + 0] = (Math.random() - 0.5) * chamberWidth * 0.9;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * chamberHeight * 0.9;
      posArr[i * 3 + 2] = -Math.random() * depth;

      particleVelocities.push({
        vx: (Math.random() - 0.5) * 0.003 * data.particleSpeed,
        vy: (Math.random() - 0.5) * 0.003 * data.particleSpeed,
        vz: (Math.random() * 0.005 + 0.002) * data.particleSpeed
      });
    }

    pGeom.setAttribute('position', new THREE_LIB.BufferAttribute(posArr, 3));
    const spriteTex = generateParticleSprite('sparkle', THREE_LIB);
    const pMat = new THREE_LIB.PointsMaterial({
      size: 0.06,
      map: spriteTex,
      transparent: true,
      opacity: 0.85,
      color: new THREE_LIB.Color(data.particleColor),
      blending: THREE_LIB.AdditiveBlending,
      depthWrite: false
    });

    particlesObj = new THREE_LIB.Points(pGeom, pMat);
    particlesObj.frustumCulled = false;
    applyStencil(particlesObj);
    interiorGroup.add(particlesObj);
  }

  // 7. HOLOGRAPHIC FLOATING BANNER
  if (data.floatingText) {
    const textTex = generateHolographicTextTexture(data.floatingText, data.textColor, THREE_LIB);
    if (textTex) {
      const planeGeom = new THREE_LIB.PlaneGeometry(1.2 * data.textScale, 0.3 * data.textScale);
      const planeMat = new THREE_LIB.MeshBasicMaterial({
        map: textTex,
        transparent: true,
        opacity: 0.9,
        side: THREE_LIB.DoubleSide,
        depthWrite: false
      });
      const bannerMesh = new THREE_LIB.Mesh(planeGeom, planeMat);
      bannerMesh.position.set(0, data.textPosY, data.textPosZ);
      applyStencil(bannerMesh);
      interiorGroup.add(bannerMesh);
    }
  }

  // Walk-through tracking vectors
  const tempCamWorld = new THREE_LIB.Vector3();
  const tempCamLocal = new THREE_LIB.Vector3();
  let isCameraInside = false;

  const setStencilMode = (isInside) => {
    const func = isInside ? THREE_LIB.AlwaysStencilFunc : THREE_LIB.EqualStencilFunc;
    interiorGroup.traverse((node) => {
      if ((node.isMesh || node.isPoints || node.isLine) && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          m.stencilFunc = func;
          m.needsUpdate = true;
        });
      }
    });
  };

  return {
    group: rootGroup,
    portalFrameGroup,
    interiorGroup,
    update: (time, deltaMs, camera) => {
      const dt = (deltaMs || 16) / 1000;

      // 1. Artifact rotation & bobbing
      if (activeArtifact && data.modelRotSpeed > 0) {
        const radPerSec = (Math.PI * 2) / (data.modelRotSpeed / 1000);
        activeArtifact.rotation.y += radPerSec * dt;
        activeArtifact.position.y = data.modelPosY + Math.sin(time / 800) * 0.04;
      }

      // 2. Gyro ring rotation
      if (cyberCoreRings.length >= 2) {
        cyberCoreRings[0].rotation.x += dt * 1.8;
        cyberCoreRings[1].rotation.y += dt * 2.2;
      }

      // 3. Interior particle drift
      if (particlesObj && particlesObj.geometry) {
        const posAttr = particlesObj.geometry.attributes.position;
        const posArr = posAttr.array;
        for (let i = 0; i < particleVelocities.length; i++) {
          const v = particleVelocities[i];
          posArr[i * 3 + 0] += v.vx;
          posArr[i * 3 + 1] += v.vy;
          posArr[i * 3 + 2] += v.vz;

          if (posArr[i * 3 + 2] > -0.05) {
            posArr[i * 3 + 2] = -depth + 0.1;
          } else if (posArr[i * 3 + 2] < -depth) {
            posArr[i * 3 + 2] = -0.1;
          }
        }
        posAttr.needsUpdate = true;
      }

      // 4. Camera walk-through stencil transition
      if (camera) {
        try {
          rootGroup.updateMatrixWorld(true);
          camera.getWorldPosition(tempCamWorld);
          rootGroup.worldToLocal(tempCamLocal.copy(tempCamWorld));

          if (!Number.isNaN(tempCamLocal.z)) {
            const inside = tempCamLocal.z < -0.05 &&
              tempCamLocal.z > -depth - 1.5 &&
              Math.abs(tempCamLocal.x) < (width * 1.5 + 1.2) &&
              Math.abs(tempCamLocal.y) < (height * 1.5 + 1.2);

            if (inside !== isCameraInside) {
              isCameraInside = inside;
              setStencilMode(inside);
            }
          }
        } catch {}
      }
    },
    dispose: () => {
      rootGroup.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
  };
}

// =========================================================================
// 3D STANDALONE PARTICLE SYSTEM BUILDER
// =========================================================================

export function createParticleSystemObject3D(particleConfig, THREE_LIB = THREE) {
  if (!particleConfig) return null;

  const data = {
    count: Math.max(10, Math.min(2000, Number(particleConfig.count ?? 300))),
    size: Math.max(0.005, Number(particleConfig.size ?? 0.04)),
    color: particleConfig.color || particleConfig.colorA || '#38bdf8',
    colorSecondary: particleConfig.colorSecondary || particleConfig.colorB || '#c084fc',
    opacity: Number(particleConfig.opacity ?? 0.85),
    shape: particleConfig.shape || 'sparkle',
    blending: particleConfig.blending || 'additive',
    direction: particleConfig.direction || particleConfig.motionType || 'float',
    speed: Number(particleConfig.speed ?? 1.0),
    rotationSpeed: Number(particleConfig.rotationSpeed ?? 0.2),
    spreadX: Number(particleConfig.spreadX ?? 3.0),
    spreadY: Number(particleConfig.spreadY ?? 3.0),
    spreadZ: Number(particleConfig.spreadZ ?? 3.0),
    posX: Number(particleConfig.posX ?? 0),
    posY: Number(particleConfig.posY ?? 0),
    posZ: Number(particleConfig.posZ ?? 0),
    rotX: Number(particleConfig.rotX ?? 0),
    rotY: Number(particleConfig.rotY ?? 0),
    rotZ: Number(particleConfig.rotZ ?? 0),
    twinkle: particleConfig.twinkle !== false
  };

  const group = new THREE_LIB.Group();
  group.name = 'particle_system_3d_root';
  group.position.set(data.posX, data.posY, data.posZ);
  group.rotation.set(
    (data.rotX * Math.PI) / 180,
    (data.rotY * Math.PI) / 180,
    (data.rotZ * Math.PI) / 180
  );

  const count = data.count;
  const geom = new THREE_LIB.BufferGeometry();
  const posArr = new Float32Array(count * 3);
  const colArr = new Float32Array(count * 3);
  const velocities = [];

  const colA = new THREE_LIB.Color(data.color);
  const colB = new THREE_LIB.Color(data.colorSecondary);

  const halfX = data.spreadX / 2;
  const halfY = data.spreadY / 2;
  const halfZ = data.spreadZ / 2;

  for (let i = 0; i < count; i++) {
    posArr[i * 3 + 0] = (Math.random() - 0.5) * data.spreadX;
    posArr[i * 3 + 1] = (Math.random() - 0.5) * data.spreadY;
    posArr[i * 3 + 2] = (Math.random() - 0.5) * data.spreadZ;

    const t = Math.random();
    const c = colA.clone().lerp(colB, t);
    colArr[i * 3 + 0] = c.r;
    colArr[i * 3 + 1] = c.g;
    colArr[i * 3 + 2] = c.b;

    let vx = (Math.random() - 0.5) * 0.008 * data.speed;
    let vy = (Math.random() - 0.5) * 0.008 * data.speed;
    let vz = (Math.random() - 0.5) * 0.008 * data.speed;

    if (data.direction === 'up') vy = (Math.random() * 0.015 + 0.005) * data.speed;
    else if (data.direction === 'down') vy = -(Math.random() * 0.015 + 0.005) * data.speed;
    else if (data.direction === 'vortex') {
      vx = (Math.random() - 0.5) * 0.01 * data.speed;
      vy = (Math.random() * 0.006 + 0.002) * data.speed;
    }

    velocities.push({ vx, vy, vz, phase: Math.random() * Math.PI * 2 });
  }

  geom.setAttribute('position', new THREE_LIB.BufferAttribute(posArr, 3));
  geom.setAttribute('color', new THREE_LIB.BufferAttribute(colArr, 3));

  const spriteTex = generateParticleSprite(data.shape, THREE_LIB);
  const mat = new THREE_LIB.PointsMaterial({
    size: data.size,
    map: spriteTex,
    vertexColors: true,
    transparent: true,
    opacity: data.opacity,
    blending: data.blending === 'normal' ? THREE_LIB.NormalBlending : THREE_LIB.AdditiveBlending,
    depthWrite: false
  });

  const pointsMesh = new THREE_LIB.Points(geom, mat);
  group.add(pointsMesh);

  return {
    group,
    pointsMesh,
    update: (time, deltaMs) => {
      const posAttr = geom.attributes.position;
      const pos = posAttr.array;

      for (let i = 0; i < count; i++) {
        const v = velocities[i];
        if (data.direction === 'vortex') {
          const x = pos[i * 3 + 0];
          const z = pos[i * 3 + 2];
          const angle = 0.02 * data.rotationSpeed;
          pos[i * 3 + 0] = x * Math.cos(angle) - z * Math.sin(angle);
          pos[i * 3 + 2] = x * Math.sin(angle) + z * Math.cos(angle);
          pos[i * 3 + 1] += v.vy;
        } else {
          pos[i * 3 + 0] += v.vx;
          pos[i * 3 + 1] += v.vy;
          pos[i * 3 + 2] += v.vz;
        }

        // Boundary wrap
        if (pos[i * 3 + 0] > halfX) pos[i * 3 + 0] = -halfX;
        else if (pos[i * 3 + 0] < -halfX) pos[i * 3 + 0] = halfX;

        if (pos[i * 3 + 1] > halfY) pos[i * 3 + 1] = -halfY;
        else if (pos[i * 3 + 1] < -halfY) pos[i * 3 + 1] = halfY;

        if (pos[i * 3 + 2] > halfZ) pos[i * 3 + 2] = -halfZ;
        else if (pos[i * 3 + 2] < -halfZ) pos[i * 3 + 2] = halfZ;
      }
      posAttr.needsUpdate = true;

      if (data.rotationSpeed > 0) {
        group.rotation.y += 0.005 * data.rotationSpeed;
      }
    },
    dispose: () => {
      geom.dispose();
      mat.dispose();
      if (spriteTex) spriteTex.dispose();
    }
  };
}
