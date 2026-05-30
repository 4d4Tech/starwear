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
        opacity: { type: 'number', default: 1.0 }
      },
      init: function () {
        console.log("dynamic-materials shared init: registering model-loaded listener");
        this.applyMaterials = this.applyMaterials.bind(this);
        this.el.addEventListener('model-loaded', this.applyMaterials);
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
        console.log("dynamic-materials shared applyMaterials: obj =", obj);
        if (!obj) return;

        obj.traverse((node) => {
          // Disable embedded GLTF lights to allow AR configuration to control lighting
          if (node.isLight) {
            node.visible = false;
            node.intensity = 0;
          }

          if (node.isMesh) {
            // Fix missing normals which cause completely dark lighting
            if (node.geometry && !node.geometry.attributes.normal) {
              node.geometry.computeVertexNormals();
            }

            if (node.material) {
              const THREE_INSTANCE = AFRAME.THREE;
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((mat, index) => {
                // Upgrade basic/unlit materials to Standard to ensure they react to scene lights
                if (mat.type === 'MeshBasicMaterial' || mat.type === 'MeshPhongMaterial' || mat.type === 'MeshLambertMaterial') {
                  const newMat = new THREE_INSTANCE.MeshStandardMaterial({
                    color: mat.color || new THREE_INSTANCE.Color('#ffffff'),
                    map: mat.map || null,
                    transparent: mat.transparent || false,
                    opacity: mat.opacity || 1.0,
                    wireframe: mat.wireframe || false,
                    side: mat.side !== undefined ? mat.side : 2,
                    name: mat.name || ''
                  });
                  if (mat.alphaMap) newMat.alphaMap = mat.alphaMap;
                  if (mat.emissiveMap) newMat.emissiveMap = mat.emissiveMap;
                  
                  materials[index] = newMat;
                  mat = newMat;
                  
                  if (Array.isArray(node.material)) {
                    node.material = materials;
                  } else {
                    node.material = newMat;
                  }
                }

                mat.metalness = this.data.metalness;
                mat.roughness = this.data.roughness;
                if (mat.emissive) mat.emissive.set(this.data.emissive);
                mat.emissiveIntensity = this.data.emissiveIntensity;
                mat.wireframe = this.data.wireframe;
                if (this.data.opacity < 1.0) {
                  mat.transparent = true;
                  mat.opacity = this.data.opacity;
                } else {
                  mat.opacity = this.data.opacity;
                }
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
