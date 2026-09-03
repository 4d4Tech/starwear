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
  // Finds and decodes video textures embedded in GLTF materials or supplied via src,
  // ensures iOS Safari WebKit mobile compatibility (playsinline before src, muted,
  // DOM attached, user gesture unlocking), and forces WebGL texture memory sync on every render frame.
  // =========================================================================
  if (!AFRAME.components['play-gltf-video']) {
    const videoElementCache = new Map();

    const unlockAllVideos = () => {
      videoElementCache.forEach((video) => {
        if (video) {
          video.muted = true;
          video.playsInline = true;
          const p = video.play();
          if (p && p.catch) p.catch(() => {});
        }
      });
    };

    if (typeof window !== 'undefined') {
      ['touchstart', 'touchend', 'pointerdown', 'click'].forEach((evt) => {
        window.addEventListener(evt, unlockAllVideos, { passive: true });
        document.addEventListener(evt, unlockAllVideos, { passive: true });
      });
    }

    const createOrActivateVideoElement = (videoOrUrl) => {
      if (!videoOrUrl) return null;
      if (videoOrUrl.tagName === 'VIDEO' || videoOrUrl instanceof HTMLVideoElement) {
        return videoOrUrl;
      }
      if (typeof videoOrUrl !== 'string' || videoOrUrl.trim() === '') {
        return null;
      }

      const url = videoOrUrl.trim();
      if (videoElementCache.has(url)) {
        const cached = videoElementCache.get(url);
        if (cached && cached.isConnected) {
          cached.muted = true;
          if (cached.paused) cached.play().catch(() => {});
          return cached;
        }
      }

      const video = document.createElement('video');
      
      // CRITICAL FOR iOS SAFARI: Attributes must be set before assigning video.src
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.loop = true;
      video.volume = 0;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('x5-playsinline', '');
      video.setAttribute('x5-video-player-type', 'h5-page');
      video.setAttribute('muted', '');
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.setAttribute('preload', 'auto');

      if (/^https?:\/\//i.test(url)) {
        video.crossOrigin = 'anonymous';
      }
      video.src = url;

      // Ensure video is in active viewport DOM so iOS hardware media decoders remain active
      let container = document.getElementById('aframe-video-hidden-box');
      if (!container) {
        container = document.createElement('div');
        container.id = 'aframe-video-hidden-box';
        container.style.cssText = 'position:fixed;top:0;left:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-999;overflow:hidden;';
        document.body.appendChild(container);
      }
      container.appendChild(video);

      try {
        video.load();
      } catch {}

      const tryPlay = () => {
        video.muted = true;
        const p = video.play();
        if (p && p.catch) {
          p.catch(() => {});
        }
      };

      video.addEventListener('canplay', tryPlay);
      video.addEventListener('canplaythrough', tryPlay);
      video.addEventListener('loadeddata', tryPlay);
      video.addEventListener('loadedmetadata', tryPlay);
      tryPlay();

      videoElementCache.set(url, video);
      return video;
    };

    AFRAME.registerComponent('play-gltf-video', {
      schema: {
        src: { type: 'string', default: '' },
        playing: { type: 'boolean', default: true },
        targetMesh: { type: 'string', default: 'auto' },
        flipX: { type: 'boolean', default: false }
      },
      init: function () {
        this.videos = [];
        this.videoTextures = [];
        this.applyVideo = this.applyVideo.bind(this);
        this.unlockVideos = this.unlockVideos.bind(this);

        this.el.addEventListener('model-loaded', this.applyVideo);
        if (this.el.getObject3D('mesh')) {
          this.applyVideo();
        }

        // Global interaction listeners to unlock mobile autoplay restrictions if needed
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
          window.addEventListener(evt, this.unlockVideos, { passive: true });
        });

        // Listen for targetFound and arReady on parent scene
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.addEventListener('targetFound', this.applyVideo);
          sceneEl.addEventListener('arReady', this.applyVideo);
        }
      },
      update: function (oldData) {
        if (!oldData || oldData.src !== this.data.src || oldData.targetMesh !== this.data.targetMesh || oldData.flipX !== this.data.flipX) {
          this.applyVideo();
        }
        if (!oldData || oldData.playing !== this.data.playing) {
          if (this.data.playing) {
            this.videos.forEach((v) => {
              if (v && v.paused) v.play().catch(() => {});
            });
          } else {
            this.videos.forEach((v) => {
              if (v && !v.paused) v.pause();
            });
          }
        }
      },
      tick: function () {
        if (this.data.playing && this.videoTextures && this.videoTextures.length > 0) {
          for (let i = 0; i < this.videoTextures.length; i++) {
            const tex = this.videoTextures[i];
            const vid = this.videos[i];
            if (vid) {
              if (vid.paused && vid.readyState >= 2 && this.data.playing) {
                vid.play().catch(() => {});
              }
              if (!vid.paused && vid.readyState >= 2) {
                tex.needsUpdate = true;
              }
            }
          }
        }
      },
      unlockVideos: function () {
        if (this.data.playing && this.videos.length > 0) {
          this.videos.forEach((v) => {
            if (v && v.paused) {
              v.play().catch(() => {});
            }
          });
        }
      },
      applyTextureFlip: function (tex, isFlipX) {
        if (!tex) return;
        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        if (isFlipX) {
          tex.wrapS = THREE_LIB.RepeatWrapping;
          tex.repeat.set(-1, 1);
          tex.offset.set(1, 0);
        } else {
          tex.wrapS = THREE_LIB.ClampToEdgeWrapping;
          tex.repeat.set(1, 1);
          tex.offset.set(0, 0);
        }
        tex.matrixAutoUpdate = true;
        if (tex.updateMatrix) tex.updateMatrix();
        tex.needsUpdate = true;
      },
      applyVideo: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        const THREE_LIB = (AFRAME && AFRAME.THREE) ? AFRAME.THREE : THREE;
        this.videos = [];
        this.videoTextures = [];

        const targetParam = (this.data.targetMesh || 'auto').trim().toLowerCase();
        const screenKeywords = [
          'video', 'screen', 'display', 'curved', 'plane', 'front', 'panel',
          'cloth', 'graphic', 'print', 'texture', 'layer', 'tee', 'shirt', 'hoodie', 'fabric'
        ];

        const matchedMeshes = [];
        const allMeshes = [];
        const autoScreenMeshes = [];

        obj.traverse((node) => {
          if (node.isMesh) {
            allMeshes.push(node);
            const nodeName = (node.name || '').toLowerCase();
            const nodeUuid = (node.uuid || '').toLowerCase();

            if (targetParam === 'all') {
              matchedMeshes.push(node);
            } else if (targetParam !== 'auto' && (nodeName === targetParam || nodeUuid === targetParam)) {
              matchedMeshes.push(node);
            } else {
              if (screenKeywords.some((kw) => nodeName.includes(kw)) || node.userData?.hasVideo || node.userData?.videoUrl) {
                autoScreenMeshes.push(node);
              }
            }
          }
        });

        let finalTargetMeshes = matchedMeshes;
        if (finalTargetMeshes.length === 0) {
          finalTargetMeshes = autoScreenMeshes.length > 0 ? autoScreenMeshes : allMeshes;
        }

        const isFlip = !!this.data.flipX;

        // 1. If explicit video src is provided on component, create VideoTexture and map to mesh
        if (this.data.src && this.data.src.trim() !== '') {
          const video = createOrActivateVideoElement(this.data.src);
          if (video) {
            const videoTexture = new THREE_LIB.VideoTexture(video);
            if (THREE_LIB.SRGBColorSpace !== undefined) {
              videoTexture.colorSpace = THREE_LIB.SRGBColorSpace;
            }
            videoTexture.minFilter = THREE_LIB.LinearFilter;
            videoTexture.magFilter = THREE_LIB.LinearFilter;
            videoTexture.generateMipmaps = false;
            videoTexture.flipY = false;
            this.applyTextureFlip(videoTexture, isFlip);

            this.videos.push(video);
            this.videoTextures.push(videoTexture);

            finalTargetMeshes.forEach((node) => {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((mat) => {
                mat.map = videoTexture;
                mat.emissiveMap = videoTexture;
                if (mat.emissive && typeof mat.emissive.set === 'function') {
                  mat.emissive.set(0xffffff);
                }
                mat.emissiveIntensity = 0.5;
                mat.needsUpdate = true;
              });
            });
          }
        }

        // 2. Discover embedded video textures, node.userData video URLs, and texture video URIs
        obj.traverse((node) => {
          if (node.isMesh && node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            
            // Check if node or material has a videoUrl in userData (e.g. from Studio 4D*4 export)
            const nodeVideoUrl = node.userData?.videoUrl || node.userData?.videoSrc || node.userData?.video ||
                                 materials[0]?.userData?.videoUrl || materials[0]?.userData?.videoSrc || '';

            if (nodeVideoUrl && (!this.data.src || this.data.src.trim() === '')) {
              const video = createOrActivateVideoElement(nodeVideoUrl);
              if (video) {
                const vTex = new THREE_LIB.VideoTexture(video);
                if (THREE_LIB.SRGBColorSpace !== undefined) {
                  vTex.colorSpace = THREE_LIB.SRGBColorSpace;
                }
                vTex.minFilter = THREE_LIB.LinearFilter;
                vTex.magFilter = THREE_LIB.LinearFilter;
                vTex.generateMipmaps = false;
                vTex.flipY = false;
                this.applyTextureFlip(vTex, isFlip);

                materials.forEach((mat) => {
                  mat.map = vTex;
                  mat.emissiveMap = vTex;
                  if (mat.emissive && typeof mat.emissive.set === 'function') {
                    mat.emissive.set(0xffffff);
                  }
                  mat.emissiveIntensity = 0.4;
                  mat.needsUpdate = true;
                });

                if (!this.videos.includes(video)) this.videos.push(video);
                if (!this.videoTextures.includes(vTex)) this.videoTextures.push(vTex);
              }
            }

            materials.forEach((mat) => {
              const maps = [
                'map',
                'emissiveMap',
                'alphaMap',
                'roughnessMap',
                'metalnessMap',
                'aoMap',
                'bumpMap',
                'normalMap',
                'displacementMap'
              ];
              maps.forEach((mapName) => {
                if (mat[mapName]) {
                  const tex = mat[mapName];
                  let video = null;
                  let vTex = null;

                  // Case A: Texture is already a VideoTexture or image is a video tag
                  if (tex.image && (tex.image.tagName === 'VIDEO' || tex.image instanceof HTMLVideoElement)) {
                    video = createOrActivateVideoElement(tex.image);
                    vTex = tex;
                  } else if (tex.source && tex.source.data && (tex.source.data.tagName === 'VIDEO' || tex.source.data instanceof HTMLVideoElement)) {
                    video = createOrActivateVideoElement(tex.source.data);
                    vTex = tex;
                  } else if (mat.userData && mat.userData.video) {
                    video = createOrActivateVideoElement(mat.userData.video);
                    vTex = tex;
                  } else if (tex.isVideoTexture && tex.image) {
                    video = createOrActivateVideoElement(tex.image);
                    vTex = tex;
                  }
                  // Case B: Texture image URL is a video file (.mp4, .webm, .mov, etc.)
                  else if (tex.image && typeof tex.image.src === 'string' && /\.(mp4|webm|mov|ogg)($|\?)/i.test(tex.image.src)) {
                    video = createOrActivateVideoElement(tex.image.src);
                    vTex = new THREE_LIB.VideoTexture(video);
                    if (THREE_LIB.SRGBColorSpace !== undefined) {
                      vTex.colorSpace = THREE_LIB.SRGBColorSpace;
                    }
                    vTex.minFilter = THREE_LIB.LinearFilter;
                    vTex.magFilter = THREE_LIB.LinearFilter;
                    vTex.generateMipmaps = false;
                    vTex.flipY = false;
                    mat[mapName] = vTex;
                    mat.needsUpdate = true;
                  }

                  if (video && vTex) {
                    this.applyTextureFlip(vTex, isFlip);
                    if (!this.videos.includes(video)) {
                      this.videos.push(video);
                    }
                    if (!this.videoTextures.includes(vTex)) {
                      this.videoTextures.push(vTex);
                    }
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
            if (vid) {
              if (vid.paused && vid.readyState >= 2) {
                vid.play().catch(() => {});
              }
              if (!vid.paused) {
                tex.needsUpdate = true;
              }
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
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.removeEventListener('targetFound', this.applyVideo);
          sceneEl.removeEventListener('arReady', this.applyVideo);
        }
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
          window.removeEventListener(evt, this.unlockVideos);
        });
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
