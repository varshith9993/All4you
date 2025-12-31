import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

class UserStatusManager {
  constructor() {
    this.auth = auth;
    this.currentUserId = null;
    this.unsubscribeAuth = null;
    this.unsubscribeProfile = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) {
      console.log('UserStatusManager already initialized');
      return;
    }

    console.log('Initializing UserStatusManager...');
    this.isInitialized = true;

    // Set up auth state listener
    this.unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        console.log('User signed in:', user.uid);
        this.currentUserId = user.uid;
        await this.setUserOnline(user.uid);
        this.setupProfileListener(user.uid);
      } else {
        console.log('User signed out');
        // No need to call setUserOffline here because permissions will fail if auth is already null
        this.currentUserId = null;
        if (this.unsubscribeProfile) {
          this.unsubscribeProfile();
        }
      }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Handle beforeunload (browser/tab close)
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    console.log('UserStatusManager initialized successfully');
  }

  async setUserOnline(userId) {
    if (!this.auth.currentUser) return;
    try {
      const userRef = doc(db, 'profiles', userId);
      // Use setDoc with merge: true to avoid "No document to update" error if profile doesn't exist
      await setDoc(userRef, {
        online: true,
        lastSeen: serverTimestamp()
      }, { merge: true });
      console.log('✅ User set ONLINE:', userId);
    } catch (error) {
      if (error.code !== 'permission-denied') {
        console.error('Error setting user online:', error);
      }
    }
  }

  async setUserOffline(userId) {
    if (!this.auth.currentUser) return;
    try {
      const userRef = doc(db, 'profiles', userId);
      await setDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp()
      }, { merge: true });
      console.log('✅ User set OFFLINE:', userId);
    } catch (error) {
      if (error.code !== 'permission-denied') {
        console.error('Error setting user offline:', error);
      }
    }
  }

  setupProfileListener(userId) {
    this.unsubscribeProfile = onSnapshot(doc(db, 'profiles', userId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('👤 Profile updated - Online:', data.online, 'Last seen:', data.lastSeen);
      }
    });
  }

  handleVisibilityChange() {
    if (this.currentUserId && this.auth.currentUser) {
      if (document.hidden) {
        console.log('📱 App backgrounded, setting user OFFLINE');
        this.setUserOffline(this.currentUserId);
      } else {
        console.log('📱 App foregrounded, setting user ONLINE');
        this.setUserOnline(this.currentUserId);
      }
    }
  }

  async handleBeforeUnload() {
    if (this.currentUserId && this.auth.currentUser) {
      console.log('❌ App closing, setting user OFFLINE');
      await this.setUserOffline(this.currentUserId);
    }
  }

  async signOut() {
    if (this.currentUserId && this.auth.currentUser) {
      await this.setUserOffline(this.currentUserId);
    }
    await signOut(this.auth);
  }

  destroy() {
    console.log('Destroying UserStatusManager...');
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
    if (this.unsubscribeProfile) {
      this.unsubscribeProfile();
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.isInitialized = false;
    console.log('UserStatusManager destroyed');
  }
}

export const userStatusManager = new UserStatusManager();