import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function About() {
  const { canAccessStudio } = useAuth();
  const [activeLayer, setActiveLayer] = useState('hologram');

  const layers = [
    {
      id: 'hologram',
      title: '3D Spatial Hologram',
      tag: '60 FPS WebGL / Three.js',
      description: 'Volumetric 3D geometry rendered in real-time, matching body orientation, natural lighting, and kinetic movement without lag.',
      visualBadge: 'CYBER-CYLINDER MESH'
    },
    {
      id: 'optical',
      title: 'Optical Tracking Anchor',
      tag: 'MindAR Neural Anchor',
      description: 'High-contrast micro-contrast geometric patterns embedded directly into embroidery and screen prints for sub-millimeter recognition.',
      visualBadge: 'TARGET LOCK: 99.8%'
    },
    {
      id: 'video',
      title: 'Dynamic Video Canvas',
      tag: 'H.264 Audio-Reactive',
      description: 'Chroma-keyed video textures mapped seamlessly to the chest and back planes, turning clothing into dynamic living cinema.',
      visualBadge: 'LIVING TEXTILE'
    },
    {
      id: 'textile',
      title: 'Physical Heavyweight Weave',
      tag: '500 GSM Organic Cotton',
      description: 'Hand-tailored custom streetwear cuts in luxury French terry, pre-shrunk and vintage washed for a lifetime of structured wear.',
      visualBadge: 'HEIRLOOM LUXURY'
    }
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-[#38bdf8] selection:text-black font-body-md antialiased">
      <Header />

      {/* Main Content */}
      <main className="pt-28 pb-20 overflow-hidden">
        
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative px-6 max-w-7xl mx-auto pt-12 pb-24 lg:pt-20 lg:pb-32">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-[#38bdf8]/15 via-[#a855f7]/15 to-transparent blur-3xl pointer-events-none -z-10 rounded-full"></div>

          <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.12] text-xs font-mono text-[#38bdf8] tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping"></span>
              <span>PHYGITAL ATELIER • EST. 2026</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-headline-xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] uppercase">
              Physical Garments. <br />
              <span className="bg-gradient-to-r from-[#38bdf8] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
                Augmented Realities.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-xl text-[#a1a1aa] leading-relaxed max-w-2xl font-light">
              Star weAR unites luxury heavyweight streetwear with browser-native WebAR spatial computing. Every piece is an heirloom textile engineered with invisible digital dimensions.
            </p>

            {/* Quick CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                to="/shop"
                className="px-8 py-3.5 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-xl hover:shadow-[#38bdf8]/20 cursor-pointer flex items-center gap-2"
              >
                <span>Explore The Drops</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
              {canAccessStudio ? (
                <Link
                  to="/studio4d4"
                  className="px-8 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm text-[#38bdf8]">view_in_ar</span>
                  <span>Open Studio 4D4</span>
                </Link>
              ) : (
                <Link
                  to="/collections"
                  className="px-8 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm text-[#38bdf8]">grid_view</span>
                  <span>View Collections</span>
                </Link>
              )}
            </div>
          </div>

          {/* Key Metrics Strip */}
          <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-center">
              <div className="font-mono text-3xl sm:text-4xl font-bold text-white mb-1">500 GSM</div>
              <div className="text-xs font-mono text-[#38bdf8] uppercase tracking-wider">Heavyweight French Terry</div>
              <p className="text-[11px] text-[#71717a] mt-2">Organic, custom milled silhouettes engineered for structured drape.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-center">
              <div className="font-mono text-3xl sm:text-4xl font-bold text-[#38bdf8] mb-1">60 FPS</div>
              <div className="text-xs font-mono text-[#38bdf8] uppercase tracking-wider">Mobile WebAR Tracking</div>
              <p className="text-[11px] text-[#71717a] mt-2">Sub-millimeter optical alignment directly in mobile Safari & Chrome.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-center">
              <div className="font-mono text-3xl sm:text-4xl font-bold text-white mb-1">0 Apps</div>
              <div className="text-xs font-mono text-[#38bdf8] uppercase tracking-wider">Zero App Downloads</div>
              <p className="text-[11px] text-[#71717a] mt-2">Pure web browser execution. Point camera, scan anchor, experience magic.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-center">
              <div className="font-mono text-3xl sm:text-4xl font-bold text-[#a855f7] mb-1">100%</div>
              <div className="text-xs font-mono text-[#a855f7] uppercase tracking-wider">Verifiable Digital Twins</div>
              <p className="text-[11px] text-[#71717a] mt-2">Every physical garment links directly to an authenticated digital asset.</p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE AR ANATOMY INSPECTOR                                          */}
        {/* ========================================================================= */}
        <section className="px-6 max-w-7xl mx-auto py-16 border-t border-white/[0.08]">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono text-[#38bdf8] tracking-widest uppercase block mb-2">
              PHYGITAL ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white uppercase tracking-tight font-headline-lg">
              The Anatomy of a Star weAR Garment
            </h2>
            <p className="text-sm text-[#a1a1aa] mt-3">
              Click through the technological layers below to inspect how physical apparel and spatial code fuse into a living experience.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#0d0e12] rounded-3xl border border-white/[0.1] p-6 sm:p-10 shadow-2xl">
            
            {/* Interactive Selector Tabs (Left 5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs font-mono text-[#71717a] uppercase tracking-widest pb-2">
                Select Active Layer:
              </div>
              {layers.map((layer) => {
                const isSelected = activeLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    onClick={() => setActiveLayer(layer.id)}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-white/[0.08] border-[#38bdf8] shadow-lg shadow-[#38bdf8]/10'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs uppercase tracking-wider font-bold ${isSelected ? 'text-[#38bdf8]' : 'text-white'}`}>
                        {layer.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#a1a1aa]">
                        {layer.tag}
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      {layer.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Live Holographic Visualizer Canvas Simulation (Right 7 Cols) */}
            <div className="lg:col-span-7 h-[420px] sm:h-[480px] rounded-2xl bg-[#030406] border border-white/[0.12] relative overflow-hidden flex flex-col justify-between p-6">
              
              {/* Top Telemetry Overlay */}
              <div className="flex items-center justify-between text-[11px] font-mono text-[#a1a1aa] z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-white">WEBAR OPTICAL HUD</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-white/[0.06] border border-white/[0.1] text-[#38bdf8]">
                  LAYER: {activeLayer.toUpperCase()}
                </div>
              </div>

              {/* Center Holographic Stage Graphic */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                
                {/* Visual state: Hologram */}
                {activeLayer === 'hologram' && (
                  <div className="relative flex flex-col items-center justify-center animate-pulse">
                    <div className="w-64 h-64 rounded-full border border-[#38bdf8]/40 border-dashed animate-spin" style={{ animationDuration: '24s' }}></div>
                    <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#38bdf8]/30 to-[#a855f7]/30 blur-2xl"></div>
                    <div className="absolute font-mono text-center">
                      <span className="material-symbols-outlined text-6xl text-[#38bdf8]">view_in_ar</span>
                      <div className="text-xs font-bold text-white tracking-widest mt-2 uppercase">GLTF Mesh Surface</div>
                      <div className="text-[10px] text-[#38bdf8]">PBR Material • 60 FPS</div>
                    </div>
                  </div>
                )}

                {/* Visual state: Optical */}
                {activeLayer === 'optical' && (
                  <div className="relative flex flex-col items-center justify-center">
                    <div className="w-60 h-60 border-2 border-emerald-400/50 rounded-lg p-2 flex items-center justify-center relative">
                      <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                      <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                      <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                      <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
                      
                      <div className="w-40 h-40 bg-white/[0.05] border border-emerald-500/40 rounded flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-5xl text-emerald-400">filter_center_focus</span>
                        <span className="text-[11px] font-mono text-emerald-300 font-bold uppercase tracking-widest">
                          Target Matched
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual state: Video */}
                {activeLayer === 'video' && (
                  <div className="relative flex flex-col items-center justify-center">
                    <div className="w-64 h-44 rounded-xl border border-purple-500/50 bg-purple-950/40 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent animate-pulse"></div>
                      <span className="material-symbols-outlined text-5xl text-purple-400 mb-2">smart_display</span>
                      <span className="text-xs font-mono text-purple-200 font-bold tracking-wider uppercase">
                        Active Video Texture
                      </span>
                      <span className="text-[10px] font-mono text-purple-300/80">
                        Chroma-Key Alpha Channel: Active
                      </span>
                    </div>
                  </div>
                )}

                {/* Visual state: Textile */}
                {activeLayer === 'textile' && (
                  <div className="relative flex flex-col items-center justify-center">
                    <div className="w-60 h-60 rounded-2xl bg-zinc-900 border border-zinc-700 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
                      <span className="material-symbols-outlined text-5xl text-zinc-300 mb-2">checkroom</span>
                      <span className="text-sm font-mono text-white font-bold tracking-wider uppercase">
                        500 GSM French Terry
                      </span>
                      <span className="text-xs text-zinc-400 mt-1">
                        100% Organic Ring-Spun Cotton • Double-Needle Stitched
                      </span>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Telemetry Bar */}
              <div className="flex items-center justify-between text-[11px] font-mono text-[#71717a] z-10 pt-4 border-t border-white/[0.06]">
                <span>COORDINATES: [X: 0.00, Y: 1.25, Z: -0.45]</span>
                <span className="text-emerald-400">STATUS: CALIBRATED</span>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW IT WORKS: THE 3-STEP EXPERIENCE                                       */}
        {/* ========================================================================= */}
        <section className="px-6 max-w-7xl mx-auto py-20 border-t border-white/[0.08]">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-[#38bdf8] tracking-widest uppercase block mb-2">
              FRICTIONLESS ACTIVATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white uppercase tracking-tight font-headline-lg">
              How Phygital Fashion Works
            </h2>
            <p className="text-sm text-[#a1a1aa] mt-3">
              We eliminated apps, logins, and downloads. Anyone with an iPhone or Android phone can experience your clothing in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] relative group hover:border-[#38bdf8]/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#38bdf8]/10 text-[#38bdf8] flex items-center justify-center font-mono font-bold text-lg mb-6 border border-[#38bdf8]/20">
                  01
                </div>
                <h3 className="text-xl font-bold text-white uppercase mb-3">
                  Wear The Garment
                </h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">
                  Slip into your Star weAR hoodie, tee, or jacket. The physical garment functions as a high-end luxury streetwear staple with custom drop-shoulder cuts and heavyweight drape.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-white/[0.06] text-xs font-mono text-[#71717a]">
                TACTILE SILHOUETTE
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] relative group hover:border-[#a855f7]/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#a855f7]/10 text-[#a855f7] flex items-center justify-center font-mono font-bold text-lg mb-6 border border-[#a855f7]/20">
                  02
                </div>
                <h3 className="text-xl font-bold text-white uppercase mb-3">
                  Point Any Phone Camera
                </h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">
                  Friends or onlookers simply scan the discreet QR tag or navigate to your Star weAR link in Safari or Chrome. The browser opens the camera instantly with zero app store friction.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-white/[0.06] text-xs font-mono text-[#71717a]">
                BROWSER-BASED WEBAR
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] relative group hover:border-[#ec4899]/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#ec4899]/10 text-[#ec4899] flex items-center justify-center font-mono font-bold text-lg mb-6 border border-[#ec4899]/20">
                  03
                </div>
                <h3 className="text-xl font-bold text-white uppercase mb-3">
                  Spatial Immersion Unlocks
                </h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">
                  The garment ignites into 3D light ribbons, hovering holographic models, and audio-reactive video projections that track your body movements in fluid 60 frames per second.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-white/[0.06] text-xs font-mono text-[#71717a]">
                LIVING PHYSICAL ARTWORK
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* THE 4D4 TECH ECOSYSTEM & STUDIO 4D4                                       */}
        {/* ========================================================================= */}
        <section id="technology" className="px-6 max-w-7xl mx-auto py-20 border-t border-white/[0.08]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <span className="text-xs font-mono text-[#38bdf8] tracking-widest uppercase block">
                THE SPATIAL LAB
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white uppercase tracking-tight font-headline-lg">
                Powered by 4D4 Technologies
              </h2>
              <p className="text-base text-[#a1a1aa] leading-relaxed">
                Behind Star weAR lies <strong>Studio 4D4</strong>—our proprietary in-browser 3D rigging and spatial garment calibration suite. We bridge CAD apparel design, Three.js shader architecture, and computer vision neural tracking.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] text-[#38bdf8] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm">hub</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase font-mono">Neural Optical Rigging</h4>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      MindAR target files calibrated directly in the browser to recognize fabric distortions, natural wrinkles, and varying lighting conditions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] text-[#a855f7] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm">palette</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase font-mono">Physically Based Fabric Shaders</h4>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      PBR shaders accurately simulating organic cotton sheen, velvet scatter, metallic hardware, and ambient occlusion.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.08] text-[#ec4899] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm">cloud_sync</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase font-mono">Over-The-Air Hologram Updates</h4>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      Because digital layers are decoupled from physical threads, limited-edition garments can receive seasonal 3D visual updates pushed over cloud infrastructure.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                {canAccessStudio ? (
                  <Link
                    to="/studio4d4"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black font-mono font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    <span>Launch Studio 4D4 Workstation</span>
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </Link>
                ) : (
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black font-mono font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    <span>Request Bespoke 3D Commission</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Studio 4D4 Visual Teaser */}
            <div className="relative rounded-3xl bg-gradient-to-br from-zinc-900 to-black border border-white/[0.12] p-8 overflow-hidden shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  </div>
                  <span className="text-[10px] font-mono text-[#a1a1aa]">STUDIO 4D4 RIGGING ENGINE</span>
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-xs space-y-2 text-[#a1a1aa]">
                  <div className="text-[#38bdf8]">$ 4d4 compile --target garment_front.mind</div>
                  <div>&gt; Loading GLTF mesh: obsidian_vortex.glb</div>
                  <div>&gt; Extracting 1,420 keypoint features...</div>
                  <div className="text-emerald-400">&gt; Optical anchor calibrated: 100% confidence</div>
                  <div>&gt; Compiling WebGL shaders: Cotton Sheen PBR</div>
                  <div className="text-[#ec4899]">&gt; WebAR ready: instant browser streaming enabled</div>
                </div>

                <div className="pt-4 flex items-center justify-between text-xs font-mono text-[#71717a]">
                  <span>Engine: Three.js r184</span>
                  <span>CV Backend: MindAR 1.2</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* CRAFTSMANSHIP & SUSTAINABILITY PILLARS                                    */}
        {/* ========================================================================= */}
        <section id="craftsmanship" className="px-6 max-w-7xl mx-auto py-20 border-t border-white/[0.08]">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-[#38bdf8] tracking-widest uppercase block mb-2">
              MATERIAL INTEGRITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white uppercase tracking-tight font-headline-lg">
              Heirloom Craftsmanship First
            </h2>
            <p className="text-sm text-[#a1a1aa] mt-3">
              Technology is meaningless if the garment doesn't feel magnificent on your skin. We build physical pieces designed to outlast ordinary streetwear.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">water_drop</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-mono">50+ Wash Tested</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Optical tracking anchors are embedded into high-density embroidery threads and archival screen-printed inks. Rigorously tested to withstand 50+ machine washes without tracking degradation.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">eco</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-mono">Conscious Batch Runs</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                No overproduction or disposable apparel. We craft limited numbered runs with 100% organic cotton, recyclable packaging, and verified digital certificates of authenticity.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase font-mono">Digital Authenticity</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Every physical garment is paired with its verifiable 3D twin in our cloud catalog, guaranteeing provenance and unlocking exclusive virtual events for verified holders.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BOTTOM CALL TO ACTION BANNER                                              */}
        {/* ========================================================================= */}
        <section className="px-6 max-w-7xl mx-auto pt-10 pb-16">
          <div className="rounded-3xl bg-gradient-to-r from-[#0d141e] via-[#121624] to-[#1a0e24] border border-white/[0.12] p-8 sm:p-14 text-center space-y-6 relative overflow-hidden shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] text-[11px] font-mono text-[#38bdf8] uppercase tracking-widest">
              STEP INTO THE FUTURE OF STREETWEAR
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white uppercase tracking-tight font-headline-lg max-w-2xl mx-auto">
              Ready to Wear The Future?
            </h2>

            <p className="text-sm sm:text-base text-[#a1a1aa] max-w-xl mx-auto">
              Browse our latest curated drops, test 3D models in your browser, or reach out to our concierge for bespoke commissions.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                to="/shop"
                className="px-8 py-3.5 rounded-xl bg-white text-black hover:bg-[#38bdf8] hover:text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-xl cursor-pointer"
              >
                Shop Current Drops
              </Link>
              <Link
                to="/contact"
                className="px-8 py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.15] text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Connect With Concierge
              </Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
