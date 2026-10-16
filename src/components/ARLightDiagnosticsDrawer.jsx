import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';

/**
 * ARLightDiagnosticsDrawer
 * 
 * Comprehensive In-Browser DevTool & Telemetry HUD for WebAR lighting diagnostics.
 * Compatible with mobile screen views (slide-up bottom sheet / right drawer).
 * 
 * Features:
 * - Real-time point light & target mesh telemetry (world matrices, distance, vertex normals, material types)
 * - Interactive controls: intensity multiplier, decay mode (0, 1, 2), distance cutoff, local X/Y/Z position
 * - Material override mode: replaces model materials with white MeshStandardMaterial to isolate shader/texture bugs
 * - Shader recompile trigger: forces material.needsUpdate on all scene meshes
 * - Visual helpers: PointLightHelper & wireframe distance sphere
 * - System event log viewer & clipboard export
 */
export default function ARLightDiagnosticsDrawer({
  isOpen,
  onClose,
  sceneRef,
  diagnosticLogs = [],
  trackingStatus = 'INITIALIZING',
  cameraEnabled = true,
  onForceRender,
  forceShowModel = false,
  requireSuperUser = false
}) {
  const { currentUser, isSuperAdmin, isSuperUser } = useAuth();
  const isSuperUserAuthenticated = Boolean(
    currentUser && (
      isSuperAdmin || 
      isSuperUser || 
      currentUser.email?.toLowerCase() === 'brandonrobinson81@gmail.com'
    )
  );

  // If superuser is required and the user is not authenticated as superuser, render nothing
  if (requireSuperUser && !isSuperUserAuthenticated) {
    return null;
  }

  const [activeTab, setActiveTab] = useState('controls'); // 'controls' | 'telemetry' | 'logs'
  const [pinHud, setPinHud] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Mobile height toggle (50vh vs 88vh)

  // Scene discovery & active lights
  const [discoveredLights, setDiscoveredLights] = useState([]);
  const [selectedLightId, setSelectedLightId] = useState(null);
  const [targetMeshInfo, setTargetMeshInfo] = useState(null);
  const [webglInfo, setWebglInfo] = useState({ calls: 0, geometries: 0, textures: 0 });

  // Interactive Live Override States
  const [intensityMultiplier, setIntensityMultiplier] = useState(1);
  const [decayOverride, setDecayOverride] = useState(null); // null = original, 0 = constant, 1 = linear, 2 = physical
  const [distanceOverride, setDistanceOverride] = useState(null);
  const [posOffset, setPosOffset] = useState({ x: 0, y: 0, z: 0 });
  const [materialOverrideActive, setMaterialOverrideActive] = useState(false);
  const [showHelpers, setShowHelpers] = useState(true);
  const [showDistanceSpheres, setShowDistanceSpheres] = useState(true);
  const [showBulbEmitters, setShowBulbEmitters] = useState(false);

  // References to attached Three.js helpers
  const helperObjectsRef = useRef(new Map()); // lightUuid -> { helper, sphere }
  const originalMaterialsRef = useRef(new Map()); // meshUuid -> originalMaterial

  // Fetch the active Three.js Scene and Renderer
  const getSceneAndRenderer = useCallback(() => {
    const sceneEl = sceneRef?.current || document.querySelector('a-scene');
    if (!sceneEl) return { scene: null, renderer: null, sceneEl: null };
    const renderer = sceneEl.renderer || null;
    const scene = sceneEl.object3D || null;
    return { scene, renderer, sceneEl };
  }, [sceneRef]);

  // Telemetry Poller: scans scene every 200ms when drawer is open or HUD is pinned
  useEffect(() => {
    if (!isOpen && !pinHud) return;

    const pollInterval = setInterval(() => {
      const { scene, renderer } = getSceneAndRenderer();
      if (!scene) return;

      const lights = [];
      let detectedMesh = null;

      // Ensure world matrices are up-to-date across target entity and scene
      const targetAnchorObj = document.getElementById('target-entity')?.object3D ||
        document.getElementById('preview-anchor')?.object3D ||
        scene;

      if (targetAnchorObj) {
        targetAnchorObj.matrixWorldNeedsUpdate = true;
        targetAnchorObj.updateMatrixWorld(true);
      } else {
        scene.updateMatrixWorld(true);
      }

      // 1. Traverse scene graph to find lights
      scene.traverse((node) => {
        if (!node) return;

        // Collect point and spot lights
        if (node.isLight) {
          const worldPos = new THREE.Vector3();
          node.getWorldPosition(worldPos);

          lights.push({
            id: node.userData?.lightId || node.uuid,
            uuid: node.uuid,
            name: node.name || `${node.type || 'Light'} (${node.id})`,
            type: node.type || (node.isPointLight ? 'PointLight' : node.isDirectionalLight ? 'DirectionalLight' : 'Light'),
            colorHex: node.color ? '#' + node.color.getHexString() : '#ffffff',
            intensity: node.intensity,
            decay: node.decay !== undefined ? node.decay : null,
            distance: node.distance !== undefined ? node.distance : null,
            localPos: { x: Number(node.position.x.toFixed(3)), y: Number(node.position.y.toFixed(3)), z: Number(node.position.z.toFixed(3)) },
            worldPos: { x: Number(worldPos.x.toFixed(3)), y: Number(worldPos.y.toFixed(3)), z: Number(worldPos.z.toFixed(3)) },
            visible: Boolean(node.visible),
            rawLight: node
          });
        }
      });

      // 2. Prioritize primary target mesh inside active anchor (model or 3D typography)
      targetAnchorObj.traverse((node) => {
        if (!detectedMesh && node.isMesh && node.geometry &&
            !node.name?.startsWith('Helper_') &&
            !node.name?.startsWith('Bulb_') &&
            !node.name?.startsWith('DistanceSphere_') &&
            !node.name?.startsWith('Anchor_')) {
          const meshWorldPos = new THREE.Vector3();
          node.getWorldPosition(meshWorldPos);
          const mat = Array.isArray(node.material) ? node.material[0] : node.material;
          detectedMesh = {
            name: node.name || 'Model Mesh',
            uuid: node.uuid,
            materialType: mat ? mat.type : 'Unknown',
            hasNormals: Boolean(node.geometry.attributes && node.geometry.attributes.normal),
            isDoubleSided: mat ? mat.side === THREE.DoubleSide : false,
            worldPos: { x: Number(meshWorldPos.x.toFixed(3)), y: Number(meshWorldPos.y.toFixed(3)), z: Number(meshWorldPos.z.toFixed(3)) },
            vertexCount: node.geometry.attributes?.position?.count || 0
          };
        }
      });

      // Fallback search across root scene if not found under target anchor
      if (!detectedMesh) {
        scene.traverse((node) => {
          if (!detectedMesh && node.isMesh && node.geometry &&
              !node.name?.startsWith('Helper_') &&
              !node.name?.startsWith('Bulb_') &&
              !node.name?.startsWith('DistanceSphere_') &&
              !node.name?.startsWith('Anchor_')) {
            const meshWorldPos = new THREE.Vector3();
            node.getWorldPosition(meshWorldPos);
            const mat = Array.isArray(node.material) ? node.material[0] : node.material;
            detectedMesh = {
              name: node.name || 'Model Mesh',
              uuid: node.uuid,
              materialType: mat ? mat.type : 'Unknown',
              hasNormals: Boolean(node.geometry.attributes && node.geometry.attributes.normal),
              isDoubleSided: mat ? mat.side === THREE.DoubleSide : false,
              worldPos: { x: Number(meshWorldPos.x.toFixed(3)), y: Number(meshWorldPos.y.toFixed(3)), z: Number(meshWorldPos.z.toFixed(3)) },
              vertexCount: node.geometry.attributes?.position?.count || 0
            };
          }
        });
      }

      setDiscoveredLights(lights);
      setTargetMeshInfo(detectedMesh);

      // Select first point light by default if none selected
      if (!selectedLightId && lights.length > 0) {
        const firstPoint = lights.find((l) => l.type === 'PointLight') || lights[0];
        setSelectedLightId(firstPoint.id);
      }

      if (renderer && renderer.info) {
        setWebglInfo({
          calls: renderer.info.render?.calls || 0,
          geometries: renderer.info.memory?.geometries || 0,
          textures: renderer.info.memory?.textures || 0
        });
      }
    }, 200);

    return () => clearInterval(pollInterval);
  }, [isOpen, pinHud, getSceneAndRenderer, selectedLightId]);

  // Synchronize Helpers (PointLightHelper & Wireframe Distance Sphere)
  useEffect(() => {
    const { scene } = getSceneAndRenderer();
    if (!scene) return;

    const currentHelpers = helperObjectsRef.current;

    // Clean up previous helpers if disabled
    if (!showHelpers) {
      currentHelpers.forEach(({ helper, sphere }) => {
        if (helper && helper.parent) helper.parent.remove(helper);
        if (sphere && sphere.parent) sphere.parent.remove(sphere);
        if (helper?.dispose) helper.dispose();
        if (sphere?.geometry) sphere.geometry.dispose();
        if (sphere?.material) sphere.material.dispose();
      });
      currentHelpers.clear();
      return;
    }

    // Attach or update helpers for discovered lights
    discoveredLights.forEach((lightMeta) => {
      const light = lightMeta.rawLight;
      if (!light || !light.parent) return;

      let entry = currentHelpers.get(light.uuid);
      if (!entry) {
        let helper = null;
        let sphere = null;

        if (light.isPointLight) {
          helper = new THREE.PointLightHelper(light, 0.35, light.color);
          helper.name = `Helper_${light.uuid}`;
          light.parent.add(helper);

          if (showDistanceSpheres && (light.distance > 0 || distanceOverride > 0)) {
            const rad = distanceOverride !== null ? distanceOverride : (light.distance || 2);
            const sphereGeo = new THREE.SphereGeometry(rad, 16, 8);
            const sphereMat = new THREE.MeshBasicMaterial({
              color: light.color,
              wireframe: true,
              transparent: true,
              opacity: 0.25,
              depthWrite: false
            });
            sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.name = `DistanceSphere_${light.uuid}`;
            sphere.position.copy(light.position);
            light.parent.add(sphere);
          }
        }

        entry = { helper, sphere };
        currentHelpers.set(light.uuid, entry);
      } else {
        if (entry.helper && typeof entry.helper.update === 'function') {
          entry.helper.update();
        }
        if (entry.sphere) {
          entry.sphere.position.copy(light.position);
          entry.sphere.visible = showDistanceSpheres;
        }
      }
    });

    return () => {
      // Cleanup on unmount
    };
  }, [discoveredLights, showHelpers, showDistanceSpheres, distanceOverride, getSceneAndRenderer]);

  // Apply Live Parametric Overrides (Intensity, Decay, Distance, Position) to Selected Light
  const activeLight = useMemo(() => {
    return discoveredLights.find((l) => l.id === selectedLightId || l.uuid === selectedLightId) || null;
  }, [discoveredLights, selectedLightId]);

  useEffect(() => {
    if (!activeLight || !activeLight.rawLight) return;
    const light = activeLight.rawLight;

    // Cache initial values on userData if not already present
    if (light.userData.__origIntensity === undefined) {
      light.userData.__origIntensity = light.intensity;
      light.userData.__origDecay = light.decay;
      light.userData.__origDistance = light.distance;
      light.userData.__origPos = light.position.clone();
    }

    // Apply intensity multiplier
    const baseIntensity = light.userData.__origIntensity || 2.5;
    light.intensity = baseIntensity * intensityMultiplier;

    // Apply decay override
    if (decayOverride !== null) {
      light.decay = decayOverride;
    }

    // Apply distance cutoff override
    if (distanceOverride !== null) {
      light.distance = distanceOverride;
    }

    // Apply position offsets
    if (light.userData.__origPos) {
      light.position.set(
        light.userData.__origPos.x + posOffset.x,
        light.userData.__origPos.y + posOffset.y,
        light.userData.__origPos.z + posOffset.z
      );
    }

    light.matrixWorldNeedsUpdate = true;
    if (light.parent) light.parent.updateMatrixWorld(true);
  }, [activeLight, intensityMultiplier, decayOverride, distanceOverride, posOffset]);

  // Toggle Material Override (White MeshStandardMaterial to isolate normal/texture bugs)
  const toggleMaterialOverride = () => {
    const { scene } = getSceneAndRenderer();
    if (!scene) return;

    const nextActive = !materialOverrideActive;
    setMaterialOverrideActive(nextActive);

    scene.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (node.name?.startsWith('Helper_') || node.name?.startsWith('Bulb_') || node.name?.startsWith('DistanceSphere_') || node.name?.startsWith('Anchor_')) return;

      if (nextActive) {
        if (!originalMaterialsRef.current.has(node.uuid)) {
          originalMaterialsRef.current.set(node.uuid, node.material);
        }
        node.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.45,
          metalness: 0.1,
          side: THREE.DoubleSide
        });
        node.material.needsUpdate = true;
      } else {
        const orig = originalMaterialsRef.current.get(node.uuid);
        if (orig) {
          node.material = orig;
          node.material.needsUpdate = true;
        }
      }
    });
  };

  // Force Shader Recompilation
  const handleForceRecompile = useCallback((silent = false) => {
    const { scene, sceneEl } = getSceneAndRenderer();
    if (!scene) return;

    if (sceneEl?.renderer?.renderLists?.dispose) {
      try { sceneEl.renderer.renderLists.dispose(); } catch (e) {}
    }

    let recompiledCount = 0;
    scene.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          m.needsUpdate = true;
          recompiledCount++;
        });
      }
    });

    // Also trigger custom light components if attached
    if (sceneEl) {
      sceneEl.querySelectorAll('[ar-custom-lights]').forEach((el) => {
        const comp = el.components?.['ar-custom-lights'];
        if (comp && typeof comp.refreshSceneMaterials === 'function') {
          comp.refreshSceneMaterials();
        }
      });
    }

    if (!silent) {
      alert(`Recompiled shader programs for ${recompiledCount} material instance(s).`);
    }
  }, [getSceneAndRenderer]);

  // Inject a high-visibility reference PointLight directly into the active scene/target anchor
  const handleInjectTestLight = useCallback(() => {
    const { scene } = getSceneAndRenderer();
    if (!scene) return null;

    // Attach to target-entity (tracked marker anchor) if present, or preview-anchor, or scene
    const targetAnchor = document.getElementById('target-entity')?.object3D ||
      document.getElementById('preview-anchor')?.object3D ||
      document.getElementById('ar-custom-lights-target')?.object3D ||
      scene;

    // Check if test light was already injected
    let existingTestLight = null;
    targetAnchor.traverse((node) => {
      if (node.userData?.isDevToolTestLight) {
        existingTestLight = node;
      }
    });

    if (existingTestLight) {
      existingTestLight.intensity = 35;
      existingTestLight.decay = 0;
      existingTestLight.visible = true;
      setSelectedLightId(existingTestLight.uuid);
      handleForceRecompile(true);
      return existingTestLight;
    }

    const testLight = new THREE.PointLight(0x38bdf8, 35, 0, 0);
    testLight.name = 'DevTool Test PointLight';
    testLight.position.set(0, 0.6, 0.8);
    testLight.userData = {
      isDevToolTestLight: true,
      lightId: `devtool_pointlight_${Date.now()}`,
      __origIntensity: 35,
      __origDecay: 0,
      __origDistance: 0,
      __origPos: testLight.position.clone()
    };

    targetAnchor.add(testLight);
    testLight.updateMatrixWorld(true);

    const helper = new THREE.PointLightHelper(testLight, 0.25, 0x38bdf8);
    helper.name = `Helper_${testLight.uuid}`;
    targetAnchor.add(helper);

    helperObjectsRef.current.set(testLight.uuid, { helper, sphere: null });
    handleForceRecompile(true);
    setSelectedLightId(testLight.userData.lightId);

    return testLight;
  }, [getSceneAndRenderer, handleForceRecompile]);

  // Instant Diagnostic Flash: Sets Decay to 0, boosts intensity 50x, forces recompilation
  const handleInstantDiagnosticFlash = useCallback(() => {
    setDecayOverride(0);
    setIntensityMultiplier(50);
    setDistanceOverride(0);
    setShowHelpers(true);

    let lightToFlash = activeLight?.rawLight;
    if (!lightToFlash) {
      lightToFlash = handleInjectTestLight();
    }

    if (lightToFlash) {
      lightToFlash.decay = 0;
      const base = lightToFlash.userData?.__origIntensity || 5.0;
      lightToFlash.intensity = 50 * base;
      lightToFlash.distance = 0;
      lightToFlash.matrixWorldNeedsUpdate = true;
      if (lightToFlash.parent) lightToFlash.parent.updateMatrixWorld(true);
    }

    handleForceRecompile(true);
  }, [activeLight, handleInjectTestLight, handleForceRecompile]);

  // Toggle Bulb Emitters (check if bulb geometry was occluding lighting rays)
  const handleToggleBulbs = () => {
    const { scene } = getSceneAndRenderer();
    if (!scene) return;
    const nextVal = !showBulbEmitters;
    setShowBulbEmitters(nextVal);

    scene.traverse((node) => {
      if (node.name?.startsWith('Bulb_')) {
        node.visible = nextVal;
      }
    });
  };

  // Reset all overrides to original batch config
  const handleResetOverrides = () => {
    setIntensityMultiplier(1);
    setDecayOverride(null);
    setDistanceOverride(null);
    setPosOffset({ x: 0, y: 0, z: 0 });
    if (materialOverrideActive) toggleMaterialOverride();

    const { scene } = getSceneAndRenderer();
    if (!scene) return;

    scene.traverse((node) => {
      if (node.isLight && node.userData?.__origIntensity !== undefined) {
        node.intensity = node.userData.__origIntensity;
        node.decay = node.userData.__origDecay;
        node.distance = node.userData.__origDistance;
        if (node.userData.__origPos) node.position.copy(node.userData.__origPos);
        node.matrixWorldNeedsUpdate = true;
      }
    });
  };

  // Copy Complete Diagnostic Report to Clipboard
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      trackingStatus,
      webgl: webglInfo,
      lights: discoveredLights.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        color: l.colorHex,
        intensity: l.intensity,
        decay: l.decay,
        distance: l.distance,
        localPos: l.localPos,
        worldPos: l.worldPos,
        visible: l.visible
      })),
      targetMesh: targetMeshInfo,
      activeOverrides: {
        intensityMultiplier,
        decayOverride,
        distanceOverride,
        posOffset,
        materialOverrideActive
      },
      logs: diagnosticLogs.slice(-20)
    };

    navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
    alert('Diagnostics telemetry snapshot copied to clipboard!');
  };

  // Calculate distance between selected light and target mesh
  const distanceToTarget = useMemo(() => {
    if (!activeLight || !targetMeshInfo) return null;
    const lPos = new THREE.Vector3(activeLight.worldPos.x, activeLight.worldPos.y, activeLight.worldPos.z);
    const mPos = new THREE.Vector3(targetMeshInfo.worldPos.x, targetMeshInfo.worldPos.y, targetMeshInfo.worldPos.z);
    return lPos.distanceTo(mPos).toFixed(3);
  }, [activeLight, targetMeshInfo]);

  return (
    <>
      {/* Pinned Minimal Viewport HUD (Visible when drawer is closed if pinned) */}
      {pinHud && !isOpen && (
        <div className="fixed top-16 right-3 z-40 bg-black/80 backdrop-blur-md border border-amber-500/40 p-2.5 rounded-xl text-white font-mono text-[10px] space-y-1 shadow-2xl max-w-[240px] pointer-events-none select-none">
          <div className="flex items-center justify-between text-amber-400 font-bold border-b border-white/10 pb-1">
            <span>⚡ LIGHT HUD</span>
            <span>{trackingStatus}</span>
          </div>
          {activeLight ? (
            <>
              <div>L: {activeLight.name} ({activeLight.type})</div>
              <div>Int: {activeLight.intensity.toFixed(1)} | Dec: {activeLight.decay ?? 'N/A'}</div>
              <div>Dist to Mesh: <span className="text-emerald-400 font-bold">{distanceToTarget ?? 'N/A'}m</span></div>
            </>
          ) : (
            <div className="text-neutral-400">No active lights in scene</div>
          )}
        </div>
      )}

      {/* Main Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-start pointer-events-auto">
          {/* Non-dimming / Pass-through upper tap zone on mobile: allows user to see camera feed and marker while open */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black/25 sm:bg-black/60 transition-opacity cursor-pointer"
            title="Tap outside to dismiss"
          />

          {/* Drawer Sheet: Bottom sheet on mobile (default 50vh leaving camera feed in view) / Right sidebar on desktop */}
          <div className={`relative w-full sm:max-w-md sm:ml-auto ${
            isExpanded ? 'h-[88vh]' : 'h-[50vh]'
          } sm:h-full bg-slate-950/95 backdrop-blur-2xl border-t sm:border-t-0 sm:border-l border-amber-500/30 text-white shadow-2xl flex flex-col font-sans transition-all duration-200 overflow-hidden rounded-t-3xl sm:rounded-none`}>
            {/* Mobile Drag Indicator / Height Toggle */}
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="sm:hidden w-full pt-2 pb-1 flex flex-col items-center cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="w-12 h-1.5 bg-neutral-600 rounded-full mb-1" />
              <span className="text-[9px] font-mono text-neutral-400">
                {isExpanded ? 'TAP TO COLLAPSE (50% VIEW)' : 'TAP TO EXPAND (88% VIEW)'}
              </span>
            </div>

            {/* Header */}
            <div className="px-4 py-2 sm:py-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white uppercase font-mono">
                  AR Light DevTools & HUD
                </h2>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="sm:hidden px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                  title={isExpanded ? 'Collapse to half screen' : 'Expand to full screen'}
                >
                  {isExpanded ? 'HALF' : 'EXPAND'}
                </button>
                <button
                  type="button"
                  onClick={() => setPinHud(!pinHud)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                    pinHud ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                  title="Pin minimal HUD to screen when drawer is closed"
                >
                  {pinHud ? 'PINNED' : 'PIN HUD'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-800 shrink-0 bg-neutral-900/40 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('controls')}
                className={`flex-1 py-2.5 text-center font-bold transition-colors border-b-2 ${
                  activeTab === 'controls'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                🎮 Controls
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('telemetry')}
                className={`flex-1 py-2.5 text-center font-bold transition-colors border-b-2 ${
                  activeTab === 'telemetry'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                📊 Telemetry ({discoveredLights.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-2.5 text-center font-bold transition-colors border-b-2 ${
                  activeTab === 'logs'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                📜 Logs ({diagnosticLogs.length})
              </button>
            </div>

            {/* Tab Contents: Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: INTERACTIVE CONTROLS */}
              {activeTab === 'controls' && (
                <div className="space-y-3.5">
                  {/* Live Marker & Scene Tracking Status Banner */}
                  <div className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between text-xs font-mono transition-all ${
                    trackingStatus === 'DETECTED'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : trackingStatus === 'SCANNING'
                      ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${
                        trackingStatus === 'DETECTED'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : trackingStatus === 'SCANNING'
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-indigo-400'
                      }`} />
                      <div>
                        <div className="font-bold uppercase tracking-wider text-[11px]">
                          {cameraEnabled
                            ? (trackingStatus === 'DETECTED' ? 'Marker Tracked ✓' : 'Scanning Marker...')
                            : '3D Preview Studio'}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-normal">
                          {cameraEnabled
                            ? (trackingStatus === 'DETECTED' ? 'Target locked & updating' : 'Point camera at target marker')
                            : 'Interactive OrbitControls'}
                        </div>
                      </div>
                    </div>

                    {onForceRender && cameraEnabled && (
                      <button
                        type="button"
                        onClick={onForceRender}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                          forceShowModel
                            ? 'bg-emerald-500 text-black border-emerald-300 shadow-md'
                            : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white'
                        }`}
                        title="Bypass marker tracking and render model directly in camera"
                      >
                        {forceShowModel ? 'FORCE: ON' : 'FORCE RENDER'}
                      </button>
                    )}
                  </div>

                  {/* Quick Diagnostic 1-Tap Actions */}
                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    <button
                      type="button"
                      onClick={handleInstantDiagnosticFlash}
                      className="px-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] shadow-lg flex flex-col items-center justify-center text-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                      title="Sets Decay to 0, boosts intensity to 50x, and forces shader recompilation"
                    >
                      <span className="flex items-center gap-1">⚡ FLASH</span>
                      <span className="text-[9px] font-semibold opacity-90">Decay 0 + 50x</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleMaterialOverride}
                      className={`px-2 py-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 active:scale-95 cursor-pointer ${
                        materialOverrideActive
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <span>{materialOverrideActive ? '⚪ WHITE: ON' : '🎨 WHITE MAT'}</span>
                      <span className="text-[9px] font-normal opacity-75">Override PBR</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInjectTestLight}
                      className="px-2 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 active:scale-95 cursor-pointer"
                      title="Injects a bright test point light into the active scene anchor"
                    >
                      <span>💡 INJECT LIGHT</span>
                      <span className="text-[9px] font-normal text-amber-400">+ PointLight</span>
                    </button>
                  </div>

                  {/* Active Light Status & Distance Reach Indicator */}
                  {activeLight && (
                    <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-neutral-400">Target Light: <strong className="text-white">{activeLight.name}</strong></span>
                        <span className="text-amber-400 font-bold uppercase">{activeLight.type}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-neutral-400">Distance to Model:</span>
                        <span className={`font-bold ${
                          distanceToTarget !== null && activeLight.distance > 0 && Number(distanceToTarget) > activeLight.distance
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}>
                          {distanceToTarget ? `${distanceToTarget}m` : 'Detecting mesh...'}
                        </span>
                      </div>
                      {distanceToTarget !== null && activeLight.distance > 0 && Number(distanceToTarget) > activeLight.distance && (
                        <div className="text-[10px] text-rose-300 bg-rose-950/60 p-1.5 rounded border border-rose-800/60 leading-tight">
                          ⚠️ Distance cutoff is {activeLight.distance}m, but model is {distanceToTarget}m away! Set Cutoff to 0m (infinite) or increase distance.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Select Active Light */}
                  <div>
                    <label className="text-[11px] font-mono text-neutral-400 block mb-1 font-semibold uppercase">
                      Select Target Light Source:
                    </label>
                    <select
                      value={selectedLightId || ''}
                      onChange={(e) => setSelectedLightId(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    >
                      {discoveredLights.length === 0 && <option value="">No lights found in scene</option>}
                      {discoveredLights.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} [{l.type}] - Int: {l.intensity}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Diagnostic Toggles Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={toggleMaterialOverride}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1 border ${
                        materialOverrideActive
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <span>{materialOverrideActive ? '⚪ Override: ON' : '🎨 Override Material'}</span>
                      <span className="text-[9px] font-normal opacity-75">White StandardMaterial</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleForceRecompile}
                      className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400 text-neutral-200 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1"
                    >
                      <span>🔄 Force Recompile</span>
                      <span className="text-[9px] font-normal text-neutral-400">Rebuild Shaders</span>
                    </button>
                  </div>

                  {/* Helper Visualizers */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="text-[11px] font-mono text-neutral-300 font-bold uppercase">Visual Aids:</div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>PointLightHelper:</span>
                      <input
                        type="checkbox"
                        checked={showHelpers}
                        onChange={(e) => setShowHelpers(e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Range Distance Sphere:</span>
                      <input
                        type="checkbox"
                        checked={showDistanceSpheres}
                        onChange={(e) => setShowDistanceSpheres(e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Bulb Mesh Emitter:</span>
                      <input
                        type="checkbox"
                        checked={showBulbEmitters}
                        onChange={handleToggleBulbs}
                        className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Falloff / Decay Mode Switcher (Cause A) */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-neutral-300 font-bold uppercase">
                        Decay / Falloff Mode:
                      </span>
                      <span className="text-[10px] font-mono text-amber-400">
                        {decayOverride !== null ? `Override (${decayOverride}.0)` : 'Default Config'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setDecayOverride(0)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                          decayOverride === 0
                            ? 'bg-amber-500 text-black border-amber-300 font-bold'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                        }`}
                        title="Decay 0: Constant illumination across all distances"
                      >
                        0.0 (None)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecayOverride(1)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                          decayOverride === 1
                            ? 'bg-amber-500 text-black border-amber-300 font-bold'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                        }`}
                        title="Decay 1: Linear falloff"
                      >
                        1.0 (Linear)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecayOverride(2)}
                        className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                          decayOverride === 2
                            ? 'bg-amber-500 text-black border-amber-300 font-bold'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                        }`}
                        title="Decay 2: Physical inverse-square decay"
                      >
                        2.0 (Physical)
                      </button>
                    </div>
                  </div>

                  {/* Intensity Multiplier (Cause A: Boost into Physical Lumens) */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-neutral-300 font-bold uppercase">Intensity Boost:</span>
                      <span className="font-mono text-amber-400 font-bold">{intensityMultiplier}x</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-[11px] font-mono">
                      {[1, 5, 20, 100, 500].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setIntensityMultiplier(val)}
                          className={`py-1 rounded border text-center ${
                            intensityMultiplier === val
                              ? 'bg-amber-500 text-black border-amber-300 font-bold'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                          }`}
                        >
                          {val}x
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="1000"
                      value={intensityMultiplier}
                      onChange={(e) => setIntensityMultiplier(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Distance Cutoff Slider */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-neutral-300 font-bold uppercase">Cutoff Distance:</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {distanceOverride !== null ? `${distanceOverride}m` : 'Default'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="0.5"
                      value={distanceOverride ?? (activeLight?.distance || 0)}
                      onChange={(e) => setDistanceOverride(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                      <span>0m (Infinite)</span>
                      <span>25m</span>
                      <span>50m</span>
                    </div>
                  </div>

                  {/* Position Nudge Scrubbers (X, Y, Z) */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2 font-mono text-xs">
                    <div className="text-[11px] text-neutral-300 font-bold uppercase">Local Position Nudge:</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-rose-400">X Offset: {posOffset.x.toFixed(1)}m</div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, x: Number((p.x - 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, x: Number((p.x + 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-emerald-400">Y Offset: {posOffset.y.toFixed(1)}m</div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, y: Number((p.y - 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, y: Number((p.y + 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-sky-400">Z Offset: {posOffset.z.toFixed(1)}m</div>
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, z: Number((p.z - 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setPosOffset((p) => ({ ...p, z: Number((p.z + 0.2).toFixed(1)) }))}
                            className="flex-1 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700 text-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reset Controls Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleResetOverrides}
                      className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-300"
                    >
                      Reset Overrides
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-mono font-bold"
                    >
                      📋 Copy Report
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: LIVE TELEMETRY HUD */}
              {activeTab === 'telemetry' && (
                <div className="space-y-4 font-mono text-xs">
                  {/* Target Mesh Inspection (Cause C) */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1.5">
                    <div className="text-[11px] text-amber-400 font-bold uppercase border-b border-white/10 pb-1">
                      🎯 Target Model Mesh
                    </div>
                    {targetMeshInfo ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Name:</span>
                          <span className="text-white truncate max-w-[200px]">{targetMeshInfo.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Material Type:</span>
                          <span className={targetMeshInfo.materialType === 'MeshBasicMaterial' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                            {targetMeshInfo.materialType} {targetMeshInfo.materialType === 'MeshBasicMaterial' && '(IGNORES LIGHTS!)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Vertex Normals:</span>
                          <span className={targetMeshInfo.hasNormals ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                            {targetMeshInfo.hasNormals ? 'VALID ✓' : 'MISSING ✗'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Double Sided:</span>
                          <span className="text-white">{targetMeshInfo.isDoubleSided ? 'YES' : 'NO'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">World Pos:</span>
                          <span className="text-neutral-300">
                            [{targetMeshInfo.worldPos.x}, {targetMeshInfo.worldPos.y}, {targetMeshInfo.worldPos.z}]
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Distance from Light:</span>
                          <span className="text-amber-300 font-bold">{distanceToTarget ?? 'N/A'} meters</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-neutral-500 py-1">No model mesh detected in scene yet</div>
                    )}
                  </div>

                  {/* Active Point Lights List & World Matrix (Cause B) */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="text-[11px] text-amber-400 font-bold uppercase border-b border-white/10 pb-1 flex justify-between">
                      <span>💡 Scene Lights</span>
                      <span>Total: {discoveredLights.length}</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {discoveredLights.map((l) => (
                        <div
                          key={l.id}
                          onClick={() => setSelectedLightId(l.id)}
                          className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedLightId === l.id
                              ? 'bg-amber-500/10 border-amber-400 text-white'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: l.colorHex }}
                              />
                              <span>{l.name}</span>
                            </div>
                            <span className="text-amber-400 text-[10px] uppercase">{l.type}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[10px] mt-1 text-neutral-400">
                            <div>Intensity: <span className="text-neutral-200">{l.intensity}</span></div>
                            <div>Decay: <span className="text-neutral-200">{l.decay ?? 'N/A'}</span></div>
                            <div>Cutoff: <span className="text-neutral-200">{l.distance ? `${l.distance}m` : 'Infinite'}</span></div>
                            <div>Visible: <span className={l.visible ? 'text-emerald-400' : 'text-rose-400'}>{l.visible ? 'TRUE' : 'FALSE'}</span></div>
                          </div>

                          <div className="text-[9px] text-neutral-500 mt-1">
                            World: [{l.worldPos.x}, {l.worldPos.y}, {l.worldPos.z}]
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WebGL Rendering Info */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1 text-[11px]">
                    <div className="text-amber-400 font-bold uppercase border-b border-white/10 pb-1">
                      ⚙️ WebGL Pipeline Info
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Tracking Status:</span>
                      <span className="text-emerald-400 font-bold">{trackingStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Draw Calls:</span>
                      <span className="text-white">{webglInfo.calls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Active Geometries:</span>
                      <span className="text-white">{webglInfo.geometries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Active Textures:</span>
                      <span className="text-white">{webglInfo.textures}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SYSTEM LOGS */}
              {activeTab === 'logs' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-neutral-400 text-[11px]">Recent MindAR & Scene Events:</span>
                    {onForceRender && (
                      <button
                        type="button"
                        onClick={onForceRender}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                          forceShowModel ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {forceShowModel ? 'FORCE RENDER: ON' : 'FORCE RENDER'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 select-text">
                    {diagnosticLogs.length === 0 && (
                      <div className="text-neutral-500 text-center py-6">No event logs recorded</div>
                    )}
                    {diagnosticLogs.map((log) => (
                      <div key={log.id} className="p-2 rounded bg-neutral-900 border border-neutral-800 leading-tight">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-1">
                          <span className="font-bold text-amber-400">[{log.tag}]</span>
                          <span>{log.time}</span>
                        </div>
                        <pre className="text-neutral-300 whitespace-pre-wrap break-all text-[11px] font-mono">
                          {log.text}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
