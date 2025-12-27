import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
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
import ProfileDetail from "./pages/ProfileDetail";
import Notifications from "./pages/Notifications";
import EditAd from "./pages/EditAd";
import EditWorker from "./pages/EditWorker";
import EditService from "./pages/EditService";
import ServiceDetail from "./pages/ServiceDetail";
import GetUserId from "./pages/GetUserId";
import NoInternet from "./components/NoInternet";
import Notes from "./pages/Notes";
import TermsAndConditions from "./pages/TermsAndConditions";
import VerifyEmail from "./pages/VerifyEmail";

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to fetch a reliable external resource to verify internet connectivity
        // mode: 'no-cors' is used to avoid CORS errors while still detecting network failures
        await fetch('https://www.google.com', { mode: 'no-cors', cache: 'no-store' });
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };
    const handleOffline = () => setIsOnline(false);

    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes("offline")) {
        setIsOnline(false);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Check connection status immediately and periodically
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!isOnline) {
    return <NoInternet onRefresh={handleRefresh} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
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
      <Route path="/profile-detail/:id" element={<ProfileDetail />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/editworker/:id" element={<EditWorker />} />
      <Route path="/editservice/:id" element={<EditService />} />
      <Route path="/service-detail/:id" element={<ServiceDetail />} />
      <Route path="/forgot-password" element={<ForgetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/get-user-id" element={<GetUserId />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={<div>404 Page Not Found</div>} />
    </Routes>
  );
}
