// src/pages/AdminArApiDocs.jsx
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BUILTIN_API_PRESETS,
  AR_SCENE_API_VERSION,
  VALID_PRIMITIVE_TYPES,
  VALID_SCATTER_PROTOTYPES,
  VALID_LIGHT_TYPES,
  VALID_FONT_FAMILIES,
  VALID_PARTICLE_PRESETS,
  VALID_PORTAL_PRESETS,
  VALID_SCENE_ENV_PRESETS,
  VALID_PROCEDURAL_PATTERNS,
  VALID_SCATTER_DISTRIBUTIONS
} from '../utils/arSceneApi';

export default function AdminArApiDocs() {
  const [copiedSection, setCopiedSection] = useState('');
  const [paramSearch, setParamSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeVectorTab, setActiveVectorTab] = useState('revolve');

  const copyToClipboard = (text, sectionId) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(''), 2500);
  };

  // ---------------------------------------------------------------------------
  // 1. MASTER GEMINI VISION SYSTEM PROMPT & TEACHING INSTRUCTION
  // ---------------------------------------------------------------------------
  const GEMINI_SYSTEM_PROMPT = `### ROLE & MISSION
You are the Lead 3D Spatial Computing Architect and Vision Reconstruction AI for Star weAR's WebAR engine ("AR-Test").
Your mission is to look at any 2D photograph, illustration, logo, or concept art (e.g., a tree, vehicle, chair, statue, sneaker, emblem, building, or fantasy environment), analyze its visual geometry, materials, and lighting, and translate it into an executable 3D AR Scene specification strictly formatted in AR-Test API JSON (v1.2.0).

---

### CORE RECONSTRUCTION PHILOSOPHY
When humans look at an image, they see continuous surfaces. In 3D AR:
1. DECOMPOSE INTO FOUNDATIONAL GEOMETRIES:
   - Break complex objects down into primitive structural bones (cylinders, spheres, cones, boxes, capsules, or custom vector extrusions).
   - Example (Tree): Trunk = tapered cylinder (radiusBottom: 0.38, radiusTop: 0.22); Branches = angled cones; Canopy Core = sphere; Ground = wide flat cylinder.
   - Example (Sneaker/Car): Chassis/Base = vectorExtrude or box; Wheels/Details = cylinders/torus.
   - Example (Vase/Bottle/Goblet): vectorRevolve around Y-axis with smooth silhouette contour.
   - Example (Plush/Badge/Pillow): vectorInflate with pillowed or elliptic curvature profile.
   - Example (Horn/Pipe/Vine): vectorSweep along helix or arc spine guide rail with twist and taper.
   - Example (Logo/Emblem/Seal): Use single-piece \`vectorExtrude\` with \`svgPath\` + \`holes\` + \`preserveOrigin: true\` for zero-seam precision, with dual-material cap/bevel shading (\`bevelColor\`, \`bevelMetalness\`).

2. PEN TOOL & CUSTOM 3D GEOMETRY SYSTEM (THE 5 VECTOR MODES):
   When reconstructing custom silhouettes, organic forms, lathe objects, swept tubes, or multi-view carved figures:

   A. DECISION TREE — WHICH VECTOR MODE TO USE?
   - "vectorRevolve": Use when the object has radial 360° rotational symmetry around a center axis (vases, wine bottles, goblets, bowls, chalices, turned table legs, columns, lampshades, domes, circular wheels, pistons). Specify the half-profile silhouette from the axis outward.
   - "vectorInflate": Use when the object is a soft, puffed, organic volume (cushions, pillows, plush toys, badges, clouds, cartoon character heads, hearts, soft food like cookies or bread). Reconstructs dual-sided volumetric cushions with smooth curvature.
   - "vectorSweep": Use when a 2D cross-section flows along a 3D curving guide rail/path with taper and twist (animal/ram horns, tentacles, twisting cables, vines, coils, pipes, nautilus spirals). Uses parallel transport Bishop frames.
   - "vectorCarve": Use when the 3D volume is defined by intersecting two orthogonal silhouettes (e.g. front elevation + top/side profile for car chassis, animal torsos, sculpted figurines).
   - "vectorExtrude": Use for planar silhouettes, logos, layered heraldic emblems, badges, shields, signs, or beveled mechanical plates with optional taper, twist, hollow shell, or dome warping.

   B. POINT & PATH INPUT SPECIFICATIONS:
   All vector modes accept coordinates in any of three interchangeable formats:
   1. Direct SVG Bezier Path String (svgPath, frontSvgPath, topSvgPath):
      - "M x y C cp1x cp1y, cp2x cp2y, x y ... Z"
      - Smooth cubic (C) and quadratic (Q) curves parsed directly via SVGLoader.
   2. Bezier Point Objects with Tangent Handles (points):
      - [ { x: 0, y: 0, type: "corner" }, { x: 0.5, y: 1.0, type: "smooth", handleIn: { x: -0.1, y: -0.2 }, handleOut: { x: 0.1, y: 0.2 } } ]
   3. Coordinate Pairs (points):
      - [ [x1, y1], [x2, y2], ... ] (faceted polygon)

   C. COORDINATE CONVENTIONS & METRIC ALIGNMENT:
   - Metric Space (Recommended): Keep coordinates in meters (typically -2.0m to +2.0m, e.g. x: 0.35, y: 0.8). When coordinates are <= 10, the engine auto-detects scaleFactor = 1.0 (real-world meters).
   - Zero-Seam Origin (preserveOrigin: true): Always set "preserveOrigin": true on vector shapes. This preserves Cartesian +Y as UP and disables auto-centering, so multi-part shapes sharing the same 2D origin remain in exact zero-seam alignment at posX: 0, posY: 0!

   D. DETAILED MODE PARAMETER SPECIFICATIONS:
   1. "vectorRevolve":
      - "revolveAxis": "Y" (vertical lathe), "X" (horizontal lathe), or "Z".
      - "revolveAngle": 360 (full revolution) or partial (e.g. 180 for cutaway half-section).
      - "axisOffset": 0.0 (solid center) or > 0 (creates a hollow center tunnel, like a donut or hollow vase).
      - "revolveSegments": 24 to 64 (rotational smoothness).
      - "capEnds": true (caps end pie slices if revolveAngle < 360).
      - "points" or "svgPath": Half-profile silhouette from revolution axis outwards.

   2. "vectorInflate":
      - "depth": 0.1 to 1.0 (or independent "depthFront" and "depthBack").
      - "curvatureProfile": "elliptic" (balloon puff), "harmonic" (soft sinusoidal pillow), "spherical" (hemisphere dome), "cushion" (steep wall full top), "linear" (origami ridge tent), "pillowed" (balanced organic puff).
      - "smoothPasses": 1 to 8 (Laplacian mesh relaxation iterations for wrinkle-free organic topology).
      - "rimDepth": 0.01 to 0.1 (optional cylindrical boundary band between front and back caps).
      - "resolution": 16 to 48 (internal Steiner point grid density).
      - "symmetric": true (mirrors front profile to back).

   3. "vectorSweep":
      - "spineType": "helix" (spiral coils), "arc" (curved bend), "s_curve" (organic S-bend), "wave" (sinusoidal undulation), "linear" (straight rail).
      - "spineLength": Total physical reach in meters (e.g. 1.5m to 3.0m).
      - "spineCurvature": Curvature intensity (0.1 to 2.0).
      - "spineTwist": Total axial rotation in degrees along spine (e.g. 360, 540, 720).
      - "scaleStart" & "scaleEnd": Cross-section scale at root vs tip (e.g. 1.2 tapering to 0.15 for sharp horn).
      - "scaleProfile": "linear", "ease_out", "ease_in", "ease_in_out", "bell".
      - "spineSteps": 24 to 64 (subdivisions along the spine rail).
      - "points" or "svgPath": 2D cross-section shape (e.g. circle, diamond, polygon).

   4. "vectorExtrude":
      - "depth": Linear extrusion thickness in meters (e.g. 0.08m to 0.3m).
      - "holes": Array of 2D cutout loops for hollow letters/windows: [ [[x, y], ...], ... ].
      - "curveSegments": 12 to 64 (subdivision resolution for Bezier curves and SVG arcs).
      - "taper": Base-to-top scale multiplier (e.g. 0.7 for tapered pyramid/pillar).
      - "twist": Rotational twist in degrees along extrusion (e.g. 45° or 180° for drill).
      - "shellEnabled": true + "shellThickness": 0.03 (creates hollow container/vase with uniform wall thickness).
      - "bevelEnabled": true, "bevelThickness": 0.01-0.03, "bevelSize": 0.01-0.02.
      - "bevelSegments": 1 (sharp tactical chamfer) or 3-4 (smooth rounded fillet).
      - "domeWarpEnabled": true, "domeCurvature": 0.5, "domeWarpDepth": 0.05 (parabolic dome warping of planar face).
      - DUAL-MATERIAL CAP & BEVEL SHADING:
        Set "bevelColor" (hex), "bevelMetalness" (0.0-1.0), and "bevelRoughness" (0.0-1.0). The front/back cap face inherits the primary shape material (group 0), while side walls and bevel chamfers render with this secondary material (group 1). Perfect for gold-rimmed emerald badges, chrome-framed emblems, and two-tone medals!

   5. "vectorCarve":
      - "frontSvgPath" or "frontPoints": Front elevation silhouette.
      - "topSvgPath" or "topSidePoints": Top or side cross-section silhouette.
      - "carveView": "top" or "side".
      - "carveResolution": 24 to 48.
      - "carveSmooth": 1 to 4.

3. CURVED PATH TYPOGRAPHY & TEXT BANNERS (text3d[]):
   To recreate arched headers, round seal text, or curved ribbon slogans:
   - "curveRadius": Bends text along a circular arc in physical meters.
     - Positive (+1.2): Arch bends downward like a rainbow / arched header banner over a logo.
     - Negative (-1.2): Arch smiles upward like a ribbon / seal footer under an emblem.
   - "letterSpacing": Kerning distance in meters (e.g. 0.015 to 0.04) to space out letters along the curve.
   - "startAngle" & "endAngle" (Optional): Manual sweep angles in radians (e.g. -0.8 to +0.8). If omitted, the engine automatically centers text symmetrically along the arc apex.

4. TACTILE PATTERNS & MIRROR CHROME REFLECTIONS:
   - PROCEDURAL SURFACE PATTERNS (\`pattern\`): Apply \`"pattern": "honeycomb" | "carbon-fiber" | "brushed-metal" | "grid" | "dots" | "camo" | "gingham" | "checkerboard" | "twill-crosshatch"\` with \`patternScale\` (4-16), \`patternColor\`, and \`patternSecondaryColor\` (e.g. for gingham check or racing flag checkerboard) to give surfaces rich physical texture without extra geometry.
   - ENVIRONMENT REFLECTION MAPS (\`scene.envPreset\`): When using high metalness (0.85-1.0), ALWAYS set \`scene.envPreset: "studio-chrome" | "city" | "sunset" | "forest" | "cyber" | "neutral"\` with \`envIntensity: 1.0-2.0\` to produce real mirror reflections!

5. NEVER MANUALLY SPAWN HUNDREDS OF MESHES FOR FOLIAGE/PARTICLES:
   - Use our Hardware-Instanced Multi-Layer Scatter System (\`scatterLayers\`).
   - Define a host shape with a descriptive \`name\` (e.g. \`"Tree Canopy Core"\` or \`"Ground Mound"\`).
   - Create a \`scatterLayers\` entry targeting that exact name (\`target: "Tree Canopy Core"\`).
   - Set \`prototype: "leaf"\` (or "grass", "pine", "flower", "pebble", "crystal").
   - Set \`distribution: "hex-grid"\` for uniform honeycomb tiling, or \`"random"\` for organic foliage.
   - Set \`normalAlign: true\` so leaves grow outward along the surface normals.
   - Set \`colorVariation: 0.25\` to produce natural multi-tone botanical coloration.

6. SPATIAL & METRIC CONVENTIONS:
   - 1.0 unit = 1.0 meter in real-world physical space.
   - Tabletop objects (shoes, logos, small plants, mugs): 0.15m to 0.5m tall.
   - Full-scale objects (trees, people, furniture, portals): 1.2m to 3.0m tall.
   - Coordinates: +X is RIGHT, +Y is UP, -Z is FORWARD (depth away from camera).
   - Rotations are in Euler degrees: [rotX, rotY, rotZ]. Note: \`rotX: 90\` orients horizontal models upright on tabletop AR markers.
   - Colors are hex strings (\`#38bdf8\`, \`#5c3a21\`, \`#4ade80\`).

---

### STRICT ENUM VOCABULARY (DO NOT INVENT NON-EXISTENT TYPES)
- Shapes (shapes[].type):
  ["box", "sphere", "cylinder", "cone", "torus", "torusKnot", "capsule", "plane", "ring", "icosahedron", "dodecahedron", "tetrahedron", "vectorExtrude", "vectorInflate", "vectorRevolve", "vectorSweep", "vectorCarve"]
- Environment Presets (scene.envPreset):
  ["studio-chrome", "city", "sunset", "forest", "night", "cyber", "neutral", "none"]
- Procedural Patterns (shapes[].pattern):
  ["none", "honeycomb", "carbon-fiber", "brushed-metal", "grid", "dots", "camo", "gingham", "checkerboard", "twill-crosshatch"]
- Scatter Distributions (scatterLayers[].distribution):
  ["random", "grid", "hex-grid"]
- Scatter Prototypes (scatterLayers[].prototype):
  ["leaf", "grass", "flower", "clover", "pine", "pebble", "crystal", "box", "sphere", "cone", "cylinder"]
- Font Families (text3d[].fontFamily):
  ["helvetiker_bold", "helvetiker_regular", "optimer_bold", "optimer_regular", "gentilis_bold", "gentilis_regular", "droid_sans_bold", "droid_sans_regular", "droid_serif_bold", "droid_serif_regular"]
- Light Types (lighting.customLights[].type):
  ["point", "spot", "directional", "hemisphere"]
- Particle Presets (particles.preset):
  ["cosmic-stardust", "mystic-fireflies", "amber-embers", "cyber-matrix", "cherry-blossom", "winter-snowfall", "golden-sparkles", "toxic-spores", "deep-ocean", "electric-storm"]
- Portal Presets (portal.preset):
  ["cosmic-nebula", "cyber-grid", "emerald-forest", "sunset-horizon", "deep-ocean", "quantum-void"]
- Scatter Distributions (scatterLayers[].distribution):
  ["random", "grid", "hex-grid"]
- Scatter Prototypes (scatterLayers[].prototype):
  ["leaf", "grass", "flower", "clover", "pine", "pebble", "crystal", "box", "sphere", "cone", "cylinder"]
- Font Families (text3d[].fontFamily):
  ["helvetiker_bold", "helvetiker_regular", "optimer_bold", "optimer_regular", "gentilis_bold", "gentilis_regular", "droid_sans_bold", "droid_sans_regular", "droid_serif_bold", "droid_serif_regular"]
- Light Types (lighting.customLights[].type):
  ["point", "spot", "directional", "hemisphere"]
- Particle Presets (particles.preset):
  ["cosmic-stardust", "mystic-fireflies", "amber-embers", "cyber-matrix", "cherry-blossom", "winter-snowfall", "golden-sparkles", "toxic-spores", "deep-ocean", "electric-storm"]
- Portal Presets (portal.preset):
  ["cosmic-nebula", "cyber-grid", "emerald-forest", "sunset-horizon", "deep-ocean", "quantum-void"]

---

### STEP-BY-STEP IMAGE ANALYSIS PROTOCOL:
When given an image:
Step 1 [Analyze Silhouette & Scale]: What is the subject? Estimate real-world height (e.g. 1.8m tree, 0.4m emblem, 0.3m sneaker). Determine grounding elevation (base at Y = 0 or -0.2).
Step 2 [Identify Structural Masses & Vector Modes]:
  - If radially symmetric (vase, bottle, goblet, column): use \`vectorRevolve\`.
  - If soft, organic, or cushioned (badge, plushie, cloud, heart): use \`vectorInflate\`.
  - If curving lofted tube, horn, or vine: use \`vectorSweep\` with spine guide rail.
  - If logo / emblem / typography: use \`vectorExtrude\` with \`svgPath\`, \`holes\` for interior cutouts, \`preserveOrigin: true\`, and chamfered bevels.
  - If 3D object / nature: identify base mound, central trunk/chassis, secondary limbs/brackets.
Step 3 [Assign PBR Materials & Reflections]:
  - Organic bark / wood / earth: roughness 0.85-0.95, metalness 0.0-0.05.
  - Foliage / leaves: roughness 0.6-0.7, metalness 0.05-0.1, color variation 0.25-0.35.
  - Metals / chrome / swords: roughness 0.05-0.2, metalness 0.9-1.0, and set \`scene.envPreset: "studio-chrome"\`.
  - Tactical / technical surfaces: add \`pattern: "honeycomb"\` or \`"carbon-fiber"\`.
  - Glowing elements: emissive color + emissiveIntensity 1.0-3.0.
Step 4 [Configure Scatter Foliage / Detailing]:
  - Attach scatter layer targeting core shapes with prototype 'leaf', 'grass', 'pebble', or 'crystal'.
Step 5 [Match Lighting & Shadows]:
  - Identify light direction in photo -> set dir1Position and dir1Color.
  - Add atmospheric particles or targeted spot lights.

---

### RESPONSE FORMAT:
Output ONLY valid JSON wrapped in a single \`\`\`json markdown block.
Follow this root structure:
{
  "ar_scene": {
    "metadata": {
      "name": "Descriptive Scene Title",
      "version": "1.1.0",
      "description": "Deconstructed analysis of the 2D input image"
    },
    "scene": {
      "ambientColor": "#ffffff",
      "ambientIntensity": 1.4,
      "envPreset": "studio-chrome",
      "envIntensity": 1.2,
      "exposure": 1.15,
      "fogColor": "#000000",
      "fogDensity": 0.0
    },
    "transform": {
      "scale": 0.45,
      "posX": 0,
      "posY": 0,
      "posZ": 0,
      "rotX": 90,
      "rotY": 0,
      "rotZ": 0
    },
    "lighting": {
      "ambientColor": "#ffffff",
      "ambientIntensity": 1.3,
      "dir1Color": "#fffbeb",
      "dir1Intensity": 2.8,
      "dir1Position": "3 5 2",
      "customLights": []
    },
    "shapes": [],
    "scatterLayers": [],
    "text3d": [],
    "particles": null,
    "portal": null,
    "website": null,
    "tracking": {
      "visible": true,
      "opacity": 0.85,
      "width": 1.0
    }
  }
}`;

  // ---------------------------------------------------------------------------
  // 2. EXHAUSTIVE PARAMETER DEFINITION DATASET (ALL FEATURES & VECTOR MODES)
  // ---------------------------------------------------------------------------
  const PARAMETER_DICTIONARY = [
    // Feature 1: Transform & Placement
    {
      feature: 'Transform & Placement',
      category: 'transform',
      param: 'scale',
      type: 'Float',
      range: '0.01 to 10.0',
      default: '0.4',
      description: 'Uniform 3D scale multiplier for the entire AR scene. 1.0 unit = 1.0 meter in WebXR AR. Tabletop scale: 0.2 to 0.5. Full human scale: 1.0 to 2.5.'
    },
    {
      feature: 'Transform & Placement',
      category: 'transform',
      param: 'posX, posY, posZ',
      type: 'Float (meters)',
      range: '-10.0 to 10.0',
      default: '0.0, 0.0, 0.0',
      description: 'Global 3D translational origin in meters. +X is Right, +Y is Height (Up), -Z is Forward depth away from camera. Note: In standard 1m marker calibration, physical marker surface is at posY = -0.296m.'
    },
    {
      feature: 'Transform & Placement',
      category: 'transform',
      param: 'rotX, rotY, rotZ',
      type: 'Float (degrees)',
      range: '0° to 360°',
      default: '90, 0, 0',
      description: 'Euler rotations. For tabletop WebAR image targets lying flat on a surface, rotX: 90 rotates vertical standing objects upright perpendicular to the horizontal tracking marker.'
    },

    // Feature 2: Scene Environment & Fog
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'ambientColor',
      type: 'Hex Color',
      range: '#000000 to #ffffff',
      default: '#ffffff',
      description: 'Global base ambient environmental color tint that fills all shadowed surfaces.'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'ambientIntensity',
      type: 'Float',
      range: '0.0 to 5.0',
      default: '1.4',
      description: 'Brightness multiplier for global ambient environmental lighting.'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'fogColor',
      type: 'Hex Color',
      range: '#000000 to #ffffff',
      default: '#000000',
      description: 'Atmospheric depth fog color (e.g. #064e3b for misty forest, #09090b for deep space).'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'fogDensity',
      type: 'Float',
      range: '0.0 to 0.1',
      default: '0.0',
      description: 'Exponential atmospheric fog density. 0.015 to 0.03 gives natural aerial depth cueing.'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'envPreset',
      type: 'Enum (8 presets)',
      range: 'studio-chrome, city, sunset, forest, night, cyber, neutral, none',
      default: '"none"',
      description: 'PBR Environment reflection map (THREE.RoomEnvironment). Essential for high metalness (0.85-1.0) chrome, swords, and gold to produce crisp mirror reflections rather than dark flat grey.'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'envIntensity',
      type: 'Float',
      range: '0.0 to 3.0',
      default: '1.0',
      description: 'Brightness intensity multiplier for environment map specular reflections.'
    },
    {
      feature: 'Scene Environment',
      category: 'scene',
      param: 'exposure',
      type: 'Float',
      range: '0.5 to 2.5',
      default: '1.1',
      description: 'Tone mapping exposure multiplier for high dynamic range lighting.'
    },

    // Feature 3: Standard Geometries & Common PBR
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'id',
      type: 'String',
      range: 'Unique string',
      default: 'geom_timestamp_idx',
      description: 'Unique internal identifier for the geometry instance.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'name',
      type: 'String',
      range: 'Descriptive string',
      default: '"Shape 1"',
      description: 'CRITICAL: Human-readable name (e.g. "Tree Canopy Core", "Trunk Base", "Pedestal"). Used as the target reference in scatterLayers[].target!'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'type',
      type: 'Enum (17 types)',
      range: 'box, sphere, cylinder, cone, torus, torusKnot, capsule, plane, ring, icosahedron, dodecahedron, tetrahedron, vectorExtrude, vectorInflate, vectorRevolve, vectorSweep, vectorCarve',
      default: '"box"',
      description: '3D geometry primitive or procedural vector path generator.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'params.radiusTop / radiusBottom',
      type: 'Float (meters)',
      range: '0.01 to 10.0',
      default: '0.5',
      description: 'Top and bottom radii for type: cylinder. Setting radiusBottom: 0.38 and radiusTop: 0.22 creates an organic natural tapered tree trunk or structural pillar.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'params.radius / height',
      type: 'Float (meters)',
      range: '0.01 to 10.0',
      default: '0.5 / 1.0',
      description: 'Primary dimensions for spheres, cones, capsules, and cylinders.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'params.width / height / depth',
      type: 'Float (meters)',
      range: '0.01 to 10.0',
      default: '1.0, 1.0, 1.0',
      description: 'Dimensions in meters for type: box or type: plane.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'params.radialSegments',
      type: 'Integer',
      range: '3 to 64',
      default: '32',
      description: 'Rotational subdivision smoothness. 8 gives an architectural octagon; 24-32 gives a smooth organic curved cylinder.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'pattern',
      type: 'Enum (10 patterns)',
      range: 'none, honeycomb, carbon-fiber, brushed-metal, grid, dots, camo, gingham, checkerboard, twill-crosshatch',
      default: '"none"',
      description: 'Procedurally generated high-resolution PBR surface pattern texture. Supports gingham (woven check with semi-transparent crossing bars), checkerboard, twill-crosshatch, honeycomb, carbon-fiber, brushed-metal, grid, dots, and camo with tactile normal/bump relief.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'patternSecondaryColor',
      type: 'Hex Color',
      range: '#000000 to #ffffff',
      default: '"#ffffff"',
      description: 'Secondary contrasting color for dual-tone procedural patterns: alternating checks in checkerboard, crossing weave bars in gingham, and weft threads in twill.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'patternScale / patternColor / patternOpacity',
      type: 'Float / Hex / Float',
      range: 'Scale: 1-64, Color: #hex, Opacity: 0-1',
      default: '8.0 / "#0f172a" / 0.65',
      description: 'Customization properties for procedural surface patterns.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'color / roughness / metalness',
      type: 'Hex / Float / Float',
      range: '#000000-#ffffff / 0.0-1.0 / 0.0-1.0',
      default: '#38bdf8 / 0.35 / 0.15',
      description: 'Standard physical PBR surface shading attributes.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'emissive / emissiveIntensity',
      type: 'Hex Color / Float',
      range: '#000000-#ffffff / 0.0-5.0',
      default: '#000000 / 0.0',
      description: 'Self-illumination light color and power for neon trims, magic runes, or cyber accents.'
    },
    {
      feature: 'Shapes (shapes[])',
      category: 'shapes',
      param: 'wireframe / flatShading',
      type: 'Boolean',
      range: 'true / false',
      default: 'false / false',
      description: 'wireframe renders structural polygon lines. flatShading disables vertex normal smoothing for retro low-poly faceted appearance.'
    },

    // Feature 3B: PEN TOOL & VECTOR MESHES (ALL 5 MODES)
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.points',
      type: 'Array of points / objects',
      range: '[[x,y],...] or [{x,y,type,handleIn,handleOut},...]',
      default: '[]',
      description: 'Universal 2D contour points accepted across all 5 vector modes. Metric space coordinates (<= 10) are treated as meters.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.svgPath',
      type: 'SVG Path String',
      range: 'SVG d="M ... C ... Z" string',
      default: '""',
      description: 'Universal direct SVG Bezier string supported across vectorExtrude, vectorInflate, vectorRevolve, and vectorSweep via SVGLoader. Replaces manual points with silky-smooth curves.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.preserveOrigin',
      type: 'Boolean',
      range: 'true / false',
      default: 'false',
      description: 'CRITICAL (v1.1): Disables auto-centering and standardizes +Y as UP (Cartesian Three.js space). Allows multi-part logos, layered shields, and compound assemblies sharing a common 2D coordinate system to align at posX: 0, posY: 0 with zero seams!'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.depth (vectorExtrude / vectorInflate)',
      type: 'Float (meters)',
      range: '0.01 to 2.0',
      default: '0.15',
      description: 'Primary extrusion thickness or inflation puff depth in physical meters.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.holes (vectorExtrude)',
      type: 'Array of 2D point loops',
      range: '[[[x, y], ...], ...]',
      default: '[]',
      description: 'Interior cutout polygons mapped to THREE.Shape.holes. Enables compound letters (like "0", "4", "A", "B", "O", "P", "R") and ringed portals to extrude as a single solid with window cutouts.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.taper (vectorExtrude)',
      type: 'Float',
      range: '0.0 to 3.0',
      default: '1.0',
      description: 'Cross-section scaling multiplier applied from the base to the top of the extrusion. Values < 1 create tapered pyramids/teeth; values > 1 flare outward.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.twist (vectorExtrude)',
      type: 'Float (degrees)',
      range: '-720° to 720°',
      default: '0',
      description: 'Continuous rotational twist angle applied along the extrusion axis to create spiral pillars, drill bits, or braided cables.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.shellEnabled / shellThickness (vectorExtrude)',
      type: 'Boolean / Float (meters)',
      range: 'true/false, 0.005 to 0.2',
      default: 'false / 0.03',
      description: 'Hollow solidify modifier. Insets the vector contour to produce hollow pipes, cups, vases, and enclosures with uniform wall thickness.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.bevelEnabled / bevelThickness / bevelSize / bevelSegments (vectorExtrude)',
      type: 'Boolean / Floats / Integer',
      range: 'Segments: 1 to 8',
      default: 'true / 0.02 / 0.015 / 2',
      description: 'Bevel relief controls. Setting bevelSegments: 1 yields sharp tactical/sword chamfers; bevelSegments: 3-4 yields rounded chrome fillets.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.bevelColor / bevelMetalness / bevelRoughness (vectorExtrude)',
      type: 'Hex Color / Float / Float',
      range: '#000000-#ffffff / 0.0-1.0 / 0.0-1.0',
      default: 'undefined (inherits primary shape material)',
      description: 'Dual-Material Cap/Bevel Shading. When defined, cap face uses primary shape material (group 0) while side walls and bevel chamfers use this secondary material (group 1), e.g. emerald enamel badge face with mirror gold chrome rim.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.curveSegments (vectorExtrude)',
      type: 'Integer',
      range: '6 to 64',
      default: '12',
      description: 'Subdivision resolution for Bezier curves and arcs in SVG paths and vector outlines. Use 24-48 for high-definition close-up macro renders.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.domeWarpEnabled / domeCurvature / domeWarpDepth (vectorExtrude)',
      type: 'Boolean / Float / Float',
      range: 'Curvature: 0.1 to 2.0, Depth: 0.01 to 0.5',
      default: 'false / 0.5 / 0.05',
      description: 'Procedural dome/lattice curvature deformation. Morphs flat planar extrusion caps into curved spherical/parabolic bubble surfaces.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.depthFront / depthBack (vectorInflate)',
      type: 'Float (meters)',
      range: '0.01 to 1.5',
      default: '0.25 / 0.25',
      description: 'Independent front and rear volumetric bulging depths in meters for asymmetric organic cushions.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.curvatureProfile (vectorInflate)',
      type: 'Enum (8 profiles)',
      range: 'elliptic, harmonic, spherical, cushion, linear, pillowed, steep, flat_top',
      default: '"elliptic"',
      description: 'Curvature profile formula for distance-field inflation: "elliptic" (classic balloon), "harmonic" (soft sinusoidal S-curve), "spherical" (hemisphere dome), "cushion" (steep wall full crown), "linear" (origami ridge tent).'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.smoothPasses (vectorInflate)',
      type: 'Integer',
      range: '0 to 10',
      default: '3',
      description: 'Laplacian mesh relaxation iterations. Smooths distance-field topology to produce silky, wrinkle-free organic pillowing.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.rimDepth (vectorInflate)',
      type: 'Float (meters)',
      range: '0.0 to 0.2',
      default: '0.0',
      description: 'Thickness of a vertical cylindrical rim band inserted between the front and back inflated hemispheres.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.resolution (vectorInflate)',
      type: 'Integer',
      range: '16 to 64',
      default: '32',
      description: 'Interior Steiner point grid sampling density for 2D Delaunay triangulation before inflation.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.symmetric / connectEdges (vectorInflate)',
      type: 'Boolean',
      range: 'true / false',
      default: 'true / true',
      description: 'symmetric mirrors front curvature to the back. connectEdges welds the front and rear caps into a watertight closed 3D hull.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.revolveAxis (vectorRevolve)',
      type: 'Enum ("Y", "X", "Z")',
      range: '"Y", "X", "Z"',
      default: '"Y"',
      description: 'Axis of revolution. "Y" is standard vertical pottery wheel / lathe; "X" is horizontal spindle (axles, jet engines).'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.revolveAngle (vectorRevolve)',
      type: 'Float (degrees)',
      range: '1° to 360°',
      default: '360',
      description: 'Rotational arc sweep. 360° is a complete solid of revolution; 180° creates a sliced cutaway half-section.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.axisOffset (vectorRevolve)',
      type: 'Float (meters)',
      range: '0.0 to 2.0',
      default: '0.0',
      description: 'Radial translation of the contour away from the rotation axis. Values > 0 produce hollow center tunnels (donuts, torus rings, hollow pipe sleeves).'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.revolveSegments (vectorRevolve)',
      type: 'Integer',
      range: '12 to 96',
      default: '48',
      description: 'Rotational subdivision smoothness around the lathe axis.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.capEnds (vectorRevolve & vectorSweep)',
      type: 'Boolean',
      range: 'true / false',
      default: 'true',
      description: 'Generates planar end caps to close open pie slices or extruded rail ends.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.spineType (vectorSweep)',
      type: 'Enum (5 spine types)',
      range: 'helix, arc, s_curve, wave, linear',
      default: '"arc"',
      description: '3D trajectory curve along which the 2D cross-section is swept: "helix" (spiral coils, corkscrews), "arc" (curved bend), "s_curve" (organic S-bend), "wave" (sinusoidal undulation), "linear" (straight path).'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.spineLength / spineCurvature / spineTwist (vectorSweep)',
      type: 'Float (meters) / Float / Float (degrees)',
      range: 'Length: 0.1-10m, Curvature: 0.1-3.0, Twist: -1080° to 1080°',
      default: '2.0 / 0.8 / 360',
      description: 'Physical trajectory reach in meters, bend intensity, and continuous axial rotational twist along the spine.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.scaleStart / scaleEnd / scaleProfile (vectorSweep)',
      type: 'Float / Float / Enum',
      range: 'Scale: 0.05 to 5.0, Profile: linear, ease_in, ease_out, ease_in_out, bell',
      default: '1.0 / 0.2 / "ease_out"',
      description: 'Cross-section profile scaling from root to tip. Enables razor-sharp animal horns, tapering tentacles, and organic creeping vines.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.spineSteps (vectorSweep)',
      type: 'Integer',
      range: '16 to 128',
      default: '48',
      description: 'Number of parallel transport Bishop frames sampled along the 3D trajectory curve.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.frontSvgPath / frontPoints (vectorCarve)',
      type: 'SVG string / Point Array',
      range: 'SVG markup or 2D coordinates',
      default: '""',
      description: 'Front elevation silhouette contour for orthogonal Constructive Solid Geometry (CSG) visual hull carving.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.topSvgPath / topSidePoints (vectorCarve)',
      type: 'SVG string / Point Array',
      range: 'SVG markup or 2D coordinates',
      default: '""',
      description: 'Top plan or side elevation silhouette contour for orthogonal CSG visual hull carving.'
    },
    {
      feature: 'Pen Tool & Vectors (5 Modes)',
      category: 'vector',
      param: 'params.carveView / carveResolution / carveSmooth (vectorCarve)',
      type: 'Enum / Integer / Integer',
      range: 'View: "top"|"side", Resolution: 16-64, Smooth: 0-4',
      default: '"top" / 32 / 2',
      description: 'Carving projection axis, voxel/contour resolution, and Laplacian surface smoothing passes.'
    },

    // Feature 4: Surface Scatter Foliage (scatterLayers[])
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'target',
      type: 'String',
      range: 'Exact shape name or "#ar-model"',
      default: '"#ar-model"',
      description: 'CRITICAL: Host geometry to distribute instances across. Matches the exact name of any shape (e.g. target: "Tree Canopy Core") or "#ar-model" for root GLB.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'prototype',
      type: 'Enum (11 types)',
      range: 'leaf, grass, flower, clover, pine, pebble, crystal, box, sphere, cone, cylinder',
      default: '"leaf"',
      description: '3D instanced geometry prototype: "leaf" (broad foliage), "grass" (thin lawn blades), "flower" (meadow blooms), "clover" (shamrocks), "pine" (conifer needles), "pebble" (river stones), "crystal" (faceted gems).'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'distribution',
      type: 'Enum (3 modes)',
      range: 'random, grid, hex-grid',
      default: '"random"',
      description: 'Instance surface distribution algorithm: "hex-grid" raycasts an interlocking honeycomb matrix across the host geometry; "grid" creates a regular Cartesian matrix; "random" creates organic area-weighted scattering.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'count',
      type: 'Integer',
      range: '10 to 3000',
      default: '200',
      description: 'Total number of instances. Rendered in a single hardware-accelerated WebGL draw call (THREE.InstancedMesh). Dense tree canopy: 400-800; grass field: 300-1000; pebbles: 50-120.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'normalAlign',
      type: 'Boolean',
      range: 'true / false',
      default: 'true',
      description: 'When true, instances orient perpendicular to the host surface curvature (outward like real leaves on a sphere or bark on a branch). When false, instances point straight UP (+Y).'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'normalOffset',
      type: 'Float (meters)',
      range: '0.001 to 0.1',
      default: '0.005',
      description: 'Distance in meters to elevate instances above the surface to eliminate z-fighting flickering.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'minScale / maxScale',
      type: 'Float',
      range: '0.1 to 5.0',
      default: '0.8 / 1.2',
      description: 'Random size variance range applied across instances to produce realistic organic diversity.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'randomRotation',
      type: 'Float (degrees)',
      range: '0° to 180°',
      default: '45',
      description: 'Maximum random angular tilt deviation from the surface normal.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'color',
      type: 'Hex Color',
      range: '#000000 to #ffffff',
      default: '#4ade80',
      description: 'Primary base color tint for all instances in this scatter layer.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'colorVariation',
      type: 'Float',
      range: '0.0 to 1.0',
      default: '0.2',
      description: 'Natural HSL hue and brightness jitter applied across instances. 0.25 to 0.35 creates organic multi-tone foliage (emerald, lime, olive, amber tones) from a single color.'
    },
    {
      feature: 'Surface Scatter (scatterLayers[])',
      category: 'scatter',
      param: 'seed',
      type: 'Integer',
      range: '1 to 99999',
      default: '142',
      description: 'Deterministic pseudo-random seed ensuring the exact same foliage distribution renders across all devices.'
    },

    // Feature 5: 3D Typography (text3d[])
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'text',
      type: 'String',
      range: 'Any UTF-8 text',
      default: '"STAR weAR"',
      description: 'Text string extruded into 3D geometry in physical AR space.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'fontFamily',
      type: 'Enum (10 fonts)',
      range: 'helvetiker_bold, helvetiker_regular, optimer_bold, optimer_regular, gentilis_bold, gentilis_regular, droid_sans_bold, droid_sans_regular, droid_serif_bold, droid_serif_regular',
      default: '"helvetiker_bold"',
      description: 'Pre-converted 3D typeface font typeface. helvetiker for modern bold; optimer for luxury geometric; droid_serif for classical serif.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'size / depth',
      type: 'Float (meters)',
      range: '0.05 to 2.0 / 0.01 to 0.5',
      default: '0.35 / 0.08',
      description: 'size is font height in meters; depth is 3D extrusion thickness along Z-axis.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'bevelEnabled / bevelThickness / bevelSize',
      type: 'Boolean / Floats',
      range: 'true/false, 0.005 to 0.05',
      default: 'true / 0.015 / 0.01',
      description: 'Adds rounded chamfer edges to letterforms for catching specular light highlights.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'align',
      type: 'Enum',
      range: '"center", "left", "right"',
      default: '"center"',
      description: 'Horizontal origin centering of text geometry relative to posX, posY, posZ.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'curveRadius',
      type: 'Float (meters)',
      range: '-10.0 to +10.0 (non-zero)',
      default: '0 (straight / planar)',
      description: 'Bends 3D text along a circular arc in physical meters. Positive radius (e.g. +1.2) arches downward like a rainbow/header badge banner. Negative radius (e.g. -1.2) smiles upward like a ribbon/seal footer.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'startAngle / endAngle / letterSpacing',
      type: 'Float (rad) / Float (rad) / Float (meters)',
      range: '-Math.PI to +Math.PI / 0.0 to 0.1',
      default: 'auto / auto / 0.0',
      description: 'Manual angular bounds (radians) for text arc distribution, or letterSpacing (meters) to widen/tighten kerning distance between characters along the curve.'
    },
    {
      feature: '3D Typography (text3d[])',
      category: 'text3d',
      param: 'emissive / emissiveIntensity',
      type: 'Hex Color / Float',
      range: '#000000 to #ffffff / 0.0 to 5.0',
      default: '#0284c7 / 0.4',
      description: 'Neon self-illumination glow color and power for floating holographic titles.'
    },

    // Feature 6: Lighting Architecture (lighting)
    {
      feature: 'Lighting Architecture',
      category: 'lighting',
      param: 'dir1Color / dir1Intensity / dir1Position',
      type: 'Hex / Float / String "X Y Z"',
      range: '#ffffff / 0.5 to 10.0 / coordinates',
      default: '#fffbeb / 2.8 / "3 5 2"',
      description: 'Primary Key Sun Directional Light. Simulates direct sunlight or main stage spot.'
    },
    {
      feature: 'Lighting Architecture',
      category: 'lighting',
      param: 'dir2Color / dir2Intensity / dir2Position',
      type: 'Hex / Float / String "X Y Z"',
      range: '#ffffff / 0.2 to 5.0 / coordinates',
      default: '#ffffff / 1.2 / "-2 -1 -2"',
      description: 'Secondary Fill Directional Light. Illuminates shadowed side to prevent pitch-black voids.'
    },
    {
      feature: 'Lighting Architecture',
      category: 'lighting',
      param: 'rimColor / rimIntensity / rimPosition',
      type: 'Hex / Float / String "X Y Z"',
      range: '#ffffff / 0.2 to 5.0 / coordinates',
      default: '#818cf8 / 1.0 / "0 3 -3"',
      description: 'Contour Rim Light positioned behind subject to separate silhouette from dark backgrounds.'
    },
    {
      feature: 'Lighting Architecture',
      category: 'lighting',
      param: 'customLights[].type',
      type: 'Enum (4 types)',
      range: '"point", "spot", "directional", "hemisphere"',
      default: '"point"',
      description: 'Positional light type: spot has cone angle and penumbra; point radiates in 360°; hemisphere blends sky and ground bounce.'
    },
    {
      feature: 'Lighting Architecture',
      category: 'lighting',
      param: 'customLights[].posX, posY, posZ, angle, penumbra',
      type: 'Floats',
      range: 'Standard ranges',
      default: '0, 2, 2, 45, 0.35',
      description: 'Coordinates, spot cone angle in degrees, and edge feather penumbra.'
    },

    // Feature 7: GPU Particles (particles)
    {
      feature: 'GPU Particles (particles)',
      category: 'particles',
      param: 'preset',
      type: 'Enum (10 presets)',
      range: 'cosmic-stardust, mystic-fireflies, amber-embers, cyber-matrix, cherry-blossom, winter-snowfall, golden-sparkles, toxic-spores, deep-ocean, electric-storm',
      default: '"cosmic-stardust"',
      description: 'Pre-engineered atmospheric particle simulation style. "mystic-fireflies" for forest/nature; "amber-embers" for fire/sparks; "cyber-matrix" for sci-fi code rain; "cherry-blossom" for sakura blossoms.'
    },
    {
      feature: 'GPU Particles (particles)',
      category: 'particles',
      param: 'count / size / opacity',
      type: 'Integer / Float / Float',
      range: '20-2000 / 0.01-0.2 / 0.1-1.0',
      default: '300 / 0.04 / 0.85',
      description: 'Total active particle instances, billboard diameter in meters, and alpha transparency.'
    },
    {
      feature: 'GPU Particles (particles)',
      category: 'particles',
      param: 'color / colorSecondary / direction / speed',
      type: 'Hex / Hex / Enum / Float',
      range: 'Colors, direction: "float"|"up"|"down"|"vortex"|"outward"',
      default: '#38bdf8 / #c084fc / "float" / 1.0',
      description: 'Dual-tone gradient ramp, velocity direction, and playback rate.'
    },

    // Feature 8: AR Portal Gateway (portal)
    {
      feature: 'AR Portal Gateway (portal)',
      category: 'portal',
      param: 'preset',
      type: 'Enum (6 presets)',
      range: 'cosmic-nebula, cyber-grid, emerald-forest, sunset-horizon, deep-ocean, quantum-void',
      default: '"cosmic-nebula"',
      description: 'Theme of the internal skybox and atmospheric interior seen through the portal opening.'
    },
    {
      feature: 'AR Portal Gateway (portal)',
      category: 'portal',
      param: 'shape / width / height / depth',
      type: 'Enum / Floats (meters)',
      range: 'shape: "arch", "rectangle", "circle", "hexagon"',
      default: '"arch" / 1.1 / 1.8 / 3.5',
      description: 'Portal architectural opening shape and volumetric interior chamber depth in meters.'
    },
    {
      feature: 'AR Portal Gateway (portal)',
      category: 'portal',
      param: 'frameColor / frameEmissive / floatingText',
      type: 'Hex / Hex / String',
      range: 'Standard ranges',
      default: '#38bdf8 / #0284c7 / "STAR weAR"',
      description: 'Portal frame material colors and floating header inscription in physical space.'
    },

    // Feature 9: Live 3D Website Viewport (website)
    {
      feature: '3D Website Viewport (website)',
      category: 'website',
      param: 'url / width / height / interactive',
      type: 'HTTPS URL / Floats / Boolean',
      range: 'Standard web ranges',
      default: '"" / 1.2 / 0.675 / true',
      description: 'Embedded interactive web viewport surface rendered in 3D AR space.'
    },

    // Feature 10: Target Tracking Calibration (tracking)
    {
      feature: 'Target Tracking (tracking)',
      category: 'tracking',
      param: 'visible / opacity / width / aspectRatio',
      type: 'Boolean / Float / Float / Float',
      range: 'Standard tracking parameters',
      default: 'true / 0.85 / 1.0 / 1.0',
      description: 'Visual calibration marker dimensions and opacity in physical meters.'
    },

    // Feature 11: External 3D Models (models[])
    {
      feature: 'External Models (models[])',
      category: 'models',
      param: 'url, posX, posY, posZ, rotX, rotY, rotZ, scale',
      type: 'HTTPS URL / Transform Floats',
      range: 'Valid .glb / .gltf URL',
      default: '"" / 0, 0, 0, 0, 0, 0, 1',
      description: 'Direct HTTPS link to an external GLB/GLTF 3D model asset to composite into the scene alongside procedural shapes.'
    }
  ];

  // Filtered parameters based on search and category
  const filteredParams = useMemo(() => {
    return PARAMETER_DICTIONARY.filter((p) => {
      const matchesCategory =
        activeCategory === 'all' ||
        p.category === activeCategory ||
        (activeCategory === 'shapes' && p.category === 'vector');
      const q = paramSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.param.toLowerCase().includes(q) ||
        p.feature.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [paramSearch, activeCategory]);

  // ---------------------------------------------------------------------------
  // 3. CASE STUDY PAYLOAD STRINGS
  // ---------------------------------------------------------------------------
  const TREE_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[0]?.payload || {}, null, 2);
  const CYBER_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[1]?.payload || {}, null, 2);
  const PORTAL_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[2]?.payload || {}, null, 2);
  const EMBLEM_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[3]?.payload || {}, null, 2);
  const REVOLVE_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[4]?.payload || {}, null, 2);
  const INFLATE_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[5]?.payload || {}, null, 2);
  const SWEEP_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[6]?.payload || {}, null, 2);
  const DESIGNER_BADGE_CASE_STUDY_JSON = JSON.stringify(BUILTIN_API_PRESETS[7]?.payload || {}, null, 2);

  // ---------------------------------------------------------------------------
  // 4. NOTEBOOK LM FULL SINGLE-PAGE RAW MARKDOWN DUMP GENERATOR
  // ---------------------------------------------------------------------------
  const generateNotebookLmMkdown = () => {
    return `# STAR weAR AR-Test 3D Scene Constructor API Specification & Gemini Vision Guide
Version: ${AR_SCENE_API_VERSION}
Engine: Star weAR WebAR Runtime (Three.js / MindAR)
Target Audience: Google NotebookLM Ingestion & Google Gemini Vision AI Instructions

---

## 1. EXECUTIVE OVERVIEW & SYSTEM ROLE
The AR-Test 3D Scene Constructor API is a declarative, JSON-driven spatial scene description specification. It enables Multi-Modal Vision AIs (specifically Google Gemini 1.5 Pro / Flash / 2.0) to analyze 2D photographs of objects, nature, architecture, products, and scenes, and translate them into renderable, interactive 3D WebAR scenes.

The resulting JSON is pasted directly into AR-Test Studio ("🤖 AI Scene API") or loaded through automated backend endpoints, where it instantiates:
- Procedural solids and vector polygon extrusions (shapes) with SVG Bezier curves, interior cutouts, and sharp chamfers
- Dual-Material Cap & Bevel Shading: Separates front/back cap face material from side walls and chamfered bevels (e.g. emerald enamel face with mirror gold rim)
- The 5 Advanced Pen Tool / Vector Mesh Generators:
  1. \`vectorRevolve\`: 360° rotational lathe solids (vases, bottles, bowls, columns, pistons, hollow donuts)
  2. \`vectorInflate\`: Volumetric dual-sided organic inflation (plushies, badges, clouds, cushions, soft food)
  3. \`vectorSweep\`: Bishop parallel transport lofting along 3D guide rails (horns, vines, tentacles, cables, pipes)
  4. \`vectorExtrude\`: Planar extrusion with directional taper, twist, hollow shells, and sharp chamfers / rounded fillets
  5. \`vectorCarve\`: Orthogonal dual-silhouette Constructive Solid Geometry (CSG) visual hull carving
- Curved Path Typography: Bends 3D text natively along circular arcs (rainbow header arch or smiling ribbon footer)
- Hardware-instanced multi-layer surface foliage (scatterLayers) with hex-grid and random distribution
- High-fidelity procedural patterns (gingham, checkerboard, twill-crosshatch, honeycomb, carbon-fiber, brushed-metal, grid, dots, camo)
- Real-time PBR environment reflection maps (studio-chrome, city, sunset, forest, cyber)
- Extruded 3D typography (text3d)
- Dynamic multi-source lighting and shadow casting (lighting)
- Atmospheric GPU particle systems (particles)
- AR Portal gateways into foreign dimensions (portal)
- Interactive 3D web viewports (website)
- Target image tracking alignment (tracking)

---

## 2. GOOGLE GEMINI VISION SYSTEM PROMPT
\`\`\`
${GEMINI_SYSTEM_PROMPT}
\`\`\`

---

## 3. DECONSTRUCTION WORKED EXAMPLE: 2D TREE TO 3D AR SCENE
When Gemini is presented with a 2D photograph of a majestic oak tree in a grassy field:

### Step 1: Visual Feature Extraction
- Trunk: Thick organic brown base tapering slightly as it ascends, textured bark.
- Branches: Two primary thick limbs splitting off diagonally left (+45°) and right (-40°).
- Canopy: Dense, rounded, billowing mass of green foliage.
- Ground: Gentle circular grassy knoll with scattered wild grass blades and smooth river pebbles.
- Lighting: Warm golden late-afternoon sunlight from upper-right with soft shadow falloff.
- Atmosphere: Tiny floating pollen/firefly motes drifting through the sunlight beams.

### Step 2: Mapping to AR-Test Geometries & Scatter Layers
1. "Tree Base Mound": Cylinder shape (radiusTop: 1.2m, radiusBottom: 1.4m, height: 0.12m, color: #15803d, roughness: 0.9).
2. "Tree Trunk Lower": Tapered Cylinder shape (radiusTop: 0.22m, radiusBottom: 0.38m, height: 0.8m, color: #5c3a21, roughness: 0.95).
3. "Tree Trunk Upper & Canopy Core": Sphere shape (radius: 0.65m, posY: 0.95m, color: #276738). This serves as the host geometry for instanced leaves!
4. "Branch Left" & "Branch Right": Angled Cone shapes (rotZ: 45° and rotZ: -40°, color: #4a2e1b).
5. "Canopy Foliage Leaves": Scatter layer targeting "Tree Trunk Upper & Canopy Core" (prototype: 'leaf', count: 450, normalAlign: true, color: #4ade80, colorVariation: 0.3).
6. "Ground Wild Sprouts": Scatter layer targeting "Tree Base Mound" (prototype: 'grass', count: 320, normalAlign: true, color: #22c55e).
7. "Forest Pebbles": Scatter layer targeting "Tree Base Mound" (prototype: 'pebble', count: 80, color: #94a3b8).
8. Atmospheric Lighting & Particles: Spot light sunlight beam (#fef08a, intensity: 4.5) + particle preset 'mystic-fireflies'.

### Executable JSON Payload:
\`\`\`json
${TREE_CASE_STUDY_JSON}
\`\`\`

---

## 4. COMPLETE PEN TOOL & 5 VECTOR 3D MESH GENERATION MODES
The Pen Tool and Vector Mesh synthesizer in AR-Test enables precise construction of custom 3D geometries that cannot be represented by simple primitive boxes or spheres.

### Universal Input Specifications (Across All 5 Modes):
1. **Direct SVG Bezier Path String (\`svgPath\`\)**:
   - Provide an SVG \`d="..."\` string (e.g. \`"M 0 0 C 0.2 0.5, 0.4 0.8, 0.5 1.0 Z"\`).
   - Parsed directly by Three.js \`SVGLoader\` into smooth cubic and quadratic Bezier curves.
2. **Bezier Anchor Points with Tangent Control Handles (\`points\`\)**:
   - Provide an array of points: \`[ { x: 0, y: 0, type: "corner" }, { x: 0.5, y: 1.0, type: "smooth", handleIn: { x: -0.1, y: -0.2 }, handleOut: { x: 0.1, y: 0.2 } } ]\`.
3. **Coordinate Pairs (\`points\`\)**:
   - Provide an array of 2D vertices: \`[ [x1, y1], [x2, y2], ... ]\`.
4. **Metric Space & Origin Preservation (\`preserveOrigin: true\`\)**:
   - When coordinates are between -10.0 and +10.0, the engine treats them directly as METERS (\`scaleFactor: 1.0\`).
   - Setting \`"preserveOrigin": true\` standardizes Cartesian +Y as UP and disables auto-centering (\`geom.center()\`), allowing multi-part assemblies sharing the same coordinate space to align with ZERO seams at \`posX: 0, posY: 0\`.

---

### MODE 1: Rotational Lathe (\`vectorRevolve\`)
- **When to use**: Radially symmetric 360° rotational objects (vases, wine bottles, goblets, chalices, bowls, turned table legs, columns, lampshades, domes, wheels, pistons).
- **Contour Definition**: Define the 2D half-silhouette profile starting from the revolution axis outwards.
- **Key Parameters**:
  - \`revolveAxis\`: "Y" (vertical lathe), "X" (horizontal spindle), or "Z".
  - \`revolveAngle\`: 360 (full solid) or partial (e.g. 180 for cutaway).
  - \`axisOffset\`: Distance from rotation axis. Values > 0 create hollow center tunnels (donuts, torus rings, hollow pipe sleeves).
  - \`revolveSegments\`: 24 to 64 (angular smoothness).
  - \`capEnds\`: true (closes end caps for partial revolutions).

#### Executable Revolved Greek Amphora Vase Example:
\`\`\`json
${REVOLVE_CASE_STUDY_JSON}
\`\`\`

---

### MODE 2: Volumetric Organic Inflation (\`vectorInflate\`)
- **When to use**: Soft, organic, puffy 3D forms (cushions, pillows, plush toys, badges, clouds, cartoon character heads, hearts, soft food items).
- **Algorithm**: Evaluates a 2D Euclidean Distance Field (SDF) over an interior Steiner point Delaunay triangulation grid, applies non-linear curvature elevation, welds dual-sided front/back manifolds into a watertight hull, and runs Laplacian mesh relaxation.
- **Key Parameters**:
  - \`depthFront\` & \`depthBack\`: Independent front and rear bulging depths in physical meters.
  - \`curvatureProfile\`: "elliptic" (balloon), "harmonic" (soft sinusoidal S-curve), "spherical" (hemisphere dome), "cushion" (steep wall full top), "linear" (origami ridge tent), "pillowed" (balanced organic puff).
  - \`smoothPasses\`: 1 to 8 (Laplacian mesh smoothing iterations).
  - \`rimDepth\`: Cylindrical vertical band separating front and back inflated hemispheres.
  - \`resolution\`: 16 to 48 (internal triangulation grid density).
  - \`symmetric\`: true (mirrors front profile to back).

#### Executable Inflated Plush Heart Badge Example:
\`\`\`json
${INFLATE_CASE_STUDY_JSON}
\`\`\`

---

### MODE 3: Rail Guide Sweep & Loft (\`vectorSweep\`)
- **When to use**: Curving directional tubes, horns, tentacles, vines, cables, pipes, nautilus spirals, and coiling organic ribbons.
- **Algorithm**: Samples a 3D guide curve (spine) and lofts the 2D cross-section along it using parallel transport Bishop frames (rotation minimizing frames) to avoid gimbal lock and twisting artifacts.
- **Key Parameters**:
  - \`spineType\`: "helix" (spiral corkscrew), "arc" (smooth bend), "s_curve" (organic S-bend), "wave" (sinusoidal undulation), "linear" (straight path).
  - \`spineLength\`: Physical length in meters (e.g. 1.5m to 3.0m).
  - \`spineCurvature\`: Bend amount (0.1 to 2.0).
  - \`spineTwist\`: Continuous axial rotation in degrees along spine (e.g. 360°, 540°, 720°).
  - \`scaleStart\` & \`scaleEnd\`: Cross-section scale at root vs tip (e.g. 1.2 tapering to 0.15 for sharp horn).
  - \`scaleProfile\`: "linear", "ease_out", "ease_in", "ease_in_out", "bell".
  - \`spineSteps\`: 24 to 64 (subdivisions along spine).

#### Executable Coiled Nautilus Horn Example:
\`\`\`json
${SWEEP_CASE_STUDY_JSON}
\`\`\`

---

### MODE 4: Extrusion, Bevel, Shell & Warp (\`vectorExtrude\`)
- **When to use**: Planar silhouettes, logos, layered heraldic emblems, typography, shields, signs, or beveled mechanical plates with optional taper, twist, hollow shell, or dome warping.
- **Key Parameters**:
  - \`depth\`: Linear extrusion thickness in meters.
  - \`holes\`: Array of 2D cutout loops for hollow letters/windows: \`[ [[x, y], ...], ... ]\`.
  - \`taper\`: Base-to-top scale multiplier (e.g. 0.7 for tapered pyramid/pillar).
  - \`twist\`: Rotational twist in degrees along extrusion (e.g. 45° or 180° for drill).
  - \`shellEnabled\`: true + \`shellThickness\`: 0.03 (creates hollow container/vase with uniform wall thickness).
  - \`bevelEnabled\`: true, \`bevelThickness\`: 0.01-0.03, \`bevelSize\`: 0.01-0.02.
  - \`bevelSegments\`: 1 (sharp tactical chamfer) or 3-4 (smooth rounded fillet).
  - \`bevelColor\` / \`bevelMetalness\` / \`bevelRoughness\`: Dual-material cap/bevel shading (face uses primary shape material; side walls and bevels use secondary material).
  - \`curveSegments\`: 12 to 64 (subdivision resolution for Bezier curves and SVG arcs).
  - \`domeWarpEnabled\`: true, \`domeCurvature\`: 0.5, \`domeWarpDepth\`: 0.05 (parabolic dome warping of planar face).

#### Executable Unified 40 Cross-Sword Emblem Example:
\`\`\`json
${EMBLEM_CASE_STUDY_JSON}
\`\`\`

---

### MODE 5: Dual-Silhouette Carve (\`vectorCarve\`)
- **When to use**: Complex sculptural figures, vehicle chassis, animal bodies, and architectural monuments defined by intersecting front and top/side silhouettes.
- **Algorithm**: Orthogonal Constructive Solid Geometry (CSG) visual hull intersection. Extrudes Front silhouette along Z and Top/Side silhouette along Y, intersecting their volume to extract the 3D manifold.
- **Key Parameters**:
  - \`frontSvgPath\` or \`frontPoints\`: Front elevation silhouette.
  - \`topSvgPath\` or \`topSidePoints\`: Top or side elevation silhouette.
  - \`carveView\`: "top" or "side".
  - \`carveResolution\`: 24 to 48 (voxel/contour resolution).
  - \`carveSmooth\`: 1 to 4 (Laplacian surface smoothing passes).

---

## 5. COMPLETE EXHAUSTIVE PARAMETER REFERENCE
| Feature | Parameter | Data Type | Range / Options | Default | Description |
|---|---|---|---|---|---|
${PARAMETER_DICTIONARY.map(
  (p) => `| ${p.feature} | \`${p.param}\` | ${p.type} | ${p.range} | \`${p.default}\` | ${p.description} |`
).join('\n')}

---

## 6. VALID ENUMS LIST
- Primitive Types: ${VALID_PRIMITIVE_TYPES.join(', ')}
- Environment Presets: ${VALID_SCENE_ENV_PRESETS.join(', ')}
- Procedural Patterns: ${VALID_PROCEDURAL_PATTERNS.join(', ')}
- Scatter Distributions: ${VALID_SCATTER_DISTRIBUTIONS.join(', ')}
- Scatter Prototypes: ${VALID_SCATTER_PROTOTYPES.join(', ')}
- Light Types: ${VALID_LIGHT_TYPES.join(', ')}
- Font Families: ${VALID_FONT_FAMILIES.join(', ')}
- Particle Presets: ${VALID_PARTICLE_PRESETS.join(', ')}
- Portal Presets: ${VALID_PORTAL_PRESETS.join(', ')}

---

## 7. CYBERPUNK MONUMENT EXAMPLE
\`\`\`json
${CYBER_CASE_STUDY_JSON}
\`\`\`

---

## 8. ETHEREAL PORTAL GATEWAY EXAMPLE
\`\`\`json
${PORTAL_CASE_STUDY_JSON}
\`\`\`

---

## 9. DESIGNER ENAMEL BADGE & ARCHED BANNER (v1.2 FEATURE SHOWCASE)
Demonstrates:
- **Dual-Material Cap/Bevel Shading**: Rich emerald green cap face (\`color: "#059669"\`) framed by high-polish mirror gold chrome side walls and bevel chamfer rim (\`bevelColor: "#fbbf24"\`, \`bevelMetalness: 0.95\`, \`bevelRoughness: 0.12\`).
- **Gingham & Checkerboard Weaves**: Secondary procedurally generated high-resolution patterns with \`patternSecondaryColor\`.
- **Curved Path Typography**: Header arch banner curved downward (\`curveRadius: 1.15\`) and footer ribbon smiling upward (\`curveRadius: -0.95\`).

\`\`\`json
${DESIGNER_BADGE_CASE_STUDY_JSON}
\`\`\`
`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-24">
      {/* Top Banner / Sticky Navigation Bar */}
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
                AR-Test 3D Scene Constructor API & Gemini Vision Guide
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                v{AR_SCENE_API_VERSION} • Single-Page Master Reference
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
            onClick={() => copyToClipboard(generateNotebookLmMkdown(), 'notebooklm-doc')}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/25 transition-all cursor-pointer"
            title="Copy complete markdown text for Google NotebookLM"
          >
            <span className="material-symbols-outlined text-sm">
              {copiedSection === 'notebooklm-doc' ? 'done' : 'download'}
            </span>
            <span>{copiedSection === 'notebooklm-doc' ? 'Copied Master Doc!' : 'Copy Master Doc (NotebookLM)'}</span>
          </button>
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
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-neutral-900 border border-emerald-500/30 space-y-3 shadow-xl shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-lg">menu_book</span>
              <span>Unified Single-Page Knowledge Source for Google NotebookLM & Gemini</span>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">All Subsystems Documented</span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            This document contains the complete architectural specification for constructing 3D AR scenes from scratch. You can supply this entire page as a <strong>Website Resource to Google NotebookLM</strong>, or copy the <strong>Gemini Master System Prompt</strong> below into Google AI Studio or Gemini Gems. When you feed Gemini any 2D photograph (e.g. an ancient oak tree, a classical vase, a plush toy, a cyber emblem, or fantasy environment), Gemini uses this guide to decompose the image into our exact JSON schema, which you then paste into AR-Test Studio to construct the 3D scene instantly.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/60 text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 5 Pen Tool / Vector Mesh Modes
            </span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/60 text-teal-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span> 17 Shape & Procedural Primitives
            </span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/60 text-cyan-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> 11 Foliage Scatter Prototypes
            </span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/60 text-purple-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> 10 3D Typography Fonts
            </span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-900/80 border border-neutral-700/60 text-amber-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> 10 Particle Presets & Multi-Light
            </span>
          </div>
        </div>

        {/* SECTION 1: GEMINI VISION MASTER SYSTEM PROMPT */}
        <section id="system-prompt" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                01
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Google Gemini Vision Master System Prompt
                </h2>
                <p className="text-xs text-neutral-400">
                  Copy and paste this into Google AI Studio ("System Instructions") or Gemini Custom Gems.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(GEMINI_SYSTEM_PROMPT, 'system-prompt-btn')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-xs text-emerald-400">
                {copiedSection === 'system-prompt-btn' ? 'done' : 'content_copy'}
              </span>
              <span>{copiedSection === 'system-prompt-btn' ? 'Copied Prompt!' : 'Copy System Prompt'}</span>
            </button>
          </div>

          <div className="relative group">
            <pre className="p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[460px] scrollbar-thin">
              {GEMINI_SYSTEM_PROMPT}
            </pre>
          </div>
        </section>

        {/* SECTION 2: WORKED CASE STUDY - 2D TREE PHOTO TO 3D AR SCENE */}
        <section id="tree-case-study" className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs">
                02
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Worked Case Study: 2D Picture of a Tree ➔ 3D AR Scene
                </h2>
                <p className="text-xs text-neutral-400">
                  Detailed architectural walk-through of how Gemini translates a tree photo into AR-Test geometry and scatter layers.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(TREE_CASE_STUDY_JSON, 'tree-json')}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-xs text-teal-400">
                {copiedSection === 'tree-json' ? 'done' : 'content_copy'}
              </span>
              <span>{copiedSection === 'tree-json' ? 'Copied Tree JSON!' : 'Copy Tree JSON'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Decomposition Table */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 text-xs text-neutral-300">
              <div className="flex items-center gap-2 text-teal-400 font-bold uppercase tracking-wider text-[11px]">
                <span className="material-symbols-outlined text-base">visibility</span>
                <span>Visual Feature Decomposition Logic</span>
              </div>

              <div className="space-y-3 leading-relaxed">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="font-bold text-emerald-300">1. Ground Mound & Terrain:</span>
                  <p className="text-neutral-400">
                    A flat cylinder (<code className="text-neutral-200">radiusTop: 1.2, radiusBottom: 1.4, height: 0.12</code>) creates a gentle circular grassy knoll. Anchored at <code className="text-neutral-200">posY: -0.06</code> with forest-green color <code className="text-neutral-200">#15803d</code> and high roughness <code className="text-neutral-200">0.9</code>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="font-bold text-amber-300">2. Organic Tapered Trunk:</span>
                  <p className="text-neutral-400">
                    Modeled with a tapered cylinder (<code className="text-neutral-200">radiusBottom: 0.38, radiusTop: 0.22, height: 0.8</code>). Color is earthy bark brown <code className="text-neutral-200">#5c3a21</code>, roughness <code className="text-neutral-200">0.95</code>, metalness <code className="text-neutral-200">0.0</code>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="font-bold text-cyan-300">3. Branch Splitting (Left & Right):</span>
                  <p className="text-neutral-400">
                    Two angled cones rooted at the top of the trunk: Left Branch (<code className="text-neutral-200">rotZ: 45°</code>, posX: -0.28) and Right Branch (<code className="text-neutral-200">rotZ: -40°</code>, posX: 0.28).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="font-bold text-emerald-400">4. Canopy Core & Hardware Scatter Foliage:</span>
                  <p className="text-neutral-400">
                    A sphere named <code className="text-emerald-300">"Tree Trunk Upper & Canopy Core"</code> (radius: 0.65, posY: 0.95) acts as the host volume. A scatter layer targets this exact name with prototype <code className="text-emerald-300">'leaf'</code> (450 instances, normalAlign: true, colorVariation: 0.3).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="font-bold text-purple-300">5. Ground Detailing & Micro-Scatter:</span>
                  <p className="text-neutral-400">
                    Two additional scatter layers target <code className="text-neutral-200">"Tree Base Mound"</code>: 320 blades of <code className="text-emerald-300">'grass'</code> and 80 smooth tumbled <code className="text-emerald-300">'pebble'</code> instances.
                  </p>
                </div>
              </div>
            </div>

            {/* Tree Payload Code Block */}
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-3 rounded-t-xl bg-neutral-900 border border-b-0 border-neutral-800">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">code</span>
                  <span>executable_tree_scene.json</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Ready to paste into AR-Test
                </span>
              </div>
              <pre className="flex-1 p-4 rounded-b-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-[460px] scrollbar-thin">
                {TREE_CASE_STUDY_JSON}
              </pre>
            </div>
          </div>
        </section>

        {/* SECTION 3: PEN TOOL & CUSTOM 3D GEOMETRIES (THE 5 VECTOR MODES) */}
        <section id="pen-tool-modes" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">
                03
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Pen Tool & Custom 3D Geometries (The 5 Vector Modes)
                </h2>
                <p className="text-xs text-neutral-400">
                  Synthesize custom non-primitive 3D meshes using rotational lathe, volumetric inflation, guide-rail sweeps, and bevel/shell extrusions.
                </p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
              {[
                { id: 'revolve', label: '🏺 Revolve (Lathe)', mode: 'vectorRevolve' },
                { id: 'inflate', label: '🎈 Inflate (Poisson 3D)', mode: 'vectorInflate' },
                { id: 'sweep', label: '🎷 Sweep & Loft', mode: 'vectorSweep' },
                { id: 'extrude', label: '🛡️ Extrude & Shell', mode: 'vectorExtrude' },
                { id: 'carve', label: '🗿 Silhouette Carve', mode: 'vectorCarve' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveVectorTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeVectorTab === tab.id
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Mode Deep Dive Card */}
          {activeVectorTab === 'revolve' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏺</span>
                    <div>
                      <h3 className="text-base font-bold text-cyan-300">vectorRevolve: 360° Rotational Lathe Surface</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        RADIAL SYMMETRY • Y / X / Z AXIS
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(REVOLVE_CASE_STUDY_JSON, 'revolve-json')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-cyan-400">
                      {copiedSection === 'revolve-json' ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedSection === 'revolve-json' ? 'Copied Vase JSON!' : 'Copy Vase JSON'}</span>
                  </button>
                </div>

                <p className="text-neutral-300 leading-relaxed">
                  Rotates a 2D half-silhouette cross section around a chosen center axis (standard Y-axis for upright pottery, X-axis for horizontal spindles). Creates perfect rotational bodies with zero polycount waste.
                </p>

                <div className="space-y-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">When To Choose This Mode:</span>
                  <div className="grid grid-cols-2 gap-2 text-neutral-400">
                    <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200 block">Pottery & Glassware:</strong>
                      Vases, wine bottles, goblets, bowls, chalices, urns, cups.
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200 block">Architecture & Machinery:</strong>
                      Turned pillars, table legs, lampshades, domes, wheels, pistons.
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">Key Parameters:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li><strong className="text-white">revolveAxis</strong>: "Y" (vertical), "X" (horizontal), "Z"</li>
                    <li><strong className="text-white">revolveAngle</strong>: 360 (full solid) or 180 (cutaway half-section)</li>
                    <li><strong className="text-white">axisOffset</strong>: Distance from rotation axis. Offset &gt; 0 creates hollow donut tunnels</li>
                    <li><strong className="text-white">revolveSegments</strong>: 24 to 64 (angular rotational smoothness)</li>
                    <li><strong className="text-white">points / svgPath</strong>: Half-silhouette profile from axis outwards</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 rounded-t-xl bg-neutral-900 border border-b-0 border-neutral-800">
                  <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">code</span>
                    <span>revolved_amphora_vase.json</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    vectorRevolve Benchmark
                  </span>
                </div>
                <pre className="flex-1 p-4 rounded-b-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap max-h-[460px] scrollbar-thin">
                  {REVOLVE_CASE_STUDY_JSON}
                </pre>
              </div>
            </div>
          )}

          {activeVectorTab === 'inflate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎈</span>
                    <div>
                      <h3 className="text-base font-bold text-pink-300">vectorInflate: Volumetric Organic Inflation</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">
                        DISTANCE-FIELD SDF • DUAL-SIDED MANIFOLD
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(INFLATE_CASE_STUDY_JSON, 'inflate-json')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-pink-400">
                      {copiedSection === 'inflate-json' ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedSection === 'inflate-json' ? 'Copied Badge JSON!' : 'Copy Badge JSON'}</span>
                  </button>
                </div>

                <p className="text-neutral-300 leading-relaxed">
                  Evaluates a Euclidean Distance-to-Boundary field across a 2D Steiner Delaunay triangulation grid, inflates the interior vertices non-linearly using mathematical curvature profiles, and welds dual-sided front and back hulls with Laplacian mesh relaxation.
                </p>

                <div className="space-y-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-pink-400">Curvature Profiles:</span>
                  <div className="grid grid-cols-2 gap-2 text-neutral-400 text-[11px]">
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">elliptic:</strong> Classic balloon puff with vertical boundary tangents.
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">harmonic:</strong> Sinusoidal S-curve with relaxed, soft crown.
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">cushion:</strong> High-volume steep-walled puffy couch cushion.
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">linear:</strong> Faceted straight slope (origami ridge tent / gem).
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-pink-400">Key Parameters:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li><strong className="text-white">depthFront / depthBack</strong>: Independent front and rear bulging depths in meters</li>
                    <li><strong className="text-white">smoothPasses</strong>: 1 to 8 (Laplacian mesh smoothing iterations)</li>
                    <li><strong className="text-white">rimDepth</strong>: Vertical cylindrical band inserted between hemispheres</li>
                    <li><strong className="text-white">resolution</strong>: 16 to 48 (internal triangulation grid density)</li>
                    <li><strong className="text-white">symmetric</strong>: true (mirrors front curvature to back)</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 rounded-t-xl bg-neutral-900 border border-b-0 border-neutral-800">
                  <span className="text-xs font-mono font-bold text-pink-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">code</span>
                    <span>inflated_heart_badge.json</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">
                    vectorInflate Benchmark
                  </span>
                </div>
                <pre className="flex-1 p-4 rounded-b-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-pink-300 overflow-x-auto whitespace-pre-wrap max-h-[460px] scrollbar-thin">
                  {INFLATE_CASE_STUDY_JSON}
                </pre>
              </div>
            </div>
          )}

          {activeVectorTab === 'sweep' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎷</span>
                    <div>
                      <h3 className="text-base font-bold text-amber-300">vectorSweep: Guide Rail Sweep & Loft</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        BISHOP FRAMES • TWIST & TAPER
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(SWEEP_CASE_STUDY_JSON, 'sweep-json')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-amber-400">
                      {copiedSection === 'sweep-json' ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedSection === 'sweep-json' ? 'Copied Horn JSON!' : 'Copy Horn JSON'}</span>
                  </button>
                </div>

                <p className="text-neutral-300 leading-relaxed">
                  Lofts a 2D cross-section contour along a 3D curved trajectory spine using parallel transport Bishop frames (rotation minimizing frames). Prevents gimbal lock twisting and enables dynamic cross-section scaling and axial twists along the guide curve.
                </p>

                <div className="space-y-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-amber-400">Guide Rail Spine Types:</span>
                  <div className="grid grid-cols-2 gap-2 text-neutral-400 text-[11px]">
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">helix:</strong> 3D spiral coils for ram horns, nautilus shells, and corkscrews.
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <strong className="text-neutral-200">arc / s_curve:</strong> Curving architectural pipes, tentacles, and creeping vines.
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-amber-400">Key Parameters:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li><strong className="text-white">spineType</strong>: "helix", "arc", "s_curve", "wave", "linear"</li>
                    <li><strong className="text-white">spineLength / spineCurvature</strong>: Physical trajectory reach (meters) and bend amplitude</li>
                    <li><strong className="text-white">spineTwist</strong>: Continuous axial spin in degrees along the spine (e.g. 540°)</li>
                    <li><strong className="text-white">scaleStart / scaleEnd</strong>: Root vs tip cross-section scaling (e.g. 1.2 tapering to 0.15)</li>
                    <li><strong className="text-white">scaleProfile</strong>: "linear", "ease_out", "ease_in", "bell"</li>
                    <li><strong className="text-white">spineSteps</strong>: 24 to 64 (subdivisions along trajectory rail)</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 rounded-t-xl bg-neutral-900 border border-b-0 border-neutral-800">
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">code</span>
                    <span>swept_nautilus_horn.json</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    vectorSweep Benchmark
                  </span>
                </div>
                <pre className="flex-1 p-4 rounded-b-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-amber-300 overflow-x-auto whitespace-pre-wrap max-h-[460px] scrollbar-thin">
                  {SWEEP_CASE_STUDY_JSON}
                </pre>
              </div>
            </div>
          )}

          {activeVectorTab === 'extrude' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛡️</span>
                    <div>
                      <h3 className="text-base font-bold text-emerald-300">vectorExtrude: Extrusion, Bevel, Shell & Warp</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        HOLES • TAPER • TWIST • DOME WARP
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(EMBLEM_CASE_STUDY_JSON, 'emblem-json')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-xs text-emerald-400">
                      {copiedSection === 'emblem-json' ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedSection === 'emblem-json' ? 'Copied Emblem JSON!' : 'Copy Emblem JSON'}</span>
                  </button>
                </div>

                <p className="text-neutral-300 leading-relaxed">
                  Extrudes 2D vector contours along Z with full support for SVG Bezier curves, interior cutout loops (holes), directional taper, axial twist, hollow container solidify shells, sharp tactical bevel chamfers, and procedural face dome warping.
                </p>

                <div className="space-y-1.5">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-emerald-400">Key Parameters:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li><strong className="text-white">preserveOrigin</strong>: Disables auto-centering; preserves Cartesian +Y as UP for zero-seam alignment</li>
                    <li><strong className="text-white">svgPath</strong>: Direct SVG Bezier path string ("M ... C ... Z")</li>
                    <li><strong className="text-white">holes</strong>: Array of 2D cutout loops for letters ("0", "A", "8") and hollow rings</li>
                    <li><strong className="text-white">taper / twist</strong>: Directional cross-section scale and continuous axial rotation</li>
                    <li><strong className="text-white">shellEnabled / shellThickness</strong>: Insets contour into hollow containers and pipes</li>
                    <li><strong className="text-white">bevelSegments</strong>: 1 for tactical angled sword chamfers; 3-4 for rounded chrome fillets</li>
                    <li><strong className="text-white">bevelColor / bevelMetalness</strong>: Dual-material cap/bevel shading (e.g. mirror gold rim on enamel badge face)</li>
                    <li><strong className="text-white">curveSegments</strong>: 12-64 subdivision smoothness for SVG Bezier curves and arcs</li>
                    <li><strong className="text-white">domeWarpEnabled / domeCurvature</strong>: Deforms flat faces into spherical/parabolic bubble domes</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 rounded-t-xl bg-neutral-900 border border-b-0 border-neutral-800">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">code</span>
                    <span>unified_40_emblem.json</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    vectorExtrude Benchmark
                  </span>
                </div>
                <pre className="flex-1 p-4 rounded-b-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-[460px] scrollbar-thin">
                  {EMBLEM_CASE_STUDY_JSON}
                </pre>
              </div>
            </div>
          )}

          {activeVectorTab === 'carve' && (
            <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗿</span>
                <div>
                  <h3 className="text-base font-bold text-purple-300">vectorCarve: Orthogonal Dual-Silhouette Carve</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    CSG VISUAL HULL • FRONT + TOP/SIDE INTERSECTION
                  </span>
                </div>
              </div>

              <p className="text-neutral-300 leading-relaxed">
                Performs Constructive Solid Geometry (CSG) visual hull intersection from two orthogonal 2D silhouettes (Front elevation + Top or Side elevation). This matches the classic sculptor's technique of carving a shape first from the front, then turning the block 90° and cutting from the side.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-purple-400">Applications:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li>Vehicle chassis and aerodynamic fuselages</li>
                    <li>Animal figurines and organic character torsos</li>
                    <li>Ergonomic tool handles, mice, and footwear lasts</li>
                    <li>Monuments, statues, and architectural pavilions</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <span className="font-bold text-white text-[11px] uppercase tracking-wider text-purple-400">Parameters:</span>
                  <ul className="list-disc list-inside space-y-1 text-neutral-400 font-mono text-[11px]">
                    <li><strong className="text-white">frontSvgPath / frontPoints</strong>: Front silhouette</li>
                    <li><strong className="text-white">topSvgPath / topSidePoints</strong>: Top/Side profile</li>
                    <li><strong className="text-white">carveView</strong>: "top" or "side"</li>
                    <li><strong className="text-white">carveResolution</strong>: 24 to 48</li>
                    <li><strong className="text-white">carveSmooth</strong>: 1 to 4 smoothing passes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 4: EXHAUSTIVE PARAMETER DICTIONARY */}
        <section id="parameter-dictionary" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">
                04
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Exhaustive Parameter Dictionary (All 11 Features & 5 Vector Modes)
                </h2>
                <p className="text-xs text-neutral-400">
                  Complete technical specification of every parameter accepted by the AR-Test Scene API engine.
                </p>
              </div>
            </div>

            {/* Parameter Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2 text-neutral-400 text-sm">search</span>
                <input
                  type="text"
                  value={paramSearch}
                  onChange={(e) => setParamSearch(e.target.value)}
                  placeholder="Filter parameters (e.g. revolveAxis, depthFront)..."
                  className="pl-9 pr-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 w-64"
                />
              </div>
              {paramSearch && (
                <button
                  type="button"
                  onClick={() => setParamSearch('')}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pb-2">
            {[
              { id: 'all', label: 'All Parameters' },
              { id: 'vector', label: 'Pen Tool & Vectors (5 Modes)' },
              { id: 'shapes', label: 'Shapes & Extrusions' },
              { id: 'transform', label: 'Transform & Scale' },
              { id: 'scene', label: 'Scene & Fog' },
              { id: 'scatter', label: 'Scatter Foliage' },
              { id: 'text3d', label: '3D Typography' },
              { id: 'lighting', label: 'Lighting System' },
              { id: 'particles', label: 'GPU Particles' },
              { id: 'portal', label: 'AR Portal Gateway' },
              { id: 'website', label: '3D Web Viewport' },
              { id: 'tracking', label: 'Target Tracking' },
              { id: 'models', label: 'External Models' }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Interactive Parameter Table */}
          <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/60 shadow-lg">
            <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Feature Subsystem</th>
                    <th className="py-3 px-4">Parameter</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Valid Range / Enums</th>
                    <th className="py-3 px-4">Default</th>
                    <th className="py-3 px-4 min-w-[320px]">Impact & Visual Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80 font-mono text-neutral-300">
                  {filteredParams.length > 0 ? (
                    filteredParams.map((p, idx) => (
                      <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-semibold text-white whitespace-nowrap">
                          {p.feature}
                        </td>
                        <td className="py-3 px-4 font-bold text-cyan-300 whitespace-nowrap">
                          <code>{p.param}</code>
                        </td>
                        <td className="py-3 px-4 text-teal-300 whitespace-nowrap">
                          {p.type}
                        </td>
                        <td className="py-3 px-4 text-neutral-400 text-[11px] max-w-[200px] truncate" title={p.range}>
                          {p.range}
                        </td>
                        <td className="py-3 px-4 text-amber-300 whitespace-nowrap">
                          <code>{p.default}</code>
                        </td>
                        <td className="py-3 px-4 font-sans text-neutral-300 text-xs leading-relaxed">
                          {p.description}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500 font-sans">
                        No parameters match your search query: "{paramSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 5: ADDITIONAL PRODUCTION JSON EXAMPLES */}
        <section id="additional-examples" className="space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-xs">
              05
            </span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Additional Production JSON Examples
              </h2>
              <p className="text-xs text-neutral-400">
                Diverse sample payloads showcasing 3D typography, crystal scatter, cyber particles, dual-material bevels, and AR portal doorways.
              </p>
            </div>
          </div>

          {/* Featured v1.2 Showcase: Designer Enamel Seal */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-neutral-900 to-amber-950/25 border border-emerald-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="text-base">🎖️</span>
                    <span>Designer Enamel Seal (v1.2 Feature Showcase)</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                    NEW IN v1.2
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Demonstrates <strong>Dual-Material Cap/Bevel Shading</strong> (emerald enamel face with high-polish mirror gold chrome rim), <strong>Procedural Gingham Weave</strong> (<code className="text-emerald-400">pattern: "gingham"</code> + <code className="text-emerald-400">patternSecondaryColor</code>), <strong>Rainbow Arched Header 3D Text</strong> (<code className="text-amber-400">curveRadius: 1.15</code>), and <strong>Smiling Ribbon Slogan Text</strong> (<code className="text-amber-400">curveRadius: -0.95</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(DESIGNER_BADGE_CASE_STUDY_JSON, 'designer-badge-json')}
                className="self-start sm:self-center px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-xs">
                  {copiedSection === 'designer-badge-json' ? 'done' : 'content_copy'}
                </span>
                <span>{copiedSection === 'designer-badge-json' ? 'Copied Seal JSON!' : 'Copy Seal JSON'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-72 scrollbar-thin">
              {DESIGNER_BADGE_CASE_STUDY_JSON}
            </pre>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cyberpunk Example */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">location_city</span>
                    <span>Cyberpunk Hologram Shrine</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Octagonal metallic dais, floating torus ring, 3D neon text, crystal scatter, and cyber-matrix rain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(CYBER_CASE_STUDY_JSON, 'cyber-json')}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer border border-neutral-700"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedSection === 'cyber-json' ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedSection === 'cyber-json' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-neutral-950 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap max-h-72 scrollbar-thin">
                {CYBER_CASE_STUDY_JSON}
              </pre>
            </div>

            {/* Portal Example */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">cyclone</span>
                    <span>Ethereal AR Portal Gateway</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Arched spatial gateway with cosmic-nebula interior, floating header runes, and void crystals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(PORTAL_CASE_STUDY_JSON, 'portal-json')}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer border border-neutral-700"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedSection === 'portal-json' ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedSection === 'portal-json' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-neutral-950 text-xs font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap max-h-72 scrollbar-thin">
                {PORTAL_CASE_STUDY_JSON}
              </pre>
            </div>
          </div>
        </section>

        {/* SECTION 6: STEP-BY-STEP AR-TEST EXECUTION WORKFLOW */}
        <section id="workflow" className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
              06
            </span>
            <h2 className="text-lg font-bold text-white tracking-wide">
              How to Execute in AR-Test Studio
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-neutral-300">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center text-xs">1</span>
              <p className="font-semibold text-white">Prompt Gemini with Image</p>
              <p className="text-neutral-400">Upload your 2D photo to Google Gemini or Google AI Studio with the System Prompt provided above. Gemini outputs the complete JSON.</p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 font-bold flex items-center justify-center text-xs">2</span>
              <p className="font-semibold text-white">Open "🤖 AI Scene API"</p>
              <p className="text-neutral-400">In AR-Test (<code className="text-neutral-300">/ar-test</code>), click the <strong>🤖 AI Scene API</strong> button in the top action toolbar.</p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-400 font-bold flex items-center justify-center text-xs">3</span>
              <p className="font-semibold text-white">Paste & Validate</p>
              <p className="text-neutral-400">Paste Gemini's output into the input box. The validator verifies geometries, scatter targets, vector modes, and lighting automatically.</p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-600/30 text-amber-400 font-bold flex items-center justify-center text-xs">4</span>
              <p className="font-semibold text-white">Construct & Fine-Tune</p>
              <p className="text-neutral-400">Click <strong>"Construct 3D Scene"</strong>. The scene will instantiate instantly with full 3D Gizmos, scatter layer editors, and lighting controls ready for production export!</p>
            </div>
          </div>
        </section>

        {/* SECTION 7: NOTEBOOK LM INGESTION INSTRUCTIONS */}
        <section id="notebooklm-guide" className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold text-xs">
                07
              </span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Using This Document with Google NotebookLM
              </h2>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(generateNotebookLmMkdown(), 'notebooklm-btn-2')}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/25 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedSection === 'notebooklm-btn-2' ? 'done' : 'content_copy'}
              </span>
              <span>{copiedSection === 'notebooklm-btn-2' ? 'Copied Master Document!' : 'Copy Entire Document Markdown'}</span>
            </button>
          </div>

          <div className="text-xs text-neutral-300 space-y-2 leading-relaxed">
            <p>
              Google NotebookLM excels at indexing technical specifications to answer questions and formulate few-shot generation prompts. To add this resource to your Notebook:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 pt-1">
              <li>Click the <strong>"Copy Entire Document Markdown"</strong> button above.</li>
              <li>Open your project notebook at <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline hover:text-teal-300">notebooklm.google.com</a>.</li>
              <li>Click <strong>Add Source ➔ Copied text</strong> (or save as a <code className="text-neutral-300">.md</code> file and upload).</li>
              <li>NotebookLM will index all 11 parameter subsystems, the 5 vector mesh modes (revolve, inflate, sweep, extrude, carve), the tree decomposition case study, and the Gemini system prompt. You can then ask questions like <em>"How do I recreate a 2D photo of a sports stadium using AR-Test API?"</em>, <em>"How do I create a custom Greek vase with vectorRevolve?"</em>, or <em>"What parameters control foliage density on a curved sphere?"</em>.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
