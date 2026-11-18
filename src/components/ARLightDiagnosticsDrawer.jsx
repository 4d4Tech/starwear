import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

/**
 * ARLightDiagnosticsDrawer
 * 
 * Premier In-Browser DevTool, Real-Time Lighting Management Studio & Telemetry HUD for WebAR.
 * Compatible with mobile screen views (slide-up bottom sheet) and desktop monitors.
 * 
 * Features:
 * - Real-time point/spot/directional light source placement on-the-fly at phone/camera position & angle
 * - Comprehensive light adjustments (Color, Intensity, Decay, Cutoff Distance, Position XYZ, Spotlight Angle/Penumbra, Target XYZ)
 * - 1-Tap Save to Firestore `batches` and `assets` collections with instant real-time synchronization
 * - Glowing 3D light bulb emitters/auras and wireframe helpers in AR/3D space
 * - Real-time target mesh & camera telemetry (world matrices, normal vectors, vertex counts)
 * - Diagnostic tools: 1-Tap Flash, White StandardMaterial override, shader recompiler, system event logs
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
  requireSuperUser = false,
  batchId = '',
  customLights = [],
  onUpdateCustomLights,
  getThreeCamera
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

  const [activeTab, setActiveTab] = useState('lighting'); // 'lighting' | 'tools' | 'telemetry' | 'logs'
  const [pinHud, setPinHud] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Mobile height toggle (50vh vs 88vh)

  // Real-Time Lighting State
  const [selectedCustomLightId, setSelectedCustomLightId] = useState(null);
  const [isSavingLights, setIsSavingLights] = useState(false);
  const [saveLightSuccessMsg, setSaveLightSuccessMsg] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Scene discovery & active lights
  const [discoveredLights, setDiscoveredLights] = useState([]);
  const [selectedLightId, setSelectedLightId] = useState(null);
  const [targetMeshInfo, setTargetMeshInfo] = useState(null);
  const [webglInfo, setWebglInfo] = useState({ calls: 0, geometries: 0, textures: 0 });
  const [phonePose, setPhonePose] = useState({ x: 0, y: 0, z: 0, dirX: 0, dirY: 0, dirZ: 0 });

  // Interactive Live Override States
  const [intensityMultiplier, setIntensityMultiplier] = useState(1);
  const [decayOverride, setDecayOverride] = useState(null); // null = original, 0 = constant, 1 = linear, 2 = physical
  const [distanceOverride, setDistanceOverride] = useState(null);
  const [posOffset, setPosOffset] = useState({ x: 0, y: 0, z: 0 });
  const [materialOverrideActive, setMaterialOverrideActive] = useState(false);
  const [showHelpers, setShowHelpers] = useState(true);
  const [showDistanceSpheres, setShowDistanceSpheres] = useState(true);
  const [showBulbEmitters, setShowBulbEmitters] = useState(true);

  // References to attached Three.js helpers
  const helperObjectsRef = useRef(new Map()); // lightUuid -> { helper, sphere }
  const originalMaterialsRef = useRef(new Map()); // meshUuid -> originalMaterial

  // Fetch the active Three.js Scene and Renderer
  const getThreeLib = useCallback(() => {
    return (typeof window !== 'undefined' && window.AFRAME && window.AFRAME.THREE)
      ? window.AFRAME.THREE
      : THREE;
  }, []);

  const getSceneAndRenderer = useCallback(() => {
    const sceneEl = sceneRef?.current || document.querySelector('a-scene');
    if (!sceneEl) return { scene: null, renderer: null, sceneEl: null };
    const renderer = sceneEl.renderer || null;
    const scene = sceneEl.object3D || null;
    return { scene, renderer, sceneEl };
  }, [sceneRef]);

  // Synchronize selected custom light ID if list changes
  useEffect(() => {
    if (customLights && customLights.length > 0) {
      if (!selectedCustomLightId || !customLights.some((l) => l.id === selectedCustomLightId)) {
        setSelectedCustomLightId(customLights[0].id);
      }
    } else {
      setSelectedCustomLightId(null);
    }
  }, [customLights, selectedCustomLightId]);

  // Currently selected custom light object
  const selectedCustomLight = useMemo(() => {
    if (!customLights || customLights.length === 0) return null;
    return customLights.find((l) => l.id === selectedCustomLightId) || customLights[0] || null;
  }, [customLights, selectedCustomLightId]);

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
        document.getElementById('force-preview-anchor')?.object3D ||
        scene;

      if (targetAnchorObj) {
        targetAnchorObj.matrixWorldNeedsUpdate = true;
        targetAnchorObj.updateMatrixWorld(true);
      } else {
        scene.updateMatrixWorld(true);
      }

      // Track Phone / Camera Pose relative to the model anchor
      try {
        const THREE_LIB = getThreeLib();
        const cam = (typeof getThreeCamera === 'function')
          ? getThreeCamera()
          : (sceneRef?.current?.camera || document.querySelector('a-scene')?.camera);

        if (cam && targetAnchorObj) {
          cam.updateMatrixWorld(true);
          const cWorld = new THREE_LIB.Vector3();
          cam.getWorldPosition(cWorld);
          const cDir = new THREE_LIB.Vector3();
          cam.getWorldDirection(cDir);
          const localCamPos = targetAnchorObj.worldToLocal(cWorld.clone());

          setPhonePose({
            x: Number(localCamPos.x.toFixed(2)),
            y: Number(localCamPos.y.toFixed(2)),
            z: Number(localCamPos.z.toFixed(2)),
            dirX: Number(cDir.x.toFixed(2)),
            dirY: Number(cDir.y.toFixed(2)),
            dirZ: Number(cDir.z.toFixed(2))
          });
        }
      } catch (err) {
        // Ignore telemetry pose warning
      }

      // 1. Traverse scene graph to find lights
      scene.traverse((node) => {
        if (!node) return;

        // Collect point, spot, and directional lights
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

      // 2. Prioritize primary target mesh inside active anchor
      targetAnchorObj.traverse((node) => {
        if (!detectedMesh && node.isMesh && node.geometry &&
            !node.name?.startsWith('Helper_') &&
            !node.name?.startsWith('Bulb_') &&
            !node.name?.startsWith('DistanceSphere_') &&
            !node.name?.startsWith('Anchor_') &&
            !node.name?.startsWith('LightAnchor_') &&
            !node.name?.startsWith('LightHelper_')) {
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
              !node.name?.startsWith('Anchor_') &&
              !node.name?.startsWith('LightAnchor_') &&
              !node.name?.startsWith('LightHelper_')) {
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
  }, [isOpen, pinHud, getSceneAndRenderer, getThreeCamera, getThreeLib, sceneRef, selectedLightId]);

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
          const THREE_LIB = getThreeLib();
          helper = new THREE_LIB.PointLightHelper(light, 0.35, light.color);
          helper.name = `Helper_${light.uuid}`;
          light.parent.add(helper);

          const baseDist = light.userData?.__baseDistance !== undefined ? light.userData.__baseDistance : light.distance;
          if (showDistanceSpheres && (baseDist > 0 || distanceOverride > 0)) {
            const rad = distanceOverride !== null ? distanceOverride : (baseDist || 2);
            const sphereGeo = new THREE_LIB.SphereGeometry(rad, 16, 8);
            const sphereMat = new THREE_LIB.MeshBasicMaterial({
              color: light.color,
              wireframe: true,
              transparent: true,
              opacity: 0.25,
              depthWrite: false
            });
            sphere = new THREE_LIB.Mesh(sphereGeo, sphereMat);
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

    return () => {};
  }, [discoveredLights, showHelpers, showDistanceSpheres, distanceOverride, getSceneAndRenderer, getThreeLib]);

  // Apply Live Parametric Overrides to Selected Discovered Light
  const activeLight = useMemo(() => {
    return discoveredLights.find((l) => l.id === selectedLightId || l.uuid === selectedLightId) || null;
  }, [discoveredLights, selectedLightId]);

  useEffect(() => {
    if (!activeLight || !activeLight.rawLight) return;
    const light = activeLight.rawLight;

    if (light.userData.__origIntensity === undefined) {
      light.userData.__origIntensity = light.userData.__baseIntensity !== undefined
        ? light.userData.__baseIntensity
        : light.intensity;
      light.userData.__origDecay = light.userData.__baseDecay !== undefined
        ? light.userData.__baseDecay
        : light.decay;
      light.userData.__origDistance = light.userData.__baseDistance !== undefined
        ? light.userData.__baseDistance
        : light.distance;
      if (!light.userData.__origPos) {
        light.userData.__origPos = light.position.clone();
      }
    }

    light.userData.__devIntensityMultiplier = intensityMultiplier;
    light.userData.__devDecayOverride = decayOverride;
    light.userData.__devDistanceOverride = distanceOverride;
    light.userData.__devPosOffset = { ...posOffset };

    const baseIntensity = light.userData.__origIntensity ?? 2.5;
    light.intensity = baseIntensity * intensityMultiplier;

    if (decayOverride !== null) {
      light.decay = decayOverride;
    }

    if (distanceOverride !== null) {
      light.distance = distanceOverride;
    }

    if (light.userData.__origPos) {
      light.position.set(
        light.userData.__origPos.x + posOffset.x,
        light.userData.__origPos.y + posOffset.y,
        light.userData.__origPos.z + posOffset.z
      );
    }

    if (light.target) {
      light.target.updateMatrixWorld(true);
    }
    light.updateMatrixWorld(true);
  }, [activeLight, intensityMultiplier, decayOverride, distanceOverride, posOffset]);

  // Compute physical distance between active light and target model mesh
  const distanceToTarget = useMemo(() => {
    if (!activeLight || !targetMeshInfo) return null;
    const lPos = new THREE.Vector3(activeLight.worldPos.x, activeLight.worldPos.y, activeLight.worldPos.z);
    const mPos = new THREE.Vector3(targetMeshInfo.worldPos.x, targetMeshInfo.worldPos.y, targetMeshInfo.worldPos.z);
    return lPos.distanceTo(mPos).toFixed(2);
  }, [activeLight, targetMeshInfo]);

  // =========================================================================
  // REAL-TIME ON-THE-FLY LIGHT INSERTION (PHONE / CAMERA POSITION & ANGLE)
  // =========================================================================

  const handleAddLightFromPhone = (type = 'point') => {
    const THREE_LIB = getThreeLib();
    const camera = (typeof getThreeCamera === 'function')
      ? getThreeCamera()
      : (sceneRef?.current?.camera || document.querySelector('a-scene')?.camera);

    if (!camera) {
      alert('Camera is not yet initialized in the 3D scene.');
      return;
    }

    const targetAnchorObj = document.getElementById('target-entity')?.object3D ||
      document.getElementById('preview-anchor')?.object3D ||
      document.getElementById('force-preview-anchor')?.object3D ||
      sceneRef?.current?.object3D ||
      document.querySelector('a-scene')?.object3D;

    if (!targetAnchorObj) {
      alert('3D anchor is not ready yet in the scene.');
      return;
    }

    camera.updateMatrixWorld(true);
    targetAnchorObj.updateMatrixWorld(true);

    const camWorldPos = new THREE_LIB.Vector3();
    camera.getWorldPosition(camWorldPos);

    const camWorldDir = new THREE_LIB.Vector3();
    camera.getWorldDirection(camWorldDir);

    // Convert camera world position to anchor's local coordinate space
    const localPos = targetAnchorObj.worldToLocal(camWorldPos.clone());
    const forwardLookAt = camWorldPos.clone().add(camWorldDir.clone().multiplyScalar(2.0));
    const localTarget = targetAnchorObj.worldToLocal(forwardLookAt);

    const cleanType = String(type).toLowerCase();
    const count = (customLights || []).length + 1;
    const newId = `light_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const defaultColors = {
      point: '#ffffff',
      spot: '#38bdf8',
      directional: '#fef08a',
      hemisphere: '#a855f7'
    };

    const newLightItem = {
      id: newId,
      name: `${cleanType.charAt(0).toUpperCase() + cleanType.slice(1)} Light ${count}`,
      type: cleanType,
      color: defaultColors[cleanType] || '#ffffff',
      intensity: cleanType === 'directional' ? 2.5 : 4.0,
      decay: 1.0,
      distance: 0,
      posX: Number(localPos.x.toFixed(3)),
      posY: Number(localPos.y.toFixed(3)),
      posZ: Number(localPos.z.toFixed(3)),
      targetX: Number(localTarget.x.toFixed(3)),
      targetY: Number(localTarget.y.toFixed(3)),
      targetZ: Number(localTarget.z.toFixed(3)),
      angle: 45,
      penumbra: 0.35,
      bulbSize: 0.08,
      bulbIntensity: 3.5,
      showBulb: true,
      showHelper: true,
      visible: true
    };

    const nextLights = [...(customLights || []), newLightItem];
    if (onUpdateCustomLights) {
      onUpdateCustomLights(nextLights);
    }
    setSelectedCustomLightId(newId);
    setSelectedLightId(newId);
    setHasUnsavedChanges(true);
    setShowHelpers(true);
    setShowBulbEmitters(true);

    setTimeout(() => {
      handleForceRecompile(true);
    }, 60);
  };

  // Update a property on the currently selected custom light
  const handleUpdateSelectedLightField = (field, value) => {
    if (!selectedCustomLightId) return;
    const nextLights = (customLights || []).map((l) => {
      if (l.id === selectedCustomLightId) {
        return { ...l, [field]: value };
      }
      return l;
    });
    if (onUpdateCustomLights) {
      onUpdateCustomLights(nextLights);
    }
    setHasUnsavedChanges(true);
  };

  const handleUpdateSelectedLightFields = (fieldsObj) => {
    if (!selectedCustomLightId || !fieldsObj) return;
    const nextLights = (customLights || []).map((l) => {
      if (l.id === selectedCustomLightId) {
        return { ...l, ...fieldsObj };
      }
      return l;
    });
    if (onUpdateCustomLights) {
      onUpdateCustomLights(nextLights);
    }
    setHasUnsavedChanges(true);
  };

  // Move existing selected light to where the phone is right now
  const handleMoveSelectedLightToPhone = () => {
    if (!selectedCustomLight) return;
    const THREE_LIB = getThreeLib();
    const camera = (typeof getThreeCamera === 'function')
      ? getThreeCamera()
      : (sceneRef?.current?.camera || document.querySelector('a-scene')?.camera);

    const targetAnchorObj = document.getElementById('target-entity')?.object3D ||
      document.getElementById('preview-anchor')?.object3D ||
      document.getElementById('force-preview-anchor')?.object3D ||
      sceneRef?.current?.object3D;

    if (!camera || !targetAnchorObj) return;

    camera.updateMatrixWorld(true);
    targetAnchorObj.updateMatrixWorld(true);

    const camWorldPos = new THREE_LIB.Vector3();
    camera.getWorldPosition(camWorldPos);

    const camWorldDir = new THREE_LIB.Vector3();
    camera.getWorldDirection(camWorldDir);

    const localPos = targetAnchorObj.worldToLocal(camWorldPos.clone());
    const forwardLookAt = camWorldPos.clone().add(camWorldDir.clone().multiplyScalar(2.0));
    const localTarget = targetAnchorObj.worldToLocal(forwardLookAt);

    handleUpdateSelectedLightFields({
      posX: Number(localPos.x.toFixed(3)),
      posY: Number(localPos.y.toFixed(3)),
      posZ: Number(localPos.z.toFixed(3)),
      targetX: Number(localTarget.x.toFixed(3)),
      targetY: Number(localTarget.y.toFixed(3)),
      targetZ: Number(localTarget.z.toFixed(3))
    });
  };

  // Re-aim selected light in current phone gaze direction
  const handleAimSelectedLightAtPhone = () => {
    if (!selectedCustomLight) return;
    const THREE_LIB = getThreeLib();
    const camera = (typeof getThreeCamera === 'function')
      ? getThreeCamera()
      : (sceneRef?.current?.camera || document.querySelector('a-scene')?.camera);

    const targetAnchorObj = document.getElementById('target-entity')?.object3D ||
      document.getElementById('preview-anchor')?.object3D ||
      document.getElementById('force-preview-anchor')?.object3D ||
      sceneRef?.current?.object3D;

    if (!camera || !targetAnchorObj) return;

    camera.updateMatrixWorld(true);
    targetAnchorObj.updateMatrixWorld(true);

    const camWorldPos = new THREE_LIB.Vector3();
    camera.getWorldPosition(camWorldPos);
    const camWorldDir = new THREE_LIB.Vector3();
    camera.getWorldDirection(camWorldDir);

    const forwardLookAt = camWorldPos.clone().add(camWorldDir.clone().multiplyScalar(2.0));
    const localTarget = targetAnchorObj.worldToLocal(forwardLookAt);

    handleUpdateSelectedLightFields({
      targetX: Number(localTarget.x.toFixed(3)),
      targetY: Number(localTarget.y.toFixed(3)),
      targetZ: Number(localTarget.z.toFixed(3))
    });
  };

  // Delete a custom light
  const handleDeleteCustomLight = (lightId) => {
    const updated = (customLights || []).filter((l) => l.id !== lightId);
    if (onUpdateCustomLights) {
      onUpdateCustomLights(updated);
    }
    if (selectedCustomLightId === lightId) {
      setSelectedCustomLightId(updated[0]?.id || null);
    }
    setHasUnsavedChanges(true);
    setTimeout(() => {
      handleForceRecompile(true);
    }, 60);
  };

  // Duplicate a custom light
  const handleDuplicateCustomLight = (light) => {
    if (!light) return;
    const newId = `light_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const cloned = {
      ...light,
      id: newId,
      name: `${light.name || 'Light'} (Copy)`,
      posX: Number((Number(light.posX || 0) + 0.2).toFixed(3)),
      posY: Number((Number(light.posY || 0) + 0.2).toFixed(3))
    };
    const updated = [...(customLights || []), cloned];
    if (onUpdateCustomLights) {
      onUpdateCustomLights(updated);
    }
    setSelectedCustomLightId(newId);
    setHasUnsavedChanges(true);
    setTimeout(() => {
      handleForceRecompile(true);
    }, 60);
  };

  // =========================================================================
  // PERSISTENCE: SAVE LIGHTING TO BATCHES FIRESTORE DATABASE
  // =========================================================================

  const handleSaveLightingToFirestore = async () => {
    if (!batchId) {
      alert('No active batch ID found to save lighting to.');
      return;
    }
    setIsSavingLights(true);
    setSaveLightSuccessMsg('');
    try {
      const cleanId = String(batchId).trim();
      const batchRef = doc(db, 'batches', cleanId);
      const assetRef = doc(db, 'assets', cleanId);

      const payload = {
        customLights: customLights || [],
        ar_config: {
          customLights: customLights || [],
          lighting: {
            customLights: customLights || []
          }
        },
        updatedAt: new Date().toISOString()
      };

      const batchWriter = writeBatch(db);
      batchWriter.set(batchRef, payload, { merge: true });
      batchWriter.set(assetRef, payload, { merge: true });
      await batchWriter.commit();

      try {
        const localKey = 'starwear_live_preview_config_' + cleanId;
        const existingLocal = JSON.parse(localStorage.getItem(localKey) || '{}');
        existingLocal.customLights = customLights || [];
        localStorage.setItem(localKey, JSON.stringify(existingLocal));
        localStorage.setItem('starwear_live_preview_config_last', JSON.stringify(existingLocal));
      } catch (stErr) {
        console.warn('[ARLightDevTools] localStorage sync warning:', stErr);
      }

      setHasUnsavedChanges(false);
      setSaveLightSuccessMsg('✓ Saved to batches Firestore database!');
      setTimeout(() => setSaveLightSuccessMsg(''), 5000);
    } catch (err) {
      console.error('[ARLightDevTools] Save error:', err);
      alert('Error saving lighting to Firestore: ' + err.message);
    } finally {
      setIsSavingLights(false);
    }
  };

  // =========================================================================
  // DIAGNOSTIC ACTIONS & SYSTEM TOOLS
  // =========================================================================

  // Force Shader Recompilation on all scene meshes
  const handleForceRecompile = useCallback((silent = false) => {
    const { scene, sceneEl } = getSceneAndRenderer();
    if (!scene) return;

    if (sceneEl?.renderer?.renderLists?.dispose) {
      try { sceneEl.renderer.renderLists.dispose(); } catch {}
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

  // Toggle White MeshStandardMaterial Override
  const toggleMaterialOverride = useCallback(() => {
    const { scene } = getSceneAndRenderer();
    if (!scene) return;
    const nextState = !materialOverrideActive;
    setMaterialOverrideActive(nextState);

    const THREE_LIB = getThreeLib();
    const origMap = originalMaterialsRef.current;

    scene.traverse((node) => {
      if (node.isMesh && node.geometry &&
          !node.name?.startsWith('Helper_') &&
          !node.name?.startsWith('Bulb_') &&
          !node.name?.startsWith('DistanceSphere_') &&
          !node.name?.startsWith('Anchor_') &&
          !node.name?.startsWith('LightAnchor_') &&
          !node.name?.startsWith('LightHelper_')) {
        if (nextState) {
          if (!origMap.has(node.uuid)) {
            origMap.set(node.uuid, node.material);
          }
          node.material = new THREE_LIB.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE_LIB.DoubleSide
          });
          node.material.needsUpdate = true;
        } else {
          if (origMap.has(node.uuid)) {
            node.material = origMap.get(node.uuid);
            node.material.needsUpdate = true;
          }
        }
      }
    });

    handleForceRecompile(true);
  }, [materialOverrideActive, getSceneAndRenderer, getThreeLib, handleForceRecompile]);

  // Instant Diagnostic Flash: Sets Decay to 0, boosts intensity 50x, forces recompilation
  const handleInstantDiagnosticFlash = useCallback(() => {
    setDecayOverride(0);
    setIntensityMultiplier(50);
    setDistanceOverride(0);
    setShowHelpers(true);

    let lightToFlash = activeLight?.rawLight;
    if (lightToFlash) {
      lightToFlash.decay = 0;
      const base = lightToFlash.userData?.__origIntensity || 5.0;
      lightToFlash.intensity = 50 * base;
      lightToFlash.distance = 0;
      lightToFlash.matrixWorldNeedsUpdate = true;
      if (lightToFlash.parent) lightToFlash.parent.updateMatrixWorld(true);
    }

    handleForceRecompile(true);
  }, [activeLight, handleForceRecompile]);

  // Toggle Bulb Emitters
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

    if (materialOverrideActive) {
      toggleMaterialOverride();
    }

    discoveredLights.forEach((meta) => {
      const l = meta.rawLight;
      if (l && l.userData) {
        if (l.userData.__origIntensity !== undefined) l.intensity = l.userData.__origIntensity;
        if (l.userData.__origDecay !== undefined) l.decay = l.userData.__origDecay;
        if (l.userData.__origDistance !== undefined) l.distance = l.userData.__origDistance;
        if (l.userData.__origPos) l.position.copy(l.userData.__origPos);
        delete l.userData.__devIntensityMultiplier;
        delete l.userData.__devDecayOverride;
        delete l.userData.__devDistanceOverride;
        delete l.userData.__devPosOffset;
      }
    });

    handleForceRecompile(true);
  };

  // Copy diagnostics report to clipboard
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      batchId,
      trackingStatus,
      cameraEnabled,
      customLightsCount: (customLights || []).length,
      customLights,
      discoveredLightsCount: discoveredLights.length,
      discoveredLights: discoveredLights.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        color: l.colorHex,
        intensity: l.intensity,
        decay: l.decay,
        distance: l.distance,
        localPos: l.localPos,
        worldPos: l.worldPos
      })),
      targetMeshInfo,
      distanceToTarget: distanceToTarget ? `${distanceToTarget}m` : null,
      webglInfo,
      phonePose
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      .then(() => alert('Diagnostics report copied to clipboard!'))
      .catch((err) => alert('Failed to copy report: ' + err.message));
  };

  const colorPresets = [
    { label: 'White', hex: '#ffffff' },
    { label: 'Warm Incandescent', hex: '#ffeaa7' },
    { label: 'Golden Hour', hex: '#fdcb6e' },
    { label: 'Cool Daylight', hex: '#dff9fb' },
    { label: 'Cyber Blue', hex: '#38bdf8' },
    { label: 'Neon Purple', hex: '#a855f7' },
    { label: 'Sunset Rose', hex: '#f43f5e' },
    { label: 'Mint Glow', hex: '#2dd4bf' }
  ];

  if (!isOpen && !pinHud) return null;

  return (
    <>
      {/* Pinned Mini HUD Pill */}
      {pinHud && !isOpen && (
        <div className="fixed top-16 right-3 sm:right-6 z-50 bg-slate-950/90 border border-amber-500/50 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl font-mono text-[11px] text-white flex items-center gap-3 select-none">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${trackingStatus === 'DETECTED' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
            <span className="font-bold text-amber-400">{trackingStatus}</span>
          </div>
          <div className="text-neutral-400 border-l border-white/20 pl-2">
            Lights: <strong className="text-white">{(customLights || []).length}</strong>
          </div>
          <button
            type="button"
            onClick={() => setPinHud(false)}
            className="text-neutral-400 hover:text-white"
            title="Unpin HUD"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main DevTool Sheet */}
      {isOpen && (
        <div
          className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-300 ease-out select-none flex flex-col ${
            isExpanded ? 'h-[88vh]' : 'h-[58vh] min-h-[380px]'
          }`}
        >
          {/* Backdrop Tap to Close */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] -z-10"
            onClick={onClose}
          />

          {/* Drawer Body Container */}
          <div className="relative w-full h-full bg-slate-950/95 border-t border-amber-500/40 rounded-t-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-neutral-100">
            {/* Header Drag Handle & Actions */}
            <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${trackingStatus === 'DETECTED' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
                <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm sm:text-base">tune</span>
                  LIGHTING DEVTOOLS
                </span>
                {batchId && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Batch: {batchId}
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-black animate-pulse">
                    UNSAVED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Save Lighting Button */}
                {batchId && (
                  <button
                    type="button"
                    onClick={handleSaveLightingToFirestore}
                    disabled={isSavingLights}
                    className="px-2.5 sm:px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                    title="Save current custom lighting configuration to batches Firestore database"
                  >
                    <span className="material-symbols-outlined text-xs sm:text-sm">
                      {isSavingLights ? 'sync' : 'save'}
                    </span>
                    <span>{isSavingLights ? 'Saving...' : 'Save to Batch'}</span>
                  </button>
                )}

                {/* Pin HUD Button */}
                <button
                  type="button"
                  onClick={() => setPinHud(!pinHud)}
                  className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    pinHud
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'border-neutral-700 text-neutral-400 hover:text-white'
                  }`}
                  title={pinHud ? 'Unpin floating HUD' : 'Pin floating HUD when drawer is closed'}
                >
                  📌
                </button>

                {/* Mobile Height Toggle */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white text-xs font-mono"
                  title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
                >
                  {isExpanded ? '▼' : '▲'}
                </button>

                {/* Close Drawer Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white text-xs font-mono"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Success Toast */}
            {saveLightSuccessMsg && (
              <div className="bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 px-4 py-1.5 text-xs font-mono flex items-center justify-between">
                <span>{saveLightSuccessMsg}</span>
                <button type="button" onClick={() => setSaveLightSuccessMsg('')} className="text-emerald-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-800 shrink-0 bg-neutral-900/40 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('lighting')}
                className={`flex-1 py-2.5 text-center font-bold transition-colors border-b-2 ${
                  activeTab === 'lighting'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                💡 Lights ({(customLights || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`flex-1 py-2.5 text-center font-bold transition-colors border-b-2 ${
                  activeTab === 'tools'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                ⚡ Tools
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
                📊 Telemetry
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
              {/* TAB 1: REAL-TIME LIGHTING STUDIO */}
              {activeTab === 'lighting' && (
                <div className="space-y-4">
                  {/* Phone Viewpoint Lighting Card */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/40 shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-400 text-lg">smartphone</span>
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                            Phone Viewpoint Light Injection
                          </div>
                          <div className="text-[10px] text-indigo-300">
                            Position and angle phone around 3D scene, then tap below:
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-indigo-300 bg-black/40 px-2 py-0.5 rounded border border-indigo-500/30">
                        [{phonePose.x}, {phonePose.y}, {phonePose.z}]
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => handleAddLightFromPhone('point')}
                        className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex flex-col items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Add Point Light at phone's current 3D position"
                      >
                        <span className="flex items-center gap-1">💡 + Point</span>
                        <span className="text-[9px] font-normal opacity-85">Omni Light</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddLightFromPhone('spot')}
                        className="py-2.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex flex-col items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Add Spotlight shining from phone in camera gaze direction"
                      >
                        <span className="flex items-center gap-1">🔦 + Spot</span>
                        <span className="text-[9px] font-normal opacity-85">Aimed Beam</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddLightFromPhone('directional')}
                        className="py-2.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex flex-col items-center justify-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Add Sun/Directional Light parallel to phone's angle"
                      >
                        <span className="flex items-center gap-1">☀️ + Dir</span>
                        <span className="text-[9px] font-normal opacity-85">Sun Key</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Custom Lights List & Selector */}
                  <div className="p-3 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-300 font-bold uppercase tracking-wider">
                        Active Scene Lights ({(customLights || []).length})
                      </span>
                      {hasUnsavedChanges && (
                        <span className="text-[10px] text-amber-400 animate-pulse font-bold">
                          Unsaved Changes
                        </span>
                      )}
                    </div>

                    {(!customLights || customLights.length === 0) ? (
                      <div className="text-neutral-500 text-xs font-mono py-2 text-center">
                        No custom lights added yet. Tap a button above to add one!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {customLights.map((l) => {
                          const isSel = l.id === selectedCustomLightId;
                          return (
                            <div
                              key={l.id}
                              onClick={() => setSelectedCustomLightId(l.id)}
                              className={`p-2 rounded-xl border flex items-center justify-between font-mono text-xs cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-amber-500/15 border-amber-400 shadow-md text-white'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/20"
                                  style={{ backgroundColor: l.color || '#ffffff' }}
                                />
                                <div className="truncate">
                                  <div className="font-bold text-[11px] truncate">{l.name || 'Custom Light'}</div>
                                  <div className="text-[9px] text-neutral-400 capitalize">
                                    {l.type} • {l.intensity}x
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateSelectedLightField('visible', l.visible === false ? true : false);
                                  }}
                                  className={`p-1 rounded hover:bg-white/10 ${l.visible !== false ? 'text-emerald-400' : 'text-neutral-500'}`}
                                  title={l.visible !== false ? 'Hide light' : 'Show light'}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {l.visible !== false ? 'visibility' : 'visibility_off'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomLight(l.id);
                                  }}
                                  className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40"
                                  title="Delete light"
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected Custom Light Properties Editor */}
                  {selectedCustomLight && (
                    <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-700 space-y-3.5 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                            style={{ backgroundColor: selectedCustomLight.color || '#ffffff' }}
                          />
                          <input
                            type="text"
                            value={selectedCustomLight.name || ''}
                            onChange={(e) => handleUpdateSelectedLightField('name', e.target.value)}
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                            placeholder="Light Name"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateCustomLight(selectedCustomLight)}
                            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[10px] text-neutral-300"
                            title="Duplicate this light"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomLight(selectedCustomLight.id)}
                            className="px-2 py-0.5 rounded bg-rose-950/50 hover:bg-rose-900 border border-rose-800 text-[10px] text-rose-300"
                            title="Delete this light"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Phone Alignment Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleMoveSelectedLightToPhone}
                          className="py-1.5 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                          title="Snap this light's position to your current phone position"
                        >
                          <span className="material-symbols-outlined text-xs text-indigo-400">my_location</span>
                          <span>Move to Phone Position</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAimSelectedLightAtPhone}
                          className="py-1.5 px-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                          title="Aim this light in the current direction your phone is pointing"
                        >
                          <span className="material-symbols-outlined text-xs text-amber-400">explore</span>
                          <span>Aim in Phone Direction</span>
                        </button>
                      </div>

                      {/* Color Picker & Presets */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400 font-bold uppercase">Light Color:</span>
                          <span className="text-amber-400 font-mono">{selectedCustomLight.color}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={selectedCustomLight.color || '#ffffff'}
                            onChange={(e) => handleUpdateSelectedLightField('color', e.target.value)}
                            className="w-9 h-7 rounded border border-neutral-700 cursor-pointer bg-transparent"
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {colorPresets.map((p) => (
                              <button
                                key={p.hex}
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('color', p.hex)}
                                className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                                style={{ backgroundColor: p.hex }}
                                title={p.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Intensity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-neutral-400 font-bold uppercase">Intensity:</span>
                          <span className="text-amber-400 font-bold">{selectedCustomLight.intensity}x</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.1"
                            max="30"
                            step="0.1"
                            value={selectedCustomLight.intensity ?? 4.0}
                            onChange={(e) => handleUpdateSelectedLightField('intensity', Number(e.target.value))}
                            className="flex-1 accent-amber-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={selectedCustomLight.intensity ?? 4.0}
                            onChange={(e) => handleUpdateSelectedLightField('intensity', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white text-right focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Decay / Falloff Switcher */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-neutral-400 font-bold uppercase">Decay / Falloff:</span>
                          <span className="text-amber-400 font-bold">
                            {selectedCustomLight.decay === 0 ? '0 (None)' : selectedCustomLight.decay === 1 ? '1 (Linear)' : '2 (Physical)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: '0.0 None', val: 0 },
                            { label: '1.0 Linear', val: 1 },
                            { label: '2.0 Phys', val: 2 }
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => handleUpdateSelectedLightField('decay', item.val)}
                              className={`py-1 rounded text-center border transition-all ${
                                (selectedCustomLight.decay ?? 1.0) === item.val
                                  ? 'bg-amber-500 text-black border-amber-300 font-bold'
                                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cutoff Range Distance Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-neutral-400 font-bold uppercase">Cutoff Range:</span>
                          <span className="text-amber-400 font-bold">
                            {Number(selectedCustomLight.distance || 0) === 0 ? 'Infinite (0m)' : `${selectedCustomLight.distance}m`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="0.5"
                          value={selectedCustomLight.distance ?? 0}
                          onChange={(e) => handleUpdateSelectedLightField('distance', Number(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>

                      {/* Spotlight Angle & Penumbra (Only for Spot Light) */}
                      {selectedCustomLight.type === 'spot' && (
                        <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-neutral-400 font-bold uppercase">Spot Cone Angle:</span>
                            <span className="text-sky-400 font-bold">{selectedCustomLight.angle ?? 45}°</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="1"
                            value={selectedCustomLight.angle ?? 45}
                            onChange={(e) => handleUpdateSelectedLightField('angle', Number(e.target.value))}
                            className="w-full accent-sky-500"
                          />
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-neutral-400 font-bold uppercase">Edge Softness (Penumbra):</span>
                            <span className="text-sky-400 font-bold">{selectedCustomLight.penumbra ?? 0.35}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={selectedCustomLight.penumbra ?? 0.35}
                            onChange={(e) => handleUpdateSelectedLightField('penumbra', Number(e.target.value))}
                            className="w-full accent-sky-500"
                          />
                        </div>
                      )}

                      {/* 3D Position Coordinates (X, Y, Z) */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-neutral-400 font-bold uppercase">3D Local Position (meters):</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <div className="text-[10px] text-rose-400 font-bold">X (Left/Right)</div>
                            <div className="flex gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posX', Number((Number(selectedCustomLight.posX || 0) - 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedCustomLight.posX ?? 0}
                                onChange={(e) => handleUpdateSelectedLightField('posX', Number(e.target.value))}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-center text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posX', Number((Number(selectedCustomLight.posX || 0) + 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-emerald-400 font-bold">Y (Up/Down)</div>
                            <div className="flex gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posY', Number((Number(selectedCustomLight.posY || 0) - 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedCustomLight.posY ?? 2}
                                onChange={(e) => handleUpdateSelectedLightField('posY', Number(e.target.value))}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-center text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posY', Number((Number(selectedCustomLight.posY || 0) + 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] text-sky-400 font-bold">Z (Fwd/Back)</div>
                            <div className="flex gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posZ', Number((Number(selectedCustomLight.posZ || 0) - 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedCustomLight.posZ ?? 2}
                                onChange={(e) => handleUpdateSelectedLightField('posZ', Number(e.target.value))}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-center text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateSelectedLightField('posZ', Number((Number(selectedCustomLight.posZ || 0) + 0.2).toFixed(2)))}
                                className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700 hover:bg-neutral-700"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Visual Bulb Mesh & Aura Toggle */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                        <span className="text-neutral-400 text-xs">Glowing 3D Bulb Emitter:</span>
                        <input
                          type="checkbox"
                          checked={selectedCustomLight.showBulb !== false}
                          onChange={(e) => handleUpdateSelectedLightField('showBulb', e.target.checked)}
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Save to Batch Footer Bar */}
                  {batchId && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleSaveLightingToFirestore}
                        disabled={isSavingLights}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-mono font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">
                          {isSavingLights ? 'sync' : 'save'}
                        </span>
                        <span>{isSavingLights ? 'Saving to Firestore...' : 'Save Lighting to Batch'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SYSTEM TOOLS & ACTIONS */}
              {activeTab === 'tools' && (
                <div className="space-y-3.5 font-mono text-xs">
                  {/* Tracking Status Banner */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    trackingStatus === 'DETECTED'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : trackingStatus === 'SCANNING'
                      ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
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

                  {/* 1-Tap Diagnostic Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleInstantDiagnosticFlash}
                      className="px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg flex flex-col items-center justify-center text-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                      title="Sets Decay to 0, boosts intensity 50x, forces recompilation"
                    >
                      <span className="flex items-center gap-1">⚡ FLASH BOOST</span>
                      <span className="text-[9px] font-semibold opacity-90">Decay 0 + 50x</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleMaterialOverride}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 active:scale-95 cursor-pointer ${
                        materialOverrideActive
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <span>{materialOverrideActive ? '⚪ WHITE: ON' : '🎨 WHITE MAT'}</span>
                      <span className="text-[9px] font-normal opacity-75">Override PBR</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleForceRecompile(false)}
                      className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400 text-neutral-200 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1"
                    >
                      <span>🔄 Force Recompile</span>
                      <span className="text-[9px] font-normal text-neutral-400">Rebuild Shaders</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetOverrides}
                      className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-1"
                    >
                      <span>↺ Reset Overrides</span>
                      <span className="text-[9px] font-normal text-neutral-500">Restore Defaults</span>
                    </button>
                  </div>

                  {/* Visual Helpers Toggles */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                    <div className="text-[11px] text-neutral-300 font-bold uppercase">Visual Aids:</div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Light Helpers & Rays:</span>
                      <input
                        type="checkbox"
                        checked={showHelpers}
                        onChange={(e) => setShowHelpers(e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Cutoff Distance Sphere:</span>
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
                </div>
              )}

              {/* TAB 3: LIVE TELEMETRY HUD */}
              {activeTab === 'telemetry' && (
                <div className="space-y-4 font-mono text-xs">
                  {/* Target Mesh Inspection */}
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
                          <span className="text-neutral-400">Distance from Selected Light:</span>
                          <span className="text-amber-300 font-bold">{distanceToTarget ?? 'N/A'} meters</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-neutral-500 py-1">No model mesh detected in scene yet</div>
                    )}
                  </div>

                  {/* Camera / Phone Position Telemetry */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1.5">
                    <div className="text-[11px] text-amber-400 font-bold uppercase border-b border-white/10 pb-1">
                      📱 Phone Camera Pose (Anchor Local Space)
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Position XYZ:</span>
                      <span className="text-indigo-300">[{phonePose.x}, {phonePose.y}, {phonePose.z}] m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Look Direction:</span>
                      <span className="text-indigo-300">[{phonePose.dirX}, {phonePose.dirY}, {phonePose.dirZ}]</span>
                    </div>
                  </div>

                  {/* WebGL Performance */}
                  <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1.5">
                    <div className="text-[11px] text-amber-400 font-bold uppercase border-b border-white/10 pb-1">
                      ⚙️ WebGL Renderer Stats
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Draw Calls:</span>
                      <span className="text-white">{webglInfo.calls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Geometries in VRAM:</span>
                      <span className="text-white">{webglInfo.geometries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Textures in VRAM:</span>
                      <span className="text-white">{webglInfo.textures}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DIAGNOSTIC LOGS */}
              {activeTab === 'logs' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400 font-bold uppercase">Event Timeline:</span>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-[11px] font-bold"
                    >
                      📋 Copy All
                    </button>
                  </div>

                  <div className="bg-neutral-950/80 p-2.5 rounded-xl border border-neutral-800 max-h-64 overflow-y-auto space-y-1 text-[11px]">
                    {diagnosticLogs.length === 0 ? (
                      <div className="text-neutral-500 text-center py-4">No diagnostic events logged yet.</div>
                    ) : (
                      diagnosticLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-2 leading-tight">
                          <span className="text-neutral-500 shrink-0">{log.time || '00:00:00'}</span>
                          <span className={`font-bold shrink-0 ${
                            log.tag?.includes('ERR') ? 'text-rose-400' :
                            log.tag?.includes('WARN') ? 'text-amber-400' :
                            'text-sky-400'
                          }`}>
                            [{log.tag}]
                          </span>
                          <span className="text-neutral-300 break-all">
                            {typeof log.payload === 'object' ? JSON.stringify(log.payload) : String(log.payload)}
                          </span>
                        </div>
                      ))
                    )}
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
