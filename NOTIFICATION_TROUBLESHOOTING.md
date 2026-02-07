# 🚨 NOTIFICATION SYSTEM TROUBLESHOOTING

**Date:** 2026-02-06 01:53 IST  
**Issues Reported:**
1. ❌ Chat notifications not working when offline
2. ❌ Favorite re-enabled posts not sending notifications
3. ❌ New posts within 50km not sending notifications

**Status:** 🔍 INVESTIGATING & DEPLOYING FIXES

---

## 🔍 Root Cause Analysis

### Possible Issues:

1. **Functions Not Deployed** ✅ DEPLOYING NOW
   - All functions are being redeployed
   - Previous partial deployment may have caused issues

2. **FCM Tokens Missing** ⚠️ NEEDS VERIFICATION
   - Users may not have granted notification permission
   - Tokens may not be saved to Firestore

3. **Firestore Triggers Not Firing** ⚠️ NEEDS VERIFICATION
   - Collection paths may be incorrect
   - Trigger conditions may not be met

4. **Syntax Errors** ✅ FIXED
   - Chat notification had syntax errors (now fixed)
   - Image fields removed (may have caused issues)

---

## 🔧 What I'm Deploying

### All Notification Functions:

1. ✅ `onNewPost` - New posts within 50km
2. ✅ `onNewReview` - Reviews and ratings
3. ✅ `onReviewReply` - Review replies
4. ✅ `onNewChatMessage` - Chat messages
5. ✅ `onPostStatusChange` - Re-enabled posts
6. ✅ `onPostDeleted` - Deleted posts
7. ✅ `checkOfflineChatMessages` - Scheduled (30 min)
8. ✅ `checkExpiringFavorites` - Scheduled (30 min)
9. ✅ `checkInactiveUsers` - Scheduled (6 hours)
10. ✅ `checkExpiringPosts` - Scheduled (6 hours)

### Admin Functions:

11. ✅ `sendNotificationToAll` - Broadcast
12. ✅ `sendNotificationToRegion` - Regional
13. ✅ `sendNotificationToUser` - User-specific

### Utility Functions:

14. ✅ `reverseGeocode` - Location lookup
15. ✅ `searchLocation` - Location search
16. ✅ `getUploadUrl` - File upload
17. ✅ `deleteFile` - File deletion

---

## 🧪 Diagnostic Steps

### Step 1: Run Diagnostic Script

```bash
cd functions
node diagnose-notifications.js
```

**This will check:**
- ✅ FCM tokens exist
- ✅ Recent posts created
- ✅ Recent chat messages
- ✅ Favorites exist
- ✅ Send test notification

### Step 2: Check Function Logs

```bash
firebase functions:log -n 50
```

**Look for:**
- ✅ `[onNewPost] Triggered for...`
- ✅ `[onNewChatMessage] ...`
- ✅ `[onPostStatusChange] ...`
- ❌ Any error messages

### Step 3: Verify FCM Tokens

1. **Open Firebase Console**
2. **Go to Firestore**
3. **Check `fcmTokens` collection**
4. **Verify:**
   - Documents exist (one per user)
   - Each has `token` field
   - Each has `latitude` and `longitude`

### Step 4: Test Each Notification Type

#### Test 1: New Post Within 50km

1. **Create a new worker/ad/service**
2. **Check function logs:**
   ```bash
   firebase functions:log --only onNewPost -n 20
   ```
3. **Expected:**
   - `[onNewPost] Triggered for workers/{id}`
   - `[onNewPost] Found X users within 50km`
   - `Notification sent to X users`

#### Test 2: Chat Message

1. **Send chat message to offline user**
2. **Check function logs:**
   ```bash
   firebase functions:log --only onNewChatMessage -n 20
   ```
3. **Expected:**
   - `✅ Chat notification sent to {userId}`

#### Test 3: Re-enabled Post

1. **Disable a favorited post**
2. **Re-enable it**
3. **Check function logs:**
   ```bash
   firebase functions:log --only onPostStatusChange -n 20
   ```
4. **Expected:**
   - `[onPostStatusChange] Post re-enabled: {id}`
   - `Notification sent to {userId}`

---

## ⚠️ Common Issues & Solutions

### Issue 1: "No FCM tokens found"

**Cause:** Users haven't granted notification permission

**Solution:**
1. **Open app in browser**
2. **Browser should prompt:** "Allow notifications?"
3. **Click "Allow"**
4. **Check browser console (F12):**
   - Look for: `[FCM] Saving token for user...`
5. **Verify in Firestore:**
   - Collection: `fcmTokens`
   - Document: `{userId}`
   - Field: `token`

### Issue 2: "Function not triggered"

**Cause:** Collection path doesn't match trigger

**Solution:**
1. **Check collection names:**
   - `workers` (not `worker`)
   - `ads` (not `ad`)
   - `services` (not `service`)
   - `chats/{chatId}/messages` (subcollection)

2. **Check document structure:**
   - Posts need `latitude` and `longitude`
   - Posts need `createdBy` field
   - Messages need `senderId` field

### Issue 3: "Notification sent but not received"

**Cause:** FCM token invalid or expired

**Solution:**
1. **Clear browser cache**
2. **Refresh page**
3. **Grant permission again**
4. **New token will be saved**

### Issue 4: "Re-enabled post not sending notification"

**Cause:** No favorites exist for that post

**Solution:**
1. **Verify favorites exist:**
   - Collection: `favorites` or `workerFavorites`
   - Field: `workerId` or `adId` or `serviceId`
   - Field: `userId`

2. **Check post status:**
   - Field: `isDisabled` should change from `true` to `false`

### Issue 5: "New post within 50km not working"

**Cause:** No users with location data

**Solution:**
1. **Verify FCM tokens have location:**
   - Collection: `fcmTokens`
   - Fields: `latitude`, `longitude`

2. **Check distance calculation:**
   - Post location: `{lat, lng}`
   - User location: `{lat, lng}`
   - Distance < 50km

---

## 🔍 Debugging Commands

### Check if functions are deployed:
```bash
firebase functions:list
```

### Check specific function logs:
```bash
firebase functions:log --only onNewPost -n 20
firebase functions:log --only onNewChatMessage -n 20
firebase functions:log --only onPostStatusChange -n 20
```

### Check all recent logs:
```bash
firebase functions:log -n 100
```

### Test notification manually:
```bash
cd functions
node test-notification.js
```

---

## 📊 Expected Behavior

### Scenario 1: New Post Created

**Action:** User A creates a worker post at location (12.34, 56.78)

**Expected:**
1. Function `onNewPost` triggers
2. Queries `fcmTokens` for users within 50km
3. Sends notification to each user
4. Logs: `Notification sent to X users`

**User B receives:**
```
[🔔] 📍 New Worker Nearby!
     Plumber is now available in your area
```

### Scenario 2: Chat Message

**Action:** User A sends "Hello!" to offline User B

**Expected:**
1. Function `onNewChatMessage` triggers
2. Checks if User B is offline
3. Counts unread messages
4. Sends notification
5. Logs: `✅ Chat notification sent to {userId}`

**User B receives:**
```
[🔔] New message from User A
     Hello!
```

### Scenario 3: Re-enabled Post

**Action:** User A re-enables a disabled worker post

**Expected:**
1. Function `onPostStatusChange` triggers
2. Detects `isDisabled` changed from `true` to `false`
3. Queries favorites for this post
4. Sends notification to each user who favorited
5. Logs: `Notification sent to {userId}`

**User B receives:**
```
[🔔] ⭐ Favorited Post Back Online!
     Plumber is available again
```

---

## 🚀 Deployment Status

**Currently deploying:** ALL functions

**Command:**
```bash
firebase deploy --only functions
```

**Expected completion:** 5-10 minutes

---

## ✅ Post-Deployment Checklist

After deployment completes:

- [ ] **Run diagnostic script**
  ```bash
  cd functions
  node diagnose-notifications.js
  ```

- [ ] **Check function logs**
  ```bash
  firebase functions:log -n 50
  ```

- [ ] **Verify FCM tokens exist**
  - Open Firebase Console → Firestore → `fcmTokens`

- [ ] **Test new post notification**
  - Create a worker/ad/service
  - Check if nearby users receive notification

- [ ] **Test chat notification**
  - Send message to offline user
  - Check if they receive notification

- [ ] **Test re-enabled post**
  - Disable a favorited post
  - Re-enable it
  - Check if favorited users receive notification

---

## 📞 Next Steps

1. **Wait for deployment** (5-10 min)
2. **Run diagnostic script**
3. **Check function logs**
4. **Test each notification type**
5. **Report results**

---

**🔍 I'm investigating all notification issues. The deployment is in progress. Once complete, run the diagnostic script to identify the exact problem.**

---

**Generated:** 2026-02-06 01:53 IST  
**Status:** 🔍 INVESTIGATING & DEPLOYING  
**Next Action:** Wait for deployment, then run diagnostics
