/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  extractMeshTopology,
  buildBufferGeometryFromTopology,
  pokeFace,
  expandVertexToCircle,
  moveVertices,
  extrudeFace,
  insetFace,
  deleteFace,
  deleteVertex,
  recomputeTopologyEdges
} from '../utils/geometryTopologyEngine.js';
import { createPrimitiveThreeGeometry } from '../utils/geometryHelper.js';

export default function EditGeometryModal({
  isOpen = false,
  onClose,
  targetGeometry = null,
  onSaveTopology,
  appInstance = null
}) {
  // Selection Mode: 'vertex' | 'edge' | 'face'
  const [selectMode, setSelectMode] = useState('vertex');
  const [selectedVertices, setSelectedVertices] = useState([]);
  const [selectedEdges, setSelectedEdges] = useState([]);
  const [selectedFaces, setSelectedFaces] = useState([]);

  // Topology state
  const [topology, setTopology] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // View settings
  const [viewAngle, setViewAngle] = useState('perspective'); // 'perspective' | 'top' | 'side' | 'front'
  const [showWireframe, setShowWireframe] = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [showFaces, setShowFaces] = useState(true);
  const [showNormals, setShowNormals] = useState(false);

  // Move / Transform Tools
  const [moveStep, setMoveStep] = useState(0.05);

  // View 4 Feature: "Expand Vertex into Circle / Face" parameters
  const [circleRadius, setCircleRadius] = useState(0.25);
  const [circleSegments, setCircleSegments] = useState(16);
  const [circleHeightOffset, setCircleHeightOffset] = useState(0.0);

  // Face Extrude / Inset parameters
  const [extrudeDistance, setExtrudeDistance] = useState(0.2);
  const [insetAmount, setInsetAmount] = useState(0.15);

  // Status Feedback banner
  const [statusMessage, setStatusMessage] = useState('');

  // 3D Canvas Refs
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animFrameRef = useRef(null);
  const meshRef = useRef(null);
  const wireframeRef = useRef(null);
  const handlesGroupRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredElementRef = useRef({ type: null, index: -1 });

  // Orbit navigation state
  const orbitRef = useRef({
    isOrbiting: false,
    isPanning: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.6,
    pitch: 0.45,
    distance: 2.8,
    target: new THREE.Vector3(0, 0, 0)
  });

  // Push history snapshot
  const pushHistory = useCallback((newTopo, description = '') => {
    if (!newTopo) return;
    const cloned = JSON.parse(JSON.stringify(newTopo));
    setHistory((prev) => {
      const nextHist = prev.slice(0, historyIndex + 1);
      return [...nextHist, cloned];
    });
    setHistoryIndex((prev) => prev + 1);
    setTopology(cloned);
    if (description) {
      setStatusMessage(description);
      setTimeout(() => setStatusMessage(''), 3500);
    }
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const snapshot = JSON.parse(JSON.stringify(history[newIdx]));
      setTopology(snapshot);
      setSelectedVertices([]);
      setSelectedEdges([]);
      setSelectedFaces([]);
      setStatusMessage('Undo last action');
      setTimeout(() => setStatusMessage(''), 2500);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const snapshot = JSON.parse(JSON.stringify(history[newIdx]));
      setTopology(snapshot);
      setSelectedVertices([]);
      setSelectedEdges([]);
      setSelectedFaces([]);
      setStatusMessage('Redo action');
      setTimeout(() => setStatusMessage(''), 2500);
    }
  }, [history, historyIndex]);

  // Initialize Topology from targetGeometry
  useEffect(() => {
    if (!isOpen || !targetGeometry) return;

    let initialTopo = null;
    const existingTopo = targetGeometry.params?.customTopology || targetGeometry.customTopology;

    if (existingTopo && Array.isArray(existingTopo.vertices) && existingTopo.vertices.length > 0) {
      initialTopo = JSON.parse(JSON.stringify(existingTopo));
    } else {
      // Build base primitive Three.js geometry and extract topology
      const geomType = targetGeometry.type || 'box';
      const geomParams = targetGeometry.params || {};
      const baseThreeGeom = createPrimitiveThreeGeometry(geomType, geomParams, THREE);
      if (baseThreeGeom) {
        initialTopo = extractMeshTopology(baseThreeGeom);
        baseThreeGeom.dispose();
      }
    }

    if (initialTopo) {
      setTopology(initialTopo);
      setHistory([JSON.parse(JSON.stringify(initialTopo))]);
      setHistoryIndex(0);
      setSelectedVertices([]);
      setSelectedEdges([]);
      setSelectedFaces([]);
    }
  }, [isOpen, targetGeometry]);

  // Update Camera based on viewAngle preset
  const applyViewPreset = (angle) => {
    setViewAngle(angle);
    const ob = orbitRef.current;
    if (angle === 'top') {
      ob.yaw = 0;
      ob.pitch = Math.PI * 0.499; // Look straight down +Y (View 1 / View 2 / View 4.a)
    } else if (angle === 'side') {
      ob.yaw = Math.PI * 0.5; // Look from the side (View 3 / View 4.b)
      ob.pitch = 0;
    } else if (angle === 'front') {
      ob.yaw = 0;
      ob.pitch = 0;
    } else {
      ob.yaw = 0.6;
      ob.pitch = 0.45;
    }
  };

  // Rebuild 3D WebGL Visualization whenever topology or selection changes
  useEffect(() => {
    if (!isOpen || !topology || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 480;

    let renderer = rendererRef.current;
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
    } else {
      renderer.setSize(width, height, false);
    }

    let scene = sceneRef.current;
    if (!scene) {
      scene = new THREE.Scene();
      sceneRef.current = scene;

      // Lighting
      const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
      dirLight1.position.set(3, 5, 4);
      dirLight1.castShadow = true;
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.8);
      dirLight2.position.set(-3, -2, -3);
      scene.add(dirLight2);

      // Floor grid
      const grid = new THREE.GridHelper(4, 16, 0x334155, 0x1e293b);
      grid.position.y = -0.7;
      scene.add(grid);
    }

    let camera = cameraRef.current;
    if (!camera) {
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
      cameraRef.current = camera;
    } else {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    // Build mesh from topology
    if (meshRef.current) {
      scene.remove(meshRef.current);
      if (meshRef.current.geometry) meshRef.current.geometry.dispose();
      if (meshRef.current.material) meshRef.current.material.dispose();
      meshRef.current = null;
    }
    if (wireframeRef.current) {
      scene.remove(wireframeRef.current);
      if (wireframeRef.current.geometry) wireframeRef.current.geometry.dispose();
      if (wireframeRef.current.material) wireframeRef.current.material.dispose();
      wireframeRef.current = null;
    }
    if (handlesGroupRef.current) {
      scene.remove(handlesGroupRef.current);
      handlesGroupRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      handlesGroupRef.current = null;
    }

    // 1. Shaded Surface Mesh
    const builtGeom = buildBufferGeometryFromTopology(topology, THREE);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(targetGeometry?.color || '#0284c7'),
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    const mainMesh = new THREE.Mesh(builtGeom, surfaceMat);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    scene.add(mainMesh);
    meshRef.current = mainMesh;

    // 2. Wireframe Overlay (Highlighted Edges)
    if (showWireframe) {
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.65
      });
      const wireMesh = new THREE.Mesh(builtGeom.clone(), wireMat);
      scene.add(wireMesh);
      wireframeRef.current = wireMesh;
    }

    // 3. Interactive Handles (Vertices, Edges, Faces)
    const handlesGroup = new THREE.Group();
    handlesGroup.name = 'interactive_handles';

    // A. Vertex Handles (Interactive 3D points)
    if (showVertices) {
      const vertGeom = new THREE.SphereGeometry(0.024, 12, 12);
      topology.vertices.forEach((v, vIdx) => {
        if (v.dissolved) return;
        const isSelected = selectedVertices.includes(vIdx);
        const vertMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0xef4444 : 0x0284c7, // Red if selected (like View 2 & View 4 red vertex!), Blue/Cyan otherwise
          depthTest: false,
          depthWrite: false
        });
        const vSphere = new THREE.Mesh(vertGeom, vertMat);
        vSphere.position.set(v.x, v.y, v.z);
        vSphere.scale.setScalar(isSelected ? 1.6 : 1.0);
        vSphere.userData = { elementType: 'vertex', index: vIdx };
        handlesGroup.add(vSphere);
      });
    }

    // B. Edge Line Handles
    if (selectMode === 'edge') {
      topology.edges.forEach((edge, eIdx) => {
        const pA = topology.vertices[edge.a];
        const pB = topology.vertices[edge.b];
        if (!pA || !pB || pA.dissolved || pB.dissolved) return;

        const isSelected = selectedEdges.includes(eIdx);
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(pA.x, pA.y, pA.z),
          new THREE.Vector3(pB.x, pB.y, pB.z)
        ]);
        const lineMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xf59e0b : 0x38bdf8,
          linewidth: isSelected ? 3 : 1,
          depthTest: false
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.userData = { elementType: 'edge', index: eIdx };
        handlesGroup.add(line);
      });
    }

    // C. Face Center Handles & Normal Indicators
    if (showFaces || selectMode === 'face') {
      topology.faces.forEach((f, fIdx) => {
        const idxs = f.indices;
        if (!idxs || idxs.length < 3) return;

        let cx = 0, cy = 0, cz = 0;
        idxs.forEach((idx) => {
          const v = topology.vertices[idx];
          if (v) { cx += v.x; cy += v.y; cz += v.z; }
        });
        cx /= idxs.length; cy /= idxs.length; cz /= idxs.length;

        const isSelected = selectedFaces.includes(fIdx);

        // Face center marker
        const fCenterGeom = new THREE.BoxGeometry(0.03, 0.03, 0.03);
        const fCenterMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0xa855f7 : 0x06b6d4,
          depthTest: false
        });
        const fCenterMesh = new THREE.Mesh(fCenterGeom, fCenterMat);
        fCenterMesh.position.set(cx, cy, cz);
        fCenterMesh.userData = { elementType: 'face', index: fIdx };
        handlesGroup.add(fCenterMesh);

        // Normal direction indicator
        if (showNormals || isSelected) {
          const v0 = topology.vertices[idxs[0]];
          const v1 = topology.vertices[idxs[1]];
          const v2 = topology.vertices[idxs[2]];
          const fn = (v0 && v1 && v2)
            ? new THREE.Vector3().crossVectors(
                new THREE.Vector3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z),
                new THREE.Vector3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z)
              ).normalize()
            : new THREE.Vector3(0, 1, 0);

          const normalArrow = new THREE.ArrowHelper(fn, new THREE.Vector3(cx, cy, cz), 0.18, isSelected ? 0xa855f7 : 0x06b6d4);
          handlesGroup.add(normalArrow);
        }
      });
    }

    scene.add(handlesGroup);
    handlesGroupRef.current = handlesGroup;

    // Render loop
    const ob = orbitRef.current;
    const render = () => {
      const cx = ob.target.x + ob.distance * Math.sin(ob.yaw) * Math.cos(ob.pitch);
      const cy = ob.target.y + ob.distance * Math.sin(ob.pitch);
      const cz = ob.target.z + ob.distance * Math.cos(ob.yaw) * Math.cos(ob.pitch);

      camera.position.set(cx, cy, cz);
      camera.lookAt(ob.target);
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isOpen,
    topology,
    selectMode,
    selectedVertices,
    selectedEdges,
    selectedFaces,
    showWireframe,
    showVertices,
    showFaces,
    showNormals,
    targetGeometry
  ]);

  // Pointer / Mouse Interactions (Orbit, Pan, Zoom, and Raycast Select)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const ob = orbitRef.current;

    const onPointerDown = (e) => {
      if (e.button === 2 || e.shiftKey) {
        ob.isPanning = true;
      } else {
        ob.isOrbiting = true;
      }
      ob.lastX = e.clientX;
      ob.lastY = e.clientY;
    };

    const onPointerMove = (e) => {
      const dx = e.clientX - ob.lastX;
      const dy = e.clientY - ob.lastY;
      ob.lastX = e.clientX;
      ob.lastY = e.clientY;

      if (ob.isPanning) {
        // Pan target in screen plane
        const panSpeed = 0.003 * (ob.distance / 2);
        ob.target.x -= dx * panSpeed * Math.cos(ob.yaw);
        ob.target.z += dx * panSpeed * Math.sin(ob.yaw);
        ob.target.y += dy * panSpeed;
        return;
      }

      if (ob.isOrbiting) {
        ob.yaw -= dx * 0.008;
        ob.pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, ob.pitch + dy * 0.008));
        return;
      }

      // Hover Raycasting
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (cameraRef.current && handlesGroupRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(handlesGroupRef.current.children, true);
        const match = intersects.find((hit) => hit.object.userData?.elementType === selectMode);
        if (match) {
          hoveredElementRef.current = {
            type: match.object.userData.elementType,
            index: match.object.userData.index
          };
          canvas.style.cursor = 'pointer';
        } else {
          hoveredElementRef.current = { type: null, index: -1 };
          canvas.style.cursor = 'default';
        }
      }
    };

    const onPointerUp = (e) => {
      // Check if this was a click (not a drag)
      const didMove = Math.hypot(e.clientX - ob.lastX, e.clientY - ob.lastY) > 4;
      ob.isOrbiting = false;
      ob.isPanning = false;

      if (!didMove && hoveredElementRef.current.type === selectMode && hoveredElementRef.current.index !== -1) {
        const clickedIdx = hoveredElementRef.current.index;
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;

        if (selectMode === 'vertex') {
          setSelectedVertices((prev) => {
            if (isMulti) {
              return prev.includes(clickedIdx) ? prev.filter((i) => i !== clickedIdx) : [...prev, clickedIdx];
            }
            return prev.includes(clickedIdx) && prev.length === 1 ? [] : [clickedIdx];
          });
        } else if (selectMode === 'edge') {
          setSelectedEdges((prev) => {
            if (isMulti) {
              return prev.includes(clickedIdx) ? prev.filter((i) => i !== clickedIdx) : [...prev, clickedIdx];
            }
            return prev.includes(clickedIdx) && prev.length === 1 ? [] : [clickedIdx];
          });
        } else if (selectMode === 'face') {
          setSelectedFaces((prev) => {
            if (isMulti) {
              return prev.includes(clickedIdx) ? prev.filter((i) => i !== clickedIdx) : [...prev, clickedIdx];
            }
            return prev.includes(clickedIdx) && prev.length === 1 ? [] : [clickedIdx];
          });
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      ob.distance = Math.max(0.4, Math.min(10.0, ob.distance + (e.deltaY > 0 ? 0.2 : -0.2)));
    };

    const onContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [isOpen, selectMode]);

  // Keyboard Shortcuts (1=Vertex, 2=Edge, 3=Face, Ctrl+Z=Undo, Ctrl+Y=Redo)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') setSelectMode('vertex');
      if (e.key === '2') setSelectMode('edge');
      if (e.key === '3') setSelectMode('face');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleUndo, handleRedo]);

  // --------------------------------------------------------------------------
  // TOPOLOGY ACTIONS (View 2, View 3, View 4)
  // --------------------------------------------------------------------------

  // FEATURE 1 (View 2): "Add Vertex to Face" (Poke Face)
  const handleAddVertexToFace = () => {
    if (!topology || topology.faces.length === 0) return;

    let targetFaceIndex = selectedFaces.length > 0 ? selectedFaces[0] : -1;
    if (targetFaceIndex === -1) {
      // Find top face (e.g. normal pointing up +Y as in View 1/View 2) or default to face 0
      targetFaceIndex = topology.faces.findIndex((f) => f.normal && f.normal.y > 0.85);
      if (targetFaceIndex === -1) targetFaceIndex = 0;
    }

    const nextTopo = JSON.parse(JSON.stringify(topology));
    const newVertexIdx = pokeFace(nextTopo, targetFaceIndex);

    if (newVertexIdx !== null) {
      pushHistory(nextTopo, `Added vertex to center of face ${targetFaceIndex} (View 2)`);
      // Automatically switch to vertex mode and select the new center vertex so user can immediately raise it (View 3)!
      setSelectMode('vertex');
      setSelectedVertices([newVertexIdx]);
      setSelectedFaces([]);
      setSelectedEdges([]);
    }
  };

  // FEATURE 2 (View 4: 4.a & 4.b): "Expand Vertex into Circle / Face"
  const handleExpandVertexToCircle = () => {
    if (!topology || selectedVertices.length === 0) {
      alert('Please select a vertex to expand into a circle (View 4).');
      return;
    }

    const targetVertexIdx = selectedVertices[0];
    const nextTopo = JSON.parse(JSON.stringify(topology));

    const result = expandVertexToCircle(nextTopo, targetVertexIdx, {
      radius: Number(circleRadius),
      segments: Number(circleSegments),
      heightOffset: Number(circleHeightOffset)
    });

    if (result) {
      pushHistory(
        nextTopo,
        `Expanded vertex ${targetVertexIdx} into ${circleSegments}-segment circle face (r=${circleRadius}m, View 4)`
      );
      // Select the newly created circle cap face and its vertices
      setSelectedVertices(result.circleVertexIndices);
      setSelectedFaces([result.circleFaceIndex]);
    } else {
      alert('Could not expand vertex to circle. Ensure the selected vertex connects to at least 3 incident faces.');
    }
  };

  // Move Selected Vertices along X, Y, Z or Normal (View 3)
  const handleMoveSelected = (dx = 0, dy = 0, dz = 0) => {
    if (!topology) return;
    const targetVerts = new Set(selectedVertices);

    // If edges are selected, include their vertices
    if (selectMode === 'edge') {
      selectedEdges.forEach((eIdx) => {
        const edge = topology.edges[eIdx];
        if (edge) { targetVerts.add(edge.a); targetVerts.add(edge.b); }
      });
    }

    // If faces are selected, include their vertices
    if (selectMode === 'face') {
      selectedFaces.forEach((fIdx) => {
        const face = topology.faces[fIdx];
        if (face && face.indices) {
          face.indices.forEach((i) => targetVerts.add(i));
        }
      });
    }

    if (targetVerts.size === 0) return;

    const nextTopo = JSON.parse(JSON.stringify(topology));
    moveVertices(nextTopo, Array.from(targetVerts), { x: dx, y: dy, z: dz });
    pushHistory(nextTopo, `Moved ${targetVerts.size} vertices`);
  };

  // Move along Normal (Raise Peak / Lower Peak)
  const handleMoveAlongNormal = (amount) => {
    if (!topology) return;

    // Determine normal vector: from selected face or average vertex normal
    let normal = new THREE.Vector3(0, 1, 0);

    if (selectedFaces.length > 0) {
      const f = topology.faces[selectedFaces[0]];
      if (f && f.indices && f.indices.length >= 3) {
        const v0 = topology.vertices[f.indices[0]];
        const v1 = topology.vertices[f.indices[1]];
        const v2 = topology.vertices[f.indices[2]];
        normal.crossVectors(
          new THREE.Vector3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z),
          new THREE.Vector3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z)
        ).normalize();
      }
    } else if (selectedVertices.length > 0) {
      const vIdx = selectedVertices[0];
      const incidentFaces = topology.faces.filter((f) => f.indices && f.indices.includes(vIdx));
      if (incidentFaces.length > 0) {
        const avg = new THREE.Vector3();
        incidentFaces.forEach((f) => {
          const v0 = topology.vertices[f.indices[0]];
          const v1 = topology.vertices[f.indices[1]];
          const v2 = topology.vertices[f.indices[2]];
          if (v0 && v1 && v2) {
            avg.add(new THREE.Vector3().crossVectors(
              new THREE.Vector3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z),
              new THREE.Vector3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z)
            ).normalize());
          }
        });
        if (avg.lengthSq() > 1e-6) normal.copy(avg.normalize());
      }
    }

    handleMoveSelected(normal.x * amount, normal.y * amount, normal.z * amount);
  };

  // Extrude Face
  const handleExtrudeFace = () => {
    if (!topology || selectedFaces.length === 0) {
      alert('Please select a face to extrude.');
      return;
    }
    const fIdx = selectedFaces[0];
    const nextTopo = JSON.parse(JSON.stringify(topology));
    const newVerts = extrudeFace(nextTopo, fIdx, Number(extrudeDistance), 0);
    if (newVerts) {
      pushHistory(nextTopo, `Extruded face ${fIdx} by ${extrudeDistance}m`);
      setSelectedVertices(newVerts);
    }
  };

  // Inset Face
  const handleInsetFace = () => {
    if (!topology || selectedFaces.length === 0) {
      alert('Please select a face to inset.');
      return;
    }
    const fIdx = selectedFaces[0];
    const nextTopo = JSON.parse(JSON.stringify(topology));
    const newVerts = insetFace(nextTopo, fIdx, Number(insetAmount));
    if (newVerts) {
      pushHistory(nextTopo, `Inset face ${fIdx} by ${(insetAmount * 100).toFixed(0)}%`);
      setSelectedVertices(newVerts);
    }
  };

  // Delete Element
  const handleDeleteSelected = () => {
    if (!topology) return;
    const nextTopo = JSON.parse(JSON.stringify(topology));

    if (selectMode === 'vertex' && selectedVertices.length > 0) {
      selectedVertices.forEach((vIdx) => deleteVertex(nextTopo, vIdx));
      pushHistory(nextTopo, `Deleted ${selectedVertices.length} vertices`);
      setSelectedVertices([]);
    } else if (selectMode === 'face' && selectedFaces.length > 0) {
      selectedFaces.sort((a, b) => b - a).forEach((fIdx) => deleteFace(nextTopo, fIdx));
      pushHistory(nextTopo, `Deleted ${selectedFaces.length} faces`);
      setSelectedFaces([]);
    }
  };

  // Reset to original primitive shape
  const handleResetToPrimitive = () => {
    if (!targetGeometry) return;
    if (window.confirm('Reset this geometry back to its original primitive shape?')) {
      const geomType = targetGeometry.type || 'box';
      const geomParams = targetGeometry.params || {};
      const baseThreeGeom = createPrimitiveThreeGeometry(geomType, geomParams, THREE);
      if (baseThreeGeom) {
        const freshTopo = extractMeshTopology(baseThreeGeom);
        baseThreeGeom.dispose();
        pushHistory(freshTopo, 'Reset geometry to original primitive');
        setSelectedVertices([]);
        setSelectedEdges([]);
        setSelectedFaces([]);
      }
    }
  };

  // Save & Apply Changes to Scene
  const handleApplyToScene = () => {
    if (!topology) return;

    if (typeof onSaveTopology === 'function') {
      onSaveTopology(targetGeometry.id, topology);
    } else if (appInstance && typeof appInstance.updatePrimitiveGeometryTopology === 'function') {
      appInstance.updatePrimitiveGeometryTopology(targetGeometry.id, topology);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Selected item info helpers
  const activeVertex = selectedVertices.length > 0 && topology?.vertices ? topology.vertices[selectedVertices[0]] : null;
  const activeFace = selectedFaces.length > 0 && topology?.faces ? topology.faces[selectedFaces[0]] : null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] bg-neutral-950 border border-teal-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-teal-400 text-2xl">
              shape_line
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Edit Geometry: Vertices, Edges & Faces
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {targetGeometry?.name || 'Mesh'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Interactive topology modeling • Move, add, remove vertices/edges/faces • Subdivide & circle expander
              </p>
            </div>
          </div>

          {/* Counts & History Buttons */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] font-mono text-neutral-300">
              <span className="text-teal-400 font-bold">{topology?.vertices?.length || 0}</span> Verts •{' '}
              <span className="text-amber-400 font-bold">{topology?.edges?.length || 0}</span> Edges •{' '}
              <span className="text-purple-400 font-bold">{topology?.faces?.length || 0}</span> Faces
            </div>

            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-200 transition-colors cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <span className="material-symbols-outlined text-lg">undo</span>
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-200 transition-colors cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <span className="material-symbols-outlined text-lg">redo</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-2"
              title="Close without saving"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-teal-500/90 text-black text-xs font-bold shadow-lg animate-fade-in flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Main Workspace Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

          {/* Left / Center: Interactive 3D Viewport */}
          <div className="flex-1 relative bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 flex flex-col overflow-hidden">

            {/* Viewport Floating Mode & Camera Controls */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
              
              {/* Mode Switcher (1, 2, 3) */}
              <div className="flex items-center bg-neutral-900/90 border border-neutral-700/80 rounded-xl p-1 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setSelectMode('vertex')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectMode === 'vertex'
                      ? 'bg-teal-500 text-black shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Vertex Mode (Key 1): Select & move vertices, expand vertex to circle"
                >
                  <span className="material-symbols-outlined text-sm">radio_button_checked</span>
                  <span>Vertices (1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectMode('edge')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectMode === 'edge'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Edge Mode (Key 2): Select & move edge lines"
                >
                  <span className="material-symbols-outlined text-sm">linear_scale</span>
                  <span>Edges (2)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectMode('face')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectMode === 'face'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Face Mode (Key 3): Select & poke face (View 2), extrude, inset"
                >
                  <span className="material-symbols-outlined text-sm">crop_square</span>
                  <span>Faces (3)</span>
                </button>
              </div>

              {/* View Angles (Matches user diagram View 1/2/4.a Top View & View 3/4.b Side View) */}
              <div className="flex items-center bg-neutral-900/90 border border-neutral-700/80 rounded-xl p-1 shadow-lg backdrop-blur-md text-xs">
                <button
                  type="button"
                  onClick={() => applyViewPreset('top')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    viewAngle === 'top' ? 'bg-neutral-700 text-teal-300 font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Top View: Matches View 1, View 2, and View 4.a"
                >
                  Top View (View 1/2/4.a)
                </button>
                <button
                  type="button"
                  onClick={() => applyViewPreset('side')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    viewAngle === 'side' ? 'bg-neutral-700 text-teal-300 font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Side View: Matches View 3 and View 4.b"
                >
                  Side View (View 3/4.b)
                </button>
                <button
                  type="button"
                  onClick={() => applyViewPreset('perspective')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    viewAngle === 'perspective' ? 'bg-neutral-700 text-teal-300 font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="3D Orbit Perspective"
                >
                  3D Orbit
                </button>
              </div>
            </div>

            {/* Viewport Toggles (Wireframe, Vertices, Normals) */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-700/80 rounded-xl p-1 shadow-lg backdrop-blur-md pointer-events-auto text-xs">
              <button
                type="button"
                onClick={() => setShowWireframe(!showWireframe)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showWireframe ? 'bg-teal-500/20 text-teal-300' : 'text-neutral-400 hover:text-white'
                }`}
                title="Toggle Wireframe"
              >
                <span className="material-symbols-outlined text-base">grid_4x4</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVertices(!showVertices)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showVertices ? 'bg-teal-500/20 text-teal-300' : 'text-neutral-400 hover:text-white'
                }`}
                title="Toggle Vertex Spheres"
              >
                <span className="material-symbols-outlined text-base">grain</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNormals(!showNormals)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showNormals ? 'bg-teal-500/20 text-teal-300' : 'text-neutral-400 hover:text-white'
                }`}
                title="Toggle Face Normals"
              >
                <span className="material-symbols-outlined text-base">arrow_upward_alt</span>
              </button>
            </div>

            {/* Three.js Interactive 3D Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full h-full block touch-none cursor-default"
            />

            {/* Bottom Viewport Hint */}
            <div className="absolute bottom-3 left-4 z-10 pointer-events-none text-[11px] text-neutral-400 flex items-center gap-2 bg-neutral-900/80 px-3 py-1.5 rounded-lg border border-neutral-800 backdrop-blur-sm">
              <span className="material-symbols-outlined text-sm text-teal-400">mouse</span>
              <span>Left Drag: Orbit • Right Drag / Shift+Drag: Pan • Scroll: Zoom • Click elements to select</span>
            </div>
          </div>

          {/* Right Panel: Topological Tools & Inspectors */}
          <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-neutral-800 bg-neutral-900/70 p-4 flex flex-col gap-4 overflow-y-auto max-h-[45vh] md:max-h-full">
            
            {/* 1. SELECTION STATUS CARD */}
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-400">touch_app</span>
                  <span>Active Selection</span>
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-teal-300 font-mono">
                  {selectMode.toUpperCase()} MODE
                </span>
              </div>

              {selectMode === 'vertex' && (
                <div className="text-xs text-neutral-300">
                  {selectedVertices.length === 0 ? (
                    <span className="text-neutral-500 italic">Click any vertex to select it.</span>
                  ) : (
                    <div>
                      <div className="font-semibold text-teal-300 mb-1">
                        Vertex #{selectedVertices[0]} selected {selectedVertices.length > 1 ? `(+${selectedVertices.length - 1} more)` : ''}
                      </div>
                      {activeVertex && (
                        <div className="grid grid-cols-3 gap-1 font-mono text-[11px] bg-neutral-950 p-2 rounded-lg border border-neutral-800 text-center">
                          <div>X: {activeVertex.x.toFixed(3)}</div>
                          <div>Y: {activeVertex.y.toFixed(3)}</div>
                          <div>Z: {activeVertex.z.toFixed(3)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectMode === 'edge' && (
                <div className="text-xs text-neutral-300">
                  {selectedEdges.length === 0 ? (
                    <span className="text-neutral-500 italic">Click an edge line to select.</span>
                  ) : (
                    <div className="font-semibold text-amber-300">
                      Edge #{selectedEdges[0]} selected
                    </div>
                  )}
                </div>
              )}

              {selectMode === 'face' && (
                <div className="text-xs text-neutral-300">
                  {selectedFaces.length === 0 ? (
                    <span className="text-neutral-500 italic">Click a face center marker to select.</span>
                  ) : (
                    <div>
                      <div className="font-semibold text-purple-300 mb-1">
                        Face #{selectedFaces[0]} selected ({activeFace?.indices?.length || 3} vertices)
                      </div>
                      {activeFace?.normal && (
                        <div className="text-[11px] font-mono text-neutral-400 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                          Normal: ({activeFace.normal.x.toFixed(2)}, {activeFace.normal.y.toFixed(2)}, {activeFace.normal.z.toFixed(2)})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. FEATURE 1 (VIEW 2): ADD VERTEX TO FACE (POKE FACE) */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-950/40 via-neutral-900 to-neutral-900 border border-indigo-500/40 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-indigo-400">add_location_alt</span>
                  <span className="text-xs font-bold text-white">Add Vertex to Face (View 2)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  POKE FACE
                </span>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Adds a new vertex at the center of the face, creating 4 triangular faces connecting to all edges (as shown in View 2 of diagram).
              </p>

              <button
                type="button"
                onClick={handleAddVertexToFace}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Add Vertex to Face Center (View 2)</span>
              </button>
            </div>

            {/* 3. FEATURE 2 (VIEW 4): EXPAND VERTEX INTO CIRCLE / FACE */}
            <div className="p-3.5 bg-gradient-to-br from-purple-950/40 via-neutral-900 to-neutral-900 border border-purple-500/40 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-purple-400">change_circle</span>
                  <span className="text-xs font-bold text-white">Expand Vertex into Circle (View 4)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                  4.a & 4.b
                </span>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Expands the selected vertex into a circular face of radius R, connecting perimeter diagonals to corner vertices (View 4.a top & 4.b side).
              </p>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Radius (R):</span>
                    <span className="font-mono text-purple-300">{circleRadius.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.9"
                    step="0.02"
                    value={circleRadius}
                    onChange={(e) => setCircleRadius(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Circle Segments:</span>
                    <span className="font-mono text-purple-300">{circleSegments}</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="32"
                    step="4"
                    value={circleSegments}
                    onChange={(e) => setCircleSegments(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Cap Height Offset:</span>
                    <span className="font-mono text-purple-300">{circleHeightOffset.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.05"
                    value={circleHeightOffset}
                    onChange={(e) => setCircleHeightOffset(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={selectedVertices.length === 0}
                onClick={handleExpandVertexToCircle}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
              >
                <span className="material-symbols-outlined text-sm">radio_button_unchecked</span>
                <span>Expand Selected Vertex into Circle Face</span>
              </button>
            </div>

            {/* 4. MOVE / RAISE VERTEX (VIEW 3) */}
            <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-400">open_with</span>
                  <span>Move & Raise Vertex (View 3)</span>
                </span>
                <span className="text-[10px] text-neutral-400">Step: {moveStep}m</span>
              </div>

              {/* Move Along Normal: Raise Peak / Lower Peak (View 3) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveAlongNormal(moveStep * 2)}
                  className="py-2 px-2.5 bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 text-teal-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Raise selected vertex/face upward along normal (Creates peak shown in View 3)"
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  <span>Raise Peak (+Normal)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveAlongNormal(-moveStep * 2)}
                  className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Lower selected vertex/face inward along normal"
                >
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  <span>Lower (-Normal)</span>
                </button>
              </div>

              {/* Axis Micro-steps */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Translate X:</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleMoveSelected(-moveStep, 0, 0)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">-{moveStep}</button>
                    <button type="button" onClick={() => handleMoveSelected(moveStep, 0, 0)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">+{moveStep}</button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Translate Y:</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleMoveSelected(0, -moveStep, 0)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">-{moveStep}</button>
                    <button type="button" onClick={() => handleMoveSelected(0, moveStep, 0)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">+{moveStep}</button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Translate Z:</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleMoveSelected(0, 0, -moveStep)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">-{moveStep}</button>
                    <button type="button" onClick={() => handleMoveSelected(0, 0, moveStep)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer font-mono">+{moveStep}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. FACE MODELING TOOLS (Extrude, Inset, Delete) */}
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-purple-400">construction</span>
                <span>Modeling Actions</span>
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  disabled={selectedFaces.length === 0}
                  onClick={handleExtrudeFace}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  title="Extrude selected face"
                >
                  <span className="material-symbols-outlined text-sm">unfold_more</span>
                  <span>Extrude Face</span>
                </button>
                <button
                  type="button"
                  disabled={selectedFaces.length === 0}
                  onClick={handleInsetFace}
                  className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  title="Inset selected face"
                >
                  <span className="material-symbols-outlined text-sm">fit_screen</span>
                  <span>Inset Face</span>
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                  title="Delete selected element"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Element</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToPrimitive}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                  title="Reset to initial unedited primitive"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Reset Primitive</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyToScene}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:opacity-95 text-black font-bold text-xs shadow-lg shadow-teal-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Apply & Save Geometry to Scene</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
