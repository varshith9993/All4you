import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { collection, query, onSnapshot, doc } from "firebase/firestore";
import { FiStar, FiMapPin, FiFilter, FiChevronDown, FiX, FiPlus, FiWifi, FiChevronLeft, FiChevronRight, FiSearch } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.png";
import Layout from "../components/Layout";
import {
  buildFuseIndex,
  performSearch,
  reRankByRelevance,
  getAdSearchKeys,
  prepareAdForSearch,
} from "../utils/searchEngine";

// --- Helper Functions ---

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const lat1Num = parseFloat(lat1);
  const lon1Num = parseFloat(lon1);
  const lat2Num = parseFloat(lat2);
  const lon2Num = parseFloat(lon2);
  if (isNaN(lat1Num) || isNaN(lon1Num) || isNaN(lat2Num) || isNaN(lon2Num)) return null;
  const R = 6371;
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
  if (userId === currentUserId) return true;
  if (online === true) {
    if (!lastSeen) return true;
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return diffMs < 5000;
    } catch (error) {
      return true;
    }
  }
  if (online === false) return false;
  if (!lastSeen) return false;
  try {
    let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 5000;
  } catch (error) {
    return false;
  }
}

// --- AdCard Component ---
function AdCard({ ad, profile, userProfiles, currentUserId, navigate }) {
  const { title, photos = [], rating = 0, location = {}, tags = [], latitude, longitude, createdBy } = ad;
  const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(0);
  const [imagesPreloaded, setImagesPreloaded] = React.useState(false);
  const adCreatorProfile = userProfiles[createdBy] || {};
  const displayUsername = adCreatorProfile.username || "Unknown User";
  const displayProfileImage = adCreatorProfile.photoURL || adCreatorProfile.profileImage || defaultAvatar;
  const displayOnline = adCreatorProfile.online;
  const displayLastSeen = adCreatorProfile.lastSeen;

  // PERFORMANCE: Preload all images for instant swiping
  React.useEffect(() => {
    if (photos && photos.length > 1 && !imagesPreloaded) {
      // Preload adjacent images for smooth transitions
      const preloadImages = [];
      photos.forEach((photoUrl, index) => {
        const img = new Image();
        img.src = photoUrl;
        preloadImages.push(img);
      });
      setImagesPreloaded(true);
    }
  }, [photos, imagesPreloaded]);

  let distanceText = "Distance away: --";
  if (profile && profile.latitude && profile.longitude && latitude && longitude) {
    const distance = getDistanceKm(profile.latitude, profile.longitude, latitude, longitude);
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
    <div onClick={() => navigate(`/ad-detail/${ad.id}`)} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 p-3 border-b border-gray-100">
        <div className="relative flex-shrink-0">
          <img
            src={displayProfileImage}
            alt={displayUsername}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => { e.target.src = defaultAvatar; }}
            crossOrigin="anonymous"
          />
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
      </div>

      {photos && photos.length > 0 && (
        <div className="relative w-full h-56 md:h-72 bg-gray-100 overflow-hidden">
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
        </div>
      )}

      <div className="p-3">
        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{title}</h4>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium">#{tag}</span>
            ))}
            {tags.length > 3 && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">+{tags.length - 3}</span>}
          </div>
        )}

        {location && (location.area || location.landmark || location.city || location.pincode) && (
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
      </div>
    </div>
  );
}

// Sort Dropdown Component
function SortDropdown({ sortBy, setSortBy, showSort, setShowSort }) {
  const sortOptions = [
    { value: "distance-low-high", label: "Distance: Near to Far" },
    { value: "distance-high-low", label: "Distance: Far to Near" },
    { value: "rating-low-high", label: "Rating: Low to High" },
    { value: "rating-high-low", label: "Rating: High to Low" },
    { value: "random", label: "Random" }
  ];

  const handleSortSelect = (value) => {
    setSortBy(value);
    setShowSort(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSort(!showSort);
          }}
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-3 py-2 border border-gray-300 rounded-lg transition-colors text-sm"
        >
          Sort <FiChevronDown />
        </button>

        {showSort && (
          <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-48 py-1">
            {sortOptions.map(option => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSortSelect(option.value);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm transition-colors ${sortBy === option.value ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showSort && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSort(false)}
        />
      )}
    </>
  );
}

// --- Main Ads Component ---
function FilterModal({ isOpen, onClose, filters, setFilters, applyFilters }) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
    }
  }, [isOpen, filters]);

  const handleApply = () => {
    setFilters(localFilters);
    applyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      distance: { min: 0, max: null },
      distanceUnit: 'km',
      rating: { min: 0, max: 5 },
      onlineStatus: "all",
      area: "",
      city: "",
      landmark: "",
      pincode: "",
      tags: ""
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
    applyFilters(resetFilters);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Filter Ads</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <FiX size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-700">Distance Range</h3>
              <select
                className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={localFilters.distanceUnit || 'km'}
                onChange={(e) => setLocalFilters({ ...localFilters, distanceUnit: e.target.value })}
              >
                <option value="km">Kilometers (km)</option>
                <option value="m">Meters (m)</option>
              </select>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Minimum ({localFilters.distanceUnit || 'km'})</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.distance.min || ""}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    distance: { ...localFilters.distance, min: e.target.value ? Number(e.target.value) : 0 }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Maximum ({localFilters.distanceUnit || 'km'})</label>
                <input
                  type="number"
                  placeholder="No limit"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.distance.max || ""}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    distance: { ...localFilters.distance, max: e.target.value ? Number(e.target.value) : null }
                  })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3 text-gray-700">Rating</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Minimum</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.rating.min}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    rating: { ...localFilters.rating, min: Number(e.target.value) }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Maximum</label>
                <input
                  type="number"
                  placeholder="5"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.rating.max}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    rating: { ...localFilters.rating, max: Number(e.target.value) }
                  })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3 text-gray-700">Online Status</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.onlineStatus}
              onChange={(e) => setLocalFilters({ ...localFilters, onlineStatus: e.target.value })}
            >
              <option value="all">All Ads</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>

          <div>
            <h3 className="font-medium mb-3 text-gray-700">Location Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Area (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Koramangala, HSR Layout"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.area}
                  onChange={(e) => setLocalFilters({ ...localFilters, area: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">City (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Bangalore, Mumbai"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.city}
                  onChange={(e) => setLocalFilters({ ...localFilters, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Landmark (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Near Metro, Opposite Mall"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.landmark}
                  onChange={(e) => setLocalFilters({ ...localFilters, landmark: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Pincode (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., 560034, 560102"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.pincode}
                  onChange={(e) => setLocalFilters({ ...localFilters, pincode: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3 text-gray-700">Tags</h3>
            <input
              type="text"
              placeholder="e.g., Electronics, Furniture (comma separated)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.tags || ""}
              onChange={(e) => setLocalFilters({ ...localFilters, tags: e.target.value })}
            />
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 font-medium"
          >
            Reset All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
// --- Main Ads Component ---
export default function Ads() {
  const [ads, setAds] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [profile, setProfile] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [filters, setFilters] = useState({
    distance: { min: 0, max: null },
    distanceUnit: 'km',
    rating: { min: 0, max: 5 },
    onlineStatus: "all",
    area: "",
    city: "",
    landmark: "",
    pincode: "",
    tags: ""
  });
  const [sortBy, setSortBy] = useState("distance-low-high");
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();

  // 1. Authentication & Current User Profile
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        // Listen to current user profile in real-time
        const profileRef = doc(db, 'profiles', user.uid);
        const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        }, (error) => {
          console.error("Error listening to user profile:", error);
        });

        return () => unsubscribeProfile();
      } else {
        setCurrentUserId(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Fetch Ads (Real-time) and their Creator Profiles
  useEffect(() => {
    const adsQuery = query(collection(db, "ads"));
    let creatorUnsubs = {};

    const unsubscribeAds = onSnapshot(adsQuery, (snapshot) => {
      const adsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAds(adsData);

      // Fetch creator profiles
      const creatorIds = Array.from(new Set(adsData.map(ad => ad.createdBy))).filter(Boolean);

      creatorIds.forEach(creatorId => {
        // Only start a new listener if we don't already have one for this creator
        if (!creatorUnsubs[creatorId]) {
          creatorUnsubs[creatorId] = onSnapshot(doc(db, 'profiles', creatorId), (profileSnap) => {
            if (profileSnap.exists()) {
              setUserProfiles(prev => ({
                ...prev,
                [creatorId]: profileSnap.data()
              }));
            }
          });
        }
      });

      setLoading(false);
    }, (error) => {
      console.error("Error fetching ads:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeAds();
      // Clean up all creator profile listeners
      Object.values(creatorUnsubs).forEach(unsub => unsub());
    };
  }, [currentUserId]);

  // 3. Prepare ads for advanced search with Fuse.js
  const searchableAds = useMemo(() => {
    return ads.map(ad => {
      const creatorProfile = userProfiles[ad.createdBy] || {};
      return prepareAdForSearch(ad, creatorProfile);
    });
  }, [ads, userProfiles]);

  // 4. Build Fuse.js search index with GOOGLE-LIKE configuration
  const adFuseIndex = useMemo(() => {
    if (searchableAds.length === 0) return null;
    return buildFuseIndex(searchableAds, {
      keys: getAdSearchKeys(),
      // Use default optimized config (threshold: 0.2, distance: 200, minMatchCharLength: 1)
    });
  }, [searchableAds]);

  const applyFilters = () => { };

  const filteredAds = useMemo(() => {
    let result = searchableAds;

    // Apply advanced search using Fuse.js if search query exists
    if (searchValue.trim() && adFuseIndex) {
      let searchResults = performSearch(adFuseIndex, searchValue, {
        expandSynonyms: true,
        maxResults: 500, // INCREASED: Show ALL results
        // Use default minScore: 1.0 for Google-like behavior
      });

      if (searchResults && searchResults.length > 0) {
        // RE-RANK RESULTS BY RELEVANCE (exact prefix matches first)
        searchResults = reRankByRelevance(searchResults, searchValue);
        
        const searchIds = new Set(searchResults.map(r => r.item.id));
        result = result.filter(ad => {
          if (ad.status === "expired") return false;
          return searchIds.has(ad.id);
        });
      } else {
        // No results from search
        result = [];
      }
    } else {
      // No search query, just filter out expired
      result = result.filter(ad => ad.status !== "expired");
    }

    // Distance filter - ONLY APPLY IF USER SETS FILTERS (not during search)
    if (!searchValue.trim()) {
      if (profile && profile.latitude && profile.longitude) {
        result = result.filter(ad => {
          if (!ad.latitude || !ad.longitude) return true;
          const distance = getDistanceKm(profile.latitude, profile.longitude, ad.latitude, ad.longitude);
          if (distance === null) return true;

          let minDistanceKm = filters.distance.min || 0;
          let maxDistanceKm = filters.distance.max;

          if (filters.distanceUnit === 'm') {
            minDistanceKm = minDistanceKm / 1000;
            if (maxDistanceKm) maxDistanceKm = maxDistanceKm / 1000;
          }

          const meetsMin = filters.distance.min === 0 || distance >= minDistanceKm;
          const meetsMax = !filters.distance.max || distance <= maxDistanceKm;
          return meetsMin && meetsMax;
        });
      }
    }
    // WHEN SEARCHING: Show ALL results regardless of distance

    result = result.filter(ad => {
      const rating = ad.rating || 0;
      return rating >= filters.rating.min && rating <= filters.rating.max;
    });

    if (filters.onlineStatus !== "all") {
      result = result.filter(ad => {
        const adCreatorProfile = userProfiles[ad.createdBy] || {};
        const isOnline = isUserOnline(ad.createdBy, currentUserId, adCreatorProfile.online, adCreatorProfile.lastSeen);
        return filters.onlineStatus === "online" ? isOnline : !isOnline;
      });
    }

    const areaFilters = filters.area ? filters.area.split(',').map(a => a.trim().toLowerCase()).filter(a => a) : [];
    const cityFilters = filters.city ? filters.city.split(',').map(c => c.trim().toLowerCase()).filter(c => c) : [];
    const landmarkFilters = filters.landmark ? filters.landmark.split(',').map(l => l.trim().toLowerCase()).filter(l => l) : [];
    const pincodeFilters = filters.pincode ? filters.pincode.split(',').map(p => p.trim()).filter(p => p) : [];

    result = result.filter(ad => {
      const matchesArea = !filters.area || areaFilters.some(area =>
        ad.location?.area?.toLowerCase().includes(area)
      );

      const matchesCity = !filters.city || cityFilters.some(city =>
        ad.location?.city?.toLowerCase().includes(city)
      );

      const matchesLandmark = !filters.landmark || landmarkFilters.some(landmark =>
        ad.location?.landmark?.toLowerCase().includes(landmark)
      );

      const matchesPincode = !filters.pincode || pincodeFilters.some(pincode =>
        ad.location?.pincode?.includes(pincode)
      );

      return matchesArea && matchesCity && matchesLandmark && matchesPincode;
    });

    const tagsFilters = filters.tags ? filters.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];
    result = result.filter(ad => !filters.tags || tagsFilters.some(tag => (ad.tags || []).some(wt => wt.toLowerCase().includes(tag))));

    result.sort((a, b) => {
      switch (sortBy) {
        case "distance-low-high":
          if (!profile) return 0;
          const distA = getDistanceKm(profile.latitude, profile.longitude, a.latitude, a.longitude) || Infinity;
          const distB = getDistanceKm(profile.latitude, profile.longitude, b.latitude, b.longitude) || Infinity;
          return distA - distB;
        case "distance-high-low":
          if (!profile) return 0;
          const distA2 = getDistanceKm(profile.latitude, profile.longitude, a.latitude, a.longitude) || 0;
          const distB2 = getDistanceKm(profile.latitude, profile.longitude, b.latitude, b.longitude) || 0;
          return distB2 - distA2;
        case "rating-low-high":
          return (a.rating || 0) - (b.rating || 0);
        case "rating-high-low":
          return (b.rating || 0) - (a.rating || 0);
        case "random":
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });

    return result;
  }, [searchableAds, adFuseIndex, searchValue, filters, sortBy, profile, userProfiles, currentUserId]);

  const hasActiveFilters = filters.distance.min > 0 || filters.distance.max || filters.rating.min > 0 || filters.rating.max < 5 || filters.onlineStatus !== "all" || filters.area || filters.city || filters.landmark || filters.pincode || filters.tags;

  return (
    <Layout
      title="Servepure Ads"
      activeTab="ads"
      headerExtra={
        <>
          <div className="relative flex-grow">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder="Search ads, tags, location..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className={`p-2.5 rounded-lg border transition-colors ${hasActiveFilters ? "text-blue-600 bg-blue-50 border-blue-200" : "text-gray-600 border-gray-300 hover:border-gray-400"}`}
          >
            <FiFilter size={20} />
          </button>
          <SortDropdown
            sortBy={sortBy}
            setSortBy={setSortBy}
            showSort={showSort}
            setShowSort={setShowSort}
          />
        </>
      }
      subHeader={
        hasActiveFilters && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-blue-700 font-medium">Active Filters:</span>
              {filters.distance.min > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Min {filters.distance.min}{filters.distanceUnit}
                </span>
              )}
              {filters.distance.max && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Max {filters.distance.max}{filters.distanceUnit}
                </span>
              )}
              {filters.rating.min > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Min {filters.rating.min}★
                </span>
              )}
              {filters.rating.max < 5 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Max {filters.rating.max}★
                </span>
              )}
              {filters.onlineStatus !== "all" && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  {filters.onlineStatus === "online" ? "Online Only" : "Offline Only"}
                </span>
              )}
              {filters.area && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Area: {filters.area}
                </span>
              )}
              {filters.city && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  City: {filters.city}
                </span>
              )}
              {filters.landmark && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Landmark: {filters.landmark}
                </span>
              )}
              {filters.pincode && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Pincode: {filters.pincode}
                </span>
              )}
              {filters.tags && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Tags: {filters.tags}
                </span>
              )}
              <button
                onClick={() => setFilters({ distance: { min: 0, max: null }, distanceUnit: 'km', rating: { min: 0, max: 5 }, onlineStatus: "all", area: "", city: "", landmark: "", pincode: "", tags: "" })}
                className="text-red-500 text-xs hover:text-red-700 font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="p-4 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No ads found</p>
          </div>
        ) : (
          filteredAds.map(ad => (
            <AdCard
              key={ad.id}
              ad={ad}
              profile={profile}
              userProfiles={userProfiles}
              currentUserId={currentUserId}
              navigate={navigate}
            />
          ))
        )}
      </div>

      <button
        onClick={() => navigate('/add-ads')}
        className="fixed bottom-20 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 z-10"
      >
        <FiPlus size={24} />
      </button>

      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        applyFilters={applyFilters}
      />
    </Layout>
  );
}