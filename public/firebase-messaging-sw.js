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
        icon: payload.notification?.icon || '/aerosigil-logo-192x192.png', // AeroSigil logo
        badge: '/aerosigil-logo-192x192.png', // AeroSigil logo badge
        tag: notificationData.tag || notificationData.type || 'default',
        data: notificationData,
        requireInteraction: notificationData.requireInteraction === 'true',
        vibrate: [200, 100, 200],
        timestamp: Date.now()
    };

    // Add image if provided
    if (payload.notification?.image) {
        notificationOptions.image = payload.notification.image;
    }

    // Add action buttons based on notification type
    const notificationType = notificationData.type;

    if (notificationType === 'chat' || notificationType === 'chat_offline') {
        notificationOptions.actions = [
            { action: 'open_chat', title: 'Open Chat', icon: '/aerosigil-logo-192x192.png' },
            { action: 'dismiss', title: 'Later' }
        ];
    } else if (notificationType === 'new_post' || notificationType === 'favorite_enabled') {
        notificationOptions.actions = [
            { action: 'view_post', title: 'View Post', icon: '/aerosigil-logo-192x192.png' },
            { action: 'dismiss', title: 'Later' }
        ];
    } else if (notificationType === 'expiring_favorite' || notificationType === 'expiring_post') {
        notificationOptions.actions = [
            { action: 'view_post', title: 'View Now', icon: '/aerosigil-logo-192x192.png' },
            { action: 'dismiss', title: 'Remind Later' }
        ];
        notificationOptions.requireInteraction = true; // Keep visible
    } else if (notificationType === 'review' || notificationType === 'review_reply') {
        notificationOptions.actions = [
            { action: 'view_post', title: 'View Review', icon: '/aerosigil-logo-192x192.png' },
            { action: 'dismiss', title: 'Later' }
        ];
    } else if (notificationType === 'inactive_reminder') {
        notificationOptions.actions = [
            { action: 'open_app', title: 'Open App', icon: '/aerosigil-logo-192x192.png' },
            { action: 'dismiss', title: 'Later' }
        ];
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.', event);

    event.notification.close();

    const notificationData = event.notification.data || {};
    const action = event.action;

    // Handle dismiss action
    if (action === 'dismiss') {
        return;
    }

    // Determine URL based on notification type and action
    let urlToOpen = '/workers'; // Default fallback

    const notificationType = notificationData.type;
    const postId = notificationData.postId;
    const collection = notificationData.collection;
    const chatId = notificationData.chatId;

    // Smart navigation based on notification type
    if (action === 'open_chat' || notificationType === 'chat' || notificationType === 'chat_offline') {
        urlToOpen = chatId ? `/chat/${chatId}` : '/chats';
    } else if (action === 'view_post' || notificationType === 'new_post' || notificationType === 'favorite_enabled' ||
        notificationType === 'expiring_favorite' || notificationType === 'expiring_post' ||
        notificationType === 'review' || notificationType === 'review_reply') {
        // Navigate to specific post detail page
        if (collection && postId) {
            if (collection === 'workers') {
                urlToOpen = `/worker/${postId}`;
            } else if (collection === 'ads') {
                urlToOpen = `/ad/${postId}`;
            } else if (collection === 'services') {
                urlToOpen = `/service/${postId}`;
            }
        } else if (notificationData.url) {
            urlToOpen = notificationData.url;
        }
    } else if (notificationType === 'inactive_reminder' || action === 'open_app') {
        urlToOpen = '/workers';
    } else if (notificationData.url) {
        // Use custom URL if provided
        urlToOpen = notificationData.url;
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
                            // Navigate to the specific URL
                            if (urlToOpen && client.navigate) {
                                return client.navigate(urlToOpen);
                            }
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
