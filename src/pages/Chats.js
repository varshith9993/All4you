import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FiStar, FiSearch, FiWifi } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.png";
import Layout from "../components/Layout";

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

// Format last seen time
function formatLastSeen(date) {
  if (!date) return "long time ago";
  try {
    const d = date.toDate ? date.toDate() : date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (error) {
    console.error("Error formatting last seen:", error);
    return "Unknown";
  }
}

// Check if user is online
function isUserOnline(online, lastSeen) {
  if (online === true) {
    if (!lastSeen) return true;
    try {
      const date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      const diff = new Date().getTime() - date.getTime();
      return diff < 60000; // Considered online if active within last 1 minute
    } catch (error) {
      return true;
    }
  }
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
          className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm"
          onError={(e) => { e.target.src = defaultAvatar; }}
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
  const [chats, setChats] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const profileUnsubscribes = useRef({});

  useEffect(() => {
    const auth = getAuth();
    return auth.onAuthStateChanged(u => setUid(u ? u.uid : ""));
  }, []);

  // Fetch all chats with deduplication
  useEffect(() => {
    if (!uid) return;

    const chatsQ = query(collection(db, "chats"), where("participants", "array-contains", uid));
    const unsubscribeChats = onSnapshot(chatsQ, async (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Deduplicate chats - keep only the most recent chat for each unique participant pair
      const chatMap = new Map();
      arr.forEach(chat => {
        const otherId = chat.participants.find(x => x !== uid);
        if (otherId) {
          const existing = chatMap.get(otherId);
          if (!existing) {
            chatMap.set(otherId, chat);
          } else {
            // Keep the chat with the most recent update
            const existingTime = existing.updatedAt?.toDate?.()?.getTime() || 0;
            const currentTime = chat.updatedAt?.toDate?.()?.getTime() || 0;
            if (currentTime > existingTime) {
              chatMap.set(otherId, chat);
            }
          }
        }
      });

      const deduplicatedChats = Array.from(chatMap.values());
      setChats(deduplicatedChats);

      // Identify all other participants
      const otherIds = Array.from(new Set(deduplicatedChats.map(c => c.participants.find(x => x !== uid)))).filter(Boolean);

      // Clean up listeners for users who are no longer in the list
      Object.keys(profileUnsubscribes.current).forEach(id => {
        if (!otherIds.includes(id)) {
          if (typeof profileUnsubscribes.current[id] === 'function') {
            profileUnsubscribes.current[id]();
          }
          delete profileUnsubscribes.current[id];
        }
      });

      // Set up new listeners for users who don't have one yet
      otherIds.forEach(otherId => {
        if (!profileUnsubscribes.current[otherId]) {
          const unsub = onSnapshot(doc(db, "profiles", otherId), (profileSnap) => {
            if (profileSnap.exists()) {
              const profileData = profileSnap.data();
              setProfiles(prev => ({
                ...prev,
                [otherId]: profileData
              }));
            }
          }, (error) => {
            console.error("Error in profile listener:", error);
          });

          profileUnsubscribes.current[otherId] = unsub;
        }
      });
    }, (error) => {
      console.error("Error in chats listener:", error);
    });

    return () => {
      unsubscribeChats();
      Object.values(profileUnsubscribes.current).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      profileUnsubscribes.current = {};
    };
  }, [uid]);

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
      </div>
    </Layout>
  );
}