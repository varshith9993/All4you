import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiWifi, FiFilter, FiChevronDown, FiX, FiPlus, FiStar, FiSearch, FiLoader } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.svg";
import Layout from "../components/Layout";
import { useProfileCache } from "../contexts/ProfileCacheContext";
import { usePaginatedServices } from "../contexts/PaginatedDataCacheContext";
import { useDebounce } from "../hooks/useDebounce";
import {
  buildFuseIndex,
  performSearch,
  reRankByRelevance,
  getServiceSearchKeys,
  prepareServiceForSearch,
} from "../utils/searchEngine";
import { useSearchCache } from "../contexts/GlobalDataCacheContext";
import { formatExpiry } from "../utils/expiryUtils";

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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Num * Math.PI / 180) * Math.cos(lat2Num * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Format last seen time
function formatLastSeen(lastSeen) {
  if (!lastSeen) return "Never online";
  try {
    let date = lastSeen.toDate ? lastSeen.toDate() :
      lastSeen.seconds ? new Date(lastSeen.seconds * 1000) :
        new Date(lastSeen);

    const now = new Date();

    // Check if timestamp is in the future (invalid)
    if (date > now) {
      return "Last Seen: Unknown";
    }

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

// Check if user is online
function isUserOnline(userId, currentUserId, online, lastSeen) {
  // Current user is always shown as online
  if (userId === currentUserId) return true;

  // CRITICAL FIX: Check lastSeen timestamp first
  // If lastSeen is more than 5 minutes old, user is offline regardless of online field
  if (lastSeen) {
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      const minutesSinceLastSeen = (Date.now() - date.getTime()) / 60000;

      // If last seen more than 5 minutes ago, definitely offline
      if (minutesSinceLastSeen > 5) {
        return false;
      }

      // If last seen within 2 minutes, definitely online
      if (minutesSinceLastSeen < 2) {
        return true;
      }
    } catch (error) {
      console.error('Error checking lastSeen:', error);
    }
  }

  // Check the online field as secondary indicator
  if (online === true) return true;
  if (online === false) return false;

  // Fallback: if no lastSeen data, assume offline
  return false;
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
      distanceUnit: 'km',
      rating: { min: 0, max: 5 },
      onlineStatus: "all",
      area: "",
      city: "",
      landmark: "",
      pincode: "",
      country: "",
      tags: "",
      expiryType: "all",
      expiryDate: "",
      expiryTime: "",
      expiryDirection: "above"
    };
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
    applyFilters(resetFilters);
    onClose();
  };

  // Helper function to format current date and time for datetime-local input
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Filter Services</h2>
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
              <option value="all">All Users</option>
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
                  value={localFilters.landmark || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, landmark: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Pincode (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., 560034, 560102"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.pincode || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, pincode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Country (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g., India, USA"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localFilters.country || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, country: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          <div>
            <h3 className="font-medium mb-3 text-gray-700">Tags</h3>
            <input
              type="text"
              placeholder="e.g., Delivery, Repair (comma separated)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localFilters.tags || ""}
              onChange={(e) => setLocalFilters({ ...localFilters, tags: e.target.value })}
            />
          </div>

          {/* Expiry Filters */}
          <div>
            <h3 className="font-medium mb-3 text-gray-700">Expiry Filters</h3>
            <div className="space-y-4">
              {/* Expiry Type Filter */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">Show Posts With</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expiryType"
                      className="text-blue-600 focus:ring-blue-500"
                      value="all"
                      checked={localFilters.expiryType === "all"}
                      onChange={(e) => setLocalFilters({ ...localFilters, expiryType: e.target.value })}
                    />
                    <span className="text-sm text-gray-700">All expiry types</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expiryType"
                      className="text-blue-600 focus:ring-blue-500"
                      value="noExpiry"
                      checked={localFilters.expiryType === "noExpiry"}
                      onChange={(e) => setLocalFilters({ ...localFilters, expiryType: e.target.value })}
                    />
                    <span className="text-sm text-gray-700">Only "Expiry: NA" posts</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="expiryType"
                      className="text-blue-600 focus:ring-blue-500"
                      value="withExpiry"
                      checked={localFilters.expiryType === "withExpiry"}
                      onChange={(e) => setLocalFilters({ ...localFilters, expiryType: e.target.value })}
                    />
                    <span className="text-sm text-gray-700">Only posts with expiry dates</span>
                  </label>
                </div>
              </div>

              {/* Date & Time Filter - Only show for posts with expiry dates */}
              {(localFilters.expiryType === "all" || localFilters.expiryType === "withExpiry") && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Expiry Date & Time</label>

                  {/* Date & Time Input */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Select Date & Time</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={localFilters.expiryDate || ""}
                      onChange={(e) => setLocalFilters({ ...localFilters, expiryDate: e.target.value })}
                      min={getCurrentDateTime()}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Select both date and time for precise filtering
                    </p>
                  </div>

                  {/* Date Direction */}
                  {localFilters.expiryDate && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Show posts expiring</label>
                      <div className="flex gap-3">
                        <label className="flex items-center space-x-2 cursor-pointer flex-1">
                          <input
                            type="radio"
                            name="expiryDirection"
                            className="text-blue-600 focus:ring-blue-500"
                            value="above"
                            checked={localFilters.expiryDirection === "above"}
                            onChange={(e) => setLocalFilters({ ...localFilters, expiryDirection: e.target.value })}
                          />
                          <span className="text-sm text-gray-700">On or after this date & time</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer flex-1">
                          <input
                            type="radio"
                            name="expiryDirection"
                            className="text-blue-600 focus:ring-blue-500"
                            value="below"
                            checked={localFilters.expiryDirection === "below"}
                            onChange={(e) => setLocalFilters({ ...localFilters, expiryDirection: e.target.value })}
                          />
                          <span className="text-sm text-gray-700">On or before this date & time</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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

function ServiceCard({ service, profile, userProfiles, currentUserId, navigate }) {
  const { title, location = {}, tags = [], latitude, longitude, createdBy, profilePhotoUrl, type, serviceType, expiry, rating = 0 } = service;

  // Real-time expiry state
  const [expiryInfo, setExpiryInfo] = useState(() => formatExpiry(expiry));

  useEffect(() => {
    if (!expiry) return;

    const timer = setInterval(() => {
      setExpiryInfo(formatExpiry(expiry));
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [expiry]);

  // Get profile data with fallbacks - Now supports Denormalized 'author' object
  const getProfileData = () => {
    // 1. Use Denormalized Data (Best Case - 0 Reads)
    if (service.author) {
      return {
        username: service.author.username || "Unknown",
        photoURL: service.author.photoURL || service.author.profileImage || defaultAvatar,
        online: service.author.online,
        lastSeen: service.author.lastSeen,
        rating: service.rating || 0, // Service rating or author rating? Usually service rating is preferred here
        verified: service.author.verified
      };
    }

    // 2. Fallback to Fetched Profile (Legacy / Real-time update)
    const profile = userProfiles[createdBy];
    if (profile) {
      return profile;
    }

    // 3. Fallback to Service-level flat fields (Legacy Compatibility)
    if (profilePhotoUrl) {
      return {
        username: "Unknown User", // or fetch name?
        photoURL: profilePhotoUrl,
        online: false,
        lastSeen: null,
        rating: rating
      };
    }

    // 4. Loading / Unknown
    return {
      username: !createdBy ? "Unknown User" : "Loading...",
      photoURL: defaultAvatar,
      online: false,
      lastSeen: null,
      rating: 0
    };
  };

  const creatorProfile = getProfileData();

  // Merge Real-time Online Status if available
  // If we have a live profile from 'userProfiles', allow it to override the static 'author' status
  const realTimeProfile = userProfiles[createdBy];
  const displayUsername = creatorProfile.username;
  const displayProfileImage = creatorProfile.photoURL || creatorProfile.profileImage || defaultAvatar;

  // Use real-time status if available, otherwise fallback to snapshot
  const displayOnline = realTimeProfile?.online !== undefined ? realTimeProfile.online : creatorProfile.online;
  const displayLastSeen = realTimeProfile?.lastSeen !== undefined ? realTimeProfile.lastSeen : creatorProfile.lastSeen;

  const creatorRating = creatorProfile.rating || rating;

  // Determine type (providing/asking)
  const finalType = type || serviceType || "provide";
  const isProviding = finalType === "provide";

  let distanceText = "Distance away: --";
  if (profile && profile.latitude && profile.longitude && latitude && longitude) {
    const distance = getDistanceKm(profile.latitude, profile.longitude, latitude, longitude);
    if (distance !== null && !isNaN(distance)) {
      const distValue = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
      distanceText = `Distance away: ${distValue}`;
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

  const effectiveCurrentUserId = currentUserId || "";
  const isOnline = isUserOnline(createdBy, effectiveCurrentUserId, displayOnline, displayLastSeen);
  const statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
  const statusColor = isOnline ? "text-green-600" : "text-gray-500";

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate(`/service-detail/${service.id}`)}>
      <div className="flex items-start gap-3">
        {/* Left Column: Image & Type Badge */}
        <div className="flex flex-col items-center flex-shrink-0 w-16">
          <div className="relative mb-1.5">
            <img
              src={displayProfileImage}
              alt={displayUsername}
              className="w-14 h-14 rounded-full object-cover border-2 border-gray-300"
              onError={(e) => { e.target.src = defaultAvatar; }}
              crossOrigin="anonymous"
              loading="lazy"
            />
            {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
          </div>
          <div className={`flex items-center justify-center px-1.5 py-0.5 rounded border w-full mb-1 ${isProviding ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
            <span className="text-[9px] font-semibold uppercase">{isProviding ? "Providing" : "Asking"}</span>
          </div>
          <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
            <FiStar size={11} className="fill-yellow-400 text-yellow-400" />
            <span className="text-[11px] font-semibold text-yellow-700">{creatorRating.toFixed(1)}</span>
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
            {/* Expiry text on the right with animation for expiring soon */}
            {expiryText && (
              <span className={`${expiryColor} whitespace-nowrap font-medium ${isExpiringNow ? 'animate-pulse bg-red-100 px-1 rounded' : ''}`}>
                {expiryText}
              </span>
            )}
          </div>
        </div>
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
    { value: "expiry-soon-late", label: "Expiry: Soonest First" },
    { value: "expiry-late-soon", label: "Expiry: Latest First" },
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

      {/* Close dropdown when clicking outside */}
      {showSort && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSort(false)}
        />
      )}
    </>
  );
}

export default function Services() {
  // PAGINATION OPTIMIZATION: Use paginated data fetching
  // - Initial load: 15 documents (1 read)
  // - Page return: 0 reads if no changes
  // - Load more: 15 documents per scroll (1 read)
  const {
    services,
    loading: servicesLoading,
    loadingMore,
    hasMore,
    fetchServices,
    loadMoreServices,
    currentUserId,
    userProfile
  } = usePaginatedServices();

  const { searchStates, updateSearchState } = useSearchCache();

  const [searchValue, setSearchValue] = useState(searchStates.services.query);
  const debouncedSearchValue = useDebounce(searchValue, 1000);

  const [phase, setPhase] = useState("all");
  const [userProfiles, setUserProfiles] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState(searchStates.services.sortBy);
  const [filters, setFilters] = useState(searchStates.services.filters || {
    distance: { min: 0, max: null },
    distanceUnit: 'km',
    rating: { min: 0, max: 5 },
    onlineStatus: "all",
    area: "",
    city: "",
    landmark: "",
    pincode: "",
    country: "",
    tags: "",
    expiryType: "all",
    expiryDate: "",
    expiryDirection: "above"
  });

  // Sync search state to global cache
  useEffect(() => {
    updateSearchState('services', {
      query: searchValue,
      filters: filters,
      sortBy: sortBy
    });
  }, [searchValue, filters, sortBy, updateSearchState]);

  // Pagination display state (for client-side pagination of already-loaded data)
  // Normal browsing: 9 items per page
  // Search results: 9 items per page
  const [displayCount, setDisplayCount] = useState(9);
  const listContainerRef = useRef(null);

  // Determine page size based on search state
  const currentPageSize = 9;

  // Reset displayCount when search query changes
  useEffect(() => {
    setDisplayCount(currentPageSize);
  }, [debouncedSearchValue, currentPageSize]);

  // OPTIMIZATION: Debounce filters to reduce computation and potential Firestore calls
  // Filter updates only apply after the user stops interacting with filter inputs for 500ms (optimized from 1200ms)
  const debouncedFilters = useDebounce(filters, 500);

  const navigate = useNavigate();

  // OPTIMIZATION: Use ProfileCache for batch profile fetching
  const { fetchProfiles, getAllCachedProfiles, subscribeToOnlineStatus } = useProfileCache();

  // Data fetch when filters or sort change
  useEffect(() => {
    // Determine sort field from sortBy
    let sortField = 'createdAt';
    let sortDirection = 'desc';

    if (sortBy === 'rating-high-low') {
      sortField = 'rating';
      sortDirection = 'desc';
    } else if (sortBy === 'rating-low-high') {
      sortField = 'rating';
      sortDirection = 'asc';
    } else if (sortBy === 'expiry-soon-late') {
      sortField = 'expiry';
      sortDirection = 'asc';
    } else if (sortBy === 'expiry-late-soon') {
      sortField = 'expiry';
      sortDirection = 'desc';
    }

    // OPTIMIZATION: Context now handles smart change detection.
    fetchServices({
      sortField,
      sortDirection,
      forceRefresh: false
    });

    setDisplayCount(debouncedSearchValue.trim() ? 10 : 15);
  }, [debouncedFilters, sortBy, fetchServices, debouncedSearchValue]);

  // OPTIMIZATION: Batch fetch creator profiles when services data changes
  const fetchCreatorProfiles = useCallback(async (creatorIds) => {
    if (!creatorIds || creatorIds.length === 0) return;

    try {
      const profiles = await fetchProfiles(creatorIds);
      setUserProfiles(prev => ({ ...prev, ...profiles }));
    } catch (error) {
      console.error("Error batch fetching creator profiles:", error);
    }
  }, [fetchProfiles]);

  // Fetch profiles when services data changes (from global cache)
  useEffect(() => {
    if (services.length > 0) {
      // READ OPTIMIZATION: Only fetch profiles if 'author' data is missing from the service document
      // This logic ensures 0 extra reads for new posts created with the denormalized structure
      const creatorIds = Array.from(new Set(services.map(s => {
        if (s.author && s.author.username) return null; // Skip if we have author info
        return s.createdBy;
      }))).filter(Boolean);

      fetchCreatorProfiles(creatorIds);
    }
  }, [services, fetchCreatorProfiles]);

  // OPTIMIZATION: Subscribe to online status updates for real-time status display
  // This refreshes every 15 seconds to show accurate online/offline status
  useEffect(() => {
    if (services.length === 0) return;

    const creatorIds = Array.from(new Set(services.map(s => s.createdBy))).filter(Boolean);
    if (creatorIds.length === 0) return;

    const unsubscribe = subscribeToOnlineStatus(creatorIds, (updatedProfiles) => {
      setUserProfiles(prev => ({ ...prev, ...updatedProfiles }));
    });

    return () => unsubscribe();
  }, [services, subscribeToOnlineStatus]);

  // Sync with global profile cache updates
  useEffect(() => {
    const cachedProfiles = getAllCachedProfiles();
    if (Object.keys(cachedProfiles).length > 0) {
      setUserProfiles(prev => ({ ...prev, ...cachedProfiles }));
    }
  }, [getAllCachedProfiles]);

  // Use servicesLoading from global cache
  const loading = servicesLoading;

  const searchableServices = useMemo(() => {
    return services.map(service => {
      const creatorProfile = userProfiles[service.createdBy] || {};
      return prepareServiceForSearch(service, creatorProfile);
    });
  }, [services, userProfiles]);

  // 4. Build Fuse.js search index with GOOGLE-LIKE configuration
  const serviceFuseIndex = useMemo(() => {
    if (searchableServices.length === 0) return null;
    return buildFuseIndex(searchableServices, {
      keys: getServiceSearchKeys(),
      // Use default optimized config (threshold: 0.2, distance: 200, minMatchCharLength: 1)
    });
  }, [searchableServices]);

  // Process and display services with filtering and sorting - ENHANCED WITH FUSE.JS
  const displayedServices = useMemo(() => {
    // Calculate distances
    const servicesWithDistance = searchableServices.map(service => {
      let distance = null;
      if (userProfile && userProfile.latitude && userProfile.longitude && service.latitude && service.longitude) {
        distance = getDistanceKm(
          userProfile.latitude,
          userProfile.longitude,
          service.latitude,
          service.longitude
        );
      }
      return { ...service, distance };
    });

    // Apply advanced search using Fuse.js if search query exists
    let searchFiltered = servicesWithDistance;
    let searchScoreMap = new Map();

    if (debouncedSearchValue.trim() && serviceFuseIndex) {
      let searchResults = performSearch(serviceFuseIndex, debouncedSearchValue, {
        expandSynonyms: true,
        maxResults: 500, // INCREASED: Show ALL results
        // Use default minScore: 1.0 for Google-like behavior
      });

      if (searchResults && searchResults.length > 0) {
        // RE-RANK RESULTS BY RELEVANCE (exact prefix matches first)
        searchResults = reRankByRelevance(searchResults, debouncedSearchValue);

        const searchIds = new Set(searchResults.map(r => r.item.id));
        searchFiltered = servicesWithDistance.filter(s => searchIds.has(s.id));

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
    const filteredServices = searchFiltered.filter(service => {
      const now = new Date();
      const creatorProfile = userProfiles[service.createdBy] || {};

      // Check if post is expired by status
      if (service.status && service.status !== "active") return false;

      // Check if it's "Until I change" option
      const isUntilIChange = service.expiry && (() => {
        try {
          const expiryDate = service.expiry.toDate ? service.expiry.toDate() : new Date(service.expiry);
          const year = expiryDate.getFullYear();
          return year === 9999 || year > 9000;
        } catch (error) {
          return false;
        }
      })();

      // Check if post is expired by expiry date
      if (!isUntilIChange && service.expiry) {
        const expiryDate = service.expiry?.toDate ? service.expiry.toDate() : new Date(service.expiry);
        if (expiryDate <= now) return false;
      }

      // Phase filter
      const finalType = service.type || service.serviceType || "provide";
      const matchesPhase =
        phase === "all" ? true : finalType === phase;

      if (!matchesPhase) return false;

      // Distance filter
      let minDistanceKm = debouncedFilters.distance.min || 0;
      let maxDistanceKm = debouncedFilters.distance.max;
      if (debouncedFilters.distanceUnit === 'm') {
        minDistanceKm = minDistanceKm / 1000;
        if (maxDistanceKm) maxDistanceKm = maxDistanceKm / 1000;
      }

      const distance = service.distance;
      if (debouncedFilters.distance.min && (distance === null || distance < minDistanceKm)) return false;
      if (debouncedFilters.distance.max && (distance === null || distance > maxDistanceKm)) return false;

      // Rating filter
      const creatorRating = userProfiles[service.createdBy]?.rating || 0;
      const rating = service.rating || creatorRating || 0;

      if (rating < debouncedFilters.rating.min) return false;
      if (rating > debouncedFilters.rating.max) return false;

      // Online status filter
      const isOnline = isUserOnline(service.createdBy, currentUserId, creatorProfile.online, creatorProfile.lastSeen);
      if (debouncedFilters.onlineStatus === "online" && !isOnline) return false;
      if (debouncedFilters.onlineStatus === "offline" && isOnline) return false;

      // Location filters
      const checkLocationFilter = (filterValue, serviceValue) => {
        if (!filterValue) return true;
        const filterValues = filterValue.split(',').map(v => v.trim().toLowerCase()).filter(v => v);
        return filterValues.some(fv => serviceValue?.toLowerCase().includes(fv));
      };

      if (!checkLocationFilter(debouncedFilters.area, service.location?.area)) return false;
      if (!checkLocationFilter(debouncedFilters.city, service.location?.city)) return false;
      if (!checkLocationFilter(debouncedFilters.landmark, service.location?.landmark)) return false;
      if (!checkLocationFilter(debouncedFilters.pincode, service.location?.pincode)) return false;

      // Country Filter
      const serviceCountry = service.location?.country || service.country;
      if (!checkLocationFilter(debouncedFilters.country, serviceCountry)) return false;

      // Tags filter
      if (debouncedFilters.tags) {
        const tagFilters = debouncedFilters.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        const hasMatchingTag = tagFilters.some(tag =>
          (service.tags || []).some(st => st.toLowerCase().includes(tag))
        );
        if (!hasMatchingTag) return false;
      }

      // Expiry Type Filter
      if (debouncedFilters.expiryType !== "all") {
        if (debouncedFilters.expiryType === "noExpiry" && !isUntilIChange) return false;
        if (debouncedFilters.expiryType === "withExpiry" && isUntilIChange) return false;
      }

      // Date Filter
      if (!isUntilIChange && debouncedFilters.expiryDate && service.expiry) {
        const expiryDate = service.expiry?.toDate ? service.expiry.toDate() : new Date(service.expiry);
        const filterDate = new Date(debouncedFilters.expiryDate);

        const expiryDateOnly = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
        const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());

        if (debouncedFilters.expiryDirection === "above") {
          if (expiryDateOnly < filterDateOnly) return false;
        } else {
          if (expiryDateOnly > filterDateOnly) return false;
        }
      }

      return true;
    });

    // Apply sorting
    const sortedServices = [...filteredServices].sort((a, b) => {
      // IF SEARCHING: Sort by relevance score (custom score)
      if (debouncedSearchValue.trim() && searchScoreMap.size > 0) {
        const scoreA = searchScoreMap.get(a.id) || 0;
        const scoreB = searchScoreMap.get(b.id) || 0;
        return scoreB - scoreA; // Higher score first
      }

      // OTHERWISE: Use user-selected sorting
      const distA = a.distance === null ? Infinity : a.distance;
      const distB = b.distance === null ? Infinity : b.distance;

      const ratingA = userProfiles[a.createdBy]?.rating || 0;
      const ratingB = userProfiles[b.createdBy]?.rating || 0;

      const getExpiryTime = (service) => {
        if (!service.expiry) return Number.MAX_SAFE_INTEGER;
        try {
          const expiryDate = service.expiry.toDate ? service.expiry.toDate() : new Date(service.expiry);
          const year = expiryDate.getFullYear();
          if (year === 9999 || year > 9000) return Number.MAX_SAFE_INTEGER;
          return expiryDate.getTime();
        } catch (error) {
          return Number.MAX_SAFE_INTEGER;
        }
      };

      const expiryA = getExpiryTime(a);
      const expiryB = getExpiryTime(b);

      switch (sortBy) {
        case "distance-low-high":
          return distA - distB;
        case "distance-high-low":
          return distB - distA;
        case "rating-low-high":
          return ratingA - ratingB;
        case "rating-high-low":
          return ratingB - ratingA;
        case "expiry-soon-late":
          return expiryA - expiryB;
        case "expiry-late-soon":
          return expiryB - expiryA;
        case "random":
          return Math.random() - 0.5;
        default:
          return distA - distB;
      }
    });

    return sortedServices;
  }, [searchableServices, serviceFuseIndex, debouncedSearchValue, debouncedFilters, sortBy, userProfile, userProfiles, currentUserId, phase]);

  // OPTIMIZATION: Infinite Scroll - Auto-load when user scrolls near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (!listContainerRef.current) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // Load more when user is 300px from bottom
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 300;

      if (isNearBottom && !loadingMore) {
        // Auto-load next batch of cached items
        if (displayCount < displayedServices.length) {
          setDisplayCount(prev => prev + currentPageSize);
        }
        // Auto-load from Firestore if all cached items shown
        else if (hasMore) {
          loadMoreServices().then(() => {
            setDisplayCount(prev => prev + currentPageSize);
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayCount, displayedServices.length, hasMore, loadingMore, loadMoreServices, currentPageSize]);

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
    filters.country ||
    filters.tags ||
    filters.expiryType !== "all" ||
    filters.expiryDate;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Layout
      title="AeroSigil Services"
      activeTab="services"
      headerExtra={
        <>
          <div className="relative flex-grow">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder="Search services, skills, location..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(true)}
            className={`p-2.5 rounded-lg border transition-colors ${hasActiveFilters
              ? "text-blue-600 bg-blue-50 border-blue-200"
              : "text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
          >
            <FiFilter size={20} />
          </button>

          {/* Sort Dropdown */}
          <SortDropdown
            sortBy={sortBy}
            setSortBy={setSortBy}
            showSort={showSort}
            setShowSort={setShowSort}
          />
        </>
      }
      subHeader={
        <>
          {/* Active Filters Display */}
          {hasActiveFilters && (
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
                {filters.country && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                    Country: {filters.country}
                  </span>
                )}
                {filters.tags && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                    Tags: {filters.tags}
                  </span>
                )}
                {filters.expiryType !== "all" && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                    {filters.expiryType === "noExpiry" ? "Expiry: NA Only" : "With Expiry Dates Only"}
                  </span>
                )}
                {filters.expiryDate && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                    {filters.expiryDirection === "above" ? "After" : "Before"} {filters.expiryDate}
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
                    country: "",
                    tags: "",
                    expiryType: "all",
                    expiryDate: "",
                    expiryDirection: "above"
                  })}
                  className="text-red-500 text-xs hover:text-red-700 font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Phase Tabs */}
          <div className="pt-4 pb-2">
            <div className="flex p-1 bg-gray-100 rounded-lg border border-gray-200">
              {["all", "provide", "ask"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-semibold capitalize transition-all ${phase === p
                    ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {p === "provide" ? "Providing" : p === "ask" ? "Asking" : "All"}
                </button>
              ))}
            </div>
          </div>
        </>
      }
    >
      {/* Main Content */}
      <div className="px-4 py-3 pb-20" ref={listContainerRef}>
        {displayedServices.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-lg">No services found.</p>
            <p className="text-sm mt-2">
              {services.length === 0
                ? "No services available in the database."
                : "Try adjusting your search or filters"}
            </p>
            {services.length === 0 && (
              <div className="mt-6">
                <button
                  onClick={() => navigate("/add-services")}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Service
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Show only first displayCount services (paginated display) */}
              {displayedServices.slice(0, displayCount).map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  profile={userProfile}
                  userProfiles={userProfiles}
                  currentUserId={currentUserId}
                  navigate={navigate}
                />
              ))}
            </div>

            {/* Loading Indicator for Infinite Scroll */}
            {loadingMore && (
              <div className="flex justify-center mt-6">
                <div className="flex items-center gap-2 text-gray-600">
                  <FiLoader className="animate-spin" size={20} />
                  <span className="text-sm">Loading more services...</span>
                </div>
              </div>
            )}

          </>
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

      {/* Add Service Floating Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={() => navigate("/add-services")}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors active:bg-blue-800 active:scale-95"
          aria-label="Add Service"
        >
          <FiPlus size={24} />
        </button>
      </div>
    </Layout>
  );
}
