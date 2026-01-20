import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FiStar, FiSearch, FiWifi } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.svg";
import Layout from "../components/Layout";
import { useProfileCache } from "../contexts/ProfileCacheContext";
import { useChatsCache } from "../contexts/GlobalDataCacheContext";

const TABS = [
  { key: "all", label: "All" },
  { key: "user", label: "You Initiated" },
  { key: "others", label: "Others Initiated" }
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "unread", label: "Unread" },
  { key: "muted", label: "Muted" },
  { key: "blocked", label: "Blocked" }
];

// Format last seen time - OPTIMIZED for consistency with Workers/Services/Ads pages
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
    if (diffSecs < 60) return " just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "Offline";
  }
}

// Check if user is online
function isUserOnline(online, lastSeen) {
  // CRITICAL FIX: Check lastSeen timestamp first
  if (lastSeen) {
    try {
      const date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
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

function ChatCard({ chat, uid, profiles, navigate }) {
  const otherId = chat.participants.find(x => x !== uid);
  const prof = profiles[otherId] || {};
  const unseen = ((chat.unseenCounts && chat.unseenCounts[uid]) || 0);
  const isBlocked = (chat.blockedBy && chat.blockedBy.includes(uid));
  const isMuted = (chat.mutedBy && chat.mutedBy.includes(uid));

  const isOnline = isUserOnline(prof.online, prof.lastSeen);
  const statusText = isOnline ? "Online" : `Last seen: ${formatLastSeen(prof.lastSeen)}`;
  const statusColor = isOnline ? "text-green-600" : "text-gray-400";

  const handleChatClick = () => {
    if (unseen > 0) {
      try {
        updateDoc(doc(db, "chats", chat.id), {
          [`unseenCounts.${uid}`]: 0
        });
        console.group(`[Action: RESET UNSEEN COUNT]`);
        console.log(`%c✔ Messages marked as seen`, "color: gray; font-weight: bold");
        console.log(`- Reads: 0`);
        console.log(`- Writes: 1`);
        console.groupEnd();
      } catch (error) {
        console.error("Error resetting unseen count:", error);
      }
    }
    navigate(`/chat/${chat.id}`);
  };

  const handleFavoriteToggle = async (e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "chats", chat.id), {
        isFavorite: !chat.isFavorite
      });
      console.group(`[Action: TOGGLE CHAT FAVORITE]`);
      console.log(`%c✔ Favorite status updated`, "color: blue; font-weight: bold");
      console.log(`- Reads: 0`);
      console.log(`- Writes: 1`);
      console.groupEnd();
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  return (
    <div
      className="flex w-full items-center py-3 px-3 mb-2 rounded-lg bg-white border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
      onClick={handleChatClick}
    >
      <div className="relative mr-3 flex-shrink-0">
        <img
          src={prof.photoURL || prof.profileImage || defaultAvatar}
          alt={prof.username || "User"}
          className="h-12 w-12 rounded-full border-2 border-gray-300 object-cover"
          onError={(e) => { e.target.src = defaultAvatar; }}
          crossOrigin="anonymous"
        />
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate tracking-tight">
            {prof.username || "Unknown User"}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${statusColor} flex items-center gap-1 whitespace-nowrap`}>
              <FiWifi size={12} className={isOnline ? "text-green-500" : "text-gray-400"} />
              {statusText}
            </span>
            <button
              onClick={handleFavoriteToggle}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <FiStar
                size={16}
                className={chat.isFavorite ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600 truncate flex-1 mr-2 tracking-normal leading-normal">
            {chat.lastMessage || "No messages yet"}
          </p>
          {unseen > 0 && (
            <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
              {unseen}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          {isBlocked && (
            <span className="text-red-600 text-xs font-medium">Blocked</span>
          )}
          {isMuted && !isBlocked && (
            <span className="text-yellow-600 text-xs font-medium">Muted</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Chats() {
  const [uid, setUid] = useState("");
  const [tab, setTab] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState({});

  const { chats: allChats, hasMoreChats, loadMoreChats } = useChatsCache();
  const { fetchProfiles, getAllCachedProfiles, subscribeToOnlineStatus } = useProfileCache();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);

  // Sync with global cache
  useEffect(() => {
    setChats(allChats);
  }, [allChats]);

  useEffect(() => {
    return auth.onAuthStateChanged(u => setUid(u ? u.uid : ""));
  }, []);

  // OPTIMIZATION: Batch fetch participant profiles instead of N+1 listeners
  const fetchParticipantProfiles = useCallback(async (participantIds) => {
    if (!participantIds || participantIds.length === 0) return;

    try {
      const fetchedProfiles = await fetchProfiles(participantIds);
      setProfiles(prev => ({ ...prev, ...fetchedProfiles }));
    } catch (error) {
      console.error("Error batch fetching participant profiles:", error);
    }
  }, [fetchProfiles]);

  // OPTIMIZATION: Global chats listener is now in GlobalDataCacheContext
  // This removes the redundant onSnapshot here
  useEffect(() => {
    if (!uid || chats.length === 0) return;

    // Still need to fetch profiles for participants
    const otherIds = Array.from(new Set(chats.map(c => c.participants.find(x => x !== uid)))).filter(Boolean);
    fetchParticipantProfiles(otherIds);
  }, [uid, chats, fetchParticipantProfiles]);

  // Sync with global profile cache updates
  useEffect(() => {
    const cachedProfiles = getAllCachedProfiles();
    if (Object.keys(cachedProfiles).length > 0) {
      setProfiles(prev => ({ ...prev, ...cachedProfiles }));
    }
  }, [getAllCachedProfiles]);

  // OPTIMIZATION: Subscribe to online status updates for real-time status display
  // This refreshes every 15 seconds to show accurate online/offline status
  useEffect(() => {
    if (chats.length === 0) return;

    const otherIds = Array.from(new Set(chats.map(c => c.participants.find(x => x !== uid)))).filter(Boolean);
    if (otherIds.length === 0) return;

    const unsubscribe = subscribeToOnlineStatus(otherIds, (updatedProfiles) => {
      setProfiles(prev => ({ ...prev, ...updatedProfiles }));
    });

    return () => unsubscribe();
  }, [chats, uid, subscribeToOnlineStatus]);

  const tabCount = key => {
    if (key === "all") return chats.length;
    if (key === "user") return chats.filter(c => c.initiatorId === uid).length;
    if (key === "others") return chats.filter(c => c.initiatorId !== uid).length;
    return 0;
  };

  // Filtering and ordering
  let shownChats = chats.filter(c => {
    // Tab filtering
    if (tab === "user" && c.initiatorId !== uid) return false;
    if (tab === "others" && c.initiatorId === uid) return false;

    // Active filter
    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "favorites":
          if (!c.isFavorite) return false;
          break;
        case "unread":
          if (((c.unseenCounts && c.unseenCounts[uid]) || 0) === 0) return false;
          break;
        case "muted":
          if (!(c.mutedBy && c.mutedBy.includes(uid))) return false;
          break;
        case "blocked":
          if (!(c.blockedBy && c.blockedBy.includes(uid))) return false;
          break;
        default:
          break;
      }
    }

    // Search filtering
    if (search.trim()) {
      const otherId = c.participants.find(x => x !== uid);
      const prof = profiles[otherId] || {};
      const searchLower = search.toLowerCase();
      const matchesName = (prof.username || "").toLowerCase().includes(searchLower);
      const matchesMessage = (c.lastMessage || "").toLowerCase().includes(searchLower);
      if (!matchesName && !matchesMessage) return false;
    }

    return true;
  });

  // Show favorites at top, then sort by last update
  shownChats = shownChats.sort((a, b) => {
    // Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    // Then by last update time (newest first)
    const aTime = (a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : 0);
    const bTime = (b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : 0);
    return bTime - aTime;
  });

  return (
    <Layout
      title="Chats"
      activeTab="chats"
      headerExtra={
        <div className="relative w-full">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-normal"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      }
      subHeader={
        <>
          <div className="flex space-x-2 mt-3 overflow-x-auto pb-1">
            {TABS.map(tabItem => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabItem.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {tabItem.label} ({tabCount(tabItem.key)})
              </button>
            ))}
          </div>

          <div className="flex space-x-2 mt-2 overflow-x-auto pb-1">
            {FILTERS.map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFilter === filter.key
                  ? filter.key === "favorites"
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                    : filter.key === "unread"
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : filter.key === "muted"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                        : filter.key === "blocked"
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="px-4 py-3 pb-20">
        {shownChats.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-lg">No chats found</p>
            <p className="text-sm mt-2">Start a conversation to see it here</p>
          </div>
        ) : (
          <div>
            {shownChats.map(chat => (
              <ChatCard
                key={chat.id}
                chat={chat}
                uid={uid}
                profiles={profiles}
                navigate={navigate}
              />
            ))}
          </div>
        )}

        {hasMoreChats && (
          <div className="flex justify-center mt-6">
            <button
              onClick={loadMoreChats}
              className="px-6 py-2 bg-white border border-blue-500 text-blue-500 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              Load more chats
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
