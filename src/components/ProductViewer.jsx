import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { computeGeometrySurfaceFrame } from '../utils/aframe-components';

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

export default function ProductViewer({ modelUrl, videoUrl, config = {}, assetName = '3D Digital Asset', assetId = '' }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [meshCount, setMeshCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showPip, setShowPip] = useState(false);
  const [activeVideoType, setActiveVideoType] = useState(null); // 'webgl' | 'youtube' | null
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState(videoUrl || config.videoUrl || config.video_url || '');

  const configKey = React.useMemo(() => {
    try {
      return JSON.stringify(config || {});
    } catch {
      return '';
    }
  }, [config]);

  // References to allow UI buttons to communicate with Three.js render loop
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const cssSceneRef = useRef(null);
  const modelRef = useRef(null);
  const defaultCamPosRef = useRef(new THREE.Vector3(0, 1.2, 2.5));
  const videoElRef = useRef(null);
  const videoTextureRef = useRef(null);
  const cssTargetNodeRef = useRef(null);
  const cssObjectRef = useRef(null);
  const iframeRef = useRef(null);

  // Toggle Auto-Rotate
  const toggleAutoRotate = () => {
    setAutoRotate(prev => {
      const next = !prev;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
      }
      return next;
    });
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
    setIsWireframe(prev => {
      const next = !prev;
      if (modelRef.current) {
        modelRef.current.traverse(node => {
          if (node.isMesh && node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach(m => m.wireframe = next);
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
    setIsMuted(prev => {
      const next = !prev;
      // HTML5 video element audio
      if (videoElRef.current) {
        videoElRef.current.muted = next;
        if (!next) videoElRef.current.volume = 1.0;
      }
      // YouTube iframe postMessage commands
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

  useEffect(() => {
    if (!mountRef.current) return;

    let scene, cssScene, camera, renderer, cssRenderer, controls, animationFrameId;
    let isMounted = true;
    let videoEl = null;
    let videoTexture = null;
    let cssObject = null;
    let targetNode = null;
    let baseCssScale = 0.005;

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 600;

    // 1. WebGL Three.js Scene Setup
    scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#0d1117');

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    camera.position.set(0, 1.2, 2.5);
    cameraRef.current = camera;

    // 3. WebGL Renderer Setup
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch (webglErr) {
      console.warn("Failed to create WebGLRenderer:", webglErr);
      if (isMounted) {
        setWebglUnavailable(true);
        setLoadError("WebGL context could not be created or was blocked by the browser. Please reload the page to reset the WebGL context.");
        setLoading(false);
      }
      return;
    }

    const handleContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(animationFrameId);
      if (isMounted) {
        setWebglUnavailable(true);
        setLoadError("WebGL graphics context was lost and blocked by the browser. Please reload the tab.");
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mountRef.current.appendChild(renderer.domElement);

    // 4. CSS3D Renderer Setup (for YouTube 3D screen overlay)
    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(width, height);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.width = '100%';
    cssRenderer.domElement.style.height = '100%';
    cssRenderer.domElement.style.pointerEvents = 'none'; // allow mouse to drag through to OrbitControls
    cssRenderer.domElement.style.zIndex = '5';
    mountRef.current.appendChild(cssRenderer.domElement);

    cssScene = new THREE.Scene();
    cssSceneRef.current = cssScene;

    // 5. OrbitControls Setup on WebGL canvas
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controls.maxDistance = 20;
    controls.minDistance = 0.2;
    controlsRef.current = controls;

    // 6. Lighting Setup
    const ambientLight = new THREE.AmbientLight(
      config.ambientColor || 0xffffff,
      config.ambientIntensity !== undefined ? config.ambientIntensity : 1.4
    );
    scene.add(ambientLight);

    const mainDirLight = new THREE.DirectionalLight(config.dir1Color || 0xffffff, config.dir1Intensity || 2.2);
    mainDirLight.position.set(2, 4, 3);
    scene.add(mainDirLight);

    const fillDirLight = new THREE.DirectionalLight(config.dir2Color || 0xffffff, config.dir2Intensity || 1.2);
    fillDirLight.position.set(-2, -1, -2);
    scene.add(fillDirLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.0);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Subtle Grid Floor
    const gridHelper = new THREE.GridHelper(4, 16, 0x312e81, 0x1e293b);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Initial Effective Video URL Check
    const effectiveVideoUrl = (videoUrl || config.videoUrl || config.video_url || '').trim();
    const isYt = isYouTubeUrl(effectiveVideoUrl);

    if (effectiveVideoUrl) {
      setResolvedVideoUrl(effectiveVideoUrl);
      setActiveVideoType(isYt ? 'youtube' : 'webgl');
    }

    // 7. Initialize WebGL Video Texture if HTML5 Video
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
          playPromise.catch(err => console.warn('ProductViewer video autoplay prevented:', err));
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

    // 8. Helper: Apply video texture, CSS3D screens, and material overrides
    const applyMeshStyling = (rootObject) => {
      let totalMeshes = 0;
      const targetMeshKey = config.videoTargetMesh || config.video_target_mesh || 'auto';

      // 8a. Find dedicated video screen node if created by Studio44
      let dedicatedNode = null;
      let discoveredYtId = '';
      let discoveredVidUrl = '';

      rootObject.traverse(node => {
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

      // 8b. Determine YouTube video ID (from prop, config, or embedded GLTF extras)
      const currentVideoUrl = (videoUrl || config.videoUrl || config.video_url || discoveredVidUrl || '').trim();
      const ytId = extractYouTubeId(currentVideoUrl) || discoveredYtId;

      if (ytId) {
        setActiveVideoType('youtube');
        setResolvedVideoUrl(currentVideoUrl || `https://www.youtube.com/watch?v=${ytId}`);

        // Setup CSS3D YouTube screen
        targetNode = dedicatedNode;
        if (!targetNode && targetMeshKey !== 'auto') {
          rootObject.traverse(n => {
            if (n.isMesh && (n.name === targetMeshKey || n.uuid === targetMeshKey)) targetNode = n;
          });
        }
        if (!targetNode) {
          rootObject.traverse(n => {
            if (n.isMesh && !targetNode) targetNode = n;
          });
        }

        if (targetNode) {
          cssTargetNodeRef.current = targetNode;

          // Build YouTube iframe container
          const targetAspect = config?.aspectRatio || config?.videoAspectRatio || targetNode.userData?.aspectRatio || (isYouTubeShortUrl(currentVideoUrl) ? '9:16' : '16:9');
          let iframeW = 640;
          let iframeH = 360;
          if (targetAspect === '9:16') {
            iframeW = 360;
            iframeH = 640;
          } else if (targetAspect === '21:9') {
            iframeW = 840;
            iframeH = 360;
          }
          const containerDiv = document.createElement('div');
          containerDiv.style.width = `${iframeW}px`;
          containerDiv.style.height = `${iframeH}px`;
          containerDiv.style.background = '#030712';
          containerDiv.style.borderRadius = '12px';
          containerDiv.style.overflow = 'hidden';
          containerDiv.style.boxShadow = '0 0 50px rgba(99, 102, 241, 0.4)';
          containerDiv.style.border = '2px solid rgba(129, 140, 248, 0.6)';
          containerDiv.style.pointerEvents = 'auto'; // allow user to click inside player if needed

          const iframe = document.createElement('iframe');
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = '0';
          const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
          iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&mute=1&controls=1&loop=1&playlist=${ytId}${originParam}`;
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          iframe.allowFullscreen = true;
          containerDiv.appendChild(iframe);
          iframeRef.current = iframe;

          // Remove any existing CSS3D object before creating new one
          if (cssObject && cssScene) {
            cssScene.remove(cssObject);
          }

          cssObject = new CSS3DObject(containerDiv);
          cssObjectRef.current = cssObject;

          // Calculate scale from geometry surface frame - defaults to fill specified geometry
          if (targetNode.geometry) {
            const slotIdx = typeof config.videoTargetMaterialIndex === 'number'
              ? config.videoTargetMaterialIndex
              : (typeof targetNode.userData?.videoTargetMaterialIndex === 'number'
                  ? targetNode.userData.videoTargetMaterialIndex
                  : 0);
            const frame = computeGeometrySurfaceFrame(targetNode, slotIdx);
            baseCssScale = Math.max(frame.size.x, 0.05) / iframeW;
          }
          cssObject.scale.set(baseCssScale, baseCssScale, baseCssScale);
          cssScene.add(cssObject);
        }
      }

      // 8c. Iterate meshes to apply WebGL video texture, OLED styling, and material configs
      rootObject.traverse(node => {
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
              // Reset base color to pure white so video texture shines without dark tinting
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
            mats.forEach(mat => {
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

      setMeshCount(totalMeshes);
    };

    // 9. Load 3D Asset
    if (modelUrl) {
      setLoading(true);
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
          modelRef.current = model;

          // Compute Bounding Box and Center
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          // Center the model at origin
          model.position.x = -center.x;
          model.position.y = -center.y;
          model.position.z = -center.z;

          // Create an anchor group to rotate cleanly
          const modelGroup = new THREE.Group();
          modelGroup.add(model);
          scene.add(modelGroup);

          // Apply materials, video textures & CSS3D YouTube screens
          applyMeshStyling(model);

          // Frame Camera to fit the entire model nicely in view
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const fov = camera.fov * (Math.PI / 180);
          let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
          cameraDistance = Math.max(cameraDistance, 1.0);

          camera.position.set(0, maxDim * 0.15, cameraDistance);
          defaultCamPosRef.current.set(0, maxDim * 0.15, cameraDistance);
          camera.lookAt(0, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();

          // Reposition grid floor directly beneath model
          gridHelper.position.y = -maxDim / 2 - 0.05;

          setLoading(false);
        },
        (xhr) => {
          if (xhr.lengthComputable && isMounted) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            setLoadingProgress(percent);
          }
        },
        (error) => {
          console.error("Error loading 3D model in ProductViewer:", error);
          if (isMounted) {
            setLoadError("Could not load 3D GLB model. Displaying stylized preview.");
            setLoading(false);
            createStylizedPlaceholder();
          }
        }
      );
    } else {
      createStylizedPlaceholder();
      setLoading(false);
    }

    function createStylizedPlaceholder() {
      const group = new THREE.Group();
      const geom = new THREE.TorusKnotGeometry(0.7, 0.22, 120, 16, 2, 3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        metalness: 0.7,
        roughness: 0.2,
        wireframe: isWireframe
      });
      const placeholderMesh = new THREE.Mesh(geom, mat);
      group.add(placeholderMesh);
      scene.add(group);
      modelRef.current = group;
      setMeshCount(1);
    }

    // 10. Temporary Vectors for CSS3D target tracking
    const tempWorldPos = new THREE.Vector3();
    const tempWorldQuat = new THREE.Quaternion();
    const tempWorldScale = new THREE.Vector3();

    // 11. Render & Animation Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Synchronize CSS3D YouTube screen position and rotation with target 3D mesh
      if (cssObject && cssTargetNodeRef.current) {
        const tNode = cssTargetNodeRef.current;
        tNode.getWorldPosition(tempWorldPos);
        tNode.getWorldQuaternion(tempWorldQuat);
        tNode.getWorldScale(tempWorldScale);

        if (tNode.geometry) {
          const slotIdx = typeof config.videoTargetMaterialIndex === 'number'
            ? config.videoTargetMaterialIndex
            : (typeof tNode.userData?.videoTargetMaterialIndex === 'number'
                ? tNode.userData.videoTargetMaterialIndex
                : 0);
          const frame = computeGeometrySurfaceFrame(tNode, slotIdx);

          const uScale = Number(config.videoScale ?? tNode.userData?.videoScale ?? 1.0);
          const uOffsetX = Number(config.videoOffsetX ?? tNode.userData?.videoOffsetX ?? 0.0);
          const uOffsetY = Number(config.videoOffsetY ?? tNode.userData?.videoOffsetY ?? 0.0);
          const uOffsetZ = Number(config.videoOffsetZ ?? tNode.userData?.videoOffsetZ ?? 0.0);
          const uRot = Number(config.videoRotation ?? tNode.userData?.videoRotation ?? 0.0);

          const localPos = frame.localCenter.clone().addScaledVector(frame.localNormal, 0.005 + uOffsetZ);
          localPos.addScaledVector(frame.localRight, uOffsetX);
          localPos.addScaledVector(frame.localUp, uOffsetY);
          localPos.applyMatrix4(tNode.matrixWorld);
          tempWorldPos.copy(localPos);

          let quat = frame.worldQuat.clone();
          if (uRot !== 0) {
            const rotQ = new THREE.Quaternion().setFromAxisAngle(frame.worldNormal, (uRot * Math.PI) / 180);
            quat = rotQ.multiply(quat);
          }

          cssObject.position.copy(tempWorldPos);
          cssObject.quaternion.copy(quat);

          const effScale = baseCssScale * uScale;
          cssObject.scale.set(
            effScale * Math.abs(tempWorldScale.x || 1),
            effScale * Math.abs(tempWorldScale.y || 1),
            effScale * Math.abs(tempWorldScale.z || 1)
          );
        } else {
          cssObject.position.copy(tempWorldPos);
          cssObject.quaternion.copy(tempWorldQuat);
          cssObject.scale.set(
            baseCssScale * Math.abs(tempWorldScale.x || 1),
            baseCssScale * Math.abs(tempWorldScale.y || 1),
            baseCssScale * Math.abs(tempWorldScale.z || 1)
          );
        }
      }

      // Render WebGL 3D scene
      renderer.render(scene, camera);

      // Render CSS3D screen overlay
      if (cssRenderer && cssScene) {
        cssRenderer.render(cssScene, camera);
      }
    };
    animate();

    // 12. Unlock video autoplay on user interaction
    const handleUserUnlock = () => {
      if (videoEl && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
    };
    const mountEl = mountRef.current;
    mountEl?.addEventListener('pointerdown', handleUserUnlock, { passive: true });

    // 13. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
          cssRenderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(mountRef.current);

    // Cleanup
    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      mountEl?.removeEventListener('pointerdown', handleUserUnlock);

      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.src = '';
        videoElRef.current.load();
      }
      if (videoTextureRef.current) {
        videoTextureRef.current.dispose();
      }

      if (renderer) {
        if (renderer.domElement) {
          renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
          if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
            mountRef.current.removeChild(renderer.domElement);
          }
        }
        if (typeof renderer.forceContextLoss === 'function') {
          renderer.forceContextLoss();
        }
        renderer.dispose();
      }

      if (cssRenderer && cssRenderer.domElement) {
        if (mountRef.current && mountRef.current.contains(cssRenderer.domElement)) {
          mountRef.current.removeChild(cssRenderer.domElement);
        }
      }

      if (scene) {
        scene.traverse((obj) => {
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
        scene.clear();
      }
      if (cssScene) {
        cssScene.clear();
      }
    };
  }, [modelUrl, videoUrl, configKey]);

  const hasActiveVideo = !!activeVideoType;
  const ytVideoId = activeVideoType === 'youtube' ? extractYouTubeId(resolvedVideoUrl) : '';

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing relative" />

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
              <span className={`backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
                activeVideoType === 'youtube'
                  ? 'bg-red-950/80 text-red-300 border-red-500/40'
                  : 'bg-purple-950/80 text-purple-300 border-purple-500/40'
              }`}>
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
                onClick={() => setShowPip(prev => !prev)}
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
          <div className={`${(config?.aspectRatio === '9:16' || config?.videoAspectRatio === '9:16' || isYouTubeShortUrl(resolvedVideoUrl)) ? 'aspect-[9/16] max-h-72' : 'aspect-video'} w-full bg-black relative flex items-center justify-center`}>
            {activeVideoType === 'youtube' && ytVideoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&mute=${isMuted ? '1' : '0'}&controls=1`}
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

      {/* Bottom Floating Interactive Control Pill */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/80 backdrop-blur-lg px-3 py-1.5 rounded-full border border-white/15 shadow-2xl">
        <button
          type="button"
          onClick={toggleAutoRotate}
          className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            autoRotate
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle 360 Auto-Rotation"
        >
          <span className={`material-symbols-outlined text-sm ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
            sync
          </span>
          <span>{autoRotate ? 'Rotating' : 'Paused'}</span>
        </button>

        <div className="w-px h-4 bg-white/20"></div>

        <button
          type="button"
          onClick={resetCamera}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-mono text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all cursor-pointer"
          title="Reset Front Center Framing"
        >
          <span className="material-symbols-outlined text-sm">center_focus_strong</span>
          <span>Reset</span>
        </button>

        <div className="w-px h-4 bg-white/20"></div>

        <button
          type="button"
          onClick={toggleWireframe}
          className={`px-2.5 py-1.5 rounded-full text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
            isWireframe
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-neutral-400 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle Wireframe Mesh"
        >
          <span className="material-symbols-outlined text-sm">grid_view</span>
          <span>Wireframe</span>
        </button>

        {assetId && (
          <>
            <div className="w-px h-4 bg-white/20"></div>
            <a
              href={`/ar/${assetId}`}
              className="px-3 py-1.5 rounded-full text-[11px] font-mono font-bold bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white flex items-center gap-1 shadow-md transition-all cursor-pointer"
              title="Launch Live WebAR Camera on Mobile"
            >
              <span className="material-symbols-outlined text-sm">view_in_ar</span>
              <span>Try In AR</span>
            </a>
          </>
        )}
      </div>

      {/* Subtle Bottom Drag Hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
          🖱️ Drag to Rotate • Scroll to Zoom
        </span>
      </div>
    </div>
  );
}
