const admin = require("firebase-admin");

// Initialize Firebase Admin (ensure this is only called once in the function execution environment)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const storage = admin.storage();

/**
 * Utility helper to generate a secure, temporary Signed URL for a Storage asset.
 * @param {string} filePath - The path to the file in the bucket (e.g., 'anchors/merchant_123/line.mind')
 * @returns {Promise<string>} - The signed URL string
 */
async function generateSignedUrl(filePath) {
  const bucket = storage.bucket();
  const file = bucket.file(filePath);

  // Set URL to expire in 15 minutes to balance security and user experience
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, 
  };

  const [url] = await file.getSignedUrl(options);
  return url;
}

module.exports = { generateSignedUrl, admin };
