import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment,
  limit,
  writeBatch,
  where,
  Timestamp
} from "firebase/firestore";
import {
  FiArrowLeft,
  FiMoreVertical,
  FiCopy,
  FiCornerUpLeft,
  FiX,
  FiSend,
  FiMic,
  FiPlay,
  FiPause,
  FiTrash2,
  FiFile,
  FiClock,
  FiEdit2,
  FiSlash
} from "react-icons/fi";
import { MdDone, MdDoneAll, MdAdd, MdMic } from "react-icons/md";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { compressFile } from "../utils/compressor";
import defaultProfile from "../assets/images/default_profile.svg";
import { useGlobalDataCache } from "../contexts/GlobalDataCacheContext";
import { formatLastSeen } from "../utils/timeUtils";

function formatTime(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}


function getDateLabel(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString();
}

function isUserOnline(online, lastSeen) {
  // CRITICAL FIX: Check lastSeen timestamp first
  if (lastSeen) {
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      const minutesSinceLastSeen = (Date.now() - date.getTime()) / 60000;
      if (minutesSinceLastSeen > 5) return false;
      if (minutesSinceLastSeen < 2) return true;
    } catch (error) {
    }
  }

  if (online === true) return true;
  if (online === false) return false;
  return false;
}

// --- Download Utility ---
async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    // Fallback
    window.open(url, '_blank');
  }
}

// --- Components ---

function MessageTickIcon({ message, otherUserId, isOwnMessage }) {
  // Only show ticks for your own messages
  if (!isOwnMessage) return null;

  // Get the status
  let tickStatus = "sent"; // Default: message sent to server but not delivered

  // Check if message is delivered to recipient's device
  if (message.deliveredTo && Array.isArray(message.deliveredTo) && message.deliveredTo.includes(otherUserId)) {
    tickStatus = "delivered";
  }

  // Check if message is seen by recipient
  if (message.seenBy && Array.isArray(message.seenBy) && message.seenBy.includes(otherUserId)) {
    tickStatus = "seen";
  }

  // Return appropriate icon
  if (tickStatus === "seen") {
    return React.createElement(MdDoneAll, { className: "text-blue-600 text-lg ml-1" });
  } else if (tickStatus === "delivered") {
    return React.createElement(MdDoneAll, { className: "text-gray-500 text-lg ml-1" });
  } else if (tickStatus === "sent") {
    return React.createElement(MdDone, { className: "text-gray-600 text-lg ml-1" });
  } else {
    return React.createElement(FiClock, { className: "text-gray-400 text-xs ml-1" });
  }
}

function MessageActionsComponent({ message, onReply, onCopy, onEdit, onDelete, isOwnMessage, showUpwards }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Check if message is deleted
  const isDeleted = message.isDeleted;

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // For deleted messages, only show delete option
  if (isDeleted) {
    return React.createElement(
      "div",
      { className: "relative", ref: menuRef },
      React.createElement(
        "button",
        {
          onClick: () => setShowMenu(!showMenu),
          className: "text-gray-400 p-1 rounded hover:bg-gray-100 transition-colors"
        },
        React.createElement(FiMoreVertical, { size: 14 })
      ),
      showMenu && React.createElement(
        "div",
        { className: `absolute ${isOwnMessage ? 'right-0' : 'left-0'} ${showUpwards ? 'bottom-full mb-1' : 'top-6'} bg-white rounded-lg shadow-xl border py-1 z-50 min-w-[140px]` },
        React.createElement(
          "button",
          {
            onClick: () => { onDelete(); setShowMenu(false); },
            className: "w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-xs text-red-600"
          },
          React.createElement(FiTrash2, { className: "mr-2", size: 12 }),
          " Delete"
        )
      )
    );
  }

  // Original code for non-deleted messages
  return React.createElement(
    "div",
    { className: "relative", ref: menuRef },
    React.createElement(
      "button",
      {
        onClick: () => setShowMenu(!showMenu),
        className: "text-gray-400 p-1 rounded hover:bg-gray-100 transition-colors"
      },
      React.createElement(FiMoreVertical, { size: 14 })
    ),
    showMenu && React.createElement(
      "div",
      { className: `absolute ${isOwnMessage ? 'right-0' : 'left-0'} ${showUpwards ? 'bottom-full mb-1' : 'top-6'} bg-white rounded-lg shadow-xl border py-1 z-50 min-w-[140px]` },
      React.createElement(
        "button",
        {
          onClick: () => { onReply(); setShowMenu(false); },
          className: "w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
        },
        React.createElement(FiCornerUpLeft, { className: "mr-2", size: 12 }),
        " Reply"
      ),
      message.type === 'text' && React.createElement(
        "button",
        {
          onClick: () => { onCopy(); setShowMenu(false); },
          className: "w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
        },
        React.createElement(FiCopy, { className: "mr-2", size: 12 }),
        " Copy"
      ),
      isOwnMessage && React.createElement(React.Fragment, null,
        message.type === 'text' && React.createElement(
          "button",
          {
            onClick: () => { onEdit(); setShowMenu(false); },
            className: "w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
          },
          React.createElement(FiEdit2, { className: "mr-2", size: 12 }),
          " Edit"
        ),
        React.createElement(
          "button",
          {
            onClick: () => { onDelete(); setShowMenu(false); },
            className: "w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-xs text-red-600"
          },
          React.createElement(FiTrash2, { className: "mr-2", size: 12 }),
          " Delete"
        )
      )
    )
  );
}

function AudioMessage({ fileUrl, isOwnMessage }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return React.createElement(
    "div",
    { className: "flex items-center gap-2 min-w-[150px]" },
    React.createElement(
      "button",
      {
        onClick: togglePlay,
        className: `p-2 rounded-full ${isOwnMessage ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`
      },
      isPlaying ? React.createElement(FiPause, { size: 16 }) : React.createElement(FiPlay, { size: 16 })
    ),
    React.createElement(
      "div",
      { className: "flex-1 h-1 bg-gray-300 rounded-full overflow-hidden mx-2" },
      React.createElement("div", { className: `h-full ${isOwnMessage ? 'bg-blue-600' : 'bg-blue-500'} w-1/2 animate-pulse` })
    ),
    React.createElement(
      "audio",
      {
        ref: audioRef,
        src: fileUrl,
        onEnded: () => setIsPlaying(false),
        className: "hidden"
      }
    )
  );
}

function Modal({ title, children, onClose, onConfirm, confirmText = "Confirm", confirmColor = "bg-red-600", isLoading = false }) {
  return React.createElement(
    "div",
    { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" },
    React.createElement(
      "div",
      { className: "bg-white rounded-xl shadow-xl max-w-sm w-full p-6" },
      React.createElement("h3", { className: "text-lg font-bold mb-2" }, title),
      React.createElement("div", { className: "mb-6 text-gray-600" }, children),
      React.createElement(
        "div",
        { className: "flex justify-end gap-3" },
        React.createElement(
          "button",
          {
            onClick: onClose,
            className: "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium",
            disabled: isLoading
          },
          "Cancel"
        ),
        React.createElement(
          "button",
          {
            onClick: onConfirm,
            className: `px-4 py-2 text-white rounded-lg font-medium shadow-md ${confirmColor} flex items-center gap-2 ${isLoading ? 'opacity-70 cursor-wait' : ''}`,
            disabled: isLoading
          },
          isLoading && React.createElement("div", { className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" }),
          isLoading ? "Processing..." : confirmText
        )
      )
    )
  );
}

// --- Main Component ---

export default function ChatDetail() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Pagination State - OPTIMIZED: Reduced from 20 to 10 messages
  const INITIAL_LIMIT = 10; // Reduced from 20 for 50% fewer reads
  const [limitCount, setLimitCount] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef({ scrollTop: 0, scrollHeight: 0 });

  // State
  const [uid, setUid] = useState("");
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState({});
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userStatus, setUserStatus] = useState({ online: false, lastSeen: null });
  const [toastMessage, setToastMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);

  // Tracking who blocked whom
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const isCancellingRef = useRef(false);

  // Modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearMessagesModal, setShowClearMessagesModal] = useState(false);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Get other user ID
  const otherUserId = chat?.participants?.find(p => p !== uid);

  // Global Message Cache
  const { getMessageCache, setMessageCache } = useGlobalDataCache();

  // Initialize
  useEffect(() => {
    return auth.onAuthStateChanged((user) => setUid(user ? user.uid : ""));
  }, []);

  // Toast Timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load Chat and Blocking Status
  // OPTIMIZATION: Separated chat listener from profile listener to prevent accumulated listeners
  useEffect(() => {
    if (!chatId || !uid) return;

    // Use onSnapshot for real-time chat updates (blocking, muting)
    const unsubChat = onSnapshot(doc(db, "chats", chatId), (chatSnap) => {
      if (!chatSnap.exists()) {
        navigate("/chats");
        return;
      }

      const chatData = { id: chatSnap.id, ...chatSnap.data() };
      setChat(chatData);

      const otherId = chatData.participants?.find(x => x !== uid);
      const themBlocked = otherId ? (chatData.blockedBy?.includes(otherId) || false) : false;

      setIsBlockedByThem(themBlocked);
      setIsMuted(chatData.mutedBy?.includes(uid) || false);
    }, (err) => { });

    return () => unsubChat();
  }, [chatId, uid, navigate]);

  // Bug Fix: Unconditionally reset unseen count when entering chat
  // This handles specific edge cases where unread count > 0 but no unread messages exist (phantom red dot)
  useEffect(() => {
    if (!chat || !uid) return;

    // Check if we have an unseen count > 0
    const count = (chat.unseenCounts && chat.unseenCounts[uid]) || 0;

    if (count > 0) {
      console.log("Fixing phantom unread count...");
      updateDoc(doc(db, "chats", chatId), {
        [`unseenCounts.${uid}`]: 0
      }).catch(err => { });
    }
  }, [chat, uid, chatId]);

  // OPTIMIZATION: Separate profile listener - only recreates when otherUserId changes
  // This fixes the bug where profile listeners accumulated on every chat update
  useEffect(() => {
    if (!otherUserId) return;

    const unsubProfile = onSnapshot(doc(db, "profiles", otherUserId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        const isOnline = isUserOnline(data.online, data.lastSeen);
        setUserStatus({ online: isOnline, lastSeen: data.lastSeen });
      }
    }, (err) => { });

    return () => unsubProfile();
  }, [otherUserId]);

  // Messages Listener with Pagination and Block Filtering
  // OPTIMIZATION: Zero-read revisit - only subscribe if cache is stale or missing
  useEffect(() => {
    if (!chatId || !uid || !chat) return;

    const cachedData = getMessageCache(chatId);
    const lastChatUpdate = chat?.updatedAt?.toMillis?.() || 0;

    // IF we have cache AND it matches precisely the last server update,
    // AND we are not already loading more messages, we can SKIP the listener
    // because the global chats listener already keeps us updated on whether something changed.
    if (cachedData && cachedData.lastUpdate === lastChatUpdate && lastChatUpdate !== 0 && !isLoadingMore && cachedData.messages?.length >= limitCount) {
      setMessages(cachedData.messages);

      setMessages(cachedData.messages);
      return;
    }

    // Otherwise, we need to subscribe to get the latest (or more) messages
    let qConstraints = [orderBy("createdAt", "desc"), limit(limitCount)];

    // If user has cleared chat, only fetch messages AFTER that time
    const clearedTime = chat?.clearedAt?.[uid];
    if (clearedTime) {
      qConstraints = [
        where("createdAt", ">", clearedTime),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      ];
    }

    const q = query(
      collection(db, "chats", chatId, "messages"),
      ...qConstraints
    );

    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      // If snap.metadata.fromCache is true, 0 reads are consumed.
      const isFromCache = snap.metadata.fromCache;
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));


      // Client-side filtering for cleared messages (Double check in case query hasn't updated yet)
      const filteredMsgs = msgs.filter(msg => {
        // Block check
        if (!msg.isBlocked) {
          if (msg.senderId !== uid) return false;
        } else if (msg.senderId !== uid) {
          // If message is not marked 'isBlocked', we keep it. 
          // But wait, the original logic was:
          // if (!msg.isBlocked) return true;
          // return msg.senderId === uid;
          // The query should generally filter blocked messages if we wanted to? 
          // No, we store them with 'isBlocked: true' if they were sent while blocked.
        }

        // Cleared check
        if (clearedTime) {
          const cTime = clearedTime.toDate ? clearedTime.toDate().getTime() : new Date(clearedTime).getTime();
          const mTime = msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime()) : Date.now();
          if (mTime <= cTime) return false;
        }

        // Original logic preserved: if isBlocked is true, only show if I sent it
        if (msg.isBlocked && msg.senderId !== uid) return false;

        return true;
      });

      setMessages(filteredMsgs);
      setHasMore(snap.docs.length === limitCount);
      setIsLoadingMore(false);

      // Persist to global cache for zero-read revisit
      if (!isFromCache && lastChatUpdate !== 0) {
        setMessageCache(chatId, filteredMsgs, lastChatUpdate);
      }

      if (isLoadingMore && scrollRef.current.scrollHeight > 0) {
        const container = chatContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight - scrollRef.current.scrollHeight;
        }
      }
    });

    return () => unsub();
  }, [chatId, uid, limitCount, isBlockedByMe, isBlockedByThem, isLoadingMore, chat, getMessageCache, setMessageCache]);

  // Update message delivery and seen status when user views chat
  // OPTIMIZATION: Use batch writes instead of individual updateDoc calls
  useEffect(() => {
    if (!chatId || !uid || !otherUserId) return;

    // Mark messages from other user as delivered and seen using batch write
    const markMessagesAsDeliveredAndSeen = async () => {
      try {
        // Get messages from other user (not deleted)
        const messagesFromOther = messages.filter(msg =>
          msg.senderId === otherUserId && !msg.isDeleted
        );

        // Collect messages that need delivery update
        const undeliveredMessages = messagesFromOther.filter(msg =>
          !msg.deliveredTo?.includes(uid)
        );

        // OPTIMIZATION: Batch write for delivered status
        if (undeliveredMessages.length > 0) {
          const batch = writeBatch(db);
          undeliveredMessages.forEach(msg => {
            const msgRef = doc(db, "chats", chatId, "messages", msg.id);
            batch.update(msgRef, { deliveredTo: arrayUnion(uid) });
          });
          await batch.commit();
        }

        // Mark as seen after a short delay (simulating WhatsApp behavior)
        setTimeout(async () => {
          const unseenMessages = messagesFromOther.filter(msg =>
            !msg.seenBy?.includes(uid)
          );

          // OPTIMIZATION: Batch write for seen status
          if (unseenMessages.length > 0) {
            const seenBatch = writeBatch(db);
            unseenMessages.forEach(msg => {
              const msgRef = doc(db, "chats", chatId, "messages", msg.id);
              seenBatch.update(msgRef, { seenBy: arrayUnion(uid) });
            });

            // Also reset unseen count for current user in the same batch
            const chatRef = doc(db, "chats", chatId);
            seenBatch.update(chatRef, { [`unseenCounts.${uid}`]: 0 });

            await seenBatch.commit();
          }
        }, 500); // Reduced delay for better UX

      } catch (error) {
      }
    };

    markMessagesAsDeliveredAndSeen();
  }, [messages, chatId, uid, otherUserId]);

  // Listen for messages from current user and update their delivery status
  // OPTIMIZATION: Use batch writes instead of individual updateDoc calls
  useEffect(() => {
    if (!chatId || !uid || !otherUserId) return;

    // Mark our own messages as delivered to recipient when they come online or are active
    const markOwnMessagesAsDelivered = async () => {
      try {
        // Get our own undelivered messages
        const ownUndeliveredMessages = messages.filter(msg =>
          msg.senderId === uid &&
          !msg.isDeleted &&
          (!msg.deliveredTo || !msg.deliveredTo.includes(otherUserId))
        );

        // OPTIMIZATION: Batch write for delivery status when recipient is online
        if (userStatus.online && ownUndeliveredMessages.length > 0) {
          const batch = writeBatch(db);
          ownUndeliveredMessages.forEach(msg => {
            const msgRef = doc(db, "chats", chatId, "messages", msg.id);
            batch.update(msgRef, { deliveredTo: arrayUnion(otherUserId) });
          });
          await batch.commit();
        }
      } catch (error) {

      }
    };

    markOwnMessagesAsDelivered();
  }, [messages, chatId, uid, otherUserId, userStatus.online]);

  // Scroll handling
  useEffect(() => {
    // Basic at-bottom detection for the floating button
    // In column-reverse, 0 is the bottom.
    if (chatContainerRef.current && !isLoadingMore) {
      // When new messages arrive, if we were at the bottom, stay at the bottom.
      // In column-reverse, "bottom" is scrollTop = 0.
      if (isAtBottom) {
        chatContainerRef.current.scrollTop = 0;
      }
    }
  }, [messages, isAtBottom, isLoadingMore]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop } = chatContainerRef.current;
      // In column-reverse, scrollTop near 0 means we are at the bottom (newest messages)
      setIsAtBottom(scrollTop < 100);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    // Capture current scroll state
    if (chatContainerRef.current) {
      scrollRef.current = {
        scrollTop: chatContainerRef.current.scrollTop,
        scrollHeight: chatContainerRef.current.scrollHeight
      };
    }

    setLimitCount(prev => prev + INITIAL_LIMIT);
  };

  // --- Actions ---

  const handleBlock = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { blockedBy: arrayUnion(uid) });
      setIsBlockedByMe(true);
      setToastMessage("User blocked");
    } catch (e) { setToastMessage("Error blocking user"); }
    setShowBlockModal(false);
  };

  const handleUnblock = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { blockedBy: arrayRemove(uid) });
      setIsBlockedByMe(false);
      setToastMessage("User unblocked");
    } catch (e) { setToastMessage("Error unblocking user"); }
  };

  const handleMute = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { mutedBy: arrayUnion(uid) });
      setIsMuted(true);
      setToastMessage("Notifications muted");
    } catch (e) { setToastMessage("Error muting chat"); }
    setShowMuteModal(false);
  };

  const handleUnmute = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { mutedBy: arrayRemove(uid) });
      setIsMuted(false);
      setToastMessage("Notifications unmuted");
    } catch (e) { setToastMessage("Error unmuting chat"); }
  };

  const handleClearMessages = async () => {
    setIsDeleting(true);
    try {
      // Use Timestamp.now() for immediate client-side consistency
      await updateDoc(doc(db, "chats", chatId), {
        [`clearedAt.${uid}`]: Timestamp.now()
      });
      setMessages([]); // Optimistically clear
      setToastMessage("Messages cleared");
    } catch (e) { setToastMessage("Error clearing messages"); }
    setIsDeleting(false);
    setShowClearMessagesModal(false);
  };

  const handleDeleteChat = async () => {
    try {
      // Logic deletion: Add current user to 'deletedBy' array
      // This allows the chat to be "cleared" for one user but remain for the other
      // AND allows restoration if they chat again
      await updateDoc(doc(db, "chats", chatId), {
        deletedBy: arrayUnion(uid)
      });
      navigate("/chats");
    } catch (e) { setToastMessage("Error hiding chat"); }
    setShowDeleteModal(false);
  };

  const handleEditMessage = (msg) => {
    if (msg.type === 'text') {
      setText(msg.text);
      setEditingId(msg.id);
      fileInputRef.current?.focus();
    } else {
      setToastMessage("Only text messages can be edited");
    }
  };

  const handleDeleteMessageRequest = (msg) => {
    setMessageToDelete(msg);
    setShowDeleteMessageModal(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", messageToDelete.id), {
        isDeleted: true,
        text: "",
        fileUrl: "",
        type: "text"
      });
      setToastMessage("Message deleted successfully");
    } catch (e) {
      setToastMessage("Error deleting message");
    }
    setIsDeleting(false);
    setShowDeleteMessageModal(false);
    setMessageToDelete(null);
  };

  // --- Voice Recording Logic ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      isCancellingRef.current = false;

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        if (isCancellingRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setToastMessage("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancellingRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Sending Logic ---

  const sendAudioMessage = async (audioBlob) => {
    if (!audioBlob || audioBlob.size === 0) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(audioBlob, "video");
      await sendMessageInternal({ type: "audio", fileUrl: url, text: "Voice Message" });
    } catch (err) {
      console.error("Audio upload failed", err);
      setToastMessage("Failed to send voice message");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Define allowed types (Images + Docs)
    const allowedTypes = [
      "image/",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv"
    ];

    const isAllowed = allowedTypes.some(type => file.type.startsWith(type) || file.type === type);

    if (!isAllowed && !file.type.startsWith('image/')) {
      // Fallback check for extensions if mime type is missing/weird
      const ext = file.name.split('.').pop().toLowerCase();
      const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'];
      if (!allowedExts.includes(ext)) {
        setToastMessage("File type not supported");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setToastMessage("File size must be less than 2MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      // Determine if it is an image for compression and message type
      const isImage = file.type.startsWith("image/");
      const compressType = isImage ? 'CHAT_IMAGE' : 'CHAT_FILE';

      const compressedFile = await compressFile(file, {}, compressType);

      // Use 'auto' to let Cloudinary detect PDF/Docs vs Images
      const url = await uploadToCloudinary(compressedFile, "auto");

      const msgType = isImage ? "image" : "file";
      const msgText = isImage ? "Image" : file.name;

      await sendMessageInternal({ type: msgType, fileUrl: url, text: msgText });
    } catch (err) {
      setToastMessage("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTextSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (editingId) {
      try {
        await updateDoc(doc(db, "chats", chatId, "messages", editingId), {
          text: text.trim(),
          isEdited: true,
          updatedAt: serverTimestamp()
        });
        setEditingId(null);
        setText("");
        setToastMessage("Message edited successfully");
      } catch (err) {
        setToastMessage("Failed to update message");
      }
      return;
    }

    await sendMessageInternal({ type: "text", text: text.trim() });
    setText("");
  };

  const sendMessageInternal = async ({ type, text, fileUrl = "" }) => {
    if (isBlockedByMe) {
      setToastMessage("Unblock to send messages");
      return;
    }

    const msgData = {
      text,
      senderId: uid,
      createdAt: serverTimestamp(),
      type,
      fileUrl,
      deliveredTo: [uid],
      isBlocked: isBlockedByThem, // Requirement: Messages sent while blocked remain undelivered
      replyTo: replyTo ? {
        id: replyTo.id,
        text: replyTo.text,
        type: replyTo.type,
        senderId: replyTo.senderId
      } : null
    };

    try {
      // OPTIMIZATION: Use addDoc return value instead of querying all messages
      const docRef = await addDoc(collection(db, "chats", chatId, "messages"), msgData);

      // If NOT blocked, update chat meta and unseen counts
      if (!isBlockedByThem && otherUserId) {
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: text,
          lastSenderId: uid,
          updatedAt: serverTimestamp(),
          [`unseenCounts.${otherUserId}`]: increment(1),
          deletedBy: [] // Revive chat for both users
        });
      }

      setReplyTo(null);

      if (userStatus.online && otherUserId) {
        setTimeout(async () => {
          try {
            await updateDoc(doc(db, "chats", chatId, "messages", docRef.id), {
              deliveredTo: arrayUnion(otherUserId)
            });
          } catch (error) {
          }
        }, 1000);
      }

    } catch (err) {
      setToastMessage("Failed to send");
    }
  };

  // --- Render ---

  // Create message elements
  const messageElements = messages.map((msg, index) => {
    const isOwn = msg.senderId === uid;
    const dateLabel = getDateLabel(msg.createdAt);
    const nextMsg = messages[index + 1];
    const showDate = !nextMsg || getDateLabel(nextMsg.createdAt) !== dateLabel;

    return React.createElement(
      React.Fragment,
      { key: msg.id },
      React.createElement(
        "div",
        { className: `flex w-full ${isOwn ? 'justify-end' : 'justify-start'} group mb-0.5` },
        // For non-deleted messages from others
        !msg.isDeleted && !isOwn && React.createElement(
          MessageActionsComponent,
          {
            message: msg,
            onReply: () => setReplyTo(msg),
            onCopy: () => { navigator.clipboard.writeText(msg.text); setToastMessage("Copied") },
            onEdit: () => handleEditMessage(msg),
            onDelete: () => handleDeleteMessageRequest(msg),
            isOwnMessage: false,
            showUpwards: index < 3
          }
        ),
        // For deleted messages from others
        msg.isDeleted && !isOwn && React.createElement(
          MessageActionsComponent,
          {
            message: msg,
            onDelete: () => handleDeleteMessageRequest(msg),
            isOwnMessage: false,
            showUpwards: index < 3
          }
        ),
        React.createElement(
          "div",
          { className: `max-w-[75%] relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col` },
          msg.replyTo && !msg.isDeleted && React.createElement(
            "div",
            { className: `text-xs mb-1 px-3 py-2 rounded-lg bg-gray-200/50 border-l-4 ${isOwn ? 'border-blue-500' : 'border-gray-500'} w-full` },
            React.createElement(
              "p",
              { className: "font-bold opacity-70" },
              msg.replyTo.senderId === uid ? 'You' : (profile.username || profile.name || "User")
            ),
            React.createElement(
              "p",
              { className: "truncate opacity-60" },
              msg.replyTo.type === 'audio' ? 'Voice Message' : msg.replyTo.text
            )
          ),
          React.createElement(
            "div",
            {
              className: `px-3 py-2 rounded-lg shadow-sm relative min-w-[100px] ${isOwn
                ? 'bg-[#d1e4f9] text-gray-900 rounded-tr-none'
                : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                }`
            },
            msg.isDeleted ? React.createElement(
              "div",
              { className: "flex items-center gap-2 text-gray-500 italic text-sm" },
              React.createElement(FiSlash, { size: 14 }),
              " This message was deleted"
            ) : React.createElement(React.Fragment, null,
              msg.type === 'text' && React.createElement(
                "p",
                { className: "whitespace-pre-wrap text-sm leading-relaxed pr-2 pb-1" },
                msg.text
              ),
              msg.type === 'image' && React.createElement(
                "img",
                {
                  src: msg.fileUrl,
                  alt: "Shared",
                  onClick: () => setViewingImage(msg.fileUrl),
                  className: "rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-95 transition-opacity",
                  crossOrigin: "anonymous"
                }
              ),
              msg.type === 'audio' && React.createElement(
                AudioMessage,
                { fileUrl: msg.fileUrl, isOwnMessage: isOwn }
              ),
              msg.type === 'file' && React.createElement(
                "button",
                {
                  onClick: () => downloadFile(msg.fileUrl, msg.text),
                  className: "flex items-center gap-2 text-sm underline opacity-90 hover:opacity-100 bg-transparent border-0 p-0 text-left"
                },
                React.createElement(FiFile, { size: 16 }),
                " ",
                msg.text
              )
            ),
            React.createElement(
              "div",
              { className: `flex items-center justify-end gap-1 mt-1 float-right ml-2` },
              msg.isEdited && !msg.isDeleted && React.createElement(
                "span",
                { className: "text-[10px] text-gray-500 italic" },
                "(edited)"
              ),
              React.createElement(
                "span",
                { className: "text-[10px] text-gray-500" },
                formatTime(msg.createdAt)
              ),
              // WhatsApp-like tick system
              React.createElement(
                MessageTickIcon,
                {
                  message: msg,
                  otherUserId: otherUserId,
                  isOwnMessage: isOwn
                }
              )
            )
          )
        ),
        // For your own messages (both deleted and non-deleted)
        isOwn && React.createElement(
          MessageActionsComponent,
          {
            message: msg,
            onReply: () => !msg.isDeleted && setReplyTo(msg),
            onCopy: () => !msg.isDeleted && navigator.clipboard.writeText(msg.text),
            onEdit: () => !msg.isDeleted && handleEditMessage(msg),
            onDelete: () => handleDeleteMessageRequest(msg),
            isOwnMessage: true,
            showUpwards: index < 3
          }
        )
      ),
      showDate && React.createElement(
        "div",
        { className: "flex justify-center my-4" },
        React.createElement(
          "span",
          { className: "text-gray-500 text-xs font-medium" },
          dateLabel
        )
      )
    );
  });

  return React.createElement(
    "div",
    { className: "flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl relative" },
    viewingImage && React.createElement(
      "div",
      { className: "fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-fade-in" },
      React.createElement(
        "button",
        {
          onClick: () => setViewingImage(null),
          className: "absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
        },
        React.createElement(FiX, { size: 24 })
      ),
      React.createElement(
        "img",
        {
          src: viewingImage,
          alt: "Full view",
          className: "max-w-full max-h-full object-contain rounded-lg shadow-2xl",
          crossOrigin: "anonymous"
        }
      )
    ),
    showBlockModal && React.createElement(
      Modal,
      {
        title: "Block User",
        onClose: () => setShowBlockModal(false),
        onConfirm: handleBlock,
        confirmText: "Block"
      },
      "Are you sure you want to block this user? You won't receive any messages from them."
    ),
    showMuteModal && React.createElement(
      Modal,
      {
        title: "Mute Notifications",
        onClose: () => setShowMuteModal(false),
        onConfirm: handleMute,
        confirmText: "Mute",
        confirmColor: "bg-yellow-600"
      },
      "Are you sure you want to mute notifications for this chat?"
    ),
    showDeleteModal && React.createElement(
      Modal,
      {
        title: "Delete Chat",
        onClose: () => setShowDeleteModal(false),
        onConfirm: handleDeleteChat,
        confirmText: "Delete"
      },
      "Are you sure you want to delete this chat? This action cannot be undone."
    ),
    showClearMessagesModal && React.createElement(
      Modal,
      {
        title: "Clear Messages",
        onClose: () => !isDeleting && setShowClearMessagesModal(false),
        onConfirm: handleClearMessages,
        confirmText: "Clear",
        confirmColor: "bg-red-600",
        isLoading: isDeleting
      },
      "Are you sure you want to clear all messages in this chat? The chat will remain in your list."
    ),
    showDeleteMessageModal && React.createElement(
      Modal,
      {
        title: "Delete Message",
        onClose: () => !isDeleting && setShowDeleteMessageModal(false),
        onConfirm: confirmDeleteMessage,
        confirmText: "Delete",
        isLoading: isDeleting
      },
      "Are you sure you want to delete this message? This cannot be undone."
    ),
    React.createElement(
      "header",
      { className: "bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-20" },
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(
          "button",
          {
            onClick: () => navigate(-1),
            className: "text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"
          },
          React.createElement(FiArrowLeft, { size: 20 })
        ),
        React.createElement(
          "div",
          { className: "relative" },
          React.createElement(
            "img",
            {
              src: profile.photoURL || profile.profileImage || defaultProfile,
              alt: profile.username,
              className: "w-10 h-10 rounded-full object-cover border border-gray-200",
              crossOrigin: "anonymous"
            }
          ),
          userStatus.online && React.createElement(
            "div",
            { className: "absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" }
          )
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "h1",
            { className: "font-bold text-sm text-gray-900" },
            profile.username || profile.name || profile.displayName || (profile.email ? profile.email.split('@')[0] : "User")),
          React.createElement(
            "p",
            { className: `text-xs ${isBlockedByMe ? 'text-red-500 font-medium' : isBlockedByThem ? 'text-transparent' : userStatus.online ? 'text-green-600 font-medium' : 'text-gray-500'}` },
            isBlockedByMe ? 'Blocked' : isBlockedByThem ? ' ' : userStatus.online ? 'Active now' : formatLastSeen(userStatus.lastSeen)
          )
        )
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-1" },
        // FIXED: Use a div wrapper for the three dots button and dropdown
        React.createElement(
          "div",
          { className: "relative" },
          React.createElement(
            "button",
            {
              onClick: () => setShowOptions(!showOptions),
              className: "p-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
            },
            React.createElement(FiMoreVertical, { size: 20 })
          ),
          showOptions && React.createElement(
            "div",
            {
              className: "absolute right-0 top-10 bg-white rounded-xl shadow-xl border py-2 z-30 w-48 animate-fade-in"
            },
            isBlockedByMe ? React.createElement(
              "button",
              {
                onClick: () => { handleUnblock(); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-green-600 hover:bg-green-50 text-sm font-medium"
              },
              "Unblock User"
            ) : React.createElement(
              "button",
              {
                onClick: () => { setShowBlockModal(true); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 text-sm font-medium"
              },
              "Block User"
            ),
            isMuted ? React.createElement(
              "button",
              {
                onClick: () => { handleUnmute(); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm"
              },
              "Unmute Notifications"
            ) : React.createElement(
              "button",
              {
                onClick: () => { setShowMuteModal(true); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm"
              },
              "Mute Notifications"
            ),
            React.createElement(
              "button",
              {
                onClick: () => { setShowClearMessagesModal(true); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm"
              },
              "Clear Messages"
            ),
            React.createElement(
              "button",
              {
                onClick: () => { setShowDeleteModal(true); setShowOptions(false); },
                className: "w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm"
              },
              "Delete Chat"
            )
          )
        )
      )
    ),
    React.createElement(
      "div",
      {
        ref: chatContainerRef,
        onScroll: handleScroll,
        className: "flex-1 overflow-y-auto bg-white p-4 space-y-2 flex flex-col-reverse"
      },
      messageElements,
      hasMore && React.createElement(
        "div",
        { className: "flex justify-center py-2" },
        React.createElement(
          "button",
          {
            onClick: handleLoadMore,
            disabled: isLoadingMore,
            className: "text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
          },
          isLoadingMore ? "Loading..." : "Load More Messages"
        )
      )
    ),
    !isAtBottom && React.createElement(
      "button",
      {
        onClick: () => {
          if (chatContainerRef.current) chatContainerRef.current.scrollTop = 0;
        },
        className: "absolute bottom-20 right-4 bg-white p-2 rounded-full shadow-lg border text-blue-600 hover:bg-blue-50 transition-all z-10"
      },
      React.createElement(FiArrowLeft, { className: "-rotate-90" })
    ),
    React.createElement(
      "div",
      { className: "bg-white border-t p-2" },
      replyTo && React.createElement(
        "div",
        { className: "flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border-l-4 border-blue-500" },
        React.createElement(
          "div",
          { className: "text-xs" },
          React.createElement(
            "span",
            { className: "font-bold text-blue-600" },
            `Replying to ${replyTo.senderId === uid ? 'yourself' : (profile.username || profile.name || "User")}`
          ),
          React.createElement(
            "p",
            { className: "text-gray-500 truncate max-w-[200px]" },
            replyTo.type === 'audio' ? 'Voice Message' : replyTo.text
          )
        ),
        React.createElement(
          "button",
          { onClick: () => setReplyTo(null) },
          React.createElement(FiX, { size: 16, className: "text-gray-400 hover:text-gray-600" })
        )
      ),
      editingId && React.createElement(
        "div",
        { className: "flex items-center justify-between bg-yellow-50 p-2 rounded-lg mb-2 border-l-4 border-yellow-500" },
        React.createElement(
          "div",
          { className: "text-xs" },
          React.createElement(
            "span",
            { className: "font-bold text-yellow-600" },
            "Editing Message"
          )
        ),
        React.createElement(
          "button",
          { onClick: () => { setEditingId(null); setText(""); } },
          React.createElement(FiX, { size: 16, className: "text-gray-400 hover:text-gray-600" })
        )
      ),
      isRecording ? React.createElement(
        "div",
        { className: "flex items-center gap-3 bg-red-50 p-2 rounded-full animate-pulse border border-red-100" },
        React.createElement(FiMic, { className: "text-red-500 ml-2", size: 20 }),
        React.createElement("span", { className: "flex-1 font-mono text-red-600 font-medium" }, formatRecordingTime(recordingTime)),
        React.createElement(
          "button",
          {
            onClick: cancelRecording,
            className: "p-2 text-gray-500 hover:text-gray-700"
          },
          React.createElement(FiTrash2, { size: 20 })
        ),
        React.createElement(
          "button",
          {
            onClick: stopRecording,
            className: "p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
          },
          React.createElement(FiSend, { size: 18 })
        )
      ) : React.createElement(
        "div",
        { className: "flex-1" },
        isBlockedByMe ? React.createElement(
          "div",
          { className: "w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-500 text-center" },
          "You have blocked this user"
        ) : React.createElement(
          "form",
          { onSubmit: handleTextSend, className: "flex items-center gap-2" },
          React.createElement("input", {
            type: "file",
            accept: "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv",
            ref: fileInputRef,
            onChange: handleFileSelect,
            className: "hidden",
            disabled: uploading
          }),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: () => fileInputRef.current?.click(),
              className: "p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm",
              disabled: uploading
            },
            React.createElement(MdAdd, { size: 24 })
          ),
          React.createElement(
            "div",
            { className: "flex-1 relative" },
            React.createElement("input", {
              type: "text",
              value: text,
              onChange: e => setText(e.target.value),
              placeholder: isBlockedByThem ? "Sending restricted..." : "Type a message...",
              disabled: uploading,
              className: "w-full bg-white border border-gray-200 focus:border-blue-500 rounded-full px-4 py-2 text-sm transition-all outline-none shadow-sm"
            })
          ),
          text.trim() ? React.createElement(
            "button",
            {
              type: "submit",
              disabled: uploading,
              className: "p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
            },
            React.createElement(FiSend, { size: 20, className: "ml-0.5" })
          ) : React.createElement(
            "button",
            {
              type: "button",
              onClick: startRecording,
              disabled: uploading,
              className: "p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
            },
            React.createElement(MdMic, { size: 28 })
          )
        )
      )
    ),
    toastMessage && React.createElement(
      "div",
      { className: "fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-medium shadow-lg animate-fade-in z-50" },
      toastMessage
    )
  );
}
