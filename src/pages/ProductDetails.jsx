import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import Header from '../components/Header';
import ProductViewer from '../components/ProductViewer';
import Model3DThumbnail from '../components/Model3DThumbnail';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';

function ProductDetails() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { isSandboxMode, activeGateway } = usePaymentEnvironment();

  // Resolve target asset ID from URL path or query string
  const routeAssetId = params.id || searchParams.get('id') || searchParams.get('batchId') || '';

  const [asset, setAsset] = useState(null);
  const [allAssets, setAllAssets] = useState([]);
  const [modelUrl, setModelUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [arConfig, setArConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSize, setSelectedSize] = useState('M'); // eslint-disable-line no-unused-vars
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
        const extractLighting = (data) => {
          if (!data || typeof data !== 'object') return {};
          const res = {};
          if (data.config && typeof data.config === 'object') Object.assign(res, data.config);
          if (data.arExperience?.config && typeof data.arExperience.config === 'object') Object.assign(res, data.arExperience.config);
          if (data.ar_config && typeof data.ar_config === 'object') Object.assign(res, data.ar_config);
          if (data.lighting && typeof data.lighting === 'object') Object.assign(res, data.lighting);
          if (data.lightingConfig && typeof data.lightingConfig === 'object') Object.assign(res, data.lightingConfig);
          if (data.portalConfig && typeof data.portalConfig === 'object') res.portalConfig = data.portalConfig;
          if (data.particleConfig && typeof data.particleConfig === 'object') res.particleConfig = data.particleConfig;
          const keys = [
            'ambientColor', 'ambientIntensity',
            'dir1Color', 'dir1Intensity', 'dir1Position',
            'dir2Color', 'dir2Intensity', 'dir2Position',
            'rimColor', 'rimIntensity', 'rimPosition'
          ];
          keys.forEach((k) => {
            if (data[k] !== undefined && data[k] !== null) res[k] = data[k];
          });
          return res;
        };

        let mergedConfig = extractLighting(assetData);
        try {
          const bSnap = await getDoc(doc(db, 'batches', targetId));
          if (bSnap.exists()) {
            const bData = bSnap.data();
            mergedConfig = {
              ...(mergedConfig || {}),
              ...extractLighting(bData)
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
      baseId: asset.id,
      name: (asset.name || asset.id).toUpperCase(),
      price: price,
      size: selectedSize,
      image: asset.thumbnailUrl || asset.imageUrl || asset.image || '',
      thumbnailUrl: asset.thumbnailUrl || '',
      modelUrl: modelUrl || asset.gltf_url || asset.modelUrl || asset.gltf_file_path || '',
      category: asset.category || 'Apparel',
      description: asset.description || ''
    });

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 4000);
  };

  const moreInventoryHandler = (id) => {
    window.scrollTo({ top: -200, behavior: 'smooth' });
    navigate(`/product/${id}`);
  }

  const assetPrice = asset?.price !== undefined ? Number(asset.price) : 99.00;
  const assetTitle = (asset?.name || asset?.id || 'DIGITAL ASSET').toUpperCase();

  const [isPurchasing, setIsPurchasing] = useState(false);

  // Send Sandbox Purchase directly for this product with its correct price
  const handleSandboxPurchase = async (preferredGateway = null) => {
    if (!asset || isPurchasing) return;
    setIsPurchasing(true);
    const targetGateway = preferredGateway || activeGateway;
    const itemPayload = {
      id: asset.id,
      name: assetTitle,
      price: assetPrice,
      quantity: 1,
      size: selectedSize,
      image: asset.imageUrl || asset.image || modelUrl || ''
    };

    try {
      if (targetGateway === 'stripe') {
        const { startDirectStripeCheckout } = await import('../services/stripeService');
        await startDirectStripeCheckout({
          items: [itemPayload],
          total: assetPrice,
          metadata: {
            assetId: asset.id,
            size: selectedSize,
            source: 'product_details_stripe_sandbox_btn'
          }
        });
      } else {
        const { startDirectPayPalCheckout } = await import('../services/paypalService');
        await startDirectPayPalCheckout({
          items: [itemPayload],
          total: assetPrice,
          metadata: {
            assetId: asset.id,
            size: selectedSize,
            source: 'product_details_paypal_sandbox_btn'
          }
        });
      }
    } catch (err) {
      console.error('Sandbox purchase failed:', err);
      alert(`Sandbox purchase error: ${err.message}`);
      setIsPurchasing(false);
    }
  };

  // Instant 1-Click Sandbox Test Purchase for this product
  const handleInstantSandboxPurchase = async (preferredGateway = null) => {
    if (!asset || isPurchasing) return;
    setIsPurchasing(true);
    const targetGateway = preferredGateway || activeGateway;
    const itemPayload = {
      id: asset.id,
      name: assetTitle,
      price: assetPrice,
      quantity: 1,
      size: selectedSize,
      image: asset.imageUrl || asset.image || modelUrl || ''
    };

    try {
      if (targetGateway === 'stripe') {
        const { executeInstantStripeSandboxPurchase } = await import('../services/stripeService');
        await executeInstantStripeSandboxPurchase({
          items: [itemPayload],
          total: assetPrice,
          metadata: {
            assetId: asset.id,
            size: selectedSize,
            source: 'product_details_stripe_instant_sandbox'
          }
        });
      } else {
        const { executeInstantSandboxPurchase } = await import('../services/paypalService');
        await executeInstantSandboxPurchase({
          items: [itemPayload],
          total: assetPrice,
          metadata: {
            assetId: asset.id,
            size: selectedSize,
            source: 'product_details_paypal_instant_sandbox'
          }
        });
      }
    } catch (err) {
      console.error('Instant sandbox purchase failed:', err);
      alert(`Instant sandbox error: ${err.message}`);
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary-container selection:text-on-primary-container font-body-md antialiased">
      <Header />

      {/* Main Content Canvas */}
      <main className="pt-20 pb-32 min-h-screen">
        {/* Product Showcase Section */}
        <section className="w-full min-h-270 bg-surface-container">
          <div className="absolute inset-0 flex flex-col md:flex-row h-full">

            {/* Left Side: Glassmorphic Content Panel */}
            <div className="w-full md:w-1/2 h-full relative z-10 glass-panel border-r border-outline-variant/20 flex flex-col justify-center px-margin-mobile md:px-margin-desktop">
              <div className="max-w-md mx-auto md:mx-0 pt-20 md:pt-0">

                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 mb-4 text-xs font-mono text-secondary mt-[500px] md:mt-8">
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
                </div>

                {/* Mobile-Only 3D Interactive Model Viewer */}
                <div className="block md:hidden w-full mobile-product-viewer h-[400px] sm:h-[450px] relative bg-[#0d1117] rounded-xl overflow-hidden group mb-6">
                  <ProductViewer
                    modelUrl={modelUrl}
                    videoUrl={videoUrl}
                    config={arConfig}
                    assetName={asset?.name || asset?.id || 'Digital Asset'}
                    assetId={asset?.id || ''}
                  />
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
                  {/* <div className="space-y-3">
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
                  </div> */}

                  {/* Price & Primary Action */}
                  <div className="pt-2 flex flex-col items-stretch gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase text-secondary">PRICE</span>
                        <span className="font-headline-lg text-2xl md:text-3xl text-on-background font-bold">
                          ${assetPrice.toFixed(2)}
                        </span>
                      </div>
                      {isSandboxMode ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px] font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>{activeGateway === 'stripe' ? 'Stripe Sandbox' : activeGateway === 'both' ? 'Multi-Gateway Sandbox' : 'PayPal Sandbox'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Instant WebAR Delivery</span>
                        </div>
                      )}
                    </div>

                    {/* Primary Button Group */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                      {/* Sandbox Purchase Buttons (Rendered ONLY in Sandbox mode for Admins) */}
                      {isSandboxMode ? (
                        activeGateway === 'both' ? (
                          <div className="flex-1 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSandboxPurchase('stripe')}
                              disabled={loading || !asset || isPurchasing}
                              className="flex-1 bg-[#635bff] hover:bg-[#534be0] text-white px-3 py-3.5 font-label-caps text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg active:scale-95 rounded-lg"
                              title="Send a Stripe Sandbox Purchase with this product's exact price"
                            >
                              <span className="material-symbols-outlined text-base">credit_card</span>
                              <span>STRIPE SANDBOX</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSandboxPurchase('paypal')}
                              disabled={loading || !asset || isPurchasing}
                              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 px-3 py-3.5 font-label-caps text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg active:scale-95 rounded-lg"
                              title="Send a PayPal Sandbox Purchase with this product's exact price"
                            >
                              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                              <span>PAYPAL SANDBOX</span>
                            </button>
                          </div>
                        ) : activeGateway === 'stripe' ? (
                          <button
                            type="button"
                            onClick={() => handleSandboxPurchase('stripe')}
                            disabled={loading || !asset || isPurchasing}
                            className="flex-1 bg-[#635bff] hover:bg-[#534be0] text-white px-5 py-3.5 font-label-caps text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-95 rounded-lg"
                            title="Send a Stripe Sandbox Purchase with this product's exact price"
                          >
                            {isPurchasing ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>CONNECTING STRIPE...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                                <span>STRIPE SANDBOX BUY • ${assetPrice.toFixed(2)}</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSandboxPurchase('paypal')}
                            disabled={loading || !asset || isPurchasing}
                            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-5 py-3.5 font-label-caps text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-95"
                            title="Send a PayPal Sandbox Purchase with this product's exact price"
                          >
                            {isPurchasing ? (
                              <>
                                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                                <span>CONNECTING PAYPAL...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                                <span>PAYPAL SANDBOX BUY • ${assetPrice.toFixed(2)}</span>
                              </>
                            )}
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/checkout?productId=${asset?.id}`)}
                          disabled={loading || !asset}
                          className="flex-1 bg-primary hover:bg-primary/90 text-on-primary px-5 py-3.5 font-label-caps text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-95 uppercase tracking-wider"
                          title={`Checkout ${assetTitle} for $${assetPrice.toFixed(2)}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                          <span>BUY NOW • ${assetPrice.toFixed(2)}</span>
                        </button>
                      )}

                      {/* Add to Bag Button */}
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={loading || !asset}
                        className="bg-on-background text-on-primary px-5 py-3.5 font-label-caps text-xs hover:bg-on-background/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                      >
                        {addedToast ? (
                          <>
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
                            <span>ADDED</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                            <span>ADD TO CART</span>
                          </>
                        )}
                      </button>

                      {/* AR Try-On Button */}
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

                    {/* Instant 1-Click Sandbox Test Link (Rendered ONLY in Sandbox mode for Admins) */}
                    {isSandboxMode && (
                      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-secondary pt-0.5 px-1 gap-2">
                        <span>Developer Sandbox:</span>
                        {activeGateway === 'both' ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleInstantSandboxPurchase('stripe')}
                              disabled={loading || !asset || isPurchasing}
                              className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Instant Stripe sandbox payment simulation"
                            >
                              <span className="material-symbols-outlined text-xs">bolt</span>
                              <span>Stripe 1-Click (${assetPrice.toFixed(2)})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInstantSandboxPurchase('paypal')}
                              disabled={loading || !asset || isPurchasing}
                              className="text-amber-500 hover:text-amber-400 underline font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Instant PayPal sandbox payment simulation"
                            >
                              <span className="material-symbols-outlined text-xs">bolt</span>
                              <span>PayPal 1-Click (${assetPrice.toFixed(2)})</span>
                            </button>
                          </div>
                        ) : activeGateway === 'stripe' ? (
                          <button
                            type="button"
                            onClick={() => handleInstantSandboxPurchase('stripe')}
                            disabled={loading || !asset || isPurchasing}
                            className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Simulates an approved Stripe sandbox payment and creates the paid order in Firestore immediately"
                          >
                            <span className="material-symbols-outlined text-xs">bolt</span>
                            <span>Instant 1-Click Stripe Test (${assetPrice.toFixed(2)})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstantSandboxPurchase('paypal')}
                            disabled={loading || !asset || isPurchasing}
                            className="text-amber-600 hover:text-amber-500 underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Simulates an approved PayPal sandbox payment and creates the paid order in Firestore immediately"
                          >
                            <span className="material-symbols-outlined text-xs">bolt</span>
                            <span>Instant 1-Click PayPal Test (${assetPrice.toFixed(2)})</span>
                          </button>
                        )}
                      </div>
                    )}
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
                        onClick={() => moreInventoryHandler(item.id)}
                        className={`flex-shrink-0 text-left p-2.5 rounded-lg border transition-all cursor-pointer w-32 ${isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50 shadow-md'
                          : 'bg-surface-variant/30 border-outline-variant/20 hover:border-primary/50 text-secondary hover:text-on-background'
                          }`}
                      >
                        <div className="w-full aspect-square rounded bg-black/40 mb-2 flex items-center justify-center border border-white/5 overflow-hidden">
                          <Model3DThumbnail
                            modelUrl={item.gltf_url || item.modelUrl || item.gltf_file_path}
                            fallbackImageUrl={item.imageUrl || item.image}
                            category={item.category}
                            cleanName={item.name || item.id}
                            className="w-full h-full"
                            aspectRatio="aspect-square"
                            badge={false}
                            interactiveOnHover={false}
                          />
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
            {/* Right Side: 3D Interactive Canvas hidden in mobile view*/}
            <div className="hidden md:block md:w-1/2 product-viewer h-[450px] md:h-full relative bg-[#0d1117] overflow-hidden group">
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
        <section className="px-margin-mobile md:px-margin-desktop py-24 max-w-[1440px] mx-auto mt-[200px] md:mt-[-100px]">
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
    </div >
  );
}

export default ProductDetails;
