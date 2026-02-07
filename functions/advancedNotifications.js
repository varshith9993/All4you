const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ============================================================================
// IN-MEMORY CACHE (Optimizes Warm Boots & Parallel Executes)
// ============================================================================
const cache = {
    tokens: new Map(),
    profiles: new Map(),
    status: new Map(),
    TTL: 5 * 60 * 1000 // 5 Minutes
};

/**
 * Helper to get document with in-memory caching
 */
async function getCachedDoc(collection, docId) {
    const now = Date.now();
    const cacheMap = collection === 'fcmTokens' ? cache.tokens :
        collection === 'profiles' ? cache.profiles :
            collection === 'userStatus' ? cache.status : null;

    if (cacheMap && cacheMap.has(docId)) {
        const entry = cacheMap.get(docId);
        if (now - entry.timestamp < cache.TTL) {
            return entry.data;
        }
    }

    const doc = await admin.firestore().doc(`${collection}/${docId}`).get();
    const data = doc.exists ? doc.data() : null;

    if (cacheMap) {
        cacheMap.set(docId, { data, timestamp: now });
    }
    return data;
}

/**
 * 1. NEW POST WITHIN 50KM ✅
 */
exports.onNewPost = functions.firestore
    .document('{collection}/{postId}')
    .onCreate(async (snap, context) => {
        const { collection, postId } = context.params;
        if (!['workers', 'ads', 'services'].includes(collection)) return;

        const post = snap.data();
        if (!post.latitude || !post.longitude) return;

        try {
            const city = post.location?.city;
            const country = post.location?.country || post.country;

            let query = admin.firestore().collection('fcmTokens');

            if (city) {
                query = query.where('city', '==', city);
            } else if (country) {
                query = query.where('country', '==', country);
            } else {
                query = query.where('latitude', '!=', null);
            }

            // OPTIMIZATION: Only fetch needed fields
            const tokensSnapshot = await query.select('token', 'latitude', 'longitude', 'userId').get();
            if (tokensSnapshot.empty) return;

            const nearbyTokens = [];
            const tokenToDocMap = new Map(); // For cleanup

            tokensSnapshot.forEach(doc => {
                const tokenData = doc.data();
                if (!tokenData.token || !tokenData.latitude || !tokenData.longitude) return;
                if (tokenData.userId === post.createdBy) return;

                const distance = calculateDistance(
                    Number(post.latitude),
                    Number(post.longitude),
                    Number(tokenData.latitude),
                    Number(tokenData.longitude)
                );

                if (distance <= 50) {
                    nearbyTokens.push(tokenData.token);
                    tokenToDocMap.set(tokenData.token, doc.id);
                }
            });

            if (nearbyTokens.length === 0) return;

            const typeLabel = collection === 'workers' ? 'Worker' : collection === 'ads' ? 'Ad' : 'Service';
            const title = `📍 New ${typeLabel} Nearby!`;
            const body = post.title || post.name ? `${post.title || post.name} is now available near you.` : `A new ${typeLabel.toLowerCase()} has been posted near you.`;

            const payload = {
                notification: { title, body },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default_channel',
                        icon: 'https://servepure-fav.web.app/logo192.png'
                    }
                },
                apns: { payload: { aps: { sound: 'default', 'mutable-content': 1 } } },
                webpush: {
                    headers: { Urgency: 'high' },
                    notification: { title, body, icon: '/logo192.png', requireInteraction: true },
                    fcmOptions: { link: `/${collection}/${postId}` }
                },
                data: {
                    type: 'new_post',
                    collection,
                    postId,
                    url: `/${collection}/${postId}`
                }
            };

            const batchSize = 500;
            for (let i = 0; i < nearbyTokens.length; i += batchSize) {
                const batch = nearbyTokens.slice(i, i + batchSize);
                const response = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });

                // TOKEN CLEANUP: Remove invalid tokens to save future read costs
                if (response.failureCount > 0) {
                    const batchCleanup = admin.firestore().batch();
                    response.responses.forEach((res, idx) => {
                        if (!res.success) {
                            const errorCode = res.error?.code;
                            if (errorCode === 'messaging/registration-token-not-registered' ||
                                errorCode === 'messaging/invalid-registration-token') {
                                const docId = tokenToDocMap.get(batch[idx]);
                                if (docId) batchCleanup.delete(admin.firestore().doc(`fcmTokens/${docId}`));
                            }
                        }
                    });
                    await batchCleanup.commit().catch(err => console.error('Cleanup error:', err));
                }
            }
        } catch (error) {
            console.error('[onNewPost] Error:', error);
        }
    });

/**
 * 2. NEW REVIEW/RATING ✅
 */
exports.onNewReview = functions.firestore
    .document('{reviewCollection}/{reviewId}')
    .onCreate(async (snap, context) => {
        const { reviewCollection } = context.params;
        if (!['workerReviews', 'adReviews', 'serviceReviews'].includes(reviewCollection)) return;

        const review = snap.data();
        let postOwnerId = review.postOwnerId;

        if (!postOwnerId) {
            try {
                const collectionMap = { 'workerReviews': 'workers', 'adReviews': 'ads', 'serviceReviews': 'services' };
                const parentCollection = collectionMap[reviewCollection];
                const postId = review.workerId || review.adId || review.serviceId;

                if (parentCollection && postId) {
                    const postDoc = await admin.firestore().doc(`${parentCollection}/${postId}`).get();
                    if (postDoc.exists) {
                        const postData = postDoc.data();
                        postOwnerId = postData.createdBy || postData.userId || postData.ownerId;
                    }
                }
            } catch (err) {
                console.error('Error fetching parent post for review:', err);
            }
        }

        if (!postOwnerId) return;

        try {
            // CACHED: Get Token
            const tokenData = await getCachedDoc('fcmTokens', postOwnerId);
            if (!tokenData || !tokenData.token) return;

            const token = tokenData.token;

            // CACHED: Get Reviewer Name
            const reviewerId = review.userId || review.createdBy;
            let reviewerName = 'Someone';

            if (reviewerId) {
                const reviewerProfile = await getCachedDoc('profiles', reviewerId);
                if (reviewerProfile) {
                    reviewerName = reviewerProfile.username || 'Someone';
                }
            }

            const title = review.rating ? `⭐ New ${review.rating}-Star Rating!` : `💬 New Review Comment`;
            const reviewText = review.text || review.comment || '';
            const body = reviewText ? `${reviewerName}: "${reviewText.substring(0, 50)}..."` : `${reviewerName} rated you ${review.rating} stars.`;

            const targetCollection = reviewCollection.replace('Reviews', 's');
            const targetRoute = targetCollection === 'workers' ? 'worker-detail' : targetCollection === 'ads' ? 'ad-detail' : 'service-detail';
            const targetId = review.workerId || review.adId || review.serviceId;

            await admin.messaging().send({
                token,
                notification: { title, body },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default_channel',
                        icon: 'https://servepure-fav.web.app/logo192.png'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            'mutable-content': 1,
                            badge: 1
                        }
                    }
                },
                webpush: {
                    headers: { Urgency: 'high' },
                    notification: { title, body, icon: '/logo192.png' },
                    fcmOptions: { link: `/${targetRoute}/${targetId}` }
                },
                data: {
                    type: 'review',
                    reviewId: snap.id,
                    postId: targetId,
                    collection: targetCollection
                }
            }).catch(err => {
                if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                    admin.firestore().doc(`fcmTokens/${postOwnerId}`).delete().catch(() => { });
                }
            });
        } catch (error) {
            console.error('❌ Error sending review notification:', error);
        }
    });

/**
 * 3. REVIEW REPLY ✅
 */
exports.onReviewReply = functions.firestore
    .document('{reviewCollection}/{reviewId}')
    .onUpdate(async (change, context) => {
        const { reviewCollection } = context.params;
        if (!['workerReviews', 'adReviews', 'serviceReviews'].includes(reviewCollection)) return;

        const before = change.before.data();
        const after = change.after.data();
        const beforeReplies = before.replies || (before.reply ? [{ text: before.reply }] : []);
        const afterReplies = after.replies || (after.reply ? [{ text: after.reply }] : []);

        if (afterReplies.length > beforeReplies.length) {
            const latestReply = afterReplies[afterReplies.length - 1];
            const replyText = latestReply.text || latestReply;
            const reviewerId = after.userId || after.createdBy;

            try {
                // CACHED: Get Token
                const tokenData = await getCachedDoc('fcmTokens', reviewerId);
                if (!tokenData || !tokenData.token) return;

                const token = tokenData.token;
                const targetCollection = reviewCollection.replace('Reviews', 's');
                const targetRoute = targetCollection === 'workers' ? 'worker-detail' : targetCollection === 'ads' ? 'ad-detail' : 'service-detail';
                const targetId = after.workerId || after.adId || after.serviceId;

                await admin.messaging().send({
                    token,
                    notification: {
                        title: `💬 Reply to Your Review`,
                        body: `The owner replied: "${replyText.substring(0, 50)}..."`
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'default_channel',
                            icon: 'https://servepure-fav.web.app/logo192.png'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                'mutable-content': 1,
                                badge: 1
                            }
                        }
                    },
                    webpush: {
                        headers: { Urgency: 'high' },
                        notification: {
                            title: `💬 Reply to Your Review`,
                            body: `The owner replied: "${replyText.substring(0, 50)}..."`,
                            icon: '/logo192.png'
                        },
                        fcmOptions: { link: `/${targetRoute}/${targetId}` }
                    },
                    data: {
                        type: 'review_reply',
                        reviewId: change.after.id,
                        postId: targetId,
                        collection: targetCollection
                    }
                }).catch(err => {
                    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                        admin.firestore().doc(`fcmTokens/${reviewerId}`).delete().catch(() => { });
                    }
                });
            } catch (error) {
                console.error('❌ Error sending review reply notification:', error);
            }
        }
    });

/**
 * 4. INSTANT CHAT MESSAGE ✅
 */
exports.onNewChatMessage = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const { chatId } = context.params;
        if (!message.senderId) return;

        try {
            const chatDoc = await admin.firestore().doc(`chats/${chatId}`).get();
            if (!chatDoc.exists) return;

            const chatData = chatDoc.data();
            const recipientId = (chatData.participants || []).find(id => id && id !== message.senderId);
            if (!recipientId || (chatData.mutedBy && chatData.mutedBy.includes(recipientId))) return;

            // CACHED: Status, Token, Profile
            const [userStatus, tokenData, senderProfile] = await Promise.all([
                getCachedDoc('userStatus', recipientId),
                getCachedDoc('fcmTokens', recipientId),
                getCachedDoc('profiles', message.senderId)
            ]);

            if (userStatus?.isOnline) return;
            if (!tokenData?.token) return;

            const senderName = senderProfile?.username || 'User';
            const notificationBody = message.text || (message.type === 'image' ? '📷 Photo' : '📎 Attachment');
            const notificationTitle = `🗨️ New message(s) from ${senderName}`;

            await admin.messaging().send({
                token: tokenData.token,
                notification: { title: notificationTitle, body: notificationBody },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'default_channel',
                        sound: 'default',
                        tag: `chat_${chatId}`,
                        icon: 'https://servepure-fav.web.app/logo192.png',
                        color: '#4A90E2',
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            threadId: `chat_${chatId}`,
                            alert: { title: notificationTitle, body: notificationBody },
                            'mutable-content': 1,
                            badge: 1
                        }
                    }
                },
                webpush: {
                    headers: { Urgency: 'high' },
                    notification: {
                        title: notificationTitle,
                        body: notificationBody,
                        tag: `chat_${chatId}`,
                        icon: '/logo192.png',
                        badge: '/logo192.png',
                        renotify: true,
                        requireInteraction: true,
                        actions: [{ action: 'open', title: 'Open' }]
                    },
                    fcmOptions: { link: `/chat/${chatId}` }
                },
                data: {
                    type: 'chat_message',
                    chatId: chatId,
                    senderId: message.senderId,
                    stackedBody: notificationBody
                }
            }).catch(err => {
                if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                    admin.firestore().doc(`fcmTokens/${recipientId}`).delete().catch(() => { });
                }
            });
        } catch (error) {
            console.error('[onNewChatMessage] Error:', error);
        }
    });

/**
 * Helper: Calculate distance
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

module.exports = exports;
