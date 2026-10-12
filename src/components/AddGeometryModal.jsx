/* eslint-disable react/prop-types */
import { useState } from 'react';

const GEOMETRY_DEFINITIONS = [
  {
    id: 'box',
    name: 'Cube / Box',
    category: 'Basics',
    icon: 'view_in_ar',
    description: 'Six-sided rectangular prism with adjustable dimensions and subdivision faces.',
    defaultParams: { width: 1, height: 1, depth: 1, widthSegments: 1, heightSegments: 1, depthSegments: 1 },
    paramConfigs: [
      { key: 'width', label: 'Width (X)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'height', label: 'Height (Y)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'depth', label: 'Depth (Z)', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'widthSegments', label: 'Segments (Subdivisions)', min: 1, max: 16, step: 1 }
    ]
  },
  {
    id: 'sphere',
    name: 'UV Sphere',
    category: 'Curved',
    icon: 'sports_volleyball',
    description: 'Smooth 3D sphere with latitude and longitude subdivision density.',
    defaultParams: { radius: 0.6, widthSegments: 32, heightSegments: 32 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 5, step: 0.05, unit: 'm' },
      { key: 'widthSegments', label: 'Radial Segments', min: 8, max: 64, step: 2 },
      { key: 'heightSegments', label: 'Height Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'cylinder',
    name: 'Cylinder / Column',
    category: 'Basics',
    icon: 'database',
    description: 'Cylindrical column or disc with independent top and bottom radii.',
    defaultParams: { radiusTop: 0.5, radiusBottom: 0.5, height: 1.2, radialSegments: 32 },
    paramConfigs: [
      { key: 'radiusTop', label: 'Top Radius', min: 0.0, max: 4, step: 0.05, unit: 'm' },
      { key: 'radiusBottom', label: 'Bottom Radius', min: 0.05, max: 4, step: 0.05, unit: 'm' },
      { key: 'height', label: 'Height', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'cone',
    name: 'Cone / Pyramid',
    category: 'Basics',
    icon: 'change_history',
    description: 'Tapered circular or faceted cone with sharp apex point.',
    defaultParams: { radius: 0.6, height: 1.3, radialSegments: 32 },
    paramConfigs: [
      { key: 'radius', label: 'Base Radius', min: 0.1, max: 5, step: 0.05, unit: 'm' },
      { key: 'height', label: 'Height', min: 0.1, max: 8, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 3, max: 64, step: 1 }
    ]
  },
  {
    id: 'torus',
    name: 'Torus (Donut)',
    category: 'Curved',
    icon: 'album',
    description: 'Ring torus donut shaped geometry with cross-sectional tube thickness.',
    defaultParams: { radius: 0.65, tube: 0.22, radialSegments: 24, tubularSegments: 48 },
    paramConfigs: [
      { key: 'radius', label: 'Ring Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'tube', label: 'Tube Thickness', min: 0.02, max: 1.5, step: 0.02, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 48, step: 2 },
      { key: 'tubularSegments', label: 'Tubular Segments', min: 16, max: 96, step: 4 }
    ]
  },
  {
    id: 'torusKnot',
    name: 'Torus Knot',
    category: 'Curved',
    icon: 'all_inclusive',
    description: 'Complex topological knot wound around a mathematical torus.',
    defaultParams: { radius: 0.55, tube: 0.16, tubularSegments: 80, radialSegments: 16, p: 2, q: 3 },
    paramConfigs: [
      { key: 'radius', label: 'Overall Radius', min: 0.1, max: 3, step: 0.05, unit: 'm' },
      { key: 'tube', label: 'Tube Thickness', min: 0.02, max: 0.8, step: 0.02, unit: 'm' },
      { key: 'p', label: 'P Factor (Rotational Loops)', min: 1, max: 8, step: 1 },
      { key: 'q', label: 'Q Factor (Internal Loops)', min: 1, max: 8, step: 1 }
    ]
  },
  {
    id: 'capsule',
    name: 'Capsule (Pill)',
    category: 'Curved',
    icon: 'reorder',
    description: 'Cylindrical shaft capped with hemispherical domes at both ends.',
    defaultParams: { radius: 0.4, length: 0.9, capSegments: 8, radialSegments: 24 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 3, step: 0.05, unit: 'm' },
      { key: 'length', label: 'Cylinder Length', min: 0.1, max: 6, step: 0.1, unit: 'm' },
      { key: 'radialSegments', label: 'Radial Segments', min: 8, max: 48, step: 2 }
    ]
  },
  {
    id: 'plane',
    name: 'Plane / Backdrop',
    category: 'Surfaces',
    icon: 'crop_portrait',
    description: 'Flat planar surface, suitable for ground backdrops, walls, and screens.',
    defaultParams: { width: 2.5, height: 2.5, widthSegments: 1, heightSegments: 1 },
    paramConfigs: [
      { key: 'width', label: 'Width (X)', min: 0.1, max: 15, step: 0.2, unit: 'm' },
      { key: 'height', label: 'Height (Y)', min: 0.1, max: 15, step: 0.2, unit: 'm' },
      { key: 'widthSegments', label: 'Grid Divisions', min: 1, max: 20, step: 1 }
    ]
  },
  {
    id: 'ring',
    name: 'Ring / Flat Disc',
    category: 'Surfaces',
    icon: 'adjust',
    description: 'Two-dimensional annular ring or flat disc with inner cutout hole.',
    defaultParams: { innerRadius: 0.35, outerRadius: 0.85, thetaSegments: 32 },
    paramConfigs: [
      { key: 'innerRadius', label: 'Inner Radius (Hole)', min: 0.05, max: 3, step: 0.05, unit: 'm' },
      { key: 'outerRadius', label: 'Outer Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'thetaSegments', label: 'Circumference Segments', min: 8, max: 64, step: 2 }
    ]
  },
  {
    id: 'icosahedron',
    name: 'Icosahedron (Crystal)',
    category: 'Polyhedra',
    icon: 'diamond',
    description: 'Regular 20-sided polyhedron, perfect for gemstones and low-poly art.',
    defaultParams: { radius: 0.7, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'dodecahedron',
    name: 'Dodecahedron',
    category: 'Polyhedra',
    icon: 'token',
    description: 'Symmetric 12-sided regular polyhedron with pentagonal faces.',
    defaultParams: { radius: 0.7, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  },
  {
    id: 'tetrahedron',
    name: 'Tetrahedron',
    category: 'Polyhedra',
    icon: 'details',
    description: 'Four-faced triangular pyramid polyhedron with sharp geometric lines.',
    defaultParams: { radius: 0.75, detail: 0 },
    paramConfigs: [
      { key: 'radius', label: 'Radius', min: 0.1, max: 4, step: 0.05, unit: 'm' },
      { key: 'detail', label: 'Subdivision Detail Level', min: 0, max: 4, step: 1 }
    ]
  }
];

const MATERIAL_PRESETS = [
  { id: 'standard', name: 'Standard PBR', roughness: 0.35, metalness: 0.15, clearcoat: 0.0 },
  { id: 'chrome', name: 'Chrome Metallic', roughness: 0.12, metalness: 0.95, clearcoat: 0.3 },
  { id: 'satin', name: 'Frosted Satin', roughness: 0.22, metalness: 0.05, clearcoat: 0.8 },
  { id: 'clay', name: 'Matte Clay', roughness: 0.92, metalness: 0.0, clearcoat: 0.0 },
  { id: 'gloss', name: 'Gloss Lacquer', roughness: 0.08, metalness: 0.05, clearcoat: 0.6 }
];

const COLOR_SWATCHES = [
  { name: 'Slate Blue', hex: '#526373' },
  { name: 'Cyber Cyan', hex: '#38bdf8' },
  { name: 'Neon Emerald', hex: '#10b981' },
  { name: 'Obsidian Noir', hex: '#18181b' },
  { name: 'Electric Violet', hex: '#8b5cf6' },
  { name: 'Titanium White', hex: '#f8fafc' },
  { name: 'Sunset Gold', hex: '#f59e0b' },
  { name: 'Crimson Rose', hex: '#f43f5e' }
];

export default function AddGeometryModal({
  isOpen = false,
  onClose,
  appInstance
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedGeometryId, setSelectedGeometryId] = useState('box');
  const [params, setParams] = useState({ ...GEOMETRY_DEFINITIONS[0].defaultParams });
  const [selectedColor, setSelectedColor] = useState('#526373');
  const [materialPreset, setMaterialPreset] = useState('standard');
  const [isWireframe, setIsWireframe] = useState(false);
  const [isFlatShading, setIsFlatShading] = useState(false);

  if (!isOpen) return null;

  const currentDef = GEOMETRY_DEFINITIONS.find((g) => g.id === selectedGeometryId) || GEOMETRY_DEFINITIONS[0];

  const handleSelectGeometry = (geom) => {
    setSelectedGeometryId(geom.id);
    setParams({ ...geom.defaultParams });
  };

  const handleParamChange = (key, val) => {
    setParams((prev) => ({
      ...prev,
      [key]: parseFloat(val)
    }));
  };

  const handleAddGeometry = (overrideDef = null) => {
    const defToUse = overrideDef || currentDef;
    const paramsToUse = overrideDef ? overrideDef.defaultParams : params;
    const matPresetObj = MATERIAL_PRESETS.find((m) => m.id === materialPreset) || MATERIAL_PRESETS[0];

    if (appInstance && typeof appInstance.addPrimitiveGeometry === 'function') {
      appInstance.addPrimitiveGeometry(defToUse.id, {
        params: paramsToUse,
        color: selectedColor,
        roughness: matPresetObj.roughness,
        metalness: matPresetObj.metalness,
        clearcoat: matPresetObj.clearcoat,
        wireframe: isWireframe,
        flatShading: isFlatShading,
        profile: materialPreset === 'chrome' ? 'metallic' : 'cotton',
        name: `${defToUse.name.split('/')[0].trim()}`
      });
      onClose();
    } else {
      console.error('StudioApp does not support addPrimitiveGeometry');
    }
  };

  const categories = ['All', 'Basics', 'Curved', 'Polyhedra', 'Surfaces'];
  const filteredGeometries = activeCategory === 'All'
    ? GEOMETRY_DEFINITIONS
    : GEOMETRY_DEFINITIONS.filter((g) => g.category === activeCategory);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
              <span className="material-symbols-outlined text-2xl">deployed_code</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white">
                  Add 3D Geometries & Primitives
                </h3>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono px-2 py-0.5 rounded-full font-bold">
                  STUDIO 44
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Spawn geometric meshes, adjust dimensions, and configure physical PBR surface materials.
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

        {/* Category Tabs */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Main Content Area (Two Columns) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 studio-scroll">
          
          {/* Left Column: Shape Selection Grid (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-300">Choose Shape ({filteredGeometries.length})</span>
              <span>Click to customize or quick add</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredGeometries.map((geom) => {
                const isSelected = geom.id === selectedGeometryId;
                return (
                  <div
                    key={geom.id}
                    onClick={() => handleSelectGeometry(geom)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 group relative ${
                      isSelected
                        ? 'border-sky-500 bg-sky-950/40 ring-1 ring-sky-500 shadow-md shadow-sky-500/10'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`material-symbols-outlined text-2xl transition-transform duration-200 group-hover:scale-110 ${
                        isSelected ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}>
                        {geom.icon}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {geom.category}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-xs text-white truncate">{geom.name}</div>
                      <div className="text-[10px] text-slate-400 line-clamp-1">{geom.description}</div>
                    </div>

                    {/* Quick Add Button on Hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddGeometry(geom);
                      }}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold shadow-md transition-all cursor-pointer flex items-center gap-1"
                      title="Quick spawn with standard 1m dimensions"
                    >
                      <span>+ Add</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Shape Customization & Material Configuration (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Selected Shape Banner */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-sky-400">
                {currentDef.icon}
              </span>
              <div>
                <h4 className="font-bold text-sm text-white">{currentDef.name}</h4>
                <p className="text-[11px] text-slate-400 leading-snug">{currentDef.description}</p>
              </div>
            </div>

            {/* Shape Dimensions Sliders */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Shape Dimensions & Segments
              </h5>

              <div className="space-y-2.5">
                {currentDef.paramConfigs.map((cfg) => {
                  const val = params[cfg.key] !== undefined ? params[cfg.key] : currentDef.defaultParams[cfg.key];
                  return (
                    <div key={cfg.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{cfg.label}</span>
                        <span className="font-mono text-sky-400 font-semibold">
                          {cfg.step < 1 ? Number(val).toFixed(2) : val}{cfg.unit || ''}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={cfg.min}
                        max={cfg.max}
                        step={cfg.step}
                        value={val}
                        onChange={(e) => handleParamChange(cfg.key, e.target.value)}
                        className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Material & Appearance */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                PBR Surface & Color
              </h5>

              {/* Material Preset Selector */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Material Finish</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {MATERIAL_PRESETS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMaterialPreset(m.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        materialPreset === m.id
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <div className="flex justify-between items-center mb-1.5 text-[11px] text-slate-400">
                  <span className="font-medium">Surface Tint</span>
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
                      className={`w-6 h-6 rounded-lg transition-transform cursor-pointer border ${
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
                    <span>Custom</span>
                  </label>
                </div>
              </div>

              {/* Shading Options */}
              <div className="flex items-center gap-4 pt-1 border-t border-slate-800/80 text-xs text-slate-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFlatShading}
                    onChange={(e) => setIsFlatShading(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span>Low-Poly (Flat Shading)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWireframe}
                    onChange={(e) => setIsWireframe(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500"
                  />
                  <span>Wireframe Mesh</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Adding <strong className="text-white">{currentDef.name}</strong> • Positioned at studio baseline ({selectedColor})
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleAddGeometry()}
              className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-fuchsia-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Add 3D {currentDef.name.split('/')[0].trim()} to Scene</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
