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

exports.initiateAIGeneration = onCall(async (request) => {
  try {
    const { imageUrl } = request.data;
    if (!imageUrl) {
      throw new Error("Missing imageUrl parameter.");
    }

    const apiToken = process.env.GENERATIVE_3D_API_TOKEN || "PLACEHOLDER_TOKEN";
    const apiUrl = "https://api.placeholder3d.com/v1/generation"; // Placeholder API URL

    logger.info("Initiating 3D generation for image:", imageUrl);

    // Call placeholder API
    let taskId = "task_" + Math.random().toString(36).substring(2, 15);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (response.ok) {
        const json = await response.json();
        if (json.taskId) taskId = json.taskId;
      }
    } catch (fetchError) {
      logger.warn("Placeholder API fetch failed, using fallback taskId:", fetchError.message);
    }

    return { taskId };
  } catch (error) {
    logger.error("Error initiating AI 3D generation:", error);
    throw new Error(error.message);
  }
});

exports.pollGenerationStatus = onCall(async (request) => {
  try {
    const { taskId } = request.data;
    if (!taskId) {
      throw new Error("Missing taskId parameter.");
    }

    const apiToken = process.env.GENERATIVE_3D_API_TOKEN || "PLACEHOLDER_TOKEN";
    const apiUrl = `https://api.placeholder3d.com/v1/generation/${taskId}`; // Placeholder API URL

    logger.info("Polling 3D generation status for task:", taskId);

    // Default mock response values
    let progress = 100;
    let status = "SUCCEEDED";
    
    let modelUrl = "https://firebasestorage.googleapis.com/v0/b/star-wear-ecb39.firebasestorage.app/o/assets%2Fasset_hologram_1%2Fmodel.glb?alt=media"; // High quality sample model URL

    try {
      const response = await fetch(apiUrl, {
        headers: {
          "Authorization": `Bearer ${apiToken}`
        }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.progress !== undefined) progress = json.progress;
        if (json.status) status = json.status;
        if (json.modelUrl) modelUrl = json.modelUrl;
      }
    } catch (fetchError) {
      logger.warn("Placeholder API poll failed, using mock progress payload:", fetchError.message);
    }

    return { status, progress, modelUrl };
  } catch (error) {
    logger.error("Error polling AI 3D generation status:", error);
    throw new Error(error.message);
  }
});
