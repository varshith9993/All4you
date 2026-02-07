const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================
const cache = {
    tokens: new Map(),
    notifs: new Map(), // Stores boolean 'exists' status for notification IDs
    TTL: 10 * 60 * 1000 // 10 Minutes (longer for scheduled tasks)
};

async function getCachedDoc(collection, docId) {
    const now = Date.now();
    const cacheMap = collection === 'fcmTokens' ? cache.tokens : null;

    if (cacheMap && cacheMap.has(docId)) {
        const entry = cacheMap.get(docId);
        if (now - entry.timestamp < cache.TTL) return entry.data;
    }

    const doc = await admin.firestore().doc(`${collection}/${docId}`).get();
    const data = doc.exists ? doc.data() : null;

    if (cacheMap) cacheMap.set(docId, { data, timestamp: now });
    return data;
}

// Special check for existing notifications to avoid redundant reads
async function checkNotifExists(notifId) {
    const now = Date.now();
    if (cache.notifs.has(notifId)) {
        const entry = cache.notifs.get(notifId);
        if (now - entry.timestamp < cache.TTL) return entry.exists;
    }

    const doc = await admin.firestore().doc(`notifications/${notifId}`).get();
    const exists = doc.exists;

    cache.notifs.set(notifId, { exists, timestamp: now });
    return exists;
}

/**
 * 1. FAVORITE EXPIRY REMINDERS ✅
 */
exports.checkFavoriteExpiry = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const now = Date.now();
    const nowTimestamp = admin.firestore.Timestamp.fromMillis(now);
    const lookaheadTimestamp = admin.firestore.Timestamp.fromMillis(now + (70 * 60 * 1000));

    try {
        const collections = [
            { name: 'workers', favCol: 'workerFavorites', idField: 'workerId', type: 'worker' },
            { name: 'ads', favCol: 'adFavorites', idField: 'adId', type: 'ad' },
            { name: 'services', favCol: 'serviceFavorites', idField: 'serviceId', type: 'service' }
        ];

        for (const col of collections) {
            const snapshot = await admin.firestore().collection(col.name)
                .where('expiry', '>=', nowTimestamp)
                .where('expiry', '<=', lookaheadTimestamp)
                .get();

            if (snapshot.empty) continue;

            for (const doc of snapshot.docs) {
                const post = doc.data();
                const postId = doc.id;
                const timeUntilExpiry = post.expiry.toDate().getTime() - now;

                let notificationType = null;
                let title = '', message = '';

                // 1 Hour Warning
                if (timeUntilExpiry >= (55 * 60 * 1000) && timeUntilExpiry <= (65 * 60 * 1000)) {
                    notificationType = '1hour';
                    title = 'Last chance!';
                    message = `Your favorite "${post.title || post.name || 'Post'}" expires in 1 hour!`;
                }
                // 5 Minute Warning
                else if (timeUntilExpiry > 0 && timeUntilExpiry <= (10 * 60 * 1000)) {
                    notificationType = '5mins';
                    title = 'Hurry up!!!';
                    message = `⌛️ "${post.title || post.name || 'Post'}" is expiring in minutes!`;
                }

                if (!notificationType) continue;

                const favoritesSnap = await admin.firestore().collection(col.favCol)
                    .where(col.idField, '==', postId)
                    .get();

                const notificationsBatch = [];
                for (const favDoc of favoritesSnap.docs) {
                    const userId = favDoc.data().userId;
                    if (!userId) continue;

                    notificationsBatch.push((async () => {
                        try {
                            const notifId = `expiry_${notificationType}_${postId}_${userId}`;

                            // CACHED: Deduplication
                            if (await checkNotifExists(notifId)) return;

                            // CACHED: Token Lookup
                            const tokenData = await getCachedDoc('fcmTokens', userId);
                            if (!tokenData?.token) return;

                            await admin.messaging().send({
                                token: tokenData.token,
                                notification: { title, body: message },
                                android: {
                                    priority: 'high',
                                    notification: {
                                        channelId: 'default_channel',
                                        icon: 'https://servepure-fav.web.app/logo192.png'
                                    }
                                },
                                apns: { payload: { aps: { sound: 'default', badge: 1, alert: { title, body: message } } } },
                                webpush: {
                                    headers: { Urgency: 'high' },
                                    notification: { title, body: message, icon: '/logo192.png', requireInteraction: true },
                                    fcmOptions: { link: `/${col.name}` }
                                },
                                data: {
                                    type: 'expiring_favorite',
                                    postId,
                                    collection: col.name,
                                    expiryType: notificationType,
                                    url: `/${col.name}`
                                }
                            }).catch(err => {
                                if (err.code === 'messaging/registration-token-not-registered') {
                                    admin.firestore().doc(`fcmTokens/${userId}`).delete().catch(() => { });
                                }
                            });

                            await admin.firestore().doc(`notifications/${notifId}`).set({
                                userId,
                                type: 'post_status',
                                status: `expiring_${notificationType}`,
                                title, message, postId,
                                postType: col.type,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // Update cache to prevent redundant reads in same execution or warm boot
                            cache.notifs.set(notifId, { exists: true, timestamp: Date.now() });

                        } catch (e) {
                            console.error(`[checkFavoriteExpiry] Error:`, e);
                        }
                    })());
                }
                await Promise.all(notificationsBatch);
            }
        }
        return null;
    } catch (error) {
        console.error('[checkFavoriteExpiry] ❌ Error:', error);
        return null;
    }
});

/**
 * 2. OFFLINE REMINDERS ✅
 */
exports.remindOfflineUsers = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    try {
        const now = Date.now();
        const threshold = admin.firestore.Timestamp.fromMillis(now - (24 * 60 * 60 * 1000));

        const userStatusSnapshot = await admin.firestore().collection('userStatus')
            .where('lastSeen', '<=', threshold)
            .get();

        if (userStatusSnapshot.empty) return null;

        const notificationsBatch = [];
        for (const statusDoc of userStatusSnapshot.docs) {
            const userId = statusDoc.id;
            const lastSeen = statusDoc.data().lastSeen;
            if (!lastSeen) continue;

            const timeOffline = now - lastSeen.toDate().getTime();
            let shouldNotify = false, reminderType = '', title = '', message = '';

            if (timeOffline >= (24 * 60 * 60 * 1000) && timeOffline < (25 * 60 * 60 * 1000)) {
                shouldNotify = true; reminderType = '24h';
                title = 'We miss you! 👋'; message = 'Come back and check out new posts in your area!';
            } else if (timeOffline >= (48 * 60 * 60 * 1000) && timeOffline < (49 * 60 * 60 * 1000)) {
                shouldNotify = true; reminderType = '48h';
                title = 'Still there? 🤔'; message = 'Don\'t miss out on new opportunities near you!';
            } else if (timeOffline >= (72 * 60 * 60 * 1000) && timeOffline < (73 * 60 * 60 * 1000)) {
                shouldNotify = true; reminderType = '72h';
                title = 'Long time no see! 😊'; message = 'Your community is waiting for you!';
            } else if (timeOffline >= (72 * 60 * 60 * 1000)) {
                const days = Math.floor(timeOffline / (24 * 60 * 60 * 1000));
                if (timeOffline % (24 * 60 * 60 * 1000) < (60 * 60 * 1000)) {
                    shouldNotify = true; reminderType = `${days}days`;
                    title = 'Come back! 🌟'; message = `It's been ${days} days! Check what's new!`;
                }
            }

            if (shouldNotify) {
                notificationsBatch.push((async () => {
                    try {
                        const notifId = `offline_reminder_${reminderType}_${userId}`;

                        // CACHED: Deduplication
                        if (await checkNotifExists(notifId)) return;

                        // CACHED: Token Lookup
                        const tokenData = await getCachedDoc('fcmTokens', userId);
                        if (!tokenData?.token) return;

                        await admin.messaging().send({
                            token: tokenData.token,
                            notification: { title, body: message },
                            android: {
                                priority: 'high',
                                notification: {
                                    channelId: 'default_channel',
                                    sound: 'default',
                                    icon: 'https://servepure-fav.web.app/logo192.png'
                                }
                            },
                            apns: { payload: { aps: { sound: 'default', badge: 1, alert: { title, body: message } } } },
                            webpush: {
                                headers: { Urgency: 'high' },
                                notification: { title, body: message, icon: '/logo192.png', requireInteraction: true },
                                fcmOptions: { link: '/workers' }
                            },
                            data: { type: 'offline_reminder', reminderType, url: '/workers' }
                        }).catch(err => {
                            if (err.code === 'messaging/registration-token-not-registered') {
                                admin.firestore().doc(`fcmTokens/${userId}`).delete().catch(() => { });
                            }
                        });

                        await admin.firestore().doc(`notifications/${notifId}`).set({
                            userId, type: 'offline_reminder', title, message, reminderType,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        cache.notifs.set(notifId, { exists: true, timestamp: Date.now() });
                    } catch (e) {
                        console.error(`[remindOfflineUsers] Error:`, e);
                    }
                })());
            }
        }
        await Promise.all(notificationsBatch);
        return null;
    } catch (error) {
        console.error('[remindOfflineUsers] Error:', error);
        return null;
    }
});
