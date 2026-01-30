const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors')({ origin: true });
const axios = require('axios');

admin.initializeApp();

// Import advanced notification functions
const advancedNotifications = require('./advancedNotifications');
Object.assign(exports, advancedNotifications);


/**
 * Proxy function for LocationIQ and OpenCage Reverse Geocoding
 * Allows frontend to fetch address without exposing API keys
 */
exports.reverseGeocode = functions.https.onCall(async (data, context) => {
    // Note: We are allowing unauthenticated calls because Signup page uses this.
    // In production, consider adding App Check or stricter validation.

    const { lat, lon, provider = 'locationiq' } = data;

    if (!lat || !lon) {
        throw new functions.https.HttpsError('invalid-argument', 'Latitude and Longitude are required');
    }

    try {
        let response;
        if (provider === 'opencage') {
            const key = process.env.OPENCAGE_API_KEY;
            if (!key) throw new functions.https.HttpsError('internal', 'OpenCage API Key not configured');

            const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}`;
            response = await axios.get(url);
            return response.data;
        } else {
            // Default to LocationIQ
            const key = process.env.LOCATIONIQ_API_KEY;
            if (!key) throw new functions.https.HttpsError('internal', 'LocationIQ API Key not configured');

            const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;
            response = await axios.get(url);
            return response.data;
        }
    } catch (error) {
        console.error(`Error in reverseGeocode ${provider}:`, error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', 'Failed to fetch location data');
    }
});

/**
 * Proxy function for LocationIQ Autocomplete
 */
exports.autocomplete = functions.https.onCall(async (data, context) => {
    const { query, provider = 'locationiq' } = data;

    if (!query) {
        throw new functions.https.HttpsError('invalid-argument', 'Query is required');
    }

    try {
        if (provider === 'opencage') {
            const key = process.env.OPENCAGE_API_KEY;
            if (!key) throw new functions.https.HttpsError('internal', 'OpenCage API Key not configured');

            // OpenCage Search (Geocoding API also handles forward search)
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${key}&limit=5&countrycode=in&no_dedupe=1`;
            const response = await axios.get(url);
            return response.data;
        } else {
            // LocationIQ
            const key = process.env.LOCATIONIQ_API_KEY;
            if (!key) throw new functions.https.HttpsError('internal', 'LocationIQ API Key not configured');

            const url = `https://api.locationiq.com/v1/autocomplete.php?key=${key}&q=${encodeURIComponent(query)}&limit=5&format=json&countrycodes=in&dedupe=1&match_all_queries=0&tag=place:city,place:town,place:village,boundary:administrative,postal_code`;
            const response = await axios.get(url);
            return response.data;
        }
    } catch (error) {
        console.error(`Error in autocomplete ${provider}:`, error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', 'Failed to fetch autocomplete data');
    }
});


// Initialize R2 Client (S3 Compatible)
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

/**
 * Generate a Presigned URL for uploading to Cloudflare R2.
 * Frontend calls this -> Gets URL -> PUTs file directly to R2.
 */
exports.getUploadUrl = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method Not Allowed' });
            }

            // Ensure user is authenticated
            const idToken = req.headers.authorization?.split('Bearer ')[1];
            if (!idToken) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            await admin.auth().verifyIdToken(idToken);

            const { fileName, fileType, folder = 'uploads' } = req.body;
            if (!fileName || !fileType) {
                return res.status(400).json({ error: 'Missing fileName or fileType' });
            }

            // Construct a unique file path
            const timestamp = Date.now();
            const uniqueFileName = `${folder}/${timestamp}_${fileName}`;

            const command = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: uniqueFileName,
                ContentType: fileType,
                CacheControl: 'public, max-age=31536000',
                Metadata: {
                    'uploaded-by': 'aerosigil-app'
                }
            });

            // Generate Signed URL (valid for 15 minutes)
            const signedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

            // Construct the Public URL for retrieving the file
            const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${uniqueFileName}`;

            res.status(200).json({
                uploadUrl: signedUrl,
                publicUrl: publicUrl,
                filePath: uniqueFileName
            });

        } catch (error) {
            console.error('Error getting upload URL:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Securely delete a file from R2
 */
exports.deleteFile = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { filePath } = data;
    if (!filePath) {
        throw new functions.https.HttpsError('invalid-argument', 'File path is required');
    }

    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: filePath,
        });

        await r2.send(command);
        return { success: true };
    } catch (error) {
        console.error('Error deleting file:', error);
        throw new functions.https.HttpsError('internal', 'Unable to delete file');
    }
});

// ============================================================================
// FCM NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Send notification to all users (festivals, major announcements)
 * Admin only function
 */
exports.sendNotificationToAll = functions.https.onCall(async (data, context) => {
    // Verify admin authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // TODO: Add admin role check
    // const userDoc = await admin.firestore().doc(`profiles/${context.auth.uid}`).get();
    // if (!userDoc.data()?.isAdmin) {
    //     throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    // }

    const { title, body, imageUrl, data: notificationData } = data;

    if (!title || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'Title and body are required');
    }

    try {
        // Get all FCM tokens
        const tokensSnapshot = await admin.firestore().collection('fcmTokens').get();
        const tokens = [];

        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData.token) {
                tokens.push(tokenData.token);
            }
        });

        if (tokens.length === 0) {
            return { success: true, message: 'No tokens found', sent: 0 };
        }

        // Prepare notification payload
        const payload = {
            notification: {
                title,
                body,
                ...(imageUrl && { imageUrl })
            },
            data: {
                type: 'broadcast',
                ...(notificationData || {})
            }
        };

        // Send in batches of 500 (FCM limit)
        const batchSize = 500;
        let totalSent = 0;
        let totalFailed = 0;

        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const response = await admin.messaging().sendEachForMulticast({
                tokens: batch,
                ...payload
            });

            totalSent += response.successCount;
            totalFailed += response.failureCount;

            // Remove invalid tokens
            if (response.failureCount > 0) {
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        invalidTokens.push(batch[idx]);
                    }
                });

                // Delete invalid tokens from Firestore
                const deletePromises = invalidTokens.map(token =>
                    admin.firestore().collection('fcmTokens')
                        .where('token', '==', token)
                        .get()
                        .then(snapshot => {
                            snapshot.forEach(doc => doc.ref.delete());
                        })
                );
                await Promise.all(deletePromises);
            }
        }

        return {
            success: true,
            sent: totalSent,
            failed: totalFailed,
            total: tokens.length
        };
    } catch (error) {
        console.error('Error sending notification to all:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send notification to users in specific regions/cities
 * For regional festivals or offers
 */
exports.sendNotificationToRegion = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { title, body, cities, countries, imageUrl, data: notificationData } = data;

    if (!title || !body || (!cities && !countries)) {
        throw new functions.https.HttpsError('invalid-argument', 'Title, body, and at least one location filter required');
    }

    try {
        let query = admin.firestore().collection('fcmTokens');

        // Filter by cities or countries
        if (cities && cities.length > 0) {
            query = query.where('city', 'in', cities);
        } else if (countries && countries.length > 0) {
            query = query.where('country', 'in', countries);
        }

        const tokensSnapshot = await query.get();
        const tokens = [];

        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData.token) {
                tokens.push(tokenData.token);
            }
        });

        if (tokens.length === 0) {
            return { success: true, message: 'No tokens found for specified region', sent: 0 };
        }

        const payload = {
            notification: {
                title,
                body,
                ...(imageUrl && { imageUrl })
            },
            data: {
                type: 'regional',
                ...(notificationData || {})
            }
        };

        const batchSize = 500;
        let totalSent = 0;

        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const response = await admin.messaging().sendEachForMulticast({
                tokens: batch,
                ...payload
            });
            totalSent += response.successCount;
        }

        return { success: true, sent: totalSent, total: tokens.length };
    } catch (error) {
        console.error('Error sending regional notification:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send notification to specific user
 */
exports.sendNotificationToUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, title, body, imageUrl, url, data: notificationData } = data;

    if (!userId || !title || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'userId, title, and body are required');
    }

    try {
        const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();

        if (!tokenDoc.exists || !tokenDoc.data().token) {
            return { success: false, message: 'No FCM token found for user' };
        }

        const token = tokenDoc.data().token;

        const message = {
            token,
            notification: {
                title,
                body,
                ...(imageUrl && { imageUrl })
            },
            data: {
                ...(url && { url }),
                ...(notificationData || {})
            },
            webpush: {
                fcmOptions: {
                    ...(url && { link: url })
                }
            }
        };

        await admin.messaging().send(message);

        return { success: true, message: 'Notification sent successfully' };
    } catch (error) {
        console.error('Error sending notification to user:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Trigger: Send notification when new chat message is received
 */
exports.onNewChatMessage = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const { chatId } = context.params;

        try {
            // Get chat document to find recipient
            const chatDoc = await admin.firestore().doc(`chats/${chatId}`).get();
            if (!chatDoc.exists) return;

            const chatData = chatDoc.data();
            const participants = chatData.participants || [];

            // Find recipient (not the sender)
            const recipientId = participants.find(id => id !== message.senderId);
            if (!recipientId) return;

            // Get sender profile for notification
            const senderDoc = await admin.firestore().doc(`profiles/${message.senderId}`).get();
            const senderName = senderDoc.exists ? senderDoc.data().username : 'Someone';

            // Get recipient's FCM token
            const tokenDoc = await admin.firestore().doc(`fcmTokens/${recipientId}`).get();
            if (!tokenDoc.exists || !tokenDoc.data().token) return;

            const token = tokenDoc.data().token;

            // Send notification
            await admin.messaging().send({
                token,
                notification: {
                    title: `New message from ${senderName}`,
                    body: message.text || 'Sent an attachment',
                },
                data: {
                    type: 'chat',
                    chatId,
                    senderId: message.senderId,
                    url: `/chat/${chatId}`
                },
                webpush: {
                    fcmOptions: {
                        link: `/chat/${chatId}`
                    }
                }
            });

            console.log(`Chat notification sent to ${recipientId}`);
        } catch (error) {
            console.error('Error sending chat notification:', error);
        }
    });

/**
 * Trigger: Send notification to nearby users when new post is created
 */
exports.onNewPost = functions.firestore
    .document('{collection}/{postId}')
    .onCreate(async (snap, context) => {
        const { collection, postId } = context.params;

        // Only trigger for workers, ads, services
        if (!['workers', 'ads', 'services'].includes(collection)) return;

        const post = snap.data();
        if (!post.latitude || !post.longitude) return;

        try {
            // Get all FCM tokens with location data
            const tokensSnapshot = await admin.firestore().collection('fcmTokens')
                .where('latitude', '!=', null)
                .get();

            const nearbyTokens = [];

            // Filter users within 75km
            tokensSnapshot.forEach(doc => {
                const tokenData = doc.data();
                if (!tokenData.token || !tokenData.latitude || !tokenData.longitude) return;

                // Don't notify the creator
                if (tokenData.userId === post.createdBy) return;

                const distance = calculateDistance(
                    post.latitude,
                    post.longitude,
                    tokenData.latitude,
                    tokenData.longitude
                );

                if (distance <= 75) {
                    nearbyTokens.push(tokenData.token);
                }
            });

            if (nearbyTokens.length === 0) return;

            // Get post type label
            const typeLabel = collection === 'workers' ? 'Worker' :
                collection === 'ads' ? 'Ad' : 'Service';

            const payload = {
                notification: {
                    title: `New ${typeLabel} Posted Nearby!`,
                    body: post.title || post.name || `Check out this new ${typeLabel.toLowerCase()}`,
                    ...(post.images && post.images[0] && { imageUrl: post.images[0] })
                },
                data: {
                    type: 'new_post',
                    collection,
                    postId,
                    url: `/${collection}/${postId}`
                }
            };

            // Send in batches
            const batchSize = 500;
            for (let i = 0; i < nearbyTokens.length; i += batchSize) {
                const batch = nearbyTokens.slice(i, i + batchSize);
                await admin.messaging().sendEachForMulticast({
                    tokens: batch,
                    ...payload
                });
            }

            console.log(`New post notification sent to ${nearbyTokens.length} nearby users`);
        } catch (error) {
            console.error('Error sending new post notification:', error);
        }
    });

/**
 * Scheduled function: Check for expiring posts and notify creators
 * Runs daily at 9 AM
 */
exports.checkExpiringPosts = functions.pubsub
    .schedule('0 9 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
        const collections = ['workers', 'ads', 'services'];
        const now = admin.firestore.Timestamp.now();
        const threeDaysFromNow = new Date(now.toDate().getTime() + (3 * 24 * 60 * 60 * 1000));

        try {
            for (const collection of collections) {
                const expiringPosts = await admin.firestore()
                    .collection(collection)
                    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(threeDaysFromNow))
                    .where('expiresAt', '>', now)
                    .get();

                for (const postDoc of expiringPosts.docs) {
                    const post = postDoc.data();
                    const creatorId = post.createdBy;

                    if (!creatorId) continue;

                    // Get creator's FCM token
                    const tokenDoc = await admin.firestore().doc(`fcmTokens/${creatorId}`).get();
                    if (!tokenDoc.exists || !tokenDoc.data().token) continue;

                    const token = tokenDoc.data().token;
                    const daysLeft = Math.ceil((post.expiresAt.toDate() - now.toDate()) / (1000 * 60 * 60 * 24));

                    // Send notification
                    await admin.messaging().send({
                        token,
                        notification: {
                            title: 'Post Expiring Soon!',
                            body: `Your ${collection.slice(0, -1)} "${post.title || post.name}" expires in ${daysLeft} day(s)`,
                        },
                        data: {
                            type: 'expiring_post',
                            collection,
                            postId: postDoc.id,
                            url: `/${collection}/${postDoc.id}`
                        }
                    });
                }
            }

            console.log('Expiring posts check completed');
        } catch (error) {
            console.error('Error checking expiring posts:', error);
        }
    });

