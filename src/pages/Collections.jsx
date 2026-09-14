import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Collections() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('NEWEST');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cartToast, setCartToast] = useState('');
  const { addToCart } = useCart();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCollections() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'assets'));
        const items = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(items);
      } catch (err) {
        console.error("Error fetching collections:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, []);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    const price = product.price !== undefined ? Number(product.price) : 99.00;
    addToCart({
      id: product.id,
      name: (product.name || product.id).toUpperCase(),
      price: price,
      size: 'M',
      image: product.imageUrl || product.image || '',
      description: product.description || ''
    });
    setCartToast(`Added "${product.name || product.id}" to cart!`);
    setTimeout(() => setCartToast(''), 3500);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (activeCategory === 'WEBAR') return !!p.mind_file_path;
    if (activeCategory === 'VIDEO') return !!(p.video_url || p.videoUrl || p.video_file_path);
    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = a.price !== undefined ? Number(a.price) : 99.00;
    const priceB = b.price !== undefined ? Number(b.price) : 99.00;
    if (sortBy === 'PRICE_LOW') return priceA - priceB;
    if (sortBy === 'PRICE_HIGH') return priceB - priceA;
    return 0; // Newest / default order
  });

  return (
    <div className="min-h-screen bg-background text-on-background antialiased selection:bg-primary-container selection:text-on-primary-container">
      <Header />

      {/* Cart Toast Notification */}
      {cartToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-black/90 border border-emerald-500/60 text-emerald-300 text-xs font-mono px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
          <span>{cartToast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="pt-32 pb-24 px-margin-mobile md:px-margin-desktop min-h-screen">
        {/* Header Section */}
        <header className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-outline-variant/20 pb-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-primary mb-2">
              <span className="material-symbols-outlined text-sm">view_in_ar</span>
              <span>ADMIN INVENTORY ASSETS</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl mb-3 uppercase">THE 3D COLLECTION</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
              Curated digital apparel and WebAR wearable assets. Click any asset to inspect its interactive 3D model, review anchor specifications, and launch live camera try-on.
            </p>
          </div>
          <div className="flex items-center gap-4 self-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">SORT BY</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-b border-outline-variant/50 text-on-background font-body-md text-body-md py-2 focus:ring-0 focus:border-primary transition-colors outline-none cursor-pointer uppercase"
            >
              <option value="NEWEST" className="bg-neutral-900 text-white">NEWEST</option>
              <option value="PRICE_LOW" className="bg-neutral-900 text-white">PRICE: LOW TO HIGH</option>
              <option value="PRICE_HIGH" className="bg-neutral-900 text-white">PRICE: HIGH TO LOW</option>
            </select>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-gutter">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 flex-shrink-0 mb-12 lg:mb-0 hidden md:block">
            <div className="sticky top-32 space-y-12">
              <div>
                <h3 className="font-label-caps text-label-caps mb-6 text-on-background uppercase">CATEGORY</h3>
                <ul className="space-y-4 font-body-md text-body-md text-on-surface-variant">
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('ALL')}
                      className={`w-full text-left transition-colors flex justify-between cursor-pointer ${
                        activeCategory === 'ALL' ? 'text-primary font-bold' : 'hover:text-primary'
                      }`}
                    >
                      <span>All Digital Assets</span>
                      <span>({products.length})</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('WEBAR')}
                      className={`w-full text-left transition-colors flex justify-between cursor-pointer ${
                        activeCategory === 'WEBAR' ? 'text-primary font-bold' : 'hover:text-primary'
                      }`}
                    >
                      <span>WebAR Targets</span>
                      <span>({products.filter(p => p.mind_file_path).length})</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('VIDEO')}
                      className={`w-full text-left transition-colors flex justify-between cursor-pointer ${
                        activeCategory === 'VIDEO' ? 'text-primary font-bold' : 'hover:text-primary'
                      }`}
                    >
                      <span>Video Textures</span>
                      <span>({products.filter(p => p.video_url || p.videoUrl || p.video_file_path).length})</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Admin Jump - Restricted to Authenticated Superadmins */}
              {isSuperAdmin && (
                <div className="pt-6 border-t border-outline-variant/20">
                  <Link
                    to="/admin/inventory"
                    className="font-label-caps text-xs text-primary hover:underline flex items-center gap-1.5 uppercase"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Manage in Inventory</span>
                  </Link>
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <div key={n} className="rounded-xl border border-outline-variant/20 p-4 space-y-3 bg-surface-variant/20 animate-pulse">
                    <div className="aspect-[3/4] bg-black/20 rounded-lg"></div>
                    <div className="h-4 bg-black/20 rounded w-3/4"></div>
                    <div className="h-3 bg-black/20 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-outline-variant/30 rounded-2xl p-8">
                <span className="material-symbols-outlined text-5xl text-secondary mb-3">inventory_2</span>
                <h3 className="text-xl font-bold text-on-surface mb-2 uppercase">No Assets Found</h3>
                {isSuperAdmin ? (
                  <>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
                      Add 3D GLB models in Admin Inventory to display products here.
                    </p>
                    <Link
                      to="/admin/inventory"
                      className="bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-xs tracking-wider inline-flex items-center gap-2 hover:opacity-90 transition-opacity uppercase"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Asset to Inventory
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
                      New limited-edition drops are currently in production. Check back shortly.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-gutter gap-y-16">
                {sortedProducts.map((product) => {
                  const price = product.price !== undefined ? Number(product.price) : 99.00;
                  const hasVideo = !!(product.video_url || product.videoUrl || product.video_file_path);
                  const hasMind = !!product.mind_file_path;

                  return (
                    <article key={product.id} className="group cursor-pointer">
                      <Link to={`/product/${product.id}`}>
                        <div className="relative aspect-[3/4] mb-5 overflow-hidden bg-gradient-to-b from-[#111827] to-[#030712] rounded-xl border border-white/10 group-hover:border-primary/60 transition-all flex items-center justify-center">
                          <div className="text-center p-4">
                            <span className="material-symbols-outlined text-4xl text-cyan-400/80 group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-500">
                              view_in_ar
                            </span>
                            <span className="block font-mono text-[10px] text-cyan-300 mt-2 font-bold tracking-widest uppercase">
                              3D INTERACTIVE
                            </span>
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                            <span className="px-4 py-2 rounded-full bg-white text-black font-label-caps text-xs tracking-widest font-bold shadow-xl flex items-center gap-1.5">
                              <span>INSPECT IN 3D</span>
                              <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </span>
                          </div>

                          {/* Badges */}
                          <div className="absolute top-3 left-3 flex flex-col gap-1">
                            {hasMind && (
                              <div className="bg-emerald-950/80 backdrop-blur-md px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300 border border-emerald-500/40 rounded uppercase">
                                AR READY
                              </div>
                            )}
                            {hasVideo && (
                              <div className="bg-purple-950/80 backdrop-blur-md px-2 py-0.5 font-mono text-[9px] font-bold text-purple-300 border border-purple-500/40 rounded uppercase">
                                VIDEO
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-secondary">ID: {product.id}</span>
                            </div>
                            <h3 className="font-body-lg text-body-lg font-bold text-on-background uppercase truncate group-hover:text-primary transition-colors">
                              {product.name || product.id}
                            </h3>
                            <div className="flex items-center justify-between mt-2">
                              <p className="font-mono text-base font-bold text-primary">
                                ${price.toFixed(2)}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => handleAddToCart(e, product)}
                                className="font-label-caps text-[10px] tracking-widest text-primary border-b border-primary hover:opacity-70 transition-opacity uppercase z-10 relative cursor-pointer"
                              >
                                + ADD TO VAULT
                              </button>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 bg-background border-t border-outline-variant/30">
        <div className="font-headline-lg text-headline-lg text-on-background uppercase">
          STAR <span className="text-primary font-light">weAR</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <Link className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/">STOREFRONT</Link>
          <Link className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/shop">SHOP</Link>
          <Link className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/collections">COLLECTIONS</Link>
          {isSuperAdmin && (
            <Link className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/admin/inventory">ADMIN INVENTORY</Link>
          )}
          <Link className="font-label-caps text-[12px] tracking-widest text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/ar-test">AR TEST</Link>
        </div>
        <div className="font-label-caps text-[12px] tracking-widest text-on-surface-variant uppercase font-mono">
          © 2026 STAR WEAR. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}

