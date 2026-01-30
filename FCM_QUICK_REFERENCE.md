# 📱 FCM Notifications Quick Reference

## 🚀 Quick Start

### 1. Enable Notifications (User)
```javascript
import { requestNotificationPermission } from './utils/fcmService';

// In your component
const handleEnableNotifications = async () => {
  const token = await requestNotificationPermission(userId, userLocation);
  if (token) {
    console.log('Notifications enabled!');
  }
};
```

### 2. Send Notification (Admin)
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendToAll = httpsCallable(functions, 'sendNotificationToAll');

await sendToAll({
  title: 'Festival Offer! 🎉',
  body: 'Get 25% OFF on all services!'
});
```

## 📋 Available Functions

### Cloud Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `sendNotificationToAll` | Send to all users | `title`, `body`, `imageUrl?`, `data?` |
| `sendNotificationToRegion` | Send to specific cities/countries | `title`, `body`, `cities?`, `countries?`, `imageUrl?` |
| `sendNotificationToUser` | Send to one user | `userId`, `title`, `body`, `url?`, `imageUrl?` |
| `onNewChatMessage` | Auto-trigger on chat | Automatic (Firestore trigger) |
| `onNewPost` | Auto-trigger on new post | Automatic (Firestore trigger) |
| `checkExpiringPosts` | Daily check at 9 AM | Automatic (Scheduled) |

## 🎯 Common Use Cases

### Festival Notification
```javascript
await sendToAll({
  title: '🪔 Happy Diwali!',
  body: 'Celebrate with 25% OFF!',
  imageUrl: 'https://cdn.com/diwali.jpg'
});
```

### Regional Offer
```javascript
await sendToRegion({
  title: 'Mumbai Special! 🎊',
  body: 'Exclusive offer for Mumbai users!',
  cities: ['Mumbai', 'Navi Mumbai']
});
```

### Personal Offer
```javascript
await sendToUser({
  userId: 'user123',
  title: 'Special for You! 🎁',
  body: 'Premium trial unlocked!',
  url: '/premium'
});
```

## 🔔 Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| **Chat** | New message | Chat participant |
| **New Post** | Post created | Users within 75km |
| **Expiring** | 3 days before expiry | Post creator |
| **Broadcast** | Manual | All users |
| **Regional** | Manual | Specific cities/countries |
| **Targeted** | Manual | Specific user |

## 📊 Database Schema

### fcmTokens Collection
```
fcmTokens/{userId}
  ├── token: string
  ├── userId: string
  ├── latitude: number
  ├── longitude: number
  ├── city: string
  ├── country: string
  ├── platform: "web" | "android" | "ios"
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

## 🛠️ Setup Checklist

- [ ] Generate VAPID key from Firebase Console
- [ ] Update VAPID_KEY in `src/utils/fcmService.js`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Add Firestore security rules for `fcmTokens` collection
- [ ] Add NotificationSettings component to Settings page
- [ ] Test notifications on localhost (HTTPS required)
- [ ] (Optional) Create admin panel for sending notifications

## 🔐 Security Rules

```javascript
// firestore.rules
match /fcmTokens/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## 🧪 Testing

### Test Service Worker
1. Open DevTools → Application → Service Workers
2. Verify `firebase-messaging-sw.js` is registered

### Test Notification
```javascript
// In browser console
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    new Notification('Test', { body: 'This is a test!' });
  }
});
```

## 📱 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Web (Chrome)** | ✅ Supported | Full support |
| **Web (Firefox)** | ✅ Supported | Full support |
| **Web (Safari)** | ⚠️ Limited | iOS 16.4+ only |
| **Android** | ✅ Supported | Via Capacitor |
| **iOS** | ✅ Supported | Via Capacitor |

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Service worker not registering | Use HTTPS or localhost |
| No token generated | Check VAPID key is correct |
| Permission denied | User must manually enable in browser settings |
| Notifications not appearing | Check browser notification settings |
| Function error | Check Firebase Console logs |

## 📞 Quick Commands

```bash
# Deploy functions
firebase deploy --only functions

# View logs
firebase functions:log

# Test locally
firebase emulators:start --only functions

# Check function status
firebase functions:list
```

## 💡 Pro Tips

1. **Batch Sending**: Functions automatically batch notifications (500 per batch)
2. **Token Cleanup**: Invalid tokens are auto-removed
3. **Location Accuracy**: Use precise coordinates for better 75km radius matching
4. **Timing**: Schedule important notifications during peak hours
5. **Images**: Use optimized images (< 1MB) for faster loading

## 🎨 Notification Best Practices

✅ **DO:**
- Keep titles under 50 characters
- Keep body under 120 characters
- Use emojis sparingly (1-2 max)
- Include clear call-to-action
- Test on multiple devices

❌ **DON'T:**
- Send too frequently (max 2-3 per day)
- Use all caps
- Include sensitive information
- Send at odd hours (avoid 10 PM - 8 AM)
- Spam users

## 📈 Analytics Integration

Track notification performance:
```javascript
// Track notification sent
analytics.logEvent('notification_sent', {
  type: 'festival',
  recipients: result.sent
});

// Track notification clicked
analytics.logEvent('notification_clicked', {
  type: 'chat',
  source: 'push'
});
```

---

**Need help?** Check `FCM_SETUP_GUIDE.md` for detailed documentation.
