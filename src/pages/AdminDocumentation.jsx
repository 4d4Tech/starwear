import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const DOC_SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview & System Purpose',
    icon: 'view_in_ar',
    badge: 'CORE',
    badgeColor: 'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700/60 font-bold',
    summary: 'Role of ARExperience.jsx in Star weAR as the production client WebAR runtime engine.'
  },
  {
    id: 'architecture',
    title: '2. End-to-End Architecture',
    icon: 'account_tree',
    badge: 'PIPELINE',
    badgeColor: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-700/60 font-bold',
    summary: 'Data routing from physical QR scan to Cloud Function router, Firestore, and WebGL scene.'
  },
  {
    id: 'modes',
    title: '3. Dual-Mode Operation Engine',
    icon: 'cameraswitch',
    badge: 'RUNTIME',
    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60 font-bold',
    summary: 'Seamless switching between Live WebAR Camera Tracking and Studio 3D OrbitControls Preview.'
  },
  {
    id: 'mindar',
    title: '4. MindAR Computer Vision & Tracking',
    icon: 'center_focus_strong',
    badge: 'VISION',
    badgeColor: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/60 font-bold',
    summary: 'Image target detection, 1-Euro smoothing filters, miss tolerances, and haptic feedback.'
  },
  {
    id: 'mesh-pipeline',
    title: '5. 3D Model & Mesh Overrides Pipeline',
    icon: 'category',
    badge: '3D GRAPHICS',
    badgeColor: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-700/60 font-bold',
    summary: 'Auto-centering, animations, and granular per-mesh transformations, materials, and UV texturing.'
  },
  {
    id: 'video-audio',
    title: '6. Video Layers & CSS3D YouTube System',
    icon: 'smart_display',
    badge: 'MULTIMEDIA',
    badgeColor: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/60 font-bold',
    summary: 'iOS Safari autoplay unlocking, WebGL video textures, and CORS-free YouTube CSS3D overlays.'
  },
  {
    id: 'checkout',
    title: '7. E-Commerce Checkout & Telemetry',
    icon: 'shopping_bag',
    badge: 'COMMERCE',
    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60 font-bold',
    summary: 'Floating BuyNowButton, PayPal direct checkout integration, and Firebase analytics events.'
  },
  {
    id: 'diagnostics',
    title: '8. Developer Diagnostics & HUD',
    icon: 'terminal',
    badge: 'DEBUG',
    badgeColor: 'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-700/60 font-bold',
    summary: 'Real-time telemetry HUD, FORCE RENDER marker bypass, and one-click log export.'
  },
  {
    id: 'schema',
    title: '9. ar_config Schema & Reference',
    icon: 'code',
    badge: 'SPECIFICATION',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 dark:bg-fuchsia-950/80 dark:text-fuchsia-200 dark:border-fuchsia-700/60 font-bold',
    summary: 'Complete JSON specification for Firestore batch & asset configuration payloads.'
  },
  {
    id: 'troubleshooting',
    title: '10. Troubleshooting & Best Practices',
    icon: 'help',
    badge: 'GUIDE',
    badgeColor: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950/80 dark:text-orange-200 dark:border-orange-700/60 font-bold',
    summary: 'Solutions to camera permission denials, jitter, fabric glare, and mobile browser quirks.'
  }
];

const CODE_EXAMPLES = {
  firestoreConfig: `{
  "ar_config": {
    "modelScale": 0.45,
    "modelRotX": 90,
    "modelRotY": 0,
    "modelRotZ": 0,
    "modelPosX": 0.0,
    "modelPosY": 0.15,
    "modelPosZ": 0.0,
    "modelRotSpeed": 0,
    "ambientColor": "#ffffff",
    "ambientIntensity": 1.4,
    "dir1Color": "#ffffff",
    "dir1Intensity": 2.5,
    "dir1Position": "2 4 3",
    "dir2Color": "#38bdf8",
    "dir2Intensity": 1.0,
    "dir2Position": "-2 -1 -2",
    "videoUrl": "https://firebasestorage.googleapis.com/.../runway_drop.mp4",
    "videoTargetMesh": "Hoodie_Front_Screen",
    "videoFlipX": false,
    "showBuyButton": true,
    "buyButtonColor": "#e11d48",
    "trackingConfig": {
      "filterMinCF": 0.0005,
      "filterBeta": 0.01,
      "missTolerance": 6,
      "warmupTolerance": 2,
      "maxTrack": 1,
      "targetIndex": 0,
      "showStats": false
    },
    "meshOverrides": {
      "Hoodie_Emblem": {
        "material": {
          "color": "#ffffff",
          "metalness": 0.9,
          "roughness": 0.1,
          "emissive": "#6366f1",
          "emissiveIntensity": 0.5
        }
      }
    }
  }
}`,
  routeEmbed: `// 1. Production Public Route (App.jsx)
<Route path="/ar/:batchId" element={<ARExperience />} />

// 2. Embedded in AR Calibrator / Test Launcher (ARExperienceLauncher.jsx)
<ARExperience 
  propBatchId="batch_summer_hoodie_01" 
  onBack={() => setActiveBatchId(null)} 
  isTestMode={true} 
/>`,
  audioEvents: `// Mute all video layers and YouTube iframes in ARExperience
window.dispatchEvent(
  new CustomEvent('starwear-set-video-mute', { detail: { muted: true } })
);

// Listen to audio status changes emitted by ARExperience
window.addEventListener('starwear-video-mute-status', (e) => {
  console.log('Video audio is now:', e.detail.muted ? 'MUTED' : 'UNMUTED');
});`
};

const AdminDocumentation = () => {
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOC_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.summary.toLowerCase().includes(q) ||
        sec.badge.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return DOC_SECTIONS.find((s) => s.id === activeSectionId) || DOC_SECTIONS[0];
  }, [activeSectionId]);

  return (
    <div className="space-y-8 pb-20 font-sans antialiased text-on-background">
      {/* Top Breadcrumb & Page Header */}
      <header className="pb-6 border-b border-outline-variant/20 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-sm text-primary">menu_book</span>
            <span className="font-mono text-xs text-primary tracking-widest uppercase">Admin Knowledge Base</span>
            <span className="text-secondary/50">•</span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
              WebAR Engine
            </span>
          </div>
          <h1 className="font-headline-lg text-3xl sm:text-4xl text-on-background font-extrabold tracking-tight">
            Documentation Center
          </h1>
          <p className="text-secondary text-sm mt-1 max-w-3xl">
            In-depth architectural specifications, operational workflows, and integration guide for <code className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100 font-bold text-xs border border-slate-300 dark:border-slate-700">arexperience.jsx</code> and the Star weAR WebAR pipeline.
          </p>
        </div>

        {/* Quick Testing Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/ar-api-docs"
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Open AR-Test AI API Specification"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>AI API Docs</span>
          </Link>
          <Link
            to="/ar-test"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-surface-variant/80 hover:bg-surface-variant text-xs font-bold text-on-background border border-outline-variant/40 flex items-center gap-1.5 transition-colors shadow-xs"
            title="Open Interactive Calibration Studio"
          >
            <span className="material-symbols-outlined text-sm text-primary">tune</span>
            <span>AR Calibrator</span>
            <span className="material-symbols-outlined text-xs text-secondary">open_in_new</span>
          </Link>
          <Link
            to="/ar-test-live"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 transition-colors shadow-sm"
            title="Launch ARExperience in Tester Mode"
          >
            <span className="material-symbols-outlined text-sm">videocam</span>
            <span>Live AR Launcher</span>
            <span className="material-symbols-outlined text-xs">open_in_new</span>
          </Link>
        </div>
      </header>

      {/* AR-Test AI API Highlight Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">AR-Test AI API & Vision Specification</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                NOTEBOOK LM READY
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Comprehensive single-page specification and Gemini prompt template for 2D image-to-3D scene generation.
            </p>
          </div>
        </div>
        <Link
          to="/admin/ar-api-docs"
          className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
        >
          <span>Open Specification</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* Quick Stats & Architecture At A Glance */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Primary Runtime */}
        <div className="glass-panel p-4 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-200 flex items-center justify-center border border-indigo-300 dark:border-indigo-800 shrink-0 font-bold">
            <span className="material-symbols-outlined text-xl">view_in_ar</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-secondary uppercase tracking-wider font-semibold">Primary Runtime</p>
            <p className="font-bold text-sm text-on-background truncate">Three.js + A-Frame</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
              v1.7.1 WebGL
            </span>
          </div>
        </div>

        {/* Stat 2: Computer Vision */}
        <div className="glass-panel p-4 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 flex items-center justify-center border border-emerald-300 dark:border-emerald-800 shrink-0 font-bold">
            <span className="material-symbols-outlined text-xl">center_focus_strong</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-secondary uppercase tracking-wider font-semibold">Computer Vision</p>
            <p className="font-bold text-sm text-on-background truncate">MindAR Tracking</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
              1-Euro Jitter Filter
            </span>
          </div>
        </div>

        {/* Stat 3: Dynamic Media */}
        <div className="glass-panel p-4 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 flex items-center justify-center border border-rose-300 dark:border-rose-800 shrink-0 font-bold">
            <span className="material-symbols-outlined text-xl">movie</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-secondary uppercase tracking-wider font-semibold">Dynamic Media</p>
            <p className="font-bold text-sm text-on-background truncate">WebGL & CSS3D</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
              CORS-Safe Video
            </span>
          </div>
        </div>

        {/* Stat 4: Direct Checkout */}
        <div className="glass-panel p-4 rounded-xl border border-outline-variant/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 flex items-center justify-center border border-amber-300 dark:border-amber-800 shrink-0 font-bold">
            <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-secondary uppercase tracking-wider font-semibold">Direct Checkout</p>
            <p className="font-bold text-sm text-on-background truncate">Integrated PayPal</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
              Instant Garment Buy
            </span>
          </div>
        </div>
      </section>

      {/* Main Documentation Center Layout: Sidebar Nav + Article Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Column */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search documentation sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-surface-variant/40 border border-outline-variant/30 text-xs text-on-background placeholder-secondary focus:outline-none focus:border-primary font-mono transition-colors"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-secondary text-base">
              search
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-secondary hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* Section Index List */}
          <div className="glass-panel rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
            <div className="p-3 bg-surface-variant/20 border-b border-outline-variant/20 flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-secondary uppercase">
                TABLE OF CONTENTS
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
                {filteredSections.length} Sections
              </span>
            </div>

            <div className="p-2 space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
              {filteredSections.map((sec) => {
                const isActive = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? 'bg-primary text-on-primary font-bold shadow-md'
                        : 'hover:bg-surface-variant/40 text-secondary hover:text-on-background'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${
                      isActive ? 'text-on-primary' : 'text-primary'
                    }`}>
                      {sec.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {sec.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase tracking-wider shrink-0 border ${
                          isActive
                            ? 'bg-white text-slate-900 border-white shadow-sm'
                            : sec.badgeColor
                        }`}>
                          {sec.badge}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${
                        isActive ? 'text-on-primary/90 font-medium' : 'text-secondary'
                      }`}>
                        {sec.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technical File Link Banner */}
          <div className="p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/20 space-y-2 text-xs">
            <span className="font-mono text-[10px] text-secondary tracking-widest uppercase font-bold block">
              Direct Source Code Reference
            </span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">description</span>
              <span className="font-mono font-bold text-on-background text-xs truncate">
                src/pages/ARExperience.jsx
              </span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed">
              Maintained under strict zero-cache policy. 1,430 lines of production React, A-Frame, Three.js, and MindAR code.
            </p>
          </div>
        </aside>

        {/* Documentation Content Article Body */}
        <main className="lg:col-span-8 space-y-8 min-w-0">
          {/* ARTICLE CONTENT BY SECTION */}

          {/* 1. OVERVIEW */}
          {activeSection.id === 'overview' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-100 text-indigo-950 dark:bg-indigo-950/80 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700/60 uppercase shadow-sm">
                    Core Architectural Role
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  1. Overview & System Purpose of <code className="text-primary font-mono font-bold">ARExperience.jsx</code>
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  <code className="text-primary font-mono font-bold">ARExperience.jsx</code> is Star weAR’s flagship customer-facing WebAR production runtime. It powers the live mobile web experience triggered when a customer scans the physical QR code or NFC smart tag attached to an authentic Star weAR luxury garment.
                </p>
                <p className="text-secondary text-sm leading-relaxed">
                  Unlike traditional augmented reality applications that mandate installing third-party mobile apps from the Apple App Store or Google Play Store, Star weAR operates entirely within the native mobile web browser (iOS Safari, Android Chrome) through standard WebGL, WebRTC camera feeds, and WebAssembly computer vision.
                </p>
              </div>

              {/* Core Feature Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-sm">
                      <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                      <h3>Marker-Based Anchoring</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-200/80 text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                      MARKER
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Tracks the custom target marker embedded in the garment label using MindAR’s feature-point matcher, anchoring the 3D model with millimeter precision.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200 font-bold text-sm">
                      <span className="material-symbols-outlined text-base">3d_rotation</span>
                      <h3>Studio 3D Preview</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                      STUDIO
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Customers who deny camera access or choose to inspect the garment without a marker can toggle to an interactive 3D studio with 360° OrbitControls.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-950 dark:text-rose-200 font-bold text-sm">
                      <span className="material-symbols-outlined text-base">smart_display</span>
                      <h3>Video & YouTube Mapping</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-200/80 text-rose-950 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                      MEDIA
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Injects promotional runway clips or YouTube videos directly onto designated surface meshes of the 3D garment with automatic iOS Safari autoplay unlocking.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-bold text-sm">
                      <span className="material-symbols-outlined text-base">payments</span>
                      <h3>Instant Checkout</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/80 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      CHECKOUT
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Provides a streamlined, one-tap PayPal checkout overlay with real-time currency calculation, batch attribution, and Firebase analytics tracking.
                  </p>
                </div>
              </div>

              {/* Architectural Highlights */}
              <div className="p-6 rounded-2xl bg-surface-variant/15 border border-outline-variant/20 space-y-3">
                <h3 className="font-bold text-base text-on-background flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">verified</span>
                  Zero-Cache Policy Guarantee
                </h3>
                <p className="text-xs text-secondary leading-relaxed">
                  To ensure garments updated in the admin panel immediately reflect for shoppers without stale browser assets, <code className="text-primary font-mono font-bold">ARExperience.jsx</code> explicitly executes:
                </p>
                <div className="p-3 bg-black/80 rounded-lg border border-outline-variant/30 font-mono text-xs text-emerald-300">
                  THREE.Cache.enabled = false;<br />
                  THREE.Cache.clear();
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Furthermore, API router calls include timestamp cache-busters (<code className="text-primary font-mono">?t=Date.now()</code>) and Firestore fetches use <code className="text-primary font-mono">getDocFromServer()</code> to bypass IndexedDB client caches.
                </p>
              </div>
            </article>
          )}

          {/* 2. END-TO-END ARCHITECTURE */}
          {activeSection.id === 'architecture' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-100 text-cyan-950 dark:bg-cyan-950/80 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700/60 uppercase shadow-sm">
                  Data Flow Pipeline
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  2. End-to-End Architectural Pipeline
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  When a customer visits <code className="text-primary font-mono font-bold">/ar/:batchId</code>, a distributed pipeline coordinates asset resolution, storage signing, and WebGL rendering.
                </p>
              </div>

              {/* Step-by-Step Pipeline Flow */}
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold font-mono text-sm flex items-center justify-center shrink-0 shadow-sm">
                    1
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-on-background">QR Scan & Route Extraction</h3>
                    <p className="text-secondary text-xs leading-relaxed">
                      The customer scans a garment QR code linking to <code className="text-primary font-mono">https://starwear.app/ar/{'{batchId}'}</code>. React Router extracts <code className="text-primary font-mono">batchId</code> from the URL or receives <code className="text-primary font-mono">propBatchId</code> if launched within admin test tools.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold font-mono text-sm flex items-center justify-center shrink-0 shadow-sm">
                    2
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-on-background">Loom Router Cloud Function Resolution</h3>
                    <p className="text-secondary text-xs leading-relaxed">
                      The browser queries the serverless routing endpoint <code className="text-primary font-mono">https://loomrouter-5qjmmwdvcq-uc.a.run.app/s/{'{batchId}'}</code>. The router evaluates:
                    </p>
                    <ul className="list-disc list-inside text-xs text-secondary pl-2 space-y-1">
                      <li>Merchant master switch overrides (<code className="text-primary font-mono">is_masterSwitch_active</code>)</li>
                      <li>Batch physical tracking target file (<code className="text-primary font-mono">mind_file_path</code>)</li>
                      <li>3D GLTF asset path (<code className="text-primary font-mono">gltf_file_path</code>)</li>
                      <li>Generates parallel time-limited signed URLs for the <code className="text-primary font-mono">.mind</code> and <code className="text-primary font-mono">.glb</code> files</li>
                    </ul>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold font-mono text-sm flex items-center justify-center shrink-0 shadow-sm">
                    3
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-on-background">Server-Authoritative Firestore Sync</h3>
                    <p className="text-secondary text-xs leading-relaxed">
                      To eliminate caching latency, <code className="text-primary font-mono font-bold">ARExperience.jsx</code> directly contacts Cloud Firestore using <code className="text-primary font-mono">getDocFromServer()</code> on <code className="text-primary font-mono">batches/{'{batchId}'}</code>, falling back to <code className="text-primary font-mono">assets/{'{batchId}'}</code> and <code className="text-primary font-mono">settings/tracking</code> for global tracking defaults.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold font-mono text-sm flex items-center justify-center shrink-0 shadow-sm">
                    4
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-on-background">Three.js & MindAR Scene Mounting</h3>
                    <p className="text-secondary text-xs leading-relaxed">
                      The unified <code className="text-primary font-mono">&lt;a-scene&gt;</code> initializes the WebGL rendering context with sRGB color management, RoomEnvironment IBL tone mapping, MindAR image tracking listeners, and audio playback controllers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-secondary uppercase">Router Payload Response</span>
                  <button
                    onClick={() => handleCopy(CODE_EXAMPLES.routeEmbed, 'routeEmbed')}
                    className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">content_copy</span>
                    <span>{copiedKey === 'routeEmbed' ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-black/80 border border-outline-variant/30 text-emerald-300 font-mono text-xs overflow-x-auto">
                  {CODE_EXAMPLES.routeEmbed}
                </pre>
              </div>
            </article>
          )}

          {/* 3. DUAL-MODE ENGINE */}
          {activeSection.id === 'modes' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 uppercase shadow-sm">
                  Runtime Flexibility
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  3. Dual-Mode Operation Engine
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  <code className="text-primary font-mono font-bold">ARExperience.jsx</code> maintains a single unified WebGL scene that dynamically switches between two runtime environments without remounting or leaking GPU textures.
                </p>
              </div>

              {/* Mode Comparison Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mode A: AR Camera */}
                <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse"></span>
                      <h3 className="font-bold text-base text-emerald-950 dark:text-emerald-200">Mode A: Live WebAR Camera</h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                      CAMERA MODE
                    </span>
                  </div>
                  <ul className="text-xs text-secondary space-y-2 leading-relaxed">
                    <li><strong className="text-on-background">Background:</strong> Set to <code className="text-primary font-mono">transparent</code> to reveal the live device video feed.</li>
                    <li><strong className="text-on-background">Camera Stream:</strong> WebRTC camera tracks unmuted, video element set to <code className="text-primary font-mono">display: block</code>.</li>
                    <li><strong className="text-on-background">Tracking Loop:</strong> MindAR image system active, computing 6-DOF marker transformation matrix.</li>
                    <li><strong className="text-on-background">Camera Controls:</strong> OrbitControls disabled; camera anchored to origin looking into the augmented space.</li>
                    <li><strong className="text-on-background">Viewfinder HUD:</strong> Displays laser scanner brackets until marker locks.</li>
                  </ul>
                </div>

                {/* Mode B: 3D Studio */}
                <div className="p-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-300 dark:border-indigo-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
                      <h3 className="font-bold text-base text-indigo-950 dark:text-indigo-200">Mode B: 3D Studio Preview</h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-200 text-indigo-950 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                      3D PREVIEW
                    </span>
                  </div>
                  <ul className="text-xs text-secondary space-y-2 leading-relaxed">
                    <li><strong className="text-on-background">Background:</strong> Deep dark studio canvas (<code className="text-primary font-mono">#0b0f19</code>).</li>
                    <li><strong className="text-on-background">Camera Stream:</strong> Video tracks disabled and hidden; MindAR computer vision loop paused to save battery.</li>
                    <li><strong className="text-on-background">OrbitControls:</strong> Enabled with smooth damping (0.08), rotation, panning, and zoom support.</li>
                    <li><strong className="text-on-background">View Angle Presets:</strong> Perspective, Front, Back, Left, Right, Top, Bottom, and Reset.</li>
                    <li><strong className="text-on-background">Hotkeys:</strong> Pressing <code className="text-primary font-mono font-bold">F</code> resets camera to Studio 3/4 Perspective.</li>
                  </ul>
                </div>
              </div>

              {/* Viewport Presets Toolbar Detailed Specs */}
              <div className="p-6 rounded-2xl bg-surface-variant/15 border border-outline-variant/20 space-y-3">
                <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">center_focus_strong</span>
                  Studio View Angles & Smooth Interpolation
                </h3>
                <p className="text-xs text-secondary leading-relaxed">
                  In 3D Preview Mode, users can jump between orthogonal and perspective angles. Camera movements use cubic Bezier interpolation over a 350ms duration:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold rounded border border-slate-300 dark:border-slate-700 text-center shadow-xs">Perspective (3/4)</span>
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold rounded border border-slate-300 dark:border-slate-700 text-center shadow-xs">Front View</span>
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold rounded border border-slate-300 dark:border-slate-700 text-center shadow-xs">Back View</span>
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold rounded border border-slate-300 dark:border-slate-700 text-center shadow-xs">Side (L / R)</span>
                </div>
              </div>
            </article>
          )}

          {/* 4. MINDAR TRACKING */}
          {activeSection.id === 'mindar' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 uppercase shadow-sm">
                  Computer Vision Engine
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  4. MindAR Computer Vision & Tracking Engine
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  MindAR uses custom WebAssembly and WebGL shaders to analyze incoming camera frames, detecting high-gradient feature points within compiled <code className="text-primary font-mono">.mind</code> files.
                </p>
              </div>

              {/* Key Tracking Parameters Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-variant/60 font-mono text-on-background font-bold uppercase border-b border-outline-variant/40">
                    <tr>
                      <th className="p-3">Parameter</th>
                      <th className="p-3">Default</th>
                      <th className="p-3">Description & Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-mono">
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">filterMinCF</span>
                      </td>
                      <td className="p-3 text-secondary font-bold">0.0005</td>
                      <td className="p-3 text-on-surface-variant font-sans">1-Euro Filter minimum cutoff frequency. Lower values eliminate high-frequency hand jitter.</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">filterBeta</span>
                      </td>
                      <td className="p-3 text-secondary font-bold">0.01</td>
                      <td className="p-3 text-on-surface-variant font-sans">Speed coefficient for 1-Euro Filter. Controls tracking responsiveness during fast marker movement.</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">missTolerance</span>
                      </td>
                      <td className="p-3 text-secondary font-bold">6</td>
                      <td className="p-3 text-on-surface-variant font-sans">Frames the marker can be occluded or out of frame before tracking state is marked as LOST.</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">warmupTolerance</span>
                      </td>
                      <td className="p-3 text-secondary font-bold">2</td>
                      <td className="p-3 text-on-surface-variant font-sans">Consecutive frames required to verify marker lock before anchoring the 3D model.</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">maxTrack</span>
                      </td>
                      <td className="p-3 text-secondary font-bold">1</td>
                      <td className="p-3 text-on-surface-variant font-sans">Number of simultaneous physical markers tracked concurrently (1 for garment tags).</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Target File Size Warning */}
              <div className="p-5 rounded-xl bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200 text-sm">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>Marker File Quality Pre-Validation</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-950 border border-amber-400">
                    QUALITY CHECK
                  </span>
                </div>
                <p className="text-secondary leading-relaxed">
                  During initialization, <code className="text-primary font-mono font-bold">ARExperience.jsx</code> downloads the <code className="text-primary font-mono">.mind</code> file and checks its byte size. If the file is smaller than 500 bytes, a diagnostic warning (<code className="text-amber-800 dark:text-amber-300 font-mono font-bold">MIND_FILE_WARN</code>) is logged indicating the marker lacks sufficient distinctive feature points.
                </p>
              </div>
            </article>
          )}

          {/* 5. MESH OVERRIDES */}
          {activeSection.id === 'mesh-pipeline' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-purple-100 text-purple-950 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-700/60 uppercase shadow-sm">
                  PBR & Scene Graph
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  5. 3D Model & Mesh Overrides Pipeline
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  Star weAR uses a hierarchical override architecture where base 3D models stored in Cloud Storage can have individual meshes, materials, and UV textures altered without re-exporting the 3D asset from Blender.
                </p>
              </div>

              {/* Traversal & Normalization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 text-base">adjust</span>
                    Model Auto-Centering
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed">
                    The <code className="text-primary font-mono">model-auto-center</code> component calculates the bounding box of non-screen meshes, centers the pivot point at (0, 0, 0), and normalizes millimeter authored files down to meters.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 text-base">animation</span>
                    Skeletal & Morph Animations
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed">
                    Embedded GLTF animation clips (e.g., fabric cloth physics, garment floating) are driven by Three.js <code className="text-primary font-mono">AnimationMixer</code> and paused when media is toggled off.
                  </p>
                </div>
              </div>

              {/* Material Overrides Breakdown */}
              <div className="p-6 rounded-2xl bg-surface-variant/15 border border-outline-variant/20 space-y-3">
                <h3 className="font-bold text-sm text-on-background">Granular Node Modifications Supported:</h3>
                <ul className="text-xs text-secondary space-y-2">
                  <li><strong className="text-on-background">Transformation:</strong> <code className="text-primary font-mono">position</code>, <code className="text-primary font-mono">rotation</code> (degrees converted to radians), and <code className="text-primary font-mono">scale</code>.</li>
                  <li><strong className="text-on-background">Node Deletion:</strong> If marked <code className="text-primary font-mono">deleted: true</code>, the mesh is detached from its parent: <code className="text-primary font-mono">node.parent.remove(node)</code>.</li>
                  <li><strong className="text-on-background">PBR Materials:</strong> Color tint, metalness, roughness, emissive glow, opacity, wireframe mode, and double-sided rendering.</li>
                  <li><strong className="text-on-background">UV Texture Transform:</strong> Repeat tiling (X/Y), offset shifting (X/Y), UV rotation angle, and horizontal/vertical flipping.</li>
                </ul>
              </div>
            </article>
          )}

          {/* 6. VIDEO & YOUTUBE */}
          {activeSection.id === 'video-audio' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-100 text-rose-950 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60 uppercase shadow-sm">
                  Video Texture Systems
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  6. Dynamic Video Layers & CSS3D YouTube System
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  One of the most powerful features in <code className="text-primary font-mono font-bold">ARExperience.jsx</code> is mapping streaming video onto curved 3D garment surfaces.
                </p>
              </div>

              {/* Two Video Modes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-rose-950 dark:text-rose-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">video_file</span>
                      Mode 1: WebGL VideoTexture (.mp4 / .webm)
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-200 text-rose-950 border border-rose-300">
                      WEBGL TEXTURE
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Direct video files are loaded into an HTML5 <code className="text-primary font-mono">&lt;video&gt;</code> element attached to a hidden DOM container (<code className="text-primary font-mono">#aframe-video-hidden-box</code>) to maintain active iOS Safari hardware decoders.
                  </p>
                  <p className="text-secondary text-xs leading-relaxed">
                    The texture updates every render frame with automatic horizontal mirroring support (<code className="text-primary font-mono">videoFlipX</code>).
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-rose-950 dark:text-rose-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">smart_display</span>
                      Mode 2: CSS3D YouTube Overlays
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-200 text-rose-950 border border-rose-300">
                      CSS3D YOUTUBE
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Because YouTube embeds cannot be streamed into WebGL canvas textures without cross-origin CORS security blocks, Star weAR projects a <code className="text-primary font-mono">CSS3DObject</code> iframe aligned with the mesh surface normal and tangent frame.
                  </p>
                  <p className="text-secondary text-xs leading-relaxed">
                    The iframe syncs its world position, rotation, and camera projection identically with the WebGL scene.
                  </p>
                </div>
              </div>

              {/* Audio Management Events */}
              <div className="p-6 rounded-2xl bg-surface-variant/15 border border-outline-variant/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">volume_up</span>
                    Audio Mute & Playback Synchronization
                  </h3>
                  <button
                    onClick={() => handleCopy(CODE_EXAMPLES.audioEvents, 'audioEvents')}
                    className="text-[11px] font-mono font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">content_copy</span>
                    <span>{copiedKey === 'audioEvents' ? 'Copied!' : 'Copy Snippet'}</span>
                  </button>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Mobile browsers restrict autoplaying media with sound until a user interacts with the page. <code className="text-primary font-mono font-bold">ARExperience.jsx</code> starts media muted and exposes global events:
                </p>
                <pre className="p-4 rounded-xl bg-black/80 border border-outline-variant/30 text-emerald-300 font-mono text-xs overflow-x-auto">
                  {CODE_EXAMPLES.audioEvents}
                </pre>
              </div>
            </article>
          )}

          {/* 7. E-COMMERCE & CHECKOUT */}
          {activeSection.id === 'checkout' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 uppercase shadow-sm">
                  Direct Commerce
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  7. E-Commerce Checkout & Telemetry
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  The WebAR experience is not merely an educational viewer—it is a high-converting direct point-of-sale.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">shopping_cart</span>
                    Floating BuyNowButton Component
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed">
                    Rendered conditionally via <code className="text-primary font-mono">cfg.showBuyButton</code> with customizable accent colors (<code className="text-primary font-mono">cfg.buyButtonColor</code>). Displays dynamic garment pricing retrieved from the batch configuration.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-base">payments</span>
                    PayPal Direct Checkout Handshake
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed">
                    Tapping the checkout button executes <code className="text-primary font-mono font-bold">startDirectPayPalCheckout()</code> via <code className="text-primary font-mono">paypalService.js</code>, packaging garment batch attribution:
                  </p>
                  <div className="p-3 bg-black/80 rounded-lg border border-outline-variant/30 font-mono text-xs text-secondary">
                    metadata: {'{'}<br />
                    &nbsp;&nbsp;batchId: batchId,<br />
                    &nbsp;&nbsp;source: 'ar_experience'<br />
                    {'}'}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                  <h3 className="font-bold text-sm text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-500 text-base">insights</span>
                    Firebase Analytics Event Logging
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed">
                    Triggers a native Google Firebase Analytics <code className="text-primary font-mono font-bold">checkout_started</code> event with the garment price and batch ID, which feeds into the Admin Analytics telemetry board.
                  </p>
                </div>
              </div>
            </article>
          )}

          {/* 8. DIAGNOSTICS & HUD */}
          {activeSection.id === 'diagnostics' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-sky-100 text-sky-950 dark:bg-sky-950/80 dark:text-sky-200 border border-sky-300 dark:border-sky-700/60 uppercase shadow-sm">
                  Runtime Developer Tools
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  8. Developer Diagnostics HUD & Testing Tools
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  To eliminate guesswork during client demonstrations or factory quality assurance testing, <code className="text-primary font-mono font-bold">ARExperience.jsx</code> includes an integrated developer drawer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-sky-950 dark:text-sky-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">terminal</span>
                      Event Stream HUD
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-200 text-sky-950 border border-sky-300">
                      LOG HUD
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Maintains a rolling buffer of the last 50 runtime events (<code className="text-primary font-mono">ROUTER_FETCH</code>, <code className="text-primary font-mono">MINDAR_READY</code>, <code className="text-primary font-mono">TARGET_FOUND</code>, <code className="text-primary font-mono">MESH_AUDIT</code>).
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">visibility</span>
                      FORCE RENDER Tool
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 border border-emerald-300">
                      MARKERLESS
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Bypasses physical marker detection entirely and mounts the 3D model directly at position (0, 0, -2) in front of the device camera for fast testing without paper prints.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">content_copy</span>
                      COPY LOGS Button
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-950 border border-amber-300">
                      CLIPBOARD
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    Copies formatted timestamps, log tags, and serialized payload JSON directly to the developer’s clipboard for rapid bug submission.
                  </p>
                </div>
              </div>
            </article>
          )}

          {/* 9. ar_config SCHEMA */}
          {activeSection.id === 'schema' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950/80 dark:text-fuchsia-200 border border-fuchsia-300 dark:border-fuchsia-700/60 uppercase shadow-sm">
                  Data Dictionary
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  9. Complete <code className="text-primary font-mono font-bold">ar_config</code> JSON Reference
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  The complete schema stored inside Firestore document <code className="text-primary font-mono font-bold">batches/{'{batchId}'}.ar_config</code>:
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-secondary uppercase">Firestore ar_config JSON Payload</span>
                  <button
                    onClick={() => handleCopy(CODE_EXAMPLES.firestoreConfig, 'firestoreConfig')}
                    className="text-[11px] font-mono font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">content_copy</span>
                    <span>{copiedKey === 'firestoreConfig' ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-black/80 border border-outline-variant/30 text-emerald-300 font-mono text-xs overflow-x-auto max-h-[500px]">
                  {CODE_EXAMPLES.firestoreConfig}
                </pre>
              </div>
            </article>
          )}

          {/* 10. TROUBLESHOOTING */}
          {activeSection.id === 'troubleshooting' && (
            <article className="space-y-6 animate-fade-in">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-orange-100 text-orange-950 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-700/60 uppercase shadow-sm">
                  Field Solutions
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                  10. Troubleshooting & Field Best Practices
                </h2>
                <p className="text-secondary text-sm leading-relaxed">
                  Common technical challenges encountered in WebAR and their architectural remedies.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-red-950 dark:text-red-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">videocam_off</span>
                      Camera Access Denied or Black Screen
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-200 text-red-950 border border-red-300">
                      CRITICAL
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    <strong className="text-on-background">Cause:</strong> iOS Safari or Android Chrome denied getUserMedia video permissions or HTTPS SSL certificate is invalid.<br />
                    <strong className="text-on-background">Solution:</strong> Ensure site is served over valid SSL (HTTPS). The customer can toggle to <strong>3D Studio Mode</strong> using the top-right button to inspect the garment without camera hardware.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">blur_on</span>
                      Tracking Jitter or Marker Loss
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-950 border border-amber-300">
                      CALIBRATION
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    <strong className="text-on-background">Cause:</strong> Physical marker has reflective sheen or low feature contrast, or 1-Euro filter threshold is set too high.<br />
                    <strong className="text-on-background">Solution:</strong> Calibrate the batch in <Link to="/ar-test" className="text-primary underline font-bold">/ar-test</Link> by selecting the <strong>Smooth Tracking Preset</strong> (<code className="text-primary font-mono font-bold">filterMinCF: 0.0001</code>, <code className="text-primary font-mono font-bold">filterBeta: 0.001</code>, <code className="text-primary font-mono font-bold">missTolerance: 10</code>).
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-sky-950 dark:text-sky-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">volume_off</span>
                      Video Texture Silent on iOS Safari
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-200 text-sky-950 border border-sky-300">
                      MEDIA POLICY
                    </span>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    <strong className="text-on-background">Cause:</strong> Apple WebKit policy strictly forbids autoplaying audio without explicit customer touch gestures.<br />
                    <strong className="text-on-background">Solution:</strong> The audio badge in the top bar allows one-tap unmuting, instantly executing <code className="text-primary font-mono font-bold">video.volume = 1.0</code> and <code className="text-primary font-mono font-bold">postMessage unMute</code> for YouTube overlays.
                  </p>
                </div>
              </div>
            </article>
          )}

          {/* Bottom Navigation Strip */}
          <div className="pt-8 border-t border-outline-variant/20 flex items-center justify-between">
            <span className="text-xs font-mono text-secondary">
              Star weAR Production Documentation System
            </span>
            <button
              onClick={() => {
                const idx = DOC_SECTIONS.findIndex((s) => s.id === activeSectionId);
                const nextIdx = (idx + 1) % DOC_SECTIONS.length;
                setActiveSectionId(DOC_SECTIONS[nextIdx].id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-lg bg-surface-variant hover:bg-surface-variant/80 text-xs font-semibold text-primary border border-outline-variant/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Next Topic</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDocumentation;
