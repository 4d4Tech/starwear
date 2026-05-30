const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function run() {
  await db.collection('merchants').doc('merch_4d4').update({ is_masterSwitch_active: true });
  console.log('Updated merchant');
}
run().catch(console.error);
