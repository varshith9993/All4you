# API Key Reference Guide

## Reverse Geocoding API Keys

### OpenCage API
**Key:** `43ac78a805af4868b01f3dc9dcae8556`

**Used in:**
- Signup.js (user registration)
- useLocationWithAddress.js (shared hook)

**API Endpoint:**
```
https://api.opencagedata.com/geocode/v1/json?q={lat}+{lon}&key={API_KEY}
```

**Response Structure:**
```javascript
{
  results: [
    {
      components: {
        suburb: "...",
        neighbourhood: "...",
        city: "...",
        town: "...",
        county: "...",
        postcode: "..."
      }
    }
  ]
}
```

---

### LocationIQ API (Primary)
**Key:** `pk.c46b235dc808aed78cb86bd70c83fab0`

**Used in:**
- AddWorkers.js
- AddAds.js
- EditWorker.js
- EditAd.js

**API Endpoint:**
```
https://us1.locationiq.com/v1/reverse.php?key={API_KEY}&lat={lat}&lon={lon}&format=json
```

**Response Structure:**
```javascript
{
  address: {
    suburb: "...",
    neighbourhood: "...",
    village: "...",
    city: "...",
    town: "...",
    county: "...",
    postcode: "..."
  }
}
```

---

### LocationIQ API (Services)
**Key:** `pk.f85d97d836243abb9099ada5ebe13c73`

**Used in:**
- AddServices.js
- EditService.js

**API Endpoint:**
```
https://us1.locationiq.com/v1/reverse.php?key={API_KEY}&lat={lat}&lon={lon}&format=json
```

**Response Structure:** (Same as LocationIQ Primary)

---

## Geolocation Options

All pages now use these optimized settings:

```javascript
{
  enableHighAccuracy: true,  // Use GPS satellites
  timeout: 30000,            // 30 seconds timeout
  maximumAge: 0,             // No cached data
}
```

## Quick Reference Table

| Page/Component | API Provider | API Key (Last 4 chars) |
|----------------|--------------|------------------------|
| Signup.js | OpenCage | ...8556 |
| useLocationWithAddress.js | OpenCage | ...8556 |
| AddWorkers.js | LocationIQ | ...3fab0 |
| AddAds.js | LocationIQ | ...3fab0 |
| EditWorker.js | LocationIQ | ...3fab0 |
| EditAd.js | LocationIQ | ...3fab0 |
| AddServices.js | LocationIQ | ...13c73 |
| EditService.js | LocationIQ | ...13c73 |

## Important Notes

1. **Never commit API keys to public repositories**
2. Consider moving keys to environment variables in production
3. Monitor API usage to avoid exceeding quotas
4. Both APIs have rate limits - check their documentation
5. LocationIQ free tier: 5,000 requests/day
6. OpenCage free tier: 2,500 requests/day

## Environment Variables (Optional Future Enhancement)

For production, consider using:

```javascript
// .env file
REACT_APP_OPENCAGE_API_KEY=43ac78a805af4868b01f3dc9dcae8556
REACT_APP_LOCATIONIQ_PRIMARY_KEY=pk.c46b235dc808aed78cb86bd70c83fab0
REACT_APP_LOCATIONIQ_SERVICES_KEY=pk.f85d97d836243abb9099ada5ebe13c73

// Usage in code
const OPENCAGE_API_KEY = process.env.REACT_APP_OPENCAGE_API_KEY;
const LOCATIONIQ_API_KEY = process.env.REACT_APP_LOCATIONIQ_PRIMARY_KEY;
```
