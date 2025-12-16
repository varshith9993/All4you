// utils/uploadAudioToCloudinary.js
export async function uploadAudioToCloudinary(audioFileOrBlob) {
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/devs4x2aa/auto/upload";
  const CLOUDINARY_UPLOAD_PRESET = "ml_default";

  const formData = new FormData();
  formData.append("file", audioFileOrBlob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });

  if (!response.ok) throw new Error("Failed to upload audio");
  const data = await response.json();
  return data.secure_url;
}
