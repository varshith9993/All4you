import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ProfileCacheProvider } from "./contexts/ProfileCacheContext";
import { GlobalDataCacheProvider } from "./contexts/GlobalDataCacheContext";
import { PaginatedDataCacheProvider } from "./contexts/PaginatedDataCacheContext";
import { requestNotificationPermission, checkNotificationPermission } from "./utils/fcmService";
import NotificationPermissionModal from "./components/NotificationPermissionModal";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgetPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import VersionUpdateManager from "./components/VersionUpdateManager";
import Workers from "./pages/Workers";
import AddAds from "./pages/AddAds";
import Services from "./pages/Services";
import AddWorkers from "./pages/AddWorkers";
import AddServices from "./pages/AddServices";
import AddNotes from "./pages/AddNotes";
import WorkerDetail from "./pages/WorkerDetail";
import Ads from "./pages/Ads";
import Chats from "./pages/Chats";
import ChatDetail from "./pages/ChatDetail";
import AdDetail from "./pages/AdDetail";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Favorites from "./pages/Favorites";
import Notifications from "./pages/Notifications";
import EditAd from "./pages/EditAd";
import EditWorker from "./pages/EditWorker";
import EditService from "./pages/EditService";
import ServiceDetail from "./pages/ServiceDetail";
import GetUserId from "./pages/GetUserId";
import NoInternet from "./components/NoInternet";
import Notes from "./pages/Notes";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import VerifyEmail from "./pages/VerifyEmail";
import Coins from "./pages/Coins";

export default function App() {
    const [showOfflineScreen, setShowOfflineScreen] = useState(false);
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [showNotifModal, setShowNotifModal] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // Check notification permission on app open
    useEffect(() => {
        const checkPermission = async () => {
            // Wait for user authentication to settle
            if (authLoading || !user) return;

            try {
                // Check current status
                const permission = await checkNotificationPermission();

                // If already granted, ensure token is saved
                if (permission === 'granted') {
                    console.log('✅ Notification permission already granted');
                    const userLocation = JSON.parse(localStorage.getItem('userLocation') || '{}');
                    await requestNotificationPermission(user.uid, userLocation);
                    return;
                }

                // If permission is 'default' (not yet asked), show custom modal
                if (permission === 'default') {
                    // Check if user previously dismissed valid for session/day? For now, we show it.
                    // Or check localStorage for 'notificationModalDismissed' if you want to delay it.
                    // User request implies "when user opens app", so we show it.
                    console.log('📢 Permission is default, showing custom modal');
                    setShowNotifModal(true);
                }

            } catch (error) {
                console.error('❌ Error checking notification permission:', error);
            }
        };

        checkPermission();
    }, [user, authLoading]);

    const handleEnableNotifications = async () => {
        setShowNotifModal(false);
        try {
            const userLocation = JSON.parse(localStorage.getItem('userLocation') || '{}');
            const token = await requestNotificationPermission(user.uid, userLocation);
            if (token) {
                console.log('✅ Notification permission granted via modal!');
            }
        } catch (error) {
            console.error('❌ Error enabling notifications:', error);
        }
    };

    // Listen for service worker messages (notification clicks)
    useEffect(() => {
        const handleServiceWorkerMessage = async (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                console.log('[App] Notification click message received:', event.data);

                const { url, needsPostCheck, postId, collection } = event.data;

                // Check if user is logged in
                if (!user) {
                    // User is not logged in, navigate to /login
                    window.location.href = '/login';
                    return;
                }

                // If this is a new post notification, check if post is still active
                if (needsPostCheck && postId && collection) {
                    try {
                        // Import Firestore dynamically
                        const { doc, getDoc } = await import('firebase/firestore');
                        const { db } = await import('./firebase');

                        // Check if post exists and is active
                        const postRef = doc(db, collection, postId);
                        const postSnap = await getDoc(postRef);

                        if (!postSnap.exists() || postSnap.data().isDisabled === true) {
                            // Post is unavailable (deleted or disabled)
                            // Navigate to /workers and show message
                            window.location.href = '/workers?message=post_unavailable';
                            return;
                        }

                        // Post is active, navigate to post detail
                        window.location.href = url;
                    } catch (error) {
                        console.error('[App] Error checking post availability:', error);
                        // On error, navigate to /workers
                        window.location.href = '/workers';
                    }
                } else {
                    // For all other notifications, navigate to /workers
                    window.location.href = url || '/workers';
                }
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

            return () => {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            };
        }
    }, [user]);

    useEffect(() => {
        let offlineTimer = null;

        const checkConnection = async () => {
            if (!navigator.onLine) {
                if (!offlineTimer) {
                    offlineTimer = setTimeout(() => {
                        if (!navigator.onLine) setShowOfflineScreen(true);
                    }, 3000);
                }
                return;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                await fetch('https://www.google.com/favicon.ico', {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                if (offlineTimer) {
                    clearTimeout(offlineTimer);
                    offlineTimer = null;
                }
                setShowOfflineScreen(false);
            } catch (error) {
                if (!navigator.onLine) {
                    if (!offlineTimer) {
                        offlineTimer = setTimeout(() => {
                            if (!navigator.onLine) setShowOfflineScreen(true);
                        }, 3000);
                    }
                }
            }
        };

        const handleOnline = () => {
            if (offlineTimer) {
                clearTimeout(offlineTimer);
                offlineTimer = null;
            }
            setShowOfflineScreen(false);
            checkConnection();
        };

        const handleOffline = () => {
            if (!offlineTimer) {
                offlineTimer = setTimeout(() => {
                    if (!navigator.onLine) setShowOfflineScreen(true);
                }, 3000);
            }
        };

        const handleUnhandledRejection = (event) => {
            if (event.reason && event.reason.message && event.reason.message.includes("offline")) {
                handleOffline();
            }
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        checkConnection();

        const interval = setInterval(checkConnection, 60000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            if (offlineTimer) clearTimeout(offlineTimer);
            clearInterval(interval);
        };
    }, []);

    const handleRefresh = () => {
        window.location.reload();
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <>
            <GlobalDataCacheProvider>
                <PaginatedDataCacheProvider>
                    <ProfileCacheProvider>
                        <VersionUpdateManager>
                            <Routes>
                                <Route path="/" element={user ? <Navigate to="/workers" replace /> : <Navigate to="/login" replace />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/signup" element={<Signup />} />
                                <Route path="/worker-detail/:id" element={<WorkerDetail />} />
                                <Route path="/workers" element={<Workers />} />
                                <Route path="/services" element={<Services />} />
                                <Route path="/chat/:chatId" element={<ChatDetail />} />
                                <Route path="/ad-detail/:adId" element={<AdDetail />} />
                                <Route path="/add-workers" element={<AddWorkers />} />
                                <Route path="/add-services" element={<AddServices />} />
                                <Route path="/add-ads" element={<AddAds />} />
                                <Route path="/editad/:id" element={<EditAd />} />
                                <Route path="/ads" element={<Ads />} />
                                <Route path="/chats" element={<Chats />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/add-notes" element={<AddNotes />} />
                                <Route path="/favorites" element={<Favorites />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/editworker/:id" element={<EditWorker />} />
                                <Route path="/editservice/:id" element={<EditService />} />
                                <Route path="/service-detail/:id" element={<ServiceDetail />} />
                                <Route path="/forgot-password" element={<ForgetPassword />} />
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/get-user-id" element={<GetUserId />} />
                                <Route path="/notes" element={<Notes />} />
                                <Route path="/terms" element={<TermsAndConditions />} />
                                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                                <Route path="/verify-email" element={<VerifyEmail />} />
                                <Route path="/coins" element={<Coins />} />
                                <Route path="*" element={<div>404 Page Not Found</div>} />
                            </Routes>
                        </VersionUpdateManager>
                    </ProfileCacheProvider>
                </PaginatedDataCacheProvider>
            </GlobalDataCacheProvider >

            <NotificationPermissionModal
                isOpen={showNotifModal}
                onClose={() => setShowNotifModal(false)}
                onEnable={handleEnableNotifications}
            />

            {showOfflineScreen && <NoInternet onRefresh={handleRefresh} />}
        </>
    );
}
