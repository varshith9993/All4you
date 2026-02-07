const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ============================================================================
// CACHE & HELPERS
// ============================================================================
const cache = { tokens: new Map(), TTL: 5 * 60 * 1000 };

async function getCachedToken(uid) {
    if (cache.tokens.has(uid)) {
        const entry = cache.tokens.get(uid);
        if (Date.now() - entry.timestamp < cache.TTL) return entry.token;
    }
    const doc = await admin.firestore().doc(`fcmTokens/${uid}`).get();
    const token = doc.exists ? doc.data().token : null;
    cache.tokens.set(uid, { token, timestamp: Date.now() });
    return token;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * sendAdminNotification: Unified broadcast tool
 */
exports.sendAdminNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required.');

    const { targetType, targetValue, title, body, imageUrl } = data;
    if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'Title/Body required.');

    let tokens = [];
    const tokenToDocMap = new Map();
    let msg = '';

    try {
        if (targetType === 'all') {
            const snap = await admin.firestore().collection('fcmTokens').select('token').get();
            snap.forEach(d => {
                const t = d.data().token;
                if (t) { tokens.push(t); tokenToDocMap.set(t, d.id); }
            });
            msg = `All users (${tokens.length})`;

        } else if (targetType === 'country') {
            const snap = await admin.firestore().collection('fcmTokens').where('country', '==', targetValue).select('token').get();
            snap.forEach(d => {
                const t = d.data().token;
                if (t) { tokens.push(t); tokenToDocMap.set(t, d.id); }
            });
            msg = `Country: ${targetValue} (${tokens.length})`;

        } else if (targetType === 'region') {
            const { latitude, longitude, radius = 50 } = targetValue;
            const snap = await admin.firestore().collection('fcmTokens').where('latitude', '!=', null).select('token', 'latitude', 'longitude').get();
            snap.forEach(doc => {
                const d = doc.data();
                if (d.token && calculateDistance(latitude, longitude, d.latitude, d.longitude) <= radius) {
                    tokens.push(d.token);
                    tokenToDocMap.set(d.token, doc.id);
                }
            });
            msg = `Region: ${radius}km (${tokens.length})`;

        } else if (targetType === 'worker_creators') {
            const snap = await admin.firestore().collection('workers').select('createdBy').get();
            const set = new Set();
            snap.forEach(d => d.data().createdBy && set.add(d.data().createdBy));
            for (const uid of set) {
                const t = await getCachedToken(uid);
                if (t) tokens.push(t);
            }
            msg = `Worker Creators (${tokens.length})`;

        } else if (targetType === 'user') {
            const t = await getCachedToken(targetValue);
            if (t) tokens.push(t);
            msg = `Specific User`;
        }

        if (tokens.length === 0) return { success: true, message: 'No targets' };

        const payload = {
            notification: { title, body, ...(imageUrl && { image: imageUrl }) },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default_channel',
                    icon: 'https://servepure-fav.web.app/logo192.png',
                    ...(imageUrl && { image: imageUrl })
                }
            },
            apns: { payload: { aps: { sound: 'default', 'mutable-content': 1 } }, fcm_options: { image: imageUrl } },
            webpush: {
                headers: { Urgency: 'high' },
                notification: { title, body, icon: '/logo192.png', image: imageUrl, requireInteraction: true }
            },
            data: { type: 'admin_broadcast', ...data.data }
        };

        const batchSize = 500;
        let success = 0, failed = 0;
        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const res = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });
            success += res.successCount;
            failed += res.failureCount;

            // TOKEN CLEANUP
            if (res.failureCount > 0) {
                const batchCleanup = admin.firestore().batch();
                res.responses.forEach((r, idx) => {
                    if (!r.success) {
                        const code = r.error?.code;
                        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                            const docId = tokenToDocMap.get(batch[idx]) || batch[idx]; // userId if doc exists
                            batchCleanup.delete(admin.firestore().doc(`fcmTokens/${targetType === 'user' || targetType === 'worker_creators' ? batch[idx] : docId}`));
                        }
                    }
                });
                await batchCleanup.commit().catch(() => { });
            }
        }

        return { success: true, sent: success, failed, details: msg };
    } catch (e) {
        console.error('sendAdminNotification error:', e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});
