import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  serverTimestamp,
  increment,
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
import { initializeUserActivity } from "../utils/userActivity";
import defaultProfile from "../assets/images/default_profile.png";


function formatTime(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatLastSeen(date) {
  if (!date) return "Never";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting last seen:", error);
    return "Unknown";
  }
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
  if (online === true) {
    if (!lastSeen) return true;
    try {
      let date = lastSeen.toDate ? lastSeen.toDate() : lastSeen.seconds ? new Date(lastSeen.seconds * 1000) : new Date(lastSeen);
      return (new Date().getTime() - date.getTime()) < 60000;
    } catch (error) {
      return true;
    }
  }
  return false;
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
    return <MdDoneAll className="text-blue-600 text-lg ml-1" />;
  } else if (tickStatus === "delivered") {
    return <MdDoneAll className="text-gray-500 text-lg ml-1" />;
  } else if (tickStatus === "sent") {
    return <MdDone className="text-gray-600 text-lg ml-1" />;
  } else {
    return <FiClock className="text-gray-400 text-xs ml-1" />;
  }
}

function MessageActionsComponent({ message, onReply, onCopy, onEdit, onDelete, isOwnMessage }) {
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
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-gray-400 p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <FiMoreVertical size={14} />
        </button>

        {showMenu && (
          <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} top-6 bg-white rounded-lg shadow-xl border py-1 z-50 min-w-[140px]`}>
            <button
              onClick={() => { onDelete(); setShowMenu(false); }}
              className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-xs text-red-600"
            >
              <FiTrash2 className="mr-2" size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  // Original code for non-deleted messages
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-gray-400 p-1 rounded hover:bg-gray-100 transition-colors"
      >
        <FiMoreVertical size={14} />
      </button>

      {showMenu && (
        <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} top-6 bg-white rounded-lg shadow-xl border py-1 z-50 min-w-[140px]`}>
          <button
            onClick={() => { onReply(); setShowMenu(false); }}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
          >
            <FiCornerUpLeft className="mr-2" size={12} /> Reply
          </button>

          {message.type === 'text' && (
            <button
              onClick={() => { onCopy(); setShowMenu(false); }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
            >
              <FiCopy className="mr-2" size={12} /> Copy
            </button>
          )}

          {isOwnMessage && (
            <>
              {message.type === 'text' && (
                <button
                  onClick={() => { onEdit(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-xs text-gray-700"
                >
                  <FiEdit2 className="mr-2" size={12} /> Edit
                </button>
              )}
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center text-xs text-red-600"
              >
                <FiTrash2 className="mr-2" size={12} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
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

  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <button
        onClick={togglePlay}
        className={`p-2 rounded-full ${isOwnMessage ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}
      >
        {isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
      </button>
      <div className="flex-1 h-1 bg-gray-300 rounded-full overflow-hidden mx-2">
        <div className={`h-full ${isOwnMessage ? 'bg-blue-600' : 'bg-blue-500'} w-1/2 animate-pulse`}></div>
      </div>
      <audio
        ref={audioRef}
        src={fileUrl}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}



function Modal({ title, children, onClose, onConfirm, confirmText = "Confirm", confirmColor = "bg-red-600" }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <div className="mb-6 text-gray-600">{children}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg font-medium shadow-md ${confirmColor}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function ChatDetail() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

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

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const isCancellingRef = useRef(false);

  // Call State
  // Removed call state variables

  // Modals
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Get other user ID
  const otherUserId = chat?.participants?.find(p => p !== uid);

  // Initialize
  useEffect(() => {
    initializeUserActivity();
    const auth = getAuth();
    return auth.onAuthStateChanged((user) => setUid(user ? user.uid : ""));
  }, []);

  // Toast Timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load Chat & Profile
  useEffect(() => {
    if (!chatId || !uid) return;

    const loadData = async () => {
      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (!chatSnap.exists()) {
          navigate("/chats");
          return;
        }

        const chatData = { id: chatSnap.id, ...chatSnap.data() };
        setChat(chatData);
        setIsBlocked(chatData.blockedBy?.includes(uid) || false);
        setIsMuted(chatData.mutedBy?.includes(uid) || false);

        const otherId = chatData.participants.find(x => x !== uid);
        if (otherId) {
          const profSnap = await getDoc(doc(db, "profiles", otherId));
          if (profSnap.exists()) {
            setProfile(profSnap.data());
          }

          const unsubProfile = onSnapshot(doc(db, "profiles", otherId), (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setProfile(prev => ({ ...prev, ...data }));
              const isOnline = isUserOnline(data.online, data.lastSeen);
              setUserStatus({ online: isOnline, lastSeen: data.lastSeen });
            }
          });
          return () => unsubProfile();
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, [chatId, uid, navigate]);

  // Messages Listener
  useEffect(() => {
    if (!chatId || !uid) return;

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    return () => unsub();
  }, [chatId, uid]);

  // Update message delivery and seen status when user views chat
  useEffect(() => {
    if (!chatId || !uid || !otherUserId) return;

    // Mark messages from other user as delivered and seen
    const markMessagesAsDeliveredAndSeen = async () => {
      try {
        // Get messages from other user (not deleted)
        const messagesFromOther = messages.filter(msg =>
          msg.senderId === otherUserId && !msg.isDeleted
        );

        // Mark as delivered first
        const undeliveredMessages = messagesFromOther.filter(msg =>
          !msg.deliveredTo?.includes(uid)
        );

        for (const msg of undeliveredMessages) {
          await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
            deliveredTo: arrayUnion(uid)
          });
        }

        // Mark as seen after a short delay (simulating WhatsApp behavior)
        setTimeout(async () => {
          const unseenMessages = messagesFromOther.filter(msg =>
            !msg.seenBy?.includes(uid)
          );

          for (const msg of unseenMessages) {
            await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
              seenBy: arrayUnion(uid)
            });
          }

          // Reset unseen count for current user
          if (unseenMessages.length > 0) {
            await updateDoc(doc(db, "chats", chatId), {
              [`unseenCounts.${uid}`]: 0
            });
          }
        }, 500); // Reduced delay for better UX

      } catch (error) {
        console.error("Error marking messages as delivered and seen:", error);
      }
    };

    markMessagesAsDeliveredAndSeen();
  }, [messages, chatId, uid, otherUserId]);

  // Listen for messages from current user and update their delivery status
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

        // If the other user is online, mark messages as delivered
        if (userStatus.online && ownUndeliveredMessages.length > 0) {
          for (const msg of ownUndeliveredMessages) {
            await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
              deliveredTo: arrayUnion(otherUserId)
            });
          }
        }
      } catch (error) {
        console.error("Error marking own messages as delivered:", error);
      }
    };

    markOwnMessagesAsDelivered();
  }, [messages, chatId, uid, otherUserId, userStatus.online]);

  // Scroll handling
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);
    }
  };

  // --- Actions ---

  const handleBlock = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { blockedBy: arrayUnion(uid) });
      setIsBlocked(true);
      setToastMessage("User blocked");
    } catch (e) { console.error(e); setToastMessage("Error blocking user"); }
    setShowBlockModal(false);
  };

  const handleUnblock = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { blockedBy: arrayRemove(uid) });
      setIsBlocked(false);
      setToastMessage("User unblocked");
    } catch (e) { console.error(e); setToastMessage("Error unblocking user"); }
  };

  const handleMute = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { mutedBy: arrayUnion(uid) });
      setIsMuted(true);
      setToastMessage("Notifications muted");
    } catch (e) { console.error(e); setToastMessage("Error muting chat"); }
    setShowMuteModal(false);
  };

  const handleUnmute = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { mutedBy: arrayRemove(uid) });
      setIsMuted(false);
      setToastMessage("Notifications unmuted");
    } catch (e) { console.error(e); setToastMessage("Error unmuting chat"); }
  };

  const handleDeleteChat = async () => {
    try {
      await deleteDoc(doc(db, "chats", chatId));
      navigate("/chats");
    } catch (e) { console.error(e); setToastMessage("Error deleting chat"); }
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
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", messageToDelete.id), {
        isDeleted: true,
        text: "",
        fileUrl: "",
        type: "text"
      });
      setToastMessage("Message deleted successfully");
    } catch (e) {
      console.error(e);
      setToastMessage("Error deleting message");
    }
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

    // Only allow images in chat
    if (!file.type.startsWith("image/")) {
      setToastMessage("Only images are allowed in chat");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Check file size (max 10MB for images)
    if (file.size > 10 * 1024 * 1024) {
      setToastMessage("Image size must be less than 10MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, "image");
      await sendMessageInternal({ type: "image", fileUrl: url, text: "Image" });
    } catch (err) {
      console.error("Image upload failed", err);
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
        console.error(err);
        setToastMessage("Failed to update message");
      }
      return;
    }

    await sendMessageInternal({ type: "text", text: text.trim() });
    setText("");
  };

  const sendMessageInternal = async ({ type, text, fileUrl = "" }) => {
    if (isBlocked) return;

    const msgData = {
      text,
      senderId: uid,
      createdAt: serverTimestamp(),
      type,
      fileUrl,
      deliveredTo: [uid], // Initially delivered to sender (you)
      // Don't include seenBy initially for the recipient
      replyTo: replyTo ? {
        id: replyTo.id,
        text: replyTo.text,
        type: replyTo.type,
        senderId: replyTo.senderId
      } : null
    };

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), msgData);

      const otherUser = chat.participants.find(x => x !== uid);
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        lastSenderId: uid,
        updatedAt: serverTimestamp(),
        [`unseenCounts.${otherUser}`]: increment(1)
      });

      setReplyTo(null);

      // Simulate delivery to recipient if they are online
      if (userStatus.online) {
        setTimeout(async () => {
          try {
            // Get the latest message (the one we just sent)
            const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), orderBy("senderId"));
            const querySnapshot = await getDoc(q);
            if (querySnapshot.exists()) {
              await updateDoc(doc(db, "chats", chatId, "messages", querySnapshot.id), {
                deliveredTo: arrayUnion(otherUser)
              });
            }
          } catch (error) {
            console.error("Error updating delivery status:", error);
          }
        }, 1000);
      }

    } catch (err) {
      console.error("Send error", err);
      setToastMessage("Failed to send");
    }
  };

  // --- Call Logic Removed ---

  // --- Render ---

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto shadow-2xl relative">
      {viewingImage && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <FiX size={24} />
          </button>
          <img
            src={viewingImage}
            alt="Full view"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {showBlockModal && (
        <Modal
          title="Block User"
          onClose={() => setShowBlockModal(false)}
          onConfirm={handleBlock}
          confirmText="Block"
        >
          Are you sure you want to block this user? You won't receive any messages from them.
        </Modal>
      )}

      {showMuteModal && (
        <Modal
          title="Mute Notifications"
          onClose={() => setShowMuteModal(false)}
          onConfirm={handleMute}
          confirmText="Mute"
          confirmColor="bg-yellow-600"
        >
          Are you sure you want to mute notifications for this chat?
        </Modal>
      )}

      {showDeleteModal && (
        <Modal
          title="Delete Chat"
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteChat}
          confirmText="Delete"
        >
          Are you sure you want to delete this chat? This action cannot be undone.
        </Modal>
      )}

      {showDeleteMessageModal && (
        <Modal
          title="Delete Message"
          onClose={() => setShowDeleteMessageModal(false)}
          onConfirm={confirmDeleteMessage}
          confirmText="Delete"
        >
          Are you sure you want to delete this message? This cannot be undone.
        </Modal>
      )}

      <header className="bg-white px-4 py-3 flex items-center justify-between border-b sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <FiArrowLeft size={20} />
          </button>
          <div className="relative">
            <img
              src={profile.photoURL || profile.profileImage || defaultProfile}
              alt={profile.username}
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
            />
            {userStatus.online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <h1 className="font-bold text-sm text-gray-900">{profile.username || "User"}</h1>
            <p className={`text-xs ${userStatus.online ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {userStatus.online ? 'Active now' : `Last seen: ${formatLastSeen(userStatus.lastSeen)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">

          <button onClick={() => setShowOptions(!showOptions)} className="p-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors relative">
            <FiMoreVertical size={20} />
            {showOptions && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border py-2 z-30 w-48 animate-fade-in">
                {isBlocked ? (
                  <button onClick={handleUnblock} className="w-full px-4 py-2 text-left text-green-600 hover:bg-green-50 text-sm font-medium">Unblock User</button>
                ) : (
                  <button onClick={() => { setShowBlockModal(true); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 text-sm font-medium">Block User</button>
                )}

                {isMuted ? (
                  <button onClick={() => { handleUnmute(); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm">Unmute Notifications</button>
                ) : (
                  <button onClick={() => { setShowMuteModal(true); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm">Mute Notifications</button>
                )}

                <button onClick={() => { setShowDeleteModal(true); setShowOptions(false); }} className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm">Delete Chat</button>
              </div>
            )}
          </button>
        </div>
      </header>

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-white p-4 space-y-2"
      >
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === uid;
          const dateLabel = getDateLabel(msg.createdAt);
          const prevDateLabel = index > 0 ? getDateLabel(messages[index - 1].createdAt) : null;
          const showDate = dateLabel !== prevDateLabel;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="text-gray-500 text-xs font-medium">
                    {dateLabel}
                  </span>
                </div>
              )}

              <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} group mb-0.5`}>
                {/* For non-deleted messages from others */}
                {!msg.isDeleted && !isOwn && (
                  <MessageActionsComponent
                    message={msg}
                    onReply={() => setReplyTo(msg)}
                    onCopy={() => { navigator.clipboard.writeText(msg.text); setToastMessage("Copied") }}
                    isOwnMessage={false}
                  />
                )}

                {/* For deleted messages from others */}
                {msg.isDeleted && !isOwn && (
                  <MessageActionsComponent
                    message={msg}
                    onDelete={() => handleDeleteMessageRequest(msg)}
                    isOwnMessage={false}
                  />
                )}

                <div className={`max-w-[75%] relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.replyTo && !msg.isDeleted && (
                    <div className={`text-xs mb-1 px-3 py-2 rounded-lg bg-gray-200/50 border-l-4 ${isOwn ? 'border-blue-500' : 'border-gray-500'} w-full`}>
                      <p className="font-bold opacity-70">{msg.replyTo.senderId === uid ? 'You' : profile.username}</p>
                      <p className="truncate opacity-60">{msg.replyTo.type === 'audio' ? 'Voice Message' : msg.replyTo.text}</p>
                    </div>
                  )}

                  <div className={`px-3 py-2 rounded-lg shadow-sm relative min-w-[100px] ${isOwn
                    ? 'bg-[#d1e4f9] text-gray-900 rounded-tr-none'
                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                    }`}>

                    {msg.isDeleted ? (
                      <div className="flex items-center gap-2 text-gray-500 italic text-sm">
                        <FiSlash size={14} /> This message was deleted
                      </div>
                    ) : (
                      <>
                        {msg.type === 'text' && <p className="whitespace-pre-wrap text-sm leading-relaxed pr-2 pb-1">{msg.text}</p>}

                        {msg.type === 'image' && (
                          <img
                            src={msg.fileUrl}
                            alt="Shared"
                            onClick={() => setViewingImage(msg.fileUrl)}
                            className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          />
                        )}

                        {msg.type === 'audio' && (
                          <AudioMessage fileUrl={msg.fileUrl} isOwnMessage={isOwn} />
                        )}

                        {msg.type === 'file' && (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline opacity-90 hover:opacity-100">
                            <FiFile size={16} /> {msg.text}
                          </a>
                        )}
                      </>
                    )}

                    <div className={`flex items-center justify-end gap-1 mt-1 float-right ml-2`}>
                      {msg.isEdited && !msg.isDeleted && <span className="text-[10px] text-gray-500 italic">(edited)</span>}
                      <span className="text-[10px] text-gray-500">{formatTime(msg.createdAt)}</span>
                      {/* WhatsApp-like tick system */}
                      <MessageTickIcon
                        message={msg}
                        otherUserId={otherUserId}
                        isOwnMessage={isOwn}
                      />
                    </div>
                  </div>
                </div>

                {/* For your own messages (both deleted and non-deleted) */}
                {isOwn && (
                  <MessageActionsComponent
                    message={msg}
                    onReply={() => !msg.isDeleted && setReplyTo(msg)}
                    onCopy={() => !msg.isDeleted && navigator.clipboard.writeText(msg.text)}
                    onEdit={() => !msg.isDeleted && handleEditMessage(msg)}
                    onDelete={() => handleDeleteMessageRequest(msg)}
                    isOwnMessage={true}
                  />
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isAtBottom && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-20 right-4 bg-white p-2 rounded-full shadow-lg border text-blue-600 hover:bg-blue-50 transition-all z-10"
        >
          <FiArrowLeft className="-rotate-90" />
        </button>
      )}

      <div className="bg-white border-t p-2">
        {replyTo && (
          <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border-l-4 border-blue-500">
            <div className="text-xs">
              <span className="font-bold text-blue-600">Replying to {replyTo.senderId === uid ? 'yourself' : profile.username}</span>
              <p className="text-gray-500 truncate max-w-[200px]">{replyTo.type === 'audio' ? 'Voice Message' : replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)}><FiX size={16} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
        )}

        {editingId && (
          <div className="flex items-center justify-between bg-yellow-50 p-2 rounded-lg mb-2 border-l-4 border-yellow-500">
            <div className="text-xs">
              <span className="font-bold text-yellow-600">Editing Message</span>
            </div>
            <button onClick={() => { setEditingId(null); setText(""); }}><FiX size={16} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 bg-red-50 p-2 rounded-full animate-pulse border border-red-100">
            <FiMic className="text-red-500 ml-2" size={20} />
            <span className="flex-1 font-mono text-red-600 font-medium">{formatRecordingTime(recordingTime)}</span>
            <button onClick={cancelRecording} className="p-2 text-gray-500 hover:text-gray-700"><FiTrash2 size={20} /></button>
            <button onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"><FiSend size={18} /></button>
          </div>
        ) : (
          <form onSubmit={handleTextSend} className="flex items-center gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" disabled={uploading} />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
              disabled={uploading}
            >
              <MdAdd size={24} />
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type a message..."
                disabled={uploading}
                className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-full px-4 py-2 text-sm transition-all outline-none shadow-sm"
              />
            </div>

            {text.trim() ? (
              <button type="submit" disabled={uploading} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100">
                <FiSend size={20} className="ml-0.5" />
              </button>
            ) : (
              <button type="button" onClick={startRecording} disabled={uploading} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50">
                <MdMic size={28} />
              </button>
            )}
          </form>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-medium shadow-lg animate-fade-in z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}