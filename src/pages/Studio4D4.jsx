import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import MeshTemplateBrowser from '../components/MeshTemplateBrowser';
import ThreeDAIStudioModal from '../components/ThreeDAIStudioModal';
import { getMeshTemplates, fetchTemplatesFromBucket } from '../utils/meshTemplates';
import { CharacterAnimationManager } from '../utils/CharacterAnimationManager';
import { rigHumanoidObject, analyzeHumanoidGeometry } from '../utils/humanoidRigging';
import {
  DEFAULT_TRIPO_KEY,
  TRIPO_ANIMATION_PRESETS,
  rigModelWithTripo,
  retargetModelWithTripo,
  uploadFileToTripo,
  resolveTripoEndpoint
} from '../services/tripo3DService';

// =========================================================================
// 1. FABRIC & PBR PHYSICAL MATERIAL PROFILES
// =========================================================================
class FabricMaterialManager {
  constructor() {
    this.profiles = {
      cotton: {
        roughness: 0.85,
        metalness: 0.05,
        sheen: 0.4,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.0,
        useRim: 0.0,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      },
      satin: {
        roughness: 0.25,
        metalness: 0.1,
        sheen: 1.0,
        sheenRoughness: 0.2,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.2,
        useRim: 0.0,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      },
      velvet: {
        roughness: 0.7,
        metalness: 0.0,
        sheen: 1.0,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.0,
        useRim: 1.0,
        rimColor: new THREE.Color(0xffffff),
        rimPower: 4.0,
        rimIntensity: 1.5,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      },
      mesh: {
        roughness: 0.5,
        metalness: 0.1,
        sheen: 0.0,
        sheenRoughness: 0.0,
        clearcoat: 0.0,
        useRim: 0.0,
        transparent: true,
        opacity: 0.7,
        alphaMap: this.createMeshAlphaMap()
      },
      metallic: {
        roughness: 0.18,
        metalness: 0.9,
        sheen: 0.0,
        sheenRoughness: 0.0,
        clearcoat: 0.3,
        useRim: 0.0,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      },
      gloss: {
        roughness: 0.12,
        metalness: 0.1,
        sheen: 0.0,
        sheenRoughness: 0.0,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
        useRim: 0.0,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      },
      organic: {
        roughness: 0.65,
        metalness: 0.0,
        sheen: 0.6,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.05,
        useRim: 0.5,
        rimColor: new THREE.Color(0xffeedd),
        rimPower: 3.5,
        rimIntensity: 0.8,
        transparent: false,
        opacity: 1.0,
        alphaMap: null
      }
    };
  }

  createMeshAlphaMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 16);
    ctx.fillRect(0, 0, 16, 64);
    ctx.fillRect(0, 48, 64, 16);
    ctx.fillRect(48, 0, 16, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  createFabricMaterial(parameters) {
    const mat = new THREE.MeshPhysicalMaterial({
      ...parameters,
      side: parameters.side !== undefined ? parameters.side : THREE.DoubleSide
    });
    mat.userData = {
      useRim: 0.0,
      rimColor: new THREE.Color(0xffffff),
      rimPower: 4.0,
      rimIntensity: 1.5,
      originalSide: mat.side
    };

    mat.onBeforeCompile = (shader) => {
      mat.userData.shader = shader;
      shader.uniforms.useRim = { get value() { return mat.userData.useRim; } };
      shader.uniforms.rimColor = { get value() { return mat.userData.rimColor; } };
      shader.uniforms.rimPower = { get value() { return mat.userData.rimPower; } };
      shader.uniforms.rimIntensity = { get value() { return mat.userData.rimIntensity; } };

      shader.fragmentShader = `
        uniform float useRim;
        uniform vec3 rimColor;
        uniform float rimPower;
        uniform float rimIntensity;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        if (useRim > 0.5) {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);
            float NdotV = dot(normal, viewDir);
            float fresnel = pow(1.0 - max(abs(NdotV), 0.0), rimPower);
            gl_FragColor.rgb += rimColor * fresnel * rimIntensity;
        }
        `
      );
    };

    return mat;
  }

  applyProfile(material, profileName) {
    const profile = this.profiles[profileName] || this.profiles.cotton;
    material.roughness = profile.roughness;
    material.metalness = profile.metalness;
    material.sheen = profile.sheen ?? 0;
    material.sheenRoughness = profile.sheenRoughness ?? 0;
    if (material.sheenColor && profile.sheenColor) {
      material.sheenColor.copy(profile.sheenColor);
    }
    material.clearcoat = profile.clearcoat || 0.0;
    material.transparent = profile.transparent;
    material.opacity = profile.opacity ?? 1.0;
    material.alphaMap = profile.alphaMap || null;

    if (profileName === 'mesh') {
      material.side = THREE.DoubleSide;
    }

    material.userData.useRim = profile.useRim || 0.0;
    if (profile.rimColor && material.userData.rimColor) material.userData.rimColor.copy(profile.rimColor);
    if (profile.rimPower !== undefined) material.userData.rimPower = profile.rimPower;
    if (profile.rimIntensity !== undefined) material.userData.rimIntensity = profile.rimIntensity;

    material.needsUpdate = true;
  }
}

// =========================================================================
// 1.5. MODULAR TEXTURE & 3D VIDEO DISPLAY MANAGER
// =========================================================================
export class VideoDisplayManager {
  constructor(studioApp) {
    this.app = studioApp;
    this.videoTextures = new Map();
    this.css3dEntries = [];
    this.initCSS3D();
  }

  initCSS3D() {
    this.cssScene = new THREE.Scene();
    this.cssRenderer = new CSS3DRenderer();
    const w = this.app.container.clientWidth || 800;
    const h = this.app.container.clientHeight || 600;
    this.cssRenderer.setSize(w, h);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.cssRenderer.domElement.style.width = '100%';
    this.cssRenderer.domElement.style.height = '100%';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    this.cssRenderer.domElement.style.zIndex = '5';
    this.app.container.appendChild(this.cssRenderer.domElement);
  }

  setSize(w, h) {
    if (this.cssRenderer) {
      this.cssRenderer.setSize(w, h);
    }
  }

  // --- 1. DIRECT WEBGL VIDEO TEXTURING ---
  createWebGLVideoElement(sourceUrlOrFile, options = {}) {
    const video = document.createElement('video');
    if (typeof sourceUrlOrFile === 'string') {
      if (/^https?:\/\//i.test(sourceUrlOrFile)) {
        video.crossOrigin = 'anonymous';
      }
      video.src = sourceUrlOrFile;
    } else if (sourceUrlOrFile instanceof Blob || sourceUrlOrFile instanceof File) {
      video.src = URL.createObjectURL(sourceUrlOrFile);
    }

    video.loop = options.loop !== undefined ? options.loop : true;
    video.muted = options.muted !== undefined ? options.muted : true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');

    // Attach to hidden DOM container so browser hardware video decoder keeps running
    let videoContainer = document.getElementById('studio-hidden-video-box');
    if (!videoContainer) {
      videoContainer = document.createElement('div');
      videoContainer.id = 'studio-hidden-video-box';
      videoContainer.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-999;overflow:hidden;';
      document.body.appendChild(videoContainer);
    }
    videoContainer.appendChild(video);

    try {
      video.load();
    } catch {
      // Browser autoplay policy might defer loading until user gesture
    }

    const startPlaying = () => {
      if (video.paused) {
        video.play().catch((err) => console.warn('WebGL video autoplay notice:', err));
      }
    };

    video.addEventListener('canplay', startPlaying);
    video.addEventListener('loadeddata', startPlaying);
    startPlaying();

    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, startPlaying, { once: true, passive: true });
    });

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;

    return { video, videoTexture };
  }

  removeVideoFromMesh(mesh) {
    if (!mesh) return;
    let targetMesh = mesh;
    if (!mesh.isMesh) {
      mesh.traverse?.((n) => {
        if (!targetMesh.isMesh && n.isMesh && (n.userData?.hasVideo || n.userData?.videoTexture)) {
          targetMesh = n;
        }
      });
    }
    if (!targetMesh) return;

    // Find and clean video entry
    for (const [vId, entry] of this.videoTextures.entries()) {
      if (entry.mesh === targetMesh || entry.mesh === mesh) {
        if (entry.video) {
          entry.video.pause();
          entry.video.removeAttribute('src');
          entry.video.load();
          entry.video.remove?.();
        }
        this.videoTextures.delete(vId);
      }
    }

    // Restore original materials if saved
    if (targetMesh.userData?.originalMaterials) {
      targetMesh.material = Array.isArray(targetMesh.userData.originalMaterials)
        ? [...targetMesh.userData.originalMaterials]
        : targetMesh.userData.originalMaterials;
      if (targetMesh.userData.materials?.lit) {
        targetMesh.userData.materials.lit = Array.isArray(targetMesh.userData.originalMaterials)
          ? [...targetMesh.userData.originalMaterials]
          : targetMesh.userData.originalMaterials;
      }
      delete targetMesh.userData.originalMaterials;
    } else {
      const mats = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];
      mats.forEach((m) => {
        if (m.userData?.hasVideo || m.userData?.isVideoLayer || m.map === targetMesh.userData?.videoTexture) {
          m.map = null;
          m.emissiveMap = null;
          m.needsUpdate = true;
          delete m.userData?.hasVideo;
          delete m.userData?.videoUrl;
          delete m.userData?.isVideoLayer;
        }
      });
    }

    targetMesh.userData.hasVideo = false;
    delete targetMesh.userData.videoTexture;
    delete targetMesh.userData.videoEl;
    delete targetMesh.userData.videoFile;
    delete targetMesh.userData.videoUrl;
    delete targetMesh.userData.videoTargetMaterialIndex;

    this.app.updatePropertiesPanel();
    this.app.updateDiagnostics(`Removed video layer from "${targetMesh.name || 'Mesh'}". Base materials restored.`);
  }

  switchVideoTargetSlot(mesh, newSlotIndex) {
    if (!mesh) return;
    let targetMesh = mesh;
    if (!mesh.isMesh) {
      mesh.traverse?.((n) => {
        if (!targetMesh.isMesh && n.isMesh && (n.userData?.hasVideo || n.userData?.videoTexture)) {
          targetMesh = n;
        }
      });
    }
    if (!targetMesh || !targetMesh.userData?.videoTexture) return;

    const vTex = targetMesh.userData.videoTexture;
    const oldSlot = targetMesh.userData.videoTargetMaterialIndex ?? 0;
    const initialVideoUrl = targetMesh.userData.videoUrl || '';

    if (Array.isArray(targetMesh.material) && newSlotIndex >= 0 && newSlotIndex < targetMesh.material.length) {
      targetMesh.material = [...targetMesh.material];

      // Revert old slot material
      if (targetMesh.userData.originalMaterials && targetMesh.userData.originalMaterials[oldSlot]) {
        targetMesh.material[oldSlot] = targetMesh.userData.originalMaterials[oldSlot].clone();
      } else {
        const oldMat = targetMesh.material[oldSlot].clone();
        oldMat.map = null;
        oldMat.emissiveMap = null;
        delete oldMat.userData?.hasVideo;
        delete oldMat.userData?.isVideoLayer;
        oldMat.needsUpdate = true;
        targetMesh.material[oldSlot] = oldMat;
      }

      // Clone new slot material and attach video texture strictly to this slot
      const newMat = targetMesh.material[newSlotIndex].clone();
      newMat.map = vTex;
      newMat.emissiveMap = vTex;
      newMat.emissive = new THREE.Color(0xffffff);
      newMat.emissiveIntensity = 0.4;
      newMat.needsUpdate = true;
      newMat.userData = {
        ...newMat.userData,
        hasVideo: true,
        videoUrl: initialVideoUrl,
        videoSrc: initialVideoUrl,
        isVideoLayer: true
      };
      targetMesh.material[newSlotIndex] = newMat;

      if (targetMesh.userData?.materials?.lit && Array.isArray(targetMesh.userData.materials.lit)) {
        targetMesh.userData.materials.lit = [...targetMesh.material];
      }

      targetMesh.userData.videoTargetMaterialIndex = newSlotIndex;
      this.app.updatePropertiesPanel();
      this.app.updateDiagnostics(`Switched video layer on "${targetMesh.name}" to Face / Material Slot ${newSlotIndex}.`);
    }
  }

  addWebGLVideoDisplay({
    source,
    targetMode = 'FLAT_DISPLAY',
    name = 'Video_Display',
    selectedMesh = null,
    targetMaterialIndex = null,
    targetFaceIndex = null,
    options = {}
  }) {
    const { video, videoTexture } = this.createWebGLVideoElement(source, options);
    const videoId = `video_${Date.now()}`;

    const videoFile = (source instanceof Blob || source instanceof File) ? source : null;
    const initialVideoUrl = (typeof source === 'string') ? source : '';

    // Target Mode 1: Map onto specified or selected 3D mesh & distinct material/face slot
    if (targetMode === 'SELECTED_MESH' && selectedMesh) {
      let mesh = selectedMesh;
      if (!mesh.isMesh) {
        // If a Group was passed, find the first mesh or designated submesh
        mesh.traverse?.((child) => {
          if (!mesh.isMesh && child.isMesh) {
            mesh = child;
          }
        });
      }

      if (mesh && mesh.isMesh) {
        // Resolve target slot index
        let slot = 0;
        if (typeof targetMaterialIndex === 'number' && targetMaterialIndex >= 0) {
          slot = targetMaterialIndex;
        } else if (typeof targetFaceIndex === 'number' && mesh.geometry) {
          const fv = targetFaceIndex * 3;
          const g = mesh.geometry.groups?.find((group) => fv >= group.start && fv < group.start + group.count);
          slot = g ? (g.materialIndex ?? 0) : 0;
        }

        // Case A: Mesh has multi-material array
        if (Array.isArray(mesh.material)) {
          if (!mesh.userData.originalMaterials) {
            mesh.userData.originalMaterials = mesh.material.map((m) => m.clone());
          }
          mesh.material = [...mesh.material];
          const targetSlot = Math.min(slot, mesh.material.length - 1);
          const origMat = mesh.material[targetSlot] || new THREE.MeshStandardMaterial();
          const videoMat = origMat.clone();
          videoMat.map = videoTexture;
          videoMat.emissiveMap = videoTexture;
          videoMat.emissive = new THREE.Color(0xffffff);
          videoMat.emissiveIntensity = 0.4;
          videoMat.needsUpdate = true;
          videoMat.userData = {
            ...videoMat.userData,
            hasVideo: true,
            videoUrl: initialVideoUrl,
            videoSrc: initialVideoUrl,
            videoId,
            isVideoLayer: true
          };

          mesh.material[targetSlot] = videoMat;
          mesh.userData.videoTargetMaterialIndex = targetSlot;

          if (mesh.userData?.materials?.lit && Array.isArray(mesh.userData.materials.lit)) {
            mesh.userData.materials.lit = [...mesh.material];
          }
        }
        // Case B: Mesh has geometry groups and single material
        else if (mesh.geometry?.groups && mesh.geometry.groups.length > 1) {
          const origMat = mesh.material || new THREE.MeshStandardMaterial();
          if (!mesh.userData.originalMaterials) {
            mesh.userData.originalMaterials = origMat.clone();
          }
          const numGroups = mesh.geometry.groups.length;
          const mats = Array.from({ length: Math.max(numGroups, 2) }, () => origMat.clone());
          const targetSlot = Math.min(slot, mats.length - 1);

          const videoMat = origMat.clone();
          videoMat.map = videoTexture;
          videoMat.emissiveMap = videoTexture;
          videoMat.emissive = new THREE.Color(0xffffff);
          videoMat.emissiveIntensity = 0.4;
          videoMat.needsUpdate = true;
          videoMat.userData = {
            ...videoMat.userData,
            hasVideo: true,
            videoUrl: initialVideoUrl,
            videoSrc: initialVideoUrl,
            videoId,
            isVideoLayer: true
          };

          mats[targetSlot] = videoMat;
          mesh.material = mats;
          mesh.userData.videoTargetMaterialIndex = targetSlot;

          if (mesh.userData?.materials?.lit) {
            mesh.userData.materials.lit = mats;
          }
        }
        // Case C: Mesh has a single monolithic material
        else if (mesh.material) {
          if (!mesh.userData.originalMaterials) {
            mesh.userData.originalMaterials = mesh.material.clone();
          }
          // Clone material so NO other mesh in the scene sharing this material reference is modified!
          const videoMat = mesh.material.clone();
          videoMat.map = videoTexture;
          videoMat.emissiveMap = videoTexture;
          videoMat.emissive = new THREE.Color(0xffffff);
          videoMat.emissiveIntensity = 0.4;
          videoMat.needsUpdate = true;
          videoMat.userData = {
            ...videoMat.userData,
            hasVideo: true,
            videoUrl: initialVideoUrl,
            videoSrc: initialVideoUrl,
            videoId,
            isVideoLayer: true
          };

          mesh.material = videoMat;
          mesh.userData.videoTargetMaterialIndex = 0;

          if (mesh.userData?.materials?.lit) {
            mesh.userData.materials.lit = [videoMat];
          }
        }

        mesh.userData.videoTexture = videoTexture;
        mesh.userData.videoEl = video;
        mesh.userData.videoFile = videoFile;
        mesh.userData.videoUrl = initialVideoUrl;
        mesh.userData.hasVideo = true;

        this.videoTextures.set(videoId, { video, videoTexture, mesh, videoFile, slotIndex: mesh.userData.videoTargetMaterialIndex });
        this.app.selectObject(mesh);
        this.app.updatePropertiesPanel();
        this.app.updateDiagnostics(`Mapped WebGL Video Texture to "${mesh.name || 'Selected Mesh'}" [Layer/Slot ${mesh.userData.videoTargetMaterialIndex ?? 0}]`);
        return mesh;
      }
    }

    // Target Mode 2: New 16:9 Flat Video Screen
    if (targetMode === 'FLAT_DISPLAY') {
      const planeW = 3.6;
      const planeH = 2.025;
      const depth = 0.12;
      const geometry = new THREE.BoxGeometry(planeW, planeH, depth);

      const screenMat = this.app.fabricMaterialManager.createFabricMaterial({
        map: videoTexture,
        roughness: 0.1,
        metalness: 0.05,
        clearcoat: 0.8,
        clearcoatRoughness: 0.05,
        emissiveMap: videoTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide
      });
      screenMat.userData = {
        ...screenMat.userData,
        hasVideo: true,
        videoUrl: initialVideoUrl,
        videoSrc: initialVideoUrl,
        videoId,
        isVideoLayer: true
      };

      const bezelMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.35,
        metalness: 0.9,
        side: THREE.DoubleSide
      });

      // In Three.js BoxGeometry, face 4 is the front screen (+Z)
      const mats = [bezelMat, bezelMat, bezelMat, bezelMat, screenMat, bezelMat];
      const mesh = new THREE.Mesh(geometry, mats);
      mesh.name = name || 'Flat_Video_Screen';
      mesh.position.set(0, 2.0, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      mesh.userData = {
        isGenerated: true,
        archetype: 'VIDEO_SCREEN',
        hasVideo: true,
        videoTexture,
        videoEl: video,
        videoFile,
        videoUrl: initialVideoUrl,
        videoTargetMaterialIndex: 4,
        materials: { lit: mats },
        animate: false,
        rotationSpeed: 0.01,
        fabricProfile: 'gloss'
      };

      this.videoTextures.set(videoId, { video, videoTexture, mesh, videoFile, slotIndex: 4 });
      this.app.addSceneObject(mesh);
      this.app.selectObject(mesh);
      this.app.updateDiagnostics('Created 16:9 Flat WebGL Video Display Screen');
      return mesh;
    }

    // Target Mode 3: New 3D Curved Cinema Screen
    if (targetMode === 'CURVED_SCREEN') {
      const radius = 4.0;
      const height = 2.25;
      const thetaLength = Math.PI / 2.8;
      const radialSegments = 64;

      const screenGeom = new THREE.CylinderGeometry(
        radius, radius, height, radialSegments, 1, true,
        -thetaLength / 2, thetaLength
      );

      // Fix cylinder UVs: invert U so video is not mirrored horizontally when viewing the concave inside
      const uvAttr = screenGeom.attributes.uv;
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setX(i, 1.0 - uvAttr.getX(i));
      }
      uvAttr.needsUpdate = true;

      const screenMat = this.app.fabricMaterialManager.createFabricMaterial({
        map: videoTexture,
        roughness: 0.12,
        metalness: 0.05,
        clearcoat: 0.85,
        emissiveMap: videoTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide
      });
      screenMat.userData = {
        ...screenMat.userData,
        hasVideo: true,
        videoUrl: initialVideoUrl,
        videoSrc: initialVideoUrl,
        videoId,
        isVideoLayer: true
      };

      const mesh = new THREE.Mesh(screenGeom, screenMat);
      mesh.name = name || 'Curved_Cinema_Screen';
      mesh.position.set(0, 2.0, 0);

      mesh.userData = {
        isGenerated: true,
        archetype: 'CURVED_CINEMA',
        hasVideo: true,
        videoTexture,
        videoEl: video,
        videoFile,
        videoUrl: initialVideoUrl,
        videoTargetMaterialIndex: 0,
        materials: { lit: [screenMat] },
        animate: false,
        rotationSpeed: 0.01,
        fabricProfile: 'gloss'
      };

      this.videoTextures.set(videoId, { video, videoTexture, mesh, videoFile, slotIndex: 0 });
      this.app.addSceneObject(mesh);
      this.app.selectObject(mesh);
      this.app.updateDiagnostics('Created Curved Cinema 3D WebGL Video Screen');
      return mesh;
    }

    // Target Mode 4: 3D Cylindrical Can / Column Video Wrap
    if (targetMode === 'CYLINDER_WRAP') {
      const radius = 1.1;
      const height = 3.2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 8);

      // Align and un-mirror cylinder wrap UVs
      const uvAttr = geometry.attributes.uv;
      for (let i = 0; i < uvAttr.count; i++) {
        let u = uvAttr.getX(i);
        u = 1.0 - u;
        uvAttr.setX(i, (u + 0.25) % 1.0);
      }
      uvAttr.needsUpdate = true;

      const sideMat = this.app.fabricMaterialManager.createFabricMaterial({
        map: videoTexture,
        roughness: 0.2,
        metalness: 0.85,
        emissiveMap: videoTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide
      });
      sideMat.userData = {
        ...sideMat.userData,
        hasVideo: true,
        videoUrl: initialVideoUrl,
        videoSrc: initialVideoUrl,
        videoId,
        isVideoLayer: true
      };

      const lidMat = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        roughness: 0.2,
        metalness: 0.95
      });

      const mats = [sideMat, lidMat, lidMat];
      const mesh = new THREE.Mesh(geometry, mats);
      mesh.name = name || 'Cylinder_Video_Wrap';
      mesh.position.set(0, 2.0, 0);

      mesh.userData = {
        isGenerated: true,
        archetype: 'CYLINDRICAL',
        hasVideo: true,
        videoTexture,
        videoEl: video,
        videoFile,
        videoUrl: initialVideoUrl,
        videoTargetMaterialIndex: 0,
        materials: { lit: mats },
        animate: true,
        rotationSpeed: 0.008,
        fabricProfile: 'metallic'
      };

      this.videoTextures.set(videoId, { video, videoTexture, mesh, videoFile, slotIndex: 0 });
      this.app.addSceneObject(mesh);
      this.app.selectObject(mesh);
      this.app.updateDiagnostics('Created 360° Cylindrical 3D Video Wrap');
      return mesh;
    }
  }

  // --- 2. CSS3D YOUTUBE OVERLAY INTEGRATION ---
  extractYouTubeId(urlOrId) {
    if (!urlOrId) return 'dQw4w9WgXcQ';
    const trimmed = urlOrId.trim();
    if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.')) return trimmed;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[2].length === 11) ? match[2] : 'dQw4w9WgXcQ';
  }

  addCSS3DYouTubeOverlay({ urlOrId = 'dQw4w9WgXcQ', aspectRatio = '16:9', frameStyle = 'cyber_bezel', name = 'YouTube_3D_Display' }) {
    const videoId = this.extractYouTubeId(urlOrId);

    let iframeW = 640;
    let iframeH = 360;
    if (aspectRatio === '9:16') {
      iframeW = 360;
      iframeH = 640;
    } else if (aspectRatio === '21:9') {
      iframeW = 840;
      iframeH = 360;
    }

    // 1. Create HTML wrapper & IFrame
    const containerDiv = document.createElement('div');
    containerDiv.style.width = `${iframeW}px`;
    containerDiv.style.height = `${iframeH}px`;
    containerDiv.style.background = '#090d16';
    containerDiv.style.borderRadius = '12px';
    containerDiv.style.overflow = 'hidden';
    containerDiv.style.pointerEvents = 'auto';
    containerDiv.style.boxShadow = '0 20px 50px rgba(0,0,0,0.8)';
    containerDiv.style.border = '2px solid rgba(99, 102, 241, 0.4)';

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0px';
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=1&controls=1&loop=1&playlist=${videoId}&origin=${window.location.origin}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    containerDiv.appendChild(iframe);

    // 2. Create CSS3DObject
    const cssObject = new CSS3DObject(containerDiv);
    const baseScale = 0.005;
    cssObject.scale.set(baseScale, baseScale, baseScale);
    cssObject.position.set(0, 2.0, 0);
    this.cssScene.add(cssObject);

    // 3. Create WebGL Bezel / Stand Mesh to synchronize with Three.js selection & gizmos
    const worldW = iframeW * baseScale;
    const worldH = iframeH * baseScale;
    const bezelThickness = 0.08;
    const bezelDepth = 0.12;

    const bezelGeom = new THREE.BoxGeometry(worldW + bezelThickness, worldH + bezelThickness, bezelDepth);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: frameStyle === 'cyber_bezel' ? 0x1e1b4b : (frameStyle === 'glass_float' ? 0x38bdf8 : 0x18181b),
      roughness: frameStyle === 'glass_float' ? 0.1 : 0.4,
      metalness: 0.8,
      transparent: frameStyle === 'glass_float',
      opacity: frameStyle === 'glass_float' ? 0.6 : 1.0
    });
    const bezelMats = [bezelMat, bezelMat, bezelMat, bezelMat, bezelMat, bezelMat];

    const bezelMesh = new THREE.Mesh(bezelGeom, bezelMats);
    bezelMesh.name = name || `YouTube_${videoId}`;
    bezelMesh.position.set(0, 2.0, 0);

    const entryId = `css3d_${Date.now()}`;
    bezelMesh.userData = {
      isGenerated: true,
      archetype: 'CSS3D_YOUTUBE',
      isCSS3D: true,
      css3dId: entryId,
      videoId,
      iframe,
      cssObject,
      baseScale,
      frameStyle,
      materials: { lit: bezelMats }
    };

    this.css3dEntries.push({
      id: entryId,
      cssObject,
      bezelMesh,
      videoId,
      baseScale
    });

    this.app.addSceneObject(bezelMesh);
    this.app.selectObject(bezelMesh);
    this.app.updateDiagnostics(`Spawned Interactive CSS3D YouTube Display [${videoId}]`);
    return bezelMesh;
  }

  update() {
    // 1. Sync CSS3D YouTube overlays to WebGL bezel positions
    for (let i = this.css3dEntries.length - 1; i >= 0; i--) {
      const entry = this.css3dEntries[i];
      if (!this.app.objects.includes(entry.bezelMesh)) {
        this.cssScene.remove(entry.cssObject);
        this.css3dEntries.splice(i, 1);
        continue;
      }
      entry.cssObject.position.copy(entry.bezelMesh.position);
      entry.cssObject.quaternion.copy(entry.bezelMesh.quaternion);
      const s = entry.baseScale;
      entry.cssObject.scale.set(
        entry.bezelMesh.scale.x * s,
        entry.bezelMesh.scale.y * s,
        entry.bezelMesh.scale.z * s
      );
    }

    // 2. Continuous GPU sync for WebGL Video Textures
    this.videoTextures.forEach(({ video, videoTexture }) => {
      if (video) {
        if (video.paused && video.readyState >= 2) {
          video.play().catch(() => {});
        }
        if (!video.paused && video.readyState >= 2) {
          videoTexture.needsUpdate = true;
        }
      }
    });
  }

  render(camera) {
    if (this.cssRenderer && this.cssScene && camera) {
      this.cssRenderer.render(this.cssScene, camera);
    }
  }

  destroy() {
    this.videoTextures.forEach(({ video }) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    this.videoTextures.clear();

    this.css3dEntries.forEach(({ cssObject }) => {
      this.cssScene.remove(cssObject);
    });
    this.css3dEntries = [];

    if (this.cssRenderer && this.cssRenderer.domElement && this.cssRenderer.domElement.parentNode) {
      this.cssRenderer.domElement.parentNode.removeChild(this.cssRenderer.domElement);
    }
  }
}

// =========================================================================
// 2. INTELLIGENT FOREGROUND EXTRACTION & SHAPE CLASSIFIER
// =========================================================================
function extractForegroundAndClassify(img) {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Downsample for high-speed segmentation mask
  const maxDim = 512;
  let segW = origW;
  let segH = origH;
  if (segW > maxDim || segH > maxDim) {
    const ratio = Math.min(maxDim / segW, maxDim / segH);
    segW = Math.max(16, Math.floor(segW * ratio));
    segH = Math.max(16, Math.floor(segH * ratio));
  }

  const segCanvas = document.createElement('canvas');
  segCanvas.width = segW;
  segCanvas.height = segH;
  const segCtx = segCanvas.getContext('2d', { willReadFrequently: true });
  segCtx.drawImage(img, 0, 0, segW, segH);

  const segImgData = segCtx.getImageData(0, 0, segW, segH);
  const segData = segImgData.data;
  const totalPixels = segW * segH;

  // 1. Check if image already has native transparent alpha
  let transparentCount = 0;
  for (let i = 3; i < segData.length; i += 4) {
    if (segData[i] < 200) transparentCount++;
  }
  const hasExistingAlpha = transparentCount > totalPixels * 0.02;

  // 2. Multi-Corner Bilinear Background Model & Gradient Edge Barrier
  const mask = new Uint8Array(totalPixels);

  if (hasExistingAlpha) {
    for (let i = 0; i < totalPixels; i++) {
      mask[i] = segData[i * 4 + 3] > 80 ? 1 : 0;
    }
  } else {
    // Sample 4 corner regions (5x5 samples each) to form bilinear gradient background plane
    const sampleCorner = (startX, startY) => {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const cx = Math.max(0, Math.min(segW - 1, startX + dx));
          const cy = Math.max(0, Math.min(segH - 1, startY + dy));
          const idx = (cy * segW + cx) * 4;
          r += segData[idx];
          g += segData[idx + 1];
          b += segData[idx + 2];
          count++;
        }
      }
      return [r / count, g / count, b / count];
    };

    const cTL = sampleCorner(0, 0);
    const cTR = sampleCorner(segW - 5, 0);
    const cBL = sampleCorner(0, segH - 5);
    const cBR = sampleCorner(segW - 5, segH - 5);

    // Compute luminance gradients for edge barrier
    const gradMag = new Float32Array(totalPixels);
    for (let y = 1; y < segH - 1; y++) {
      const yOffset = y * segW;
      for (let x = 1; x < segW - 1; x++) {
        const idx = yOffset + x;
        const lumL = 0.299 * segData[(idx - 1) * 4] + 0.587 * segData[(idx - 1) * 4 + 1] + 0.114 * segData[(idx - 1) * 4 + 2];
        const lumR = 0.299 * segData[(idx + 1) * 4] + 0.587 * segData[(idx + 1) * 4 + 1] + 0.114 * segData[(idx + 1) * 4 + 2];
        const lumU = 0.299 * segData[(idx - segW) * 4] + 0.587 * segData[(idx - segW) * 4 + 1] + 0.114 * segData[(idx - segW) * 4 + 2];
        const lumD = 0.299 * segData[(idx + segW) * 4] + 0.587 * segData[(idx + segW) * 4 + 1] + 0.114 * segData[(idx + segW) * 4 + 2];
        gradMag[idx] = Math.abs(lumR - lumL) + Math.abs(lumD - lumU);
      }
    }

    // Bilinear interpolated background color at (x, y)
    const getBgColor = (x, y) => {
      const u = x / Math.max(1, segW - 1);
      const v = y / Math.max(1, segH - 1);
      const r = (1 - u) * (1 - v) * cTL[0] + u * (1 - v) * cTR[0] + (1 - u) * v * cBL[0] + u * v * cBR[0];
      const g = (1 - u) * (1 - v) * cTL[1] + u * (1 - v) * cTR[1] + (1 - u) * v * cBL[1] + u * v * cBR[1];
      const b = (1 - u) * (1 - v) * cTL[2] + u * (1 - v) * cTR[2] + (1 - u) * v * cBL[2] + u * v * cBR[2];
      return [r, g, b];
    };

    const baseTolerance = 34;
    const visited = new Uint8Array(totalPixels);
    const queue = [];

    const isBg = (x, y, idx) => {
      const [bgR, bgG, bgB] = getBgColor(x, y);
      const r = segData[idx * 4];
      const g = segData[idx * 4 + 1];
      const b = segData[idx * 4 + 2];
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      // Edge barrier: if gradient is strong, require much tighter color similarity to prevent leaking
      const maxTol = gradMag[idx] > 32 ? baseTolerance * 0.55 : baseTolerance;
      return dist <= maxTol;
    };

    // Initialize flood fill from all 4 perimeter borders
    for (let x = 0; x < segW; x++) {
      queue.push(x);
      queue.push((segH - 1) * segW + x);
    }
    for (let y = 0; y < segH; y++) {
      queue.push(y * segW);
      queue.push(y * segW + (segW - 1));
    }

    while (queue.length > 0) {
      const idx = queue.pop();
      if (visited[idx]) continue;
      visited[idx] = 1;

      const x = idx % segW;
      const y = Math.floor(idx / segW);

      if (isBg(x, y, idx)) {
        mask[idx] = 0;
        if (x > 0 && !visited[idx - 1]) queue.push(idx - 1);
        if (x < segW - 1 && !visited[idx + 1]) queue.push(idx + 1);
        if (y > 0 && !visited[idx - segW]) queue.push(idx - segW);
        if (y < segH - 1 && !visited[idx + segW]) queue.push(idx + segW);
      } else {
        mask[idx] = 1;
      }
    }

    // All unvisited internal pixels belong to foreground
    for (let i = 0; i < totalPixels; i++) {
      if (!visited[i]) mask[i] = 1;
    }
  }

  // 3. Calculate Foreground Bounding Box
  let minX = segW, minY = segH, maxX = 0, maxY = 0;
  let fgCount = 0;
  for (let y = 0; y < segH; y++) {
    for (let x = 0; x < segW; x++) {
      if (mask[y * segW + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        fgCount++;
      }
    }
  }

  if (fgCount < totalPixels * 0.01) {
    minX = Math.floor(segW * 0.05);
    minY = Math.floor(segH * 0.05);
    maxX = Math.floor(segW * 0.95);
    maxY = Math.floor(segH * 0.95);
    mask.fill(1);
    fgCount = totalPixels;
  }

  const fgW = Math.max(1, maxX - minX + 1);
  const fgH = Math.max(1, maxY - minY + 1);

  // 4. Full-Res Cutout Canvas with Edge Defringing
  const outCanvas = document.createElement('canvas');
  outCanvas.width = origW;
  outCanvas.height = origH;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(img, 0, 0);

  const fullImgData = outCtx.getImageData(0, 0, origW, origH);
  const fullData = fullImgData.data;

  let sumEdgeR = 0, sumEdgeG = 0, sumEdgeB = 0, edgeCount = 0;

  for (let y = 0; y < origH; y++) {
    const segY = Math.floor((y / origH) * segH);
    for (let x = 0; x < origW; x++) {
      const segX = Math.floor((x / origW) * segW);
      const isFg = mask[segY * segW + segX] === 1;
      const p = (y * origW + x) * 4;

      if (!isFg) {
        fullData[p + 3] = 0;
      } else {
        const isBorder = x === 0 || x === origW - 1 || y === 0 || y === origH - 1 ||
          (segX > 0 && mask[segY * segW + (segX - 1)] === 0) ||
          (segX < segW - 1 && mask[segY * segW + (segX + 1)] === 0) ||
          (segY > 0 && mask[(segY - 1) * segW + segX] === 0) ||
          (segY < segH - 1 && mask[(segY + 1) * segW + segX] === 0);

        if (isBorder) {
          sumEdgeR += fullData[p];
          sumEdgeG += fullData[p + 1];
          sumEdgeB += fullData[p + 2];
          edgeCount++;
        }
      }
    }
  }
  outCtx.putImageData(fullImgData, 0, 0);

  const edgeHexColor = edgeCount > 0
    ? (Math.floor(sumEdgeR / edgeCount) << 16) | (Math.floor(sumEdgeG / edgeCount) << 8) | Math.floor(sumEdgeB / edgeCount)
    : 0x1e293b;

  // Geometric Archetype Classification
  const aspectRatio = fgH / fgW;
  const solidity = fgCount / (fgW * fgH);

  let topWidth = 0, midWidth = 0, btmWidth = 0;
  const topY = minY + Math.floor(fgH * 0.15);
  const midY = minY + Math.floor(fgH * 0.50);
  const btmY = minY + Math.floor(fgH * 0.85);

  for (let x = minX; x <= maxX; x++) {
    if (mask[topY * segW + x]) topWidth++;
    if (mask[midY * segW + x]) midWidth++;
    if (mask[btmY * segW + x]) btmWidth++;
  }

  const isCylinder = aspectRatio >= 1.2 &&
    Math.abs(topWidth - midWidth) / Math.max(1, midWidth) < 0.2 &&
    Math.abs(btmWidth - midWidth) / Math.max(1, midWidth) < 0.2 &&
    solidity > 0.70;

  const isGarment = (topWidth > btmWidth * 1.2 || midWidth > btmWidth * 1.15) &&
    aspectRatio >= 0.75 && aspectRatio <= 1.45 &&
    solidity > 0.40 && solidity < 0.85;

  const isBoxy = solidity > 0.88 &&
    (Math.abs(topWidth - midWidth) / Math.max(1, midWidth) < 0.08) &&
    (aspectRatio >= 0.45 && aspectRatio <= 1.8);

  let archetype = 'LOGO_GRAPHIC';
  let label = 'Flat Graphic / Logo';
  let icon = 'label';
  let description = 'Vector logo with crisp beveled 3D extrusion and textured front/back faces.';

  if (isCylinder) {
    archetype = 'CYLINDRICAL';
    label = 'Cylindrical (Soda Can / Bottle)';
    icon = 'local_drink';
    description = 'Reconstructed as a 3D cylinder with seamless wrap UVs and metallic lid.';
  } else if (isGarment) {
    archetype = 'GARMENT_APPAREL';
    label = 'Garment / Apparel (T-Shirt)';
    icon = 'checkroom';
    description = '3D garment mesh with organic fabric volume and PBR fabric shading.';
  } else if (isBoxy) {
    archetype = 'SCREEN_BOXY';
    label = '3D Screen / Device';
    icon = 'tv';
    description = 'Beveled chassis box with front display screen and matte housing.';
  } else if (solidity < 0.65 || aspectRatio > 1.5) {
    archetype = 'ORGANIC_FIGURE';
    label = 'Volumetric Organic (Animal / Figure)';
    icon = 'pets';
    description = 'Full 3D dual-sided organic sculpture with geodesic inflation.';
  }

  return {
    extractedCanvas: outCanvas,
    extractedDataUrl: outCanvas.toDataURL(),
    maskGrid: mask,
    segW,
    segH,
    origW,
    origH,
    bbox: { minX, minY, maxX, maxY, width: fgW, height: fgH },
    edgeHexColor,
    archetype,
    label,
    icon,
    description
  };
}

// =========================================================================
// 3. ROBUST 360° RADIAL CONTOUR EXTRACTOR
// =========================================================================
function extractRadialContour(maskGrid, w, h) {
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
  let sumX = 0, sumY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (maskGrid[y * w + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count < 10) {
    minX = Math.floor(w * 0.1); maxX = Math.floor(w * 0.9);
    minY = Math.floor(h * 0.1); maxY = Math.floor(h * 0.9);
  }

  const centerX = count > 0 ? sumX / count : (minX + maxX) / 2;
  const centerY = count > 0 ? sumY / count : (minY + maxY) / 2;

  const numRays = 120;
  const rawPath = [];
  const maxRadius = Math.sqrt(w * w + h * h);

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    let lastHitX = centerX + cosA * 2;
    let lastHitY = centerY + sinA * 2;

    for (let r = 1; r < maxRadius; r += 1.0) {
      const px = Math.floor(centerX + cosA * r);
      const py = Math.floor(centerY + sinA * r);
      if (px < 0 || px >= w || py < 0 || py >= h) break;
      if (maskGrid[py * w + px] === 1) {
        lastHitX = px;
        lastHitY = py;
      }
    }
    rawPath.push({ x: lastHitX, y: lastHitY });
  }

  const smoothPath = [];
  const windowSize = 5;
  const half = 2;
  const len = rawPath.length;

  for (let i = 0; i < len; i++) {
    let sx = 0, sy = 0;
    for (let j = -half; j <= half; j++) {
      const idx = (i + j + len) % len;
      sx += rawPath[idx].x;
      sy += rawPath[idx].y;
    }
    smoothPath.push({ x: sx / windowSize, y: sy / windowSize });
  }

  return smoothPath;
}

// =========================================================================
// 4. STUDIO 4D*4 MAIN REACT COMPONENT
// =========================================================================
export default function Studio4D4() {
  const [threeDAIModalData, setThreeDAIModalData] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoTab, setVideoTab] = useState('webgl');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoTargetMode, setVideoTargetMode] = useState('FLAT_DISPLAY');
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [youtubeAspect, setYoutubeAspect] = useState('16:9');
  const [youtubeBezel, setYoutubeBezel] = useState('cyber_bezel');
  const [videoTargetMeshUuid, setVideoTargetMeshUuid] = useState('');
  const [videoTargetMaterialIndex, setVideoTargetMaterialIndex] = useState(0);
  const [isFacePickingActive, setIsFacePickingActive] = useState(false);
  const [facePickStatusNotice, setFacePickStatusNotice] = useState('');
  const appRef = useRef(null);
  const fileInputRef = useRef(null);
  const model3DInputRef = useRef(null);
  const videoFileInputRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [templateBrowserMode, setTemplateBrowserMode] = useState('drawer'); // 'drawer' | 'modal'
  const [activeLeftTab, setActiveLeftTab] = useState('outliner'); // 'outliner' | 'templates'
  const [loadingTemplateId, setLoadingTemplateId] = useState(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [templateCount, setTemplateCount] = useState(0);

  // Cloud AI Rigging State (Tripo3D API)
  const [cloudRigModalOpen, setCloudRigModalOpen] = useState(false);
  const [cloudRigPreset, setCloudRigPreset] = useState('preset:idle');
  const [cloudRigSpec, setCloudRigSpec] = useState('tripo');
  const [cloudRigApiKey, setCloudRigApiKey] = useState(DEFAULT_TRIPO_KEY);
  const [isCloudRigging, setIsCloudRigging] = useState(false);
  const [cloudRigStep, setCloudRigStep] = useState('');
  const [cloudRigError, setCloudRigError] = useState('');

  const openVideoIngestionModal = () => {
    if (appRef.current) {
      const candidates = appRef.current.getAllCandidateMeshes();
      const selected = appRef.current.selectedObject;
      if (selected) {
        if (selected.isMesh) {
          setVideoTargetMeshUuid(selected.uuid);
          setVideoTargetMaterialIndex(selected.userData?.videoTargetMaterialIndex ?? 0);
          setVideoTargetMode('SELECTED_MESH');
        } else {
          // Model or Group
          const childCandidate = candidates.find((c) => c.parentName === selected.name) || candidates[0];
          if (childCandidate) {
            setVideoTargetMeshUuid(childCandidate.uuid);
            setVideoTargetMaterialIndex(childCandidate.mesh?.userData?.videoTargetMaterialIndex ?? 0);
            setVideoTargetMode('SELECTED_MESH');
          }
        }
      } else if (candidates.length > 0) {
        setVideoTargetMeshUuid(candidates[0].uuid);
        setVideoTargetMaterialIndex(candidates[0].mesh?.userData?.videoTargetMaterialIndex ?? 0);
        setVideoTargetMode('SELECTED_MESH');
      } else {
        setVideoTargetMode('FLAT_DISPLAY');
      }
    }
    setVideoModalOpen(true);
  };

  const handleStartFacePicking = () => {
    setVideoModalOpen(false);
    setIsFacePickingActive(true);
    setFacePickStatusNotice('Click any surface or face in the 3D viewport to lock target...');
    if (appRef.current) {
      appRef.current.enableFacePickMode((picked) => {
        setVideoTargetMeshUuid(picked.mesh.uuid);
        setVideoTargetMaterialIndex(picked.materialIndex);
        setVideoTargetMode('SELECTED_MESH');
        setFacePickStatusNotice(`Locked target: ${picked.mesh.name || 'Submesh'} (Layer/Slot ${picked.materialIndex})`);
        setIsFacePickingActive(false);
        setVideoModalOpen(true);
        setTimeout(() => setFacePickStatusNotice(''), 4500);
      });
    }
  };

  const handleCancelFacePicking = () => {
    if (appRef.current) {
      appRef.current.disableFacePickMode();
    }
    setIsFacePickingActive(false);
    setFacePickStatusNotice('');
    setVideoModalOpen(true);
  };

  useEffect(() => {
    const templates = getMeshTemplates();
    setTemplateCount(templates.length);

    fetchTemplatesFromBucket()
      .then((fresh) => {
        if (fresh && fresh.length > 0) {
          setTemplateCount(fresh.length);
        }
      })
      .catch(() => {});

    const handleUpdate = (e) => {
      if (e.detail && e.detail.length > 0) {
        setTemplateCount(e.detail.length);
      }
    };
    window.addEventListener('3dtemplates-updated', handleUpdate);
    return () => window.removeEventListener('3dtemplates-updated', handleUpdate);
  }, []);

  useEffect(() => {
    class StudioApp {
      constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        this.objects = [];
        this.helpers = [];
        this.selectedObject = null;
        this.fabricMaterialManager = new FabricMaterialManager();
        this.clock = new THREE.Clock();
        this.characterAnimationManager = new CharacterAnimationManager(this);
        this.facePickModeActive = false;
        this.onFacePickCallback = null;
        this.hoverHighlightHelper = null;

        this.init();
      }

      getAllCandidateMeshes() {
        const candidates = [];
        this.objects.forEach((obj) => {
          if (obj.isLight || obj.isHelper) return;
          if (obj.isMesh) {
            candidates.push({
              mesh: obj,
              parentName: obj.name || 'Standalone Mesh',
              isChild: false,
              uuid: obj.uuid,
              name: obj.name || 'Mesh',
              materialCount: Array.isArray(obj.material) ? obj.material.length : 1,
              hasVideo: !!(obj.userData?.hasVideo || obj.userData?.videoTexture)
            });
          } else {
            obj.traverse?.((child) => {
              if (child.isMesh) {
                candidates.push({
                  mesh: child,
                  parentName: obj.name || 'Model Group',
                  isChild: true,
                  uuid: child.uuid,
                  name: child.name || 'Submesh',
                  materialCount: Array.isArray(child.material) ? child.material.length : 1,
                  hasVideo: !!(child.userData?.hasVideo || child.userData?.videoTexture)
                });
              }
            });
          }
        });
        return candidates;
      }

      findMeshByUuid(uuid) {
        if (!uuid) return null;
        let found = null;
        this.objects.forEach((obj) => {
          if (found) return;
          if (obj.uuid === uuid && obj.isMesh) {
            found = obj;
            return;
          }
          obj.traverse?.((child) => {
            if (!found && child.isMesh && child.uuid === uuid) {
              found = child;
            }
          });
        });
        return found;
      }

      getMaterialSlotsForMesh(mesh) {
        if (!mesh) return [];
        const slots = [];
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat, idx) => {
            let label = mat.name || `Material Slot ${idx}`;
            if (mesh.userData?.archetype === 'VIDEO_SCREEN' || mesh.name?.includes('Flat_Video_Screen')) {
              const boxLabels = ['Right Edge', 'Left Edge', 'Top Edge', 'Bottom Edge', 'Front Screen', 'Back Panel'];
              label = boxLabels[idx] || label;
            }
            slots.push({
              index: idx,
              name: label,
              color: mat.color ? '#' + mat.color.getHexString() : '#6366f1',
              hasVideo: !!(mat.userData?.hasVideo || mat.userData?.isVideoLayer || (mesh.userData?.hasVideo && mesh.userData?.videoTargetMaterialIndex === idx))
            });
          });
        } else if (mesh.geometry?.groups && mesh.geometry.groups.length > 1) {
          mesh.geometry.groups.forEach((group, idx) => {
            let label = `Face Group ${idx} (Slot ${group.materialIndex ?? idx})`;
            if (mesh.userData?.archetype === 'SCREEN_BOXY') {
              const boxLabels = ['Right Edge', 'Left Edge', 'Top Edge', 'Bottom Edge', 'Front Screen', 'Back Panel'];
              label = boxLabels[idx] || label;
            }
            slots.push({
              index: group.materialIndex ?? idx,
              name: label,
              color: mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#6366f1',
              hasVideo: !!(mesh.userData?.hasVideo && mesh.userData?.videoTargetMaterialIndex === (group.materialIndex ?? idx))
            });
          });
        } else {
          slots.push({
            index: 0,
            name: mesh.material?.name || 'Whole Surface / Layer 0',
            color: mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#6366f1',
            hasVideo: !!(mesh.userData?.hasVideo || mesh.material?.userData?.hasVideo)
          });
        }
        return slots;
      }

      enableFacePickMode(callback) {
        this.facePickModeActive = true;
        this.onFacePickCallback = callback;
        if (this.renderer?.domElement) {
          this.renderer.domElement.style.cursor = 'crosshair';
        }
        this.updateDiagnostics('🎯 3D Surface Picker active: Click any face or surface in the viewport.');
      }

      disableFacePickMode() {
        this.facePickModeActive = false;
        this.onFacePickCallback = null;
        if (this.renderer?.domElement) {
          this.renderer.domElement.style.cursor = 'default';
        }
        if (this.hoverHighlightHelper) {
          this.scene.remove(this.hoverHighlightHelper);
          this.hoverHighlightHelper = null;
        }
      }

      flashMeshHighlight(mesh) {
        if (!mesh) return;
        const box = new THREE.BoxHelper(mesh, 0x10b981);
        this.scene.add(box);
        this.helpers.push(box);
        setTimeout(() => {
          this.scene.remove(box);
          this.helpers = this.helpers.filter((h) => h !== box);
        }, 2200);
      }

      init() {
        // Clean any existing canvas in container
        const oldCanvases = this.container.querySelectorAll('canvas');
        oldCanvases.forEach((c) => c.remove());

        const w = this.container.clientWidth || 800;
        const h = this.container.clientHeight || 600;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(0, 3.5, 8.5);

        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.touchAction = 'none';

        this.container.insertBefore(this.renderer.domElement, this.container.firstChild);

        this.videoDisplayManager = new VideoDisplayManager(this);

        this.setupControls();
        this.setupEnvironment();

        this.resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              this.camera.aspect = width / height;
              this.camera.updateProjectionMatrix();
              this.renderer.setSize(width, height);
              if (this.videoDisplayManager) {
                this.videoDisplayManager.setSize(width, height);
              }
            }
          }
        });
        this.resizeObserver.observe(this.container);

        this.setupEventListeners();
        this.updateOutliner();
        this.animate();
      }

      setupControls() {
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = 0.08;
        this.orbit.screenSpacePanning = true;
        this.orbit.minDistance = 0.5;
        this.orbit.maxDistance = 100;
        this.orbit.target.set(0, 1.5, 0);
        this.orbit.update();

        this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControl.addEventListener('dragging-changed', (event) => {
          this.orbit.enabled = !event.value;
        });
        this.transformControl.addEventListener('change', () => {
          this.syncPropertiesPanel();
        });

        const helper = this.transformControl.getHelper ? this.transformControl.getHelper() : this.transformControl;
        this.scene.add(helper);
        this.helpers.push(helper);

        // Click Raycaster on Canvas to Select 3D Objects
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let isDragging = false;
        let startX = 0, startY = 0;

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
          isDragging = false;
          startX = e.clientX;
          startY = e.clientY;
        });

        this.renderer.domElement.addEventListener('pointermove', (e) => {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
            isDragging = true;
          }
        });

        this.renderer.domElement.addEventListener('pointerup', (e) => {
          if (isDragging) return;
          const rect = this.renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, this.camera);
          const selectable = this.objects.filter((o) => o.isMesh || o.isGroup || o.isLight);
          const intersects = raycaster.intersectObjects(selectable, true);

          if (intersects.length > 0) {
            const hit = intersects[0];
            const hitMesh = hit.object;

            // Handle 3D Face / Surface Picking Mode
            if (this.facePickModeActive) {
              const faceIndex = hit.faceIndex;
              let materialIndex = 0;
              if (Array.isArray(hitMesh.material)) {
                if (hitMesh.geometry?.groups?.length) {
                  const fv = (faceIndex ?? 0) * 3;
                  const g = hitMesh.geometry.groups.find((group) => fv >= group.start && fv < group.start + group.count);
                  materialIndex = g ? g.materialIndex : (hit.face?.materialIndex ?? 0);
                } else {
                  materialIndex = hit.face?.materialIndex ?? 0;
                }
              } else if (hitMesh.geometry?.groups?.length > 1) {
                const fv = (faceIndex ?? 0) * 3;
                const g = hitMesh.geometry.groups.find((group) => fv >= group.start && fv < group.start + group.count);
                materialIndex = g ? (g.materialIndex ?? 0) : 0;
              }

              this.flashMeshHighlight(hitMesh);
              this.selectObject(hitMesh);

              const cb = this.onFacePickCallback;
              this.disableFacePickMode();
              if (cb) {
                cb({
                  mesh: hitMesh,
                  faceIndex: faceIndex,
                  materialIndex: materialIndex,
                  point: hit.point
                });
              }
              return;
            }

            let topObj = hitMesh;
            while (topObj.parent && topObj.parent !== this.scene && !this.objects.includes(topObj)) {
              topObj = topObj.parent;
            }
            this.selectObject(topObj);
          }
        });
      }

      setupEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

        const gridHelper = new THREE.GridHelper(20, 20, 0x475569, 0x334155);
        this.scene.add(gridHelper);
        this.helpers.push(gridHelper);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.name = 'Main Key Light';
        const helper = new THREE.DirectionalLightHelper(dirLight, 1);
        this.scene.add(helper);
        this.helpers.push(helper);
        dirLight.userData.helper = helper;
        this.addSceneObject(dirLight);

        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        ambient.name = 'Ambient Fill';
        this.addSceneObject(ambient);
      }

      addSceneObject(obj) {
        this.scene.add(obj);
        this.objects.push(obj);
        this.updateOutliner();
      }

      setLoadingState(text, visible = true) {
        const overlay = document.getElementById('loading-overlay');
        const textEl = document.getElementById('loading-text');
        if (overlay && textEl) {
          if (visible) {
            overlay.classList.remove('hidden', 'pointer-events-none');
            overlay.classList.add('pointer-events-auto');
            textEl.textContent = text;
          } else {
            overlay.classList.add('hidden', 'pointer-events-none');
            overlay.classList.remove('pointer-events-auto');
          }
        }
      }

      updateDiagnostics(text, isError = false) {
        const el = document.getElementById('diagnostics-panel');
        if (!el) return;
        el.classList.remove('hidden');
        if (isError) {
          el.className = 'text-xs text-red-400 mt-3 p-3 bg-slate-950/90 rounded-lg border border-red-500/40 font-mono select-text';
          el.innerHTML = `<strong>ERROR:</strong><br/>${text.replace(/\n/g, '<br/>')}`;
        } else {
          el.className = 'text-xs text-indigo-300 mt-3 p-3 bg-slate-950/90 rounded-lg border border-indigo-500/40 font-mono select-text';
          el.innerHTML = `<strong>Pipeline Log:</strong><br/>${text.replace(/\n/g, '<br/>')}`;
        }
      }

      clearGeneratedMeshes() {
        const toRemove = this.objects.filter((obj) => obj.userData && obj.userData.isGenerated);
        toRemove.forEach((obj) => {
          this.scene.remove(obj);
          this.disposeHierarchy(obj);
          this.objects = this.objects.filter((o) => o !== obj);
        });
        this.selectObject(null);
      }

      disposeHierarchy(node) {
        if (node === this.selectedObject) {
          this.selectObject(null);
        }
        if (node.userData && node.userData.helper) {
          const helper = node.userData.helper;
          this.scene.remove(helper);
          this.helpers = this.helpers.filter((h) => h !== helper);
        }
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      }

      inflateGeometry(geometry, smoothPath, planeW, planeH, w, h, inflationAmount) {
        const posAttr = geometry.attributes.position;
        if (!posAttr || smoothPath.length === 0) return;
        const count = posAttr.count;

        const boundary = smoothPath.map((pt) => new THREE.Vector2(
          (pt.x / (w - 1) - 0.5) * planeW,
          (0.5 - pt.y / (h - 1)) * planeH
        ));

        const n = boundary.length;
        const distances = new Float32Array(count);
        let maxDist = 0;

        for (let i = 0; i < count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          let minDist = Infinity;

          for (let j = 0; j < n; j++) {
            const a = boundary[j];
            const b = boundary[(j + 1) % n];
            const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
            let dist = 0;
            if (l2 === 0) {
              dist = Math.sqrt((vx - a.x) ** 2 + (vy - a.y) ** 2);
            } else {
              let t = ((vx - a.x) * (b.x - a.x) + (vy - a.y) * (b.y - a.y)) / l2;
              t = Math.max(0, Math.min(1, t));
              const projX = a.x + t * (b.x - a.x);
              const projY = a.y + t * (b.y - a.y);
              dist = Math.sqrt((vx - projX) ** 2 + (vy - projY) ** 2);
            }
            if (dist < minDist) minDist = dist;
          }

          distances[i] = minDist;
          if (minDist > maxDist) maxDist = minDist;
        }

        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const maxZ = bbox.max.z;
        const minZ = bbox.min.z;

        for (let i = 0; i < count; i++) {
          const vz = posAttr.getZ(i);
          const normDist = maxDist > 0 ? distances[i] / maxDist : 0;
          const displacement = inflationAmount * Math.sin((normDist * Math.PI) / 2);

          let zNew = vz;
          if (vz > 0.001 && maxZ > 0) {
            zNew = vz + displacement * (vz / maxZ);
          } else if (vz < -0.001 && minZ < 0) {
            zNew = vz - displacement * (vz / minZ);
          }
          posAttr.setZ(i, zNew);
        }

        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();
      }

      // =====================================================================
      // 3D GEOMETRY GENERATION PIPELINE
      // =====================================================================
      async buildIntelligent3D(segResult, selectedArchetype, filename) {
        try {
          this.setLoadingState(`Constructing 3D ${selectedArchetype}...`, true);
          this.updateDiagnostics(`Building 3D Mesh for: [${selectedArchetype}]...`);
          await new Promise((r) => setTimeout(r, 100));

          const { extractedCanvas, maskGrid, segW, segH, origW, origH, edgeHexColor } = segResult;

          const texture = new THREE.CanvasTexture(extractedCanvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;

          const scale = 4.5 / Math.max(origW, origH);
          const planeW = origW * scale;
          const planeH = origH * scale;

          let mesh = null;
          let profileName = 'cotton';

          // -----------------------------------------------------------------
          // ARCHETYPE 1: CYLINDRICAL (Soda Can / Bottle / Mug)
          // -----------------------------------------------------------------
          if (selectedArchetype === 'CYLINDRICAL') {
            profileName = 'metallic';
            const radius = planeW * 0.42;
            const cylinderH = planeH;
            const geometry = new THREE.CylinderGeometry(radius, radius, cylinderH, 64, 8, false);

            const uvAttr = geometry.attributes.uv;
            for (let i = 0; i < uvAttr.count; i++) {
              let u = uvAttr.getX(i);
              let v = uvAttr.getY(i);
              u = ((u + 0.25) % 1.0) * 2.0;
              if (u > 1.0) u = 1.0;
              uvAttr.setXY(i, u, v);
            }
            uvAttr.needsUpdate = true;

            const sideMat = this.fabricMaterialManager.createFabricMaterial({
              map: texture,
              roughness: 0.18,
              metalness: 0.85,
              side: THREE.DoubleSide
            });
            const lidMat = new THREE.MeshStandardMaterial({
              color: 0xd4d4d8,
              roughness: 0.2,
              metalness: 0.95,
              side: THREE.DoubleSide
            });

            const unlitSide = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
            const unlitLid = new THREE.MeshBasicMaterial({ color: 0xd4d4d8, side: THREE.DoubleSide });
            const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, side: THREE.DoubleSide });

            mesh = new THREE.Mesh(geometry, [sideMat, lidMat, lidMat]);
            mesh.name = `Cylinder_${filename}`;
            mesh.userData = {
              isGenerated: true,
              archetype: 'CYLINDRICAL',
              materials: {
                lit: [sideMat, lidMat, lidMat],
                unlit: [unlitSide, unlitLid, unlitLid],
                wireframe: [wireMat, wireMat, wireMat]
              },
              fabricProfile: 'metallic',
              animate: false,
              rotationSpeed: 0.01
            };
          }
          // -----------------------------------------------------------------
          // ARCHETYPE 2: 3D SCREEN / BOXY DEVICE
          // -----------------------------------------------------------------
          else if (selectedArchetype === 'SCREEN_BOXY') {
            profileName = 'gloss';
            const boxD = planeW * 0.12;
            const geometry = new THREE.BoxGeometry(planeW, planeH, boxD);

            const screenMat = this.fabricMaterialManager.createFabricMaterial({
              map: texture,
              roughness: 0.12,
              metalness: 0.1,
              clearcoat: 0.8,
              side: THREE.DoubleSide
            });
            const chassisMat = new THREE.MeshStandardMaterial({
              color: edgeHexColor || 0x18181b,
              roughness: 0.35,
              metalness: 0.8,
              side: THREE.DoubleSide
            });

            const matsLit = [chassisMat, chassisMat, chassisMat, chassisMat, screenMat, chassisMat];
            const unlitScreen = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
            const unlitChassis = new THREE.MeshBasicMaterial({ color: edgeHexColor || 0x18181b, side: THREE.DoubleSide });
            const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, side: THREE.DoubleSide });

            mesh = new THREE.Mesh(geometry, matsLit);
            mesh.name = `Screen_${filename}`;
            mesh.userData = {
              isGenerated: true,
              archetype: 'SCREEN_BOXY',
              extrudeSettings: { depth: boxD },
              materials: {
                lit: matsLit,
                unlit: [unlitChassis, unlitChassis, unlitChassis, unlitChassis, unlitScreen, unlitChassis],
                wireframe: [wireMat, wireMat, wireMat, wireMat, wireMat, wireMat]
              },
              fabricProfile: 'gloss',
              animate: false,
              rotationSpeed: 0.01
            };
          }
          // -----------------------------------------------------------------
          // ARCHETYPES 3, 4, 5: CONTOUR EXTRUSION (GARMENT, ORGANIC, LOGO)
          // -----------------------------------------------------------------
          else {
            const smoothPath = extractRadialContour(maskGrid, segW, segH);
            const baseThickness = planeW * (selectedArchetype === 'LOGO_GRAPHIC' ? 0.09 : 0.14);

            const shape = new THREE.Shape();
            const p0_x = (smoothPath[0].x / (segW - 1) - 0.5) * planeW;
            const p0_y = (0.5 - smoothPath[0].y / (segH - 1)) * planeH;
            shape.moveTo(p0_x, p0_y);

            for (let i = 1; i < smoothPath.length; i++) {
              const px = (smoothPath[i].x / (segW - 1) - 0.5) * planeW;
              const py = (0.5 - smoothPath[i].y / (segH - 1)) * planeH;
              shape.lineTo(px, py);
            }
            shape.closePath();

            const extrudeSettings = {
              depth: baseThickness * 1.2,
              bevelEnabled: true,
              bevelThickness: baseThickness * 0.12,
              bevelSize: baseThickness * 0.12,
              bevelSegments: 3,
              steps: 1,
              curveSegments: 12
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.computeVertexNormals();

            // Center geometry in Z
            geometry.computeBoundingBox();
            const zOffset = -0.5 * (geometry.boundingBox.max.z + geometry.boundingBox.min.z);
            geometry.translate(0, 0, zOffset);

            // Volumetric Inflation for Garments & Organics
            const isVolumetric = selectedArchetype === 'GARMENT_APPAREL' || selectedArchetype === 'ORGANIC_FIGURE';
            if (isVolumetric) {
              const inflationAmt = baseThickness * (selectedArchetype === 'ORGANIC_FIGURE' ? 1.6 : 1.1);
              this.inflateGeometry(geometry, smoothPath, planeW, planeH, segW, segH, inflationAmt);
            }

            // Planar UV Mapping
            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox;
            const bw = bbox.max.x - bbox.min.x;
            const bh = bbox.max.y - bbox.min.y;
            const posAttr = geometry.attributes.position;
            const uvAttr = geometry.attributes.uv;

            if (bw > 0 && bh > 0 && posAttr && uvAttr) {
              for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                uvAttr.setXY(i, (x - bbox.min.x) / bw, (y - bbox.min.y) / bh);
              }
              uvAttr.needsUpdate = true;
            }

            profileName = selectedArchetype === 'ORGANIC_FIGURE'
              ? 'organic'
              : selectedArchetype === 'LOGO_GRAPHIC'
              ? 'metallic'
              : 'cotton';

            const frontMat = this.fabricMaterialManager.createFabricMaterial({
              map: texture,
              roughness: 0.4,
              metalness: 0.1,
              side: THREE.DoubleSide
            });
            const sideMat = this.fabricMaterialManager.createFabricMaterial({
              color: edgeHexColor,
              roughness: 0.5,
              metalness: 0.2,
              side: THREE.DoubleSide
            });
            const backMat = this.fabricMaterialManager.createFabricMaterial({
              map: texture,
              roughness: 0.4,
              metalness: 0.1,
              side: THREE.DoubleSide
            });

            const matsLit = [frontMat, sideMat, backMat];
            matsLit.forEach((mat) => this.fabricMaterialManager.applyProfile(mat, profileName));

            const unlitFront = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
            const unlitSide = new THREE.MeshBasicMaterial({ color: edgeHexColor, side: THREE.DoubleSide });
            const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, side: THREE.DoubleSide });

            mesh = new THREE.Mesh(geometry, matsLit);
            mesh.name = `${selectedArchetype}_${filename}`;
            mesh.userData = {
              isGenerated: true,
              archetype: selectedArchetype,
              isVolumetric,
              smoothPath,
              planeW,
              planeH,
              segW,
              segH,
              baseThickness,
              shape,
              extrudeSettings,
              materials: {
                lit: matsLit,
                unlit: [unlitFront, unlitSide, unlitFront],
                wireframe: [wireMat, wireMat, wireMat]
              },
              fabricProfile: profileName,
              animate: false,
              rotationSpeed: 0.01
            };
          }

          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Position mesh centered on grid
          mesh.geometry.computeBoundingBox();
          const meshBBox = mesh.geometry.boundingBox;
          const heightOffset = (meshBBox.max.y - meshBBox.min.y) / 2;
          mesh.position.set(0, heightOffset, 0);

          this.addSceneObject(mesh);
          this.selectObject(mesh);

          // Focus camera and OrbitControls on the object
          this.orbit.target.set(0, heightOffset, 0);
          this.camera.position.set(0, heightOffset + 1.5, 7.5);
          this.orbit.update();

          this.updateDiagnostics(
            `✅ 3D Model Successfully Created!\n` +
            `Type: ${selectedArchetype}\n` +
            `Vertices: ${mesh.geometry.attributes.position.count}\n` +
            `Profile: ${profileName}\n` +
            `Status: Ready in viewport.`
          );
        } catch (err) {
          console.error('Error during 3D generation:', err);
          this.updateDiagnostics(`3D Generation Error:\n${err.message}`, true);
        } finally {
          this.setLoadingState('Done', false);
        }
      }

      setViewMode(mode) {
        ['lit', 'unlit', 'wire'].forEach((id) => {
          const btn = document.getElementById(`view-${id}`);
          if (btn) {
            if (id === mode) {
              btn.classList.add('bg-indigo-600', 'text-white');
              btn.classList.remove('hover:bg-slate-800', 'text-slate-400');
            } else {
              btn.classList.remove('bg-indigo-600', 'text-white');
              btn.classList.add('hover:bg-slate-800', 'text-slate-400');
            }
          }
        });

        this.objects.forEach((obj) => {
          if (obj.userData?.isGenerated && obj.userData.materials) {
            obj.userData.currentMode = mode;
            if (mode === 'lit' && obj.userData.materials.lit) obj.material = obj.userData.materials.lit;
            if (mode === 'unlit' && obj.userData.materials.unlit) obj.material = obj.userData.materials.unlit;
            if (mode === 'wire' && obj.userData.materials.wireframe) obj.material = obj.userData.materials.wireframe;
          }
        });
      }

      updateSelectedMeshExtrusion(newDepth) {
        const obj = this.selectedObject;
        if (!obj || !obj.isMesh || !obj.userData.isGenerated) return;

        if (obj.userData.shape && obj.userData.extrudeSettings) {
          const updatedSettings = {
            ...obj.userData.extrudeSettings,
            depth: newDepth,
            bevelThickness: newDepth * 0.1,
            bevelSize: newDepth * 0.1
          };

          const newGeom = new THREE.ExtrudeGeometry(obj.userData.shape, updatedSettings);
          newGeom.computeVertexNormals();

          newGeom.computeBoundingBox();
          const zOffset = -0.5 * (newGeom.boundingBox.max.z + newGeom.boundingBox.min.z);
          newGeom.translate(0, 0, zOffset);

          if (obj.userData.isVolumetric) {
            const { smoothPath, planeW, planeH, segW, segH } = obj.userData;
            this.inflateGeometry(newGeom, smoothPath, planeW, planeH, segW, segH, newDepth * 1.2);
          }

          newGeom.computeBoundingBox();
          const bbox = newGeom.boundingBox;
          const bw = bbox.max.x - bbox.min.x;
          const bh = bbox.max.y - bbox.min.y;
          const posAttr = newGeom.attributes.position;
          const uvAttr = newGeom.attributes.uv;
          if (bw > 0 && bh > 0 && posAttr && uvAttr) {
            for (let i = 0; i < posAttr.count; i++) {
              uvAttr.setXY(i, (posAttr.getX(i) - bbox.min.x) / bw, (posAttr.getY(i) - bbox.min.y) / bh);
            }
            uvAttr.needsUpdate = true;
          }

          if (obj.geometry) obj.geometry.dispose();
          obj.geometry = newGeom;
          obj.userData.extrudeSettings = updatedSettings;
        } else if (obj.userData.archetype === 'CYLINDRICAL' || obj.userData.archetype === 'SCREEN_BOXY') {
          obj.scale.z = newDepth;
        }
      }

      selectObject(obj) {
        if (this.selectionHelper) {
          this.scene.remove(this.selectionHelper);
          this.helpers = this.helpers.filter((h) => h !== this.selectionHelper);
          this.selectionHelper = null;
        }

        if (!obj) {
          this.selectedObject = null;
          this.transformControl.detach();
          if (this.characterAnimationManager) {
            this.characterAnimationManager.setupForObject(null);
          }
          this.updateOutliner();
          this.updatePropertiesPanel();
          return;
        }

        this.selectedObject = obj;
        this.transformControl.attach(obj);
        if (obj.isMesh || obj.isGroup) {
          this.selectionHelper = new THREE.BoxHelper(obj, 0x818cf8);
          this.scene.add(this.selectionHelper);
          this.helpers.push(this.selectionHelper);
        }
        if (this.characterAnimationManager) {
          this.characterAnimationManager.setupForObject(obj);
        }
        this.updateOutliner();
        this.updatePropertiesPanel();
      }

      updateOutliner() {
        const list = document.getElementById('outliner-list');
        if (!list) return;
        list.innerHTML = '';

        this.objects.forEach((obj) => {
          const li = document.createElement('li');
          li.className = `px-3 py-2 rounded text-xs flex justify-between items-center cursor-pointer transition-colors ${
            obj === this.selectedObject ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40' : 'hover:bg-slate-700/50 text-slate-300'
          }`;

          const nameSpan = document.createElement('span');
          nameSpan.textContent = obj.name || obj.type;

          const delBtn = document.createElement('button');
          delBtn.innerHTML = '✕';
          delBtn.className = 'text-slate-500 hover:text-red-400 px-1';
          delBtn.onclick = (e) => {
            e.stopPropagation();
            this.scene.remove(obj);
            this.disposeHierarchy(obj);
            this.objects = this.objects.filter((o) => o !== obj);
            this.selectObject(null);
          };

          li.appendChild(nameSpan);
          li.appendChild(delBtn);
          li.onclick = () => this.selectObject(obj);
          list.appendChild(li);
        });
      }

      updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        const info = document.getElementById('selection-info');
        const lightProps = document.getElementById('light-props');
        const meshProps = document.getElementById('mesh-props');
        const extrusionProps = document.getElementById('extrusion-props');
        const videoProps = document.getElementById('video-props');
        const webglControls = document.getElementById('webgl-video-controls');
        const css3dControls = document.getElementById('css3d-video-controls');
        const videoBadge = document.getElementById('video-type-badge');

        if (!this.selectedObject) {
          if (panel) panel.classList.add('hidden');
          if (info) info.textContent = 'Nothing selected';
          if (this.characterAnimationManager) {
            this.characterAnimationManager.setupForObject(null);
          }
          return;
        }

        if (panel) panel.classList.remove('hidden');
        if (info) info.textContent = this.selectedObject.name || this.selectedObject.type;

        this.syncPropertiesPanel();

        if (this.characterAnimationManager) {
          this.characterAnimationManager.setupForObject(this.selectedObject);
        }

        if (lightProps) lightProps.classList.add('hidden');
        if (meshProps) meshProps.classList.add('hidden');
        if (extrusionProps) extrusionProps.classList.add('hidden');
        if (videoProps) videoProps.classList.add('hidden');

        let videoOwner = null;
        if (this.selectedObject.userData?.hasVideo || this.selectedObject.userData?.isCSS3D) {
          videoOwner = this.selectedObject;
        } else if (this.selectedObject.traverse) {
          this.selectedObject.traverse((child) => {
            if (!videoOwner && (child.userData?.hasVideo || child.userData?.isCSS3D)) {
              videoOwner = child;
            }
          });
        }

        if (videoOwner) {
          if (videoProps) videoProps.classList.remove('hidden');

          const meshLabel = document.getElementById('video-target-mesh-name');
          if (meshLabel) meshLabel.textContent = videoOwner.name || 'Selected Mesh';

          if (videoOwner.userData?.isCSS3D) {
            if (videoBadge) videoBadge.textContent = 'CSS3D YouTube';
            if (webglControls) webglControls.classList.add('hidden');
            if (css3dControls) css3dControls.classList.remove('hidden');
          } else if (videoOwner.userData?.hasVideo) {
            if (videoBadge) videoBadge.textContent = 'WebGL Texture';
            if (webglControls) webglControls.classList.remove('hidden');
            if (css3dControls) css3dControls.classList.add('hidden');

            const videoEl = videoOwner.userData.videoEl;
            if (videoEl) {
              const muteBtn = document.getElementById('btn-video-mute-text');
              if (muteBtn) muteBtn.textContent = videoEl.muted ? 'Unmute' : 'Mute';
              const playBtn = document.getElementById('btn-video-play-text');
              if (playBtn) playBtn.textContent = videoEl.paused ? 'Play' : 'Pause';
            }

            const slotSelect = document.getElementById('video-slot-select');
            if (slotSelect) {
              slotSelect.innerHTML = '';
              const slots = this.getMaterialSlotsForMesh(videoOwner);
              slots.forEach((s) => {
                const opt = document.createElement('option');
                opt.value = s.index;
                opt.textContent = `${s.name} ${s.hasVideo ? '★ (Active Video)' : ''}`;
                slotSelect.appendChild(opt);
              });
              slotSelect.value = videoOwner.userData?.videoTargetMaterialIndex ?? 0;
            }
          }
        }

        if (this.selectedObject.isLight && lightProps) {
          lightProps.classList.remove('hidden');
          document.getElementById('light-color').value = '#' + this.selectedObject.color.getHexString();
          document.getElementById('light-intensity').value = this.selectedObject.intensity;
          document.getElementById('intensity-val').textContent = this.selectedObject.intensity.toFixed(2);
        }

        if (this.selectedObject.isMesh || this.selectedObject.isGroup || this.selectedObject.userData?.isImported3D) {
          if (meshProps) {
            meshProps.classList.remove('hidden');
            document.getElementById('anim-toggle').checked = this.selectedObject.userData.animate || false;
            document.getElementById('anim-speed').value = this.selectedObject.userData.rotationSpeed || 0.01;
          }

          if (extrusionProps) {
            extrusionProps.classList.remove('hidden');
            const depth = this.selectedObject.userData.extrudeSettings?.depth || this.selectedObject.scale.z || 1.0;
            document.getElementById('extrusion-amount').value = depth;
            document.getElementById('extrusion-val').textContent = depth.toFixed(2);

            const profileSelect = document.getElementById('fabric-profile-select');
            if (profileSelect) {
              profileSelect.value = this.selectedObject.userData.fabricProfile || 'cotton';
            }
          }
        }
      }

      syncPropertiesPanel() {
        if (!this.selectedObject) return;
        const obj = this.selectedObject;
        document.querySelectorAll('.prop-input').forEach((input) => {
          const prop = input.dataset.prop;
          const axis = input.dataset.axis;
          if (obj[prop] && obj[prop][axis] !== undefined) {
            input.value = obj[prop][axis].toFixed(2);
          }
        });
      }

      setupEventListeners() {
        document.getElementById('btn-clear-scene')?.addEventListener('click', () => {
          this.clearGeneratedMeshes();
        });

        document.getElementById('view-lit')?.addEventListener('click', () => this.setViewMode('lit'));
        document.getElementById('view-unlit')?.addEventListener('click', () => this.setViewMode('unlit'));
        document.getElementById('view-wire')?.addEventListener('click', () => this.setViewMode('wire'));

        this.keydownHandler = (e) => {
          if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
          if (e.key.toLowerCase() === 'w') { this.transformControl.setMode('translate'); this.updateGizmoBtns('translate'); }
          if (e.key.toLowerCase() === 'e') { this.transformControl.setMode('rotate'); this.updateGizmoBtns('rotate'); }
          if (e.key.toLowerCase() === 'r') { this.transformControl.setMode('scale'); this.updateGizmoBtns('scale'); }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedObject) {
              const obj = this.selectedObject;
              this.scene.remove(obj);
              this.disposeHierarchy(obj);
              this.objects = this.objects.filter((o) => o !== obj);
              this.selectObject(null);
            }
          }
        };
        window.addEventListener('keydown', this.keydownHandler);

        document.querySelectorAll('.gizmo-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.mode;
            this.transformControl.setMode(mode);
            this.updateGizmoBtns(mode);
          });
        });

        document.querySelectorAll('.prop-input').forEach((input) => {
          input.addEventListener('change', (e) => {
            if (!this.selectedObject) return;
            const prop = e.target.dataset.prop;
            const axis = e.target.dataset.axis;
            this.selectedObject[prop][axis] = parseFloat(e.target.value);
          });
        });

        document.getElementById('light-color')?.addEventListener('input', (e) => {
          if (this.selectedObject?.isLight) this.selectedObject.color.set(e.target.value);
        });

        document.getElementById('light-intensity')?.addEventListener('input', (e) => {
          if (this.selectedObject?.isLight) {
            const val = parseFloat(e.target.value);
            this.selectedObject.intensity = val;
            document.getElementById('intensity-val').textContent = val.toFixed(2);
          }
        });

        document.getElementById('anim-toggle')?.addEventListener('change', (e) => {
          if (this.selectedObject) this.selectedObject.userData.animate = e.target.checked;
        });

        document.getElementById('anim-speed')?.addEventListener('input', (e) => {
          if (this.selectedObject) this.selectedObject.userData.rotationSpeed = parseFloat(e.target.value);
        });

        document.getElementById('extrusion-amount')?.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          document.getElementById('extrusion-val').textContent = val.toFixed(2);
          this.updateSelectedMeshExtrusion(val);
        });

        document.getElementById('fabric-profile-select')?.addEventListener('change', (e) => {
          const obj = this.selectedObject;
          if (!obj) return;
          const val = e.target.value;
          obj.userData.fabricProfile = val;
          if (obj.userData?.materials?.lit) {
            obj.userData.materials.lit.forEach((mat) => {
              this.fabricMaterialManager.applyProfile(mat, val);
            });
          }
          obj.traverse((node) => {
            if (node.isMesh && node.material) {
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((m) => this.fabricMaterialManager.applyProfile(m, val));
            }
          });
          this.updateDiagnostics(`Applied "${val}" PBR profile to "${obj.name}".`);
        });

        document.getElementById('color-front')?.addEventListener('input', (e) => {
          const obj = this.selectedObject;
          if (obj?.isMesh && obj.userData?.materials?.lit?.[0]) {
            obj.userData.materials.lit[0].color.set(e.target.value);
          }
        });

        document.getElementById('color-side')?.addEventListener('input', (e) => {
          const obj = this.selectedObject;
          if (obj?.isMesh && obj.userData?.materials?.lit?.[1]) {
            obj.userData.materials.lit[1].color.set(e.target.value);
          }
        });

        document.getElementById('color-back')?.addEventListener('input', (e) => {
          const obj = this.selectedObject;
          if (obj?.isMesh && obj.userData?.materials?.lit?.[2]) {
            obj.userData.materials.lit[2].color.set(e.target.value);
          }
        });

        document.getElementById('btn-video-play-toggle')?.addEventListener('click', () => {
          const obj = this.selectedObject;
          const video = obj?.userData?.videoEl;
          if (video) {
            if (video.paused) {
              video.play();
            } else {
              video.pause();
            }
            this.updatePropertiesPanel();
          }
        });

        document.getElementById('btn-video-mute-toggle')?.addEventListener('click', () => {
          const obj = this.selectedObject;
          const video = obj?.userData?.videoEl;
          if (video) {
            video.muted = !video.muted;
            this.updatePropertiesPanel();
          }
        });

        document.getElementById('video-emissive-slider')?.addEventListener('input', (e) => {
          const obj = this.selectedObject;
          const val = parseFloat(e.target.value);
          document.getElementById('video-emissive-val').textContent = val.toFixed(2);
          if (obj?.isMesh) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            const targetSlot = obj.userData?.videoTargetMaterialIndex;
            mats.forEach((m, idx) => {
              if (m.emissive && (targetSlot === undefined || idx === targetSlot || m.userData?.hasVideo)) {
                m.emissiveIntensity = val;
              }
            });
          }
        });

        document.getElementById('video-slot-select')?.addEventListener('change', (e) => {
          const slot = parseInt(e.target.value, 10);
          this.videoDisplayManager.switchVideoTargetSlot(this.selectedObject, slot);
        });

        document.getElementById('btn-remove-video-layer')?.addEventListener('click', () => {
          this.videoDisplayManager.removeVideoFromMesh(this.selectedObject);
        });

        document.getElementById('btn-add-light')?.addEventListener('click', () => {
          const light = new THREE.PointLight(0xffffff, 2, 50);
          light.position.set(0, 3, 3);
          light.name = `Point Light ${this.objects.filter((o) => o.isLight).length + 1}`;
          const helper = new THREE.PointLightHelper(light, 0.5);
          this.scene.add(helper);
          this.helpers.push(helper);
          light.userData.helper = helper;
          this.addSceneObject(light);
          this.selectObject(light);
        });
      }

      updateGizmoBtns(mode) {
        document.querySelectorAll('.gizmo-btn').forEach((b) => {
          b.classList.toggle('bg-indigo-600', b.dataset.mode === mode);
          b.classList.toggle('text-white', b.dataset.mode === mode);
        });
      }

      async import3DModelFile(file) {
        if (!file) return;
        const filename = file.name;
        const ext = filename.split('.').pop().toLowerCase();

        this.setLoadingState(`Importing 3D Model: ${filename}...`, true);
        this.updateDiagnostics(`Ingesting 3D asset "${filename}" [${ext.toUpperCase()}]...`);

        try {
          const arrayBuffer = await file.arrayBuffer();
          let loadedObject = null;

          if (ext === 'glb' || ext === 'gltf') {
            const gltfLoader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            gltfLoader.setDRACOLoader(dracoLoader);

            const gltf = await new Promise((resolve, reject) => {
              gltfLoader.parse(arrayBuffer, '', resolve, reject);
            });
            loadedObject = gltf.scene || gltf.scenes[0];
            if (gltf.animations && gltf.animations.length > 0) {
              loadedObject.userData.animations = gltf.animations;
              loadedObject.animations = gltf.animations;
            }
          } else if (ext === 'obj') {
            const text = new TextDecoder().decode(arrayBuffer);
            const objLoader = new OBJLoader();
            loadedObject = objLoader.parse(text);
          } else if (ext === 'fbx') {
            const fbxLoader = new FBXLoader();
            loadedObject = fbxLoader.parse(arrayBuffer, '');
            if (loadedObject.animations && loadedObject.animations.length > 0) {
              loadedObject.userData.animations = loadedObject.animations;
            }
          } else if (ext === 'stl') {
            const stlLoader = new STLLoader();
            const geometry = stlLoader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
              color: 0xd4d4d8,
              roughness: 0.5,
              metalness: 0.1,
              side: THREE.DoubleSide
            });
            loadedObject = new THREE.Mesh(geometry, material);
          } else if (ext === 'ply') {
            const plyLoader = new PLYLoader();
            const geometry = plyLoader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
              color: 0xd4d4d8,
              roughness: 0.5,
              metalness: 0.1,
              side: THREE.DoubleSide
            });
            loadedObject = new THREE.Mesh(geometry, material);
          } else if (ext === 'dae') {
            const text = new TextDecoder().decode(arrayBuffer);
            const colladaLoader = new ColladaLoader();
            const collada = colladaLoader.parse(text, '');
            loadedObject = collada.scene;
          } else {
            throw new Error(`Unsupported 3D file format: .${ext}. Supported formats: .glb, .gltf, .obj, .fbx, .stl, .ply, .dae`);
          }

          if (!loadedObject) {
            throw new Error(`Failed to parse 3D file "${filename}".`);
          }

          loadedObject.name = filename.replace(/\.[^/.]+$/, '');

          // Setup shadows and standard double-sided materials
          const meshes = [];
          loadedObject.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              meshes.push(node);

              if (node.material) {
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach((m) => {
                  m.side = THREE.DoubleSide;
                  if (m.type === 'MeshBasicMaterial' || m.type === 'MeshLambertMaterial' || m.type === 'MeshPhongMaterial') {
                    const stdMat = new THREE.MeshStandardMaterial({
                      color: m.color || new THREE.Color(0xffffff),
                      map: m.map || null,
                      roughness: 0.5,
                      metalness: 0.1,
                      side: THREE.DoubleSide
                    });
                    if (Array.isArray(node.material)) {
                      node.material = node.material.map((mat) => (mat === m ? stdMat : mat));
                    } else {
                      node.material = stdMat;
                    }
                  }
                });
              }
            }
          });

          // Auto-scale and center in the studio scene
          const bbox = new THREE.Box3().setFromObject(loadedObject);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          bbox.getSize(size);
          bbox.getCenter(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0.0001) {
            const targetSize = 4.0;
            const scaleFactor = targetSize / maxDim;
            loadedObject.scale.multiplyScalar(scaleFactor);

            // Re-calculate after scaling
            bbox.setFromObject(loadedObject);
            bbox.getCenter(center);
            loadedObject.position.x -= center.x;
            loadedObject.position.y -= bbox.min.y; // Place bottom flush with ground grid (y=0)
            loadedObject.position.z -= center.z;
          }

          // If there are already objects in the scene, apply a stagger offset so models don't occlude each other
          const existingModels = this.objects.filter((o) => (o.isMesh || o.isGroup) && !o.isLight && !o.isHelper);
          if (existingModels.length > 0) {
            const count = existingModels.length;
            const sign = count % 2 === 1 ? 1 : -1;
            const mult = Math.ceil(count / 2);
            loadedObject.position.x += sign * mult * 2.8;
          }

          loadedObject.userData = {
            ...loadedObject.userData,
            isGenerated: true,
            isImported3D: true,
            filename: filename,
            originalFormat: ext,
            animate: false,
            rotationSpeed: 0.01,
            fabricProfile: 'cotton'
          };

          this.addSceneObject(loadedObject);
          this.selectObject(loadedObject);
          if (this.characterAnimationManager) {
            this.characterAnimationManager.setupForObject(loadedObject);
          }
          this.updateDiagnostics(`Successfully imported "${filename}" (${meshes.length} mesh part${meshes.length === 1 ? '' : 's'}). Ready for PBR editing, video texture layering, and .GLB export.`);
        } catch (err) {
          console.error('3D import error:', err);
          this.updateDiagnostics(`Failed to import "${filename}": ${err.message}`, true);
          alert(`Failed to import 3D file "${filename}":\n${err.message}`);
        } finally {
          this.setLoadingState('', false);
        }
      }

      async import3DModelFromUrl(url, filename = '', meta = {}) {
        if (!url) return;
        let targetUrl = url;

        // Auto-wrap Tripo3D, CloudFront, or other non-CORS CDNs with our CORS-safe proxy
        if (
          typeof targetUrl === 'string' &&
          (targetUrl.includes('tripo3d.com') || targetUrl.includes('tripo-data') || targetUrl.includes('3daistudio.com')) &&
          !targetUrl.includes('/api-asset-proxy') &&
          !targetUrl.includes('/api-tripo-download')
        ) {
          targetUrl = `/api-asset-proxy?url=${encodeURIComponent(targetUrl)}`;
        }

        let fname = filename;
        if (!fname) {
          const rawLast = targetUrl.split('?')[0].split('/').pop();
          fname = rawLast || 'model.glb';
        }

        // Ensure valid 3D extension for three.js loader dispatch
        let ext = fname.split('.').pop().toLowerCase();
        const valid3DExts = ['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', 'dae'];
        if (!valid3DExts.includes(ext)) {
          fname = `${fname.replace(/\.[^/.]+$/, '')}.glb`;
          ext = 'glb';
        }

        this.setLoadingState(`Loading 3D Template: ${meta.cleanName || fname}...`, true);
        this.updateDiagnostics(`Fetching 3D mesh template "${meta.cleanName || fname}" [${ext.toUpperCase()}]...`);

        try {
          const res = await fetch(targetUrl);
          if (!res.ok) {
            throw new Error(`Failed to load asset from URL (HTTP ${res.status})`);
          }
          const arrayBuffer = await res.arrayBuffer();
          const file = new File([arrayBuffer], fname, {
            type: ext === 'glb' ? 'model/gltf-binary' : 'application/octet-stream'
          });

          await this.import3DModelFile(file);

          if (this.selectedObject) {
            this.selectedObject.userData.isTemplate = true;
            this.selectedObject.userData.templateMeta = meta;
            if (meta.cleanName) {
              this.selectedObject.name = meta.cleanName;
              this.updateOutliner();
              this.updatePropertiesPanel();
            }
          }
          this.updateDiagnostics(`Successfully added template "${meta.cleanName || fname}" to scene.`);
        } catch (err) {
          console.error('Template loading error:', err);
          this.updateDiagnostics(`Failed to load template "${fname}": ${err.message}`, true);
          alert(`Failed to load 3D template "${fname}":\n${err.message}`);
        } finally {
          this.setLoadingState('', false);
        }
      }

      prepareMeshForExport(obj) {
        if (!obj || obj.isLight || obj.isHelper) return null;

        const sanitizeMaterial = (m) => {
          if (!m) return new THREE.MeshStandardMaterial({ color: 0x888888 });
          const cm = m.clone();
          // Snapshot dynamic video textures into static canvas textures for GLTF export
          if (cm.map && (cm.map.isVideoTexture || (cm.map.image && typeof cm.map.image.play === 'function'))) {
            const video = cm.map.image;
            if (video && (video.videoWidth || video.width)) {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || video.width || 512;
              canvas.height = video.videoHeight || video.height || 512;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const staticTex = new THREE.CanvasTexture(canvas);
              staticTex.colorSpace = THREE.SRGBColorSpace;
              cm.map = staticTex;
              if (cm.emissiveMap) cm.emissiveMap = staticTex;
            }
          }
          return cm;
        };

        // Check if object is a rigged humanoid or contains skinned meshes/skeletons
        let containsSkinned = obj.isSkinnedMesh || !!(obj.userData?.isHumanoidRigged || obj.userData?.skeleton);
        if (!containsSkinned && obj.traverse) {
          obj.traverse((n) => { if (n.isSkinnedMesh) containsSkinned = true; });
        }

        if (containsSkinned) {
          try {
            const clonedRig = SkeletonUtils.clone(obj);
            clonedRig.name = obj.name || 'Exported_Character';
            clonedRig.position.copy(obj.position);
            clonedRig.quaternion.copy(obj.quaternion);
            clonedRig.scale.copy(obj.scale);
            clonedRig.userData = { ...obj.userData };
            clonedRig.traverse((child) => {
              if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material = child.material.map(sanitizeMaterial);
                } else {
                  child.material = sanitizeMaterial(child.material);
                }
              }
            });
            return clonedRig;
          } catch (cloneErr) {
            console.warn('SkeletonUtils clone fallback notice:', cloneErr);
          }
        }

        // If obj is a single Mesh
        if (obj.isMesh && obj.geometry) {
          const cloneGeom = obj.geometry.clone();
          let cloneMat = null;

          let srcMat = (obj.userData?.isGenerated && obj.userData.materials?.lit)
            ? obj.userData.materials.lit
            : obj.material;

          if (Array.isArray(srcMat)) {
            const clonedMats = srcMat.map(sanitizeMaterial);
            if (!cloneGeom.groups || cloneGeom.groups.length === 0) {
              cloneMat = clonedMats[0] || new THREE.MeshStandardMaterial();
            } else {
              let maxIndex = 0;
              cloneGeom.groups.forEach((g) => {
                if (typeof g.materialIndex === 'number' && g.materialIndex > maxIndex) {
                  maxIndex = g.materialIndex;
                }
              });
              while (clonedMats.length <= maxIndex) {
                const fallback = clonedMats[0] ? clonedMats[0].clone() : new THREE.MeshStandardMaterial();
                clonedMats.push(fallback);
              }
              cloneMat = clonedMats;
            }
          } else if (srcMat) {
            cloneMat = sanitizeMaterial(srcMat);
            if (cloneGeom.groups && cloneGeom.groups.length > 0) {
              cloneGeom.groups.forEach((g) => {
                g.materialIndex = 0;
              });
            }
          } else {
            cloneMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          }

          const isCSS3D = !!(obj.userData?.isCSS3D || obj.userData?.archetype === 'CSS3D_YOUTUBE');
          const videoId = obj.userData?.videoId || obj.userData?.youtubeId || '';
          const videoSrc = obj.userData?.videoEl?.src || obj.userData?.videoUrl || (obj.material?.map?.image?.src || '') || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
          const hasVideo = !!(obj.userData?.hasVideo || videoSrc || obj.userData?.videoTexture || isCSS3D || videoId);
          const aspectRatio = obj.userData?.aspectRatio || '16:9';
          const frameStyle = obj.userData?.frameStyle || 'cyber_bezel';

          if (hasVideo && (videoSrc || videoId)) {
            const targetSlot = typeof obj.userData?.videoTargetMaterialIndex === 'number'
              ? obj.userData.videoTargetMaterialIndex
              : 0;

            const extraUserData = {
              hasVideo: true,
              videoUrl: videoSrc,
              videoSrc: videoSrc,
              isVideoLayer: true,
              isCSS3D: isCSS3D,
              videoId: videoId,
              youtubeId: videoId,
              aspectRatio: aspectRatio,
              frameStyle: frameStyle
            };

            if (Array.isArray(cloneMat)) {
              if (cloneMat[targetSlot]) {
                cloneMat[targetSlot].userData = {
                  ...cloneMat[targetSlot].userData,
                  ...extraUserData
                };
              }
            } else if (cloneMat) {
              cloneMat.userData = {
                ...cloneMat.userData,
                ...extraUserData
              };
            }
          }

          const cloneMesh = new THREE.Mesh(cloneGeom, cloneMat);
          cloneMesh.name = obj.name || 'Exported_Mesh';
          cloneMesh.position.copy(obj.position);
          cloneMesh.quaternion.copy(obj.quaternion);
          cloneMesh.scale.copy(obj.scale);
          cloneMesh.userData = {
            isGenerated: true,
            hasVideo: hasVideo,
            videoUrl: hasVideo ? videoSrc : '',
            videoSrc: hasVideo ? videoSrc : '',
            isCSS3D: isCSS3D,
            videoId: videoId,
            youtubeId: videoId,
            aspectRatio: aspectRatio,
            frameStyle: frameStyle,
            videoTargetMaterialIndex: typeof obj.userData?.videoTargetMaterialIndex === 'number' ? obj.userData.videoTargetMaterialIndex : 0,
            archetype: isCSS3D ? 'CSS3D_YOUTUBE' : (obj.userData?.archetype || 'STANDARD')
          };
          return cloneMesh;
        }

        // If obj is a Group or Object3D with children (e.g. from imported GLB/OBJ/FBX)
        if (obj.children && obj.children.length > 0) {
          const cloneGroup = new THREE.Group();
          cloneGroup.name = obj.name || 'Exported_Group';
          cloneGroup.position.copy(obj.position);
          cloneGroup.quaternion.copy(obj.quaternion);
          cloneGroup.scale.copy(obj.scale);
          const { hasVideo, videoUrl, videoSrc, iframe, cssObject, ...safeUserData } = obj.userData || {};
          cloneGroup.userData = safeUserData;

          obj.children.forEach((child) => {
            const preparedChild = this.prepareMeshForExport(child);
            if (preparedChild) {
              cloneGroup.add(preparedChild);
            }
          });

          if (cloneGroup.children.length > 0) {
            return cloneGroup;
          }
        }

        return null;
      }

      async exportGLTF() {
        if (this.isExporting) return;
        this.isExporting = true;
        this.updateDiagnostics('Preparing 3D scene, character armature & animations for export...');

        // 1. Upload any local video files (from root or child submeshes) to Firebase Storage
        const videoObjectsToUpload = [];
        this.objects.forEach((topObj) => {
          if (topObj.userData?.hasVideo || topObj.userData?.videoFile) {
            videoObjectsToUpload.push(topObj);
          }
          topObj.traverse?.((child) => {
            if (child !== topObj && (child.userData?.hasVideo || child.userData?.videoFile)) {
              videoObjectsToUpload.push(child);
            }
          });
        });

        for (const obj of videoObjectsToUpload) {
          const file = obj.userData.videoFile;
          const currentSrc = obj.userData.videoUrl || obj.userData.videoEl?.src || '';
          if (file && (currentSrc.startsWith('blob:') || !currentSrc.startsWith('http'))) {
            try {
              this.updateDiagnostics(`Uploading video layer "${file.name || 'video.mp4'}" to Cloud Storage...`);
              const videoStorageRef = ref(storage, `studio_videos/${Date.now()}_${file.name || 'video.mp4'}`);
              await uploadBytes(videoStorageRef, file);
              const cloudUrl = await getDownloadURL(videoStorageRef);
              obj.userData.videoUrl = cloudUrl;
              obj.userData.videoSrc = cloudUrl;
              this.updateDiagnostics(`Video layer uploaded successfully to Cloud Storage.`);
            } catch (uploadErr) {
              console.warn('Video cloud upload warning during export:', uploadErr);
            }
          }
        }

        const exporter = new GLTFExporter();
        const exportScene = new THREE.Scene();

        this.objects.forEach((obj) => {
          if (obj.isLight || obj.isHelper) return;
          const exportedMesh = this.prepareMeshForExport(obj);
          if (exportedMesh) {
            exportScene.add(exportedMesh);
          }
        });

        // Collect all animations from scene objects and animation manager
        const allClips = [];
        this.objects.forEach((obj) => {
          const clips = obj.userData?.animations || obj.animations;
          if (clips && Array.isArray(clips)) {
            clips.forEach((c) => {
              if (!allClips.some((existing) => existing.name === c.name)) {
                allClips.push(c);
              }
            });
          }
        });
        if (this.characterAnimationManager) {
          const activeClips = this.characterAnimationManager.getActiveClips();
          activeClips.forEach((c) => {
            if (!allClips.some((existing) => existing.name === c.name)) {
              allClips.push(c);
            }
          });
        }

        exporter.parse(
          exportScene,
          (gltf) => {
            try {
              const blob = new Blob([gltf], { type: 'model/gltf-binary' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.style.display = 'none';
              link.href = url;
              link.download = 'Studio_Export.glb';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              this.updateDiagnostics(`GLB Export complete with ${allClips.length} animation cycle${allClips.length === 1 ? '' : 's'} and armature embedded.`);
            } finally {
              this.isExporting = false;
            }
          },
          (err) => {
            this.isExporting = false;
            console.error('Export error:', err);
            alert('An error occurred during export.');
          },
          { binary: true, embedImages: true, animations: allClips }
        );
      }

      animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        if (this.orbit) this.orbit.update();
        const delta = this.clock ? this.clock.getDelta() : 0.016;
        if (this.characterAnimationManager) {
          this.characterAnimationManager.update(delta);
        }
        this.objects.forEach((obj) => {
          if (obj.userData?.isGenerated && obj.userData.animate) {
            obj.rotation.y += obj.userData.rotationSpeed || 0.01;
          }
        });
        this.helpers.forEach((h) => { if (h.update) h.update(); });
        this.renderer.render(this.scene, this.camera);
        if (this.videoDisplayManager) {
          this.videoDisplayManager.update();
          this.videoDisplayManager.render(this.camera);
        }
      }

      destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
        if (this.orbit) this.orbit.dispose();
        if (this.transformControl) this.transformControl.dispose();
        if (this.videoDisplayManager) this.videoDisplayManager.destroy();
        if (this.characterAnimationManager) this.characterAnimationManager.destroy();
        this.objects.forEach((obj) => this.disposeHierarchy(obj));
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();
      }
    }

    const app = new StudioApp();
    appRef.current = app;

    return () => {
      appRef.current = null;
      app.destroy();
    };
  }, []);

  // File Handling Handlers
  const handleProcessIncomingFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (appRef.current) {
      appRef.current.setLoadingState('Analyzing Image & Extracting Foreground...', true);
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => { img.onload = resolve; });

    const segResult = extractForegroundAndClassify(img);
    if (appRef.current) {
      appRef.current.setLoadingState('Done', false);
    }

    setThreeDAIModalData({
      file,
      segResult
    });

    try {
      const storageRef = ref(storage, `ai-uploads/${Date.now()}_${file.name}`);
      uploadBytes(storageRef, file).catch(() => {});
    } catch {
      // Optional background upload
    }
  };

  const handleProcessIncoming3DFile = (file) => {
    if (!file || !appRef.current) return;
    appRef.current.import3DModelFile(file);
  };

  const handleSelectTemplate = async (template) => {
    if (!template || !appRef.current) return;
    setLoadingTemplateId(template.id);
    try {
      await appRef.current.import3DModelFromUrl(template.url, template.filename, template);
      setRecentlyAddedId(template.id);
      setTimeout(() => setRecentlyAddedId(null), 3500);
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const handleIncomingAnyFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const modelExts = ['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', 'dae'];
    if (modelExts.includes(ext)) {
      handleProcessIncoming3DFile(file);
    } else if (file.type.startsWith('image/')) {
      handleProcessIncomingFile(file);
    } else if (file.type.startsWith('video/')) {
      openVideoIngestionModal();
    }
  };

  const handleTriggerCloudRigging = () => {
    if (!appRef.current?.selectedObject) {
      alert('Please select a 3D humanoid model in the viewport or outliner to rig.');
      return;
    }
    setCloudRigError('');
    setCloudRigStep('');
    setCloudRigModalOpen(true);
  };

  const handleRunCloudRigging = async () => {
    if (!appRef.current?.selectedObject) return;
    const selectedObj = appRef.current.selectedObject;
    const key = (cloudRigApiKey || DEFAULT_TRIPO_KEY).trim();
    if (!key) {
      setCloudRigError('Please enter a valid Tripo3D API key.');
      return;
    }

    setIsCloudRigging(true);
    setCloudRigError('');
    setCloudRigStep('Preparing 3D model for Tripo3D rigging...');

    try {
      let originalTaskId = selectedObj.userData?.tripoTaskId;

      if (!originalTaskId) {
        setCloudRigStep('Packaging 3D model binary & uploading to Tripo AI cluster...');
        const exporter = new GLTFExporter();
        const exportScene = new THREE.Scene();
        const prep = appRef.current.prepareMeshForExport(selectedObj);
        if (prep) exportScene.add(prep);

        const glbBlob = await new Promise((resolve, reject) => {
          exporter.parse(
            exportScene,
            (res) => resolve(new Blob([res], { type: 'model/gltf-binary' })),
            reject,
            { binary: true, embedImages: true }
          );
        });

        const file = new File([glbBlob], `${selectedObj.name || 'humanoid'}.glb`, { type: 'model/gltf-binary' });
        const uploadRes = await uploadFileToTripo({ apiKey: key, file, onProgress: ({ message }) => setCloudRigStep(message) });

        const taskEndpoint = resolveTripoEndpoint('/v2/openapi/task');
        const taskRes = await fetch(taskEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            type: 'convert_model',
            file: { type: 'glb', file_token: uploadRes.fileToken }
          })
        });

        if (taskRes.ok) {
          const tJson = await taskRes.json();
          originalTaskId = tJson.data?.task_id || tJson.task_id;
        }
      }

      if (!originalTaskId) {
        throw new Error('Could not obtain a Tripo task ID. Tip: You can also use the instant client-side "Auto-Rig Humanoid Armature" button for 1-click offline rigging with zero wait time.');
      }

      setCloudRigStep('Rigging humanoid skeleton in Tripo AI cluster...');
      const { glbUrl: riggedGlbUrl, rigTaskId } = await rigModelWithTripo({
        apiKey: key,
        originalModelTaskId: originalTaskId,
        rigType: 'biped',
        spec: cloudRigSpec,
        onProgress: ({ message }) => setCloudRigStep(message)
      });

      setCloudRigStep(`Retargeting character motion preset "${cloudRigPreset}"...`);
      const animatedGlbUrl = await retargetModelWithTripo({
        apiKey: key,
        rigTaskId,
        preset: cloudRigPreset,
        onProgress: ({ message }) => setCloudRigStep(message)
      });

      setCloudRigStep('Downloading rigged and animated .GLB into Studio...');
      await appRef.current.import3DModelFromUrl(animatedGlbUrl, `${selectedObj.name}_Rigged.glb`, {
        cleanName: `${selectedObj.name} (AI Rigged)`,
        isRigged: true
      });

      setCloudRigModalOpen(false);
      appRef.current.updateDiagnostics(`Successfully rigged and animated "${selectedObj.name}" via Tripo3D AI!`);
    } catch (err) {
      console.error('Cloud rigging error:', err);
      setCloudRigError(err.message || 'Cloud rigging failed.');
    } finally {
      setIsCloudRigging(false);
    }
  };


  return (
    <div className="bg-slate-900 text-slate-200 h-screen flex flex-col md:flex-row overflow-hidden relative font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .studio-scroll::-webkit-scrollbar { width: 6px; }
            .studio-scroll::-webkit-scrollbar-track { background: #0f172a; }
            .studio-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            .studio-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }
          `
        }}
      />

      {/* Hidden 2D Image File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleProcessIncomingFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden 3D Object / Model File Input */}
      <input
        type="file"
        ref={model3DInputRef}
        className="hidden"
        accept=".glb,.gltf,.obj,.fbx,.stl,.ply,.dae"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleProcessIncoming3DFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Left Panel: Outliner & Ingestion */}
      <div className="ui-panel w-full md:w-80 bg-slate-900/95 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-indigo-400">deployed_code</span>
            Studio 4D*4
          </h1>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
            v2.0 AI
          </span>
        </div>

        <div className="p-4 border-b border-slate-800 space-y-3">
          <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
            Media Ingestion & Displays
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTemplateDrawerOpen(true);
                setTemplateBrowserMode('drawer');
              }}
              className="p-2.5 border border-fuchsia-500/40 hover:border-fuchsia-400 bg-gradient-to-br from-indigo-950/60 to-fuchsia-950/40 hover:from-indigo-900/60 hover:to-fuchsia-900/60 rounded-xl text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-1 shadow-sm"
              title="Browse 3D Mesh Templates by Category"
            >
              <span className="material-symbols-outlined text-2xl text-fuchsia-400 group-hover:scale-110 transition-transform">
                shapes
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white">3D Templates</span>
                <span className="text-[9px] bg-fuchsia-950 border border-fuchsia-500/40 text-fuchsia-300 px-1 py-0.2 rounded font-mono">
                  {templateCount}
                </span>
              </div>
              <span className="text-[8px] text-fuchsia-300/80">Jackets, Shirts...</span>
            </button>

            <button
              type="button"
              onClick={() => model3DInputRef.current?.click()}
              className="p-2.5 border border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-900/50 rounded-xl text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-1 shadow-sm"
              title="Import local 3D models: GLB, GLTF, OBJ, FBX, STL, PLY, DAE"
            >
              <span className="material-symbols-outlined text-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                view_in_ar
              </span>
              <span className="text-[11px] font-bold text-indigo-200">Upload 3D</span>
              <span className="text-[8px] text-indigo-400/80 font-mono">GLB, OBJ, FBX</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 border border-rose-500/40 hover:border-rose-400 bg-gradient-to-b from-rose-950/40 to-purple-950/30 hover:from-rose-900/50 hover:to-purple-900/40 rounded-xl text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-1 shadow-sm"
              title="Tripo3D: Convert 2D image to 3D model with P-Series AI & clean quad topology"
            >
              <span className="material-symbols-outlined text-2xl text-rose-400 group-hover:scale-110 transition-transform">
                auto_awesome
              </span>
              <span className="text-[11px] font-bold text-rose-200">2D to 3D</span>
              <span className="text-[8px] text-rose-400/90 font-mono">Tripo3D P-Series</span>
            </button>

            <button
              type="button"
              onClick={() => appRef.current?.characterAnimationManager?.autoRigSelected()}
              className="p-2.5 border border-emerald-500/40 hover:border-emerald-400 bg-gradient-to-b from-emerald-950/40 to-teal-950/30 hover:from-emerald-900/50 hover:to-teal-900/40 rounded-xl text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-1 shadow-sm"
              title="Add standard 19-bone biped armature & character animations to selected humanoid 3D object"
            >
              <span className="material-symbols-outlined text-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                accessibility_new
              </span>
              <span className="text-[11px] font-bold text-emerald-200">Auto-Rig</span>
              <span className="text-[8px] text-emerald-400/90 font-mono">19 Bones + Motion</span>
            </button>

            <button
              type="button"
              onClick={openVideoIngestionModal}
              className="col-span-2 py-1.5 px-2.5 border border-purple-500/40 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-900/40 rounded-xl text-center transition-all cursor-pointer group flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg text-purple-400 group-hover:scale-110 transition-transform">
                smart_display
              </span>
              <span className="text-[11px] font-semibold text-purple-200">Video Layer (WebGL / YouTube)</span>
            </button>
          </div>

          <button
            id="btn-clear-scene"
            onClick={() => appRef.current?.clearGeneratedMeshes()}
            className="w-full py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 text-[11px] font-semibold rounded-lg border border-red-500/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">delete_sweep</span>
            Clear 3D Meshes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveLeftTab('outliner')}
                className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                  activeLeftTab === 'outliner'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Scene
              </button>
              <button
                type="button"
                onClick={() => setActiveLeftTab('templates')}
                className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1 ${
                  activeLeftTab === 'templates'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Templates</span>
                <span className="text-[9px] bg-indigo-950 border border-indigo-500/40 text-indigo-300 px-1 py-0.2 rounded font-mono">
                  {templateCount}
                </span>
              </button>
            </div>

            {activeLeftTab === 'outliner' && (
              <button
                id="btn-add-light"
                className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold px-2.5 py-1 rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">add</span> Light
              </button>
            )}
          </div>

          {activeLeftTab === 'outliner' ? (
            <ul id="outliner-list" className="space-y-1.5"></ul>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0">
              <MeshTemplateBrowser
                mode="sidebar"
                onSelectTemplate={handleSelectTemplate}
                loadingTemplateId={loadingTemplateId}
                recentlyAddedId={recentlyAddedId}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3D Canvas Viewport (Center) */}
      <div
        id="canvas-container"
        className="flex-1 relative w-full h-full z-[1] min-w-0 min-h-0 bg-slate-950"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleIncomingAnyFile(e.dataTransfer.files[0]);
          }
        }}
      >
        {/* Drag & Drop Visual Drop Zone Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-indigo-950/80 border-4 border-dashed border-indigo-400 z-50 flex flex-col items-center justify-center pointer-events-none backdrop-blur-sm animate-fade-in">
            <span className="material-symbols-outlined text-6xl text-indigo-400 mb-3 animate-bounce">
              upload_file
            </span>
            <p className="text-lg font-bold text-white tracking-wide">Drop 3D Model or Image Here</p>
            <p className="text-xs text-indigo-300 font-mono mt-1">
              Supports .glb, .gltf, .obj, .fbx, .stl, .ply, .dae & images
            </p>
          </div>
        )}

        {/* Top Center Viewport Mode Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[20] bg-slate-900/90 backdrop-blur-md rounded-xl p-1 flex gap-1 border border-slate-800 shadow-xl">
          <button id="view-lit" className="px-3.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow-sm transition-colors">
            Lit (PBR)
          </button>
          <button id="view-unlit" className="px-3.5 py-1 text-xs font-bold rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            Unlit
          </button>
          <button id="view-wire" className="px-3.5 py-1 text-xs font-bold rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            Wireframe
          </button>
        </div>

        {/* Loading Overlay */}
        <div
          id="loading-overlay"
          className="hidden absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center z-[60] backdrop-blur-md transition-all duration-300 pointer-events-none"
        >
          <div className="w-14 h-14 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <h2 id="loading-text" className="text-lg font-bold text-indigo-300 tracking-wide font-mono">
            Analyzing Image...
          </h2>
          <p className="text-slate-400 mt-2 text-xs max-w-sm text-center">
            Processing 3D manifold and geometries.
          </p>
        </div>

        {/* Floating Bottom Button to Toggle Template Shelf */}
        {!templateDrawerOpen && templateBrowserMode !== 'modal' && (
          <button
            type="button"
            onClick={() => {
              setTemplateDrawerOpen(true);
              setTemplateBrowserMode('drawer');
            }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-white border border-indigo-500/40 hover:border-indigo-400 rounded-full shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 cursor-pointer group"
          >
            <span className="material-symbols-outlined text-sm text-indigo-400 group-hover:rotate-12 transition-transform">
              deployed_code
            </span>
            <span>Browse Mesh Templates</span>
            <span className="bg-indigo-950 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full">
              {templateCount}
            </span>
            <span className="material-symbols-outlined text-xs text-slate-400">
              keyboard_arrow_up
            </span>
          </button>
        )}

        {/* Bottom Drawer Mesh Template Browser */}
        {templateDrawerOpen && templateBrowserMode === 'drawer' && (
          <MeshTemplateBrowser
            mode="drawer"
            isOpen={templateDrawerOpen}
            onClose={() => setTemplateDrawerOpen(false)}
            onSelectTemplate={handleSelectTemplate}
            loadingTemplateId={loadingTemplateId}
            recentlyAddedId={recentlyAddedId}
            onToggleExpanded={() => setTemplateBrowserMode('modal')}
          />
        )}
      </div>

      {/* Right Panel: Properties */}
      <div className="ui-panel w-full md:w-80 bg-slate-900/95 border-l border-slate-800 flex flex-col h-full shadow-2xl z-10 flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-bold text-white tracking-wide">Properties Inspector</h2>
          <p id="selection-info" className="text-xs text-slate-400 mt-0.5 font-mono">
            Nothing selected
          </p>
          <div
            id="diagnostics-panel"
            className="text-xs text-indigo-300 mt-3 p-3 bg-slate-950/90 rounded-lg border border-indigo-500/30 font-mono hidden max-h-44 overflow-y-auto studio-scroll select-text"
          ></div>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-6 hidden" id="properties-panel">
          {/* Transform Gizmo Settings */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Transform Mode</h3>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                className="gizmo-btn py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors"
                data-mode="translate"
              >
                Move (W)
              </button>
              <button
                className="gizmo-btn py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
                data-mode="rotate"
              >
                Rotate (E)
              </button>
              <button
                className="gizmo-btn py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
                data-mode="scale"
              >
                Scale (R)
              </button>
            </div>
          </div>

          {/* Position & Scale Inputs */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs font-medium text-slate-400">Position</span>
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="position"
                data-axis="x"
              />
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="position"
                data-axis="y"
              />
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="position"
                data-axis="z"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs font-medium text-slate-400">Scale</span>
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="scale"
                data-axis="x"
              />
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="scale"
                data-axis="y"
              />
              <input
                type="number"
                step="0.1"
                className="prop-input flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                data-prop="scale"
                data-axis="z"
              />
            </div>
          </div>

          {/* Light Properties */}
          <div id="light-props" className="space-y-3 hidden border-t border-slate-800 pt-4">
            <h3 className="text-xs uppercase font-bold text-slate-400">Light Settings</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Color</span>
              <input
                type="color"
                id="light-color"
                className="bg-transparent border border-slate-700 rounded w-14 h-7 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-400">Intensity</span>
                <span id="intensity-val" className="text-xs font-mono text-indigo-400">
                  1.00
                </span>
              </div>
              <input
                type="range"
                id="light-intensity"
                min="0"
                max="10"
                step="0.1"
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* Video / Display Controls */}
          <div id="video-props" className="space-y-3 hidden border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">smart_display</span>
                Video Display
              </h3>
              <span id="video-type-badge" className="text-[10px] bg-indigo-950 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                WebGL
              </span>
            </div>

            {/* Controls for WebGL Video */}
            <div id="webgl-video-controls" className="space-y-2.5">
              {/* Target Mesh & Active Layer Indicator */}
              <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Target Mesh:</span>
                  <span id="video-target-mesh-name" className="text-indigo-300 font-mono font-bold truncate max-w-[140px]">
                    Mesh
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="video-slot-select" className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Active Face / Material Layer
                    </label>
                    <span className="text-[9px] text-emerald-400 font-mono">Isolated</span>
                  </div>
                  <select
                    id="video-slot-select"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="0">Slot 0 (Primary)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-video-play-toggle"
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  <span id="btn-video-play-text">Play / Pause</span>
                </button>
                <button
                  type="button"
                  id="btn-video-mute-toggle"
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">volume_off</span>
                  <span id="btn-video-mute-text">Unmute</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-slate-400">Emissive Screen Glow</span>
                  <span id="video-emissive-val" className="text-xs font-mono text-indigo-400">
                    0.50
                  </span>
                </div>
                <input
                  type="range"
                  id="video-emissive-slider"
                  min="0"
                  max="2.0"
                  step="0.05"
                  defaultValue="0.5"
                  className="w-full accent-indigo-500"
                />
              </div>

              <button
                type="button"
                id="btn-remove-video-layer"
                className="w-full py-1.5 px-2 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs font-medium rounded-lg border border-red-500/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">delete</span>
                Remove Video Layer
              </button>
            </div>

            {/* Controls / Info for CSS3D YouTube */}
            <div id="css3d-video-controls" className="space-y-2 hidden">
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-indigo-500/20 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-indigo-400 font-semibold">
                  <span className="material-symbols-outlined text-xs">touch_app</span>
                  Interactive YouTube Screen
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Click inside the screen directly in the 3D viewport to control the YouTube player, scrub playback, or adjust volume.
                </p>
              </div>
            </div>
          </div>

          {/* Humanoid Armature & Character Animation */}
          <div id="armature-animation-section" className="space-y-3.5 border-t border-slate-800 pt-4 hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">accessibility_new</span>
                Armature & Animation
              </h3>
              <div id="armature-status-pill" className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                Unrigged
              </div>
            </div>

            {/* Unrigged State Box */}
            <div id="armature-unrigged-box" className="p-3 bg-slate-950/80 rounded-xl border border-indigo-500/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <span className="material-symbols-outlined text-base">directions_walk</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Add Humanoid Armature</h4>
                  <p className="text-[10px] text-slate-400">19-bone biped rig & motion cycles</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                Fit a standard 19-bone humanoid armature, calculate smooth vertex skinning weights, and enable character animation cycles (Idle, Walk, Run, Dance, Wave, Jump, Victory).
              </p>
              <div id="armature-humanoid-hint" className="text-[10px] text-slate-400 font-mono"></div>

              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  id="btn-add-armature"
                  className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-950/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer group hover:scale-[1.01]"
                >
                  <span className="material-symbols-outlined text-sm group-hover:animate-bounce">directions_walk</span>
                  <span>Auto-Rig Humanoid Armature</span>
                  <span className="text-[9px] bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-400/30 text-indigo-200">19 Bones</span>
                </button>

                <button
                  type="button"
                  id="btn-cloud-rig-tripo"
                  onClick={() => handleTriggerCloudRigging()}
                  className="w-full py-1.5 px-3 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs text-rose-400">cloud_sync</span>
                  <span>Cloud AI Auto-Rig (Tripo3D API)</span>
                </button>
              </div>
            </div>

            {/* Rigged Controls State */}
            <div id="armature-rigged-controls" className="space-y-3 hidden">
              {/* Armature Bones Toggle & Info */}
              <div className="flex items-center justify-between p-2 bg-slate-950/70 rounded-lg border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="toggle-armature-vis"
                    className="rounded bg-slate-900 border-slate-700 text-indigo-500 accent-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-indigo-400">scatter_plot</span>
                    Show Armature Bones
                  </span>
                </label>
                <span id="armature-bone-count-badge" className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  19 Bones
                </span>
              </div>

              {/* Animation Clip Selector */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Character Animation Cycle
                </span>
                <select
                  id="anim-clip-select"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  {/* Populated dynamically */}
                </select>
              </div>

              {/* Playback Controls & Scrubber */}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="btn-anim-play-pause"
                      className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    >
                      <span id="anim-play-pause-icon" className="material-symbols-outlined text-sm">pause</span>
                      <span id="anim-play-pause-label">Pause</span>
                    </button>
                    <button
                      type="button"
                      id="btn-anim-reset"
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Replay from start"
                    >
                      <span className="material-symbols-outlined text-sm">replay</span>
                    </button>
                  </div>
                  <span id="anim-time-display" className="text-[11px] font-mono text-indigo-400">
                    0.00s / 3.00s
                  </span>
                </div>

                {/* Interactive Scrubber Slider */}
                <div>
                  <input
                    type="range"
                    id="anim-timeline-scrubber"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue="0"
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Playback Speed Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Speed</span>
                  <div className="flex items-center gap-1">
                    {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        data-speed={spd}
                        className={`anim-speed-btn px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                          spd === 1.0 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Tripo AI Motion & Unbind */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleTriggerCloudRigging()}
                  className="flex-1 py-1 px-2 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Synthesize additional cloud animations using Tripo3D AI"
                >
                  <span className="material-symbols-outlined text-xs text-purple-400">auto_fix_high</span>
                  <span>Tripo AI Motion</span>
                </button>
                <button
                  type="button"
                  id="btn-remove-armature"
                  className="py-1 px-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-400 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  title="Remove armature and unbind skinning"
                >
                  Unbind
                </button>
              </div>
            </div>
          </div>

          {/* Mesh Animation */}
          <div id="mesh-props" className="space-y-3 hidden border-t border-slate-800 pt-4">
            <h3 className="text-xs uppercase font-bold text-slate-400">Animation</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="anim-toggle"
                className="rounded bg-slate-950 border-slate-800 text-indigo-500"
              />
              <span className="text-xs text-slate-300">Continuous 360° Rotation</span>
            </label>
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Rotation Speed</span>
              <input
                type="range"
                id="anim-speed"
                min="-0.05"
                max="0.05"
                step="0.002"
                defaultValue="0.01"
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* 3D Extrusion & Material Profiles */}
          <div id="extrusion-props" className="space-y-4 hidden border-t border-slate-800 pt-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">3D Depth / Extrusion</span>
                <span id="extrusion-val" className="text-xs font-mono text-indigo-400">
                  1.00
                </span>
              </div>
              <input
                type="range"
                id="extrusion-amount"
                min="0.05"
                max="3.0"
                step="0.05"
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                PBR Material Profile
              </span>
              <select
                id="fabric-profile-select"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="cotton">👕 Matte Cotton (Garments)</option>
                <option value="satin">✨ Satin / Silk (Glossy Sheen)</option>
                <option value="velvet">🧶 Velvet / Fuzz (Fresnel Rim Glow)</option>
                <option value="mesh">🕸️ Technical Mesh (Alpha Grid)</option>
                <option value="metallic">🥤 Polished Aluminum / Chrome (Cans/Metals)</option>
                <option value="gloss">📺 High-Gloss Lacquer (Screens/Plastics)</option>
                <option value="organic">🐾 Organic Skin / Fur (Soft Sheen)</option>
              </select>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-2">Face Color Tints</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
                  <span>Front</span>
                  <input
                    type="color"
                    id="color-front"
                    className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                  />
                </label>
                <label className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
                  <span>Sides</span>
                  <input
                    type="color"
                    id="color-side"
                    className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                  />
                </label>
                <label className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
                  <span>Back</span>
                  <input
                    type="color"
                    id="color-back"
                    className="w-full h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/70 flex-shrink-0">
          <div className="mb-2.5 p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-300 leading-tight">
            ✨ <strong>WebAR Ready:</strong> Single-click export compiles all textures, normal maps, and PBR materials into a standalone binary <code className="text-white bg-indigo-900/80 px-1 py-0.5 rounded">.GLB</code>.
          </div>
          <button
            id="btn-export"
            onClick={() => appRef.current?.exportGLTF()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex justify-center items-center gap-2 active:scale-98 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export .GLB for WebAR
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. TRIPO3D P-SERIES IMAGE TO 3D GENERATOR MODAL                     */}
      {/* =================================================================== */}
      {threeDAIModalData && (
        <ThreeDAIStudioModal
          isOpen={!!threeDAIModalData}
          onClose={() => setThreeDAIModalData(null)}
          data={threeDAIModalData}
          appInstance={appRef.current}
        />
      )}

      {/* Floating 3D Surface / Face Picker Active Banner */}
      {(isFacePickingActive || facePickStatusNotice) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-bounce-subtle pointer-events-auto">
          <div className="bg-slate-900/95 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/40 rounded-2xl px-5 py-3 flex items-center gap-3 backdrop-blur-xl text-white">
            <span className="material-symbols-outlined text-indigo-400 text-2xl animate-pulse">
              {isFacePickingActive ? 'ads_click' : 'check_circle'}
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                {isFacePickingActive ? '3D Surface & Face Picking Mode' : 'Target Locked'}
              </div>
              <div className="text-xs text-slate-200">
                {facePickStatusNotice || 'Click on any surface or submesh in the 3D viewport...'}
              </div>
            </div>
            {isFacePickingActive && (
              <button
                type="button"
                onClick={handleCancelFacePicking}
                className="ml-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden Video File Input */}
      <input
        type="file"
        ref={videoFileInputRef}
        className="hidden"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (appRef.current?.videoDisplayManager) {
              const targetMesh = videoTargetMode === 'SELECTED_MESH'
                ? (appRef.current.findMeshByUuid(videoTargetMeshUuid) || (appRef.current.selectedObject?.isMesh ? appRef.current.selectedObject : null))
                : null;
              appRef.current.videoDisplayManager.addWebGLVideoDisplay({
                source: file,
                targetMode: videoTargetMode,
                name: `Video_${file.name.replace(/\.[^/.]+$/, '')}`,
                selectedMesh: targetMesh,
                targetMaterialIndex: videoTargetMaterialIndex
              });
            }
            setVideoModalOpen(false);
            e.target.value = '';
          }
        }}
      />

      {/* =================================================================== */}
      {/* 6. MODULAR 3D VIDEO & MEDIA DISPLAY MODAL                           */}
      {/* =================================================================== */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto studio-scroll">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 text-2xl">smart_display</span>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">3D Video & Media Ingestion</h3>
                  <p className="text-xs text-slate-400">Choose between Direct WebGL Video Texturing or CSS3D YouTube Overlays</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setVideoTab('webgl')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  videoTab === 'webgl'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="material-symbols-outlined text-base">texture</span>
                1. WebGL Video Texture
              </button>
              <button
                type="button"
                onClick={() => setVideoTab('youtube')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  videoTab === 'youtube'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="material-symbols-outlined text-base">video_library</span>
                2. CSS3D YouTube Overlay
              </button>
            </div>

            {/* TAB 1: DIRECT WEBGL VIDEO TEXTURE */}
            {videoTab === 'webgl' && (() => {
              const candidateMeshes = appRef.current?.getAllCandidateMeshes?.() || [];
              const activeTargetMesh = videoTargetMeshUuid
                ? appRef.current?.findMeshByUuid?.(videoTargetMeshUuid)
                : (appRef.current?.selectedObject?.isMesh ? appRef.current.selectedObject : (candidateMeshes[0]?.mesh || null));
              const materialSlots = activeTargetMesh ? appRef.current?.getMaterialSlotsForMesh?.(activeTargetMesh) || [] : [];

              const applyWebGLVideo = (sourceUrlOrFile, clipName) => {
                if (!appRef.current?.videoDisplayManager) return;
                const targetMesh = videoTargetMode === 'SELECTED_MESH' ? activeTargetMesh : null;
                appRef.current.videoDisplayManager.addWebGLVideoDisplay({
                  source: sourceUrlOrFile,
                  targetMode: videoTargetMode,
                  name: clipName,
                  selectedMesh: targetMesh,
                  targetMaterialIndex: videoTargetMaterialIndex
                });
                setVideoModalOpen(false);
              };

              return (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
                    ✨ <strong>Hardware-Accelerated WebGL Texture:</strong> Mapped onto 3D surfaces with PBR lighting, normal maps, roughness, emissive glow, and WebAR compatibility.
                  </div>

                  {/* Target Geometry Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Target 3D Geometry
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoTargetMode('SELECTED_MESH');
                          if (!videoTargetMeshUuid && candidateMeshes.length > 0) {
                            setVideoTargetMeshUuid(candidateMeshes[0].uuid);
                          }
                        }}
                        disabled={candidateMeshes.length === 0}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          videoTargetMode === 'SELECTED_MESH'
                            ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm ring-1 ring-indigo-500/50'
                            : candidateMeshes.length > 0
                            ? 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                            : 'border-slate-800/50 bg-slate-950/30 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-indigo-400 text-xl">view_in_ar</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs">Apply to 3D Mesh / Face</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {candidateMeshes.length > 0 ? `${candidateMeshes.length} mesh${candidateMeshes.length > 1 ? 'es' : ''} in scene` : 'No meshes in scene'}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoTargetMode('FLAT_DISPLAY')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          videoTargetMode === 'FLAT_DISPLAY'
                            ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm ring-1 ring-indigo-500/50'
                            : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-indigo-400 text-xl">tv</span>
                        <div>
                          <div className="font-bold text-xs">16:9 Flat Video Screen</div>
                          <div className="text-[10px] text-slate-400">High-gloss chassis display</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoTargetMode('CURVED_SCREEN')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          videoTargetMode === 'CURVED_SCREEN'
                            ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm ring-1 ring-indigo-500/50'
                            : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-indigo-400 text-xl">panorama_wide_angle</span>
                        <div>
                          <div className="font-bold text-xs">Curved Cinema Screen</div>
                          <div className="text-[10px] text-slate-400">120° immersive curvature</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVideoTargetMode('CYLINDER_WRAP')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          videoTargetMode === 'CYLINDER_WRAP'
                            ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm ring-1 ring-indigo-500/50'
                            : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-indigo-400 text-xl">toys</span>
                        <div>
                          <div className="font-bold text-xs">360° Cylinder Wrap</div>
                          <div className="text-[10px] text-slate-400">Can / Bottle / Column video</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Distinctive Face & Submesh Selector for Scene Meshes */}
                  {videoTargetMode === 'SELECTED_MESH' && (
                    <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3 animate-fade-in shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-indigo-400">layers</span>
                          Distinctive Face / Layer Target
                        </span>
                        <button
                          type="button"
                          onClick={handleStartFacePicking}
                          className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 hover:border-indigo-400 text-indigo-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Click directly on the 3D surface in the viewport to select"
                        >
                          <span className="material-symbols-outlined text-sm">ads_click</span>
                          🎯 Pick 3D Face in Viewport
                        </button>
                      </div>

                      {/* Candidate Mesh Dropdown */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Target Submesh / Geometry:
                        </label>
                        <select
                          value={videoTargetMeshUuid}
                          onChange={(e) => {
                            setVideoTargetMeshUuid(e.target.value);
                            setVideoTargetMaterialIndex(0);
                            const m = appRef.current?.findMeshByUuid?.(e.target.value);
                            if (m) appRef.current?.flashMeshHighlight?.(m);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        >
                          {candidateMeshes.map((c) => (
                            <option key={c.uuid} value={c.uuid}>
                              {c.parentName && c.parentName !== c.name ? `[${c.parentName}] ` : ''}{c.name} ({c.materialCount} layer{c.materialCount > 1 ? 's' : ''}){c.hasVideo ? ' 🎬' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Material Slot / Face Picker Cards */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-slate-400">
                            Target Face / Material Slot:
                          </label>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            ✓ Isolates video to selected layer only
                          </span>
                        </div>

                        {materialSlots.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No material slots found on selected mesh.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto studio-scroll p-1 bg-slate-900/60 rounded-lg border border-slate-800/80">
                            {materialSlots.map((slot) => {
                              const isSelected = videoTargetMaterialIndex === slot.index;
                              return (
                                <button
                                  key={slot.index}
                                  type="button"
                                  onClick={() => setVideoTargetMaterialIndex(slot.index)}
                                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'border-indigo-500 bg-indigo-950/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                                      : 'border-slate-800/80 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20 shadow-inner"
                                    style={{ backgroundColor: slot.color || '#6366f1' }}
                                  />
                                  <div className="truncate flex-1 min-w-0">
                                    <div className="font-semibold text-[11px] truncate flex items-center gap-1">
                                      <span className="text-slate-400 font-mono text-[10px]">#{slot.index}</span>
                                      <span className="truncate">{slot.name}</span>
                                    </div>
                                    {slot.hasVideo && (
                                      <span className="text-[9px] text-amber-400 font-bold tracking-wider uppercase">
                                        🎬 Has Video
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-indigo-400 text-sm">
                                      check_circle
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 p-2 rounded-lg leading-relaxed">
                        💡 <strong>Isolation Guarantee:</strong> Only face layer <code className="text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded font-mono">#{videoTargetMaterialIndex}</code> will receive the video texture. All other faces, apparel materials, textures, and scene geometries will remain completely untouched.
                      </div>
                    </div>
                  )}

                  {/* Video Source Ingestion */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Select Video Source
                    </label>

                    {/* File Upload Button */}
                    <div
                      onClick={() => videoFileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl text-center bg-slate-950/50 hover:bg-slate-950/80 transition-all cursor-pointer group flex flex-col items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-3xl text-slate-500 group-hover:text-indigo-400 transition-colors">
                        upload_file
                      </span>
                      <span className="text-xs font-semibold text-slate-200">Upload Video File (.MP4, .WebM)</span>
                      <span className="text-[10px] text-slate-500">Hardware decoding & smooth loop playback</span>
                    </div>

                    <div className="flex items-center gap-3 my-2 text-xs text-slate-500">
                      <div className="flex-1 h-px bg-slate-800"></div>
                      <span>OR USE VIDEO URL</span>
                      <div className="flex-1 h-px bg-slate-800"></div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://.../video.mp4"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!videoUrlInput) return;
                          applyWebGLVideo(videoUrlInput, 'URL_Video_Display');
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Apply URL
                      </button>
                    </div>

                    {/* Preset Demo Clips */}
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-500 block mb-1.5">Quick Demo Samples:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            applyWebGLVideo(
                              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                              'Sample_BigBuckBunny'
                            );
                          }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
                        >
                          🐰 Big Buck Bunny
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            applyWebGLVideo(
                              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                              'Sample_SciFi_VFX'
                            );
                          }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
                        >
                          🤖 Sci-Fi VFX Loop
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* TAB 2: CSS3D YOUTUBE OVERLAY */}
            {videoTab === 'youtube' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3 bg-fuchsia-950/40 border border-fuchsia-500/20 rounded-xl text-xs text-fuchsia-300 leading-relaxed">
                  📺 <strong>Interactive CSS3D Player:</strong> Embedded directly into 3D scene space. Allows live user interaction, volume scrubbing, playlist controls, and YouTube streaming inside the 3D viewport.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    YouTube Video URL or ID
                  </label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or Video ID"
                    value={youtubeUrlInput}
                    onChange={(e) => setYoutubeUrlInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500 self-center">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setYoutubeUrlInput('https://www.youtube.com/watch?v=jfKfPfyJRdk')}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      ☕ Lofi Radio
                    </button>
                    <button
                      type="button"
                      onClick={() => setYoutubeUrlInput('https://www.youtube.com/watch?v=ysz5S6PUM-U')}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      🌿 4K Nature
                    </button>
                    <button
                      type="button"
                      onClick={() => setYoutubeUrlInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      🎵 Music Video
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Aspect Ratio
                    </label>
                    <select
                      value={youtubeAspect}
                      onChange={(e) => setYoutubeAspect(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="16:9">16:9 Widescreen</option>
                      <option value="9:16">9:16 Shorts / Reels</option>
                      <option value="21:9">21:9 UltraWide Cinema</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Bezel Frame Style
                    </label>
                    <select
                      value={youtubeBezel}
                      onChange={(e) => setYoutubeBezel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="cyber_bezel">Cyberpunk Indigo Bezel</option>
                      <option value="glass_float">Floating Glass (Frosted)</option>
                      <option value="minimal">Minimal Stealth Black</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (appRef.current?.videoDisplayManager) {
                      appRef.current.videoDisplayManager.addCSS3DYouTubeOverlay({
                        urlOrId: youtubeUrlInput,
                        aspectRatio: youtubeAspect,
                        frameStyle: youtubeBezel,
                        name: 'YouTube_3D_Screen'
                      });
                    }
                    setVideoModalOpen(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-3"
                >
                  <span className="material-symbols-outlined text-sm">play_circle</span>
                  Spawn Interactive YouTube Screen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Grid Modal Mesh Template Browser */}
      {templateDrawerOpen && templateBrowserMode === 'modal' && (
        <MeshTemplateBrowser
          mode="modal"
          isOpen={templateDrawerOpen}
          onClose={() => setTemplateDrawerOpen(false)}
          onSelectTemplate={handleSelectTemplate}
          loadingTemplateId={loadingTemplateId}
          recentlyAddedId={recentlyAddedId}
          onToggleExpanded={() => setTemplateBrowserMode('drawer')}
        />
      )}

      {/* Cloud AI Rigging Modal (Tripo3D API) */}
      {cloudRigModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto studio-scroll">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <span className="material-symbols-outlined text-lg">cloud_sync</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Tripo3D AI Cloud Rigging
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Biped skeletal auto-rigging & animation retargeting
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isCloudRigging && setCloudRigModalOpen(false)}
                disabled={isCloudRigging}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {cloudRigError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300">
                {cloudRigError}
              </div>
            )}

            {isCloudRigging ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-rose-500 rounded-full animate-spin"></div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-rose-300 font-mono">
                    {cloudRigStep || 'Processing Tripo3D Rigging...'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Tripo AI is calculating joint centers and synthesizing animation channels
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="text-slate-400">Target Object: </span>
                  <span className="font-bold text-white font-mono">{appRef.current?.selectedObject?.name || 'Selected Model'}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Rig Specification
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloudRigSpec('tripo')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-0.5 cursor-pointer ${
                        cloudRigSpec === 'tripo'
                          ? 'border-indigo-500 bg-indigo-950/50 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Tripo Biped Rig</span>
                      <span className="text-[9px] font-normal text-slate-400">Optimized for Tripo animation presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCloudRigSpec('mixamo')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-0.5 cursor-pointer ${
                        cloudRigSpec === 'mixamo'
                          ? 'border-indigo-500 bg-indigo-950/50 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Mixamo Standard</span>
                      <span className="text-[9px] font-normal text-slate-400">Compatible with Mixamo bone naming</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Motion Preset
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {TRIPO_ANIMATION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setCloudRigPreset(preset.id)}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          cloudRigPreset === preset.id
                            ? 'border-rose-500 bg-rose-950/50 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{preset.icon}</span>
                        <span className="text-[10px] text-center leading-tight">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Tripo3D API Key
                  </label>
                  <input
                    type="password"
                    value={cloudRigApiKey}
                    onChange={(e) => setCloudRigApiKey(e.target.value)}
                    placeholder="tsk_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Preloaded from your workspace configuration. You can also use the instant client-side &quot;Auto-Rig&quot; button anytime.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCloudRigModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRunCloudRigging}
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                    Start Cloud Auto-Rig
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
