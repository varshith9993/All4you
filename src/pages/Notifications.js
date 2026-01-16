import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    limit,
    getDoc,
    doc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
    FiBell,
    FiStar,
    FiInfo,
    FiArrowLeft,
    FiBox,
    FiMessageSquare,
    FiCheckCircle,
    FiAlertTriangle,
    FiMessageCircle
} from "react-icons/fi";

const MAX_NOTIFICATIONS = 30;

/* ---------------- ICON ---------------- */

const getIcon = (notif) => {
    const type = notif.type;
    const status = notif.status;
    const msg = notif.message?.toLowerCase() || "";

    // 1. Priority Check: Message Content (Most reliable)
    if (msg.includes("deleted")) {
        return <FiInfo className="text-red-500" size={20} />;
    }
    // Grey for Disabled (Check BEFORE positive because it contains "enabled back")
    if (msg.includes("disabled")) {
        return <FiInfo className="text-gray-500" size={20} />;
    }
    if (msg.includes("expired")) {
        return <FiInfo className="text-purple-500" size={20} />;
    }
    if (msg.includes("back online") || msg.includes("enabled") || msg.includes("active")) {
        return <FiCheckCircle className="text-green-500" size={20} />;
    }

    // 2. Fallback to Status/Type fields
    if (type === "rating" || msg.includes("rating")) {
        return <FiStar className="text-yellow-500" size={20} />;
    }

    // Check for 'reply' BEFORE 'review' because reply messages often contain the word 'review'
    if (type === "reply" || msg.includes("replied") || notif.title === "Review Reply") {
        return <FiMessageCircle className="text-blue-500" size={20} />;
    }

    if (type === "review" || msg.includes("review")) {
        return <FiMessageSquare className="text-blue-500" size={20} />;
    }

    switch (type) {
        case "post_status":
            if (status === "deleted") return <FiInfo className="text-red-500" size={20} />;
            if (status === "expired") return <FiInfo className="text-purple-500" size={20} />;
            if (status === "disabled") return <FiInfo className="text-gray-500" size={20} />;
            if (status === "active") return <FiCheckCircle className="text-green-500" size={20} />;
            return <FiAlertTriangle className="text-orange-500" size={20} />;
        case "alert": return <FiInfo className="text-red-500" size={20} />;
        case "alert_good": return <FiCheckCircle className="text-green-500" size={20} />;
        case "system": return <FiInfo className="text-purple-500" size={20} />;
        case "reply": return <FiMessageCircle className="text-blue-500" size={20} />;
        case "review": return <FiMessageSquare className="text-blue-500" size={20} />;
        case "rating": return <FiStar className="text-yellow-500" size={20} />;
        default:
            if (type?.includes('star') || type?.includes('rate')) return <FiStar className="text-yellow-500" size={20} />;
            if (type?.includes('msg') || type?.includes('review')) return <FiMessageSquare className="text-blue-500" size={20} />;
            return <FiBell className="text-gray-500" size={20} />;
    }
};

// Robust Date Parsing Helper
const parseDate = (val) => {
    if (!val) return new Date(0); // For unread logic, missing date = very old
    if (val.toDate && typeof val.toDate === "function") return val.toDate();
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

/* ---------------- ITEM ---------------- */

const NotificationItem = ({ notif }) => {
    const [expanded, setExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const messageRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (messageRef.current) {
            const { scrollHeight, clientHeight } = messageRef.current;
            setIsTruncated(scrollHeight > clientHeight);
        }
    }, [notif.message]);

    const handleClick = async () => {
        const isActionable = notif.type === "rating" || notif.type === "review" || notif.type === "reply" || (notif.type === "post_status" && (notif.status === "active" || !notif.status));

        if (isActionable) {
            if (notif.postId && notif.postType) {
                const collectionName = {
                    worker: "workers",
                    service: "services",
                    ad: "ads"
                }[notif.postType];

                if (!collectionName) return;

                try {
                    const postSnap = await getDoc(doc(db, collectionName, notif.postId));
                    if (postSnap.exists()) {
                        const postStatus = postSnap.data().status;
                        const isForbidden = postStatus === "disabled" || postStatus === "expired" || postStatus === "deleted";

                        if (!isForbidden) {
                            const route = {
                                worker: "/worker-detail/",
                                service: "/service-detail/",
                                ad: "/ad-detail/"
                            }[notif.postType];

                            if (route) {
                                navigate(route + notif.postId);
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error checking post status:", error);
                }
            }
            alert("the post is unavailable");
        } else if (notif.type === "post_status") {
            // Negative status (deleted, disabled, expired)
            alert("the post is unavailable");
        } else if (notif.type === "system" && notif.actionUrl) {
            window.open(notif.actionUrl, '_blank');
        }
    };

    return (
        <div
            className={`p-4 rounded-xl bg-white border border-gray-100 shadow-sm flex gap-4 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${notif.type === 'post_status' ? 'bg-orange-50 border-orange-100' : ''}`}
            onClick={handleClick}
        >
            <div className="flex-shrink-0 mt-1 relative">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                    {getIcon(notif)}
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 min-w-0 pr-2">
                        <span className="truncate">{notif.title}</span>
                        {notif.isNew && (
                            <div className="relative flex-shrink-0">
                                <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25"></span>
                                <span className="relative block w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm ring-1 ring-blue-500/20"></span>
                            </div>
                        )}
                    </h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {notif.date.toDateString() === new Date().toDateString()
                            ? notif.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : notif.date.toLocaleDateString()}
                    </span>
                </div>

                <div
                    ref={messageRef}
                    className={`text-sm text-gray-600 ${expanded ? "" : "line-clamp-2"}`}
                >
                    {notif.message}
                </div>

                {isTruncated && !expanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(true);
                        }}
                        className="text-xs text-blue-600 font-medium mt-1 hover:underline flex items-center gap-1"
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
    const [notifications, setNotifications] = useState(() => {
        try {
            const cached = localStorage.getItem('cached_notifications');
            if (cached) {
                const data = JSON.parse(cached);
                // Rehydrate Date objects
                return data.map(n => ({
                    ...n,
                    date: new Date(n.timestamp || n.date)
                }));
            }
            return [];
        } catch { return []; }
    });
    const [loading, setLoading] = useState(notifications.length === 0);

    const user = auth.currentUser;
    const navigate = useNavigate();

    const notificationsMap = useRef(new Map());
    const postUnsubsMap = useRef(new Map()); // Manage inner listeners to prevent leaks
    const viewTimeRef = useRef(0);
    const userCache = useRef(new Map());

    // Hydrate local map from state on mount (or when state is first set from cache)
    useEffect(() => {
        if (notifications.length > 0 && notificationsMap.current.size === 0) {
            notifications.forEach(n => notificationsMap.current.set(n.id, n));
        }
    }, [notifications]);

    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }

        /* ---------------- READ STATUS LOGIC ---------------- */

        // 1. Get the reference time for "New" notifications for this visit session
        // Using sessionStorage so the dots persist while navigating into details and back
        let sessionRef = sessionStorage.getItem('notif_view_ref');

        if (!sessionRef) {
            // First time in this session: Copy the last persistent read time
            const lastRead = localStorage.getItem('lastNotificationView') || "0";
            sessionStorage.setItem('notif_view_ref', lastRead);
            sessionRef = lastRead;
        }

        viewTimeRef.current = Number(sessionRef);

        const getUserName = async (uid) => {
            if (!uid) return "Unknown User";
            if (userCache.current.has(uid)) return userCache.current.get(uid);

            try {
                const snap = await getDoc(doc(db, "profiles", uid));
                const name = snap.exists() ? snap.data().username || "Unknown User" : "Unknown User";
                userCache.current.set(uid, name);
                return name;
            } catch (e) {
                return "Unknown User";
            }
        };

        const updateUI = () => {
            const list = Array.from(notificationsMap.current.values())
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_NOTIFICATIONS);

            // CACHE: Save to localStorage
            localStorage.setItem('cached_notifications', JSON.stringify(list));

            setNotifications(list);
            setLoading(false);
        };

        /* ---------------- FAVORITED POST STATUS CHANGES ---------------- */

        // Track user's favorited posts
        const userFavoritesRef = [
            { col: collection(db, "workerFavorites"), idField: "workerId", type: "worker", targetCol: "workers" },
            { col: collection(db, "serviceFavorites"), idField: "serviceId", type: "service", targetCol: "services" },
            { col: collection(db, "adFavorites"), idField: "adId", type: "ad", targetCol: "ads" }
        ];

        const unsubFavorites = userFavoritesRef.map(favConfig =>
            onSnapshot(
                query(favConfig.col, where("userId", "==", user.uid)),
                (favSnapshot) => {
                    const postIds = favSnapshot.docs
                        .map(d => d.data()[favConfig.idField])
                        .filter(id => id)
                        .slice(0, 10); // Capture latest 10 favorites per category

                    // Clean up previous post listener for this type to prevent leaks
                    if (postUnsubsMap.current.has(favConfig.type)) {
                        postUnsubsMap.current.get(favConfig.type)();
                    }

                    if (postIds.length === 0) return;

                    // Listen for status changes on favorited posts
                    const postQuery = query(
                        collection(db, favConfig.targetCol),
                        where("__name__", "in", postIds)
                    );

                    const unsubPosts = onSnapshot(postQuery, async (postSnapshot) => {
                        const changes = postSnapshot.docChanges();

                        // Parallelize processing of all changes
                        await Promise.all(changes.map(async (change) => {
                            const postData = change.doc.data();
                            const postId = change.doc.id;
                            const titleWords = postData.name || postData.title || "";
                            const ownerId = postData.createdBy;

                            let msg = "";
                            const postTypeRaw = favConfig.type;
                            const displayType = postTypeRaw === 'ad' ? 'ads' : postTypeRaw;

                            if (change.type === 'removed') {
                                msg = `a ${displayType} post is deleted by the post owner and the post is vanished from favorites`;
                            } else if (change.type === 'modified') {
                                const ownerName = ownerId ? await getUserName(ownerId) : "Owner";
                                const statusMessages = {
                                    'disabled': `${ownerName} disabled "${titleWords}" post and the ${displayType} post is vanished from favorites, it will be seen back when it is enabled back`,
                                    'active': `${ownerName} enabled "${titleWords}" post and now the ${displayType} post is available in favorites`,
                                    'expired': `${ownerName} expired "${titleWords}" post and the ${displayType} post is removed from favorites`,
                                    'deleted': `a ${displayType} post is deleted by the post owner and the post is vanished from favorites`
                                };
                                msg = statusMessages[postData.status];
                            }

                            if (msg) {
                                const date = new Date();
                                const status = postData?.status || (change.type === 'removed' ? 'deleted' : 'unknown');
                                notificationsMap.current.set(`status_${postId}_${status}`, {
                                    id: `status_${postId}_${status}`,
                                    type: "post_status",
                                    title: "Post Status Changed",
                                    message: msg,
                                    date,
                                    timestamp: date.getTime(),
                                    status,
                                    postId,
                                    postType: postTypeRaw
                                });
                            }
                        }));
                        updateUI();
                    });

                    postUnsubsMap.current.set(favConfig.type, unsubPosts);
                }
            )
        );

        /* ---------------- REPLIES TO USER REVIEWS ---------------- */
        const reviewCollections = [
            { name: "workerReviews", type: "worker", idField: "workerId" },
            { name: "serviceReviews", type: "service", idField: "serviceId" },
            { name: "adReviews", type: "ad", idField: "adId" }
        ];

        const unsubReplies = reviewCollections.map(col =>
            onSnapshot(
                query(collection(db, col.name), where("userId", "==", user.uid)),
                async (snapshot) => {
                    const changes = snapshot.docChanges();
                    await Promise.all(changes.map(async (change) => {
                        if (change.type === 'modified') {
                            const data = change.doc.data();
                            if (data.reply) {
                                const postId = data[col.idField];
                                let ownerName = "Post Owner";

                                try {
                                    const postSnap = await getDoc(doc(db, col.name.replace("Reviews", "s"), postId));
                                    if (postSnap.exists()) {
                                        const creatorId = postSnap.data().createdBy;
                                        ownerName = await getUserName(creatorId);
                                    }
                                } catch (e) {
                                    console.error(e);
                                }

                                const date = new Date();
                                notificationsMap.current.set(`reply_${change.doc.id}`, {
                                    id: `reply_${change.doc.id}`,
                                    type: "reply",
                                    title: "Review Reply",
                                    message: `${ownerName} replied to your review`,
                                    subText: `"${data.reply.slice(0, 50)}${data.reply.length > 50 ? "..." : ""}"`,
                                    date,
                                    timestamp: date.getTime(),
                                    postId,
                                    postType: col.type
                                });
                            }
                        }
                    }));
                    updateUI();
                }
            )
        );


        /* ---------------- APP UPDATES ---------------- */

        const unsubSystem = onSnapshot(
            query(
                collection(db, "notifications"),
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(MAX_NOTIFICATIONS)
            ),
            async (snap) => {
                // Parallelize system notification processing
                await Promise.all(snap.docs.map(async (d) => {
                    const data = d.data();
                    if (data.type === 'chat' || data.message?.toLowerCase().includes('message')) return;

                    let message = data.message || "";
                    const type = data.type || "system";
                    const status = data.status;
                    const msgLower = message.toLowerCase();
                    const date = parseDate(data.createdAt);

                    const isLegacyStatus = msgLower.includes("favorited") ||
                        msgLower.includes("back online") ||
                        msgLower.includes("disabled") ||
                        msgLower.includes("expired");

                    let extractedPostType = data.postType ||
                        (data.link?.includes("worker-detail") ? "worker" :
                            data.link?.includes("service-detail") ? "service" :
                                data.link?.includes("ad-detail") ? "ad" :
                                    (msgLower.includes("worker") ? "worker" :
                                        msgLower.includes("service") ? "service" :
                                            msgLower.includes("ad") ? "ad" : null));
                    let extractedPostId = data.postId || (data.link ? data.link.split('/').pop() : null);
                    let extractedStatus = null;

                    if (type === "post_status" || type === "rating" || type === "review" || type === "reply" || status || isLegacyStatus) {
                        try {
                            const currentStatus = status || (msgLower.includes("disabled") ? "disabled" : msgLower.includes("online") || msgLower.includes("enabled") ? "active" : msgLower.includes("expired") ? "expired" : msgLower.includes("deleted") ? "deleted" : null);

                            if (currentStatus && extractedPostId && extractedPostType) {
                                extractedStatus = currentStatus;
                                const displayType = extractedPostType === 'ad' ? 'ads' : extractedPostType;

                                if (currentStatus === 'deleted') {
                                    message = `a ${displayType} post is deleted by the post owner and the post is vanished from favorites`;
                                } else {
                                    const colName = { worker: "workers", service: "services", ad: "ads" }[extractedPostType];
                                    if (colName) {
                                        const postSnap = await getDoc(doc(db, colName, extractedPostId));
                                        if (postSnap.exists()) {
                                            const p = postSnap.data();
                                            const ownerId = p.createdBy;
                                            const ownerName = ownerId ? await getUserName(ownerId) : "Owner";
                                            const titleWords = p.name || p.title || "";

                                            if (currentStatus === 'active') {
                                                message = `${ownerName} enabled "${titleWords}" post and now the ${displayType} post is available in favorites`;
                                            } else if (currentStatus === 'disabled') {
                                                message = `${ownerName} disabled "${titleWords}" post and the ${displayType} post is vanished from favorites, it will be seen back when it is enabled back`;
                                            } else if (currentStatus === 'expired') {
                                                message = `${ownerName} expired "${titleWords}" post and the ${displayType} post is removed from favorites`;
                                            }
                                        }
                                    }
                                }
                            }
                            else if (type === "rating" || type === "review") {
                                const senderId = data.senderId || data.fromUserId;
                                if (senderId) {
                                    const name = await getUserName(senderId);
                                    const rating = data.rating;
                                    const hasText = data.hasText || data.text || msgLower.includes("review");

                                    if (rating) {
                                        notificationsMap.current.set(`sys_rate_${d.id}`, {
                                            id: `sys_rate_${d.id}`,
                                            type: "rating",
                                            title: "New Rating",
                                            message: `New ${rating}-star rating received from ${name}`,
                                            date,
                                            timestamp: date.getTime(),
                                            postId: extractedPostId || null,
                                            postType: extractedPostType || null
                                        });
                                    }

                                    if (hasText) {
                                        const reviewText = data.text || "";
                                        notificationsMap.current.set(`sys_rev_${d.id}`, {
                                            id: `sys_rev_${d.id}`,
                                            type: "review",
                                            title: "New Review",
                                            message: `New review received from ${name}`,
                                            subText: reviewText ? `"${reviewText.slice(0, 50)}${reviewText.length > 50 ? "..." : ""}"` : null,
                                            date,
                                            timestamp: date.getTime(),
                                            postId: extractedPostId || null,
                                            postType: extractedPostType || null
                                        });
                                    }
                                    return;
                                }
                            }
                            else if (type === "reply") {
                                const senderId = data.senderId || data.fromUserId;
                                if (senderId) {
                                    const name = await getUserName(senderId);
                                    message = `${name} replied to your review`;
                                }
                            }
                        } catch (e) {
                            console.error("Error re-formatting system notification:", e);
                        }
                    }

                    notificationsMap.current.set(`sys_${d.id}`, {
                        id: `sys_${d.id}`,
                        type,
                        title: type === "reply" ? "Review Reply" : (data.title || "App Update"),
                        message,
                        date,
                        timestamp: date.getTime(),
                        actionUrl: data.actionUrl || null,
                        postId: extractedPostId || null,
                        postType: extractedPostType || null,
                        status: extractedStatus || status || null
                    });
                }));
                updateUI();
            }
        );

        /* ---------------- CLEANUP ---------------- */
        const currentPostUnsubs = postUnsubsMap.current;

        return () => {
            unsubFavorites.forEach(unsub => unsub());
            unsubReplies.forEach(unsub => unsub());
            currentPostUnsubs.forEach(unsub => unsub());
            unsubSystem();
        };
    }, [user, navigate]);

    /* ---------------- UI ---------------- */

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
                <button
                    onClick={() => {
                        // EXPLICIT EXIT: User finished reading. Update persistent read time.
                        localStorage.setItem('lastNotificationView', Date.now().toString());
                        sessionStorage.removeItem('notif_view_ref');
                        navigate(-1);
                    }}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"
                >
                    <FiArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            </div>

            <div className="p-4 space-y-3 flex-1">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FiBell size={32} />
                        </div>
                        <p className="font-medium text-gray-600">No notifications yet</p>
                        <p className="text-sm mt-1">We'll let you know when something arrives.</p>

                        <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border shadow-sm w-full">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600">
                                    <FiBox size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Welcome to ServePure!</h3>
                                    <p className="text-sm text-gray-600">
                                        Post updates, ratings, and app announcements will appear here.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    notifications.map(n => (
                        <NotificationItem
                            key={n.id}
                            notif={{
                                ...n,
                                isNew: Number(n.timestamp || 0) > Number(viewTimeRef.current)
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
}