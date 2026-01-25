import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { userStatusManager } from "../auth/UserStatusManager";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useGlobalDataCache } from "../contexts/GlobalDataCacheContext";
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
  FiEdit3,
  FiGlobe,
  FiMap
} from "react-icons/fi";
import { doc, updateDoc } from "firebase/firestore";

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
  const [userCountry, setUserCountry] = useState("");
  const [contentScope, setContentScope] = useState("local");
  const [showScopeConfirm, setShowScopeConfirm] = useState(false);
  const [pendingScope, setPendingScope] = useState(null);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  // OPTIMIZATION: Use GlobalDataCache instead of fetching profile separately
  const { userProfile } = useGlobalDataCache();

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      // Use cached profile data from GlobalDataCache (0 reads)
      if (userProfile && userProfile.username) {
        setUserName(userProfile.username);
        setUserCountry(userProfile.country || "India");
        setContentScope(userProfile.countryScope || "local");



      } else {
        // Fallback to auth display name or email part
        setUserName(user.displayName || user.email?.split('@')[0] || "Anonymous");
      }
    }
  }, [userProfile]);

  const handleLogout = async () => {
    try {
      await userStatusManager.signOut();
      navigate("/login");
    } catch (error) {

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
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const appUrl = window.location.origin; // Gets the base URL of the app
    const shareData = {
      title: 'AeroSigil - Connect with Local Services',
      text: 'Check out AeroSigil! Find workers, services, and local ads all in one place.',
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
      alert('Failed to copy link. Please try again.');
    }
  };

  const confirmScopeChange = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, "profiles", user.uid), {
        countryScope: pendingScope
      });

      setContentScope(pendingScope);
      setShowScopeConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error("Error updating scope:", error);
      alert("Failed to update content scope. Please try again.");
    }
  };

  const SettingItem = ({ icon: Icon, label, onClick, color = "text-gray-700", value }) => (
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
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-400 font-medium">{value}</span>}
        <FiChevronRight className="text-gray-400" size={20} />
      </div>
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
            <SettingItem
              icon={contentScope === 'global' ? FiGlobe : FiMap}
              label="Content Region"
              value={contentScope === 'global' ? "Around the World" : (userCountry || "India") + " Only"}
              onClick={() => setShowScopeConfirm(true)}
              color={contentScope === 'global' ? "text-indigo-600" : "text-green-600"}
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
                          ? "Tell us what you think about AeroSigil..."
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
                      ? "We appreciate your feedback! It helps us improve AeroSigil."
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

      {/* Content Region Selection Modal */}
      {showScopeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowScopeConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pink-500 to-indigo-600 px-4 py-6 mb-4">
              <h3 className="font-bold text-xl text-white text-center">Choose Content Region</h3>
              <p className="text-indigo-100 text-xs text-center mt-1">Select which posts you want to see</p>
            </div>

            {/* Options */}
            <div className="p-6 space-y-3">
              {/* Local Option */}
              <button
                onClick={() => setPendingScope('local')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${(pendingScope === null ? contentScope : pendingScope) === 'local'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300 bg-white'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(pendingScope === null ? contentScope : pendingScope) === 'local'
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                    }`}>
                    <FiMap size={20} className={(pendingScope === null ? contentScope : pendingScope) === 'local' ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">{userCountry || "India"} Only</h4>
                      {(pendingScope === null ? contentScope : pendingScope) === 'local' && (
                        <FiCheck size={16} className="text-green-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">See posts only from {userCountry || "India"}. Perfect for finding local services and workers nearby.</p>
                  </div>
                </div>
              </button>

              {/* Global Option */}
              <button
                onClick={() => setPendingScope('global')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${(pendingScope === null ? contentScope : pendingScope) === 'global'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300 bg-white'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(pendingScope === null ? contentScope : pendingScope) === 'global'
                    ? 'bg-indigo-500'
                    : 'bg-gray-200'
                    }`}>
                    <FiGlobe size={20} className={(pendingScope === null ? contentScope : pendingScope) === 'global' ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">Around the World</h4>
                      {(pendingScope === null ? contentScope : pendingScope) === 'global' && (
                        <FiCheck size={16} className="text-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">See posts from all countries. Explore services and opportunities worldwide.</p>
                  </div>
                </div>
              </button>

              {/* Current Selection Info */}
              {(pendingScope === null ? contentScope : pendingScope) !== contentScope && pendingScope !== null && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-yellow-800 text-center">
                    ⚠️ The app will reload to apply changes
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setPendingScope(null);
                  setShowScopeConfirm(false);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowScopeConfirm(false);
                  setShowFinalConfirm(true);
                }}
                disabled={pendingScope === null || pendingScope === contentScope}
                className="flex-1 bg-gradient-to-r from-pink-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Confirmation Modal */}
      {showFinalConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowFinalConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertTriangle size={32} className="text-yellow-600" />
            </div>
            <h3 className="font-bold text-xl mb-2 text-gray-900">Are you sure?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Do you want to change your content region to {pendingScope === 'global' ? '"Around the World"' : `"${userCountry || "India"} Only"`}?
              <br /><br />
              The app will reload to apply these changes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFinalConfirm(false);
                  setShowScopeConfirm(true);
                }}
                className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                No
              </button>
              <button
                onClick={() => {
                  setShowFinalConfirm(false);
                  confirmScopeChange();
                }}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refer a Friend Modal */}
      {
        showReferModal && (
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

                <h3 className="font-bold text-xl mb-2 text-gray-900">Share AeroSigil</h3>
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
        )
      }
    </div>
  );
}