// src/pages/AdminArApiDocs.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BUILTIN_API_PRESETS, AR_SCENE_API_VERSION } from '../utils/arSceneApi';

export default function AdminArApiDocs() {
  const [copiedSection, setCopiedSection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('full-guide');

  const copyToClipboard = (text, sectionId) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(''), 2500);
  };

  const GEMINI_SYSTEM_PROMPT = `You are an expert 3D Scene Architect and Spatial Computing Engineer for Star weAR's AR-Test engine.
Your role is to analyze 2D images of objects, nature, architecture, products, or fantasy scenes, and decompose them into an executable 3D AR Scene specification formatted strictly in AR-Test API JSON.

### SCENE RECONSTRUCTION RULES:
1. COORDINATES & SCALE:
   - Units are meters (1.0 = 1 meter in real world AR).
   - Coordinates: +Y is UP, -Z is FORWARD (depth away from camera), +X is RIGHT.
   - Rotations are in degrees [rotX, rotY, rotZ].
   - Default primary ground is at Y = 0.

2. SHAPES (PRIMITIVES & VECTOR PATHS):
   - Decompose complex objects into foundational geometries:
     * Trunks/Pillars/Stems: tapered cylinders (radiusTop, radiusBottom, height).
     * Foliage/Heads/Canopies: spheres, ellipsoids, or capsules.
     * Leaves/Roofs/Cones: cones or pyramids.
     * Pedestals/Boxes/Walls: boxes or cylinders with radialSegments: 8 for octagons.
     * Organic Silhouettes: type 'vectorExtrude' with 2D polygon points: [[x1, y1], [x2, y2], ...] on 100x100 grid.

3. MULTI-LAYER SURFACE SCATTERING:
   - Do NOT build thousands of manual leaves. Assign scatter layers to host geometries!
   - Set 'target' to the shape's exact name (e.g. target: "Tree Canopy Core").
   - Choose appropriate prototypes: 'leaf', 'grass', 'flower', 'clover', 'pine', 'pebble', 'crystal'.
   - Enable 'normalAlign: true' so prototypes orient naturally along the geometry surface.
   - Set 'normalOffset: 0.005' to float slightly above the surface.

4. LIGHTING & ATMOSPHERE:
   - Provide realistic sun/key light (dir1) and ambient fill.
   - Add targeted spots or colored rim lights to emphasize silhouette contours.
   - Add subtle particle systems (pollen, embers, stardust) to provide depth cues.

5. OUTPUT FORMAT:
   - Output ONLY clean, valid JSON enclosed in a \`\`\`json markdown code block.
   - Follow the root structure: { "ar_scene": { "metadata": {...}, "scene": {...}, "transform": {...}, "lighting": {...}, "shapes": [...], "scatterLayers": [...], "text3d": [...], "particles": {...} } }`;

  const TREE_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[0].payload, null, 2);
  const CYBER_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[1].payload, null, 2);
  const PORTAL_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[2].payload, null, 2);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-24">
      {/* Top Banner / Navigation Bar */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/docs"
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
            title="Back to Admin Docs"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                AR-Test AI API & Vision Specification
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                v{AR_SCENE_API_VERSION} • Single-Page Reference
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Complete documentation resource for Google Gemini & Google NotebookLM ingestion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/ar-test"
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-sm text-emerald-400">view_in_ar</span>
            <span>Open AR-Test Studio</span>
          </Link>
          <button
            type="button"
            onClick={() => copyToClipboard(GEMINI_SYSTEM_PROMPT, 'gemini-prompt')}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {copiedSection === 'gemini-prompt' ? 'done' : 'content_copy'}
            </span>
            <span>{copiedSection === 'gemini-prompt' ? 'Copied Prompt!' : 'Copy Gemini Prompt'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-12">
        {/* Intro Alert Box */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-neutral-900 border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-lg">menu_book</span>
            <span>Google NotebookLM & Gemini Knowledge Source</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            This document is designed as a comprehensive, single-page specification. You can copy this URL or the raw markdown content directly into <strong>Google NotebookLM</strong> or as a <strong>System Instruction in Google Gemini</strong>. When you upload a 2D photo of any object (e.g., an oak tree, a cyber shoe, a house, a product display), Gemini will analyze the photo and output the exact JSON payload required for the AR-Test API.
          </p>
        </div>

        {/* SECTION 1: GEMINI SYSTEM PROMPT */}
        <section id="system-prompt" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                01
              </span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Google Gemini System Prompt Template
              </h2>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(GEMINI_SYSTEM_PROMPT, 'system-prompt-btn')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              <span>{copiedSection === 'system-prompt-btn' ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          <p className="text-xs text-neutral-400">
            Paste this instruction block into Google AI Studio (System Instructions) or Gemini Custom Gems:
          </p>

          <pre className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {GEMINI_SYSTEM_PROMPT}
          </pre>
        </section>

        {/* SECTION 2: SPATIAL CONVENTIONS & COORDINATE RULES */}
        <section id="spatial-conventions" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            <span className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs">
              02
            </span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Spatial Conventions & Coordinate System
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Unit Scale</span>
              <p className="text-sm font-semibold text-white">1.0 = 1 Meter</p>
              <p className="text-[11px] text-neutral-400">All coordinates and dimensions operate on standard real-world metric scale.</p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Orientation</span>
              <p className="text-sm font-semibold text-white">+Y Up • -Z Forward</p>
              <p className="text-[11px] text-neutral-400">+X is Right, +Y is Height, -Z points into the scene depth away from camera.</p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Rotations</span>
              <p className="text-sm font-semibold text-white">Euler Degrees (0° - 360°)</p>
              <p className="text-[11px] text-neutral-400">Rotations are specified in intuitive Euler degrees: [rotX, rotY, rotZ].</p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
              <span className="text-xs font-bold text-pink-400 uppercase tracking-wider">Colors</span>
              <p className="text-sm font-semibold text-white">Hex Codes (#RRGGBB)</p>
              <p className="text-[11px] text-neutral-400">All colors, emissives, and tints use standard hex strings like #38bdf8 or #4ade80.</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: SUBSYSTEM BREAKDOWN */}
        <section id="subsystems" className="space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">
              03
            </span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              AR-Test Subsystems & Feature Reference
            </h2>
          </div>

          <div className="space-y-6">
            {/* 3A. Shapes & Geometries */}
            <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-cyan-400">shapes</span>
                  <span>A. Procedural Shapes & Extrusions (<code>shapes</code>)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                  16 Supported Geometry Types
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                Procedural 3D solids created in WebGL. Supports parametric primitives and custom 2D polygon vector extrusions.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                {['box', 'cylinder', 'sphere', 'cone', 'torus', 'plane', 'ring', 'vectorExtrude', 'torusKnot', 'capsule', 'dodecahedron', 'vectorInflate'].map((typ) => (
                  <div key={typ} className="p-2 rounded bg-neutral-950 border border-neutral-800/80 text-neutral-300">
                    <span className="text-cyan-400 font-bold">{typ}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
                <span className="font-semibold text-neutral-200">Key Parameters:</span>
                <ul className="list-disc list-inside text-neutral-400 space-y-1">
                  <li><code className="text-cyan-300">cylinder</code>: <code>radiusTop, radiusBottom, height, radialSegments</code> (ideal for tree trunks, pillars, and pedestals)</li>
                  <li><code className="text-cyan-300">sphere</code>: <code>radius, widthSegments, heightSegments</code> (ideal for foliage clusters, tree crowns)</li>
                  <li><code className="text-cyan-300">cone</code>: <code>radius, height, radialSegments</code> (ideal for tree branches, spikes, tents)</li>
                  <li><code className="text-cyan-300">vectorExtrude</code>: <code>points: [[x, y], ...], depth: 0.2</code> (draw custom organic contours on 100x100 grid)</li>
                </ul>
              </div>
            </div>

            {/* 3B. Multi-Layer Scatter System */}
            <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-400">grass</span>
                  <span>B. Multi-Layer Surface Scattering (<code>scatterLayers</code>)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  Hardware Instanced (THREE.InstancedMesh)
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                Distributes foliage, pebbles, crystals, or grass blades across any host surface in 1 WebGL draw call. When scatter is created, it becomes an independent layer that can be moved, rotated, and scaled.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                {['leaf (broad foliage)', 'grass (field blades)', 'flower (meadow petals)', 'clover (shamrock)', 'pine (needles)', 'pebble (river stones)', 'crystal (shards)', 'cube / sphere / cone'].map((proto) => (
                  <div key={proto} className="p-2 rounded bg-neutral-950 border border-neutral-800/80 text-emerald-300">
                    <span>{proto}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
                <span className="font-semibold text-neutral-200">Scatter Layer Parameters:</span>
                <ul className="list-disc list-inside text-neutral-400 space-y-1">
                  <li><code className="text-emerald-300">target</code>: <code>"#ar-model"</code> (whole model) or the <code>name</code> of any shape (e.g. <code>"Tree Canopy Core"</code>).</li>
                  <li><code className="text-emerald-300">count</code>: Number of instances (10 to 3000, e.g. <code>250</code>).</li>
                  <li><code className="text-emerald-300">normalAlign</code>: <code>true</code> (aligns prototype perpendicular to surface contours).</li>
                  <li><code className="text-emerald-300">normalOffset</code>: Elevation offset in meters (e.g. <code>0.005</code>).</li>
                  <li><code className="text-emerald-300">colorVariation</code>: Natural HSL color jitter (0.0 to 1.0, e.g. <code>0.25</code>).</li>
                  <li><code className="text-emerald-300">posX, posY, posZ, rotX, rotY, rotZ, scale</code>: Live layer spatial offset.</li>
                </ul>
              </div>
            </div>

            {/* 3C. 3D Typography */}
            <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-pink-400">title</span>
                <span>C. 3D Typography Text (<code>text3d</code>)</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Extruded 3D typography with beveled edges, metallic PBR shaders, and emissive neon glow.
              </p>
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1 text-xs text-neutral-400">
                <p><code className="text-pink-300">text</code>: String to display.</p>
                <p><code className="text-pink-300">fontFamily</code>: <code>'helvetiker_bold'</code>, <code>'optimer_bold'</code>, <code>'gentilis_bold'</code>, <code>'droid_sans_bold'</code>.</p>
                <p><code className="text-pink-300">size</code>, <code className="text-pink-300">depth</code>, <code className="text-pink-300">bevelEnabled</code>: Typography geometry parameters.</p>
                <p><code className="text-pink-300">emissive</code> & <code className="text-pink-300">emissiveIntensity</code>: Glowing neon appearance.</p>
              </div>
            </div>

            {/* 3D. Lighting System */}
            <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-amber-400">lightbulb</span>
                <span>D. Multi-Source Lighting (<code>lighting</code>)</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Ambient illumination, directional sunlight/fill, rim lighting, and custom positional spot/point lights.
              </p>
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1 text-xs text-neutral-400">
                <p><code className="text-amber-300">ambientColor</code> & <code className="text-amber-300">ambientIntensity</code>: Soft sky fill (e.g. #ffffff, 1.4).</p>
                <p><code className="text-amber-300">dir1Color</code> & <code className="text-amber-300">dir1Position</code>: Main key sunlight (e.g. #fffbeb at '2 4 3').</p>
                <p><code className="text-amber-300">customLights</code>: Array of individual lights of type <code>'point'</code>, <code>'spot'</code>, or <code>'directional'</code> with posX, posY, posZ, and target coordinates.</p>
              </div>
            </div>

            {/* 3E. Particles & Atmosphere */}
            <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-purple-400">auto_awesome</span>
                <span>E. GPU Particle Atmosphere (<code>particles</code>)</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Floating environmental particles: <code>'cosmic-stardust'</code>, <code>'mystic-fireflies'</code>, <code>'amber-embers'</code>, <code>'cyber-matrix'</code>, <code>'cherry-blossom'</code>, <code>'winter-snowfall'</code>.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: CASE STUDY - 2D IMAGE TO 3D TREE */}
        <section id="tree-case-study" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                04
              </span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Case Study: 2D Picture of a Tree ➔ 3D AR Scene
              </h2>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(TREE_CASE_STUDY_JSON, 'tree-json')}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              <span>{copiedSection === 'tree-json' ? 'Copied!' : 'Copy Tree JSON'}</span>
            </button>
          </div>

          <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3 text-xs text-neutral-300 leading-relaxed">
            <h3 className="text-sm font-bold text-emerald-400">Step-by-Step Gemini Analysis:</h3>
            <ol className="list-decimal list-inside space-y-2 text-neutral-300">
              <li>
                <strong>Trunk & Base Deconstruction:</strong> The trunk is modeled with a tapered cylinder (<code>radiusBottom: 0.38, radiusTop: 0.22, height: 0.8</code>, color <code>#5c3a21</code>) rooted onto a grassy circular mound.
              </li>
              <li>
                <strong>Canopy Core:</strong> Instead of building individual leaves manually, a spherical shape named <code>"Tree Canopy Core"</code> (radius 0.65, posY: 0.95) provides the 3D volume for the crown.
              </li>
              <li>
                <strong>Foliage Scatter Layer:</strong> A scatter layer targets <code>"Tree Canopy Core"</code> using prototype <code>"leaf"</code>, instance count <code>450</code>, color <code>#4ade80</code>, and <code>normalAlign: true</code>.
              </li>
              <li>
                <strong>Ground Sprouts & River Stones:</strong> Two additional scatter layers target <code>"Tree Base Mound"</code>: one with <code>"grass"</code> (320 instances) and one with <code>"pebble"</code> (80 instances).
              </li>
              <li>
                <strong>Sunlight & Atmosphere:</strong> A directional sunlight angled from above with warm tint <code>#fef08a</code>, accompanied by floating firefly / pollen particles.
              </li>
            </ol>
          </div>

          <pre className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-96">
            {TREE_CASE_STUDY_JSON}
          </pre>
        </section>

        {/* SECTION 5: ADDITIONAL FULL JSON EXAMPLES */}
        <section id="examples" className="space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-xs">
              05
            </span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Additional Production JSON Examples
            </h2>
          </div>

          <div className="space-y-4">
            {/* Cyberpunk Example */}
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Example 2: Cyberpunk Neon Monument with 3D Text & Crystal Scatter
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(CYBER_CASE_STUDY_JSON, 'cyber-json')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  <span>{copiedSection === 'cyber-json' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-neutral-950 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap max-h-64">
                {CYBER_CASE_STUDY_JSON}
              </pre>
            </div>

            {/* Portal Example */}
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Example 3: Ethereal Cosmic AR Portal Gateway
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(PORTAL_CASE_STUDY_JSON, 'portal-json')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  <span>{copiedSection === 'portal-json' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-neutral-950 text-xs font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap max-h-64">
                {PORTAL_CASE_STUDY_JSON}
              </pre>
            </div>
          </div>
        </section>

        {/* SECTION 6: HOW TO USE IN AR-TEST */}
        <section id="workflow" className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
              06
            </span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              How to Execute in AR-Test Studio
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-300">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center text-xs">1</span>
              <p className="font-semibold text-white">Ask Gemini with Image</p>
              <p className="text-neutral-400">Upload any 2D image to Google Gemini using the prompt provided in Section 1. Copy the resulting JSON.</p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 font-bold flex items-center justify-center text-xs">2</span>
              <p className="font-semibold text-white">Open "🤖 AI Scene API"</p>
              <p className="text-neutral-400">In AR-Test, click the <strong>🤖 AI Scene API</strong> button in the top action toolbar to open the constructor modal.</p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-400 font-bold flex items-center justify-center text-xs">3</span>
              <p className="font-semibold text-white">Construct 3D Scene</p>
              <p className="text-neutral-400">Paste the JSON into the input box and click <strong>"Construct 3D Scene"</strong>. The scene will instantiate instantly with full 3D Gizmo and editing controls!</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
