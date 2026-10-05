import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { startDirectPayPalCheckout } from '../services/paypalService';

export default function ShoppingCart() {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();
  const subtotal = getCartTotal();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSandboxBuyItem = async (item) => {
    setIsProcessing(true);
    const itemTotal = (Number(item.price) || 0) * (item.quantity || 1);
    try {
      await startDirectPayPalCheckout({
        items: [{
          id: item.id || '',
          name: item.name || 'Digital Garment',
          price: Number(item.price) || 0,
          quantity: item.quantity || 1,
          size: item.size || 'One Size',
          image: item.image || ''
        }],
        total: itemTotal,
        metadata: {
          source: 'cart_single_item_sandbox_btn',
          itemId: item.id
        }
      });
    } catch (err) {
      console.error('Cart item sandbox error:', err);
      alert(`Sandbox purchase failed: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handleSandboxCheckoutCart = async () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    try {
      await startDirectPayPalCheckout({
        items: cartItems.map(item => ({
          id: item.id || '',
          name: item.name || 'Digital Garment',
          price: Number(item.price) || 0,
          quantity: item.quantity || 1,
          size: item.size || 'One Size',
          image: item.image || ''
        })),
        total: subtotal,
        metadata: {
          source: 'cart_sandbox_checkout_btn',
          itemCount: cartItems.length
        }
      });
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
          <h1 className="font-headline-xl text-headline-lg-mobile md:text-headline-xl text-on-background mb-4 font-bold tracking-wide">
            YOUR CART
          </h1>
          <p className="font-body-lg text-body-lg text-secondary">
            Review your selections before proceeding to checkout.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
          {/* Cart Items List */}
          <div className="w-full lg:w-2/3 flex flex-col gap-8">
            {cartItems.length === 0 ? (
              <p className="text-secondary">Your cart is empty.</p>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-6 pb-8 border-b border-outline-variant/30 relative group">
                  <div className="w-full sm:w-48 aspect-[3/4] bg-surface-container relative overflow-hidden shrink-0 rounded">
                    <img
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 mix-blend-multiply"
                      src={item.image || "https://lh3.googleusercontent.com/aida-public/AB6AXuA_lPkQp6i1iZnEAk_2TeaylzhDzLW-XhRcKPttTLT1OTzraJo9veg0F-EMKVYrI78nNMmi-zV_9hoI0wtDrEIVas-Gqn5ntJnuFMhVBEG_5oeniqUXyVhJZPnUTZS-4gbyL8dWi_ylDWVts8nNh0jWtR9pIS1SjldmXqeh-XJXRQvV00UPW9JSJJYIN81IJyKEKakN5Dk1cEalWZK0RpfQ2YNSZ8nK1Zg07WFPhbVJy9Bh37yY0xTwXiruuzCdM-OMwnMBtFveOtk"}
                    />
                  </div>
                  
                  <div className="flex flex-col justify-between flex-grow py-2">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-body-lg text-body-lg font-semibold text-on-background">{item.name}</h3>
                        <span className="font-body-lg text-body-lg text-on-background">${item.price.toFixed(2)}</span>
                      </div>
                      <p className="font-body-md text-body-md text-secondary mb-1">Color: {item.color || 'Standard'}</p>
                      <p className="font-body-md text-body-md text-secondary mb-4">Size: {item.size || 'One Size'}</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center space-x-4 border border-outline-variant/50 rounded-full px-4 py-2 w-max">
                        <button 
                          className="text-secondary hover:text-on-background transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>remove</span>
                        </button>
                        <span className="font-body-md text-body-md w-4 text-center">{item.quantity}</span>
                        <button 
                          className="text-secondary hover:text-on-background transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>add</span>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleSandboxBuyItem(item)}
                          disabled={isProcessing}
                          className="px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          title={`Send a PayPal Sandbox purchase for ${item.name} at its price of $${((Number(item.price) || 0) * (item.quantity || 1)).toFixed(2)}`}
                        >
                          <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                          <span>Sandbox Buy • ${((Number(item.price) || 0) * (item.quantity || 1)).toFixed(2)}</span>
                        </button>

                        <button 
                          className="font-label-caps text-label-caps text-secondary hover:text-error transition-colors uppercase border-b border-transparent hover:border-error pb-0.5 tracking-widest cursor-pointer"
                          onClick={() => removeFromCart(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-1/3">
            <div className="sticky top-32 bg-surface-container-lowest p-8 rounded border border-outline-variant/20 shadow-sm">
              <h2 className="font-headline-lg-mobile text-2xl font-bold text-on-background mb-8 tracking-wide">SUMMARY</h2>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Subtotal</span>
                  <span className="text-on-background">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Estimated Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between font-body-md text-body-md text-secondary">
                  <span>Taxes</span>
                  <span>$0.00</span>
                </div>
              </div>
              
              <div className="border-t border-outline-variant/30 pt-6 mb-8">
                <div className="flex justify-between items-end">
                  <span className="font-body-lg text-body-lg text-on-background">Total</span>
                  <span className="font-headline-lg-mobile text-2xl font-bold text-on-background">${subtotal.toFixed(2)}</span>
                </div>
              </div>
              
              <Link 
                to="/checkout"
                className={`block w-full bg-on-background text-on-primary py-4 px-6 font-label-caps text-label-caps tracking-widest text-center transition-colors duration-300 rounded ${cartItems.length === 0 ? 'opacity-50 pointer-events-none' : 'hover:bg-tertiary'}`}
              >
                PROCEED TO CHECKOUT
              </Link>

              <button
                type="button"
                onClick={handleSandboxCheckoutCart}
                disabled={cartItems.length === 0 || isProcessing}
                className="mt-3 w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-label-caps text-xs font-bold rounded shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                title={`Send a PayPal Sandbox purchase for the total cart of $${subtotal.toFixed(2)}`}
              >
                <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                <span>SEND SANDBOX PURCHASE • ${subtotal.toFixed(2)} USD</span>
              </button>
              
              <div className="mt-6 flex justify-center gap-4 text-secondary">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>lock</span>
                <span className="font-label-caps text-label-caps tracking-widest">SECURE CHECKOUT</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 bg-background border-t border-outline-variant/30 mt-auto text-on-background">
        <div className="font-headline-lg text-headline-lg text-on-background tracking-widest">
            LUXE EDITORIAL
        </div>
        <div className="flex flex-wrap justify-center gap-6 font-label-caps text-label-caps tracking-widest">
          <a className="text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">PRIVACY POLICY</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">TERMS OF SERVICE</a>
          <a className="text-secondary hover:text-on-background hover:underline transition-all uppercase" href="#">SHIPPING & RETURNS</a>
        </div>
        <div className="font-body-md text-sm text-secondary">
            © 2024 LUXE EDITORIAL. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
