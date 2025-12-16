import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import {
  FiFilter,
  FiChevronDown,
  FiStar,
  FiBell,
  FiSettings,
  FiUser,
  FiPlus,
  FiList,
  FiGrid,
  FiMessageCircle,
  FiArrowLeft,
} from "react-icons/fi";

// Calculate Haversine distance in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const lat1Num = parseFloat(lat1);
  const lon1Num = parseFloat(lon1);
  const lat2Num = parseFloat(lat2);
  const lon2Num = parseFloat(lon2);
  
  if (isNaN(lat1Num) || isNaN(lon1Num) || isNaN(lat2Num) || isNaN(lon2Num)) {
    return null;
  }
  
  const R = 6371;
  const dLat = (lat2Num - lat1Num) * Math.PI / 180;
  const dLon = (lon2Num - lon1Num) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1Num * Math.PI / 180) * Math.cos(lat2Num * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

// Format last seen time
function formatLastSeen(lastSeen) {
  if (!lastSeen) return "Never online";
  
  try {
    let date;
    if (lastSeen.toDate) {
      date = lastSeen.toDate();
    } else if (lastSeen.seconds) {
      date = new Date(lastSeen.seconds * 1000);
    } else {
      date = new Date(lastSeen);
    }

    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch (error) {
    console.error("Error formatting last seen:", error);
    return "Unknown";
  }
}

// Check if user is online with 30-second buffer for offline detection
function isUserOnline(userId, currentUserId, online, lastSeen) {
  // If it's the current user viewing their own post, they are always online
  if (userId === currentUserId) return true;
  
  // If online status is explicitly true, user is online
  if (online === true) {
    // Check if lastSeen is within 30 seconds to confirm they're actually online
    if (!lastSeen) return true;
    
    try {
      let date;
      if (lastSeen.toDate) {
        date = lastSeen.toDate();
      } else if (lastSeen.seconds) {
        date = new Date(lastSeen.seconds * 1000);
      } else {
        date = new Date(lastSeen);
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      // Consider online only if last seen within 5 seconds
      return diffMs < 5000;
    } catch (error) {
      return true; // Fallback to online status
    }
  }
  
  // If online status is explicitly false, user is offline
  if (online === false) return false;
  
  // If no last seen data, consider offline
  if (!lastSeen) return false;
  
  try {
    let date;
    if (lastSeen.toDate) {
      date = lastSeen.toDate();
    } else if (lastSeen.seconds) {
      date = new Date(lastSeen.seconds * 1000);
    } else {
      date = new Date(lastSeen);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Consider online if last seen within 5 seconds
    return diffMs < 5000;
  } catch (error) {
    return false;
  }
}

function AdPost({ ad, profile, userProfiles, currentUserId, navigate }) {
  const {
    username,
    profileImage,
    photos = [],
    title,
    rating = 0,
    location = {},
    tags = [],
    latitude,
    longitude,
    createdBy,
    status,
  } = ad;

  // Get the profile data for the ad creator
  const adCreatorProfile = userProfiles[createdBy] || {};
  
  // Use profile data from userProfiles if available, otherwise use ad data
  const displayUsername = adCreatorProfile.username || username || "Unknown User";
  const displayProfileImage = adCreatorProfile.photoURL || adCreatorProfile.profileImage || profileImage;
  const displayOnline = adCreatorProfile.online;
  const displayLastSeen = adCreatorProfile.lastSeen;

  // Calculate distance
  let distanceText = "-- away";
  
  if (profile && profile.latitude && profile.longitude && latitude && longitude) {
    const distance = getDistanceKm(
      profile.latitude, 
      profile.longitude, 
      latitude, 
      longitude
    );
    
    if (distance !== null && !isNaN(distance)) {
      distanceText = distance < 1 ? 
        `${Math.round(distance * 1000)}m away` : 
        `${distance.toFixed(1)}km away`;
    }
  }

  // Check online status
  const isOnline = isUserOnline(createdBy, currentUserId, displayOnline, displayLastSeen);
  const statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
  const statusColor = isOnline ? "text-green-500" : "text-gray-400";

  return (
    <article
      className="border rounded-lg shadow bg-white mb-6 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate("/ad-detail/" + ad.id)}
      style={{ minHeight: 420, overflow: "hidden", paddingBottom: 8 }}
    >
      <header className="flex justify-between items-center p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="relative">
            {displayProfileImage ? (
              <img
                src={displayProfileImage}
                alt={displayUsername}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <FiUser size={16} className="text-gray-600" />
              </div>
            )}
            {/* Online status indicator */}
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">{displayUsername}</p>
            <h3 className="text-md font-medium">{title || "No Title"}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1 text-yellow-500 font-bold text-base">
          <FiStar size={18} />
          <span>{rating.toFixed(1)}</span>
        </div>
      </header>
      
      <div className="relative w-full h-80 bg-gray-100 flex items-center justify-center">
        {photos.length > 0 ? (
          <img
            src={photos[0]}
            alt="Ad"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-gray-400 text-center">
            <div className="text-4xl mb-2">📷</div>
            <div>No photo</div>
          </div>
        )}
      </div>
      
      <div className="p-3">
        <p className="text-gray-700 text-sm">
          {location?.area || "Unknown Area"}, {location?.city || "Unknown City"}
        </p>
        <div className="flex flex-wrap gap-2 my-2">
          {tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
              #{tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
              +{tags.length - 3} more
            </span>
          )}
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
          <span>{distanceText}</span>
          <div className="flex items-center gap-2">
            {status && status !== "active" && (
              <span className="text-red-500">{status}</span>
            )}
            <span className={`${statusColor} font-medium`}>
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

// Filter Modal Component
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
      rating: { min: 0, max: 5 },
      onlineStatus: "all",
      searchLocation: "",
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
    applyFilters(resetFilters);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center p-4 border-b">
          <button 
            onClick={onClose}
            className="p-2 mr-2 hover:bg-gray-100 rounded-full"
          >
            <FiArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold">Filter Ads</h2>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="font-medium mb-3 text-gray-700">Distance Range (km)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Minimum</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.distance.min || ""}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    distance: { ...localFilters.distance, min: e.target.value ? Number(e.target.value) : 0 }
                  })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Maximum</label>
                <input
                  type="number"
                  placeholder="No limit"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.onlineStatus}
              onChange={(e) => setLocalFilters({ ...localFilters, onlineStatus: e.target.value })}
            >
              <option value="all">All Users</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>

          <div>
            <h3 className="font-medium mb-3 text-gray-700">Location Search</h3>
            <input
              type="text"
              placeholder="Search by city or area..."
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.searchLocation}
              onChange={(e) => setLocalFilters({ ...localFilters, searchLocation: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={handleReset}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-3 hover:bg-gray-100 font-medium"
          >
            Reset All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

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
    rating: { min: 0, max: 5 },
    onlineStatus: "all",
    searchLocation: "",
  });
  const [sortBy, setSortBy] = useState("distance-low-high");
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();

  // Get user authentication
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User authenticated:", user.uid);
        setCurrentUserId(user.uid);
      } else {
        console.log("No user authenticated");
        setCurrentUserId(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch current user's profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUserId) return;
      
      try {
        console.log("Fetching profile for user:", currentUserId);
        const profileDoc = await getDoc(doc(db, 'profiles', currentUserId));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          console.log("Current user profile:", profileData);
          setProfile(profileData);
        } else {
          console.log("No profile found for user:", currentUserId);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [currentUserId]);

  // Fetch ads and profiles with efficient real-time updates
  useEffect(() => {
    const q = query(collection(db, "ads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const now = new Date();
        const adList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(
            (ad) =>
              ad.enabled !== false &&
              (!ad.expiry || (ad.expiry.toDate && ad.expiry.toDate().getTime() > now.getTime()))
          );
        console.log("Loaded ads:", adList.length);
        setAds(adList);

        // Get unique creator IDs
        const creatorIds = Array.from(new Set(adList.map(ad => ad.createdBy))).filter(Boolean);
        
        console.log("Setting up profile listeners for:", creatorIds);
        
        // Set up real-time listeners for each creator profile
        creatorIds.forEach(creatorId => {
          const unsubscribeProfile = onSnapshot(doc(db, 'profiles', creatorId), (profileSnap) => {
            if (profileSnap.exists()) {
              const profileData = profileSnap.data();
              
              setUserProfiles(prev => ({
                ...prev,
                [creatorId]: profileData
              }));
            }
          });
          
          return unsubscribeProfile;
        });
      }, 
      (err) => {
        console.error("Error loading ads:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Calculate distance for each ad
  const adsWithDistance = useCallback(() => {
    return ads.map(ad => {
      let distance = null;
      
      if (profile && profile.latitude && profile.longitude && ad.latitude && ad.longitude) {
        distance = getDistanceKm(
          profile.latitude,
          profile.longitude,
          ad.latitude,
          ad.longitude
        );
      }
      
      return { ...ad, distance };
    });
  }, [ads, profile]);

  // Apply search, filters and sorting
  const displayedAds = useCallback(() => {
    const filteredAds = adsWithDistance().filter(ad => {
      const searchLower = searchValue.toLowerCase();
      const matchesSearch = searchValue === "" ||
        ad.username?.toLowerCase().includes(searchLower) ||
        ad.title?.toLowerCase().includes(searchLower) ||
        ad.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        ad.location?.city?.toLowerCase().includes(searchLower) ||
        ad.location?.area?.toLowerCase().includes(searchLower);

      const distance = ad.distance;
      const matchesDistance = 
        (!filters.distance.min || distance === null || distance >= filters.distance.min) &&
        (!filters.distance.max || distance === null || distance <= filters.distance.max);

      const rating = ad.rating || 0;
      const matchesRating = 
        rating >= filters.rating.min && 
        rating <= filters.rating.max;

      // Get the creator's profile for online status check
      const creatorProfile = userProfiles[ad.createdBy] || {};
      const isOnline = isUserOnline(ad.createdBy, currentUserId, creatorProfile.online, creatorProfile.lastSeen);
      const matchesOnlineStatus = 
        filters.onlineStatus === "all" ||
        (filters.onlineStatus === "online" && isOnline) ||
        (filters.onlineStatus === "offline" && !isOnline);

      const matchesLocation = !filters.searchLocation ||
        ad.location?.city?.toLowerCase().includes(filters.searchLocation.toLowerCase()) ||
        ad.location?.area?.toLowerCase().includes(filters.searchLocation.toLowerCase());

      return matchesSearch && matchesDistance && matchesRating && 
             matchesOnlineStatus && matchesLocation;
    });

    // Sort the filtered ads
    return filteredAds.sort((a, b) => {
      switch (sortBy) {
        case "distance-low-high":
          return (a.distance || Infinity) - (b.distance || Infinity);
        case "distance-high-low":
          return (b.distance || -Infinity) - (a.distance || -Infinity);
        case "rating-low-high":
          return (a.rating || 0) - (b.rating || 0);
        case "rating-high-low":
          return (b.rating || 0) - (a.rating || 0);
        case "random":
          return Math.random() - 0.5;
        default:
          return (a.distance || Infinity) - (b.distance || Infinity);
      }
    });
  }, [adsWithDistance, searchValue, filters, userProfiles, currentUserId, sortBy]);

  const currentPath = window.location.pathname;

  return (
    <div className="flex flex-col min-h-screen bg-white" style={{ maxWidth: 480, margin: "0 auto" }}>
      
      <header className="flex flex-col px-3 py-2 border-b bg-white shadow sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-bold text-xl text-blue-600">Servepure Ads</h1>
          <div className="flex items-center space-x-4">
            <button className="hover:text-blue-600">
              <FiStar size={22} />
            </button>
            <button className="hover:text-blue-600">
              <FiBell size={22} />
            </button>
            <button className="hover:text-blue-600">
              <FiSettings size={22} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <input
            type="search"
            placeholder="Search by username, title, tags, location..."
            className="flex-grow border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <button 
            onClick={() => setShowFilters(true)}
            className={`p-2 rounded-lg border ${
              filters.searchLocation || 
              filters.distance.min > 0 || 
              filters.distance.max || 
              filters.rating.min > 0 || 
              filters.rating.max < 5 || 
              filters.onlineStatus !== "all" 
                ? "text-blue-600 bg-blue-50 border-blue-200" 
                : "text-gray-600 border-gray-300"
            }`}
          >
            <FiFilter size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-3 py-2 border border-gray-300 rounded-lg"
            >
              Sort <FiChevronDown />
            </button>
            {showSort && (
              <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-48 py-1">
                {[
                  { value: "distance-low-high", label: "Distance: Near to Far" },
                  { value: "distance-high-low", label: "Distance: Far to Near" },
                  { value: "rating-low-high", label: "Rating: Low to High" },
                  { value: "rating-high-low", label: "Rating: High to Low" },
                  { value: "random", label: "Random" }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSort(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${
                      sortBy === option.value ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Active Filters Display */}
      {(filters.searchLocation || filters.distance.min > 0 || 
        filters.distance.max || filters.rating.min > 0 || filters.rating.max < 5 || 
        filters.onlineStatus !== "all") && (
        <div className="px-3 py-2 bg-blue-50 border-b">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-blue-700 font-medium">Active Filters:</span>
            {filters.distance.min > 0 && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                Min {filters.distance.min}km
              </span>
            )}
            {filters.distance.max && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                Max {filters.distance.max}km
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
            {filters.searchLocation && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                Location: {filters.searchLocation}
              </span>
            )}
            <button 
              onClick={() => setFilters({
                distance: { min: 0, max: null },
                rating: { min: 0, max: 5 },
                onlineStatus: "all",
                searchLocation: "",
              })}
              className="text-red-500 text-xs hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 p-2 pb-20">
        {loading ? (
          <div className="flex justify-center items-center mt-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : displayedAds().length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-lg">No ads found.</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedAds().map((ad) => (
              <AdPost 
                key={ad.id} 
                ad={ad} 
                profile={profile} 
                userProfiles={userProfiles}
                currentUserId={currentUserId}
                navigate={navigate} 
              />
            ))}
          </div>
        )}
      </main>

      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        applyFilters={(newFilters) => setFilters(newFilters)}
      />

      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={() => navigate("/add-ads")}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={24} />
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center py-2" 
           style={{ maxWidth: 480, margin: "0 auto" }}>
        {[
          { path: "/workers", icon: FiUser, label: "Workers" },
          { path: "/services", icon: FiList, label: "Services" },
          { path: "/ads", icon: FiGrid, label: "Ads" },
          { path: "/chats", icon: FiMessageCircle, label: "Chats" },
          { path: "/profile", icon: FiUser, label: "Profile" }
        ].map(({ path, icon: Icon, label }) => (
          <button 
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center ${currentPath === path ? "text-blue-600 font-bold" : "text-gray-400"}`}
          >
            <Icon size={24} />
            <span className="text-xs mt-1">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}