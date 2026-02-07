import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// VAPID key - You need to generate this from Firebase Console
// Go to: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'BBNEvcyPS0PlnqN5Kr8HOzaTAzoEl_oDViij9VgYgA6aaQWUJWNUxZLQ34smMQn_yx4kCb7rqtk3j49-noXDj4w';

/**
 * Request notification permission and get FCM token
 * @param {string} userId - Current user's ID
 * @param {object} userLocation - User's location data {latitude, longitude, city, country}
 * @returns {Promise<string|null>} FCM token or null if permission denied
 */
export const requestNotificationPermission = async (userId, userLocation) => {
    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return null;
        }

        // Check if service workers are supported
        if (!('serviceWorker' in navigator)) {
            console.warn('Service workers are not supported');
            return null;
        }

        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            return null;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Get FCM token
        const messaging = getMessaging();
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {


            // Save token to Firestore with user location
            await saveFCMToken(userId, token, userLocation);

            return token;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
};

/**
 * Save FCM token to Firestore with user location data
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 * @param {object} userLocation - User location data
 */
export const saveFCMToken = async (userId, token, userLocation) => {
    try {
        const tokenRef = doc(db, 'fcmTokens', userId);

        const lat = userLocation?.latitude ? parseFloat(userLocation.latitude) : null;
        const lng = userLocation?.longitude ? parseFloat(userLocation.longitude) : null;

        console.log(`[FCM] Saving token for ${userId} with Location:`, lat, lng);

        await setDoc(tokenRef, {
            token,
            userId,
            latitude: lat || null,
            longitude: lng || null,
            city: userLocation?.city || null,
            country: userLocation?.country || null,
            platform: getPlatform(),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
};

/**
 * Get current platform (web, android, ios)
 */
const getPlatform = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    if (/android/i.test(userAgent)) {
        return 'android';
    }

    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'ios';
    }

    return 'web';
};

/**
 * Listen for foreground messages
 * @param {function} callback - Callback function to handle messages
 */
export const onForegroundMessage = (callback) => {
    try {
        const messaging = getMessaging();

        return onMessage(messaging, (payload) => {


            // Show browser notification
            if (Notification.permission === 'granted') {
                const notificationTitle = payload.notification?.title || 'AeroSigil';
                const notificationOptions = {
                    body: payload.notification?.body || 'You have a new notification',
                    icon: '/logo192.png',
                    badge: '/logo192.png',
                    tag: payload.data?.tag || 'default',
                    data: payload.data,
                    requireInteraction: false,
                    vibrate: [200, 100, 200],
                };

                const notification = new Notification(notificationTitle, notificationOptions);

                notification.onclick = function (event) {
                    event.preventDefault();
                    window.focus();

                    const data = payload.data || {};

                    // Handle Navigation
                    if ((data.type === 'chat_message' || data.type === 'chat_offline') && data.chatId) {
                        window.location.href = `/chat/${data.chatId}`;
                    } else if ((data.type === 'review' || data.type === 'review_reply') && data.postId && data.collection) {
                        const target = data.collection === 'workers' ? 'worker-detail' :
                            data.collection === 'ads' ? 'ad-detail' : 'service-detail';
                        window.location.href = `/${target}/${data.postId}`;
                    } else if (data.url) {
                        window.location.href = data.url;
                    } else {
                        window.location.href = '/notifications';
                    }

                    notification.close();
                };
            }

            // Call custom callback
            if (callback) {
                callback(payload);
            }
        });
    } catch (error) {
        console.error('Error setting up foreground message listener:', error);
        return null;
    }
};

/**
 * Delete FCM token (for logout)
 * @param {string} userId - User ID
 */
export const deleteFCMToken = async (userId) => {
    try {
        const tokenRef = doc(db, 'fcmTokens', userId);
        await setDoc(tokenRef, {
            token: null,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error deleting FCM token:', error);
    }
};

/**
 * Check if user has granted notification permission
 */
export const hasNotificationPermission = () => {
    return Notification.permission === 'granted';
};

/**
 * Check notification permission status
 * @returns {Promise<string>} 'granted', 'denied', or 'default'
 */
export const checkNotificationPermission = async () => {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
};

/**
 * Get user's FCM token from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
export const getUserFCMToken = async (userId) => {
    try {
        const tokenRef = doc(db, 'fcmTokens', userId);
        const tokenDoc = await getDoc(tokenRef);

        if (tokenDoc.exists()) {
            return tokenDoc.data().token;
        }

        return null;
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
};
