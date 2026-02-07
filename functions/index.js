const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors')({ origin: true });
const axios = require('axios');

// Load environment variables from .env file
// This works in both local development and Firebase Functions
require('dotenv').config();

admin.initializeApp();

// Import advanced notification functions
const advancedNotifications = require('./advancedNotifications');
Object.assign(exports, advancedNotifications);

// Import admin notification functions
const adminNotifications = require('./adminNotifications');
Object.assign(exports, adminNotifications);

// Import scheduled notification functions (favorites expiry & offline reminders)
const scheduledNotifications = require('./scheduledNotifications');
Object.assign(exports, scheduledNotifications);


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
            const key = appConfig.opencage.api_key;
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
        // Detect if query is a pincode (6 digits)
        const isPincode = /^\d{6}$/.test(query.trim());

        if (provider === 'opencage') {
            const key = appConfig.opencage.api_key;
            if (!key) throw new functions.https.HttpsError('internal', 'OpenCage API Key not configured');

            // OpenCage Search (Geocoding API also handles forward search)
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${key}&limit=10&countrycode=in&no_dedupe=1`;
            const response = await axios.get(url);
            return response.data;
        } else {
            // LocationIQ
            const key = process.env.LOCATIONIQ_API_KEY;
            if (!key) throw new functions.https.HttpsError('internal', 'LocationIQ API Key not configured');

            let url;
            if (isPincode) {
                // For pincode searches, use the search API instead of autocomplete
                // This provides better results for postal codes
                url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${encodeURIComponent(query)}&format=json&countrycodes=in&limit=10&addressdetails=1`;
                console.log('Using search API for pincode:', query);
            } else {
                // For place name searches, use autocomplete with broader tags
                // Removed restrictive tags to allow more results
                url = `https://api.locationiq.com/v1/autocomplete.php?key=${key}&q=${encodeURIComponent(query)}&limit=10&format=json&countrycodes=in&dedupe=0&addressdetails=1`;
                console.log('Using autocomplete API for place:', query);
            }

            const response = await axios.get(url);
            return response.data;
        }
    } catch (error) {
        console.error(`Error in autocomplete ${provider}:`, error.response?.data || error.message);
        // Log more details for debugging
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data));
        }
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
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');

    const { title, body, imageUrl, data: notificationData } = data;
    if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'Title and body are required');

    try {
        // OPTIMIZED: only fetch tokens
        const tokensSnapshot = await admin.firestore().collection('fcmTokens').select('token').get();
        const tokens = [];
        const tokenToDocMap = new Map();

        tokensSnapshot.forEach(doc => {
            const t = doc.data().token;
            if (t) { tokens.push(t); tokenToDocMap.set(t, doc.id); }
        });

        if (tokens.length === 0) return { success: true, message: 'No tokens', sent: 0 };

        const payload = {
            notification: { title, body, ...(imageUrl && { image: imageUrl }) },
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'default_channel', icon: 'https://servepure-fav.web.app/logo192.png', ...(imageUrl && { image: imageUrl }) }
            },
            apns: { payload: { aps: { 'mutable-content': 1, sound: 'default' } }, fcm_options: { image: imageUrl } },
            webpush: { notification: { title, body, icon: '/logo192.png', image: imageUrl, requireInteraction: true } },
            data: { type: 'broadcast', ...(notificationData || {}) }
        };

        const batchSize = 500;
        let totalSent = 0, totalFailed = 0;

        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const response = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });

            totalSent += response.successCount;
            totalFailed += response.failureCount;

            // BATCH CLEANUP: Remove invalid tokens efficiently
            if (response.failureCount > 0) {
                const cleanupBatch = admin.firestore().batch();
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code;
                        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                            const docId = tokenToDocMap.get(batch[idx]);
                            if (docId) cleanupBatch.delete(admin.firestore().doc(`fcmTokens/${docId}`));
                        }
                    }
                });
                await cleanupBatch.commit().catch(() => { });
            }
        }

        return { success: true, sent: totalSent, failed: totalFailed, total: tokens.length };
    } catch (error) {
        console.error('Error in sendNotificationToAll:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send notification to users in specific regions/cities
 */
exports.sendNotificationToRegion = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');

    const { title, body, cities, countries, imageUrl, data: notificationData } = data;
    if (!title || !body || (!cities && !countries)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing metadata');
    }

    try {
        let query = admin.firestore().collection('fcmTokens');
        if (cities?.length > 0) query = query.where('city', 'in', cities);
        else if (countries?.length > 0) query = query.where('country', 'in', countries);

        const tokensSnapshot = await query.select('token').get();
        const tokens = [];
        const tokenToDocMap = new Map();

        tokensSnapshot.forEach(doc => {
            const t = doc.data().token;
            if (t) { tokens.push(t); tokenToDocMap.set(t, doc.id); }
        });

        if (tokens.length === 0) return { success: true, sent: 0 };

        const payload = {
            notification: { title, body, ...(imageUrl && { image: imageUrl }) },
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'default_channel', icon: 'https://servepure-fav.web.app/logo192.png', ...(imageUrl && { image: imageUrl }) }
            },
            data: { type: 'regional', ...(notificationData || {}) }
        };

        const batchSize = 500;
        let totalSent = 0;
        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const response = await admin.messaging().sendEachForMulticast({ tokens: batch, ...payload });
            totalSent += response.successCount;

            if (response.failureCount > 0) {
                const cleanupBatch = admin.firestore().batch();
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code;
                        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                            const docId = tokenToDocMap.get(batch[idx]);
                            if (docId) cleanupBatch.delete(admin.firestore().doc(`fcmTokens/${docId}`));
                        }
                    }
                });
                await cleanupBatch.commit().catch(() => { });
            }
        }

        return { success: true, sent: totalSent, total: tokens.length };
    } catch (error) {
        console.error('Error in sendNotificationToRegion:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Send notification to specific user
 */
exports.sendNotificationToUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');

    const { userId, title, body, imageUrl, url, data: notificationData } = data;
    if (!userId || !title || !body) throw new functions.https.HttpsError('invalid-argument', 'Missing fields');

    try {
        const tokenDoc = await admin.firestore().doc(`fcmTokens/${userId}`).get();
        if (!tokenDoc.exists || !tokenDoc.data().token) return { success: false, message: 'No token' };

        const token = tokenDoc.data().token;
        const message = {
            token,
            notification: { title, body, ...(imageUrl && { image: imageUrl }) },
            android: { notification: { icon: 'https://servepure-fav.web.app/logo192.png' } },
            data: { ...(url && { url }), ...(notificationData || {}) },
            webpush: { fcmOptions: { ...(url && { link: url }) } }
        };

        await admin.messaging().send(message).catch(err => {
            if (err.code === 'messaging/registration-token-not-registered') {
                tokenDoc.ref.delete();
            }
        });

        return { success: true, message: 'Sent' };
    } catch (error) {
        console.error('Error in sendNotificationToUser:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// /**
//  * Trigger: Send notification when new chat message is received
//  * MOVED TO advancedNotifications.js
//  */
// exports.onNewChatMessage = functions.firestore
//     .document('chats/{chatId}/messages/{messageId}')
//     .onCreate(async (snap, context) => {
//         // ... (Logic moved to advancedNotifications.js)
//         console.log('Use advancedNotifications.js implementation');
//     });

// /**
//  * Trigger: Send notification to nearby users when new post is created
//  * MOVED TO advancedNotifications.js
//  */
// exports.onNewPost = functions.firestore
//     .document('{collection}/{postId}')
//     .onCreate(async (snap, context) => {
//        // ... (Logic moved to advancedNotifications.js)
//        console.log('Use advancedNotifications.js implementation');
//     });

/**
 * Scheduled function: Check for expiring posts and notify creators
 * Runs every 6 hours for global coverage
 * Optimization: Sends ONLY ONCE per post (prevents duplicates)
 */
exports.checkExpiringPosts = functions.pubsub
    .schedule('0 */6 * * *') // Every 6 hours (global coverage)
    .timeZone('UTC') // Global: Works for all timezones
    .onRun(async (context) => {
        const collections = ['workers', 'ads', 'services'];
        const now = admin.firestore.Timestamp.now();
        const threeDaysFromNow = new Date(now.toDate().getTime() + (3 * 24 * 60 * 60 * 1000));

        let notificationsSent = 0;
        let skippedDuplicates = 0;

        try {
            for (const collection of collections) {
                // OPTIMIZED: only fetch needed fields
                const expiringPosts = await admin.firestore()
                    .collection(collection)
                    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(threeDaysFromNow))
                    .where('expiresAt', '>', now)
                    .select('createdBy', 'title', 'name', 'expiresAt')
                    .get();

                for (const postDoc of expiringPosts.docs) {
                    const post = postDoc.data();
                    const creatorId = post.createdBy;
                    if (!creatorId) continue;

                    const notificationKey = `expiring_post_${collection}_${postDoc.id}`;
                    const notificationDoc = await admin.firestore().doc(`notificationsSent/${notificationKey}`).get();
                    if (notificationDoc.exists) { skippedDuplicates++; continue; }

                    const tokenDoc = await admin.firestore().doc(`fcmTokens/${creatorId}`).get();
                    if (!tokenDoc.exists || !tokenDoc.data().token) continue;

                    const token = tokenDoc.data().token;
                    const daysLeft = Math.ceil((post.expiresAt.toDate() - now.toDate()) / (1000 * 60 * 60 * 24));

                    await admin.messaging().send({
                        token,
                        notification: {
                            title: 'Post Expiring Soon!',
                            body: `Your ${collection.slice(0, -1)} "${post.title || post.name || 'Post'}" expires in ${daysLeft} day(s)`,
                        },
                        android: { notification: { icon: 'https://servepure-fav.web.app/logo192.png' } },
                        data: { type: 'expiring_post', collection, postId: postDoc.id, url: `/${collection}/${postDoc.id}` }
                    }).catch(err => {
                        if (err.code === 'messaging/registration-token-not-registered') tokenDoc.ref.delete();
                    });

                    await admin.firestore().doc(`notificationsSent/${notificationKey}`).set({
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        postId: postDoc.id,
                        collection,
                        creatorId,
                        daysLeft
                    });

                    notificationsSent++;
                }
            }
            console.log(`✅ Expiring posts check completed. Sent: ${notificationsSent}, Skipped: ${skippedDuplicates}`);
        } catch (error) {
            console.error('Error checking expiring posts:', error);
        }
    });


// Payment functions (Razorpay/Stripe) removed as requested
// Will be added back later when needed
