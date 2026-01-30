import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
} from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff, FiMapPin, FiUser, FiMail, FiLock, FiNavigation } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import LocationPickerModal from "../components/LocationPickerModal";


import { reverseGeocode } from "../utils/locationService";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [place, setPlace] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationEdited, setLocationEdited] = useState(false);
  const [waitingForVerification, setWaitingForVerification] = useState(false);

  // New States for Google Signup
  const [signupMethod, setSignupMethod] = useState("google"); // "email" | "google"
  const [googleUser, setGoogleUser] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [contentScope, setContentScope] = useState("local"); // "local" | "global"

  const navigate = useNavigate();
  const location = useLocation();

  // Handle pre-fill data from Login redirect
  useEffect(() => {
    if (location.state?.prefill) {
      const { email, username } = location.state.prefill;
      if (email) setEmail(email);
      if (username) setUsername(username);
    }
    if (location.state?.message) {
      setError(location.state.message); // Show as error/alert to be visible
      // Clear state to avoid persistent message
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-detect Country on Mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data && data.country_name) {
          setCountry(data.country_name);
        }
      } catch (err) {
        // Fallback or silent fail
      }
    };
    detectCountry();
  }, []);

  // Auto-redirect if already logged in AND verified (skip logic if waiting for verification to start polling)
  useEffect(() => {
    if (waitingForVerification) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.emailVerified) {
        try {
          // Check if profile exists before redirecting
          const docRef = doc(db, "profiles", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            navigate("/workers");
          } else {
            // User authenticated (likely via Google) but no profile.
            // Show Google Signup Completion form.
            setGoogleUser(user);
            setSignupMethod("google");
            if (user.email) setEmail(user.email);
            setMessage("Google sign-in successful! Please complete your profile.");
          }
        } catch (err) {
        }
      }
    });
    return () => unsubscribe();
  }, [navigate, waitingForVerification]);

  // Polling for email verification
  useEffect(() => {
    let interval;
    if (waitingForVerification) {
      interval = setInterval(async () => {
        try {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              clearInterval(interval);
              navigate("/workers");
            }
          }
        } catch (error) {
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [waitingForVerification, navigate]);


  const validatePassword = () => {
    // At least 6 characters
    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }

    // Must contain at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      return "Password must be at least 6 characters long and contain at least one letter and one number.";
    }

    return "";
  };

  const validateEmail = (em) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(em);
  };

  const isUsernameTaken = async (un) => {
    const q = query(collection(db, "profiles"), where("username", "==", un));
    const snap = await getDocs(q);

    return !snap.empty;
  };

  const validateUsername = (un) => {
    // Greater than 5 and less than 13 letters -> 6 to 12 characters
    const re = /^[a-zA-Z0-9_]{6,12}$/;
    if (!re.test(un)) {
      return "Username must be 6-12 characters long and contain only letters, numbers, or underscores.";
    }
    return "";
  };

  const autofillLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setError("");
    setMessage("Getting location... Please wait.");
    setGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);

        if (!locationEdited) {
          try {
            const data = await reverseGeocode(lat, lon, 'opencage');

            if (data && data.results && data.results.length > 0) {
              const comp = data.results[0].components;
              setPlace(comp.suburb || comp.neighbourhood || comp.village || "");
              setCity(comp.city || comp.town || comp.county || "");
              setPincode(comp.postcode || "");
              if (comp.country) setCountry(comp.country);
              setMessage("Location autofilled successfully!");
            } else {
              throw new Error("No location details");
            }
          } catch (e) {
            setError("Failed to autofill address details. Please enter manually.");
            setMessage("");
          }
        }
        setGettingLocation(false);
      },
      (err) => {
        setError("Location permission denied or unavailable.");
        setMessage("");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };


  const handleStartSignup = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address.");
      setSubmitting(false);
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms and Conditions and Privacy Policy");
      setSubmitting(false);
      return;
    }

    const pwdError = validatePassword();
    if (pwdError) {
      setError(pwdError);
      setSubmitting(false);
      return;
    }

    if (
      !username.trim() ||
      !place.trim() ||
      !city.trim() ||
      !pincode.trim() ||
      (!locationEdited && (!latitude || !longitude))
    ) {
      setError("All fields including accurate location info are required.");
      setSubmitting(false);
      return;
    }

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (methods && methods.length > 0) {
        setError("The email already exists. One mail, one account.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
    }

    setMessage("Checking username availability...");

    // Validate format first
    const unError = validateUsername(username.trim());
    if (unError) {
      setError(unError);
      setMessage("");
      setSubmitting(false);
      return;
    }

    if (await isUsernameTaken(username.trim())) {
      setError("Username is already taken.");
      setMessage("");
      setSubmitting(false);
      return;
    }

    setMessage("Creating account...");
    try {
      const cleanEmail = email.trim();
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 1. Send Verification Email (Native Firebase Link)
      await sendEmailVerification(user);

      // 2. Save Profile to Firestore
      await setDoc(doc(db, "profiles", user.uid), {
        username: username.trim(),
        place: place.trim(),
        landmark: landmark.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        createdAt: new Date(),
        uid: user.uid,
        email: cleanEmail,
        country: country.trim() || "India", // Default if detection fails
        countryScope: contentScope // User's selected scope
      });

      // 3. Do NOT sign out. Wait for them to click the link.
      setWaitingForVerification(true);
      setMessage("Verification link sent! Waiting for you to click it...");
      setError("");

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("The email already exists. One mail, one account.");
      } else {
        setError(err.message || "Signup failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user already has a profile
      const docRef = doc(db, "profiles", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // User already has a profile, redirect to workers
        navigate("/workers");
      } else {
        // User authenticated but no profile - show completion form
        setGoogleUser(user);
        if (user.email) setEmail(user.email);
        // Pre-fill username suggestion from display name
        if (user.displayName) {
          const suggestedUsername = user.displayName.replace(/\s+/g, '_').toLowerCase().substring(0, 12);
          setUsername(suggestedUsername);
        }
        setMessage("Google sign-in successful! Please complete your profile.");
      }
    } catch (err) {
      // Handle specific error codes
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup was blocked by your browser. Please allow popups and try again.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Network error. Please check your internet connection and try again.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized for Google sign-in. Please contact support.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Google sign-in is not enabled. Please contact support.");
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with the same email but different sign-in credentials.");
      } else if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        // Firestore permission error - handle gracefully
        setError("Unable to verify account. Please try again or use email signup.");
      } else {
        setError(`Sign-in failed: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogleSignup = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    if (!acceptedTerms) {
      setError("You must accept the Terms and Conditions and Privacy Policy");
      setSubmitting(false);
      return;
    }

    if (
      !username.trim() ||
      !place.trim() ||
      !city.trim() ||
      !pincode.trim() ||
      !country.trim() ||
      (!locationEdited && (!latitude || !longitude))
    ) {
      setError("All fields including accurate location info are required.");
      setSubmitting(false);
      return;
    }

    // Validate format first
    const unError = validateUsername(username.trim());
    if (unError) {
      setError(unError);
      setSubmitting(false);
      return;
    }

    const pwdError = validatePassword();
    if (pwdError) {
      setError(pwdError);
      setSubmitting(false);
      return;
    }

    if (await isUsernameTaken(username.trim())) {
      setError("Username is already taken.");
      setSubmitting(false);
      return;
    }

    try {
      // Try to set the password for the Google user so they can also login with email/password
      // This is optional and might fail if the credential is not recent, but should not block signup
      try {
        if (password) {
          await updatePassword(googleUser, password);
        }
      } catch (pwdErr) {
        console.warn("Could not set password for Google user:", pwdErr);
        // Continue anyway - this is not critical
      }

      // Save Profile to Firestore
      await setDoc(doc(db, "profiles", googleUser.uid), {
        username: username.trim(),
        place: place.trim(),
        landmark: landmark.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        createdAt: new Date(),
        uid: googleUser.uid,
        email: googleUser.email,
        country: country.trim() || "India",
        countryScope: contentScope // User's selected scope
      });

      // Navigate to workers
      navigate("/workers");

    } catch (err) {
      console.error("Profile creation error:", err);
      setError("Failed to create profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 py-10">
      {/* Hide browser default password reveal button to prevent double icons */}
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-gray-500 text-sm mt-1">Join AeroSigil today!</p>
        </div>

        {/* Signup Method Tabs */}
        {!googleUser && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${signupMethod === "email" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => {
                setSignupMethod("email");
                setError("");
              }}
            >
              Email Signup
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${signupMethod === "google" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => {
                setSignupMethod("google");
                setError("");
              }}
            >
              Google Signup
            </button>
          </div>
        )}

        {signupMethod === "email" ? (
          <form onSubmit={handleStartSignup} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
                disabled={submitting}
              />
            </div>

            {/* Email */}
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
                disabled={submitting}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex="-1"
                disabled={submitting}
              >
                {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-4">Password must be at least 6 chars with letters & numbers</p>

            {/* Location Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-700">Location Details</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <FiMapPin size={12} />
                    Pin on Map
                  </button>
                  <button
                    type="button"
                    onClick={autofillLocation}
                    disabled={gettingLocation || submitting}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    <FiNavigation size={12} />
                    {gettingLocation ? "Locating..." : "Get Current Location"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                  required
                  disabled={submitting}
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="relative">
                <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Area / Place"
                  value={place}
                  onChange={(e) => {
                    setLocationEdited(true);
                    setPlace(e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="relative">
                <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Landmark (Optional)"
                  value={landmark}
                  onChange={(e) => {
                    setLocationEdited(true);
                    setLandmark(e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => {
                    setLocationEdited(true);
                    setCity(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                  disabled={submitting}
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={pincode}
                  onChange={(e) => {
                    setLocationEdited(true);
                    setPincode(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                  disabled={submitting}
                />
              </div>

              {/* Country (Auto-detected, Read-only) */}
              <div className="relative">
                <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Country (Auto-detected)"
                  value={country}
                  readOnly
                  className="w-full pl-12 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none cursor-not-allowed text-gray-600 font-medium"
                />
              </div>

              {/* Content Scope Radio Buttons */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-sm font-bold text-gray-700 mb-3">Show posts from:</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${contentScope === 'local'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-300'
                    }`}>
                    <input
                      type="radio"
                      name="contentScope"
                      value="local"
                      checked={contentScope === 'local'}
                      onChange={(e) => setContentScope(e.target.value)}
                      className="mr-3 w-4 h-4 text-green-600"
                      disabled={submitting}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-sm">{country || 'Selected Country'} Only</div>
                      <div className="text-xs text-gray-600">See posts only from your country</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${contentScope === 'global'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                    }`}>
                    <input
                      type="radio"
                      name="contentScope"
                      value="global"
                      checked={contentScope === 'global'}
                      onChange={(e) => setContentScope(e.target.value)}
                      className="mr-3 w-4 h-4 text-indigo-600"
                      disabled={submitting}
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-sm">Around the World</div>
                      <div className="text-xs text-gray-600">See posts from all countries</div>
                    </div>
                  </label>
                </div>
              </div>


              {/* Location Tip */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <FiMapPin className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-blue-700 leading-relaxed">
                  <span className="font-bold">Tip:</span> For better location accuracy, sit near a window or outdoors when getting your location.
                </p>
              </div>
            </div>

            {/* Terms and Privacy Policy Combined */}
            <div className="flex items-start pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 mr-2 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                disabled={submitting}
              />
              <label htmlFor="terms" className="text-xs text-gray-600">
                I confirm that I have read all{" "}
                <button
                  type="button"
                  className="text-indigo-600 font-bold hover:underline"
                  onClick={() => navigate("/terms")}
                  disabled={submitting}
                >
                  Terms and Conditions
                </button>
                {" "}and{" "}
                <button
                  type="button"
                  className="text-indigo-600 font-bold hover:underline"
                  onClick={() => navigate("/privacy-policy")}
                  disabled={submitting}
                >
                  Privacy Policy
                </button>
                , and I agree with the Terms and Conditions and Privacy Policy.
              </label>
            </div>

            {/* Messages */}
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg text-center border border-green-100">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || gettingLocation}
              className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {!googleUser ? (
              <div className="flex flex-col items-center justify-center py-8">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={submitting}
                  className="flex items-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-4 px-8 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all active:scale-[0.98] w-full justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <FcGoogle size={24} />
                      <span>Sign up with Google</span>
                    </>
                  )}
                </button>
                <p className="text-gray-400 text-xs mt-4 text-center">
                  Securely sign up with your Google account.<br />
                  We'll ask for username and location details next.
                </p>
                {error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 w-full">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleCompleteGoogleSignup} className="space-y-4 animate-fade-in">
                {/* Email Display (Read Only) */}
                <div className="relative opacity-60">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full pl-12 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none cursor-not-allowed"
                  />
                </div>

                {/* Username */}
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    required
                    disabled={submitting}
                  />
                </div>

                {/* Password for Google User */}
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex="-1"
                    disabled={submitting}
                  >
                    {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-4">Password must be at least 6 chars with letters & numbers</p>

                {/* Reuse Location Section Logic */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-700">Location Details</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        <FiMapPin size={12} />
                        Pin on Map
                      </button>
                      <button
                        type="button"
                        onClick={autofillLocation}
                        disabled={gettingLocation || submitting}
                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        <FiNavigation size={12} />
                        {gettingLocation ? "Locating..." : "Get Current Location"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                      required
                      disabled={submitting}
                    />
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Area / Place"
                      value={place}
                      onChange={(e) => {
                        setLocationEdited(true);
                        setPlace(e.target.value);
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Landmark (Optional)"
                      value={landmark}
                      onChange={(e) => {
                        setLocationEdited(true);
                        setLandmark(e.target.value);
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) => {
                        setLocationEdited(true);
                        setCity(e.target.value);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      required
                      disabled={submitting}
                    />
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) => {
                        setLocationEdited(true);
                        setPincode(e.target.value);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      required
                      disabled={submitting}
                    />
                  </div>

                  {/* Country (Auto-detected, Read-only) */}
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Country (Auto-detected)"
                      value={country}
                      readOnly
                      className="w-full pl-12 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none cursor-not-allowed text-gray-600 font-medium"
                    />
                  </div>

                  {/* Content Scope Radio Buttons */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Show posts from:</label>
                    <div className="space-y-2">
                      <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${contentScope === 'local'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-green-300'
                        }`}>
                        <input
                          type="radio"
                          name="contentScopeGoogle"
                          value="local"
                          checked={contentScope === 'local'}
                          onChange={(e) => setContentScope(e.target.value)}
                          className="mr-3 w-4 h-4 text-green-600"
                          disabled={submitting}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 text-sm">{country || 'Selected Country'} Only</div>
                          <div className="text-xs text-gray-600">See posts only from your country</div>
                        </div>
                      </label>
                      <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${contentScope === 'global'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-indigo-300'
                        }`}>
                        <input
                          type="radio"
                          name="contentScopeGoogle"
                          value="global"
                          checked={contentScope === 'global'}
                          onChange={(e) => setContentScope(e.target.value)}
                          className="mr-3 w-4 h-4 text-indigo-600"
                          disabled={submitting}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 text-sm">Around the World</div>
                          <div className="text-xs text-gray-600">See posts from all countries</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Terms and Privacy Policy Combined */}
                <div className="flex items-start pt-2">
                  <input
                    type="checkbox"
                    id="termsGoogle"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 mr-2 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    disabled={submitting}
                  />
                  <label htmlFor="termsGoogle" className="text-xs text-gray-600">
                    I confirm that I have read all{" "}
                    <button
                      type="button"
                      className="text-indigo-600 font-bold hover:underline"
                      onClick={() => navigate("/terms")}
                      disabled={submitting}
                    >
                      Terms and Conditions
                    </button>
                    {" "}and{" "}
                    <button
                      type="button"
                      className="text-indigo-600 font-bold hover:underline"
                      onClick={() => navigate("/privacy-policy")}
                      disabled={submitting}
                    >
                      Privacy Policy
                    </button>
                    , and I agree with the Terms and Conditions and Privacy Policy.
                  </label>
                </div>

                {/* Messages */}
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || gettingLocation}
                  className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {submitting ? "Completing Setup..." : "Complete Setup"}
                </button>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-gray-600 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-bold hover:underline">
            Login here
          </Link>
        </p>

        {/* Polling/Waiting Overlay */}
        {waitingForVerification && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-white rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Check Your Email</h2>
            <p className="text-gray-300 mb-6 max-w-xs">
              We sent a link to <span className="text-indigo-400 font-mono">{email}</span>.
              Please click it to verify your account.
            </p>
            <p className="text-sm text-gray-400 animate-pulse">
              Waiting for verification...
            </p>
            <p className="text-xs text-gray-500 mt-8">
              App will automatically update once verified.
            </p>
          </div>
        )}
        {/* Location Picker Modal */}
        <LocationPickerModal
          show={showLocationPicker}
          initialPosition={{ lat: latitude, lng: longitude }}
          apiProvider="opencage"
          onConfirm={(location) => {
            setLatitude(location.lat);
            setLongitude(location.lng);
            setPlace(location.area);
            setCity(location.city);
            setPincode(location.pincode);
            setLocationEdited(true);
            setShowLocationPicker(false);
            setError("");
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
      </div>
    </div>
  );
}