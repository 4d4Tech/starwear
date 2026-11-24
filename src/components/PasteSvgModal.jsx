/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import {
  MATERIAL_PRESETS,
  COLOR_SWATCHES,
  createGeometryFromSvgPath
} from '../utils/geometryHelper';

export const SAMPLE_SVG_PRESETS = [
  {
    id: 'star',
    name: '5-Point Star',
    icon: 'star',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="#fbbf24"/>\n</svg>`
  },
  {
    id: 'heart',
    name: 'Heart',
    icon: 'favorite',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <path d="M50 88 C20 60 5 40 5 25 A20 20 0 0 1 45 15 L50 20 L55 15 A20 20 0 0 1 95 25 C95 40 80 60 50 88 Z" fill="#f43f5e"/>\n</svg>`
  },
  {
    id: 'bolt',
    name: 'Lightning Bolt',
    icon: 'bolt',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="55,5 15,55 45,55 35,95 85,45 55,45" fill="#f59e0b"/>\n</svg>`
  },
  {
    id: 'shield',
    name: 'Shield Badge',
    icon: 'security',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <path d="M50 5 L85 20 C85 60 50 95 50 95 C50 95 15 60 15 20 Z" fill="#38bdf8"/>\n</svg>`
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: 'diamond',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="50,5 92,35 50,95 8,35" fill="#a855f7"/>\n</svg>`
  },
  {
    id: 'crown',
    name: 'Royal Crown',
    icon: 'crown',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <polygon points="10,80 90,80 85,30 65,55 50,20 35,55 15,30" fill="#eab308"/>\n</svg>`
  },
  {
    id: 'moon',
    name: 'Crescent Moon',
    icon: 'bedtime',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <path d="M40 10 A40 40 0 1 0 90 60 A32 32 0 1 1 40 10 Z" fill="#6366f1"/>\n</svg>`
  },
  {
    id: 'gear',
    name: 'Mechanical Gear',
    icon: 'settings',
    code: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <path d="M45 5 L55 5 L57 20 L66 23 L76 13 L83 20 L73 30 L76 39 L91 41 L91 51 L76 53 L73 62 L83 72 L76 79 L66 69 L57 72 L55 87 L45 87 L43 72 L34 69 L24 79 L17 72 L27 62 L24 53 L9 51 L9 41 L24 39 L27 30 L17 20 L24 13 L34 23 L43 20 Z M50 35 A15 15 0 1 0 50 65 A15 15 0 1 0 50 35 Z" fill="#64748b"/>\n</svg>`
  }
];

export default function PasteSvgModal({
  isOpen = false,
  onClose,
  onAddShape,
  appInstance,
  initialSvgCode = '',
  initialColor = '#38bdf8'
}) {
  const [svgCode, setSvgCode] = useState(initialSvgCode || SAMPLE_SVG_PRESETS[0].code);
  const [shapeName, setShapeName] = useState('SVG Shape');
  const [extrudeDepth, setExtrudeDepth] = useState(0.18);
  const [targetSize, setTargetSize] = useState(1.0);
  const [bevelEnabled, setBevelEnabled] = useState(true);
  const [bevelThickness, setBevelThickness] = useState(0.02);
  const [bevelSize, setBevelSize] = useState(0.015);
  const [curveSegments, setCurveSegments] = useState(24);
  const [invertY, setInvertY] = useState(true);

  // Material & Appearance
  const [materialPreset, setMaterialPreset] = useState('standard');
  const [selectedColor, setSelectedColor] = useState(initialColor || '#38bdf8');
  const [roughness, setRoughness] = useState(0.35);
  const [metalness, setMetalness] = useState(0.15);
  const [isWireframe, setIsWireframe] = useState(false);
  const [isFlatShading, setIsFlatShading] = useState(false);

  // Validation State
  const [validationInfo, setValidationInfo] = useState({ isValid: false, pathCount: 0, error: null });
  const [copyFeedback, setCopyFeedback] = useState(false);

  // 3D Canvas Reference
  const previewCanvasRef = useRef(null);
  const orbitStateRef = useRef({
    isOrbiting: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.4,
    pitch: 0.35,
    dist: 2.2,
    autoRotate: true
  });

  // Sync initial code if prop changes
  useEffect(() => {
    if (initialSvgCode && initialSvgCode.trim()) {
      setSvgCode(initialSvgCode);
    }
  }, [initialSvgCode]);

  // Validate SVG on Code Change
  useEffect(() => {
    const raw = (svgCode || '').trim();
    if (!raw) {
      setValidationInfo({ isValid: false, pathCount: 0, error: 'SVG code is empty.' });
      return;
    }

    try {
      let clean = raw;
      const svgTagIdx = clean.toLowerCase().indexOf('<svg');
      if (svgTagIdx !== -1) {
        clean = clean.slice(svgTagIdx);
        const closeIdx = clean.toLowerCase().lastIndexOf('</svg>');
        if (closeIdx !== -1) {
          clean = clean.slice(0, closeIdx + 6);
        }
      }
      let xml = clean;
      if (!clean.toLowerCase().startsWith('<svg')) {
        if (clean.startsWith('<')) {
          xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${clean}</svg>`;
        } else {
          xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="${clean}" /></svg>`;
        }
      }

      const loader = new SVGLoader();
      const svgData = loader.parse(xml);
      if (!svgData || !svgData.paths || svgData.paths.length === 0) {
        setValidationInfo({ isValid: false, pathCount: 0, error: 'No vector paths or shapes found in code.' });
        return;
      }

      let totalShapes = 0;
      svgData.paths.forEach((p) => {
        const sh = SVGLoader.createShapes(p);
        if (sh && sh.length > 0) totalShapes += sh.length;
      });

      if (totalShapes === 0) {
        // Check subpaths
        let subCount = 0;
        svgData.paths.forEach((p) => {
          if (p.subPaths && p.subPaths.length > 0) subCount += p.subPaths.length;
        });
        if (subCount > 0) {
          totalShapes = subCount;
        }
      }

      if (totalShapes === 0) {
        setValidationInfo({ isValid: false, pathCount: 0, error: 'Could not resolve closed contours or shapes.' });
      } else {
        setValidationInfo({
          isValid: true,
          pathCount: svgData.paths.length,
          shapeCount: totalShapes,
          error: null
        });
      }
    } catch (err) {
      setValidationInfo({ isValid: false, pathCount: 0, error: err.message || 'SVG parse error.' });
    }
  }, [svgCode]);

  // Handle Material Preset Switch
  const handleSelectMaterialPreset = (presetId) => {
    setMaterialPreset(presetId);
    const p = MATERIAL_PRESETS.find((m) => m.id === presetId);
    if (p) {
      setRoughness(p.roughness);
      setMetalness(p.metalness);
    }
  };

  // Handle Paste from Clipboard Action
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setSvgCode(text.trim());
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 2000);
        } else {
          alert('Clipboard is empty or contains non-text content.');
        }
      } else {
        alert('Clipboard access not supported in this browser. Please paste using Ctrl+V or Cmd+V directly in the code box.');
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
      alert('Could not access clipboard. Please paste directly using Ctrl+V / Cmd+V in the textarea.');
    }
  };

  // Live 3D WebGL Viewport Renderer Effect
  useEffect(() => {
    if (!isOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let renderer = null;
    let animId = null;
    let currentMesh = null;

    try {
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 260;

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);

      // Environment & Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const mainDirLight = new THREE.DirectionalLight(0xffffff, 2.2);
      mainDirLight.position.set(3, 5, 4);
      mainDirLight.castShadow = true;
      scene.add(mainDirLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      rimLight.position.set(-4, -2, -3);
      scene.add(rimLight);

      const fillLight = new THREE.DirectionalLight(0xa855f7, 0.9);
      fillLight.position.set(0, -4, 3);
      scene.add(fillLight);

      // Grid Backdrop
      const grid = new THREE.GridHelper(3, 12, 0x334155, 0x1e293b);
      grid.position.y = -0.7;
      scene.add(grid);

      // Construct Extruded Mesh from SVG
      const geom = createGeometryFromSvgPath(svgCode, {
        depth: extrudeDepth,
        targetSize: targetSize,
        bevelEnabled: bevelEnabled,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        curveSegments: curveSegments,
        invertY: invertY,
        autoScale: true
      }, THREE);

      if (geom) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(selectedColor),
          roughness,
          metalness,
          wireframe: isWireframe,
          flatShading: isFlatShading,
          side: THREE.DoubleSide
        });

        currentMesh = new THREE.Mesh(geom, mat);
        currentMesh.castShadow = true;
        currentMesh.receiveShadow = true;
        scene.add(currentMesh);
      }

      const st = orbitStateRef.current;
      const updateCamera = () => {
        if (st.autoRotate && !st.isOrbiting) {
          st.yaw += 0.006;
        }
        const x = st.dist * Math.sin(st.yaw) * Math.cos(st.pitch);
        const y = st.dist * Math.sin(st.pitch);
        const z = st.dist * Math.cos(st.yaw) * Math.cos(st.pitch);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
      };

      const renderLoop = () => {
        updateCamera();
        renderer.render(scene, camera);
        animId = requestAnimationFrame(renderLoop);
      };
      renderLoop();

      // Orbit interaction listeners
      const onPointerDown = (e) => {
        st.isOrbiting = true;
        st.autoRotate = false;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
      };

      const onPointerMove = (e) => {
        if (!st.isOrbiting) return;
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        st.yaw -= dx * 0.01;
        st.pitch = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.44, st.pitch + dy * 0.01));
      };

      const onPointerUp = () => {
        st.isOrbiting = false;
      };

      const onWheel = (e) => {
        e.preventDefault();
        st.dist = Math.max(0.6, Math.min(6.0, st.dist + (e.deltaY > 0 ? 0.15 : -0.15)));
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      return () => {
        if (animId) cancelAnimationFrame(animId);
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);

        if (currentMesh) {
          if (currentMesh.geometry) currentMesh.geometry.dispose();
          if (currentMesh.material) currentMesh.material.dispose();
        }
        renderer.dispose();
      };
    } catch (err) {
      console.warn('[PasteSvgModal] 3D preview render error:', err);
    }
  }, [
    isOpen,
    svgCode,
    extrudeDepth,
    targetSize,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    curveSegments,
    invertY,
    selectedColor,
    roughness,
    metalness,
    isWireframe,
    isFlatShading
  ]);

  if (!isOpen) return null;

  // Handle Commit to Scene
  const handleAddShapeToScene = () => {
    if (!validationInfo.isValid) return;

    const payload = {
      type: 'svg',
      name: shapeName.trim() || 'SVG Shape',
      params: {
        svg: svgCode.trim(),
        svgCode: svgCode.trim(),
        svgPath: svgCode.trim(),
        depth: Number(extrudeDepth),
        targetSize: Number(targetSize),
        autoScale: true,
        bevelEnabled: Boolean(bevelEnabled),
        bevelThickness: Number(bevelThickness),
        bevelSize: Number(bevelSize),
        bevelSegments: 3,
        curveSegments: Number(curveSegments),
        invertY: Boolean(invertY)
      },
      svg: svgCode.trim(),
      svgCode: svgCode.trim(),
      svgPath: svgCode.trim(),
      color: selectedColor,
      preset: materialPreset,
      roughness: Number(roughness),
      metalness: Number(metalness),
      wireframe: Boolean(isWireframe),
      flatShading: Boolean(isFlatShading)
    };

    if (typeof onAddShape === 'function') {
      onAddShape(payload);
      onClose();
    } else if (appInstance && typeof appInstance.addPrimitiveGeometry === 'function') {
      appInstance.addPrimitiveGeometry('svg', payload);
      onClose();
    } else {
      console.error('Neither onAddShape nor appInstance.addPrimitiveGeometry is available');
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-slate-100 font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold">
              <span className="material-symbols-outlined text-2xl">code_blocks</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white">
                  Paste SVG to 3D Shape
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono px-2 py-0.5 rounded-full font-bold">
                  VECTOR SYNTHESIZER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste any 2D SVG markup or vector path to extrude into an interactive 3D physical mesh with custom depth, bevels & materials.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Quick Sample Presets Bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-purple-400">auto_awesome</span>
            <span>Sample Presets:</span>
          </span>
          {SAMPLE_SVG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSvgCode(preset.code);
                setShapeName(`SVG ${preset.name}`);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-purple-400">{preset.icon}</span>
              <span>{preset.name}</span>
            </button>
          ))}
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                copyFeedback
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border-purple-500/40 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copyFeedback ? 'check' : 'content_paste'}
              </span>
              <span>{copyFeedback ? 'Pasted!' : 'Paste from Clipboard'}</span>
            </button>
          </div>
        </div>

        {/* Main Grid: Code Input & 2D Preview (Left 6 Cols) | 3D Preview & Tuning (Right 6 Cols) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 studio-scroll">
          
          {/* Left: SVG Code Textarea & 2D Preview */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            
            {/* Code Input Box */}
            <div className="flex flex-col space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-purple-400">code</span>
                  <span>SVG Vector Code / Path</span>
                </label>
                <div className="flex items-center gap-2">
                  {validationInfo.isValid ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      <span>Valid ({validationInfo.shapeCount} Shape{validationInfo.shapeCount > 1 ? 's' : ''})</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      <span>Invalid SVG</span>
                    </span>
                  )}
                </div>
              </div>

              <textarea
                value={svgCode}
                onChange={(e) => setSvgCode(e.target.value)}
                placeholder="Paste raw SVG markup here... e.g. <svg ...><path d='...' /></svg> or just <path d='...' /> or plain path coordinates"
                className="w-full h-48 sm:h-56 p-3 bg-slate-950/90 border border-slate-700/80 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none transition-all leading-relaxed"
                spellCheck={false}
              />

              {validationInfo.error && (
                <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0">error</span>
                  <span className="truncate">{validationInfo.error}</span>
                </div>
              )}
            </div>

            {/* 2D Silhouette Preview Panel */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-sky-400">visibility</span>
                  <span>2D Silhouette Preview</span>
                </span>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invertY}
                    onChange={(e) => setInvertY(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Invert Y (Standard SVG)</span>
                </label>
              </div>

              <div className="w-full h-32 sm:h-36 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-center p-3 overflow-hidden relative">
                {/* Subtle Grid Backdrop */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}
                />
                {validationInfo.isValid ? (
                  <div
                    className="max-w-full max-h-full flex items-center justify-center relative z-10 transition-transform"
                    style={{ transform: invertY ? 'none' : 'scaleY(-1)' }}
                    dangerouslySetInnerHTML={{ __html: svgCode }}
                  />
                ) : (
                  <div className="text-center text-slate-500 text-xs">
                    <span className="material-symbols-outlined text-2xl mb-1 block opacity-40">broken_image</span>
                    <span>No preview available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shape Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                3D Object Name
              </label>
              <input
                type="text"
                value={shapeName}
                onChange={(e) => setShapeName(e.target.value)}
                placeholder="SVG Shape Name"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

          </div>

          {/* Right: 3D Live WebGL Interactive Preview & Tuning Controls */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            
            {/* 3D WebGL Viewport Container */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-400">view_in_ar</span>
                  <span>Live 3D Extrusion Viewport</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Drag to rotate • Wheel to zoom
                </span>
              </div>

              <div className="w-full h-48 sm:h-56 rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-700/80 relative overflow-hidden shadow-inner group">
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full cursor-grab active:cursor-grabbing block"
                />
                
                {/* Viewport Overlay Badge */}
                <div className="absolute top-2 left-2 pointer-events-none">
                  <span className="text-[10px] bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-sky-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    Three.js WebGL PBR
                  </span>
                </div>
              </div>
            </div>

            {/* Geometry Extrusion Sliders */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <span className="material-symbols-outlined text-sm text-purple-400">tune</span>
                <span>3D Extrusion Parameters</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Extrusion Depth */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Depth:</span>
                    <span className="font-mono text-purple-300 font-bold">{extrudeDepth.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="1.5"
                    step="0.02"
                    value={extrudeDepth}
                    onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Target Scale */}
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Scale / Fit:</span>
                    <span className="font-mono text-purple-300 font-bold">{targetSize.toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="4.0"
                    step="0.1"
                    value={targetSize}
                    onChange={(e) => setTargetSize(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Bevel Settings */}
              <div className="pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-200 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bevelEnabled}
                      onChange={(e) => setBevelEnabled(e.target.checked)}
                      className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Chamfer / Bevel Edges</span>
                  </label>
                  {bevelEnabled && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Smooth radius: {(bevelSize * 100).toFixed(1)}cm
                    </span>
                  )}
                </div>

                {bevelEnabled && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Bevel Thickness:</span>
                        <span className="font-mono text-slate-300">{bevelThickness.toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.005"
                        max="0.08"
                        step="0.005"
                        value={bevelThickness}
                        onChange={(e) => setBevelThickness(parseFloat(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Bevel Size:</span>
                        <span className="font-mono text-slate-300">{bevelSize.toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.005"
                        max="0.08"
                        step="0.005"
                        value={bevelSize}
                        onChange={(e) => setBevelSize(parseFloat(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Material & Appearance Controls */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <span className="material-symbols-outlined text-sm text-sky-400">palette</span>
                <span>Material & Surface Presets</span>
              </div>

              {/* Material Preset Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MATERIAL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectMaterialPreset(preset.id)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer text-center truncate ${
                      materialPreset === preset.id
                        ? 'bg-purple-600/30 border-purple-500 text-white shadow-xs'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {preset.name.split(' ')[0]}
                  </button>
                ))}
              </div>

              {/* Color Swatches */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
                  title="Custom color picker"
                />
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setSelectedColor(swatch.hex)}
                    style={{ backgroundColor: swatch.hex }}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                      selectedColor.toLowerCase() === swatch.hex.toLowerCase()
                        ? 'ring-2 ring-purple-400 scale-110 border-white'
                        : 'border-slate-700 hover:scale-105'
                    }`}
                    title={swatch.name}
                  />
                ))}
              </div>

              {/* Shading Toggles */}
              <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWireframe}
                    onChange={(e) => setIsWireframe(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Wireframe</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFlatShading}
                    onChange={(e) => setIsFlatShading(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Flat Shading</span>
                </label>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="text-xs text-slate-400 hidden sm:block">
            {validationInfo.isValid ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Ready to extrude into 3D scene</span>
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>Paste valid SVG code to enable adding to scene</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!validationInfo.isValid}
              onClick={handleAddShapeToScene}
              className={`flex-1 sm:flex-none py-2.5 px-6 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                validationInfo.isValid
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:opacity-95 shadow-purple-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Add 3D SVG Shape to Scene</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
