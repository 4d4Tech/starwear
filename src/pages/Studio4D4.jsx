import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

class FabricMaterialManager {
    constructor() {
        this.profiles = {
            cotton: {
                roughness: 0.85,
                metalness: 0.05,
                sheen: 0.4,
                sheenRoughness: 0.8,
                sheenColor: new THREE.Color(0xffffff),
                clearcoat: 0.0,
                useRim: 0.0,
                transparent: false,
                opacity: 1.0,
                alphaMap: null
            },
            satin: {
                roughness: 0.25,
                metalness: 0.1,
                sheen: 1.0,
                sheenRoughness: 0.2,
                sheenColor: new THREE.Color(0xffffff),
                clearcoat: 0.1,
                useRim: 0.0,
                transparent: false,
                opacity: 1.0,
                alphaMap: null
            },
            velvet: {
                roughness: 0.7,
                metalness: 0.0,
                sheen: 1.0,
                sheenRoughness: 0.5,
                sheenColor: new THREE.Color(0xffffff),
                clearcoat: 0.0,
                useRim: 1.0,
                rimColor: new THREE.Color(0xffffff),
                rimPower: 4.0,
                rimIntensity: 1.5,
                transparent: false,
                opacity: 1.0,
                alphaMap: null
            },
            mesh: {
                roughness: 0.5,
                metalness: 0.1,
                sheen: 0.0,
                sheenRoughness: 0.0,
                clearcoat: 0.0,
                useRim: 0.0,
                transparent: true,
                opacity: 0.7,
                alphaMap: this.createMeshAlphaMap()
            }
        };
    }

    createMeshAlphaMap() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 64, 64);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillRect(0, 0, 16, 64);
        ctx.fillRect(0, 48, 64, 16);
        ctx.fillRect(48, 0, 16, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 16);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    createFabricMaterial(parameters) {
        const mat = new THREE.MeshPhysicalMaterial(parameters);
        
        mat.userData = {
            useRim: 0.0,
            rimColor: new THREE.Color(0xffffff),
            rimPower: 4.0,
            rimIntensity: 1.5,
            originalSide: parameters.side !== undefined ? parameters.side : THREE.FrontSide
        };

        mat.onBeforeCompile = (shader) => {
            mat.userData.shader = shader;
            
            shader.uniforms.useRim = { get value() { return mat.userData.useRim; } };
            shader.uniforms.rimColor = { get value() { return mat.userData.rimColor; } };
            shader.uniforms.rimPower = { get value() { return mat.userData.rimPower; } };
            shader.uniforms.rimIntensity = { get value() { return mat.userData.rimIntensity; } };

            shader.fragmentShader = `
                uniform float useRim;
                uniform vec3 rimColor;
                uniform float rimPower;
                uniform float rimIntensity;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                if (useRim > 0.5) {
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);
                    float NdotV = dot(normal, viewDir);
                    float fresnel = pow(1.0 - max(abs(NdotV), 0.0), rimPower);
                    gl_FragColor.rgb += rimColor * fresnel * rimIntensity;
                }
                `
            );
        };
        
        return mat;
    }

    applyProfile(material, profileName) {
        const profile = this.profiles[profileName] || this.profiles.cotton;
        
        material.roughness = profile.roughness;
        material.metalness = profile.metalness;
        material.sheen = profile.sheen;
        material.sheenRoughness = profile.sheenRoughness;
        if (material.sheenColor) {
            material.sheenColor.copy(profile.sheenColor || new THREE.Color(0xffffff));
        }
        material.clearcoat = profile.clearcoat || 0.0;
        material.transparent = profile.transparent;
        material.opacity = profile.opacity ?? 1.0;
        material.alphaMap = profile.alphaMap || null;

        if (profileName === 'mesh') {
            material.side = THREE.DoubleSide;
        } else {
            if (material.userData && material.userData.originalSide !== undefined) {
                material.side = material.userData.originalSide;
            }
        }

        material.userData.useRim = profile.useRim || 0.0;
        if (profile.rimColor && material.userData.rimColor) material.userData.rimColor.copy(profile.rimColor);
        if (profile.rimPower !== undefined) material.userData.rimPower = profile.rimPower;
        if (profile.rimIntensity !== undefined) material.userData.rimIntensity = profile.rimIntensity;

        material.needsUpdate = true;
    }
}

export default function Studio4D4() {
    const [pendingFile, setPendingFile] = useState(null);
    const appRef = useRef(null);

    useEffect(() => {
        class StudioApp {
            constructor() {
                this.container = document.getElementById('canvas-container');
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

                this.objects = [];
                this.helpers = [];
                this.selectedObject = null;
                this.fabricMaterialManager = new FabricMaterialManager();

                this.init();
            }

            init() {
                this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFShadowMap;

                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.0;
                this.container.appendChild(this.renderer.domElement);

                this.camera.position.set(0, 5, 10);

                this.setupControls();
                this.setupEnvironment();

                // Initialize ResizeObserver to handle dynamic container resizing robustly
                this.resizeObserver = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (width > 0 && height > 0) {
                            this.camera.aspect = width / height;
                            this.camera.updateProjectionMatrix();
                            this.renderer.setSize(width, height);
                        }
                    }
                });
                this.resizeObserver.observe(this.container);

                this.setupEventListeners();
                this.updateOutliner();

                this.animate();
            }

            setupControls() {
                this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
                this.orbit.enableDamping = true;
                this.orbit.dampingFactor = 0.05;

                this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
                this.transformControl.addEventListener('dragging-changed', (event) => {
                    this.orbit.enabled = !event.value;
                });
                this.transformControl.addEventListener('change', () => {
                    this.syncPropertiesPanel();
                });

                this.scene.add(this.transformControl.getHelper());
                this.helpers.push(this.transformControl.getHelper());
            }

            setupEnvironment() {
                const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
                pmremGenerator.compileEquirectangularShader();
                this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

                const gridHelper = new THREE.GridHelper(20, 20, 0x475569, 0x334155);
                this.scene.add(gridHelper);
                this.helpers.push(gridHelper);

                const dirLight = new THREE.DirectionalLight(0xffffff, 2);
                dirLight.position.set(5, 10, 7);
                dirLight.castShadow = true;
                dirLight.shadow.mapSize.width = 2048;
                dirLight.shadow.mapSize.height = 2048;
                dirLight.name = "Main Studio Light";

                const helper = new THREE.DirectionalLightHelper(dirLight, 1);
                this.scene.add(helper);
                this.helpers.push(helper);
                dirLight.userData.helper = helper;

                this.addSceneObject(dirLight);

                const ambient = new THREE.AmbientLight(0xffffff, 0.5);
                ambient.name = "Ambient Fill";
                this.addSceneObject(ambient);
            }

            onLightsChanged() {
                this.scene.traverse(node => {
                    if (node.isMesh && node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(mat => {
                                mat.needsUpdate = true;
                            });
                        } else {
                            node.material.needsUpdate = true;
                        }
                    }
                });
            }

            addSceneObject(obj) {
                this.scene.add(obj);
                this.objects.push(obj);
                this.updateOutliner();
                if (obj.isLight) {
                    this.onLightsChanged();
                }
            }

            async processImageFile(file) {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }

            setLoadingState(text, visible = true) {
                const overlay = document.getElementById('loading-overlay');
                const textEl = document.getElementById('loading-text');

                if (visible) {
                    overlay.classList.remove('hidden');
                    textEl.textContent = text;
                } else {
                    overlay.classList.add('hidden');
                }
            }

            disposeHierarchy(node) {
                if (node === this.selectedObject) {
                    this.selectObject(null);
                }
                if (node.userData && node.userData.helper) {
                    const helper = node.userData.helper;
                    this.scene.remove(helper);
                    if (helper.dispose) helper.dispose();
                    if (helper.geometry) helper.geometry.dispose();
                    if (helper.material) {
                        if (Array.isArray(helper.material)) helper.material.forEach(m => m.dispose());
                        else helper.material.dispose();
                    }
                    this.helpers = this.helpers.filter(h => h !== helper);
                }

                if (node.geometry) {
                    node.geometry.dispose();
                }
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => this.disposeMaterial(mat));
                    } else {
                        this.disposeMaterial(node.material);
                    }
                }

                if (node.userData && node.userData.materials) {
                    ['lit', 'unlit', 'wireframe'].forEach(mode => {
                        const mats = node.userData.materials[mode];
                        if (Array.isArray(mats)) mats.forEach(m => this.disposeMaterial(m));
                        else this.disposeMaterial(mats);
                    });
                }
            }

            disposeMaterial(mat) {
                if (!mat) return;
                mat.dispose();
                if (mat.map) mat.map.dispose();
                if (mat.lightMap) mat.lightMap.dispose();
                if (mat.bumpMap) mat.bumpMap.dispose();
                if (mat.normalMap) mat.normalMap.dispose();
                if (mat.specularMap) mat.specularMap.dispose();
                if (mat.envMap) mat.envMap.dispose();
            }

            clearGeneratedMeshes() {
                const toRemove = this.objects.filter(obj => obj.userData && obj.userData.isGenerated);
                toRemove.forEach(obj => {
                    this.scene.remove(obj);
                    this.disposeHierarchy(obj);
                    this.objects = this.objects.filter(o => o !== obj);
                });
                this.selectObject(null);

                const diagPanel = document.getElementById('diagnostics-panel');
                if (diagPanel) diagPanel.classList.add('hidden');
            }

            updateDiagnostics(text, isError = false) {
                const el = document.getElementById('diagnostics-panel');
                if (!el) return;
                el.classList.remove('hidden');
                if (isError) {
                    el.classList.remove('text-indigo-300', 'border-indigo-500/30');
                    el.classList.add('text-red-400', 'border-red-500/30');
                    el.innerHTML = `<strong>ERROR:</strong><br/>${text.replace(/\n/g, '<br/>')}`;
                } else {
                    el.classList.remove('text-red-400', 'border-red-500/30');
                    el.classList.add('text-indigo-300', 'border-indigo-500/30');
                    el.innerHTML = `<strong>Diagnostics:</strong><br/>${text.replace(/\n/g, '<br/>')}`;
                }
            }

            // 2D to 3D Cognitive Generation Pipeline
            async createReimaginedGeometry(imageUrl, filename) {
                this.setLoadingState("Phase 1: Semantic Boundary Analysis...", true);
                this.updateDiagnostics("Starting Phase 1...\nLoading image source...");
                await new Promise(r => setTimeout(r, 400));

                return new Promise((resolve, reject) => {
                    const img = new Image();
                    // Do not set crossOrigin for data URIs, it can cause failures in some browsers
                    if (!imageUrl.startsWith('data:')) {
                        img.crossOrigin = "Anonymous";
                    }

                    img.onerror = (err) => {
                        console.error("Failed to load image:", err);
                        this.setLoadingState("Failed to load image", true);
                        this.updateDiagnostics(`Failed to load image: ${err.message || 'Unknown image error'}`, true);
                        reject(err);
                    };

                    img.onload = async () => {
                        try {
                            this.updateDiagnostics(`Image loaded successfully: ${img.width}x${img.height}\nRunning Pass 1 (Extract pixels)...`);
                            // Pass 1: Extract exact pixels
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                            this.setLoadingState("Phase 2: Global Mass & Curvature Inference...");
                            this.updateDiagnostics(`Image loaded: ${img.width}x${img.height}\nRunning Pass 2 (Blur)...`);
                            await new Promise(r => setTimeout(r, 400));

                            // Pass 2: Create a "cognitive blur" to calculate center of mass and edge distance.
                            const blurCanvas = document.createElement('canvas');
                            const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
                            blurCanvas.width = img.width;
                            blurCanvas.height = img.height;

                            const blurRadius = Math.max(4, Math.floor(img.width * 0.08));
                            blurCtx.filter = `blur(${blurRadius}px)`;
                            blurCtx.drawImage(img, 0, 0);
                            const blurredData = blurCtx.getImageData(0, 0, canvas.width, canvas.height);

                            this.setLoadingState("Phase 2.5: Planarity Analysis & Edge Detection...");
                            this.updateDiagnostics(`Image loaded: ${img.width}x${img.height}\nRunning Pass 2.5 (Planarity detection)...`);
                            await new Promise(r => setTimeout(r, 400));

                            // Pass 2.5: Planarity Detection
                            let sumLum = 0, sumLumSq = 0, solidCount = 0;
                            for (let i = 0; i < blurredData.data.length; i += 4) {
                                if (imgData.data[i + 3] > 128) {
                                    const lum = (blurredData.data[i] * 0.299 + blurredData.data[i + 1] * 0.587 + blurredData.data[i + 2] * 0.114) / 255.0;
                                    sumLum += lum;
                                    sumLumSq += lum * lum;
                                    solidCount++;
                                }
                            }

                            let planarity = 0.5;
                            if (solidCount > 0) {
                                const mean = sumLum / solidCount;
                                const variance = Math.max(0, (sumLumSq / solidCount) - (mean * mean));
                                const stdDev = Math.sqrt(variance);
                                planarity = 1.0 - Math.min(Math.max((stdDev - 0.03) / 0.09, 0), 1.0);
                                planarity = planarity * planarity * (3 - 2 * planarity);
                            }

                            this.setLoadingState("Phase 3: Boundary Contour Tracing...", true);
                            this.updateDiagnostics("Starting Pass 3...\nCalculating topology resolution...");
                            await new Promise(r => setTimeout(r, 400));

                            // Determine topology resolution for contour tracing
                            const maxRes = 150;
                            let w = Math.max(2, img.width), h = Math.max(2, img.height);
                            if (w > maxRes || h > maxRes) {
                                const ratio = Math.min(maxRes / w, maxRes / h);
                                w = Math.floor(w * ratio);
                                h = Math.floor(h * ratio);
                            }

                            const scale = 5 / Math.max(img.width, img.height);
                            const planeW = img.width * scale;
                            const planeH = img.height * scale;
                            const baseThickness = planeW * 0.12;

                            // Trace outline on a low-res alpha map for performance and anti-aliasing
                            const traceCanvas = document.createElement('canvas');
                            const traceCtx = traceCanvas.getContext('2d', { willReadFrequently: true });
                            traceCanvas.width = w;
                            traceCanvas.height = h;
                            traceCtx.drawImage(img, 0, 0, w, h);
                            const traceData = traceCtx.getImageData(0, 0, w, h);

                            const grid = new Uint8Array(w * h);
                            for (let i = 0; i < w * h; i++) {
                                grid[i] = traceData.data[i * 4 + 3] > 80 ? 1 : 0;
                            }

                            // Find starting boundary pixel
                            let startX = -1, startY = -1;
                            for (let y = 0; y < h; y++) {
                                for (let x = 0; x < w; x++) {
                                    if (grid[y * w + x] === 1) {
                                        startX = x;
                                        startY = y;
                                        break;
                                    }
                                }
                                if (startX !== -1) break;
                            }

                            if (startX === -1) {
                                throw new Error("No solid pixels found in image alpha channel.");
                            }

                            // Moore-Neighbor tracing
                            const path = [];
                            let cx = startX, cy = startY;
                            const dx = [-1,  0,  1, 1, 1, 0, -1, -1];
                            const dy = [-1, -1, -1, 0, 1, 1,  1,  0];
                            let backtrackDir = 7;
                            let iterations = 0;
                            const maxIterations = w * h * 2;

                            do {
                                path.push({ x: cx, y: cy });
                                let found = false;
                                let searchDir = (backtrackDir + 1) % 8;

                                for (let i = 0; i < 8; i++) {
                                    const dir = (searchDir + i) % 8;
                                    const nx = cx + dx[dir];
                                    const ny = cy + dy[dir];

                                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                        if (grid[ny * w + nx] === 1) {
                                            cx = nx;
                                            cy = ny;
                                            backtrackDir = (dir + 4) % 8;
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (!found) break;
                                iterations++;
                            } while ((cx !== startX || cy !== startY) && iterations < maxIterations);

                            // Smooth contour path (moving average)
                            const smoothPath = [];
                            const windowSize = 5;
                            const halfWindow = Math.floor(windowSize / 2);
                            const pathLen = path.length;

                            for (let i = 0; i < pathLen; i++) {
                                let sumX = 0, sumY = 0;
                                for (let j = -halfWindow; j <= halfWindow; j++) {
                                    const idx = (i + j + pathLen) % pathLen;
                                    sumX += path[idx].x;
                                    sumY += path[idx].y;
                                }
                                smoothPath.push({
                                    x: sumX / windowSize,
                                    y: sumY / windowSize
                                });
                            }

                            // Sample average edge color from original high-res canvas
                            let sumR = 0, sumG = 0, sumB = 0, edgeColorCount = 0;
                            const sampleStep = Math.max(1, Math.floor(smoothPath.length / 50));
                            for (let i = 0; i < smoothPath.length; i += sampleStep) {
                                const pt = smoothPath[i];
                                const px = Math.floor((pt.x / (w - 1)) * (img.width - 1));
                                const py = Math.floor((pt.y / (h - 1)) * (img.height - 1));
                                if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
                                    const pixelIdx = (py * img.width + px) * 4;
                                    const r = imgData.data[pixelIdx];
                                    const g = imgData.data[pixelIdx + 1];
                                    const b = imgData.data[pixelIdx + 2];
                                    const a = imgData.data[pixelIdx + 3];
                                    if (a > 128) {
                                        sumR += r;
                                        sumG += g;
                                        sumB += b;
                                        edgeColorCount++;
                                    }
                                }
                            }

                            let edgeHexColor = 0x1e293b;
                            if (edgeColorCount > 0) {
                                const avgR = Math.floor(sumR / edgeColorCount);
                                const avgG = Math.floor(sumG / edgeColorCount);
                                const avgB = Math.floor(sumB / edgeColorCount);
                                edgeHexColor = (avgR << 16) | (avgG << 8) | avgB;
                            }

                            // Convert smooth path to THREE.Shape
                            const shape = new THREE.Shape();
                            if (smoothPath.length > 0) {
                                const p0_x = (smoothPath[0].x / (w - 1) - 0.5) * planeW;
                                const p0_y = (0.5 - smoothPath[0].y / (h - 1)) * planeH;
                                shape.moveTo(p0_x, p0_y);

                                for (let i = 1; i < smoothPath.length; i++) {
                                    const px = (smoothPath[i].x / (w - 1) - 0.5) * planeW;
                                    const py = (0.5 - smoothPath[i].y / (h - 1)) * planeH;
                                    shape.lineTo(px, py);
                                }
                                shape.closePath();
                            }

                            // Extrude Geometry with Bevel
                            const extrudeSettings = {
                                depth: baseThickness * 1.5,
                                bevelEnabled: true,
                                bevelThickness: baseThickness * 0.15,
                                bevelSize: baseThickness * 0.15,
                                bevelSegments: 3,
                                steps: 1,
                                curveSegments: 12
                            };

                            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                            geometry.computeVertexNormals();

                            // Center Origin
                            geometry.computeBoundingBox();
                            const centerOffset = -0.5 * (geometry.boundingBox.max.z + geometry.boundingBox.min.z);
                            geometry.translate(0, 0, centerOffset);

                            // Split front and back caps into separate groups
                            this.splitExtrudeGeometryGroups(geometry);

                            // Recalculate UVs for front and back faces (group with materialIndex === 0 or 2)
                            geometry.computeBoundingBox();
                            const bbox = geometry.boundingBox;
                            const width = bbox.max.x - bbox.min.x;
                            const height = bbox.max.y - bbox.min.y;

                            if (width > 0 && height > 0) {
                                const posAttr = geometry.attributes.position;
                                const uvAttr = geometry.attributes.uv;
                                const indexAttr = geometry.index;

                                if (posAttr && uvAttr) {
                                    const capVertexIndices = new Set();
                                    if (geometry.groups && indexAttr) {
                                        for (const group of geometry.groups) {
                                            if (group.materialIndex === 0 || group.materialIndex === 2) {
                                                for (let i = group.start; i < group.start + group.count; i++) {
                                                    capVertexIndices.add(indexAttr.getX(i));
                                                }
                                            }
                                        }
                                    }

                                    if (capVertexIndices.size > 0) {
                                        capVertexIndices.forEach(idx => {
                                            const x = posAttr.getX(idx);
                                            const y = posAttr.getY(idx);
                                            const u = (x - bbox.min.x) / width;
                                            const v = (y - bbox.min.y) / height;
                                            uvAttr.setXY(idx, u, v);
                                        });
                                    } else {
                                        const normalAttr = geometry.attributes.normal;
                                        for (let i = 0; i < posAttr.count; i++) {
                                            let isCap = false;
                                            if (normalAttr) {
                                                if (Math.abs(normalAttr.getZ(i)) > 0.9) {
                                                    isCap = true;
                                                }
                                            } else {
                                                isCap = true;
                                            }
                                            if (isCap) {
                                                const x = posAttr.getX(i);
                                                const y = posAttr.getY(i);
                                                const u = (x - bbox.min.x) / width;
                                                const v = (y - bbox.min.y) / height;
                                                uvAttr.setXY(i, u, v);
                                            }
                                        }
                                    }
                                    uvAttr.needsUpdate = true;
                                }
                            }

                            this.setLoadingState("Phase 4: Multi-Material PBR Baking...");
                            this.updateDiagnostics(`Geometry constructed using ExtrudeGeometry:\nVertices: ${geometry.attributes.position.count}\nMarching nodes: ${smoothPath.length}\nEdge color sampled: #${edgeHexColor.toString(16).padStart(6, '0')}\nBaking textures...`);
                            await new Promise(r => setTimeout(r, 400));

                            // 4. Construct Multi-Material Layers
                            const texture = new THREE.CanvasTexture(canvas);
                            texture.colorSpace = THREE.SRGBColorSpace;
                            texture.needsUpdate = true;

                            // Solid edge color sampled from image boundaries
                            const edgeColor = edgeHexColor;

                            // Lit (PBR Physical)
                            const litMatFront = this.fabricMaterialManager.createFabricMaterial({
                                map: texture, roughness: 0.3, metalness: 0.1, alphaTest: 0.5
                            });
                            litMatFront.userData.originalSide = THREE.FrontSide;

                            const litMatSide = this.fabricMaterialManager.createFabricMaterial({
                                color: edgeColor, roughness: 0.6, metalness: 0.2
                            });
                            litMatSide.userData.originalSide = THREE.FrontSide;

                            const litMatBack = this.fabricMaterialManager.createFabricMaterial({
                                map: texture, roughness: 0.3, metalness: 0.1, alphaTest: 0.5, side: THREE.DoubleSide
                            });
                            litMatBack.userData.originalSide = THREE.DoubleSide;

                            // Apply default profile (cotton) to all lit materials
                            const matsLit = [litMatFront, litMatSide, litMatBack];
                            matsLit.forEach(mat => {
                                this.fabricMaterialManager.applyProfile(mat, 'cotton');
                            });

                            // Unlit (Albedo)
                            const unlitMatFront = new THREE.MeshBasicMaterial({
                                map: texture, alphaTest: 0.5
                            });
                            const unlitMatSide = new THREE.MeshBasicMaterial({
                                color: edgeColor
                            });
                            const unlitMatBack = new THREE.MeshBasicMaterial({
                                map: texture, alphaTest: 0.5, side: THREE.DoubleSide
                            });

                            // Wireframe
                            const wireMat = new THREE.MeshBasicMaterial({
                                color: 0x00ffcc, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5
                            });

                            const matsUnlit = [unlitMatFront, unlitMatSide, unlitMatBack];
                            const matsWire = [wireMat, wireMat, wireMat];

                            const mesh = new THREE.Mesh(geometry, matsLit);
                            mesh.name = filename || "Reimagined_3D_Mesh";
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                            mesh.position.y = planeH / 2;

                            mesh.userData = {
                                isGenerated: true,
                                shape: shape,
                                extrudeSettings: extrudeSettings,
                                materials: { lit: matsLit, unlit: matsUnlit, wireframe: matsWire },
                                animate: false,
                                rotationSpeed: 0.01,
                                currentMode: 'lit',
                                fabricProfile: 'cotton'
                            };

                            this.addSceneObject(mesh);
                            this.selectObject(mesh);

                            this.updateDiagnostics(`Geometry constructed using ExtrudeGeometry:\nVertices: ${geometry.attributes.position.count}\nIndices: ${geometry.index ? geometry.index.count : 0}\nMesh added to scene and selected!`);
                            this.setLoadingState("Done", false);
                            resolve();
                        } catch (err) {
                            console.error("Error generating geometry inside onload:", err);
                            this.updateDiagnostics(`Pipeline Error:\n${err.message}\nStack:\n${err.stack}`, true);
                            this.setLoadingState("Error during generation", true);
                            reject(err);
                        }
                    };
                    img.src = imageUrl;
                });
            }

            splitExtrudeGeometryGroups(geometry) {
                const posAttr = geometry.attributes.position;
                const indexAttr = geometry.index;
                if (!posAttr || !indexAttr) return;

                const indices = indexAttr.array;
                const frontCapIndices = [];
                const backCapIndices = [];
                const sideIndices = [];

                if (!geometry.groups || geometry.groups.length === 0) return;

                // Let's identify the cap vs side triangles using geometry.groups
                const capStart = geometry.groups[0].start;
                const capCount = geometry.groups[0].count;
                const capEnd = capStart + capCount;

                for (let i = 0; i < indices.length; i += 3) {
                    const i0 = indices[i];
                    const i1 = indices[i+1];
                    const i2 = indices[i+2];

                    if (i >= capStart && i < capEnd) {
                        const z0 = posAttr.getZ(i0);
                        const z1 = posAttr.getZ(i1);
                        const z2 = posAttr.getZ(i2);
                        const avgZ = (z0 + z1 + z2) / 3;

                        if (avgZ > 0) {
                            frontCapIndices.push(i0, i1, i2);
                        } else {
                            backCapIndices.push(i0, i1, i2);
                        }
                    } else {
                        sideIndices.push(i0, i1, i2);
                    }
                }

                const newIndices = [];
                newIndices.push(...frontCapIndices);
                newIndices.push(...sideIndices);
                newIndices.push(...backCapIndices);

                geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(newIndices), 1));

                geometry.clearGroups();
                geometry.addGroup(0, frontCapIndices.length, 0); // Front Cap
                geometry.addGroup(frontCapIndices.length, sideIndices.length, 1); // Side
                geometry.addGroup(frontCapIndices.length + sideIndices.length, backCapIndices.length, 2); // Back Cap
            }

            inflateGeometry(geometry, smoothPath, planeW, planeH, w, h, baseThickness, inflationAmount) {
                const posAttr = geometry.attributes.position;
                if (!posAttr) return;
                const count = posAttr.count;

                const boundary3D = smoothPath.map(pt => new THREE.Vector2(
                    (pt.x / (w - 1) - 0.5) * planeW,
                    (0.5 - pt.y / (h - 1)) * planeH
                ));

                const distances = new Float32Array(count);
                let maxDist = 0;

                const n = boundary3D.length;
                for (let i = 0; i < count; i++) {
                    const vx = posAttr.getX(i);
                    const vy = posAttr.getY(i);

                    let minDist = Infinity;
                    for (let j = 0; j < n; j++) {
                        const a = boundary3D[j];
                        const b = boundary3D[(j + 1) % n];

                        // Distance from (vx, vy) to segment ab
                        const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
                        let dist;
                        if (l2 === 0) {
                            dist = Math.sqrt((vx - a.x) ** 2 + (vy - a.y) ** 2);
                        } else {
                            let t = ((vx - a.x) * (b.x - a.x) + (vy - a.y) * (b.y - a.y)) / l2;
                            t = Math.max(0, Math.min(1, t));
                            const projX = a.x + t * (b.x - a.x);
                            const projY = a.y + t * (b.y - a.y);
                            dist = Math.sqrt((vx - projX) ** 2 + (vy - projY) ** 2);
                        }

                        if (dist < minDist) {
                            minDist = dist;
                        }
                    }

                    distances[i] = minDist;
                    if (minDist > maxDist) {
                        maxDist = minDist;
                    }
                }

                geometry.computeBoundingBox();
                const bbox = geometry.boundingBox;
                const maxZ = bbox.max.z;
                const minZ = bbox.min.z;

                for (let i = 0; i < count; i++) {
                    const vz = posAttr.getZ(i);
                    const dist = distances[i];
                    const normDist = maxDist > 0 ? dist / maxDist : 0;

                    // Pillowy shape using a sine curve
                    const displacement = inflationAmount * Math.sin(normDist * Math.PI / 2);

                    let z_new = vz;
                    if (vz > 0.001 && maxZ > 0) {
                        z_new = vz + displacement * (vz / maxZ);
                    } else if (vz < -0.001 && minZ < 0) {
                        z_new = vz - displacement * (vz / minZ);
                    }
                    posAttr.setZ(i, z_new);
                }

                posAttr.needsUpdate = true;
                geometry.computeVertexNormals();
            }

            updateSelectedMeshExtrusion(newDepth) {
                const obj = this.selectedObject;
                if (!obj || !obj.isMesh || !obj.userData.isGenerated || !obj.userData.shape) return;

                const currentSettings = obj.userData.extrudeSettings || {};
                const updatedSettings = {
                    ...currentSettings,
                    depth: newDepth,
                    bevelThickness: newDepth * 0.1,
                    bevelSize: newDepth * 0.1
                };

                const newGeometry = new THREE.ExtrudeGeometry(obj.userData.shape, updatedSettings);
                newGeometry.computeVertexNormals();

                // Center Origin on Z
                newGeometry.computeBoundingBox();
                const centerOffset = -0.5 * (newGeometry.boundingBox.max.z + newGeometry.boundingBox.min.z);
                newGeometry.translate(0, 0, centerOffset);

                // Re-inflate if it is a volumetric mesh
                if (obj.userData.isVolumetric) {
                    const { smoothPath, planeW, planeH, w, h, baseThickness } = obj.userData;
                    const inflationAmount = newDepth * 1.5;
                    this.inflateGeometry(newGeometry, smoothPath, planeW, planeH, w, h, baseThickness, inflationAmount);
                }

                // Split front and back caps
                this.splitExtrudeGeometryGroups(newGeometry);

                // Recalculate UVs for front and back faces (group with materialIndex === 0 or 2)
                newGeometry.computeBoundingBox();
                const bbox = newGeometry.boundingBox;
                const width = bbox.max.x - bbox.min.x;
                const height = bbox.max.y - bbox.min.y;

                if (width > 0 && height > 0) {
                    const posAttr = newGeometry.attributes.position;
                    const uvAttr = newGeometry.attributes.uv;
                    const indexAttr = newGeometry.index;

                    if (posAttr && uvAttr) {
                        const capVertexIndices = new Set();
                        if (newGeometry.groups && indexAttr) {
                            for (const group of newGeometry.groups) {
                                if (group.materialIndex === 0 || group.materialIndex === 2) {
                                    for (let i = group.start; i < group.start + group.count; i++) {
                                        capVertexIndices.add(indexAttr.getX(i));
                                    }
                                }
                            }
                        }

                        if (capVertexIndices.size > 0) {
                            capVertexIndices.forEach(idx => {
                                const x = posAttr.getX(idx);
                                const y = posAttr.getY(idx);
                                const u = (x - bbox.min.x) / width;
                                const v = (y - bbox.min.y) / height;
                                uvAttr.setXY(idx, u, v);
                            });
                        } else {
                            const normalAttr = newGeometry.attributes.normal;
                            for (let i = 0; i < posAttr.count; i++) {
                                let isCap = false;
                                if (normalAttr) {
                                    if (Math.abs(normalAttr.getZ(i)) > 0.9) {
                                        isCap = true;
                                    }
                                } else {
                                    isCap = true;
                                }
                                if (isCap) {
                                    const x = posAttr.getX(i);
                                    const y = posAttr.getY(i);
                                    const u = (x - bbox.min.x) / width;
                                    const v = (y - bbox.min.y) / height;
                                    uvAttr.setXY(i, u, v);
                                }
                            }
                        }
                        uvAttr.needsUpdate = true;
                    }
                }

                // Dispose old geometry
                if (obj.geometry) {
                    obj.geometry.dispose();
                }

                // Assign new geometry
                obj.geometry = newGeometry;
                obj.userData.extrudeSettings = updatedSettings;

                this.updateDiagnostics(`Geometry extruded depth updated to: ${newDepth.toFixed(2)}\nVertices: ${newGeometry.attributes.position.count}`);
            }

            async generateVolumetricMesh(file) {
                this.setLoadingState("Phase 1: Analyzing Garment Silhouettes...", true);
                this.updateDiagnostics("Starting Volumetric Pipeline...\nLoading image source...");

                // Background upload to keep Firebase storage updated without blocking the UI
                try {
                    const storage = getStorage();
                    const storageRef = ref(storage, `ai-uploads/${Date.now()}_${file.name}`);
                    uploadBytes(storageRef, file).then(() => {
                        console.log("Original image successfully saved to Firebase Storage.");
                    }).catch(err => {
                        console.warn("Background Firebase Storage upload failed:", err);
                    });
                } catch (e) {
                    console.warn("Firebase Storage is not initialized or failed:", e);
                }

                // Process image file locally to a data URL
                const imageUrl = await this.processImageFile(file);

                return new Promise((resolve, reject) => {
                    const img = new Image();
                    if (!imageUrl.startsWith('data:')) {
                        img.crossOrigin = "Anonymous";
                    }

                    img.onerror = (err) => {
                        console.error("Failed to load image:", err);
                        this.setLoadingState("Failed to load image", true);
                        this.updateDiagnostics(`Failed to load image: ${err.message || 'Unknown image error'}`, true);
                        reject(err);
                    };

                    img.onload = async () => {
                        try {
                            this.updateDiagnostics(`Image loaded successfully: ${img.width}x${img.height}\nRunning Pass 1 (Extract pixels)...`);
                            // Pass 1: Extract exact pixels
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                            this.setLoadingState("Phase 2: Projecting Volumetric Fields...");
                            this.updateDiagnostics(`Image loaded: ${img.width}x${img.height}\nCalculating depth contours...`);
                            await new Promise(r => setTimeout(r, 400));

                            // Pass 2: Create a "cognitive blur" to calculate center of mass and edge distance.
                            const blurCanvas = document.createElement('canvas');
                            const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
                            blurCanvas.width = img.width;
                            blurCanvas.height = img.height;

                            const blurRadius = Math.max(4, Math.floor(img.width * 0.08));
                            blurCtx.filter = `blur(${blurRadius}px)`;
                            blurCtx.drawImage(img, 0, 0);
                            const blurredData = blurCtx.getImageData(0, 0, canvas.width, canvas.height);

                            this.setLoadingState("Phase 2.5: Planarity Analysis & Edge Detection...");
                            await new Promise(r => setTimeout(r, 300));

                            // Pass 2.5: Planarity Detection
                            let sumLum = 0, sumLumSq = 0, solidCount = 0;
                            for (let i = 0; i < blurredData.data.length; i += 4) {
                                if (imgData.data[i + 3] > 128) {
                                    const lum = (blurredData.data[i] * 0.299 + blurredData.data[i + 1] * 0.587 + blurredData.data[i + 2] * 0.114) / 255.0;
                                    sumLum += lum;
                                    sumLumSq += lum * lum;
                                    solidCount++;
                                }
                            }

                            let planarity = 0.5;
                            if (solidCount > 0) {
                                const mean = sumLum / solidCount;
                                const variance = Math.max(0, (sumLumSq / solidCount) - (mean * mean));
                                const stdDev = Math.sqrt(variance);
                                planarity = 1.0 - Math.min(Math.max((stdDev - 0.03) / 0.09, 0), 1.0);
                                planarity = planarity * planarity * (3 - 2 * planarity);
                            }

                            this.setLoadingState("Phase 3: Synthesizing Mesh Vertices...", true);
                            this.updateDiagnostics("Starting Pass 3...\nCalculating topology resolution...");
                            await new Promise(r => setTimeout(r, 400));

                            // Determine topology resolution for contour tracing
                            const maxRes = 150;
                            let w = Math.max(2, img.width), h = Math.max(2, img.height);
                            if (w > maxRes || h > maxRes) {
                                const ratio = Math.min(maxRes / w, maxRes / h);
                                w = Math.floor(w * ratio);
                                h = Math.floor(h * ratio);
                            }

                            const scale = 5 / Math.max(img.width, img.height);
                            const planeW = img.width * scale;
                            const planeH = img.height * scale;
                            const baseThickness = planeW * 0.12;

                            // Trace outline on a low-res alpha map for performance and anti-aliasing
                            const traceCanvas = document.createElement('canvas');
                            const traceCtx = traceCanvas.getContext('2d', { willReadFrequently: true });
                            traceCanvas.width = w;
                            traceCanvas.height = h;
                            traceCtx.drawImage(img, 0, 0, w, h);
                            const traceData = traceCtx.getImageData(0, 0, w, h);

                            const grid = new Uint8Array(w * h);
                            for (let i = 0; i < w * h; i++) {
                                grid[i] = traceData.data[i * 4 + 3] > 80 ? 1 : 0;
                            }

                            // Find starting boundary pixel
                            let startX = -1, startY = -1;
                            for (let y = 0; y < h; y++) {
                                for (let x = 0; x < w; x++) {
                                    if (grid[y * w + x] === 1) {
                                        startX = x;
                                        startY = y;
                                        break;
                                    }
                                }
                                if (startX !== -1) break;
                            }

                            if (startX === -1) {
                                throw new Error("No solid pixels found in image alpha channel.");
                            }

                            // Moore-Neighbor tracing
                            const path = [];
                            let cx = startX, cy = startY;
                            const dx = [-1,  0,  1, 1, 1, 0, -1, -1];
                            const dy = [-1, -1, -1, 0, 1, 1,  1,  0];
                            let backtrackDir = 7;
                            let iterations = 0;
                            const maxIterations = w * h * 2;

                            do {
                                path.push({ x: cx, y: cy });
                                let found = false;
                                let searchDir = (backtrackDir + 1) % 8;

                                for (let i = 0; i < 8; i++) {
                                    const dir = (searchDir + i) % 8;
                                    const nx = cx + dx[dir];
                                    const ny = cy + dy[dir];

                                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                        if (grid[ny * w + nx] === 1) {
                                            cx = nx;
                                            cy = ny;
                                            backtrackDir = (dir + 4) % 8;
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (!found) break;
                                iterations++;
                            } while ((cx !== startX || cy !== startY) && iterations < maxIterations);

                            // Smooth contour path (moving average)
                            const smoothPath = [];
                            const windowSize = 5;
                            const halfWindow = Math.floor(windowSize / 2);
                            const pathLen = path.length;

                            for (let i = 0; i < pathLen; i++) {
                                let sumX = 0, sumY = 0;
                                for (let j = -halfWindow; j <= halfWindow; j++) {
                                    const idx = (i + j + pathLen) % pathLen;
                                    sumX += path[idx].x;
                                    sumY += path[idx].y;
                                }
                                smoothPath.push({
                                    x: sumX / windowSize,
                                    y: sumY / windowSize
                                });
                            }

                            // Sample average edge color from original high-res canvas
                            let sumR = 0, sumG = 0, sumB = 0, edgeColorCount = 0;
                            const sampleStep = Math.max(1, Math.floor(smoothPath.length / 50));
                            for (let i = 0; i < smoothPath.length; i += sampleStep) {
                                const pt = smoothPath[i];
                                const px = Math.floor((pt.x / (w - 1)) * (img.width - 1));
                                const py = Math.floor((pt.y / (h - 1)) * (img.height - 1));
                                if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
                                    const pixelIdx = (py * img.width + px) * 4;
                                    const r = imgData.data[pixelIdx];
                                    const g = imgData.data[pixelIdx + 1];
                                    const b = imgData.data[pixelIdx + 2];
                                    const a = imgData.data[pixelIdx + 3];
                                    if (a > 128) {
                                        sumR += r;
                                        sumG += g;
                                        sumB += b;
                                        edgeColorCount++;
                                    }
                                }
                            }

                            let edgeHexColor = 0x1e293b;
                            if (edgeColorCount > 0) {
                                const avgR = Math.floor(sumR / edgeColorCount);
                                const avgG = Math.floor(sumG / edgeColorCount);
                                const avgB = Math.floor(sumB / edgeColorCount);
                                edgeHexColor = (avgR << 16) | (avgG << 8) | avgB;
                            }

                            // Convert smooth path to THREE.Shape
                            const shape = new THREE.Shape();
                            if (smoothPath.length > 0) {
                                const p0_x = (smoothPath[0].x / (w - 1) - 0.5) * planeW;
                                const p0_y = (0.5 - smoothPath[0].y / (h - 1)) * planeH;
                                shape.moveTo(p0_x, p0_y);

                                for (let i = 1; i < smoothPath.length; i++) {
                                    const px = (smoothPath[i].x / (w - 1) - 0.5) * planeW;
                                    const py = (0.5 - smoothPath[i].y / (h - 1)) * planeH;
                                    shape.lineTo(px, py);
                                }
                                shape.closePath();
                            }

                            // Extrude Geometry with Bevel
                            const extrudeSettings = {
                                depth: baseThickness * 1.5,
                                bevelEnabled: true,
                                bevelThickness: baseThickness * 0.15,
                                bevelSize: baseThickness * 0.15,
                                bevelSegments: 3,
                                steps: 1,
                                curveSegments: 12
                            };

                            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                            geometry.computeVertexNormals();

                            // Center Origin
                            geometry.computeBoundingBox();
                            const centerOffset = -0.5 * (geometry.boundingBox.max.z + geometry.boundingBox.min.z);
                            geometry.translate(0, 0, centerOffset);

                            this.setLoadingState("Phase 4: Volumetric Inflation...");
                            this.updateDiagnostics("Applying mathematical distance transform and Z-axis vertex displacement...");
                            await new Promise(r => setTimeout(r, 450));

                            // Run our mathematical inflation algorithm
                            const inflationAmount = baseThickness * 1.5;
                            this.inflateGeometry(geometry, smoothPath, planeW, planeH, w, h, baseThickness, inflationAmount);

                            // Split front and back caps into separate groups
                            this.splitExtrudeGeometryGroups(geometry);

                            // Recalculate UVs for front and back faces (group with materialIndex === 0 or 2)
                            geometry.computeBoundingBox();
                            const bbox = geometry.boundingBox;
                            const width = bbox.max.x - bbox.min.x;
                            const height = bbox.max.y - bbox.min.y;

                            if (width > 0 && height > 0) {
                                const posAttr = geometry.attributes.position;
                                const uvAttr = geometry.attributes.uv;
                                const indexAttr = geometry.index;

                                if (posAttr && uvAttr) {
                                    const capVertexIndices = new Set();
                                    if (geometry.groups && indexAttr) {
                                        for (const group of geometry.groups) {
                                            if (group.materialIndex === 0 || group.materialIndex === 2) {
                                                for (let i = group.start; i < group.start + group.count; i++) {
                                                    capVertexIndices.add(indexAttr.getX(i));
                                                }
                                            }
                                        }
                                    }

                                    if (capVertexIndices.size > 0) {
                                        capVertexIndices.forEach(idx => {
                                            const x = posAttr.getX(idx);
                                            const y = posAttr.getY(idx);
                                            const u = (x - bbox.min.x) / width;
                                            const v = (y - bbox.min.y) / height;
                                            uvAttr.setXY(idx, u, v);
                                        });
                                    } else {
                                        const normalAttr = geometry.attributes.normal;
                                        for (let i = 0; i < posAttr.count; i++) {
                                            let isCap = false;
                                            if (normalAttr) {
                                                if (Math.abs(normalAttr.getZ(i)) > 0.9) {
                                                    isCap = true;
                                                }
                                            } else {
                                                isCap = true;
                                            }
                                            if (isCap) {
                                                const x = posAttr.getX(i);
                                                const y = posAttr.getY(i);
                                                const u = (x - bbox.min.x) / width;
                                                const v = (y - bbox.min.y) / height;
                                                uvAttr.setXY(i, u, v);
                                            }
                                        }
                                    }
                                    uvAttr.needsUpdate = true;
                                }
                            }

                            this.setLoadingState("Phase 5: Multi-Material PBR Baking...");
                            this.updateDiagnostics(`Geometry constructed and inflated:\nVertices: ${geometry.attributes.position.count}\nBaking textures...`);
                            await new Promise(r => setTimeout(r, 400));

                            // Construct Multi-Material Layers
                            const texture = new THREE.CanvasTexture(canvas);
                            texture.colorSpace = THREE.SRGBColorSpace;
                            texture.needsUpdate = true;

                            const edgeColor = edgeHexColor;

                            // Lit (PBR Physical)
                            const litMatFront = this.fabricMaterialManager.createFabricMaterial({
                                map: texture, roughness: 0.3, metalness: 0.1, alphaTest: 0.5
                            });
                            litMatFront.userData.originalSide = THREE.FrontSide;

                            const litMatSide = this.fabricMaterialManager.createFabricMaterial({
                                color: edgeColor, roughness: 0.6, metalness: 0.2
                            });
                            litMatSide.userData.originalSide = THREE.FrontSide;

                            const litMatBack = this.fabricMaterialManager.createFabricMaterial({
                                map: texture, roughness: 0.3, metalness: 0.1, alphaTest: 0.5, side: THREE.DoubleSide
                            });
                            litMatBack.userData.originalSide = THREE.DoubleSide;

                            // Apply default profile (cotton) to all lit materials
                            const matsLit = [litMatFront, litMatSide, litMatBack];
                            matsLit.forEach(mat => {
                                this.fabricMaterialManager.applyProfile(mat, 'cotton');
                            });

                            // Unlit (Albedo)
                            const unlitMatFront = new THREE.MeshBasicMaterial({
                                map: texture, alphaTest: 0.5
                            });
                            const unlitMatSide = new THREE.MeshBasicMaterial({
                                color: edgeColor
                            });
                            const unlitMatBack = new THREE.MeshBasicMaterial({
                                map: texture, alphaTest: 0.5, side: THREE.DoubleSide
                            });

                            // Wireframe
                            const wireMat = new THREE.MeshBasicMaterial({
                                color: 0x00ffcc, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5
                            });

                            const matsUnlit = [unlitMatFront, unlitMatSide, unlitMatBack];
                            const matsWire = [wireMat, wireMat, wireMat];

                            const mesh = new THREE.Mesh(geometry, matsLit);
                            mesh.name = `Volumetric_${file.name}`;
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                            mesh.position.y = planeH / 2;

                            mesh.userData = {
                                isGenerated: true,
                                isVolumetric: true, // Flag to identify volumetric meshes
                                smoothPath: smoothPath,
                                planeW: planeW,
                                planeH: planeH,
                                w: w,
                                h: h,
                                baseThickness: baseThickness,
                                shape: shape,
                                extrudeSettings: extrudeSettings,
                                materials: { lit: matsLit, unlit: matsUnlit, wireframe: matsWire },
                                animate: false,
                                rotationSpeed: 0.01,
                                currentMode: 'lit',
                                fabricProfile: 'cotton'
                            };

                            this.addSceneObject(mesh);
                            this.selectObject(mesh);

                            this.updateDiagnostics(`Geometry constructed using ExtrudeGeometry and Volumetric Inflation:\nVertices: ${geometry.attributes.position.count}\nMesh added to scene and selected!`);
                            this.setLoadingState("Done", false);
                            resolve();
                        } catch (err) {
                            console.error("Error generating geometry inside onload:", err);
                            this.updateDiagnostics(`Pipeline Error:\n${err.message}\nStack:\n${err.stack}`, true);
                            this.setLoadingState("Error during generation", true);
                            reject(err);
                        }
                    };
                    img.src = imageUrl;
                });
            }

            setViewMode(mode) {
                ['lit', 'unlit', 'wire'].forEach(id => {
                    const btn = document.getElementById(`view-${id}`);
                    if (id === mode) {
                        btn.classList.remove('hover:bg-slate-700', 'text-slate-300');
                        btn.classList.add('bg-indigo-600', 'text-white');
                    } else {
                        btn.classList.add('hover:bg-slate-700', 'text-slate-300');
                        btn.classList.remove('bg-indigo-600', 'text-white');
                    }
                });

                this.objects.forEach(obj => {
                    if (obj.userData && obj.userData.isGenerated) {
                        obj.userData.currentMode = mode;
                        if (mode === 'lit') obj.material = obj.userData.materials.lit;
                        if (mode === 'unlit') obj.material = obj.userData.materials.unlit;
                        if (mode === 'wire') obj.material = obj.userData.materials.wireframe;
                    }
                });
            }

            setLightHelperHighlight(light, isSelected) {
                if (!light || !light.userData || !light.userData.helper) return;
                const helper = light.userData.helper;
                helper.color = isSelected ? 0xffff00 : undefined;
                if (helper.update) helper.update();
            }

            selectObject(obj) {
                // Reset previous selection highlights
                if (this.selectedObject && this.selectedObject.isLight) {
                    this.setLightHelperHighlight(this.selectedObject, false);
                }
                if (this.selectionHelper) {
                    this.scene.remove(this.selectionHelper);
                    this.selectionHelper.dispose();
                    this.helpers = this.helpers.filter(h => h !== this.selectionHelper);
                    this.selectionHelper = null;
                }

                if (!obj) {
                    this.selectedObject = null;
                    this.transformControl.detach();
                    this.updateOutliner();
                    this.updatePropertiesPanel();
                    return;
                }

                this.selectedObject = obj;
                this.transformControl.attach(obj);



                // Apply selection highlights
                if (obj.isMesh) {
                    this.selectionHelper = new THREE.BoxHelper(obj, 0x818cf8);
                    this.scene.add(this.selectionHelper);
                    this.helpers.push(this.selectionHelper);
                } else if (obj.isLight) {
                    this.setLightHelperHighlight(obj, true);
                }

                this.updateOutliner();
                this.updatePropertiesPanel();
            }

            updateOutliner() {
                const list = document.getElementById('outliner-list');
                list.innerHTML = '';
                this.objects.forEach((obj, index) => {
                    const li = document.createElement('li');
                    li.className = `p-2 rounded cursor-pointer text-sm flex justify-between items-center ${this.selectedObject === obj ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = obj.name || `${obj.type} ${index}`;
                    nameSpan.className = "truncate w-3/4";

                    const delBtn = document.createElement('button');
                    delBtn.innerHTML = '×';
                    delBtn.className = "text-slate-400 hover:text-red-400 font-bold px-1";
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        const isLight = obj.isLight;
                        this.scene.remove(obj);
                        this.disposeHierarchy(obj);
                        this.objects.splice(index, 1);
                        if (this.selectedObject === obj) {
                            this.selectObject(null);
                        }
                        this.updateOutliner();
                        if (isLight) {
                            this.onLightsChanged();
                        }
                    };

                    li.appendChild(nameSpan);
                    li.appendChild(delBtn);
                    li.onclick = () => this.selectObject(obj);
                    list.appendChild(li);
                });
            }

            updatePropertiesPanel() {
                const panel = document.getElementById('properties-panel');
                const info = document.getElementById('selection-info');
                const lightProps = document.getElementById('light-props');
                const meshProps = document.getElementById('mesh-props');
                const extrusionProps = document.getElementById('extrusion-props');

                if (!this.selectedObject) {
                    panel.classList.add('hidden');
                    info.textContent = "Nothing selected";
                    return;
                }

                panel.classList.remove('hidden');
                info.textContent = this.selectedObject.name || this.selectedObject.type;

                this.syncPropertiesPanel();

                lightProps.classList.add('hidden');
                meshProps.classList.add('hidden');
                if (extrusionProps) extrusionProps.classList.add('hidden');

                if (this.selectedObject.isLight) {
                    lightProps.classList.remove('hidden');
                    document.getElementById('light-color').value = '#' + this.selectedObject.color.getHexString();
                    document.getElementById('light-intensity').value = this.selectedObject.intensity;
                    document.getElementById('intensity-val').textContent = this.selectedObject.intensity.toFixed(2);
                }

                if (this.selectedObject.isMesh) {
                    meshProps.classList.remove('hidden');
                    const isAnim = this.selectedObject.userData.animate || false;
                    document.getElementById('anim-toggle').checked = isAnim;
                    document.getElementById('anim-speed').value = this.selectedObject.userData.rotationSpeed || 0.01;

                    if (this.selectedObject.userData.isGenerated && extrusionProps) {
                         extrusionProps.classList.remove('hidden');
                         const depth = this.selectedObject.userData.extrudeSettings?.depth || 1.0;
                         document.getElementById('extrusion-amount').value = depth;
                         document.getElementById('extrusion-val').textContent = depth.toFixed(2);

                         const colorFrontEl = document.getElementById('color-front');
                         const colorSideEl = document.getElementById('color-side');
                         const colorBackEl = document.getElementById('color-back');

                         if (colorFrontEl && this.selectedObject.userData.materials?.lit?.[0]) {
                             colorFrontEl.value = '#' + this.selectedObject.userData.materials.lit[0].color.getHexString();
                         }
                         if (colorSideEl && this.selectedObject.userData.materials?.lit?.[1]) {
                             colorSideEl.value = '#' + this.selectedObject.userData.materials.lit[1].color.getHexString();
                         }
                         if (colorBackEl && this.selectedObject.userData.materials?.lit?.[2]) {
                             colorBackEl.value = '#' + this.selectedObject.userData.materials.lit[2].color.getHexString();
                         }

                         const profileSelect = document.getElementById('fabric-profile-select');
                         if (profileSelect) {
                             profileSelect.value = this.selectedObject.userData.fabricProfile || 'cotton';
                         }
                    }
                }
            }

            syncPropertiesPanel() {
                if (!this.selectedObject) return;
                const obj = this.selectedObject;

                document.querySelectorAll('.prop-input').forEach(input => {
                    const prop = input.dataset.prop;
                    const axis = input.dataset.axis;
                    input.value = obj[prop][axis].toFixed(2);
                });
            }

            setupEventListeners() {
                document.getElementById('btn-clear-scene').addEventListener('click', () => {
                    this.clearGeneratedMeshes();
                });

                const handleFile = async (file) => {
                    if (file && file.type.startsWith('image/')) {
                        const url = await this.processImageFile(file);
                        setPendingFile({ file, url });
                    }
                };

                const fileInput = document.getElementById('file-input');
                const dropZone = document.getElementById('drop-zone');

                dropZone.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

                dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-indigo-500'); });
                dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-indigo-500'));
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('border-indigo-500');
                    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
                });

                this.pasteHandler = (e) => {
                    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                    for (let index in items) {
                        const item = items[index];
                        if (item.kind === 'file') handleFile(item.getAsFile());
                    }
                };
                document.addEventListener('paste', this.pasteHandler);

                this.keydownHandler = (event) => {
                    switch (event.key.toLowerCase()) {
                        case 'w': this.setGizmoMode('translate'); break;
                        case 'e': this.setGizmoMode('rotate'); break;
                        case 'r': this.setGizmoMode('scale'); break;
                        case 'delete':
                        case 'backspace':
                            if (this.selectedObject && document.activeElement.tagName !== 'INPUT') {
                                const obj = this.selectedObject;
                                const isLight = obj.isLight;
                                const index = this.objects.indexOf(obj);
                                this.scene.remove(obj);
                                this.disposeHierarchy(obj);
                                if (index > -1) this.objects.splice(index, 1);
                                this.selectObject(null);
                                if (isLight) {
                                    this.onLightsChanged();
                                }
                            }
                            break;
                    }
                };
                window.addEventListener('keydown', this.keydownHandler);

                document.querySelectorAll('.gizmo-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.setGizmoMode(e.target.dataset.mode));
                });

                document.getElementById('view-lit').addEventListener('click', () => this.setViewMode('lit'));
                document.getElementById('view-unlit').addEventListener('click', () => this.setViewMode('unlit'));
                document.getElementById('view-wire').addEventListener('click', () => this.setViewMode('wire'));

                document.querySelectorAll('.prop-input').forEach(input => {
                    input.addEventListener('change', (e) => {
                        if (!this.selectedObject) return;
                        const prop = e.target.dataset.prop;
                        const axis = e.target.dataset.axis;
                        this.selectedObject[prop][axis] = parseFloat(e.target.value);
                    });
                });

                document.getElementById('light-color').addEventListener('input', (e) => {
                    if (this.selectedObject && this.selectedObject.isLight) {
                        this.selectedObject.color.set(e.target.value);
                    }
                });
                document.getElementById('light-intensity').addEventListener('input', (e) => {
                    if (this.selectedObject && this.selectedObject.isLight) {
                        const val = parseFloat(e.target.value);
                        this.selectedObject.intensity = val;
                        document.getElementById('intensity-val').textContent = val.toFixed(2);
                    }
                });

                document.getElementById('anim-toggle').addEventListener('change', (e) => {
                    if (this.selectedObject && this.selectedObject.isMesh) {
                        this.selectedObject.userData.animate = e.target.checked;
                    }
                });
                document.getElementById('anim-speed').addEventListener('input', (e) => {
                    if (this.selectedObject && this.selectedObject.isMesh) {
                        this.selectedObject.userData.rotationSpeed = parseFloat(e.target.value);
                    }
                });

                const extrudeAmountInput = document.getElementById('extrusion-amount');
                if (extrudeAmountInput) {
                    extrudeAmountInput.addEventListener('input', (e) => {
                        const val = parseFloat(e.target.value);
                        document.getElementById('extrusion-val').textContent = val.toFixed(2);
                        this.updateSelectedMeshExtrusion(val);
                    });
                }

                const profileSelect = document.getElementById('fabric-profile-select');
                if (profileSelect) {
                    profileSelect.addEventListener('change', (e) => {
                        const obj = this.selectedObject;
                        if (obj && obj.isMesh && obj.userData.isGenerated && obj.userData.materials) {
                            const val = e.target.value;
                            obj.userData.fabricProfile = val;
                            if (obj.userData.materials.lit) {
                                obj.userData.materials.lit.forEach(mat => {
                                    this.fabricMaterialManager.applyProfile(mat, val);
                                });
                            }
                        }
                    });
                }

                const colorFrontInput = document.getElementById('color-front');
                if (colorFrontInput) {
                    colorFrontInput.addEventListener('input', (e) => {
                        const obj = this.selectedObject;
                        if (obj && obj.isMesh && obj.userData.isGenerated && obj.userData.materials) {
                            const val = e.target.value;
                            if (obj.userData.materials.lit?.[0]) obj.userData.materials.lit[0].color.set(val);
                            if (obj.userData.materials.unlit?.[0]) obj.userData.materials.unlit[0].color.set(val);
                        }
                    });
                }

                const colorSideInput = document.getElementById('color-side');
                if (colorSideInput) {
                    colorSideInput.addEventListener('input', (e) => {
                        const obj = this.selectedObject;
                        if (obj && obj.isMesh && obj.userData.isGenerated && obj.userData.materials) {
                            const val = e.target.value;
                            if (obj.userData.materials.lit?.[1]) obj.userData.materials.lit[1].color.set(val);
                            if (obj.userData.materials.unlit?.[1]) obj.userData.materials.unlit[1].color.set(val);
                        }
                    });
                }

                const colorBackInput = document.getElementById('color-back');
                if (colorBackInput) {
                    colorBackInput.addEventListener('input', (e) => {
                        const obj = this.selectedObject;
                        if (obj && obj.isMesh && obj.userData.isGenerated && obj.userData.materials) {
                            const val = e.target.value;
                            if (obj.userData.materials.lit?.[2]) obj.userData.materials.lit[2].color.set(val);
                            if (obj.userData.materials.unlit?.[2]) obj.userData.materials.unlit[2].color.set(val);
                        }
                    });
                }

                document.getElementById('btn-add-light').addEventListener('click', () => {
                    const light = new THREE.PointLight(0xffffff, 2, 50);
                    light.position.set(0, 2, 2);
                    light.name = `Point Light ${this.objects.filter(o => o.isLight).length + 1}`;

                    const helper = new THREE.PointLightHelper(light, 0.5);
                    this.scene.add(helper);
                    this.helpers.push(helper);
                    light.userData.helper = helper;

                    this.addSceneObject(light);
                    this.selectObject(light);
                });

                document.getElementById('btn-export').addEventListener('click', () => {
                    this.exportGLTF();
                });
            }

            setGizmoMode(mode) {
                this.transformControl.setMode(mode);
                document.querySelectorAll('.gizmo-btn').forEach(btn => {
                    btn.classList.toggle('bg-indigo-600', btn.dataset.mode === mode);
                    btn.classList.toggle('text-white', btn.dataset.mode === mode);
                    btn.classList.toggle('bg-slate-700', btn.dataset.mode !== mode);
                });
            }

            exportGLTF() {
                const stripLightsCheck = document.getElementById('export-strip-lights');
                const stripLights = stripLightsCheck ? stripLightsCheck.checked : true;
                const exporter = new GLTFExporter();

                const exportScene = new THREE.Scene();

                this.objects.forEach(obj => {
                    if (stripLights && obj.isLight) return;

                    const clone = obj.clone();

                    if (obj.userData && obj.userData.isGenerated && obj.userData.materials) {
                        clone.material = obj.userData.materials.lit;
                        clone.userData = { isGenerated: true };
                    }

                    exportScene.add(clone);
                });

                // Force Binary GLB format with embedded images for WebAR mobile renderer compatibility
                exporter.parse(
                    exportScene,
                    (gltf) => {
                        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.style.display = 'none';
                        link.href = url;
                        link.download = 'Studio_Export.glb';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    },
                    (err) => {
                        console.error('Export error:', err);
                        alert("An error occurred during export. Check console.");
                    },
                    { binary: true, embedImages: true }
                );
            }

            animate() {
                this.animationId = requestAnimationFrame(() => this.animate());

                if (this.orbit) {
                    this.orbit.update();
                }

                this.objects.forEach(obj => {
                    if (obj.userData && obj.userData.isGenerated && obj.userData.animate) {
                        const speed = obj.userData.rotationSpeed !== undefined ? obj.userData.rotationSpeed : 0.01;
                        obj.rotation.y += speed;
                    }
                });

                // Update light helpers to sync with light position changes
                this.helpers.forEach(helper => {
                    if (helper.update) helper.update();
                });

                this.renderer.render(this.scene, this.camera);
            }

            destroy() {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }

                // Disconnect ResizeObserver
                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                }

                // Remove global event listeners
                if (this.keydownHandler) {
                    window.removeEventListener('keydown', this.keydownHandler);
                }
                if (this.pasteHandler) {
                    document.removeEventListener('paste', this.pasteHandler);
                }

                // Dispose controls
                if (this.orbit) this.orbit.dispose();
                if (this.transformControl) this.transformControl.dispose();

                // Clear all objects from the scene and dispose their geometries/materials
                this.objects.forEach(obj => {
                    this.disposeHierarchy(obj);
                });

                this.helpers.forEach(helper => {
                    if (helper.geometry) helper.geometry.dispose();
                    if (helper.material) {
                        if (Array.isArray(helper.material)) {
                            helper.material.forEach(m => m.dispose());
                        } else {
                            helper.material.dispose();
                        }
                    }
                });

                // Remove DOM elements
                if (this.container && this.renderer.domElement && this.renderer.domElement.parentNode === this.container) {
                    this.container.removeChild(this.renderer.domElement);
                }

                this.renderer.dispose();
            }
        }

        const app = new StudioApp();
        appRef.current = app;

        return () => {
            appRef.current = null;
            app.destroy();
        };
    }, []);

    return (
        <div className="bg-slate-900 text-slate-200 h-screen flex flex-col md:flex-row overflow-hidden relative">
            <style dangerouslySetInnerHTML={{
                __html: `
                .studio-scroll::-webkit-scrollbar { width: 8px; }
                .studio-scroll::-webkit-scrollbar-track { background: #1e293b; }
                .studio-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
                .studio-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
            `}} />

            {/* Canvas Background */}
            <div id="canvas-container" className="flex-1 relative w-full h-full z-[1]"></div>

            {/* Loading Overlay */}
            <div id="loading-overlay" className="hidden absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-[50] backdrop-blur-sm transition-opacity duration-300">
                <div className="w-16 h-16 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <h2 id="loading-text" className="text-xl font-semibold text-indigo-400">Initializing...</h2>
                <p className="text-slate-400 mt-2 text-sm max-w-md text-center">Please wait while the AI generation pipeline constructs the geometry.</p>
            </div>

            {/* Diagnostic Toolbar (Top Center) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[20] bg-slate-800/90 backdrop-blur rounded-lg p-1 flex gap-1 border border-slate-700 shadow-xl">
                <button id="view-lit" className="px-4 py-1.5 text-sm font-medium rounded bg-indigo-600 text-white shadow-sm transition-colors">Lit (PBR)</button>
                <button id="view-unlit" className="px-4 py-1.5 text-sm font-medium rounded hover:bg-slate-700 text-slate-300 transition-colors">Unlit</button>
                <button id="view-wire" className="px-4 py-1.5 text-sm font-medium rounded hover:bg-slate-700 text-slate-300 transition-colors">Wireframe</button>
            </div>

            {/* Left Panel: Outliner & Input */}
            <div className="ui-panel w-full md:w-80 bg-slate-800/95 border-r border-slate-700 flex flex-col h-full shadow-xl z-10">
                <div className="p-4 border-b border-slate-700">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                        Studio 4D*4
                    </h1>
                </div>

                <div className="p-4 border-b border-slate-700">
                    <h2 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">Asset Ingestion</h2>
                    <div id="drop-zone" className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:bg-slate-700/50 hover:border-indigo-500 transition-all cursor-pointer">
                        <svg className="mx-auto h-8 w-8 text-slate-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <p className="text-sm text-slate-300">Click, paste, or drop image here</p>
                        <input type="file" id="file-input" className="hidden" accept="image/*" />
                    </div>
                    <button id="btn-clear-scene" className="mt-3 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded border border-red-500/20 transition-colors">
                        Clear Generated Meshes
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto studio-scroll p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Scene Outliner</h2>
                        <button id="btn-add-light" className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors">+ Add Light</button>
                    </div>
                    <ul id="outliner-list" className="space-y-1">
                        {/* Outliner items injected here */}
                    </ul>
                </div>
            </div>

            {/* Right Panel: Properties */}
            <div className="ui-panel w-full md:w-80 bg-slate-800/95 border-l border-slate-700 flex flex-col h-full shadow-xl ml-auto z-10">
                <div className="p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-sm font-semibold text-white">Properties</h2>
                    <p id="selection-info" className="text-xs text-slate-400 mt-1">Nothing selected</p>
                    <div id="diagnostics-panel" className="text-xs text-indigo-300 mt-3 p-3 bg-slate-950/80 rounded border border-indigo-500/30 font-mono hidden max-h-40 overflow-y-auto studio-scroll"></div>
                </div>

                <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-6 hidden" id="properties-panel">

                    {/* Transform Gizmo Settings */}
                    <div>
                        <h3 className="text-xs uppercase font-semibold text-slate-400 mb-2">Transform Controls</h3>
                        <div className="flex gap-2">
                            <button className="gizmo-btn flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors active" data-mode="translate">Translate (W)</button>
                            <button className="gizmo-btn flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors" data-mode="rotate">Rotate (E)</button>
                            <button className="gizmo-btn flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors" data-mode="scale">Scale (R)</button>
                        </div>
                    </div>

                    {/* Position/Rot/Scale Inputs */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="w-12 text-xs text-slate-400">Position</span>
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="position" data-axis="x" />
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="position" data-axis="y" />
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="position" data-axis="z" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-12 text-xs text-slate-400">Scale</span>
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="scale" data-axis="x" />
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="scale" data-axis="y" />
                            <input type="number" step="0.1" className="prop-input flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" data-prop="scale" data-axis="z" />
                        </div>
                    </div>

                    {/* Light Specific Properties */}
                    <div id="light-props" className="space-y-3 hidden border-t border-slate-700 pt-4">
                        <h3 className="text-xs uppercase font-semibold text-slate-400">Light Settings</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Color</span>
                            <input type="color" id="light-color" className="bg-slate-900 border border-slate-700 rounded w-16 h-8 cursor-pointer" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-slate-400">Intensity</span>
                                <span id="intensity-val" className="text-xs text-slate-400">1</span>
                            </div>
                            <input type="range" id="light-intensity" min="0" max="10" step="0.1" className="w-full accent-indigo-500" />
                        </div>
                    </div>

                    {/* Mesh Animation Properties */}
                    <div id="mesh-props" className="space-y-3 hidden border-t border-slate-700 pt-4">
                        <h3 className="text-xs uppercase font-semibold text-slate-400">Animation</h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="anim-toggle" className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500" />
                            <span className="text-sm text-slate-300">Continuous Rotation</span>
                        </label>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-slate-400">Speed (Y-Axis)</span>
                            </div>
                            <input type="range" id="anim-speed" min="-0.1" max="0.1" step="0.001" defaultValue="0.01" className="w-full accent-indigo-500" />
                        </div>
                    </div>

                    {/* Mesh Extrusion Properties */}
                    <div id="extrusion-props" className="space-y-3 hidden border-t border-slate-700 pt-4">
                        <h3 className="text-xs uppercase font-semibold text-slate-400">3D Extrusion</h3>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-slate-400">Extrusion Amount</span>
                                <span id="extrusion-val" className="text-xs text-slate-400">1.00</span>
                            </div>
                            <input type="range" id="extrusion-amount" min="0.05" max="3.0" step="0.05" className="w-full accent-indigo-500" />
                        </div>

                        <h3 className="text-xs uppercase font-semibold text-slate-400 border-t border-slate-700 pt-3 mt-3">Fabric Profile</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Material Profile</span>
                            <select id="fabric-profile-select" className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white">
                                <option value="cotton">Matte Cotton</option>
                                <option value="satin">Satin / Silk</option>
                                <option value="velvet">Velvet / Fuzz</option>
                                <option value="mesh">Technical Mesh</option>
                            </select>
                        </div>

                        <h3 className="text-xs uppercase font-semibold text-slate-400 border-t border-slate-700 pt-3 mt-3">Face Colors</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Front (Tint)</span>
                            <input type="color" id="color-front" className="bg-slate-900 border border-slate-700 rounded w-16 h-8 cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Back (Tint)</span>
                            <input type="color" id="color-back" className="bg-slate-900 border border-slate-700 rounded w-16 h-8 cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Sides</span>
                            <input type="color" id="color-side" className="bg-slate-900 border border-slate-700 rounded w-16 h-8 cursor-pointer" />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 mt-auto bg-slate-800 flex-shrink-0">
                    <div className="mb-2 p-2 bg-indigo-950/60 border border-indigo-500/30 rounded text-[11px] text-indigo-300">
                        ✨ <strong>Required WebAR Format:</strong> Exports as single binary <code className="text-white bg-indigo-900/80 px-1 py-0.5 rounded">.GLB</code> with embedded PBR materials & textures.
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                        <input type="checkbox" id="export-strip-lights" defaultChecked className="rounded bg-slate-900 border-slate-700 text-indigo-500" />
                        <span className="text-xs text-slate-400">Strip Studio Lighting (Recommended for WebAR)</span>
                    </label>
                    <button id="btn-export" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow-lg transition-colors flex justify-center items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Export .GLB (WebAR Format)
                    </button>
                </div>
            </div>

            {/* Choose 3D Generation Pipeline Modal */}
            {pendingFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center space-y-4">
                        <h3 className="text-lg font-bold text-white tracking-wide">Select Generation Pipeline</h3>
                        <p className="text-sm text-slate-400">Choose how you want to convert the garment image into 3D geometry.</p>
                        <div className="flex flex-col gap-2 pt-2">
                            <button 
                                onClick={async () => {
                                    if (appRef.current && pendingFile) {
                                        const { file, url } = pendingFile;
                                        setPendingFile(null);
                                        await appRef.current.createReimaginedGeometry(url, file.name);
                                    }
                                }}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm"
                            >
                                Flat Extrusion
                            </button>
                            <button 
                                onClick={async () => {
                                    if (appRef.current && pendingFile) {
                                        const { file } = pendingFile;
                                        setPendingFile(null);
                                        await appRef.current.generateVolumetricMesh(file);
                                    }
                                }}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors text-sm"
                            >
                                Volumetric AI
                            </button>
                            <button 
                                onClick={() => setPendingFile(null)}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors text-xs font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
