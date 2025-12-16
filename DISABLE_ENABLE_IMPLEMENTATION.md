# Complete Implementation Guide for Disable/Enable Feature

## Overview
This guide provides all the code changes needed to implement the disable/enable feature across the application.

## Changes Required

### 1. Profile.js - PostMenu Component

**Location:** Line 538 in the filter function

**Add status filter to exclude disabled and expired posts from main pages:**

```javascript
// In the filteredWorkers.filter() function, add at the beginning:
// Filter out disabled and expired posts
const status = worker.status || "active";
if (status === "disabled" || status === "expired") return false;
```

**Location:** PostMenu function (around line 953)

**Add logic to check if service has expiry time:**

```javascript
const status = post.status || "active";

// Check if service has expiry time (not NA)
const hasExpiryTime = currentTab === "services" && post.expiry && (() => {
  try {
    const expiryDate = post.expiry.toDate ? post.expiry.toDate() : new Date(post.expiry);
    const year = expiryDate.getFullYear();
    // If year is 9999, it's "Expiry: NA" - no expiry time
    return year !== 9999 && year < 9000;
  } catch (error) {
    return false;
  }
})();
```

**Location:** PostMenu return statement (lines 958-970)

**Replace the menu rendering logic:**

```javascript
return (
  <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={closeMenu}>
    <div className="bg-white px-8 py-6 rounded-xl shadow-lg flex flex-col min-w-[200px] animate-fade-in" onClick={e => e.stopPropagation()} ref={menuRef}>
      {/* Show Edit option for active posts */}
      {status === "active" && (
        <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("edit")}>Edit</button>
      )}
      
      {/* Show Expire option for all post types when active */}
      {status === "active" && (
        <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("expire")}>Expire</button>
      )}
      
      {/* Show Disable/Enable - NOT for services with expiry time */}
      {!hasExpiryTime && (
        <>
          {status === "active" && (
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("disable")}>Disable</button>
          )}
          {status === "disabled" && (
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("enable")}>Enable</button>
          )}
        </>
      )}
      
      {/* Always show Delete */}
      <button className="py-2 text-left hover:bg-red-50 text-red-600 font-medium" onClick={() => handleAction("delete")}>Delete</button>
      
      <div className="h-px bg-gray-100 my-2"></div>
      <button className="text-center py-2 text-blue-600 hover:underline text-sm" onClick={() => handleAction("about")}>About</button>
      <button className="text-center py-2 text-gray-500 hover:underline text-sm" onClick={closeMenu}>Cancel</button>
    </div>
  </div>
);
```

### 2. Workers.js - Filter Disabled/Expired Posts

**Location:** Line 538 in `getDisplayedWorkers()` function, inside the filter

**Add at the beginning of the filter function (before search filter):**

```javascript
// Filter out disabled and expired posts
const status = worker.status || "active";
if (status === "disabled" || status === "expired") return false;
```

### 3. Services.js - Filter Disabled/Expired Posts

**Location:** In the services filter function (similar to Workers.js)

**Add at the beginning of the filter function:**

```javascript
// Filter out disabled and expired posts  
const status = service.status || "active";
if (status === "disabled" || status === "expired") return false;
```

### 4. Ads.js - Filter Disabled/Expired Posts

**Location:** In the ads filter function (similar to Workers.js)

**Add at the beginning of the filter function:**

```javascript
// Filter out disabled and expired posts
const status = ad.status || "active";
if (status === "disabled" || status === "expired") return false;
```

### 5. Favorites.js - Filter Disabled/Expired Posts

**Location:** In the favorites display logic

**Add filtering for disabled and expired posts:**

```javascript
// When displaying favorites, filter out disabled and expired posts
const displayedFavorites = favoritePosts.filter(post => {
  const status = post.status || "active";
  return status === "active";
});
```

## Summary of Behavior

### Disabled Posts:
- **Profile.js**: Visible with "disabled" status badge
- **Workers.js/Services.js/Ads.js**: NOT visible
- **Favorites.js**: NOT visible
- **Menu Options**: Show "Enable" instead of "Disable"

### Expired Posts:
- **Profile.js**: Visible with "expired" status badge  
- **Workers.js/Services.js/Ads.js**: NOT visible
- **Favorites.js**: NOT visible (removed from favorites when expired)
- **Menu Options**: Only show "Delete", "About", "Cancel"

### Active Posts:
- **Profile.js**: Visible normally
- **Workers.js/Services.js/Ads.js**: Visible normally
- **Favorites.js**: Visible if favorited
- **Menu Options**: Show "Edit", "Expire", "Disable" (except for services with time), "Delete"

### Services with Expiry Time:
- Do NOT show "Disable"/"Enable" options in menu
- All other behavior same as regular posts

## Implementation Steps

1. Update Profile.js PostMenu component
2. Add status filter to Workers.js
3. Add status filter to Services.js  
4. Add status filter to Ads.js
5. Add status filter to Favorites.js
6. Test all scenarios:
   - Disable a worker → should disappear from Workers.js and Favorites.js
   - Enable a worker → should reappear in Workers.js and Favorites.js (if previously favorited)
   - Expire a service → should disappear from Services.js and Favorites.js
   - Services with time should not show disable/enable options
