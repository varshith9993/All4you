# Profile.js Three-Dot Menu Implementation Guide

## Overview
This document outlines the changes needed to implement the three-dot menu functionality in Profile.js with all required features: Edit, Expire, Disable/Enable, and Delete.

## Required Changes

### 1. Update Confirmation Message for Expire Action
**Location:** Line 920-922 in PostMenu function

**Current:**
```javascript
: action === "expire"
  ? "Are you sure you want to expire this post?"
  : "Are you sure you want to delete this post?",
```

**Change to:**
```javascript
: action === "expire"
  ? "Are you sure you want to expire this post? It will disappear from main pages and favorites."
  : "Are you sure you want to delete this post permanently?",
```

### 2. Update handleAction onConfirm Function
**Location:** Line 923-945 in PostMenu function

**Current:** Simple status updates without favorites cleanup

**Change to:** Add favorites cleanup for expire and delete actions

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

### 3. Add Logic to Check if Service Has Expiry Time
**Location:** After line 953 (after `const status = post.status || "active";`)

**Add:**
```javascript
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

### 4. Update Menu Rendering Logic
**Location:** Lines 958-970 in PostMenu return statement

**Current:** Shows Edit, Disable, Expire for active; Enable, Expire for disabled

**Change to:**
```javascript
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
```

## Summary of Features

1. **Edit** - Shows for active posts only, navigates to edit page
2. **Expire** - Shows for all active posts (workers, services, ads), sets status to "expired" and removes from all users' favorites
3. **Disable** - Shows for active posts EXCEPT services with expiry time, sets status to "disabled"
4. **Enable** - Shows for disabled posts EXCEPT services with expiry time, sets status to "active"
5. **Delete** - Always shows, permanently deletes post and removes from all users' favorites
6. **About** - Always shows, displays information about menu options
7. **Cancel** - Always shows, closes the menu

## Special Cases

- **Services with expiry time**: Do NOT show Disable/Enable options
- **Expired posts**: When a post is expired, it disappears from main pages and favorites, but remains visible in the user's profile with an "expired" status badge
- **Disabled posts**: Disappear from main pages but remain in profile
- **Deleted posts**: Removed completely from everywhere including profile

## Implementation Notes

- The favorites cleanup uses Firestore queries to find all favorite documents for a given post ID across all users
- Error handling is included to prevent crashes if favorites deletion fails
- The menu uses conditional rendering based on post status and type
- Services with year 9999 in expiry date are considered "Expiry: NA" (no expiry time set)
