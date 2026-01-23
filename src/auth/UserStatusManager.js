import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

class UserStatusManager {
  constructor() {
    this.auth = auth;
    this.currentUserId = null;
    this.unsubscribeAuth = null;
    // OPTIMIZATION: Removed profile listener - GlobalDataCacheContext already handles it
    this.isInitialized = false;
    this.statusCache = { online: null, lastUpdate: 0 };
    this.visibilityTimeout = null;
  }

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    // Set up auth state listener
    this.unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUserId = user.uid;
        // Don't await - let it happen in background
        this.setUserOnline(user.uid);
      } else {
        this.currentUserId = null;
        this.statusCache = { online: null, lastUpdate: 0 };
      }
    });

    // Handle page visibility changes with debouncing
    document.addEventListener('visibilitychange', () => {
      if (this.visibilityTimeout) clearTimeout(this.visibilityTimeout);

      if (document.hidden) {
        // OPTIMIZATION: Reduced from 30s to 5s for more accurate offline status
        // Wait 5 seconds before setting offline to avoid flickering on quick tab switch
        this.visibilityTimeout = setTimeout(() => {
          if (document.hidden) this.setUserOffline(this.currentUserId);
        }, 5000); // Changed from 30000 to 5000
      } else {
        // OPTIMIZATION: Wait 2 seconds before setting online to prevent rapid writes on quick tab switches
        this.visibilityTimeout = setTimeout(() => {
          if (!document.hidden) this.setUserOnline(this.currentUserId);
        }, 2000);
      }
    });

    // Handle beforeunload (browser/tab close)
    window.addEventListener('beforeunload', () => {
      if (this.currentUserId) this.setUserOffline(this.currentUserId);
    });
  }

  async setUserOnline(userId) {
    if (!userId || !this.auth.currentUser) return;

    const now = Date.now();
    // Only update if not already online OR if last update was more than 5 minutes ago
    if (this.statusCache.online === true && (now - this.statusCache.lastUpdate) < 300000) {
      return;
    }

    try {
      const userRef = doc(db, 'profiles', userId);
      await setDoc(userRef, {
        online: true,
        lastSeen: serverTimestamp()
      }, { merge: true });

      this.statusCache = { online: true, lastUpdate: now };

    } catch (error) {
    }
  }

  async setUserOffline(userId) {
    if (!userId || !this.auth.currentUser) return;

    try {
      const userRef = doc(db, 'profiles', userId);
      await setDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp()
      }, { merge: true });

      this.statusCache = { online: false, lastUpdate: Date.now() };

    } catch (error) {
    }
  }

  // OPTIMIZATION: Removed setupProfileListener - GlobalDataCacheContext handles profile listening

  async signOut() {
    if (this.currentUserId) {
      await this.setUserOffline(this.currentUserId);
    }
    return signOut(this.auth);
  }

  destroy() {
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.visibilityTimeout) clearTimeout(this.visibilityTimeout);
    this.isInitialized = false;
  }
}

export const userStatusManager = new UserStatusManager();