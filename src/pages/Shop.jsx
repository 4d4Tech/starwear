import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { ReactLenis, useLenis } from 'lenis/react';
import { db, storage } from '../firebase';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import Model3DThumbnail from '../components/Model3DThumbnail';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';

// Curated Collection with grounded, relatable copy from verbiage.md
export const CURATED_COLLECTION = [
  {
    id: 'aether-chrono-trench',
    name: 'Aether Trench',
    edition: 'OPEN CHOTHING ITEM • PRO EDITION',
    tagline: 'Waterproof carbon twill chothing item. Volumetric light rings.',
    heroDescription: 'An architectural coat tailored from waterproof carbon twill. Volumetric light rings float around your frame the moment someone looks through a browser camera—no apps, no hurdles.',
    price: 280.00,
    colors: [
      { name: 'Titanium Silver', hex: '#d1d5db', border: '#9ca3af' },
      { name: 'Obsidian Black', hex: '#18181b', border: '#3f3f46' },
      { name: 'Aether Cyan', hex: '#38bdf8', border: '#0284c7' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-jackets-hoodie_v2.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/jackets/hoodie_v2.glb',
    detailImages: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80'
    ],
    highlights: [
      { title: 'Swappable Frequency', desc: 'Floating light rings track your natural motion in real time.' },
      { title: 'Waterproof Carbon Twill', desc: 'Heavyweight 480 GSM fabric foundation built to endure years of wear.' },
      { title: 'Zero-Friction Web Delivery', desc: 'Renders instantly in mobile Safari and Chrome without an app install.' }
    ],
    featureBadge: {
      title: 'Browser-Native Freedom',
      copy: 'No app stores. No hurdles. Just open your camera and watch your style unfold directly on screen.',
      cli: '$ antigravity preview --zero-friction'
    },
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
    edition: 'OPEN CLOTHES ITEM • STUDIO DROP',
    tagline: 'Ultra-dense black fleece. Living fluid skin.',
    heroDescription: 'Heavyweight 500 GSM organic cotton clothes item. The chest transforms into a living, swappable canvas with dynamic fluid light directly in your phone camera.',
    price: 195.00,
    colors: [
      { name: 'Space Black', hex: '#09090b', border: '#27272a' },
      { name: 'Deep Ultraviolet', hex: '#581c87', border: '#7e22ce' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-jackets-hoodie.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/jackets/hoodie.glb',
    detailImages: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
    ],
    highlights: [
      { title: 'Living Visual Surface', desc: 'Dynamic fluid visual skins projected directly onto the chest.' },
      { title: 'Heavyweight French Terry', desc: 'Durable, velvety organic cotton that holds its structure and drape.' },
      { title: 'Swappable at Will', desc: 'Switch artwork from your Digital Closet whenever your mood shifts.' }
    ],
    featureBadge: {
      title: 'Swappable Frequency',
      copy: 'Never get tired of a piece. Switch out artwork from your personal Digital Closet whenever you want a fresh vibe.',
      cli: '$ antigravity closet --equip "ACTIVE_VIBE"'
    },
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
    edition: 'OPEN CLOTHES ITEM • COUTURE DROP',
    tagline: 'Japanese origami folds. Floating light ribbons.',
    heroDescription: 'A modern oversized robe combining architectural folds with floating dynamic light ribbons that trail your movement through the browser camera.',
    price: 340.00,
    colors: [
      { name: 'Pure Chalk', hex: '#f4f4f5', border: '#e4e4e7' },
      { name: 'Obsidian Slate', hex: '#1e293b', border: '#334155' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-shirts-casual_shirt.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/shirts/casual_shirt.glb',
    detailImages: [],
    highlights: [
      { title: 'Dynamic Light Trails', desc: 'Weightless light ribbons contour your movement as you walk.' },
      { title: 'Bespoke Asterisk (*) Override', desc: 'Your custom 1-of-1 aesthetic supersedes generic batch visuals.' },
      { title: 'Numbered Artisan Run', desc: 'Small-batch clothes item accompanied by cryptographically verified provenance.' }
    ],
    featureBadge: {
      title: 'Bespoke Asterisk Override',
      copy: 'Your private 1-of-1 signature. When the camera reads your custom marker, batch templates yield to your personal expression.',
      cli: '$ antigravity override --target bespoke'
    },
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
    edition: 'OPEN CLOTHES ITEM • TECHNICAL FOUNDATION',
    tagline: 'Ballistic nylon clothes item. Reactive color skin.',
    heroDescription: 'Windproof ballistic shell with magnetic hardware. Shimmering color-reactive skins shift in real time with ambient sunlight and street illumination.',
    price: 220.00,
    colors: [
      { name: 'Stealth Noir', hex: '#111827', border: '#1f2937' },
      { name: 'Tactical Olive', hex: '#365314', border: '#4d7c0f' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-jackets-hoodie-1.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/jackets/hoodie%20(1).glb',
    detailImages: [],
    highlights: [
      { title: 'Living Color Shift', desc: 'Dynamic skins that adapt to daylight and neon street illumination.' },
      { title: 'Ballistic Fabric Foundation', desc: 'Rugged weather-resistant nylon engineered for everyday street wear.' },
      { title: 'Zero-Friction Sharing', desc: 'Anyone pointing a camera sees your live skin unfold without downloading an app.' }
    ],
    featureBadge: {
      title: 'Zero-Guesswork Preview',
      copy: 'Check the fit and dynamic movement in real time on your own frame before checking out.',
      cli: '$ antigravity preview --realtime-mesh'
    },
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
    edition: 'OPEN CLOTHES ITEM • ATELIER DROP',
    tagline: 'Liquid cyber-mesh. Refractive light prisms.',
    heroDescription: 'Zero-gravity drape that refracts radiant light filaments as you move. A liberated clothes item that turns every street and venue into a dynamic runway.',
    price: 410.00,
    colors: [
      { name: 'Liquid Opal', hex: '#e0f2fe', border: '#bae6fd' },
      { name: 'Midnight Onyx', hex: '#09090b', border: '#27272a' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-shirts-white_t-shirt_with_print.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/shirts/white_t-shirt_with_print.glb',
    detailImages: [],
    highlights: [
      { title: 'Prismatic Light Refraction', desc: 'Casts living light filaments responsive to real-world movement.' },
      { title: 'Smooth 60 FPS Fluidity', desc: 'Real-time spatial cloth dynamics running natively in any mobile browser.' },
      { title: 'Dual Spatial Presence', desc: 'Wear the physical piece in real life, or project your clone in spatial environments.' }
    ],
    featureBadge: {
      title: 'Swappable Frequency',
      copy: 'Never get tired of a piece. Switch out artwork from your personal Digital Closet whenever you want a fresh vibe.',
      cli: '$ antigravity closet --equip "ACTIVE_VIBE"'
    },
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
    edition: 'OPEN CLOTHES ITEM • MODULAR FOUNDATION',
    tagline: 'Tactical utility harness. Floating holographic emblem.',
    heroDescription: 'Modular utility vest with magnetic quick-release hardware. Projects floating geometric matrix skins and your personal 1-of-1 emblem in camera view.',
    price: 165.00,
    colors: [
      { name: 'Titanium Graphite', hex: '#27272a', border: '#52525b' },
      { name: 'Alpine White', hex: '#f8fafc', border: '#cbd5e1' }
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=85',
    thumbnailUrl: '/thumbnails/clothes-shirts-standard_t-shirt.png',
    model_url: 'https://storage.googleapis.com/3dtemplates/clothes/shirts/standard_t-shirt.glb',
    detailImages: [],
    highlights: [
      { title: 'Magnetic Hardware', desc: 'Quick-release magnetic closures secured to high-tensile webbing.' },
      { title: 'Floating Holographic Emblem', desc: 'Sharp geometric insignia hovering cleanly in phone camera view.' },
      { title: 'Weatherproof Canvas', desc: 'Reinforced ballistic textile clothes item crafted for long-haul durability.' }
    ],
    featureBadge: {
      title: 'Browser-Native Freedom',
      copy: 'No app stores. No hurdles. Just open your camera and watch your style unfold directly on screen.',
      cli: '$ antigravity preview --zero-friction'
    },
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
  useLenis(() => {
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
      image: product.thumbnailUrl || product.imageUrl || product.image || product.target_image_url || '',
      thumbnailUrl: product.thumbnailUrl || '',
      modelUrl: product.model_url || product.glb_url || product.modelUrl || product.gltf_file_path || '',
      category: product.category || 'Apparel',
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
        {/* CLI ACCENT STICKY SUB-NAVIGATION BAR                                      */}
        {/* ========================================================================= */}
        <div
          ref={subNavRef}
          className="sticky top-20 z-40 w-full bg-[#000000]/85 backdrop-blur-xl border-b border-white/[0.08] transition-all"
        >
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white font-mono">$ antigravity</span>
              <span className="text-xs text-[#86868b] hidden sm:inline font-mono">• open-canvas</span>
            </div>

            <div className="flex items-center gap-3 sm:gap-6 text-xs text-[#86868b]">
              <a
                href="#overview"
                onClick={(e) => scrollToSection(e, '#overview')}
                className={`transition-colors hover:text-white ${activeSubTab === 'overview' ? 'text-white font-medium' : ''}`}
              >
                Overview
              </a>
              <a
                href="#canvas-explainer"
                onClick={(e) => scrollToSection(e, '#canvas-explainer')}
                className={`transition-colors hover:text-white ${activeSubTab === 'canvas-explainer' ? 'text-white font-medium' : ''}`}
              >
                Living Canvas
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
                clothes item Drops
              </a>

              <a
                href="#collection"
                onClick={(e) => scrollToSection(e, '#collection')}
                className="bg-[#2997ff] hover:bg-[#0077ed] text-white px-3.5 py-1.5 rounded-full font-semibold transition-all shadow-sm flex items-center gap-1 cursor-pointer font-mono"
              >
                <span>[ CLAIM ]</span>
              </a>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: HERO - GROUNDED CLARITY & HIGH-AGENCY EXPRESSION               */}
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
            {/* CLI Accent Syntax Header from verbiage.md Section 3.1 */}
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/[0.12] text-xs font-mono text-neutral-300 shadow-xl">
              <span className="text-[#38bdf8] font-bold">$ antigravity run --mode open-canvas</span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                [STATUS: READY] YOUR WARDROBE IS NOW LIVE.
              </span>
            </div>

            {/* Bold Headline from verbiage.md Section 3.1 */}
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white leading-[1.05]">
              Clothes that move as fast as <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#38bdf8] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
                your mood.
              </span>
            </h1>

            {/* Subhead from verbiage.md Section 3.1 */}
            <p className="text-lg sm:text-2xl text-[#d4d4d8] max-w-2xl mx-auto font-normal leading-relaxed drop-shadow-md">
              Static graphics freeze who you were the day you bought them. We build garments that stay open—giving you a living, boundary-free canvas to swap artwork, drop 3D visuals, and project whatever version of yourself you want to show the world today.
            </p>

            {/* Action CTAs from verbiage.md Section 3.1 */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a
                href="#collection"
                onClick={(e) => scrollToSection(e, '#collection')}
                className="px-8 py-3.5 rounded-full bg-white text-black font-bold text-sm hover:bg-[#f5f5f7]/90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.25)] flex items-center gap-2 cursor-pointer font-mono"
              >
                <span>[ BROWSE CLOTHES ITEM PIECES ]</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </a>

              <a
                href="#studio"
                onClick={(e) => scrollToSection(e, '#studio')}
                className="px-8 py-3.5 rounded-full border border-white/[0.25] text-white font-semibold text-sm hover:bg-white/[0.1] backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer font-mono"
              >
                <span>[ OPEN DIGITAL CLOSET ]</span>
                <span className="material-symbols-outlined text-base">view_in_ar</span>
              </a>
            </div>
          </div>

          {/* Hero Featured Visual Frame */}
          <div className="w-full max-w-6xl mx-auto mt-16 relative z-10 px-4">
            <div className="relative min-h-[500px] h-[520px] md:h-[560px] rounded-3xl overflow-hidden border border-white/[0.15] bg-[#0d0d10]/85 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] group">
              <img
                src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/bg-2.png?alt=media&token=a804ed50-f54b-4c41-843a-be9258a25741"
                alt="Aether Trench Coat"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
              />

              {/* Floating caption card */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-8 sm:p-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold uppercase tracking-widest text-[#38bdf8]">
                      FLAGSHIP PHYSICAL CLOTHES ITEM
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      $ antigravity preview --zero-friction
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Aether Trench in Titanium
                  </h3>
                  <p className="text-sm text-[#a1a1aa] max-w-lg leading-relaxed">
                    Heavyweight waterproof carbon twill fabric foundation equipped with swappable volumetric light rings. No app store downloads required.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/ar/aether-chrono-trench"
                    className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer font-mono"
                  >
                    <span className="material-symbols-outlined text-sm">view_in_ar</span>
                    <span>Camera Try-On</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAddToBag(CURATED_COLLECTION[0])}
                    className="px-5 py-2.5 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white text-xs font-semibold transition-all shadow-md cursor-pointer font-mono"
                  >
                    Claim clothes item
                  </button>
                  {isSandboxMode && (
                    <button
                      type="button"
                      onClick={() => handleSandboxBuy(CURATED_COLLECTION[0])}
                      className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 font-mono"
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
        {/* DEDICATED COVER-STYLE PARALLAX SECTION 1: THE BIG PICTURE EXPLAINER       */}
        {/* Implements verbiage.md Section 3.2 (Asset: 3dart/1.jpg - min-h-[500px])    */}
        {/* ========================================================================= */}
        <section
          ref={cover1SectionRef}
          id="canvas-explainer"
          className="relative min-h-[500px] py-28 md:py-36 flex items-center justify-center px-6 overflow-hidden border-b border-white/[0.08]"
        >
          {/* Background Layer (at least 500px height) */}
          <div
            ref={cover1BgRef}
            className="absolute -top-[25%] -left-[5%] w-[110%] min-h-[500px] h-[150%] pointer-events-none z-0 will-change-transform"
          >
            <img
              src="/3dart/1.jpg"
              alt="Live 3D Lighting"
              className="w-full h-full object-cover object-center scale-105 filter brightness-[0.38] contrast-[1.2]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/55 to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.65)_100%)]" />
          </div>

          <div className="max-w-4xl mx-auto space-y-8 relative z-10 text-center">
            {/* CLI Accent Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-mono text-[#38bdf8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
              <span>$ antigravity explain --philosophy &quot;open-canvas&quot;</span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              One shirt.<br />
              <span className="bg-gradient-to-r from-white via-[#d4d4d8] to-[#9ca3af] bg-clip-text text-transparent">
                Endless expressions.
              </span>
            </h2>

            <div className="space-y-4 max-w-2xl mx-auto text-[#d4d4d8] text-base sm:text-lg leading-relaxed">
              <p className="font-medium text-white/95">
                Think about regular clothes: once the ink dries on cotton, that design is locked in until you throw the shirt away.
              </p>
              <p className="text-[#a1a1aa] text-sm sm:text-base">
                We design our pieces around an open, flexible foundation. Using lightweight spatial tracking right through your phone&apos;s browser, your garment transforms into an active frequency—a dynamic surface that responds to whatever skin, animated visual, or digital piece you decide to equip that morning.
              </p>
            </div>

            {/* 3 Pillars from verbiage.md Section 3.2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-left">
              <div className="p-6 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/[0.12] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono text-[#38bdf8]">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  <span>NO DOWNLOADS, EVER</span>
                </div>
                <h4 className="text-white font-bold text-sm">Browser-Native Magic</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  You or anyone around you just point a phone camera at the piece to see the art come alive directly in the browser—no third-party apps, accounts, or friction required.
                </p>
                <div className="text-[10px] font-mono text-[#38bdf8]/80 pt-1">
                  $ antigravity preview --zero-friction
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/[0.12] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono text-[#a855f7]">
                  <span className="material-symbols-outlined text-sm">view_in_ar</span>
                  <span>TRY BEFORE YOU COMMIT</span>
                </div>
                <h4 className="text-white font-bold text-sm">Zero-Guesswork Preview</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Use our mirror preview to see exactly how the 3D graphic drapes, folds, and moves across the fabric before you claim it.
                </p>
                <div className="text-[10px] font-mono text-[#a855f7]/80 pt-1">
                  $ antigravity preview --realtime-mesh
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/[0.12] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono text-[#10b981]">
                  <span className="material-symbols-outlined text-sm">stars</span>
                  <span>1-OF-1 INDIVIDUALITY</span>
                </div>
                <h4 className="text-white font-bold text-sm">Asterisk (*) Override</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  When our system spots your bespoke asterisk marker, generic crowd defaults step aside—your custom aesthetic takes center stage.
                </p>
                <div className="text-[10px] font-mono text-[#10b981]/80 pt-1">
                  $ antigravity override --target bespoke
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: HOW IT WORKS (BENTO GRID - GROUNDED NARRATIVE PILLARS)          */}
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] text-xs font-mono text-[#2997ff] uppercase">
                <span>$ antigravity flow --inspect architecture</span>
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
                Physical clothes item.<br />
                <span className="text-[#a1a1aa]">Living medium.</span>
              </h2>
              <p className="text-base sm:text-lg text-[#a1a1aa]">
                An open fabric foundation that connects to your phone camera in real time—no apps, no middlemen, zero friction.
              </p>
            </div>

            {/* Apple Bento Feature Cards with Grounded Metaphors from verbiage.md */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Bento Card 1: Pillar I - Swappable Frequency */}
              <div className="md:col-span-8 rounded-3xl p-8 sm:p-12 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] relative overflow-hidden flex flex-col justify-between min-h-[420px] group shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="relative z-10 max-w-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#2997ff]">
                      PILLAR I • SWAPPABLE FREQUENCY
                    </span>
                    <span className="text-[11px] font-mono text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded">
                      $ antigravity closet --equip &quot;ACTIVE_VIBE&quot;
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Switch designs in seconds.
                  </h3>
                  <p className="text-base text-[#a1a1aa] leading-relaxed">
                    Never get tired of a piece. Switch out artwork from your personal Digital Closet whenever you want a fresh vibe. Your physical clothes item stays on, your style evolves without buying another garment.
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
                  <span>Living Medium • Unlimited Look Swaps • Always in Your Control</span>
                </div>
              </div>

              {/* Bento Card 2: Pillar II - Direct Brand Sovereignty */}
              <div className="md:col-span-4 rounded-3xl p-8 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[420px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#a855f7]">
                      PILLAR II • BRAND SOVEREIGNTY
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 rounded w-fit">
                    $ antigravity broadcast --to street
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    The point of sale is the starting line.
                  </h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    Broadcast your vision directly to the street. Independent labels push fresh seasonal visuals straight onto garments already out in the wild over the air—no app store middlemen.
                  </p>
                </div>

                <div className="pt-6 border-t border-white/[0.08] space-y-1">
                  <div className="text-xl font-bold text-white tracking-tight">Zero Waste</div>
                  <p className="text-xs text-[#a1a1aa]">New collections drop straight to your existing clothes item pieces.</p>
                </div>
              </div>

              {/* Bento Card 3: Pillar IV - Bespoke Asterisk Override */}
              <div className="md:col-span-4 rounded-3xl p-8 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[360px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#f43f5e]">
                      PILLAR IV • BESPOKE AUTONOMY
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#f43f5e] bg-[#f43f5e]/10 px-2 py-0.5 rounded w-fit">
                    $ antigravity override --target bespoke
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Your bespoke aesthetic overrides the crowd.
                  </h3>
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    Your private 1-of-1 signature. When the camera reads your custom asterisk (*) marker, generic batch templates yield to your personal expression.
                  </p>
                </div>

                <div className="text-xs text-[#f43f5e] font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">stars</span>
                  <span>Asterisk (*) Protocol • True 1-of-1 Autonomy</span>
                </div>
              </div>

              {/* Bento Card 4: Pillar IV - Zero-Guesswork Preview */}
              <div className="md:col-span-8 rounded-3xl p-8 sm:p-12 bg-[#121214]/85 backdrop-blur-2xl border border-white/[0.12] flex flex-col justify-between min-h-[360px] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
                <div className="space-y-3 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#10b981]">
                      PILLAR IV • ZERO GUESSWORK
                    </span>
                    <span className="text-[11px] font-mono text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded">
                      $ antigravity preview --realtime-mesh
                    </span>
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    See how it drapes and folds before you commit.
                  </h3>
                  <p className="text-base text-[#a1a1aa] leading-relaxed">
                    Check the fit, weave density, and dynamic visual movement in real time on your own frame before checking out. Zero guesswork. Zero return hassle.
                  </p>
                </div>

                <div className="pt-6 flex flex-wrap gap-3 text-xs text-[#a1a1aa]">
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Full 360° Studio View</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Real-Time Phone Camera Mirror</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-white">Apple Vision Pro Ready</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DEDICATED COVER-STYLE PARALLAX SECTION 2: BROWSER-NATIVE FREEDOM          */}
        {/* Implements verbiage.md Section 3.3 Badge 1 & Pillar III (Asset: video-bg) */}
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-mono text-[#a855f7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse"></span>
              <span>$ antigravity preview --zero-friction</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              No app stores.<br />
              <span className="text-[#a1a1aa]">No hurdles.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#d4d4d8] max-w-lg mx-auto font-normal leading-relaxed">
              Point your camera and watch your style unfold. No third-party apps, no accounts to register just to view art. Pure browser-native magic for anyone looking at your piece.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: 360° INTERACTIVE STUDIO (DIGITAL CLOSET & FITTING ROOM)        */}
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] text-xs font-mono text-[#2997ff] uppercase">
                <span>$ antigravity mesh --inspect 360</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                The 360° Digital Closet &amp; Fitting Room.
              </h2>
              <p className="text-sm sm:text-base text-[#a1a1aa]">
                Drag to rotate. Zoom in. Inspect the physical clothes item, fabric weight, and dynamic skins up close before you commit.
              </p>
            </div>

            {/* Product Switcher Pills */}
            <div className="flex justify-center flex-wrap gap-2.5">
              {collectionList.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProduct(item)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer backdrop-blur-md flex items-center gap-2 ${selectedProduct?.id === item.id
                    ? 'bg-white text-black shadow-lg font-semibold scale-105'
                    : 'bg-[#121214]/90 text-[#a1a1aa] hover:text-white border border-white/[0.1] hover:bg-white/[0.08]'
                    }`}
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-black/60 border border-white/20 shrink-0 flex items-center justify-center">
                    <Model3DThumbnail
                      modelUrl={item.model_url || item.glb_url || item.modelUrl || item.gltf_file_path}
                      fallbackImageUrl={item.thumbnailUrl || item.imageUrl || item.image}
                      cleanName={item.name || item.id}
                      category={item.category}
                      badge={false}
                      interactiveOnHover={false}
                      className="w-full h-full"
                    />
                  </div>
                  <span>{item.name || item.id}</span>
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
                    <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[#2997ff]">
                      {selectedProduct?.edition || 'OPEN CLOTHES ITEM • PRO EDITION'}
                    </span>
                    <span className="text-xs text-[#86868b] font-mono">Star weAR</span>
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
                        Clothes item Finish: <span className="text-white font-semibold">{selectedColors[selectedProduct.id] || selectedProduct.colors[0].name}</span>
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
                    <span className="text-xs text-[#86868b]">Fabric Foundation &amp; Skin</span>
                    <span className="text-2xl font-bold text-white">
                      ${(selectedProduct?.price !== undefined ? Number(selectedProduct.price) : 280.00).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddToBag(selectedProduct)}
                      className="flex-1 py-3.5 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-mono"
                    >
                      <span className="material-symbols-outlined text-base">shopping_bag</span>
                      <span>Claim Clothes item Piece</span>
                    </button>

                    <a
                      href={`/ar/${selectedProduct?.id}`}
                      className="px-4 py-3.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] border border-white/[0.15] text-white transition-all flex items-center justify-center cursor-pointer"
                      title="Launch Camera Try-On"
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
        {/* DEDICATED COVER-STYLE PARALLAX SECTION 3: DUAL SPATIAL PRESENCE           */}
        {/* Implements verbiage.md Pillar IV & Dual Reality (Asset: 3dart/3.jpg)       */}
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-mono text-[#10b981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>$ antigravity clone --sync spatial</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
              Physical clothes item.<br />
              <span className="text-[#a1a1aa]">Living digital skin.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#d4d4d8] max-w-md mx-auto font-normal leading-relaxed">
              Wear the heavyweight fabric on the street. Project the dynamic 3D visuals through any browser, spatial headset, or avatar environment without friction.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: THE COLLECTION (LIBERATED CLOTHES ITEM DROPS)                       */}
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
                <div className="inline-flex items-center gap-2 text-xs font-mono text-[#2997ff] uppercase">
                  <span>$ antigravity catalog --mode open-canvas</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                  Claim your open canvas.
                </h2>
                <p className="text-sm sm:text-base text-[#a1a1aa]">
                  Every piece pairs an enduring physical clothes item with swappable, browser-native dynamic skins. Free worldwide express delivery included.
                </p>
              </div>

              <div className="text-xs text-[#a1a1aa] font-mono">
                [CATALOG: {collectionList.length} CLOTHES ITEM PIECES ACTIVE]
              </div>
            </div>

            {/* Product Shelf Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {collectionList.map((product) => {
                const price = product.price !== undefined ? Number(product.price) : 280.00;
                const selectedSize = selectedSizes[product.id] || 'M';
                const currentColor = selectedColors[product.id] || product.colors?.[0]?.name;
                const badge = product.featureBadge || {
                  title: 'Browser-Native Freedom',
                  copy: 'No app stores. No hurdles. Just open your camera and watch your style unfold directly on screen.',
                  cli: '$ antigravity preview --zero-friction'
                };

                return (
                  <article
                    key={product.id}
                    className="rounded-3xl bg-[#121214]/90 backdrop-blur-2xl border border-white/[0.12] hover:border-white/[0.3] transition-all duration-500 overflow-hidden flex flex-col justify-between group shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
                  >
                    <div className="p-6 sm:p-8 space-y-6">
                      {/* Top Eyebrow & Badges */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#86868b] uppercase tracking-wider font-mono font-semibold text-[10px]">
                          {product.edition || 'OPEN CLOTHES ITEM'}
                        </span>
                        <span className="text-[#2997ff] font-mono text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                          Browser Native
                        </span>
                      </div>

                      {/* 3D Model Thumbnail Preview with Subtle Hover Scale */}
                      <div
                        onClick={() => {
                          setSelectedProduct(product);
                          const el = document.getElementById('studio');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#0d0d10] relative cursor-pointer group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all"
                      >
                        <Model3DThumbnail
                          modelUrl={product.model_url || product.glb_url || product.modelUrl || product.gltf_file_path}
                          fallbackImageUrl={product.thumbnailUrl || product.imageUrl || product.image || product.target_image_url}
                          category={product.category}
                          cleanName={product.name || product.id}
                          className="w-full h-full"
                          aspectRatio="aspect-[4/3]"
                          badge="3D MODEL"
                        />

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs pointer-events-none">
                          <span className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-lg flex items-center gap-1.5 font-mono">
                            <span>Inspect 360°</span>
                            <span className="material-symbols-outlined text-sm">3d_rotation</span>
                          </span>
                        </div>
                      </div>

                      {/* Feature Badge & CLI Microcopy from verbiage.md Section 3.3 */}
                      <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.08] space-y-1.5 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#38bdf8]">
                            {badge.title}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {badge.cli}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                          {badge.copy}
                        </p>
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
                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-all cursor-pointer font-mono ${selectedSize === sz
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
                        <span className="text-[11px] text-[#86868b] block font-mono">From</span>
                        <span className="text-xl font-bold text-white">${price.toFixed(2)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/ar/${product.id}`}
                          className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[#a1a1aa] hover:text-white transition-colors"
                          title="Preview in Phone Camera"
                        >
                          <span className="material-symbols-outlined text-base">view_in_ar</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleAddToBag(product)}
                          className="px-4 py-2 rounded-full bg-[#2997ff] hover:bg-[#0077ed] text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-mono"
                        >
                          <span>Claim Piece</span>
                        </button>

                        {isSandboxMode && (
                          <button
                            type="button"
                            onClick={() => handleSandboxBuy(product)}
                            className="px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer active:scale-95 font-mono"
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
        {/* SECTION 5: THE VAULT - TRANSPARENT CHECKOUT & CREATOR SUPPORT              */}
        {/* Implements verbiage.md Section 3.4 (Asset: 3dart/2.avif)                   */}
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

          <div className="max-w-5xl mx-auto space-y-12 relative z-10 text-center">
            {/* Header & Body from verbiage.md Section 3.4 */}
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-xs font-mono text-emerald-400">
                <span>$ antigravity vault --confirm</span>
              </div>
              <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Simple, honest support for independent design.
              </h3>
              <p className="text-sm sm:text-base text-[#d4d4d8] leading-relaxed">
                When you pick up a garment or an expansion skin, your purchase routes directly between the craftspeople cutting the fabric and the 3D artists designing the visuals. No middleman cut, no corporate bloat—just an open network built to let creators create and wearers express themselves without limits.
              </p>
            </div>

            {/* 3 Transparent Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center pt-4">

              {/* Pillar 1: Direct-to-Creator */}
              <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#2997ff] flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-2xl">handshake</span>
                </div>
                <h4 className="text-base font-semibold text-white">Direct-to-Creator Routing</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Your purchase routes directly to the craftspeople cutting the fabric and the independent 3D artists designing the visual skins.
                </p>
                <div className="text-[10px] font-mono text-[#2997ff]">
                  $ antigravity vault --route creator-direct
                </div>
              </div>

              {/* Pillar 2: Browser-Native Freedom */}
              <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#a855f7] flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-2xl">bolt</span>
                </div>
                <h4 className="text-base font-semibold text-white">Zero-Friction Web Delivery</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  No app stores, downloads, or sign-ups required to experience art. Point any standard camera at the garment to watch it come alive instantly.
                </p>
                <div className="text-[10px] font-mono text-[#a855f7]">
                  $ antigravity preview --zero-friction
                </div>
              </div>

              {/* Pillar 3: Wearer Sovereignty */}
              <div className="space-y-3 p-6 rounded-3xl bg-[#121214]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-[#10b981] flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <h4 className="text-base font-semibold text-white">Wearer Sovereignty Guaranteed</h4>
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Test the fit, feel the heavyweight fabric, and try your swappable skins in the mirror. If you don&apos;t love it, returns are 100% free within 30 days.
                </p>
                <div className="text-[10px] font-mono text-[#10b981]">
                  $ antigravity vault --guarantee 30-day
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* REFINED BRAND FOOTER                                                      */}
        {/* ========================================================================= */}
        <footer className="relative z-10 py-16 px-6 max-w-7xl mx-auto border-t border-white/[0.08] text-xs text-[#86868b] space-y-8 bg-black/80 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Star weAR</span>
              <span className="text-xs text-[#86868b]">— Living Luxury Streetwear. Powered by Antigravity &amp; 4D4 Technologies.</span>
            </div>

            <div className="flex flex-wrap gap-6 text-xs text-[#86868b]">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <Link to="/shop" className="text-white font-medium transition-colors">Shop</Link>
              <Link to="/collections" className="hover:text-white transition-colors">Collections</Link>
              <Link to="/about" className="hover:text-white transition-colors">About</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link to="/cart" className="hover:text-white transition-colors">Bag ({getCartCount()})</Link>
              {(isAdmin || isSuperAdmin) && (
                <Link to="/admin/inventory" className="hover:text-white transition-colors">Admin</Link>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px]">
            <div>
              Copyright © 2026 Star weAR Inc. All rights reserved. Open canvas spatial experiences run natively in standard mobile web browsers without third-party apps.
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
