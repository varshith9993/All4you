import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FiClock, FiMapPin, FiTag, FiFileText, FiImage, FiUpload, FiX, FiCheck } from "react-icons/fi";

const suggestedTags = ["note-taking", "delivery", "electrician", "repairs", "consulting", "cleaning", "plumbing", "tutoring", "moving", "gardening", "coding", "design", "writing"];
const OPENCAGE_API_KEY = "43ac78a805af4868b01f3dc9dcae8556";
// const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/devs4x2aa/auto/upload"; // Deprecated global const

export default function AddServices() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [inputTag, setInputTag] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [locationLandmark, setLocationLandmark] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [expiryMode, setExpiryMode] = useState("preset");
  const [expiryPreset, setExpiryPreset] = useState("");
  const [expiryCustom, setExpiryCustom] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [serviceType, setServiceType] = useState("provide");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  const uploadFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
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

  const handleAddTag = () => {
    if (inputTag.trim() && !tags.includes(inputTag.trim())) {
      setTags([...tags, inputTag.trim()]);
    }
    setInputTag("");
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const autofillLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      return;
    }
    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLatitude(latitude.toString());
      setLongitude(longitude.toString());
      try {
        const geoRes = await axios.get("https://api.opencagedata.com/geocode/v1/json", {
          params: { key: OPENCAGE_API_KEY, q: `${latitude}+${longitude}`, pretty: 1 },
        });
        const components = geoRes.data.results[0].components;
        setLocationArea(components.suburb || components.neighbourhood || "");
        setLocationCity(components.city || components.town || components.village || "");
        setPincode(components.postcode || "");
      } catch {
        setError("Failed to get location details");
      } finally {
        setLocationLoading(false);
      }
    }, (err) => {
      setError("Failed to get location");
      setLocationLoading(false);
    });
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const totalFiles = uploadedFiles.length + selectedFiles.length;

    if (totalFiles > 12) {
      setError(`You can upload a maximum of 12 files. You already have ${uploadedFiles.length}.`);
      return;
    }

    if (selectedFiles.length === 0) return;

    // Validate file size (Max 10MB)
    for (const file of selectedFiles) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
    }

    try {
      setUploading(true);
      setError("");

      const newUploadedFiles = [];
      for (const file of selectedFiles) {
        const url = await uploadFileToCloudinary(file);
        newUploadedFiles.push({ name: file.name, url });
      }

      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      e.target.value = ""; // Reset input
    } catch (err) {
      setError("Failed to upload files. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      setError("");
      const url = await uploadFileToCloudinary(file);
      setProfilePhotoUrl(url);
    } catch (err) {
      setError("Failed to upload profile photo");
      console.error(err);
    } finally {
      setUploading(false);
    }
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

    const finalExpiry = (() => {
      if (expiryMode === "preset") {
        if (!expiryPreset) return null;
        if (expiryPreset === "never") return new Date("9999-12-31T23:59:59Z");

        // Calculate expiry based on preset values
        const now = new Date();
        switch (expiryPreset) {
          case "24h":
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
          case "7d":
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          case "30d":
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          case "90d":
            return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          default:
            return null;
        }
      } else if (expiryMode === "custom") {
        if (!expiryCustom) return null;
        return new Date(expiryCustom);
      }
      return null;
    })();

    if (!finalExpiry) {
      setError("Please select an expiry date/time");
      return;
    }

    if (expiryPreset !== "never" && finalExpiry <= new Date()) {
      setError("Please select a valid expiry date/time in the future");
      return;
    }

    if (!currentUser) {
      setError("You must be logged in");
      return;
    }

    if (tags.length === 0) {
      setError("Please add at least one tag");
      return;
    }

    setSubmitting(true);

    try {
      // Create the service document
      await addDoc(collection(db, "services"), {
        title: title.trim(),
        description: description.trim(),
        tags,
        location: {
          area: locationArea.trim(),
          landmark: locationLandmark.trim(),
          city: locationCity.trim(),
          pincode: pincode.trim(),
        },
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        expiry: finalExpiry,
        attachments: uploadedFiles,
        profilePhotoUrl: profilePhotoUrl || "",
        type: serviceType,
        serviceType,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      // Show success message immediately
      setSuccess("You've successfully created the post!");
      setSubmitting(false);

      // Navigate after a short delay
      setTimeout(() => {
        navigate("/services");
      }, 1500);
    } catch (err) {
      console.error("Submission error:", err);
      setError(`Failed to create service: ${err.message || err}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Service Post</h1>
          <p className="text-gray-600">Share your service or request help from the community</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Service Type Selection */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiFileText className="text-blue-600" />
              Service Type
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setServiceType("provide")}
                className={`p-4 rounded-xl border-2 transition-all ${serviceType === "provide"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🛠️</div>
                  <div className="font-bold">Providing</div>
                  <div className="text-xs mt-1 opacity-75">I offer this service</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setServiceType("ask")}
                className={`p-4 rounded-xl border-2 transition-all ${serviceType === "ask"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="font-bold">Asking</div>
                  <div className="text-xs mt-1 opacity-75">I need this service</div>
                </div>
              </button>
            </div>
          </div>

          {/* Profile Photo */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiImage className="text-blue-600" />
              Profile Photo <span className="text-sm font-normal text-gray-500">(Optional)</span>
            </h2>
            <div className="flex items-center gap-4">
              {profilePhotoPreview && (
                <img src={profilePhotoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              )}
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-500 transition-colors text-center">
                  <FiUpload className="mx-auto text-gray-400 mb-2" size={24} />
                  <span className="text-sm text-gray-600">
                    {uploading ? "Uploading..." : "Click to upload photo"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Title & Description */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Service Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g., Professional Plumbing Services"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">{title.length}/120 characters</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe your service in detail..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  rows={5}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiTag className="text-blue-600" />
              Tags
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => tags.includes(tag) ? handleRemoveTag(tag) : setTags([...tags, tag])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${tags.includes(tag)
                    ? "bg-blue-600 text-white"
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
                onChange={e => setInputTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && inputTag.trim()) {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2"
                  >
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900">
                      <FiX size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiMapPin className="text-blue-600" />
              Location
            </h2>
            <button
              type="button"
              onClick={autofillLocation}
              disabled={locationLoading}
              className="mb-4 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {locationLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Getting location...
                </>
              ) : (
                <>
                  <FiMapPin size={16} />
                  Get Current Location
                </>
              )}
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Area *"
                value={locationArea}
                onChange={e => setLocationArea(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="City *"
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Landmark (optional)"
                value={locationLandmark}
                onChange={e => setLocationLandmark(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Pincode *"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <input
                type="text"
                placeholder="Latitude"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                readOnly={locationLoading}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                readOnly={locationLoading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">* Required for distance calculation</p>
          </div>

          {/* Post Expiry */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiClock className="text-blue-600" />
              Post Expiry
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setExpiryMode("preset")}
                className={`p-4 rounded-xl border-2 transition-all ${expiryMode === "preset"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div className="font-bold text-center">Preset Duration</div>
              </button>
              <button
                type="button"
                onClick={() => setExpiryMode("custom")}
                className={`p-4 rounded-xl border-2 transition-all ${expiryMode === "custom"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
                  }`}
              >
                <div className="font-bold text-center">Custom Date</div>
              </button>
            </div>

            {expiryMode === "preset" && (
              <select
                value={expiryPreset}
                onChange={e => { setExpiryPreset(e.target.value); setExpiryCustom(""); }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select duration...</option>
                <option value="never">Until I change (no expiry)</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>
            )}

            {expiryMode === "custom" && (
              <input
                type="datetime-local"
                value={expiryCustom}
                onChange={e => { setExpiryCustom(e.target.value); setExpiryPreset(""); }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiUpload className="text-blue-600" />
              Attachments <span className="text-sm font-normal text-gray-500">(Optional)</span>
            </h2>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-500 transition-colors text-center">
                <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                <span className="text-sm text-gray-600">
                  {uploading ? "Uploading..." : "Click to upload images or files"}
                </span>
                <p className="text-xs text-gray-500 mt-1">Images, PDFs, PPTs, Docs (Max 10MB)</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {uploadedFiles.length > 0 && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {uploadedFiles.map((file, index) => {
                    // Check if it's likely an image based on name or URL structure
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name) || /\/image\/upload\//.test(file.url);

                    return (
                      <div key={index} className="relative h-24 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden group">
                        {isImage ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-500 p-2 text-center w-full h-full">
                            <FiFileText size={24} className="mb-1 text-blue-500" />
                            <span className="text-[10px] leading-tight line-clamp-2 break-all px-1">{file.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm opacity-90 transition-opacity"
                        >
                          <FiX size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500 text-right mt-2">
                  {uploadedFiles.length}/12 files
                </div>
              </>
            )}
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
              {success}
            </div>
          )}

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
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Creating Service...
              </>
            ) : (
              <>
                <FiCheck size={20} />
                Create Service Post
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}