import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import Model3DThumbnail from '../components/Model3DThumbnail';
import WebGLErrorBoundary from '../components/WebGLErrorBoundary';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function StoreFront() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [cartToast, setCartToast] = useState('');
  const [featuredModelUrl, setFeaturedModelUrl] = useState('');
  const [featuredVideoUrl, setFeaturedVideoUrl] = useState('');
  const [featuredBatchConfig, setFeaturedBatchConfig] = useState(null);
  const { addToCart } = useCart();
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchStoreInventory() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'assets'));
        const items = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInventory(items);
      } catch (err) {
        console.error("Error fetching storefront inventory:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStoreInventory();
  }, []);

  const handleQuickAdd = (e, item) => {
    e.stopPropagation();
    const price = item.price !== undefined ? Number(item.price) : 99.00;
    addToCart({
      id: item.id,
      baseId: item.id,
      name: (item.name || item.id).toUpperCase(),
      price: price,
      size: 'M',
      image: item.thumbnailUrl || item.imageUrl || item.image || '',
      thumbnailUrl: item.thumbnailUrl || '',
      modelUrl: item.gltf_url || item.modelUrl || item.model_url || item.glb_url || item.gltf_file_path || '',
      category: item.category || 'Apparel',
      description: item.description || ''
    });
    setCartToast(`Added "${item.name || item.id}" to cart!`);
    setTimeout(() => setCartToast(''), 3500);
  };

  // Featured Asset (prioritizes assets with verified working 3D models & video layers)
  const featuredAsset =
    inventory.find(i => i.id === 'shirtvid') ||
    inventory.find(i => i.id === 'better') ||
    inventory.find(i => i.id === 'shirt') ||
    inventory.find(i => (i.video_url || i.videoUrl || i.video_file_path)) ||
    inventory[0] ||
    null;

  // Resolve 3D Model and Video Download URLs for Featured Asset
  useEffect(() => {
    let isMounted = true;
    async function resolveFeaturedMedia() {
      if (!featuredAsset) return;

      // 1. Resolve 3D Model URL
      let mUrl = featuredAsset.gltf_url || featuredAsset.modelUrl || '';
      if (!mUrl && featuredAsset.gltf_file_path) {
        try {
          const fileRef = ref(storage, featuredAsset.gltf_file_path);
          mUrl = await getDownloadURL(fileRef);
        } catch (e) {
          console.warn('Featured model storage lookup notice:', e);
        }
      }
      if (isMounted) setFeaturedModelUrl(mUrl);

      // 2. Resolve Video Layer URL
      let vUrl = featuredAsset.video_url || featuredAsset.videoUrl || featuredAsset.ar_config?.video_url || featuredAsset.ar_config?.videoUrl || '';
      const vPath = featuredAsset.video_file_path || featuredAsset.ar_config?.video_file_path || '';
      if ((!vUrl || !vUrl.startsWith('http')) && vPath) {
        try {
          const vRef = ref(storage, vPath);
          vUrl = await getDownloadURL(vRef);
        } catch (vErr) {
          console.warn('Featured video storage lookup notice:', vErr);
        }
      }
      if (isMounted) setFeaturedVideoUrl(vUrl);

      // 3. Resolve Batch Configuration for fine-tuned AR lights/texts
      try {
        const bSnap = await getDoc(doc(db, 'batches', featuredAsset.id));
        if (bSnap.exists() && isMounted) {
          setFeaturedBatchConfig(bSnap.data());
        } else if (isMounted) {
          setFeaturedBatchConfig(null);
        }
      } catch {
        if (isMounted) setFeaturedBatchConfig(null);
      }
    }

    resolveFeaturedMedia();
    return () => { isMounted = false; };
  }, [featuredAsset]);

  // Filtered Assets
  const filteredAssets = inventory.filter(item => {
    if (activeFilter === 'VIDEO') return !!(item.video_url || item.videoUrl || item.video_file_path);
    if (activeFilter === 'WEBAR') return !!item.mind_file_path;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <Header />

      {/* Cart Notification Toast */}
      {cartToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-black/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          <span>{cartToast}</span>
        </div>
      )}

      <main className="min-h-screen">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">
          {/* Background Image */}
          <div className="absolute inset-0 w-full h-full">
            <img
              alt="Star weAR Luxury High Fashion Digital Apparel"
              className="w-full h-full object-cover object-center"
              src="https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/bg-2.png?alt=media&token=a804ed50-f54b-4c41-843a-be9258a25741"
            />
            {/* Glassmorphism Split Overlay */}
            <div className="absolute inset-y-0 left-0 w-full md:w-1/2 bg-gradient-to-r from-white/70 to-white/30 backdrop-blur-[20px] border-r border-outline-variant/30 flex items-center p-margin-mobile md:p-margin-desktop">
              <div className="max-w-md w-full pt-20 md:pt-0">

                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/30 rounded text-[10px] font-mono font-bold tracking-widest uppercase">
                    FEATURED DIGITAL ASSET
                  </span>
                  {featuredAsset && (
                    <span className="text-[10px] font-mono text-secondary">
                      ID: {featuredAsset.id}
                    </span>
                  )}
                </div>

                <h1 className="font-headline-lg text-headline-lg-mobile md:text-[68px] md:leading-[76px] md:tracking-[0.03em] md:font-extrabold text-on-surface mb-4 uppercase truncate">
                  {featuredAsset ? (featuredAsset.name || featuredAsset.id) : 'STAR WEAR'}
                </h1>

                <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-sm leading-relaxed">
                  {featuredAsset?.description ||
                    'Transcend physical boundaries. Experience our digital-first collection where high-fashion meets the metaverse. Projecting your digital soul onto timeless silhouettes.'}
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  {featuredAsset ? (
                    <>
                      <Link
                        to={`/product/${featuredAsset.id}`}
                        className="border border-on-surface text-on-surface font-label-caps text-label-caps px-7 py-3.5 bg-transparent hover:bg-on-surface hover:text-surface transition-all tracking-widest cursor-pointer uppercase flex items-center gap-2"
                      >
                        <span>[ VIEW 3D CANVAS & BUY ]</span>
                        <span className="material-symbols-outlined text-sm">3d_rotation</span>
                      </Link>

                      <a
                        href={`/ar/${featuredAsset.id}`}
                        className="bg-primary text-on-primary font-label-caps text-label-caps px-6 py-3.5 hover:opacity-90 transition-all tracking-widest cursor-pointer uppercase flex items-center gap-2 shadow-lg"
                      >
                        <span>[ TRY IN WEBAR ]</span>
                        <span className="material-symbols-outlined text-sm">view_in_ar</span>
                      </a>
                    </>
                  ) : (
                    <Link
                      to="/product"
                      className="border border-on-surface text-on-surface font-label-caps text-label-caps px-8 py-4 bg-transparent hover:bg-on-surface hover:text-surface transition-all tracking-widest cursor-pointer uppercase"
                    >
                      [ EXPLORE 3D ASSETS ]
                    </Link>
                  )}
                </div>

                {/* Mini Gallery Grid pulling live from Admin Inventory */}
                <div className="grid grid-cols-2 md:grid-cols-4 mt-12 w-full gap-y-6 gap-x-3">
                  {inventory.slice(0, 4).map((item) => {
                    const price = item.price !== undefined ? Number(item.price) : 99.00;
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/product/${item.id}`)}
                        className="flex flex-col gap-2 group cursor-pointer"
                      >
                        <div className="aspect-[3/4] overflow-hidden rounded bg-black/60 relative border border-outline-variant/30 flex items-center justify-center group-hover:border-primary transition-all">
                          <div className="text-center p-2">
                            <span className="material-symbols-outlined text-3xl text-outline-variant group-hover:scale-110 group-hover:text-primary transition-all duration-300">
                              view_in_ar
                            </span>
                            <span className="block font-mono text-[9px] text-secondary mt-1 tracking-wider uppercase">
                              .GLB ASSET
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-label-caps text-[10px] tracking-widest text-on-surface uppercase truncate font-bold">
                            {item.name || item.id}
                          </div>
                          <div className="font-mono text-xs text-on-surface-variant font-semibold">
                            ${price.toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleQuickAdd(e, item)}
                            className="text-[9px] font-label-caps tracking-widest text-primary text-left mt-0.5 hover:opacity-70 transition-opacity uppercase cursor-pointer"
                          >
                            + ADD TO VAULT
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Quick 3D Preview Hint */}
                {featuredAsset && (
                  <div className="md:hidden mt-6 p-3 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-400 text-lg">view_in_ar</span>
                      <span className="text-xs font-mono text-white font-bold">{featuredAsset.name || featuredAsset.id}</span>
                    </div>
                    <Link
                      to={`/product/${featuredAsset.id}`}
                      className="text-[11px] font-mono font-bold text-cyan-300 hover:underline flex items-center gap-1"
                    >
                      <span>Inspect 3D</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </Link>
                  </div>
                )}

              </div>
            </div>

            {/* Right Side: 3D Interactive Canvas & Live Video Screen */}
            <div className="hidden md:flex absolute inset-y-0 right-0 w-1/2 items-center justify-center p-8 z-10 pointer-events-auto">
              <div className="w-full h-[620px] max-h-[85vh] rounded-3xl overflow-hidden border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)] bg-black/60 backdrop-blur-2xl relative">
                {featuredModelUrl ? (
                  <WebGLErrorBoundary
                    fallback={
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-black/80 relative">
                        {featuredAsset?.thumbnailUrl || featuredAsset?.thumbnail_url || featuredAsset?.imageUrl ? (
                          <img
                            src={featuredAsset.thumbnailUrl || featuredAsset.thumbnail_url || featuredAsset.imageUrl}
                            alt={featuredAsset.name || featuredAsset.id}
                            className="max-h-[55%] object-contain mb-4 drop-shadow-2xl"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
                            <span className="material-symbols-outlined text-3xl">view_in_ar</span>
                          </div>
                        )}
                        <span className="text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase mb-3">
                          {featuredAsset?.name || featuredAsset?.id || 'Featured Digital Asset'}
                        </span>
                        <Link
                          to={`/product/${featuredAsset?.id}`}
                          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-mono text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                        >
                          <span>Inspect in 3D</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </div>
                    }
                  >
                    <ProductViewer
                      modelUrl={featuredModelUrl}
                      videoUrl={featuredVideoUrl}
                      config={(() => {
                        const pCfg = featuredAsset?.ar_config || featuredAsset?.config || featuredAsset?.arExperience?.config || {};
                        const bCfg = featuredBatchConfig?.ar_config || featuredBatchConfig?.config || featuredBatchConfig?.arExperience?.config || {};
                        const res = {
                          ...pCfg,
                          ...(featuredAsset || {}),
                          ...bCfg,
                          ...(featuredBatchConfig || {})
                        };
                        const keys = [
                          'ambientColor', 'ambientIntensity',
                          'dir1Color', 'dir1Intensity', 'dir1Position',
                          'dir2Color', 'dir2Intensity', 'dir2Position',
                          'rimColor', 'rimIntensity', 'rimPosition',
                          'modelScale', 'modelPosition', 'modelRotation',
                          'modelRotX', 'modelRotY', 'modelRotZ',
                          'modelPosX', 'modelPosY', 'modelPosZ', 'modelRotSpeed',
                          'matMetalness', 'matRoughness', 'matEmissive', 'matEmissiveIntensity',
                          'matWireframe', 'matOpacity', 'meshOverrides',
                          'portalConfig', 'particleConfig'
                        ];
                        keys.forEach((k) => {
                          if (bCfg[k] !== undefined && bCfg[k] !== null) res[k] = bCfg[k];
                          else if (featuredBatchConfig?.[k] !== undefined && featuredBatchConfig?.[k] !== null) res[k] = featuredBatchConfig[k];
                          else if (pCfg[k] !== undefined && pCfg[k] !== null) res[k] = pCfg[k];
                          else if (featuredAsset?.[k] !== undefined && featuredAsset?.[k] !== null) res[k] = featuredAsset[k];
                        });
                        res.customLights = (Array.isArray(bCfg.customLights) && bCfg.customLights.length > 0)
                          ? bCfg.customLights
                          : (Array.isArray(featuredBatchConfig?.customLights) && featuredBatchConfig.customLights.length > 0)
                          ? featuredBatchConfig.customLights
                          : (Array.isArray(pCfg.customLights) && pCfg.customLights.length > 0)
                          ? pCfg.customLights
                          : (Array.isArray(featuredAsset?.customLights) ? featuredAsset.customLights : []);
                        res.custom3DTexts = (Array.isArray(bCfg.custom3DTexts) && bCfg.custom3DTexts.length > 0)
                          ? bCfg.custom3DTexts
                          : (Array.isArray(featuredBatchConfig?.custom3DTexts) && featuredBatchConfig.custom3DTexts.length > 0)
                          ? featuredBatchConfig.custom3DTexts
                          : (Array.isArray(pCfg.custom3DTexts) && pCfg.custom3DTexts.length > 0)
                          ? pCfg.custom3DTexts
                          : (Array.isArray(featuredAsset?.custom3DTexts) ? featuredAsset.custom3DTexts : []);
                        res.additionalGeometries = (Array.isArray(bCfg.additionalGeometries) && bCfg.additionalGeometries.length > 0)
                          ? bCfg.additionalGeometries
                          : (Array.isArray(featuredBatchConfig?.additionalGeometries) && featuredBatchConfig.additionalGeometries.length > 0)
                          ? featuredBatchConfig.additionalGeometries
                          : (Array.isArray(pCfg.additionalGeometries) && pCfg.additionalGeometries.length > 0)
                          ? pCfg.additionalGeometries
                          : (Array.isArray(featuredAsset?.additionalGeometries) ? featuredAsset.additionalGeometries : []);
                        return res;
                      })()}
                      assetName={featuredAsset?.name || featuredAsset?.id || 'Featured Digital Asset'}
                      assetId={featuredAsset?.id || ''}
                    />
                  </WebGLErrorBoundary>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 text-center bg-slate-950/80">
                    <div className="w-12 h-12 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                    <span className="text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase">
                      Initializing 3D Interactive Canvas
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MAIN STOREFRONT CATALOG SECTION: ADMIN INVENTORY ASSETS                    */}
        {/* ========================================================================= */}
        <section className="py-24 px-margin-mobile md:px-margin-desktop bg-surface">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-outline-variant/20 pb-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary mb-2">
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  <span>LIVE ADMIN INVENTORY CATALOG</span>
                </div>
                <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface uppercase">
                  DIGITAL APPAREL & 3D WEBAR ASSETS
                </h2>
                <p className="font-body-md text-sm md:text-base text-on-surface-variant max-w-2xl mt-2">
                  Select any wearable asset below to inspect its interactive 3D model in real time, view technical specifications, and test in WebAR.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 bg-surface-variant/40 p-1 rounded-lg border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${activeFilter === 'ALL'
                    ? 'bg-on-background text-on-primary shadow'
                    : 'text-secondary hover:text-on-background'
                    }`}
                >
                  ALL ({inventory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('WEBAR')}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${activeFilter === 'WEBAR'
                    ? 'bg-on-background text-on-primary shadow'
                    : 'text-secondary hover:text-on-background'
                    }`}
                >
                  WEBAR TARGETS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('VIDEO')}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${activeFilter === 'VIDEO'
                    ? 'bg-on-background text-on-primary shadow'
                    : 'text-secondary hover:text-on-background'
                    }`}
                >
                  VIDEO LAYERS
                </button>
              </div>
            </div>

            {/* Assets Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="rounded-xl border border-outline-variant/20 p-4 space-y-3 bg-surface-variant/20 animate-pulse">
                    <div className="aspect-[4/3] bg-black/20 rounded-lg"></div>
                    <div className="h-4 bg-black/20 rounded w-3/4"></div>
                    <div className="h-3 bg-black/20 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-outline-variant/30 rounded-2xl p-8">
                <span className="material-symbols-outlined text-5xl text-secondary mb-3">inventory_2</span>
                <h3 className="text-xl font-bold text-on-surface mb-2 uppercase">No Assets In Inventory</h3>
                {(isAdmin || isSuperAdmin) ? (
                  <>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
                      Add 3D GLB models and target images in the Admin Inventory to populate the storefront catalog.
                    </p>
                    <Link
                      to="/admin/inventory"
                      className="bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-xs tracking-wider inline-flex items-center gap-2 hover:opacity-90 transition-opacity uppercase"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Go To Admin Inventory
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
                      Exclusive digital streetwear drops are coming soon. Browse the flagship collection in the Shop.
                    </p>
                    <Link
                      to="/shop"
                      className="bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-xs tracking-wider inline-flex items-center gap-2 hover:opacity-90 transition-opacity uppercase"
                    >
                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                      Explore Shop
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAssets.map((item) => {
                  const price = item.price !== undefined ? Number(item.price) : 99.00;
                  const hasVideo = !!(item.video_url || item.videoUrl || item.video_file_path);
                  const hasMind = !!item.mind_file_path;

                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/product/${item.id}`)}
                      className="group bg-surface-variant/20 hover:bg-surface-variant/40 border border-outline-variant/25 hover:border-primary/60 rounded-xl overflow-hidden p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl cursor-pointer"
                    >
                      {/* Top Preview Canvas Card */}
                      <div>
                        <div className="aspect-[4/3] rounded-lg bg-gradient-to-b from-[#111827] to-[#030712] border border-white/10 relative overflow-hidden mb-4 group-hover:border-cyan-500/40 transition-colors">
                          <Model3DThumbnail
                            thumbnailUrl={item.thumbnailUrl || item.thumbnail_url}
                            modelUrl={item.gltf_url || item.modelUrl || item.gltf_file_path}
                            fallbackImageUrl={item.thumbnailUrl || item.thumbnail_url || item.imageUrl || item.image || item.target_image_url}
                            category={item.category}
                            cleanName={item.name || item.id}
                            className="w-full h-full"
                            aspectRatio="aspect-[4/3]"
                            badge="3D GLB"
                            lightingConfig={item.ar_config || item.config || item.lightingConfig || item}
                          />

                          {/* Hover Overlay: Click To Inspect In 3D */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs pointer-events-none">
                            <span className="px-3 py-1.5 rounded-full bg-white text-black font-label-caps text-[10px] tracking-widest font-bold shadow-lg flex items-center gap-1">
                              <span>INSPECT IN 3D</span>
                              <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            </span>
                          </div>

                          {/* Top Badges */}
                          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 z-10 pointer-events-none">
                            {hasVideo && (
                              <span className="bg-purple-950/80 border border-purple-500/50 text-purple-300 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">play_circle</span>
                                Video
                              </span>
                            )}
                            {hasMind && (
                              <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">target</span>
                                AR Ready
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Metadata */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[10px] text-secondary">
                            ID: {item.id}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-primary">
                            WEBAR READY
                          </span>
                        </div>

                        <h3 className="font-headline-lg text-base font-bold text-on-surface uppercase truncate group-hover:text-primary transition-colors">
                          {item.name || item.id}
                        </h3>

                        <p className="font-body-md text-xs text-on-surface-variant line-clamp-2 mt-1 mb-4 leading-relaxed">
                          {item.description || 'Exclusive 3D garment asset rigged for real-time mobile AR tracking.'}
                        </p>
                      </div>

                      {/* Bottom Price & Actions */}
                      <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-secondary uppercase">PRICE</span>
                          <span className="font-mono text-base font-bold text-on-surface">
                            ${price.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleQuickAdd(e, item)}
                            className="p-2 bg-surface hover:bg-on-background hover:text-surface text-on-surface border border-outline-variant rounded-lg transition-colors cursor-pointer cart-icon"
                            title="Add to Cart"
                          >
                            <span className="material-symbols-outlined text-sm">shopping_cart</span>
                          </button>

                          <Link
                            to={`/product/${item.id}`}
                            className="px-3 py-2 bg-on-background text-on-primary hover:bg-on-background/80 rounded-lg text-xs font-label-caps tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>VIEW 3D</span>
                            <span className="material-symbols-outlined text-xs">arrow_right_alt</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background text-on-background font-body-md text-body-md w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 border-t border-outline-variant/30 bottom-0">
        <div className="font-headline-lg text-headline-lg text-on-background uppercase">
          STAR <span className="text-primary font-light">weAR</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/">STOREFRONT</Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/shop">SHOP</Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/collections">COLLECTIONS</Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/about">ABOUT</Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/contact">CONTACT</Link>
          {(isAdmin || isSuperAdmin) && (
            <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/admin/inventory">ADMIN INVENTORY</Link>
          )}
          {(isAdmin || isSuperAdmin) && (
            <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/ar-test">AR TEST</Link>
          )}
        </div>
        <div className="text-sm text-secondary font-mono">
          © 2026 STAR WEAR. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}

