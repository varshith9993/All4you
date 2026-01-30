# 🔒 Security & Environment Setup Guide

## ⚠️ IMPORTANT: Never Commit Sensitive Data

This project uses several API keys and credentials that **MUST NEVER** be committed to Git.

## 📋 Required Environment Variables

### Root Directory (`.env`)
Create a `.env` file in the root directory with:
```env
REACT_APP_LOCATIONIQ_KEY=your_locationiq_api_key_here
```

### Functions Directory (`functions/.env`)
Create a `functions/.env` file with:
```env
R2_ACCOUNT_ID=your_r2_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your_bucket_name_here
R2_PUBLIC_DOMAIN=https://your-r2-public-domain.r2.dev

LOCATIONIQ_API_KEY=your_locationiq_api_key_here
OPENCAGE_API_KEY=your_opencage_api_key_here
```

## 🔑 Where to Get API Keys

### 1. **LocationIQ** (Geocoding)
- Website: https://locationiq.com/
- Sign up for a free account
- Get your API key from the dashboard
- Used for: Address geocoding and reverse geocoding

### 2. **OpenCage** (Alternative Geocoding)
- Website: https://opencagedata.com/
- Sign up for a free account
- Get your API key from the dashboard
- Used for: Backup geocoding service

### 3. **Cloudflare R2** (Object Storage)
- Website: https://cloudflare.com/products/r2/
- Create a Cloudflare account
- Navigate to R2 Storage
- Create a bucket and get:
  - Account ID
  - Access Key ID
  - Secret Access Key
  - Public domain URL
- Used for: Storing user-uploaded images, audio, and files

### 4. **Firebase** (Already configured in `src/firebase.js`)
- Project: g-maps-api-472115
- Services used:
  - Authentication
  - Firestore Database
  - Realtime Database
  - Cloud Storage
  - Cloud Messaging (FCM)
  - Cloud Functions

## 🛡️ Security Best Practices

### ✅ What's Protected
- ✅ `.env` files are in `.gitignore`
- ✅ SSL certificates (`.pem` files) are ignored
- ✅ Firebase deployment cache is ignored
- ✅ Node modules are ignored
- ✅ Build artifacts are ignored

### ⚠️ Firebase Config in Frontend
**Note:** The Firebase configuration in `src/firebase.js` contains API keys that are **safe to expose** in frontend code. These are:
- `apiKey`: Safe to expose (protected by Firebase Security Rules)
- `authDomain`: Public domain
- `projectId`: Public identifier
- `messagingSenderId`: Public identifier
- `appId`: Public identifier

**However**, your **Firestore Security Rules** and **Firebase Functions** must be properly configured to prevent unauthorized access.

### 🔐 Backend Security Checklist

#### Firebase Functions Security
- [ ] Never expose R2 credentials in client-side code
- [ ] Use environment variables for all secrets
- [ ] Implement proper CORS configuration
- [ ] Validate all incoming requests
- [ ] Use Firebase Authentication to verify users
- [ ] Implement rate limiting for API endpoints

#### Firestore Security Rules
- [ ] Review `firestore.rules` regularly
- [ ] Never allow unrestricted read/write access
- [ ] Validate data structure and types
- [ ] Implement user-based access control

#### R2 Storage Security
- [ ] Keep R2 credentials in `functions/.env` only
- [ ] Never expose credentials in frontend
- [ ] Use signed URLs for private content
- [ ] Implement proper file validation before upload

## 🚀 Deployment Checklist

Before pushing to Git:
- [ ] Verify `.env` files are NOT staged (`git status`)
- [ ] Verify `.pem` files are NOT staged
- [ ] Check that `.gitignore` is working correctly
- [ ] Review all files being committed
- [ ] Ensure no API keys are hardcoded in source files

### Check for Accidentally Staged Secrets
```bash
# Check what files are staged
git status

# If you see .env or .pem files, unstage them:
git reset HEAD .env
git reset HEAD functions/.env
git reset HEAD *.pem

# Remove from Git history if already committed (DANGER!)
# Only use if you accidentally committed secrets
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env functions/.env *.pem" \
  --prune-empty --tag-name-filter cat -- --all
```

## 🔄 Setting Up a New Environment

1. Clone the repository
2. Copy `.env.example` to `.env` in root directory
3. Copy `functions/.env.example` to `functions/.env`
4. Fill in all API keys and credentials
5. Run `npm install` in root directory
6. Run `npm install` in `functions/` directory
7. Test the application locally

## 📝 Environment Variables in Production

### Firebase Functions
Set environment variables using Firebase CLI:
```bash
# Set individual variables
firebase functions:config:set r2.account_id="YOUR_ACCOUNT_ID"
firebase functions:config:set r2.access_key_id="YOUR_ACCESS_KEY"
firebase functions:config:set r2.secret_access_key="YOUR_SECRET_KEY"
firebase functions:config:set r2.bucket_name="YOUR_BUCKET"
firebase functions:config:set r2.public_domain="YOUR_DOMAIN"

# View current config
firebase functions:config:get

# Deploy with new config
firebase deploy --only functions
```

### React App (Frontend)
For production builds, set environment variables in your hosting platform:
- **Firebase Hosting**: Use `.env.production` (not committed to Git)
- **Vercel/Netlify**: Set in dashboard under Environment Variables

## 🆘 If You Accidentally Committed Secrets

1. **Immediately rotate all exposed credentials**
   - Generate new API keys
   - Update `.env` files locally
   - Update Firebase Functions config

2. **Remove from Git history**
   - Use `git filter-branch` or `BFG Repo-Cleaner`
   - Force push to remote (coordinate with team)

3. **Verify removal**
   - Check Git history: `git log --all --full-history -- .env`
   - Search for exposed keys in GitHub/GitLab

## 📚 Additional Resources

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Git Secrets Prevention](https://git-secret.io/)
- [Environment Variables Best Practices](https://12factor.net/config)

---

**Last Updated:** 2026-01-30
**Maintained by:** Development Team
