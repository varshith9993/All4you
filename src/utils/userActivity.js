import { getAuth } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

let activityInterval;

export const startUserActivityTracking = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return;

  // Update online status immediately
  updateDoc(doc(db, "profiles", user.uid), {
    online: true,
    lastSeen: serverTimestamp()
  });

  // Set up periodic updates (every 30 seconds)
  activityInterval = setInterval(() => {
    if (auth.currentUser) {
      updateDoc(doc(db, "profiles", auth.currentUser.uid), {
        online: true,
        lastSeen: serverTimestamp()
      });
    }
  }, 30000);
};

export const stopUserActivityTracking = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return;

  // Update offline status
  updateDoc(doc(db, "profiles", user.uid), {
    online: false,
    lastSeen: serverTimestamp()
  });

  // Clear interval
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
};

// Call this when app loads
export const initializeUserActivity = () => {
  // Start tracking when app becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startUserActivityTracking();
    } else {
      stopUserActivityTracking();
    }
  });

  // Start tracking initially
  startUserActivityTracking();

  // Stop tracking when page unloads
  window.addEventListener('beforeunload', stopUserActivityTracking);
};