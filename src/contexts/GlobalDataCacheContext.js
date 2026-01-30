import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, where, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Post Detail Cache Constants
const POST_DETAIL_CACHE_KEY = 'post_detail_cache';
const POST_DETAIL_CACHE_TTL = 300 * 24 * 60 * 60 * 1000; // 300 days - auto-cleanup if not visited

/**
 * GlobalDataCacheContext - Provides global caching for Workers, Services, and Ads data
 * 
 * KEY OPTIMIZATION: Instead of each page creating its own listener on mount/unmount,
 * this context maintains ONE persistent listener per collection at the App level.
 * 
 * Benefits:
 * 1. First visit to any page: Data loads from existing cache (0 reads if already cached)
 * 2. Switching tabs: Instant display from cache (0 additional reads)
 * 3. Returning to a page: Data shown immediately from cache (0 additional reads)
 * 4. Real-time updates: When data changes in Firestore, ALL cached data updates automatically
 * 5. Listeners persist across navigation - no re-subscription on every page visit
 */

const GlobalDataCacheContext = createContext(null);

export function GlobalDataCacheProvider({ children }) {
  // NEW: Track if listeners have been initialized (managed inside component)
  const listenerStateRef = useRef({
    userProfile: { initialized: false, unsubscribe: null },
    chats: { initialized: false, unsubscribe: null },
    notificationsData: { initialized: false, unsubscribes: [] },
    favPosts: { initialized: false, unsubscribes: {} }, // Changed to object for better key-based access
    notes: { initialized: false, unsubscribe: null },
    myPosts: { initialized: false, unsubscribes: [] },
    chatBadge: { initialized: false, unsubscribe: null }
  });

  // Current user state
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // User's own profile (for distance calculations, etc.)
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('global_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });

  // Track if data has ever been loaded (persists across navigation)
  const hasLoadedRef = useRef({
    chats: false,
    notifications: false
  });

  // NEW: Layout-level notification states (moved from Layout.js to prevent re-subscription)
  const [hasUnreadChats, setHasUnreadChats] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);

  // Full raw chats list for client-side processing
  const [fullChatsList, setFullChatsList] = useState(() => {
    try {
      const cached = localStorage.getItem('global_chats_full_list');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  const [chatsCache, setChatsCache] = useState(() => {
    try {
      const cached = localStorage.getItem('global_chats_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [chatLimit, setChatLimit] = useState(15);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [lastNotificationView, setLastNotificationView] = useState(() => parseInt(localStorage.getItem('lastNotificationView') || '0'));
  const lastNotificationViewRef = useRef(lastNotificationView);

  // NEW: Full notifications cache for Notifications page (Issue 3 fix)
  const [notificationsCache, setNotificationsCache] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_notifications_data');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notificationsMapRef = useRef(new Map());

  // Favorites cache state
  const [favoritesCache, setFavoritesCache] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const favoritesMapRef = useRef(new Map());

  // My Posts cache state
  const [myPostsCache, setMyPostsCache] = useState(() => {
    try {
      const cached = localStorage.getItem('global_my_posts');
      return cached ? JSON.parse(cached) : { workers: [], services: [], ads: [] };
    } catch { return { workers: [], services: [], ads: [] }; }
  });
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const myPostsMapRef = useRef(myPostsCache);

  // Real-time Favorite Posts Cache (Post Details)
  const [favPostsRealtime, setFavPostsRealtime] = useState({ workers: [], services: [], ads: [] });
  const favPostsRealtimeRef = useRef({ workers: [], services: [], ads: [] });

  // Track last update timestamps for debugging
  const lastUpdateRef = useRef({
    notes: null
  });

  // Persistent Search State (Survives navigation)
  const [searchStates, setSearchStates] = useState({
    workers: { query: "", filters: null, sortBy: "distance-low-high", scrollPos: 0 },
    services: { query: "", filters: null, sortBy: "distance-low-high", scrollPos: 0 },
    ads: { query: "", filters: null, sortBy: "distance-low-high", scrollPos: 0 }
  });

  const updateSearchState = useCallback((type, newState) => {
    setSearchStates(prev => ({
      ...prev,
      [type]: { ...prev[type], ...newState }
    }));
  }, []);

  const profileNamePromiseCacheRef = useRef(new Map()); // High optimization: prevents redundant Firestore reads for names

  const messageCacheRef = useRef({}); // Store messages for ChatDetail { chatId: { messages, lastUpdate } }

  // Load message cache from localStorage for "Zero Read" revisit
  useEffect(() => {
    try {
      const cached = localStorage.getItem('global_message_cache');
      if (cached) messageCacheRef.current = JSON.parse(cached);
    } catch (e) { }
  }, []);

  // Notes cache state
  const [notesCache, setNotesCache] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);




  // Authentication listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setIsAuthenticated(true);
      } else {
        setCurrentUserId(null);
        setIsAuthenticated(false);
        // Clear caches on logout
        setUserProfile(null);
        hasLoadedRef.current = { chats: false, notifications: false };
        setHasUnreadChats(false);
        setHasUnreadNotifs(false);
        setChatsCache([]);
        setNotesCache([]);

        // Reset listeners on logout
        const state = listenerStateRef.current;
        if (state.notes.unsubscribe) {
          state.notes.unsubscribe();
          state.notes.initialized = false;
        }
        if (listenerStateRef.current.chatBadge.unsubscribe) {
          listenerStateRef.current.chatBadge.unsubscribe();
          listenerStateRef.current.chatBadge.initialized = false;
        }
        if (state.chats.unsubscribe) {
          state.chats.unsubscribe();
          state.chats.initialized = false;
        }
        if (state.notificationsData.unsubscribes.length > 0) {
          state.notificationsData.unsubscribes.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
          });
          state.notificationsData.unsubscribes = [];
          state.notificationsData.initialized = false;
        }
        if (state.favPosts.unsubscribes) {
          Object.values(state.favPosts.unsubscribes).forEach(item => {
            if (Array.isArray(item)) {
              item.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
            } else if (typeof item === 'function') {
              item();
            }
          });
          state.favPosts.unsubscribes = {}; // Reset as object
          state.favPosts.initialized = false;
        }
        if (state.myPosts.unsubscribes.length > 0) {
          state.myPosts.unsubscribes.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
          });
          state.myPosts.unsubscribes = [];
          state.myPosts.initialized = false;
        }
        if (state.userProfile.unsubscribe) {
          state.userProfile.unsubscribe();
          state.userProfile.initialized = false;
          state.userProfile.unsubscribe = null;
        }
        messageCacheRef.current = {};
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // User profile listener - for current user's location/distance calculations
  useEffect(() => {
    if (!currentUserId) {
      if (listenerStateRef.current.userProfile.unsubscribe) {
        listenerStateRef.current.userProfile.unsubscribe();
        listenerStateRef.current.userProfile.initialized = false;
        listenerStateRef.current.userProfile.unsubscribe = null;
      }
      return;
    }

    // Skip if already initialized for this user
    if (listenerStateRef.current.userProfile.initialized) return;

    listenerStateRef.current.userProfile.initialized = true;
    const profileRef = doc(db, 'profiles', currentUserId);

    listenerStateRef.current.userProfile.unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        localStorage.setItem('global_user_profile', JSON.stringify(data));
        setUserProfile(data); // Update state to trigger re-renders
      }
    }, (error) => {
    });

    return () => {
      // Don't unsubscribe on unmount - we want persistent listeners
    };
  }, [currentUserId]);

  // 1. CHAT BADGE LISTENER (High Efficiency)
  // Only listens to chats with unread messages to show the red dot
  // Requirement: "if any unread messages in chats then it should take one read and show red dot"
  useEffect(() => {
    if (!currentUserId) return;
    if (listenerStateRef.current.chatBadge.initialized) return;

    listenerStateRef.current.chatBadge.initialized = true;

    // Query for any chat where this user has unread messages
    // This is extremely efficient because it only returns docs that matter
    // Simplified query to avoid requiring composite indexes (which need manual creation in Firebase console)
    // We filter for unread status client-side below
    const badgeQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUserId)
    );

    listenerStateRef.current.chatBadge.unsubscribe = onSnapshot(badgeQuery, (snap) => {
      // Check if any chat has unread messages for the current user
      let unread = false;
      snap.docs.forEach(d => {
        const chat = d.data();
        const isBlocked = chat.blockedBy && chat.blockedBy.includes(currentUserId);
        const isDeleted = chat.deletedBy && chat.deletedBy.includes(currentUserId);
        const unseenCount = (chat.unseenCounts && chat.unseenCounts[currentUserId]) || 0;

        // CRITICAL: Only count as unread if unseenCount is strictly > 0
        if (!isBlocked && !isDeleted && unseenCount > 0) {
          unread = true;
        }
      });

      // Only update if state actually changed to prevent unnecessary re-renders
      setHasUnreadChats(prev => {
        if (prev !== unread) {
        }
        return unread;
      });
    }, (err) => { });

    return () => { };
  }, [currentUserId]);

  // 2. PAGINATED CHATS LISTENER
  // Loads top 15 chats, then next 15 on request
  // Requirement: "load first 15 chats with one or two read... next 15 in next one or two read"
  useEffect(() => {
    if (!currentUserId) return;
    // OPTIMIZATION: Removed chatLimit from dependencies to maintain 'One Read' behavior.
    // The listener stays active for all user chats, and we slice client-side.
    if (listenerStateRef.current.chats.initialized) return;

    listenerStateRef.current.chats.initialized = true;

    // Simplified query to avoid composite index requirement
    // Sorting and limiting are handled client-side or by fetching all user chats
    const chatQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUserId)
    );

    listenerStateRef.current.chats.unsubscribe = onSnapshot(chatQuery, (snap) => {
      let rawChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter out logically deleted chats for the current user
      rawChats = rawChats.filter(chat => !chat.deletedBy?.includes(currentUserId));

      // Client-side deduplication (Only keep the most recently updated chat with each user)
      const chatMap = new Map();
      rawChats.forEach(chat => {
        if (!chat.participants) return;
        const otherId = chat.participants.find(p => p !== currentUserId);
        if (!otherId) return;

        const existing = chatMap.get(otherId);
        const chatTime = chat.updatedAt?.toMillis ? chat.updatedAt.toMillis() : (chat.updatedAt || 0);
        const existingTime = existing?.updatedAt?.toMillis ? existing.updatedAt.toMillis() : (existing?.updatedAt || 0);

        if (!existing || chatTime > existingTime) {
          chatMap.set(otherId, chat);
        }
      });

      let chats = Array.from(chatMap.values());

      // Client-side sorting (Desc by updatedAt)
      chats = chats.sort((a, b) => {
        const aT = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
        const bT = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
        return bT - aT;
      });

      setFullChatsList(chats);
      localStorage.setItem('global_chats_full_list', JSON.stringify(chats));
      hasLoadedRef.current.chats = true;

    }, (err) => { });

    return () => { };
  }, [currentUserId]);

  // Handle client-side pagination/slicing for Chats page
  useEffect(() => {
    const limitedChats = fullChatsList.slice(0, chatLimit);
    setChatsCache(limitedChats);
    localStorage.setItem('global_chats_cache', JSON.stringify(limitedChats));
    setHasMoreChats(fullChatsList.length > chatLimit);
  }, [fullChatsList, chatLimit]);


  // Helper to update notifications UI
  const updateNotificationsUI = useCallback(() => {
    const list = Array.from(notificationsMapRef.current.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30); // MAX_NOTIFICATIONS

    // Save to localStorage for persistence
    localStorage.setItem('cached_notifications_data', JSON.stringify(list));
    setNotificationsCache(list);
    setNotificationsLoading(false);
  }, []);

  // CONSOLIDATED NOTIFICATION & FAVORITE DATA SYNC - Matches notification_refer.js aesthetics
  useEffect(() => {
    if (!currentUserId) return;
    if (listenerStateRef.current.notificationsData.initialized) return;
    listenerStateRef.current.notificationsData.initialized = true;

    // Load initial map from existing cache, but filter out removed types
    notificationsCache.forEach(n => {
      const type = n.type || "system";
      const title = n.title || "";
      const msg = n.message?.toLowerCase() || "";
      // Filter out chats and the redundant generic "Post Status Changed" message.
      // We KEEP detailed ones that were previously generated.
      if (type === "chat" ||
        (title === "Post Status Changed" && msg.includes("update regarding your favorited post")) ||
        msg.includes("message")) return;
      notificationsMapRef.current.set(n.id, n);
    });

    const parseDate = (val) => {
      if (!val) return new Date();
      if (val.toDate) return val.toDate();
      if (val instanceof Date) return val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const getProfileName = (uid) => {
      if (!uid) return Promise.resolve("Someone");
      // OPTIMIZATION: Check promise cache to prevent concurrent redundant reads
      if (profileNamePromiseCacheRef.current.has(uid)) return profileNamePromiseCacheRef.current.get(uid);

      const promise = getDoc(doc(db, "profiles", uid)).then(snap => {
        return snap.exists() ? (snap.data().username || "Someone") : "Someone";
      }).catch(() => "Someone");

      profileNamePromiseCacheRef.current.set(uid, promise);
      return promise;
    };

    // 1. System/Direct Notifications (Ratings, Reviews, System)
    const sysQuery = query(collection(db, "notifications"), where("userId", "==", currentUserId));
    const unsubSys = onSnapshot(sysQuery, async (snap) => {
      const lastViewed = lastNotificationViewRef.current;
      let hasNew = false;

      await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const type = data.type || "system";
        const title = data.title || "";
        const message = data.message || "";
        const msgLower = message.toLowerCase();

        // STRICT FILTER: Skip chats and specifically the redundant generic "Post Status Changed" message.
        // We KEEP detailed ones like "Favorite Available" or "Favorite Disabled".
        if (type === "chat" || type === "post_status" ||
          (title === "Post Status Changed" && msgLower.includes("update regarding your favorited post")) ||
          msgLower.includes("message")) return;

        const date = parseDate(data.createdAt);
        const time = date.getTime();
        if (time > lastViewed) hasNew = true;

        const senderId = data.senderId || data.fromUserId;

        let finalTitle = title;
        let finalMessage = message;
        let status = data.status || null;
        let postId = data.postId || null;
        let postType = data.postType || null;

        if (type === "review" || type === "rating" || (title && title.toLowerCase().includes("rating"))) {
          const isRate = data.rating || title?.toLowerCase().includes("rating") || type === "rating";
          finalTitle = isRate ? "New Rating" : "New Review";
          if (senderId) {
            const name = await getProfileName(senderId);
            finalMessage = isRate ? `New ${data.rating ? data.rating + '-star ' : ''}rating received from ${name}` : `New review received from ${name}`;
          }
        }
        else if (type === "reply") {
          finalTitle = "Review Reply";
          if (senderId) {
            const name = await getProfileName(senderId);
            finalMessage = `${name} replied to your review`;
          }
        }
        else if (title.includes("Favorite")) {
          // Keep the title/message from Firestore if it contains "Favorite" (matches detailed notifications)
          finalTitle = title;
          finalMessage = message;
        }


        notificationsMapRef.current.set(`sys_${d.id}`, {
          id: `sys_${d.id}`,
          type,
          title: finalTitle || "App Update",
          message: finalMessage,
          date,
          timestamp: time,
          postId,
          postType,
          senderId: senderId || null,
          rating: data.rating || null,
          text: data.text || null,
          subText: data.text || data.subText || null,
          actionUrl: data.actionUrl || null,
          status: status
        });
      }));

      if (hasNew) setHasUnreadNotifs(true);
      updateNotificationsUI();
    });

    // 2. Review Replies (Changes to user's own reviews)
    const reviewCols = [
      { name: "workerReviews", type: "worker" },
      { name: "serviceReviews", type: "service" },
      { name: "adReviews", type: "ad" }
    ];

    const unsubReplies = reviewCols.map(col =>
      onSnapshot(query(collection(db, col.name), where("userId", "==", currentUserId)), async (snap) => {
        const lastViewed = lastNotificationViewRef.current;
        let hasNew = false;

        await Promise.all(snap.docChanges().map(async (change) => {
          if (change.type === "modified") {
            const data = change.doc.data();
            if (data.reply) {
              const date = parseDate(data.updatedAt || data.createdAt);
              const time = date.getTime();
              if (time > lastViewed) hasNew = true;

              notificationsMapRef.current.set(`reply_${change.doc.id}`, {
                id: `reply_${change.doc.id}`,
                type: "reply",
                title: "Review Reply",
                message: "Someone replied to your review",
                subText: data.reply,
                date,
                timestamp: time,
                postId: data.workerId || data.serviceId || data.adId,
                postType: col.type
              });
            }
          }
        }));

        if (hasNew) setHasUnreadNotifs(true);
        updateNotificationsUI();
      })
    );

    // 3. Favorites Logic - Real-time Status Changes
    const favConfigs = [
      { col: "workerFavorites", idField: "workerId", type: "worker", target: "workers", stateKey: "workers" },
      { col: "serviceFavorites", idField: "serviceId", type: "service", target: "services", stateKey: "services" },
      { col: "adFavorites", idField: "adId", type: "ad", target: "ads", stateKey: "ads" }
    ];
    const lastIdsMap = new Map();

    const unsubFavCollection = favConfigs.map(config => {
      return onSnapshot(query(collection(db, config.col), where("userId", "==", currentUserId)), (snap) => {
        const newFavs = snap.docs.map(f => ({ id: f.id, ...f.data(), type: config.type, postId: f.data()[config.idField] }));
        favoritesMapRef.current.set(config.type, newFavs);
        const allFavs = Array.from(favoritesMapRef.current.values()).flat();
        setFavoritesCache(allFavs);
        setFavoritesLoading(false);

        const postIds = snap.docs.map(d => d.data()[config.idField]).filter(Boolean);
        const idsKey = postIds.sort().join(',');
        if (lastIdsMap.get(config.type) === idsKey) return;
        lastIdsMap.set(config.type, idsKey);

        if (listenerStateRef.current.favPosts.unsubscribes[config.type]) {
          if (Array.isArray(listenerStateRef.current.favPosts.unsubscribes[config.type])) {
            listenerStateRef.current.favPosts.unsubscribes[config.type].forEach(u => u());
          } else {
            listenerStateRef.current.favPosts.unsubscribes[config.type]();
          }
        }

        if (postIds.length === 0) {
          favPostsRealtimeRef.current[config.stateKey] = [];
          setFavPostsRealtime(prev => ({ ...prev, [config.stateKey]: [] }));
          return;
        }

        const chunks = [];
        for (let i = 0; i < postIds.length; i += 30) chunks.push(postIds.slice(i, i + 30));

        listenerStateRef.current.favPosts.unsubscribes[config.type] = chunks.map(chunkIds => {
          return onSnapshot(query(collection(db, config.target), where("__name__", "in", chunkIds)), async (postSnap) => {

            let hasNew = false;

            // Process changes to detect status updates and generate detailed notifications
            for (const change of postSnap.docChanges()) {
              if (change.type === "modified" || change.type === "removed") {
                hasNew = true;

                const postData = change.doc.data();
                const postId = change.doc.id;
                const postType = config.type;
                const displayType = postType === 'ad' ? 'ads' : postType;
                const name = postData?.name || postData?.title || "Post";
                const status = postData?.status || (change.type === 'removed' ? 'deleted' : 'unknown');

                // Check old status to prevent spamming notifications when other fields change
                const typeMap = favPostsRealtimeRef.current[`${config.stateKey}_map`];
                const oldPost = typeMap ? typeMap.get(postId) : null;
                const oldStatus = oldPost ? oldPost.status : 'unknown';

                // Skip if status hasn't changed (unless it's a removal)
                if (change.type === 'modified' && oldStatus === status) {
                  continue;
                }

                let msg = "";
                if (change.type === 'removed') {
                  msg = `a ${displayType} post is deleted by the post owner and the post is vanished from favorites`;
                } else if (change.type === 'modified') {
                  const ownerId = postData?.createdBy;
                  const ownerName = ownerId ? await getProfileName(ownerId) : "Owner";

                  if (status === 'disabled') {
                    msg = `${ownerName} disabled "${name}" post and the ${displayType} post is vanished from favorites, it will be seen back when it is enabled back`;
                  } else if (status === 'active') {
                    msg = `${ownerName} enabled "${name}" post and now the ${displayType} post is available in favorites`;
                  } else if (status === 'expired') {
                    msg = `${ownerName} expired "${name}" post and the ${displayType} post is removed from favorites`;
                  }
                }

                if (msg) {
                  const titleMap = {
                    'active': 'Favorites Enabled',
                    'disabled': 'Favorites Disabled',
                    'expired': 'Favorites Expired',
                    'deleted': 'Favorites Deleted'
                  };
                  const title = titleMap[status] || "Post Status Changed";

                  notificationsMapRef.current.set(`status_${postId}_${status}`, {
                    id: `status_${postId}_${status}`,
                    type: "post_status",
                    title: title,
                    message: msg,
                    date: new Date(),
                    timestamp: Date.now(),
                    status,
                    postId,
                    postType
                  });
                }
              }
            }

            if (hasNew) {
              setHasUnreadNotifs(true);
              updateNotificationsUI();
            }

            if (!favPostsRealtimeRef.current[`${config.stateKey}_map`]) favPostsRealtimeRef.current[`${config.stateKey}_map`] = new Map();
            const typeMap = favPostsRealtimeRef.current[`${config.stateKey}_map`];

            chunkIds.forEach(id => {
              const doc = postSnap.docs.find(d => d.id === id);
              if (doc) {
                typeMap.set(id, { id: doc.id, ...doc.data() });
              } else {
                typeMap.delete(id);
              }
            });
            favPostsRealtimeRef.current[config.stateKey] = Array.from(typeMap.values());
            setFavPostsRealtime({
              workers: Array.from(favPostsRealtimeRef.current.workers_map?.values() || []),
              services: Array.from(favPostsRealtimeRef.current.services_map?.values() || []),
              ads: Array.from(favPostsRealtimeRef.current.ads_map?.values() || [])
            });
          });
        });
      });
    });

    listenerStateRef.current.notificationsData.unsubscribes.push(unsubSys);
    unsubReplies.forEach(u => listenerStateRef.current.notificationsData.unsubscribes.push(u));
    unsubFavCollection.forEach(u => listenerStateRef.current.notificationsData.unsubscribes.push(u));

    return () => {
      // Cleanup handled in main cleanup effect
    };
  }, [currentUserId, updateNotificationsUI, notificationsCache]);

  // SEPARATE EFFECT: Background Expiry Check for Favorites (0 Reads)
  // Moved to separate effect to prevent being killed when notificationsCache updates
  useEffect(() => {
    if (!currentUserId) return;

    // Immediate check on mount
    const checkExpiry = () => {
      const allFavs = [
        ...favPostsRealtimeRef.current.workers,
        ...favPostsRealtimeRef.current.services,
        ...favPostsRealtimeRef.current.ads
      ];

      const now = Date.now();
      // Changed key to reset/handle new structure allowing multiple notifications per post
      const notifiedKey = 'expired_notified_posts_v2';
      let notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
      let hasChanges = false;

      for (const post of allFavs) {
        if (!post.expiry) continue;
        const expiryDate = post.expiry.toDate ? post.expiry.toDate() : new Date(post.expiry);
        const diffMs = expiryDate.getTime() - now;
        const diffMins = diffMs / (1000 * 60);

        // 1. Check for < 5 mins (Expiring Now) - Red Alarm
        if (diffMs > 0 && diffMins <= 5) {
          const key = `${post.id}_5min`;
          if (!notified.includes(key)) {
            const name = post.title || post.name || "Post";
            notificationsMapRef.current.set(`expiry_5min_${post.id}`, {
              id: `expiry_5min_${post.id}`,
              type: "post_status",
              title: "Hurry up!!!",
              message: `⌛️Your favorites post "${name}" is expiring now - Take a Look!`,
              date: new Date(),
              timestamp: Date.now(),
              status: "expiring_5min", // Special status for icon
              postId: post.id,
              postType: post.type || (post.serviceType ? 'service' : post.photos ? 'ad' : 'worker')
            });
            notified.push(key);
            hasChanges = true;
            setHasUnreadNotifs(true);
          }
        }
        // 2. Check for < 1 hour (Expiring Soon) - Blue Stop Watch
        else if (diffMs > 0 && diffMins <= 60 && diffMins > 5) {
          const key = `${post.id}_1hr`;
          if (!notified.includes(key)) {
            const name = post.title || post.name || "Post";
            notificationsMapRef.current.set(`expiry_1hr_${post.id}`, {
              id: `expiry_1hr_${post.id}`,
              type: "post_status",
              title: "Last chance!",
              message: `Your favorites post "${name}" is expiring; Let's go!!!`,
              date: new Date(),
              timestamp: Date.now(),
              status: "expiring_1hr", // Special status for icon
              postId: post.id,
              postType: post.type || (post.serviceType ? 'service' : post.photos ? 'ad' : 'worker')
            });
            notified.push(key);
            hasChanges = true;
            setHasUnreadNotifs(true);
          }
        }
        // 3. Check for Expired (Fallback)
        else if (diffMs <= 0 && diffMs > -60 * 60 * 1000) { // Just expired (within last hour)
          const key = `${post.id}_expired`;
          if (!notified.includes(key)) {
            notificationsMapRef.current.set(`expiry_expired_${post.id}`, {
              id: `expiry_expired_${post.id}`,
              type: "post_status",
              title: "Favorite Expired",
              message: `Your favorited post "${post.title || post.name}" has expired.`,
              date: new Date(),
              timestamp: Date.now(),
              status: "expired",
              postId: post.id,
              postType: post.type || (post.serviceType ? 'service' : post.photos ? 'ad' : 'worker')
            });
            notified.push(key);
            hasChanges = true;
            setHasUnreadNotifs(true);
          }
        }
      }

      if (notified.length > 150) notified = notified.slice(-150); // Keep last 150 (allow room for multiple keys per post)
      localStorage.setItem(notifiedKey, JSON.stringify(notified));

      if (hasChanges) {
        updateNotificationsUI();
      }
    };

    // Run check immediately after a small delay to allow favorites to load
    const initialTimeout = setTimeout(checkExpiry, 2000);

    // Runs every minute to check if any favorite post is about to expire
    const expiryInterval = setInterval(checkExpiry, 60000); // Check every minute

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(expiryInterval);
    };
  }, [currentUserId, updateNotificationsUI]); // Reduced dependencies to ensure stability

  // Function to mark notifications as viewed
  const markNotificationsViewed = useCallback(() => {
    const now = Date.now();
    lastNotificationViewRef.current = now;
    setLastNotificationView(now);
    localStorage.setItem('lastNotificationView', String(now));
    setHasUnreadNotifs(false);
  }, []);


  // NOTES LISTENER - One global listener for current user's notes
  useEffect(() => {
    if (!currentUserId) {
      if (listenerStateRef.current.notes.unsubscribe) {
        listenerStateRef.current.notes.unsubscribe();
        listenerStateRef.current.notes.initialized = false;
        listenerStateRef.current.notes.unsubscribe = null;
      }
      setNotesCache([]);
      setNotesLoading(false);
      return;
    }

    // Skip if already initialized
    if (listenerStateRef.current.notes.initialized) {
      setNotesLoading(false);
      return;
    }

    listenerStateRef.current.notes.initialized = true;
    // Removed old initialization log

    const notesQuery = query(
      collection(db, 'notes'),
      where('userId', '==', currentUserId)
    );

    listenerStateRef.current.notes.unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const notesList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
          return timeB - timeA; // Most recent first
        });
      setNotesCache(notesList);
      setNotesLoading(false);
      lastUpdateRef.current.notes = new Date();


    }, (error) => {
      console.error('Error loading notes:', error);
      setNotesLoading(false);
    });

    return () => {
      // Don't unsubscribe on unmount - persistent listener
    };
  }, [currentUserId]);

  // POST DETAIL CACHE HELPERS - localStorage based with 2-day TTL
  /**
   * Get cached post detail if valid (not expired)
   * @param {string} postType - 'worker', 'service', or 'ad'
   * @param {string} postId - The post ID
   * @returns {object|null} - Cached data or null if expired/not found
   */
  const getPostDetailCache = useCallback((postType, postId) => {
    try {
      const cacheKey = `${POST_DETAIL_CACHE_KEY}_${postType}_${postId}`;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp, lastUpdated } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired (2 days)
      if (now - timestamp > POST_DETAIL_CACHE_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return { data, lastUpdated, cacheTimestamp: timestamp };
    } catch (e) {
      console.error('Error reading post detail cache:', e);
      return null;
    }
  }, []);

  /**
   * Set post detail in cache
   * @param {string} postType - 'worker', 'service', or 'ad'
   * @param {string} postId - The post ID
   * @param {object} data - The post data to cache
   * @param {number} lastUpdated - Server timestamp of last update (optional)
   */
  const setPostDetailCache = useCallback((postType, postId, data, lastUpdated = null) => {
    try {
      const cacheKey = `${POST_DETAIL_CACHE_KEY}_${postType}_${postId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
        lastUpdated: lastUpdated || Date.now()
      }));
    } catch (e) {
      console.error('Error setting post detail cache:', e);
    }
  }, []);

  /**
   * Invalidate post detail cache for a specific post
   */
  const invalidatePostDetailCache = useCallback((postType, postId) => {
    try {
      const cacheKey = `${POST_DETAIL_CACHE_KEY}_${postType}_${postId}`;
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.error('Error invalidating post detail cache:', e);
    }
  }, []);

  /**
   * Clean up expired post detail caches (call on app start)
   */
  const cleanupExpiredPostDetailCache = useCallback(() => {
    try {
      const now = Date.now();
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(POST_DETAIL_CACHE_KEY)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key) || '{}');
            if (now - (cached.timestamp || 0) > POST_DETAIL_CACHE_TTL) {
              keysToRemove.push(key);
            }
          } catch (e) {
            keysToRemove.push(key); // Remove invalid entries
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error('Error cleaning up post detail cache:', e);
    }
  }, []);

  useEffect(() => {
    cleanupExpiredPostDetailCache();
  }, [cleanupExpiredPostDetailCache]);

  // 8. My Posts Listener (Optimizes Profile Page)
  useEffect(() => {
    if (!currentUserId) return;
    if (listenerStateRef.current.myPosts.initialized) return;

    listenerStateRef.current.myPosts.initialized = true;
    setMyPostsLoading(true);
    const loadedCountRef = new Set();

    const postTypes = [
      { col: "workers", key: "workers" },
      { col: "services", key: "services" },
      { col: "ads", key: "ads" }
    ];

    const unsubs = postTypes.map(type => {
      const q = query(collection(db, type.col), where("createdBy", "==", currentUserId));
      return onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));



        myPostsMapRef.current[type.key] = docs;
        setMyPostsCache({ ...myPostsMapRef.current });
        localStorage.setItem('global_my_posts', JSON.stringify(myPostsMapRef.current));

        loadedCountRef.add(type.key);
        if (loadedCountRef.size === postTypes.length) {
          setMyPostsLoading(false);
        }
      }, (err) => {
        console.error(`Error in my ${type.key} listener:`, err);
      });
    });

    listenerStateRef.current.myPosts.unsubscribes = unsubs;

    return () => {
      // Persistent listener
    };
  }, [currentUserId]);

  useEffect(() => {
    const state = listenerStateRef.current;
    return () => {

      if (state.userProfile.unsubscribe) state.userProfile.unsubscribe();
      if (state.chats.unsubscribe) state.chats.unsubscribe();
      if (state.chatBadge.unsubscribe) state.chatBadge.unsubscribe();
      if (state.notes.unsubscribe) state.notes.unsubscribe();

      // Handle arrays of unsubscribes
      [state.notificationsData, state.myPosts].forEach(group => {
        if (group && Array.isArray(group.unsubscribes)) {
          group.unsubscribes.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
          });
        }
      });

      // Handle potentially nested/object-based unsubscribes (favPosts)
      if (state.favPosts && state.favPosts.unsubscribes) {
        Object.values(state.favPosts.unsubscribes).forEach(item => {
          if (Array.isArray(item)) {
            item.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
          } else if (typeof item === 'function') {
            item();
          }
        });
      }
    };
  }, []);

  /**
   * Get cache stats for debugging
   */
  const getCacheStats = useCallback(() => {
    return {
      chats: {
        count: chatsCache.length,
        lastUpdate: lastUpdateRef.current.chats
      },
      notes: {
        count: notesCache.length,
        lastUpdate: lastUpdateRef.current.notes
      }
    };
  }, [chatsCache.length, notesCache.length]);

  const value = useMemo(() => ({
    // User data
    currentUserId,
    isAuthenticated,
    userProfile,

    // Cached data
    chats: chatsCache,
    notifications: notificationsCache,
    favorites: favoritesCache,
    favPostsRealtime, // New real-time map
    notes: notesCache,
    myPosts: myPostsCache,

    // Loading states
    notificationsLoading,
    favoritesLoading,
    notesLoading,
    myPostsLoading,

    // Layout badge states
    hasUnreadChats,
    hasUnreadNotifs,
    markNotificationsViewed,
    lastNotificationView,
    hasMoreChats,
    loadMoreChats: () => setChatLimit(prev => prev + 15),

    // Search Persistence
    searchStates,
    updateSearchState,

    // Post Detail cache functions (2-day TTL)
    getPostDetailCache,
    setPostDetailCache,
    invalidatePostDetailCache,

    // Utility functions
    getCacheStats,
    getMessageCache: (chatId) => messageCacheRef.current[chatId] || null,
    setMessageCache: (chatId, messages, lastUpdate) => {
      // Store messages with timestamps converted to milliseconds for JSON serialization
      const serializedMessages = messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt?.toMillis ? msg.createdAt.toMillis() :
          msg.createdAt?.seconds ? msg.createdAt.seconds * 1000 :
            msg.createdAt,
        updatedAt: msg.updatedAt?.toMillis ? msg.updatedAt.toMillis() :
          msg.updatedAt?.seconds ? msg.updatedAt.seconds * 1000 :
            msg.updatedAt
      }));

      messageCacheRef.current[chatId] = { messages: serializedMessages, lastUpdate };

      // Limit cache size to avoid localStorage limits (keep last 20 chats)
      const keys = Object.keys(messageCacheRef.current);
      if (keys.length > 20) {
        delete messageCacheRef.current[keys[0]];
      }

      try {
        localStorage.setItem('global_message_cache', JSON.stringify(messageCacheRef.current));
      } catch (e) {
        console.error('Failed to save message cache:', e);
        // If localStorage is full, clear old entries
        const keysToRemove = keys.slice(0, 10);
        keysToRemove.forEach(key => delete messageCacheRef.current[key]);
        try {
          localStorage.setItem('global_message_cache', JSON.stringify(messageCacheRef.current));
        } catch (e2) {
          console.error('Failed to save message cache after cleanup:', e2);
        }
      }
    }
  }), [
    currentUserId,
    isAuthenticated,
    userProfile,
    chatsCache,
    notificationsCache,
    favoritesCache,
    notesCache,
    myPostsCache,
    notificationsLoading,
    favoritesLoading,
    notesLoading,
    myPostsLoading,
    hasUnreadChats,
    hasUnreadNotifs,
    markNotificationsViewed,
    favPostsRealtime,
    getPostDetailCache,
    setPostDetailCache,
    invalidatePostDetailCache,
    getCacheStats,
    hasMoreChats,
    lastNotificationView,
    searchStates,
    updateSearchState
  ]);

  return (
    <GlobalDataCacheContext.Provider value={value}>
      {children}
    </GlobalDataCacheContext.Provider>
  );
}

/**
 * Hook to access the global data cache
 */
export function useGlobalDataCache() {
  const context = useContext(GlobalDataCacheContext);
  if (!context) {
    throw new Error('useGlobalDataCache must be used within a GlobalDataCacheProvider');
  }
  return context;
}

/**
 * Hook for Layout component - provides badge states
 * This eliminates the need for Layout.js to create its own listeners
 */
export function useLayoutCache() {
  const { hasUnreadChats, hasUnreadNotifs, markNotificationsViewed, currentUserId, userProfile } = useGlobalDataCache();
  return {
    hasUnreadChats,
    hasUnreadNotifs,
    markNotificationsViewed,
    currentUserId,
    userProfile
  };
}

/**
 * Hook for Chats page - provides cached chat list
 */
export function useChatsCache() {
  const { chats, currentUserId, userProfile, hasMoreChats, loadMoreChats } = useGlobalDataCache();
  return {
    chats,
    currentUserId,
    userProfile,
    hasMoreChats,
    loadMoreChats
  };
}

/**
 * Hook for Notifications page - provides cached notifications
 * Issue 3 fix: First visit = 1 read, subsequent visits = 0 reads if no new data
 */
export function useNotificationsCache() {
  const {
    notifications,
    notificationsLoading,
    currentUserId,
    lastNotificationView,
    markNotificationsViewed,
    getPostDetailCache,
    setPostDetailCache
  } = useGlobalDataCache();

  return {
    notifications,
    loading: notificationsLoading,
    currentUserId,
    lastNotificationView,
    markNotificationsViewed,
    getPostDetailCache,
    setPostDetailCache
  };
}

/**
 * Hook for Notes page - provides cached notes
 * First visit: 1 read (listener initialization)
 * Subsequent visits: 0 reads (serve from persistent cache)
 */
export function useNotesCache() {
  const { notes, notesLoading, currentUserId } = useGlobalDataCache();
  return {
    notes,
    loading: notesLoading,
    currentUserId
  };
}

/**
 * Hook for Post Detail pages (WorkerDetail, ServiceDetail, AdDetail)
 * Provides localStorage-based caching with 2-day TTL
 * First visit: 1-2 reads (post + reviews)
 * Subsequent visits within 300 days: 0 reads if no changes
 */
export function usePostDetailCache() {
  const { getPostDetailCache, setPostDetailCache, invalidatePostDetailCache } = useGlobalDataCache();
  return {
    getPostDetailCache,
    setPostDetailCache,
    invalidatePostDetailCache
  };
}

/**
 * Hook for Favorites page - provides cached favorites list
 */
export function useFavoritesCache() {
  const { favorites, favoritesLoading, currentUserId, favPostsRealtime } = useGlobalDataCache();
  return {
    favorites,
    favPostsRealtime,
    loading: favoritesLoading,
    currentUserId
  };
}

/**
 * Hook for Workers/Services/Ads pages to persist search results
 */
export function useSearchCache() {
  const { searchStates, updateSearchState } = useGlobalDataCache();
  return { searchStates, updateSearchState };
}

export default GlobalDataCacheContext;
