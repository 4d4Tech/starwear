import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export default function ProductViewer({ modelUrl, videoUrl, config = {}, assetName = '3D Digital Asset', assetId = '' }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [meshCount, setMeshCount] = useState(0);

  // References to allow UI buttons to communicate with Three.js render loop
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const defaultCamPosRef = useRef(new THREE.Vector3(0, 1.2, 2.5));
  const videoElRef = useRef(null);
  const videoTextureRef = useRef(null);

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

  useEffect(() => {
    if (!mountRef.current) return;

    let scene, camera, renderer, controls, animationFrameId;
    let isMounted = true;

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 600;

    // 1. Scene Setup
    scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#0d1117');

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    camera.position.set(0, 1.2, 2.5);
    cameraRef.current = camera;

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);

    // 4. OrbitControls Setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controls.maxDistance = 20;
    controls.minDistance = 0.2;
    controlsRef.current = controls;

    // 5. Lighting Setup
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

    // Setup Video Texture Layer if videoUrl is supplied
    let videoTexture = null;
    let videoEl = null;
    if (videoUrl) {
      try {
        videoEl = document.createElement('video');
        videoEl.src = videoUrl;
        videoEl.crossOrigin = 'anonymous';
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.play().catch(err => console.warn('ProductViewer video autoplay prevented:', err));
        videoElRef.current = videoEl;

        videoTexture = new THREE.VideoTexture(videoEl);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTextureRef.current = videoTexture;

        const isFlipX = !!(config.videoFlipX || config.video_flip_x);
        if (isFlipX) {
          videoTexture.wrapS = THREE.RepeatWrapping;
          videoTexture.repeat.set(-1, 1);
          videoTexture.offset.set(1, 0);
          videoTexture.matrixAutoUpdate = true;
          videoTexture.updateMatrix();
        }
      } catch (videoErr) {
        console.warn('Could not initialize video texture:', videoErr);
      }
    }

    // Helper: Apply video texture and material overrides to mesh
    const applyMeshStyling = (rootObject) => {
      let totalMeshes = 0;
      const targetMeshKey = config.videoTargetMesh || 'auto';

      rootObject.traverse(node => {
        if (node.isMesh) {
          totalMeshes++;

          // Apply Video Texture if available
          if (videoTexture) {
            let shouldAttachVideo = false;
            if (targetMeshKey === 'all') {
              shouldAttachVideo = true;
            } else if (targetMeshKey !== 'auto') {
              shouldAttachVideo = (node.name === targetMeshKey || node.uuid === targetMeshKey);
            } else {
              // Auto mode: attach to screen/video mesh or primary mesh
              const lower = node.name.toLowerCase();
              shouldAttachVideo = lower.includes('screen') || lower.includes('video') || lower.includes('display') || totalMeshes === 1;
            }

            if (shouldAttachVideo && node.material) {
              const applyToMat = (m) => {
                m.map = videoTexture;
                m.needsUpdate = true;
              };
              if (Array.isArray(node.material)) {
                node.material.forEach(applyToMat);
              } else {
                applyToMat(node.material);
              }
            }
          }

          // Apply Material PBR configs if defined
          if (node.material) {
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

          // Apply custom meshOverrides if saved from ARTest
          if (config.meshOverrides) {
            const ovr = config.meshOverrides[node.name] || config.meshOverrides[node.uuid];
            if (ovr) {
              if (ovr.position) node.position.set(ovr.position.x, ovr.position.y, ovr.position.z);
              if (ovr.scale) node.scale.set(ovr.scale.x, ovr.scale.y, ovr.scale.z);
              if (ovr.material && node.material) {
                const mat = Array.isArray(node.material) ? node.material[0] : node.material;
                if (ovr.material.color && mat.color) mat.color.set(ovr.material.color);
                if (ovr.material.metalness !== undefined) mat.metalness = ovr.material.metalness;
                if (ovr.material.roughness !== undefined) mat.roughness = ovr.material.roughness;
                if (ovr.material.emissive && mat.emissive) mat.emissive.set(ovr.material.emissive);
                mat.needsUpdate = true;
              }
            }
          }
        }
      });

      setMeshCount(totalMeshes);
    };

    // 6. Load 3D Asset
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

          // Create an anchor group to rotate and scale cleanly
          const modelGroup = new THREE.Group();
          modelGroup.add(model);
          scene.add(modelGroup);

          // Apply materials & video textures
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
      // Fallback geometry if modelUrl is empty or fails
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

    // 7. Render & Animation Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(mountRef.current);

    // Cleanup
    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.src = '';
        videoElRef.current.load();
      }
      if (videoTextureRef.current) {
        videoTextureRef.current.dispose();
      }

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [modelUrl, videoUrl, config]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Badge Bar */}
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            3D Interactive Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          {meshCount > 0 && (
            <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-neutral-400 border border-white/10">
              {meshCount} Mesh{meshCount > 1 ? 'es' : ''}
            </span>
          )}
          {videoUrl && (
            <span className="bg-purple-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono font-bold text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">play_circle</span>
              Video Layer
            </span>
          )}
        </div>
      </div>

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

      {/* Error Banner */}
      {loadError && (
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

