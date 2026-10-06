import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { capturePayPalOrder } from '../services/paypalService';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const rawGateway = searchParams.get('gateway');
  const paypalToken = searchParams.get('token');
  const sessionId = searchParams.get('session_id') || paypalToken;
  const orderId = searchParams.get('order_id');
  const payerId = searchParams.get('PayerID');
  const isSandbox = searchParams.get('sandbox') === '1';
  const { clearCart } = useCart();
  const [processed, setProcessed] = useState(false);

  // Determine whether this was a Stripe or PayPal transaction
  const isStripe = rawGateway === 'stripe' || (sessionId && sessionId.startsWith('cs_'));

  useEffect(() => {
    const handleSuccess = async () => {
      if (processed) return;
      setProcessed(true);

      // 1. Clear cart
      try {
        clearCart();
      } catch (e) {
        console.warn('Cart clear error:', e);
      }

      // 2. If PayPal order returned with token, ensure order is captured
      if (!isStripe && sessionId) {
        try {
          await capturePayPalOrder({
            orderId: sessionId,
            orderDocId: orderId
          });
        } catch (captureErr) {
          console.warn('Post-redirect capture note:', captureErr.message);
        }
      }

      // 3. Mark Firestore order document paid
      if (orderId) {
        try {
          const orderRef = doc(db, 'orders', orderId);
          if (isStripe) {
            await updateDoc(orderRef, {
              status: 'paid',
              stripeSessionId: sessionId || '',
              paymentMethod: 'stripe',
              testMode: isSandbox || Boolean(sessionId && sessionId.startsWith('cs_test_')),
              paidAt: serverTimestamp()
            });
          } else {
            await updateDoc(orderRef, {
              status: 'paid',
              paypalOrderId: sessionId || '',
              payerId: payerId || '',
              paymentMethod: 'paypal',
              testMode: isSandbox,
              paidAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error('Error updating order status in Firestore:', error);
        }
      }
    };

    if (sessionId || orderId) {
      handleSuccess();
    }
  }, [processed, sessionId, orderId, payerId, isStripe, isSandbox, clearCart]);

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background flex flex-col">
      <Header />

      <main className="flex-grow max-w-[800px] w-full mx-auto px-6 py-28 text-center flex flex-col justify-center">
        <div className="bg-surface-container-lowest border border-outline-variant/30 p-8 sm:p-14 rounded-3xl shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>

          {isStripe ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs font-mono font-semibold mb-4 border border-indigo-200 dark:border-indigo-800">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Stripe Payment Confirmed {isSandbox && '• Sandbox Test'}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-semibold mb-4 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              PayPal Payment Confirmed {isSandbox && '• Sandbox Test'}
            </div>
          )}

          <h1 className="font-headline-lg text-headline-lg-mobile md:text-3xl font-bold text-on-background mb-4">
            Payment Successful
          </h1>

          <p className="text-secondary max-w-md mx-auto mb-8 text-sm sm:text-base leading-relaxed">
            Thank you for your order with Star weAR. Your digital garments and WebAR interactive experiences are now unlocked and ready.
          </p>

          {(sessionId || orderId) && (
            <div className="bg-surface-variant/30 px-6 py-3 rounded-xl text-xs text-secondary font-mono mb-8 border border-outline-variant/20 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
              {sessionId && <span>Transaction Ref: <strong className="text-on-background">{sessionId.substring(0, 18)}...</strong></span>}
              {orderId && <span>Order ID: <strong className="text-on-background">{orderId.substring(0, 12)}...</strong></span>}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-[420px]">
            <Link
              to="/shop"
              className="flex-1 py-3.5 bg-primary text-on-primary font-label-caps text-xs tracking-widest text-center hover:opacity-90 transition-opacity rounded-xl font-semibold"
            >
              CONTINUE SHOPPING
            </Link>
            <Link
              to="/"
              className="flex-1 py-3.5 border border-outline-variant text-on-background font-label-caps text-xs tracking-widest text-center hover:bg-surface-variant/50 transition-colors rounded-xl font-semibold"
            >
              RETURN HOME
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full py-8 text-center text-xs text-secondary border-t border-outline-variant/20 bg-background">
        © {new Date().getFullYear()} STAR WEAR. POWERED BY {isStripe ? 'STRIPE' : 'PAYPAL'} CHECKOUT.
      </footer>
    </div>
  );
};

export default OrderSuccess;
