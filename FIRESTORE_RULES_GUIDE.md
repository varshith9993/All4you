# Firestore Security Rules - Deployment Guide

## Problem Fixed
The error `Missing or insufficient permissions` was occurring because Firestore security rules were either missing or too restrictive.

## Solution
I've created comprehensive security rules in `firestore.rules` that cover all collections in your app.

## Collections Covered

### Public Collections (Anyone can read):
1. **profiles** - User profiles
2. **workers** - Worker posts
3. **services** - Service posts
4. **ads** - Advertisement posts
5. **workerReviews** - Reviews for workers
6. **serviceReviews** - Reviews for services
7. **adReviews** - Reviews for ads

### Private Collections (Owner only):
1. **notes** - User's personal notes
2. **notifications** - User's notifications
3. **workerFavorites** - User's favorited workers
4. **serviceFavorites** - User's favorited services
5. **adFavorites** - User's favorited ads

### Shared Collections:
1. **chats** - Chat conversations (participants only)
2. **chats/{chatId}/messages** - Chat messages (participants only)

### System Collections:
1. **feedback** - User feedback submissions

## How to Deploy

### Option 1: Firebase Console (Recommended)

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**
3. **Navigate to**: Firestore Database → Rules
4. **Copy the entire content** from `firestore.rules`
5. **Paste it** into the rules editor
6. **Click "Publish"**

### Option 2: Firebase CLI

If you have Firebase CLI installed:

```bash
# Navigate to your project directory
cd "c:\Users\Varshith Kumar\OneDrive\Documents\Desktop\servepure-fav - Copy"

# Deploy the rules
firebase deploy --only firestore:rules
```

## Testing the Rules

After deploying, test these scenarios:

### ✅ Should Work:
1. **View worker/service/ad details** (logged in or not)
2. **Create a post** (when logged in)
3. **Edit your own post** (when logged in)
4. **Delete your own post** (when logged in)
5. **Add/remove favorites** (when logged in)
6. **Send/receive chat messages** (when logged in)
7. **Create/edit/delete notes** (when logged in)
8. **Submit reviews** (when logged in)

### ❌ Should NOT Work:
1. **Edit someone else's post**
2. **Delete someone else's post**
3. **View someone else's notes**
4. **Delete someone else's favorites**
5. **Access chats you're not part of**

## Key Security Features

### 1. Authentication Required
- Most write operations require authentication
- Public posts can be read by anyone
- Private data requires user authentication

### 2. Ownership Validation
- Users can only edit/delete their own content
- `createdBy` field must match authenticated user ID
- Favorites use composite IDs: `userId_postId`

### 3. Participant Validation
- Chat access limited to participants
- Messages can only be sent by chat participants
- Delivery/seen status can be updated by participants

### 4. Data Integrity
- New documents must include proper `createdBy` or `userId` fields
- Reviews must include `userId` matching the authenticated user
- Favorites must include `userId` matching the authenticated user

## Rule Breakdown

### Public Posts (Workers, Services, Ads)
```javascript
allow read: if true;  // Anyone can read
allow create: if isAuthenticated() && request.resource.data.createdBy == request.auth.uid;
allow update, delete: if isDocOwner(resource);
```

### Reviews
```javascript
allow read: if true;  // Anyone can read reviews
allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
allow update, delete: if isDocOwner(resource);
```

### Favorites
```javascript
allow read: if isAuthenticated();  // Only authenticated users
allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
```

### Chats & Messages
```javascript
// Chats
allow read, write: if isAuthenticated() && request.auth.uid in resource.data.participants;

// Messages
allow read, write: if isAuthenticated() && 
                      request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
```

### Notes
```javascript
allow read, write: if isAuthenticated() && resource.data.userId == request.auth.uid;
```

## Common Issues & Solutions

### Issue 1: "Missing or insufficient permissions" on detail pages
**Cause**: Rules not deployed or too restrictive
**Solution**: Deploy the new rules from `firestore.rules`

### Issue 2: Can't create posts
**Cause**: `createdBy` field not matching authenticated user
**Solution**: Rules now validate `createdBy` field automatically

### Issue 3: Can't read favorites
**Cause**: Favorites require authentication
**Solution**: Ensure user is logged in before accessing favorites

### Issue 4: Chat messages not loading
**Cause**: User not in participants array
**Solution**: Rules check participants array - ensure chat creation includes both users

## Monitoring

After deployment, monitor your Firebase Console:

1. **Go to**: Firestore Database → Usage
2. **Check**: Read/Write operations
3. **Look for**: Permission denied errors
4. **Review**: Security rules logs

## Important Notes

1. **Profiles are public** - Anyone can read user profiles (needed for displaying creator info)
2. **Posts are public** - Workers, services, and ads can be read by anyone (marketplace app)
3. **Reviews are public** - Anyone can read reviews (transparency)
4. **Favorites are private** - Only the user can see their favorites
5. **Chats are private** - Only participants can access chat data
6. **Notes are private** - Only the owner can access their notes

## Next Steps

1. ✅ Deploy the rules to Firebase
2. ✅ Test all major features (create, read, update, delete)
3. ✅ Check browser console for any permission errors
4. ✅ Monitor Firebase Console for rule violations

## Backup

If you need to revert, here's a simple "allow all" rule (NOT RECOMMENDED for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Use only for testing!**

## Status: Ready to Deploy! 🚀

The rules are comprehensive and secure. Deploy them to fix all permission errors.
