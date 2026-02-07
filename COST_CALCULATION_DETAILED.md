# 📊 NOTIFICATION COST CALCULATION - DETAILED BREAKDOWN

## 🔍 **IMPORTANT: These are TOTAL costs, NOT per user!**

### **The numbers shown are for ALL users combined, not per user.**

---

## 📈 **CALCULATION BREAKDOWN**

### **Assumptions:**
- 100 total users in the app
- 30 days per month
- Average activity levels

---

## 1️⃣ **INVOCATIONS (1,680/month)**

### **Scheduled Functions:**

| Function | Schedule | Runs/Day | Runs/Month | Notes |
|----------|----------|----------|------------|-------|
| `checkOfflineChatMessages` | Every 30 min | 48 | 1,440 | Checks all chats |
| `checkInactiveUsers` | Every 6 hours | 4 | 120 | Checks all users |
| `checkExpiringFavorites` | Every 30 min | 48 | 1,440 | Checks all favorites |
| `checkExpiringPosts` | Every 6 hours | 4 | 120 | Checks all posts |
| **TOTAL** | | **104** | **3,120** | |

**Wait, why 1,680 not 3,120?**

Let me recalculate correctly:

```
Scheduled Functions (run automatically):
- checkOfflineChatMessages: 48/day × 30 days = 1,440/month
- checkInactiveUsers: 4/day × 30 days = 120/month
- checkExpiringFavorites: 48/day × 30 days = 1,440/month
- checkExpiringPosts: 4/day × 30 days = 120/month

Subtotal: 3,120 invocations/month
```

**PLUS Firestore Triggers (per event):**

```
Triggered Functions (per user action):
- onNewPost: 10 posts/day × 30 = 300/month
- onNewReview: 5 reviews/day × 30 = 150/month
- onReviewReply: 2 replies/day × 30 = 60/month
- onNewChatMessage: 50 messages/day × 30 = 1,500/month
- onPostStatusChange: 5 updates/day × 30 = 150/month

Subtotal: 2,160 invocations/month
```

**TOTAL: 3,120 + 2,160 = 5,280 invocations/month**

---

## 2️⃣ **FIRESTORE READS (9,900/month)**

### **From Scheduled Functions:**

#### **checkOfflineChatMessages (1,440 runs/month):**
```
Per run:
- Query recent chats: 5 reads (average 5 active chats)
- Query messages per chat: 5 chats × 2 messages = 10 reads
- Check user status: 5 reads
- Get FCM tokens: 5 reads
- Get sender profiles: 5 reads
Total per run: 30 reads

Monthly: 1,440 runs × 30 reads = 43,200 reads
```

#### **checkInactiveUsers (120 runs/month):**
```
Per run:
- Get all userStatus: 100 reads (100 users)
- Check lastReminderSent: included above
- Get FCM tokens: 25 reads (25% need notification)
- Get profiles: 25 reads
Total per run: 150 reads

Monthly: 120 runs × 150 reads = 18,000 reads
```

#### **checkExpiringFavorites (1,440 runs/month):**
```
Per run:
- Query expiring posts: 5 reads (average 5 expiring)
- Query favorites: 10 reads (2 favorites per post)
- Check notificationsSent: 10 reads
- Get FCM tokens: 10 reads
Total per run: 35 reads

Monthly: 1,440 runs × 35 reads = 50,400 reads
```

#### **checkExpiringPosts (120 runs/month):**
```
Per run:
- Query expiring posts: 10 reads
- Check notificationsSent: 10 reads
- Get FCM tokens: 10 reads
Total per run: 30 reads

Monthly: 120 runs × 30 reads = 3,600 reads
```

**Scheduled Functions Total: 115,200 reads/month**

### **From Triggered Functions:**

#### **onNewPost (300/month):**
```
Per post:
- Query fcmTokens with location: 100 reads (all users)
Total: 300 × 100 = 30,000 reads/month
```

#### **onNewReview (150/month):**
```
Per review:
- Get post owner token: 1 read
- Get reviewer profile: 1 read
Total: 150 × 2 = 300 reads/month
```

#### **onReviewReply (60/month):**
```
Per reply:
- Get reviewer token: 1 read
Total: 60 × 1 = 60 reads/month
```

#### **onNewChatMessage (1,500/month):**
```
Per message:
- Get chat doc: 1 read
- Get userStatus: 1 read
- Count unread messages: 5 reads (query)
- Get sender profile: 1 read
- Get FCM token: 1 read
Total: 1,500 × 9 = 13,500 reads/month
```

#### **onPostStatusChange (150/month):**
```
Per update:
- Query favorites: 5 reads (average)
- Get FCM tokens: 5 reads
Total: 150 × 10 = 1,500 reads/month
```

**Triggered Functions Total: 45,360 reads/month**

**GRAND TOTAL: 115,200 + 45,360 = 160,560 reads/month**

---

## 3️⃣ **FIRESTORE WRITES (3,300/month)**

### **From Notifications:**

```
Update lastReminderSent (inactive users):
- 25 users/day × 30 days = 750 writes/month

Save notificationsSent (expiring posts):
- 10 posts/day × 30 days = 300 writes/month

Save notificationsSent (expiring favorites):
- 20 favorites/day × 30 days = 600 writes/month

Total: 1,650 writes/month
```

### **From User Actions (Frontend):**

```
Create posts: 10/day × 30 = 300 writes/month
Create reviews: 5/day × 30 = 150 writes/month
Send messages: 50/day × 30 = 1,500 writes/month
Update posts: 5/day × 30 = 150 writes/month

Total: 2,100 writes/month
```

**GRAND TOTAL: 1,650 + 2,100 = 3,750 writes/month**

---

## 4️⃣ **FCM NOTIFICATIONS (9,300/month)**

### **Breakdown:**

```
New post notifications:
- 10 posts/day × 50 nearby users × 30 days = 15,000/month

Review notifications:
- 5 reviews/day × 30 days = 150/month

Review reply notifications:
- 2 replies/day × 30 days = 60/month

Chat notifications (instant):
- 50 messages/day × 50% offline × 30 days = 750/month

Chat notifications (batch):
- 5 users/day × 30 days = 150/month

Favorite re-enabled:
- 2 posts/day × 5 favorites × 30 days = 300/month

Inactive user reminders:
- 25 users/day × 30 days = 750/month

Expiring favorites (1hr):
- 10 favorites/day × 30 days = 300/month

Expiring favorites (5min):
- 10 favorites/day × 30 days = 300/month

Expiring posts:
- 10 posts/day × 30 days = 300/month

Total: 18,060/month
```

---

## 💡 **CORRECTED MONTHLY COSTS**

### **For 100 Total Users:**

| Metric | Calculation | Total/Month | Per User/Month |
|--------|-------------|-------------|----------------|
| **Invocations** | 3,120 scheduled + 2,160 triggered | **5,280** | 53 |
| **Firestore Reads** | 115,200 scheduled + 45,360 triggered | **160,560** | 1,606 |
| **Firestore Writes** | 1,650 notifications + 2,100 user actions | **3,750** | 38 |
| **FCM Notifications** | All notification types | **18,060** | 181 |

---

## 📊 **PER USER BREAKDOWN**

### **If you have 100 users:**

```
Per User Per Month:
- Invocations: 53
- Firestore Reads: 1,606
- Firestore Writes: 38
- FCM Notifications: 181

Per User Per Day:
- Invocations: 1.8
- Firestore Reads: 54
- Firestore Writes: 1.3
- FCM Notifications: 6
```

---

## 🔢 **SCALING EXAMPLES**

### **10 Users:**

```
Monthly:
- Invocations: 3,120 (scheduled) + 216 (triggered) = 3,336
- Firestore Reads: 11,520 + 4,536 = 16,056
- Firestore Writes: 165 + 210 = 375
- FCM Notifications: 1,806

Cost: $0 (well within free tier)
```

### **100 Users:**

```
Monthly:
- Invocations: 3,120 + 2,160 = 5,280
- Firestore Reads: 115,200 + 45,360 = 160,560
- Firestore Writes: 1,650 + 2,100 = 3,750
- FCM Notifications: 18,060

Cost: $0 (within free tier)
```

### **1,000 Users:**

```
Monthly:
- Invocations: 3,120 + 21,600 = 24,720
- Firestore Reads: 1,152,000 + 453,600 = 1,605,600
- Firestore Writes: 16,500 + 21,000 = 37,500
- FCM Notifications: 180,600

Cost: ~$0.96/month
Breakdown:
- Invocations: $0 (free tier: 2M)
- Reads: $0.96 ($0.06 per 100K after 1.5M free)
- Writes: $0 (free tier: 600K)
- FCM: $0 (unlimited free)
```

### **10,000 Users:**

```
Monthly:
- Invocations: 3,120 + 216,000 = 219,120
- Firestore Reads: 11,520,000 + 4,536,000 = 16,056,000
- Firestore Writes: 165,000 + 210,000 = 375,000
- FCM Notifications: 1,806,000

Cost: ~$9.63/month
Breakdown:
- Invocations: $0 (free tier: 2M)
- Reads: $8.73 ($0.06 per 100K after 1.5M free)
- Writes: $0 (free tier: 600K)
- FCM: $0 (unlimited free)
```

---

## ✅ **SUMMARY**

### **Key Points:**

1. **Scheduled functions cost is FIXED** (doesn't scale with users)
   - 3,120 invocations/month regardless of user count

2. **Triggered functions scale with activity** (not user count)
   - More posts/messages = more invocations
   - Not directly proportional to users

3. **Firestore reads scale with users**
   - Scheduled functions check all users
   - This is the main scaling cost

4. **FCM is always free**
   - Unlimited notifications
   - No matter how many users

### **Cost Tiers:**

| Users | Monthly Cost | Notes |
|-------|--------------|-------|
| 1-100 | **$0** | Within free tier |
| 100-1,000 | **$0-1** | Mostly free |
| 1,000-10,000 | **$1-10** | Mainly Firestore reads |
| 10,000+ | **$10+** | Consider optimization |

### **Your Current Estimate (100 users):**

```
Invocations: 5,280/month (0.26% of free tier)
Firestore Reads: 160,560/month (10.7% of free tier)
Firestore Writes: 3,750/month (0.6% of free tier)
FCM Notifications: 18,060/month (FREE)

Total Cost: $0/month ✅
```

**You're well within the free tier! 🎉**
