import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ProductViewer() {
  const mountRef = useRef(null);

  useEffect(() => {
    let scene, camera, renderer, animationId;
    let mesh;

    const init = () => {
      // Scene setup
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#151a1e');

      // Camera setup
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.set(0, 1.6, 0);

      // Renderer setup
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      mountRef.current.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(-1, 2, 1);
      scene.add(dirLight);

      // 3D Object (representing the digital asset) - match A-Frame torusKnot
      const geometry = new THREE.TorusKnotGeometry(1, 0.1, 100, 16, 2, 3);
      const material = new THREE.MeshStandardMaterial({
        color: 0xb7c8db,
        metalness: 0.8,
        roughness: 0.2
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 1.5, -3);
      scene.add(mesh);

      // Animation Loop
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        mesh.rotation.y += (Math.PI * 2) / (10000 / 16.67); // approx 10000ms per full rotation
        renderer.render(scene, camera);
      };
      animate();

      // Handle Resize
      const handleResize = () => {
        if (!mountRef.current) return;
        const newWidth = mountRef.current.clientWidth;
        const newHeight = mountRef.current.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = init();
    return () => {
      cancelAnimationFrame(animationId);
      cleanup();
      if (renderer) renderer.dispose();
      if (scene) {
        scene.traverse(object => {
          if (object.isMesh) {
            object.geometry.dispose();
            object.material.dispose();
          }
        });
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/10 bg-slate-darker shadow-2xl">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Overlay UI for the Viewer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 glass px-6 py-3 rounded-full flex space-x-6 items-center">
        <button className="text-xs uppercase tracking-widest text-slate-light hover:text-white transition-colors cursor-pointer">Rotate</button>
        <div className="w-px h-4 bg-white/20"></div>
        <button className="text-xs uppercase tracking-widest text-slate-light hover:text-white transition-colors cursor-pointer">Zoom</button>
        <div className="w-px h-4 bg-white/20"></div>
        <button className="text-xs uppercase tracking-widest text-slate-light hover:text-white transition-colors cursor-pointer">AR View</button>
      </div>
    </div>
  );
}

