# 🖼️ CLOUDFLARE R2 IMAGE FLOW - Complete Cost Breakdown

## ✅ **HOW IMAGE UPLOAD & VIEWING WORKS**

### **📤 UPLOAD FLOW (One-Time)**

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: User Selects Image                                 │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Frontend Calls Cloud Function                      │
│                                                              │
│  const response = await fetch(                              │
│    'https://...cloudfunctions.../getUploadUrl',             │
│    { fileName: 'photo.jpg', fileType: 'image/jpeg' }        │
│  );                                                          │
│                                                              │
│  ✅ Cost: 1 Cloud Function invocation                       │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Cloud Function Generates Presigned URL             │
│                                                              │
│  Returns:                                                    │
│  {                                                           │
│    uploadUrl: "https://r2.../uploads/123_photo.jpg?sig=..." │
│    publicUrl: "https://cdn.aerosigil.com/uploads/123_..."   │
│  }                                                           │
│                                                              │
│  ✅ Cost: 0 R2 operations (just URL generation)             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Frontend Uploads DIRECTLY to R2                    │
│                                                              │
│  await fetch(uploadUrl, {                                   │
│    method: 'PUT',                                           │
│    body: imageFile,                                         │
│    headers: { 'Content-Type': 'image/jpeg' }               │
│  });                                                         │
│                                                              │
│  ✅ Cost: 1 R2 Class A operation (write)                    │
│  ❌ NO Cloud Function invocation                            │
│  ❌ NO backend involved                                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Frontend Saves publicUrl to Firestore              │
│                                                              │
│  await addDoc(collection(db, 'workers'), {                  │
│    images: ['https://cdn.aerosigil.com/uploads/123_...']   │
│  });                                                         │
│                                                              │
│  ✅ Cost: 1 Firestore write                                 │
│  ❌ NO Cloud Function invocation                            │
└─────────────────────────────────────────────────────────────┘
```

### **📥 VIEWING FLOW (Every Time User Views Image)**

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: User Opens Post/Profile                            │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Frontend Reads from Firestore                      │
│                                                              │
│  const post = await getDoc(doc(db, 'workers', postId));     │
│  const imageUrl = post.data().images[0];                    │
│  // imageUrl = "https://cdn.aerosigil.com/uploads/123_..."  │
│                                                              │
│  ✅ Cost: 1 Firestore read                                  │
│  ❌ NO Cloud Function invocation                            │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Browser Displays Image                             │
│                                                              │
│  <img src="https://cdn.aerosigil.com/uploads/123_..." />    │
│                                                              │
│  Browser makes HTTP GET request DIRECTLY to R2 CDN          │
│                                                              │
│  ✅ Cost: 1 R2 Class B operation (read)                     │
│  ❌ NO Cloud Function invocation                            │
│  ❌ NO backend involved                                     │
│  ❌ NO Firebase involved                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 **COST BREAKDOWN**

### **Upload (One-Time per Image):**

| Step | Service | Operation | Cost |
|------|---------|-----------|------|
| 1 | Cloud Function | `getUploadUrl` invocation | $0 (free tier) |
| 2 | R2 | Class A (PUT) | $0.0000045 |
| 3 | Firestore | Write (save URL) | $0 (free tier) |
| **TOTAL** | | | **~$0** |

### **Viewing (Every Time Image is Displayed):**

| Step | Service | Operation | Cost |
|------|---------|-----------|------|
| 1 | Firestore | Read (get URL) | $0 (free tier) |
| 2 | R2 CDN | Class B (GET) | $0.00000036 |
| **TOTAL** | | | **~$0** |

---

## 📊 **IMPORTANT: IMAGE VIEWING DOES NOT USE CLOUD FUNCTIONS!**

### **✅ What Happens When User Views Image:**

```javascript
// Frontend code:
<img src="https://cdn.aerosigil.com/uploads/123_photo.jpg" />

// Browser makes HTTP GET request DIRECTLY to:
// Cloudflare R2 CDN → Returns image

// ✅ NO Cloud Function called
// ✅ NO backend involved
// ✅ Direct CDN delivery
```

### **❌ What DOES NOT Happen:**

```
User views image
   ↓
❌ Cloud Function NOT called
❌ Backend NOT involved
❌ Firebase NOT involved
   ↓
Browser → R2 CDN (Direct)
```

---

## 🔍 **R2 OPERATIONS EXPLAINED**

### **Class A Operations (Writes) - $4.50 per million:**

**When they happen:**
- ✅ Uploading image (PUT)
- ✅ Deleting image (DELETE)
- ✅ Copying image (COPY)

**Your usage:**
- ~10 uploads per day
- ~2 deletes per day
- **Total: 12 Class A per day**
- **Monthly: 360 Class A operations**
- **Cost: $0.00162** (less than 1 cent!)

### **Class B Operations (Reads) - $0.36 per million:**

**When they happen:**
- ✅ **Viewing image** (GET)
- ✅ Listing files (LIST)
- ✅ Checking if file exists (HEAD)

**Your usage:**
- ~1,000 image views per day (100 users × 10 images)
- **Total: 1,000 Class B per day**
- **Monthly: 30,000 Class B operations**
- **Cost: $0.0108** (1 cent!)

---

## 💡 **KEY INSIGHTS**

### **1. Image Viewing is DIRECT (No Backend):**

```
User Browser → R2 CDN → Image
```

**NOT:**
```
User Browser → Cloud Function → R2 → Image ❌
```

### **2. Cloud Function Only for Upload URL:**

```
Upload:
  Frontend → Cloud Function (getUploadUrl) → Get presigned URL
  Frontend → R2 (PUT) → Upload image

Viewing:
  Browser → R2 CDN (GET) → Display image
```

### **3. Costs:**

| Operation | Cloud Function | R2 | Firestore |
|-----------|----------------|-----|-----------|
| **Upload** | 1 invocation | 1 Class A | 1 write |
| **View** | ❌ 0 | 1 Class B | 1 read |

---

## 📈 **EXAMPLE: 100 Users Viewing 1 Post with 5 Images**

### **Scenario:**
- 1 post created with 5 images
- 100 users view the post
- Each user sees all 5 images

### **Upload Costs (One-Time):**

```
1. Get upload URLs: 5 Cloud Function invocations
   Cost: $0 (free tier)

2. Upload images: 5 R2 Class A operations
   Cost: 5 × $0.0000045 = $0.0000225

3. Save URLs to Firestore: 1 Firestore write
   Cost: $0 (free tier)

TOTAL UPLOAD: ~$0
```

### **Viewing Costs (100 Users):**

```
1. Read post from Firestore: 100 Firestore reads
   Cost: $0 (free tier)

2. Display images: 100 users × 5 images = 500 R2 Class B operations
   Cost: 500 × $0.00000036 = $0.00018

3. Cloud Functions: 0 invocations
   Cost: $0

TOTAL VIEWING: $0.00018 (less than 1 cent!)
```

---

## 🎯 **OPTIMIZATION: R2 PUBLIC DOMAIN**

### **Your Current Setup (OPTIMAL):**

```javascript
// Cloud Function returns:
{
  publicUrl: "https://cdn.aerosigil.com/uploads/123_photo.jpg"
}

// Frontend saves this URL to Firestore
// Browser loads image directly from CDN
```

**Benefits:**
- ✅ Fast CDN delivery
- ✅ No backend involved in viewing
- ✅ Cached at edge locations
- ✅ Minimal R2 Class B operations (CDN caching)

### **If You Used Signed URLs for Viewing (NOT RECOMMENDED):**

```javascript
// ❌ BAD: Generate signed URL for every view
const getImageUrl = httpsCallable(functions, 'getImageUrl');
const { url } = await getImageUrl({ filePath });

// ❌ Cost: 1 Cloud Function invocation per view
// ❌ Slower (extra backend call)
// ❌ More expensive
```

---

## 📊 **MONTHLY COST ESTIMATE**

### **Assumptions:**
- 100 active users
- 10 posts created per day
- 5 images per post
- Each post viewed 50 times

### **Upload Costs:**

```
Posts per month: 10 × 30 = 300
Images per month: 300 × 5 = 1,500

Cloud Functions: 1,500 invocations
Cost: $0 (free tier: 2M/month)

R2 Class A: 1,500 operations
Cost: 1,500 × $0.0000045 = $0.00675

Firestore Writes: 300 writes
Cost: $0 (free tier: 600K/month)

TOTAL UPLOAD: $0.00675 (less than 1 cent!)
```

### **Viewing Costs:**

```
Image views per month: 300 posts × 50 views × 5 images = 75,000

R2 Class B: 75,000 operations
Cost: 75,000 × $0.00000036 = $0.027 (3 cents!)

Firestore Reads: 15,000 reads (300 posts × 50 views)
Cost: $0 (free tier: 1.5M/month)

Cloud Functions: 0 invocations
Cost: $0

TOTAL VIEWING: $0.027 (3 cents!)
```

### **GRAND TOTAL: $0.03/month (3 cents!)**

---

## ✅ **SUMMARY**

### **Image Upload:**
1. ✅ Frontend calls Cloud Function (1 invocation)
2. ✅ Cloud Function generates presigned URL (no R2 cost)
3. ✅ Frontend uploads directly to R2 (1 Class A operation)
4. ✅ Frontend saves URL to Firestore (1 write)

**Cost: ~$0.0000045 per image**

### **Image Viewing:**
1. ✅ Frontend reads URL from Firestore (1 read)
2. ✅ **Browser loads image DIRECTLY from R2 CDN** (1 Class B operation)
3. ❌ **NO Cloud Function invocation**
4. ❌ **NO backend involved**

**Cost: ~$0.00000036 per view**

### **Key Points:**
- ✅ **Image viewing does NOT use Cloud Functions**
- ✅ **Image viewing does NOT use backend**
- ✅ **Only uses R2 Class B operations** (very cheap)
- ✅ **Direct CDN delivery** (fast & efficient)
- ✅ **Total cost: ~3 cents per month** for 75,000 image views

**Your R2 setup is OPTIMAL! No changes needed! 🎉**
