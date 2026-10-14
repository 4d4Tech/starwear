/* eslint-disable react/prop-types */
import { useState } from 'react';
import { AVAILABLE_FONTS, TEXT_MATERIAL_PRESETS } from '../utils/text3DHelper';

const QUICK_TEXT_PRESETS = [
  {
    name: 'Cyberpunk Neon',
    text: 'STAR weAR',
    fontFamily: 'helvetiker_bold',
    size: 0.35,
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.01,
    materialPreset: 'neon_cyan',
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.6,
    metalness: 0.8,
    roughness: 0.2
  },
  {
    name: '24K Polished Gold',
    text: 'STAR weAR',
    fontFamily: 'optimer_bold',
    size: 0.4,
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.012,
    materialPreset: 'gold_metallic',
    color: '#f59e0b',
    emissive: '#78350f',
    emissiveIntensity: 0.2,
    metalness: 0.95,
    roughness: 0.15
  },
  {
    name: 'Obsidian Noir',
    text: 'LIMITED EDITION',
    fontFamily: 'gentilis_bold',
    size: 0.25,
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    materialPreset: 'obsidian_chrome',
    color: '#18181b',
    emissive: '#000000',
    emissiveIntensity: 0.0,
    metalness: 0.9,
    roughness: 0.1
  },
  {
    name: 'Crimson Glow',
    text: 'EXCLUSIVE DROP',
    fontFamily: 'helvetiker_bold',
    size: 0.3,
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.01,
    materialPreset: 'crimson_glow',
    color: '#f43f5e',
    emissive: '#9f1239',
    emissiveIntensity: 0.7,
    metalness: 0.5,
    roughness: 0.3
  },
  {
    name: 'Titanium White',
    text: 'COLLECTION 2026',
    fontFamily: 'helvetiker_regular',
    size: 0.28,
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    materialPreset: 'titanium_white',
    color: '#f8fafc',
    emissive: '#000000',
    emissiveIntensity: 0.0,
    metalness: 0.3,
    roughness: 0.3
  }
];

export default function Add3DTextModal({
  isOpen = false,
  onClose,
  onAddText
}) {
  const [text, setText] = useState('STAR weAR');
  const [fontFamily, setFontFamily] = useState('helvetiker_bold');
  const [size, setSize] = useState(0.35);
  const [depth, setDepth] = useState(0.08);
  const [bevelEnabled, setBevelEnabled] = useState(true);
  const [bevelThickness, setBevelThickness] = useState(0.015);
  const [bevelSize, setBevelSize] = useState(0.01);
  const [align, setAlign] = useState('center');

  const [selectedColor, setSelectedColor] = useState('#38bdf8');
  const [emissiveColor, setEmissiveColor] = useState('#0284c7');
  const [emissiveIntensity, setEmissiveIntensity] = useState(0.5);
  const [metalness, setMetalness] = useState(0.8);
  const [roughness, setRoughness] = useState(0.25);
  const [wireframe, setWireframe] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = (preset) => {
    if (preset.text) setText(preset.text);
    if (preset.fontFamily) setFontFamily(preset.fontFamily);
    if (preset.size !== undefined) setSize(preset.size);
    if (preset.depth !== undefined) setDepth(preset.depth);
    if (preset.bevelEnabled !== undefined) setBevelEnabled(preset.bevelEnabled);
    if (preset.bevelThickness !== undefined) setBevelThickness(preset.bevelThickness);
    if (preset.bevelSize !== undefined) setBevelSize(preset.bevelSize);
    if (preset.color) setSelectedColor(preset.color);
    if (preset.emissive) setEmissiveColor(preset.emissive);
    if (preset.emissiveIntensity !== undefined) setEmissiveIntensity(preset.emissiveIntensity);
    if (preset.metalness !== undefined) setMetalness(preset.metalness);
    if (preset.roughness !== undefined) setRoughness(preset.roughness);
  };

  const handleAdd = () => {
    const payload = {
      id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: text || '3D Text',
      text: text || 'STAR weAR',
      fontFamily,
      size: Number(size),
      depth: Number(depth),
      bevelEnabled,
      bevelThickness: Number(bevelThickness),
      bevelSize: Number(bevelSize),
      align,
      color: selectedColor,
      emissive: emissiveColor,
      emissiveIntensity: Number(emissiveIntensity),
      metalness: Number(metalness),
      roughness: Number(roughness),
      wireframe,
      posX: 0,
      posY: 0.6,
      posZ: 0.05,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1.0,
      visible: true,
      rotationSpeed: 0,
      bobbingSpeed: 0,
      bobbingHeight: 0
    };

    if (typeof onAddText === 'function') {
      onAddText(payload);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <span className="material-symbols-outlined text-xl">title</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Add 3D Text to Scene
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Extruded WebGL
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Generate extruded 3D typography with custom typeface geometries, bevels & PBR shaders.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Quick Style Presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-pink-400">auto_awesome</span>
              Quick Style Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_TEXT_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-pink-500/50 text-left transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-200 group-hover:text-pink-300 truncate">
                      {p.name}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-400 truncate">
                      {p.fontFamily.split('_')[0]} • {p.color}
                    </p>
                  </div>
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 ml-2 border border-black/50 shadow"
                    style={{ backgroundColor: p.color }}
                  ></span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Content & Typography */}
          <div className="space-y-3 pt-3 border-t border-neutral-800/80">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">Text Content</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter 3D text..."
                className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white font-semibold focus:outline-none focus:border-pink-500 shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Typeface Font</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-pink-500"
                >
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Text Alignment</label>
                <div className="grid grid-cols-3 gap-1 bg-black p-1 rounded-lg border border-neutral-800">
                  {['left', 'center', 'right'].map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => setAlign(al)}
                      className={`py-1 rounded text-[11px] font-semibold capitalize transition-all ${
                        align === al
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
          </div>

          {/* Geometry Dimensions & Bevels */}
          <div className="space-y-3 pt-3 border-t border-neutral-800/80">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-neutral-300">Font Size</span>
                  <span className="font-mono text-pink-400">{size.toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={size}
                  onChange={(e) => setSize(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-neutral-300">Extrusion Depth</span>
                  <span className="font-mono text-pink-400">{depth.toFixed(3)}m</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.4"
                  step="0.01"
                  value={depth}
                  onChange={(e) => setDepth(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bevelEnabled}
                    onChange={(e) => setBevelEnabled(e.target.checked)}
                    className="rounded accent-pink-500 cursor-pointer"
                  />
                  Chamfered Edge Bevels
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">Smooth lighting highlights</span>
              </div>

              {bevelEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-1">
                      Thickness: {bevelThickness.toFixed(3)}m
                    </span>
                    <input
                      type="range"
                      min="0.005"
                      max="0.04"
                      step="0.005"
                      value={bevelThickness}
                      onChange={(e) => setBevelThickness(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-1">
                      Bevel Size: {bevelSize.toFixed(3)}m
                    </span>
                    <input
                      type="range"
                      min="0.005"
                      max="0.03"
                      step="0.005"
                      value={bevelSize}
                      onChange={(e) => setBevelSize(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colors & Materials */}
          <div className="space-y-3 pt-3 border-t border-neutral-800/80">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
              Surface Color & Shading
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <span className="text-xs font-semibold text-neutral-300">Base Color</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400">{selectedColor}</span>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-8 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                <span className="text-xs font-semibold text-neutral-300">Emissive Glow</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400">{emissiveColor}</span>
                  <input
                    type="color"
                    value={emissiveColor}
                    onChange={(e) => setEmissiveColor(e.target.value)}
                    className="w-8 h-7 bg-transparent cursor-pointer rounded border border-neutral-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Metalness</span>
                  <span className="font-mono text-neutral-300">{(metalness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={metalness}
                  onChange={(e) => setMetalness(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Roughness</span>
                  <span className="font-mono text-neutral-300">{(roughness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={roughness}
                  onChange={(e) => setRoughness(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
              <span className="text-xs text-neutral-400">Glow Intensity</span>
              <div className="flex items-center gap-2 w-48">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={emissiveIntensity}
                  onChange={(e) => setEmissiveIntensity(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-pink-400 w-8 text-right">
                  {emissiveIntensity.toFixed(1)}x
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800 bg-neutral-950/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-pink-900/30 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_box</span>
            Insert 3D Text
          </button>
        </div>
      </div>
    </div>
  );
}
