import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import axios from "axios";
import { FiArrowLeft, FiX, FiMapPin, FiUploadCloud, FiRotateCcw } from "react-icons/fi";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/devs4x2aa/upload";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";
const OPENCAGE_API_KEY = "43ac78a805af4868b01f3dc9dcae8556";
const suggestedTags = ["discount", "offer", "sale", "new", "limited", "popular"];
const MAX_PHOTOS = 8;

export default function EditAd() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locationMsg, setLocationMsg] = useState("");

  // Original data for reset
  const [originalData, setOriginalData] = useState(null);

  // Form fields
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState("");

  // Confirmation modals
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Fetch ad data on mount
  useEffect(() => {
    async function fetchAd() {
      try {
        const ref = doc(db, "ads", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const adData = {
            photos: data.photos || [],
            title: data.title || "",
            description: data.description || "",
            tags: data.tags || [],
            locationArea: data.location?.area || "",
            locationLandmark: data.location?.landmark || "",
            locationCity: data.location?.city || "",
            pincode: data.location?.pincode || "",
            latitude: data.latitude || "",
            longitude: data.longitude || "",
            avatarUrl: data.profileImage || "",
            username: data.username || "",
          };

          setOriginalData(adData);
          setPhotos(adData.photos);
          setPhotoPreviews(adData.photos);
          setTitle(adData.title);
          setDescription(adData.description);
          setTags(adData.tags);
          setLocationArea(adData.locationArea);
          setLocationLandmark(adData.locationLandmark);
          setLocationCity(adData.locationCity);
          setPincode(adData.pincode);
          setLatitude(adData.latitude);
          setLongitude(adData.longitude);
          setAvatarUrl(adData.avatarUrl);
          setUsername(adData.username);
        } else {
          alert("Ad not found");
          navigate(-1);
        }
      } catch (err) {
        console.error("Error fetching ad:", err);
        alert("Failed to load ad");
        navigate(-1);
      }
      setLoading(false);
    }
    fetchAd();
  }, [id, navigate]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + photos.length > MAX_PHOTOS) {
      alert(`You can upload maximum ${MAX_PHOTOS} photos.`);
      return;
    }

    setNewPhotoFiles([...newPhotoFiles, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
    setPhotos([...photos, ...files.map(() => "PENDING_UPLOAD")]);
  };

  const removePhoto = (idx) => {
    const photoToRemove = photos[idx];
    if (photoToRemove === "PENDING_UPLOAD") {
      const pendingIndex = photos.slice(0, idx).filter(p => p === "PENDING_UPLOAD").length;
      setNewPhotoFiles(newPhotoFiles.filter((_, i) => i !== pendingIndex));
    }
    setPhotos(photos.filter((_, i) => i !== idx));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== idx));
  };

  const uploadFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
      return res.data.secure_url;
    } catch (err) {
      throw new Error("Cloudinary upload failed: " + (err.response?.data?.error?.message || err.message));
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
    setLocationMsg("Getting location...");
    setError("");
    if (!navigator.geolocation) {
      setLocationMsg("");
      setError("Geolocation not supported.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        const geoRes = await axios.get("https://api.opencagedata.com/geocode/v1/json", {
          params: { key: OPENCAGE_API_KEY, q: `${lat}+${lng}`, pretty: 1 },
        });
        const components = geoRes.data.results[0].components;
        setLocationArea(components.suburb || components.neighbourhood || "");
        setLocationCity(components.city || components.town || components.village || "");
        setPincode(components.postcode || "");
        setLocationMsg("Location fetched!");
      } catch {
        setLocationMsg("");
        setError("Failed to fetch location details.");
      } finally {
        setLocationLoading(false);
      }
    }, () => {
      setLocationMsg("");
      setError("Failed to fetch location.");
      setLocationLoading(false);
    });
  };



  const handleReset = () => {
    if (!originalData) return;
    setPhotos(originalData.photos);
    setPhotoPreviews(originalData.photos);
    setNewPhotoFiles([]);
    setTitle(originalData.title);
    setDescription(originalData.description);
    setTags(originalData.tags);
    setLocationArea(originalData.locationArea);
    setLocationLandmark(originalData.locationLandmark);
    setLocationCity(originalData.locationCity);
    setPincode(originalData.pincode);
    setLatitude(originalData.latitude);
    setLongitude(originalData.longitude);
    setAvatarUrl(originalData.avatarUrl);
    setUsername(originalData.username);
    setError("");
    setResetConfirm(false);
  };

  const handleSave = async () => {
    setError("");

    if (photos.length === 0) {
      setError("Please upload at least one photo.");
      setSaveConfirm(false);
      return;
    }
    if (!title.trim() || !description.trim() || !locationArea.trim() || !locationCity.trim() || !pincode.trim() || !latitude.trim() || !longitude.trim()) {
      setError("Please fill all required fields, including location and coordinates.");
      setSaveConfirm(false);
      return;
    }
    if (tags.length === 0) {
      setError("Please add at least one tag.");
      setSaveConfirm(false);
      return;
    }

    setSubmitting(true);

    try {
      const finalPhotos = [];
      let newFileIndex = 0;

      for (const photo of photos) {
        if (photo === "PENDING_UPLOAD") {
          const url = await uploadFileToCloudinary(newPhotoFiles[newFileIndex]);
          finalPhotos.push(url);
          newFileIndex++;
        } else {
          finalPhotos.push(photo);
        }
      }

      await updateDoc(doc(db, "ads", id), {
        username: username,
        profileImage: avatarUrl,
        photos: finalPhotos,
        title: title.trim(),
        description: description.trim(),
        tags,
        location: {
          area: locationArea.trim(),
          landmark: locationLandmark.trim(),
          city: locationCity.trim(),
          pincode: pincode.trim(),
        },
        latitude: latitude.trim(),
        longitude: longitude.trim(),
      });

      setNewPhotoFiles([]);
      setPhotos(finalPhotos);
      setPhotoPreviews(finalPhotos);
      setSaveConfirm(false);
      navigate(-1);
    } catch (err) {
      setError(`Failed to save changes. Please try again. ${err.message ? `(${err.message})` : ""}`);
      setSaveConfirm(false);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 transition-colors"
          >
            <FiArrowLeft size={20} /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Ad</h1>
          <p className="text-gray-600">Update your advertisement details</p>
        </div>

        <div className="space-y-6">
          {/* Photos */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block font-bold text-gray-700 mb-2">Photos (Max 8) <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-3">
              {photoPreviews.map((src, idx) => (
                <div key={idx} className="relative group">
                  <img src={src} alt={`preview-${idx}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm" crossOrigin="anonymous" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <FiUploadCloud className="text-gray-400" size={20} />
                  <span className="text-[10px] text-gray-500 mt-1">Upload</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
                </label>
              )}
            </div>
          </section>



          {/* Title */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block font-bold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Ad Title"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">{title.length}/120</div>
          </section>

          {/* Description */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block font-bold text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Describe your ad..."
            />
          </section>

          {/* Tags */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block font-bold text-gray-700 mb-2">Tags <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${tags.includes(tag) ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  onClick={() => (tags.includes(tag) ? handleRemoveTag(tag) : setTags([...tags, tag]))}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Add custom tag"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputTag.trim()) {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-900"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border border-indigo-100"
                >
                  #{tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                    <FiX size={12} />
                  </button>
                </span>
              ))}
            </div>
          </section>

          {/* Location */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                <FiMapPin /> Location <span className="text-red-500">*</span>
              </label>
              <button type="button" className="text-xs font-bold text-indigo-600 hover:underline" onClick={autofillLocation} disabled={locationLoading}>
                {locationLoading ? "Getting..." : "Get Current Location"}
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" value={locationArea} onChange={e => setLocationArea(e.target.value)} placeholder="Area" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
              <input type="text" value={locationLandmark} onChange={e => setLocationLandmark(e.target.value)} placeholder="Landmark (optional)" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="City" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
                <input type="text" value={pincode} onChange={e => setPincode(e.target.value)} placeholder="Pincode" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="Latitude" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
                <input type="text" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="Longitude" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
              </div>
              {locationMsg && <div className="text-xs text-green-600 font-medium">{locationMsg}</div>}
            </div>
          </section>

          {/* Error message */}
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center">{error}</div>}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 max-w-2xl mx-auto z-40 shadow-lg">
        <button
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
          onClick={() => setResetConfirm(true)}
          disabled={submitting}
        >
          <FiRotateCcw /> Reset Changes
        </button>
        <button
          className="flex-[2] bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          onClick={() => setSaveConfirm(true)}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Save Confirmation Modal */}
      {saveConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center m-4">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Save Changes?</h3>
            <p className="text-gray-500 text-sm mb-6">Are you sure you want to save these changes?</p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200"
                onClick={() => setSaveConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:opacity-90"
                onClick={handleSave}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Yes, Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center m-4">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Reset Changes?</h3>
            <p className="text-gray-500 text-sm mb-6">This will discard all your changes. Are you sure?</p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200"
                onClick={() => setResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-700"
                onClick={handleReset}
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
