import React, { useState } from 'react';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db, auth } from '../firebase';

// Use a mock or test publishable key (Replace with actual)
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');

export default function Checkout() {
  const { cartItems, getCartTotal } = useCart();
  const currentUser = auth.currentUser;
  const [isProcessing, setIsProcessing] = useState(false);
  const subtotal = getCartTotal();

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const stripe = await stripePromise;
      const createCheckoutSession = httpsCallable(functions, 'createStripeCheckoutSession');
      
      // Create a pending order in Firestore
      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: currentUser ? currentUser.uid : 'guest',
        customerEmail: currentUser ? currentUser.email : '',
        items: cartItems,
        total: subtotal,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      const response = await createCheckoutSession({
        items: cartItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || "https://via.placeholder.com/150"
        })),
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderRef.id}`,
        cancelUrl: window.location.origin + '/cart',
      });

      const { id } = response.data;
      
      const { error } = await stripe.redirectToCheckout({ sessionId: id });
      
      if (error) {
        console.error("Stripe Checkout Error:", error);
        alert(error.message);
      }
    } catch (err) {
      console.error("Checkout process failed:", err);
      alert("Failed to initiate checkout. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-32 grid grid-cols-1 lg:grid-cols-12 gap-gutter lg:gap-16">
        {/* Left Column: Checkout Steps */}
        <div className="lg:col-span-7 space-y-16">
          <section>
            <div className="flex items-center gap-4 mb-8">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary font-label-caps text-label-caps">1</span>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:text-3xl font-bold tracking-wide">PAYMENT</h2>
            </div>
            
            {cartItems.length > 0 ? (
                <div className="bg-surface-variant p-6 rounded-lg text-center">
                  <span className="material-symbols-outlined text-4xl text-primary mb-2">lock</span>
                  <p className="font-body-md text-on-surface mb-2">Secure Payment via Stripe</p>
                  <p className="text-sm text-secondary">You will be redirected to Stripe to securely complete your purchase.</p>
                </div>
            ) : (
              <p className="text-secondary">Your cart is empty.</p>
            )}
          </section>
          
          <div className="pt-8">
            <button 
              disabled={cartItems.length === 0 || isProcessing}
              onClick={handleCheckout}
              className="w-full md:w-auto bg-on-background text-on-primary font-label-caps text-label-caps py-4 px-12 hover:bg-tertiary transition-colors duration-300 rounded tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                  PROCESSING...
                </>
              ) : (
                'PROCEED TO PAYMENT'
              )}
            </button>
          </div>
        </div>
        
        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 relative mt-16 lg:mt-0">
          <div className="sticky top-32 bg-surface-container-lowest p-8 rounded-lg shadow-sm border border-outline-variant/20">
            <h3 className="font-headline-lg-mobile text-2xl font-bold tracking-wide mb-8">ORDER SUMMARY</h3>
            
            {/* Items */}
            <div className="space-y-6 mb-8 border-b border-outline-variant/30 pb-8 max-h-[50vh] overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="text-secondary text-sm">No items in cart</div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 items-start">
                    <div className="w-20 h-24 bg-surface-container overflow-hidden rounded flex-shrink-0">
                      <img 
                        alt={item.name}
                        className="w-full h-full object-cover mix-blend-multiply" 
                        src={item.image || "https://lh3.googleusercontent.com/aida-public/AB6AXuA_lPkQp6i1iZnEAk_2TeaylzhDzLW-XhRcKPttTLT1OTzraJo9veg0F-EMKVYrI78nNMmi-zV_9hoI0wtDrEIVas-Gqn5ntJnuFMhVBEG_5oeniqUXyVhJZPnUTZS-4gbyL8dWi_ylDWVts8nNh0jWtR9pIS1SjldmXqeh-XJXRQvV00UPW9JSJJYIN81IJyKEKakN5Dk1cEalWZK0RpfQ2YNSZ8nK1Zg07WFPhbVJy9Bh37yY0xTwXiruuzCdM-OMwnMBtFveOtk"} 
                      />
                    </div>
                    <div className="flex-grow flex flex-col justify-between h-full">
                      <div>
                        <h4 className="font-label-caps text-label-caps text-on-background mb-1">{item.name}</h4>
                        <p className="text-sm text-secondary">Format: Digital Asset</p>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-secondary">Qty: {item.quantity}</span>
                        <span className="font-body-md text-on-background">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Totals */}
            <div className="space-y-4 font-body-md text-sm text-on-surface-variant mb-8 border-b border-outline-variant/30 pb-8">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-on-background">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes</span>
                <span className="text-secondary">Calculated at next step</span>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <span className="font-label-caps text-label-caps tracking-widest text-on-background">TOTAL</span>
              <span className="font-body-lg text-xl font-bold text-on-background">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8 border-t border-outline-variant/30 bg-background text-on-background font-body-md text-body-md mt-auto">
        <div className="font-headline-lg text-headline-lg text-on-background tracking-widest">
            LUXE EDITORIAL
        </div>
        <div className="text-secondary text-sm">
            © 2024 LUXE EDITORIAL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex gap-6 font-label-caps text-label-caps">
          <a className="text-secondary hover:text-on-background transition-colors hover:underline uppercase" href="#">PRIVACY POLICY</a>
          <a className="text-secondary hover:text-on-background transition-colors hover:underline uppercase" href="#">TERMS OF SERVICE</a>
        </div>
      </footer>
    </div>
  );
}
