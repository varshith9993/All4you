import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDn52J3u3BZicSgsLBDGoZ0kjPZIHtVutk",
  authDomain: "g-maps-api-472115.firebaseapp.com",
  projectId: "g-maps-api-472115",
  storageBucket: "g-maps-api-472115.firebasestorage.app",
  messagingSenderId: "687085939527",
  appId: "1:687085939527:web:9082b5bb1a5843df7efa62",
  databaseURL: "https://g-maps-api-472115-default-rtdb.asia-southeast1.firebasedatabase.app/",
  measurementId: "G-DM6TS1EL0W"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Explicitly set persistence to clarify storage usage for browsers
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Firebase Auth Persistence warning:", err);
});

export const db = getFirestore(app);

// Enable Firestore persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence is not supported by this browser');
  }
});

export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// Initialize messaging only if supported (not supported in all browsers)
let messaging = null;
isSupported().then(supported => {
  if (supported) {
    messaging = getMessaging(app);
  }
}).catch(err => {
  console.warn("Firebase Messaging not supported:", err);
});

export { messaging };

