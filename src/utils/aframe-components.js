import 'aframe';

if (typeof AFRAME !== 'undefined') {
  // ==========================================
  // 1. DYNAMIC-MATERIALS COMPONENT
  // ==========================================
  if (!AFRAME.components['dynamic-materials']) {
    AFRAME.registerComponent('dynamic-materials', {
      schema: {
        metalness: { type: 'number', default: 0.0 },
        roughness: { type: 'number', default: 1.0 },
        emissive: { type: 'color', default: '#000000' },
        emissiveIntensity: { type: 'number', default: 0 },
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
          textureLoader.load(this.data.envMapUrl, (texture) => {
            texture.mapping = AFRAME.THREE.EquirectangularReflectionMapping;
            if (AFRAME.THREE.sRGBEncoding !== undefined) {
              texture.encoding = AFRAME.THREE.sRGBEncoding;
            } else if (AFRAME.THREE.SRGBColorSpace !== undefined) {
              texture.colorSpace = AFRAME.THREE.SRGBColorSpace;
            }
            this.envMapTexture = texture;
            // Force an update once the texture is downloaded
            this.applyMaterials();
          });
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
          if (node.isLight) {
            node.visible = false;
            node.intensity = 0;
          }

          if (node.isMesh) {
            if (node.geometry && !node.geometry.attributes.normal) {
              node.geometry.computeVertexNormals();
            }

            if (node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((mat) => {
                
                // Inject the downloaded environment map
                if (this.envMapTexture) {
                  mat.envMap = this.envMapTexture;
                  mat.envMapIntensity = 1.0; 
                }

                if (mat.metalness !== undefined) mat.metalness = this.data.metalness;
                if (mat.roughness !== undefined) mat.roughness = this.data.roughness;
                if (mat.emissive && typeof mat.emissive.set === 'function') {
                  mat.emissive.set(this.data.emissive);
                }
                if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = this.data.emissiveIntensity;
                mat.wireframe = this.data.wireframe;
                mat.opacity = this.data.opacity;
                mat.transparent = this.data.opacity < 1.0;
                
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
        this.applyVideo = this.applyVideo.bind(this);
        this.el.addEventListener('model-loaded', this.applyVideo);
        if (this.el.getObject3D('mesh')) {
          this.applyVideo();
        }
      },
      applyVideo: function () {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;
        
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
                    if (this.data.playing) {
                      video.play().catch(e => console.error("Video play failed:", e));
                    }
                    this.videos.push(video);
                  }
                }
              });
            });
          }
        });
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
