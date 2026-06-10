# Troubleshooting Guide: AR Rendering Issues (No Texture / No Lighting)

This comprehensive guide details the structural and code-level fixes required to resolve texturing and lighting failures when 3D objects are rendered within your MindAR/A-Frame environment.

---

## 📋 Table of Contents
1. [Root Cause Analysis](#1-root-cause-analysis)
2. [Step-by-Step Resolution Instructions](#2-step-by-step-resolution-instructions)
3. [Implementation of the Corrected ARExperience Component](#3-implementation-of-the-corrected-arexperience-component)
4. [Fixing the `dynamic-materials` Component (`aframe-components.js`)](#4-fixing-the-dynamic-materials-component-aframe-componentsjs)
5. [Verification & Diagnostic Workflow](#5-verification--diagnostic-workflow)

---

## 1. Root Cause Analysis

Based on the architecture of the **`4d4tech/starwear`** codebase, three distinct vulnerabilities combine to strip textures or break the illumination tree post-scan:

### A. React Key Regeneration Killing the A-Frame Tree
The `<a-light>` tags are initialized with dynamic `key` attributes mapping directly to configuration metrics:
```jsx
<a-light key={`amb-${ambientColor}-${ambientIntensity}`} ... />
```
* **Why it breaks:** In classic web applications, rewriting a component's `key` string forces React to unmount the node and cleanly inject a brand new one. In an **A-Frame / Three.js** context, this completely bypasses A-Frame's lifecycle manager. The background entity is destroyed mid-frame, and the newly instantiated light fails to correctly attach to the Three.js scene graph. This results in a completely pitch-black scene.

### B. Material Overwrite Stripping Texture Maps
The custom `dynamic-materials` script alters properties like `metalness`, `roughness`, and `opacity` globally on the target asset.
* **Why it breaks:** If the component creates a new instance of `THREE.MeshStandardMaterial` to apply these attributes, it completely overwrites the material graph that came zipped inside the GLTF/GLB binary file, stripping out the critical embedded texturing maps (`material.map = null`).

### C. Physical Correctness Scale Scaling Down Lights
The scene is initialized using:
```jsx
renderer="colorManagement: true; physicallyCorrectLights: true"
```
* **Why it breaks:** With physical rendering rules enforced, light scales realistically via inverse-square physical distance equations. If your configurations load empty fallback strings or compute to low decimals, standard non-attenuated intensities (like `1.0` or `2.0`) will fall beneath the visible threshold, providing zero ambient or directional bounce.

---

## 2. Step-by-Step Resolution Instructions

### Step 1: Strip Component Keys from Lights
Open `src/pages/ARExperience.jsx`. Find your `<a-light>` node implementations. Strip away all template-literal `key={...}` fields. Let React dynamically change properties via standard DOM element modifications, allowing A-Frame’s mutation observers to seamlessly catch adjustments.

### Step 2: Scale Intensity Figures to Match Physical Rules
Because `physicallyCorrectLights` is flagged as `true`, scale your ambient and directional intensity configurations up to ensure high visibility. Alternatively, switch to the contemporary A-Frame standard property layout:
```jsx
renderer="colorManagement: true; lighting: physical;"
```

### Step 3: Patch Material Mutators to Preserve Existing Map Vectors
Inspect your `src/utils/aframe-components.js` helper functions. Ensure any routine shifting properties across model nodes mutates the **existing material references directly** instead of reconstructing a blank object from scratch.

---

## 3. Implementation of the Corrected ARExperience Component

Update the rendering tree inside `src/pages/ARExperience.jsx` to reflect the stable architecture outlined below:

```jsx
return (
  <div className="w-screen h-[100dvh] overflow-hidden relative bg-transparent">
    {/* Diagnostic Screen Layer */}
    <div className="absolute top-4 left-4 z-50 p-3 bg-black/80 text-green-400 font-mono text-xs max-w-md rounded-md border border-green-500/30 max-h-[40vh] overflow-y-auto pointer-events-none">
      <div className="font-bold border-b border-green-500/20 pb-1 mb-1">🔍 AR RUNTIME DIAGNOSTICS</div>
      {logs.map((l, i) => (
        <div key={i} className="mb-1 leading-tight">
          <span className="text-gray-400">[{l.tag}]</span> {l.msg}
        </div>
      ))}
    </div>

    {/* Primary MindAR/A-Frame Node Graph */}
    <a-scene
      mindar-image={`imageTargetSrc: ${arData.mindPath}; filterMinCF: 0.0001; filterBeta: 0.001; missTolerance: 5;`}
      color-space="sRGB"
      renderer="colorManagement: true; physicallyCorrectLights: true;"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      loading-screen="enabled: false"
      fog={fogDensity > 0 ? `type: exponential; color: ${fogColor}; density: ${fogDensity}` : ''}
    >
      <a-assets>
        <a-asset-item id="metaModel" src={arData.gltfPath} crossOrigin="anonymous"></a-asset-item>
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      {/* FIXED: Removed key properties to allow native A-Frame attribute mutation */}
      <a-light 
        type="ambient" 
        color={ambientColor} 
        intensity={ambientIntensity}
      ></a-light>
      
      <a-light 
        type="directional" 
        color={dir1Color} 
        intensity={dir1Intensity} 
        position={dir1Position}
      ></a-light>
      
      <a-light 
        type="directional" 
        color={dir2Color} 
        intensity={dir2Intensity} 
        position={dir2Position}
      ></a-light>

      {/* Target Tracker Anchor */}
      <a-entity mindar-image-target="targetIndex: 0">
        <a-gltf-model
          id="ar-model"
          src="#metaModel"
          position="0 0 0"
          scale={`${modelScale} ${modelScale} ${modelScale}`}
          rotation={`${modelRotX} ${modelRotY} ${modelRotZ}`}
          {...(modelRotSpeed > 0 ? { 
            animation: `property: rotation; from: ${modelRotX} ${modelRotY} ${modelRotZ}; to: ${modelRotX} ${modelRotY + 360} ${modelRotZ}; loop: true; dur: ${modelRotSpeed}; easing: linear;` 
          } : {})}
          dynamic-materials={`metalness: ${matMetalness}; roughness: ${matRoughness}; emissive: ${matEmissive}; emissiveIntensity: ${matEmissiveIntensity}; wireframe: ${matWireframe}; opacity: ${matOpacity}`}
          play-gltf-video={`playing: ${mediaPlaying}`}
          play-gltf-animation={`playing: ${mediaPlaying}`}
        ></a-gltf-model>
      </a-entity>
    </a-scene>

    {/* Standard App Overlay Controls */}
    {renderOverlays()}
  </div>
);
```

---

## 4. Fixing the `dynamic-materials` Component (`aframe-components.js`)

Ensure that your custom modifier schema does not unintentionally overwrite texture values. The following design pattern shows how your custom component should modify material details safely:

```javascript
AFRAME.registerComponent('dynamic-materials', {
  schema: {
    metalness: { type: 'number', default: 0.0 },
    roughness: { type: 'number', default: 1.0 },
    emissive: { type: 'color', default: '#000000' },
    emissiveIntensity: { type: 'number', default: 1.0 },
    wireframe: { type: 'boolean', default: false },
    opacity: { type: 'number', default: 1.0 }
  },

  update: function () {
    const data = this.data;
    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      mesh.traverse((node) => {
        if (node.isMesh && node.material) {
          // SAFE APPROACH: Mutate parameters on the existing material instance
          node.material.metalness = data.metalness;
          node.material.roughness = data.roughness;
          node.material.emissive.set(data.emissive);
          node.material.emissiveIntensity = data.emissiveIntensity;
          node.material.wireframe = data.wireframe;
          node.material.opacity = data.opacity;
          node.material.transparent = data.opacity < 1.0;
          
          // Signal Three.js that material updates require cache refresh
          node.material.needsUpdate = true;
        }
      });
    });
  }
});
```

---

## 5. Verification & Diagnostic Workflow

To confirm these fixes resolve the issue, scan a target tracking marker and look at the real-time debugging panel:

1. **`FINAL_CONFIG` Verification:**
   * Review the initialized log stack. If parameters like `ambientIntensity` or `dir1Intensity` read as `0`, check your default properties inside your database fallback logic.

2. **`MATERIAL_INSPECT` Validation:**
   * Your code includes a runtime diagnostic scanner that checks material map states:
     ```javascript
     const hasMap = node.material.map ? "YES" : "NO";
     logToScreen(`MATERIAL_INSPECT [${node.name}]`, `Has Texture Map: ${hasMap}`);
     ```
   * **If `YES`**: The texture coordinates are correctly loaded into GPU memory. If the model is still dark, adjust your `a-light` values or decrease the `roughness` parameter.
   * **If `NO`**: Your dynamic modifications are dropping the texture maps. Revisit your asset paths and ensure the model initialization pattern matches the safe traversal logic outlined in section 4.
