import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiTag, FiFileText, FiImage, FiUpload, FiX, FiCheck } from "react-icons/fi";
import LocationPickerModal from "../components/LocationPickerModal";
import { compressFile } from "../utils/compressor";

const suggestedTags = ["discount", "offer", "sale", "new", "limited", "popular", "urgent", "exchange"];
const LOCATIONIQ_API_KEY = "pk.a9310b368752337ce215643e50ac0172";
const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/devs4x2aa/upload";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";
const MAX_PHOTOS = 4;

export default function AddAds() {
  const [currentUser, setCurrentUser] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [inputTag, setInputTag] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [locationLandmark, setLocationLandmark] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const uploadFileToCloudinary = async (file) => {
    // Compress file before upload (images only, SVGs skipped)
    const compressedFile = await compressFile(file);

    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
      return res.data.secure_url;
    } catch (err) {
      throw new Error("Cloudinary upload failed: " + (err.response?.data?.error?.message || err.message));
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + photos.length > MAX_PHOTOS) {
      setError(`You can upload maximum ${MAX_PHOTOS} photos.`);
      return;
    }

    // Validate file size (Max 2.5MB)
    for (const file of files) {
      if (file.size > 2.5 * 1024 * 1024) {
        setError(`Photo "${file.name}" exceeds the 2.5MB limit.`);
        return;
      }
    }

    // Create previews immediately
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
    setPhotos([...photos, ...files]);
    setError("");
  };

  const removePhoto = (idx) => {
    setPhotos(photos.filter((_, i) => i !== idx));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== idx));
  };

  const handleAddTag = () => {
    if (inputTag.trim() && !tags.includes(inputTag.trim())) {
      setTags([...tags, inputTag.trim()]);
    }
    setInputTag("");
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const autofillLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      return;
    }

    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLatitude(lat.toString());
        setLongitude(lng.toString());

        try {
          const geoRes = await axios.get(`https://us1.locationiq.com/v1/reverse.php`, {
            params: {
              key: LOCATIONIQ_API_KEY,
              lat: lat,
              lon: lng,
              format: 'json'
            },
          });
          const addr = geoRes.data.address;
          setLocationArea(addr.suburb || addr.neighbourhood || addr.village || "");
          setLocationCity(addr.city || addr.town || addr.county || "");
          setPincode(addr.postcode || "");
        } catch {
          setError("Failed to get location details");
        } finally {
          setLocationLoading(false);
        }
      },
      (err) => {
        setError("Failed to get location. Please enable GPS and allow location access.");
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (photos.length === 0) {
      setError("Please upload at least one photo.");
      return;
    }
    if (!title.trim() || !description.trim() || !locationArea.trim() || !locationCity.trim() || !pincode.trim()) {
      setError("Please fill all required fields");
      return;
    }
    if (!latitude || !longitude) {
      setError("Please get your location to calculate distance");
      return;
    }
    if (tags.length === 0) {
      setError("Please add at least one tag.");
      return;
    }

    setSubmitting(true);
    setUploading(true);

    try {
      // Get fresh user profile data
      const userProfileSnap = await getDoc(doc(db, "profiles", currentUser.uid));
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : {};

      // Upload photos
      const uploadedUrls = [];
      for (const photo of photos) {
        const url = await uploadFileToCloudinary(photo);
        uploadedUrls.push(url);
      }

      const docRef = await addDoc(collection(db, "ads"), {
        // Flat fields kept for compatibility (can be removed if migration script runs)
        username: userProfile.username || "",
        profileImage: userProfile.profileImage || "",
        online: !!userProfile.online,
        lastSeen: null,

        // Denormalized Author Data
        author: {
          uid: currentUser.uid,
          username: userProfile.username || "Unknown",
          photoURL: userProfile.profileImage || "",
          online: !!userProfile.online,
          lastSeen: userProfile.lastSeen || null,
          verified: !!userProfile.verified
        },

        photos: uploadedUrls,
        title: title.trim(),
        description: description.trim(),
        tags,
        location: {
          area: locationArea.trim(),
          landmark: locationLandmark.trim(),
          city: locationCity.trim(),
          pincode: pincode.trim(),
        },
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        rating: 0,
        distance: "---",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      console.group(`[Action: CREATE AD]`);
      console.log(`%c✔ Firestore Operations Successful`, "color: green; font-weight: bold");
      console.log(`- Reads: 1 (Fetch profile snap)`);
      console.log(`- Writes: 1 (Add ad document)`);
      console.log(`Document ID: ${docRef.id}`);
      console.groupEnd();

      navigate("/ads");
    } catch (err) {
      console.error("Submission error:", err);
      setError(`Failed to post ad: ${err.message || err}`);
      setSubmitting(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Create New Ad</h1>
          <p className="text-gray-600">Post an ad to sell, buy, or announce something.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">

          {/* Ad Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiFileText className="text-indigo-600" />
              Ad Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g., Brand New Sofa for Sale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">{title.length}/120 characters</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Describe what you are selling or looking for..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  rows={5}
                  required
                />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiImage className="text-indigo-600" />
              Photos <span className="text-sm font-normal text-gray-500">(Max {MAX_PHOTOS})</span> <span className="text-red-500">*</span>
            </h2>
            <label className="cursor-pointer block">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-indigo-500 transition-colors text-center">
                <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                <span className="text-sm text-gray-600">
                  Click to upload photos
                </span>
                <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, SVG (Max 2.5MB)</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,.svg"
                onChange={handlePhotoChange}
                className="hidden"
                disabled={photos.length >= MAX_PHOTOS}
              />
            </label>

            {photoPreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={src}
                      alt={`Preview ${idx}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-90 transition-opacity"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length >= MAX_PHOTOS && <div className="text-xs text-red-500 mt-2">Maximum {MAX_PHOTOS} photos reached.</div>}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiTag className="text-indigo-600" />
              Tags <span className="text-red-500">*</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    tags.includes(tag) ? handleRemoveTag(tag) : setTags([...tags, tag])
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${tags.includes(tag)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom tag"
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputTag.trim()) {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-indigo-900"
                    >
                      <FiX size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiMapPin className="text-indigo-600" />
              Location <span className="text-red-500">*</span>
            </h2>
            <div className="flex flex-row gap-2 mb-4">
              <button
                type="button"
                onClick={autofillLocation}
                disabled={locationLoading}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {locationLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                    Locating...
                  </>
                ) : (
                  <>
                    <FiMapPin size={14} />
                    Current Loc
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5"
              >
                <FiMapPin size={14} />
                Pin on Map
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Area *"
                value={locationArea}
                onChange={(e) => setLocationArea(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="City *"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Landmark (optional)"
                value={locationLandmark}
                onChange={(e) => setLocationLandmark(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Pincode *"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <input
                type="text"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                readOnly={locationLoading}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                readOnly={locationLoading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">* Required for distance calculation</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || uploading}
            className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
          >
            {submitting || uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                {uploading ? "Uploading Photos..." : "Posting Ad..."}
              </>
            ) : (
              <>
                <FiCheck size={20} />
                Post Ad
              </>
            )}
          </button>
        </form>

        {/* Location Picker Modal */}
        <LocationPickerModal
          show={showLocationPicker}
          initialPosition={{ lat: latitude, lng: longitude }}
          apiKey={LOCATIONIQ_API_KEY}
          apiProvider="locationiq"
          onConfirm={(location) => {
            setLatitude(location.lat);
            setLongitude(location.lng);
            setLocationArea(location.area);
            setLocationCity(location.city);
            setPincode(location.pincode);
            setShowLocationPicker(false);
            setError("");
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
      </div>
    </div>
  );
}
