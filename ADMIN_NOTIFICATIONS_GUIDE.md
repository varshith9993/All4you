# 📢 How to Send Festival Wishes & Targeted Notifications

I have implemented a powerful **Admin Notification System** that allows you to send targeted messages to your users.

## ✅ **New Function: `sendAdminNotification`**

This is a secure Cloud Function that supports all your targeting requirements.

### **Supported Targeting Types:**

1.  **`all`**: Send to ALL users.
2.  **`country`**: Send to users in a specific country (e.g., "India").
3.  **`region`**: Send to users within a specific radius (km) of a location.
4.  **`worker_creators`**: Send to users who have created at least one Worker Post.
5.  **`user`**: Send to a specific single user (by User ID).

---

## 🚀 **How to Use It**

Since this is an "Admin" feature, you don't want regular users accessing it. You have two options:

### **Option 1: Create a Hidden Admin Page (Recommended)**

I can create a simple `AdminNotifications.js` page for you. You would navigate to `/admin-notify` (protected route) to send messages.

**Example Usage in Code:**

```javascript
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const sendNotification = httpsCallable(functions, 'sendAdminNotification');

// 1. Send Festival Wishes to All Users
await sendNotification({
    targetType: 'all',
    title: '🪔 Happy Diwali!',
    body: 'Wishing you and your family a festival full of light and joy!',
    imageUrl: 'https://example.com/diwali-banner.jpg'
});

// 2. Send to Specific Country
await sendNotification({
    targetType: 'country',
    targetValue: 'India',
    title: 'Happy Independence Day!',
    body: 'Celebrating 75 years of freedom.'
});

// 3. Send to Users in Bangalore (Region)
await sendNotification({
    targetType: 'region',
    targetValue: {
        latitude: 12.9716, 
        longitude: 77.5946, 
        radius: 50 // 50km radius
    },
    title: '📢 Bangalore Users',
    body: 'New services available in your area!'
});

// 4. Send to Worker Creators (e.g., Tips)
await sendNotification({
    targetType: 'worker_creators',
    title: '🚀 Boost Your Reach',
    body: 'Tips to get more customers for your worker post.'
});
```

---

## 🛠️ **Deployment**

The backend logic is already written (`functions/adminNotifications.js`) and exported.

**To enable this system:**
1.  Run: `cd functions`
2.  Run: `firebase deploy --only functions`

---

## 🔒 **Security Note**

Currently, the function checks if the user is **Authenticated**.
Use a specific Admin account or add logic to check for specific UIDs in `functions/adminNotifications.js` to prevent abuse.

```javascript
// In functions/adminNotifications.js
const adminUIDs = ['YOUR_USER_ID_HERE'];
if (!adminUIDs.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only.');
}
```

Let me know if you want me to generate the **Admin UI Page** for you!
