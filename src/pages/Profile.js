import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiEdit2,
  FiCamera,
  FiMoreVertical,
  FiBriefcase,
  FiTool,
  FiTag,
  FiList,
  FiMapPin,
  FiWifi,
  FiChevronLeft,
  FiChevronRight,
  FiStar,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiClock,
  FiEdit,
  FiInfo,
  FiX

} from "react-icons/fi";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useLocationWithAddress } from "../hooks/useLocationWithAddress";
import Layout from "../components/Layout";
import { uploadFile } from "../utils/storage";
import defaultAvatar from "../assets/images/default_profile.svg";
import LocationPickerModal from "../components/LocationPickerModal";
import ImageCropperModal from "../components/ImageCropperModal";
import { useProfileCache } from "../contexts/ProfileCacheContext";
import { useGlobalDataCache } from "../contexts/GlobalDataCacheContext";
import ActionMessageModal from "../components/ActionMessageModal";
import { compressProfileImage } from "../utils/compressor";
import { formatExpiry } from "../utils/expiryUtils";
import { formatLastSeen } from "../utils/timeUtils";

// API Keys removed - handled by backend proxy via locationService

async function uploadProfileImage(file) {
  try {
    const url = await uploadFile(file, 'profiles');
    return url;
  } catch (error) {
    console.error("Profile Image Upload Error:", error);
    throw error;
  }
}

// Helper functions
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const lat1Num = parseFloat(lat1);
  const lon1Num = parseFloat(lon1);
  const lat2Num = parseFloat(lat2);
  const lon2Num = parseFloat(lon2);
  if (isNaN(lat1Num) || isNaN(lon1Num) || isNaN(lat2Num) || isNaN(lon2Num)) return null;
  const R = 6371;
  const dLat = (lat2Num - lat1Num) * Math.PI / 180;
  const dLon = (lon2Num - lon1Num) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1Num * Math.PI / 180) * Math.cos(lat2Num * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


function isUserOnline(userId, currentUserId, online, lastSeen) {
  // Current user is always shown as online
  if (userId === currentUserId) return true;

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

// Validation helper function
function isValidCoordinate(value) {
  if (!value) return false;
  const numValue = parseFloat(value);
  return !isNaN(numValue) && /^[-+]?[0-9]*\.?[0-9]+$/.test(value);
}

// PostMenu Component - Compact modal style
function PostMenu({ post, closeMenu, updatePosts, currentTab, setShowConfirm, setConfirmProps, setShowAbout, navigate, user, profile, setActionModal }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = 'auto';
    };
  }, [closeMenu]);

  const isServiceWithTimeExpiry = () => {
    if (currentTab !== "services" || !post.expiry) return false;
    try {
      const expiryDate = post.expiry.toDate ? post.expiry.toDate() : new Date(post.expiry);
      const year = expiryDate.getFullYear();
      return year !== 9999 && year < 9000;
    } catch (error) {
      return false;
    }
  };

  const hasTimeExpiry = isServiceWithTimeExpiry();
  const status = post.status || "active";

  const notifyFavoritors = async (action, post) => {
    const colName = currentTab;
    let favCol = "";
    let idField = "";
    let typeLabel = "";

    if (colName === "workers") {
      favCol = "workerFavorites";
      idField = "workerId";
      typeLabel = "Worker";
    } else if (colName === "services") {
      favCol = "serviceFavorites";
      idField = "serviceId";
      typeLabel = "Service";
    } else if (colName === "ads") {
      favCol = "adFavorites";
      idField = "adId";
      typeLabel = "Ad";
    }

    if (!favCol) return;

    try {
      const q = query(collection(db, favCol), where(idField, "==", post.id));
      const snap = await getDocs(q);

      const promises = snap.docs.map(docSnap => {
        const data = docSnap.data();
        if (data.userId) {
          const ownerName = profile?.username || profile?.name || "User";
          const titleWords = post.name || post.title || "";
          const postType = typeLabel.toLowerCase();
          const displayType = postType === 'ad' ? 'ads' : postType;

          let title = "";
          let message = "";

          if (action === "expire") {
            title = "Favorite Expired";
            message = `${ownerName} expired "${titleWords}" post and the ${displayType} post is removed from favorites`;
          } else if (action === "disable") {
            title = "Favorite Disabled";
            message = `${ownerName} disabled "${titleWords}" post and the ${displayType} post is vanished from favorites, it will be seen back when it is enabled back`;
          } else if (action === "delete") {
            title = "Favorite Deleted";
            message = `a ${displayType} post is deleted by the post owner and the post is vanished from favorites`;
          } else if (action === "enable") {
            title = "Favorite Available";
            message = `${ownerName} enabled "${titleWords}" post and now the ${displayType} post is available in favorites, `;
          }

          if (title) {
            return addDoc(collection(db, "notifications"), {
              userId: data.userId,
              senderId: user.uid,
              type: "post_status",
              title: title,
              message: message,
              postId: post.id,
              postType: postType,
              link: action === "delete" ? null : `/${colName.slice(0, -1)}-detail/${post.id}`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

    } catch (err) {
    }
  };

  const handleAction = async (action) => {
    const col = currentTab;
    const ref = doc(db, col, post.id);

    closeMenu(); // Always close menu first

    if (action === "edit") {
      if (col === "workers") navigate(`/editworker/${post.id}`);
      else if (col === "services") navigate(`/editservice/${post.id}`);
      else navigate(`/editad/${post.id}`);
      return;
    }

    if (action === "about") {
      setShowAbout(true);
      return;
    }

    if (["enable", "disable", "expire", "delete"].includes(action)) {
      setShowConfirm(true);
      setConfirmProps({
        text:
          action === "enable"
            ? "Are you sure you want to enable this post?"
            : action === "disable"
              ? "Are you sure you want to disable this post?"
              : action === "expire"
                ? "Are you sure you want to expire this post? It will disappear from all pages except your profile."
                : "Are you sure you want to delete this post? This action cannot be undone.",
        onConfirm: async () => {
          try {
            // Notify favoritors before deleting (if deleting) or after updating
            // Actually, we can do it in parallel or after.
            // Fire and forget notification
            notifyFavoritors(action, post);

            if (action === "enable" || action === "disable") {
              await updateDoc(ref, { status: action === "enable" ? "active" : "disabled" });
              setActionModal({ isOpen: true, title: "Success", message: `Post ${action}d successfully!`, type: "success" });
            } else if (action === "expire") {
              await updateDoc(ref, { status: "expired" });
              setActionModal({ isOpen: true, title: "Success", message: "Post expired successfully!", type: "success" });
            } else if (action === "delete") {
              await deleteDoc(ref);
              setActionModal({ isOpen: true, title: "Success", message: "Post deleted successfully!", type: "success" });
            }

            updatePosts((prev) => ({
              ...prev,
              [col]: action === "delete"
                ? prev[col].filter((p) => p.id !== post.id)
                : prev[col].map((p) =>
                  p.id === post.id
                    ? {
                      ...p,
                      status: action === "expire"
                        ? "expired"
                        : action === "enable"
                          ? "active"
                          : action === "disable"
                            ? "disabled"
                            : p.status
                    }
                    : p),
            }));
          } catch (error) {
            console.error("Error updating post:", error);
            setActionModal({ isOpen: true, title: "Error", message: "Failed to update post. Please try again.", type: "error" });
          }
          setShowConfirm(false);
        },
      });
    }
  };

  const getMenuOptions = () => {
    const options = [];

    if (status === "active") {
      options.push(
        { icon: FiEdit, label: "Edit", action: "edit", color: "text-gray-700" },
        { icon: FiClock, label: "Expire", action: "expire", color: "text-gray-700" }
      );
      if (!hasTimeExpiry) {
        options.push({ icon: FiEyeOff, label: "Disable", action: "disable", color: "text-gray-700" });
      }
    } else if (status === "disabled") {
      options.push(
        { icon: FiEye, label: "Enable", action: "enable", color: "text-gray-700" },
        { icon: FiClock, label: "Expire", action: "expire", color: "text-gray-700" }
      );
    }

    // Delete option is always available
    options.push({ icon: FiTrash2, label: "Delete", action: "delete", color: "text-red-600" });

    // About option is always available
    options.push({ icon: FiInfo, label: "About Options", action: "about", color: "text-blue-600" });

    return options;
  };

  const menuOptions = getMenuOptions();

  return React.createElement("div", {
    className: "fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-fade-in p-4"
  },
    React.createElement("div", {
      ref: modalRef,
      className: "bg-white rounded-xl shadow-lg w-full max-w-xs animate-slide-up"
    },
      // Modal Header - Compact
      React.createElement("div", {
        className: "px-4 pt-4 pb-2"
      },
        React.createElement("div", {
          className: "flex items-center justify-between"
        },
          React.createElement("h3", {
            className: "font-bold text-base text-gray-900"
          }, "Manage Post"),
          React.createElement("button", {
            onClick: closeMenu,
            className: "p-1 hover:bg-gray-100 rounded-full transition-colors",
            "aria-label": "Close"
          },
            React.createElement(FiX, { size: 18, className: "text-gray-500" })
          )
        ),
        React.createElement("p", {
          className: "text-xs text-gray-500 mt-1"
        }, "Select an action for this " + currentTab.slice(0, -1))
      ),

      // Menu Options - Compact
      React.createElement("div", {
        className: "px-2 py-1"
      },
        menuOptions.map((option, index) =>
          React.createElement("button", {
            key: option.action,
            className: "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors rounded-lg " + option.color + " font-medium text-sm mb-1 last:mb-0",
            onClick: (e) => {
              e.stopPropagation();
              handleAction(option.action);
            }
          },
            React.createElement(option.icon, { size: 16, className: "flex-shrink-0" }),
            React.createElement("span", {
              className: "flex-1"
            }, option.label)
          )
        )
      ),

      // Modal Footer - Compact
      React.createElement("div", {
        className: "px-4 py-3 border-t border-gray-100"
      },
        React.createElement("button", {
          onClick: closeMenu,
          className: "w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
        }, "Cancel")
      )
    )
  );
}

/**
 * Profile Page - Optimized with GlobalDataCacheContext
 * 
 * OPTIMIZATION: Uses global cache for workers/services/ads
 * - First visit: Data may already be in global cache (0 reads)
 * - Global cache provides real-time updates automatically
 * - Only profile data is fetched independently (1 read)
 */
export default function Profile() {
  const navigate = useNavigate();
  const { invalidateCache } = useProfileCache();
  const { userProfile: globalUserProfile, myPosts: globalMyPosts, myPostsLoading: globalMyPostsLoading } = useGlobalDataCache();

  /* 
   * OPTIMIZATION: Removed redundant local 'posts' state to fix synchronization issues.
   * We now use 'globalMyPosts' and 'globalUserProfile' directly.
   */

  // Safe defaults
  const currentProfile = globalUserProfile || {};
  const currentPosts = globalMyPosts || { workers: [], services: [], ads: [] };

  // Local state only for critical UI interactions
  const [user, setUser] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState({});
  const [imagePreview, setImagePreview] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [tab, setTab] = useState("workers");
  const [servicePhase, setServicePhase] = useState("all");
  const [menuPostId, setMenuPostId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmProps, setConfirmProps] = useState({});
  const [showAbout, setShowAbout] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [actionModal, setActionModal] = useState({ isOpen: false, title: "", message: "", type: "success" });

  const { location, address, error: locationErr, loading: locationLoading, addressLoading, requestLocation } = useLocationWithAddress(null, 'opencage');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        navigate("/login");
      }
    });

    return () => unsub();
  }, [navigate]);

  // Sync editing profile with global profile when not editing
  useEffect(() => {
    if (globalUserProfile && !editMode) {
      setEditingProfile(prev => ({ ...prev, ...globalUserProfile }));
    }
    // Also update local user map for consistency
    if (globalUserProfile && user) {
      setUserProfiles(prev => ({ ...prev, [user.uid]: globalUserProfile }));
    }
  }, [globalUserProfile, user, editMode]);

  // Use derived loading state
  const loading = globalMyPostsLoading || !globalUserProfile;

  useEffect(() => {
    // Only auto-fill location if edit mode is on AND no location is set yet
    if (editMode) {
      setEditingProfile((prev) => {
        // Check if city or place is already set in the current state
        if (prev.city || prev.place) {
          return prev; // Don't auto-fill if location is already set
        }

        if (location && address) {
          setStatusMsg("Location autofilled!");
          return {
            ...prev,
            latitude: location.latitude,
            longitude: location.longitude,
            place: address.place || "",
            city: address.city || "",
            pincode: address.pincode || "",
          };
        }
        return prev;
      });

      if (locationErr) setStatusMsg(locationErr);
    }
  }, [location, address, locationErr, editMode]);

  function startEditing() {
    // Only copy existing profile data, don't auto-fill location
    setEditingProfile({ ...currentProfile });
    setImagePreview("");
    setEditMode(true);
    setStatusMsg("");
    // Don't request location automatically - only when user clicks "Get Current Location"
  }

  function cancelEditing() {
    setEditingProfile({ ...currentProfile });
    setImagePreview("");
    setEditMode(false);
    setStatusMsg("");
  }

  // Image Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCropImageSrc(url);
      setShowCropper(true);
      e.target.value = null; // Reset input so same file can be selected again
    }
  }

  async function handleCropComplete(croppedBlob) {
    setShowCropper(false);
    setStatusMsg("Compressing & Uploading image...");

    try {
      // Convert Blob to File
      const file = new File([croppedBlob], "profile_pic.jpg", { type: "image/jpeg" });
      const compressedFile = await compressProfileImage(file);
      const url = await uploadProfileImage(compressedFile);

      setEditingProfile((prev) => ({ ...prev, profileImage: url }));
      setImagePreview(url);
      setStatusMsg("Upload successful!");
    } catch (err) {
      setStatusMsg("Upload failed. Please try again.");
    } finally {
      // Cleanup
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setEditingProfile((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGetLocation() {
    setStatusMsg("Getting location...");
    // Request location and wait for it
    await requestLocation();

    // After location is obtained, update the form
    if (location && address) {
      setEditingProfile((prev) => ({
        ...prev,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        place: address.place || "",
        city: address.city || "",
        pincode: address.pincode || "",
      }));
      setStatusMsg("Location updated! ✓");
    } else if (locationErr) {
      setStatusMsg("Error: " + locationErr);
    }
  }



  async function handleSave() {
    // Validate location
    const hasLatLong = editingProfile.latitude && editingProfile.longitude;
    const hasCityPlace = editingProfile.city && editingProfile.place;

    if (!hasLatLong) {
      setStatusMsg("Error: Please set latitude and longitude for location");
      return;
    }

    if (!hasCityPlace) {
      setStatusMsg("Error: Please set city and place");
      return;
    }

    // Validate coordinate format
    if (!isValidCoordinate(editingProfile.latitude) || !isValidCoordinate(editingProfile.longitude)) {
      setStatusMsg("Error: Latitude and longitude must be valid numbers");
      return;
    }

    setProfileSaving(true);
    try {
      const updatedData = {
        city: editingProfile.city || "",
        place: editingProfile.place || "",
        pincode: editingProfile.pincode || "",
        latitude: editingProfile.latitude || "",
        longitude: editingProfile.longitude || "",
        landmark: editingProfile.landmark || "",
        profileImage: editingProfile.profileImage || "",
      };

      await updateDoc(doc(db, "profiles", user.uid), updatedData);


      // OPTIMIZATION: Propagate profile changes to all user's posts (Denormalization Sync)
      // Only necessary if profile image changed (as that's the only visible author field editable here)
      if (updatedData.profileImage !== currentProfile.profileImage) {
        const batch = writeBatch(db);
        let opCount = 0;
        const BATCH_LIMIT = 450; // Safety margin below 500

        const addToBatch = (collectionName, posts) => {
          posts.forEach(post => {
            if (opCount < BATCH_LIMIT) {
              const postRef = doc(db, collectionName, post.id);
              // Use dot notation to update nested field without overwriting 'author'
              batch.update(postRef, { 'author.photoURL': updatedData.profileImage });
              opCount++;
            }
          });
        };

        addToBatch('workers', currentPosts.workers || []);
        addToBatch('services', currentPosts.services || []);
        addToBatch('ads', currentPosts.ads || []);

        if (opCount > 0) {
          await batch.commit();
        }
      }

      // UI update is handled automatically by global listener
      setEditMode(false);
      setStatusMsg("Profile updated successfully!");

      // Update the global cache to invalidate stale data
      // The onSnapshot listener will update with fresh data
      invalidateCache(user.uid);
    } catch (error) {
      setStatusMsg("Error saving profile");
    } finally {
      setProfileSaving(false);
    }
  }

  // Empty state components
  const EmptyState = ({ type }) => {
    const getEmptyConfig = () => {
      switch (type) {
        case "workers":
          return {
            icon: FiBriefcase,
            title: "No Workers Available",
            description: "You haven't posted any workers yet.",
            actionText: "Post a Worker",
            action: () => navigate("/add-workers")
          };
        case "services":
          return {
            icon: FiTool,
            title: "No Services Found",
            description: servicePhase === "all"
              ? "You haven't posted any services yet."
              : "You haven't posted any " + servicePhase + " services yet.",
            actionText: "Post a Service",
            action: () => navigate("/add-services")
          };
        case "ads":
          return {
            icon: FiTag,
            title: "No Ads Posted",
            description: "You haven't created any advertisements yet.",
            actionText: "Create an Ad",
            action: () => navigate("/add-ads")
          };
        default:
          return {
            icon: FiList,
            title: "No Items Found",
            description: "You haven't posted anything here yet.",
            actionText: "Get Started",
            action: () => navigate("/" + type)
          };
      }
    };

    const config = getEmptyConfig();
    const IconComponent = config.icon;

    return React.createElement("div", {
      className: "text-center py-12 px-4"
    },
      React.createElement(IconComponent, { size: 48, className: "mx-auto text-gray-300 mb-4" }),
      React.createElement("h3", {
        className: "text-lg font-semibold text-gray-600 mb-2"
      }, config.title),
      React.createElement("p", {
        className: "text-sm text-gray-500 mb-6 max-w-xs mx-auto"
      }, config.description),
      React.createElement("button", {
        onClick: config.action,
        className: "px-6 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl hover:opacity-90 transition-all text-sm font-bold shadow-lg shadow-indigo-500/30"
      }, config.actionText)
    );
  };

  // Worker Card Component
  // Worker Card Component
  function WorkerCard({ post }) {
    const { title, rating = 0, location = {}, tags = [], latitude, longitude, createdBy, avatarUrl } = post;
    const workerCreatorProfile = userProfiles[createdBy] || {};
    const displayUsername = workerCreatorProfile.username || workerCreatorProfile.name || "User";
    const displayProfileImage = avatarUrl || workerCreatorProfile.photoURL || workerCreatorProfile.profileImage || defaultAvatar;
    const displayOnline = workerCreatorProfile.online;
    const displayLastSeen = workerCreatorProfile.lastSeen;

    let distanceText = "Distance away: --";
    if (currentProfile && currentProfile.latitude && currentProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(currentProfile.latitude, currentProfile.longitude, latitude, longitude);
      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? Math.round(distance * 1000) + "m" : distance.toFixed(1) + "km";
        distanceText = "Distance away: " + distValue + " away";
      }
    }

    const isOnline = isUserOnline(createdBy, user?.uid, displayOnline, displayLastSeen);

    // Determine status indicator
    const status = post.status || "active";
    let statusColor = "";
    let statusText = "";

    if (status === "active") {
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    } else if (status === "disabled") {
      statusColor = "bg-gray-600";
      statusText = "Disabled";
    } else if (status === "expired") {
      statusColor = "bg-red-600";
      statusText = "Expired";
    } else {
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    }

    return React.createElement("div", {
      className: "bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all",
      onClick: () => navigate(`/worker-detail/${post.id}`)
    },
      React.createElement("div", {
        className: "flex items-start gap-3"
      },
        // Left Column: Image & Rating
        React.createElement("div", {
          className: "flex flex-col items-center flex-shrink-0 w-16"
        },
          React.createElement("div", {
            className: "relative mb-1.5"
          },
            React.createElement("img", {
              src: displayProfileImage,
              alt: displayUsername,
              className: "w-14 h-14 rounded-full object-cover border-2 border-gray-300",
              onError: (e) => { e.target.src = defaultAvatar; },
              crossOrigin: "anonymous"
            }),
            // Status dot
            React.createElement("div", {
              className: "absolute bottom-0 right-0 w-3 h-3 " + statusColor + " rounded-full border-2 border-white"
            })
          ),
          React.createElement("div", {
            className: "flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200"
          },
            React.createElement(FiStar, { size: 10, className: "fill-yellow-400 text-yellow-400" }),
            React.createElement("span", {
              className: "text-[10px] font-semibold text-yellow-700"
            }, rating.toFixed(1))
          )
        ),

        // Right Column: Content
        React.createElement("div", {
          className: "flex-1 min-w-0"
        },
          // Row 1: Username & Status
          React.createElement("div", {
            className: "flex justify-between items-start mb-0.5"
          },
            React.createElement("h3", {
              className: "font-semibold text-gray-900 text-sm truncate pr-2"
            }, displayUsername),
            React.createElement("span", {
              className: "text-xs " + (status === "active" && isOnline ? "text-green-600" : status === "disabled" ? "text-gray-500" : status === "expired" ? "text-red-600" : "text-gray-500") + " flex items-center gap-1 flex-shrink-0"
            },
              React.createElement(FiWifi, {
                size: 10,
                className: status === "active" && isOnline ? "text-green-500" : status === "disabled" ? "text-gray-400" : status === "expired" ? "text-red-400" : "text-gray-400"
              }),
              statusText
            )
          ),

          // Row 2: Title
          React.createElement("p", {
            className: "text-indigo-600 text-xs font-medium mb-2 truncate"
          }, title || "No Title"),

          // Row 3: Tags & Distance
          React.createElement("div", {
            className: "flex justify-between items-center mb-2"
          },
            React.createElement("div", {
              className: "flex gap-1 flex-wrap overflow-hidden h-5"
            },
              (tags || []).slice(0, 3).map((tag, idx) =>
                React.createElement("span", {
                  key: idx,
                  className: "bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
                }, "#" + tag)
              ),
              ((tags || []).length > 3) && React.createElement("span", {
                className: "bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded text-[9px]"
              }, "+" + ((tags || []).length - 3) + " more")
            ),
            React.createElement("span", {
              className: "text-[10px] font-medium text-gray-500 whitespace-nowrap ml-2 flex-shrink-0"
            }, distanceText)
          ),

          // Row 4: Location
          React.createElement("div", {
            className: "flex items-center text-gray-500 text-[10px]"
          },
            React.createElement(FiMapPin, { size: 10, className: "mr-0.5 flex-shrink-0" }),
            React.createElement("span", {
              className: "truncate"
            },
              (location.area || "Unknown") + ", " + (location.city || "Unknown") +
              (location.pincode ? ", " + location.pincode : "")
            )
          )
        ),

        // Three-dot menu button
        React.createElement("div", {
          className: "flex-shrink-0"
        },
          React.createElement("button", {
            className: "p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors",
            onClick: (e) => {
              e.stopPropagation();
              setMenuPostId(post.id);
            },
            "aria-label": "Options"
          },
            React.createElement(FiMoreVertical, { size: 20 })
          )
        )
      )
    );
  }

  // Service Card Component
  function ServiceCard({ post }) {
    const { title, location = {}, tags = [], latitude, longitude, createdBy, profilePhotoUrl, type, serviceType, expiry } = post;
    const creatorProfile = userProfiles[createdBy] || {};
    const displayUsername = creatorProfile.username || "Unknown User";
    const displayProfileImage = profilePhotoUrl || creatorProfile.photoURL || creatorProfile.profileImage || defaultAvatar;
    const displayOnline = creatorProfile.online;
    const displayLastSeen = creatorProfile.lastSeen;

    const finalType = type || serviceType || "provide";
    const isProviding = finalType === "provide";

    // Real-time expiry state
    const [expiryInfo, setExpiryInfo] = useState(() => formatExpiry(expiry));

    useEffect(() => {
      if (!expiry) return;
      const timer = setInterval(() => {
        setExpiryInfo(formatExpiry(expiry));
      }, 60000);
      return () => clearInterval(timer);
    }, [expiry]);

    let distanceText = "Distance away: --";
    if (currentProfile && currentProfile.latitude && currentProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(currentProfile.latitude, currentProfile.longitude, latitude, longitude);
      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? Math.round(distance * 1000) + "m" : distance.toFixed(1) + "km";
        distanceText = "Distance away: " + distValue + " away";
      }
    }

    const { text: expiryText, color: expiryColor, isExpiringNow } = expiryInfo;

    // Determine status indicator
    const status = post.status || "active";
    let statusColor = "";
    let statusText = "";

    if (status === "active") {
      const isOnline = isUserOnline(createdBy, user?.uid, displayOnline, displayLastSeen);
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    } else if (status === "disabled") {
      statusColor = "bg-gray-400";
      statusText = "Disabled";
    } else if (status === "expired") {
      statusColor = "bg-red-600";
      statusText = "Expired";
    } else {
      const isOnline = isUserOnline(createdBy, user?.uid, displayOnline, displayLastSeen);
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
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
          return "Expiry: N/A";
        } else {
          return `Until: ${expiryDate.toLocaleString(undefined, {
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

    return React.createElement("div", {
      className: "bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-2.5 cursor-pointer hover:shadow-md transition-all",
      onClick: () => navigate(`/service-detail/${post.id}`)
    },
      React.createElement("div", {
        className: "flex items-start gap-3"
      },
        // Left Column: Image & Type Badge
        React.createElement("div", {
          className: "flex flex-col items-center flex-shrink-0 w-16"
        },
          React.createElement("div", {
            className: "relative mb-1.5"
          },
            React.createElement("img", {
              src: displayProfileImage,
              alt: displayUsername,
              className: "w-14 h-14 rounded-full object-cover border-2 border-gray-300",
              onError: (e) => { e.target.src = defaultAvatar; },
              crossOrigin: "anonymous"
            }),
            // Status dot
            React.createElement("div", {
              className: "absolute bottom-0 right-0 w-3 h-3 " + statusColor + " rounded-full border-2 border-white"
            })
          ),
          React.createElement("div", {
            className: "flex items-center justify-center px-1.5 py-0.5 rounded border w-full mb-1 " + (isProviding ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700")
          },
            React.createElement("span", {
              className: "text-[9px] font-semibold uppercase"
            }, isProviding ? "Providing" : "Asking")
          ),
          React.createElement("div", {
            className: "flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200"
          },
            React.createElement(FiStar, { size: 10, className: "fill-yellow-400 text-yellow-400" }),
            React.createElement("span", {
              className: "text-[10px] font-semibold text-yellow-700"
            }, (creatorProfile.rating || 0).toFixed(1))
          )
        ),

        // Right Column: Content
        React.createElement("div", {
          className: "flex-1 min-w-0"
        },
          // Row 1: Username & Status
          React.createElement("div", {
            className: "flex justify-between items-start mb-0.5"
          },
            React.createElement("h3", {
              className: "font-semibold text-gray-900 text-sm truncate pr-2"
            }, displayUsername),
            React.createElement("span", {
              className: "text-xs " + (status === "active" ? "text-green-600" : status === "disabled" ? "text-gray-500" : "text-red-600") + " flex items-center gap-1 flex-shrink-0"
            },
              React.createElement(FiWifi, {
                size: 10,
                className: status === "active" ? "text-green-500" : status === "disabled" ? "text-gray-400" : "text-red-400"
              }),
              statusText
            )
          ),

          // Row 2: Title
          React.createElement("p", {
            className: "text-blue-600 text-xs font-medium mb-2 truncate"
          }, title || "No Title"),

          // Row 3: Tags & Distance
          React.createElement("div", {
            className: "flex justify-between items-center mb-2"
          },
            React.createElement("div", {
              className: "flex gap-1 flex-wrap overflow-hidden h-5"
            },
              (tags || []).slice(0, 3).map((tag, idx) =>
                React.createElement("span", {
                  key: idx,
                  className: "bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
                }, "#" + tag)
              ),
              ((tags || []).length > 3) && React.createElement("span", {
                className: "bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded text-[9px]"
              }, "+" + ((tags || []).length - 3) + " more")
            ),
            React.createElement("div", {
              className: "flex flex-col items-end gap-0.5 ml-2 flex-shrink-0"
            },
              React.createElement("span", {
                className: "text-[10px] font-medium text-gray-500 whitespace-nowrap"
              }, distanceText)
            )
          ),

          // Row 4: Location
          React.createElement("div", {
            className: "flex items-center text-[10px] text-gray-500 mb-1"
          },
            React.createElement(FiMapPin, { size: 10, className: "mr-0.5 flex-shrink-0" }),
            React.createElement("span", {
              className: "truncate"
            }, [location.area, location.landmark, location.city, location.pincode].filter(Boolean).join(", ") || "Unknown")
          ),

          // Row 5: Until and Expiry in same row
          React.createElement("div", {
            className: "flex items-center justify-between text-[10px]"
          },
            untilText && React.createElement("span", {
              className: "text-gray-500 whitespace-nowrap"
            }, untilText),
            expiryText && React.createElement("span", {
              className: expiryColor + " whitespace-nowrap font-medium " + (isExpiringNow ? "animate-pulse bg-red-100 px-1 rounded" : "")
            }, expiryText)
          )
        ),

        // Three-dot menu button
        React.createElement("div", {
          className: "flex-shrink-0"
        },
          React.createElement("button", {
            className: "p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors",
            onClick: (e) => {
              e.stopPropagation();
              setMenuPostId(post.id);
            },
            "aria-label": "Options"
          },
            React.createElement(FiMoreVertical, { size: 20 })
          )
        )
      )
    );
  }

  // Ad Card Component
  function AdCard({ post }) {
    const {
      profileImage,
      photos = [],
      title,
      rating = 0,
      location = {},
      tags = [],
      latitude,
      longitude,
      createdBy
    } = post;

    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const adCreatorProfile = userProfiles[createdBy] || {};
    const displayUsername = adCreatorProfile.username || "Unknown User";
    const displayProfileImage = adCreatorProfile.photoURL || adCreatorProfile.profileImage || profileImage || defaultAvatar;
    const displayOnline = adCreatorProfile.online;
    const displayLastSeen = adCreatorProfile.lastSeen;

    let distanceText = "Distance away: --";
    if (currentProfile && currentProfile.latitude && currentProfile.longitude && latitude && longitude) {
      const distance = getDistanceKm(
        currentProfile.latitude,
        currentProfile.longitude,
        latitude,
        longitude
      );

      if (distance !== null && !isNaN(distance)) {
        const distValue = distance < 1 ? Math.round(distance * 1000) + "m" : distance.toFixed(1) + "km";
        distanceText = "Distance away: " + distValue;
      }
    }

    // Determine status indicator
    const status = post.status || "active";
    let statusColor = "";
    let statusText = "";

    if (status === "active") {
      const isOnline = isUserOnline(createdBy, user?.uid, displayOnline, displayLastSeen);
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    } else if (status === "disabled") {
      statusColor = "bg-gray-400";
      statusText = "Disabled";
    } else if (status === "expired") {
      statusColor = "bg-red-500";
      statusText = "Expired";
    } else {
      const isOnline = isUserOnline(createdBy, user?.uid, displayOnline, displayLastSeen);
      statusColor = "bg-green-500";
      statusText = isOnline ? "Online" : formatLastSeen(displayLastSeen);
    }

    const handlePrevPhoto = (e) => {
      e.stopPropagation();
      setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    };

    const handleNextPhoto = (e) => {
      e.stopPropagation();
      setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    };

    return React.createElement("div", {
      className: "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4 cursor-pointer hover:shadow-md transition-shadow",
      onClick: () => navigate(`/ad-detail/${post.id}`)
    },
      // User info header
      React.createElement("div", {
        className: "flex items-center gap-3 p-3 border-b border-gray-100"
      },
        React.createElement("div", {
          className: "relative flex-shrink-0"
        },
          React.createElement("img", {
            src: displayProfileImage,
            alt: displayUsername,
            className: "w-10 h-10 rounded-full object-cover border-2 border-gray-300",
            onError: (e) => { e.target.src = defaultAvatar; },
            crossOrigin: "anonymous"
          }),
          // Status dot
          React.createElement("div", {
            className: "absolute bottom-0 right-0 w-3 h-3 " + statusColor + " rounded-full border-2 border-white"
          })
        ),
        React.createElement("div", {
          className: "flex-1 min-w-0"
        },
          React.createElement("div", {
            className: "flex items-center justify-between gap-2"
          },
            React.createElement("h3", {
              className: "font-semibold text-sm text-gray-900 truncate"
            }, displayUsername),
            React.createElement("div", {
              className: "flex items-center gap-1 text-yellow-500 flex-shrink-0"
            },
              React.createElement(FiStar, { size: 16, className: "fill-current" }),
              React.createElement("span", {
                className: "text-sm font-semibold"
              }, rating.toFixed(1)),
            )
          ),
          React.createElement("div", {
            className: "flex items-center gap-1 text-xs text-gray-500"
          },
            React.createElement(FiWifi, {
              size: 10,
              className: status === "active" ? "text-green-500" : status === "disabled" ? "text-gray-400" : "text-red-400"
            }),
            React.createElement("span", null, statusText)
          )
        ),

        // Three-dot menu button
        React.createElement("div", {
          className: "flex-shrink-0"
        },
          React.createElement("button", {
            className: "p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors",
            onClick: (e) => {
              e.stopPropagation();
              setMenuPostId(post.id);
            },
            "aria-label": "Options"
          },
            React.createElement(FiMoreVertical, { size: 20 })
          )
        )
      ),

      // Ad content
      React.createElement("div", {
        className: "relative w-full h-56 md:h-72 bg-gray-100 overflow-hidden"
      },
        photos && photos.length > 0 ? React.createElement(React.Fragment, null,
          // Blurred background for vertical/odd aspect ratio images
          React.createElement("img", {
            src: photos[currentPhotoIndex],
            alt: "",
            className: "absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60",
            "aria-hidden": "true",
            crossOrigin: "anonymous"
          }),
          // Main authentic image
          React.createElement("img", {
            src: photos[currentPhotoIndex],
            alt: title,
            className: "relative w-full h-full object-contain z-10",
            onError: (e) => { e.target.style.display = 'none'; },
            crossOrigin: "anonymous"
          }),

          photos.length > 1 && React.createElement(React.Fragment, null,
            React.createElement("button", {
              onClick: handlePrevPhoto,
              className: "absolute left-1 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20",
              "aria-label": "Previous photo"
            },
              React.createElement(FiChevronLeft, { size: 16 })
            ),
            React.createElement("button", {
              onClick: handleNextPhoto,
              className: "absolute right-1 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white/90 text-gray-800 p-1 rounded-full transition-all z-20",
              "aria-label": "Next photo"
            },
              React.createElement(FiChevronRight, { size: 16 })
            ),

            React.createElement("div", {
              className: "absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20"
            },
              photos.map((_, index) =>
                React.createElement("div", {
                  key: index,
                  className: "w-1.5 h-1.5 rounded-full transition-all " + (index === currentPhotoIndex ? 'bg-white w-4' : 'bg-white/50')
                })
              )
            )
          )
        ) : React.createElement("div", {
          className: "flex items-center justify-center h-full text-gray-400"
        }, "No Image")
      ),

      React.createElement("div", {
        className: "p-3"
      },
        React.createElement("h4", {
          className: "font-semibold text-gray-900 mb-2 line-clamp-2"
        }, title),

        // Tags
        tags && tags.length > 0 && React.createElement("div", {
          className: "flex flex-wrap gap-1 mb-2"
        },
          tags.slice(0, 3).map((tag, index) =>
            React.createElement("span", {
              key: index,
              className: "bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium"
            }, "#" + tag)
          ),
          tags.length > 3 && React.createElement("span", {
            className: "bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium"
          }, "+" + (tags.length - 3))
        ),

        // Location
        location && (location.city || location.area) && React.createElement("div", {
          className: "flex items-start justify-between gap-2 text-xs text-gray-600 mt-2"
        },
          React.createElement("div", {
            className: "flex items-start gap-1 flex-1 min-w-0"
          },
            React.createElement(FiMapPin, { size: 12, className: "flex-shrink-0 mt-0.5" }),
            React.createElement("span", {
              className: "break-words"
            }, [location.area, location.landmark, location.city, location.pincode].filter(Boolean).join(", "))
          ),
          React.createElement("span", {
            className: "text-[10px] font-medium text-gray-500 whitespace-nowrap flex-shrink-0"
          }, distanceText)
        )
      )
    );
  }

  function renderPostCard(post) {
    if (tab === "workers") {
      return React.createElement(WorkerCard, { key: post.id, post: post });
    } else if (tab === "services") {
      return React.createElement(ServiceCard, { key: post.id, post: post });
    } else if (tab === "ads") {
      return React.createElement(AdCard, { key: post.id, post: post });
    }
    return null;
  }

  // Get filtered posts for current tab
  const getFilteredPosts = () => {
    if (tab === "services") {
      return currentPosts.services.filter((p) => {
        if (servicePhase === "all") return true;

        // Get the actual service type from the post
        const postType = p.type || p.serviceType || "provide";

        if (servicePhase === "providing") {
          return postType === "provide" || postType === "providing";
        } else if (servicePhase === "asking") {
          return postType === "ask" || postType === "asking";
        }
        return true;
      });
    }
    return currentPosts[tab];
  };

  const filteredPosts = getFilteredPosts();

  if (loading) return React.createElement("div", {
    className: "flex justify-center items-center h-screen"
  },
    React.createElement("div", {
      className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
    })
  );

  return React.createElement(Layout, {
    title: "My Profile",
    activeTab: "profile"
  },

    // Main Content
    React.createElement("main", {
      className: "flex-1 pb-20"
    },
      // Profile Info Section
      React.createElement("section", {
        className: "relative mt-4 mx-4 p-6 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center overflow-hidden"
      },
        React.createElement("div", {
          className: "absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-pink-500 opacity-10"
        }),

        React.createElement("div", {
          className: "relative mb-3 mt-2"
        },
          React.createElement("img", {
            src: editMode ? imagePreview || editingProfile.profileImage || defaultAvatar : currentProfile?.profileImage || defaultAvatar,
            alt: "Profile",
            className: "w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover",
            crossOrigin: "anonymous"
          }),
          editMode && React.createElement("label", {
            className: "absolute bottom-1 right-1 bg-indigo-600 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-indigo-700 transition-colors"
          },
            React.createElement(FiCamera, { size: 16 }),
            React.createElement("input", {
              type: "file",
              accept: "image/*",
              className: "hidden",
              onChange: handleImageChange
            })
          )
        ),

        React.createElement("h2", {
          className: "font-bold text-xl text-gray-900"
        }, currentProfile?.username || ""),
        React.createElement("p", {
          className: "text-sm text-gray-500 mb-1"
        }, user?.email || ""),

        // Location display with status
        React.createElement("div", {
          className: "flex flex-col items-center gap-1 mt-2"
        },
          // Location display
          React.createElement("div", {
            className: "flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-3 py-1 rounded-full border border-gray-100"
          },
            React.createElement("span", {
              className: "truncate max-w-[200px]"
            },
              (currentProfile?.place && currentProfile?.city ? currentProfile.place + ", " + currentProfile.city : "Location not set") +
              (currentProfile?.pincode ? ", " + currentProfile.pincode : "")
            )
          ),

          // Location info text
          currentProfile?.latitude && currentProfile?.longitude &&
          React.createElement("div", {
            className: "text-[10px] text-green-600 font-medium mt-1"
          },
            "✓ Location set || All distances are calculated from this location"
          )
        ),

        !editMode && React.createElement("button", {
          className: "mt-6 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-gray-50 transition-all shadow-sm",
          onClick: startEditing
        },
          React.createElement(FiEdit2, { size: 14 }),
          " Edit Profile"
        ),

        editMode && React.createElement("div", {
          className: "w-full flex flex-col items-center mt-6 space-y-3 animate-fade-in"
        },
          React.createElement("input", {
            type: "text",
            name: "city",
            value: editingProfile.city || "",
            onChange: handleInputChange,
            className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
            placeholder: "City"
          }),
          React.createElement("input", {
            type: "text",
            name: "place",
            value: editingProfile.place || "",
            onChange: handleInputChange,
            className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
            placeholder: "Place"
          }),
          React.createElement("input", {
            type: "text",
            name: "pincode",
            value: editingProfile.pincode || "",
            onChange: handleInputChange,
            className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
            placeholder: "Pincode"
          }),
          React.createElement("input", {
            type: "text",
            name: "landmark",
            value: editingProfile.landmark || "",
            onChange: handleInputChange,
            className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
            placeholder: "Landmark (optional)"
          }),

          React.createElement("div", {
            className: "grid grid-cols-2 gap-3 w-full"
          },
            React.createElement("input", {
              type: "text",
              name: "latitude",
              value: editingProfile.latitude || "",
              onChange: (e) => {
                // Validate input - only allow numbers, decimal point, and minus sign
                const value = e.target.value;
                if (value === "" || /^[-+]?[0-9]*\.?[0-9]*$/.test(value)) {
                  handleInputChange(e);
                }
              },
              className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
              placeholder: "Latitude"
            }),
            React.createElement("input", {
              type: "text",
              name: "longitude",
              value: editingProfile.longitude || "",
              onChange: (e) => {
                // Validate input - only allow numbers, decimal point, and minus sign
                const value = e.target.value;
                if (value === "" || /^[-+]?[0-9]*\.?[0-9]*$/.test(value)) {
                  handleInputChange(e);
                }
              },
              className: "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
              placeholder: "Longitude"
            })
          ),

          React.createElement("div", {
            className: "flex gap-3 w-full"
          },
            React.createElement("button", {
              className: "flex-1 py-2 text-indigo-600 text-xs font-bold hover:underline",
              onClick: handleGetLocation,
              disabled: locationLoading || addressLoading
            },
              (locationLoading || addressLoading) ? "Getting location..." : "Get Current Location"
            ),
            React.createElement("button", {
              className: "flex-1 py-2 text-indigo-600 text-xs font-bold hover:underline",
              onClick: () => setShowLocationPicker(true)
            }, "Pin on Map")
          ),

          React.createElement("div", {
            className: "text-xs font-medium h-4 " + (statusMsg.includes("Error") ? "text-red-600" : "text-indigo-600")
          }, statusMsg),

          React.createElement("div", {
            className: "flex gap-3 w-full pt-2"
          },
            React.createElement("button", {
              className: "flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200",
              onClick: cancelEditing
            }, "Cancel"),
            React.createElement("button", {
              className: "flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl font-bold text-sm hover:opacity-90 shadow-lg shadow-indigo-500/30",
              onClick: handleSave,
              disabled: profileSaving
            }, profileSaving ? "Saving..." : "Save Changes")
          )
        )
      ),

      // Tabs for posts
      React.createElement("section", {
        className: "mx-4 mt-6 bg-white rounded-3xl shadow-sm border border-gray-100"
      },
        React.createElement("div", {
          className: "flex border-b border-gray-100 rounded-t-3xl overflow-hidden"
        },
          ["workers", "services", "ads"].map((k) =>
            React.createElement("button", {
              key: k,
              className: "flex-1 py-3 text-sm font-bold transition-all " + (tab === k ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-gray-400 hover:text-gray-600"),
              onClick: () => setTab(k)
            },
              k.charAt(0).toUpperCase() + k.slice(1),
              React.createElement("span", {
                className: "text-xs opacity-70"
              }, " (" + currentPosts[k].length + ")")
            )
          )
        ),

        tab === "services" && React.createElement("div", {
          className: "flex p-2 gap-2 justify-center bg-gray-50/50 border-b border-gray-100"
        },
          ["all", "providing", "asking"].map((k) =>
            React.createElement("button", {
              key: k,
              onClick: () => setServicePhase(k),
              className: "px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all " + (servicePhase === k ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600")
            }, k)
          )
        ),

        // Posts list or empty state
        React.createElement("div", {
          className: "p-4 min-h-[200px]"
        },
          filteredPosts.length === 0 ? React.createElement(EmptyState, { type: tab }) :
            React.createElement("div", null, filteredPosts.map(renderPostCard))
        )
      )
    ),


    // Post Menu Modal
    menuPostId && React.createElement(PostMenu, {
      post: filteredPosts.find(p => p.id === menuPostId),
      closeMenu: () => setMenuPostId(null),
      // updatePosts is no longer needed - GlobalDataCacheContext auto-updates via onSnapshot
      updatePosts: () => { }, // No-op - changes reflect automatically from global cache
      currentTab: tab,
      setShowConfirm: setShowConfirm,
      setConfirmProps: setConfirmProps,
      setShowAbout: setShowAbout,
      navigate: navigate,
      user: user,
      profile: currentProfile,
      setActionModal: setActionModal
    }),

    // Confirmation Modal
    showConfirm && React.createElement("div", {
      className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
    },
      React.createElement("div", {
        className: "bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center m-4"
      },
        React.createElement("p", {
          className: "mb-6 font-medium text-gray-800"
        }, confirmProps.text),
        React.createElement("div", {
          className: "flex justify-center gap-3"
        },
          React.createElement("button", {
            className: "flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors",
            onClick: () => setShowConfirm(false)
          }, "No"),
          React.createElement("button", {
            className: "flex-1 bg-gradient-to-r from-indigo-600 to-pink-600 text-white px-4 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-lg shadow-indigo-500/30 transition-all",
            onClick: confirmProps.onConfirm
          }, "Yes")
        )
      )
    ),

    // About Options Modal - More Detailed
    showAbout && React.createElement("div", {
      className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
    },
      React.createElement("div", {
        className: "bg-white rounded-xl shadow-xl w-full max-w-sm animate-slide-up"
      },
        React.createElement("div", {
          className: "p-5"
        },
          React.createElement("div", {
            className: "flex items-center justify-between mb-4"
          },
            React.createElement("div", null,
              React.createElement("h2", {
                className: "font-bold text-lg text-gray-900"
              }, "About Post Options"),
              React.createElement("p", {
                className: "text-sm text-gray-500 mt-1"
              }, "Detailed guide to post management")
            ),
            React.createElement("button", {
              onClick: () => setShowAbout(false),
              className: "p-2 hover:bg-gray-100 rounded-full transition-colors"
            },
              React.createElement(FiX, { size: 18, className: "text-gray-500" })
            )
          ),

          React.createElement("div", {
            className: "space-y-4 max-h-[60vh] overflow-y-auto pr-2"
          },
            // Edit Option
            React.createElement("div", {
              className: "flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
            },
              React.createElement("div", {
                className: "flex-shrink-0"
              },
                React.createElement("div", {
                  className: "p-2 bg-white rounded-lg border border-blue-200"
                },
                  React.createElement(FiEdit, { size: 16, className: "text-blue-600" })
                )
              ),
              React.createElement("div", null,
                React.createElement("h3", {
                  className: "font-semibold text-gray-900 text-sm"
                }, "Edit"),
                React.createElement("p", {
                  className: "text-xs text-gray-600 mt-1"
                },
                  "Modify post details like title, description, location, tags, etc.",
                  React.createElement("span", {
                    className: "block mt-1 font-medium text-blue-700"
                  }, "Available only for active posts.")
                )
              )
            ),

            // Enable/Disable Options
            React.createElement("div", {
              className: "flex gap-3 p-3 bg-green-50 rounded-lg border border-green-100"
            },
              React.createElement("div", {
                className: "flex-shrink-0"
              },
                React.createElement("div", {
                  className: "p-2 bg-white rounded-lg border border-green-200"
                },
                  React.createElement(FiEye, { size: 16, className: "text-green-600" })
                )
              ),
              React.createElement("div", null,
                React.createElement("h3", {
                  className: "font-semibold text-gray-900 text-sm"
                }, "Enable / Disable"),
                React.createElement("p", {
                  className: "text-xs text-gray-600 mt-1"
                },
                  React.createElement("span", {
                    className: "font-medium text-green-700"
                  }, "Enable:"),
                  " Make a disabled post visible to others.",
                  React.createElement("span", {
                    className: "block mt-1 font-medium text-amber-700"
                  }, "Disable:"),
                  " Hide an active post from public view but keep it in your profile."
                )
              )
            ),

            // Expire Option
            React.createElement("div", {
              className: "flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100"
            },
              React.createElement("div", {
                className: "flex-shrink-0"
              },
                React.createElement("div", {
                  className: "p-2 bg-white rounded-lg border border-amber-200"
                },
                  React.createElement(FiClock, { size: 16, className: "text-amber-600" })
                )
              ),
              React.createElement("div", null,
                React.createElement("h3", {
                  className: "font-semibold text-gray-900 text-sm"
                }, "Expire"),
                React.createElement("p", {
                  className: "text-xs text-gray-600 mt-1"
                },
                  "Mark a post as completed or expired. The post will:",
                  React.createElement("ul", {
                    className: "list-disc pl-4 mt-1 space-y-1"
                  },
                    React.createElement("li", null, "Disappear from search results"),
                    React.createElement("li", null, "Remain visible in your profile"),
                    React.createElement("li", null, "Show as \"Expired\" status"),
                    React.createElement("li", null, "Can be deleted later if needed")
                  )
                )
              )
            ),

            // Delete Option
            React.createElement("div", {
              className: "flex gap-3 p-3 bg-red-50 rounded-lg border border-red-100"
            },
              React.createElement("div", {
                className: "flex-shrink-0"
              },
                React.createElement("div", {
                  className: "p-2 bg-white rounded-lg border border-red-200"
                },
                  React.createElement(FiTrash2, { size: 16, className: "text-red-600" })
                )
              ),
              React.createElement("div", null,
                React.createElement("h3", {
                  className: "font-semibold text-gray-900 text-sm"
                }, "Delete"),
                React.createElement("p", {
                  className: "text-xs text-gray-600 mt-1"
                },
                  React.createElement("span", {
                    className: "font-medium text-red-700"
                  }, "Permanent Action!"),
                  " Completely remove the post from the platform.",
                  React.createElement("span", {
                    className: "block mt-1"
                  }, "This cannot be undone. All data including images, reviews, and interactions will be lost.")
                )
              )
            ),

            // Status Guide
            React.createElement("div", {
              className: "p-3 bg-gray-50 rounded-lg border border-gray-200 mt-4"
            },
              React.createElement("h3", {
                className: "font-semibold text-gray-900 text-sm mb-2"
              }, "Post Status Guide"),
              React.createElement("div", {
                className: "space-y-2"
              },
                React.createElement("div", {
                  className: "flex items-center gap-2"
                },
                  React.createElement("div", {
                    className: "w-2 h-2 bg-green-500 rounded-full"
                  }),
                  React.createElement("span", {
                    className: "text-xs text-gray-700"
                  }, "Active: Visible to everyone")
                ),
                React.createElement("div", {
                  className: "flex items-center gap-2"
                },
                  React.createElement("div", {
                    className: "w-2 h-2 bg-gray-400 rounded-full"
                  }),
                  React.createElement("span", {
                    className: "text-xs text-gray-700"
                  }, "Disabled: Hidden from public")
                ),
                React.createElement("div", {
                  className: "flex items-center gap-2"
                },
                  React.createElement("div", {
                    className: "w-2 h-2 bg-red-500 rounded-full"
                  }),
                  React.createElement("span", {
                    className: "text-xs text-gray-700"
                  }, "Expired: Completed, only in profile")
                )
              )
            )
          ),

          React.createElement("div", {
            className: "mt-6 pt-4 border-t border-gray-200"
          },
            React.createElement("button", {
              onClick: () => setShowAbout(false),
              className: "w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 transition-all"
            }, "Got it, Thanks!")
          )
        )
      )
    ),

    // Location Picker Modal
    React.createElement(LocationPickerModal, {
      show: showLocationPicker,
      initialPosition: { lat: editingProfile.latitude, lng: editingProfile.longitude },
      apiProvider: "opencage",
      onConfirm: (location) => {
        setEditingProfile(prev => ({
          ...prev,
          latitude: location.lat,
          longitude: location.lng,
          place: location.area || prev.place,
          city: location.city || prev.city,
          pincode: location.pincode || prev.pincode
        }));
        setStatusMsg("Location updated from map!");
        setShowLocationPicker(false);
      },
      onCancel: () => setShowLocationPicker(false)
    }),

    // Image Cropper Modal
    showCropper && React.createElement(ImageCropperModal, {
      isOpen: showCropper,
      imageSrc: cropImageSrc,
      onCancel: () => setShowCropper(false),
      onCropComplete: handleCropComplete,
      isRound: true // Instagram-style round crop
    }),

    // Action Message Modal
    React.createElement(ActionMessageModal, {
      isOpen: actionModal.isOpen,
      onClose: () => setActionModal(prev => ({ ...prev, isOpen: false })),
      title: actionModal.title,
      message: actionModal.message,
      type: actionModal.type
    }),

    // Add CSS animations
    React.createElement("style", null, `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .animate-fade-in {
        animation: fadeIn 0.15s ease-out;
      }
      
      .animate-slide-up {
        animation: slideUp 0.2s ease-out;
      }
    `)
  );
}
