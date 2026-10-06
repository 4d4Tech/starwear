import React, { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  PAYPAL_CLIENT_ID,
  getPayPalScriptOptions,
  createFirestoreOrder,
  createPayPalOrder,
  capturePayPalOrder,
  startDirectPayPalCheckout,
  executeInstantSandboxPurchase
} from '../services/paypalService';
import {
  startDirectStripeCheckout,
  executeInstantStripeSandboxPurchase
} from '../services/stripeService';
import { CURATED_COLLECTION } from './Shop';
import { usePaymentEnvironment } from '../context/PaymentEnvironmentContext';

export default function Checkout() {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { isSandboxMode, activeGateway, isPayPalEnabled, isStripeEnabled } = usePaymentEnvironment();
  const [selectedMethod, setSelectedMethod] = useState(() => {
    return activeGateway === 'stripe' ? 'stripe' : 'paypal';
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const activeOrderDocIdRef = useRef(null);

  useEffect(() => {
    if (activeGateway === 'stripe') setSelectedMethod('stripe');
    else if (activeGateway === 'paypal') setSelectedMethod('paypal');
  }, [activeGateway]);

  // Check for direct product query (e.g. /checkout?productId=... or ?id=...)
  const directProductId = searchParams.get('productId') || searchParams.get('id') || searchParams.get('product') || searchParams.get('batchId');
  const [directProduct, setDirectProduct] = useState(null);
  const [loadingDirect, setLoadingDirect] = useState(false);

  useEffect(() => {
    if (cartItems.length === 0 && directProductId) {
      let isMounted = true;
      setLoadingDirect(true);

      async function fetchDirectProduct() {
        try {
          const docRef = doc(db, 'assets', directProductId);
          const snap = await getDoc(docRef);
          if (snap.exists() && isMounted) {
            const data = snap.data();
            setDirectProduct({
              id: snap.id,
              name: (data.name || snap.id).toUpperCase(),
              price: data.price !== undefined ? Number(data.price) : 99.00,
              quantity: 1,
              image: data.imageUrl || data.image || '',
              description: data.description || 'Exclusive Star weAR Digital Garment'
            });
            setLoadingDirect(false);
            return;
          }

          // Fallback to batches collection
          const bRef = doc(db, 'batches', directProductId);
          const bSnap = await getDoc(bRef);
          if (bSnap.exists() && isMounted) {
            const bData = bSnap.data();
            setDirectProduct({
              id: bSnap.id,
              name: (bData.name || bSnap.id).toUpperCase(),
              price: bData.price !== undefined ? Number(bData.price) : 99.00,
              quantity: 1,
              image: bData.imageUrl || '',
              description: bData.description || 'Exclusive Star weAR Digital Garment'
            });
            setLoadingDirect(false);
            return;
          }

          // Fallback to CURATED_COLLECTION
          const curated = CURATED_COLLECTION?.find(p => p.id === directProductId);
          if (curated && isMounted) {
            const paramPrice = searchParams.get('price');
            setDirectProduct({
              id: curated.id,
              name: curated.name.toUpperCase(),
              price: paramPrice ? Number(paramPrice) : (curated.price !== undefined ? Number(curated.price) : 280.00),
              quantity: 1,
              image: curated.imageUrl || '',
              description: curated.heroDescription || 'Exclusive Star weAR Digital Garment'
            });
            setLoadingDirect(false);
            return;
          }

          // Fallback to direct URL params
          const paramPrice = searchParams.get('price');
          const paramName = searchParams.get('name');
          if (paramPrice && isMounted) {
            setDirectProduct({
              id: directProductId,
              name: (paramName || directProductId).toUpperCase(),
              price: Number(paramPrice),
              quantity: 1,
              image: searchParams.get('image') || '',
              description: 'Exclusive Star weAR Digital Garment'
            });
          }
        } catch (err) {
          console.warn('Direct product fetch notice:', err);
        } finally {
          if (isMounted) setLoadingDirect(false);
        }
      }

      fetchDirectProduct();
      return () => { isMounted = false; };
    }
  }, [cartItems.length, directProductId]);

  // Active items being checked out
  const activeItems = cartItems.length > 0
    ? cartItems
    : (directProduct ? [directProduct] : []);

  const subtotal = cartItems.length > 0
    ? getCartTotal()
    : (directProduct ? (Number(directProduct.price) * (directProduct.quantity || 1)) : 0);

  // Create PayPal Order
  const handleCreateOrder = async (data, actions) => {
    setErrorMessage('');
    setIsProcessing(true);
    try {
      const itemsPayload = activeItems.map((item) => ({
        id: item.id || '',
        name: item.name || 'Digital Garment',
        price: Number(item.price) || 0,
        quantity: item.quantity || 1,
        image: item.image || ''
      }));

      const orderDocId = await createFirestoreOrder({
        items: itemsPayload,
        total: subtotal,
        metadata: {
          source: directProduct ? 'direct_product_checkout' : 'cart_checkout',
          itemCount: activeItems.length
        }
      });
      activeOrderDocIdRef.current = orderDocId;

      const backendRes = await createPayPalOrder({
        items: itemsPayload,
        total: subtotal,
        orderDocId,
        successUrl: `${window.location.origin}/success?order_id=${orderDocId}`,
        cancelUrl: `${window.location.origin}/checkout`
      });

      if (backendRes && backendRes.id) {
        return backendRes.id;
      }

      if (actions && actions.order) {
        return actions.order.create({
          purchase_units: [
            {
              description: 'Star weAR Digital Garments',
              custom_id: orderDocId,
              amount: {
                currency_code: 'USD',
                value: subtotal.toFixed(2),
                breakdown: {
                  item_total: {
                    currency_code: 'USD',
                    value: subtotal.toFixed(2)
                  }
                }
              },
              items: itemsPayload.map((item) => ({
                name: (item.name || 'Item').substring(0, 127),
                unit_amount: {
                  currency_code: 'USD',
                  value: item.price.toFixed(2)
                },
                quantity: String(item.quantity)
              }))
            }
          ]
        });
      }

      throw new Error('Unable to initialize PayPal order session.');
    } catch (err) {
      console.error('Failed to create PayPal order:', err);
      setErrorMessage(err.message || 'Error initializing PayPal checkout.');
      setIsProcessing(false);
      throw err;
    }
  };

  // Capture Approved PayPal Order
  const handleApprove = async (data, actions) => {
    setIsProcessing(true);
    setErrorMessage('');
    const orderDocId = activeOrderDocIdRef.current;

    try {
      const captureResult = await capturePayPalOrder({
        orderId: data.orderID,
        orderDocId
      });

      if (!captureResult?.success && actions?.order) {
        await actions.order.capture();
      }

      clearCart();
      const redirectUrl = `/success?session_id=${data.orderID}${orderDocId ? `&order_id=${orderDocId}` : ''}`;
      navigate(redirectUrl);
    } catch (err) {
      console.error('PayPal Capture failed:', err);
      setErrorMessage('Payment capture encountered an issue. If charged, please check order history.');
      setIsProcessing(false);
    }
  };

  // Direct Stripe Checkout Session redirect
  const handleStripeCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const itemsPayload = activeItems.map((item) => ({
        id: item.id || '',
        name: item.name || 'Digital Garment',
        price: Number(item.price) || 0,
        quantity: item.quantity || 1,
        image: item.image || '',
        size: item.size || 'M'
      }));

      await startDirectStripeCheckout({
        items: itemsPayload,
        total: subtotal,
        metadata: {
          source: directProduct ? 'direct_product_checkout' : 'cart_checkout',
          itemCount: activeItems.length
        }
      });
    } catch (err) {
      console.error('Stripe Checkout error:', err);
      setErrorMessage(err.message || 'Stripe Checkout encountered an issue.');
      setIsProcessing(false);
    }
  };

  // Instant 1-Click Stripe Sandbox Test
  const handleInstantStripeSandbox = async (singleItem = null) => {
    setIsProcessing(true);
    setErrorMessage('');
    const targetItems = singleItem ? [singleItem] : activeItems;
    const targetTotal = singleItem
      ? (Number(singleItem.price) || 99.00) * (singleItem.quantity || 1)
      : subtotal;

    try {
      if (!singleItem) clearCart();
      await executeInstantStripeSandboxPurchase({
        items: targetItems.map((item) => ({
          id: item.id || '',
          name: item.name || 'Digital Garment',
          price: Number(item.price) || 99.00,
          quantity: item.quantity || 1,
          image: item.image || ''
        })),
        total: targetTotal,
        metadata: {
          source: singleItem ? 'single_product_sandbox_btn' : 'checkout_sandbox_btn',
          itemCount: targetItems.length
        }
      });
    } catch (err) {
      console.error('Instant Stripe sandbox failed:', err);
      setErrorMessage(err.message || 'Instant Stripe sandbox purchase failed.');
      setIsProcessing(false);
    }
  };

  // Send Sandbox Purchase directly for a single product with its exact price
  const handlePurchaseSingleProduct = async (product) => {
    setIsProcessing(true);
    setErrorMessage('');
    const itemPrice = Number(product.price) || 99.00;
    const itemQty = product.quantity || 1;
    const itemTotal = itemPrice * itemQty;

    try {
      if (activeGateway === 'stripe' || selectedMethod === 'stripe') {
        await startDirectStripeCheckout({
          items: [{
            id: product.id || '',
            name: product.name || 'Digital Garment',
            price: itemPrice,
            quantity: itemQty,
            image: product.image || ''
          }],
          total: itemTotal,
          metadata: {
            singleItemCheckout: true,
            productId: product.id
          }
        });
      } else {
        await startDirectPayPalCheckout({
          items: [{
            id: product.id || '',
            name: product.name || 'Digital Garment',
            price: itemPrice,
            quantity: itemQty,
            image: product.image || ''
          }],
          total: itemTotal,
          metadata: {
            singleItemCheckout: true,
            productId: product.id
          }
        });
      }
    } catch (err) {
      console.error('Single product sandbox checkout failed:', err);
      setErrorMessage(err.message || 'Error initializing sandbox checkout for this product.');
      setIsProcessing(false);
    }
  };

  // Instant 1-Click Sandbox Test Purchase (for all active items or a single item)
  const handleInstantSandboxPurchase = async (singleItem = null) => {
    if (activeGateway === 'stripe' || selectedMethod === 'stripe') {
      return handleInstantStripeSandbox(singleItem);
    }

    setIsProcessing(true);
    setErrorMessage('');
    const targetItems = singleItem ? [singleItem] : activeItems;
    const targetTotal = singleItem
      ? (Number(singleItem.price) || 99.00) * (singleItem.quantity || 1)
      : subtotal;

    try {
      if (!singleItem) clearCart();
      await executeInstantSandboxPurchase({
        items: targetItems.map((item) => ({
          id: item.id || '',
          name: item.name || 'Digital Garment',
          price: Number(item.price) || 99.00,
          quantity: item.quantity || 1,
          image: item.image || ''
        })),
        total: targetTotal,
        metadata: {
          source: singleItem ? 'single_product_sandbox_btn' : 'checkout_sandbox_btn',
          itemCount: targetItems.length
        }
      });
    } catch (err) {
      console.error('Instant sandbox purchase failed:', err);
      setErrorMessage(err.message || 'Instant sandbox purchase failed.');
      setIsProcessing(false);
    }
  };

  // Direct PayPal Portal Redirect for all items
  const handleDirectPayPalRedirect = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await startDirectPayPalCheckout({
        items: activeItems.map((item) => ({
          id: item.id || '',
          name: item.name || 'Digital Garment',
          price: Number(item.price) || 0,
          quantity: item.quantity || 1,
          image: item.image || ''
        })),
        total: subtotal,
        metadata: { source: 'direct_redirect_btn' }
      });
    } catch (err) {
      console.error('Direct PayPal redirect failed:', err);
      setErrorMessage(err.message || 'Unable to redirect to PayPal.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-28 grid grid-cols-1 lg:grid-cols-12 gap-gutter lg:gap-16">
        {/* Left Column: Checkout & Payment Section */}
        <div className="lg:col-span-7 space-y-8">
          <section>
            <div className="flex items-center gap-4 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary font-label-caps text-label-caps">
                1
              </span>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:text-3xl font-bold tracking-wide">
                PAYMENT GATEWAY
              </h2>
            </div>

            {loadingDirect ? (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-8 text-center space-y-3">
                <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block"></span>
                <p className="text-secondary text-sm">Loading product details for checkout...</p>
              </div>
            ) : activeItems.length > 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                {/* Gateway Header Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-outline-variant/20 gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      activeGateway === 'stripe'
                        ? 'bg-indigo-600/10 text-indigo-500'
                        : activeGateway === 'both'
                        ? 'bg-purple-600/10 text-purple-400'
                        : 'bg-blue-600/10 text-blue-600'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">
                        {activeGateway === 'stripe'
                          ? 'credit_card'
                          : activeGateway === 'both'
                          ? 'hub'
                          : 'account_balance_wallet'}
                      </span>
                    </div>
                    <div>
                      {isSandboxMode ? (
                        <>
                          <h3 className="font-bold text-on-background text-base flex items-center gap-2">
                            {activeGateway === 'stripe'
                              ? 'Stripe Sandbox Checkout'
                              : activeGateway === 'both'
                              ? 'Multi-Gateway Sandbox'
                              : 'PayPal Sandbox Checkout'}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-semibold border border-amber-500/30">
                              SANDBOX ACTIVE
                            </span>
                          </h3>
                          <p className="text-xs text-secondary">
                            {activeGateway === 'stripe'
                              ? 'Pay with Stripe test card, simulated session, or 1-click test'
                              : activeGateway === 'both'
                              ? 'Select PayPal or Stripe to run simulated sandbox purchases'
                              : 'Pay with PayPal sandbox account, test card, or 1-click test purchase'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-bold text-on-background text-base flex items-center gap-2">
                            {activeGateway === 'stripe'
                              ? 'Credit Card Checkout'
                              : activeGateway === 'both'
                              ? 'Secure Multi-Gateway'
                              : 'Express Checkout'}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                              LIVE SECURE
                            </span>
                          </h3>
                          <p className="text-xs text-secondary">
                            {activeGateway === 'stripe'
                              ? 'Complete your order with credit/debit card powered by Stripe'
                              : activeGateway === 'both'
                              ? 'Select either PayPal or Credit Card (Stripe) to complete your order'
                              : 'Complete your order securely with PayPal, debit or credit card'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-secondary font-mono">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
                    <span>256-bit SSL Encryption</span>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-rose-500 mt-0.5">error</span>
                    <div className="flex-1">
                      <p className="font-semibold">Checkout Notice</p>
                      <p className="text-xs mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Loading State Banner */}
                {isProcessing && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-xl flex items-center gap-3 animate-pulse">
                    <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing order with payment network...</span>
                  </div>
                )}

                {/* Multi-Gateway Selector Tabs (When Admin has set Gateway to 'both') */}
                {activeGateway === 'both' && (
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-secondary uppercase tracking-wider block">
                      Choose Payment Method:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('paypal')}
                        className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                          selectedMethod === 'paypal'
                            ? 'bg-blue-950/20 border-blue-500 text-blue-400 ring-1 ring-blue-500/40 shadow-sm'
                            : 'bg-surface-variant/30 border-outline-variant/30 text-secondary hover:text-on-background'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                        <span>PayPal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('stripe')}
                        className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                          selectedMethod === 'stripe'
                            ? 'bg-indigo-950/20 border-indigo-500 text-indigo-400 ring-1 ring-indigo-500/40 shadow-sm'
                            : 'bg-surface-variant/30 border-outline-variant/30 text-secondary hover:text-on-background'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">credit_card</span>
                        <span>Credit Card (Stripe)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* STRIPE CHECKOUT SECTION                                        */}
                {/* ============================================================== */}
                {((activeGateway === 'both' && selectedMethod === 'stripe') || activeGateway === 'stripe') && (
                  <div className="space-y-4">
                    {/* Direct Stripe Sandbox Purchase Button (Admins only in Sandbox Mode) */}
                    {isSandboxMode && (
                      <div className="space-y-3 pt-1">
                        <button
                          type="button"
                          onClick={handleStripeCheckout}
                          disabled={activeItems.length === 0 || isProcessing}
                          className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-label-caps text-xs sm:text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                          title={`Send a Stripe Sandbox purchase for the total order of $${subtotal.toFixed(2)}`}
                        >
                          <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
                          <span>SEND STRIPE SANDBOX PURCHASE • ${subtotal.toFixed(2)} USD</span>
                        </button>

                        <div className="flex items-center justify-between text-xs font-mono text-secondary px-1">
                          <span>Quick Stripe test?</span>
                          <button
                            type="button"
                            onClick={() => handleInstantStripeSandbox(null)}
                            disabled={activeItems.length === 0 || isProcessing}
                            className="text-amber-600 hover:text-amber-500 underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Instantly marks order paid in Firestore via Stripe test session"
                          >
                            <span className="material-symbols-outlined text-xs">bolt</span>
                            <span>Instant 1-Click Stripe Test (${subtotal.toFixed(2)})</span>
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-outline-variant/20"></div>
                          <span className="flex-shrink mx-4 text-xs font-mono text-secondary uppercase tracking-widest">
                            Or Use Stripe Checkout Session
                          </span>
                          <div className="flex-grow border-t border-outline-variant/20"></div>
                        </div>
                      </div>
                    )}

                    {/* Primary Stripe Pay Button */}
                    <button
                      type="button"
                      onClick={handleStripeCheckout}
                      disabled={activeItems.length === 0 || isProcessing}
                      className="w-full py-4 px-6 bg-[#635bff] hover:bg-[#534be0] text-white font-label-caps text-xs sm:text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">credit_card</span>
                      <span>PAY WITH CARD (STRIPE) • ${subtotal.toFixed(2)} USD</span>
                    </button>
                    <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-secondary">
                      <span className="material-symbols-outlined text-sm text-indigo-400">lock</span>
                      <span>Secured by Stripe. Accepts Visa, Mastercard, AMEX & Apple Pay.</span>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* PAYPAL CHECKOUT SECTION                                        */}
                {/* ============================================================== */}
                {((activeGateway === 'both' && selectedMethod === 'paypal') || activeGateway === 'paypal') && (
                  <div>
                    {/* Direct Sandbox Purchase Button (Rendered ONLY in Sandbox mode for Admins) */}
                    {isSandboxMode && (
                      <>
                        <div className="space-y-3 pt-1">
                          <button
                            type="button"
                            onClick={handleDirectPayPalRedirect}
                            disabled={activeItems.length === 0 || isProcessing}
                            className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-label-caps text-xs sm:text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                            title={`Send a Sandbox purchase for the total order of $${subtotal.toFixed(2)}`}
                          >
                            <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
                            <span>SEND PAYPAL SANDBOX PURCHASE • ${subtotal.toFixed(2)} USD</span>
                          </button>

                          <div className="flex items-center justify-between text-xs font-mono text-secondary px-1">
                            <span>Quick developer testing?</span>
                            <button
                              type="button"
                              onClick={() => handleInstantSandboxPurchase(null)}
                              disabled={activeItems.length === 0 || isProcessing}
                              className="text-amber-600 hover:text-amber-500 underline font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Instantly marks order paid in Firestore without entering sandbox login"
                            >
                              <span className="material-symbols-outlined text-xs">bolt</span>
                              <span>Instant 1-Click Sandbox Test (${subtotal.toFixed(2)})</span>
                            </button>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-outline-variant/20"></div>
                          <span className="flex-shrink mx-4 text-xs font-mono text-secondary uppercase tracking-widest">
                            Or Use PayPal Smart Buttons
                          </span>
                          <div className="flex-grow border-t border-outline-variant/20"></div>
                        </div>
                      </>
                    )}

                    {/* PayPal Smart Buttons Container */}
                    <div>
                      <PayPalScriptProvider options={getPayPalScriptOptions()}>
                        <div className="relative z-10 min-h-[150px]">
                          <PayPalButtons
                            style={{
                              layout: 'vertical',
                              color: 'gold',
                              shape: 'rect',
                              label: 'paypal',
                              height: 48
                            }}
                            disabled={activeItems.length === 0 || isProcessing}
                            createOrder={handleCreateOrder}
                            onApprove={handleApprove}
                            onError={(err) => {
                              console.error('PayPal Button Error:', err);
                              setErrorMessage('PayPal gateway encountered a temporary error. Try again or use the Sandbox Purchase button above.');
                              setIsProcessing(false);
                            }}
                            onCancel={() => {
                              setIsProcessing(false);
                            }}
                          />
                        </div>
                      </PayPalScriptProvider>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant/20 p-8 rounded-2xl text-center space-y-4">
                <span className="material-symbols-outlined text-4xl text-secondary">shopping_bag</span>
                <p className="text-secondary font-medium">No product selected for checkout.</p>
                <button
                  onClick={() => navigate('/shop')}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-label-caps tracking-widest hover:opacity-90 transition-opacity cursor-pointer"
                >
                  EXPLORE SHOP
                </button>
              </div>
            )}
          </section>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">shield</span>
              <div>
                <p className="text-xs font-bold text-on-background">Buyer Protection</p>
                <p className="text-[11px] text-secondary">Full PayPal coverage</p>
              </div>
            </div>
            <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">sync</span>
              <div>
                <p className="text-xs font-bold text-on-background">Instant Delivery</p>
                <p className="text-[11px] text-secondary">3D files unlocked</p>
              </div>
            </div>
            <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
              <div>
                <p className="text-xs font-bold text-on-background">24/7 Support</p>
                <p className="text-[11px] text-secondary">Concierge assistance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary with Per-Product Sandbox Buttons */}
        <div className="lg:col-span-5 relative mt-8 lg:mt-0">
          <div className="sticky top-28 bg-surface-container-lowest p-6 sm:p-8 rounded-2xl shadow-sm border border-outline-variant/20 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-lg-mobile text-xl font-bold tracking-wide">ORDER SUMMARY</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-variant text-secondary">
                {activeItems.length} {activeItems.length === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>

            {/* Items List */}
            <div className="space-y-4 max-h-[48vh] overflow-y-auto pr-1 border-b border-outline-variant/20 pb-6">
              {activeItems.length === 0 ? (
                <div className="text-secondary text-sm">No items selected</div>
              ) : (
                activeItems.map((item) => {
                  const itemPrice = Number(item.price) || 99.00;
                  const itemQty = item.quantity || 1;
                  const itemTotal = itemPrice * itemQty;

                  return (
                    <div key={item.id} className="p-3 rounded-xl bg-surface-variant/20 border border-outline-variant/20 space-y-3">
                      <div className="flex gap-3 items-center">
                        <div className="w-14 h-14 bg-surface-container overflow-hidden rounded-lg flex-shrink-0 border border-outline-variant/20">
                          <img
                            alt={item.name}
                            className="w-full h-full object-cover"
                            src={
                              item.image ||
                              'https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fasset_hologram_1%2Fpreview.png?alt=media'
                            }
                          />
                        </div>
                        <div className="flex-grow flex flex-col justify-between">
                          <div>
                            <h4 className="font-label-caps text-xs text-on-background line-clamp-1">{item.name}</h4>
                            <p className="text-[11px] text-secondary">Format: Digital WebAR Garment</p>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-secondary">Qty: {itemQty}</span>
                            <span className="font-bold text-sm text-on-background">
                              ${itemTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Button on each product to send a sandbox purchase through with the correct price (Rendered ONLY in Sandbox mode for Admins) */}
                      {isSandboxMode && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePurchaseSingleProduct(item)}
                            disabled={isProcessing}
                            className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            title={`Send a ${activeGateway === 'stripe' ? 'Stripe' : 'PayPal'} Sandbox purchase through for ${item.name} at its price of $${itemTotal.toFixed(2)}`}
                          >
                            <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                            <span>SANDBOX PURCHASE THIS ITEM • ${itemTotal.toFixed(2)}</span>
                          </button>

                          <div className="flex items-center justify-between text-[10px] font-mono text-secondary pt-0.5 px-0.5">
                            <span>Instant Sandbox test:</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeGateway === 'stripe' || selectedMethod === 'stripe') {
                                  handleInstantStripeSandbox(item);
                                } else {
                                  handleInstantSandboxPurchase(item);
                                }
                              }}
                              disabled={isProcessing}
                              className="text-amber-600 hover:text-amber-500 underline font-semibold flex items-center gap-0.5 cursor-pointer"
                              title={`Instantly test purchase for ${item.name} ($${itemTotal.toFixed(2)})`}
                            >
                              <span className="material-symbols-outlined text-xs">bolt</span>
                              <span>1-Click Test (${itemTotal.toFixed(2)})</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Price Breakdown */}
            <div className="space-y-3 text-sm text-secondary border-b border-outline-variant/20 pb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-on-background">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Taxes</span>
                <span className="text-emerald-600 font-medium">$0.00 (Included)</span>
              </div>
              <div className="flex justify-between">
                <span>Digital WebAR Delivery</span>
                <span className="text-emerald-600 font-medium">FREE</span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline pt-1">
              <span className="font-label-caps text-xs tracking-widest text-on-background uppercase font-bold">
                TOTAL DUE
              </span>
              <span className="text-2xl font-black text-on-background">${subtotal.toFixed(2)} USD</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-6 border-t border-outline-variant/30 bg-background text-on-background font-body-md mt-auto">
        <div className="font-headline-lg text-lg text-on-background tracking-widest">STAR WEAR</div>
        <div className="text-secondary text-xs">
          © {new Date().getFullYear()} STAR WEAR. POWERED BY PAYPAL CHECKOUT.
        </div>
        <div className="flex gap-6 font-label-caps text-xs">
          <a className="text-secondary hover:text-on-background transition-colors uppercase" href="#">
            PRIVACY
          </a>
          <a className="text-secondary hover:text-on-background transition-colors uppercase" href="#">
            TERMS
          </a>
        </div>
      </footer>
    </div>
  );
}
