import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { useProfileCache } from "../contexts/ProfileCacheContext";
import { useGlobalDataCache, useFavoritesCache } from "../contexts/GlobalDataCacheContext";
import {
  FiHeart,
  FiStar,
  FiMapPin,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiArrowLeft,
  FiWifi,
  FiChevronLeft,
  FiChevronRight
} from "react-icons/fi";
import { formatExpiry } from "../utils/expiryUtils";
import defaultAvatar from "../assets/images/default_profile.svg";

// Helper functions
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const lat1Num = parseFloat(lat1);
  const lon1Num = parseFloat(lon1);
  const lat2Num = parseFloat(lat2);
  const lon2Num = parseFloat(lon2);
  if (isNaN(lat1Num) || isNaN(lon1Num) || isNaN(lat2Num) || isNaN(lon2Num)) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2Num - lat1Num) * Math.PI / 180;
  const dLon = (lon2Num - lon1Num) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1Num * Math.PI / 180) * Math.cos(lat2Num * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return "Never online";
  try {
    let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60) return "Last Seen: just now";
    if (diffMins < 60) return `Last Seen: ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `Last Seen: ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return "Last Seen: yesterday";
    if (diffDays < 7) return `Last Seen: ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `Last Seen: ${day}/${month}/${year}`;
  } catch (error) {
    return "Offline";
  }
}

function isUserOnline(userId, currentUserId, online, lastSeen) {
  // Current user is always shown as online
  if (userId === currentUserId) return true;

  // CRITICAL FIX: Check lastSeen timestamp first
  if (lastSeen) {
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      const minutesSinceLastSeen = (Date.now() - date.getTime()) / 60000;
      if (minutesSinceLastSeen > 5) return false;
      if (minutesSinceLastSeen < 2) return true;
    } catch (error) {
      console.error('Error checking lastSeen:', error);
    }
  }

  if (online === true) return true;
  if (online === false) return false;
  return false;
}

export default function Favorites() {
  const [uid, setUid] = useState("");
  const [tab, setTab] = useState("workers");
  const [servicePhase, setServicePhase] = useState("all");

  // OPTIMIZATION: Use ProfileCache for batch profile fetching
  const { fetchProfiles, getAllCachedProfiles, subscribeToOnlineStatus } = useProfileCache();
  // OPTIMIZATION: Use GlobalDataCache for user profile (eliminates getDoc)
  const { userProfile: globalUserProfile, currentUserId: globalCurrentUserId } = useGlobalDataCache();

  // OPTIMIZATION: Use Global Cache for favorites (0 additional reads)
  const { favorites, loading: favoritesLoading, favPostsRealtime } = useFavoritesCache();

  // OPTIMIZATION: Real-time Data Sync
  // Derived posts are filtered to ensure "Vanish" behavior for non-active posts
  // No additional Firestore reads occur here; it uses results of existing global listeners
  const posts = React.useMemo(() => {
    if (!favPostsRealtime) return { workers: [], services: [], ads: [] };

    const mapFavs = (type, list, colName) => {
      return favorites
        .filter(f => f.type === type)
        .map(f => {
          const post = list.find(p => p.id === f.postId);
          // VANISH LOGIC: Filter out if post is missing (deleted), disabled, or expired
          if (!post || (post.status && post.status !== "active")) return null;
          return { ...post, favId: f.id, favCollection: colName };
        })
        .filter(Boolean);
    };

    return {
      workers: mapFavs('worker', favPostsRealtime.workers || [], 'workerFavorites'),
      services: mapFavs('service', favPostsRealtime.services || [], 'serviceFavorites'),
      ads: mapFavs('ad', favPostsRealtime.ads || [], 'adFavorites')
    };
  }, [favorites, favPostsRealtime]);

  const [userProfiles, setUserProfiles] = useState(() => {
    try {
      const cached = localStorage.getItem('fav_profiles_cache');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const userProfile = globalUserProfile;
  const currentUserId = globalCurrentUserId || uid;
  const navigate = useNavigate();

  useEffect(() => {
    if (Object.keys(userProfiles).length > 0) {
      localStorage.setItem('fav_profiles_cache', JSON.stringify(userProfiles));
    }
  }, [userProfiles]);

  // Auth state
  useEffect(() => {
    return auth.onAuthStateChanged(u => {
      setUid(u?.uid || "");
    });
  }, []);

  const loading = favoritesLoading;

  // Check if we have favorites but haven't loaded their details yet (prevents "No Favorites" flash)
  const totalFavCount = favorites.length;
  // Check raw real-time data count, not the filtered 'posts'
  const currentLoadedCount = (favPostsRealtime?.workers?.length || 0) +
    (favPostsRealtime?.services?.length || 0) +
    (favPostsRealtime?.ads?.length || 0);

  const isHydrating = totalFavCount > 0 && currentLoadedCount === 0;

  const showLoading = loading || isHydrating;

  // Fetch profiles for the posts we are showing
  useEffect(() => {
    const allCreatorIds = [
      ...posts.workers.map(p => p.createdBy),
      ...posts.services.map(p => p.createdBy),
      ...posts.ads.map(p => p.createdBy)
    ].filter(Boolean);

    const uniqueIds = [...new Set(allCreatorIds)];
    if (uniqueIds.length > 0) {
      fetchProfiles(uniqueIds).then(p => setUserProfiles(prev => ({ ...prev, ...p })));
    }
  }, [posts.workers, posts.services, posts.ads, fetchProfiles]);

  // Sync with global profile cache updates
  useEffect(() => {
    const cachedProfiles = getAllCachedProfiles();
    if (Object.keys(cachedProfiles).length > 0) {
      setUserProfiles(prev => ({ ...prev, ...cachedProfiles }));
    }
  }, [getAllCachedProfiles]);

  // OPTIMIZATION: Subscribe to online status updates for real-time status display
  // This refreshes every 15 seconds to show accurate online/offline status
  useEffect(() => {
    // Collect all creator IDs from all posts
    const allCreatorIds = [
      ...posts.workers.map(p => p.createdBy),
      ...posts.services.map(p => p.createdBy),
      ...posts.ads.map(p => p.createdBy)
    ].filter(Boolean);

    const uniqueCreatorIds = Array.from(new Set(allCreatorIds));
    if (uniqueCreatorIds.length === 0) return;

    const unsubscribe = subscribeToOnlineStatus(uniqueCreatorIds, (updatedProfiles) => {
      setUserProfiles(prev => ({ ...prev, ...updatedProfiles }));
    });

    return () => unsubscribe();
  }, [posts.workers, posts.services, posts.ads, subscribeToOnlineStatus]);

  // Remove selected
  async function removeSelected() {
    await Promise.all(selected.map(item => {
      const [favId, collection] = item.split('|');
      return deleteDoc(doc(db, collection, favId));
    }));
    setSelected([]);
    setShowConfirm(false);
    setSelectMode(false);
  }

  // Toggle selection
  const toggleSelect = (favId, collection) => {
    const key = `${favId}|${collection}`;
    setSelected(sel => sel.includes(key) ? sel.filter(x => x !== key) : [...sel, key]);
  };

  // Card UI for Workers - Matching Workers.js design
  function WorkerCard({ post }) {
    const key = `${post.favId}|${post.favCollection}`;
    const checked = selected.includes(key);

    const { title, rating = 0, location = {}, tags = [], latitude, longitude, createdBy, avatarUrl } = post;
    const workerCreatorProfile = userProfiles[createdBy] || {};
    const displayUsername = workerCreatorProfile.username || "Unknown User";
    const displayProfileImage = avatarUrl || workerCreatorProfile.photoURL || workerCreatorProfile.profileImage || defaultAvatar;
    const displayOnline = workerCreatorProfile.online;
    const displayLastSeen = workerCreatorProfile.lastSeen;

    let distanceText = "Distance away: --";
    if (userProfile && userProfile.latitude && userProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(userProfile.latitude, userProfile.longitude, latitude, longitude);
      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
        distanceText = `Distance away: ${distValue} away`;
      }
    }

    const isOnline = isUserOnline(createdBy, currentUserId, displayOnline, displayLastSeen);
    const statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    const statusColor = isOnline ? "text-green-600" : "text-gray-500";

    return (
      <div
        className={`bg-white p-3 rounded-lg border shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all ${selectMode && checked ? "border-red-400 bg-red-50" : "border-gray-200"}`}
        onClick={() => selectMode ? toggleSelect(post.favId, post.favCollection) : navigate(`/worker-detail/${post.id}`)}
      >
        <div className="flex items-start gap-3">
          {selectMode && (
            <div className="flex items-center pt-1">
              {checked ? <FiCheckSquare size={20} className="text-red-600" /> : <FiSquare size={20} className="text-gray-400" />}
            </div>
          )}

          {/* Left Column: Image & Rating */}
          <div className="flex flex-col items-center flex-shrink-0 w-16">
            <div className="relative mb-1.5">
              <img src={displayProfileImage} alt={displayUsername} className="w-14 h-14 rounded-full object-cover border-2 border-gray-300" onError={(e) => { e.target.src = defaultAvatar; }} crossOrigin="anonymous" />
              {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
            </div>
            <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
              <FiStar size={10} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-semibold text-yellow-700">{rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Username & Last Seen */}
            <div className="flex justify-between items-start mb-0.5">
              <h3 className="font-semibold text-gray-900 text-sm truncate pr-2">{displayUsername}</h3>
              <span className={`text-[10px] ${statusColor} flex items-center gap-1 flex-shrink-0`}>
                <FiWifi size={10} className={isOnline ? "text-green-500" : "text-gray-400"} />
                {statusText}
              </span>
            </div>

            {/* Row 2: Title */}
            <p className="text-indigo-600 text-xs font-medium mb-2 truncate">{title || "No Title"}</p>

            {/* Row 3: Tags & Distance */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-1 flex-wrap overflow-hidden h-5">
                {(tags || []).slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap">#{tag}</span>
                ))}
                {((tags || []).length > 3) && <span className="bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded text-[9px]">+{((tags || []).length - 3)} more</span>}
              </div>
              <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap ml-2 flex-shrink-0">{distanceText}</span>
            </div>

            {/* Row 4: Location */}
            <div className="flex items-center text-gray-500 text-[10px]">
              <FiMapPin size={10} className="mr-0.5 flex-shrink-0" />
              <span className="truncate">
                {location.area || "Unknown"}, {location.city || "Unknown"}
                {location.pincode ? `, ${location.pincode}` : ""}
              </span>
            </div>

            {/* Status Badge */}
            {post.status && post.status !== "active" && (
              <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full mt-2 inline-block font-medium border border-red-100">{post.status}</span>
            )}
          </div>

          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, post.favCollection, post.favId)); }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
              title="Remove from favorites"
            >
              <FiTrash2 size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card UI for Services - Matching Services.js design
  function ServiceCard({ post }) {
    const key = `${post.favId}|${post.favCollection}`;
    const checked = selected.includes(key);

    const { title, location = {}, tags = [], latitude, longitude, createdBy, profilePhotoUrl, type, serviceType, expiry } = post;

    // Real-time expiry state
    const [expiryInfo, setExpiryInfo] = useState(() => formatExpiry(expiry));

    useEffect(() => {
      if (!expiry) return;
      const timer = setInterval(() => {
        setExpiryInfo(formatExpiry(expiry));
      }, 60000);
      return () => clearInterval(timer);
    }, [expiry]);
    const creatorProfile = userProfiles[createdBy] || {};
    const displayUsername = creatorProfile.username || "Unknown User";
    const displayProfileImage = profilePhotoUrl || creatorProfile.photoURL || creatorProfile.profileImage || defaultAvatar;
    const displayOnline = creatorProfile.online;
    const displayLastSeen = creatorProfile.lastSeen;

    const finalType = type || serviceType || "provide";
    const isProviding = finalType === "provide";

    let distanceText = "Distance away: --";
    if (userProfile && userProfile.latitude && userProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(userProfile.latitude, userProfile.longitude, latitude, longitude);
      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
        distanceText = `Distance away: ${distValue} away`;
      }
    }

    // Check if it's "Until I change" option
    const isUntilIChange = () => {
      if (!expiry) return false;
      try {
        const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
        const year = expiryDate.getFullYear();
        return year === 9999 || year > 9000;
      } catch (error) {
        return false;
      }
    };

    // Get until text for all posts
    const getUntilText = () => {
      if (!expiry) return "";
      try {
        const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
        if (isUntilIChange()) {
          return "Until: Not Available";
        } else {
          return `Until: ${expiryDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`;
        }
      } catch (error) {
        return "Until: Unknown";
      }
    };

    const untilText = getUntilText();

    const { text: expiryText, color: expiryColor, isExpiringNow } = expiryInfo;

    const isOnline = isUserOnline(createdBy, currentUserId, displayOnline, displayLastSeen);
    const statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    const statusColor = isOnline ? "text-green-600" : "text-gray-500";

    return (
      <div
        className={`bg-white p-3 rounded-lg border shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all ${selectMode && checked ? "border-red-400 bg-red-50" : "border-gray-200"}`}
        onClick={() => selectMode ? toggleSelect(post.favId, post.favCollection) : navigate(`/service-detail/${post.id}`)}
      >
        <div className="flex items-start gap-3">
          {selectMode && (
            <div className="flex items-center pt-1">
              {checked ? <FiCheckSquare size={20} className="text-red-600" /> : <FiSquare size={20} className="text-gray-400" />}
            </div>
          )}

          {/* Left Column: Image & Type Badge */}
          <div className="flex flex-col items-center flex-shrink-0 w-16">
            <div className="relative mb-1.5">
              <img src={displayProfileImage} alt={displayUsername} className="w-14 h-14 rounded-full object-cover border-2 border-gray-300" onError={(e) => { e.target.src = defaultAvatar; }} crossOrigin="anonymous" />
              {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
            </div>
            <div className={`flex items-center justify-center px-1.5 py-0.5 rounded border w-full mb-1 ${isProviding ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
              <span className="text-[9px] font-semibold uppercase">{isProviding ? "Providing" : "Asking"}</span>
            </div>
            <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
              <FiStar size={10} className="fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-semibold text-yellow-700">{(creatorProfile.rating || 0).toFixed(1)}</span>
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Username & Last Seen */}
            <div className="flex justify-between items-start mb-0.5">
              <h3 className="font-semibold text-gray-900 text-sm truncate pr-2">{displayUsername}</h3>
              <span className={`text-[10px] ${statusColor} flex items-center gap-1 flex-shrink-0`}>
                <FiWifi size={10} className={isOnline ? "text-green-500" : "text-gray-400"} />
                {statusText}
              </span>
            </div>

            {/* Row 2: Title */}
            <p className="text-blue-600 text-xs font-medium mb-2 truncate">{title || "No Title"}</p>

            {/* Row 3: Tags & Distance */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-1 flex-wrap overflow-hidden h-5">
                {(tags || []).slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap">#{tag}</span>
                ))}
                {((tags || []).length > 3) && <span className="bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded text-[9px]">+{((tags || []).length - 3)} more</span>}
              </div>
              <div className="flex flex-col items-end gap-0.5 ml-2 flex-shrink-0">
                <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{distanceText}</span>
              </div>
            </div>

            {/* Row 4: Location */}
            <div className="flex items-center text-[10px] text-gray-500 mb-1">
              <FiMapPin size={10} className="mr-0.5 flex-shrink-0" />
              <span className="truncate">
                {[location.area, location.landmark, location.city, location.pincode].filter(Boolean).join(", ") || "Unknown"}
              </span>
            </div>

            {/* Row 5: Until and Expiry in same row */}
            <div className="flex items-center justify-between text-[10px]">
              {/* Until text on the left */}
              {untilText && (
                <span className="text-gray-500 whitespace-nowrap">
                  {untilText}
                </span>
              )}
              {/* Expiry text on the right */}
              {expiryText && (
                <span className={`${expiryColor} whitespace-nowrap font-medium ${isExpiringNow ? 'animate-pulse bg-red-100 px-1 rounded' : ''}`}>
                  {expiryText}
                </span>
              )}
            </div>

            {/* Status Badge */}
            {post.status && post.status !== "active" && (
              <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full mt-2 inline-block font-medium border border-red-100">{post.status}</span>
            )}
          </div>

          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, post.favCollection, post.favId)); }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
              title="Remove from favorites"
            >
              <FiTrash2 size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card UI for Ads - Matching Ads.js design
  function AdCard({ post }) {
    const key = `${post.favId}|${post.favCollection}`;
    const checked = selected.includes(key);

    const {
      profileImage,
      photos = [],
      title,
      rating = 0,
      location = {},
      tags = [],
      latitude,
      longitude,
      createdBy
    } = post;

    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const adCreatorProfile = userProfiles[createdBy] || {};
    const displayUsername = adCreatorProfile.username || "Unknown User";
    const displayProfileImage = adCreatorProfile.photoURL || adCreatorProfile.profileImage || profileImage || defaultAvatar;
    const displayOnline = adCreatorProfile.online;
    const displayLastSeen = adCreatorProfile.lastSeen;

    // Calculate distance
    let distanceText = "Distance away: --";

    if (userProfile && userProfile.latitude && userProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(
        userProfile.latitude,
        userProfile.longitude,
        latitude,
        longitude
      );

      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
        distanceText = `Distance away: ${distValue}`;
      }
    }

    const isOnline = isUserOnline(createdBy, currentUserId, displayOnline, displayLastSeen);

    const handlePrevPhoto = (e) => {
      e.stopPropagation();
      setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    };

    const handleNextPhoto = (e) => {
      e.stopPropagation();
      setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    };

    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 cursor-pointer hover:shadow-md transition-shadow ${selectMode && checked ? "border-red-400 bg-red-50" : ""}`}
        onClick={() => selectMode ? toggleSelect(post.favId, post.favCollection) : navigate(`/ad-detail/${post.id}`)}
      >
        {/* User info header */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          {selectMode && (
            <div className="flex items-center mr-2">
              {checked ? <FiCheckSquare size={20} className="text-red-600" /> : <FiSquare size={20} className="text-gray-400" />}
            </div>
          )}
          <div className="relative flex-shrink-0">
            <img src={displayProfileImage} alt={displayUsername} className="w-10 h-10 rounded-full object-cover border-2 border-gray-300" onError={(e) => { e.target.src = defaultAvatar; }} crossOrigin="anonymous" />
            {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{displayUsername}</h3>
              <div className="flex items-center gap-1 text-yellow-500 flex-shrink-0">
                <FiStar size={16} className="fill-current" />
                <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <FiWifi size={10} className={isOnline ? "text-green-500" : "text-gray-400"} />
              <span>{isOnline ? "Online" : formatLastSeen(displayLastSeen)}</span>
            </div>
          </div>
          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, post.favCollection, post.favId)); }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors ml-2"
              title="Remove from favorites"
            >
              <FiTrash2 size={18} />
            </button>
          )}
        </div>

        {/* Ad content */}
        <div className="relative w-full h-56 md:h-72 bg-gray-100 overflow-hidden">
          {photos && photos.length > 0 ? (
            <>
              {/* Blurred background for vertical/odd aspect ratio images */}
              <img
                src={photos[currentPhotoIndex]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60"
                aria-hidden="true"
                crossOrigin="anonymous"
              />
              {/* Main authentic image */}
              <img
                src={photos[currentPhotoIndex]}
                alt={title}
                className="relative w-full h-full object-contain z-10"
                onError={(e) => { e.target.style.display = 'none'; }}
                crossOrigin="anonymous"
              />

              {photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20"
                    aria-label="Previous photo"
                  >
                    <FiChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20"
                    aria-label="Next photo"
                  >
                    <FiChevronRight size={16} />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {photos.map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${index === currentPhotoIndex
                          ? 'bg-white w-4'
                          : 'bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No Image
            </div>
          )}
        </div>

        <div className="p-3">
          <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{title}</h4>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {location && (location.city || location.area) && (
            <div className="flex items-start justify-between gap-2 text-xs text-gray-600 mt-2">
              <div className="flex items-start gap-1 flex-1 min-w-0">
                <FiMapPin size={12} className="flex-shrink-0 mt-0.5" />
                <span className="break-words">
                  {[location.area, location.landmark, location.city, location.pincode].filter(Boolean).join(", ")}
                </span>
              </div>
              <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap flex-shrink-0">{distanceText}</span>
            </div>
          )}

          {/* Status Badge */}
          {post.status && post.status !== "active" && (
            <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full mt-2 inline-block font-medium border border-red-100">{post.status}</span>
          )}
        </div>
      </div>
    );
  }

  // Which posts to show
  // Use the pre-filtered 'posts' from memo for display
  let show = posts[tab] || [];

  if (tab === "services" && servicePhase !== "all") {
    show = show.filter(x => {
      const type = x.type || x.serviceType || "";
      if (servicePhase === "providing") {
        return type === "provide" || type === "providing";
      } else if (servicePhase === "asking") {
        return type === "ask" || type === "asking";
      }
      return false;
    });
  }

  // Counts for badges - Show all saved items
  const counts = {
    workers: posts.workers.length,
    services: posts.services.length,
    ads: posts.ads.length
  };

  // Subtab service phase counts
  const allServices = posts.services;
  const phaseCounts = {
    all: counts.services,
    providing: allServices.filter(s => (s.type || s.serviceType) === "provide" || (s.type || s.serviceType) === "providing").length,
    asking: allServices.filter(s => (s.type || s.serviceType) === "ask" || (s.type || s.serviceType) === "asking").length
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50" style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Header with Back Button */}
      <div className="bg-gradient-to-r from-pink-500 to-indigo-600 px-4 py-6 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Go back"
          >
            <FiArrowLeft size={24} className="text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-1">
            <FiHeart className="fill-white" />
            My Favorites
          </h1>
          {show.length > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected([]); }}
              className={`text-xs rounded-lg px-3 py-2 font-bold transition-all ${selectMode ? "bg-white text-gray-800" : "bg-white/20 text-white border border-white/30"}`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
        </div>
        <p className="text-white/90 text-sm ml-14">
          {counts.workers + counts.services + counts.ads} saved items
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          {[
            { key: "workers", label: "Workers", icon: "👷" },
            { key: "services", label: "Services", icon: "🛠️" },
            { key: "ads", label: "Ads", icon: "📢" }
          ].map(t => (
            <button
              key={t.key}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === t.key ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600"}`}
              onClick={() => { setTab(t.key); setServicePhase("all"); }}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Services phases */}
      {tab === "services" && (
        <div className="px-4 mb-4">
          <div className="flex gap-2">
            {["all", "providing", "asking"].map(k => (
              <button
                key={k}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize ${servicePhase === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}
                onClick={() => setServicePhase(k)}
              >
                {k} ({phaseCounts[k]})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 pb-8">
        {showLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : show.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <FiHeart size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Favorites Yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              {tab === "workers" && "Start saving workers you're interested in!"}
              {tab === "services" && "Start saving services you need!"}
              {tab === "ads" && "Start saving ads that catch your eye!"}
            </p>
            <button
              onClick={() => navigate(`/${tab}`)}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/30"
            >
              Browse {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          </div>
        ) : (
          <>
            {tab === "workers" && show.map(post => <WorkerCard key={post.id} post={post} />)}
            {tab === "services" && show.map(post => <ServiceCard key={post.id} post={post} />)}
            {tab === "ads" && show.map(post => <AdCard key={post.id} post={post} />)}
          </>
        )}
      </div>

      {/* Bulk delete confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiTrash2 size={32} className="text-red-600" />
            </div>
            <h3 className="font-bold mb-2 text-lg text-gray-900">Remove Favorites?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove {selected.length} favorite{selected.length > 1 ? "s" : ""}?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-100 text-gray-700 px-5 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-red-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                onClick={removeSelected}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating remove button */}
      {selectMode && selected.length > 0 && (
        <button
          onClick={() => setShowConfirm(true)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-3 rounded-full z-40 shadow-lg font-bold flex items-center gap-2 hover:bg-red-700 transition-all animate-bounce-in"
          style={{ maxWidth: "calc(480px - 2rem)" }}
        >
          <FiTrash2 size={18} />
          Remove {selected.length} Selected
        </button>
      )}
    </div>
  );
}
