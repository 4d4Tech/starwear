import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'aframe';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import BuyNowButton from '../components/BuyNowButton';
import { db, storage, functions, analytics } from '../firebase';
import { doc, getDoc, getDocFromServer, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

if (typeof THREE !== 'undefined' && THREE.Cache) {
  THREE.Cache.enabled = false;
  THREE.Cache.clear();
}
import { httpsCallable } from 'firebase/functions';
import { logEvent } from 'firebase/analytics';
import { isYouTubeUrl, isYouTubeShortUrl, extractYouTubeId, computeGeometrySurfaceFrame, purgeAllSceneVideoLayers, PORTAL_PRESETS } from '../utils/aframe-components';

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

// =========================================================================
// MAIN ARTEST COMPONENT
// =========================================================================
const ARTest = () => {
  const [batchId, setBatchId] = useState('');
  const [arData, setArData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active Control Panel Tab: 'transform' | 'hierarchy' | 'lighting' | 'materials' | 'scene'
  const [activeTab, setActiveTab] = useState('transform');

  // Multi-Mesh & Object Selection State
  const [meshList, setMeshList] = useState([]);
  const [selectedMeshUuid, setSelectedMeshUuid] = useState(null); // null = entire model (root)
  const [searchFilter, setSearchFilter] = useState('');
  const [deletedMeshNames, setDeletedMeshNames] = useState([]);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState(null);
  const deletedNodesRef = useRef(new Map()); // uuid -> { node, parent, name }
  const [textureUploadingUuid, setTextureUploadingUuid] = useState(null);
  const pendingTextureFilesRef = useRef(new Map()); // meshName -> { meshUuid, meshName, file, previewUrl }

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
  const [ambientIntensity, setAmbientIntensity] = useState(1.5);

  const [dir1Color, setDir1Color] = useState('#ffffff');
  const [dir1Intensity, setDir1Intensity] = useState(2.5);
  const [dir1Position, setDir1Position] = useState('1 2 1');

  const [dir2Color, setDir2Color] = useState('#ffffff');
  const [dir2Intensity, setDir2Intensity] = useState(1.0);
  const [dir2Position, setDir2Position] = useState('-1 -2 -1');

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
                  node.parent.remove(node);
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
                if (ovr.material.textureUrl) {
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

    modelEl.addEventListener('model-loaded', handleLoaded);
    if (modelEl.getObject3D('mesh')) {
      handleLoaded();
    }

    return () => {
      modelEl.removeEventListener('model-loaded', handleLoaded);
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
      if (e.button !== undefined && e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      if (!pointerDownPos) return;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;

      if (dist > 6) return; // Drag/orbit gesture

      const sceneEl = document.querySelector('a-scene');
      if (!sceneEl || !sceneEl.camera) return;
      const canvas = sceneEl.canvas;
      if (!canvas) return;

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
      raycaster.setFromCamera(mouse, sceneEl.camera);

      const modelEl = document.getElementById('ar-model');
      if (!modelEl) return;
      const model3D = modelEl.getObject3D('mesh');
      if (!model3D) return;

      const intersects = raycaster.intersectObject(model3D, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit && hit.isMesh) {
          setSelectedMeshUuid(hit.uuid);
        }
      } else {
        setSelectedMeshUuid(null);
      }
    };

    const sceneContainer = document.getElementById('ar-scene-container');
    if (sceneContainer) {
      sceneContainer.addEventListener('pointerdown', handlePointerDown);
      sceneContainer.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      if (sceneContainer) {
        sceneContainer.removeEventListener('pointerdown', handlePointerDown);
        sceneContainer.removeEventListener('pointerup', handlePointerUp);
      }
    };
  }, [meshList]);

  // Visual 3D Selection Box Helper on the selected mesh
  useEffect(() => {
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.object3D) return;
    const threeScene = sceneEl.object3D;

    const oldHelper = threeScene.getObjectByName('selected-mesh-box-helper');
    if (oldHelper) {
      threeScene.remove(oldHelper);
      if (oldHelper.geometry) oldHelper.geometry.dispose();
    }

    if (selectedMeshUuid) {
      const modelEl = document.getElementById('ar-model');
      if (!modelEl) return;
      const model3D = modelEl.getObject3D('mesh');
      if (!model3D) return;

      let targetNode = null;
      model3D.traverse((node) => {
        if (node.uuid === selectedMeshUuid && node.isMesh) {
          targetNode = node;
        }
      });

      if (targetNode) {
        const helper = new THREE.BoxHelper(targetNode, 0x6366f1);
        helper.name = 'selected-mesh-box-helper';
        helper.renderOrder = 999;
        if (helper.material) {
          helper.material.depthTest = false;
          helper.material.transparent = true;
          helper.material.opacity = 0.85;
        }
        threeScene.add(helper);
      }
    }

    return () => {
      const helper = threeScene.getObjectByName('selected-mesh-box-helper');
      if (helper) {
        threeScene.remove(helper);
        if (helper.geometry) helper.geometry.dispose();
      }
    };
  }, [selectedMeshUuid, meshList]);

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
    setSelectedMeshUuid(uuid);
  }, [transitionCamera]);

  // Studio4D4 Keyboard Shortcut: 'F' key to Frame / Focus Selected Mesh (or Reset View if none selected)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase() === 'f') {
        if (selectedMeshUuid) {
          focusCameraOnMesh(selectedMeshUuid);
        } else {
          setCameraView('reset');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMeshUuid, focusCameraOnMesh, setCameraView]);

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
      model3D.traverse((node) => {
        if ((node.uuid === uuid || (meshName && node.name === meshName)) && node.isMesh) {
          resolvedName = node.name || meshName || `Mesh_${uuid}`;
          node.visible = false;
          if (node.parent) {
            deletedNodesRef.current.set(uuid, { node, parent: node.parent, name: resolvedName });
            node.parent.remove(node);
          }
        }
      });
    }

    if (resolvedName) {
      setDeletedMeshNames((prev) => Array.from(new Set([...prev, resolvedName])));
    }

    setMeshList((prev) => prev.filter((m) => m.uuid !== uuid && m.name !== meshName));

    if (selectedMeshUuid === uuid) {
      setSelectedMeshUuid(null);
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
  }, [selectedMeshUuid, videoTargetMesh]);

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

        await Promise.all([
          setDoc(doc(db, 'batches', bId), meshOverridePayload, { merge: true }),
          setDoc(doc(db, 'assets', bId), meshOverridePayload, { merge: true })
        ]);
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
        await Promise.all([
          setDoc(doc(db, 'batches', bId), clearPayload, { merge: true }),
          setDoc(doc(db, 'assets', bId), clearPayload, { merge: true })
        ]);
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
      setSelectedMeshUuid(null);
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
        await Promise.all([
          setDoc(doc(db, 'batches', bId), clearPayload, { merge: true }),
          setDoc(doc(db, 'assets', bId), clearPayload, { merge: true })
        ]);
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
    setSelectedMeshUuid(null);
    lastFramedModelKeyRef.current = '';

    try {
      const response = await fetch(`https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/${batchId.trim()}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      if (!response.ok) {
        throw new Error("Batch not found or inactive.");
      }
      const data = await response.json();
      let videoUrl = data.arExperience?.videoUrl || data.arExperience?.video || data.videoUrl || '';

      const batchRef = doc(db, 'batches', batchId.trim());
      let batchSnap = null;
      try {
        batchSnap = await getDocFromServer(batchRef);
      } catch {
        batchSnap = await getDoc(batchRef);
      }
      let batchConfig = null;

      if (batchSnap && batchSnap.exists()) {
        const batchData = batchSnap.data();
        if (batchData.video_url || batchData.videoUrl) {
          videoUrl = batchData.video_url || batchData.videoUrl;
        }
        if (batchData.ar_config) {
          batchConfig = batchData.ar_config;
        }
      }

      if (!batchConfig) {
        try {
          const assetRef = doc(db, 'assets', batchId.trim());
          let assetSnap = null;
          try {
            assetSnap = await getDocFromServer(assetRef);
          } catch {
            assetSnap = await getDoc(assetRef);
          }
          if (assetSnap && assetSnap.exists()) {
            const aData = assetSnap.data();
            if (aData.video_url || aData.videoUrl) {
              videoUrl = aData.video_url || aData.videoUrl;
            }
            if (aData.ar_config) {
              batchConfig = aData.ar_config;
            }
          }
        } catch { }
      }

      const cfg = batchConfig || data.arExperience?.config || data.ar_config || {};

      if (cfg.videoUrl || cfg.video_url) videoUrl = cfg.videoUrl || cfg.video_url;
      if (cfg.ambientColor !== undefined) setAmbientColor(cfg.ambientColor);
      if (cfg.ambientIntensity !== undefined) setAmbientIntensity(cfg.ambientIntensity);
      if (cfg.dir1Color !== undefined) setDir1Color(cfg.dir1Color);
      if (cfg.dir1Intensity !== undefined) setDir1Intensity(cfg.dir1Intensity);
      if (cfg.dir1Position !== undefined) setDir1Position(cfg.dir1Position);
      if (cfg.dir2Color !== undefined) setDir2Color(cfg.dir2Color);
      if (cfg.dir2Intensity !== undefined) setDir2Intensity(cfg.dir2Intensity);
      if (cfg.dir2Position !== undefined) setDir2Position(cfg.dir2Position);
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
        if (pCfg.skyboxUrl !== undefined) setPortalSkyboxUrl(pCfg.skyboxUrl);
        if (pCfg.interiorColor) setPortalInteriorColor(pCfg.interiorColor);
        if (pCfg.wallColor) setPortalWallColor(pCfg.wallColor);
        if (pCfg.floorColor) setPortalFloorColor(pCfg.floorColor);
        if (pCfg.gridColor) setPortalGridColor(pCfg.gridColor);
        if (pCfg.interiorLightColor) setPortalLightColor(pCfg.interiorLightColor);
        if (pCfg.interiorLightIntensity !== undefined) setPortalLightIntensity(Number(pCfg.interiorLightIntensity));
        if (pCfg.interiorModelType) setPortalModelType(pCfg.interiorModelType);
        if (pCfg.artifactType) setPortalArtifactType(pCfg.artifactType);
        if (pCfg.customModelUrl !== undefined) setPortalCustomModelUrl(pCfg.customModelUrl);
        if (pCfg.modelScale !== undefined) setPortalModelScale(Number(pCfg.modelScale));
        if (pCfg.modelPosX !== undefined) setPortalModelPosX(Number(pCfg.modelPosX));
        if (pCfg.modelPosY !== undefined) setPortalModelPosY(Number(pCfg.modelPosY));
        if (pCfg.modelPosZ !== undefined) setPortalModelPosZ(Number(pCfg.modelPosZ));
        if (pCfg.modelRotSpeed !== undefined) setPortalModelRotSpeed(Number(pCfg.modelRotSpeed));
        if (pCfg.modelRotX !== undefined) setPortalModelRotX(Number(pCfg.modelRotX));
        if (pCfg.modelRotY !== undefined) setPortalModelRotY(Number(pCfg.modelRotY));
        if (pCfg.modelRotZ !== undefined) setPortalModelRotZ(Number(pCfg.modelRotZ));
        if (pCfg.showVideo !== undefined) setPortalShowVideo(Boolean(pCfg.showVideo));
        if (pCfg.videoUrl !== undefined) setPortalVideoUrl(pCfg.videoUrl);
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

      if (cfg && cfg.meshOverrides) {
        const loadedDeleted = Object.entries(cfg.meshOverrides)
          .filter(([_, ovr]) => ovr && ovr.deleted)
          .map(([name]) => name);
        if (loadedDeleted.length > 0) {
          setDeletedMeshNames(loadedDeleted);
        }
      }

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
        config: cfg
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
        skyboxUrl: portalSkyboxUrl,
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

      // 2. Synchronize to Firestore so physical markers / mobile devices get the live portal
      try {
        const batchRef = doc(db, 'batches', targetBatch);
        const assetRef = doc(db, 'assets', targetBatch);
        const syncPayload = {
          ar_config: currentConfig,
          portalConfig: currentConfig.portalConfig
        };
        await Promise.allSettled([
          setDoc(batchRef, syncPayload, { merge: true }),
          setDoc(assetRef, syncPayload, { merge: true })
        ]);
      } catch (fsErr) {
        console.warn('[ARTest] Background Firestore sync failed:', fsErr);
      }

      // 3. Open WebAR experience in new tab with cache-buster and portal flag
      const targetUrl = `/ar/${targetBatch}?t=${Date.now()}&portal=${portalEnabled ? '1' : '0'}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('[ARTest] Error launching AR experience:', err);
      window.open(`/ar/${targetBatch}?portal=${portalEnabled ? '1' : '0'}`, '_blank', 'noopener,noreferrer');
    } finally {
      setTimeout(() => setIsLaunchingAR(false), 1200);
    }
  };

  const handleSaveConfig = async () => {
    if (!batchId.trim()) {
      alert('Please enter a Batch ID in the input above before saving.');
      return;
    }

    setSavingConfig(true);
    setSaveSuccessMsg('');
    setUploadProgress('');

    try {
      let finalVideoUrl = activeVideoUrl || customVideoUrl || arData?.videoUrl || '';
      let videoFilePath = arData?.config?.video_file_path || arData?.video_file_path || '';
      if (!finalVideoUrl) {
        videoFilePath = '';
      }
      let finalGltfUrl = localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || '';
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
          skyboxUrl: finalPortalSkyboxUrl || portalSkyboxUrl,
          interiorColor: portalInteriorColor,
          wallColor: portalWallColor,
          floorColor: portalFloorColor,
          gridColor: portalGridColor,
          interiorLightColor: portalLightColor,
          interiorLightIntensity: Number(portalLightIntensity),
          interiorModelType: portalModelType,
          artifactType: portalArtifactType,
          customModelUrl: finalPortalGlbUrl || portalCustomModelUrl,
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
        updatedAt: new Date().toISOString()
      };

      const payload = {
        video_url: finalVideoUrl,
        videoUrl: finalVideoUrl,
        video_file_path: videoFilePath,
        ...(gltfFilePath ? { gltf_file_path: gltfFilePath } : {}),
        ar_config: arConfigPayload,
        portalConfig: arConfigPayload.portalConfig
      };

      // Save to both batches and assets collections with merge: true to guarantee persistence
      const batchRef = doc(db, 'batches', batchId.trim());
      const assetRef = doc(db, 'assets', batchId.trim());

      await Promise.all([
        setDoc(batchRef, payload, { merge: true }),
        setDoc(assetRef, payload, { merge: true })
      ]);

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
        videoUrl: finalVideoUrl,
        video_url: finalVideoUrl,
        video_file_path: videoFilePath,
        gltf_file_path: gltfFilePath || prev?.gltf_file_path,
        config: arConfigPayload,
        arExperience: {
          ...(prev?.arExperience || {}),
          modelUrl: finalGltfUrl || prev?.arExperience?.modelUrl,
          videoUrl: finalVideoUrl,
          config: arConfigPayload
        }
      }));

      // Clear pending raw file selections once saved
      setSelectedVideoFile(null);
      setSelectedGlbFile(null);
      setSelectedPortalSkyboxFile(null);
      setSelectedPortalGlbFile(null);

      const timeStr = new Date().toLocaleTimeString();
      setSaveSuccessMsg(`Video & config saved to Storage & Batch at ${timeStr}`);
      setTimeout(() => setSaveSuccessMsg(''), 6000);
    } catch (err) {
      console.error('Error saving configuration:', err);
      alert('Error saving configuration: ' + err.message);
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

        // 2. Propagate to all existing batch and asset documents in Firestore
        let updatedCount = 0;
        try {
          const batchesSnap = await getDocs(collection(db, 'batches'));
          const updatePromises = [];
          batchesSnap.forEach((bDoc) => {
            updatedCount++;
            updatePromises.push(
              setDoc(doc(db, 'batches', bDoc.id), { ar_config: { trackingConfig: trackingPayload } }, { merge: true })
            );
            updatePromises.push(
              setDoc(doc(db, 'assets', bDoc.id), { ar_config: { trackingConfig: trackingPayload } }, { merge: true })
            );
          });
          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
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

        await Promise.all([
          setDoc(batchRef, { ar_config: { trackingConfig: trackingPayload } }, { merge: true }),
          setDoc(assetRef, { ar_config: { trackingConfig: trackingPayload } }, { merge: true })
        ]);

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
    <div className="w-screen min-h-[100dvh] bg-neutral-950 text-white font-sans flex flex-col md:flex-row overflow-hidden">
      {/* ========================================================================= */}
      {/* SIDEBAR CONTROL DOCK                                                      */}
      {/* ========================================================================= */}
      <div className="w-full md:w-96 lg:w-[420px] bg-black border-r border-neutral-800 z-50 flex flex-col shadow-2xl flex-shrink-0 h-[100dvh]">
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

          <form onSubmit={handleLoad} className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Enter Batch ID"
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
            <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded text-xs font-medium cursor-pointer transition-colors text-neutral-200 truncate">
              <span className="material-symbols-outlined text-[15px] text-indigo-400">folder_open</span>
              <span className="truncate">{localGlbName ? `3D: ${localGlbName}` : 'Test Local GLB Model'}</span>
              <input type="file" accept=".glb,.gltf" onChange={pickLocalModel} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig || !batchId.trim()}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded text-xs flex items-center gap-1 shadow-md shadow-emerald-950/40"
              title="Save Configuration to Firebase Batch"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>{savingConfig ? 'Saving...' : 'Save to Batch'}</span>
            </button>
          </div>

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
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 border ${selectedMesh
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                <span className="material-symbols-outlined text-xs">
                  {selectedMesh ? 'interests' : 'language'}
                </span>
                <span className="truncate max-w-[170px]">
                  {selectedMesh ? selectedMesh.name : 'Entire 3D Model (Root)'}
                </span>
              </span>
            </div>

            {selectedMesh && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDeleteMesh(selectedMesh.uuid, selectedMesh.name)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  title="Delete this mesh from the scene"
                >
                  <span className="material-symbols-outlined text-xs">delete</span> Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMeshUuid(null)}
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
            onClick={() => setActiveTab('lighting')}
            className={`flex-1 py-1.5 px-2 rounded font-medium transition-all flex items-center justify-center gap-1 ${activeTab === 'lighting'
              ? 'bg-neutral-800 text-white font-bold shadow border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
          >
            <span className="material-symbols-outlined text-sm text-amber-400">lightbulb</span>
            <span>Lighting</span>
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
                    onClick={scanMeshes}
                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-medium text-neutral-300 flex items-center gap-1 cursor-pointer"
                    title="Rescan model meshes"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span> Rescan
                  </button>
                </div>
              </div>

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
                onClick={() => setSelectedMeshUuid(null)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${!selectedMeshUuid
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!selectedMeshUuid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'}`}>
                    <span className="material-symbols-outlined text-lg">language</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Entire 3D Model (Root Anchor)
                      {!selectedMeshUuid && <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">ACTIVE</span>}
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
                      setSelectedMeshUuid(null);
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
                  const isSelected = selectedMeshUuid === mesh.uuid;
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
                      onClick={() => setSelectedMeshUuid(mesh.uuid)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${isSelected
                        ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded flex items-center justify-center font-mono text-[11px] font-bold ${isSelected ? 'bg-indigo-500/30 text-indigo-300' : 'bg-neutral-800 text-neutral-400 group-hover:text-neutral-200'
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: LIGHTING CONTROLS                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'lighting' && (
            <div className="space-y-5">
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
                  resetValue={1.5}
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
                  resetValue={2.5}
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
                  resetValue={1.0}
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
                  onChange={(e) => setSelectedMeshUuid(e.target.value || null)}
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3D WEBGL VIEWER CANVAS                                                    */}
      {/* ========================================================================= */}
      <div
        id="ar-scene-container"
        className="flex-1 relative bg-neutral-900 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || portalEnabled) ? (
          <a-scene
            key={batchId || localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || 'ar-portal-scene'}
            embedded
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true; stencil: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false"
            scene-environment="exposure: 1.0"
            fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <a-entity
              id="scene-camera"
              camera="active: true; fov: 45; near: 0.01; far: 1000"
              position="0 0 0"
              orbit-camera-controls={`enableDamping: true; dampingFactor: 0.08; screenSpacePanning: true; autoRotate: ${cameraAutoRotate}; autoRotateSpeed: 1.2; minDistance: 0.2; maxDistance: 100; enableRotate: true; enablePan: true; enableZoom: true; rotateSpeed: 1.0; zoomSpeed: 1.0; panSpeed: 1.0`}
            >
              <a-light type="directional" color="#ffffff" intensity="1.2" position="0 0 1"></a-light>
            </a-entity>

            {/* Dynamic Lighting Rig */}
            <a-light type="ambient" color={ambientColor} intensity={ambientIntensity}></a-light>
            <a-light type="directional" color={dir1Color} intensity={dir1Intensity} position={dir1Position}></a-light>
            <a-light type="directional" color={dir2Color} intensity={dir2Intensity} position={dir2Position}></a-light>

            {/* Center Model Entity Anchor */}
            {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
              <a-entity position="0 0 0">
                <a-gltf-model
                  id="ar-model"
                  src={localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath}
                  position={`${modelPosX} ${modelPosY} ${modelPosZ}`}
                  scale={`${modelScale} ${modelScale} ${modelScale}`}
                  rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
                  visible={!(portalEnabled && portalHideOutsideModel)}
                  {...(modelRotSpeed > 0 && !selectedMeshUuid
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
                ar-portal={`enabled: ${portalEnabled}; shape: ${portalShape}; width: ${portalWidth}; height: ${portalHeight}; radius: ${portalRadius}; depth: ${portalDepth}; frameColor: ${portalFrameColor}; frameWidth: ${portalFrameWidth}; frameDepth: 0.08; frameEmissive: ${portalFrameEmissive}; frameEmissiveIntensity: ${portalFrameEmissiveIntensity}; frameGlow: ${portalFrameGlow}; glassTint: ${portalGlassTint}; glassOpacity: ${portalGlassOpacity}; interiorType: ${portalInteriorType}; skyboxUrl: ${portalSkyboxUrl}; interiorColor: ${portalInteriorColor}; wallColor: ${portalWallColor}; floorColor: ${portalFloorColor}; gridColor: ${portalGridColor}; interiorLightColor: ${portalLightColor}; interiorLightIntensity: ${portalLightIntensity}; interiorModelType: ${portalModelType}; artifactType: ${portalArtifactType}; customModelUrl: ${portalCustomModelUrl}; currentModelUrl: ${localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath || ''}; modelScale: ${portalModelScale}; modelPosX: ${portalModelPosX}; modelPosY: ${portalModelPosY}; modelPosZ: ${portalModelPosZ}; modelRotSpeed: ${portalModelRotSpeed}; modelRotX: ${portalModelRotX}; modelRotY: ${portalModelRotY}; modelRotZ: ${portalModelRotZ}; showVideo: ${portalShowVideo}; videoUrl: ${portalVideoUrl || activeVideoUrl || ''}; videoScale: ${portalVideoScale}; videoPosY: ${portalVideoPosY}; videoPosZ: ${portalVideoPosZ}; particles: ${portalParticles}; particleCount: ${portalParticleCount}; particleColor: ${portalParticleColor}; particleSpeed: ${portalParticleSpeed}; floatingText: ${portalFloatingText}; textColor: ${portalTextColor}; textScale: ${portalTextScale}; textPosY: ${portalTextPosY}; textPosZ: ${portalTextPosZ}; posX: ${portalPosX}; posY: ${portalPosY}; posZ: ${portalPosZ}; rotX: ${portalRotX}; rotY: ${portalRotY}; rotZ: ${portalRotZ};`}
              ></a-entity>
            )}
          </a-scene>
        ) : (
          !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 space-y-4 p-8 text-center pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-indigo-400 shadow-xl">
                <span className="material-symbols-outlined text-3xl">view_in_ar</span>
              </div>
              <div className="max-w-md space-y-1">
                <p className="text-base font-semibold text-neutral-300">Ready for 3D Scene Inspection</p>
                <p className="text-xs text-neutral-500">Enter a Batch ID or pick a local .glb 3D model above to calibrate orientation, positioning, and individual mesh parts.</p>
              </div>
            </div>
          )
        )}

        {/* Interactive Camera View Angle Presets Toolbar (Studio4D4 Style) */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-sm text-indigo-400">videocam</span> Views
            </span>
            <button
              type="button"
              onClick={() => setCameraView('perspective')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Studio 3/4 Perspective View"
            >
              Perspective
            </button>
            <button
              type="button"
              onClick={() => setCameraView('front')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Direct Front-Facing View"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setCameraView('back')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Back View"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setCameraView('left')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Left View"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => setCameraView('right')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Right View"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => setCameraView('top')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Top-Down View"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setCameraView('bottom')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Bottom-Up View"
            >
              Bottom
            </button>
            <div className="w-[1px] h-4 bg-slate-700 mx-0.5"></div>
            <button
              type="button"
              onClick={() => setCameraView('reset')}
              className="px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all flex items-center gap-1"
              title="Reset View to Studio Perspective (F)"
            >
              <span className="material-symbols-outlined text-xs">restart_alt</span>
            </button>
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
        </div>

        {/* Floating Active Target HUD Indicator */}
        {(localGlbUrl || arData?.arExperience?.modelUrl || arData?.gltfPath) && (
          <div className="absolute top-5 left-[132px] z-40 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-neutral-700 text-xs font-medium text-neutral-200 shadow-xl flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${selectedMesh ? 'bg-indigo-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>
                {selectedMesh ? (
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
    </div>
  );
};

export default ARTest;
