# Firestore Security Rules Deployment Guide

This guide explains how to deploy the Firestore security rules to fix the permission issues in your application.

## Prerequisites

1. Install Firebase CLI:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

## Deployment Steps

1. **Navigate to your project directory:**
   ```
   cd "C:\Users\Varshith Kumar\OneDrive\Documents\Desktop\servepure-fav - Copy"
   ```

2. **Initialize Firebase project (if not already done):**
   ```
   firebase init firestore
   ```
   
   When prompted:
   - Select your Firebase project
   - Accept the default Firestore rules filename (firestore.rules)

3. **Replace the generated rules with the provided ones:**
   - The firestore.rules file has already been created in your project directory
   - Make sure it contains the rules we provided

4. **Deploy the rules:**
   ```
   firebase deploy --only firestore:rules
   ```

## Rules Overview

The provided Firestore rules implement the following security measures:

### Authentication
- All operations require authentication (`isAuthenticated()`)

### Collection-specific Permissions

#### Profiles
- All users can read any profile
- Users can only create/update their own profile
- Only admins can delete profiles

#### Workers, Services, Ads
- All authenticated users can read
- Only creators can update/delete their own posts
- Admins can update/delete any post

#### Favorites
- Users can only read/create/delete their own favorites

#### Reviews
- All users can read reviews
- Only reviewers can create/update their own reviews
- Admins can delete any review

#### Chats
- Participants can read and send messages
- Only message senders can update/delete their own messages
- Only admins can delete entire chats

#### Notifications
- Users can only read their own notifications
- Authenticated users can create notifications
- Only owners and admins can update/delete

#### Notes
- Users can only read/create/update/delete their own notes

#### Feedback
- Only admins can read feedback
- Authenticated users can submit feedback
- Only admins can update/delete

## Troubleshooting

If you encounter deployment errors:

1. **Check Firebase project ID:**
   Ensure you're deploying to the correct Firebase project.

2. **Verify rules syntax:**
   The rules have been tested for syntax errors.

3. **Check permissions:**
   Ensure your Firebase account has permission to deploy rules.

4. **Clear cache:**
   Sometimes clearing the Firebase CLI cache helps:
   ```
   firebase logout
   firebase login
   ```

## Testing

After deployment:
1. Restart your development server
2. Clear browser cache/cookies for the app
3. Test various operations to ensure they work properly

If you still encounter issues, check the browser console for specific error messages and verify that your Firebase configuration in `src/firebase.js` is correct.