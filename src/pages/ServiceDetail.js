import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
    onSnapshot,
    doc,
    getDoc,
    query,
    collection,
    where,
    getDocs,
    updateDoc,
    deleteDoc,
    setDoc,
    serverTimestamp,
    addDoc,
    arrayUnion,
    arrayRemove,
    limit,
    orderBy,
    startAfter
} from "firebase/firestore";
import { useProfileCache } from "../contexts/ProfileCacheContext";
import { usePostDetailCache, useGlobalDataCache } from "../contexts/GlobalDataCacheContext";
import { FiArrowLeft, FiStar, FiMessageSquare, FiHeart, FiShare2, FiX, FiMapPin, FiCalendar, FiMoreVertical, FiTrash2, FiFile, FiFileText, FiDownload, FiAlertCircle, FiExternalLink, FiEye, FiLoader, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MapComponent from "../components/MapComponent";
import ProfileImageViewer from "../components/ProfileImageViewer";
import defaultAvatar from "../assets/images/default_profile.svg";
import { formatDateTime } from "../utils/timeUtils";



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


// Function to get download URL with forced download for Cloudinary
function getDownloadUrl(url) {
    if (!url) return "";

    // For Cloudinary files
    if (url.includes("cloudinary.com") && url.includes("/upload/")) {
        // For all files, add attachment flag if not present
        if (!url.includes("fl_attachment")) {
            return url.replace("/upload/", "/upload/fl_attachment/");
        }
    }
    return url;
}


// Function to check if file can be viewed online based on size
function canViewOnline(fileSize, extension) {
    const MAX_VIEWABLE_SIZE = 2.5 * 1024 * 1024; // 2.5MB

    // Check file size limit
    if (fileSize > MAX_VIEWABLE_SIZE) {
        return false;
    }

    // Check file type support
    const viewableExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'];
    return viewableExtensions.includes(extension);
}

// Function to get file information with size validation
function getFileInfo(file, sizeInBytes = null) {
    const fileName = file.name || decodeURIComponent(file.url?.split('/').pop().split('?')[0] || "Unknown File");
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
    const MAX_FILE_SIZE = 2.5 * 1024 * 1024; // 2.5MB in bytes

    if (sizeInBytes && sizeInBytes > 0) {
        // Check if file exceeds 2.5MB limit
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
        downloadUrl: getDownloadUrl(file.url),
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
        window.open(googleDocsViewerUrl, '_blank', 'noopener,noreferrer');
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

    }
    return null;
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

// Constants for review pagination - AGGRESSIVELY OPTIMIZED
const REVIEWS_PAGE_SIZE = 9;

/**
 * ServiceDetail Page - Optimized with Post Detail Cache
 * 
 * OPTIMIZATION: Uses localStorage cache with 2-day TTL
 * - First visit: Normal reads (1 for service + 1 for reviews)
 * - Return visits within 2 days: Instant display from cache
 * - Real-time listener updates cache automatically
 */
function ServiceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUserId, chats } = useGlobalDataCache();
    const { fetchProfiles, getCachedProfile } = useProfileCache();
    const { getPostDetailCache, setPostDetailCache } = usePostDetailCache();
    const [service, setService] = useState(null);
    const [creator, setCreator] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [userRatingDoc, setUserRatingDoc] = useState(null);
    const [profiles, setProfiles] = useState({});
    const [userHasFavorited, setUserHasFavorited] = useState(false);
    const [newReviewText, setNewReviewText] = useState("");
    const [newRating, setNewRating] = useState(0);
    const [rateModalOpen, setRateModalOpen] = useState(false);
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [toast, setToast] = useState("");
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [carouselIdx, setCarouselIdx] = useState(0);
    const [viewingImage, setViewingImage] = useState(null);
    const [fileViewerOpen, setFileViewerOpen] = useState(false);
    const [currentFile, setCurrentFile] = useState(null);
    const [fileSizes, setFileSizes] = useState({});
    const [loadingFiles, setLoadingFiles] = useState({});
    const [fileLoadErrors, setFileLoadErrors] = useState({});
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [expandedReplies, setExpandedReplies] = useState({});
    const [showProfileViewer, setShowProfileViewer] = useState(false);
    const [notFound, setNotFound] = useState(false);

    // Pagination state for reviews
    const [hasMoreReviews, setHasMoreReviews] = useState(true);
    const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
    const lastReviewRef = useRef(null);
    const allReviewsRef = useRef([]);

    // Confirmation state for deleting reviews
    const [reviewToDelete, setReviewToDelete] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingReview, setDeletingReview] = useState(false);

    // Cache initialization ref to prevent double loading
    const cacheInitializedRef = useRef(false);
    const dataFromCache = useRef(false);

    // Fetch creator profile using ProfileCache
    const fetchCreatorProfile = useCallback(async (creatorId) => {
        if (!creatorId) return;
        try {
            // First check cache
            const cached = getCachedProfile(creatorId);
            if (cached) {
                setCreator(cached);
                return;
            }
            // Fetch using ProfileCache (batch-optimized)
            const profiles = await fetchProfiles([creatorId]);
            if (profiles[creatorId]) {
                setCreator(profiles[creatorId]);
            }
        } catch (error) {
        }
    }, [fetchProfiles, getCachedProfile]);

    // Fetch reviewer profiles using ProfileCache (batch optimized)
    const fetchReviewerProfiles = useCallback(async (userIds) => {
        if (!userIds || userIds.length === 0) return;
        try {
            const profilesData = await fetchProfiles(userIds);
            setProfiles(prev => ({ ...prev, ...profilesData }));
        } catch (error) {
        }
    }, [fetchProfiles]);

    // Initialize from cache on mount (instant display)
    useEffect(() => {
        if (!id || cacheInitializedRef.current) return;
        cacheInitializedRef.current = true;

        const cached = getPostDetailCache('service', id);
        if (cached && cached.data) {
            dataFromCache.current = true;
            const { serviceData, reviewsData, profilesData } = cached.data;

            if (serviceData) {
                setService(serviceData);
                // Ensure we have the latest creator profile even if service is cached
                if (serviceData.createdBy) {
                    fetchCreatorProfile(serviceData.createdBy);
                }
            }
            if (reviewsData && Array.isArray(reviewsData)) {
                allReviewsRef.current = reviewsData;
                setReviews(reviewsData);
                const userRate = reviewsData.find(r => r.userId === currentUserId && typeof r.rating === "number" && r.rating > 0);
                setUserRatingDoc(userRate ?? null);
                if (reviewsData.length < REVIEWS_PAGE_SIZE) {
                    setHasMoreReviews(false);
                }
            }
            if (profilesData) {
                setProfiles(profilesData);
            }

            // Check for missing reviewer profiles in cache and fetch them
            if (reviewsData && Array.isArray(reviewsData)) {
                const availableProfileIds = new Set(Object.keys(profilesData || {}));
                const missingIds = [...new Set(reviewsData.map(r => r.userId).filter(uid => uid && !availableProfileIds.has(uid)))];
                if (missingIds.length > 0) {
                    fetchReviewerProfiles(missingIds);
                }
            }
        } else {
            dataFromCache.current = false;
        }
    }, [id, getPostDetailCache, currentUserId, fetchCreatorProfile, fetchReviewerProfiles]);





    // Load more reviews (pagination)
    const loadMoreReviews = useCallback(async () => {
        if (!id || loadingMoreReviews || !hasMoreReviews) return;

        setLoadingMoreReviews(true);
        try {
            let reviewQ;
            let cursor = lastReviewRef.current;
            if (!cursor && allReviewsRef.current.length > 0) {
                cursor = allReviewsRef.current[allReviewsRef.current.length - 1].createdAt;
            }

            if (cursor) {
                reviewQ = query(
                    collection(db, "serviceReviews"),
                    where("serviceId", "==", id),
                    orderBy("createdAt", "desc"),
                    startAfter(cursor),
                    limit(REVIEWS_PAGE_SIZE)
                );
            } else {
                reviewQ = query(
                    collection(db, "serviceReviews"),
                    where("serviceId", "==", id),
                    orderBy("createdAt", "desc"),
                    limit(REVIEWS_PAGE_SIZE)
                );
            }

            const snap = await getDocs(reviewQ);
            const newReviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (newReviews.length < REVIEWS_PAGE_SIZE) {
                setHasMoreReviews(false);
            }

            if (snap.docs.length > 0) {
                lastReviewRef.current = snap.docs[snap.docs.length - 1];
            }

            // Merge with existing reviews (avoid duplicates)
            const existingIds = new Set(allReviewsRef.current.map(r => r.id));
            const uniqueNewReviews = newReviews.filter(r => !existingIds.has(r.id));
            allReviewsRef.current = [...allReviewsRef.current, ...uniqueNewReviews];
            setReviews([...allReviewsRef.current]);

            // Fetch profiles for new reviewers using ProfileCache
            const newUserIds = [...new Set(uniqueNewReviews.map(r => r.userId))];
            if (newUserIds.length > 0) {
                fetchReviewerProfiles(newUserIds);
            }
        } catch (error) {
        } finally {
            setLoadingMoreReviews(false);
        }
    }, [id, loadingMoreReviews, hasMoreReviews, fetchReviewerProfiles]);

    // Fetch service and creator profile - OPTIMIZED: Use getDoc instead of onSnapshot
    useEffect(() => {
        if (!id) return;

        // OPTIMIZATION: Use one-time fetch instead of continuous listener for service document
        const fetchServiceData = async () => {
            try {
                const snap = await getDoc(doc(db, "services", id));
                if (snap.exists()) {
                    const serviceData = { id: snap.id, ...snap.data() };
                    setService(serviceData);

                    // Fetch creator profile using ProfileCache
                    if (serviceData.createdBy) {
                        fetchCreatorProfile(serviceData.createdBy);
                    }

                    // Update cache with latest service data
                    const cached = getPostDetailCache('service', id);
                    setPostDetailCache('service', id, {
                        ...cached?.data,
                        serviceData,
                    }, snap.data().updatedAt?.toMillis?.() || Date.now());

                } else {
                    setNotFound(true);
                }
            } catch (error) {
                console.error("Error fetching service:", error);
                setNotFound(true);
            }
        };

        // Only fetch service document if NOT loaded from cache
        if (!dataFromCache.current) {
            fetchServiceData();
        }

        // Fetch initial reviews with pagination (first 7) - Keep listener for live updates
        const reviewQ = query(
            collection(db, "serviceReviews"),
            where("serviceId", "==", id),
            orderBy("createdAt", "desc"),
            limit(REVIEWS_PAGE_SIZE)
        );

        const unsubscribeReviews = onSnapshot(reviewQ, snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Store last doc for pagination
            if (snap.docs.length > 0) {
                lastReviewRef.current = snap.docs[snap.docs.length - 1];
            }

            // Check if there might be more reviews
            setHasMoreReviews(snap.docs.length >= REVIEWS_PAGE_SIZE);

            allReviewsRef.current = data;
            setReviews(data);
            const userRate = data.find(r => r.userId === currentUserId && typeof r.rating === "number" && r.rating > 0);
            setUserRatingDoc(userRate ?? null);

            // Fetch reviewer profiles using ProfileCache (batch optimized)
            const userIds = Array.from(new Set(data.map(r => r.userId)));
            if (userIds.length > 0) {
                fetchReviewerProfiles(userIds);
            }

            // Update cache with latest reviews data
            const cached = getPostDetailCache('service', id);
            setPostDetailCache('service', id, {
                ...cached?.data,
                reviewsData: data,
            }, Date.now());
        });

        return () => {
            unsubscribeReviews();
        };
    }, [id, currentUserId, fetchCreatorProfile, fetchReviewerProfiles, getPostDetailCache, setPostDetailCache]);

    // Favorite status
    useEffect(() => {
        if (!currentUserId || !id) return;
        getDoc(doc(db, "serviceFavorites", `${currentUserId}_${id}`)).then(snap => setUserHasFavorited(snap.exists()));
    }, [currentUserId, id]);

    // Calculate file sizes when service data changes
    useEffect(() => {
        if (!service || !service.attachments) return;

        const fetchFileSizes = async () => {
            const newFileSizes = {};
            const attachments = service.attachments || [];

            for (const file of attachments) {
                if (!file.url) continue;

                try {
                    // Add loading state for this file
                    setLoadingFiles(prev => ({ ...prev, [file.url]: true }));

                    const size = await getFileSizeFromUrl(file.url);
                    if (size !== null) {
                        newFileSizes[file.url] = size;
                    }

                    // Remove loading state
                    setLoadingFiles(prev => ({ ...prev, [file.url]: false }));
                } catch (error) {
                    setLoadingFiles(prev => ({ ...prev, [file.url]: false }));
                }
            }

            setFileSizes(newFileSizes);
        };

        fetchFileSizes();
    }, [service]);

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

    // Define updateServiceRating with useCallback
    const updateServiceRating = useCallback(async () => {
        if (!id) return;

        try {
            const q = query(collection(db, "serviceReviews"), where("serviceId", "==", id));
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

            // Update the service document
            try {
                await updateDoc(doc(db, "services", id), {
                    rating: newAvg
                });
            } catch (e) {
            }
        } catch (error) {
        }
    }, [id]);



    const toggleFavorite = async () => {
        if (!currentUserId) { setToast("Please login to favorite!"); return; }
        const favDoc = doc(db, "serviceFavorites", `${currentUserId}_${id}`);
        try {
            if (userHasFavorited) {
                await deleteDoc(favDoc);
                setUserHasFavorited(false);
            } else {
                await setDoc(favDoc, { serviceId: id, userId: currentUserId, createdAt: serverTimestamp() });
                setUserHasFavorited(true);
            }
        } catch (error) {
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
                await addDoc(collection(db, "serviceReviews"), {
                    serviceId: id, userId: currentUserId, rating: newRating, text: "", createdAt: serverTimestamp()
                });

                await updateServiceRating();

                // Create notification (fire and forget for better UX)
                if (service && service.createdBy && service.createdBy !== currentUserId) {
                    addDoc(collection(db, "notifications"), {
                        userId: service.createdBy,
                        senderId: currentUserId,
                        type: "review",
                        title: "New Rating",
                        message: `New ${newRating}-star rating received`, link: `/service-detail/${id}`,
                        postId: id,
                        postType: "service",
                        rating: newRating,
                        read: false,
                        createdAt: serverTimestamp()
                    }).catch(nErr => { });
                }

                setNewRating(0);
                setRateModalOpen(false);
                setToast("Rating submitted!");
            } catch (error) {
                setToast("Failed to submit rating");
            }
        }

        if (commentModalOpen) {
            if (!newReviewText.trim()) { setToast("Please write your review."); return; }

            try {
                await addDoc(collection(db, "serviceReviews"), {
                    serviceId: id, userId: currentUserId, rating: null, text: newReviewText.trim(), createdAt: serverTimestamp()
                });

                // Create notification (fire and forget for better UX)
                if (service && service.createdBy && service.createdBy !== currentUserId) {
                    addDoc(collection(db, "notifications"), {
                        userId: service.createdBy,
                        senderId: currentUserId,
                        type: "review",
                        title: "New Review",
                        message: `New review received`, link: `/service-detail/${id}`,
                        postId: id,
                        postType: "service",
                        text: newReviewText.trim(),
                        read: false,
                        createdAt: serverTimestamp()
                    }).then(() => {
                    }).catch(nErr => { });
                }


                setNewReviewText("");
                setCommentModalOpen(false);
                setToast("Review submitted!");
            } catch (error) {
                setToast("Failed to submit review");
            }
        }

        setTimeout(() => setToast(""), 1800);
    };

    const confirmDeleteReview = async () => {
        if (!reviewToDelete) return;

        try {
            setDeletingReview(true);
            await deleteDoc(doc(db, "serviceReviews", reviewToDelete.id));

            if (reviewToDelete.rating) {
                await updateServiceRating();
            }

            setToast("Review deleted");
            setActiveMenuId(null);
            setShowDeleteConfirm(false);
            setReviewToDelete(null);
        } catch (error) {
            setToast("Failed to delete review");
        } finally {
            setDeletingReview(false);
            setTimeout(() => setToast(""), 2000);
        }
    };

    const handleDeleteClick = (review) => {
        setReviewToDelete(review);
        setShowDeleteConfirm(true);
        setActiveMenuId(null);
    };



    const submitReply = async (reviewId, reviewerId) => {
        if (!replyText.trim()) return;
        try {
            await updateDoc(doc(db, "serviceReviews", reviewId), {
                replies: arrayUnion({
                    text: replyText.trim(),
                    createdAt: new Date().getTime()
                })
            });

            // Notification for the reviewer
            if (reviewerId !== currentUserId) {
                try {
                    await addDoc(collection(db, "notifications"), {
                        userId: reviewerId,
                        senderId: currentUserId,
                        type: "reply",
                        title: "New Reply",
                        message: `replied to your review`, link: `/service-detail/${id}`,
                        postId: id,
                        postType: "service",
                        rating: null,
                        text: replyText.trim(),
                        read: false,
                        createdAt: serverTimestamp()
                    }).then(() => {
                    });
                } catch (nErr) { }
            }

            setReplyText("");
            setReplyingTo(null);
            setToast("Reply posted!");
            setTimeout(() => setToast(""), 2000);
        } catch (error) {
            setToast("Failed to post reply");
        }
    };

    // Fixed share function with proper error handling
    const shareService = async () => {
        if (!service) return;

        const shareData = {
            title: service.title || "Service",
            text: service.description ? service.description.substring(0, 100) + "..." : "Check out this service",
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
                }
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(window.location.href);
                setToast("Link copied to clipboard!");
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
                } catch (e) {
                }
            }
            setTimeout(() => setToast(""), 2200);
        }
    };

    const startChat = async () => {
        if (!currentUserId || !service) {
            return;
        }
        const recipientId = service.createdBy;
        if (recipientId === currentUserId) {
            setToast("You cannot chat with yourself");
            setTimeout(() => setToast(""), 2000);
            return;
        }

        try {
            const chatsRef = collection(db, "chats");
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
                // Restore chat if logically deleted
                await updateDoc(doc(db, "chats", chatId), {
                    deletedBy: arrayRemove(currentUserId)
                });
                navigate(`/chat/${chatId}`);
                return;
            }

            // CHAT LIMIT: Check if user already has 5 chats
            if (chats.length >= 5) {
                setToast("Chat Limit Reached: You can only have up to 5 active chats. Please hide/delete a chat to start a new one.");
                setTimeout(() => setToast(""), 4000);
                return;
            }

            // Create new chat only if none exists
            console.log("Creating new chat...");
            const newDoc = await addDoc(chatsRef, {
                participants: [currentUserId, recipientId],
                initiatorId: currentUserId,
                serviceId: id,
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

    const openFilePreview = (file) => {
        const fileSize = fileSizes[file.url] || null;
        const fileInfo = getFileInfo(file, fileSize);
        setCurrentFile({
            url: file.url,
            ...fileInfo
        });
        setFileViewerOpen(true);
    };

    const handleFileLoadError = (url) => {
        setFileLoadErrors(prev => ({ ...prev, [url]: true }));
    };

    if (notFound) return (
        <div className="flex justify-center items-center h-screen flex-col gap-4">
            <FiAlertCircle size={48} className="text-gray-300" />
            <p className="text-gray-500 font-medium">Service not found or has been deleted.</p>
            <button
                onClick={() => navigate('/services')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
                Back to Services
            </button>
        </div>
    );

    if (!service) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    // Prioritize creator profile (latest) -> service author metadata (stale) -> service root fields -> fallback
    const displayProfileImage = creator?.photoURL || creator?.profileImage || service.profilePhotoUrl || service.author?.photoURL || defaultAvatar;
    const displayUsername = creator?.username || creator?.displayName || creator?.name || service.author?.username || service.author?.name || service.username || (creator?.email ? creator.email.split('@')[0] : "User");
    const isOwner = service.createdBy === currentUserId;

    // Separate images from documents
    const attachments = service.attachments || [];
    const imageFiles = attachments.filter(f => {
        const name = f.name?.toLowerCase() || "";
        const url = f.url?.toLowerCase() || "";
        const ext = name.split('.').pop() || url.split('?')[0].split('.').pop();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        return imageExtensions.includes(ext);
    });
    const documentFiles = attachments.filter(f => !imageFiles.includes(f));

    return (
        <div className="relative bg-white min-h-screen flex flex-col max-w-md mx-auto" onClick={() => setActiveMenuId(null)}>
            {/* Top bar */}
            <div className="flex items-center mb-1 pt-2 px-3 sticky top-0 bg-white z-20 shadow-sm py-2">
                <button className="mr-3 text-blue-600 rounded-full p-2 hover:bg-blue-50 transition-colors" onClick={() => navigate("/services")} aria-label="Back">
                    <FiArrowLeft size={24} />
                </button>
                <div className="font-bold text-lg text-gray-800 flex-1 truncate">Service Details</div>
                <div className="flex gap-3 items-center ml-auto">
                    <button onClick={shareService} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <FiShare2 size={20} className="text-gray-600" />
                    </button>
                    {!isOwner && (
                        <button onClick={toggleFavorite} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <FiHeart size={20} className={userHasFavorited ? "text-red-600 fill-red-600" : "text-gray-600"} />
                        </button>
                    )}
                </div>
            </div>

            <div className="px-3 pb-20 overflow-y-auto">

                {/* Username */}
                <div className="text-center mt-3 mb-2">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">{displayUsername}</h2>
                    <p className="text-xs text-gray-500 tracking-normal">Service Provider</p>
                </div>

                {/* Profile Image */}
                <div className="flex justify-center mb-2">
                    <img
                        src={displayProfileImage}
                        alt={displayUsername}
                        className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setShowProfileViewer(true)}
                        onError={(e) => { e.target.src = defaultAvatar; }}
                        crossOrigin="anonymous"
                    />
                </div>

                {/* Profile Image Viewer Modal */}
                <ProfileImageViewer
                    show={showProfileViewer}
                    onClose={() => setShowProfileViewer(false)}
                    imageUrl={displayProfileImage}
                    username={displayUsername}
                />

                {/* Service Type Badge & Title */}
                <div className="text-center mb-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mb-1.5 tracking-wide ${service.serviceType === 'provide' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {service.serviceType === 'provide' ? 'Providing' : 'Asking'}
                    </span>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">{service.title}</h1>
                </div>

                {/* Description */}
                <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                    <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Description</h3>
                    <p className="text-sm text-gray-700 leading-snug whitespace-pre-wrap tracking-normal">{service.description}</p>
                </div>

                {/* Tags */}
                {service.tags && service.tags.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Tags</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {service.tags.map((tag, index) => (
                                <span key={index} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium tracking-normal">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Location */}
                {service.location && (
                    <div className="mb-4">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Location</h3>
                        <div className="flex items-start text-gray-700 bg-gray-50 p-2 rounded-lg">
                            <FiMapPin className="mt-0.5 mr-1.5 flex-shrink-0 text-blue-600" size={14} />
                            <span className="text-sm tracking-normal leading-snug">
                                {service.location.area && `${service.location.area}, `}
                                {service.location.city && `${service.location.city}`}
                                {service.location.pincode && ` - ${service.location.pincode}`}
                                {service.location.landmark && <div className="text-xs text-gray-500 mt-1 tracking-normal">Landmark: {service.location.landmark}</div>}
                            </span>
                        </div>


                        {/* Map Component */}
                        <div className="mt-3">
                            <MapComponent
                                latitude={service.location?.latitude || service.latitude}
                                longitude={service.location?.longitude || service.longitude}
                                address={`${service.location?.city || ''} ${service.location?.area || ''}`}
                            />
                        </div>
                    </div>
                )}

                {/* Expiry Date - Robust Handling */}
                {(() => {
                    // Check explicitly for "Until I change" or equivalent strings first
                    if (typeof service.expiry === 'string' &&
                        (service.expiry.toLowerCase().includes('until i change') ||
                            service.expiry.toLowerCase() === 'not available')) {
                        return (
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Valid Until</h3>
                                <div className="flex items-center text-gray-700 bg-green-50 p-2 rounded-lg border border-green-200">
                                    <FiCalendar className="mr-1.5 text-green-600" size={14} />
                                    <span className="text-xs tracking-normal font-medium text-green-700">Not Available</span>
                                </div>
                            </div>
                        );
                    }

                    if (!service.expiry) {
                        return (
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Valid Until</h3>
                                <div className="flex items-center text-gray-700 bg-green-50 p-2 rounded-lg border border-green-200">
                                    <FiCalendar className="mr-1.5 text-green-600" size={14} />
                                    <span className="text-xs tracking-normal font-medium text-green-700">Not Available</span>
                                </div>
                            </div>
                        );
                    }

                    const expiryDate = service.expiry.toDate ? service.expiry.toDate() : (service.expiry.seconds ? new Date(service.expiry.seconds * 1000) : new Date(service.expiry));

                    if (isNaN(expiryDate.getTime())) {
                        return (
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Valid Until</h3>
                                <div className="flex items-center text-gray-700 bg-green-50 p-2 rounded-lg border border-green-200">
                                    <FiCalendar className="mr-1.5 text-green-600" size={14} />
                                    <span className="text-xs tracking-normal font-medium text-green-700">Not Available</span>
                                </div>
                            </div>
                        );
                    }

                    const year = expiryDate.getFullYear();

                    // Check if it's the "never" option (year 9999 or greater than 9000 due to timezone conversion)
                    if (year === 9999 || year > 9000) {
                        return (
                            <div className="mb-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Valid Until</h3>
                                <div className="flex items-center text-gray-700 bg-green-50 p-2 rounded-lg border border-green-200">
                                    <FiCalendar className="mr-1.5 text-green-600" size={14} />
                                    <span className="text-xs tracking-normal font-medium text-green-700">Not Available</span>
                                </div>
                            </div>
                        );
                    }

                    const formattedDateTime = expiryDate.toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });


                    return (
                        <div className="mb-4">
                            <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Valid Until</h3>
                            <div className="flex items-center text-gray-700 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                                <FiCalendar className="mr-1.5 text-yellow-600" size={14} />
                                <span className="text-xs tracking-normal">{formattedDateTime}</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Photos Section */}
                {imageFiles.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Photos</h3>
                        <div className="w-full flex items-center justify-center">
                            <div style={{
                                width: "100%", height: 280,
                                position: "relative", borderRadius: 16, background: "#f3f4f6"
                            }}
                                className="overflow-hidden flex justify-center items-center shadow-sm border border-gray-100"
                            >
                                {imageFiles.length > 1 && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); setCarouselIdx(i => (i - 1 + imageFiles.length) % imageFiles.length); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20">
                                            <FiChevronLeft size={16} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setCarouselIdx(i => (i + 1) % imageFiles.length); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20">
                                            <FiChevronRight size={16} />
                                        </button>
                                    </>
                                )}

                                <img
                                    src={imageFiles[carouselIdx]?.url}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60"
                                    aria-hidden="true"
                                    crossOrigin="anonymous"
                                />

                                <img
                                    src={imageFiles[carouselIdx]?.url}
                                    alt={imageFiles[carouselIdx]?.name || "Service Image"}
                                    className="relative w-full h-full object-contain cursor-pointer z-10"
                                    onClick={() => setViewingImage(imageFiles[carouselIdx]?.url)}
                                    onError={() => handleFileLoadError(imageFiles[carouselIdx]?.url)}
                                    crossOrigin="anonymous"
                                />

                                {loadingFiles[imageFiles[carouselIdx]?.url] && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                                        <FiLoader className="animate-spin text-white" size={32} />
                                    </div>
                                )}

                                {fileLoadErrors[imageFiles[carouselIdx]?.url] && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-70 p-4">
                                        <FiAlertCircle className="text-red-400 mb-2" size={32} />
                                        <p className="text-white text-sm text-center">Failed to load image</p>
                                    </div>
                                )}

                                {imageFiles.length > 1 && (
                                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                                        {imageFiles.map((_, idx) => (
                                            <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === carouselIdx ? 'bg-white' : 'bg-white/50'}`} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Files & Documents Section */}
                {documentFiles.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Files & Documents</h3>
                        <div className="space-y-2">
                            {documentFiles.map((file, idx) => {
                                const fileSize = fileSizes[file.url] || null;
                                const fileInfo = getFileInfo(file, fileSize);
                                const IconComponent = fileInfo.icon;
                                const isLoading = loadingFiles[file.url];
                                const hasError = fileLoadErrors[file.url];
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
                                                        onClick={() => openFilePreview(file)}
                                                        disabled={isLoading || !canViewOnlineResult}
                                                        className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap flex items-center gap-2 ${canViewOnlineResult ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'}`}
                                                    >
                                                        <FiEye size={14} /> View
                                                    </button>
                                                    <a
                                                        href={fileInfo.downloadUrl}
                                                        download={fileInfo.name}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
                                                    >
                                                        <FiDownload size={14} /> Save
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <hr className="border-gray-200 mb-4" />

                {/* Total Rating */}
                <div className="mb-4">
                    <h3 className="font-semibold text-sm text-gray-900 mb-2 tracking-tight">Ratings & Reviews</h3>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex flex-col items-center justify-center bg-yellow-50 p-2 rounded-lg min-w-[70px]">
                                <span className="text-2xl font-bold text-gray-900">{avgRating}</span>
                                <div className="flex text-yellow-400 text-xs">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <FiStar key={star} size={12} className={star <= Math.round(avgRating) ? "fill-current" : "text-gray-300"} />
                                    ))}
                                </div>
                                <span className="text-[10px] text-gray-500 mt-0.5">{totalRatings} ratings</span>
                            </div>

                            <div className="flex-1">
                                {ratingVals.map((star, idx) => (
                                    <div key={star} className="flex items-center gap-1.5 text-[10px] mb-0.5">
                                        <span className="w-2 font-medium text-gray-600">{star}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
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

                {/* All Reviews */}
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
                        <>
                            <div className="space-y-4">
                                {reviews.filter(r => r.text && r.text.trim()).map(r => {
                                    const userProfile = profiles[r.userId] || {};
                                    const user = {
                                        username: userProfile.username || userProfile.name || userProfile.displayName || r.username || r.authorName || (userProfile.email ? userProfile.email.split('@')[0] : "User"),
                                        profileImage: userProfile.profileImage || ""
                                    };
                                    const dt = r.createdAt && r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000) : null;
                                    return (
                                        <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative">
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={user.profileImage || defaultAvatar}
                                                    alt={user.username}
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                    onError={(e) => { e.target.src = defaultAvatar; }}
                                                    crossOrigin="anonymous"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-semibold text-gray-900 truncate pr-2">
                                                            {user.username}
                                                        </h4>

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
                                                                        {isOwner && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setReplyingTo(r.id);
                                                                                    setActiveMenuId(null);
                                                                                }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                                                                            >
                                                                                <FiMessageSquare size={14} /> Reply
                                                                            </button>
                                                                        )}
                                                                        {(isOwner || r.userId === currentUserId) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteClick(r);
                                                                                }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                                            >
                                                                                <FiTrash2 size={14} /> Delete
                                                                            </button>
                                                                        )}
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

                                                    {/* Display Replies Toggle */}
                                                    {(r.reply || (r.replies && r.replies.length > 0)) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedReplies(prev => ({ ...prev, [r.id]: !prev[r.id] }));
                                                            }}
                                                            className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                        >
                                                            <FiMessageSquare size={12} />
                                                            {expandedReplies[r.id] ? "Hide Replies" : `View Replies (${(r.replies?.length || 0) + (r.reply ? 1 : 0)})`}
                                                        </button>
                                                    )}

                                                    {/* Display Replies List */}
                                                    {expandedReplies[r.id] && (
                                                        <div className="mt-2 space-y-2 ml-2">
                                                            {/* Support legacy single reply */}
                                                            {r.reply && (
                                                                <div className="p-2 border-l-2 border-blue-200 bg-gray-50/50 rounded-r-lg">
                                                                    <p className="text-sm text-gray-700">{r.reply}</p>
                                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                                        {r.replyCreatedAt ? formatDateTime(new Date(r.replyCreatedAt.seconds * 1000)) : ""}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Support multiple replies */}
                                                            {r.replies && r.replies.map((reply, index) => (
                                                                <div key={index} className="p-2 border-l-2 border-blue-200 bg-gray-50/50 rounded-r-lg">
                                                                    <p className="text-sm text-gray-700">{reply.text}</p>
                                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                                        {reply.createdAt ? formatDateTime(new Date(reply.createdAt)) : ""}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Reply Input */}
                                                    {replyingTo === r.id && (
                                                        <div className="mt-3 ml-2 animate-fade-in" onClick={e => e.stopPropagation()}>
                                                            <textarea
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                placeholder="Write your reply..."
                                                                className="w-full border border-gray-300 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                                rows={2}
                                                                autoFocus
                                                            />
                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button
                                                                    onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                                                    className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded font-medium"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    onClick={() => submitReply(r.id, r.userId)}
                                                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                                                                >
                                                                    Post Reply
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Load More Reviews Button */}
                            {hasMoreReviews && reviews.length >= REVIEWS_PAGE_SIZE && (
                                <div className="text-center mt-4">
                                    <button
                                        onClick={loadMoreReviews}
                                        disabled={loadingMoreReviews}
                                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        {loadingMoreReviews ? (
                                            <span className="flex items-center gap-2">
                                                <span className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></span>
                                                Loading...
                                            </span>
                                        ) : (
                                            "Load More Reviews"
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Action bar */}
            <div className="fixed left-0 right-0 bottom-0 bg-white px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t z-50"
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
                            <button className="bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors" onClick={shareService}>
                                <FiShare2 /> Share
                            </button>
                            <button onClick={startChat}
                                className="bg-green-600 text-white hover:bg-green-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                <FiMessageSquare /> Chat
                            </button>
                        </div>
                    </>
                ) : (
                    <button className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md" onClick={shareService}>
                        <FiShare2 /> Share Your Service
                    </button>
                )}
            </div>

            {/* Rate Modal */}
            {
                rateModalOpen && (
                    <Modal onClose={() => { setRateModalOpen(false); setNewRating(0); }}>
                        <h3 className="mb-4 text-center text-lg font-bold text-gray-900">Rate this Service</h3>
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
                )
            }

            {/* Review Modal */}
            {
                commentModalOpen && (
                    <Modal onClose={() => { setCommentModalOpen(false); setNewReviewText(""); }}>
                        <h3 className="mb-4 text-center text-lg font-bold text-gray-900">Write a Review</h3>
                        <textarea rows={5} value={newReviewText}
                            onChange={e => setNewReviewText(e.target.value)}
                            className="w-full border border-gray-300 p-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="Share your experience with this service..."
                        />
                        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            onClick={submitReview}
                            disabled={newReviewText.trim().length === 0}>
                            Post Review
                        </button>
                    </Modal>
                )
            }

            {/* Custom Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiTrash2 size={28} className="text-red-600" />
                        </div>
                        <h3 className="font-bold mb-2 text-lg text-gray-900">Delete Review?</h3>
                        <p className="text-gray-600 mb-6 text-sm">
                            Are you sure you want to delete? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deletingReview}
                            >
                                No
                            </button>
                            <button
                                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 text-sm flex justify-center items-center gap-2"
                                onClick={confirmDeleteReview}
                                disabled={deletingReview}
                            >
                                {deletingReview ? "Deleting..." : "Yes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Viewer Modal */}
            {
                fileViewerOpen && currentFile && (
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
                                        <span>{currentFile.label} File</span>
                                        <span>•</span>
                                        <span>{currentFile.size}</span>
                                        {currentFile.isOversized && (
                                            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">Large File</span>
                                        )}
                                        {currentFile.url.includes("cloudinary.com") && (
                                            <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">Cloudinary</span>
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
                                                This file ({currentFile.size}) exceeds the 2.5MB limit for online viewing.
                                            </p>
                                            <p className="text-gray-500 text-sm mb-6">
                                                Please download the file to view it on your device.
                                            </p>
                                        </div>

                                        <div className="flex justify-center">
                                            <a
                                                href={currentFile.downloadUrl}
                                                download={currentFile.name}
                                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <FiDownload size={18} /> Download File ({currentFile.size})
                                            </a>
                                        </div>
                                    </div>
                                ) : currentFile.extension === 'pdf' ? (
                                    <div className="text-center py-8">
                                        <div className="mb-6">
                                            <div className="inline-flex p-6 rounded-full bg-red-100 mb-4">
                                                <FiFileText size={48} className="text-red-600" />
                                            </div>
                                            <h4 className="text-xl font-bold text-gray-900 mb-2">PDF Document</h4>
                                            <p className="text-gray-600 mb-2">{currentFile.name}</p>
                                            <p className="text-gray-500 text-sm mb-2">{currentFile.size}</p>
                                            {currentFile.url.includes("cloudinary.com") && (
                                                <p className="text-blue-600 text-sm mb-6">Stored on Cloudinary</p>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3 max-w-sm mx-auto">
                                            <button
                                                onClick={() => {
                                                    // For Cloudinary PDFs, open directly
                                                    window.open(currentFile.url, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <FiExternalLink size={18} /> Open PDF Directly
                                            </button>

                                            <button
                                                onClick={() => {
                                                    // Alternative: Google Docs Viewer
                                                    const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(currentFile.url)}&embedded=true`;
                                                    window.open(googleDocsViewerUrl, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <FiExternalLink size={18} /> Open in Google Docs Viewer
                                            </button>

                                            <a
                                                href={currentFile.downloadUrl}
                                                download={currentFile.name}
                                                className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <FiDownload size={18} /> Download PDF
                                            </a>
                                        </div>

                                        <p className="text-sm text-gray-500 mt-4">
                                            Cloudinary PDFs usually open directly in your browser's PDF viewer.
                                        </p>
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

                                            <a
                                                href={currentFile.downloadUrl}
                                                download={currentFile.name}
                                                className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <FiDownload size={18} /> Download File
                                            </a>
                                        </div>

                                        <p className="text-sm text-gray-500 mt-4">
                                            Google Docs Viewer supports: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT files up to 2.5MB
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                                <span className="text-sm text-gray-600">
                                    {currentFile.isOversized
                                        ? 'File exceeds 2.5MB limit - download required'
                                        : currentFile.extension === 'pdf' && currentFile.url.includes("cloudinary.com")
                                            ? 'Cloudinary PDF - Opens directly in browser PDF viewer'
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
                )
            }

            {
                !!toast && (
                    <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 text-center text-sm font-medium animate-fade-in-up">
                        {toast}
                    </div>
                )
            }

            {/* Image Modal (Lightbox) */}
            {
                viewingImage && (
                    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
                        <button
                            onClick={() => setViewingImage(null)}
                            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[70]"
                        >
                            <FiX size={24} />
                        </button>

                        {imageFiles.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const urls = imageFiles.map(f => f.url);
                                        const currentIdx = urls.indexOf(viewingImage);
                                        const newIdx = (currentIdx - 1 + urls.length) % urls.length;
                                        setViewingImage(urls[newIdx]);
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[70]"
                                >
                                    <FiChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const urls = imageFiles.map(f => f.url);
                                        const currentIdx = urls.indexOf(viewingImage);
                                        const newIdx = (currentIdx + 1) % urls.length;
                                        setViewingImage(urls[newIdx]);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[70]"
                                >
                                    <FiChevronRight size={24} />
                                </button>
                            </>
                        )}

                        <img
                            src={viewingImage}
                            alt="Full view"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl relative z-[65]"
                            onClick={(e) => e.stopPropagation()}
                            onError={() => handleFileLoadError(viewingImage)}
                            crossOrigin="anonymous"
                        />
                        {fileLoadErrors[viewingImage] && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
                                <FiAlertCircle className="text-red-400 mb-2" size={48} />
                                <p className="text-white text-lg font-medium">Failed to load image</p>
                                <p className="text-gray-300 text-sm mt-1">The image may have been removed or is inaccessible</p>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}

export default ServiceDetail;
