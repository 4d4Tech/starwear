import { loadStripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db, auth } from '../firebase';

export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
  'pk_test_51UNEk9PjHu5pL7bzxfB5dEhJL0vudEE0Wk2Nik0BKpQF0qrBO7LP1YRXV0KlTq659ZZyckA58rEpge2d7M8iqaqh00Q403rTLU';

let stripePromise = null;
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

/**
 * Calculates Stripe's standard processing fees (2.9% + $0.30) and net merchant payout
 */
export const calculateStripeFeeBreakdown = (amount = 0) => {
  const gross = Number(amount) || 0;
  if (gross <= 0) {
    return {
      gross: 0,
      percentageRate: 0.029,
      fixedFee: 0,
      percentageFee: 0,
      totalFee: 0,
      net: 0,
      effectiveRate: '0.00',
      rateDescription: '2.9% + $0.30 USD'
    };
  }

  // Standard domestic card processing rate in the US: 2.9% + $0.30 per successful charge
  const percentageFee = Math.round((gross * 0.029) * 100) / 100;
  const fixedFee = 0.30;
  const totalFee = Math.round((percentageFee + fixedFee) * 100) / 100;
  const net = Math.max(0, Math.round((gross - totalFee) * 100) / 100);
  const effectiveRate = ((totalFee / gross) * 100).toFixed(2);

  return {
    gross,
    percentageRate: 0.029,
    percentageFee,
    fixedFee,
    totalFee,
    net,
    effectiveRate,
    rateDescription: '2.9% + $0.30 USD'
  };
};

/**
 * Creates an order document in Firestore for Stripe tracking with cost breakdown
 */
export const createFirestoreStripeOrder = async ({ items = [], total = 0, metadata = {} }) => {
  const currentUser = auth.currentUser;
  const numericTotal = Number(total) || 0;
  const feeInfo = calculateStripeFeeBreakdown(numericTotal);

  const orderRef = await addDoc(collection(db, 'orders'), {
    userId: currentUser ? currentUser.uid : 'guest',
    customerEmail: currentUser ? currentUser.email : '',
    items,
    total: numericTotal,
    status: 'pending',
    paymentMethod: 'stripe',
    stripeFee: feeInfo.totalFee,
    netAmount: feeInfo.net,
    feeBreakdown: feeInfo,
    metadata,
    createdAt: serverTimestamp()
  });
  return orderRef.id;
};

/**
 * Request a Stripe Checkout Session from Cloud Functions
 */
export const createStripeCheckoutSession = async ({ items = [], total, orderDocId, successUrl, cancelUrl, metadata = {} }) => {
  try {
    const sessionFn = httpsCallable(functions, 'createStripeCheckoutSession');
    const response = await sessionFn({
      items,
      total,
      orderDocId,
      successUrl: successUrl || `${window.location.origin}/success?order_id=${orderDocId}&gateway=stripe`,
      cancelUrl: cancelUrl || `${window.location.origin}/checkout`,
      metadata
    });
    return response.data;
  } catch (err) {
    console.warn('createStripeCheckoutSession function notice:', err.message);
    return {
      id: null,
      error: err.message
    };
  }
};

/**
 * Universal Stripe Checkout Redirect Handler
 */
export const startDirectStripeCheckout = async ({ items = [], total, metadata = {} }) => {
  const calculatedTotal = total || items.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.quantity || 1), 0);

  // 1. Create order in Firestore
  const orderDocId = await createFirestoreStripeOrder({
    items,
    total: calculatedTotal,
    metadata
  });

  const successUrl = `${window.location.origin}/success?order_id=${orderDocId}&gateway=stripe&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/checkout`;

  // 2. Call Cloud Function to get Stripe Checkout URL
  const result = await createStripeCheckoutSession({
    items,
    total: calculatedTotal,
    orderDocId,
    successUrl,
    cancelUrl,
    metadata
  });

  if (result && (result.url || result.approvalUrl)) {
    window.location.href = result.url || result.approvalUrl;
    return { success: true, redirected: true, orderDocId, sessionId: result.id };
  }

  // Fallback to client Stripe checkout if available or direct URL
  const stripe = await getStripe();
  if (stripe && result && result.id) {
    const { error } = await stripe.redirectToCheckout({ sessionId: result.id });
    if (error) {
      throw new Error(error.message);
    }
    return { success: true, redirected: true, orderDocId };
  }

  throw new Error(result?.error || 'Unable to start Stripe checkout session. Please try again or use PayPal.');
};

/**
 * Instant Stripe Sandbox Purchase (Simulated Sandbox Checkout)
 */
export const executeInstantStripeSandboxPurchase = async ({ items = [], total, metadata = {} }) => {
  const calculatedTotal = total !== undefined && total !== null ? Number(total) : items.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.quantity || 1), 0);

  // 1. Create a tracking order document in Firestore
  const orderDocId = await createFirestoreStripeOrder({
    items,
    total: calculatedTotal,
    metadata: {
      ...metadata,
      gateway: 'stripe',
      testMode: true,
      instantSandbox: true
    }
  });

  const mockSessionId = 'cs_test_' + Date.now();

  // 2. Update Firestore order document to 'paid' status
  try {
    const feeInfo = calculateStripeFeeBreakdown(calculatedTotal);
    const orderRef = doc(db, 'orders', orderDocId);
    await updateDoc(orderRef, {
      status: 'paid',
      stripeSessionId: mockSessionId,
      paidAt: serverTimestamp(),
      paymentMethod: 'stripe',
      stripeFee: feeInfo.totalFee,
      netAmount: feeInfo.net,
      feeBreakdown: feeInfo,
      testMode: true
    });
  } catch (dbErr) {
    console.error('Failed to update Firestore Stripe order status:', dbErr);
  }

  // 3. Redirect to Order Success page
  window.location.href = `/success?session_id=${mockSessionId}&order_id=${orderDocId}&sandbox=1&gateway=stripe`;
  return { success: true, sessionId: mockSessionId, orderDocId };
};
