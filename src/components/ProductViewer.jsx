/* eslint-disable react/no-unknown-property, react/prop-types */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { computeGeometrySurfaceFrame } from '../utils/aframe-components';
import { createPortalObject3D, createParticleSystemObject3D } from '../utils/portalThreeHelper';
import { createGeometriesGroup } from '../utils/geometryHelper';

// YouTube URL parser & ID extractor
export function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url.trim());
}

export function isYouTubeShortUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i.test(trimmed) || /youtu\.be\/shorts\/([a-zA-Z0-9_-]+)/i.test(trimmed);
}

export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : '';
}

// Helper: Apply video texture, OLED screens, and material overrides to loaded 3D scene
export function applyMeshStyling(rootObject, config = {}, videoUrl = '', videoTexture = null) {
  let totalMeshes = 0;
  const targetMeshKey = config.videoTargetMesh || config.video_target_mesh || 'auto';

  let dedicatedNode = null;
  let discoveredYtId = '';
  let discoveredVidUrl = '';

  rootObject.traverse((node) => {
    if (node.isMesh) {
      totalMeshes++;
      const lowerName = (node.name || '').toLowerCase();
      const isStudioYt = node.name === 'YouTube_3D_Screen' || node.userData?.isCSS3D || node.userData?.archetype === 'CSS3D_YOUTUBE';
      const isStudioVid = node.name.startsWith('Video_') || node.userData?.archetype === 'VIDEO_SCREEN' || node.userData?.hasVideo;

      if (isStudioYt || isStudioVid) {
        dedicatedNode = node;
        if (node.userData?.youtubeId) discoveredYtId = node.userData.youtubeId;
        if (node.userData?.videoUrl) discoveredVidUrl = node.userData.videoUrl;
      } else if (!dedicatedNode && (lowerName.includes('screen') || lowerName.includes('display') || lowerName.includes('video'))) {
        dedicatedNode = node;
      }
    }
  });

  const currentVideoUrl = (videoUrl || config.videoUrl || config.video_url || discoveredVidUrl || '').trim();
  const ytId = extractYouTubeId(currentVideoUrl) || discoveredYtId;

  let targetNode = dedicatedNode;
  if (!targetNode && targetMeshKey !== 'auto') {
    rootObject.traverse((n) => {
      if (n.isMesh && (n.name === targetMeshKey || n.uuid === targetMeshKey)) targetNode = n;
    });
  }
  if (!targetNode) {
    rootObject.traverse((n) => {
      if (n.isMesh && !targetNode) targetNode = n;
    });
  }

  rootObject.traverse((node) => {
    if (node.isMesh) {
      const isTargetForVideo = (
        (dedicatedNode && node === dedicatedNode) ||
        (targetMeshKey === 'all') ||
        (targetMeshKey !== 'auto' && (node.name === targetMeshKey || node.uuid === targetMeshKey)) ||
        (targetMeshKey === 'auto' && !dedicatedNode && (
          node.name.toLowerCase().includes('screen') ||
          node.name.toLowerCase().includes('video') ||
          node.name.toLowerCase().includes('display') ||
          totalMeshes === 1
        ))
      );

      // Apply WebGL Video Texture if active
      if (videoTexture && isTargetForVideo && node.material) {
        const applyToMat = (m) => {
          m.map = videoTexture;
          if (m.color) m.color.set(0xffffff);
          m.roughness = 0.3;
          m.metalness = 0.1;
          m.needsUpdate = true;
        };
        if (Array.isArray(node.material)) {
          node.material.forEach(applyToMat);
        } else {
          applyToMat(node.material);
        }
      }

      // If YouTube screen is overlaid on this mesh, set high-tech dark OLED screen styling underneath
      if (ytId && isTargetForVideo && node.material) {
        const applyScreenMat = (m) => {
          if (m.color) m.color.set(0x05070e);
          m.roughness = 0.15;
          m.metalness = 0.9;
          if (m.emissive) {
            m.emissive.set(0x1e1b4b);
            m.emissiveIntensity = 0.25;
          }
          m.needsUpdate = true;
        };
        if (Array.isArray(node.material)) {
          node.material.forEach(applyScreenMat);
        } else {
          applyScreenMat(node.material);
        }
      }

      // Apply Material PBR configs if defined (skip color override on video mesh)
      if (node.material && !isTargetForVideo) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat) => {
          if (config.matMetalness !== undefined && config.matMetalness >= 0) {
            mat.metalness = config.matMetalness;
          }
          if (config.matRoughness !== undefined && config.matRoughness >= 0) {
            mat.roughness = config.matRoughness;
          }
          if (config.matEmissive && mat.emissive) {
            mat.emissive.set(config.matEmissive);
            if (config.matEmissiveIntensity !== undefined && config.matEmissiveIntensity >= 0) {
              mat.emissiveIntensity = config.matEmissiveIntensity;
            }
          }
          if (config.matOpacity !== undefined) {
            mat.opacity = config.matOpacity;
            mat.transparent = mat.opacity < 1.0;
          }
          mat.needsUpdate = true;
        });
      }

      // Apply custom meshOverrides if saved from ARTest (skip color override on video mesh)
      if (config.meshOverrides) {
        const ovr = config.meshOverrides[node.name] || config.meshOverrides[node.uuid];
        if (ovr) {
          if (ovr.deleted || ovr.visible === false) {
            node.visible = false;
            if (ovr.deleted && node.parent) {
              node.parent.remove(node);
            }
            return;
          }
          if (ovr.position) node.position.set(ovr.position.x, ovr.position.y, ovr.position.z);
          if (ovr.scale) node.scale.set(ovr.scale.x, ovr.scale.y, ovr.scale.z);
          if (ovr.material && node.material && !isTargetForVideo) {
            const mat = Array.isArray(node.material) ? node.material[0] : node.material;
            if (ovr.material.color && mat.color) mat.color.set(ovr.material.color);
            if (ovr.material.metalness !== undefined) mat.metalness = ovr.material.metalness;
            if (ovr.material.roughness !== undefined) mat.roughness = ovr.material.roughness;
            if (ovr.material.emissive && mat.emissive) mat.emissive.set(ovr.material.emissive);

            const applyTexTransform = (tex) => {
              if (!tex) return;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              if (tex.center) tex.center.set(0.5, 0.5);
              const repX = ovr.material.textureRepeatX !== undefined && ovr.material.textureRepeatX !== null ? Number(ovr.material.textureRepeatX) : 1.0;
              const repY = ovr.material.textureRepeatY !== undefined && ovr.material.textureRepeatY !== null ? Number(ovr.material.textureRepeatY) : 1.0;
              const flipX = Boolean(ovr.material.textureFlipX);
              const flipY = Boolean(ovr.material.textureFlipY);
              const offX = ovr.material.textureOffsetX !== undefined && ovr.material.textureOffsetX !== null ? Number(ovr.material.textureOffsetX) : 0.0;
              const offY = ovr.material.textureOffsetY !== undefined && ovr.material.textureOffsetY !== null ? Number(ovr.material.textureOffsetY) : 0.0;
              const rotDeg = ovr.material.textureRotation !== undefined && ovr.material.textureRotation !== null ? Number(ovr.material.textureRotation) : 0.0;

              if (tex.repeat) tex.repeat.set(flipX ? -repX : repX, flipY ? -repY : repY);
              if (tex.offset) tex.offset.set(offX, offY);
              tex.rotation = (rotDeg * Math.PI) / 180;
              tex.matrixAutoUpdate = true;
              if (typeof tex.updateMatrix === 'function') tex.updateMatrix();
              tex.needsUpdate = true;
            };

            if (ovr.material.textureUrl) {
              const tLoader = new THREE.TextureLoader();
              tLoader.load(ovr.material.textureUrl, (tex) => {
                if (THREE.SRGBColorSpace !== undefined) {
                  tex.colorSpace = THREE.SRGBColorSpace;
                }
                tex.flipY = false;
                applyTexTransform(tex);
                mat.map = tex;
                mat.needsUpdate = true;
              });
            } else if (mat.map) {
              applyTexTransform(mat.map);
            }
            mat.needsUpdate = true;
          }
        }
      }
    }
  });

  return {
    totalMeshes,
    detectedTargetNode: targetNode,
    ytId,
    resolvedUrl: currentVideoUrl
  };
}

// 3D YouTube Interactive Screen rendered in React Fiber space
function YouTube3DScreen({
  targetNode,
  ytId,
  config = {},
  currentVideoUrl = '',
  iframeRef,
  isMuted
}) {
  const groupRef = useRef(null);
  const tempWorldPos = useMemo(() => new THREE.Vector3(), []);
  const tempWorldQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempWorldScale = useMemo(() => new THREE.Vector3(), []);

  const targetAspect =
    config?.aspectRatio ||
    config?.videoAspectRatio ||
    targetNode?.userData?.aspectRatio ||
    (isYouTubeShortUrl(currentVideoUrl) ? '9:16' : '16:9');

  let iframeW = 640;
  let iframeH = 360;
  if (targetAspect === '9:16') {
    iframeW = 360;
    iframeH = 640;
  } else if (targetAspect === '21:9') {
    iframeW = 840;
    iframeH = 360;
  }

  let baseCssScale = 0.005;
  if (targetNode?.geometry) {
    const slotIdx =
      typeof config.videoTargetMaterialIndex === 'number'
        ? config.videoTargetMaterialIndex
        : typeof targetNode.userData?.videoTargetMaterialIndex === 'number'
        ? targetNode.userData.videoTargetMaterialIndex
        : 0;
    const frame = computeGeometrySurfaceFrame(targetNode, slotIdx);
    baseCssScale = Math.max(frame.size.x, 0.05) / iframeW;
  }

  useFrame(() => {
    if (!targetNode || !groupRef.current) return;
    targetNode.getWorldPosition(tempWorldPos);
    targetNode.getWorldQuaternion(tempWorldQuat);
    targetNode.getWorldScale(tempWorldScale);

    if (targetNode.geometry) {
      const slotIdx =
        typeof config.videoTargetMaterialIndex === 'number'
          ? config.videoTargetMaterialIndex
          : typeof targetNode.userData?.videoTargetMaterialIndex === 'number'
          ? targetNode.userData.videoTargetMaterialIndex
          : 0;
      const frame = computeGeometrySurfaceFrame(targetNode, slotIdx);

      const uScale = Number(config.videoScale ?? targetNode.userData?.videoScale ?? 1.0);
      const uOffsetX = Number(config.videoOffsetX ?? targetNode.userData?.videoOffsetX ?? 0.0);
      const uOffsetY = Number(config.videoOffsetY ?? targetNode.userData?.videoOffsetY ?? 0.0);
      const uOffsetZ = Number(config.videoOffsetZ ?? targetNode.userData?.videoOffsetZ ?? 0.0);
      const uRot = Number(config.videoRotation ?? targetNode.userData?.videoRotation ?? 0.0);

      const localPos = frame.localCenter
        .clone()
        .addScaledVector(frame.localNormal, 0.005 + uOffsetZ);
      localPos.addScaledVector(frame.localRight, uOffsetX);
      localPos.addScaledVector(frame.localUp, uOffsetY);
      localPos.applyMatrix4(targetNode.matrixWorld);
      tempWorldPos.copy(localPos);

      let quat = frame.worldQuat.clone();
      if (uRot !== 0) {
        const rotQ = new THREE.Quaternion().setFromAxisAngle(
          frame.worldNormal,
          (uRot * Math.PI) / 180
        );
        quat = rotQ.multiply(quat);
      }

      groupRef.current.position.copy(tempWorldPos);
      groupRef.current.quaternion.copy(quat);

      const effScale = baseCssScale * uScale;
      groupRef.current.scale.set(
        effScale * Math.abs(tempWorldScale.x || 1),
        effScale * Math.abs(tempWorldScale.y || 1),
        effScale * Math.abs(tempWorldScale.z || 1)
      );
    } else {
      groupRef.current.position.copy(tempWorldPos);
      groupRef.current.quaternion.copy(tempWorldQuat);
      groupRef.current.scale.set(
        baseCssScale * Math.abs(tempWorldScale.x || 1),
        baseCssScale * Math.abs(tempWorldScale.y || 1),
        baseCssScale * Math.abs(tempWorldScale.z || 1)
      );
    }
  });

  const originParam =
    typeof window !== 'undefined'
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  return (
    <group ref={groupRef}>
      <Html
        transform
        center
        distanceFactor={400}
        pointerEvents="auto"
        zIndexRange={[15, 0]}
        style={{
          width: `${iframeW}px`,
          height: `${iframeH}px`,
          userSelect: 'none'
        }}
      >
        <div
          style={{
            width: `${iframeW}px`,
            height: `${iframeH}px`,
            background: '#030712',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 0 50px rgba(99, 102, 241, 0.4)',
            border: '2px solid rgba(129, 140, 248, 0.6)',
            pointerEvents: 'auto'
          }}
        >
          <iframe
            ref={iframeRef}
            style={{ width: '100%', height: '100%', border: '0' }}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&mute=${
              isMuted ? 1 : 0
            }&controls=1&loop=1&playlist=${ytId}${originParam}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="3D YouTube Player"
          />
        </div>
      </Html>
    </group>
  );
}

// Stylized Torus Knot placeholder when no 3D asset is available
function StylizedPlaceholder({ isWireframe }) {
  return (
    <group>
      <mesh>
        <torusKnotGeometry args={[0.7, 0.22, 120, 16, 2, 3]} />
        <meshStandardMaterial
          color="#6366f1"
          metalness={0.7}
          roughness={0.2}
          wireframe={isWireframe}
        />
      </mesh>
    </group>
  );
}

// Declarative Fiber Scene Content
function SceneContent({
  modelGroup,
  modelBoundingData,
  isWireframe,
  config,
  autoRotate,
  controlsRef,
  cameraRef,
  defaultCamPosRef,
  activeVideoType,
  targetNode,
  youTubeId,
  resolvedVideoUrl,
  iframeRef,
  isMuted
}) {
  const { camera } = useThree();

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);

  // Dynamically frame camera to fit the loaded 3D asset dimensions
  useEffect(() => {
    if (!modelBoundingData) return;
    const { maxDim } = modelBoundingData;
    const fovRad = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fovRad / 2)) * 1.5;
    cameraDistance = Math.max(cameraDistance, 1.0);

    camera.position.set(0, maxDim * 0.15, cameraDistance);
    defaultCamPosRef.current.set(0, maxDim * 0.15, cameraDistance);
    camera.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [modelBoundingData, camera, controlsRef, defaultCamPosRef]);

  const gridY = modelBoundingData ? -modelBoundingData.maxDim / 2 - 0.05 : -0.5;

  const parsePos = (pos, fallback) => {
    if (Array.isArray(pos) && pos.length === 3) return pos;
    if (typeof pos === 'string') {
      const parts = pos.trim().split(/\s+/).map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) return parts;
    }
    return fallback;
  };

  const dir1Pos = parsePos(config.dir1Position, [2, 4, 3]);
  const dir2Pos = parsePos(config.dir2Position, [-2, -1, -2]);
  const rimPos = parsePos(config.rimPosition, [0, 3, -3]);

  // Portal & Particle System Configuration
  const portalCfg = config?.portalConfig || config?.portal;
  const isPortalEnabled = !!(
    portalCfg &&
    (portalCfg.enabled === true ||
      portalCfg.enabled === 'true' ||
      portalCfg.enabled === 1 ||
      portalCfg.enabled === '1' ||
      (portalCfg.enabled !== false &&
        portalCfg.enabled !== 'false' &&
        portalCfg.enabled !== 0 &&
        (Boolean(portalCfg.shape) || Boolean(portalCfg.interiorType) || Boolean(portalCfg.preset))))
  );
  const portalHideOutsideModel = isPortalEnabled && !!portalCfg?.hideOutsideModel;

  const particleCfg = config?.particleConfig || config?.particle;
  const isParticleEnabled = !!(
    particleCfg &&
    (particleCfg.enabled === true ||
      particleCfg.enabled === 'true' ||
      particleCfg.enabled === 1 ||
      particleCfg.enabled === '1' ||
      (particleCfg.enabled !== false &&
        particleCfg.enabled !== 'false' &&
        particleCfg.enabled !== 0 &&
        (Boolean(particleCfg.preset) || Number(particleCfg.count) > 0)))
  );

  const portalInstance = useMemo(() => {
    if (!isPortalEnabled) return null;
    return createPortalObject3D(portalCfg, THREE, modelGroup);
  }, [isPortalEnabled, JSON.stringify(portalCfg), modelGroup]);

  useEffect(() => {
    return () => {
      if (portalInstance) portalInstance.dispose();
    };
  }, [portalInstance]);

  const particleInstance = useMemo(() => {
    if (!isParticleEnabled) return null;
    return createParticleSystemObject3D(particleCfg, THREE);
  }, [isParticleEnabled, JSON.stringify(particleCfg)]);

  useEffect(() => {
    return () => {
      if (particleInstance) particleInstance.dispose();
    };
  }, [particleInstance]);

  const additionalGeometries = config?.additionalGeometries || [];
  const geometriesGroup = useMemo(() => {
    if (!Array.isArray(additionalGeometries) || additionalGeometries.length === 0) return null;
    return createGeometriesGroup(additionalGeometries, THREE);
  }, [JSON.stringify(additionalGeometries)]);

  useEffect(() => {
    return () => {
      if (geometriesGroup) {
        geometriesGroup.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      }
    };
  }, [geometriesGroup]);

  useFrame((state, delta) => {
    if (portalInstance) {
      portalInstance.update(state.clock.elapsedTime * 1000, delta * 1000, state.camera);
    }
    if (particleInstance) {
      particleInstance.update(state.clock.elapsedTime * 1000, delta * 1000, state.camera);
    }
    if (geometriesGroup) {
      for (let i = 0; i < geometriesGroup.children.length; i++) {
        const mesh = geometriesGroup.children[i];
        if (mesh && mesh.userData && Number(mesh.userData.rotationSpeed)) {
          mesh.rotation.y += Number(mesh.userData.rotationSpeed) * delta;
        }
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#0d1117']} />

      {/* Lighting Setup */}
      <ambientLight
        color={config.ambientColor || 0xffffff}
        intensity={config.ambientIntensity !== undefined ? config.ambientIntensity : 1.4}
      />
      <directionalLight
        position={dir1Pos}
        color={config.dir1Color || 0xffffff}
        intensity={config.dir1Intensity !== undefined ? config.dir1Intensity : 2.2}
      />
      <directionalLight
        position={dir2Pos}
        color={config.dir2Color || 0xffffff}
        intensity={config.dir2Intensity !== undefined ? config.dir2Intensity : 1.2}
      />
      <directionalLight
        position={rimPos}
        color={config.rimColor || 0x818cf8}
        intensity={config.rimIntensity !== undefined ? config.rimIntensity : 1.0}
      />

      {/* Floor Grid */}
      <gridHelper args={[4, 16, 0x312e81, 0x1e293b]} position={[0, gridY, 0]} />

      {/* Declarative OrbitControls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        maxDistance={20}
        minDistance={0.2}
      />

      {/* 3D Portal Gateway */}
      {portalInstance && (
        <primitive object={portalInstance.group} />
      )}

      {/* Standalone Particle System */}
      {particleInstance && (
        <primitive object={particleInstance.group} />
      )}

      {/* Additional 3D Primitive Geometries */}
      {geometriesGroup && (
        <primitive object={geometriesGroup} />
      )}

      {/* 3D Asset or Stylized Placeholder */}
      {!portalHideOutsideModel && (
        modelGroup ? (
          <primitive object={modelGroup} />
        ) : (
          <StylizedPlaceholder isWireframe={isWireframe} />
        )
      )}

      {/* 3D YouTube Screen Overlay via Drei Html */}
      {activeVideoType === 'youtube' && targetNode && youTubeId && (
        <YouTube3DScreen
          targetNode={targetNode}
          ytId={youTubeId}
          config={config}
          currentVideoUrl={resolvedVideoUrl}
          iframeRef={iframeRef}
          isMuted={isMuted}
        />
      )}
    </>
  );
}

// React Three Fiber Interactive Product Viewer
export default function ProductViewer({
  modelUrl,
  videoUrl,
  config = {},
  assetName = '3D Digital Asset',
  assetId = ''
}) {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [meshCount, setMeshCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showPip, setShowPip] = useState(false);
  const [activeVideoType, setActiveVideoType] = useState(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState(
    videoUrl || config.videoUrl || config.video_url || ''
  );
  const [modelGroup, setModelGroup] = useState(null);
  const [modelBoundingData, setModelBoundingData] = useState(null);
  const [targetNode, setTargetNode] = useState(null);
  const [youTubeId, setYouTubeId] = useState('');

  const configKey = useMemo(() => {
    try {
      return JSON.stringify(config || {});
    } catch {
      return '';
    }
  }, [config]);

  // Controls & Camera References
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null);
  const defaultCamPosRef = useRef(new THREE.Vector3(0, 1.2, 2.5));
  const videoElRef = useRef(null);
  const videoTextureRef = useRef(null);
  const iframeRef = useRef(null);

  // Toggle Auto-Rotate
  const toggleAutoRotate = () => {
    setAutoRotate((prev) => !prev);
  };

  // Reset Camera View
  const resetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.reset();
      cameraRef.current.position.copy(defaultCamPosRef.current);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Toggle Wireframe across model
  const toggleWireframe = () => {
    setIsWireframe((prev) => {
      const next = !prev;
      if (modelRef.current) {
        modelRef.current.traverse((node) => {
          if (node.isMesh && node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((m) => {
                m.wireframe = next;
              });
            } else {
              node.material.wireframe = next;
            }
          }
        });
      }
      return next;
    });
  };

  // Toggle Audio Mute / Unmute
  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoElRef.current) {
        videoElRef.current.muted = next;
        if (!next) videoElRef.current.volume = 1.0;
      }
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }),
            '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'setVolume', args: [next ? 0 : 100] }),
            '*'
          );
        } catch (e) {
          console.warn('Audio postMessage notice:', e);
        }
      }
      return next;
    });
  };

  // Unlock video autoplay on user interaction
  const handleUserUnlock = () => {
    if (videoElRef.current && videoElRef.current.paused) {
      videoElRef.current.play().catch(() => {});
    }
  };

  // Asynchronous Asset and Video Loader
  useEffect(() => {
    let isMounted = true;
    let videoEl = null;
    let videoTexture = null;

    const effectiveVideoUrl = (videoUrl || config.videoUrl || config.video_url || '').trim();
    const isYt = isYouTubeUrl(effectiveVideoUrl);

    if (effectiveVideoUrl) {
      setResolvedVideoUrl(effectiveVideoUrl);
      setActiveVideoType(isYt ? 'youtube' : 'webgl');
      if (isYt) {
        setYouTubeId(extractYouTubeId(effectiveVideoUrl));
      }
    } else {
      setActiveVideoType(null);
      setYouTubeId('');
    }

    // Initialize WebGL Video Texture if HTML5 Video
    if (effectiveVideoUrl && !isYt) {
      try {
        videoEl = document.createElement('video');
        videoEl.crossOrigin = 'anonymous';
        videoEl.muted = true;
        videoEl.defaultMuted = true;
        videoEl.playsInline = true;
        videoEl.autoplay = true;
        videoEl.loop = true;
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('webkit-playsinline', '');
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('crossorigin', 'anonymous');
        videoEl.src = effectiveVideoUrl;
        videoEl.load();

        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) =>
            console.warn('ProductViewer video autoplay prevented:', err)
          );
        }
        videoElRef.current = videoEl;

        videoTexture = new THREE.VideoTexture(videoEl);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.generateMipmaps = false;
        videoTexture.format = THREE.RGBAFormat;
        videoTextureRef.current = videoTexture;

        const isFlipX = !!(config.videoFlipX || config.video_flip_x);
        const uRepeatX = Number(config.videoTextureRepeatX ?? (isFlipX ? -1 : 1));
        const uRepeatY = Number(config.videoTextureRepeatY ?? 1);
        const uTexOffsetX = Number(config.videoTextureOffsetX ?? (isFlipX ? 1 : 0));
        const uTexOffsetY = Number(config.videoTextureOffsetY ?? 0);
        const uRot = Number(config.videoRotation ?? 0);

        videoTexture.wrapS = THREE.RepeatWrapping;
        videoTexture.wrapT = THREE.RepeatWrapping;
        videoTexture.repeat.set(uRepeatX, uRepeatY);
        videoTexture.offset.set(uTexOffsetX, uTexOffsetY);
        if (uRot) {
          videoTexture.center.set(0.5, 0.5);
          videoTexture.rotation = (uRot * Math.PI) / 180;
        }
        videoTexture.matrixAutoUpdate = true;
        if (videoTexture.updateMatrix) videoTexture.updateMatrix();
      } catch (videoErr) {
        console.warn('Could not initialize WebGL video texture:', videoErr);
      }
    }

    if (!modelUrl) {
      setLoading(false);
      setModelGroup(null);
      setMeshCount(1);
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setLoadError(null);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      modelUrl,
      (gltf) => {
        if (!isMounted) return;
        const model = gltf.scene;

        // Compute Bounding Box and Center
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        // Center the model at origin
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        const anchorGroup = new THREE.Group();
        anchorGroup.add(model);

        // Apply materials, video textures & overrides
        const { totalMeshes, detectedTargetNode, ytId: discoveredYtId, resolvedUrl } =
          applyMeshStyling(model, config, effectiveVideoUrl, videoTexture);

        if (discoveredYtId) {
          setActiveVideoType('youtube');
          setResolvedVideoUrl(
            resolvedUrl || `https://www.youtube.com/watch?v=${discoveredYtId}`
          );
          setYouTubeId(discoveredYtId);
          setTargetNode(detectedTargetNode);
        } else if (effectiveVideoUrl && !isYt) {
          setActiveVideoType('webgl');
          setTargetNode(detectedTargetNode);
        } else {
          setTargetNode(detectedTargetNode);
        }

        // Apply wireframe if active
        if (isWireframe) {
          model.traverse((node) => {
            if (node.isMesh && node.material) {
              if (Array.isArray(node.material)) {
                node.material.forEach((m) => {
                  m.wireframe = true;
                });
              } else {
                node.material.wireframe = true;
              }
            }
          });
        }

        modelRef.current = anchorGroup;
        setModelGroup(anchorGroup);
        setModelBoundingData({ center, size, maxDim });
        setMeshCount(totalMeshes);
        setLoading(false);
      },
      (xhr) => {
        if (xhr.lengthComputable && isMounted) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadingProgress(percent);
        }
      },
      (error) => {
        console.error('Error loading 3D model in ProductViewer:', error);
        if (isMounted) {
          setLoadError('Could not load 3D GLB model. Displaying stylized preview.');
          setLoading(false);
          setModelGroup(null);
          setMeshCount(1);
        }
      }
    );

    return () => {
      isMounted = false;
      dracoLoader.dispose();
      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.src = '';
        videoElRef.current.load();
      }
      if (videoTextureRef.current) {
        videoTextureRef.current.dispose();
      }
      if (modelRef.current) {
        modelRef.current.traverse((obj) => {
          if (obj.geometry && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              for (const k in m) {
                if (m[k] && typeof m[k].dispose === 'function') {
                  m[k].dispose();
                }
              }
              if (typeof m.dispose === 'function') m.dispose();
            });
          }
        });
      }
    };
  }, [modelUrl, videoUrl, configKey]);

  const hasActiveVideo = !!activeVideoType;
  const ytVideoId = activeVideoType === 'youtube' ? youTubeId || extractYouTubeId(resolvedVideoUrl) : '';

  return (
    <div
      onPointerDown={handleUserUnlock}
      className="w-full h-full relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center select-none"
    >
      {/* React Three Fiber Canvas */}
      <div className="w-full h-full cursor-grab active:cursor-grabbing relative">
        <Canvas
          gl={{ antialias: true, alpha: true, stencil: true, powerPreference: 'default' }}
          camera={{ fov: 45, near: 0.05, far: 100, position: [0, 1.2, 2.5] }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.outputColorSpace = THREE.SRGBColorSpace;

            const handleContextLost = (event) => {
              event.preventDefault();
              setWebglUnavailable(true);
              setLoadError(
                'WebGL graphics context was lost and blocked by the browser. Please reload the tab.'
              );
            };
            gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);
          }}
          className="w-full h-full"
        >
          <SceneContent
            modelGroup={modelGroup}
            modelBoundingData={modelBoundingData}
            isWireframe={isWireframe}
            config={config}
            autoRotate={autoRotate}
            controlsRef={controlsRef}
            cameraRef={cameraRef}
            defaultCamPosRef={defaultCamPosRef}
            activeVideoType={activeVideoType}
            targetNode={targetNode}
            youTubeId={youTubeId}
            resolvedVideoUrl={resolvedVideoUrl}
            iframeRef={iframeRef}
            isMuted={isMuted}
          />
        </Canvas>
      </div>

      {/* Top Floating Badge Bar */}
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            3D Interactive Preview
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {meshCount > 0 && (
            <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-neutral-400 border border-white/10">
              {meshCount} Mesh{meshCount > 1 ? 'es' : ''}
            </span>
          )}

          {hasActiveVideo && (
            <div className="flex items-center gap-1.5">
              <span
                className={`backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
                  activeVideoType === 'youtube'
                    ? 'bg-red-950/80 text-red-300 border-red-500/40'
                    : 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {activeVideoType === 'youtube' ? 'smart_display' : 'play_circle'}
                </span>
                {activeVideoType === 'youtube' ? 'YouTube 3D Stream' : 'Video Texture'}
              </span>

              {/* Audio Toggle Button */}
              <button
                type="button"
                onClick={toggleMute}
                className={`backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center gap-1 transition-all cursor-pointer shadow-md ${
                  !isMuted
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                    : 'bg-neutral-900/80 text-neutral-400 hover:text-white border-white/10'
                }`}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                <span className="material-symbols-outlined text-xs">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
                <span>{isMuted ? 'Unmute' : 'Audio On'}</span>
              </button>

              {/* Picture-In-Picture Monitor Button */}
              <button
                type="button"
                onClick={() => setShowPip((prev) => !prev)}
                className={`backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono border flex items-center gap-1 transition-all cursor-pointer ${
                  showPip
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                    : 'bg-black/60 text-neutral-400 hover:text-white border-white/10'
                }`}
                title="Toggle Picture-In-Picture Monitor"
              >
                <span className="material-symbols-outlined text-xs">picture_in_picture_alt</span>
                <span className="hidden sm:inline">Monitor</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Picture-In-Picture Video Monitor (Top Right) */}
      {showPip && hasActiveVideo && (
        <div className="absolute top-16 right-5 z-30 w-72 rounded-xl overflow-hidden bg-black/90 border border-white/20 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/90 border-b border-white/10">
            <span className="text-[10px] font-mono font-bold text-neutral-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              LIVE VIDEO MONITOR
            </span>
            <button
              type="button"
              onClick={() => setShowPip(false)}
              className="text-neutral-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div
            className={`${
              config?.aspectRatio === '9:16' ||
              config?.videoAspectRatio === '9:16' ||
              isYouTubeShortUrl(resolvedVideoUrl)
                ? 'aspect-[9/16] max-h-72'
                : 'aspect-video'
            } w-full bg-black relative flex items-center justify-center`}
          >
            {activeVideoType === 'youtube' && ytVideoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&mute=${
                  isMuted ? '1' : '0'
                }&controls=1`}
                className="w-full h-full border-0"
                title="PIP Monitor"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : resolvedVideoUrl ? (
              <video
                src={resolvedVideoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 space-y-4">
          <div className="w-12 h-12 border-3 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-mono font-bold tracking-widest text-indigo-300 uppercase">
              Loading 3D Canvas
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {loadingProgress > 0 ? `${loadingProgress}%` : 'Parsing Geometry & Textures...'}
            </span>
          </div>
          {loadingProgress > 0 && (
            <div className="w-48 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* WebGL Context Unavailable Fallback Screen */}
      {webglUnavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md z-40 text-center">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400 shadow-lg">
            <span className="material-symbols-outlined text-3xl">view_in_ar</span>
          </div>
          <h4 className="text-base font-bold text-white uppercase tracking-wider mb-2">
            3D Graphics Context Reset Required
          </h4>
          <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed font-mono">
            Your browser temporarily paused WebGL graphics resources after multiple 3D scene transitions. Reloading the page will restore the interactive 3D viewer.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-mono text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/25 active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reload Page
          </button>
        </div>
      )}

      {/* Error Banner */}
      {!webglUnavailable && loadError && (
        <div className="absolute top-16 left-6 right-6 p-2 bg-amber-950/80 border border-amber-500/50 rounded-lg text-amber-200 text-xs font-mono flex items-center gap-2 z-20 shadow-lg">
          <span className="material-symbols-outlined text-sm text-amber-400">warning</span>
          <span>{loadError}</span>
        </div>
      )}

      {/* Subtle Bottom Drag Hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
          🖱️ Drag to Rotate • Scroll to Zoom
        </span>
      </div>
    </div>
  );
}
