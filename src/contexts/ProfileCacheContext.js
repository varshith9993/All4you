import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDocs, query, collection, where, documentId, onSnapshot } from 'firebase/firestore';

// Constants for cache management - OPTIMIZED
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache TTL (extended from 5 - profiles rarely change)
const BATCH_SIZE = 10; // Firestore 'in' query limit

const ProfileCacheContext = createContext(null);

export function ProfileCacheProvider({ children }) {
  // Main profile cache: { [userId]: { data, timestamp, listeners: Set } }
  const [profileCache, setProfileCache] = useState({});

  // Track cache in a ref for stable function access
  const profileCacheRef = useRef(profileCache);
  useEffect(() => {
    profileCacheRef.current = profileCache;
  }, [profileCache]);

  // Track pending fetches to prevent duplicate requests
  const pendingFetches = useRef(new Set());

  // Track active real-time listeners for online status
  const onlineStatusListeners = useRef({});

  // Batch fetch queue
  const fetchQueue = useRef([]);
  const fetchTimeoutRef = useRef(null);

  /**
   * Get a cached profile if it exists and is not stale
   */
  const getCachedProfile = useCallback((userId) => {
    const cached = profileCacheRef.current[userId];
    if (!cached) return null;

    const isStale = Date.now() - cached.timestamp > CACHE_TTL;
    if (isStale) return null;

    return cached.data;
  }, []); // Stable: uses profileCacheRef

  /**
   * Update the cache with new profile data
   */
  const updateCache = useCallback((userId, data) => {
    setProfileCache(prev => ({
      ...prev,
      [userId]: {
        data,
        timestamp: Date.now()
      }
    }));
  }, []);

  /**
   * Batch update multiple profiles in cache
   */
  const batchUpdateCache = useCallback((profiles) => {
    setProfileCache(prev => {
      const newCache = { ...prev };
      const timestamp = Date.now();

      Object.entries(profiles).forEach(([userId, data]) => {
        newCache[userId] = { data, timestamp };
      });

      return newCache;
    });
  }, []);

  /**
   * Process the fetch queue - batch fetch profiles
   */
  const processFetchQueue = useCallback(async () => {
    if (fetchQueue.current.length === 0) return;

    // Get unique IDs that aren't already being fetched
    const uniqueIds = [...new Set(fetchQueue.current)].filter(
      id => !pendingFetches.current.has(id)
    );

    // Clear the queue
    fetchQueue.current = [];

    if (uniqueIds.length === 0) return;

    // Mark all as pending
    uniqueIds.forEach(id => pendingFetches.current.add(id));

    try {
      // Split into batches of BATCH_SIZE (Firestore 'in' query limit is 10)
      const batches = [];
      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
      }

      // Fetch all batches
      const fetchedProfiles = {};

      await Promise.all(batches.map(async (batchIds) => {
        try {
          const q = query(
            collection(db, 'profiles'),
            where(documentId(), 'in', batchIds)
          );

          const snapshot = await getDocs(q);

          console.group(`[Data Sync: PROFILES BATCH]`);
          console.log(`%c✔ Profiles fetched in batch`, "color: gray; font-weight: bold");
          console.log(`- Reads: ${snapshot.docs.length || 1}`);
          console.log(`- Writes: 0`);
          console.groupEnd();

          snapshot.docs.forEach(docSnap => {
            fetchedProfiles[docSnap.id] = docSnap.data();
          });

          // For IDs that weren't found, set null to prevent refetching
          batchIds.forEach(id => {
            if (!fetchedProfiles[id]) {
              fetchedProfiles[id] = null;
            }
          });
        } catch (error) {
          console.error('Error batch fetching profiles:', error);
        }
      }));

      // Update cache with all fetched profiles
      batchUpdateCache(fetchedProfiles);

    } finally {
      // Clear pending status
      uniqueIds.forEach(id => pendingFetches.current.delete(id));
    }
  }, [batchUpdateCache]);

  /**
   * Queue a profile ID for batch fetching
   */
  const queueProfileFetch = useCallback((userId) => {
    if (!userId) return;

    // Check if already cached and not stale
    const cached = getCachedProfile(userId);
    if (cached !== null) return;

    // Check if already pending
    if (pendingFetches.current.has(userId)) return;

    // Add to queue
    fetchQueue.current.push(userId);

    // Debounce the fetch - wait 50ms to collect more IDs
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      processFetchQueue();
    }, 50);
  }, [getCachedProfile, processFetchQueue]);

  /**
   * Fetch a single profile (uses batch internally)
   */
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;

    // Check cache first
    const cached = getCachedProfile(userId);
    if (cached !== null) return cached;

    // Queue for batch fetch
    queueProfileFetch(userId);

    // Wait for fetch to complete
    return new Promise((resolve) => {
      const checkCache = () => {
        const data = getCachedProfile(userId);
        if (data !== null || !pendingFetches.current.has(userId)) {
          resolve(data);
        } else {
          setTimeout(checkCache, 50);
        }
      };

      setTimeout(checkCache, 100);
    });
  }, [getCachedProfile, queueProfileFetch]);

  /**
   * Fetch multiple profiles in batch
   * Returns: { [userId]: profileData }
   */
  const fetchProfiles = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return {};

    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    const result = {};
    const idsToFetch = [];

    // Check cache first
    uniqueIds.forEach(id => {
      const cached = getCachedProfile(id);
      if (cached !== null) {
        result[id] = cached;
      } else {
        idsToFetch.push(id);
      }
    });

    // If all cached, return immediately
    if (idsToFetch.length === 0) return result;

    // Mark as pending
    idsToFetch.forEach(id => pendingFetches.current.add(id));

    try {
      // Split into batches
      const batches = [];
      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        batches.push(idsToFetch.slice(i, i + BATCH_SIZE));
      }

      // Fetch all batches in parallel
      await Promise.all(batches.map(async (batchIds) => {
        try {
          const q = query(
            collection(db, 'profiles'),
            where(documentId(), 'in', batchIds)
          );

          const snapshot = await getDocs(q);

          console.group(`[Data Sync: PROFILES BATCH]`);
          console.log(`%c✔ Profiles fetched in batch`, "color: gray; font-weight: bold");
          console.log(`- Reads: ${snapshot.docs.length || 1}`);
          console.log(`- Writes: 0`);
          console.groupEnd();

          snapshot.docs.forEach(docSnap => {
            result[docSnap.id] = docSnap.data();
          });
        } catch (error) {
          console.error('Error batch fetching profiles:', error);
        }
      }));

      // Update cache
      const newCacheEntries = {};
      idsToFetch.forEach(id => {
        newCacheEntries[id] = result[id] || null;
      });
      batchUpdateCache(newCacheEntries);

    } finally {
      idsToFetch.forEach(id => pendingFetches.current.delete(id));
    }

    return result;
  }, [getCachedProfile, batchUpdateCache]);

  /**
   * Subscribe to real-time updates for a specific profile
   * Use sparingly - only for profiles that need live updates (e.g., chat partner)
   */
  const subscribeToProfile = useCallback((userId, callback) => {
    if (!userId) return () => { };

    // Create listener
    const unsub = onSnapshot(doc(db, 'profiles', userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        console.group(`[Data Sync: PROFILE UPDATE]`);
        console.log(`%c✔ Profile updated via listener`, "color: blue; font-weight: bold");
        console.log(`- Reads: 1 (Active listener)`);
        console.log(`- Writes: 0`);
        console.groupEnd();

        updateCache(userId, data);
        if (callback) callback(data);
      }
    }, (error) => {
      console.error(`Error in profile subscription for ${userId}:`, error);
    });

    return unsub;
  }, [updateCache]);

  /**
   * Subscribe to online status updates for multiple profiles
   * OPTIMIZATION: Replaced expensive 15s polling with real-time onSnapshot
   * This reduces reads from N per 15s to N once, then only 1 per update.
   */
  /**
   * Subscribe to online status updates for multiple profiles
   * OPTIMIZATION: Deduplicated listeners. If already listening to a UID, don't re-subscribe.
   * This ensures "zero reads on revisit" if the listener is already active.
   */
  const subscribeToOnlineStatus = useCallback((userIds, callback) => {
    if (!userIds || userIds.length === 0) return () => { };
    const uniqueIds = [...new Set(userIds)].filter(Boolean);

    uniqueIds.forEach(userId => {
      // If already listening, just trigger callback with current cache to ensure UI is up to date
      if (onlineStatusListeners.current[userId]) {
        const cached = getCachedProfile(userId);
        if (cached && callback) {
          const update = {};
          update[userId] = cached;
          callback(update);
        }
        return;
      }

      const profileRef = doc(db, 'profiles', userId);
      const unsub = onSnapshot(profileRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();

          // Only log if it's the initial fetch or a real change occurred
          // (Actually Firestore snapshots fire on listener start)
          // To satisfy "zero reads on revisit", we just keep the listener alive.

          console.group(`[Status: ONLINE SYNC - ${userId}]`);
          console.log(`%c✔ Online status synchronized`, "color: blue; font-weight: bold");
          console.log(`- Reads: 1 (Active listener initialization)`);
          console.log(`- Writes: 0`);
          console.groupEnd();

          updateCache(userId, data);
          if (callback) {
            const update = {};
            update[userId] = data;
            callback(update);
          }
        }
      }, (err) => console.error(`Online status error for ${userId}:`, err));

      onlineStatusListeners.current[userId] = unsub;
    });

    return () => { };
  }, [updateCache, getCachedProfile]);

  /**
   * Invalidate cache for specific users
   */
  const invalidateCache = useCallback((userIds) => {
    if (!userIds) {
      // Clear entire cache
      setProfileCache({});
      return;
    }

    const idsToInvalidate = Array.isArray(userIds) ? userIds : [userIds];

    setProfileCache(prev => {
      const newCache = { ...prev };
      idsToInvalidate.forEach(id => {
        delete newCache[id];
      });
      return newCache;
    });
  }, []);

  /**
   * Get all cached profiles (for components that need bulk access)
   */
  const getAllCachedProfiles = useCallback(() => {
    const result = {};
    Object.entries(profileCache).forEach(([userId, cached]) => {
      if (cached.data) {
        result[userId] = cached.data;
      }
    });
    return result;
  }, [profileCache]);

  // Cleanup on unmount
  useEffect(() => {
    const listeners = onlineStatusListeners.current;
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      // Clean up any remaining listeners
      Object.values(listeners).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  const value = useMemo(() => ({
    // Core functions
    fetchProfile,
    fetchProfiles,
    getCachedProfile,

    // Subscription functions
    subscribeToProfile,
    subscribeToOnlineStatus,

    // Cache management
    invalidateCache,
    getAllCachedProfiles,
    updateCache,

    // Direct cache access (read-only)
    profileCache
  }), [
    fetchProfile,
    fetchProfiles,
    getCachedProfile,
    subscribeToProfile,
    subscribeToOnlineStatus,
    invalidateCache,
    getAllCachedProfiles,
    updateCache,
    profileCache
  ]);

  return (
    <ProfileCacheContext.Provider value={value}>
      {children}
    </ProfileCacheContext.Provider>
  );
}

/**
 * Hook to use the profile cache
 */
export function useProfileCache() {
  const context = useContext(ProfileCacheContext);
  if (!context) {
    throw new Error('useProfileCache must be used within a ProfileCacheProvider');
  }
  return context;
}

/**
 * Hook to fetch and subscribe to a single profile
 */
export function useProfile(userId) {
  const { fetchProfile, getCachedProfile } = useProfileCache();
  const [profile, setProfile] = useState(() => getCachedProfile(userId));
  const [loading, setLoading] = useState(!profile);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = getCachedProfile(userId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }

    // Fetch if not cached
    fetchProfile(userId).then(data => {
      if (data) {
        setProfile(data);
      }
      setLoading(false);
    });
  }, [userId, fetchProfile, getCachedProfile]);

  return { profile, loading };
}

/**
 * Hook to fetch multiple profiles
 */
export function useProfiles(userIds) {
  const { fetchProfiles, getAllCachedProfiles } = useProfileCache();
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const prevIdsRef = useRef([]);

  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setProfiles({});
      setLoading(false);
      return;
    }

    // Check if IDs changed
    const idsString = userIds.sort().join(',');
    const prevIdsString = prevIdsRef.current.sort().join(',');

    if (idsString === prevIdsString) {
      return;
    }

    prevIdsRef.current = userIds;

    setLoading(true);

    fetchProfiles(userIds).then(data => {
      setProfiles(data);
      setLoading(false);
    });
  }, [userIds, fetchProfiles]);

  // Also include any updates from cache
  useEffect(() => {
    const cached = getAllCachedProfiles();
    if (userIds && userIds.length > 0) {
      const relevantProfiles = {};
      userIds.forEach(id => {
        if (cached[id]) {
          relevantProfiles[id] = cached[id];
        }
      });
      if (Object.keys(relevantProfiles).length > 0) {
        setProfiles(prev => ({ ...prev, ...relevantProfiles }));
      }
    }
  }, [getAllCachedProfiles, userIds]);

  return { profiles, loading };
}

export default ProfileCacheContext;
