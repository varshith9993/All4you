import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiTag, FiFileText, FiUpload, FiX, FiCheck, FiChevronDown, FiArrowLeft, FiImage } from "react-icons/fi";
import LocationPickerModal from "../components/LocationPickerModal";
import ActionMessageModal from "../components/ActionMessageModal";
import { compressFile } from "../utils/compressor";
import { countries } from "../utils/countries";

const suggestedTags = ["mechanic", "security", "receptionist", "waiter", "tutor", "electrician", "driver", "teacher", "plumber", "carpenter", "painter", "cleaner", "cook", "gardener", "care taker", "marketing", "technician", "delivery boy", "developer", "labour", "driving tutor", "coding tutor"];
const LOCATIONIQ_API_KEY = "pk.c46b235dc808aed78cb86bd70c83fab0";
// const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/devs4x2aa/auto/upload"; // Deprecated global const

export default function AddWorkers() {
  const [currentUser, setCurrentUser] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [inputTag, setInputTag] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [locationLandmark, setLocationLandmark] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("India"); // Default to India
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [actionModal, setActionModal] = useState({ isOpen: false, title: "", message: "", type: "success", onOk: null });

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
    const compressedFile = await compressFile(file, {}, 'WORKER_POST');
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", "ml_default");

    // Use 'auto' resource type for all files
    // This allows Cloudinary to automatically detect the file type
    // and handle PDFs better than 'raw' type (which has restrictions on free accounts)
    const uploadUrl = `https://api.cloudinary.com/v1_1/devs4x2aa/auto/upload`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Cloudinary upload error:", errorData);
      throw new Error(`Failed to upload file: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.secure_url;
  };



  const handleFilesChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file size (Max 2MB)
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 2MB limit.`);
        return;
      }
    }

    try {
      setUploading(true);
      const urls = [];
      for (const file of files) {
        const url = await uploadFileToCloudinary(file);
        urls.push(url);
      }
      setUploadedFiles([...uploadedFiles, ...urls]);
      setError("");
    } catch (err) {
      setError("Failed to upload files. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
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
        const { latitude, longitude } = pos.coords;
        setLatitude(latitude.toString());
        setLongitude(longitude.toString());

        try {
          const geoRes = await axios.get(`https://us1.locationiq.com/v1/reverse.php`, {
            params: {
              key: LOCATIONIQ_API_KEY,
              lat: latitude,
              lon: longitude,
              format: 'json'
            },
          });
          const addr = geoRes.data.address;
          setLocationArea(addr.suburb || addr.neighbourhood || addr.village || "");
          setLocationCity(addr.city || addr.town || addr.county || "");
          setPincode(addr.postcode || "");
          if (addr.country) setCountry(addr.country);
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

    if (!title.trim() || !locationArea.trim() || !locationCity.trim() || !pincode.trim()) {
      setError("Please fill all required fields");
      return;
    }

    if (!latitude || !longitude) {
      setError("Please get your location to calculate distance");
      return;
    }

    if (!currentUser) {
      setError("You must be logged in");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Fetch user profile for Denormalization (Read Optimization)
      const userProfileSnap = await getDoc(doc(db, "profiles", currentUser.uid));
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : {};

      // Use user's profile image since we removed the custom upload
      const profilePhotoUrl = userProfile.profileImage || "";

      await addDoc(collection(db, "workers"), {
        title: title.trim(),
        description: description.trim(),
        tags,
        location: {
          area: locationArea.trim(),
          landmark: locationLandmark.trim(),
          city: locationCity.trim(),
          pincode: pincode.trim(),
          country: country.trim() || "India"
        },
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        profileImage: profilePhotoUrl || "",
        files: uploadedFiles,
        status: "active",
        country: country.trim() || "India",
        countryScope: 'local', // Workers are local by default

        // Denormalized Author Data - Optimizes reads by embedding author info
        author: {
          uid: currentUser.uid,
          username: userProfile.username || "Unknown",
          photoURL: userProfile.profileImage || profilePhotoUrl || "",
          online: !!userProfile.online,
          lastSeen: userProfile.lastSeen || null,
          verified: !!userProfile.verified
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      setSubmitting(false);

      setActionModal({
        isOpen: true,
        title: "Success!",
        message: "Worker post created successfully.",
        type: "success",
        onOk: () => navigate("/workers")
      });
    } catch (err) {
      console.error("Submission error:", err);
      setError(`Failed to create worker post: ${err.message || err}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go Back"
          >
            <FiArrowLeft size={24} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Worker Post</h1>
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Profile Photo Section Removed as per request (Uses Main Profile Image) */}

          {/* Title & Description */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiFileText className="text-indigo-600" />
              Worker Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g., Experienced Electrician Available"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">{title.length}/120 characters</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe your skills and experience..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                  rows={5}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiTag className="text-indigo-600" />
              Skills & Tags
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
              Location
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
                    Get Location
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
            <div className="space-y-4">
              {/* Row 1: Area & City */}
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {/* Row 2: Pincode & Landmark */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Pincode *"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
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
              </div>

              {/* Row 3: Country */}
              <div className="w-full relative">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none"
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 ">
                  <FiChevronDown />
                </div>
              </div>

              {/* Row 4: Lat & Long */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  readOnly
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  readOnly
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">* Required for distance calculation</p>
          </div>

          {/* Work Gallery */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiImage className="text-indigo-600" />
              Work Gallery <span className="text-sm font-normal text-gray-500">(Optional)</span>
            </h2>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-indigo-500 transition-colors text-center">
                <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                <span className="text-sm text-gray-600">
                  {uploading ? "Uploading..." : "Click to upload work samples"}
                </span>
                <p className="text-xs text-gray-500 mt-1">Images, PDFs, PPTs, Docs (Max 2MB)</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFilesChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {uploadedFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {uploadedFiles.map((url, idx) => {
                  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i);
                  return (
                    <div key={idx} className="relative group">
                      {isImage ? (
                        <img
                          src={url}
                          alt={`Upload ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center text-gray-500 p-2">
                          <FiFileText size={24} className="mb-1" />
                          <span className="text-[10px] text-center w-full truncate px-1">
                            {url.split('/').pop().split('?')[0].substring(0, 20)}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm transition-colors"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Creating Worker Post...
              </>
            ) : (
              <>
                <FiCheck size={20} />
                Create Worker Post
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
            if (location.country) setCountry(location.country);
            setShowLocationPicker(false);
            setError("");
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
        <ActionMessageModal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
          title={actionModal.title}
          message={actionModal.message}
          type={actionModal.type}
          onOk={actionModal.onOk}
        />
      </div>
    </div>
  );
}