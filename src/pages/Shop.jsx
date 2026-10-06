import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { ReactLenis, useLenis } from 'lenis/react';
import { db, storage } from '../firebase';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';

// Curated Collection with punchy, plain-English descriptions
export const CURATED_COLLECTION = [
  {
    id: 'aether-chrono-trench',
    name: 'Aether Trench',
    edition: 'PRO EDITION',
    tagline: 'Waterproof carbon twill. Floating 3D light rings.',
    heroDescription: 'An architectural trench coat tailored from waterproof carbon twill. Volumetric light rings float around your body the instant you open your camera.',
    price: 280.00,
    colors: [
      { name: 'Titanium Silver', hex: '#d1d5db', border: '#9ca3af' },
      { name: 'Obsidian Black', hex: '#18181b', border: '#3f3f46' },
      { name: 'Aether Cyan', hex: '#38bdf8', border: '#0284c7' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
    detailImages: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80'
    ],
    highlights: [
      { title: 'Floating 3D Rings', desc: 'Glowing visual rings follow your movement in camera view.' },
      { title: 'Waterproof Carbon Twill', desc: 'Heavyweight 480 GSM fabric built to last for years.' },
      { title: 'No App Needed', desc: 'Works instantly in mobile Safari and Chrome.' }
    ],
    category: 'WEBAR',
    mind_file_path: 'anchors/merch_4d4/test_jacket.mind',
    ar_config: {
      ambientIntensity: 1.8,
      dir1Color: '#38bdf8',
      dir1Intensity: 2.2,
      modelScale: 0.45,
      matMetalness: 0.7,
      matRoughness: 0.2
    }
  },
  {
    id: 'obsidian-vortex-hoodie',
    name: 'Vortex Hoodie',
    edition: 'STUDIO EDITION',
    tagline: 'Heavyweight black fleece. Glowing fluid effects.',
    heroDescription: 'Ultra-dense 500 GSM organic cotton hoodie. The chest comes alive with glowing fluid light when viewed through your phone camera.',
    price: 195.00,
    colors: [
      { name: 'Space Black', hex: '#09090b', border: '#27272a' },
      { name: 'Deep Ultraviolet', hex: '#581c87', border: '#7e22ce' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85',
    detailImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
    ],
    highlights: [
      { title: 'Living Chest Graphics', desc: 'Fluid animations mapped right onto your chest.' },
      { title: 'Heavyweight French Terry', desc: 'Thick, velvety organic cotton that holds its shape.' },
      { title: 'Changeable Styles', desc: 'Swap out new visual effects directly from your phone.' }
    ],
    category: 'VIDEO',
    video_url: 'https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fshirt%2Fkeep-it-going.mov?alt=media&token=cad5f38d-e4c0-4a7f-bf4a-1f2b4849518a',
    ar_config: {
      ambientIntensity: 1.5,
      dir1Color: '#c084fc',
      dir1Intensity: 2.4,
      modelScale: 0.5
    }
  },
  {
    id: 'kinetic-cyber-kimono',
    name: 'Kinetic Kimono',
    edition: 'COUTURE EDITION',
    tagline: 'Japanese origami cut. Weightless light ribbons.',
    heroDescription: 'Modern oversized robe combining origami folds with floating light ribbons along your shoulders. Works seamlessly in your phone camera.',
    price: 340.00,
    colors: [
      { name: 'Pure Chalk', hex: '#f4f4f5', border: '#e4e4e7' },
      { name: 'Obsidian Slate', hex: '#1e293b', border: '#334155' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85',
    detailImages: [],
    highlights: [
      { title: 'Floating Ribbons', desc: 'Light ribbons follow your shoulders as you walk.' },
      { title: '1-of-1 Custom Option', desc: 'Add personalized animations unique to you.' },
      { title: 'Limited Run of 500', desc: 'Each piece includes a verified digital certificate.' }
    ],
    category: 'WEBAR',
    mind_file_path: 'anchors/merch_4d4/test_jacket.mind',
    ar_config: {
      ambientIntensity: 1.9,
      dir1Color: '#fef08a',
      dir1Intensity: 2.0,
      modelScale: 0.42
    }
  },
  {
    id: 'quantum-shift-bomber',
    name: 'Shift Bomber',
    edition: 'TECH EDITION',
    tagline: 'Ballistic nylon shell. Color-shifting light.',
    heroDescription: 'Windproof ballistic bomber jacket with magnetic hardware. Shimmering colors adapt automatically to sunlight and room lighting.',
    price: 220.00,
    colors: [
      { name: 'Stealth Noir', hex: '#111827', border: '#1f2937' },
      { name: 'Tactical Olive', hex: '#365314', border: '#4d7c0f' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1200&q=85',
    detailImages: [],
    highlights: [
      { title: 'Color-Shifting Glow', desc: 'Reacts dynamically to daylight and night city lights.' },
      { title: 'Tough Ballistic Shell', desc: 'Windproof, weather-resistant, built for the city.' },
      { title: 'Share in 1 Tap', desc: 'Friends can see your 3D effects on their own phones.' }
    ],
    category: 'HYBRID',
    mind_file_path: 'anchors/merch_4d4/test_jacket.mind',
    ar_config: {
      ambientIntensity: 1.6,
      dir1Color: '#fb7185',
      dir1Intensity: 2.1,
      modelScale: 0.48
    }
  },
  {
    id: 'synth-drape-gown',
    name: 'Synth Gown',
    edition: 'ATELIER EDITION',
    tagline: 'Flowing cyber-mesh. Rainbow light prisms.',
    heroDescription: 'Zero-gravity liquid cyber-mesh that refracts rainbow light filaments as you walk. Turns every room into a runway.',
    price: 410.00,
    colors: [
      { name: 'Liquid Opal', hex: '#e0f2fe', border: '#bae6fd' },
      { name: 'Midnight Onyx', hex: '#09090b', border: '#27272a' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85',
    detailImages: [],
    highlights: [
      { title: 'Rainbow Prisms', desc: 'Refracts virtual light across your natural movement.' },
      { title: 'Smooth 60 FPS Flow', desc: 'Cloth physics run like water on your phone screen.' },
      { title: 'Apple Vision Pro Ready', desc: 'Wear it in real life, or equip your 3D avatar.' }
    ],
    category: 'WEBAR',
    mind_file_path: 'anchors/merch_4d4/test_jacket.mind',
    ar_config: {
      ambientIntensity: 1.7,
      dir1Color: '#38bdf8',
      dir1Intensity: 2.3,
      modelScale: 0.4
    }
  },
  {
    id: 'prism-matrix-vest',
    name: 'Matrix Vest',
    edition: 'MODULAR EDITION',
    tagline: 'Tactical utility harness. Holographic badge.',
    heroDescription: 'Modular utility vest with magnetic quick-release buckles. Projects holographic gridlines and your personalized emblem in camera view.',
    price: 165.00,
    colors: [
      { name: 'Titanium Graphite', hex: '#27272a', border: '#52525b' },
      { name: 'Alpine White', hex: '#f8fafc', border: '#cbd5e1' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=85',
    detailImages: [],
    highlights: [
      { title: 'Magnetic Buckles', desc: 'Quick-release magnetic hardware that clicks tight.' },
      { title: 'Holographic Badge', desc: 'Clean, futuristic 3D badge floating in front of you.' },
      { title: 'Built Tough', desc: 'Weatherproof construction made for daily wear.' }
    ],
    category: 'VIDEO',
    video_url: 'https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fshirt%2Fkeep-it-going.mov?alt=media&token=cad5f38d-e4c0-4a7f-bf4a-1f2b4849518a',
    ar_config: {
      ambientIntensity: 1.5,
      dir1Color: '#34d399',
      dir1Intensity: 2.1,
      modelScale: 0.52
    }
  }
];

export default function Shop() {
  const [collectionList, setCollectionList] = useState(CURATED_COLLECTION);
  const [selectedProduct, setSelectedProduct] = useState(CURATED_COLLECTION[0]);
  const [activeModelUrl, setActiveModelUrl] = useState('');
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [selectedSizes, setSelectedSizes] = useState({});
  const [selectedColors, setSelectedColors] = useState({});
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [cartToast, setCartToast] = useState(null);
  const { addToCart, getCartCount } = useCart();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { isSandboxMode, activeGateway } = usePaymentEnvironment();
  const navigate = useNavigate();

  // Section references for sectioned-out cover parallax (at least 500px height)
  const heroSectionRef = useRef(null);
  const heroBgRef = useRef(null);

  const expSectionRef = useRef(null);
  const expBgRef = useRef(null);

  const studioSectionRef = useRef(null);
  const studioBgRef = useRef(null);

  const collectionSectionRef = useRef(null);
  const collectionBgRef = useRef(null);

  const valuesSectionRef = useRef(null);
  const valuesBgRef = useRef(null);

  // Dedicated sectioned-out cover parallax section references (at least 500px height)
  const cover1SectionRef = useRef(null);
  const cover1BgRef = useRef(null);

  const cover2SectionRef = useRef(null);
  const cover2BgRef = useRef(null);

  const cover3SectionRef = useRef(null);
  const cover3BgRef = useRef(null);

  const subNavRef = useRef(null);
  const lenis = useLenis();

  // Unified Lenis Smooth Parallax Loop
  useLenis(({ scroll }) => {
    const windowH = window.innerHeight;

    // 1. Section 1 (Hero) Cover Parallax: 3dart/video-background-2.png
    if (heroBgRef.current && heroSectionRef.current) {
      const rect = heroSectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.25;
      heroBgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 2. Dedicated Cover Section 1 Parallax (3dart/1.jpg - min-h-[500px])
    if (cover1BgRef.current && cover1SectionRef.current) {
      const rect = cover1SectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.28;
      cover1BgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 3. Section 2 (The Experience) Cover Parallax: 3dart/1.jpg
    if (expBgRef.current && expSectionRef.current) {
      const rect = expSectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.28;
      expBgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 4. Dedicated Cover Section 2 Parallax (3dart/video-background.png - min-h-[500px])
    if (cover2BgRef.current && cover2SectionRef.current) {
      const rect = cover2SectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.26;
      cover2BgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 5. Section 3 (360° Studio) Cover Parallax: 3dart/video-background.png
    if (studioBgRef.current && studioSectionRef.current) {
      const rect = studioSectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.26;
      studioBgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 6. Dedicated Cover Section 3 Parallax (3dart/3.jpg - min-h-[500px])
    if (cover3BgRef.current && cover3SectionRef.current) {
      const rect = cover3SectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.25;
      cover3BgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 7. Section 4 (The Collection) Cover Parallax: 3dart/3.jpg
    if (collectionBgRef.current && collectionSectionRef.current) {
      const rect = collectionSectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.24;
      collectionBgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    // 8. Section 5 (Values & Manifesto) Cover Parallax: 3dart/2.avif
    if (valuesBgRef.current && valuesSectionRef.current) {
      const rect = valuesSectionRef.current.getBoundingClientRect();
      const offset = (rect.top - windowH * 0.5) * 0.22;
      valuesBgRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  });

  // Fetch catalog from Firestore
  useEffect(() => {
    let isMounted = true;
    async function syncCatalog() {
      try {
        const snap = await getDocs(collection(db, 'assets'));
        if (!snap.empty && isMounted) {
          const remoteItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const merged = [...remoteItems];
          CURATED_COLLECTION.forEach(curated => {
            if (!merged.find(m => m.id === curated.id)) {
              merged.push(curated);
            }
          });
          setCollectionList(merged);
        }
      } catch (err) {
        console.warn('Catalog sync note:', err);
      }
    }
    syncCatalog();
    return () => { isMounted = false; };
  }, []);

  // Resolve 3D Model and Video URLs
  useEffect(() => {
    let isMounted = true;
    async function resolveMedia() {
      if (!selectedProduct) return;

      // 1. Resolve 3D Model URL
      let mUrl = selectedProduct.glb_url || selectedProduct.model_url || '';
      if (!mUrl && selectedProduct.gltf_file_path) {
        try {
          const fileRef = ref(storage, selectedProduct.gltf_file_path);
          mUrl = await getDownloadURL(fileRef);
        } catch (e) {
          console.warn('Storage 3D model lookup fallback:', e);
        }
      }
      if (isMounted) setActiveModelUrl(mUrl);

      // 2. Resolve Video Layer URL (YouTube URL, direct HTTP URL, or Storage path)
      let vUrl = selectedProduct.video_url || selectedProduct.videoUrl || selectedProduct.ar_config?.video_url || selectedProduct.ar_config?.videoUrl || '';
      const vPath = selectedProduct.video_file_path || selectedProduct.ar_config?.video_file_path || '';
      if ((!vUrl || !vUrl.startsWith('http')) && vPath) {
        try {
          const vRef = ref(storage, vPath);
          vUrl = await getDownloadURL(vRef);
        } catch (vErr) {
          console.warn('Storage video lookup fallback:', vErr);
        }
      }
      if (isMounted) setActiveVideoUrl(vUrl);
    }
    resolveMedia();
    return () => { isMounted = false; };
  }, [selectedProduct]);

  // Handle Add to Bag
  const handleAddToBag = (product) => {
    const size = selectedSizes[product.id] || 'M';
    const color = selectedColors[product.id] || product.colors?.[0]?.name || 'Classic';
    const price = product.price !== undefined ? Number(product.price) : 280.00;

    addToCart({
      id: `${product.id}-${size}-${color.replace(/\s+/g, '')}`,
      baseId: product.id,
      name: product.name || product.id,
      price: price,
      size: `${size} • ${color}`,
      image: product.imageUrl || product.image || product.target_image_url || '',
      description: product.heroDescription || product.description || ''
    });

    setCartToast({
      name: product.name || product.id,
      size,
      color,
      price
    });

    setTimeout(() => setCartToast(null), 4000);
  };

  const handleSandboxBuy = async (product) => {
    const size = selectedSizes[product.id] || 'M';
    const color = selectedColors[product.id] || product.colors?.[0]?.name || 'Classic';
    const price = product.price !== undefined ? Number(product.price) : 280.00;

    const itemPayload = {
      id: `${product.id}-${size}-${color.replace(/\s+/g, '')}`,
      name: product.name || product.id,
      price: price,
      quantity: 1,
      size: `${size} • ${color}`,
      image: product.imageUrl || product.image || ''
    };

    try {
      if (activeGateway === 'stripe') {
        const { startDirectStripeCheckout } = await import('../services/stripeService');
        await startDirectStripeCheckout({
          items: [itemPayload],
          total: price,
          metadata: {
            productId: product.id,
            source: 'shop_sandbox_btn'
          }
        });
      } else {
        const { startDirectPayPalCheckout } = await import('../services/paypalService');
        await startDirectPayPalCheckout({
          items: [itemPayload],
          total: price,
          metadata: {
            productId: product.id,
            source: 'shop_sandbox_btn'
          }
        });
      }
    } catch (err) {
      console.error('Shop sandbox purchase error:', err);
      alert(`Sandbox purchase failed: ${err.message}`);
    }
  };

  // Smooth scroll handler using Lenis
  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    setActiveSubTab(sectionId.replace('#', ''));
    if (lenis) {
      lenis.scrollTo(sectionId, {
        offset: -80,
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
      });
    } else {
      const el = document.querySelector(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.08,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.6,
        infinite: false,
        autoRaf: true
      }}
    >
      <div className="min-h-screen bg-[#000000] text-[#f5f5f7] font-sans antialiased selection:bg-[#2997ff]/30 selection:text-white relative overflow-x-hidden">
        {/* Main Brand Navigation */}
        <Header />

        {/* Dynamic Island Style Cart Toast Notification */}
        {cartToast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
            <div className="bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.15] px-5 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-4 text-xs">
              <div className="w-8 h-8 rounded-full bg-[#2997ff]/20 text-[#2997ff] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-sm">shopping_bag</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white">{cartToast.name} added to bag.</span>
                <span className="text-[#86868b] text-[11px]">
                  Size {cartToast.size} • {cartToast.color} • ${cartToast.price.toFixed(2)}
                </span>
              </div>
              <Link
                to="/cart"
                className="ml-2 px-3 py-1 bg-white text-black font-semibold rounded-full hover:bg-[#2997ff] hover:text-white transition-colors"
              >
                Review
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* APPLE-STYLE CLEAN STICKY SUB-NAVIGATION BAR                               */}
        {/* ========================================================================= */}
        <div
          ref={subNavRef}
          className="sticky top-20 z-40 w-full bg-[#000000]/85 backdrop-blur-xl border-b border-white/[0.08] transition-all"
        >
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">Star weAR</span>
              <span className="text-xs text-[#86868b] hidden sm:inline">• Smart Streetwear</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#86868b]">
              <a
                href="#overview"
                onClick={(e) => scrollToSection(e, '#overview')}
                className={`transition-colors hover:text-white ${activeSubTab === 'overview' ? 'text-white font-medium' : ''}`}
              >
                Overview
              </a>
              <a
                href="#experience"
                onClick={(e) => scrollToSection(e, '#experience')}
                className={`transition-colors hover:text-white ${activeSubTab === 'experience' ? 'text-white font-medium' : ''}`}
              >
                How It Works
              </a>
              <a
                href="#studio"
                onClick={(e) => scrollToSection(e, '#studio')}
                className={`transition-colors hover:text-white ${activeSubTab === 'studio' ? 'text-white font-medium' : ''}`}
              >
                360° Studio
              </a>
              <a
                href="#collection"
                onClick={(e) => scrollToSection(e, '#collection')}
                className={`transition-colors hover:text-white ${activeSubTab === 'collection' ? 'text-white font-medium' : ''}`}
              >
                Collection
              </a>

              <a
                href="#collection"
                onClick={(e) => scrollToSection(e, '#collection')}
                className="bg-[#2997ff] hover:bg-[#0077ed] text-white px-3.5 py-1.5 rounded-full font-semibold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <span>Buy</span>
              </a>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: HERO - CONCISE, PUNCHY, PUNCH-LINE                              */}
        {/* Full-Bleed Cover Parallax Background: 3dart/video-background-2.png         */}
        {/* ========================================================================= */}
        <section
          ref={heroSectionRef}
          id="overview"
          className="relative min-h-[500px] md:min-h-[96vh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-28 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Cover-Style Parallax Background Container (at least 500px height) */}
          <div
            ref={heroBgRef}
            className="absolute -top-[20%] -left-[5%] w-[110%] min-h-[500px] h-[140%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/video-background-2.png"
              alt="Spatial Chasm Horizon"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.38] contrast-[1.15]"
            />
            {/* Ambient Video Shimmer Layer */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-25"
            >
              <source src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fshirt%2Fkeep-it-going.mov?alt=media&token=cad5f38d-e4c0-4a7f-bf4a-1f2b4849518a" type="video/mp4" />
            </video>
            {/* Dark Scrim & Top/Bottom Transitions */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/30 to-black/80" />
          </div>

          {/* Section Hero Content */}
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            {/* Punchy Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] text-xs font-semibold text-[#38bdf8] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse"></span>
              <span>NO APPS NEEDED • WORKS IN YOUR CAMERA</span>
            </div>

            {/* Bold punchline heading */}
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white leading-[1.05]">
              Touch the fabric.<br />
              <span className="bg-gradient-to-r from-[#38bdf8] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
                Wear the future.
              </span>
            </h1>

            {/* Concise layman's proposition */}
            <p className="text-lg sm:text-2xl text-[#d4d4d8] max-w-2xl mx-auto font-normal leading-relaxed drop-shadow-md">
              High-end luxury streetwear that comes alive on your phone. Change your look anytime without buying new clothes.
            </p>

            {/* Punchy Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a
                href="#collection"
                onClick={(e) => scrollToSection(e, '#collection')}
                className="px-7 py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-[#f5f5f7]/90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.25)] flex items-center gap-2 cursor-pointer"
              >
                <span>Shop the Collection</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </a>

              <a
                href="#studio"
                onClick={(e) => scrollToSection(e, '#studio')}
                className="px-7 py-3.5 rounded-full border border-white/[0.25] text-white font-semibold text-sm hover:bg-white/[0.1] backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>See in 3D</span>
                <span className="material-symbols-outlined text-base">3d_rotation</span>
              </a>
            </div>
          </div>

          {/* Hero Featured Visual Frame (at least 500px height) */}
          <div className="w-full max-w-6xl mx-auto mt-16 relative z-10 px-4">
            <div className="relative min-h-[500px] h-[520px] md:h-[560px] rounded-3xl overflow-hidden border border-white/[0.15] bg-[#0d0d10]/85 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] group">
              <img
                src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/bg-2.png?alt=media&token=a804ed50-f54b-4c41-843a-be9258a25741"
                alt="Aether Trench Coat"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
              />

              {/* Floating caption card */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-8 sm:p-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#38bdf8]">
                    FLAGSHIP PIECE
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Aether Trench in Titanium
                  </h3>
                  <p className="text-sm text-[#a1a1aa] max-w-lg leading-relaxed">
                    Heavyweight waterproof carbon twill with floating 3D rings in your phone camera.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/ar/aether-chrono-trench"
                    className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">view_in_ar</span>
                    <span>Try on in Camera</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAddToBag(CURATED_COLLECTION[0])}
                    className="px-5 py-2.5 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white text-xs font-semibold transition-all shadow-md cursor-pointer"
                  >
                    Add to Bag
                  </button>
                  {isSandboxMode && (
                    <button
                      type="button"
                      onClick={() => handleSandboxBuy(CURATED_COLLECTION[0])}
                      className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title={`Send a ${activeGateway === 'stripe' ? 'Stripe' : 'PayPal'} Sandbox purchase for ${CURATED_COLLECTION[0].name} at $${CURATED_COLLECTION[0].price.toFixed(2)}`}
                    >
                      <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                      <span>Sandbox Buy • ${CURATED_COLLECTION[0].price.toFixed(2)}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEDICATED COVER-STYLE PARALLAX BACKGROUND SECTION 1 (at least 500px height) */}
        {/* Punchy Statement: One jacket, infinite looks (Asset: 3dart/1.jpg)          */}
        {/* ========================================================================= */}
        <section
          ref={cover1SectionRef}
          className="relative min-h-[500px] h-[520px] md:h-[580px] flex items-center justify-center text-center px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Background Layer (at least 500px height) */}
          <div
            ref={cover1BgRef}
            className="absolute -top-[25%] -left-[5%] w-[110%] min-h-[500px] h-[150%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/1.jpg"
              alt="Live 3D Lighting"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.45] contrast-[1.2]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/35 to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.65)_100%)]" />
          </div>

          <div className="max-w-3xl mx-auto space-y-4 relative z-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-semibold tracking-wider uppercase text-[#38bdf8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
              YOUR STYLE, YOUR RULES
            </span>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              One jacket.<br />
              <span className="text-[#a1a1aa]">Infinite looks.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#d4d4d8] max-w-lg mx-auto font-normal leading-relaxed">
              Change what your clothing displays anytime from your phone. No apps to install. Just open your camera.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: HOW IT WORKS (BENTO GRID - CONCISE & LAYMANS)                  */}
        {/* Full-Bleed Cover Parallax Background: 3dart/1.jpg (at least 500px height)  */}
        {/* ========================================================================= */}
        <section
          ref={expSectionRef}
          id="experience"
          className="relative min-h-[500px] py-36 px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Cover-Style Parallax Background Container (at least 500px height) */}
          <div
            ref={expBgRef}
            className="absolute -top-[20%] -left-[5%] w-[110%] min-h-[500px] h-[140%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/1.jpg"
              alt="3D Apparel Hologram"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.32] contrast-[1.2]"
            />
            {/* Cybernetic Scanline Matrix Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-black" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black" />
          </div>

          <div className="max-w-7xl mx-auto space-y-16 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-semibold tracking-widest uppercase text-[#2997ff]">
                HOW IT WORKS
              </span>
              <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
                Physical luxury.<br />
                <span className="text-[#a1a1aa]">Digital magic.</span>
              </h2>
              <p className="text-base sm:text-lg text-[#a1a1aa]">
                Premium streetwear that connects to your phone camera in real time.
              </p>
            </div>

            {/* Apple Bento Feature Cards with Clear Layman's Explanations */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Bento Card 1: Change on the fly */}
              <div className="md:col-span-8 rounded-3xl p-8 sm:p-12 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] relative overflow-hidden flex flex-col justify-between min-h-[420px] group shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="relative z-10 max-w-lg space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#2997ff]">
                    CHANGE ON THE FLY
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Switch designs in seconds.
                  </h3>
                  <p className="text-base text-[#a1a1aa] leading-relaxed">
                    Your jacket stays on, your style evolves. Pick new 3D visual effects directly from your phone anytime without buying another piece of clothing.
                  </p>
                </div>

                <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-30 md:opacity-60 pointer-events-none overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-l from-transparent via-[#2997ff]/10 to-[#121214] absolute inset-0 z-10" />
                  <img
                    src="https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80"
                    alt="Changeable styles"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                </div>

                <div className="relative z-10 pt-8 flex items-center gap-2 text-xs text-[#a1a1aa]">
                  <span className="w-2 h-2 rounded-full bg-[#2997ff] animate-pulse"></span>
                  <span>Unlimited look swaps • Always in your control</span>
                </div>
              </div>

              {/* Bento Card 2: Fresh Drops */}
              <div className="md:col-span-4 rounded-3xl p-8 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[420px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#a855f7]">
                    ALWAYS FRESH
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    New drops sent to your phone.
                  </h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    Brands push new seasonal animations directly to your clothing over the air. You get fresh styles without paying for another reprint.
                  </p>
                </div>

                <div className="pt-6 border-t border-white/[0.08] space-y-1">
                  <div className="text-xl font-bold text-white tracking-tight">Zero Waste</div>
                  <p className="text-xs text-[#a1a1aa]">New collections drop straight to your existing clothes.</p>
                </div>
              </div>

              {/* Bento Card 3: 1-of-1 Custom */}
              <div className="md:col-span-4 rounded-3xl p-8 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[360px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#f43f5e]">
                    MADE FOR YOU
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Truly one-of-a-kind.
                  </h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    Unlock custom 1-of-1 animations made just for you that nobody else in the world has on their clothes.
                  </p>
                </div>

                <div className="text-xs text-[#f43f5e] font-semibold">
                  Personal 1-of-1 Custom Design
                </div>
              </div>

              {/* Bento Card 4: Try Before You Buy */}
              <div className="md:col-span-8 rounded-3xl p-8 sm:p-12 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[360px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3 max-w-lg">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#10b981]">
                    TRY BEFORE YOU BUY
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    See it on before you order.
                  </h3>
                  <p className="text-base text-[#a1a1aa] leading-relaxed">
                    Inspect how the fabric drapes, fits, and lights up in full 3D right in your phone browser. Zero guesswork. Zero return hassle.
                  </p>
                </div>

                <div className="pt-6 flex flex-wrap gap-3 text-xs text-[#a1a1aa]">
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Full 360° View</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Live Phone Camera Try-On</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Apple Vision Pro Ready</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEDICATED COVER-STYLE PARALLAX BACKGROUND SECTION 2 (at least 500px height) */}
        {/* Punchy: Just point your camera (Asset: 3dart/video-background.png)         */}
        {/* ========================================================================= */}
        <section
          ref={cover2SectionRef}
          className="relative min-h-[500px] h-[520px] md:h-[580px] flex items-center justify-center text-center px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Background Layer (at least 500px height) */}
          <div
            ref={cover2BgRef}
            className="absolute -top-[25%] -left-[5%] w-[110%] min-h-[500px] h-[150%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/video-background.png"
              alt="Lighting Horizon"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.40] contrast-[1.2]"
            />
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover mix-blend-color-dodge opacity-25"
            >
              <source src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fshirt%2Fkeep-it-going.mov?alt=media&token=cad5f38d-e4c0-4a7f-bf4a-1f2b4849518a" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black" />
          </div>

          <div className="max-w-3xl mx-auto space-y-4 relative z-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-semibold tracking-wider uppercase text-[#a855f7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse"></span>
              ZERO HASSLE
            </span>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              Just point your camera.
            </h2>
            <p className="text-base sm:text-lg text-[#d4d4d8] max-w-md mx-auto font-normal leading-relaxed">
              No app store. No downloads. No sign-ups. Works instantly in your mobile web browser.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: 360° INTERACTIVE STUDIO (CONCISE & LAYMANS)                     */}
        {/* Full-Bleed Cover Parallax Background: 3dart/video-background.png           */}
        {/* ========================================================================= */}
        <section
          ref={studioSectionRef}
          id="studio"
          className="relative min-h-[500px] py-32 px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Cover-Style Parallax Background Container (at least 500px height) */}
          <div
            ref={studioBgRef}
            className="absolute -top-[20%] -left-[5%] w-[110%] min-h-[500px] h-[140%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/video-background.png"
              alt="Studio Backdrop"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.32] contrast-[1.2]"
            />
            {/* Live Video Ambiance Layer */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover mix-blend-color-dodge opacity-25"
            >
              <source src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fshirt%2Fkeep-it-going.mov?alt=media&token=cad5f38d-e4c0-4a7f-bf4a-1f2b4849518a" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/65 to-black" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black" />
          </div>

          <div className="max-w-7xl mx-auto space-y-12 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-semibold tracking-widest uppercase text-[#2997ff]">
                INTERACTIVE 3D
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                The 360° Fitting Room.
              </h2>
              <p className="text-sm sm:text-base text-[#a1a1aa]">
                Drag to rotate. Zoom in. Inspect the fabric quality, stitching, and 3D lighting up close before you decide.
              </p>
            </div>

            {/* Product Switcher Pills */}
            <div className="flex justify-center flex-wrap gap-2">
              {collectionList.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProduct(item)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer backdrop-blur-md ${selectedProduct?.id === item.id
                    ? 'bg-white text-black shadow-lg font-semibold'
                    : 'bg-[#121214]/90 text-[#a1a1aa] hover:text-white border border-white/[0.1]'
                    }`}
                >
                  {item.name || item.id}
                </button>
              ))}
            </div>

            {/* 3D Stage & Details Sidecar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Three.js 3D Viewport with data-lenis-prevent */}
              <div
                data-lenis-prevent
                className="lg:col-span-8 min-h-[500px] h-[540px] rounded-3xl overflow-hidden border border-white/[0.15] bg-[#000000]/90 backdrop-blur-2xl relative shadow-[0_30px_80px_rgba(0,0,0,0.9)]"
              >
                <ProductViewer
                  modelUrl={activeModelUrl}
                  videoUrl={activeVideoUrl || selectedProduct?.video_url || selectedProduct?.videoUrl || ''}
                  config={selectedProduct?.ar_config || {}}
                  assetName={selectedProduct?.name || selectedProduct?.id}
                  assetId={selectedProduct?.id}
                />
              </div>

              {/* Sidecar: Product Specs & Quick Buy */}
              <div className="lg:col-span-4 rounded-3xl p-8 bg-[#121214]/90 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between h-full min-h-[540px] space-y-6 shadow-[0_30px_80px_rgba(0,0,0,0.9)]">
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold tracking-wider uppercase text-[#2997ff]">
                      {selectedProduct?.edition || 'PRO EDITION'}
                    </span>
                    <span className="text-xs text-[#86868b]">Star weAR</span>
                  </div>

                  <h3 className="text-3xl font-bold text-white tracking-tight">
                    {selectedProduct?.name || selectedProduct?.id}
                  </h3>

                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    {selectedProduct?.heroDescription || selectedProduct?.description}
                  </p>

                  {/* Highlights Bullet List */}
                  {selectedProduct?.highlights && selectedProduct.highlights.length > 0 && (
                    <div className="pt-4 border-t border-white/[0.08] space-y-3">
                      {selectedProduct.highlights.map((hl, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs">
                          <span className="material-symbols-outlined text-[#2997ff] text-base shrink-0 mt-0.5">check_circle</span>
                          <div>
                            <span className="font-semibold text-white block">{hl.title}</span>
                            <span className="text-[#a1a1aa] leading-relaxed">{hl.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Color Finish Selector */}
                  {selectedProduct?.colors && selectedProduct.colors.length > 0 && (
                    <div className="pt-4 border-t border-white/[0.08] space-y-2">
                      <span className="text-xs text-[#a1a1aa] font-medium block">
                        Color: <span className="text-white font-semibold">{selectedColors[selectedProduct.id] || selectedProduct.colors[0].name}</span>
                      </span>
                      <div className="flex gap-2">
                        {selectedProduct.colors.map((c) => {
                          const isSelected = (selectedColors[selectedProduct.id] || selectedProduct.colors[0].name) === c.name;
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => setSelectedColors(prev => ({ ...prev, [selectedProduct.id]: c.name }))}
                              style={{ backgroundColor: c.hex }}
                              className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative ${isSelected ? 'ring-2 ring-[#2997ff] ring-offset-2 ring-offset-[#121214] scale-110' : 'hover:scale-105'
                                }`}
                              title={c.name}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pricing & Add to Bag */}
                <div className="pt-6 border-t border-white/[0.08] space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-[#86868b]">Price</span>
                    <span className="text-2xl font-bold text-white">
                      ${(selectedProduct?.price !== undefined ? Number(selectedProduct.price) : 280.00).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddToBag(selectedProduct)}
                      className="flex-1 py-3.5 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">shopping_bag</span>
                      <span>Add To Cart</span>
                    </button>

                    <a
                      href={`/ar/${selectedProduct?.id}`}
                      className="px-4 py-3.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] border border-white/[0.15] text-white transition-all flex items-center justify-center cursor-pointer"
                      title="Launch Phone Camera Try-On"
                    >
                      <span className="material-symbols-outlined text-lg">view_in_ar</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEDICATED COVER-STYLE PARALLAX BACKGROUND SECTION 3 (at least 500px height) */}
        {/* Punchy: Physical clothes. Digital clone. (Asset: 3dart/3.jpg)             */}
        {/* ========================================================================= */}
        <section
          ref={cover3SectionRef}
          className="relative min-h-[500px] h-[520px] md:h-[580px] flex items-center justify-center text-center px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Background Layer (at least 500px height) */}
          <div
            ref={cover3BgRef}
            className="absolute -top-[25%] -left-[5%] w-[110%] min-h-[500px] h-[150%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/3.jpg"
              alt="Tabletop Hologram"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.40] contrast-[1.2]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black" />
          </div>

          <div className="max-w-3xl mx-auto space-y-4 relative z-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-semibold tracking-wider uppercase text-[#10b981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              DUAL REALITY
            </span>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              Physical clothes.<br />
              <span className="text-[#a1a1aa]">Digital clone.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#d4d4d8] max-w-md mx-auto font-normal leading-relaxed">
              Wear it in real life, and equip your 3D clone in Apple Vision Pro, video games, or your phone.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: THE COLLECTION (CLEAR & DIRECT)                                */}
        {/* Full-Bleed Cover Parallax Background: 3dart/3.jpg (at least 500px height)  */}
        {/* ========================================================================= */}
        <section
          ref={collectionSectionRef}
          id="collection"
          className="relative min-h-[500px] py-36 px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Cover-Style Parallax Background Container (at least 500px height) */}
          <div
            ref={collectionBgRef}
            className="absolute -top-[20%] -left-[5%] w-[110%] min-h-[500px] h-[140%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/3.jpg"
              alt="Spatial Collection Reality"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.30] contrast-[1.2]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/65 to-black" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/45 to-black" />
          </div>

          <div className="max-w-7xl mx-auto space-y-16 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/[0.08] pb-8">
              <div className="space-y-2">
                <span className="text-xs font-semibold tracking-widest uppercase text-[#2997ff]">
                  THE 2026 LINE
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                  Pick your piece.
                </h2>
                <p className="text-sm sm:text-base text-[#a1a1aa]">
                  Includes premium physical garment, free express shipping, and instant camera effects.
                </p>
              </div>

              <div className="text-xs text-[#a1a1aa] font-medium">
                Showing {collectionList.length} items
              </div>
            </div>

            {/* Product Shelf Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {collectionList.map((product) => {
                const price = product.price !== undefined ? Number(product.price) : 280.00;
                const selectedSize = selectedSizes[product.id] || 'M';
                const currentColor = selectedColors[product.id] || product.colors?.[0]?.name;

                return (
                  <article
                    key={product.id}
                    className="rounded-3xl bg-[#121214]/90 backdrop-blur-2xl border border-white/[0.12] hover:border-white/[0.3] transition-all duration-500 overflow-hidden flex flex-col justify-between group shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
                  >
                    <div className="p-6 sm:p-8 space-y-6">
                      {/* Top Eyebrow & Badges */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#86868b] uppercase tracking-wider font-semibold text-[10px]">
                          {product.edition || 'PRO EDITION'}
                        </span>
                        <span className="text-[#2997ff] font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                          Camera Ready
                        </span>
                      </div>

                      {/* Image Preview with Subtle Hover Scale */}
                      <div
                        onClick={() => {
                          setSelectedProduct(product);
                          const el = document.getElementById('studio');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#0d0d10] relative cursor-pointer group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all"
                      >
                        {product.imageUrl || product.image || product.target_image_url ? (
                          <img
                            src={product.imageUrl || product.image || product.target_image_url}
                            alt={product.name || product.id}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#86868b]">
                            <span className="material-symbols-outlined text-4xl text-[#2997ff]">view_in_ar</span>
                            <span className="text-xs font-semibold text-white">3D Interactive</span>
                          </div>
                        )}

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                          <span className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-lg flex items-center gap-1.5">
                            <span>Inspect in 360°</span>
                            <span className="material-symbols-outlined text-sm">3d_rotation</span>
                          </span>
                        </div>
                      </div>

                      {/* Color Swatch Dots */}
                      {product.colors && product.colors.length > 0 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                          {product.colors.map(col => (
                            <button
                              key={col.name}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedColors(prev => ({ ...prev, [product.id]: col.name }));
                              }}
                              style={{ backgroundColor: col.hex }}
                              className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${currentColor === col.name ? 'ring-2 ring-[#2997ff] ring-offset-2 ring-offset-[#121214] scale-125' : 'hover:scale-110'
                                }`}
                              title={col.name}
                            />
                          ))}
                        </div>
                      )}

                      {/* Title & Tagline */}
                      <div className="text-center space-y-1.5">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                          {product.name || product.id}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#a1a1aa] line-clamp-2">
                          {product.tagline || product.heroDescription || product.description}
                        </p>
                      </div>

                      {/* Size Selector Pills */}
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {['S', 'M', 'L', 'XL'].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSizes(prev => ({ ...prev, [product.id]: sz }));
                            }}
                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectedSize === sz
                              ? 'bg-white text-black shadow-sm'
                              : 'bg-white/[0.08] text-[#a1a1aa] hover:text-white'
                              }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card Bottom: Price & Buy Pill */}
                    <div className="p-6 sm:p-8 pt-0 flex items-center justify-between border-t border-white/[0.08]">
                      <div>
                        <span className="text-[11px] text-[#86868b] block">From</span>
                        <span className="text-xl font-bold text-white">${price.toFixed(2)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/ar/${product.id}`}
                          className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[#a1a1aa] hover:text-white transition-colors"
                          title="Try on in Phone Camera"
                        >
                          <span className="material-symbols-outlined text-base">view_in_ar</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleAddToBag(product)}
                          className="px-4 py-2 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Add To Cart</span>
                        </button>

                        {isSandboxMode && (
                          <button
                            type="button"
                            onClick={() => handleSandboxBuy(product)}
                            className="px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                            title={`Send a ${activeGateway === 'stripe' ? 'Stripe' : 'PayPal'} Sandbox purchase for ${product.name} at $${price.toFixed(2)}`}
                          >
                            <span className="material-symbols-outlined text-xs">shopping_cart_checkout</span>
                            <span>Sandbox Buy • ${price.toFixed(2)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: PROMISES & GUARANTEE (CLEAR & DIRECT)                           */}
        {/* Full-Bleed Cover Parallax Background: 3dart/2.avif (at least 500px height) */}
        {/* ========================================================================= */}
        <section
          ref={valuesSectionRef}
          className="relative min-h-[500px] py-32 px-6 overflow-hidden border-t border-white/[0.08]"
        >
          {/* Cover-Style Parallax Background Container (at least 500px height) */}
          <div
            ref={valuesBgRef}
            className="absolute -top-[20%] -left-[5%] w-[110%] min-h-[500px] h-[140%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/2.avif"
              alt="Spatial Guarantee"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.22] contrast-[1.25]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/75 to-black" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/50 to-black" />
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12 text-center relative z-10">

            {/* Promise 1 */}
            <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#2997ff] flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
              <h4 className="text-base font-semibold text-white">Free Express Shipping</h4>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Every piece ships free worldwide in a custom climate-sealed case via express courier.
              </p>
            </div>

            {/* Promise 2 */}
            <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#a855f7] flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-2xl">bolt</span>
              </div>
              <h4 className="text-base font-semibold text-white">No App Required</h4>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Open your phone's camera in Safari or Chrome and it works instantly. No App Store downloads ever.
              </p>
            </div>

            {/* Promise 3 */}
            <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#10b981] flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-2xl">autorenew</span>
              </div>
              <h4 className="text-base font-semibold text-white">30-Day Easy Returns</h4>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Test the fit, feel the fabric, and try the camera effects. If you don't love it, returns are free.
              </p>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* REFINED APPLE-STYLE FOOTER                                                */}
        {/* ========================================================================= */}
        <footer className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.08] text-xs text-[#86868b] space-y-8 bg-black/80 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Star weAR</span>
              <span className="text-xs text-[#86868b]">— Smart Luxury Streetwear. Powered by 4D4 Technologies.</span>
            </div>

            <div className="flex flex-wrap gap-6 text-xs text-[#86868b]">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <Link to="/shop" className="text-white font-medium transition-colors">Shop</Link>
              <Link to="/collections" className="hover:text-white transition-colors">Collections</Link>
              <Link to="/cart" className="hover:text-white transition-colors">Bag ({getCartCount()})</Link>
              {(isAdmin || isSuperAdmin) && (
                <Link to="/admin/inventory" className="hover:text-white transition-colors">Admin</Link>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px]">
            <div>
              Copyright © 2026 Star weAR Inc. All rights reserved. 3D camera effects run natively in mobile web browsers.
            </div>
            <div className="flex gap-4">
              <span className="hover:text-white cursor-pointer">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Terms of Sale</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Legal</span>
            </div>
          </div>
        </footer>
      </div>
    </ReactLenis>
  );
}
