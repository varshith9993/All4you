import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { collection, query, onSnapshot, doc } from "firebase/firestore";
import { FiStar, FiMapPin, FiFilter, FiChevronDown, FiX, FiPlus, FiWifi, FiSearch } from "react-icons/fi";
import Layout from "../components/Layout";
import defaultAvatar from "../assets/images/default_profile.png";
import {  buildFuseIndex,
  performSearch,
  reRankByRelevance,
  getWorkerSearchKeys,
  prepareWorkerForSearch,
} from "../utils/searchEngine";

// --- Helper Functions ---

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
  if (userId === currentUserId) return true;
  if (online === true) {
    if (!lastSeen) return true;
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      return (new Date().getTime() - date.getTime()) < 5000;
    } catch (error) {
      return true;
    }
  }
  if (online === false) return false;
  if (!lastSeen) return false;
  try {
    let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
    return (new Date().getTime() - date.getTime()) < 5000;
  } catch (error) {
    return false;
  }
}

// --- Components ---

function FilterModal({ isOpen, onClose, filters, setFilters, applyFilters }) {
  const [localFilters, setLocalFilters] = useState(filters);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Filter Workers</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <FiX size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Distance Range */}
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

          {/* Rating */}
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

          {/* Online Status */}
          <div>
            <h3 className="font-medium mb-3 text-gray-700">Online Status</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.onlineStatus}
              onChange={(e) => setLocalFilters({ ...localFilters, onlineStatus: e.target.value })}
            >
              <option value="all">All Workers</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>

          {/* Location Filters */}
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

          {/* Tags Filter */}
          <div>
            <h3 className="font-medium mb-3 text-gray-700">Tags</h3>
            <input
              type="text"
              placeholder="e.g., Plumber, Electrician (comma separated)"
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

function WorkerCard({ worker, profile, userProfiles, currentUserId, navigate }) {
  const { title, rating = 0, location = {}, tags = [], latitude, longitude, createdBy, avatarUrl } = worker;
  const workerCreatorProfile = userProfiles[createdBy] || {};
  const displayUsername = workerCreatorProfile.username || "Unknown User";
  // Prioritize avatarUrl (worker specific image)
  const displayProfileImage = avatarUrl || workerCreatorProfile.photoURL || workerCreatorProfile.profileImage || defaultAvatar;
  const displayOnline = workerCreatorProfile.online;
  const displayLastSeen = workerCreatorProfile.lastSeen;

  let distanceText = "Distance away: --";
  if (profile && profile.latitude && profile.longitude && latitude && longitude) {
    const distance = getDistanceKm(profile.latitude, profile.longitude, latitude, longitude);
    if (distance !== null && !isNaN(distance)) {
      const distValue = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
      distanceText = `Distance away: ${distValue} away`;
    }
  }

  const isOnline = isUserOnline(createdBy, currentUserId, displayOnline, displayLastSeen);
  const statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
  const statusColor = isOnline ? "text-green-600" : "text-gray-500";

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate(`/worker-detail/${worker.id}`)}>
      <div className="flex items-start gap-3">
        {/* Left Column: Image & Rating */}
        <div className="flex flex-col items-center flex-shrink-0 w-16">
          <div className="relative mb-1.5">
            <img
              src={displayProfileImage}
              alt={displayUsername}
              className="w-14 h-14 rounded-full object-cover border-2 border-gray-300"
              onError={(e) => { e.target.src = defaultAvatar; }}
              crossOrigin="anonymous"
            />
            {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
          </div>
          <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
            <FiStar size={11} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[11px] font-semibold text-yellow-700">{rating.toFixed(1)}</span>
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
        </div>
      </div>
    </div>
  );
}

// Sort Dropdown Component - FIXED VERSION
function SortDropdown({ sortBy, setSortBy, showSort, setShowSort }) {
  const sortOptions = [
    { value: "distance-low-high", label: "Distance: Near to Far" },
    { value: "distance-high-low", label: "Distance: Far to Near" },
    { value: "rating-low-high", label: "Rating: Low to High" },
    { value: "rating-high-low", label: "Rating: High to Low" },
    { value: "random", label: "Random" }
  ];

  const handleSortSelect = (value) => {
    console.log("Sort selected:", value);
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

      {/* Close dropdown when clicking outside - FIXED POSITIONING */}
      {showSort && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            console.log("Closing dropdown via overlay");
            setShowSort(false);
          }}
        />
      )}
    </>
  );
}

// --- Main Component ---

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState("distance-low-high");
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
            setUserProfile(docSnap.data());
          }
          // We don't set loading false here because workers need to load too
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

  // 2. Fetch Workers (Real-time) and their Creator Profiles
  useEffect(() => {
    const q = query(collection(db, 'workers'));
    let creatorUnsubs = {};

    const unsubscribeWorkers = onSnapshot(q, (snapshot) => {
      const workerList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setWorkers(workerList);

      // Fetch creator profiles
      const creatorIds = Array.from(new Set(workerList.map(worker => worker.createdBy))).filter(Boolean);

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

      // Set loading to false once we have the workers
      // If we are logged in, we wait for both workers and (ideally) profile, 
      // but workers are the main content.
      setLoading(false);
    }, (error) => {
      console.error("Error loading workers:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeWorkers();
      // Clean up all creator profile listeners
      Object.values(creatorUnsubs).forEach(unsub => unsub());
    };
  }, [currentUserId]);

  // 3. Prepare workers for advanced search with Fuse.js
  const searchableWorkers = useMemo(() => {
    return workers.map(worker => {
      const creatorProfile = userProfiles[worker.createdBy] || {};
      return prepareWorkerForSearch(worker, creatorProfile);
    });
  }, [workers, userProfiles]);

  // 4. Build Fuse.js search index with GOOGLE-LIKE configuration
  const workerFuseIndex = useMemo(() => {
    if (searchableWorkers.length === 0) return null;
    return buildFuseIndex(searchableWorkers, {
      keys: getWorkerSearchKeys(),
      // Use default optimized config (threshold: 0.2, distance: 200, minMatchCharLength: 1)
    });
  }, [searchableWorkers]);

  // Process and display workers with filtering and sorting - ENHANCED WITH FUSE.JS
  const getDisplayedWorkers = () => {
    console.log("Processing workers with sort:", sortBy);

    // Calculate distances
    const workersWithDistance = searchableWorkers.map(worker => {
      let distance = null;
      if (userProfile && userProfile.latitude && userProfile.longitude && worker.latitude && worker.longitude) {
        distance = getDistanceKm(
          userProfile.latitude,
          userProfile.longitude,
          worker.latitude,
          worker.longitude
        );
      }
      return { ...worker, distance };
    });

    // Apply advanced search using Fuse.js if search query exists
    let searchFiltered = workersWithDistance;
    let searchScoreMap = new Map();

    if (searchValue.trim() && workerFuseIndex) {
      let searchResults = performSearch(workerFuseIndex, searchValue, {
        expandSynonyms: true,
        maxResults: 500, // INCREASED: Show ALL results
        // Use default minScore: 1.0 for Google-like behavior
      });

      if (searchResults && searchResults.length > 0) {
        // RE-RANK RESULTS BY RELEVANCE (exact prefix matches first)
        searchResults = reRankByRelevance(searchResults, searchValue);
        
        const searchIds = new Set(searchResults.map(r => r.item.id));
        searchFiltered = workersWithDistance.filter(w => searchIds.has(w.id));
        
        // Store CUSTOM search scores for ranking
        searchResults.forEach(r => {
          searchScoreMap.set(r.item.id, r.customScore || 0);
        });
      } else {
        // No results from search, return empty
        searchFiltered = [];
      }
    }

    // Apply additional filters
    const filteredWorkers = searchFiltered.filter(worker => {
      const creatorProfile = userProfiles[worker.createdBy] || {};

      // Status filter - only show active posts
      if (worker.status && worker.status !== "active") return false;

      // Distance filter - ONLY APPLY IF USER SETS FILTERS (not during search)
      if (!searchValue.trim()) {
        let minDistanceKm = filters.distance.min || 0;
        let maxDistanceKm = filters.distance.max;
        if (filters.distanceUnit === 'm') {
          minDistanceKm = minDistanceKm / 1000;
          if (maxDistanceKm) maxDistanceKm = maxDistanceKm / 1000;
        }

        const distance = worker.distance;
        if (filters.distance.min && (distance === null || distance < minDistanceKm)) return false;
        if (filters.distance.max && (distance === null || distance > maxDistanceKm)) return false;
      }
      // WHEN SEARCHING: Show ALL results regardless of distance

      // Rating filter
      const rating = worker.rating || 0;
      if (rating < filters.rating.min) return false;
      if (rating > filters.rating.max) return false;

      // Online status filter
      const isOnline = isUserOnline(worker.createdBy, currentUserId, creatorProfile.online, creatorProfile.lastSeen);
      if (filters.onlineStatus === "online" && !isOnline) return false;
      if (filters.onlineStatus === "offline" && isOnline) return false;

      // Location filters
      const checkLocationFilter = (filterValue, workerValue) => {
        if (!filterValue) return true;
        const filterValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(v => v);
        return filterValues.some(fv => workerValue?.toLowerCase().includes(fv));
      };

      if (!checkLocationFilter(filters.area, worker.location?.area)) return false;
      if (!checkLocationFilter(filters.city, worker.location?.city)) return false;
      if (!checkLocationFilter(filters.landmark, worker.location?.landmark)) return false;
      if (!checkLocationFilter(filters.pincode, worker.location?.pincode)) return false;

      // Tags filter
      if (filters.tags) {
        const tagFilters = filters.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        const hasMatchingTag = tagFilters.some(tag =>
          (worker.tags || []).some(wt => wt.toLowerCase().includes(tag))
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });

    // Apply sorting
    const sortedWorkers = [...filteredWorkers].sort((a, b) => {
      // IF SEARCHING: Sort by relevance score (custom score)
      if (searchValue.trim() && searchScoreMap.size > 0) {
        const scoreA = searchScoreMap.get(a.id) || 0;
        const scoreB = searchScoreMap.get(b.id) || 0;
        return scoreB - scoreA; // Higher score first
      }
      
      // OTHERWISE: Use user-selected sorting
      const distA = a.distance === null ? Infinity : a.distance;
      const distB = b.distance === null ? Infinity : b.distance;

      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;

      console.log(`Sorting: ${sortBy}, A: ${distA}, B: ${distB}`);

      switch (sortBy) {
        case "distance-low-high":
          return distA - distB;
        case "distance-high-low":
          return distB - distA;
        case "rating-low-high":
          return ratingA - ratingB;
        case "rating-high-low":
          return ratingB - ratingA;
        case "random":
          return Math.random() - 0.5;
        default:
          return distA - distB;
      }
    });

    console.log(`Sorted ${sortedWorkers.length} workers with sort: ${sortBy}`);
    return sortedWorkers;
  };

  const hasActiveFilters =
    filters.distance.min > 0 ||
    filters.distance.max !== null ||
    filters.rating.min > 0 ||
    filters.rating.max < 5 ||
    filters.onlineStatus !== "all" ||
    filters.area ||
    filters.city ||
    filters.landmark ||
    filters.pincode ||
    filters.tags;

  if (loading) {
    return (
      <Layout title="ServePure Workers" activeTab="workers">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  const displayedWorkers = getDisplayedWorkers();

  return (
    <Layout
      title="Servepure Workers"
      activeTab="workers"
      headerExtra={
        <>
          <div className="relative flex-grow">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder="Search workers, skills, location..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(true)}
            className={`p-3 rounded-lg border transition-colors ${hasActiveFilters
              ? "text-blue-600 bg-blue-50 border-blue-200"
              : "text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
          >
            <FiFilter size={20} />
          </button>

          {/* Sort Dropdown - FIXED */}
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
                onClick={() => setFilters({
                  distance: { min: 0, max: null },
                  distanceUnit: 'km',
                  rating: { min: 0, max: 5 },
                  onlineStatus: "all",
                  area: "",
                  city: "",
                  landmark: "",
                  pincode: "",
                  tags: ""
                })}
                className="text-red-500 text-xs hover:text-red-700 font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )
      }
    >
      {/* Main Content */}
      <div className="px-4 py-3 pb-20">
        {displayedWorkers.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-lg">No workers found.</p>
            <p className="text-sm mt-2">
              {workers.length === 0
                ? "No workers available in the database."
                : "Try adjusting your search or filters"}
            </p>
            {workers.length === 0 && (
              <div className="mt-6">
                <button
                  onClick={() => navigate("/add-workers")}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Worker
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedWorkers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                profile={userProfile}
                userProfiles={userProfiles}
                currentUserId={currentUserId}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        applyFilters={(newFilters) => setFilters(newFilters)}
      />

      {/* Add Worker Floating Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={() => navigate("/add-workers")}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors active:bg-blue-800 active:scale-95"
          aria-label="Add Worker"
        >
          <FiPlus size={24} />
        </button>
      </div>

      {/* Close sort dropdown when clicking outside */}
      {showSort && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowSort(false)}
        />
      )}
    </Layout>
  );
}