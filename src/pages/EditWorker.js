import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { FiClock, FiCalendar, FiCamera, FiMapPin, FiX, FiImage, FiFileText, FiUpload, FiArrowLeft, FiRotateCcw } from "react-icons/fi";
import defaultAvatar from "../assets/images/default_profile.png";

const suggestedTags = ["mechanic", "engineer", "tutor", "electrician", "driver", "teacher", "plumber", "carpenter", "painter", "cleaner", "cook", "gardener"];
const OPENCAGE_API_KEY = "43ac78a805af4868b01f3dc9dcae8556";

export default function EditWorker() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [originalData, setOriginalData] = useState(null);

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

  const [uploadedFiles, setUploadedFiles] = useState([]); // Unified files state: contains { url, file, isExisting, name }
  const [profilePhoto, setProfilePhoto] = useState(null); // New photo file
  const [existingProfilePhotoUrl, setExistingProfilePhotoUrl] = useState(""); // Existing photo URL

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Load worker data
  useEffect(() => {
    async function fetchWorker() {
      try {
        const docRef = doc(db, "workers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Map existing files (array of strings) to unified structure
          const loadedFiles = (data.files || []).map((url, i) => {
            let name = `File ${i + 1}`;
            try {
              name = decodeURIComponent(url.split('/').pop().split('?')[0]);
            } catch (e) { }
            return { url: url, name: name, isExisting: true };
          });

          const workerData = {
            title: data.title || "",
            description: data.description || "",
            tags: data.tags || [],
            profilePhotoUrl: data.profileImage || "",
            files: loadedFiles,
            locationArea: data.location?.area || "",
            locationLandmark: data.location?.landmark || "",
            locationCity: data.location?.city || "",
            pincode: data.location?.pincode || "",
            latitude: data.latitude || "",
            longitude: data.longitude || "",
          };

          setOriginalData(workerData);

          setTitle(workerData.title);
          setDescription(workerData.description);
          setTags(workerData.tags);
          setExistingProfilePhotoUrl(workerData.profilePhotoUrl);
          setUploadedFiles(workerData.files);
          setLocationArea(workerData.locationArea);
          setLocationLandmark(workerData.locationLandmark);
          setLocationCity(workerData.locationCity);
          setPincode(workerData.pincode);
          setLatitude(workerData.latitude);
          setLongitude(workerData.longitude);

        } else {
          setError("Worker not found");
        }
      } catch (err) {
        console.error("Error fetching worker:", err);
        setError("Failed to load worker data");
      } finally {
        setLoading(false);
      }
    }
    fetchWorker();
  }, [id]);

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
      alert("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLatitude(latitude);
      setLongitude(longitude);
      try {
        const geoRes = await axios.get("https://api.opencagedata.com/geocode/v1/json", {
          params: { key: OPENCAGE_API_KEY, q: `${latitude}+${longitude}`, pretty: 1 },
        });
        const components = geoRes.data.results[0].components;
        setLocationArea(components.suburb || components.neighbourhood || "");
        setLocationCity(components.city || components.town || components.village || "");
        setPincode(components.postcode || "");
      } catch {
        alert("Failed to get location details.");
      }
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file size (Max 10MB)
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
    }

    const newFiles = files.map(file => ({
      file,
      name: file.name,
      isExisting: false,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (idx) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleProfilePhotoChange = (e) => {
    setProfilePhoto(e.target.files[0] || null);
  };

  const handleReset = () => {
    if (!originalData) return;
    setTitle(originalData.title);
    setDescription(originalData.description);
    setTags(originalData.tags);
    setExistingProfilePhotoUrl(originalData.profilePhotoUrl);
    setProfilePhoto(null);
    setUploadedFiles(originalData.files);
    setLocationArea(originalData.locationArea);
    setLocationLandmark(originalData.locationLandmark);
    setLocationCity(originalData.locationCity);
    setPincode(originalData.pincode);
    setLatitude(originalData.latitude);
    setLongitude(originalData.longitude);
    setError("");
    setResetConfirm(false);
  };

  const onSubmit = async () => {
    setError("");

    if (!title.trim() || !locationArea.trim() || !locationCity.trim() || !pincode.trim()) {
      setError("Please fill all required fields");
      setSaveConfirm(false);
      return;
    }

    if (tags.length === 0) {
      setError("Please add at least one tag");
      setSaveConfirm(false);
      return;
    }

    if (!latitude || !longitude) {
      setError("Please get your location to calculate distance");
      setSaveConfirm(false);
      return;
    }

    setSubmitting(true);

    try {
      // Upload Profile Photo if changed
      let profilePhotoUrl = existingProfilePhotoUrl;
      if (profilePhoto) {
        // Use Cloudinary for consistency with AddWorkers
        profilePhotoUrl = await uploadFileToCloudinary(profilePhoto);
      }

      // Upload New Files
      const finalFiles = [];
      for (const f of uploadedFiles) {
        if (f.isExisting) {
          finalFiles.push(f.url);
        } else if (f.file) {
          const fileUrl = await uploadFileToCloudinary(f.file);
          finalFiles.push(fileUrl);
        }
      }

      const updateData = {
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
        files: finalFiles,
        profileImage: profilePhotoUrl,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "workers", id), updateData);
      setSaveConfirm(false);
      navigate(-1);
    } catch (err) {
      console.error("Update worker error:", err);
      setError(`Failed to update worker. Try again. Error: ${err.message || err}`);
      setSubmitting(false);
      setSaveConfirm(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Worker Profile</h1>
          <p className="text-gray-600">Update worker details</p>
        </div>

        <div className="space-y-6">
          {/* Profile Photo */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={profilePhoto ? URL.createObjectURL(profilePhoto) : existingProfilePhotoUrl || defaultAvatar}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-indigo-700 transition-colors">
                  <FiCamera size={16} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">Tap camera to change photo</p>
            </div>
          </div>

          {/* Title */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              maxLength={70}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Worker Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Describe your skills and experience..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Skills & Tags <span className="text-red-500">*</span></label>
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
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                <FiMapPin /> Location <span className="text-red-500">*</span>
              </label>
              <button type="button" className="text-xs font-bold text-indigo-600 hover:underline" onClick={autofillLocation}>
                Get Current Location
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Area" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={locationArea} onChange={(e) => setLocationArea(e.target.value)} required />
              <input type="text" placeholder="Landmark (optional)" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={locationLandmark} onChange={(e) => setLocationLandmark(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="City" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} required />
                <input type="text" placeholder="Pincode" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <input type="text" placeholder="Latitude" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
                <input type="text" placeholder="Longitude" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Work Gallery */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiImage className="text-indigo-600" />
              Work Gallery <span className="text-sm font-normal text-gray-500">(Optional)</span>
            </h2>
            <label className="cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-indigo-500 transition-colors text-center">
                <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                <span className="text-sm text-gray-600">
                  Click to upload files
                </span>
                <p className="text-xs text-gray-500 mt-1">Images, PDFs, Docs (Max 10MB)</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {uploadedFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {uploadedFiles.map((fileObj, idx) => {
                  // Determine if it's an image.
                  let isImage = false;
                  let displayUrl = "";

                  if (fileObj.isExisting) {
                    // Simple check for image extension for existing files
                    isImage = (fileObj.url || "").match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)/i);
                    displayUrl = fileObj.url;
                  } else {
                    isImage = fileObj.file.type.startsWith('image/');
                    displayUrl = fileObj.preview;
                  }

                  let iconColor = "text-gray-500";
                  let Icon = FiFileText;
                  const ext = fileObj.name.split('.').pop().toLowerCase();

                  if (ext === 'pdf') { iconColor = "text-red-500"; }
                  else if (['doc', 'docx'].includes(ext)) { iconColor = "text-blue-500"; }
                  else if (['ppt', 'pptx'].includes(ext)) { iconColor = "text-orange-500"; }
                  else if (['xls', 'xlsx'].includes(ext)) { iconColor = "text-green-500"; }
                  else if (['zip', 'rar'].includes(ext)) { iconColor = "text-yellow-600"; }

                  return (
                    <div key={idx} className="relative group">
                      {isImage ? (
                        <img
                          src={displayUrl}
                          alt={`Upload ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center p-2">
                          <Icon size={24} className={`mb-1 ${iconColor}`} />
                          <span className="text-[10px] text-center w-full truncate px-1 text-gray-700">
                            {fileObj.name.length > 20 ? fileObj.name.substring(0, 20) + '...' : fileObj.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
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
                onClick={onSubmit}
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