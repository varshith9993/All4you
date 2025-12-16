import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDn52J3u3BZicSgsLBDGoZ0kjPZIHtVutk",
  authDomain: "g-maps-api-472115.firebaseapp.com",
  projectId: "g-maps-api-472115",
  storageBucket: "g-maps-api-472115.firebasestorage.app",
  messagingSenderId: "687085939527",
  appId: "YOUR_FIREBASE_APP_ID",
  databaseURL: "https://g-maps-api-472115-default-rtdb.asia-southeast1.firebasedatabase.app/",
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
