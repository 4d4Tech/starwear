import 'aframe';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const AFRAME = typeof window !== 'undefined' ? window.AFRAME : undefined;

if (typeof AFRAME !== 'undefined') {
  // =========================================================================
  // 1. SCENE-ENVIRONMENT COMPONENT
  // Sets up procedural Image-Based Lighting (IBL) via PMREMGenerator & RoomEnvironment,
  // ACESFilmic Tone Mapping, and sRGB color management on the WebGL scene.
  // =========================================================================
  if (!AFRAME.components['scene-environment']) {
    AFRAME.registerComponent('scene-environment', {
      schema: {
        exposure: { type: 'number', default: 1.0 },
        hdrIntensity: { type: 'number', default: 1.0 }
      },
      init: function () {
        this.setupEnvironment = this.setupEnvironment.bind(this);
        const sceneEl = this.el;

        if (sceneEl.hasLoaded) {
          this.setupEnvironment();
        } else {
          sceneEl.addEventListener('loaded', this.setupEnvironment);
          sceneEl.addEventListener('render-target-loaded', this.setupEnvironment);
        }
      },
      update: function () {
        const renderer = this.el.renderer;
        if (renderer) {
          renderer.toneMappingExposure = this.data.exposure;
        }
      },
      setupEnvironment: function () {
        const scene = this.el.object3D;
        const renderer = this.el.renderer;
        if (!renderer || !scene) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;

        // Configure Tone Mapping & Color Space
        if (THREE_LIB.ACESFilmicToneMapping !== undefined) {
          renderer.toneMapping = THREE_LIB.ACESFilmicToneMapping;
        }
        renderer.toneMappingExposure = this.data.exposure;

        if (renderer.outputColorSpace !== undefined && THREE_LIB.SRGBColorSpace !== undefined) {
          renderer.outputColorSpace = THREE_LIB.SRGBColorSpace;
        }

        // Generate procedural studio environment (PMREM RoomEnvironment)
        try {
          const pmremGenerator = new THREE_LIB.PMREMGenerator(renderer);
          pmremGenerator.compileEquirectangularShader();
          const roomEnv = new RoomEnvironment();
          const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
          scene.environment = envTexture;
          this.envTexture = envTexture;
          this.pmremGenerator = pmremGenerator;
        } catch (err) {
          console.warn('[scene-environment] Could not initialize RoomEnvironment:', err);
        }
      },
      remove: function () {
        if (this.envTexture) {
          this.envTexture.dispose();
        }
        if (this.pmremGenerator) {
          this.pmremGenerator.dispose();
        }
      }
    });
  }

  // =========================================================================
  // 2. DYNAMIC-MATERIALS COMPONENT
  // Traverses the 3D model hierarchy, safely preserving all embedded GLTF/GLB
  // texture maps (diffuse, normal, roughness, metalness, emissive, ao, alpha)
  // while applying PBR lighting parameters and DoubleSide rendering.
  // =========================================================================
  if (!AFRAME.components['dynamic-materials']) {
    AFRAME.registerComponent('dynamic-materials', {
      schema: {
        metalness: { type: 'number', default: -1 },
        roughness: { type: 'number', default: -1 },
        emissive: { type: 'color', default: '' },
        emissiveIntensity: { type: 'number', default: -1 },
        wireframe: { type: 'boolean', default: false },
        opacity: { type: 'number', default: 1.0 }
      },
      init: function () {
        this.applyMaterials = this.applyMaterials.bind(this);
        this.el.addEventListener('model-loaded', this.applyMaterials);

        if (this.el.getObject3D('mesh')) {
          this.applyMaterials();
        }
      },
      update: function () {
        this.applyMaterials();
      },
      applyMaterials: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const data = this.data;

        obj.traverse((node) => {
          if (node.isMesh) {
            // Ensure smooth normals for realistic surface specular highlights
            if (node.geometry && !node.geometry.attributes.normal) {
              node.geometry.computeVertexNormals();
            }

            if (node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];

              materials.forEach((mat) => {
                // Ensure double-sided rendering to prevent backface culling darkness
                mat.side = THREE_LIB.DoubleSide;

                // Configure color spaces on texture maps
                if (mat.map) {
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    mat.map.colorSpace = THREE_LIB.SRGBColorSpace;
                  } else if (THREE_LIB.sRGBEncoding !== undefined) {
                    mat.map.encoding = THREE_LIB.sRGBEncoding;
                  }
                  mat.map.needsUpdate = true;
                }

                if (mat.emissiveMap) {
                  if (THREE_LIB.SRGBColorSpace !== undefined) {
                    mat.emissiveMap.colorSpace = THREE_LIB.SRGBColorSpace;
                  } else if (THREE_LIB.sRGBEncoding !== undefined) {
                    mat.emissiveMap.encoding = THREE_LIB.sRGBEncoding;
                  }
                  mat.emissiveMap.needsUpdate = true;
                }

                if (mat.normalMap) mat.normalMap.needsUpdate = true;
                if (mat.roughnessMap) mat.roughnessMap.needsUpdate = true;
                if (mat.metalnessMap) mat.metalnessMap.needsUpdate = true;
                if (mat.aoMap) mat.aoMap.needsUpdate = true;
                if (mat.alphaMap) mat.alphaMap.needsUpdate = true;

                // Apply explicit user overrides only if configured (>= 0 or non-empty)
                if (data.metalness >= 0 && mat.metalness !== undefined) {
                  mat.metalness = data.metalness;
                }
                if (data.roughness >= 0 && mat.roughness !== undefined) {
                  mat.roughness = data.roughness;
                }

                if (data.emissive && data.emissive.trim() !== '' && mat.emissive && typeof mat.emissive.set === 'function') {
                  mat.emissive.set(data.emissive);
                }
                if (data.emissiveIntensity >= 0 && mat.emissiveIntensity !== undefined) {
                  mat.emissiveIntensity = data.emissiveIntensity;
                }

                mat.wireframe = !!data.wireframe;

                if (data.opacity !== undefined && data.opacity < 1.0) {
                  mat.opacity = data.opacity;
                  mat.transparent = true;
                } else if (mat.opacity === 1.0 && !mat.alphaMap && !mat.map?.format?.toString().includes('alpha')) {
                  // Keep default transparency setting
                }

                mat.needsUpdate = true;
              });
            }
          }
        });
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyMaterials);
      }
    });
  }

  // =========================================================================
  // 3. MODEL-AUTO-CENTER COMPONENT
  // Centers the 3D model bounding box to the target anchor coordinate frame
  // and normalizes any abnormal coordinate dimensions.
  // =========================================================================
  if (!AFRAME.components['model-auto-center']) {
    AFRAME.registerComponent('model-auto-center', {
      schema: {
        enabled: { type: 'boolean', default: true },
        targetSize: { type: 'number', default: 1.0 }
      },
      init: function () {
        this.centerModel = this.centerModel.bind(this);
        this.el.addEventListener('model-loaded', this.centerModel);
        if (this.el.getObject3D('mesh')) {
          this.centerModel();
        }
      },
      centerModel: function () {
        if (!this.data.enabled) return;
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        const box = new THREE_LIB.Box3().setFromObject(mesh);
        if (box.isEmpty()) return;

        const size = new THREE_LIB.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        if (isFinite(maxDim) && maxDim > 0) {
          // Normalize models authored in millimeters (>10 units) or sub-millimeter (<0.05 units)
          if (maxDim > 10 || maxDim < 0.05) {
            const autoScale = this.data.targetSize / maxDim;
            if (isFinite(autoScale) && autoScale > 0) {
              mesh.scale.set(autoScale, autoScale, autoScale);
            }
          }
        }

        // Recompute center after scale normalization and align pivot
        const newBox = new THREE_LIB.Box3().setFromObject(mesh);
        const center = new THREE_LIB.Vector3();
        newBox.getCenter(center);

        if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
          mesh.position.x -= center.x;
          mesh.position.y -= center.y;
          mesh.position.z -= center.z;
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.centerModel);
      }
    });
  }

  // =========================================================================
  // 4. PLAY-GLTF-VIDEO COMPONENT
  // Finds video textures embedded in the GLTF materials, ensures iOS/Android
  // compatibility (playsinline, muted), and updates WebGL texture memory on tick.
  // =========================================================================
  if (!AFRAME.components['play-gltf-video']) {
    AFRAME.registerComponent('play-gltf-video', {
      schema: { playing: { type: 'boolean', default: true } },
      init: function () {
        this.videos = [];
        this.videoTextures = [];
        this.applyVideo = this.applyVideo.bind(this);
        this.el.addEventListener('model-loaded', this.applyVideo);
        if (this.el.getObject3D('mesh')) {
          this.applyVideo();
        }
      },
      applyVideo: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        this.videos = [];
        this.videoTextures = [];

        obj.traverse((node) => {
          if (node.isMesh && node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((mat) => {
              const maps = ['map', 'emissiveMap', 'alphaMap'];
              maps.forEach((mapName) => {
                if (mat[mapName]) {
                  let video = null;
                  if (mat[mapName].image && mat[mapName].image.tagName === 'VIDEO') {
                    video = mat[mapName].image;
                  } else if (mat[mapName].source && mat[mapName].source.data && mat[mapName].source.data.tagName === 'VIDEO') {
                    video = mat[mapName].source.data;
                  }

                  if (video) {
                    video.loop = true;
                    video.muted = true;
                    video.playsInline = true;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    video.crossOrigin = 'anonymous';

                    this.videos.push(video);
                    this.videoTextures.push(mat[mapName]);

                    if (this.data.playing) {
                      video.play().catch(() => {});
                    }
                  }
                }
              });
            });
          }
        });
      },
      tick: function () {
        if (this.data.playing && this.videoTextures.length > 0) {
          for (let i = 0; i < this.videoTextures.length; i++) {
            const tex = this.videoTextures[i];
            const vid = this.videos[i];
            if (vid && !vid.paused && vid.readyState >= 2) {
              tex.needsUpdate = true;
            }
          }
        }
      },
      update: function () {
        if (this.data.playing) {
          this.videos.forEach((v) => v.play().catch(() => {}));
        } else {
          this.videos.forEach((v) => v.pause());
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyVideo);
        this.videos.forEach((v) => v.pause());
      }
    });
  }

  // =========================================================================
  // 5. PLAY-GLTF-ANIMATION COMPONENT
  // Drives skeletal and morph target animation clips embedded inside GLTF/GLB models.
  // =========================================================================
  if (!AFRAME.components['play-gltf-animation']) {
    AFRAME.registerComponent('play-gltf-animation', {
      schema: { playing: { type: 'boolean', default: true } },
      init: function () {
        this.mixer = null;
        this.applyAnimation = this.applyAnimation.bind(this);
        this.el.addEventListener('model-loaded', this.applyAnimation);
        if (this.el.getObject3D('mesh')) {
          this.applyAnimation();
        }
      },
      applyAnimation: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj || !obj.animations || obj.animations.length === 0) return;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this.mixer = new THREE_LIB.AnimationMixer(obj);
        obj.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
        if (!this.data.playing) {
          this.mixer.timeScale = 0;
        }
      },
      update: function () {
        if (this.mixer) {
          this.mixer.timeScale = this.data.playing ? 1 : 0;
        }
      },
      tick: function (time, timeDelta) {
        if (this.mixer && this.data.playing) {
          this.mixer.update(timeDelta / 1000);
        }
      },
      remove: function () {
        this.el.removeEventListener('model-loaded', this.applyAnimation);
        if (this.mixer) {
          this.mixer.stopAllAction();
        }
      }
    });
  }
}
