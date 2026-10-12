/**
 * instagramFrameRenderer.js
 * Studio4D4 3D Picture Frame Generator for Instagram Media
 *
 * Generates gallery-grade 3D picture frames with:
 * - Architectural shadowbox molding
 * - Museum-grade passe-partout matting
 * - PBR material finishes (Obsidian, Brushed Platinum, Champagne Gold, Studio Matte, Walnut)
 * - Canvas photo with CORS-resilient texture loading
 * - Gallery acrylic protective glass pane
 * - Engraved museum artist plaque with handle & post metrics
 */

import * as THREE from 'three';

// Frame Material Finishes
export const FRAME_FINISHES = {
  obsidian: {
    name: 'Obsidian Noir',
    color: 0x0a0a0d,
    roughness: 0.18,
    metalness: 0.85,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1
  },
  platinum: {
    name: 'Brushed Platinum',
    color: 0xd4d4d8,
    roughness: 0.28,
    metalness: 0.92,
    clearcoat: 0.2,
    clearcoatRoughness: 0.2
  },
  gold: {
    name: 'Champagne Gold',
    color: 0xd4af37,
    roughness: 0.24,
    metalness: 0.82,
    clearcoat: 0.3,
    clearcoatRoughness: 0.15
  },
  matte: {
    name: 'Studio Matte Black',
    color: 0x18181b,
    roughness: 0.8,
    metalness: 0.05,
    clearcoat: 0.0
  },
  walnut: {
    name: 'Heritage Walnut',
    color: 0x3d271d,
    roughness: 0.65,
    metalness: 0.02,
    clearcoat: 0.1
  }
};

/**
 * Robust texture loader for Instagram images with fallback canvas rendering
 */
export function loadInstagramTexture(post) {
  return new Promise((resolve) => {
    const imageUrl = post?.imageUrl;
    if (!imageUrl) {
      resolve(createFallbackCanvasTexture(post));
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        resolve(texture);
      },
      undefined,
      (err) => {
        console.warn('Instagram image texture loader fallback:', err);
        // Fallback to stylized canvas texture
        resolve(createFallbackCanvasTexture(post));
      }
    );
  });
}

/**
 * Generates an elegant canvas texture for editorial posts if direct CORS image fails
 */
function createFallbackCanvasTexture(post) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1280; // 4:5 Instagram ratio
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 1024, 1280);
  grad.addColorStop(0, '#111116');
  grad.addColorStop(0.5, '#1e1e24');
  grad.addColorStop(1, '#09090c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1280);

  // Subtle luxury grid texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, 1280);
    ctx.stroke();
  }
  for (let y = 0; y < 1280; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Instagram Gradient Bar
  const barGrad = ctx.createLinearGradient(120, 0, 904, 0);
  barGrad.addColorStop(0, '#833ab4');
  barGrad.addColorStop(0.5, '#fd1d1d');
  barGrad.addColorStop(1, '#fcb045');
  ctx.fillStyle = barGrad;
  ctx.fillRect(120, 180, 784, 8);

  // Instagram Logo Mark / Camera Glyphs
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(462, 240, 100, 100);
  ctx.beginPath();
  ctx.arc(512, 290, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(542, 260, 6, 0, Math.PI * 2);
  ctx.fill();

  // Handle & Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(post.username ? `@${post.username}` : '@starwear.studio', 512, 420);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px monospace';
  ctx.fillText('STAR weAR • SPATIAL COUTURE', 512, 470);

  // Caption text wrapped
  if (post.caption) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';

    const words = post.caption.split(' ');
    let line = '';
    let y = 620;
    const maxWidth = 760;

    for (let n = 0; n < words.length && y < 900; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 512, y);
        line = words[n] + ' ';
        y += 42;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, 512, y);
  }

  // Footer Stats
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`❤️ ${post.likes || '5.2k'} likes   💬 ${post.comments || '142'} comments`, 512, 1040);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`POST ID: ${post.id || 'IG_MEDIA'}`, 512, 1120);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates an engraved metallic museum plaque texture
 */
function createPlaqueTexture(post) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Brushed metal background
  const grad = ctx.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0, '#27272a');
  grad.addColorStop(0.5, '#3f3f46');
  grad.addColorStop(1, '#18181b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  // Border bevel
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 116);

  // Engraved Text
  ctx.fillStyle = '#f4f4f5';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(post.username ? `@${post.username}` : '@starwear.studio', 256, 48);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 18px monospace';
  ctx.fillText(`INSTAGRAM • ${post.timestamp || 'RECENT'} • ${post.likes || ''} LIKES`, 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a single 3D picture frame mesh group for an Instagram post
 * @param {Object} post - Instagram post object
 * @param {Object} options - Customization options
 * @param {string} [options.finish='obsidian'] - Frame material finish key
 * @param {number} [options.scale=1.0] - Overall scale
 * @param {number} index - Index in collection (0..total-1)
 * @param {number} total - Total posts being rendered
 */
export async function createInstagramFrameMesh(post, options = {}, index = 0, total = 1) {
  const finishKey = options.finish || 'obsidian';
  const finish = FRAME_FINISHES[finishKey] || FRAME_FINISHES.obsidian;

  // Frame Dimensions (meters)
  const outerW = 1.25;
  const outerH = 1.48;
  const outerD = 0.08;
  const moldingW = 0.12;

  const canvasW = 0.94;
  const canvasH = 1.18;

  const frameGroup = new THREE.Group();
  frameGroup.name = `Instagram_Post_${index + 1}_@${post.username || 'user'}`;

  // 1. Frame Material
  const frameMat = new THREE.MeshStandardMaterial({
    color: finish.color,
    roughness: finish.roughness,
    metalness: finish.metalness,
    side: THREE.DoubleSide
  });

  // 2. Backing Board
  const backGeom = new THREE.BoxGeometry(outerW, outerH, 0.02);
  const backMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  const backMesh = new THREE.Mesh(backGeom, backMat);
  backMesh.position.z = -outerD / 2 + 0.01;
  backMesh.receiveShadow = true;
  frameGroup.add(backMesh);

  // 3. Four Moldings (Shadowbox Picture Frame)
  // Top Molding
  const topMolding = new THREE.Mesh(
    new THREE.BoxGeometry(outerW + 0.02, moldingW, outerD),
    frameMat
  );
  topMolding.position.set(0, outerH / 2 - moldingW / 2, 0);
  topMolding.castShadow = true;
  frameGroup.add(topMolding);

  // Bottom Molding
  const bottomMolding = new THREE.Mesh(
    new THREE.BoxGeometry(outerW + 0.02, moldingW, outerD),
    frameMat
  );
  bottomMolding.position.set(0, -outerH / 2 + moldingW / 2, 0);
  bottomMolding.castShadow = true;
  frameGroup.add(bottomMolding);

  // Left Molding
  const leftMolding = new THREE.Mesh(
    new THREE.BoxGeometry(moldingW, outerH - moldingW * 2, outerD),
    frameMat
  );
  leftMolding.position.set(-outerW / 2 + moldingW / 2, 0, 0);
  leftMolding.castShadow = true;
  frameGroup.add(leftMolding);

  // Right Molding
  const rightMolding = new THREE.Mesh(
    new THREE.BoxGeometry(moldingW, outerH - moldingW * 2, outerD),
    frameMat
  );
  rightMolding.position.set(outerW / 2 - moldingW / 2, 0, 0);
  rightMolding.castShadow = true;
  frameGroup.add(rightMolding);

  // 4. Museum Matting (Passe-partout)
  const mattingW = outerW - moldingW * 2;
  const mattingH = outerH - moldingW * 2;
  const mattingGeom = new THREE.PlaneGeometry(mattingW, mattingH);
  const mattingMat = new THREE.MeshStandardMaterial({
    color: finishKey === 'obsidian' ? 0x121216 : 0xf8fafc,
    roughness: 0.95,
    metalness: 0.02
  });
  const mattingMesh = new THREE.Mesh(mattingGeom, mattingMat);
  mattingMesh.position.z = -0.01;
  frameGroup.add(mattingMesh);

  // 5. Canvas Photo Texture
  const photoTexture = await loadInstagramTexture(post);
  const photoGeom = new THREE.PlaneGeometry(canvasW, canvasH);
  const photoMat = new THREE.MeshStandardMaterial({
    map: photoTexture,
    roughness: 0.35,
    metalness: 0.02
  });
  const photoMesh = new THREE.Mesh(photoGeom, photoMat);
  photoMesh.position.z = 0.005;
  photoMesh.castShadow = false;
  photoMesh.receiveShadow = true;
  frameGroup.add(photoMesh);

  // 6. Protective Acrylic Glass Pane
  const glassGeom = new THREE.PlaneGeometry(mattingW - 0.02, mattingH - 0.02);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });
  const glassMesh = new THREE.Mesh(glassGeom, glassMat);
  glassMesh.position.z = outerD / 2 - 0.005;
  frameGroup.add(glassMesh);

  // 7. Engraved Museum Plaque
  const plaqueW = 0.45;
  const plaqueH = 0.11;
  const plaqueGeom = new THREE.BoxGeometry(plaqueW, plaqueH, 0.01);
  const plaqueTex = createPlaqueTexture(post);
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    roughness: 0.3,
    metalness: 0.85
  });
  const plaqueMesh = new THREE.Mesh(plaqueGeom, plaqueMat);
  plaqueMesh.position.set(0, -outerH / 2 - plaqueH / 2 - 0.04, 0);
  plaqueMesh.castShadow = true;
  frameGroup.add(plaqueMesh);

  // 8. Spatial Positioning in 3D Gallery (Arc / Linear Layout)
  const layout = options.layout || 'arc';
  const spacing = 1.65;
  const totalSpan = (total - 1) * spacing;
  const x = index * spacing - totalSpan / 2;

  if (layout === 'arc' && total > 1) {
    const angle = (x / totalSpan) * 0.45;
    const z = -Math.cos(angle) * 0.6 + 0.6;
    frameGroup.position.set(x, 1.65, z);
    frameGroup.rotation.y = -angle * 0.85;
  } else if (layout === 'grid' && total > 4) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    frameGroup.position.set(
      (col - 1.5) * 1.55,
      row === 0 ? 2.3 : 0.8,
      0
    );
  } else {
    // Linear Showcase
    frameGroup.position.set(x, 1.65, 0);
  }

  // Metadata attached to 3D object
  frameGroup.userData = {
    isGenerated: true,
    archetype: 'INSTAGRAM_FRAME',
    post,
    index,
    total,
    finish: finishKey
  };

  return frameGroup;
}
