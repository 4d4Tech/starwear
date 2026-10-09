import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Header from '../components/Header';
import Model3DThumbnail from '../components/Model3DThumbnail';
import { CURATED_COLLECTION } from './Shop';
import { resolveCartItemModel } from '../utils/cartModelResolver';
import { useCart } from '../context/CartContext';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';

export default function ShoppingCart() {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const { isSandboxMode, activeGateway } = usePaymentEnvironment();
  const subtotal = getCartTotal();
  const [isProcessing, setIsProcessing] = useState(false);
  const [remoteAssets, setRemoteAssets] = useState({});

  // Sync remote assets to resolve 3D models for items from inventory
  useEffect(() => {
    let isMounted = true;
    async function fetchAssets() {
      try {
        const snap = await getDocs(collection(db, 'assets'));
        if (!snap.empty && isMounted) {
          const map = {};
          snap.docs.forEach((d) => {
            map[d.id] = { id: d.id, ...d.data() };
          });
          setRemoteAssets(map);
        }
      } catch (err) {
        console.warn('Cart remote assets sync:', err);
      }
    }
    fetchAssets();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSandboxBuyItem = async (item) => {
    setIsProcessing(true);
    const itemTotal = (Number(item.price) || 0) * (item.quantity || 1);
    const itemPayload = {
      id: item.id || '',
      name: item.name || 'Digital Garment',
      price: Number(item.price) || 0,
      quantity: item.quantity || 1,
      size: item.size || 'One Size',
      image: item.image || item.thumbnailUrl || ''
    };

    try {
      if (activeGateway === 'stripe') {
        const { startDirectStripeCheckout } = await import('../services/stripeService');
        await startDirectStripeCheckout({
          items: [itemPayload],
          total: itemTotal,
          metadata: {
            source: 'cart_single_item_sandbox_btn',
            itemId: item.id
          }
        });
      } else {
        const { startDirectPayPalCheckout } = await import('../services/paypalService');
        await startDirectPayPalCheckout({
          items: [itemPayload],
          total: itemTotal,
          metadata: {
            source: 'cart_single_item_sandbox_btn',
            itemId: item.id
          }
        });
      }
    } catch (err) {
      console.error('Cart item sandbox error:', err);
      alert(`Sandbox purchase failed: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handleSandboxCheckoutCart = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    const itemsPayload = cartItems.map((item) => ({
      id: item.id || '',
      name: item.name || 'Digital Garment',
      price: Number(item.price) || 0,
      quantity: item.quantity || 1,
      size: item.size || 'One Size',
      image: item.image || item.thumbnailUrl || ''
    }));

    try {
      if (activeGateway === 'stripe') {
        const { startDirectStripeCheckout } = await import('../services/stripeService');
        await startDirectStripeCheckout({
          items: itemsPayload,
          total: subtotal,
          metadata: {
            source: 'cart_sandbox_checkout_btn',
            itemCount: cartItems.length
          }
        });
      } else {
        const { startDirectPayPalCheckout } = await import('../services/paypalService');
        await startDirectPayPalCheckout({
          items: itemsPayload,
          total: subtotal,
          metadata: {
            source: 'cart_sandbox_checkout_btn',
            itemCount: cartItems.length
          }
        });
      }
    } catch (err) {
      console.error('Cart sandbox checkout error:', err);
      alert(`Sandbox purchase failed: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col font-body-md selection:bg-primary-container selection:text-on-primary-container">
      <Header />

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-24 px-margin-mobile md:px-margin-desktop w-full max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold uppercase mb-3">
            <span>$ antigravity bag --active</span>
          </div>
          <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-background mb-4 font-bold tracking-wide">
            YOUR DIGITAL BAG
          </h1>
          <p className="font-body-lg text-body-lg text-secondary">
            Review your physical chassis foundations and swappable 3D visual skins before proceeding to checkout.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
          {/* Cart Items List */}
          <div className="w-full lg:w-2/3 flex flex-col gap-8">
            {cartItems.length === 0 ? (
              <div className="p-12 rounded-2xl bg-surface-container/40 border border-outline-variant/30 text-center space-y-4">
                <span className="material-symbols-outlined text-5xl text-secondary">shopping_bag</span>
                <p className="text-secondary font-mono text-sm">Your digital closet bag is currently empty.</p>
                <Link
                  to="/shop"
                  className="inline-block px-6 py-2.5 rounded-full bg-primary text-white font-mono text-xs font-semibold hover:bg-primary/90 transition-all"
                >
                  Browse 3D Chassis Drops →
                </Link>
              </div>
            ) : (
              cartItems.map((item) => {
                const resolved = resolveCartItemModel(item, remoteAssets);
                const targetId = item.baseId || item.id?.split('-')[0] || item.id;
                const isCurated = CURATED_COLLECTION.some((c) => c.id === targetId || item.id?.startsWith(c.id));
                const itemPrice = Number(item.price) || 0;
                const itemTotal = itemPrice * (item.quantity || 1);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row gap-6 pb-8 border-b border-outline-variant/30 relative group items-start sm:items-stretch"
                  >
                    {/* 3D Model Thumbnail Representation */}
                    <div className="w-full sm:w-44 md:w-48 aspect-[3/4] bg-[#0d0d10] relative overflow-hidden shrink-0 rounded-2xl border border-white/10 shadow-lg">
                      <Model3DThumbnail
                        modelUrl={resolved.modelUrl}
                        fallbackImageUrl={resolved.fallbackImage}
                        cleanName={resolved.cleanName}
                        category={resolved.category}
                        className="w-full h-full"
                        aspectRatio="aspect-[3/4]"
                        badge="3D MODEL"
                        interactiveOnHover={true}
                      />
                    </div>

                    <div className="flex flex-col justify-between flex-grow py-1 w-full space-y-4 sm:space-y-0">
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase font-semibold">
                                Living WebAR Chassis
                              </span>
                              {targetId && (
                                <Link
                                  to={isCurated ? `/shop#studio` : `/product/${targetId}`}
                                  className="text-[10px] font-mono text-cyan-500 hover:text-cyan-400 hover:underline flex items-center gap-0.5"
                                  title="View in 3D Preview"
                                >
                                  <span className="material-symbols-outlined text-xs">view_in_ar</span>
                                  <span>View in 3D</span>
                                </Link>
                              )}
                            </div>
                            <h3 className="font-body-lg text-lg sm:text-xl font-bold text-on-background tracking-tight">
                              {item.name}
                            </h3>
                          </div>
                          <span className="font-body-lg text-lg font-bold text-on-background shrink-0 font-mono">
                            ${itemTotal.toFixed(2)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-secondary line-clamp-2 mb-3 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary font-mono mb-2">
                          <span>
                            Size: <strong className="text-on-background font-semibold">{item.size || 'One Size'}</strong>
                          </span>
                          {item.color && (
                            <span>
                              Color: <strong className="text-on-background font-semibold">{item.color}</strong>
                            </span>
                          )}
                          <span>
                            Unit Price: <strong className="text-on-background font-semibold">${itemPrice.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-outline-variant/15">
                        <div className="flex items-center space-x-3 border border-outline-variant/50 rounded-full px-3.5 py-1.5 w-max bg-black/5 dark:bg-white/5">
                          <button
                            className="text-secondary hover:text-on-background transition-colors cursor-pointer flex items-center justify-center"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="font-mono text-xs font-semibold w-5 text-center">{item.quantity}</span>
                          <button
                            className="text-secondary hover:text-on-background transition-colors cursor-pointer flex items-center justify-center"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          {isSandboxMode && (
                            <button
                              type="button"
                              onClick={() => handleSandboxBuyItem(item)}
                              disabled={isProcessing}
                              className="px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 font-mono"
                              title={`Send a ${activeGateway === 'stripe' ? 'Stripe' : 'PayPal'} Sandbox purchase for ${item.name}`}
                            >
                              <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                              <span>Sandbox Buy • ${itemTotal.toFixed(2)}</span>
                            </button>
                          )}

                          <button
                            className="font-label-caps text-xs text-secondary hover:text-red-500 transition-colors uppercase border-b border-transparent hover:border-red-500 pb-0.5 tracking-wider cursor-pointer font-mono"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-1/3">
            <div className="sticky top-32 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 shadow-xl space-y-8">
              <h2 className="font-headline-lg-mobile text-2xl font-bold text-on-background tracking-wide">
                SUMMARY
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Subtotal</span>
                  <span className="text-on-background font-mono font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Express Shipping</span>
                  <span className="text-emerald-500 font-mono text-xs font-semibold">FREE (WORLDWIDE)</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Taxes &amp; Duties</span>
                  <span className="font-mono">$0.00</span>
                </div>
              </div>

              <div className="border-t border-outline-variant/30 pt-6">
                <div className="flex justify-between items-end">
                  <span className="font-body-lg text-body-lg text-on-background">Total</span>
                  <span className="font-headline-lg-mobile text-2xl font-bold text-on-background font-mono">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <Link
                to="/checkout"
                className={`block w-full bg-on-background text-on-primary py-4 px-6 font-label-caps text-xs tracking-widest text-center transition-colors duration-300 rounded-xl font-mono ${
                  cartItems.length === 0 ? 'opacity-50 pointer-events-none' : 'hover:bg-primary'
                }`}
              >
                [ PROCEED TO CHECKOUT ]
              </Link>

              {isSandboxMode && (
                <button
                  type="button"
                  onClick={handleSandboxCheckoutCart}
                  disabled={cartItems.length === 0 || isProcessing}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-label-caps text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 font-mono"
                  title={`Send a ${activeGateway === 'stripe' ? 'Stripe' : 'PayPal'} Sandbox purchase for the total cart of $${subtotal.toFixed(2)}`}
                >
                  <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                  <span>SEND SANDBOX PURCHASE • ${subtotal.toFixed(2)} USD</span>
                </button>
              )}

              <div className="pt-2 flex justify-center items-center gap-2 text-xs font-mono text-secondary">
                <span className="material-symbols-outlined text-sm text-emerald-500">lock</span>
                <span className="tracking-wider uppercase">ENCRYPTED SPATIAL CHECKOUT</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 bg-background border-t border-outline-variant/30 mt-auto text-on-background">
        <div className="font-headline-lg text-xl font-bold text-on-background tracking-widest">
          STAR <span className="text-primary font-light">weAR</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 font-label-caps text-xs tracking-widest">
          <Link className="text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/">
            HOME
          </Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/shop">
            SHOP
          </Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/collections">
            COLLECTIONS
          </Link>
          <Link className="text-secondary hover:text-on-background hover:underline transition-all uppercase" to="/about">
            ABOUT
          </Link>
        </div>
        <div className="font-mono text-xs text-secondary">
          © 2026 STAR WEAR INC. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
