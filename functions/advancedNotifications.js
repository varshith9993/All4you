const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ============================================================================
// ADVANCED NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Check for offline users with pending chat messages
 * Runs every hour
 */
exports.checkOfflineChatMessages = functions.pubsub
    .schedule('0 * * * *') // Every hour
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            const now = admin.firestore.Timestamp.now();
            const oneHourAgo = new Date(now.toDate().getTime() - (60 * 60 * 1000));

            // Get all chats
            const chatsSnapshot = await admin.firestore().collection('chats').get();

            for (const chatDoc of chatsSnapshot.docs) {
                const chatData = chatDoc.data();
                const participants = chatData.participants || [];

                // Check messages in last hour
                const messagesSnapshot = await admin.firestore()
                    .collection('chats').doc(chatDoc.id).collection('messages')
                    .where('timestamp', '>', admin.firestore.Timestamp.fromDate(oneHourAgo))
                    .get();

                if (messagesSnapshot.empty) continue;

                // Check each participant's last seen
                for (const userId of participants) {
                    const userStatusDoc = await admin.firestore().doc(`userStatus/${userId}`).get();

                    if (!userStatusDoc.exists) continue;

                    const userStatus = userStatusDoc.data();
                    const lastSeen = userStatus.lastSeen?.toDate();

                    // If user was offline for more than 1 hour
                    if (lastSeen && (now.toDate() - lastSeen) > (60 * 60 * 1000)) {
                        // Count unread messages
                        const unreadMessages = messagesSnapshot.docs.filter(
                            msg => msg.data().senderId !== userId
                        );

                        if (unreadMessages.length > 0) {
                            // Get FCM token
                            const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();
                            if (!tokenDoc.exists || !tokenDoc.data().token) continue;

                            const token = tokenDoc.data().token;
                            const lastMessage = unreadMessages[unreadMessages.length - 1].data();

                            // Send notification
                            await admin.messaging().send({
                                token,
                                notification: {
                                    title: `${unreadMessages.length} New Message${unreadMessages.length > 1 ? 's' : ''}`,
                                    body: lastMessage.text || 'You have new messages',
                                },
                                data: {
                                    type: 'chat_offline',
                                    chatId: chatDoc.id,
                                    messageCount: unreadMessages.length.toString()
                                }
                            });
                        }
                    }
                }
            }

            console.log('Offline chat messages check completed');
        } catch (error) {
            console.error('Error checking offline chat messages:', error);
        }
    });

/**
 * Check for expiring favorite posts (1 hour and 5 minutes before expiry)
 * Runs every 15 minutes
 */
exports.checkExpiringFavorites = functions.pubsub
    .schedule('*/15 * * * *') // Every 15 minutes
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            const now = admin.firestore.Timestamp.now();
            const oneHourFromNow = new Date(now.toDate().getTime() + (60 * 60 * 1000));
            const fiveMinutesFromNow = new Date(now.toDate().getTime() + (5 * 60 * 1000));

            const collections = ['workers', 'ads', 'services'];
            const favoriteCollections = ['favoriteWorkers', 'favoriteAds', 'favoriteServices'];

            for (let i = 0; i < collections.length; i++) {
                const collection = collections[i];
                const favoriteCollection = favoriteCollections[i];

                // Get all favorites
                const favoritesSnapshot = await admin.firestore().collection(favoriteCollection).get();

                for (const favoriteDoc of favoritesSnapshot.docs) {
                    const favoriteData = favoriteDoc.data();
                    const postId = favoriteData.workerId || favoriteData.adId || favoriteData.serviceId;
                    const userId = favoriteData.userId;

                    if (!postId || !userId) continue;

                    // Get the post
                    const postDoc = await admin.firestore().doc(`${collection}/${postId}`).get();
                    if (!postDoc.exists) continue;

                    const post = postDoc.data();
                    if (!post.expiresAt) continue;

                    const expiryTime = post.expiresAt.toDate();
                    const timeUntilExpiry = expiryTime - now.toDate();

                    // Check if expiring in 1 hour (send once)
                    if (timeUntilExpiry > 0 && timeUntilExpiry <= (60 * 60 * 1000) && timeUntilExpiry > (55 * 60 * 1000)) {
                        await sendExpiryNotification(userId, post, postId, collection, '1 hour');
                    }
                    // Check if expiring in 5 minutes (send once)
                    else if (timeUntilExpiry > 0 && timeUntilExpiry <= (5 * 60 * 1000) && timeUntilExpiry > (3 * 60 * 1000)) {
                        await sendExpiryNotification(userId, post, postId, collection, '5 minutes');
                    }
                }
            }

            console.log('Expiring favorites check completed');
        } catch (error) {
            console.error('Error checking expiring favorites:', error);
        }
    });

async function sendExpiryNotification(userId, post, postId, collection, timeLeft) {
    try {
        const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();
        if (!tokenDoc.exists || !tokenDoc.data().token) return;

        const token = tokenDoc.data().token;

        await admin.messaging().send({
            token,
            notification: {
                title: `⏰ Favorite Post Expiring Soon!`,
                body: `"${post.title || post.name}" expires in ${timeLeft}!`,
            },
            data: {
                type: 'expiring_favorite',
                collection,
                postId,
                timeLeft,
                requireInteraction: 'true'
            }
        });
    } catch (error) {
        console.error('Error sending expiry notification:', error);
    }
}

/**
 * Trigger: Send notification when review is added
 */
exports.onNewReview = functions.firestore
    .document('{reviewCollection}/{reviewId}')
    .onCreate(async (snap, context) => {
        const { reviewCollection } = context.params;

        // Only trigger for review collections
        if (!['workerReviews', 'adReviews', 'serviceReviews'].includes(reviewCollection)) return;

        const review = snap.data();
        const postOwnerId = review.postOwnerId || review.createdBy;

        if (!postOwnerId) return;

        try {
            const tokenDoc = await admin.firestore().doc(`fcmTokens/${postOwnerId}`).get();
            if (!tokenDoc.exists || !tokenDoc.data().token) return;

            const token = tokenDoc.data().token;

            // Get reviewer profile
            const reviewerDoc = await admin.firestore().doc(`profiles/${review.userId}`).get();
            const reviewerName = reviewerDoc.exists ? reviewerDoc.data().username : 'Someone';

            await admin.messaging().send({
                token,
                notification: {
                    title: `⭐ New ${review.rating}-Star Review!`,
                    body: `${reviewerName} left a review: "${review.comment?.substring(0, 50)}..."`,
                },
                data: {
                    type: 'review',
                    reviewId: snap.id,
                    postId: review.workerId || review.adId || review.serviceId,
                    collection: reviewCollection.replace('Reviews', 's')
                }
            });

            console.log(`Review notification sent to ${postOwnerId}`);
        } catch (error) {
            console.error('Error sending review notification:', error);
        }
    });

/**
 * Trigger: Send notification when someone replies to a review
 */
exports.onReviewReply = functions.firestore
    .document('{reviewCollection}/{reviewId}')
    .onUpdate(async (change, context) => {
        const { reviewCollection } = context.params;

        if (!['workerReviews', 'adReviews', 'serviceReviews'].includes(reviewCollection)) return;

        const before = change.before.data();
        const after = change.after.data();

        // Check if reply was added
        if (!before.reply && after.reply) {
            const reviewerId = after.userId;

            try {
                const tokenDoc = await admin.firestore().doc(`fcmTokens/${reviewerId}`).get();
                if (!tokenDoc.exists || !tokenDoc.data().token) return;

                const token = tokenDoc.data().token;

                await admin.messaging().send({
                    token,
                    notification: {
                        title: `💬 Reply to Your Review`,
                        body: `The owner replied: "${after.reply.substring(0, 50)}..."`,
                    },
                    data: {
                        type: 'review_reply',
                        reviewId: change.after.id,
                        postId: after.workerId || after.adId || after.serviceId,
                        collection: reviewCollection.replace('Reviews', 's')
                    }
                });

                console.log(`Review reply notification sent to ${reviewerId}`);
            } catch (error) {
                console.error('Error sending review reply notification:', error);
            }
        }
    });

/**
 * Trigger: Send notification when favorite post is re-enabled
 */
exports.onPostStatusChange = functions.firestore
    .document('{collection}/{postId}')
    .onUpdate(async (change, context) => {
        const { collection, postId } = context.params;

        if (!['workers', 'ads', 'services'].includes(collection)) return;

        const before = change.before.data();
        const after = change.after.data();

        // Check if post was re-enabled
        if (before.disabled === true && after.disabled === false) {
            try {
                // Get all users who favorited this post
                const favoriteCollection = collection === 'workers' ? 'favoriteWorkers' :
                    collection === 'ads' ? 'favoriteAds' : 'favoriteServices';
                const idField = collection === 'workers' ? 'workerId' :
                    collection === 'ads' ? 'adId' : 'serviceId';

                const favoritesSnapshot = await admin.firestore()
                    .collection(favoriteCollection)
                    .where(idField, '==', postId)
                    .get();

                for (const favoriteDoc of favoritesSnapshot.docs) {
                    const userId = favoriteDoc.data().userId;

                    const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();
                    if (!tokenDoc.exists || !tokenDoc.data().token) continue;

                    const token = tokenDoc.data().token;

                    await admin.messaging().send({
                        token,
                        notification: {
                            title: `✅ Favorite Post is Back!`,
                            body: `"${after.title || after.name}" is now available again!`,
                        },
                        data: {
                            type: 'favorite_enabled',
                            collection,
                            postId
                        }
                    });
                }

                console.log(`Post re-enabled notifications sent for ${postId}`);
            } catch (error) {
                console.error('Error sending post re-enabled notification:', error);
            }
        }
    });

/**
 * Check for inactive users and send reminder notifications
 * Runs daily at 10 AM
 */
exports.checkInactiveUsers = functions.pubsub
    .schedule('0 10 * * *') // Daily at 10 AM
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        try {
            const now = admin.firestore.Timestamp.now();
            const userStatusSnapshot = await admin.firestore().collection('userStatus').get();

            for (const statusDoc of userStatusSnapshot.docs) {
                const userId = statusDoc.id;
                const userStatus = statusDoc.data();
                const lastSeen = userStatus.lastSeen?.toDate();

                if (!lastSeen) continue;

                const daysSinceLastSeen = Math.floor((now.toDate() - lastSeen) / (1000 * 60 * 60 * 24));

                // Send notification at 24, 48, 72, 96... hours
                if (daysSinceLastSeen > 0 && daysSinceLastSeen % 1 === 0) {
                    const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();
                    if (!tokenDoc.exists || !tokenDoc.data().token) continue;

                    const token = tokenDoc.data().token;

                    // Get user profile
                    const profileDoc = await admin.firestore().doc(`profiles/${userId}`).get();
                    const userName = profileDoc.exists ? profileDoc.data().username : 'there';

                    await admin.messaging().send({
                        token,
                        notification: {
                            title: `We Miss You! 👋`,
                            body: `Hey ${userName}, it's been ${daysSinceLastSeen} day${daysSinceLastSeen > 1 ? 's' : ''}! Check out what's new on AeroSigil.`,
                        },
                        data: {
                            type: 'inactive_reminder',
                            daysSinceLastSeen: daysSinceLastSeen.toString()
                        }
                    });
                }
            }

            console.log('Inactive users check completed');
        } catch (error) {
            console.error('Error checking inactive users:', error);
        }
    });

module.exports = exports;
