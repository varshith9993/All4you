// Firebase Cloud Messaging Service Worker
// This file handles background notifications for AeroSigil

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyDn52J3u3BZicSgsLBDGoZ0kjPZIHtVutk",
    authDomain: "g-maps-api-472115.firebaseapp.com",
    projectId: "g-maps-api-472115",
    storageBucket: "g-maps-api-472115.firebasestorage.app",
    messagingSenderId: "687085939527",
    appId: "1:687085939527:web:9082b5bb1a5843df7efa62",
    measurementId: "G-DM6TS1EL0W"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification?.title || 'AeroSigil';
    const notificationData = payload.data || {};

    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: payload.notification?.icon || '/aerosigil-logo-192x192.png', // Uses Sender Image if provided
        badge: '/aerosigil-logo-192x192.png', // Small App Logo
        image: payload.notification?.image || notificationData.image, // Big Picture
        tag: payload.notification?.tag || notificationData.tag || 'default', // Grouping
        renotify: payload.notification?.renotify || false, // Alert again on update
        data: notificationData,
        requireInteraction: payload.notification?.requireInteraction || false,
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
        actions: payload.notification?.actions || [] // Action Buttons (Reply, etc.)
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.', event);

    event.notification.close();

    const notificationData = event.notification.data || {};
    const notificationType = notificationData.type;
    const postId = notificationData.postId;
    const collection = notificationData.collection;

    // Determine URL based on notification type
    let urlToOpen = '/workers'; // Default
    let needsPostCheck = false; // Flag to check if post is active

    // 1. Check Action Button Click
    if (event.action === 'open') {
        urlToOpen = '/workers'; // Explicitly requested to open app home/workers
    }
    // 2. For "New Post Within 50km" - navigate to post detail
    else if (notificationType === 'new_post' && collection && postId) {
        needsPostCheck = true; // Need to check if post is still active

        if (collection === 'workers') {
            urlToOpen = `/worker-detail/${postId}`;
        } else if (collection === 'ads') {
            urlToOpen = `/ad-detail/${postId}`;
        } else if (collection === 'services') {
            urlToOpen = `/service-detail/${postId}`;
        }
    }
    // For Chat Messages (Real-time and Offline)
    else if ((notificationType === 'chat_message' || notificationType === 'chat_offline') && notificationData.chatId) {
        urlToOpen = `/chat/${notificationData.chatId}`;
    }
    // For Reviews and Replies
    else if ((notificationType === 'review' || notificationType === 'review_reply') && collection && postId) {
        if (collection === 'workers') {
            urlToOpen = `/worker-detail/${postId}`;
        } else if (collection === 'ads') {
            urlToOpen = `/ad-detail/${postId}`;
        } else if (collection === 'services') {
            urlToOpen = `/service-detail/${postId}`;
        }
    }
    // For Expiring Favorites - navigate to List Page
    else if (notificationType === 'expiring_favorite' && collection) {
        if (collection === 'ads') urlToOpen = '/ads';
        else if (collection === 'services') urlToOpen = '/services';
        else urlToOpen = '/workers';
    }
    // For all other notifications - navigate to /workers
    else {
        urlToOpen = '/workers';
    }

    // Open the app or focus existing window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(client => {
                            // Send message to client to handle navigation
                            client.postMessage({
                                type: 'NOTIFICATION_CLICK',
                                action: 'navigate',
                                url: urlToOpen,
                                needsPostCheck: needsPostCheck,
                                postId: postId,
                                collection: collection,
                                notificationType: notificationType
                            });
                            return client;
                        });
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
