import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff, FiMapPin, FiUser, FiMail, FiLock, FiNavigation } from "react-icons/fi";


export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [place, setPlace] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
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

  // Auto-redirect if already logged in AND verified (skip logic if waiting for verification to start polling)
  useEffect(() => {
    if (waitingForVerification) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        navigate("/workers");
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
          console.log("Error reloading user:", error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [waitingForVerification, navigate]);


  const validatePassword = () => {
    // 6 to 12 chars
    if (password.length < 6 || password.length > 12) {
      return "Password must be 6-12 characters long.";
    }

    // Must contain at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      return "Password must contain at least one letter and one number.";
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
            const locationIQKey = process.env.REACT_APP_LOCATIONIQ_KEY || "pk.c46b235dc808aed78cb86bd70c83fab0";
            const url = `https://us1.locationiq.com/v1/reverse.php?key=${locationIQKey}&lat=${lat}&lon=${lon}&format=json`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.address) {
              const addr = data.address;
              setPlace(addr.neighbourhood || addr.suburb || addr.village || "");
              setCity(addr.city || addr.county || "");
              setPincode(addr.postcode || "");
              setMessage("Location autofilled successfully!");
            } else {
              throw new Error("No location details");
            }
          } catch (e) {
            console.error("LocationIQ error:", e);
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
      setError("You must accept the Terms and Conditions");
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
      console.log("Email existence check failed:", err);
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
        email: cleanEmail
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
          <p className="text-gray-500 text-sm mt-1">Join ServePure today!</p>
        </div>

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
          <p className="text-xs text-gray-500 mt-1 ml-4">Password must be 6-12 chars (include letters & numbers)</p>

          {/* Location Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-700">Location Details</label>
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

            {/* Location Tip */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <FiMapPin className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-blue-700 leading-relaxed">
                <span className="font-bold">Tip:</span> For better location accuracy, sit near a window or outdoors when getting your location.
              </p>
            </div>
          </div>

          {/* Terms */}
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
              I accept the{" "}
              <button
                type="button"
                className="text-indigo-600 font-bold hover:underline"
                onClick={() => navigate("/terms")}
                disabled={submitting}
              >
                Terms and Conditions
              </button>
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
      </div>
    </div>
  );
}