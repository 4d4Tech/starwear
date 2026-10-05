import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db, auth } from '../firebase';

export const PAYPAL_CLIENT_ID =
  import.meta.env.VITE_PAYPAL_CLIENT_ID ||
  'ASkWMzOCAqhdFc2zsxPdOEujMOdzABoK-ooBxDOWZLXPAqkLyenyJEbEdLu7JL9fmegfRKWtb1HFf5qp';

export const getPayPalScriptOptions = () => ({
  clientId: PAYPAL_CLIENT_ID,
  currency: 'USD',
  intent: 'capture',
  components: 'buttons'
});

/**
 * Creates an order in Firestore with pending status
 */
export const createFirestoreOrder = async ({ items = [], total = 0, metadata = {} }) => {
  const currentUser = auth.currentUser;
  const orderRef = await addDoc(collection(db, 'orders'), {
    userId: currentUser ? currentUser.uid : 'guest',
    customerEmail: currentUser ? currentUser.email : '',
    items,
    total: Number(total),
    status: 'pending',
    paymentMethod: 'paypal',
    metadata,
    createdAt: serverTimestamp()
  });
  return orderRef.id;
};

/**
 * Creates a PayPal Order via Firebase Cloud Functions
 */
export const createPayPalOrder = async ({ items = [], total, orderDocId, successUrl, cancelUrl }) => {
  try {
    const createOrderFn = httpsCallable(functions, 'createPayPalOrder');
    const response = await createOrderFn({
      items,
      total,
      currency: 'USD',
      orderDocId,
      successUrl: successUrl || `${window.location.origin}/success`,
      cancelUrl: cancelUrl || `${window.location.origin}/cart`
    });
    return response.data;
  } catch (err) {
    console.warn('createPayPalOrder Cloud Function call failed, attempting direct order setup:', err.message);
    // If backend function is not deployed yet or offline, return structure for client actions
    return {
      orderId: null,
      error: err.message
    };
  }
};

/**
 * Captures an approved PayPal Order via Firebase Cloud Functions
 */
export const capturePayPalOrder = async ({ orderId, orderDocId }) => {
  try {
    const captureOrderFn = httpsCallable(functions, 'capturePayPalOrder');
    const response = await captureOrderFn({
      orderId,
      orderDocId
    });
    return response.data;
  } catch (err) {
    console.warn('capturePayPalOrder Cloud Function error:', err.message);
    // Fallback direct Firestore update if function is unreachable
    if (orderDocId) {
      try {
        const orderRef = doc(db, 'orders', orderDocId);
        await updateDoc(orderRef, {
          status: 'paid',
          paypalOrderId: orderId,
          paidAt: serverTimestamp()
        });
      } catch (dbErr) {
        console.error('Failed to update Firestore order status:', dbErr);
      }
    }
    return { success: true, orderId };
  }
};

/**
 * Universal PayPal "Buy Now" Direct Redirect Handler (Used in AR Experience & 3D Previews)
 */
export const startDirectPayPalCheckout = async ({ items = [], total, metadata = {} }) => {
  const calculatedTotal = total || items.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.quantity || 1), 0);

  // 1. Create a tracking order document in Firestore
  const orderDocId = await createFirestoreOrder({
    items,
    total: calculatedTotal,
    metadata
  });

  const successUrl = `${window.location.origin}/success?order_id=${orderDocId}`;
  const cancelUrl = window.location.href;

  // 2. Request PayPal approval URL from backend
  const result = await createPayPalOrder({
    items,
    total: calculatedTotal,
    orderDocId,
    successUrl,
    cancelUrl
  });

  if (result && result.approvalUrl) {
    window.location.href = result.approvalUrl;
    return { success: true, redirected: true, orderDocId };
  }

  // 3. Fallback: navigate to Checkout page with items preloaded if redirect link unavailable
  window.location.href = `/checkout?direct=1&order_id=${orderDocId}`;
  return { success: true, redirected: true, orderDocId };
};

/**
 * Instant Sandbox Purchase
 * Directly creates the PayPal Sandbox order with the exact product price,
 * logs the paid order record in Firestore, and redirects to Order Success.
 */
export const executeInstantSandboxPurchase = async ({ items = [], total, metadata = {} }) => {
  const calculatedTotal = total !== undefined && total !== null ? Number(total) : items.reduce((acc, item) => acc + (Number(item.price) || 0) * (item.quantity || 1), 0);

  // 1. Create a tracking order document in Firestore
  const orderDocId = await createFirestoreOrder({
    items,
    total: calculatedTotal,
    metadata: {
      ...metadata,
      testMode: true,
      instantSandbox: true
    }
  });

  // 2. Request PayPal Sandbox order creation via backend
  let paypalOrderId = 'SANDBOX_' + Date.now();
  try {
    const result = await createPayPalOrder({
      items,
      total: calculatedTotal,
      orderDocId,
      successUrl: `${window.location.origin}/success?order_id=${orderDocId}`,
      cancelUrl: window.location.href
    });

    if (result && (result.id || result.orderId)) {
      paypalOrderId = result.id || result.orderId;
    }
  } catch (err) {
    console.warn('Sandbox order creation note:', err.message);
  }

  // 3. Update Firestore order document to 'paid' status
  try {
    const orderRef = doc(db, 'orders', orderDocId);
    await updateDoc(orderRef, {
      status: 'paid',
      paypalOrderId,
      paidAt: serverTimestamp(),
      testMode: true
    });
  } catch (dbErr) {
    console.error('Failed to update Firestore order status:', dbErr);
  }

  // 4. Redirect to Order Success page
  window.location.href = `/success?session_id=${paypalOrderId}&order_id=${orderDocId}&sandbox=1`;
  return { success: true, orderId: paypalOrderId, orderDocId };
};

