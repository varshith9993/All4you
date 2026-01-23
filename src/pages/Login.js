import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff, FiMail, FiLock } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [successMessage, setSuccessMessage] = useState(location.state?.message || "");

  // Auto-redirect if already logged in AND verified
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        navigate("/workers");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear location state to prevent message showing again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSuccessMessage("");
    setSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setError("Please verify your email address before logging in. Check your inbox.");
        await signOut(auth);
      } else {
        navigate("/workers");
      }
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        // Redirect to signup if account not found
        // Note: 'invalid-credential' can sometimes be ambiguous, but for this specific flow request we will prioritize the redirect if it looks like they don't exist.
        // However, invalid-credential usually means wrong password too.
        // To be safe, we only redirect on user-not-found, but Firebase unified errors recently.
        // Let's rely on the explicit error message if possible or just use the catch-all for now as per request.
        // Actually, for better UX, let's keep the error text for wrong password, but redirect for no account.
        // Since Firebase now masks existence, 'invalid-credential' is common.
        // But the user specifically asked: "If no account exists, redirect to signup".
        // The most reliable way is fetchSignInMethodsForEmail, but we can't always enable that given security rules.
        // Let's stick to the error handling requested: 
        if (err.code === "auth/user-not-found") {
          navigate("/signup", { state: { message: "Account not found. Please create an account first." } });
        } else {
          setError("Incorrect email or password.");
        }
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendLink = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setResending(true);
    setError("");
    setSuccessMessage("");
    try {
      // We need to sign in temporarily to resend, or just sign in with the user we just tried to login as
      // Simplest: just warn them they need to check their mail, or if they just tried to login, we can use that user
      // But if they are logged out, we can't call sendEmailVerification on null.
      // So we have to sign them in, send, then sign out.
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      setSuccessMessage("Verification link resent! Please check your inbox.");
    } catch (err) {
      setError("Failed to resend link: " + err.message);
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user has a profile in Firestore
      const docRef = doc(db, "profiles", user.uid);
      const docSnap = await getDoc(docRef);



      if (docSnap.exists()) {
        // User has an account, proceed to login
        navigate("/workers");
      } else {
        // User doesn't have a profile - sign out and redirect to signup
        await signOut(auth);
        navigate("/signup", {
          state: {
            message: "Account not found. Please complete your signup to continue.",
            prefill: {
              email: user.email,
              username: user.displayName ? user.displayName.replace(/\s+/g, '_').toLowerCase().substring(0, 12) : ''
            }
          }
        });
      }
    } catch (err) {
      // Handle specific error codes
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked by your browser. Please allow popups and try again.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized for Google sign-in. Please contact support.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google sign-in is not enabled. Please contact support.");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with the same email but different sign-in credentials.");
      } else if (err.code === "permission-denied" || err.message?.includes("permission")) {
        // Firestore permission error - user authenticated but can't read profile
        // This might happen with new users, redirect to signup
        try {
          await signOut(auth);
        } catch (signOutErr) {
        }
        navigate("/signup", {
          state: {
            message: "Please complete your signup to continue."
          }
        });
      } else {
        setError(`Sign-in failed: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent mb-2">
            AeroSigil
          </h1>
          <p className="text-gray-500">Welcome back! Please login to continue.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="relative">
            <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
              disabled={submitting}
            />
          </div>

          <div className="relative">
            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
            </button>
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Reset Password?
            </Link>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 animate-shake">
              {error}
              {error.includes("verify your email") && (
                <button
                  type="button"
                  onClick={handleResendLink}
                  disabled={resending}
                  className="block w-full mt-2 text-indigo-600 font-bold hover:underline"
                >
                  {resending ? "Resending..." : "Resend Link"}
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg text-center border border-green-100 italic">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Logging in...</span>
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-gray-200 flex-1"></div>
          <span className="text-gray-400 text-sm">OR</span>
          <div className="h-px bg-gray-200 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-medium py-3.5 rounded-xl hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
          ) : (
            <>
              <FcGoogle size={24} />
              Sign in with Google
            </>
          )}
        </button>

        <p className="mt-8 text-center text-gray-600">
          Didn't have an account?{" "}
          <Link to="/signup" className="text-indigo-600 font-bold hover:underline">
            Signup
          </Link>
        </p>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .animate-shake {
            animation: shake 0.2s ease-in-out 0s 2;
          }
        `}</style>
      </div>
    </div>
  );
}
