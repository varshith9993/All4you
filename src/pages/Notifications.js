import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { getDocs, doc, collection, query, where, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useNotificationsCache } from "../contexts/GlobalDataCacheContext";
import {
    FiBell,
    FiStar,
    FiInfo,
    FiArrowLeft,
    FiMessageSquare,
    FiCheckCircle,
    FiMessageCircle,
    FiClock
} from "react-icons/fi";
import ActionMessageModal from "../components/ActionMessageModal";

/* ---------------- ICON ---------------- */

const getIcon = (notif) => {
    const type = notif.type;
    const msg = notif.message?.toLowerCase() || "";

    if (msg.includes("deleted")) return <FiInfo className="text-red-500" size={20} />;
    if (msg.includes("disabled")) return <FiInfo className="text-gray-500" size={20} />;
    if (msg.includes("expired")) return <FiInfo className="text-purple-500" size={20} />;
    if (msg.includes("back online") || msg.includes("enabled") || msg.includes("active")) return <FiCheckCircle className="text-green-500" size={20} />;

    if (type === "rating" || type === "rate" || notif.rating || msg.includes("rating")) return <FiStar className="text-yellow-500" size={20} />;
    if (type === "reply" || notif.title === "Review Reply" || msg.includes("replied")) return <FiMessageCircle className="text-blue-500" size={20} />;
    if (type === "review" || msg.includes("review")) return <FiMessageSquare className="text-blue-500" size={20} />;

    if (type === "alert") return <FiInfo className="text-red-500" size={20} />;
    if (type === "alert_good") return <FiCheckCircle className="text-green-500" size={20} />;
    if (type === "system") return <FiInfo className="text-purple-500" size={20} />;

    if (notif.status === 'expiring_5min') return <FiClock className="text-red-600" size={20} />;
    if (notif.status === 'expiring_1hr') return <FiClock className="text-blue-600" size={20} />;

    return <FiBell className="text-gray-500" size={20} />;
};

/* ---------------- ITEM ---------------- */

const NotificationItem = ({ notif, viewTime, setActionModal }) => {
    const [expanded, setExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [formattedMessage, setFormattedMessage] = useState(notif.message);
    const [formattedTitle, setFormattedTitle] = useState(notif.title);
    const messageRef = useRef(null);
    const navigate = useNavigate();


    const { setPostDetailCache } = useNotificationsCache();
    const isNew = notif.timestamp > viewTime;

    // Data is pre-formatted in GlobalDataCacheContext for better performance and reliability
    useEffect(() => {
        setFormattedMessage(notif.message);
        setFormattedTitle(notif.title);
    }, [notif.message, notif.title]);

    useEffect(() => {
        if (messageRef.current) {
            const { scrollHeight, clientHeight } = messageRef.current;
            setIsTruncated(scrollHeight > clientHeight);
        }
    }, [formattedMessage]);

    const handleClick = async () => {
        // Special Actionable Types
        const isStandardActionable = ["rating", "review", "reply"].includes(notif.type);
        const isExpiryActionable = notif.type === "post_status" && (notif.status === 'expiring_5min' || notif.status === 'expiring_1hr');

        if (!isStandardActionable && !isExpiryActionable) {
            if (notif.type === "system" && notif.actionUrl) window.open(notif.actionUrl, '_blank');
            return;
        }

        // Feature: Specific expiring notifications go to Favorites page
        if (isExpiryActionable) {
            navigate('/favorites');
            return;
        }

        if (notif.postId && notif.postType) {
            try {
                // REQUIREMENT: Always check fresh status to prevent navigating to disabled/expired posts
                let postData = null;
                const colName = { worker: "workers", service: "services", ad: "ads" }[notif.postType];

                if (colName) {
                    const snap = await getDoc(doc(db, colName, notif.postId));
                    if (snap.exists()) {
                        postData = snap.data();
                        // Update cache with fresh data for other parts of the app
                        setPostDetailCache(notif.postType, notif.postId, postData);
                    }
                }

                if (postData) {
                    // Only allow navigation if the post is strictly active
                    const status = postData.status || 'active';
                    if (status === 'active') {
                        const route = { worker: "/worker-detail/", service: "/service-detail/", ad: "/ad-detail/" }[notif.postType];
                        if (route) {
                            navigate(route + notif.postId);
                            return;
                        }
                    }
                }

                // If code reaches here, post is unavailable (deleted, disabled, or expired)
                setActionModal({
                    isOpen: true,
                    title: "Post Unavailable",
                    message: "This post is unavailable as it has been disabled, expired, or deleted by the owner.",
                    type: "error"
                });
            } catch (e) {
                console.error("Error checking post availability:", e);
            }
        }
    };

    const isNavigable =
        ["rating", "review", "reply"].includes(notif.type) ||
        (notif.type === "post_status" && (notif.status === 'expiring_5min' || notif.status === 'expiring_1hr'));

    return (
        <div
            className={`p-4 rounded-xl bg-white border border-gray-100 shadow-sm flex gap-4 relative overflow-hidden transition-shadow ${isNavigable ? "cursor-pointer hover:shadow-md" : ""} ${notif.type === 'post_status' ? 'bg-orange-50 border-orange-100' : ''}`}
            onClick={handleClick}
        >
            <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                    {getIcon(notif)}
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 min-w-0 pr-2">
                        <span className="truncate">{formattedTitle}</span>
                        {isNew && (
                            <div className="relative flex-shrink-0">
                                <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25"></span>
                                <span className="relative block w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm ring-1 ring-blue-500/20"></span>
                            </div>
                        )}
                    </h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(notif.timestamp).toDateString() === new Date().toDateString()
                            ? new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : new Date(notif.timestamp).toLocaleDateString()}
                    </span>
                </div>

                <div
                    ref={messageRef}
                    className={`text-sm text-gray-600 ${expanded ? "" : "line-clamp-2"}`}
                >
                    {formattedMessage}
                </div>

                {isTruncated && !expanded && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                        className="text-xs text-blue-600 font-medium mt-1 hover:underline"
                    >
                        Show more
                    </button>
                )}

                {notif.subText && (
                    <p className="text-xs text-gray-400 mt-1 italic truncate">
                        {notif.subText}
                    </p>
                )}
            </div>
        </div>
    );
};

/* ---------------- MAIN ---------------- */

export default function Notifications() {
    const { notifications, loading, lastNotificationView, markNotificationsViewed, getPostDetailCache, setPostDetailCache } = useNotificationsCache();
    const navigate = useNavigate();

    const [actionModal, setActionModal] = useState({ isOpen: false, title: "", message: "", type: "success" });

    // Capture exactly what the persistent view time was when the user entered this session.
    // Use sessionStorage to keep it stable until the tab is closed, ensuring "New" items stay "New".
    const [viewTime] = useState(() => {
        const stored = sessionStorage.getItem('notif_view_ref');
        if (stored) return Number(stored);

        // Fetch directly from localStorage to ensure we get the truth from the PREVIOUS session
        // before markNotificationsViewed() updates the context state.
        const persistent = localStorage.getItem('lastNotificationView') || lastNotificationView || "0";
        sessionStorage.setItem('notif_view_ref', String(persistent));
        return Number(persistent);
    });

    useEffect(() => {
        // Clear unread badge globally but keep local blue dots for this session
        markNotificationsViewed();
        // Always open to the top
        window.scrollTo(0, 0);
    }, [markNotificationsViewed]);

    // OPTIMIZATION: BATCH FETCH post details for all relevant notifications at once
    useEffect(() => {
        if (notifications.length === 0 || loading) return;

        const missingByCol = { workers: new Set(), services: new Set(), ads: new Set() };

        notifications.forEach(n => {
            if (n.postId && n.postType) {
                const cached = getPostDetailCache(n.postType, n.postId);
                if (!cached) {
                    const col = { worker: 'workers', service: 'services', ad: 'ads' }[n.postType];
                    if (col) missingByCol[col].add(n.postId);
                }
            }
        });

        const fetchBatch = async (col, idsSet) => {
            const ids = Array.from(idsSet);
            if (ids.length === 0) return;

            // Chunk of 30
            for (let i = 0; i < ids.length; i += 30) {
                const chunk = ids.slice(i, i + 30);
                try {
                    const q = query(collection(db, col), where("__name__", "in", chunk));
                    const snap = await getDocs(q);

                    snap.docs.forEach(d => {
                        const type = col === 'workers' ? 'worker' : col === 'services' ? 'service' : 'ad';
                        setPostDetailCache(type, d.id, d.data());
                    });
                } catch (e) {
                }
            }
        };

        const execute = async () => {
            await Promise.all([
                fetchBatch('workers', missingByCol.workers),
                fetchBatch('services', missingByCol.services),
                fetchBatch('ads', missingByCol.ads)
            ]);
        };

        execute();
    }, [notifications, loading, getPostDetailCache, setPostDetailCache]);

    // Mark notifications viewed when leaving or entering
    const handleBack = () => {
        // When leaving, we can clear the session ref so next visit is fresh
        sessionStorage.removeItem('notif_view_ref');
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
            <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center gap-3">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <FiArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto pb-24">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <FiBell size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-gray-600">No notifications yet</p>
                        <p className="text-sm">We'll let you know when something arrives.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <NotificationItem
                            key={n.id}
                            notif={n}
                            viewTime={viewTime}
                            setActionModal={setActionModal}
                        />
                    ))
                )}
            </div>

            <ActionMessageModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                title={actionModal.title}
                message={actionModal.message}
                type={actionModal.type}
            />
        </div>
    );
}
