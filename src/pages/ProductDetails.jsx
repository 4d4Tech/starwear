import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

function ProductDetails() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAdmin, isSuperAdmin } = useAuth();

  // Resolve target asset ID from URL path or query string
  const routeAssetId = params.id || searchParams.get('id') || searchParams.get('batchId') || '';

  const [asset, setAsset] = useState(null);
  const [allAssets, setAllAssets] = useState([]);
  const [modelUrl, setModelUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [arConfig, setArConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [addedToast, setAddedToast] = useState(false);

  // 1. Fetch asset details & all inventory items
  useEffect(() => {
    let isMounted = true;

    async function loadAssetData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch all assets for browsing strip
        const assetsSnap = await getDocs(collection(db, 'assets'));
        const assetList = assetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (isMounted) setAllAssets(assetList);

        // Determine which asset to display
        let targetId = routeAssetId;
        if (!targetId && assetList.length > 0) {
          targetId = assetList[0].id;
        }

        if (!targetId) {
          if (isMounted) {
            setError("No assets found in the inventory yet.");
            setLoading(false);
          }
          return;
        }

        // Fetch target asset document
        let assetData = null;
        const assetDocRef = doc(db, 'assets', targetId);
        const assetSnap = await getDoc(assetDocRef);

        if (assetSnap.exists()) {
          assetData = { id: assetSnap.id, ...assetSnap.data() };
        } else {
          // Fallback to batches collection if id refers to a batch
          const batchDocRef = doc(db, 'batches', targetId);
          const batchSnap = await getDoc(batchDocRef);
          if (batchSnap.exists()) {
            assetData = { id: batchSnap.id, ...batchSnap.data() };
          }
        }

        if (!assetData) {
          if (isMounted) {
            setError(`Asset "${targetId}" not found in inventory.`);
            setLoading(false);
          }
          return;
        }

        // Also fetch associated batch config to get fine-tuned AR transforms/lighting
        let mergedConfig = assetData.ar_config || {};
        try {
          const bSnap = await getDoc(doc(db, 'batches', targetId));
          if (bSnap.exists()) {
            const bData = bSnap.data();
            mergedConfig = {
              ...(mergedConfig || {}),
              ...(bData.ar_config || bData.arExperience?.config || {})
            };
          }
        } catch (bErr) {
          console.warn("Batch config fetch notice:", bErr);
        }

        // 2. Resolve 3D Model Download URL
        let resolvedModelUrl = '';
        if (assetData.gltf_file_path) {
          try {
            const gltfRef = ref(storage, assetData.gltf_file_path);
            resolvedModelUrl = await getDownloadURL(gltfRef);
          } catch (storageErr) {
            console.warn("Storage GLTF fetch notice:", storageErr);
          }
        } else if (assetData.gltf_url || assetData.modelUrl) {
          resolvedModelUrl = assetData.gltf_url || assetData.modelUrl;
        }

        // 3. Resolve Video Layer Download URL
        let resolvedVideoUrl = assetData.video_url || assetData.videoUrl || mergedConfig.video_url || mergedConfig.videoUrl || '';
        const targetVideoPath = assetData.video_file_path || mergedConfig.video_file_path || '';
        if ((!resolvedVideoUrl || !resolvedVideoUrl.startsWith('http')) && targetVideoPath) {
          try {
            const videoRef = ref(storage, targetVideoPath);
            resolvedVideoUrl = await getDownloadURL(videoRef);
          } catch (vErr) {
            console.warn("Video layer fetch notice:", vErr);
          }
        }

        if (isMounted) {
          setAsset(assetData);
          setArConfig(mergedConfig);
          setModelUrl(resolvedModelUrl);
          setVideoUrl(resolvedVideoUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading product details:", err);
        if (isMounted) {
          setError("Failed to load asset details: " + err.message);
          setLoading(false);
        }
      }
    }

    loadAssetData();

    return () => {
      isMounted = false;
    };
  }, [routeAssetId]);

  const handleAddToCart = () => {
    if (!asset) return;

    const price = asset.price !== undefined ? Number(asset.price) : 99.00;
    addToCart({
      id: asset.id,
      name: (asset.name || asset.id).toUpperCase(),
      price: price,
      size: selectedSize,
      image: asset.imageUrl || asset.image || '',
      description: asset.description || ''
    });

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 4000);
  };

  const assetPrice = asset?.price !== undefined ? Number(asset.price) : 99.00;
  const assetTitle = (asset?.name || asset?.id || 'DIGITAL ASSET').toUpperCase();

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary-container selection:text-on-primary-container font-body-md antialiased">
      <Header />

      {/* Main Content Canvas */}
      <main className="pt-20 pb-32 min-h-screen">
        {/* Product Showcase Section */}
        <section className="w-full h-[1024px] min-h-[800px] relative overflow-hidden bg-surface-container-lowest">
          <div className="absolute inset-0 flex flex-col md:flex-row h-full">

            {/* Left Side: Glassmorphic Content Panel */}
            <div className="w-full md:w-1/2 h-full relative z-10 glass-panel border-r border-outline-variant/20 flex flex-col justify-center px-margin-mobile md:px-margin-desktop overflow-y-auto">
              <div className="max-w-md mx-auto md:mx-0 pt-20 md:pt-0">

                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 mb-4 text-xs font-mono text-secondary">
                  <Link to="/" className="hover:text-primary transition-colors">STOREFRONT</Link>
                  <span>/</span>
                  <Link to="/collections" className="hover:text-primary transition-colors">INVENTORY</Link>
                  <span>/</span>
                  <span className="text-on-background font-bold truncate max-w-[150px]">{asset?.id || 'ASSET'}</span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">view_in_ar</span>
                    3D WebAR
                  </span>
                  {videoUrl && (
                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">play_circle</span>
                      Video Texture
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-white/5 text-secondary border border-white/10 rounded text-[10px] font-mono">
                    ID: {asset?.id || '—'}
                  </span>
                </div>

                <h1 className="font-headline-lg text-headline-lg-mobile md:text-[44px] md:leading-[50px] text-on-background mb-3 uppercase tracking-wide">
                  {loading ? 'LOADING ASSET...' : assetTitle}
                </h1>

                <p className="font-body-md text-sm md:text-body-md text-on-surface-variant mb-6 leading-relaxed">
                  {loading
                    ? 'Retrieving 3D asset metadata from inventory...'
                    : asset?.description ||
                    'Crafted for the Star weAR digital ecosystem. This asset includes full 3D interactive preview capabilities, camera tracking target anchors, and high-fidelity textures.'}
                </p>

                {error && (
                  <div className="p-3 mb-6 bg-red-950/60 border border-red-500/40 rounded text-red-300 text-xs font-mono flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Interactive Elements */}
                <div className="space-y-6">
                  {/* Size / Fit Selection */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">DIGITAL FIT / SIZE</span>
                      <span className="font-label-caps text-[10px] tracking-widest text-primary">UNIVERSAL AR MESH</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['S', 'M', 'L', 'XL'].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`border py-2.5 font-label-caps text-xs transition-all cursor-pointer ${selectedSize === size
                            ? 'bg-on-background text-on-primary border-on-background font-bold shadow'
                            : 'border-outline-variant/50 hover:border-on-background text-on-surface-variant'
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price & Primary Action */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono uppercase text-secondary">PRICE</span>
                      <span className="font-headline-lg text-2xl md:text-3xl text-on-background font-bold">
                        ${assetPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={loading || !asset}
                        className="flex-1 sm:flex-initial bg-on-background text-on-primary px-6 py-3.5 font-label-caps text-label-caps hover:bg-on-background/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg"
                      >
                        {addedToast ? (
                          <>
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
                            <span>ADDED TO CART</span>
                          </>
                        ) : (
                          <>
                            <span>ADD TO CART</span>
                            <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                          </>
                        )}
                      </button>

                      {asset?.id && (
                        <a
                          href={`/ar/${asset.id}`}
                          className="px-4 py-3.5 border border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-label-caps text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                          title="Open WebAR Camera Try-on on Mobile"
                        >
                          <span className="material-symbols-outlined text-sm">view_in_ar</span>
                          <span className="hidden sm:inline">AR</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Quick Admin Navigation Link - Restricted to Authenticated Admins & Superadmins */}
                  {(isAdmin || isSuperAdmin) && (
                    <div className="pt-2 flex items-center gap-4 text-xs font-mono text-secondary">
                      <Link to="/admin/inventory" className="hover:text-primary transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                        Admin Inventory
                      </Link>
                      {asset?.id && (
                        <Link to={`/ar-test?batch=${asset.id}`} className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">tune</span>
                          Calibrate in AR-Test
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Other Inventory Assets Carousel at Bottom Left */}
              <div className="mt-12 pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-label-caps text-[10px] tracking-[0.2em] text-on-background opacity-70 uppercase">
                    More Assets In Inventory ({allAssets.length})
                  </h4>
                  <Link to="/collections" className="text-[10px] font-mono text-primary hover:underline uppercase">
                    View All →
                  </Link>
                </div>

                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {allAssets.map(item => {
                    const isSelected = item.id === asset?.id;
                    const itemPrice = item.price !== undefined ? Number(item.price) : 99.00;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/product/${item.id}`)}
                        className={`flex-shrink-0 text-left p-2.5 rounded-lg border transition-all cursor-pointer w-32 ${isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50 shadow-md'
                          : 'bg-surface-variant/30 border-outline-variant/20 hover:border-primary/50 text-secondary hover:text-on-background'
                          }`}
                      >
                        <div className="w-full aspect-square rounded bg-black/40 mb-2 flex items-center justify-center border border-white/5 overflow-hidden">
                          <span className="material-symbols-outlined text-2xl text-outline-variant group-hover:scale-110 transition-transform">
                            view_in_ar
                          </span>
                        </div>
                        <div className="font-label-caps text-[10px] font-bold text-on-background truncate uppercase">
                          {item.name || item.id}
                        </div>
                        <div className="font-mono text-[10px] text-primary mt-0.5">
                          ${itemPrice.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Side: 3D Interactive Canvas */}
            <div className="w-full md:w-1/2 h-[450px] md:h-full relative bg-[#0d1117] overflow-hidden group">
              <ProductViewer
                modelUrl={modelUrl}
                videoUrl={videoUrl}
                config={arConfig}
                assetName={asset?.name || asset?.id || 'Digital Asset'}
                assetId={asset?.id || ''}
              />
            </div>
          </div>
        </section>

        {/* Accordion Details (Bento Grid Style) */}
        <section className="px-margin-mobile md:px-margin-desktop py-24 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">info</span>
                <h3 className="font-label-caps text-label-caps text-on-background">3D ASSET SPECIFICATIONS</h3>
              </div>
              <ul className="space-y-2 font-body-md text-on-surface-variant text-sm">
                <li>• Format: GLTF 2.0 Binary (.glb)</li>
                <li>• Rendering Engine: Three.js physically correct PBR</li>
                <li>• Video Layer: {videoUrl ? 'Active dynamic MP4/MOV texture' : 'Embedded surface textures'}</li>
                <li>• Camera Anchor: {asset?.mind_file_path ? 'MindAR compiled target marker' : 'Universal tracker'}</li>
                <li>• Cross-Platform: iOS Safari, Android Chrome, Desktop WebGL</li>
              </ul>
            </div>

            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">view_in_ar</span>
                <h3 className="font-label-caps text-label-caps text-on-background">WEBAR TRY-ON</h3>
              </div>
              <p className="font-body-md text-on-surface-variant text-sm mb-4">
                Experience this garment anchored to real-world target markers or clothing directly through your smartphone browser. No app download required.
              </p>
              {asset?.id && (
                <a
                  href={`/ar/${asset.id}`}
                  className="font-label-caps text-xs text-primary underline hover:text-on-background transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Launch Live AR Camera Experience</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              )}
            </div>

            <div className="p-8 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary font-light">verified</span>
                <h3 className="font-label-caps text-label-caps text-on-background">AUTHENTICITY & OWNERSHIP</h3>
              </div>
              <p className="font-body-md text-on-surface-variant text-sm mb-4">
                Each digital asset is cryptographically verified and tied to its batch production record in Star weAR.
              </p>
              <div className="text-xs font-mono text-secondary">
                Document ID: {asset?.id || '—'}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background text-on-background font-body-md text-body-md w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 border-t border-outline-variant/30 bottom-0">
        <div className="font-headline-lg text-headline-lg text-on-background">
          STAR <span className="text-primary font-light">weAR</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/">STOREFRONT</Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all font-label-caps text-label-caps" to="/collections">COLLECTIONS</Link>
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

export default ProductDetails;
