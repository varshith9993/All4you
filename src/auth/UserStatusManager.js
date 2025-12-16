// src/auth/UserStatusManager.js
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

class UserStatusManager {
  constructor() {
    this.auth = getAuth();
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
        await this.setUserOnline(user.uid); // User is ONLINE when signed in
        this.setupProfileListener(user.uid);
      } else {
        console.log('User signed out');
        if (this.currentUserId) {
          await this.setUserOffline(this.currentUserId); // User is OFFLINE when signed out
        }
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
    try {
      const userRef = doc(db, 'profiles', userId);
      await updateDoc(userRef, {
        online: true, // CORRECT: true means user is ONLINE
        lastSeen: serverTimestamp()
      });
      console.log('✅ User set ONLINE:', userId);
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }

  async setUserOffline(userId) {
    try {
      const userRef = doc(db, 'profiles', userId);
      await updateDoc(userRef, {
        online: false, // CORRECT: false means user is OFFLINE
        lastSeen: serverTimestamp()
      });
      console.log('✅ User set OFFLINE:', userId);
    } catch (error) {
      console.error('Error setting user offline:', error);
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
    if (this.currentUserId) {
      if (document.hidden) {
        // User switched tabs or minimized window - they are now OFFLINE
        console.log('📱 App backgrounded, setting user OFFLINE');
        this.setUserOffline(this.currentUserId);
      } else {
        // User returned to the app - they are now ONLINE
        console.log('📱 App foregrounded, setting user ONLINE');
        this.setUserOnline(this.currentUserId);
      }
    }
  }

  async handleBeforeUnload() {
    if (this.currentUserId) {
      console.log('❌ App closing, setting user OFFLINE');
      await this.setUserOffline(this.currentUserId);
    }
  }

  async signOut() {
    if (this.currentUserId) {
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