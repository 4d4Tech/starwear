/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const stripe = require('stripe')('sk_test_YOUR_STRIPE_SECRET_KEY'); // Replace with actual secret key

setGlobalOptions({ maxInstances: 10 });

exports.createStripeCheckoutSession = onCall(async (request) => {
  try {
    const { items, successUrl, cancelUrl } = request.data;

    // Format items for Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100), // Stripe expects cents
      },
      quantity: item.quantity,
    }));

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { id: session.id };
  } catch (error) {
    logger.error("Error creating stripe session:", error);
    throw new Error("Unable to create checkout session");
  }
});

const { loomRouter } = require("./src/loomRouter");
exports.loomRouter = loomRouter;

const { compileGarmentTarget } = require("./src/compileGarmentTarget");
exports.compileGarmentTarget = compileGarmentTarget;
