// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBf8SkGlyERC4gRNCbIUdRDl06-cqmcd4s",
    authDomain: "star-wear-ecb39.firebaseapp.com",
    projectId: "star-wear-ecb39",
    storageBucket: "star-wear-ecb39.firebasestorage.app",
    messagingSenderId: "297163369889",
    appId: "1:297163369889:web:91231a60280d6042d32fe0",
    measurementId: "G-PY8WM9QMML"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);