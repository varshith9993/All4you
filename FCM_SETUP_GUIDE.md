# Firebase Cloud Messaging (FCM) Setup Guide for AeroSigil

## Overview
This document provides step-by-step instructions to complete the FCM notification setup for your AeroSigil app.

## ✅ What's Already Implemented

### Frontend (Web)
- ✅ Service Worker (`public/firebase-messaging-sw.js`)
- ✅ FCM Token Management (`src/utils/fcmService.js`)
- ✅ Notification Settings Component (`src/components/NotificationSettings.js`)
- ✅ Admin Notification Panel (`src/components/AdminNotificationPanel.js`)
- ✅ Firebase Messaging integration in `src/firebase.js`
- ✅ Updated manifest.json with FCM support

### Backend (Cloud Functions)
- ✅ Send notification to all users (`sendNotificationToAll`)
- ✅ Send notification to specific regions (`sendNotificationToRegion`)
- ✅ Send notification to individual user (`sendNotificationToUser`)
- ✅ Auto-trigger on new chat messages (`onNewChatMessage`)
- ✅ Auto-trigger on new posts within 75km (`onNewPost`)
- ✅ Scheduled check for expiring posts (`checkExpiringPosts`)

## 🔧 Required Setup Steps

### Step 1: Generate VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **g-maps-api-472115**
3. Navigate to **Project Settings** (gear icon) → **Cloud Messaging** tab
4. Scroll to **Web Push certificates** section
5. Click **Generate key pair** (if not already generated)
6. Copy the **Key pair** value

### Step 2: Update VAPID Key in Code

Open `src/utils/fcmService.js` and replace:

```javascript
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';
```

With your actual VAPID key:

```javascript
const VAPID_KEY = 'YOUR_COPIED_VAPID_KEY';
```

### Step 3: Enable Cloud Messaging API

1. In Firebase Console, go to **Cloud Messaging** tab
2. Ensure **Firebase Cloud Messaging API** is enabled
3. If not, click **Enable** and wait for activation

### Step 4: Add Notification Settings to Your App

Add the `NotificationSettings` component to your Settings page:

```javascript
import NotificationSettings from '../components/NotificationSettings';

// Inside your Settings component:
<NotificationSettings />
```

### Step 5: Deploy Cloud Functions

Run the following command to deploy the new FCM functions:

```bash
cd functions
npm install
firebase deploy --only functions
```

This will deploy:
- `sendNotificationToAll`
- `sendNotificationToRegion`
- `sendNotificationToUser`
- `onNewChatMessage`
- `onNewPost`
- `checkExpiringPosts`

### Step 6: Set Up Firestore Security Rules

Add these rules to your `firestore.rules` to allow FCM token storage:

```javascript
match /fcmTokens/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### Step 7: Create Firestore Index (for new post notifications)

The `onNewPost` function requires a composite index. Firebase will automatically prompt you to create it when the function first runs, or you can create it manually:

1. Go to Firebase Console → Firestore Database → Indexes
2. Create a composite index for collection `fcmTokens`:
   - Field: `latitude` (Ascending)
   - Field: `longitude` (Ascending)

## 📱 Usage Guide

### For Users

**Enable Notifications:**
1. Go to Settings page
2. Find "Push Notifications" section
3. Click "Enable Notifications"
4. Allow browser permission when prompted

**What notifications will users receive:**
- ✉️ New chat messages
- 📍 New posts within 75km
- ⏰ Posts expiring soon (3 days before)
- 🎉 Festival offers and announcements
- 🎁 Targeted special offers

### For Admins

**Send Broadcast Notification (All Users):**
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendToAll = httpsCallable(functions, 'sendNotificationToAll');

await sendToAll({
  title: 'Diwali Special! 🎉',
  body: 'Get 20% off on all services this Diwali!',
  imageUrl: 'https://example.com/diwali-banner.jpg' // Optional
});
```

**Send Regional Notification:**
```javascript
const sendToRegion = httpsCallable(functions, 'sendNotificationToRegion');

await sendToRegion({
  title: 'Mumbai Festival Offer! 🎊',
  body: 'Special discounts for Mumbai users!',
  cities: ['Mumbai', 'Navi Mumbai', 'Thane']
});
```

**Send to Specific User:**
```javascript
const sendToUser = httpsCallable(functions, 'sendNotificationToUser');

await sendToUser({
  userId: 'user123',
  title: 'Special Offer Just for You! 🎁',
  body: 'You have been selected for our premium membership trial!',
  url: '/offers/premium'
});
```

## 🔄 Automatic Triggers

### Chat Notifications
Automatically sent when a new message is created in any chat. No action needed.

### New Post Notifications
Automatically sent to users within 75km when:
- New worker is posted
- New ad is posted
- New service is posted

### Expiring Post Notifications
Runs daily at 9 AM IST and notifies creators about posts expiring in 3 days.

## 🗂️ Database Structure

### fcmTokens Collection
```javascript
{
  userId: "user123",
  token: "fcm_token_here",
  latitude: 19.0760,
  longitude: 72.8777,
  city: "Mumbai",
  country: "India",
  platform: "web" | "android" | "ios",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 🧪 Testing

### Test on Localhost
1. Ensure you're using HTTPS (required for service workers)
2. Open browser DevTools → Application → Service Workers
3. Verify `firebase-messaging-sw.js` is registered
4. Enable notifications and check for FCM token in Firestore

### Test Notifications
1. Use Admin Panel component to send test notifications
2. Check browser console for any errors
3. Verify notifications appear in browser

## 📊 Monitoring

### View Function Logs
```bash
firebase functions:log
```

### Check Function Performance
Go to Firebase Console → Functions → View logs and metrics

## 🚨 Troubleshooting

### Notifications not working?
1. Check if service worker is registered (DevTools → Application)
2. Verify VAPID key is correct
3. Ensure user has granted notification permission
4. Check browser console for errors
5. Verify FCM token exists in Firestore

### "Permission denied" error?
1. Check Firestore security rules
2. Ensure user is authenticated
3. Verify user has permission to call the function

### Service worker not registering?
1. Ensure you're using HTTPS (or localhost)
2. Clear browser cache and reload
3. Check for JavaScript errors in console

## 🔐 Security Best Practices

1. **Admin Functions**: Uncomment and implement admin role check in `sendNotificationToAll` and `sendNotificationToRegion`
2. **Rate Limiting**: Consider adding rate limiting to prevent spam
3. **Token Cleanup**: Invalid tokens are automatically removed
4. **User Privacy**: Only store necessary location data

## 📱 Mobile App (Android/iOS)

For Capacitor mobile apps, you'll need to:

1. Install Capacitor Push Notifications plugin:
```bash
npm install @capacitor/push-notifications
```

2. Configure native platform settings (see Capacitor docs)
3. Update token registration to use native APIs

## 🎯 Next Steps

1. ✅ Complete VAPID key setup
2. ✅ Deploy Cloud Functions
3. ✅ Add Firestore security rules
4. ✅ Integrate NotificationSettings component
5. ✅ Test notifications
6. ✅ (Optional) Create admin panel page
7. ✅ (Optional) Add analytics tracking

## 📞 Support

If you encounter any issues:
1. Check Firebase Console for function errors
2. Review browser console logs
3. Verify all setup steps are completed
4. Check Firestore rules and indexes

---

**Congratulations! 🎉** Your FCM notification system is ready to use!
