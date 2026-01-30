import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ProfileCacheProvider } from "./contexts/ProfileCacheContext";
import { GlobalDataCacheProvider } from "./contexts/GlobalDataCacheContext";
import { PaginatedDataCacheProvider } from "./contexts/PaginatedDataCacheContext";
import { requestNotificationPermission, checkNotificationPermission } from "./utils/fcmService";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgetPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
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

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // Auto-request notification permission on app open
    useEffect(() => {
        const requestNotifications = async () => {
            if (!user) return;

            // Check current permission status
            const permission = await checkNotificationPermission();

            // If already granted, do nothing
            if (permission === 'granted') {
                return;
            }

            // If denied or default, ask again (every time app opens)
            // Wait a bit for user to see the app first
            setTimeout(async () => {
                try {
                    const userLocation = JSON.parse(localStorage.getItem('userLocation') || '{}');
                    await requestNotificationPermission(user.uid, userLocation);
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            }, 3000); // Wait 3 seconds after login
        };

        requestNotifications();
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
                    </ProfileCacheProvider>
                </PaginatedDataCacheProvider>
            </GlobalDataCacheProvider>

            {showOfflineScreen && <NoInternet onRefresh={handleRefresh} />}
        </>
    );
}
