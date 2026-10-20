import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import 'aframe';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import BuyNowButton from '../components/BuyNowButton';
import { db, storage, functions, analytics } from '../firebase';
import { doc, getDoc, getDocFromServer, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

if (typeof THREE !== 'undefined' && THREE.Cache) {
  THREE.Cache.enabled = false;
  THREE.Cache.clear();
}
// Polyfill Object3D prototype with pivot = null.
// Three.js GLTFExporter expects (object.pivot !== null) to imply that pivot is a Vector3.
// Cloned A-Frame entities and older Three instances have pivot === undefined,
// which causes GLTFExporter to execute _processNodeWithPivotAsync and crash with "Cannot read properties of undefined (reading 'x')".
if (typeof THREE !== 'undefined' && THREE.Object3D?.prototype) {
  if (THREE.Object3D.prototype.pivot === undefined) {
    THREE.Object3D.prototype.pivot = null;
  }
}
if (typeof window !== 'undefined' && window.AFRAME?.THREE?.Object3D?.prototype) {
  if (window.AFRAME.THREE.Object3D.prototype.pivot === undefined) {
    window.AFRAME.THREE.Object3D.prototype.pivot = null;
  }
}
import { httpsCallable } from 'firebase/functions';
import { logEvent } from 'firebase/analytics';
import { isYouTubeUrl, isYouTubeShortUrl, extractYouTubeId, computeGeometrySurfaceFrame, purgeAllSceneVideoLayers, PORTAL_PRESETS, PARTICLE_PRESETS } from '../utils/aframe-components';
import AddGeometryModal from '../components/AddGeometryModal';
import AddModelModal from '../components/AddModelModal';
import VectorPenModal from '../components/VectorPenModal';
import Add3DTextModal from '../components/Add3DTextModal';
import ARLightDiagnosticsDrawer from '../components/ARLightDiagnosticsDrawer';
import FaceSketchExtrudeStudio from '../components/FaceSketchExtrudeStudio';
import { AVAILABLE_FONTS, TEXT_MATERIAL_PRESETS } from '../utils/text3DHelper';
import { GEOMETRY_DEFINITIONS, MATERIAL_PRESETS, COLOR_SWATCHES, createPrimitiveMesh, INFLATION_PROFILES, sanitizeHierarchyForGLTFExport } from '../utils/geometryHelper';
import { loadMarkerForBatch, createDefaultMarkerDataUrl, getImageDimensions } from '../utils/markerHelper';
import {
  captureSceneCanvasThumbnail,
  captureModelThumbnailBlob,
  uploadAssetThumbnail,
  invalidateThumbnailCache,
  batchUpdateAllAssetThumbnails
} from '../utils/modelThumbnailRenderer';
import { fetchTemplatesFromBucket, saveEditedModelTemplate } from '../utils/meshTemplates';

const SHAPE_TEXTURE_SAMPLES = [
  {
    id: 'uv_grid',
    name: 'UV Grid',
    repeat: 1,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%2318181b"/><rect width="128" height="128" fill="%230284c7"/><rect x="128" y="128" width="128" height="128" fill="%230284c7"/><circle cx="64" cy="64" r="26" fill="%23ffffff"/><circle cx="192" cy="192" r="26" fill="%23ffffff"/><text x="128" y="68" font-family="sans-serif" font-weight="900" font-size="20" fill="%23ffffff" text-anchor="middle">STAR weAR</text><text x="128" y="196" font-family="sans-serif" font-weight="900" font-size="20" fill="%2318181b" text-anchor="middle">UV TEST</text></svg>'
  },
  {
    id: 'carbon_weave',
    name: 'Carbon',
    repeat: 3,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%2318181b"/><path d="M0 0 L32 32 L64 0 L64 32 L32 64 L0 32 Z" fill="%2327272a" opacity="0.7"/><path d="M0 32 L32 0 L64 32 L32 64 Z" fill="%233f3f46" opacity="0.4"/></svg>'
  },
  {
    id: 'cyber_hex',
    name: 'Cyber Hex',
    repeat: 2,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="104" viewBox="0 0 60 104"><rect width="60" height="104" fill="%23090d16"/><path d="M30 0 L60 17 L60 52 L30 69 L0 52 L0 17 Z M30 52 L60 69 L60 104 L30 121 L0 104 L0 69 Z" fill="none" stroke="%2314b8a6" stroke-width="2.5"/><circle cx="30" cy="52" r="6" fill="%2306b6d4"/></svg>'
  },
  {
    id: 'hazard_stripes',
    name: 'Hazard',
    repeat: 3,
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" fill="%23eab308"/><path d="M0 60 L60 0 L30 0 L0 30 Z M30 60 L60 30 L60 60 Z" fill="%2318181b"/></svg>'
  }
];

// =========================================================================
// 1. REUSABLE TYPED SLIDER CONTROL WITH DUAL-WAY DATA BINDING
// =========================================================================
const NumberSliderInput = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  color = 'indigo', // 'rose' | 'emerald' | 'sky' | 'indigo' | 'amber' | 'purple'
  precision = 2,
  description = '',
  stepButtons = true,
  resetValue = undefined,
  showRange = true
}) => {
  const [textVal, setTextVal] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (typeof value === 'number' && !isNaN(value)) {
        setTextVal(Number.isInteger(step) && step >= 1 ? String(Math.round(value)) : String(Number(value.toFixed(precision))));
      } else {
        setTextVal(String(value ?? 0));
      }
    }
  }, [value, isFocused, precision, step]);

  const handleTextChange = (e) => {
    const raw = e.target.value;
    setTextVal(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(textVal);
    if (isNaN(parsed)) {
      parsed = resetValue !== undefined ? resetValue : min;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    const finalVal = Number(clamped.toFixed(precision));
    onChange(finalVal);
    setTextVal(String(finalVal));
  };

  const handleNudge = (delta) => {
    const current = typeof value === 'number' && !isNaN(value) ? value : 0;
    const nextVal = Number(Math.max(min, Math.min(max, current + delta)).toFixed(precision));
    onChange(nextVal);
    setTextVal(String(nextVal));
  };

  const colorStyles = {
    rose: {
      accent: 'accent-rose-500',
      text: 'text-rose-400',
      border: 'border-rose-500/40 focus-within:border-rose-400',
      bg: 'bg-rose-950/20',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    emerald: {
      accent: 'accent-emerald-500',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40 focus-within:border-emerald-400',
      bg: 'bg-emerald-950/20',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    sky: {
      accent: 'accent-sky-500',
      text: 'text-sky-400',
      border: 'border-sky-500/40 focus-within:border-sky-400',
      bg: 'bg-sky-950/20',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    },
    indigo: {
      accent: 'accent-indigo-500',
      text: 'text-indigo-400',
      border: 'border-indigo-500/40 focus-within:border-indigo-400',
      bg: 'bg-indigo-950/20',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    amber: {
      accent: 'accent-amber-500',
      text: 'text-amber-400',
      border: 'border-amber-500/40 focus-within:border-amber-400',
      bg: 'bg-amber-950/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    purple: {
      accent: 'accent-purple-500',
      text: 'text-purple-400',
      border: 'border-purple-500/40 focus-within:border-purple-400',
      bg: 'bg-purple-950/20',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    cyan: {
      accent: 'accent-cyan-500',
      text: 'text-cyan-400',
      border: 'border-cyan-500/40 focus-within:border-cyan-400',
      bg: 'bg-cyan-950/20',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    }
  };

  const theme = colorStyles[color] || colorStyles.indigo;

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-semibold text-neutral-300 truncate">{label}</span>
          {description && (
            <span className="text-[10px] text-neutral-500" title={description}>ⓘ</span>
          )}
        </div>

        <div className={`flex items-center rounded bg-black/60 border ${theme.border} px-1 py-0.5 shadow-inner transition-colors`}>
          {stepButtons && (
            <button
              type="button"
              onClick={() => handleNudge(-step)}
              className="w-5 h-5 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              title={`Subtract ${step}`}
            >
              -
            </button>
          )}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={textVal}
            onChange={handleTextChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            className={`w-16 px-1 text-right text-xs font-mono font-bold ${theme.text} bg-transparent outline-none appearance-none`}
          />
          {unit && (
            <span className="text-[10px] font-mono text-neutral-500 px-0.5">{unit}</span>
          )}
          {stepButtons && (
            <button
              type="button"
              onClick={() => handleNudge(step)}
              className="w-5 h-5 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              title={`Add ${step}`}
            >
              +
            </button>
          )}
          {resetValue !== undefined && value !== resetValue && (
            <button
              type="button"
              onClick={() => {
                onChange(resetValue);
                setTextVal(String(resetValue));
              }}
              className="ml-1 text-[10px] text-neutral-500 hover:text-amber-400"
              title={`Reset to ${resetValue}${unit}`}
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {showRange && (
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[10px] font-mono text-neutral-600 w-8">{min}{unit}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={typeof value === 'number' && !isNaN(value) ? value : min}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange(val);
              setTextVal(String(val));
            }}
            className={`flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer ${theme.accent}`}
          />
          <span className="text-[10px] font-mono text-neutral-600 w-8 text-right">{max}{unit}</span>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 2. INTERACTIVE CIRCULAR ROTATION DIAL COMPONENT
// =========================================================================
const RotationDial = ({
  axis = 'X',
  angle = 0,
  onChange,
  color = 'rose',
  description = ''
}) => {
  const dialRef = useRef(null);

  const normalizedAngle = ((((angle + 180) % 360) + 360) % 360) - 180;

  const calculateAngleFromPointer = useCallback((clientX, clientY, snapTo15 = false) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const rad = Math.atan2(dx, -dy);
    let deg = Math.round((rad * 180) / Math.PI);

    if (snapTo15) {
      deg = Math.round(deg / 15) * 15;
    }

    onChange(deg);
  }, [onChange]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    calculateAngleFromPointer(e.clientX, e.clientY, e.shiftKey);

    const handlePointerMove = (moveEvent) => {
      calculateAngleFromPointer(moveEvent.clientX, moveEvent.clientY, moveEvent.shiftKey);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const axisThemes = {
    rose: {
      accent: 'text-rose-400',
      ring: 'stroke-rose-500/50',
      needle: '#f43f5e',
      glow: 'shadow-[0_0_12px_rgba(244,63,94,0.3)]',
      border: 'border-rose-500/30 bg-rose-950/10'
    },
    emerald: {
      accent: 'text-emerald-400',
      ring: 'stroke-emerald-500/50',
      needle: '#10b981',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
      border: 'border-emerald-500/30 bg-emerald-950/10'
    },
    sky: {
      accent: 'text-sky-400',
      ring: 'stroke-sky-500/50',
      needle: '#0ea5e9',
      glow: 'shadow-[0_0_12px_rgba(14,165,233,0.3)]',
      border: 'border-sky-500/30 bg-sky-950/10'
    }
  };

  const theme = axisThemes[color] || axisThemes.rose;

  const dialRadius = 20;
  const cx = 28;
  const cy = 28;
  const angleRad = (normalizedAngle * Math.PI) / 180;
  const pointerX = cx + dialRadius * Math.sin(angleRad);
  const pointerY = cy - dialRadius * Math.cos(angleRad);

  return (
    <div className={`p-2.5 rounded-lg border ${theme.border} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold font-mono bg-black/60 border border-neutral-700 ${theme.accent}`}>
            {axis}
          </span>
          <span className="text-xs font-semibold text-neutral-200">{description || `Rotation ${axis}`}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-mono font-bold ${theme.accent} px-1.5 py-0.5 rounded bg-black/60 border border-neutral-800`}>
            {normalizedAngle}°
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          ref={dialRef}
          onPointerDown={handlePointerDown}
          className={`relative w-14 h-14 rounded-full bg-neutral-950 border border-neutral-800 cursor-grab active:cursor-grabbing flex-shrink-0 flex items-center justify-center select-none ${theme.glow}`}
          title="Drag dial or click to rotate (Hold Shift to snap 15°)"
        >
          <svg className="w-full h-full" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#262626" strokeWidth="1" />
            <circle cx="28" cy="28" r="20" fill="none" stroke="#1f1f1f" strokeWidth="2" />

            <line x1="28" y1="5" x2="28" y2="9" stroke="#525252" strokeWidth="1.5" />
            <line x1="51" y1="28" x2="47" y2="28" stroke="#525252" strokeWidth="1.5" />
            <line x1="28" y1="51" x2="28" y2="47" stroke="#525252" strokeWidth="1.5" />
            <line x1="5" y1="28" x2="9" y2="28" stroke="#525252" strokeWidth="1.5" />

            <line
              x1="28"
              y1="28"
              x2={pointerX}
              y2={pointerY}
              stroke={theme.needle}
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            <circle cx="28" cy="28" r="3" fill="#ffffff" />
            <circle cx={pointerX} cy={pointerY} r="3.5" fill={theme.needle} stroke="#ffffff" strokeWidth="1" />
          </svg>
          <span className="absolute top-0.5 text-[8px] font-mono text-neutral-500 pointer-events-none">0°</span>
        </div>

        <div className="flex-1 min-w-0">
          <NumberSliderInput
            label=""
            value={normalizedAngle}
            onChange={onChange}
            min={-180}
            max={180}
            step={1}
            unit="°"
            color={color}
            precision={0}
            showRange={true}
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 pt-1 border-t border-neutral-800/60">
        {[-90, -45, 0, 45, 90, 180].map((presetDeg) => (
          <button
            key={presetDeg}
            type="button"
            onClick={() => onChange(presetDeg)}
            className={`px-1 py-1 rounded text-[10px] font-mono font-medium transition-colors border ${normalizedAngle === presetDeg
              ? `${theme.border} ${theme.accent} bg-neutral-800 font-bold`
              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
          >
            {presetDeg > 0 ? `+${presetDeg}°` : `${presetDeg}°`}
          </button>
        ))}
      </div>
    </div>
  );
};

// =========================================================================
// TEXTURE MAPPING TRANSFORM HELPERS (PLACEMENT, ORIENTATION, SIZE)
// =========================================================================
const TEXTURE_MAP_SLOTS = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'alphaMap'];

const applyTextureTransform = (tex, transform) => {
  if (!tex || (!tex.isTexture && !tex.isCanvasTexture && !tex.isVideoTexture)) return;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (tex.center) tex.center.set(0.5, 0.5);

  const repX = transform.textureRepeatX !== undefined && transform.textureRepeatX !== null ? Number(transform.textureRepeatX) : 1.0;
  const repY = transform.textureRepeatY !== undefined && transform.textureRepeatY !== null ? Number(transform.textureRepeatY) : 1.0;
  const flipX = Boolean(transform.textureFlipX);
  const flipY = Boolean(transform.textureFlipY);
  const offX = transform.textureOffsetX !== undefined && transform.textureOffsetX !== null ? Number(transform.textureOffsetX) : 0.0;
  const offY = transform.textureOffsetY !== undefined && transform.textureOffsetY !== null ? Number(transform.textureOffsetY) : 0.0;
  const rotDeg = transform.textureRotation !== undefined && transform.textureRotation !== null ? Number(transform.textureRotation) : 0.0;

  if (tex.repeat) tex.repeat.set(flipX ? -repX : repX, flipY ? -repY : repY);
  if (tex.offset) tex.offset.set(offX, offY);
  tex.rotation = (rotDeg * Math.PI) / 180;

  tex.matrixAutoUpdate = true;
  if (typeof tex.updateMatrix === 'function') {
    tex.updateMatrix();
  }
  tex.needsUpdate = true;
};

const applyMaterialTextureTransform = (material, transform) => {
  if (!material) return;
  const mats = Array.isArray(material) ? material : [material];
  mats.forEach((mat) => {
    let hasUpdatedTex = false;
    TEXTURE_MAP_SLOTS.forEach((slot) => {
      const tex = mat[slot];
      if (tex && (tex.isTexture || tex.isCanvasTexture || tex.isVideoTexture)) {
        applyTextureTransform(tex, transform);
        hasUpdatedTex = true;
      }
    });
    if (hasUpdatedTex) {
      mat.needsUpdate = true;
    }
  });
};

// =========================================================================
// 3. OBJECT POSITIONING D-PAD & STEPPER COMPONENT
// =========================================================================
const PositioningDpad = ({
  posX,
  posY,
  posZ,
  onChangeX,
  onChangeY,
  onChangeZ,
  onReset
}) => {
  const [plane, setPlane] = useState('xy');
  const [stepSize, setStepSize] = useState(0.05);

  const nudge = (axis, delta) => {
    if (axis === 'x') onChangeX(Number((posX + delta).toFixed(3)));
    if (axis === 'y') onChangeY(Number((posY + delta).toFixed(3)));
    if (axis === 'z') onChangeZ(Number((posZ + delta).toFixed(3)));
  };

  return (
    <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-sky-400">gamepad</span>
          2D Placement Nudge Pad
        </span>

        <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded border border-neutral-800">
          {[0.01, 0.05, 0.1, 0.5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStepSize(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${stepSize === s
                ? 'bg-neutral-700 text-white font-bold'
                : 'text-neutral-500 hover:text-neutral-300'
                }`}
            >
              {s * 100}cm
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 p-0.5 bg-black/60 rounded border border-neutral-800 text-xs">
        <button
          type="button"
          onClick={() => setPlane('xy')}
          className={`py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${plane === 'xy'
            ? 'bg-neutral-800 text-emerald-400 font-bold border border-emerald-500/30'
            : 'text-neutral-400 hover:text-neutral-200'
            }`}
        >
          <span>X / Y Plane</span>
          <span className="text-[10px] text-neutral-500">(Left/Right & Up/Down)</span>
        </button>
        <button
          type="button"
          onClick={() => setPlane('xz')}
          className={`py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${plane === 'xz'
            ? 'bg-neutral-800 text-sky-400 font-bold border border-sky-500/30'
            : 'text-neutral-400 hover:text-neutral-200'
            }`}
        >
          <span>X / Z Plane</span>
          <span className="text-[10px] text-neutral-500">(Floor & Depth)</span>
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-2">
        <button
          type="button"
          onClick={() => nudge(plane === 'xy' ? 'y' : 'z', plane === 'xy' ? stepSize : -stepSize)}
          className="w-12 h-10 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 active:scale-95 rounded-t-lg flex flex-col items-center justify-center text-neutral-200 transition-all shadow-md"
          title={plane === 'xy' ? `Move Up +Y (${stepSize}m)` : `Move Closer / Forward -Z (${stepSize}m)`}
        >
          <span className="material-symbols-outlined text-sm">arrow_upward</span>
          <span className="text-[9px] font-mono text-neutral-400">{plane === 'xy' ? '+Y' : '-Z'}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nudge('x', -stepSize)}
            className="w-12 h-10 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 active:scale-95 rounded-l-lg flex flex-col items-center justify-center text-neutral-200 transition-all shadow-md"
            title={`Move Left -X (${stepSize}m)`}
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span className="text-[9px] font-mono text-rose-400">-X</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="w-14 h-10 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-400 active:scale-95 rounded flex flex-col items-center justify-center text-amber-400 hover:text-amber-300 transition-all shadow-inner"
            title="Reset Position to Center (0, 0, 0)"
          >
            <span className="material-symbols-outlined text-xs">adjust</span>
            <span className="text-[8px] font-mono font-bold uppercase tracking-tighter">Origin</span>
          </button>

          <button
            type="button"
            onClick={() => nudge('x', stepSize)}
            className="w-12 h-10 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 active:scale-95 rounded-r-lg flex flex-col items-center justify-center text-neutral-200 transition-all shadow-md"
            title={`Move Right +X (${stepSize}m)`}
          >
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
            <span className="text-[9px] font-mono text-rose-400">+X</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => nudge(plane === 'xy' ? 'y' : 'z', plane === 'xy' ? -stepSize : stepSize)}
          className="w-12 h-10 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 active:scale-95 rounded-b-lg flex flex-col items-center justify-center text-neutral-200 transition-all shadow-md"
          title={plane === 'xy' ? `Move Down -Y (${stepSize}m)` : `Move Back / Distance +Z (${stepSize}m)`}
        >
          <span className="text-[9px] font-mono text-neutral-400">{plane === 'xy' ? '-Y' : '+Z'}</span>
          <span className="material-symbols-outlined text-sm">arrow_downward</span>
        </button>
      </div>

      <div className="flex items-center justify-around py-1.5 px-2 bg-black/60 rounded border border-neutral-800 text-[11px] font-mono">
        <span className="text-rose-400">X: {posX.toFixed(2)}m</span>
        <span className="text-emerald-400">Y: {posY.toFixed(2)}m</span>
        <span className="text-sky-400">Z: {posZ.toFixed(2)}m</span>
      </div>
    </div>
  );
};

// Utility: Recursively strip 'undefined' fields and invalid values for Firestore compatibility
const sanitizeForFirestore = (val) => {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  const clean = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  }
  return clean;
};

// Utility: Commit Firestore writeBatch with exponential backoff retry on 429 / resource-exhausted
const safeCommitBatch = async (batchInstance, maxRetries = 3, initialDelayMs = 1000) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await batchInstance.commit();
      return;
    } catch (err) {
      attempt++;
      const isRateLimit =
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('resource-exhausted') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('429');
      if (isRateLimit && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 300;
        console.warn(`[ARTest] Firestore rate limit / resource-exhausted. Backing off ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
};

// =========================================================================
// MAIN ARTEST COMPONENT
// =========================================================================
const ARTest = () => {
  const [batchId, setBatchId] = useState('');
  const [arData, setArData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const sceneRef = useRef(null);
  const isSavingConfigRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState(false);

  // Model Template Editing Mode State
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Active Control Panel Tab: 'transform' | 'hierarchy' | 'lighting' | 'materials' | 'scene'
  const [activeTab, setActiveTab] = useState('transform');

  // Multi-Mesh & Object Selection State
  const [meshList, setMeshList] = useState([]);
  const [selectedMeshUuid, setSelectedMeshUuid] = useState(null); // null = entire model (root)
  const [selectedCustomModelId, setSelectedCustomModelId] = useState(null);
  const [selectedGeometryId, setSelectedGeometryId] = useState(null);
  const [selectedText3DId, setSelectedText3DId] = useState(null);
  const [selectedLightId, setSelectedLightId] = useState(null);
  const [selectedTargetType, setSelectedTargetType] = useState('model'); // 'model' | 'text3d' | 'light' | 'geometry' | 'mesh' | 'customModel' | 'group' | 'multi' | null

  // Scene Groups & Multi-Selection States
  const [sceneGroups, setSceneGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]); // Array<{ type: string, id: string }>
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [groupSelectionMode, setGroupSelectionMode] = useState('group'); // 'group' | 'direct'
  const [isModifierHeld, setIsModifierHeld] = useState(false);
  const activeGroupDragRef = useRef(null);

  useEffect(() => {
    const handleModifierDown = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsModifierHeld(true);
      }
    };
    const handleModifierUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsModifierHeld(false);
      }
    };
    const handleBlur = () => {
      setIsModifierHeld(false);
    };
    window.addEventListener('keydown', handleModifierDown);
    window.addEventListener('keyup', handleModifierUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleModifierDown);
      window.removeEventListener('keyup', handleModifierUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const sceneGroupsRef = useRef(sceneGroups);
  useEffect(() => {
    sceneGroupsRef.current = sceneGroups;
  }, [sceneGroups]);

  const selectedObjectsRef = useRef(selectedObjects);
  useEffect(() => {
    selectedObjectsRef.current = selectedObjects;
  }, [selectedObjects]);

  const transformControlsRef = useRef(null);

  // Unified Scene Object Selector: guarantees atomic target activation and clears old selection states
  const selectSceneObject = useCallback((type, idOrUuid = null) => {
    setSelectedMeshUuid(null);
    setSelectedGeometryId(null);
    setSelectedText3DId(null);
    setSelectedLightId(null);
    setSelectedCustomModelId(null);

    switch (type) {
      case 'group':
        setSelectedGroupId(idOrUuid);
        setSelectedTargetType('group');
        if (idOrUuid) {
          const grp = sceneGroupsRef.current.find((g) => g.id === idOrUuid);
          if (grp) {
            setSelectedObjects([...grp.itemIds]);
          }
        }
        break;
      case 'multi':
        setSelectedGroupId(null);
        setSelectedTargetType('multi');
        break;
      case 'model':
        setSelectedGroupId(null);
        setSelectedTargetType('model');
        setSelectedObjects([{ type: 'model', id: 'root-model' }]);
        break;
      case 'mesh':
        setSelectedGroupId(null);
        setSelectedMeshUuid(idOrUuid);
        setSelectedTargetType('mesh');
        if (idOrUuid) setSelectedObjects([{ type: 'mesh', id: idOrUuid }]);
        break;
      case 'geometry':
        setSelectedGroupId(null);
        setSelectedGeometryId(idOrUuid);
        setSelectedTargetType('geometry');
        if (idOrUuid) setSelectedObjects([{ type: 'geometry', id: idOrUuid }]);
        break;
      case 'customModel':
        setSelectedGroupId(null);
        setSelectedCustomModelId(idOrUuid);
        setSelectedTargetType('customModel');
        if (idOrUuid) setSelectedObjects([{ type: 'customModel', id: idOrUuid }]);
        break;
      case 'text3d':
        setSelectedGroupId(null);
        setSelectedText3DId(idOrUuid);
        setSelectedTargetType('text3d');
        if (idOrUuid) setSelectedObjects([{ type: 'text3d', id: idOrUuid }]);
        break;
      case 'light':
        setSelectedGroupId(null);
        setSelectedLightId(idOrUuid);
        setSelectedTargetType('light');
        if (idOrUuid) setSelectedObjects([{ type: 'light', id: idOrUuid }]);
        break;
      default:
        setSelectedGroupId(null);
        setSelectedTargetType(null);
        setSelectedObjects([]);
        if (transformControlsRef.current) {
          try {
            transformControlsRef.current.detach();
            const helper = transformControlsRef.current.getHelper ? transformControlsRef.current.getHelper() : transformControlsRef.current;
            if (helper) helper.visible = false;
          } catch { }
          window.__activeGizmoTarget = null;
        }
        break;
    }
  }, []);

  const clearSelectionAndDetachGizmo = useCallback(() => {
    selectSceneObject(null);
  }, [selectSceneObject]);

  const [searchFilter, setSearchFilter] = useState('');
  const [deletedMeshNames, setDeletedMeshNames] = useState([]);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState(null);
  const deletedNodesRef = useRef(new Map()); // uuid -> { node, parent, name }
  const [textureUploadingUuid, setTextureUploadingUuid] = useState(null);
  const pendingTextureFilesRef = useRef(new Map()); // meshName -> { meshUuid, meshName, file, previewUrl }
  const pendingShapeTexturesRef = useRef(new Map()); // geomId -> { file, previewUrl }
  const shapeTextureInputRef = useRef(null);
  const [shapeTextureUploadingId, setShapeTextureUploadingId] = useState(null);

  // Global Model Transform States (for entire model root)
  const [modelScale, setModelScale] = useState(0.4);
  const [modelRotSpeed, setModelRotSpeed] = useState(10000);
  const [modelRotX, setModelRotX] = useState(90);
  const [modelRotY, setModelRotY] = useState(0);
  const [modelRotZ, setModelRotZ] = useState(0);

  const [modelPosX, setModelPosX] = useState(0);
  const [modelPosY, setModelPosY] = useState(0);
  const [modelPosZ, setModelPosZ] = useState(0);

  // Scene Lighting Properties State
  const [ambientColor, setAmbientColor] = useState('#ffffff');
  const [ambientIntensity, setAmbientIntensity] = useState(1.4);

  const [dir1Color, setDir1Color] = useState('#ffffff');
  const [dir1Intensity, setDir1Intensity] = useState(2.2);
  const [dir1Position, setDir1Position] = useState('2 4 3');

  const [dir2Color, setDir2Color] = useState('#ffffff');
  const [dir2Intensity, setDir2Intensity] = useState(1.2);
  const [dir2Position, setDir2Position] = useState('-2 -1 -2');

  const [rimColor, setRimColor] = useState('#818cf8');
  const [rimIntensity, setRimIntensity] = useState(1.0);
  const [rimPosition, setRimPosition] = useState('0 3 -3');

  // Custom Multi-Source Lighting State
  const [customLights, setCustomLights] = useState([]);
  const [showLightHelpers, setShowLightHelpers] = useState(true);

  // Material Properties (-1 means preserve GLTF asset PBR settings)
  const [useNativePBR, setUseNativePBR] = useState(true);
  const [matMetalness, setMatMetalness] = useState(-1);
  const [matRoughness, setMatRoughness] = useState(-1);
  const [matEmissive, setMatEmissive] = useState('#000000');
  const [matEmissiveIntensity, setMatEmissiveIntensity] = useState(0.0);
  const [matWireframe, setMatWireframe] = useState(false);
  const [matOpacity, setMatOpacity] = useState(1.0);

  // Environment / Effects
  const [fogColor, setFogColor] = useState('#000000');
  const [fogDensity, setFogDensity] = useState(0.0);

  // UI Elements
  const [showBuyButton, setShowBuyButton] = useState(true);
  const [buyButtonColor, setBuyButtonColor] = useState('#000000');
  const [mediaPlaying, setMediaPlaying] = useState(true);
  const [mediaMuted, setMediaMuted] = useState(false);

  useEffect(() => {
    const handleMuteStatus = (e) => {
      if (e && e.detail && typeof e.detail.muted === 'boolean') {
        setMediaMuted(e.detail.muted);
      }
    };
    window.addEventListener('starwear-video-mute-status', handleMuteStatus);
    return () => window.removeEventListener('starwear-video-mute-status', handleMuteStatus);
  }, []);

  // WebGL Context Preservation & Clean Resource Teardown
  useEffect(() => {
    const sceneEl = sceneRef.current || document.querySelector('a-scene');
    if (!sceneEl) return;

    let canvas = sceneEl.canvas;
    let handleContextLost = null;
    let handleContextRestored = null;

    const setupCanvasListeners = (cvs) => {
      if (!cvs || cvs.__webgl_handlers_attached) return;
      cvs.__webgl_handlers_attached = true;

      handleContextLost = (event) => {
        // Critical: preventDefault informs browser that the app will handle context recovery
        event.preventDefault();
        console.warn('[ARTest] WebGL context lost on canvas. Waiting for GPU restoration...');
      };

      handleContextRestored = () => {
        console.info('[ARTest] WebGL context successfully restored by browser.');
        if (sceneEl.renderer && sceneEl.object3D && sceneEl.camera) {
          try {
            sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
          } catch (e) {
            console.warn('[ARTest] Render post-context restore warning:', e);
          }
        }
      };

      cvs.addEventListener('webglcontextlost', handleContextLost, false);
      cvs.addEventListener('webglcontextrestored', handleContextRestored, false);
    };

    if (canvas) {
      setupCanvasListeners(canvas);
    } else {
      const onRenderStart = () => {
        if (sceneEl.canvas) {
          setupCanvasListeners(sceneEl.canvas);
        }
      };
      sceneEl.addEventListener('renderstart', onRenderStart, { once: true });
    }

    return () => {
      try {
        // Cleanly remove canvas WebGL event listeners
        if (canvas) {
          if (handleContextLost) canvas.removeEventListener('webglcontextlost', handleContextLost);
          if (handleContextRestored) canvas.removeEventListener('webglcontextrestored', handleContextRestored);
          canvas.__webgl_handlers_attached = false;
        }
      } catch (teardownErr) {
        console.warn('[ARTest] Cleanup warning during scene unmount:', teardownErr);
      }
    };
  }, []);

  // Synchronize A-Frame canvas resolution and aspect ratio with container dimensions
  useEffect(() => {
    const handleResize = () => {
      const sceneEl = sceneRef.current || document.querySelector('a-scene');
      if (sceneEl && typeof sceneEl.resize === 'function') {
        sceneEl.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Target Marker Visual Reference States (MindAR Physical Anchor Plane at 0, 0, 0)
  const [markerVisible, setMarkerVisible] = useState(true);
  const [markerImageUrl, setMarkerImageUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const fb = createDefaultMarkerDataUrl('STAR weAR');
        window.__starwear_active_marker_image = fb.dataUrl;
        return fb.dataUrl;
      } catch { }
    }
    return '';
  });
  const [markerAspectRatio, setMarkerAspectRatio] = useState(1.0); // Procedural default is 512x512 = 1.0
  const [markerWidth, setMarkerWidth] = useState(1.0); // 1.0m MindAR default
  const [markerOpacity, setMarkerOpacity] = useState(0.85);
  const [markerLoading, setMarkerLoading] = useState(false);
  const [markerInfo, setMarkerInfo] = useState(() => ({ width: 512, height: 512, source: 'default' }));
  const [markerLockAspect, setMarkerLockAspect] = useState(true);
  const markerFileInputRef = useRef(null);
  const stagedMarkerFileRef = useRef(null);

  // Initialize procedural default marker on mount if none loaded
  useEffect(() => {
    if (!markerImageUrl) {
      try {
        const fb = createDefaultMarkerDataUrl('STAR weAR');
        setMarkerImageUrl(fb.dataUrl);
        setMarkerAspectRatio(fb.aspectRatio || 1.0);
        setMarkerInfo({ width: fb.width, height: fb.height, source: 'default' });
        if (typeof window !== 'undefined') {
          window.__starwear_active_marker_image = fb.dataUrl;
        }
      } catch { }
    }
  }, []);

  // Synchronize marker attributes to A-Frame entity without string parser truncation
  useEffect(() => {
    if (typeof window !== 'undefined' && markerImageUrl && !markerImageUrl.startsWith('blob:')) {
      window.__starwear_active_marker_image = markerImageUrl;
    }
    const safeMarkerUrl = (markerImageUrl && typeof markerImageUrl === 'string' && !markerImageUrl.startsWith('blob:')) ? markerImageUrl : '';
    const markerEl = document.getElementById('ar-marker-reference-anchor');
    if (markerEl && typeof markerEl.setAttribute === 'function') {
      markerEl.setAttribute('ar-marker-reference', {
        enabled: Boolean(markerVisible),
        imageUrl: safeMarkerUrl,
        src: safeMarkerUrl,
        width: Number(markerWidth) || 1.0,
        height: Number((Number(markerWidth || 1.0) * (Number(markerAspectRatio) || 1.0)).toFixed(4)),
        aspectRatio: Number(markerAspectRatio) || 1.0,
        opacity: Number(markerOpacity) || 0.85,
        showAxes: true,
        showFrame: true
      });
    }
  }, [markerImageUrl, markerVisible, markerWidth, markerAspectRatio, markerOpacity]);

  // OrbitControls & Camera References (Controlled like ProductViewer)
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const defaultCamPosRef = useRef(new THREE.Vector3(0, 0.3, 2.5));
  const defaultTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const lastFramedModelKeyRef = useRef('');
  const [cameraAutoRotate, setCameraAutoRotate] = useState(false);

  // Helper to fetch active OrbitControls instance
  const getOrbitControls = useCallback(() => {
    if (controlsRef.current) return controlsRef.current;
    if (typeof window !== 'undefined' && window.__arOrbitControls) {
      controlsRef.current = window.__arOrbitControls;
      return window.__arOrbitControls;
    }
    const cameraEl = document.getElementById('scene-camera');
    if (cameraEl && cameraEl.orbitControls) {
      controlsRef.current = cameraEl.orbitControls;
      return cameraEl.orbitControls;
    }
    if (cameraEl && cameraEl.components && cameraEl.components['orbit-camera-controls']?.controls) {
      controlsRef.current = cameraEl.components['orbit-camera-controls'].controls;
      return controlsRef.current;
    }
    return null;
  }, []);

  const getThreeCamera = useCallback(() => {
    if (cameraRef.current) return cameraRef.current;
    if (typeof window !== 'undefined' && window.__arOrbitCamera) {
      cameraRef.current = window.__arOrbitCamera;
      return window.__arOrbitCamera;
    }
    const sceneEl = document.querySelector('a-scene');
    const cam = sceneEl?.camera || document.getElementById('scene-camera')?.getObject3D('camera');
    if (cam) cameraRef.current = cam;
    return cam;
  }, []);

  const toggleCameraAutoRotate = () => {
    setCameraAutoRotate((prev) => {
      const next = !prev;
      const controls = getOrbitControls();
      if (controls) {
        controls.autoRotate = next;
      }
      return next;
    });
  };

  useEffect(() => {
    const controls = getOrbitControls();
    if (controls) {
      controls.autoRotate = cameraAutoRotate;
    }
  }, [cameraAutoRotate, getOrbitControls]);

  // Camera Smooth Transition Animation Helper (matching Studio4D4 viewport feel)
  const cameraTransitionIdRef = useRef(null);

  const transitionCamera = useCallback((toPos, toTarget, duration = 350) => {
    if (cameraTransitionIdRef.current) {
      cancelAnimationFrame(cameraTransitionIdRef.current);
      cameraTransitionIdRef.current = null;
    }

    const camera = getThreeCamera();
    const controls = getOrbitControls();
    if (!camera) return;

    if (!controls) {
      camera.position.copy(toPos);
      if (toTarget) camera.lookAt(toTarget);
      camera.updateMatrixWorld();
      return;
    }

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const targetEnd = toTarget ? toTarget.clone() : startTarget.clone();
    const startTime = performance.now();

    const animateTransition = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, toPos, ease);
      controls.target.lerpVectors(startTarget, targetEnd, ease);
      camera.lookAt(controls.target);
      controls.update();

      if (progress < 1.0) {
        cameraTransitionIdRef.current = requestAnimationFrame(animateTransition);
      } else {
        cameraTransitionIdRef.current = null;
      }
    };

    cameraTransitionIdRef.current = requestAnimationFrame(animateTransition);
  }, [getThreeCamera, getOrbitControls]);

  useEffect(() => {
    return () => {
      if (cameraTransitionIdRef.current) {
        cancelAnimationFrame(cameraTransitionIdRef.current);
      }
    };
  }, []);

  // Video Layer & Local Asset Testing States
  const [videoMode, setVideoMode] = useState('webgl'); // 'webgl' | 'youtube'
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9'); // '16:9' | '9:16' | '21:9'
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [videoTargetMesh, setVideoTargetMesh] = useState('auto'); // 'auto' | 'all' | mesh name/uuid
  const [videoFlipX, setVideoFlipX] = useState(false); // Mirror horizontal orientation
  const [videoScale, setVideoScale] = useState(1.0);
  const [videoOffsetX, setVideoOffsetX] = useState(0.0);
  const [videoOffsetY, setVideoOffsetY] = useState(0.0);
  const [videoOffsetZ, setVideoOffsetZ] = useState(0.0);
  const [videoRotation, setVideoRotation] = useState(0);
  const [videoTextureRepeatX, setVideoTextureRepeatX] = useState(1.0);
  const [videoTextureRepeatY, setVideoTextureRepeatY] = useState(1.0);
  const [videoTextureOffsetX, setVideoTextureOffsetX] = useState(0.0);
  const [videoTextureOffsetY, setVideoTextureOffsetY] = useState(0.0);
  const [localGlbUrl, setLocalGlbUrl] = useState('');
  const [localGlbName, setLocalGlbName] = useState('');
  const [localVideoName, setLocalVideoName] = useState('');
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [selectedGlbFile, setSelectedGlbFile] = useState(null);

  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isLaunchingAR, setIsLaunchingAR] = useState(false);

  // Camera Target Tracking & Precision States (MindAR)
  const [trackingFilterMinCF, setTrackingFilterMinCF] = useState(0.0005);
  const [trackingFilterBeta, setTrackingFilterBeta] = useState(0.01);
  const [trackingMissTolerance, setTrackingMissTolerance] = useState(6);
  const [trackingWarmupTolerance, setTrackingWarmupTolerance] = useState(2);
  const [trackingMaxTrack, setTrackingMaxTrack] = useState(1);
  const [trackingTargetIndex, setTrackingTargetIndex] = useState(0);
  const [trackingShowStats, setTrackingShowStats] = useState(false);
  const [trackingUiLoading, setTrackingUiLoading] = useState('no');
  const [trackingUiScanning, setTrackingUiScanning] = useState('no');
  const [trackingUiError, setTrackingUiError] = useState('yes');
  const [trackingScope, setTrackingScope] = useState('batch'); // 'batch' | 'global'
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingSuccessMsg, setTrackingSuccessMsg] = useState('');
  const [activeTrackingPreset, setActiveTrackingPreset] = useState('balanced');

  const applyTrackingPreset = (presetKey) => {
    setActiveTrackingPreset(presetKey);
    if (presetKey === 'balanced') {
      setTrackingFilterMinCF(0.0005);
      setTrackingFilterBeta(0.01);
      setTrackingMissTolerance(6);
      setTrackingWarmupTolerance(2);
      setTrackingMaxTrack(1);
    } else if (presetKey === 'smooth') {
      setTrackingFilterMinCF(0.0001);
      setTrackingFilterBeta(0.005);
      setTrackingMissTolerance(8);
      setTrackingWarmupTolerance(3);
      setTrackingMaxTrack(1);
    } else if (presetKey === 'fast') {
      setTrackingFilterMinCF(0.005);
      setTrackingFilterBeta(0.1);
      setTrackingMissTolerance(4);
      setTrackingWarmupTolerance(1);
      setTrackingMaxTrack(1);
    } else if (presetKey === 'resilient') {
      setTrackingFilterMinCF(0.0005);
      setTrackingFilterBeta(0.01);
      setTrackingMissTolerance(14);
      setTrackingWarmupTolerance(2);
      setTrackingMaxTrack(1);
    }
  };

  // =========================================================================
  // AR PORTAL & VIRTUAL WINDOW CONFIGURATION STATES
  // =========================================================================
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalPreset, setPortalPreset] = useState('cosmic-nebula');
  const [portalShape, setPortalShape] = useState('arch'); // 'arch' | 'rectangle' | 'circle' | 'hexagon'
  const [portalWidth, setPortalWidth] = useState(1.1);
  const [portalHeight, setPortalHeight] = useState(1.8);
  const [portalRadius, setPortalRadius] = useState(0.7);
  const [portalDepth, setPortalDepth] = useState(3.5);

  // Portal Frame & Window Trim
  const [portalFrameColor, setPortalFrameColor] = useState('#38bdf8');
  const [portalFrameWidth, setPortalFrameWidth] = useState(0.08);
  const [portalFrameEmissive, setPortalFrameEmissive] = useState('#0284c7');
  const [portalFrameEmissiveIntensity, setPortalFrameEmissiveIntensity] = useState(1.5);
  const [portalFrameGlow, setPortalFrameGlow] = useState(true);
  const [portalGlassTint, setPortalGlassTint] = useState('#38bdf8');
  const [portalGlassOpacity, setPortalGlassOpacity] = useState(0.05);

  // Portal 3D Transform (Placement & Orientation)
  const [portalPosX, setPortalPosX] = useState(0.0);
  const [portalPosY, setPortalPosY] = useState(0.0);
  const [portalPosZ, setPortalPosZ] = useState(0.0);
  const [portalRotX, setPortalRotX] = useState(0);
  const [portalRotY, setPortalRotY] = useState(0);
  const [portalRotZ, setPortalRotZ] = useState(0);

  // Portal Interior Environment (What goes inside the virtual window)
  const [portalInteriorType, setPortalInteriorType] = useState('nebula'); // 'nebula' | 'starfield' | 'grid-room' | 'matrix' | 'skybox' | 'void'
  const [portalSkyboxUrl, setPortalSkyboxUrl] = useState('');
  const [portalSkyboxScale, setPortalSkyboxScale] = useState(1.0);
  const [portalSkyboxPosX, setPortalSkyboxPosX] = useState(0.0);
  const [portalSkyboxPosY, setPortalSkyboxPosY] = useState(0.0);
  const [portalSkyboxPosZ, setPortalSkyboxPosZ] = useState(0.0);
  const [portalSkyboxRotX, setPortalSkyboxRotX] = useState(0);
  const [portalSkyboxRotY, setPortalSkyboxRotY] = useState(0);
  const [portalSkyboxRotZ, setPortalSkyboxRotZ] = useState(0);
  const [portalSkyboxBlur, setPortalSkyboxBlur] = useState(0);
  const [portalInteriorColor, setPortalInteriorColor] = useState('#050714');
  const [portalWallColor, setPortalWallColor] = useState('#0f172a');
  const [portalFloorColor, setPortalFloorColor] = useState('#020617');
  const [portalGridColor, setPortalGridColor] = useState('#38bdf8');
  const [portalLightColor, setPortalLightColor] = useState('#e0f2fe');
  const [portalLightIntensity, setPortalLightIntensity] = useState(2.0);

  // Portal Interior 3D Object / Content
  const [portalModelType, setPortalModelType] = useState('artifact'); // 'artifact' | 'current-product' | 'custom-glb' | 'none'
  const [portalArtifactType, setPortalArtifactType] = useState('crystal'); // 'crystal' | 'cyber-core' | 'star-emblem' | 'pedestal'
  const [portalCustomModelUrl, setPortalCustomModelUrl] = useState('');
  const [portalModelScale, setPortalModelScale] = useState(0.4);
  const [portalModelPosX, setPortalModelPosX] = useState(0.0);
  const [portalModelPosY, setPortalModelPosY] = useState(0.0);
  const [portalModelPosZ, setPortalModelPosZ] = useState(-1.3);
  const [portalModelRotSpeed, setPortalModelRotSpeed] = useState(6000);
  const [portalModelRotX, setPortalModelRotX] = useState(0);
  const [portalModelRotY, setPortalModelRotY] = useState(0);
  const [portalModelRotZ, setPortalModelRotZ] = useState(0);

  // Portal Interior Floating Video Screen
  const [portalShowVideo, setPortalShowVideo] = useState(false);
  const [portalVideoUrl, setPortalVideoUrl] = useState('');
  const [portalVideoScale, setPortalVideoScale] = useState(1.0);
  const [portalVideoPosY, setPortalVideoPosY] = useState(0.0);
  const [portalVideoPosZ, setPortalVideoPosZ] = useState(-1.8);

  // Portal Interior Particle FX
  const [portalParticles, setPortalParticles] = useState('stars'); // 'stars' | 'embers' | 'cyber' | 'none'
  const [portalParticleCount, setPortalParticleCount] = useState(180);
  const [portalParticleColor, setPortalParticleColor] = useState('#38bdf8');
  const [portalParticleSpeed, setPortalParticleSpeed] = useState(1.0);

  // Portal Floating 3D Text Banner
  const [portalFloatingText, setPortalFloatingText] = useState('STAR weAR');
  const [portalTextColor, setPortalTextColor] = useState('#38bdf8');
  const [portalTextScale, setPortalTextScale] = useState(1.0);
  const [portalTextPosY, setPortalTextPosY] = useState(0.65);
  const [portalTextPosZ, setPortalTextPosZ] = useState(-1.2);

  // Base Outside Model Visibility
  const [portalHideOutsideModel, setPortalHideOutsideModel] = useState(false);

  // Standalone AR Scene Particle System
  const [particleSystemEnabled, setParticleSystemEnabled] = useState(false);
  const [particlePreset, setParticlePreset] = useState('cosmic-stardust');
  const [particleCount, setParticleCount] = useState(300);
  const [particleSize, setParticleSize] = useState(0.04);
  const [particleColor, setParticleColor] = useState('#38bdf8');
  const [particleColorSecondary, setParticleColorSecondary] = useState('#c084fc');
  const [particleOpacity, setParticleOpacity] = useState(0.85);
  const [particleBlending, setParticleBlending] = useState('additive');
  const [particleSpeed, setParticleSpeed] = useState(1.0);
  const [particleSpreadX, setParticleSpreadX] = useState(3.0);
  const [particleSpreadY, setParticleSpreadY] = useState(3.0);
  const [particleSpreadZ, setParticleSpreadZ] = useState(3.0);
  const [particleDirection, setParticleDirection] = useState('float');
  const [particleShape, setParticleShape] = useState('sparkle');
  const [particlePosX, setParticlePosX] = useState(0.0);
  const [particlePosY, setParticlePosY] = useState(0.0);
  const [particlePosZ, setParticlePosZ] = useState(0.0);
  const [particleRotationSpeed, setParticleRotationSpeed] = useState(0.2);
  const [particleTwinkle, setParticleTwinkle] = useState(true);

  const applyParticlePreset = (presetKey) => {
    const p = PARTICLE_PRESETS[presetKey];
    if (!p) return;
    setParticlePreset(presetKey);
    if (p.count !== undefined) setParticleCount(p.count);
    if (p.size !== undefined) setParticleSize(p.size);
    if (p.color !== undefined) setParticleColor(p.color);
    if (p.colorSecondary !== undefined) setParticleColorSecondary(p.colorSecondary);
    if (p.opacity !== undefined) setParticleOpacity(p.opacity);
    if (p.blending !== undefined) setParticleBlending(p.blending);
    if (p.speed !== undefined) setParticleSpeed(p.speed);
    if (p.spreadX !== undefined) setParticleSpreadX(p.spreadX);
    if (p.spreadY !== undefined) setParticleSpreadY(p.spreadY);
    if (p.spreadZ !== undefined) setParticleSpreadZ(p.spreadZ);
    if (p.direction !== undefined) setParticleDirection(p.direction);
    if (p.shape !== undefined) setParticleShape(p.shape);
    if (p.rotationSpeed !== undefined) setParticleRotationSpeed(p.rotationSpeed);
    if (p.twinkle !== undefined) setParticleTwinkle(p.twinkle);
  };

  // =========================================================================
  // LIVE WEBSITE LAYER CONFIGURATION STATES
  // =========================================================================
  const [websiteEnabled, setWebsiteEnabled] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('https://starwear.app');
  const [websiteWidth, setWebsiteWidth] = useState(1.2);
  const [websiteHeight, setWebsiteHeight] = useState(0.675);
  const [websiteAspectRatio, setWebsiteAspectRatio] = useState('16:9'); // '16:9' | '4:3' | '1:1' | '9:16' | '21:9' | 'custom'
  const [websiteResolution, setWebsiteResolution] = useState('1280x720'); // '1280x720' | '1920x1080' | '1024x768' | '720x1280' | '800x800'
  const [websiteInteractive, setWebsiteInteractive] = useState(true);
  const [websiteOpacity, setWebsiteOpacity] = useState(1.0);
  const [websiteFrameStyle, setWebsiteFrameStyle] = useState('cyber_bezel'); // 'cyber_bezel' | 'obsidian' | 'minimal_glass' | 'frameless'
  const [websiteFrameColor, setWebsiteFrameColor] = useState('#6366f1');
  const [websiteFrameGlow, setWebsiteFrameGlow] = useState(true);
  const [websiteCurved, setWebsiteCurved] = useState(false);
  const [websiteCurveRadius, setWebsiteCurveRadius] = useState(3.0);
  const [websiteBillboard, setWebsiteBillboard] = useState(false);
  const [websitePosX, setWebsitePosX] = useState(0.0);
  const [websitePosY, setWebsitePosY] = useState(0.8);
  const [websitePosZ, setWebsitePosZ] = useState(0.05);
  const [websiteRotX, setWebsiteRotX] = useState(0);
  const [websiteRotY, setWebsiteRotY] = useState(0);
  const [websiteRotZ, setWebsiteRotZ] = useState(0);
  const [websiteScale, setWebsiteScale] = useState(1.0);
  const [websiteShowAddressBar, setWebsiteShowAddressBar] = useState(true);

  const applyWebsiteAspectRatio = (ar) => {
    setWebsiteAspectRatio(ar);
    if (ar === '16:9') {
      setWebsiteHeight(Number((websiteWidth * (9 / 16)).toFixed(4)));
      setWebsiteResolution('1280x720');
    } else if (ar === '4:3') {
      setWebsiteHeight(Number((websiteWidth * (3 / 4)).toFixed(4)));
      setWebsiteResolution('1024x768');
    } else if (ar === '1:1') {
      setWebsiteHeight(websiteWidth);
      setWebsiteResolution('800x800');
    } else if (ar === '9:16') {
      setWebsiteHeight(Number((websiteWidth * (16 / 9)).toFixed(4)));
      setWebsiteResolution('720x1280');
    } else if (ar === '21:9') {
      setWebsiteHeight(Number((websiteWidth * (9 / 21)).toFixed(4)));
      setWebsiteResolution('1680x720');
    }
  };

  // =========================================================================
  // EXTERNAL 3D MODELS STATES & HANDLERS (.glb / .gltf from file, URL, or presets)
  // =========================================================================
  const [customModels, setCustomModels] = useState([]);
  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState(false);

  const handleAddCustomModel = (payload) => {
    setCustomModels((prev) => [...prev, payload]);
    selectSceneObject('customModel', payload.id);
    setActiveTab('hierarchy');
    setSaveSuccessMsg(`Added external 3D model "${payload.name}" to scene.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleUpdateCustomModel = (id, updates) => {
    setCustomModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleDeleteCustomModel = (id) => {
    setCustomModels((prev) => prev.filter((m) => m.id !== id));
    setSceneGroups((prev) =>
      prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !(it.type === 'customModel' && it.id === id))
      }))
    );
    setSelectedObjects((prev) => prev.filter((it) => !(it.type === 'customModel' && it.id === id)));
    if (selectedCustomModelId === id) {
      selectSceneObject(null);
    }
  };

  const handleDuplicateCustomModel = (id) => {
    const target = customModels.find((m) => m.id === id);
    if (!target) return;
    const newId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const dup = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      posX: Number(((target.posX || 0) + 0.35).toFixed(2)),
      posZ: Number(((target.posZ || 0) + 0.35).toFixed(2))
    };
    setCustomModels((prev) => [...prev, dup]);
    selectSceneObject('customModel', newId);
  };

  const handleToggleCustomModelVisibility = (id) => {
    setCustomModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, visible: m.visible === false ? true : false } : m))
    );
  };

  const handleSetRootModelFromModal = ({ url, file, name, scale, posX, posY, posZ }) => {
    if (url) {
      setLocalGlbUrl(url);
      setLocalGlbName(name || file?.name || 'External Model');
      if (file) setSelectedGlbFile(file);
      if (scale) setModelScale(scale);
      if (posX !== undefined) setModelPosX(posX);
      if (posY !== undefined) setModelPosY(posY);
      if (posZ !== undefined) setModelPosZ(posZ);
      selectSceneObject('model');
      setSaveSuccessMsg(`Set "${name || 'External Model'}" as primary scene 3D model.`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  // Helper to append/update cache-busting timestamp to prevent browser & A-Frame from caching 3D GLB assets
  const withCacheBuster = (url, timestamp) => {
    if (!url) return '';
    const token = timestamp || Date.now();
    const sep = url.includes('?') ? '&' : '?';
    if (/([?&])_t=\d+/.test(url)) {
      return url.replace(/([?&])_t=\d+/, `$1_t=${token}`);
    }
    return `${url}${sep}_t=${token}`;
  };

  // Detect if a 3D Model Template is being edited from URL parameter (?templateId=...)
  useEffect(() => {
    let isMounted = true;
    const detectTemplateParam = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const templateId = urlParams.get('templateId') || urlParams.get('template');
        if (!templateId) return;

        // 1. Server-First: Check Firestore directly so we ALWAYS get the latest edited version
        let targetTemplate = null;
        try {
          const snap = await getDocFromServer(doc(db, 'model_templates', templateId));
          if (snap.exists()) {
            targetTemplate = { id: snap.id, ...snap.data(), source: 'uploaded' };
          }
        } catch {
          try {
            const snap = await getDoc(doc(db, 'model_templates', templateId));
            if (snap.exists()) {
              targetTemplate = { id: snap.id, ...snap.data(), source: 'uploaded' };
            }
          } catch (e) {
            console.warn('[ARTest] Firestore template fetch warning:', e);
          }
        }

        // 2. Fallback: fetch from catalog bucket
        if (!targetTemplate) {
          const all = await fetchTemplatesFromBucket();
          targetTemplate = all.find((t) => t.id === templateId);
        }

        // 3. Last fallback: sessionStorage cache
        if (!targetTemplate) {
          try {
            const cached = sessionStorage.getItem('starwear_edit_template');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.id === templateId) {
                targetTemplate = parsed;
              }
            }
          } catch (e) {
            console.warn('[ARTest] Could not parse sessionStorage template:', e);
          }
        }

        if (targetTemplate && isMounted) {
          setEditingTemplate(targetTemplate);
          if (targetTemplate.url) {
            const ts = targetTemplate.updatedAt ? new Date(targetTemplate.updatedAt).getTime() : Date.now();
            const bustedUrl = withCacheBuster(targetTemplate.url, ts);
            setLocalGlbUrl(bustedUrl);
            setLocalGlbName(targetTemplate.cleanName || targetTemplate.name || targetTemplate.filename || 'Template Model');
            setSelectedGlbFile(null);
            setModelPosX(0);
            setModelPosY(0);
            setModelPosZ(0);
            setModelScale(1);
            setModelRotX(0);
            setModelRotY(0);
            setModelRotZ(0);
            selectSceneObject('model');
          }
          try {
            sessionStorage.setItem('starwear_edit_template', JSON.stringify(targetTemplate));
          } catch (e) {
            console.warn(e);
          }
          setSaveSuccessMsg(`Editing Model Template: "${targetTemplate.cleanName || targetTemplate.name}".`);
          setTimeout(() => setSaveSuccessMsg(''), 5000);
        }
      } catch (err) {
        console.error('[ARTest] Failed to load model template for editing:', err);
      }
    };

    detectTemplateParam();
    return () => {
      isMounted = false;
    };
  }, [selectSceneObject]);

  // =========================================================================
  // ADDITIONAL 3D PRIMITIVE GEOMETRIES STATES & HANDLERS (Studio4D4 parity)
  // =========================================================================
  const [additionalGeometries, setAdditionalGeometries] = useState([]);
  const [geometryModalOpen, setGeometryModalOpen] = useState(false);
  const [vectorPenModalOpen, setVectorPenModalOpen] = useState(false);
  const [faceSketchStudioOpen, setFaceSketchStudioOpen] = useState(false);
  const [editingVectorGeom, setEditingVectorGeom] = useState(null);
  const [vectorPenInitialMode, setVectorPenInitialMode] = useState('extrude');

  const handleAddGeometry = (payload) => {
    const count = additionalGeometries.length;
    const newId = `geom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const type = payload.type || 'box';
    const cleanTypeName = type === 'vectorInflate' ? 'Inflated Vector' : (type === 'vectorExtrude' ? 'Vector Extrude' : (type.charAt(0).toUpperCase() + type.slice(1)));
    const geomName = payload.name || `${cleanTypeName} ${count + 1}`;
    const newGeom = {
      id: newId,
      name: geomName,
      type,
      params: { ...(payload.params || {}) },
      color: payload.color || '#38bdf8',
      preset: payload.preset || 'default',
      roughness: payload.roughness !== undefined ? Number(payload.roughness) : 0.35,
      metalness: payload.metalness !== undefined ? Number(payload.metalness) : 0.15,
      emissive: payload.emissive || '#000000',
      emissiveIntensity: payload.emissiveIntensity !== undefined ? Number(payload.emissiveIntensity) : 0,
      wireframe: Boolean(payload.wireframe),
      flatShading: Boolean(payload.flatShading),
      posX: payload.posX !== undefined ? Number(payload.posX) : Number(((count % 4 - 1.5) * 0.45).toFixed(2)),
      posY: payload.posY !== undefined ? Number(payload.posY) : 0.35,
      posZ: payload.posZ !== undefined ? Number(payload.posZ) : Number(((Math.floor(count / 4) - 0.5) * 0.45).toFixed(2)),
      rotX: payload.rotX !== undefined ? Number(payload.rotX) : 0,
      rotY: payload.rotY !== undefined ? Number(payload.rotY) : 0,
      rotZ: payload.rotZ !== undefined ? Number(payload.rotZ) : 0,
      scale: payload.scale !== undefined ? Number(payload.scale) : 1,
      scaleX: payload.scaleX !== undefined ? Number(payload.scaleX) : 1,
      scaleY: payload.scaleY !== undefined ? Number(payload.scaleY) : 1,
      scaleZ: payload.scaleZ !== undefined ? Number(payload.scaleZ) : 1,
      rotationSpeed: 0,
      visible: true
    };
    setAdditionalGeometries((prev) => [...prev, newGeom]);
    selectSceneObject('geometry', newId);
    setActiveTab('shapes');
    setGeometryModalOpen(false);
    setSaveSuccessMsg(`Added 3D ${cleanTypeName} to scene.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleCommitVectorExtrude = (payload) => {
    if (editingVectorGeom) {
      handleUpdateGeometry(editingVectorGeom.id, {
        name: payload.name || editingVectorGeom.name,
        type: payload.type || editingVectorGeom.type,
        params: {
          ...(editingVectorGeom.params || {}),
          ...payload.params
        },
        color: payload.color || editingVectorGeom.color,
        roughness: payload.roughness !== undefined ? payload.roughness : editingVectorGeom.roughness,
        metalness: payload.metalness !== undefined ? payload.metalness : editingVectorGeom.metalness,
        emissive: payload.emissive !== undefined ? payload.emissive : editingVectorGeom.emissive,
        emissiveIntensity: payload.emissiveIntensity !== undefined ? payload.emissiveIntensity : editingVectorGeom.emissiveIntensity,
        wireframe: payload.wireframe !== undefined ? payload.wireframe : editingVectorGeom.wireframe,
        flatShading: payload.flatShading !== undefined ? payload.flatShading : editingVectorGeom.flatShading,
        preset: payload.preset || editingVectorGeom.preset
      });
      setSaveSuccessMsg(`Updated 3D Shape: ${payload.name || editingVectorGeom.name}`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      setEditingVectorGeom(null);
      setVectorPenModalOpen(false);
      setVectorPenInitialMode('extrude');
    } else {
      handleAddGeometry(payload);
      setVectorPenModalOpen(false);
    }
  };

  const handleUpdateGeometry = (id, updates) => {
    setAdditionalGeometries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  };

  const handleUpdateGeometryParam = (id, paramKey, val) => {
    setAdditionalGeometries((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        return {
          ...g,
          params: {
            ...(g.params || {}),
            [paramKey]: val
          }
        };
      })
    );
  };

  const handleDeleteGeometry = (id) => {
    setAdditionalGeometries((prev) => prev.filter((g) => g.id !== id));
    setSceneGroups((prev) =>
      prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !(it.type === 'geometry' && it.id === id))
      }))
    );
    setSelectedObjects((prev) => prev.filter((it) => !(it.type === 'geometry' && it.id === id)));
    if (selectedGeometryId === id) {
      selectSceneObject(null);
    }
  };

  const handleDuplicateGeometry = (id) => {
    const target = additionalGeometries.find((g) => g.id === id);
    if (!target) return;
    const newId = `geom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const dup = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      posX: Number((target.posX + 0.3).toFixed(2)),
      posZ: Number((target.posZ + 0.3).toFixed(2))
    };
    setAdditionalGeometries((prev) => [...prev, dup]);
    selectSceneObject('geometry', newId);
  };

  const handleToggleGeometryVisibility = (id) => {
    setAdditionalGeometries((prev) =>
      prev.map((g) => (g.id === id ? { ...g, visible: g.visible === false ? true : false } : g))
    );
  };

  const handleApplyGeometryPreset = (id, presetId) => {
    const preset = Array.isArray(MATERIAL_PRESETS)
      ? MATERIAL_PRESETS.find((m) => m.id === presetId) || MATERIAL_PRESETS[presetId]
      : MATERIAL_PRESETS[presetId];
    if (!preset) return;
    handleUpdateGeometry(id, {
      preset: preset.id || presetId,
      roughness: preset.roughness !== undefined ? preset.roughness : 0.35,
      metalness: preset.metalness !== undefined ? preset.metalness : 0.15,
      clearcoat: preset.clearcoat !== undefined ? preset.clearcoat : 0.0,
      wireframe: !!preset.wireframe,
      flatShading: !!preset.flatShading
    });
  };

  // =========================================================================
  // 3D TYPOGRAPHY TEXT STATES & HANDLERS
  // =========================================================================
  const [custom3DTexts, setCustom3DTexts] = useState([]);
  const [isAddTextModalOpen, setIsAddTextModalOpen] = useState(false);

  const handleAdd3DText = (payload) => {
    const count = custom3DTexts.length;
    const newId = payload.id || `text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newText = {
      id: newId,
      name: payload.name || payload.text || `3D Text ${count + 1}`,
      text: payload.text || 'STAR weAR',
      fontFamily: payload.fontFamily || 'helvetiker_bold',
      size: payload.size !== undefined ? Number(payload.size) : 0.35,
      depth: payload.depth !== undefined ? Number(payload.depth) : 0.08,
      curveSegments: payload.curveSegments || 12,
      bevelEnabled: payload.bevelEnabled !== false,
      bevelThickness: payload.bevelThickness !== undefined ? Number(payload.bevelThickness) : 0.015,
      bevelSize: payload.bevelSize !== undefined ? Number(payload.bevelSize) : 0.01,
      align: payload.align || 'center',
      color: payload.color || '#38bdf8',
      emissive: payload.emissive || '#0284c7',
      emissiveIntensity: payload.emissiveIntensity !== undefined ? Number(payload.emissiveIntensity) : 0.4,
      metalness: payload.metalness !== undefined ? Number(payload.metalness) : 0.75,
      roughness: payload.roughness !== undefined ? Number(payload.roughness) : 0.25,
      wireframe: Boolean(payload.wireframe),
      posX: payload.posX !== undefined ? Number(payload.posX) : 0,
      posY: payload.posY !== undefined ? Number(payload.posY) : 0.6,
      posZ: payload.posZ !== undefined ? Number(payload.posZ) : 0.05,
      rotX: payload.rotX !== undefined ? Number(payload.rotX) : 0,
      rotY: payload.rotY !== undefined ? Number(payload.rotY) : 0,
      rotZ: payload.rotZ !== undefined ? Number(payload.rotZ) : 0,
      scale: payload.scale !== undefined ? Number(payload.scale) : 1.0,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      rotationSpeed: payload.rotationSpeed || 0,
      bobbingSpeed: payload.bobbingSpeed || 0,
      bobbingHeight: payload.bobbingHeight || 0,
      visible: true
    };
    setCustom3DTexts((prev) => [...prev, newText]);
    selectSceneObject('text3d', newId);
    setActiveTab('text3d');
    setIsAddTextModalOpen(false);
    setSaveSuccessMsg(`Added 3D Text "${newText.text}" to scene.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleUpdate3DText = (id, updates) => {
    setCustom3DTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleDelete3DText = (id) => {
    setCustom3DTexts((prev) => prev.filter((t) => t.id !== id));
    setSceneGroups((prev) =>
      prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !(it.type === 'text3d' && it.id === id))
      }))
    );
    setSelectedObjects((prev) => prev.filter((it) => !(it.type === 'text3d' && it.id === id)));
    if (selectedText3DId === id) {
      selectSceneObject(null);
    }
  };

  const handleDuplicate3DText = (id) => {
    const target = custom3DTexts.find((t) => t.id === id);
    if (!target) return;
    const newId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const dup = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      posX: Number((target.posX + 0.2).toFixed(2)),
      posY: Number((target.posY + 0.15).toFixed(2))
    };
    setCustom3DTexts((prev) => [...prev, dup]);
    selectSceneObject('text3d', newId);
  };

  const handleToggle3DTextVisibility = (id) => {
    setCustom3DTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: t.visible === false ? true : false } : t))
    );
  };

  const snapTextToMarkerAnchor = (id, anchorId) => {
    const halfW = markerWidth / 2;
    const markerH = markerWidth * (markerAspectRatio || 0.5926);
    const halfH = markerH / 2;
    let targetX = 0;
    let targetY = 0;

    switch (anchorId) {
      case 'TL': targetX = -halfW * 0.75; targetY = halfH * 0.8; break;
      case 'TC': targetX = 0; targetY = halfH * 0.85; break;
      case 'TR': targetX = halfW * 0.75; targetY = halfH * 0.8; break;
      case 'CL': targetX = -halfW * 0.75; targetY = 0; break;
      case 'CC': targetX = 0; targetY = 0; break;
      case 'CR': targetX = halfW * 0.75; targetY = 0; break;
      case 'BL': targetX = -halfW * 0.75; targetY = -halfH * 0.8; break;
      case 'BC': targetX = 0; targetY = -halfH * 0.85; break;
      case 'BR': targetX = halfW * 0.75; targetY = -halfH * 0.8; break;
      default: break;
    }
    handleUpdate3DText(id, {
      posX: Number(targetX.toFixed(3)),
      posY: Number(targetY.toFixed(3)),
      posZ: 0.04
    });
  };

  // =========================================================================
  // CUSTOM MULTI-SOURCE LIGHTING HANDLERS & PRESETS
  // =========================================================================
  const handleAddLight = (type = 'point') => {
    const count = customLights.length;
    const newId = `light_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const cleanType = type.charAt(0).toUpperCase() + type.slice(1);
    const newLight = {
      id: newId,
      name: `${cleanType} Light ${count + 1}`,
      type: type, // 'point' | 'spot' | 'directional' | 'hemisphere'
      color: type === 'spot' ? '#ffffff' : (count % 2 === 0 ? '#38bdf8' : '#f59e0b'),
      groundColor: '#1e293b',
      intensity: type === 'spot' ? 3.5 : 2.5,
      distance: 25,
      decay: 2,
      angle: 45,
      penumbra: 0.35,
      posX: Number(((count % 2 === 0 ? 1 : -1) * 1.5).toFixed(2)),
      posY: 2.2,
      posZ: 1.8,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      visible: true,
      showHelper: true,
      showBulb: true,
      bulbIntensity: 3.0,
      bulbSize: 0.06,
      castShadow: false
    };
    setCustomLights((prev) => [...prev, newLight]);
    selectSceneObject('light', newId);
    setActiveTab('lighting');
    setSaveSuccessMsg(`Added ${cleanType} light source to scene.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleUpdateLight = (id, updates) => {
    setCustomLights((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const handleDeleteLight = (id) => {
    setCustomLights((prev) => prev.filter((l) => l.id !== id));
    setSceneGroups((prev) =>
      prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !(it.type === 'light' && it.id === id))
      }))
    );
    setSelectedObjects((prev) => prev.filter((it) => !(it.type === 'light' && it.id === id)));
    if (selectedLightId === id) {
      selectSceneObject(null);
    }
  };

  const handleDuplicateLight = (id) => {
    const target = customLights.find((l) => l.id === id);
    if (!target) return;
    const newId = `light_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const dup = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      posX: Number((target.posX + 0.4).toFixed(2)),
      posZ: Number((target.posZ + 0.4).toFixed(2))
    };
    setCustomLights((prev) => [...prev, dup]);
    selectSceneObject('light', newId);
  };

  const handleToggleLightVisibility = (id) => {
    setCustomLights((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: l.visible === false ? true : false } : l))
    );
  };

  const applyLightingRigPreset = (presetName) => {
    if (presetName === 'cyberpunk_dual') {
      const l1 = {
        id: `light_cyber_cyan_${Date.now()}`,
        name: 'Neon Cyber Cyan (Left)',
        type: 'point',
        color: '#06b6d4',
        intensity: 3.5,
        distance: 20,
        decay: 1.8,
        posX: -1.8,
        posY: 1.5,
        posZ: 1.2,
        visible: true,
        showHelper: true,
        showBulb: true,
        bulbIntensity: 3.5,
        bulbSize: 0.06
      };
      const l2 = {
        id: `light_cyber_magenta_${Date.now() + 1}`,
        name: 'Neon Cyber Magenta (Right)',
        type: 'point',
        color: '#ec4899',
        intensity: 3.5,
        distance: 20,
        decay: 1.8,
        posX: 1.8,
        posY: 1.5,
        posZ: 1.2,
        visible: true,
        showHelper: true,
        showBulb: true,
        bulbIntensity: 3.5,
        bulbSize: 0.06
      };
      setCustomLights((prev) => [...prev, l1, l2]);
      selectSceneObject('light', l1.id);
      setActiveTab('lighting');
    } else if (presetName === 'stage_spotlight') {
      const spot = {
        id: `light_stage_spot_${Date.now()}`,
        name: 'Dramatic Center Spotlight',
        type: 'spot',
        color: '#ffffff',
        intensity: 5.0,
        distance: 30,
        decay: 1.5,
        angle: 35,
        penumbra: 0.4,
        posX: 0,
        posY: 3.5,
        posZ: 1.5,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        visible: true,
        showHelper: true,
        showBulb: true,
        bulbIntensity: 3.0,
        bulbSize: 0.06
      };
      setCustomLights((prev) => [...prev, spot]);
      selectSceneObject('light', spot.id);
      setActiveTab('lighting');
    } else if (presetName === 'warm_golden') {
      const sun = {
        id: `light_golden_${Date.now()}`,
        name: 'Warm Sunset Key',
        type: 'directional',
        color: '#f59e0b',
        intensity: 3.0,
        posX: 2.5,
        posY: 3.0,
        posZ: 2.0,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        visible: true,
        showHelper: true,
        showBulb: true,
        bulbIntensity: 2.5,
        bulbSize: 0.06
      };
      setCustomLights((prev) => [...prev, sun]);
      selectSceneObject('light', sun.id);
      setActiveTab('lighting');
    }
  };

  const snapLightToMarker = (id) => {
    handleUpdateLight(id, {
      posX: 0,
      posY: Number((markerWidth * (markerAspectRatio || 0.5926) * 0.6).toFixed(2)),
      posZ: 1.5
    });
  };

  // =========================================================================
  // TRANSFORM CONTROLS GIZMO STATE & MANAGER
  // =========================================================================
  const [gizmoMode, setGizmoMode] = useState('translate'); // 'translate' | 'rotate' | 'scale'
  const [gizmoSpace, setGizmoSpace] = useState('world'); // 'world' | 'local'
  const [gizmoSnap, setGizmoSnap] = useState(null); // null | 0.1 | 0.5
  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const [gizmoReady, setGizmoReady] = useState(false);

  // Helper: Find Three.js Object3D by item type and id
  const findThreeObject = useCallback((type, id) => {
    if (!id) return null;
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.object3D) return null;

    if (type === 'geometry') {
      const geomAnchor = document.getElementById('ar-additional-geometries-anchor');
      const root = geomAnchor?.getObject3D('additionalGeometriesRoot') || geomAnchor?.object3D;
      if (root) {
        let found = null;
        root.traverse((node) => {
          if (!found && node.userData?.geometryId === id) found = node;
        });
        if (found) return found;
      }
    } else if (type === 'text3d') {
      const textAnchor = document.getElementById('ar-3d-texts-anchor');
      const root = textAnchor?.getObject3D('texts3DRoot') || textAnchor?.object3D;
      if (root) {
        let found = null;
        root.traverse((node) => {
          if (!found && node.userData?.textId === id) found = node;
        });
        if (found) return found;
      }
    } else if (type === 'customModel') {
      const customModelsAnchor = document.getElementById('ar-custom-models-anchor');
      const root = customModelsAnchor?.getObject3D('customModelsRoot') || customModelsAnchor?.object3D;
      if (root) {
        const wrapper = root.children?.find((c) => c.userData?.modelId === id);
        if (wrapper) return wrapper;
        let found = null;
        root.traverse((node) => {
          if (!found && node.userData?.modelId === id && node.userData?.isCustomModel && node.isGroup) {
            found = node;
          }
        });
        if (found) return found;
      }
    } else if (type === 'light') {
      const lightsAnchor = document.getElementById('ar-custom-lights-anchor');
      const root = lightsAnchor?.getObject3D('lightsRoot') || lightsAnchor?.object3D;
      if (root) {
        let found = null;
        root.traverse((node) => {
          if (!found && node.userData?.lightId === id) {
            found = node.userData.lightRef || node;
          }
        });
        if (found) return found;
      }
    } else if (type === 'mesh') {
      const modelEl = document.getElementById('ar-model');
      const model3D = modelEl?.getObject3D('mesh');
      if (model3D) {
        let found = null;
        model3D.traverse((node) => {
          if (!found && node.uuid === id && node.isMesh) found = node;
        });
        if (found) return found;
      }
    } else if (type === 'model') {
      const modelEl = document.getElementById('ar-model');
      return modelEl?.getObject3D('mesh') || modelEl?.object3D || null;
    }
    return null;
  }, []);

  // Export any scene shape, extruded vector, 3D text, model, submesh, multi-selection, or group as a standard binary .GLB file
  const handleExportShapeAsGLB = useCallback(async (targetParam = null) => {
    try {
      const exporter = new GLTFExporter();
      let targetMesh = null;
      let exportFileName = 'model';

      // Normalize target parameter
      let targetType = null;
      let targetId = null;

      if (typeof targetParam === 'string') {
        // String ID passed: check sceneGroups, additionalGeometries, customModels, custom3DTexts
        if (sceneGroups.some((g) => g.id === targetParam)) {
          targetType = 'group';
          targetId = targetParam;
        } else if (additionalGeometries.some((g) => g.id === targetParam)) {
          targetType = 'geometry';
          targetId = targetParam;
        } else if (customModels.some((m) => m.id === targetParam)) {
          targetType = 'customModel';
          targetId = targetParam;
        } else if (custom3DTexts.some((t) => t.id === targetParam)) {
          targetType = 'text3d';
          targetId = targetParam;
        } else if (meshList.some((m) => m.uuid === targetParam)) {
          targetType = 'mesh';
          targetId = targetParam;
        } else {
          targetId = targetParam;
        }
      } else if (targetParam && typeof targetParam === 'object') {
        targetType = targetParam.type;
        targetId = targetParam.id;
      }

      // If no explicit target provided, resolve from currently selected object/group
      if (!targetType && !targetId) {
        if (selectedTargetType === 'group' && selectedGroupId) {
          targetType = 'group';
          targetId = selectedGroupId;
        } else if (selectedTargetType === 'multi' || selectedObjects.length > 1) {
          targetType = 'multi';
        } else if (selectedGeometryId) {
          targetType = 'geometry';
          targetId = selectedGeometryId;
        } else if (selectedCustomModelId) {
          targetType = 'customModel';
          targetId = selectedCustomModelId;
        } else if (selectedText3DId) {
          targetType = 'text3d';
          targetId = selectedText3DId;
        } else if (selectedMeshUuid) {
          targetType = 'mesh';
          targetId = selectedMeshUuid;
        } else if (selectedTargetType === 'model') {
          targetType = 'model';
          targetId = 'root-model';
        }
      }

      // CASE 1: GROUP EXPORT
      if (targetType === 'group' && targetId) {
        const group = sceneGroups.find((g) => g.id === targetId);
        if (!group) {
          alert('Group not found to export.');
          return;
        }
        if (!group.itemIds || group.itemIds.length === 0) {
          alert(`Group "${group.name}" does not contain any objects to export.`);
          return;
        }

        const exportContainer = new THREE.Group();
        exportContainer.name = (group.name || 'group').replace(/[^a-zA-Z0-9_-]/g, '_');
        let validMeshCount = 0;

        for (const item of group.itemIds) {
          if (item.type === 'light') continue; // Skip non-mesh light sources
          let cloned = null;
          const liveObj = findThreeObject(item.type, item.id);

          if (item.type === 'geometry') {
            const geomConfig = additionalGeometries.find((g) => g.id === item.id);
            if (geomConfig) {
              cloned = createPrimitiveMesh(geomConfig, THREE);
              if (liveObj) {
                liveObj.updateWorldMatrix(true, true);
                liveObj.matrixWorld.decompose(cloned.position, cloned.quaternion, cloned.scale);
              } else {
                cloned.position.set(geomConfig.posX || 0, geomConfig.posY || 0, geomConfig.posZ || 0);
                cloned.rotation.set(
                  THREE.MathUtils.degToRad(geomConfig.rotX || 0),
                  THREE.MathUtils.degToRad(geomConfig.rotY || 0),
                  THREE.MathUtils.degToRad(geomConfig.rotZ || 0)
                );
                cloned.scale.set(
                  geomConfig.scaleX ?? geomConfig.scale ?? 1,
                  geomConfig.scaleY ?? geomConfig.scale ?? 1,
                  geomConfig.scaleZ ?? geomConfig.scale ?? 1
                );
              }
            }
          } else if (liveObj) {
            liveObj.updateWorldMatrix(true, true);
            cloned = liveObj.clone(true);
            const toRemove = [];
            cloned.traverse((c) => {
              if (c.name && /helper|picker|gizmo|__starwear/i.test(c.name)) {
                toRemove.push(c);
              }
            });
            toRemove.forEach((c) => c.parent && c.parent.remove(c));
            cloned.position.set(0, 0, 0);
            cloned.quaternion.set(0, 0, 0, 1);
            cloned.scale.set(1, 1, 1);
            liveObj.matrixWorld.decompose(cloned.position, cloned.quaternion, cloned.scale);
          }

          if (cloned) {
            cloned.name = (item.name || cloned.name || `${item.type}_${item.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            exportContainer.add(cloned);
            validMeshCount++;
          }
        }

        if (validMeshCount === 0) {
          alert(`No 3D meshes found in group "${group.name}" to export.`);
          return;
        }

        // Center group children relative to group bounding box center for clean asset export
        exportContainer.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(exportContainer);
        if (!box.isEmpty()) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          exportContainer.children.forEach((child) => {
            child.position.sub(center);
          });
          exportContainer.updateMatrixWorld(true);
        }

        targetMesh = exportContainer;
        exportFileName = (group.name || 'group')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
      }

      // CASE 2: MULTI-SELECTION EXPORT
      else if (targetType === 'multi' && selectedObjects.length > 0) {
        const exportContainer = new THREE.Group();
        exportContainer.name = `selection_${selectedObjects.length}_objects`;
        let validMeshCount = 0;

        for (const item of selectedObjects) {
          if (item.type === 'light') continue;
          let cloned = null;
          const liveObj = findThreeObject(item.type, item.id);

          if (item.type === 'geometry') {
            const geomConfig = additionalGeometries.find((g) => g.id === item.id);
            if (geomConfig) {
              cloned = createPrimitiveMesh(geomConfig, THREE);
              if (liveObj) {
                liveObj.updateWorldMatrix(true, true);
                liveObj.matrixWorld.decompose(cloned.position, cloned.quaternion, cloned.scale);
              } else {
                cloned.position.set(geomConfig.posX || 0, geomConfig.posY || 0, geomConfig.posZ || 0);
                cloned.rotation.set(
                  THREE.MathUtils.degToRad(geomConfig.rotX || 0),
                  THREE.MathUtils.degToRad(geomConfig.rotY || 0),
                  THREE.MathUtils.degToRad(geomConfig.rotZ || 0)
                );
                cloned.scale.set(
                  geomConfig.scaleX ?? geomConfig.scale ?? 1,
                  geomConfig.scaleY ?? geomConfig.scale ?? 1,
                  geomConfig.scaleZ ?? geomConfig.scale ?? 1
                );
              }
            }
          } else if (liveObj) {
            liveObj.updateWorldMatrix(true, true);
            cloned = liveObj.clone(true);
            const toRemove = [];
            cloned.traverse((c) => {
              if (c.name && /helper|picker|gizmo|__starwear/i.test(c.name)) {
                toRemove.push(c);
              }
            });
            toRemove.forEach((c) => c.parent && c.parent.remove(c));
            cloned.position.set(0, 0, 0);
            cloned.quaternion.set(0, 0, 0, 1);
            cloned.scale.set(1, 1, 1);
            liveObj.matrixWorld.decompose(cloned.position, cloned.quaternion, cloned.scale);
          }

          if (cloned) {
            cloned.name = (item.name || cloned.name || `${item.type}_${item.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            exportContainer.add(cloned);
            validMeshCount++;
          }
        }

        if (validMeshCount === 0) {
          alert('No 3D meshes found in current selection to export.');
          return;
        }

        exportContainer.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(exportContainer);
        if (!box.isEmpty()) {
          const center = new THREE.Vector3();
          box.getCenter(center);
          exportContainer.children.forEach((child) => {
            child.position.sub(center);
          });
          exportContainer.updateMatrixWorld(true);
        }

        targetMesh = exportContainer;
        exportFileName = `selection_${selectedObjects.length}_objects`;
      }

      // CASE 3: INDIVIDUAL GEOMETRY SHAPE
      else if (targetType === 'geometry' || (!targetType && targetId)) {
        const geomConfig = additionalGeometries.find((g) => g.id === (targetId || selectedGeometryId));
        if (geomConfig) {
          exportFileName = (geomConfig.name || geomConfig.type || 'shape')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');
          targetMesh = createPrimitiveMesh(geomConfig, THREE);
          targetMesh.position.set(0, 0, 0);
          targetMesh.updateMatrixWorld(true);
        }
      }

      // CASE 4: SUBMESH INSIDE PRIMARY MODEL
      if (!targetMesh && (targetType === 'mesh' || selectedMeshUuid)) {
        const meshId = targetId || selectedMeshUuid;
        const modelEl = document.getElementById('ar-model');
        const model3D = modelEl?.getObject3D('mesh');
        if (model3D) {
          model3D.traverse((node) => {
            if (node.uuid === meshId && node.isMesh) {
              targetMesh = node.clone();
              targetMesh.position.set(0, 0, 0);
              targetMesh.updateMatrixWorld(true);
              exportFileName = (node.name || 'submesh')
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_');
            }
          });
        }
      }

      // CASE 5: 3D TYPOGRAPHY TEXT
      if (!targetMesh && (targetType === 'text3d' || selectedText3DId)) {
        const textId = targetId || selectedText3DId;
        const textAnchor = document.getElementById('ar-3d-texts-anchor');
        const root = textAnchor?.getObject3D('texts3DRoot') || textAnchor?.object3D;
        if (root) {
          root.traverse((node) => {
            if (node.userData?.textId === textId) {
              targetMesh = node.clone();
              targetMesh.position.set(0, 0, 0);
              targetMesh.updateMatrixWorld(true);
              exportFileName = (node.userData?.text || '3d_text')
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_');
            }
          });
        }
      }

      // CASE 6: EXTERNAL 3D MODEL
      if (!targetMesh && (targetType === 'customModel' || selectedCustomModelId)) {
        const modelId = targetId || selectedCustomModelId;
        const customModelsAnchor = document.getElementById('ar-custom-models-anchor');
        const root = customModelsAnchor?.getObject3D('customModelsRoot') || customModelsAnchor?.object3D;
        if (root) {
          root.traverse((node) => {
            if (node.userData?.modelId === modelId && node.userData?.isCustomModel && node.isGroup) {
              targetMesh = node.clone();
              targetMesh.position.set(0, 0, 0);
              targetMesh.updateMatrixWorld(true);
              exportFileName = (node.userData?.name || 'custom_model')
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_');
            }
          });
        }
      }

      // CASE 7: PRIMARY ROOT MODEL
      if (!targetMesh && targetType === 'model') {
        const modelEl = document.getElementById('ar-model');
        const model3D = modelEl?.getObject3D('mesh');
        if (model3D) {
          targetMesh = model3D.clone();
          targetMesh.position.set(0, 0, 0);
          targetMesh.updateMatrixWorld(true);
          exportFileName = 'primary_model';
        }
      }

      // FALLBACK: FIRST GEOMETRY IN SCENE
      if (!targetMesh && additionalGeometries.length > 0) {
        const firstGeom = additionalGeometries[0];
        targetMesh = createPrimitiveMesh(firstGeom, THREE);
        targetMesh.position.set(0, 0, 0);
        targetMesh.updateMatrixWorld(true);
        exportFileName = (firstGeom.name || firstGeom.type || 'shape')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
      }

      if (!targetMesh) {
        alert('Please select an object or group in the scene to export as .GLB.');
        return;
      }

      const exportScene = new THREE.Scene();
      exportScene.add(targetMesh);
      sanitizeHierarchyForGLTFExport(exportScene, THREE);

      exporter.parse(
        exportScene,
        (result) => {
          try {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `${exportFileName}.glb`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            setSaveSuccessMsg(`Exported ${exportFileName}.glb successfully`);
            setTimeout(() => setSaveSuccessMsg(''), 4000);
          } catch (err) {
            console.error('[ARTest] Failed to create or download GLB blob:', err);
            alert('Failed to download exported GLB: ' + err.message);
          }
        },
        (error) => {
          console.error('[ARTest] GLTFExporter error:', error);
          alert('Error exporting .GLB: ' + (error?.message || error));
        },
        { binary: true, embedImages: true }
      );
    } catch (err) {
      console.error('[ARTest] Could not initialize GLTFExporter:', err);
      alert('Could not export to .GLB: ' + err.message);
    }
  }, [
    selectedGeometryId,
    selectedMeshUuid,
    selectedText3DId,
    selectedCustomModelId,
    selectedGroupId,
    selectedTargetType,
    selectedObjects,
    additionalGeometries,
    customModels,
    custom3DTexts,
    sceneGroups,
    meshList,
    findThreeObject
  ]);

  const handleGizmoObjectChange = useCallback((obj) => {
    if (!obj) return;

    // A) 3D Typography Text
    if (obj.userData?.is3DText || obj.userData?.textId) {
      const textId = obj.userData.textId;
      setCustom3DTexts((prev) =>
        prev.map((t) => {
          if (t.id === textId) {
            return {
              ...t,
              posX: Number(obj.position.x.toFixed(3)),
              posY: Number(obj.position.y.toFixed(3)),
              posZ: Number(obj.position.z.toFixed(3)),
              rotX: Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
              rotY: Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
              rotZ: Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
              scale: Number(obj.scale.x.toFixed(3)),
              scaleX: Number(obj.scale.x.toFixed(3)),
              scaleY: Number(obj.scale.y.toFixed(3)),
              scaleZ: Number(obj.scale.z.toFixed(3))
            };
          }
          return t;
        })
      );
      return;
    }

    // B) Custom Light Source
    if (obj.userData?.isCustomLight || obj.userData?.lightId) {
      const lightId = obj.userData.lightId;
      setCustomLights((prev) =>
        prev.map((l) => {
          if (l.id === lightId) {
            return {
              ...l,
              posX: Number(obj.position.x.toFixed(3)),
              posY: Number(obj.position.y.toFixed(3)),
              posZ: Number(obj.position.z.toFixed(3))
            };
          }
          return l;
        })
      );
      return;
    }

    // C) Additional 3D Geometry
    if (obj.userData?.isAdditionalGeometry || obj.userData?.geometryId) {
      const geomId = obj.userData.geometryId;
      setAdditionalGeometries((prev) =>
        prev.map((g) => {
          if (g.id === geomId) {
            return {
              ...g,
              posX: Number(obj.position.x.toFixed(3)),
              posY: Number(obj.position.y.toFixed(3)),
              posZ: Number(obj.position.z.toFixed(3)),
              rotX: Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
              rotY: Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
              rotZ: Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
              scale: Number(obj.scale.x.toFixed(3)),
              scaleX: Number(obj.scale.x.toFixed(3)),
              scaleY: Number(obj.scale.y.toFixed(3)),
              scaleZ: Number(obj.scale.z.toFixed(3))
            };
          }
          return g;
        })
      );
      return;
    }

    // C.5) External Custom 3D Model
    if (obj.userData?.isCustomModel || obj.userData?.modelId) {
      const modelId = obj.userData.modelId;
      setCustomModels((prev) =>
        prev.map((m) => {
          if (m.id === modelId) {
            return {
              ...m,
              posX: Number(obj.position.x.toFixed(3)),
              posY: Number(obj.position.y.toFixed(3)),
              posZ: Number(obj.position.z.toFixed(3)),
              rotX: Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
              rotY: Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
              rotZ: Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)),
              scale: Number(obj.scale.x.toFixed(3)),
              scaleX: Number(obj.scale.x.toFixed(3)),
              scaleY: Number(obj.scale.y.toFixed(3)),
              scaleZ: Number(obj.scale.z.toFixed(3))
            };
          }
          return m;
        })
      );
      return;
    }

    // D) Root 3D Model
    const modelEl = document.getElementById('ar-model');
    if (obj === modelEl?.object3D || obj === modelEl?.getObject3D('mesh')) {
      setModelPosX(Number(obj.position.x.toFixed(3)));
      setModelPosY(Number(obj.position.y.toFixed(3)));
      setModelPosZ(Number(obj.position.z.toFixed(3)));
      setModelRotX(Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)));
      setModelRotY(Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)));
      setModelRotZ(Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)));
      setModelScale(Number(obj.scale.x.toFixed(3)));
      return;
    }

    // E) Submesh inside model
    if (obj.isMesh && obj.uuid) {
      setMeshList((prev) =>
        prev.map((m) => {
          if (m.uuid === obj.uuid) {
            return {
              ...m,
              position: {
                x: Number(obj.position.x.toFixed(3)),
                y: Number(obj.position.y.toFixed(3)),
                z: Number(obj.position.z.toFixed(3))
              },
              rotation: {
                x: Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)),
                y: Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)),
                z: Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1))
              },
              scale: {
                x: Number(obj.scale.x.toFixed(3)),
                y: Number(obj.scale.y.toFixed(3)),
                z: Number(obj.scale.z.toFixed(3))
              }
            };
          }
          return m;
        })
      );
    }
  }, []);

  // Compute centroid / average world position of an array of objects
  const computeObjectsCentroid = useCallback((items) => {
    const center = new THREE.Vector3(0, 0, 0);
    let count = 0;
    if (!items || items.length === 0) return center;
    items.forEach((item) => {
      const obj = findThreeObject(item.type, item.id);
      if (obj) {
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) {
          const itemCenter = new THREE.Vector3();
          box.getCenter(itemCenter);
          center.add(itemCenter);
          count++;
        } else {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          center.add(worldPos);
          count++;
        }
      }
    });
    if (count > 0) center.divideScalar(count);
    return center;
  }, [findThreeObject]);

  // Sync a single object's Three.js transform to its React state array
  const syncObjectTransformFromThree = useCallback((type, id, obj) => {
    if (!obj) return;
    const px = Number(obj.position.x.toFixed(3));
    const py = Number(obj.position.y.toFixed(3));
    const pz = Number(obj.position.z.toFixed(3));
    const rx = Number(THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1));
    const ry = Number(THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1));
    const rz = Number(THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1));
    const sx = Number(obj.scale.x.toFixed(3));
    const sy = Number(obj.scale.y.toFixed(3));
    const sz = Number(obj.scale.z.toFixed(3));

    if (type === 'geometry') {
      setAdditionalGeometries((prev) =>
        prev.map((g) => (g.id === id ? { ...g, posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz } : g))
      );
    } else if (type === 'text3d') {
      setCustom3DTexts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz } : t))
      );
    } else if (type === 'customModel') {
      setCustomModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz } : m))
      );
    } else if (type === 'light') {
      setCustomLights((prev) =>
        prev.map((l) => (l.id === id ? { ...l, posX: px, posY: py, posZ: pz } : l))
      );
    } else if (type === 'mesh') {
      setMeshList((prev) =>
        prev.map((m) => (m.uuid === id ? { ...m, position: { x: px, y: py, z: pz }, rotation: { x: rx, y: ry, z: rz }, scale: { x: sx, y: sy, z: sz } } : m))
      );
    }
  }, []);

  // Handler: Import image texture and map onto a 3D shape
  const handleShapeTextureUpload = useCallback(async (geomId, file) => {
    if (!file || !geomId) return;
    try {
      setShapeTextureUploadingId(geomId);
      const previewUrl = URL.createObjectURL(file);
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      let finalUrl = previewUrl;
      let storagePath = '';

      const bId = (batchId || '').trim();
      if (bId) {
        setUploadProgress(`Uploading texture ${file.name} to Cloud Storage...`);
        storagePath = `assets/${bId}/textures/shapes/${geomId}_${Date.now()}_${cleanFileName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        finalUrl = await getDownloadURL(storageRef);
        setUploadProgress(null);
      } else {
        pendingShapeTexturesRef.current.set(geomId, { file, previewUrl });
      }

      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

      handleUpdateGeometry(geomId, {
        textureUrl: finalUrl,
        texturePreviewUrl: previewUrl,
        textureFileName: file.name,
        textureStoragePath: storagePath,
        textureRepeatX: 1,
        textureRepeatY: 1,
        textureOffsetX: 0,
        textureOffsetY: 0,
        textureRotation: 0,
        textureFlipX: false,
        textureFlipY: false,
        color: '#ffffff',
        opacity: 1.0,
        transparent: isPng
      });

      // Instantly update live Three.js mesh in scene if mounted
      const liveObj = findThreeObject('geometry', geomId);
      if (liveObj && liveObj.isMesh) {
        const loader = new THREE.TextureLoader();
        loader.load(finalUrl, (tex) => {
          if (THREE.SRGBColorSpace !== undefined) {
            tex.colorSpace = THREE.SRGBColorSpace;
          }
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          if (tex.center) tex.center.set(0.5, 0.5);
          tex.needsUpdate = true;
          if (liveObj.material) {
            liveObj.material.map = tex;
            if (liveObj.material.color) liveObj.material.color.set(0xffffff);
            if (isPng) {
              liveObj.material.transparent = true;
            }
            liveObj.material.needsUpdate = true;
          }
        });
      }

      setSaveSuccessMsg(`Applied texture "${file.name}" to shape.`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('[ARTest] Failed to import shape texture:', err);
      alert('Failed to import texture: ' + (err?.message || err));
      setUploadProgress(null);
    } finally {
      setShapeTextureUploadingId(null);
    }
  }, [batchId, findThreeObject]);

  // Handler: Remove texture map from shape and reset surface
  const handleRemoveShapeTexture = useCallback((geomId) => {
    if (!geomId) return;
    pendingShapeTexturesRef.current.delete(geomId);
    handleUpdateGeometry(geomId, {
      textureUrl: null,
      texturePreviewUrl: null,
      textureFileName: null,
      textureStoragePath: null,
      textureRepeatX: 1,
      textureRepeatY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
      textureRotation: 0,
      textureFlipX: false,
      textureFlipY: false,
      color: '#38bdf8'
    });

    const liveObj = findThreeObject('geometry', geomId);
    if (liveObj && liveObj.isMesh && liveObj.material) {
      if (liveObj.material.map) {
        try { liveObj.material.map.dispose(); } catch {}
        liveObj.material.map = null;
      }
      if (liveObj.material.color) liveObj.material.color.set('#38bdf8');
      liveObj.material.needsUpdate = true;
    }
    setSaveSuccessMsg('Removed texture from shape.');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  }, [findThreeObject]);

  // Handler: Apply quick built-in vector pattern texture to shape
  const handleApplyShapeTexturePreset = useCallback((geomId, preset) => {
    if (!geomId || !preset) return;
    pendingShapeTexturesRef.current.delete(geomId);
    handleUpdateGeometry(geomId, {
      textureUrl: preset.url,
      texturePreviewUrl: preset.url,
      textureFileName: preset.name,
      textureStoragePath: null,
      textureRepeatX: preset.repeat || 1,
      textureRepeatY: preset.repeat || 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
      textureRotation: 0,
      textureFlipX: false,
      textureFlipY: false,
      color: '#ffffff',
      opacity: 1.0,
      transparent: false
    });

    const liveObj = findThreeObject('geometry', geomId);
    if (liveObj && liveObj.isMesh) {
      const loader = new THREE.TextureLoader();
      loader.load(preset.url, (tex) => {
        if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        if (tex.center) tex.center.set(0.5, 0.5);
        if (preset.repeat) tex.repeat.set(preset.repeat, preset.repeat);
        tex.needsUpdate = true;
        if (liveObj.material) {
          liveObj.material.map = tex;
          if (liveObj.material.color) liveObj.material.color.set(0xffffff);
          liveObj.material.needsUpdate = true;
        }
      });
    }

    setSaveSuccessMsg(`Applied "${preset.name}" pattern texture.`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  }, [findThreeObject]);

  // Batch commit member transforms from Three.js nodes to React states
  const commitMemberTransformsToState = useCallback((members) => {
    if (!members || members.length === 0) return;

    const geomUpdates = new Map();
    const textUpdates = new Map();
    const modelUpdates = new Map();
    const lightUpdates = new Map();
    const meshUpdates = new Map();

    members.forEach((m) => {
      if (!m.obj3d) return;
      const px = Number(m.obj3d.position.x.toFixed(3));
      const py = Number(m.obj3d.position.y.toFixed(3));
      const pz = Number(m.obj3d.position.z.toFixed(3));
      const rx = Number(THREE.MathUtils.radToDeg(m.obj3d.rotation.x).toFixed(1));
      const ry = Number(THREE.MathUtils.radToDeg(m.obj3d.rotation.y).toFixed(1));
      const rz = Number(THREE.MathUtils.radToDeg(m.obj3d.rotation.z).toFixed(1));
      const sx = Number(m.obj3d.scale.x.toFixed(3));
      const sy = Number(m.obj3d.scale.y.toFixed(3));
      const sz = Number(m.obj3d.scale.z.toFixed(3));

      if (m.type === 'geometry') {
        geomUpdates.set(m.id, { posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz });
      } else if (m.type === 'text3d') {
        textUpdates.set(m.id, { posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz });
      } else if (m.type === 'customModel') {
        modelUpdates.set(m.id, { posX: px, posY: py, posZ: pz, rotX: rx, rotY: ry, rotZ: rz, scale: sx, scaleX: sx, scaleY: sy, scaleZ: sz });
      } else if (m.type === 'light') {
        lightUpdates.set(m.id, { posX: px, posY: py, posZ: pz });
      } else if (m.type === 'mesh') {
        meshUpdates.set(m.id, { position: { x: px, y: py, z: pz }, rotation: { x: rx, y: ry, z: rz }, scale: { x: sx, y: sy, z: sz } });
      }
    });

    if (geomUpdates.size > 0) {
      setAdditionalGeometries((prev) =>
        prev.map((g) => (geomUpdates.has(g.id) ? { ...g, ...geomUpdates.get(g.id) } : g))
      );
    }
    if (textUpdates.size > 0) {
      setCustom3DTexts((prev) =>
        prev.map((t) => (textUpdates.has(t.id) ? { ...t, ...textUpdates.get(t.id) } : t))
      );
    }
    if (modelUpdates.size > 0) {
      setCustomModels((prev) =>
        prev.map((m) => (modelUpdates.has(m.id) ? { ...m, ...modelUpdates.get(m.id) } : m))
      );
    }
    if (lightUpdates.size > 0) {
      setCustomLights((prev) =>
        prev.map((l) => (lightUpdates.has(l.id) ? { ...l, ...lightUpdates.get(l.id) } : l))
      );
    }
    if (meshUpdates.size > 0) {
      setMeshList((prev) =>
        prev.map((m) => (meshUpdates.has(m.uuid) ? { ...m, ...meshUpdates.get(m.uuid) } : m))
      );
    }
  }, []);

  // Update Group Transform via Delta Matrices (both group & its members move, rotate, and scale synchronously)
  const handleUpdateGroupTransform = useCallback((groupId, updates) => {
    setSceneGroups((prev) => {
      const grp = prev.find((g) => g.id === groupId);
      if (!grp) return prev;

      const oldPos = new THREE.Vector3(grp.posX || 0, grp.posY || 0, grp.posZ || 0);
      const oldEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(grp.rotX || 0),
        THREE.MathUtils.degToRad(grp.rotY || 0),
        THREE.MathUtils.degToRad(grp.rotZ || 0)
      );
      const oldScale = new THREE.Vector3(
        grp.scaleX ?? grp.scale ?? 1,
        grp.scaleY ?? grp.scale ?? 1,
        grp.scaleZ ?? grp.scale ?? 1
      );
      const oldMatrix = new THREE.Matrix4().compose(oldPos, new THREE.Quaternion().setFromEuler(oldEuler), oldScale);
      const invOldMatrix = new THREE.Matrix4().copy(oldMatrix).invert();

      const newPosX = updates.posX !== undefined ? Number(updates.posX) : grp.posX || 0;
      const newPosY = updates.posY !== undefined ? Number(updates.posY) : grp.posY || 0;
      const newPosZ = updates.posZ !== undefined ? Number(updates.posZ) : grp.posZ || 0;
      const newRotX = updates.rotX !== undefined ? Number(updates.rotX) : grp.rotX || 0;
      const newRotY = updates.rotY !== undefined ? Number(updates.rotY) : grp.rotY || 0;
      const newRotZ = updates.rotZ !== undefined ? Number(updates.rotZ) : grp.rotZ || 0;
      const newScaleX = updates.scaleX !== undefined ? Number(updates.scaleX) : (updates.scale !== undefined ? Number(updates.scale) : (grp.scaleX ?? grp.scale ?? 1));
      const newScaleY = updates.scaleY !== undefined ? Number(updates.scaleY) : (updates.scale !== undefined ? Number(updates.scale) : (grp.scaleY ?? grp.scale ?? 1));
      const newScaleZ = updates.scaleZ !== undefined ? Number(updates.scaleZ) : (updates.scale !== undefined ? Number(updates.scale) : (grp.scaleZ ?? grp.scale ?? 1));

      const newPos = new THREE.Vector3(newPosX, newPosY, newPosZ);
      const newEuler = new THREE.Euler(
        THREE.MathUtils.degToRad(newRotX),
        THREE.MathUtils.degToRad(newRotY),
        THREE.MathUtils.degToRad(newRotZ)
      );
      const newScale = new THREE.Vector3(newScaleX, newScaleY, newScaleZ);
      const newMatrix = new THREE.Matrix4().compose(newPos, new THREE.Quaternion().setFromEuler(newEuler), newScale);

      const deltaMatrix = new THREE.Matrix4().multiplyMatrices(newMatrix, invOldMatrix);

      grp.itemIds.forEach((item) => {
        const obj3d = findThreeObject(item.type, item.id);
        if (obj3d) {
          obj3d.updateMatrixWorld(true);
          const curWorld = obj3d.matrixWorld.clone();
          const targetWorld = new THREE.Matrix4().multiplyMatrices(deltaMatrix, curWorld);
          if (obj3d.parent) {
            const invParent = new THREE.Matrix4().copy(obj3d.parent.matrixWorld).invert();
            const targetLocal = new THREE.Matrix4().multiplyMatrices(invParent, targetWorld);
            targetLocal.decompose(obj3d.position, obj3d.quaternion, obj3d.scale);
          } else {
            targetWorld.decompose(obj3d.position, obj3d.quaternion, obj3d.scale);
          }
          obj3d.updateMatrixWorld(true);
          syncObjectTransformFromThree(item.type, item.id, obj3d);
        }
      });

      const sceneEl = document.querySelector('a-scene');
      const pivot = sceneEl?.object3D?.getObjectByName(`starwear-group-pivot-${groupId}`);
      if (pivot) {
        pivot.position.copy(newPos);
        pivot.rotation.copy(newEuler);
        pivot.scale.copy(newScale);
        pivot.updateMatrixWorld(true);
      }

      return prev.map((g) => (g.id === groupId ? {
        ...g,
        posX: newPosX,
        posY: newPosY,
        posZ: newPosZ,
        rotX: newRotX,
        rotY: newRotY,
        rotZ: newRotZ,
        scale: newScaleX,
        scaleX: newScaleX,
        scaleY: newScaleY,
        scaleZ: newScaleZ,
        ...updates
      } : g));
    });
  }, [findThreeObject, syncObjectTransformFromThree]);

  // Multi-Selection Toggle
  const toggleObjectSelection = useCallback((type, id) => {
    if (!type || !id) return;
    setSelectedObjects((prev) => {
      const exists = prev.some((it) => it.type === type && it.id === id);
      const updated = exists
        ? prev.filter((it) => !(it.type === type && it.id === id))
        : [...prev, { type, id }];

      if (updated.length === 0) {
        setSelectedMeshUuid(null);
        setSelectedGeometryId(null);
        setSelectedText3DId(null);
        setSelectedLightId(null);
        setSelectedCustomModelId(null);
        setSelectedGroupId(null);
        setSelectedTargetType(null);
      } else if (updated.length === 1) {
        const single = updated[0];
        setSelectedGroupId(null);
        setSelectedTargetType(single.type);
        setSelectedMeshUuid(single.type === 'mesh' ? single.id : null);
        setSelectedGeometryId(single.type === 'geometry' ? single.id : null);
        setSelectedCustomModelId(single.type === 'customModel' ? single.id : null);
        setSelectedText3DId(single.type === 'text3d' ? single.id : null);
        setSelectedLightId(single.type === 'light' ? single.id : null);
      } else {
        setSelectedMeshUuid(null);
        setSelectedGeometryId(null);
        setSelectedText3DId(null);
        setSelectedLightId(null);
        setSelectedCustomModelId(null);
        setSelectedGroupId(null);
        setSelectedTargetType('multi');
      }

      return updated;
    });
  }, []);

  const selectGroup = useCallback((groupId) => {
    selectSceneObject('group', groupId);
    setActiveTab('hierarchy');
  }, [selectSceneObject]);

  // Create an Empty Group
  const handleCreateEmptyGroup = useCallback((customName = null) => {
    const newId = `group-${Date.now()}`;
    const groupName = customName || `Group ${sceneGroups.length + 1}`;
    const newGroup = {
      id: newId,
      name: groupName,
      itemIds: [],
      posX: 0,
      posY: 0,
      posZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      visible: true,
      collapsed: false
    };
    setSceneGroups((prev) => [...prev, newGroup]);
    selectSceneObject('group', newId);
  }, [sceneGroups.length, selectSceneObject]);

  // Create New Group from currently selected objects
  const handleCreateGroupFromSelection = useCallback((customName = null) => {
    if (selectedObjects.length === 0) {
      handleCreateEmptyGroup(customName);
      return;
    }
    const centroid = computeObjectsCentroid(selectedObjects);
    const newId = `group-${Date.now()}`;
    const groupName = customName || `Group ${sceneGroups.length + 1}`;
    const newGroup = {
      id: newId,
      name: groupName,
      itemIds: [...selectedObjects],
      posX: Number(centroid.x.toFixed(3)),
      posY: Number(centroid.y.toFixed(3)),
      posZ: Number(centroid.z.toFixed(3)),
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      visible: true,
      collapsed: false
    };

    setSceneGroups((prev) => {
      const cleaned = prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !selectedObjects.some((sel) => sel.type === it.type && sel.id === it.id))
      }));
      return [...cleaned, newGroup];
    });

    selectSceneObject('group', newId);
  }, [selectedObjects, computeObjectsCentroid, sceneGroups.length, selectSceneObject, handleCreateEmptyGroup]);

  // Add Item(s) to existing Group
  const handleAddToGroup = useCallback((groupId, itemOrItems) => {
    const itemsToAdd = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (itemsToAdd.length === 0) return;

    setSceneGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const existingKeys = new Set(g.itemIds.map((it) => `${it.type}:${it.id}`));
          const newItems = itemsToAdd.filter((it) => !existingKeys.has(`${it.type}:${it.id}`));
          return {
            ...g,
            itemIds: [...g.itemIds, ...newItems]
          };
        }
        return {
          ...g,
          itemIds: g.itemIds.filter((it) => !itemsToAdd.some((addItem) => addItem.type === it.type && addItem.id === it.id))
        };
      })
    );
  }, []);

  // Remove Item from Group
  const handleRemoveFromGroup = useCallback((groupId, itemToRemove) => {
    setSceneGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            itemIds: g.itemIds.filter((it) => !(it.type === itemToRemove.type && it.id === itemToRemove.id))
          };
        }
        return g;
      })
    );
  }, []);

  // Ungroup Group container while preserving all member world transforms
  const handleUngroup = useCallback((groupId) => {
    const group = sceneGroups.find((g) => g.id === groupId);
    if (!group) return;

    const sceneEl = document.querySelector('a-scene');
    const pivot = sceneEl?.object3D?.getObjectByName(`starwear-group-pivot-${groupId}`);
    if (pivot && sceneEl?.object3D) {
      sceneEl.object3D.remove(pivot);
    }

    setSceneGroups((prev) => prev.filter((g) => g.id !== groupId));

    if (group.itemIds.length > 1) {
      setSelectedObjects([...group.itemIds]);
      setSelectedTargetType('multi');
      setSelectedGroupId(null);
    } else if (group.itemIds.length === 1) {
      const single = group.itemIds[0];
      selectSceneObject(single.type, single.id);
    } else {
      selectSceneObject(null);
    }
  }, [sceneGroups, selectSceneObject]);

  // Delete Group (and optionally its member objects)
  const handleDeleteGroup = useCallback((groupId, deleteMembers = false) => {
    const group = sceneGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (deleteMembers) {
      group.itemIds.forEach((it) => {
        if (it.type === 'geometry') handleDeleteGeometry(it.id);
        else if (it.type === 'customModel') handleDeleteCustomModel(it.id);
        else if (it.type === 'text3d') handleDelete3DText(it.id);
        else if (it.type === 'light') handleDeleteLight(it.id);
        else if (it.type === 'mesh') {
          const mesh = meshList.find((m) => m.uuid === it.id);
          if (mesh) handleDeleteMesh(mesh.uuid, mesh.name);
        }
      });
    }

    const sceneEl = document.querySelector('a-scene');
    const pivot = sceneEl?.object3D?.getObjectByName(`starwear-group-pivot-${groupId}`);
    if (pivot && sceneEl?.object3D) {
      sceneEl.object3D.remove(pivot);
    }

    setSceneGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (selectedGroupId === groupId) {
      selectSceneObject(null);
    }
  }, [sceneGroups, selectedGroupId, selectSceneObject, meshList]);

  // Duplicate Group container and clone all its constituent member objects
  const handleDuplicateGroup = useCallback((groupId) => {
    const group = sceneGroups.find((g) => g.id === groupId);
    if (!group) return;

    const offsetDistance = 0.4;
    const newGroupId = `group-${Date.now()}`;
    const duplicatedGroupTitle = `${group.name || 'Group'} (Copy)`;

    const newGeometries = [];
    const newCustomModels = [];
    const new3DTexts = [];
    const newLights = [];
    const newItemIds = [];

    (group.itemIds || []).forEach((item, index) => {
      if (item.type === 'geometry') {
        const origGeom = additionalGeometries.find((g) => g.id === item.id);
        if (origGeom) {
          const newId = `geom_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          const clonedGeom = {
            ...origGeom,
            id: newId,
            name: origGeom.name ? `${origGeom.name} (Copy)` : 'Shape (Copy)',
            posX: Number(((origGeom.posX ?? 0) + offsetDistance).toFixed(3)),
            posZ: Number(((origGeom.posZ ?? 0) + offsetDistance).toFixed(3))
          };
          newGeometries.push(clonedGeom);
          newItemIds.push({ type: 'geometry', id: newId });
        }
      } else if (item.type === 'customModel') {
        const origModel = customModels.find((m) => m.id === item.id);
        if (origModel) {
          const newId = `model_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          const clonedModel = {
            ...origModel,
            id: newId,
            name: origModel.name ? `${origModel.name} (Copy)` : 'Model (Copy)',
            posX: Number(((origModel.posX ?? 0) + offsetDistance).toFixed(3)),
            posZ: Number(((origModel.posZ ?? 0) + offsetDistance).toFixed(3))
          };
          newCustomModels.push(clonedModel);
          newItemIds.push({ type: 'customModel', id: newId });
        }
      } else if (item.type === 'text3d') {
        const origText = custom3DTexts.find((t) => t.id === item.id);
        if (origText) {
          const newId = `text_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          const clonedText = {
            ...origText,
            id: newId,
            name: origText.name ? `${origText.name} (Copy)` : '3D Text (Copy)',
            posX: Number(((origText.posX ?? 0) + offsetDistance).toFixed(3)),
            posZ: Number(((origText.posZ ?? 0) + offsetDistance).toFixed(3))
          };
          new3DTexts.push(clonedText);
          newItemIds.push({ type: 'text3d', id: newId });
        }
      } else if (item.type === 'light') {
        const origLight = customLights.find((l) => l.id === item.id);
        if (origLight) {
          const newId = `light_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          const clonedLight = {
            ...origLight,
            id: newId,
            name: origLight.name ? `${origLight.name} (Copy)` : 'Light (Copy)',
            posX: Number(((origLight.posX ?? 0) + offsetDistance).toFixed(3)),
            posZ: Number(((origLight.posZ ?? 0) + offsetDistance).toFixed(3))
          };
          newLights.push(clonedLight);
          newItemIds.push({ type: 'light', id: newId });
        }
      }
    });

    if (newGeometries.length > 0) {
      setAdditionalGeometries((prev) => [...prev, ...newGeometries]);
    }
    if (newCustomModels.length > 0) {
      setCustomModels((prev) => [...prev, ...newCustomModels]);
    }
    if (new3DTexts.length > 0) {
      setCustom3DTexts((prev) => [...prev, ...new3DTexts]);
    }
    if (newLights.length > 0) {
      setCustomLights((prev) => [...prev, ...newLights]);
    }

    const newGroup = {
      ...group,
      id: newGroupId,
      name: duplicatedGroupTitle,
      itemIds: newItemIds,
      posX: Number(((group.posX ?? 0) + offsetDistance).toFixed(3)),
      posZ: Number(((group.posZ ?? 0) + offsetDistance).toFixed(3)),
      collapsed: false
    };

    if (sceneGroupsRef?.current) {
      sceneGroupsRef.current = [...sceneGroupsRef.current, newGroup];
    }
    setSceneGroups((prev) => [...prev, newGroup]);
    setSelectedObjects(newItemIds);
    selectSceneObject('group', newGroupId);

    setSaveSuccessMsg(`Duplicated group "${group.name}" with ${newItemIds.length} object${newItemIds.length === 1 ? '' : 's'}.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  }, [
    sceneGroups,
    additionalGeometries,
    customModels,
    custom3DTexts,
    customLights,
    selectSceneObject
  ]);

  // Toggle Visibility for all members in a Group
  const handleToggleGroupVisibility = useCallback((groupId) => {
    const group = sceneGroups.find((g) => g.id === groupId);
    if (!group) return;
    const newVisibility = !(group.visible ?? true);

    setSceneGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, visible: newVisibility } : g))
    );

    group.itemIds.forEach((it) => {
      if (it.type === 'geometry') {
        setAdditionalGeometries((prev) =>
          prev.map((g) => (g.id === it.id ? { ...g, visible: newVisibility } : g))
        );
      } else if (it.type === 'customModel') {
        setCustomModels((prev) =>
          prev.map((m) => (m.id === it.id ? { ...m, visible: newVisibility } : m))
        );
      } else if (it.type === 'text3d') {
        setCustom3DTexts((prev) =>
          prev.map((t) => (t.id === it.id ? { ...t, visible: newVisibility } : t))
        );
      } else if (it.type === 'light') {
        setCustomLights((prev) =>
          prev.map((l) => (l.id === it.id ? { ...l, visible: newVisibility } : l))
        );
      } else if (it.type === 'mesh') {
        const meshNode = findThreeObject('mesh', it.id);
        if (meshNode) meshNode.visible = newVisibility;
        setMeshList((prev) =>
          prev.map((m) => (m.uuid === it.id ? { ...m, visible: newVisibility } : m))
        );
      }
    });
  }, [sceneGroups, findThreeObject]);

  // Toggle Collapse State of a Group Card in Hierarchy
  const handleToggleGroupCollapse = useCallback((groupId) => {
    setSceneGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, collapsed: !(g.collapsed ?? false) } : g))
    );
  }, []);

  // Update Group Display Name
  const handleUpdateGroupName = useCallback((groupId, name) => {
    setSceneGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
  }, []);

  const getMemberItemDetails = useCallback((item) => {
    if (!item) return { name: 'Object', icon: 'deployed_code' };
    if (item.type === 'geometry') {
      const g = additionalGeometries.find((geom) => geom.id === item.id);
      return { name: g ? g.name || g.type : '3D Shape', icon: 'deployed_code' };
    } else if (item.type === 'customModel') {
      const m = customModels.find((mod) => mod.id === item.id);
      return { name: m ? m.name : '3D Model', icon: 'view_in_ar' };
    } else if (item.type === 'text3d') {
      const t = custom3DTexts.find((txt) => txt.id === item.id);
      return { name: t ? `"${t.text}"` : '3D Text', icon: 'title' };
    } else if (item.type === 'light') {
      const l = customLights.find((lt) => lt.id === item.id);
      return { name: l ? l.name || `${l.type} Light` : 'Light', icon: 'lightbulb' };
    } else if (item.type === 'mesh') {
      const m = meshList.find((mesh) => mesh.uuid === item.id);
      return { name: m ? m.name : 'Mesh Part', icon: 'interests' };
    }
    return { name: 'Object', icon: 'deployed_code' };
  }, [additionalGeometries, customModels, custom3DTexts, customLights, meshList]);

  const getAvailableObjectsForGroup = useCallback((groupId) => {
    const grp = sceneGroups.find((g) => g.id === groupId);
    const currentKeys = new Set((grp?.itemIds || []).map((it) => `${it.type}:${it.id}`));
    const available = [];

    additionalGeometries.forEach((g) => {
      if (!currentKeys.has(`geometry:${g.id}`)) {
        available.push({ type: 'geometry', id: g.id, name: g.name || g.type, icon: 'deployed_code' });
      }
    });

    customModels.forEach((m) => {
      if (!currentKeys.has(`customModel:${m.id}`)) {
        available.push({ type: 'customModel', id: m.id, name: m.name, icon: 'view_in_ar' });
      }
    });

    custom3DTexts.forEach((t) => {
      if (!currentKeys.has(`text3d:${t.id}`)) {
        available.push({ type: 'text3d', id: t.id, name: `Text: "${t.text}"`, icon: 'title' });
      }
    });

    customLights.forEach((l) => {
      if (!currentKeys.has(`light:${l.id}`)) {
        available.push({ type: 'light', id: l.id, name: l.name || `${l.type} Light`, icon: 'lightbulb' });
      }
    });

    meshList.forEach((m) => {
      if (!currentKeys.has(`mesh:${m.uuid}`)) {
        available.push({ type: 'mesh', id: m.uuid, name: m.name, icon: 'interests' });
      }
    });

    return available;
  }, [sceneGroups, additionalGeometries, customModels, custom3DTexts, customLights, meshList]);

  const focusCameraOnSelectedObject = useCallback(() => {
    const tc = transformControlsRef.current;
    if (!tc || !tc.object) {
      transitionCamera(new THREE.Vector3(0, 1.2, 3.5), new THREE.Vector3(0, 0, 0), 350);
      return;
    }
    const targetObj = tc.object;
    targetObj.updateWorldMatrix(true, false);
    const box = new THREE.Box3();

    if (targetObj.userData?.isGroupPivot || targetObj.userData?.isMultiPivot) {
      let memberCount = 0;
      const targetItems = targetObj.userData?.isGroupPivot
        ? (sceneGroupsRef.current.find((g) => g.id === targetObj.userData.groupId)?.itemIds || [])
        : selectedObjectsRef.current;
      targetItems.forEach((it) => {
        const obj = findThreeObject(it.type, it.id);
        if (obj) {
          obj.updateWorldMatrix(true, false);
          box.expandByObject(obj);
          memberCount++;
        }
      });
      if (memberCount === 0 || box.isEmpty()) {
        box.setFromObject(targetObj);
      }
    } else {
      box.setFromObject(targetObj);
    }

    if (box.isEmpty()) {
      const p = targetObj.getWorldPosition(new THREE.Vector3());
      transitionCamera(new THREE.Vector3(p.x, p.y + 0.8, p.z + 2.0), p, 350);
      return;
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.2);
    const fov = 45 * (Math.PI / 180);
    let dist = (maxDim / 2) / Math.tan(fov / 2) * 1.6;
    dist = Math.max(0.4, Math.min(dist, 8.0));
    const camPos = new THREE.Vector3(center.x, center.y + (maxDim * 0.25), center.z + dist);
    transitionCamera(camPos, center, 350);
  }, [transitionCamera, findThreeObject]);

  const currentSelectedObjectInfo = useMemo(() => {
    if (selectedTargetType === 'group' && selectedGroupId) {
      const groupItem = sceneGroups.find((g) => g.id === selectedGroupId);
      return {
        type: 'group',
        id: selectedGroupId,
        name: groupItem ? groupItem.name : 'Group',
        icon: 'workspaces',
        itemCount: groupItem ? groupItem.itemIds.length : 0
      };
    }
    if (selectedTargetType === 'multi' || selectedObjects.length > 1) {
      return {
        type: 'multi',
        id: 'multi-selection',
        name: `${selectedObjects.length} Objects Selected`,
        icon: 'checklist',
        itemCount: selectedObjects.length
      };
    }
    if (selectedCustomModelId) {
      const modelItem = customModels.find((m) => m.id === selectedCustomModelId);
      return {
        type: 'customModel',
        id: selectedCustomModelId,
        name: modelItem ? modelItem.name : 'External 3D Model',
        icon: 'view_in_ar'
      };
    }
    if (selectedText3DId) {
      const textItem = custom3DTexts.find((t) => t.id === selectedText3DId);
      return {
        type: 'text3d',
        id: selectedText3DId,
        name: textItem ? `3D Text: "${textItem.text}"` : '3D Text',
        icon: 'title'
      };
    }
    if (selectedLightId) {
      const lightItem = customLights.find((l) => l.id === selectedLightId);
      return {
        type: 'light',
        id: selectedLightId,
        name: lightItem ? lightItem.name || `${lightItem.type} Light` : 'Custom Light',
        icon: 'lightbulb'
      };
    }
    if (selectedGeometryId) {
      const geomItem = additionalGeometries.find((g) => g.id === selectedGeometryId);
      return {
        type: 'geometry',
        id: selectedGeometryId,
        name: geomItem ? geomItem.name || geomItem.type : '3D Shape',
        icon: 'deployed_code'
      };
    }
    if (selectedMeshUuid) {
      const meshItem = meshList.find((m) => m.uuid === selectedMeshUuid);
      return {
        type: 'mesh',
        id: selectedMeshUuid,
        name: meshItem ? meshItem.name : 'Mesh Part',
        icon: 'interests'
      };
    }
    if (selectedTargetType === 'model') {
      return {
        type: 'model',
        id: 'root-model',
        name: '3D Model (Root)',
        icon: 'view_in_ar'
      };
    }
    return null;
  }, [selectedTargetType, selectedGroupId, selectedObjects, sceneGroups, selectedCustomModelId, selectedText3DId, selectedLightId, selectedGeometryId, selectedMeshUuid, customModels, custom3DTexts, customLights, additionalGeometries, meshList]);

  // Currently selected 3D object/model/shape target for Draw on Face Studio
  const selectedStudioTarget = useMemo(() => {
    if (!selectedTargetType || selectedTargetType === 'light') return null;

    let targetType = selectedTargetType;
    let targetId = null;

    if (targetType === 'geometry') {
      targetId = selectedGeometryId;
    } else if (targetType === 'mesh') {
      targetId = selectedMeshUuid;
    } else if (targetType === 'customModel') {
      targetId = selectedCustomModelId;
    } else if (targetType === 'text3d') {
      targetId = selectedText3DId;
    } else if (targetType === 'model') {
      targetId = 'root-model';
    } else if ((targetType === 'multi' || targetType === 'group') && selectedObjects.length > 0) {
      const nonLight = selectedObjects.find((o) => o.type !== 'light');
      if (nonLight) {
        targetType = nonLight.type;
        targetId = nonLight.id;
      }
    }

    if (!targetId && targetType !== 'model') return null;

    const threeObj = findThreeObject(targetType, targetId);
    if (!threeObj) return null;

    // Ensure target object actually contains renderable meshes
    let hasMesh = false;
    threeObj.traverse((c) => {
      if (c.isMesh && c.geometry) hasMesh = true;
    });
    if (!hasMesh) return null;

    return {
      type: targetType,
      id: targetId,
      name: currentSelectedObjectInfo?.name || 'Selected Object',
      threeObject: threeObj
    };
  }, [
    selectedTargetType,
    selectedGeometryId,
    selectedMeshUuid,
    selectedCustomModelId,
    selectedText3DId,
    selectedObjects,
    currentSelectedObjectInfo,
    findThreeObject
  ]);

  // Staged Local Files for Portal
  const [selectedPortalSkyboxFile, setSelectedPortalSkyboxFile] = useState(null);
  const [selectedPortalGlbFile, setSelectedPortalGlbFile] = useState(null);

  const applyPortalPreset = (presetKey) => {
    setPortalPreset(presetKey);
    const p = PORTAL_PRESETS[presetKey];
    if (!p) return;
    if (p.shape !== undefined) setPortalShape(p.shape);
    if (p.width !== undefined) setPortalWidth(p.width);
    if (p.height !== undefined) setPortalHeight(p.height);
    if (p.radius !== undefined) setPortalRadius(p.radius);
    if (p.depth !== undefined) setPortalDepth(p.depth);
    if (p.frameColor !== undefined) setPortalFrameColor(p.frameColor);
    if (p.frameWidth !== undefined) setPortalFrameWidth(p.frameWidth);
    if (p.frameEmissive !== undefined) setPortalFrameEmissive(p.frameEmissive);
    if (p.frameEmissiveIntensity !== undefined) setPortalFrameEmissiveIntensity(p.frameEmissiveIntensity);
    if (p.frameGlow !== undefined) setPortalFrameGlow(p.frameGlow);
    if (p.interiorType !== undefined) setPortalInteriorType(p.interiorType);
    if (p.skyboxUrl !== undefined) setPortalSkyboxUrl(p.skyboxUrl);
    if (p.skyboxScale !== undefined) setPortalSkyboxScale(p.skyboxScale);
    if (p.skyboxPosX !== undefined) setPortalSkyboxPosX(p.skyboxPosX);
    if (p.skyboxPosY !== undefined) setPortalSkyboxPosY(p.skyboxPosY);
    if (p.skyboxPosZ !== undefined) setPortalSkyboxPosZ(p.skyboxPosZ);
    if (p.skyboxRotX !== undefined) setPortalSkyboxRotX(p.skyboxRotX);
    if (p.skyboxRotY !== undefined) setPortalSkyboxRotY(p.skyboxRotY);
    if (p.skyboxRotZ !== undefined) setPortalSkyboxRotZ(p.skyboxRotZ);
    if (p.skyboxBlur !== undefined) setPortalSkyboxBlur(p.skyboxBlur);
    if (p.interiorColor !== undefined) setPortalInteriorColor(p.interiorColor);
    if (p.wallColor !== undefined) setPortalWallColor(p.wallColor);
    if (p.floorColor !== undefined) setPortalFloorColor(p.floorColor);
    if (p.gridColor !== undefined) setPortalGridColor(p.gridColor);
    if (p.interiorLightColor !== undefined) setPortalLightColor(p.interiorLightColor);
    if (p.interiorLightIntensity !== undefined) setPortalLightIntensity(p.interiorLightIntensity);
    if (p.interiorModelType !== undefined) setPortalModelType(p.interiorModelType);
    if (p.artifactType !== undefined) setPortalArtifactType(p.artifactType);
    if (p.modelScale !== undefined) setPortalModelScale(p.modelScale);
    if (p.modelPosX !== undefined) setPortalModelPosX(p.modelPosX);
    if (p.modelPosY !== undefined) setPortalModelPosY(p.modelPosY);
    if (p.modelPosZ !== undefined) setPortalModelPosZ(p.modelPosZ);
    if (p.modelRotSpeed !== undefined) setPortalModelRotSpeed(p.modelRotSpeed);
    if (p.showVideo !== undefined) setPortalShowVideo(p.showVideo);
    if (p.particles !== undefined) setPortalParticles(p.particles);
    if (p.particleCount !== undefined) setPortalParticleCount(p.particleCount);
    if (p.particleColor !== undefined) setPortalParticleColor(p.particleColor);
    if (p.particleSpeed !== undefined) setPortalParticleSpeed(p.particleSpeed);
    if (p.floatingText !== undefined) setPortalFloatingText(p.floatingText);
    if (p.textColor !== undefined) setPortalTextColor(p.textColor);
  };

  const handleTogglePortal = (enable) => {
    setPortalEnabled(enable);
    if (enable) {
      const hasSceneModel = Boolean(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath);
      // When an existing model is already loaded in the scene and portal is at origin, offset it behind the model as a backdrop addition
      if (hasSceneModel && portalPosX === 0 && portalPosY === 0 && portalPosZ === 0) {
        setPortalPosX(Number(modelPosX) || 0);
        setPortalPosY(Number((modelPosY + 0.1).toFixed(2)) || 0.1);
        setPortalPosZ(Number((modelPosZ - Math.max(0.6, modelScale * 0.8)).toFixed(2)) || -0.9);
        setPortalWidth(Math.max(1.1, Number((modelScale * 1.5).toFixed(2))));
        setPortalHeight(Math.max(1.8, Number((modelScale * 2.2).toFixed(2))));
      }
      setPortalHideOutsideModel(false);
    }
  };

  const handleApplyPortalPlacementPreset = (presetKey) => {
    if (!portalEnabled) setPortalEnabled(true);

    if (presetKey === 'behind') {
      setPortalHideOutsideModel(false);
      setPortalPosX(Number(modelPosX) || 0);
      setPortalPosY(Number((modelPosY + 0.1).toFixed(2)) || 0.1);
      setPortalPosZ(Number((modelPosZ - Math.max(0.6, modelScale * 0.8)).toFixed(2)) || -0.9);
      setPortalRotX(0);
      setPortalRotY(0);
      setPortalRotZ(0);
    } else if (presetKey === 'left') {
      setPortalHideOutsideModel(false);
      setPortalPosX(Number((modelPosX - Math.max(0.8, modelScale * 1.2)).toFixed(2)) || -0.95);
      setPortalPosY(Number((modelPosY + 0.05).toFixed(2)) || 0.05);
      setPortalPosZ(Number(modelPosZ) || 0.0);
      setPortalRotX(0);
      setPortalRotY(25);
      setPortalRotZ(0);
    } else if (presetKey === 'right') {
      setPortalHideOutsideModel(false);
      setPortalPosX(Number((modelPosX + Math.max(0.8, modelScale * 1.2)).toFixed(2)) || 0.95);
      setPortalPosY(Number((modelPosY + 0.05).toFixed(2)) || 0.05);
      setPortalPosZ(Number(modelPosZ) || 0.0);
      setPortalRotX(0);
      setPortalRotY(-25);
      setPortalRotZ(0);
    } else if (presetKey === 'ground') {
      setPortalHideOutsideModel(false);
      setPortalPosX(Number(modelPosX) || 0);
      setPortalPosY(Number((modelPosY - Math.max(0.4, modelScale * 0.5)).toFixed(2)) || -0.45);
      setPortalPosZ(Number(modelPosZ) || 0);
      setPortalRotX(-90);
      setPortalRotY(0);
      setPortalRotZ(0);
    } else if (presetKey === 'center') {
      setPortalHideOutsideModel(false);
      setPortalPosX(Number(modelPosX) || 0);
      setPortalPosY(Number(modelPosY) || 0);
      setPortalPosZ(Number(modelPosZ) || 0);
      setPortalRotX(0);
      setPortalRotY(0);
      setPortalRotZ(0);
    } else if (presetKey === 'inside') {
      setPortalHideOutsideModel(true);
      setPortalModelType('current-product');
      setPortalPosX(0);
      setPortalPosY(0);
      setPortalPosZ(0);
      setPortalModelPosZ(-1.3);
    }
  };

  const handleApplyPresetWithSceneCheck = (presetKey) => {
    setPortalEnabled(true);
    applyPortalPreset(presetKey);
    const hasSceneModel = Boolean(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath);
    if (hasSceneModel && portalPosZ === 0 && portalPosX === 0) {
      setPortalPosZ(-0.9);
      setPortalPosY(0.1);
    }
    setPortalHideOutsideModel(false);
  };

  // Helper: Scan and detect all individual meshes inside the 3D model
  const scanMeshes = useCallback(() => {
    const modelEl = document.getElementById('ar-model');
    if (!modelEl) return;
    const model3D = modelEl.getObject3D('mesh');
    if (!model3D) return;

    const detected = [];
    let idx = 1;

    model3D.traverse((node) => {
      if (node.isMesh) {
        if (deletedMeshNames.includes(node.name) || deletedMeshNames.includes(node.uuid)) {
          return;
        }

        // Cache pristine original material backup if not yet done
        if (!node.userData.__originalMaterialBackup && node.material) {
          if (Array.isArray(node.material)) {
            node.userData.__originalMaterialBackup = node.material.map((m) => m.clone());
          } else {
            node.userData.__originalMaterialBackup = node.material.clone();
          }
        }

        const rotDegX = Math.round((node.rotation.x * 180) / Math.PI);
        const rotDegY = Math.round((node.rotation.y * 180) / Math.PI);
        const rotDegZ = Math.round((node.rotation.z * 180) / Math.PI);

        let hexColor = '#ffffff';
        let metalness = 0;
        let roughness = 1;
        let emissive = '#000000';
        let emissiveIntensity = 0;
        let opacity = 1;
        let wireframe = false;

        if (node.material) {
          const mat = Array.isArray(node.material) ? node.material[0] : node.material;
          if (mat.color && typeof mat.color.getHexString === 'function') {
            hexColor = '#' + mat.color.getHexString();
          }
          if (mat.metalness !== undefined) metalness = mat.metalness;
          if (mat.roughness !== undefined) roughness = mat.roughness;
          if (mat.emissive && typeof mat.emissive.getHexString === 'function') {
            emissive = '#' + mat.emissive.getHexString();
          }
          if (mat.emissiveIntensity !== undefined) emissiveIntensity = mat.emissiveIntensity;
          if (mat.opacity !== undefined) opacity = mat.opacity;
          wireframe = !!mat.wireframe;
        }

        const ovr = (arData?.config?.meshOverrides && (arData.config.meshOverrides[node.name] || arData.config.meshOverrides[node.uuid])) || null;
        const customTexUrl = ovr?.material?.textureUrl || (node.userData?.__hasCustomTexture ? node.userData?.__customTextureUrl : null);
        const customStoragePath = ovr?.material?.textureStoragePath || null;
        const hasCustomTex = !!customTexUrl || !!node.userData?.__hasCustomTexture;

        let origHexColor = hexColor;
        if (node.userData.__originalMaterialBackup) {
          const origM = Array.isArray(node.userData.__originalMaterialBackup) ? node.userData.__originalMaterialBackup[0] : node.userData.__originalMaterialBackup;
          if (origM?.color && typeof origM.color.getHexString === 'function') {
            origHexColor = '#' + origM.color.getHexString();
          }
        }

        const firstMat = node.material ? (Array.isArray(node.material) ? node.material[0] : node.material) : null;
        const activeMap = firstMat ? (firstMat.map || firstMat.emissiveMap) : null;

        let initialOffsetX = ovr?.material?.textureOffsetX;
        let initialOffsetY = ovr?.material?.textureOffsetY;
        let initialRot = ovr?.material?.textureRotation;
        let initialRepX = ovr?.material?.textureRepeatX;
        let initialRepY = ovr?.material?.textureRepeatY;
        let initialFlipX = ovr?.material?.textureFlipX;
        let initialFlipY = ovr?.material?.textureFlipY;

        if (activeMap) {
          if (initialRepX === undefined && activeMap.repeat) {
            initialRepX = Math.abs(activeMap.repeat.x);
            if (initialFlipX === undefined) initialFlipX = activeMap.repeat.x < 0;
          }
          if (initialRepY === undefined && activeMap.repeat) {
            initialRepY = Math.abs(activeMap.repeat.y);
            if (initialFlipY === undefined) initialFlipY = activeMap.repeat.y < 0;
          }
          if (initialOffsetX === undefined && activeMap.offset) {
            initialOffsetX = Number(activeMap.offset.x.toFixed(3));
          }
          if (initialOffsetY === undefined && activeMap.offset) {
            initialOffsetY = Number(activeMap.offset.y.toFixed(3));
          }
          if (initialRot === undefined && activeMap.rotation !== undefined) {
            initialRot = Math.round((activeMap.rotation * 180) / Math.PI);
          }
        }

        detected.push({
          uuid: node.uuid,
          name: node.name || `Mesh_${idx}`,
          materialName: (node.material ? (Array.isArray(node.material) ? node.material[0].name : node.material.name) : '') || `Material_${idx}`,
          visible: node.visible !== false,
          position: { x: Number(node.position.x.toFixed(3)), y: Number(node.position.y.toFixed(3)), z: Number(node.position.z.toFixed(3)) },
          rotation: { x: rotDegX, y: rotDegY, z: rotDegZ },
          scale: { x: Number(node.scale.x.toFixed(2)), y: Number(node.scale.y.toFixed(2)), z: Number(node.scale.z.toFixed(2)) },
          originalColor: origHexColor,
          material: {
            color: hexColor,
            metalness,
            roughness,
            emissive,
            emissiveIntensity,
            opacity,
            wireframe,
            textureUrl: customTexUrl,
            textureStoragePath: customStoragePath,
            hasCustomTexture: hasCustomTex,
            textureFileName: ovr?.material?.textureFileName || null,
            textureOffsetX: initialOffsetX !== undefined ? Number(initialOffsetX) : 0.0,
            textureOffsetY: initialOffsetY !== undefined ? Number(initialOffsetY) : 0.0,
            textureRotation: initialRot !== undefined ? Number(initialRot) : 0.0,
            textureRepeatX: initialRepX !== undefined ? Number(initialRepX) : 1.0,
            textureRepeatY: initialRepY !== undefined ? Number(initialRepY) : 1.0,
            textureFlipX: Boolean(initialFlipX),
            textureFlipY: Boolean(initialFlipY)
          }
        });
        idx++;
      }
    });

    setMeshList(detected);
  }, [deletedMeshNames, arData]);

  // Load Global Tracking Defaults from Firestore (settings/tracking) on mount
  useEffect(() => {
    const loadGlobalTracking = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'tracking'));
        if (snap.exists()) {
          const tData = snap.data();
          if (tData.filterMinCF !== undefined) setTrackingFilterMinCF(Number(tData.filterMinCF));
          if (tData.filterBeta !== undefined) setTrackingFilterBeta(Number(tData.filterBeta));
          if (tData.missTolerance !== undefined) setTrackingMissTolerance(Number(tData.missTolerance));
          if (tData.warmupTolerance !== undefined) setTrackingWarmupTolerance(Number(tData.warmupTolerance));
          if (tData.maxTrack !== undefined) setTrackingMaxTrack(Number(tData.maxTrack));
          if (tData.targetIndex !== undefined) setTrackingTargetIndex(Number(tData.targetIndex));
          if (tData.showStats !== undefined) setTrackingShowStats(!!tData.showStats);
          if (tData.uiLoading !== undefined) setTrackingUiLoading(tData.uiLoading);
          if (tData.uiScanning !== undefined) setTrackingUiScanning(tData.uiScanning);
          if (tData.uiError !== undefined) setTrackingUiError(tData.uiError);
        }
      } catch (err) {
        console.warn('Could not load global tracking settings:', err);
      }
    };
    loadGlobalTracking();
  }, []);

  // Listen for model-loaded event on #ar-model to detect meshes automatically and apply overrides if any
  useEffect(() => {
    const modelEl = document.getElementById('ar-model');
    if (!modelEl) return;

    const handleLoaded = () => {
      const model3D = modelEl.getObject3D('mesh');
      if (model3D && arData?.config?.meshOverrides) {
        const overrides = arData.config.meshOverrides;
        const nodesToDelete = [];
        model3D.traverse((node) => {
          if (node.isMesh) {
            // Pristine backup of original material before any overrides are applied
            if (!node.userData.__originalMaterialBackup && node.material) {
              if (Array.isArray(node.material)) {
                node.userData.__originalMaterialBackup = node.material.map((m) => m.clone());
              } else {
                node.userData.__originalMaterialBackup = node.material.clone();
              }
            }

            const ovr = overrides[node.name] || overrides[node.uuid];
            if (ovr) {
              if (ovr.deleted || ovr.visible === false) {
                node.visible = false;
                if (ovr.deleted && node.parent) {
                  nodesToDelete.push(node);
                }
                return;
              }
              if (ovr.position) node.position.set(ovr.position.x, ovr.position.y, ovr.position.z);
              if (ovr.rotation) {
                node.rotation.set(
                  ((ovr.rotation.x || 0) * Math.PI) / 180,
                  ((ovr.rotation.y || 0) * Math.PI) / 180,
                  ((ovr.rotation.z || 0) * Math.PI) / 180
                );
              }
              if (ovr.scale) {
                const sx = typeof ovr.scale === 'number' ? ovr.scale : (ovr.scale.x || 1);
                node.scale.set(sx, sx, sx);
              }
              if (ovr.visible !== undefined) node.visible = !!ovr.visible;
              if (ovr.material && node.material) {
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach((m) => {
                  if (ovr.material.color && m.color) m.color.set(ovr.material.color);
                  if (ovr.material.metalness !== undefined && m.metalness !== undefined) m.metalness = ovr.material.metalness;
                  if (ovr.material.roughness !== undefined && m.roughness !== undefined) m.roughness = ovr.material.roughness;
                  if (ovr.material.emissive && m.emissive) m.emissive.set(ovr.material.emissive);
                  if (ovr.material.opacity !== undefined) {
                    m.opacity = ovr.material.opacity;
                    if (m.opacity < 1.0) m.transparent = true;
                  }
                  if (ovr.material.wireframe !== undefined) m.wireframe = !!ovr.material.wireframe;
                  m.needsUpdate = true;
                });
                if (ovr.material.textureUrl && typeof ovr.material.textureUrl === 'string' && !ovr.material.textureUrl.startsWith('blob:')) {
                  const loader = new THREE.TextureLoader();
                  loader.load(ovr.material.textureUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.flipY = false;
                    applyTextureTransform(tex, ovr.material);
                    mats.forEach((m) => {
                      m.map = tex;
                      m.needsUpdate = true;
                    });
                    node.userData.__currentCustomTexture = tex;
                    node.userData.__hasCustomTexture = true;
                    node.userData.__customTextureUrl = ovr.material.textureUrl;
                  });
                } else {
                  applyMaterialTextureTransform(node.material, ovr.material);
                }
              }
            }
          }
        });
        nodesToDelete.forEach((node) => {
          if (node.parent) {
            node.parent.remove(node);
          }
        });
      }
      scanMeshes();
      if (typeof applyFlipXToScene === 'function') {
        applyFlipXToScene(videoFlipX);
      }

      // Compute bounding box and auto-frame camera distance (matching Studio4D4 studio angle)
      if (model3D) {
        const box = new THREE.Box3().setFromObject(model3D);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const fov = 45 * (Math.PI / 180);
          let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
          cameraDistance = Math.max(cameraDistance, 1.5);

          // Studio4D4 camera perspective: elevated at ~18-20° above horizon
          const initialCamPos = new THREE.Vector3(0, maxDim * 0.35, cameraDistance);
          defaultCamPosRef.current.copy(initialCamPos);
          defaultTargetRef.current.set(0, 0, 0);

          const currentModelKey = localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || 'active-model';
          if (lastFramedModelKeyRef.current !== currentModelKey) {
            const controls = getOrbitControls();
            const camera = getThreeCamera();
            if (camera) {
              camera.position.copy(initialCamPos);
              camera.lookAt(0, 0, 0);
              camera.updateMatrixWorld();
              if (controls) {
                controls.target.set(0, 0, 0);
                controls.update();
              }
              lastFramedModelKeyRef.current = currentModelKey;
            }
          }
        }
      }
    };

    const handleError = (evt) => {
      console.error('[ARTest] #ar-model failed to load:', evt?.detail || evt);
    };

    modelEl.addEventListener('model-loaded', handleLoaded);
    modelEl.addEventListener('model-error', handleError);
    if (modelEl.getObject3D('mesh')) {
      handleLoaded();
    }

    return () => {
      modelEl.removeEventListener('model-loaded', handleLoaded);
      modelEl.removeEventListener('model-error', handleError);
    };
  }, [localGlbUrl, arData, scanMeshes, videoFlipX, getOrbitControls, getThreeCamera]);

  // Click-to-Select 3D Mesh in Scene Viewer (Raycasting)
  useEffect(() => {
    let pointerDownPos = null;

    const handlePointerDown = (e) => {
      if (cameraTransitionIdRef.current) {
        cancelAnimationFrame(cameraTransitionIdRef.current);
        cameraTransitionIdRef.current = null;
      }
      const isModifierClick = Boolean(e.ctrlKey || e.metaKey);
      if (e.button !== undefined && e.button !== 0 && !(e.button === 2 && isModifierClick)) return;
      // Ignore clicks on HTML toolbars, controls, buttons, or modals
      if (e.target && e.target.tagName !== 'CANVAS') {
        pointerDownPos = null;
        return;
      }
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      if (!pointerDownPos) return;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;

      if (dist > 8) return; // Orbit/drag gesture: do not raycast or deselect
      if (e.target && e.target.tagName !== 'CANVAS') return; // Ignore releases on HTML toolbars/buttons
      if (isGizmoDragging || window.__isGizmoDragging) return;

      const sceneEl = document.querySelector('a-scene');
      const camera = sceneEl?.camera || (typeof window !== 'undefined' && window.__arOrbitCamera);
      const canvas = sceneEl?.canvas;
      if (!sceneEl || !camera || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) return;

      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // 0. Check Transform Gizmo Helper First!
      // If user clicked or released on a gizmo axis/plane/handle, DO NOT CLEAR SELECTION!
      const tc = transformControlsRef.current;
      if (tc && tc.object) {
        if (tc.axis !== null || tc.dragging) return;
        const helper = tc.getHelper ? tc.getHelper() : tc;
        if (helper) {
          const gizmoHits = raycaster.intersectObject(helper, true);
          if (gizmoHits.length > 0) return;
        }
      }

      // Unified Multi-Object Single Pass Raycasting (Depth-Sorted)
      const candidates = [];

      const customModelsEl = document.getElementById('ar-custom-models-anchor');
      const customModelsGroup = customModelsEl?.getObject3D('customModelsRoot') || customModelsEl?.object3D;
      if (customModelsGroup) candidates.push(customModelsGroup);

      const geomEl = document.getElementById('ar-additional-geometries-anchor');
      const geomGroup = geomEl?.getObject3D('additionalGeometriesRoot') || geomEl?.object3D;
      if (geomGroup) candidates.push(geomGroup);

      const textEl = document.getElementById('ar-3d-texts-anchor');
      const textGroup = textEl?.getObject3D('texts3DRoot') || textEl?.object3D;
      if (textGroup) candidates.push(textGroup);

      const lightsEl = document.getElementById('ar-custom-lights-anchor');
      const lightsGroup = lightsEl?.getObject3D('lightsRoot') || lightsEl?.object3D;
      if (lightsGroup) candidates.push(lightsGroup);

      const modelEl = document.getElementById('ar-model');
      const model3D = modelEl?.getObject3D('mesh');
      if (model3D) candidates.push(model3D);

      const isLightHit = (o) => {
        let cur = o;
        while (cur) {
          if (cur.userData?.lightId || cur.userData?.isCustomLight || cur.light?.userData?.lightId) return true;
          cur = cur.parent;
        }
        return false;
      };

      const allIntersects = raycaster.intersectObjects(candidates, true);
      // Filter out invisible objects and transform gizmo pickers (while allowing custom lights, models, shapes, texts)
      const validHit = allIntersects.find((intersect) => {
        const obj = intersect.object;
        if (!obj || obj.visible === false) return false;
        if (isLightHit(obj)) return true;
        if (obj.name && /picker|gizmo|starwear-transform/i.test(obj.name)) return false;
        let p = obj.parent;
        while (p) {
          if (p.visible === false) return false;
          if (p.name && /starwear-transform/i.test(p.name)) return false;
          p = p.parent;
        }
        return true;
      });

      if (validHit) {
        let curr = validHit.object;
        let hitType = null;
        let hitId = null;
        let targetTab = null;

        // 1. Check for 3D Extruded Typography Text
        let p = curr;
        while (p) {
          if (p.userData?.textId) {
            hitType = 'text3d';
            hitId = p.userData.textId;
            targetTab = 'text3d';
            break;
          }
          p = p.parent;
        }

        // 2. Check for Custom Light Source
        if (!hitType) {
          p = curr;
          while (p) {
            if (p.userData?.lightId || p.userData?.isCustomLight) {
              hitType = 'light';
              hitId = p.userData.lightId;
              targetTab = 'lighting';
              break;
            }
            if (p.light?.userData?.lightId) {
              hitType = 'light';
              hitId = p.light.userData.lightId;
              targetTab = 'lighting';
              break;
            }
            p = p.parent;
          }
        }

        // 3. Check for Primitive 3D Geometry
        if (!hitType) {
          p = curr;
          while (p) {
            const gId = p.userData?.geometryId || p.userData?.id;
            if (gId && (p.userData?.isAdditionalGeometry || p.userData?.type)) {
              hitType = 'geometry';
              hitId = gId;
              targetTab = 'shapes';
              break;
            }
            p = p.parent;
          }
        }

        // 4. Check for External Custom 3D Model
        if (!hitType) {
          p = curr;
          while (p) {
            if (p.userData?.modelId && (p.userData?.isCustomModel || p.userData?.url)) {
              hitType = 'customModel';
              hitId = p.userData.modelId;
              targetTab = 'hierarchy';
              break;
            }
            p = p.parent;
          }
        }

        // 5. Center Model Submesh
        if (!hitType && validHit.object.isMesh && validHit.object.uuid) {
          hitType = 'mesh';
          hitId = validHit.object.uuid;
          targetTab = 'hierarchy';
        }

        if (hitType && hitId) {
          const isCtrlOrCmd = Boolean(e.metaKey || e.ctrlKey);
          const isShift = Boolean(e.shiftKey);

          // Multi-Selection: Only triggered when Shift is held OR multiSelectMode button is active
          // (Control / Command click is used for direct selection)
          if (isShift || isMultiSelectMode) {
            const parentGroup = sceneGroupsRef.current.find((g) =>
              g.itemIds.some((it) => it.type === hitType && it.id === hitId)
            );
            if (parentGroup && groupSelectionMode === 'group') {
              const allSelected = parentGroup.itemIds.every((it) =>
                selectedObjectsRef.current.some((sel) => sel.type === it.type && sel.id === it.id)
              );
              if (allSelected) {
                parentGroup.itemIds.forEach((it) => toggleObjectSelection(it.type, it.id));
              } else {
                parentGroup.itemIds.forEach((it) => {
                  if (!selectedObjectsRef.current.some((sel) => sel.type === it.type && sel.id === it.id)) {
                    toggleObjectSelection(it.type, it.id);
                  }
                });
              }
              return;
            }

            toggleObjectSelection(hitType, hitId);
            return;
          }

          // Check if item belongs to a group and group selection mode is active
          // (Unless Ctrl/Cmd was held specifically to select the individual item directly)
          const parentGroup = sceneGroupsRef.current.find((g) =>
            g.itemIds.some((it) => it.type === hitType && it.id === hitId)
          );

          if (parentGroup && groupSelectionMode === 'group' && !isCtrlOrCmd) {
            selectSceneObject('group', parentGroup.id);
            setActiveTab('hierarchy');
            return;
          }

          // Single selection (either via direct click OR holding Ctrl/Cmd)
          selectSceneObject(hitType, hitId);
          if (targetTab) setActiveTab(targetTab);

          let label = hitType.charAt(0).toUpperCase() + hitType.slice(1);
          if (hitType === 'geometry') label = '3D Shape';
          if (hitType === 'light') label = 'Light';
          if (hitType === 'text3d') label = '3D Text';
          if (hitType === 'customModel') label = '3D Model';
          if (hitType === 'mesh') label = 'Mesh';
          setSaveSuccessMsg(`Selected ${label}`);
          setTimeout(() => setSaveSuccessMsg(''), 2500);
          return;
        }
      }

      // 6. Empty space clicked: Clear selection only if not holding modifier keys or multi-select mode
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !isMultiSelectMode) {
        clearSelectionAndDetachGizmo();
      }
    };

    const sceneContainer = document.getElementById('ar-scene-container');
    const handleContextMenu = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (sceneContainer) {
      sceneContainer.addEventListener('pointerdown', handlePointerDown);
      sceneContainer.addEventListener('pointerup', handlePointerUp);
      sceneContainer.addEventListener('contextmenu', handleContextMenu);
    }

    const handleGlobalPointerUp = () => {
      window.__isGizmoDragging = false;
      setIsGizmoDragging(false);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);

    return () => {
      if (sceneContainer) {
        sceneContainer.removeEventListener('pointerdown', handlePointerDown);
        sceneContainer.removeEventListener('pointerup', handlePointerUp);
        sceneContainer.removeEventListener('contextmenu', handleContextMenu);
      }
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [meshList, isGizmoDragging, clearSelectionAndDetachGizmo, selectSceneObject, toggleObjectSelection, isMultiSelectMode, groupSelectionMode]);

  // =========================================================================
  // TRANSFORM CONTROLS GIZMO LIFECYCLE IN AFRAME/THREE.JS
  // =========================================================================
  useEffect(() => {
    let checkInterval = null;

    const setupGizmo = () => {
      const sceneEl = document.querySelector('a-scene');
      if (!sceneEl) return false;

      const camera = sceneEl.camera;
      const canvas = sceneEl.canvas;
      const threeScene = sceneEl.object3D;
      if (!camera || !canvas || !threeScene) return false;

      if (transformControlsRef.current) return true;

      try {
        const tc = new TransformControls(camera, canvas);
        tc.size = 0.85;
        tc.setMode(gizmoMode);
        tc.setSpace(gizmoSpace);

        tc.addEventListener('dragging-changed', (event) => {
          const isDragging = Boolean(event.value);
          setIsGizmoDragging(isDragging);
          window.__isGizmoDragging = isDragging;
          if (tc.object) {
            window.__activeGizmoTarget = tc.object;
          } else {
            window.__activeGizmoTarget = null;
          }
          const orbit = window.__arOrbitControls;
          if (orbit) {
            orbit.enabled = !isDragging;
          }

          if (isDragging) {
            const targetObj = tc.object;
            if (targetObj && (targetObj.userData?.isGroupPivot || targetObj.userData?.isMultiPivot)) {
              threeScene.updateMatrixWorld(true);
              targetObj.updateMatrixWorld(true);
              const startPivotMatrix = targetObj.matrixWorld.clone();
              const invStartPivot = new THREE.Matrix4().copy(startPivotMatrix).invert();

              let targetItems = [];
              const groupId = targetObj.userData?.groupId;
              if (groupId) {
                const grp = sceneGroupsRef.current.find((g) => g.id === groupId);
                if (grp) targetItems = grp.itemIds;
              } else if (targetObj.userData?.isMultiPivot) {
                targetItems = selectedObjectsRef.current;
              }

              const members = [];
              targetItems.forEach((item) => {
                const obj3d = findThreeObject(item.type, item.id);
                if (obj3d) {
                  obj3d.updateMatrixWorld(true);
                  const startWorldMatrix = obj3d.matrixWorld.clone();
                  const relMatrix = new THREE.Matrix4().multiplyMatrices(invStartPivot, startWorldMatrix);
                  members.push({
                    type: item.type,
                    id: item.id,
                    obj3d,
                    relMatrix,
                    startWorldMatrix
                  });
                }
              });

              activeGroupDragRef.current = {
                pivot: targetObj,
                startPivotMatrix,
                invStartPivot,
                members,
                groupId: groupId || null,
                isMulti: Boolean(targetObj.userData?.isMultiPivot)
              };
            }
          } else {
            if (activeGroupDragRef.current) {
              const { pivot, members, groupId } = activeGroupDragRef.current;
              commitMemberTransformsToState(members);
              if (groupId) {
                setSceneGroups((prev) =>
                  prev.map((g) => {
                    if (g.id === groupId) {
                      return {
                        ...g,
                        posX: Number(pivot.position.x.toFixed(3)),
                        posY: Number(pivot.position.y.toFixed(3)),
                        posZ: Number(pivot.position.z.toFixed(3)),
                        rotX: Number(THREE.MathUtils.radToDeg(pivot.rotation.x).toFixed(1)),
                        rotY: Number(THREE.MathUtils.radToDeg(pivot.rotation.y).toFixed(1)),
                        rotZ: Number(THREE.MathUtils.radToDeg(pivot.rotation.z).toFixed(1)),
                        scale: Number(pivot.scale.x.toFixed(3)),
                        scaleX: Number(pivot.scale.x.toFixed(3)),
                        scaleY: Number(pivot.scale.y.toFixed(3)),
                        scaleZ: Number(pivot.scale.z.toFixed(3))
                      };
                    }
                    return g;
                  })
                );
              }
              activeGroupDragRef.current = null;
            }
          }
        });

        tc.addEventListener('objectChange', () => {
          if (tc.object) {
            if (activeGroupDragRef.current && (tc.object.userData?.isGroupPivot || tc.object.userData?.isMultiPivot)) {
              const { pivot, members } = activeGroupDragRef.current;
              pivot.updateMatrixWorld(true);
              const currentPivotWorld = pivot.matrixWorld;
              members.forEach((m) => {
                if (!m.obj3d) return;
                const newWorldMatrix = new THREE.Matrix4().multiplyMatrices(currentPivotWorld, m.relMatrix);
                if (m.obj3d.parent) {
                  const invParent = new THREE.Matrix4().copy(m.obj3d.parent.matrixWorld).invert();
                  const targetLocal = new THREE.Matrix4().multiplyMatrices(invParent, newWorldMatrix);
                  targetLocal.decompose(m.obj3d.position, m.obj3d.quaternion, m.obj3d.scale);
                } else {
                  newWorldMatrix.decompose(m.obj3d.position, m.obj3d.quaternion, m.obj3d.scale);
                }
                m.obj3d.updateMatrixWorld(true);
              });
            } else {
              handleGizmoObjectChange(tc.object);
            }
          }
        });

        const helper = tc.getHelper ? tc.getHelper() : tc;
        helper.name = 'starwear-transform-gizmo-helper';
        threeScene.add(helper);
        transformControlsRef.current = tc;
        setGizmoReady(true);
        return true;
      } catch (err) {
        console.warn('[ARTest] Could not initialize TransformControls:', err);
        return false;
      }
    };

    if (!setupGizmo()) {
      checkInterval = setInterval(() => {
        if (setupGizmo()) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }, 150);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (transformControlsRef.current) {
        try {
          const tc = transformControlsRef.current;
          const helper = tc.getHelper ? tc.getHelper() : tc;
          const sceneEl = document.querySelector('a-scene');
          if (helper && sceneEl?.object3D) sceneEl.object3D.remove(helper);
          tc.dispose();
        } catch { }
        transformControlsRef.current = null;
        setGizmoReady(false);
        window.__isGizmoDragging = false;
        window.__activeGizmoTarget = null;
      }
    };
  }, [handleGizmoObjectChange, findThreeObject, commitMemberTransformsToState]);

  // Update TransformControls Mode, Coordinate Space & Snap
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;
    try {
      tc.setMode(gizmoMode);
      tc.setSpace(gizmoSpace);
      if (gizmoMode === 'translate') {
        tc.setTranslationSnap(gizmoSnap);
      } else if (gizmoMode === 'rotate') {
        tc.setRotationSnap(gizmoSnap ? (15 * Math.PI) / 180 : null);
      } else if (gizmoMode === 'scale') {
        tc.setScaleSnap(gizmoSnap ? 0.1 : null);
      }
    } catch { }
  }, [gizmoMode, gizmoSpace, gizmoSnap]);

  // Dynamically Attach/Detach TransformControls to Active Target Object with Async Resilience
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    // Do NOT re-attach while actively dragging to prevent jitter / losing axis handle
    if (isGizmoDragging || window.__isGizmoDragging) return;

    let cancelled = false;
    let retryInterval = null;

    const resolveTargetObject = () => {
      if (selectedTargetType === 'group' && selectedGroupId) {
        const currentGroup = sceneGroups.find((g) => g.id === selectedGroupId);
        if (currentGroup) {
          const sceneEl = document.querySelector('a-scene');
          const threeScene = sceneEl?.object3D;
          if (threeScene) {
            let pivot = threeScene.getObjectByName(`starwear-group-pivot-${selectedGroupId}`);
            if (!pivot) {
              pivot = new THREE.Group();
              pivot.name = `starwear-group-pivot-${selectedGroupId}`;
              pivot.userData = { isGroupPivot: true, groupId: selectedGroupId };
              threeScene.add(pivot);
            }
            pivot.position.set(currentGroup.posX || 0, currentGroup.posY || 0, currentGroup.posZ || 0);
            pivot.rotation.set(
              THREE.MathUtils.degToRad(currentGroup.rotX || 0),
              THREE.MathUtils.degToRad(currentGroup.rotY || 0),
              THREE.MathUtils.degToRad(currentGroup.rotZ || 0)
            );
            const sx = currentGroup.scaleX ?? currentGroup.scale ?? 1;
            const sy = currentGroup.scaleY ?? currentGroup.scale ?? 1;
            const sz = currentGroup.scaleZ ?? currentGroup.scale ?? 1;
            pivot.scale.set(sx, sy, sz);
            pivot.updateMatrixWorld(true);
            return pivot;
          }
        }
      } else if ((selectedTargetType === 'multi' || selectedObjects.length > 1) && selectedObjects.length > 0) {
        const sceneEl = document.querySelector('a-scene');
        const threeScene = sceneEl?.object3D;
        if (threeScene) {
          let pivot = threeScene.getObjectByName('starwear-multi-selection-pivot');
          if (!pivot) {
            pivot = new THREE.Group();
            pivot.name = 'starwear-multi-selection-pivot';
            pivot.userData = { isMultiPivot: true };
            threeScene.add(pivot);
          }
          const center = computeObjectsCentroid(selectedObjects);
          pivot.position.copy(center);
          pivot.rotation.set(0, 0, 0);
          pivot.scale.set(1, 1, 1);
          pivot.updateMatrixWorld(true);
          return pivot;
        }
      } else if (selectedTargetType === 'text3d' && selectedText3DId) {
        const textAnchor = document.getElementById('ar-3d-texts-anchor');
        const root = textAnchor?.getObject3D('texts3DRoot') || textAnchor?.object3D;
        if (root) {
          let found = null;
          root.traverse((node) => {
            if (!found && node.userData?.textId === selectedText3DId) found = node;
          });
          if (found) return found;
        }
      } else if (selectedTargetType === 'light' && selectedLightId) {
        const lightsAnchor = document.getElementById('ar-custom-lights-anchor');
        const root = lightsAnchor?.getObject3D('lightsRoot') || lightsAnchor?.object3D;
        if (root) {
          let found = null;
          root.traverse((node) => {
            if (!found && node.userData?.lightId === selectedLightId) {
              found = node.userData.lightRef || node;
            }
          });
          if (found) return found;
        }
      } else if (selectedTargetType === 'customModel' && selectedCustomModelId) {
        const customModelsAnchor = document.getElementById('ar-custom-models-anchor');
        const root = customModelsAnchor?.getObject3D('customModelsRoot') || customModelsAnchor?.object3D;
        if (root) {
          // Direct child wrapper group from ar-custom-models
          const wrapper = root.children?.find((c) => c.userData?.modelId === selectedCustomModelId);
          if (wrapper) return wrapper;
          let found = null;
          root.traverse((node) => {
            if (!found && node.userData?.modelId === selectedCustomModelId && node.userData?.isCustomModel && node.isGroup) {
              found = node;
            }
          });
          if (found) return found;
        }
      } else if (selectedTargetType === 'geometry' && selectedGeometryId) {
        const geomAnchor = document.getElementById('ar-additional-geometries-anchor');
        const root = geomAnchor?.getObject3D('additionalGeometriesRoot') || geomAnchor?.object3D;
        if (root) {
          let found = null;
          root.traverse((node) => {
            if (!found && node.userData?.geometryId === selectedGeometryId) found = node;
          });
          if (found) return found;
        }
      } else if (selectedTargetType === 'mesh' && selectedMeshUuid) {
        const modelEl = document.getElementById('ar-model');
        const model3D = modelEl?.getObject3D('mesh');
        if (model3D) {
          let found = null;
          model3D.traverse((node) => {
            if (!found && node.uuid === selectedMeshUuid && node.isMesh) found = node;
          });
          if (found) return found;
        }
      } else if (selectedTargetType === 'model') {
        const modelEl = document.getElementById('ar-model');
        const obj = modelEl?.object3D;
        if (obj) return obj;
      }
      return null;
    };

    const applyAttachment = (targetObj) => {
      if (cancelled || !targetObj) return;

      // Keep camera synchronized with scene camera
      const sceneEl = document.querySelector('a-scene');
      const cam = sceneEl?.camera || (typeof window !== 'undefined' && window.__arOrbitCamera);
      if (cam && tc.camera !== cam) {
        tc.camera = cam;
      }

      // Ensure geometry center strictly for center model submeshes if needed
      if (
        selectedTargetType === 'mesh' &&
        targetObj.isMesh &&
        targetObj.geometry &&
        !targetObj.userData?.__isCentered &&
        !targetObj.userData?.isAdditionalGeometry &&
        !targetObj.userData?.is3DText &&
        !targetObj.userData?.isCustomModel
      ) {
        targetObj.geometry.computeBoundingBox();
        const geomBox = targetObj.geometry.boundingBox;
        if (geomBox) {
          const centerOffset = new THREE.Vector3();
          geomBox.getCenter(centerOffset);
          if (centerOffset.lengthSq() > 0.000001) {
            targetObj.geometry.center();
            targetObj.position.add(centerOffset.clone().multiply(targetObj.scale));
            targetObj.updateMatrixWorld(true);
          }
          targetObj.userData.__isCentered = true;
        }
      }

      tc.attach(targetObj);
      window.__activeGizmoTarget = targetObj;
      const helper = tc.getHelper ? tc.getHelper() : tc;
      if (helper) {
        helper.visible = true;
        helper.updateMatrixWorld(true);
      }
    };

    const initialTarget = resolveTargetObject();
    if (initialTarget) {
      applyAttachment(initialTarget);
    } else if (selectedTargetType) {
      // Target object might be loading asynchronously (e.g. GLTF / font / geometry mount)
      let attempts = 0;
      const maxAttempts = 60; // 60 * 50ms = 3000ms
      retryInterval = setInterval(() => {
        if (cancelled) {
          clearInterval(retryInterval);
          return;
        }
        attempts++;
        const candidate = resolveTargetObject();
        if (candidate) {
          clearInterval(retryInterval);
          retryInterval = null;
          applyAttachment(candidate);
        } else if (attempts >= maxAttempts) {
          clearInterval(retryInterval);
          retryInterval = null;
          tc.detach();
          window.__activeGizmoTarget = null;
          const helper = tc.getHelper ? tc.getHelper() : tc;
          if (helper) helper.visible = false;
        }
      }, 50);
    } else {
      tc.detach();
      window.__activeGizmoTarget = null;
      const helper = tc.getHelper ? tc.getHelper() : tc;
      if (helper) helper.visible = false;
    }

    // Also listen for immediate model loaded events
    const onModelLoadedEvent = () => {
      if (cancelled) return;
      const t = resolveTargetObject();
      if (t) {
        if (retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
        applyAttachment(t);
      }
    };

    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
      sceneEl.addEventListener('model-loaded', onModelLoadedEvent);
      sceneEl.addEventListener('custom-model-loaded', onModelLoadedEvent);
    }
    window.addEventListener('starwear-custom-model-loaded', onModelLoadedEvent);

    return () => {
      cancelled = true;
      if (retryInterval) clearInterval(retryInterval);
      if (sceneEl) {
        sceneEl.removeEventListener('model-loaded', onModelLoadedEvent);
        sceneEl.removeEventListener('custom-model-loaded', onModelLoadedEvent);
      }
      window.removeEventListener('starwear-custom-model-loaded', onModelLoadedEvent);
    };
  }, [gizmoReady, selectedTargetType, selectedGroupId, selectedObjects, sceneGroups, selectedCustomModelId, selectedText3DId, selectedLightId, selectedGeometryId, selectedMeshUuid, customModels, custom3DTexts, customLights, additionalGeometries, computeObjectsCentroid]);

  // Temporarily hide TransformControls while Face Sketch & Extrude Studio is open
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;
    const helper = tc.getHelper ? tc.getHelper() : tc;
    if (helper) {
      helper.visible = !faceSketchStudioOpen;
    }
  }, [faceSketchStudioOpen]);

  // Visual 3D Selection Box Helper on the selected object(s) or group
  useEffect(() => {
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.object3D) return;
    const threeScene = sceneEl.object3D;

    const oldHelperGroup = threeScene.getObjectByName('starwear-selection-box-helpers');
    if (oldHelperGroup) {
      threeScene.remove(oldHelperGroup);
      oldHelperGroup.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
      });
    }

    const oldMeshHelper = threeScene.getObjectByName('selected-mesh-box-helper');
    if (oldMeshHelper) {
      threeScene.remove(oldMeshHelper);
      if (oldMeshHelper.geometry) oldMeshHelper.geometry.dispose();
    }

    let itemsToHighlight = [];
    let helperColor = 0x6366f1;

    if (selectedTargetType === 'group' && selectedGroupId) {
      const grp = sceneGroups.find((g) => g.id === selectedGroupId);
      if (grp) {
        itemsToHighlight = grp.itemIds;
        helperColor = 0xa855f7; // purple for groups
      }
    } else if ((selectedTargetType === 'multi' || selectedObjects.length > 1) && selectedObjects.length > 0) {
      itemsToHighlight = selectedObjects;
      helperColor = 0x38bdf8; // sky blue for multi-selection
    } else if (selectedObjects.length === 1) {
      itemsToHighlight = selectedObjects;
    } else if (selectedMeshUuid) {
      itemsToHighlight = [{ type: 'mesh', id: selectedMeshUuid }];
    } else if (selectedGeometryId) {
      itemsToHighlight = [{ type: 'geometry', id: selectedGeometryId }];
      helperColor = 0x14b8a6;
    } else if (selectedCustomModelId) {
      itemsToHighlight = [{ type: 'customModel', id: selectedCustomModelId }];
      helperColor = 0xa855f7;
    } else if (selectedText3DId) {
      itemsToHighlight = [{ type: 'text3d', id: selectedText3DId }];
      helperColor = 0xf59e0b;
    } else if (selectedLightId) {
      itemsToHighlight = [{ type: 'light', id: selectedLightId }];
      helperColor = 0xf43f5e;
    }

    if (itemsToHighlight.length === 0) return;

    const helperGroup = new THREE.Group();
    helperGroup.name = 'starwear-selection-box-helpers';

    itemsToHighlight.forEach((item) => {
      const targetNode = findThreeObject(item.type, item.id);
      if (targetNode) {
        try {
          const boxHelper = new THREE.BoxHelper(targetNode, helperColor);
          boxHelper.renderOrder = 999;
          if (boxHelper.material) {
            boxHelper.material.depthTest = false;
            boxHelper.material.transparent = true;
            boxHelper.material.opacity = 0.85;
          }
          helperGroup.add(boxHelper);
        } catch { }
      }
    });

    if (helperGroup.children.length > 0) {
      threeScene.add(helperGroup);
    }

    return () => {
      const hg = threeScene.getObjectByName('starwear-selection-box-helpers');
      if (hg) {
        threeScene.remove(hg);
        hg.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
        });
      }
    };
  }, [selectedTargetType, selectedGroupId, selectedObjects, selectedMeshUuid, selectedGeometryId, selectedCustomModelId, selectedText3DId, selectedLightId, sceneGroups, findThreeObject]);

  // Helper: Find selected mesh object metadata from state
  const selectedMesh = meshList.find((m) => m.uuid === selectedMeshUuid) || null;

  // Real-Time Video Texture Mapping to 3D Model in Viewport on Upload
  useEffect(() => {
    const videoUrl = activeVideoUrl || customVideoUrl || arData?.videoUrl || '';
    const modelEl = document.getElementById('ar-model');
    if (!modelEl) return;
    const model3D = modelEl.getObject3D('mesh');
    if (!model3D) return;

    if (!videoUrl) {
      const sceneEl = document.querySelector('a-scene');
      purgeAllSceneVideoLayers(sceneEl);
      return;
    }

    // Check if videoUrl is a YouTube URL: bypass HTML5 <video> to prevent fatal browser CORS errors
    if (isYouTubeUrl(videoUrl)) {
      const existingVid = document.getElementById('artest-active-video-element');
      if (existingVid) {
        existingVid.pause();
        existingVid.removeAttribute('src');
        try { existingVid.load(); } catch { }
      }
      return;
    }

    // Create or find hidden DOM video element
    let video = document.getElementById('artest-active-video-element');
    if (!video) {
      video = document.createElement('video');
      video.id = 'artest-active-video-element';
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.style.cssText = 'position:fixed;top:0;left:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-999;';
      document.body.appendChild(video);
    }

    if (video.src !== videoUrl) {
      if (/^https?:\/\//i.test(videoUrl)) {
        video.crossOrigin = 'anonymous';
      }
      video.src = videoUrl;
      try {
        video.load();
      } catch { }
    }

    const startPlayback = () => {
      video.muted = true;
      if (mediaPlaying) {
        video.play().catch(() => { });
      } else {
        video.pause();
      }
    };

    video.addEventListener('canplay', startPlayback);
    startPlayback();

    const videoTexture = new THREE.VideoTexture(video);
    if (THREE.SRGBColorSpace !== undefined) {
      videoTexture.colorSpace = THREE.SRGBColorSpace;
    }
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.flipY = false;

    const targetParam = (videoTargetMesh || 'auto').trim().toLowerCase();
    const screenKeywords = ['video', 'screen', 'display', 'cinema', 'videomat', 'screenmat'];

    const matchedMeshes = [];
    const allMeshes = [];
    const autoScreenMeshes = [];

    model3D.traverse((node) => {
      if (node.isMesh && node.material) {
        allMeshes.push(node);
        const nodeName = (node.name || '').toLowerCase();
        const nodeUuid = (node.uuid || '').toLowerCase();

        if (targetParam === 'all') {
          matchedMeshes.push(node);
        } else if (targetParam !== 'auto' && (nodeName === targetParam || nodeUuid === targetParam)) {
          matchedMeshes.push(node);
        } else {
          const hasVideo = !!(
            node.userData?.hasVideo ||
            node.userData?.videoUrl ||
            (Array.isArray(node.material)
              ? node.material.some((m) => m?.userData?.hasVideo || m?.userData?.isVideoLayer)
              : (node.material?.userData?.hasVideo || node.material?.userData?.isVideoLayer))
          );
          if (hasVideo || screenKeywords.some((kw) => nodeName.includes(kw))) {
            autoScreenMeshes.push(node);
          }
        }
      }
    });

    let finalTargetMeshes = matchedMeshes;
    if (finalTargetMeshes.length === 0 && targetParam === 'auto') {
      finalTargetMeshes = autoScreenMeshes;
    }

    // Ensure non-target meshes have any video texture stripped
    allMeshes.forEach((node) => {
      if (!finalTargetMeshes.includes(node)) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((mat) => {
          if (mat.map && (mat.map.isVideoTexture || mat.map.image instanceof HTMLVideoElement)) {
            try { mat.map.dispose(); } catch { }
            mat.map = null;
            mat.needsUpdate = true;
          }
          if (mat.emissiveMap && (mat.emissiveMap.isVideoTexture || mat.emissiveMap.image instanceof HTMLVideoElement)) {
            try { mat.emissiveMap.dispose(); } catch { }
            mat.emissiveMap = null;
            mat.needsUpdate = true;
          }
        });
      }
    });

    finalTargetMeshes.forEach((node) => {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const targetSlot = typeof node.userData?.videoTargetMaterialIndex === 'number'
        ? node.userData.videoTargetMaterialIndex
        : null;

      materials.forEach((mat, idx) => {
        const isTarget = targetSlot !== null
          ? idx === targetSlot
          : (mat?.userData?.hasVideo || mat?.userData?.isVideoLayer || materials.length === 1 || (node.userData?.archetype === 'VIDEO_SCREEN' && idx === 4));

        if (!isTarget) return;

        if (videoFlipX) {
          videoTexture.wrapS = THREE.RepeatWrapping;
          videoTexture.repeat.set(-1, 1);
          videoTexture.offset.set(1, 0);
        } else {
          videoTexture.wrapS = THREE.ClampToEdgeWrapping;
          videoTexture.repeat.set(1, 1);
          videoTexture.offset.set(0, 0);
        }
        videoTexture.matrixAutoUpdate = true;
        if (videoTexture.updateMatrix) videoTexture.updateMatrix();
        videoTexture.needsUpdate = true;
        mat.map = videoTexture;
        mat.emissiveMap = videoTexture;
        if (mat.color && typeof mat.color.set === 'function') {
          mat.color.set(0xffffff);
        }
        if (mat.emissive && typeof mat.emissive.set === 'function') {
          mat.emissive.set(0xffffff);
        }
        mat.emissiveIntensity = 0.5;
        mat.needsUpdate = true;
      });
    });

    return () => {
      video.removeEventListener('canplay', startPlayback);
    };
  }, [activeVideoUrl, customVideoUrl, arData, videoTargetMesh, videoFlipX, mediaPlaying, meshList]);

  // Live Video Layer / Mesh Texture Transformations (Flip, Scale, Offset, Rotation)
  const applyFlipXToScene = useCallback((isFlipped) => {
    const modelEl = document.getElementById('ar-model');
    if (!modelEl) return;
    const model3D = modelEl.getObject3D('mesh');
    if (!model3D) return;

    const targetParam = (videoTargetMesh || 'auto').trim().toLowerCase();
    const screenKeywords = ['video', 'screen', 'display', 'cinema', 'videomat', 'screenmat'];

    const matchedMeshes = [];
    const allMeshes = [];
    const autoScreenMeshes = [];

    model3D.traverse((node) => {
      if (node.isMesh) {
        allMeshes.push(node);
        const nodeName = (node.name || '').toLowerCase();
        const nodeUuid = (node.uuid || '').toLowerCase();

        if (targetParam === 'all') {
          matchedMeshes.push(node);
        } else if (targetParam !== 'auto' && (nodeName === targetParam || nodeUuid === targetParam)) {
          matchedMeshes.push(node);
        } else if (targetParam === 'auto' && selectedMeshUuid && (node.uuid === selectedMeshUuid || node.name === selectedMeshUuid)) {
          matchedMeshes.push(node);
        } else {
          const hasVideo = !!(
            node.userData?.hasVideo ||
            node.userData?.videoUrl ||
            (Array.isArray(node.material)
              ? node.material.some((m) => m?.userData?.hasVideo || m?.userData?.isVideoLayer)
              : (node.material?.userData?.hasVideo || node.material?.userData?.isVideoLayer))
          );
          if (hasVideo || screenKeywords.some((kw) => nodeName.includes(kw))) {
            autoScreenMeshes.push(node);
          }
        }
      }
    });

    let finalTargetMeshes = matchedMeshes;
    if (finalTargetMeshes.length === 0 && targetParam === 'auto') {
      finalTargetMeshes = autoScreenMeshes;
    }

    finalTargetMeshes.forEach((node) => {
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        const targetSlot = typeof node.userData?.videoTargetMaterialIndex === 'number'
          ? node.userData.videoTargetMaterialIndex
          : null;

        mats.forEach((m, idx) => {
          const isTarget = targetSlot !== null
            ? idx === targetSlot
            : (m?.userData?.hasVideo || m?.userData?.isVideoLayer || mats.length === 1 || (node.userData?.archetype === 'VIDEO_SCREEN' && idx === 4));

          if (!isTarget) return;

          ['map', 'emissiveMap'].forEach((mapName) => {
            if (m[mapName]) {
              const tex = m[mapName];
              const repX = (videoTextureRepeatX || 1.0);
              const repY = (videoTextureRepeatY || 1.0);
              const offX = (videoTextureOffsetX || 0.0);
              const offY = (videoTextureOffsetY || 0.0);
              const rot = (videoRotation || 0.0);

              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(isFlipped ? -Math.abs(repX) : Math.abs(repX), repY);
              tex.offset.set(isFlipped ? (1.0 - offX) : offX, offY);
              tex.center.set(0.5, 0.5);
              tex.rotation = (rot * Math.PI) / 180;
              tex.matrixAutoUpdate = true;
              if (tex.updateMatrix) tex.updateMatrix();
              tex.needsUpdate = true;
            }
          });
          m.needsUpdate = true;
        });
      }
    });
  }, [selectedMeshUuid, videoTargetMesh, videoTextureRepeatX, videoTextureRepeatY, videoTextureOffsetX, videoTextureOffsetY, videoRotation]);

  // Reactive Effect to apply Video Transforms whenever state, target, or model changes
  useEffect(() => {
    applyFlipXToScene(videoFlipX);
  }, [videoFlipX, videoScale, videoOffsetX, videoOffsetY, videoOffsetZ, videoRotation, videoTextureRepeatX, videoTextureRepeatY, videoTextureOffsetX, videoTextureOffsetY, applyFlipXToScene, localGlbUrl, meshList]);

  // Snap video layer to exact 3D geometry / face and reset mapping
  const snapVideoToLayer = (targetParam) => {
    const target = targetParam || videoTargetMesh;
    setVideoTargetMesh(target);
    setVideoScale(1.0);
    setVideoOffsetX(0.0);
    setVideoOffsetY(0.0);
    setVideoOffsetZ(0.0);
    setVideoRotation(0);
    setVideoTextureRepeatX(1.0);
    setVideoTextureRepeatY(1.0);
    setVideoTextureOffsetX(0.0);
    setVideoTextureOffsetY(0.0);

    const modelEl = document.getElementById('ar-model') || document.getElementById('preview-model');
    if (modelEl && modelEl.components && modelEl.components['play-gltf-video']) {
      const comp = modelEl.components['play-gltf-video'];
      if (typeof comp.applyVideo === 'function') {
        comp.data.targetMesh = target;
        comp.data.videoScale = 1.0;
        comp.data.videoOffsetX = 0.0;
        comp.data.videoOffsetY = 0.0;
        comp.data.videoOffsetZ = 0.0;
        comp.data.videoRotation = 0;
        comp.applyVideo();
      }
    }
  };

  // Direct Perspective View Angles Switcher (Perspective, Front, Back, Left, Right, Top, Bottom)
  // Matching Studio4D4 viewport perspective and planar views with smooth transition
  const setCameraView = useCallback((viewName) => {
    const camera = getThreeCamera();
    const controls = getOrbitControls();
    if (!camera || !controls) return;

    const target = controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const currentDist = camera.position.distanceTo(target);
    const dist = Math.max(0.5, currentDist > 0.1 ? currentDist : defaultCamPosRef.current.length());

    const newPos = new THREE.Vector3();

    switch (viewName) {
      case 'perspective':
      case 'reset':
        target.copy(defaultTargetRef.current);
        newPos.copy(defaultCamPosRef.current);
        break;
      case 'front':
        newPos.set(target.x, target.y, target.z + dist);
        break;
      case 'back':
        newPos.set(target.x, target.y, target.z - dist);
        break;
      case 'left':
        newPos.set(target.x - dist, target.y, target.z);
        break;
      case 'right':
        newPos.set(target.x + dist, target.y, target.z);
        break;
      case 'top':
        newPos.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case 'bottom':
        newPos.set(target.x, target.y - dist, target.z + 0.0001);
        break;
      default:
        target.copy(defaultTargetRef.current);
        newPos.copy(defaultCamPosRef.current);
        break;
    }

    // Smoothly transition camera to new perspective, matching Studio4D4 feel
    transitionCamera(newPos, target, 350);
  }, [getThreeCamera, getOrbitControls, transitionCamera]);

  // Reposition camera in front of a specific 3D mesh object (frontal view)
  // and bind OrbitControls target directly to that mesh's worldCenter (matching Studio4D4)
  const focusCameraOnMesh = useCallback((uuid, meshName) => {
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (!model3D) return;

    let targetNode = null;
    model3D.traverse((node) => {
      if ((node.uuid === uuid || (meshName && node.name === meshName)) && node.isMesh) {
        targetNode = node;
      }
    });

    if (!targetNode) return;

    // Ensure object world matrix is up to date
    targetNode.updateWorldMatrix(true, false);

    // Compute surface geometry frame (worldCenter, worldNormal, size)
    const frame = computeGeometrySurfaceFrame(targetNode);

    const worldCenter = frame.worldCenter ? frame.worldCenter.clone() : new THREE.Vector3();
    let normal = frame.worldNormal && frame.worldNormal.lengthSq() > 0.001
      ? frame.worldNormal.clone().normalize()
      : new THREE.Vector3(0, 0, 1);

    if (normal.lengthSq() < 0.01) {
      normal.set(0, 0, 1);
    }

    // Frame object comfortably within the camera's FOV (45 deg)
    const maxDim = Math.max(frame.size.x || 0, frame.size.y || 0, frame.size.z || 0, 0.1);
    const fov = 45 * (Math.PI / 180);
    let dist = (maxDim / 2) / Math.tan(fov / 2) * 1.6;
    dist = Math.max(0.35, Math.min(dist, 4.0));

    // Camera position placed along outward normal vector from object's center
    const cameraPos = worldCenter.clone().addScaledVector(normal, dist);

    // Smoothly transition camera and bind target to mesh worldCenter
    transitionCamera(cameraPos, worldCenter, 350);

    // Select the mesh so the user sees it highlighted and auto-spin pauses
    selectSceneObject('mesh', uuid);
  }, [transitionCamera, selectSceneObject]);

  // Studio4D4 & AR Keyboard Shortcuts:
  // W: Translate mode, E: Rotate mode, R: Scale mode, Q: Cycle mode, Esc: Deselect, F: Frame, M: Toggle Marker
  // Ctrl/Cmd+G: Group selected objects, Ctrl/Cmd+Shift+G: Ungroup selected group
  // Ctrl/Cmd+D: Duplicate selected group or object
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();

      if ((e.metaKey || e.ctrlKey) && k === 'd') {
        e.preventDefault();
        if (selectedTargetType === 'group' && selectedGroupId) {
          handleDuplicateGroup(selectedGroupId);
        } else if (selectedTargetType === 'geometry' && selectedGeometryId) {
          handleDuplicateGeometry(selectedGeometryId);
        } else if (selectedTargetType === 'customModel' && selectedCustomModelId) {
          handleDuplicateCustomModel(selectedCustomModelId);
        } else if (selectedTargetType === 'text3d' && selectedText3DId) {
          handleDuplicate3DText(selectedText3DId);
        } else if (selectedTargetType === 'light' && selectedLightId) {
          handleDuplicateLight(selectedLightId);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && k === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedGroupId) {
            handleUngroup(selectedGroupId);
          }
        } else {
          if (selectedObjects.length > 0) {
            handleCreateGroupFromSelection();
          }
        }
        return;
      }

      if (k === 'w') {
        setGizmoMode('translate');
      } else if (k === 'e') {
        setGizmoMode('rotate');
      } else if (k === 'r') {
        setGizmoMode('scale');
      } else if (k === 'q') {
        setGizmoMode((prev) => (prev === 'translate' ? 'rotate' : prev === 'rotate' ? 'scale' : 'translate'));
      } else if (e.key === 'Escape') {
        if (faceSketchStudioOpen) {
          setFaceSketchStudioOpen(false);
        } else {
          clearSelectionAndDetachGizmo();
        }
      } else if (k === 'x') {
        setFaceSketchStudioOpen((prev) => !prev);
      } else if (k === 'f') {
        if (selectedMeshUuid) {
          focusCameraOnMesh(selectedMeshUuid);
        } else {
          focusCameraOnSelectedObject();
        }
      } else if (k === 'm') {
        setMarkerVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [faceSketchStudioOpen, selectedMeshUuid, focusCameraOnMesh, focusCameraOnSelectedObject, clearSelectionAndDetachGizmo, selectedGroupId, selectedObjects, handleUngroup, handleCreateGroupFromSelection, selectedTargetType, selectedGeometryId, selectedCustomModelId, selectedText3DId, selectedLightId, handleDuplicateGroup]);

  // Target Marker Alignment & Calibration Actions
  const MARKER_PRESETS = [
    { label: 'MindAR Standard Target (1.0m × 0.59m)', width: 1.0, aspect: 0.5926 },
    { label: 'Square 1:1 Target (1.0m × 1.0m)', width: 1.0, aspect: 1.0 },
    { label: 'T-Shirt Graphic Print (30cm × 40cm)', width: 0.30, aspect: 40 / 30 },
    { label: 'Hoodie Center Print (35cm × 35cm)', width: 0.35, aspect: 1.0 },
    { label: 'A4 Sheet (21.0cm × 29.7cm)', width: 0.21, aspect: 29.7 / 21.0 },
    { label: 'US Letter (21.6cm × 27.9cm)', width: 0.216, aspect: 27.9 / 21.6 },
    { label: 'Collector Card (6.3cm × 8.8cm)', width: 0.063, aspect: 8.8 / 6.3 },
    { label: 'Compact Emblem / Patch (10cm × 10cm)', width: 0.10, aspect: 1.0 },
    { label: 'Large Poster (0.61m × 0.91m)', width: 0.61, aspect: 0.91 / 0.61 },
  ];

  const applyMarkerPreset = (preset) => {
    if (!preset) return;
    setMarkerWidth(Number(preset.width.toFixed(3)));
    setMarkerAspectRatio(Number(preset.aspect.toFixed(4)));
  };

  const frameCameraToMarker = useCallback(() => {
    const markerH = markerWidth * (markerAspectRatio || 1);
    const maxDim = Math.max(markerWidth, markerH, 0.5);
    const fov = 45 * (Math.PI / 180);
    let dist = (maxDim / 2) / Math.tan(fov / 2) * 1.5;
    dist = Math.max(0.6, Math.min(dist, 4.0));
    transitionCamera(new THREE.Vector3(0, 0, dist), new THREE.Vector3(0, 0, 0), 400);
  }, [markerWidth, markerAspectRatio, transitionCamera]);

  const snapModelToMarkerAnchor = (anchor) => {
    const halfW = markerWidth / 2;
    const halfH = (markerWidth * (markerAspectRatio || 0.5926)) / 2;

    let targetX = 0;
    let targetY = 0;

    switch (anchor) {
      case 'TL': targetX = -halfW; targetY = halfH; break;
      case 'TC': targetX = 0; targetY = halfH; break;
      case 'TR': targetX = halfW; targetY = halfH; break;
      case 'CL': targetX = -halfW; targetY = 0; break;
      case 'CC': targetX = 0; targetY = 0; break;
      case 'CR': targetX = halfW; targetY = 0; break;
      case 'BL': targetX = -halfW; targetY = -halfH; break;
      case 'BC': targetX = 0; targetY = -halfH; break;
      case 'BR': targetX = halfW; targetY = -halfH; break;
      default: break;
    }

    handlePositionChange('x', Number(targetX.toFixed(3)));
    handlePositionChange('y', Number(targetY.toFixed(3)));
  };

  const snapModelToMarkerOrigin = () => {
    handlePositionChange('x', 0);
    handlePositionChange('y', 0);
    handlePositionChange('z', 0);
  };

  const snapModelToMarkerSurface = () => {
    handlePositionChange('z', 0);
  };

  const snapModelDepth = (depthMeters = 0) => {
    handlePositionChange('z', Number(depthMeters.toFixed(3)));
  };

  const snapModelToMarkerBottom = () => {
    const markerH = markerWidth * (markerAspectRatio || 1);
    handlePositionChange('y', Number((-markerH / 2).toFixed(3)));
  };

  const fitModelToMarkerBounds = () => {
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (!model3D) return;

    const box = new THREE.Box3().setFromObject(model3D);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxModelDim = Math.max(size.x, size.y);
    const targetDim = Math.min(markerWidth, markerWidth * (markerAspectRatio || 1)) * 0.85;

    if (maxModelDim > 0.001) {
      const currentScaleVal = selectedMeshUuid ? (meshList.find(m => m.uuid === selectedMeshUuid)?.scale?.x || 1.0) : modelScale;
      const ratio = targetDim / maxModelDim;
      const newScale = Number((currentScaleVal * ratio).toFixed(2));
      handleScaleChange(Math.max(0.05, Math.min(3.0, newScale)));
    }
  };

  const handleCustomMarkerUpload = async (file) => {
    if (!file) return;
    try {
      setMarkerLoading(true);
      stagedMarkerFileRef.current = file;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        try {
          const dims = await getImageDimensions(dataUrl);
          const computedAspect = dims.aspectRatio || (dims.height / dims.width) || 1.0;
          if (typeof window !== 'undefined') {
            window.__starwear_active_marker_image = dataUrl;
          }
          setMarkerImageUrl(dataUrl);
          setMarkerAspectRatio(computedAspect);
          setMarkerInfo({
            width: dims.width,
            height: dims.height,
            source: 'custom',
            name: file.name
          });
          setMarkerVisible(true);
        } catch (err) {
          console.error("Failed to read marker image dimensions:", err);
          setMarkerImageUrl(dataUrl);
          setMarkerVisible(true);
        } finally {
          setMarkerLoading(false);
        }
      };
      reader.onerror = () => setMarkerLoading(false);
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload custom marker:", err);
      setMarkerLoading(false);
    }
  };

  const handleResetMarkerToDefault = () => {
    const fb = createDefaultMarkerDataUrl('STAR weAR');
    stagedMarkerFileRef.current = null;
    if (typeof window !== 'undefined') {
      window.__starwear_active_marker_image = fb.dataUrl;
    }
    setMarkerImageUrl(fb.dataUrl);
    setMarkerAspectRatio(fb.aspectRatio);
    setMarkerInfo({ width: fb.width, height: fb.height, source: 'default' });
    setMarkerVisible(true);
  };

  // Handlers to update either individual mesh or root model transform/materials
  const handleRotationChange = (axis, deg) => {
    if (!selectedMeshUuid) {
      if (axis === 'x') setModelRotX(deg);
      if (axis === 'y') setModelRotY(deg);
      if (axis === 'z') setModelRotZ(deg);
      return;
    }

    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.uuid === selectedMeshUuid && node.isMesh) {
          const rad = (deg * Math.PI) / 180;
          if (axis === 'x') node.rotation.x = rad;
          if (axis === 'y') node.rotation.y = rad;
          if (axis === 'z') node.rotation.z = rad;
        }
      });
    }

    setMeshList((prev) =>
      prev.map((m) =>
        m.uuid === selectedMeshUuid
          ? { ...m, rotation: { ...m.rotation, [axis]: deg } }
          : m
      )
    );
  };

  const handlePositionChange = (axis, val) => {
    if (!selectedMeshUuid) {
      if (axis === 'x') setModelPosX(val);
      if (axis === 'y') setModelPosY(val);
      if (axis === 'z') setModelPosZ(val);
      return;
    }

    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.uuid === selectedMeshUuid && node.isMesh) {
          node.position[axis] = val;
        }
      });
    }

    setMeshList((prev) =>
      prev.map((m) =>
        m.uuid === selectedMeshUuid
          ? { ...m, position: { ...m.position, [axis]: val } }
          : m
      )
    );
  };

  const handleScaleChange = (val) => {
    if (!selectedMeshUuid) {
      setModelScale(val);
      return;
    }

    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.uuid === selectedMeshUuid && node.isMesh) {
          node.scale.set(val, val, val);
        }
      });
    }

    setMeshList((prev) =>
      prev.map((m) =>
        m.uuid === selectedMeshUuid
          ? { ...m, scale: { x: val, y: val, z: val } }
          : m
      )
    );
  };

  const handleMeshVisibilityToggle = (uuid) => {
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.uuid === uuid && node.isMesh) {
          node.visible = !node.visible;
        }
      });
    }

    setMeshList((prev) =>
      prev.map((m) => (m.uuid === uuid ? { ...m, visible: !m.visible } : m))
    );
  };

  const handleDeleteMesh = useCallback((uuid, meshName) => {
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    let resolvedName = meshName || '';

    if (model3D) {
      const nodesToRemove = [];
      model3D.traverse((node) => {
        if ((node.uuid === uuid || (meshName && node.name === meshName)) && node.isMesh) {
          resolvedName = node.name || meshName || `Mesh_${uuid}`;
          node.visible = false;
          if (node.parent) {
            deletedNodesRef.current.set(uuid, { node, parent: node.parent, name: resolvedName });
            nodesToRemove.push(node);
          }
        }
      });
      nodesToRemove.forEach((node) => {
        if (node.parent) node.parent.remove(node);
      });
    }

    if (resolvedName) {
      setDeletedMeshNames((prev) => Array.from(new Set([...prev, resolvedName])));
    }

    setMeshList((prev) => prev.filter((m) => m.uuid !== uuid && m.name !== meshName));

    setSceneGroups((prev) =>
      prev.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((it) => !(it.type === 'mesh' && it.id === uuid))
      }))
    );
    setSelectedObjects((prev) => prev.filter((it) => !(it.type === 'mesh' && it.id === uuid)));

    if (selectedMeshUuid === uuid) {
      selectSceneObject('model');
      const sceneEl = document.querySelector('a-scene');
      const threeScene = sceneEl?.object3D;
      const oldHelper = threeScene?.getObjectByName('mesh-selection-helper');
      if (oldHelper && threeScene) {
        threeScene.remove(oldHelper);
        if (oldHelper.geometry) oldHelper.geometry.dispose();
      }
    }

    if (videoTargetMesh && (videoTargetMesh === meshName || videoTargetMesh === resolvedName || videoTargetMesh === uuid)) {
      setVideoTargetMesh('auto');
    }

    setConfirmDeleteUuid(null);
  }, [selectedMeshUuid, videoTargetMesh, selectSceneObject]);

  const handleRestoreMesh = useCallback((nameOrUuid) => {
    let restoredEntry = null;
    let targetKey = null;

    for (const [key, val] of deletedNodesRef.current.entries()) {
      if (key === nameOrUuid || val.name === nameOrUuid) {
        restoredEntry = val;
        targetKey = key;
        break;
      }
    }

    if (restoredEntry && restoredEntry.parent && restoredEntry.node) {
      restoredEntry.parent.add(restoredEntry.node);
      restoredEntry.node.visible = true;
      if (targetKey) deletedNodesRef.current.delete(targetKey);
    }

    setDeletedMeshNames((prev) => prev.filter((n) => n !== nameOrUuid));
    setTimeout(() => {
      scanMeshes();
    }, 50);
  }, [scanMeshes]);

  const handleRestoreAllMeshes = useCallback(() => {
    for (const [, val] of deletedNodesRef.current.entries()) {
      if (val.parent && val.node) {
        val.parent.add(val.node);
        val.node.visible = true;
      }
    }
    deletedNodesRef.current.clear();
    setDeletedMeshNames([]);
    setTimeout(() => {
      scanMeshes();
    }, 50);
  }, [scanMeshes]);

  const handleMeshMaterialChange = (propOrUpdates, maybeVal) => {
    if (!selectedMeshUuid) return;

    const updates = typeof propOrUpdates === 'string' ? { [propOrUpdates]: maybeVal } : (propOrUpdates || {});
    const isTextureProp = Object.keys(updates).some((k) =>
      ['textureOffsetX', 'textureOffsetY', 'textureRotation', 'textureRepeatX', 'textureRepeatY', 'textureFlipX', 'textureFlipY'].includes(k)
    );

    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.uuid === selectedMeshUuid && node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            if (updates.color !== undefined && mat.color) mat.color.set(updates.color);
            if (updates.metalness !== undefined && mat.metalness !== undefined) mat.metalness = updates.metalness;
            if (updates.roughness !== undefined && mat.roughness !== undefined) mat.roughness = updates.roughness;
            if (updates.emissive !== undefined && mat.emissive) mat.emissive.set(updates.emissive);
            if (updates.emissiveIntensity !== undefined && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = updates.emissiveIntensity;
            if (updates.opacity !== undefined) {
              mat.opacity = updates.opacity;
              if (updates.opacity < 1.0) mat.transparent = true;
            }
            if (updates.wireframe !== undefined) mat.wireframe = !!updates.wireframe;
            mat.needsUpdate = true;
          });

          if (isTextureProp) {
            const currentMesh = meshList.find((m) => m.uuid === selectedMeshUuid);
            const combinedMat = { ...(currentMesh?.material || {}), ...updates };
            applyMaterialTextureTransform(node.material, combinedMat);
          }
        }
      });
    }

    setMeshList((prev) =>
      prev.map((m) =>
        m.uuid === selectedMeshUuid
          ? { ...m, material: { ...m.material, ...updates } }
          : m
      )
    );

    const targetMesh = meshList.find((m) => m.uuid === selectedMeshUuid);
    if (targetMesh) {
      setArData((prev) => {
        if (!prev) return prev;
        const currentOverrides = prev.config?.meshOverrides || {};
        const existingNodeOvr = currentOverrides[targetMesh.name] || currentOverrides[targetMesh.uuid] || {};
        return {
          ...prev,
          config: {
            ...(prev.config || {}),
            meshOverrides: {
              ...currentOverrides,
              [targetMesh.name]: {
                ...existingNodeOvr,
                material: {
                  ...(existingNodeOvr.material || {}),
                  ...updates
                }
              }
            }
          }
        };
      });
    }
  };

  const handleResetMeshTextureTransform = () => {
    handleMeshMaterialChange({
      textureOffsetX: 0.0,
      textureOffsetY: 0.0,
      textureRotation: 0.0,
      textureRepeatX: 1.0,
      textureRepeatY: 1.0,
      textureFlipX: false,
      textureFlipY: false
    });
  };

  // Upload and Apply Image Texture / UV Map to a specific 3D Mesh
  const handleApplyMeshTexture = async (mesh, file) => {
    if (!mesh || !file) return;

    setTextureUploadingUuid(mesh.uuid);
    setUploadProgress(`Loading texture for ${mesh.name}...`);
    setError(null);

    try {
      const previewUrl = URL.createObjectURL(file);
      const modelEl = document.getElementById('ar-model');
      const model3D = modelEl?.getObject3D('mesh');

      let targetNode = null;
      if (model3D) {
        model3D.traverse((node) => {
          if ((node.uuid === mesh.uuid || node.name === mesh.name) && node.isMesh) {
            targetNode = node;
          }
        });
      }

      if (!targetNode) {
        throw new Error(`Could not find 3D mesh "${mesh.name}" in scene.`);
      }

      // 1. Preserve original material and texture if not already backed up
      if (!targetNode.userData.__originalMaterialBackup && targetNode.material) {
        if (Array.isArray(targetNode.material)) {
          targetNode.userData.__originalMaterialBackup = targetNode.material.map((m) => m.clone());
        } else {
          targetNode.userData.__originalMaterialBackup = targetNode.material.clone();
        }
      }

      // 2. Load texture into Three.js
      const loader = new THREE.TextureLoader();
      const texture = await new Promise((resolve, reject) => {
        loader.load(
          previewUrl,
          (t) => resolve(t),
          undefined,
          (err) => reject(new Error('Failed to load image texture: ' + (err?.message || 'Invalid image file')))
        );
      });

      if (THREE.SRGBColorSpace !== undefined) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      texture.flipY = false; // GLTF standard UV mapping orientation
      const currentMeshItem = meshList.find((m) => m.uuid === mesh.uuid || m.name === mesh.name);
      const curTransform = currentMeshItem?.material || mesh.material || {};
      applyTextureTransform(texture, curTransform);

      // Dispose previously applied custom texture if any
      if (targetNode.userData.__currentCustomTexture) {
        try { targetNode.userData.__currentCustomTexture.dispose(); } catch { }
      }
      targetNode.userData.__currentCustomTexture = texture;
      targetNode.userData.__hasCustomTexture = true;

      const mats = Array.isArray(targetNode.material) ? targetNode.material : [targetNode.material];
      mats.forEach((m) => {
        m.map = texture;
        if (m.color && typeof m.color.set === 'function') {
          m.color.set(0xffffff);
        }
        m.needsUpdate = true;
      });

      let finalTextureUrl = previewUrl;
      let finalStoragePath = '';

      // 3. If batchId is present, upload directly to Firebase Cloud Storage
      const bId = (batchId || '').trim();
      if (bId) {
        setUploadProgress(`Uploading ${file.name} to Cloud Storage...`);
        const cleanMeshName = (mesh.name || 'mesh').replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `assets/${bId}/textures/${cleanMeshName}_${Date.now()}_${cleanFileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        finalTextureUrl = downloadUrl;
        finalStoragePath = storagePath;
        targetNode.userData.__customTextureUrl = downloadUrl;

        // Persist to Firestore batch & asset documents
        const meshOverridePayload = {
          ar_config: {
            meshOverrides: {
              [mesh.name]: {
                material: {
                  ...curTransform,
                  textureUrl: downloadUrl,
                  textureStoragePath: storagePath,
                  hasCustomTexture: true,
                  textureFileName: file.name,
                  color: '#ffffff'
                }
              }
            }
          }
        };

        const texBatch = writeBatch(db);
        texBatch.set(doc(db, 'batches', bId), meshOverridePayload, { merge: true });
        texBatch.set(doc(db, 'assets', bId), meshOverridePayload, { merge: true });
        await safeCommitBatch(texBatch);
        console.log(`[ARTest] Persisted texture override for ${mesh.name} to Firestore`);
      } else {
        // Queue for saving when batch ID is entered
        pendingTextureFilesRef.current.set(mesh.name, {
          meshUuid: mesh.uuid,
          meshName: mesh.name,
          file,
          previewUrl
        });
      }

      // 4. Update React state
      setMeshList((prev) =>
        prev.map((m) => {
          if (m.uuid === mesh.uuid || m.name === mesh.name) {
            return {
              ...m,
              material: {
                ...m.material,
                color: '#ffffff',
                textureUrl: finalTextureUrl,
                textureStoragePath: finalStoragePath,
                hasCustomTexture: true,
                textureFileName: file.name
              }
            };
          }
          return m;
        })
      );

      // Update arData config state
      setArData((prev) => {
        if (!prev) return prev;
        const currentOverrides = prev.config?.meshOverrides || {};
        return {
          ...prev,
          config: {
            ...(prev.config || {}),
            meshOverrides: {
              ...currentOverrides,
              [mesh.name]: {
                ...(currentOverrides[mesh.name] || {}),
                material: {
                  ...(currentOverrides[mesh.name]?.material || {}),
                  textureUrl: finalTextureUrl,
                  textureStoragePath: finalStoragePath,
                  hasCustomTexture: true,
                  textureFileName: file.name,
                  color: '#ffffff'
                }
              }
            }
          }
        };
      });

      const timeStr = new Date().toLocaleTimeString();
      setSaveSuccessMsg(
        bId
          ? `Texture applied to ${mesh.name} & saved to Cloud Storage at ${timeStr}`
          : `Texture preview applied to ${mesh.name}. Save to batch to upload to Cloud Storage.`
      );
      setTimeout(() => setSaveSuccessMsg(''), 6000);
    } catch (err) {
      console.error('Error applying mesh texture:', err);
      setError('Error applying texture: ' + err.message);
    } finally {
      setTextureUploadingUuid(null);
      setUploadProgress('');
    }
  };

  // Revert Mesh Texture / Material back to Original & Delete from Cloud Storage
  const handleRemoveMeshTexture = async (uuid, meshName) => {
    const targetMeshItem = meshList.find((m) => m.uuid === uuid || m.name === meshName);
    const targetName = meshName || targetMeshItem?.name || '';
    const bId = (batchId || '').trim();

    // 1. Gather all candidate Cloud Storage targets to delete
    const targetsToDelete = [
      targetMeshItem?.material?.textureStoragePath,
      targetMeshItem?.material?.textureUrl,
      arData?.config?.meshOverrides?.[targetName]?.material?.textureStoragePath,
      arData?.config?.meshOverrides?.[targetName]?.material?.textureUrl
    ].filter(Boolean);

    // 2. Revert the Three.js mesh back to the original material/texture
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    let restoredOriginal = false;

    if (model3D) {
      model3D.traverse((node) => {
        if ((node.uuid === uuid || node.name === targetName) && node.isMesh) {
          // Dispose current custom texture
          if (node.userData.__currentCustomTexture) {
            try { node.userData.__currentCustomTexture.dispose(); } catch { }
            node.userData.__currentCustomTexture = null;
          }
          node.userData.__hasCustomTexture = false;
          node.userData.__customTextureUrl = null;

          // Restore from original material backup
          if (node.userData.__originalMaterialBackup) {
            if (Array.isArray(node.userData.__originalMaterialBackup)) {
              node.material = node.userData.__originalMaterialBackup.map((m) => m.clone());
            } else {
              node.material = node.userData.__originalMaterialBackup.clone();
            }
            node.material.needsUpdate = true;
            restoredOriginal = true;
          } else if (node.material) {
            // Fallback if backup wasn't cloned
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m) => {
              m.map = null;
              m.needsUpdate = true;
            });
          }
        }
      });
    }

    // 3. Delete texture file(s) from Firebase Cloud Storage
    let deletedCount = 0;
    const triedPaths = new Set();

    for (const item of targetsToDelete) {
      if (!item || typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
        continue;
      }
      try {
        let storageRef = null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('gs://')) {
          if (trimmed.includes('firebasestorage.googleapis.com') || trimmed.startsWith('gs://')) {
            storageRef = ref(storage, trimmed);
          }
        } else {
          storageRef = ref(storage, trimmed);
        }

        if (storageRef && !triedPaths.has(storageRef.fullPath)) {
          triedPaths.add(storageRef.fullPath);
          await deleteObject(storageRef);
          deletedCount++;
          console.log('[ARTest] Deleted texture object from Cloud Storage:', storageRef.fullPath);
        }
      } catch (err) {
        if (err?.code !== 'storage/object-not-found') {
          console.warn('[ARTest] Could not delete texture from Storage:', trimmed, err);
        }
      }
    }

    // 4. Update Firestore documents to remove texture override
    if (bId && targetName) {
      try {
        const clearPayload = {
          ar_config: {
            meshOverrides: {
              [targetName]: {
                material: {
                  textureUrl: null,
                  textureStoragePath: null,
                  hasCustomTexture: false,
                  textureFileName: null,
                  textureOffsetX: 0.0,
                  textureOffsetY: 0.0,
                  textureRotation: 0.0,
                  textureRepeatX: 1.0,
                  textureRepeatY: 1.0,
                  textureFlipX: false,
                  textureFlipY: false
                }
              }
            }
          }
        };
        const clearBatch = writeBatch(db);
        clearBatch.set(doc(db, 'batches', bId), clearPayload, { merge: true });
        clearBatch.set(doc(db, 'assets', bId), clearPayload, { merge: true });
        await safeCommitBatch(clearBatch);
        console.log(`[ARTest] Removed texture override in Firestore for ${targetName}`);
      } catch (fsErr) {
        console.warn('[ARTest] Firestore texture removal warning:', fsErr);
      }
    }

    // Clear any pending upload for this mesh
    if (targetName && pendingTextureFilesRef.current.has(targetName)) {
      const pending = pendingTextureFilesRef.current.get(targetName);
      if (pending?.previewUrl) {
        try { URL.revokeObjectURL(pending.previewUrl); } catch { }
      }
      pendingTextureFilesRef.current.delete(targetName);
    }

    // 5. Update meshList state
    setMeshList((prev) =>
      prev.map((m) => {
        if (m.uuid === uuid || m.name === targetName) {
          const origHex = m.originalColor || '#ffffff';
          return {
            ...m,
            material: {
              ...m.material,
              color: origHex,
              textureUrl: null,
              textureStoragePath: null,
              hasCustomTexture: false,
              textureFileName: null,
              textureOffsetX: 0.0,
              textureOffsetY: 0.0,
              textureRotation: 0.0,
              textureRepeatX: 1.0,
              textureRepeatY: 1.0,
              textureFlipX: false,
              textureFlipY: false
            }
          };
        }
        return m;
      })
    );

    // Update arData state
    setArData((prev) => {
      if (!prev) return prev;
      const currentOverrides = { ...(prev.config?.meshOverrides || {}) };
      if (currentOverrides[targetName]) {
        currentOverrides[targetName] = {
          ...currentOverrides[targetName],
          material: {
            ...(currentOverrides[targetName].material || {}),
            textureUrl: null,
            textureStoragePath: null,
            hasCustomTexture: false,
            textureFileName: null,
            textureOffsetX: 0.0,
            textureOffsetY: 0.0,
            textureRotation: 0.0,
            textureRepeatX: 1.0,
            textureRepeatY: 1.0,
            textureFlipX: false,
            textureFlipY: false
          }
        };
      }
      return {
        ...prev,
        config: {
          ...(prev.config || {}),
          meshOverrides: currentOverrides
        }
      };
    });

    const timeStr = new Date().toLocaleTimeString();
    if (deletedCount > 0) {
      setSaveSuccessMsg(`Texture deleted from Cloud Storage (${deletedCount} file${deletedCount > 1 ? 's' : ''}) & original material restored on ${targetName} at ${timeStr}`);
    } else {
      setSaveSuccessMsg(`Custom texture removed & original material restored on ${targetName} at ${timeStr}`);
    }
    setTimeout(() => setSaveSuccessMsg(''), 6000);
  };

  const resetCurrentTargetTransform = () => {
    if (!selectedMeshUuid) {
      setModelRotX(90);
      setModelRotY(0);
      setModelRotZ(0);
      setModelPosX(0);
      setModelPosY(0);
      setModelPosZ(0);
      setModelScale(0.4);
    } else {
      handleRotationChange('x', 0);
      handleRotationChange('y', 0);
      handleRotationChange('z', 0);
      handlePositionChange('x', 0);
      handlePositionChange('y', 0);
      handlePositionChange('z', 0);
      handleScaleChange(1.0);
    }
  };

  const pickLocalModel = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedGlbFile(file);
      const url = URL.createObjectURL(file);
      lastFramedModelKeyRef.current = '';
      setLocalGlbUrl(url);
      setLocalGlbName(file.name);
      selectSceneObject('model');
      setArData((prev) => ({
        ...(prev || {}),
        arExperience: {
          ...(prev?.arExperience || {}),
          modelUrl: url,
          scale: `${modelScale} ${modelScale} ${modelScale}`,
          position: `${modelPosX} ${modelPosY} ${modelPosZ}`,
          rotation: `${modelRotX} ${modelRotY} ${modelRotZ}`
        },
        videoUrl: activeVideoUrl || prev?.videoUrl || ''
      }));
    }
  };

  const pickLocalVideo = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedVideoFile(file);
      const url = URL.createObjectURL(file);
      setActiveVideoUrl(url);
      setCustomVideoUrl('');
      setLocalVideoName(file.name);
      setMediaPlaying(true);
      if (selectedMesh) {
        setVideoTargetMesh(selectedMesh.name || selectedMesh.uuid);
      }
    }
  };

  const applyCustomVideoUrl = (url) => {
    const trimmed = (url || '').trim();
    setCustomVideoUrl(trimmed);
    setActiveVideoUrl(trimmed);
    setSelectedVideoFile(null);
    setLocalVideoName('');
    setMediaPlaying(true);
    if (selectedMesh) {
      setVideoTargetMesh(selectedMesh.name || selectedMesh.uuid);
    }
    if (isYouTubeUrl(trimmed)) {
      setVideoMode('youtube');
      setYoutubeUrlInput(trimmed);
      if (isYouTubeShortUrl(trimmed)) {
        setVideoAspectRatio('9:16');
      }
    } else {
      setVideoMode('webgl');
    }
  };

  const handleRemoveVideoLayer = useCallback(async () => {
    // 1. Collect all candidate Cloud Storage targets before clearing React state
    const targetsToDelete = [
      arData?.config?.video_file_path,
      arData?.video_file_path,
      arData?.videoUrl,
      arData?.video_url,
      activeVideoUrl,
      customVideoUrl
    ].filter(Boolean);

    const bId = (batchId || '').trim();

    // 2. Clear all local React state
    setActiveVideoUrl('');
    setCustomVideoUrl('');
    setSelectedVideoFile(null);
    setLocalVideoName('');
    setYoutubeUrlInput('');

    // Clear video URL and path on arData so it doesn't fall back to initial batch values
    setArData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        videoUrl: '',
        video_url: '',
        video_file_path: '',
        config: {
          ...(prev.config || {}),
          videoUrl: '',
          video_url: '',
          video_file_path: ''
        }
      };
    });

    // 3. Completely purge all video layers, elements, CSS3D overlays, textures, and component states from the scene
    const sceneEl = document.querySelector('a-scene');
    purgeAllSceneVideoLayers(sceneEl);

    // Explicitly restore material colors & emissive defaults on meshes in scene
    const modelEl = document.getElementById('ar-model');
    const model3D = modelEl?.getObject3D('mesh');
    if (model3D) {
      model3D.traverse((node) => {
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            if (mat.map && mat.map.isVideoTexture) {
              try { mat.map.dispose(); } catch { }
              mat.map = null;
            }
            if (mat.emissiveMap && mat.emissiveMap.isVideoTexture) {
              try { mat.emissiveMap.dispose(); } catch { }
              mat.emissiveMap = null;
            }
            if (mat.emissive && typeof mat.emissive.set === 'function') {
              mat.emissive.set(matEmissive || 0x000000);
            }
            mat.emissiveIntensity = matEmissiveIntensity || 0;
            mat.needsUpdate = true;
          });
        }
      });
    }

    // 4. Delete video file(s) from Firebase Cloud Storage
    let deletedCount = 0;
    const triedPaths = new Set();

    for (const item of targetsToDelete) {
      if (!item || typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || isYouTubeUrl(trimmed)) {
        continue;
      }
      try {
        let storageRef = null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('gs://')) {
          if (trimmed.includes('firebasestorage.googleapis.com') || trimmed.startsWith('gs://')) {
            storageRef = ref(storage, trimmed);
          }
        } else {
          storageRef = ref(storage, trimmed);
        }

        if (storageRef && !triedPaths.has(storageRef.fullPath)) {
          triedPaths.add(storageRef.fullPath);
          await deleteObject(storageRef);
          deletedCount++;
          console.log('[ARTest] Deleted video object from Cloud Storage:', storageRef.fullPath);
        }
      } catch (err) {
        if (err?.code !== 'storage/object-not-found') {
          console.warn('[ARTest] Could not delete video target from Storage:', trimmed, err);
        }
      }
    }

    // If batchId is set, inspect assets/${bId} and remove any remaining video files (.mp4, .webm, .mov, etc.)
    // NEVER delete .glb 3D models or .mind tracking markers!
    if (bId) {
      try {
        const folderRef = ref(storage, `assets/${bId}`);
        const folderList = await listAll(folderRef);
        const videoExts = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
        for (const itemRef of folderList.items) {
          const lower = itemRef.name.toLowerCase();
          const isVideo = videoExts.some((ext) => lower.endsWith(ext));
          if (isVideo && !triedPaths.has(itemRef.fullPath)) {
            triedPaths.add(itemRef.fullPath);
            try {
              await deleteObject(itemRef);
              deletedCount++;
              console.log('[ARTest] Deleted batch video file from Cloud Storage:', itemRef.fullPath);
            } catch (e) {
              console.warn('[ARTest] Error deleting batch video item:', itemRef.fullPath, e);
            }
          }
        }
      } catch (folderErr) {
        console.log('[ARTest] Batch folder inspection note:', folderErr?.message);
      }

      // 5. Update Firestore batch & asset documents immediately to clear video fields
      try {
        const clearPayload = {
          videoUrl: '',
          video_url: '',
          video_file_path: '',
          ar_config: {
            ...(arData?.config || {}),
            videoUrl: '',
            video_url: '',
            video_file_path: ''
          }
        };
        const vidBatch = writeBatch(db);
        vidBatch.set(doc(db, 'batches', bId), clearPayload, { merge: true });
        vidBatch.set(doc(db, 'assets', bId), clearPayload, { merge: true });
        await safeCommitBatch(vidBatch);
        console.log('[ARTest] Persisted video removal to Firestore for batch:', bId);
      } catch (fsErr) {
        console.warn('[ARTest] Firestore video removal warning:', fsErr);
      }
    }

    const timeStr = new Date().toLocaleTimeString();
    if (deletedCount > 0) {
      setSaveSuccessMsg(`Video layer purged from scene & deleted from Cloud Storage (${deletedCount} file${deletedCount > 1 ? 's' : ''}) at ${timeStr}`);
    } else {
      setSaveSuccessMsg(`Video layer completely purged from scene at ${timeStr}`);
    }
    setTimeout(() => setSaveSuccessMsg(''), 6000);
  }, [arData, activeVideoUrl, customVideoUrl, batchId, matEmissive, matEmissiveIntensity]);

  const handleLoad = async (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;

    setLoading(true);
    setError(null);
    setSaveSuccessMsg('');
    setUploadProgress('');
    setLocalGlbUrl('');
    setLocalGlbName('');
    setSelectedVideoFile(null);
    setSelectedGlbFile(null);
    clearSelectionAndDetachGizmo();
    lastFramedModelKeyRef.current = '';

    try {
      let data = null;
      try {
        const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId.trim()}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (routerErr) {
        console.warn("[ARTest] Loomrouter fetch skipped or failed:", routerErr);
      }
      data = data || {};

      let videoUrl = data.arExperience?.videoUrl || data.arExperience?.video || data.videoUrl || '';
      if (typeof videoUrl === 'string' && videoUrl.startsWith('blob:')) videoUrl = '';

      const batchRef = doc(db, 'batches', batchId.trim());
      let batchSnap = null;
      try {
        batchSnap = await getDocFromServer(batchRef);
      } catch {
        batchSnap = await getDoc(batchRef);
      }
      let batchConfig = null;
      let assetSnap = null;

      if (batchSnap && batchSnap.exists()) {
        const batchData = batchSnap.data();
        const bVid = batchData.video_url || batchData.videoUrl;
        if (bVid && typeof bVid === 'string' && !bVid.startsWith('blob:')) {
          videoUrl = bVid;
        }
        if (batchData.ar_config) {
          batchConfig = batchData.ar_config;
        }
      }

      // Check asset doc for config and marker data (using batchData.asset_id or batchId)
      try {
        const assetId = (batchSnap && batchSnap.exists() && (batchSnap.data()?.asset_id || batchSnap.data()?.assetId)) || batchId.trim();
        const assetRef = doc(db, 'assets', assetId);
        try {
          assetSnap = await getDocFromServer(assetRef);
        } catch {
          assetSnap = await getDoc(assetRef);
        }
        if (assetSnap && assetSnap.exists()) {
          const aData = assetSnap.data();
          if (!batchConfig) {
            const aVid = aData.video_url || aData.videoUrl;
            if (aVid && typeof aVid === 'string' && !aVid.startsWith('blob:')) {
              videoUrl = aVid;
            }
            if (aData.ar_config) {
              batchConfig = aData.ar_config;
            }
          }
        }
      } catch (assetErr) {
        console.warn("[ARTest] Asset document fetch skipped:", assetErr);
      }

      const bData = batchSnap && batchSnap.exists() ? batchSnap.data() : null;
      const aData = assetSnap && assetSnap.exists() ? assetSnap.data() : null;
      const docSource = aData || bData;

      if (!bData && !aData && (!data.arExperience || !data.arExperience.modelUrl)) {
        throw new Error("Batch or asset not found.");
      }

      // Resolve 3D GLTF model URL: prioritize direct storage path from asset/batch doc to guarantee permanent download URL
      let resolvedModelUrl = '';
      const candidatePath = aData?.gltf_file_path || bData?.gltf_file_path || docSource?.gltf_file_path || '';
      if (candidatePath && !candidatePath.startsWith('http')) {
        try {
          resolvedModelUrl = await getDownloadURL(ref(storage, candidatePath));
        } catch (storageGltfErr) {
          console.warn('[ARTest] Could not resolve gltf storage path:', storageGltfErr);
        }
      }

      if (!resolvedModelUrl) {
        const candidateUrl = data.arExperience?.modelUrl || data.modelUrl || data.gltfPath || aData?.gltf_url || bData?.gltf_url || aData?.modelUrl || bData?.modelUrl || '';
        if (candidateUrl) {
          if (!candidateUrl.startsWith('http')) {
            try {
              resolvedModelUrl = await getDownloadURL(ref(storage, candidateUrl));
            } catch (storageUrlErr) {
              console.warn('[ARTest] Could not resolve gltf candidate path:', storageUrlErr);
            }
          } else {
            resolvedModelUrl = candidateUrl;
          }
        }
      }

      data.arExperience = data.arExperience || {};
      data.arExperience.modelUrl = resolvedModelUrl || data.arExperience.modelUrl || '';
      data.gltfPath = resolvedModelUrl || data.gltfPath || data.arExperience.modelUrl || '';
      data.modelUrl = resolvedModelUrl || data.modelUrl || data.arExperience.modelUrl || '';

      const cfg = batchConfig || bData?.ar_config || aData?.ar_config || data.arExperience?.config || data.ar_config || bData || aData || {};
      if (!cfg.meshOverrides && (bData?.meshOverrides || aData?.meshOverrides)) cfg.meshOverrides = bData?.meshOverrides || aData?.meshOverrides;
      if (!cfg.custom3DTexts && (bData?.custom3DTexts || aData?.custom3DTexts)) cfg.custom3DTexts = bData?.custom3DTexts || aData?.custom3DTexts;
      if (!cfg.customLights && (bData?.customLights || aData?.customLights)) cfg.customLights = bData?.customLights || aData?.customLights;
      if (!cfg.additionalGeometries && (bData?.additionalGeometries || aData?.additionalGeometries)) cfg.additionalGeometries = bData?.additionalGeometries || aData?.additionalGeometries;
      if (!cfg.customModels && (bData?.customModels || aData?.customModels)) cfg.customModels = bData?.customModels || aData?.customModels;
      if (!cfg.particleConfig && (bData?.particleConfig || aData?.particleConfig)) cfg.particleConfig = bData?.particleConfig || aData?.particleConfig;
      if (!cfg.portalConfig && (bData?.portalConfig || aData?.portalConfig)) cfg.portalConfig = bData?.portalConfig || aData?.portalConfig;
      if (!cfg.websiteLayer && (bData?.websiteLayer || aData?.websiteLayer)) cfg.websiteLayer = bData?.websiteLayer || aData?.websiteLayer;

      const cVid = cfg.videoUrl || cfg.video_url;
      if (cVid && typeof cVid === 'string' && !cVid.startsWith('blob:')) videoUrl = cVid;
      if (cfg.ambientColor !== undefined) setAmbientColor(cfg.ambientColor);
      if (cfg.ambientIntensity !== undefined) setAmbientIntensity(cfg.ambientIntensity);
      if (cfg.dir1Color !== undefined) setDir1Color(cfg.dir1Color);
      if (cfg.dir1Intensity !== undefined) setDir1Intensity(cfg.dir1Intensity);
      if (cfg.dir1Position !== undefined) setDir1Position(cfg.dir1Position);
      if (cfg.dir2Color !== undefined) setDir2Color(cfg.dir2Color);
      if (cfg.dir2Intensity !== undefined) setDir2Intensity(cfg.dir2Intensity);
      if (cfg.dir2Position !== undefined) setDir2Position(cfg.dir2Position);
      if (cfg.rimColor !== undefined) setRimColor(cfg.rimColor);
      if (cfg.rimIntensity !== undefined) setRimIntensity(cfg.rimIntensity);
      if (cfg.rimPosition !== undefined) setRimPosition(cfg.rimPosition);
      if (cfg.modelScale !== undefined) setModelScale(cfg.modelScale);
      if (cfg.modelRotSpeed !== undefined) setModelRotSpeed(cfg.modelRotSpeed);
      if (cfg.modelRotX !== undefined) setModelRotX(cfg.modelRotX);
      if (cfg.modelRotY !== undefined) setModelRotY(cfg.modelRotY);
      if (cfg.modelRotZ !== undefined) setModelRotZ(cfg.modelRotZ);

      if (cfg.modelPosX !== undefined) setModelPosX(cfg.modelPosX);
      else if (cfg.modelPosition) {
        const parts = cfg.modelPosition.split(' ').map(Number);
        if (parts.length >= 3 && !parts.some(isNaN)) {
          setModelPosX(parts[0]);
          setModelPosY(parts[1]);
          setModelPosZ(parts[2]);
        }
      }
      if (cfg.modelPosY !== undefined) setModelPosY(cfg.modelPosY);
      if (cfg.modelPosZ !== undefined) setModelPosZ(cfg.modelPosZ);

      if (cfg.matMetalness !== undefined && cfg.matMetalness >= 0) {
        setMatMetalness(cfg.matMetalness);
        setUseNativePBR(false);
      } else {
        setMatMetalness(-1);
        setUseNativePBR(true);
      }
      if (cfg.matRoughness !== undefined && cfg.matRoughness >= 0) {
        setMatRoughness(cfg.matRoughness);
      } else {
        setMatRoughness(-1);
      }

      if (cfg.matEmissive !== undefined) setMatEmissive(cfg.matEmissive);
      if (cfg.matEmissiveIntensity !== undefined) setMatEmissiveIntensity(cfg.matEmissiveIntensity);
      if (cfg.matWireframe !== undefined) setMatWireframe(cfg.matWireframe);
      if (cfg.matOpacity !== undefined) setMatOpacity(cfg.matOpacity);
      if (cfg.fogColor !== undefined) setFogColor(cfg.fogColor);
      if (cfg.fogDensity !== undefined) setFogDensity(cfg.fogDensity);
      if (cfg.showBuyButton !== undefined) setShowBuyButton(cfg.showBuyButton);
      if (cfg.buyButtonColor !== undefined) setBuyButtonColor(cfg.buyButtonColor);
      if (cfg.mediaPlaying !== undefined) setMediaPlaying(cfg.mediaPlaying);
      if (cfg.videoTargetMesh !== undefined) setVideoTargetMesh(cfg.videoTargetMesh);
      if (cfg.videoFlipX !== undefined) setVideoFlipX(!!cfg.videoFlipX);
      if (cfg.videoScale !== undefined) setVideoScale(Number(cfg.videoScale));
      if (cfg.videoOffsetX !== undefined) setVideoOffsetX(Number(cfg.videoOffsetX));
      if (cfg.videoOffsetY !== undefined) setVideoOffsetY(Number(cfg.videoOffsetY));
      if (cfg.videoOffsetZ !== undefined) setVideoOffsetZ(Number(cfg.videoOffsetZ));
      if (cfg.videoRotation !== undefined) setVideoRotation(Number(cfg.videoRotation));
      if (cfg.videoTextureRepeatX !== undefined) setVideoTextureRepeatX(Number(cfg.videoTextureRepeatX));
      if (cfg.videoTextureRepeatY !== undefined) setVideoTextureRepeatY(Number(cfg.videoTextureRepeatY));
      if (cfg.videoTextureOffsetX !== undefined) setVideoTextureOffsetX(Number(cfg.videoTextureOffsetX));
      if (cfg.aspectRatio !== undefined) setVideoAspectRatio(cfg.aspectRatio);
      else if (cfg.videoAspectRatio !== undefined) setVideoAspectRatio(cfg.videoAspectRatio);
      else if (isYouTubeShortUrl(videoUrl)) setVideoAspectRatio('9:16');
      else setVideoAspectRatio('16:9');

      // Populate Camera Tracking Settings if configured on batch
      const tCfg = cfg.trackingConfig || cfg.tracking || null;
      if (tCfg) {
        if (tCfg.filterMinCF !== undefined) setTrackingFilterMinCF(Number(tCfg.filterMinCF));
        if (tCfg.filterBeta !== undefined) setTrackingFilterBeta(Number(tCfg.filterBeta));
        if (tCfg.missTolerance !== undefined) setTrackingMissTolerance(Number(tCfg.missTolerance));
        if (tCfg.warmupTolerance !== undefined) setTrackingWarmupTolerance(Number(tCfg.warmupTolerance));
        if (tCfg.maxTrack !== undefined) setTrackingMaxTrack(Number(tCfg.maxTrack));
        if (tCfg.targetIndex !== undefined) setTrackingTargetIndex(Number(tCfg.targetIndex));
        if (tCfg.showStats !== undefined) setTrackingShowStats(!!tCfg.showStats);
        if (tCfg.uiLoading !== undefined) setTrackingUiLoading(tCfg.uiLoading);
        if (tCfg.uiScanning !== undefined) setTrackingUiScanning(tCfg.uiScanning);
        if (tCfg.uiError !== undefined) setTrackingUiError(tCfg.uiError);
      }

      // Populate AR Portal & Virtual Window Settings if configured on batch
      const pCfg = cfg.portalConfig || cfg.portal || null;
      if (pCfg) {
        if (pCfg.enabled !== undefined) setPortalEnabled(Boolean(pCfg.enabled));
        if (pCfg.preset) setPortalPreset(pCfg.preset);
        if (pCfg.shape) setPortalShape(pCfg.shape);
        if (pCfg.width !== undefined) setPortalWidth(Number(pCfg.width));
        if (pCfg.height !== undefined) setPortalHeight(Number(pCfg.height));
        if (pCfg.radius !== undefined) setPortalRadius(Number(pCfg.radius));
        if (pCfg.depth !== undefined) setPortalDepth(Number(pCfg.depth));
        if (pCfg.frameColor) setPortalFrameColor(pCfg.frameColor);
        if (pCfg.frameWidth !== undefined) setPortalFrameWidth(Number(pCfg.frameWidth));
        if (pCfg.frameEmissive) setPortalFrameEmissive(pCfg.frameEmissive);
        if (pCfg.frameEmissiveIntensity !== undefined) setPortalFrameEmissiveIntensity(Number(pCfg.frameEmissiveIntensity));
        if (pCfg.frameGlow !== undefined) setPortalFrameGlow(Boolean(pCfg.frameGlow));
        if (pCfg.glassTint) setPortalGlassTint(pCfg.glassTint);
        if (pCfg.glassOpacity !== undefined) setPortalGlassOpacity(Number(pCfg.glassOpacity));
        if (pCfg.posX !== undefined) setPortalPosX(Number(pCfg.posX));
        if (pCfg.posY !== undefined) setPortalPosY(Number(pCfg.posY));
        if (pCfg.posZ !== undefined) setPortalPosZ(Number(pCfg.posZ));
        if (pCfg.rotX !== undefined) setPortalRotX(Number(pCfg.rotX));
        if (pCfg.rotY !== undefined) setPortalRotY(Number(pCfg.rotY));
        if (pCfg.rotZ !== undefined) setPortalRotZ(Number(pCfg.rotZ));
        if (pCfg.interiorType) setPortalInteriorType(pCfg.interiorType);
        if (pCfg.skyboxUrl !== undefined && !String(pCfg.skyboxUrl).startsWith('blob:')) setPortalSkyboxUrl(pCfg.skyboxUrl);
        if (pCfg.skyboxScale !== undefined) setPortalSkyboxScale(Number(pCfg.skyboxScale));
        if (pCfg.skyboxPosX !== undefined) setPortalSkyboxPosX(Number(pCfg.skyboxPosX));
        if (pCfg.skyboxPosY !== undefined) setPortalSkyboxPosY(Number(pCfg.skyboxPosY));
        if (pCfg.skyboxPosZ !== undefined) setPortalSkyboxPosZ(Number(pCfg.skyboxPosZ));
        if (pCfg.skyboxRotX !== undefined) setPortalSkyboxRotX(Number(pCfg.skyboxRotX));
        if (pCfg.skyboxRotY !== undefined) setPortalSkyboxRotY(Number(pCfg.skyboxRotY));
        if (pCfg.skyboxRotZ !== undefined) setPortalSkyboxRotZ(Number(pCfg.skyboxRotZ));
        if (pCfg.skyboxBlur !== undefined) setPortalSkyboxBlur(Number(pCfg.skyboxBlur));
        if (pCfg.interiorColor) setPortalInteriorColor(pCfg.interiorColor);
        if (pCfg.wallColor) setPortalWallColor(pCfg.wallColor);
        if (pCfg.floorColor) setPortalFloorColor(pCfg.floorColor);
        if (pCfg.gridColor) setPortalGridColor(pCfg.gridColor);
        if (pCfg.interiorLightColor) setPortalLightColor(pCfg.interiorLightColor);
        if (pCfg.interiorLightIntensity !== undefined) setPortalLightIntensity(Number(pCfg.interiorLightIntensity));
        if (pCfg.interiorModelType) setPortalModelType(pCfg.interiorModelType);
        if (pCfg.artifactType) setPortalArtifactType(pCfg.artifactType);
        if (pCfg.customModelUrl !== undefined && !String(pCfg.customModelUrl).startsWith('blob:')) setPortalCustomModelUrl(pCfg.customModelUrl);
        if (pCfg.modelScale !== undefined) setPortalModelScale(Number(pCfg.modelScale));
        if (pCfg.modelPosX !== undefined) setPortalModelPosX(Number(pCfg.modelPosX));
        if (pCfg.modelPosY !== undefined) setPortalModelPosY(Number(pCfg.modelPosY));
        if (pCfg.modelPosZ !== undefined) setPortalModelPosZ(Number(pCfg.modelPosZ));
        if (pCfg.modelRotSpeed !== undefined) setPortalModelRotSpeed(Number(pCfg.modelRotSpeed));
        if (pCfg.modelRotX !== undefined) setPortalModelRotX(Number(pCfg.modelRotX));
        if (pCfg.modelRotY !== undefined) setPortalModelRotY(Number(pCfg.modelRotY));
        if (pCfg.modelRotZ !== undefined) setPortalModelRotZ(Number(pCfg.modelRotZ));
        if (pCfg.showVideo !== undefined) setPortalShowVideo(Boolean(pCfg.showVideo));
        if (pCfg.videoUrl !== undefined && !String(pCfg.videoUrl).startsWith('blob:')) setPortalVideoUrl(pCfg.videoUrl);
        if (pCfg.videoScale !== undefined) setPortalVideoScale(Number(pCfg.videoScale));
        if (pCfg.videoPosY !== undefined) setPortalVideoPosY(Number(pCfg.videoPosY));
        if (pCfg.videoPosZ !== undefined) setPortalVideoPosZ(Number(pCfg.videoPosZ));
        if (pCfg.particles) setPortalParticles(pCfg.particles);
        if (pCfg.particleCount !== undefined) setPortalParticleCount(Number(pCfg.particleCount));
        if (pCfg.particleColor) setPortalParticleColor(pCfg.particleColor);
        if (pCfg.particleSpeed !== undefined) setPortalParticleSpeed(Number(pCfg.particleSpeed));
        if (pCfg.floatingText !== undefined) setPortalFloatingText(pCfg.floatingText);
        if (pCfg.textColor) setPortalTextColor(pCfg.textColor);
        if (pCfg.textScale !== undefined) setPortalTextScale(Number(pCfg.textScale));
        if (pCfg.textPosY !== undefined) setPortalTextPosY(Number(pCfg.textPosY));
        if (pCfg.textPosZ !== undefined) setPortalTextPosZ(Number(pCfg.textPosZ));
        if (pCfg.hideOutsideModel !== undefined) setPortalHideOutsideModel(Boolean(pCfg.hideOutsideModel));
      } else {
        setPortalEnabled(false);
      }

      // Populate AR Particle System Settings if configured on batch
      const partCfg = cfg.particleConfig || cfg.particleSystem || cfg.particlesConfig || null;
      if (partCfg) {
        if (partCfg.enabled !== undefined) setParticleSystemEnabled(Boolean(partCfg.enabled));
        if (partCfg.preset) setParticlePreset(partCfg.preset);
        if (partCfg.count !== undefined) setParticleCount(Number(partCfg.count));
        if (partCfg.size !== undefined) setParticleSize(Number(partCfg.size));
        if (partCfg.color) setParticleColor(partCfg.color);
        if (partCfg.colorSecondary) setParticleColorSecondary(partCfg.colorSecondary);
        if (partCfg.opacity !== undefined) setParticleOpacity(Number(partCfg.opacity));
        if (partCfg.blending) setParticleBlending(partCfg.blending);
        if (partCfg.speed !== undefined) setParticleSpeed(Number(partCfg.speed));
        if (partCfg.spreadX !== undefined) setParticleSpreadX(Number(partCfg.spreadX));
        if (partCfg.spreadY !== undefined) setParticleSpreadY(Number(partCfg.spreadY));
        if (partCfg.spreadZ !== undefined) setParticleSpreadZ(Number(partCfg.spreadZ));
        if (partCfg.direction) setParticleDirection(partCfg.direction);
        if (partCfg.shape) setParticleShape(partCfg.shape);
        if (partCfg.posX !== undefined) setParticlePosX(Number(partCfg.posX));
        if (partCfg.posY !== undefined) setParticlePosY(Number(partCfg.posY));
        if (partCfg.posZ !== undefined) setParticlePosZ(Number(partCfg.posZ));
        if (partCfg.rotationSpeed !== undefined) setParticleRotationSpeed(Number(partCfg.rotationSpeed));
        if (partCfg.twinkle !== undefined) setParticleTwinkle(Boolean(partCfg.twinkle));
      } else {
        setParticleSystemEnabled(false);
      }

      // Populate Live Website Layer Settings if configured on batch
      const webCfg = cfg.websiteLayer || cfg.webLayer || cfg.website || null;
      if (webCfg) {
        if (webCfg.enabled !== undefined) setWebsiteEnabled(Boolean(webCfg.enabled));
        if (webCfg.url !== undefined) setWebsiteUrl(webCfg.url);
        if (webCfg.width !== undefined) setWebsiteWidth(Number(webCfg.width));
        if (webCfg.height !== undefined) setWebsiteHeight(Number(webCfg.height));
        if (webCfg.aspectRatio !== undefined) setWebsiteAspectRatio(webCfg.aspectRatio);
        if (webCfg.resolution !== undefined) setWebsiteResolution(webCfg.resolution);
        if (webCfg.interactive !== undefined) setWebsiteInteractive(Boolean(webCfg.interactive));
        if (webCfg.opacity !== undefined) setWebsiteOpacity(Number(webCfg.opacity));
        if (webCfg.frameStyle !== undefined) setWebsiteFrameStyle(webCfg.frameStyle);
        if (webCfg.frameColor !== undefined) setWebsiteFrameColor(webCfg.frameColor);
        if (webCfg.frameGlow !== undefined) setWebsiteFrameGlow(Boolean(webCfg.frameGlow));
        if (webCfg.curved !== undefined) setWebsiteCurved(Boolean(webCfg.curved));
        if (webCfg.curveRadius !== undefined) setWebsiteCurveRadius(Number(webCfg.curveRadius));
        if (webCfg.billboard !== undefined) setWebsiteBillboard(Boolean(webCfg.billboard));
        if (webCfg.posX !== undefined) setWebsitePosX(Number(webCfg.posX));
        if (webCfg.posY !== undefined) setWebsitePosY(Number(webCfg.posY));
        if (webCfg.posZ !== undefined) setWebsitePosZ(Number(webCfg.posZ));
        if (webCfg.rotX !== undefined) setWebsiteRotX(Number(webCfg.rotX));
        if (webCfg.rotY !== undefined) setWebsiteRotY(Number(webCfg.rotY));
        if (webCfg.rotZ !== undefined) setWebsiteRotZ(Number(webCfg.rotZ));
        if (webCfg.scale !== undefined) setWebsiteScale(Number(webCfg.scale));
        if (webCfg.showAddressBar !== undefined) setWebsiteShowAddressBar(Boolean(webCfg.showAddressBar));
      } else {
        setWebsiteEnabled(false);
      }

      // Populate Additional 3D Primitive Geometries if configured on batch
      const loadedGeoms = cfg.additionalGeometries || data.additionalGeometries || data.arExperience?.additionalGeometries || null;
      if (Array.isArray(loadedGeoms)) {
        setAdditionalGeometries(loadedGeoms);
      } else {
        setAdditionalGeometries([]);
      }

      // Populate Custom 3D Typography Texts if configured on batch
      const loadedTexts = cfg.custom3DTexts || data.custom3DTexts || data.arExperience?.custom3DTexts || null;
      if (Array.isArray(loadedTexts)) {
        setCustom3DTexts(loadedTexts);
      } else {
        setCustom3DTexts([]);
      }

      // Populate Custom Multi-Source Lighting if configured on batch
      const loadedLights = cfg.customLights || data.customLights || data.arExperience?.customLights || null;
      if (Array.isArray(loadedLights)) {
        setCustomLights(loadedLights);
      } else {
        setCustomLights([]);
      }

      // Populate Custom External 3D Models if configured on batch
      const loadedModels = cfg.customModels || data.customModels || data.arExperience?.customModels || null;
      if (Array.isArray(loadedModels)) {
        setCustomModels(loadedModels);
      } else {
        setCustomModels([]);
      }

      // Populate Scene Groups if configured on batch
      const loadedGroups = cfg.sceneGroups || data.sceneGroups || data.arExperience?.sceneGroups || null;
      if (Array.isArray(loadedGroups)) {
        setSceneGroups(loadedGroups);
      } else {
        setSceneGroups([]);
      }

      if (cfg && cfg.meshOverrides) {
        const loadedDeleted = Object.entries(cfg.meshOverrides)
          .filter(([_, ovr]) => ovr && ovr.deleted)
          .map(([name]) => name);
        if (loadedDeleted.length > 0) {
          setDeletedMeshNames(loadedDeleted);
        }
      }

      // Target Marker Reference Settings
      const markerCfg = cfg?.markerConfig || cfg?.targetMarker || null;
      let validMarkerUrl = '';
      if (markerCfg) {
        if (markerCfg.visible !== undefined) setMarkerVisible(Boolean(markerCfg.visible));
        if (markerCfg.opacity !== undefined) setMarkerOpacity(Number(markerCfg.opacity));
        if (markerCfg.width !== undefined) setMarkerWidth(Number(markerCfg.width));
        if (markerCfg.imageUrl && typeof markerCfg.imageUrl === 'string' && !markerCfg.imageUrl.startsWith('blob:')) {
          validMarkerUrl = markerCfg.imageUrl;
          setMarkerImageUrl(markerCfg.imageUrl);
          if (markerCfg.aspectRatio) setMarkerAspectRatio(Number(markerCfg.aspectRatio));
          setMarkerInfo({ width: markerCfg.widthPx, height: markerCfg.heightPx, source: 'batch_config' });
        }
      }

      // Sanitize cfg for marker payload so stale blob URLs in cfg.markerConfig.imageUrl are excluded
      const cleanMarkerCfg = cfg?.markerConfig ? {
        ...cfg.markerConfig,
        imageUrl: (cfg.markerConfig.imageUrl && !cfg.markerConfig.imageUrl.startsWith('blob:')) ? cfg.markerConfig.imageUrl : ''
      } : null;
      const cleanCfg = cfg ? { ...cfg, markerConfig: cleanMarkerCfg } : null;

      // Automatically load/extract marker from batch (marker image, Firebase Storage path, or .mind file)
      const batchMarkerPayload = {
        batchId: batchId.trim(),
        customMarkerUrl: validMarkerUrl || null,
        data,
        batchData: (typeof batchSnap !== 'undefined' && batchSnap?.exists()) ? batchSnap.data() : null,
        assetData: (typeof assetSnap !== 'undefined' && assetSnap?.exists()) ? assetSnap.data() : null,
        cfg: cleanCfg
      };
      setMarkerLoading(true);
      loadMarkerForBatch(batchMarkerPayload).then((res) => {
        if (res && (res.blobUrl || res.dataUrl)) {
          const activeUrl = res.dataUrl || res.blobUrl;
          if (activeUrl) {
            if (typeof window !== 'undefined') {
              window.__starwear_active_marker_image = activeUrl;
            }
            setMarkerImageUrl(activeUrl);
            setMarkerAspectRatio(res.aspectRatio || 0.5926);
            setMarkerInfo({
              width: res.width,
              height: res.height,
              source: res.source,
              previewWidth: res.previewWidth,
              previewHeight: res.previewHeight,
              mindFilePath: res.mindFilePath
            });
            setMarkerVisible(true);
          }
        }
      }).catch((err) => {
        console.warn("[ARTest] Failed to load marker image for batch:", err);
      }).finally(() => {
        setMarkerLoading(false);
      });

      setActiveVideoUrl(videoUrl);
      if (isYouTubeUrl(videoUrl)) {
        setVideoMode('youtube');
        setYoutubeUrlInput(videoUrl);
      } else if (videoUrl) {
        setVideoMode('webgl');
      }
      setArData({
        ...data,
        videoUrl,
        config: cfg,
        gltfPath: resolvedModelUrl,
        modelUrl: resolvedModelUrl,
        arExperience: {
          ...(data.arExperience || {}),
          modelUrl: resolvedModelUrl,
          config: cfg
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildCurrentArConfig = () => {
    const meshOverrides = {};
    meshList.forEach((m) => {
      meshOverrides[m.name] = {
        position: m.position,
        rotation: m.rotation,
        scale: m.scale,
        visible: m.visible,
        material: { ...(m.material || {}) }
      };
    });
    deletedMeshNames.forEach((name) => {
      meshOverrides[name] = {
        deleted: true,
        visible: false
      };
    });

    const currentVidUrl = activeVideoUrl || customVideoUrl || arData?.videoUrl || arData?.video_url || '';

    return {
      videoUrl: currentVidUrl,
      video_url: currentVidUrl,
      video_file_path: arData?.config?.video_file_path || arData?.video_file_path || '',
      videoTargetMesh,
      videoFlipX,
      videoScale,
      videoOffsetX,
      videoOffsetY,
      videoOffsetZ,
      videoRotation,
      videoTextureRepeatX,
      videoTextureRepeatY,
      videoTextureOffsetX,
      videoTextureOffsetY,
      aspectRatio: videoAspectRatio,
      videoAspectRatio,
      ambientColor,
      ambientIntensity,
      dir1Color,
      dir1Intensity,
      dir1Position,
      dir2Color,
      dir2Intensity,
      dir2Position,
      rimColor,
      rimIntensity,
      rimPosition,
      modelScale,
      modelRotSpeed,
      modelRotX,
      modelRotY,
      modelRotZ,
      modelRotation: `${modelRotX} ${modelRotY} ${modelRotZ}`,
      modelPosX,
      modelPosY,
      modelPosZ,
      modelPosition: `${modelPosX} ${modelPosY} ${modelPosZ}`,
      matMetalness: useNativePBR ? -1 : (matMetalness < 0 ? 0.0 : matMetalness),
      matRoughness: useNativePBR ? -1 : (matRoughness < 0 ? 1.0 : matRoughness),
      matEmissive,
      matEmissiveIntensity,
      matWireframe,
      matOpacity,
      useNativePBR,
      fogColor,
      fogDensity,
      showBuyButton,
      buyButtonColor,
      mediaPlaying,
      meshOverrides,
      trackingConfig: {
        filterMinCF: Number(trackingFilterMinCF),
        filterBeta: Number(trackingFilterBeta),
        missTolerance: Number(trackingMissTolerance),
        warmupTolerance: Number(trackingWarmupTolerance),
        maxTrack: Number(trackingMaxTrack),
        targetIndex: Number(trackingTargetIndex),
        showStats: Boolean(trackingShowStats),
        uiLoading: trackingUiLoading,
        uiScanning: trackingUiScanning,
        uiError: trackingUiError
      },
      markerConfig: {
        visible: Boolean(markerVisible),
        opacity: Number(markerOpacity),
        width: Number(markerWidth),
        aspectRatio: Number(markerAspectRatio),
        imageUrl: (markerImageUrl && typeof markerImageUrl === 'string' && !markerImageUrl.startsWith('blob:') && !markerImageUrl.startsWith('data:')) ? markerImageUrl : (markerInfo?.source === 'custom' && !markerImageUrl?.startsWith('blob:') ? markerImageUrl : ''),
        widthPx: markerInfo?.width,
        heightPx: markerInfo?.height,
        source: markerInfo?.source
      },
      portalConfig: {
        enabled: Boolean(portalEnabled),
        preset: portalPreset,
        shape: portalShape,
        width: Number(portalWidth),
        height: Number(portalHeight),
        radius: Number(portalRadius),
        depth: Number(portalDepth),
        frameColor: portalFrameColor,
        frameWidth: Number(portalFrameWidth),
        frameEmissive: portalFrameEmissive,
        frameEmissiveIntensity: Number(portalFrameEmissiveIntensity),
        frameGlow: Boolean(portalFrameGlow),
        glassTint: portalGlassTint,
        glassOpacity: Number(portalGlassOpacity),
        posX: Number(portalPosX),
        posY: Number(portalPosY),
        posZ: Number(portalPosZ),
        rotX: Number(portalRotX),
        rotY: Number(portalRotY),
        rotZ: Number(portalRotZ),
        interiorType: portalInteriorType,
        skyboxUrl: portalSkyboxUrl,
        skyboxScale: Number(portalSkyboxScale),
        skyboxPosX: Number(portalSkyboxPosX),
        skyboxPosY: Number(portalSkyboxPosY),
        skyboxPosZ: Number(portalSkyboxPosZ),
        skyboxRotX: Number(portalSkyboxRotX),
        skyboxRotY: Number(portalSkyboxRotY),
        skyboxRotZ: Number(portalSkyboxRotZ),
        skyboxBlur: Number(portalSkyboxBlur),
        interiorColor: portalInteriorColor,
        wallColor: portalWallColor,
        floorColor: portalFloorColor,
        gridColor: portalGridColor,
        interiorLightColor: portalLightColor,
        interiorLightIntensity: Number(portalLightIntensity),
        interiorModelType: portalModelType,
        artifactType: portalArtifactType,
        customModelUrl: portalCustomModelUrl,
        modelScale: Number(portalModelScale),
        modelPosX: Number(portalModelPosX),
        modelPosY: Number(portalModelPosY),
        modelPosZ: Number(portalModelPosZ),
        modelRotSpeed: Number(portalModelRotSpeed),
        modelRotX: Number(portalModelRotX),
        modelRotY: Number(portalModelRotY),
        modelRotZ: Number(portalModelRotZ),
        showVideo: Boolean(portalShowVideo),
        videoUrl: portalVideoUrl || currentVidUrl,
        videoScale: Number(portalVideoScale),
        videoPosY: Number(portalVideoPosY),
        videoPosZ: Number(portalVideoPosZ),
        particles: portalParticles,
        particleCount: Number(portalParticleCount),
        particleColor: portalParticleColor,
        particleSpeed: Number(portalParticleSpeed),
        floatingText: portalFloatingText,
        textColor: portalTextColor,
        textScale: Number(portalTextScale),
        textPosY: Number(portalTextPosY),
        textPosZ: Number(portalTextPosZ),
        hideOutsideModel: Boolean(portalHideOutsideModel)
      },
      particleConfig: {
        enabled: Boolean(particleSystemEnabled),
        preset: particlePreset,
        count: Number(particleCount),
        size: Number(particleSize),
        color: particleColor,
        colorSecondary: particleColorSecondary,
        opacity: Number(particleOpacity),
        blending: particleBlending,
        speed: Number(particleSpeed),
        spreadX: Number(particleSpreadX),
        spreadY: Number(particleSpreadY),
        spreadZ: Number(particleSpreadZ),
        direction: particleDirection,
        shape: particleShape,
        posX: Number(particlePosX),
        posY: Number(particlePosY),
        posZ: Number(particlePosZ),
        rotationSpeed: Number(particleRotationSpeed),
        twinkle: Boolean(particleTwinkle)
      },
      additionalGeometries: additionalGeometries || [],
      customModels: (customModels || []).map(({ file, ...rest }) => rest),
      custom3DTexts: custom3DTexts || [],
      customLights: customLights || [],
      sceneGroups: sceneGroups || [],
      updatedAt: new Date().toISOString()
    };
  };

  const handleTryInAR = async () => {
    if (!batchId.trim()) return;
    setIsLaunchingAR(true);
    const targetBatch = batchId.trim();
    try {
      const currentConfig = buildCurrentArConfig();
      // 1. Instant local persistence for same-browser live preview
      try {
        localStorage.setItem(`starwear_live_preview_config_${targetBatch}`, JSON.stringify(currentConfig));
        localStorage.setItem('starwear_live_preview_config_last', JSON.stringify(currentConfig));
      } catch (storageErr) {
        console.warn('[ARTest] localStorage sync failed:', storageErr);
      }

      // 2. Synchronize to Firestore so physical markers / mobile devices get the live portal & particles
      try {
        const batchRef = doc(db, 'batches', targetBatch);
        const assetRef = doc(db, 'assets', targetBatch);
        const syncPayload = {
          ar_config: currentConfig,
          portalConfig: currentConfig.portalConfig,
          particleConfig: currentConfig.particleConfig,
          customModels: currentConfig.customModels || [],
          additionalGeometries: currentConfig.additionalGeometries || [],
          custom3DTexts: currentConfig.custom3DTexts || [],
          customLights: currentConfig.customLights || [],
          sceneGroups: currentConfig.sceneGroups || []
        };
        const launchBatch = writeBatch(db);
        launchBatch.set(batchRef, syncPayload, { merge: true });
        launchBatch.set(assetRef, syncPayload, { merge: true });
        await safeCommitBatch(launchBatch);
      } catch (fsErr) {
        console.warn('[ARTest] Background Firestore sync failed:', fsErr);
      }

      // 3. Open WebAR experience in new tab with cache-buster, portal flag, and particles flag
      const targetUrl = `/ar/${targetBatch}?t=${Date.now()}&portal=${portalEnabled ? '1' : '0'}&particles=${particleSystemEnabled ? '1' : '0'}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('[ARTest] Error launching AR experience:', err);
      window.open(`/ar/${targetBatch}?portal=${portalEnabled ? '1' : '0'}&particles=${particleSystemEnabled ? '1' : '0'}`, '_blank', 'noopener,noreferrer');
    } finally {
      setTimeout(() => setIsLaunchingAR(false), 1200);
    }
  };

  const handleSaveConfig = async () => {
    if (!batchId.trim()) {
      alert('Please enter a Batch ID in the input above before saving.');
      return;
    }

    const now = Date.now();
    if (isSavingConfigRef.current || (now - lastSaveTimeRef.current < 1500)) {
      console.warn('[ARTest] handleSaveConfig throttled or already running, ignoring duplicate invocation');
      return;
    }
    isSavingConfigRef.current = true;
    lastSaveTimeRef.current = now;

    setSavingConfig(true);
    setSaveSuccessMsg('');
    setUploadProgress('');

    try {
      let finalVideoUrl = activeVideoUrl || customVideoUrl || arData?.videoUrl || '';
      if (typeof finalVideoUrl === 'string' && finalVideoUrl.startsWith('blob:') && !selectedVideoFile) {
        finalVideoUrl = '';
      }
      let videoFilePath = arData?.config?.video_file_path || arData?.video_file_path || '';
      if (!finalVideoUrl) {
        videoFilePath = '';
      }
      let finalGltfUrl = localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || '';
      if (typeof finalGltfUrl === 'string' && finalGltfUrl.startsWith('blob:') && !selectedGlbFile) {
        finalGltfUrl = '';
      }
      let gltfFilePath = arData?.gltf_file_path || '';

      // 1. Upload Video File to Firebase Storage bucket if a new file was chosen
      if (selectedVideoFile) {
        setUploadProgress('Uploading video layer to Storage bucket...');
        const cleanName = selectedVideoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `assets/${batchId.trim()}/${cleanName}`;
        const videoRef = ref(storage, storagePath);

        await uploadBytes(videoRef, selectedVideoFile);
        const downloadUrl = await getDownloadURL(videoRef);

        finalVideoUrl = downloadUrl;
        videoFilePath = storagePath;
        setActiveVideoUrl(downloadUrl);
        setLocalVideoName(selectedVideoFile.name);
      }

      // 2. Upload GLB 3D Model file to Firebase Storage bucket if a new file was chosen
      if (selectedGlbFile) {
        setUploadProgress('Uploading 3D model (.glb) to Storage bucket...');
        const cleanGlbName = selectedGlbFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const glbStoragePath = `assets/${batchId.trim()}/${cleanGlbName}`;
        const glbRef = ref(storage, glbStoragePath);

        await uploadBytes(glbRef, selectedGlbFile);
        const glbDownloadUrl = await getDownloadURL(glbRef);

        finalGltfUrl = glbDownloadUrl;
        gltfFilePath = glbStoragePath;
      }

      // 2b. Upload any staged custom portal skybox or custom portal GLB files
      let finalPortalSkyboxUrl = portalSkyboxUrl;
      if (selectedPortalSkyboxFile) {
        setUploadProgress('Uploading portal 360 skybox to Storage...');
        const cleanSkyName = selectedPortalSkyboxFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const skyStoragePath = `assets/${batchId.trim()}/portal_${Date.now()}_${cleanSkyName}`;
        const skyRef = ref(storage, skyStoragePath);
        await uploadBytes(skyRef, selectedPortalSkyboxFile);
        finalPortalSkyboxUrl = await getDownloadURL(skyRef);
        setPortalSkyboxUrl(finalPortalSkyboxUrl);
      } else if (typeof finalPortalSkyboxUrl === 'string' && finalPortalSkyboxUrl.startsWith('blob:')) {
        finalPortalSkyboxUrl = '';
      }

      let finalPortalGlbUrl = portalCustomModelUrl;
      if (selectedPortalGlbFile) {
        setUploadProgress('Uploading portal interior 3D model to Storage...');
        const cleanPName = selectedPortalGlbFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const pGlbStoragePath = `assets/${batchId.trim()}/portal_model_${Date.now()}_${cleanPName}`;
        const pGlbRef = ref(storage, pGlbStoragePath);
        await uploadBytes(pGlbRef, selectedPortalGlbFile);
        finalPortalGlbUrl = await getDownloadURL(pGlbRef);
        setPortalCustomModelUrl(finalPortalGlbUrl);
      } else if (typeof finalPortalGlbUrl === 'string' && finalPortalGlbUrl.startsWith('blob:')) {
        finalPortalGlbUrl = '';
      }

      // 2c. Upload any staged custom mesh textures to Storage bucket
      const textureUploadResults = new Map();
      if (pendingTextureFilesRef.current.size > 0) {
        for (const [meshName, pending] of pendingTextureFilesRef.current.entries()) {
          if (pending?.file) {
            setUploadProgress(`Uploading texture for ${meshName} to Storage...`);
            const cleanMeshName = meshName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const cleanFileName = pending.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `assets/${batchId.trim()}/textures/${cleanMeshName}_${Date.now()}_${cleanFileName}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, pending.file);
            const downloadUrl = await getDownloadURL(storageRef);
            textureUploadResults.set(meshName, { downloadUrl, storagePath, fileName: pending.file.name });
          }
        }
        pendingTextureFilesRef.current.clear();
      }

      // 2d. Upload staged custom target marker image to Storage bucket if present
      let finalMarkerImageUrl = markerImageUrl;
      if (stagedMarkerFileRef.current) {
        setUploadProgress('Uploading target marker image to Storage...');
        const cleanMarkerName = stagedMarkerFileRef.current.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const markerStoragePath = `assets/${batchId.trim()}/marker_${Date.now()}_${cleanMarkerName}`;
        const markerRef = ref(storage, markerStoragePath);
        await uploadBytes(markerRef, stagedMarkerFileRef.current);
        finalMarkerImageUrl = await getDownloadURL(markerRef);
        setMarkerImageUrl(finalMarkerImageUrl);
        if (typeof window !== 'undefined') {
          window.__starwear_active_marker_image = finalMarkerImageUrl;
        }
        stagedMarkerFileRef.current = null;
      } else if (typeof finalMarkerImageUrl === 'string' && finalMarkerImageUrl.startsWith('blob:')) {
        finalMarkerImageUrl = '';
      }

      // 2e. Upload any staged custom external 3D model files (.glb/.gltf) to Firebase Storage
      let cleanedCustomModels = [];
      if (Array.isArray(customModels) && customModels.length > 0) {
        setUploadProgress('Uploading external 3D models to Storage...');
        cleanedCustomModels = await Promise.all(
          customModels.map(async (m) => {
            let finalUrl = m.url;
            if (m.file) {
              setUploadProgress(`Uploading 3D model ${m.name || m.fileName || 'model'} to Storage...`);
              const cleanFileName = (m.fileName || `${m.id}.glb`).replace(/[^a-zA-Z0-9._-]/g, '_');
              const storagePath = `assets/${batchId.trim()}/custom_models/${m.id}_${cleanFileName}`;
              const modelRef = ref(storage, storagePath);
              await uploadBytes(modelRef, m.file, {
                contentType: 'model/gltf-binary',
                customMetadata: {
                  batchId: batchId.trim(),
                  modelId: m.id,
                  originalName: m.fileName || m.name || ''
                }
              });
              finalUrl = await getDownloadURL(modelRef);
            }
            // Strip non-serializable File object so Firestore setDoc does not throw
            const { file, ...cleanModel } = m;
            return {
              ...cleanModel,
              url: finalUrl
            };
          })
        );
        // Synchronize local state with permanent download URLs
        setCustomModels(cleanedCustomModels);
      }

      // 2f. Upload any staged custom shape textures to Firebase Storage
      let cleanedAdditionalGeometries = additionalGeometries || [];
      if (Array.isArray(additionalGeometries) && additionalGeometries.length > 0) {
        cleanedAdditionalGeometries = await Promise.all(
          additionalGeometries.map(async (g) => {
            let finalTexUrl = g.textureUrl || '';
            let finalStoragePath = g.textureStoragePath || '';
            const pending = pendingShapeTexturesRef.current?.get(g.id);
            if (pending?.file) {
              setUploadProgress(`Uploading shape texture for ${g.name || g.id} to Storage...`);
              const cleanFileName = (pending.file.name || `${g.id}.png`).replace(/[^a-zA-Z0-9._-]/g, '_');
              const storagePath = `assets/${batchId.trim()}/textures/shapes/${g.id}_${Date.now()}_${cleanFileName}`;
              const shapeTexRef = ref(storage, storagePath);
              await uploadBytes(shapeTexRef, pending.file);
              finalTexUrl = await getDownloadURL(shapeTexRef);
              finalStoragePath = storagePath;
            } else if (typeof finalTexUrl === 'string' && finalTexUrl.startsWith('blob:')) {
              finalTexUrl = '';
            }

            const cleanGeom = { ...g };
            delete cleanGeom.texturePreviewUrl;

            if (finalTexUrl) {
              cleanGeom.textureUrl = finalTexUrl;
              cleanGeom.textureStoragePath = finalStoragePath;
            } else {
              delete cleanGeom.textureUrl;
              delete cleanGeom.textureStoragePath;
              delete cleanGeom.textureFileName;
            }

            return cleanGeom;
          })
        );
        pendingShapeTexturesRef.current?.clear();
        setAdditionalGeometries(cleanedAdditionalGeometries);
      }

      setUploadProgress('Saving batch configuration to Firestore...');

      // 3. Build meshOverrides dictionary
      const meshOverrides = {};
      meshList.forEach((m) => {
        const freshTex = textureUploadResults.get(m.name);
        const matPayload = {
          ...m.material,
          ...(freshTex
            ? {
              textureUrl: freshTex.downloadUrl,
              textureStoragePath: freshTex.storagePath,
              textureFileName: freshTex.fileName,
              hasCustomTexture: true
            }
            : {})
        };
        meshOverrides[m.name] = {
          position: m.position,
          rotation: m.rotation,
          scale: m.scale,
          visible: m.visible,
          material: matPayload
        };
      });
      // Explicitly mark deleted meshes so downstream AR experiences and viewers remove them
      deletedMeshNames.forEach((name) => {
        meshOverrides[name] = {
          deleted: true,
          visible: false
        };
      });

      const arConfigPayload = {
        videoUrl: finalVideoUrl,
        video_url: finalVideoUrl,
        video_file_path: videoFilePath,
        videoTargetMesh,
        videoFlipX,
        videoScale,
        videoOffsetX,
        videoOffsetY,
        videoOffsetZ,
        videoRotation,
        videoTextureRepeatX,
        videoTextureRepeatY,
        videoTextureOffsetX,
        videoTextureOffsetY,
        aspectRatio: videoAspectRatio,
        videoAspectRatio,
        ambientColor,
        ambientIntensity,
        dir1Color,
        dir1Intensity,
        dir1Position,
        dir2Color,
        dir2Intensity,
        dir2Position,
        rimColor,
        rimIntensity,
        rimPosition,
        modelScale,
        modelRotSpeed,
        modelRotX,
        modelRotY,
        modelRotZ,
        modelRotation: `${modelRotX} ${modelRotY} ${modelRotZ}`,
        modelPosX,
        modelPosY,
        modelPosZ,
        modelPosition: `${modelPosX} ${modelPosY} ${modelPosZ}`,
        matMetalness: useNativePBR ? -1 : (matMetalness < 0 ? 0.0 : matMetalness),
        matRoughness: useNativePBR ? -1 : (matRoughness < 0 ? 1.0 : matRoughness),
        matEmissive,
        matEmissiveIntensity,
        matWireframe,
        matOpacity,
        useNativePBR,
        fogColor,
        fogDensity,
        showBuyButton,
        buyButtonColor,
        mediaPlaying,
        meshOverrides,
        trackingConfig: {
          filterMinCF: Number(trackingFilterMinCF),
          filterBeta: Number(trackingFilterBeta),
          missTolerance: Number(trackingMissTolerance),
          warmupTolerance: Number(trackingWarmupTolerance),
          maxTrack: Number(trackingMaxTrack),
          targetIndex: Number(trackingTargetIndex),
          showStats: Boolean(trackingShowStats),
          uiLoading: trackingUiLoading,
          uiScanning: trackingUiScanning,
          uiError: trackingUiError
        },
        portalConfig: {
          enabled: Boolean(portalEnabled),
          preset: portalPreset,
          shape: portalShape,
          width: Number(portalWidth),
          height: Number(portalHeight),
          radius: Number(portalRadius),
          depth: Number(portalDepth),
          frameColor: portalFrameColor,
          frameWidth: Number(portalFrameWidth),
          frameEmissive: portalFrameEmissive,
          frameEmissiveIntensity: Number(portalFrameEmissiveIntensity),
          frameGlow: Boolean(portalFrameGlow),
          glassTint: portalGlassTint,
          glassOpacity: Number(portalGlassOpacity),
          posX: Number(portalPosX),
          posY: Number(portalPosY),
          posZ: Number(portalPosZ),
          rotX: Number(portalRotX),
          rotY: Number(portalRotY),
          rotZ: Number(portalRotZ),
          interiorType: portalInteriorType,
          skyboxUrl: (finalPortalSkyboxUrl && !finalPortalSkyboxUrl.startsWith('blob:')) ? finalPortalSkyboxUrl : '',
          skyboxScale: Number(portalSkyboxScale),
          skyboxPosX: Number(portalSkyboxPosX),
          skyboxPosY: Number(portalSkyboxPosY),
          skyboxPosZ: Number(portalSkyboxPosZ),
          skyboxRotX: Number(portalSkyboxRotX),
          skyboxRotY: Number(portalSkyboxRotY),
          skyboxRotZ: Number(portalSkyboxRotZ),
          skyboxBlur: Number(portalSkyboxBlur),
          interiorColor: portalInteriorColor,
          wallColor: portalWallColor,
          floorColor: portalFloorColor,
          gridColor: portalGridColor,
          interiorLightColor: portalLightColor,
          interiorLightIntensity: Number(portalLightIntensity),
          interiorModelType: portalModelType,
          artifactType: portalArtifactType,
          customModelUrl: (finalPortalGlbUrl && !finalPortalGlbUrl.startsWith('blob:')) ? finalPortalGlbUrl : '',
          modelScale: Number(portalModelScale),
          modelPosX: Number(portalModelPosX),
          modelPosY: Number(portalModelPosY),
          modelPosZ: Number(portalModelPosZ),
          modelRotSpeed: Number(portalModelRotSpeed),
          modelRotX: Number(portalModelRotX),
          modelRotY: Number(portalModelRotY),
          modelRotZ: Number(portalModelRotZ),
          showVideo: Boolean(portalShowVideo),
          videoUrl: portalVideoUrl || finalVideoUrl,
          videoScale: Number(portalVideoScale),
          videoPosY: Number(portalVideoPosY),
          videoPosZ: Number(portalVideoPosZ),
          particles: portalParticles,
          particleCount: Number(portalParticleCount),
          particleColor: portalParticleColor,
          particleSpeed: Number(portalParticleSpeed),
          floatingText: portalFloatingText,
          textColor: portalTextColor,
          textScale: Number(portalTextScale),
          textPosY: Number(portalTextPosY),
          textPosZ: Number(portalTextPosZ),
          hideOutsideModel: Boolean(portalHideOutsideModel)
        },
        particleConfig: {
          enabled: Boolean(particleSystemEnabled),
          preset: particlePreset,
          count: Number(particleCount),
          size: Number(particleSize),
          color: particleColor,
          colorSecondary: particleColorSecondary,
          opacity: Number(particleOpacity),
          blending: particleBlending,
          speed: Number(particleSpeed),
          spreadX: Number(particleSpreadX),
          spreadY: Number(particleSpreadY),
          spreadZ: Number(particleSpreadZ),
          direction: particleDirection,
          shape: particleShape,
          posX: Number(particlePosX),
          posY: Number(particlePosY),
          posZ: Number(particlePosZ),
          rotationSpeed: Number(particleRotationSpeed),
          twinkle: Boolean(particleTwinkle)
        },
        websiteLayer: {
          enabled: Boolean(websiteEnabled),
          url: websiteUrl,
          width: Number(websiteWidth),
          height: Number(websiteHeight),
          aspectRatio: websiteAspectRatio,
          resolution: websiteResolution,
          interactive: Boolean(websiteInteractive),
          opacity: Number(websiteOpacity),
          frameStyle: websiteFrameStyle,
          frameColor: websiteFrameColor,
          frameGlow: Boolean(websiteFrameGlow),
          curved: Boolean(websiteCurved),
          curveRadius: Number(websiteCurveRadius),
          billboard: Boolean(websiteBillboard),
          posX: Number(websitePosX),
          posY: Number(websitePosY),
          posZ: Number(websitePosZ),
          rotX: Number(websiteRotX),
          rotY: Number(websiteRotY),
          rotZ: Number(websiteRotZ),
          scale: Number(websiteScale),
          showAddressBar: Boolean(websiteShowAddressBar)
        },
        markerConfig: {
          visible: Boolean(markerVisible),
          opacity: Number(markerOpacity),
          width: Number(markerWidth),
          aspectRatio: Number(markerAspectRatio),
          imageUrl: (finalMarkerImageUrl && typeof finalMarkerImageUrl === 'string' && !finalMarkerImageUrl.startsWith('blob:') && !finalMarkerImageUrl.startsWith('data:')) ? finalMarkerImageUrl : (markerInfo?.source === 'custom' && !finalMarkerImageUrl?.startsWith('blob:') ? finalMarkerImageUrl : ''),
          widthPx: markerInfo?.width,
          heightPx: markerInfo?.height,
          source: markerInfo?.source,
          mindFilePath: markerInfo?.mindFilePath || ''
        },
        additionalGeometries: cleanedAdditionalGeometries || [],
        customModels: cleanedCustomModels,
        custom3DTexts: custom3DTexts || [],
        customLights: customLights || [],
        sceneGroups: sceneGroups || [],
        updatedAt: new Date().toISOString()
      };

      // 2d. Preserve existing thumbnail (fresh thumbnails are strictly saved only when clicking the Snap button)
      const existingThumbnailUrl = arData?.thumbnailUrl || arData?.thumbnail_url || arData?.config?.thumbnailUrl || arData?.arExperience?.thumbnailUrl || '';
      if (existingThumbnailUrl) {
        arConfigPayload.thumbnailUrl = existingThumbnailUrl;
        arConfigPayload.thumbnail_url = existingThumbnailUrl;
      }

      const payload = {
        video_url: (finalVideoUrl && !finalVideoUrl.startsWith('blob:')) ? finalVideoUrl : '',
        videoUrl: (finalVideoUrl && !finalVideoUrl.startsWith('blob:')) ? finalVideoUrl : '',
        video_file_path: videoFilePath,
        ...(gltfFilePath ? { gltf_file_path: gltfFilePath } : {}),
        ...(existingThumbnailUrl ? { thumbnailUrl: existingThumbnailUrl, thumbnail_url: existingThumbnailUrl } : {}),
        ar_config: arConfigPayload,
        portalConfig: arConfigPayload.portalConfig,
        particleConfig: arConfigPayload.particleConfig,
        websiteLayer: arConfigPayload.websiteLayer,
        additionalGeometries: cleanedAdditionalGeometries || [],
        customModels: cleanedCustomModels,
        custom3DTexts: custom3DTexts || [],
        customLights: customLights || [],
        sceneGroups: sceneGroups || [],
        ambientColor,
        ambientIntensity,
        dir1Color,
        dir1Intensity,
        dir1Position,
        dir2Color,
        dir2Intensity,
        dir2Position,
        rimColor,
        rimIntensity,
        rimPosition,
        modelScale,
        modelPosition: `${modelPosX} ${modelPosY} ${modelPosZ}`,
        modelRotation: `${modelRotX} ${modelRotY} ${modelRotZ}`,
        modelRotX,
        modelRotY,
        modelRotZ,
        modelPosX,
        modelPosY,
        modelPosZ,
        modelRotSpeed,
        meshOverrides
      };

      // Recursively sanitize payload so that NO undefined fields exist anywhere in the document tree
      const sanitizedPayload = sanitizeForFirestore(payload);

      // Save to both batches and assets collections with writeBatch and safe retry
      const batchRef = doc(db, 'batches', batchId.trim());
      const assetRef = doc(db, 'assets', batchId.trim());

      const firestoreBatch = writeBatch(db);
      firestoreBatch.set(batchRef, sanitizedPayload, { merge: true });
      firestoreBatch.set(assetRef, sanitizedPayload, { merge: true });

      const altAssetId = arData?.asset_id || arData?.assetId || arData?.product_id || arData?.productId;
      if (altAssetId && typeof altAssetId === 'string' && altAssetId.trim() !== batchId.trim()) {
        firestoreBatch.set(doc(db, 'assets', altAssetId.trim()), sanitizedPayload, { merge: true });
      }

      await safeCommitBatch(firestoreBatch);

      // Save to localStorage for instant preview sync
      try {
        localStorage.setItem('starwear_live_preview_config_' + batchId.trim(), JSON.stringify(arConfigPayload));
        localStorage.setItem('starwear_live_preview_config_last', JSON.stringify(arConfigPayload));
      } catch (storageErr) {
        console.warn('[ARTest] localStorage sync in saveConfig failed:', storageErr);
      }

      // Update local arData state immediately so current session is in sync
      setArData((prev) => ({
        ...(prev || {}),
        thumbnailUrl: existingThumbnailUrl || prev?.thumbnailUrl,
        thumbnail_url: existingThumbnailUrl || prev?.thumbnail_url,
        videoUrl: finalVideoUrl,
        video_url: finalVideoUrl,
        video_file_path: videoFilePath,
        gltf_file_path: gltfFilePath || prev?.gltf_file_path,
        config: arConfigPayload,
        customModels: cleanedCustomModels,
        arExperience: {
          ...(prev?.arExperience || {}),
          thumbnailUrl: existingThumbnailUrl || prev?.arExperience?.thumbnailUrl,
          thumbnail_url: existingThumbnailUrl || prev?.arExperience?.thumbnail_url,
          modelUrl: finalGltfUrl || prev?.arExperience?.modelUrl,
          videoUrl: finalVideoUrl,
          config: arConfigPayload,
          customModels: cleanedCustomModels
        }
      }));

      // Clear pending raw file selections once saved
      setSelectedVideoFile(null);
      setSelectedGlbFile(null);
      setSelectedPortalSkyboxFile(null);
      setSelectedPortalGlbFile(null);

      const timeStr = new Date().toLocaleTimeString();
      setSaveSuccessMsg(`Batch composition saved at ${timeStr}`);
      setTimeout(() => setSaveSuccessMsg(''), 6000);
    } catch (err) {
      console.error('Error saving configuration:', err);
      alert('Error saving configuration: ' + err.message);
    } finally {
      setSavingConfig(false);
      setUploadProgress('');
      isSavingConfigRef.current = false;
    }
  };

  // Dedicated handler to save modifications made to a model template back to its catalog storage & Firestore
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    const now = Date.now();
    if (isSavingConfigRef.current || (now - lastSaveTimeRef.current < 1500)) {
      console.warn('[ARTest] handleSaveTemplate throttled or already running');
      return;
    }
    isSavingConfigRef.current = true;
    lastSaveTimeRef.current = now;

    setSavingConfig(true);
    setSaveSuccessMsg('');
    setUploadProgress('Preparing 3D model template composition...');

    try {
      const exportContainer = new THREE.Group();
      const safeTemplateName = (editingTemplate.cleanName || editingTemplate.name || 'template')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      exportContainer.name = safeTemplateName;

      // 1. Primary Model with all material/texture modifications
      const modelEl = document.getElementById('ar-model');
      const primaryModel3D = modelEl?.getObject3D('mesh');
      if (primaryModel3D) {
        primaryModel3D.updateWorldMatrix(true, true);
        const clonedPrimary = primaryModel3D.clone(true);
        const toRemove = [];
        clonedPrimary.traverse((c) => {
          if (c.name && /helper|picker|gizmo|__starwear/i.test(c.name)) {
            toRemove.push(c);
          }
        });
        toRemove.forEach((c) => c.parent && c.parent.remove(c));

        // Strip deleted meshes
        deletedMeshNames.forEach((name) => {
          const deadNode = clonedPrimary.getObjectByName(name);
          if (deadNode && deadNode.parent) {
            deadNode.parent.remove(deadNode);
          }
        });

        // Apply entity transforms so user transformations are baked directly into the saved model
        if (modelEl?.object3D) {
          clonedPrimary.position.set(Number(modelPosX) || 0, Number(modelPosY) || 0, Number(modelPosZ) || 0);
          clonedPrimary.rotation.set(
            THREE.MathUtils.degToRad(Number(modelRotX) || 0),
            THREE.MathUtils.degToRad(Number(modelRotY) || 0),
            THREE.MathUtils.degToRad(Number(modelRotZ) || 0)
          );
          const s = Number(modelScale) || 1;
          clonedPrimary.scale.set(s, s, s);
        }

        exportContainer.add(clonedPrimary);
      }

      // 2. Additional Geometries (Shapes / Extrusions)
      if (Array.isArray(additionalGeometries)) {
        additionalGeometries.forEach((g) => {
          if (g.visible === false) return;
          const liveObj = findThreeObject('geometry', g.id);
          let primMesh = null;
          if (liveObj) {
            liveObj.updateWorldMatrix(true, true);
            primMesh = liveObj.clone(true);
            const toRemove = [];
            primMesh.traverse((c) => {
              if (c.name && /helper|picker|gizmo|__starwear/i.test(c.name)) toRemove.push(c);
            });
            toRemove.forEach((c) => c.parent && c.parent.remove(c));
            primMesh.position.set(0, 0, 0);
            primMesh.quaternion.set(0, 0, 0, 1);
            primMesh.scale.set(1, 1, 1);
            liveObj.matrixWorld.decompose(primMesh.position, primMesh.quaternion, primMesh.scale);
          } else {
            primMesh = createPrimitiveMesh(g, THREE);
            primMesh.position.set(g.posX || 0, g.posY || 0, g.posZ || 0);
            primMesh.rotation.set(
              THREE.MathUtils.degToRad(g.rotX || 0),
              THREE.MathUtils.degToRad(g.rotY || 0),
              THREE.MathUtils.degToRad(g.rotZ || 0)
            );
            primMesh.scale.set(g.scaleX ?? g.scale ?? 1, g.scaleY ?? g.scale ?? 1, g.scaleZ ?? g.scale ?? 1);
          }
          primMesh.name = (g.name || g.type || 'shape').replace(/[^a-zA-Z0-9_-]/g, '_');
          exportContainer.add(primMesh);
        });
      }

      // 3. Custom 3D Typography Texts
      const textAnchor = document.getElementById('ar-3d-texts-anchor');
      const textsRoot = textAnchor?.getObject3D('texts3DRoot') || textAnchor?.object3D;
      if (textsRoot && Array.isArray(custom3DTexts)) {
        custom3DTexts.forEach((t) => {
          if (t.visible === false) return;
          textsRoot.traverse((node) => {
            if (node.userData?.textId === t.id) {
              node.updateWorldMatrix(true, true);
              const clonedText = node.clone(true);
              node.matrixWorld.decompose(clonedText.position, clonedText.quaternion, clonedText.scale);
              exportContainer.add(clonedText);
            }
          });
        });
      }

      // 4. Custom 3D Models
      const customModelsAnchor = document.getElementById('ar-custom-models-anchor');
      const modelsRoot = customModelsAnchor?.getObject3D('customModelsRoot') || customModelsAnchor?.object3D;
      if (modelsRoot && Array.isArray(customModels)) {
        customModels.forEach((m) => {
          if (m.visible === false) return;
          modelsRoot.traverse((node) => {
            if (node.userData?.modelId === m.id && node.userData?.isCustomModel) {
              node.updateWorldMatrix(true, true);
              const clonedMod = node.clone(true);
              node.matrixWorld.decompose(clonedMod.position, clonedMod.quaternion, clonedMod.scale);
              exportContainer.add(clonedMod);
            }
          });
        });
      }

      exportContainer.updateMatrixWorld(true);

      // Deeply sanitize hierarchy to eliminate undefined pivot and invalid texture transforms
      sanitizeHierarchyForGLTFExport(exportContainer, THREE);

      // Export to binary .glb using GLTFExporter
      setUploadProgress('Exporting designed 3D model (.glb)...');
      const glbBlob = await new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        const exportOptions = {
          binary: true,
          embedImages: true
        };
        if (primaryModel3D?.animations?.length > 0) {
          exportOptions.animations = primaryModel3D.animations;
        }
        exporter.parse(
          exportContainer,
          (result) => {
            if (result instanceof ArrayBuffer) {
              resolve(new Blob([result], { type: 'model/gltf-binary' }));
            } else {
              resolve(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
            }
          },
          (err) => reject(err),
          exportOptions
        );
      });

      // Capture scene canvas snapshot for template thumbnail
      setUploadProgress('Capturing updated template thumbnail...');
      let thumbnailBlob = null;
      const sceneContainer = document.getElementById('ar-scene-container');
      const sceneEl = sceneContainer?.querySelector('a-scene');
      if (sceneEl) {
        try {
          const thumbResult = await captureSceneCanvasThumbnail(sceneEl, {
            width: 512,
            height: 512,
            hideMarkers: true
          });
          if (thumbResult?.blob) {
            thumbnailBlob = thumbResult.blob;
          }
        } catch (thumbErr) {
          console.warn('[ARTest] Canvas thumbnail capture warning:', thumbErr);
        }
      }

      // Upload and replace template in Firebase Storage and Firestore
      setUploadProgress('Saving to template storage and updating catalog...');
      const updatedTemplate = await saveEditedModelTemplate({
        template: editingTemplate,
        glbBlob,
        thumbnailBlob,
        onProgress: ({ message }) => setUploadProgress(message)
      });

      setEditingTemplate(updatedTemplate);
      const ts = updatedTemplate.updatedAt ? new Date(updatedTemplate.updatedAt).getTime() : Date.now();
      const freshUrl = withCacheBuster(updatedTemplate.url, ts);
      setLocalGlbUrl(freshUrl);
      // Reset entity transforms and baked additions since they are now unified inside the primary GLB
      setModelPosX(0);
      setModelPosY(0);
      setModelPosZ(0);
      setModelScale(1);
      setModelRotX(0);
      setModelRotY(0);
      setModelRotZ(0);
      setAdditionalGeometries([]);
      setCustom3DTexts([]);
      setCustomModels([]);
      setDeletedMeshNames([]);
      try {
        sessionStorage.setItem('starwear_edit_template', JSON.stringify(updatedTemplate));
      } catch (e) {
        console.warn(e);
      }

      setSaveSuccessMsg(`Template "${updatedTemplate.cleanName || updatedTemplate.name}" successfully updated & replaced in catalog!`);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err) {
      console.error('[ARTest] Failed to save model template:', err);
      alert('Failed to save model template: ' + (err?.message || err));
    } finally {
      setSavingConfig(false);
      setUploadProgress('');
      isSavingConfigRef.current = false;
    }
  };

  // Dedicated one-click handler to capture current live camera viewport angle as 3D asset thumbnail
  const handleCaptureThumbnail = async () => {
    if (editingTemplate) {
      setSavingConfig(true);
      setUploadProgress('Capturing template thumbnail snapshot...');
      try {
        const sceneContainer = document.getElementById('ar-scene-container');
        const sceneEl = sceneContainer?.querySelector('a-scene');
        let thumbResult = null;
        if (sceneEl) {
          thumbResult = await captureSceneCanvasThumbnail(sceneEl, {
            width: 512,
            height: 512,
            hideMarkers: true
          });
        }
        if (thumbResult?.blob) {
          setUploadProgress('Uploading fresh template thumbnail...');
          const timestamp = Date.now();
          const thumbnailStoragePath = editingTemplate.thumbnailStoragePath || `model_templates/thumbnails/${timestamp}_${editingTemplate.id}_thumb.png`;
          const thumbRef = ref(storage, thumbnailStoragePath);
          await uploadBytes(thumbRef, thumbResult.blob, { contentType: 'image/png' });
          const newUrl = await getDownloadURL(thumbRef);

          await setDoc(doc(db, 'model_templates', editingTemplate.id), {
            thumbnailUrl: newUrl,
            thumbnailStoragePath,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          await fetchTemplatesFromBucket();
          const updated = { ...editingTemplate, thumbnailUrl: newUrl, thumbnailStoragePath };
          setEditingTemplate(updated);
          try {
            sessionStorage.setItem('starwear_edit_template', JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }

          setSaveSuccessMsg(`Fresh 3D template thumbnail saved!`);
          setTimeout(() => setSaveSuccessMsg(''), 4000);
        } else {
          alert('Could not capture scene snapshot. Ensure the 3D model is visible.');
        }
      } catch (err) {
        console.error('[ARTest] Error capturing template thumbnail:', err);
        alert('Error capturing template thumbnail: ' + err.message);
      } finally {
        setSavingConfig(false);
        setUploadProgress('');
      }
      return;
    }

    if (!batchId.trim()) {
      alert('Please enter a Batch ID in the input above before capturing a thumbnail.');
      return;
    }

    setSavingConfig(true);
    setUploadProgress('Capturing current 3D view angle snapshot...');
    try {
      const sceneContainer = document.getElementById('ar-scene-container');
      const sceneEl = sceneContainer?.querySelector('a-scene');
      let thumbResult = null;

      if (sceneEl) {
        thumbResult = await captureSceneCanvasThumbnail(sceneEl, {
          width: 512,
          height: 512,
          hideMarkers: true
        });
      }

      if (!thumbResult?.blob) {
        const finalModel = localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath;
        if (finalModel) {
          setUploadProgress('Rendering 3D model thumbnail offscreen...');
          thumbResult = await captureModelThumbnailBlob(finalModel, arData?.config || {});
        }
      }

      if (thumbResult?.blob) {
        setUploadProgress('Uploading fresh thumbnail & cleaning up previous images...');
        const previousThumbnailUrl =
          arData?.thumbnailUrl ||
          arData?.thumbnail_url ||
          arData?.config?.thumbnailUrl ||
          arData?.arExperience?.thumbnailUrl;

        const newUrl = await uploadAssetThumbnail(batchId.trim(), thumbResult.blob, {
          altAssetId: arData?.asset_id || arData?.assetId,
          previousThumbnailUrl
        });

        setArData((prev) => ({
          ...(prev || {}),
          thumbnailUrl: newUrl,
          thumbnail_url: newUrl,
          config: {
            ...(prev?.config || {}),
            thumbnailUrl: newUrl,
            thumbnail_url: newUrl
          },
          arExperience: {
            ...(prev?.arExperience || {}),
            thumbnailUrl: newUrl,
            thumbnail_url: newUrl
          }
        }));

        try {
          const cfg = {
            ...(arData?.config || {}),
            thumbnailUrl: newUrl,
            thumbnail_url: newUrl
          };
          localStorage.setItem('starwear_live_preview_config_' + batchId.trim(), JSON.stringify(cfg));
          localStorage.setItem('starwear_live_preview_config_last', JSON.stringify(cfg));
        } catch (storageErr) {
          console.warn('[ARTest] localStorage sync in captureThumbnail failed:', storageErr);
        }

        setSaveSuccessMsg(`Fresh 3D asset thumbnail saved & previous images cleaned up at ${new Date().toLocaleTimeString()}`);
        setTimeout(() => setSaveSuccessMsg(''), 6000);
      } else {
        alert('Could not capture scene snapshot. Please ensure the 3D model is loaded and visible.');
      }
    } catch (err) {
      console.error('Error capturing thumbnail:', err);
      alert('Failed to capture thumbnail: ' + err.message);
    } finally {
      setSavingConfig(false);
      setUploadProgress('');
    }
  };

  // Batch tool to sync thumbnails for all assets in catalog
  const handleBatchSyncThumbnails = async () => {
    const confirm = window.confirm(
      'Update 3D thumbnails for all assets in the catalog?\n\nThis will load each model, render an accurate showroom thumbnail preview, upload to Storage, and update database records.'
    );
    if (!confirm) return;

    setSavingConfig(true);
    try {
      const result = await batchUpdateAllAssetThumbnails({
        force: true,
        onProgress: (p) => {
          setUploadProgress(`Updating ${p.current}/${p.total} (${p.assetId}): ${p.status}...`);
        }
      });
      alert(`Successfully updated 3D thumbnails for ${result.updated} of ${result.total} assets!`);
    } catch (err) {
      console.error('Batch sync error:', err);
      alert('Batch thumbnail sync failed: ' + err.message);
    } finally {
      setSavingConfig(false);
      setUploadProgress('');
    }
  };

  // Dedicated Save Handler for Camera Target Tracking Settings
  const handleSaveTracking = async (overrideScope) => {
    const scope = overrideScope || trackingScope;
    setSavingTracking(true);
    setTrackingSuccessMsg('');

    const trackingPayload = {
      filterMinCF: Number(trackingFilterMinCF),
      filterBeta: Number(trackingFilterBeta),
      missTolerance: Number(trackingMissTolerance),
      warmupTolerance: Number(trackingWarmupTolerance),
      maxTrack: Number(trackingMaxTrack),
      targetIndex: Number(trackingTargetIndex),
      showStats: Boolean(trackingShowStats),
      uiLoading: trackingUiLoading,
      uiScanning: trackingUiScanning,
      uiError: trackingUiError,
      updatedAt: new Date().toISOString()
    };

    try {
      if (scope === 'global') {
        // 1. Save global defaults document to settings/tracking
        await setDoc(doc(db, 'settings', 'tracking'), trackingPayload, { merge: true });

        // 2. Propagate to all existing batch and asset documents in Firestore using chunked writeBatches
        let updatedCount = 0;
        try {
          const batchesSnap = await getDocs(collection(db, 'batches'));
          const CHUNK_SIZE = 200; // max 500 per batch in Firestore, keep comfortably under limit
          let currentBatch = writeBatch(db);
          let opCount = 0;

          for (const bDoc of batchesSnap.docs) {
            updatedCount++;
            currentBatch.set(doc(db, 'batches', bDoc.id), { ar_config: { trackingConfig: trackingPayload } }, { merge: true });
            currentBatch.set(doc(db, 'assets', bDoc.id), { ar_config: { trackingConfig: trackingPayload } }, { merge: true });
            opCount += 2;

            if (opCount >= CHUNK_SIZE) {
              await safeCommitBatch(currentBatch);
              await new Promise((r) => setTimeout(r, 120)); // pacing delay to respect Firestore rate limits
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          }
          if (opCount > 0) {
            await safeCommitBatch(currentBatch);
          }
        } catch (propagateErr) {
          console.warn('Batch propagation warning:', propagateErr);
        }

        const timeStr = new Date().toLocaleTimeString();
        setTrackingSuccessMsg(`Applied tracking settings globally to ALL ${updatedCount} batches at ${timeStr}!`);
      } else {
        // Active batch scope
        if (!batchId.trim()) {
          alert('Please enter an active Batch ID in the input above to apply to the active batch, or choose Global to apply to all.');
          setSavingTracking(false);
          return;
        }

        const bId = batchId.trim();
        const batchRef = doc(db, 'batches', bId);
        const assetRef = doc(db, 'assets', bId);

        const singleBatch = writeBatch(db);
        singleBatch.set(batchRef, { ar_config: { trackingConfig: trackingPayload } }, { merge: true });
        singleBatch.set(assetRef, { ar_config: { trackingConfig: trackingPayload } }, { merge: true });
        await safeCommitBatch(singleBatch);

        const timeStr = new Date().toLocaleTimeString();
        setTrackingSuccessMsg(`Saved tracking settings for batch "${bId}" at ${timeStr}!`);
      }

      // Sync local arData state
      setArData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          config: {
            ...(prev.config || {}),
            trackingConfig: trackingPayload
          }
        };
      });

      setTimeout(() => setTrackingSuccessMsg(''), 6000);
    } catch (err) {
      console.error('Error saving tracking settings:', err);
      alert('Error saving tracking settings: ' + err.message);
    } finally {
      setSavingTracking(false);
    }
  };

  const toggleMedia = () => {
    setMediaPlaying((prev) => !prev);
  };

  const toggleMediaMute = () => {
    const nextMuted = !mediaMuted;
    setMediaMuted(nextMuted);
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.dispatchEvent(new CustomEvent('set-video-mute', { detail: { muted: nextMuted } }));
    }
    window.dispatchEvent(new CustomEvent('starwear-set-video-mute', { detail: { muted: nextMuted } }));
    document.querySelectorAll('iframe').forEach((ifr) => {
      try {
        ifr.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: nextMuted ? 'mute' : 'unMute', args: [] }),
          '*'
        );
        if (!nextMuted) {
          ifr.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
            '*'
          );
        }
      } catch (e) { }
    });
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { startDirectPayPalCheckout } = await import('../services/paypalService');
      const itemPrice = arData?.price !== undefined ? Number(arData.price) : 99.00;

      try {
        logEvent(analytics, 'checkout_started', {
          items: [{ item_name: 'AR Garment', price: itemPrice }],
          batch_id: batchId
        });
      } catch {
        // Analytics failure non-fatal
      }

      await startDirectPayPalCheckout({
        items: [{
          id: batchId || '',
          name: arData?.name || `AR Garment (${batchId || 'Exclusive'})`,
          price: itemPrice,
          quantity: 1,
          image: localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || ''
        }],
        total: itemPrice,
        metadata: {
          batchId: batchId || '',
          source: 'ar_test'
        }
      });
    } catch (error) {
      console.error("PayPal Checkout error:", error);
      alert(`Checkout failed: ${error.message}`);
      setCheckoutLoading(false);
    }
  };

  // Filtered mesh hierarchy list
  const filteredMeshes = meshList.filter((m) =>
    m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    m.materialName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Active target transform values
  const currentRotX = selectedMesh ? selectedMesh.rotation.x : modelRotX;
  const currentRotY = selectedMesh ? selectedMesh.rotation.y : modelRotY;
  const currentRotZ = selectedMesh ? selectedMesh.rotation.z : modelRotZ;

  const currentPosX = selectedMesh ? selectedMesh.position.x : modelPosX;
  const currentPosY = selectedMesh ? selectedMesh.position.y : modelPosY;
  const currentPosZ = selectedMesh ? selectedMesh.position.z : modelPosZ;

  const currentScale = selectedMesh ? selectedMesh.scale.x : modelScale;

  return (
    <div className="w-screen h-screen h-[100dvh] max-h-[100dvh] bg-neutral-950 text-white font-sans flex flex-col md:flex-row overflow-hidden">
      {/* ========================================================================= */}
      {/* SIDEBAR CONTROL DOCK                                                      */}
      {/* ========================================================================= */}
      <div className="w-full md:w-96 lg:w-[420px] bg-black border-r border-neutral-800 z-50 flex flex-col shadow-2xl flex-shrink-0 h-full max-h-[100dvh]">
        {/* Top Header & Batch Form */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base font-bold tracking-wider text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              3D SCENE & AR TESTER
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
              v2.5 STUDIO
            </span>
          </div>

          {/* Model Template Editing Mode Banner */}
          {editingTemplate && (
            <div className="mb-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-950 via-purple-950/80 to-amber-950/60 border border-indigo-500/50 flex flex-col gap-1.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-[13px]">tune</span>
                  Template Design Mode
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    try {
                      sessionStorage.removeItem('starwear_edit_template');
                    } catch (e) {
                      console.warn(e);
                    }
                    const url = new URL(window.location.href);
                    url.searchParams.delete('templateId');
                    url.searchParams.delete('template');
                    window.history.replaceState({}, '', url.pathname);
                  }}
                  className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 transition-colors cursor-pointer"
                  title="Exit template editing mode"
                >
                  Exit
                </button>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="font-bold text-white text-xs truncate">
                  {editingTemplate.cleanName || editingTemplate.name}
                </span>
                <span className="text-[10px] font-mono text-neutral-400 truncate ml-2">
                  {editingTemplate.category} › {editingTemplate.subcategory}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleLoad} className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={editingTemplate ? `Batch ID (Optional in Template Mode)` : "Enter Batch ID"}
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-neutral-900 text-white border border-neutral-700 rounded text-xs focus:outline-none focus:border-indigo-400 font-mono transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !batchId.trim()}
                className="px-4 py-1.5 bg-white text-black font-bold uppercase tracking-wider hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs"
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </form>

          {/* Quick Local GLB Loader & Save Action */}
          <div className="mt-2.5 pt-2.5 border-t border-neutral-800/80 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModelModalOpen(true)}
              className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all rounded text-xs flex items-center gap-1 shadow-md shadow-purple-950/40 cursor-pointer shrink-0"
              title="Add External 3D Model (.glb / .gltf from local file, remote URL, or 3D library)"
            >
              <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
              <span>+ Add Model</span>
            </button>

            <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded text-xs font-medium cursor-pointer transition-colors text-neutral-200 truncate">
              <span className="material-symbols-outlined text-[15px] text-indigo-400">folder_open</span>
              <span className="truncate">{localGlbName ? `3D: ${localGlbName}` : 'Test Local GLB Model'}</span>
              <input type="file" accept=".glb,.gltf" onChange={pickLocalModel} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleCaptureThumbnail}
              disabled={savingConfig || (!editingTemplate && !batchId.trim())}
              className="px-2.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs flex items-center gap-1 shadow-md shadow-cyan-950/40 cursor-pointer"
              title={editingTemplate ? `Capture & Update Template Thumbnail Preview` : "Capture & Save 3D Thumbnail from Current View"}
            >
              <span className="material-symbols-outlined text-[15px]">photo_camera</span>
              <span>Snap</span>
            </button>

            {editingTemplate ? (
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingConfig}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs flex items-center gap-1 shadow-md shadow-indigo-950/40 cursor-pointer"
                title={`Save all design updates directly back to template "${editingTemplate.cleanName || editingTemplate.name}"`}
              >
                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                <span>{savingConfig ? 'Saving...' : 'Save Template'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig || !batchId.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs flex items-center gap-1 shadow-md shadow-emerald-950/40"
                title="Save Configuration to Firebase Batch"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                <span>{savingConfig ? 'Saving...' : 'Save'}</span>
              </button>
            )}
          </div>

          {/* Active 3D Thumbnail Chip Preview */}
          {((editingTemplate && editingTemplate.thumbnailUrl) || arData?.thumbnailUrl || arData?.thumbnail_url) && (
            <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-black/60 border border-cyan-500/40 overflow-hidden flex-shrink-0 shadow-sm">
                  <img
                    src={editingTemplate ? editingTemplate.thumbnailUrl : (arData?.thumbnailUrl || arData?.thumbnail_url)}
                    alt="Active Thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span>{editingTemplate ? 'Template Thumbnail' : '3D Thumbnail Active'}</span>
                  </p>
                  <p className="text-[9px] text-neutral-400 truncate">
                    {editingTemplate ? `${editingTemplate.cleanName || editingTemplate.name}` : (arData?.thumbnail_url || arData?.thumbnailUrl ? 'Custom Viewport Angle' : 'Generated')}
                  </p>
                </div>
              </div>
              {!editingTemplate && (
                <button
                  type="button"
                  onClick={handleBatchSyncThumbnails}
                  disabled={savingConfig}
                  className="text-[10px] text-neutral-400 hover:text-white font-mono underline hover:no-underline cursor-pointer"
                  title="Sync 3D thumbnails for all catalog assets"
                >
                  Sync Catalog
                </button>
              )}
            </div>
          )}

          {/* Progress / Uploading Banner */}
          {savingConfig && (
            <div className="mt-2 p-2 bg-indigo-950/70 border border-indigo-500/60 rounded text-indigo-200 text-[11px] font-mono flex items-center gap-2 animate-pulse shadow-md">
              <span className="material-symbols-outlined text-sm text-indigo-400 animate-spin">progress_activity</span>
              <span>{uploadProgress || 'Saving changes to Firebase...'}</span>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccessMsg && (
            <div className="mt-2 p-2 bg-emerald-950/60 border border-emerald-500/50 rounded text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 animate-fade-in">
              <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
              <span>{saveSuccessMsg}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 mx-4 mt-3 bg-red-950/50 border border-red-500/50 rounded-lg text-red-400 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Multi-Mesh Target Selector Banner */}
        <div className="px-4 py-2.5 bg-neutral-900/90 border-b border-neutral-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Active Target:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 border ${selectedTargetType === 'mesh'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : selectedTargetType === 'customModel'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : selectedTargetType === 'geometry'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm'
                    : selectedTargetType === 'text3d'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                      : selectedTargetType === 'light'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                <span className="material-symbols-outlined text-xs">
                  {currentSelectedObjectInfo?.icon || 'language'}
                </span>
                <span className="truncate max-w-[170px]">
                  {currentSelectedObjectInfo?.name || 'Entire 3D Model (Root)'}
                </span>
              </span>
            </div>

            {selectedTargetType !== 'model' && (
              <div className="flex items-center gap-1.5">
                {selectedMesh && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMesh(selectedMesh.uuid, selectedMesh.name)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    title="Delete this mesh from the scene"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectSceneObject('model')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:text-white transition-colors cursor-pointer"
                  title="Switch back to Root Model settings"
                >
                  ✕ Deselect
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span>{meshList.length > 0 ? `📦 ${meshList.length} Meshes Detected` : 'No meshes loaded yet'}</span>
            <span className="text-indigo-400 font-mono">💡 Click 3D parts in scene to edit</span>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/60 p-1 gap-1 text-xs select-none control-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('transform')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'transform'
              ? 'bg-neutral-800 text-white font-bold shadow border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-indigo-400">transform</span>
            <span>Transform</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hierarchy')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'hierarchy'
              ? 'bg-neutral-800 text-white font-bold shadow border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-purple-400">layers</span>
            <span>Objects ({meshList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shapes')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'shapes'
              ? 'bg-neutral-800 text-teal-300 font-bold shadow border border-teal-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-teal-400">deployed_code</span>
            <span>Shapes</span>
            {additionalGeometries.length > 0 && (
              <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1 py-0.2 rounded-full font-mono ml-0.5">
                {additionalGeometries.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text3d')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'text3d'
              ? 'bg-neutral-800 text-pink-300 font-bold shadow border border-pink-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-pink-400">title</span>
            <span>3D Text</span>
            {custom3DTexts.length > 0 && (
              <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1 py-0.2 rounded-full font-mono ml-0.5">
                {custom3DTexts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lighting')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'lighting'
              ? 'bg-neutral-800 text-amber-300 font-bold shadow border border-amber-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-amber-400">lightbulb</span>
            <span>Lighting</span>
            {customLights.length > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded-full font-mono ml-0.5">
                {customLights.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'materials'
              ? 'bg-neutral-800 text-white font-bold shadow border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-emerald-400">texture</span>
            <span>Materials</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scene')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'scene'
              ? 'bg-neutral-800 text-white font-bold shadow border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-sky-400">movie</span>
            <span>Scene</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'portal'
              ? 'bg-neutral-800 text-sky-300 font-bold shadow border border-sky-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-sky-400">meeting_room</span>
            <span>Portal</span>
            {portalEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse ml-0.5"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('particles')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'particles'
              ? 'bg-neutral-800 text-amber-300 font-bold shadow border border-amber-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-amber-400">flare</span>
            <span>Particles</span>
            {particleSystemEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('website')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'website'
              ? 'bg-neutral-800 text-indigo-300 font-bold shadow border border-indigo-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-indigo-400">language</span>
            <span>Website</span>
            {websiteEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse ml-0.5"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'tracking'
              ? 'bg-neutral-800 text-cyan-300 font-bold shadow border border-cyan-500/50'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-cyan-400">center_focus_strong</span>
            <span>Tracking</span>
          </button>
        </div>

        {/* Scrollable Control Settings Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: TRANSFORM & ORIENTATION / POSITION CONTROLS                         */}
          {/* ========================================================================= */}
          {activeTab === 'transform' && (
            <div className="space-y-5">
              {/* Orientation & Rotation Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-400">3d_rotation</span>
                    {selectedMesh ? `Rotation: ${selectedMesh.name}` : 'Root Model Orientation'}
                  </h2>
                  <button
                    type="button"
                    onClick={resetCurrentTargetTransform}
                    className="text-[10px] font-mono text-neutral-400 hover:text-amber-300"
                    title="Reset to default orientation"
                  >
                    Reset Dials
                  </button>
                </div>

                {/* 3-Axis Interactive Rotation Dials */}
                <div className="space-y-2.5">
                  <RotationDial
                    axis="X"
                    angle={currentRotX}
                    onChange={(deg) => handleRotationChange('x', deg)}
                    color="rose"
                    description="Pitch (Tilt Front/Back)"
                  />
                  <RotationDial
                    axis="Y"
                    angle={currentRotY}
                    onChange={(deg) => handleRotationChange('y', deg)}
                    color="emerald"
                    description="Yaw (Turn Left/Right)"
                  />
                  <RotationDial
                    axis="Z"
                    angle={currentRotZ}
                    onChange={(deg) => handleRotationChange('z', deg)}
                    color="sky"
                    description="Roll (Tilt Sideways)"
                  />
                </div>
              </div>

              {/* Object 3D Positioning Section */}
              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">open_with</span>
                    {selectedMesh ? `Position: ${selectedMesh.name}` : 'Object Positioning (X, Y, Z)'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      handlePositionChange('x', 0);
                      handlePositionChange('y', 0);
                      handlePositionChange('z', 0);
                    }}
                    className="text-[10px] font-mono text-neutral-400 hover:text-amber-300"
                    title="Center Position to (0, 0, 0)"
                  >
                    Reset (0,0,0)
                  </button>
                </div>

                {/* Position Sliders with direct typed number inputs */}
                <div className="space-y-2">
                  <NumberSliderInput
                    label="Position X (Lateral)"
                    value={currentPosX}
                    onChange={(val) => handlePositionChange('x', val)}
                    min={-3.0}
                    max={3.0}
                    step={0.01}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0}
                    description="Left (-) / Right (+) displacement in meters"
                  />
                  <NumberSliderInput
                    label="Position Y (Elevation)"
                    value={currentPosY}
                    onChange={(val) => handlePositionChange('y', val)}
                    min={-3.0}
                    max={3.0}
                    step={0.01}
                    unit="m"
                    color="emerald"
                    precision={2}
                    resetValue={0}
                    description="Down (-) / Up (+) elevation in meters"
                  />
                  <NumberSliderInput
                    label="Position Z (Depth)"
                    value={currentPosZ}
                    onChange={(val) => handlePositionChange('z', val)}
                    min={-3.0}
                    max={3.0}
                    step={0.01}
                    unit="m"
                    color="sky"
                    precision={2}
                    resetValue={0}
                    description="Back (-) / Forward (+) depth distance in meters"
                  />
                </div>

                {/* 2D Placement D-Pad Controller */}
                <PositioningDpad
                  posX={currentPosX}
                  posY={currentPosY}
                  posZ={currentPosZ}
                  onChangeX={(val) => handlePositionChange('x', val)}
                  onChangeY={(val) => handlePositionChange('y', val)}
                  onChangeZ={(val) => handlePositionChange('z', val)}
                  onReset={() => {
                    handlePositionChange('x', 0);
                    handlePositionChange('y', 0);
                    handlePositionChange('z', 0);
                  }}
                />

                {/* Target Marker Snapping & 9-Point Placement Matrix */}
                <div className="p-3 rounded-xl bg-neutral-900/90 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-emerald-400">qr_code_2</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Marker Placement Matrix
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {(markerWidth * 100).toFixed(0)}×{(markerWidth * (markerAspectRatio || 0.5926) * 100).toFixed(0)}cm
                      </span>
                      <button
                        type="button"
                        onClick={() => setMarkerVisible((v) => !v)}
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${markerVisible
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}
                      >
                        {markerVisible ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* 3x3 Marker Graphic Anchor Matrix */}
                  <div className="bg-black/60 p-2 rounded-lg border border-neutral-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] text-neutral-400 font-mono">
                      <span>Snap to Marker Anchor:</span>
                      <span className="text-emerald-400 font-bold">XY Plane</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'TL', label: '↖ Top-L', title: 'Top-Left Corner' },
                        { id: 'TC', label: '↑ Top-C', title: 'Top-Center Edge' },
                        { id: 'TR', label: '↗ Top-R', title: 'Top-Right Corner' },
                        { id: 'CL', label: '← Mid-L', title: 'Left Center Edge' },
                        { id: 'CC', label: '• Center', title: 'Exact Marker Center (0, 0)' },
                        { id: 'CR', label: '→ Mid-R', title: 'Right Center Edge' },
                        { id: 'BL', label: '↙ Btm-L', title: 'Bottom-Left Corner' },
                        { id: 'BC', label: '↓ Btm-C', title: 'Bottom-Center Edge' },
                        { id: 'BR', label: '↘ Btm-R', title: 'Bottom-Right Corner' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => snapModelToMarkerAnchor(item.id)}
                          className={`py-1.5 px-1 rounded text-[10px] font-mono font-semibold border transition-all text-center flex items-center justify-center ${item.id === 'CC'
                            ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-300 shadow-sm'
                            : 'bg-neutral-800/90 hover:bg-neutral-700 border-neutral-700 hover:border-neutral-500 text-neutral-300'
                            }`}
                          title={item.title}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Depth Snapping & Fitting Tools */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => snapModelDepth(0)}
                      className="px-1.5 py-1.5 rounded bg-neutral-800 hover:bg-cyan-950/60 hover:border-cyan-500/50 border border-neutral-700 text-neutral-300 hover:text-cyan-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Snap flush to marker face (Z = 0)"
                    >
                      <span className="material-symbols-outlined text-xs text-cyan-400">vertical_align_center</span>
                      Flush (Z=0)
                    </button>
                    <button
                      type="button"
                      onClick={() => snapModelDepth(0.02)}
                      className="px-1.5 py-1.5 rounded bg-neutral-800 hover:bg-cyan-950/60 hover:border-cyan-500/50 border border-neutral-700 text-neutral-300 hover:text-cyan-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Float 2cm above marker face (Z = 0.02m)"
                    >
                      <span className="material-symbols-outlined text-xs text-sky-400">arrow_upward</span>
                      Float +2cm
                    </button>
                    <button
                      type="button"
                      onClick={fitModelToMarkerBounds}
                      className="px-1.5 py-1.5 rounded bg-neutral-800 hover:bg-purple-950/60 hover:border-purple-500/50 border border-neutral-700 text-neutral-300 hover:text-purple-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Auto-scale model to fit within marker width"
                    >
                      <span className="material-symbols-outlined text-xs text-purple-400">fit_screen</span>
                      Fit Bounds
                    </button>
                  </div>
                </div>
              </div>

              {/* Scale & Auto-Spin Animation */}
              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400">aspect_ratio</span>
                    Scale & Animation
                  </h2>
                </div>

                <NumberSliderInput
                  label={selectedMesh ? `Scale: ${selectedMesh.name}` : "Overall Model Scale"}
                  value={currentScale}
                  onChange={handleScaleChange}
                  min={0.05}
                  max={3.0}
                  step={0.05}
                  unit="x"
                  color="purple"
                  precision={2}
                  resetValue={selectedMesh ? 1.0 : 0.4}
                />

                {!selectedMesh && (
                  <div className="space-y-1.5 pt-1">
                    <NumberSliderInput
                      label="Auto-Spin Speed (ms)"
                      value={modelRotSpeed}
                      onChange={setModelRotSpeed}
                      min={0}
                      max={30000}
                      step={1000}
                      unit="ms"
                      color="indigo"
                      precision={0}
                      resetValue={10000}
                      description="Duration for full 360° spin (0 = Paused)"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: OBJECT HIERARCHY & DETECTED MESHES LIST                            */}
          {/* ========================================================================= */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400">view_in_ar</span>
                    Detected 3D Objects ({meshList.length})
                  </h2>
                  <p className="text-[10px] text-neutral-500">Click any mesh below or directly inside the 3D scene to inspect</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {deletedMeshNames.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreAllMeshes}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                      title="Restore all deleted objects"
                    >
                      <span className="material-symbols-outlined text-xs">undo</span> Restore ({deletedMeshNames.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddModelModalOpen(true)}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer shadow-xs border border-purple-500 transition-colors"
                    title="Add External 3D Model (.glb / .gltf from file, URL, or sample library)"
                  >
                    <span className="material-symbols-outlined text-xs">view_in_ar</span>
                    <span>+ Model</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeometryModalOpen(true)}
                    className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer shadow-xs border border-sky-500 transition-colors"
                    title="Add 3D Primitives (Cube, Sphere, Cylinder, Torus, etc.)"
                  >
                    <span className="material-symbols-outlined text-xs">deployed_code</span>
                    <span>+ Shape</span>
                  </button>
                  <button
                    type="button"
                    onClick={scanMeshes}
                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-medium text-neutral-300 flex items-center gap-1 cursor-pointer"
                    title="Rescan model meshes"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span> Rescan
                  </button>
                </div>
              </div>

              {/* Scene Groups & Multi-Select Management Section */}
              <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded-xl space-y-3 shadow-xs">
                {/* Header with Mode Toggles and New Group Action */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-400">folder_copy</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                      Scene Groups ({sceneGroups.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Multi-Select Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsMultiSelectMode((prev) => !prev)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${isMultiSelectMode
                        ? 'bg-amber-500 text-black shadow-xs ring-1 ring-amber-400'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                        }`}
                      title={isMultiSelectMode ? 'Multi-select mode is ON. Click objects to select/deselect them.' : 'Enable Multi-select mode (or hold Shift / Cmd / Ctrl while clicking)'}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {isMultiSelectMode ? 'checklist_rtl' : 'checklist'}
                      </span>
                      <span>{isMultiSelectMode ? 'Multi-Select [ON]' : 'Multi-Select'}</span>
                    </button>

                    {/* Group Selection Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setGroupSelectionMode((prev) => (prev === 'group' ? 'direct' : 'group'))}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${groupSelectionMode === 'group'
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700'
                        }`}
                      title={
                        groupSelectionMode === 'group'
                          ? 'Group Selection Mode: Clicking any object in viewport selects its entire parent group.'
                          : 'Direct Selection Mode: Clicking an object selects only that object directly, even if in a group.'
                      }
                    >
                      <span className="material-symbols-outlined text-xs">
                        {groupSelectionMode === 'group' ? 'workspaces' : 'near_me'}
                      </span>
                      <span>{groupSelectionMode === 'group' ? 'Group Select' : 'Direct Select'}</span>
                    </button>

                    {/* Create Group Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedObjects.length > 0) {
                          handleCreateGroupFromSelection();
                        } else {
                          handleCreateEmptyGroup();
                        }
                      }}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      title={
                        selectedObjects.length > 0
                          ? `Group ${selectedObjects.length} currently selected objects`
                          : 'Create a new empty group container'
                      }
                    >
                      <span className="material-symbols-outlined text-xs">create_new_folder</span>
                      <span>
                        {selectedObjects.length > 1
                          ? `Group (${selectedObjects.length})`
                          : '+ Group'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Groups List */}
                {sceneGroups.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800/80 text-center space-y-1">
                    <p className="text-[11px] text-neutral-400">
                      No groups created yet.
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Select multiple objects (hold Shift / Cmd or turn on Multi-Select) and click <strong className="text-amber-400">+ Group</strong> to transform them together with a unified gizmo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {sceneGroups.map((group) => {
                      const isSelected = selectedTargetType === 'group' && selectedGroupId === group.id;
                      const isCollapsed = Boolean(group.collapsed);
                      const availableToAdd = getAvailableObjectsForGroup(group.id);

                      return (
                        <div
                          key={group.id}
                          className={`rounded-lg border transition-all ${isSelected
                            ? 'bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                            : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                            }`}
                        >
                          {/* Group Header Bar */}
                          <div
                            onClick={() => selectGroup(group.id)}
                            className="p-2 flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleGroupCollapse(group.id);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                                title={isCollapsed ? 'Expand group members' : 'Collapse group members'}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isCollapsed ? 'chevron_right' : 'expand_more'}
                                </span>
                              </button>
                              <span className="material-symbols-outlined text-sm text-amber-400 shrink-0">
                                {isCollapsed ? 'folder' : 'folder_open'}
                              </span>
                              <span className="text-xs font-bold text-neutral-200 truncate">
                                {group.name}
                              </span>
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-mono shrink-0">
                                {group.itemIds.length} {group.itemIds.length === 1 ? 'object' : 'objects'}
                              </span>
                              {isSelected && (
                                <span className="text-[8px] bg-amber-500/30 text-amber-300 border border-amber-500/50 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                                  ACTIVE
                                </span>
                              )}
                            </div>

                            {/* Group Actions */}
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  selectGroup(group.id);
                                  focusCameraOnSelectedObject();
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors cursor-pointer"
                                title={`Focus camera on ${group.name}`}
                              >
                                <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleGroupVisibility(group.id)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${group.visible !== false
                                  ? 'text-neutral-400 hover:text-white'
                                  : 'text-neutral-600 hover:text-neutral-400'
                                  }`}
                                title={group.visible !== false ? 'Hide group objects' : 'Show group objects'}
                              >
                                <span className="material-symbols-outlined text-xs">
                                  {group.visible !== false ? 'visibility' : 'visibility_off'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportShapeAsGLB({ type: 'group', id: group.id })}
                                className="w-6 h-6 rounded flex items-center justify-center text-teal-400 hover:text-teal-300 hover:bg-teal-950/40 transition-colors cursor-pointer"
                                title={`Export group "${group.name}" as .GLB`}
                              >
                                <span className="material-symbols-outlined text-xs">download</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateGroup(group.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 transition-colors cursor-pointer"
                                title={`Duplicate group "${group.name}" (Ctrl+D)`}
                              >
                                <span className="material-symbols-outlined text-xs">content_copy</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUngroup(group.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-amber-400 hover:text-amber-200 hover:bg-amber-950/60 transition-colors cursor-pointer"
                                title={`Ungroup ${group.name} (preserves member positions)`}
                              >
                                <span className="material-symbols-outlined text-xs">layers_clear</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(group.id, false)}
                                className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-200 hover:bg-red-950/60 transition-colors cursor-pointer"
                                title={`Delete group container ${group.name}`}
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Expanded Group Body */}
                          {!isCollapsed && (
                            <div className="px-2.5 pb-2.5 pt-1 border-t border-neutral-800/80 space-y-2">
                              {/* Member list */}
                              {group.itemIds.length === 0 ? (
                                <p className="text-[10px] text-neutral-500 italic py-1">
                                  No objects in this group yet. Select an object below to add.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {group.itemIds.map((item) => {
                                    const details = getMemberItemDetails(item);
                                    const isItemDirectlySelected = selectedTargetType === item.type && (
                                      (item.type === 'mesh' && selectedMeshUuid === item.id) ||
                                      (item.type === 'geometry' && selectedGeometryId === item.id) ||
                                      (item.type === 'customModel' && selectedCustomModelId === item.id) ||
                                      (item.type === 'text3d' && selectedText3DId === item.id) ||
                                      (item.type === 'light' && selectedLightId === item.id)
                                    );

                                    return (
                                      <div
                                        key={`${item.type}:${item.id}`}
                                        className={`flex items-center justify-between p-1.5 rounded text-xs transition-colors ${isItemDirectlySelected
                                          ? 'bg-indigo-950/40 border border-indigo-500/50'
                                          : 'bg-black/40 border border-neutral-800/70 hover:border-neutral-700'
                                          }`}
                                      >
                                        <div
                                          onClick={(e) => {
                                            if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                                              toggleObjectSelection(item.type, item.id);
                                            } else {
                                              selectSceneObject(item.type, item.id);
                                            }
                                          }}
                                          className="flex items-center gap-1.5 min-w-0 cursor-pointer flex-1"
                                          title={`Click to directly select ${details.name}`}
                                        >
                                          <span className="material-symbols-outlined text-xs text-neutral-400 shrink-0">
                                            {details.icon}
                                          </span>
                                          <span className="text-[11px] font-medium text-neutral-300 truncate">
                                            {details.name}
                                          </span>
                                          <span className="text-[9px] text-neutral-500 font-mono capitalize">
                                            ({item.type})
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                                                toggleObjectSelection(item.type, item.id);
                                              } else {
                                                selectSceneObject(item.type, item.id);
                                              }
                                            }}
                                            className="px-1.5 py-0.5 text-[9px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono transition-colors cursor-pointer"
                                            title="Directly select this object"
                                          >
                                            Select
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveFromGroup(group.id, item)}
                                            className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-red-400 rounded hover:bg-red-950/40 transition-colors cursor-pointer"
                                            title="Remove object from this group"
                                          >
                                            <span className="material-symbols-outlined text-xs">close</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Add Object to Group Dropdown */}
                              {availableToAdd.length > 0 && (
                                <div className="pt-1">
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const [type, id] = e.target.value.split('::');
                                        handleAddToGroup(group.id, { type, id });
                                        e.target.value = '';
                                      }
                                    }}
                                    className="w-full px-2 py-1 bg-black/60 border border-neutral-800 hover:border-neutral-700 rounded text-[10px] text-neutral-300 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                                  >
                                    <option value="" disabled>
                                      + Add Object to Group ({availableToAdd.length} available)...
                                    </option>
                                    {availableToAdd.map((obj) => (
                                      <option key={`${obj.type}::${obj.id}`} value={`${obj.type}::${obj.id}`}>
                                        [{obj.type.toUpperCase()}] {obj.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Group Inspector (Transform Controls & Details) */}
                {(() => {
                  if (selectedTargetType !== 'group' || !selectedGroupId) return null;
                  const currentGroup = sceneGroups.find((g) => g.id === selectedGroupId);
                  if (!currentGroup) return null;

                  return (
                    <div className="p-3 bg-neutral-900/95 rounded-xl border border-amber-500/40 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-amber-400 text-sm">tune</span>
                          <div>
                            <h4 className="text-xs font-bold text-white truncate max-w-[180px]">
                              {currentGroup.name}
                            </h4>
                            <span className="text-[9px] text-amber-400 font-mono">
                              Group Transform Inspector ({currentGroup.itemIds.length} objects)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={focusCameraOnSelectedObject}
                            className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Focus camera on this group"
                          >
                            <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                            Focus
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportShapeAsGLB({ type: 'group', id: currentGroup.id })}
                            className="px-2 py-1 bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title={`Export group "${currentGroup.name}" as standalone .GLB`}
                          >
                            <span className="material-symbols-outlined text-xs">download</span>
                            GLB
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateGroup(currentGroup.id)}
                            className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title={`Duplicate group "${currentGroup.name}" (Ctrl+D)`}
                          >
                            <span className="material-symbols-outlined text-xs">content_copy</span>
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUngroup(currentGroup.id)}
                            className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Ungroup objects"
                          >
                            <span className="material-symbols-outlined text-xs">layers_clear</span>
                            Ungroup
                          </button>
                        </div>
                      </div>

                      {/* Group Name Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Group Name
                        </label>
                        <input
                          type="text"
                          value={currentGroup.name}
                          onChange={(e) => handleUpdateGroupName(currentGroup.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-black/60 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Position X, Y, Z */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Group Position (X, Y, Z)</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateGroupTransform(currentGroup.id, { posX: 0, posY: 0, posZ: 0 })}
                            className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset (0,0,0)
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <NumberSliderInput
                            label="X"
                            value={currentGroup.posX ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { posX: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="rose"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Y"
                            value={currentGroup.posY ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { posY: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="emerald"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Z"
                            value={currentGroup.posZ ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { posZ: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="sky"
                            showRange={false}
                            stepButtons={false}
                          />
                        </div>
                      </div>

                      {/* Rotation Pitch, Yaw, Roll */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Group Rotation (Degrees)</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateGroupTransform(currentGroup.id, { rotX: 0, rotY: 0, rotZ: 0 })}
                            className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <NumberSliderInput
                            label="Rot X"
                            value={currentGroup.rotX ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { rotX: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="rose"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Rot Y"
                            value={currentGroup.rotY ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { rotY: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="emerald"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Rot Z"
                            value={currentGroup.rotZ ?? 0}
                            onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { rotZ: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="sky"
                            showRange={false}
                            stepButtons={false}
                          />
                        </div>
                      </div>

                      {/* Group Scale */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Group Scale</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateGroupTransform(currentGroup.id, { scale: 1, scaleX: 1, scaleY: 1, scaleZ: 1 })}
                            className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset 1x
                          </button>
                        </div>
                        <NumberSliderInput
                          label="Uniform Scale"
                          value={currentGroup.scale ?? 1}
                          onChange={(val) => handleUpdateGroupTransform(currentGroup.id, { scale: val, scaleX: val, scaleY: val, scaleZ: val })}
                          min={0.01}
                          max={20}
                          step={0.05}
                          precision={2}
                          color="amber"
                          description="Scales all objects in the group synchronously around the group center"
                        />
                      </div>

                      {/* Group Danger Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateGroup(currentGroup.id)}
                            className="px-2.5 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title={`Duplicate group "${currentGroup.name}" (Ctrl+D)`}
                          >
                            <span className="material-symbols-outlined text-xs">content_copy</span>
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUngroup(currentGroup.id)}
                            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">layers_clear</span>
                            Ungroup
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(currentGroup.id, false)}
                          className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                          Delete Group
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Active Multi-Selection Card */}
              {selectedObjects.length > 1 && selectedTargetType !== 'group' && (
                <div className="p-3 bg-gradient-to-b from-amber-950/30 via-neutral-900/90 to-neutral-950 border border-amber-500/40 rounded-xl space-y-3 shadow-md animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <span className="material-symbols-outlined text-sm">checklist_rtl</span>
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-neutral-100">
                            Multi-Selection Active
                          </h4>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-mono font-bold">
                            {selectedObjects.length} items
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400">
                          Unified transform gizmo active at selection centroid
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={focusCameraOnSelectedObject}
                        className="px-2 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Focus camera view on selected objects"
                      >
                        <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                        Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportShapeAsGLB({ type: 'multi' })}
                        className="px-2 py-1 bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-500/30 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Export all selected objects as a combined .GLB"
                      >
                        <span className="material-symbols-outlined text-xs">download</span>
                        GLB
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectionAndDetachGizmo}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Deselect all selected objects"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Selected Objects Chips */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                      Selected Objects ({selectedObjects.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {selectedObjects.map((item) => {
                        const details = getMemberItemDetails(item);
                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900/90 border border-amber-500/30 text-neutral-200 text-xs shadow-xs"
                          >
                            <span className="material-symbols-outlined text-xs text-amber-400">
                              {details.icon}
                            </span>
                            <span className="font-medium truncate max-w-[120px]" title={details.name}>
                              {details.name}
                            </span>
                            <span className="text-[9px] text-neutral-500 uppercase font-mono">
                              ({item.type})
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleObjectSelection(item.type, item.id);
                              }}
                              className="w-4 h-4 rounded hover:bg-neutral-800 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                              title={`Remove ${details.name} from selection`}
                            >
                              <span className="material-symbols-outlined text-[11px]">close</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-400">Gizmo:</span>
                      <button
                        type="button"
                        onClick={() => setGizmoMode('translate')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${gizmoMode === 'translate'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        title="Translate (W)"
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => setGizmoMode('rotate')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${gizmoMode === 'rotate'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        title="Rotate (E)"
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => setGizmoMode('scale')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${gizmoMode === 'scale'
                          ? 'bg-rose-600 text-white'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        title="Scale (R)"
                      >
                        Scale
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateGroupFromSelection()}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      title="Create a Scene Group containing all selected objects"
                    >
                      <span className="material-symbols-outlined text-xs">create_new_folder</span>
                      <span>+ Create Group</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search Filter */}
              {meshList.length > 3 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search objects or materials..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-neutral-500 text-sm">
                    search
                  </span>
                </div>
              )}

              {/* Root Selection Card */}
              <div
                onClick={() => selectSceneObject('model')}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${selectedTargetType === 'model'
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedTargetType === 'model' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                    <span className="material-symbols-outlined text-lg">language</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Entire 3D Model (Root Anchor)
                      {selectedTargetType === 'model' && <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">ACTIVE</span>}
                      {Boolean(activeVideoUrl) && videoTargetMesh === 'all' && (
                        <span className="text-[8px] bg-red-500/30 text-red-300 border border-red-500/50 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">movie</span>
                          VIDEO
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-neutral-400">Controls scene scale, global orientation & placement</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {Boolean(activeVideoUrl) && videoTargetMesh === 'all' && (
                    <button
                      type="button"
                      onClick={handleRemoveVideoLayer}
                      className="w-7 h-7 rounded flex items-center justify-center text-red-400 hover:text-red-200 hover:bg-red-950/60 border border-red-500/30 transition-colors cursor-pointer"
                      title="Remove video texture layer from entire 3D model"
                    >
                      <span className="material-symbols-outlined text-sm">videocam_off</span>
                    </button>
                  )}
                  {Boolean(activeVideoUrl) && videoTargetMesh !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setVideoTargetMesh('all');
                        snapVideoToLayer('all');
                      }}
                      className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-indigo-300 hover:bg-indigo-950/60 border border-neutral-700 transition-colors cursor-pointer"
                      title="Attach active video to Entire 3D Model (all meshes)"
                    >
                      <span className="material-symbols-outlined text-sm">movie</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      selectSceneObject('model');
                      setCameraView('front');
                    }}
                    className="w-7 h-7 rounded flex items-center justify-center text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 border border-cyan-500/30 transition-colors cursor-pointer"
                    title="Reposition camera in frontal view of entire 3D model"
                  >
                    <span className="material-symbols-outlined text-sm">
                      filter_center_focus
                    </span>
                  </button>
                </div>
              </div>

              {/* List of Detected Meshes */}
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredMeshes.map((mesh, i) => {
                  const isSelected = selectedMeshUuid === mesh.uuid && selectedTargetType === 'mesh';
                  const isMultiSelected = selectedObjects.some((it) => it.type === 'mesh' && it.id === mesh.uuid);
                  const meshGroup = sceneGroups.find((g) => g.itemIds.some((it) => it.type === 'mesh' && it.id === mesh.uuid));
                  const isVideoTarget = Boolean(activeVideoUrl) && (
                    videoTargetMesh === mesh.name ||
                    videoTargetMesh === mesh.uuid ||
                    (videoTargetMesh === 'auto' && (
                      (mesh.name || '').toLowerCase().includes('screen') ||
                      (mesh.name || '').toLowerCase().includes('display') ||
                      (mesh.name || '').toLowerCase().includes('graphic') ||
                      (mesh.name || '').toLowerCase().includes('cloth')
                    ))
                  );
                  return (
                    <div
                      key={mesh.uuid}
                      onClick={(e) => {
                        if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                          toggleObjectSelection('mesh', mesh.uuid);
                        } else {
                          selectSceneObject('mesh', mesh.uuid);
                        }
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${isSelected
                        ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : isMultiSelected
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                          : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isMultiSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleObjectSelection('mesh', mesh.uuid);
                          }}
                          className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                          title="Toggle selection for multi-object editing or grouping"
                        />
                        <div className={`w-7 h-7 rounded flex items-center justify-center font-mono text-[11px] font-bold shrink-0 ${isSelected || isMultiSelected ? 'bg-indigo-500/30 text-indigo-300' : 'bg-neutral-800 text-neutral-400 group-hover:text-neutral-200'
                          }`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-neutral-200 truncate">{mesh.name}</span>
                            {isSelected && (
                              <span className="text-[8px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-mono font-bold">
                                SELECTED
                              </span>
                            )}
                            {isMultiSelected && !isSelected && (
                              <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                MULTI
                              </span>
                            )}
                            {meshGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectGroup(meshGroup.id);
                                }}
                                className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                title={`Part of group "${meshGroup.name}". Click to select group.`}
                              >
                                <span className="material-symbols-outlined text-[10px]">folder</span>
                                {meshGroup.name}
                              </button>
                            )}
                            {isVideoTarget && (
                              <span className="text-[8px] bg-red-500/30 text-red-300 border border-red-500/50 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">movie</span>
                                VIDEO
                              </span>
                            )}
                            {mesh.material?.hasCustomTexture && (
                              <span className="text-[8px] bg-purple-500/30 text-purple-300 border border-purple-500/50 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5" title={mesh.material.textureFileName || 'Custom Texture / UV Map'}>
                                <span className="material-symbols-outlined text-[10px]">texture</span>
                                TEX
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono truncate">
                            <span>Mat: {mesh.materialName || 'Default'}</span>
                            {mesh.material?.hasCustomTexture && (
                              <>
                                <span>•</span>
                                <span className="text-purple-400 truncate max-w-[90px]" title={mesh.material.textureFileName || 'Custom UV Texture'}>
                                  {mesh.material.textureFileName || 'Custom UV'}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-rose-400">R:({mesh.rotation.x}°,{mesh.rotation.y}°)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Upload UV Map / Texture Image */}
                        <label
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${mesh.material?.hasCustomTexture
                            ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-950/70 bg-purple-950/40 border border-purple-500/40'
                            : 'text-neutral-400 hover:text-purple-300 hover:bg-purple-950/60'
                            }`}
                          title={
                            mesh.material?.hasCustomTexture
                              ? `Replace UV Map / texture on ${mesh.name}`
                              : `Upload image for ${mesh.name}'s UV map / texture`
                          }
                        >
                          {textureUploadingUuid === mesh.uuid ? (
                            <span className="material-symbols-outlined text-sm text-purple-400 animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">texture</span>
                          )}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/jpg"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleApplyMeshTexture(mesh, e.target.files[0]);
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        {/* Remove Custom Material & Delete from Cloud Storage */}
                        {mesh.material?.hasCustomTexture && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMeshTexture(mesh.uuid, mesh.name)}
                            className="w-6 h-6 rounded flex items-center justify-center text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-500/30 transition-colors cursor-pointer"
                            title={`Delete custom texture from ${mesh.name}, remove from Cloud Storage, and restore original material`}
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}

                        {Boolean(activeVideoUrl) && !isVideoTarget && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = mesh.name || mesh.uuid;
                              setVideoTargetMesh(target);
                              snapVideoToLayer(target);
                            }}
                            className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-indigo-300 hover:bg-indigo-950/60 transition-colors cursor-pointer"
                            title={`Attach active video to ${mesh.name}`}
                          >
                            <span className="material-symbols-outlined text-sm">movie</span>
                          </button>
                        )}
                        {isVideoTarget && (
                          <button
                            type="button"
                            onClick={handleRemoveVideoLayer}
                            className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-200 hover:bg-red-950/60 transition-colors cursor-pointer"
                            title={`Remove video texture layer from ${mesh.name}`}
                          >
                            <span className="material-symbols-outlined text-sm">videocam_off</span>
                          </button>
                        )}
                        {/* Camera Frontal View Button */}
                        <button
                          type="button"
                          onClick={() => focusCameraOnMesh(mesh.uuid, mesh.name)}
                          className="w-6 h-6 rounded flex items-center justify-center text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors cursor-pointer"
                          title={`Reposition camera in front of ${mesh.name} (Frontal View)`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            filter_center_focus
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMeshVisibilityToggle(mesh.uuid)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${mesh.visible
                            ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                            : 'text-neutral-600 bg-neutral-900'
                            }`}
                          title={mesh.visible ? 'Hide mesh' : 'Show mesh'}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {mesh.visible ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMeshUuid(mesh.uuid);
                            setActiveTab('transform');
                          }}
                          className="px-2 py-1 bg-neutral-800 hover:bg-indigo-600 rounded text-[10px] font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                          title="Open Dials & Settings for this mesh"
                        >
                          Edit
                        </button>

                        {/* Inline Delete Confirmation or Button */}
                        {confirmDeleteUuid === mesh.uuid ? (
                          <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/60 rounded px-1.5 py-0.5 shadow-sm">
                            <span className="text-[9px] font-mono text-rose-300 font-bold uppercase tracking-tight">Del?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMesh(mesh.uuid, mesh.name)}
                              className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold font-mono transition-colors cursor-pointer"
                              title="Confirm delete"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUuid(null)}
                              className="px-1 py-0.5 text-neutral-400 hover:text-white text-[9px] font-mono transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUuid(mesh.uuid)}
                            className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title={`Delete ${mesh.name} from scene`}
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {meshList.length === 0 && (
                  <div className="p-4 text-center text-neutral-500 text-xs bg-neutral-900/30 rounded-lg border border-neutral-800/60">
                    No 3D meshes detected. Load a batch or select a local .glb file.
                  </div>
                )}
              </div>

              {/* Deleted Objects Section with Individual Restore Options */}
              {deletedMeshNames.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400/90 flex items-center gap-1 font-bold">
                      <span className="material-symbols-outlined text-xs">delete</span>
                      Deleted Objects ({deletedMeshNames.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleRestoreAllMeshes}
                      className="text-[10px] font-mono text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                    >
                      Restore All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {deletedMeshNames.map((name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-2 rounded bg-neutral-900/50 border border-neutral-800/60 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></span>
                          <span className="font-mono text-[11px] truncate line-through text-neutral-500">
                            {name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreMesh(name)}
                          className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700/60 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                          title={`Restore ${name} to scene`}
                        >
                          <span className="material-symbols-outlined text-xs">undo</span> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional 3D Primitive Geometries Section */}
              <div className="pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-teal-400">deployed_code</span>
                    Additional Shapes ({additionalGeometries.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setGeometryModalOpen(true)}
                    className="text-[10px] bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 rounded px-2 py-0.5 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    Add Shape
                  </button>
                </div>
                {additionalGeometries.length === 0 ? (
                  <p className="text-[11px] text-neutral-500 italic p-2 bg-neutral-900/40 rounded border border-neutral-800">
                    No additional geometries added yet. Click "+ Shape" to add primitive 3D geometries.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {additionalGeometries.map((geom) => {
                      const isSelected = selectedGeometryId === geom.id && selectedTargetType === 'geometry';
                      const isMultiSelected = selectedObjects.some((it) => it.type === 'geometry' && it.id === geom.id);
                      const geomGroup = sceneGroups.find((g) => g.itemIds.some((it) => it.type === 'geometry' && it.id === geom.id));
                      return (
                        <div
                          key={geom.id}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                              toggleObjectSelection('geometry', geom.id);
                            } else {
                              selectSceneObject('geometry', geom.id);
                              setActiveTab('shapes');
                            }
                          }}
                          className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${isSelected
                            ? 'bg-teal-950/50 border-teal-500 shadow-md ring-1 ring-teal-500/50'
                            : isMultiSelected
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                              : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isMultiSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleObjectSelection('geometry', geom.id);
                              }}
                              className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                              title="Toggle selection for multi-object editing or grouping"
                            />
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: geom.color || '#38bdf8' }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-neutral-200 truncate block">
                                  {geom.name}
                                </span>
                                {isMultiSelected && !isSelected && (
                                  <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                    MULTI
                                  </span>
                                )}
                                {geomGroup && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectGroup(geomGroup.id);
                                    }}
                                    className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                    title={`Part of group "${geomGroup.name}". Click to select group.`}
                                  >
                                    <span className="material-symbols-outlined text-[10px]">folder</span>
                                    {geomGroup.name}
                                  </button>
                                )}
                              </div>
                              <span className="text-[9px] text-teal-400 font-mono capitalize">
                                {geom.type}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleExportShapeAsGLB(geom.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-teal-400 hover:text-teal-300 hover:bg-teal-950/40 transition-colors cursor-pointer"
                              title="Export shape as .GLB"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleGeometryVisibility(geom.id)}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${geom.visible !== false
                                ? 'text-neutral-400 hover:text-white'
                                : 'text-neutral-600 hover:text-neutral-400'
                                }`}
                              title={geom.visible !== false ? 'Hide shape' : 'Show shape'}
                            >
                              <span className="material-symbols-outlined text-xs">
                                {geom.visible !== false ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGeometry(geom.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Delete shape"
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

              {/* External 3D Models Section */}
              <div className="pt-3 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400">view_in_ar</span>
                    External 3D Models ({customModels.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddModelModalOpen(true)}
                    className="text-[10px] bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded px-2 py-0.5 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    Add Model
                  </button>
                </div>

                {customModels.length === 0 ? (
                  <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-800 text-center space-y-1.5">
                    <p className="text-[11px] text-neutral-400">
                      No external 3D models added to the scene yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddModelModalOpen(true)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">upload_file</span>
                      Upload .GLB or Choose from 3D Library
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {customModels.map((model) => {
                      const isSelected = selectedCustomModelId === model.id && selectedTargetType === 'customModel';
                      const isMultiSelected = selectedObjects.some((it) => it.type === 'customModel' && it.id === model.id);
                      const modelGroup = sceneGroups.find((g) => g.itemIds.some((it) => it.type === 'customModel' && it.id === model.id));
                      return (
                        <div
                          key={model.id}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                              toggleObjectSelection('customModel', model.id);
                            } else {
                              selectSceneObject('customModel', model.id);
                            }
                          }}
                          className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${isSelected
                            ? 'bg-purple-950/50 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                            : isMultiSelected
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                              : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isMultiSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleObjectSelection('customModel', model.id);
                              }}
                              className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                              title="Toggle selection for multi-object editing or grouping"
                            />
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-sm">view_in_ar</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-neutral-200 truncate block">
                                  {model.name}
                                </span>
                                {isMultiSelected && !isSelected && (
                                  <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                    MULTI
                                  </span>
                                )}
                                {modelGroup && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectGroup(modelGroup.id);
                                    }}
                                    className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                    title={`Part of group "${modelGroup.name}". Click to select group.`}
                                  >
                                    <span className="material-symbols-outlined text-[10px]">folder</span>
                                    {modelGroup.name}
                                  </button>
                                )}
                              </div>
                              <span className="text-[9px] text-purple-400 font-mono truncate block">
                                {model.fileName || '3D Model'} • {model.scale || 1}x {model.autoRotate ? '• ⟳ Auto' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleExportShapeAsGLB(model.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 transition-colors cursor-pointer"
                              title="Export external model as .GLB"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateCustomModel(model.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors cursor-pointer"
                              title="Duplicate model in scene"
                            >
                              <span className="material-symbols-outlined text-xs">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCustomModelVisibility(model.id)}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${model.visible !== false
                                ? 'text-neutral-400 hover:text-white'
                                : 'text-neutral-600 hover:text-neutral-400'
                                }`}
                              title={model.visible !== false ? 'Hide model' : 'Show model'}
                            >
                              <span className="material-symbols-outlined text-xs">
                                {model.visible !== false ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomModel(model.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Delete model from scene"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected External Model Inspector */}
                {(() => {
                  const currentModel = customModels.find((m) => m.id === selectedCustomModelId);
                  if (!currentModel) return null;

                  return (
                    <div className="mt-3 p-3.5 bg-neutral-900/80 rounded-xl border border-purple-500/30 space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-purple-400 text-base">tune</span>
                          <div>
                            <h4 className="text-xs font-bold text-white truncate max-w-[180px]">
                              {currentModel.name}
                            </h4>
                            <span className="text-[9px] text-purple-400 font-mono">
                              External 3D Model Inspector
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={focusCameraOnSelectedObject}
                            className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Focus 3D camera on this model"
                          >
                            <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                            Focus
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportShapeAsGLB(currentModel.id)}
                            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Export model as standalone .GLB"
                          >
                            <span className="material-symbols-outlined text-xs">download</span>
                            GLB
                          </button>
                        </div>
                      </div>

                      {/* Model Name Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Model Display Name
                        </label>
                        <input
                          type="text"
                          value={currentModel.name}
                          onChange={(e) => handleUpdateCustomModel(currentModel.id, { name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-black/60 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Transform: Position X, Y, Z */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Position (X, Y, Z meters)</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCustomModel(currentModel.id, { posX: 0, posY: 0, posZ: 0 })}
                            className="text-[9px] text-purple-400 hover:underline cursor-pointer"
                          >
                            Reset (0,0,0)
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <NumberSliderInput
                            label="X"
                            value={currentModel.posX ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { posX: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="rose"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Y"
                            value={currentModel.posY ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { posY: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="emerald"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Z"
                            value={currentModel.posZ ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { posZ: val })}
                            min={-10}
                            max={10}
                            step={0.05}
                            color="sky"
                            showRange={false}
                            stepButtons={false}
                          />
                        </div>
                      </div>

                      {/* Transform: Rotation X, Y, Z */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Rotation (Degrees)</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCustomModel(currentModel.id, { rotX: 0, rotY: 0, rotZ: 0 })}
                            className="text-[9px] text-purple-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <NumberSliderInput
                            label="Rot X"
                            value={currentModel.rotX ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { rotX: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="rose"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Rot Y"
                            value={currentModel.rotY ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { rotY: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="emerald"
                            showRange={false}
                            stepButtons={false}
                          />
                          <NumberSliderInput
                            label="Rot Z"
                            value={currentModel.rotZ ?? 0}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { rotZ: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="sky"
                            showRange={false}
                            stepButtons={false}
                          />
                        </div>
                      </div>

                      {/* Transform: Scale */}
                      <div className="space-y-1">
                        <NumberSliderInput
                          label="Scale Multiplier"
                          value={currentModel.scale ?? 1}
                          onChange={(val) => handleUpdateCustomModel(currentModel.id, { scale: val, scaleX: val, scaleY: val, scaleZ: val })}
                          min={0.01}
                          max={20}
                          step={0.05}
                          precision={2}
                          color="purple"
                          description="Scale size of the external 3D model"
                        />
                      </div>

                      {/* Auto-Rotate Option */}
                      <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-purple-400">autorenew</span>
                            Auto-Rotate in Scene
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(currentModel.autoRotate)}
                            onChange={(e) => handleUpdateCustomModel(currentModel.id, { autoRotate: e.target.checked })}
                            className="rounded bg-neutral-900 border-neutral-700 text-purple-500 focus:ring-purple-400"
                          />
                        </label>

                        {currentModel.autoRotate && (
                          <NumberSliderInput
                            label="Rotation Speed (deg/s)"
                            value={currentModel.rotationSpeed ?? 25}
                            onChange={(val) => handleUpdateCustomModel(currentModel.id, { rotationSpeed: val })}
                            min={-180}
                            max={180}
                            step={5}
                            color="purple"
                            showRange={false}
                          />
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-xs">
                        <button
                          type="button"
                          onClick={() => handleDuplicateCustomModel(currentModel.id)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">content_copy</span>
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomModel(currentModel.id)}
                          className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                          Delete Model
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: ADDITIONAL 3D GEOMETRIES (Studio4D4 primitives parity)               */}
          {/* ========================================================================= */}
          {activeTab === 'shapes' && (
            <div className="space-y-5">
              {/* Header with Quick Add Action */}
              <div className="flex shape-interact items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-teal-400">deployed_code</span>
                    3D Shapes & Geometries ({additionalGeometries.length})
                  </h2>
                  <p className="text-[10px] text-neutral-500">
                    Add primitive 3D geometries (Cube, Sphere, Cylinder, Torus, etc.) locked to your scene
                  </p>
                </div>
                <div className=" shape-interact-buttons flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFaceSketchStudioOpen(true)}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-teal-500 via-cyan-600 to-indigo-600 hover:opacity-95 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-950/40 transition-all cursor-pointer"
                    title="Draw a shape on any object face and extrude it into 3D (X)"
                  >
                    <span className="material-symbols-outlined text-sm">draw</span>
                    <span>+ Draw on Face</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModelModalOpen(true)}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-950/40 transition-all cursor-pointer"
                    title="Add External 3D Model (.glb / .gltf from file, URL, or sample library)"
                  >
                    <span className="material-symbols-outlined text-sm">view_in_ar</span>
                    <span>+ Add Model</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVectorGeom(null);
                      setVectorPenInitialMode('inflate');
                      setVectorPenModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 hover:opacity-95 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-950/40 transition-all cursor-pointer"
                    title="Draw 2D vector silhouette and inflate into curved 3D volumetric geometry"
                  >
                    <span className="material-symbols-outlined text-sm">bubble_chart</span>
                    <span>+ Inflate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVectorGeom(null);
                      setVectorPenInitialMode('extrude');
                      setVectorPenModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:opacity-95 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-950/40 transition-all cursor-pointer"
                    title="Draw custom vector shape using Photoshop-style pen tool and extrude into 3D"
                  >
                    <span className="material-symbols-outlined text-sm">gesture</span>
                    <span>+ Pen Tool</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeometryModalOpen(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-950/40 transition-all cursor-pointer"
                    title="Add new 3D primitive geometry"
                  >
                    <span className="material-symbols-outlined text-sm">add_box</span>
                    <span>+ Add Shape</span>
                  </button>
                </div>
              </div>

              {/* Zero Geometries Empty State */}
              {additionalGeometries.length === 0 ? (
                <div className="p-6 bg-gradient-to-b from-neutral-900/80 to-neutral-950 border border-neutral-800 rounded-xl text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <span className="material-symbols-outlined text-2xl">deployed_code</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-neutral-200">No Custom Geometries in Scene</h3>
                    <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                      Draw custom vector paths with the Photoshop-style Pen Tool, inflate 2D silhouettes into organic 3D volumes, or add 3D primitives (cubes, spheres, cylinders, cones, torus rings) to compose your AR experience.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFaceSketchStudioOpen(true)}
                      className="px-3.5 py-2 bg-gradient-to-r from-teal-500 via-cyan-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">draw</span>
                      <span>Draw on Face & Extrude</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVectorGeom(null);
                        setVectorPenInitialMode('inflate');
                        setVectorPenModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-teal-500 via-emerald-600 to-cyan-600 hover:opacity-90 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">bubble_chart</span>
                      <span>Inflate Silhouette</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVectorGeom(null);
                        setVectorPenInitialMode('extrude');
                        setVectorPenModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">gesture</span>
                      <span>Draw with Pen Tool</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeometryModalOpen(true)}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>Add 3D Shape</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Horizontal Shape Selector Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      Active Shapes in Scene ({additionalGeometries.length})
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {additionalGeometries.map((g) => {
                        const isSelected = selectedGeometryId === g.id && selectedTargetType === 'geometry';
                        const isMultiSelected = selectedObjects.some((it) => it.type === 'geometry' && it.id === g.id);
                        const shapeGroup = sceneGroups.find((grp) => grp.itemIds.some((it) => it.type === 'geometry' && it.id === g.id));
                        return (
                          <div
                            key={g.id}
                            onClick={(e) => {
                              if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                                toggleObjectSelection('geometry', g.id);
                              } else {
                                selectSceneObject('geometry', g.id);
                              }
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between group ${isSelected
                              ? 'bg-teal-950/60 border-teal-400 ring-1 ring-teal-500/50 shadow'
                              : isMultiSelected
                                ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                                : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isMultiSelected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleObjectSelection('geometry', g.id);
                                }}
                                className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                                title="Toggle selection for multi-object editing or grouping"
                              />
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                                style={{ backgroundColor: g.color || '#38bdf8' }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs font-bold text-neutral-200 truncate block">
                                    {g.name}
                                  </span>
                                  {shapeGroup && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectGroup(shapeGroup.id);
                                      }}
                                      className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                      title={`Part of group "${shapeGroup.name}". Click to select group.`}
                                    >
                                      <span className="material-symbols-outlined text-[10px]">folder</span>
                                      {shapeGroup.name}
                                    </button>
                                  )}
                                </div>
                                <span className="text-[9px] text-teal-400 font-mono capitalize">
                                  {g.type}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportShapeAsGLB(g.id);
                                }}
                                className="p-1 rounded text-neutral-400 hover:text-teal-300 hover:bg-teal-950/40 transition-colors cursor-pointer"
                                title="Export shape as .GLB"
                              >
                                <span className="material-symbols-outlined text-xs">download</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleGeometryVisibility(g.id);
                                }}
                                className={`p-1 rounded transition-colors ${g.visible !== false ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-300'}`}
                                title={g.visible !== false ? 'Hide' : 'Show'}
                              >
                                <span className="material-symbols-outlined text-xs">
                                  {g.visible !== false ? 'visibility' : 'visibility_off'}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Geometry Inspector */}
                  {(() => {
                    const currentGeom = additionalGeometries.find((g) => g.id === selectedGeometryId) || additionalGeometries[0];
                    if (!currentGeom) return null;
                    const def = GEOMETRY_DEFINITIONS.find((d) => d.id === currentGeom.type);

                    return (
                      <div className="p-3.5 bg-neutral-900/80 rounded-xl border border-teal-500/30 space-y-4 shadow-sm">
                        {/* Selected Shape Title & Actions */}
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-800 gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-lg text-teal-400 shrink-0">
                              {def?.icon || 'deployed_code'}
                            </span>
                            <input
                              type="text"
                              value={currentGeom.name}
                              onChange={(e) => handleUpdateGeometry(currentGeom.id, { name: e.target.value })}
                              className="text-xs font-bold text-white bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-full focus:outline-none focus:border-teal-400"
                              placeholder="Shape Name"
                            />
                            <span className="text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded shrink-0">
                              {currentGeom.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleExportShapeAsGLB(currentGeom.id)}
                              className="h-7 px-2.5 rounded bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 text-teal-300 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
                              title="Export Shape as .GLB File"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                              <span>Export .GLB</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateGeometry(currentGeom.id)}
                              className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-colors cursor-pointer"
                              title="Duplicate Shape"
                            >
                              <span className="material-symbols-outlined text-xs">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGeometry(currentGeom.id)}
                              className="w-7 h-7 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete Shape"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Procedural Vector-to-3D Geometry Inspector (5 Modes) */}
                        {(() => {
                          const isVectorShape =
                            currentGeom.type === 'vectorExtrude' ||
                            currentGeom.type === 'vectorInflate' ||
                            currentGeom.type === 'vectorRevolve' ||
                            currentGeom.type === 'vectorSweep' ||
                            currentGeom.type === 'vectorCarve' ||
                            Boolean(currentGeom.params?.points);
                          if (!isVectorShape) return null;

                          let currentMode = 'extrude';
                          if (currentGeom.type === 'vectorInflate' || currentGeom.params?.inflateEnabled) currentMode = 'inflate';
                          else if (currentGeom.type === 'vectorRevolve') currentMode = 'revolve';
                          else if (currentGeom.type === 'vectorSweep') currentMode = 'sweep';
                          else if (currentGeom.type === 'vectorCarve') currentMode = 'carve';
                          else if (currentGeom.type === 'vectorExtrude') currentMode = 'extrude';

                          const activeProfileKey = currentGeom.params?.curvatureProfile || currentGeom.params?.profile || 'elliptic';
                          const activeProfile =
                            (Array.isArray(INFLATION_PROFILES)
                              ? INFLATION_PROFILES.find((p) => p.id === activeProfileKey) || INFLATION_PROFILES[0]
                              : INFLATION_PROFILES?.[activeProfileKey]) || {
                              id: 'elliptic',
                              name: 'Elliptic Balloon',
                              icon: 'bubble_chart',
                              description: 'Classic organic puff with vertical boundary tangents and soft central dome'
                            };

                          const modeTitles = {
                            extrude: 'Extrude & Solidify Studio',
                            inflate: 'Organic Inflation Engine',
                            revolve: 'Rotational Lathe Studio',
                            sweep: 'Cross-Section Sweep & Loft',
                            carve: 'Visual Hull Constructive Carve'
                          };

                          const modeBadges = {
                            extrude: 'Solid / Shell',
                            inflate: 'Poisson 3D',
                            revolve: '360° Lathe',
                            sweep: 'Rail Guide',
                            carve: 'Visual Hull'
                          };

                          return (
                            <div className="p-3.5 bg-gradient-to-b from-purple-950/40 via-neutral-900 to-indigo-950/30 border border-purple-500/40 rounded-xl space-y-3.5 shadow-md">
                              {/* Header & Anchor Points Count */}
                              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-base text-purple-400">
                                    {currentMode === 'inflate'
                                      ? 'bubble_chart'
                                      : currentMode === 'revolve'
                                        ? 'rotate_right'
                                        : currentMode === 'sweep'
                                          ? 'timeline'
                                          : currentMode === 'carve'
                                            ? 'interests'
                                            : 'straighten'}
                                  </span>
                                  <div>
                                    <div className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                                      <span>{modeTitles[currentMode]}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                                        {modeBadges[currentMode]}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400">
                                      {currentGeom.params?.points?.length || currentGeom.params?.frontPoints?.length || 0} vector anchor nodes
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVectorGeom(currentGeom);
                                    setVectorPenInitialMode(currentMode);
                                    setVectorPenModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-semibold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="Open in Photoshop-style 2D Pen Studio"
                                >
                                  <span className="material-symbols-outlined text-xs">edit</span>
                                  <span>Edit Pen Path</span>
                                </button>
                              </div>

                              {/* Mode Switcher Pill Tabs (5 Modes) */}
                              <div className="grid grid-cols-5 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                                {[
                                  { id: 'extrude', name: 'Extrude', icon: 'straighten' },
                                  { id: 'inflate', name: 'Inflate', icon: 'bubble_chart' },
                                  { id: 'revolve', name: 'Revolve', icon: 'rotate_right' },
                                  { id: 'sweep', name: 'Sweep', icon: 'timeline' },
                                  { id: 'carve', name: 'Carve', icon: 'interests' }
                                ].map((m) => {
                                  const isSelected = currentMode === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        if (m.id === 'extrude') {
                                          handleUpdateGeometry(currentGeom.id, {
                                            type: 'vectorExtrude',
                                            params: {
                                              ...(currentGeom.params || {}),
                                              inflateEnabled: false,
                                              depth: currentGeom.params?.depth ?? 0.25,
                                              taper: currentGeom.params?.taper ?? 1.0,
                                              twist: currentGeom.params?.twist ?? 0,
                                              shellEnabled: Boolean(currentGeom.params?.shellEnabled),
                                              shellThickness: currentGeom.params?.shellThickness ?? 0.04,
                                              bevelEnabled: currentGeom.params?.bevelEnabled !== false,
                                              bevelThickness: currentGeom.params?.bevelThickness ?? 0.03,
                                              bevelSize: currentGeom.params?.bevelSize ?? 0.02,
                                              bevelSegments: currentGeom.params?.bevelSegments ?? 3,
                                              curveSegments: currentGeom.params?.curveSegments ?? 24
                                            }
                                          });
                                        } else if (m.id === 'inflate') {
                                          handleUpdateGeometry(currentGeom.id, {
                                            type: 'vectorInflate',
                                            params: {
                                              ...(currentGeom.params || {}),
                                              inflateEnabled: true,
                                              depth: currentGeom.params?.depth ?? 0.35,
                                              depthFront: currentGeom.params?.depthFront ?? currentGeom.params?.depth ?? 0.35,
                                              depthBack: currentGeom.params?.depthBack ?? 0.35,
                                              curvatureProfile: currentGeom.params?.curvatureProfile || 'elliptic',
                                              symmetric: currentGeom.params?.symmetric !== false,
                                              smoothPasses: currentGeom.params?.smoothPasses ?? 2,
                                              resolution: currentGeom.params?.resolution ?? 24,
                                              rimDepth: currentGeom.params?.rimDepth ?? 0.0,
                                              connectEdges: currentGeom.params?.connectEdges !== false
                                            }
                                          });
                                        } else if (m.id === 'revolve') {
                                          handleUpdateGeometry(currentGeom.id, {
                                            type: 'vectorRevolve',
                                            params: {
                                              ...(currentGeom.params || {}),
                                              revolveAngle: currentGeom.params?.revolveAngle ?? 360,
                                              revolveAxis: currentGeom.params?.revolveAxis || 'Y',
                                              revolveSegments: currentGeom.params?.revolveSegments ?? 32,
                                              axisOffset: currentGeom.params?.axisOffset ?? 0.0,
                                              capEnds: currentGeom.params?.capEnds !== false,
                                              curveSegments: currentGeom.params?.curveSegments ?? 32
                                            }
                                          });
                                        } else if (m.id === 'sweep') {
                                          handleUpdateGeometry(currentGeom.id, {
                                            type: 'vectorSweep',
                                            params: {
                                              ...(currentGeom.params || {}),
                                              spineType: currentGeom.params?.spineType || 'arc',
                                              spineLength: currentGeom.params?.spineLength ?? 1.2,
                                              spineCurvature: currentGeom.params?.spineCurvature ?? 0.5,
                                              spineTwist: currentGeom.params?.spineTwist ?? 0,
                                              scaleStart: currentGeom.params?.scaleStart ?? 1.0,
                                              scaleEnd: currentGeom.params?.scaleEnd ?? 0.5,
                                              scaleProfile: currentGeom.params?.scaleProfile || 'linear',
                                              capEnds: currentGeom.params?.capEnds !== false
                                            }
                                          });
                                        } else if (m.id === 'carve') {
                                          handleUpdateGeometry(currentGeom.id, {
                                            type: 'vectorCarve',
                                            params: {
                                              ...(currentGeom.params || {}),
                                              carveView: currentGeom.params?.carveView || 'top',
                                              carveResolution: currentGeom.params?.carveResolution ?? 32,
                                              carveSmooth: currentGeom.params?.carveSmooth ?? 2,
                                              frontPoints: currentGeom.params?.frontPoints || currentGeom.params?.points,
                                              topSidePoints: currentGeom.params?.topSidePoints || currentGeom.params?.points
                                            }
                                          });
                                        }
                                      }}
                                      className={`py-1.5 px-0.5 rounded-md text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${isSelected
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                                        }`}
                                      title={m.name}
                                    >
                                      <span className="material-symbols-outlined text-sm">{m.icon}</span>
                                      <span className="truncate">{m.name}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* MODE 1: Extrude & Solidify Modifier Controls */}
                              {currentMode === 'extrude' && (
                                <div className="space-y-3 pt-1">
                                  <NumberSliderInput
                                    label="Extrude Depth"
                                    value={currentGeom.params?.depth ?? 0.25}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'depth', val)}
                                    min={0.02}
                                    max={2.0}
                                    step={0.02}
                                    unit="m"
                                    color="purple"
                                  />

                                  <NumberSliderInput
                                    label="Directional Taper"
                                    value={currentGeom.params?.taper ?? 1.0}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'taper', val)}
                                    min={0.1}
                                    max={2.5}
                                    step={0.05}
                                    color="indigo"
                                    description="Scale factor across extrusion (1.0 = straight, <1 = taper, >1 = flare)"
                                  />

                                  <NumberSliderInput
                                    label="Extrusion Twist"
                                    value={currentGeom.params?.twist ?? 0}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'twist', val)}
                                    min={-180}
                                    max={180}
                                    step={5}
                                    unit="°"
                                    color="purple"
                                  />

                                  {/* Solidify / Shell Modifier Toggle */}
                                  <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800 space-y-2">
                                    <label className="flex items-center justify-between cursor-pointer">
                                      <div className="space-y-0.5">
                                        <span className="text-xs font-semibold text-neutral-200 block">
                                          Solidify / Shell Modifier
                                        </span>
                                        <span className="text-[10px] text-neutral-400 block">
                                          Hollows interior geometry with solid perimeter rim
                                        </span>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(currentGeom.params?.shellEnabled)}
                                        onChange={(e) => handleUpdateGeometryParam(currentGeom.id, 'shellEnabled', e.target.checked)}
                                        className="rounded text-purple-500 focus:ring-purple-400 w-4 h-4"
                                      />
                                    </label>
                                    {Boolean(currentGeom.params?.shellEnabled) && (
                                      <div className="pt-1 border-t border-neutral-800">
                                        <NumberSliderInput
                                          label="Shell Wall Thickness"
                                          value={currentGeom.params?.shellThickness ?? 0.04}
                                          onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'shellThickness', val)}
                                          min={0.01}
                                          max={0.15}
                                          step={0.005}
                                          unit="m"
                                          color="purple"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Bevel Settings */}
                                  <label className="flex items-center gap-2 p-2 rounded bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 cursor-pointer hover:bg-neutral-900">
                                    <input
                                      type="checkbox"
                                      checked={currentGeom.params?.bevelEnabled !== false}
                                      onChange={(e) => handleUpdateGeometryParam(currentGeom.id, 'bevelEnabled', e.target.checked)}
                                      className="rounded text-purple-500 focus:ring-purple-400"
                                    />
                                    <span>Chamfer Beveling</span>
                                  </label>

                                  {currentGeom.params?.bevelEnabled !== false && (
                                    <div className="space-y-2 pl-2 border-l-2 border-purple-500/30">
                                      <NumberSliderInput
                                        label="Bevel Thickness"
                                        value={currentGeom.params?.bevelThickness ?? 0.03}
                                        onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'bevelThickness', val)}
                                        min={0.0}
                                        max={0.2}
                                        step={0.01}
                                        unit="m"
                                        color="purple"
                                      />
                                      <NumberSliderInput
                                        label="Bevel Size"
                                        value={currentGeom.params?.bevelSize ?? 0.02}
                                        onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'bevelSize', val)}
                                        min={0.0}
                                        max={0.2}
                                        step={0.01}
                                        unit="m"
                                        color="purple"
                                      />
                                      <NumberSliderInput
                                        label="Bevel Segments"
                                        value={currentGeom.params?.bevelSegments ?? 3}
                                        onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'bevelSegments', val)}
                                        min={1}
                                        max={8}
                                        step={1}
                                        color="purple"
                                      />
                                    </div>
                                  )}

                                  <NumberSliderInput
                                    label="Curve Smoothness"
                                    value={currentGeom.params?.curveSegments ?? 24}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'curveSegments', val)}
                                    min={6}
                                    max={48}
                                    step={2}
                                    color="indigo"
                                  />
                                </div>
                              )}

                              {/* MODE 2: Curvature & Volumetric Inflation Controls */}
                              {currentMode === 'inflate' && (
                                <div className="space-y-3 pt-1">
                                  {/* Curvature Profiles Selector */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                                        Curvature Profile
                                      </span>
                                      <span className="text-[10px] text-teal-400 font-mono">
                                        {activeProfile?.name || 'Elliptic Balloon'}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1">
                                      {(Array.isArray(INFLATION_PROFILES) ? INFLATION_PROFILES : []).map((prof) => {
                                        const isSelected = activeProfileKey === prof.id;
                                        return (
                                          <button
                                            key={prof.id}
                                            type="button"
                                            onClick={() => handleUpdateGeometryParam(currentGeom.id, 'curvatureProfile', prof.id)}
                                            className={`p-1.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${isSelected
                                              ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-sm'
                                              : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                                              }`}
                                            title={`${prof.name}: ${prof.description}`}
                                          >
                                            <span className="material-symbols-outlined text-base">{prof.icon}</span>
                                            <span className="text-[9px] font-medium truncate max-w-full">{prof.name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <p className="text-[10px] text-neutral-400 italic bg-neutral-950/50 p-1.5 rounded border border-neutral-800/60">
                                      {activeProfile?.description || ''}
                                    </p>
                                  </div>

                                  {/* Inflation Depth Slider */}
                                  <NumberSliderInput
                                    label="Volumetric Thickness (Front)"
                                    value={currentGeom.params?.depthFront ?? currentGeom.params?.depth ?? 0.35}
                                    onChange={(val) => {
                                      handleUpdateGeometryParam(currentGeom.id, 'depth', val);
                                      handleUpdateGeometryParam(currentGeom.id, 'depthFront', val);
                                    }}
                                    min={0.02}
                                    max={2.0}
                                    step={0.02}
                                    unit="m"
                                    color="teal"
                                    description="Maximum balloon elevation at distance field centroid"
                                  />

                                  {/* Asymmetric Back Depth Slider when not symmetric */}
                                  {currentGeom.params?.symmetric === false && (
                                    <NumberSliderInput
                                      label="Rear Volumetric Depth (Back)"
                                      value={currentGeom.params?.depthBack ?? 0.35}
                                      onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'depthBack', val)}
                                      min={0.0}
                                      max={2.0}
                                      step={0.02}
                                      unit="m"
                                      color="purple"
                                    />
                                  )}

                                  {/* Laplacian Curvature Smoothing */}
                                  <NumberSliderInput
                                    label="Laplacian Curvature Smoothing"
                                    value={currentGeom.params?.smoothPasses ?? 2}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'smoothPasses', val)}
                                    min={0}
                                    max={6}
                                    step={1}
                                    color="emerald"
                                    description="Relaxes interior mesh heights to eliminate crease ridges while preserving boundary"
                                  />

                                  {/* Steiner Mesh Resolution */}
                                  <NumberSliderInput
                                    label="Steiner Grid Density"
                                    value={currentGeom.params?.resolution ?? 24}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'resolution', val)}
                                    min={12}
                                    max={48}
                                    step={2}
                                    color="sky"
                                    description="Delaunay triangulation density for smooth continuous curvature"
                                  />

                                  {/* Rim Wall Depth */}
                                  <NumberSliderInput
                                    label="Rim Wall Depth"
                                    value={currentGeom.params?.rimDepth ?? 0}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'rimDepth', val)}
                                    min={0.0}
                                    max={0.5}
                                    step={0.02}
                                    unit="m"
                                    color="indigo"
                                    description="Straight cylindrical wall height before curvature ballooning starts"
                                  />

                                  {/* Dual-Sided Manifold Toggle */}
                                  <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-semibold text-neutral-200 block">
                                        Dual-Sided Manifold (Symmetric)
                                      </span>
                                      <span className="text-[10px] text-neutral-400 block">
                                        {currentGeom.params?.symmetric !== false
                                          ? 'Balloons front and back, welded seamlessly at boundary'
                                          : 'Single-sided curved dome with flat back plate'}
                                      </span>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={currentGeom.params?.symmetric !== false}
                                      onChange={(e) => handleUpdateGeometryParam(currentGeom.id, 'symmetric', e.target.checked)}
                                      className="rounded text-teal-500 focus:ring-teal-400 w-4 h-4"
                                    />
                                  </label>

                                  {/* Connect All Edges (Watertight Seal) Toggle */}
                                  <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-semibold text-neutral-200 block">
                                        Connect All Edges (Watertight Seal)
                                      </span>
                                      <span className="text-[10px] text-neutral-400 block">
                                        {currentGeom.params?.connectEdges !== false
                                          ? 'Seamlessly stitches and welds all perimeter edges to eliminate non-mesh gaps'
                                          : 'Leaves front and back shells unstitched at perimeter'}
                                      </span>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={currentGeom.params?.connectEdges !== false}
                                      onChange={(e) => handleUpdateGeometryParam(currentGeom.id, 'connectEdges', e.target.checked)}
                                      className="rounded text-teal-500 focus:ring-teal-400 w-4 h-4"
                                    />
                                  </label>
                                </div>
                              )}

                              {/* MODE 3: Revolve (Lathe) Controls */}
                              {currentMode === 'revolve' && (
                                <div className="space-y-3 pt-1">
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 font-medium">Revolution Axis</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {['Y', 'X'].map((axis) => (
                                        <button
                                          key={axis}
                                          type="button"
                                          onClick={() => handleUpdateGeometryParam(currentGeom.id, 'revolveAxis', axis)}
                                          className={`py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${(currentGeom.params?.revolveAxis || 'Y') === axis
                                            ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                            }`}
                                        >
                                          {axis === 'Y' ? 'Vertical (Y)' : 'Horizontal (X)'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <NumberSliderInput
                                    label="Revolution Angle"
                                    value={currentGeom.params?.revolveAngle ?? 360}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'revolveAngle', val)}
                                    min={15}
                                    max={360}
                                    step={15}
                                    unit="°"
                                    color="sky"
                                  />

                                  <NumberSliderInput
                                    label="Radial Segments"
                                    value={currentGeom.params?.revolveSegments ?? 32}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'revolveSegments', val)}
                                    min={12}
                                    max={64}
                                    step={2}
                                    color="purple"
                                  />

                                  <NumberSliderInput
                                    label="Axis Radial Offset (Hole Size)"
                                    value={currentGeom.params?.axisOffset ?? 0.0}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'axisOffset', val)}
                                    min={-0.2}
                                    max={0.8}
                                    step={0.02}
                                    unit="m"
                                    color="indigo"
                                  />

                                  <label className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800 cursor-pointer hover:bg-neutral-900">
                                    <span className="text-xs font-semibold text-neutral-200">Cap Planar Ends</span>
                                    <input
                                      type="checkbox"
                                      checked={currentGeom.params?.capEnds !== false}
                                      onChange={(e) => handleUpdateGeometryParam(currentGeom.id, 'capEnds', e.target.checked)}
                                      className="rounded text-sky-500 focus:ring-sky-400 w-4 h-4"
                                    />
                                  </label>
                                </div>
                              )}

                              {/* MODE 4: Sweep & Loft Controls */}
                              {currentMode === 'sweep' && (
                                <div className="space-y-3 pt-1">
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 font-medium">Guide Spine Curve</span>
                                    <div className="grid grid-cols-5 gap-1">
                                      {['arc', 's-curve', 'helix', 'wave', 'linear'].map((sp) => (
                                        <button
                                          key={sp}
                                          type="button"
                                          onClick={() => handleUpdateGeometryParam(currentGeom.id, 'spineType', sp)}
                                          className={`py-1 rounded text-[10px] font-bold border capitalize transition-all cursor-pointer ${(currentGeom.params?.spineType || 'arc') === sp
                                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                            }`}
                                        >
                                          {sp}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <NumberSliderInput
                                    label="Spine Length"
                                    value={currentGeom.params?.spineLength ?? 1.2}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'spineLength', val)}
                                    min={0.3}
                                    max={3.0}
                                    step={0.1}
                                    unit="m"
                                    color="indigo"
                                  />

                                  <NumberSliderInput
                                    label="Spine Curvature"
                                    value={currentGeom.params?.spineCurvature ?? 0.5}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'spineCurvature', val)}
                                    min={0.0}
                                    max={2.0}
                                    step={0.05}
                                    color="purple"
                                  />

                                  <NumberSliderInput
                                    label="Spine Twist"
                                    value={currentGeom.params?.spineTwist ?? 0}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'spineTwist', val)}
                                    min={-360}
                                    max={360}
                                    step={15}
                                    unit="°"
                                    color="teal"
                                  />

                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 font-medium">Scale Falloff</span>
                                    <div className="grid grid-cols-4 gap-1">
                                      {['linear', 'bell', 'pinch', 'flare'].map((p) => (
                                        <button
                                          key={p}
                                          type="button"
                                          onClick={() => handleUpdateGeometryParam(currentGeom.id, 'scaleProfile', p)}
                                          className={`py-1 rounded text-[10px] font-bold border capitalize transition-all cursor-pointer ${(currentGeom.params?.scaleProfile || 'linear') === p
                                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                            }`}
                                        >
                                          {p}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <NumberSliderInput
                                      label="Start Scale"
                                      value={currentGeom.params?.scaleStart ?? 1.0}
                                      onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'scaleStart', val)}
                                      min={0.1}
                                      max={2.5}
                                      step={0.05}
                                      color="indigo"
                                    />
                                    <NumberSliderInput
                                      label="End Scale"
                                      value={currentGeom.params?.scaleEnd ?? 0.5}
                                      onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'scaleEnd', val)}
                                      min={0.1}
                                      max={2.5}
                                      step={0.05}
                                      color="purple"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* MODE 5: Silhouette Carve Controls */}
                              {currentMode === 'carve' && (
                                <div className="space-y-3 pt-1">
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 font-medium">Orthogonal View Axis</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {['top', 'side'].map((vw) => (
                                        <button
                                          key={vw}
                                          type="button"
                                          onClick={() => handleUpdateGeometryParam(currentGeom.id, 'carveView', vw)}
                                          className={`py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${(currentGeom.params?.carveView || 'top') === vw
                                            ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                            }`}
                                        >
                                          {vw === 'top' ? 'Top (XZ)' : 'Side (YZ)'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <NumberSliderInput
                                    label="Marching Cubes Resolution"
                                    value={currentGeom.params?.carveResolution ?? 32}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'carveResolution', val)}
                                    min={16}
                                    max={48}
                                    step={4}
                                    color="amber"
                                  />

                                  <NumberSliderInput
                                    label="Isosurface Smoothing"
                                    value={currentGeom.params?.carveSmooth ?? 2}
                                    onChange={(val) => handleUpdateGeometryParam(currentGeom.id, 'carveSmooth', val)}
                                    min={0}
                                    max={4}
                                    step={1}
                                    color="purple"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Material Presets Quick Select */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                            Material Presets
                          </span>
                          <div className="grid grid-cols-5 gap-1">
                            {MATERIAL_PRESETS.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleApplyGeometryPreset(currentGeom.id, p.id)}
                                className={`px-1.5 py-1 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${currentGeom.preset === p.id
                                  ? 'bg-teal-500/20 border-teal-400 text-teal-300 font-bold'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                                  }`}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Texture & Material Mapping */}
                        <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-teal-400">texture</span>
                              <span className="text-xs font-bold text-neutral-200">Texture & Surface Map</span>
                            </div>
                            {currentGeom.textureUrl ? (
                              <span className="text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold">
                                UV Mapped
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500 font-medium">
                                Solid Material
                              </span>
                            )}
                          </div>

                          {/* Hidden File Input */}
                          <input
                            type="file"
                            ref={shapeTextureInputRef}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleShapeTextureUpload(currentGeom.id, file);
                              e.target.value = '';
                            }}
                            accept="image/*"
                            className="hidden"
                          />

                          {!currentGeom.textureUrl ? (
                            <div className="space-y-2.5">
                              {/* Drag & Drop Import Box */}
                              <div
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const file = e.dataTransfer.files?.[0];
                                  if (file && file.type.startsWith('image/')) {
                                    handleShapeTextureUpload(currentGeom.id, file);
                                  }
                                }}
                                onClick={() => shapeTextureInputRef.current?.click()}
                                className="border border-dashed border-teal-500/40 hover:border-teal-400 bg-neutral-900/60 hover:bg-teal-950/20 rounded-xl p-3.5 text-center cursor-pointer transition-all group flex flex-col items-center justify-center gap-2"
                              >
                                <div className="w-9 h-9 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 text-teal-400 flex items-center justify-center transition-all shadow-inner">
                                  {shapeTextureUploadingId === currentGeom.id ? (
                                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-neutral-200 group-hover:text-teal-300 block">
                                    {shapeTextureUploadingId === currentGeom.id ? 'Importing Texture...' : 'Import Image Texture'}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                                    Click or drag PNG, JPG, WEBP, or SVG to map onto this 3D shape
                                  </span>
                                </div>
                              </div>

                              {/* Quick Built-in Pattern Presets */}
                              <div className="space-y-1">
                                <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider block">
                                  Quick Test Patterns
                                </span>
                                <div className="grid grid-cols-4 gap-1">
                                  {SHAPE_TEXTURE_SAMPLES.map((sample) => (
                                    <button
                                      key={sample.id}
                                      type="button"
                                      onClick={() => handleApplyShapeTexturePreset(currentGeom.id, sample)}
                                      className="px-1.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 truncate"
                                      title={`Apply ${sample.name} pattern`}
                                    >
                                      <span className="material-symbols-outlined text-xs text-teal-400">grid_on</span>
                                      <span className="truncate">{sample.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Active Texture Info & Actions */}
                              <div className="flex items-center gap-2.5 p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                                <div
                                  className="w-12 h-12 rounded-lg border border-neutral-700 overflow-hidden bg-neutral-950 shrink-0 relative flex items-center justify-center"
                                  style={{
                                    backgroundImage:
                                      'linear-gradient(45deg, #262626 25%, transparent 25%), linear-gradient(-45deg, #262626 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262626 75%), linear-gradient(-45deg, transparent 75%, #262626 75%)',
                                    backgroundSize: '10px 10px',
                                    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                                  }}
                                >
                                  <img
                                    src={currentGeom.textureUrl}
                                    alt="Texture Preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="text-xs font-semibold text-neutral-200 truncate">
                                    {currentGeom.textureFileName || 'Custom Texture Map'}
                                  </div>
                                  <div className="text-[10px] text-teal-400 flex items-center gap-1 font-mono">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    <span>UV mapped to mesh</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => shapeTextureInputRef.current?.click()}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                    title="Replace Image Texture"
                                  >
                                    <span className="material-symbols-outlined text-xs">sync</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveShapeTexture(currentGeom.id)}
                                    className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
                                    title="Remove Texture Map"
                                  >
                                    <span className="material-symbols-outlined text-xs">delete</span>
                                  </button>
                                </div>
                              </div>

                              {/* Tiling (Repeat) */}
                              <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                    Tiling (Repeat)
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4].map((rep) => (
                                      <button
                                        key={rep}
                                        type="button"
                                        onClick={() =>
                                          handleUpdateGeometry(currentGeom.id, {
                                            textureRepeatX: rep,
                                            textureRepeatY: rep
                                          })
                                        }
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                                          (currentGeom.textureRepeatX ?? 1) === rep && (currentGeom.textureRepeatY ?? 1) === rep
                                            ? 'bg-teal-500 text-white shadow-sm'
                                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400'
                                        }`}
                                      >
                                        {rep}x
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <NumberSliderInput
                                    label="Repeat X"
                                    value={currentGeom.textureRepeatX ?? 1.0}
                                    onChange={(val) => handleUpdateGeometry(currentGeom.id, { textureRepeatX: val })}
                                    min={0.1}
                                    max={8.0}
                                    step={0.1}
                                    color="teal"
                                  />
                                  <NumberSliderInput
                                    label="Repeat Y"
                                    value={currentGeom.textureRepeatY ?? 1.0}
                                    onChange={(val) => handleUpdateGeometry(currentGeom.id, { textureRepeatY: val })}
                                    min={0.1}
                                    max={8.0}
                                    step={0.1}
                                    color="teal"
                                  />
                                </div>
                              </div>

                              {/* UV Offset & Rotation */}
                              <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                    UV Offset & Rotation
                                  </span>
                                  {((currentGeom.textureOffsetX ?? 0) !== 0 ||
                                    (currentGeom.textureOffsetY ?? 0) !== 0 ||
                                    (currentGeom.textureRotation ?? 0) !== 0 ||
                                    currentGeom.textureFlipX ||
                                    currentGeom.textureFlipY) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateGeometry(currentGeom.id, {
                                          textureOffsetX: 0,
                                          textureOffsetY: 0,
                                          textureRotation: 0,
                                          textureFlipX: false,
                                          textureFlipY: false
                                        })
                                      }
                                      className="text-[10px] text-teal-400 hover:underline cursor-pointer"
                                    >
                                      Reset UVs
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <NumberSliderInput
                                    label="Offset X"
                                    value={currentGeom.textureOffsetX ?? 0.0}
                                    onChange={(val) => handleUpdateGeometry(currentGeom.id, { textureOffsetX: val })}
                                    min={-1.0}
                                    max={1.0}
                                    step={0.05}
                                    color="indigo"
                                  />
                                  <NumberSliderInput
                                    label="Offset Y"
                                    value={currentGeom.textureOffsetY ?? 0.0}
                                    onChange={(val) => handleUpdateGeometry(currentGeom.id, { textureOffsetY: val })}
                                    min={-1.0}
                                    max={1.0}
                                    step={0.05}
                                    color="indigo"
                                  />
                                </div>

                                <NumberSliderInput
                                  label="Texture Rotation"
                                  value={currentGeom.textureRotation ?? 0}
                                  onChange={(val) => handleUpdateGeometry(currentGeom.id, { textureRotation: val })}
                                  min={0}
                                  max={360}
                                  step={5}
                                  unit="°"
                                  color="purple"
                                />

                                {/* Flip UVs Horizontally / Vertically */}
                                <div className="grid grid-cols-2 gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateGeometry(currentGeom.id, {
                                        textureFlipX: !currentGeom.textureFlipX
                                      })
                                    }
                                    className={`py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                      currentGeom.textureFlipX
                                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">flip</span>
                                    <span>Flip X</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateGeometry(currentGeom.id, {
                                        textureFlipY: !currentGeom.textureFlipY
                                      })
                                    }
                                    className={`py-1 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                      currentGeom.textureFlipY
                                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">swap_vertical_circle</span>
                                    <span>Flip Y</span>
                                  </button>
                                </div>
                              </div>

                              {/* Surface Opacity Slider */}
                              <div className="space-y-1 pt-1 border-t border-neutral-800/80">
                                <NumberSliderInput
                                  label="Texture Opacity"
                                  value={currentGeom.opacity ?? 1.0}
                                  onChange={(val) =>
                                    handleUpdateGeometry(currentGeom.id, {
                                      opacity: val,
                                      transparent: val < 1.0
                                    })
                                  }
                                  min={0.0}
                                  max={1.0}
                                  step={0.05}
                                  color="sky"
                                  description="Controls surface transparency (PNG alpha is auto-supported)"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Color Picker & Swatches */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-neutral-300 block">
                                {currentGeom.textureUrl ? 'Surface Tint Color' : 'Surface Color'}
                              </span>
                              {currentGeom.textureUrl && (
                                <span className="text-[10px] text-neutral-400 block">
                                  White (#FFFFFF) preserves original image colors
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-neutral-400">{currentGeom.color}</span>
                              <input
                                type="color"
                                value={currentGeom.color || '#38bdf8'}
                                onChange={(e) => handleUpdateGeometry(currentGeom.id, { color: e.target.value })}
                                className="w-8 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {COLOR_SWATCHES.map((swatch) => {
                              const hexVal = typeof swatch === 'string' ? swatch : swatch.hex;
                              const nameVal = typeof swatch === 'string' ? swatch : swatch.name;
                              const isSelected = String(currentGeom.color || '').toLowerCase() === String(hexVal || '').toLowerCase();
                              return (
                                <button
                                  key={hexVal}
                                  type="button"
                                  onClick={() => handleUpdateGeometry(currentGeom.id, { color: hexVal })}
                                  style={{ backgroundColor: hexVal }}
                                  className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${isSelected
                                    ? 'scale-125 border-white ring-2 ring-teal-400 shadow-md'
                                    : 'border-white/20 hover:scale-110'
                                    }`}
                                  title={nameVal}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* PBR Surface Properties */}
                        <div className="space-y-2.5 pt-1">
                          <NumberSliderInput
                            label="Roughness"
                            value={currentGeom.roughness ?? 0.35}
                            onChange={(val) => handleUpdateGeometry(currentGeom.id, { roughness: val })}
                            min={0.0}
                            max={1.0}
                            step={0.05}
                            color="teal"
                            description="0 = Mirror Gloss, 1 = Matte Chalk"
                          />
                          <NumberSliderInput
                            label="Metalness"
                            value={currentGeom.metalness ?? 0.15}
                            onChange={(val) => handleUpdateGeometry(currentGeom.id, { metalness: val })}
                            min={0.0}
                            max={1.0}
                            step={0.05}
                            color="indigo"
                            description="0 = Dielectric plastic/wood, 1 = Metallic chrome"
                          />
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <label className="flex items-center gap-2 p-2 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 cursor-pointer hover:bg-neutral-800/80">
                              <input
                                type="checkbox"
                                checked={Boolean(currentGeom.wireframe)}
                                onChange={(e) => handleUpdateGeometry(currentGeom.id, { wireframe: e.target.checked })}
                                className="rounded text-teal-500 focus:ring-teal-400"
                              />
                              <span>Wireframe Mode</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 cursor-pointer hover:bg-neutral-800/80">
                              <input
                                type="checkbox"
                                checked={Boolean(currentGeom.flatShading)}
                                onChange={(e) => handleUpdateGeometry(currentGeom.id, { flatShading: e.target.checked })}
                                className="rounded text-teal-500 focus:ring-teal-400"
                              />
                              <span>Flat Shading (Faceted)</span>
                            </label>
                          </div>
                        </div>

                        {/* Continuous Spin Animation */}
                        <div className="space-y-2 pt-2 border-t border-neutral-800">
                          <NumberSliderInput
                            label="Auto-Rotation Speed (Spin)"
                            value={currentGeom.rotationSpeed ?? 0}
                            onChange={(val) => handleUpdateGeometry(currentGeom.id, { rotationSpeed: val })}
                            min={-4.0}
                            max={4.0}
                            step={0.1}
                            unit="rad/s"
                            color="sky"
                            description="Continuous Y-axis turntable spin in AR (0 = static)"
                          />
                        </div>

                        {/* Transform: Position, Rotation, Scale */}
                        <div className="space-y-3 pt-2 border-t border-neutral-800">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                            World Transform & Placement
                          </span>
                          <div className="space-y-2">
                            <NumberSliderInput
                              label="Position X (Lateral)"
                              value={currentGeom.posX ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { posX: val })}
                              min={-5.0}
                              max={5.0}
                              step={0.05}
                              unit="m"
                              color="indigo"
                            />
                            <NumberSliderInput
                              label="Position Y (Elevation)"
                              value={currentGeom.posY ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { posY: val })}
                              min={-5.0}
                              max={5.0}
                              step={0.05}
                              unit="m"
                              color="indigo"
                            />
                            <NumberSliderInput
                              label="Position Z (Depth)"
                              value={currentGeom.posZ ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { posZ: val })}
                              min={-5.0}
                              max={5.0}
                              step={0.05}
                              unit="m"
                              color="indigo"
                            />
                          </div>

                          <div className="space-y-2 pt-1">
                            <NumberSliderInput
                              label="Rotation X (Pitch)"
                              value={currentGeom.rotX ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { rotX: val })}
                              min={-180}
                              max={180}
                              step={1}
                              unit="°"
                              color="purple"
                            />
                            <NumberSliderInput
                              label="Rotation Y (Yaw)"
                              value={currentGeom.rotY ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { rotY: val })}
                              min={-180}
                              max={180}
                              step={1}
                              unit="°"
                              color="purple"
                            />
                            <NumberSliderInput
                              label="Rotation Z (Roll)"
                              value={currentGeom.rotZ ?? 0}
                              onChange={(val) => handleUpdateGeometry(currentGeom.id, { rotZ: val })}
                              min={-180}
                              max={180}
                              step={1}
                              unit="°"
                              color="purple"
                            />
                          </div>

                          <div className="space-y-2 pt-1">
                            <NumberSliderInput
                              label="Uniform Scale"
                              value={currentGeom.scale ?? 1}
                              onChange={(val) =>
                                handleUpdateGeometry(currentGeom.id, {
                                  scale: val,
                                  scaleX: val,
                                  scaleY: val,
                                  scaleZ: val
                                })
                              }
                              min={0.05}
                              max={5.0}
                              step={0.05}
                              color="emerald"
                            />
                          </div>
                        </div>

                        {/* Primitive-Specific Shape Dimensions (for standard 3D primitives) */}
                        {def && def.paramConfigs && !['vectorExtrude', 'vectorInflate'].includes(currentGeom.type) && !currentGeom.params?.points && (
                          <div className="space-y-2.5 pt-2 border-t border-neutral-800">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                              {def.name} Geometry Dimensions
                            </span>
                            {def.paramConfigs.map((cfg) => {
                              const currentVal =
                                currentGeom.params && currentGeom.params[cfg.key] !== undefined
                                  ? currentGeom.params[cfg.key]
                                  : def.defaultParams[cfg.key];
                              return (
                                <NumberSliderInput
                                  key={cfg.key}
                                  label={cfg.label}
                                  value={currentVal}
                                  onChange={(val) => handleUpdateGeometryParam(currentGeom.id, cfg.key, val)}
                                  min={cfg.min}
                                  max={cfg.max}
                                  step={cfg.step}
                                  unit={cfg.unit || ''}
                                  color="amber"
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Dedicated Save Geometries Button */}
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <button
                      type="button"
                      disabled={savingConfig || (!editingTemplate && !batchId.trim())}
                      onClick={editingTemplate ? handleSaveTemplate : handleSaveConfig}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 via-sky-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-teal-500/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">{editingTemplate ? 'cloud_upload' : 'save'}</span>
                      <span>
                        {savingConfig
                          ? (editingTemplate ? 'Saving Changes to Template...' : 'Saving Geometries Configuration...')
                          : (editingTemplate
                              ? `Save Shapes to Template (${editingTemplate.cleanName || editingTemplate.name})`
                              : `Save Shapes to Batch (${batchId || 'Active'})`)}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: 3D EXTRUDED TYPOGRAPHY TEXT                                          */}
          {/* ========================================================================= */}
          {activeTab === 'text3d' && (
            <div className="space-y-4">
              {/* Header & Add Button */}
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-pink-400 text-base">title</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                      3D Typography ({custom3DTexts.length})
                    </h2>
                    <p className="text-[10px] text-neutral-400">
                      Extruded 3D WebGL text with custom fonts, bevels, & lighting shaders.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddTextModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-xs">add</span>
                  Add 3D Text
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-950/60 p-1.5 rounded-xl border border-neutral-800/80">
                <button
                  type="button"
                  onClick={() =>
                    handleAdd3DText({
                      text: 'STAR weAR',
                      fontFamily: 'helvetiker_bold',
                      color: '#38bdf8',
                      emissive: '#0284c7',
                      emissiveIntensity: 0.6,
                      metalness: 0.8,
                      roughness: 0.2
                    })
                  }
                  className="p-1.5 rounded bg-neutral-900 hover:bg-pink-950/50 border border-neutral-800 hover:border-pink-500/50 text-[11px] font-semibold text-neutral-300 hover:text-pink-300 text-center transition-all truncate"
                >
                  + Cyber Neon
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAdd3DText({
                      text: '24K GOLD',
                      fontFamily: 'optimer_bold',
                      color: '#f59e0b',
                      emissive: '#78350f',
                      emissiveIntensity: 0.3,
                      metalness: 0.95,
                      roughness: 0.15
                    })
                  }
                  className="p-1.5 rounded bg-neutral-900 hover:bg-amber-950/50 border border-neutral-800 hover:border-amber-500/50 text-[11px] font-semibold text-neutral-300 hover:text-amber-300 text-center transition-all truncate"
                >
                  + 24K Gold Title
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAdd3DText({
                      text: 'LIMITED EDITION',
                      fontFamily: 'gentilis_bold',
                      color: '#f8fafc',
                      emissive: '#000000',
                      emissiveIntensity: 0.0,
                      metalness: 0.3,
                      roughness: 0.3,
                      size: 0.25,
                      depth: 0.05
                    })
                  }
                  className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-[11px] font-semibold text-neutral-300 hover:text-white text-center transition-all truncate"
                >
                  + Clean Label
                </button>
              </div>

              {/* 3D Texts List */}
              {custom3DTexts.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-neutral-950/50 border border-neutral-800/80 space-y-2">
                  <span className="material-symbols-outlined text-2xl text-pink-400">text_fields</span>
                  <p className="text-xs font-semibold text-neutral-300">No 3D text in this scene yet</p>
                  <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                    Click '+ Add 3D Text' to insert extruded 3D typography into your scene or directly on your target marker.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-0.5">
                    Scene 3D Text Layers ({custom3DTexts.length})
                  </span>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {custom3DTexts.map((textItem) => {
                      const isSelected = selectedText3DId === textItem.id && selectedTargetType === 'text3d';
                      const isMultiSelected = selectedObjects.some((it) => it.type === 'text3d' && it.id === textItem.id);
                      const textGroup = sceneGroups.find((g) => g.itemIds.some((it) => it.type === 'text3d' && it.id === textItem.id));
                      return (
                        <div
                          key={textItem.id}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                              toggleObjectSelection('text3d', textItem.id);
                            } else {
                              selectSceneObject('text3d', textItem.id);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${isSelected
                            ? 'bg-pink-950/40 border-pink-500/60 text-white shadow-sm'
                            : isMultiSelected
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                              : 'bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isMultiSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleObjectSelection('text3d', textItem.id);
                              }}
                              className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                              title="Toggle selection for multi-object editing or grouping"
                            />
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-black/40"
                              style={{ backgroundColor: textItem.color || '#38bdf8' }}
                            ></span>
                            <span className="font-semibold truncate max-w-[140px]">
                              {textItem.text || '3D Text'}
                            </span>
                            {isMultiSelected && !isSelected && (
                              <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                MULTI
                              </span>
                            )}
                            {textGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectGroup(textGroup.id);
                                }}
                                className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                title={`Part of group "${textGroup.name}". Click to select group.`}
                              >
                                <span className="material-symbols-outlined text-[10px]">folder</span>
                                {textGroup.name}
                              </button>
                            )}
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-neutral-400 border border-neutral-800 shrink-0">
                              {(textItem.fontFamily || 'helvetiker').split('_')[0]}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleExportShapeAsGLB({ type: 'text3d', id: textItem.id })}
                              className="p-1 rounded text-teal-400 hover:text-teal-300 hover:bg-teal-950/40 transition-colors"
                              title="Export 3D Text as .GLB"
                            >
                              <span className="material-symbols-outlined text-sm">download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggle3DTextVisibility(textItem.id)}
                              className={`p-1 rounded hover:bg-neutral-800 transition-colors ${textItem.visible !== false ? 'text-neutral-300' : 'text-neutral-600'
                                }`}
                              title={textItem.visible !== false ? 'Hide 3D Text' : 'Show 3D Text'}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {textItem.visible !== false ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate3DText(textItem.id)}
                              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                              title="Duplicate 3D Text"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete3DText(textItem.id)}
                              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              title="Delete 3D Text"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected 3D Text Properties Editor */}
              {(() => {
                const selectedText = custom3DTexts.find((t) => t.id === selectedText3DId);
                if (!selectedText) return null;

                return (
                  <div className="space-y-4 pt-3 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between pb-1 border-b border-pink-500/30">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-pink-400 text-sm">edit_note</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-pink-200">
                          Edit 3D Text: "{selectedText.text}"
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleExportShapeAsGLB({ type: 'text3d', id: selectedText.id })}
                          className="px-2 py-0.5 rounded bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 text-teal-300 text-[10px] font-mono font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Export 3D Text as .GLB File"
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          <span>GLB</span>
                        </button>
                        <button
                          type="button"
                          onClick={focusCameraOnSelectedObject}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono font-semibold flex items-center gap-1"
                          title="Focus Preview Camera on this Text (F)"
                        >
                          <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                          Frame (F)
                        </button>
                      </div>
                    </div>

                    {/* Text String Input */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-300">Text String</label>
                      <input
                        type="text"
                        value={selectedText.text || ''}
                        onChange={(e) => handleUpdate3DText(selectedText.id, { text: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs font-semibold text-white focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    {/* Typography Font & Alignment */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">Font</label>
                        <select
                          value={selectedText.fontFamily || 'helvetiker_bold'}
                          onChange={(e) => handleUpdate3DText(selectedText.id, { fontFamily: e.target.value })}
                          className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-pink-500"
                        >
                          {AVAILABLE_FONTS.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-300">Alignment</label>
                        <div className="grid grid-cols-3 gap-0.5 bg-black p-0.5 rounded border border-neutral-800">
                          {['left', 'center', 'right'].map((al) => (
                            <button
                              key={al}
                              type="button"
                              onClick={() => handleUpdate3DText(selectedText.id, { align: al })}
                              className={`py-1 rounded text-[10px] font-semibold capitalize transition-all ${(selectedText.align || 'center') === al
                                ? 'bg-pink-600 text-white shadow'
                                : 'text-neutral-400 hover:text-white'
                                }`}
                            >
                              {al}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Dimensions: Size & Depth */}
                    <div className="space-y-2">
                      <NumberSliderInput
                        label="Font Size"
                        value={selectedText.size !== undefined ? selectedText.size : 0.35}
                        onChange={(val) => handleUpdate3DText(selectedText.id, { size: val })}
                        min={0.05}
                        max={1.5}
                        step={0.02}
                        unit="m"
                        color="pink"
                        precision={2}
                      />
                      <NumberSliderInput
                        label="Extrusion Thickness (Depth)"
                        value={selectedText.depth !== undefined ? selectedText.depth : 0.08}
                        onChange={(val) => handleUpdate3DText(selectedText.id, { depth: val })}
                        min={0.01}
                        max={0.5}
                        step={0.01}
                        unit="m"
                        color="pink"
                        precision={2}
                      />
                    </div>

                    {/* Bevel Chamfer Controls */}
                    <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedText.bevelEnabled !== false}
                            onChange={(e) => handleUpdate3DText(selectedText.id, { bevelEnabled: e.target.checked })}
                            className="rounded accent-pink-500 cursor-pointer"
                          />
                          Chamfered Bevel Edges
                        </label>
                        <span className="text-[10px] text-neutral-400 font-mono">Specular highlights</span>
                      </div>
                      {selectedText.bevelEnabled !== false && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <NumberSliderInput
                            label="Bevel Depth"
                            value={selectedText.bevelThickness !== undefined ? selectedText.bevelThickness : 0.015}
                            onChange={(val) => handleUpdate3DText(selectedText.id, { bevelThickness: val })}
                            min={0.002}
                            max={0.04}
                            step={0.002}
                            unit="m"
                            color="pink"
                            precision={3}
                          />
                          <NumberSliderInput
                            label="Bevel Size"
                            value={selectedText.bevelSize !== undefined ? selectedText.bevelSize : 0.01}
                            onChange={(val) => handleUpdate3DText(selectedText.id, { bevelSize: val })}
                            min={0.002}
                            max={0.03}
                            step={0.002}
                            unit="m"
                            color="pink"
                            precision={3}
                          />
                        </div>
                      )}
                    </div>

                    {/* Colors & Glowing Emissive */}
                    <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                        Surface Colors & Glow
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/70 border border-neutral-800">
                          <span className="text-xs font-semibold text-neutral-300">Color</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-neutral-400">{selectedText.color || '#38bdf8'}</span>
                            <input
                              type="color"
                              value={selectedText.color || '#38bdf8'}
                              onChange={(e) => handleUpdate3DText(selectedText.id, { color: e.target.value })}
                              className="w-7 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/70 border border-neutral-800">
                          <span className="text-xs font-semibold text-neutral-300">Emissive</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-neutral-400">{selectedText.emissive || '#000000'}</span>
                            <input
                              type="color"
                              value={selectedText.emissive || '#000000'}
                              onChange={(e) => handleUpdate3DText(selectedText.id, { emissive: e.target.value })}
                              className="w-7 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                            />
                          </div>
                        </div>
                      </div>

                      <NumberSliderInput
                        label="Glow Emissive Intensity"
                        value={selectedText.emissiveIntensity !== undefined ? selectedText.emissiveIntensity : 0.0}
                        onChange={(val) => handleUpdate3DText(selectedText.id, { emissiveIntensity: val })}
                        min={0.0}
                        max={3.0}
                        step={0.1}
                        unit="x"
                        color="pink"
                        precision={1}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <NumberSliderInput
                          label="Metalness"
                          value={selectedText.metalness !== undefined ? selectedText.metalness : 0.75}
                          onChange={(val) => handleUpdate3DText(selectedText.id, { metalness: val })}
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          color="indigo"
                          precision={2}
                        />
                        <NumberSliderInput
                          label="Roughness"
                          value={selectedText.roughness !== undefined ? selectedText.roughness : 0.25}
                          onChange={(val) => handleUpdate3DText(selectedText.id, { roughness: val })}
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          color="indigo"
                          precision={2}
                        />
                      </div>
                    </div>

                    {/* Transform Coordinates */}
                    <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          3D Spatial Position (X, Y, Z)
                        </span>
                        <span className="text-[9px] font-mono text-pink-400">Drag with Gizmo (W)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['posX', 'posY', 'posZ'].map((axis, i) => (
                          <div key={axis} className="flex flex-col gap-0.5 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase font-semibold">
                              {axis === 'posX' ? 'X (Left/Right)' : axis === 'posY' ? 'Y (Up/Down)' : 'Z (Forward)'}
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              value={selectedText[axis] !== undefined ? selectedText[axis] : (i === 1 ? 0.6 : 0)}
                              onChange={(e) => handleUpdate3DText(selectedText.id, { [axis]: parseFloat(e.target.value) || 0 })}
                              className="px-1.5 py-1 bg-black border border-neutral-700 rounded text-xs font-mono text-white text-right focus:outline-none focus:border-pink-500"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {['rotX', 'rotY', 'rotZ'].map((rotAxis) => (
                          <div key={rotAxis} className="flex flex-col gap-0.5 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase font-semibold">
                              {rotAxis.toUpperCase()} (Deg)
                            </span>
                            <input
                              type="number"
                              step="5"
                              value={selectedText[rotAxis] !== undefined ? selectedText[rotAxis] : 0}
                              onChange={(e) => handleUpdate3DText(selectedText.id, { [rotAxis]: parseFloat(e.target.value) || 0 })}
                              className="px-1.5 py-1 bg-black border border-neutral-700 rounded text-xs font-mono text-white text-right focus:outline-none focus:border-pink-500"
                            />
                          </div>
                        ))}
                      </div>

                      <NumberSliderInput
                        label="Uniform Scale"
                        value={selectedText.scale !== undefined ? selectedText.scale : 1.0}
                        onChange={(val) => handleUpdate3DText(selectedText.id, { scale: val, scaleX: val, scaleY: val, scaleZ: val })}
                        min={0.1}
                        max={4.0}
                        step={0.05}
                        unit="x"
                        color="pink"
                        precision={2}
                      />
                    </div>

                    {/* Motion & Floating Effects */}
                    <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                        Motion & Floating Effects
                      </span>
                      <NumberSliderInput
                        label="Auto-Rotation Speed"
                        value={selectedText.rotationSpeed || 0}
                        onChange={(val) => handleUpdate3DText(selectedText.id, { rotationSpeed: val })}
                        min={-180}
                        max={180}
                        step={5}
                        unit="°/s"
                        color="pink"
                        precision={0}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <NumberSliderInput
                          label="Bobbing Speed"
                          value={selectedText.bobbingSpeed || 0}
                          onChange={(val) => handleUpdate3DText(selectedText.id, { bobbingSpeed: val })}
                          min={0}
                          max={5}
                          step={0.2}
                          color="pink"
                          precision={1}
                        />
                        <NumberSliderInput
                          label="Bobbing Height"
                          value={selectedText.bobbingHeight || 0}
                          onChange={(val) => handleUpdate3DText(selectedText.id, { bobbingHeight: val })}
                          min={0}
                          max={0.3}
                          step={0.02}
                          unit="m"
                          color="pink"
                          precision={2}
                        />
                      </div>
                    </div>

                    {/* 9-Point Marker Placement Matrix */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-pink-400">grid_view</span>
                          Snap Text to Target Marker
                        </span>
                        <span className="text-[9px] font-mono text-neutral-400">9-Point Grid</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-black/60 p-2 rounded-lg border border-neutral-800">
                        {[
                          { id: 'TL', label: '↖ Top-L' },
                          { id: 'TC', label: '↑ Top-C' },
                          { id: 'TR', label: '↗ Top-R' },
                          { id: 'CL', label: '← Mid-L' },
                          { id: 'CC', label: '• Center' },
                          { id: 'CR', label: '→ Mid-R' },
                          { id: 'BL', label: '↙ Btm-L' },
                          { id: 'BC', label: '↓ Btm-C' },
                          { id: 'BR', label: '↘ Btm-R' }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => snapTextToMarkerAnchor(selectedText.id, btn.id)}
                            className="py-1.5 rounded text-[10px] font-mono font-semibold bg-neutral-800 hover:bg-pink-950/80 border border-neutral-700 hover:border-pink-500/50 text-neutral-300 hover:text-pink-300 text-center transition-all"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Save to Batch / Template */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={editingTemplate ? handleSaveTemplate : handleSaveConfig}
                        disabled={savingConfig || (!editingTemplate && !batchId.trim())}
                        className="w-full py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-900/30 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">{editingTemplate ? 'cloud_upload' : 'save'}</span>
                        <span>
                          {savingConfig
                            ? (editingTemplate ? 'Saving 3D Text to Template...' : 'Saving 3D Text Configuration...')
                            : (editingTemplate
                                ? `Save 3D Text to Template (${editingTemplate.cleanName || editingTemplate.name})`
                                : `Save 3D Text to Batch (${batchId || 'Active'})`)}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: LIGHTING CONTROLS                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'lighting' && (
            <div className="space-y-5">
              {/* Custom Multi-Source Lighting Section */}
              <div className="space-y-3 pb-4 border-b border-neutral-800">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-400">light</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                      Dynamic Light Sources ({customLights.length})
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-mono text-neutral-400 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLightHelpers}
                        onChange={(e) => setShowLightHelpers(e.target.checked)}
                        className="rounded accent-amber-500 cursor-pointer"
                      />
                      Show Bulbs
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticsDrawer(true)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1 transition-all"
                      title="Open Real-Time Point Light Diagnostics & DevTools Drawer"
                    >
                      <span className="material-symbols-outlined text-xs">tune</span>
                      DevTools
                    </button>
                  </div>
                </div>

                {/* Add Light Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddLight('point')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-amber-950/60 border border-neutral-800 hover:border-amber-500/50 text-[11px] font-semibold text-neutral-300 hover:text-amber-300 flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-amber-400">wb_incandescent</span>
                    + Point Light
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddLight('spot')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-sky-950/60 border border-neutral-800 hover:border-sky-500/50 text-[11px] font-semibold text-neutral-300 hover:text-sky-300 flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-sky-400">highlight</span>
                    + Spotlight
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddLight('directional')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-emerald-950/60 border border-neutral-800 hover:border-emerald-500/50 text-[11px] font-semibold text-neutral-300 hover:text-emerald-300 flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-emerald-400">wb_sunny</span>
                    + Directional
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddLight('hemisphere')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-purple-950/60 border border-neutral-800 hover:border-purple-500/50 text-[11px] font-semibold text-neutral-300 hover:text-purple-300 flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-purple-400">gradient</span>
                    + Hemisphere
                  </button>
                </div>

                {/* Lighting Presets */}
                <div className="grid grid-cols-3 gap-1 bg-black/60 p-1.5 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => applyLightingRigPreset('stage_spotlight')}
                    className="py-1 px-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-neutral-300 text-center transition-all truncate"
                  >
                    🎯 Stage Spotlight
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLightingRigPreset('cyberpunk_dual')}
                    className="py-1 px-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-neutral-300 text-center transition-all truncate"
                  >
                    ⚡ Cyberpunk Dual
                  </button>
                  <button
                    type="button"
                    onClick={() => applyLightingRigPreset('warm_golden')}
                    className="py-1 px-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-neutral-300 text-center transition-all truncate"
                  >
                    🌅 Golden Hour
                  </button>
                </div>

                {/* Custom Lights List */}
                {customLights.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                    {customLights.map((l) => {
                      const isSelected = selectedLightId === l.id && selectedTargetType === 'light';
                      const isMultiSelected = selectedObjects.some((it) => it.type === 'light' && it.id === l.id);
                      const lightGroup = sceneGroups.find((g) => g.itemIds.some((it) => it.type === 'light' && it.id === l.id));
                      const icon =
                        l.type === 'spot'
                          ? 'highlight'
                          : l.type === 'directional'
                            ? 'wb_sunny'
                            : l.type === 'hemisphere'
                              ? 'gradient'
                              : 'wb_incandescent';
                      return (
                        <div
                          key={l.id}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey || isMultiSelectMode) {
                              toggleObjectSelection('light', l.id);
                            } else {
                              selectSceneObject('light', l.id);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${isSelected
                            ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-sm'
                            : isMultiSelected
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-xs'
                              : 'bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                            }`}
                        >
                          <div className="flex listed-shapes items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isMultiSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleObjectSelection('light', l.id);
                              }}
                              className="w-3.5 h-3.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                              title="Toggle selection for multi-object editing or grouping"
                            />
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-black/40"
                              style={{ backgroundColor: l.color || '#ffffff' }}
                            ></span>
                            <span className="material-symbols-outlined text-xs text-amber-400 shrink-0">
                              {icon}
                            </span>
                            <span className="font-semibold truncate max-w-[130px]">{l.name}</span>
                            {isMultiSelected && !isSelected && (
                              <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                                MULTI
                              </span>
                            )}
                            {lightGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectGroup(lightGroup.id);
                                }}
                                className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono font-bold flex items-center gap-0.5 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                title={`Part of group "${lightGroup.name}". Click to select group.`}
                              >
                                <span className="material-symbols-outlined text-[10px]">folder</span>
                                {lightGroup.name}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleLightVisibility(l.id)}
                              className={`p-1 rounded hover:bg-neutral-800 transition-colors ${l.visible !== false ? 'text-neutral-300' : 'text-neutral-600'
                                }`}
                              title={l.visible !== false ? 'Turn Off Light' : 'Turn On Light'}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {l.visible !== false ? 'visibility' : 'visibility_off'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLight(l.id)}
                              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                              title="Duplicate Light"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLight(l.id)}
                              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              title="Delete Light"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Custom Light Properties */}
                {(() => {
                  const selectedLight = customLights.find((l) => l.id === selectedLightId);
                  if (!selectedLight) return null;

                  return (
                    <div className="space-y-3 p-3 rounded-xl bg-neutral-950/70 border border-amber-500/40 space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">tune</span>
                          {selectedLight.name}
                        </span>
                        <button
                          type="button"
                          onClick={focusCameraOnSelectedObject}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono font-semibold flex items-center gap-1"
                          title="Focus Camera on this Light (F)"
                        >
                          <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                          Frame (F)
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-neutral-300">Light Name</label>
                          <input
                            type="text"
                            value={selectedLight.name || ''}
                            onChange={(e) => handleUpdateLight(selectedLight.id, { name: e.target.value })}
                            className="w-full px-2 py-1 bg-black border border-neutral-700 rounded text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-neutral-300">Light Type</label>
                          <select
                            value={selectedLight.type || 'point'}
                            onChange={(e) => handleUpdateLight(selectedLight.id, { type: e.target.value })}
                            className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-amber-500 capitalize"
                          >
                            <option value="point">Point Light</option>
                            <option value="spot">Spotlight</option>
                            <option value="directional">Directional</option>
                            <option value="hemisphere">Hemisphere</option>
                          </select>
                        </div>
                      </div>

                      {/* Color Pickers */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                          <span className="text-xs font-semibold text-neutral-300">
                            {selectedLight.type === 'hemisphere' ? 'Sky Color' : 'Color'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-neutral-400">{selectedLight.color || '#ffffff'}</span>
                            <input
                              type="color"
                              value={selectedLight.color || '#ffffff'}
                              onChange={(e) => handleUpdateLight(selectedLight.id, { color: e.target.value })}
                              className="w-7 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                            />
                          </div>
                        </div>

                        {selectedLight.type === 'hemisphere' ? (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                            <span className="text-xs font-semibold text-neutral-300">Ground Color</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-neutral-400">{selectedLight.groundColor || '#1e293b'}</span>
                              <input
                                type="color"
                                value={selectedLight.groundColor || '#1e293b'}
                                onChange={(e) => handleUpdateLight(selectedLight.id, { groundColor: e.target.value })}
                                className="w-7 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                            <span className="text-xs font-semibold text-neutral-300">Cast Shadows</span>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedLight.castShadow)}
                              onChange={(e) => handleUpdateLight(selectedLight.id, { castShadow: e.target.checked })}
                              className="rounded accent-amber-500 cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Intensity */}
                      <NumberSliderInput
                        label="Intensity"
                        value={selectedLight.intensity !== undefined ? selectedLight.intensity : 2.5}
                        onChange={(val) => handleUpdateLight(selectedLight.id, { intensity: val })}
                        min={0.1}
                        max={15.0}
                        step={0.1}
                        unit="x"
                        color="amber"
                        precision={1}
                      />

                      {/* Point/Spot: Distance & Decay */}
                      {(selectedLight.type === 'point' || selectedLight.type === 'spot') && (
                        <div className="grid grid-cols-2 gap-2">
                          <NumberSliderInput
                            label="Distance Range"
                            value={selectedLight.distance !== undefined ? selectedLight.distance : 25}
                            onChange={(val) => handleUpdateLight(selectedLight.id, { distance: val })}
                            min={1}
                            max={100}
                            step={1}
                            unit="m"
                            color="amber"
                            precision={0}
                          />
                          <NumberSliderInput
                            label="Physical Decay"
                            value={selectedLight.decay !== undefined ? selectedLight.decay : 2}
                            onChange={(val) => handleUpdateLight(selectedLight.id, { decay: val })}
                            min={0}
                            max={3}
                            step={0.1}
                            color="amber"
                            precision={1}
                          />
                        </div>
                      )}

                      {/* Spotlight: Angle & Penumbra */}
                      {selectedLight.type === 'spot' && (
                        <div className="grid grid-cols-2 gap-2">
                          <NumberSliderInput
                            label="Cone Angle"
                            value={selectedLight.angle !== undefined ? selectedLight.angle : 45}
                            onChange={(val) => handleUpdateLight(selectedLight.id, { angle: val })}
                            min={10}
                            max={90}
                            step={1}
                            unit="°"
                            color="sky"
                            precision={0}
                          />
                          <NumberSliderInput
                            label="Penumbra Softness"
                            value={selectedLight.penumbra !== undefined ? selectedLight.penumbra : 0.35}
                            onChange={(val) => handleUpdateLight(selectedLight.id, { penumbra: val })}
                            min={0}
                            max={1.0}
                            step={0.05}
                            color="sky"
                            precision={2}
                          />
                        </div>
                      )}

                      {/* Visual Light Source Emitter / Bulb Appearance */}
                      <div className="space-y-2 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-amber-400">lightbulb</span>
                            Luminous Emitter Glow
                          </span>
                          <label className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLight.showBulb !== false}
                              onChange={(e) => handleUpdateLight(selectedLight.id, { showBulb: e.target.checked })}
                              className="rounded accent-amber-500 cursor-pointer"
                            />
                            Show in Scene & AR
                          </label>
                        </div>
                        {selectedLight.showBulb !== false && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <NumberSliderInput
                              label="Emission Glow"
                              value={selectedLight.bulbIntensity !== undefined ? selectedLight.bulbIntensity : 3.0}
                              onChange={(val) => handleUpdateLight(selectedLight.id, { bulbIntensity: val })}
                              min={0.1}
                              max={10.0}
                              step={0.1}
                              unit="x"
                              color="amber"
                              precision={1}
                            />
                            <NumberSliderInput
                              label="Bulb Radius"
                              value={selectedLight.bulbSize !== undefined ? selectedLight.bulbSize : 0.06}
                              onChange={(val) => handleUpdateLight(selectedLight.id, { bulbSize: val })}
                              min={0.02}
                              max={0.3}
                              step={0.01}
                              unit="m"
                              color="amber"
                              precision={2}
                            />
                          </div>
                        )}
                      </div>

                      {/* Position 3D Coordinates */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                            Light Position (X, Y, Z)
                          </span>
                          <span className="text-[9px] font-mono text-amber-400">Drag with Gizmo (W)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['posX', 'posY', 'posZ'].map((axis, idx) => (
                            <div key={axis} className="flex flex-col gap-0.5 bg-neutral-900 p-1.5 rounded border border-neutral-800">
                              <span className="text-[9px] font-mono text-neutral-400 uppercase font-semibold">
                                {axis === 'posX' ? 'X (Side)' : axis === 'posY' ? 'Y (Height)' : 'Z (Depth)'}
                              </span>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedLight[axis] !== undefined ? selectedLight[axis] : (idx === 1 ? 2.2 : 0)}
                                onChange={(e) => handleUpdateLight(selectedLight.id, { [axis]: parseFloat(e.target.value) || 0 })}
                                className="px-1.5 py-1 bg-black border border-neutral-700 rounded text-xs font-mono text-white text-right focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Snap Actions */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => snapLightToMarker(selectedLight.id)}
                          className="flex-1 py-1 px-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-neutral-300 hover:text-amber-300 text-center transition-all"
                        >
                          Snap to Marker Top
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateLight(selectedLight.id, { posX: 0, posY: 2.8, posZ: 0 })}
                          className="flex-1 py-1 px-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-neutral-300 hover:text-amber-300 text-center transition-all"
                        >
                          Hover Over Model Center
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Ambient Environment Light */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400">wb_sunny</span>
                  Ambient Environment Light
                </h2>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light Color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{ambientColor}</span>
                    <input
                      type="color"
                      value={ambientColor}
                      onChange={(e) => setAmbientColor(e.target.value)}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                    />
                  </div>
                </div>
                <NumberSliderInput
                  label="Ambient Intensity"
                  value={ambientIntensity}
                  onChange={setAmbientIntensity}
                  min={0.0}
                  max={5.0}
                  step={0.1}
                  unit="x"
                  color="amber"
                  precision={1}
                  resetValue={1.4}
                />
              </div>

              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400">flashlight_on</span>
                  Directional Key Light (Source 1)
                </h2>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light Color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{dir1Color}</span>
                    <input
                      type="color"
                      value={dir1Color}
                      onChange={(e) => setDir1Color(e.target.value)}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                    />
                  </div>
                </div>
                <NumberSliderInput
                  label="Key Light Intensity"
                  value={dir1Intensity}
                  onChange={setDir1Intensity}
                  min={0.0}
                  max={10.0}
                  step={0.1}
                  unit="x"
                  color="amber"
                  precision={1}
                  resetValue={2.2}
                />
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light 1 3D Position (X Y Z)</span>
                  <input
                    type="text"
                    value={dir1Position}
                    onChange={(e) => setDir1Position(e.target.value)}
                    className="px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sky-400">highlight</span>
                  Directional Fill Light (Source 2)
                </h2>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light Color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{dir2Color}</span>
                    <input
                      type="color"
                      value={dir2Color}
                      onChange={(e) => setDir2Color(e.target.value)}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                    />
                  </div>
                </div>
                <NumberSliderInput
                  label="Fill Light Intensity"
                  value={dir2Intensity}
                  onChange={setDir2Intensity}
                  min={0.0}
                  max={10.0}
                  step={0.1}
                  unit="x"
                  color="sky"
                  precision={1}
                  resetValue={1.2}
                />
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light 2 3D Position (X Y Z)</span>
                  <input
                    type="text"
                    value={dir2Position}
                    onChange={(e) => setDir2Position(e.target.value)}
                    className="px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">flare</span>
                  Specular Rim Light (Source 3)
                </h2>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Light Color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{rimColor}</span>
                    <input
                      type="color"
                      value={rimColor}
                      onChange={(e) => setRimColor(e.target.value)}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                    />
                  </div>
                </div>
                <NumberSliderInput
                  label="Rim Light Intensity"
                  value={rimIntensity}
                  onChange={setRimIntensity}
                  min={0.0}
                  max={10.0}
                  step={0.1}
                  unit="x"
                  color="indigo"
                  precision={1}
                  resetValue={1.0}
                />
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Rim Light 3D Position (X Y Z)</span>
                  <input
                    type="text"
                    value={rimPosition}
                    onChange={(e) => setRimPosition(e.target.value)}
                    className="px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MATERIALS & SHADERS                                                */}
          {/* ========================================================================= */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              {Boolean(activeVideoUrl) && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-950/30 border border-red-500/40 text-xs shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-red-400 text-sm shrink-0">movie</span>
                    <span className="text-[11px] text-neutral-300 truncate">
                      Video texture layer is actively mapped to model surface.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveVideoLayer}
                    className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                    title="Remove video texture layer and restore standard PBR textures"
                  >
                    <span className="material-symbols-outlined text-xs">videocam_off</span>
                    Remove Layer
                  </button>
                </div>
              )}
              {/* Target Object / Mesh Selector */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">category</span>
                  Target Object:
                </span>
                <select
                  value={selectedMeshUuid || ''}
                  onChange={(e) => e.target.value ? selectSceneObject('mesh', e.target.value) : selectSceneObject('model')}
                  className="bg-neutral-800 text-xs text-white border border-neutral-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 max-w-[210px] truncate cursor-pointer"
                >
                  <option value="">Global / Entire Model</option>
                  {meshList.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.name} ({m.materialName || 'Material'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMesh ? (
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">texture</span>
                      Mesh Material: {selectedMesh.name}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">{selectedMesh.materialName}</span>
                  </div>

                  {/* Individual Mesh Color Tint */}
                  <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                    <span className="text-xs font-semibold text-neutral-300">Color Tint</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-400">{selectedMesh.material.color}</span>
                      <input
                        type="color"
                        value={selectedMesh.material.color}
                        onChange={(e) => handleMeshMaterialChange('color', e.target.value)}
                        className="w-8 h-6 bg-transparent cursor-pointer rounded border border-neutral-700"
                      />
                    </div>
                  </div>

                  <NumberSliderInput
                    label="Mesh Metalness"
                    value={selectedMesh.material.metalness}
                    onChange={(val) => handleMeshMaterialChange('metalness', val)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    color="amber"
                    precision={2}
                  />

                  <NumberSliderInput
                    label="Mesh Roughness"
                    value={selectedMesh.material.roughness}
                    onChange={(val) => handleMeshMaterialChange('roughness', val)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    color="amber"
                    precision={2}
                  />

                  <NumberSliderInput
                    label="Mesh Opacity"
                    value={selectedMesh.material.opacity}
                    onChange={(val) => handleMeshMaterialChange('opacity', val)}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    color="indigo"
                    precision={2}
                  />

                  {/* UV Map / Image Texture Material */}
                  <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-purple-400">texture</span>
                        UV Map / Texture Image
                      </span>
                      {selectedMesh.material?.hasCustomTexture && (
                        <span className="text-[9px] bg-purple-500/30 text-purple-300 border border-purple-500/50 px-1.5 py-0.2 rounded font-mono font-bold">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 rounded text-xs text-purple-200 font-medium cursor-pointer transition-colors">
                        {textureUploadingUuid === selectedMesh.uuid ? (
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">upload_file</span>
                        )}
                        <span>{selectedMesh.material?.hasCustomTexture ? 'Replace UV Texture' : 'Upload UV Texture'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleApplyMeshTexture(selectedMesh, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {selectedMesh.material?.hasCustomTexture && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMeshTexture(selectedMesh.uuid, selectedMesh.name)}
                          className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 rounded text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          title="Delete custom texture, remove from Cloud Storage, and restore original material"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          <span>Revert</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Material Placement, Orientation & Size Controls */}
                  <div className="p-3 rounded-lg bg-neutral-900/90 border border-indigo-500/40 space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-indigo-400">transform</span>
                        Material Placement, Orientation & Size
                      </span>
                      <button
                        type="button"
                        onClick={handleResetMeshTextureTransform}
                        className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Reset material placement, rotation, and size to default"
                      >
                        <span className="material-symbols-outlined text-xs">restart_alt</span>
                        Reset Mapping
                      </button>
                    </div>

                    {/* Section 1: Placement (UV Offset U & V) */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">open_with</span>
                        Placement (UV Offset)
                      </span>
                      <NumberSliderInput
                        label="Horizontal Placement (U)"
                        value={selectedMesh.material?.textureOffsetX ?? 0.0}
                        onChange={(val) => handleMeshMaterialChange('textureOffsetX', val)}
                        min={-2.0}
                        max={2.0}
                        step={0.01}
                        precision={2}
                        resetValue={0.0}
                        color="purple"
                        description="Shift material left or right across the surface"
                      />
                      <NumberSliderInput
                        label="Vertical Placement (V)"
                        value={selectedMesh.material?.textureOffsetY ?? 0.0}
                        onChange={(val) => handleMeshMaterialChange('textureOffsetY', val)}
                        min={-2.0}
                        max={2.0}
                        step={0.01}
                        precision={2}
                        resetValue={0.0}
                        color="purple"
                        description="Shift material up or down across the surface"
                      />
                    </div>

                    {/* Section 2: Orientation (Rotation & Mirror Flip) */}
                    <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">rotate_right</span>
                          Orientation & Angle
                        </span>
                        {/* Quick 90 deg rotation presets */}
                        <div className="flex items-center gap-1">
                          {[0, 90, 180, 270].map((deg) => (
                            <button
                              key={deg}
                              type="button"
                              onClick={() => handleMeshMaterialChange('textureRotation', deg)}
                              className={`px-1.5 py-0.5 text-[9px] font-mono rounded border transition-colors cursor-pointer ${(selectedMesh.material?.textureRotation ?? 0) === deg
                                ? 'bg-sky-500/30 text-sky-300 border-sky-500/50'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                                }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>
                      <NumberSliderInput
                        label="Rotation Angle"
                        value={selectedMesh.material?.textureRotation ?? 0}
                        onChange={(val) => handleMeshMaterialChange('textureRotation', val)}
                        min={0}
                        max={360}
                        step={1}
                        unit="°"
                        precision={0}
                        resetValue={0}
                        color="sky"
                      />

                      {/* Mirror / Flip Toggles */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
                          <span className="text-xs text-neutral-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-sky-400">flip</span>
                            Flip Horizontal
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedMesh.material?.textureFlipX)}
                            onChange={(e) => handleMeshMaterialChange('textureFlipX', e.target.checked)}
                            className="w-4 h-4 accent-sky-500 cursor-pointer"
                          />
                        </label>
                        <label className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
                          <span className="text-xs text-neutral-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-sky-400 rotate-90">flip</span>
                            Flip Vertical
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedMesh.material?.textureFlipY)}
                            onChange={(e) => handleMeshMaterialChange('textureFlipY', e.target.checked)}
                            className="w-4 h-4 accent-sky-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Section 3: Size (Scale / Tiling Repeat) */}
                    <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">zoom_out_map</span>
                          Size & Scale (Repeat)
                        </span>
                        {/* Quick Scale Presets */}
                        <div className="flex items-center gap-1">
                          {[0.5, 1.0, 2.0, 4.0].map((sc) => (
                            <button
                              key={sc}
                              type="button"
                              onClick={() => {
                                handleMeshMaterialChange({
                                  textureRepeatX: sc,
                                  textureRepeatY: sc
                                });
                              }}
                              className={`px-1.5 py-0.5 text-[9px] font-mono rounded border transition-colors cursor-pointer ${(selectedMesh.material?.textureRepeatX ?? 1.0) === sc && (selectedMesh.material?.textureRepeatY ?? 1.0) === sc
                                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                                }`}
                            >
                              {sc}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <NumberSliderInput
                        label="Horizontal Size (Repeat U)"
                        value={selectedMesh.material?.textureRepeatX ?? 1.0}
                        onChange={(val) => handleMeshMaterialChange('textureRepeatX', val)}
                        min={0.1}
                        max={10.0}
                        step={0.05}
                        precision={2}
                        resetValue={1.0}
                        color="emerald"
                        description="Scale or tile material horizontally"
                      />
                      <NumberSliderInput
                        label="Vertical Size (Repeat V)"
                        value={selectedMesh.material?.textureRepeatY ?? 1.0}
                        onChange={(val) => handleMeshMaterialChange('textureRepeatY', val)}
                        min={0.1}
                        max={10.0}
                        step={0.05}
                        precision={2}
                        resetValue={1.0}
                        color="emerald"
                        description="Scale or tile material vertically"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-emerald-300">Preserve GLTF PBR Maps</span>
                      <span className="text-[10px] text-emerald-400/80">Uses embedded textures, roughness, and metalness</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useNativePBR}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseNativePBR(checked);
                        if (checked) {
                          setMatMetalness(-1);
                          setMatRoughness(-1);
                        } else {
                          setMatMetalness(0.0);
                          setMatRoughness(1.0);
                        }
                      }}
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {!useNativePBR ? (
                    <div className="space-y-3 p-3 bg-neutral-900/80 border border-neutral-800 rounded-lg">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Global PBR Overrides</span>
                      <NumberSliderInput
                        label="Surface Metalness"
                        value={matMetalness >= 0 ? matMetalness : 0.0}
                        onChange={setMatMetalness}
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        color="amber"
                        precision={2}
                        resetValue={0.0}
                      />
                      <NumberSliderInput
                        label="Surface Roughness"
                        value={matRoughness >= 0 ? matRoughness : 1.0}
                        onChange={setMatRoughness}
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        color="amber"
                        precision={2}
                        resetValue={1.0}
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg text-xs text-neutral-400 leading-relaxed">
                      ✨ Native PBR mode is active. Material textures, diffuse maps, specular highlights, and roughness maps embedded inside the GLB model are strictly preserved.
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                      <span className="text-xs font-semibold text-neutral-300">Emissive Glow Color</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-400">{matEmissive}</span>
                        <input
                          type="color"
                          value={matEmissive}
                          onChange={(e) => setMatEmissive(e.target.value)}
                          className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                        />
                      </div>
                    </div>
                    <NumberSliderInput
                      label="Emissive Glow Intensity"
                      value={matEmissiveIntensity}
                      onChange={setMatEmissiveIntensity}
                      min={0.0}
                      max={5.0}
                      step={0.1}
                      color="purple"
                      precision={1}
                      resetValue={0.0}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <NumberSliderInput
                      label="Material Opacity"
                      value={matOpacity}
                      onChange={setMatOpacity}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      color="indigo"
                      precision={2}
                      resetValue={1.0}
                    />
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800">
                      <span className="text-xs font-semibold text-neutral-300">Wireframe Mesh Debug</span>
                      <input
                        type="checkbox"
                        checked={matWireframe}
                        onChange={(e) => setMatWireframe(e.target.checked)}
                        className="w-5 h-5 accent-white cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: MEDIA LAYER, ENVIRONMENT & UI OVERLAYS                             */}
          {/* ========================================================================= */}
          {activeTab === 'scene' && (
            <div className="space-y-5">
              <div className="p-3 bg-neutral-900/90 border border-indigo-500/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">movie</span> Video Texture Layer
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedVideoFile && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        PENDING STORAGE SAVE
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${activeVideoUrl ? (isYouTubeUrl(activeVideoUrl) ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40') : 'bg-neutral-800 text-neutral-400'}`}>
                      {activeVideoUrl ? (isYouTubeUrl(activeVideoUrl) ? 'CSS3D YOUTUBE' : (activeVideoUrl.startsWith('blob:') ? 'LOCAL PREVIEW' : 'SAVED TO CLOUD')) : 'NONE'}
                    </span>
                    {Boolean(activeVideoUrl || customVideoUrl || selectedVideoFile || youtubeUrlInput) && (
                      <button
                        type="button"
                        onClick={handleRemoveVideoLayer}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-800/80 border border-red-500/50 text-red-200 text-[10px] font-semibold transition-all hover:scale-105 cursor-pointer shadow-sm shadow-red-900/40"
                        title="Completely remove video texture layer from 3D model and clear video URL"
                      >
                        <span className="material-symbols-outlined text-xs">videocam_off</span>
                        Remove Layer
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Video Status Banner with Remove Action */}
                {Boolean(activeVideoUrl || selectedVideoFile || youtubeUrlInput) && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-950/25 border border-red-500/40 text-xs shadow-inner">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
                        <span className="material-symbols-outlined text-lg">
                          {isYouTubeUrl(activeVideoUrl) ? 'smart_display' : 'videocam'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-white truncate">
                            {isYouTubeUrl(activeVideoUrl) ? 'YouTube Overlay Attached' : (localVideoName ? `Video: ${localVideoName}` : 'Video Texture Attached')}
                          </span>
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-red-500/30 text-red-200 border border-red-500/40 font-bold uppercase tracking-wider">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[200px]">
                          {activeVideoUrl || youtubeUrlInput}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVideoLayer}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-bold transition-all shadow-sm cursor-pointer hover:shadow-red-500/30"
                      title="Remove video texture layer and restore default mesh materials"
                    >
                      <span className="material-symbols-outlined text-xs">videocam_off</span>
                      Remove Layer
                    </button>
                  </div>
                )}

                {/* Mode Selector: WebGL Video vs CSS3D YouTube */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/60 border border-neutral-800 rounded">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoMode('webgl');
                      if (isYouTubeUrl(activeVideoUrl)) {
                        setActiveVideoUrl('');
                        setCustomVideoUrl('');
                      }
                    }}
                    className={`py-1.5 px-2 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${videoMode === 'webgl'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">video_file</span>
                    WebGL Video (.mp4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoMode('youtube')}
                    className={`py-1.5 px-2 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${videoMode === 'youtube'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">smart_display</span>
                    CSS3D YouTube
                  </button>
                </div>

                {videoMode === 'webgl' ? (
                  <>
                    <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 hover:border-indigo-400 rounded text-xs font-medium cursor-pointer transition-colors text-indigo-200">
                      <span className="material-symbols-outlined text-[16px]">video_file</span>
                      {localVideoName ? `Video: ${localVideoName}` : 'Choose Local Video (.mp4, .webm)'}
                      <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={pickLocalVideo} className="hidden" />
                    </label>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-neutral-400">Or Paste Video URL:</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="https://.../video.mp4"
                          value={customVideoUrl || (activeVideoUrl.startsWith('http') && !isYouTubeUrl(activeVideoUrl) ? activeVideoUrl : '')}
                          onChange={(e) => applyCustomVideoUrl(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-indigo-400 font-mono"
                        />
                        {activeVideoUrl && !isYouTubeUrl(activeVideoUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveVideoLayer}
                            className="px-2 bg-neutral-800 hover:bg-red-900/50 text-neutral-300 hover:text-red-300 rounded text-xs transition-colors cursor-pointer"
                            title="Remove Video Layer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <div className="p-2 rounded bg-red-950/20 border border-red-500/30 text-[11px] text-neutral-300 leading-relaxed">
                      📺 <strong className="text-red-300">CORS-Free CSS3D Overlay:</strong> Bypasses HTML5 browser CORS restrictions completely. Directly synchronizes with your 3D target screen mesh with live interactive controls.
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-neutral-300 font-medium">YouTube URL, Short, or Video ID:</label>
                        {isYouTubeUrl(activeVideoUrl) && (
                          <span className="text-[10px] font-mono text-red-400 font-bold">
                            ID: {extractYouTubeId(activeVideoUrl)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="e.g. https://www.youtube.com/shorts/... or https://www.youtube.com/watch?v=..."
                          value={youtubeUrlInput || (isYouTubeUrl(activeVideoUrl) ? activeVideoUrl : '')}
                          onChange={(e) => {
                            setYoutubeUrlInput(e.target.value);
                            applyCustomVideoUrl(e.target.value);
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-red-400 font-mono"
                        />
                        {isYouTubeUrl(activeVideoUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveVideoLayer}
                            className="px-2 bg-neutral-800 hover:bg-red-900/50 text-neutral-300 hover:text-red-300 rounded text-xs transition-colors cursor-pointer"
                            title="Remove YouTube Video Layer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Aspect Ratio Selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-neutral-300 font-medium">Display Format / Aspect Ratio:</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: '16:9 Landscape', val: '16:9' },
                          { label: '9:16 Shorts', val: '9:16' },
                          { label: '21:9 Cinema', val: '21:9' }
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setVideoAspectRatio(opt.val)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${videoAspectRatio === opt.val
                              ? 'bg-red-600 text-white border-red-500 shadow-sm'
                              : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Quick Presets:</span>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { label: '📱 Streetwear Short', url: 'https://www.youtube.com/shorts/5wWp4oTzUHQ', aspect: '9:16' },
                          { label: '📱 3D Fashion Short', url: 'https://www.youtube.com/shorts/5W_w_aDvhxk', aspect: '9:16' },
                          { label: '🌌 Lofi Beats', id: 'jfKfPfyJRdk', aspect: '16:9' },
                          { label: '⚡ Synthwave', id: '4xDzrJKXOOY', aspect: '16:9' },
                          { label: '🕹️ Cyberpunk', id: '5qap5aO4i9A', aspect: '16:9' },
                          { label: '🎸 80s Classic', id: 'dQw4w9WgXcQ', aspect: '16:9' }
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              const url = preset.url || `https://www.youtube.com/watch?v=${preset.id}`;
                              setYoutubeUrlInput(url);
                              if (preset.aspect) setVideoAspectRatio(preset.aspect);
                              applyCustomVideoUrl(url);
                            }}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 rounded text-[10px] text-neutral-300 text-left truncate transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Monitor */}
                {activeVideoUrl && (
                  isYouTubeUrl(activeVideoUrl) ? (
                    <div className={`relative rounded overflow-hidden bg-black border border-red-500/50 mt-1 shadow-inner ${videoAspectRatio === '9:16' ? 'max-w-[170px] mx-auto aspect-[9/16] h-60' : 'w-full h-40'}`}>
                      <iframe
                        key={`${activeVideoUrl}-${videoAspectRatio}`}
                        src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(activeVideoUrl)}?enablejsapi=1&autoplay=0&controls=1`}
                        className="w-full h-full border-0 bg-black"
                        title="YouTube CSS3D Preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <div className="absolute top-1 left-1 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-red-400 font-mono font-bold flex items-center gap-1 pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                        {videoAspectRatio === '9:16' ? 'YOUTUBE SHORT (9:16)' : 'CSS3D YOUTUBE OVERLAY'}
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded overflow-hidden bg-black border border-indigo-500/50 mt-1 shadow-inner">
                      <video
                        key={activeVideoUrl}
                        src={activeVideoUrl}
                        autoPlay={mediaPlaying}
                        loop
                        muted
                        playsInline
                        className="object-contain bg-black video-player max-h-36 w-full"
                      />
                      <div className="absolute top-1 left-1 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        PREVIEW MONITOR
                      </div>
                    </div>
                  )
                )}

                {/* Target Mesh Layer Selector */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
                  <label className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-indigo-400">layers</span>
                      Map Video To Layer:
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">
                      {videoTargetMesh === 'auto' ? 'Auto-Detect' : videoTargetMesh === 'all' ? 'All Meshes' : (meshList.find(m => m.name === videoTargetMesh || m.uuid === videoTargetMesh)?.name || videoTargetMesh)}
                    </span>
                  </label>
                  <select
                    value={videoTargetMesh}
                    onChange={(e) => setVideoTargetMesh(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black border border-neutral-700 rounded text-xs text-neutral-200 focus:outline-none focus:border-indigo-400 font-mono"
                  >
                    <option value="auto">Auto-Detect (Screen / Display / Graphic / Cloth)</option>
                    <option value="all">Entire 3D Model (All Meshes)</option>
                    {meshList.map((m, i) => (
                      <option key={m.uuid} value={m.name || m.uuid}>
                        Mesh {i + 1}: {m.name} ({m.materialName || 'Mat'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => snapVideoToLayer(videoTargetMesh)}
                    className="w-full mt-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
                    title="Snap video layer to exact 3D position and orientation of the selected geometry/face"
                  >
                    <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                    Snap Video to Geometry / Face
                  </button>
                </div>

                {/* Mirror Video Toggle */}
                <div className="flex items-center justify-between p-2 rounded bg-neutral-900/80 border border-neutral-800">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-300">Mirror Video (Flip X)</span>
                    <span className="text-[10px] text-neutral-500">Un-mirror / flip video horizontally</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={videoFlipX}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setVideoFlipX(nextVal);
                      applyFlipXToScene(nextVal);
                    }}
                    className="w-5 h-5 accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Video Mapping, Placement & Size Controls */}
                <div className="pt-2 border-t border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">tune</span>
                      Mapping & Geometry Placement
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoScale(1.0);
                        setVideoOffsetX(0.0);
                        setVideoOffsetY(0.0);
                        setVideoOffsetZ(0.0);
                        setVideoRotation(0);
                        setVideoTextureRepeatX(1.0);
                        setVideoTextureRepeatY(1.0);
                        setVideoTextureOffsetX(0.0);
                        setVideoTextureOffsetY(0.0);
                      }}
                      className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
                      title="Reset video layer to default fill"
                    >
                      Reset Fill
                    </button>
                  </div>

                  {/* Video Scale Multiplier */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-neutral-400">Scale / Size Multiplier</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="10.0"
                          value={videoScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) setVideoScale(val);
                          }}
                          className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-indigo-400 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] font-mono text-neutral-400">x</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.01"
                      value={videoScale}
                      onChange={(e) => setVideoScale(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Position Offset X & Y */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-neutral-400">Offset X</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.005"
                            min="-10.0"
                            max="10.0"
                            value={videoOffsetX}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setVideoOffsetX(val);
                            }}
                            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">m</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.005"
                        value={videoOffsetX}
                        onChange={(e) => setVideoOffsetX(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-neutral-400">Offset Y</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.005"
                            min="-10.0"
                            max="10.0"
                            value={videoOffsetY}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setVideoOffsetY(val);
                            }}
                            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">m</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.005"
                        value={videoOffsetY}
                        onChange={(e) => setVideoOffsetY(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Surface Clearance Z & Rotation */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-neutral-400">Clearance (Z)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.001"
                            min="-5.0"
                            max="5.0"
                            value={videoOffsetZ}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setVideoOffsetZ(val);
                            }}
                            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">m</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-0.1"
                        max="0.2"
                        step="0.001"
                        value={videoOffsetZ}
                        onChange={(e) => setVideoOffsetZ(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-neutral-400">Rotation</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="-360"
                            max="360"
                            value={videoRotation}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) setVideoRotation(val);
                            }}
                            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-right text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">°</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="0.5"
                        value={videoRotation}
                        onChange={(e) => setVideoRotation(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-xs">
                  <span className="text-neutral-300">Playback State</span>
                  <button
                    type="button"
                    onClick={toggleMedia}
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors ${mediaPlaying ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                  >
                    {mediaPlaying ? '▶ Playing' : '⏸ Paused'}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-xs">
                  <span className="text-neutral-300">Video Audio / Sound</span>
                  <button
                    type="button"
                    onClick={toggleMediaMute}
                    className={`px-3 py-1 rounded font-medium text-xs transition-colors flex items-center gap-1.5 ${!mediaMuted ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {!mediaMuted ? 'volume_up' : 'volume_off'}
                    </span>
                    {!mediaMuted ? 'Sound On' : 'Muted'}
                  </button>
                </div>
              </div>

              {/* Camera Tracking Status & Quick Jump Card in Sidebar */}
              <div className="p-3 bg-neutral-900/90 border border-cyan-500/40 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">center_focus_strong</span>
                    Camera Tracking
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {trackingScope === 'global' ? 'GLOBAL' : (batchId ? `BATCH: ${batchId}` : 'ACTIVE')}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-300 flex justify-between">
                  <span className="text-neutral-400">Preset:</span>
                  <span className="font-semibold text-cyan-300 capitalize">{activeTrackingPreset}</span>
                </div>
                <div className="text-[11px] text-neutral-300 flex justify-between">
                  <span className="text-neutral-400">Filter Jitter Cutoff:</span>
                  <span className="font-mono text-cyan-300">{trackingFilterMinCF}</span>
                </div>
                <div className="text-[11px] text-neutral-300 flex justify-between">
                  <span className="text-neutral-400">Miss Tolerance:</span>
                  <span className="font-mono text-cyan-300">{trackingMissTolerance} frames</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracking')}
                  className="w-full mt-1 py-1.5 px-2 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 hover:text-white border border-cyan-500/40 hover:border-cyan-400 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                >
                  <span className="material-symbols-outlined text-xs">tune</span>
                  Configure Precision Tracking
                </button>
              </div>

              {/* View Camera Angles Quick Panel in Sidebar */}
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">videocam</span>
                  Center View Angles
                </h2>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setCameraView('front')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraView('back')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraView('left')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraView('right')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraView('top')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraView('bottom')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-indigo-600/40 text-neutral-200 hover:text-white text-xs font-semibold rounded border border-neutral-800 hover:border-indigo-500 transition-all flex items-center justify-center gap-1"
                  >
                    Bottom
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-neutral-400">cloud</span>
                  Atmospheric Fog
                </h2>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Fog Tint</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{fogColor}</span>
                    <input
                      type="color"
                      value={fogColor}
                      onChange={(e) => setFogColor(e.target.value)}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                    />
                  </div>
                </div>
                <NumberSliderInput
                  label="Fog Density"
                  value={fogDensity}
                  onChange={setFogDensity}
                  min={0.0}
                  max={0.5}
                  step={0.01}
                  color="indigo"
                  precision={3}
                  resetValue={0.0}
                />
              </div>

              <div className="space-y-3 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-rose-400">shopping_bag</span>
                  Interactive Buy Button Overlay
                </h2>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Show "Buy Now" Button</span>
                  <input
                    type="checkbox"
                    checked={showBuyButton}
                    onChange={(e) => setShowBuyButton(e.target.checked)}
                    className="w-5 h-5 accent-white cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300">Button Background Color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">{buyButtonColor}</span>
                    <input
                      type="color"
                      value={buyButtonColor}
                      onChange={(e) => setBuyButtonColor(e.target.value)}
                      disabled={!showBuyButton}
                      className="w-10 h-7 bg-transparent cursor-pointer rounded border border-neutral-700 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: CAMERA TARGET TRACKING & PRECISION CONTROLS                         */}
          {/* ========================================================================= */}
          {activeTab === 'tracking' && (
            <div className="space-y-5">
              {/* Target Marker Visual Reference Card */}
              <div className="p-3.5 bg-neutral-900/90 border border-emerald-500/40 rounded-xl space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <span className="material-symbols-outlined text-base">qr_code_2</span>
                    </div>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        Target Marker Reference
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${markerVisible ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-neutral-800 text-neutral-400'
                          }`}>
                          {markerVisible ? 'Active in Viewport' : 'Hidden'}
                        </span>
                      </h2>
                      <p className="text-[10px] text-neutral-400">Physical image anchor tracked by MindAR (XY Plane at 0, 0, 0)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMarkerVisible((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${markerVisible
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                      }`}
                  >
                    {markerVisible ? 'Hide Marker' : 'Show Marker'}
                  </button>
                </div>

                {/* Marker Image Thumbnail & Real-World Dimensions */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-black/60 border border-neutral-800">
                  <div className="relative w-28 h-28 shrink-0 rounded-lg overflow-hidden border border-emerald-500/40 bg-neutral-950 flex items-center justify-center group shadow-inner">
                    {markerImageUrl ? (
                      <img
                        src={markerImageUrl}
                        alt="Target Marker"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2 text-neutral-500">
                        <span className="material-symbols-outlined text-xl">image_not_supported</span>
                      </div>
                    )}
                    {markerLoading && (
                      <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                        <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono px-1 py-0.2 bg-black/80 rounded border border-neutral-700 text-neutral-300">
                      {markerInfo?.source === 'storage_mind_file' ? '.MIND' :
                        markerInfo?.source === 'mind_url' ? '.MIND' :
                          markerInfo?.source === 'batch_marker_image' ? 'IMAGE' :
                            markerInfo?.source === 'storage_marker_image' ? 'IMAGE' :
                              markerInfo?.source === 'custom' ? 'CUSTOM' : 'DEFAULT'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Physical Size:</span>
                      <span className="font-mono text-emerald-300 font-bold">
                        {(markerWidth * 100).toFixed(1)} × {(markerWidth * (markerAspectRatio || 0.5926) * 100).toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Scene Units:</span>
                      <span className="font-mono text-cyan-300">
                        {markerWidth.toFixed(2)}m × {(markerWidth * (markerAspectRatio || 0.5926)).toFixed(3)}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Resolution:</span>
                      <span className="font-mono text-neutral-200">
                        {markerInfo?.width ? `${markerInfo.width} × ${markerInfo.height} px` : 'Compiled 432 × 256 px'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Aspect Ratio:</span>
                      <span className="font-mono text-amber-300 font-semibold">
                        {(markerAspectRatio || 0.5926).toFixed(4)}
                        {markerInfo?.height && markerInfo?.width ? (
                          <button
                            type="button"
                            onClick={() => setMarkerAspectRatio(Number((markerInfo.height / markerInfo.width).toFixed(4)))}
                            className="ml-1 text-[9px] text-neutral-400 hover:text-emerald-300 underline"
                            title="Reset to natural aspect ratio of source marker"
                          >
                            [Reset]
                          </button>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Source:</span>
                      <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 truncate max-w-[140px]" title={markerInfo?.mindFilePath || markerInfo?.name || markerInfo?.source}>
                        {markerInfo?.source === 'storage_mind_file' ? 'Compiled .MIND Buffer' :
                          markerInfo?.source === 'mind_url' ? 'Network .MIND Target' :
                            markerInfo?.source === 'batch_marker_image' ? 'Batch Artwork Image' :
                              markerInfo?.source === 'storage_marker_image' ? 'Storage Target Image' :
                                markerInfo?.source === 'custom' ? 'Custom Uploaded Marker' : 'Procedural Alignment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preset Physical Target Dimensions Dropdown */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-cyan-400">straighten</span>
                      Physical Target Preset
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">
                      Standard Dimensions
                    </span>
                  </div>
                  <select
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      if (MARKER_PRESETS[idx]) {
                        applyMarkerPreset(MARKER_PRESETS[idx]);
                      }
                    }}
                    defaultValue=""
                    className="w-full bg-neutral-950 border border-neutral-700 hover:border-emerald-500/60 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-400 transition-colors"
                  >
                    <option value="" disabled>-- Select a Real-World Marker Size Preset --</option>
                    {MARKER_PRESETS.map((p, idx) => (
                      <option key={idx} value={idx}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sliders: Opacity & Physical Width */}
                <div className="space-y-2 pt-1">
                  <NumberSliderInput
                    label="Physical Marker Width"
                    value={markerWidth}
                    onChange={(val) => setMarkerWidth(val)}
                    min={0.05}
                    max={3.0}
                    step={0.01}
                    unit="m"
                    color="cyan"
                    precision={2}
                    resetValue={1.0}
                    description={`Width in meters: ${markerWidth.toFixed(2)}m (${(markerWidth * 100).toFixed(1)} cm)`}
                  />
                  <div className="flex items-center justify-between text-xs px-1 font-mono text-neutral-400 bg-neutral-950/60 p-1.5 rounded border border-neutral-800">
                    <span>Computed Physical Height:</span>
                    <span className="text-emerald-400 font-bold">
                      {(markerWidth * (markerAspectRatio || 0.5926)).toFixed(3)}m ({(markerWidth * (markerAspectRatio || 0.5926) * 100).toFixed(1)} cm)
                    </span>
                  </div>
                  <NumberSliderInput
                    label="Marker Opacity in Viewport"
                    value={markerOpacity}
                    onChange={setMarkerOpacity}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    color="emerald"
                    precision={2}
                    resetValue={0.85}
                    description="Adjust visual transparency of reference marker in 3D scene"
                  />
                </div>

                {/* 9-Point Marker Placement Matrix */}
                <div className="pt-2 border-t border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">grid_view</span>
                      9-Point Marker Placement Matrix
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">Click to Snap Object</span>
                  </div>

                  <div className="bg-black/60 p-2.5 rounded-lg border border-neutral-800 space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'TL', label: '↖ Top-Left', title: 'Top-Left Corner of Marker' },
                        { id: 'TC', label: '↑ Top-Center', title: 'Top-Center Edge of Marker' },
                        { id: 'TR', label: '↗ Top-Right', title: 'Top-Right Corner of Marker' },
                        { id: 'CL', label: '← Mid-Left', title: 'Middle Left Edge of Marker' },
                        { id: 'CC', label: '• Center (0,0)', title: 'Exact Marker Center Origin (0, 0)' },
                        { id: 'CR', label: '→ Mid-Right', title: 'Middle Right Edge of Marker' },
                        { id: 'BL', label: '↙ Btm-Left', title: 'Bottom-Left Corner of Marker' },
                        { id: 'BC', label: '↓ Btm-Center', title: 'Bottom-Center Edge of Marker' },
                        { id: 'BR', label: '↘ Btm-Right', title: 'Bottom-Right Corner of Marker' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => snapModelToMarkerAnchor(item.id)}
                          className={`py-2 px-1 rounded text-[10px] font-mono font-semibold border transition-all text-center flex items-center justify-center ${item.id === 'CC'
                            ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/50 text-emerald-300 shadow-sm'
                            : 'bg-neutral-800/90 hover:bg-neutral-700 border-neutral-700 hover:border-neutral-500 text-neutral-300'
                            }`}
                          title={item.title}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Surface Snapping & Framing Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => snapModelDepth(0)}
                      className="p-1.5 rounded bg-neutral-800 hover:bg-cyan-950/70 border border-neutral-700 hover:border-cyan-500/50 text-neutral-300 hover:text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Set model Z depth to 0 (flush to marker face)"
                    >
                      <span className="material-symbols-outlined text-xs text-cyan-400">vertical_align_center</span>
                      Flush (Z=0)
                    </button>
                    <button
                      type="button"
                      onClick={() => snapModelDepth(0.02)}
                      className="p-1.5 rounded bg-neutral-800 hover:bg-sky-950/70 border border-neutral-700 hover:border-sky-500/50 text-neutral-300 hover:text-sky-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Set model Z depth to +2cm forward of marker face"
                    >
                      <span className="material-symbols-outlined text-xs text-sky-400">arrow_upward</span>
                      Float +2cm
                    </button>
                    <button
                      type="button"
                      onClick={fitModelToMarkerBounds}
                      className="p-1.5 rounded bg-neutral-800 hover:bg-purple-950/70 border border-neutral-700 hover:border-purple-500/50 text-neutral-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Scale model proportionally to fit inside marker bounds"
                    >
                      <span className="material-symbols-outlined text-xs text-purple-400">fit_screen</span>
                      Fit Bounds
                    </button>
                    <button
                      type="button"
                      onClick={frameCameraToMarker}
                      className="p-1.5 rounded bg-neutral-800 hover:bg-indigo-950/70 border border-neutral-700 hover:border-indigo-500/50 text-neutral-300 hover:text-indigo-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      title="Align camera directly perpendicular to marker face"
                    >
                      <span className="material-symbols-outlined text-xs text-indigo-400">crop_free</span>
                      Frame Face
                    </button>
                  </div>

                  {/* Marker Image Upload & Reset */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                    <input
                      type="file"
                      ref={markerFileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCustomMarkerUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => markerFileInputRef.current?.click()}
                      className="flex-1 py-1.5 px-2 bg-neutral-800 hover:bg-emerald-900/60 text-neutral-200 hover:text-emerald-200 border border-neutral-700 hover:border-emerald-500/50 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                    >
                      <span className="material-symbols-outlined text-xs">file_upload</span>
                      Upload Custom Marker Artwork
                    </button>
                    <button
                      type="button"
                      onClick={handleResetMarkerToDefault}
                      className="py-1.5 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700 rounded text-xs font-semibold transition-all"
                      title="Reset to procedural calibration marker"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Scope Selection Box */}
              <div className="p-3 bg-neutral-900/90 border border-cyan-500/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Tracking Scope Target
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {trackingScope === 'global' ? 'GLOBAL (ALL BATCHES)' : `BATCH: ${batchId || 'ACTIVE'}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setTrackingScope('batch')}
                    className={`py-2 px-3 rounded text-xs font-semibold flex flex-col items-center gap-1 transition-all ${trackingScope === 'batch'
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">bookmark</span>
                      Active Batch Only
                    </span>
                    <span className="text-[9px] font-normal opacity-80">
                      Apply to {batchId ? `"${batchId}"` : 'current batch'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackingScope('global')}
                    className={`py-2 px-3 rounded text-xs font-semibold flex flex-col items-center gap-1 transition-all ${trackingScope === 'global'
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">public</span>
                      Global (All Batches)
                    </span>
                    <span className="text-[9px] font-normal opacity-80">
                      System-wide default for all AR
                    </span>
                  </button>
                </div>

                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  {trackingScope === 'global'
                    ? '🌐 Global mode updates the system-wide tracking template and synchronizes all existing batches in Firestore so every phone experience immediately reflects these precision settings.'
                    : `🏷️ Batch mode customizes camera tracking parameters specifically for "${batchId || 'this batch'}". Other batches will continue using their respective configurations.`}
                </p>
              </div>

              {/* Quick Calibration Presets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">speed</span>
                    Calibration Presets
                  </h2>
                  <span className="text-[10px] font-mono text-neutral-500">1-Click Setup</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyTrackingPreset('balanced')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${activeTrackingPreset === 'balanced'
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                      : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 text-neutral-300'
                      }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>🎯 Balanced</span>
                      <span className="text-[9px] text-neutral-400 font-mono">Standard</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                      Optimal balance of jitter reduction and motion latency for WebAR.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTrackingPreset('smooth')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${activeTrackingPreset === 'smooth'
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                      : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 text-neutral-300'
                      }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>🧘 Ultra Smooth</span>
                      <span className="text-[9px] text-emerald-400 font-mono">Anti-Jitter</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                      Max stabilization; eliminates micro-shakes for stationary viewing.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTrackingPreset('fast')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${activeTrackingPreset === 'fast'
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                      : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 text-neutral-300'
                      }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>⚡ High Speed</span>
                      <span className="text-[9px] text-amber-400 font-mono">Low-Lag</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                      Instantaneous response during rapid handheld camera movement.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTrackingPreset('resilient')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${activeTrackingPreset === 'resilient'
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                      : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 text-neutral-300'
                      }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>🛡️ Resilient</span>
                      <span className="text-[9px] text-purple-400 font-mono">Rock Solid</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                      Maintains anchor lock through heavy hand occlusion & motion blur.
                    </p>
                  </button>
                </div>
              </div>

              {/* Precision OneEuroFilter Controls */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">filter_alt</span>
                    Jitter Filter & Motion Smoothing (1€ Filter)
                  </h2>
                </div>

                <NumberSliderInput
                  label="Filter Cutoff Frequency (filterMinCF)"
                  value={trackingFilterMinCF}
                  onChange={(val) => {
                    setTrackingFilterMinCF(val);
                    setActiveTrackingPreset('custom');
                  }}
                  min={0.00001}
                  max={0.02}
                  step={0.0001}
                  color="cyan"
                  precision={5}
                  resetValue={0.0005}
                  showRange={true}
                  description="Minimum cutoff frequency for OneEuroFilter. Lower value = suppresses hand tremor & jitter at low velocities."
                />

                <NumberSliderInput
                  label="Speed Coefficient Beta (filterBeta)"
                  value={trackingFilterBeta}
                  onChange={(val) => {
                    setTrackingFilterBeta(val);
                    setActiveTrackingPreset('custom');
                  }}
                  min={0.001}
                  max={1.0}
                  step={0.005}
                  color="cyan"
                  precision={3}
                  resetValue={0.01}
                  showRange={true}
                  description="Velocity coefficient for OneEuroFilter. Higher value = eliminates tracking lag during swift camera sweeps."
                />
              </div>

              {/* Lock-On & Tracking Stability */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">lock</span>
                    Lock-On & Occlusion Tolerances
                  </h2>
                </div>

                <NumberSliderInput
                  label="Miss Tolerance (Frames)"
                  value={trackingMissTolerance}
                  onChange={(val) => {
                    setTrackingMissTolerance(val);
                    setActiveTrackingPreset('custom');
                  }}
                  min={1}
                  max={30}
                  step={1}
                  unit=" f"
                  color="cyan"
                  precision={0}
                  resetValue={6}
                  showRange={true}
                  description="Consecutive missed frames before target is dropped. Higher values prevent 3D model flickering during momentary occlusion."
                />

                <NumberSliderInput
                  label="Warmup Tolerance (Frames)"
                  value={trackingWarmupTolerance}
                  onChange={(val) => {
                    setTrackingWarmupTolerance(val);
                    setActiveTrackingPreset('custom');
                  }}
                  min={0}
                  max={10}
                  step={1}
                  unit=" f"
                  color="cyan"
                  precision={0}
                  resetValue={2}
                  showRange={true}
                  description="Consecutive detected frames required to lock onto marker. Lower = instantaneous lock; Higher = eliminates false positives."
                />
              </div>

              {/* Target Index & Concurrency */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">crop_free</span>
                    Target Index & Concurrency
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberSliderInput
                    label="Max Tracked Targets"
                    value={trackingMaxTrack}
                    onChange={(val) => {
                      setTrackingMaxTrack(val);
                      setActiveTrackingPreset('custom');
                    }}
                    min={1}
                    max={5}
                    step={1}
                    color="cyan"
                    precision={0}
                    resetValue={1}
                    showRange={false}
                    description="Number of target markers MindAR will track simultaneously."
                  />

                  <NumberSliderInput
                    label="Target Index"
                    value={trackingTargetIndex}
                    onChange={(val) => {
                      setTrackingTargetIndex(val);
                      setActiveTrackingPreset('custom');
                    }}
                    min={0}
                    max={5}
                    step={1}
                    color="cyan"
                    precision={0}
                    resetValue={0}
                    showRange={false}
                    description="Target anchor index inside the .mind marker file (0 for primary garment target)."
                  />
                </div>
              </div>

              {/* UI Diagnostics & HUD Overlays */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">bug_report</span>
                    Diagnostics & Native HUD Overlays
                  </h2>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-300">Live FPS / Performance HUD</span>
                      <span className="text-[10px] text-neutral-500">Displays real-time FPS, frame latency, and ML memory stats</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={trackingShowStats}
                      onChange={(e) => setTrackingShowStats(e.target.checked)}
                      className="w-5 h-5 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-300">MindAR Native Scanner HUD</span>
                      <span className="text-[10px] text-neutral-500">Show MindAR's built-in scanning frame overlay</span>
                    </div>
                    <select
                      value={trackingUiScanning}
                      onChange={(e) => setTrackingUiScanning(e.target.value)}
                      className="px-2.5 py-1 bg-black border border-neutral-700 rounded text-xs font-mono text-cyan-300 focus:outline-none"
                    >
                      <option value="no">Disabled (App Custom HUD)</option>
                      <option value="yes">Enabled (Native Overlay)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-300">MindAR Native Error Modal</span>
                      <span className="text-[10px] text-neutral-500">Display browser incompatibility modal if camera fails</span>
                    </div>
                    <select
                      value={trackingUiError}
                      onChange={(e) => setTrackingUiError(e.target.value)}
                      className="px-2.5 py-1 bg-black border border-neutral-700 rounded text-xs font-mono text-cyan-300 focus:outline-none"
                    >
                      <option value="yes">Enabled (Show Errors)</option>
                      <option value="no">Disabled (Silent)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dedicated Save Tracking Button & Status */}
              <div className="pt-3 border-t border-neutral-800/80 space-y-2">
                <button
                  type="button"
                  disabled={savingTracking}
                  onClick={() => handleSaveTracking()}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {savingTracking ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Saving Tracking Configuration...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">save</span>
                      <span>
                        Save Tracking Settings ({trackingScope === 'global' ? 'Global for ALL' : `Batch: ${batchId || 'Active'}`})
                      </span>
                    </>
                  )}
                </button>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: AR PORTAL & VIRTUAL WINDOW EFFECT CONTROLS                          */}
          {/* ========================================================================= */}
          {activeTab === 'portal' && (
            <div className="space-y-6">
              {/* Master Portal Engine Switch & Overview */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-sky-950/40 via-neutral-900 to-indigo-950/30 border border-sky-500/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${portalEnabled ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/30 animate-pulse' : 'bg-neutral-800 text-neutral-400'}`}>
                      <span className="material-symbols-outlined text-lg">meeting_room</span>
                    </div>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        AR Portal Effect
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${portalEnabled ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-neutral-800 text-neutral-400'}`}>
                          {portalEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </h2>
                      <p className="text-[10px] text-neutral-400">Virtual window into an alternate dimension</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={portalEnabled}
                      onChange={(e) => handleTogglePortal(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                <div className="text-[11px] text-neutral-300 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-neutral-800/80 space-y-1">
                  <p>
                    <span className="font-semibold text-sky-300">How it works:</span> An optical illusion aperture mask uses GPU stencil occlusion so the interior world is only visible through the window frame. Stepping or orbiting the camera inside immerses the viewer into the 360 world.
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-neutral-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={portalHideOutsideModel}
                        onChange={(e) => setPortalHideOutsideModel(e.target.checked)}
                        className="rounded border-neutral-700 bg-neutral-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Hide Outside Model (Isolate Portal Only)</span>
                    </label>
                  </div>
                </div>

                {/* Scene Addition Mode Card when a 3D model is loaded in the scene */}
                {Boolean(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
                  <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-sky-400">layers</span>
                        <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wide">
                          Scene Addition Mode
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {portalEnabled ? (portalHideOutsideModel ? 'PORTAL ONLY' : 'ADDED ALONGSIDE MODEL') : 'READY TO ADD'}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-300 leading-snug">
                      Portal renders inside your active scene alongside your 3D model. Choose a quick placement to position the virtual window relative to your model:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('behind')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosZ < -0.3 && Math.abs(portalPosX) < 0.2 && !portalHideOutsideModel) ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">window</span>
                        Behind Model
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('left')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX < -0.4 && !portalHideOutsideModel) ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">arrow_left_alt</span>
                        Left Gateway
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('right')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX > 0.4 && !portalHideOutsideModel) ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">arrow_right_alt</span>
                        Right Gateway
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('ground')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalRotX === -90 && !portalHideOutsideModel) ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">adjust</span>
                        Ground Dais
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('center')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX === 0 && portalPosY === 0 && portalPosZ === 0 && !portalHideOutsideModel) ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">center_focus_strong</span>
                        Centered
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPortalPlacementPreset('inside')}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalHideOutsideModel && portalModelType === 'current-product') ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30' : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700'}`}
                      >
                        <span className="material-symbols-outlined text-xs">inbox</span>
                        Inside Chamber
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 1-Click Curated Presets Strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sky-400">auto_awesome</span>
                    1-Click Portal Presets
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-mono">Quick Themes</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { key: 'cosmic-nebula', label: 'Cosmic Nebula', icon: 'filter_drama', color: 'border-sky-500/50 text-sky-300 bg-sky-950/30' },
                    { key: 'cyber-matrix', label: 'Cyber Matrix', icon: 'grid_view', color: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30' },
                    { key: 'virtual-window', label: 'Virtual Window', icon: 'window', color: 'border-slate-500/50 text-slate-300 bg-slate-900/40' },
                    { key: 'luxury-gallery', label: 'Luxury Gallery', icon: 'museum', color: 'border-amber-500/50 text-amber-300 bg-amber-950/30' },
                    { key: 'stargate-ring', label: 'Sci-Fi Stargate', icon: 'cyclone', color: 'border-purple-500/50 text-purple-300 bg-purple-950/30' }
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleApplyPresetWithSceneCheck(preset.key)}
                      className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all hover:scale-[1.02] active:scale-[0.98] ${portalPreset === preset.key
                        ? `${preset.color} font-bold shadow-md`
                        : 'bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">{preset.icon}</span>
                        <span className="text-[11px] truncate">{preset.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 1: Window Aperture & 3D Frame */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">crop_portrait</span>
                    Window Aperture & Frame
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-mono">Shape & Casing</span>
                </div>

                {/* Shape Selector */}
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-black/60 rounded border border-neutral-800 text-xs">
                  {[
                    { id: 'arch', label: 'Arch Gate', icon: 'door_front' },
                    { id: 'rectangle', label: 'Window', icon: 'crop_square' },
                    { id: 'circle', label: 'Stargate', icon: 'lens' },
                    { id: 'hexagon', label: 'Hex Gate', icon: 'hexagon' }
                  ].map((shapeOption) => (
                    <button
                      key={shapeOption.id}
                      type="button"
                      onClick={() => setPortalShape(shapeOption.id)}
                      className={`py-1.5 rounded flex flex-col items-center justify-center gap-0.5 transition-colors ${portalShape === shapeOption.id
                        ? 'bg-neutral-800 text-sky-400 font-bold border border-sky-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">{shapeOption.icon}</span>
                      <span className="text-[10px]">{shapeOption.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-2">
                  {(portalShape === 'arch' || portalShape === 'rectangle') ? (
                    <>
                      <NumberSliderInput
                        label="Window Width"
                        value={portalWidth}
                        onChange={setPortalWidth}
                        min={0.3}
                        max={3.5}
                        step={0.05}
                        unit="m"
                        color="sky"
                        precision={2}
                        resetValue={1.1}
                        showRange={true}
                      />
                      <NumberSliderInput
                        label="Window Height"
                        value={portalHeight}
                        onChange={setPortalHeight}
                        min={0.4}
                        max={4.0}
                        step={0.05}
                        unit="m"
                        color="sky"
                        precision={2}
                        resetValue={1.8}
                        showRange={true}
                      />
                    </>
                  ) : (
                    <NumberSliderInput
                      label="Portal Radius"
                      value={portalRadius}
                      onChange={setPortalRadius}
                      min={0.2}
                      max={2.5}
                      step={0.05}
                      unit="m"
                      color="sky"
                      precision={2}
                      resetValue={0.7}
                      showRange={true}
                    />
                  )}

                  <NumberSliderInput
                    label="Chamber Depth"
                    value={portalDepth}
                    onChange={setPortalDepth}
                    min={1.0}
                    max={10.0}
                    step={0.2}
                    unit="m"
                    color="sky"
                    precision={1}
                    resetValue={3.5}
                    showRange={true}
                    description="How far back the interior room/dimension extends behind the portal window."
                  />
                  <NumberSliderInput
                    label="Frame Width"
                    value={portalFrameWidth}
                    onChange={setPortalFrameWidth}
                    min={0.02}
                    max={0.25}
                    step={0.01}
                    unit="m"
                    color="sky"
                    precision={2}
                    resetValue={0.08}
                    showRange={true}
                  />
                </div>

                {/* Frame Colors & Glow */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Frame Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={portalFrameColor}
                        onChange={(e) => setPortalFrameColor(e.target.value)}
                        className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={portalFrameColor}
                        onChange={(e) => setPortalFrameColor(e.target.value)}
                        className="w-20 px-1.5 py-1 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Emissive Glow Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={portalFrameEmissive}
                        onChange={(e) => setPortalFrameEmissive(e.target.value)}
                        className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={portalFrameEmissive}
                        onChange={(e) => setPortalFrameEmissive(e.target.value)}
                        className="w-20 px-1.5 py-1 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 pt-1 flex items-center justify-between">
                    <NumberSliderInput
                      label="Glow Intensity"
                      value={portalFrameEmissiveIntensity}
                      onChange={setPortalFrameEmissiveIntensity}
                      min={0}
                      max={5.0}
                      step={0.1}
                      color="sky"
                      precision={1}
                      resetValue={1.5}
                      showRange={true}
                    />
                  </div>

                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-neutral-800 text-xs">
                    <span className="text-neutral-400">Outer Neon Halo Glow</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={portalFrameGlow}
                        onChange={(e) => setPortalFrameGlow(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2: Portal 3D Transform Placement */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-400">open_with</span>
                    Portal Placement & Orientation
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleApplyPortalPlacementPreset('center')}
                    className="text-[10px] font-mono text-neutral-400 hover:text-amber-300"
                  >
                    Reset Origin
                  </button>
                </div>

                {/* Quick Scene Placement Presets */}
                <div className="space-y-1 bg-black/40 p-2 rounded-lg border border-neutral-800/80">
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                    <span>Scene Placement Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('center')}
                      className="text-neutral-400 hover:text-amber-300"
                    >
                      (0,0,0)
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('behind')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosZ < -0.3 && Math.abs(portalPosX) < 0.2) ? 'bg-sky-600/30 text-sky-200 border-sky-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Position virtual window behind the model"
                    >
                      <span className="material-symbols-outlined text-[11px]">window</span>
                      Behind Model
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('left')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX < -0.4) ? 'bg-sky-600/30 text-sky-200 border-sky-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Position portal gateway on the left side of the scene"
                    >
                      <span className="material-symbols-outlined text-[11px]">arrow_left_alt</span>
                      Left Gateway
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('right')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX > 0.4) ? 'bg-sky-600/30 text-sky-200 border-sky-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Position portal gateway on the right side of the scene"
                    >
                      <span className="material-symbols-outlined text-[11px]">arrow_right_alt</span>
                      Right Gateway
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('ground')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalRotX === -90) ? 'bg-sky-600/30 text-sky-200 border-sky-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Position portal on ground beneath model"
                    >
                      <span className="material-symbols-outlined text-[11px]">adjust</span>
                      Ground Dais
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('center')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalPosX === 0 && portalPosY === 0 && portalPosZ === 0 && !portalHideOutsideModel) ? 'bg-sky-600/30 text-sky-200 border-sky-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Centered at origin"
                    >
                      <span className="material-symbols-outlined text-[11px]">center_focus_strong</span>
                      Centered
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPortalPlacementPreset('inside')}
                      className={`px-1.5 py-1 rounded text-[10px] font-semibold border flex items-center justify-center gap-1 transition-all ${(portalHideOutsideModel && portalModelType === 'current-product') ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400' : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'}`}
                      title="Enclose the batch model inside the portal chamber"
                    >
                      <span className="material-symbols-outlined text-[11px]">inbox</span>
                      Inside Chamber
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <NumberSliderInput
                    label="Position X"
                    value={portalPosX}
                    onChange={setPortalPosX}
                    min={-3.0}
                    max={3.0}
                    step={0.05}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0}
                    showRange={false}
                  />
                  <NumberSliderInput
                    label="Position Y"
                    value={portalPosY}
                    onChange={setPortalPosY}
                    min={-3.0}
                    max={3.0}
                    step={0.05}
                    unit="m"
                    color="emerald"
                    precision={2}
                    resetValue={0}
                    showRange={false}
                  />
                  <NumberSliderInput
                    label="Position Z"
                    value={portalPosZ}
                    onChange={setPortalPosZ}
                    min={-3.0}
                    max={3.0}
                    step={0.05}
                    unit="m"
                    color="sky"
                    precision={2}
                    resetValue={0}
                    showRange={false}
                  />
                </div>

                <div className="space-y-2">
                  <RotationDial
                    axis="X"
                    angle={portalRotX}
                    onChange={setPortalRotX}
                    color="rose"
                    description="Pitch (Tilt Front/Back)"
                  />
                  <RotationDial
                    axis="Y"
                    angle={portalRotY}
                    onChange={setPortalRotY}
                    color="emerald"
                    description="Yaw (Turn Left/Right)"
                  />
                  <RotationDial
                    axis="Z"
                    angle={portalRotZ}
                    onChange={setPortalRotZ}
                    color="sky"
                    description="Roll (Tilt Sideways)"
                  />
                </div>
              </div>

              {/* Section 3: Interior World Environment (What goes in the portal) */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-purple-400">public</span>
                    Interior World Environment
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-mono">Chamber Atmosphere</span>
                </div>

                {/* Interior Type Buttons */}
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/60 rounded border border-neutral-800 text-xs">
                  {[
                    { id: 'nebula', label: 'Cosmic Nebula' },
                    { id: 'grid-room', label: 'Cyber Grid' },
                    { id: 'starfield', label: 'Starfield' },
                    { id: 'matrix', label: 'Matrix Void' },
                    { id: 'skybox', label: '360° Photo' },
                    { id: 'void', label: 'Smooth Void' }
                  ].map((envOption) => (
                    <button
                      key={envOption.id}
                      type="button"
                      onClick={() => setPortalInteriorType(envOption.id)}
                      className={`py-1 rounded text-center transition-colors text-[11px] ${portalInteriorType === envOption.id
                        ? 'bg-neutral-800 text-purple-300 font-bold border border-purple-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                      {envOption.label}
                    </button>
                  ))}
                </div>

                {/* 360 Photosphere Custom URL & Upload */}
                {portalInteriorType === 'skybox' && (
                  <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-2.5">
                    <span className="text-xs font-semibold text-neutral-200">360° Panorama Image (Equirectangular)</span>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Paste 360 photosphere image URL..."
                        value={portalSkyboxUrl}
                        onChange={(e) => setPortalSkyboxUrl(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-black/60 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500"
                      />
                      {portalSkyboxUrl && (
                        <button
                          type="button"
                          onClick={() => setPortalSkyboxUrl('')}
                          className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800 rounded"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-neutral-500">Presets:</span>
                      {[
                        { name: 'Space', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2000&q=80' },
                        { name: 'Milky Way', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?auto=format&fit=crop&w=2000&q=80' },
                        { name: 'Sunset', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80' }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setPortalSkyboxUrl(preset.url)}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1">
                      <label className="w-full py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer">
                        <span className="material-symbols-outlined text-sm text-sky-400">upload_file</span>
                        <span>{selectedPortalSkyboxFile ? selectedPortalSkyboxFile.name : 'Upload Local 360° Image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedPortalSkyboxFile(file);
                              const blobUrl = URL.createObjectURL(file);
                              setPortalSkyboxUrl(blobUrl);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Panorama Size & 3D Placement Controls */}
                    <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">open_with</span>
                          Resize & Move Panorama Image
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPortalSkyboxScale(1.0);
                            setPortalSkyboxPosX(0.0);
                            setPortalSkyboxPosY(0.0);
                            setPortalSkyboxPosZ(0.0);
                            setPortalSkyboxRotX(0);
                            setPortalSkyboxRotY(0);
                            setPortalSkyboxRotZ(0);
                            setPortalSkyboxBlur(0);
                          }}
                          className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-800/80 rounded"
                          title="Reset Panorama to default scale and center position"
                        >
                          <span className="material-symbols-outlined text-[11px]">restart_alt</span> Reset
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <NumberSliderInput
                          label="Panorama Scale"
                          value={portalSkyboxScale}
                          onChange={setPortalSkyboxScale}
                          min={0.2}
                          max={4.0}
                          step={0.05}
                          color="sky"
                          precision={2}
                          resetValue={1.0}
                          showRange={true}
                        />
                        <NumberSliderInput
                          label="Rotate Yaw (Y)"
                          value={portalSkyboxRotY}
                          onChange={setPortalSkyboxRotY}
                          min={0}
                          max={360}
                          step={1}
                          unit="°"
                          color="sky"
                          precision={0}
                          resetValue={0}
                          showRange={true}
                        />
                      </div>

                      {/* Gaussian Blur Control */}
                      <div className="p-2.5 bg-neutral-900/90 rounded-lg border border-sky-500/30 shadow-inner">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-sky-400">blur_on</span>
                            360 Environment Gaussian Blur
                          </span>
                          <span className="text-[10px] font-mono text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800/50">
                            {portalSkyboxBlur > 0 ? `${portalSkyboxBlur}px Blur` : 'Sharp (0px)'}
                          </span>
                        </div>
                        <NumberSliderInput
                          label="Gaussian Blur Amount"
                          value={portalSkyboxBlur}
                          onChange={setPortalSkyboxBlur}
                          min={0}
                          max={20}
                          step={0.5}
                          unit="px"
                          color="sky"
                          precision={1}
                          resetValue={0}
                          showRange={true}
                        />
                        <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                          Diffuses the 360 photo background to give depth-of-field separation for interior models & holographic video screens.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <NumberSliderInput
                          label="Pos X (Left/Right)"
                          value={portalSkyboxPosX}
                          onChange={setPortalSkyboxPosX}
                          min={-6.0}
                          max={6.0}
                          step={0.1}
                          unit="m"
                          color="sky"
                          precision={1}
                          resetValue={0.0}
                          showRange={true}
                        />
                        <NumberSliderInput
                          label="Pos Y (Height)"
                          value={portalSkyboxPosY}
                          onChange={setPortalSkyboxPosY}
                          min={-6.0}
                          max={6.0}
                          step={0.1}
                          unit="m"
                          color="sky"
                          precision={1}
                          resetValue={0.0}
                          showRange={true}
                        />
                        <NumberSliderInput
                          label="Pos Z (Depth)"
                          value={portalSkyboxPosZ}
                          onChange={setPortalSkyboxPosZ}
                          min={-10.0}
                          max={10.0}
                          step={0.1}
                          unit="m"
                          color="sky"
                          precision={1}
                          resetValue={0.0}
                          showRange={true}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <NumberSliderInput
                          label="Tilt Pitch (X)"
                          value={portalSkyboxRotX}
                          onChange={setPortalSkyboxRotX}
                          min={-90}
                          max={90}
                          step={1}
                          unit="°"
                          color="sky"
                          precision={0}
                          resetValue={0}
                          showRange={true}
                        />
                        <NumberSliderInput
                          label="Roll (Z)"
                          value={portalSkyboxRotZ}
                          onChange={setPortalSkyboxRotZ}
                          min={-180}
                          max={180}
                          step={1}
                          unit="°"
                          color="sky"
                          precision={0}
                          resetValue={0}
                          showRange={true}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Chamber Environment Colors */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Chamber Wall Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={portalWallColor}
                        onChange={(e) => setPortalWallColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={portalWallColor}
                        onChange={(e) => setPortalWallColor(e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Chamber Floor Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={portalFloorColor}
                        onChange={(e) => setPortalFloorColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={portalFloorColor}
                        onChange={(e) => setPortalFloorColor(e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>

                  {(portalInteriorType === 'grid-room' || portalInteriorType === 'matrix') && (
                    <div className="col-span-2 pt-1 flex items-center justify-between border-t border-neutral-800/80">
                      <span className="text-[11px] font-semibold text-neutral-300">Grid Line Accent Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={portalGridColor}
                          onChange={(e) => setPortalGridColor(e.target.value)}
                          className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs font-mono text-neutral-400">{portalGridColor}</span>
                      </div>
                    </div>
                  )}

                  <div className="col-span-2 pt-1 flex items-center justify-between border-t border-neutral-800/80">
                    <span className="text-[11px] font-semibold text-neutral-300">Interior Light Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={portalLightColor}
                        onChange={(e) => setPortalLightColor(e.target.value)}
                        className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-xs font-mono text-neutral-400">{portalLightColor}</span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <NumberSliderInput
                      label="Interior Light Intensity"
                      value={portalLightIntensity}
                      onChange={setPortalLightIntensity}
                      min={0}
                      max={6.0}
                      step={0.1}
                      color="purple"
                      precision={1}
                      resetValue={2.0}
                      showRange={true}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Interior 3D Content & Objects (What goes inside the portal) */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">token</span>
                    Interior 3D Content & Objects
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-mono">Inside Portal</span>
                </div>

                {/* Content Type Selector */}
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-black/60 rounded border border-neutral-800 text-xs">
                  {[
                    { id: 'artifact', label: '3D Artifact', icon: 'diamond' },
                    { id: 'current-product', label: 'Batch Model', icon: 'view_in_ar' },
                    { id: 'custom-glb', label: 'Custom GLB', icon: 'folder_zip' },
                    { id: 'none', label: 'None', icon: 'block' }
                  ].map((mType) => (
                    <button
                      key={mType.id}
                      type="button"
                      onClick={() => setPortalModelType(mType.id)}
                      className={`py-1.5 rounded flex flex-col items-center justify-center gap-0.5 transition-colors ${portalModelType === mType.id
                        ? 'bg-neutral-800 text-emerald-400 font-bold border border-emerald-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">{mType.icon}</span>
                      <span className="text-[10px]">{mType.label}</span>
                    </button>
                  ))}
                </div>

                {/* Artifact Choice */}
                {portalModelType === 'artifact' && (
                  <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-2">
                    <span className="text-xs font-semibold text-neutral-200">Select Procedural 3D Artifact:</span>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { id: 'crystal', label: 'Iridescent Crystal', icon: 'diamond' },
                        { id: 'cyber-core', label: 'Gyroscopic Cyber Core', icon: 'blur_on' },
                        { id: 'star-emblem', label: '3D Star Emblem', icon: 'star' },
                        { id: 'pedestal', label: 'Hovering Relic Dais', icon: 'account_balance' }
                      ].map((art) => (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => setPortalArtifactType(art.id)}
                          className={`p-2 rounded border text-left flex items-center gap-2 transition-colors ${portalArtifactType === art.id
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold'
                            : 'bg-black/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">{art.icon}</span>
                          <span className="text-[11px] truncate">{art.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom GLB URL & File Upload */}
                {portalModelType === 'custom-glb' && (
                  <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-2.5">
                    <span className="text-xs font-semibold text-neutral-200">Custom Secondary .glb Model URL:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="https://.../model.glb"
                        value={portalCustomModelUrl}
                        onChange={(e) => setPortalCustomModelUrl(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-black/60 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 font-mono"
                      />
                      {portalCustomModelUrl && (
                        <button
                          type="button"
                          onClick={() => setPortalCustomModelUrl('')}
                          className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800 rounded"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="w-full py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer">
                        <span className="material-symbols-outlined text-sm text-emerald-400">upload</span>
                        <span>{selectedPortalGlbFile ? selectedPortalGlbFile.name : 'Upload .glb for Inside Portal'}</span>
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedPortalGlbFile(file);
                              const blobUrl = URL.createObjectURL(file);
                              setPortalCustomModelUrl(blobUrl);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Transform of Model Inside Portal */}
                {portalModelType !== 'none' && (
                  <div className="space-y-2 p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800">
                    <span className="text-xs font-semibold text-neutral-300">Model Transform Inside Portal:</span>

                    <div className="grid grid-cols-2 gap-2">
                      <NumberSliderInput
                        label="Object Scale"
                        value={portalModelScale}
                        onChange={setPortalModelScale}
                        min={0.05}
                        max={2.0}
                        step={0.02}
                        color="emerald"
                        precision={2}
                        resetValue={0.4}
                        showRange={true}
                      />
                      <NumberSliderInput
                        label="Depth into Portal (Z)"
                        value={portalModelPosZ}
                        onChange={setPortalModelPosZ}
                        min={-portalDepth}
                        max={-0.1}
                        step={0.05}
                        unit="m"
                        color="emerald"
                        precision={2}
                        resetValue={-1.3}
                        showRange={true}
                        description="Negative Z moves the object deeper inside the portal chamber."
                      />
                      <NumberSliderInput
                        label="Offset X"
                        value={portalModelPosX}
                        onChange={setPortalModelPosX}
                        min={-1.5}
                        max={1.5}
                        step={0.05}
                        unit="m"
                        color="emerald"
                        precision={2}
                        resetValue={0}
                        showRange={false}
                      />
                      <NumberSliderInput
                        label="Offset Y"
                        value={portalModelPosY}
                        onChange={setPortalModelPosY}
                        min={-1.5}
                        max={1.5}
                        step={0.05}
                        unit="m"
                        color="emerald"
                        precision={2}
                        resetValue={0}
                        showRange={false}
                      />
                    </div>

                    <div className="pt-1">
                      <NumberSliderInput
                        label="Auto-Spin Speed"
                        value={portalModelRotSpeed}
                        onChange={setPortalModelRotSpeed}
                        min={0}
                        max={20000}
                        step={500}
                        unit="ms"
                        color="emerald"
                        precision={0}
                        resetValue={6000}
                        showRange={true}
                        description="Duration per revolution. 0 = stationary."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Floating Video Screen Inside Portal */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sky-400">videocam</span>
                    Interior Video Screen
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={portalShowVideo}
                      onChange={(e) => setPortalShowVideo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {portalShowVideo && (
                  <div className="p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800 space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-neutral-300">Screen Video URL:</span>
                        {(() => {
                          const effUrl = (portalVideoUrl || activeVideoUrl || '').trim();
                          if (effUrl && isYouTubeUrl(effUrl)) {
                            const ytId = extractYouTubeId(effUrl);
                            return (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-950/60 border border-red-700/50 text-red-300 font-mono">
                                <span className="material-symbols-outlined text-[12px] text-red-400">smart_display</span>
                                YouTube: {ytId}
                              </span>
                            );
                          }
                          if (effUrl) {
                            return (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-950/60 border border-sky-700/50 text-sky-300 font-mono truncate max-w-[140px]">
                                <span className="material-symbols-outlined text-[12px] text-sky-400">videocam</span>
                                Direct Video
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <input
                        type="text"
                        placeholder={activeVideoUrl ? `Leave blank for scene video: ${activeVideoUrl.slice(0, 30)}...` : "Enter YouTube or direct video URL"}
                        value={portalVideoUrl}
                        onChange={(e) => setPortalVideoUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-black/60 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <NumberSliderInput
                        label="Screen Scale"
                        value={portalVideoScale}
                        onChange={setPortalVideoScale}
                        min={0.2}
                        max={2.5}
                        step={0.05}
                        color="sky"
                        precision={2}
                        resetValue={1.0}
                        showRange={true}
                      />
                      <NumberSliderInput
                        label="Height (Y)"
                        value={portalVideoPosY}
                        onChange={setPortalVideoPosY}
                        min={-Math.max(0.5, portalHeight / 2)}
                        max={Math.max(0.5, portalHeight / 2)}
                        step={0.05}
                        unit="m"
                        color="sky"
                        precision={2}
                        resetValue={0.0}
                        showRange={true}
                      />
                      <NumberSliderInput
                        label="Depth (Z)"
                        value={portalVideoPosZ}
                        onChange={setPortalVideoPosZ}
                        min={-portalDepth}
                        max={-0.2}
                        step={0.1}
                        unit="m"
                        color="sky"
                        precision={1}
                        resetValue={-1.8}
                        showRange={true}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 6: Interior Particle FX & Floating Text */}
              <div className="space-y-3 pt-1 border-t border-neutral-800/80">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-400">grain</span>
                    Atmospheric Particles & Hologram Text
                  </h3>
                </div>

                {/* Particles */}
                <div className="p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300">Particle FX Type:</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      {['stars', 'cyber', 'embers', 'none'].map((pType) => (
                        <button
                          key={pType}
                          type="button"
                          onClick={() => setPortalParticles(pType)}
                          className={`px-2 py-0.5 rounded capitalize transition-colors ${portalParticles === pType
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                          {pType}
                        </button>
                      ))}
                    </div>
                  </div>

                  {portalParticles !== 'none' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <NumberSliderInput
                        label="Particle Count"
                        value={portalParticleCount}
                        onChange={setPortalParticleCount}
                        min={20}
                        max={400}
                        step={10}
                        color="amber"
                        precision={0}
                        resetValue={180}
                        showRange={true}
                      />
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-neutral-300">Particle Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={portalParticleColor}
                            onChange={(e) => setPortalParticleColor(e.target.value)}
                            className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                          />
                          <span className="text-xs font-mono text-neutral-400">{portalParticleColor}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating 3D Text Banner */}
                <div className="p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800 space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-neutral-300">Holographic 3D Text Banner:</span>
                    <input
                      type="text"
                      placeholder="e.g. STAR weAR or custom message"
                      value={portalFloatingText}
                      onChange={(e) => setPortalFloatingText(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-black/60 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500"
                    />
                  </div>

                  {portalFloatingText && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <NumberSliderInput
                        label="Text Scale"
                        value={portalTextScale}
                        onChange={setPortalTextScale}
                        min={0.3}
                        max={2.0}
                        step={0.05}
                        color="sky"
                        precision={2}
                        resetValue={1.0}
                        showRange={true}
                      />
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-neutral-300">Text Glow Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={portalTextColor}
                            onChange={(e) => setPortalTextColor(e.target.value)}
                            className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                          />
                          <span className="text-xs font-mono text-neutral-400">{portalTextColor}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dedicated Save Portal Configuration Button */}
              <div className="pt-3 border-t border-neutral-800/80 space-y-2">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg shadow-sky-500/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{savingConfig ? 'Saving Portal Configuration...' : `Save Portal to Batch (${batchId || 'Active'})`}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: SCENE PARTICLE SYSTEM CONTROLS                                       */}
          {/* ========================================================================= */}
          {activeTab === 'particles' && (
            <div className="space-y-4">
              {/* Header Card & Master Switch */}
              <div className="p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                      <span className="material-symbols-outlined text-lg">flare</span>
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        Scene Particle System
                        {particleSystemEnabled && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-semibold">
                            ACTIVE
                          </span>
                        )}
                      </h2>
                      <p className="text-[10px] text-neutral-400">Atmospheric 3D particles & visual FX for the scene</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={particleSystemEnabled}
                      onChange={(e) => setParticleSystemEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </label>
                </div>
              </div>

              {/* 1-Click Particle Style Presets */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-400">auto_awesome</span>
                    Atmospheric Presets
                  </span>
                  <span className="text-[10px] text-neutral-500">1-click styles</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(PARTICLE_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (!particleSystemEnabled) setParticleSystemEnabled(true);
                        applyParticlePreset(key);
                      }}
                      className={`p-2 rounded-lg text-left transition-all border flex items-center gap-2 ${particlePreset === key && particleSystemEnabled
                        ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-sm'
                        : 'bg-neutral-900/60 hover:bg-neutral-800 border-neutral-800/80 text-neutral-300'
                        }`}
                    >
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-white/10"
                        style={{ backgroundColor: `${p.color}25`, color: p.color }}
                      >
                        <span className="material-symbols-outlined text-sm">{p.icon || 'flare'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold truncate leading-tight">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }}></span>
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.colorSecondary }}></span>
                          <span className="text-[9px] text-neutral-400 capitalize truncate">{p.direction}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Particle Appearance & Density */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-400">palette</span>
                  Appearance & Colors
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Primary Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={particleColor}
                        onChange={(e) => setParticleColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={particleColor}
                        onChange={(e) => setParticleColor(e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Secondary Color (Gradient)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={particleColorSecondary}
                        onChange={(e) => setParticleColorSecondary(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={particleColorSecondary}
                        onChange={(e) => setParticleColorSecondary(e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-xs font-mono bg-black/60 border border-neutral-700 rounded text-neutral-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberSliderInput
                    label="Particle Count"
                    value={particleCount}
                    onChange={setParticleCount}
                    min={20}
                    max={1200}
                    step={20}
                    color="amber"
                    precision={0}
                    resetValue={300}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Particle Size"
                    value={particleSize}
                    onChange={setParticleSize}
                    min={0.01}
                    max={0.25}
                    step={0.005}
                    color="amber"
                    precision={3}
                    resetValue={0.04}
                    showRange={true}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberSliderInput
                    label="Opacity"
                    value={particleOpacity}
                    onChange={setParticleOpacity}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    color="amber"
                    precision={2}
                    resetValue={0.85}
                    showRange={true}
                  />
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-300">Blending Mode</span>
                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      {['additive', 'normal'].map((bMode) => (
                        <button
                          key={bMode}
                          type="button"
                          onClick={() => setParticleBlending(bMode)}
                          className={`py-1 rounded text-[10px] font-semibold capitalize border ${particleBlending === bMode
                            ? 'bg-amber-600/30 text-amber-200 border-amber-400'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                            }`}
                        >
                          {bMode === 'additive' ? '✨ Glowing' : 'Solid'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Particle Shape Selector */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-neutral-300">Particle Shape</span>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'sparkle', label: 'Sparkle', icon: 'auto_awesome' },
                      { id: 'circle', label: 'Glow Dot', icon: 'lens' },
                      { id: 'star', label: 'Star', icon: 'star' },
                      { id: 'diamond', label: 'Diamond', icon: 'square' },
                      { id: 'heart', label: 'Heart', icon: 'favorite' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setParticleShape(s.id)}
                        className={`py-1.5 px-1 rounded flex flex-col items-center justify-center gap-0.5 border text-center transition-all ${particleShape === s.id
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400 font-bold'
                          : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                          }`}
                        title={s.label}
                      >
                        <span className="material-symbols-outlined text-sm">{s.icon}</span>
                        <span className="text-[9px] truncate w-full">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Twinkle Toggle */}
                <div className="flex items-center justify-between p-2 bg-neutral-900/60 rounded-lg border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-amber-400">shutter_speed</span>
                    <div>
                      <span className="text-xs font-semibold text-neutral-200">Shimmering Twinkle</span>
                      <p className="text-[10px] text-neutral-400">Pulsing luminance oscillation</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={particleTwinkle}
                      onChange={(e) => setParticleTwinkle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              {/* Motion Dynamics & Movement */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-cyan-400">air</span>
                  Motion Dynamics & Direction
                </span>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-300">Flow Direction</span>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'float', label: 'Floating', icon: 'all_inclusive' },
                      { id: 'up', label: 'Rising', icon: 'north' },
                      { id: 'down', label: 'Falling', icon: 'south' },
                      { id: 'vortex', label: 'Vortex', icon: 'cyclone' },
                      { id: 'explode', label: 'Explode', icon: 'fullscreen' }
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setParticleDirection(d.id)}
                        className={`py-1.5 px-1 rounded flex flex-col items-center justify-center gap-0.5 border text-center transition-all ${particleDirection === d.id
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold'
                          : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                          }`}
                        title={d.label}
                      >
                        <span className="material-symbols-outlined text-sm">{d.icon}</span>
                        <span className="text-[9px] truncate w-full">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumberSliderInput
                    label="Animation Speed"
                    value={particleSpeed}
                    onChange={setParticleSpeed}
                    min={0.1}
                    max={4.0}
                    step={0.1}
                    unit="x"
                    color="cyan"
                    precision={1}
                    resetValue={1.0}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Field Rotation"
                    value={particleRotationSpeed}
                    onChange={setParticleRotationSpeed}
                    min={-1.5}
                    max={1.5}
                    step={0.05}
                    color="cyan"
                    precision={2}
                    resetValue={0.2}
                    showRange={true}
                  />
                </div>
              </div>

              {/* Spread Dimensions (Bounding Volume) */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-400">view_in_ar</span>
                  Volume Spread & Bounds
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <NumberSliderInput
                    label="Width (X)"
                    value={particleSpreadX}
                    onChange={setParticleSpreadX}
                    min={0.5}
                    max={8.0}
                    step={0.1}
                    unit="m"
                    color="emerald"
                    precision={1}
                    resetValue={3.0}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Height (Y)"
                    value={particleSpreadY}
                    onChange={setParticleSpreadY}
                    min={0.5}
                    max={8.0}
                    step={0.1}
                    unit="m"
                    color="emerald"
                    precision={1}
                    resetValue={3.0}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Depth (Z)"
                    value={particleSpreadZ}
                    onChange={setParticleSpreadZ}
                    min={0.5}
                    max={8.0}
                    step={0.1}
                    unit="m"
                    color="emerald"
                    precision={1}
                    resetValue={3.0}
                    showRange={true}
                  />
                </div>
              </div>

              {/* 3D Spatial Position Offset */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-400">open_with</span>
                    Center Position
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setParticlePosX(0.0);
                      setParticlePosY(0.0);
                      setParticlePosZ(0.0);
                    }}
                    className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-800/80 rounded"
                    title="Reset to center (0, 0, 0)"
                  >
                    <span className="material-symbols-outlined text-[11px]">restart_alt</span> Reset
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumberSliderInput
                    label="Pos X (Left/Right)"
                    value={particlePosX}
                    onChange={setParticlePosX}
                    min={-4.0}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0.0}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Pos Y (Height)"
                    value={particlePosY}
                    onChange={setParticlePosY}
                    min={-4.0}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0.0}
                    showRange={true}
                  />
                  <NumberSliderInput
                    label="Pos Z (Depth)"
                    value={particlePosZ}
                    onChange={setParticlePosZ}
                    min={-4.0}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0.0}
                    showRange={true}
                  />
                </div>
              </div>

              {/* Dedicated Save Particle Configuration Button */}
              <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold rounded-lg shadow-lg shadow-amber-500/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{savingConfig ? 'Saving Particle Configuration...' : `Save Particles to Batch (${batchId || 'Active'})`}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: LIVE INTERACTIVE 3D WEBSITE LAYER                                    */}
          {/* ========================================================================= */}
          {activeTab === 'website' && (
            <div className="space-y-5">
              {/* Master Live Website Layer Toggle & Intro */}
              <div className="p-3 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 rounded-xl border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-indigo-400">language</span>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white">Live 3D Website Layer</h2>
                      <p className="text-[10px] text-neutral-400">Interactive Web Browser Viewport in 3D & AR</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWebsiteEnabled(!websiteEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${websiteEnabled
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {websiteEnabled ? 'check_circle' : 'power_settings_new'}
                    </span>
                    <span>{websiteEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Project any interactive live website, store, documentation, or dashboard floating directly in 3D and AR space with synchronized CSS3D.
                </p>
              </div>

              {/* URL Input & Presets */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sky-400">link</span>
                    Website Target URL
                  </h3>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                    title="Open website in new browser tab"
                  >
                    <span>Open External</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 bg-black/60 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!websiteEnabled) setWebsiteEnabled(true);
                      const current = websiteUrl;
                      setWebsiteUrl('');
                      setTimeout(() => setWebsiteUrl(current), 50);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                    title="Reload website in 3D viewport"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    <span>Load</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Quick Presets</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Star weAR Store', url: 'https://starwear.app', icon: 'shopping_bag' },
                      { label: 'Three.js Visuals', url: 'https://threejs.org', icon: 'view_in_ar' },
                      { label: 'NASA Eyes 3D', url: 'https://eyes.nasa.gov', icon: 'public' },
                      { label: 'Wikipedia AR', url: 'https://en.m.wikipedia.org/wiki/Augmented_reality', icon: 'menu_book' }
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => {
                          setWebsiteUrl(preset.url);
                          if (!websiteEnabled) setWebsiteEnabled(true);
                        }}
                        className={`p-2 rounded-lg text-left text-[11px] font-semibold border transition-all flex items-center gap-2 cursor-pointer ${websiteUrl === preset.url
                          ? 'bg-indigo-950/80 border-indigo-500/80 text-indigo-300'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                          }`}
                      >
                        <span className="material-symbols-outlined text-sm text-indigo-400">{preset.icon}</span>
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactivity & Display Mode */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-400">touch_app</span>
                  Interactivity & Navigation
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWebsiteInteractive(true)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${websiteInteractive
                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-950/40'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-sm text-emerald-400">ads_click</span>
                      <span>Interactive</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
                      Clicks, scrolls & text input interact with the website inside the 3D scene.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebsiteInteractive(false)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${!websiteInteractive
                      ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-md shadow-amber-950/40'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className="material-symbols-outlined text-sm text-amber-400">orbit</span>
                      <span>Orbit Locked</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-snug">
                      Dragging on the screen orbits the 3D scene around the website display.
                    </p>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs font-medium text-neutral-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={websiteShowAddressBar}
                      onChange={(e) => setWebsiteShowAddressBar(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Show 3D Floating Address Bar</span>
                  </label>

                  <label className="text-xs font-medium text-neutral-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={websiteBillboard}
                      onChange={(e) => setWebsiteBillboard(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Billboard (Face Camera)</span>
                  </label>
                </div>
              </div>

              {/* Aspect Ratio & Resolution */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span className="material-symbols-outlined text-sm text-purple-400">aspect_ratio</span>
                  Aspect Ratio & Virtual Resolution
                </h3>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { key: '16:9', label: '16:9', desc: 'Landscape' },
                    { key: '4:3', label: '4:3', desc: 'Desktop' },
                    { key: '1:1', label: '1:1', desc: 'Square' },
                    { key: '9:16', label: '9:16', desc: 'Phone' },
                    { key: '21:9', label: '21:9', desc: 'Ultra' }
                  ].map((ratio) => (
                    <button
                      key={ratio.key}
                      type="button"
                      onClick={() => applyWebsiteAspectRatio(ratio.key)}
                      className={`py-2 px-1 rounded-lg text-center border transition-all cursor-pointer ${websiteAspectRatio === ratio.key
                        ? 'bg-indigo-950/90 border-indigo-500 text-white font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                    >
                      <div className="text-xs font-mono">{ratio.label}</div>
                      <div className="text-[9px] text-neutral-400 truncate">{ratio.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-neutral-400">Virtual Pixel Resolution:</span>
                  <select
                    value={websiteResolution}
                    onChange={(e) => setWebsiteResolution(e.target.value)}
                    className="bg-black/80 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-mono focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="1280x720">1280 × 720 (Standard HD)</option>
                    <option value="1920x1080">1920 × 1080 (Full HD)</option>
                    <option value="1024x768">1024 × 768 (XGA 4:3)</option>
                    <option value="800x800">800 × 800 (Square Widget)</option>
                    <option value="720x1280">720 × 1280 (Mobile Vertical)</option>
                    <option value="1680x720">1680 × 720 (Ultrawide 21:9)</option>
                  </select>
                </div>
              </div>

              {/* Physical Sizing & 3D Transform Sliders */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400">straighten</span>
                  Physical Sizing & Scale
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <NumberSliderInput
                    label="Physical Width"
                    value={websiteWidth}
                    onChange={(val) => {
                      setWebsiteWidth(val);
                      if (websiteAspectRatio === '16:9') setWebsiteHeight(Number((val * (9 / 16)).toFixed(4)));
                      else if (websiteAspectRatio === '4:3') setWebsiteHeight(Number((val * (3 / 4)).toFixed(4)));
                      else if (websiteAspectRatio === '1:1') setWebsiteHeight(val);
                      else if (websiteAspectRatio === '9:16') setWebsiteHeight(Number((val * (16 / 9)).toFixed(4)));
                      else if (websiteAspectRatio === '21:9') setWebsiteHeight(Number((val * (9 / 21)).toFixed(4)));
                    }}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="indigo"
                    precision={2}
                    resetValue={1.2}
                  />
                  <NumberSliderInput
                    label="Physical Height"
                    value={websiteHeight}
                    onChange={setWebsiteHeight}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="indigo"
                    precision={2}
                    resetValue={0.675}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <NumberSliderInput
                    label="Display Scale"
                    value={websiteScale}
                    onChange={setWebsiteScale}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    unit="x"
                    color="indigo"
                    precision={2}
                    resetValue={1.0}
                  />
                  <NumberSliderInput
                    label="Opacity"
                    value={websiteOpacity}
                    onChange={setWebsiteOpacity}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    color="indigo"
                    precision={2}
                    resetValue={1.0}
                  />
                </div>
              </div>

              {/* 3D Spatial Position Offset */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-400">open_with</span>
                    3D Spatial Position
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setWebsitePosX(0); setWebsitePosY(0.8); setWebsitePosZ(0.05); }}
                    className="text-[10px] text-neutral-400 hover:text-white font-mono cursor-pointer"
                  >
                    Reset (0, 0.8, 0.05)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumberSliderInput
                    label="X (Left / Right)"
                    value={websitePosX}
                    onChange={setWebsitePosX}
                    min={-3.0}
                    max={3.0}
                    step={0.05}
                    unit="m"
                    color="rose"
                    precision={2}
                    resetValue={0.0}
                  />
                  <NumberSliderInput
                    label="Y (Height)"
                    value={websitePosY}
                    onChange={setWebsitePosY}
                    min={-2.0}
                    max={4.0}
                    step={0.05}
                    unit="m"
                    color="emerald"
                    precision={2}
                    resetValue={0.8}
                  />
                  <NumberSliderInput
                    label="Z (Forward / Back)"
                    value={websitePosZ}
                    onChange={setWebsitePosZ}
                    min={-3.0}
                    max={3.0}
                    step={0.05}
                    unit="m"
                    color="sky"
                    precision={2}
                    resetValue={0.05}
                  />
                </div>
              </div>

              {/* 3D Spatial Rotation */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">sync</span>
                    3D Spatial Rotation (Euler)
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setWebsiteRotX(0); setWebsiteRotY(0); setWebsiteRotZ(0); }}
                    className="text-[10px] text-neutral-400 hover:text-white font-mono cursor-pointer"
                  >
                    Reset (0°, 0°, 0°)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumberSliderInput
                    label="Pitch (X)"
                    value={websiteRotX}
                    onChange={setWebsiteRotX}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    color="rose"
                    precision={0}
                    resetValue={0}
                  />
                  <NumberSliderInput
                    label="Yaw (Y)"
                    value={websiteRotY}
                    onChange={setWebsiteRotY}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    color="emerald"
                    precision={0}
                    resetValue={0}
                  />
                  <NumberSliderInput
                    label="Roll (Z)"
                    value={websiteRotZ}
                    onChange={setWebsiteRotZ}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    color="sky"
                    precision={0}
                    resetValue={0}
                  />
                </div>
              </div>

              {/* 3D Physical Enclosure Frame Styling */}
              <div className="p-3 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span className="material-symbols-outlined text-sm text-pink-400">crop_free</span>
                  Enclosure Frame & Aesthetics
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'cyber_bezel', label: 'Cyber Bezel', desc: 'Illuminated border & alloy casing' },
                    { key: 'obsidian', label: 'Obsidian Black', desc: 'Glossy dark luxury housing' },
                    { key: 'minimal_glass', label: 'Minimal Glass', desc: 'Translucent frosted glass frame' },
                    { key: 'frameless', label: 'Frameless Floating', desc: 'Edge-to-edge floating viewport' }
                  ].map((style) => (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => setWebsiteFrameStyle(style.key)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${websiteFrameStyle === style.key
                        ? 'bg-indigo-950/90 border-indigo-500 text-white font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                    >
                      <div className="text-xs">{style.label}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{style.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Frame Accent Color:</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: websiteFrameColor }}
                      ></div>
                      <input
                        type="color"
                        value={websiteFrameColor}
                        onChange={(e) => setWebsiteFrameColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {['#6366f1', '#38bdf8', '#10b981', '#ec4899', '#f59e0b', '#a855f7', '#ffffff'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setWebsiteFrameColor(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${websiteFrameColor.toLowerCase() === hex.toLowerCase()
                          ? 'ring-2 ring-white scale-110 border-black'
                          : 'border-black/40 hover:scale-105'
                          }`}
                      ></button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={websiteFrameGlow}
                      onChange={(e) => setWebsiteFrameGlow(e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Neon Frame Edge Glow</span>
                  </label>
                </div>
              </div>

              {/* Dedicated Save Web Layer to Batch Button */}
              <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{savingConfig ? 'Saving Web Layer Configuration...' : `Save Web Layer to Batch (${batchId || 'Active'})`}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3D WEBGL VIEWER CANVAS                                                    */}
      {/* ========================================================================= */}
      <div
        id="ar-scene-container"
        className={`flex-1 relative bg-neutral-900 overflow-hidden w-full h-full min-w-0 ${isModifierHeld ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
          }`}
        style={{ touchAction: 'none', height: '100%', minHeight: '100%' }}
        onContextMenu={(e) => {
          if (e.ctrlKey || e.metaKey) e.preventDefault();
        }}
      >
        {/* Control / Command Held Selection Guide Banner */}
        {isModifierHeld && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-fade-in flex items-center gap-2 px-3 py-1.5 bg-neutral-900/95 backdrop-blur-md border border-indigo-500/60 rounded-xl shadow-2xl text-xs text-white">
            <span className="material-symbols-outlined text-sm text-indigo-400 animate-pulse">ads_click</span>
            <span className="font-bold text-indigo-300">Ctrl / ⌘ Held:</span>
            <span className="text-neutral-300">Click any object, light, or shape to select it</span>
          </div>
        )}

        {/* Floating Viewport Controls: Camera View Angles on Top, 3D Transform Gizmo Toolbar Directly Beneath */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none select-none max-w-[95vw]">
          {/* Floating Multi-Select & Active Group Viewport Pill Banner */}
          {(selectedObjects.length > 1 || (selectedTargetType === 'group' && selectedGroupId)) && (
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-xl shadow-2xl animate-fade-in text-xs">
              {selectedTargetType === 'group' && selectedGroupId ? (
                <>
                  <span className="material-symbols-outlined text-purple-400 text-sm">workspaces</span>
                  <span className="font-bold text-white">
                    {sceneGroups.find((g) => g.id === selectedGroupId)?.name || 'Group'} ({selectedObjects.length} objects)
                  </span>
                  <div className="h-3 w-px bg-neutral-700 mx-1" />
                  <button
                    type="button"
                    onClick={() => handleUngroup(selectedGroupId)}
                    className="font-semibold text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title="Dissolve group into individual objects (Ctrl+Shift+G)"
                  >
                    <span className="material-symbols-outlined text-xs">folder_off</span>
                    <span>Ungroup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportShapeAsGLB({ type: 'group', id: selectedGroupId })}
                    className="font-semibold text-teal-300 hover:text-white px-2 py-0.5 rounded bg-teal-900/40 hover:bg-teal-800/60 border border-teal-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title={`Export group "${sceneGroups.find((g) => g.id === selectedGroupId)?.name || 'Group'}" as .GLB`}
                  >
                    <span className="material-symbols-outlined text-xs">download</span>
                    <span>Export .GLB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateGroup(selectedGroupId)}
                    className="font-semibold text-cyan-300 hover:text-white px-2 py-0.5 rounded bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title={`Duplicate group "${sceneGroups.find((g) => g.id === selectedGroupId)?.name || 'Group'}" (Ctrl+D)`}
                  >
                    <span className="material-symbols-outlined text-xs">content_copy</span>
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={focusCameraOnSelectedObject}
                    className="font-semibold text-neutral-300 hover:text-white px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors cursor-pointer flex items-center gap-1"
                    title="Focus camera on group (F)"
                  >
                    <span className="material-symbols-outlined text-xs">filter_center_focus</span>
                    <span>Focus</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectionAndDetachGizmo}
                    className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
                    title="Deselect (Esc)"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-indigo-400 text-sm">checklist</span>
                  <span className="font-bold text-white">
                    {selectedObjects.length} Objects Selected
                  </span>
                  <div className="h-3 w-px bg-neutral-700 mx-1" />
                  <button
                    type="button"
                    onClick={() => handleCreateGroupFromSelection()}
                    className="font-bold text-white px-2.5 py-0.5 rounded bg-purple-600 hover:bg-purple-500 border border-purple-400 shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    title="Group selected objects (Ctrl+G)"
                  >
                    <span className="material-symbols-outlined text-xs">workspaces</span>
                    <span>Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportShapeAsGLB({ type: 'multi' })}
                    className="font-semibold text-teal-300 hover:text-white px-2 py-0.5 rounded bg-teal-900/40 hover:bg-teal-800/60 border border-teal-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title="Export selected objects as a combined .GLB file"
                  >
                    <span className="material-symbols-outlined text-xs">download</span>
                    <span>Export .GLB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMultiSelectMode((prev) => !prev)}
                    className={`font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${isMultiSelectMode
                      ? 'bg-indigo-600/40 border-indigo-400 text-indigo-200'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                      }`}
                    title="Toggle Multi-Select Mode"
                  >
                    {isMultiSelectMode ? 'Multi: ON' : 'Multi: OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectionAndDetachGizmo}
                    className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
                    title="Deselect All (Esc)"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Top: Interactive Camera View Angle Presets Toolbar (Studio4D4 Style) */}
          {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
            <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-2xl overflow-x-auto max-w-full">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1 font-mono shrink-0">
                <span className="material-symbols-outlined text-sm text-indigo-400">videocam</span> Views
              </span>
              <button
                type="button"
                onClick={() => setCameraView('perspective')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Studio 3/4 Perspective View"
              >
                Perspective
              </button>
              <button
                type="button"
                onClick={() => setCameraView('front')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Direct Front-Facing View"
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setCameraView('back')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Back View"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCameraView('left')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Left View"
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => setCameraView('right')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Right View"
              >
                Right
              </button>
              <button
                type="button"
                onClick={() => setCameraView('top')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Top-Down View"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setCameraView('bottom')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm shrink-0"
                title="Bottom-Up View"
              >
                Bottom
              </button>
              <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0"></div>
              <button
                type="button"
                onClick={() => setCameraView('reset')}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all flex items-center gap-1 shrink-0"
                title="Reset View to Studio Perspective (F)"
              >
                <span className="material-symbols-outlined text-xs">restart_alt</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0"></div>
              <button
                type="button"
                onClick={() => setMarkerVisible((v) => !v)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1 shrink-0 ${markerVisible
                  ? 'bg-emerald-600 text-white shadow-emerald-900/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                title="Toggle Target Marker Reference Plane in Viewport (M)"
              >
                <span className="material-symbols-outlined text-xs">qr_code_2</span>
                <span>Marker</span>
              </button>
              <button
                type="button"
                onClick={frameCameraToMarker}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-emerald-700 text-slate-300 hover:text-white transition-all shadow-sm flex items-center shrink-0"
                title="Align Camera Perpendicular to Marker Face"
              >
                <span className="material-symbols-outlined text-xs">crop_free</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0"></div>
              <button
                type="button"
                onClick={handleCaptureThumbnail}
                disabled={savingConfig || (!editingTemplate && !batchId.trim())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                title={editingTemplate ? "Capture & Update Template Thumbnail" : "Capture & Save Current 3D View Angle as Asset Thumbnail"}
              >
                <span className="material-symbols-outlined text-xs">photo_camera</span>
                <span>Snap Thumb</span>
              </button>
            </div>
          )}

          {/* Beneath: 3D Transform Controls Gizmo Toolbar (Move, Rotate, Scale) */}
          <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-xl shadow-2xl">
            {/* Gizmo Mode Toggle Buttons */}
            <div className="flex items-center gap-0.5 bg-black/60 p-0.5 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setGizmoMode('translate')}
                title="Translate / Move (W)"
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${gizmoMode === 'translate'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">open_with</span>
                <span className="hidden sm:inline">Move</span>
                <span className="text-[10px] font-mono opacity-60">W</span>
              </button>
              <button
                type="button"
                onClick={() => setGizmoMode('rotate')}
                title="Rotate / Turn (E)"
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${gizmoMode === 'rotate'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">rotate_right</span>
                <span className="hidden sm:inline">Rotate</span>
                <span className="text-[10px] font-mono opacity-60">E</span>
              </button>
              <button
                type="button"
                onClick={() => setGizmoMode('scale')}
                title="Scale / Resize (R)"
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${gizmoMode === 'scale'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">aspect_ratio</span>
                <span className="hidden sm:inline">Scale</span>
                <span className="text-[10px] font-mono opacity-60">R</span>
              </button>
            </div>

            {/* Coordinate Space Toggle */}
            <button
              type="button"
              onClick={() => setGizmoSpace((prev) => (prev === 'world' ? 'local' : 'world'))}
              title={`Transform Coordinate Space (${gizmoSpace.toUpperCase()})`}
              className="px-2 py-1 bg-black/60 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono font-semibold text-neutral-300 transition-all uppercase"
            >
              {gizmoSpace}
            </button>

            {/* Snapping Toggle */}
            <button
              type="button"
              onClick={() => setGizmoSnap((prev) => (prev === null ? 0.1 : prev === 0.1 ? 0.5 : null))}
              title="Toggle Transform Snapping"
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold border transition-all ${gizmoSnap
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-black/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
            >
              {gizmoSnap ? `Snap: ${gizmoSnap}m` : 'Snap: Off'}
            </button>

            {/* Draw on Face & Extrude Studio Toggle (X) */}
            <button
              type="button"
              onClick={() => setFaceSketchStudioOpen((prev) => !prev)}
              title="Click any object face to draw a 2D shape on it and extrude into 3D (X)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${faceSketchStudioOpen
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md ring-2 ring-teal-400'
                : 'bg-black/60 hover:bg-neutral-800 border border-teal-500/40 text-teal-300 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-sm">draw</span>
              <span className="hidden sm:inline">Draw on Face</span>
              <span className="text-[10px] font-mono opacity-60">X</span>
            </button>

            {/* Multi-Select Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsMultiSelectMode((prev) => !prev)}
              title={isMultiSelectMode ? 'Multi-Select Mode: ON (Click objects to add/remove)' : 'Toggle Multi-Select Mode'}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold border transition-all flex items-center gap-1 cursor-pointer ${isMultiSelectMode
                ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-md ring-1 ring-indigo-400/50'
                : 'bg-black/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <span className="material-symbols-outlined text-xs">
                {isMultiSelectMode ? 'checklist' : 'select_all'}
              </span>
              <span>{isMultiSelectMode ? 'Multi: ON' : 'Multi'}</span>
            </button>

            {/* Group Selected Objects Button (when multiple items selected) */}
            {selectedObjects.length > 1 && (
              <button
                type="button"
                onClick={() => handleCreateGroupFromSelection()}
                title="Group selected objects into a movable group (Ctrl+G)"
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white border border-purple-400 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-xs">workspaces</span>
                <span>Group ({selectedObjects.length})</span>
              </button>
            )}

            {/* Duplicate & Ungroup Buttons (when a group is selected) */}
            {selectedTargetType === 'group' && selectedGroupId && (
              <>
                <button
                  type="button"
                  onClick={() => handleDuplicateGroup(selectedGroupId)}
                  title="Duplicate Group (Ctrl+D)"
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUngroup(selectedGroupId)}
                  title="Ungroup (Ctrl+Shift+G)"
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-xs">folder_off</span>
                  <span>Ungroup</span>
                </button>
              </>
            )}

            {/* Selection Info Badge */}
            {currentSelectedObjectInfo && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-neutral-800">
                <div className="flex items-center gap-1 px-2 py-1 bg-neutral-800/90 border border-neutral-700/80 rounded-lg text-xs text-neutral-200 max-w-[160px] truncate">
                  <span className="material-symbols-outlined text-xs text-indigo-400">
                    {currentSelectedObjectInfo.icon}
                  </span>
                  <span className="truncate font-semibold">{currentSelectedObjectInfo.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleExportShapeAsGLB()}
                  title={
                    selectedTargetType === 'group'
                      ? 'Export Selected Group as .GLB'
                      : selectedTargetType === 'multi'
                        ? 'Export Selected Objects as .GLB'
                        : 'Export Selected Object as .GLB'
                  }
                  className="p-1 px-2 rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-teal-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span className="hidden sm:inline">.GLB</span>
                </button>
                <button
                  type="button"
                  onClick={focusCameraOnSelectedObject}
                  title="Focus Camera on Selected Object (F)"
                  className="p-1 rounded-lg bg-black/60 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-indigo-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">filter_center_focus</span>
                </button>
                <button
                  type="button"
                  onClick={clearSelectionAndDetachGizmo}
                  title="Deselect Object (Esc)"
                  className="p-1 rounded-lg bg-black/60 hover:bg-red-950/60 border border-neutral-800 hover:border-red-500/40 text-neutral-400 hover:text-red-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <a-scene
          ref={sceneRef}
          key="ar-portal-scene"
          embedded
          color-space="sRGB"
          renderer="colorManagement: true; antialias: true; stencil: true; preserveDrawingBuffer: true;"
          light="defaultLightsEnabled: false"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          scene-environment="exposure: 1.1; hdrIntensity: 0.0; enabled: false"
          fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <a-entity
            id="scene-camera"
            camera="active: true; fov: 45; near: 0.01; far: 1000"
            position="0 0.4 2.5"
            orbit-camera-controls={`enableDamping: true; dampingFactor: 0.08; screenSpacePanning: true; autoRotate: ${cameraAutoRotate}; autoRotateSpeed: 1.2; minDistance: 0.2; maxDistance: 100; enableRotate: true; enablePan: true; enableZoom: true; rotateSpeed: 1.0; zoomSpeed: 1.0; panSpeed: 1.0`}
          >
          </a-entity>

          {/* Dynamic Multi-Source Studio Lighting Rig */}
          <a-entity
            id="test-lighting-rig"
            ar-studio-lighting={`enabled: true; ambientColor: ${ambientColor}; ambientIntensity: ${ambientIntensity}; dir1Color: ${dir1Color}; dir1Intensity: ${dir1Intensity}; dir1Position: ${dir1Position}; dir2Color: ${dir2Color}; dir2Intensity: ${dir2Intensity}; dir2Position: ${dir2Position}; rimColor: ${rimColor}; rimIntensity: ${rimIntensity}; rimPosition: ${rimPosition};`}
          ></a-entity>
          <a-entity
            id="test-ambient-light"
            light={`type: ambient; color: ${ambientColor}; intensity: ${ambientIntensity};`}
          ></a-entity>
          <a-entity
            id="test-dir1-light"
            light={`type: directional; color: ${dir1Color}; intensity: ${dir1Intensity}; castShadow: false;`}
            position={dir1Position}
          ></a-entity>
          <a-entity
            id="test-dir2-light"
            light={`type: directional; color: ${dir2Color}; intensity: ${dir2Intensity}; castShadow: false;`}
            position={dir2Position}
          ></a-entity>
          <a-entity
            id="test-rim-light"
            light={`type: directional; color: ${rimColor}; intensity: ${rimIntensity}; castShadow: false;`}
            position={rimPosition}
          ></a-entity>

          {/* Custom Multi-Source Lighting Rig Anchor */}
          {customLights.length > 0 && (
            <a-entity
              id="ar-custom-lights-anchor"
              ar-custom-lights={`lights: ${encodeURIComponent(JSON.stringify(customLights))}; showHelpers: ${showLightHelpers}; showBulbs: ${showLightHelpers};`}
            ></a-entity>
          )}

          {/* MindAR Target Marker Reference Plane Anchor (XY plane at 0, 0, 0) */}
          {markerVisible && (
            <a-entity
              id="ar-marker-reference-anchor"
              position="0 0 0"
              ar-marker-reference={`enabled: ${markerVisible}; width: ${markerWidth}; height: ${Number((markerWidth * (markerAspectRatio || 1.0)).toFixed(4))}; aspectRatio: ${markerAspectRatio || 1.0}; opacity: ${markerOpacity}; showAxes: true; showFrame: true;`}
            ></a-entity>
          )}

          {/* Center Model Entity Anchor */}
          {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || arData?.modelUrl) && (
            <a-entity position="0 0 0">
              <a-gltf-model
                id="ar-model"
                src={localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || arData?.modelUrl}
                crossOrigin="anonymous"
                position={`${modelPosX} ${modelPosY} ${modelPosZ}`}
                scale={`${modelScale} ${modelScale} ${modelScale}`}
                rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
                visible={!(portalEnabled && portalHideOutsideModel)}
                {...(modelRotSpeed > 0 && selectedTargetType !== 'model' && !isGizmoDragging && !selectedMeshUuid
                  ? {
                    animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${modelRotY + 360
                      } ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;`
                  }
                  : {})}
                model-auto-center="enabled: true"
                dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
                play-gltf-video={`src: ${activeVideoUrl || customVideoUrl || arData?.videoUrl || ''}; playing: ${mediaPlaying}; muted: ${mediaMuted}; targetMesh: ${videoTargetMesh}; flipX: ${videoFlipX}; videoScale: ${videoScale}; videoOffsetX: ${videoOffsetX}; videoOffsetY: ${videoOffsetY}; videoOffsetZ: ${videoOffsetZ}; videoRotation: ${videoRotation}; videoTextureRepeatX: ${videoTextureRepeatX}; videoTextureRepeatY: ${videoTextureRepeatY}; videoTextureOffsetX: ${videoTextureOffsetX}; videoTextureOffsetY: ${videoTextureOffsetY}; aspectRatio: ${videoAspectRatio}`}
                play-gltf-animation={`playing: ${mediaPlaying}`}
              >
              </a-gltf-model>
            </a-entity>
          )}

          {/* AR Portal & Virtual Window Anchor */}
          {portalEnabled && (
            <a-entity
              id="ar-portal-anchor"
              ar-portal={`enabled: ${portalEnabled}; shape: ${portalShape}; width: ${portalWidth}; height: ${portalHeight}; radius: ${portalRadius}; depth: ${portalDepth}; frameColor: ${portalFrameColor}; frameWidth: ${portalFrameWidth}; frameDepth: 0.08; frameEmissive: ${portalFrameEmissive}; frameEmissiveIntensity: ${portalFrameEmissiveIntensity}; frameGlow: ${portalFrameGlow}; glassTint: ${portalGlassTint}; glassOpacity: ${portalGlassOpacity}; interiorType: ${portalInteriorType}; skyboxUrl: ${portalSkyboxUrl}; skyboxScale: ${portalSkyboxScale}; skyboxPosX: ${portalSkyboxPosX}; skyboxPosY: ${portalSkyboxPosY}; skyboxPosZ: ${portalSkyboxPosZ}; skyboxRotX: ${portalSkyboxRotX}; skyboxRotY: ${portalSkyboxRotY}; skyboxRotZ: ${portalSkyboxRotZ}; skyboxBlur: ${portalSkyboxBlur}; interiorColor: ${portalInteriorColor}; wallColor: ${portalWallColor}; floorColor: ${portalFloorColor}; gridColor: ${portalGridColor}; interiorLightColor: ${portalLightColor}; interiorLightIntensity: ${portalLightIntensity}; interiorModelType: ${portalModelType}; artifactType: ${portalArtifactType}; customModelUrl: ${portalCustomModelUrl}; currentModelUrl: ${localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || ''}; modelScale: ${portalModelScale}; modelPosX: ${portalModelPosX}; modelPosY: ${portalModelPosY}; modelPosZ: ${portalModelPosZ}; modelRotSpeed: ${portalModelRotSpeed}; modelRotX: ${portalModelRotX}; modelRotY: ${portalModelRotY}; modelRotZ: ${portalModelRotZ}; showVideo: ${portalShowVideo}; videoUrl: ${portalVideoUrl || activeVideoUrl || ''}; videoScale: ${portalVideoScale}; videoPosY: ${portalVideoPosY}; videoPosZ: ${portalVideoPosZ}; particles: ${portalParticles}; particleCount: ${portalParticleCount}; particleColor: ${portalParticleColor}; particleSpeed: ${portalParticleSpeed}; floatingText: ${portalFloatingText}; textColor: ${portalTextColor}; textScale: ${portalTextScale}; textPosY: ${portalTextPosY}; textPosZ: ${portalTextPosZ}; posX: ${portalPosX}; posY: ${portalPosY}; posZ: ${portalPosZ}; rotX: ${portalRotX}; rotY: ${portalRotY}; rotZ: ${portalRotZ};`}
            ></a-entity>
          )}

          {/* Standalone AR Particle System Anchor */}
          {particleSystemEnabled && (
            <a-entity
              id="ar-particle-system-anchor"
              ar-particle-system={`enabled: ${particleSystemEnabled}; preset: ${particlePreset}; count: ${particleCount}; size: ${particleSize}; color: ${particleColor}; colorSecondary: ${particleColorSecondary}; opacity: ${particleOpacity}; shape: ${particleShape}; blending: ${particleBlending}; direction: ${particleDirection}; speed: ${particleSpeed}; rotationSpeed: ${particleRotationSpeed}; spreadX: ${particleSpreadX}; spreadY: ${particleSpreadY}; spreadZ: ${particleSpreadZ}; posX: ${particlePosX}; posY: ${particlePosY}; posZ: ${particlePosZ}; rotX: 0; rotY: 0; rotZ: 0; twinkle: ${particleTwinkle};`}
            ></a-entity>
          )}

          {/* Additional 3D Primitive Geometries Anchor */}
          {additionalGeometries.length > 0 && (
            <a-entity
              id="ar-additional-geometries-anchor"
              ar-additional-geometries={`geometries: ${encodeURIComponent(JSON.stringify(additionalGeometries))};`}
            ></a-entity>
          )}

          {/* Custom External 3D Models Anchor */}
          {customModels.length > 0 && (
            <a-entity
              id="ar-custom-models-anchor"
              ar-custom-models={`models: ${encodeURIComponent(JSON.stringify(customModels))};`}
            ></a-entity>
          )}

          {/* Custom Extruded 3D Typography Texts Anchor */}
          {custom3DTexts.length > 0 && (
            <a-entity
              id="ar-3d-texts-anchor"
              ar-3d-texts={`texts: ${encodeURIComponent(JSON.stringify(custom3DTexts))};`}
            ></a-entity>
          )}

          {/* Live Interactive 3D Website Layer Anchor */}
          {websiteEnabled && websiteUrl && (
            <a-entity
              id="ar-website-layer-anchor"
              ar-website-layer={`enabled: ${websiteEnabled}; url: ${encodeURIComponent(websiteUrl)}; width: ${websiteWidth}; height: ${websiteHeight}; aspectRatio: ${websiteAspectRatio}; resolution: ${websiteResolution}; interactive: ${websiteInteractive}; opacity: ${websiteOpacity}; frameStyle: ${websiteFrameStyle}; frameColor: ${websiteFrameColor}; frameGlow: ${websiteFrameGlow}; curved: ${websiteCurved}; curveRadius: ${websiteCurveRadius}; billboard: ${websiteBillboard}; posX: ${websitePosX}; posY: ${websitePosY}; posZ: ${websitePosZ}; rotX: ${websiteRotX}; rotY: ${websiteRotY}; rotZ: ${websiteRotZ}; scale: ${websiteScale}; showAddressBar: ${websiteShowAddressBar};`}
            ></a-entity>
          )}
        </a-scene>

        {!loading && !(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || portalEnabled || particleSystemEnabled || additionalGeometries.length > 0 || customModels.length > 0 || custom3DTexts.length > 0 || customLights.length > 0 || (markerVisible && markerImageUrl) || (websiteEnabled && websiteUrl)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 space-y-4 p-8 text-center pointer-events-none z-10">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-indigo-400 shadow-xl">
              <span className="material-symbols-outlined text-3xl">view_in_ar</span>
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-base font-semibold text-neutral-300">Ready for 3D Scene Inspection</p>
              <p className="text-xs text-neutral-500">Enter a Batch ID or pick a local .glb 3D model above to calibrate orientation, positioning, and individual mesh parts.</p>
            </div>
          </div>
        )}



        {/* Media Controls Floating Action Buttons (Play/Pause + Sound Mute/Unmute) */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleMedia}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
            title={mediaPlaying ? 'Pause Scene Animation/Video' : 'Play Scene Animation/Video'}
          >
            <span className="material-symbols-outlined text-xl">
              {mediaPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={toggleMediaMute}
            style={{
              backgroundColor: mediaMuted ? 'rgba(225, 29, 72, 0.85)' : 'rgba(16, 185, 129, 0.85)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
            title={mediaMuted ? 'Unmute YouTube / Video Sound' : 'Mute YouTube / Video Sound'}
          >
            <span className="material-symbols-outlined text-xl">
              {mediaMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          <button
            onClick={() => setShowDiagnosticsDrawer((prev) => !prev)}
            style={{
              backgroundColor: showDiagnosticsDrawer ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0, 0, 0, 0.75)',
              color: showDiagnosticsDrawer ? '#000000' : '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)'
            }}
            title="AR Point Light Diagnostics & Live DevTool Drawer"
          >
            <span className="material-symbols-outlined text-xl">
              tune
            </span>
          </button>
        </div>

        {/* Floating Active Target HUD Indicator */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute top-5 left-[184px] z-40 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-neutral-700 text-xs font-medium text-neutral-200 shadow-xl flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${editingTemplate ? 'bg-amber-400 animate-pulse' : selectedMesh ? 'bg-indigo-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>
                {editingTemplate ? (
                  <>Template Mode: <strong className="text-amber-300">{editingTemplate.cleanName || editingTemplate.name}</strong></>
                ) : selectedMesh ? (
                  <>Selected Mesh: <strong className="text-indigo-300">{selectedMesh.name}</strong></>
                ) : (
                  <>Active Target: <strong className="text-emerald-300">Entire 3D Model</strong></>
                )}
              </span>
              {selectedMesh && (
                <span className="text-[10px] text-neutral-400 font-mono pl-1 border-l border-neutral-700">
                  Click canvas background to deselect
                </span>
              )}
            </div>
          </div>
        )}

        {/* Live Coordinate Overlay HUD */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute top-5 right-5 z-40 pointer-events-none hidden sm:flex flex-col gap-1 items-end">
            <div className="px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-neutral-800 text-[10px] font-mono text-neutral-300 shadow-lg space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">POS:</span>
                <span className="text-rose-400 font-bold">X:{currentPosX.toFixed(2)}</span>
                <span className="text-emerald-400 font-bold">Y:{currentPosY.toFixed(2)}</span>
                <span className="text-sky-400 font-bold">Z:{currentPosZ.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">ROT:</span>
                <span className="text-rose-400 font-bold">X:{currentRotX}°</span>
                <span className="text-emerald-400 font-bold">Y:{currentRotY}°</span>
                <span className="text-sky-400 font-bold">Z:{currentRotZ}°</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">SCALE:</span>
                <span className="text-purple-400 font-bold">{currentScale.toFixed(2)}x</span>
                {modelRotSpeed > 0 && !selectedMesh && (
                  <span className="text-indigo-400 font-bold">SPIN:{modelRotSpeed / 1000}s</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Interactive Control Pill (matching ProductViewer) */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/85 backdrop-blur-lg px-3 py-1.5 rounded-full border border-white/15 shadow-2xl">
            <button
              type="button"
              onClick={toggleCameraAutoRotate}
              className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${cameraAutoRotate
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              title="Toggle 360 Auto-Rotation"
            >
              <span className={`material-symbols-outlined text-sm ${cameraAutoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                sync
              </span>
              <span>{cameraAutoRotate ? 'Rotating' : 'Paused'}</span>
            </button>

            <div className="w-px h-4 bg-white/20"></div>

            <button
              type="button"
              onClick={() => setCameraView('reset')}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-mono text-neutral-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all cursor-pointer"
              title="Reset Front Center Framing"
            >
              <span className="material-symbols-outlined text-sm">center_focus_strong</span>
              <span>Reset</span>
            </button>

            <div className="w-px h-4 bg-white/20"></div>

            <button
              type="button"
              onClick={() => setMatWireframe((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer ${matWireframe
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              title="Toggle Wireframe Mesh"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Wireframe</span>
            </button>

            {batchId && (
              <>
                <div className="w-px h-4 bg-white/20"></div>
                <button
                  type="button"
                  onClick={handleTryInAR}
                  disabled={isLaunchingAR}
                  className="px-3 py-1.5 rounded-full text-[11px] font-mono font-bold bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white flex items-center gap-1 shadow-md transition-all cursor-pointer disabled:opacity-60 active:scale-95"
                  title="Save Calibration & Launch Live WebAR Camera"
                >
                  <span className={`material-symbols-outlined text-sm ${isLaunchingAR ? 'animate-spin' : ''}`}>
                    {isLaunchingAR ? 'sync' : 'view_in_ar'}
                  </span>
                  <span>{isLaunchingAR ? 'Syncing...' : 'Try In AR'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Subtle Bottom Drag Hint */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none opacity-40 hover:opacity-100 transition-opacity z-30">
            <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
              🖱️ Left-Drag: Rotate • Right-Drag: Pan • Scroll: Zoom
            </span>
          </div>
        )}

        {/* Extracted BuyNowButton component */}
        {showBuyButton && (
          <BuyNowButton
            color={buyButtonColor}
            onClick={handleCheckout}
            disabled={checkoutLoading}
            price={arData?.price !== undefined ? Number(arData.price) : 99.00}
          />
        )}
      </div>

      {/* 3D Primitive Geometries Modal */}
      {geometryModalOpen && (
        <AddGeometryModal
          isOpen={geometryModalOpen}
          onClose={() => setGeometryModalOpen(false)}
          onAddGeometry={handleAddGeometry}
          onOpenAddModelModal={() => {
            setGeometryModalOpen(false);
            setIsAddModelModalOpen(true);
          }}
        />
      )}

      {/* External 3D Model Modal */}
      {isAddModelModalOpen && (
        <AddModelModal
          isOpen={isAddModelModalOpen}
          onClose={() => setIsAddModelModalOpen(false)}
          onAddModel={handleAddCustomModel}
          onSetRootModel={handleSetRootModelFromModal}
        />
      )}

      {/* 3D Extruded Typography Text Modal */}
      {isAddTextModalOpen && (
        <Add3DTextModal
          isOpen={isAddTextModalOpen}
          onClose={() => setIsAddTextModalOpen(false)}
          onAddText={handleAdd3DText}
        />
      )}

      {/* Photoshop-Style Vector Pen Studio Modal */}
      {vectorPenModalOpen && (
        <VectorPenModal
          isOpen={vectorPenModalOpen}
          onClose={() => {
            setVectorPenModalOpen(false);
            setEditingVectorGeom(null);
            setVectorPenInitialMode('extrude');
          }}
          onExtrude={handleCommitVectorExtrude}
          initialMode={
            vectorPenInitialMode === 'revolve' || editingVectorGeom?.type === 'vectorRevolve'
              ? 'revolve'
              : vectorPenInitialMode === 'sweep' || editingVectorGeom?.type === 'vectorSweep'
                ? 'sweep'
                : vectorPenInitialMode === 'carve' || editingVectorGeom?.type === 'vectorCarve'
                  ? 'carve'
                  : vectorPenInitialMode === 'inflate' || editingVectorGeom?.type === 'vectorInflate' || editingVectorGeom?.params?.inflateEnabled
                    ? 'inflate'
                    : 'extrude'
          }
          initialPoints={
            editingVectorGeom?.params?.points ||
            editingVectorGeom?.params?.frontPoints ||
            null
          }
          initialParams={editingVectorGeom?.params || null}
          initialColor={editingVectorGeom?.color || '#38bdf8'}
          initialName={
            editingVectorGeom?.name ||
            (vectorPenInitialMode === 'inflate'
              ? 'Inflated Vector Volume'
              : vectorPenInitialMode === 'revolve'
                ? 'Revolved Vector Lathe'
                : vectorPenInitialMode === 'sweep'
                  ? 'Swept Vector Shape'
                  : vectorPenInitialMode === 'carve'
                    ? 'Visual Hull Carve'
                    : 'Extruded Vector Shape')
          }
        />
      )}

      {/* Real-Time AR Light Diagnostics & DevTools Drawer */}
      <ARLightDiagnosticsDrawer
        isOpen={showDiagnosticsDrawer}
        onClose={() => setShowDiagnosticsDrawer(false)}
        sceneRef={sceneRef}
        trackingStatus="STUDIO_VIEW"
        cameraEnabled={false}
      />

      {/* Interactive Face Sketch & Extrude Studio */}
      <FaceSketchExtrudeStudio
        isOpen={faceSketchStudioOpen}
        onClose={() => setFaceSketchStudioOpen(false)}
        onCommitExtrude={(payload) => {
          handleAddGeometry(payload);
          setSaveSuccessMsg(`Extruded 3D shape from face: ${payload.name}`);
          setTimeout(() => setSaveSuccessMsg(''), 4500);
        }}
        sceneRef={sceneRef}
        selectedTarget={selectedStudioTarget}
      />
    </div>
  );
};

export default ARTest;
