// NOTIFICATION DIAGNOSTIC SCRIPT
// Run this to test if notifications are working

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = require('./g-maps-api-472115-firebase-adminsdk-ufwgr-d1c0e3e8e0.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runDiagnostics() {
    console.log('\n🔍 NOTIFICATION SYSTEM DIAGNOSTICS\n');
    console.log('='.repeat(60));

    // Test 1: Check FCM Tokens
    console.log('\n📱 TEST 1: Checking FCM Tokens...');
    const tokensSnapshot = await db.collection('fcmTokens').limit(5).get();
    console.log(`   Found ${tokensSnapshot.size} FCM tokens`);

    if (tokensSnapshot.empty) {
        console.log('   ❌ NO FCM TOKENS FOUND!');
        console.log('   → Users need to grant notification permission');
    } else {
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   ✅ User: ${doc.id}`);
            console.log(`      Token: ${data.token ? data.token.substring(0, 20) + '...' : 'MISSING'}`);
            console.log(`      Location: ${data.latitude}, ${data.longitude}`);
        });
    }

    // Test 2: Check Recent Posts
    console.log('\n📍 TEST 2: Checking Recent Posts...');
    const now = admin.firestore.Timestamp.now();
    const fiveMinutesAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);

    for (const collection of ['workers', 'ads', 'services']) {
        const postsSnapshot = await db.collection(collection)
            .where('createdAt', '>', fiveMinutesAgo)
            .limit(3)
            .get();

        console.log(`   ${collection}: ${postsSnapshot.size} posts in last 5 minutes`);

        postsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`      - ${doc.id}: ${data.title || data.name || 'Untitled'}`);
            console.log(`        Location: ${data.latitude}, ${data.longitude}`);
            console.log(`        Created: ${data.createdAt?.toDate()}`);
        });
    }

    // Test 3: Check Recent Chat Messages
    console.log('\n💬 TEST 3: Checking Recent Chat Messages...');
    const chatsSnapshot = await db.collection('chats').limit(3).get();
    console.log(`   Found ${chatsSnapshot.size} chats`);

    for (const chatDoc of chatsSnapshot.docs) {
        const messagesSnapshot = await chatDoc.ref.collection('messages')
            .where('createdAt', '>', fiveMinutesAgo)
            .limit(2)
            .get();

        if (!messagesSnapshot.empty) {
            console.log(`   Chat ${chatDoc.id}: ${messagesSnapshot.size} messages in last 5 minutes`);
            messagesSnapshot.forEach(msgDoc => {
                const msg = msgDoc.data();
                console.log(`      - ${msg.senderId}: ${msg.text || msg.type}`);
            });
        }
    }

    // Test 4: Check Favorites
    console.log('\n⭐ TEST 4: Checking Favorites...');
    const favoritesSnapshot = await db.collection('favorites').limit(5).get();
    console.log(`   Found ${favoritesSnapshot.size} favorites`);

    favoritesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   User ${data.userId} favorited:`);
        console.log(`      Worker: ${data.workerId || 'N/A'}`);
        console.log(`      Ad: ${data.adId || 'N/A'}`);
        console.log(`      Service: ${data.serviceId || 'N/A'}`);
    });

    // Test 5: Check Post Status Changes
    console.log('\n🔄 TEST 5: Checking Recent Status Changes...');
    for (const collection of ['workers', 'ads', 'services']) {
        const recentlyEnabledSnapshot = await db.collection(collection)
            .where('isDisabled', '==', false)
            .where('updatedAt', '>', fiveMinutesAgo)
            .limit(3)
            .get();

        console.log(`   ${collection}: ${recentlyEnabledSnapshot.size} recently enabled`);
    }

    // Test 6: Send Test Notification
    console.log('\n🔔 TEST 6: Sending Test Notification...');
    const testTokenDoc = await db.collection('fcmTokens').limit(1).get();

    if (!testTokenDoc.empty) {
        const testToken = testTokenDoc.docs[0].data().token;
        const testUserId = testTokenDoc.docs[0].id;

        try {
            await admin.messaging().send({
                token: testToken,
                notification: {
                    title: '🧪 Test Notification',
                    body: 'If you see this, notifications are working!'
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default_channel',
                        icon: 'https://servepure-fav.web.app/logo192.png'
                    }
                },
                webpush: {
                    headers: { Urgency: 'high' },
                    notification: {
                        title: '🧪 Test Notification',
                        body: 'If you see this, notifications are working!',
                        icon: '/logo192.png'
                    }
                }
            });

            console.log(`   ✅ Test notification sent to user ${testUserId}`);
            console.log(`   → Check your device for the notification!`);
        } catch (error) {
            console.log(`   ❌ Failed to send test notification:`);
            console.log(`      Error: ${error.message}`);
        }
    } else {
        console.log('   ⚠️  No FCM tokens available for testing');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTICS COMPLETE\n');

    process.exit(0);
}

runDiagnostics().catch(error => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
});
