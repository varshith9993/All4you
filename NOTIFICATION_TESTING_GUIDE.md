# 🧪 Notification System Testing Guide

**Date:** 2026-02-06  
**Project:** ServePure (AeroSigil)  
**Status:** Functions Deployed with dotenv support

## 📋 Pre-Deployment Checklist

✅ **Functions Code Updated**
- Added `dotenv` package to load .env file
- All environment variables properly configured
- Notification triggers implemented

✅ **Environment Variables Set**
- R2 storage credentials
- LocationIQ API key
- OpenCage API key
- Razorpay keys (test mode)

✅ **Deployment In Progress**
- Running: `firebase deploy --only functions`
- Expected: All notification functions deployed

## 🧪 Testing Procedure

### Step 1: Verify Deployment

**Command:**
```bash
firebase functions:list
```

**Expected Output:**
```
✔ onNewPost (Firestore trigger)
✔ onNewReview (Firestore trigger)
✔ onReviewReply (Firestore trigger)
✔ onNewChatMessage (Firestore trigger)
✔ onPostStatusChange (Firestore trigger)
✔ onPostDeleted (Firestore trigger)
✔ checkOfflineChatMessages (Scheduled)
✔ checkExpiringFavorites (Scheduled)
✔ checkInactiveUsers (Scheduled)
✔ checkExpiringPosts (Scheduled)
```

### Step 2: Enable Cloud Scheduler

1. Visit: https://console.cloud.google.com/cloudscheduler?project=g-maps-api-472115
2. Click "Enable API" if not already enabled
3. Verify scheduled jobs appear:
   - `firebase-schedule-checkOfflineChatMessages-us-central1`
   - `firebase-schedule-checkExpiringFavorites-us-central1`
   - `firebase-schedule-checkInactiveUsers-us-central1`
   - `firebase-schedule-checkExpiringPosts-us-central1`

### Step 3: Test Notification Permission (Frontend)

**Via Ngrok URL:**
1. Open app in browser via ngrok URL
2. Log in with a test account
3. **Expected:** Notification permission prompt appears
4. Grant permission
5. Check browser console for FCM token
6. Verify token saved in Firestore `fcmTokens` collection

**Check Firestore:**
```
Collection: fcmTokens
Document ID: {userId}
Fields:
  - token: "FCM_TOKEN_STRING"
  - userId: "USER_ID"
  - latitude: 12.9716
  - longitude: 77.5946
  - timestamp: TIMESTAMP
```

### Step 4: Test Chat Notification (Instant)

**Setup:**
- User A: Device/Browser 1 (online)
- User B: Device/Browser 2 (offline - close browser)

**Test Steps:**
1. User A sends message to User B
2. **Expected:** User B receives notification immediately
3. Notification shows: "💬 User A (1)"
4. Body: "Hello!" (message text)

**Verify Logs:**
```bash
firebase functions:log --only onNewChatMessage -n 10
```

**Expected Log:**
```
✅ Chat notification sent to {userId} (1 unread)
```

**Debug if Failed:**
- Check if chat document exists: `chats/{chatId}/messages/{messageId}`
- Verify User B has FCM token
- Check User B's `userStatus` document
- Look for errors in function logs

### Step 5: Test New Post Notification (50km)

**Setup:**
- User A: Creates a post with location (lat/lng)
- User B: Has FCM token with location within 50km

**Test Steps:**
1. User A creates a new worker/ad/service post
2. **Expected:** User B receives notification
3. Notification shows: "📍 New Worker Nearby!"
4. Body: "Post title is now available in your area (within 50km)."

**Verify Logs:**
```bash
firebase functions:log --only onNewPost -n 10
```

**Expected Log:**
```
[onNewPost] Found X tokens with location data.
[onNewPost] Found Y users within 50km.
✅ New post notification sent to Y users.
```

**Debug if Failed:**
- Verify post has `latitude` and `longitude` fields
- Check User B's FCM token has location data
- Verify distance calculation (should be ≤ 50km)

### Step 6: Test Review Notification (Instant)

**Setup:**
- User A: Post owner
- User B: Reviewer

**Test Steps:**
1. User B adds review to User A's post
2. **Expected:** User A receives notification
3. Notification shows: "⭐ New 5-Star Rating!" (if rating provided)
4. Body: "User B: 'Great service!'"

**Verify Logs:**
```bash
firebase functions:log --only onNewReview -n 10
```

**Expected Log:**
```
✅ Review notification sent to {postOwnerId}
```

**Debug if Failed:**
- Check review document in `workerReviews/adReviews/serviceReviews`
- Verify `postOwnerId` field exists
- Check if post owner has FCM token

### Step 7: Test Review Reply Notification (Instant)

**Setup:**
- User A: Reviewer
- User B: Post owner

**Test Steps:**
1. User B replies to User A's review
2. **Expected:** User A receives notification
3. Notification shows: "💬 Reply to Your Review"
4. Body: "The owner replied: 'Thank you!'"

**Verify Logs:**
```bash
firebase functions:log --only onReviewReply -n 10
```

### Step 8: Test Favorite Re-enabled Notification (Instant)

**Setup:**
- User A: Post owner
- User B: Has favorited the post

**Test Steps:**
1. User A disables post (set `disabled: true`)
2. User A re-enables post (set `disabled: false`)
3. **Expected:** User B receives notification
4. Notification shows: "✅ Favorite Post is Back!"
5. Body: "Post title is now available again!"

**Verify Logs:**
```bash
firebase functions:log --only onPostStatusChange -n 10
```

### Step 9: Test Offline Chat Messages (Scheduled)

**Setup:**
- User A: Sends messages while User B is offline
- Wait 30 minutes for scheduled function

**Test Steps:**
1. User B goes offline (close app)
2. User A sends 3 messages
3. Wait 30 minutes
4. **Expected:** User B receives notification
5. Notification shows: "💬 User A (3)"
6. Body: "3 unread notifications\nLatest: Last message text"

**Verify Logs:**
```bash
firebase functions:log --only checkOfflineChatMessages -n 10
```

**Expected Log:**
```
✅ Offline chat check completed. Sent X notifications
```

**Manual Trigger (for testing):**
```bash
# Not available for scheduled functions
# Must wait for scheduled time or test locally
```

### Step 10: Test Expiring Favorites (Scheduled)

**Setup:**
- Create a post with `expiresAt` within 1 hour
- User B favorites the post
- Wait 30 minutes for scheduled function

**Test Steps:**
1. Create post with expiry time
2. User B adds to favorites
3. Wait for scheduled function
4. **Expected:** User B receives notification
5. Notification shows: "⏰ Favorite Post Expiring Soon!"
6. Body: "Post title expires in 1 hour!"

**Verify Logs:**
```bash
firebase functions:log --only checkExpiringFavorites -n 10
```

**Expected Log:**
```
✅ Expiring favorites check completed. 1hr: X, 5min: Y
```

### Step 11: Test Inactive User Reminders (Scheduled)

**Setup:**
- User hasn't opened app for 24+ hours
- Wait for scheduled function (runs every 6 hours)

**Test Steps:**
1. User doesn't open app for 24 hours
2. Wait for scheduled function
3. **Expected:** User receives notification
4. Notification shows: "Come Back! New Updates Await ✨"
5. Body: "A lot has happened in the last 24 hours..."

**Verify Logs:**
```bash
firebase functions:log --only checkInactiveUsers -n 10
```

**Expected Log:**
```
✅ Inactive users check completed. Sent: X, Skipped duplicates: Y
```

## 🔍 Debugging Commands

### View All Function Logs
```bash
firebase functions:log -n 50
```

### View Specific Function Logs
```bash
firebase functions:log --only onNewChatMessage -n 20
```

### View Error Logs Only
```bash
firebase functions:log -n 50 | findstr "Error"
```

### Check Function Execution Times
```bash
firebase functions:log -n 20
```
Look for: "execution took Xms"

### Monitor Real-time Logs
```bash
# Not available in Firebase CLI
# Use Firebase Console: https://console.firebase.google.com/project/g-maps-api-472115/functions/logs
```

## 📊 Firestore Collections to Monitor

### 1. fcmTokens/{userId}
**Purpose:** Store user FCM tokens with location data

**Check:**
```
Firebase Console → Firestore → fcmTokens
```

**Expected Fields:**
```json
{
  "token": "FCM_TOKEN_STRING",
  "userId": "USER_ID",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "city": "Bangalore",
  "country": "India",
  "timestamp": "2026-02-06T00:00:00Z"
}
```

### 2. chats/{chatId}/messages/{messageId}
**Purpose:** Store chat messages

**Check:**
```
Firebase Console → Firestore → chats → {chatId} → messages
```

**Expected Fields:**
```json
{
  "senderId": "USER_A_ID",
  "text": "Hello!",
  "createdAt": "TIMESTAMP",
  "type": "text"
}
```

### 3. userStatus/{userId}
**Purpose:** Track user online/offline status

**Check:**
```
Firebase Console → Firestore → userStatus
```

**Expected Fields:**
```json
{
  "isOnline": false,
  "lastSeen": "TIMESTAMP",
  "lastReminderSent": "TIMESTAMP"
}
```

### 4. notificationsSent/{notificationKey}
**Purpose:** Prevent duplicate notifications

**Check:**
```
Firebase Console → Firestore → notificationsSent
```

**Expected Fields:**
```json
{
  "sentAt": "TIMESTAMP",
  "userId": "USER_ID",
  "postId": "POST_ID",
  "type": "expiring_favorite"
}
```

## ⚠️ Common Issues & Solutions

### Issue 1: "No FCM tokens found"
**Symptoms:**
- Logs show "Found 0 tokens"
- No notifications sent

**Solutions:**
1. Check if notification permission was granted
2. Verify `fcmTokens` collection has documents
3. Check browser console for permission errors
4. Test permission flow again

**Verify:**
```javascript
// Browser console
Notification.permission // Should be "granted"
```

### Issue 2: "Function not found"
**Symptoms:**
- Error: "Function not found"
- Trigger doesn't execute

**Solutions:**
1. Verify deployment: `firebase functions:list`
2. Check function name matches exactly
3. Redeploy: `firebase deploy --only functions`

### Issue 3: "Permission denied"
**Symptoms:**
- Error in logs: "Permission denied"
- Can't read/write Firestore

**Solutions:**
1. Check Firestore security rules
2. Verify user is authenticated
3. Check function has admin privileges

### Issue 4: "Scheduled function not running"
**Symptoms:**
- No logs for scheduled functions
- Functions don't execute at scheduled time

**Solutions:**
1. Enable Cloud Scheduler API
2. Wait for next scheduled time
3. Check function logs for errors
4. Verify timezone is UTC

### Issue 5: "Invalid FCM token"
**Symptoms:**
- Error: "Invalid registration token"
- Notification not delivered

**Solutions:**
1. Token may have expired
2. User may have cleared browser data
3. Delete invalid token from Firestore
4. User needs to grant permission again

### Issue 6: "Environment variables not found"
**Symptoms:**
- Error: "undefined" for process.env variables
- Functions fail with config errors

**Solutions:**
1. Verify `.env` file exists in `functions/` directory
2. Check `dotenv` package is installed
3. Verify `require('dotenv').config()` is called
4. Redeploy functions

## 📈 Success Metrics

After successful deployment and testing:

| Metric | Target | How to Verify |
|--------|--------|---------------|
| FCM Tokens Saved | > 0 | Check `fcmTokens` collection |
| Chat Notifications | Instant delivery | Test with 2 users |
| New Post Notifications | Instant delivery | Create post, check logs |
| Review Notifications | Instant delivery | Add review, check logs |
| Scheduled Functions | Run on schedule | Check logs after 30min/6hrs |
| Notification Delivery Rate | > 95% | Monitor function logs |
| Function Execution Time | < 1000ms | Check logs for "execution took" |

## 🎯 Next Steps After Testing

### If All Tests Pass:
1. ✅ Monitor function logs for 24 hours
2. ✅ Track notification delivery rates
3. ✅ Optimize scheduled function frequency if needed
4. ✅ Set up error alerting
5. ✅ Document any edge cases found

### If Tests Fail:
1. ❌ Check specific function logs
2. ❌ Verify Firestore data structure
3. ❌ Test permission flow
4. ❌ Review error messages
5. ❌ Contact support if needed

## 📝 Testing Checklist

- [ ] Deployment successful
- [ ] Cloud Scheduler enabled
- [ ] FCM tokens saved
- [ ] Chat notifications working
- [ ] New post notifications working
- [ ] Review notifications working
- [ ] Review reply notifications working
- [ ] Re-enabled post notifications working
- [ ] Offline chat notifications working (wait 30 min)
- [ ] Expiring favorites notifications working (wait 30 min)
- [ ] Inactive user reminders working (wait 6 hours)
- [ ] All function logs clean (no errors)
- [ ] Notification delivery rate > 95%

## 🌐 Testing via Ngrok

**Current Setup:**
- Frontend: http://localhost:3000 (via ngrok)
- Backend: Firebase Functions (cloud)
- Notifications: FCM → Device/Browser

**Testing Steps:**
1. Open app via ngrok URL
2. Grant notification permission
3. Trigger notification events
4. Verify notifications received
5. Check function logs

**Note:** Ngrok URL is NOT involved in notification delivery. FCM sends notifications directly to the device/browser.

## 📞 Support

If you encounter issues:

1. **Check Logs:**
   ```bash
   firebase functions:log -n 50
   ```

2. **Firebase Console:**
   https://console.firebase.google.com/project/g-maps-api-472115

3. **Cloud Scheduler:**
   https://console.cloud.google.com/cloudscheduler?project=g-maps-api-472115

4. **Firestore:**
   https://console.firebase.google.com/project/g-maps-api-472115/firestore

---

**Start testing after deployment completes!**

```bash
# Check deployment status
firebase functions:list

# View recent logs
firebase functions:log -n 20
```
