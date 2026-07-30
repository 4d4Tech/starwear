import 'aframe';

if (typeof AFRAME !== 'undefined') {
  // ==========================================
  // 1. DYNAMIC-MATERIALS COMPONENT
  // ==========================================
  if (!AFRAME.components['dynamic-materials']) {
    AFRAME.registerComponent('dynamic-materials', {
      schema: {
        metalness: { type: 'number', default: -1 },
        roughness: { type: 'number', default: -1 },
        emissive: { type: 'color', default: '' },
        emissiveIntensity: { type: 'number', default: -1 },
        wireframe: { type: 'boolean', default: false },
        opacity: { type: 'number', default: 1.0 },
        envMapUrl: { type: 'string', default: 'https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/environment-map.jpg?alt=media&token=d96fbc96-ccab-4ee1-bf6b-96cc37162fd9' }
      },
      init: function () {
        console.log("dynamic-materials shared init: registering model-loaded listener");
        this.applyMaterials = this.applyMaterials.bind(this);
        this.el.addEventListener('model-loaded', this.applyMaterials);
        
        // Pre-load the environment map
        this.envMapTexture = null;
        if (this.data.envMapUrl) {
          const textureLoader = new AFRAME.THREE.TextureLoader();
          textureLoader.crossOrigin = 'anonymous';
          textureLoader.load(
            this.data.envMapUrl,
            (texture) => {
              texture.mapping = AFRAME.THREE.EquirectangularReflectionMapping;
              if (AFRAME.THREE.SRGBColorSpace !== undefined) {
                texture.colorSpace = AFRAME.THREE.SRGBColorSpace;
              } else if (AFRAME.THREE.sRGBEncoding !== undefined) {
                texture.encoding = AFRAME.THREE.sRGBEncoding;
              }
              this.envMapTexture = texture;
              // Force an update once the texture is downloaded
              this.applyMaterials();
            },
            undefined,
            (err) => {
              console.warn("envMapTexture load error:", err);
            }
          );
        }

        if (this.el.getObject3D('mesh')) {
          console.log("dynamic-materials shared init: mesh already loaded, applying immediately");
          this.applyMaterials();
        }
      },
      update: function () {
        this.applyMaterials();
      },
      applyMaterials: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;

        obj.traverse((node) => {
          if (node.isMesh) {
            if (node.geometry && !node.geometry.attributes.normal) {
              node.geometry.computeVertexNormals();
            }

            if (node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((mat) => {
                // Ensure double sided rendering to prevent backface culling blackness
                mat.side = AFRAME.THREE.DoubleSide;

                // Inject the downloaded environment map if available
                if (this.envMapTexture) {
                  mat.envMap = this.envMapTexture;
                  if (mat.envMapIntensity === undefined || mat.envMapIntensity === 0) {
                    mat.envMapIntensity = 1.0;
                  }
                }

                // Only override PBR properties if explicitly configured (>= 0 or non-empty color)
                if (this.data.metalness >= 0 && mat.metalness !== undefined) {
                  mat.metalness = this.data.metalness;
                } else if (this.data.metalness < 0 && mat.metalness !== undefined) {
                  mat.metalness = 0.0;
                }
                if (this.data.roughness >= 0 && mat.roughness !== undefined) {
                  mat.roughness = this.data.roughness;
                } else if (this.data.roughness < 0 && mat.roughness !== undefined) {
                  mat.roughness = 1.0;
                }
                if (this.data.emissive && this.data.emissive.trim() !== '' && mat.emissive && typeof mat.emissive.set === 'function') {
                  mat.emissive.set(this.data.emissive);
                }
                if (this.data.emissiveIntensity >= 0 && mat.emissiveIntensity !== undefined) {
                  mat.emissiveIntensity = this.data.emissiveIntensity;
                }

                mat.wireframe = !!this.data.wireframe;
                if (this.data.opacity !== undefined && this.data.opacity < 1.0) {
                  mat.opacity = this.data.opacity;
                  mat.transparent = true;
                }

                // Update texture maps to correct sRGB color space & mark for WebGL upload
                const maps = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'alphaMap'];
                maps.forEach(mapName => {
                  if (mat[mapName]) {
                    if (mapName === 'map' || mapName === 'emissiveMap') {
                      if (AFRAME.THREE.SRGBColorSpace !== undefined) {
                        mat[mapName].colorSpace = AFRAME.THREE.SRGBColorSpace;
                      } else if (AFRAME.THREE.sRGBEncoding !== undefined) {
                        mat[mapName].encoding = AFRAME.THREE.sRGBEncoding;
                      }
                    }
                    mat[mapName].needsUpdate = true;
                  }
                });

                mat.needsUpdate = true;
              });
            }
          }
        });
      }
    });
  }

  // ==========================================
  // 2. PLAY-GLTF-VIDEO COMPONENT
  // ==========================================
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
              maps.forEach(mapName => {
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
                      video.play().catch(e => console.error("Video play failed:", e));
                    }
                  }
                }
              });
            });
          }
        });
      },
      tick: function () {
        // Keep video textures updated every frame so WebGL renders video frames
        if (this.data.playing && this.videoTextures.length > 0) {
          for (let i = 0; i < this.videoTextures.length; i++) {
            const tex = this.videoTextures[i];
            const vid = this.videos[i];
            if (vid && !vid.paused && vid.readyState >= vid.HAVE_CURRENT_DATA) {
              tex.needsUpdate = true;
            }
          }
        }
      },
      update: function() {
        if (this.data.playing) {
          this.playVideo();
        } else {
          this.pauseVideo();
        }
      },
      pauseVideo: function() {
        this.videos.forEach(v => v.pause());
      },
      playVideo: function() {
        this.videos.forEach(v => v.play().catch(e => {}));
      }
    });
  }

  // ==========================================
  // 3. PLAY-GLTF-ANIMATION COMPONENT
  // ==========================================
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
        const THREE_INSTANCE = AFRAME.THREE;
        this.mixer = new THREE_INSTANCE.AnimationMixer(obj);
        obj.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
        if (!this.data.playing) {
          this.mixer.timeScale = 0;
        }
      },
      update: function() {
        if (this.data.playing) {
          this.playAnimation();
        } else {
          this.pauseAnimation();
        }
      },
      tick: function (time, timeDelta) {
        if (this.mixer) this.mixer.update(timeDelta / 1000);
      },
      pauseAnimation: function() {
        if (this.mixer) this.mixer.timeScale = 0;
      },
      playAnimation: function() {
        if (this.mixer) this.mixer.timeScale = 1;
      }
    });
  }
}
