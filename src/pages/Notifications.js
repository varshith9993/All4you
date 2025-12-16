import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    limit,
    getDoc,
    doc
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
    FiBell,
    FiStar,
    FiInfo,
    FiArrowLeft,
    FiBox,
    FiMessageSquare,
    FiCheckCircle,
    FiAlertTriangle
} from "react-icons/fi";

const MAX_NOTIFICATIONS = 30;

/* ---------------- ICON ---------------- */

const getIcon = (type) => {
    switch (type) {
        case "chat": return <FiMessageSquare className="text-blue-500" size={20} />;
        case "review": return <FiStar className="text-yellow-500" size={20} />;
        case "rating": return <FiStar className="text-yellow-500" size={20} />;
        case "alert": return <FiInfo className="text-red-500" size={20} />;
        case "alert_good": return <FiCheckCircle className="text-green-500" size={20} />;
        case "system": return <FiInfo className="text-purple-500" size={20} />;
        case "post_status": return <FiAlertTriangle className="text-orange-500" size={20} />;
        default: return <FiBell className="text-gray-500" size={20} />;
    }
};

/* ---------------- ITEM ---------------- */

const NotificationItem = ({ notif }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = notif.message?.length > 80;
    const navigate = useNavigate();

    const handleClick = () => {
        // Handle navigation based on notification type
        if (notif.type === "rating" || notif.type === "review") {
            // Navigate to the post if it's a rating/review notification
            if (notif.postId && notif.postType) {
                const route = {
                    worker: "/worker-detail/",
                    service: "/service-detail/",
                    ad: "/ad-detail/"
                }[notif.postType];
                
                if (route) {
                    navigate(route + notif.postId);
                }
            }
        } else if (notif.type === "post_status") {
            // For status changes, show error if post is unavailable
            if (notif.status === "deleted" || notif.status === "disabled" || notif.status === "expired") {
                alert("Post unavailable");
            }
        } else if (notif.type === "system" && notif.actionUrl) {
            // For system notifications with action URLs
            window.open(notif.actionUrl, '_blank');
        }
    };

    return (
        <div 
            className={`p-4 rounded-xl bg-white border border-gray-100 shadow-sm flex gap-4 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${notif.type === 'post_status' ? 'bg-orange-50 border-orange-100' : ''}`}
            onClick={handleClick}
        >
            <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                    {getIcon(notif.type)}
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm truncate pr-2">
                        {notif.title}
                    </h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {notif.date.toDateString() === new Date().toDateString()
                            ? notif.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : notif.date.toLocaleDateString()}
                    </span>
                </div>

                <div className={`text-sm text-gray-600 ${expanded ? "" : "line-clamp-2"}`}>
                    {notif.message}
                </div>

                {isLong && !expanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(true);
                        }}
                        className="text-xs text-blue-600 font-medium mt-1 hover:underline"
                    >
                        ...more
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
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const auth = getAuth();
    const user = auth.currentUser;
    const navigate = useNavigate();

    const notificationsMap = useRef(new Map());

    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }

        const userCache = new Map();

        const getUserName = async (uid) => {
            if (!uid) return "Unknown User";
            if (userCache.has(uid)) return userCache.get(uid);

            const snap = await getDoc(doc(db, "profiles", uid));
            const name = snap.exists() ? snap.data().username || "Unknown User" : "Unknown User";
            userCache.set(uid, name);
            return name;
        };

        const updateUI = () => {
            const list = Array.from(notificationsMap.current.values())
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_NOTIFICATIONS);
            setNotifications(list);
            setLoading(false);
        };

        /* ---------------- FAVORITED POST STATUS CHANGES ---------------- */

        // Track user's favorited posts
        const userFavoritesRef = [
            collection(db, "workerFavorites"),
            collection(db, "serviceFavorites"),
            collection(db, "adFavorites")
        ];

        const unsubFavorites = userFavoritesRef.map(favCollection => 
            onSnapshot(
                query(favCollection, where("userId", "==", user.uid)),
                async (favSnapshot) => {
                    const favoritePostIds = favSnapshot.docs.map(doc => doc.data());
                    
                    // For each type of post, listen for changes
                    const postCollections = [
                        { name: "workers", idField: "workerId", type: "worker" },
                        { name: "services", idField: "serviceId", type: "service" },
                        { name: "ads", idField: "adId", type: "ad" }
                    ];
                    
                    for (const postCollection of postCollections) {
                        const postIds = favoritePostIds
                            .filter(fav => fav[postCollection.idField])
                            .map(fav => fav[postCollection.idField]);
                        
                        if (postIds.length > 0) {
                            // Listen for changes to favorited posts
                            const postQuery = query(
                                collection(db, postCollection.name),
                                where("__name__", "in", postIds)
                            );
                            
                            onSnapshot(postQuery, (postSnapshot) => {
                                postSnapshot.docChanges().forEach(change => {
                                    const postData = change.doc.data();
                                    const postId = change.doc.id;
                                    const oldData = change.type === 'modified' ? change.doc.data() : null;
                                    
                                    // Check for status changes
                                    if (change.type === 'modified') {
                                        const oldStatus = oldData?.status || 'active';
                                        const newStatus = postData?.status || 'active';
                                        
                                        // Notify on status change
                                        if (oldStatus !== newStatus) {
                                            const statusMessages = {
                                                'disabled': `A favorited ${postCollection.type} has been disabled`,
                                                'active': `A favorited ${postCollection.type} has been enabled`,
                                                'expired': `A favorited ${postCollection.type} has expired`,
                                                'deleted': `A favorited ${postCollection.type} has been deleted`
                                            };
                                            
                                            const date = new Date();
                                            notificationsMap.current.set(`status_${postId}_${newStatus}`, {
                                                id: `status_${postId}_${newStatus}`,
                                                type: "post_status",
                                                title: "Post Status Changed",
                                                message: statusMessages[newStatus] || `A favorited ${postCollection.type} status changed to ${newStatus}`,
                                                date,
                                                timestamp: date.getTime(),
                                                status: newStatus,
                                                postId: postId,
                                                postType: postCollection.type
                                            });
                                        }
                                    } else if (change.type === 'removed') {
                                        // Notify when post is deleted
                                        const date = new Date();
                                        notificationsMap.current.set(`status_${postId}_deleted`, {
                                            id: `status_${postId}_deleted`,
                                            type: "post_status",
                                            title: "Post Deleted",
                                            message: `A favorited ${postCollection.type} has been deleted`,
                                            date,
                                            timestamp: date.getTime(),
                                            status: "deleted",
                                            postId: postId,
                                            postType: postCollection.type
                                        });
                                    }
                                });
                                updateUI();
                            });
                        }
                    }
                }
            )
        );

        /* ---------------- USER FEEDBACK NOTIFICATIONS ---------------- */

        // Listen for ratings and reviews on user's posts
        const loadUserFeedback = async () => {
            // Get user's posts
            const postCollections = ['workers', 'services', 'ads'];
            const userPosts = {};
            
            for (const collectionName of postCollections) {
                const snapshot = await getDocs(
                    query(collection(db, collectionName), where("createdBy", "==", user.uid))
                );
                userPosts[collectionName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            
            // Listen for reviews on workers
            const workerIds = userPosts.workers.map(w => w.id);
            let unsubWorkerReviews;
            if (workerIds.length > 0) {
                unsubWorkerReviews = onSnapshot(
                    query(
                        collection(db, "workerReviews"),
                        where("workerId", "in", workerIds.slice(0, 10)),
                        orderBy("createdAt", "desc"),
                        limit(MAX_NOTIFICATIONS)
                    ),
                    async (snap) => {
                        for (const d of snap.docs) {
                            const r = d.data();
                            if (r.userId === user.uid) continue;

                            const name = await getUserName(r.userId);
                            const date = r.createdAt?.toDate() || new Date();
                            

                            let message = "";
                            if (r.rating && r.text) {
                                message = `New ${r.rating}-star rating and review from ${name}`;
                            } else if (r.rating) {
                                message = `New ${r.rating}-star rating from ${name}`;
                            } else if (r.text) {
                                message = `New review from ${name}`;
                            } else {
                                continue;
                            }

                            notificationsMap.current.set(`rating_${d.id}`, {
                                id: `rating_${d.id}`,
                                type: "rating",
                                title: "New Rating/Review",
                                message,
                                subText: r.text
                                    ? `"${r.text.slice(0, 50)}${r.text.length > 50 ? "..." : ""}"`
                                    : "",
                                date,
                                timestamp: date.getTime(),
                                postId: r.workerId,
                                postType: "worker"
                            });
                        }
                        updateUI();
                    }
                );
            }
            
            // Listen for reviews on services
            const serviceIds = userPosts.services.map(s => s.id);
            let unsubServiceReviews;
            if (serviceIds.length > 0) {
                unsubServiceReviews = onSnapshot(
                    query(
                        collection(db, "serviceReviews"),
                        where("serviceId", "in", serviceIds.slice(0, 10)),
                        orderBy("createdAt", "desc"),
                        limit(MAX_NOTIFICATIONS)
                    ),
                    async (snap) => {
                        for (const d of snap.docs) {
                            const r = d.data();
                            if (r.userId === user.uid) continue;

                            const name = await getUserName(r.userId);
                            const date = r.createdAt?.toDate() || new Date();
                            

                            let message = "";
                            if (r.rating && r.text) {
                                message = `New ${r.rating}-star rating and review from ${name}`;
                            } else if (r.rating) {
                                message = `New ${r.rating}-star rating from ${name}`;
                            } else if (r.text) {
                                message = `New review from ${name}`;
                            } else {
                                continue;
                            }

                            notificationsMap.current.set(`rating_${d.id}`, {
                                id: `rating_${d.id}`,
                                type: "rating",
                                title: "New Rating/Review",
                                message,
                                subText: r.text
                                    ? `"${r.text.slice(0, 50)}${r.text.length > 50 ? "..." : ""}"`
                                    : "",
                                date,
                                timestamp: date.getTime(),
                                postId: r.serviceId,
                                postType: "service"
                            });
                        }
                        updateUI();
                    }
                );
            }
            
            // Listen for reviews on ads
            const adIds = userPosts.ads.map(a => a.id);
            let unsubAdReviews;
            if (adIds.length > 0) {
                unsubAdReviews = onSnapshot(
                    query(
                        collection(db, "adReviews"),
                        where("adId", "in", adIds.slice(0, 10)),
                        orderBy("createdAt", "desc"),
                        limit(MAX_NOTIFICATIONS)
                    ),
                    async (snap) => {
                        for (const d of snap.docs) {
                            const r = d.data();
                            if (r.userId === user.uid) continue;

                            const name = await getUserName(r.userId);
                            const date = r.createdAt?.toDate() || new Date();
                            

                            let message = "";
                            if (r.rating && r.text) {
                                message = `New ${r.rating}-star rating and review from ${name}`;
                            } else if (r.rating) {
                                message = `New ${r.rating}-star rating from ${name}`;
                            } else if (r.text) {
                                message = `New review from ${name}`;
                            } else {
                                continue;
                            }

                            notificationsMap.current.set(`rating_${d.id}`, {
                                id: `rating_${d.id}`,
                                type: "rating",
                                title: "New Rating/Review",
                                message,
                                subText: r.text
                                    ? `"${r.text.slice(0, 50)}${r.text.length > 50 ? "..." : ""}"`
                                    : "",
                                date,
                                timestamp: date.getTime(),
                                postId: r.adId,
                                postType: "ad"
                            });
                        }
                        updateUI();
                    }
                );
            }
            
            return () => {
                if (unsubWorkerReviews) unsubWorkerReviews();
                if (unsubServiceReviews) unsubServiceReviews();
                if (unsubAdReviews) unsubAdReviews();
            };
        };

        let unsubFeedback;
        loadUserFeedback().then(u => unsubFeedback = u);

        /* ---------------- APP UPDATES ---------------- */

        const unsubSystem = onSnapshot(
            query(
                collection(db, "notifications"),
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(MAX_NOTIFICATIONS)
            ),
            (snap) => {
                snap.forEach((d) => {
                    const data = d.data();
                    const date = data.createdAt?.toDate() || new Date();

                    notificationsMap.current.set(`sys_${d.id}`, {
                        id: `sys_${d.id}`,
                        type: "system",
                        title: data.title || "App Update",
                        message: data.message || "",
                        date,
                        timestamp: date.getTime(),
                        actionUrl: data.actionUrl || null
                    });
                });
                updateUI();
            }
        );

        /* ---------------- CLEANUP ---------------- */

        return () => {
            unsubFavorites.forEach(unsub => unsub());
            if (unsubFeedback) unsubFeedback();
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
                    onClick={() => navigate(-1)}
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
                        <NotificationItem key={n.id} notif={n} />
                    ))
                )}
            </div>
        </div>
    );
}
