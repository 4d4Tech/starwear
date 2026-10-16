/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MATERIAL_PRESETS, COLOR_SWATCHES, createPrimitiveMesh } from '../utils/geometryHelper';
import { INFLATION_PROFILES } from '../utils/inflationEngine';

// Presets with Photoshop-style anchor points and bezier handles
const VECTOR_PRESETS = [
  {
    id: 'star',
    name: '5-Point Star',
    icon: 'star',
    createPoints: () => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 120 : 50;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        pts.push({
          id: `pt_${i}`,
          x: Math.round(r * Math.cos(a)),
          y: Math.round(r * Math.sin(a)),
          handleIn: null,
          handleOut: null,
          type: 'corner'
        });
      }
      return pts;
    }
  },
  {
    id: 'heart',
    name: 'Bezier Heart',
    icon: 'favorite',
    createPoints: () => [
      { id: 'h0', x: 0, y: 110, handleIn: { x: -35, y: -25 }, handleOut: { x: 35, y: -25 }, type: 'smooth' },
      { id: 'h1', x: 110, y: -20, handleIn: { x: 0, y: 55 }, handleOut: { x: 0, y: -55 }, type: 'smooth' },
      { id: 'h2', x: 0, y: -50, handleIn: { x: 45, y: 0 }, handleOut: { x: -45, y: 0 }, type: 'smooth' },
      { id: 'h3', x: -110, y: -20, handleIn: { x: 0, y: -55 }, handleOut: { x: 0, y: 55 }, type: 'smooth' }
    ]
  },
  {
    id: 'shield',
    name: 'Heraldic Shield',
    icon: 'shield',
    createPoints: () => [
      { id: 's0', x: -95, y: -95, handleIn: null, handleOut: { x: 45, y: 10 }, type: 'smooth' },
      { id: 's1', x: 0, y: -80, handleIn: { x: -45, y: -10 }, handleOut: { x: 45, y: -10 }, type: 'smooth' },
      { id: 's2', x: 95, y: -95, handleIn: { x: -45, y: 10 }, handleOut: null, type: 'corner' },
      { id: 's3', x: 90, y: 10, handleIn: null, handleOut: { x: -10, y: 65 }, type: 'smooth' },
      { id: 's4', x: 0, y: 120, handleIn: { x: 45, y: -20 }, handleOut: { x: -45, y: -20 }, type: 'smooth' },
      { id: 's5', x: -90, y: 10, handleIn: { x: 10, y: 65 }, handleOut: null, type: 'corner' }
    ]
  },
  {
    id: 'lightning',
    name: 'Lightning Bolt',
    icon: 'bolt',
    createPoints: () => [
      { id: 'l0', x: 0, y: -125, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l1', x: 65, y: -125, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l2', x: 15, y: -20, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l3', x: 75, y: -20, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l4', x: -65, y: 135, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l5', x: -20, y: 20, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'l6', x: -75, y: 20, handleIn: null, handleOut: null, type: 'corner' }
    ]
  },
  {
    id: 'diamond',
    name: 'Faceted Diamond',
    icon: 'diamond',
    createPoints: () => [
      { id: 'd0', x: 0, y: -115, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'd1', x: 95, y: -45, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'd2', x: 50, y: 95, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'd3', x: -50, y: 95, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'd4', x: -95, y: -45, handleIn: null, handleOut: null, type: 'corner' }
    ]
  },
  {
    id: 'crescent',
    name: 'Crescent Moon',
    icon: 'bedtime',
    createPoints: () => [
      { id: 'c0', x: 0, y: -120, handleIn: { x: -60, y: 40 }, handleOut: { x: 70, y: 40 }, type: 'smooth' },
      { id: 'c1', x: 95, y: 0, handleIn: { x: 0, y: -65 }, handleOut: { x: 0, y: 65 }, type: 'smooth' },
      { id: 'c2', x: 0, y: 120, handleIn: { x: 70, y: -40 }, handleOut: { x: -60, y: -40 }, type: 'smooth' },
      { id: 'c3', x: 35, y: 0, handleIn: { x: 0, y: 45 }, handleOut: { x: 0, y: -45 }, type: 'smooth' }
    ]
  },
  {
    id: 'hexagon',
    name: 'Hexagon Badge',
    icon: 'hexagon',
    createPoints: () => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        pts.push({
          id: `hex_${i}`,
          x: Math.round(110 * Math.cos(a)),
          y: Math.round(110 * Math.sin(a)),
          handleIn: null,
          handleOut: null,
          type: 'corner'
        });
      }
      return pts;
    }
  },
  {
    id: 'arrow',
    name: 'Directional Arrow',
    icon: 'arrow_upward_alt',
    createPoints: () => [
      { id: 'a0', x: 0, y: -125, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a1', x: 90, y: -25, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a2', x: 40, y: -25, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a3', x: 40, y: 120, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a4', x: -40, y: 120, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a5', x: -40, y: -25, handleIn: null, handleOut: null, type: 'corner' },
      { id: 'a6', x: -90, y: -25, handleIn: null, handleOut: null, type: 'corner' }
    ]
  }
];

// Sample silhouettes for quick image-tracing testing
const SAMPLE_TRACING_IMAGES = [
  {
    id: 'sneaker',
    name: 'Sneaker Shoe Outline',
    icon: 'skateboarding',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><path d="M40 180 C60 180 80 170 120 170 C180 170 200 150 240 110 C270 80 300 70 330 90 C350 100 370 120 370 150 C370 180 340 190 310 190 C220 190 100 195 40 195 Z" fill="rgba(56,189,248,0.12)" stroke="%2338bdf8" stroke-width="4"/><path d="M120 170 L145 120 L210 120 L240 150 M250 85 L290 65 L320 85" fill="none" stroke="%2338bdf8" stroke-width="2" stroke-dasharray="4,4"/></svg>`
  },
  {
    id: 'guitar',
    name: 'Acoustic Guitar',
    icon: 'music_note',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><path d="M150 40 L160 40 L160 140 C175 150 195 170 195 200 C195 220 185 235 170 245 C190 265 205 295 205 330 C205 370 180 385 150 385 C120 385 95 370 95 330 C95 295 110 265 130 245 C115 235 105 220 105 200 C105 170 125 150 140 140 L140 40 Z" fill="rgba(168,85,247,0.12)" stroke="%23c084fc" stroke-width="4"/><circle cx="150" cy="210" r="22" fill="none" stroke="%23c084fc" stroke-width="3"/></svg>`
  },
  {
    id: 'crest',
    name: 'Heraldic Crest',
    icon: 'shield',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="360" viewBox="0 0 320 360"><path d="M40 50 C100 45 130 25 160 15 C190 25 220 45 280 50 C290 170 270 260 160 345 C50 260 30 170 40 50 Z" fill="rgba(245,158,11,0.12)" stroke="%23fbbf24" stroke-width="4"/><path d="M70 75 C110 70 135 55 160 45 C185 55 210 70 250 75 C255 165 240 235 160 300 C80 235 65 165 70 75 Z" fill="none" stroke="%23fbbf24" stroke-width="2" stroke-dasharray="3,3"/></svg>`
  }
];

export default function VectorPenModal({
  isOpen = false,
  onClose,
  onExtrude,
  initialPoints = null,
  initialParams = null,
  initialColor = '#38bdf8',
  initialName = 'Vector Pen Shape',
  initialMode = 'extrude'
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Vector Points state
  const [points, setPoints] = useState(() => {
    if (Array.isArray(initialPoints) && initialPoints.length >= 3) {
      return initialPoints;
    }
    return VECTOR_PRESETS[0].createPoints();
  });

  const [isClosed, setIsClosed] = useState(() => {
    if (Array.isArray(initialPoints) && initialPoints.length >= 3) return true;
    return true; // default template is closed
  });

  const [selectedPointIdx, setSelectedPointIdx] = useState(null);
  const [hoverStartPoint, setHoverStartPoint] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize] = useState(15);
  const [history, setHistory] = useState([]);

  // Background Image Tracing state
  const [bgImage, setBgImage] = useState(null); // { img, url, name }
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [bgScale, setBgScale] = useState(1.0);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const [bgVisible, setBgVisible] = useState(true);
  const [showBgControls, setShowBgControls] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Active keyboard modifier states (for Photoshop mode indication & cursor)
  const [isAltDown, setIsAltDown] = useState(false);
  const [isCmdCtrlDown, setIsCmdCtrlDown] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // Viewport Zoom & Pan state for micro-precision editing
  const [zoom, setZoom] = useState(1.0); // 0.25 to 8.0 (25% to 800%)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'hand'
  const [isPanningState, setIsPanningState] = useState(false); // for cursor feedback

  // 3D Generation Mode: 'extrude' (beveled 2.5D extrusion) or 'inflate' (volumetric Poisson/distance-field curvature)
  const [creationMode, setCreationMode] = useState(() => {
    if (initialMode === 'inflate') return 'inflate';
    if (initialParams?.inflateEnabled) return 'inflate';
    return 'extrude';
  });

  // Extrusion & Material Settings
  const [shapeName, setShapeName] = useState(initialName);
  const [extrudeDepth, setExtrudeDepth] = useState(initialParams?.depth ?? 0.25);
  const [bevelEnabled, setBevelEnabled] = useState(initialParams?.bevelEnabled !== false);
  const [bevelThickness, setBevelThickness] = useState(initialParams?.bevelThickness ?? 0.03);
  const [bevelSize, setBevelSize] = useState(initialParams?.bevelSize ?? 0.02);
  const [bevelSegments, setBevelSegments] = useState(initialParams?.bevelSegments ?? 3);
  const [curveSegments, setCurveSegments] = useState(initialParams?.curveSegments ?? 24);

  // Curvature & Volumetric Inflation Settings (Monster Mash / Distance-Field Poisson)
  const [inflateDepth, setInflateDepth] = useState(initialParams?.depth ?? 0.35);
  const [curvatureProfile, setCurvatureProfile] = useState(
    initialParams?.curvatureProfile || initialParams?.profile || 'elliptic'
  );
  const [inflateSymmetric, setInflateSymmetric] = useState(initialParams?.symmetric !== false);
  const [inflateSmoothPasses, setInflateSmoothPasses] = useState(initialParams?.smoothPasses ?? 2);
  const [inflateResolution, setInflateResolution] = useState(initialParams?.resolution ?? 24);
  const [inflateRimDepth, setInflateRimDepth] = useState(initialParams?.rimDepth ?? 0.0);
  const [connectEdges, setConnectEdges] = useState(initialParams?.connectEdges !== false);

  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [materialPreset, setMaterialPreset] = useState('standard');
  const [isWireframe, setIsWireframe] = useState(false);
  const [isFlatShading, setIsFlatShading] = useState(false);
  const [isGlow, setIsGlow] = useState(false);

  // Interaction tracking refs
  const dragRef = useRef({
    isDrawing: false,
    dragPointIdx: null,
    dragHandle: null, // { pointIdx, type: 'in' | 'out', breakSymmetry?: boolean }
    downPos: { x: 0, y: 0 },
    hasMoved: false,
    isDirectMoving: false, // holding Cmd/Ctrl to move anchor
    isAltCurvePull: false,  // holding Option/Alt to pull bezier curve
    isPanning: false,
    panStart: { x: 0, y: 0 },
    initialPan: { x: 0, y: 0 }
  });

  // Helper to load tracing image from data URL or remote URL
  const loadTracingImageUrl = useCallback((url, name = 'Reference Image') => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBgImage({ img, url, name });
      setBgVisible(true);
      setShowBgControls(true);
    };
    img.src = url;
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadTracingImageUrl(ev.target.result, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Synchronize state when modal opens or initial props change
  useEffect(() => {
    if (!isOpen) return;
    if (Array.isArray(initialPoints) && initialPoints.length >= 3) {
      setPoints(initialPoints);
      setIsClosed(true);
    } else if (!initialPoints) {
      setPoints(VECTOR_PRESETS[0].createPoints());
      setIsClosed(true);
    }
    if (initialName) setShapeName(initialName);
    if (initialColor) setSelectedColor(initialColor);
    if (initialMode === 'inflate' || initialParams?.inflateEnabled) {
      setCreationMode('inflate');
    } else if (initialMode === 'extrude') {
      setCreationMode('extrude');
    }
    if (initialParams) {
      if (initialParams.depth !== undefined) {
        setExtrudeDepth(Number(initialParams.depth));
        setInflateDepth(Number(initialParams.depth));
      }
      if (initialParams.bevelEnabled !== undefined) setBevelEnabled(Boolean(initialParams.bevelEnabled));
      if (initialParams.bevelThickness !== undefined) setBevelThickness(Number(initialParams.bevelThickness));
      if (initialParams.bevelSize !== undefined) setBevelSize(Number(initialParams.bevelSize));
      if (initialParams.bevelSegments !== undefined) setBevelSegments(Number(initialParams.bevelSegments));
      if (initialParams.curveSegments !== undefined) setCurveSegments(Number(initialParams.curveSegments));

      if (initialParams.curvatureProfile || initialParams.profile) {
        setCurvatureProfile(initialParams.curvatureProfile || initialParams.profile);
      }
      if (initialParams.symmetric !== undefined) setInflateSymmetric(Boolean(initialParams.symmetric));
      if (initialParams.smoothPasses !== undefined) setInflateSmoothPasses(Number(initialParams.smoothPasses));
      if (initialParams.resolution !== undefined) setInflateResolution(Number(initialParams.resolution));
      if (initialParams.rimDepth !== undefined) setInflateRimDepth(Number(initialParams.rimDepth));
      if (initialParams.connectEdges !== undefined) setConnectEdges(Boolean(initialParams.connectEdges));
    }
    setSelectedPointIdx(null);
    setHistory([]);
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActiveTool('pen');
  }, [isOpen, initialPoints, initialParams, initialColor, initialName, initialMode]);

  // Save history state
  const pushHistory = useCallback((newPoints, newClosed = isClosed) => {
    setHistory((prev) => [...prev.slice(-15), { points: JSON.parse(JSON.stringify(newPoints)), isClosed: newClosed }]);
  }, [isClosed]);

  // Handle Undo
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setPoints(last.points);
    setIsClosed(last.isClosed);
    setSelectedPointIdx(null);
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    pushHistory(points, isClosed);
    setPoints([]);
    setIsClosed(false);
    setSelectedPointIdx(null);
  };

  // Load Preset
  const handleLoadPreset = (preset) => {
    pushHistory(points, isClosed);
    const newPts = preset.createPoints();
    setPoints(newPts);
    setIsClosed(true);
    setSelectedPointIdx(null);
    setShapeName(preset.name);
  };

  // Convert Point between smooth curve and sharp corner
  const handleTogglePointType = (idx) => {
    if (idx === null || !points[idx]) return;
    pushHistory(points, isClosed);
    setPoints((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        if (p.handleIn || p.handleOut) {
          // Switch to sharp corner
          return { ...p, handleIn: null, handleOut: null, type: 'corner' };
        } else {
          // Switch to smooth bezier handles
          return {
            ...p,
            handleIn: { x: -35, y: 0 },
            handleOut: { x: 35, y: 0 },
            type: 'smooth'
          };
        }
      })
    );
  };

  // Delete selected point
  const handleDeletePoint = (idx) => {
    if (idx === null || !points[idx]) return;
    pushHistory(points, isClosed);
    const nextPts = points.filter((_, i) => i !== idx);
    setPoints(nextPts);
    if (nextPts.length < 3) setIsClosed(false);
    setSelectedPointIdx(null);
  };

  // Close path manually
  const handleClosePath = () => {
    if (points.length >= 3 && !isClosed) {
      pushHistory(points, true);
      setIsClosed(true);
      setSelectedPointIdx(null);
    }
  };

  // Grid snapping helper
  const snap = useCallback((val) => {
    if (!snapToGrid) return val;
    return Math.round(val / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  // Zoom & View helpers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(8.0, Math.round(prev * 1.25 * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.25, Math.round(prev * 0.8 * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (!points || points.length === 0) {
      setZoom(1.0);
      setPanOffset({ x: 0, y: 0 });
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
      if (pt.handleIn) {
        minX = Math.min(minX, pt.x + pt.handleIn.x);
        maxX = Math.max(maxX, pt.x + pt.handleIn.x);
        minY = Math.min(minY, pt.y + pt.handleIn.y);
        maxY = Math.max(maxY, pt.y + pt.handleIn.y);
      }
      if (pt.handleOut) {
        minX = Math.min(minX, pt.x + pt.handleOut.x);
        maxX = Math.max(maxX, pt.x + pt.handleOut.x);
        minY = Math.min(minY, pt.y + pt.handleOut.y);
        maxY = Math.max(maxY, pt.y + pt.handleOut.y);
      }
    });

    const w = Math.max(40, maxX - minX);
    const h = Math.max(40, maxY - minY);
    const cx_pts = (minX + maxX) / 2;
    const cy_pts = (minY + maxY) / 2;

    const canvasW = 520;
    const canvasH = 400;
    const fitZoom = Math.min(3.5, Math.max(0.35, Math.min((canvasW - 120) / w, (canvasH - 120) / h)));
    const roundedZoom = Math.round(fitZoom * 100) / 100;
    setZoom(roundedZoom);
    setPanOffset({
      x: Math.round(-cx_pts * roundedZoom),
      y: Math.round(-cy_pts * roundedZoom)
    });
  };

  // Convert mouse event to canvas world coordinates relative to origin (center)
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left - rect.width / 2;
    const screenY = e.clientY - rect.top - rect.height / 2;
    const worldX = (screenX - panOffset.x) / zoom;
    const worldY = (screenY - panOffset.y) / zoom;
    return {
      x: snap(worldX),
      y: snap(worldY),
      rawX: worldX,
      rawY: worldY
    };
  }, [snap, panOffset, zoom]);

  // Hit testing helpers (scale hit radius by 1 / zoom so accuracy increases with zoom)
  const hitAnchor = (coords, p, screenRadius = 14) => {
    const threshold = screenRadius / zoom;
    const cx = coords.rawX !== undefined ? coords.rawX : coords.x;
    const cy = coords.rawY !== undefined ? coords.rawY : coords.y;
    return Math.hypot(cx - p.x, cy - p.y) <= threshold;
  };

  const hitHandle = (coords, p, handleOffset, screenRadius = 10) => {
    if (!handleOffset) return false;
    const hx = p.x + handleOffset.x;
    const hy = p.y + handleOffset.y;
    const threshold = screenRadius / zoom;
    const cx = coords.rawX !== undefined ? coords.rawX : coords.x;
    const cy = coords.rawY !== undefined ? coords.rawY : coords.y;
    return Math.hypot(cx - hx, cy - hy) <= threshold;
  };

  // Helper: Evaluate cubic Bézier curve at parameter t (0 <= t <= 1)
  const evalBezier = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  };

  // Helper: Distance from point P to straight line segment from A to B
  const distToLineSegment = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { dist: Math.hypot(p.x - a.x, p.y - a.y), point: { ...a }, t: 0 };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    return { dist: Math.hypot(p.x - proj.x, p.y - proj.y), point: proj, t };
  };

  // Helper: Find closest path segment to coords within threshold distance
  const findSegmentHit = (coords, pts, closed, threshold = 10) => {
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const maxSegments = closed ? pts.length : pts.length - 1;
    let best = null;
    let minD = threshold;

    for (let i = 0; i < maxSegments; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const p0 = { x: curr.x, y: curr.y };
      const p3 = { x: next.x, y: next.y };
      const hasCurve = Boolean(curr.handleOut || next.handleIn);

      if (!hasCurve) {
        const res = distToLineSegment(coords, p0, p3);
        if (res.dist <= minD) {
          minD = res.dist;
          best = { index: i, point: res.point, t: res.t, isCurve: false };
        }
      } else {
        const p1 = curr.handleOut ? { x: curr.x + curr.handleOut.x, y: curr.y + curr.handleOut.y } : p0;
        const p2 = next.handleIn ? { x: next.x + next.handleIn.x, y: next.y + next.handleIn.y } : p3;
        const steps = 24;
        let prevSample = p0;
        for (let s = 1; s <= steps; s++) {
          const tVal = s / steps;
          const curSample = evalBezier(p0, p1, p2, p3, tVal);
          const res = distToLineSegment(coords, prevSample, curSample);
          if (res.dist <= minD) {
            minD = res.dist;
            const approxT = (s - 1 + res.t) / steps;
            best = { index: i, point: res.point, t: approxT, isCurve: true };
          }
          prevSample = curSample;
        }
      }
    }

    return best;
  };

  // Pointer Down (Photoshop Pen tool interaction & Viewport Pan)
  const handlePointerDown = (e) => {
    e.preventDefault();

    // Check if middle click, holding Space, or Hand tool active -> Pan Viewport!
    const isPan = e.button === 1 || isSpaceDown || activeTool === 'hand';
    if (isPan) {
      const drag = dragRef.current;
      drag.isPanning = true;
      drag.panStart = { x: e.clientX, y: e.clientY };
      drag.initialPan = { ...panOffset };
      setIsPanningState(true);
      return;
    }

    const coords = getCanvasCoords(e);
    const drag = dragRef.current;
    drag.hasMoved = false;
    drag.downPos = { ...coords };
    drag.isDirectMoving = false;
    drag.isAltCurvePull = false;
    drag.isDrawing = false;
    drag.dragHandle = null;
    drag.dragPointIdx = null;

    const isCmdCtrl = Boolean(e.metaKey || e.ctrlKey);
    const isAlt = Boolean(e.altKey);

    // =========================================================================
    // 1. OPTION / ALT KEY: Enable Bézier curve for clicked point
    // =========================================================================
    if (isAlt) {
      for (let i = 0; i < points.length; i++) {
        if (hitAnchor(coords, points[i], 14)) {
          pushHistory(points, isClosed);
          const currPt = points[i];
          let hIn = currPt.handleIn;
          let hOut = currPt.handleOut;

          // If point doesn't have handles yet, compute tangent along path flow
          if (!hIn && !hOut) {
            const prevPt = points[(i - 1 + points.length) % points.length];
            const nextPt = points[(i + 1) % points.length];
            let dirX = 40;
            let dirY = 0;
            if (points.length >= 2 && prevPt && nextPt && (prevPt !== currPt || nextPt !== currPt)) {
              const dx = nextPt.x - prevPt.x;
              const dy = nextPt.y - prevPt.y;
              const len = Math.hypot(dx, dy);
              if (len > 0.001) {
                const handleLen = Math.min(65, Math.max(30, len * 0.28));
                dirX = (dx / len) * handleLen;
                dirY = (dy / len) * handleLen;
              }
            }
            hOut = { x: Math.round(dirX), y: Math.round(dirY) };
            hIn = { x: -Math.round(dirX), y: -Math.round(dirY) };
          }

          setPoints((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    type: 'smooth',
                    handleIn: hIn,
                    handleOut: hOut
                  }
                : p
            )
          );
          setSelectedPointIdx(i);
          drag.isAltCurvePull = true;
          drag.dragPointIdx = i;
          return;
        }
      }

      // If Alt-clicking an existing bezier handle, convert to corner handle (break symmetry)
      if (selectedPointIdx !== null && points[selectedPointIdx]) {
        const selPt = points[selectedPointIdx];
        if (hitHandle(coords, selPt, selPt.handleOut, 10)) {
          drag.dragHandle = { pointIdx: selectedPointIdx, type: 'out', breakSymmetry: true };
          return;
        }
        if (hitHandle(coords, selPt, selPt.handleIn, 10)) {
          drag.dragHandle = { pointIdx: selectedPointIdx, type: 'in', breakSymmetry: true };
          return;
        }
      }
      return;
    }

    // =========================================================================
    // 2. COMMAND / CONTROL KEY: Direct Selection (move point around)
    // =========================================================================
    if (isCmdCtrl) {
      // Find closest anchor point to move
      for (let i = 0; i < points.length; i++) {
        if (hitAnchor(coords, points[i], 16)) {
          pushHistory(points, isClosed);
          setSelectedPointIdx(i);
          drag.isDirectMoving = true;
          drag.dragPointIdx = i;
          return;
        }
      }
      // Also allow moving handles while holding Cmd/Ctrl
      if (selectedPointIdx !== null && points[selectedPointIdx]) {
        const selPt = points[selectedPointIdx];
        if (hitHandle(coords, selPt, selPt.handleOut, 12)) {
          drag.dragHandle = { pointIdx: selectedPointIdx, type: 'out' };
          return;
        }
        if (hitHandle(coords, selPt, selPt.handleIn, 12)) {
          drag.dragHandle = { pointIdx: selectedPointIdx, type: 'in' };
          return;
        }
      }
      // Clicking empty canvas with Cmd/Ctrl deselects without adding new points
      setSelectedPointIdx(null);
      return;
    }

    // =========================================================================
    // 3. STANDARD PEN TOOL (Neither Alt nor Cmd/Ctrl held)
    // =========================================================================
    // 3a. Check if clicking on bezier handle of selected point
    if (selectedPointIdx !== null && points[selectedPointIdx]) {
      const selPt = points[selectedPointIdx];
      if (hitHandle(coords, selPt, selPt.handleOut, 10)) {
        drag.dragHandle = { pointIdx: selectedPointIdx, type: 'out' };
        return;
      }
      if (hitHandle(coords, selPt, selPt.handleIn, 10)) {
        drag.dragHandle = { pointIdx: selectedPointIdx, type: 'in' };
        return;
      }
    }

    // 3b. Check if clicking on any anchor point
    for (let i = 0; i < points.length; i++) {
      if (hitAnchor(coords, points[i], 14)) {
        // If clicking start point (i === 0) on unclosed path with 3+ points -> CLOSE PATH!
        if (i === 0 && !isClosed && points.length >= 3) {
          pushHistory(points, true);
          setIsClosed(true);
          setSelectedPointIdx(0);
          return;
        }

        setSelectedPointIdx(i);
        drag.dragPointIdx = i;
        return;
      }
    }

    // 3c. Check if clicking on an existing line/segment between points -> ADD ANCHOR POINT!
    if (!isCmdCtrl) {
      const segHit = findSegmentHit(coords, points, isClosed, 12 / zoom);
      if (segHit) {
        pushHistory(points, isClosed);
        const i = segHit.index;
        const curr = points[i];
        const nextIdx = (i + 1) % points.length;
        const next = points[nextIdx];
        const hasCurve = Boolean(curr.handleOut || next.handleIn);

        let newPt;
        let updatedCurr = { ...curr };
        let updatedNext = { ...next };

        if (hasCurve) {
          const p0 = { x: curr.x, y: curr.y };
          const p1 = curr.handleOut ? { x: curr.x + curr.handleOut.x, y: curr.y + curr.handleOut.y } : p0;
          const p3 = { x: next.x, y: next.y };
          const p2 = next.handleIn ? { x: next.x + next.handleIn.x, y: next.y + next.handleIn.y } : p3;
          const t = Math.max(0.01, Math.min(0.99, segHit.t));
          const u = 1 - t;

          const p01 = { x: u * p0.x + t * p1.x, y: u * p0.y + t * p1.y };
          const p12 = { x: u * p1.x + t * p2.x, y: u * p1.y + t * p2.y };
          const p23 = { x: u * p2.x + t * p3.x, y: u * p2.y + t * p3.y };

          const p012 = { x: u * p01.x + t * p12.x, y: u * p01.y + t * p12.y };
          const p123 = { x: u * p12.x + t * p23.x, y: u * p12.y + t * p23.y };

          const p0123 = { x: u * p012.x + t * p123.x, y: u * p012.y + t * p123.y };

          const insertX = Math.round(p0123.x);
          const insertY = Math.round(p0123.y);

          updatedCurr.handleOut = {
            x: Math.round(p01.x - p0.x),
            y: Math.round(p01.y - p0.y)
          };
          updatedNext.handleIn = {
            x: Math.round(p23.x - p3.x),
            y: Math.round(p23.y - p3.y)
          };

          newPt = {
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            x: insertX,
            y: insertY,
            handleIn: {
              x: Math.round(p012.x - p0123.x),
              y: Math.round(p012.y - p0123.y)
            },
            handleOut: {
              x: Math.round(p123.x - p0123.x),
              y: Math.round(p123.y - p0123.y)
            },
            type: 'smooth'
          };
        } else {
          // Straight line segment: insert clean corner anchor point on segment
          const insertX = Math.round(segHit.point.x);
          const insertY = Math.round(segHit.point.y);
          newPt = {
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            x: insertX,
            y: insertY,
            handleIn: null,
            handleOut: null,
            type: 'corner'
          };
        }

        // Build new points list with updated segment endpoints and new inserted point
        const nextPointsList = points.map((p, idx) => {
          if (idx === i) return updatedCurr;
          if (idx === nextIdx) return updatedNext;
          return p;
        });
        nextPointsList.splice(i + 1, 0, newPt);

        setPoints(nextPointsList);
        setSelectedPointIdx(i + 1);
        drag.dragPointIdx = i + 1;
        drag.hasMoved = false;
        setHoveredSegment(null);
        return;
      }
    }

    // 3d. If path is NOT closed, click on empty canvas to drop new point
    if (!isClosed) {
      pushHistory(points, false);
      const newPt = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        x: coords.x,
        y: coords.y,
        handleIn: null,
        handleOut: null,
        type: 'corner'
      };
      setPoints((prev) => [...prev, newPt]);
      setSelectedPointIdx(points.length);
      drag.isDrawing = true;
      drag.dragPointIdx = points.length;
    } else {
      // Clicking empty canvas on closed path deselects
      setSelectedPointIdx(null);
    }
  };

  // Pointer Move (Viewport Panning, Curve pulling & point dragging)
  const handlePointerMove = (e) => {
    const drag = dragRef.current;

    // Viewport panning drag
    if (drag.isPanning) {
      const dx = e.clientX - drag.panStart.x;
      const dy = e.clientY - drag.panStart.y;
      setPanOffset({
        x: Math.round(drag.initialPan.x + dx),
        y: Math.round(drag.initialPan.y + dy)
      });
      return;
    }

    const coords = getCanvasCoords(e);

    // Detect movement threshold (scaled by zoom)
    if (!drag.hasMoved && Math.hypot(coords.x - drag.downPos.x, coords.y - drag.downPos.y) > (3 / zoom)) {
      drag.hasMoved = true;
    }

    // A. Option/Alt held while dragging anchor: pull bezier curve handles dynamically
    if (drag.isAltCurvePull && drag.dragPointIdx !== null) {
      const idx = drag.dragPointIdx;
      setPoints((prev) =>
        prev.map((p, i) => {
          if (i !== idx) return p;
          const dx = coords.x - p.x;
          const dy = coords.y - p.y;
          return {
            ...p,
            type: 'smooth',
            handleOut: { x: dx, y: dy },
            handleIn: { x: -dx, y: -dy }
          };
        })
      );
      return;
    }

    // B. Command/Control held: direct moving of anchor point position
    if (drag.isDirectMoving && drag.dragPointIdx !== null) {
      const idx = drag.dragPointIdx;
      setPoints((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, x: coords.x, y: coords.y } : p))
      );
      return;
    }

    // C. Pulling bezier handles on newly dropped point (Photoshop Pen drag)
    if (drag.isDrawing && drag.dragPointIdx !== null) {
      const idx = drag.dragPointIdx;
      setPoints((prev) =>
        prev.map((p, i) => {
          if (i !== idx) return p;
          const dx = coords.x - p.x;
          const dy = coords.y - p.y;
          return {
            ...p,
            handleOut: { x: dx, y: dy },
            handleIn: { x: -dx, y: -dy },
            type: 'smooth'
          };
        })
      );
      return;
    }

    // D. Dragging existing bezier handle
    if (drag.dragHandle) {
      const { pointIdx, type, breakSymmetry } = drag.dragHandle;
      setPoints((prev) =>
        prev.map((p, i) => {
          if (i !== pointIdx) return p;
          const offset = { x: coords.x - p.x, y: coords.y - p.y };
          if (breakSymmetry || e.altKey) {
            // Broken tangent angle for this handle
            return {
              ...p,
              type: 'corner',
              [type === 'out' ? 'handleOut' : 'handleIn']: offset
            };
          }
          if (type === 'out') {
            return {
              ...p,
              handleOut: offset,
              handleIn: p.type === 'smooth' ? { x: -offset.x, y: -offset.y } : p.handleIn
            };
          } else {
            return {
              ...p,
              handleIn: offset,
              handleOut: p.type === 'smooth' ? { x: -offset.x, y: -offset.y } : p.handleOut
            };
          }
        })
      );
      return;
    }

    // E. Dragging anchor point position (standard drag)
    if (drag.dragPointIdx !== null && drag.hasMoved) {
      const idx = drag.dragPointIdx;
      setPoints((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, x: coords.x, y: coords.y } : p))
      );
      return;
    }

    // F. Hover check on start point to close path
    if (!isClosed && points.length >= 3) {
      const nearStart = hitAnchor(coords, points[0], 15);
      setHoverStartPoint(nearStart);
    } else if (hoverStartPoint) {
      setHoverStartPoint(false);
    }

    // G. Hover check on path segment to insert point (+)
    const isCmdCtrl = Boolean(e.metaKey || e.ctrlKey);
    const isAlt = Boolean(e.altKey);
    if (!isCmdCtrl && !isAlt && !drag.hasMoved && !drag.isPanning) {
      const nearAnyAnchor = points.some((pt) => hitAnchor(coords, pt, 14));
      if (!nearAnyAnchor) {
        const segHit = findSegmentHit(coords, points, isClosed, 12 / zoom);
        setHoveredSegment(segHit);
      } else if (hoveredSegment) {
        setHoveredSegment(null);
      }
    } else if (hoveredSegment) {
      setHoveredSegment(null);
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag.isPanning) {
      drag.isPanning = false;
      setIsPanningState(false);
    }
    drag.isDrawing = false;
    drag.dragPointIdx = null;
    drag.dragHandle = null;
    drag.hasMoved = false;
    drag.isDirectMoving = false;
    drag.isAltCurvePull = false;
  };

  // Interactive Mouse Wheel Zoom (Centered at cursor)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;

      setZoom((prevZoom) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.min(8.0, Math.max(0.25, Math.round(prevZoom * factor * 100) / 100));

        setPanOffset((prevPan) => {
          const worldX = (mx - prevPan.x) / prevZoom;
          const worldY = (my - prevPan.y) / prevZoom;
          return {
            x: Math.round(mx - worldX * newZoom),
            y: Math.round(my - worldY * newZoom)
          };
        });

        return newZoom;
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Canvas Drawing Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    // Clear background in screen coordinates
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply Viewport Pan & Zoom transformation
    ctx.translate(cx + panOffset.x, cy + panOffset.y);
    ctx.scale(zoom, zoom);

    // Visible World Bounds
    const minWorldX = (-cx - panOffset.x) / zoom;
    const maxWorldX = (width - cx - panOffset.x) / zoom;
    const minWorldY = (-cy - panOffset.y) / zoom;
    const maxWorldY = (height - cy - panOffset.y) / zoom;

    // 0. Draw Background Tracing Image (if present & visible)
    if (bgImage?.img && bgVisible) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, bgOpacity));
      const img = bgImage.img;
      const nw = img.naturalWidth || img.width || 400;
      const nh = img.naturalHeight || img.height || 300;
      const naturalAspect = nw / nh;

      let baseW = width * 0.78;
      let baseH = baseW / naturalAspect;
      if (baseH > height * 0.78) {
        baseH = height * 0.78;
        baseW = baseH * naturalAspect;
      }
      const drawW = baseW * bgScale;
      const drawH = baseH * bgScale;
      const drawX = bgOffset.x - drawW / 2;
      const drawY = bgOffset.y - drawH / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // 1. Draw Grid in world space
    ctx.strokeStyle = bgImage?.img && bgVisible ? 'rgba(51, 65, 85, 0.18)' : 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    const startGridX = Math.floor(minWorldX / gridSize) * gridSize;
    const endGridX = Math.ceil(maxWorldX / gridSize) * gridSize;
    for (let x = startGridX; x <= endGridX; x += gridSize) {
      ctx.moveTo(x, minWorldY);
      ctx.lineTo(x, maxWorldY);
    }
    const startGridY = Math.floor(minWorldY / gridSize) * gridSize;
    const endGridY = Math.ceil(maxWorldY / gridSize) * gridSize;
    for (let y = startGridY; y <= endGridY; y += gridSize) {
      ctx.moveTo(minWorldX, y);
      ctx.lineTo(maxWorldX, y);
    }
    ctx.stroke();

    // 2. Center Origin Axes (world x=0 and y=0)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, minWorldY);
    ctx.lineTo(0, maxWorldY);
    ctx.moveTo(minWorldX, 0);
    ctx.lineTo(maxWorldX, 0);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();

    if (points.length > 0) {
      // 3. Draw Vector Path
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length; i++) {
        if (i === points.length - 1 && !isClosed) break;
        const curr = points[i];
        const next = points[(i + 1) % points.length];

        const cp1 = curr.handleOut ? { x: curr.x + curr.handleOut.x, y: curr.y + curr.handleOut.y } : null;
        const cp2 = next.handleIn ? { x: next.x + next.handleIn.x, y: next.y + next.handleIn.y } : null;

        if (cp1 || cp2) {
          const c1 = cp1 || { x: curr.x, y: curr.y };
          const c2 = cp2 || { x: next.x, y: next.y };
          ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, next.x, next.y);
        } else {
          ctx.lineTo(next.x, next.y);
        }
      }

      if (isClosed) {
        ctx.closePath();

        // Translucent Face Fill (visual feedback that face is connected!)
        ctx.fillStyle = isGlow
          ? 'rgba(236, 72, 153, 0.28)'
          : `${selectedColor}33`; // 20% opacity hex
        ctx.fill();

        // Glowing outer border
        ctx.strokeStyle = isGlow ? '#ec4899' : selectedColor;
        ctx.lineWidth = 3 / zoom;
        ctx.shadowColor = isGlow ? '#ec4899' : '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Unclosed dashed line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Draw Tangent Handles for selected point
      if (selectedPointIdx !== null && points[selectedPointIdx]) {
        const pt = points[selectedPointIdx];
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.7)';
        ctx.lineWidth = 1.2 / zoom;

        // Handle Out
        if (pt.handleOut) {
          const hx = pt.x + pt.handleOut.x;
          const hy = pt.y + pt.handleOut.y;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(hx, hy);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.arc(hx, hy, 4.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Handle In
        if (pt.handleIn) {
          const hx = pt.x + pt.handleIn.x;
          const hy = pt.y + pt.handleIn.y;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(hx, hy);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.arc(hx, hy, 4.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // 5. Draw Anchor Points
      points.forEach((pt, i) => {
        const isStart = i === 0;
        const isSelected = i === selectedPointIdx;

        // Start point indicator
        if (isStart && !isClosed) {
          ctx.strokeStyle = hoverStartPoint ? '#22c55e' : '#10b981';
          ctx.lineWidth = (hoverStartPoint ? 3.5 : 2) / zoom;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (hoverStartPoint ? 11 : 8) / zoom, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isSelected
          ? '#38bdf8'
          : isStart
          ? '#10b981'
          : pt.type === 'smooth'
          ? '#c084fc'
          : '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2 / zoom;

        if (pt.type === 'smooth') {
          // Round circle for smooth curve anchors
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (isSelected ? 6.5 : 5) / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          // Square for corner points
          const sz = (isSelected ? 11 : 9) / zoom;
          ctx.fillRect(pt.x - sz / 2, pt.y - sz / 2, sz, sz);
          ctx.strokeRect(pt.x - sz / 2, pt.y - sz / 2, sz, sz);
        }
      });

      // 6. Draw Hovered Segment Add-Point Indicator (+)
      if (hoveredSegment && hoveredSegment.point) {
        const hx = hoveredSegment.point.x;
        const hy = hoveredSegment.point.y;

        // Glowing outer ring
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5 / zoom;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(hx, hy, 9 / zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Filled center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5 / zoom, 0, Math.PI * 2);
        ctx.fill();

        // Plus icon (+) in center
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.6 / zoom;
        ctx.beginPath();
        ctx.moveTo(hx - 3 / zoom, hy);
        ctx.lineTo(hx + 3 / zoom, hy);
        ctx.moveTo(hx, hy - 3 / zoom);
        ctx.lineTo(hx, hy + 3 / zoom);
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [points, isClosed, selectedPointIdx, hoverStartPoint, hoveredSegment, selectedColor, isGlow, gridSize, bgImage, bgVisible, bgOpacity, bgScale, bgOffset, zoom, panOffset]);

  // Keyboard shortcuts and modifier detection (Alt for curve, Cmd/Ctrl for move, Space for pan, +/-/0 for zoom, Delete, Enter, Undo)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      if (e.key === 'Alt') setIsAltDown(true);
      if (e.key === 'Meta' || e.key === 'Control') setIsCmdCtrlDown(true);

      // Spacebar for Viewport Pan
      if (e.code === 'Space' && !e.repeat && !isInput) {
        e.preventDefault();
        setIsSpaceDown(true);
      }

      // Tool Switcher (P for Pen, H for Hand)
      if (!isInput && (e.key === 'h' || e.key === 'H')) {
        setActiveTool((prev) => (prev === 'hand' ? 'pen' : 'hand'));
      }
      if (!isInput && (e.key === 'p' || e.key === 'P')) {
        setActiveTool('pen');
      }

      // Zoom shortcuts (+, -, 0)
      if (!isInput) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleResetZoom();
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput && selectedPointIdx !== null) {
          handleDeletePoint(selectedPointIdx);
        }
      } else if (e.key === 'Enter') {
        if (!isInput) handleClosePath();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') setIsAltDown(false);
      if (e.key === 'Meta' || e.key === 'Control') setIsCmdCtrlDown(false);
      if (e.code === 'Space') setIsSpaceDown(false);
    };

    const handleBlur = () => {
      setIsAltDown(false);
      setIsCmdCtrlDown(false);
      setIsSpaceDown(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isOpen, selectedPointIdx, points, isClosed, history]);

  if (!isOpen) return null;

  // Handle Extrude / Inflate Action
  const handleExtrudeAction = () => {
    if (!isClosed || points.length < 3) return;

    const matPresetObj = MATERIAL_PRESETS.find((m) => m.id === materialPreset) || MATERIAL_PRESETS[0];
    const isInflate = creationMode === 'inflate';

    const payload = {
      type: isInflate ? 'vectorInflate' : 'vectorExtrude',
      name: shapeName || (isInflate ? 'Inflated Vector Shape' : 'Extruded Vector Shape'),
      params: {
        points: points,
        scaleFactor: 0.005, // 200px on canvas = 1 meter in 3D AR space
        inflateEnabled: isInflate,
        depth: Number(isInflate ? inflateDepth : extrudeDepth),
        curvatureProfile: curvatureProfile,
        profile: curvatureProfile,
        symmetric: Boolean(inflateSymmetric),
        smoothPasses: Number(inflateSmoothPasses),
        resolution: Number(inflateResolution),
        rimDepth: Number(inflateRimDepth),
        connectEdges: Boolean(connectEdges),
        // Extrusion fallback params
        bevelEnabled: Boolean(bevelEnabled),
        bevelThickness: Number(bevelThickness),
        bevelSize: Number(bevelSize),
        bevelSegments: Number(bevelSegments),
        curveSegments: Number(curveSegments),
        steps: 1
      },
      color: selectedColor,
      roughness: matPresetObj.roughness,
      metalness: matPresetObj.metalness,
      emissive: isGlow ? selectedColor : '#000000',
      emissiveIntensity: isGlow ? 1.5 : 0.0,
      wireframe: isWireframe,
      flatShading: isFlatShading,
      preset: materialPreset
    };

    if (typeof onExtrude === 'function') {
      onExtrude(payload);
      onClose();
    }
  };

  // Direct GLB Binary Export from Pen Studio
  const handleExportGLB = () => {
    if (!isClosed || points.length < 3) return;

    const matPresetObj = MATERIAL_PRESETS.find((m) => m.id === materialPreset) || MATERIAL_PRESETS[0];
    const isInflate = creationMode === 'inflate';

    const payload = {
      type: isInflate ? 'vectorInflate' : 'vectorExtrude',
      name: shapeName || (isInflate ? 'Inflated Vector Shape' : 'Extruded Vector Shape'),
      params: {
        points: points,
        scaleFactor: 0.005,
        inflateEnabled: isInflate,
        depth: Number(isInflate ? inflateDepth : extrudeDepth),
        curvatureProfile: curvatureProfile,
        profile: curvatureProfile,
        symmetric: Boolean(inflateSymmetric),
        smoothPasses: Number(inflateSmoothPasses),
        resolution: Number(inflateResolution),
        rimDepth: Number(inflateRimDepth),
        connectEdges: Boolean(connectEdges),
        bevelEnabled: Boolean(bevelEnabled),
        bevelThickness: Number(bevelThickness),
        bevelSize: Number(bevelSize),
        bevelSegments: Number(bevelSegments),
        curveSegments: Number(curveSegments),
        steps: 1
      },
      color: selectedColor,
      roughness: matPresetObj.roughness,
      metalness: matPresetObj.metalness,
      emissive: isGlow ? selectedColor : '#000000',
      emissiveIntensity: isGlow ? 1.5 : 0.0,
      wireframe: isWireframe,
      flatShading: isFlatShading,
      preset: materialPreset
    };

    try {
      const mesh = createPrimitiveMesh(payload, THREE);
      if (!mesh) return;

      mesh.position.set(0, 0, 0);
      mesh.updateMatrixWorld(true);

      const scene = new THREE.Scene();
      scene.add(mesh);

      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (result) => {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const safeName = (shapeName || (isInflate ? 'inflated_vector' : 'extruded_vector')).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          a.href = url;
          a.download = `${safeName}.glb`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        },
        (err) => {
          console.error('[VectorPenModal] GLTFExporter failed:', err);
          alert('Failed to export .GLB: ' + (err?.message || err));
        },
        { binary: true, embedImages: true }
      );
    } catch (err) {
      console.error('[VectorPenModal] Export error:', err);
      alert('Could not export .GLB: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold">
              <span className="material-symbols-outlined text-2xl">gesture</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white">
                  Vector Pen Tool & 3D Face Extruder
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  isClosed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isClosed ? 'CLOSED FACE READY' : 'OPEN PATH'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drop points & drag bezier handles like Adobe Photoshop. Connect to the start point to close the face and extrude.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Preset Templates Quick Bar */}
        <div className="px-5 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Presets:
          </span>
          {VECTOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleLoadPreset(preset)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-sky-400">{preset.icon}</span>
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Main Canvas & Configuration Split */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 studio-scroll">
          
          {/* Left: Vector Pen Canvas (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            
            {/* Canvas Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/80 p-2 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Tool Selector: Pen vs Hand Pan */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveTool('pen')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'pen'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Pen Tool (P) • Drop points and drag bezier curves"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    <span>Pen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTool('hand')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      activeTool === 'hand'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Hand Tool (H or hold Space) • Click and drag to pan canvas"
                  >
                    <span className="material-symbols-outlined text-xs">pan_tool</span>
                    <span>Hand</span>
                  </button>
                </div>

                {/* Viewport Zoom Controls */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    <span className="material-symbols-outlined text-xs">remove</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                    title="Click to reset zoom to 100% (0)"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Zoom In (+)"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFitToScreen}
                    className="px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer border-l border-slate-800 ml-0.5"
                    title="Auto-Fit shape to screen"
                  >
                    Fit
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBgControls(!showBgControls)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                    showBgControls || bgImage
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Use an image as reference background to trace shapes"
                >
                  <span className="material-symbols-outlined text-xs">image</span>
                  <span>Trace Image {bgImage ? '●' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                    snapToGrid
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                  title="Snap points to 15px grid"
                >
                  <span className="material-symbols-outlined text-xs">grid_4x4</span>
                  <span>Snap {snapToGrid ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Undo last pen stroke (Ctrl+Z)"
                >
                  <span className="material-symbols-outlined text-xs">undo</span>
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-red-300 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear all points"
                >
                  <span className="material-symbols-outlined text-xs">delete_sweep</span>
                  <span>Clear</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isClosed ? (
                  <button
                    type="button"
                    onClick={handleClosePath}
                    disabled={points.length < 3}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                    title="Connect last point to start point to seal face"
                  >
                    <span className="material-symbols-outlined text-xs">lock</span>
                    <span>Close Face</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsClosed(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                    title="Break closed path to add more points"
                  >
                    <span className="material-symbols-outlined text-xs">lock_open</span>
                    <span>Open Path</span>
                  </button>
                )}

                {selectedPointIdx !== null && (
                  <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTogglePointType(selectedPointIdx)}
                      className="px-2 py-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="Toggle point between smooth curve handles and sharp corner"
                    >
                      <span className="material-symbols-outlined text-xs">conversion_path</span>
                      <span>{points[selectedPointIdx]?.type === 'smooth' ? 'Make Corner' : 'Make Curve'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(selectedPointIdx)}
                      className="px-1.5 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 text-[10px] cursor-pointer"
                      title="Delete selected point"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expandable Image Tracing Reference Controls */}
            {showBgControls && (
              <div className="p-3 bg-slate-950/90 border border-purple-500/40 rounded-xl space-y-2.5 text-xs animate-fade-in shadow-lg shadow-purple-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400">image_search</span>
                    <span className="font-bold text-purple-300">Background Reference Image for Tracing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {bgImage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setBgVisible(!bgVisible)}
                          className={`p-1 rounded border transition-colors ${
                            bgVisible
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                          title={bgVisible ? 'Hide Reference Image' : 'Show Reference Image'}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {bgVisible ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBgImage(null)}
                          className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 transition-colors"
                          title="Remove Reference Image"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Upload or Quick Sample Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-[11px] flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">upload_file</span>
                    <span>Upload Image to Trace</span>
                  </button>

                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Samples:</span>
                  {SAMPLE_TRACING_IMAGES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => loadTracingImageUrl(sample.svgDataUri, sample.name)}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs text-purple-400">{sample.icon}</span>
                      <span>{sample.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>

                {/* Sliders for Opacity, Scale & Alignment if image is loaded */}
                {bgImage && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Image Opacity</span>
                        <span className="font-mono text-purple-300">{Math.round(bgOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1.0"
                        step="0.05"
                        value={bgOpacity}
                        onChange={(e) => setBgOpacity(Number(e.target.value))}
                        className="w-full h-1 accent-purple-500 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Zoom / Scale</span>
                        <span className="font-mono text-purple-300">{bgScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="2.5"
                        step="0.05"
                        value={bgScale}
                        onChange={(e) => setBgScale(Number(e.target.value))}
                        className="w-full h-1 accent-purple-500 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-3">
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono" title={bgImage.name}>
                        {bgImage.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBgOffset({ x: 0, y: 0 })}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 cursor-pointer"
                      >
                        Reset Center
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interactive 2D Canvas */}
            <div
              className={`relative rounded-2xl border-2 overflow-hidden bg-slate-950 shadow-inner flex items-center justify-center transition-all ${
                isDragOverCanvas
                  ? 'border-purple-400 ring-4 ring-purple-500/40 shadow-xl'
                  : 'border-slate-700/80'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverCanvas(true);
              }}
              onDragLeave={() => setIsDragOverCanvas(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverCanvas(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload({ target: { files: e.dataTransfer.files } });
                }
              }}
            >
              <canvas
                ref={canvasRef}
                width={520}
                height={400}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  cursor: dragRef.current.isPanning || isPanningState
                    ? 'grabbing'
                    : isSpaceDown || activeTool === 'hand'
                    ? 'grab'
                    : isCmdCtrlDown
                    ? 'move'
                    : isAltDown
                    ? 'cell'
                    : hoveredSegment
                    ? 'copy'
                    : 'crosshair'
                }}
                className="w-full h-[360px] sm:h-[400px] touch-none select-none"
              />

              {/* Drag over canvas overlay */}
              {isDragOverCanvas && (
                <div className="absolute inset-0 bg-purple-950/85 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none text-white space-y-2 animate-fade-in">
                  <span className="material-symbols-outlined text-4xl text-purple-300 animate-bounce">
                    upload_file
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-200">
                    Drop Image Here to Load as Background
                  </span>
                </div>
              )}

              {/* Status Overlay Banner */}
              <div className="absolute top-3 left-3 pointer-events-none">
                {isClosed ? (
                  <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg shadow-emerald-950/50">
                    <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                    <span>Face Connected & Closed ({points.length} nodes) • Ready to Extrude</span>
                  </div>
                ) : (
                  <div className="bg-slate-900/90 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md">
                    <span className="material-symbols-outlined text-sm text-sky-400">edit</span>
                    <span>
                      {points.length === 0
                        ? 'Click on canvas to drop first anchor point'
                        : `${points.length} points placed • Click green start point to close`}
                    </span>
                  </div>
                )}
              </div>

              {/* Floating Viewport Navigation HUD (Bottom-Right) */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl p-1 shadow-xl text-xs z-10">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <span className="material-symbols-outlined text-xs">remove</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 font-mono text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center justify-center transition-colors cursor-pointer"
                  title="Reset to 100% (0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom In (+)"
                >
                  <span className="material-symbols-outlined text-xs">add</span>
                </button>
                <button
                  type="button"
                  onClick={handleFitToScreen}
                  className="px-2 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border-l border-slate-800 ml-0.5"
                  title="Fit shape to view"
                >
                  Fit
                </button>
              </div>

              {/* Close Path Floating Prompt when hovering start point */}
              {hoverStartPoint && !isClosed && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-lg pointer-events-none animate-bounce flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>Click to Close Face!</span>
                </div>
              )}
            </div>

            {/* Live Keyboard Modifier Guidance Bar */}
            <div className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between transition-all ${
              hoveredSegment
                ? 'bg-sky-950/70 border-sky-400/60 text-sky-200 ring-1 ring-sky-500/40 shadow-lg'
                : isSpaceDown || activeTool === 'hand' || isPanningState
                ? 'bg-amber-950/70 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/40 shadow-lg'
                : isAltDown
                ? 'bg-purple-950/70 border-purple-500/60 text-purple-200 ring-1 ring-purple-500/40 shadow-lg'
                : isCmdCtrlDown
                ? 'bg-sky-950/70 border-sky-500/60 text-sky-200 ring-1 ring-sky-500/40 shadow-lg'
                : 'bg-slate-950/70 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-purple-400">
                  {hoveredSegment ? 'add_circle' : isSpaceDown || activeTool === 'hand' ? 'pan_tool' : isAltDown ? 'gesture' : isCmdCtrlDown ? 'open_with' : 'lightbulb'}
                </span>
                {hoveredSegment ? (
                  <span>
                    <strong className="text-white">Add Anchor Point:</strong> Click on this line segment to insert a new point directly on the path!
                  </span>
                ) : isSpaceDown || activeTool === 'hand' ? (
                  <span>
                    <strong className="text-white">Pan Mode Active:</strong> Click and drag anywhere to pan the canvas view around.
                  </span>
                ) : isAltDown ? (
                  <span>
                    <strong className="text-white">Option/Alt Active:</strong> Click any anchor point to enable its Bézier curve! Drag while clicking to aim handles.
                  </span>
                ) : isCmdCtrlDown ? (
                  <span>
                    <strong className="text-white">Cmd/Ctrl Active:</strong> Direct Selection Tool • Click and drag any point to move it around freely.
                  </span>
                ) : (
                  <span>
                    <strong>Scroll Wheel</strong> to Zoom. <strong>Space+Drag</strong> or <strong>H</strong> to Pan. <strong>Click Line</strong> to add point. <strong>Option/Alt</strong> for curves.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isSpaceDown || activeTool === 'hand'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
                  ␣ Space Pan
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isAltDown
                    ? 'bg-purple-500 text-white border-purple-400 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
                  ⌥ Option/Alt
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isCmdCtrlDown
                    ? 'bg-sky-500 text-white border-sky-400 animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
                  ⌘ Cmd/Ctrl
                </span>
              </div>
            </div>
          </div>

          {/* Right: Extrusion & Material Settings (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Shape Name Input */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Shape Name
              </label>
              <input
                type="text"
                value={shapeName}
                onChange={(e) => setShapeName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
                placeholder="e.g. Star Logo, Neon Crest"
              />
            </div>

            {/* 3D Generation Mode Tabs: 3D Extrusion vs Curvature & Volumetric Inflation */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setCreationMode('extrude')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  creationMode === 'extrude'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">straighten</span>
                <span>3D Extrusion</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('inflate')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  creationMode === 'inflate'
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                    : 'text-pink-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">bubble_chart</span>
                <span>Curvature & Inflation</span>
              </button>
            </div>

            {/* MODE 1: 3D Face Extrusion */}
            {creationMode === 'extrude' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sky-400">straighten</span>
                    3D Face Extrusion
                  </h4>
                  <span className="text-[10px] font-mono text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    {extrudeDepth.toFixed(2)}m Depth
                  </span>
                </div>

                {/* Extrude Depth */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Extrude Depth (Z Thickness)</span>
                    <span className="font-mono text-sky-400">{extrudeDepth.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="1.5"
                    step="0.02"
                    value={extrudeDepth}
                    onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Bevel Toggle & Sliders */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={bevelEnabled}
                        onChange={(e) => setBevelEnabled(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-sky-500"
                      />
                      <span>Bevel Edges (Chamfer / Fillet)</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {bevelEnabled ? `${bevelThickness.toFixed(2)}m` : 'Flat Edge'}
                    </span>
                  </div>

                  {bevelEnabled && (
                    <div className="space-y-2.5 pl-3 border-l-2 border-sky-500/30">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>Bevel Thickness</span>
                          <span className="font-mono text-sky-400">{bevelThickness.toFixed(2)}m</span>
                        </div>
                        <input
                          type="range"
                          min="0.00"
                          max="0.10"
                          step="0.01"
                          value={bevelThickness}
                          onChange={(e) => setBevelThickness(parseFloat(e.target.value))}
                          className="w-full accent-sky-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>Bevel Size (Offset)</span>
                          <span className="font-mono text-sky-400">{bevelSize.toFixed(2)}m</span>
                        </div>
                        <input
                          type="range"
                          min="0.00"
                          max="0.10"
                          step="0.01"
                          value={bevelSize}
                          onChange={(e) => setBevelSize(parseFloat(e.target.value))}
                          className="w-full accent-sky-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>Bevel Segments</span>
                          <span className="font-mono text-sky-400">{bevelSegments}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="6"
                          step="1"
                          value={bevelSegments}
                          onChange={(e) => setBevelSegments(parseInt(e.target.value, 10))}
                          className="w-full accent-sky-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Curve Segments Smoothness */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Curve Smoothness (Steps)</span>
                    <span className="font-mono text-purple-400">{curveSegments}</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="48"
                    step="2"
                    value={curveSegments}
                    onChange={(e) => setCurveSegments(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* MODE 2: Curvature & Volumetric Inflation (Distance-Field Poisson Engine) */}
            {creationMode === 'inflate' && (
              <div className="bg-slate-950/80 border border-pink-500/30 rounded-xl p-4 space-y-3.5 shadow-lg shadow-pink-950/20">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-pink-400">bubble_chart</span>
                    Curvature & Volumetric Inflation
                  </h4>
                  <span className="text-[10px] font-mono text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                    {inflateDepth.toFixed(2)}m Puff
                  </span>
                </div>

                {/* Curvature Profile Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Curvature Profile</span>
                    <span className="font-mono text-pink-400 text-[10px] font-semibold">
                      {INFLATION_PROFILES.find((p) => p.id === curvatureProfile)?.name || 'Elliptic'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {INFLATION_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCurvatureProfile(p.id)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-left flex items-center gap-1.5 cursor-pointer ${
                          curvatureProfile === p.id
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                        title={p.description}
                      >
                        <span className="material-symbols-outlined text-sm">{p.icon}</span>
                        <span className="truncate">{p.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inflation Depth (Z Height) */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Volumetric Thickness (Elevation)</span>
                    <span className="font-mono text-pink-400 font-bold">{inflateDepth.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.02"
                    max="1.50"
                    step="0.02"
                    value={inflateDepth}
                    onChange={(e) => setInflateDepth(parseFloat(e.target.value))}
                    className="w-full accent-pink-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Symmetry Mode: Dual-Sided Puffy vs Single-Sided Dome & Edge Connection */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inflateSymmetric}
                        onChange={(e) => setInflateSymmetric(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-pink-500"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        Dual-Sided Symmetry
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-pink-400">
                      {inflateSymmetric ? 'Full 3D Puffy Balloon' : 'Flat Back (Relief Dome)'}
                    </span>
                  </label>

                  {/* Connect All Edges (Watertight Seal) */}
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={connectEdges}
                        onChange={(e) => setConnectEdges(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-pink-500"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-200 block">
                          Connect All Edges (Watertight Seal)
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Seamlessly stitches all perimeter edges to eliminate non-mesh gaps
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-pink-400 font-semibold shrink-0 ml-2">
                      {connectEdges ? 'Watertight' : 'Open Shell'}
                    </span>
                  </label>
                </div>

                {/* Laplacian Smoothing Passes */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>Smoothing Passes (Laplacian Relaxation)</span>
                    <span className="font-mono text-pink-400 font-bold">{inflateSmoothPasses} passes</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="1"
                    value={inflateSmoothPasses}
                    onChange={(e) => setInflateSmoothPasses(parseInt(e.target.value, 10))}
                    className="w-full accent-pink-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500">
                    Relaxes internal vertex heights while keeping the 2D boundary silhouette locked at zero elevation.
                  </p>
                </div>

                {/* Mesh Grid Density */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>Interior Mesh Resolution (Steiner Grid)</span>
                    <span className="font-mono text-purple-400 font-bold">{inflateResolution} divisions</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="44"
                    step="2"
                    value={inflateResolution}
                    onChange={(e) => setInflateResolution(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Optional Rim / Wall Depth */}
                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>Side Rim Wall Depth</span>
                    <span className="font-mono text-slate-400">{inflateRimDepth.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.40"
                    step="0.02"
                    value={inflateRimDepth}
                    onChange={(e) => setInflateRimDepth(parseFloat(e.target.value))}
                    className="w-full accent-slate-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* PBR Surface & Finish */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-teal-400">palette</span>
                PBR Material Surface
              </h4>

              {/* Preset Selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {MATERIAL_PRESETS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMaterialPreset(m.id);
                      setIsGlow(false);
                    }}
                    className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      materialPreset === m.id && !isGlow
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsGlow(!isGlow)}
                  className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isGlow
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-pink-400 border border-slate-800'
                  }`}
                >
                  ✨ Neon Glow
                </button>
              </div>

              {/* Color Swatches */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center mb-1.5 text-[11px] text-slate-400">
                  <span className="font-medium">Color Tint</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-white/20" style={{ backgroundColor: selectedColor }} />
                    <span className="font-mono text-slate-300 text-[10px]">{selectedColor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setSelectedColor(swatch.hex)}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer border ${
                        selectedColor.toLowerCase() === swatch.hex.toLowerCase()
                          ? 'scale-125 border-white ring-2 ring-sky-400/50 shadow-md'
                          : 'border-white/20 hover:scale-110'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.name}
                    />
                  ))}
                  <label className="flex items-center gap-1 cursor-pointer ml-1 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                    />
                    <span>Hex</span>
                  </label>
                </div>
              </div>

              {/* Shading Checkboxes */}
              <div className="flex items-center gap-4 pt-1 border-t border-slate-800 text-xs text-slate-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFlatShading}
                    onChange={(e) => setIsFlatShading(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span>Flat Shading</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWireframe}
                    onChange={(e) => setIsWireframe(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span>Wireframe</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {isClosed ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">verified</span>
                {creationMode === 'inflate'
                  ? `Closed contour ready for volumetric inflation (${points.length} nodes) • Depth ${inflateDepth.toFixed(2)}m (${curvatureProfile})`
                  : `Closed face ready for 3D extrusion (${points.length} nodes) • Depth ${extrudeDepth.toFixed(2)}m`}
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                Connect path back to start point to complete closed contour before generating 3D shape.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isClosed || points.length < 3}
              onClick={handleExportGLB}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-teal-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={creationMode === 'inflate' ? 'Download Inflated 3D Mesh directly as a .GLB file' : 'Download Extruded Vector Face directly as a .GLB file'}
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Export .GLB</span>
            </button>
            <button
              type="button"
              disabled={!isClosed || points.length < 3}
              onClick={handleExtrudeAction}
              className={`flex-1 sm:flex-none py-2.5 px-6 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 ${
                creationMode === 'inflate'
                  ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-pink-500/25'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:opacity-95 shadow-purple-500/25'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {creationMode === 'inflate' ? 'bubble_chart' : 'view_in_ar'}
              </span>
              <span>
                {creationMode === 'inflate' ? 'Inflate Shape to 3D Scene' : 'Extrude Vector Face to 3D Scene'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
