# Step-by-Step Manual Changes

## 1. Workers.js - Add Status Filter

**File:** `src/pages/Workers.js`

**Find this code (around line 538):**
```javascript
    // Apply filters
    const filteredWorkers = workersWithDistance.filter(worker => {
      const creatorProfile = userProfiles[worker.createdBy] || {};

      // Search filter
```

**Replace with:**
```javascript
    // Apply filters
    const filteredWorkers = workersWithDistance.filter(worker => {
      const creatorProfile = userProfiles[worker.createdBy] || {};

      // Filter out disabled and expired posts
      const status = worker.status || "active";
      if (status === "disabled" || status === "expired") return false;

      // Search filter
```

---

## 2. Services.js - Add Status Filter

**File:** `src/pages/Services.js`

**Find the filter function (similar to Workers.js) and add the same status filter:**
```javascript
// Filter out disabled and expired posts
const status = service.status || "active";
if (status === "disabled" || status === "expired") return false;
```

Add this right after getting the service data and before other filters.

---

## 3. Ads.js - Add Status Filter

**File:** `src/pages/Ads.js`

**Find the filter function and add:**
```javascript
// Filter out disabled and expired posts
const status = ad.status || "active";
if (status === "disabled" || status === "expired") return false;
```

---

## 4. Favorites.js - Add Status Filter

**File:** `src/pages/Favorites.js`

**Find where favorites are displayed and add filtering:**

Look for where posts are mapped/displayed and add:
```javascript
.filter(post => {
  const status = post.status || "active";
  return status === "active";
})
```

---

## 5. Profile.js - Update PostMenu Component

**File:** `src/pages/Profile.js`

### Step 5a: Add hasExpiryTime logic

**Find (around line 953):**
```javascript
  const status = post.status || "active";

  return (
```

**Replace with:**
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

  return (
```

### Step 5b: Update Menu Rendering

**Find (around lines 958-970):**
```javascript
      <div className="bg-white px-8 py-6 rounded-xl shadow-lg flex flex-col min-w-[200px] animate-fade-in" onClick={e => e.stopPropagation()} ref={menuRef}>
        {status === "active" && (
          <>
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("edit")}>Edit</button>
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("disable")}>Disable</button>
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("expire")}>Expire</button>
          </>
        )}
        {status === "disabled" && (
          <>
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("enable")}>Enable</button>
            <button className="py-2 text-left hover:bg-gray-50 text-gray-700 font-medium" onClick={() => handleAction("expire")}>Expire</button>
          </>
        )}
        <button className="py-2 text-left hover:bg-red-50 text-red-600 font-medium" onClick={() => handleAction("delete")}>Delete</button>
```

**Replace with:**
```javascript
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
```

### Step 5c: Update Confirmation Messages

**Find (around line 920):**
```javascript
              : action === "expire"
                ? "Are you sure you want to expire this post?"
                : "Are you sure you want to delete this post?",
```

**Replace with:**
```javascript
              : action === "expire"
                ? "Are you sure you want to expire this post? It will disappear from main pages and favorites."
                : "Are you sure you want to delete this post permanently?",
```

### Step 5d: Add Favorites Cleanup Logic

**Find the onConfirm function (around line 923):**
```javascript
        onConfirm: async () => {
          if (action === "enable" || action === "disable")
            await updateDoc(ref, { status: action === "enable" ? "active" : "disabled" });
          else if (action === "expire") await updateDoc(ref, { status: "expired" });
          else if (action === "delete") await deleteDoc(ref);
```

**Replace with:**
```javascript
        onConfirm: async () => {
          try {
            if (action === "enable" || action === "disable") {
              await updateDoc(ref, { status: action === "enable" ? "active" : "disabled" });
            } else if (action === "expire") {
              await updateDoc(ref, { status: "expired" });
              
              // Remove from all users' favorites when expired
              const favCollectionName = 
                col === "workers" ? "workerFavorites" : 
                col === "services" ? "serviceFavorites" : 
                "adFavorites";
              
              const favQuery = query(
                collection(db, favCollectionName),
                where("postId", "==", post.id)
              );
              const favSnap = await getDocs(favQuery);
              const deletePromises = favSnap.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);
              
            } else if (action === "delete") {
              // Delete from favorites first
              const favCollectionName = 
                col === "workers" ? "workerFavorites" : 
                col === "services" ? "serviceFavorites" : 
                "adFavorites";
              
              const favQuery = query(
                collection(db, favCollectionName),
                where("postId", "==", post.id)
              );
              const favSnap = await getDocs(favQuery);
              const deletePromises = favSnap.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);
              
              // Then delete the post
              await deleteDoc(ref);
            }
```

**And update the closing part:**
```javascript
            updatePosts((prev) => ({
              ...prev,
              [col]: action === "delete"
                ? prev[col].filter((p) => p.id !== post.id)
                : prev[col].map((p) =>
                  p.id === post.id
                    ? {
                      ...p, status:
                        action === "expire" ? "expired"
                          : action === "enable" ? "active"
                            : action === "disable" ? "disabled"
                              : p.status
                    }
                    : p),
            }));
            closeMenu();
            setShowConfirm(false);
          } catch (error) {
            console.error("Error performing action:", error);
            closeMenu();
            setShowConfirm(false);
          }
        },
```

---

## Testing Checklist

After making all changes, test:

1. ✅ Disable a worker → should disappear from Workers.js
2. ✅ Disabled worker should disappear from Favorites.js
3. ✅ Enable the worker → should reappear in Workers.js
4. ✅ Enabled worker should reappear in Favorites.js (if previously favorited)
5. ✅ Services with expiry time should NOT show disable/enable options
6. ✅ Services without expiry time (Expiry: NA) should show disable/enable options
7. ✅ Expire a post → should disappear from main pages and favorites
8. ✅ Expired posts should only be visible in Profile.js with "expired" badge
9. ✅ Delete should remove post completely from everywhere

---

## Quick Reference

**Status Values:**
- `"active"` - Normal, visible everywhere
- `"disabled"` - Hidden from main pages and favorites, visible in profile
- `"expired"` - Hidden from main pages and favorites (removed), visible in profile

**Collections:**
- Workers: `workers` collection, `workerFavorites` for favorites
- Services: `services` collection, `serviceFavorites` for favorites  
- Ads: `ads` collection, `adFavorites` for favorites
