import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  getDoc,
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
import { FiArrowLeft, FiStar, FiMessageSquare, FiHeart, FiShare2, FiX, FiMapPin, FiMoreVertical, FiTrash2, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MapComponent from "../components/MapComponent";
import defaultAvatar from "../assets/images/default_profile.svg";

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

// Constants for review pagination - AGGRESSIVELY OPTIMIZED
const REVIEWS_PAGE_SIZE = 9;

/**
 * AdDetail Page - Optimized with Post Detail Cache
 * 
 * OPTIMIZATION: Uses localStorage cache with 2-day TTL
 * - First visit: Normal reads (1 for ad + 1 for reviews)
 * - Return visits within 2 days: Instant display from cache
 * - Real-time listener updates cache automatically
 */
export default function AdDetail() {
  const { adId } = useParams();
  const navigate = useNavigate();
  const { currentUserId, chats } = useGlobalDataCache();
  const { fetchProfiles, getCachedProfile } = useProfileCache();
  const { getPostDetailCache, setPostDetailCache } = usePostDetailCache();
  const [ad, setAd] = useState(null);
  const [creator, setCreator] = useState(null);
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
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState({});

  // Pagination state for reviews
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const lastReviewRef = useRef(null);
  const allReviewsRef = useRef([]);

  // Cache initialization ref to prevent double loading
  const cacheInitializedRef = useRef(false);
  const dataFromCache = useRef(false);

  // Initialize from cache on mount (instant display)
  useEffect(() => {
    if (!adId || cacheInitializedRef.current) return;
    cacheInitializedRef.current = true;

    const cached = getPostDetailCache('ad', adId);
    if (cached && cached.data) {
      dataFromCache.current = true;
      const { adData, reviewsData, profilesData } = cached.data;

      if (adData) {
        setAd(adData);
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
    } else {
      dataFromCache.current = false;
    }
  }, [adId, getPostDetailCache, currentUserId]);

  // PERFORMANCE: Preload all carousel images for instant swiping
  useEffect(() => {
    if (ad && ad.photos && ad.photos.length > 1 && !imagesPreloaded) {
      const preloadImages = [];
      ad.photos.forEach((photoUrl) => {
        const img = new Image();
        img.src = photoUrl;
        preloadImages.push(img);
      });
      setImagesPreloaded(true);
    }
  }, [ad, imagesPreloaded]);



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

  // Load more reviews (pagination)
  const loadMoreReviews = useCallback(async () => {
    if (!adId || loadingMoreReviews || !hasMoreReviews) return;

    setLoadingMoreReviews(true);
    try {
      let reviewQ;
      let cursor = lastReviewRef.current;
      if (!cursor && allReviewsRef.current.length > 0) {
        cursor = allReviewsRef.current[allReviewsRef.current.length - 1].createdAt;
      }

      if (cursor) {
        reviewQ = query(
          collection(db, "adReviews"),
          where("adId", "==", adId),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(REVIEWS_PAGE_SIZE)
        );
      } else {
        reviewQ = query(
          collection(db, "adReviews"),
          where("adId", "==", adId),
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
  }, [adId, loadingMoreReviews, hasMoreReviews, fetchReviewerProfiles]);

  // Update Ad Rating with useCallback
  const updateAdRating = useCallback(async () => {
    if (!adId) return;
    try {
      // Recalculate average rating from all reviews
      const q = query(collection(db, "adReviews"), where("adId", "==", adId));
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

      // Update the ad document with the new average rating
      try {
        await updateDoc(doc(db, "ads", adId), { rating: newAvg });

      } catch (e) {
      }
    } catch (error) {
    }
  }, [adId]);

  // Fetch ad, reviews, user profiles - OPTIMIZED: Use getDoc instead of onSnapshot
  useEffect(() => {
    if (!adId) return;

    // If data loaded from cache, skip network requests to optimize reads
    if (dataFromCache.current) return;

    // OPTIMIZATION: Use one-time fetch instead of continuous listener for ad document
    const fetchAdData = async () => {
      try {
        const snap = await getDoc(doc(db, "ads", adId));
        if (snap.exists()) {
          const adData = { id: snap.id, ...snap.data() };
          setAd(adData);

          // Fetch creator profile using ProfileCache
          if (adData.createdBy) {
            fetchCreatorProfile(adData.createdBy);
          }

          // Update cache with latest ad data
          const cached = getPostDetailCache('ad', adId);
          setPostDetailCache('ad', adId, {
            ...cached?.data,
            adData,
          }, snap.data().updatedAt?.toMillis?.() || Date.now());

        }
      } catch (error) {
      }
    };

    fetchAdData();

    // Fetch initial reviews with pagination (first 7) - Keep listener for live updates
    const reviewQ = query(
      collection(db, "adReviews"),
      where("adId", "==", adId),
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
      const cached = getPostDetailCache('ad', adId);
      setPostDetailCache('ad', adId, {
        ...cached?.data,
        reviewsData: data,
      }, Date.now());

    });

    return () => {
      unsubscribeReviews();
    };
  }, [adId, currentUserId, fetchCreatorProfile, fetchReviewerProfiles, getPostDetailCache, setPostDetailCache]);

  // Favorite status
  useEffect(() => {
    if (!currentUserId || !adId) return;
    getDoc(doc(db, "adFavorites", `${currentUserId}_${adId}`)).then(snap => setUserHasFavorited(snap.exists()));
  }, [currentUserId, adId]);

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

  const toggleFavorite = async () => {
    if (!currentUserId) { setToast("Please login to favorite!"); return; }
    const favDoc = doc(db, "adFavorites", `${currentUserId}_${adId}`);
    try {
      if (userHasFavorited) {
        await deleteDoc(favDoc);
        setUserHasFavorited(false);
      } else {
        await setDoc(favDoc, { adId, userId: currentUserId, createdAt: serverTimestamp() });
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
        await addDoc(collection(db, "adReviews"), {
          adId, userId: currentUserId, rating: newRating, text: "", createdAt: serverTimestamp()
        });
        await updateAdRating();


        // Create notification (fire and forget for better UX)
        if (ad && ad.createdBy && ad.createdBy !== currentUserId) {
          addDoc(collection(db, "notifications"), {
            userId: ad.createdBy,
            senderId: currentUserId,
            type: "review",
            title: "New Rating",
            message: `New ${newRating}-star rating received`, link: `/ad-detail/${adId}`,
            postId: adId,
            postType: "ad",
            rating: newRating,
            read: false,
            createdAt: serverTimestamp()
          }).then(() => {
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
        await addDoc(collection(db, "adReviews"), {
          adId, userId: currentUserId, rating: null, text: newReviewText.trim(), createdAt: serverTimestamp()
        });

        // Create notification (fire and forget for better UX)
        if (ad && ad.createdBy && ad.createdBy !== currentUserId) {
          addDoc(collection(db, "notifications"), {
            userId: ad.createdBy,
            senderId: currentUserId,
            type: "review",
            title: "New Review",
            message: `New review received`, link: `/ad-detail/${adId}`,
            postId: adId,
            postType: "ad",
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

  const deleteReview = async (reviewId, hasRating) => {
    if (!window.confirm("Are you sure you want to delete this review? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "adReviews", reviewId));
      if (hasRating) await updateAdRating();
      setToast("Review deleted");
      setActiveMenuId(null);
    } catch (error) {
      setToast("Failed to delete");
    }
    setTimeout(() => setToast(""), 1800);
  };

  const submitReply = async (reviewId, reviewerId) => {
    if (!replyText.trim()) return;
    try {
      await updateDoc(doc(db, "adReviews", reviewId), {
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
            message: `replied to your review`, link: `/ad-detail/${adId}`,
            postId: adId,
            postType: "ad",
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
  const isOwner = ad && currentUserId === ad.createdBy;

  const shareAd = async () => {
    if (!ad) return;

    const shareData = {
      title: ad.title || "Ad",
      text: ad.description || "Check out this ad",
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Silently handle user cancellation or minor errors
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setToast("Link copied to clipboard!");
      } catch (err) {
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
    if (!currentUserId || !ad) return;
    const recipientId = ad.createdBy;
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
        if (data.participants && data.participants.includes(recipientId)) {
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
      const newDoc = await addDoc(chatsRef, {
        participants: [currentUserId, recipientId],
        initiatorId: currentUserId,
        adId,
        lastMessage: "",
        unseenCounts: { [currentUserId]: 0, [recipientId]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      chatId = newDoc.id;

      navigate(`/chat/${chatId}`);
    } catch (error) {
      setToast("Failed to start chat");
      setTimeout(() => setToast(""), 2000);
    }
  };

  if (!ad) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const displayProfileImage = ad.profilePhotoUrl || creator?.photoURL || creator?.profileImage || defaultAvatar;
  const displayUsername = creator?.username || ad.username || "Unknown User";

  return (
    <div className="relative bg-white min-h-screen flex flex-col max-w-md mx-auto" onClick={() => setActiveMenuId(null)}>
      {/* Top bar */}
      <div className="flex items-center mb-1 pt-2 px-3 sticky top-0 bg-white z-20 shadow-sm py-2">
        <button className="mr-3 text-blue-600 rounded-full p-2 hover:bg-blue-50 transition-colors" onClick={() => navigate("/ads")} aria-label="Back">
          <FiArrowLeft size={24} />
        </button>
        <div className="font-bold text-lg text-gray-800 flex-1 truncate">Ad Details</div>
        <div className="flex gap-3 items-center ml-auto">
          <button onClick={shareAd} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
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

        {/* Username */}
        <div className="text-center mt-4 mb-3">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{displayUsername}</h2>
          <p className="text-sm text-gray-500 tracking-normal">Ad Poster</p>
        </div>

        {/* Profile Image */}
        <div className="flex justify-center mb-3">
          <img
            src={displayProfileImage}
            alt={displayUsername}
            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
            onError={(e) => { e.target.src = defaultAvatar; }}
            crossOrigin="anonymous"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{ad.title}</h1>
        </div>

        {/* Image Carousel */}
        {ad.photos && ad.photos.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Photos</h3>
            <div className="w-full flex items-center justify-center">
              <div style={{
                width: "100%", height: 280,
                position: "relative", borderRadius: 16, background: "#f3f4f6"
              }}
                className="overflow-hidden flex justify-center items-center shadow-sm border border-gray-100"
              >
                {ad.photos.length > 1 && (
                  <>
                    <button onClick={() => setCarouselIdx(i => (i - 1 + ad.photos.length) % ad.photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20" aria-label="Previous">
                      <FiChevronLeft size={16} />
                    </button>
                    <button onClick={() => setCarouselIdx(i => (i + 1) % ad.photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20" aria-label="Next">
                      <FiChevronRight size={16} />
                    </button>
                  </>
                )}
                <img
                  src={ad.photos[carouselIdx]}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60"
                  aria-hidden="true"
                  crossOrigin="anonymous"
                />
                <img src={ad.photos[carouselIdx]} alt="ad"
                  className="relative w-full h-full object-contain cursor-pointer z-10"
                  onClick={() => setViewingImage(ad.photos[carouselIdx])}
                  crossOrigin="anonymous" />

                {ad.photos.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {ad.photos.map((_, idx) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === carouselIdx ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl">
          <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Description</h3>
          <p className="text-gray-700 leading-normal whitespace-pre-wrap tracking-normal" style={{ wordSpacing: '0.05em' }}>{ad.description}</p>
        </div>

        {/* Tags */}
        {ad.tags && ad.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {ad.tags.map((tag, index) => (
                <span key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium tracking-normal">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {ad.location && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3 tracking-tight">Location</h3>
            <div className="flex items-start text-gray-700 bg-gray-50 p-3 rounded-lg">
              <FiMapPin className="mt-0.5 mr-2 flex-shrink-0 text-blue-600" />
              <span className="tracking-normal leading-normal">
                {ad.location.area && `${ad.location.area}, `}
                {ad.location.city && `${ad.location.city}`}
                {ad.location.pincode && ` - ${ad.location.pincode}`}
              </span>
            </div>

            {/* Map Component */}
            <div className="mt-3">
              <MapComponent
                latitude={ad.location?.latitude || ad.latitude}
                longitude={ad.location?.longitude || ad.longitude}
                address={`${ad.location?.city || ''} ${ad.location?.area || ''}`}
              />
            </div>
          </div>
        )}

        <hr className="border-gray-200 mb-6" />

        {/* Total Rating */}
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
                          crossOrigin="anonymous"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-gray-900 truncate pr-6">
                              {user.username || "Unknown User"}
                            </h4>
                            {/* Three dots menu for owner or review creator */}
                            {(isOwner || r.userId === currentUserId) && (
                              <div className="relative ml-auto">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === r.id ? null : r.id); }}
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
                                          deleteReview(r.id, r.rating > 0);
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
              <button className="bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors" onClick={shareAd}>
                <FiShare2 /> Share
              </button>
              <button onClick={startChat}
                className="bg-green-600 text-white hover:bg-green-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <FiMessageSquare /> Chat
              </button>
            </div>
          </>
        ) : (
          <button className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md" onClick={shareAd}>
            <FiShare2 /> Share Your Ad
          </button>
        )}
      </div>

      {/* Rate Modal */}
      {rateModalOpen && (
        <Modal onClose={() => { setRateModalOpen(false); setNewRating(0); }}>
          <h3 className="mb-4 text-center text-lg font-bold text-gray-900">Rate this Ad</h3>
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
            placeholder="Share your experience with this ad..."
          />
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={submitReview}
            disabled={newReviewText.trim().length === 0}>
            Post Review
          </button>
        </Modal>
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
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[70]"
          >
            <FiX size={24} />
          </button>

          {ad.photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = (carouselIdx - 1 + ad.photos.length) % ad.photos.length;
                  setCarouselIdx(newIdx);
                  setViewingImage(ad.photos[newIdx]);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[70]"
              >
                <FiChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIdx = (carouselIdx + 1) % ad.photos.length;
                  setCarouselIdx(newIdx);
                  setViewingImage(ad.photos[newIdx]);
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
            crossOrigin="anonymous"
          />
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

