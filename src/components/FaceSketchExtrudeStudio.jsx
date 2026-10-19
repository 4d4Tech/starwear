/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  createPrimitiveThreeGeometry,
  createPrimitiveMaterial,
  COLOR_SWATCHES,
  MATERIAL_PRESETS
} from '../utils/geometryHelper';

// Presets for instant shapes on faces
const SHAPE_PRESETS = [
  { id: 'rectangle', name: 'Rectangle', icon: 'rectangle' },
  { id: 'circle', name: 'Circle', icon: 'circle' },
  { id: 'polygon', name: 'Polygon', icon: 'hexagon' },
  { id: 'star', name: 'Star', icon: 'star' },
  { id: 'heart', name: 'Heart', icon: 'favorite' },
  { id: 'shield', name: 'Shield', icon: 'shield' },
  { id: 'diamond', name: 'Diamond', icon: 'diamond' },
  { id: 'polyline', name: 'Pen Path', icon: 'polyline' },
  { id: 'freehand', name: 'Freehand', icon: 'draw' }
];

export default function FaceSketchExtrudeStudio({
  isOpen,
  onClose,
  onCommitExtrude,
  sceneRef,
  selectedTarget = null
}) {
  // Step workflow: 'pick_face' -> 'draw_shape' -> 'extrude'
  const [step, setStep] = useState('pick_face');
  const [scopeToSelected, setScopeToSelected] = useState(true);

  // Face data captured upon face click
  const [faceData, setFaceData] = useState(null);
  // Hovered face info for feedback during 'pick_face'
  const [hoveredInfo, setHoveredInfo] = useState(null);

  // Shape Configuration
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [shapeWidth, setShapeWidth] = useState(0.25); // meters
  const [shapeHeight, setShapeHeight] = useState(0.25); // meters
  const [shapeRadius, setShapeRadius] = useState(0.15); // meters
  const [polygonSides, setPolygonSides] = useState(6);
  const [starPoints, setStarPoints] = useState(5);
  const [starInnerRatio, setStarInnerRatio] = useState(0.45);
  const [shapeRotation, setShapeRotation] = useState(0); // degrees
  const [offsetU, setOffsetU] = useState(0); // meters
  const [offsetV, setOffsetV] = useState(0); // meters
  const [customPoints, setCustomPoints] = useState([]); // Array of { u, v } in meters

  // Interaction mode in drawing step: 'draw' vs 'orbit'
  const [canvasInteractionMode, setCanvasInteractionMode] = useState('draw');

  // Extrusion Configuration
  const [extrudeDepth, setExtrudeDepth] = useState(0.15); // meters
  const [bevelEnabled, setBevelEnabled] = useState(true);
  const [bevelThickness, setBevelThickness] = useState(0.015); // meters
  const [bevelSize, setBevelSize] = useState(0.01); // meters
  const [taper, setTaper] = useState(1.0); // 1.0 = straight
  const [extrudeColor, setExtrudeColor] = useState('#38bdf8');
  const [extrudePreset, setExtrudePreset] = useState('standard');
  const [extrudeRoughness, setExtrudeRoughness] = useState(0.35);
  const [extrudeMetalness, setExtrudeMetalness] = useState(0.15);
  const [objectName, setObjectName] = useState('Extruded Shape');

  // Three.js internal references for preview meshes
  const previewGroupRef = useRef(null);
  const hoverIndicatorRef = useRef(null);
  const sketchMeshRef = useRef(null);
  const sketchLineRef = useRef(null);
  const sketchGridRef = useRef(null);
  const extrudeMeshRef = useRef(null);
  const pullHandleRef = useRef(null);

  const isDrawingStrokeRef = useRef(false);
  const originalCameraPosRef = useRef(null);
  const originalCameraTargetRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Initialize Three.js Preview Group in A-Frame Scene
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.object3D) return;

    const group = new THREE.Group();
    group.name = '__starwear_face_sketch_studio__';
    sceneEl.object3D.add(group);
    previewGroupRef.current = group;

    return () => {
      // Cleanup all Three.js preview objects on unmount
      if (group) {
        group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
        if (group.parent) group.parent.remove(group);
      }
      previewGroupRef.current = null;
      hoverIndicatorRef.current = null;
      sketchMeshRef.current = null;
      sketchLineRef.current = null;
      sketchGridRef.current = null;
      extrudeMeshRef.current = null;
      pullHandleRef.current = null;
    };
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Generate 2D contour points in pixel units (scaled by 200 => scaleFactor 0.005)
  // ---------------------------------------------------------------------------
  const generateContourPoints = useCallback(() => {
    let rawPts = [];

    if (selectedShape === 'rectangle') {
      const halfW = (shapeWidth / 2) * 200;
      const halfH = (shapeHeight / 2) * 200;
      rawPts = [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
      ];
    } else if (selectedShape === 'circle') {
      const r = shapeRadius * 200;
      const segs = 32;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        rawPts.push({
          x: Math.round(r * Math.cos(a)),
          y: Math.round(r * Math.sin(a))
        });
      }
    } else if (selectedShape === 'polygon') {
      const r = shapeRadius * 200;
      const sides = Math.max(3, polygonSides);
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        rawPts.push({
          x: Math.round(r * Math.cos(a)),
          y: Math.round(r * Math.sin(a))
        });
      }
    } else if (selectedShape === 'star') {
      const pts = Math.max(3, starPoints);
      const outerR = shapeRadius * 200;
      const innerR = outerR * Math.max(0.2, Math.min(0.8, starInnerRatio));
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        rawPts.push({
          x: Math.round(r * Math.cos(a)),
          y: Math.round(r * Math.sin(a))
        });
      }
    } else if (selectedShape === 'heart') {
      const s = (shapeRadius / 0.15) * 0.8;
      rawPts = [
        { x: 0, y: Math.round(85 * s) },
        { x: Math.round(85 * s), y: Math.round(-15 * s) },
        { x: 0, y: Math.round(-40 * s) },
        { x: Math.round(-85 * s), y: Math.round(-15 * s) }
      ];
    } else if (selectedShape === 'shield') {
      const s = (shapeRadius / 0.15) * 0.8;
      rawPts = [
        { x: Math.round(-70 * s), y: Math.round(-70 * s) },
        { x: 0, y: Math.round(-60 * s) },
        { x: Math.round(70 * s), y: Math.round(-70 * s) },
        { x: Math.round(65 * s), y: Math.round(10 * s) },
        { x: 0, y: Math.round(90 * s) },
        { x: Math.round(-65 * s), y: Math.round(10 * s) }
      ];
    } else if (selectedShape === 'diamond') {
      const s = (shapeRadius / 0.15) * 0.8;
      rawPts = [
        { x: 0, y: Math.round(-90 * s) },
        { x: Math.round(75 * s), y: Math.round(-35 * s) },
        { x: Math.round(40 * s), y: Math.round(75 * s) },
        { x: Math.round(-40 * s), y: Math.round(75 * s) },
        { x: Math.round(-75 * s), y: Math.round(-35 * s) }
      ];
    } else if (selectedShape === 'polyline' || selectedShape === 'freehand') {
      if (customPoints.length >= 3) {
        rawPts = customPoints.map((p) => ({
          x: Math.round(p.u * 200),
          y: Math.round(-p.v * 200)
        }));
      } else {
        // Fallback default triangle if not enough custom points
        const r = shapeRadius * 200;
        rawPts = [
          { x: 0, y: -r },
          { x: r * 0.866, y: r * 0.5 },
          { x: -r * 0.866, y: r * 0.5 }
        ];
      }
    }

    // Apply rotation & offset
    const rad = (shapeRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const offX = offsetU * 200;
    const offY = -offsetV * 200;

    return rawPts.map((pt) => {
      const rx = pt.x * cos - pt.y * sin;
      const ry = pt.x * sin + pt.y * cos;
      return {
        x: Math.round(rx + offX),
        y: Math.round(ry + offY)
      };
    });
  }, [
    selectedShape,
    shapeWidth,
    shapeHeight,
    shapeRadius,
    polygonSides,
    starPoints,
    starInnerRatio,
    shapeRotation,
    offsetU,
    offsetV,
    customPoints
  ]);

  // ---------------------------------------------------------------------------
  // Auto-Activate Face Selection on Target Object
  // ---------------------------------------------------------------------------
  const activateFaceOnTarget = useCallback((targetObj, targetName) => {
    if (!targetObj) {
      setStep('pick_face');
      return;
    }

    try {
      targetObj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(targetObj);
      if (box.isEmpty()) {
        setStep('pick_face');
        return;
      }

      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);

      const sceneEl = document.querySelector('a-scene');
      const camera = sceneEl?.camera || window.__arOrbitCamera;

      let validHit = null;

      // 1. Primary: Raycast from camera position directly towards center of target
      if (camera) {
        const rayDir = new THREE.Vector3().subVectors(center, camera.position).normalize();
        const raycaster = new THREE.Raycaster(camera.position.clone(), rayDir);
        const hits = raycaster.intersectObject(targetObj, true);
        validHit = hits.find(
          (h) => h.object && h.object.visible !== false && Boolean(h.face)
        );
      }

      // 2. Secondary: If camera raycast didn't hit (camera inside or angled),
      // probe from outside bounding box towards center along camera line of sight
      if (!validHit && camera) {
        const camDir = new THREE.Vector3().subVectors(camera.position, center).normalize();
        const maxDim = Math.max(size.x, size.y, size.z, 0.5);
        const probeOrigin = center.clone().add(camDir.multiplyScalar(maxDim * 2.5));
        const probeDir = new THREE.Vector3().subVectors(center, probeOrigin).normalize();
        const probeRay = new THREE.Raycaster(probeOrigin, probeDir);
        const probeHits = probeRay.intersectObject(targetObj, true);
        validHit = probeHits.find(
          (h) => h.object && h.object.visible !== false && Boolean(h.face)
        );
      }

      // 3. Fallback: Probe from +Y (top face) downwards towards center
      if (!validHit) {
        const maxDim = Math.max(size.x, size.y, size.z, 0.5);
        const topOrigin = new THREE.Vector3(center.x, box.max.y + maxDim, center.z);
        const downDir = new THREE.Vector3(0, -1, 0);
        const topRay = new THREE.Raycaster(topOrigin, downDir);
        const topHits = topRay.intersectObject(targetObj, true);
        validHit = topHits.find(
          (h) => h.object && h.object.visible !== false && Boolean(h.face)
        );
      }

      let hitPoint = null;
      let worldNormal = null;
      let hitMesh = null;

      if (validHit && validHit.face) {
        hitMesh = validHit.object;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
        worldNormal = validHit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        hitPoint = validHit.point.clone();
      } else {
        // 4. Final fallback: find first mesh with geometry and use top (+Y)
        targetObj.traverse((child) => {
          if (!hitMesh && child.isMesh && child.geometry) {
            hitMesh = child;
          }
        });
        worldNormal = new THREE.Vector3(0, 1, 0);
        hitPoint = new THREE.Vector3(center.x, box.max.y, center.z);
      }

      // Compute tangent uAxis & bitangent vAxis
      const uAxis = new THREE.Vector3();
      const vAxis = new THREE.Vector3();
      if (Math.abs(worldNormal.y) > 0.92) {
        uAxis.set(1, 0, 0);
        vAxis.crossVectors(worldNormal, uAxis).normalize();
        uAxis.crossVectors(vAxis, worldNormal).normalize();
      } else {
        uAxis.crossVectors(new THREE.Vector3(0, 1, 0), worldNormal).normalize();
        vAxis.crossVectors(worldNormal, uAxis).normalize();
      }

      // Determine parent name & color
      let resolvedName = targetName || hitMesh?.name || 'Object';
      let resolvedColor = '#38bdf8';
      let p = hitMesh || targetObj;
      while (p) {
        if (p.userData?.name) resolvedName = p.userData.name;
        if (p.userData?.color) resolvedColor = p.userData.color;
        p = p.parent;
      }
      if (hitMesh?.material?.color) {
        resolvedColor = `#${hitMesh.material.color.getHexString()}`;
      }

      // Proportional shape sizing based on target's bounding box face dimensions
      const faceSpan = Math.max(
        0.05,
        Math.min(
          Math.abs(worldNormal.x) > 0.5 ? Math.min(size.y, size.z) :
          Math.abs(worldNormal.y) > 0.5 ? Math.min(size.x, size.z) :
          Math.min(size.x, size.y)
        ) || 0.4
      );

      const propW = Number(Math.max(0.04, Math.min(faceSpan * 0.5, 1.5)).toFixed(2));
      const propH = Number(Math.max(0.04, Math.min(faceSpan * 0.5, 1.5)).toFixed(2));
      const propR = Number(Math.max(0.02, Math.min(faceSpan * 0.3, 0.8)).toFixed(2));
      const propD = Number(Math.max(0.02, Math.min(faceSpan * 0.25, 0.8)).toFixed(2));

      setShapeWidth(propW);
      setShapeHeight(propH);
      setShapeRadius(propR);
      setExtrudeDepth(propD);
      setShapeRotation(0);
      setOffsetU(0);
      setOffsetV(0);
      setCustomPoints([]);

      setFaceData({
        point: hitPoint,
        normal: worldNormal,
        uAxis,
        vAxis,
        parentMesh: hitMesh,
        parentName: resolvedName,
        parentColor: resolvedColor
      });

      setObjectName(`${resolvedName} Face Extrude`);
      setExtrudeColor(resolvedColor);
      setStep('draw_shape');
    } catch (err) {
      console.warn('FaceSketchExtrudeStudio: Auto-activation on target failed:', err);
      setStep('pick_face');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Lifecycle Hook: Auto-activate on selectedTarget when Studio opens or target changes
  // ---------------------------------------------------------------------------
  const prevIsOpenRef = useRef(false);
  const prevTargetIdRef = useRef(null);

  useEffect(() => {
    const targetId = selectedTarget?.id || null;
    const justOpened = isOpen && !prevIsOpenRef.current;
    const targetChanged = isOpen && targetId !== prevTargetIdRef.current;

    if (justOpened || targetChanged) {
      if (selectedTarget?.threeObject) {
        setScopeToSelected(true);
        activateFaceOnTarget(selectedTarget.threeObject, selectedTarget.name);
      } else if (justOpened) {
        setStep('pick_face');
        setFaceData(null);
        setScopeToSelected(false);
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      setFaceData(null);
      setStep('pick_face');
    }

    prevIsOpenRef.current = isOpen;
    prevTargetIdRef.current = targetId;
  }, [isOpen, selectedTarget, activateFaceOnTarget]);

  // ---------------------------------------------------------------------------
  // Face Raycasting Candidates in 3D Scene
  // ---------------------------------------------------------------------------
  const getRaycastCandidates = useCallback(() => {
    if (scopeToSelected && selectedTarget?.threeObject) {
      return [selectedTarget.threeObject];
    }
    const candidates = [];
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) candidates.push(model3D);

    const geomEl = document.getElementById('ar-additional-geometries-anchor');
    const geomGroup = geomEl?.getObject3D('additionalGeometriesRoot') || geomEl?.object3D;
    if (geomGroup) candidates.push(geomGroup);

    const customModelsEl = document.getElementById('ar-custom-models-anchor');
    const customModelsGroup = customModelsEl?.getObject3D('customModelsRoot') || customModelsEl?.object3D;
    if (customModelsGroup) candidates.push(customModelsGroup);

    const textEl = document.getElementById('ar-3d-texts-anchor');
    const textGroup = textEl?.getObject3D('texts3DRoot') || textEl?.object3D;
    if (textGroup) candidates.push(textGroup);

    return candidates;
  }, [scopeToSelected, selectedTarget]);

  // ---------------------------------------------------------------------------
  // STEP 1: Face Hover and Selection Handling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || step !== 'pick_face') {
      if (hoverIndicatorRef.current && hoverIndicatorRef.current.parent) {
        hoverIndicatorRef.current.parent.remove(hoverIndicatorRef.current);
        hoverIndicatorRef.current = null;
      }
      return;
    }

    const sceneEl = document.querySelector('a-scene');
    const canvas = sceneEl?.canvas;
    const camera = sceneEl?.camera || window.__arOrbitCamera;
    const previewGroup = previewGroupRef.current;
    if (!sceneEl || !canvas || !camera || !previewGroup) return;

    // Create Hover Indicator Indicator Group
    if (!hoverIndicatorRef.current) {
      const indicatorGroup = new THREE.Group();
      indicatorGroup.name = 'face_hover_indicator';

      // Ring overlay
      const ringGeo = new THREE.RingGeometry(0.04, 0.065, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthTest: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      indicatorGroup.add(ringMesh);

      // Center crosshair dot
      const dotGeo = new THREE.CircleGeometry(0.015, 16);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        depthTest: false
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      indicatorGroup.add(dotMesh);

      // Normal vector arrow pointing outwards
      const arrowHelper = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        0.18,
        0x38bdf8,
        0.05,
        0.035
      );
      indicatorGroup.add(arrowHelper);
      indicatorGroup.visible = false;

      previewGroup.add(indicatorGroup);
      hoverIndicatorRef.current = indicatorGroup;
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        if (hoverIndicatorRef.current) hoverIndicatorRef.current.visible = false;
        setHoveredInfo(null);
        return;
      }

      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const candidates = getRaycastCandidates();
      const hits = raycaster.intersectObjects(candidates, true);

      const validHit = hits.find((h) => {
        if (!h.object || h.object.visible === false) return false;
        if (h.object.name && /helper|picker|gizmo|__starwear/i.test(h.object.name)) return false;
        let p = h.object.parent;
        while (p) {
          if (p.visible === false || (p.name && /__starwear/i.test(p.name))) return false;
          p = p.parent;
        }
        return Boolean(h.face);
      });

      if (validHit && validHit.face && hoverIndicatorRef.current) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(validHit.object.matrixWorld);
        const worldNormal = validHit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        const hitPoint = validHit.point.clone();

        // Position indicator slightly above surface to prevent z-fighting
        hoverIndicatorRef.current.position.copy(hitPoint).add(worldNormal.clone().multiplyScalar(0.003));
        hoverIndicatorRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
        hoverIndicatorRef.current.visible = true;

        // Extract human-friendly name
        let targetName = validHit.object.name || '3D Object';
        let p = validHit.object;
        while (p) {
          if (p.userData?.name) {
            targetName = p.userData.name;
            break;
          }
          p = p.parent;
        }

        setHoveredInfo({
          name: targetName,
          normalDesc: getNormalDescription(worldNormal)
        });
      } else {
        if (hoverIndicatorRef.current) hoverIndicatorRef.current.visible = false;
        setHoveredInfo(null);
      }
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) return;

      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const candidates = getRaycastCandidates();
      const hits = raycaster.intersectObjects(candidates, true);

      const validHit = hits.find((h) => {
        if (!h.object || h.object.visible === false) return false;
        if (h.object.name && /helper|picker|gizmo|__starwear/i.test(h.object.name)) return false;
        let p = h.object.parent;
        while (p) {
          if (p.visible === false || (p.name && /__starwear/i.test(p.name))) return false;
          p = p.parent;
        }
        return Boolean(h.face);
      });

      if (validHit && validHit.face) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(validHit.object.matrixWorld);
        const worldNormal = validHit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        const hitPoint = validHit.point.clone();

        // Compute tangent uAxis & bitangent vAxis
        const uAxis = new THREE.Vector3();
        const vAxis = new THREE.Vector3();
        if (Math.abs(worldNormal.y) > 0.92) {
          uAxis.set(1, 0, 0);
          vAxis.crossVectors(worldNormal, uAxis).normalize();
          uAxis.crossVectors(vAxis, worldNormal).normalize();
        } else {
          uAxis.crossVectors(new THREE.Vector3(0, 1, 0), worldNormal).normalize();
          vAxis.crossVectors(worldNormal, uAxis).normalize();
        }

        // Determine parent name & color
        let parentName = validHit.object.name || 'Object';
        let parentColor = '#38bdf8';
        let p = validHit.object;
        while (p) {
          if (p.userData?.name) parentName = p.userData.name;
          if (p.userData?.color) parentColor = p.userData.color;
          p = p.parent;
        }
        if (validHit.object.material?.color) {
          parentColor = `#${validHit.object.material.color.getHexString()}`;
        }

        const box = new THREE.Box3().setFromObject(validHit.object);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          box.getSize(size);
          const faceSpan = Math.max(
            0.05,
            Math.min(
              Math.abs(worldNormal.x) > 0.5 ? Math.min(size.y, size.z) :
              Math.abs(worldNormal.y) > 0.5 ? Math.min(size.x, size.z) :
              Math.min(size.x, size.y)
            ) || 0.4
          );
          setShapeWidth(Number(Math.max(0.04, Math.min(faceSpan * 0.5, 1.5)).toFixed(2)));
          setShapeHeight(Number(Math.max(0.04, Math.min(faceSpan * 0.5, 1.5)).toFixed(2)));
          setShapeRadius(Number(Math.max(0.02, Math.min(faceSpan * 0.3, 0.8)).toFixed(2)));
          setExtrudeDepth(Number(Math.max(0.02, Math.min(faceSpan * 0.25, 0.8)).toFixed(2)));
        }
        setShapeRotation(0);
        setOffsetU(0);
        setOffsetV(0);
        setCustomPoints([]);

        setFaceData({
          point: hitPoint,
          normal: worldNormal,
          uAxis,
          vAxis,
          parentMesh: validHit.object,
          parentName,
          parentColor
        });

        setObjectName(`${parentName} Face Extrude`);
        setExtrudeColor(parentColor);
        setStep('draw_shape');

        if (hoverIndicatorRef.current) hoverIndicatorRef.current.visible = false;
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [isOpen, step, getRaycastCandidates]);

  // Helper: Cardinal direction description of face normal
  function getNormalDescription(normal) {
    if (normal.y > 0.8) return '+Y (Top Face)';
    if (normal.y < -0.8) return '-Y (Bottom Face)';
    if (normal.z > 0.8) return '+Z (Front Face)';
    if (normal.z < -0.8) return '-Z (Back Face)';
    if (normal.x > 0.8) return '+X (Right Face)';
    if (normal.x < -0.8) return '-X (Left Face)';
    return `Angle (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})`;
  }

  // ---------------------------------------------------------------------------
  // Align Camera to Face Drafting View (Drafting / Orthogonal Board)
  // ---------------------------------------------------------------------------
  const alignCameraToFace = useCallback(() => {
    if (!faceData) return;
    const sceneEl = document.querySelector('a-scene');
    const camera = sceneEl?.camera || window.__arOrbitCamera;
    const orbitControls = window.__starwear_orbit_controls || window.__arOrbitControls;
    if (!camera) return;

    if (!originalCameraPosRef.current) {
      originalCameraPosRef.current = camera.position.clone();
      if (orbitControls?.target) {
        originalCameraTargetRef.current = orbitControls.target.clone();
      }
    }

    const targetPos = faceData.point.clone();
    // Position camera 1.5m back along face normal
    const camPos = faceData.point.clone().add(faceData.normal.clone().multiplyScalar(1.6));

    camera.position.copy(camPos);
    camera.lookAt(targetPos);
    if (orbitControls) {
      orbitControls.target.copy(targetPos);
      orbitControls.update();
    }
  }, [faceData]);

  // Restore studio perspective camera
  const restoreCameraView = useCallback(() => {
    const sceneEl = document.querySelector('a-scene');
    const camera = sceneEl?.camera || window.__arOrbitCamera;
    const orbitControls = window.__starwear_orbit_controls || window.__arOrbitControls;
    if (!camera || !originalCameraPosRef.current) return;

    camera.position.copy(originalCameraPosRef.current);
    if (originalCameraTargetRef.current && orbitControls) {
      orbitControls.target.copy(originalCameraTargetRef.current);
      orbitControls.update();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // STEP 2: Render 2D Sketch Shape & Grid on Face
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || step !== 'draw_shape' || !faceData) {
      if (sketchGridRef.current && sketchGridRef.current.parent) {
        sketchGridRef.current.parent.remove(sketchGridRef.current);
        sketchGridRef.current = null;
      }
      if (sketchMeshRef.current && sketchMeshRef.current.parent) {
        sketchMeshRef.current.parent.remove(sketchMeshRef.current);
        sketchMeshRef.current = null;
      }
      if (sketchLineRef.current && sketchLineRef.current.parent) {
        sketchLineRef.current.parent.remove(sketchLineRef.current);
        sketchLineRef.current = null;
      }
      return;
    }

    const previewGroup = previewGroupRef.current;
    if (!previewGroup) return;

    const { point, normal, uAxis, vAxis } = faceData;
    const rotMatrix = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    // 1. Sketch Grid Plane lying flat on the face
    if (!sketchGridRef.current) {
      const grid = new THREE.GridHelper(1.2, 12, 0x38bdf8, 0x1e293b);
      grid.rotation.x = Math.PI / 2; // Lie flat in XY plane
      grid.position.copy(point).add(normal.clone().multiplyScalar(0.001));
      grid.quaternion.copy(quat);
      previewGroup.add(grid);
      sketchGridRef.current = grid;
    }

    // 2. Generate 2D contour points
    const pts = generateContourPoints();
    if (!pts || pts.length < 3) return;

    // Convert pixel points back to meters for 3D display on the face
    // x in pts is along uAxis (meters = x / 200)
    // y in pts is along -vAxis (meters = -y / 200)
    const shape = new THREE.Shape();
    const p0 = pts[0];
    shape.moveTo(p0.x * 0.005, -p0.y * 0.005);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].x * 0.005, -pts[i].y * 0.005);
    }
    shape.closePath();

    // Fill mesh on face
    const shapeGeo = new THREE.ShapeGeometry(shape);
    const shapeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false
    });

    if (sketchMeshRef.current) {
      sketchMeshRef.current.geometry.dispose();
      sketchMeshRef.current.geometry = shapeGeo;
    } else {
      const mesh = new THREE.Mesh(shapeGeo, shapeMat);
      mesh.position.copy(point).add(normal.clone().multiplyScalar(0.002));
      mesh.quaternion.copy(quat);
      previewGroup.add(mesh);
      sketchMeshRef.current = mesh;
    }

    // Outline line loop on face
    const linePts = pts.map((p) => new THREE.Vector3(p.x * 0.005, -p.y * 0.005, 0));
    const lineGeo = new THREE.BufferGeometry().setFromPoints([...linePts, linePts[0]]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      linewidth: 3,
      depthTest: false
    });

    if (sketchLineRef.current) {
      sketchLineRef.current.geometry.dispose();
      sketchLineRef.current.geometry = lineGeo;
    } else {
      const line = new THREE.Line(lineGeo, lineMat);
      line.position.copy(point).add(normal.clone().multiplyScalar(0.003));
      line.quaternion.copy(quat);
      previewGroup.add(line);
      sketchLineRef.current = line;
    }
  }, [isOpen, step, faceData, generateContourPoints]);

  // ---------------------------------------------------------------------------
  // Direct In-Viewport Freehand & Polyline Drawing on Face
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || step !== 'draw_shape' || !faceData || canvasInteractionMode !== 'draw') return;

    const sceneEl = document.querySelector('a-scene');
    const canvas = sceneEl?.canvas;
    const camera = sceneEl?.camera || window.__arOrbitCamera;
    const orbitControls = window.__starwear_orbit_controls || window.__arOrbitControls;
    if (!canvas || !camera) return;

    // Face plane definition in 3D: normal * X = normal * point
    const { point, normal, uAxis, vAxis } = faceData;
    const facePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getFaceUV = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hitPt = new THREE.Vector3();
      const intersects = raycaster.ray.intersectPlane(facePlane, hitPt);
      if (!intersects) return null;

      const delta = hitPt.clone().sub(point);
      const u = delta.dot(uAxis);
      const v = delta.dot(vAxis);
      return { u, v };
    };

    const handlePointerDown = (e) => {
      if (e.button !== 0) return; // Only left mouse button
      const uv = getFaceUV(e);
      if (!uv) return;

      if (selectedShape === 'polyline') {
        setCustomPoints((prev) => [...prev, uv]);
      } else if (selectedShape === 'freehand') {
        isDrawingStrokeRef.current = true;
        setCustomPoints([uv]);
        if (orbitControls) orbitControls.enabled = false;
      }
    };

    const handlePointerMove = (e) => {
      if (!isDrawingStrokeRef.current || selectedShape !== 'freehand') return;
      const uv = getFaceUV(e);
      if (!uv) return;

      setCustomPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return [uv];
        const distSq = (uv.u - last.u) ** 2 + (uv.v - last.v) ** 2;
        if (distSq > 0.0004) { // Only sample every ~2cm to keep vertex count reasonable
          return [...prev, uv];
        }
        return prev;
      });
    };

    const handlePointerUp = () => {
      if (isDrawingStrokeRef.current) {
        isDrawingStrokeRef.current = false;
        if (orbitControls) orbitControls.enabled = true;
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (orbitControls) orbitControls.enabled = true;
    };
  }, [isOpen, step, faceData, selectedShape, canvasInteractionMode]);

  // ---------------------------------------------------------------------------
  // STEP 3: Live 3D Extrusion Mesh Preview & Pull Handle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || step !== 'extrude' || !faceData) {
      if (extrudeMeshRef.current && extrudeMeshRef.current.parent) {
        extrudeMeshRef.current.parent.remove(extrudeMeshRef.current);
        extrudeMeshRef.current = null;
      }
      if (pullHandleRef.current && pullHandleRef.current.parent) {
        pullHandleRef.current.parent.remove(pullHandleRef.current);
        pullHandleRef.current = null;
      }
      return;
    }

    const previewGroup = previewGroupRef.current;
    if (!previewGroup) return;

    // Clean up drawing grid / line
    if (sketchGridRef.current && sketchGridRef.current.parent) {
      sketchGridRef.current.parent.remove(sketchGridRef.current);
      sketchGridRef.current = null;
    }
    if (sketchMeshRef.current && sketchMeshRef.current.parent) {
      sketchMeshRef.current.parent.remove(sketchMeshRef.current);
      sketchMeshRef.current = null;
    }
    if (sketchLineRef.current && sketchLineRef.current.parent) {
      sketchLineRef.current.parent.remove(sketchLineRef.current);
      sketchLineRef.current = null;
    }

    const { point, normal, uAxis, vAxis } = faceData;
    const pts = generateContourPoints();
    if (!pts || pts.length < 3) return;

    const absDepth = Math.max(0.01, Math.abs(extrudeDepth));
    const rotMatrix = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    // Compute center position so extrusion base sits exactly flush with face at `point`
    const dirMult = extrudeDepth >= 0 ? 1 : -1;
    const centerPos = point.clone().add(normal.clone().multiplyScalar((absDepth / 2) * dirMult));

    // Build geometry using standard vectorExtrude engine
    const geom = createPrimitiveThreeGeometry('vectorExtrude', {
      points: pts,
      scaleFactor: 0.005,
      depth: absDepth,
      bevelEnabled: bevelEnabled,
      bevelThickness: bevelThickness,
      bevelSize: bevelSize,
      bevelSegments: 3,
      taper: taper
    }, THREE);

    // Build material
    const mat = createPrimitiveMaterial({
      color: extrudeColor,
      roughness: extrudeRoughness,
      metalness: extrudeMetalness,
      preset: extrudePreset
    }, THREE);

    if (extrudeMeshRef.current) {
      extrudeMeshRef.current.geometry.dispose();
      extrudeMeshRef.current.geometry = geom;
      extrudeMeshRef.current.material.dispose();
      extrudeMeshRef.current.material = mat;
      extrudeMeshRef.current.position.copy(centerPos);
      extrudeMeshRef.current.quaternion.copy(quat);
    } else {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = '__face_extrude_preview__';
      mesh.position.copy(centerPos);
      mesh.quaternion.copy(quat);
      previewGroup.add(mesh);
      extrudeMeshRef.current = mesh;
    }

    // Interactive Normal Arrow Handle extending from front face
    const handleFrontPos = point.clone().add(normal.clone().multiplyScalar(extrudeDepth));
    if (!pullHandleRef.current) {
      const handleGroup = new THREE.Group();
      handleGroup.name = 'extrude_pull_handle';

      const coneGeo = new THREE.ConeGeometry(0.035, 0.09, 16);
      coneGeo.rotateX(Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        depthTest: false
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      handleGroup.add(coneMesh);

      pullHandleRef.current = handleGroup;
      previewGroup.add(handleGroup);
    }

    pullHandleRef.current.position.copy(handleFrontPos);
    pullHandleRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }, [
    isOpen,
    step,
    faceData,
    extrudeDepth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    taper,
    extrudeColor,
    extrudeRoughness,
    extrudeMetalness,
    extrudePreset,
    generateContourPoints
  ]);

  // ---------------------------------------------------------------------------
  // COMMIT: Finalize Extruded 3D Mesh into Scene
  // ---------------------------------------------------------------------------
  const handleCommit = useCallback(() => {
    if (!faceData) return;
    const { point, normal, uAxis, vAxis, parentName } = faceData;
    const pts = generateContourPoints();
    if (!pts || pts.length < 3) return;

    const absDepth = Math.max(0.01, Math.abs(extrudeDepth));
    const dirMult = extrudeDepth >= 0 ? 1 : -1;
    const centerPos = point.clone().add(normal.clone().multiplyScalar((absDepth / 2) * dirMult));

    const rotMatrix = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
    const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

    const rotX = Number(THREE.MathUtils.radToDeg(euler.x).toFixed(2));
    const rotY = Number(THREE.MathUtils.radToDeg(euler.y).toFixed(2));
    const rotZ = Number(THREE.MathUtils.radToDeg(euler.z).toFixed(2));

    const posX = Number(centerPos.x.toFixed(3));
    const posY = Number(centerPos.y.toFixed(3));
    const posZ = Number(centerPos.z.toFixed(3));

    const payload = {
      type: 'vectorExtrude',
      name: objectName.trim() || `${parentName || 'Object'} Extrude`,
      params: {
        points: pts,
        scaleFactor: 0.005,
        depth: absDepth,
        bevelEnabled,
        bevelThickness,
        bevelSize,
        bevelSegments: 3,
        taper,
        parentFaceInfo: {
          parentName: parentName || objectName || 'parent_object',
          normal: [Number(normal.x.toFixed(4)), Number(normal.y.toFixed(4)), Number(normal.z.toFixed(4))]
        }
      },
      color: extrudeColor,
      preset: extrudePreset,
      roughness: extrudeRoughness,
      metalness: extrudeMetalness,
      posX,
      posY,
      posZ,
      rotX,
      rotY,
      rotZ,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      visible: true
    };

    onCommitExtrude(payload);
    onClose();
  }, [
    faceData,
    extrudeDepth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    taper,
    objectName,
    extrudeColor,
    extrudePreset,
    extrudeRoughness,
    extrudeMetalness,
    generateContourPoints,
    onCommitExtrude,
    onClose
  ]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between overflow-hidden">
      {/* ===================================================================== */}
      {/* TOP VIEWPORT STATUS BAR & INSTRUCTION BANNER                          */}
      {/* ===================================================================== */}
      <div className="p-3 flex justify-center items-start">
        <div className="pointer-events-auto max-w-2xl w-full bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 animate-fade-in">
          {/* Step 1: Pick Face */}
          {step === 'pick_face' && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <span className="material-symbols-outlined text-lg animate-pulse">ads_click</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-300 border border-teal-500/40">
                    Step 1 of 3
                  </span>
                  <span className="text-xs font-bold text-white">
                    {scopeToSelected && selectedTarget?.name
                      ? `Click any face on ${selectedTarget.name}`
                      : 'Click any object face to place sketch plane'}
                  </span>
                  {selectedTarget?.threeObject && (
                    <button
                      type="button"
                      onClick={() => setScopeToSelected((prev) => !prev)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                        scopeToSelected
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-teal-500/30'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      }`}
                      title={scopeToSelected ? "Click to pick from any object in the scene" : `Click to restrict picking to ${selectedTarget.name}`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {scopeToSelected ? 'filter_center_focus' : 'public'}
                      </span>
                      <span>{scopeToSelected ? `Target: ${selectedTarget.name}` : 'Target: Any Object'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  {hoveredInfo ? (
                    <span className="text-teal-300 font-medium">
                      Hovering on: <strong className="text-white">{hoveredInfo.name}</strong> • {hoveredInfo.normalDesc}
                    </span>
                  ) : scopeToSelected && selectedTarget?.name ? (
                    `Hover over ${selectedTarget.name} to choose another face, or switch target`
                  ) : (
                    'Hover your cursor over any 3D object in the viewport'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Draw Shape */}
          {step === 'draw_shape' && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <span className="material-symbols-outlined text-lg">draw</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/40">
                    Step 2 of 3
                  </span>
                  <span className="text-xs font-bold text-white">
                    Draw Shape on {faceData?.parentName || 'Face'}
                  </span>
                  {selectedTarget?.name && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>{selectedTarget.name}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Select a shape tool or draw on the face, then click Extrude
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Extrude */}
          {step === 'extrude' && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-lg">unfold_more</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                    Step 3 of 3
                  </span>
                  <span className="text-xs font-bold text-white">
                    Pull & Extrude from Face
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Set extrusion depth, bevel, and material, then commit to scene
                </p>
              </div>
            </div>
          )}

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5">
            {step === 'draw_shape' && (
              <>
                <button
                  type="button"
                  onClick={alignCameraToFace}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Align camera perpendicular to face (Drafting Board View)"
                >
                  <span className="material-symbols-outlined text-xs text-cyan-400">crop_free</span>
                  <span>Face View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTarget?.threeObject) setScopeToSelected(true);
                    setStep('pick_face');
                  }}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  title={selectedTarget?.name ? `Select a different face on ${selectedTarget.name}` : "Select a different face"}
                >
                  Change Face
                </button>
                <button
                  type="button"
                  onClick={() => setStep('extrude')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <span>Extrude</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </>
            )}

            {step === 'extrude' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('draw_shape')}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">edit</span>
                  <span>Edit Sketch</span>
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>Add to Scene</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
              title="Close Face Studio (Esc)"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM FLOATING CONTROLS DOCK                                         */}
      {/* ===================================================================== */}
      <div className="p-3 flex justify-center items-end">
        {/* DOCK FOR STEP 2: DRAW SHAPE */}
        {step === 'draw_shape' && (
          <div className="pointer-events-auto max-w-3xl w-full bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl shadow-2xl p-3.5 flex flex-col gap-3 animate-slide-up">
            {/* Shape Preset Selector Bar */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
                {SHAPE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedShape(preset.id);
                      if (preset.id === 'polyline' || preset.id === 'freehand') {
                        setCanvasInteractionMode('draw');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      selectedShape === preset.id
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40 ring-1 ring-teal-400'
                        : 'bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 hover:text-white border border-neutral-700/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              {/* Mode Toggle: Orbit vs Draw */}
              <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCanvasInteractionMode('draw')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    canvasInteractionMode === 'draw'
                      ? 'bg-cyan-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Draw mode: Click & drag on face"
                >
                  <span className="material-symbols-outlined text-xs">edit</span>
                  <span>Draw</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasInteractionMode('orbit')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    canvasInteractionMode === 'orbit'
                      ? 'bg-cyan-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Orbit mode: Rotate 3D camera"
                >
                  <span className="material-symbols-outlined text-xs">3d_rotation</span>
                  <span>Orbit</span>
                </button>
              </div>
            </div>

            {/* Shape Dimensional Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Rectangle: Width & Height */}
              {selectedShape === 'rectangle' && (
                <>
                  <div>
                    <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                      <span>Width</span>
                      <span className="text-white font-bold">{shapeWidth.toFixed(2)}m</span>
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1.5"
                      step="0.01"
                      value={shapeWidth}
                      onChange={(e) => setShapeWidth(parseFloat(e.target.value))}
                      className="w-full accent-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                      <span>Height</span>
                      <span className="text-white font-bold">{shapeHeight.toFixed(2)}m</span>
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1.5"
                      step="0.01"
                      value={shapeHeight}
                      onChange={(e) => setShapeHeight(parseFloat(e.target.value))}
                      className="w-full accent-teal-400"
                    />
                  </div>
                </>
              )}

              {/* Circle / Polygon / Star: Radius */}
              {(selectedShape === 'circle' || selectedShape === 'polygon' || selectedShape === 'star' || selectedShape === 'heart' || selectedShape === 'shield' || selectedShape === 'diamond') && (
                <div>
                  <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                    <span>Radius</span>
                    <span className="text-white font-bold">{shapeRadius.toFixed(2)}m</span>
                  </label>
                  <input
                    type="range"
                    min="0.04"
                    max="1.0"
                    step="0.01"
                    value={shapeRadius}
                    onChange={(e) => setShapeRadius(parseFloat(e.target.value))}
                    className="w-full accent-teal-400"
                  />
                </div>
              )}

              {/* Polygon: Sides */}
              {selectedShape === 'polygon' && (
                <div>
                  <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                    <span>Sides</span>
                    <span className="text-white font-bold">{polygonSides}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="1"
                    value={polygonSides}
                    onChange={(e) => setPolygonSides(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-400"
                  />
                </div>
              )}

              {/* Star: Points */}
              {selectedShape === 'star' && (
                <div>
                  <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                    <span>Star Points</span>
                    <span className="text-white font-bold">{starPoints}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="1"
                    value={starPoints}
                    onChange={(e) => setStarPoints(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-400"
                  />
                </div>
              )}

              {/* Rotation on Face */}
              <div>
                <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                  <span>Rotation</span>
                  <span className="text-white font-bold">{shapeRotation}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={shapeRotation}
                  onChange={(e) => setShapeRotation(parseInt(e.target.value, 10))}
                  className="w-full accent-teal-400"
                />
              </div>

              {/* Position Offset U */}
              <div>
                <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                  <span>Offset U</span>
                  <span className="text-white font-bold">{offsetU.toFixed(2)}m</span>
                </label>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={offsetU}
                  onChange={(e) => setOffsetU(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>

              {/* Position Offset V */}
              <div>
                <label className="text-[11px] text-neutral-400 flex justify-between font-mono mb-1">
                  <span>Offset V</span>
                  <span className="text-white font-bold">{offsetV.toFixed(2)}m</span>
                </label>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={offsetV}
                  onChange={(e) => setOffsetV(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
            </div>

            {/* Polyline / Freehand point status & reset */}
            {(selectedShape === 'polyline' || selectedShape === 'freehand') && (
              <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg text-xs">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-400">touch_app</span>
                  <span>
                    {customPoints.length === 0
                      ? 'Click on the face in 3D to place polygon vertices'
                      : `${customPoints.length} points placed on face plane`}
                  </span>
                </span>
                {customPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomPoints([])}
                    className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer text-[11px]"
                  >
                    Clear Points
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* DOCK FOR STEP 3: EXTRUSION SETTINGS */}
        {step === 'extrude' && (
          <div className="pointer-events-auto max-w-3xl w-full bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3.5 animate-slide-up">
            {/* Header: Extrusion Depth & Presets */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">height</span>
                  Extrusion Depth: <strong className="text-emerald-300 font-mono text-sm">{extrudeDepth.toFixed(2)}m</strong>
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[-0.05, 0.05, 0.15, 0.3, 0.5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtrudeDepth(d)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      extrudeDepth === d
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {d > 0 ? `+${d}m` : `${d}m (Cut)`}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth Slider */}
            <div>
              <input
                type="range"
                min="-0.3"
                max="1.2"
                step="0.01"
                value={extrudeDepth}
                onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Bevel, Taper, Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Bevel Controls */}
              <div className="bg-black/40 p-2.5 rounded-xl border border-neutral-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-emerald-400">rounded_corner</span>
                    Edge Bevel
                  </span>
                  <input
                    type="checkbox"
                    checked={bevelEnabled}
                    onChange={(e) => setBevelEnabled(e.target.checked)}
                    className="accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
                {bevelEnabled && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Bevel Thickness</span>
                      <span className="text-white font-mono">{bevelThickness.toFixed(3)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0.003"
                      max="0.04"
                      step="0.001"
                      value={bevelThickness}
                      onChange={(e) => setBevelThickness(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>
                )}
              </div>

              {/* Taper / Draft Factor */}
              <div className="bg-black/40 p-2.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between font-semibold text-neutral-300 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-emerald-400">change_history</span>
                      Taper / Draft
                    </span>
                    <span className="text-white font-mono">{taper.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    {taper === 1.0 ? 'Straight' : taper < 1.0 ? 'Contracting inwards' : 'Expanding outwards'}
                  </p>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.6"
                  step="0.05"
                  value={taper}
                  onChange={(e) => setTaper(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              {/* Name & Quick Match */}
              <div className="bg-black/40 p-2.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-1.5">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold mb-1 block">
                    Object Name
                  </label>
                  <input
                    type="text"
                    value={objectName}
                    onChange={(e) => setObjectName(e.target.value)}
                    className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                {faceData?.parentColor && (
                  <button
                    type="button"
                    onClick={() => setExtrudeColor(faceData.parentColor)}
                    className="text-[10px] text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span className="material-symbols-outlined text-xs">colorize</span>
                    <span>Match Face Color ({faceData.parentColor})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Color Swatches & Material Presets */}
            <div className="flex items-center justify-between border-t border-neutral-800 pt-2 flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-neutral-400 font-medium mr-1">Color:</span>
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setExtrudeColor(swatch.hex)}
                    style={{ backgroundColor: swatch.hex }}
                    className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                      extrudeColor.toLowerCase() === swatch.hex.toLowerCase()
                        ? 'border-white scale-125 shadow-md'
                        : 'border-neutral-700 hover:scale-110'
                    }`}
                    title={swatch.name}
                  />
                ))}
                <input
                  type="color"
                  value={extrudeColor}
                  onChange={(e) => setExtrudeColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 ml-1"
                  title="Custom Color"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-neutral-400 font-medium mr-1">Material:</span>
                {MATERIAL_PRESETS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setExtrudePreset(m.id);
                      setExtrudeRoughness(m.roughness);
                      setExtrudeMetalness(m.metalness);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                      extrudePreset === m.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
