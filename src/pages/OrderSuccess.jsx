import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  const { clearCart } = useCart();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const handleSuccess = async () => {
      if (!cleared && sessionId) {
        clearCart();
        setCleared(true);
        
        if (orderId) {
          try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
              status: 'paid'
            });
          } catch (error) {
            console.error("Error updating order status:", error);
          }
        }
      }
    };
    handleSuccess();
  }, [cleared, sessionId, orderId, clearCart]);

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <Header />
      
      <main className="max-w-[800px] mx-auto px-6 py-24 text-center">
        <div className="glass-panel p-12 rounded-lg flex flex-col items-center">
          <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-4">
            Payment Successful
          </h1>
          
          <p className="text-secondary mb-8 text-lg">
            Thank you for your order. Your digital garments will be available in your account shortly.
          </p>

          {sessionId && (
            <div className="bg-surface-variant/30 px-6 py-3 rounded text-sm text-outline font-mono mb-8">
              Order Reference: {sessionId.substring(0, 16)}...
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-[400px]">
            <Link 
              to="/collections" 
              className="flex-1 py-4 bg-primary text-on-primary font-label-caps text-label-caps tracking-[0.1em] text-center hover:opacity-90 transition-opacity rounded"
            >
              CONTINUE SHOPPING
            </Link>
            <Link 
              to="/" 
              className="flex-1 py-4 border border-outline text-on-background font-label-caps text-label-caps tracking-[0.1em] text-center hover:bg-surface-variant transition-colors rounded"
            >
              RETURN HOME
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderSuccess;
