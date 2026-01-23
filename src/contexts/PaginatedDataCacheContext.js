import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  getDocs,
  getCountFromServer,
  limit,
  startAfter,
  orderBy,
  where
} from 'firebase/firestore';
import { useGlobalDataCache } from './GlobalDataCacheContext';

/**
 * PaginatedDataCacheContext - Smart pagination with metadata-based cache validation
 * 
 * KEY FEATURES:
 * 1. Initial load: Only 15 documents per page (1 read operation)
 * 2. Page switching: Check metadata for changes, use cache if unchanged (0 reads)
 * 3. Infinite scroll: Load 15 more documents per scroll (1 read)
 * 4. Search pagination: 10 results per batch (1 read)
 * 5. Filter/Sort: Re-query with new params, load 15 at a time
 * 
 * CACHE VALIDATION:
 * - Store document count per collection
 * - On return visit, check count - if same, use cache
 * - If count changed, refresh data
 */

const PaginatedDataCacheContext = createContext(null);

// Configuration - AGGRESSIVELY OPTIMIZED for cost reduction
const PAGE_SIZE = 9;            // Normal browsing page size (reduced from 10 to 9)
const SEARCH_PAGE_SIZE = 9;     // Search results page size
const METADATA_CHECK_INTERVAL = 10 * 60 * 1000; // Check metadata only once per 10 minutes (extended from 5)

export function PaginatedDataCacheProvider({ children }) {
  // OPTIMIZATION: Redundant states removed

  // Paginated data caches - keyed by collection + filter/sort hash
  const [workersData, setWorkersData] = useState(() => {
    try {
      const cached = localStorage.getItem('paginated_workers_cache');
      return cached ? JSON.parse(cached) : { items: [], hasMore: true, lastDoc: null };
    } catch { return { items: [], hasMore: true, lastDoc: null }; }
  });

  const [servicesData, setServicesData] = useState(() => {
    try {
      const cached = localStorage.getItem('paginated_services_cache');
      return cached ? JSON.parse(cached) : { items: [], hasMore: true, lastDoc: null };
    } catch { return { items: [], hasMore: true, lastDoc: null }; }
  });

  const [adsData, setAdsData] = useState(() => {
    try {
      const cached = localStorage.getItem('paginated_ads_cache');
      return cached ? JSON.parse(cached) : { items: [], hasMore: true, lastDoc: null };
    } catch { return { items: [], hasMore: true, lastDoc: null }; }
  });

  // Refs to store current data state for use in callbacks without triggering dependency updates
  const workersDataRef = useRef({ items: [], hasMore: true, lastDoc: null });
  const servicesDataRef = useRef({ items: [], hasMore: true, lastDoc: null });
  const adsDataRef = useRef({ items: [], hasMore: true, lastDoc: null });

  // Update refs whenever state changes
  useEffect(() => { workersDataRef.current = workersData; }, [workersData]);
  useEffect(() => { servicesDataRef.current = servicesData; }, [servicesData]);
  useEffect(() => { adsDataRef.current = adsData; }, [adsData]);

  // Loading states
  const [workersLoading, setWorkersLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState({ workers: false, services: false, ads: false });

  // Metadata cache for change detection (document counts + last timestamps)
  const metadataCacheRef = useRef(() => {
    try {
      const cached = localStorage.getItem('paginated_metadata_cache');
      return cached ? JSON.parse(cached) : {
        workers: { count: 0, latestTimestamp: 0, lastCheck: 0 },
        services: { count: 0, latestTimestamp: 0, lastCheck: 0 },
        ads: { count: 0, latestTimestamp: 0, lastCheck: 0 }
      };
    } catch {
      return {
        workers: { count: 0, latestTimestamp: 0, lastCheck: 0 },
        services: { count: 0, latestTimestamp: 0, lastCheck: 0 },
        ads: { count: 0, latestTimestamp: 0, lastCheck: 0 }
      };
    }
  });

  // Ensure metadata cache is initialized if it was a function
  if (typeof metadataCacheRef.current === 'function') {
    metadataCacheRef.current = metadataCacheRef.current();
  }

  // Track if initial load completed for each collection
  const initialLoadRef = useRef({
    workers: false,
    services: false,
    ads: false
  });

  // Track current filter/sort state to invalidate cache when changed
  const filterStateRef = useRef({
    workers: '',
    services: '',
    ads: ''
  });

  // OPTIMIZATION: Get auth and profile state from GlobalDataCacheContext
  // This removes 2 redundant persistent listeners
  const { currentUserId: globalUserId, userProfile: globalUserProfile, isAuthenticated: globalIsAuth } = useGlobalDataCache();

  const currentUserId = globalUserId;
  // Persist items to localStorage
  useEffect(() => {
    try {
      // We exclude lastDoc (snapshot) from storage, but we keep items and hasMore
      const dataToStore = {
        items: workersData.items,
        hasMore: workersData.hasMore,
        lastDoc: null,
        timestamp: Date.now() // OPTIMIZATION: 45-min cache TTL
      };
      localStorage.setItem('paginated_workers_cache', JSON.stringify(dataToStore));
    } catch (e) { }
  }, [workersData.items, workersData.hasMore]);

  useEffect(() => {
    try {
      const dataToStore = {
        items: servicesData.items,
        hasMore: servicesData.hasMore,
        lastDoc: null,
        timestamp: Date.now() // OPTIMIZATION: 45-min cache TTL
      };
      localStorage.setItem('paginated_services_cache', JSON.stringify(dataToStore));
    } catch (e) { }
  }, [servicesData.items, servicesData.hasMore]);

  useEffect(() => {
    try {
      const dataToStore = {
        items: adsData.items,
        hasMore: adsData.hasMore,
        lastDoc: null,
        timestamp: Date.now() // OPTIMIZATION: 45-min cache TTL
      };
      localStorage.setItem('paginated_ads_cache', JSON.stringify(dataToStore));
    } catch (e) { }
  }, [adsData.items, adsData.hasMore]);


  const isAuthenticated = globalIsAuth;
  const userProfile = globalUserProfile;

  // Clear caches on logout
  useEffect(() => {
    if (!currentUserId) {
      setWorkersData({ items: [], hasMore: true, lastDoc: null });
      setServicesData({ items: [], hasMore: true, lastDoc: null });
      setAdsData({ items: [], hasMore: true, lastDoc: null });
      initialLoadRef.current = { workers: false, services: false, ads: false };
    }
  }, [currentUserId]);

  /**
   * Get document count for a collection (for change detection)
   * Uses getCountFromServer for minimal read cost
   */
  const getCollectionCount = useCallback(async (collectionName) => {
    try {
      const q = query(
        collection(db, collectionName)
      );
      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;

      return count;
    } catch (error) {
      return -1;
    }
  }, []);

  /**
   * Get the timestamp of the most recently updated document in a collection
   */
  const getLatestTimestamp = useCallback(async (collectionName) => {
    try {
      // Try ordering by updatedAt first, fallback to createdAt
      const q = query(
        collection(db, collectionName),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Try fallback to createdAt
        const qFallback = query(
          collection(db, collectionName),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snapFallback = await getDocs(qFallback);
        if (snapFallback.empty) return 0;
        const data = snapFallback.docs[0].data();
        return data.createdAt?.toMillis?.() || data.createdAt || 0;
      }

      const data = snapshot.docs[0].data();
      const timestamp = data.updatedAt?.toMillis?.() || data.updatedAt || data.createdAt?.toMillis?.() || data.createdAt || 0;

      return timestamp;
    } catch (error) {
      return 0;
    }
  }, []);

  /**
   * Check if collection has changes since last visit
   * Uses most recent timestamp for validation
   * OPTIMIZATION: Only checks if last check was more than 10 minutes ago
   * OPTIMIZATION: Removed count check - timestamp is sufficient (saves 1 read)
   */
  const hasCollectionChanges = useCallback(async (collectionName) => {
    const cached = metadataCacheRef.current[collectionName];
    const now = Date.now();

    // OPTIMIZATION: Skip metadata check if checked within last 10 minutes
    const timeSinceLastCheck = now - (cached.lastCheck || 0);
    if (timeSinceLastCheck < METADATA_CHECK_INTERVAL) {
      return false; // Assume no changes
    }

    // Check for changes (metadata check: timestamp only)

    // OPTIMIZATION: Only check timestamp (removed count check - saves 1 read)
    const currentTimestamp = await getLatestTimestamp(collectionName);

    const timeChanged = cached.latestTimestamp < currentTimestamp;
    const hasChanges = timeChanged;

    // Update metadata cache regardless of change
    metadataCacheRef.current[collectionName] = {
      count: cached.count || 0, // Keep for backward compatibility
      latestTimestamp: currentTimestamp,
      lastCheck: now
    };
    try {
      localStorage.setItem('paginated_metadata_cache', JSON.stringify(metadataCacheRef.current));
    } catch (e) { }

    return hasChanges;
  }, [getLatestTimestamp]);

  /**
   * Fetch paginated data for a collection
   * @param {string} collectionName - 'workers', 'services', or 'ads'
   * @param {object} options - { sortField, sortDirection, filters, isLoadMore, forceRefresh }
   */
  const fetchPaginatedData = useCallback(async (collectionName, options = {}) => {
    const {
      sortField = 'createdAt',
      sortDirection = 'desc',
      filters = {},
      isLoadMore = false,
      forceRefresh = false,
      pageSize = PAGE_SIZE
    } = options;

    // Generate filter/sort hash for cache invalidation
    const filterHash = JSON.stringify({ sortField, sortDirection, filters });
    const filterChanged = filterStateRef.current[collectionName] !== filterHash;

    // Get current data state from Ref (to avoid dependency loop)
    const getDataState = () => {
      switch (collectionName) {
        case 'workers': return workersDataRef.current;
        case 'services': return servicesDataRef.current;
        case 'ads': return adsDataRef.current;
        default: return { items: [], hasMore: true, lastDoc: null };
      }
    };

    const setDataState = (data) => {
      switch (collectionName) {
        case 'workers': setWorkersData(data); break;
        case 'services': setServicesData(data); break;
        case 'ads': setAdsData(data); break;
        default: break;
      }
    };

    const setLoading = (loading) => {
      switch (collectionName) {
        case 'workers': setWorkersLoading(loading); break;
        case 'services': setServicesLoading(loading); break;
        case 'ads': setAdsLoading(loading); break;
        default: break;
      }
    };

    const currentData = getDataState();

    // CACHE-ASIDE LOGIC - OPTIMIZED WITH 7-MINUTE TTL:
    // On app reload with cache: Check TTL first, skip metadata check if fresh (0 reads)
    // Check for changes in background after display
    if (!isLoadMore && !forceRefresh && !filterChanged && (initialLoadRef.current[collectionName] || currentData.items.length > 0)) {

      // CRITICAL OPTIMIZATION: 7-minute cache TTL check
      // If cache is fresh, use it immediately with ZERO reads
      if (!initialLoadRef.current[collectionName] && currentData.items.length > 0) {
        const cacheKey = `paginated_${collectionName}_cache`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            const cacheAge = Date.now() - (parsed.timestamp || 0);
            const CACHE_TTL = 7 * 60 * 1000; // 7 minutes in milliseconds

            if (cacheAge < CACHE_TTL) {
              // Cache is fresh - use it with ZERO reads!
              initialLoadRef.current[collectionName] = true;

              // Background validation (non-blocking)
              setTimeout(() => {
                hasCollectionChanges(collectionName).then(hasChanges => {
                  if (hasChanges) {
                  }
                });
              }, 1000);

              return currentData.items;
            } else {
              // Cache expired - fetch fresh data
              initialLoadRef.current[collectionName] = true;
              // Continue to fetch below
            }
          } catch (e) {
          }
        }
      }

      // For subsequent visits: Check for changes (metadata check: counts + timestamp)
      const hasChanges = await hasCollectionChanges(collectionName);

      if (!hasChanges && currentData.items.length > 0) {
        // Update lastDoc to the last item in the cached list so loadMore works
        const items = currentData.items;
        // Search for the actual last document might be hard without the full object, 
        // but currentData.lastDoc should already be correct from previous load.
        return items;
      }
    }

    // Update filter state
    filterStateRef.current[collectionName] = filterHash;

    // Set loading state
    if (isLoadMore) {
      setLoadingMore(prev => ({ ...prev, [collectionName]: true }));
    } else {
      setLoading(true);
    }

    try {
      // Build query
      let constraints = [];

      // Add status filter if specifically requested
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      // Add other filters
      if (filters.createdBy) {
        constraints.push(where('createdBy', '==', filters.createdBy));
      }

      // Add ordering and pagination
      constraints.push(orderBy(sortField, sortDirection));

      // For load more, start after last document
      if (isLoadMore) {
        if (currentData.lastDoc) {
          // Best: use snapshot
          constraints.push(startAfter(currentData.lastDoc));
        } else if (currentData.items.length > 0) {
          // Fallback: use field value (assuming createdAt or similar timestamp sort)
          // Sort is usually 'desc', so we take the last item's value
          const lastItem = currentData.items[currentData.items.length - 1];
          let cursor = null;

          if (sortField === 'createdAt' || sortField === 'updatedAt') {
            // Handle potential conversion from object to millis if needed, assuming cached items kept minimal structure
            // However, our cached items usually lost the Firestore 'Timestamp' method.
            // We need to robustly handle date string vs object vs number.
            const val = lastItem[sortField];
            if (val && typeof val === 'object' && val.seconds) {
              cursor = new Date(val.seconds * 1000); // Reconstruct JS Date (Firestore SDK handles Date object in startAfter)
            } else if (typeof val === 'string') {
              cursor = new Date(val);
            } else {
              cursor = val;
            }
          } else {
            cursor = lastItem[sortField];
          }

          if (cursor) {
            constraints.push(startAfter(cursor));
          }
        }
      }

      constraints.push(limit(pageSize));

      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);

      const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === pageSize;

      // Update state
      if (isLoadMore) {
        // Append to existing items
        const updatedData = {
          items: [...currentData.items, ...newItems],
          hasMore,
          lastDoc
        };
        setDataState(updatedData);

        return updatedData.items;
      } else {
        // Replace items (initial load, filter change, or change detected)
        const updatedData = { items: newItems, hasMore, lastDoc };
        setDataState(updatedData);
        initialLoadRef.current[collectionName] = true;

        // Reset metadata cache to current state to prevent immediate re-fetch
        metadataCacheRef.current[collectionName] = {
          count: await getCollectionCount(collectionName),
          latestTimestamp: await getLatestTimestamp(collectionName),
          lastCheck: Date.now()
        };

        return newItems;
      }
    } catch (error) {
      return currentData.items;
    } finally {
      if (isLoadMore) {
        setLoadingMore(prev => ({ ...prev, [collectionName]: false }));
      } else {
        setLoading(false);
      }
    }
  }, [
    hasCollectionChanges, getCollectionCount, getLatestTimestamp
  ]);

  /**
   * Search with pagination
   * @param {string} collectionName
   * @param {string} searchQuery
   * @param {object} options - { isLoadMore, lastDoc, pageSize }
   */
  const searchPaginated = useCallback(async (collectionName, searchQuery, options = {}) => {
    const { isLoadMore = false, pageSize = SEARCH_PAGE_SIZE } = options;

    // Note: Firestore doesn't support full-text search natively
    // For real search, we fetch data and filter client-side
    // This is a placeholder - in production, use Algolia, Typesense, or Firestore extensions

    // This is a placeholder - in production, use Algolia, Typesense, or Firestore extensions

    // For now, fall back to normal pagination and let the page filter
    return fetchPaginatedData(collectionName, {
      isLoadMore,
      pageSize,
      forceRefresh: !isLoadMore
    });
  }, [fetchPaginatedData]);

  /**
   * Load more items (infinite scroll)
   */
  const loadMore = useCallback(async (collectionName, options = {}) => {
    const dataState = collectionName === 'workers' ? workersData :
      collectionName === 'services' ? servicesData : adsData;

    if (!dataState.hasMore || loadingMore[collectionName]) {
      return dataState.items;
    }

    return fetchPaginatedData(collectionName, { ...options, isLoadMore: true });
  }, [fetchPaginatedData, workersData, servicesData, adsData, loadingMore]);

  /**
   * Force refresh data for a collection
   */
  const refreshCollection = useCallback(async (collectionName, options = {}) => {
    // Reset state
    const resetData = { items: [], hasMore: true, lastDoc: null };
    switch (collectionName) {
      case 'workers': setWorkersData(resetData); break;
      case 'services': setServicesData(resetData); break;
      case 'ads': setAdsData(resetData); break;
      default: break;
    }
    initialLoadRef.current[collectionName] = false;

    return fetchPaginatedData(collectionName, { ...options, forceRefresh: true });
  }, [fetchPaginatedData]);

  /**
   * Get cached items without fetching
   */
  const getCachedItems = useCallback((collectionName) => {
    switch (collectionName) {
      case 'workers': return workersData.items;
      case 'services': return servicesData.items;
      case 'ads': return adsData.items;
      default: return [];
    }
  }, [workersData.items, servicesData.items, adsData.items]);

  /**
   * Check if collection has more items to load
   */
  const hasMoreItems = useCallback((collectionName) => {
    switch (collectionName) {
      case 'workers': return workersData.hasMore;
      case 'services': return servicesData.hasMore;
      case 'ads': return adsData.hasMore;
      default: return false;
    }
  }, [workersData.hasMore, servicesData.hasMore, adsData.hasMore]);

  // No-op cleanup effect (real-time listeners were removed)
  useEffect(() => {
    return () => { };
  }, []);

  const value = useMemo(() => ({
    // Auth
    currentUserId,
    isAuthenticated,
    userProfile,

    // Data
    workers: workersData.items,
    services: servicesData.items,
    ads: adsData.items,

    // Loading states
    workersLoading,
    servicesLoading,
    adsLoading,
    loadingMore,

    // Pagination info
    hasMoreWorkers: workersData.hasMore,
    hasMoreServices: servicesData.hasMore,
    hasMoreAds: adsData.hasMore,

    // Methods
    fetchPaginatedData,
    loadMore,
    searchPaginated,
    refreshCollection,
    getCachedItems,
    hasMoreItems,
    hasCollectionChanges,

    // Constants
    PAGE_SIZE,
    SEARCH_PAGE_SIZE
  }), [
    currentUserId, isAuthenticated, userProfile,
    workersData, servicesData, adsData,
    workersLoading, servicesLoading, adsLoading, loadingMore,
    fetchPaginatedData, loadMore, searchPaginated, refreshCollection,
    getCachedItems, hasMoreItems, hasCollectionChanges
  ]);

  return (
    <PaginatedDataCacheContext.Provider value={value}>
      {children}
    </PaginatedDataCacheContext.Provider>
  );
}

// Main hook
export function usePaginatedDataCache() {
  const context = useContext(PaginatedDataCacheContext);
  if (!context) {
    throw new Error('usePaginatedDataCache must be used within a PaginatedDataCacheProvider');
  }
  return context;
}

// Collection-specific hooks
export function usePaginatedWorkers() {
  const {
    workers, workersLoading, loadingMore, hasMoreWorkers,
    fetchPaginatedData, loadMore, currentUserId, userProfile
  } = usePaginatedDataCache();

  const fetchWorkers = useCallback((options = {}) => {
    return fetchPaginatedData('workers', options);
  }, [fetchPaginatedData]);

  const loadMoreWorkers = useCallback((options = {}) => {
    return loadMore('workers', options);
  }, [loadMore]);

  return {
    workers,
    loading: workersLoading,
    loadingMore: loadingMore.workers,
    hasMore: hasMoreWorkers,
    fetchWorkers,
    loadMoreWorkers,
    currentUserId,
    userProfile
  };
}

export function usePaginatedServices() {
  const {
    services, servicesLoading, loadingMore, hasMoreServices,
    fetchPaginatedData, loadMore, currentUserId, userProfile
  } = usePaginatedDataCache();

  const fetchServices = useCallback((options = {}) => {
    return fetchPaginatedData('services', options);
  }, [fetchPaginatedData]);

  const loadMoreServices = useCallback((options = {}) => {
    return loadMore('services', options);
  }, [loadMore]);

  return {
    services,
    loading: servicesLoading,
    loadingMore: loadingMore.services,
    hasMore: hasMoreServices,
    fetchServices,
    loadMoreServices,
    currentUserId,
    userProfile
  };
}

export function usePaginatedAds() {
  const {
    ads, adsLoading, loadingMore, hasMoreAds,
    fetchPaginatedData, loadMore, currentUserId, userProfile
  } = usePaginatedDataCache();

  const fetchAds = useCallback((options = {}) => {
    return fetchPaginatedData('ads', options);
  }, [fetchPaginatedData]);

  const loadMoreAds = useCallback((options = {}) => {
    return loadMore('ads', options);
  }, [loadMore]);

  return {
    ads,
    loading: adsLoading,
    loadingMore: loadingMore.ads,
    hasMore: hasMoreAds,
    fetchAds,
    loadMoreAds,
    currentUserId,
    userProfile
  };
}

export default PaginatedDataCacheContext;
