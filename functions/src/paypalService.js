const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    logger.warn("Firebase Admin already initialized or init warning:", e.message);
  }
}

/**
 * Resolve PayPal Configuration & API Endpoints
 */
const getPayPalConfig = () => {
  const clientId = process.env.PAY_PAL_CLIENT_ID || "ASkWMzOCAqhdFc2zsxPdOEujMOdzABoK-ooBxDOWZLXPAqkLyenyJEbEdLu7JL9fmegfRKWtb1HFf5qp";
  const secret = process.env.PAY_PAL_SECRET || "EHlKVyFM0Ahhl1PshndaAQdkWdt2I-YMwHCruTUPp7jDnI0kkHGYgeN3BuMvZsH5auIM3R9GXS5MSdrc";
  const env = (process.env.PAY_PAL_ENV || "sandbox").toLowerCase();

  const isLive = env === "live" || env === "production";
  const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  return {
    clientId,
    secret,
    isLive,
    baseUrl
  };
};

/**
 * Generate OAuth2 Bearer Token from PayPal REST API
 */
const getPayPalAccessToken = async () => {
  const { clientId, secret, baseUrl } = getPayPalConfig();
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("Failed to generate PayPal access token:", response.status, errorBody);
    throw new Error(`PayPal authentication failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    baseUrl
  };
};

/**
 * Create a PayPal Checkout Order
 * @param {Object} options
 * @param {Array} options.items - [{ name, price, quantity, image }]
 * @param {number} options.total - Order total amount
 * @param {string} options.currency - Default 'USD'
 * @param {string} options.successUrl - Redirect URL on approval
 * @param {string} options.cancelUrl - Redirect URL on cancellation
 * @param {string} options.orderDocId - Optional Firestore order ID for tracking
 */
const createPayPalOrder = async ({ items = [], total, currency = "USD", successUrl, cancelUrl, orderDocId }) => {
  const { accessToken, baseUrl } = await getPayPalAccessToken();

  let calculatedTotal = 0;
  const formattedItems = (items || []).map((item) => {
    const priceNum = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    calculatedTotal += priceNum * qty;

    return {
      name: (item.name || "Item").substring(0, 127),
      unit_amount: {
        currency_code: currency,
        value: priceNum.toFixed(2)
      },
      quantity: String(qty)
    };
  });

  const itemSum = formattedItems.reduce((acc, it) => acc + (Number(it.unit_amount.value) * Number(it.quantity)), 0);
  const finalTotal = (total !== undefined && total !== null && Number(total) > 0) ? Number(total) : (itemSum > 0 ? itemSum : 99.00);
  const totalStr = finalTotal.toFixed(2);
  const itemSumStr = itemSum.toFixed(2);

  const purchaseUnit = {
    reference_id: orderDocId || "default",
    custom_id: orderDocId || "",
    description: "Star weAR Order",
    amount: {
      currency_code: currency,
      value: totalStr
    }
  };

  if (formattedItems.length > 0) {
    purchaseUnit.items = formattedItems;
    if (itemSumStr === totalStr) {
      purchaseUnit.amount.breakdown = {
        item_total: {
          currency_code: currency,
          value: totalStr
        }
      };
    }
  }

  const payload = {
    intent: "CAPTURE",
    purchase_units: [purchaseUnit],
    application_context: {
      brand_name: "STAR WEAR",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      ...(successUrl ? { return_url: successUrl } : {}),
      ...(cancelUrl ? { cancel_url: cancelUrl } : {})
    }
  };

  logger.info("Creating PayPal order:", JSON.stringify(payload));

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error("PayPal create order failed:", response.status, errText);
    throw new Error(`Failed to create PayPal order (${response.status}): ${errText}`);
  }

  const orderData = await response.json();
  const approveLink = (orderData.links || []).find((l) => l.rel === "approve");

  return {
    id: orderData.id,
    orderId: orderData.id,
    status: orderData.status,
    approvalUrl: approveLink ? approveLink.href : null,
    links: orderData.links
  };
};

/**
 * Capture an approved PayPal Order and update Firestore
 * @param {Object} options
 * @param {string} options.orderId - PayPal Order ID
 * @param {string} options.orderDocId - Firestore Order Document ID
 */
const capturePayPalOrder = async ({ orderId, orderDocId }) => {
  if (!orderId) {
    throw new Error("Missing orderId for PayPal capture.");
  }

  const { accessToken, baseUrl } = await getPayPalAccessToken();

  logger.info(`Capturing PayPal order: ${orderId}`);

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error("PayPal order capture failed:", response.status, errText);
    throw new Error(`PayPal order capture failed (${response.status}): ${errText}`);
  }

  const captureData = await response.json();
  const isCompleted = captureData.status === "COMPLETED";

  // If orderDocId is provided, update Firestore order document directly
  if (orderDocId) {
    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderDocId);
      const updatePayload = {
        status: isCompleted ? "paid" : "capture_pending",
        paypalOrderId: orderId,
        payerEmail: captureData.payer?.email_address || "",
        payerName: `${captureData.payer?.name?.given_name || ""} ${captureData.payer?.name?.surname || ""}`.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (isCompleted) {
        updatePayload.paidAt = admin.firestore.FieldValue.serverTimestamp();
      }

      await orderRef.set(updatePayload, { merge: true });
      logger.info(`Updated Firestore order ${orderDocId} to status: ${updatePayload.status}`);
    } catch (dbErr) {
      logger.error(`Error updating Firestore order doc ${orderDocId}:`, dbErr);
    }
  }

  return {
    success: isCompleted,
    status: captureData.status,
    orderId: captureData.id,
    details: captureData
  };
};

module.exports = {
  getPayPalConfig,
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder
};
