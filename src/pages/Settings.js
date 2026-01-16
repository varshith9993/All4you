import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { userStatusManager } from "../auth/UserStatusManager";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import {
  FiArrowLeft,
  FiUser,
  FiHeart,
  FiBell,
  FiFileText,
  FiLogOut,
  FiChevronRight,
  FiShield,
  FiAlertTriangle,
  FiX,
  FiMessageCircle,
  FiCheck,
  FiShare2,
  FiEdit3
} from "react-icons/fi";

export default function Settings() {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState("feedback"); // "feedback" or "bug"
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Try to get from profiles collection first
          const docRef = doc(db, "profiles", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().username) {
            setUserName(docSnap.data().username);
          } else {
            // Fallback to auth display name or email part
            setUserName(user.displayName || user.email?.split('@')[0] || "Anonymous");
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
          setUserName(user.displayName || "Anonymous");
        }
      }
    };

    fetchUserName();
  }, []);

  const handleLogout = async () => {
    try {
      await userStatusManager.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to log out. Please try again.");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      alert("Please enter your feedback or bug report");
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "feedback"), {
        type: feedbackType,
        message: feedbackText.trim(),
        userId: user?.uid || "anonymous",
        userEmail: user?.email || "anonymous",
        userName: userName || "Anonymous",
        createdAt: serverTimestamp(),
        submittedAt: new Date().toLocaleString(),
        status: "pending"
      });

      setSubmitSuccess(true);
      setFeedbackText("");

      // Show success for 2 seconds then close
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowFeedback(false);
        setFeedbackType("feedback");
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const appUrl = window.location.origin; // Gets the base URL of the app
    const shareData = {
      title: 'ServePure - Connect with Local Services',
      text: 'Check out ServePure! Find workers, services, and local ads all in one place.',
      url: appUrl
    };

    try {
      if (navigator.share) {
        // Use native share API if available (mobile devices)
        await navigator.share(shareData);
      } else {
        // Fallback: Open refer modal for desktop
        setShowReferModal(true);
      }
    } catch (error) {
      // User cancelled share or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        setShowReferModal(true); // Show modal as fallback
      }
    }
  };

  const handleCopyLink = async () => {
    const appUrl = window.location.origin;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  const SettingItem = ({ icon: Icon, label, onClick, color = "text-gray-700" }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full bg-gray-100 ${color}`}>
          <Icon size={20} />
        </div>
        <span className="font-medium text-gray-800">{label}</span>
      </div>
      <FiChevronRight className="text-gray-400" size={20} />
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <FiArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="flex-1 py-4">
        {/* Account Section */}
        <div className="mb-6">
          <h2 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Account</h2>
          <div className="bg-white border-t border-b border-gray-200">
            <SettingItem
              icon={FiUser}
              label="Profile"
              onClick={() => navigate("/profile")}
              color="text-blue-600"
            />
            <SettingItem
              icon={FiHeart}
              label="Favorites"
              onClick={() => navigate("/favorites")}
              color="text-red-500"
            />
            <SettingItem
              icon={FiBell}
              label="Notifications"
              onClick={() => navigate("/notifications")}
              color="text-yellow-500"
            />
            <SettingItem
              icon={FiEdit3}
              label="My Notes"
              onClick={() => navigate("/notes")}
              color="text-green-600"
            />
          </div>
        </div>

        {/* Support & Legal Section */}
        <div className="mb-6">
          <h2 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Support & Legal</h2>
          <div className="bg-white border-t border-b border-gray-200">
            <SettingItem
              icon={FiShare2}
              label="Refer a Friend"
              onClick={handleShare}
              color="text-teal-600"
            />
            <SettingItem
              icon={FiMessageCircle}
              label="Feedback & Report Bug"
              onClick={() => setShowFeedback(true)}
              color="text-indigo-600"
            />
            <SettingItem
              icon={FiFileText}
              label="Terms and Conditions"
              onClick={() => navigate("/terms")}
              color="text-purple-600"
            />
            <SettingItem
              icon={FiShield}
              label="Privacy Policy"
              onClick={() => navigate("/privacy-policy")}
              color="text-green-600"
            />
          </div>
        </div>

        <div className="px-4 mt-8">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
          >
            <FiLogOut size={20} />
            Log Out
          </button>
          <p className="text-center text-xs text-gray-400 mt-4">
            Version 1.0.0
          </p>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowFeedback(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Feedback & Bug Report</h3>
              <button
                onClick={() => setShowFeedback(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                disabled={submitting}
              >
                <FiX size={24} />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheck size={32} className="text-green-600" />
                </div>
                <h3 className="font-bold text-xl mb-2 text-gray-900">Thank You!</h3>
                <p className="text-gray-600 text-sm">
                  Your {feedbackType === "feedback" ? "feedback" : "bug report"} has been submitted successfully.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4">
                  {/* Type Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFeedbackType("feedback")}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${feedbackType === "feedback"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        💬 Feedback
                      </button>
                      <button
                        onClick={() => setFeedbackType("bug")}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${feedbackType === "bug"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        🐛 Bug Report
                      </button>
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {feedbackType === "feedback" ? "Your Feedback" : "Describe the Bug"}
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={
                        feedbackType === "feedback"
                          ? "Tell us what you think about ServePure..."
                          : "Describe the bug you encountered..."
                      }
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      rows={6}
                      disabled={submitting}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {feedbackText.length}/500 characters
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 mb-4">
                    {feedbackType === "feedback"
                      ? "We appreciate your feedback! It helps us improve ServePure."
                      : "Please provide as much detail as possible to help us fix the issue."}
                  </p>
                </div>

                <div className="p-4 border-t flex gap-3">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFeedback}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={submitting || !feedbackText.trim()}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertTriangle size={32} className="text-red-600" />
            </div>
            <h3 className="font-bold text-xl mb-2 text-gray-900">Log Out?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refer a Friend Modal */}
      {showReferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowReferModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-teal-500 to-cyan-500">
              <h3 className="font-bold text-lg text-white">Refer a Friend</h3>
              <button
                onClick={() => setShowReferModal(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <FiX size={24} className="text-white" />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShare2 size={40} className="text-teal-600" />
              </div>

              <h3 className="font-bold text-xl mb-2 text-gray-900">Share ServePure</h3>
              <p className="text-gray-600 text-sm mb-6">
                Help your friends discover local workers, services, and ads. Share the app link with them!
              </p>

              {/* App Link Display */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">App Link</p>
                <p className="text-sm font-mono text-gray-800 break-all">{window.location.origin}</p>
              </div>

              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                className={`w-full py-3 rounded-xl font-bold transition-all mb-3 flex items-center justify-center gap-2 ${copySuccess
                  ? "bg-green-100 text-green-700 border-2 border-green-300"
                  : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
              >
                {copySuccess ? (
                  <>
                    <FiCheck size={20} />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <FiShare2 size={20} />
                    Copy Link
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500">
                Share this link via WhatsApp, Email, SMS, or any messaging app
              </p>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowReferModal(false)}
                className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}