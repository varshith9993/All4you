import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import {
  doc, getDoc, collection, query, where, onSnapshot, addDoc, setDoc, deleteDoc, serverTimestamp, getDocs, updateDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { FiArrowLeft, FiStar, FiMessageSquare, FiHeart, FiShare2, FiX, FiMapPin, FiMoreVertical, FiTrash2, FiFileText, FiFile, FiEye, FiDownload, FiAlertCircle, FiExternalLink, FiLoader } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.png";

function ManualStars({ value, onChange, size = 46 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ fontSize: size, display: "flex", gap: 5, margin: "12px 0" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          style={{
            color: (hover || value) >= i ? "#ffd700" : "#ddd",
            cursor: "pointer"
          }}
        >★</span>
      ))}
    </div>
  );
}

function formatDateTime(dateObj) {
  if (!dateObj) return "";
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}

function formatRelativeTime(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// Function to get download URL with forced download
function getDownloadUrl(url) {
  if (!url) return "";

  // For Cloudinary URLs, we need to add fl_attachment flag properly
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    // If fl_attachment is already present, return as is
    if (url.includes("fl_attachment")) {
      return url;
    }

    // Add fl_attachment flag to force download
    // Find the position of '/upload/' and insert 'fl_attachment/' after it
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex !== -1) {
      const prefix = url.substring(0, uploadIndex + 8); // '/upload/' is 8 characters
      const suffix = url.substring(uploadIndex + 8);
      return `${prefix}fl_attachment/${suffix}`;
    }
  }

  // For Firebase Storage URLs, return as-is (they already have download tokens)
  return url;
}

// Function to check if file can be viewed online based on size
function canViewOnline(fileSize, extension) {
  const MAX_VIEWABLE_SIZE = 10 * 1024 * 1024; // 10MB

  // Check file size limit
  if (fileSize > MAX_VIEWABLE_SIZE) {
    return false;
  }

  // Check file type support
  const viewableExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'];
  return viewableExtensions.includes(extension);
}

// Function to get file information with size validation
function getFileInfo(url, sizeInBytes = null) {
  const fileName = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const ext = fileName.split('.').pop().toLowerCase();

  const fileTypes = {
    pdf: { icon: FiFileText, color: "text-red-600", label: "PDF", canView: true },
    doc: { icon: FiFileText, color: "text-blue-600", label: "DOC", canView: true },
    docx: { icon: FiFileText, color: "text-blue-600", label: "DOCX", canView: true },
    ppt: { icon: FiFileText, color: "text-orange-600", label: "PPT", canView: true },
    pptx: { icon: FiFileText, color: "text-orange-600", label: "PPTX", canView: true },
    xls: { icon: FiFileText, color: "text-green-600", label: "XLS", canView: true },
    xlsx: { icon: FiFileText, color: "text-green-600", label: "XLSX", canView: true },
    txt: { icon: FiFile, color: "text-gray-600", label: "TEXT", canView: true },
    csv: { icon: FiFile, color: "text-teal-600", label: "CSV", canView: true },
    rtf: { icon: FiFile, color: "text-purple-600", label: "RTF", canView: false },
    zip: { icon: FiFile, color: "text-gray-600", label: "ZIP", canView: false },
    rar: { icon: FiFile, color: "text-gray-600", label: "RAR", canView: false },
    '7z': { icon: FiFile, color: "text-gray-600", label: "7ZIP", canView: false },
  };

  const info = fileTypes[ext] || { icon: FiFile, color: "text-gray-600", label: ext.toUpperCase(), canView: false };

  // Calculate file size
  let fileSize = "Unknown size";
  let isOversized = false;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  if (sizeInBytes && sizeInBytes > 0) {
    // Check if file exceeds 10MB limit
    if (sizeInBytes > MAX_FILE_SIZE) {
      isOversized = true;
    }

    // Format file size for display
    if (sizeInBytes < 1024) {
      fileSize = `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      fileSize = `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
      fileSize = `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  return {
    name: fileName,
    extension: ext,
    downloadUrl: getDownloadUrl(url),
    size: fileSize,
    isOversized: isOversized,
    rawSize: sizeInBytes,
    ...info
  };
}

// Function to open file in proper viewer
function openFileViewer(url, fileName, extension, fileSize = null) {
  // For image files - handled separately in carousel/lightbox
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  if (imageExtensions.includes(extension)) {
    // This will be handled by the existing image viewing logic
    return false;
  }

  // Check if file can be viewed online
  if (!canViewOnline(fileSize, extension)) {
    // File is too large for online viewing, force download
    const downloadUrl = getDownloadUrl(url);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  // For ALL documents (PDFs, PPTX, DOCX, etc.) - use Google Docs Viewer
  const officeExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'];
  if (officeExtensions.includes(extension)) {
    const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    window.open(googleDocsViewerUrl, '_blank');
    return true;
  }

  // For other files - just download
  const downloadUrl = getDownloadUrl(url);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

// Function to get file size from URL (if available in metadata)
async function getFileSizeFromUrl(url) {
  try {
    // Try to get file size via HEAD request
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        return parseInt(contentLength, 10);
      }
    }
  } catch (error) {
    console.warn('Could not fetch file size:', error);
  }
  return null;
}

export default function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState("");
  const [worker, setWorker] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [userRatingDoc, setUserRatingDoc] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [userHasFavorited, setUserHasFavorited] = useState(false);
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [toast, setToast] = useState("");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileSizes, setFileSizes] = useState({});
  const [loadingFiles, setLoadingFiles] = useState({});
  const [fileLoadErrors, setFileLoadErrors] = useState({});

  // Get auth user
  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u => setCurrentUserId(u?.uid ?? ""));
    return unsub;
  }, []);

  // Define updateWorkerRating with useCallback to avoid infinite loops
  const updateWorkerRating = useCallback(async () => {
    if (!worker || !id) return;

    try {
      // Recalculate average rating including the new one
      // We fetch all reviews again to be safe and accurate
      const q = query(collection(db, "workerReviews"), where("workerId", "==", id));
      const snap = await getDocs(q);
      let sum = 0;
      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (typeof data.rating === "number" && data.rating > 0) {
          sum += data.rating;
          count++;
        }
      });

      const newAvg = count > 0 ? sum / count : 0;

      // Update the worker document
      try {
        await updateDoc(doc(db, "workers", id), {
          rating: newAvg
        });
      } catch (e) {
        console.warn("Failed to update worker document rating (likely permission error):", e);
      }

      // ALSO update the creator's profile rating
      if (worker && worker.createdBy) {
        try {
          await updateDoc(doc(db, "profiles", worker.createdBy), {
            rating: newAvg
          });
        } catch (e) {
          console.warn("Failed to update creator profile rating (likely permission error):", e);
        }
      }
    } catch (error) {
      console.error("Error calculating average rating:", error);
    }
  }, [id, worker]);

  // Fetch worker and creator profile
  useEffect(() => {
    if (!id) return;
    const unsubscribeWorker = onSnapshot(doc(db, "workers", id), async (snap) => {
      if (snap.exists()) {
        const workerData = { id: snap.id, ...snap.data() };
        setWorker(workerData);

        // Fetch creator profile
        if (workerData.createdBy) {
          const profileSnap = await getDoc(doc(db, "profiles", workerData.createdBy));
          if (profileSnap.exists()) {
            setCreatorProfile(profileSnap.data());
          }
        }
      }
    });

    // Fetch reviews
    // Note: We removed orderBy("createdAt", "desc") to avoid needing a composite index immediately.
    // We will sort client-side instead.
    const reviewQ = query(
      collection(db, "workerReviews"), where("workerId", "==", id)
    );
    const unsubscribeReviews = onSnapshot(reviewQ, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort client-side
      data.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      setReviews(data);
      const userRate = data.find(r => r.userId === currentUserId && typeof r.rating === "number" && r.rating > 0);
      setUserRatingDoc(userRate ?? null);

      const userIds = Array.from(new Set(data.map(r => r.userId)));
      if (userIds.length > 0) {
        Promise.all(userIds.map(uid =>
          getDoc(doc(db, "profiles", uid)).then(profileSnap =>
            profileSnap.exists()
              ? { [uid]: profileSnap.data() }
              : { [uid]: { username: "Anonymous", profileImage: "" } }
          )
        )).then(profileArrs => {
          const profilesMap = Object.assign({}, ...profileArrs);
          setProfiles(profilesMap);
        });
      }
    });

    return () => {
      unsubscribeWorker();
      unsubscribeReviews();
    };
  }, [id, currentUserId]);

  // Favorite status
  useEffect(() => {
    if (!currentUserId || !id) return;
    getDoc(doc(db, "workerFavorites", `${currentUserId}_${id}`)).then(snap => setUserHasFavorited(snap.exists()));
  }, [currentUserId, id]);

  // Calculate file sizes when worker data changes
  useEffect(() => {
    if (!worker || !worker.files) return;

    const fetchFileSizes = async () => {
      const newFileSizes = {};
      const files = worker.files || [];

      for (const url of files) {
        try {
          // Add loading state for this file
          setLoadingFiles(prev => ({ ...prev, [url]: true }));

          const size = await getFileSizeFromUrl(url);
          if (size !== null) {
            newFileSizes[url] = size;
          }

          // Remove loading state
          setLoadingFiles(prev => ({ ...prev, [url]: false }));
        } catch (error) {
          console.warn(`Failed to get size for ${url}:`, error);
          setLoadingFiles(prev => ({ ...prev, [url]: false }));
        }
      }

      setFileSizes(newFileSizes);
    };

    fetchFileSizes();
  }, [worker]);

  // Calculate Ratings from Reviews
  const ratingVals = [5, 4, 3, 2, 1];
  const starCounts = [0, 0, 0, 0, 0];
  let totalRatings = 0, ratingSum = 0;
  reviews.forEach(r => {
    if (typeof r.rating === "number" && r.rating > 0) {
      const idx = Math.max(1, Math.min(5, Math.round(r.rating))) - 1;
      starCounts[idx]++;
      ratingSum += r.rating;
      totalRatings++;
    }
  });
  const avgRating = totalRatings ? (ratingSum / totalRatings).toFixed(1) : "0.0";

  // Self-healing: Update DB if calculated rating differs from stored rating
  // DISABLED: This was causing permission errors because non-owners can't update worker documents
  // Rating is now only updated when reviews are submitted
  // useEffect(() => {
  //   if (worker && typeof avgRating !== 'undefined') {
  //     const storedRating = worker.rating || 0;
  //     const calculatedRating = parseFloat(avgRating);
  //     // Allow small float difference
  //     if (Math.abs(storedRating - calculatedRating) > 0.1) {
  //       console.log("Syncing rating...", storedRating, calculatedRating);
  //       updateWorkerRating();
  //     }
  //   }
  // }, [worker, avgRating, updateWorkerRating]); // Added updateWorkerRating to dependencies

  const toggleFavorite = async () => {
    if (!currentUserId) { setToast("Please login to favorite!"); return; }
    const favDoc = doc(db, "workerFavorites", `${currentUserId}_${id}`);
    try {
      if (userHasFavorited) {
        await deleteDoc(favDoc);
        setUserHasFavorited(false);
      } else {
        await setDoc(favDoc, { workerId: id, userId: currentUserId, createdAt: serverTimestamp() });
        setUserHasFavorited(true);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      setToast("Failed to update favorites");
    }
  };

  const submitReview = async () => {
    if (!currentUserId) { setToast("Please login to review!"); return; }

    if (rateModalOpen) {
      if (newRating === 0) { setToast("Please choose a rating!"); return; }
      if (userRatingDoc) {
        setToast("Already rated!");
        setTimeout(() => setToast(""), 1500);
        return;
      }

      try {
        await addDoc(collection(db, "workerReviews"), {
          workerId: id, userId: currentUserId, rating: newRating, text: "", createdAt: serverTimestamp()
        });

        // Update the main worker document with new average rating
        await updateWorkerRating();

        // Create notification
        if (worker && worker.createdBy && worker.createdBy !== currentUserId) {
          try {
            await addDoc(collection(db, "notifications"), {
              userId: worker.createdBy,
              senderId: currentUserId,
              type: "review",
              title: "New Rating",
              message: `Your worker profile "${worker.title}" received a ${newRating} star rating`,
              link: `/worker-detail/${id}`,
              postId: id,
              postType: "worker",
              read: false,
              createdAt: serverTimestamp()
            });
          } catch (nErr) { console.error("Notif error", nErr); }
        }

        setNewRating(0);
        setRateModalOpen(false);
        setToast("Rating submitted!");
      } catch (error) {
        console.error("Error submitting rating:", error);
        setToast("Failed to submit rating");
      }
    }

    if (commentModalOpen) {
      if (!newReviewText.trim()) { setToast("Please write your review."); return; }

      try {
        await addDoc(collection(db, "workerReviews"), {
          workerId: id, userId: currentUserId, rating: null, text: newReviewText.trim(), createdAt: serverTimestamp()
        });

        // Create notification
        if (worker && worker.createdBy && worker.createdBy !== currentUserId) {
          try {
            await addDoc(collection(db, "notifications"), {
              userId: worker.createdBy,
              senderId: currentUserId,
              type: "review",
              title: "New Review",
              message: `New review on your worker profile "${worker.title}": "${newReviewText.substring(0, 50)}${newReviewText.length > 50 ? '...' : ''}"`,
              link: `/worker-detail/${id}`,
              postId: id,
              postType: "worker",
              read: false,
              createdAt: serverTimestamp()
            });
          } catch (nErr) { console.error("Notif error", nErr); }
        }

        setNewReviewText("");
        setCommentModalOpen(false);
        setToast("Review submitted!");
      } catch (error) {
        console.error("Error submitting review:", error);
        setToast("Failed to submit review");
      }
    }

    setTimeout(() => setToast(""), 1800);
  };

  const deleteReview = async (reviewId, hasRating) => {
    if (!window.confirm("Are you sure you want to delete this review? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, "workerReviews", reviewId));

      if (hasRating) {
        await updateWorkerRating();
      }

      setToast("Review deleted");
      setActiveMenuId(null);
    } catch (error) {
      console.error("Error deleting review:", error);
      setToast("Failed to delete review");
    }

    setTimeout(() => setToast(""), 2000);
  };

  const shareWorker = async () => {
    if (!worker) return;

    const shareData = {
      title: worker.title || "Worker Profile",
      text: worker.description ? worker.description.substring(0, 100) + "..." : "Check out this worker profile",
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        // Optional: Show success message
        // setToast("Shared successfully!");
      } catch (error) {
        // Silently handle user cancellation or minor errors
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
          console.error("Error sharing:", error);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        setToast("Link copied to clipboard!");
        setTimeout(() => setToast(""), 2200);
      } catch (copyError) {
        // Fallback to old method
        try {
          const textArea = document.createElement('textarea');
          textArea.value = window.location.href;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setToast("Link copied to clipboard!");
          setTimeout(() => setToast(""), 2200);
        } catch (e) {
          console.error("Fallback copy failed:", e);
        }
      }
    }
  };

  const startChat = async () => {
    if (!currentUserId || !worker) {
      console.log("Missing user or worker data");
      return;
    }
    const recipientId = worker.createdBy;
    if (recipientId === currentUserId) {
      setToast("You cannot chat with yourself");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    try {
      const chatsRef = collection(db, "chats");
      // Check for ANY existing chat between these two users (regardless of context)
      const q = query(chatsRef, where("participants", "array-contains", currentUserId));
      let chatId = null;
      const snap = await getDocs(q);

      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (
          data.participants &&
          data.participants.includes(recipientId)
        ) {
          chatId = docSnap.id;
        }
      });

      if (chatId) {
        // Chat already exists, show message and navigate
        setToast("There is already a chat with this user");
        setTimeout(() => setToast(""), 2500);
        navigate(`/chat/${chatId}`);
        return;
      }

      // Create new chat only if none exists
      console.log("Creating new chat...");
      const newDoc = await addDoc(chatsRef, {
        participants: [currentUserId, recipientId],
        initiatorId: currentUserId,
        workerId: id,
        lastMessage: "",
        unseenCounts: { [currentUserId]: 0, [recipientId]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      chatId = newDoc.id;

      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error starting chat:", error);
      setToast("Failed to start chat");
      setTimeout(() => setToast(""), 2000);
    }
  };

  const handleDownload = async (url, fileName) => {
    // Standard download for all files (including PDFs) using the force-download URL
    // This relies on Cloudinary's "fl_attachment" flag which works correctly for raw files now
    const downloadUrl = getDownloadUrl(url);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName; // Hint to browser, though Cloudinary header takes precedence
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openFilePreview = (url) => {
    const fileSize = fileSizes[url] || null;
    const fileInfo = getFileInfo(url, fileSize);
    setCurrentFile({
      url: url,
      ...fileInfo
    });
    setFileViewerOpen(true);
  };

  const handleFileLoadError = (url) => {
    setFileLoadErrors(prev => ({ ...prev, [url]: true }));
  };

  if (!worker) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  // Prioritize worker-specific avatar, then creator profile, then default
  const displayProfileImage = worker.avatarUrl || creatorProfile?.photoURL || creatorProfile?.profileImage || defaultAvatar;
  const displayUsername = creatorProfile?.username || "Unknown User";

  // Safe tags handling
  const displayTags = Array.isArray(worker.tags) ? worker.tags : (typeof worker.tags === 'string' ? worker.tags.split(',').map(t => t.trim()) : []);

  // Check if current user is the owner of the worker profile
  const isOwner = worker.createdBy === currentUserId;

  // Separate images from documents with proper filtering
  const files = worker.files || [];
  const imageFiles = files.filter(url => {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  });
  const documentFiles = files.filter(url => {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return !['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  });

  return (
    <div className="relative bg-white min-h-screen flex flex-col max-w-md mx-auto" onClick={() => setActiveMenuId(null)}>
      {/* Top bar */}
      <div className="flex items-center mb-1 pt-2 px-3 sticky top-0 bg-white z-20 shadow-sm py-2">
        <button className="mr-3 text-blue-600 rounded-full p-2 hover:bg-blue-50 transition-colors" onClick={() => navigate("/workers")} aria-label="Back">
          <FiArrowLeft size={24} />
        </button>
        <div className="font-bold text-lg text-gray-800 flex-1 truncate">Worker Details</div>
        <div className="flex gap-3 items-center ml-auto">
          <button onClick={shareWorker} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <FiShare2 size={20} className="text-gray-600" />
          </button>
          {!isOwner && (
            <button onClick={toggleFavorite} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <FiHeart size={20} className={userHasFavorited ? "text-red-600 fill-red-600" : "text-gray-600"} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-24 overflow-y-auto">

        {/* 1. Profile Image */}
        <div className="flex justify-center mt-4 mb-3">
          <img
            src={displayProfileImage}
            alt={displayUsername}
            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
            onError={(e) => { e.target.src = defaultAvatar; }}
          />
        </div>

        {/* 2. Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{worker.title}</h1>
          <p className="text-sm text-gray-500 mt-1 tracking-normal">by {displayUsername}</p>
        </div>

        {/* 3. Description */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl">
          <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Description</h3>
          <p className="text-gray-700 leading-normal whitespace-pre-wrap tracking-normal" style={{ wordSpacing: '0.05em' }}>{worker.description}</p>
        </div>

        {/* 4. Tags */}
        {displayTags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Skills & Tags</h3>
            <div className="flex flex-wrap gap-2">
              {displayTags.map((tag, index) => (
                <span key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium tracking-normal">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 5. Location */}
        {worker.location && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Location</h3>
            <div className="flex items-start text-gray-700 bg-gray-50 p-3 rounded-lg">
              <FiMapPin className="mt-0.5 mr-2 flex-shrink-0 text-blue-600" />
              <span className="tracking-normal leading-normal">
                {worker.location.area && `${worker.location.area}, `}
                {worker.location.city && `${worker.location.city}`}
                {worker.location.pincode && ` - ${worker.location.pincode}`}
                {worker.location.landmark && <div className="text-sm text-gray-500 mt-1.5 tracking-normal">Landmark: {worker.location.landmark}</div>}
              </span>
            </div>
          </div>
        )}

        {/* 6. Work Gallery (Images) */}
        {imageFiles.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Work Gallery</h3>
            <div className="w-full flex items-center justify-center">
              <div style={{
                width: "100%", height: 250,
                position: "relative", borderRadius: 16, background: "#f3f4f6"
              }}
                className="overflow-hidden flex justify-center items-center shadow-sm border border-gray-100"
              >
                {imageFiles.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setCarouselIdx(i => (i - 1 + imageFiles.length) % imageFiles.length); }}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full text-gray-800 shadow-md hover:bg-white z-10">‹</button>
                    <button onClick={(e) => { e.stopPropagation(); setCarouselIdx(i => (i + 1) % imageFiles.length); }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full text-gray-800 shadow-md hover:bg-white z-10">›</button>
                  </>
                )}

                <img src={imageFiles[carouselIdx % imageFiles.length]} alt="work sample"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setViewingImage(imageFiles[carouselIdx % imageFiles.length])}
                  onError={() => handleFileLoadError(imageFiles[carouselIdx % imageFiles.length])}
                />

                {loadingFiles[imageFiles[carouselIdx % imageFiles.length]] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <FiLoader className="animate-spin text-white" size={32} />
                  </div>
                )}

                {fileLoadErrors[imageFiles[carouselIdx % imageFiles.length]] && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-70 p-4">
                    <FiAlertCircle className="text-red-400 mb-2" size={32} />
                    <p className="text-white text-sm text-center">Failed to load image</p>
                  </div>
                )}

                {imageFiles.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {imageFiles.map((_, idx) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === (carouselIdx % imageFiles.length) ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. Documents Section with Proper Viewing */}
        {documentFiles.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-900 tracking-tight">Files & Documents</h3>
            <div className="flex items-center gap-1 text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded-full"></div>
            <div className="space-y-3">
              {documentFiles.map((url, idx) => {
                const fileSize = fileSizes[url] || null;
                const fileInfo = getFileInfo(url, fileSize);
                const IconComponent = fileInfo.icon;
                const isLoading = loadingFiles[url];
                const hasError = fileLoadErrors[url];
                const canViewOnlineResult = canViewOnline(fileSize || 0, fileInfo.extension);

                return (
                  <div key={idx} className={`flex items-center justify-between p-3 bg-gray-50 rounded-xl border ${fileInfo.isOversized ? 'border-red-200 bg-red-50' : 'border-gray-100'} hover:bg-gray-100 transition-colors`}>
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <div className={`p-2 rounded-lg border ${fileInfo.color.replace('text-', 'border-')} bg-white shadow-sm flex-shrink-0`}>
                        {isLoading ? (
                          <FiLoader className="animate-spin text-gray-400" size={20} />
                        ) : (
                          <IconComponent size={20} className={fileInfo.color} />
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden flex-1">
                        <span className="text-sm font-medium text-gray-900 truncate">{fileInfo.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 uppercase">{fileInfo.label}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{fileInfo.size}</span>
                          {fileInfo.isOversized && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-red-600 font-medium">Large file</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      {hasError ? (
                        <div className="px-3 py-1.5 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg flex items-center gap-2 whitespace-nowrap">
                          <FiAlertCircle size={14} /> Error
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openFilePreview(url)}
                            disabled={isLoading || !canViewOnlineResult}
                            className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap flex items-center gap-2 ${canViewOnlineResult ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'}`}
                          >
                            <FiEye size={14} /> View
                          </button>
                          <button
                            onClick={() => handleDownload(url, fileInfo.name)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
                          >
                            <FiDownload size={14} /> Save
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <hr className="border-gray-200 mb-6" />

        {/* 8. Total Rating */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-900 mb-4 tracking-tight">Ratings & Reviews</h3>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex flex-col items-center justify-center bg-yellow-50 p-3 rounded-lg min-w-[80px]">
                <span className="text-3xl font-bold text-gray-900">{avgRating}</span>
                <div className="flex text-yellow-400 text-sm">
                  {[1, 2, 3, 4, 5].map(star => (
                    <FiStar key={star} className={star <= Math.round(avgRating) ? "fill-current" : "text-gray-300"} />
                  ))}
                </div>
                <span className="text-xs text-gray-500 mt-1">{totalRatings} ratings</span>
              </div>

              <div className="flex-1">
                {ratingVals.map((star, idx) => (
                  <div key={star} className="flex items-center gap-2 text-xs mb-1">
                    <span className="w-3 font-medium text-gray-600">{star}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-yellow-400 h-full rounded-full"
                        style={{ width: `${(starCounts[star - 1] / Math.max(1, totalRatings)) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-500 font-medium">{starCounts[star - 1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 9. All Reviews */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 tracking-tight">User Reviews</h3>
          </div>

          {reviews.filter(r => r.text && r.text.trim()).length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500">
              <FiMessageSquare className="mx-auto mb-2 opacity-20" size={32} />
              <p>No written reviews yet.</p>
              <p className="text-sm mt-1">Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.filter(r => r.text && r.text.trim()).map(r => {
                const user = profiles[r.userId] || { username: "Unknown", profileImage: "" };
                const dt = r.createdAt && r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000) : null;
                return (
                  <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative">
                    <div className="flex items-start gap-3">
                      <img
                        src={user.profileImage || defaultAvatar}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        onError={(e) => { e.target.src = defaultAvatar; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-gray-900 truncate pr-2">
                            {user.username || "Unknown User"}
                          </h4>

                          {/* Three dots menu for owner or review creator */}
                          {(isOwner || r.userId === currentUserId) && (
                            <div className="relative ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === r.id ? null : r.id);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                              >
                                <FiMoreVertical size={18} />
                              </button>

                              {activeMenuId === r.id && (
                                <div className="absolute right-0 top-8 bg-white shadow-lg border border-gray-100 rounded-lg py-1 z-10 w-32 animate-scale-in">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteReview(r.id, r.rating > 0);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <FiTrash2 size={14} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 mb-1">
                          {dt ? formatDateTime(dt) : ""}
                        </div>

                        {r.rating > 0 && (
                          <div className="flex text-yellow-400 text-xs mb-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <FiStar key={star} className={star <= r.rating ? "fill-current" : "text-gray-300"} />
                            ))}
                          </div>
                        )}
                        <p className="text-gray-700 text-sm leading-normal mt-1 tracking-normal" style={{ wordSpacing: '0.05em' }}>{r.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="fixed left-0 right-0 bottom-0 bg-white px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t z-30"
        style={{ maxWidth: 480, margin: "0 auto" }}>
        {!isOwner ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                disabled={!!userRatingDoc}
                onClick={() => setRateModalOpen(true)}
                className={`rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${!!userRatingDoc ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-yellow-400 text-black hover:bg-yellow-500"}`}
              >
                <FiStar className={!!userRatingDoc ? "fill-gray-400" : "fill-black"} />
                {!!userRatingDoc ? "Rated" : "Rate"}
              </button>
              <button
                onClick={() => setCommentModalOpen(true)}
                className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <FiMessageSquare /> Review
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={toggleFavorite}
                className={`rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${userHasFavorited ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                <FiHeart className={userHasFavorited ? "fill-current" : ""} /> {userHasFavorited ? "Saved" : "Save"}
              </button>
              <button className="bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors" onClick={shareWorker}>
                <FiShare2 /> Share
              </button>
              <button onClick={startChat}
                className="bg-green-600 text-white hover:bg-green-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <FiMessageSquare /> Chat
              </button>
            </div>
          </>
        ) : (
          <button className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md" onClick={shareWorker}>
            <FiShare2 /> Share Your Profile
          </button>
        )}
      </div>

      {/* Rate Modal */}
      {rateModalOpen && (
        <Modal onClose={() => { setRateModalOpen(false); setNewRating(0); }}>
          <h3 className="mb-4 text-center text-lg font-bold text-gray-900">Rate this Worker</h3>
          <div className="flex flex-col items-center py-2">
            <ManualStars value={newRating} onChange={setNewRating} size={42} />
            <p className="text-sm text-gray-500 mb-6">{newRating > 0 ? `You rated ${newRating} star${newRating > 1 ? 's' : ''}` : 'Tap stars to rate'}</p>
            <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={submitReview}
              disabled={newRating === 0 || !!userRatingDoc}>
              Submit Rating
            </button>
          </div>
        </Modal>
      )}

      {/* Review Modal */}
      {commentModalOpen && (
        <Modal onClose={() => { setCommentModalOpen(false); setNewReviewText(""); }}>
          <h3 className="mb-4 text-center text-lg font-bold text-gray-900">Write a Review</h3>
          <textarea rows={5} value={newReviewText}
            onChange={e => setNewReviewText(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Share your experience with this worker..."
          />
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={submitReview}
            disabled={newReviewText.trim().length === 0}>
            Post Review
          </button>
        </Modal>
      )}

      {/* File Viewer Modal */}
      {fileViewerOpen && currentFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col items-center justify-center p-4 animate-fade-in">
          <button
            onClick={() => setFileViewerOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-10"
          >
            <FiX size={24} />
          </button>

          <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gray-800 text-white p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentFile.color.replace('text-', 'bg-').replace('-600', '-100')} ${currentFile.color}`}>
                <currentFile.icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{currentFile.name}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <span>{currentFile.label} Document</span>
                  <span>•</span>
                  <span>{currentFile.size}</span>
                  {currentFile.isOversized && (
                    <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">Large File</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              {currentFile.isOversized ? (
                <div className="text-center py-8">
                  <div className="mb-6">
                    <div className="inline-flex p-6 rounded-full bg-red-100 mb-4">
                      <FiAlertCircle size={48} className="text-red-600" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">File Too Large for Online Viewing</h4>
                    <p className="text-gray-600 mb-4">
                      This file ({currentFile.size}) exceeds the 10MB limit for online viewing.
                    </p>
                    <p className="text-gray-500 text-sm mb-6">
                      Please download the file to view it on your device.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => handleDownload(currentFile.url, currentFile.name)}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiDownload size={18} /> Download File ({currentFile.size})
                    </button>
                  </div>
                </div>
              ) : (currentFile.extension === 'pdf' || ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(currentFile.extension)) ? (
                <div className="w-full h-[60vh]">
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(currentFile.url)}&embedded=true`}
                    className="w-full h-full border-0 rounded-lg"
                    title={currentFile.name}
                    onLoad={() => setFileLoadErrors(prev => ({ ...prev, [currentFile.url]: false }))}
                    onError={() => handleFileLoadError(currentFile.url)}
                  />
                  {fileLoadErrors[currentFile.url] && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 text-red-700">
                        <FiAlertCircle size={20} />
                        <span className="font-medium">Failed to load document</span>
                      </div>
                      <p className="text-red-600 text-sm mt-1">
                        The document viewer failed to load. Please try downloading the file instead.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mb-6">
                    <div className={`inline-flex p-6 rounded-full ${currentFile.color.replace('text-', 'bg-').replace('-600', '-100')} mb-4`}>
                      <currentFile.icon size={48} className={currentFile.color} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{currentFile.name}</h4>
                    <p className="text-gray-600 mb-6">
                      This {currentFile.label} file ({currentFile.size}) can be viewed online
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(currentFile.url)}&embedded=true`;
                        window.open(googleDocsViewerUrl, '_blank');
                      }}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiExternalLink size={18} /> Open in Google Docs Viewer
                    </button>

                    <button
                      onClick={() => handleDownload(currentFile.url, currentFile.name)}
                      className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <FiDownload size={18} /> Download File
                    </button>
                  </div>

                  <p className="text-sm text-gray-500 mt-4">
                    Google Docs Viewer supports: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT files up to 10MB
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {currentFile.isOversized
                  ? 'File exceeds 10MB limit - download required'
                  : 'File will open in a new tab for better viewing experience'}
              </span>
              <button
                onClick={() => {
                  const opened = openFileViewer(currentFile.url, currentFile.name, currentFile.extension, currentFile.rawSize);
                  if (opened) {
                    setFileViewerOpen(false);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
              >
                {currentFile.isOversized ? 'Download Now' : 'Open Directly'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!!toast && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 text-center text-sm font-medium animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Image Modal (Lightbox) */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
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
            onClick={(e) => e.stopPropagation()}
            onError={() => handleFileLoadError(viewingImage)}
          />
          {fileLoadErrors[viewingImage] && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
              <FiAlertCircle className="text-red-400 mb-2" size={48} />
              <p className="text-white text-lg font-medium">Failed to load image</p>
              <p className="text-gray-300 text-sm mt-1">The image may have been removed or is inaccessible</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl relative p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors" onClick={onClose} aria-label="Close">
          <FiX size={24} />
        </button>
        {children}
      </div>
    </div>
  );
}