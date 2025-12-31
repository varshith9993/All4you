import { auth, db } from "../firebase";

let activityInterval;

export const startUserActivityTracking = () => {
  const user = auth.currentUser;

  if (!user) return;

  // Use setDoc with merge: true to avoid "No document to update" error
  setDoc(doc(db, "profiles", user.uid), {
    online: true,
    lastSeen: serverTimestamp()
  }, { merge: true }).catch(err => {
    if (err.code !== 'permission-denied') console.error("Error starting activity tracking:", err);
  });

  // Set up periodic updates (every 30 seconds)
  if (activityInterval) clearInterval(activityInterval);
  activityInterval = setInterval(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setDoc(doc(db, "profiles", currentUser.uid), {
        online: true,
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(err => {
        if (err.code !== 'permission-denied') console.error("Error updating activity:", err);
      });
    }
  }, 30000);
};

export const stopUserActivityTracking = () => {
  const user = auth.currentUser;

  if (!user) return;

  // Update offline status
  setDoc(doc(db, "profiles", user.uid), {
    online: false,
    lastSeen: serverTimestamp()
  }, { merge: true }).catch(err => {
    if (err.code !== 'permission-denied') console.error("Error stopping activity tracking:", err);
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